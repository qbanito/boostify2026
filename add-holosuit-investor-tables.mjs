// Migration: create holosuit investor outreach tables
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log("🚀 Creating HoloSuit investor outreach tables...");

  await sql`
    CREATE TABLE IF NOT EXISTS holosuit_investor_contacts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      company TEXT,
      title TEXT,
      source TEXT DEFAULT 'manual',
      tier_interest TEXT DEFAULT 'seed',
      status TEXT DEFAULT 'pending',
      sequence_step INTEGER DEFAULT 0,
      last_sent_at TIMESTAMP,
      next_send_at TIMESTAMP,
      form_filled_at TIMESTAMP,
      invested_at TIMESTAMP,
      stripe_session_id TEXT,
      notes TEXT,
      apify_data JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log("✅ holosuit_investor_contacts");

  await sql`
    CREATE TABLE IF NOT EXISTS holosuit_email_log (
      id SERIAL PRIMARY KEY,
      contact_id INTEGER REFERENCES holosuit_investor_contacts(id),
      step INTEGER NOT NULL,
      email_type TEXT NOT NULL,
      resend_id TEXT,
      subject TEXT,
      sent_at TIMESTAMP DEFAULT NOW(),
      opened_at TIMESTAMP,
      clicked_at TIMESTAMP,
      replied_at TIMESTAMP,
      bounced_at TIMESTAMP,
      error TEXT
    )
  `;
  console.log("✅ holosuit_email_log");

  await sql`
    CREATE TABLE IF NOT EXISTS holosuit_leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      tier TEXT NOT NULL,
      message TEXT,
      phone TEXT,
      source TEXT DEFAULT 'form',
      form_filled_at TIMESTAMP DEFAULT NOW(),
      invested_at TIMESTAMP,
      stripe_session_id TEXT,
      amount_cents INTEGER,
      forwarded_to_owner BOOLEAN DEFAULT FALSE,
      hot_sequence_step INTEGER DEFAULT 0,
      last_hot_email_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  console.log("✅ holosuit_leads");

  console.log("\n✅ All HoloSuit investor tables created successfully.");
}

migrate().catch(console.error);
