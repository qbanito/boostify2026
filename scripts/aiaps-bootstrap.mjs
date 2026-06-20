#!/usr/bin/env node
/**
 * Bootstrap the 3 AIAPS tables that are normally lazy-created.
 * Idempotent. Safe to run anytime.
 */
import pg from 'pg';
import 'dotenv/config';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL missing'); process.exit(2); }
const pool = new pg.Pool({ connectionString: url, ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined });

await pool.query(`
  CREATE TABLE IF NOT EXISTS aiaps_jobs (
    id SERIAL PRIMARY KEY, kind VARCHAR(64) NOT NULL, platform VARCHAR(32),
    artist_id VARCHAR(64), account_id INTEGER, payload JSONB,
    status VARCHAR(24) DEFAULT 'queued', priority INTEGER DEFAULT 5,
    worker_id VARCHAR(128), attempts INTEGER DEFAULT 0, max_attempts INTEGER DEFAULT 3,
    result JSONB, error TEXT, claimed_at TIMESTAMP, completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_aiaps_jobs_status ON aiaps_jobs(status);
  CREATE INDEX IF NOT EXISTS idx_aiaps_jobs_kind ON aiaps_jobs(kind);
  CREATE INDEX IF NOT EXISTS idx_aiaps_jobs_artist ON aiaps_jobs(artist_id);
`);
console.log('✅ aiaps_jobs ready');

await pool.query(`
  CREATE TABLE IF NOT EXISTS aiaps_operators (
    id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, display_name VARCHAR(255),
    role VARCHAR(32) NOT NULL DEFAULT 'auditor', allowed_platforms JSONB, allowed_artists JSONB,
    active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_aiaps_operators_role ON aiaps_operators(role);
`);
console.log('✅ aiaps_operators ready');

await pool.query(`
  CREATE TABLE IF NOT EXISTS aiaps_vault_secrets (
    id SERIAL PRIMARY KEY, artist_id VARCHAR(64), kind VARCHAR(64) NOT NULL,
    label VARCHAR(255), ciphertext TEXT NOT NULL, iv TEXT NOT NULL, auth_tag TEXT,
    created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_aiaps_vault_artist ON aiaps_vault_secrets(artist_id);
`);
console.log('✅ aiaps_vault_secrets ready');

await pool.end();
