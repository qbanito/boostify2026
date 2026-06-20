import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
config();

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('Running Official Store schema migration...');

  // 1. Add missing columns to merchandise table
  try {
    await sql`ALTER TABLE merchandise ADD COLUMN IF NOT EXISTS product_status TEXT NOT NULL DEFAULT 'active'`;
    console.log('✓ merchandise.product_status');
  } catch (e) { console.error('merchandise.product_status:', e.message); }

  try {
    await sql`ALTER TABLE merchandise ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`;
    console.log('✓ merchandise.expires_at');
  } catch (e) { console.error('merchandise.expires_at:', e.message); }

  try {
    await sql`ALTER TABLE merchandise ADD COLUMN IF NOT EXISTS pre_order_release_date TIMESTAMPTZ`;
    console.log('✓ merchandise.pre_order_release_date');
  } catch (e) { console.error('merchandise.pre_order_release_date:', e.message); }

  try {
    await sql`ALTER TABLE merchandise ADD COLUMN IF NOT EXISTS pre_order_minimum_orders INTEGER NOT NULL DEFAULT 0`;
    console.log('✓ merchandise.pre_order_minimum_orders');
  } catch (e) { console.error('merchandise.pre_order_minimum_orders:', e.message); }

  try {
    await sql`ALTER TABLE merchandise ADD COLUMN IF NOT EXISTS pre_order_current_orders INTEGER NOT NULL DEFAULT 0`;
    console.log('✓ merchandise.pre_order_current_orders');
  } catch (e) { console.error('merchandise.pre_order_current_orders:', e.message); }

  try {
    await sql`ALTER TABLE merchandise ADD COLUMN IF NOT EXISTS seasonal_collection TEXT`;
    console.log('✓ merchandise.seasonal_collection');
  } catch (e) { console.error('merchandise.seasonal_collection:', e.message); }

  try {
    await sql`ALTER TABLE merchandise ADD COLUMN IF NOT EXISTS ai_generated_design BOOLEAN NOT NULL DEFAULT FALSE`;
    console.log('✓ merchandise.ai_generated_design');
  } catch (e) { console.error('merchandise.ai_generated_design:', e.message); }

  try {
    await sql`ALTER TABLE merchandise ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0`;
    console.log('✓ merchandise.view_count');
  } catch (e) { console.error('merchandise.view_count:', e.message); }

  // 2. Create product_bundles table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS product_bundles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        product_ids INTEGER[] NOT NULL,
        original_price DECIMAL(10,2) NOT NULL,
        bundle_price DECIMAL(10,2) NOT NULL,
        discount_percent INTEGER NOT NULL,
        image_url TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✓ product_bundles table created');
  } catch (e) { console.error('product_bundles:', e.message); }

  // 3. Create product_views table
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS product_views (
        id SERIAL PRIMARY KEY,
        merchandise_id INTEGER NOT NULL REFERENCES merchandise(id) ON DELETE CASCADE,
        artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        viewer_id INTEGER REFERENCES users(id),
        session_id TEXT,
        source TEXT NOT NULL DEFAULT 'card',
        referrer TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    console.log('✓ product_views table created');
  } catch (e) { console.error('product_views:', e.message); }

  // Verify
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'merchandise' ORDER BY ordinal_position`;
  console.log('\nmerchandise columns:', cols.map(x => x.column_name).join(', '));

  const tbs = await sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('product_bundles','product_views')`;
  console.log('new tables:', tbs.map(x => x.tablename).join(', '));

  console.log('\nMigration complete!');
}

migrate().catch(console.error);
