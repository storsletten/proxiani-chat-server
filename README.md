# Proxiani Chat Server
Proxiani Chat Server is a basic chat server that supports arbitrary channels and private messaging. It is a supplement for [Proxiani](https://github.com/tms88/proxiani).

## Installation
Download and install the latest recommended version of Node.js from [nodejs.org](https://nodejs.org/).
Tested with Node 14.

## Usage
If you would like to run Proxiani Chat Server with a console window (mostly just for developers), then use:
```
$ npm start
```

If you prefer to run Proxiani Chat Server without a console window (recommended for most users, Windows only), then launch the file called Start.vbs that is located inside the Proxiani Chat Server folder.

Next step is to make sure clients are able to connect to the server. You might need to enable port forwarding in your router if you are hosting this server at home. Default port is 1235, and it uses the TCP protocol.

You can connect using a mud/telnet client, or by using the PC command in Proxiani.
Default username is admin. No password.
Once you're logged in the first time, it is recommended that you set a new password for the admin user. You can use the PW command for that.
Configuration is stored in config.json (by default) in the Proxiani Chat Server folder.
