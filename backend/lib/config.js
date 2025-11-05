const fs = require('fs');
const path = require('path');

const secretFile = process.env.SECRETS_FILE
  ? path.resolve(process.cwd(), process.env.SECRETS_FILE)
  : null;

let secrets = {};
if (secretFile) {
  try {
    const payload = fs.readFileSync(secretFile, 'utf-8');
    secrets = JSON.parse(payload);
    // eslint-disable-next-line no-console
    console.info(`[Config] Loaded secrets from ${secretFile}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[Config] Failed to read secrets file ${secretFile}:`, error.message);
  }
}

const get = (key, fallback = undefined) => {
  if (Object.prototype.hasOwnProperty.call(secrets, key)) {
    return secrets[key];
  }
  if (Object.prototype.hasOwnProperty.call(process.env, key)) {
    return process.env[key];
  }
  return fallback;
};

const getBool = (key, fallback = false) => {
  const value = get(key);
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }
  return fallback;
};

const getInt = (key, fallback = undefined) => {
  const value = Number.parseInt(get(key), 10);
  return Number.isNaN(value) ? fallback : value;
};

module.exports = {
  get,
  getBool,
  getInt,
};
