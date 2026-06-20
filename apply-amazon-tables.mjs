// Apply Amazon Cultural Storefront tables. Idempotent.
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

const sql = `
-- Per-artist Amazon Associates tag + AI booster preference
ALTER TABLE users ADD COLUMN IF NOT EXISTS amazon_affiliate_tag TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS amazon_ai_booster_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- Optional manual marketplace override (e.g. 'US', 'UK', 'DE'). NULL = autodetect from tag suffix.
ALTER TABLE users ADD COLUMN IF NOT EXISTS amazon_marketplace_override TEXT;

-- Manual ASIN list (works WITHOUT PA-API access; uses Amazon Associates image widget)
-- Shape: [{ "asin": "B0XXXXXXX", "title": "Optional title", "note": "Optional note" }, ...]
ALTER TABLE users ADD COLUMN IF NOT EXISTS amazon_manual_picks JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Cached PA-API SearchItems responses (TTL 24h, mandatory per Amazon TOS)
CREATE TABLE IF NOT EXISTS amazon_product_cache (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_hash TEXT NOT NULL,
  marketplace TEXT NOT NULL DEFAULT 'www.amazon.com',
  products_json JSONB NOT NULL,
  item_count INTEGER NOT NULL DEFAULT 0,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_amzn_artist_query
  ON amazon_product_cache(artist_id, query_hash);
CREATE INDEX IF NOT EXISTS idx_amzn_cache_expires
  ON amazon_product_cache(expires_at);

-- Click tracking for analytics + commission audit
CREATE TABLE IF NOT EXISTS amazon_click_events (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  asin TEXT NOT NULL,
  affiliate_tag TEXT NOT NULL,
  visitor_id TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amzn_click_artist
  ON amazon_click_events(artist_id);
CREATE INDEX IF NOT EXISTS idx_amzn_click_created
  ON amazon_click_events(created_at);
`;

(async () => {
  try {
    await pool.query(sql);
    console.log('✅ Amazon Cultural Storefront tables ready (idempotent).');
  } catch (e) {
    console.error('❌ Failed to apply Amazon tables:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
