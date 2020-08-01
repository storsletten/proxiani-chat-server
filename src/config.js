const fs = require('fs');

const defaultConfig = {
 path: `./config.json`,
 listen: {
  port: 1235,
 },
 users: {
  admin: { admin: 1, },
 },
};

if (!fs.existsSync(defaultConfig.path)) fs.writeFileSync(defaultConfig.path, JSON.stringify(defaultConfig, null, 1));
let config = JSON.parse(fs.readFileSync(defaultConfig.path));
if (config.path && config.path !== defaultConfig.path) config = JSON.parse(fs.readFileSync(config.path));
if (typeof config.users !== 'object' || Array.isArray(config.users)) throw new Error(`config.users must be an object.`);

module.exports = config;
