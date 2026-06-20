import { pgTable, text, timestamp, integer, serial, decimal, boolean, jsonb } from "drizzle-orm/pg-core";

// Community configuration per artist
export const cryptoCommunityConfigs = pgTable("crypto_community_configs", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  // Channel connections
  telegramGroupId: text("telegram_group_id"),
  telegramBotToken: text("telegram_bot_token"),
  discordServerId: text("discord_server_id"),
  discordWebhookUrl: text("discord_webhook_url"),
  twitterHandle: text("twitter_handle"),
  farcasterFid: text("farcaster_fid"),
  // Agent settings
  agentMode: text("agent_mode").default("auto"), // auto | manual | scheduled
  autoPostEnabled: boolean("auto_post_enabled").default(true),
  postFrequencyHours: integer("post_frequency_hours").default(6),
  priceAlertThreshold: decimal("price_alert_threshold", { precision: 5, scale: 2 }).default("5.00"),
  // BoostiSwap integration
  linkedTokenId: integer("linked_token_id"), // FK to tokenized song
  linkedPoolId: integer("linked_pool_id"),   // FK to boostiswap pool
  // Metadata
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Posts sent to community channels
export const cryptoCommunityPosts = pgTable("crypto_community_posts", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  postType: text("post_type").notNull(), // news | price_alert | proposal | token_update | milestone | custom
  content: text("content").notNull(),
  channels: jsonb("channels"), // { telegram: true, discord: true, twitter: false }
  deliveryStatus: jsonb("delivery_status"), // { telegram: 'sent', discord: 'sent', twitter: 'failed' }
  // BoostiSwap context
  tokenSymbol: text("token_symbol"),
  tokenPrice: decimal("token_price", { precision: 20, scale: 8 }),
  priceChange: decimal("price_change", { precision: 10, scale: 2 }),
  // Engagement
  impressions: integer("impressions").default(0),
  reactions: integer("reactions").default(0),
  // Metadata
  generatedByAi: boolean("generated_by_ai").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Community proposals (DAO-lite voting)
export const cryptoCommunityProposals = pgTable("crypto_community_proposals", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  proposalType: text("proposal_type").default("general"), // general | token | merch | collab | event
  options: jsonb("options").notNull(), // [{ id: 1, label: "Option A", votes: 0 }, ...]
  // Token-gated voting
  minTokensToVote: decimal("min_tokens_to_vote", { precision: 20, scale: 8 }).default("1"),
  linkedTokenId: integer("linked_token_id"),
  // Status
  status: text("status").default("active"), // active | closed | cancelled
  totalVotes: integer("total_votes").default(0),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Community members tracking
export const cryptoCommunityMembers = pgTable("crypto_community_members", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  userId: integer("user_id"),
  walletAddress: text("wallet_address"),
  telegramUsername: text("telegram_username"),
  discordUsername: text("discord_username"),
  twitterHandle: text("twitter_handle"),
  tokensHeld: decimal("tokens_held", { precision: 20, scale: 8 }).default("0"),
  votingPower: decimal("voting_power", { precision: 10, scale: 2 }).default("1"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Votes on proposals
export const cryptoCommunityVotes = pgTable("crypto_community_votes", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull(),
  memberId: integer("member_id").notNull(),
  optionId: integer("option_id").notNull(),
  votingPower: decimal("voting_power", { precision: 10, scale: 2 }).default("1"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Types
export type CryptoCommunityConfig = typeof cryptoCommunityConfigs.$inferSelect;
export type CryptoCommunityPost = typeof cryptoCommunityPosts.$inferSelect;
export type CryptoCommunityProposal = typeof cryptoCommunityProposals.$inferSelect;
export type CryptoCommunityMember = typeof cryptoCommunityMembers.$inferSelect;
export type CryptoCommunityVote = typeof cryptoCommunityVotes.$inferSelect;

// ── Outreach: Apify-extracted audience contacts ──

export const cryptoOutreachContacts = pgTable("crypto_outreach_contacts", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  // Contact info
  platform: text("platform").notNull(), // instagram | twitter | telegram | tiktok | farcaster
  platformUsername: text("platform_username").notNull(),
  platformUserId: text("platform_user_id"),
  displayName: text("display_name"),
  email: text("email"),
  bio: text("bio"),
  profileUrl: text("profile_url"),
  profileImageUrl: text("profile_image_url"),
  // Audience metrics
  followerCount: integer("follower_count").default(0),
  followingCount: integer("following_count").default(0),
  engagementRate: decimal("engagement_rate", { precision: 5, scale: 2 }),
  postsCount: integer("posts_count").default(0),
  // Tags & classification
  tags: jsonb("tags").$type<string[]>().default([]),  // e.g. ["crypto", "nft", "music", "defi"]
  audienceType: text("audience_type"), // influencer | community_leader | active_trader | collector | fan
  relevanceScore: decimal("relevance_score", { precision: 5, scale: 2 }).default("0"),
  // Dedup
  dedupeHash: text("dedupe_hash").notNull(),
  // Outreach state
  outreachStatus: text("outreach_status").default("pending"), // pending | queued | sent | replied | bounced | opted_out
  lastContactedAt: timestamp("last_contacted_at"),
  contactCount: integer("contact_count").default(0),
  // Source
  apifyActorId: text("apify_actor_id"),
  apifyRunId: text("apify_run_id"),
  sourceQuery: text("source_query"), // search query that found this contact
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Outreach campaigns ──

export const cryptoOutreachCampaigns = pgTable("crypto_outreach_campaigns", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  name: text("name").notNull(),
  campaignType: text("campaign_type").notNull(), // token_launch | community_growth | event_promo | collaboration | general
  // Content
  messageTemplate: text("message_template").notNull(),
  generatedByAi: boolean("generated_by_ai").default(false),
  // Targeting
  targetPlatforms: jsonb("target_platforms").$type<string[]>().default(["instagram", "twitter"]),
  targetTags: jsonb("target_tags").$type<string[]>().default([]),
  targetMinFollowers: integer("target_min_followers").default(0),
  targetMaxFollowers: integer("target_max_followers"),
  targetAudienceTypes: jsonb("target_audience_types").$type<string[]>().default([]),
  // Delivery
  status: text("status").default("draft"), // draft | active | paused | completed | cancelled
  dailyLimit: integer("daily_limit").default(20),
  totalSent: integer("total_sent").default(0),
  totalDelivered: integer("total_delivered").default(0),
  totalReplied: integer("total_replied").default(0),
  totalFailed: integer("total_failed").default(0),
  // Schedule
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  // BoostiSwap context
  linkedTokenId: integer("linked_token_id"),
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Outreach send log ──

export const cryptoOutreachLog = pgTable("crypto_outreach_log", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  contactId: integer("contact_id").notNull(),
  artistId: integer("artist_id").notNull(),
  // Delivery
  platform: text("platform").notNull(),
  messageContent: text("message_content").notNull(),
  status: text("status").default("sent"), // sent | delivered | failed | bounced | replied
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
  errorMessage: text("error_message"),
});

export type CryptoOutreachContact = typeof cryptoOutreachContacts.$inferSelect;
export type CryptoOutreachCampaign = typeof cryptoOutreachCampaigns.$inferSelect;
export type CryptoOutreachLogEntry = typeof cryptoOutreachLog.$inferSelect;
