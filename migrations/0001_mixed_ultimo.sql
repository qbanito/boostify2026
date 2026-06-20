CREATE TABLE "affiliate_badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_id" integer NOT NULL,
	"badge_type" text NOT NULL,
	"badge_name" text NOT NULL,
	"badge_description" text NOT NULL,
	"icon_url" text,
	"earned_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_clicks" (
	"id" serial PRIMARY KEY NOT NULL,
	"link_id" integer NOT NULL,
	"affiliate_id" integer NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"referrer" text,
	"country" text,
	"device" text DEFAULT 'unknown',
	"clicked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_conversions" (
	"id" serial PRIMARY KEY NOT NULL,
	"link_id" integer NOT NULL,
	"affiliate_id" integer NOT NULL,
	"user_id" integer,
	"product_type" text NOT NULL,
	"product_id" text NOT NULL,
	"sale_amount" numeric(10, 2) NOT NULL,
	"commission_rate" numeric(5, 2) NOT NULL,
	"commission_amount" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_payment_id" text,
	"metadata" json,
	"converted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_id" integer NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"minimum_purchase" numeric(10, 2),
	"max_uses" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"applicable_products" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "affiliate_earnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"conversion_id" integer,
	"payment_id" text,
	"metadata" json,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_id" integer NOT NULL,
	"unique_code" text NOT NULL,
	"product_type" text DEFAULT 'general' NOT NULL,
	"product_id" text,
	"custom_path" text,
	"title" text NOT NULL,
	"description" text,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"earnings" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_links_unique_code_unique" UNIQUE("unique_code")
);
--> statement-breakpoint
CREATE TABLE "affiliate_marketing_materials" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"thumbnail_url" text,
	"download_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_id" integer,
	"affiliate_name" text,
	"affiliate_email" text,
	"commission_rate" numeric(5, 2) NOT NULL,
	"total_sales" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_commission" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"amount_pending" numeric(12, 2) DEFAULT '0' NOT NULL,
	"last_payment_date" timestamp,
	"next_payment_date" timestamp,
	"payment_method" text,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"referrals" integer DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"conversion_rate" numeric(5, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"affiliate_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"banner_url" text,
	"landing_page_url" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_referrals" (
	"id" serial PRIMARY KEY NOT NULL,
	"referrer_id" integer NOT NULL,
	"referred_affiliate_id" integer,
	"referred_email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"total_earnings" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"commission_rate" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"website" text,
	"social_media" json,
	"audience_size" text,
	"marketing_experience" text,
	"promotion_strategy" text,
	"level" text DEFAULT 'Básico' NOT NULL,
	"commission_rate" numeric(5, 2) DEFAULT '10.00' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"referral_code" text,
	"payment_method" text DEFAULT 'paypal',
	"payment_email" text,
	"bank_details" json,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"total_conversions" integer DEFAULT 0 NOT NULL,
	"total_earnings" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"pending_payment" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"paid_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "affiliates_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "affiliates_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "api_usage_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"api_provider" text NOT NULL,
	"endpoint" text NOT NULL,
	"model" text,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"prompt_tokens" integer DEFAULT 0,
	"completion_tokens" integer DEFAULT 0,
	"estimated_cost" numeric(10, 6) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"response_time" integer,
	"status" text DEFAULT 'success' NOT NULL,
	"error_message" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_news" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"summary" text NOT NULL,
	"image_url" text NOT NULL,
	"category" text NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_profile_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_profile_id" integer NOT NULL,
	"music_video_project_id" integer,
	"image_url" text NOT NULL,
	"image_type" text NOT NULL,
	"title" text,
	"description" text,
	"scene_metadata" json,
	"is_public" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_token_earnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"tokenized_song_id" integer NOT NULL,
	"purchase_id" integer NOT NULL,
	"amount_eth" numeric(18, 8) NOT NULL,
	"amount_usd" numeric(10, 2),
	"transaction_hash" varchar(66) NOT NULL,
	"withdrawn_at" timestamp,
	"withdraw_tx_hash" varchar(66),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_wallet" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_earnings" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_spent" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artist_wallet_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "content_generation_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer,
	"lesson_id" integer,
	"generation_type" text NOT NULL,
	"prompt" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" json,
	"error_message" text,
	"priority" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "course_quizzes" (
	"id" serial PRIMARY KEY NOT NULL,
	"lesson_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"passing_score" integer DEFAULT 70 NOT NULL,
	"order_index" integer NOT NULL,
	"is_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"amount" integer NOT NULL,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_checkout_session_id" text,
	"related_project_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crowdfunding_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"goal_amount" numeric(10, 2) NOT NULL,
	"current_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"end_date" timestamp,
	"contributors_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crowdfunding_contributions" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"contributor_email" text,
	"contributor_name" text,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"platform_fee" numeric(10, 2) NOT NULL,
	"artist_amount" numeric(10, 2) NOT NULL,
	"stripe_payment_intent_id" text,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "crowdfunding_contributions_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "fashion_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"analysis_type" text NOT NULL,
	"image_url" text,
	"recommendations" json,
	"mood_board" json,
	"gemini_response" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fashion_portfolio" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"images" text[] NOT NULL,
	"products" json,
	"category" text NOT NULL,
	"season" text,
	"tags" text[],
	"is_public" boolean DEFAULT false NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fashion_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"result_type" text NOT NULL,
	"image_url" text,
	"video_url" text,
	"metadata" json,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"rating" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fashion_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_type" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fashion_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_id" integer,
	"video_url" text NOT NULL,
	"thumbnail_url" text,
	"prompt" text NOT NULL,
	"model_image" text,
	"clothing_image" text,
	"duration" integer,
	"kling_task_id" text,
	"status" text DEFAULT 'processing' NOT NULL,
	"metadata" json,
	"is_published" boolean DEFAULT false NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"song_name" text NOT NULL,
	"video_url" text NOT NULL,
	"thumbnail_url" text,
	"duration" integer NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"payment_intent_id" text,
	"amount" numeric(10, 2),
	"metadata" json,
	"status" text DEFAULT 'generating' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"access_token" text NOT NULL,
	"instagram_user_id" text NOT NULL,
	"instagram_username" text,
	"page_id" text NOT NULL,
	"page_access_token" text NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "instagram_connections_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "investor_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"investor_id" integer,
	"investor_name" text,
	"investor_email" text,
	"investment_type" text NOT NULL,
	"investment_amount" numeric(12, 2) NOT NULL,
	"investment_date" timestamp NOT NULL,
	"expected_return" numeric(5, 2) NOT NULL,
	"expected_return_amount" numeric(12, 2) DEFAULT '0',
	"interest_rate" numeric(5, 2) DEFAULT '0',
	"total_paid_out" numeric(12, 2) DEFAULT '0' NOT NULL,
	"pending_payment" numeric(12, 2) DEFAULT '0' NOT NULL,
	"last_payment_date" timestamp,
	"next_payment_date" timestamp,
	"payment_method" text,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"payment_frequency" text DEFAULT 'quarterly',
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investors" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"country" text NOT NULL,
	"investment_amount" numeric(10, 2) NOT NULL,
	"investment_goals" text NOT NULL,
	"risk_tolerance" text NOT NULL,
	"investor_type" text NOT NULL,
	"terms_accepted" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"lesson_id" integer NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp,
	"completed_at" timestamp,
	"time_spent_minutes" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquidity_pools" (
	"id" serial PRIMARY KEY NOT NULL,
	"pair_id" integer NOT NULL,
	"total_shares" numeric(20, 8) DEFAULT '0' NOT NULL,
	"reserve1" numeric(20, 8) DEFAULT '0' NOT NULL,
	"reserve2" numeric(20, 8) DEFAULT '0' NOT NULL,
	"fees_accumulated" numeric(20, 8) DEFAULT '0' NOT NULL,
	"apy" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "liquidity_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"pool_id" integer NOT NULL,
	"lp_tokens_held" numeric(20, 8) NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"amount1_deposited" numeric(20, 8) NOT NULL,
	"amount2_deposited" numeric(20, 8) NOT NULL,
	"fees_earned" numeric(20, 8) DEFAULT '0' NOT NULL,
	"transaction_hash" varchar(66),
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchandise" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"production_cost" numeric(10, 2),
	"images" text[] NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"remove_boostify_logo" boolean DEFAULT false NOT NULL,
	"is_custom_design" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_industry_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text,
	"personal_email" text,
	"phone" text,
	"mobile_number" text,
	"job_title" text,
	"headline" text,
	"seniority_level" text,
	"functional_level" text,
	"industry" text,
	"company_name" text,
	"company_domain" text,
	"company_website" text,
	"company_linkedin" text,
	"company_phone" text,
	"company_size" text,
	"company_annual_revenue" text,
	"company_founded_year" integer,
	"company_description" text,
	"company_technologies" text,
	"city" text,
	"state" text,
	"country" text,
	"company_full_address" text,
	"linkedin" text,
	"category" text DEFAULT 'other',
	"keywords" text,
	"status" text DEFAULT 'new',
	"last_contacted_at" timestamp,
	"emails_sent" integer DEFAULT 0,
	"opens_count" integer DEFAULT 0,
	"clicks_count" integer DEFAULT 0,
	"import_source" text,
	"import_batch_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_video_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"project_name" text NOT NULL,
	"audio_url" text,
	"audio_duration" numeric(10, 2),
	"transcription" text,
	"script_content" text,
	"timeline_items" json,
	"scenes" json,
	"selected_director" json,
	"selected_concept" json,
	"video_style" json,
	"artist_reference_images" json,
	"artist_name" text,
	"song_name" text,
	"thumbnail" text,
	"selected_editing_style" json,
	"aspect_ratio" text,
	"artist_profile_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"progress" json,
	"generated_images_count" integer DEFAULT 0,
	"total_images_target" integer DEFAULT 40,
	"final_video_url" text,
	"is_paid" boolean DEFAULT false NOT NULL,
	"paid_at" timestamp,
	"paid_amount" numeric(10, 2),
	"stripe_payment_id" text,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"tags" json,
	"last_modified" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "musician_clips" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"timeline_item_id" text NOT NULL,
	"musician_type" text NOT NULL,
	"character_description" text,
	"face_reference_url" text,
	"generated_image_url" text,
	"nano_banana_video_url" text,
	"script_context" text,
	"cut_timestamp" numeric(10, 2),
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "musicians" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"photo" text NOT NULL,
	"reference_photo" text,
	"instrument" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"rating" numeric(3, 2) DEFAULT '5.0' NOT NULL,
	"total_reviews" integer DEFAULT 0 NOT NULL,
	"genres" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"read" boolean DEFAULT false NOT NULL,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"artist_id" integer,
	"template_id" integer,
	"name" text NOT NULL,
	"description" text,
	"target_filters" json,
	"daily_limit" integer DEFAULT 20,
	"status" text DEFAULT 'draft',
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"paused_at" timestamp,
	"completed_at" timestamp,
	"total_contacts" integer DEFAULT 0,
	"emails_sent" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"emails_replied" integer DEFAULT 0,
	"emails_bounced" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_daily_quota" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"date" text NOT NULL,
	"emails_sent" integer DEFAULT 0,
	"daily_limit" integer DEFAULT 20,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"contact_id" integer NOT NULL,
	"template_id" integer,
	"to_email" text NOT NULL,
	"to_name" text,
	"subject" text NOT NULL,
	"status" text DEFAULT 'queued',
	"brevo_message_id" text,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"replied_at" timestamp,
	"bounced_at" timestamp,
	"error_message" text,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"body_html" text NOT NULL,
	"body_text" text,
	"type" text DEFAULT 'artist_intro',
	"variables" json DEFAULT '[]'::json,
	"times_used" integer DEFAULT 0,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_segments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"scene_id" integer NOT NULL,
	"start_time" numeric(10, 3) NOT NULL,
	"end_time" numeric(10, 3) NOT NULL,
	"duration" numeric(10, 3) NOT NULL,
	"lyrics" text,
	"shot_type" text,
	"audio_segment_url" text,
	"artist_image_url" text,
	"lipsync_video_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"artist_name" text NOT NULL,
	"artist_profile_url" text,
	"content_type" text NOT NULL,
	"content_title" text NOT NULL,
	"content_url" text,
	"target_media_types" text[],
	"target_countries" text[],
	"target_genres" text[],
	"pitch_message" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"media_contacted" integer DEFAULT 0 NOT NULL,
	"emails_opened" integer DEFAULT 0 NOT NULL,
	"media_replied" integer DEFAULT 0 NOT NULL,
	"interviews_booked" integer DEFAULT 0 NOT NULL,
	"make_scenario_id" text,
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_media_database" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"city" text,
	"genres" text[],
	"language" text NOT NULL,
	"email" text NOT NULL,
	"website_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"payload" json,
	"media_name" text,
	"media_email" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_tryon_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"merchandise_id" integer,
	"model_image" text NOT NULL,
	"result_image" text NOT NULL,
	"fal_model" text DEFAULT 'fal-ai/idm-vton' NOT NULL,
	"rating" integer,
	"feedback" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"quiz_id" integer NOT NULL,
	"score" integer NOT NULL,
	"total_points" integer NOT NULL,
	"passed" boolean NOT NULL,
	"answers" json,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"quiz_id" integer NOT NULL,
	"question" text NOT NULL,
	"question_type" text DEFAULT 'multiple_choice' NOT NULL,
	"options" json,
	"correct_answer" text NOT NULL,
	"explanation" text,
	"points" integer DEFAULT 1 NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "render_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"artist_profile_id" integer,
	"user_email" text NOT NULL,
	"artist_name" text NOT NULL,
	"song_name" text NOT NULL,
	"profile_slug" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_step" text,
	"progress" integer DEFAULT 0,
	"total_clips" integer DEFAULT 10,
	"processed_clips" integer DEFAULT 0,
	"timeline_data" json,
	"audio_url" text,
	"audio_duration" numeric(10, 2),
	"thumbnail_url" text,
	"aspect_ratio" text DEFAULT '16:9',
	"final_video_url" text,
	"shotstack_render_id" text,
	"firebase_video_url" text,
	"pending_webhook_sent" boolean DEFAULT false,
	"pending_webhook_sent_at" timestamp,
	"completed_webhook_sent" boolean DEFAULT false,
	"completed_webhook_sent_at" timestamp,
	"error_message" text,
	"error_step" text,
	"retry_count" integer DEFAULT 0,
	"max_retries" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sales_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"merchandise_id" integer,
	"product_name" text NOT NULL,
	"sale_amount" numeric(10, 2) NOT NULL,
	"production_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"artist_earning" numeric(10, 2) NOT NULL,
	"platform_fee" numeric(10, 2) NOT NULL,
	"commission_rate" integer DEFAULT 5 NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"buyer_email" text,
	"stripe_payment_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_media_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"platform" text NOT NULL,
	"caption" text NOT NULL,
	"hashtags" text[] NOT NULL,
	"cta" text NOT NULL,
	"viral_score" integer,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"audio_url" text NOT NULL,
	"duration" text,
	"release_date" timestamp,
	"genre" text,
	"mood" text,
	"lyrics" text,
	"cover_art" text,
	"artist_gender" text,
	"generated_with_ai" boolean DEFAULT false,
	"ai_provider" text,
	"is_published" boolean DEFAULT true NOT NULL,
	"plays" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spotify_curators" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"curator_name" text NOT NULL,
	"curator_type" text NOT NULL,
	"playlist_name" text,
	"playlist_focus" text,
	"playlist_url" text,
	"estimated_followers" text,
	"email" text,
	"instagram" text,
	"twitter" text,
	"website" text,
	"genre" text NOT NULL,
	"notes" text,
	"contacted" boolean DEFAULT false NOT NULL,
	"contacted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swap_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"pair_id" integer NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"token_in_id" integer NOT NULL,
	"token_out_id" integer NOT NULL,
	"amount_in" numeric(20, 8) NOT NULL,
	"amount_out" numeric(20, 8) NOT NULL,
	"price_impact" numeric(5, 2) DEFAULT '0' NOT NULL,
	"platform_fee_usd" numeric(10, 2) DEFAULT '0' NOT NULL,
	"lp_fee_usd" numeric(10, 2) DEFAULT '0' NOT NULL,
	"transaction_hash" varchar(66),
	"block_number" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "swap_history_transaction_hash_unique" UNIQUE("transaction_hash")
);
--> statement-breakpoint
CREATE TABLE "swap_pairs" (
	"id" serial PRIMARY KEY NOT NULL,
	"token1_id" integer NOT NULL,
	"token2_id" integer NOT NULL,
	"pair_address" varchar(42),
	"reserve1" numeric(20, 8) DEFAULT '0' NOT NULL,
	"reserve2" numeric(20, 8) DEFAULT '0' NOT NULL,
	"volume24h" numeric(20, 2) DEFAULT '0' NOT NULL,
	"fee_tier" integer DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "swap_pairs_pair_address_unique" UNIQUE("pair_address")
);
--> statement-breakpoint
CREATE TABLE "token_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"tokenized_song_id" integer NOT NULL,
	"buyer_wallet_address" varchar(42) NOT NULL,
	"buyer_user_id" integer,
	"amount_tokens" integer NOT NULL,
	"price_paid_eth" numeric(18, 8) NOT NULL,
	"price_paid_usd" numeric(10, 2),
	"artist_earnings_eth" numeric(18, 8) NOT NULL,
	"platform_earnings_eth" numeric(18, 8) NOT NULL,
	"transaction_hash" varchar(66) NOT NULL,
	"block_number" integer,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "token_purchases_transaction_hash_unique" UNIQUE("transaction_hash")
);
--> statement-breakpoint
CREATE TABLE "tokenized_songs" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"song_name" text NOT NULL,
	"song_url" text,
	"token_id" integer NOT NULL,
	"token_symbol" varchar(20) NOT NULL,
	"total_supply" integer NOT NULL,
	"available_supply" integer NOT NULL,
	"price_per_token_usd" numeric(10, 2) NOT NULL,
	"price_per_token_eth" numeric(18, 8),
	"royalty_percentage_artist" integer DEFAULT 80 NOT NULL,
	"royalty_percentage_platform" integer DEFAULT 20 NOT NULL,
	"contract_address" varchar(42) NOT NULL,
	"metadata_uri" text,
	"image_url" text,
	"description" text,
	"benefits" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tokenized_songs_token_id_unique" UNIQUE("token_id")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"subscription_id" integer,
	"product_id" integer,
	"course_id" integer,
	"invoice_number" text,
	"payment_method" text,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"stripe_transaction_id" text,
	"tax_amount" numeric(12, 2) DEFAULT '0',
	"discount_amount" numeric(12, 2) DEFAULT '0',
	"net_amount" numeric(12, 2) NOT NULL,
	"metadata" json,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_email" text NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_credits_user_email_unique" UNIQUE("user_email")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"permissions" json,
	"granted_by" integer,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"balance_before" numeric(10, 2) NOT NULL,
	"balance_after" numeric(10, 2) NOT NULL,
	"description" text NOT NULL,
	"related_sale_id" integer,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_users" DROP CONSTRAINT "social_users_username_unique";--> statement-breakpoint
ALTER TABLE "artist_media" DROP CONSTRAINT "artist_media_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "social_comments" DROP CONSTRAINT "social_comments_parent_id_social_comments_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "musician_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "social_comments" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "social_comments" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "social_comments" ALTER COLUMN "post_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "social_comments" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "social_comments" ALTER COLUMN "likes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "social_comments" ALTER COLUMN "is_reply" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "social_comments" ALTER COLUMN "parent_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "courses" ALTER COLUMN "thumbnail" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "social_posts" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "social_posts" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "social_posts" ALTER COLUMN "user_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "social_posts" ALTER COLUMN "likes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "social_users" ALTER COLUMN "id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "social_users" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "social_users" ALTER COLUMN "language" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "social_users" ALTER COLUMN "is_bot" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "stripe_subscription_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_media" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "artist_media" ADD COLUMN "is_published" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "artist_media" ADD COLUMN "views" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD COLUMN "drip_date" timestamp;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD COLUMN "drip_days_offset" integer;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD COLUMN "prerequisite_lesson_id" integer;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD COLUMN "is_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD COLUMN "generation_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "lessons_count" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "drip_strategy" text DEFAULT 'sequential' NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "is_ai_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "generation_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "platform_fee" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "musician_amount" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "liked_by" text[] DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "social_posts" ADD COLUMN "saved_by" text[] DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "social_users" ADD COLUMN "saved_posts" text[] DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "social_users" ADD COLUMN "liked_posts" text[] DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "current_period_start" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_at_period_end" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "interval" text DEFAULT 'monthly';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "currency" text DEFAULT 'usd';--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "is_trial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "granted_by_bundle" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "videos_limit" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "songs_limit" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "videos_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "songs_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "artists_generated_limit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "artists_generated_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "ai_generation_limit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "ai_generation_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "epk_limit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "epk_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "image_galleries_limit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "image_galleries_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "remove_boostify_logo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "customize_merchandise" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "commission_rate" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "clerk_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "replit_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_image_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "artist_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_image" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cover_image" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "banner_position" text DEFAULT '50';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "loop_video_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "real_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "genres" text[];--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "spotify_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "facebook_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tiktok_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "top_youtube_videos" json;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "concerts" json;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "firestore_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_ai_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "generated_by" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "record_label_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blockchain_network" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blockchain_artist_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blockchain_token_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blockchain_tx_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blockchain_contract" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "blockchain_registered_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_layout" json;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "affiliate_badges" ADD CONSTRAINT "affiliate_badges_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_link_id_affiliate_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_clicks" ADD CONSTRAINT "affiliate_clicks_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_link_id_affiliate_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."affiliate_links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_conversions" ADD CONSTRAINT "affiliate_conversions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_coupons" ADD CONSTRAINT "affiliate_coupons_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_earnings" ADD CONSTRAINT "affiliate_earnings_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_earnings" ADD CONSTRAINT "affiliate_earnings_conversion_id_affiliate_conversions_id_fk" FOREIGN KEY ("conversion_id") REFERENCES "public"."affiliate_conversions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_promotions" ADD CONSTRAINT "affiliate_promotions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_referrer_id_affiliates_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_referred_affiliate_id_affiliates_id_fk" FOREIGN KEY ("referred_affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_log" ADD CONSTRAINT "api_usage_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_news" ADD CONSTRAINT "artist_news_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_profile_images" ADD CONSTRAINT "artist_profile_images_artist_profile_id_users_id_fk" FOREIGN KEY ("artist_profile_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_profile_images" ADD CONSTRAINT "artist_profile_images_music_video_project_id_music_video_projects_id_fk" FOREIGN KEY ("music_video_project_id") REFERENCES "public"."music_video_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_token_earnings" ADD CONSTRAINT "artist_token_earnings_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_token_earnings" ADD CONSTRAINT "artist_token_earnings_tokenized_song_id_tokenized_songs_id_fk" FOREIGN KEY ("tokenized_song_id") REFERENCES "public"."tokenized_songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_token_earnings" ADD CONSTRAINT "artist_token_earnings_purchase_id_token_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."token_purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_wallet" ADD CONSTRAINT "artist_wallet_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_generation_queue" ADD CONSTRAINT "content_generation_queue_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_generation_queue" ADD CONSTRAINT "content_generation_queue_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_quizzes" ADD CONSTRAINT "course_quizzes_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crowdfunding_campaigns" ADD CONSTRAINT "crowdfunding_campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crowdfunding_contributions" ADD CONSTRAINT "crowdfunding_contributions_campaign_id_crowdfunding_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."crowdfunding_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fashion_analysis" ADD CONSTRAINT "fashion_analysis_session_id_fashion_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fashion_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fashion_analysis" ADD CONSTRAINT "fashion_analysis_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fashion_portfolio" ADD CONSTRAINT "fashion_portfolio_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fashion_results" ADD CONSTRAINT "fashion_results_session_id_fashion_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fashion_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fashion_results" ADD CONSTRAINT "fashion_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fashion_sessions" ADD CONSTRAINT "fashion_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fashion_videos" ADD CONSTRAINT "fashion_videos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fashion_videos" ADD CONSTRAINT "fashion_videos_session_id_fashion_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."fashion_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_connections" ADD CONSTRAINT "instagram_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investors" ADD CONSTRAINT "investors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_course_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."course_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidity_pools" ADD CONSTRAINT "liquidity_pools_pair_id_swap_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."swap_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidity_positions" ADD CONSTRAINT "liquidity_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liquidity_positions" ADD CONSTRAINT "liquidity_positions_pool_id_liquidity_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."liquidity_pools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchandise" ADD CONSTRAINT "merchandise_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_video_projects" ADD CONSTRAINT "music_video_projects_artist_profile_id_users_id_fk" FOREIGN KEY ("artist_profile_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musician_clips" ADD CONSTRAINT "musician_clips_project_id_music_video_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."music_video_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "musicians" ADD CONSTRAINT "musicians_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_campaigns" ADD CONSTRAINT "outreach_campaigns_template_id_outreach_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."outreach_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_daily_quota" ADD CONSTRAINT "outreach_daily_quota_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_email_log" ADD CONSTRAINT "outreach_email_log_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_email_log" ADD CONSTRAINT "outreach_email_log_contact_id_music_industry_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."music_industry_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_email_log" ADD CONSTRAINT "outreach_email_log_template_id_outreach_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."outreach_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_templates" ADD CONSTRAINT "outreach_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_campaigns" ADD CONSTRAINT "pr_campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_webhook_events" ADD CONSTRAINT "pr_webhook_events_campaign_id_pr_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."pr_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tryon_history" ADD CONSTRAINT "product_tryon_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tryon_history" ADD CONSTRAINT "product_tryon_history_merchandise_id_merchandise_id_fk" FOREIGN KEY ("merchandise_id") REFERENCES "public"."merchandise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_course_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."course_quizzes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_course_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."course_quizzes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_queue" ADD CONSTRAINT "render_queue_project_id_music_video_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."music_video_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "render_queue" ADD CONSTRAINT "render_queue_artist_profile_id_users_id_fk" FOREIGN KEY ("artist_profile_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_transactions" ADD CONSTRAINT "sales_transactions_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_transactions" ADD CONSTRAINT "sales_transactions_merchandise_id_merchandise_id_fk" FOREIGN KEY ("merchandise_id") REFERENCES "public"."merchandise"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_media_posts" ADD CONSTRAINT "social_media_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "songs" ADD CONSTRAINT "songs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_curators" ADD CONSTRAINT "spotify_curators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_history" ADD CONSTRAINT "swap_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_history" ADD CONSTRAINT "swap_history_pair_id_swap_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."swap_pairs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_history" ADD CONSTRAINT "swap_history_token_in_id_tokenized_songs_id_fk" FOREIGN KEY ("token_in_id") REFERENCES "public"."tokenized_songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_history" ADD CONSTRAINT "swap_history_token_out_id_tokenized_songs_id_fk" FOREIGN KEY ("token_out_id") REFERENCES "public"."tokenized_songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_pairs" ADD CONSTRAINT "swap_pairs_token1_id_tokenized_songs_id_fk" FOREIGN KEY ("token1_id") REFERENCES "public"."tokenized_songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "swap_pairs" ADD CONSTRAINT "swap_pairs_token2_id_tokenized_songs_id_fk" FOREIGN KEY ("token2_id") REFERENCES "public"."tokenized_songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_purchases" ADD CONSTRAINT "token_purchases_tokenized_song_id_tokenized_songs_id_fk" FOREIGN KEY ("tokenized_song_id") REFERENCES "public"."tokenized_songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_purchases" ADD CONSTRAINT "token_purchases_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokenized_songs" ADD CONSTRAINT "tokenized_songs_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_related_sale_id_sales_transactions_id_fk" FOREIGN KEY ("related_sale_id") REFERENCES "public"."sales_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_artist_earnings_artist" ON "artist_token_earnings" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_artist_earnings_song" ON "artist_token_earnings" USING btree ("tokenized_song_id");--> statement-breakpoint
CREATE INDEX "idx_artist_earnings_withdrawn" ON "artist_token_earnings" USING btree ("withdrawn_at");--> statement-breakpoint
CREATE INDEX "idx_liquidity_pools_pair" ON "liquidity_pools" USING btree ("pair_id");--> statement-breakpoint
CREATE INDEX "idx_liquidity_positions_user" ON "liquidity_positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_liquidity_positions_pool" ON "liquidity_positions" USING btree ("pool_id");--> statement-breakpoint
CREATE INDEX "idx_liquidity_positions_wallet" ON "liquidity_positions" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_industry_contacts_email" ON "music_industry_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_industry_contacts_category" ON "music_industry_contacts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_industry_contacts_status" ON "music_industry_contacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_industry_contacts_industry" ON "music_industry_contacts" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "idx_daily_quota_user_date" ON "outreach_daily_quota" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "idx_email_log_campaign" ON "outreach_email_log" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_email_log_contact" ON "outreach_email_log" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_email_log_status" ON "outreach_email_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_email_log_sent_at" ON "outreach_email_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_swap_history_user" ON "swap_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_swap_history_pair" ON "swap_history" USING btree ("pair_id");--> statement-breakpoint
CREATE INDEX "idx_swap_history_wallet" ON "swap_history" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "idx_swap_history_status" ON "swap_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_swap_pairs_tokens" ON "swap_pairs" USING btree ("token1_id","token2_id");--> statement-breakpoint
CREATE INDEX "idx_swap_pairs_active" ON "swap_pairs" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_token_purchases_song" ON "token_purchases" USING btree ("tokenized_song_id");--> statement-breakpoint
CREATE INDEX "idx_token_purchases_buyer" ON "token_purchases" USING btree ("buyer_wallet_address");--> statement-breakpoint
CREATE INDEX "idx_token_purchases_tx" ON "token_purchases" USING btree ("transaction_hash");--> statement-breakpoint
CREATE INDEX "idx_token_purchases_status" ON "token_purchases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tokenized_songs_artist" ON "tokenized_songs" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_tokenized_songs_token_id" ON "tokenized_songs" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "idx_tokenized_songs_active" ON "tokenized_songs" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "artist_media" ADD CONSTRAINT "artist_media_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_musician_id_musicians_id_fk" FOREIGN KEY ("musician_id") REFERENCES "public"."musicians"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" DROP COLUMN "lessons";--> statement-breakpoint
ALTER TABLE "social_posts" DROP COLUMN "media_url";--> statement-breakpoint
ALTER TABLE "social_posts" DROP COLUMN "shares";--> statement-breakpoint
ALTER TABLE "social_users" DROP COLUMN "username";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_replit_id_unique" UNIQUE("replit_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_slug_unique" UNIQUE("slug");