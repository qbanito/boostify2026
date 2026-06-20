/**
 * Migration: Add missing columns to email_sends table
 * Fixes: investor-sequence-sender.cjs and artist-sequence-sender.cjs
 */

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

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔧 Migrating email_sends table...\n');

    const migrations = [
      {
        name: 'domain',
        sql: `ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS domain TEXT;`
      },
      {
        name: 'template',
        sql: `ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS template TEXT;`
      },
      {
        name: 'campaign',
        sql: `ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS campaign TEXT;`
      },
      {
        name: 'from_domain',
        sql: `ALTER TABLE email_sends ADD COLUMN IF NOT EXISTS from_domain TEXT;`
      }
    ];

    for (const m of migrations) {
      try {
        await client.query(m.sql);
        console.log(`  ✅ Column added: ${m.name}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`  ⚠️  Column already exists: ${m.name}`);
        } else {
          console.log(`  ❌ Error adding ${m.name}: ${err.message}`);
        }
      }
    }

    // Verify current columns
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'email_sends'
      ORDER BY ordinal_position;
    `);

    console.log('\n📋 Current email_sends columns:');
    rows.forEach(r => console.log(`   • ${r.column_name} (${r.data_type})`));
    console.log('\n✅ Migration complete.');

  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
