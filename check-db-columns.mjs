import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
config();
const sql = neon(process.env.DATABASE_URL);

// Check merchandise columns
const merch = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'merchandise' ORDER BY ordinal_position`;
console.log('merchandise columns:', merch.map(x => x.column_name).join(', '));

// Check if product_bundles table exists
const bundles = await sql`SELECT to_regclass('public.product_bundles') as exists`;
console.log('product_bundles table:', bundles[0].exists);

// Check if product_views table exists
const views = await sql`SELECT to_regclass('public.product_views') as exists`;
console.log('product_views table:', views[0].exists);
