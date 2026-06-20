import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;
const p = new Pool({ connectionString: process.env.DATABASE_URL });
await p.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS node_workflow jsonb');
const r = await p.query("SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='node_workflow'");
console.log('node_workflow column:', r.rows.length > 0 ? 'OK ✅' : 'NOT FOUND ❌');
await p.end();
