const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const commands = require('./commands.js');

class Server extends net.Server {
 constructor() {
  super();
  this.startdate = new Date();
  this.config = require('./config.js');
  this.users = this.config.users;
  this.systemChannels = ['connected', 'disconnected', 'system'];
  this.adminChannels = ['admin', 'administrator', 'administrators'];
  this.connectedClients = new Set();
  this.authorizedClients = new Set();
  this.authorizePrompt = `Who's there?\n`;
  this.authorizeTimeout = 30000;
  this.encoding = 'utf8';
  this.on('connection', client => this.handleConnection({ client }));
  this.config.listen && this.listen(this.config.listen);
 }

 updateConfigFile() {
  return new Promise((resolve, reject) => {
   if (!this.config.path) reject('path not set');
   else {
    fs.writeFile(this.config.path, JSON.stringify(this.config, null, 1), err => {
     if (err) reject(err);
     else resolve();
    });
   }
  }).catch(value => value);
 }

 handleConnection({
  client,
  encoding = this.encoding,
 }) {
  this.connectedClients.add(client);
  client.on('close', () => this.connectedClients.delete(client));
  encoding && client.setEncoding(encoding);
  client.bufferedData = '';
  this.authorize({ client }).then(({ user }) => this.handleAuthorizedConnection({ client, user })).catch(({ message }) => {
   if (!client.destroyed) client.destroy();
  });
 }

 handleAuthorizedConnection({
  client,
  user,
 }) {
  client.user = user;
  const existingClient = this.findConnectedUser({ name: user.name, exactMatch: true });
  if (existingClient) {
   existingClient.write(`*** Switching your session to a new port ***\n`);
   existingClient.destroySilently = true;
   existingClient.destroy();
   client.write(`*** Reconnected ***\n`);
   this.sendMessage({ channel: 'connected', message: `${user.name} reconnected.` });
  } else {
   client.write(`*** Connected ***\n`);
   this.sendMessage({ channel: 'connected', message: `${user.name} connected.` });
  }
  this.authorizedClients.add(client);
  client.on('data', data => this.parseClientData({ client, data }));
  client.on('close', () => {
   this.authorizedClients.delete(client)
   if (!client.destroySilently) this.sendMessage({ channel: 'disconnected', message: `${user.name} disconnected.` });
  });
  this.emit('authorizedConnection', client);
 }

 authorize({
  client,
  prompt = this.authorizePrompt,
  timeout = this.authorizeTimeout,
 }) {
  const eventListeners = {};
  typeof timeout === 'number' && client.setTimeout(timeout);
  return new Promise((resolve, reject) => {
   prompt && client.write(prompt);
   eventListeners['data'] = rawData => {
    const data = rawData.trim().match(/^([^\s]+)\s*(.*)$/);
    if (data) {
     const username = data[1].trim();
     const password = crypto.createHash('sha256').update(data[2] ? data[2].trim() : '').digest('hex');
     const user = this.users.hasOwnProperty(username) && typeof this.users[username] === 'object' && this.users[username];
     if (!user) return reject({ message: `invalid username: ${username}` });
     if (!user.password || !user.password.match(/^[a-z0-9]{64}$/)) user.password = crypto.createHash('sha256').update(user.password || '').digest('hex');
     if (user.password !== password) return reject({ message: `invalid password for ${username}: ${data[2].trim()}` });
     if (user.banned) return reject({ message: `user banned: ${username}` });
     return resolve({ user: this.getUser(username) });
    }
    else reject({ message: `invalid data: ${rawData}` });
   };
   eventListeners['error'] = error => reject({ message: `connection error: ${error.message()}` });
   eventListeners['close'] = () => reject({ message: 'connection close' });
   eventListeners['timeout'] = () => reject({ message: 'connection timeout' });
   for (let eventName in eventListeners) client.on(eventName, eventListeners[eventName]);
  }).finally(() => {
   typeof timeout === 'number' && !client.destroyed && client.setTimeout(0);
   for (let eventName in eventListeners) {
    client.off(eventName, eventListeners[eventName]);
    delete eventListeners[eventName];
   }
  });
 }

 shutdown({
  client,
  reason,
 } = {}) {
  if (client) {
   client.write(`Shutting down the server...\n`);
   this.sendMessage({ channel: 'system', from: client, message: `:unceremoniously shuts down the server.${reason ? ` Reason: ${reason}` : ''}`, excludedClients: [client] });
  } else {
   this.sendMessage({ channel: 'system', message: `Server shutting down.${reason ? ` Reason: ${reason}` : ''}` });
  }
  this.close();
  this.connectedClients.forEach(xClient => xClient.destroy());
 }

 getUser(username) {
  // Gets a user by its username and ensures that its props are correctly set.
  const user = this.users.hasOwnProperty(username) && typeof this.users[username] === 'object' && this.users[username];
  if (user) {
   if (typeof user.name !== 'string') user.name = username;
   if (!user.password || !user.password.match(/^[a-z0-9]{64}$/)) user.password = crypto.createHash('sha256').update(user.password || '').digest('hex');
   if (!Array.isArray(user.channels)) {
    user.channels = [...this.systemChannels];
    if (user.admin) user.channels.push('admin');
   }
   else if (!user.admin && user.channels.length > 0) {
    this.adminChannels.forEach(channel => {
     const i = user.channels.indexOf(channel);
     if (i !== -1) user.channels.splice(i, 1);
    });
   }
   if (user.banned && typeof user.banned !== 'object') user.banned = {};
  }
  return user;
 }

 findUser({
  name,
  exactMatch,
 }) {
  const lcName = name.toLowerCase();
  if (exactMatch) {
   for (let username in this.users) {
    if ((this.users[username].name || username).toLowerCase() === lcName) return this.getUser(username);
   }
  } else {
   for (let username in this.users) {
    if ((this.users[username].name || username).toLowerCase().startsWith(lcName)) return this.getUser(username);
   }
  }
 }

 findConnectedUser({
  name,
  exactMatch,
 }) {
  const lcName = name.toLowerCase();
  if (exactMatch) {
   for (let client of this.authorizedClients) {
    if (client.user.name.toLowerCase() === lcName) return client;
   }
  } else {
   for (let client of this.authorizedClients) {
    if (client.user.name.toLowerCase().startsWith(lcName)) return client;
   }
  }
 }

 parseClientData({
  client,
  data,
 }) {
  data = data.replace(/\r/g, "\n");
  if (client.bufferedData) data = `${client.bufferedData}${data}`;
  data = data.split("\n");
  client.bufferedData = data[data.length - 1];
  if (data.length > 1) data.slice(0, -1).forEach(command => command && this.parseClientCommand({ client, command }));
 }

 parseClientCommand({
  client,
  command,
 }) {
  const data = command.match(/^\s*([^\s]+)(\s+(.+))?$/);
  if (data) {
   const verb = data[1].toLowerCase();
   const argstr = data[3];
   if (commands.hasOwnProperty(verb)) commands[verb].call(this, { client, verb, argstr, command });
   else client.write(`Unknown command. Use the H command if you need help.\n`);
  }
 }

 sendMessage({
  channel,
  message,
  from,
  excludedClients = [],
 }) {
  const name = (typeof from === 'object' ? from.user.name : from);
  if (channel) {
   const data = `[${channel}] ${name ? `${name}${message.startsWith(':') ? ` ${message.slice(1)}` : `: ${message}`}` : message}\n`;
   this.authorizedClients.forEach(client => !excludedClients.includes(client) && client.user.channels.includes(channel) && client.write(data));
  } else {
   const data = `${name ? `${name}${message.startsWith(':') ? ` ${message.slice(1)}` : `: ${message}`}` : message}\n`;
   this.authorizedClients.forEach(client => !excludedClients.includes(client) && client.write(data));
  }
 }

 sendPrivateMessage({
  message,
  from,
  to,
 }) {
  if (to) {
   const data = `${message.startsWith(':') ? ` ${message.slice(1)}` : `: ${message}`}\n`;
   if (from) {
    from.write(`[PM | ${to.user.name}] You${data}`);
    to.write(`[PM | ${from.user.name}] ${from.user.name}${data}`);
   } else {
    to.write(`[PM | System] Server${data}`);
   }
  }
 }
}

module.exports = Server;
