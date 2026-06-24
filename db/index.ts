import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "./schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Single shared pool for the whole server. Every route/service imports THIS
// pool (never `new Pool(...)`) so connections to Neon are centrally bounded.
// Size is env-tunable for production scaling (Neon pooled endpoint supports
// many clients). Default 20 — raise PG_POOL_MAX when scaling compute.
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: Number(process.env.PG_POOL_MAX) > 0 ? Number(process.env.PG_POOL_MAX) : 20,
});
export const db = drizzle({ client: pool, schema });