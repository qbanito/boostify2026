/**
 * Artist Career Suite — DB migration
 * Creates all `artist_suite_*` tables idempotently.
 *
 * Run: node create-artist-suite-tables.mjs
 */
import pg from 'pg';
import { config } from 'dotenv';
config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS artist_suite_subscriptions (
    id SERIAL PRIMARY KEY,
    artist_id TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL DEFAULT 'elite',
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    decided_at TIMESTAMP,
    decided_by TEXT,
    decision_note TEXT,
    activated_at TIMESTAMP,
    expires_at TIMESTAMP,
    enable_personal_agents BOOLEAN NOT NULL DEFAULT TRUE,
    enable_corporate_access BOOLEAN NOT NULL DEFAULT TRUE,
    daily_budget_usd NUMERIC(10,2) NOT NULL DEFAULT 2.00,
    monthly_message_cap INTEGER NOT NULL DEFAULT 2000,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_artist_suite_sub_status ON artist_suite_subscriptions(status)`,
  `CREATE INDEX IF NOT EXISTS idx_artist_suite_sub_artist ON artist_suite_subscriptions(artist_id)`,

  `CREATE TABLE IF NOT EXISTS artist_suite_agents (
    id SERIAL PRIMARY KEY,
    artist_id TEXT NOT NULL,
    agent_key VARCHAR(64) NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    persona TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    dry_run BOOLEAN NOT NULL DEFAULT TRUE,
    autonomy INTEGER NOT NULL DEFAULT 2,
    tools JSONB NOT NULL DEFAULT '[]'::jsonb,
    budget_usd_daily NUMERIC(10,2) DEFAULT 0.50,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_artist_suite_agents_artist ON artist_suite_agents(artist_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uniq_artist_suite_agent ON artist_suite_agents(artist_id, agent_key)`,

  `CREATE TABLE IF NOT EXISTS artist_suite_threads (
    id SERIAL PRIMARY KEY,
    artist_id TEXT NOT NULL,
    session_type TEXT NOT NULL DEFAULT 'personal',
    agent_key VARCHAR(64) NOT NULL,
    parent_id INTEGER,
    topic TEXT,
    triggered_by TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_artist_suite_threads_artist ON artist_suite_threads(artist_id)`,
  `CREATE INDEX IF NOT EXISTS idx_artist_suite_threads_status ON artist_suite_threads(status)`,

  `CREATE TABLE IF NOT EXISTS artist_suite_messages (
    id SERIAL PRIMARY KEY,
    thread_id INTEGER NOT NULL REFERENCES artist_suite_threads(id) ON DELETE CASCADE,
    artist_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    tool_name TEXT,
    tool_args JSONB,
    tool_result JSONB,
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost_usd NUMERIC(10,6) DEFAULT 0,
    model TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_artist_suite_messages_thread ON artist_suite_messages(thread_id)`,
  `CREATE INDEX IF NOT EXISTS idx_artist_suite_messages_artist ON artist_suite_messages(artist_id)`,

  `CREATE TABLE IF NOT EXISTS artist_suite_decisions (
    id SERIAL PRIMARY KEY,
    artist_id TEXT NOT NULL,
    agent_key VARCHAR(64) NOT NULL,
    thread_id INTEGER REFERENCES artist_suite_threads(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target JSONB,
    rationale TEXT,
    risk_level INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by TEXT,
    execution_result JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    executed_at TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_artist_suite_decisions_artist ON artist_suite_decisions(artist_id)`,
  `CREATE INDEX IF NOT EXISTS idx_artist_suite_decisions_status ON artist_suite_decisions(status)`,

  `CREATE TABLE IF NOT EXISTS artist_suite_goals (
    id SERIAL PRIMARY KEY,
    artist_id TEXT NOT NULL,
    owner_agent VARCHAR(64) NOT NULL,
    parent_id INTEGER,
    title TEXT NOT NULL,
    metric TEXT NOT NULL,
    target_value NUMERIC(18,4) NOT NULL,
    current_value NUMERIC(18,4),
    baseline NUMERIC(18,4),
    weight REAL DEFAULT 1.0,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_artist_suite_goals_artist ON artist_suite_goals(artist_id)`,
  `CREATE INDEX IF NOT EXISTS idx_artist_suite_goals_status ON artist_suite_goals(status)`,

  `CREATE TABLE IF NOT EXISTS artist_suite_memory (
    id SERIAL PRIMARY KEY,
    artist_id TEXT NOT NULL,
    agent_key VARCHAR(64) NOT NULL,
    kind TEXT NOT NULL,
    content TEXT NOT NULL,
    weight REAL DEFAULT 1.0,
    tags TEXT[],
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_artist_suite_memory_artist_agent ON artist_suite_memory(artist_id, agent_key)`,

  `CREATE TABLE IF NOT EXISTS artist_suite_settings (
    id SERIAL PRIMARY KEY,
    artist_id TEXT NOT NULL UNIQUE,
    kill_switch BOOLEAN NOT NULL DEFAULT FALSE,
    dry_run_global BOOLEAN NOT NULL DEFAULT TRUE,
    preferred_model TEXT DEFAULT 'gpt-4o-mini',
    notes TEXT,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
];

async function main() {
  await client.connect();
  console.log('🔌 Connected to Neon DB');

  for (const stmt of STATEMENTS) {
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 90);
    try {
      await client.query(stmt);
      console.log('✓', preview);
    } catch (err) {
      console.error('✗', preview);
      console.error(err.message);
      throw err;
    }
  }

  // Verify
  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'artist_suite_%'
    ORDER BY table_name
  `);
  console.log('\n✅ artist_suite_* tables present:');
  rows.forEach((r) => console.log('   •', r.table_name));

  await client.end();
  console.log('\n🎉 Artist Career Suite schema ready.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
