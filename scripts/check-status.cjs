const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.secrets') }); // overrides .env // overrides .env // overrides .env // overrides .env

const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const result = await pool.query(`
    SELECT conname, pg_get_constraintdef(oid) as definition 
    FROM pg_constraint 
    WHERE conname = 'lead_status_status_check'
  `);
  console.log('Constraint:', result.rows);
  
  const statuses = await pool.query(`SELECT DISTINCT status FROM lead_status LIMIT 20`);
  console.log('Current statuses:', statuses.rows);
  
  await pool.end();
}

check();
