/**
 * Migration: add cex_trading_enabled column to artist_economic_profile
 */
import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL);

console.log('Adding cex_trading_enabled to artist_economic_profile...');
await sql`
  ALTER TABLE artist_economic_profile
  ADD COLUMN IF NOT EXISTS cex_trading_enabled boolean NOT NULL DEFAULT false
`;
console.log('✅ cex_trading_enabled column added (or already existed).');
