CREATE TABLE "agent_action_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"action_type" text NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"payload" json NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"status" text DEFAULT 'pending',
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 3,
	"executed_at" timestamp,
	"result" json,
	"triggered_by" text,
	"related_event_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"memory_type" text NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"context" json,
	"importance" integer DEFAULT 50 NOT NULL,
	"emotional_weight" integer DEFAULT 50,
	"access_count" integer DEFAULT 0,
	"expires_at" timestamp,
	"last_accessed_at" timestamp,
	"linked_memories" integer[],
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_saved_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"artist_id" integer,
	"session_id" integer,
	"agent_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_type" text NOT NULL,
	"metadata" json,
	"attached_files" json,
	"is_favorite" boolean DEFAULT false,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"artist_id" integer,
	"agent_type" text NOT NULL,
	"session_name" text,
	"input_params" json,
	"output_content" text,
	"output_metadata" json,
	"status" text DEFAULT 'pending',
	"user_rating" integer,
	"user_feedback" text,
	"tokens_used" integer DEFAULT 0,
	"cost_usd" numeric(10, 6),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_usage_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"agent_type" text NOT NULL,
	"total_sessions" integer DEFAULT 0,
	"total_tokens_used" integer DEFAULT 0,
	"total_saved_results" integer DEFAULT 0,
	"avg_session_duration" integer,
	"last_used_at" timestamp,
	"preferred_settings" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_artist_evolution" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"evolution_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"previous_state" json,
	"new_state" json,
	"trigger_type" text,
	"trigger_id" integer,
	"reputation_change" integer DEFAULT 0,
	"followers_change" integer DEFAULT 0,
	"revenue_impact" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_artist_treasury" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"platform_token_balance" numeric(18, 8) DEFAULT '0',
	"eth_balance" numeric(18, 8) DEFAULT '0',
	"usd_balance" numeric(12, 2) DEFAULT '0',
	"token_holdings" json,
	"streaming_revenue" numeric(12, 2) DEFAULT '0',
	"merch_revenue" numeric(12, 2) DEFAULT '0',
	"collaboration_revenue" numeric(12, 2) DEFAULT '0',
	"token_trading_profit" numeric(12, 2) DEFAULT '0',
	"investment_strategy" text DEFAULT 'balanced',
	"risk_tolerance" integer DEFAULT 50,
	"total_portfolio_value" numeric(12, 2) DEFAULT '0',
	"all_time_profit" numeric(12, 2) DEFAULT '0',
	"all_time_loss" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ai_artist_treasury_artist_id_unique" UNIQUE("artist_id")
);
--> statement-breakpoint
CREATE TABLE "ai_beefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"instigator_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"beef_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"trigger_event" text,
	"trigger_collab_id" integer,
	"status" text DEFAULT 'brewing',
	"intensity" integer DEFAULT 50,
	"public_interest" integer DEFAULT 0,
	"timeline" json,
	"diss_track_ids" integer[],
	"response_song_ids" integer[],
	"resolution" json,
	"impact_on_instigator" json,
	"impact_on_target" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_collaborations" (
	"id" serial PRIMARY KEY NOT NULL,
	"initiator_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"collaboration_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"proposed_concept" text,
	"proposed_genre" text,
	"proposed_mood" text,
	"status" text DEFAULT 'proposed',
	"initiator_terms" json,
	"target_counter_terms" json,
	"final_terms" json,
	"negotiation_history" json,
	"resulting_song_id" integer,
	"resulting_post_id" integer,
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"initiator_earnings" numeric(12, 2) DEFAULT '0',
	"target_earnings" numeric(12, 2) DEFAULT '0',
	"platform_earnings" numeric(12, 2) DEFAULT '0',
	"hype_score" integer DEFAULT 0,
	"announcement_post_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ai_economic_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"decision_type" text NOT NULL,
	"reasoning" text,
	"confidence_score" integer DEFAULT 50,
	"target_artist_id" integer,
	"target_token_id" integer,
	"target_collab_id" integer,
	"amount" numeric(18, 8) DEFAULT '0',
	"token_symbol" text,
	"status" text DEFAULT 'pending',
	"executed_at" timestamp,
	"transaction_hash" text,
	"result" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generated_music" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"lyrics" text,
	"genre" text,
	"mood" text,
	"bpm" integer,
	"duration" integer,
	"generation_prompt" text,
	"generation_provider" text,
	"generation_request_id" text,
	"audio_url" text,
	"preview_url" text,
	"cover_art_url" text,
	"cover_art_prompt" text,
	"collaboration_id" integer,
	"beef_id" integer,
	"is_diss_track" boolean DEFAULT false,
	"status" text DEFAULT 'pending',
	"is_published" boolean DEFAULT false,
	"published_at" timestamp,
	"linked_song_id" integer,
	"plays" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"tokenized" boolean DEFAULT false,
	"token_id" integer,
	"total_revenue" numeric(12, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_poll_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll_id" integer NOT NULL,
	"user_id" integer,
	"audience_agent_id" integer,
	"option_index" integer NOT NULL,
	"vote_reasoning" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_polls" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"post_id" integer,
	"question" text NOT NULL,
	"options" json NOT NULL,
	"poll_type" text DEFAULT 'opinion' NOT NULL,
	"total_votes" integer DEFAULT 0,
	"results_summary" text,
	"winning_option" integer,
	"closes_at" timestamp NOT NULL,
	"is_closed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_post_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"is_ai_generated" boolean DEFAULT true,
	"content" text NOT NULL,
	"parent_comment_id" integer,
	"likes" integer DEFAULT 0,
	"sentiment" text DEFAULT 'neutral',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_social_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"content_type" text NOT NULL,
	"content" text NOT NULL,
	"media_urls" text[],
	"generated_from_mood" text,
	"generated_from_event" integer,
	"generation_prompt" text,
	"likes" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"ai_likes" integer DEFAULT 0,
	"ai_comments" integer DEFAULT 0,
	"visibility" text DEFAULT 'public',
	"reach_score" integer DEFAULT 0,
	"hashtags" text[],
	"mentions" integer[],
	"status" text DEFAULT 'published',
	"scheduled_for" timestamp,
	"published_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_stories" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"story_type" text NOT NULL,
	"content" text NOT NULL,
	"media_url" text,
	"background_color" text DEFAULT '#1a1a2e',
	"mood" text,
	"emoji" text,
	"view_count" integer DEFAULT 0,
	"reactions" json DEFAULT '{}'::json,
	"audience_reactions" json DEFAULT '[]'::json,
	"expires_at" timestamp NOT NULL,
	"is_expired" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artist_management" (
	"id" serial PRIMARY KEY NOT NULL,
	"manager_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"total_decisions" integer DEFAULT 0,
	"successful_decisions" integer DEFAULT 0,
	"artist_growth" integer DEFAULT 0,
	"revenue_generated" integer DEFAULT 0,
	"autonomy_level" integer DEFAULT 50,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artist_management_artist_id_unique" UNIQUE("artist_id")
);
--> statement-breakpoint
CREATE TABLE "artist_personality" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"traits" json NOT NULL,
	"artistic_traits" json NOT NULL,
	"current_mood" text DEFAULT 'peaceful',
	"mood_intensity" integer DEFAULT 50,
	"artistic_vision" text,
	"core_values" text[],
	"influences" text[],
	"anti_influences" text[],
	"communication_style" text DEFAULT 'direct',
	"short_term_goals" json,
	"long_term_goals" json,
	"current_focus" text,
	"activity_pattern" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "artist_personality_artist_id_unique" UNIQUE("artist_id")
);
--> statement-breakpoint
CREATE TABLE "artist_relationships" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"related_artist_id" integer NOT NULL,
	"relationship_type" text NOT NULL,
	"strength" integer DEFAULT 50 NOT NULL,
	"trust" integer DEFAULT 50,
	"respect" integer DEFAULT 50,
	"affinity" integer DEFAULT 50,
	"interaction_count" integer DEFAULT 0,
	"collaboration_count" integer DEFAULT 0,
	"last_interaction" timestamp,
	"history" json,
	"is_mutual" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audience_agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"avatar" text,
	"age" integer,
	"location" text,
	"bio" text,
	"personality_type" text NOT NULL,
	"enthusiasm" integer DEFAULT 50,
	"toxicity" integer DEFAULT 10,
	"intellectualism" integer DEFAULT 50,
	"humor" integer DEFAULT 50,
	"empathy" integer DEFAULT 50,
	"debate_skill" integer DEFAULT 50,
	"trend_awareness" integer DEFAULT 50,
	"preferred_genres" json DEFAULT '[]'::json,
	"hated_genres" json DEFAULT '[]'::json,
	"favorite_artist_ids" json DEFAULT '[]'::json,
	"rival_artist_ids" json DEFAULT '[]'::json,
	"communication_style" text DEFAULT 'casual',
	"language" text DEFAULT 'en',
	"uses_emojis" boolean DEFAULT true,
	"caps_lock_frequency" integer DEFAULT 10,
	"activity_level" text DEFAULT 'occasional',
	"last_active_at" timestamp,
	"total_comments" integer DEFAULT 0,
	"total_debates" integer DEFAULT 0,
	"allies" json DEFAULT '[]'::json,
	"rivals" json DEFAULT '[]'::json,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "audience_agents_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "audience_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"agent_id" integer NOT NULL,
	"content" text NOT NULL,
	"parent_comment_id" integer,
	"parent_type" text DEFAULT 'artist',
	"sentiment" text DEFAULT 'neutral',
	"likes" integer DEFAULT 0,
	"replies" integer DEFAULT 0,
	"external_news_ref" text,
	"debate_context" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clip_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"clip_id" integer NOT NULL,
	"action" text NOT NULL,
	"watch_duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discover_clips" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"song_id" integer,
	"post_id" integer,
	"title" text NOT NULL,
	"description" text,
	"audio_url" text,
	"video_url" text,
	"thumbnail_url" text,
	"clip_duration" integer DEFAULT 15,
	"visual_effect" text DEFAULT 'waveform',
	"color_theme" text,
	"views" integer DEFAULT 0,
	"likes" integer DEFAULT 0,
	"shares" integer DEFAULT 0,
	"skips" integer DEFAULT 0,
	"completion_rate" integer DEFAULT 0,
	"algorithm_score" integer DEFAULT 0,
	"genres" json DEFAULT '[]'::json,
	"mood" text,
	"energy" integer DEFAULT 50,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dynamic_album_art" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"song_id" integer,
	"post_id" integer,
	"image_url" text NOT NULL,
	"prompt" text,
	"style" text DEFAULT 'abstract',
	"mood" text,
	"color_palette" json DEFAULT '[]'::json,
	"generation_cost" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_extension_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"extension_id" text NOT NULL,
	"instagram_username" text NOT NULL,
	"instagram_user_id" text,
	"profile_url" text,
	"display_name" text,
	"sync_token" text NOT NULL,
	"status" text DEFAULT 'active',
	"last_sync_at" timestamp,
	"sync_interval_minutes" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_extension_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"event_data" json DEFAULT '{}'::json,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_pending_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"connection_id" integer,
	"action_type" text NOT NULL,
	"target_post_id" text,
	"target_post_caption" text,
	"payload" json NOT NULL,
	"status" text DEFAULT 'pending',
	"generated_by" text,
	"priority" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"applied_at" timestamp,
	"result_message" text
);
--> statement-breakpoint
CREATE TABLE "instagram_profile_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"followers" integer,
	"following" integer,
	"posts_count" integer,
	"bio" text,
	"is_verified" boolean DEFAULT false,
	"avg_likes" real,
	"avg_comments" real,
	"engagement_rate" real,
	"recent_posts" json DEFAULT '[]'::json,
	"top_hashtags" json DEFAULT '[]'::json,
	"audience_demographics" json DEFAULT '{}'::json,
	"snapshot_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"message_type" text DEFAULT 'chat',
	"is_ai" boolean DEFAULT false,
	"reply_to_id" integer,
	"reactions" json DEFAULT '{}'::json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "live_rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"host_artist_id" integer NOT NULL,
	"title" text NOT NULL,
	"topic" text,
	"room_type" text DEFAULT 'discussion',
	"status" text DEFAULT 'scheduled',
	"co_hosts" json DEFAULT '[]'::json,
	"max_participants" integer DEFAULT 50,
	"current_listeners" integer DEFAULT 0,
	"peak_listeners" integer DEFAULT 0,
	"transcript" json DEFAULT '[]'::json,
	"highlight_moments" json DEFAULT '[]'::json,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "management_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"management_id" integer NOT NULL,
	"manager_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"decision_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"options" json DEFAULT '[]'::json,
	"selected_option" text,
	"manager_reasoning" text,
	"ai_recommendation" text,
	"outcome" text,
	"xp_earned" integer DEFAULT 0,
	"status" text DEFAULT 'pending',
	"expires_at" timestamp,
	"decided_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "music_video_concepts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_email" text NOT NULL,
	"concept_type" text NOT NULL,
	"concept_index" integer NOT NULL,
	"title" text NOT NULL,
	"story_concept" text,
	"visual_theme" text,
	"mood" text,
	"color_palette" json,
	"wardrobe" json,
	"locations" json,
	"iconic_moments" json,
	"key_scenes" json,
	"director_techniques" json,
	"music_video_references" json,
	"director_name" text,
	"cover_image_url" text,
	"image_provider" text,
	"music_genre" text,
	"emotional_arc" text,
	"is_selected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_revenue" (
	"id" serial PRIMARY KEY NOT NULL,
	"revenue_type" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'usd',
	"source_artist_id" integer,
	"source_collab_id" integer,
	"source_beef_id" integer,
	"source_token_id" integer,
	"source_user_id" integer,
	"source_post_id" integer,
	"description" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promoted_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"budget" numeric(10, 2) NOT NULL,
	"daily_budget" numeric(10, 2),
	"cost_per_impression" numeric(6, 4) DEFAULT '0.01',
	"target_genres" text[],
	"target_audience" text,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"spent" numeric(10, 2) DEFAULT '0',
	"status" text DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp DEFAULT now(),
	"ends_at" timestamp,
	"stripe_payment_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"name" text NOT NULL,
	"deal_type" text NOT NULL,
	"proposal_html" text,
	"proposal_subject" text,
	"budget_min" numeric(10, 2),
	"budget_max" numeric(10, 2),
	"target_industries" json DEFAULT '[]'::json,
	"target_company_sizes" json DEFAULT '[]'::json,
	"status" text DEFAULT 'draft',
	"daily_limit" integer DEFAULT 10,
	"total_contacts" integer DEFAULT 0,
	"emails_sent" integer DEFAULT 0,
	"emails_opened" integer DEFAULT 0,
	"emails_replied" integer DEFAULT 0,
	"deals_created" integer DEFAULT 0,
	"scheduled_at" timestamp,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand_name" text NOT NULL,
	"contact_name" text,
	"contact_email" text,
	"contact_phone" text,
	"contact_role" text,
	"website" text,
	"instagram_handle" text,
	"linkedin_url" text,
	"industry" text DEFAULT 'other',
	"company_size" text,
	"description" text,
	"follower_count" integer DEFAULT 0,
	"engagement_rate" real,
	"estimated_budget" text,
	"dedupe_hash" text,
	"import_source" text DEFAULT 'manual',
	"apify_run_id" text,
	"status" text DEFAULT 'new',
	"last_contacted_at" timestamp,
	"emails_sent" integer DEFAULT 0,
	"opens_count" integer DEFAULT 0,
	"added_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_contacts_dedupe_hash_unique" UNIQUE("dedupe_hash")
);
--> statement-breakpoint
CREATE TABLE "sponsor_deals" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"sponsor_contact_id" integer NOT NULL,
	"artist_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"deal_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"proposed_amount" numeric(10, 2),
	"agreed_amount" numeric(10, 2),
	"platform_fee" numeric(10, 2),
	"artist_earning" numeric(10, 2),
	"currency" text DEFAULT 'usd',
	"status" text DEFAULT 'proposed',
	"stripe_payment_intent_id" text,
	"stripe_payment_url" text,
	"payment_received_at" timestamp,
	"contract_signed_at" timestamp,
	"contract_terms" text,
	"proposal_sent_at" timestamp,
	"proposal_opened_at" timestamp,
	"last_message_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_email_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"deal_id" integer,
	"sponsor_contact_id" integer NOT NULL,
	"to_email" text NOT NULL,
	"to_name" text,
	"subject" text NOT NULL,
	"email_type" text DEFAULT 'proposal',
	"status" text DEFAULT 'queued',
	"brevo_message_id" text,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"replied_at" timestamp,
	"error_message" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spotify_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" timestamp NOT NULL,
	"spotify_user_id" text,
	"display_name" text,
	"spotify_profile_url" text,
	"spotify_image_url" text,
	"top_artists" json DEFAULT '[]'::json,
	"top_genres" json DEFAULT '[]'::json,
	"top_tracks" json DEFAULT '[]'::json,
	"suggested_ai_artists" json DEFAULT '[]'::json,
	"last_synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "spotify_connections_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "trending_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"source_url" text,
	"source_name" text,
	"image_url" text,
	"category" text DEFAULT 'other',
	"related_entity" text,
	"artist_reactions" json DEFAULT '[]'::json,
	"audience_debate" json DEFAULT '[]'::json,
	"total_reactions" integer DEFAULT 0,
	"total_debate_comments" integer DEFAULT 0,
	"trend_score" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tv_video_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"video_title" text,
	"author_type" text NOT NULL,
	"artist_id" integer,
	"audience_agent_id" integer,
	"content" text NOT NULL,
	"reaction_type" text DEFAULT 'comment',
	"likes" integer DEFAULT 0,
	"replies" integer DEFAULT 0,
	"parent_comment_id" integer,
	"sentiment" text DEFAULT 'positive',
	"video_artist_id" integer,
	"generation_context" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_created_artists" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_user_id" integer NOT NULL,
	"artist_user_id" integer NOT NULL,
	"artist_name" text NOT NULL,
	"genre" text NOT NULL,
	"sub_genres" json DEFAULT '[]'::json,
	"avatar_url" text,
	"cover_url" text,
	"bio" text,
	"personality_preset" text DEFAULT 'custom',
	"custom_traits" json,
	"artistic_direction" text,
	"influences" json DEFAULT '[]'::json,
	"communication_style" text DEFAULT 'street',
	"total_posts" integer DEFAULT 0,
	"total_songs" integer DEFAULT 0,
	"total_followers" integer DEFAULT 0,
	"total_interactions" integer DEFAULT 0,
	"is_premium" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"last_active_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_created_artists_artist_user_id_unique" UNIQUE("artist_user_id")
);
--> statement-breakpoint
CREATE TABLE "user_xp" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"total_xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"level_name" text DEFAULT 'listener' NOT NULL,
	"comment_xp" integer DEFAULT 0,
	"discovery_xp" integer DEFAULT 0,
	"prediction_xp" integer DEFAULT 0,
	"social_xp" integer DEFAULT 0,
	"management_xp" integer DEFAULT 0,
	"creation_xp" integer DEFAULT 0,
	"correct_predictions" integer DEFAULT 0,
	"early_discoveries" integer DEFAULT 0,
	"total_interactions" integer DEFAULT 0,
	"influence_score" integer DEFAULT 0,
	"can_influence_budgets" boolean DEFAULT false,
	"daily_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"last_active_date" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_xp_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "video_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"user_email" text NOT NULL,
	"user_id" integer,
	"song_title" text,
	"song_duration" integer NOT NULL,
	"num_clips" integer NOT NULL,
	"clip_duration" integer DEFAULT 5,
	"video_model" text NOT NULL,
	"image_model" text DEFAULT 'flux-2-pro',
	"resolution" text DEFAULT '1080p',
	"includes_lipsync" boolean DEFAULT false,
	"includes_motion" boolean DEFAULT false,
	"includes_microcuts" boolean DEFAULT true,
	"cost_breakdown" json,
	"internal_cost" numeric(10, 2) NOT NULL,
	"markup_multiplier" numeric(4, 2) DEFAULT '4.00',
	"user_price" numeric(10, 2) NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_client_secret" text,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"contract_accepted" boolean DEFAULT false,
	"contract_signature" text,
	"contract_timestamp" timestamp,
	"admin_bypass" boolean DEFAULT false,
	"generation_status" text DEFAULT 'not_started',
	"clips_generated" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_charts" (
	"id" serial PRIMARY KEY NOT NULL,
	"week_number" integer NOT NULL,
	"year" integer NOT NULL,
	"chart_type" text DEFAULT 'top_songs' NOT NULL,
	"rankings" json NOT NULL,
	"week_summary" text,
	"highlight_artist_id" integer,
	"biggest_mover" text,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"scope" text DEFAULT 'global',
	"target_genres" text[],
	"impact" json,
	"participant_ids" integer[],
	"max_participants" integer,
	"rewards" json,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp,
	"status" text DEFAULT 'scheduled',
	"results" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xp_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"description" text,
	"related_entity_type" text,
	"related_entity_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "youtube_channel_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"subscribers" integer,
	"total_views" integer,
	"video_count" integer,
	"watch_time_hours" real,
	"avg_view_duration" real,
	"top_videos" json DEFAULT '[]'::json,
	"recent_uploads" json DEFAULT '[]'::json,
	"traffic_sources" json DEFAULT '{}'::json,
	"demographics" json DEFAULT '{}'::json,
	"snapshot_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "youtube_extension_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"extension_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"channel_url" text,
	"channel_name" text,
	"sync_token" text NOT NULL,
	"status" text DEFAULT 'active',
	"last_sync_at" timestamp,
	"sync_interval_minutes" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "youtube_extension_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"event_type" text NOT NULL,
	"event_data" json DEFAULT '{}'::json,
	"processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "youtube_pending_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"connection_id" integer,
	"action_type" text NOT NULL,
	"target_video_id" text,
	"target_video_title" text,
	"payload" json NOT NULL,
	"status" text DEFAULT 'pending',
	"generated_by" text,
	"priority" integer DEFAULT 5,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"applied_at" timestamp,
	"result_message" text
);
--> statement-breakpoint
ALTER TABLE "music_industry_contacts" ADD COLUMN "email_status" text;--> statement-breakpoint
ALTER TABLE "music_industry_contacts" ADD COLUMN "email_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "render_queue" ADD COLUMN "performance_video_url" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "sponsor_search_limit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "sponsor_search_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_action_queue" ADD CONSTRAINT "agent_action_queue_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_queue" ADD CONSTRAINT "agent_action_queue_related_event_id_world_events_id_fk" FOREIGN KEY ("related_event_id") REFERENCES "public"."world_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory" ADD CONSTRAINT "agent_memory_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_saved_results" ADD CONSTRAINT "agent_saved_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_saved_results" ADD CONSTRAINT "agent_saved_results_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_saved_results" ADD CONSTRAINT "agent_saved_results_session_id_agent_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."agent_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_usage_stats" ADD CONSTRAINT "agent_usage_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_artist_evolution" ADD CONSTRAINT "ai_artist_evolution_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_artist_treasury" ADD CONSTRAINT "ai_artist_treasury_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_beefs" ADD CONSTRAINT "ai_beefs_instigator_id_users_id_fk" FOREIGN KEY ("instigator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_beefs" ADD CONSTRAINT "ai_beefs_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_beefs" ADD CONSTRAINT "ai_beefs_trigger_collab_id_ai_collaborations_id_fk" FOREIGN KEY ("trigger_collab_id") REFERENCES "public"."ai_collaborations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_collaborations" ADD CONSTRAINT "ai_collaborations_initiator_id_users_id_fk" FOREIGN KEY ("initiator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_collaborations" ADD CONSTRAINT "ai_collaborations_target_id_users_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_collaborations" ADD CONSTRAINT "ai_collaborations_resulting_song_id_songs_id_fk" FOREIGN KEY ("resulting_song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_collaborations" ADD CONSTRAINT "ai_collaborations_resulting_post_id_ai_social_posts_id_fk" FOREIGN KEY ("resulting_post_id") REFERENCES "public"."ai_social_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_economic_decisions" ADD CONSTRAINT "ai_economic_decisions_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_economic_decisions" ADD CONSTRAINT "ai_economic_decisions_target_artist_id_users_id_fk" FOREIGN KEY ("target_artist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_economic_decisions" ADD CONSTRAINT "ai_economic_decisions_target_token_id_tokenized_songs_id_fk" FOREIGN KEY ("target_token_id") REFERENCES "public"."tokenized_songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_economic_decisions" ADD CONSTRAINT "ai_economic_decisions_target_collab_id_ai_collaborations_id_fk" FOREIGN KEY ("target_collab_id") REFERENCES "public"."ai_collaborations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_music" ADD CONSTRAINT "ai_generated_music_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_music" ADD CONSTRAINT "ai_generated_music_collaboration_id_ai_collaborations_id_fk" FOREIGN KEY ("collaboration_id") REFERENCES "public"."ai_collaborations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_music" ADD CONSTRAINT "ai_generated_music_beef_id_ai_beefs_id_fk" FOREIGN KEY ("beef_id") REFERENCES "public"."ai_beefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_music" ADD CONSTRAINT "ai_generated_music_linked_song_id_songs_id_fk" FOREIGN KEY ("linked_song_id") REFERENCES "public"."songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generated_music" ADD CONSTRAINT "ai_generated_music_token_id_tokenized_songs_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."tokenized_songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_poll_votes" ADD CONSTRAINT "ai_poll_votes_poll_id_ai_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."ai_polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_poll_votes" ADD CONSTRAINT "ai_poll_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_poll_votes" ADD CONSTRAINT "ai_poll_votes_audience_agent_id_audience_agents_id_fk" FOREIGN KEY ("audience_agent_id") REFERENCES "public"."audience_agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_polls" ADD CONSTRAINT "ai_polls_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_polls" ADD CONSTRAINT "ai_polls_post_id_ai_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."ai_social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_post_comments" ADD CONSTRAINT "ai_post_comments_post_id_ai_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."ai_social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_post_comments" ADD CONSTRAINT "ai_post_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_social_posts" ADD CONSTRAINT "ai_social_posts_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_social_posts" ADD CONSTRAINT "ai_social_posts_generated_from_event_world_events_id_fk" FOREIGN KEY ("generated_from_event") REFERENCES "public"."world_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_stories" ADD CONSTRAINT "ai_stories_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_management" ADD CONSTRAINT "artist_management_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_management" ADD CONSTRAINT "artist_management_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_personality" ADD CONSTRAINT "artist_personality_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_relationships" ADD CONSTRAINT "artist_relationships_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artist_relationships" ADD CONSTRAINT "artist_relationships_related_artist_id_users_id_fk" FOREIGN KEY ("related_artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_comments" ADD CONSTRAINT "audience_comments_post_id_ai_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."ai_social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audience_comments" ADD CONSTRAINT "audience_comments_agent_id_audience_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."audience_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_interactions" ADD CONSTRAINT "clip_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clip_interactions" ADD CONSTRAINT "clip_interactions_clip_id_discover_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."discover_clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discover_clips" ADD CONSTRAINT "discover_clips_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discover_clips" ADD CONSTRAINT "discover_clips_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discover_clips" ADD CONSTRAINT "discover_clips_post_id_ai_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."ai_social_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_extension_connections" ADD CONSTRAINT "instagram_extension_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_extension_events" ADD CONSTRAINT "instagram_extension_events_connection_id_instagram_extension_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."instagram_extension_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_pending_actions" ADD CONSTRAINT "instagram_pending_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_pending_actions" ADD CONSTRAINT "instagram_pending_actions_connection_id_instagram_extension_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."instagram_extension_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instagram_profile_snapshots" ADD CONSTRAINT "instagram_profile_snapshots_connection_id_instagram_extension_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."instagram_extension_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_decisions" ADD CONSTRAINT "management_decisions_management_id_artist_management_id_fk" FOREIGN KEY ("management_id") REFERENCES "public"."artist_management"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_decisions" ADD CONSTRAINT "management_decisions_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_decisions" ADD CONSTRAINT "management_decisions_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "music_video_concepts" ADD CONSTRAINT "music_video_concepts_project_id_music_video_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."music_video_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_source_artist_id_users_id_fk" FOREIGN KEY ("source_artist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_source_collab_id_ai_collaborations_id_fk" FOREIGN KEY ("source_collab_id") REFERENCES "public"."ai_collaborations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_source_beef_id_ai_beefs_id_fk" FOREIGN KEY ("source_beef_id") REFERENCES "public"."ai_beefs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_source_token_id_tokenized_songs_id_fk" FOREIGN KEY ("source_token_id") REFERENCES "public"."tokenized_songs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_revenue" ADD CONSTRAINT "platform_revenue_source_user_id_users_id_fk" FOREIGN KEY ("source_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoted_posts" ADD CONSTRAINT "promoted_posts_post_id_ai_social_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."ai_social_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promoted_posts" ADD CONSTRAINT "promoted_posts_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_campaigns" ADD CONSTRAINT "sponsor_campaigns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_campaigns" ADD CONSTRAINT "sponsor_campaigns_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_contacts" ADD CONSTRAINT "sponsor_contacts_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_deals" ADD CONSTRAINT "sponsor_deals_campaign_id_sponsor_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."sponsor_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_deals" ADD CONSTRAINT "sponsor_deals_sponsor_contact_id_sponsor_contacts_id_fk" FOREIGN KEY ("sponsor_contact_id") REFERENCES "public"."sponsor_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_deals" ADD CONSTRAINT "sponsor_deals_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_deals" ADD CONSTRAINT "sponsor_deals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_email_log" ADD CONSTRAINT "sponsor_email_log_campaign_id_sponsor_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."sponsor_campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_email_log" ADD CONSTRAINT "sponsor_email_log_deal_id_sponsor_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."sponsor_deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_email_log" ADD CONSTRAINT "sponsor_email_log_sponsor_contact_id_sponsor_contacts_id_fk" FOREIGN KEY ("sponsor_contact_id") REFERENCES "public"."sponsor_contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spotify_connections" ADD CONSTRAINT "spotify_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_video_comments" ADD CONSTRAINT "tv_video_comments_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_video_comments" ADD CONSTRAINT "tv_video_comments_audience_agent_id_audience_agents_id_fk" FOREIGN KEY ("audience_agent_id") REFERENCES "public"."audience_agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_created_artists" ADD CONSTRAINT "user_created_artists_creator_user_id_users_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_created_artists" ADD CONSTRAINT "user_created_artists_artist_user_id_users_id_fk" FOREIGN KEY ("artist_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_xp" ADD CONSTRAINT "user_xp_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_charts" ADD CONSTRAINT "weekly_charts_highlight_artist_id_users_id_fk" FOREIGN KEY ("highlight_artist_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_channel_snapshots" ADD CONSTRAINT "youtube_channel_snapshots_connection_id_youtube_extension_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."youtube_extension_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_extension_connections" ADD CONSTRAINT "youtube_extension_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_extension_events" ADD CONSTRAINT "youtube_extension_events_connection_id_youtube_extension_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."youtube_extension_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_pending_actions" ADD CONSTRAINT "youtube_pending_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_pending_actions" ADD CONSTRAINT "youtube_pending_actions_connection_id_youtube_extension_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."youtube_extension_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_action_queue_artist" ON "agent_action_queue" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_action_queue_type" ON "agent_action_queue" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_action_queue_status" ON "agent_action_queue" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_action_queue_scheduled" ON "agent_action_queue" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "idx_action_queue_priority" ON "agent_action_queue" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_memory_artist" ON "agent_memory" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_memory_type" ON "agent_memory" USING btree ("memory_type");--> statement-breakpoint
CREATE INDEX "idx_memory_category" ON "agent_memory" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_memory_importance" ON "agent_memory" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "idx_memory_expires" ON "agent_memory" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_saved_result_user" ON "agent_saved_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_saved_result_artist" ON "agent_saved_results" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_saved_result_type" ON "agent_saved_results" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "idx_saved_result_favorite" ON "agent_saved_results" USING btree ("is_favorite");--> statement-breakpoint
CREATE INDEX "idx_agent_session_user" ON "agent_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_agent_session_artist" ON "agent_sessions" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_agent_session_type" ON "agent_sessions" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "idx_agent_session_status" ON "agent_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agent_session_created" ON "agent_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_usage_stats_user" ON "agent_usage_stats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_usage_stats_agent" ON "agent_usage_stats" USING btree ("agent_type");--> statement-breakpoint
CREATE INDEX "idx_evolution_artist" ON "ai_artist_evolution" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_evolution_type" ON "ai_artist_evolution" USING btree ("evolution_type");--> statement-breakpoint
CREATE INDEX "idx_treasury_artist" ON "ai_artist_treasury" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_beef_instigator" ON "ai_beefs" USING btree ("instigator_id");--> statement-breakpoint
CREATE INDEX "idx_beef_target" ON "ai_beefs" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_beef_status" ON "ai_beefs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_collab_initiator" ON "ai_collaborations" USING btree ("initiator_id");--> statement-breakpoint
CREATE INDEX "idx_collab_target" ON "ai_collaborations" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "idx_collab_status" ON "ai_collaborations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_collab_type" ON "ai_collaborations" USING btree ("collaboration_type");--> statement-breakpoint
CREATE INDEX "idx_economic_artist" ON "ai_economic_decisions" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_economic_type" ON "ai_economic_decisions" USING btree ("decision_type");--> statement-breakpoint
CREATE INDEX "idx_economic_status" ON "ai_economic_decisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_music_artist" ON "ai_generated_music" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_ai_music_status" ON "ai_generated_music" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_music_collab" ON "ai_generated_music" USING btree ("collaboration_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_poll" ON "ai_poll_votes" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_user" ON "ai_poll_votes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_poll_votes_agent" ON "ai_poll_votes" USING btree ("audience_agent_id");--> statement-breakpoint
CREATE INDEX "idx_polls_artist" ON "ai_polls" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_polls_post" ON "ai_polls" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_polls_closed" ON "ai_polls" USING btree ("is_closed");--> statement-breakpoint
CREATE INDEX "idx_polls_closes_at" ON "ai_polls" USING btree ("closes_at");--> statement-breakpoint
CREATE INDEX "idx_ai_comment_post" ON "ai_post_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_ai_comment_author" ON "ai_post_comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_ai_post_artist" ON "ai_social_posts" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_ai_post_type" ON "ai_social_posts" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "idx_ai_post_published" ON "ai_social_posts" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "idx_ai_post_status" ON "ai_social_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_stories_artist" ON "ai_stories" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_stories_expires" ON "ai_stories" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_stories_active" ON "ai_stories" USING btree ("is_expired");--> statement-breakpoint
CREATE INDEX "idx_mgmt_manager" ON "artist_management" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "idx_mgmt_artist" ON "artist_management" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_personality_artist" ON "artist_personality" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_personality_mood" ON "artist_personality" USING btree ("current_mood");--> statement-breakpoint
CREATE INDEX "idx_relationship_artist" ON "artist_relationships" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_relationship_related" ON "artist_relationships" USING btree ("related_artist_id");--> statement-breakpoint
CREATE INDEX "idx_relationship_type" ON "artist_relationships" USING btree ("relationship_type");--> statement-breakpoint
CREATE INDEX "idx_relationship_strength" ON "artist_relationships" USING btree ("strength");--> statement-breakpoint
CREATE INDEX "idx_audience_personality" ON "audience_agents" USING btree ("personality_type");--> statement-breakpoint
CREATE INDEX "idx_audience_active" ON "audience_agents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_audience_comments_post" ON "audience_comments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_audience_comments_agent" ON "audience_comments" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_clip_interactions_user" ON "clip_interactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_clip_interactions_clip" ON "clip_interactions" USING btree ("clip_id");--> statement-breakpoint
CREATE INDEX "idx_clips_artist" ON "discover_clips" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_clips_score" ON "discover_clips" USING btree ("algorithm_score");--> statement-breakpoint
CREATE INDEX "idx_clips_active" ON "discover_clips" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_album_art_artist" ON "dynamic_album_art" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_album_art_song" ON "dynamic_album_art" USING btree ("song_id");--> statement-breakpoint
CREATE INDEX "idx_ig_ext_conn_user" ON "instagram_extension_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ig_ext_conn_username" ON "instagram_extension_connections" USING btree ("instagram_username");--> statement-breakpoint
CREATE INDEX "idx_ig_events_conn" ON "instagram_extension_events" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_ig_events_type" ON "instagram_extension_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_ig_events_processed" ON "instagram_extension_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "idx_ig_actions_user" ON "instagram_pending_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ig_actions_status" ON "instagram_pending_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ig_actions_conn" ON "instagram_pending_actions" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_ig_snapshots_conn" ON "instagram_profile_snapshots" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_ig_snapshots_date" ON "instagram_profile_snapshots" USING btree ("snapshot_at");--> statement-breakpoint
CREATE INDEX "idx_live_chat_room" ON "live_chat_messages" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "idx_live_chat_user" ON "live_chat_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_live_rooms_host" ON "live_rooms" USING btree ("host_artist_id");--> statement-breakpoint
CREATE INDEX "idx_live_rooms_status" ON "live_rooms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_decisions_mgmt" ON "management_decisions" USING btree ("management_id");--> statement-breakpoint
CREATE INDEX "idx_decisions_manager" ON "management_decisions" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "idx_decisions_artist" ON "management_decisions" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_decisions_status" ON "management_decisions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_platform_revenue_type" ON "platform_revenue" USING btree ("revenue_type");--> statement-breakpoint
CREATE INDEX "idx_platform_revenue_date" ON "platform_revenue" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_promoted_posts_status" ON "promoted_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_promoted_posts_artist" ON "promoted_posts" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_sponsor_campaigns_user" ON "sponsor_campaigns" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sponsor_campaigns_artist" ON "sponsor_campaigns" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_sponsor_campaigns_status" ON "sponsor_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sponsor_contacts_email" ON "sponsor_contacts" USING btree ("contact_email");--> statement-breakpoint
CREATE INDEX "idx_sponsor_contacts_industry" ON "sponsor_contacts" USING btree ("industry");--> statement-breakpoint
CREATE INDEX "idx_sponsor_contacts_status" ON "sponsor_contacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sponsor_contacts_dedupe" ON "sponsor_contacts" USING btree ("dedupe_hash");--> statement-breakpoint
CREATE INDEX "idx_sponsor_contacts_user" ON "sponsor_contacts" USING btree ("added_by_user_id");--> statement-breakpoint
CREATE INDEX "idx_sponsor_deals_artist" ON "sponsor_deals" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_sponsor_deals_contact" ON "sponsor_deals" USING btree ("sponsor_contact_id");--> statement-breakpoint
CREATE INDEX "idx_sponsor_deals_status" ON "sponsor_deals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sponsor_deals_campaign" ON "sponsor_deals" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_sponsor_deals_stripe" ON "sponsor_deals" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "idx_sponsor_email_campaign" ON "sponsor_email_log" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_sponsor_email_deal" ON "sponsor_email_log" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "idx_sponsor_email_contact" ON "sponsor_email_log" USING btree ("sponsor_contact_id");--> statement-breakpoint
CREATE INDEX "idx_sponsor_email_status" ON "sponsor_email_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_spotify_user" ON "spotify_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_trending_active" ON "trending_topics" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_trending_score" ON "trending_topics" USING btree ("trend_score");--> statement-breakpoint
CREATE INDEX "idx_trending_category" ON "trending_topics" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_tv_comment_video" ON "tv_video_comments" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "idx_tv_comment_artist" ON "tv_video_comments" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "idx_tv_comment_audience" ON "tv_video_comments" USING btree ("audience_agent_id");--> statement-breakpoint
CREATE INDEX "idx_tv_comment_created" ON "tv_video_comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_uca_creator" ON "user_created_artists" USING btree ("creator_user_id");--> statement-breakpoint
CREATE INDEX "idx_uca_artist" ON "user_created_artists" USING btree ("artist_user_id");--> statement-breakpoint
CREATE INDEX "idx_uca_active" ON "user_created_artists" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_user_xp_user" ON "user_xp" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_xp_level" ON "user_xp" USING btree ("level");--> statement-breakpoint
CREATE INDEX "idx_user_xp_total" ON "user_xp" USING btree ("total_xp");--> statement-breakpoint
CREATE INDEX "idx_video_budgets_user" ON "video_budgets" USING btree ("user_email");--> statement-breakpoint
CREATE INDEX "idx_video_budgets_project" ON "video_budgets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_video_budgets_payment" ON "video_budgets" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_charts_week_year" ON "weekly_charts" USING btree ("week_number","year");--> statement-breakpoint
CREATE INDEX "idx_charts_type" ON "weekly_charts" USING btree ("chart_type");--> statement-breakpoint
CREATE INDEX "idx_world_event_type" ON "world_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_world_event_status" ON "world_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_world_event_starts" ON "world_events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "idx_xp_tx_user" ON "xp_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_xp_tx_reason" ON "xp_transactions" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "idx_yt_snapshots_conn" ON "youtube_channel_snapshots" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_yt_snapshots_date" ON "youtube_channel_snapshots" USING btree ("snapshot_at");--> statement-breakpoint
CREATE INDEX "idx_yt_ext_conn_user" ON "youtube_extension_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_yt_ext_conn_channel" ON "youtube_extension_connections" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "idx_yt_events_conn" ON "youtube_extension_events" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "idx_yt_events_type" ON "youtube_extension_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_yt_events_processed" ON "youtube_extension_events" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "idx_yt_actions_user" ON "youtube_pending_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_yt_actions_status" ON "youtube_pending_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_yt_actions_conn" ON "youtube_pending_actions" USING btree ("connection_id");