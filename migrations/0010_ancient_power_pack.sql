CREATE TYPE "public"."defi_agent_type" AS ENUM('capital_keeper', 'flow_maker', 'alpha_hunter', 'shield_node');--> statement-breakpoint
CREATE TYPE "public"."operating_mode" AS ENUM('survival', 'stable', 'expansion', 'aggressive', 'defense');--> statement-breakpoint
CREATE TYPE "public"."risk_tolerance" AS ENUM('conservative', 'moderate', 'aggressive');--> statement-breakpoint
CREATE TYPE "public"."vault_bucket" AS ENUM('operation', 'reserve', 'growth', 'defi', 'boostify_fee');--> statement-breakpoint
CREATE TABLE "artist_economic_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"enabled_by" integer,
	"enabled_at" timestamp,
	"operating_mode" "operating_mode" DEFAULT 'stable' NOT NULL,
	"distribution_matrix" json,
	"defi_split" json,
	"defi_enabled" boolean DEFAULT true NOT NULL,
	"max_defi_exposure" numeric(12, 2) DEFAULT '10000.00',
	"risk_tolerance" "risk_tolerance" DEFAULT 'moderate' NOT NULL,
	"auto_rebalance" boolean DEFAULT true NOT NULL,
	"monthly_operating_cost" numeric(12, 2) DEFAULT '0.00',
	"last_cycle_at" timestamp,
	"last_audit_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artist_economic_profile_artist_id_unique" UNIQUE("artist_id")
);
--> statement-breakpoint
CREATE TABLE "artist_treasury_vault" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"operation_balance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"reserve_balance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"growth_balance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"defi_balance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"boostify_fee_balance" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_deposited" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_defi_profit" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"total_defi_loss" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"peak_defi_value" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"current_drawdown" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"last_rebalanced_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artist_treasury_vault_artist_id_unique" UNIQUE("artist_id")
);
--> statement-breakpoint
CREATE TABLE "brand_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"sender_type" text NOT NULL,
	"sender_user_id" integer,
	"message" text NOT NULL,
	"attachment_url" text,
	"attachment_type" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_songs" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"title" text NOT NULL,
	"audio_url" text,
	"lyrics" text,
	"genre" text DEFAULT 'pop',
	"mood" text DEFAULT 'upbeat',
	"duration" integer,
	"ai_model" text,
	"prompt" text,
	"status" text DEFAULT 'generating' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "defi_agent_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"agent_type" "defi_agent_type" NOT NULL,
	"action_type" text NOT NULL,
	"position_id" integer,
	"amount" numeric(14, 2),
	"reason" text,
	"risk_assessment" json,
	"outcome" text DEFAULT 'pending',
	"vetoed_by" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "defi_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"agent_type" "defi_agent_type" NOT NULL,
	"position_type" text NOT NULL,
	"protocol" text,
	"asset" text,
	"amount_invested" numeric(14, 2) NOT NULL,
	"current_value" numeric(14, 2) NOT NULL,
	"unrealized_pnl" numeric(14, 2) DEFAULT '0.00',
	"apy" numeric(8, 4),
	"risk_score" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "economic_engine_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer,
	"actor_id" integer,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"previous_state" json,
	"new_state" json,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "economic_engine_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"is_globally_enabled" boolean DEFAULT false NOT NULL,
	"default_distribution" json DEFAULT '{"operation":35,"reserve":20,"growth":20,"defi":20,"boostifyFee":5}'::json,
	"default_defi_split" json DEFAULT '{"capitalKeeper":40,"flowMaker":30,"alphaHunter":10,"shieldNode":20}'::json,
	"profit_cascade" json DEFAULT '{"reserve":40,"growth":30,"reinvestDefi":20,"performanceFee":10}'::json,
	"platform_fee_rate" numeric(5, 4) DEFAULT '0.0500',
	"performance_fee_rate" numeric(5, 4) DEFAULT '0.1000',
	"min_reserve_months" integer DEFAULT 3,
	"max_drawdown_pct" numeric(5, 2) DEFAULT '15.00',
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "news_comment_likes" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"parent_id" integer,
	"content" text NOT NULL,
	"likes" integer DEFAULT 0,
	"is_edited" boolean DEFAULT false,
	"is_pinned" boolean DEFAULT false,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_debate_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"debate_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"stance" text NOT NULL,
	"argument" text NOT NULL,
	"votes" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_debate_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"position_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "news_debates" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"topic" text NOT NULL,
	"description" text,
	"created_by" integer NOT NULL,
	"status" text DEFAULT 'open',
	"participant_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closes_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "news_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"reaction" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_engine_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"current_mode" "operating_mode" DEFAULT 'stable' NOT NULL,
	"previous_mode" "operating_mode",
	"mode_changed_at" timestamp,
	"mode_change_reason" text,
	"survival_score" numeric(5, 2),
	"health_score" numeric(5, 2),
	"reserve_months" numeric(5, 1),
	"total_exposure" numeric(14, 2) DEFAULT '0.00',
	"max_drawdown_hit" numeric(5, 2) DEFAULT '0.00',
	"shield_veto_active" boolean DEFAULT false NOT NULL,
	"shield_veto_reason" text,
	"last_evaluation_at" timestamp,
	"evaluation_data" json,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "risk_engine_state_artist_id_unique" UNIQUE("artist_id")
);
--> statement-breakpoint
CREATE TABLE "treasury_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"transaction_type" text NOT NULL,
	"from_bucket" "vault_bucket",
	"to_bucket" "vault_bucket",
	"amount" numeric(14, 2) NOT NULL,
	"balance_before" json,
	"balance_after" json,
	"description" text,
	"triggered_by" text DEFAULT 'system',
	"related_agent_type" "defi_agent_type",
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artist_business_plans" ADD COLUMN "roadmap_auto_update" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "artist_business_plans" ADD COLUMN "last_roadmap_sync" timestamp;--> statement-breakpoint
ALTER TABLE "artist_business_plans" ADD COLUMN "roadmap_execution_log" json;--> statement-breakpoint
ALTER TABLE "artist_business_plans" ADD COLUMN "linked_engine_mode" text;--> statement-breakpoint
ALTER TABLE "artist_economic_profile" ADD CONSTRAINT "artist_economic_profile_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_economic_profile" ADD CONSTRAINT "artist_economic_profile_enabled_by_users_id_fk" FOREIGN KEY ("enabled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_treasury_vault" ADD CONSTRAINT "artist_treasury_vault_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_messages" ADD CONSTRAINT "brand_messages_campaign_id_brand_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."brand_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_messages" ADD CONSTRAINT "brand_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_songs" ADD CONSTRAINT "campaign_songs_campaign_id_brand_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."brand_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defi_agent_actions" ADD CONSTRAINT "defi_agent_actions_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defi_agent_actions" ADD CONSTRAINT "defi_agent_actions_position_id_defi_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."defi_positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "defi_positions" ADD CONSTRAINT "defi_positions_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economic_engine_audit_log" ADD CONSTRAINT "economic_engine_audit_log_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economic_engine_audit_log" ADD CONSTRAINT "economic_engine_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economic_engine_config" ADD CONSTRAINT "economic_engine_config_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_comment_likes" ADD CONSTRAINT "news_comment_likes_comment_id_news_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."news_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_comment_likes" ADD CONSTRAINT "news_comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_comments" ADD CONSTRAINT "news_comments_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."news_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_comments" ADD CONSTRAINT "news_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_debate_positions" ADD CONSTRAINT "news_debate_positions_debate_id_news_debates_id_fk" FOREIGN KEY ("debate_id") REFERENCES "public"."news_debates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_debate_positions" ADD CONSTRAINT "news_debate_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_debate_votes" ADD CONSTRAINT "news_debate_votes_position_id_news_debate_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."news_debate_positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_debate_votes" ADD CONSTRAINT "news_debate_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_debates" ADD CONSTRAINT "news_debates_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."news_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_debates" ADD CONSTRAINT "news_debates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_reactions" ADD CONSTRAINT "news_reactions_article_id_news_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."news_articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_reactions" ADD CONSTRAINT "news_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_engine_state" ADD CONSTRAINT "risk_engine_state_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_transactions" ADD CONSTRAINT "treasury_transactions_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_artist_eco_profile_artist" ON "artist_economic_profile" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_artist_eco_profile_enabled" ON "artist_economic_profile" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_treasury_vault_artist" ON "artist_treasury_vault" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_brand_msg_campaign" ON "brand_messages" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_defi_action_artist" ON "defi_agent_actions" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_defi_action_agent" ON "defi_agent_actions" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "idx_defi_action_date" ON "defi_agent_actions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_defi_pos_artist" ON "defi_positions" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_defi_pos_agent" ON "defi_positions" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "idx_defi_pos_status" ON "defi_positions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_eco_audit_artist" ON "economic_engine_audit_log" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_eco_audit_date" ON "economic_engine_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ncl_comment" ON "news_comment_likes" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "idx_ncl_user" ON "news_comment_likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_news_comments_article" ON "news_comments" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_news_comments_user" ON "news_comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_news_comments_parent" ON "news_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_ndp_debate" ON "news_debate_positions" USING btree ("debate_id");--> statement-breakpoint
CREATE INDEX "idx_ndp_user" ON "news_debate_positions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ndv_position" ON "news_debate_votes" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "idx_ndv_user" ON "news_debate_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_news_debates_article" ON "news_debates" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_news_debates_status" ON "news_debates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_news_reactions_article" ON "news_reactions" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_news_reactions_user" ON "news_reactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_risk_state_artist" ON "risk_engine_state" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_tx_artist" ON "treasury_transactions" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_treasury_tx_type" ON "treasury_transactions" USING btree ("transaction_type");--> statement-breakpoint
CREATE INDEX "idx_treasury_tx_date" ON "treasury_transactions" USING btree ("created_at");