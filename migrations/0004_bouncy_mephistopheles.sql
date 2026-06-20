CREATE TABLE "copyright_certifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"lyrics_project_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"document_hash" text NOT NULL,
	"song_title" text NOT NULL,
	"authorship_score" integer NOT NULL,
	"tx_hash" text,
	"block_number" integer,
	"block_timestamp" timestamp,
	"contract_record_id" integer,
	"wallet_address" text,
	"packet_json" json,
	"pdf_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"certified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lyrics_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"song_title" text NOT NULL,
	"language" text DEFAULT 'en',
	"genre" text,
	"theme" text,
	"emotion" text,
	"message_core" text,
	"personal_story" text,
	"style_references" text[],
	"keywords" text[],
	"human_original_phrases" text[],
	"human_ideas" text[],
	"desired_tone" text,
	"free_writing_block" text,
	"loose_lines" text[],
	"metaphor_bank" text[],
	"hook_bank" text[],
	"narrative_images" text[],
	"structure_map" json,
	"verse_count" integer DEFAULT 2,
	"chorus_length" text DEFAULT 'medium',
	"hook_repetition" integer DEFAULT 2,
	"bridge_position" text DEFAULT 'after-verse2',
	"closing_type" text DEFAULT 'fade',
	"draft_versions" json DEFAULT '[]'::json,
	"authorship_metrics" json,
	"final_lyrics" text,
	"author_declaration" text,
	"current_phase" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_ab_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"variant_name" text NOT NULL,
	"subject_line" text NOT NULL,
	"emails_sent" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"emails_replied" integer DEFAULT 0,
	"is_winner" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_booking_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"name" text NOT NULL,
	"location_query" text NOT NULL,
	"search_terms" json DEFAULT '[]'::json,
	"show_fee" numeric(10, 2),
	"set_duration" text,
	"technical_requirements" text,
	"availability" text,
	"custom_message" text,
	"status" text DEFAULT 'draft',
	"total_venues" integer DEFAULT 0,
	"emails_sent" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_replied" integer DEFAULT 0,
	"bookings_created" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_booking_deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"venue_contact_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"proposed_fee" numeric(10, 2),
	"agreed_fee" numeric(10, 2),
	"currency" text DEFAULT 'usd',
	"proposed_date" timestamp,
	"confirmed_date" timestamp,
	"set_duration" text,
	"technical_requirements" text,
	"status" text DEFAULT 'sent',
	"venue_response" text,
	"counter_offer" numeric(10, 2),
	"notes" text,
	"proposal_sent_at" timestamp,
	"proposal_opened_at" timestamp,
	"replied_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"country" text,
	"phone" text,
	"email" text,
	"website" text,
	"google_rating" real,
	"total_reviews" integer DEFAULT 0,
	"place_id" text,
	"latitude" real,
	"longitude" real,
	"category" text DEFAULT 'other',
	"categories" json DEFAULT '[]'::json,
	"opening_hours" json,
	"image_url" text,
	"import_source" text DEFAULT 'apify_google_maps',
	"apify_run_id" text,
	"search_query" text,
	"status" text DEFAULT 'new',
	"last_contacted_at" timestamp,
	"emails_sent" integer DEFAULT 0,
	"added_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "venue_contacts_place_id_unique" UNIQUE("place_id")
);
--> statement-breakpoint
ALTER TABLE "sponsor_email_log" ADD COLUMN "ab_test_variant" text;--> statement-breakpoint
ALTER TABLE "copyright_certifications" ADD CONSTRAINT "copyright_certifications_lyrics_project_id_lyrics_projects_id_fk" FOREIGN KEY ("lyrics_project_id") REFERENCES "public"."lyrics_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyright_certifications" ADD CONSTRAINT "copyright_certifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lyrics_projects" ADD CONSTRAINT "lyrics_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_ab_tests" ADD CONSTRAINT "sponsor_ab_tests_campaign_id_sponsor_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."sponsor_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_booking_campaigns" ADD CONSTRAINT "venue_booking_campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_booking_campaigns" ADD CONSTRAINT "venue_booking_campaigns_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_booking_deals" ADD CONSTRAINT "venue_booking_deals_campaign_id_venue_booking_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."venue_booking_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_booking_deals" ADD CONSTRAINT "venue_booking_deals_venue_contact_id_venue_contacts_id_fk" FOREIGN KEY ("venue_contact_id") REFERENCES "public"."venue_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_booking_deals" ADD CONSTRAINT "venue_booking_deals_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_booking_deals" ADD CONSTRAINT "venue_booking_deals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_contacts" ADD CONSTRAINT "venue_contacts_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_copyright_certs_user" ON "copyright_certifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_copyright_certs_hash" ON "copyright_certifications" USING btree ("document_hash");--> statement-breakpoint
CREATE INDEX "idx_copyright_certs_project" ON "copyright_certifications" USING btree ("lyrics_project_id");--> statement-breakpoint
CREATE INDEX "idx_lyrics_projects_user" ON "lyrics_projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sponsor_ab_campaign" ON "sponsor_ab_tests" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_venue_campaigns_user" ON "venue_booking_campaigns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_venue_campaigns_artist" ON "venue_booking_campaigns" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_venue_campaigns_status" ON "venue_booking_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_venue_deals_artist" ON "venue_booking_deals" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_venue_deals_venue" ON "venue_booking_deals" USING btree ("venue_contact_id");--> statement-breakpoint
CREATE INDEX "idx_venue_deals_status" ON "venue_booking_deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_venue_deals_campaign" ON "venue_booking_deals" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_venue_contacts_city" ON "venue_contacts" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_venue_contacts_category" ON "venue_contacts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_venue_contacts_status" ON "venue_contacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_venue_contacts_place_id" ON "venue_contacts" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "idx_venue_contacts_user" ON "venue_contacts" USING btree ("added_by_user_id");