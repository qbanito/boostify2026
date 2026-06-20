import { Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createIfMissing(name, sql) {
  const check = await pool.query(`SELECT to_regclass('${name}')`);
  if (check.rows[0].to_regclass) {
    console.log(`✅ ${name} already exists`);
    return;
  }
  console.log(`Creating ${name}...`);
  await pool.query(sql);
  console.log(`✅ ${name} created`);
}

try {
  await createIfMissing('instagram_content_library', `
    CREATE TABLE instagram_content_library (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      content_type TEXT NOT NULL,
      title TEXT,
      caption TEXT,
      hashtags JSONB DEFAULT '[]',
      image_urls JSONB DEFAULT '[]',
      video_url TEXT,
      slides JSONB,
      artist_name TEXT,
      artist_genre TEXT,
      style TEXT,
      mood TEXT,
      topic TEXT,
      status TEXT DEFAULT 'draft',
      queued_action_id INTEGER,
      generated_by TEXT DEFAULT 'ai',
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
      posted_at TIMESTAMP
    );
    CREATE INDEX idx_content_lib_user ON instagram_content_library(user_id);
    CREATE INDEX idx_content_lib_type ON instagram_content_library(content_type);
    CREATE INDEX idx_content_lib_status ON instagram_content_library(status);
  `);

  await createIfMissing('instagram_extracted_profiles', `
    CREATE TABLE instagram_extracted_profiles (
      id SERIAL PRIMARY KEY,
      connection_id INTEGER,
      username TEXT NOT NULL,
      full_name TEXT,
      email TEXT,
      phone TEXT,
      profile_pic_url TEXT,
      bio TEXT,
      website TEXT,
      follower_count INTEGER DEFAULT 0,
      following_count INTEGER DEFAULT 0,
      post_count INTEGER DEFAULT 0,
      is_verified BOOLEAN DEFAULT false,
      is_private BOOLEAN DEFAULT false,
      is_business_account BOOLEAN DEFAULT false,
      category TEXT,
      extract_type TEXT,
      extract_query TEXT,
      is_enriched BOOLEAN DEFAULT false,
      extracted_at TIMESTAMP DEFAULT NOW() NOT NULL,
      enriched_at TIMESTAMP,
      metadata JSONB
    );
    CREATE INDEX idx_extracted_profiles_conn ON instagram_extracted_profiles(connection_id);
    CREATE INDEX idx_extracted_profiles_user ON instagram_extracted_profiles(username);
    CREATE INDEX idx_extracted_profiles_type ON instagram_extracted_profiles(extract_type);
  `);

  await createIfMissing('instagram_extraction_jobs', `
    CREATE TABLE instagram_extraction_jobs (
      id SERIAL PRIMARY KEY,
      connection_id INTEGER,
      extract_type TEXT NOT NULL,
      extract_query TEXT,
      status TEXT DEFAULT 'pending',
      total_found INTEGER DEFAULT 0,
      total_enriched INTEGER DEFAULT 0,
      max_profiles INTEGER DEFAULT 100,
      schedule_interval INTEGER,
      ban_protection JSONB,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);

  await pool.end();
  console.log('\n✅ All tables ready');
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
