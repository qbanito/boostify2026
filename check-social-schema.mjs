import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();
const sql = neon(process.env.DATABASE_URL);
const r = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='social_users' ORDER BY ordinal_position`;
console.log(JSON.stringify(r, null, 2));
