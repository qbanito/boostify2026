/**
 * Migration: original_song_projects + song_collaborators
 * 
 * original_song_projects — stores the full authorship evidence packet for
 * each song going through the copyright pipeline (new OR existing uploads).
 * 
 * song_collaborators — musicians hired through producer-tools linked to a
 * specific song project, with role and agreement type for the certificate.
 */
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL not set'); process.exit(1); }
  const pool = new Pool({ connectionString: url });

  try {
    // ── original_song_projects ──────────────────────────────────────────────
    console.log('▶ Creating original_song_projects table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS original_song_projects (
        id                    TEXT PRIMARY KEY DEFAULT 'osp_' || gen_random_uuid()::text,
        user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Linked to an existing uploaded song (nullable = new song)
        existing_song_id      INTEGER REFERENCES songs(id) ON DELETE SET NULL,

        -- Song metadata
        title                 TEXT NOT NULL,
        genre                 TEXT,
        mood                  TEXT,
        language              TEXT DEFAULT 'es',
        is_instrumental       BOOLEAN DEFAULT FALSE,

        -- Artist authorship declaration (CORE copyright evidence)
        creative_story        TEXT,          -- What the artist wants to communicate
        original_verse        TEXT,          -- At least one original line written by the artist
        custom_lyrics         TEXT,          -- Full custom lyrics if any
        declaration_signed_at TIMESTAMPTZ,  -- Timestamp of the authorship declaration

        -- Generation result (null = existing song, not re-generated)
        audio_url             TEXT,
        generation_model      TEXT,          -- internal model key (never shown to user)
        generation_task_id    TEXT,

        -- Stem separation result
        stems_vocals_url      TEXT,
        stems_drums_url       TEXT,
        stems_bass_url        TEXT,
        stems_other_url       TEXT,
        stems_separated_at    TIMESTAMPTZ,

        -- Copyright certification
        document_hash         TEXT,          -- SHA-256 of the full evidence packet
        blockchain_tx         TEXT,          -- Polygon TX hash
        certified_at          TIMESTAMPTZ,

        status                TEXT DEFAULT 'draft',
        -- draft | declaring | generating | separating | certifying | complete | failed

        error_message         TEXT,
        created_at            TIMESTAMPTZ DEFAULT NOW(),
        updated_at            TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('▶ Creating song_collaborators table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS song_collaborators (
        id                    SERIAL PRIMARY KEY,
        song_project_id       TEXT NOT NULL REFERENCES original_song_projects(id) ON DELETE CASCADE,
        artist_user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

        -- Musician info (from producer-tools musicians list or manual entry)
        musician_id           TEXT,          -- ID from the musicians list (nullable for external)
        musician_name         TEXT NOT NULL,
        instrument            TEXT NOT NULL,
        role                  TEXT NOT NULL CHECK (role IN ('performer','co-producer','co-author','arranger')),
        agreement_type        TEXT NOT NULL CHECK (agreement_type IN ('work-for-hire','co-authorship')),

        -- Contribution details
        contribution_notes    TEXT,
        royalty_percentage    NUMERIC(5,2) DEFAULT 0,  -- 0 for work-for-hire

        -- Agreement lifecycle
        agreement_sent_at     TIMESTAMPTZ,
        agreement_signed_at   TIMESTAMPTZ,

        -- Delivered work
        delivery_url          TEXT,          -- Audio file delivered by musician
        delivery_notes        TEXT,
        delivered_at          TIMESTAMPTZ,

        -- Linked booking (from producer-tools booking flow)
        booking_ref           TEXT,

        created_at            TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('▶ Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_osp_user_id ON original_song_projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_osp_existing_song ON original_song_projects(existing_song_id);
      CREATE INDEX IF NOT EXISTS idx_collab_project ON song_collaborators(song_project_id);
      CREATE INDEX IF NOT EXISTS idx_collab_artist ON song_collaborators(artist_user_id);
    `);

    console.log('✅ Migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
