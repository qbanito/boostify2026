/**
 * MIGRATION: Add day trading layer (Market Hunter, 5th agent)
 *
 * 1) Extends the `defi_agent_type` PG enum with `market_hunter`
 * 2) Adds `day_trading_enabled` BOOLEAN column to `artist_economic_profile`
 *
 * Idempotent — safe to re-run.
 *
 * USAGE:
 *   node apply-day-trading-migration.mjs
 */

import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL is not set');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    console.log('▶ Extending defi_agent_type enum with market_hunter...');
    // ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so
    // execute it as a standalone statement.
    await client.query(`
      ALTER TYPE defi_agent_type ADD VALUE IF NOT EXISTS 'market_hunter';
    `);
    console.log('✅ Enum extended');

    console.log('▶ Adding day_trading_enabled column to artist_economic_profile...');
    await client.query(`
      ALTER TABLE artist_economic_profile
      ADD COLUMN IF NOT EXISTS day_trading_enabled BOOLEAN NOT NULL DEFAULT false;
    `);
    console.log('✅ Column added');

    // Sanity check
    const { rows } = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'artist_economic_profile'
        AND column_name = 'day_trading_enabled';
    `);
    console.log('🔍 Verification:', rows);

    console.log('\n🎉 Day trading migration complete.');
    console.log('   Default: dayTradingEnabled = false for all existing artists.');
    console.log('   Admins can opt-in per artist via the dashboard switch.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
