/**
 * Migration: Streaming Rewards (BTF token rewards for artists)
 *
 * Creates:
 * - streaming_reward_config  → singleton admin-tunable economics (rate, pool cap, thresholds, kill switch)
 * - streaming_reward_epochs  → weekly reward periods (draft → calculated → approved → paid)
 * - streaming_reward_entries → per-artist reward lines per epoch (streams + action BTF, claim status)
 * - reward_action_rules      → admin-editable catalog of rewarded platform actions
 * - artist_reward_events     → audit of computed action rewards per epoch
 * - artist_wallet.reward_wallet_address → artist's Polygon wallet for BTF claims
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS streaming_reward_config (
        id                     INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        active                 BOOLEAN NOT NULL DEFAULT true,
        dry_run                BOOLEAN NOT NULL DEFAULT true,
        auto_calculate         BOOLEAN NOT NULL DEFAULT true,
        btf_per_stream         NUMERIC(12,4) NOT NULL DEFAULT 0.5,
        bonus_per_listener     NUMERIC(12,4) NOT NULL DEFAULT 1,
        pool_btf_per_epoch     NUMERIC(18,2) NOT NULL DEFAULT 100000,
        min_streams            INTEGER NOT NULL DEFAULT 50,
        min_claim_btf          NUMERIC(18,2) NOT NULL DEFAULT 100,
        max_streams_per_listener_day INTEGER NOT NULL DEFAULT 10,
        anon_weight            NUMERIC(4,2) NOT NULL DEFAULT 0.25,
        updated_at             TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      INSERT INTO streaming_reward_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS streaming_reward_epochs (
        id                  SERIAL PRIMARY KEY,
        period_key          TEXT NOT NULL UNIQUE,
        starts_at           TIMESTAMP NOT NULL,
        ends_at             TIMESTAMP NOT NULL,
        status              TEXT NOT NULL DEFAULT 'calculated'
                            CHECK (status IN ('calculated','approved','paid','void')),
        total_valid_streams NUMERIC(18,2) NOT NULL DEFAULT 0,
        total_btf           NUMERIC(18,2) NOT NULL DEFAULT 0,
        prorate_factor      NUMERIC(10,6) NOT NULL DEFAULT 1,
        artist_count        INTEGER NOT NULL DEFAULT 0,
        calculated_at       TIMESTAMP,
        approved_at         TIMESTAMP,
        approved_by         TEXT,
        created_at          TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS streaming_reward_entries (
        id               SERIAL PRIMARY KEY,
        epoch_id         INTEGER NOT NULL REFERENCES streaming_reward_epochs(id) ON DELETE CASCADE,
        artist_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        valid_streams    NUMERIC(18,2) NOT NULL DEFAULT 0,
        unique_listeners INTEGER NOT NULL DEFAULT 0,
        base_btf         NUMERIC(18,2) NOT NULL DEFAULT 0,
        bonus_btf        NUMERIC(18,2) NOT NULL DEFAULT 0,
        action_btf       NUMERIC(18,2) NOT NULL DEFAULT 0,
        total_btf        NUMERIC(18,2) NOT NULL DEFAULT 0,
        status           TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','approved','claiming','paid','failed')),
        wallet_address   TEXT,
        tx_hash          TEXT,
        paid_at          TIMESTAMP,
        error            TEXT,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (epoch_id, artist_id)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reward_entries_artist ON streaming_reward_entries(artist_id);
      CREATE INDEX IF NOT EXISTS idx_reward_entries_status ON streaming_reward_entries(status);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reward_action_rules (
        action_key    TEXT PRIMARY KEY,
        label         TEXT NOT NULL,
        btf_amount    NUMERIC(18,2) NOT NULL,
        max_per_epoch INTEGER NOT NULL DEFAULT 1,
        active        BOOLEAN NOT NULL DEFAULT true,
        updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      INSERT INTO reward_action_rules (action_key, label, btf_amount, max_per_epoch) VALUES
        ('publish_song',    'Publicar una canción nueva',            100, 5),
        ('merch_sale',      'Primera venta de merch de la semana',   200, 1),
        ('credit_purchase', 'Comprar un paquete de créditos',        250, 4),
        ('follower_growth', 'Cada 10 seguidores nuevos',              50, 4)
      ON CONFLICT (action_key) DO NOTHING
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS artist_reward_events (
        id          SERIAL PRIMARY KEY,
        epoch_id    INTEGER NOT NULL REFERENCES streaming_reward_epochs(id) ON DELETE CASCADE,
        artist_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action_key  TEXT NOT NULL REFERENCES reward_action_rules(action_key),
        qty         INTEGER NOT NULL DEFAULT 1,
        btf_amount  NUMERIC(18,2) NOT NULL,
        meta        JSONB,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reward_events_epoch ON artist_reward_events(epoch_id);
      CREATE INDEX IF NOT EXISTS idx_reward_events_artist ON artist_reward_events(artist_id);
    `);

    await client.query(`
      ALTER TABLE artist_wallet
        ADD COLUMN IF NOT EXISTS reward_wallet_address TEXT
    `);

    await client.query('COMMIT');
    console.log('✅ Streaming rewards migration applied (config, epochs, entries, action rules, events, wallet column).');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
