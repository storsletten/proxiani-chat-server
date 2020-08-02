const crypto = require('crypto');

const helpTopics = {
 cm: `The CM command sends a message on a channel. Syntax: cm <channel name> [<message>]`,
 cs: `The CS command lets you subscribe to a channel. Syntax: cs [<channel name>]`,
 cu: `The CU command lets you unsubscribe from a channel. Syntax: cu <channel name>`,
 cw: `the CW command lets you see who is watching a channel that you are subscribed to. Syntax: cw <channel name>`,
 help: `The H command lets you see help topics. Syntax: h [<topic name>]`,
 pm: `The PM command sends a private message to another user. Syntax: pm <recipient name> [<message>]`,
 pw: `The PW command lets you change your password. Syntax: pw [<password>]`,
 quit: `The Q command instructs the server to terminate your connection. Syntax: q`,
 si: `The SI command lets you peruse information about the server. Syntax: si`,
 who: `The W command lets you see who is currently connected to the server. Syntax: w [<name>]`,
};

const adminHelpTopics = {
 ban: `The B command lets you ban or unban a user. Syntax: b <name> [<reason>]. If reason is not provided and the user is already banned, then the user will be unbanned.`,
 cw: `the CW command lets you see who is watching a channel. Syntax: cw <channel name>`,
 kick: `The K command lets you kick another user off the server. Syntax: k <name> [<reason>]`,
 pw: `The PW command lets you set a new password for a user. Syntax: pw <name> [<password>]`,
 // sr: `The SR command lets you restart the server. Syntax: sr [<reason>]`,
 ss: `The SS command lets you shutdown the server. Syntax: ss [<reason>]`,
 ua: `The UA command lets you add a new user. Syntax: ua <name> [<password>]`,
 ud: `The UD command lets you demote a user to a regular user. Syntax: ud <name>`,
 ui: `The UI command lets you view information about a user. Syntax: ui <name>`,
 ul: `The UL command displays a list of users. Syntax: ul [<partial matching names>]`,
 un: `The UN command lets you set a new name for a user. Syntax: un <name> <new name>`,
 up: `The UP command lets you promote a user to become an admin. Syntax: up <name>`,
 ur: `The UR command lets you remove a user. Syntax: ur <name>`,
};

const commands = {
 b: function({ client, argstr }) {
  if (!client.user.admin) return client.write(`This command requires admin privileges.\n`);
  const data = argstr && argstr.match(/^\s*([^\s]+)(\s+(.+))?$/);
  if (!data) return client.write(`Ban who?\n`);
  const connectedClient = this.findConnectedUser({ name: data[1] });
  const bandata = {
   by: client.user.name,
   time: Date.now(),
   reason: data[3],
  };
  if (connectedClient) {
   if (connectedClient === client) return client.write(`You can't ban yourself.\n`);
   connectedClient.user.banned = bandata;
   client.write(`You ban ${connectedClient.user.name} and they've been kicked off the server.\n`);
   connectedClient.write(`You have been banned by ${client.user.name}.\n`);
   connectedClient.write(`PCS: Disconnect\n`);
   this.sendMessage({ channel: 'admin', from: 'System', message: `${client.user.name} bans ${connectedClient.user.name} and kicked them off the server.${data[3] ? ` Reason: ${data[3]}` : ''}`, excludedClients: [client, connectedClient] });
   connectedClient.destroy();
  } else {
   const user = this.findUser({ name: data[1] });
   if (user) {
    if (user.banned && !data[3]) {
     client.write(`You unban ${user.name}.\n`);
     this.sendMessage({ channel: 'admin', from: 'System', message: `${client.user.name} unbans ${user.name}.` });
     delete user.banned;
    } else {
     user.banned = bandata;
     client.write(`You ban ${user.name}.\n`);
     this.sendMessage({ channel: 'admin', from: 'System', message: `${client.user.name} bans ${user.name}.${data[3] ? ` Reason: ${data[3]}` : ''}`, excludedClients: [client] });
    }
   }
   else return client.write(`Found nobody by that name.\n`);
  }
  this.updateConfigFile();
 },
 cm: function({ client, argstr }) {
  if (client.user.channels.length === 0) return client.write(`You are not subscribed to any channels.\n`);
  const data = argstr && argstr.match(/^\s*([^\s]+)(\s+(.+))?$/);
  if (!data) return client.write(`Send a message on which channel?\n`);
  const lcChannel = data[1].toLowerCase();
  for (let i=0; i<client.user.channels.length; i++) {
   if (client.user.channels[i].startsWith(lcChannel) && !this.systemChannels.includes(client.user.channels[i])) return this.sendMessage({ channel: client.user.channels[i], from: client, message: data[3] || `:makes some noise.` });
  }
  client.write(`You are not subscribed to that channel.\n`);
 },
 cs: function({ client, argstr }) {
  const lcChannel = argstr && argstr.trim().toLowerCase();
  if (!lcChannel) return client.write(client.user.channels.length === 0 ? `You are not subscribed to any channels.\n` : `You are subscribed to ${client.user.channels.length === 1 ? '1 channel' : `${client.user.channels.length} channels`}: ${client.user.channels.sort().join(', ')}.\n`);
  else if (!lcChannel.match(/^[a-z0-9]{1,50}$/)) return client.write(`Channel names can only contain letters and numbers, and must not exceed 50 characters.\n`);
  else if (!client.user.admin && this.adminChannels.includes(lcChannel)) return client.write(`You don't have sufficient privileges to subscribe to that channel.\n`);
  const i = client.user.channels.indexOf(lcChannel);
  if (i === -1) {
   client.user.channels.push(lcChannel);
   client.write(`You subscribe to the ${lcChannel} channel.\n`);
   this.sendMessage({ channel: lcChannel, from: 'System', message: `${client.user.name} is now subscribed to this channel.`, excludedClients: [client] });
   this.updateConfigFile();
  } else {
   client.write(`You are already subscribed to ${lcChannel}.\n`);
  }
 },
 cu: function({ client, argstr }) {
  const lcChannel = argstr && argstr.trim().toLowerCase();
  if (!lcChannel) return client.write(client.user.channels.length === 0 ? `You are not subscribed to any channels.\n` : `You are subscribed to ${client.user.channels.length === 1 ? '1 channel' : `${client.user.channels.length} channels`}: ${client.user.channels.sort().join(', ')}.\n`);
  for (let i=0; i<client.user.channels.length; i++) {
   const channel = client.user.channels[i];
   if (lcChannel === channel || (channel.startsWith(lcChannel) && !this.systemChannels.includes(channel))) {
    client.user.channels.splice(i, 1);
    client.write(`You unsubscribe from the ${channel} channel.\n`);
    this.sendMessage({ channel, from: 'System', message: `${client.user.name} unsubscribed from this channel.`, excludedClients: [client] });
    this.updateConfigFile();
    return;
   }
  }
  client.write(`Found no such channel that you can unsubscribe from.\n`);
 },
 cw: function({ client, argstr }) {
  const lcChannel = argstr && argstr.trim().toLowerCase();
  if (!lcChannel) return client.write(`Which channel do you wish to see who's currently watching?\n`);
  if (client.user.admin) {
   const users = [];
   for (let xClient of this.authorizedClients) {
    if (xClient.user.channels.includes(lcChannel)) users.push(xClient.user.name);
   }
   if (users.length === 0) client.write(`Nobody is watching the ${lcChannel} channel.\n`);
   else client.write(`${users.length === 1 ? 'One user is' : `${users.length} users are`} watching the ${lcChannel} channel: ${users.sort().join(', ')}.\n`);
  } else {
   if (client.user.channels.length === 0) return client.write(`You are not subscribed to any channels.\n`);
   for (let i=0; i<client.user.channels.length; i++) {
    const channel = client.user.channels[i];
    if (channel.startsWith(lcChannel) && !this.systemChannels.includes(channel)) {
     const users = [];
     for (let xClient of this.authorizedClients) {
      if (xClient.user.channels.includes(channel)) users.push(xClient.user.name);
     }
     if (users.length === 0) return client.write(`Nobody is currently watching the ${channel} channel.\n`);
     else return client.write(`${users.length === 1 ? 'One user is' : `${users.length} users are`} watching the ${channel} channel: ${users.sort().join(', ')}.\n`);
    }
   }
   client.write(`You are not subscribed to that channel.\n`);
  }
 },
 h: function({ client, argstr }) {
  const data = argstr && argstr.trim().toLowerCase();
  if (!data) {
   client.write(`Help topics: ${Object.keys(helpTopics).sort().map(topic => topic.length > 2 ? topic : topic.toUpperCase()).join(', ')}.\n`);
   return client.user.admin && client.write(`Admin help topics: ${Object.keys(adminHelpTopics).sort().map(topic => topic.length > 2 ? topic : topic.toUpperCase()).join(', ')}.\n`);
  }
  if (client.user.admin) {
   for (let topic in adminHelpTopics) {
    if (topic.startsWith(data)) return client.write(`${adminHelpTopics[topic]}\n`);
   }
  }
  for (let topic in helpTopics) {
   if (topic.startsWith(data)) return client.write(`${helpTopics[topic]}\n`);
  }
  return client.write(`That help topic was not found.\n`);
 },
 k: function({ client, argstr }) {
  if (!client.user.admin) return client.write(`This command requires admin privileges.\n`);
  const data = argstr && argstr.match(/^\s*([^\s]+)(\s+(.+))?$/);
  if (!data) return client.write(`Kick who?\n`);
  const connectedClient = this.findConnectedUser({ name: data[1] });
  if (connectedClient) {
   if (connectedClient === client) return client.write(`You can't kick yourself. Please use the Q command instead if you wish to disconnect from the server.\n`);
   client.write(`You kick ${connectedClient.user.name} off the server.\n`);
   connectedClient.write(`You have been kicked off the server by ${client.user.name}.${data[3] ? ` Reason: ${data[3]}` : ''}\n`);
   connectedClient.write(`PCS: Disconnect\n`);
   this.sendMessage({ channel: 'admin', from: 'System', message: `${client.user.name} kicks ${connectedClient.user.name} off the server.${data[3] ? ` Reason: ${data[3]}` : ''}`, excludedClients: [client, connectedClient] });
   connectedClient.destroy();
  } else {
   const user = this.findUser({ name: data[1] });
   if (user) return client.write(`${user.name} is already offline.\n`);
   else return client.write(`Found nobody by that name.\n`);
  }
 },
 ping: function({ client, argstr }) {
  const identifier = argstr && argstr.trim();
  client.write(`Pong!${identifier ? ` ${identifier}` : ''}\n`);
 },
 pm: function({ client, argstr }) {
  const data = argstr && argstr.match(/^\s*([^\s]+)(\s+(.+))?$/);
  if (!data) return client.write(`Send a private message to who?\n`);
  const toClient = this.findConnectedUser({ name: data[1] });
  if (!toClient) {
   const toUser = this.findUser({ name: data[1] });
   if (toUser) return client.write(`${toUser.name} is not connected.\n`);
   else return client.write(`Found nobody by that name.\n`);
  }
  if (client === toClient) return client.write(`You can't PM yourself.\n`);
  else this.sendPrivateMessage({ from: client, to: toClient, message: data[3] || `:pokes ${toClient.user.name}.` });
 },
 pw: function({ client, argstr }) {
  if (client.user.admin) {
   const data = argstr && argstr.match(/^\s*([^\s]+)(\s+(.+))?$/);
   if (!data) return client.write(`Syntax: pw <name> [<password>]\n`);
   const user = this.findUser({ name: data[1], exactMatch: true });
   if (!user) return client.write(`Found no user that exactly matches that name.\n`);
   const password = data[3] ? data[3].trim() : '';
   user.password = crypto.createHash('sha256').update(password).digest('hex');
   if (user === client.user) client.write(`Your password is now updated.\n`);
   else {
    client.write(`New password set for ${user.name}.\n`);
    this.sendMessage({ channel: 'admin', from: 'System', message: `${client.user.name} changed the password for ${user.name}.`, excludedClients: [client] });
   }
  } else {
   const password = argstr ? argstr.trim() : '';
   client.user.password = crypto.createHash('sha256').update(password).digest('hex');
   client.write(`New password set.\n`);
  }
  this.updateConfigFile();
 },
 q: function({ client }) {
  client.write(`PCS: Disconnect\n`);
  client.destroy();
 },
 si: function({ client }) {
  client.write(`${this.metadata.name} version ${this.metadata.version}.\n`);
  client.write(`The server has been up since ${this.startdate.toString()}.\n`);
 },
 ss: function({ client, argstr }) {
  if (!client.user.admin) return client.write(`This command requires admin privileges.\n`);
  this.shutdown({ client, reason: argstr && argstr.trim() });
 },
 ua: function({ client, argstr }) {
  if (!client.user.admin) return client.write(`This command requires admin privileges.\n`);
  const data = argstr && argstr.match(/^\s*([^\s]+)(\s+(.+))?$/);
  if (!data) return client.write(`Syntax: ua <name> [<password>]\n`);
  const lcName = data[1].toLowerCase();
  for (let username in this.users) {
   if ((this.users[username].name && this.users[username].name.toLowerCase() === lcName) || username.toLowerCase() === lcName) {
    return client.write(`There is already a user with that name.\n`);
   }
  }
  this.users[data[1]] = { password: crypto.createHash('sha256').update(data[3] ? data[3].trim() : '').digest('hex') };
  client.write(`User added: ${data[1]}\n`);
  this.sendMessage({ channel: 'admin', from: 'System', message: `${client.user.name} added a new user: ${data[1]}`, excludedClients: [client] });
  this.updateConfigFile();
 },
 ud: function({ client, argstr }) {
  if (!client.user.admin) return client.write(`This command requires admin privileges.\n`);
  const data = argstr && argstr.trim();
  if (!data) return client.write(`Syntax: ud <name>\n`);
  const user = this.findUser({ name: data, exactMatch: true });
  if (!user) return client.write(`Found no user that exactly matches that name.\n`);
  else if (!user.admin) return client.write(`${user.name} has no admin privileges.\n`);
  else if (user === client.user) return client.write(`You can't demote yourself.\n`);
  delete user.admin;
  this.adminChannels.forEach(channel => {
   const i = user.channels.indexOf(channel);
   if (i !== -1) user.channels.splice(i, 1);
  });
  client.write(`${user.name} is no longer an admin.\n`);
  this.sendMessage({ channel: 'admin', from: 'System', message: `${client.user.name} demoted ${user.name}.`, excludedClients: [client] });
  this.updateConfigFile();
 },
 ui: function({ client, argstr }) {
  if (!client.user.admin) return client.write(`This command requires admin privileges.\n`);
  const data = argstr && argstr.trim();
  if (!data) return client.write(`Syntax: ui <name>\n`);
  const user = this.findUser({ name: data });
  if (!user) return client.write(`User not found.\n`);
  const info = [];
  info.push(user.name);
  for (let xClient of this.authorizedClients) {
   if (xClient.user === user) {
    info.push(`  Connected from: ${xClient.address().address}`);
    break;
   }
  }
  info.push(`  Admin: ${user.admin ? 'Yes' : 'No'}`);
  if (user.banned) {
   info.push(`  Banned: Yes`);
   if (user.banned.by) info.push(`  Banned by: ${user.banned.by}`);
   if (user.banned.time) info.push(`  Banned since: ${(new Date(user.banned.time)).toString()}`);
   if (user.banned.reason) info.push(`  Ban reason: ${user.banned.reason}`);
  }
  else info.push(`  Banned: No`);
  client.write(`${info.join("\n")}\n`);
 },
 ul: function({ client, argstr }) {
  if (!client.user.admin) return client.write(`This command requires admin privileges.\n`);
  const data = argstr && argstr.trim().toLowerCase();
  const users = data ? Object.keys(this.users).filter(username => username.toLowerCase().indexOf(data) !== -1) : Object.keys(this.users);
  if (users.length === 0) return client.write(`Found no users${data ? ' that match' : ''}.\n`);
  client.write(`Found ${users.length === 1 ? '1 user' : `${users.length} users`}: ${users.sort().join(', ')}.\n`);
 },
 un: function({ client, argstr }) {
  if (!client.user.admin) return client.write(`This command requires admin privileges.\n`);
  const data = argstr && argstr.match(/^\s*([^\s]+)\s+([^\s]+)\s*$/);
  if (!data) return client.write(`Syntax: un <name> <new name>\n`);
  const user = this.findUser({ name: data[1], exactMatch: true });
  if (!user) return client.write(`Found no user that exactly matches ${data[1]}.\n`);
  if (user.name === data[2]) return client.write(`No change.\n`);
  const existingUser = this.findUser({ name: data[2], exactMatch: true });
  if (existingUser && existingUser !== user) return client.write(`There is already a user named ${data[2]}.\n`);
  for (let username in this.users) {
   if (this.users[username] === user) {
    const oldName = this.users[username].name || username;
    delete this.users[username];
    user.name = data[2];
    this.users[user.name] = user;
    client.write(`${oldName} has been renamed to ${user.name}.\n`);
    this.sendMessage({ channel: 'admin', from: 'System', message: `${client.user.name} renamed user ${oldName} to ${user.name}.`, excludedClients: [client] });
    this.updateConfigFile();
    return;
   }
  }
  client.write(`Failed to locate user object in users.\n`);
 },
 up: function({ client, argstr }) {
  if (!client.user.admin) return client.write(`This command requires admin privileges.\n`);
  const data = argstr && argstr.trim();
  if (!data) return client.write(`Syntax: up <name>\n`);
  const user = this.findUser({ name: data, exactMatch: true });
  if (!user) return client.write(`Found no user that exactly matches that name.\n`);
  else if (user.admin) return client.write(`${user.name} is already an admin.\n`);
  user.admin = 1;
  user.channels.push('admin');
  client.write(`${user.name} is now an admin.\n`);
  this.sendMessage({ channel: 'admin', from: 'System', message: `${client.user.name} promoted ${user.name}.`, excludedClients: [client] });
  this.updateConfigFile();
 },
 ur: function({ client, argstr }) {
  if (!client.user.admin) return client.write(`This command requires admin privileges.\n`);
  const data = argstr && argstr.trim().toLowerCase();
  if (!data) return client.write(`Syntax: ur <name>\n`);
  for (let username in this.users) {
   if ((this.users[username].name || username).toLowerCase() === data) {
    if (this.users[username] === client.user) return client.write(`You can't remove yourself.\n`);
    const name = (this.users[username].name || username);
    delete this.users[username];
    client.write(`User removed: ${name}\n`);
    this.sendMessage({ channel: 'admin', from: 'System', message: `${client.user.name} removed user: ${name}`, excludedClients: [client] });
    this.updateConfigFile();
    return;
   }
  }
  return client.write(`Found no user that exactly matches that name.\n`);
 },
 w: function({ client, argstr }) {
  const data = argstr && argstr.trim();
  if (!data) return client.write(`${this.authorizedClients.size === 1 ? 'One user is' : `${this.authorizedClients.size} users are`} currently connected: ${Array.from(this.authorizedClients).map(xClient => xClient.user.name).sort().join(', ')}.\n`);
  const connectedClient = this.findConnectedUser({ name: data });
  if (connectedClient) return client.write(`${connectedClient.user.name} is connected.\n`);
  const user = this.findUser({ name: data });
  if (user) return client.write(`${user.name} is offline.\n`);
  else return client.write(`Found nobody by that name.\n`);
 },
};

const commandAliases = {
 ban: 'b',
 help: 'h',
 kick: 'k',
 quit: 'q',
 who: 'w',
};
for (let alias in commandAliases) {
 if (commands[alias] === undefined) commands[alias] = commands[commandAliases[alias]];
}

module.exports = commands;
