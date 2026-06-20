// Add professional service-contract + 50/50 milestone fields to
// video_concept_projects. Idempotent — safe to re-run.
//
// Run: node add-video-concepts-contract-fields.mjs
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SQL = `
ALTER TABLE video_concept_projects
  ADD COLUMN IF NOT EXISTS contract_accepted        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS contract_version         TEXT,
  ADD COLUMN IF NOT EXISTS contract_signature       TEXT,
  ADD COLUMN IF NOT EXISTS contract_signed_at       TIMESTAMP,
  ADD COLUMN IF NOT EXISTS contract_ip              TEXT,
  ADD COLUMN IF NOT EXISTS contract_user_agent      TEXT,
  ADD COLUMN IF NOT EXISTS contract_total_amount    INTEGER,
  ADD COLUMN IF NOT EXISTS contract_deposit_amount  INTEGER,
  ADD COLUMN IF NOT EXISTS final_paid_at            TIMESTAMP;

-- Drop the old payment_status check constraint (any name) and re-add with
-- the verified two-stage value list.
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'video_concept_projects'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%payment_status%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE video_concept_projects DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE video_concept_projects
  ADD CONSTRAINT video_concept_projects_payment_status_check
  CHECK (payment_status IN ('pending', 'deposit_paid', 'paid_in_full', 'refunded'));
`;

try {
  console.log('🛠  Adding contract + 50/50 milestone fields to video_concept_projects…');
  await pool.query(SQL);
  console.log('✅ video_concept_projects contract fields ready.');
} catch (err) {
  console.error('❌ Failed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
