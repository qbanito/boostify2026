/**
 * Migration script to add blockchain fields to users table
 */
import 'dotenv/config';
import { db, pool } from '../db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  console.log('🔄 Adding blockchain columns to users table...');
  
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS blockchain_network TEXT`);
    console.log('  ✅ blockchain_network');
    
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS blockchain_artist_id INTEGER`);
    console.log('  ✅ blockchain_artist_id');
    
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS blockchain_token_id TEXT`);
    console.log('  ✅ blockchain_token_id');
    
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS blockchain_tx_hash TEXT`);
    console.log('  ✅ blockchain_tx_hash');
    
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS blockchain_contract TEXT`);
    console.log('  ✅ blockchain_contract');
    
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS blockchain_registered_at TIMESTAMP`);
    console.log('  ✅ blockchain_registered_at');
    
    console.log('\n🎉 Migration completed successfully!');
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

runMigration();
