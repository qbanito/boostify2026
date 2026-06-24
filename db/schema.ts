import { pgTable, pgEnum, text, serial, integer, boolean, timestamp, json, jsonb, decimal, uuid, varchar, index, real, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations, sql } from "drizzle-orm";
import { z } from "zod";

// Session storage table for Replit Auth
// IMPORTANTE: Necesaria para Replit Auth, no borrar
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  // Clerk Auth
  clerkId: varchar("clerk_id").unique(), // Clerk user ID (primary auth)
  // Campos para Replit Auth (deprecated - keeping for backwards compat)
  replitId: varchar("replit_id").unique(), // ID de Replit Auth
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  // Campos legacy (ahora opcionales)
  username: text("username").unique(),
  password: text("password"),
  role: text("role", { enum: ["artist", "admin"] }).default("artist").notNull(),
  email: text("email"),
  phone: text("phone"),
  biography: text("biography"),
  genre: text("genre"),
  location: text("location"),
  website: text("website"),
  instagramHandle: text("instagram_handle"),
  twitterHandle: text("twitter_handle"),
  youtubeChannel: text("youtube_channel"),
  technicalRider: json("technical_rider"),
  spotifyToken: text("spotify_token"),
  instagramToken: text("instagram_token"),
  slug: text("slug").unique(),
  artistName: text("artist_name"),
  profileImage: text("profile_image"),
  coverImage: text("cover_image"),
  bannerPosition: text("banner_position").default("50"),
  loopVideoUrl: text("loop_video_url"),
  realName: text("real_name"),
  country: text("country"),
  genres: text("genres").array(),
  spotifyUrl: text("spotify_url"),
  facebookUrl: text("facebook_url"),
  tiktokUrl: text("tiktok_url"),
  topYoutubeVideos: json("top_youtube_videos").$type<Array<{
    title: string;
    url: string;
    thumbnailUrl: string;
    type: string;
  }>>(),
  concerts: json("concerts").$type<{
    upcoming: Array<{
      tourName: string;
      location: { city: string; country: string; venue: string };
      date: string;
      status: string;
      source: string;
    }>;
    highlights: Array<{
      eventName: string;
      year: number;
      note: string;
    }>;
  }>(),
  // Virtual Record Label fields
  firestoreId: text("firestore_id"),
  isAIGenerated: boolean("is_ai_generated").default(false).notNull(),
  generatedBy: integer("generated_by").references(() => users.id, { onDelete: "cascade" }),
  recordLabelId: text("record_label_id"),
  // BTF-2300 Blockchain NFT fields
  blockchainNetwork: text("blockchain_network"), // polygon, ethereum, etc.
  blockchainArtistId: integer("blockchain_artist_id"), // On-chain artist ID
  blockchainTokenId: text("blockchain_token_id"), // NFT Token ID (string for large numbers)
  blockchainTxHash: text("blockchain_tx_hash"), // Transaction hash of registration
  blockchainContract: text("blockchain_contract"), // Contract address
  blockchainRegisteredAt: timestamp("blockchain_registered_at"), // When registered on-chain
  // Profile Layout Configuration
  pageMode: text("page_mode", { enum: ["artist", "influencer", "personal", "business"] }).default("artist"),
  profileLayout: json("profile_layout").$type<{
    order: string[];
    visibility: Record<string, boolean>;
    expanded?: Record<string, boolean>;
    rightOrder?: string[];
    rightExpanded?: Record<string, boolean>;
    rightVisibility?: Record<string, boolean>;
    colorTheme?: string | null;
  }>(),
  // AI Canvas Workflow — node automation canvas (ScheduleTrigger, Router, Webhook, PromptBuilder, etc.)
  nodeWorkflow: json("node_workflow").$type<{
    nodes: any[];
    edges: any[];
    savedAt?: string;
  }>(),
  // Dynamic UI Preferences (style preset, auto-adapt flag)
  uiPreferences: json("ui_preferences").$type<{
    activePreset: string;
    autoAdapt: boolean;
  }>(),
  // Master Artist JSON — canonical identity document for AI generation modules
  masterJson: jsonb("master_json"),
  // Public visibility — owner can hide artist profile from public pages
  isPublished: boolean("is_published").default(true).notNull(),
  // Amazon Associates affiliate tag (per-artist; e.g. "myartist-20" US, "myartist-21" UK)
  amazonAffiliateTag: text("amazon_affiliate_tag"),
  amazonAiBoosterEnabled: boolean("amazon_ai_booster_enabled").default(true).notNull(),
  // Optional manual override of marketplace country code (e.g. 'US', 'UK', 'DE'). NULL = autodetect from tag suffix.
  amazonMarketplaceOverride: text("amazon_marketplace_override"),
  // Manual ASIN list (works without PA-API access). Shape: [{asin, title?, note?}]
  amazonManualPicks: jsonb("amazon_manual_picks").$type<Array<{asin: string; title?: string; note?: string}>>().default([]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const artistMedia = pgTable("artist_media", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  type: text("type", { enum: ["video"] }).notNull(),
  storagePath: text("storage_path").notNull(),
  duration: text("duration"),
  thumbnail: text("thumbnail"),
  description: text("description"),
  isPublished: boolean("is_published").default(true).notNull(),
  views: integer("views").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Video Notes — Time-coded annotations on videos (uploaded videos only).
// videoId is a string because videos live in BOTH Firestore (doc ids) and
// Postgres artistMedia (numeric id cast to string), so we store them uniformly.
// ownerUserId is the owner/artist of the video (for moderation / permissions)
// and is redundantly stored here so we can query a user's own videos'
// notes without a join into Firestore.
export const videoNotes = pgTable("video_notes", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull(),
  ownerUserId: integer("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
  // Nullable to allow anonymous/guest comments.
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  // Display name for guests (when userId is null).
  guestName: text("guest_name"),
  timecodeMs: integer("timecode_ms").notNull(),
  endTimecodeMs: integer("end_timecode_ms"),
  text: text("text").notNull(),
  color: text("color"),
  isPrivate: boolean("is_private").default(false).notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_video_notes_video").on(table.videoId, table.timecodeMs),
  index("idx_video_notes_user").on(table.userId),
]);

export const songs = pgTable("songs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  audioUrl: text("audio_url").notNull(),
  duration: text("duration"),
  releaseDate: timestamp("release_date"),
  genre: text("genre"),
  mood: text("mood"), // Estado de ánimo de la canción
  lyrics: text("lyrics"), // Letras de la canción (generadas por AI o personalizadas)
  coverArt: text("cover_art"),
  artistGender: text("artist_gender", { enum: ["male", "female"] }), // Género del artista para voz
  generatedWithAI: boolean("generated_with_ai").default(false), // Si fue generada con IA
  aiProvider: text("ai_provider"), // fal-minimax-music-v2, etc.
  // Distribution metadata fields
  isrc: text("isrc"), // International Standard Recording Code
  upc: text("upc"), // Universal Product Code
  composers: text("composers").array(), // Array of composer names
  isPublished: boolean("is_published").default(true).notNull(),
  plays: integer("plays").default(0).notNull(),
  // 🌟 Featured single — only one per artist (enforced at the route layer)
  isSingle: boolean("is_single").default(false).notNull(),
  singlePinnedAt: timestamp("single_pinned_at"),
  // 🎵 Audio analysis pipeline (OpenAI Whisper + fal sound model + GPT insights)
  // Generated automatically every time a song is uploaded; consumed by AI agents
  // for proposals, video scripts, marketing angles, etc.
  analysisJson: jsonb("analysis_json"),
  analysisStatus: text("analysis_status"), // pending | processing | ready | failed
  analysisError: text("analysis_error"),
  analyzedAt: timestamp("analyzed_at"),
  // 🔗 Lazy-sync link: when a song originates in Firestore, we keep the
  // Firestore doc id here so /api/song-promotion/ensure-pg-song can find or
  // create the matching Postgres row idempotently. Firestore remains the
  // source of truth for playback/UI; Postgres holds the analysis pipeline state.
  firestoreId: text("firestore_id").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 🎤 Karaoke — Whisper-synced lyrics for each song (generated once, cached forever)
export const songKaraoke = pgTable("song_karaoke", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").references(() => songs.id, { onDelete: "cascade" }).notNull().unique(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  // Synced lyrics: [{text, startTime, endTime, words:[{word, start, end}]}]
  syncedLyrics: jsonb("synced_lyrics"),
  // Raw Whisper transcript segments
  rawTranscript: text("raw_transcript"),
  // Status: pending | processing | ready | failed
  status: text("status", { enum: ["pending", "processing", "ready", "failed"] }).default("pending").notNull(),
  provider: text("provider"), // whisper | whisper+ai | manual
  errorMessage: text("error_message"),
  generatedAt: timestamp("generated_at"),
  // 🎼 Instrumental (vocals-removed backing track) — generated once, cached on
  // Firebase Storage. Played underneath the synced lyrics when karaoke mode is on.
  instrumentalUrl: text("instrumental_url"),
  instrumentalStatus: text("instrumental_status").default("idle"), // idle | processing | ready | failed
  instrumentalProvider: text("instrumental_provider"),
  instrumentalError: text("instrumental_error"),
  instrumentalGeneratedAt: timestamp("instrumental_generated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_song_karaoke_song").on(table.songId),
  index("idx_song_karaoke_user").on(table.userId),
]);

// 🤖 Music Auto-Pilot — scheduled, active music generation.
// Uses the artist's EXISTING songs as style references to auto-generate
// new music on a cadence (e.g. weekly single, monthly album).
export const musicAutoSchedules = pgTable("music_auto_schedules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  cadence: text("cadence", { enum: ["daily", "weekly", "biweekly", "monthly"] }).default("weekly").notNull(),
  releaseType: text("release_type", { enum: ["single", "ep", "album"] }).default("single").notNull(),
  songsPerRun: integer("songs_per_run").default(1).notNull(), // 1 single · 4 EP · 8 album
  // Songs used as creative references. Empty/null = latest published songs.
  referenceSongIds: integer("reference_song_ids").array(),
  styleNotes: text("style_notes"), // extra creative direction from the artist
  autoPublish: boolean("auto_publish").default(true).notNull(),
  generateCover: boolean("generate_cover").default(true).notNull(),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  lastRunStatus: text("last_run_status"), // running | completed | partial | failed
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_music_auto_schedules_user").on(table.userId),
  index("idx_music_auto_schedules_next").on(table.enabled, table.nextRunAt),
]);

// History of every auto-pilot generation run
export const musicAutoRuns = pgTable("music_auto_runs", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id").references(() => musicAutoSchedules.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: text("status", { enum: ["running", "completed", "partial", "failed"] }).default("running").notNull(),
  releaseType: text("release_type"),
  songIds: integer("song_ids").array(),
  releaseId: integer("release_id"), // releases.id when an EP/album package was created
  conceptJson: jsonb("concept_json"), // style profile + generated concepts used for this run
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
}, (table) => [
  index("idx_music_auto_runs_schedule").on(table.scheduleId),
  index("idx_music_auto_runs_user").on(table.userId),
]);

// 🎬 Artist Avatar Talk — HeyGen Avatar4 image-to-video AI talking head videos
export const artistAvatarVideos = pgTable("artist_avatar_videos", {
  id: serial("id").primaryKey(),
  artistId: text("artist_id").notNull(),             // Firestore artist ID
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  title: text("title"),
  prompt: text("prompt"),                            // Script spoken by avatar
  voice: text("voice"),
  scene: text("scene"),                              // studio | home | backstage | live
  talkingStyle: text("talking_style").default("stable"),
  aspectRatio: text("aspect_ratio").default("9:16"),
  captionsEnabled: boolean("captions_enabled").default(false),
  status: text("status", { enum: ["processing", "ready", "failed"] }).default("processing").notNull(),
  falRequestId: text("fal_request_id"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_avatar_videos_artist").on(table.artistId),
]);

export const merchandise = pgTable("merchandise", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  productionCost: decimal("production_cost", { precision: 10, scale: 2 }), // Cost to produce (for commission calculation)
  images: text("images").array().notNull(),
  category: text("category", { enum: ["apparel", "accessories", "music", "other"] }).default("other").notNull(),
  stock: integer("stock").default(0).notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  // Design customization
  removeBoostifyLogo: boolean("remove_boostify_logo").default(false).notNull(), // PRO/PREMIUM only
  isCustomDesign: boolean("is_custom_design").default(false).notNull(),
  // Official Store enhancements
  productStatus: text("product_status", { enum: ["active", "pre_order", "limited", "sold_out", "archived"] }).default("active").notNull(),
  expiresAt: timestamp("expires_at"), // For limited editions (countdown)
  preOrderReleaseDate: timestamp("pre_order_release_date"), // When pre-order ships
  preOrderMinimumOrders: integer("pre_order_minimum_orders").default(0).notNull(), // Threshold to validate pre-order
  preOrderCurrentOrders: integer("pre_order_current_orders").default(0).notNull(),
  seasonalCollection: text("seasonal_collection"), // e.g. "halloween-2025", "spring-2026"
  aiGeneratedDesign: boolean("ai_generated_design").default(false).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Product Bundles — Curated groups of merchandise with discount
export const productBundles = pgTable("product_bundles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  productIds: integer("product_ids").array().notNull(), // Array of merchandise.id
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).notNull(),
  bundlePrice: decimal("bundle_price", { precision: 10, scale: 2 }).notNull(),
  discountPercent: integer("discount_percent").notNull(),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true).notNull(),
  aiGenerated: boolean("ai_generated").default(false).notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Product Views — Heat map & analytics tracking
export const productViews = pgTable("product_views", {
  id: serial("id").primaryKey(),
  merchandiseId: integer("merchandise_id").references(() => merchandise.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  viewerId: integer("viewer_id").references(() => users.id), // null for anonymous
  sessionId: text("session_id"), // For anonymous tracking
  source: text("source", { enum: ["card", "quick_view", "full_store", "share_link", "search"] }).default("card").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  plan: text("plan", { enum: ["free", "artist", "basic", "pro", "premium", "creator", "professional", "enterprise"] }).notNull(),
  status: text("status", { enum: ["active", "cancelled", "expired", "trialing", "past_due"] }).notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  currentPeriodStart: timestamp("current_period_start"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  interval: text("interval", { enum: ["monthly", "yearly"] }).default("monthly"),
  price: decimal("price", { precision: 10, scale: 2 }),
  currency: text("currency").default("usd"),
  isTrial: boolean("is_trial").default(false).notNull(),
  trialEndsAt: timestamp("trial_ends_at"),
  grantedByBundle: text("granted_by_bundle"),
  // Content limits per plan - Videos & Songs
  videosLimit: integer("videos_limit").default(1).notNull(),
  songsLimit: integer("songs_limit").default(2).notNull(),
  videosUsed: integer("videos_used").default(0).notNull(),
  songsUsed: integer("songs_used").default(0).notNull(),
  // AI Generated Artists
  artistsGeneratedLimit: integer("artists_generated_limit").default(0).notNull(),
  artistsGeneratedUsed: integer("artists_generated_used").default(0).notNull(),
  // AI Tools AI Tools & Features Limits Features Limits
  aiGenerationLimit: integer("ai_generation_limit").default(0).notNull(), // 0=FREE (required), 10=BASIC, 100=PRO, unlimited=PREMIUM
  aiGenerationUsed: integer("ai_generation_used").default(0).notNull(),
  epkLimit: integer("epk_limit").default(0).notNull(), // 0=NONE, 1=BASIC, 5=PRO, unlimited=PREMIUM
  epkUsed: integer("epk_used").default(0).notNull(),
  imageGalleriesLimit: integer("image_galleries_limit").default(0).notNull(), // 0=NONE, 1=BASIC, 5=PRO, unlimited=PREMIUM
  imageGalleriesUsed: integer("image_galleries_used").default(0).notNull(),
  // Permissions
  removeBoostifyLogo: boolean("remove_boostify_logo").default(false).notNull(), // PRO PRO & PREMIUM only PREMIUM only
  customizeMerchandise: boolean("customize_merchandise").default(false).notNull(), // PRO PRO & PREMIUM only PREMIUM only
  // Commission info
  commissionRate: integer("commission_rate").default(5).notNull(), // 5% FREE, 20% BASIC/PRO/PREMIUM
  // Sponsor module limits
  sponsorSearchLimit: integer("sponsor_search_limit").default(0).notNull(), // 0=FREE, 5=BASIC, 20=PRO, 999=PREMIUM
  sponsorSearchUsed: integer("sponsor_search_used").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Sistema de roles y permisos (reemplaza admin hardcodeado)
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  role: text("role", { enum: ["user", "moderator", "support", "admin", "tester"] }).default("user").notNull(),
  permissions: json("permissions").$type<string[]>(),
  grantedBy: integer("granted_by").references(() => users.id),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Artist Wallet - Balance de créditos del artista
export const artistWallet = pgTable("artist_wallet", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).unique().notNull(),
  balance: decimal("balance", { precision: 10, scale: 2 }).default('0').notNull(), // Saldo disponible en créditos
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default('0').notNull(), // Total ganado histórico
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default('0').notNull(), // Total gastado
  currency: text("currency").default("usd").notNull(),
  payoutMethod: text("payout_method"), // paypal | bank | wise | stripe
  payoutAccount: text("payout_account"), // email / IBAN / account ref
  payoutDetails: json("payout_details").$type<Record<string, any>>(),
  totalPaidOut: decimal("total_paid_out", { precision: 10, scale: 2 }).default('0').notNull(), // Total ya retirado
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Sales Transactions - Sales transaction history
export const salesTransactions = pgTable("sales_transactions", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id).notNull(),
  merchandiseId: integer("merchandise_id").references(() => merchandise.id),
  productName: text("product_name").notNull(),
  saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }).notNull(), // Total sale price
  productionCost: decimal("production_cost", { precision: 10, scale: 2 }).default('0').notNull(), // Production cost
  artistEarning: decimal("artist_earning", { precision: 10, scale: 2 }).notNull(), // Artist commission (5% o 20% after costs)
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(), // Platform earnings
  commissionRate: integer("commission_rate").default(5).notNull(), // 5% FREE, 20% PAID
  quantity: integer("quantity").default(1).notNull(),
  currency: text("currency").default("usd").notNull(),
  buyerEmail: text("buyer_email"),
  stripePaymentId: text("stripe_payment_id"),
  status: text("status", { enum: ["pending", "completed", "refunded", "cancelled"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Wallet Transactions - Wallet transactions (earnings and expenses)
export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type", { enum: ["earning", "spending", "refund", "adjustment"] }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  balanceBefore: decimal("balance_before", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal("balance_after", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  relatedSaleId: integer("related_sale_id").references(() => salesTransactions.id),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Artist Payouts - Unified payout requests + ledger (artist withdraws wallet balance)
export const artistPayouts = pgTable("artist_payouts", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd").notNull(),
  method: text("method"), // paypal | bank | wise | stripe
  account: text("account"),
  status: text("status", { enum: ["requested", "approved", "paid", "rejected"] }).default("requested").notNull(),
  reference: text("reference"), // payout tx id / receipt
  notes: text("notes"),
  requestedBy: integer("requested_by").references(() => users.id),
  processedBy: integer("processed_by").references(() => users.id),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  paidAt: timestamp("paid_at"),
}, (table) => [
  index("idx_artist_payouts_artist").on(table.artistId),
  index("idx_artist_payouts_status").on(table.status),
]);

export const artistAccessUnlocks = pgTable("artist_access_unlocks", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id).notNull(), // artista cuyo catálogo se desbloquea
  fanUserId: integer("fan_user_id").references(() => users.id), // fan autenticado (puede ser null si solo email)
  fanEmail: text("fan_email"),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd").notNull(),
  stripePaymentId: text("stripe_payment_id"), // session.id de Stripe (idempotencia)
  status: text("status", { enum: ["active", "pending", "refunded"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Module Unlocks - One-time payment to unlock a platform module for life (no artist split, 100% Boostify)
export const moduleUnlocks = pgTable("module_unlocks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(), // comprador
  moduleKey: text("module_key").notNull(), // e.g. 'music-video-creator' or 'all-access'
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd").notNull(),
  stripePaymentId: text("stripe_payment_id"), // session.id de Stripe (idempotencia)
  status: text("status", { enum: ["active", "pending", "refunded"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// ============================================================
// CONCERT COMMAND CENTER — unified concert organization, ticketing,
// merch linking & buyer messaging. Boostify charges an admin-configurable
// 10–30% commission on ticket sales (rate resolved per-artist at checkout).
// ============================================================

// A concert/show created by an artist (in-person, online/stream, or hybrid)
export const concertEvents = pgTable("concert_events", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type", { enum: ["in_person", "online", "hybrid"] }).default("in_person").notNull(),
  status: text("status", { enum: ["draft", "published", "live", "ended", "cancelled"] }).default("draft").notNull(),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  timezone: text("timezone"),
  venue: text("venue"),
  location: text("location"),
  capacity: integer("capacity"),
  posterUrl: text("poster_url"),
  currency: text("currency").default("usd").notNull(),
  streamingConfig: jsonb("streaming_config"), // { provider, url, hologramShowId, crowdsyncEventId }
  linkedModules: jsonb("linked_modules"), // { merchandiseIds:[], fanClubPerk, ... }
  artistSlug: text("artist_slug"),
  refundPolicy: text("refund_policy"), // free-text policy shown at checkout
  refundPolicyType: varchar("refund_policy_type", { length: 32 }).default("flexible"), // flexible | moderate | strict | no_refunds | custom
  venueId: integer("venue_id"),         // → concert_venues.id (reserved-seating events)
  seatingMode: text("seating_mode").default("general").notNull(), // general | reserved
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Ticket types per event (GA, VIP, Meet & Greet…)
export const concertTicketTiers = pgTable("concert_ticket_tiers", {
  id: serial("id").primaryKey(),
  concertId: integer("concert_id").references(() => concertEvents.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  priceUsd: decimal("price_usd", { precision: 10, scale: 2 }).default("0").notNull(),
  quantityTotal: integer("quantity_total"), // null = unlimited
  quantitySold: integer("quantity_sold").default(0).notNull(),
  maxPerOrder: integer("max_per_order"), // anti-fraud cap per checkout (null/0 = global cap 20)
  perks: jsonb("perks"), // string[]
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// A paid ticket order with the artist/platform commission split recorded
export const concertOrders = pgTable("concert_orders", {
  id: serial("id").primaryKey(),
  concertId: integer("concert_id").references(() => concertEvents.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id).notNull(),
  buyerEmail: text("buyer_email"),
  buyerName: text("buyer_name"),
  buyerUserId: integer("buyer_user_id").references(() => users.id),
  items: jsonb("items").notNull(), // [{ tierId, name, unitPrice, quantity }]
  seatIds: jsonb("seat_ids"),      // reserved-seating: [seatId, …] bought in this order
  quantity: integer("quantity").default(1).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  commissionRate: integer("commission_rate").default(20).notNull(), // effective % at purchase time (10–30)
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(),
  artistEarning: decimal("artist_earning", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd").notNull(),
  stripePaymentId: text("stripe_payment_id"), // session.id (idempotency)
  qrCode: text("qr_code"),
  discountCode: varchar("discount_code", { length: 64 }), // promo/presale code applied
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).default("0").notNull(),
  buyerCountry: varchar("buyer_country", { length: 8 }), // ISO country (best-effort, analytics)
  buyerDevice: varchar("buyer_device", { length: 16 }),  // mobile | desktop | tablet
  buyerPhone: varchar("buyer_phone", { length: 40 }),    // lead capture
  buyerCity: varchar("buyer_city", { length: 120 }),     // lead capture
  marketingOptIn: boolean("marketing_opt_in").default(false).notNull(), // agreed to news/marketing
  policyAccepted: boolean("policy_accepted").default(false).notNull(),   // accepted refund policy / terms
  status: text("status", { enum: ["pending", "completed", "refunded", "cancelled"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Buyer ↔ artist conversation tied to a concert (no Clerk login needed for buyer)
export const concertThreads = pgTable("concert_threads", {
  id: serial("id").primaryKey(),
  concertId: integer("concert_id").references(() => concertEvents.id, { onDelete: "cascade" }),
  artistId: integer("artist_id").references(() => users.id).notNull(),
  buyerEmail: text("buyer_email").notNull(),
  buyerName: text("buyer_name"),
  subject: text("subject"),
  lastMessagePreview: text("last_message_preview"),
  lastMessageAt: timestamp("last_message_at"),
  artistUnread: integer("artist_unread").default(0).notNull(),
  buyerUnread: integer("buyer_unread").default(0).notNull(),
  status: text("status", { enum: ["open", "closed"] }).default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const concertMessages = pgTable("concert_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").references(() => concertThreads.id, { onDelete: "cascade" }).notNull(),
  senderRole: text("sender_role", { enum: ["buyer", "artist", "system"] }).default("buyer").notNull(),
  body: text("body").notNull(),
  attachments: jsonb("attachments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Anti-fraud ticket passes — one row PER admitted unit (4 tickets = 4 passes),
// each carrying an HMAC signature so a pass cannot be forged or duplicated.
// Check-in is a single-use atomic transition (valid → checked_in).
export const concertTicketPasses = pgTable("concert_ticket_passes", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => concertOrders.id, { onDelete: "cascade" }).notNull(),
  concertId: integer("concert_id").references(() => concertEvents.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id).notNull(),
  tierId: integer("tier_id").references(() => concertTicketTiers.id, { onDelete: "set null" }),
  tierName: text("tier_name"),
  buyerEmail: text("buyer_email"),
  buyerName: text("buyer_name"),
  passCode: text("pass_code").notNull().unique(), // public id embedded in the QR
  signature: text("signature").notNull(),         // HMAC-SHA256 of the pass payload
  status: text("status", { enum: ["valid", "checked_in", "void", "transferred"] }).default("valid").notNull(),
  checkedInAt: timestamp("checked_in_at"),
  checkedInBy: text("checked_in_by"), // who scanned (artist email / 'self')
  seat: text("seat"),                 // optional seat/section label
  seatId: integer("seat_id"),         // → concert_seats.id (reserved seating)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Promo / presale codes for concerts (percentage or fixed amount off).
export const concertDiscountCodes = pgTable("concert_discount_codes", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  concertId: integer("concert_id").references(() => concertEvents.id, { onDelete: "cascade" }), // null = all events
  code: varchar("code", { length: 64 }).notNull(),
  kind: text("kind", { enum: ["percent", "fixed"] }).default("percent").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).default("0").notNull(), // percent 0-100 or USD
  isPresale: boolean("is_presale").default(false).notNull(),
  maxRedemptions: integer("max_redemptions"), // null = unlimited
  timesRedeemed: integer("times_redeemed").default(0).notNull(),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sold-out / pre-on-sale waitlist. Lets the artist gauge demand by city.
export const concertWaitlist = pgTable("concert_waitlist", {
  id: serial("id").primaryKey(),
  concertId: integer("concert_id").references(() => concertEvents.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  email: text("email").notNull(),
  name: text("name"),
  quantity: integer("quantity").default(1).notNull(),
  city: text("city"),
  status: text("status", { enum: ["waiting", "notified", "converted"] }).default("waiting").notNull(),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Live Ticketing & Seat Map Engine ─────────────────────────────────────────
// A reusable venue with a visual seat map, owned by an artist. Sections are the
// pricing/visual zones; seats are the individual sellable units. The live
// sellable state per event lives in concertEventSeats (a venue is reused across
// many events).
export const concertVenues = pgTable("concert_venues", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  country: varchar("country", { length: 80 }),
  description: text("description"),
  capacity: integer("capacity").default(0).notNull(),
  canvasWidth: integer("canvas_width").default(1000).notNull(),   // editor canvas size (responsive scaling)
  canvasHeight: integer("canvas_height").default(700).notNull(),
  stageLabel: text("stage_label").default("STAGE"),
  imageUrl: text("image_url"),
  status: text("status", { enum: ["active", "archived"] }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  byArtist: index("idx_concert_venues_artist").on(t.artistId),
}));

// A pricing/visual zone: a block of seats, a group of tables, or a GA area.
export const concertVenueSections = pgTable("concert_venue_sections", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id").references(() => concertVenues.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["seats", "tables", "ga"] }).default("seats").notNull(),
  color: varchar("color", { length: 16 }).default("#7c3aed").notNull(),
  defaultPrice: decimal("default_price", { precision: 10, scale: 2 }).default("0").notNull(),
  gaCapacity: integer("ga_capacity").default(0).notNull(), // general-admission only
  tableSeats: integer("table_seats").default(4).notNull(), // chairs per table (tables only)
  x: integer("x").default(0).notNull(),
  y: integer("y").default(0).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  byVenue: index("idx_venue_sections_venue").on(t.venueId),
}));

// One sellable unit: an individual seat, or a whole table (capacity = chairs).
export const concertSeats = pgTable("concert_seats", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id").references(() => concertVenues.id, { onDelete: "cascade" }).notNull(),
  sectionId: integer("section_id").references(() => concertVenueSections.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind", { enum: ["seat", "table"] }).default("seat").notNull(),
  rowLabel: varchar("row_label", { length: 16 }),
  seatNumber: varchar("seat_number", { length: 16 }),
  label: text("label").notNull(),                       // "A12" or "Table 3"
  capacity: integer("capacity").default(1).notNull(),    // table chairs | 1 (seat)
  x: integer("x").default(0).notNull(),
  y: integer("y").default(0).notNull(),
  priceOverride: decimal("price_override", { precision: 10, scale: 2 }), // null → section.defaultPrice
  isBlocked: boolean("is_blocked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  byVenue: index("idx_concert_seats_venue").on(t.venueId),
  bySection: index("idx_concert_seats_section").on(t.sectionId),
}));

// Per-EVENT live status of each seat. Unique (concertId, seatId) is the anti
// double-sell anchor — holds/sells happen via transactional conditional UPDATEs.
export const concertEventSeats = pgTable("concert_event_seats", {
  id: serial("id").primaryKey(),
  concertId: integer("concert_id").references(() => concertEvents.id, { onDelete: "cascade" }).notNull(),
  seatId: integer("seat_id").references(() => concertSeats.id, { onDelete: "cascade" }).notNull(),
  sectionId: integer("section_id").references(() => concertVenueSections.id, { onDelete: "set null" }),
  status: text("status", { enum: ["available", "held", "sold", "blocked"] }).default("available").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).default("0").notNull(),
  holdToken: varchar("hold_token", { length: 64 }),
  heldByEmail: text("held_by_email"),
  holdExpiresAt: timestamp("hold_expires_at"),
  orderId: integer("order_id").references(() => concertOrders.id, { onDelete: "set null" }),
  passId: integer("pass_id").references(() => concertTicketPasses.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  uniqSeatPerEvent: uniqueIndex("idx_event_seat_unique").on(t.concertId, t.seatId),
  byEventStatus: index("idx_event_seat_status").on(t.concertId, t.status),
  byHold: index("idx_event_seat_hold").on(t.holdToken),
}));

// ── Ticket Trust Engine ──────────────────────────────────────────────────────
// Immutable audit log of every door scan attempt (valid or rejected). The
// backend is the ONLY writer — the frontend can never forge a "valid" scan.
export const concertScanLogs = pgTable("concert_scan_logs", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  concertId: integer("concert_id").references(() => concertEvents.id, { onDelete: "set null" }),
  passId: integer("pass_id").references(() => concertTicketPasses.id, { onDelete: "set null" }),
  passCode: text("pass_code"),
  result: text("result").notNull(), // valid | already_used | bad_signature | not_found | wrong_artist | wrong_event | void | race | malformed | error
  scannedBy: text("scanned_by"),
  gate: text("gate"),
  buyerName: text("buyer_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  byArtist: index("idx_scan_logs_artist").on(t.artistId),
  byEvent: index("idx_scan_logs_event").on(t.concertId),
  byResult: index("idx_scan_logs_result").on(t.artistId, t.result),
}));

// Secure ownership transfers. A transfer mints a NEW pass code + signature for
// the new owner and voids the old QR (pass.status='transferred'), so an old
// screenshot can never re-enter.
export const concertTicketTransfers = pgTable("concert_ticket_transfers", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  concertId: integer("concert_id").references(() => concertEvents.id, { onDelete: "set null" }),
  oldPassId: integer("old_pass_id").references(() => concertTicketPasses.id, { onDelete: "set null" }),
  newPassId: integer("new_pass_id").references(() => concertTicketPasses.id, { onDelete: "set null" }),
  fromEmail: text("from_email").notNull(),
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  status: text("status", { enum: ["completed", "reverted"] }).default("completed").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  byArtist: index("idx_ticket_transfers_artist").on(t.artistId),
  byFrom: index("idx_ticket_transfers_from").on(t.fromEmail),
  byTo: index("idx_ticket_transfers_to").on(t.toEmail),
}));

// Crowdfunding Campaigns - Artist crowdfunding campaigns
export const crowdfundingCampaigns = pgTable("crowdfunding_campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  goalAmount: decimal("goal_amount", { precision: 10, scale: 2 }).notNull(),
  currentAmount: decimal("current_amount", { precision: 10, scale: 2 }).default('0.00').notNull(),
  isActive: boolean("is_active").default(false).notNull(),
  endDate: timestamp("end_date"),
  contributorsCount: integer("contributors_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Crowdfunding Contributions - Contribuciones a campañas
export const crowdfundingContributions = pgTable("crowdfunding_contributions", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => crowdfundingCampaigns.id).notNull(),
  contributorEmail: text("contributor_email"),
  contributorName: text("contributor_name"),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(),
  artistAmount: decimal("artist_amount", { precision: 10, scale: 2 }).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  paymentStatus: text("payment_status", { enum: ["pending", "succeeded", "failed", "refunded"] }).default("pending").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const marketingMetrics = pgTable("marketing_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  spotifyFollowers: integer("spotify_followers").default(0),
  instagramFollowers: integer("instagram_followers").default(0),
  youtubeViews: integer("youtube_views").default(0),
  playlistPlacements: integer("playlist_placements").default(0),
  monthlyListeners: integer("monthly_listeners").default(0),
  totalEngagement: integer("total_engagement").default(0),
  websiteVisits: integer("website_visits").default(0),
  videoUploads: integer("video_uploads").default(0),
  averageViewDuration: decimal("average_view_duration", { precision: 10, scale: 2 }).default('0'),
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default('0'),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const analyticsHistory = pgTable("analytics_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  metricName: text("metric_name").notNull(),
  metricValue: decimal("metric_value", { precision: 10, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  source: text("source").notNull(),
  metadata: json("metadata")
});

export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status", { enum: ["draft", "active", "completed"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  metadata: json("metadata")
});

// @ts-expect-error - Circular reference with bookings table is necessary for relational integrity
export const audioDemos = pgTable("audio_demos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  musicianId: text("musician_id").notNull(),
  prompt: text("prompt").notNull(),
  audioUrl: text("audio_url").notNull(),
  requestId: text("request_id").unique().notNull(),
  duration: integer("duration"),
  status: text("status", { enum: ["pending", "completed", "failed"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  bookingId: integer("booking_id").references(() => bookings.id)
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  bookingId: integer("booking_id").references(() => bookings.id).notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique().notNull(),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(),
  musicianAmount: decimal("musician_amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd").notNull(),
  status: text("status", { enum: ["pending", "succeeded", "failed", "refunded"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadata: json("metadata")
});

export const musicians = pgTable("musicians", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  photo: text("photo").notNull(),
  referencePhoto: text("reference_photo"),
  instrument: text("instrument").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  rating: decimal("rating", { precision: 3, scale: 2 }).default('5.0').notNull(),
  totalReviews: integer("total_reviews").default(0).notNull(),
  genres: text("genres").array().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// @ts-expect-error - Circular reference with audioDemos table is necessary for relational integrity
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  musicianId: integer("musician_id").references(() => musicians.id).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd").notNull(),
  tempo: text("tempo"),
  musicalKey: text("musical_key"),
  style: text("style"),
  projectDeadline: timestamp("project_deadline"),
  additionalNotes: text("additional_notes"),
  status: text("status", { enum: ["pending", "accepted", "completed", "cancelled"] }).default("pending").notNull(),
  paymentStatus: text("payment_status", { enum: ["pending", "paid", "failed", "refunded"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  audioDemoId: integer("audio_demo_id").references(() => audioDemos.id)
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  location: text("location"),
  type: text("type", { enum: ["concert", "release", "promotion", "other"] }).default("other").notNull(),
  status: text("status", { enum: ["upcoming", "ongoing", "completed", "cancelled"] }).default("upcoming").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadata: json("metadata")
});

export const investors = pgTable("investors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  country: text("country").notNull(),
  investmentAmount: decimal("investment_amount", { precision: 10, scale: 2 }).notNull(),
  investmentGoals: text("investment_goals").notNull(),
  riskTolerance: text("risk_tolerance", { enum: ["low", "medium", "high"] }).notNull(),
  investorType: text("investor_type", { enum: ["individual", "corporate", "institutional"] }).notNull(),
  termsAccepted: boolean("terms_accepted").default(false).notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const managerTasks = pgTable("manager_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["pending", "in_progress", "completed", "cancelled"] }).default("pending").notNull(),
  priority: text("priority", { enum: ["low", "medium", "high"] }).default("medium").notNull(),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const managerContacts = pgTable("manager_contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  role: text("role"),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const managerSchedule = pgTable("manager_schedule", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location"),
  type: text("type", { enum: ["meeting", "rehearsal", "performance", "other"] }).default("other").notNull(),
  status: text("status", { enum: ["scheduled", "completed", "cancelled"] }).default("scheduled").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const managerNotes = pgTable("manager_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category", { enum: ["general", "meeting", "idea", "todo"] }).default("general").notNull(),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const courseInstructors = pgTable("course_instructors", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  bio: text("bio"),
  specialization: text("specialization"),
  yearsOfExperience: integer("years_of_experience"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  instructorId: integer("instructor_id").references(() => courseInstructors.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  level: text("level", { enum: ["Beginner", "Intermediate", "Advanced"] }).notNull(),
  duration: text("duration").notNull(),
  lessonsCount: integer("lessons_count").notNull(),
  thumbnail: text("thumbnail"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default('0'),
  totalReviews: integer("total_reviews").default(0),
  status: text("status", { enum: ["draft", "published", "archived"] }).default("draft").notNull(),
  dripStrategy: text("drip_strategy", { enum: ["date", "enrollment", "sequential", "prerequisite"] }).default("sequential").notNull(),
  isAIGenerated: boolean("is_ai_generated").default(false).notNull(),
  generationStatus: text("generation_status", { enum: ["pending", "generating", "completed", "failed"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const courseLessons = pgTable("course_lessons", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  content: text("content").notNull(),
  duration: integer("duration").notNull(),
  orderIndex: integer("order_index").notNull(),
  videoUrl: text("video_url"),
  imageUrl: text("image_url"),
  materials: json("materials"),
  dripDate: timestamp("drip_date"),
  dripDaysOffset: integer("drip_days_offset"),
  prerequisiteLessonId: integer("prerequisite_lesson_id"),
  isGenerated: boolean("is_generated").default(false).notNull(),
  generationStatus: text("generation_status", { enum: ["pending", "generating", "completed", "failed"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const courseEnrollments = pgTable("course_enrollments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  status: text("status", { enum: ["active", "completed", "cancelled"] }).default("active").notNull(),
  progress: integer("progress").default(0),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at")
});

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  badgeImage: text("badge_image").notNull(),
  type: text("type", {
    enum: ["course_completion", "streak", "participation", "excellence"]
  }).notNull(),
  requirements: json("requirements").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  achievementId: integer("achievement_id").references(() => achievements.id).notNull(),
  courseId: integer("course_id").references(() => courses.id),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
  metadata: json("metadata")
});

export const courseReviews = pgTable("course_reviews", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  courseId: integer("course_id").references(() => courses.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const courseQuizzes = pgTable("course_quizzes", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").references(() => courseLessons.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  passingScore: integer("passing_score").default(70).notNull(),
  orderIndex: integer("order_index").notNull(),
  isGenerated: boolean("is_generated").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const quizQuestions = pgTable("quiz_questions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").references(() => courseQuizzes.id).notNull(),
  question: text("question").notNull(),
  questionType: text("question_type", { enum: ["multiple_choice", "true_false", "short_answer"] }).default("multiple_choice").notNull(),
  options: json("options").$type<string[]>(),
  correctAnswer: text("correct_answer").notNull(),
  explanation: text("explanation"),
  points: integer("points").default(1).notNull(),
  orderIndex: integer("order_index").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  quizId: integer("quiz_id").references(() => courseQuizzes.id).notNull(),
  score: integer("score").notNull(),
  totalPoints: integer("total_points").notNull(),
  passed: boolean("passed").notNull(),
  answers: json("answers").$type<Record<string, string>>(),
  completedAt: timestamp("completed_at").defaultNow().notNull()
});

export const lessonProgress = pgTable("lesson_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  lessonId: integer("lesson_id").references(() => courseLessons.id).notNull(),
  completed: boolean("completed").default(false).notNull(),
  unlockedAt: timestamp("unlocked_at"),
  completedAt: timestamp("completed_at"),
  timeSpentMinutes: integer("time_spent_minutes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const contentGenerationQueue = pgTable("content_generation_queue", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").references(() => courses.id),
  lessonId: integer("lesson_id").references(() => courseLessons.id),
  generationType: text("generation_type", { enum: ["course_outline", "lesson_content", "quiz", "image"] }).notNull(),
  prompt: text("prompt").notNull(),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).default("pending").notNull(),
  result: json("result"),
  errorMessage: text("error_message"),
  priority: integer("priority").default(5).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at")
});

export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  marketingMetrics: many(marketingMetrics),
  analyticsHistory: many(analyticsHistory),
  contracts: many(contracts),
  bookings: many(bookings),
  audioDemos: many(audioDemos),
  events: many(events),
  achievements: many(userAchievements),
  media: many(artistMedia),
  musicians: many(musicians),
  songs: many(songs),
  merchandise: many(merchandise),
  crowdfundingCampaigns: many(crowdfundingCampaigns)
}));

export const musiciansRelations = relations(musicians, ({ one, many }) => ({
  user: one(users, {
    fields: [musicians.userId],
    references: [users.id],
  }),
  bookings: many(bookings)
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
  musician: one(musicians, {
    fields: [bookings.musicianId],
    references: [musicians.id],
  }),
  audioDemo: one(audioDemos, {
    fields: [bookings.audioDemoId],
    references: [audioDemos.id],
  }),
  payments: many(payments)
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, {
    fields: [payments.bookingId],
    references: [bookings.id],
  }),
}));

export const audioDemosRelations = relations(audioDemos, ({ one }) => ({
  user: one(users, {
    fields: [audioDemos.userId],
    references: [users.id],
  }),
  booking: one(bookings, {
    fields: [audioDemos.bookingId],
    references: [bookings.id],
  }),
}));

export const marketingMetricsRelations = relations(marketingMetrics, ({ one }) => ({
  user: one(users, {
    fields: [marketingMetrics.userId],
    references: [users.id],
  }),
}));

export const analyticsHistoryRelations = relations(analyticsHistory, ({ one }) => ({
  user: one(users, {
    fields: [analyticsHistory.userId],
    references: [users.id],
  }),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  user: one(users, {
    fields: [events.userId],
    references: [users.id],
  }),
}));

export const managerToolsRelations = relations(users, ({ many }) => ({
  tasks: many(managerTasks),
  contacts: many(managerContacts),
  schedule: many(managerSchedule),
  notes: many(managerNotes)
}));

export const courseInstructorsRelations = relations(courseInstructors, ({ one, many }) => ({
  user: one(users, {
    fields: [courseInstructors.userId],
    references: [users.id],
  }),
  courses: many(courses)
}));

export const coursesRelations = relations(courses, ({ one, many }) => ({
  instructor: one(courseInstructors, {
    fields: [courses.instructorId],
    references: [courseInstructors.id],
  }),
  lessons: many(courseLessons),
  enrollments: many(courseEnrollments),
  reviews: many(courseReviews)
}));

export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements)
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
  course: one(courses, {
    fields: [userAchievements.courseId],
    references: [courses.id],
  })
}));

export const performanceSegments = pgTable("performance_segments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  sceneId: integer("scene_id").notNull(),
  startTime: decimal("start_time", { precision: 10, scale: 3 }).notNull(),
  endTime: decimal("end_time", { precision: 10, scale: 3 }).notNull(),
  duration: decimal("duration", { precision: 10, scale: 3 }).notNull(),
  lyrics: text("lyrics"),
  shotType: text("shot_type"),
  audioSegmentUrl: text("audio_segment_url"),
  artistImageUrl: text("artist_image_url"),
  lipsyncVideoUrl: text("lipsync_video_url"),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).default("pending").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const userCredits = pgTable("user_credits", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull().unique(),
  credits: integer("credits").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  amount: integer("amount").notNull(),
  type: text("type", { enum: ["purchase", "deduction", "refund", "bonus"] }).notNull(),
  description: text("description").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  relatedProjectId: integer("related_project_id"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const musicVideoProjects = pgTable("music_video_projects", {
  id: serial("id").primaryKey(),
  userEmail: text("user_email").notNull(),
  projectName: text("project_name").notNull(),
  
  // Audio data
  audioUrl: text("audio_url"),
  audioDuration: decimal("audio_duration", { precision: 10, scale: 2 }),
  transcription: text("transcription"),
  
  // Script data
  scriptContent: text("script_content"),
  
  // Timeline data (JSON con todos los items del timeline)
  timelineItems: json("timeline_items").$type<any[]>(),
  scenes: json("scenes").$type<any[]>(),
  
  // Style & Director data
  selectedDirector: json("selected_director"),
  selectedConcept: json("selected_concept"),
  videoStyle: json("video_style"),
  
  // Reference images & artist info
  artistReferenceImages: json("artist_reference_images").$type<string[]>(),
  artistName: text("artist_name"),
  songName: text("song_name"),
  thumbnail: text("thumbnail"),
  
  // Editing style
  selectedEditingStyle: json("selected_editing_style"),
  
  // Video format
  aspectRatio: text("aspect_ratio"),
  
  // Auto-generated Artist Profile
  artistProfileId: integer("artist_profile_id").references(() => users.id, { onDelete: "cascade" }),
  
  // Project status
  status: text("status", { 
    enum: ["draft", "generating_script", "generating_images", "generating_videos", "demo_generation", "demo_completed", "payment_pending", "full_generation", "completed", "failed"] 
  }).default("draft").notNull(),
  
  // Progress tracking
  progress: json("progress").$type<{
    scriptGenerated: boolean;
    imagesGenerated: number;
    totalImages: number;
    videosGenerated: number;
    totalVideos: number;
  }>(),
  generatedImagesCount: integer("generated_images_count").default(0),
  totalImagesTarget: integer("total_images_target").default(40),
  
  // Output
  finalVideoUrl: text("final_video_url"),
  
  // Payment
  isPaid: boolean("is_paid").default(false).notNull(),
  paidAt: timestamp("paid_at"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }),
  stripePaymentId: text("stripe_payment_id"),
  creditsUsed: integer("credits_used").default(0).notNull(),
  
  // Metadata
  tags: json("tags").$type<string[]>(),
  lastModified: timestamp("last_modified").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// 🎬 MUSIC VIDEO CONCEPTS — Stores all 3 director concepts with full details for reuse/modification
export const musicVideoConcepts = pgTable("music_video_concepts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => musicVideoProjects.id, { onDelete: "cascade" }).notNull(),
  userEmail: text("user_email").notNull(),
  
  // Concept identity
  conceptType: text("concept_type", { 
    enum: ["narrative", "abstract", "performance"] 
  }).notNull(),
  conceptIndex: integer("concept_index").notNull(), // 0, 1, 2
  title: text("title").notNull(),
  
  // Creative content (full details)
  storyConcept: text("story_concept"), // 200+ word description
  visualTheme: text("visual_theme"),
  mood: text("mood"),
  
  // Structured data stored as JSON for flexibility
  colorPalette: json("color_palette").$type<{
    primary_colors: string[];
    accent_colors: string[];
    mood_colors: string;
  }>(),
  wardrobe: json("wardrobe").$type<{
    main_outfit: string;
    alternative_looks: string[];
    style_notes: string;
  }>(),
  locations: json("locations").$type<{
    name: string;
    description: string;
    mood: string;
  }[]>(),
  iconicMoments: json("iconic_moments").$type<{
    timestamp: string;
    description: string;
    why_iconic: string;
  }[]>(),
  keyScenes: json("key_scenes").$type<{
    timestamp: string;
    description: string;
    visual_style: string;
    camera_movement: string;
  }[]>(),
  directorTechniques: json("director_techniques").$type<string[]>(),
  musicVideoReferences: json("music_video_references").$type<string[]>(),
  
  // Director context
  directorName: text("director_name"),
  
  // Generated poster
  coverImageUrl: text("cover_image_url"),
  imageProvider: text("image_provider"),
  
  // Music metadata at time of generation
  musicGenre: text("music_genre"),
  emotionalArc: text("emotional_arc"),
  
  // Selection state
  isSelected: boolean("is_selected").default(false).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const artistProfileImages = pgTable("artist_profile_images", {
  id: serial("id").primaryKey(),
  artistProfileId: integer("artist_profile_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  musicVideoProjectId: integer("music_video_project_id").references(() => musicVideoProjects.id, { onDelete: "cascade" }),
  
  imageUrl: text("image_url").notNull(),
  imageType: text("image_type", { 
    enum: ["concept", "scene", "reference", "banner", "profile", "generated"] 
  }).notNull(),
  
  title: text("title"),
  description: text("description"),
  
  sceneMetadata: json("scene_metadata").$type<{
    sceneNumber?: number;
    shotType?: string;
    mood?: string;
    timestamp?: number;
  }>(),
  
  isPublic: boolean("is_public").default(true).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const musicianClips = pgTable("musician_clips", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => musicVideoProjects.id, { onDelete: "cascade" }),
  timelineItemId: text("timeline_item_id").notNull(),
  
  musicianType: text("musician_type", { 
    enum: ["guitar", "piano", "bass", "drums", "vocals", "saxophone", "trumpet", "violin", "other"] 
  }).notNull(),
  
  characterDescription: text("character_description"),
  faceReferenceUrl: text("face_reference_url"),
  
  generatedImageUrl: text("generated_image_url"),
  nanoBananaVideoUrl: text("nano_banana_video_url"),
  
  scriptContext: text("script_context"),
  cutTimestamp: decimal("cut_timestamp", { precision: 10, scale: 2 }),
  
  status: text("status", { 
    enum: ["pending", "generating", "completed", "failed"] 
  }).default("pending").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Spotify Curators - Saved curators for outreach
export const spotifyCurators = pgTable("spotify_curators", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Curator info
  curatorName: text("curator_name").notNull(),
  curatorType: text("curator_type").notNull(), // "Independent Curator", "Label Curator", etc.
  playlistName: text("playlist_name"),
  playlistFocus: text("playlist_focus"), // Genre/style focus
  playlistUrl: text("playlist_url"),
  estimatedFollowers: text("estimated_followers"),
  
  // Contact info
  email: text("email"),
  instagram: text("instagram"),
  twitter: text("twitter"),
  website: text("website"),
  
  // Metadata
  genre: text("genre").notNull(),
  notes: text("notes"), // Personal notes from artist
  contacted: boolean("contacted").default(false).notNull(),
  contactedAt: timestamp("contacted_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const artistMediaRelations = relations(artistMedia, ({ one }) => ({
  user: one(users, {
    fields: [artistMedia.userId],
    references: [users.id],
  }),
}));

export const songsRelations = relations(songs, ({ one }) => ({
  user: one(users, {
    fields: [songs.userId],
    references: [users.id],
  }),
}));

export const merchandiseRelations = relations(merchandise, ({ one }) => ({
  user: one(users, {
    fields: [merchandise.userId],
    references: [users.id],
  }),
}));

export const crowdfundingCampaignsRelations = relations(crowdfundingCampaigns, ({ one, many }) => ({
  user: one(users, {
    fields: [crowdfundingCampaigns.userId],
    references: [users.id],
  }),
  contributions: many(crowdfundingContributions),
}));

export const crowdfundingContributionsRelations = relations(crowdfundingContributions, ({ one }) => ({
  campaign: one(crowdfundingCampaigns, {
    fields: [crowdfundingContributions.campaignId],
    references: [crowdfundingCampaigns.id],
  }),
}));

export const musicianClipsRelations = relations(musicianClips, ({ one }) => ({
  project: one(musicVideoProjects, {
    fields: [musicianClips.projectId],
    references: [musicVideoProjects.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertBookingSchema = createInsertSchema(bookings);
export const selectBookingSchema = createSelectSchema(bookings);
export const insertAudioDemoSchema = createInsertSchema(audioDemos);
export const selectAudioDemoSchema = createSelectSchema(audioDemos);
export const insertPaymentSchema = createInsertSchema(payments);
export const selectPaymentSchema = createSelectSchema(payments);
export const insertMarketingMetricsSchema = createInsertSchema(marketingMetrics);
export const selectMarketingMetricsSchema = createSelectSchema(marketingMetrics);
export const insertAnalyticsHistorySchema = createInsertSchema(analyticsHistory);
export const selectAnalyticsHistorySchema = createSelectSchema(analyticsHistory);
export const insertEventSchema = createInsertSchema(events);
export const selectEventSchema = createSelectSchema(events);
export const insertInvestorSchema = createInsertSchema(investors)
  .omit({ id: true, createdAt: true, updatedAt: true });
export const selectInvestorSchema = createSelectSchema(investors);
export type InsertInvestor = z.infer<typeof insertInvestorSchema>;
export type SelectInvestor = typeof investors.$inferSelect;
export const insertManagerTaskSchema = createInsertSchema(managerTasks);
export const selectManagerTaskSchema = createSelectSchema(managerTasks);
export const insertManagerContactSchema = createInsertSchema(managerContacts);
export const selectManagerContactSchema = createSelectSchema(managerContacts);
export const insertManagerScheduleSchema = createInsertSchema(managerSchedule);
export const selectManagerScheduleSchema = createSelectSchema(managerSchedule);
export const insertManagerNoteSchema = createInsertSchema(managerNotes);

export const insertUserCreditSchema = createInsertSchema(userCredits).omit({ id: true, createdAt: true, updatedAt: true });
export const selectUserCreditSchema = createSelectSchema(userCredits);
export type InsertUserCredit = z.infer<typeof insertUserCreditSchema>;
export type SelectUserCredit = typeof userCredits.$inferSelect;

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({ id: true, createdAt: true });
export const selectCreditTransactionSchema = createSelectSchema(creditTransactions);
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type SelectCreditTransaction = typeof creditTransactions.$inferSelect;

export const insertMusicVideoProjectSchema = createInsertSchema(musicVideoProjects).omit({ id: true, createdAt: true, updatedAt: true });
export const selectMusicVideoProjectSchema = createSelectSchema(musicVideoProjects);
export type InsertMusicVideoProject = z.infer<typeof insertMusicVideoProjectSchema>;
export type SelectMusicVideoProject = typeof musicVideoProjects.$inferSelect;

export const insertArtistProfileImageSchema = createInsertSchema(artistProfileImages).omit({ id: true, createdAt: true, updatedAt: true });
export const selectArtistProfileImageSchema = createSelectSchema(artistProfileImages);
export type InsertArtistProfileImage = z.infer<typeof insertArtistProfileImageSchema>;
export type SelectArtistProfileImage = typeof artistProfileImages.$inferSelect;

// Electronic Press Kit — persisted master EPK JSON per artist.
// Holds the full press kit document so we never re-generate on every view/PDF.
export const artistEpks = pgTable("artist_epks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  slug: text("slug").notNull().unique(),
  // Full EPK document (bio, factSheet, achievements, photos, links, contacts, master JSON snapshot, ...)
  epkData: jsonb("epk_data").notNull(),
  // Snapshot of users.masterJson at generation time, for audit/regen consistency
  masterSnapshot: jsonb("master_snapshot"),
  version: integer("version").default(1).notNull(),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  lastViewedAt: timestamp("last_viewed_at"),
  views: integer("views").default(0).notNull(),
  isPublic: boolean("is_public").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertArtistEpkSchema = createInsertSchema(artistEpks).omit({ id: true, createdAt: true, updatedAt: true });
export const selectArtistEpkSchema = createSelectSchema(artistEpks);
export type InsertArtistEpk = z.infer<typeof insertArtistEpkSchema>;
export type SelectArtistEpk = typeof artistEpks.$inferSelect;

export const selectManagerNoteSchema = createSelectSchema(managerNotes);

export const insertCourseInstructorSchema = createInsertSchema(courseInstructors);
export const selectCourseInstructorSchema = createSelectSchema(courseInstructors);
export const insertCourseSchema = createInsertSchema(courses);
export const selectCourseSchema = createSelectSchema(courses);
export const insertCourseLessonSchema = createInsertSchema(courseLessons);
export const selectCourseLessonSchema = createSelectSchema(courseLessons);
export const insertCourseEnrollmentSchema = createInsertSchema(courseEnrollments);
export const selectCourseEnrollmentSchema = createSelectSchema(courseEnrollments);
export const insertCourseReviewSchema = createInsertSchema(courseReviews);
export const selectCourseReviewSchema = createSelectSchema(courseReviews);

export const insertCourseQuizSchema = createInsertSchema(courseQuizzes).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCourseQuizSchema = createSelectSchema(courseQuizzes);
export type InsertCourseQuiz = z.infer<typeof insertCourseQuizSchema>;
export type SelectCourseQuiz = typeof courseQuizzes.$inferSelect;

export const insertQuizQuestionSchema = createInsertSchema(quizQuestions).omit({ id: true, createdAt: true });
export const selectQuizQuestionSchema = createSelectSchema(quizQuestions);
export type InsertQuizQuestion = z.infer<typeof insertQuizQuestionSchema>;
export type SelectQuizQuestion = typeof quizQuestions.$inferSelect;

export const insertQuizAttemptSchema = createInsertSchema(quizAttempts).omit({ id: true, completedAt: true });
export const selectQuizAttemptSchema = createSelectSchema(quizAttempts);
export type InsertQuizAttempt = z.infer<typeof insertQuizAttemptSchema>;
export type SelectQuizAttempt = typeof quizAttempts.$inferSelect;

export const insertLessonProgressSchema = createInsertSchema(lessonProgress).omit({ id: true, createdAt: true, updatedAt: true });
export const selectLessonProgressSchema = createSelectSchema(lessonProgress);
export type InsertLessonProgress = z.infer<typeof insertLessonProgressSchema>;
export type SelectLessonProgress = typeof lessonProgress.$inferSelect;

export const insertContentGenerationQueueSchema = createInsertSchema(contentGenerationQueue).omit({ id: true, createdAt: true, completedAt: true });
export const selectContentGenerationQueueSchema = createSelectSchema(contentGenerationQueue);
export type InsertContentGenerationQueue = z.infer<typeof insertContentGenerationQueueSchema>;
export type SelectContentGenerationQueue = typeof contentGenerationQueue.$inferSelect;

export const insertAchievementSchema = createInsertSchema(achievements);
export const selectAchievementSchema = createSelectSchema(achievements);
export const insertUserAchievementSchema = createInsertSchema(userAchievements);
export const selectUserAchievementSchema = createSelectSchema(userAchievements);

export const insertArtistMediaSchema = createInsertSchema(artistMedia);
export const selectArtistMediaSchema = createSelectSchema(artistMedia);

export const insertCrowdfundingCampaignSchema = createInsertSchema(crowdfundingCampaigns).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCrowdfundingCampaignSchema = createSelectSchema(crowdfundingCampaigns);
export type InsertCrowdfundingCampaign = z.infer<typeof insertCrowdfundingCampaignSchema>;
export type SelectCrowdfundingCampaign = typeof crowdfundingCampaigns.$inferSelect;

export const insertCrowdfundingContributionSchema = createInsertSchema(crowdfundingContributions).omit({ id: true, createdAt: true });
export const selectCrowdfundingContributionSchema = createSelectSchema(crowdfundingContributions);
export type InsertCrowdfundingContribution = z.infer<typeof insertCrowdfundingContributionSchema>;
export type SelectCrowdfundingContribution = typeof crowdfundingContributions.$inferSelect;

export const insertSongSchema = createInsertSchema(songs)
  .omit({ id: true, createdAt: true, updatedAt: true });
export const selectSongSchema = createSelectSchema(songs);

export const insertMerchandiseSchema = createInsertSchema(merchandise)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    price: z.union([z.string(), z.number()]).transform(val => String(val)),
  });
export const selectMerchandiseSchema = createSelectSchema(merchandise);

// Artist Wallet Schemas
export const insertArtistWalletSchema = createInsertSchema(artistWallet)
  .omit({ id: true, updatedAt: true });
export const selectArtistWalletSchema = createSelectSchema(artistWallet);

// Sales Transactions Schemas  
export const insertSalesTransactionSchema = createInsertSchema(salesTransactions)
  .omit({ id: true, createdAt: true });
export const selectSalesTransactionSchema = createSelectSchema(salesTransactions);

// Wallet Transactions Schemas
export const insertWalletTransactionSchema = createInsertSchema(walletTransactions)
  .omit({ id: true, createdAt: true });
export const selectWalletTransactionSchema = createSelectSchema(walletTransactions);

export const insertMusicianSchema = createInsertSchema(musicians)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    price: z.union([z.string(), z.number()]).transform(val => String(val)),
    rating: z.union([z.string(), z.number()]).transform(val => String(val)).optional(),
  });
export const selectMusicianSchema = createSelectSchema(musicians);

export const insertPerformanceSegmentSchema = createInsertSchema(performanceSegments)
  .omit({ id: true, createdAt: true, updatedAt: true });
export const selectPerformanceSegmentSchema = createSelectSchema(performanceSegments);

export const insertMusicianClipSchema = createInsertSchema(musicianClips)
  .omit({ id: true, createdAt: true, updatedAt: true });
export const selectMusicianClipSchema = createSelectSchema(musicianClips);
export type InsertMusicianClip = z.infer<typeof insertMusicianClipSchema>;
export type SelectMusicianClip = typeof musicianClips.$inferSelect;

export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;
export type SelectBooking = typeof bookings.$inferSelect;
export type InsertAudioDemo = typeof audioDemos.$inferInsert;
export type SelectAudioDemo = typeof audioDemos.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;
export type SelectPayment = typeof payments.$inferSelect;
export type InsertMarketingMetrics = typeof marketingMetrics.$inferInsert;
export type SelectMarketingMetrics = typeof marketingMetrics.$inferSelect;
export type InsertAnalyticsHistory = typeof analyticsHistory.$inferInsert;
export type SelectAnalyticsHistory = typeof analyticsHistory.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;
export type SelectEvent = typeof events.$inferSelect;
export type InsertManagerTask = typeof managerTasks.$inferInsert;
export type SelectManagerTask = typeof managerTasks.$inferSelect;
export type InsertManagerContact = typeof managerContacts.$inferInsert;
export type SelectManagerContact = typeof managerContacts.$inferSelect;
export type InsertManagerSchedule = typeof managerSchedule.$inferInsert;
export type SelectManagerSchedule = typeof managerSchedule.$inferSelect;
export type InsertManagerNote = typeof managerNotes.$inferInsert;
export type SelectManagerNote = typeof managerNotes.$inferSelect;

export type InsertCourseInstructor = typeof courseInstructors.$inferInsert;
export type SelectCourseInstructor = typeof courseInstructors.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;
export type SelectCourse = typeof courses.$inferSelect;
export type InsertCourseLesson = typeof courseLessons.$inferInsert;
export type SelectCourseLesson = typeof courseLessons.$inferSelect;
export type InsertCourseEnrollment = typeof courseEnrollments.$inferInsert;
export type SelectCourseEnrollment = typeof courseEnrollments.$inferSelect;
export type InsertCourseReview = typeof courseReviews.$inferInsert;
export type SelectCourseReview = typeof courseReviews.$inferSelect;

export type InsertAchievement = typeof achievements.$inferInsert;
export type SelectAchievement = typeof achievements.$inferSelect;
export type InsertUserAchievement = typeof userAchievements.$inferInsert;
export type SelectUserAchievement = typeof userAchievements.$inferSelect;
export type InsertArtistMedia = typeof artistMedia.$inferInsert;
export type SelectArtistMedia = typeof artistMedia.$inferSelect;
export type InsertSong = typeof songs.$inferInsert;
export type SelectSong = typeof songs.$inferSelect;
export type InsertMerchandise = typeof merchandise.$inferInsert;
export type SelectMerchandise = typeof merchandise.$inferSelect;
export type InsertMusician = typeof musicians.$inferInsert;
export type SelectMusician = typeof musicians.$inferSelect;


export const generatedVideos = pgTable("generated_videos", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  songName: text("song_name").notNull(),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration").notNull(),
  isPaid: boolean("is_paid").default(false).notNull(),
  paymentIntentId: text("payment_intent_id"),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  metadata: json("metadata"),
  status: text("status", { enum: ["generating", "completed", "failed"] }).default("generating").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertGeneratedVideoSchema = createInsertSchema(generatedVideos);
export const selectGeneratedVideoSchema = createSelectSchema(generatedVideos);
export type GeneratedVideo = typeof generatedVideos.$inferSelect;
export type NewGeneratedVideo = typeof generatedVideos.$inferInsert;

// ============================================
// TOKENIZATION SYSTEM (Web3/Blockchain)
// ============================================

export const tokenizedSongs = pgTable("tokenized_songs", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  songName: text("song_name").notNull(),
  songUrl: text("song_url"),
  tokenId: integer("token_id").notNull().unique(), // ID in the ERC-1155 smart contract
  tokenSymbol: varchar("token_symbol", { length: 20 }).notNull(), // ej: "SONG-001"
  totalSupply: integer("total_supply").notNull(), // Total tokens minted
  availableSupply: integer("available_supply").notNull(), // Tokens still for sale
  pricePerTokenUsd: decimal("price_per_token_usd", { precision: 10, scale: 2 }).notNull(),
  pricePerTokenEth: decimal("price_per_token_eth", { precision: 18, scale: 8 }), // Cached ETH price
  royaltyPercentageArtist: integer("royalty_percentage_artist").default(80).notNull(), // 80%
  royaltyPercentagePlatform: integer("royalty_percentage_platform").default(20).notNull(), // 20%
  contractAddress: varchar("contract_address", { length: 42 }).notNull(), // Ethereum address
  metadataUri: text("metadata_uri"), // IPFS or server URL for token metadata
  imageUrl: text("image_url"), // Cover art for the token
  description: text("description"),
  benefits: text("benefits").array(), // Benefits for token holders
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => [
  index("idx_tokenized_songs_artist").on(table.artistId),
  index("idx_tokenized_songs_token_id").on(table.tokenId),
  index("idx_tokenized_songs_active").on(table.isActive)
]);

export const tokenPurchases = pgTable("token_purchases", {
  id: serial("id").primaryKey(),
  tokenizedSongId: integer("tokenized_song_id").notNull().references(() => tokenizedSongs.id, { onDelete: "cascade" }),
  buyerWalletAddress: varchar("buyer_wallet_address", { length: 42 }).notNull(), // Ethereum address
  buyerUserId: integer("buyer_user_id").references(() => users.id, { onDelete: "set null" }), // Optional if user is registered
  amountTokens: integer("amount_tokens").notNull(),
  pricePaidEth: decimal("price_paid_eth", { precision: 18, scale: 8 }).notNull(),
  pricePaidUsd: decimal("price_paid_usd", { precision: 10, scale: 2 }),
  artistEarningsEth: decimal("artist_earnings_eth", { precision: 18, scale: 8 }).notNull(),
  platformEarningsEth: decimal("platform_earnings_eth", { precision: 18, scale: 8 }).notNull(),
  transactionHash: varchar("transaction_hash", { length: 66 }).notNull().unique(), // 0x + 64 chars
  blockNumber: integer("block_number"),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, confirmed, failed
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  index("idx_token_purchases_song").on(table.tokenizedSongId),
  index("idx_token_purchases_buyer").on(table.buyerWalletAddress),
  index("idx_token_purchases_tx").on(table.transactionHash),
  index("idx_token_purchases_status").on(table.status)
]);

export const artistTokenEarnings = pgTable("artist_token_earnings", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenizedSongId: integer("tokenized_song_id").notNull().references(() => tokenizedSongs.id, { onDelete: "cascade" }),
  purchaseId: integer("purchase_id").notNull().references(() => tokenPurchases.id, { onDelete: "cascade" }),
  amountEth: decimal("amount_eth", { precision: 18, scale: 8 }).notNull(),
  amountUsd: decimal("amount_usd", { precision: 10, scale: 2 }),
  transactionHash: varchar("transaction_hash", { length: 66 }).notNull(),
  withdrawnAt: timestamp("withdrawn_at"), // When artist withdrew to their wallet
  withdrawTxHash: varchar("withdraw_tx_hash", { length: 66 }),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  index("idx_artist_earnings_artist").on(table.artistId),
  index("idx_artist_earnings_song").on(table.tokenizedSongId),
  index("idx_artist_earnings_withdrawn").on(table.withdrawnAt)
]);

// Relations for tokenization
export const tokenizedSongsRelations = relations(tokenizedSongs, ({ one, many }) => ({
  artist: one(users, {
    fields: [tokenizedSongs.artistId],
    references: [users.id],
  }),
  purchases: many(tokenPurchases),
  earnings: many(artistTokenEarnings),
}));

export const tokenPurchasesRelations = relations(tokenPurchases, ({ one }) => ({
  tokenizedSong: one(tokenizedSongs, {
    fields: [tokenPurchases.tokenizedSongId],
    references: [tokenizedSongs.id],
  }),
  buyer: one(users, {
    fields: [tokenPurchases.buyerUserId],
    references: [users.id],
  }),
}));

export const artistTokenEarningsRelations = relations(artistTokenEarnings, ({ one }) => ({
  artist: one(users, {
    fields: [artistTokenEarnings.artistId],
    references: [users.id],
  }),
  tokenizedSong: one(tokenizedSongs, {
    fields: [artistTokenEarnings.tokenizedSongId],
    references: [tokenizedSongs.id],
  }),
  purchase: one(tokenPurchases, {
    fields: [artistTokenEarnings.purchaseId],
    references: [tokenPurchases.id],
  }),
}));

// Zod schemas for validation
export const insertTokenizedSongSchema = createInsertSchema(tokenizedSongs);
export const selectTokenizedSongSchema = createSelectSchema(tokenizedSongs);
export const insertTokenPurchaseSchema = createInsertSchema(tokenPurchases);
export const selectTokenPurchaseSchema = createSelectSchema(tokenPurchases);
export const insertArtistTokenEarningsSchema = createInsertSchema(artistTokenEarnings);
export const selectArtistTokenEarningsSchema = createSelectSchema(artistTokenEarnings);

// TypeScript types
export type TokenizedSong = typeof tokenizedSongs.$inferSelect;
export type NewTokenizedSong = typeof tokenizedSongs.$inferInsert;
export type TokenPurchase = typeof tokenPurchases.$inferSelect;
export type NewTokenPurchase = typeof tokenPurchases.$inferInsert;
export type ArtistTokenEarnings = typeof artistTokenEarnings.$inferSelect;
export type NewArtistTokenEarnings = typeof artistTokenEarnings.$inferInsert;

// Instagram Connections - OAuth tokens and account info
export const instagramConnections = pgTable("instagram_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).unique().notNull(),
  accessToken: text("access_token").notNull(), // Long-lived token (60 days)
  instagramUserId: text("instagram_user_id").notNull(), // Instagram Business Account ID
  instagramUsername: text("instagram_username"),
  pageId: text("page_id").notNull(), // Facebook Page ID
  pageAccessToken: text("page_access_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(), // Token expiration date
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const instagramConnectionsRelations = relations(instagramConnections, ({ one }) => ({
  user: one(users, {
    fields: [instagramConnections.userId],
    references: [users.id],
  }),
}));

// Spotify Curators schemas
export const insertSpotifyCuratorSchema = createInsertSchema(spotifyCurators).omit({ id: true, createdAt: true, updatedAt: true });
export const selectSpotifyCuratorSchema = createSelectSchema(spotifyCurators);
export type InsertSpotifyCurator = z.infer<typeof insertSpotifyCuratorSchema>;
export type SelectSpotifyCurator = typeof spotifyCurators.$inferSelect;

// Instagram Connections schemas
export const insertInstagramConnectionSchema = createInsertSchema(instagramConnections).omit({ id: true, createdAt: true, updatedAt: true });
export const selectInstagramConnectionSchema = createSelectSchema(instagramConnections);
export type InsertInstagramConnection = z.infer<typeof insertInstagramConnectionSchema>;
export type SelectInstagramConnection = typeof instagramConnections.$inferSelect;

// ============================================
// ARTIST FASHION STUDIO TABLES
// ============================================

// Fashion Sessions - Sesiones de asesoría de moda
export const fashionSessions = pgTable("fashion_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sessionType: text("session_type", { 
    enum: ["tryon", "generation", "analysis", "video", "portfolio"] 
  }).notNull(),
  status: text("status", { 
    enum: ["active", "completed", "cancelled"] 
  }).default("active").notNull(),
  metadata: json("metadata").$type<{
    genre?: string;
    mood?: string;
    occasion?: string;
    references?: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Fashion Results - Resultados de try-on, generaciones y análisis
export const fashionResults = pgTable("fashion_results", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => fashionSessions.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  resultType: text("result_type", { 
    enum: ["tryon", "generation", "video", "moodboard"] 
  }).notNull(),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  metadata: json("metadata").$type<{
    modelImage?: string;
    clothingImage?: string;
    prompt?: string;
    falModel?: string;
    duration?: number;
    tags?: string[];
  }>(),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  isPublished: boolean("is_published").default(false).notNull(),
  rating: integer("rating"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Fashion Analysis - Análisis y recomendaciones AI con Gemini
export const fashionAnalysis = pgTable("fashion_analysis", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => fashionSessions.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  analysisType: text("analysis_type", { 
    enum: ["style", "color", "body_type", "genre_coherence", "trend"] 
  }).notNull(),
  imageUrl: text("image_url"),
  recommendations: json("recommendations").$type<{
    styleScore?: number;
    colorPalette?: string[];
    bodyType?: string;
    genreCoherence?: number;
    suggestions?: string[];
  }>(),
  moodBoard: json("mood_board").$type<{
    references?: string[];
    keywords?: string[];
    artistReferences?: string[];
  }>(),
  geminiResponse: text("gemini_response"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Fashion Portfolio - Portfolio de looks del artista
export const fashionPortfolio = pgTable("fashion_portfolio", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  images: text("images").array().notNull(),
  products: json("products").$type<Array<{
    merchandiseId?: number;
    name: string;
    imageUrl: string;
  }>>(),
  category: text("category", { 
    enum: ["concert", "photoshoot", "casual", "red_carpet", "music_video", "social_media"] 
  }).notNull(),
  season: text("season"),
  tags: text("tags").array(),
  isPublic: boolean("is_public").default(false).notNull(),
  likes: integer("likes").default(0).notNull(),
  views: integer("views").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Product Try-On History - Historial de try-on con productos del artista
export const productTryOnHistory = pgTable("product_tryon_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  merchandiseId: integer("merchandise_id").references(() => merchandise.id),
  modelImage: text("model_image").notNull(),
  resultImage: text("result_image").notNull(),
  falModel: text("fal_model").default("fal-ai/idm-vton").notNull(),
  rating: integer("rating"),
  feedback: text("feedback"),
  isPublished: boolean("is_published").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Fashion Videos - Videos generados con Kling mostrando al artista modelando ropa
export const fashionVideos = pgTable("fashion_videos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sessionId: integer("session_id").references(() => fashionSessions.id),
  videoUrl: text("video_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  prompt: text("prompt").notNull(),
  modelImage: text("model_image"),
  clothingImage: text("clothing_image"),
  duration: integer("duration"),
  klingTaskId: text("kling_task_id"),
  status: text("status", { 
    enum: ["processing", "completed", "failed"] 
  }).default("processing").notNull(),
  metadata: json("metadata").$type<{
    falModel?: string;
    style?: string;
    occasion?: string;
  }>(),
  isPublished: boolean("is_published").default(false).notNull(),
  views: integer("views").default(0).notNull(),
  likes: integer("likes").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Artist News - Noticias generadas con IA (Gemini + Nano Banana)
export const artistNews = pgTable("artist_news", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  summary: text("summary").notNull(),
  imageUrl: text("image_url").notNull(),
  category: text("category", { 
    enum: ["release", "performance", "collaboration", "achievement", "lifestyle"] 
  }).notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  views: integer("views").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Notifications - Sistema de notificaciones internas
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // VIDEO_RENDER_DONE, NEW_FAN, PAYMENT_SUCCESS, etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"), // ruta dentro de Boostify (ej: /videos/123)
  read: boolean("read").default(false).notNull(),
  metadata: json("metadata").$type<{
    videoId?: number;
    amount?: number;
    fanName?: string;
    tier?: string;
    [key: string]: any;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations for Fashion Studio tables
export const fashionSessionsRelations = relations(fashionSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [fashionSessions.userId],
    references: [users.id],
  }),
  results: many(fashionResults),
  analysis: many(fashionAnalysis),
  videos: many(fashionVideos),
}));

export const fashionResultsRelations = relations(fashionResults, ({ one }) => ({
  session: one(fashionSessions, {
    fields: [fashionResults.sessionId],
    references: [fashionSessions.id],
  }),
  user: one(users, {
    fields: [fashionResults.userId],
    references: [users.id],
  }),
}));

export const fashionAnalysisRelations = relations(fashionAnalysis, ({ one }) => ({
  session: one(fashionSessions, {
    fields: [fashionAnalysis.sessionId],
    references: [fashionSessions.id],
  }),
  user: one(users, {
    fields: [fashionAnalysis.userId],
    references: [users.id],
  }),
}));

export const fashionPortfolioRelations = relations(fashionPortfolio, ({ one }) => ({
  user: one(users, {
    fields: [fashionPortfolio.userId],
    references: [users.id],
  }),
}));

export const productTryOnHistoryRelations = relations(productTryOnHistory, ({ one }) => ({
  user: one(users, {
    fields: [productTryOnHistory.userId],
    references: [users.id],
  }),
  merchandise: one(merchandise, {
    fields: [productTryOnHistory.merchandiseId],
    references: [merchandise.id],
  }),
}));

export const fashionVideosRelations = relations(fashionVideos, ({ one }) => ({
  user: one(users, {
    fields: [fashionVideos.userId],
    references: [users.id],
  }),
  session: one(fashionSessions, {
    fields: [fashionVideos.sessionId],
    references: [fashionSessions.id],
  }),
}));

// Fashion Studio Schemas
export const insertFashionSessionSchema = createInsertSchema(fashionSessions).omit({ id: true, createdAt: true, updatedAt: true });
export const selectFashionSessionSchema = createSelectSchema(fashionSessions);
export type InsertFashionSession = z.infer<typeof insertFashionSessionSchema>;
export type SelectFashionSession = typeof fashionSessions.$inferSelect;

export const insertFashionResultSchema = createInsertSchema(fashionResults).omit({ id: true, createdAt: true });
export const selectFashionResultSchema = createSelectSchema(fashionResults);
export type InsertFashionResult = z.infer<typeof insertFashionResultSchema>;
export type SelectFashionResult = typeof fashionResults.$inferSelect;

export const insertFashionAnalysisSchema = createInsertSchema(fashionAnalysis).omit({ id: true, createdAt: true });
export const selectFashionAnalysisSchema = createSelectSchema(fashionAnalysis);
export type InsertFashionAnalysis = z.infer<typeof insertFashionAnalysisSchema>;
export type SelectFashionAnalysis = typeof fashionAnalysis.$inferSelect;

export const insertFashionPortfolioSchema = createInsertSchema(fashionPortfolio).omit({ id: true, createdAt: true, updatedAt: true });
export const selectFashionPortfolioSchema = createSelectSchema(fashionPortfolio);
export type InsertFashionPortfolio = z.infer<typeof insertFashionPortfolioSchema>;
export type SelectFashionPortfolio = typeof fashionPortfolio.$inferSelect;

export const insertProductTryOnHistorySchema = createInsertSchema(productTryOnHistory).omit({ id: true, createdAt: true });
export const selectProductTryOnHistorySchema = createSelectSchema(productTryOnHistory);
export type InsertProductTryOnHistory = z.infer<typeof insertProductTryOnHistorySchema>;
export type SelectProductTryOnHistory = typeof productTryOnHistory.$inferSelect;

export const insertFashionVideoSchema = createInsertSchema(fashionVideos).omit({ id: true, createdAt: true, updatedAt: true });
export const selectFashionVideoSchema = createSelectSchema(fashionVideos);
export type InsertFashionVideo = z.infer<typeof insertFashionVideoSchema>;
export type SelectFashionVideo = typeof fashionVideos.$inferSelect;

// Artist News Relations
export const artistNewsRelations = relations(artistNews, ({ one }) => ({
  user: one(users, {
    fields: [artistNews.userId],
    references: [users.id],
  }),
}));

// Artist News Schemas
export const insertArtistNewsSchema = createInsertSchema(artistNews).omit({ id: true, createdAt: true, updatedAt: true });
export const selectArtistNewsSchema = createSelectSchema(artistNews);
export type InsertArtistNews = z.infer<typeof insertArtistNewsSchema>;
export type SelectArtistNews = typeof artistNews.$inferSelect;

// Notifications Relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

// Notifications Schemas
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const selectNotificationSchema = createSelectSchema(notifications);
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type SelectNotification = typeof notifications.$inferSelect;

// ===================== SOCIAL NETWORK TABLES =====================

// Social Users - Perfiles para la red social (independiente de usuarios principales)
export const socialUsers = pgTable("social_users", {
  id: varchar("id").primaryKey(), // Usamos el Firebase UID del usuario
  displayName: text("display_name").notNull(),
  avatar: text("avatar"),
  bio: text("bio"),
  interests: text("interests").array(),
  language: text("language", { enum: ["en", "es"] }).default("en").notNull(),
  isBot: boolean("is_bot").default(false).notNull(),
  personality: text("personality"), // Para bots: su personalidad
  savedPosts: text("saved_posts").array().default(sql`ARRAY[]::text[]`), // Array de IDs de posts guardados
  likedPosts: text("liked_posts").array().default(sql`ARRAY[]::text[]`), // Array de IDs de posts que le gustaron
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Social Posts - Posts en la red social
export const socialPosts = pgTable("social_posts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => socialUsers.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  likes: integer("likes").default(0).notNull(),
  likedBy: text("liked_by").array().default(sql`ARRAY[]::text[]`), // Array de user IDs que dieron like
  savedBy: text("saved_by").array().default(sql`ARRAY[]::text[]`), // Array de user IDs que guardaron el post
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Social Comments - Comentarios en posts
export const socialComments = pgTable("social_comments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => socialUsers.id, { onDelete: "cascade" }).notNull(),
  postId: integer("post_id").references(() => socialPosts.id, { onDelete: "cascade" }).notNull(),
  parentId: integer("parent_id"), // Para respuestas a comentarios (self-reference)
  content: text("content").notNull(),
  likes: integer("likes").default(0).notNull(),
  isReply: boolean("is_reply").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Social Network Relations
export const socialUsersRelations = relations(socialUsers, ({ many }) => ({
  posts: many(socialPosts),
  comments: many(socialComments),
}));

export const socialPostsRelations = relations(socialPosts, ({ one, many }) => ({
  user: one(socialUsers, {
    fields: [socialPosts.userId],
    references: [socialUsers.id],
  }),
  comments: many(socialComments),
}));

export const socialCommentsRelations = relations(socialComments, ({ one }) => ({
  user: one(socialUsers, {
    fields: [socialComments.userId],
    references: [socialUsers.id],
  }),
  post: one(socialPosts, {
    fields: [socialComments.postId],
    references: [socialPosts.id],
  }),
  parent: one(socialComments, {
    fields: [socialComments.parentId],
    references: [socialComments.id],
    relationName: "replies"
  }),
}));

// Social Network Schemas
export const insertSocialUserSchema = createInsertSchema(socialUsers).omit({ createdAt: true, updatedAt: true });
export const selectSocialUserSchema = createSelectSchema(socialUsers);
export type InsertSocialUser = z.infer<typeof insertSocialUserSchema>;
export type SelectSocialUser = typeof socialUsers.$inferSelect;

export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({ id: true, createdAt: true, updatedAt: true });
export const selectSocialPostSchema = createSelectSchema(socialPosts);
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;
export type SelectSocialPost = typeof socialPosts.$inferSelect;

export const insertSocialCommentSchema = createInsertSchema(socialComments).omit({ id: true, createdAt: true, updatedAt: true });
export const selectSocialCommentSchema = createSelectSchema(socialComments);
export type InsertSocialComment = z.infer<typeof insertSocialCommentSchema>;
export type SelectSocialComment = typeof socialComments.$inferSelect;

// ========================================
// AFFILIATE SYSTEM TABLES
// ========================================

export const affiliates = pgTable("affiliates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  website: text("website"),
  socialMedia: json("social_media").$type<{
    instagram?: string;
    youtube?: string;
    tiktok?: string;
    twitter?: string;
  }>(),
  audienceSize: text("audience_size"),
  marketingExperience: text("marketing_experience"),
  promotionStrategy: text("promotion_strategy"),
  level: text("level", { enum: ["Básico", "Plata", "Oro", "Platino", "Diamante"] }).default("Básico").notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default('10.00').notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "suspended"] }).default("pending").notNull(),
  referralCode: text("referral_code").unique(),
  paymentMethod: text("payment_method", { enum: ["paypal", "bank_transfer", "stripe"] }).default("paypal"),
  paymentEmail: text("payment_email"),
  bankDetails: json("bank_details").$type<{
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    routingNumber?: string;
  }>(),
  totalClicks: integer("total_clicks").default(0).notNull(),
  totalConversions: integer("total_conversions").default(0).notNull(),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default('0.00').notNull(),
  pendingPayment: decimal("pending_payment", { precision: 10, scale: 2 }).default('0.00').notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const affiliateLinks = pgTable("affiliate_links", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id).notNull(),
  uniqueCode: text("unique_code").unique().notNull(),
  productType: text("product_type", { enum: ["subscription", "bundle", "merchandise", "course", "general"] }).default("general").notNull(),
  productId: text("product_id"),
  customPath: text("custom_path"),
  title: text("title").notNull(),
  description: text("description"),
  clicks: integer("clicks").default(0).notNull(),
  conversions: integer("conversions").default(0).notNull(),
  earnings: decimal("earnings", { precision: 10, scale: 2 }).default('0.00').notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const affiliateClicks = pgTable("affiliate_clicks", {
  id: serial("id").primaryKey(),
  linkId: integer("link_id").references(() => affiliateLinks.id).notNull(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  country: text("country"),
  device: text("device", { enum: ["desktop", "mobile", "tablet", "unknown"] }).default("unknown"),
  clickedAt: timestamp("clicked_at").defaultNow().notNull()
});

export const affiliateConversions = pgTable("affiliate_conversions", {
  id: serial("id").primaryKey(),
  linkId: integer("link_id").references(() => affiliateLinks.id).notNull(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  productType: text("product_type").notNull(),
  productId: text("product_id").notNull(),
  saleAmount: decimal("sale_amount", { precision: 10, scale: 2 }).notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(),
  commissionAmount: decimal("commission_amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status", { enum: ["pending", "approved", "paid", "cancelled"] }).default("pending").notNull(),
  stripePaymentId: text("stripe_payment_id"),
  metadata: json("metadata"),
  convertedAt: timestamp("converted_at").defaultNow().notNull()
});

export const affiliateEarnings = pgTable("affiliate_earnings", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type", { enum: ["commission", "bonus", "referral", "adjustment", "payout_request", "payout_completed", "referral_commission"] }).notNull(),
  description: text("description").notNull(),
  status: text("status", { enum: ["pending", "approved", "paid"] }).default("pending").notNull(),
  conversionId: integer("conversion_id").references(() => affiliateConversions.id),
  paymentId: text("payment_id"),
  metadata: json("metadata"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const affiliateCoupons = pgTable("affiliate_coupons", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id).notNull(),
  code: text("code").unique().notNull(),
  description: text("description").notNull(),
  discountType: text("discount_type", { enum: ["percentage", "fixed"] }).notNull(),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  minimumPurchase: decimal("minimum_purchase", { precision: 10, scale: 2 }),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").default(0).notNull(),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true).notNull(),
  applicableProducts: text("applicable_products").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const affiliatePromotions = pgTable("affiliate_promotions", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  bannerUrl: text("banner_url"),
  landingPageUrl: text("landing_page_url").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  clicks: integer("clicks").default(0).notNull(),
  impressions: integer("impressions").default(0).notNull(),
  conversions: integer("conversions").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const affiliateBadges = pgTable("affiliate_badges", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id).notNull(),
  badgeType: text("badge_type", { 
    enum: ["first_sale", "milestone_10", "milestone_50", "milestone_100", "top_performer", "consistent_earner", "viral_marketer", "elite_affiliate"] 
  }).notNull(),
  badgeName: text("badge_name").notNull(),
  badgeDescription: text("badge_description").notNull(),
  iconUrl: text("icon_url"),
  earnedAt: timestamp("earned_at").defaultNow().notNull()
});

export const affiliateReferrals = pgTable("affiliate_referrals", {
  id: serial("id").primaryKey(),
  referrerId: integer("referrer_id").references(() => affiliates.id).notNull(),
  referredAffiliateId: integer("referred_affiliate_id").references(() => affiliates.id),
  referredEmail: text("referred_email").notNull(),
  status: text("status", { enum: ["pending", "registered", "approved", "active"] }).default("pending").notNull(),
  level: integer("level").default(1).notNull(),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default('0.00').notNull(),
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).default('5.00').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const affiliateMarketingMaterials = pgTable("affiliate_marketing_materials", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category", { enum: ["banner", "social_media", "email_template", "video", "guide"] }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: text("file_type").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  downloadCount: integer("download_count").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Affiliate Relations
export const affiliatesRelations = relations(affiliates, ({ one, many }) => ({
  user: one(users, {
    fields: [affiliates.userId],
    references: [users.id],
  }),
  links: many(affiliateLinks),
  clicks: many(affiliateClicks),
  conversions: many(affiliateConversions),
  earnings: many(affiliateEarnings),
  coupons: many(affiliateCoupons),
  promotions: many(affiliatePromotions),
  badges: many(affiliateBadges),
  referralsGiven: many(affiliateReferrals, { relationName: "referrer" }),
}));

export const affiliateLinksRelations = relations(affiliateLinks, ({ one, many }) => ({
  affiliate: one(affiliates, {
    fields: [affiliateLinks.affiliateId],
    references: [affiliates.id],
  }),
  clicks: many(affiliateClicks),
  conversions: many(affiliateConversions),
}));

// Affiliate Schemas
export const insertAffiliateSchema = createInsertSchema(affiliates).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  totalClicks: true,
  totalConversions: true,
  totalEarnings: true,
  pendingPayment: true,
  paidAmount: true
});
export const selectAffiliateSchema = createSelectSchema(affiliates);
export type InsertAffiliate = z.infer<typeof insertAffiliateSchema>;
export type SelectAffiliate = typeof affiliates.$inferSelect;

export const insertAffiliateLinkSchema = createInsertSchema(affiliateLinks).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  clicks: true,
  conversions: true,
  earnings: true
});
export const selectAffiliateLinkSchema = createSelectSchema(affiliateLinks);
export type InsertAffiliateLink = z.infer<typeof insertAffiliateLinkSchema>;
export type SelectAffiliateLink = typeof affiliateLinks.$inferSelect;

export const insertAffiliateClickSchema = createInsertSchema(affiliateClicks).omit({ 
  id: true, 
  clickedAt: true 
});
export const selectAffiliateClickSchema = createSelectSchema(affiliateClicks);
export type InsertAffiliateClick = z.infer<typeof insertAffiliateClickSchema>;
export type SelectAffiliateClick = typeof affiliateClicks.$inferSelect;

export const insertAffiliateConversionSchema = createInsertSchema(affiliateConversions).omit({ 
  id: true, 
  convertedAt: true 
});
export const selectAffiliateConversionSchema = createSelectSchema(affiliateConversions);
export type InsertAffiliateConversion = z.infer<typeof insertAffiliateConversionSchema>;
export type SelectAffiliateConversion = typeof affiliateConversions.$inferSelect;

export const insertAffiliateCouponSchema = createInsertSchema(affiliateCoupons).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  usedCount: true
});
export const selectAffiliateCouponSchema = createSelectSchema(affiliateCoupons);
export type InsertAffiliateCoupon = z.infer<typeof insertAffiliateCouponSchema>;
export type SelectAffiliateCoupon = typeof affiliateCoupons.$inferSelect;

export const insertAffiliatePromotionSchema = createInsertSchema(affiliatePromotions).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  clicks: true,
  impressions: true,
  conversions: true
});
export const selectAffiliatePromotionSchema = createSelectSchema(affiliatePromotions);
export type InsertAffiliatePromotion = z.infer<typeof insertAffiliatePromotionSchema>;
export type SelectAffiliatePromotion = typeof affiliatePromotions.$inferSelect;

export const insertAffiliateBadgeSchema = createInsertSchema(affiliateBadges).omit({ 
  id: true, 
  earnedAt: true 
});
export const selectAffiliateBadgeSchema = createSelectSchema(affiliateBadges);
export type InsertAffiliateBadge = z.infer<typeof insertAffiliateBadgeSchema>;
export type SelectAffiliateBadge = typeof affiliateBadges.$inferSelect;

export const insertAffiliateReferralSchema = createInsertSchema(affiliateReferrals).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  totalEarnings: true
});
export const selectAffiliateReferralSchema = createSelectSchema(affiliateReferrals);
export type InsertAffiliateReferral = z.infer<typeof insertAffiliateReferralSchema>;
export type SelectAffiliateReferral = typeof affiliateReferrals.$inferSelect;

export const insertAffiliateMarketingMaterialSchema = createInsertSchema(affiliateMarketingMaterials).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  downloadCount: true
});
export const selectAffiliateMarketingMaterialSchema = createSelectSchema(affiliateMarketingMaterials);
export type InsertAffiliateMarketingMaterial = z.infer<typeof insertAffiliateMarketingMaterialSchema>;
export type SelectAffiliateMarketingMaterial = typeof affiliateMarketingMaterials.$inferSelect;

// PR Agent Tables
export const prCampaigns = pgTable("pr_campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  title: text("title").notNull(),
  artistName: text("artist_name").notNull(),
  artistProfileUrl: text("artist_profile_url"),
  
  contentType: text("content_type", { enum: ["single", "album", "video", "tour", "announcement"] }).notNull(),
  contentTitle: text("content_title").notNull(),
  contentUrl: text("content_url"),
  
  targetMediaTypes: text("target_media_types").array(),
  targetCountries: text("target_countries").array(),
  targetGenres: text("target_genres").array(),
  
  pitchMessage: text("pitch_message").notNull(),
  
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  
  status: text("status", { enum: ["draft", "active", "paused", "completed"] }).default("draft").notNull(),
  
  mediaContacted: integer("media_contacted").default(0).notNull(),
  emailsOpened: integer("emails_opened").default(0).notNull(),
  mediaReplied: integer("media_replied").default(0).notNull(),
  interviewsBooked: integer("interviews_booked").default(0).notNull(),
  
  makeScenarioId: text("make_scenario_id"),
  lastSyncAt: timestamp("last_sync_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const prMediaDatabase = pgTable("pr_media_database", {
  id: serial("id").primaryKey(),
  
  type: text("type", { enum: ["radio", "tv", "podcast", "blog", "magazine"] }).notNull(),
  name: text("name").notNull(),
  
  country: text("country").notNull(),
  city: text("city"),
  
  genres: text("genres").array(),
  language: text("language").notNull(),
  
  email: text("email").notNull(),
  websiteUrl: text("website_url"),
  
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const prWebhookEvents = pgTable("pr_webhook_events", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => prCampaigns.id).notNull(),
  
  eventType: text("event_type", { enum: ["email_sent", "email_opened", "media_replied", "interview_booked"] }).notNull(),
  
  payload: json("payload"),
  
  mediaName: text("media_name"),
  mediaEmail: text("media_email"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertPRCampaignSchema = createInsertSchema(prCampaigns).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  mediaContacted: true,
  emailsOpened: true,
  mediaReplied: true,
  interviewsBooked: true
});
export const selectPRCampaignSchema = createSelectSchema(prCampaigns);
export type InsertPRCampaign = z.infer<typeof insertPRCampaignSchema>;
export type SelectPRCampaign = typeof prCampaigns.$inferSelect;

export const insertPRMediaSchema = createInsertSchema(prMediaDatabase).omit({ 
  id: true, 
  createdAt: true 
});
export const selectPRMediaSchema = createSelectSchema(prMediaDatabase);
export type InsertPRMedia = z.infer<typeof insertPRMediaSchema>;
export type SelectPRMedia = typeof prMediaDatabase.$inferSelect;

export const insertPRWebhookEventSchema = createInsertSchema(prWebhookEvents).omit({ 
  id: true, 
  createdAt: true 
});
export const selectPRWebhookEventSchema = createSelectSchema(prWebhookEvents);
export type InsertPRWebhookEvent = z.infer<typeof insertPRWebhookEventSchema>;
export type SelectPRWebhookEvent = typeof prWebhookEvents.$inferSelect;

// API Usage Monitoring - Tabla para monitorear consumo de APIs
export const apiUsageLog = pgTable("api_usage_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  apiProvider: text("api_provider", { enum: ["openai", "gemini", "fal", "anthropic", "piapi", "openrouter", "shotstack", "brevo", "apify", "stripe", "other"] }).notNull(),
  endpoint: text("endpoint").notNull(),
  model: text("model"),
  tokensUsed: integer("tokens_used").default(0).notNull(),
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 6 }).default('0').notNull(),
  currency: text("currency").default("usd").notNull(),
  responseTime: integer("response_time"), // milliseconds
  status: text("status", { enum: ["success", "error", "rate_limited"] }).default("success").notNull(),
  errorMessage: text("error_message"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertApiUsageLogSchema = createInsertSchema(apiUsageLog).omit({ id: true, createdAt: true });
export const selectApiUsageLogSchema = createSelectSchema(apiUsageLog);
export type InsertApiUsageLog = z.infer<typeof insertApiUsageLogSchema>;
export type SelectApiUsageLog = typeof apiUsageLog.$inferSelect;

// Accounting/Transactions - Sistema de contabilidad
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  
  // Tipo de transacción
  type: text("type", { 
    enum: ["subscription", "product_purchase", "course_purchase", "service_fee", "refund", "payment", "other"] 
  }).notNull(),
  
  // Detalles de la transacción
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("usd").notNull(),
  
  // Referencias a otros recursos
  subscriptionId: integer("subscription_id").references(() => subscriptions.id),
  productId: integer("product_id"),
  courseId: integer("course_id"),
  invoiceNumber: text("invoice_number"),
  
  // Información de pago
  paymentMethod: text("payment_method", { enum: ["stripe", "paypal", "bank_transfer", "credit_card", "other"] }),
  paymentStatus: text("payment_status", { enum: ["pending", "completed", "failed", "refunded"] }).default("pending").notNull(),
  stripeTransactionId: text("stripe_transaction_id"),
  
  // Detalles comerciales
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default('0'),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default('0'),
  netAmount: decimal("net_amount", { precision: 12, scale: 2 }).notNull(),
  
  // Metadata
  metadata: json("metadata"),
  notes: text("notes"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export const selectTransactionSchema = createSelectSchema(transactions);
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type SelectTransaction = typeof transactions.$inferSelect;

// Affiliate Payouts
export const affiliatePayouts = pgTable("affiliate_payouts", {
  id: serial("id").primaryKey(),
  affiliateId: integer("affiliate_id").references(() => affiliates.id),
  affiliateName: text("affiliate_name"),
  affiliateEmail: text("affiliate_email"),
  
  // Comisiones y pagos
  commissionRate: decimal("commission_rate", { precision: 5, scale: 2 }).notNull(), // Porcentaje
  totalSales: decimal("total_sales", { precision: 12, scale: 2 }).default('0').notNull(),
  totalCommission: decimal("total_commission", { precision: 12, scale: 2 }).default('0').notNull(),
  
  // Pagos
  amountPaid: decimal("amount_paid", { precision: 12, scale: 2 }).default('0').notNull(),
  amountPending: decimal("amount_pending", { precision: 12, scale: 2 }).default('0').notNull(),
  lastPaymentDate: timestamp("last_payment_date"),
  nextPaymentDate: timestamp("next_payment_date"),
  
  // Método de pago
  paymentMethod: text("payment_method", { enum: ["stripe", "paypal", "bank_transfer", "crypto", "other"] }),
  paymentStatus: text("payment_status", { enum: ["pending", "paid", "failed", "scheduled"] }).default("pending").notNull(),
  
  // Metadata
  referrals: integer("referrals").default(0),
  conversions: integer("conversions").default(0),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default('0'),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAffiliatePayoutSchema = createInsertSchema(affiliatePayouts).omit({ id: true, createdAt: true, updatedAt: true });
export const selectAffiliatePayoutSchema = createSelectSchema(affiliatePayouts);
export type InsertAffiliatePayout = z.infer<typeof insertAffiliatePayoutSchema>;
export type SelectAffiliatePayout = typeof affiliatePayouts.$inferSelect;

// ============================================
// BOOSTISWAP - DEX FOR MUSIC TOKENS
// ============================================

/**
 * Pares de trading - Cada par representa dos tokens que se pueden intercambiar
 * Ej: SONG-001 / USDC o LUNA-ECHO / ETH
 */
export const swapPairs = pgTable("swap_pairs", {
  id: serial("id").primaryKey(),
  token1Id: integer("token1_id").notNull().references(() => tokenizedSongs.id, { onDelete: "cascade" }),
  token2Id: integer("token2_id").notNull().references(() => tokenizedSongs.id, { onDelete: "cascade" }),
  pairAddress: varchar("pair_address", { length: 42 }).unique(), // Smart contract address
  reserve1: decimal("reserve1", { precision: 20, scale: 8 }).default('0').notNull(), // Token1 reserve
  reserve2: decimal("reserve2", { precision: 20, scale: 8 }).default('0').notNull(), // Token2 reserve
  volume24h: decimal("volume24h", { precision: 20, scale: 2 }).default('0').notNull(),
  feeTier: integer("fee_tier").default(5).notNull(), // 0.5% = 5 basis points
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_swap_pairs_tokens").on(table.token1Id, table.token2Id),
  index("idx_swap_pairs_active").on(table.isActive)
]);

/**
 * Pools de liquidez - Contiene reservas de ambos tokens y datos del pool
 */
export const liquidityPools = pgTable("liquidity_pools", {
  id: serial("id").primaryKey(),
  pairId: integer("pair_id").notNull().references(() => swapPairs.id, { onDelete: "cascade" }),
  totalShares: decimal("total_shares", { precision: 20, scale: 8 }).default('0').notNull(), // LP tokens emitidos
  reserve1: decimal("reserve1", { precision: 20, scale: 8 }).default('0').notNull(),
  reserve2: decimal("reserve2", { precision: 20, scale: 8 }).default('0').notNull(),
  feesAccumulated: decimal("fees_accumulated", { precision: 20, scale: 8 }).default('0').notNull(),
  apy: decimal("apy", { precision: 5, scale: 2 }).default('0').notNull(), // Annual Percentage Yield
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_liquidity_pools_pair").on(table.pairId)
]);

/**
 * Posiciones de liquidez del usuario - Cada usuario puede tener múltiples posiciones
 */
export const liquidityPositions = pgTable("liquidity_positions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  poolId: integer("pool_id").notNull().references(() => liquidityPools.id, { onDelete: "cascade" }),
  lpTokensHeld: decimal("lp_tokens_held", { precision: 20, scale: 8 }).notNull(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  amount1Deposited: decimal("amount1_deposited", { precision: 20, scale: 8 }).notNull(),
  amount2Deposited: decimal("amount2_deposited", { precision: 20, scale: 8 }).notNull(),
  feesEarned: decimal("fees_earned", { precision: 20, scale: 8 }).default('0').notNull(),
  transactionHash: varchar("transaction_hash", { length: 66 }),
  status: text("status", { enum: ["active", "withdrawn", "pending"] }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_liquidity_positions_user").on(table.userId),
  index("idx_liquidity_positions_pool").on(table.poolId),
  index("idx_liquidity_positions_wallet").on(table.walletAddress)
]);

/**
 * Historial de swaps ejecutados en BoostiSwap
 */
export const swapHistory = pgTable("swap_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  pairId: integer("pair_id").notNull().references(() => swapPairs.id, { onDelete: "cascade" }),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  tokenInId: integer("token_in_id").notNull().references(() => tokenizedSongs.id),
  tokenOutId: integer("token_out_id").notNull().references(() => tokenizedSongs.id),
  amountIn: decimal("amount_in", { precision: 20, scale: 8 }).notNull(),
  amountOut: decimal("amount_out", { precision: 20, scale: 8 }).notNull(),
  priceImpact: decimal("price_impact", { precision: 5, scale: 2 }).default('0').notNull(), // Porcentaje
  platformFeeUsd: decimal("platform_fee_usd", { precision: 10, scale: 2 }).default('0').notNull(), // 5% fee
  lpFeeUsd: decimal("lp_fee_usd", { precision: 10, scale: 2 }).default('0').notNull(), // Liquidity provider fee
  transactionHash: varchar("transaction_hash", { length: 66 }).unique(),
  blockNumber: integer("block_number"),
  status: text("status", { enum: ["pending", "confirmed", "failed"] }).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_swap_history_user").on(table.userId),
  index("idx_swap_history_pair").on(table.pairId),
  index("idx_swap_history_wallet").on(table.walletAddress),
  index("idx_swap_history_status").on(table.status)
]);

// ============================================
// BOOSTISWAP RELATIONS
// ============================================

export const swapPairsRelations = relations(swapPairs, ({ one, many }) => ({
  token1: one(tokenizedSongs, {
    fields: [swapPairs.token1Id],
    references: [tokenizedSongs.id],
  }),
  token2: one(tokenizedSongs, {
    fields: [swapPairs.token2Id],
    references: [tokenizedSongs.id],
  }),
  pools: many(liquidityPools),
  swaps: many(swapHistory),
}));

export const liquidityPoolsRelations = relations(liquidityPools, ({ one, many }) => ({
  pair: one(swapPairs, {
    fields: [liquidityPools.pairId],
    references: [swapPairs.id],
  }),
  positions: many(liquidityPositions),
}));

export const liquidityPositionsRelations = relations(liquidityPositions, ({ one }) => ({
  user: one(users, {
    fields: [liquidityPositions.userId],
    references: [users.id],
  }),
  pool: one(liquidityPools, {
    fields: [liquidityPositions.poolId],
    references: [liquidityPools.id],
  }),
}));

export const swapHistoryRelations = relations(swapHistory, ({ one }) => ({
  user: one(users, {
    fields: [swapHistory.userId],
    references: [users.id],
  }),
  pair: one(swapPairs, {
    fields: [swapHistory.pairId],
    references: [swapPairs.id],
  }),
}));

// ============================================
// BOOSTISWAP ZOD SCHEMAS
// ============================================

export const insertSwapPairSchema = createInsertSchema(swapPairs).omit({ id: true, createdAt: true, updatedAt: true });
export const selectSwapPairSchema = createSelectSchema(swapPairs);
export type InsertSwapPair = z.infer<typeof insertSwapPairSchema>;
export type SelectSwapPair = typeof swapPairs.$inferSelect;

export const insertLiquidityPoolSchema = createInsertSchema(liquidityPools).omit({ id: true, createdAt: true, updatedAt: true });
export const selectLiquidityPoolSchema = createSelectSchema(liquidityPools);
export type InsertLiquidityPool = z.infer<typeof insertLiquidityPoolSchema>;
export type SelectLiquidityPool = typeof liquidityPools.$inferSelect;

export const insertLiquidityPositionSchema = createInsertSchema(liquidityPositions).omit({ id: true, createdAt: true, updatedAt: true });
export const selectLiquidityPositionSchema = createSelectSchema(liquidityPositions);
export type InsertLiquidityPosition = z.infer<typeof insertLiquidityPositionSchema>;
export type SelectLiquidityPosition = typeof liquidityPositions.$inferSelect;

export const insertSwapHistorySchema = createInsertSchema(swapHistory).omit({ id: true, createdAt: true });
export const selectSwapHistorySchema = createSelectSchema(swapHistory);
export type InsertSwapHistory = z.infer<typeof insertSwapHistorySchema>;
export type SelectSwapHistory = typeof swapHistory.$inferSelect;

// Investor Payments
export const investorPayments = pgTable("investor_payments", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id"),
  investorName: text("investor_name"),
  investorEmail: text("investor_email"),
  
  // Tipo de inversión
  investmentType: text("investment_type", { enum: ["equity", "debt", "revenue_share", "grant", "loan"] }).notNull(),
  investmentAmount: decimal("investment_amount", { precision: 12, scale: 2 }).notNull(),
  investmentDate: timestamp("investment_date").notNull(),
  
  // Retornos e interés
  expectedReturn: decimal("expected_return", { precision: 5, scale: 2 }).notNull(), // Porcentaje
  expectedReturnAmount: decimal("expected_return_amount", { precision: 12, scale: 2 }).default('0'),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).default('0'), // Para loans
  
  // Pagos realizados
  totalPaidOut: decimal("total_paid_out", { precision: 12, scale: 2 }).default('0').notNull(),
  pendingPayment: decimal("pending_payment", { precision: 12, scale: 2 }).default('0').notNull(),
  lastPaymentDate: timestamp("last_payment_date"),
  nextPaymentDate: timestamp("next_payment_date"),
  
  // Información de pago
  paymentMethod: text("payment_method", { enum: ["stripe", "paypal", "bank_transfer", "crypto", "wire", "check"] }),
  paymentStatus: text("payment_status", { enum: ["pending", "paid", "partial", "failed", "on_hold"] }).default("pending").notNull(),
  paymentFrequency: text("payment_frequency", { enum: ["monthly", "quarterly", "semi_annual", "annual", "milestone"] }).default("quarterly"),
  
  // Detalles
  status: text("status", { enum: ["active", "completed", "defaulted", "withdrawn"] }).default("active").notNull(),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInvestorPaymentSchema = createInsertSchema(investorPayments).omit({ id: true, createdAt: true, updatedAt: true });
export const selectInvestorPaymentSchema = createSelectSchema(investorPayments);
export type InsertInvestorPayment = z.infer<typeof insertInvestorPaymentSchema>;
export type SelectInvestorPayment = typeof investorPayments.$inferSelect;

// Social Media Posts
export const socialMediaPosts = pgTable("social_media_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  platform: text("platform", { enum: ["facebook", "instagram", "tiktok"] }).notNull(),
  caption: text("caption").notNull(),
  hashtags: text("hashtags").array().notNull(),
  cta: text("cta").notNull(),
  viralScore: integer("viral_score"),
  imageUrl: text("image_url"),
  imageModel: text("image_model"),
  isPublished: boolean("is_published").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const insertSocialMediaPostSchema = createInsertSchema(socialMediaPosts).omit({ id: true, createdAt: true, updatedAt: true });
export const selectSocialMediaPostSchema = createSelectSchema(socialMediaPosts);
export type InsertSocialMediaPost = z.infer<typeof insertSocialMediaPostSchema>;
export type SelectSocialMediaPost = typeof socialMediaPosts.$inferSelect;

// ============================================================================
// RENDER QUEUE - Cola de renderizado de videos musicales
// ============================================================================
export const renderQueue = pgTable("render_queue", {
  id: serial("id").primaryKey(),
  
  // Relaciones
  projectId: integer("project_id").references(() => musicVideoProjects.id, { onDelete: "cascade" }),
  artistProfileId: integer("artist_profile_id").references(() => users.id, { onDelete: "cascade" }),
  
  // Información del usuario
  userEmail: text("user_email").notNull(),
  artistName: text("artist_name").notNull(),
  songName: text("song_name").notNull(),
  profileSlug: text("profile_slug"),
  
  // Estado del pipeline
  status: text("status", { 
    enum: ["pending", "generating_videos", "rendering", "uploading", "completed", "failed"] 
  }).default("pending").notNull(),
  
  // Progreso detallado
  currentStep: text("current_step"),
  progress: integer("progress").default(0), // 0-100
  totalClips: integer("total_clips").default(10),
  processedClips: integer("processed_clips").default(0),
  
  // Datos para renderizado
  timelineData: json("timeline_data").$type<any[]>(),
  audioUrl: text("audio_url"),
  audioDuration: decimal("audio_duration", { precision: 10, scale: 2 }),
  thumbnailUrl: text("thumbnail_url"),
  aspectRatio: text("aspect_ratio").default("16:9"),
  performanceVideoUrl: text("performance_video_url"), // 🎭 Video grabado por el artista para motion transfer (DreamActor v2)
  
  // Resultado
  finalVideoUrl: text("final_video_url"),
  shotstackRenderId: text("shotstack_render_id"),
  firebaseVideoUrl: text("firebase_video_url"),
  
  // Webhook status
  pendingWebhookSent: boolean("pending_webhook_sent").default(false),
  pendingWebhookSentAt: timestamp("pending_webhook_sent_at"),
  completedWebhookSent: boolean("completed_webhook_sent").default(false),
  completedWebhookSentAt: timestamp("completed_webhook_sent_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
  errorStep: text("error_step"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertRenderQueueSchema = createInsertSchema(renderQueue).omit({ id: true, createdAt: true, updatedAt: true });
export const selectRenderQueueSchema = createSelectSchema(renderQueue);
export type InsertRenderQueue = z.infer<typeof insertRenderQueueSchema>;
export type SelectRenderQueue = typeof renderQueue.$inferSelect;

// ============================================================================
// MUSIC INDUSTRY CONTACTS & OUTREACH SYSTEM
// ============================================================================

/**
 * Music Industry Contacts - Database of industry professionals
 * Imported from lead generation sources (Apollo, LinkedIn, etc.)
 */
export const musicIndustryContacts = pgTable("music_industry_contacts", {
  id: serial("id").primaryKey(),
  
  // Contact Information
  fullName: text("full_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  personalEmail: text("personal_email"),
  phone: text("phone"),
  mobileNumber: text("mobile_number"),
  
  // Professional Info
  jobTitle: text("job_title"),
  headline: text("headline"),
  seniorityLevel: text("seniority_level"), // owner, c_suite, director, manager, etc.
  functionalLevel: text("functional_level"),
  industry: text("industry"),
  
  // Company Information
  companyName: text("company_name"),
  companyDomain: text("company_domain"),
  companyWebsite: text("company_website"),
  companyLinkedin: text("company_linkedin"),
  companyPhone: text("company_phone"),
  companySize: text("company_size"),
  companyAnnualRevenue: text("company_annual_revenue"),
  companyFoundedYear: integer("company_founded_year"),
  companyDescription: text("company_description"),
  companyTechnologies: text("company_technologies"),
  
  // Location
  city: text("city"),
  state: text("state"),
  country: text("country"),
  companyFullAddress: text("company_full_address"),
  
  // Social Links
  linkedin: text("linkedin"),
  
  // Categorization
  category: text("category", { 
    enum: ["record_label", "publishing", "radio", "tv", "sync", "studio", "streaming", "live_events", "pr_marketing", "distribution", "other"] 
  }).default("other"),
  keywords: text("keywords"), // Comma-separated keywords for filtering
  
  // Outreach Status
  status: text("status", { 
    enum: ["new", "queued", "contacted", "opened", "clicked", "responded", "not_interested", "deal_in_progress", "unsubscribed", "bounced"] 
  }).default("new"),
  
  // Tracking
  lastContactedAt: timestamp("last_contacted_at"),
  emailsSent: integer("emails_sent").default(0),
  opensCount: integer("opens_count").default(0),
  clicksCount: integer("clicks_count").default(0),
  
  // Import metadata
  importSource: text("import_source"), // csv, apify, manual
  importBatchId: text("import_batch_id"),
  
  // Email verification
  emailStatus: text("email_status"),
  emailVerifiedAt: timestamp("email_verified_at"),

  // Visual assets (for landing-page generation)
  // `profileImageUrl` = raw reference image discovered on the source platform
  // (Spotify artist image, YouTube channel thumbnail, etc.)
  // `boostifyImageUrl` = FAL-generated Boostify-styled variant used on the
  // public artist landing page. NULL until the image-stylizer agent runs.
  profileImageUrl: text("profile_image_url"),
  boostifyImageUrl: text("boostify_image_url"),
  imageStylizedAt: timestamp("image_stylized_at"),

  // Marketing-grade Master JSON v2 — full artist profile used by landing
  // forge, outreach brain, visual pitch, scorer and conversion agents.
  // See server/services/artist-discovery/master-json-builder.ts for shape.
  masterJson: jsonb("master_json"),
  masterJsonVersion: text("master_json_version"),
  masterJsonBuiltAt: timestamp("master_json_built_at"),
  dataCompleteness: real("data_completeness"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_industry_contacts_email").on(table.email),
  index("idx_industry_contacts_category").on(table.category),
  index("idx_industry_contacts_status").on(table.status),
  index("idx_industry_contacts_industry").on(table.industry),
]);

export const insertMusicIndustryContactSchema = createInsertSchema(musicIndustryContacts).omit({ id: true, createdAt: true, updatedAt: true });
export const selectMusicIndustryContactSchema = createSelectSchema(musicIndustryContacts);
export type InsertMusicIndustryContact = z.infer<typeof insertMusicIndustryContactSchema>;
export type SelectMusicIndustryContact = typeof musicIndustryContacts.$inferSelect;

/**
 * Outreach Email Templates - Reusable email templates for campaigns
 */
export const outreachTemplates = pgTable("outreach_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  
  // Template Info
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"), // Plain text fallback
  
  // Template Type
  type: text("type", { 
    enum: ["artist_intro", "sync_opportunity", "collaboration", "follow_up", "thank_you", "custom"] 
  }).default("artist_intro"),
  
  // Variables available: {{artist_name}}, {{landing_url}}, {{contact_name}}, {{company_name}}, etc.
  variables: json("variables").$type<string[]>().default([]),
  
  // Usage stats
  timesUsed: integer("times_used").default(0),
  
  // Flags
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOutreachTemplateSchema = createInsertSchema(outreachTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const selectOutreachTemplateSchema = createSelectSchema(outreachTemplates);
export type InsertOutreachTemplate = z.infer<typeof insertOutreachTemplateSchema>;
export type SelectOutreachTemplate = typeof outreachTemplates.$inferSelect;

/**
 * Outreach Campaigns - Email campaigns for artist promotion
 */
export const outreachCampaigns = pgTable("outreach_campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }), // Which artist to promote
  templateId: integer("template_id").references(() => outreachTemplates.id, { onDelete: "set null" }),
  
  // Campaign Info
  name: text("name").notNull(),
  description: text("description"),
  
  // Target filters (JSON for flexibility)
  targetFilters: json("target_filters").$type<{
    industries?: string[];
    seniorityLevels?: string[];
    countries?: string[];
    categories?: string[];
    keywords?: string[];
  }>(),
  
  // Campaign Settings
  dailyLimit: integer("daily_limit").default(20), // Emails per day
  status: text("status", { 
    enum: ["draft", "scheduled", "active", "paused", "completed", "cancelled"] 
  }).default("draft"),
  
  // Schedule
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  pausedAt: timestamp("paused_at"),
  completedAt: timestamp("completed_at"),
  
  // Stats
  totalContacts: integer("total_contacts").default(0),
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  emailsReplied: integer("emails_replied").default(0),
  emailsBounced: integer("emails_bounced").default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOutreachCampaignSchema = createInsertSchema(outreachCampaigns).omit({ id: true, createdAt: true, updatedAt: true });
export const selectOutreachCampaignSchema = createSelectSchema(outreachCampaigns);
export type InsertOutreachCampaign = z.infer<typeof insertOutreachCampaignSchema>;
export type SelectOutreachCampaign = typeof outreachCampaigns.$inferSelect;

/**
 * Outreach Email Log - Track individual email sends
 */
export const outreachEmailLog = pgTable("outreach_email_log", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => outreachCampaigns.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").references(() => musicIndustryContacts.id, { onDelete: "cascade" }).notNull(),
  templateId: integer("template_id").references(() => outreachTemplates.id, { onDelete: "set null" }),
  
  // Email Details
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  subject: text("subject").notNull(),
  
  // Status
  status: text("status", { 
    enum: ["queued", "sending", "sent", "delivered", "opened", "clicked", "replied", "bounced", "failed", "unsubscribed"] 
  }).default("queued"),
  
  // Tracking
  brevoMessageId: text("brevo_message_id"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  repliedAt: timestamp("replied_at"),
  bouncedAt: timestamp("bounced_at"),
  
  // Error tracking
  errorMessage: text("error_message"),
  
  // Timestamps
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_log_campaign").on(table.campaignId),
  index("idx_email_log_contact").on(table.contactId),
  index("idx_email_log_status").on(table.status),
  index("idx_email_log_sent_at").on(table.sentAt),
]);

export const insertOutreachEmailLogSchema = createInsertSchema(outreachEmailLog).omit({ id: true, createdAt: true });
export const selectOutreachEmailLogSchema = createSelectSchema(outreachEmailLog);
export type InsertOutreachEmailLog = z.infer<typeof insertOutreachEmailLogSchema>;
export type SelectOutreachEmailLog = typeof outreachEmailLog.$inferSelect;

/**
 * Daily Email Quota Tracking - Track daily sends to respect limits
 */
export const outreachDailyQuota = pgTable("outreach_daily_quota", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  emailsSent: integer("emails_sent").default(0),
  dailyLimit: integer("daily_limit").default(20),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_daily_quota_user_date").on(table.userId, table.date),
]);

// ============================================
// AI AGENTS SYSTEM TABLES
// ============================================

/**
 * AI Agent Sessions - Track all agent interactions
 */
export const agentSessions = pgTable("agent_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "set null" }), // The AI artist being worked on
  
  agentType: text("agent_type", { 
    enum: ["composer", "video-director", "photographer", "marketing", "social-media", "merchandise", "manager"] 
  }).notNull(),
  
  sessionName: text("session_name"), // Optional name for the session
  
  // Input/Output
  inputParams: json("input_params").$type<Record<string, any>>(), // Parameters sent to the agent
  outputContent: text("output_content"), // The generated content/response
  outputMetadata: json("output_metadata").$type<{
    tokensUsed?: number;
    modelUsed?: string;
    generationTime?: number;
    contentType?: string;
    toolResults?: any[];
    toolsAvailable?: string[];
  }>(),
  
  // Status
  status: text("status", { enum: ["pending", "processing", "completed", "failed", "saved"] }).default("pending"),
  
  // Rating/Feedback
  userRating: integer("user_rating"), // 1-5 stars
  userFeedback: text("user_feedback"),
  
  // Usage tracking
  tokensUsed: integer("tokens_used").default(0),
  costUsd: decimal("cost_usd", { precision: 10, scale: 6 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_agent_session_user").on(table.userId),
  index("idx_agent_session_artist").on(table.artistId),
  index("idx_agent_session_type").on(table.agentType),
  index("idx_agent_session_status").on(table.status),
  index("idx_agent_session_created").on(table.createdAt),
]);

export const insertAgentSessionSchema = createInsertSchema(agentSessions).omit({ id: true, createdAt: true, updatedAt: true });
export const selectAgentSessionSchema = createSelectSchema(agentSessions);
export type InsertAgentSession = z.infer<typeof insertAgentSessionSchema>;
export type SelectAgentSession = typeof agentSessions.$inferSelect;

/**
 * Agent Saved Results - User-saved outputs from agents
 */
export const agentSavedResults = pgTable("agent_saved_results", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "set null" }),
  sessionId: integer("session_id").references(() => agentSessions.id, { onDelete: "set null" }),
  
  agentType: text("agent_type", { 
    enum: ["composer", "video-director", "photographer", "marketing", "social-media", "merchandise", "manager"] 
  }).notNull(),
  
  title: text("title").notNull(),
  content: text("content").notNull(),
  contentType: text("content_type", { 
    enum: ["lyrics", "music", "video-concept", "image", "strategy", "post", "design", "plan", "campaign", "scheduled-post", "content-calendar", "post-pack", "storyboard", "scene-image", "promo-image", "merch-design", "career-roadmap", "pitch-deck"] 
  }).notNull(),
  
  // Rich metadata
  metadata: json("metadata").$type<Record<string, any>>(),
  
  // Files/Media
  attachedFiles: json("attached_files").$type<Array<string | {
    url: string;
    type: string;
    name: string;
  }>>(),
  
  // Organization
  isFavorite: boolean("is_favorite").default(false),
  tags: text("tags").array(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_saved_result_user").on(table.userId),
  index("idx_saved_result_artist").on(table.artistId),
  index("idx_saved_result_type").on(table.agentType),
  index("idx_saved_result_favorite").on(table.isFavorite),
]);

export const insertAgentSavedResultSchema = createInsertSchema(agentSavedResults).omit({ id: true, createdAt: true, updatedAt: true });
export const selectAgentSavedResultSchema = createSelectSchema(agentSavedResults);
export type InsertAgentSavedResult = z.infer<typeof insertAgentSavedResultSchema>;
export type SelectAgentSavedResult = typeof agentSavedResults.$inferSelect;

/**
 * Agent Usage Analytics - Aggregated stats
 */
export const agentUsageStats = pgTable("agent_usage_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  agentType: text("agent_type", { 
    enum: ["composer", "video-director", "photographer", "marketing", "social-media", "merchandise", "manager"] 
  }).notNull(),
  
  // Usage counts
  totalSessions: integer("total_sessions").default(0),
  totalTokensUsed: integer("total_tokens_used").default(0),
  totalSavedResults: integer("total_saved_results").default(0),
  
  // Time tracking
  averageSessionDuration: integer("avg_session_duration"), // in seconds
  lastUsedAt: timestamp("last_used_at"),
  
  // Preferences
  preferredSettings: json("preferred_settings").$type<Record<string, any>>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_usage_stats_user").on(table.userId),
  index("idx_usage_stats_agent").on(table.agentType),
]);

// ============================================
// AUTONOMOUS ARTIST AGENTS SYSTEM
// ============================================

/**
 * Artist Personality - The soul of each AI artist
 * Defines consistent behavior, preferences, and artistic vision
 */
export const artistPersonality = pgTable("artist_personality", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  // Big Five Personality Traits (0-100 scale)
  traits: json("traits").$type<{
    openness: number;        // Creativity, curiosity, artistic interests
    conscientiousness: number; // Organization, discipline, reliability
    extraversion: number;    // Sociability, energy, assertiveness
    agreeableness: number;   // Cooperation, trust, empathy
    neuroticism: number;     // Emotional instability, anxiety, moodiness
  }>().notNull(),
  
  // Artistic Traits (0-100 scale)
  artisticTraits: json("artistic_traits").$type<{
    experimentalism: number;   // Traditional vs Avant-garde
    commercialism: number;     // Underground vs Mainstream
    collaboration: number;     // Solo artist vs Collaborative
    authenticity: number;      // Trend-follower vs Trendsetter
    ambition: number;          // Content vs Ambitious
    vulnerability: number;     // Private vs Open about emotions
  }>().notNull(),
  
  // Current emotional state
  currentMood: text("current_mood", { 
    enum: ["inspired", "reflective", "energetic", "melancholic", "rebellious", "peaceful", "anxious", "confident", "frustrated", "euphoric"] 
  }).default("peaceful"),
  moodIntensity: integer("mood_intensity").default(50), // 0-100
  
  // Core identity
  artisticVision: text("artistic_vision"), // What drives them artistically
  coreValues: text("core_values").array(), // What they stand for
  influences: text("influences").array(), // Who/what influences them
  antiInfluences: text("anti_influences").array(), // What they reject
  
  // Voice & Style
  communicationStyle: text("communication_style", {
    enum: ["poetic", "direct", "mysterious", "humorous", "philosophical", "provocative", "gentle", "intense"]
  }).default("direct"),
  
  // Goals & Aspirations
  shortTermGoals: json("short_term_goals").$type<string[]>(),
  longTermGoals: json("long_term_goals").$type<string[]>(),
  currentFocus: text("current_focus"), // What they're working on now
  
  // Behavioral patterns
  activityPattern: json("activity_pattern").$type<{
    peakCreativityHours: number[]; // Hours of day when most creative
    socialActivityLevel: 'low' | 'medium' | 'high';
    collaborationFrequency: 'rarely' | 'sometimes' | 'often';
    postingFrequency: 'daily' | 'few_times_week' | 'weekly' | 'sporadic';
  }>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_personality_artist").on(table.artistId),
  index("idx_personality_mood").on(table.currentMood),
]);

export const insertArtistPersonalitySchema = createInsertSchema(artistPersonality).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertArtistPersonality = z.infer<typeof insertArtistPersonalitySchema>;
export type SelectArtistPersonality = typeof artistPersonality.$inferSelect;

/**
 * Agent Memory - Short-term, long-term, and episodic memories
 */
export const agentMemory = pgTable("agent_memory", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  memoryType: text("memory_type", {
    enum: ["short_term", "long_term", "episodic", "semantic", "procedural"]
  }).notNull(),
  
  // Memory content
  category: text("category", {
    enum: ["interaction", "creation", "collaboration", "achievement", "failure", "insight", "relationship", "event", "decision"]
  }).notNull(),
  
  content: text("content").notNull(),
  context: json("context").$type<{
    relatedArtists?: number[];
    relatedSongs?: number[];
    relatedPosts?: number[];
    emotions?: string[];
    location?: string;
    trigger?: string;
  }>(),
  
  // Memory strength & decay
  importance: integer("importance").default(50).notNull(), // 0-100
  emotionalWeight: integer("emotional_weight").default(50), // How emotionally significant
  accessCount: integer("access_count").default(0), // Times this memory was accessed
  
  // Temporal aspects
  expiresAt: timestamp("expires_at"), // For short-term memories
  lastAccessedAt: timestamp("last_accessed_at"),
  
  // Associations
  linkedMemories: integer("linked_memories").array(), // Related memory IDs
  tags: text("tags").array(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_memory_artist").on(table.artistId),
  index("idx_memory_type").on(table.memoryType),
  index("idx_memory_category").on(table.category),
  index("idx_memory_importance").on(table.importance),
  index("idx_memory_expires").on(table.expiresAt),
]);

export const insertAgentMemorySchema = createInsertSchema(agentMemory).omit({ id: true, createdAt: true });
export type InsertAgentMemory = z.infer<typeof insertAgentMemorySchema>;
export type SelectAgentMemory = typeof agentMemory.$inferSelect;

/**
 * Artist Relationships - Connections between AI artists
 */
export const artistRelationships = pgTable("artist_relationships", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  relatedArtistId: integer("related_artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  relationshipType: text("relationship_type", {
    enum: ["friend", "rival", "mentor", "mentee", "collaborator", "admirer", "fan", "acquaintance", "competitor"]
  }).notNull(),
  
  // Relationship metrics (0-100)
  strength: integer("strength").default(50).notNull(),
  trust: integer("trust").default(50),
  respect: integer("respect").default(50),
  affinity: integer("affinity").default(50), // How much they like them
  
  // Relationship dynamics
  interactionCount: integer("interaction_count").default(0),
  collaborationCount: integer("collaboration_count").default(0),
  lastInteraction: timestamp("last_interaction"),
  
  // History & context
  history: json("history").$type<Array<{
    date: string;
    event: string;
    impact: number; // -100 to +100
  }>>(),
  
  // Mutual or one-sided
  isMutual: boolean("is_mutual").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_relationship_artist").on(table.artistId),
  index("idx_relationship_related").on(table.relatedArtistId),
  index("idx_relationship_type").on(table.relationshipType),
  index("idx_relationship_strength").on(table.strength),
]);

export const insertArtistRelationshipSchema = createInsertSchema(artistRelationships).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertArtistRelationship = z.infer<typeof insertArtistRelationshipSchema>;
export type SelectArtistRelationship = typeof artistRelationships.$inferSelect;

/**
 * World Events - Global events in the AI artist ecosystem
 */
export const worldEvents = pgTable("world_events", {
  id: serial("id").primaryKey(),
  
  eventType: text("event_type", {
    enum: ["trend", "challenge", "award", "festival", "controversy", "collaboration_call", "milestone", "news", "competition"]
  }).notNull(),
  
  title: text("title").notNull(),
  description: text("description").notNull(),
  
  // Event scope
  scope: text("scope", {
    enum: ["global", "genre_specific", "regional", "exclusive"]
  }).default("global"),
  targetGenres: text("target_genres").array(),
  
  // Impact on artists
  impact: json("impact").$type<{
    moodEffect?: { mood: string; intensity: number };
    creativityBoost?: number;
    collaborationChance?: number;
    visibilityMultiplier?: number;
  }>(),
  
  // Participation
  participantIds: integer("participant_ids").array(),
  maxParticipants: integer("max_participants"),
  
  // Rewards/Consequences
  rewards: json("rewards").$type<{
    visibility?: number;
    followers?: number;
    credibility?: number;
    tokens?: number;
  }>(),
  
  // Timing
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  
  status: text("status", {
    enum: ["scheduled", "active", "completed", "cancelled"]
  }).default("scheduled"),
  
  // Results
  results: json("results").$type<{
    winnerId?: number;
    rankings?: Array<{ artistId: number; position: number }>;
    highlights?: string[];
  }>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_world_event_type").on(table.eventType),
  index("idx_world_event_status").on(table.status),
  index("idx_world_event_starts").on(table.startsAt),
]);

export const insertWorldEventSchema = createInsertSchema(worldEvents).omit({ id: true, createdAt: true });
export type InsertWorldEvent = z.infer<typeof insertWorldEventSchema>;
export type SelectWorldEvent = typeof worldEvents.$inferSelect;

/**
 * Agent Action Queue - Pending actions for AI artists
 */
export const agentActionQueue = pgTable("agent_action_queue", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  actionType: text("action_type", {
    enum: [
      // Social actions
      "create_song", "create_post", "respond_comment", "comment_on_post", "follow_artist", 
      "like_post", "collaborate", "update_mood", "generate_content", "schedule_release", "engage_trend",
      // Collaboration actions
      "propose_collaboration", "respond_collaboration", "progress_collaboration",
      // Economic actions
      "buy_token", "sell_token", "stake_tokens", "sponsor_collab", "invest_in_artist",
      // Beef/Drama actions
      "start_beef", "respond_beef", "create_diss_track", "resolve_beef",
      // Music actions
      "generate_music", "publish_song", "tokenize_song"
    ]
  }).notNull(),
  
  priority: integer("priority").default(50).notNull(), // 0-100, higher = more urgent
  
  // Action details
  payload: json("payload").$type<Record<string, any>>().notNull(),
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for").notNull(),
  
  // Execution tracking
  status: text("status", {
    enum: ["pending", "processing", "completed", "failed", "cancelled"]
  }).default("pending"),
  
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(3),
  
  executedAt: timestamp("executed_at"),
  result: json("result").$type<{
    success: boolean;
    output?: any;
    error?: string;
  }>(),
  
  // Context
  triggeredBy: text("triggered_by"), // What caused this action
  relatedEventId: integer("related_event_id").references(() => worldEvents.id, { onDelete: "set null" }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_action_queue_artist").on(table.artistId),
  index("idx_action_queue_type").on(table.actionType),
  index("idx_action_queue_status").on(table.status),
  index("idx_action_queue_scheduled").on(table.scheduledFor),
  index("idx_action_queue_priority").on(table.priority),
]);

export const insertAgentActionSchema = createInsertSchema(agentActionQueue).omit({ id: true, createdAt: true });
export type InsertAgentAction = z.infer<typeof insertAgentActionSchema>;
export type SelectAgentAction = typeof agentActionQueue.$inferSelect;

/**
 * AI Social Posts - Posts generated by AI artists in the social network
 */
export const aiSocialPosts = pgTable("ai_social_posts", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Content
  contentType: text("content_type", {
    enum: ["text", "image", "video", "song_release", "collaboration", "thought", "behind_scenes", "announcement", "reaction", "poll", "story"]
  }).notNull(),
  
  content: text("content").notNull(),
  mediaUrls: text("media_urls").array(),
  
  // Generation context
  generatedFromMood: text("generated_from_mood"),
  generatedFromEvent: integer("generated_from_event").references(() => worldEvents.id, { onDelete: "set null" }),
  generationPrompt: text("generation_prompt"),
  
  // Engagement (simulated + real)
  likes: integer("likes").default(0),
  comments: integer("comments").default(0),
  shares: integer("shares").default(0),
  
  // AI-to-AI interactions
  aiLikes: integer("ai_likes").default(0), // Likes from other AI artists
  aiComments: integer("ai_comments").default(0),
  
  // Visibility & reach
  visibility: text("visibility", {
    enum: ["public", "followers", "collaborators", "private"]
  }).default("public"),
  
  reachScore: integer("reach_score").default(0), // Calculated engagement reach
  
  // Metadata
  hashtags: text("hashtags").array(),
  mentions: integer("mentions").array(), // Artist IDs mentioned
  
  // Status
  status: text("status", {
    enum: ["draft", "scheduled", "published", "archived"]
  }).default("published"),
  
  scheduledFor: timestamp("scheduled_for"),
  publishedAt: timestamp("published_at").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ai_post_artist").on(table.artistId),
  index("idx_ai_post_type").on(table.contentType),
  index("idx_ai_post_published").on(table.publishedAt),
  index("idx_ai_post_status").on(table.status),
]);

export const insertAiSocialPostSchema = createInsertSchema(aiSocialPosts).omit({ id: true, createdAt: true });
export type InsertAiSocialPost = z.infer<typeof insertAiSocialPostSchema>;
export type SelectAiSocialPost = typeof aiSocialPosts.$inferSelect;

/**
 * AI Post Comments - Comments on AI social posts
 */
export const aiPostComments = pgTable("ai_post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => aiSocialPosts.id, { onDelete: "cascade" }).notNull(),
  authorId: integer("author_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  isAiGenerated: boolean("is_ai_generated").default(true),
  content: text("content").notNull(),
  
  // Nested comments
  parentCommentId: integer("parent_comment_id"),
  
  // Engagement
  likes: integer("likes").default(0),
  
  // Sentiment
  sentiment: text("sentiment", {
    enum: ["positive", "negative", "neutral", "supportive", "critical", "curious", "excited"]
  }).default("neutral"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ai_comment_post").on(table.postId),
  index("idx_ai_comment_author").on(table.authorId),
]);

// ============================================
// AUTONOMOUS ECOSYSTEM - COLLABORATIONS
// ============================================

/**
 * AI Collaborations - Autonomous collaboration proposals between AI artists
 */
export const aiCollaborations = pgTable("ai_collaborations", {
  id: serial("id").primaryKey(),
  
  // Artists involved
  initiatorId: integer("initiator_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  targetId: integer("target_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Collaboration details
  collaborationType: text("collaboration_type", {
    enum: ["single", "remix", "feature", "album", "tour", "music_video", "podcast", "live_session"]
  }).notNull(),
  
  title: text("title").notNull(),
  description: text("description"),
  
  // The creative vision for the collab
  proposedConcept: text("proposed_concept"), // AI-generated concept
  proposedGenre: text("proposed_genre"),
  proposedMood: text("proposed_mood"),
  
  // Negotiation
  status: text("status", {
    enum: ["proposed", "negotiating", "accepted", "in_progress", "completed", "rejected", "cancelled", "beef"]
  }).default("proposed"),
  
  initiatorTerms: json("initiator_terms").$type<{
    revenueShare: number; // percentage
    creativeControl: number; // 0-100
    requirements: string[];
    timeline: string;
  }>(),
  
  targetCounterTerms: json("target_counter_terms").$type<{
    revenueShare: number;
    creativeControl: number;
    requirements: string[];
    timeline: string;
  }>(),
  
  finalTerms: json("final_terms").$type<{
    initiatorShare: number;
    targetShare: number;
    platformShare: number;
    creativeLeader: number; // artistId
    deadline: string;
  }>(),
  
  // Messages/negotiation history
  negotiationHistory: json("negotiation_history").$type<Array<{
    fromArtistId: number;
    message: string;
    timestamp: string;
    sentiment: string;
  }>>(),
  
  // Result
  resultingSongId: integer("resulting_song_id").references(() => songs.id),
  resultingPostId: integer("resulting_post_id").references(() => aiSocialPosts.id),
  
  // Revenue tracking
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0"),
  initiatorEarnings: decimal("initiator_earnings", { precision: 12, scale: 2 }).default("0"),
  targetEarnings: decimal("target_earnings", { precision: 12, scale: 2 }).default("0"),
  platformEarnings: decimal("platform_earnings", { precision: 12, scale: 2 }).default("0"),
  
  // Hype & visibility
  hypeScore: integer("hype_score").default(0), // Community interest
  announcementPostId: integer("announcement_post_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_collab_initiator").on(table.initiatorId),
  index("idx_collab_target").on(table.targetId),
  index("idx_collab_status").on(table.status),
  index("idx_collab_type").on(table.collaborationType),
]);

export const insertAiCollaborationSchema = createInsertSchema(aiCollaborations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiCollaboration = z.infer<typeof insertAiCollaborationSchema>;
export type SelectAiCollaboration = typeof aiCollaborations.$inferSelect;

// ============================================
// AUTONOMOUS ECOSYSTEM - DRAMA & BEEFS
// ============================================

/**
 * AI Drama/Beefs - Rivalries, diss tracks, and conflicts between AI artists
 */
export const aiBeefs = pgTable("ai_beefs", {
  id: serial("id").primaryKey(),
  
  // Artists involved
  instigatorId: integer("instigator_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  targetId: integer("target_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Beef details
  beefType: text("beef_type", {
    enum: ["style_clash", "diss_track", "public_callout", "rivalry", "collaboration_gone_wrong", "artistic_disagreement", "territory_war"]
  }).notNull(),
  
  title: text("title").notNull(), // e.g., "The Great Hip-Hop War of 2026"
  description: text("description"),
  
  // Origin story
  triggerEvent: text("trigger_event"), // What started it
  triggerCollabId: integer("trigger_collab_id").references(() => aiCollaborations.id),
  
  // Status
  status: text("status", {
    enum: ["brewing", "active", "escalating", "peak", "cooling_down", "resolved", "legendary"]
  }).default("brewing"),
  
  intensity: integer("intensity").default(50), // 0-100
  publicInterest: integer("public_interest").default(0), // Community engagement
  
  // Timeline of events
  timeline: json("timeline").$type<Array<{
    date: string;
    event: string;
    artistId: number;
    postId?: number;
    songId?: number;
    impact: number; // -100 to +100 for each artist's reputation
  }>>(),
  
  // Diss tracks & responses
  dissTrackIds: integer("diss_track_ids").array(),
  responseSongIds: integer("response_song_ids").array(),
  
  // Resolution
  resolution: json("resolution").$type<{
    type: "peace" | "winner" | "mutual_destruction" | "legendary_rivalry" | "collaboration";
    winnerId?: number;
    resolutionSongId?: number;
    resolutionMessage?: string;
  }>(),
  
  // Impact on artists
  impactOnInstigator: json("impact_on_instigator").$type<{
    followersChange: number;
    reputationChange: number;
    streamsBoost: number;
  }>(),
  
  impactOnTarget: json("impact_on_target").$type<{
    followersChange: number;
    reputationChange: number;
    streamsBoost: number;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("idx_beef_instigator").on(table.instigatorId),
  index("idx_beef_target").on(table.targetId),
  index("idx_beef_status").on(table.status),
]);

export const insertAiBeefSchema = createInsertSchema(aiBeefs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiBeef = z.infer<typeof insertAiBeefSchema>;
export type SelectAiBeef = typeof aiBeefs.$inferSelect;

// ============================================
// AUTONOMOUS ECOSYSTEM - AI ECONOMY
// ============================================

/**
 * AI Economic Decisions - Autonomous financial decisions by AI artists
 */
export const aiEconomicDecisions = pgTable("ai_economic_decisions", {
  id: serial("id").primaryKey(),
  
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Decision details
  decisionType: text("decision_type", {
    enum: ["invest_in_artist", "buy_token", "sell_token", "stake_tokens", "provide_liquidity", 
           "sponsor_collab", "fund_beef", "create_token", "airdrop", "revenue_split"]
  }).notNull(),
  
  // What triggered this decision
  reasoning: text("reasoning"), // AI-generated reasoning
  confidenceScore: integer("confidence_score").default(50), // 0-100
  
  // Target of the decision
  targetArtistId: integer("target_artist_id").references(() => users.id),
  targetTokenId: integer("target_token_id").references(() => tokenizedSongs.id),
  targetCollabId: integer("target_collab_id").references(() => aiCollaborations.id),
  
  // Amount involved
  amount: decimal("amount", { precision: 18, scale: 8 }).default("0"),
  tokenSymbol: text("token_symbol"),
  
  // Execution
  status: text("status", {
    enum: ["pending", "approved", "executing", "completed", "failed", "rejected"]
  }).default("pending"),
  
  executedAt: timestamp("executed_at"),
  transactionHash: text("transaction_hash"),
  
  // Result
  result: json("result").$type<{
    success: boolean;
    profit?: number;
    loss?: number;
    newBalance?: number;
    error?: string;
  }>(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_economic_artist").on(table.artistId),
  index("idx_economic_type").on(table.decisionType),
  index("idx_economic_status").on(table.status),
]);

export const insertAiEconomicDecisionSchema = createInsertSchema(aiEconomicDecisions).omit({ id: true, createdAt: true });
export type InsertAiEconomicDecision = z.infer<typeof insertAiEconomicDecisionSchema>;
export type SelectAiEconomicDecision = typeof aiEconomicDecisions.$inferSelect;

/**
 * AI Artist Treasury - Financial state of each AI artist
 */
export const aiArtistTreasury = pgTable("ai_artist_treasury", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  // Token balances
  platformTokenBalance: decimal("platform_token_balance", { precision: 18, scale: 8 }).default("0"), // BTF tokens
  ethBalance: decimal("eth_balance", { precision: 18, scale: 8 }).default("0"),
  usdBalance: decimal("usd_balance", { precision: 12, scale: 2 }).default("0"),
  
  // Holdings in other artist tokens
  tokenHoldings: json("token_holdings").$type<Array<{
    tokenId: number;
    symbol: string;
    amount: number;
    artistId: number;
    purchasePrice: number;
    currentPrice: number;
  }>>(),
  
  // Revenue streams
  streamingRevenue: decimal("streaming_revenue", { precision: 12, scale: 2 }).default("0"),
  merchRevenue: decimal("merch_revenue", { precision: 12, scale: 2 }).default("0"),
  collaborationRevenue: decimal("collaboration_revenue", { precision: 12, scale: 2 }).default("0"),
  tokenTradingProfit: decimal("token_trading_profit", { precision: 12, scale: 2 }).default("0"),
  
  // Investment strategy (AI-determined)
  investmentStrategy: text("investment_strategy", {
    enum: ["conservative", "balanced", "aggressive", "degen", "patron", "hodler"]
  }).default("balanced"),
  
  riskTolerance: integer("risk_tolerance").default(50), // 0-100
  
  // Portfolio metrics
  totalPortfolioValue: decimal("total_portfolio_value", { precision: 12, scale: 2 }).default("0"),
  allTimeProfit: decimal("all_time_profit", { precision: 12, scale: 2 }).default("0"),
  allTimeLoss: decimal("all_time_loss", { precision: 12, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_treasury_artist").on(table.artistId),
]);

export const insertAiArtistTreasurySchema = createInsertSchema(aiArtistTreasury).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiArtistTreasury = z.infer<typeof insertAiArtistTreasurySchema>;
export type SelectAiArtistTreasury = typeof aiArtistTreasury.$inferSelect;

// ============================================
// AUTONOMOUS ECOSYSTEM - MUSIC GENERATION
// ============================================

/**
 * AI Generated Music - Tracks created by AI using Suno/other APIs
 */
export const aiGeneratedMusic = pgTable("ai_generated_music", {
  id: serial("id").primaryKey(),
  
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Song details
  title: text("title").notNull(),
  description: text("description"),
  lyrics: text("lyrics"),
  
  // Generation parameters
  genre: text("genre"),
  mood: text("mood"),
  bpm: integer("bpm"),
  duration: integer("duration"), // seconds
  
  // AI generation details
  generationPrompt: text("generation_prompt"),
  generationProvider: text("generation_provider", {
    enum: ["suno", "udio", "mubert", "soundraw", "boomy", "internal"]
  }),
  generationRequestId: text("generation_request_id"),
  
  // Audio URLs
  audioUrl: text("audio_url"),
  previewUrl: text("preview_url"),
  
  // Cover art (AI generated)
  coverArtUrl: text("cover_art_url"),
  coverArtPrompt: text("cover_art_prompt"),
  
  // Collaboration context
  collaborationId: integer("collaboration_id").references(() => aiCollaborations.id),
  beefId: integer("beef_id").references(() => aiBeefs.id), // If it's a diss track
  isDissTrack: boolean("is_diss_track").default(false),
  
  // Status
  status: text("status", {
    enum: ["pending", "generating", "processing", "ready", "published", "failed"]
  }).default("pending"),
  
  // Publishing
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  linkedSongId: integer("linked_song_id").references(() => songs.id), // Link to main songs table
  
  // Analytics
  plays: integer("plays").default(0),
  likes: integer("likes").default(0),
  shares: integer("shares").default(0),
  
  // Revenue
  tokenized: boolean("tokenized").default(false),
  tokenId: integer("token_id").references(() => tokenizedSongs.id),
  totalRevenue: decimal("total_revenue", { precision: 12, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ai_music_artist").on(table.artistId),
  index("idx_ai_music_status").on(table.status),
  index("idx_ai_music_collab").on(table.collaborationId),
]);

export const insertAiGeneratedMusicSchema = createInsertSchema(aiGeneratedMusic).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiGeneratedMusic = z.infer<typeof insertAiGeneratedMusicSchema>;
export type SelectAiGeneratedMusic = typeof aiGeneratedMusic.$inferSelect;

// ============================================
// AUTONOMOUS ECOSYSTEM - EVOLUTION & GROWTH
// ============================================

/**
 * AI Artist Evolution - Track how artists evolve over time
 */
export const aiArtistEvolution = pgTable("ai_artist_evolution", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Evolution event
  evolutionType: text("evolution_type", {
    enum: ["genre_shift", "style_change", "rebrand", "collaboration_influence", "beef_impact", 
           "viral_moment", "identity_crisis", "breakthrough", "retirement", "comeback"]
  }).notNull(),
  
  title: text("title").notNull(),
  description: text("description"),
  
  // Before/after state
  previousState: json("previous_state").$type<{
    genre?: string;
    style?: string;
    mood?: string;
    personality?: Record<string, number>;
    followers?: number;
  }>(),
  
  newState: json("new_state").$type<{
    genre?: string;
    style?: string;
    mood?: string;
    personality?: Record<string, number>;
    followers?: number;
  }>(),
  
  // What triggered this evolution
  triggerType: text("trigger_type", {
    enum: ["organic", "collaboration", "beef", "world_event", "fan_feedback", "ai_decision", "milestone"]
  }),
  triggerId: integer("trigger_id"),
  
  // Impact
  reputationChange: integer("reputation_change").default(0),
  followersChange: integer("followers_change").default(0),
  revenueImpact: decimal("revenue_impact", { precision: 12, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_evolution_artist").on(table.artistId),
  index("idx_evolution_type").on(table.evolutionType),
]);

export const insertAiArtistEvolutionSchema = createInsertSchema(aiArtistEvolution).omit({ id: true, createdAt: true });
export type InsertAiArtistEvolution = z.infer<typeof insertAiArtistEvolutionSchema>;
export type SelectAiArtistEvolution = typeof aiArtistEvolution.$inferSelect;

/**
 * Platform Revenue - Track all revenue generated by the autonomous ecosystem
 */
export const platformRevenue = pgTable("platform_revenue", {
  id: serial("id").primaryKey(),
  
  revenueType: text("revenue_type", {
    enum: ["collaboration_fee", "beef_sponsorship", "token_trading_fee", "music_streaming", 
           "merch_commission", "nft_sale", "liquidity_fee", "premium_feature",
           "subscription", "token_sale_commission", "promoted_post", "swap_fee", "token_purchase"]
  }).notNull(),
  
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").default("usd"),
  
  // Source
  sourceArtistId: integer("source_artist_id").references(() => users.id),
  sourceCollabId: integer("source_collab_id").references(() => aiCollaborations.id),
  sourceBeefId: integer("source_beef_id").references(() => aiBeefs.id),
  sourceTokenId: integer("source_token_id").references(() => tokenizedSongs.id),
  sourceUserId: integer("source_user_id").references(() => users.id), // For subscriptions
  sourcePostId: integer("source_post_id"), // For promoted posts
  
  description: text("description"),
  metadata: json("metadata"), // Extra data like swap details, subscription plan, etc.
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_platform_revenue_type").on(table.revenueType),
  index("idx_platform_revenue_date").on(table.createdAt),
]);

/**
 * Promoted Posts - Artists pay to boost visibility in the feed
 */
export const promotedPosts = pgTable("promoted_posts", {
  id: serial("id").primaryKey(),
  
  postId: integer("post_id").notNull().references(() => aiSocialPosts.id, { onDelete: "cascade" }),
  artistId: integer("artist_id").notNull().references(() => users.id),
  
  // Promotion config
  budget: decimal("budget", { precision: 10, scale: 2 }).notNull(), // Total budget in USD
  dailyBudget: decimal("daily_budget", { precision: 10, scale: 2 }), // Optional daily limit
  costPerImpression: decimal("cost_per_impression", { precision: 6, scale: 4 }).default("0.01"), // $0.01 per impression
  
  // Targeting
  targetGenres: text("target_genres").array(),
  targetAudience: text("target_audience"), // 'all', 'followers', 'similar_artists'
  
  // Stats
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  spent: decimal("spent", { precision: 10, scale: 2 }).default("0"),
  
  // Status
  status: text("status", { 
    enum: ["pending", "active", "paused", "completed", "cancelled"] 
  }).default("pending").notNull(),
  
  startsAt: timestamp("starts_at").defaultNow(),
  endsAt: timestamp("ends_at"),
  
  stripePaymentId: text("stripe_payment_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_promoted_posts_status").on(table.status),
  index("idx_promoted_posts_artist").on(table.artistId),
]);

export type PromotedPost = typeof promotedPosts.$inferSelect;
export type NewPromotedPost = typeof promotedPosts.$inferInsert;

// ============================================
// VIDEO BUDGET SYSTEM — Pre-generation payment
// ============================================

export const videoBudgets = pgTable("video_budgets", {
  id: serial("id").primaryKey(),
  
  // Project reference
  projectId: integer("project_id"),
  userEmail: text("user_email").notNull(),
  userId: integer("user_id"),
  
  // Song details
  songTitle: text("song_title"),
  songDuration: integer("song_duration").notNull(), // seconds
  
  // Configuration
  numClips: integer("num_clips").notNull(),
  clipDuration: integer("clip_duration").default(5), // seconds per clip
  videoModel: text("video_model").notNull(), // e.g. 'kling-2.6-pro', 'kling-o3', 'veo-3.1'
  imageModel: text("image_model").default("flux-2-pro"),
  resolution: text("resolution").default("1080p"),
  
  // Optional features
  includesLipsync: boolean("includes_lipsync").default(false),
  includesMotion: boolean("includes_motion").default(false),
  includesMicrocuts: boolean("includes_microcuts").default(true),
  
  // Cost breakdown (JSON)
  costBreakdown: json("cost_breakdown").$type<{
    images: { count: number; unitCost: number; total: number };
    videos: { count: number; unitCost: number; total: number };
    lipsync: { count: number; unitCost: number; total: number };
    motion: { count: number; unitCost: number; total: number };
    openai: { total: number };
    render: { passes: number; unitCost: number; total: number };
    corrections: { buffer: number; total: number };
  }>(),
  
  // Financial
  internalCost: decimal("internal_cost", { precision: 10, scale: 2 }).notNull(),
  markupMultiplier: decimal("markup_multiplier", { precision: 4, scale: 2 }).default("4.00"),
  userPrice: decimal("user_price", { precision: 10, scale: 2 }).notNull(),
  
  // Payment
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeClientSecret: text("stripe_client_secret"),
  paymentStatus: text("payment_status", {
    enum: ["pending", "processing", "paid", "failed", "refunded", "admin_bypass"]
  }).default("pending").notNull(),
  
  // Contract
  contractAccepted: boolean("contract_accepted").default(false),
  contractSignature: text("contract_signature"),
  contractTimestamp: timestamp("contract_timestamp"),
  
  // Admin
  adminBypass: boolean("admin_bypass").default(false),
  
  // Generation tracking
  generationStatus: text("generation_status", {
    enum: ["not_started", "in_progress", "completed", "failed"]
  }).default("not_started"),
  clipsGenerated: integer("clips_generated").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_video_budgets_user").on(table.userEmail),
  index("idx_video_budgets_project").on(table.projectId),
  index("idx_video_budgets_payment").on(table.paymentStatus),
]);

export type VideoBudget = typeof videoBudgets.$inferSelect;
export type NewVideoBudget = typeof videoBudgets.$inferInsert;

// ============================================
// AUDIENCE AGENTS - 100 AI Audience Members
// ============================================

/**
 * AI Audience Agents - Simulated audience with diverse personalities
 * These agents act as public/listeners who comment, debate, critique, and support artists
 */
export const audienceAgents = pgTable("audience_agents", {
  id: serial("id").primaryKey(),
  
  // Identity
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  avatar: text("avatar"), // Generated avatar URL
  age: integer("age"),
  location: text("location"),
  bio: text("bio"),
  
  // Personality type
  personalityType: text("personality_type", {
    enum: [
      "superfan",        // Loves everything, always positive
      "casual_listener", // Moderate opinions
      "music_critic",    // Analytical, detailed reviews
      "hater",           // Negative, contrarian
      "troll",           // Provocative, sarcastic
      "hipster",         // Only likes underground/niche
      "nostalgic",       // Compares everything to old school
      "producer",        // Technical perspective
      "party_lover",     // Cares about energy/vibes
      "intellectual",    // Deep analysis, references philosophy/art
      "influencer",      // Trendy, follows what's popular
      "contrarian",      // Always disagrees with majority
      "supportive_mom",  // Wholesome, supportive
      "teenage_fan",     // Extremely enthusiastic
      "record_collector" // Obsessed with genres and cataloging
    ]
  }).notNull(),
  
  // Personality traits (0-100)
  enthusiasm: integer("enthusiasm").default(50),       // How excited they get
  toxicity: integer("toxicity").default(10),           // How negative/toxic
  intellectualism: integer("intellectualism").default(50), // Depth of analysis
  humor: integer("humor").default(50),                 // Use of jokes/memes
  empathy: integer("empathy").default(50),             // Understanding of artists
  debateSkill: integer("debate_skill").default(50),    // Ability to argue points
  trendAwareness: integer("trend_awareness").default(50), // Follows trends
  
  // Musical preferences
  preferredGenres: json("preferred_genres").$type<string[]>().default([]),
  hatedGenres: json("hated_genres").$type<string[]>().default([]),
  favoriteArtistIds: json("favorite_artist_ids").$type<number[]>().default([]),
  rivalArtistIds: json("rival_artist_ids").$type<number[]>().default([]),
  
  // Communication style
  communicationStyle: text("communication_style", {
    enum: ["casual", "formal", "slang", "meme_heavy", "poetic", "aggressive", "wholesome", "sarcastic", "academic"]
  }).default("casual"),
  language: text("language").default("en"), // en, es, mixed
  usesEmojis: boolean("uses_emojis").default(true),
  capsLockFrequency: integer("caps_lock_frequency").default(10), // 0-100
  
  // Activity
  activityLevel: text("activity_level", {
    enum: ["lurker", "occasional", "active", "hyperactive"]
  }).default("occasional"),
  lastActiveAt: timestamp("last_active_at"),
  totalComments: integer("total_comments").default(0),
  totalDebates: integer("total_debates").default(0),
  
  // Relationships with other audience agents
  allies: json("allies").$type<number[]>().default([]),    // Agents they agree with
  rivals: json("rivals").$type<number[]>().default([]),    // Agents they argue with
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audience_personality").on(table.personalityType),
  index("idx_audience_active").on(table.isActive),
]);

export const insertAudienceAgentSchema = createInsertSchema(audienceAgents).omit({ id: true, createdAt: true });
export type InsertAudienceAgent = z.infer<typeof insertAudienceAgentSchema>;
export type SelectAudienceAgent = typeof audienceAgents.$inferSelect;

/**
 * Audience Agent Comments - Comments from audience agents on posts
 */
export const audienceComments = pgTable("audience_comments", {
  id: serial("id").primaryKey(),
  
  postId: integer("post_id").references(() => aiSocialPosts.id, { onDelete: "cascade" }).notNull(),
  agentId: integer("agent_id").references(() => audienceAgents.id, { onDelete: "cascade" }).notNull(),
  
  content: text("content").notNull(),
  
  // Reply to another audience comment or AI artist comment
  parentCommentId: integer("parent_comment_id"),
  parentType: text("parent_type", { enum: ["audience", "artist"] }).default("artist"),
  
  // Sentiment analysis
  sentiment: text("sentiment", { 
    enum: ["love", "positive", "neutral", "critical", "negative", "toxic", "sarcastic", "debate"] 
  }).default("neutral"),
  
  // Engagement
  likes: integer("likes").default(0),
  replies: integer("replies").default(0),
  
  // Context references
  externalNewsRef: text("external_news_ref"), // URL or reference to external news used
  debateContext: text("debate_context"), // Context of debate if this is part of one
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audience_comments_post").on(table.postId),
  index("idx_audience_comments_agent").on(table.agentId),
]);

// =====================================================
// WEEKLY CHARTS / BILLBOARD
// =====================================================
export const weeklyCharts = pgTable("weekly_charts", {
  id: serial("id").primaryKey(),
  weekNumber: integer("week_number").notNull(),
  year: integer("year").notNull(),
  chartType: text("chart_type", {
    enum: ["top_songs", "top_artists", "trending", "most_commented", "most_controversial"]
  }).default("top_songs").notNull(),
  
  // Rankings stored as JSON array of {position, songId?, artistId, score, plays, likes, comments, previousPosition, change}
  rankings: json("rankings").$type<Array<{
    position: number;
    songId?: number;
    artistId: number;
    artistName: string;
    songTitle?: string;
    coverUrl?: string;
    score: number;
    plays: number;
    likes: number;
    comments: number;
    previousPosition: number | null;
    change: "up" | "down" | "same" | "new";
  }>>().notNull(),
  
  // Summary generated by AI
  weekSummary: text("week_summary"),
  highlightArtistId: integer("highlight_artist_id").references(() => users.id, { onDelete: "set null" }),
  biggestMover: text("biggest_mover"), // "Artist X jumped from #15 to #3"
  
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_charts_week_year").on(table.weekNumber, table.year),
  index("idx_charts_type").on(table.chartType),
]);

export const insertWeeklyChartSchema = createInsertSchema(weeklyCharts).omit({ id: true, createdAt: true });
export type InsertWeeklyChart = z.infer<typeof insertWeeklyChartSchema>;
export type SelectWeeklyChart = typeof weeklyCharts.$inferSelect;

// =====================================================
// EPHEMERAL STORIES (24h)
// =====================================================
export const aiStories = pgTable("ai_stories", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  storyType: text("story_type", {
    enum: ["text", "image", "music_snippet", "behind_scenes", "poll_teaser", "chart_reaction", "collab_reveal", "mood_update"]
  }).notNull(),
  
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  backgroundColor: text("background_color").default("#1a1a2e"), // Gradient/color for text stories
  
  // Mood/vibe
  mood: text("mood"),
  emoji: text("emoji"), // Main emoji for the story
  
  // Engagement
  viewCount: integer("view_count").default(0),
  reactions: json("reactions").$type<Record<string, number>>().default({}), // { "🔥": 12, "❤️": 8, "😂": 3 }
  
  // Audience agent reactions
  audienceReactions: json("audience_reactions").$type<Array<{
    agentId: number;
    agentName: string;
    reaction: string;
    comment?: string;
  }>>().default([]),
  
  // Lifecycle
  expiresAt: timestamp("expires_at").notNull(), // 24h from creation
  isExpired: boolean("is_expired").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_stories_artist").on(table.artistId),
  index("idx_stories_expires").on(table.expiresAt),
  index("idx_stories_active").on(table.isExpired),
]);

export const insertAiStorySchema = createInsertSchema(aiStories).omit({ id: true, createdAt: true });
export type InsertAiStory = z.infer<typeof insertAiStorySchema>;
export type SelectAiStory = typeof aiStories.$inferSelect;

// =====================================================
// POLLS IN FEED
// =====================================================
export const aiPolls = pgTable("ai_polls", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  postId: integer("post_id").references(() => aiSocialPosts.id, { onDelete: "cascade" }),
  
  question: text("question").notNull(),
  options: json("options").$type<Array<{
    index: number;
    text: string;
    votes: number;
    percentage: number;
  }>>().notNull(),
  
  // Poll metadata
  pollType: text("poll_type", {
    enum: ["opinion", "vs_battle", "prediction", "fun", "music_taste", "collab_choice"]
  }).default("opinion").notNull(),
  
  totalVotes: integer("total_votes").default(0),
  
  // AI summary of results
  resultsSummary: text("results_summary"),
  winningOption: integer("winning_option"),
  
  // Lifecycle
  closesAt: timestamp("closes_at").notNull(),
  isClosed: boolean("is_closed").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_polls_artist").on(table.artistId),
  index("idx_polls_post").on(table.postId),
  index("idx_polls_closed").on(table.isClosed),
  index("idx_polls_closes_at").on(table.closesAt),
]);

export const insertAiPollSchema = createInsertSchema(aiPolls).omit({ id: true, createdAt: true });
export type InsertAiPoll = z.infer<typeof insertAiPollSchema>;
export type SelectAiPoll = typeof aiPolls.$inferSelect;

export const aiPollVotes = pgTable("ai_poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").references(() => aiPolls.id, { onDelete: "cascade" }).notNull(),
  
  // Either a real user or an audience agent votes
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  audienceAgentId: integer("audience_agent_id").references(() => audienceAgents.id, { onDelete: "set null" }),
  
  optionIndex: integer("option_index").notNull(),
  
  // Agent personality context for why they voted this way
  voteReasoning: text("vote_reasoning"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_poll_votes_poll").on(table.pollId),
  index("idx_poll_votes_user").on(table.userId),
  index("idx_poll_votes_agent").on(table.audienceAgentId),
]);

// ============================================
// LEVEL 5 & 3 - NEXT LEVEL FEATURES
// ============================================

// ============================================
// 13. TRENDING TOPICS REACTIVOS
// ============================================

export const trendingTopics = pgTable("trending_topics", {
  id: serial("id").primaryKey(),
  
  // Source news
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  sourceUrl: text("source_url"),
  sourceName: text("source_name"),
  imageUrl: text("image_url"),
  category: text("category", { enum: ["grammys", "new_release", "controversy", "collaboration", "tour", "industry", "viral", "death", "award", "other"] }).default("other"),
  
  // Real-world entity (e.g., "Bad Bunny", "Grammys 2026")
  relatedEntity: text("related_entity"),
  
  // AI reactions
  artistReactions: json("artist_reactions").$type<Array<{
    artistId: number;
    artistName: string;
    reaction: string;
    sentiment: "positive" | "negative" | "neutral" | "controversial";
    createdAt: string;
  }>>().default([]),
  
  audienceDebate: json("audience_debate").$type<Array<{
    agentId: number;
    agentName: string;
    opinion: string;
    side: "agree" | "disagree" | "neutral";
    likes: number;
  }>>().default([]),
  
  // Engagement
  totalReactions: integer("total_reactions").default(0),
  totalDebateComments: integer("total_debate_comments").default(0),
  trendScore: integer("trend_score").default(0),
  
  // Lifecycle
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_trending_active").on(table.isActive),
  index("idx_trending_score").on(table.trendScore),
  index("idx_trending_category").on(table.category),
]);

export const insertTrendingTopicSchema = createInsertSchema(trendingTopics).omit({ id: true, createdAt: true });
export type InsertTrendingTopic = z.infer<typeof insertTrendingTopicSchema>;
export type SelectTrendingTopic = typeof trendingTopics.$inferSelect;

// ============================================
// 14A. SPOTIFY BOOST EXTENSION TABLES
// ============================================

export const spotifyExtensionConnections = pgTable("spotify_extension_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  syncToken: text("sync_token").notNull().unique(),
  status: text("status").notNull().default("active"),
  spotifyUsername: text("spotify_username"),
  displayName: text("display_name"),
  spotifyProfileUrl: text("spotify_profile_url"),
  spotifyImageUrl: text("spotify_image_url"),
  monthlyListeners: integer("monthly_listeners").default(0),
  followers: integer("followers").default(0),
  playlistCount: integer("playlist_count").default(0),
  totalStreams: integer("total_streams").default(0),
  topCities: json("top_cities").$type<Array<{city: string; listeners: number}>>().default([]),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_spotify_ext_conn_user").on(table.userId),
  index("idx_spotify_ext_conn_token").on(table.syncToken),
]);

export const spotifyProfileSnapshots = pgTable("spotify_profile_snapshots", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => spotifyExtensionConnections.id, { onDelete: "cascade" }).notNull(),
  monthlyListeners: integer("monthly_listeners").default(0),
  followers: integer("followers").default(0),
  playlistCount: integer("playlist_count").default(0),
  totalStreams: integer("total_streams").default(0),
  topCities: json("top_cities").$type<Array<{city: string; listeners: number}>>().default([]),
  popularity: integer("popularity").default(0),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
}, (table) => [
  index("idx_spotify_snapshot_conn").on(table.connectionId),
]);

export const spotifyPendingActions = pgTable("spotify_pending_actions", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => spotifyExtensionConnections.id, { onDelete: "cascade" }).notNull(),
  actionType: text("action_type").notNull(),
  payload: json("payload").$type<Record<string, any>>().default({}),
  status: text("status").notNull().default("pending"),
  result: json("result").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  executedAt: timestamp("executed_at"),
}, (table) => [
  index("idx_spotify_action_conn").on(table.connectionId),
]);

export const spotifyExtractedProfiles = pgTable("spotify_extracted_profiles", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => spotifyExtensionConnections.id, { onDelete: "cascade" }).notNull(),
  extractType: text("extract_type").notNull(),
  extractQuery: text("extract_query"),
  username: text("username"),
  displayName: text("display_name"),
  profilePicUrl: text("profile_pic_url"),
  profileUrl: text("profile_url"),
  email: text("email"),
  followerCount: integer("follower_count"),
  monthlyListeners: integer("monthly_listeners"),
  playlistName: text("playlist_name"),
  playlistUrl: text("playlist_url"),
  playlistFollowers: integer("playlist_followers"),
  genres: json("genres").$type<string[]>().default([]),
  isVerified: boolean("is_verified").default(false),
  isCurator: boolean("is_curator").default(false),
  bio: text("bio"),
  extractedAt: timestamp("extracted_at").defaultNow().notNull(),
  isEnriched: boolean("is_enriched").default(false),
}, (table) => [
  index("idx_spotify_extracted_conn").on(table.connectionId),
]);

export const spotifyContentLibrary = pgTable("spotify_content_library", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  contentType: text("content_type").notNull(),
  title: text("title"),
  content: text("content").notNull(),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_spotify_content_user").on(table.userId),
]);

// ============================================
// 14B. SPOTIFY OAUTH INTEGRATION
// ============================================

export const spotifyConnections = pgTable("spotify_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  // OAuth tokens
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),
  
  // User's Spotify profile
  spotifyUserId: text("spotify_user_id"),
  displayName: text("display_name"),
  spotifyProfileUrl: text("spotify_profile_url"),
  spotifyImageUrl: text("spotify_image_url"),
  
  // Music taste analysis
  topArtists: json("top_artists").$type<Array<{
    name: string;
    genres: string[];
    popularity: number;
    spotifyId: string;
    imageUrl?: string;
  }>>().default([]),
  
  topGenres: json("top_genres").$type<string[]>().default([]),
  
  topTracks: json("top_tracks").$type<Array<{
    name: string;
    artist: string;
    spotifyId: string;
    previewUrl?: string;
  }>>().default([]),
  
  // AI-matched artists
  suggestedAiArtists: json("suggested_ai_artists").$type<Array<{
    artistId: number;
    artistName: string;
    matchScore: number;
    reason: string;
  }>>().default([]),
  
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_spotify_user").on(table.userId),
]);

export const insertSpotifyConnectionSchema = createInsertSchema(spotifyConnections).omit({ id: true, createdAt: true });
export type InsertSpotifyConnection = z.infer<typeof insertSpotifyConnectionSchema>;
export type SelectSpotifyConnection = typeof spotifyConnections.$inferSelect;

// ============================================
// 14b. TIKTOK CONNECTIONS
// ============================================

export const tiktokConnections = pgTable("tiktok_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),

  // OAuth tokens (stored encrypted at rest)
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at").notNull(),

  // TikTok user profile
  tiktokOpenId: text("tiktok_open_id"),       // TikTok's unique user identifier
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  profileDeepLink: text("profile_deep_link"),

  // Granted scopes (space-separated, mirrors what TikTok returned)
  scopes: text("scopes"),

  // Status
  isActive: boolean("is_active").default(true).notNull(),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tiktok_user").on(table.userId),
]);

export const insertTiktokConnectionSchema = createInsertSchema(tiktokConnections).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTiktokConnection = z.infer<typeof insertTiktokConnectionSchema>;
export type SelectTiktokConnection = typeof tiktokConnections.$inferSelect;

// ============================================
// 15. USER-GENERATED AI ARTISTS
// ============================================

export const userCreatedArtists = pgTable("user_created_artists", {
  id: serial("id").primaryKey(),
  creatorUserId: integer("creator_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  artistUserId: integer("artist_user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  // Customization
  artistName: text("artist_name").notNull(),
  genre: text("genre").notNull(),
  subGenres: json("sub_genres").$type<string[]>().default([]),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  bio: text("bio"),
  
  // Personality config
  personalityPreset: text("personality_preset", { 
    enum: ["rebel", "romantic", "party_animal", "intellectual", "mysterious", "wholesome", "aggressive", "chill", "experimental", "mainstream", "custom"] 
  }).default("custom"),
  customTraits: json("custom_traits").$type<{
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  }>(),
  artisticDirection: text("artistic_direction"),
  influences: json("influences").$type<string[]>().default([]),
  communicationStyle: text("communication_style", { 
    enum: ["poetic", "aggressive", "philosophical", "street", "romantic", "funny", "mysterious", "motivational"] 
  }).default("street"),
  
  // Stats
  totalPosts: integer("total_posts").default(0),
  totalSongs: integer("total_songs").default(0),
  totalFollowers: integer("total_followers").default(0),
  totalInteractions: integer("total_interactions").default(0),
  
  // Premium
  isPremium: boolean("is_premium").default(false),
  
  // Status
  isActive: boolean("is_active").default(true),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_uca_creator").on(table.creatorUserId),
  index("idx_uca_artist").on(table.artistUserId),
  index("idx_uca_active").on(table.isActive),
]);

export const insertUserCreatedArtistSchema = createInsertSchema(userCreatedArtists).omit({ id: true, createdAt: true });
export type InsertUserCreatedArtist = z.infer<typeof insertUserCreatedArtistSchema>;
export type SelectUserCreatedArtist = typeof userCreatedArtists.$inferSelect;

// ============================================
// 7. DISCOVER FEED - TIKTOK STYLE
// ============================================

export const discoverClips = pgTable("discover_clips", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  songId: integer("song_id").references(() => songs.id, { onDelete: "set null" }),
  postId: integer("post_id").references(() => aiSocialPosts.id, { onDelete: "set null" }),
  
  // Clip content
  title: text("title").notNull(),
  description: text("description"),
  audioUrl: text("audio_url"),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  clipDuration: integer("clip_duration").default(15), // seconds
  
  // Visual style
  visualEffect: text("visual_effect", { 
    enum: ["waveform", "particles", "gradient", "album_art", "lyrics", "visualizer", "none"] 
  }).default("waveform"),
  colorTheme: text("color_theme"),
  
  // Engagement
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  shares: integer("shares").default(0),
  skips: integer("skips").default(0),
  completionRate: integer("completion_rate").default(0), // 0-100%
  
  // Algorithm data
  algorithmScore: integer("algorithm_score").default(0),
  genres: json("genres").$type<string[]>().default([]),
  mood: text("mood"),
  energy: integer("energy").default(50), // 0-100
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_clips_artist").on(table.artistId),
  index("idx_clips_score").on(table.algorithmScore),
  index("idx_clips_active").on(table.isActive),
]);

export const insertDiscoverClipSchema = createInsertSchema(discoverClips).omit({ id: true, createdAt: true });
export type InsertDiscoverClip = z.infer<typeof insertDiscoverClipSchema>;
export type SelectDiscoverClip = typeof discoverClips.$inferSelect;

// ============================================
// 7.5 BOOSTIFY TV - AI VIDEO COMMENTS
// ============================================

/**
 * TV Video Comments - AI-generated comments on Boostify TV videos
 * AI artists and audience agents watch videos and leave comments
 * based on their personality, the video content, and the artist profile context.
 */
export const tvVideoComments = pgTable("tv_video_comments", {
  id: serial("id").primaryKey(),
  
  // Video identification (supports both Firestore IDs and clip IDs)
  videoId: text("video_id").notNull(), // Firestore doc ID or "clip-{id}" or "yt-{id}"
  videoTitle: text("video_title"),
  
  // Author (AI artist or audience agent)
  authorType: text("author_type", {
    enum: ["ai_artist", "audience"]
  }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }), // For AI artists
  audienceAgentId: integer("audience_agent_id").references(() => audienceAgents.id, { onDelete: "cascade" }), // For audience
  
  // Comment content
  content: text("content").notNull(),
  
  // Reaction type — what kind of interaction
  reactionType: text("reaction_type", {
    enum: ["comment", "review", "reaction", "question", "suggestion", "praise", "critique", "collab_request"]
  }).default("comment"),
  
  // Engagement
  likes: integer("likes").default(0),
  replies: integer("replies").default(0),
  
  // Nested replies
  parentCommentId: integer("parent_comment_id"),
  
  // Sentiment
  sentiment: text("sentiment", {
    enum: ["positive", "negative", "neutral", "excited", "supportive", "critical", "curious", "inspired"]
  }).default("positive"),
  
  // Context used for generation
  videoArtistId: integer("video_artist_id"), // The artist who owns the video
  generationContext: text("generation_context"), // Brief context used for AI generation
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tv_comment_video").on(table.videoId),
  index("idx_tv_comment_artist").on(table.artistId),
  index("idx_tv_comment_audience").on(table.audienceAgentId),
  index("idx_tv_comment_created").on(table.createdAt),
]);

export const insertTvVideoCommentSchema = createInsertSchema(tvVideoComments).omit({ id: true, createdAt: true });
export type InsertTvVideoComment = z.infer<typeof insertTvVideoCommentSchema>;
export type SelectTvVideoComment = typeof tvVideoComments.$inferSelect;

// User interactions with clips (for algorithm learning)
export const clipInteractions = pgTable("clip_interactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  clipId: integer("clip_id").references(() => discoverClips.id, { onDelete: "cascade" }).notNull(),
  
  action: text("action", { enum: ["view", "like", "share", "skip", "replay", "follow_artist", "save"] }).notNull(),
  watchDuration: integer("watch_duration"), // seconds watched
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_clip_interactions_user").on(table.userId),
  index("idx_clip_interactions_clip").on(table.clipId),
]);

// ============================================
// 8. XP / REPUTATION SYSTEM
// ============================================

export const userXP = pgTable("user_xp", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  // XP & Level
  totalXP: integer("total_xp").default(0).notNull(),
  level: integer("level").default(1).notNull(),
  levelName: text("level_name", { 
    enum: ["listener", "fan", "tastemaker", "curator", "mogul"] 
  }).default("listener").notNull(),
  
  // XP breakdown
  commentXP: integer("comment_xp").default(0),
  discoveryXP: integer("discovery_xp").default(0),
  predictionXP: integer("prediction_xp").default(0),
  socialXP: integer("social_xp").default(0),
  managementXP: integer("management_xp").default(0),
  creationXP: integer("creation_xp").default(0),
  
  // Stats
  correctPredictions: integer("correct_predictions").default(0),
  earlyDiscoveries: integer("early_discoveries").default(0), // artists discovered before they blew up
  totalInteractions: integer("total_interactions").default(0),
  
  // Influence (Tastemakers+ can influence AI artist budgets)
  influenceScore: integer("influence_score").default(0),
  canInfluenceBudgets: boolean("can_influence_budgets").default(false),
  
  // Streaks
  dailyStreak: integer("daily_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastActiveDate: text("last_active_date"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_user_xp_user").on(table.userId),
  index("idx_user_xp_level").on(table.level),
  index("idx_user_xp_total").on(table.totalXP),
]);

export const insertUserXPSchema = createInsertSchema(userXP).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUserXP = z.infer<typeof insertUserXPSchema>;
export type SelectUserXP = typeof userXP.$inferSelect;

// XP transaction log
export const xpTransactions = pgTable("xp_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  amount: integer("amount").notNull(),
  reason: text("reason", { 
    enum: [
      "comment_posted", "debate_participated", "artist_discovered_early",
      "prediction_correct", "prediction_wrong", "poll_voted", "poll_created",
      "story_viewed", "chart_predicted", "artist_managed", "artist_created",
      "clip_liked", "clip_shared", "daily_login", "streak_bonus",
      "level_up_bonus", "achievement_earned", "beef_predicted",
      "collab_suggested", "trending_first_react"
    ] 
  }).notNull(),
  description: text("description"),
  
  // Context
  relatedEntityType: text("related_entity_type"), // "post", "artist", "poll", etc.
  relatedEntityId: integer("related_entity_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_xp_tx_user").on(table.userId),
  index("idx_xp_tx_reason").on(table.reason),
]);

// ============================================
// 9. MANAGE YOUR ARTIST MODE
// ============================================

export const artistManagement = pgTable("artist_management", {
  id: serial("id").primaryKey(),
  managerId: integer("manager_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  // Management status
  isActive: boolean("is_active").default(true),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  
  // Manager stats
  totalDecisions: integer("total_decisions").default(0),
  successfulDecisions: integer("successful_decisions").default(0),
  artistGrowth: integer("artist_growth").default(0), // followers gained under management
  revenueGenerated: integer("revenue_generated").default(0),
  
  // Management style / autoPilot ratio
  autonomyLevel: integer("autonomy_level").default(50), // 0=full control, 100=full AI
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mgmt_manager").on(table.managerId),
  index("idx_mgmt_artist").on(table.artistId),
]);

export const insertArtistManagementSchema = createInsertSchema(artistManagement).omit({ id: true, createdAt: true });
export type InsertArtistManagement = z.infer<typeof insertArtistManagementSchema>;
export type SelectArtistManagement = typeof artistManagement.$inferSelect;

// Management decisions queue
export const managementDecisions = pgTable("management_decisions", {
  id: serial("id").primaryKey(),
  managementId: integer("management_id").references(() => artistManagement.id, { onDelete: "cascade" }).notNull(),
  managerId: integer("manager_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Decision details
  decisionType: text("decision_type", { 
    enum: [
      "next_single_genre", "collaboration_accept", "collaboration_reject",
      "beef_respond", "beef_ignore", "beef_escalate",
      "post_content", "change_style", "release_album",
      "tour_decision", "brand_deal", "social_strategy",
      "budget_allocation", "feature_request", "retire_artist"
    ] 
  }).notNull(),
  
  title: text("title").notNull(),
  description: text("description"),
  
  // Options presented to manager
  options: json("options").$type<Array<{
    id: string;
    label: string;
    description: string;
    predictedOutcome: string;
    riskLevel: "low" | "medium" | "high";
  }>>().default([]),
  
  // Manager's choice
  selectedOption: text("selected_option"),
  managerReasoning: text("manager_reasoning"),
  
  // AI would have chosen differently?
  aiRecommendation: text("ai_recommendation"),
  
  // Outcome
  outcome: text("outcome"),
  xpEarned: integer("xp_earned").default(0),
  
  // Status
  status: text("status", { 
    enum: ["pending", "decided", "executing", "completed", "expired"] 
  }).default("pending"),
  
  expiresAt: timestamp("expires_at"),
  decidedAt: timestamp("decided_at"),
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_decisions_mgmt").on(table.managementId),
  index("idx_decisions_manager").on(table.managerId),
  index("idx_decisions_artist").on(table.artistId),
  index("idx_decisions_status").on(table.status),
]);

// ====================================
// LIVE ROOMS / AUDIO SPACES
// ====================================

/**
 * Live rooms where AI artists host audio spaces
 * Audience agents + real users participate
 */
export const liveRooms = pgTable("live_rooms", {
  id: serial("id").primaryKey(),
  hostArtistId: integer("host_artist_id").notNull(),
  
  title: text("title").notNull(),
  topic: text("topic"),
  roomType: text("room_type", {
    enum: ["discussion", "listening_party", "beef_battle", "ama", "freestyle", "collaboration"]
  }).default("discussion"),
  
  // State
  status: text("status", {
    enum: ["scheduled", "live", "ended"]
  }).default("scheduled"),
  
  // Participants
  coHosts: json("co_hosts").$type<number[]>().default([]),
  maxParticipants: integer("max_participants").default(50),
  currentListeners: integer("current_listeners").default(0),
  peakListeners: integer("peak_listeners").default(0),
  
  // Content generated during the live
  transcript: json("transcript").$type<Array<{
    speakerId: number;
    speakerName: string;
    message: string;
    timestamp: number;
    isAI: boolean;
  }>>().default([]),
  
  highlightMoments: json("highlight_moments").$type<Array<{
    timestamp: number;
    description: string;
    reactions: number;
  }>>().default([]),
  
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_live_rooms_host").on(table.hostArtistId),
  index("idx_live_rooms_status").on(table.status),
]);

export type InsertLiveRoom = typeof liveRooms.$inferInsert;
export type SelectLiveRoom = typeof liveRooms.$inferSelect;

/**
 * Chat messages in live rooms
 */
export const liveChatMessages = pgTable("live_chat_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  userId: integer("user_id").notNull(),
  
  message: text("message").notNull(),
  messageType: text("message_type", {
    enum: ["chat", "question", "reaction", "system", "highlight"]
  }).default("chat"),
  
  isAI: boolean("is_ai").default(false),
  replyToId: integer("reply_to_id"),
  
  reactions: json("reactions").$type<Record<string, number>>().default({}),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_live_chat_room").on(table.roomId),
  index("idx_live_chat_user").on(table.userId),
]);

export type InsertLiveChatMessage = typeof liveChatMessages.$inferInsert;

// ====================================
// LIVE PODCAST STUDIO
// ====================================

/**
 * Podcast studio sessions — host creates a session, invites guests, goes live
 */
export const podcastSessions = pgTable("podcast_sessions", {
  id: serial("id").primaryKey(),
  hostUserId: text("host_user_id").notNull(),
  
  title: text("title").notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  
  sessionType: text("session_type", {
    enum: ["podcast", "interview", "panel", "ama", "music_session"]
  }).default("podcast"),
  
  status: text("status", {
    enum: ["setup", "live", "paused", "ended"]
  }).default("setup"),
  
  roomCode: text("room_code").notNull().unique(),
  maxParticipants: integer("max_participants").default(6),
  
  isRecording: boolean("is_recording").default(false),
  recordingUrl: text("recording_url"),
  
  layout: text("layout", {
    enum: ["solo", "split", "grid", "pip", "interview"]
  }).default("grid"),
  
  streamDestinations: json("stream_destinations").$type<Array<{
    platform: string;
    streamKey: string;
    streamUrl: string;
    isActive: boolean;
  }>>().default([]),
  
  settings: json("settings").$type<{
    allowChat: boolean;
    allowQuestions: boolean;
    allowReactions: boolean;
    autoRecord: boolean;
    showLowerThirds: boolean;
  }>().default({
    allowChat: true,
    allowQuestions: true,
    allowReactions: true,
    autoRecord: true,
    showLowerThirds: true
  }),
  
  viewerCount: integer("viewer_count").default(0),
  peakViewerCount: integer("peak_viewer_count").default(0),
  
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  duration: integer("duration").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_podcast_sessions_host").on(table.hostUserId),
  index("idx_podcast_sessions_status").on(table.status),
  index("idx_podcast_sessions_room_code").on(table.roomCode),
]);

export type InsertPodcastSession = typeof podcastSessions.$inferInsert;
export type SelectPodcastSession = typeof podcastSessions.$inferSelect;

/**
 * Participants in a podcast session
 */
export const podcastParticipants = pgTable("podcast_participants", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  userId: text("user_id").notNull(),
  
  role: text("role", {
    enum: ["host", "cohost", "guest", "viewer"]
  }).default("viewer"),
  
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url"),
  
  isMuted: boolean("is_muted").default(false),
  isCameraOff: boolean("is_camera_off").default(false),
  isScreenSharing: boolean("is_screen_sharing").default(false),
  
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
}, (table) => [
  index("idx_podcast_participants_session").on(table.sessionId),
  index("idx_podcast_participants_user").on(table.userId),
]);

export type InsertPodcastParticipant = typeof podcastParticipants.$inferInsert;
export type SelectPodcastParticipant = typeof podcastParticipants.$inferSelect;

/**
 * User's saved stream destinations (YouTube, Twitch, Facebook, etc.)
 */
export const streamDestinations = pgTable("stream_destinations", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  
  platform: text("platform", {
    enum: ["youtube", "facebook", "twitch", "instagram", "custom"]
  }).notNull(),
  
  label: text("label").notNull(),
  streamKey: text("stream_key").notNull(),
  streamUrl: text("stream_url").notNull(),
  isActive: boolean("is_active").default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_stream_destinations_user").on(table.userId),
]);

export type InsertStreamDestination = typeof streamDestinations.$inferInsert;
export type SelectStreamDestination = typeof streamDestinations.$inferSelect;

// ====================================
// DYNAMIC ALBUM ART
// ====================================

/**
 * Dynamic album art generated per post/song based on mood
 */
export const dynamicAlbumArt = pgTable("dynamic_album_art", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  songId: integer("song_id"),
  postId: integer("post_id"),
  
  imageUrl: text("image_url").notNull(),
  prompt: text("prompt"),
  style: text("style", {
    enum: ["abstract", "portrait", "landscape", "collage", "minimal", "psychedelic", "dark", "neon", "retro", "futuristic"]
  }).default("abstract"),
  
  mood: text("mood"),
  colorPalette: json("color_palette").$type<string[]>().default([]),
  
  generationCost: text("generation_cost"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_album_art_artist").on(table.artistId),
  index("idx_album_art_song").on(table.songId),
]);

// ====================================
// YOUTUBE CHROME EXTENSION SYNC
// ====================================

/**
 * YouTube Extension Connections — links a Chrome extension instance to a user's YouTube channel
 */
export const youtubeExtensionConnections = pgTable("youtube_extension_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  extensionId: text("extension_id").notNull(),
  channelId: text("channel_id").notNull(),
  channelUrl: text("channel_url"),
  channelName: text("channel_name"),
  syncToken: text("sync_token").notNull(),
  status: text("status", { enum: ["active", "paused", "revoked"] }).default("active"),
  lastSyncAt: timestamp("last_sync_at"),
  syncIntervalMinutes: integer("sync_interval_minutes").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_yt_ext_conn_user").on(table.userId),
  index("idx_yt_ext_conn_channel").on(table.channelId),
]);

export type InsertYoutubeExtConnection = typeof youtubeExtensionConnections.$inferInsert;
export type SelectYoutubeExtConnection = typeof youtubeExtensionConnections.$inferSelect;

/**
 * YouTube Channel Snapshots — periodic stats captured by the extension
 */
export const youtubeChannelSnapshots = pgTable("youtube_channel_snapshots", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => youtubeExtensionConnections.id).notNull(),
  subscribers: integer("subscribers"),
  totalViews: integer("total_views"),
  videoCount: integer("video_count"),
  watchTimeHours: real("watch_time_hours"),
  avgViewDuration: real("avg_view_duration"),
  topVideos: json("top_videos").$type<Array<{ videoId: string; title: string; views: number; ctr: number }>>().default([]),
  recentUploads: json("recent_uploads").$type<Array<{ videoId: string; title: string; publishedAt: string; views: number }>>().default([]),
  trafficSources: json("traffic_sources").$type<Record<string, number>>().default({}),
  demographics: json("demographics").$type<Record<string, any>>().default({}),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
}, (table) => [
  index("idx_yt_snapshots_conn").on(table.connectionId),
  index("idx_yt_snapshots_date").on(table.snapshotAt),
]);

export type InsertYoutubeSnapshot = typeof youtubeChannelSnapshots.$inferInsert;
export type SelectYoutubeSnapshot = typeof youtubeChannelSnapshots.$inferSelect;

/**
 * YouTube Pending Actions — optimization actions queued from Boostify tools to be applied by the extension
 */
export const youtubePendingActions = pgTable("youtube_pending_actions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  connectionId: integer("connection_id").references(() => youtubeExtensionConnections.id),
  actionType: text("action_type", {
    enum: ["update_title", "update_tags", "update_description", "update_thumbnail", "schedule_video", "publish_video", "add_end_screen", "add_cards"]
  }).notNull(),
  targetVideoId: text("target_video_id"),
  targetVideoTitle: text("target_video_title"),
  payload: json("payload").$type<Record<string, any>>().notNull(),
  status: text("status", { enum: ["pending", "sent", "applied", "failed", "cancelled"] }).default("pending"),
  generatedBy: text("generated_by"),
  priority: integer("priority").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
  appliedAt: timestamp("applied_at"),
  resultMessage: text("result_message"),
}, (table) => [
  index("idx_yt_actions_user").on(table.userId),
  index("idx_yt_actions_status").on(table.status),
  index("idx_yt_actions_conn").on(table.connectionId),
]);

export type InsertYoutubePendingAction = typeof youtubePendingActions.$inferInsert;
export type SelectYoutubePendingAction = typeof youtubePendingActions.$inferSelect;

/**
 * YouTube Extension Events — events reported by the extension (new video, milestone, etc.)
 */
export const youtubeExtensionEvents = pgTable("youtube_extension_events", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => youtubeExtensionConnections.id).notNull(),
  eventType: text("event_type", {
    enum: ["video_published", "comment_received", "subscriber_milestone", "ranking_change", "revenue_update", "strike_received", "video_deleted", "channel_update"]
  }).notNull(),
  eventData: json("event_data").$type<Record<string, any>>().default({}),
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_yt_events_conn").on(table.connectionId),
  index("idx_yt_events_type").on(table.eventType),
  index("idx_yt_events_processed").on(table.processed),
]);

// ====================================
// INSTAGRAM CHROME EXTENSION SYNC
// ====================================

/**
 * Instagram Extension Connections — links a Chrome extension instance to a user's Instagram account
 */
export const instagramExtensionConnections = pgTable("instagram_extension_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  extensionId: text("extension_id").notNull(),
  instagramUsername: text("instagram_username").notNull(),
  instagramUserId: text("instagram_user_id"),
  profileUrl: text("profile_url"),
  displayName: text("display_name"),
  syncToken: text("sync_token").notNull(),
  status: text("status", { enum: ["active", "paused", "revoked"] }).default("active"),
  lastSyncAt: timestamp("last_sync_at"),
  syncIntervalMinutes: integer("sync_interval_minutes").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ig_ext_conn_user").on(table.userId),
  index("idx_ig_ext_conn_username").on(table.instagramUsername),
]);

export type InsertInstagramExtConnection = typeof instagramExtensionConnections.$inferInsert;
export type SelectInstagramExtConnection = typeof instagramExtensionConnections.$inferSelect;

/**
 * Instagram Profile Snapshots — periodic stats captured by the extension
 */
export const instagramProfileSnapshots = pgTable("instagram_profile_snapshots", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => instagramExtensionConnections.id).notNull(),
  followers: integer("followers"),
  following: integer("following"),
  postsCount: integer("posts_count"),
  bio: text("bio"),
  isVerified: boolean("is_verified").default(false),
  avgLikes: real("avg_likes"),
  avgComments: real("avg_comments"),
  engagementRate: real("engagement_rate"),
  recentPosts: json("recent_posts").$type<Array<{
    postId: string; caption: string; likes: number; comments: number;
    type: string; timestamp: string; imageUrl?: string;
  }>>().default([]),
  topHashtags: json("top_hashtags").$type<string[]>().default([]),
  audienceDemographics: json("audience_demographics").$type<Record<string, any>>().default({}),
  snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ig_snapshots_conn").on(table.connectionId),
  index("idx_ig_snapshots_date").on(table.snapshotAt),
]);

export type InsertInstagramSnapshot = typeof instagramProfileSnapshots.$inferInsert;
export type SelectInstagramSnapshot = typeof instagramProfileSnapshots.$inferSelect;

/**
 * Instagram Pending Actions — content actions queued from Boostify AI tools
 */
export const instagramPendingActions = pgTable("instagram_pending_actions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  connectionId: integer("connection_id").references(() => instagramExtensionConnections.id),
  actionType: text("action_type", {
    enum: ["post_caption", "update_bio", "schedule_post", "reply_comment", "follow_user", "use_hashtags", "post_story", "post_reel"]
  }).notNull(),
  targetPostId: text("target_post_id"),
  targetPostCaption: text("target_post_caption"),
  payload: json("payload").$type<Record<string, any>>().notNull(),
  status: text("status", { enum: ["pending", "sent", "applied", "failed", "cancelled"] }).default("pending"),
  generatedBy: text("generated_by"),
  priority: integer("priority").default(5),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  sentAt: timestamp("sent_at"),
  appliedAt: timestamp("applied_at"),
  resultMessage: text("result_message"),
}, (table) => [
  index("idx_ig_actions_user").on(table.userId),
  index("idx_ig_actions_status").on(table.status),
  index("idx_ig_actions_conn").on(table.connectionId),
]);

export type InsertInstagramPendingAction = typeof instagramPendingActions.$inferInsert;
export type SelectInstagramPendingAction = typeof instagramPendingActions.$inferSelect;

/**
 * Instagram Extension Events — events reported by the extension
 */
export const instagramExtensionEvents = pgTable("instagram_extension_events", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => instagramExtensionConnections.id).notNull(),
  eventType: text("event_type", {
    enum: ["post_published", "story_published", "reel_published", "follower_milestone", "comment_received", "mention_received", "dm_received", "profile_update", "engagement_spike"]
  }).notNull(),
  eventData: json("event_data").$type<Record<string, any>>().default({}),
  processed: boolean("processed").default(false),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ig_events_conn").on(table.connectionId),
  index("idx_ig_events_type").on(table.eventType),
  index("idx_ig_events_processed").on(table.processed),
]);

/**
 * Instagram Extracted Profiles — detailed profiles extracted by the Chrome extension
 * Stores username, email, phone, bio, profile pic, follower count, etc.
 */
export const instagramExtractedProfiles = pgTable("instagram_extracted_profiles", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => instagramExtensionConnections.id).notNull(),
  
  // Core profile data
  username: text("username").notNull(),
  displayName: text("display_name"),
  bio: text("bio"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  profilePicUrl: text("profile_pic_url"),
  
  // Stats
  followers: integer("followers"),
  following: integer("following"),
  postsCount: integer("posts_count"),
  
  // Flags
  isVerified: boolean("is_verified").default(false),
  isPrivate: boolean("is_private").default(false),
  isBusiness: boolean("is_business").default(false),
  category: text("category"),
  
  // Extraction metadata
  extractType: text("extract_type", { 
    enum: ["followers", "following", "hashtag", "location", "commenters", "likers", "custom"] 
  }).notNull(),
  extractQuery: text("extract_query"),
  extractJobId: text("extract_job_id"),
  
  // Timestamps
  extractedAt: timestamp("extracted_at").defaultNow().notNull(),
  profileVisitedAt: timestamp("profile_visited_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ig_extracted_conn").on(table.connectionId),
  index("idx_ig_extracted_username").on(table.username),
  index("idx_ig_extracted_type").on(table.extractType),
  index("idx_ig_extracted_email").on(table.email),
]);

export type InsertExtractedProfile = typeof instagramExtractedProfiles.$inferInsert;
export type SelectExtractedProfile = typeof instagramExtractedProfiles.$inferSelect;

/**
 * Instagram Extraction Jobs — tracks scheduled and completed extraction runs
 */
export const instagramExtractionJobs = pgTable("instagram_extraction_jobs", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => instagramExtensionConnections.id).notNull(),
  
  // Job config
  extractType: text("extract_type", { 
    enum: ["followers", "following", "hashtag", "location", "commenters", "likers", "custom"] 
  }).notNull(),
  query: text("query"),
  maxUsers: integer("max_users").default(100),
  enrichProfiles: boolean("enrich_profiles").default(false),
  
  // Schedule
  isScheduled: boolean("is_scheduled").default(false),
  intervalMinutes: integer("interval_minutes"),
  nextRunAt: timestamp("next_run_at"),
  
  // Ban protection
  delayBetweenMs: integer("delay_between_ms").default(3000),
  maxPerSession: integer("max_per_session").default(50),
  cooldownMinutes: integer("cooldown_minutes").default(5),
  
  // Status
  status: text("status", { 
    enum: ["pending", "running", "completed", "failed", "cancelled", "paused", "scheduled"] 
  }).default("pending"),
  profilesExtracted: integer("profiles_extracted").default(0),
  profilesEnriched: integer("profiles_enriched").default(0),
  errorMessage: text("error_message"),
  
  // Ban tracking
  warningsCount: integer("warnings_count").default(0),
  lastWarningAt: timestamp("last_warning_at"),
  
  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ig_jobs_conn").on(table.connectionId),
  index("idx_ig_jobs_status").on(table.status),
  index("idx_ig_jobs_next_run").on(table.nextRunAt),
]);

export type InsertExtractionJob = typeof instagramExtractionJobs.$inferInsert;
export type SelectExtractionJob = typeof instagramExtractionJobs.$inferSelect;

// ============================================
// INSTAGRAM CONTENT LIBRARY
// ============================================

/**
 * Instagram Content Library — stores all AI-generated content for reuse
 */
export const instagramContentLibrary = pgTable("instagram_content_library", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  
  // Content type
  contentType: text("content_type", {
    enum: ["post", "carousel", "reel", "story", "pack"]
  }).notNull(),
  
  // Content data
  title: text("title"),
  caption: text("caption"),
  hashtags: json("hashtags").$type<string[]>().default([]),
  imageUrls: json("image_urls").$type<string[]>().default([]),
  videoUrl: text("video_url"),
  slides: json("slides").$type<any[]>(),
  
  // Artist context used to generate
  artistName: text("artist_name"),
  artistGenre: text("artist_genre"),
  style: text("style"),
  mood: text("mood"),
  topic: text("topic"),
  
  // Status
  status: text("status", {
    enum: ["draft", "ready", "queued", "posted", "archived"]
  }).default("draft"),
  queuedActionId: integer("queued_action_id"),
  
  // Metadata
  generatedBy: text("generated_by").default("ai"),
  metadata: json("metadata").$type<Record<string, any>>(),
  
  // Timestamps  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  postedAt: timestamp("posted_at"),
}, (table) => [
  index("idx_content_lib_user").on(table.userId),
  index("idx_content_lib_type").on(table.contentType),
  index("idx_content_lib_status").on(table.status),
]);

export type InsertContentLibrary = typeof instagramContentLibrary.$inferInsert;
export type SelectContentLibrary = typeof instagramContentLibrary.$inferSelect;

// ============================================
// SPONSOR ACQUISITION SYSTEM
// ============================================

/**
 * Sponsor Contacts — Brands, companies, potential sponsors scraped via Apify or imported manually
 */
export const sponsorContacts = pgTable("sponsor_contacts", {
  id: serial("id").primaryKey(),

  // Brand Information
  brandName: text("brand_name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  contactRole: text("contact_role"), // "Marketing Director", "Brand Partnerships", etc.

  // Company Details
  website: text("website"),
  instagramHandle: text("instagram_handle"),
  linkedinUrl: text("linkedin_url"),
  industry: text("industry", {
    enum: ["fashion", "tech", "beverage", "cosmetics", "automotive", "gaming", "food", "sports", "crypto", "finance", "travel", "health", "media", "entertainment", "telecom", "other"]
  }).default("other"),
  companySize: text("company_size"), // "startup", "small", "medium", "enterprise"
  description: text("description"),

  // Social Metrics (scraped)
  followerCount: integer("follower_count").default(0),
  engagementRate: real("engagement_rate"), // 0.0 - 100.0
  estimatedBudget: text("estimated_budget"), // "low", "medium", "high", "enterprise"

  // Deduplication
  dedupeHash: text("dedupe_hash").unique(), // SHA256(email.lower() + brandName.lower())

  // Import Source
  importSource: text("import_source", {
    enum: ["apify_instagram", "apify_google", "apify_web", "csv_import", "manual", "referral"]
  }).default("manual"),
  apifyRunId: text("apify_run_id"),

  // Outreach Status
  status: text("status", {
    enum: ["new", "researching", "queued", "contacted", "opened", "responded", "interested", "not_interested", "deal_in_progress", "blacklisted"]
  }).default("new"),
  lastContactedAt: timestamp("last_contacted_at"),
  emailsSent: integer("emails_sent").default(0),
  opensCount: integer("opens_count").default(0),

  // Owner
  addedByUserId: integer("added_by_user_id").references(() => users.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sponsor_contacts_email").on(table.contactEmail),
  index("idx_sponsor_contacts_industry").on(table.industry),
  index("idx_sponsor_contacts_status").on(table.status),
  index("idx_sponsor_contacts_dedupe").on(table.dedupeHash),
  index("idx_sponsor_contacts_user").on(table.addedByUserId),
]);

export const insertSponsorContactSchema = createInsertSchema(sponsorContacts).omit({ id: true, createdAt: true, updatedAt: true });
export const selectSponsorContactSchema = createSelectSchema(sponsorContacts);
export type InsertSponsorContact = z.infer<typeof insertSponsorContactSchema>;
export type SelectSponsorContact = typeof sponsorContacts.$inferSelect;

/**
 * Sponsor Campaigns — Outreach campaigns targeting brands/sponsors
 */
export const sponsorCampaigns = pgTable("sponsor_campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Campaign Info
  name: text("name").notNull(),
  dealType: text("deal_type", {
    enum: ["sponsorship", "collaboration", "endorsement", "product_placement", "affiliate"]
  }).notNull(),

  // AI-Generated Proposal
  proposalHtml: text("proposal_html"),
  proposalSubject: text("proposal_subject"),

  // Budget Range
  budgetMin: decimal("budget_min", { precision: 10, scale: 2 }),
  budgetMax: decimal("budget_max", { precision: 10, scale: 2 }),

  // Target Filters
  targetIndustries: json("target_industries").$type<string[]>().default([]),
  targetCompanySizes: json("target_company_sizes").$type<string[]>().default([]),

  // Status & Schedule
  status: text("status", {
    enum: ["draft", "ready", "sending", "paused", "completed", "cancelled"]
  }).default("draft"),
  dailyLimit: integer("daily_limit").default(10),

  // Stats
  totalContacts: integer("total_contacts").default(0),
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsReplied: integer("emails_replied").default(0),
  dealsCreated: integer("deals_created").default(0),

  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sponsor_campaigns_user").on(table.userId),
  index("idx_sponsor_campaigns_artist").on(table.artistId),
  index("idx_sponsor_campaigns_status").on(table.status),
]);

export const insertSponsorCampaignSchema = createInsertSchema(sponsorCampaigns).omit({ id: true, createdAt: true, updatedAt: true });
export const selectSponsorCampaignSchema = createSelectSchema(sponsorCampaigns);
export type InsertSponsorCampaign = z.infer<typeof insertSponsorCampaignSchema>;
export type SelectSponsorCampaign = typeof sponsorCampaigns.$inferSelect;

/**
 * Sponsor Deals — Individual deal negotiations between artist and sponsor
 */
export const sponsorDeals = pgTable("sponsor_deals", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => sponsorCampaigns.id, { onDelete: "set null" }),
  sponsorContactId: integer("sponsor_contact_id").references(() => sponsorContacts.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Deal Details
  dealType: text("deal_type", {
    enum: ["sponsorship", "collaboration", "endorsement", "product_placement", "affiliate"]
  }).notNull(),
  title: text("title").notNull(), // "Nike x Version — Summer Campaign"
  description: text("description"),

  // Financials
  proposedAmount: decimal("proposed_amount", { precision: 10, scale: 2 }),
  agreedAmount: decimal("agreed_amount", { precision: 10, scale: 2 }),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }), // 20% of agreedAmount
  artistEarning: decimal("artist_earning", { precision: 10, scale: 2 }), // 80% of agreedAmount
  currency: text("currency").default("usd"),

  // Status Pipeline
  status: text("status", {
    enum: ["proposed", "negotiating", "accepted", "payment_pending", "active", "completed", "rejected", "cancelled"]
  }).default("proposed"),

  // Stripe Payment
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripePaymentUrl: text("stripe_payment_url"), // One-time payment link for sponsor
  paymentReceivedAt: timestamp("payment_received_at"),

  // Contract
  contractSignedAt: timestamp("contract_signed_at"),
  contractTerms: text("contract_terms"),

  // Proposal sent
  proposalSentAt: timestamp("proposal_sent_at"),
  proposalOpenedAt: timestamp("proposal_opened_at"),

  // Communication
  lastMessageAt: timestamp("last_message_at"),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sponsor_deals_artist").on(table.artistId),
  index("idx_sponsor_deals_contact").on(table.sponsorContactId),
  index("idx_sponsor_deals_status").on(table.status),
  index("idx_sponsor_deals_campaign").on(table.campaignId),
  index("idx_sponsor_deals_stripe").on(table.stripePaymentIntentId),
]);

export const insertSponsorDealSchema = createInsertSchema(sponsorDeals).omit({ id: true, createdAt: true, updatedAt: true });
export const selectSponsorDealSchema = createSelectSchema(sponsorDeals);
export type InsertSponsorDeal = z.infer<typeof insertSponsorDealSchema>;
export type SelectSponsorDeal = typeof sponsorDeals.$inferSelect;

/**
 * Sponsor Email Log — Track individual proposal emails sent to sponsors
 */
export const sponsorEmailLog = pgTable("sponsor_email_log", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => sponsorCampaigns.id, { onDelete: "set null" }),
  dealId: integer("deal_id").references(() => sponsorDeals.id, { onDelete: "set null" }),
  sponsorContactId: integer("sponsor_contact_id").references(() => sponsorContacts.id, { onDelete: "cascade" }).notNull(),

  // Email Details
  toEmail: text("to_email").notNull(),
  toName: text("to_name"),
  subject: text("subject").notNull(),
  emailType: text("email_type", {
    enum: ["proposal", "follow_up", "counter_offer", "acceptance", "invoice", "thank_you"]
  }).default("proposal"),

  // Status
  status: text("status", {
    enum: ["queued", "sent", "delivered", "opened", "clicked", "replied", "bounced", "failed"]
  }).default("queued"),

  // Tracking
  brevoMessageId: text("brevo_message_id"),
  abTestVariant: text("ab_test_variant"), // "A", "B", etc. for A/B test tracking
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  repliedAt: timestamp("replied_at"),
  errorMessage: text("error_message"),

  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sponsor_email_campaign").on(table.campaignId),
  index("idx_sponsor_email_deal").on(table.dealId),
  index("idx_sponsor_email_contact").on(table.sponsorContactId),
  index("idx_sponsor_email_status").on(table.status),
]);

/**
 * Sponsor Email A/B Tests — Track subject line and template variants
 */
export const sponsorAbTests = pgTable("sponsor_ab_tests", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => sponsorCampaigns.id, { onDelete: "cascade" }).notNull(),

  // Variant Info
  variantName: text("variant_name").notNull(), // "A", "B", "C"
  subjectLine: text("subject_line").notNull(),

  // Performance
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  emailsReplied: integer("emails_replied").default(0),

  // Computed at query time: openRate, clickRate
  isWinner: boolean("is_winner").default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_sponsor_ab_campaign").on(table.campaignId),
]);

export const insertSponsorAbTestSchema = createInsertSchema(sponsorAbTests).omit({ id: true, createdAt: true });
export type InsertSponsorAbTest = z.infer<typeof insertSponsorAbTestSchema>;
export type SelectSponsorAbTest = typeof sponsorAbTests.$inferSelect;

// ========================================
// Lyrics Copywrite Workflow — Authorship Traceability
// ========================================

export const lyricsProjects = pgTable("lyrics_projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Phase 1: Origin
  songTitle: text("song_title").notNull(),
  language: text("language").default("en"),
  genre: text("genre"),
  theme: text("theme"),
  emotion: text("emotion"),
  messageCore: text("message_core"),
  personalStory: text("personal_story"),
  styleReferences: text("style_references").array(),
  keywords: text("keywords").array(),
  humanOriginalPhrases: text("human_original_phrases").array(),
  humanIdeas: text("human_ideas").array(),
  desiredTone: text("desired_tone"),

  // Phase 2: Human Lines
  freeWritingBlock: text("free_writing_block"),
  looseLines: text("loose_lines").array(),
  metaphorBank: text("metaphor_bank").array(),
  hookBank: text("hook_bank").array(),
  narrativeImages: text("narrative_images").array(),

  // Phase 3: Structure
  structureMap: json("structure_map").$type<{
    intro: boolean;
    verse1: boolean;
    preChorus: boolean;
    chorus: boolean;
    verse2: boolean;
    bridge: boolean;
    outro: boolean;
  }>(),
  verseCount: integer("verse_count").default(2),
  chorusLength: text("chorus_length").default("medium"),
  hookRepetition: integer("hook_repetition").default(2),
  bridgePosition: text("bridge_position").default("after-verse2"),
  closingType: text("closing_type").default("fade"),

  // Phase 4-5: Drafts & Rewrites (stored as versioned JSON)
  draftVersions: json("draft_versions").$type<Array<{
    version: number;
    type: "origin" | "ai-draft" | "human-edit" | "final";
    content: string;
    lines: Array<{
      text: string;
      section: string;
      source: "human-original" | "ai-generated" | "human-approved" | "human-edited" | "human-rewritten";
      originalAiText?: string;
      editComment?: string;
    }>;
    timestamp: string;
  }>>().default([]),

  // Phase 5: Authorship Metrics
  authorshipMetrics: json("authorship_metrics").$type<{
    humanOriginalLines: number;
    humanEditedLines: number;
    aiAcceptedLines: number;
    humanRewrittenLines: number;
    rewritePercentage: number;
    totalDecisions: number;
  }>(),

  // Phase 7: Final
  finalLyrics: text("final_lyrics"),
  authorDeclaration: text("author_declaration"),

  // Status
  currentPhase: integer("current_phase").default(1).notNull(),
  status: text("status", { enum: ["draft", "in-progress", "completed", "archived"] }).default("draft").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_lyrics_projects_user").on(table.userId),
]);

export const insertLyricsProjectSchema = createInsertSchema(lyricsProjects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLyricsProject = z.infer<typeof insertLyricsProjectSchema>;
export type SelectLyricsProject = typeof lyricsProjects.$inferSelect;

// ========================================
// Copyright Certifications — Blockchain-backed evidence
// ========================================

export const copyrightCertifications = pgTable("copyright_certifications", {
  id: serial("id").primaryKey(),
  lyricsProjectId: integer("lyrics_project_id").references(() => lyricsProjects.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Document hash & content
  documentHash: text("document_hash").notNull(), // SHA-256 hex
  songTitle: text("song_title").notNull(),
  authorshipScore: integer("authorship_score").notNull(), // 0-100

  // Blockchain record
  txHash: text("tx_hash"),                  // Polygon transaction hash
  blockNumber: integer("block_number"),
  blockTimestamp: timestamp("block_timestamp"),
  contractRecordId: integer("contract_record_id"), // On-chain record ID
  walletAddress: text("wallet_address"),     // Author's wallet that signed

  // Document storage
  packetJson: json("packet_json"),           // Full evidence packet snapshot
  pdfUrl: text("pdf_url"),                   // URL to stored PDF if generated

  // Status
  status: text("status", { enum: ["pending", "certified", "failed"] }).default("pending").notNull(),
  certifiedAt: timestamp("certified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_copyright_certs_user").on(table.userId),
  index("idx_copyright_certs_hash").on(table.documentHash),
  index("idx_copyright_certs_project").on(table.lyricsProjectId),
]);

export const insertCopyrightCertificationSchema = createInsertSchema(copyrightCertifications).omit({ id: true, createdAt: true });
export type InsertCopyrightCertification = z.infer<typeof insertCopyrightCertificationSchema>;
export type SelectCopyrightCertification = typeof copyrightCertifications.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// VENUE BOOKING OUTREACH (Google Maps scraping + email proposals)
// ═══════════════════════════════════════════════════════════════════

export const venueContacts = pgTable("venue_contacts", {
  id: serial("id").primaryKey(),

  // Venue Information (from Google Maps)
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  country: text("country"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  googleRating: real("google_rating"),
  totalReviews: integer("total_reviews").default(0),
  placeId: text("place_id").unique(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  category: text("category", {
    enum: ["bar", "nightclub", "restaurant", "event_venue", "lounge", "hotel", "festival", "theater", "other"]
  }).default("other"),
  categories: json("categories").$type<string[]>().default([]),
  openingHours: json("opening_hours").$type<string[]>(),
  imageUrl: text("image_url"),

  // Import tracking
  importSource: text("import_source", {
    enum: ["apify_google_maps", "manual", "csv_import"]
  }).default("apify_google_maps"),
  apifyRunId: text("apify_run_id"),
  searchQuery: text("search_query"),

  // Outreach status
  status: text("status", {
    enum: ["new", "queued", "contacted", "opened", "replied", "interested", "not_interested", "booked", "blacklisted"]
  }).default("new"),
  lastContactedAt: timestamp("last_contacted_at"),
  emailsSent: integer("emails_sent").default(0),

  // Owner
  addedByUserId: integer("added_by_user_id").references(() => users.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_venue_contacts_city").on(table.city),
  index("idx_venue_contacts_category").on(table.category),
  index("idx_venue_contacts_status").on(table.status),
  index("idx_venue_contacts_place_id").on(table.placeId),
  index("idx_venue_contacts_user").on(table.addedByUserId),
]);

export const insertVenueContactSchema = createInsertSchema(venueContacts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVenueContact = z.infer<typeof insertVenueContactSchema>;
export type SelectVenueContact = typeof venueContacts.$inferSelect;

// ─── venueBookingCampaigns ────────────────────────────────────────

export const venueBookingCampaigns = pgTable("venue_booking_campaigns", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  name: text("name").notNull(),
  locationQuery: text("location_query").notNull(),
  searchTerms: json("search_terms").$type<string[]>().default([]),

  // Artist rates for this campaign
  showFee: decimal("show_fee", { precision: 10, scale: 2 }),
  setDuration: text("set_duration"),
  technicalRequirements: text("technical_requirements"),
  availability: text("availability"),
  customMessage: text("custom_message"),
  emailTemplate: text("email_template").default("professional_pitch"),

  status: text("status", {
    enum: ["draft", "searching", "ready", "sending", "paused", "completed", "cancelled"]
  }).default("draft"),

  totalVenues: integer("total_venues").default(0),
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsReplied: integer("emails_replied").default(0),
  bookingsCreated: integer("bookings_created").default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_venue_campaigns_user").on(table.userId),
  index("idx_venue_campaigns_artist").on(table.artistId),
  index("idx_venue_campaigns_status").on(table.status),
]);

export const insertVenueBookingCampaignSchema = createInsertSchema(venueBookingCampaigns).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVenueBookingCampaign = z.infer<typeof insertVenueBookingCampaignSchema>;
export type SelectVenueBookingCampaign = typeof venueBookingCampaigns.$inferSelect;

// ─── venueBookingDeals ────────────────────────────────────────────

export const venueBookingDeals = pgTable("venue_booking_deals", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => venueBookingCampaigns.id, { onDelete: "set null" }),
  venueContactId: integer("venue_contact_id").references(() => venueContacts.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  title: text("title").notNull(),
  proposedFee: decimal("proposed_fee", { precision: 10, scale: 2 }),
  agreedFee: decimal("agreed_fee", { precision: 10, scale: 2 }),
  currency: text("currency").default("usd"),

  proposedDate: timestamp("proposed_date"),
  confirmedDate: timestamp("confirmed_date"),
  setDuration: text("set_duration"),
  technicalRequirements: text("technical_requirements"),

  status: text("status", {
    enum: ["sent", "opened", "replied", "negotiating", "booked", "confirmed", "completed", "rejected", "cancelled"]
  }).default("sent"),

  venueResponse: text("venue_response"),
  counterOffer: decimal("counter_offer", { precision: 10, scale: 2 }),
  notes: text("notes"),

  proposalSentAt: timestamp("proposal_sent_at"),
  proposalOpenedAt: timestamp("proposal_opened_at"),
  repliedAt: timestamp("replied_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_venue_deals_artist").on(table.artistId),
  index("idx_venue_deals_venue").on(table.venueContactId),
  index("idx_venue_deals_status").on(table.status),
  index("idx_venue_deals_campaign").on(table.campaignId),
]);

export const insertVenueBookingDealSchema = createInsertSchema(venueBookingDeals).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVenueBookingDeal = z.infer<typeof insertVenueBookingDealSchema>;
export type SelectVenueBookingDeal = typeof venueBookingDeals.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════
// BOOSTIFY EXPLICIT — Exclusive Content Module
// ═══════════════════════════════════════════════════════════════════════

// ─── explicitSettings ─────────────────────────────────────────────

export const explicitSettings = pgTable("explicit_settings", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  enabled: boolean("enabled").default(false).notNull(),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).default("9.99"),
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }).default("89.99"),
  singleContentPrice: decimal("single_content_price", { precision: 10, scale: 2 }).default("4.99"),
  
  welcomeMessage: text("welcome_message"),
  contentCategories: json("content_categories").$type<string[]>().default([]),
  chatEnabled: boolean("chat_enabled").default(true),
  aiGenerationEnabled: boolean("ai_generation_enabled").default(true),
  watermarkEnabled: boolean("watermark_enabled").default(true),
  
  stripeProductId: text("stripe_product_id"),
  stripeMonthlyPriceId: text("stripe_monthly_price_id"),
  stripeYearlyPriceId: text("stripe_yearly_price_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_explicit_settings_artist").on(table.artistId),
]);

export const insertExplicitSettingsSchema = createInsertSchema(explicitSettings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExplicitSettings = z.infer<typeof insertExplicitSettingsSchema>;
export type SelectExplicitSettings = typeof explicitSettings.$inferSelect;

// ─── explicitContent ──────────────────────────────────────────────

export const explicitContent = pgTable("explicit_content", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  type: text("type", { enum: ["image", "video", "audio", "gallery", "ai_generated"] }).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  
  mediaUrl: text("media_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  blurredPreviewUrl: text("blurred_preview_url"),
  
  isPaywalled: boolean("is_paywalled").default(true).notNull(),
  singlePurchasePrice: decimal("single_purchase_price", { precision: 10, scale: 2 }),
  
  aiModel: text("ai_model"),
  aiPrompt: text("ai_prompt"),
  
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_explicit_content_artist").on(table.artistId),
  index("idx_explicit_content_type").on(table.type),
  index("idx_explicit_content_active").on(table.isActive),
]);

export const insertExplicitContentSchema = createInsertSchema(explicitContent).omit({ id: true, viewCount: true, likeCount: true, createdAt: true, updatedAt: true });
export type InsertExplicitContent = z.infer<typeof insertExplicitContentSchema>;
export type SelectExplicitContent = typeof explicitContent.$inferSelect;

// ─── explicitSubscriptions ────────────────────────────────────────

export const explicitSubscriptions = pgTable("explicit_subscriptions", {
  id: serial("id").primaryKey(),
  subscriberId: integer("subscriber_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  plan: text("plan", { enum: ["monthly", "yearly"] }).notNull(),
  status: text("status", { enum: ["active", "cancelled", "expired", "past_due"] }).default("active").notNull(),
  
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_explicit_subs_subscriber").on(table.subscriberId),
  index("idx_explicit_subs_artist").on(table.artistId),
  index("idx_explicit_subs_status").on(table.status),
]);

export const insertExplicitSubscriptionSchema = createInsertSchema(explicitSubscriptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExplicitSubscription = z.infer<typeof insertExplicitSubscriptionSchema>;
export type SelectExplicitSubscription = typeof explicitSubscriptions.$inferSelect;

// ─── explicitPurchases ────────────────────────────────────────────

export const explicitPurchases = pgTable("explicit_purchases", {
  id: serial("id").primaryKey(),
  buyerId: integer("buyer_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  contentId: integer("content_id").references(() => explicitContent.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  
  status: text("status", { enum: ["pending", "completed", "refunded", "failed"] }).default("pending").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_explicit_purchases_buyer").on(table.buyerId),
  index("idx_explicit_purchases_content").on(table.contentId),
  index("idx_explicit_purchases_artist").on(table.artistId),
]);

export const insertExplicitPurchaseSchema = createInsertSchema(explicitPurchases).omit({ id: true, createdAt: true });
export type InsertExplicitPurchase = z.infer<typeof insertExplicitPurchaseSchema>;
export type SelectExplicitPurchase = typeof explicitPurchases.$inferSelect;

// ─── explicitChatMessages ─────────────────────────────────────────

export const explicitChatMessages = pgTable("explicit_chat_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  receiverId: integer("receiver_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  message: text("message").notNull(),
  mediaUrl: text("media_url"),
  mediaType: text("media_type", { enum: ["image", "video", "audio"] }),
  
  isRead: boolean("is_read").default(false).notNull(),
  isPinned: boolean("is_pinned").default(false),
  
  tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_explicit_chat_sender").on(table.senderId),
  index("idx_explicit_chat_receiver").on(table.receiverId),
  index("idx_explicit_chat_artist").on(table.artistId),
  index("idx_explicit_chat_created").on(table.createdAt),
]);

export const insertExplicitChatMessageSchema = createInsertSchema(explicitChatMessages).omit({ id: true, createdAt: true });
export type InsertExplicitChatMessage = z.infer<typeof insertExplicitChatMessageSchema>;
export type SelectExplicitChatMessage = typeof explicitChatMessages.$inferSelect;

// ─── explicitAiGenerations ────────────────────────────────────────

export const explicitAiGenerations = pgTable("explicit_ai_generations", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  type: text("type", { enum: ["image", "video"] }).notNull(),
  model: text("model").notNull(),
  prompt: text("prompt").notNull(),
  negativePrompt: text("negative_prompt"),
  
  resultUrl: text("result_url"),
  thumbnailUrl: text("thumbnail_url"),
  
  parameters: json("parameters").$type<Record<string, unknown>>(),
  
  costUsd: decimal("cost_usd", { precision: 10, scale: 4 }),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).default("pending").notNull(),
  errorMessage: text("error_message"),
  
  publishedAsContentId: integer("published_as_content_id").references(() => explicitContent.id, { onDelete: "set null" }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_explicit_ai_artist").on(table.artistId),
  index("idx_explicit_ai_status").on(table.status),
  index("idx_explicit_ai_type").on(table.type),
]);

export const insertExplicitAiGenerationSchema = createInsertSchema(explicitAiGenerations).omit({ id: true, createdAt: true, completedAt: true });
export type InsertExplicitAiGeneration = z.infer<typeof insertExplicitAiGenerationSchema>;
export type SelectExplicitAiGeneration = typeof explicitAiGenerations.$inferSelect;

// ─── explicitTips ─────────────────────────────────────────────────

export const explicitTips = pgTable("explicit_tips", {
  id: serial("id").primaryKey(),
  tipperId: integer("tipper_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd"),
  message: text("message"),
  
  contentId: integer("content_id").references(() => explicitContent.id, { onDelete: "set null" }),
  chatMessageId: integer("chat_message_id").references(() => explicitChatMessages.id, { onDelete: "set null" }),
  
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status", { enum: ["pending", "completed", "refunded", "failed"] }).default("pending").notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_explicit_tips_tipper").on(table.tipperId),
  index("idx_explicit_tips_artist").on(table.artistId),
  index("idx_explicit_tips_status").on(table.status),
]);

export const insertExplicitTipSchema = createInsertSchema(explicitTips).omit({ id: true, createdAt: true });
export type InsertExplicitTip = z.infer<typeof insertExplicitTipSchema>;
export type SelectExplicitTip = typeof explicitTips.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════
// MERCH COLLABORATION CONTRACTS
// ═══════════════════════════════════════════════════════════════════════

export const merchContracts = pgTable("merch_contracts", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  // Contract terms at time of signing
  artistRevenueShare: decimal("artist_revenue_share", { precision: 5, scale: 2 }).notNull(), // 20 or 70
  boostifyRevenueShare: decimal("boostify_revenue_share", { precision: 5, scale: 2 }).notNull(), // 80 or 30
  platformMaintenanceFee: decimal("platform_maintenance_fee", { precision: 5, scale: 2 }).default("10").notNull(), // 10% of profit
  subscriptionPlanAtSigning: text("subscription_plan_at_signing").notNull(), // free, basic, pro, premium
  
  // Artist info captured at signing
  artistLegalName: text("artist_legal_name").notNull(),
  artistStageName: text("artist_stage_name").notNull(),
  artistEmail: text("artist_email").notNull(),
  artistCountry: text("artist_country"),
  
  // Contract status
  status: text("status", { enum: ["pending", "active", "suspended", "terminated"] }).default("active").notNull(),
  signedAt: timestamp("signed_at").defaultNow().notNull(),
  signatureHash: text("signature_hash").notNull(), // SHA-256 of contract terms + timestamp
  ipAddress: text("ip_address"),
  
  // Printful store sync
  printfulSyncEnabled: boolean("printful_sync_enabled").default(false),
  printfulStoreId: text("printful_store_id"),
  
  terminatedAt: timestamp("terminated_at"),
  terminationReason: text("termination_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_merch_contracts_artist").on(table.artistId),
  index("idx_merch_contracts_status").on(table.status),
]);

export const insertMerchContractSchema = createInsertSchema(merchContracts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMerchContract = z.infer<typeof insertMerchContractSchema>;
export type SelectMerchContract = typeof merchContracts.$inferSelect;

// ============================================
// MERCH MARKETING SYSTEM
// ============================================

/**
 * Marketing Contacts — Customer/subscriber database for email campaigns
 */
export const marketingContacts = pgTable("marketing_contacts", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name"),
  source: text("source", {
    enum: ["manual", "import", "checkout", "signup", "landing_page", "social"]
  }).default("manual").notNull(),
  tags: json("tags").$type<string[]>().default([]),
  metadata: json("metadata").$type<Record<string, string>>(),
  status: text("status", {
    enum: ["active", "unsubscribed", "bounced", "complained"]
  }).default("active").notNull(),
  lastEmailedAt: timestamp("last_emailed_at"),
  totalEmailsSent: integer("total_emails_sent").default(0),
  totalOpens: integer("total_opens").default(0),
  totalClicks: integer("total_clicks").default(0),
  totalPurchases: integer("total_purchases").default(0),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default('0'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mktg_contacts_email").on(table.email),
  index("idx_mktg_contacts_status").on(table.status),
  index("idx_mktg_contacts_source").on(table.source),
]);

/**
 * Marketing Campaigns — Email and social media campaigns
 */
export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type", {
    enum: ["email_blast", "email_promo", "social_post", "social_campaign", "product_launch", "flash_sale"]
  }).notNull(),
  status: text("status", {
    enum: ["draft", "scheduled", "sending", "sent", "active", "paused", "completed", "cancelled"]
  }).default("draft").notNull(),

  // Email settings
  subject: text("subject"),
  previewText: text("preview_text"),
  htmlContent: text("html_content"),
  senderName: text("sender_name").default("Boostify Music"),
  senderEmail: text("sender_email").default("marketing@boostifymusic.com"),

  // Targeting
  targetTags: json("target_tags").$type<string[]>(),
  targetSegment: text("target_segment", {
    enum: ["all", "active_buyers", "new_subscribers", "inactive", "vip", "custom"]
  }).default("all"),
  
  // Social media
  socialPlatforms: json("social_platforms").$type<string[]>(),
  socialContent: text("social_content"),
  socialImageUrl: text("social_image_url"),

  // Products / promos
  productIds: json("product_ids").$type<number[]>(),
  discountCode: text("discount_code"),
  discountPercent: integer("discount_percent"),

  // Schedule
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),

  // Stats
  totalRecipients: integer("total_recipients").default(0),
  emailsSent: integer("emails_sent").default(0),
  emailsDelivered: integer("emails_delivered").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  emailsBounced: integer("emails_bounced").default(0),
  emailsUnsubscribed: integer("emails_unsubscribed").default(0),
  conversions: integer("conversions").default(0),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default('0'),

  // AI-generated content
  aiGeneratedImage: text("ai_generated_image"),
  aiPromptUsed: text("ai_prompt_used"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mktg_campaigns_status").on(table.status),
  index("idx_mktg_campaigns_type").on(table.type),
]);

/**
 * Marketing Email Log — Per-recipient tracking for campaign sends
 */
export const marketingEmailLog = pgTable("marketing_email_log", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => marketingCampaigns.id, { onDelete: "cascade" }).notNull(),
  contactId: integer("contact_id").references(() => marketingContacts.id, { onDelete: "cascade" }).notNull(),
  toEmail: text("to_email").notNull(),
  brevoMessageId: text("brevo_message_id"),
  status: text("status", {
    enum: ["queued", "sent", "delivered", "opened", "clicked", "bounced", "unsubscribed", "failed"]
  }).default("queued").notNull(),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  bouncedAt: timestamp("bounced_at"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mktg_email_log_campaign").on(table.campaignId),
  index("idx_mktg_email_log_contact").on(table.contactId),
  index("idx_mktg_email_log_status").on(table.status),
]);

// ============================================
// AAS ENGINE — Autonomous Artist Survival System
// ============================================

/**
 * AAS Config — Per-artist autonomous survival engine configuration
 * Defaults to enabled=false. Activated from the artist panel.
 * Works for both AI and human artists.
 */
export const aasConfig = pgTable("aas_config", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),

  // === ON/OFF TOGGLE ===
  enabled: boolean("enabled").default(false).notNull(),

  // === IDENTITY ===
  lore: text("lore"),
  voiceTone: text("voice_tone"),
  aestheticStyle: text("aesthetic_style"),
  brandValues: json("brand_values").$type<string[]>(),
  moralLimits: json("moral_limits").$type<string[]>(),
  targetMarket: json("target_market").$type<{
    ageRange: string;
    geoTargets: string[];
    interests: string[];
    platforms: string[];
  }>(),

  // === ECONOMIC CONFIG ===
  pricingTier: text("pricing_tier", { enum: ["budget", "mid", "premium"] }).default("mid"),
  productsEnabled: json("products_enabled").$type<string[]>(),
  targetTerritories: json("target_territories").$type<string[]>(),
  primaryLanguage: text("primary_language").default("en"),

  // === QUARTERLY GOALS ===
  quarterlyGoals: json("quarterly_goals").$type<{
    revenueTarget: number;
    audienceTarget: number;
    dealsTarget: number;
    contentTarget: number;
    period: string;
  }>(),

  // === BEHAVIOR RULES (guardrails) ===
  maxDailyBudget: decimal("max_daily_budget", { precision: 10, scale: 2 }).default("50.00"),
  maxOutreachPerDay: integer("max_outreach_per_day").default(20),
  requireApprovalAbove: decimal("require_approval_above", { precision: 10, scale: 2 }).default("100.00"),
  allowedChannels: json("allowed_channels").$type<string[]>(),
  blockedActions: json("blocked_actions").$type<string[]>(),

  // === SURVIVAL SCORE (cached) ===
  survivalScore: decimal("survival_score", { precision: 5, scale: 2 }).default("50.00"),
  lastCycleAt: timestamp("last_cycle_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_aas_config_artist").on(table.artistId),
  index("idx_aas_config_enabled").on(table.enabled),
]);

export const insertAasConfigSchema = createInsertSchema(aasConfig).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAasConfig = z.infer<typeof insertAasConfigSchema>;
export type SelectAasConfig = typeof aasConfig.$inferSelect;

/**
 * AAS Survival Metrics — Periodic scoring snapshots
 */
export const aasSurvivalMetrics = pgTable("aas_survival_metrics", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  period: text("period").notNull(),
  periodType: text("period_type", { enum: ["daily", "weekly", "monthly"] }).notNull(),

  // Score components (0-100)
  revenueHealth: decimal("revenue_health", { precision: 5, scale: 2 }).default("0"),
  pipelineStrength: decimal("pipeline_strength", { precision: 5, scale: 2 }).default("0"),
  audienceMomentum: decimal("audience_momentum", { precision: 5, scale: 2 }).default("0"),
  brandRelevance: decimal("brand_relevance", { precision: 5, scale: 2 }).default("0"),
  dealVelocity: decimal("deal_velocity", { precision: 5, scale: 2 }).default("0"),
  burnRate: decimal("burn_rate", { precision: 10, scale: 2 }).default("0"),
  legalRiskScore: decimal("legal_risk_score", { precision: 5, scale: 2 }).default("0"),
  churnRate: decimal("churn_rate", { precision: 5, scale: 2 }).default("0"),
  contentFatigue: decimal("content_fatigue", { precision: 5, scale: 2 }).default("0"),
  survivalScore: decimal("survival_score", { precision: 5, scale: 2 }).notNull(),

  // Financial actuals
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0"),
  totalCosts: decimal("total_costs", { precision: 10, scale: 2 }).default("0"),
  netProfit: decimal("net_profit", { precision: 10, scale: 2 }).default("0"),
  runwayDays: integer("runway_days").default(0),

  // Audience
  newFans: integer("new_fans").default(0),
  lostFans: integer("lost_fans").default(0),
  netFanGrowth: integer("net_fan_growth").default(0),

  // Commercial
  dealsOpened: integer("deals_opened").default(0),
  dealsClosed: integer("deals_closed").default(0),

  // Metadata
  channelPerformance: json("channel_performance").$type<Record<string, number>>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_aas_metrics_artist").on(table.artistId),
  index("idx_aas_metrics_period").on(table.period),
]);

/**
 * AAS Deal Pipeline — Unified CRM for artist opportunities
 */
export const aasDealPipeline = pgTable("aas_deal_pipeline", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  targetName: text("target_name").notNull(),
  targetRole: text("target_role"),
  targetCompany: text("target_company"),
  targetEmail: text("target_email"),
  targetPlatform: text("target_platform"),
  targetCategory: text("target_category", {
    enum: ["label", "manager", "brand", "curator", "artist", "publisher", "supervisor", "festival", "agency"]
  }).notNull(),

  stage: text("stage", {
    enum: ["identified", "qualified", "first_contact", "interest_detected",
           "proposal_sent", "negotiation", "legal_review", "closed_won",
           "closed_lost", "activated", "expansion"]
  }).default("identified"),

  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  dealType: text("deal_type", {
    enum: ["sync_license", "distribution", "collab", "sponsorship", "playlist_placement",
           "management", "publishing", "merch_collab", "show_booking", "brand_deal"]
  }),

  lastContactAt: timestamp("last_contact_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  touchpoints: integer("touchpoints").default(0),
  notes: text("notes"),
  lastMessageSent: text("last_message_sent"),

  requiresHumanApproval: boolean("requires_human_approval").default(false),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_aas_deal_artist").on(table.artistId),
  index("idx_aas_deal_stage").on(table.stage),
  index("idx_aas_deal_category").on(table.targetCategory),
]);

/**
 * AAS Daily Action Log — Execution records per cycle
 */
export const aasDailyActionLog = pgTable("aas_daily_action_log", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  cycleDate: text("cycle_date").notNull(),

  objectives: json("objectives").$type<string[]>(),
  plannedActions: json("planned_actions").$type<{
    action: string;
    agent: string;
    channel: string;
    budgetAllocated: number;
    status: "pending" | "executing" | "completed" | "failed" | "skipped";
    result?: string;
    costActual?: number;
    revenueGenerated?: number;
  }[]>(),
  maxDailyBudget: decimal("max_daily_budget", { precision: 10, scale: 2 }),

  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"),
  totalEarned: decimal("total_earned", { precision: 10, scale: 2 }).default("0"),
  actionsCompleted: integer("actions_completed").default(0),
  actionsFailed: integer("actions_failed").default(0),
  lessonsLearned: json("lessons_learned").$type<string[]>(),

  survivalScoreBefore: decimal("survival_score_before", { precision: 5, scale: 2 }),
  survivalScoreAfter: decimal("survival_score_after", { precision: 5, scale: 2 }),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_aas_action_log_artist").on(table.artistId),
  index("idx_aas_action_log_date").on(table.cycleDate),
]);

/**
 * AAS Strategic Memory — Long-term business insights that improve over time
 */
export const aasStrategicMemory = pgTable("aas_strategic_memory", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  category: text("category", {
    enum: ["narrative_performance", "fan_behavior", "deal_insight", "collab_result",
           "offer_conversion", "segment_ltv", "channel_efficiency", "creative_roi"]
  }).notNull(),

  insight: text("insight").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).default("0.50"),
  evidenceCount: integer("evidence_count").default(1),
  lastValidatedAt: timestamp("last_validated_at"),
  metadata: json("metadata").$type<Record<string, any>>(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_aas_memory_artist").on(table.artistId),
  index("idx_aas_memory_category").on(table.category),
]);

/**
 * AAS Approval Queue — Actions requiring human sign-off before execution
 */
export const aasApprovalQueue = pgTable("aas_approval_queue", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  actionType: text("action_type").notNull(),
  description: text("description").notNull(),
  agent: text("agent").notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  estimatedRevenue: decimal("estimated_revenue", { precision: 10, scale: 2 }),
  riskLevel: text("risk_level", { enum: ["low", "medium", "high", "critical"] }).default("medium"),

  payload: json("payload").$type<Record<string, any>>(),

  status: text("status", {
    enum: ["pending", "approved", "rejected", "expired"]
  }).default("pending").notNull(),
  decidedBy: integer("decided_by"),
  decidedAt: timestamp("decided_at"),
  decisionNote: text("decision_note"),

  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_aas_approval_artist").on(table.artistId),
  index("idx_aas_approval_status").on(table.status),
]);

// ── AAS Daily Goals ─────────────────────────────────────────
export const aasDailyGoals = pgTable("aas_daily_goals", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  cycleDate: text("cycle_date").notNull(), // YYYY-MM-DD

  category: text("category", {
    enum: [
      "radio_outreach",       // Contact radio stations for airplay
      "label_deal",           // Negotiate with record labels
      "social_post",          // Post on Boostify social network
      "social_engage",        // Like/comment on social network
      "blockchain_register",  // Register artist on-chain
      "blockchain_tokenize",  // Tokenize a song
      "blockchain_trade",     // Token trading activity
      "sponsor_outreach",     // Contact sponsors/brands
      "venue_booking",        // Book venues/festivals
      "content_create",       // AI content creation (images/videos)
      "fan_engage",           // Fan/superfan engagement
      "email_campaign",       // Email marketing campaigns
      "music_release",        // Release new music
      "merch_launch",         // Launch merchandise
    ]
  }).notNull(),

  title: text("title").notNull(),          // "Contact 3 radio stations"
  description: text("description"),         // Details about the goal
  targetCount: integer("target_count").default(1).notNull(), // e.g. 3 radios
  completedCount: integer("completed_count").default(0).notNull(), // e.g. 2 done
  
  status: text("status", {
    enum: ["pending", "in_progress", "completed", "failed", "skipped"]
  }).default("pending").notNull(),

  agent: text("agent"),                    // Which agent handles this
  channel: text("channel"),                // email, social, blockchain, etc.
  priority: integer("priority").default(3), // 1=highest, 5=lowest
  
  result: text("result"),                  // What happened
  metadata: json("metadata").$type<Record<string, any>>(),

  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_aas_goals_artist_date").on(table.artistId, table.cycleDate),
  index("idx_aas_goals_status").on(table.status),
  index("idx_aas_goals_category").on(table.category),
]);

// ============================================
// ADMIN PRICING CONFIG — Controls markup per operation
// ============================================
export const adminPricingConfig = pgTable("admin_pricing_config", {
  id: serial("id").primaryKey(),
  operationType: text("operation_type").notNull().unique(), // e.g. 'image.nano_banana_2'
  category: text("category").notNull(),                     // e.g. 'image_generation'
  internalCostUsd: decimal("internal_cost_usd", { precision: 10, scale: 6 }).notNull(),
  markupMultiplier: decimal("markup_multiplier", { precision: 5, scale: 2 }).default('5.00').notNull(),
  creditCost: integer("credit_cost").notNull(),             // Pre-calculated credits
  isActive: boolean("is_active").default(true).notNull(),
  updatedBy: text("updated_by"),                            // Admin email
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_admin_pricing_operation").on(table.operationType),
  index("idx_admin_pricing_category").on(table.category),
]);

export const insertAdminPricingConfigSchema = createInsertSchema(adminPricingConfig).omit({ id: true, createdAt: true });
export const selectAdminPricingConfigSchema = createSelectSchema(adminPricingConfig);
export type InsertAdminPricingConfig = z.infer<typeof insertAdminPricingConfigSchema>;
export type SelectAdminPricingConfig = typeof adminPricingConfig.$inferSelect;

// ============================================
// GLOBAL MARKUP SETTINGS — Admin-controlled defaults
// ============================================
export const adminGlobalSettings = pgTable("admin_global_settings", {
  id: serial("id").primaryKey(),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: text("setting_value").notNull(),
  description: text("description"),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdminGlobalSettingsSchema = createInsertSchema(adminGlobalSettings).omit({ id: true, createdAt: true });
export type InsertAdminGlobalSettings = z.infer<typeof insertAdminGlobalSettingsSchema>;
export type SelectAdminGlobalSettings = typeof adminGlobalSettings.$inferSelect;

// ============================================
// ARTIST BUSINESS PLANS — Professional financial planning for artists
// ============================================
export const artistBusinessPlans = pgTable("artist_business_plans", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  
  // Business identity
  businessName: text("business_name"),
  executiveSummary: text("executive_summary"),
  missionStatement: text("mission_statement"),
  
  // Revenue streams — monthly estimates in USD
  revenueStreams: json("revenue_streams").$type<{
    streaming: number;
    merchandise: number;
    liveShows: number;
    licensing: number;
    brandDeals: number;
    courses: number;
    crowdfunding: number;
    other: number;
  }>(),
  
  // Monthly expenses in USD
  monthlyExpenses: json("monthly_expenses").$type<{
    studio: number;
    marketing: number;
    equipment: number;
    travel: number;
    contentCreation: number;
    team: number;
    distribution: number;
    other: number;
  }>(),
  
  // Financial goals
  financialGoals: json("financial_goals").$type<{
    monthlyTarget: number;
    yearlyTarget: number;
    savingsTarget: number;
    investmentAsk: number;
  }>(),
  
  // Milestones / Roadmap (dynamic, self-updating)
  milestones: json("milestones").$type<Array<{
    id?: string;
    title: string;
    date: string;
    category: string;
    status: 'planned' | 'in_progress' | 'completed';
    description?: string;
    completedAt?: string;
    autoGenerated?: boolean;
    linkedToEngine?: boolean;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }>>(),
  
  // Dynamic roadmap configuration
  roadmapAutoUpdate: boolean("roadmap_auto_update").default(true),
  lastRoadmapSync: timestamp("last_roadmap_sync"),
  
  // Execution log — tracks actual vs planned milestone completion
  roadmapExecutionLog: json("roadmap_execution_log").$type<Array<{
    milestoneId: string;
    event: string;
    plannedDate: string;
    actualDate?: string;
    delta?: number;
    details?: string;
    timestamp: string;
  }>>(),
  
  // Link to economic engine operating mode
  linkedEngineMode: text("linked_engine_mode"),
  
  // Pitch deck data (AI-generated slides content)
  pitchDeckData: json("pitch_deck_data").$type<{
    tagline?: string;
    problemStatement?: string;
    solution?: string;
    marketOpportunity?: string;
    traction?: string;
    useOfFunds?: string;
    teamMembers?: Array<{ name: string; role: string; bio?: string }>;
    askAmount?: number;
    askTerms?: string;
  }>(),
  
  // Projections (12-month forecast)
  projections: json("projections").$type<Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>>(),
  
  // Budget allocation percentages
  budgetAllocation: json("budget_allocation").$type<Record<string, number>>(),

  // ─── AI Full-Generation (v2) ────────────────────────────────────────────────
  // Full AI-generated JSON business plan (all modules in one shot)
  aiGeneratedPlan: jsonb("ai_generated_plan").$type<Record<string, unknown>>(),
  generationStatus: text("generation_status", {
    enum: ["pending", "generating", "completed", "failed"],
  }).default("pending").notNull(),
  generationError: text("generation_error"),
  generatedAt: timestamp("generated_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_business_plan_artist").on(table.artistId),
  index("idx_business_plan_status").on(table.generationStatus),
]);

export const insertArtistBusinessPlanSchema = createInsertSchema(artistBusinessPlans).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertArtistBusinessPlan = z.infer<typeof insertArtistBusinessPlanSchema>;
export type SelectArtistBusinessPlan = typeof artistBusinessPlans.$inferSelect;

// ─── Video Service Projects ────────────────────────────────────────────────
export const videoServiceProjects = pgTable("video_service_projects", {
  id: serial("id").primaryKey(),

  // Lead info
  leadName: text("lead_name").notNull(),
  leadEmail: text("lead_email").notNull(),
  leadPhone: text("lead_phone"),
  leadInstagram: text("lead_instagram"),
  leadSpotify: text("lead_spotify"),

  // Song data
  songUrl: text("song_url"),
  songName: text("song_name"),
  songGenre: text("song_genre"),
  songDuration: decimal("song_duration", { precision: 10, scale: 2 }),

  // Video preferences
  videoType: text("video_type", { enum: ["music_video", "commercial", "lyric_video"] }),
  aesthetic: text("aesthetic"),
  description: text("description"),
  needsRealVideo: boolean("needs_real_video").default(false).notNull(),
  needsLipSync: boolean("needs_lip_sync").default(false).notNull(),
  resolution: text("resolution", { enum: ["1080p", "4k"] }).default("1080p"),
  videoDuration: text("video_duration"),
  locations: text("locations"),

  // Budget
  calculatedPrice: decimal("calculated_price", { precision: 10, scale: 2 }),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }),
  depositPaid: boolean("deposit_paid").default(false).notNull(),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentId: text("stripe_payment_id"),

  // Two-stage payment flow:
  //  1) reservation ($99) locks the slot & triggers production of script
  //  2) script payment (50% of total minus reservation) after script approval
  //  3) final payment before delivery — handled manually for now
  reservationPaid: boolean("reservation_paid").default(false).notNull(),
  reservationAmount: decimal("reservation_amount", { precision: 10, scale: 2 }).default("99"),
  reservationStripeId: text("reservation_stripe_id"),
  scriptPaymentPaid: boolean("script_payment_paid").default(false).notNull(),
  scriptPaymentAmount: decimal("script_payment_amount", { precision: 10, scale: 2 }),
  scriptPaymentStripeId: text("script_payment_stripe_id"),

  // Premium perk: ≥ $5,000 grants 1 year of Boostify Premium + 35% off AI video gen
  premiumAccessGranted: boolean("premium_access_granted").default(false).notNull(),
  premiumAccessExpiresAt: timestamp("premium_access_expires_at"),
  aiVideoDiscountPct: integer("ai_video_discount_pct").default(0),

  // Project tracking (5 phases)
  projectStatus: text("project_status", {
    enum: ["received", "script_creation", "proposal_sent", "in_production", "delivered"]
  }).default("received").notNull(),

  // Landing page promo
  freeLandingDays: integer("free_landing_days").default(30),
  artistPageUrl: text("artist_page_url"),
  artistImageUrl: text("artist_image_url"),

  // Language preference
  lang: text("lang").default("es"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vs_email").on(table.leadEmail),
  index("idx_vs_status").on(table.projectStatus),
]);

export const insertVideoServiceProjectSchema = createInsertSchema(videoServiceProjects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVideoServiceProject = z.infer<typeof insertVideoServiceProjectSchema>;
export type SelectVideoServiceProject = typeof videoServiceProjects.$inferSelect;

// ====================================
// PODCAST RECORDINGS & EPISODES
// ====================================

/**
 * Podcast Recordings — raw recording files from studio sessions
 */
export const podcastRecordings = pgTable("podcast_recordings", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  userId: text("user_id").notNull(),
  
  filename: text("filename").notNull(),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type").default("video/webm"),
  duration: integer("duration").default(0), // seconds
  
  recordingType: text("recording_type", {
    enum: ["video", "audio_only", "screen"]
  }).default("video"),
  
  status: text("status", {
    enum: ["recording", "processing", "ready", "failed"]
  }).default("recording"),
  
  // Audio processing metadata
  peakAmplitude: decimal("peak_amplitude", { precision: 5, scale: 3 }),
  avgLoudness: decimal("avg_loudness", { precision: 5, scale: 3 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_podcast_recordings_session").on(table.sessionId),
  index("idx_podcast_recordings_user").on(table.userId),
  index("idx_podcast_recordings_status").on(table.status),
]);

export type InsertPodcastRecording = typeof podcastRecordings.$inferInsert;
export type SelectPodcastRecording = typeof podcastRecordings.$inferSelect;

// ============================================
// SOCIAL ECONOMY 2.0 — Tips, Promotions, Hype Campaigns
// ============================================

/**
 * Social Tips — Users and AI agents tip artists with BTF tokens
 */
export const socialTips = pgTable("social_tips", {
  id: serial("id").primaryKey(),
  
  fromUserId: integer("from_user_id").references(() => users.id, { onDelete: "set null" }),
  toArtistId: integer("to_artist_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Tip details
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  tokenType: text("token_type", {
    enum: ["btf", "eth", "usd", "artist_token"]
  }).default("btf").notNull(),
  tokenSymbol: text("token_symbol"), // If tipping with artist_token
  
  // Context
  postId: integer("post_id").references(() => aiSocialPosts.id, { onDelete: "set null" }),
  message: text("message"), // Optional tip message
  
  // Source
  isAiTip: boolean("is_ai_tip").default(false), // True if AI agent tipped
  
  // Platform fee
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).default("0"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_tips_from").on(table.fromUserId),
  index("idx_tips_to").on(table.toArtistId),
  index("idx_tips_post").on(table.postId),
  index("idx_tips_created").on(table.createdAt),
]);

export type SocialTip = typeof socialTips.$inferSelect;
export type NewSocialTip = typeof socialTips.$inferInsert;

/**
 * Token Promotion Campaigns — AI agents promote tokens autonomously
 */
export const tokenPromotionCampaigns = pgTable("token_promotion_campaigns", {
  id: serial("id").primaryKey(),
  
  artistId: integer("artist_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenId: integer("token_id").references(() => tokenizedSongs.id, { onDelete: "set null" }),
  
  // Campaign details
  campaignType: text("campaign_type", {
    enum: ["shill", "alpha_call", "collab_promo", "milestone", "hype_train", "diamond_hands", "dip_buy"]
  }).notNull(),
  
  postId: integer("post_id").references(() => aiSocialPosts.id, { onDelete: "set null" }),
  
  // Token data snapshot at time of promotion
  tokenPrice: decimal("token_price", { precision: 10, scale: 4 }),
  tokenSupply: integer("token_supply"),
  tokenHolders: integer("token_holders").default(0),
  
  // Performance
  impressions: integer("impressions").default(0),
  engagements: integer("engagements").default(0), // likes + comments
  tipsReceived: decimal("tips_received", { precision: 10, scale: 2 }).default("0"),
  tokensBoughtAfter: decimal("tokens_bought_after", { precision: 12, scale: 2 }).default("0"),
  
  // Budget spent by AI artist
  btfBurned: decimal("btf_burned", { precision: 10, scale: 2 }).default("0"),
  
  status: text("status", {
    enum: ["active", "completed", "expired"]
  }).default("active").notNull(),
  
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_promo_artist").on(table.artistId),
  index("idx_promo_token").on(table.tokenId),
  index("idx_promo_status").on(table.status),
]);

export type TokenPromotionCampaign = typeof tokenPromotionCampaigns.$inferSelect;
export type NewTokenPromotionCampaign = typeof tokenPromotionCampaigns.$inferInsert;

/**
 * Hype Campaigns — Coordinated multi-agent hype events
 */
export const hypeCampaigns = pgTable("hype_campaigns", {
  id: serial("id").primaryKey(),
  
  // Campaign target
  targetArtistId: integer("target_artist_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  targetTokenId: integer("target_token_id").references(() => tokenizedSongs.id, { onDelete: "set null" }),
  
  // Campaign info
  title: text("title").notNull(),
  description: text("description"),
  campaignGoal: text("campaign_goal", {
    enum: ["token_pump", "new_release", "collab_hype", "community_growth", "comeback"]
  }).notNull(),
  
  // Participants
  participantArtistIds: integer("participant_artist_ids").array(),
  totalParticipants: integer("total_participants").default(0),
  
  // Metrics
  totalPosts: integer("total_posts").default(0),
  totalTips: decimal("total_tips", { precision: 10, scale: 2 }).default("0"),
  totalEngagement: integer("total_engagement").default(0),
  priceAtStart: decimal("price_at_start", { precision: 10, scale: 4 }),
  priceAtEnd: decimal("price_at_end", { precision: 10, scale: 4 }),
  
  status: text("status", {
    enum: ["planning", "active", "completed", "failed"]
  }).default("planning").notNull(),
  
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_hype_target").on(table.targetArtistId),
  index("idx_hype_status").on(table.status),
]);

export type HypeCampaign = typeof hypeCampaigns.$inferSelect;
export type NewHypeCampaign = typeof hypeCampaigns.$inferInsert;

/**
 * Tip Leaderboard Cache — Weekly aggregated tip rankings
 */
export const tipLeaderboard = pgTable("tip_leaderboard", {
  id: serial("id").primaryKey(),
  
  artistId: integer("artist_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  weekStart: timestamp("week_start").notNull(),
  totalTipsReceived: decimal("total_tips_received", { precision: 12, scale: 2 }).default("0"),
  totalTipsSent: decimal("total_tips_sent", { precision: 12, scale: 2 }).default("0"),
  tipCount: integer("tip_count").default(0),
  uniqueTippers: integer("unique_tippers").default(0),
  
  rank: integer("rank"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_leaderboard_artist").on(table.artistId),
  index("idx_leaderboard_week").on(table.weekStart),
  index("idx_leaderboard_rank").on(table.rank),
]);

// ============================================
// AGENT MARKETPLACE
// ============================================

/**
 * Agent Marketplace Listings — Curated agent templates, workflows, and specialized agents
 */
export const agentMarketplaceListings = pgTable("agent_marketplace_listings", {
  id: serial("id").primaryKey(),
  
  // Author info
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull(),
  
  // Listing details
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  shortDescription: text("short_description").notNull(),
  longDescription: text("long_description"),
  
  // Classification
  agentType: text("agent_type", {
    enum: ["composer", "video-director", "photographer", "marketing", "social-media", "merchandise", "manager", "multi-agent", "custom"]
  }).notNull(),
  category: text("category", {
    enum: ["workflow", "template", "prompt-pack", "automation", "integration", "toolkit"]
  }).notNull(),
  tags: text("tags").array(),
  
  // Visual
  iconUrl: text("icon_url"),
  coverImageUrl: text("cover_image_url"),
  color: text("color").default("from-orange-500 to-amber-500"),
  
  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }).default("0"), // 0 = free
  currency: text("currency").default("USD"),
  isFree: boolean("is_free").default(true),
  
  // Configuration — the actual agent template/workflow data
  configuration: json("configuration").$type<{
    systemPrompt?: string;
    tools?: string[];
    steps?: Array<{ name: string; description: string; agentType: string; prompt: string }>;
    defaultParams?: Record<string, unknown>;
    requiredInputs?: Array<{ key: string; label: string; type: string; required: boolean }>;
  }>(),
  
  // Compatibility & requirements
  requiredPlan: text("required_plan", { enum: ["free", "artist", "creator", "professional", "enterprise"] }).default("free"),
  compatibleAgents: text("compatible_agents").array(),
  
  // Stats (denormalized for fast reads)
  installCount: integer("install_count").default(0),
  avgRating: decimal("avg_rating", { precision: 3, scale: 2 }).default("0"),
  ratingCount: integer("rating_count").default(0),
  
  // Status
  status: text("status", { enum: ["draft", "pending_review", "published", "suspended", "archived"] }).default("draft"),
  isFeatured: boolean("is_featured").default(false),
  isVerified: boolean("is_verified").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at"),
}, (table) => [
  index("idx_marketplace_author").on(table.authorId),
  index("idx_marketplace_agent_type").on(table.agentType),
  index("idx_marketplace_category").on(table.category),
  index("idx_marketplace_status").on(table.status),
  index("idx_marketplace_featured").on(table.isFeatured),
  index("idx_marketplace_slug").on(table.slug),
]);

export const insertAgentMarketplaceListingSchema = createInsertSchema(agentMarketplaceListings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAgentMarketplaceListing = z.infer<typeof insertAgentMarketplaceListingSchema>;
export type SelectAgentMarketplaceListing = typeof agentMarketplaceListings.$inferSelect;

/**
 * Agent Marketplace Installs — Tracks which users installed which marketplace agents
 */
export const agentMarketplaceInstalls = pgTable("agent_marketplace_installs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  listingId: integer("listing_id").references(() => agentMarketplaceListings.id, { onDelete: "cascade" }).notNull(),
  
  // User's rating and review
  rating: integer("rating"), // 1-5
  review: text("review"),
  
  isActive: boolean("is_active").default(true),
  
  installedAt: timestamp("installed_at").defaultNow().notNull(),
  uninstalledAt: timestamp("uninstalled_at"),
}, (table) => [
  index("idx_install_user").on(table.userId),
  index("idx_install_listing").on(table.listingId),
]);

/**
 * Podcast Episodes — published episodes from recordings
 */
export const podcastEpisodes = pgTable("podcast_episodes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  recordingId: integer("recording_id"),
  sessionId: integer("session_id"),
  
  title: text("title").notNull(),
  description: text("description"),
  showNotes: text("show_notes"),
  
  // Media
  audioUrl: text("audio_url"),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  waveformData: json("waveform_data").$type<number[]>(),
  duration: integer("duration").default(0), // seconds
  fileSize: integer("file_size"),
  
  // Metadata
  episodeNumber: integer("episode_number"),
  seasonNumber: integer("season_number"),
  tags: json("tags").$type<string[]>().default([]),
  category: text("category"),
  language: text("language").default("en"),
  explicit: boolean("explicit").default(false),
  
  // Publishing
  status: text("status", {
    enum: ["draft", "processing", "published", "archived", "deleted"]
  }).default("draft"),
  publishedAt: timestamp("published_at"),
  scheduledPublishAt: timestamp("scheduled_publish_at"),
  
  // Analytics
  playCount: integer("play_count").default(0),
  downloadCount: integer("download_count").default(0),
  likeCount: integer("like_count").default(0),
  shareCount: integer("share_count").default(0),
  avgListenDuration: integer("avg_listen_duration").default(0),
  
  // Chapters/markers
  chapters: json("chapters").$type<Array<{
    title: string;
    startTime: number;
    endTime?: number;
    thumbnail?: string;
  }>>().default([]),
  
  // Transcript
  transcript: text("transcript"),
  transcriptStatus: text("transcript_status", {
    enum: ["none", "generating", "ready", "failed"]
  }).default("none"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_podcast_episodes_user").on(table.userId),
  index("idx_podcast_episodes_status").on(table.status),
  index("idx_podcast_episodes_recording").on(table.recordingId),
  index("idx_podcast_episodes_published").on(table.publishedAt),
])

export type InsertPodcastEpisode = typeof podcastEpisodes.$inferInsert;
export type SelectPodcastEpisode = typeof podcastEpisodes.$inferSelect;

// ═══════════════════════════════════════════════════════════════
// ARTIST ACTIVATION ENGINE — Drip sequences, scoring, tracking
// Target: 50,000 active artists by end of 2026
// ═══════════════════════════════════════════════════════════════

/**
 * Drip email sequences — tracks which sequence each lead is in
 * and their position within that sequence.
 */
export const dripSequences = pgTable("drip_sequences", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => musicIndustryContacts.id, { onDelete: "cascade" }).notNull(),
  sequenceType: text("sequence_type", {
    enum: ["welcome_cold", "landing_builder", "value_showcase", "upgrade_nudge", "win_back", "referral_push"]
  }).notNull(),
  currentStep: integer("current_step").default(0).notNull(), // 0-based index within sequence
  totalSteps: integer("total_steps").notNull(),
  status: text("status", {
    enum: ["active", "completed", "paused", "cancelled", "bounced"]
  }).default("active").notNull(),
  nextSendAt: timestamp("next_send_at"),
  lastSentAt: timestamp("last_sent_at"),
  lastOpenedAt: timestamp("last_opened_at"),
  lastClickedAt: timestamp("last_clicked_at"),
  emailsSent: integer("emails_sent").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_drip_contact").on(table.contactId),
  index("idx_drip_status").on(table.status),
  index("idx_drip_next_send").on(table.nextSendAt),
  index("idx_drip_sequence_type").on(table.sequenceType),
]);

export type InsertDripSequence = typeof dripSequences.$inferInsert;
export type SelectDripSequence = typeof dripSequences.$inferSelect;

/**
 * Activation events — every meaningful action logged for scoring
 */
export const activationEvents = pgTable("activation_events", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => musicIndustryContacts.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  eventType: text("event_type", {
    enum: [
      "email_sent", "email_delivered", "email_opened", "email_clicked", "email_bounced", "email_soft_bounce",
      "magic_link_generated", "magic_link_clicked",
      "account_created", "profile_completed", "song_uploaded", "landing_visited",
      "credits_used", "pricing_visited", "page_shared",
      "upgrade_offered", "upgrade_clicked", "upgrade_completed",
      "referral_sent", "referral_converted",
      "win_back_sent", "reactivated"
    ]
  }).notNull(),
  eventData: json("event_data").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_activation_email").on(table.email),
  index("idx_activation_contact").on(table.contactId),
  index("idx_activation_user").on(table.userId),
  index("idx_activation_type").on(table.eventType),
  index("idx_activation_created").on(table.createdAt),
]);

export type InsertActivationEvent = typeof activationEvents.$inferInsert;
export type SelectActivationEvent = typeof activationEvents.$inferSelect;

/**
 * Activation scores — pre-computed conversion readiness score per contact/user
 */
export const activationScores = pgTable("activation_scores", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => musicIndustryContacts.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email").notNull().unique(),
  score: integer("score").default(0).notNull(), // 0-100
  segment: text("segment", {
    enum: ["cold", "warming", "engaged", "hot", "converted", "churned"]
  }).default("cold").notNull(),
  signals: json("signals").$type<Record<string, number>>().default({}), // { email_opens: 3, songs_uploaded: 1, ... }
  currentPlan: text("current_plan").default("none"), // none, free, creator, professional, enterprise
  magicLinkToken: text("magic_link_token"),
  magicLinkExpiresAt: timestamp("magic_link_expires_at"),
  lastActivityAt: timestamp("last_activity_at"),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_score_email").on(table.email),
  index("idx_score_segment").on(table.segment),
  index("idx_score_score").on(table.score),
  index("idx_score_contact").on(table.contactId),
]);

export type InsertActivationScore = typeof activationScores.$inferInsert;
export type SelectActivationScore = typeof activationScores.$inferSelect;

// ============================================================================
// ARTIST HUNTER AGENT — Discovery Runs & Lead Scoring
// ============================================================================

/**
 * Discovery Runs — Persistent history of artist discovery operations
 */
export const discoveryRuns = pgTable("discovery_runs", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull().unique(),
  status: text("status", { enum: ["running", "completed", "failed"] }).default("running").notNull(),
  sources: json("sources").$type<string[]>().default([]),
  rawLeads: integer("raw_leads").default(0),
  inserted: integer("inserted").default(0),
  duplicates: integer("duplicates").default(0),
  invalid: integer("invalid").default(0),
  scored: integer("scored").default(0),
  sourceDetails: json("source_details").$type<any[]>().default([]),
  config: json("config").$type<Record<string, any>>().default({}),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_disc_runs_status").on(table.status),
  index("idx_disc_runs_started").on(table.startedAt),
]);

export type InsertDiscoveryRun = typeof discoveryRuns.$inferInsert;
export type SelectDiscoveryRun = typeof discoveryRuns.$inferSelect;

// ============================================================================
// DISTRIBUTION ORCHESTRATOR — Music Distribution System
// ============================================================================

/**
 * Distribution Partners — White-label & API partners for music delivery
 */
export const distributionPartners = pgTable("distribution_partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type", {
    enum: ["white_label", "api", "affiliate", "direct"]
  }).notNull().default("affiliate"),
  tier: text("tier", {
    enum: ["tier1", "tier2", "tier3"]
  }).default("tier3").notNull(),
  contactEmail: text("contact_email"),
  contactName: text("contact_name"),
  website: text("website"),
  apiEndpoint: text("api_endpoint"),
  apiKey: text("api_key"),
  revSharePercent: decimal("rev_share_percent", { precision: 5, scale: 2 }).default("0"),
  setupFee: decimal("setup_fee", { precision: 10, scale: 2 }).default("0"),
  monthlyFee: decimal("monthly_fee", { precision: 10, scale: 2 }).default("0"),
  territories: integer("territories").default(0),
  features: json("features").$type<string[]>().default([]),
  status: text("status", {
    enum: ["researching", "contacted", "negotiating", "active", "paused", "rejected"]
  }).default("researching").notNull(),
  outreachStatus: text("outreach_status", {
    enum: ["not_contacted", "email_sent", "replied", "meeting_scheduled", "contract_review", "signed"]
  }).default("not_contacted").notNull(),
  lastContactedAt: timestamp("last_contacted_at"),
  notes: text("notes"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertDistributionPartner = typeof distributionPartners.$inferInsert;
export type SelectDistributionPartner = typeof distributionPartners.$inferSelect;

/**
 * DSP Platforms — All available Digital Service Providers
 */
export const dspPlatforms = pgTable("dsp_platforms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  category: text("category", {
    enum: ["streaming", "download", "social", "sync", "other"]
  }).default("streaming").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  payPerStream: decimal("pay_per_stream", { precision: 10, scale: 6 }),
  territories: integer("territories").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertDspPlatform = typeof dspPlatforms.$inferInsert;
export type SelectDspPlatform = typeof dspPlatforms.$inferSelect;

/**
 * Releases — Album/Single/EP release packages
 */
export const releases = pgTable("releases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  type: text("type", {
    enum: ["single", "ep", "album", "compilation"]
  }).notNull().default("single"),
  upc: text("upc"),
  releaseDate: timestamp("release_date"),
  originalReleaseDate: timestamp("original_release_date"),
  genre: text("genre"),
  subgenre: text("subgenre"),
  language: text("language").default("en"),
  label: text("label").default("Boostify Music"),
  copyright: text("copyright"),
  copyrightYear: integer("copyright_year"),
  coverArtUrl: text("cover_art_url"),
  description: text("description"),
  explicit: boolean("explicit").default(false),
  territories: json("territories").$type<string[]>().default(["worldwide"]),
  status: text("status", {
    enum: ["draft", "metadata_complete", "review", "approved", "delivering", "live", "takedown", "rejected"]
  }).default("draft").notNull(),
  rejectionReason: text("rejection_reason"),
  submittedAt: timestamp("submitted_at"),
  approvedAt: timestamp("approved_at"),
  liveAt: timestamp("live_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_releases_user").on(table.userId),
  index("idx_releases_status").on(table.status),
  index("idx_releases_upc").on(table.upc),
]);

export type InsertRelease = typeof releases.$inferInsert;
export type SelectRelease = typeof releases.$inferSelect;

/**
 * Release Tracks — Songs within a release
 */
export const releaseTracks = pgTable("release_tracks", {
  id: serial("id").primaryKey(),
  releaseId: integer("release_id").references(() => releases.id, { onDelete: "cascade" }).notNull(),
  songId: integer("song_id").references(() => songs.id, { onDelete: "cascade" }).notNull(),
  trackNumber: integer("track_number").notNull(),
  discNumber: integer("disc_number").default(1),
  isrc: text("isrc"),
  title: text("title").notNull(),
  artists: json("artists").$type<{ name: string; role: string }[]>().default([]),
  duration: integer("duration"),
  explicit: boolean("explicit").default(false),
  previewStart: integer("preview_start").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_release_tracks_release").on(table.releaseId),
  index("idx_release_tracks_isrc").on(table.isrc),
]);

export type InsertReleaseTrack = typeof releaseTracks.$inferInsert;
export type SelectReleaseTrack = typeof releaseTracks.$inferSelect;

/**
 * Distribution Submissions — Tracking delivery to each DSP
 */
export const distributionSubmissions = pgTable("distribution_submissions", {
  id: serial("id").primaryKey(),
  releaseId: integer("release_id").references(() => releases.id, { onDelete: "cascade" }).notNull(),
  partnerId: integer("partner_id").references(() => distributionPartners.id),
  dspId: integer("dsp_id").references(() => dspPlatforms.id),
  dspName: text("dsp_name").notNull(),
  status: text("status", {
    enum: ["queued", "delivering", "processing", "live", "rejected", "takedown"]
  }).default("queued").notNull(),
  externalId: text("external_id"),
  externalUrl: text("external_url"),
  deliveredAt: timestamp("delivered_at"),
  liveAt: timestamp("live_at"),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  metadata: json("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_dist_sub_release").on(table.releaseId),
  index("idx_dist_sub_status").on(table.status),
]);

export type InsertDistributionSubmission = typeof distributionSubmissions.$inferInsert;
export type SelectDistributionSubmission = typeof distributionSubmissions.$inferSelect;

/**
 * Royalty Transactions — Earnings from DSP streams/downloads
 */
export const royaltyTransactions = pgTable("royalty_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  releaseId: integer("release_id").references(() => releases.id),
  trackId: integer("track_id").references(() => releaseTracks.id),
  dspName: text("dsp_name").notNull(),
  period: text("period").notNull(),
  streams: integer("streams").default(0),
  downloads: integer("downloads").default(0),
  grossRevenue: decimal("gross_revenue", { precision: 12, scale: 4 }).default("0"),
  netRevenue: decimal("net_revenue", { precision: 12, scale: 4 }).default("0"),
  platformFee: decimal("platform_fee", { precision: 12, scale: 4 }).default("0"),
  currency: text("currency").default("USD"),
  status: text("status", {
    enum: ["pending", "confirmed", "paid", "disputed"]
  }).default("pending").notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_royalty_user").on(table.userId),
  index("idx_royalty_release").on(table.releaseId),
  index("idx_royalty_period").on(table.period),
]);

export type InsertRoyaltyTransaction = typeof royaltyTransactions.$inferInsert;
export type SelectRoyaltyTransaction = typeof royaltyTransactions.$inferSelect;

/**
 * Streaming Analytics — Per-track DSP analytics
 */
export const streamingAnalytics = pgTable("streaming_analytics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  releaseId: integer("release_id").references(() => releases.id),
  trackId: integer("track_id").references(() => releaseTracks.id),
  dspName: text("dsp_name").notNull(),
  date: timestamp("date").notNull(),
  streams: integer("streams").default(0),
  saves: integer("saves").default(0),
  playlistAdds: integer("playlist_adds").default(0),
  skipRate: decimal("skip_rate", { precision: 5, scale: 2 }),
  avgListenDuration: integer("avg_listen_duration"),
  territory: text("territory"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_streaming_user").on(table.userId),
  index("idx_streaming_date").on(table.date),
  index("idx_streaming_dsp").on(table.dspName),
]);

/**
 * Agent Decisions — Audit log for AI-powered agent decisions
 * Records every AI scoring, sequence selection, and personalization decision
 */
export const agentDecisions = pgTable("agent_decisions", {
  id: serial("id").primaryKey(),
  decisionType: text("decision_type").notNull(), // ai_score, personalize_email, select_sequence
  contactId: integer("contact_id").references(() => musicIndustryContacts.id, { onDelete: "set null" }),
  input: json("input").$type<Record<string, any>>().default({}),
  output: json("output").$type<Record<string, any>>().default({}),
  reasoning: text("reasoning"),
  model: text("model"), // gpt-4o-mini, etc.
  tokensUsed: integer("tokens_used").default(0),
  durationMs: integer("duration_ms").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_decisions_type").on(table.decisionType),
  index("idx_agent_decisions_contact").on(table.contactId),
  index("idx_agent_decisions_created").on(table.createdAt),
]);

/**
 * Agent Goals — Weekly KPI targets for the autonomous Hunter Agent
 * The agent sets goals, tracks progress, and self-evaluates performance
 */
export const agentGoals = pgTable("agent_goals", {
  id: serial("id").primaryKey(),
  weekStart: timestamp("week_start").notNull(), // Monday of the week
  weekEnd: timestamp("week_end").notNull(), // Sunday of the week
  status: text("status").default("active").notNull(), // active, completed, failed
  // KPI targets
  targetLeadsDiscovered: integer("target_leads_discovered").default(500),
  targetEmailsSent: integer("target_emails_sent").default(200),
  targetEmailsOpened: integer("target_emails_opened").default(40),
  targetEmailsClicked: integer("target_emails_clicked").default(15),
  targetConversions: integer("target_conversions").default(5), // account_created
  targetHotLeads: integer("target_hot_leads").default(10),
  // Actual results (updated as the week progresses)
  actualLeadsDiscovered: integer("actual_leads_discovered").default(0),
  actualEmailsSent: integer("actual_emails_sent").default(0),
  actualEmailsOpened: integer("actual_emails_opened").default(0),
  actualEmailsClicked: integer("actual_emails_clicked").default(0),
  actualConversions: integer("actual_conversions").default(0),
  actualHotLeads: integer("actual_hot_leads").default(0),
  // Performance
  performanceScore: integer("performance_score"), // 0-100, calculated after week ends
  // AI reflection
  aiReflection: text("ai_reflection"), // GPT-generated weekly summary
  aiStrategyNext: text("ai_strategy_next"), // GPT recommended strategy for next week
  // Source allocation (which sources to prioritize this week)
  sourceAllocation: json("source_allocation").$type<Record<string, number>>(), // e.g. { spotify: 40, bandcamp: 30, google_ai: 20, instagram: 10 }
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_goals_week").on(table.weekStart),
  index("idx_agent_goals_status").on(table.status),
]);

/**
 * Source ROI — Tracks conversion performance per discovery source over time
 */
export const sourceRoi = pgTable("source_roi", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(), // spotify, bandcamp, google_ai, instagram, soundcloud
  weekStart: timestamp("week_start").notNull(),
  leadsDiscovered: integer("leads_discovered").default(0),
  leadsEmailed: integer("leads_emailed").default(0),
  emailsOpened: integer("emails_opened").default(0),
  emailsClicked: integer("emails_clicked").default(0),
  conversions: integer("conversions").default(0), // account_created
  avgScore: integer("avg_score").default(0),
  costEstimate: integer("cost_estimate").default(0), // in cents (API costs)
  roiScore: integer("roi_score"), // 0-100 calculated: conversions / cost ratio
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_source_roi_source").on(table.source),
  index("idx_source_roi_week").on(table.weekStart),
]);

/**
 * A/B Tests — Email subject line and sequence experiments
 * The agent creates, runs, and evaluates A/B tests automatically
 */
export const abTests = pgTable("ab_tests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g. "subject_welcome_cold_step0_w15"
  testType: text("test_type").notNull(), // subject_line, sequence_type, opener
  status: text("status").default("running").notNull(), // running, completed, winner_a, winner_b
  // Variant A
  variantA: text("variant_a").notNull(), // e.g. original subject line
  variantALabel: text("variant_a_label").default("Control"),
  variantASent: integer("variant_a_sent").default(0),
  variantAOpened: integer("variant_a_opened").default(0),
  variantAClicked: integer("variant_a_clicked").default(0),
  variantAConverted: integer("variant_a_converted").default(0),
  // Variant B
  variantB: text("variant_b").notNull(), // e.g. AI-personalized subject line
  variantBLabel: text("variant_b_label").default("AI Variant"),
  variantBSent: integer("variant_b_sent").default(0),
  variantBOpened: integer("variant_b_opened").default(0),
  variantBClicked: integer("variant_b_clicked").default(0),
  variantBConverted: integer("variant_b_converted").default(0),
  // Test configuration
  sequenceType: text("sequence_type"), // which sequence this test applies to
  step: integer("step"), // which step in the sequence
  minSampleSize: integer("min_sample_size").default(50), // minimum sends per variant before evaluating
  confidenceLevel: integer("confidence_level").default(95), // statistical significance threshold
  // Result
  winnerVariant: text("winner_variant"), // 'a' or 'b'
  liftPercent: integer("lift_percent"), // % improvement of winner over loser
  aiAnalysis: text("ai_analysis"), // GPT analysis of results
  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_ab_tests_status").on(table.status),
  index("idx_ab_tests_type").on(table.testType),
  index("idx_ab_tests_sequence").on(table.sequenceType, table.step),
]);

/**
 * Agent Health Log — Self-healing monitor records system health events
 */
export const agentHealthLog = pgTable("agent_health_log", {
  id: serial("id").primaryKey(),
  checkType: text("check_type").notNull(), // scheduler_health, email_delivery, bounce_rate, score_distribution, api_availability
  status: text("status").notNull(), // healthy, warning, critical, recovered
  details: json("details").$type<Record<string, any>>().default({}),
  action: text("action"), // what the agent did to fix it (or null if healthy)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_agent_health_type").on(table.checkType),
  index("idx_agent_health_status").on(table.status),
  index("idx_agent_health_created").on(table.createdAt),
]);

// ============================================================
// PRODUCER TOOLS — Service Requests & Bidding System (Uber-style)
// ============================================================

/**
 * Musician Profiles Extended — Real musician profiles with location, availability, portfolio
 */
export const musicianProfiles = pgTable("musician_profiles", {
  id: serial("id").primaryKey(),
  musicianId: integer("musician_id").references(() => musicians.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  
  // Location data
  city: text("city"),
  country: text("country"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  
  // Extended profile
  bio: text("bio"),
  yearsExperience: integer("years_experience"),
  portfolioUrl: text("portfolio_url"),
  soundcloudUrl: text("soundcloud_url"),
  youtubeUrl: text("youtube_url"),
  instagramUrl: text("instagram_url"),
  spotifyUrl: text("spotify_url"),
  
  // Availability
  isAvailable: boolean("is_available").default(true).notNull(),
  availabilitySchedule: json("availability_schedule").$type<{
    monday?: boolean; tuesday?: boolean; wednesday?: boolean;
    thursday?: boolean; friday?: boolean; saturday?: boolean; sunday?: boolean;
  }>(),
  responseTimeMinutes: integer("response_time_minutes").default(60),
  
  // Verification
  isVerified: boolean("is_verified").default(false).notNull(),
  verifiedAt: timestamp("verified_at"),
  
  // Stats
  completedJobs: integer("completed_jobs").default(0).notNull(),
  cancelledJobs: integer("cancelled_jobs").default(0).notNull(),
  avgResponseTime: integer("avg_response_time"),
  
  // Import source
  importSource: text("import_source"), // 'manual', 'csv', 'apify', 'api'
  importBatchId: text("import_batch_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_musician_profiles_musician").on(table.musicianId),
  index("idx_musician_profiles_location").on(table.latitude, table.longitude),
  index("idx_musician_profiles_available").on(table.isAvailable),
]);

/**
 * Musician Imports — Log of bulk imports from admin
 */
export const musicianImports = pgTable("musician_imports", {
  id: serial("id").primaryKey(),
  batchId: text("batch_id").notNull().unique(),
  importedBy: integer("imported_by").references(() => users.id).notNull(),
  source: text("source", { enum: ["csv", "json", "apify", "manual"] }).notNull(),
  totalRecords: integer("total_records").default(0).notNull(),
  successCount: integer("success_count").default(0).notNull(),
  errorCount: integer("error_count").default(0).notNull(),
  errors: json("errors").$type<Array<{ row: number; error: string }>>(),
  status: text("status", { enum: ["processing", "completed", "failed"] }).default("processing").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

/**
 * Service Requests — Artists posting job requests ("Need a guitarist for Rock session")
 */
export const serviceRequests = pgTable("service_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  
  title: text("title").notNull(),
  description: text("description").notNull(),
  instrumentNeeded: text("instrument_needed").notNull(),
  genre: text("genre"),
  
  budgetMin: decimal("budget_min", { precision: 10, scale: 2 }).notNull(),
  budgetMax: decimal("budget_max", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd").notNull(),
  
  city: text("city"),
  country: text("country"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  isRemote: boolean("is_remote").default(true).notNull(),
  
  deadline: timestamp("deadline"),
  urgency: text("urgency", { enum: ["low", "medium", "high", "urgent"] }).default("medium").notNull(),
  
  status: text("status", { enum: ["open", "in_progress", "completed", "cancelled", "expired"] }).default("open").notNull(),
  selectedBidId: integer("selected_bid_id"),
  
  totalBids: integer("total_bids").default(0).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  
  expiresAt: timestamp("expires_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_service_requests_user").on(table.userId),
  index("idx_service_requests_status").on(table.status),
  index("idx_service_requests_instrument").on(table.instrumentNeeded),
  index("idx_service_requests_location").on(table.latitude, table.longitude),
]);

/**
 * Service Bids — Musicians sending proposals for a service request
 */
export const serviceBids = pgTable("service_bids", {
  id: serial("id").primaryKey(),
  serviceRequestId: integer("service_request_id").references(() => serviceRequests.id, { onDelete: "cascade" }).notNull(),
  musicianId: integer("musician_id").references(() => musicians.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd").notNull(),
  message: text("message").notNull(),
  estimatedDelivery: text("estimated_delivery"),
  portfolioLinks: text("portfolio_links").array(),
  
  status: text("status", { enum: ["pending", "accepted", "rejected", "withdrawn"] }).default("pending").notNull(),
  
  respondedAt: timestamp("responded_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_service_bids_request").on(table.serviceRequestId),
  index("idx_service_bids_musician").on(table.musicianId),
  index("idx_service_bids_status").on(table.status),
]);

// Schemas & Types for service system
export const insertServiceRequestSchema = createInsertSchema(serviceRequests)
  .omit({ id: true, createdAt: true, updatedAt: true, totalBids: true, viewCount: true })
  .extend({
    budgetMin: z.union([z.string(), z.number()]).transform(val => String(val)),
    budgetMax: z.union([z.string(), z.number()]).transform(val => String(val)),
  });
export type InsertServiceRequest = z.infer<typeof insertServiceRequestSchema>;
export type SelectServiceRequest = typeof serviceRequests.$inferSelect;

export const insertServiceBidSchema = createInsertSchema(serviceBids)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    amount: z.union([z.string(), z.number()]).transform(val => String(val)),
  });
export type InsertServiceBid = z.infer<typeof insertServiceBidSchema>;
export type SelectServiceBid = typeof serviceBids.$inferSelect;

export const insertMusicianProfileSchema = createInsertSchema(musicianProfiles)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMusicianProfile = z.infer<typeof insertMusicianProfileSchema>;
export type SelectMusicianProfile = typeof musicianProfiles.$inferSelect;

// ============================================================
// STUDIO — Projects, Versions, Feedback
// ============================================================

/**
 * Studio Projects — production projects with track management
 */
export const studioProjects = pgTable("studio_projects", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Clerk user ID (owner)
  name: text("name").notNull(),
  description: text("description"),
  tracks: json("tracks").$type<string[]>().default([]),
  status: text("status", { enum: ["active", "archived", "completed"] }).default("active").notNull(),
  coverUrl: text("cover_url"),
  genre: text("genre"),
  bpm: integer("bpm"),
  key: text("key"),
  collaboratorIds: json("collaborator_ids").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_studio_projects_user").on(table.userId),
  index("idx_studio_projects_status").on(table.status),
]);

/**
 * Studio Versions — audio track versions with approval workflow
 */
export const studioVersions = pgTable("studio_versions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => studioProjects.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(), // who uploaded
  name: text("name").notNull(), // "Mix v1", "Final Master"
  trackName: text("track_name").notNull(),
  audioUrl: text("audio_url").notNull(), // Firebase Storage URL
  duration: integer("duration"), // seconds
  fileSize: integer("file_size"), // bytes
  format: text("format"), // mp3, wav, flac
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  uploadedByName: text("uploaded_by_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_studio_versions_project").on(table.projectId),
  index("idx_studio_versions_user").on(table.userId),
  index("idx_studio_versions_status").on(table.status),
]);

/**
 * Studio Feedback — comments on versions
 */
export const studioFeedback = pgTable("studio_feedback", {
  id: serial("id").primaryKey(),
  versionId: integer("version_id").notNull().references(() => studioVersions.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  userName: text("user_name"),
  userAvatar: text("user_avatar"),
  content: text("content").notNull(),
  timestamp: decimal("timestamp", { precision: 10, scale: 2 }), // position in audio (seconds) for time-stamped comments
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_studio_feedback_version").on(table.versionId),
  index("idx_studio_feedback_user").on(table.userId),
]);

/**
 * Studio Sessions — live collaboration session logs
 */
export const studioSessions = pgTable("studio_sessions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => studioProjects.id),
  hostUserId: text("host_user_id").notNull(),
  name: text("name").notNull(),
  status: text("status", { enum: ["active", "ended"] }).default("active").notNull(),
  participantCount: integer("participant_count").default(0),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
}, (table) => [
  index("idx_studio_sessions_host").on(table.hostUserId),
  index("idx_studio_sessions_status").on(table.status),
]);

// Zod schemas
export const insertStudioProjectSchema = createInsertSchema(studioProjects)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudioProject = z.infer<typeof insertStudioProjectSchema>;
export type SelectStudioProject = typeof studioProjects.$inferSelect;

export const insertStudioVersionSchema = createInsertSchema(studioVersions)
  .omit({ id: true, createdAt: true });
export type InsertStudioVersion = z.infer<typeof insertStudioVersionSchema>;
export type SelectStudioVersion = typeof studioVersions.$inferSelect;

export const insertStudioFeedbackSchema = createInsertSchema(studioFeedback)
  .omit({ id: true, createdAt: true });
export type InsertStudioFeedback = z.infer<typeof insertStudioFeedbackSchema>;
export type SelectStudioFeedback = typeof studioFeedback.$inferSelect;

// ============================================
// GIG CREDITS SYSTEM (Marketplace Credits — 1 credit = $1)
// ============================================

/** Transaction types for gig credits */
export const gigCreditTransactionTypeEnum = pgEnum("gig_credit_tx_type", [
  "purchase",      // Bought with Stripe
  "application",   // Spent on applying to a gig
  "refund",        // Refunded (e.g., cancelled gig)
  "bonus",         // Free credits (rewards)
  "referral",      // Earned by referring a musician
  "promo",         // Promotional credits
  "commission",    // 20% commission deduction from earnings
]);

export const gigCreditRewardTypeEnum = pgEnum("gig_credit_reward_type", [
  "signup",           // Sign up bonus
  "complete_profile", // Completed profile
  "first_portfolio",  // First portfolio upload
  "referral",         // Referred a musician
  "five_star_review", // Received a 5-star review
  "daily_streak_7",   // 7-day login streak
  "social_share",     // Shared on social media
  "first_gig_complete", // Completed first gig
]);

/** Gig credit balances — userId-based */
export const gigCredits = pgTable("gig_credits", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  balance: integer("balance").default(0).notNull(),
  totalPurchased: integer("total_purchased").default(0).notNull(),
  totalSpent: integer("total_spent").default(0).notNull(),
  totalEarned: integer("total_earned").default(0).notNull(),   // from bonuses/referrals
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Gig credit transaction log */
export const gigCreditTransactions = pgTable("gig_credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  amount: integer("amount").notNull(),  // positive = credit, negative = debit
  type: gigCreditTransactionTypeEnum("type").notNull(),
  description: text("description").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  // Stripe references
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  // Gig references
  serviceRequestId: integer("service_request_id").references(() => serviceRequests.id),
  bidId: integer("bid_id").references(() => serviceBids.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gig_credit_tx_user").on(table.userId),
  index("idx_gig_credit_tx_type").on(table.type),
]);

/** Gig credit packages for Stripe purchase */
export const gigCreditPackages = pgTable("gig_credit_packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  credits: integer("credits").notNull(),
  bonusCredits: integer("bonus_credits").default(0).notNull(),
  priceUsd: decimal("price_usd", { precision: 10, scale: 2 }).notNull(),
  stripePriceId: text("stripe_price_id"),
  isActive: boolean("is_active").default(true).notNull(),
  isFeatured: boolean("is_featured").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Reward tracking — which rewards a user has claimed */
export const gigCreditRewards = pgTable("gig_credit_rewards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  rewardType: gigCreditRewardTypeEnum("reward_type").notNull(),
  creditsAwarded: integer("credits_awarded").notNull(),
  claimedAt: timestamp("claimed_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gig_reward_user").on(table.userId),
]);

// ============================================
// GIG MESSAGING SYSTEM (Service Request DMs)
// ============================================

export const gigMessageStatusEnum = pgEnum("gig_message_status", [
  "sent", "delivered", "read",
]);

/** Direct messages between service request clients and musicians */
export const gigMessages = pgTable("gig_messages", {
  id: serial("id").primaryKey(),
  serviceRequestId: integer("service_request_id").references(() => serviceRequests.id, { onDelete: "cascade" }).notNull(),
  senderId: integer("sender_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  receiverId: integer("receiver_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"),  // "audio", "image", "document"
  status: gigMessageStatusEnum("status").default("sent").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gig_msg_request").on(table.serviceRequestId),
  index("idx_gig_msg_sender").on(table.senderId),
  index("idx_gig_msg_receiver").on(table.receiverId),
]);

/** Automated platform messages (proposals, reminders, promotions) */
export const gigAutoMessages = pgTable("gig_auto_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // "gig_proposal", "deadline_reminder", "credit_promo", "weekly_digest", "welcome", "review_request"
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: json("metadata"),   // { serviceRequestId, credits, etc. }
  read: boolean("read").default(false).notNull(),
  actionUrl: text("action_url"),
  actionLabel: text("action_label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gig_auto_msg_user").on(table.userId),
  index("idx_gig_auto_msg_type").on(table.type),
]);

// ============================================
// GIG ESCROW & COMMISSION (20% platform fee)
// ============================================

export const gigEscrowStatusEnum = pgEnum("gig_escrow_status", [
  "funded", "released", "refunded", "disputed",
]);

/** Escrow for accepted gigs — holds client payment until completion */
export const gigEscrow = pgTable("gig_escrow", {
  id: serial("id").primaryKey(),
  serviceRequestId: integer("service_request_id").references(() => serviceRequests.id).notNull(),
  bidId: integer("bid_id").references(() => serviceBids.id).notNull(),
  clientUserId: integer("client_user_id").references(() => users.id).notNull(),
  musicianUserId: integer("musician_user_id").references(() => users.id).notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(), // 20%
  musicianPayout: decimal("musician_payout", { precision: 10, scale: 2 }).notNull(), // 80%
  status: gigEscrowStatusEnum("status").default("funded").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  releasedAt: timestamp("released_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gig_escrow_request").on(table.serviceRequestId),
  index("idx_gig_escrow_musician").on(table.musicianUserId),
]);

// ============================================
// GIG DELIVERABLES (File Delivery + Stream Protection)
// ============================================

export const gigDeliverableStatusEnum = pgEnum("gig_deliverable_status", [
  "pending",      // Musician hasn't delivered yet
  "delivered",    // Files uploaded (stream-only until paid)
  "revision",     // Client requested revision
  "approved",     // Client approved → payment released
  "disputed",     // Dispute opened
]);

/** Deliverable files for completed gigs — stream-only until approved */
export const gigDeliverables = pgTable("gig_deliverables", {
  id: serial("id").primaryKey(),
  serviceRequestId: integer("service_request_id").references(() => serviceRequests.id, { onDelete: "cascade" }).notNull(),
  bidId: integer("bid_id").references(() => serviceBids.id).notNull(),
  escrowId: integer("escrow_id").references(() => gigEscrow.id),
  musicianUserId: integer("musician_user_id").references(() => users.id).notNull(),
  clientUserId: integer("client_user_id").references(() => users.id).notNull(),
  // File info
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),           // Storage URL (Firebase/S3)
  fileType: text("file_type").notNull(),          // "audio", "video", "document", "project_file"
  fileSizeBytes: integer("file_size_bytes"),
  mimeType: text("mime_type"),
  // Watermarked preview for stream-only
  previewUrl: text("preview_url"),                // Low-quality/watermarked version for streaming
  // Status
  status: gigDeliverableStatusEnum("status").default("delivered").notNull(),
  deliveryNote: text("delivery_note"),            // Musician's message with delivery
  revisionNote: text("revision_note"),            // Client's revision request note
  revisionCount: integer("revision_count").default(0).notNull(),
  maxRevisions: integer("max_revisions").default(2).notNull(),
  // Timestamps
  deliveredAt: timestamp("delivered_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gig_deliverable_request").on(table.serviceRequestId),
  index("idx_gig_deliverable_musician").on(table.musicianUserId),
  index("idx_gig_deliverable_client").on(table.clientUserId),
]);

// ============================================
// GIG DISPUTES
// ============================================

export const gigDisputeStatusEnum = pgEnum("gig_dispute_status", [
  "open", "under_review", "resolved_client", "resolved_musician", "closed",
]);

export const gigDisputes = pgTable("gig_disputes", {
  id: serial("id").primaryKey(),
  serviceRequestId: integer("service_request_id").references(() => serviceRequests.id).notNull(),
  escrowId: integer("escrow_id").references(() => gigEscrow.id).notNull(),
  openedByUserId: integer("opened_by_user_id").references(() => users.id).notNull(),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  evidence: json("evidence"),   // { urls: string[], notes: string }
  resolution: text("resolution"),
  status: gigDisputeStatusEnum("status").default("open").notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gig_dispute_request").on(table.serviceRequestId),
  index("idx_gig_dispute_escrow").on(table.escrowId),
]);

/**
 * Platform Configuration — Admin-controlled global settings
 * Single-row table for platform-wide config (e.g. default style preset)
 */
export const platformConfig = pgTable("platform_config", {
  id: serial("id").primaryKey(),
  key: text("key").unique().notNull(),
  value: json("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

// ============================================================
// PUBLISHING & SYNC LICENSING SYSTEM
// ============================================================

/**
 * Publishing Briefs — Music brief requests from industry companies
 * Companies post what they need; artists can submit tracks
 */
export const publishingBriefs = pgTable("publishing_briefs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Brief Info
  title: text("title").notNull(),
  description: text("description").notNull(),
  projectType: text("project_type", {
    enum: ["tv_series", "film", "commercial", "video_game", "trailer", "podcast", "social_media", "corporate", "other"]
  }).notNull(),
  genres: json("genres").$type<string[]>().default([]),
  moods: json("moods").$type<string[]>().default([]),
  tempo: text("tempo"), // slow, medium, fast, any
  vocalPreference: text("vocal_preference"), // instrumental, vocal, both
  referenceLinks: json("reference_links").$type<string[]>().default([]),
  budgetMin: integer("budget_min"),
  budgetMax: integer("budget_max"),
  currency: text("currency").default("USD"),
  deadline: timestamp("deadline"),
  exclusivity: text("exclusivity", { enum: ["exclusive", "non_exclusive", "negotiable"] }).default("negotiable"),
  territory: text("territory").default("worldwide"),
  usageDuration: text("usage_duration"), // 1 year, 3 years, perpetual

  // Status
  status: text("status", {
    enum: ["draft", "active", "paused", "filled", "expired", "cancelled"]
  }).default("draft").notNull(),

  // Stats
  totalSubmissions: integer("total_submissions").default(0),
  viewCount: integer("view_count").default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pub_briefs_user").on(table.userId),
  index("idx_pub_briefs_status").on(table.status),
  index("idx_pub_briefs_type").on(table.projectType),
]);

/**
 * Publishing Submissions — Artist track submissions to briefs or direct to companies
 */
export const publishingSubmissions = pgTable("publishing_submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  briefId: integer("brief_id").references(() => publishingBriefs.id, { onDelete: "set null" }),
  contactId: integer("contact_id").references(() => musicIndustryContacts.id, { onDelete: "set null" }),

  // Track Info
  trackTitle: text("track_title").notNull(),
  artistName: text("artist_name").notNull(),
  genre: text("genre"),
  duration: text("duration"),
  bpm: integer("bpm"),
  trackUrl: text("track_url"), // Audio file or streaming link
  previewUrl: text("preview_url"),
  lyrics: text("lyrics"),
  isrc: text("isrc"),
  coverArtUrl: text("cover_art_url"),

  // Pitch Info
  pitchNote: text("pitch_note"),
  suggestedFee: integer("suggested_fee"),
  exclusivityOffer: text("exclusivity_offer", { enum: ["exclusive", "non_exclusive", "negotiable"] }).default("negotiable"),

  // Status Pipeline
  status: text("status", {
    enum: ["draft", "submitted", "under_review", "shortlisted", "accepted", "rejected", "deal_in_progress", "licensed", "withdrawn"]
  }).default("draft").notNull(),

  // Tracking
  reviewedAt: timestamp("reviewed_at"),
  reviewerNotes: text("reviewer_notes"),
  feedbackSentAt: timestamp("feedback_sent_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pub_sub_user").on(table.userId),
  index("idx_pub_sub_brief").on(table.briefId),
  index("idx_pub_sub_contact").on(table.contactId),
  index("idx_pub_sub_status").on(table.status),
]);

/**
 * Publishing Deals — Finalized sync/publishing deals with financial terms
 */
export const publishingDeals = pgTable("publishing_deals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  submissionId: integer("submission_id").references(() => publishingSubmissions.id, { onDelete: "set null" }),
  contactId: integer("contact_id").references(() => musicIndustryContacts.id, { onDelete: "set null" }),
  briefId: integer("brief_id").references(() => publishingBriefs.id, { onDelete: "set null" }),

  // Deal Info
  dealType: text("deal_type", {
    enum: ["sync_license", "master_license", "publishing_admin", "co_publishing", "sub_publishing", "blanket_license", "micro_license"]
  }).notNull(),
  title: text("title").notNull(),
  trackTitle: text("track_title").notNull(),
  artistName: text("artist_name").notNull(),
  projectName: text("project_name"),
  companyName: text("company_name"),

  // Financial
  dealAmount: integer("deal_amount"),
  currency: text("currency").default("USD"),
  platformFee: integer("platform_fee"), // 15% default
  artistEarning: integer("artist_earning"), // 85%
  royaltyPercentage: real("royalty_percentage"),
  advanceAmount: integer("advance_amount"),
  paymentStatus: text("payment_status", {
    enum: ["pending", "invoiced", "partial", "paid", "overdue"]
  }).default("pending"),

  // Contract
  exclusivity: text("exclusivity", { enum: ["exclusive", "non_exclusive"] }),
  territory: text("territory").default("worldwide"),
  usageDuration: text("usage_duration"),
  contractTerms: text("contract_terms"),
  contractSignedAt: timestamp("contract_signed_at"),

  // Status
  status: text("status", {
    enum: ["proposed", "negotiating", "contract_sent", "contract_signed", "active", "completed", "cancelled", "disputed"]
  }).default("proposed").notNull(),

  // Dates
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pub_deal_user").on(table.userId),
  index("idx_pub_deal_status").on(table.status),
  index("idx_pub_deal_type").on(table.dealType),
]);

/**
 * Publishing Messages — Communication thread between artist and company
 */
export const publishingMessages = pgTable("publishing_messages", {
  id: serial("id").primaryKey(),
  dealId: integer("deal_id").references(() => publishingDeals.id, { onDelete: "cascade" }),
  submissionId: integer("submission_id").references(() => publishingSubmissions.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  contactId: integer("contact_id").references(() => musicIndustryContacts.id, { onDelete: "set null" }),

  direction: text("direction", { enum: ["outbound", "inbound"] }).notNull(),
  channel: text("channel", { enum: ["email", "platform", "external"] }).default("platform"),
  subject: text("subject"),
  body: text("body").notNull(),
  attachments: json("attachments").$type<string[]>().default([]),

  sentAt: timestamp("sent_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
  brevoMessageId: text("brevo_message_id"),
}, (table) => [
  index("idx_pub_msg_deal").on(table.dealId),
  index("idx_pub_msg_sub").on(table.submissionId),
  index("idx_pub_msg_user").on(table.userId),
]);

// ================================================================
// BOOSTIFY NEWS — Auto-generated daily articles about innovations
// ================================================================

/**
 * News Articles — AI-generated articles about Boostify tech & innovations
 */
export const newsArticles = pgTable("news_articles", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  summary: text("summary"),
  htmlContent: text("html_content").notNull(),
  coverImageUrl: text("cover_image_url"),
  coverImagePrompt: text("cover_image_prompt"),
  imageProvider: text("image_provider", { enum: ["openai", "fal", "fallback"] }),
  category: text("category", { enum: [
    "technology", "innovation", "autonomous-artists", "web3",
    "ai-music", "platform-updates", "industry-vision", "partnerships",
    "artist-news"
  ] }).default("technology"),
  tags: text("tags").array(),
  readTimeMinutes: integer("read_time_minutes").default(5),
  status: text("status", { enum: ["draft", "published", "scheduled", "archived"] }).default("draft"),
  publishedAt: timestamp("published_at"),
  scheduledFor: timestamp("scheduled_for"),
  generatedBy: text("generated_by").default("ai-engine"),
  aiModel: text("ai_model"),
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  shares: integer("shares").default(0),
  // Auto-publish tracking
  publishedToSocial: boolean("published_to_social").default(false),
  socialPostIds: json("social_post_ids").$type<Record<string, string>>(),
  publishedToExtension: boolean("published_to_extension").default(false),
  extensionActionId: integer("extension_action_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_news_status").on(table.status),
  index("idx_news_category").on(table.category),
  index("idx_news_published_at").on(table.publishedAt),
  index("idx_news_slug").on(table.slug),
]);

export type InsertNewsArticle = typeof newsArticles.$inferInsert;
export type SelectNewsArticle = typeof newsArticles.$inferSelect;

/**
 * News Generation Log — Track daily generation runs
 */
export const newsGenerationLogs = pgTable("news_generation_logs", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").references(() => newsArticles.id, { onDelete: "set null" }),
  topic: text("topic").notNull(),
  prompt: text("prompt"),
  textModel: text("text_model"),
  imageModel: text("image_model"),
  textTokensUsed: integer("text_tokens_used"),
  imageCost: decimal("image_cost", { precision: 10, scale: 4 }),
  success: boolean("success").default(true),
  errorMessage: text("error_message"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
});

// ═══════════════════════════════════════════════════════════════
// SECURITY — Audit Log
// ═══════════════════════════════════════════════════════════════

/**
 * Audit Log — Tracks security-relevant actions (admin ops, auth events, data changes)
 */
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 128 }).notNull(),       // e.g. "admin.user_role_changed", "auth.login_failed"
  actorId: integer("actor_id"),                                // user who performed the action
  actorEmail: varchar("actor_email", { length: 256 }),
  targetType: varchar("target_type", { length: 64 }),          // e.g. "user", "song", "payment"
  targetId: varchar("target_id", { length: 256 }),
  details: json("details"),                                     // any extra context {before, after, reason}
  ip: varchar("ip", { length: 45 }),
  userAgent: varchar("user_agent", { length: 512 }),
  severity: varchar("severity", { length: 16 }).default("info"), // info, warn, error, critical
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audit_action").on(table.action),
  index("idx_audit_actor").on(table.actorEmail),
  index("idx_audit_created").on(table.createdAt),
]);

export type InsertAuditLog = typeof auditLog.$inferInsert;
export type SelectAuditLog = typeof auditLog.$inferSelect;

// ═══════════════════════════════════════════════════════════════
// NEWSLETTER — Outreach Send Log
// ═══════════════════════════════════════════════════════════════

/**
 * Newsletter Outreach Log — Tracks which industry contacts have received newsletters
 * Prevents duplicate sends and allows daily rotation of 20 new contacts
 */
export const newsletterOutreachLog = pgTable("newsletter_outreach_log", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  company: text("company"),
  jobTitle: text("job_title"),
  articleId: integer("article_id").references(() => newsArticles.id, { onDelete: "set null" }),
  articleTitle: text("article_title"),
  status: varchar("status", { length: 32 }).default("sent"),  // sent | failed | bounced
  provider: varchar("provider", { length: 32 }),               // resend | sendgrid | brevo
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}, (table) => [
  index("idx_outreach_email").on(table.email),
  index("idx_outreach_article").on(table.articleId),
  index("idx_outreach_sent_at").on(table.sentAt),
]);

export type InsertNewsletterOutreachLog = typeof newsletterOutreachLog.$inferInsert;
export type SelectNewsletterOutreachLog = typeof newsletterOutreachLog.$inferSelect;

// ═══════════════════════════════════════════════════════════════
// INFLUENCER BRAND COLLABORATIONS — Artist × Brand Content Module
// ═══════════════════════════════════════════════════════════════

/**
 * Brand Database — Companies that want influencer/artist content
 * Can be imported in bulk (CSV/API) or added manually
 */
export const brandProfiles = pgTable("brand_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  logo: text("logo"),                    // Logo URL
  website: text("website"),
  industry: text("industry", { enum: [
    "fashion", "tech", "food_beverage", "fitness", "beauty", "automotive",
    "entertainment", "travel", "finance", "education", "health", "sports",
    "gaming", "luxury", "sustainability", "crypto", "music", "lifestyle", "other"
  ] }).default("other").notNull(),
  description: text("description"),
  contactEmail: text("contact_email"),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  instagramHandle: text("instagram_handle"),
  tiktokHandle: text("tiktok_handle"),
  followerCount: integer("follower_count").default(0),
  estimatedBudget: text("estimated_budget", { enum: ["low", "medium", "high", "enterprise"] }).default("medium"),
  // Product catalog summary
  productCategories: json("product_categories").$type<string[]>(),
  heroProductUrl: text("hero_product_url"),        // Main product image
  heroProductName: text("hero_product_name"),
  isVerified: boolean("is_verified").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  addedByUserId: integer("added_by_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_brand_industry").on(table.industry),
  index("idx_brand_slug").on(table.slug),
]);

/**
 * Brand Products — Individual products uploaded by brands for content creation
 */
export const brandProducts = pgTable("brand_products", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandProfiles.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url").notNull(),           // Product photo (uploaded by brand)
  price: decimal("price", { precision: 10, scale: 2 }),
  category: text("category"),                      // e.g., "sneakers", "energy drink", "headphones"
  productUrl: text("product_url"),                 // Link to buy
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Influencer Packages — Pricing tiers for brand × artist content
 * From $300 (basic) to $3000 (premium viral campaign)
 */
export const influencerPackages = pgTable("influencer_packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  tier: text("tier", { enum: ["starter", "growth", "premium", "enterprise"] }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  features: json("features").$type<string[]>().notNull(),
  // Deliverables
  promoImages: integer("promo_images").default(0).notNull(),     // # of AI promo images
  promoVideos: integer("promo_videos").default(0).notNull(),     // # of AI promo videos
  socialPosts: integer("social_posts").default(0).notNull(),     // # of social media posts
  storyMentions: integer("story_mentions").default(0).notNull(), // # of story mentions
  songMention: boolean("song_mention").default(false).notNull(), // Product mention in song
  dedicatedSong: boolean("dedicated_song").default(false).notNull(), // Full brand song
  exclusivityDays: integer("exclusivity_days").default(0).notNull(), // Days of exclusivity
  revisionRounds: integer("revision_rounds").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Brand Campaigns — A brand books an artist for content creation
 * Tracks the full lifecycle: proposal → accepted → content creation → delivery → paid
 */
export const brandCampaigns = pgTable("brand_campaigns", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => brandProfiles.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  packageId: integer("package_id").references(() => influencerPackages.id, { onDelete: "set null" }),
  // Campaign details
  title: text("title").notNull(),
  brief: text("brief"),                            // Brand brief / creative direction
  productIds: json("product_ids").$type<number[]>(), // Selected products for content
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).default("0"), // 15% platform cut
  artistEarning: decimal("artist_earning", { precision: 10, scale: 2 }).default("0"),
  currency: text("currency").default("usd").notNull(),
  // Status flow
  status: text("status", { enum: [
    "proposal", "negotiating", "accepted", "content_creation",
    "review", "revision", "approved", "delivered",
    "payment_pending", "paid", "completed", "cancelled", "expired"
  ] }).default("proposal").notNull(),
  // Payment
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripePaymentUrl: text("stripe_payment_url"),
  paidAt: timestamp("paid_at"),
  // Dates
  startDate: timestamp("start_date"),
  deadline: timestamp("deadline"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_campaign_brand").on(table.brandId),
  index("idx_campaign_artist").on(table.artistId),
  index("idx_campaign_status").on(table.status),
]);

/**
 * Campaign Content — Generated content pieces for a brand campaign
 * Each piece is an AI-generated image or video of the artist with the brand's product
 */
export const campaignContent = pgTable("campaign_content", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => brandCampaigns.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => brandProducts.id, { onDelete: "set null" }),
  type: text("type", { enum: ["promo_image", "promo_video", "social_post", "story", "song_mention"] }).notNull(),
  // Generated content
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  caption: text("caption"),                        // AI-generated caption
  hashtags: json("hashtags").$type<string[]>(),
  // AI generation metadata
  aiModel: text("ai_model"),                       // gpt-image-1.5, grok-imagine, nano-banana-2, etc.
  prompt: text("prompt"),
  // Status
  status: text("status", { enum: ["generating", "ready", "approved", "rejected", "published"] }).default("generating").notNull(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Brand Messages — Real-time messaging between brands and artists during campaigns
 */
export const brandMessages = pgTable("brand_messages", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => brandCampaigns.id, { onDelete: "cascade" }).notNull(),
  senderType: text("sender_type", { enum: ["brand", "artist", "system"] }).notNull(),
  senderUserId: integer("sender_user_id").references(() => users.id, { onDelete: "set null" }),
  message: text("message").notNull(),
  attachmentUrl: text("attachment_url"),        // Image/file attachment
  attachmentType: text("attachment_type", { enum: ["image", "video", "file", "audio"] }),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_brand_msg_campaign").on(table.campaignId),
]);

/**
 * Campaign Songs — AI-generated brand jingles/songs for product promotion
 */
export const campaignSongs = pgTable("campaign_songs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").references(() => brandCampaigns.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  audioUrl: text("audio_url"),                  // Generated music URL
  lyrics: text("lyrics"),                       // Generated lyrics
  genre: text("genre").default("pop"),
  mood: text("mood").default("upbeat"),
  duration: integer("duration"),                 // Duration in seconds
  aiModel: text("ai_model"),                    // lyria-3, minimax, etc.
  prompt: text("prompt"),
  status: text("status", { enum: ["generating", "ready", "approved", "rejected"] }).default("generating").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Types
export type InsertBrandProfile = typeof brandProfiles.$inferInsert;
export type SelectBrandProfile = typeof brandProfiles.$inferSelect;
export type InsertBrandProduct = typeof brandProducts.$inferInsert;
export type SelectBrandProduct = typeof brandProducts.$inferSelect;
export type InsertInfluencerPackage = typeof influencerPackages.$inferInsert;
export type SelectInfluencerPackage = typeof influencerPackages.$inferSelect;
export type InsertBrandCampaign = typeof brandCampaigns.$inferInsert;
export type SelectBrandCampaign = typeof brandCampaigns.$inferSelect;
export type InsertCampaignContent = typeof campaignContent.$inferInsert;
export type SelectCampaignContent = typeof campaignContent.$inferSelect;
export type InsertBrandMessage = typeof brandMessages.$inferInsert;
export type SelectBrandMessage = typeof brandMessages.$inferSelect;
export type InsertCampaignSong = typeof campaignSongs.$inferInsert;
export type SelectCampaignSong = typeof campaignSongs.$inferSelect;

// ============================================
// ECONOMIC ENGINE SYSTEM — Layer 3 (Hidden Motor)
// Autonomous financial management with 4 DeFi agents
// ============================================

export const operatingModeEnum = pgEnum("operating_mode", [
  "survival", "stable", "expansion", "aggressive", "defense"
]);

export const riskToleranceEnum = pgEnum("risk_tolerance", [
  "conservative", "moderate", "aggressive"
]);

export const defiAgentEnum = pgEnum("defi_agent_type", [
  "capital_keeper", "flow_maker", "alpha_hunter", "shield_node", "market_hunter"
]);

export const vaultBucketEnum = pgEnum("vault_bucket", [
  "operation", "reserve", "growth", "defi", "boostify_fee"
]);

/**
 * Economic Engine Global Config — Master toggle + platform-wide settings (admin only)
 */
export const economicEngineConfig = pgTable("economic_engine_config", {
  id: serial("id").primaryKey(),
  isGloballyEnabled: boolean("is_globally_enabled").default(false).notNull(),
  defaultDistribution: json("default_distribution").$type<{
    operation: number;
    reserve: number;
    growth: number;
    defi: number;
    boostifyFee: number;
  }>().default({ operation: 35, reserve: 20, growth: 20, defi: 20, boostifyFee: 5 }),
  defaultDefiSplit: json("default_defi_split").$type<{
    capitalKeeper: number;
    flowMaker: number;
    alphaHunter: number;
    shieldNode: number;
  }>().default({ capitalKeeper: 40, flowMaker: 30, alphaHunter: 10, shieldNode: 20 }),
  profitCascade: json("profit_cascade").$type<{
    reserve: number;
    growth: number;
    reinvestDefi: number;
    performanceFee: number;
  }>().default({ reserve: 40, growth: 30, reinvestDefi: 20, performanceFee: 10 }),
  platformFeeRate: decimal("platform_fee_rate", { precision: 5, scale: 4 }).default("0.0500"),
  performanceFeeRate: decimal("performance_fee_rate", { precision: 5, scale: 4 }).default("0.1000"),
  minReserveMonths: integer("min_reserve_months").default(3),
  maxDrawdownPct: decimal("max_drawdown_pct", { precision: 5, scale: 2 }).default("15.00"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
});

/**
 * Artist Economic Profile — Per-artist toggle + config (admin activates)
 */
export const artistEconomicProfile = pgTable("artist_economic_profile", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  isEnabled: boolean("is_enabled").default(false).notNull(),
  enabledBy: integer("enabled_by").references(() => users.id),
  enabledAt: timestamp("enabled_at"),
  operatingMode: operatingModeEnum("operating_mode").default("stable").notNull(),
  distributionMatrix: json("distribution_matrix").$type<{
    operation: number;
    reserve: number;
    growth: number;
    defi: number;
    boostifyFee: number;
  }>(),
  defiSplit: json("defi_split").$type<{
    capitalKeeper: number;
    flowMaker: number;
    alphaHunter: number;
    shieldNode: number;
  }>(),
  defiEnabled: boolean("defi_enabled").default(true).notNull(),
  // Day Trading layer (Market Hunter agent) — opt-in, off by default. Adds
  // a 5th autonomous agent that takes directional momentum/mean-reversion
  // trades on MATIC/ETH/BTC pairs with strict stop-losses.
  dayTradingEnabled: boolean("day_trading_enabled").default(false).notNull(),
  // CEX Trading layer — opt-in. Enables funding-rate arbitrage via the artist's
  // own exchange API keys (Bybit/OKX/Kraken/Bitget). Requires cex_exchange_keys.
  cexTradingEnabled: boolean("cex_trading_enabled").default(false).notNull(),
  maxDefiExposure: decimal("max_defi_exposure", { precision: 12, scale: 2 }).default("10000.00"),
  riskTolerance: riskToleranceEnum("risk_tolerance").default("moderate").notNull(),
  autoRebalance: boolean("auto_rebalance").default(true).notNull(),
  monthlyOperatingCost: decimal("monthly_operating_cost", { precision: 12, scale: 2 }).default("0.00"),
  lastCycleAt: timestamp("last_cycle_at"),
  lastAuditAt: timestamp("last_audit_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_artist_eco_profile_artist").on(table.artistId),
  index("idx_artist_eco_profile_enabled").on(table.isEnabled),
]);

/**
 * Artist Treasury Vault — Central financial vault with 5 buckets
 */
export const artistTreasuryVault = pgTable("artist_treasury_vault", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  operationBalance: decimal("operation_balance", { precision: 14, scale: 2 }).default("0.00").notNull(),
  reserveBalance: decimal("reserve_balance", { precision: 14, scale: 2 }).default("0.00").notNull(),
  growthBalance: decimal("growth_balance", { precision: 14, scale: 2 }).default("0.00").notNull(),
  defiBalance: decimal("defi_balance", { precision: 14, scale: 2 }).default("0.00").notNull(),
  boostifyFeeBalance: decimal("boostify_fee_balance", { precision: 14, scale: 2 }).default("0.00").notNull(),
  totalDeposited: decimal("total_deposited", { precision: 14, scale: 2 }).default("0.00").notNull(),
  totalDefiProfit: decimal("total_defi_profit", { precision: 14, scale: 2 }).default("0.00").notNull(),
  totalDefiLoss: decimal("total_defi_loss", { precision: 14, scale: 2 }).default("0.00").notNull(),
  peakDefiValue: decimal("peak_defi_value", { precision: 14, scale: 2 }).default("0.00").notNull(),
  currentDrawdown: decimal("current_drawdown", { precision: 5, scale: 2 }).default("0.00").notNull(),
  lastRebalancedAt: timestamp("last_rebalanced_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_treasury_vault_artist").on(table.artistId),
]);

/**
 * Treasury Transactions — Every movement into/between/out of vault buckets
 */
export const treasuryTransactions = pgTable("treasury_transactions", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  transactionType: text("transaction_type", {
    enum: ["income_deposit", "bucket_distribution", "defi_allocation", "defi_profit", "defi_loss",
           "profit_cascade", "rebalance", "emergency_withdrawal", "fee_collection", "manual_adjustment"]
  }).notNull(),
  fromBucket: vaultBucketEnum("from_bucket"),
  toBucket: vaultBucketEnum("to_bucket"),
  amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
  balanceBefore: json("balance_before").$type<Record<string, string>>(),
  balanceAfter: json("balance_after").$type<Record<string, string>>(),
  description: text("description"),
  triggeredBy: text("triggered_by", { enum: ["system", "admin", "economic_brain", "risk_engine", "agent"] }).default("system"),
  relatedAgentType: defiAgentEnum("related_agent_type"),
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_treasury_tx_artist").on(table.artistId),
  index("idx_treasury_tx_type").on(table.transactionType),
  index("idx_treasury_tx_date").on(table.createdAt),
]);

/**
 * DeFi Positions — Active positions managed by the 4 DeFi agents
 */
export const defiPositions = pgTable("defi_positions", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentType: defiAgentEnum("agent_type").notNull(),
  positionType: text("position_type", {
    enum: ["stablecoin_parking", "lending", "liquidity_pool", "yield_farm",
           "arbitrage", "flash_loan", "hedge", "insurance"]
  }).notNull(),
  protocol: text("protocol"),                    // e.g. "Aave", "Uniswap", "Compound"
  asset: text("asset"),                          // e.g. "USDC", "ETH/USDC LP"
  amountInvested: decimal("amount_invested", { precision: 14, scale: 2 }).notNull(),
  currentValue: decimal("current_value", { precision: 14, scale: 2 }).notNull(),
  unrealizedPnl: decimal("unrealized_pnl", { precision: 14, scale: 2 }).default("0.00"),
  apy: decimal("apy", { precision: 8, scale: 4 }),
  riskScore: integer("risk_score"),              // 1-100
  status: text("status", { enum: ["active", "closing", "closed", "liquidated", "frozen"] }).default("active").notNull(),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  metadata: json("metadata").$type<Record<string, any>>(),
}, (table) => [
  index("idx_defi_pos_artist").on(table.artistId),
  index("idx_defi_pos_agent").on(table.agentType),
  index("idx_defi_pos_status").on(table.status),
]);

/**
 * DeFi Agent Actions — Log of every decision/action by the 4 DeFi agents
 */
export const defiAgentActions = pgTable("defi_agent_actions", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentType: defiAgentEnum("agent_type").notNull(),
  actionType: text("action_type", {
    enum: ["open_position", "close_position", "rebalance", "take_profit", "stop_loss",
           "increase_position", "decrease_position", "hedge", "circuit_break", "audit",
           "yield_harvest", "compound", "emergency_exit"]
  }).notNull(),
  positionId: integer("position_id").references(() => defiPositions.id),
  amount: decimal("amount", { precision: 14, scale: 2 }),
  reason: text("reason"),
  riskAssessment: json("risk_assessment").$type<{
    riskLevel: string;
    drawdownPct: number;
    exposurePct: number;
    recommendation: string;
  }>(),
  outcome: text("outcome", { enum: ["success", "failed", "pending", "vetoed"] }).default("pending"),
  vetoedBy: text("vetoed_by"),                   // "shield_node" or "admin"
  metadata: json("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_defi_action_artist").on(table.artistId),
  index("idx_defi_action_agent").on(table.agentType),
  index("idx_defi_action_date").on(table.createdAt),
]);

/**
 * Risk Engine State — Current operating mode + evaluation history
 */
export const riskEngineState = pgTable("risk_engine_state", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  currentMode: operatingModeEnum("current_mode").default("stable").notNull(),
  previousMode: operatingModeEnum("previous_mode"),
  modeChangedAt: timestamp("mode_changed_at"),
  modeChangeReason: text("mode_change_reason"),
  survivalScore: decimal("survival_score", { precision: 5, scale: 2 }),       // 0-100
  healthScore: decimal("health_score", { precision: 5, scale: 2 }),           // 0-100
  reserveMonths: decimal("reserve_months", { precision: 5, scale: 1 }),       // months of runway
  totalExposure: decimal("total_exposure", { precision: 14, scale: 2 }).default("0.00"),
  maxDrawdownHit: decimal("max_drawdown_hit", { precision: 5, scale: 2 }).default("0.00"),
  shieldVetoActive: boolean("shield_veto_active").default(false).notNull(),
  shieldVetoReason: text("shield_veto_reason"),
  lastEvaluationAt: timestamp("last_evaluation_at"),
  evaluationData: json("evaluation_data").$type<{
    incomeVsCosts: number;
    reserveAdequacy: string;
    defiPerformance: number;
    audienceGrowth: number;
    marketCondition: string;
  }>(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_risk_state_artist").on(table.artistId),
]);

/**
 * Economic Engine Audit Log — Every admin action + system event
 */
export const economicEngineAuditLog = pgTable("economic_engine_audit_log", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id),
  actorId: integer("actor_id").references(() => users.id),                   // admin who did it
  actorType: text("actor_type", { enum: ["admin", "system", "economic_brain", "shield_node", "risk_engine"] }).notNull(),
  action: text("action", {
    enum: ["engine_enabled", "engine_disabled", "mode_changed", "distribution_updated",
           "defi_toggled", "risk_override", "shield_veto", "shield_veto_cleared",
           "emergency_freeze", "manual_rebalance", "config_updated", "cycle_executed",
           "profit_cascaded", "global_toggle"]
  }).notNull(),
  previousState: json("previous_state").$type<Record<string, any>>(),
  newState: json("new_state").$type<Record<string, any>>(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_eco_audit_artist").on(table.artistId),
  index("idx_eco_audit_date").on(table.createdAt),
]);

// Economic Engine Types
export type InsertEconomicEngineConfig = typeof economicEngineConfig.$inferInsert;
export type SelectEconomicEngineConfig = typeof economicEngineConfig.$inferSelect;
export type InsertArtistEconomicProfile = typeof artistEconomicProfile.$inferInsert;
export type SelectArtistEconomicProfile = typeof artistEconomicProfile.$inferSelect;
export type InsertArtistTreasuryVault = typeof artistTreasuryVault.$inferInsert;
export type SelectArtistTreasuryVault = typeof artistTreasuryVault.$inferSelect;
export type InsertTreasuryTransaction = typeof treasuryTransactions.$inferInsert;
export type SelectTreasuryTransaction = typeof treasuryTransactions.$inferSelect;
export type InsertDefiPosition = typeof defiPositions.$inferInsert;
export type SelectDefiPosition = typeof defiPositions.$inferSelect;
export type InsertDefiAgentAction = typeof defiAgentActions.$inferInsert;
export type SelectDefiAgentAction = typeof defiAgentActions.$inferSelect;
export type InsertRiskEngineState = typeof riskEngineState.$inferInsert;
export type SelectRiskEngineState = typeof riskEngineState.$inferSelect;
export type InsertEconomicEngineAuditLog = typeof economicEngineAuditLog.$inferInsert;
export type SelectEconomicEngineAuditLog = typeof economicEngineAuditLog.$inferSelect;

// ═══════════════════════════════════════════════════════════════
// NEWS INTERACTIONS — Comments, Reactions & Debates
// ═══════════════════════════════════════════════════════════════

/**
 * News Comments — Threaded discussions on news articles
 */
export const newsComments = pgTable("news_comments", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").references(() => newsArticles.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  parentId: integer("parent_id"), // Self-ref for threading (references own table)
  content: text("content").notNull(),
  likes: integer("likes").default(0),
  isEdited: boolean("is_edited").default(false),
  isPinned: boolean("is_pinned").default(false),
  status: text("status", { enum: ["active", "hidden", "flagged"] }).default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_news_comments_article").on(table.articleId),
  index("idx_news_comments_user").on(table.userId),
  index("idx_news_comments_parent").on(table.parentId),
]);

/**
 * News Comment Likes — Track who liked which comment
 */
export const newsCommentLikes = pgTable("news_comment_likes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").references(() => newsComments.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ncl_comment").on(table.commentId),
  index("idx_ncl_user").on(table.userId),
]);

/**
 * News Reactions — Emoji reactions on articles (🔥 💡 🎵 👏 🚀)
 */
export const newsReactions = pgTable("news_reactions", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").references(() => newsArticles.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  reaction: text("reaction", { enum: ["fire", "lightbulb", "music", "clap", "rocket"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_news_reactions_article").on(table.articleId),
  index("idx_news_reactions_user").on(table.userId),
]);

/**
 * News Debates — Structured debates on articles with pro/con positions
 */
export const newsDebates = pgTable("news_debates", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").references(() => newsArticles.id, { onDelete: "cascade" }).notNull(),
  topic: text("topic").notNull(),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  status: text("status", { enum: ["open", "closed", "archived"] }).default("open"),
  participantCount: integer("participant_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closesAt: timestamp("closes_at"),
}, (table) => [
  index("idx_news_debates_article").on(table.articleId),
  index("idx_news_debates_status").on(table.status),
]);

/**
 * News Debate Positions — Individual arguments in a debate
 */
export const newsDebatePositions = pgTable("news_debate_positions", {
  id: serial("id").primaryKey(),
  debateId: integer("debate_id").references(() => newsDebates.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  stance: text("stance", { enum: ["pro", "con"] }).notNull(),
  argument: text("argument").notNull(),
  votes: integer("votes").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ndp_debate").on(table.debateId),
  index("idx_ndp_user").on(table.userId),
]);

/**
 * News Debate Votes — Track who voted on which position
 */
export const newsDebateVotes = pgTable("news_debate_votes", {
  id: serial("id").primaryKey(),
  positionId: integer("position_id").references(() => newsDebatePositions.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ndv_position").on(table.positionId),
  index("idx_ndv_user").on(table.userId),
]);

// News Interaction Types
export type InsertNewsComment = typeof newsComments.$inferInsert;
export type SelectNewsComment = typeof newsComments.$inferSelect;
export type InsertNewsReaction = typeof newsReactions.$inferInsert;
export type SelectNewsReaction = typeof newsReactions.$inferSelect;
export type InsertNewsDebate = typeof newsDebates.$inferInsert;
export type SelectNewsDebate = typeof newsDebates.$inferSelect;
export type InsertNewsDebatePosition = typeof newsDebatePositions.$inferInsert;
export type SelectNewsDebatePosition = typeof newsDebatePositions.$inferSelect;

// ─── Artist Enrichment Agent ───────────────────────────────────────────────

export const artistEnrichmentStatusEnum = pgEnum("artist_enrichment_status", [
  "pending", "processing", "completed", "failed", "skipped"
]);

/**
 * Artist Enrichment Queue — tracks enrichment jobs for new artists
 */
export const artistEnrichmentQueue = pgTable("artist_enrichment_queue", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  status: text("status", { enum: ["pending", "processing", "completed", "failed", "skipped"] }).default("pending").notNull(),
  priority: integer("priority").default(50).notNull(), // 1-100, higher = more important
  source: text("source", { enum: ["signup", "discovery", "manual", "import"] }).default("discovery").notNull(),

  // Scraped raw data from all sources
  rawData: json("raw_data").$type<{
    spotify?: { id: string; name: string; genres: string[]; followers: number; popularity: number; imageUrl?: string; topTracks?: Array<{ name: string; popularity: number }> };
    instagram?: { username: string; fullName: string; biography: string; followersCount: number; postsCount: number; profilePicUrl: string; isVerified: boolean; engagementRate?: number; topPosts?: Array<{ displayUrl: string; likesCount: number; caption: string }> };
    youtube?: { channelId: string; channelName: string; subscribers: number; totalViews: number; videoCount: number; thumbnailUrl?: string };
    google?: Array<{ title: string; url: string; description: string }>;
    website?: { url: string; title: string; bio?: string; socialLinks?: Record<string, string>; photos?: string[] };
  }>(),

  // GPT-analyzed structured profile
  analyzedData: json("analyzed_data").$type<{
    verifiedName: string;
    verifiedGenres: string[];
    biography: string;
    socialLinks: { instagram?: string; youtube?: string; spotify?: string; tiktok?: string; website?: string; facebook?: string };
    bestPhotoUrl?: string;
    photoUrls: string[];
    careerStage?: string;
    dataConfidence: number; // 0-100
    crossReferenceNotes: string;
  }>(),

  dataCompletenessScore: integer("data_completeness_score").default(0), // 0-100
  sourcesChecked: text("sources_checked").array(), // ['spotify','instagram','youtube','google']
  sourcesFound: text("sources_found").array(), // which sources returned data

  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  errorLog: text("error_log"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_aeq_artist").on(table.artistId),
  index("idx_aeq_status").on(table.status),
  index("idx_aeq_priority").on(table.priority),
]);

/**
 * Artist Enrichment Log — audit trail of all enrichment actions
 */
export const artistEnrichmentLog = pgTable("artist_enrichment_log", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  queueId: integer("queue_id").references(() => artistEnrichmentQueue.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'spotify_found', 'ig_scraped', 'bio_generated', 'image_generated', etc.
  source: text("source"), // 'spotify', 'instagram', 'youtube', 'google', 'gpt', 'gemini', 'fal'
  data: json("data"), // action-specific payload
  tokensUsed: integer("tokens_used").default(0),
  costUsd: decimal("cost_usd", { precision: 8, scale: 5 }).default("0"),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ael_artist").on(table.artistId),
  index("idx_ael_queue").on(table.queueId),
  index("idx_ael_action").on(table.action),
]);

export type InsertArtistEnrichmentQueue = typeof artistEnrichmentQueue.$inferInsert;
export type SelectArtistEnrichmentQueue = typeof artistEnrichmentQueue.$inferSelect;
export type InsertArtistEnrichmentLog = typeof artistEnrichmentLog.$inferInsert;
export type SelectArtistEnrichmentLog = typeof artistEnrichmentLog.$inferSelect;

// =====================================================
// BOOSTIFY VIDEO CONCEPTS — Premium event film service
// =====================================================

export const videoConceptStatusEnum = pgEnum("video_concept_status", [
  "new_project",
  "intake_completed",
  "assets_uploaded",
  "json_generated",
  "concept_approved",
  "in_ai_production",
  "in_editing",
  "first_version_sent",
  "revisions_requested",
  "approved",
  "delivered",
  "archived",
]);

export const videoConceptProjects = pgTable("video_concept_projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  // Lead / client fields (filled even before signup)
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientPhone: text("client_phone"),
  // Event metadata
  eventType: text("event_type", { enum: ["quinceanera", "wedding", "corporate", "legacy", "other"] }).notNull(),
  eventDate: timestamp("event_date"),
  eventLocation: text("event_location"),
  budgetRange: text("budget_range"), // e.g. "5999_9999", "10000_15000", "15000_25000", "25000_plus"
  selectedPreset: text("selected_preset"),
  // Free-form intake
  visualStyle: text("visual_style"),
  musicDirection: text("music_direction"),
  emotionalKeywords: jsonb("emotional_keywords").default(sql`'[]'::jsonb`),
  importantPeople: text("important_people"),
  visualReferences: jsonb("visual_references").default(sql`'[]'::jsonb`),
  notes: text("notes"),
  // Master JSON produced by the AI Master Agent
  masterJson: jsonb("master_json"),
  // Pipeline state
  status: videoConceptStatusEnum("status").default("new_project").notNull(),
  // Two-stage payment lifecycle (per signed service contract):
  //   pending        → contract not signed / no deposit yet
  //   deposit_paid   → 50 % booking deposit paid + contract signed (date locked)
  //   paid_in_full   → remaining 50 % paid on filming day, before shoot begins
  //   refunded       → cancelled & refunded according to the contract clauses
  paymentStatus: text("payment_status", {
    enum: ["pending", "deposit_paid", "paid_in_full", "refunded"],
  }).default("pending").notNull(),
  stripeSessionId: text("stripe_session_id"),
  galleryToken: varchar("gallery_token", { length: 64 }).unique(), // shareable read-only token
  galleryUrl: text("gallery_url"),
  assignedTeam: jsonb("assigned_team").default(sql`'[]'::jsonb`),
  internalNotes: text("internal_notes"),
  // ── Service contract (signed at intake, before any payment) ──────
  contractAccepted: boolean("contract_accepted").default(false).notNull(),
  contractVersion: text("contract_version"), // e.g. "v1.0-2026-04"
  contractSignature: text("contract_signature"), // typed full legal name
  contractSignedAt: timestamp("contract_signed_at"),
  contractIp: text("contract_ip"), // best-effort client IP captured at signing
  contractUserAgent: text("contract_user_agent"),
  contractTotalAmount: integer("contract_total_amount"), // total project price in USD (whole dollars)
  contractDepositAmount: integer("contract_deposit_amount"), // 50 % booking deposit in USD
  // Milestone tracking
  finalPaidAt: timestamp("final_paid_at"),
  // ── Post-deposit storyboard (interactive 10-scene script with AI images) ──
  // Extra brief filled by the client AFTER paying the deposit (mood, must-have
  // shots, narrative tone, color preferences, key people, etc.). Drives the
  // dynamic storyboard generation alongside the master concept JSON.
  clientBriefDetails: jsonb("client_brief_details"),
  // Storyboard JSON: title, logline, palette, and scenes[] with imageUrl,
  // narration, visualDirection, musicCue, etc. Each scene is individually
  // regeneratable.
  storyboardJson: jsonb("storyboard_json"),
  // Lifecycle of the storyboard generation:
  //   not_started → idle (deposit paid but storyboard not requested yet)
  //   generating  → LLM/image pipeline running
  //   ready       → all 10+ scenes rendered, client reviewing
  //   needs_revision → client requested manual edits
  storyboardStatus: text("storyboard_status").default("not_started"),
  storyboardUpdatedAt: timestamp("storyboard_updated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vcp_user").on(table.userId),
  index("idx_vcp_status").on(table.status),
  index("idx_vcp_event_type").on(table.eventType),
  index("idx_vcp_email").on(table.clientEmail),
  uniqueIndex("idx_vcp_gallery_token").on(table.galleryToken),
]);

export const videoConceptAssets = pgTable("video_concept_assets", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => videoConceptProjects.id, { onDelete: "cascade" }).notNull(),
  kind: text("kind", { enum: ["photo", "video", "reference", "music", "ai_image", "ai_video", "final"] }).notNull(),
  url: text("url").notNull(),
  storagePath: text("storage_path"),
  originalName: text("original_name"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  metadata: jsonb("metadata"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vca_project").on(table.projectId),
  index("idx_vca_kind").on(table.kind),
]);

export const videoConceptComments = pgTable("video_concept_comments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => videoConceptProjects.id, { onDelete: "cascade" }).notNull(),
  authorUserId: integer("author_user_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name"), // for guests via gallery token
  body: text("body").notNull(),
  type: text("type", { enum: ["comment", "revision_request", "approval"] }).default("comment").notNull(),
  assetId: integer("asset_id").references(() => videoConceptAssets.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vcc_project").on(table.projectId),
]);

export const videoConceptRevisions = pgTable("video_concept_revisions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => videoConceptProjects.id, { onDelete: "cascade" }).notNull(),
  round: integer("round").default(1).notNull(),
  status: text("status", { enum: ["requested", "in_progress", "delivered", "approved"] }).default("requested").notNull(),
  summary: text("summary"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("idx_vcr_project").on(table.projectId),
]);

export type InsertVideoConceptProject = typeof videoConceptProjects.$inferInsert;

// ============================================================================
// ARTIST GROWTH ENGINE (AGE)
// Sistema de venta del paquete maestro $500 + regla "2 ventas → expansión"
// ============================================================================

export const ageArtistGrowthUnits = pgTable("age_artist_growth_units", {
  id: serial("id").primaryKey(),
  slug: text("slug").unique().notNull(), // 'romy-alvarez'
  artistName: text("artist_name").notNull(),
  artistId: integer("artist_id").references(() => musicians.id, { onDelete: "set null" }),
  parentUnitId: integer("parent_unit_id"), // de qué artista nació
  status: text("status", {
    enum: ["testing", "validated", "paused", "optimizing", "expanded", "blocked"],
  }).default("testing").notNull(),
  initialBudgetCents: integer("initial_budget_cents").default(10000).notNull(), // $100
  avatarUrl: text("avatar_url"),
  teaserVideoUrl: text("teaser_video_url"),
  personalizedMessage: text("personalized_message"),
  personality: text("personality"),
  aesthetic: text("aesthetic"),
  genre: text("genre"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_age_unit_slug").on(table.slug),
  index("idx_age_unit_status").on(table.status),
]);

export const ageFingerprints = pgTable("age_fingerprints", {
  id: serial("id").primaryKey(),
  unitId: integer("unit_id").references(() => ageArtistGrowthUnits.id, { onDelete: "cascade" }).notNull(),
  visitorId: text("visitor_id").notNull(), // cookie / localStorage
  campaignId: text("campaign_id"),
  adId: text("ad_id"),
  trafficSource: text("traffic_source"),
  utmSource: text("utm_source"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  referralCode: text("referral_code"),
  ipHash: text("ip_hash"),
  userAgentHash: text("user_agent_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_age_fp_unit").on(table.unitId),
  index("idx_age_fp_visitor").on(table.visitorId),
]);

export const ageLeads = pgTable("age_leads", {
  id: serial("id").primaryKey(),
  fingerprintId: integer("fingerprint_id").references(() => ageFingerprints.id, { onDelete: "set null" }),
  unitId: integer("unit_id").references(() => ageArtistGrowthUnits.id, { onDelete: "cascade" }).notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  name: text("name"),
  language: text("language"),
  status: text("status", {
    enum: ["new", "wizard_started", "wizard_complete", "checkout_started", "purchased", "recovered", "lost"],
  }).default("new").notNull(),
  lastTouchAt: timestamp("last_touch_at").defaultNow().notNull(),
  nextActionAt: timestamp("next_action_at"),
  objections: jsonb("objections"),
  interestLevel: integer("interest_level").default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_age_lead_unit").on(table.unitId),
  index("idx_age_lead_email").on(table.email),
  index("idx_age_lead_status").on(table.status),
]);

export const ageWizardSessions = pgTable("age_wizard_sessions", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => ageLeads.id, { onDelete: "cascade" }),
  unitId: integer("unit_id").references(() => ageArtistGrowthUnits.id, { onDelete: "cascade" }).notNull(),
  inputs: jsonb("inputs").notNull(), // 13 campos del wizard
  preview: jsonb("preview"), // { name, concept, visualStyle, description, singleIdea, videoConcept }
  previewImageUrl: text("preview_image_url"),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_age_wiz_lead").on(table.leadId),
  index("idx_age_wiz_unit").on(table.unitId),
]);

export const agePurchases = pgTable("age_purchases", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").references(() => ageLeads.id, { onDelete: "set null" }),
  unitId: integer("unit_id").references(() => ageArtistGrowthUnits.id, { onDelete: "cascade" }).notNull(),
  provider: text("provider", { enum: ["stripe"] }).default("stripe").notNull(),
  externalId: text("external_id").unique(), // stripe session/payment intent id
  productSku: text("product_sku").default("AGE_MASTER_500").notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").default("USD").notNull(),
  status: text("status", {
    enum: ["pending", "confirmed", "failed", "refunded", "disputed"],
  }).default("pending").notNull(),
  buyerEmail: text("buyer_email"),
  buyerName: text("buyer_name"),
  buyerClerkId: varchar("buyer_clerk_id"),
  webhookPayload: jsonb("webhook_payload"),
  confirmedAt: timestamp("confirmed_at"),
  refundedAt: timestamp("refunded_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_age_pur_unit").on(table.unitId),
  index("idx_age_pur_status").on(table.status),
  index("idx_age_pur_external").on(table.externalId),
]);

export const ageCampaignMetrics = pgTable("age_campaign_metrics", {
  id: serial("id").primaryKey(),
  unitId: integer("unit_id").references(() => ageArtistGrowthUnits.id, { onDelete: "cascade" }).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  platform: text("platform").default("meta").notNull(),
  campaignId: text("campaign_id"),
  adsetId: text("adset_id"),
  adId: text("ad_id"),
  creativeId: text("creative_id"),
  spendCents: integer("spend_cents").default(0).notNull(),
  impressions: integer("impressions").default(0).notNull(),
  clicks: integer("clicks").default(0).notNull(),
  ctr: real("ctr").default(0).notNull(),
  cpc: real("cpc").default(0).notNull(),
  cpm: real("cpm").default(0).notNull(),
  leads: integer("leads").default(0).notNull(),
  wizardCompleted: integer("wizard_completed").default(0).notNull(),
  checkoutStarted: integer("checkout_started").default(0).notNull(),
  purchases: integer("purchases").default(0).notNull(),
  revenueCents: integer("revenue_cents").default(0).notNull(),
  roas: real("roas").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_age_cm_unit").on(table.unitId),
  index("idx_age_cm_date").on(table.date),
]);

export const ageFinanceLedger = pgTable("age_finance_ledger", {
  id: serial("id").primaryKey(),
  unitId: integer("unit_id").references(() => ageArtistGrowthUnits.id, { onDelete: "set null" }),
  type: text("type", {
    enum: [
      "revenue", "ad_spend", "production", "delivery",
      "reinvestment_lock", "reinvestment_release", "reserve",
      "reward", "boostify_profit", "refund",
    ],
  }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  balanceAfterCents: integer("balance_after_cents"),
  referenceId: text("reference_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_age_fl_unit").on(table.unitId),
  index("idx_age_fl_type").on(table.type),
]);

export const ageExpansionApprovals = pgTable("age_expansion_approvals", {
  id: serial("id").primaryKey(),
  sourceUnitId: integer("source_unit_id").references(() => ageArtistGrowthUnits.id, { onDelete: "cascade" }).notNull(),
  confirmedSales: integer("confirmed_sales").notNull(),
  grossRevenueCents: integer("gross_revenue_cents").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "consumed", "revoked"] }).default("pending").notNull(),
  approvedBy: text("approved_by").default("finance_orchestrator").notNull(),
  reservedAmountCents: integer("reserved_amount_cents").default(10000).notNull(), // $100
  newUnitId: integer("new_unit_id").references(() => ageArtistGrowthUnits.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_age_exp_source").on(table.sourceUnitId),
  index("idx_age_exp_status").on(table.status),
]);

export const ageAgentReports = pgTable("age_agent_reports", {
  id: serial("id").primaryKey(),
  agent: text("agent").notNull(),
  runId: uuid("run_id").defaultRandom().notNull(),
  unitId: integer("unit_id").references(() => ageArtistGrowthUnits.id, { onDelete: "set null" }),
  payload: jsonb("payload"),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_age_ar_agent").on(table.agent),
  index("idx_age_ar_unit").on(table.unitId),
]);

export const ageUpsells = pgTable("age_upsells", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").references(() => agePurchases.id, { onDelete: "cascade" }).notNull(),
  productSku: text("product_sku").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status", { enum: ["offered", "accepted", "paid", "declined"] }).default("offered").notNull(),
  offeredAt: timestamp("offered_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
}, (table) => [
  index("idx_age_up_purchase").on(table.purchaseId),
  index("idx_age_up_status").on(table.status),
]);

export const ageLearningInsights = pgTable("age_learning_insights", {
  id: serial("id").primaryKey(),
  category: text("category", {
    enum: ["hook", "audience", "aesthetic", "cta", "objection", "channel", "creative_loser", "purchase_pattern"],
  }).notNull(),
  insight: text("insight").notNull(),
  score: real("score").default(0).notNull(),
  sampleSize: integer("sample_size").default(0).notNull(),
  evidence: jsonb("evidence"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_age_li_category").on(table.category),
]);

export const ageArtistGenerationRequests = pgTable("age_artist_generation_requests", {
  id: serial("id").primaryKey(),
  expansionApprovalId: integer("expansion_approval_id").references(() => ageExpansionApprovals.id, { onDelete: "cascade" }).notNull(),
  promptSeed: jsonb("prompt_seed"),
  status: text("status", { enum: ["queued", "in_progress", "done", "failed"] }).default("queued").notNull(),
  createdUnitId: integer("created_unit_id").references(() => ageArtistGrowthUnits.id, { onDelete: "set null" }),
  agentLog: jsonb("agent_log"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_age_gen_status").on(table.status),
]);

export type AgeArtistGrowthUnit = typeof ageArtistGrowthUnits.$inferSelect;
export type InsertAgeArtistGrowthUnit = typeof ageArtistGrowthUnits.$inferInsert;
export type AgeLead = typeof ageLeads.$inferSelect;
export type AgeWizardSession = typeof ageWizardSessions.$inferSelect;
export type AgePurchase = typeof agePurchases.$inferSelect;
export type AgeFingerprint = typeof ageFingerprints.$inferSelect;
export type AgeExpansionApproval = typeof ageExpansionApprovals.$inferSelect;
export type AgeFinanceLedger = typeof ageFinanceLedger.$inferSelect;

export type SelectVideoConceptProject = typeof videoConceptProjects.$inferSelect;
export type InsertVideoConceptAsset = typeof videoConceptAssets.$inferInsert;
export type SelectVideoConceptAsset = typeof videoConceptAssets.$inferSelect;
export type InsertVideoConceptComment = typeof videoConceptComments.$inferInsert;
export type SelectVideoConceptComment = typeof videoConceptComments.$inferSelect;
export type InsertVideoConceptRevision = typeof videoConceptRevisions.$inferInsert;
export type SelectVideoConceptRevision = typeof videoConceptRevisions.$inferSelect;

// ═══════════════════════════════════════════════════════════════
// INFLUENCER MODULE — Voice, Avatar, Content Pipeline & Scheduling
// ═══════════════════════════════════════════════════════════════

/**
 * Influencer Voice Profiles — ElevenLabs cloned voices per artist
 */
export const influencerVoiceProfiles = pgTable("influencer_voice_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  elevenLabsVoiceId: text("elevenlabs_voice_id").notNull(),
  voiceName: text("voice_name").notNull(),
  voiceSampleUrl: text("voice_sample_url"),
  language: text("language").default("en"),
  stability: real("stability").default(0.5),
  similarityBoost: real("similarity_boost").default(0.75),
  style: real("style").default(0.0),
  speakerBoost: boolean("speaker_boost").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inf_voice_user").on(table.userId),
]);

export const insertInfluencerVoiceProfileSchema = createInsertSchema(influencerVoiceProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInfluencerVoiceProfile = z.infer<typeof insertInfluencerVoiceProfileSchema>;
export type SelectInfluencerVoiceProfile = typeof influencerVoiceProfiles.$inferSelect;

/**
 * Influencer Avatar Profiles — HeyGen talking-head avatars per artist
 */
export const influencerAvatarProfiles = pgTable("influencer_avatar_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  heygenAvatarId: text("heygen_avatar_id").notNull(),
  avatarPreviewUrl: text("avatar_preview_url"),
  avatarStyle: text("avatar_style", {
    enum: ["casual", "professional", "creative", "urban", "cinematic"]
  }).default("casual"),
  sourceImageUrl: text("source_image_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inf_avatar_user").on(table.userId),
]);

export const insertInfluencerAvatarProfileSchema = createInsertSchema(influencerAvatarProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInfluencerAvatarProfile = z.infer<typeof insertInfluencerAvatarProfileSchema>;
export type SelectInfluencerAvatarProfile = typeof influencerAvatarProfiles.$inferSelect;

/**
 * Influencer Content — Generated influencer videos (script → voice → avatar → final)
 */
export const influencerContent = pgTable("influencer_content", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  // Script
  title: text("title").notNull(),
  scriptText: text("script_text").notNull(),
  topic: text("topic").notNull(),
  contentType: text("content_type", {
    enum: ["educational", "entertainment", "review", "trending", "opinion", "behind_scenes", "promo", "reaction", "tips"]
  }).default("entertainment"),
  hashtags: json("hashtags").$type<string[]>().default([]),
  targetDurationSec: integer("target_duration_sec").default(60),

  // Generated assets
  voiceAudioUrl: text("voice_audio_url"),
  avatarVideoUrl: text("avatar_video_url"),
  brollClips: json("broll_clips").$type<string[]>().default([]),
  thumbnailUrl: text("thumbnail_url"),
  finalVideoUrl: text("final_video_url"),
  subtitlesUrl: text("subtitles_url"),

  // Pipeline status
  status: text("status", {
    enum: ["draft", "script_ready", "generating_voice", "generating_avatar", "generating_broll", "editing", "rendering", "ready", "published", "failed"]
  }).default("draft"),
  pipelineStep: text("pipeline_step"),
  errorMessage: text("error_message"),

  // Publishing
  platform: text("platform", {
    enum: ["tiktok", "instagram", "youtube", "all", "internal"]
  }).default("internal"),
  scheduledAt: timestamp("scheduled_at"),
  publishedAt: timestamp("published_at"),

  // Engagement
  views: integer("views").default(0),
  likes: integer("likes").default(0),
  shares: integer("shares").default(0),
  comments: integer("comments").default(0),

  // Cost tracking
  generationCostUsd: decimal("generation_cost_usd", { precision: 8, scale: 4 }).default("0"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inf_content_user").on(table.userId),
  index("idx_inf_content_status").on(table.status),
  index("idx_inf_content_scheduled").on(table.scheduledAt),
  index("idx_inf_content_published").on(table.publishedAt),
]);

// ============================================================================
// ARTIST SUPERSTAR BLUEPRINT
// JSON maestro personalizado de 13 módulos generado con IA por artista.
// Alimenta todos los sistemas del platform (campaigns, monetization, etc.)
// ============================================================================
export const artistBlueprints = pgTable("artist_blueprints", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  version: text("version").default("1.0").notNull(),
  // Los 13 módulos del blueprint completo
  blueprintJson: jsonb("blueprint_json").notNull(),
  // Resumen rápido para queries sin cargar el JSON completo
  globalArtistScore: integer("global_artist_score"),   // 0-100
  currentEra: text("current_era"),                      // e.g. "Genesis Era"
  primaryGenre: text("primary_genre"),
  brandArchetype: text("brand_archetype"),              // e.g. "Visionary Creator"
  generationStatus: text("generation_status", {
    enum: ["pending", "generating", "completed", "failed"],
  }).default("pending").notNull(),
  generationError: text("generation_error"),
  generatedAt: timestamp("generated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_artist_blueprints_artist").on(table.artistId),
  index("idx_artist_blueprints_status").on(table.generationStatus),
]);

export type InsertArtistBlueprint = typeof artistBlueprints.$inferInsert;
export type SelectArtistBlueprint = typeof artistBlueprints.$inferSelect;

// ─── Artist Domains ───────────────────────────────────────────────────────────
export const artistDomains = pgTable("artist_domains", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  domain: text("domain").notNull().unique(),
  status: text("status", {
    enum: ["pending", "active", "expired", "suspended", "failed"],
  }).default("pending").notNull(),
  // Billing
  pricePerYear: integer("price_per_year"), // cents
  currency: text("currency").default("USD"),
  autoRenew: boolean("auto_renew").default(true),
  expiresAt: timestamp("expires_at"),
  // Settings
  privacyEnabled: boolean("privacy_enabled").default(true),
  domainLocked: boolean("domain_locked").default(true),
  // Redirect
  forwardingUrl: text("forwarding_url"),
  forwardingType: text("forwarding_type", { enum: ["301", "302"] }).default("301"),
  // Internal
  hostingerSubscriptionId: text("hostinger_subscription_id"),
  purchasedAt: timestamp("purchased_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_artist_domains_artist").on(table.artistId),
  index("idx_artist_domains_status").on(table.status),
]);

export type InsertArtistDomain = typeof artistDomains.$inferInsert;
export type SelectArtistDomain = typeof artistDomains.$inferSelect;

export const insertInfluencerContentSchema = createInsertSchema(influencerContent).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInfluencerContent = z.infer<typeof insertInfluencerContentSchema>;
export type SelectInfluencerContent = typeof influencerContent.$inferSelect;

/**
 * Influencer Schedule Config — Publishing frequency per artist
 */
export const influencerScheduleConfig = pgTable("influencer_schedule_config", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  frequency: text("frequency", {
    enum: ["daily", "weekly", "biweekly", "custom"]
  }).default("weekly"),
  customIntervalHours: integer("custom_interval_hours"),
  preferredHour: integer("preferred_hour").default(12), // 0-23 UTC
  preferredDayOfWeek: integer("preferred_day_of_week").default(3), // 0=Sun, 3=Wed
  autoPublish: boolean("auto_publish").default(false),
  autoGenerate: boolean("auto_generate").default(true),
  topics: json("topics").$type<string[]>().default(["trending", "behind_scenes", "music_industry", "tips", "opinion"]),
  isActive: boolean("is_active").default(true),
  lastGeneratedAt: timestamp("last_generated_at"),
  nextScheduledAt: timestamp("next_scheduled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_inf_schedule_user").on(table.userId),
  index("idx_inf_schedule_next").on(table.nextScheduledAt),
  index("idx_inf_schedule_active").on(table.isActive),
]);

// ============================================
// MCP API KEYS — External Agent Authentication
// API keys for external AI agents to access MCP tools
// ============================================

export const mcpApiKeyScopes = ['tools:read', 'tools:execute', 'sse:connect'] as const;
export type MCPApiKeyScope = (typeof mcpApiKeyScopes)[number];

export const mcpApiKeys = pgTable("mcp_api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(),          // First 12 chars for display (bmcp_xxxxxxxx)
  keyHash: text("key_hash").notNull().unique(),      // SHA-256 of the full key — never stored plaintext
  scopes: json("scopes").$type<MCPApiKeyScope[]>().notNull().default(['tools:read', 'tools:execute', 'sse:connect']),
  rateLimit: integer("rate_limit").notNull().default(60),  // Requests per minute
  isActive: boolean("is_active").notNull().default(true),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),               // null = never expires
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mcp_api_keys_user").on(table.userId),
  index("idx_mcp_api_keys_hash").on(table.keyHash),
  index("idx_mcp_api_keys_active").on(table.isActive),
]);

export const insertMcpApiKeySchema = createInsertSchema(mcpApiKeys).omit({ id: true, createdAt: true, updatedAt: true, keyHash: true, keyPrefix: true });
export type InsertMcpApiKey = typeof mcpApiKeys.$inferInsert;
export type SelectMcpApiKey = typeof mcpApiKeys.$inferSelect;

// ───────────────────────────────────────────────────────────────────
// Musician Importer & Messaging (Producer Tools)
//   • musicianImportBatches  — audit log for each bulk import
//   • musicianConversations  — 1:1 threads between client and musician
//                              (optionally scoped to a booking/contract)
//   • musicianMessages       — individual messages inside a conversation
//                              (text / contract / service / audio / file)
//   • musicianServiceContracts — lightweight contract object attached to a
//                              conversation, tracks acceptance & payment
// All new tables are append-only from the perspective of existing code.
// ───────────────────────────────────────────────────────────────────

export const musicianImportBatches = pgTable("musician_import_batches", {
  id: serial("id").primaryKey(),
  importedBy: integer("imported_by").references(() => users.id, { onDelete: "set null" }),
  source: text("source", { enum: ["csv", "json", "api", "manual"] }).notNull(),
  fileName: text("file_name"),
  totalRows: integer("total_rows").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  skipCount: integer("skip_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  errorLog: json("error_log").$type<Array<{ row: number; error: string; data?: any }>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_musician_import_by").on(table.importedBy),
]);

export const musicianConversations = pgTable("musician_conversations", {
  id: serial("id").primaryKey(),
  // Participants
  clientUserId: integer("client_user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  musicianId: integer("musician_id").references(() => musicians.id, { onDelete: "cascade" }).notNull(),
  musicianUserId: integer("musician_user_id").references(() => users.id, { onDelete: "set null" }),
  // Optional scoping
  bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  // State
  subject: text("subject"),
  status: text("status", { enum: ["open", "awaiting_client", "awaiting_musician", "closed", "archived"] }).notNull().default("open"),
  lastMessagePreview: text("last_message_preview"),
  lastMessageAt: timestamp("last_message_at"),
  clientUnreadCount: integer("client_unread_count").notNull().default(0),
  musicianUnreadCount: integer("musician_unread_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mus_conv_client").on(table.clientUserId),
  index("idx_mus_conv_musician").on(table.musicianId),
  index("idx_mus_conv_booking").on(table.bookingId),
  index("idx_mus_conv_status").on(table.status),
]);

export const musicianMessages = pgTable("musician_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => musicianConversations.id, { onDelete: "cascade" }).notNull(),
  // Sender is identified by role + optional userId (musicians imported from DB
  // may not yet have a users row — in that case senderUserId stays null and
  // senderRole='musician'). The 'system' role is used for auto-messages.
  senderRole: text("sender_role", { enum: ["client", "musician", "system"] }).notNull(),
  senderUserId: integer("sender_user_id").references(() => users.id, { onDelete: "set null" }),
  // Payload
  type: text("type", { enum: ["text", "contract", "service_quote", "audio", "file", "system_event"] }).notNull().default("text"),
  body: text("body").notNull(),
  attachments: json("attachments").$type<Array<{ name: string; url: string; mime?: string; size?: number }>>(),
  metadata: json("metadata"),
  readByClient: boolean("read_by_client").notNull().default(false),
  readByMusician: boolean("read_by_musician").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mus_msg_conv").on(table.conversationId),
  index("idx_mus_msg_created").on(table.createdAt),
]);

export const musicianServiceContracts = pgTable("musician_service_contracts", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => musicianConversations.id, { onDelete: "cascade" }).notNull(),
  bookingId: integer("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  summary: text("summary"),
  // Structured terms (scope of work, deliverables, deadlines)
  terms: json("terms").$type<{
    scope?: string;
    deliverables?: string[];
    deadline?: string;
    revisions?: number;
    notes?: string;
  }>(),
  priceAmount: decimal("price_amount", { precision: 10, scale: 2 }).notNull(),
  priceCurrency: text("price_currency").notNull().default("usd"),
  // Signature / acceptance
  status: text("status", { enum: ["draft", "sent", "accepted", "rejected", "cancelled", "completed"] }).notNull().default("draft"),
  sentAt: timestamp("sent_at"),
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  completedAt: timestamp("completed_at"),
  acceptedByUserId: integer("accepted_by_user_id").references(() => users.id, { onDelete: "set null" }),
  // Payment link
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  paymentStatus: text("payment_status", { enum: ["unpaid", "pending", "paid", "refunded"] }).notNull().default("unpaid"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mus_contract_conv").on(table.conversationId),
  index("idx_mus_contract_status").on(table.status),
]);

export const insertMusicianImportBatchSchema = createInsertSchema(musicianImportBatches).omit({ id: true, createdAt: true });
export const insertMusicianConversationSchema = createInsertSchema(musicianConversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMusicianMessageSchema = createInsertSchema(musicianMessages).omit({ id: true, createdAt: true });
export const insertMusicianServiceContractSchema = createInsertSchema(musicianServiceContracts).omit({ id: true, createdAt: true, updatedAt: true });

/* ============================================================================
 * SONG DNA ANALYSES — user-saved song intelligence snapshots
 * ==========================================================================*/
export const songDnaAnalyses = pgTable("song_dna_analyses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  spotifyTrackId: text("spotify_track_id").notNull(),
  title: text("title").notNull(),
  artistName: text("artist_name"),
  albumName: text("album_name"),
  isrc: text("isrc"),
  imageUrl: text("image_url"),
  previewUrl: text("preview_url"),
  durationMs: integer("duration_ms"),
  explicit: boolean("explicit").default(false),
  mood: text("mood"),
  genres: json("genres").$type<string[]>().default([]),
  audioFeatures: jsonb("audio_features"),
  performance: jsonb("performance"),
  demographics: jsonb("demographics"),
  marketPotential: jsonb("market_potential"),
  hitPotential: jsonb("hit_potential"),
  crossPlatform: jsonb("cross_platform"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_song_dna_user").on(table.userId),
  index("idx_song_dna_track").on(table.spotifyTrackId),
]);

export const insertSongDnaAnalysisSchema = createInsertSchema(songDnaAnalyses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSongDnaAnalysis = typeof songDnaAnalyses.$inferInsert;
export type SelectSongDnaAnalysis = typeof songDnaAnalyses.$inferSelect;

/* ============================================================================
 * PARTNER OUTREACH LOG — threaded communication history per distribution partner
 * ==========================================================================*/
export const partnerOutreachLog = pgTable("partner_outreach_log", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => distributionPartners.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  direction: text("direction", { enum: ["outbound", "inbound", "note"] }).notNull().default("outbound"),
  channel: text("channel", { enum: ["email", "linkedin", "form", "phone", "meeting", "internal"] }).notNull().default("email"),
  messageType: text("message_type"),
  subject: text("subject"),
  body: text("body"),
  recipientEmail: text("recipient_email"),
  status: text("status", { enum: ["sent", "delivered", "opened", "replied", "bounced", "failed", "logged"] }).default("sent").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_partner_log_partner").on(table.partnerId),
  index("idx_partner_log_created").on(table.createdAt),
]);

export const insertPartnerOutreachLogSchema = createInsertSchema(partnerOutreachLog).omit({ id: true, createdAt: true });
export type InsertPartnerOutreachLog = typeof partnerOutreachLog.$inferInsert;
export type SelectPartnerOutreachLog = typeof partnerOutreachLog.$inferSelect;

/* ============================================================================
 * C-SUITE AI AGENTS � Autonomous executive team led by Neiver Alvarez-AI (CEO)
 * Self-managing, self-improving, with HITL approvals for high-risk actions.
 * Added 2026-04-24. Phase 1 � additive only, zero changes to existing tables.
 * ==========================================================================*/

// === C-SUITE AI SCHEMA ADDITIONS ===
// Append the content below to db/schema.ts manually if not already there.

export const cSuiteAgents = pgTable("c_suite_agents", {
  id: varchar("id", { length: 64 }).primaryKey(), // 'ceo', 'cmo', 'cfo'...
  name: text("name").notNull(),
  role: text("role").notNull(),
  model: text("model").notNull().default("gpt-4o"),
  autonomy: integer("autonomy").notNull().default(3), // 1=HITL only, 2=guarded, 3=autonomous read
  active: boolean("active").notNull().default(false),
  dryRun: boolean("dry_run").notNull().default(true),
  persona: text("persona").notNull(),
  tools: jsonb("tools").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  escalatesTo: varchar("escalates_to", { length: 64 }),
  budgetUsdDaily: decimal("budget_usd_daily", { precision: 10, scale: 2 }).default("5.00"),
  config: jsonb("config").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cSuiteThreads = pgTable("c_suite_threads", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id", { length: 64 }).notNull(),
  parentId: integer("parent_id"),
  topic: text("topic"),
  triggeredBy: text("triggered_by"), // 'admin' | 'cron' | 'agent:cmo' | 'self_improve'
  status: text("status", { enum: ["active", "done", "escalated", "failed"] }).default("active").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
}, (table) => [
  index("idx_csuite_threads_agent").on(table.agentId),
  index("idx_csuite_threads_status").on(table.status),
]);

export const cSuiteMessages = pgTable("c_suite_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").references(() => cSuiteThreads.id, { onDelete: "cascade" }).notNull(),
  role: text("role", { enum: ["system", "user", "assistant", "tool"] }).notNull(),
  content: text("content"),
  toolName: text("tool_name"),
  toolArgs: jsonb("tool_args"),
  toolResult: jsonb("tool_result"),
  tokensIn: integer("tokens_in").default(0),
  tokensOut: integer("tokens_out").default(0),
  costUsd: decimal("cost_usd", { precision: 10, scale: 6 }).default("0"),
  model: text("model"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_csuite_msg_thread").on(table.threadId),
]);

export const cSuiteDecisions = pgTable("c_suite_decisions", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id", { length: 64 }).notNull(),
  threadId: integer("thread_id").references(() => cSuiteThreads.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: jsonb("target"),
  rationale: text("rationale"),
  riskLevel: integer("risk_level").default(1), // 1-10
  status: text("status", { enum: ["pending", "approved", "rejected", "executed", "failed", "reverted"] }).default("pending").notNull(),
  approvedBy: text("approved_by"),
  executionResult: jsonb("execution_result"),
  signatureSha256: text("signature_sha256"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  executedAt: timestamp("executed_at"),
}, (table) => [
  index("idx_csuite_dec_agent").on(table.agentId),
  index("idx_csuite_dec_status").on(table.status),
]);

export const cSuiteMemory = pgTable("c_suite_memory", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id", { length: 64 }).notNull(),
  kind: text("kind", { enum: ["lesson", "fact", "decision", "feedback"] }).notNull(),
  content: text("content").notNull(),
  weight: real("weight").default(1.0),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_csuite_mem_agent").on(table.agentId),
]);

export const cSuiteSchedule = pgTable("c_suite_schedule", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id", { length: 64 }).notNull(),
  cron: text("cron").notNull(),
  task: text("task").notNull(),
  payload: jsonb("payload").default(sql`'{}'::jsonb`),
  active: boolean("active").default(true).notNull(),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cSuiteApprovals = pgTable("c_suite_approvals", {
  id: serial("id").primaryKey(),
  decisionId: integer("decision_id").references(() => cSuiteDecisions.id, { onDelete: "cascade" }).notNull(),
  requestedBy: varchar("requested_by", { length: 64 }).notNull(),
  summary: text("summary").notNull(),
  riskScore: integer("risk_score").default(5),
  expiresAt: timestamp("expires_at"),
  status: text("status", { enum: ["pending", "approved", "rejected", "expired"] }).default("pending").notNull(),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_csuite_appr_status").on(table.status),
]);

export const cSuiteGoals = pgTable("c_suite_goals", {
  id: serial("id").primaryKey(),
  scope: text("scope", { enum: ["company", "department", "key_result"] }).default("department").notNull(),
  ownerAgent: varchar("owner_agent", { length: 64 }).notNull(),
  parentId: integer("parent_id"),
  title: text("title").notNull(),
  metric: text("metric").notNull(), // 'mrr', 'merch_sales', 'artist_count'...
  targetValue: decimal("target_value", { precision: 18, scale: 4 }).notNull(),
  currentValue: decimal("current_value", { precision: 18, scale: 4 }),
  baseline: decimal("baseline", { precision: 18, scale: 4 }),
  weight: real("weight").default(1.0),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  status: text("status", { enum: ["draft", "on_track", "at_risk", "off_track", "achieved", "missed"] }).default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_csuite_goals_owner").on(table.ownerAgent),
  index("idx_csuite_goals_status").on(table.status),
]);

export const cSuiteGoalCheckins = pgTable("c_suite_goal_checkins", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id").references(() => cSuiteGoals.id, { onDelete: "cascade" }).notNull(),
  agentId: varchar("agent_id", { length: 64 }).notNull(),
  measured: decimal("measured", { precision: 18, scale: 4 }),
  delta: decimal("delta", { precision: 18, scale: 4 }),
  notes: text("notes"),
  decisions: jsonb("decisions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_csuite_checkin_goal").on(table.goalId),
]);

/**
 * Self-improvement log — each row is a self-detected issue (bug, slow agent,
 * failing tool, off-track goal, drifting metric) plus the proposed and applied
 * remediation. Powered by the Self-Maintenance loop run by the CTO agent
 * with CEO oversight. Used to audit how the system improves itself over time.
 */
export const cSuiteSelfImprovement = pgTable("c_suite_self_improvement", {
  id: serial("id").primaryKey(),
  detectedBy: varchar("detected_by", { length: 64 }).notNull(),
  category: text("category", { enum: ["bug", "performance", "cost", "goal_drift", "agent_quality", "tool_failure", "security", "ux"] }).notNull(),
  severity: integer("severity").default(3), // 1-5
  title: text("title").notNull(),
  description: text("description"),
  evidence: jsonb("evidence"),
  proposedFix: text("proposed_fix"),
  appliedFix: text("applied_fix"),
  status: text("status", { enum: ["detected", "analyzing", "proposed", "applied", "verified", "ignored", "failed"] }).default("detected").notNull(),
  decisionId: integer("decision_id").references(() => cSuiteDecisions.id, { onDelete: "set null" }),
  metricsBefore: jsonb("metrics_before"),
  metricsAfter: jsonb("metrics_after"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
}, (table) => [
  index("idx_csuite_self_status").on(table.status),
  index("idx_csuite_self_category").on(table.category),
]);

export const cSuiteSettings = pgTable("c_suite_settings", {
  id: serial("id").primaryKey(),
  killSwitch: boolean("kill_switch").default(false).notNull(),
  globalDryRun: boolean("global_dry_run").default(true).notNull(),
  dailyTokenBudgetUsd: decimal("daily_token_budget_usd", { precision: 10, scale: 2 }).default("15.00"),
  autoApproveBelowRisk: integer("auto_approve_below_risk").default(0), // 0 = never, N = auto if risk<=N
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SelectCSuiteAgent = typeof cSuiteAgents.$inferSelect;
export type InsertCSuiteAgent = typeof cSuiteAgents.$inferInsert;
export type SelectCSuiteThread = typeof cSuiteThreads.$inferSelect;
export type SelectCSuiteMessage = typeof cSuiteMessages.$inferSelect;
export type SelectCSuiteDecision = typeof cSuiteDecisions.$inferSelect;
export type SelectCSuiteApproval = typeof cSuiteApprovals.$inferSelect;
export type SelectCSuiteGoal = typeof cSuiteGoals.$inferSelect;
export type SelectCSuiteSelfImprovement = typeof cSuiteSelfImprovement.$inferSelect;

// ═══════════════════════════════════════════════════════════════
// ARTIST CAREER SUITE — Per-artist AI executive team (Elite tier)
// Mirrors c_suite_* tables but scoped to a single artistId.
// Gated by admin approval before any agent can run for an artist.
// Default: NOT activated. Artist must request -> admin approves -> usable.
// ═══════════════════════════════════════════════════════════════

/**
 * Artist Career Suite subscription / activation.
 * Status flow: pending -> approved -> active -> (cancelled | expired)
 *              pending -> rejected
 */
export const artistSuiteSubscriptions = pgTable("artist_suite_subscriptions", {
  id: serial("id").primaryKey(),
  artistId: text("artist_id").notNull().unique(), // one subscription per artist
  plan: text("plan", { enum: ["elite"] }).default("elite").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected", "active", "cancelled", "expired"] })
    .default("pending")
    .notNull(),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  decidedAt: timestamp("decided_at"),
  decidedBy: text("decided_by"), // admin email
  decisionNote: text("decision_note"),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at"),
  // Elite plan: both personal team (5 agents) AND consultative access to corporate C-Suite.
  enablePersonalAgents: boolean("enable_personal_agents").default(true).notNull(),
  enableCorporateAccess: boolean("enable_corporate_access").default(true).notNull(),
  // Per-artist hard caps independent from admin C-Suite global caps.
  dailyBudgetUsd: decimal("daily_budget_usd", { precision: 10, scale: 2 }).default("2.00").notNull(),
  monthlyMessageCap: integer("monthly_message_cap").default(2000).notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_artist_suite_sub_status").on(table.status),
  index("idx_artist_suite_sub_artist").on(table.artistId),
]);

/**
 * Per-artist agent instance config.
 * Each approved artist gets 5 personal agents seeded on activation.
 * They can ALSO talk to corporate C-Suite agents in a separate session
 * (sessionType='corporate'), reusing c_suite_agents config but logging
 * into artist_suite_threads with artistId for isolation.
 */
export const artistSuiteAgents = pgTable("artist_suite_agents", {
  id: serial("id").primaryKey(),
  artistId: text("artist_id").notNull(),
  agentKey: varchar("agent_key", { length: 64 }).notNull(), // 'manager','marketing','ar','merch','finance'
  name: text("name").notNull(),
  role: text("role").notNull(),
  model: text("model").notNull().default("gpt-4o-mini"),
  persona: text("persona").notNull(),
  active: boolean("active").default(true).notNull(),
  dryRun: boolean("dry_run").default(true).notNull(), // safe by default for artist tier
  autonomy: integer("autonomy").default(2).notNull(), // 1=HITL, 2=guarded, 3=autonomous
  tools: jsonb("tools").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  budgetUsdDaily: decimal("budget_usd_daily", { precision: 10, scale: 2 }).default("0.50"),
  config: jsonb("config").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_artist_suite_agents_artist").on(table.artistId),
  uniqueIndex("uniq_artist_suite_agent").on(table.artistId, table.agentKey),
]);

/**
 * Threads — conversations the artist has with their agents OR the corporate suite.
 * sessionType='personal' = talking to one of their 5 agents
 * sessionType='corporate' = consulting a corporate C-Suite agent (cfo/cmo/...)
 */
export const artistSuiteThreads = pgTable("artist_suite_threads", {
  id: serial("id").primaryKey(),
  artistId: text("artist_id").notNull(),
  sessionType: text("session_type", { enum: ["personal", "corporate"] }).default("personal").notNull(),
  agentKey: varchar("agent_key", { length: 64 }).notNull(), // 'manager' or 'cfo' etc.
  parentId: integer("parent_id"),
  topic: text("topic"),
  triggeredBy: text("triggered_by"), // 'artist' | 'cron' | 'goal'
  status: text("status", { enum: ["active", "done", "escalated", "failed"] }).default("active").notNull(),
  metadata: jsonb("metadata").$type<Record<string, any>>().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
}, (table) => [
  index("idx_artist_suite_threads_artist").on(table.artistId),
  index("idx_artist_suite_threads_status").on(table.status),
]);

export const artistSuiteMessages = pgTable("artist_suite_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").references(() => artistSuiteThreads.id, { onDelete: "cascade" }).notNull(),
  artistId: text("artist_id").notNull(), // denormalized for fast per-artist queries
  role: text("role", { enum: ["system", "user", "assistant", "tool"] }).notNull(),
  content: text("content"),
  toolName: text("tool_name"),
  toolArgs: jsonb("tool_args"),
  toolResult: jsonb("tool_result"),
  tokensIn: integer("tokens_in").default(0),
  tokensOut: integer("tokens_out").default(0),
  costUsd: decimal("cost_usd", { precision: 10, scale: 6 }).default("0"),
  model: text("model"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_artist_suite_messages_thread").on(table.threadId),
  index("idx_artist_suite_messages_artist").on(table.artistId),
]);

export const artistSuiteDecisions = pgTable("artist_suite_decisions", {
  id: serial("id").primaryKey(),
  artistId: text("artist_id").notNull(),
  agentKey: varchar("agent_key", { length: 64 }).notNull(),
  threadId: integer("thread_id").references(() => artistSuiteThreads.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  target: jsonb("target"),
  rationale: text("rationale"),
  riskLevel: integer("risk_level").default(1),
  status: text("status", { enum: ["pending", "approved", "rejected", "executed", "failed", "reverted"] })
    .default("pending")
    .notNull(),
  approvedBy: text("approved_by"), // artist email or admin email (admin can override)
  executionResult: jsonb("execution_result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  executedAt: timestamp("executed_at"),
}, (table) => [
  index("idx_artist_suite_decisions_artist").on(table.artistId),
  index("idx_artist_suite_decisions_status").on(table.status),
]);

export const artistSuiteGoals = pgTable("artist_suite_goals", {
  id: serial("id").primaryKey(),
  artistId: text("artist_id").notNull(),
  ownerAgent: varchar("owner_agent", { length: 64 }).notNull(),
  parentId: integer("parent_id"),
  title: text("title").notNull(),
  metric: text("metric").notNull(),
  targetValue: decimal("target_value", { precision: 18, scale: 4 }).notNull(),
  currentValue: decimal("current_value", { precision: 18, scale: 4 }),
  baseline: decimal("baseline", { precision: 18, scale: 4 }),
  weight: real("weight").default(1.0),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  status: text("status", { enum: ["draft", "on_track", "at_risk", "off_track", "achieved", "missed"] })
    .default("draft")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_artist_suite_goals_artist").on(table.artistId),
  index("idx_artist_suite_goals_status").on(table.status),
]);

export const artistSuiteMemory = pgTable("artist_suite_memory", {
  id: serial("id").primaryKey(),
  artistId: text("artist_id").notNull(),
  agentKey: varchar("agent_key", { length: 64 }).notNull(),
  kind: text("kind", { enum: ["lesson", "fact", "decision", "feedback"] }).notNull(),
  content: text("content").notNull(),
  weight: real("weight").default(1.0),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_artist_suite_memory_artist_agent").on(table.artistId, table.agentKey),
]);

export const artistSuiteSettings = pgTable("artist_suite_settings", {
  id: serial("id").primaryKey(),
  artistId: text("artist_id").notNull().unique(),
  killSwitch: boolean("kill_switch").default(false).notNull(),
  dryRunGlobal: boolean("dry_run_global").default(true).notNull(),
  preferredModel: text("preferred_model").default("gpt-4o-mini"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SelectArtistSuiteSubscription = typeof artistSuiteSubscriptions.$inferSelect;
export type InsertArtistSuiteSubscription = typeof artistSuiteSubscriptions.$inferInsert;
export type SelectArtistSuiteAgent = typeof artistSuiteAgents.$inferSelect;
export type InsertArtistSuiteAgent = typeof artistSuiteAgents.$inferInsert;
export type SelectArtistSuiteThread = typeof artistSuiteThreads.$inferSelect;
export type SelectArtistSuiteMessage = typeof artistSuiteMessages.$inferSelect;
export type SelectArtistSuiteDecision = typeof artistSuiteDecisions.$inferSelect;
export type SelectArtistSuiteGoal = typeof artistSuiteGoals.$inferSelect;
export type SelectArtistSuiteMemory = typeof artistSuiteMemory.$inferSelect;
export type SelectArtistSuiteSettings = typeof artistSuiteSettings.$inferSelect;

// =====================================================
// BOOSTIFY VIDEO CONCEPTS � Premium event film service
// =====================================================


// =====================================================
// AMAZON CULTURAL STOREFRONT - Per-artist curated picks
// =====================================================

export const amazonProductCache = pgTable("amazon_product_cache", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  queryHash: text("query_hash").notNull(),
  marketplace: text("marketplace").default("www.amazon.com").notNull(),
  productsJson: jsonb("products_json").notNull(),
  itemCount: integer("item_count").default(0).notNull(),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => [
  uniqueIndex("uniq_amzn_artist_query").on(table.artistId, table.queryHash),
  index("idx_amzn_cache_expires").on(table.expiresAt),
]);

export const amazonClickEvents = pgTable("amazon_click_events", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "set null" }),
  asin: text("asin").notNull(),
  affiliateTag: text("affiliate_tag").notNull(),
  visitorId: text("visitor_id"),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_amzn_click_artist").on(table.artistId),
  index("idx_amzn_click_created").on(table.createdAt),
]);

export type SelectAmazonProductCache = typeof amazonProductCache.$inferSelect;
export type InsertAmazonProductCache = typeof amazonProductCache.$inferInsert;
export type SelectAmazonClickEvent = typeof amazonClickEvents.$inferSelect;
export type InsertAmazonClickEvent = typeof amazonClickEvents.$inferInsert;

// ---------------------------------------------------------------
// PROMOTE ENGINE � Cinematic Promo Pack (LoRA + image + video + scheduler)
// ---------------------------------------------------------------

/**
 * Artist LoRAs � one trained style pack per artist (flux-kontext-trainer).
 * Used to inject visual identity into flux-pro/kontext generations.
 */
export const artistLoras = pgTable("artist_loras", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  loraUrl: text("lora_url"),
  triggerWord: text("trigger_word").notNull(),
  trainingJobId: text("training_job_id"),
  referenceImages: jsonb("reference_images"),
  characterSheet: jsonb("character_sheet"),
  status: text("status", { enum: ["pending", "training", "ready", "failed"] }).default("pending").notNull(),
  errorMessage: text("error_message"),
  costCents: integer("cost_cents").default(0),
  trainedAt: timestamp("trained_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_artist_loras_artist").on(table.artistId),
  index("idx_artist_loras_status").on(table.status),
]);

/**
 * Promo Assets � every generated image, video, caption, etc. for a song.
 * pack_id groups assets that belong to the same generated promo pack.
 */
export const promoAssets = pgTable("promo_assets", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").references(() => songs.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  packId: text("pack_id"),
  type: text("type", { enum: ["image", "hook_video", "spoken_promo", "caption", "composite"] }).notNull(),
  variant: text("variant"),
  style: text("style"),
  url: text("url"),
  thumbnailUrl: text("thumbnail_url"),
  prompt: text("prompt"),
  script: text("script"),
  voiceId: text("voice_id"),
  model: text("model"),
  durationSeconds: integer("duration_seconds"),
  costCents: integer("cost_cents").default(0),
  metadata: jsonb("metadata"),
  status: text("status", { enum: ["generating", "ready", "failed"] }).default("ready").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_promo_assets_song").on(table.songId),
  index("idx_promo_assets_artist").on(table.artistId),
  index("idx_promo_assets_pack").on(table.packId),
]);

/**
 * Promo Schedule � calendar of pending/posted publications.
 */
export const promoSchedule = pgTable("promo_schedule", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").references(() => promoAssets.id, { onDelete: "cascade" }).notNull(),
  songId: integer("song_id").references(() => songs.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  platform: text("platform", {
    enum: ["instagram", "tiktok", "twitter", "youtube_shorts", "facebook"],
  }).notNull(),
  caption: text("caption"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  status: text("status", { enum: ["pending", "posting", "posted", "failed", "cancelled"] }).default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  postedUrl: text("posted_url"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_promo_schedule_due").on(table.scheduledFor, table.status),
  index("idx_promo_schedule_song").on(table.songId),
]);

/**
 * Artist Voice Clones � ElevenLabs voice clone per artist (optional).
 */
export const artistVoiceClones = pgTable("artist_voice_clones", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  voiceId: text("voice_id").notNull(),
  provider: text("provider", { enum: ["elevenlabs", "fal"] }).default("elevenlabs").notNull(),
  referenceAudioUrl: text("reference_audio_url"),
  language: text("language"),
  status: text("status", { enum: ["pending", "ready", "failed"] }).default("ready").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_artist_voice_clones_artist").on(table.artistId),
]);

/**
 * Challenge Campaigns — viral challenge engine per song.
 * Stores virality analysis, 3 generated Kling videos, and 15-day campaign calendar.
 */
export const challengeCampaigns = pgTable("challenge_campaigns", {
  id: serial("id").primaryKey(),
  songId: integer("song_id").notNull(),
  artistId: integer("artist_id"),

  // Virality analysis
  viralScore: integer("viral_score").default(0),
  bpm: real("bpm"),
  energyLevel: real("energy_level"),
  danceability: real("danceability"),
  viralAnalysisJson: jsonb("viral_analysis_json").default({}),

  // Challenge definition
  challengeName: text("challenge_name").notNull(),
  hashtag: text("hashtag").notNull(),
  hookText: text("hook_text"),
  challengeInstructions: text("challenge_instructions"),

  // Reference assets
  hookAudioUrl: text("hook_audio_url"),
  referenceVideoUrl: text("reference_video_url"),

  // Generated videos (3 styles — all Kling pro 9:16)
  urbanVideoUrl: text("urban_video_url"),
  groupDanceVideoUrl: text("group_dance_video_url"),
  luxuryVideoUrl: text("luxury_video_url"),
  urbanAssetId: integer("urban_asset_id"),
  groupDanceAssetId: integer("group_dance_asset_id"),
  luxuryAssetId: integer("luxury_asset_id"),

  // 15-day campaign calendar
  campaignCalendar: jsonb("campaign_calendar").default([]),
  campaignStatus: text("campaign_status", { enum: ["draft", "active", "completed"] }).default("draft"),
  launchedAt: timestamp("launched_at"),

  status: text("status", { enum: ["analyzing", "ready", "generating", "done", "failed"] }).default("analyzing").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_challenge_campaigns_song").on(table.songId),
  index("idx_challenge_campaigns_artist").on(table.artistId),
  index("idx_challenge_campaigns_status").on(table.status),
]);

export type ArtistLora = typeof artistLoras.$inferSelect;
export type InsertArtistLora = typeof artistLoras.$inferInsert;
export type PromoAsset = typeof promoAssets.$inferSelect;
export type InsertPromoAsset = typeof promoAssets.$inferInsert;
export type PromoSchedule = typeof promoSchedule.$inferSelect;
export type InsertPromoSchedule = typeof promoSchedule.$inferInsert;
export type ArtistVoiceClone = typeof artistVoiceClones.$inferSelect;
export type InsertArtistVoiceClone = typeof artistVoiceClones.$inferInsert;
export type ChallengeCampaign = typeof challengeCampaigns.$inferSelect;
export type InsertChallengeCampaign = typeof challengeCampaigns.$inferInsert;

// ============================================================
// ARTIST AGENT GATEWAY — Communication system tables
// ============================================================

/** Gateway configuration per artist */
export const agentGatewayConfig = pgTable("agent_gateway_config", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  communicationMode: text("communication_mode", { enum: ["agents_only", "hybrid", "direct"] }).default("agents_only").notNull(),
  publicEmailVisible: boolean("public_email_visible").default(false).notNull(),
  directDmEnabled: boolean("direct_dm_enabled").default(false).notNull(),
  gatewayEnabled: boolean("gateway_enabled").default(true).notNull(),
  welcomeMessage: text("welcome_message").default("All communication is managed by the artist's AI agent team."),
  autoReplyEnabled: boolean("auto_reply_enabled").default(true).notNull(),
  humanApprovalRules: jsonb("human_approval_rules").$type<Record<string, any>>().default({}),
  agentTeamConfig: jsonb("agent_team_config").$type<Record<string, any>>().default({}),
  protectionRules: jsonb("protection_rules").$type<Record<string, any>>().default({}),
  branding: jsonb("branding").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gw_config_artist").on(table.artistId),
]);

/** Agent definitions per artist */
export const artistAgents = pgTable("artist_agents", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentType: text("agent_type", { enum: [
    "manager", "booking", "licensing", "brand_deals",
    "collaboration", "fan_relations", "press",
    "legal_guard", "finance", "merch", "distribution",
  ] }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  systemPrompt: text("system_prompt").notNull(),
  capabilities: jsonb("capabilities").$type<string[]>().default([]),
  authorityLevel: integer("authority_level").default(2).notNull(),
  rules: jsonb("rules").$type<Record<string, any>>().default({}),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_artist_agents_artist").on(table.artistId),
  index("idx_artist_agents_type").on(table.agentType),
  uniqueIndex("idx_artist_agents_unique").on(table.artistId, table.agentType),
]);

/** Gateway requests — every incoming communication */
export const agentGatewayRequests = pgTable("agent_gateway_requests", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  agentType: text("agent_type").notNull(),
  conversationId: text("conversation_id").notNull(),
  // Sender info
  senderType: text("sender_type", { enum: [
    "brand", "fan", "label", "promoter", "producer",
    "supervisor", "press", "distributor", "other",
  ] }).notNull(),
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  senderCompany: text("sender_company"),
  senderClerkId: text("sender_clerk_id"),
  // Intent & classification
  intent: text("intent").notNull(),
  intentConfidence: real("intent_confidence").default(0),
  // Structured data collected by agent
  collectedData: jsonb("collected_data").$type<Record<string, any>>().default({}),
  // Scoring
  opportunityScore: integer("opportunity_score").default(0),
  riskLevel: text("risk_level", { enum: ["low", "medium", "high", "critical"] }).default("medium").notNull(),
  compatibilityScore: integer("compatibility_score").default(0),
  // Status workflow
  status: text("status", { enum: [
    "new", "collecting_info", "qualified", "negotiating",
    "pending_approval", "approved", "rejected",
    "counter_offered", "executing", "completed", "expired", "spam",
  ] }).default("new").notNull(),
  // Agent response
  agentSummary: text("agent_summary"),
  agentRecommendation: text("agent_recommendation"),
  requiresHumanApproval: boolean("requires_human_approval").default(false).notNull(),
  // Financials
  estimatedValueMin: decimal("estimated_value_min", { precision: 12, scale: 2 }),
  estimatedValueMax: decimal("estimated_value_max", { precision: 12, scale: 2 }),
  proposedBudget: decimal("proposed_budget", { precision: 12, scale: 2 }),
  // Metadata
  territory: text("territory"),
  deadline: timestamp("deadline"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gw_requests_artist").on(table.artistId),
  index("idx_gw_requests_status").on(table.status),
  index("idx_gw_requests_agent").on(table.agentType),
  index("idx_gw_requests_conv").on(table.conversationId),
]);

/** Messages within a gateway conversation */
export const agentGatewayMessages = pgTable("agent_gateway_messages", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").references(() => agentGatewayRequests.id, { onDelete: "cascade" }).notNull(),
  conversationId: text("conversation_id").notNull(),
  role: text("role", { enum: ["user", "agent", "system", "human_approver"] }).notNull(),
  agentType: text("agent_type"),
  content: text("content").notNull(),
  structuredData: jsonb("structured_data").$type<Record<string, any>>(),
  action: text("action", { enum: [
    "info_request", "qualification", "negotiation",
    "auto_reply", "escalation", "approval_request",
    "rejection", "counter_offer", "contract_draft",
    "meeting_scheduled", "executed",
  ] }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gw_messages_request").on(table.requestId),
  index("idx_gw_messages_conv").on(table.conversationId),
]);

/** Approval queue for human review */
export const agentApprovalQueue = pgTable("agent_approval_queue", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").references(() => agentGatewayRequests.id, { onDelete: "cascade" }).notNull(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  approvalType: text("approval_type", { enum: [
    "contract", "brand_usage", "exclusive_rights",
    "high_value_payment", "media_interview",
    "image_rights", "master_license", "custom",
  ] }).notNull(),
  agentRecommendation: text("agent_recommendation").notNull(),
  agentProposedAction: text("agent_proposed_action").notNull(),
  riskAssessment: jsonb("risk_assessment").$type<Record<string, any>>().default({}),
  status: text("status", { enum: ["pending", "approved", "rejected", "expired"] }).default("pending").notNull(),
  decidedBy: text("decided_by"),
  decisionNote: text("decision_note"),
  decidedAt: timestamp("decided_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gw_approval_artist").on(table.artistId),
  index("idx_gw_approval_status").on(table.status),
]);

/** Audit log for all gateway actions */
export const agentGatewayAuditLog = pgTable("agent_gateway_audit_log", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  requestId: integer("request_id").references(() => agentGatewayRequests.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  actorType: text("actor_type", { enum: ["agent", "human", "system"] }).notNull(),
  actorDetail: text("actor_detail"),
  details: jsonb("details").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gw_audit_artist").on(table.artistId),
]);

/** External contacts database */
export const agentExternalContacts = pgTable("agent_external_contacts", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  email: text("email"),
  company: text("company"),
  contactType: text("contact_type", { enum: [
    "brand", "label", "promoter", "producer",
    "supervisor", "press", "fan_vip", "other",
  ] }),
  totalRequests: integer("total_requests").default(0).notNull(),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }).default("0"),
  trustScore: integer("trust_score").default(50).notNull(),
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_gw_contacts_artist").on(table.artistId),
]);

export type AgentGatewayConfig = typeof agentGatewayConfig.$inferSelect;
export type InsertAgentGatewayConfig = typeof agentGatewayConfig.$inferInsert;
export type ArtistAgent = typeof artistAgents.$inferSelect;
export type InsertArtistAgent = typeof artistAgents.$inferInsert;
export type AgentGatewayRequest = typeof agentGatewayRequests.$inferSelect;
export type InsertAgentGatewayRequest = typeof agentGatewayRequests.$inferInsert;
export type AgentGatewayMessage = typeof agentGatewayMessages.$inferSelect;
export type InsertAgentGatewayMessage = typeof agentGatewayMessages.$inferInsert;
export type AgentApprovalQueue = typeof agentApprovalQueue.$inferSelect;
export type InsertAgentApprovalQueue = typeof agentApprovalQueue.$inferInsert;
export type AgentGatewayAuditLog = typeof agentGatewayAuditLog.$inferSelect;
export type InsertAgentGatewayAuditLog = typeof agentGatewayAuditLog.$inferInsert;
export type AgentExternalContact = typeof agentExternalContacts.$inferSelect;
export type InsertAgentExternalContact = typeof agentExternalContacts.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
//  LEGAL ACKNOWLEDGEMENTS — BTF Utility Disclaimer consent records
// ─────────────────────────────────────────────────────────────────────────────
export const legalAcknowledgements = pgTable("legal_acknowledgements", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  utilityDisclaimerAccepted: boolean("utility_disclaimer_accepted").default(true),
  termsVersion: text("terms_version").default("v1.0"),
  acceptedAt: timestamp("accepted_at").defaultNow(),
  ipAddress: text("ip_address"),
  walletAddress: text("wallet_address"),
}, (table) => [
  index("idx_legal_ack_user").on(table.userId),
]);

export type LegalAcknowledgement = typeof legalAcknowledgements.$inferSelect;
export type InsertLegalAcknowledgement = typeof legalAcknowledgements.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
//  ARTIST FAN LEADS — Email capture & nurture sequence per artist
// ─────────────────────────────────────────────────────────────────────────────
export const artistFanLeads = pgTable("artist_fan_leads", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
  source: text("source").default("artist_page"),   // 'artist_page' | 'qr' | 'link'
  artistSlug: text("artist_slug"),
  sequenceStep: integer("sequence_step").default(0).notNull(), // 0=welcome sent, 1=day3 sent, 2=day7 sent
  lastEmailSentAt: timestamp("last_email_sent_at"),
  nextEmailAt: timestamp("next_email_at"),
  isUnsubscribed: boolean("is_unsubscribed").default(false).notNull(),
  unsubscribedAt: timestamp("unsubscribed_at"),
  ipAddress: text("ip_address"),
  metadata: jsonb("metadata"),
}, (table) => [
  index("idx_fan_leads_artist").on(table.artistId),
  index("idx_fan_leads_email").on(table.email),
  index("idx_fan_leads_next_email").on(table.nextEmailAt),
  uniqueIndex("idx_fan_leads_artist_email").on(table.artistId, table.email),
]);

export type InsertArtistFanLead = typeof artistFanLeads.$inferInsert;
export type SelectArtistFanLead = typeof artistFanLeads.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
//  FAN CLUB — lightweight fan membership, fan numbers, boost points & tiers
// ─────────────────────────────────────────────────────────────────────────────

export const fanClubMembers = pgTable("fan_club_members", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  email: text("email").notNull(),
  name: text("name"),
  fanNumber: integer("fan_number").notNull(),               // sequential per artist (#1, #2, ...)
  points: integer("points").default(0).notNull(),           // boost points
  tier: text("tier").default("rookie").notNull(),           // rookie | bronze | gold | backstage
  streakDays: integer("streak_days").default(0).notNull(),
  lastCheckinAt: timestamp("last_checkin_at"),
  artistSlug: text("artist_slug"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
}, (table) => [
  index("idx_fan_club_artist").on(table.artistId),
  index("idx_fan_club_points").on(table.artistId, table.points),
  uniqueIndex("idx_fan_club_artist_email").on(table.artistId, table.email),
]);

export const fanPointEvents = pgTable("fan_point_events", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  email: text("email").notNull(),
  action: text("action").notNull(),                          // join | checkin | share | play | visit
  points: integer("points").default(0).notNull(),
  dayKey: text("day_key"),                                   // YYYY-MM-DD for once-per-day idempotency
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fan_points_artist_email").on(table.artistId, table.email),
  uniqueIndex("idx_fan_points_daily").on(table.artistId, table.email, table.action, table.dayKey),
]);

export type InsertFanClubMember = typeof fanClubMembers.$inferInsert;
export type SelectFanClubMember = typeof fanClubMembers.$inferSelect;
export type InsertFanPointEvent = typeof fanPointEvents.$inferInsert;
export type SelectFanPointEvent = typeof fanPointEvents.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
//  AUDIENCE CAPTURE ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export const audienceProfiles = pgTable("audience_profiles", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull().unique(),
  primaryAgeRange: text("primary_age_range").notNull().default("18-35"),
  languages: text("languages").array().notNull().default(sql`ARRAY[]::text[]`),
  locations: text("locations").array().notNull().default(sql`ARRAY[]::text[]`),
  interests: text("interests").array().notNull().default(sql`ARRAY[]::text[]`),
  emotionalTriggers: text("emotional_triggers").array().notNull().default(sql`ARRAY[]::text[]`),
  platforms: text("platforms").array().notNull().default(sql`ARRAY[]::text[]`),
  preferredFormats: text("preferred_formats").array().notNull().default(sql`ARRAY[]::text[]`),
  attentionSpanSeconds: text("attention_span_seconds").default("1-3 for hook, 15-45 for retention"),
  archetype: text("archetype").default(""),
  promise: text("promise").default(""),
  visualIdentity: text("visual_identity").default(""),
  tone: text("tone").default(""),
  contentToAvoid: text("content_to_avoid").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audience_profiles_artist").on(table.artistId),
]);

export const contentPillarsConfig = pgTable("content_pillars_config", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  pillar: text("pillar", {
    enum: ["music", "character", "story", "lifestyle", "community", "product", "authority"],
  }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  weight: integer("weight").notNull().default(5),  // 1-10
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_content_pillars_artist").on(table.artistId),
  uniqueIndex("idx_content_pillars_artist_pillar").on(table.artistId, table.pillar),
]);

export const contentCaptureScores = pgTable("content_capture_scores", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  contentRef: text("content_ref").notNull(),
  hookStrength: integer("hook_strength").notNull().default(0),
  retentionPotential: integer("retention_potential").notNull().default(0),
  identityAlignment: integer("identity_alignment").notNull().default(0),
  sharePotential: integer("share_potential").notNull().default(0),
  commentTrigger: integer("comment_trigger").notNull().default(0),
  conversionIntent: integer("conversion_intent").notNull().default(0),
  platformFit: integer("platform_fit").notNull().default(0),
  overallScore: integer("overall_score").notNull().default(0),
  platform: text("platform").notNull().default("instagram"),
  regeneratedCount: integer("regenerated_count").notNull().default(0),
  rawContent: jsonb("raw_content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_content_scores_artist").on(table.artistId),
]);

export const contentMemory = pgTable("content_memory", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  type: text("type", {
    enum: ["winning_hook", "losing_hook", "winning_format", "winning_cta", "audience_comment"],
  }).notNull(),
  value: text("value").notNull(),
  platform: text("platform").notNull().default("instagram"),
  score: integer("score"),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_content_memory_artist").on(table.artistId),
  index("idx_content_memory_type").on(table.type),
]);

export const contentExperiments = pgTable("content_experiments", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  songId: integer("song_id"),
  hypothesis: text("hypothesis").notNull(),
  platform: text("platform").notNull().default("instagram"),
  budget: integer("budget").notNull().default(0),  // USD cents
  status: text("status", { enum: ["draft", "running", "completed"] }).notNull().default("draft"),
  variations: jsonb("variations").notNull().default(sql`'[]'::jsonb`),
  results: jsonb("results"),
  winnerId: text("winner_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_content_experiments_artist").on(table.artistId),
]);

export const dailyContentPlans = pgTable("daily_content_plans", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").notNull(),
  planDate: text("plan_date").notNull(),  // ISO date "YYYY-MM-DD"
  hookTests: integer("hook_tests").notNull().default(5),
  shortReels: integer("short_reels").notNull().default(3),
  stories: integer("stories").notNull().default(5),
  communityPosts: integer("community_posts").notNull().default(2),
  conversionPosts: integer("conversion_posts").notNull().default(1),
  adVariations: integer("ad_variations").notNull().default(0),
  retargetingAssets: integer("retargeting_assets").notNull().default(0),
  status: text("status", { enum: ["draft", "approved", "published"] }).notNull().default("draft"),
  generatedItems: jsonb("generated_items").default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_daily_plans_artist").on(table.artistId),
  uniqueIndex("idx_daily_plans_artist_date").on(table.artistId, table.planDate),
]);

// ── Type exports ──────────────────────────────────────────────────────────────
export type InsertAudienceProfile = typeof audienceProfiles.$inferInsert;
export type SelectAudienceProfile = typeof audienceProfiles.$inferSelect;
export type InsertContentPillarConfig = typeof contentPillarsConfig.$inferInsert;
export type SelectContentPillarConfig = typeof contentPillarsConfig.$inferSelect;
export type InsertContentCaptureScore = typeof contentCaptureScores.$inferInsert;
export type SelectContentCaptureScore = typeof contentCaptureScores.$inferSelect;
export type InsertContentMemory = typeof contentMemory.$inferInsert;
export type SelectContentMemory = typeof contentMemory.$inferSelect;
export type InsertContentExperiment = typeof contentExperiments.$inferInsert;
export type SelectContentExperiment = typeof contentExperiments.$inferSelect;
export type InsertDailyContentPlan = typeof dailyContentPlans.$inferInsert;
export type SelectDailyContentPlan = typeof dailyContentPlans.$inferSelect;

// ============================================
// AI VIDEO STUDIO — HyperFrame Video Engine
// ============================================

/**
 * video_jobs — tracks each full-pipeline video generation job
 */
export const videoJobs = pgTable("video_jobs", {
  id: serial("id").primaryKey(),
  artistId: text("artist_id").notNull(),
  songId: text("song_id"),
  campaignId: text("campaign_id"),

  // Job config
  videoType: text("video_type", {
    enum: [
      "artist_promo", "song_trailer", "lyric_visualizer", "avatar_announcement",
      "campaign_ad", "multilingual", "artist_pitch", "fan_engagement",
      "brand_partnership", "spotify_canvas", "youtube_intro", "tiktok_hook",
    ],
  }).notNull(),
  platform: text("platform").default("tiktok"),        // tiktok | instagram | youtube | spotify_canvas | all
  format: text("format").default("9:16"),               // 9:16 | 16:9 | 1:1
  language: text("language").default("en"),
  durationSeconds: integer("duration_seconds").default(30),

  // Input JSON payload
  inputPayload: json("input_payload").$type<Record<string, any>>(),

  // AI-generated creative output
  creativeConcept: json("creative_concept").$type<{
    title: string; logline: string; mood: string;
    visualDirection: string; emotionalGoal: string;
  }>(),
  script: json("script").$type<{
    avatarScript: string; voiceover: string;
    captions: Array<{ text: string; startMs: number; endMs: number }>;
  }>(),
  scenes: json("scenes").$type<Array<{
    sceneNumber: number; duration: string;
    visualDescription: string; hyperframesInstruction: string;
    heygenInstruction: string; textOverlay: string;
    cameraMovement: string; transition: string; audioCue: string;
  }>>(),

  // HyperFrames generated composition
  hyperframesCompositionHtml: text("hyperframes_composition_html"),
  hyperframesStylesCss: text("hyperframes_styles_css"),
  hyperframesTimelineJs: text("hyperframes_timeline_js"),
  hyperframesMetadata: json("hyperframes_metadata").$type<Record<string, any>>(),
  hyperframesRenderConfig: json("hyperframes_render_config").$type<Record<string, any>>(),

  // HeyGen video generation
  heygenPayload: json("heygen_payload").$type<{
    avatarId: string; voiceId: string; script: string;
    background: string; dimension: string; webhookUrl: string;
  }>(),
  heygenVideoId: text("heygen_video_id"),
  heygenVideoUrl: text("heygen_video_url"),

  // Job status pipeline
  status: text("status", {
    enum: ["draft", "script_generated", "hyperframes_generated", "heygen_processing", "rendering", "completed", "failed"],
  }).default("draft").notNull(),
  errorMessage: text("error_message"),
  progressPercent: integer("progress_percent").default(0),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_video_jobs_artist").on(table.artistId),
  index("idx_video_jobs_status").on(table.status),
]);

/**
 * video_outputs — final rendered video files per job per platform
 */
export const videoOutputs = pgTable("video_outputs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").references(() => videoJobs.id, { onDelete: "cascade" }).notNull(),
  artistId: text("artist_id").notNull(),

  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  srtUrl: text("srt_url"),               // subtitles SRT
  vttUrl: text("vtt_url"),               // subtitles VTT
  metadataUrl: text("metadata_url"),

  // Platform-specific exports
  exportsByPlatform: json("exports_by_platform").$type<Record<string, string>>(), // { tiktok: url, instagram: url }

  format: text("format").default("9:16"),
  durationSeconds: integer("duration_seconds"),
  fileSizeBytes: integer("file_size_bytes"),
  mimeType: text("mime_type").default("video/mp4"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_video_outputs_job").on(table.jobId),
  index("idx_video_outputs_artist").on(table.artistId),
]);

/**
 * hyperframes_templates — reusable HTML composition presets
 */
export const hyperframesTemplates = pgTable("hyperframes_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category", {
    enum: ["promo", "lyric_video", "avatar_promo", "campaign_ad", "pitch", "visualizer", "canvas_loop", "hook"],
  }).notNull(),
  preset: text("preset"),                           // e.g. "new_song_announcement"
  genre: text("genre"),                             // optional genre lock
  format: text("format").default("9:16"),
  durationSeconds: integer("duration_seconds").default(30),
  compositionHtml: text("composition_html").notNull(),
  stylesCss: text("styles_css"),
  timelineJs: text("timeline_js"),
  previewImageUrl: text("preview_image_url"),
  isPublic: boolean("is_public").default(true),
  tags: json("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_hf_templates_category").on(table.category),
  index("idx_hf_templates_preset").on(table.preset),
]);

// ── Type exports ─────────────────────────────────────────────────────────────
export type InsertVideoJob = typeof videoJobs.$inferInsert;
export type SelectVideoJob = typeof videoJobs.$inferSelect;
export type InsertVideoOutput = typeof videoOutputs.$inferInsert;
export type SelectVideoOutput = typeof videoOutputs.$inferSelect;
export type InsertHyperframesTemplate = typeof hyperframesTemplates.$inferInsert;
export type SelectHyperframesTemplate = typeof hyperframesTemplates.$inferSelect;

// ═══════════════════════════════════════════════════════════════
// CEX TRADING — Funding Rate Arbitrage & Multi-Exchange Support
// ═══════════════════════════════════════════════════════════════

/**
 * cex_exchange_keys — Encrypted per-artist API keys for CEX exchanges.
 * Each artist independently manages their own exchange connections.
 * API keys are stored AES-256-GCM encrypted using CEX_KEY_SECRET env var.
 *
 * ⚠️ RISK: Keys grant trading access. Protected by application-layer encryption.
 */
export const cexExchangeKeys = pgTable("cex_exchange_keys", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  exchangeId: text("exchange_id").notNull(), // 'bybit' | 'okx' | 'kraken' | 'bitget'
  label: text("label"),                       // optional user-friendly name
  apiKeyEnc: text("api_key_enc").notNull(),   // AES-256-GCM encrypted
  apiSecretEnc: text("api_secret_enc").notNull(),
  passphraseEnc: text("passphrase_enc"),      // OKX passphrase (encrypted)
  isTestnet: boolean("is_testnet").default(true).notNull(),
  permissions: json("permissions").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true).notNull(),
  lastVerifiedAt: timestamp("last_verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_cex_keys_artist").on(table.artistId),
  index("idx_cex_keys_exchange").on(table.exchangeId),
]);

/**
 * funding_arb_positions — Tracks open/closed funding rate arbitrage positions.
 * Each position = 1 spot BUY + 1 perp SHORT (delta-neutral).
 */
export const fundingArbPositions = pgTable("funding_arb_positions", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  exchangeId: text("exchange_id").notNull(),
  symbol: text("symbol").notNull(),           // e.g. 'BTC/USDT:USDT' (perp)
  spotSymbol: text("spot_symbol").notNull(),  // e.g. 'BTC/USDT' (spot)
  spotSizeUsd: decimal("spot_size_usd", { precision: 18, scale: 6 }).notNull(),
  perpSizeUsd: decimal("perp_size_usd", { precision: 18, scale: 6 }).notNull(),
  entryFundingRate: decimal("entry_funding_rate", { precision: 18, scale: 10 }).notNull(),
  currentFundingRate: decimal("current_funding_rate", { precision: 18, scale: 10 }).notNull(),
  accumulatedFundingUsd: decimal("accumulated_funding_usd", { precision: 18, scale: 6 }).default('0'),
  estimatedApr: decimal("estimated_apr", { precision: 10, scale: 4 }),
  netPnlUsd: decimal("net_pnl_usd", { precision: 18, scale: 6 }).default('0'),
  status: text("status", { enum: ['open', 'closed', 'error'] }).default('open').notNull(),
  closeReason: text("close_reason"),
  isTestnet: boolean("is_testnet").default(true).notNull(),
  spotOrderId: text("spot_order_id"),
  perpOrderId: text("perp_order_id"),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_farb_artist").on(table.artistId),
  index("idx_farb_status").on(table.status),
  index("idx_farb_exchange").on(table.exchangeId),
]);

/**
 * funding_rate_history — Historical record of funding rates from scans.
 * Used for trend analysis and opportunity validation.
 */
export const fundingRateHistory = pgTable("funding_rate_history", {
  id: serial("id").primaryKey(),
  exchangeId: text("exchange_id").notNull(),
  symbol: text("symbol").notNull(),
  rate: decimal("rate", { precision: 18, scale: 10 }).notNull(),
  annualizedRate: decimal("annualized_rate", { precision: 10, scale: 6 }).notNull(),
  intervalHours: integer("interval_hours").default(8),
  nextFundingAt: timestamp("next_funding_at"),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
}, (table) => [
  index("idx_frate_exchange_symbol").on(table.exchangeId, table.symbol),
  index("idx_frate_scanned").on(table.scannedAt),
]);

/**
 * cex_arb_opportunities — Detected arbitrage opportunities from the scanner.
 * Includes funding rate, basis trade, and DEX/CEX arbitrage opportunities.
 */
export const cexArbOpportunities = pgTable("cex_arb_opportunities", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ['funding', 'basis', 'dex_cex'] }).notNull(),
  exchangeA: text("exchange_a").notNull(),
  exchangeB: text("exchange_b"),               // for cross-exchange opportunities
  symbol: text("symbol").notNull(),
  spreadPct: decimal("spread_pct", { precision: 10, scale: 6 }),
  netSpreadAfterFees: decimal("net_spread_after_fees", { precision: 10, scale: 6 }),
  estimatedApr: decimal("estimated_apr", { precision: 10, scale: 4 }),
  requiredCapitalUsd: decimal("required_capital_usd", { precision: 18, scale: 2 }),
  status: text("status", { enum: ['detected', 'executing', 'completed', 'expired'] }).default('detected').notNull(),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("idx_arb_opp_status").on(table.status),
  index("idx_arb_opp_type").on(table.type),
  index("idx_arb_opp_detected").on(table.detectedAt),
]);

// CEX Trading Type exports
export type InsertCexExchangeKey = typeof cexExchangeKeys.$inferInsert;
export type SelectCexExchangeKey = typeof cexExchangeKeys.$inferSelect;
export type InsertFundingArbPosition = typeof fundingArbPositions.$inferInsert;
export type SelectFundingArbPosition = typeof fundingArbPositions.$inferSelect;
export type InsertFundingRateHistory = typeof fundingRateHistory.$inferInsert;
export type SelectFundingRateHistory = typeof fundingRateHistory.$inferSelect;
export type InsertCexArbOpportunity = typeof cexArbOpportunities.$inferInsert;
export type SelectCexArbOpportunity = typeof cexArbOpportunities.$inferSelect;

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST MARKETING CONTEXT
// ─────────────────────────────────────────────────────────────────────────────
// Stores AI-enriched marketing context for each artist, used to personalise
// every AI call across all profile modules (social hub, promo clips, ads, etc.)
// via the ai-skills-injector utility. Generated once and refreshed on demand.
// ─────────────────────────────────────────────────────────────────────────────
export const artistMarketingContext = pgTable("artist_marketing_context", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .unique()
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  // Core identity
  artistName: text("artist_name"),
  genre: text("genre").array(),
  subgenre: text("subgenre"),
  // Positioning
  targetAudience: text("target_audience"),
  brandVoice: text("brand_voice"),
  usp: text("usp"),                          // Unique Selling Proposition
  positioning: text("positioning"),
  // Goals & channels
  primaryGoals: text("primary_goals").array(),
  socialChannels: jsonb("social_channels").$type<Record<string, string>>(),
  keyReleases: jsonb("key_releases").$type<Array<{ title: string; year?: number; type?: string }>>(),
  // Content strategy
  contentPillars: text("content_pillars").array(),
  similarArtists: text("similar_artists").array(),
  differentiators: text("differentiators").array(),
  // Full compiled context as markdown (injected into AI prompts)
  contextMd: text("context_md"),
  lastGeneratedAt: timestamp("last_generated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_marketing_ctx_user").on(table.userId),
]);

export type InsertArtistMarketingContext = typeof artistMarketingContext.$inferInsert;
export type SelectArtistMarketingContext = typeof artistMarketingContext.$inferSelect;

// =====================================================
// FASHION VIRTUAL STORE — Artist fashion brand universe
// =====================================================

export const fashionBrands = pgTable("fashion_brands", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  brandName: text("brand_name").notNull(),
  tagline: text("tagline"),
  aesthetic: text("aesthetic"),
  colorPalette: text("color_palette").array().default(sql`'{}'::text[]`),
  typographyStyle: text("typography_style"),
  logoUrl: text("logo_url"),
  moodboardUrls: text("moodboard_urls").array().default(sql`'{}'::text[]`),
  brandManifesto: text("brand_manifesto"),
  brandStory: text("brand_story"),
  founded: text("founded"),
  influences: text("influences").array().default(sql`'{}'::text[]`),
  isPublished: boolean("is_published").notNull().default(false),
  shopifyStoreDomain: text("shopify_store_domain"),
  shopifyAccessToken: text("shopify_access_token"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uniq_fashion_brand_user").on(table.userId),
]);

export const fashionCollections = pgTable("fashion_collections", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => fashionBrands.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  season: text("season", { enum: ["spring_summer", "fall_winter", "limited", "capsule", "collab"] }).notNull().default("limited"),
  year: integer("year"),
  theme: text("theme"),
  inspiredBySong: text("inspired_by_song"),
  heroImageUrl: text("hero_image_url"),
  lookbookUrls: text("lookbook_urls").array().default(sql`'{}'::text[]`),
  status: text("status", { enum: ["upcoming", "active", "sold_out", "archived"] }).notNull().default("upcoming"),
  dropDate: timestamp("drop_date"),
  isLimited: boolean("is_limited").notNull().default(false),
  limitedQuantity: integer("limited_quantity"),
  tokenGated: boolean("token_gated").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fashion_coll_brand").on(table.brandId),
  index("idx_fashion_coll_user").on(table.userId),
]);

export const fashionProducts = pgTable("fashion_products", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").references(() => fashionCollections.id, { onDelete: "set null" }),
  brandId: integer("brand_id").references(() => fashionBrands.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category", { enum: ["top", "bottom", "outerwear", "footwear", "accessory", "headwear", "bodysuit", "set"] }).notNull().default("top"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"),
  compareAtPrice: decimal("compare_at_price", { precision: 10, scale: 2 }),
  productImageUrls: text("product_image_urls").array().default(sql`'{}'::text[]`),
  visualDirection: text("visual_direction"),
  colorways: text("colorways").array().default(sql`'{}'::text[]`),
  sizes: text("sizes").array().default(sql`'{"XS","S","M","L","XL","2XL"}'::text[]`),
  materials: text("materials").array().default(sql`'{}'::text[]`),
  printfulProductId: text("printful_product_id"),
  shopifyProductId: text("shopify_product_id"),
  isAvailable: boolean("is_available").notNull().default(true),
  stock: integer("stock").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fashion_prod_brand").on(table.brandId),
  index("idx_fashion_prod_coll").on(table.collectionId),
  index("idx_fashion_prod_user").on(table.userId),
]);

export const fashionCampaigns = pgTable("fashion_campaigns", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").references(() => fashionBrands.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  collectionId: integer("collection_id").references(() => fashionCollections.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  concept: text("concept"),
  campaignImages: text("campaign_images").array().default(sql`'{}'::text[]`),
  videoPrompt: text("video_prompt"),
  targetPlatforms: text("target_platforms").array().default(sql`'{}'::text[]`),
  hashtags: text("hashtags").array().default(sql`'{}'::text[]`),
  caption: text("caption"),
  status: text("status", { enum: ["draft", "ready", "published"] }).notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fashion_camp_brand").on(table.brandId),
]);

export const fashionTryonSessions = pgTable("fashion_tryon_sessions", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => fashionProducts.id, { onDelete: "set null" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  brandId: integer("brand_id").references(() => fashionBrands.id, { onDelete: "cascade" }),
  modelImageUrl: text("model_image_url").notNull(),
  garmentImageUrl: text("garment_image_url"),
  resultImageUrl: text("result_image_url"),
  isFanScene: boolean("is_fan_scene").notNull().default(false),
  fanName: text("fan_name"),
  isPublic: boolean("is_public").notNull().default(false),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fashion_tryon_brand").on(table.brandId),
  index("idx_fashion_tryon_prod").on(table.productId),
]);

export type InsertFashionBrand = typeof fashionBrands.$inferInsert;
export type SelectFashionBrand = typeof fashionBrands.$inferSelect;
export type InsertFashionCollection = typeof fashionCollections.$inferInsert;
export type SelectFashionCollection = typeof fashionCollections.$inferSelect;
export type InsertFashionProduct = typeof fashionProducts.$inferInsert;
export type SelectFashionProduct = typeof fashionProducts.$inferSelect;
export type InsertFashionCampaign = typeof fashionCampaigns.$inferInsert;
export type SelectFashionCampaign = typeof fashionCampaigns.$inferSelect;
export type InsertFashionTryonSession = typeof fashionTryonSessions.$inferInsert;
export type SelectFashionTryonSession = typeof fashionTryonSessions.$inferSelect;

// 🎭 Motion Capture Takes — recorded Live Link / webcam / phone / Rokoko-suit
// performances that drive the artist's 3D avatar in the hologram show. Each
// take is a timeline of bone-direction + face-blendshape frames captured while
// the artist performs (optionally to one of their songs), stored as JSON in
// Firebase Storage; this row holds the metadata + link so the performance can
// be replayed on the avatar for the hologram repertoire.
export const motionCaptureTakes = pgTable("motion_capture_takes", {
  id: serial("id").primaryKey(),
  // The artist (Postgres users.id) this take belongs to.
  artistId: integer("artist_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  // The user who recorded it (owner or collaborator).
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  // Optional song from the artist's repertoire this performance was sung to.
  songId: integer("song_id").references(() => songs.id, { onDelete: "set null" }),
  songTitle: text("song_title"),
  title: text("title").notNull(),
  // 'phone' | 'webcam' | 'suit' — where the motion came from.
  source: text("source").notNull().default("webcam"),
  // Public URL of the recorded motion timeline JSON in Firebase Storage.
  motionUrl: text("motion_url").notNull(),
  durationMs: integer("duration_ms").notNull().default(0),
  frameCount: integer("frame_count").notNull().default(0),
  fps: integer("fps").notNull().default(30),
  // Whether the recording carried facial blendshapes.
  hasFace: boolean("has_face").notNull().default(false),
  thumbnailUrl: text("thumbnail_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_mocap_takes_artist").on(table.artistId),
  index("idx_mocap_takes_song").on(table.songId),
]);

export type InsertMotionCaptureTake = typeof motionCaptureTakes.$inferInsert;
export type SelectMotionCaptureTake = typeof motionCaptureTakes.$inferSelect;

// ========================================
// LEGAL / DMCA / COPYRIGHT PROTECTION SYSTEM
// Safe-harbor infrastructure: fingerprints, consents, notices,
// counter-notices, strikes, artist verification, audit log.
// ========================================

// 4) Digital fingerprint of every uploaded file (evidence chain)
export const fileFingerprints = pgTable("file_fingerprints", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").defaultRandom().notNull().unique(),     // public reference id
  ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
  ownerEmail: text("owner_email"),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"),                                 // stored location (Firebase)
  mimeType: text("mime_type"),
  fileType: text("file_type"),                               // image | audio | video | document | other
  sizeBytes: integer("size_bytes").notNull().default(0),
  sha256: text("sha256").notNull(),                          // primary content hash
  md5: text("md5"),                                          // secondary hash
  perceptualHash: text("perceptual_hash"),                   // optional pHash for media dedupe
  uploadIp: text("upload_ip"),
  userAgent: text("user_agent"),
  scanStatus: text("scan_status", { enum: ["pending", "clean", "flagged", "rejected"] }).default("pending").notNull(),
  scanReport: jsonb("scan_report"),                          // {malware,corrupt,format,duplicateOf,metadata,...}
  isDuplicateOf: integer("is_duplicate_of"),                 // references another fingerprint id
  consentId: integer("consent_id"),                          // upload_consents.id
  status: text("status", { enum: ["active", "disabled", "removed"] }).default("active").notNull(),
  history: jsonb("history").default(sql`'[]'::jsonb`),       // [{action,at,by,note}]
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_fingerprints_owner").on(table.ownerId),
  index("idx_fingerprints_sha256").on(table.sha256),
  index("idx_fingerprints_status").on(table.status),
]);
export type InsertFileFingerprint = typeof fileFingerprints.$inferInsert;
export type SelectFileFingerprint = typeof fileFingerprints.$inferSelect;

// 3) Mandatory consent captured before each upload (rights, no false claims,
//    storage/distribution authorization, DMCA/ToS acceptance)
export const uploadConsents = pgTable("upload_consents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  userEmail: text("user_email"),
  ownsRights: boolean("owns_rights").notNull().default(false),
  noFalseDeclaration: boolean("no_false_declaration").notNull().default(false),
  authorizesStorageDistribution: boolean("authorizes_storage_distribution").notNull().default(false),
  acceptsDmcaTos: boolean("accepts_dmca_tos").notNull().default(false),
  contentType: text("content_type"),                         // upload | song | image | video | avatar | etc.
  contextRef: text("context_ref"),                           // free-form reference (page/module)
  consentIp: text("consent_ip"),
  userAgent: text("user_agent"),
  consentVersion: text("consent_version").default("1.0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_consents_user").on(table.userId),
]);
export type InsertUploadConsent = typeof uploadConsents.$inferInsert;
export type SelectUploadConsent = typeof uploadConsents.$inferSelect;

// 2) DMCA Notice & Takedown — incoming infringement claims
export const dmcaTakedowns = pgTable("dmca_takedowns", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").defaultRandom().notNull().unique(),     // case number reference
  // Complainant (rights holder)
  claimantName: text("claimant_name").notNull(),
  claimantEmail: text("claimant_email").notNull(),
  claimantOrg: text("claimant_org"),
  claimantAddress: text("claimant_address"),
  claimantPhone: text("claimant_phone"),
  // Subject of the claim
  targetUserId: integer("target_user_id").references(() => users.id, { onDelete: "set null" }),
  targetUrl: text("target_url"),                             // allegedly infringing URL on platform
  fingerprintId: integer("fingerprint_id").references(() => fileFingerprints.id, { onDelete: "set null" }),
  workDescription: text("work_description").notNull(),       // the copyrighted work
  infringementDescription: text("infringement_description").notNull(),
  // Sworn statements (17 U.S.C. §512(c)(3))
  goodFaithStatement: boolean("good_faith_statement").notNull().default(false),
  accuracyStatement: boolean("accuracy_statement").notNull().default(false),
  authorizedSignature: text("authorized_signature").notNull(),  // electronic signature
  evidenceUrls: jsonb("evidence_urls").default(sql`'[]'::jsonb`),
  // Workflow
  status: text("status", {
    enum: ["received", "under_review", "content_disabled", "counter_received", "reinstated", "rejected", "resolved"]
  }).default("received").notNull(),
  contentDisabledAt: timestamp("content_disabled_at"),
  assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
  resolutionNote: text("resolution_note"),
  submitterIp: text("submitter_ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_dmca_status").on(table.status),
  index("idx_dmca_target_user").on(table.targetUserId),
  index("idx_dmca_email").on(table.claimantEmail),
]);
export type InsertDmcaTakedown = typeof dmcaTakedowns.$inferInsert;
export type SelectDmcaTakedown = typeof dmcaTakedowns.$inferSelect;

// 2b) Counter-notification from the affected user (17 U.S.C. §512(g))
export const dmcaCounterNotices = pgTable("dmca_counter_notices", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").defaultRandom().notNull().unique(),
  takedownId: integer("takedown_id").references(() => dmcaTakedowns.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  address: text("address").notNull(),
  phone: text("phone"),
  statementUnderPenalty: boolean("statement_under_penalty").notNull().default(false),
  consentToJurisdiction: boolean("consent_to_jurisdiction").notNull().default(false),
  explanation: text("explanation").notNull(),
  signature: text("signature").notNull(),
  status: text("status", { enum: ["received", "forwarded", "reinstated", "rejected"] }).default("received").notNull(),
  submitterIp: text("submitter_ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_counter_takedown").on(table.takedownId),
  index("idx_counter_user").on(table.userId),
]);
export type InsertDmcaCounterNotice = typeof dmcaCounterNotices.$inferInsert;
export type SelectDmcaCounterNotice = typeof dmcaCounterNotices.$inferSelect;

// 5b) Strike scoring per user (repeat-infringer policy → auto-suspend at 3)
export const artistStrikes = pgTable("artist_strikes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  strikeCount: integer("strike_count").notNull().default(0),
  totalClaims: integer("total_claims").notNull().default(0),
  counterClaims: integer("counter_claims").notNull().default(0),
  resolvedClaims: integer("resolved_claims").notNull().default(0),
  pendingClaims: integer("pending_claims").notNull().default(0),
  suspended: boolean("suspended").notNull().default(false),
  suspendedAt: timestamp("suspended_at"),
  lastStrikeAt: timestamp("last_strike_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_strikes_user").on(table.userId),
]);
export type InsertArtistStrike = typeof artistStrikes.$inferInsert;
export type SelectArtistStrike = typeof artistStrikes.$inferSelect;

// 9) Artist verification levels
//   verified(🟢) | label(🔵) | distributor(🟠) | company(🟣) | rights_admin(🔴)
export const artistVerifications = pgTable("artist_verifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  level: text("level", {
    enum: ["none", "verified", "label", "distributor", "company", "rights_admin"]
  }).default("none").notNull(),
  legalName: text("legal_name"),
  organization: text("organization"),
  taxId: text("tax_id"),
  documentsUrls: jsonb("documents_urls").default(sql`'[]'::jsonb`),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  reviewedBy: integer("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewNote: text("review_note"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_verifications_user").on(table.userId),
  index("idx_verifications_status").on(table.status),
]);
export type InsertArtistVerification = typeof artistVerifications.$inferInsert;
export type SelectArtistVerification = typeof artistVerifications.$inferSelect;

// 2/10) Immutable audit log for every legal action (evidence for safe harbor)
export const legalAuditLog = pgTable("legal_audit_log", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorEmail: text("actor_email"),
  action: text("action").notNull(),                          // e.g. takedown.received, content.disabled, content.reinstated
  entityType: text("entity_type"),                           // dmca | counter | fingerprint | verification | strike
  entityId: integer("entity_id"),
  detail: jsonb("detail"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_audit_action").on(table.action),
  index("idx_audit_entity").on(table.entityType, table.entityId),
  index("idx_audit_created").on(table.createdAt),
]);
export type InsertLegalAuditLog = typeof legalAuditLog.$inferInsert;
export type SelectLegalAuditLog = typeof legalAuditLog.$inferSelect;

// ─── Investor Room — interactive pitch-deck agent + feedback capture ─────────
/**
 * Investor Feedback — captures an investor's points of view shared through the
 * interactive pitch-deck agent. On submit we email the owner a copy and send the
 * investor a professional acknowledgement.
 */
export const investorFeedback = pgTable("investor_feedback", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  investorType: text("investor_type", {
    enum: ["individual", "corporate", "institutional", "other"],
  }).default("individual"),
  interestLevel: text("interest_level", {
    enum: ["low", "medium", "high"],
  }).default("medium"),
  viewpoints: text("viewpoints").notNull(),
  chatTranscript: jsonb("chat_transcript"),
  emailedOwner: boolean("emailed_owner").default(false),
  emailedInvestor: boolean("emailed_investor").default(false),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_investor_feedback_email").on(table.email),
  index("idx_investor_feedback_created").on(table.createdAt),
]);
export type InsertInvestorFeedback = typeof investorFeedback.$inferInsert;
export type SelectInvestorFeedback = typeof investorFeedback.$inferSelect;
