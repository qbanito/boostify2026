/**
 * Migration: Social Network Integration Tables
 * - Adds real_user_id + email_notifications columns to social_posts / social_users
 * - Creates social_follows table (who follows whom)
 * - Creates social_notification_queue (email notification queue)
 * - Creates platform_events table (cross-module event bus)
 * - Creates external_publish_queue (bridge: social → Instagram/YouTube)
 */

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  console.log("🔧 Running Social Integration Migration...");

  // ── 1. Add real_user_id to social_users ───────────────────────────────────
  await sql`
    ALTER TABLE social_users 
    ADD COLUMN IF NOT EXISTS real_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS follows_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0
  `;
  console.log("✅ social_users: added real_user_id, email, notification columns");

  // ── 2. Add media columns to social_posts if missing ───────────────────────
  await sql`
    ALTER TABLE social_posts
    ADD COLUMN IF NOT EXISTS media_type TEXT,
    ADD COLUMN IF NOT EXISTS media_data TEXT,
    ADD COLUMN IF NOT EXISTS whatsapp_url TEXT,
    ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS external_published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS external_platform TEXT,
    ADD COLUMN IF NOT EXISTS external_post_id TEXT
  `;
  console.log("✅ social_posts: added media, comments_count, external publish columns");

  // ── 3. social_follows table ───────────────────────────────────────────────
  // social_users.id is VARCHAR, so we use TEXT for foreign keys here
  await sql`
    CREATE TABLE IF NOT EXISTS social_follows (
      id SERIAL PRIMARY KEY,
      follower_id TEXT NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
      following_id TEXT NOT NULL REFERENCES social_users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(follower_id, following_id)
    )
  `;
  console.log("✅ social_follows table created");

  // ── 4. social_notification_queue (email notifications) ───────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS social_notification_queue (
      id SERIAL PRIMARY KEY,
      recipient_user_id INTEGER NOT NULL,
      recipient_email TEXT NOT NULL,
      notification_type TEXT NOT NULL CHECK (notification_type IN (
        'like', 'comment', 'follow', 'viral_post', 'weekly_digest',
        'new_song', 'token_alert', 'artist_post', 'platform_event'
      )),
      subject TEXT NOT NULL,
      html_content TEXT NOT NULL,
      related_post_id INTEGER,
      related_user_id INTEGER,
      sent_at TIMESTAMPTZ,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
      error_message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✅ social_notification_queue table created");

  // ── 5. external_publish_queue (bridge to Instagram/YouTube via extension) ─
  await sql`
    CREATE TABLE IF NOT EXISTS external_publish_queue (
      id SERIAL PRIMARY KEY,
      source_type TEXT NOT NULL CHECK (source_type IN ('ai_social_post','user_post','platform_event','agent_post')),
      source_id INTEGER NOT NULL,
      platform TEXT NOT NULL CHECK (platform IN ('instagram','youtube','tiktok')),
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      caption TEXT NOT NULL,
      image_url TEXT,
      video_url TEXT,
      hashtags TEXT[],
      status TEXT DEFAULT 'queued' CHECK (status IN ('queued','dispatched','published','failed')),
      dispatched_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      external_post_id TEXT,
      error_message TEXT,
      ig_connection_id INTEGER,
      retry_count INTEGER DEFAULT 0,
      priority INTEGER DEFAULT 5,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✅ external_publish_queue table created");

  // ── 6. platform_events table (cross-module event bus) ────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS platform_events (
      id SERIAL PRIMARY KEY,
      event_type TEXT NOT NULL CHECK (event_type IN (
        'song_certified','token_launched','token_price_milestone',
        'artist_created','hologram_scheduled','promo_video_ready',
        'post_viral','new_follower_milestone','revenue_milestone',
        'booking_confirmed','collab_request'
      )),
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      payload JSONB NOT NULL DEFAULT '{}',
      auto_promote BOOLEAN DEFAULT FALSE,
      promoted_at TIMESTAMPTZ,
      processed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log("✅ platform_events table created");

  // ── 7. Index on real_user_id for fast lookups ─────────────────────────────
  await sql`CREATE INDEX IF NOT EXISTS idx_social_users_real_user_id ON social_users(real_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_social_notification_queue_status ON social_notification_queue(status, created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_external_publish_queue_status ON external_publish_queue(status, platform)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_platform_events_type ON platform_events(event_type, processed)`;
  console.log("✅ Indexes created");

  console.log("🎉 Social Integration Migration COMPLETE!");
}

runMigration().catch((e) => {
  console.error("❌ Migration failed:", e);
  process.exit(1);
});
