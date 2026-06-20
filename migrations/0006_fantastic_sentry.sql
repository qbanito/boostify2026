CREATE TABLE "aas_approval_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"action_type" text NOT NULL,
	"description" text NOT NULL,
	"agent" text NOT NULL,
	"estimated_cost" numeric(10, 2),
	"estimated_revenue" numeric(10, 2),
	"risk_level" text DEFAULT 'medium',
	"payload" json,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" integer,
	"decided_at" timestamp,
	"decision_note" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aas_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"lore" text,
	"voice_tone" text,
	"aesthetic_style" text,
	"brand_values" json,
	"moral_limits" json,
	"target_market" json,
	"pricing_tier" text DEFAULT 'mid',
	"products_enabled" json,
	"target_territories" json,
	"primary_language" text DEFAULT 'en',
	"quarterly_goals" json,
	"max_daily_budget" numeric(10, 2) DEFAULT '50.00',
	"max_outreach_per_day" integer DEFAULT 20,
	"require_approval_above" numeric(10, 2) DEFAULT '100.00',
	"allowed_channels" json,
	"blocked_actions" json,
	"survival_score" numeric(5, 2) DEFAULT '50.00',
	"last_cycle_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "aas_config_artist_id_unique" UNIQUE("artist_id")
);
--> statement-breakpoint
CREATE TABLE "aas_daily_action_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"cycle_date" text NOT NULL,
	"objectives" json,
	"planned_actions" json,
	"max_daily_budget" numeric(10, 2),
	"total_spent" numeric(10, 2) DEFAULT '0',
	"total_earned" numeric(10, 2) DEFAULT '0',
	"actions_completed" integer DEFAULT 0,
	"actions_failed" integer DEFAULT 0,
	"lessons_learned" json,
	"survival_score_before" numeric(5, 2),
	"survival_score_after" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aas_deal_pipeline" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"target_name" text NOT NULL,
	"target_role" text,
	"target_company" text,
	"target_email" text,
	"target_platform" text,
	"target_category" text NOT NULL,
	"stage" text DEFAULT 'identified',
	"estimated_value" numeric(10, 2),
	"deal_type" text,
	"last_contact_at" timestamp,
	"next_follow_up_at" timestamp,
	"touchpoints" integer DEFAULT 0,
	"notes" text,
	"last_message_sent" text,
	"requires_human_approval" boolean DEFAULT false,
	"approved_by" integer,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aas_strategic_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"category" text NOT NULL,
	"insight" text NOT NULL,
	"confidence" numeric(3, 2) DEFAULT '0.50',
	"evidence_count" integer DEFAULT 1,
	"last_validated_at" timestamp,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aas_survival_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"period" text NOT NULL,
	"period_type" text NOT NULL,
	"revenue_health" numeric(5, 2) DEFAULT '0',
	"pipeline_strength" numeric(5, 2) DEFAULT '0',
	"audience_momentum" numeric(5, 2) DEFAULT '0',
	"brand_relevance" numeric(5, 2) DEFAULT '0',
	"deal_velocity" numeric(5, 2) DEFAULT '0',
	"burn_rate" numeric(10, 2) DEFAULT '0',
	"legal_risk_score" numeric(5, 2) DEFAULT '0',
	"churn_rate" numeric(5, 2) DEFAULT '0',
	"content_fatigue" numeric(5, 2) DEFAULT '0',
	"survival_score" numeric(5, 2) NOT NULL,
	"total_revenue" numeric(10, 2) DEFAULT '0',
	"total_costs" numeric(10, 2) DEFAULT '0',
	"net_profit" numeric(10, 2) DEFAULT '0',
	"runway_days" integer DEFAULT 0,
	"new_fans" integer DEFAULT 0,
	"lost_fans" integer DEFAULT 0,
	"net_fan_growth" integer DEFAULT 0,
	"deals_opened" integer DEFAULT 0,
	"deals_closed" integer DEFAULT 0,
	"channel_performance" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "explicit_ai_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"type" text NOT NULL,
	"model" text NOT NULL,
	"prompt" text NOT NULL,
	"negative_prompt" text,
	"result_url" text,
	"thumbnail_url" text,
	"parameters" json,
	"cost_usd" numeric(10, 4),
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"published_as_content_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "explicit_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"receiver_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"message" text NOT NULL,
	"media_url" text,
	"media_type" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false,
	"tip_amount" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "explicit_content" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"media_url" text NOT NULL,
	"thumbnail_url" text,
	"blurred_preview_url" text,
	"is_paywalled" boolean DEFAULT true NOT NULL,
	"single_purchase_price" numeric(10, 2),
	"ai_model" text,
	"ai_prompt" text,
	"view_count" integer DEFAULT 0,
	"like_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "explicit_purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"buyer_id" integer NOT NULL,
	"content_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'usd',
	"stripe_payment_intent_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "explicit_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"monthly_price" numeric(10, 2) DEFAULT '9.99',
	"yearly_price" numeric(10, 2) DEFAULT '89.99',
	"single_content_price" numeric(10, 2) DEFAULT '4.99',
	"welcome_message" text,
	"content_categories" json DEFAULT '[]'::json,
	"chat_enabled" boolean DEFAULT true,
	"ai_generation_enabled" boolean DEFAULT true,
	"watermark_enabled" boolean DEFAULT true,
	"stripe_product_id" text,
	"stripe_monthly_price_id" text,
	"stripe_yearly_price_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "explicit_settings_artist_id_unique" UNIQUE("artist_id")
);
--> statement-breakpoint
CREATE TABLE "explicit_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscriber_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"plan" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"stripe_subscription_id" text,
	"stripe_customer_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "explicit_tips" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipper_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'usd',
	"message" text,
	"content_id" integer,
	"chat_message_id" integer,
	"stripe_payment_intent_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"subject" text,
	"preview_text" text,
	"html_content" text,
	"sender_name" text DEFAULT 'Boostify Music',
	"sender_email" text DEFAULT 'marketing@boostifymusic.com',
	"target_tags" json,
	"target_segment" text DEFAULT 'all',
	"social_platforms" json,
	"social_content" text,
	"social_image_url" text,
	"product_ids" json,
	"discount_code" text,
	"discount_percent" integer,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"total_recipients" integer DEFAULT 0,
	"emails_sent" integer DEFAULT 0,
	"emails_delivered" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_clicked" integer DEFAULT 0,
	"emails_bounced" integer DEFAULT 0,
	"emails_unsubscribed" integer DEFAULT 0,
	"conversions" integer DEFAULT 0,
	"revenue" numeric(10, 2) DEFAULT '0',
	"ai_generated_image" text,
	"ai_prompt_used" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"tags" json DEFAULT '[]'::json,
	"metadata" json,
	"status" text DEFAULT 'active' NOT NULL,
	"last_emailed_at" timestamp,
	"total_emails_sent" integer DEFAULT 0,
	"total_opens" integer DEFAULT 0,
	"total_clicks" integer DEFAULT 0,
	"total_purchases" integer DEFAULT 0,
	"total_spent" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"to_email" text NOT NULL,
	"brevo_message_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"bounced_at" timestamp,
	"error_message" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merch_contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"artist_revenue_share" numeric(5, 2) NOT NULL,
	"boostify_revenue_share" numeric(5, 2) NOT NULL,
	"platform_maintenance_fee" numeric(5, 2) DEFAULT '10' NOT NULL,
	"subscription_plan_at_signing" text NOT NULL,
	"artist_legal_name" text NOT NULL,
	"artist_stage_name" text NOT NULL,
	"artist_email" text NOT NULL,
	"artist_country" text,
	"status" text DEFAULT 'active' NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	"signature_hash" text NOT NULL,
	"ip_address" text,
	"printful_sync_enabled" boolean DEFAULT false,
	"printful_store_id" text,
	"terminated_at" timestamp,
	"termination_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aas_approval_queue" ADD CONSTRAINT "aas_approval_queue_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aas_config" ADD CONSTRAINT "aas_config_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aas_daily_action_log" ADD CONSTRAINT "aas_daily_action_log_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aas_deal_pipeline" ADD CONSTRAINT "aas_deal_pipeline_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aas_strategic_memory" ADD CONSTRAINT "aas_strategic_memory_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aas_survival_metrics" ADD CONSTRAINT "aas_survival_metrics_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_ai_generations" ADD CONSTRAINT "explicit_ai_generations_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_ai_generations" ADD CONSTRAINT "explicit_ai_generations_published_as_content_id_explicit_content_id_fk" FOREIGN KEY ("published_as_content_id") REFERENCES "public"."explicit_content"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_chat_messages" ADD CONSTRAINT "explicit_chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_chat_messages" ADD CONSTRAINT "explicit_chat_messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_chat_messages" ADD CONSTRAINT "explicit_chat_messages_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_content" ADD CONSTRAINT "explicit_content_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_purchases" ADD CONSTRAINT "explicit_purchases_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_purchases" ADD CONSTRAINT "explicit_purchases_content_id_explicit_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."explicit_content"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_purchases" ADD CONSTRAINT "explicit_purchases_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_settings" ADD CONSTRAINT "explicit_settings_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_subscriptions" ADD CONSTRAINT "explicit_subscriptions_subscriber_id_users_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_subscriptions" ADD CONSTRAINT "explicit_subscriptions_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_tips" ADD CONSTRAINT "explicit_tips_tipper_id_users_id_fk" FOREIGN KEY ("tipper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_tips" ADD CONSTRAINT "explicit_tips_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_tips" ADD CONSTRAINT "explicit_tips_content_id_explicit_content_id_fk" FOREIGN KEY ("content_id") REFERENCES "public"."explicit_content"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "explicit_tips" ADD CONSTRAINT "explicit_tips_chat_message_id_explicit_chat_messages_id_fk" FOREIGN KEY ("chat_message_id") REFERENCES "public"."explicit_chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_email_log" ADD CONSTRAINT "marketing_email_log_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_email_log" ADD CONSTRAINT "marketing_email_log_contact_id_marketing_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."marketing_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merch_contracts" ADD CONSTRAINT "merch_contracts_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_aas_approval_artist" ON "aas_approval_queue" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_aas_approval_status" ON "aas_approval_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_aas_config_artist" ON "aas_config" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_aas_config_enabled" ON "aas_config" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "idx_aas_action_log_artist" ON "aas_daily_action_log" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_aas_action_log_date" ON "aas_daily_action_log" USING btree ("cycle_date");--> statement-breakpoint
CREATE INDEX "idx_aas_deal_artist" ON "aas_deal_pipeline" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_aas_deal_stage" ON "aas_deal_pipeline" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "idx_aas_deal_category" ON "aas_deal_pipeline" USING btree ("target_category");--> statement-breakpoint
CREATE INDEX "idx_aas_memory_artist" ON "aas_strategic_memory" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_aas_memory_category" ON "aas_strategic_memory" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_aas_metrics_artist" ON "aas_survival_metrics" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_aas_metrics_period" ON "aas_survival_metrics" USING btree ("period");--> statement-breakpoint
CREATE INDEX "idx_explicit_ai_artist" ON "explicit_ai_generations" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_ai_status" ON "explicit_ai_generations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_explicit_ai_type" ON "explicit_ai_generations" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_explicit_chat_sender" ON "explicit_chat_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_chat_receiver" ON "explicit_chat_messages" USING btree ("receiver_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_chat_artist" ON "explicit_chat_messages" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_chat_created" ON "explicit_chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_explicit_content_artist" ON "explicit_content" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_content_type" ON "explicit_content" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_explicit_content_active" ON "explicit_content" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_explicit_purchases_buyer" ON "explicit_purchases" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_purchases_content" ON "explicit_purchases" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_purchases_artist" ON "explicit_purchases" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_settings_artist" ON "explicit_settings" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_subs_subscriber" ON "explicit_subscriptions" USING btree ("subscriber_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_subs_artist" ON "explicit_subscriptions" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_subs_status" ON "explicit_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_explicit_tips_tipper" ON "explicit_tips" USING btree ("tipper_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_tips_artist" ON "explicit_tips" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_explicit_tips_status" ON "explicit_tips" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mktg_campaigns_status" ON "marketing_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mktg_campaigns_type" ON "marketing_campaigns" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_mktg_contacts_email" ON "marketing_contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_mktg_contacts_status" ON "marketing_contacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mktg_contacts_source" ON "marketing_contacts" USING btree ("source");--> statement-breakpoint
CREATE INDEX "idx_mktg_email_log_campaign" ON "marketing_email_log" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_mktg_email_log_contact" ON "marketing_email_log" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_mktg_email_log_status" ON "marketing_email_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_merch_contracts_artist" ON "merch_contracts" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_merch_contracts_status" ON "merch_contracts" USING btree ("status");