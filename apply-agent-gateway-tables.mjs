/**
 * Migration: Create Artist Agent Gateway tables
 * Run: node --env-file=.env apply-agent-gateway-tables.mjs
 */
import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const SQL = `
CREATE TABLE IF NOT EXISTS agent_gateway_config (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  communication_mode TEXT NOT NULL DEFAULT 'agents_only',
  public_email_visible BOOLEAN DEFAULT FALSE NOT NULL,
  direct_dm_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  gateway_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  welcome_message TEXT DEFAULT 'All communication is managed by the artist''s AI agent team.',
  auto_reply_enabled BOOLEAN DEFAULT TRUE NOT NULL,
  human_approval_rules JSONB DEFAULT '{}',
  agent_team_config JSONB DEFAULT '{}',
  protection_rules JSONB DEFAULT '{}',
  branding JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gw_config_artist ON agent_gateway_config(artist_id);

CREATE TABLE IF NOT EXISTS artist_agents (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  capabilities JSONB DEFAULT '[]',
  authority_level INTEGER DEFAULT 2 NOT NULL,
  rules JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_artist_agents_artist ON artist_agents(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_agents_type ON artist_agents(agent_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_agents_unique ON artist_agents(artist_id, agent_type);

CREATE TABLE IF NOT EXISTS agent_gateway_requests (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL,
  conversation_id TEXT NOT NULL UNIQUE,
  sender_type TEXT NOT NULL,
  sender_name TEXT,
  sender_email TEXT,
  sender_company TEXT,
  sender_clerk_id TEXT,
  intent TEXT NOT NULL,
  intent_confidence REAL DEFAULT 0,
  collected_data JSONB DEFAULT '{}',
  opportunity_score INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'medium' NOT NULL,
  compatibility_score INTEGER DEFAULT 0,
  status TEXT DEFAULT 'new' NOT NULL,
  agent_summary TEXT,
  agent_recommendation TEXT,
  requires_human_approval BOOLEAN DEFAULT FALSE NOT NULL,
  estimated_value_min NUMERIC(12,2),
  estimated_value_max NUMERIC(12,2),
  proposed_budget NUMERIC(12,2),
  territory TEXT,
  deadline TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gw_requests_artist ON agent_gateway_requests(artist_id);
CREATE INDEX IF NOT EXISTS idx_gw_requests_status ON agent_gateway_requests(status);
CREATE INDEX IF NOT EXISTS idx_gw_requests_agent ON agent_gateway_requests(agent_type);
CREATE INDEX IF NOT EXISTS idx_gw_requests_conv ON agent_gateway_requests(conversation_id);

CREATE TABLE IF NOT EXISTS agent_gateway_messages (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES agent_gateway_requests(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  agent_type TEXT,
  content TEXT NOT NULL,
  structured_data JSONB,
  action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gw_messages_request ON agent_gateway_messages(request_id);
CREATE INDEX IF NOT EXISTS idx_gw_messages_conv ON agent_gateway_messages(conversation_id);

CREATE TABLE IF NOT EXISTS agent_approval_queue (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES agent_gateway_requests(id) ON DELETE CASCADE,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  approval_type TEXT NOT NULL,
  agent_recommendation TEXT NOT NULL,
  agent_proposed_action TEXT NOT NULL,
  risk_assessment JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending' NOT NULL,
  decided_by TEXT,
  decision_note TEXT,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '72 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gw_approval_artist ON agent_approval_queue(artist_id);
CREATE INDEX IF NOT EXISTS idx_gw_approval_status ON agent_approval_queue(status);

CREATE TABLE IF NOT EXISTS agent_gateway_audit_log (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id INTEGER REFERENCES agent_gateway_requests(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_detail TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gw_audit_artist ON agent_gateway_audit_log(artist_id);

CREATE TABLE IF NOT EXISTS agent_external_contacts (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  contact_type TEXT,
  total_requests INTEGER DEFAULT 0 NOT NULL,
  total_value NUMERIC(12,2) DEFAULT '0',
  trust_score INTEGER DEFAULT 50 NOT NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gw_contacts_artist ON agent_external_contacts(artist_id);
`;

async function run() {
  const client = await pool.connect();
  try {
    console.log('🛡️ Creating Artist Agent Gateway tables...');
    await client.query(SQL);
    console.log('✅ All 7 Agent Gateway tables created successfully!');
    console.log('   - agent_gateway_config');
    console.log('   - artist_agents');
    console.log('   - agent_gateway_requests');
    console.log('   - agent_gateway_messages');
    console.log('   - agent_approval_queue');
    console.log('   - agent_gateway_audit_log');
    console.log('   - agent_external_contacts');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('❌ Migration failed:', e.message); process.exit(1); });
