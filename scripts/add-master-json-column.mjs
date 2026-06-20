#!/usr/bin/env node
/**
 * Migration: Add master_json column to users table
 * Run: node scripts/add-master-json-column.mjs
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
  console.log('🔄 Running migration: add master_json column to users...');

  try {
    // Add master_json column if it doesn't exist
    await sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS master_json jsonb;
    `;
    console.log('✅ Column master_json added to users table (or already exists).');

    // Optional: Create a GIN index for efficient JSON querying
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_master_json ON users USING GIN (master_json);
    `;
    console.log('✅ GIN index created on master_json.');

    console.log('🎉 Migration completed successfully.');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
