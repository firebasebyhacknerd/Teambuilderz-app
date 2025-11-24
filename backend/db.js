const { Pool } = require('pg');
const config = require('./lib/config');

const dbConfig = {
  user: config.get('DB_USER'),
  host: config.get('DB_HOST', 'localhost'),
  database: config.get('DB_NAME'),
  password: config.get('DB_PASSWORD'),
  port: config.getInt('DB_PORT', 5432),
};

const pool = new Pool(dbConfig);

module.exports = {
  pool,
  dbConfig,
};
