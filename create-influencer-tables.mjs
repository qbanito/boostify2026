import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const sql = `
-- Brand Profiles
CREATE TABLE IF NOT EXISTS brand_profiles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  logo TEXT,
  website TEXT,
  industry TEXT NOT NULL DEFAULT 'other',
  description TEXT,
  contact_email TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  instagram_handle TEXT,
  tiktok_handle TEXT,
  follower_count INTEGER DEFAULT 0,
  estimated_budget TEXT DEFAULT 'medium',
  product_categories JSON,
  hero_product_url TEXT,
  hero_product_name TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_brand_industry ON brand_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_brand_slug ON brand_profiles(slug);

-- Brand Products
CREATE TABLE IF NOT EXISTS brand_products (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  price DECIMAL(10,2),
  category TEXT,
  product_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Influencer Packages
CREATE TABLE IF NOT EXISTS influencer_packages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tier TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT,
  features JSON NOT NULL,
  promo_images INTEGER NOT NULL DEFAULT 0,
  promo_videos INTEGER NOT NULL DEFAULT 0,
  social_posts INTEGER NOT NULL DEFAULT 0,
  story_mentions INTEGER NOT NULL DEFAULT 0,
  song_mention BOOLEAN NOT NULL DEFAULT false,
  dedicated_song BOOLEAN NOT NULL DEFAULT false,
  exclusivity_days INTEGER NOT NULL DEFAULT 0,
  revision_rounds INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Brand Campaigns
CREATE TABLE IF NOT EXISTS brand_campaigns (
  id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brand_profiles(id) ON DELETE CASCADE,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id INTEGER REFERENCES influencer_packages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  brief TEXT,
  product_ids JSON,
  total_amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) DEFAULT 0,
  artist_earning DECIMAL(10,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'proposal',
  stripe_payment_intent_id TEXT,
  stripe_payment_url TEXT,
  paid_at TIMESTAMP,
  start_date TIMESTAMP,
  deadline TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_campaign_brand ON brand_campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_campaign_artist ON brand_campaigns(artist_id);
CREATE INDEX IF NOT EXISTS idx_campaign_status ON brand_campaigns(status);

-- Campaign Content
CREATE TABLE IF NOT EXISTS campaign_content (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES brand_campaigns(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES brand_products(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  image_url TEXT,
  video_url TEXT,
  caption TEXT,
  hashtags JSON,
  ai_model TEXT,
  prompt TEXT,
  status TEXT NOT NULL DEFAULT 'generating',
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed default influencer packages
INSERT INTO influencer_packages (name, slug, tier, price, description, features, promo_images, promo_videos, social_posts, story_mentions, song_mention, dedicated_song, exclusivity_days, revision_rounds, sort_order)
SELECT * FROM (VALUES
  ('Starter Pack', 'starter-pack', 'starter', 300.00, 'Perfect for small brands testing influencer marketing', '["3 AI-generated promo images","1 social media post","Brand mention in story"]'::json, 3, 0, 1, 1, false, false, 0, 1, 1),
  ('Growth Bundle', 'growth-bundle', 'growth', 800.00, 'Ideal for brands ready to scale their presence', '["5 AI-generated promo images","1 promo video","3 social posts","2 story mentions","1 revision round"]'::json, 5, 1, 3, 2, false, false, 7, 2, 2),
  ('Premium Campaign', 'premium-campaign', 'premium', 1500.00, 'Full creative campaign for serious brands', '["10 AI promo images","3 promo videos","5 social posts","5 story mentions","Product mention in song","14 days exclusivity","3 revision rounds"]'::json, 10, 3, 5, 5, true, false, 14, 3, 3),
  ('Enterprise Viral', 'enterprise-viral', 'enterprise', 3000.00, 'Maximum impact viral campaign with dedicated brand song', '["20 AI promo images","5 promo videos","10 social posts","10 story mentions","Dedicated brand song","30 days exclusivity","Unlimited revisions"]'::json, 20, 5, 10, 10, true, true, 30, 99, 4)
) AS v(name, slug, tier, price, description, features, promo_images, promo_videos, social_posts, story_mentions, song_mention, dedicated_song, exclusivity_days, revision_rounds, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM influencer_packages LIMIT 1);
`;

await c.query(sql);
console.log('✅ All 5 influencer tables created + seed packages inserted');

// Verify
const r = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE 'brand%' OR table_name LIKE 'influencer%' OR table_name LIKE 'campaign%') ORDER BY table_name`);
console.log('Tables:', r.rows.map(x => x.table_name));

const pkgs = await c.query(`SELECT name, price, tier FROM influencer_packages ORDER BY sort_order`);
console.log('Packages:', pkgs.rows);

await c.end();
