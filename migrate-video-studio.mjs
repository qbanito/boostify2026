import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('Creating AI Video Studio tables...');

  await sql`
    CREATE TABLE IF NOT EXISTS video_jobs (
      id SERIAL PRIMARY KEY,
      artist_id TEXT NOT NULL,
      song_id TEXT,
      campaign_id TEXT,
      video_type TEXT NOT NULL,
      platform TEXT DEFAULT 'tiktok',
      format TEXT DEFAULT '9:16',
      language TEXT DEFAULT 'en',
      duration_seconds INTEGER DEFAULT 30,
      input_payload JSONB,
      creative_concept JSONB,
      script JSONB,
      scenes JSONB,
      hyperframes_composition_html TEXT,
      hyperframes_styles_css TEXT,
      hyperframes_timeline_js TEXT,
      hyperframes_metadata JSONB,
      hyperframes_render_config JSONB,
      heygen_payload JSONB,
      heygen_video_id TEXT,
      heygen_video_url TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      error_message TEXT,
      progress_percent INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_video_jobs_artist ON video_jobs(artist_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status)`;
  console.log('✅ video_jobs created');

  await sql`
    CREATE TABLE IF NOT EXISTS video_outputs (
      id SERIAL PRIMARY KEY,
      job_id INTEGER REFERENCES video_jobs(id) ON DELETE CASCADE NOT NULL,
      artist_id TEXT NOT NULL,
      video_url TEXT,
      thumbnail_url TEXT,
      srt_url TEXT,
      vtt_url TEXT,
      metadata_url TEXT,
      exports_by_platform JSONB,
      format TEXT DEFAULT '9:16',
      duration_seconds INTEGER,
      file_size_bytes INTEGER,
      mime_type TEXT DEFAULT 'video/mp4',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_video_outputs_job ON video_outputs(job_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_video_outputs_artist ON video_outputs(artist_id)`;
  console.log('✅ video_outputs created');

  await sql`
    CREATE TABLE IF NOT EXISTS hyperframes_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      preset TEXT,
      genre TEXT,
      format TEXT DEFAULT '9:16',
      duration_seconds INTEGER DEFAULT 30,
      composition_html TEXT NOT NULL,
      styles_css TEXT,
      timeline_js TEXT,
      preview_image_url TEXT,
      is_public BOOLEAN DEFAULT TRUE,
      tags JSONB DEFAULT '[]',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hf_templates_category ON hyperframes_templates(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_hf_templates_preset ON hyperframes_templates(preset)`;
  console.log('✅ hyperframes_templates created');

  console.log('\n🎬 All 3 AI Video Studio tables created successfully!');
}

run().catch(e => {
  console.error('❌ Migration error:', e.message);
  process.exit(1);
});
