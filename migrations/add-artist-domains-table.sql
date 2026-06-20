-- Migration: Add artist_domains table
-- Artist Domain Manager module

CREATE TABLE IF NOT EXISTS "artist_domains" (
  "id" serial PRIMARY KEY NOT NULL,
  "artist_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "domain" text NOT NULL UNIQUE,
  "status" text DEFAULT 'pending' NOT NULL,
  "price_per_year" integer,
  "currency" text DEFAULT 'USD',
  "auto_renew" boolean DEFAULT true,
  "expires_at" timestamp,
  "privacy_enabled" boolean DEFAULT true,
  "domain_locked" boolean DEFAULT true,
  "forwarding_url" text,
  "forwarding_type" text DEFAULT '301',
  "hostinger_subscription_id" text,
  "purchased_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_artist_domains_artist" ON "artist_domains" ("artist_id");
CREATE INDEX IF NOT EXISTS "idx_artist_domains_status" ON "artist_domains" ("status");
