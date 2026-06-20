CREATE TABLE "ab_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"test_type" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"variant_a" text NOT NULL,
	"variant_a_label" text DEFAULT 'Control',
	"variant_a_sent" integer DEFAULT 0,
	"variant_a_opened" integer DEFAULT 0,
	"variant_a_clicked" integer DEFAULT 0,
	"variant_a_converted" integer DEFAULT 0,
	"variant_b" text NOT NULL,
	"variant_b_label" text DEFAULT 'AI Variant',
	"variant_b_sent" integer DEFAULT 0,
	"variant_b_opened" integer DEFAULT 0,
	"variant_b_clicked" integer DEFAULT 0,
	"variant_b_converted" integer DEFAULT 0,
	"sequence_type" text,
	"step" integer,
	"min_sample_size" integer DEFAULT 50,
	"confidence_level" integer DEFAULT 95,
	"winner_variant" text,
	"lift_percent" integer,
	"ai_analysis" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "activation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer,
	"user_id" integer,
	"email" text NOT NULL,
	"event_type" text NOT NULL,
	"event_data" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activation_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer,
	"user_id" integer,
	"email" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"segment" text DEFAULT 'cold' NOT NULL,
	"signals" json DEFAULT '{}'::json,
	"current_plan" text DEFAULT 'none',
	"magic_link_token" text,
	"magic_link_expires_at" timestamp,
	"last_activity_at" timestamp,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activation_scores_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "agent_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"decision_type" text NOT NULL,
	"contact_id" integer,
	"input" json DEFAULT '{}'::json,
	"output" json DEFAULT '{}'::json,
	"reasoning" text,
	"model" text,
	"tokens_used" integer DEFAULT 0,
	"duration_ms" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_start" timestamp NOT NULL,
	"week_end" timestamp NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"target_leads_discovered" integer DEFAULT 500,
	"target_emails_sent" integer DEFAULT 200,
	"target_emails_opened" integer DEFAULT 40,
	"target_emails_clicked" integer DEFAULT 15,
	"target_conversions" integer DEFAULT 5,
	"target_hot_leads" integer DEFAULT 10,
	"actual_leads_discovered" integer DEFAULT 0,
	"actual_emails_sent" integer DEFAULT 0,
	"actual_emails_opened" integer DEFAULT 0,
	"actual_emails_clicked" integer DEFAULT 0,
	"actual_conversions" integer DEFAULT 0,
	"actual_hot_leads" integer DEFAULT 0,
	"performance_score" integer,
	"ai_reflection" text,
	"ai_strategy_next" text,
	"source_allocation" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_health_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"check_type" text NOT NULL,
	"status" text NOT NULL,
	"details" json DEFAULT '{}'::json,
	"action" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_marketplace_installs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"listing_id" integer NOT NULL,
	"rating" integer,
	"review" text,
	"is_active" boolean DEFAULT true,
	"installed_at" timestamp DEFAULT now() NOT NULL,
	"uninstalled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_marketplace_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer,
	"author_name" text NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_description" text NOT NULL,
	"long_description" text,
	"agent_type" text NOT NULL,
	"category" text NOT NULL,
	"tags" text[],
	"icon_url" text,
	"cover_image_url" text,
	"color" text DEFAULT 'from-orange-500 to-amber-500',
	"price" numeric(10, 2) DEFAULT '0',
	"currency" text DEFAULT 'USD',
	"is_free" boolean DEFAULT true,
	"configuration" json,
	"required_plan" text DEFAULT 'free',
	"compatible_agents" text[],
	"install_count" integer DEFAULT 0,
	"avg_rating" numeric(3, 2) DEFAULT '0',
	"rating_count" integer DEFAULT 0,
	"status" text DEFAULT 'draft',
	"is_featured" boolean DEFAULT false,
	"is_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	CONSTRAINT "agent_marketplace_listings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "artist_business_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"business_name" text,
	"executive_summary" text,
	"mission_statement" text,
	"revenue_streams" json,
	"monthly_expenses" json,
	"financial_goals" json,
	"milestones" json,
	"pitch_deck_data" json,
	"projections" json,
	"budget_allocation" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artist_business_plans_artist_id_unique" UNIQUE("artist_id")
);
--> statement-breakpoint
CREATE TABLE "discovery_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"sources" json DEFAULT '[]'::json,
	"raw_leads" integer DEFAULT 0,
	"inserted" integer DEFAULT 0,
	"duplicates" integer DEFAULT 0,
	"invalid" integer DEFAULT 0,
	"scored" integer DEFAULT 0,
	"source_details" json DEFAULT '[]'::json,
	"config" json DEFAULT '{}'::json,
	"error_message" text,
	"duration_ms" integer,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "discovery_runs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "distribution_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" text DEFAULT 'affiliate' NOT NULL,
	"tier" text DEFAULT 'tier3' NOT NULL,
	"contact_email" text,
	"contact_name" text,
	"website" text,
	"api_endpoint" text,
	"api_key" text,
	"rev_share_percent" numeric(5, 2) DEFAULT '0',
	"setup_fee" numeric(10, 2) DEFAULT '0',
	"monthly_fee" numeric(10, 2) DEFAULT '0',
	"territories" integer DEFAULT 0,
	"features" json DEFAULT '[]'::json,
	"status" text DEFAULT 'researching' NOT NULL,
	"outreach_status" text DEFAULT 'not_contacted' NOT NULL,
	"last_contacted_at" timestamp,
	"notes" text,
	"logo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "distribution_partners_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "distribution_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"release_id" integer NOT NULL,
	"partner_id" integer,
	"dsp_id" integer,
	"dsp_name" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"external_id" text,
	"external_url" text,
	"delivered_at" timestamp,
	"live_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drip_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer NOT NULL,
	"sequence_type" text NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"total_steps" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"next_send_at" timestamp,
	"last_sent_at" timestamp,
	"last_opened_at" timestamp,
	"last_clicked_at" timestamp,
	"emails_sent" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"metadata" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dsp_platforms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"category" text DEFAULT 'streaming' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"pay_per_stream" numeric(10, 6),
	"territories" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dsp_platforms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "hype_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"target_artist_id" integer NOT NULL,
	"target_token_id" integer,
	"title" text NOT NULL,
	"description" text,
	"campaign_goal" text NOT NULL,
	"participant_artist_ids" integer[],
	"total_participants" integer DEFAULT 0,
	"total_posts" integer DEFAULT 0,
	"total_tips" numeric(10, 2) DEFAULT '0',
	"total_engagement" integer DEFAULT 0,
	"price_at_start" numeric(10, 4),
	"price_at_end" numeric(10, 4),
	"status" text DEFAULT 'planning' NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_content_library" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content_type" text NOT NULL,
	"title" text,
	"caption" text,
	"hashtags" json DEFAULT '[]'::json,
	"image_urls" json DEFAULT '[]'::json,
	"video_url" text,
	"slides" json,
	"artist_name" text,
	"artist_genre" text,
	"style" text,
	"mood" text,
	"topic" text,
	"status" text DEFAULT 'draft',
	"queued_action_id" integer,
	"generated_by" text DEFAULT 'ai',
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"posted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "instagram_extracted_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"bio" text,
	"email" text,
	"phone" text,
	"website" text,
	"profile_pic_url" text,
	"followers" integer,
	"following" integer,
	"posts_count" integer,
	"is_verified" boolean DEFAULT false,
	"is_private" boolean DEFAULT false,
	"is_business" boolean DEFAULT false,
	"category" text,
	"extract_type" text NOT NULL,
	"extract_query" text,
	"extract_job_id" text,
	"extracted_at" timestamp DEFAULT now() NOT NULL,
	"profile_visited_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_extraction_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"extract_type" text NOT NULL,
	"query" text,
	"max_users" integer DEFAULT 100,
	"enrich_profiles" boolean DEFAULT false,
	"is_scheduled" boolean DEFAULT false,
	"interval_minutes" integer,
	"next_run_at" timestamp,
	"delay_between_ms" integer DEFAULT 3000,
	"max_per_session" integer DEFAULT 50,
	"cooldown_minutes" integer DEFAULT 5,
	"status" text DEFAULT 'pending',
	"profiles_extracted" integer DEFAULT 0,
	"profiles_enriched" integer DEFAULT 0,
	"error_message" text,
	"warnings_count" integer DEFAULT 0,
	"last_warning_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "musician_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" text NOT NULL,
	"imported_by" integer NOT NULL,
	"source" text NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"errors" json,
	"status" text DEFAULT 'processing' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "musician_imports_batch_id_unique" UNIQUE("batch_id")
);
--> statement-breakpoint
CREATE TABLE "musician_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"musician_id" integer NOT NULL,
	"user_id" integer,
	"city" text,
	"country" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"bio" text,
	"years_experience" integer,
	"portfolio_url" text,
	"soundcloud_url" text,
	"youtube_url" text,
	"instagram_url" text,
	"spotify_url" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"availability_schedule" json,
	"response_time_minutes" integer DEFAULT 60,
	"is_verified" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp,
	"completed_jobs" integer DEFAULT 0 NOT NULL,
	"cancelled_jobs" integer DEFAULT 0 NOT NULL,
	"avg_response_time" integer,
	"import_source" text,
	"import_batch_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "podcast_episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recording_id" integer,
	"session_id" integer,
	"title" text NOT NULL,
	"description" text,
	"show_notes" text,
	"audio_url" text,
	"video_url" text,
	"thumbnail_url" text,
	"waveform_data" json,
	"duration" integer DEFAULT 0,
	"file_size" integer,
	"episode_number" integer,
	"season_number" integer,
	"tags" json DEFAULT '[]'::json,
	"category" text,
	"language" text DEFAULT 'en',
	"explicit" boolean DEFAULT false,
	"status" text DEFAULT 'draft',
	"published_at" timestamp,
	"scheduled_publish_at" timestamp,
	"play_count" integer DEFAULT 0,
	"download_count" integer DEFAULT 0,
	"like_count" integer DEFAULT 0,
	"share_count" integer DEFAULT 0,
	"avg_listen_duration" integer DEFAULT 0,
	"chapters" json DEFAULT '[]'::json,
	"transcript" text,
	"transcript_status" text DEFAULT 'none',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "podcast_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'viewer',
	"display_name" text NOT NULL,
	"avatar_url" text,
	"is_muted" boolean DEFAULT false,
	"is_camera_off" boolean DEFAULT false,
	"is_screen_sharing" boolean DEFAULT false,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "podcast_recordings" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"filename" text NOT NULL,
	"file_url" text,
	"file_size" integer,
	"mime_type" text DEFAULT 'video/webm',
	"duration" integer DEFAULT 0,
	"recording_type" text DEFAULT 'video',
	"status" text DEFAULT 'recording',
	"peak_amplitude" numeric(5, 3),
	"avg_loudness" numeric(5, 3),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "podcast_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"host_user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cover_image" text,
	"session_type" text DEFAULT 'podcast',
	"status" text DEFAULT 'setup',
	"room_code" text NOT NULL,
	"max_participants" integer DEFAULT 6,
	"is_recording" boolean DEFAULT false,
	"recording_url" text,
	"layout" text DEFAULT 'grid',
	"stream_destinations" json DEFAULT '[]'::json,
	"settings" json DEFAULT '{"allowChat":true,"allowQuestions":true,"allowReactions":true,"autoRecord":true,"showLowerThirds":true}'::json,
	"viewer_count" integer DEFAULT 0,
	"peak_viewer_count" integer DEFAULT 0,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp,
	"duration" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "podcast_sessions_room_code_unique" UNIQUE("room_code")
);
--> statement-breakpoint
CREATE TABLE "release_tracks" (
	"id" serial PRIMARY KEY NOT NULL,
	"release_id" integer NOT NULL,
	"song_id" integer NOT NULL,
	"track_number" integer NOT NULL,
	"disc_number" integer DEFAULT 1,
	"isrc" text,
	"title" text NOT NULL,
	"artists" json DEFAULT '[]'::json,
	"duration" integer,
	"explicit" boolean DEFAULT false,
	"preview_start" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'single' NOT NULL,
	"upc" text,
	"release_date" timestamp,
	"original_release_date" timestamp,
	"genre" text,
	"subgenre" text,
	"language" text DEFAULT 'en',
	"label" text DEFAULT 'Boostify Music',
	"copyright" text,
	"copyright_year" integer,
	"cover_art_url" text,
	"description" text,
	"explicit" boolean DEFAULT false,
	"territories" json DEFAULT '["worldwide"]'::json,
	"status" text DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"submitted_at" timestamp,
	"approved_at" timestamp,
	"live_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "royalty_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"release_id" integer,
	"track_id" integer,
	"dsp_name" text NOT NULL,
	"period" text NOT NULL,
	"streams" integer DEFAULT 0,
	"downloads" integer DEFAULT 0,
	"gross_revenue" numeric(12, 4) DEFAULT '0',
	"net_revenue" numeric(12, 4) DEFAULT '0',
	"platform_fee" numeric(12, 4) DEFAULT '0',
	"currency" text DEFAULT 'USD',
	"status" text DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_bids" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_request_id" integer NOT NULL,
	"musician_id" integer NOT NULL,
	"user_id" integer,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"message" text NOT NULL,
	"estimated_delivery" text,
	"portfolio_links" text[],
	"status" text DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"instrument_needed" text NOT NULL,
	"genre" text,
	"budget_min" numeric(10, 2) NOT NULL,
	"budget_max" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"city" text,
	"country" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"is_remote" boolean DEFAULT true NOT NULL,
	"deadline" timestamp,
	"urgency" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"selected_bid_id" integer,
	"total_bids" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_tips" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" integer,
	"to_artist_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"token_type" text DEFAULT 'btf' NOT NULL,
	"token_symbol" text,
	"post_id" integer,
	"message" text,
	"is_ai_tip" boolean DEFAULT false,
	"platform_fee" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_roi" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"week_start" timestamp NOT NULL,
	"leads_discovered" integer DEFAULT 0,
	"leads_emailed" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"avg_score" integer DEFAULT 0,
	"cost_estimate" integer DEFAULT 0,
	"roi_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spotify_content_library" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content_type" text NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"metadata" json DEFAULT '{}'::json,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spotify_extension_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"sync_token" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"spotify_username" text,
	"display_name" text,
	"spotify_profile_url" text,
	"spotify_image_url" text,
	"monthly_listeners" integer DEFAULT 0,
	"followers" integer DEFAULT 0,
	"playlist_count" integer DEFAULT 0,
	"total_streams" integer DEFAULT 0,
	"top_cities" json DEFAULT '[]'::json,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "spotify_extension_connections_sync_token_unique" UNIQUE("sync_token")
);
--> statement-breakpoint
CREATE TABLE "spotify_extracted_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"extract_type" text NOT NULL,
	"extract_query" text,
	"username" text,
	"display_name" text,
	"profile_pic_url" text,
	"profile_url" text,
	"email" text,
	"follower_count" integer,
	"monthly_listeners" integer,
	"playlist_name" text,
	"playlist_url" text,
	"playlist_followers" integer,
	"genres" json DEFAULT '[]'::json,
	"is_verified" boolean DEFAULT false,
	"is_curator" boolean DEFAULT false,
	"bio" text,
	"extracted_at" timestamp DEFAULT now() NOT NULL,
	"is_enriched" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "spotify_pending_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"action_type" text NOT NULL,
	"payload" json DEFAULT '{}'::json,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"executed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "spotify_profile_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"monthly_listeners" integer DEFAULT 0,
	"followers" integer DEFAULT 0,
	"playlist_count" integer DEFAULT 0,
	"total_streams" integer DEFAULT 0,
	"top_cities" json DEFAULT '[]'::json,
	"popularity" integer DEFAULT 0,
	"snapshot_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_destinations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"platform" text NOT NULL,
	"label" text NOT NULL,
	"stream_key" text NOT NULL,
	"stream_url" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streaming_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"release_id" integer,
	"track_id" integer,
	"dsp_name" text NOT NULL,
	"date" timestamp NOT NULL,
	"streams" integer DEFAULT 0,
	"saves" integer DEFAULT 0,
	"playlist_adds" integer DEFAULT 0,
	"skip_rate" numeric(5, 2),
	"avg_listen_duration" integer,
	"territory" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tip_leaderboard" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"week_start" timestamp NOT NULL,
	"total_tips_received" numeric(12, 2) DEFAULT '0',
	"total_tips_sent" numeric(12, 2) DEFAULT '0',
	"tip_count" integer DEFAULT 0,
	"unique_tippers" integer DEFAULT 0,
	"rank" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_promotion_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"token_id" integer,
	"campaign_type" text NOT NULL,
	"post_id" integer,
	"token_price" numeric(10, 4),
	"token_supply" integer,
	"token_holders" integer DEFAULT 0,
	"impressions" integer DEFAULT 0,
	"engagements" integer DEFAULT 0,
	"tips_received" numeric(10, 2) DEFAULT '0',
	"tokens_bought_after" numeric(12, 2) DEFAULT '0',
	"btf_burned" numeric(10, 2) DEFAULT '0',
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_service_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_name" text NOT NULL,
	"lead_email" text NOT NULL,
	"lead_phone" text,
	"lead_instagram" text,
	"lead_spotify" text,
	"song_url" text,
	"song_name" text,
	"song_genre" text,
	"song_duration" numeric(10, 2),
	"video_type" text,
	"aesthetic" text,
	"description" text,
	"needs_real_video" boolean DEFAULT false NOT NULL,
	"needs_lip_sync" boolean DEFAULT false NOT NULL,
	"resolution" text DEFAULT '1080p',
	"video_duration" text,
	"locations" text,
	"calculated_price" numeric(10, 2),
	"deposit_amount" numeric(10, 2),
	"deposit_paid" boolean DEFAULT false NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_id" text,
	"project_status" text DEFAULT 'received' NOT NULL,
	"free_landing_days" integer DEFAULT 30,
	"artist_page_url" text,
	"artist_image_url" text,
	"lang" text DEFAULT 'es',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activation_events" ADD CONSTRAINT "activation_events_contact_id_music_industry_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."music_industry_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_events" ADD CONSTRAINT "activation_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_scores" ADD CONSTRAINT "activation_scores_contact_id_music_industry_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."music_industry_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_scores" ADD CONSTRAINT "activation_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD CONSTRAINT "agent_decisions_contact_id_music_industry_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."music_industry_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_marketplace_installs" ADD CONSTRAINT "agent_marketplace_installs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_marketplace_installs" ADD CONSTRAINT "agent_marketplace_installs_listing_id_agent_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."agent_marketplace_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_marketplace_listings" ADD CONSTRAINT "agent_marketplace_listings_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_business_plans" ADD CONSTRAINT "artist_business_plans_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_submissions" ADD CONSTRAINT "distribution_submissions_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_submissions" ADD CONSTRAINT "distribution_submissions_partner_id_distribution_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."distribution_partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "distribution_submissions" ADD CONSTRAINT "distribution_submissions_dsp_id_dsp_platforms_id_fk" FOREIGN KEY ("dsp_id") REFERENCES "public"."dsp_platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drip_sequences" ADD CONSTRAINT "drip_sequences_contact_id_music_industry_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."music_industry_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hype_campaigns" ADD CONSTRAINT "hype_campaigns_target_artist_id_users_id_fk" FOREIGN KEY ("target_artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hype_campaigns" ADD CONSTRAINT "hype_campaigns_target_token_id_tokenized_songs_id_fk" FOREIGN KEY ("target_token_id") REFERENCES "public"."tokenized_songs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_content_library" ADD CONSTRAINT "instagram_content_library_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_extracted_profiles" ADD CONSTRAINT "instagram_extracted_profiles_connection_id_instagram_extension_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."instagram_extension_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_extraction_jobs" ADD CONSTRAINT "instagram_extraction_jobs_connection_id_instagram_extension_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."instagram_extension_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_imports" ADD CONSTRAINT "musician_imports_imported_by_users_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_profiles" ADD CONSTRAINT "musician_profiles_musician_id_musicians_id_fk" FOREIGN KEY ("musician_id") REFERENCES "public"."musicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_profiles" ADD CONSTRAINT "musician_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tracks" ADD CONSTRAINT "release_tracks_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_tracks" ADD CONSTRAINT "release_tracks_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "royalty_transactions" ADD CONSTRAINT "royalty_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "royalty_transactions" ADD CONSTRAINT "royalty_transactions_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "royalty_transactions" ADD CONSTRAINT "royalty_transactions_track_id_release_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."release_tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bids" ADD CONSTRAINT "service_bids_service_request_id_service_requests_id_fk" FOREIGN KEY ("service_request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bids" ADD CONSTRAINT "service_bids_musician_id_musicians_id_fk" FOREIGN KEY ("musician_id") REFERENCES "public"."musicians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_bids" ADD CONSTRAINT "service_bids_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_tips" ADD CONSTRAINT "social_tips_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_tips" ADD CONSTRAINT "social_tips_to_artist_id_users_id_fk" FOREIGN KEY ("to_artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_tips" ADD CONSTRAINT "social_tips_post_id_ai_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."ai_social_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_content_library" ADD CONSTRAINT "spotify_content_library_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_extension_connections" ADD CONSTRAINT "spotify_extension_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_extracted_profiles" ADD CONSTRAINT "spotify_extracted_profiles_connection_id_spotify_extension_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."spotify_extension_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_pending_actions" ADD CONSTRAINT "spotify_pending_actions_connection_id_spotify_extension_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."spotify_extension_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_profile_snapshots" ADD CONSTRAINT "spotify_profile_snapshots_connection_id_spotify_extension_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."spotify_extension_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaming_analytics" ADD CONSTRAINT "streaming_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaming_analytics" ADD CONSTRAINT "streaming_analytics_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaming_analytics" ADD CONSTRAINT "streaming_analytics_track_id_release_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."release_tracks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tip_leaderboard" ADD CONSTRAINT "tip_leaderboard_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_promotion_campaigns" ADD CONSTRAINT "token_promotion_campaigns_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_promotion_campaigns" ADD CONSTRAINT "token_promotion_campaigns_token_id_tokenized_songs_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokenized_songs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_promotion_campaigns" ADD CONSTRAINT "token_promotion_campaigns_post_id_ai_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."ai_social_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ab_tests_status" ON "ab_tests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ab_tests_type" ON "ab_tests" USING btree ("test_type");--> statement-breakpoint
CREATE INDEX "idx_ab_tests_sequence" ON "ab_tests" USING btree ("sequence_type","step");--> statement-breakpoint
CREATE INDEX "idx_activation_email" ON "activation_events" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_activation_contact" ON "activation_events" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_activation_user" ON "activation_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_activation_type" ON "activation_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_activation_created" ON "activation_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_score_email" ON "activation_scores" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_score_segment" ON "activation_scores" USING btree ("segment");--> statement-breakpoint
CREATE INDEX "idx_score_score" ON "activation_scores" USING btree ("score");--> statement-breakpoint
CREATE INDEX "idx_score_contact" ON "activation_scores" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_agent_decisions_type" ON "agent_decisions" USING btree ("decision_type");--> statement-breakpoint
CREATE INDEX "idx_agent_decisions_contact" ON "agent_decisions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_agent_decisions_created" ON "agent_decisions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_agent_goals_week" ON "agent_goals" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "idx_agent_goals_status" ON "agent_goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_health_type" ON "agent_health_log" USING btree ("check_type");--> statement-breakpoint
CREATE INDEX "idx_agent_health_status" ON "agent_health_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_health_created" ON "agent_health_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_install_user" ON "agent_marketplace_installs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_install_listing" ON "agent_marketplace_installs" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_author" ON "agent_marketplace_listings" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_agent_type" ON "agent_marketplace_listings" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "idx_marketplace_category" ON "agent_marketplace_listings" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_marketplace_status" ON "agent_marketplace_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_marketplace_featured" ON "agent_marketplace_listings" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "idx_marketplace_slug" ON "agent_marketplace_listings" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_business_plan_artist" ON "artist_business_plans" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_disc_runs_status" ON "discovery_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_disc_runs_started" ON "discovery_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_dist_sub_release" ON "distribution_submissions" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "idx_dist_sub_status" ON "distribution_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_drip_contact" ON "drip_sequences" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_drip_status" ON "drip_sequences" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_drip_next_send" ON "drip_sequences" USING btree ("next_send_at");--> statement-breakpoint
CREATE INDEX "idx_drip_sequence_type" ON "drip_sequences" USING btree ("sequence_type");--> statement-breakpoint
CREATE INDEX "idx_hype_target" ON "hype_campaigns" USING btree ("target_artist_id");--> statement-breakpoint
CREATE INDEX "idx_hype_status" ON "hype_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_content_lib_user" ON "instagram_content_library" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_content_lib_type" ON "instagram_content_library" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "idx_content_lib_status" ON "instagram_content_library" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ig_extracted_conn" ON "instagram_extracted_profiles" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_ig_extracted_username" ON "instagram_extracted_profiles" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_ig_extracted_type" ON "instagram_extracted_profiles" USING btree ("extract_type");--> statement-breakpoint
CREATE INDEX "idx_ig_extracted_email" ON "instagram_extracted_profiles" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_ig_jobs_conn" ON "instagram_extraction_jobs" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_ig_jobs_status" ON "instagram_extraction_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ig_jobs_next_run" ON "instagram_extraction_jobs" USING btree ("next_run_at");--> statement-breakpoint
CREATE INDEX "idx_musician_profiles_musician" ON "musician_profiles" USING btree ("musician_id");--> statement-breakpoint
CREATE INDEX "idx_musician_profiles_location" ON "musician_profiles" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "idx_musician_profiles_available" ON "musician_profiles" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX "idx_podcast_episodes_user" ON "podcast_episodes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_podcast_episodes_status" ON "podcast_episodes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_podcast_episodes_recording" ON "podcast_episodes" USING btree ("recording_id");--> statement-breakpoint
CREATE INDEX "idx_podcast_episodes_published" ON "podcast_episodes" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_podcast_participants_session" ON "podcast_participants" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_podcast_participants_user" ON "podcast_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_podcast_recordings_session" ON "podcast_recordings" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_podcast_recordings_user" ON "podcast_recordings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_podcast_recordings_status" ON "podcast_recordings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_podcast_sessions_host" ON "podcast_sessions" USING btree ("host_user_id");--> statement-breakpoint
CREATE INDEX "idx_podcast_sessions_status" ON "podcast_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_podcast_sessions_room_code" ON "podcast_sessions" USING btree ("room_code");--> statement-breakpoint
CREATE INDEX "idx_release_tracks_release" ON "release_tracks" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "idx_release_tracks_isrc" ON "release_tracks" USING btree ("isrc");--> statement-breakpoint
CREATE INDEX "idx_releases_user" ON "releases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_releases_status" ON "releases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_releases_upc" ON "releases" USING btree ("upc");--> statement-breakpoint
CREATE INDEX "idx_royalty_user" ON "royalty_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_royalty_release" ON "royalty_transactions" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "idx_royalty_period" ON "royalty_transactions" USING btree ("period");--> statement-breakpoint
CREATE INDEX "idx_service_bids_request" ON "service_bids" USING btree ("service_request_id");--> statement-breakpoint
CREATE INDEX "idx_service_bids_musician" ON "service_bids" USING btree ("musician_id");--> statement-breakpoint
CREATE INDEX "idx_service_bids_status" ON "service_bids" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_service_requests_user" ON "service_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_service_requests_status" ON "service_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_service_requests_instrument" ON "service_requests" USING btree ("instrument_needed");--> statement-breakpoint
CREATE INDEX "idx_service_requests_location" ON "service_requests" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "idx_tips_from" ON "social_tips" USING btree ("from_user_id");--> statement-breakpoint
CREATE INDEX "idx_tips_to" ON "social_tips" USING btree ("to_artist_id");--> statement-breakpoint
CREATE INDEX "idx_tips_post" ON "social_tips" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_tips_created" ON "social_tips" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_source_roi_source" ON "source_roi" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_source_roi_week" ON "source_roi" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "idx_spotify_content_user" ON "spotify_content_library" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_spotify_ext_conn_user" ON "spotify_extension_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_spotify_ext_conn_token" ON "spotify_extension_connections" USING btree ("sync_token");--> statement-breakpoint
CREATE INDEX "idx_spotify_extracted_conn" ON "spotify_extracted_profiles" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_spotify_action_conn" ON "spotify_pending_actions" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_spotify_snapshot_conn" ON "spotify_profile_snapshots" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_stream_destinations_user" ON "stream_destinations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_streaming_user" ON "streaming_analytics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_streaming_date" ON "streaming_analytics" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_streaming_dsp" ON "streaming_analytics" USING btree ("dsp_name");--> statement-breakpoint
CREATE INDEX "idx_leaderboard_artist" ON "tip_leaderboard" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_leaderboard_week" ON "tip_leaderboard" USING btree ("week_start");--> statement-breakpoint
CREATE INDEX "idx_leaderboard_rank" ON "tip_leaderboard" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "idx_promo_artist" ON "token_promotion_campaigns" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_promo_token" ON "token_promotion_campaigns" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "idx_promo_status" ON "token_promotion_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_vs_email" ON "video_service_projects" USING btree ("lead_email");--> statement-breakpoint
CREATE INDEX "idx_vs_status" ON "video_service_projects" USING btree ("project_status");