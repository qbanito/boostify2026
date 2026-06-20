const { Pool } = require('@neondatabase/serverless');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE artist_business_plans
        ADD COLUMN IF NOT EXISTS ai_generated_plan jsonb,
        ADD COLUMN IF NOT EXISTS generation_status text NOT NULL DEFAULT 'pending',
        ADD COLUMN IF NOT EXISTS generation_error text,
        ADD COLUMN IF NOT EXISTS generated_at timestamp
    `);
    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
