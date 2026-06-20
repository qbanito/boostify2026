CREATE TYPE "public"."gig_credit_reward_type" AS ENUM('signup', 'complete_profile', 'first_portfolio', 'referral', 'five_star_review', 'daily_streak_7', 'social_share', 'first_gig_complete');--> statement-breakpoint
CREATE TYPE "public"."gig_credit_tx_type" AS ENUM('purchase', 'application', 'refund', 'bonus', 'referral', 'promo', 'commission');--> statement-breakpoint
CREATE TYPE "public"."gig_deliverable_status" AS ENUM('pending', 'delivered', 'revision', 'approved', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."gig_dispute_status" AS ENUM('open', 'under_review', 'resolved_client', 'resolved_musician', 'closed');--> statement-breakpoint
CREATE TYPE "public"."gig_escrow_status" AS ENUM('funded', 'released', 'refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."gig_message_status" AS ENUM('sent', 'delivered', 'read');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" varchar(128) NOT NULL,
	"actor_id" integer,
	"actor_email" varchar(256),
	"target_type" varchar(64),
	"target_id" varchar(256),
	"details" json,
	"ip" varchar(45),
	"user_agent" varchar(512),
	"severity" varchar(16) DEFAULT 'info',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"package_id" integer,
	"title" text NOT NULL,
	"brief" text,
	"product_ids" json,
	"total_amount" numeric(10, 2) NOT NULL,
	"platform_fee" numeric(10, 2) DEFAULT '0',
	"artist_earning" numeric(10, 2) DEFAULT '0',
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'proposal' NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_payment_url" text,
	"paid_at" timestamp,
	"start_date" timestamp,
	"deadline" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_products" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"image_url" text NOT NULL,
	"price" numeric(10, 2),
	"category" text,
	"product_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"website" text,
	"industry" text DEFAULT 'other' NOT NULL,
	"description" text,
	"contact_email" text,
	"contact_name" text,
	"contact_phone" text,
	"instagram_handle" text,
	"tiktok_handle" text,
	"follower_count" integer DEFAULT 0,
	"estimated_budget" text DEFAULT 'medium',
	"product_categories" json,
	"hero_product_url" text,
	"hero_product_name" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"added_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brand_profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "campaign_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"product_id" integer,
	"type" text NOT NULL,
	"image_url" text,
	"video_url" text,
	"caption" text,
	"hashtags" json,
	"ai_model" text,
	"prompt" text,
	"status" text DEFAULT 'generating' NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gig_auto_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"metadata" json,
	"read" boolean DEFAULT false NOT NULL,
	"action_url" text,
	"action_label" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gig_credit_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"credits" integer NOT NULL,
	"bonus_credits" integer DEFAULT 0 NOT NULL,
	"price_usd" numeric(10, 2) NOT NULL,
	"stripe_price_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gig_credit_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"reward_type" "gig_credit_reward_type" NOT NULL,
	"credits_awarded" integer NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gig_credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"type" "gig_credit_tx_type" NOT NULL,
	"description" text NOT NULL,
	"balance_after" integer NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"service_request_id" integer,
	"bid_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gig_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"total_purchased" integer DEFAULT 0 NOT NULL,
	"total_spent" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gig_credits_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "gig_deliverables" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_request_id" integer NOT NULL,
	"bid_id" integer NOT NULL,
	"escrow_id" integer,
	"musician_user_id" integer NOT NULL,
	"client_user_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size_bytes" integer,
	"mime_type" text,
	"preview_url" text,
	"status" "gig_deliverable_status" DEFAULT 'delivered' NOT NULL,
	"delivery_note" text,
	"revision_note" text,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"max_revisions" integer DEFAULT 2 NOT NULL,
	"delivered_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gig_disputes" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_request_id" integer NOT NULL,
	"escrow_id" integer NOT NULL,
	"opened_by_user_id" integer NOT NULL,
	"reason" text NOT NULL,
	"description" text NOT NULL,
	"evidence" json,
	"resolution" text,
	"status" "gig_dispute_status" DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gig_escrow" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_request_id" integer NOT NULL,
	"bid_id" integer NOT NULL,
	"client_user_id" integer NOT NULL,
	"musician_user_id" integer NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"platform_fee" numeric(10, 2) NOT NULL,
	"musician_payout" numeric(10, 2) NOT NULL,
	"status" "gig_escrow_status" DEFAULT 'funded' NOT NULL,
	"stripe_payment_intent_id" text,
	"released_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gig_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_request_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"content" text NOT NULL,
	"attachment_url" text,
	"attachment_type" text,
	"status" "gig_message_status" DEFAULT 'sent' NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "influencer_packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"tier" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"description" text,
	"features" json NOT NULL,
	"promo_images" integer DEFAULT 0 NOT NULL,
	"promo_videos" integer DEFAULT 0 NOT NULL,
	"social_posts" integer DEFAULT 0 NOT NULL,
	"story_mentions" integer DEFAULT 0 NOT NULL,
	"song_mention" boolean DEFAULT false NOT NULL,
	"dedicated_song" boolean DEFAULT false NOT NULL,
	"exclusivity_days" integer DEFAULT 0 NOT NULL,
	"revision_rounds" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "influencer_packages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "news_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"summary" text,
	"html_content" text NOT NULL,
	"cover_image_url" text,
	"cover_image_prompt" text,
	"image_provider" text,
	"category" text DEFAULT 'technology',
	"tags" text[],
	"read_time_minutes" integer DEFAULT 5,
	"status" text DEFAULT 'draft',
	"published_at" timestamp,
	"scheduled_for" timestamp,
	"generated_by" text DEFAULT 'ai-engine',
	"ai_model" text,
	"views" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"published_to_social" boolean DEFAULT false,
	"social_post_ids" json,
	"published_to_extension" boolean DEFAULT false,
	"extension_action_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "news_articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "news_generation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer,
	"topic" text NOT NULL,
	"prompt" text,
	"text_model" text,
	"image_model" text,
	"text_tokens_used" integer,
	"image_cost" numeric(10, 4),
	"success" boolean DEFAULT true,
	"error_message" text,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_outreach_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"first_name" text,
	"last_name" text,
	"company" text,
	"job_title" text,
	"article_id" integer,
	"article_title" text,
	"status" varchar(32) DEFAULT 'sent',
	"provider" varchar(32),
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" json NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer,
	CONSTRAINT "platform_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "publishing_briefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"project_type" text NOT NULL,
	"genres" json DEFAULT '[]'::json,
	"moods" json DEFAULT '[]'::json,
	"tempo" text,
	"vocal_preference" text,
	"reference_links" json DEFAULT '[]'::json,
	"budget_min" integer,
	"budget_max" integer,
	"currency" text DEFAULT 'USD',
	"deadline" timestamp,
	"exclusivity" text DEFAULT 'negotiable',
	"territory" text DEFAULT 'worldwide',
	"usage_duration" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"total_submissions" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishing_deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"submission_id" integer,
	"contact_id" integer,
	"brief_id" integer,
	"deal_type" text NOT NULL,
	"title" text NOT NULL,
	"track_title" text NOT NULL,
	"artist_name" text NOT NULL,
	"project_name" text,
	"company_name" text,
	"deal_amount" integer,
	"currency" text DEFAULT 'USD',
	"platform_fee" integer,
	"artist_earning" integer,
	"royalty_percentage" real,
	"advance_amount" integer,
	"payment_status" text DEFAULT 'pending',
	"exclusivity" text,
	"territory" text DEFAULT 'worldwide',
	"usage_duration" text,
	"contract_terms" text,
	"contract_signed_at" timestamp,
	"status" text DEFAULT 'proposed' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publishing_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"deal_id" integer,
	"submission_id" integer,
	"user_id" integer NOT NULL,
	"contact_id" integer,
	"direction" text NOT NULL,
	"channel" text DEFAULT 'platform',
	"subject" text,
	"body" text NOT NULL,
	"attachments" json DEFAULT '[]'::json,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp,
	"brevo_message_id" text
);
--> statement-breakpoint
CREATE TABLE "publishing_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"brief_id" integer,
	"contact_id" integer,
	"track_title" text NOT NULL,
	"artist_name" text NOT NULL,
	"genre" text,
	"duration" text,
	"bpm" integer,
	"track_url" text,
	"preview_url" text,
	"lyrics" text,
	"isrc" text,
	"cover_art_url" text,
	"pitch_note" text,
	"suggested_fee" integer,
	"exclusivity_offer" text DEFAULT 'negotiable',
	"status" text DEFAULT 'draft' NOT NULL,
	"reviewed_at" timestamp,
	"reviewer_notes" text,
	"feedback_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"version_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text,
	"user_avatar" text,
	"content" text NOT NULL,
	"timestamp" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tracks" json DEFAULT '[]'::json,
	"status" text DEFAULT 'active' NOT NULL,
	"cover_url" text,
	"genre" text,
	"bpm" integer,
	"key" text,
	"collaborator_ids" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "studio_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"host_user_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"participant_count" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "studio_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"track_name" text NOT NULL,
	"audio_url" text NOT NULL,
	"duration" integer,
	"file_size" integer,
	"format" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"uploaded_by_name" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_bids" ALTER COLUMN "musician_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ui_preferences" json;--> statement-breakpoint
ALTER TABLE "brand_campaigns" ADD CONSTRAINT "brand_campaigns_brand_id_brand_profiles_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_campaigns" ADD CONSTRAINT "brand_campaigns_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_campaigns" ADD CONSTRAINT "brand_campaigns_package_id_influencer_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."influencer_packages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_products" ADD CONSTRAINT "brand_products_brand_id_brand_profiles_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brand_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_content" ADD CONSTRAINT "campaign_content_campaign_id_brand_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."brand_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_content" ADD CONSTRAINT "campaign_content_product_id_brand_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."brand_products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_auto_messages" ADD CONSTRAINT "gig_auto_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_credit_rewards" ADD CONSTRAINT "gig_credit_rewards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_credit_transactions" ADD CONSTRAINT "gig_credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_credit_transactions" ADD CONSTRAINT "gig_credit_transactions_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_credit_transactions" ADD CONSTRAINT "gig_credit_transactions_bid_id_service_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."service_bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_credits" ADD CONSTRAINT "gig_credits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_deliverables" ADD CONSTRAINT "gig_deliverables_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_deliverables" ADD CONSTRAINT "gig_deliverables_bid_id_service_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."service_bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_deliverables" ADD CONSTRAINT "gig_deliverables_escrow_id_gig_escrow_id_fk" FOREIGN KEY ("escrow_id") REFERENCES "public"."gig_escrow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_deliverables" ADD CONSTRAINT "gig_deliverables_musician_user_id_users_id_fk" FOREIGN KEY ("musician_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_deliverables" ADD CONSTRAINT "gig_deliverables_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_disputes" ADD CONSTRAINT "gig_disputes_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_disputes" ADD CONSTRAINT "gig_disputes_escrow_id_gig_escrow_id_fk" FOREIGN KEY ("escrow_id") REFERENCES "public"."gig_escrow"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_disputes" ADD CONSTRAINT "gig_disputes_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_escrow" ADD CONSTRAINT "gig_escrow_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_escrow" ADD CONSTRAINT "gig_escrow_bid_id_service_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."service_bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_escrow" ADD CONSTRAINT "gig_escrow_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_escrow" ADD CONSTRAINT "gig_escrow_musician_user_id_users_id_fk" FOREIGN KEY ("musician_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_messages" ADD CONSTRAINT "gig_messages_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_messages" ADD CONSTRAINT "gig_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gig_messages" ADD CONSTRAINT "gig_messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_generation_logs" ADD CONSTRAINT "news_generation_logs_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."news_articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "newsletter_outreach_log" ADD CONSTRAINT "newsletter_outreach_log_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."news_articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_config" ADD CONSTRAINT "platform_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_briefs" ADD CONSTRAINT "publishing_briefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_deals" ADD CONSTRAINT "publishing_deals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_deals" ADD CONSTRAINT "publishing_deals_submission_id_publishing_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."publishing_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_deals" ADD CONSTRAINT "publishing_deals_contact_id_music_industry_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."music_industry_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_deals" ADD CONSTRAINT "publishing_deals_brief_id_publishing_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."publishing_briefs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_messages" ADD CONSTRAINT "publishing_messages_deal_id_publishing_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."publishing_deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_messages" ADD CONSTRAINT "publishing_messages_submission_id_publishing_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."publishing_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_messages" ADD CONSTRAINT "publishing_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_messages" ADD CONSTRAINT "publishing_messages_contact_id_music_industry_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."music_industry_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_submissions" ADD CONSTRAINT "publishing_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_submissions" ADD CONSTRAINT "publishing_submissions_brief_id_publishing_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."publishing_briefs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publishing_submissions" ADD CONSTRAINT "publishing_submissions_contact_id_music_industry_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."music_industry_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_feedback" ADD CONSTRAINT "studio_feedback_version_id_studio_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."studio_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_sessions" ADD CONSTRAINT "studio_sessions_project_id_studio_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."studio_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_versions" ADD CONSTRAINT "studio_versions_project_id_studio_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."studio_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_actor" ON "audit_log" USING btree ("actor_email");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_campaign_brand" ON "brand_campaigns" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_artist" ON "brand_campaigns" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_status" ON "brand_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_brand_industry" ON "brand_profiles" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "idx_brand_slug" ON "brand_profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_gig_auto_msg_user" ON "gig_auto_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gig_auto_msg_type" ON "gig_auto_messages" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_gig_reward_user" ON "gig_credit_rewards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gig_credit_tx_user" ON "gig_credit_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_gig_credit_tx_type" ON "gig_credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_gig_deliverable_request" ON "gig_deliverables" USING btree ("service_request_id");--> statement-breakpoint
CREATE INDEX "idx_gig_deliverable_musician" ON "gig_deliverables" USING btree ("musician_user_id");--> statement-breakpoint
CREATE INDEX "idx_gig_deliverable_client" ON "gig_deliverables" USING btree ("client_user_id");--> statement-breakpoint
CREATE INDEX "idx_gig_dispute_request" ON "gig_disputes" USING btree ("service_request_id");--> statement-breakpoint
CREATE INDEX "idx_gig_dispute_escrow" ON "gig_disputes" USING btree ("escrow_id");--> statement-breakpoint
CREATE INDEX "idx_gig_escrow_request" ON "gig_escrow" USING btree ("service_request_id");--> statement-breakpoint
CREATE INDEX "idx_gig_escrow_musician" ON "gig_escrow" USING btree ("musician_user_id");--> statement-breakpoint
CREATE INDEX "idx_gig_msg_request" ON "gig_messages" USING btree ("service_request_id");--> statement-breakpoint
CREATE INDEX "idx_gig_msg_sender" ON "gig_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_gig_msg_receiver" ON "gig_messages" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "idx_news_status" ON "news_articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_news_category" ON "news_articles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_news_published_at" ON "news_articles" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_news_slug" ON "news_articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_outreach_email" ON "newsletter_outreach_log" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_outreach_article" ON "newsletter_outreach_log" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_outreach_sent_at" ON "newsletter_outreach_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_pub_briefs_user" ON "publishing_briefs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pub_briefs_status" ON "publishing_briefs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pub_briefs_type" ON "publishing_briefs" USING btree ("project_type");--> statement-breakpoint
CREATE INDEX "idx_pub_deal_user" ON "publishing_deals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pub_deal_status" ON "publishing_deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pub_deal_type" ON "publishing_deals" USING btree ("deal_type");--> statement-breakpoint
CREATE INDEX "idx_pub_msg_deal" ON "publishing_messages" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_pub_msg_sub" ON "publishing_messages" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_pub_msg_user" ON "publishing_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pub_sub_user" ON "publishing_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pub_sub_brief" ON "publishing_submissions" USING btree ("brief_id");--> statement-breakpoint
CREATE INDEX "idx_pub_sub_contact" ON "publishing_submissions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_pub_sub_status" ON "publishing_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_studio_feedback_version" ON "studio_feedback" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "idx_studio_feedback_user" ON "studio_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_studio_projects_user" ON "studio_projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_studio_projects_status" ON "studio_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_studio_sessions_host" ON "studio_sessions" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "idx_studio_sessions_status" ON "studio_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_studio_versions_project" ON "studio_versions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_studio_versions_user" ON "studio_versions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_studio_versions_status" ON "studio_versions" USING btree ("status");