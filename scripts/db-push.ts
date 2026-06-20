import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from '../db';

async function main() {
  console.log('⏳ Running database migrations...');
  try {
    // Apply all migrations
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Database migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error running migrations:', error);
    process.exit(1);
  }
}

main();