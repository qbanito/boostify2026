CREATE TYPE "public"."video_concept_status" AS ENUM('new_project', 'intake_completed', 'assets_uploaded', 'json_generated', 'concept_approved', 'in_ai_production', 'in_editing', 'first_version_sent', 'revisions_requested', 'approved', 'delivered', 'archived');--> statement-breakpoint
CREATE TABLE "age_agent_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent" text NOT NULL,
	"run_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" integer,
	"payload" jsonb,
	"summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "age_artist_generation_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"expansion_approval_id" integer NOT NULL,
	"prompt_seed" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_unit_id" integer,
	"agent_log" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "age_artist_growth_units" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"artist_name" text NOT NULL,
	"artist_id" integer,
	"parent_unit_id" integer,
	"status" text DEFAULT 'testing' NOT NULL,
	"initial_budget_cents" integer DEFAULT 10000 NOT NULL,
	"avatar_url" text,
	"teaser_video_url" text,
	"personalized_message" text,
	"personality" text,
	"aesthetic" text,
	"genre" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "age_artist_growth_units_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "age_campaign_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"unit_id" integer NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"platform" text DEFAULT 'meta' NOT NULL,
	"campaign_id" text,
	"adset_id" text,
	"ad_id" text,
	"creative_id" text,
	"spend_cents" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"ctr" real DEFAULT 0 NOT NULL,
	"cpc" real DEFAULT 0 NOT NULL,
	"cpm" real DEFAULT 0 NOT NULL,
	"leads" integer DEFAULT 0 NOT NULL,
	"wizard_completed" integer DEFAULT 0 NOT NULL,
	"checkout_started" integer DEFAULT 0 NOT NULL,
	"purchases" integer DEFAULT 0 NOT NULL,
	"revenue_cents" integer DEFAULT 0 NOT NULL,
	"roas" real DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "age_expansion_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_unit_id" integer NOT NULL,
	"confirmed_sales" integer NOT NULL,
	"gross_revenue_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text DEFAULT 'finance_orchestrator' NOT NULL,
	"reserved_amount_cents" integer DEFAULT 10000 NOT NULL,
	"new_unit_id" integer,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "age_finance_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"unit_id" integer,
	"type" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"balance_after_cents" integer,
	"reference_id" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "age_fingerprints" (
	"id" serial PRIMARY KEY NOT NULL,
	"unit_id" integer NOT NULL,
	"visitor_id" text NOT NULL,
	"campaign_id" text,
	"ad_id" text,
	"traffic_source" text,
	"utm_source" text,
	"utm_campaign" text,
	"utm_content" text,
	"referral_code" text,
	"ip_hash" text,
	"user_agent_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "age_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint_id" integer,
	"unit_id" integer NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"name" text,
	"language" text,
	"status" text DEFAULT 'new' NOT NULL,
	"last_touch_at" timestamp DEFAULT now() NOT NULL,
	"next_action_at" timestamp,
	"objections" jsonb,
	"interest_level" integer DEFAULT 0,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "age_learning_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"insight" text NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"evidence" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "age_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"unit_id" integer NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"external_id" text,
	"product_sku" text DEFAULT 'AGE_MASTER_500' NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"buyer_email" text,
	"buyer_name" text,
	"buyer_clerk_id" varchar,
	"webhook_payload" jsonb,
	"confirmed_at" timestamp,
	"refunded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "age_purchases_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "age_upsells" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_id" integer NOT NULL,
	"product_sku" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'offered' NOT NULL,
	"offered_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "age_wizard_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" integer,
	"unit_id" integer NOT NULL,
	"inputs" jsonb NOT NULL,
	"preview" jsonb,
	"preview_image_url" text,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_suite_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" text NOT NULL,
	"agent_key" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"model" text DEFAULT 'gpt-4o-mini' NOT NULL,
	"persona" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"autonomy" integer DEFAULT 2 NOT NULL,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"budget_usd_daily" numeric(10, 2) DEFAULT '0.50',
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_suite_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" text NOT NULL,
	"agent_key" varchar(64) NOT NULL,
	"thread_id" integer,
	"action" text NOT NULL,
	"target" jsonb,
	"rationale" text,
	"risk_level" integer DEFAULT 1,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"execution_result" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"executed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "artist_suite_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" text NOT NULL,
	"owner_agent" varchar(64) NOT NULL,
	"parent_id" integer,
	"title" text NOT NULL,
	"metric" text NOT NULL,
	"target_value" numeric(18, 4) NOT NULL,
	"current_value" numeric(18, 4),
	"baseline" numeric(18, 4),
	"weight" real DEFAULT 1,
	"period_start" timestamp,
	"period_end" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_suite_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" text NOT NULL,
	"agent_key" varchar(64) NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"weight" real DEFAULT 1,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_suite_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL,
	"artist_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text,
	"tool_name" text,
	"tool_args" jsonb,
	"tool_result" jsonb,
	"tokens_in" integer DEFAULT 0,
	"tokens_out" integer DEFAULT 0,
	"cost_usd" numeric(10, 6) DEFAULT '0',
	"model" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_suite_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" text NOT NULL,
	"kill_switch" boolean DEFAULT false NOT NULL,
	"dry_run_global" boolean DEFAULT true NOT NULL,
	"preferred_model" text DEFAULT 'gpt-4o-mini',
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artist_suite_settings_artist_id_unique" UNIQUE("artist_id")
);
--> statement-breakpoint
CREATE TABLE "artist_suite_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" text NOT NULL,
	"plan" text DEFAULT 'elite' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"decided_by" text,
	"decision_note" text,
	"activated_at" timestamp,
	"expires_at" timestamp,
	"enable_personal_agents" boolean DEFAULT true NOT NULL,
	"enable_corporate_access" boolean DEFAULT true NOT NULL,
	"daily_budget_usd" numeric(10, 2) DEFAULT '2.00' NOT NULL,
	"monthly_message_cap" integer DEFAULT 2000 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artist_suite_subscriptions_artist_id_unique" UNIQUE("artist_id")
);
--> statement-breakpoint
CREATE TABLE "artist_suite_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" text NOT NULL,
	"session_type" text DEFAULT 'personal' NOT NULL,
	"agent_key" varchar(64) NOT NULL,
	"parent_id" integer,
	"topic" text,
	"triggered_by" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "c_suite_agents" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"model" text DEFAULT 'gpt-4o' NOT NULL,
	"autonomy" integer DEFAULT 3 NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"persona" text NOT NULL,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"escalates_to" varchar(64),
	"budget_usd_daily" numeric(10, 2) DEFAULT '5.00',
	"config" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "c_suite_approvals" (
	"id" serial PRIMARY KEY NOT NULL,
	"decision_id" integer NOT NULL,
	"requested_by" varchar(64) NOT NULL,
	"summary" text NOT NULL,
	"risk_score" integer DEFAULT 5,
	"expires_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "c_suite_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"thread_id" integer,
	"action" text NOT NULL,
	"target" jsonb,
	"rationale" text,
	"risk_level" integer DEFAULT 1,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_by" text,
	"execution_result" jsonb,
	"signature_sha256" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"executed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "c_suite_goal_checkins" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal_id" integer NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"measured" numeric(18, 4),
	"delta" numeric(18, 4),
	"notes" text,
	"decisions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "c_suite_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" text DEFAULT 'department' NOT NULL,
	"owner_agent" varchar(64) NOT NULL,
	"parent_id" integer,
	"title" text NOT NULL,
	"metric" text NOT NULL,
	"target_value" numeric(18, 4) NOT NULL,
	"current_value" numeric(18, 4),
	"baseline" numeric(18, 4),
	"weight" real DEFAULT 1,
	"period_start" timestamp,
	"period_end" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "c_suite_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"weight" real DEFAULT 1,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "c_suite_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text,
	"tool_name" text,
	"tool_args" jsonb,
	"tool_result" jsonb,
	"tokens_in" integer DEFAULT 0,
	"tokens_out" integer DEFAULT 0,
	"cost_usd" numeric(10, 6) DEFAULT '0',
	"model" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "c_suite_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"cron" text NOT NULL,
	"task" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"last_run" timestamp,
	"next_run" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "c_suite_self_improvement" (
	"id" serial PRIMARY KEY NOT NULL,
	"detected_by" varchar(64) NOT NULL,
	"category" text NOT NULL,
	"severity" integer DEFAULT 3,
	"title" text NOT NULL,
	"description" text,
	"evidence" jsonb,
	"proposed_fix" text,
	"applied_fix" text,
	"status" text DEFAULT 'detected' NOT NULL,
	"decision_id" integer,
	"metrics_before" jsonb,
	"metrics_after" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "c_suite_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"kill_switch" boolean DEFAULT false NOT NULL,
	"global_dry_run" boolean DEFAULT true NOT NULL,
	"daily_token_budget_usd" numeric(10, 2) DEFAULT '15.00',
	"auto_approve_below_risk" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "c_suite_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" varchar(64) NOT NULL,
	"parent_id" integer,
	"topic" text,
	"triggered_by" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mcp_api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" json DEFAULT '["tools:read","tools:execute","sse:connect"]'::json NOT NULL,
	"rate_limit" integer DEFAULT 60 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "musician_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_user_id" integer NOT NULL,
	"musician_id" integer NOT NULL,
	"musician_user_id" integer,
	"booking_id" integer,
	"subject" text,
	"status" text DEFAULT 'open' NOT NULL,
	"last_message_preview" text,
	"last_message_at" timestamp,
	"client_unread_count" integer DEFAULT 0 NOT NULL,
	"musician_unread_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "musician_import_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"imported_by" integer,
	"source" text NOT NULL,
	"file_name" text,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"skip_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"error_log" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "musician_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_role" text NOT NULL,
	"sender_user_id" integer,
	"type" text DEFAULT 'text' NOT NULL,
	"body" text NOT NULL,
	"attachments" json,
	"metadata" json,
	"read_by_client" boolean DEFAULT false NOT NULL,
	"read_by_musician" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "musician_service_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"booking_id" integer,
	"title" text NOT NULL,
	"summary" text,
	"terms" json,
	"price_amount" numeric(10, 2) NOT NULL,
	"price_currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp,
	"accepted_at" timestamp,
	"rejected_at" timestamp,
	"completed_at" timestamp,
	"accepted_by_user_id" integer,
	"stripe_checkout_session_id" text,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_outreach_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"user_id" integer,
	"direction" text DEFAULT 'outbound' NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"message_type" text,
	"subject" text,
	"body" text,
	"recipient_email" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_bundles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"product_ids" integer[] NOT NULL,
	"original_price" numeric(10, 2) NOT NULL,
	"bundle_price" numeric(10, 2) NOT NULL,
	"discount_percent" integer NOT NULL,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"ai_generated" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"merchandise_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"viewer_id" integer,
	"session_id" text,
	"source" text DEFAULT 'card' NOT NULL,
	"referrer" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "song_dna_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"spotify_track_id" text NOT NULL,
	"title" text NOT NULL,
	"artist_name" text,
	"album_name" text,
	"isrc" text,
	"image_url" text,
	"preview_url" text,
	"duration_ms" integer,
	"explicit" boolean DEFAULT false,
	"mood" text,
	"genres" json DEFAULT '[]'::json,
	"audio_features" jsonb,
	"performance" jsonb,
	"demographics" jsonb,
	"market_potential" jsonb,
	"hit_potential" jsonb,
	"cross_platform" jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_concept_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"storage_path" text,
	"original_name" text,
	"mime_type" text,
	"size_bytes" integer,
	"metadata" jsonb,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_concept_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"author_user_id" integer,
	"author_name" text,
	"body" text NOT NULL,
	"type" text DEFAULT 'comment' NOT NULL,
	"asset_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_concept_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"client_name" text NOT NULL,
	"client_email" text NOT NULL,
	"client_phone" text,
	"event_type" text NOT NULL,
	"event_date" timestamp,
	"event_location" text,
	"budget_range" text,
	"selected_preset" text,
	"visual_style" text,
	"music_direction" text,
	"emotional_keywords" jsonb DEFAULT '[]'::jsonb,
	"important_people" text,
	"visual_references" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"master_json" jsonb,
	"status" "video_concept_status" DEFAULT 'new_project' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"stripe_session_id" text,
	"gallery_token" varchar(64),
	"gallery_url" text,
	"assigned_team" jsonb DEFAULT '[]'::jsonb,
	"internal_notes" text,
	"contract_accepted" boolean DEFAULT false NOT NULL,
	"contract_version" text,
	"contract_signature" text,
	"contract_signed_at" timestamp,
	"contract_ip" text,
	"contract_user_agent" text,
	"contract_total_amount" integer,
	"contract_deposit_amount" integer,
	"final_paid_at" timestamp,
	"client_brief_details" jsonb,
	"storyboard_json" jsonb,
	"storyboard_status" text DEFAULT 'not_started',
	"storyboard_updated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "video_concept_projects_gallery_token_unique" UNIQUE("gallery_token")
);
--> statement-breakpoint
CREATE TABLE "video_concept_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"summary" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "video_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"owner_user_id" integer,
	"user_id" integer,
	"guest_name" text,
	"timecode_ms" integer NOT NULL,
	"end_timecode_ms" integer,
	"text" text NOT NULL,
	"color" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "merchandise" ADD COLUMN "product_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "merchandise" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "merchandise" ADD COLUMN "pre_order_release_date" timestamp;--> statement-breakpoint
ALTER TABLE "merchandise" ADD COLUMN "pre_order_minimum_orders" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "merchandise" ADD COLUMN "pre_order_current_orders" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "merchandise" ADD COLUMN "seasonal_collection" text;--> statement-breakpoint
ALTER TABLE "merchandise" ADD COLUMN "ai_generated_design" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "merchandise" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "music_industry_contacts" ADD COLUMN "profile_image_url" text;--> statement-breakpoint
ALTER TABLE "music_industry_contacts" ADD COLUMN "boostify_image_url" text;--> statement-breakpoint
ALTER TABLE "music_industry_contacts" ADD COLUMN "image_stylized_at" timestamp;--> statement-breakpoint
ALTER TABLE "music_industry_contacts" ADD COLUMN "master_json" jsonb;--> statement-breakpoint
ALTER TABLE "music_industry_contacts" ADD COLUMN "master_json_version" text;--> statement-breakpoint
ALTER TABLE "music_industry_contacts" ADD COLUMN "master_json_built_at" timestamp;--> statement-breakpoint
ALTER TABLE "music_industry_contacts" ADD COLUMN "data_completeness" real;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "is_single" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "single_pinned_at" timestamp;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "analysis_json" jsonb;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "analysis_status" text;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "analysis_error" text;--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "analyzed_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "master_json" jsonb;--> statement-breakpoint
ALTER TABLE "video_service_projects" ADD COLUMN "reservation_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "video_service_projects" ADD COLUMN "reservation_amount" numeric(10, 2) DEFAULT '99';--> statement-breakpoint
ALTER TABLE "video_service_projects" ADD COLUMN "reservation_stripe_id" text;--> statement-breakpoint
ALTER TABLE "video_service_projects" ADD COLUMN "script_payment_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "video_service_projects" ADD COLUMN "script_payment_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "video_service_projects" ADD COLUMN "script_payment_stripe_id" text;--> statement-breakpoint
ALTER TABLE "video_service_projects" ADD COLUMN "premium_access_granted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "video_service_projects" ADD COLUMN "premium_access_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "video_service_projects" ADD COLUMN "ai_video_discount_pct" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "age_agent_reports" ADD CONSTRAINT "age_agent_reports_unit_id_age_artist_growth_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."age_artist_growth_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_artist_generation_requests" ADD CONSTRAINT "age_artist_generation_requests_expansion_approval_id_age_expansion_approvals_id_fk" FOREIGN KEY ("expansion_approval_id") REFERENCES "public"."age_expansion_approvals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_artist_generation_requests" ADD CONSTRAINT "age_artist_generation_requests_created_unit_id_age_artist_growth_units_id_fk" FOREIGN KEY ("created_unit_id") REFERENCES "public"."age_artist_growth_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_artist_growth_units" ADD CONSTRAINT "age_artist_growth_units_artist_id_musicians_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."musicians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_campaign_metrics" ADD CONSTRAINT "age_campaign_metrics_unit_id_age_artist_growth_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."age_artist_growth_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_expansion_approvals" ADD CONSTRAINT "age_expansion_approvals_source_unit_id_age_artist_growth_units_id_fk" FOREIGN KEY ("source_unit_id") REFERENCES "public"."age_artist_growth_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_expansion_approvals" ADD CONSTRAINT "age_expansion_approvals_new_unit_id_age_artist_growth_units_id_fk" FOREIGN KEY ("new_unit_id") REFERENCES "public"."age_artist_growth_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_finance_ledger" ADD CONSTRAINT "age_finance_ledger_unit_id_age_artist_growth_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."age_artist_growth_units"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_fingerprints" ADD CONSTRAINT "age_fingerprints_unit_id_age_artist_growth_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."age_artist_growth_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_leads" ADD CONSTRAINT "age_leads_fingerprint_id_age_fingerprints_id_fk" FOREIGN KEY ("fingerprint_id") REFERENCES "public"."age_fingerprints"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_leads" ADD CONSTRAINT "age_leads_unit_id_age_artist_growth_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."age_artist_growth_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_purchases" ADD CONSTRAINT "age_purchases_lead_id_age_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."age_leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_purchases" ADD CONSTRAINT "age_purchases_unit_id_age_artist_growth_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."age_artist_growth_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_upsells" ADD CONSTRAINT "age_upsells_purchase_id_age_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."age_purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_wizard_sessions" ADD CONSTRAINT "age_wizard_sessions_lead_id_age_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."age_leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "age_wizard_sessions" ADD CONSTRAINT "age_wizard_sessions_unit_id_age_artist_growth_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."age_artist_growth_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_suite_decisions" ADD CONSTRAINT "artist_suite_decisions_thread_id_artist_suite_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."artist_suite_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_suite_messages" ADD CONSTRAINT "artist_suite_messages_thread_id_artist_suite_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."artist_suite_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "c_suite_approvals" ADD CONSTRAINT "c_suite_approvals_decision_id_c_suite_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."c_suite_decisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "c_suite_decisions" ADD CONSTRAINT "c_suite_decisions_thread_id_c_suite_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."c_suite_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "c_suite_goal_checkins" ADD CONSTRAINT "c_suite_goal_checkins_goal_id_c_suite_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."c_suite_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "c_suite_messages" ADD CONSTRAINT "c_suite_messages_thread_id_c_suite_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."c_suite_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "c_suite_self_improvement" ADD CONSTRAINT "c_suite_self_improvement_decision_id_c_suite_decisions_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."c_suite_decisions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_api_keys" ADD CONSTRAINT "mcp_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_conversations" ADD CONSTRAINT "musician_conversations_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_conversations" ADD CONSTRAINT "musician_conversations_musician_id_musicians_id_fk" FOREIGN KEY ("musician_id") REFERENCES "public"."musicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_conversations" ADD CONSTRAINT "musician_conversations_musician_user_id_users_id_fk" FOREIGN KEY ("musician_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_conversations" ADD CONSTRAINT "musician_conversations_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_import_batches" ADD CONSTRAINT "musician_import_batches_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_messages" ADD CONSTRAINT "musician_messages_conversation_id_musician_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."musician_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_messages" ADD CONSTRAINT "musician_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_service_contracts" ADD CONSTRAINT "musician_service_contracts_conversation_id_musician_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."musician_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_service_contracts" ADD CONSTRAINT "musician_service_contracts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_service_contracts" ADD CONSTRAINT "musician_service_contracts_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_outreach_log" ADD CONSTRAINT "partner_outreach_log_partner_id_distribution_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."distribution_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_outreach_log" ADD CONSTRAINT "partner_outreach_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_bundles" ADD CONSTRAINT "product_bundles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_merchandise_id_merchandise_id_fk" FOREIGN KEY ("merchandise_id") REFERENCES "public"."merchandise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_dna_analyses" ADD CONSTRAINT "song_dna_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_concept_assets" ADD CONSTRAINT "video_concept_assets_project_id_video_concept_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."video_concept_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_concept_comments" ADD CONSTRAINT "video_concept_comments_project_id_video_concept_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."video_concept_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_concept_comments" ADD CONSTRAINT "video_concept_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_concept_comments" ADD CONSTRAINT "video_concept_comments_asset_id_video_concept_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."video_concept_assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_concept_projects" ADD CONSTRAINT "video_concept_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_concept_revisions" ADD CONSTRAINT "video_concept_revisions_project_id_video_concept_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."video_concept_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_notes" ADD CONSTRAINT "video_notes_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_notes" ADD CONSTRAINT "video_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_age_ar_agent" ON "age_agent_reports" USING btree ("agent");--> statement-breakpoint
CREATE INDEX "idx_age_ar_unit" ON "age_agent_reports" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_age_gen_status" ON "age_artist_generation_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_age_unit_slug" ON "age_artist_growth_units" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_age_unit_status" ON "age_artist_growth_units" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_age_cm_unit" ON "age_campaign_metrics" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_age_cm_date" ON "age_campaign_metrics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_age_exp_source" ON "age_expansion_approvals" USING btree ("source_unit_id");--> statement-breakpoint
CREATE INDEX "idx_age_exp_status" ON "age_expansion_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_age_fl_unit" ON "age_finance_ledger" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_age_fl_type" ON "age_finance_ledger" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_age_fp_unit" ON "age_fingerprints" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_age_fp_visitor" ON "age_fingerprints" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "idx_age_lead_unit" ON "age_leads" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_age_lead_email" ON "age_leads" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_age_lead_status" ON "age_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_age_li_category" ON "age_learning_insights" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_age_pur_unit" ON "age_purchases" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_age_pur_status" ON "age_purchases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_age_pur_external" ON "age_purchases" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "idx_age_up_purchase" ON "age_upsells" USING btree ("purchase_id");--> statement-breakpoint
CREATE INDEX "idx_age_up_status" ON "age_upsells" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_age_wiz_lead" ON "age_wizard_sessions" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_age_wiz_unit" ON "age_wizard_sessions" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "idx_artist_suite_agents_artist" ON "artist_suite_agents" USING btree ("artist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_artist_suite_agent" ON "artist_suite_agents" USING btree ("artist_id","agent_key");--> statement-breakpoint
CREATE INDEX "idx_artist_suite_decisions_artist" ON "artist_suite_decisions" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_artist_suite_decisions_status" ON "artist_suite_decisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_artist_suite_goals_artist" ON "artist_suite_goals" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_artist_suite_goals_status" ON "artist_suite_goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_artist_suite_memory_artist_agent" ON "artist_suite_memory" USING btree ("artist_id","agent_key");--> statement-breakpoint
CREATE INDEX "idx_artist_suite_messages_thread" ON "artist_suite_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "idx_artist_suite_messages_artist" ON "artist_suite_messages" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_artist_suite_sub_status" ON "artist_suite_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_artist_suite_sub_artist" ON "artist_suite_subscriptions" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_artist_suite_threads_artist" ON "artist_suite_threads" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_artist_suite_threads_status" ON "artist_suite_threads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_csuite_appr_status" ON "c_suite_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_csuite_dec_agent" ON "c_suite_decisions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_csuite_dec_status" ON "c_suite_decisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_csuite_checkin_goal" ON "c_suite_goal_checkins" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_csuite_goals_owner" ON "c_suite_goals" USING btree ("owner_agent");--> statement-breakpoint
CREATE INDEX "idx_csuite_goals_status" ON "c_suite_goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_csuite_mem_agent" ON "c_suite_memory" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_csuite_msg_thread" ON "c_suite_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "idx_csuite_self_status" ON "c_suite_self_improvement" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_csuite_self_category" ON "c_suite_self_improvement" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_csuite_threads_agent" ON "c_suite_threads" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_csuite_threads_status" ON "c_suite_threads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mcp_api_keys_user" ON "mcp_api_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mcp_api_keys_hash" ON "mcp_api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "idx_mcp_api_keys_active" ON "mcp_api_keys" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_mus_conv_client" ON "musician_conversations" USING btree ("client_user_id");--> statement-breakpoint
CREATE INDEX "idx_mus_conv_musician" ON "musician_conversations" USING btree ("musician_id");--> statement-breakpoint
CREATE INDEX "idx_mus_conv_booking" ON "musician_conversations" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_mus_conv_status" ON "musician_conversations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_musician_import_by" ON "musician_import_batches" USING btree ("imported_by");--> statement-breakpoint
CREATE INDEX "idx_mus_msg_conv" ON "musician_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_mus_msg_created" ON "musician_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_mus_contract_conv" ON "musician_service_contracts" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_mus_contract_status" ON "musician_service_contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_partner_log_partner" ON "partner_outreach_log" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "idx_partner_log_created" ON "partner_outreach_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_song_dna_user" ON "song_dna_analyses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_song_dna_track" ON "song_dna_analyses" USING btree ("spotify_track_id");--> statement-breakpoint
CREATE INDEX "idx_vca_project" ON "video_concept_assets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_vca_kind" ON "video_concept_assets" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "idx_vcc_project" ON "video_concept_comments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_vcp_user" ON "video_concept_projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_vcp_status" ON "video_concept_projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_vcp_event_type" ON "video_concept_projects" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_vcp_email" ON "video_concept_projects" USING btree ("client_email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_vcp_gallery_token" ON "video_concept_projects" USING btree ("gallery_token");--> statement-breakpoint
CREATE INDEX "idx_vcr_project" ON "video_concept_revisions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_video_notes_video" ON "video_notes" USING btree ("video_id","timecode_ms");--> statement-breakpoint
CREATE INDEX "idx_video_notes_user" ON "video_notes" USING btree ("user_id");