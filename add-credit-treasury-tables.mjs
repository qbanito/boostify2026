/**
 * Migration: provider treasury + subscription credit grants
 *  - treasury_accounts: per-provider funding pool (reserved vs spent vs external balance)
 *  - treasury_transactions: ledger of reserves/spends/topups/adjustments
 *  - subscription_credit_grants: idempotent monthly credit allotment tracking
 * Run: node add-credit-treasury-tables.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Creating treasury + grant tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS provider_treasury_accounts (
        id                          SERIAL PRIMARY KEY,
        provider                    TEXT NOT NULL UNIQUE,
        reserved_usd                NUMERIC(14,4) NOT NULL DEFAULT 0,
        spent_usd                   NUMERIC(14,4) NOT NULL DEFAULT 0,
        external_balance_usd        NUMERIC(14,4) NOT NULL DEFAULT 0,
        low_balance_threshold_usd   NUMERIC(14,4) NOT NULL DEFAULT 25,
        auto_recharge_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
        auto_recharge_amount_usd    NUMERIC(14,4) NOT NULL DEFAULT 0,
        status                      TEXT NOT NULL DEFAULT 'healthy',
        last_alert_at               TIMESTAMP,
        updated_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at                  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_provider_treasury_provider ON provider_treasury_accounts (provider);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS provider_treasury_transactions (
        id                SERIAL PRIMARY KEY,
        provider          TEXT NOT NULL,
        type              TEXT NOT NULL,
        amount_usd        NUMERIC(14,6) NOT NULL,
        balance_after_usd NUMERIC(14,4),
        source            TEXT,
        description       TEXT,
        ref_id            TEXT,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_provider_treasury_tx_provider ON provider_treasury_transactions (provider);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_provider_treasury_tx_type ON provider_treasury_transactions (type);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_provider_treasury_tx_created ON provider_treasury_transactions (created_at);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_credit_grants (
        id              SERIAL PRIMARY KEY,
        user_email      TEXT NOT NULL,
        plan            TEXT NOT NULL,
        period_key      TEXT NOT NULL,
        credits_granted INTEGER NOT NULL,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_grant_unique
        ON subscription_credit_grants (user_email, period_key);
    `);

    console.log('✅ provider_treasury_accounts, provider_treasury_transactions, subscription_credit_grants created.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
