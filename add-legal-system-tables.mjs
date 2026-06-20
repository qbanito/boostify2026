import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  console.log('🛡️  Creating legal / DMCA / copyright protection tables...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS file_fingerprints (
      id SERIAL PRIMARY KEY,
      uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      owner_email TEXT,
      file_name TEXT NOT NULL,
      file_url TEXT,
      mime_type TEXT,
      file_type TEXT,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      sha256 TEXT NOT NULL,
      md5 TEXT,
      perceptual_hash TEXT,
      upload_ip TEXT,
      user_agent TEXT,
      scan_status TEXT NOT NULL DEFAULT 'pending',
      scan_report JSONB,
      is_duplicate_of INTEGER,
      consent_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      history JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_fingerprints_owner ON file_fingerprints(owner_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_fingerprints_sha256 ON file_fingerprints(sha256)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_fingerprints_status ON file_fingerprints(status)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS upload_consents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_email TEXT,
      owns_rights BOOLEAN NOT NULL DEFAULT FALSE,
      no_false_declaration BOOLEAN NOT NULL DEFAULT FALSE,
      authorizes_storage_distribution BOOLEAN NOT NULL DEFAULT FALSE,
      accepts_dmca_tos BOOLEAN NOT NULL DEFAULT FALSE,
      content_type TEXT,
      context_ref TEXT,
      consent_ip TEXT,
      user_agent TEXT,
      consent_version TEXT NOT NULL DEFAULT '1.0',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_consents_user ON upload_consents(user_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dmca_takedowns (
      id SERIAL PRIMARY KEY,
      uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
      claimant_name TEXT NOT NULL,
      claimant_email TEXT NOT NULL,
      claimant_org TEXT,
      claimant_address TEXT,
      claimant_phone TEXT,
      target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      target_url TEXT,
      fingerprint_id INTEGER REFERENCES file_fingerprints(id) ON DELETE SET NULL,
      work_description TEXT NOT NULL,
      infringement_description TEXT NOT NULL,
      good_faith_statement BOOLEAN NOT NULL DEFAULT FALSE,
      accuracy_statement BOOLEAN NOT NULL DEFAULT FALSE,
      authorized_signature TEXT NOT NULL,
      evidence_urls JSONB DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'received',
      content_disabled_at TIMESTAMP,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      resolution_note TEXT,
      submitter_ip TEXT,
      user_agent TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dmca_status ON dmca_takedowns(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dmca_target_user ON dmca_takedowns(target_user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dmca_email ON dmca_takedowns(claimant_email)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dmca_counter_notices (
      id SERIAL PRIMARY KEY,
      uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
      takedown_id INTEGER NOT NULL REFERENCES dmca_takedowns(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT,
      statement_under_penalty BOOLEAN NOT NULL DEFAULT FALSE,
      consent_to_jurisdiction BOOLEAN NOT NULL DEFAULT FALSE,
      explanation TEXT NOT NULL,
      signature TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received',
      submitter_ip TEXT,
      user_agent TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_counter_takedown ON dmca_counter_notices(takedown_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_counter_user ON dmca_counter_notices(user_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_strikes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      strike_count INTEGER NOT NULL DEFAULT 0,
      total_claims INTEGER NOT NULL DEFAULT 0,
      counter_claims INTEGER NOT NULL DEFAULT 0,
      resolved_claims INTEGER NOT NULL DEFAULT 0,
      pending_claims INTEGER NOT NULL DEFAULT 0,
      suspended BOOLEAN NOT NULL DEFAULT FALSE,
      suspended_at TIMESTAMP,
      last_strike_at TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_strikes_user ON artist_strikes(user_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_verifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      level TEXT NOT NULL DEFAULT 'none',
      legal_name TEXT,
      organization TEXT,
      tax_id TEXT,
      documents_urls JSONB DEFAULT '[]'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      review_note TEXT,
      verified_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_verifications_user ON artist_verifications(user_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_verifications_status ON artist_verifications(status)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS legal_audit_log (
      id SERIAL PRIMARY KEY,
      actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_email TEXT,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      detail JSONB,
      ip TEXT,
      user_agent TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_action ON legal_audit_log(action)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_entity ON legal_audit_log(entity_type, entity_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_created ON legal_audit_log(created_at)`);

  console.log('✅ Legal system tables created successfully.');
  await pool.end();
}

run().catch(async (err) => {
  console.error('❌ Migration failed:', err);
  await pool.end();
  process.exit(1);
});
