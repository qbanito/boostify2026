import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

const tables = [
  `CREATE TABLE IF NOT EXISTS audience_profiles (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER NOT NULL UNIQUE,
    primary_age_range TEXT NOT NULL DEFAULT '18-35',
    languages TEXT[] NOT NULL DEFAULT '{}',
    locations TEXT[] NOT NULL DEFAULT '{}',
    interests TEXT[] NOT NULL DEFAULT '{}',
    emotional_triggers TEXT[] NOT NULL DEFAULT '{}',
    platforms TEXT[] NOT NULL DEFAULT '{}',
    preferred_formats TEXT[] NOT NULL DEFAULT '{}',
    attention_span_seconds TEXT DEFAULT '1-3 for hook, 15-45 for retention',
    archetype TEXT DEFAULT '',
    promise TEXT DEFAULT '',
    visual_identity TEXT DEFAULT '',
    tone TEXT DEFAULT '',
    content_to_avoid TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS content_pillars_config (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER NOT NULL,
    pillar TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    weight INTEGER NOT NULL DEFAULT 5,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(artist_id, pillar)
  )`,
  `CREATE TABLE IF NOT EXISTS content_capture_scores (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER NOT NULL,
    content_ref TEXT NOT NULL,
    hook_strength INTEGER NOT NULL DEFAULT 0,
    retention_potential INTEGER NOT NULL DEFAULT 0,
    identity_alignment INTEGER NOT NULL DEFAULT 0,
    share_potential INTEGER NOT NULL DEFAULT 0,
    comment_trigger INTEGER NOT NULL DEFAULT 0,
    conversion_intent INTEGER NOT NULL DEFAULT 0,
    platform_fit INTEGER NOT NULL DEFAULT 0,
    overall_score INTEGER NOT NULL DEFAULT 0,
    platform TEXT NOT NULL DEFAULT 'instagram',
    regenerated_count INTEGER NOT NULL DEFAULT 0,
    raw_content JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS content_memory (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    value TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'instagram',
    score INTEGER,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS content_experiments (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER NOT NULL,
    song_id INTEGER,
    hypothesis TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'instagram',
    budget INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    variations JSONB NOT NULL DEFAULT '[]',
    results JSONB,
    winner_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS daily_content_plans (
    id SERIAL PRIMARY KEY,
    artist_id INTEGER NOT NULL,
    plan_date TEXT NOT NULL,
    hook_tests INTEGER NOT NULL DEFAULT 5,
    short_reels INTEGER NOT NULL DEFAULT 3,
    stories INTEGER NOT NULL DEFAULT 5,
    community_posts INTEGER NOT NULL DEFAULT 2,
    conversion_posts INTEGER NOT NULL DEFAULT 1,
    ad_variations INTEGER NOT NULL DEFAULT 0,
    retargeting_assets INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    generated_items JSONB DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(artist_id, plan_date)
  )`,
];

for (const ddl of tables) {
  await sql(ddl);
  const name = ddl.match(/TABLE IF NOT EXISTS (\w+)/)?.[1] ?? '?';
  console.log('✓', name);
}
console.log('Migration complete.');
