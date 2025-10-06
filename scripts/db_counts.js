require('../backend/node_modules/dotenv').config({ path: '../backend/.env' });
const { Pool } = require('../backend/node_modules/pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
});

(async () => {
  try {
    const tables = ['users', 'candidates', 'applications', 'alerts', 'daily_activity'];
    const out = {};
    for (const table of tables) {
      const res = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      out[table] = Number(res.rows[0].count);
    }
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
})();
