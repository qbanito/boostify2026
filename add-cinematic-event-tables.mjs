/**
 * Migration: Cinematic Event Landing Tables
 * ──────────────────────────────────────────
 * Adds 7 new tables for the Cinematic Event Landing module.
 * 100% additive — does NOT modify any existing table.
 *
 * Run: node add-cinematic-event-tables.mjs
 */
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─────────────────────────────────────────────────────────────────
    // 1. cinematic_event_landings
    //    Master config for a public cinema-style event landing page.
    //    Linked to video_concept_projects (optional — can exist standalone).
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS cinematic_event_landings (
        id                    SERIAL PRIMARY KEY,
        project_id            INTEGER REFERENCES video_concept_projects(id) ON DELETE SET NULL,
        owner_user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,

        -- Public URL identifier (unique slug, e.g. "sofia-quince-2026")
        slug                  VARCHAR(120) UNIQUE NOT NULL,

        -- Event branding
        event_title           TEXT NOT NULL,
        event_subtitle        TEXT,
        event_type            TEXT NOT NULL DEFAULT 'quinceanera',
        -- 'quinceanera' | 'wedding' | 'corporate' | 'premiere' | 'other'

        event_date            TIMESTAMP,
        event_location        TEXT,
        honoree_name          TEXT,   -- Name of the quinceañera / couple

        -- Guest access control
        access_mode           TEXT NOT NULL DEFAULT 'open',
        -- 'open' = anyone can enter with just their name
        -- 'code'  = requires matching an access code
        -- 'list'  = requires name to be on the invited guest list

        -- Hashed access code (bcrypt) — only used when access_mode = 'code'
        access_code_hash      TEXT,

        -- Media
        hero_image_url        TEXT,
        trailer_url           TEXT,
        poster_url            TEXT,
        background_music_url  TEXT,

        -- Tier unlocks (matches budgetRange on the linked project)
        tier                  TEXT NOT NULL DEFAULT 'silver',
        -- 'silver' | 'gold' | 'premiere'

        -- Feature flags (overrides for custom packages)
        feature_rsvp          BOOLEAN NOT NULL DEFAULT TRUE,
        feature_photo_booth   BOOLEAN NOT NULL DEFAULT TRUE,
        feature_soundtrack    BOOLEAN NOT NULL DEFAULT FALSE,
        feature_ai_scenes     BOOLEAN NOT NULL DEFAULT FALSE,
        feature_gallery       BOOLEAN NOT NULL DEFAULT FALSE,
        feature_memory_book   BOOLEAN NOT NULL DEFAULT FALSE,
        feature_after_movie   BOOLEAN NOT NULL DEFAULT FALSE,

        -- AI-generated cinematic scenes (JSON array)
        ai_scenes_json        JSONB,
        -- AI-generated personalized song info
        ai_song_json          JSONB,
        -- After-movie info post-event
        after_movie_url       TEXT,
        after_movie_json      JSONB,

        -- Palette / visual customization
        primary_color         TEXT DEFAULT '#1a0533',
        accent_color          TEXT DEFAULT '#c9a84c',
        theme_preset          TEXT DEFAULT 'dark_luxury',

        -- Status
        status                TEXT NOT NULL DEFAULT 'draft',
        -- 'draft' | 'published' | 'archived'
        published_at          TIMESTAMP,

        created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ cinematic_event_landings');

    // ─────────────────────────────────────────────────────────────────
    // 2. event_guest_sessions
    //    Isolated guest auth — completely separate from Boostify users.
    //    A guest enters name + (optional) code → gets a scoped JWT.
    //    This row persists so the owner can see who "attended" digitally.
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_guest_sessions (
        id              SERIAL PRIMARY KEY,
        event_id        INTEGER NOT NULL REFERENCES cinematic_event_landings(id) ON DELETE CASCADE,

        guest_name      TEXT NOT NULL,
        guest_email     TEXT,
        guest_phone     TEXT,

        -- Unique session token (UUID stored in JWT subject)
        session_token   VARCHAR(64) UNIQUE NOT NULL,

        -- QR code token for physical entry (generated at RSVP confirm)
        qr_token        VARCHAR(64) UNIQUE,

        -- When this guest last "entered" the experience
        last_seen_at    TIMESTAMP,
        entry_count     INTEGER NOT NULL DEFAULT 1,

        -- Meta
        user_agent      TEXT,
        ip_address      TEXT,

        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_egs_event ON event_guest_sessions(event_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_egs_token ON event_guest_sessions(session_token)`);
    console.log('✅ event_guest_sessions');

    // ─────────────────────────────────────────────────────────────────
    // 3. event_rsvps
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_rsvps (
        id                SERIAL PRIMARY KEY,
        event_id          INTEGER NOT NULL REFERENCES cinematic_event_landings(id) ON DELETE CASCADE,
        guest_session_id  INTEGER REFERENCES event_guest_sessions(id) ON DELETE SET NULL,

        guest_name        TEXT NOT NULL,
        guest_email       TEXT,
        guest_phone       TEXT,
        guest_count       INTEGER NOT NULL DEFAULT 1,
        meal_preference   TEXT,   -- 'meat' | 'fish' | 'vegetarian' | 'vegan' | 'none'
        message           TEXT,   -- Personal message to the honoree

        attending         BOOLEAN NOT NULL DEFAULT TRUE,
        confirmed_at      TIMESTAMP NOT NULL DEFAULT NOW(),

        -- QR code URL for physical entry
        qr_code_url       TEXT,
        qr_code_data      TEXT,   -- raw data embedded in QR

        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_er_event ON event_rsvps(event_id)`);
    console.log('✅ event_rsvps');

    // ─────────────────────────────────────────────────────────────────
    // 4. event_photo_booth_shots
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_photo_booth_shots (
        id                SERIAL PRIMARY KEY,
        event_id          INTEGER NOT NULL REFERENCES cinematic_event_landings(id) ON DELETE CASCADE,
        guest_session_id  INTEGER REFERENCES event_guest_sessions(id) ON DELETE SET NULL,

        guest_name        TEXT,
        image_url         TEXT NOT NULL,         -- Final composed image (with frame)
        raw_image_url     TEXT,                  -- Original before frame

        frame_id          TEXT,                  -- Which frame template was applied
        filter_id         TEXT,                  -- Which filter was applied

        shared_to_gallery BOOLEAN NOT NULL DEFAULT FALSE,
        downloaded        BOOLEAN NOT NULL DEFAULT FALSE,

        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_epbs_event ON event_photo_booth_shots(event_id)`);
    console.log('✅ event_photo_booth_shots');

    // ─────────────────────────────────────────────────────────────────
    // 5. event_memories
    //    Text messages, audio clips, video dedications, book signatures
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_memories (
        id                SERIAL PRIMARY KEY,
        event_id          INTEGER NOT NULL REFERENCES cinematic_event_landings(id) ON DELETE CASCADE,
        guest_session_id  INTEGER REFERENCES event_guest_sessions(id) ON DELETE SET NULL,

        guest_name        TEXT NOT NULL,
        memory_type       TEXT NOT NULL DEFAULT 'text',
        -- 'text' | 'audio' | 'video' | 'signature'

        content           TEXT,          -- Text message or transcription
        media_url         TEXT,          -- Audio/video URL
        signature_data    TEXT,          -- SVG/canvas data for book signatures

        is_approved       BOOLEAN NOT NULL DEFAULT TRUE,   -- Owner can moderate

        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_em_event ON event_memories(event_id)`);
    console.log('✅ event_memories');

    // ─────────────────────────────────────────────────────────────────
    // 6. event_gallery_uploads
    //    Collaborative guest gallery (photos/videos uploaded by guests)
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_gallery_uploads (
        id                SERIAL PRIMARY KEY,
        event_id          INTEGER NOT NULL REFERENCES cinematic_event_landings(id) ON DELETE CASCADE,
        guest_session_id  INTEGER REFERENCES event_guest_sessions(id) ON DELETE SET NULL,

        guest_name        TEXT,
        media_url         TEXT NOT NULL,
        media_type        TEXT NOT NULL DEFAULT 'photo',   -- 'photo' | 'video' | 'selfie'
        thumbnail_url     TEXT,
        caption           TEXT,

        -- Owner moderation
        is_approved       BOOLEAN NOT NULL DEFAULT TRUE,
        is_featured       BOOLEAN NOT NULL DEFAULT FALSE,

        -- Included in after-movie?
        in_after_movie    BOOLEAN NOT NULL DEFAULT FALSE,

        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_egu_event ON event_gallery_uploads(event_id)`);
    console.log('✅ event_gallery_uploads');

    // ─────────────────────────────────────────────────────────────────
    // 7. event_soundtrack_dedications
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_soundtrack_dedications (
        id                SERIAL PRIMARY KEY,
        event_id          INTEGER NOT NULL REFERENCES cinematic_event_landings(id) ON DELETE CASCADE,
        guest_session_id  INTEGER REFERENCES event_guest_sessions(id) ON DELETE SET NULL,

        guest_name        TEXT NOT NULL,
        song_title        TEXT NOT NULL,
        artist_name       TEXT,
        dedication_message TEXT,
        spotify_url       TEXT,
        youtube_url       TEXT,

        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_esd_event ON event_soundtrack_dedications(event_id)`);
    console.log('✅ event_soundtrack_dedications');

    await client.query('COMMIT');
    console.log('\n🎬 All Cinematic Event Landing tables created successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
