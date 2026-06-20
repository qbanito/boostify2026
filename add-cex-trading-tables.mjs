/**
 * Migration: Add CEX Trading Tables
 * Creates: cex_exchange_keys, funding_arb_positions, funding_rate_history, cex_arb_opportunities
 *
 * Run: node add-cex-trading-tables.mjs
 */
import pg from 'pg';
import { config } from 'dotenv';
config();

const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  await client.connect();
  console.log('Connected to database. Creating CEX trading tables...\n');

  await client.query(`
    CREATE TABLE IF NOT EXISTS cex_exchange_keys (
      id SERIAL PRIMARY KEY,
      artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      exchange_id TEXT NOT NULL,
      label TEXT,
      api_key_enc TEXT NOT NULL,
      api_secret_enc TEXT NOT NULL,
      passphrase_enc TEXT,
      is_testnet BOOLEAN NOT NULL DEFAULT TRUE,
      permissions JSONB DEFAULT '[]',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      last_verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_cex_keys_artist ON cex_exchange_keys(artist_id);
    CREATE INDEX IF NOT EXISTS idx_cex_keys_exchange ON cex_exchange_keys(exchange_id);
  `);
  console.log('✅ cex_exchange_keys created');

  await client.query(`
    CREATE TABLE IF NOT EXISTS funding_arb_positions (
      id SERIAL PRIMARY KEY,
      artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      exchange_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      spot_symbol TEXT NOT NULL,
      spot_size_usd NUMERIC(18,6) NOT NULL,
      perp_size_usd NUMERIC(18,6) NOT NULL,
      entry_funding_rate NUMERIC(18,10) NOT NULL,
      current_funding_rate NUMERIC(18,10) NOT NULL,
      accumulated_funding_usd NUMERIC(18,6) DEFAULT 0,
      estimated_apr NUMERIC(10,4),
      net_pnl_usd NUMERIC(18,6) DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','error')),
      close_reason TEXT,
      is_testnet BOOLEAN NOT NULL DEFAULT TRUE,
      spot_order_id TEXT,
      perp_order_id TEXT,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      closed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_farb_artist ON funding_arb_positions(artist_id);
    CREATE INDEX IF NOT EXISTS idx_farb_status ON funding_arb_positions(status);
    CREATE INDEX IF NOT EXISTS idx_farb_exchange ON funding_arb_positions(exchange_id);
  `);
  console.log('✅ funding_arb_positions created');

  await client.query(`
    CREATE TABLE IF NOT EXISTS funding_rate_history (
      id SERIAL PRIMARY KEY,
      exchange_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      rate NUMERIC(18,10) NOT NULL,
      annualized_rate NUMERIC(10,6) NOT NULL,
      interval_hours INTEGER DEFAULT 8,
      next_funding_at TIMESTAMPTZ,
      scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_frate_exchange_symbol ON funding_rate_history(exchange_id, symbol);
    CREATE INDEX IF NOT EXISTS idx_frate_scanned ON funding_rate_history(scanned_at);
  `);
  console.log('✅ funding_rate_history created');

  await client.query(`
    CREATE TABLE IF NOT EXISTS cex_arb_opportunities (
      id SERIAL PRIMARY KEY,
      artist_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('funding','basis','dex_cex')),
      exchange_a TEXT NOT NULL,
      exchange_b TEXT,
      symbol TEXT NOT NULL,
      spread_pct NUMERIC(10,6),
      net_spread_after_fees NUMERIC(10,6),
      estimated_apr NUMERIC(10,4),
      required_capital_usd NUMERIC(18,2),
      status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected','executing','completed','expired')),
      detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_arb_opp_status ON cex_arb_opportunities(status);
    CREATE INDEX IF NOT EXISTS idx_arb_opp_type ON cex_arb_opportunities(type);
    CREATE INDEX IF NOT EXISTS idx_arb_opp_detected ON cex_arb_opportunities(detected_at);
  `);
  console.log('✅ cex_arb_opportunities created\n');

  console.log('All CEX trading tables created successfully.');
  await client.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  client.end();
  process.exit(1);
});
