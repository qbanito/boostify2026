process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT id, generated_by FROM users WHERE id = 1405', (err, r) => {
  console.log(err?.message || JSON.stringify(r?.rows));
  pool.end();
});
