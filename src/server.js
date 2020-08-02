const crypto = require('crypto');
const fs = require('fs');
const config = require('./config.js');
const commands = require('./commands.js');

const ServerBase = config.tls ? require('tls').Server : require('net').Server;
 
class Server extends ServerBase {
 constructor() {
  super();
  this.startdate = new Date();
  this.metadata = require('../package.json');
  this.version = this.metadata.version.split('.').map(v => parseInt(v));
  this.config = config;
  this.users = this.config.users;
  this.systemChannels = ['connected', 'disconnected', 'system'];
  this.adminChannels = ['admin', 'administrator', 'administrators', 'error', 'debug'];
  this.connectedClients = new Set();
  this.authorizedClients = new Set();
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
  client.on('error', err => undefined);
  encoding && client.setEncoding(encoding);
  client.bufferedData = '';
  this.authorize({ client }).then(({ user }) => this.handleAuthorizedConnection({ client, user })).catch(({ message }) => {
   this.sendMessage({ channel: 'debug', message: `Authentication failed from ${client.address().address}: ${message}` });
   if (!client.destroyed) {
    client.write(`PCS: Disconnect\n`);
    client.destroy();
   }
  });
 }

 handleAuthorizedConnection({
  client,
  user,
 }) {
  client.user = user;
  const existingClient = this.findConnectedUser({ name: user.name, exactMatch: true });
  if (existingClient) {
   existingClient.write(`*** Switching your chat server session to a new port ***\n`);
   existingClient.write(`PCS: Disconnect\n`);
   existingClient.destroySilently = true;
   existingClient.destroy();
   this.sendMessage({ channel: 'connected', message: `${user.name} reconnected.` });
  } else {
   this.sendMessage({ channel: 'connected', message: `${user.name} connected.` });
  }
  client.write(`PCS: Authorized\n`);
  this.authorizedClients.add(client);
  client.on('data', data => this.parseClientData({ client, data }));
  client.on('close', () => {
   this.authorizedClients.delete(client)
   if (!client.destroySilently) this.sendMessage({ channel: 'disconnected', message: `${user.name} disconnected.` });
  });
  client.setKeepAlive(true, 60000);
  this.emit('authorizedConnection', client);
 }

 authorize({
  client,
  timeout = this.authorizeTimeout,
 }) {
  const eventListeners = {};
  typeof timeout === 'number' && client.setTimeout(timeout);
  return new Promise((resolve, reject) => {
   client.write(`PCS: ${this.version[0]}\n`);
   eventListeners['data'] = rawData => {
    const data = rawData.trim().match(/^([^\s]+)\s*(.*)$/);
    if (data) {
     const username = data[1].trim();
     const user = this.users.hasOwnProperty(username) && this.users[username];
     if (!user) return reject({ message: `invalid username: ${username}` });
     const rawPassword = data[2] ? data[2].trim() : '';
     const password = rawPassword.match(/^[a-z0-9]{64}$/) ? rawPassword : crypto.createHash('sha256').update(rawPassword).digest('hex');
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
  this.updateConfigFile();
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
  else if (client.bufferedData.length > 2000000) {
   client.bufferedData = '';
   client.write(`*** Exceeded max command length ***`);
   client.destroy();
  }
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
   const data = `[CM | ${channel}] ${name ? `${name}${message.startsWith(':') ? ` ${message.slice(1)}` : `: ${message}`}` : message}\n`;
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
    from.write(`[PM | ${to.user.name}] ${from.user.name}${data}`);
    to.write(`[PM | ${from.user.name}] ${from.user.name}${data}`);
   } else {
    to.write(`[PM | System] Server${data}`);
   }
  }
 }
}

module.exports = Server;
