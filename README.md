# Proxiani Chat Server
Proxiani Chat Server is a basic chat server that supports arbitrary channels and private messaging. It is a supplement for [Proxiani](https://github.com/tms88/proxiani).

## Installation
Download and install the latest recommended version of Node.js from [nodejs.org](https://nodejs.org/).

Tested with Node 14, but version 12 might also work. Version 10 will most certainly not work with TLS, but maybe without TLS. Who knows.

## Usage
If you would like to run Proxiani Chat Server with a console window (mostly just for developers), then use:
```
$ npm start
```

If you prefer to run Proxiani Chat Server without a console window (recommended for most users, Windows only), then launch the file called Start.vbs that is located inside the Proxiani Chat Server folder.

Next step is to make sure clients are able to connect to the server. You might need to enable port forwarding in your router if you are hosting this server at home. Default port is 1235, and it uses the TCP protocol.

You can connect using a mud/telnet client, or by using the PC command in Proxiani like this:
```
pc MyUsername:MyPassword@host:port
```

Default username is admin. No password.

Once you're logged in the first time, it is recommended that you set a new password for the admin user. You can use the PW command for that.

Configuration is stored in config.json in the Proxiani Chat Server folder. Keep in mind that if you want to edit config.json directly, the chat server needs to be taken offline first. Otherwise the server might overwrite any changes you make.

## TLS
By default, the chat server transmits messages across the network as plain text. To enable encryption for all transmitted data between the chat server and the clients, you'll need to generate an X.509 certificate for the chat server.

There are many ways of generating such a certificate, and self-signed certificates are also supported by Proxiani.

OpenSSL is a good option if you're ok with self-signed certificates. OpenVPN's [Easy-RSA](https://github.com/OpenVPN/easy-rsa) package will also work just fine.

There are also plenty of trusted SSL / TLS certificate providers that can generate certificates for you, but these will require a proper hostname and a verification process. Let's Encrypt, Symantec, GeoTrust, Comodo, GoDaddy, just to mention a few.

Once you have a certificate and a corresponding private key, you put them into the Proxiani Chat Server folder and name the files server.crt and server.key, respectively.

Alternatively you can edit config.json with different paths to those files. Remember that the chat server must be offline when you edit config.json, or the server may overwrite any changes you make.

You will also need to set the tls flag in config.json to true.

Once that's done, you can start the Proxiani Chat Server, and with any luck it should be up and running.

From Proxiani itself, the command to connect to a TLS-enabled chat server is the same except you put tls:// before the username. For example:
```
pc tls://MyUsername:MyPassword@host:port
```
