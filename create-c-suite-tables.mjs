import pg from 'pg';
import { config } from 'dotenv';
config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SQL = `
CREATE TABLE IF NOT EXISTS c_suite_agents (
  id VARCHAR(64) PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  autonomy INTEGER NOT NULL DEFAULT 3,
  active BOOLEAN NOT NULL DEFAULT false,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  persona TEXT NOT NULL,
  tools JSONB NOT NULL DEFAULT '[]'::jsonb,
  escalates_to VARCHAR(64),
  budget_usd_daily NUMERIC(10,2) DEFAULT 5.00,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS c_suite_threads (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL,
  parent_id INTEGER,
  topic TEXT,
  triggered_by TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_csuite_threads_agent ON c_suite_threads(agent_id);
CREATE INDEX IF NOT EXISTS idx_csuite_threads_status ON c_suite_threads(status);

CREATE TABLE IF NOT EXISTS c_suite_messages (
  id SERIAL PRIMARY KEY,
  thread_id INTEGER NOT NULL REFERENCES c_suite_threads(id) ON DELETE CASCADE,
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
);
CREATE INDEX IF NOT EXISTS idx_csuite_msg_thread ON c_suite_messages(thread_id);

CREATE TABLE IF NOT EXISTS c_suite_decisions (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL,
  thread_id INTEGER REFERENCES c_suite_threads(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target JSONB,
  rationale TEXT,
  risk_level INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  execution_result JSONB,
  signature_sha256 TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_csuite_dec_agent ON c_suite_decisions(agent_id);
CREATE INDEX IF NOT EXISTS idx_csuite_dec_status ON c_suite_decisions(status);

CREATE TABLE IF NOT EXISTS c_suite_memory (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  weight REAL DEFAULT 1.0,
  tags TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_csuite_mem_agent ON c_suite_memory(agent_id);

CREATE TABLE IF NOT EXISTS c_suite_schedule (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL,
  cron TEXT NOT NULL,
  task TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS c_suite_approvals (
  id SERIAL PRIMARY KEY,
  decision_id INTEGER NOT NULL REFERENCES c_suite_decisions(id) ON DELETE CASCADE,
  requested_by VARCHAR(64) NOT NULL,
  summary TEXT NOT NULL,
  risk_score INTEGER DEFAULT 5,
  expires_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_by TEXT,
  resolved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_csuite_appr_status ON c_suite_approvals(status);

CREATE TABLE IF NOT EXISTS c_suite_goals (
  id SERIAL PRIMARY KEY,
  scope TEXT NOT NULL DEFAULT 'department',
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
);
CREATE INDEX IF NOT EXISTS idx_csuite_goals_owner ON c_suite_goals(owner_agent);
CREATE INDEX IF NOT EXISTS idx_csuite_goals_status ON c_suite_goals(status);

CREATE TABLE IF NOT EXISTS c_suite_goal_checkins (
  id SERIAL PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES c_suite_goals(id) ON DELETE CASCADE,
  agent_id VARCHAR(64) NOT NULL,
  measured NUMERIC(18,4),
  delta NUMERIC(18,4),
  notes TEXT,
  decisions JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_csuite_checkin_goal ON c_suite_goal_checkins(goal_id);

CREATE TABLE IF NOT EXISTS c_suite_self_improvement (
  id SERIAL PRIMARY KEY,
  detected_by VARCHAR(64) NOT NULL,
  category TEXT NOT NULL,
  severity INTEGER DEFAULT 3,
  title TEXT NOT NULL,
  description TEXT,
  evidence JSONB,
  proposed_fix TEXT,
  applied_fix TEXT,
  status TEXT NOT NULL DEFAULT 'detected',
  decision_id INTEGER REFERENCES c_suite_decisions(id) ON DELETE SET NULL,
  metrics_before JSONB,
  metrics_after JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_csuite_self_status ON c_suite_self_improvement(status);
CREATE INDEX IF NOT EXISTS idx_csuite_self_category ON c_suite_self_improvement(category);

CREATE TABLE IF NOT EXISTS c_suite_settings (
  id SERIAL PRIMARY KEY,
  kill_switch BOOLEAN NOT NULL DEFAULT false,
  global_dry_run BOOLEAN NOT NULL DEFAULT true,
  daily_token_budget_usd NUMERIC(10,2) DEFAULT 15.00,
  auto_approve_below_risk INTEGER DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

async function main() {
  await client.connect();
  console.log('[c-suite migrate] Connected to Neon DB');

  await client.query(SQL);
  console.log('[c-suite migrate] All 11 c_suite_* tables created (IF NOT EXISTS)');

  const { rows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name LIKE 'c_suite_%'
    ORDER BY table_name
  `);
  console.log('[c-suite migrate] Verified tables:');
  rows.forEach(r => console.log('  -', r.table_name));

  await client.end();
  console.log('[c-suite migrate] Done.');
}

main().catch(e => {
  console.error('[c-suite migrate] FAILED:', e);
  process.exit(1);
});
