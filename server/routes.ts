import type { Express } from "express";
import { createServer, type Server as HttpServer } from "http";
// NOTE: Auth is now handled by Clerk - see server/middleware/clerk-auth.ts
import { setupInstagramRoutes } from "./instagram";
import { setupSpotifyRoutes } from "./spotify";
import { setupOpenAIRoutes } from "./routes/openai";
import { setupEducationRoutes } from "./routes/education";
import educationProgressiveRouter from "./routes/education-progressive";
import { setupFilesRoutes } from "./routes/files";
import stripeRouter from "./routes/stripe";
import { setupVideosRoutes } from "./routes/videos";
import videoNotesRouter, { registerVideoNotesList } from "./routes/video-notes";
import { setupEmailRoutes } from "./routes/email";
import { setupApifyRoutes } from "./routes/apify";
import { setupLeadRoutes } from "./routes/leads";
import { setupSocialNetworkRoutes } from "./routes/social-network.setup";
import { setupSubscriptionRoutes } from "./routes/subscription-protected-routes";
import firestoreSocialNetworkRouter from "./routes/firestore-social-network";
import { db } from "./db";
import { marketingMetrics, contracts, bookings, payments, analyticsHistory, events, courseEnrollments, users, subscriptions } from "./db/schema";
import { eq, and, desc, gte, lte, inArray } from "drizzle-orm";
import Stripe from 'stripe';
import { z } from "zod";
import express from 'express';
import passport from 'passport';
import axios from 'axios';
import { createTrackedOpenAI } from "./utils/tracked-openai";
import { insertBookingSchema } from "./db/schema";
import translationRouter from './routes/translation';
import managerRouter from './routes/manager';
import managerDocumentsRouter from './routes/manager-documents';
import artistRouter from './routes/artist';
import artistGeneratorRouter from './routes/artist-generator'; // Added import
import artistBlueprintRouter from './routes/artist-blueprint'; // Superstar Blueprint routes
import emotionalStudioRouter from './routes/emotional-studio'; // Emotional Studio routes
import marketingContextRouter from './routes/marketing-context'; // Marketing Context & Skills API
import legalRouter from './routes/legal'; // Legal / DMCA / Copyright protection system
import artistFanLeadsRouter from './routes/artist-fan-leads';
import fanClubRouter from './routes/fan-club'; // Fan Email Capture & Nurture
import artistDomainRouter from './routes/artist-domain'; // Artist Domain Manager routes
import subscriptionRoutesRouter from './routes/subscription-routes'; // Nuevas rutas específicas por nivel de suscripción
import coursesRouter from './routes/courses';
import achievementsRouter from './routes/achievements';
import klingApiRouter from './routes/kling-api'; // Importamos el router de Kling API
import klingLipsyncRouter from './routes/kling-lipsync'; // Importamos el router de LipSync
import klingTestRouter from './routes/kling-test'; // Importamos el router de pruebas de Kling
import videoGenerationRouter from './routes/video-generation'; // Direct router for PiAPI video generation
import videoUpscaleRouter from './routes/video-upscale'; // Router for video upscaling with Qubico/video-toolkit
import investorsRouter from './routes/investors';
import adminInvestorPaymentsRouter from './routes/admin-investor-payments';
import generatedArtistsRouter from './routes/generated-artists';
import professionalEditorRouter from './routes/admin-routes/professional-editor'; // Router para Editor Profesional con Firebase Admin SDK
import apiProxyRouter from './routes/api-proxy'; // Import the proxy router for external APIs
import videoStatusRouter from './routes/video-status'; // Import the dedicated router for video status
import musicRouter from './routes/music'; // Import the music generation router
import kitsAiRouter from './routes/kits-ai'; // Import the Kits.ai audio tools router
import masteringRouter from './routes/mastering'; // Import the AI Mastering Suite (FAL: demucs, stable-audio, f5-tts, wizper)
import uploadApiRouter from './routes/upload-api'; // Import the upload API router for image processing
import uploadImageRouter from './routes/upload-image'; // POST /api/upload-image (cover artwork & generic image uploads -> Firebase Storage)
import fluxApiRouter from './routes/flux-api-proxy'; // Import the Flux API router
import affiliateRouter from './routes/affiliate'; // Import the affiliate program router
import affiliateTrackingRouter from './routes/affiliate-tracking'; // Import the affiliate tracking router
import prAgentRouter from './routes/pr-agent'; // Import the PR Agent router
import prAIRouter from './routes/pr-ai'; // Import the PR AI helper router
import epkRouter from './routes/epk'; // Import the EPK generator router
import geminiImageRouter from './routes/gemini-image'; // Import the Gemini image generation router
import artistProfileRouter from './routes/artist-profile'; // Import the artist profile generation router
import imageGalleryRouter from './routes/image-gallery'; // Import the image gallery router
import audioTranscriptionRouter from './routes/audio-transcription'; // Import the audio transcription router
import generatedVideosRouter from './routes/generated-videos'; // Import the generated videos router
import minimaxVideoRouter from './routes/minimax-video'; // Import the MiniMax video generation router
import musiciansRouter from './routes/musicians'; // Import the musicians router
import musicianImportRouter from './routes/musician-import'; // Bulk import musicians (CSV/JSON)
import musicianMessagingRouter from './routes/musician-messaging'; // Musician <-> client messaging + contracts
import miniStudioLyricsRouter from './routes/mini-studio-lyrics'; // Mini studio AI lyrics
import miniStudioRouter from './routes/mini-studio'; // Mini Studio DAW projects + AI generation
import songDnaSavedRouter from './routes/song-dna-saved'; // Song DNA saved analyses persistence
import serviceRequestsRouter from './routes/service-requests'; // Import service requests & bidding system
import studioRouter from './routes/studio'; // Import studio projects & version control
import musicVideoProjectsRouter from './routes/music-video-projects'; // Import the music video projects router
import videoProjectsRouter from './routes/video-projects'; // Timeline export (Shotstack render) + project images
import musicianClipsRouter from './routes/musician-clips'; // Import the musician clips router for timeline
import cameraAnglesRouter from './routes/camera-angles'; // Import the camera angles router
import profileRouter from './routes/profile'; // Import the profile router
import videoConceptsRouter from './routes/video-concepts'; // Boostify Video Concepts (premium event-film service)
import cinematicEventsRouter from './routes/cinematic-events'; // Cinematic Event Landing (isolated guest experience)
import performanceSegmentsRouter from './routes/performance-segments'; // Import the performance segments router
import songsRouter from './routes/songs'; // Import the songs router
import merchRouter from './routes/merch'; // Import the merchandise router
import storeEnhancementsRouter from './routes/store-enhancements'; // Official Store bundles, views, AI content, seasonal drops, pre-orders
import marketingRouter from './routes/marketing'; // Import the marketing router
import aiAssistantRouter from './routes/ai-assistant'; // Import the AI assistant router
import albumGeneratorRouter from './routes/album-generator'; // Import the album generator router
import geminiAgentsRouter from './routes/gemini-agents'; // Import the Gemini agents router
import aiAgentsRouter from './routes/agents'; // Import AI Agents System router
import agentsSdkRouter from './routes/agents-sdk'; // Import OpenAI Agents SDK router
import agentMarketplaceRouter from './routes/agent-marketplace'; // Import Agent Marketplace router
import aiAdvisorRouter from './routes/ai-advisor'; // Import AI Advisor Chat router
import contractsRouter from './routes/contracts'; // Import the contracts router with Gemini AI
import falApiRouter from './routes/fal-api'; // Import the FAL AI router for secure backend processing
import creditsRouter from './routes/credits'; // Import the credits and payments router
import adminPricingRouter from './routes/admin-pricing'; // Import the admin pricing management router
import videoBudgetRouter from './routes/video-budget'; // Import Video Budget system (pre-generation payment)
import faceAnalysisRouter from './routes/face-analysis'; // Import the face analysis router
import videoRenderingRouter from './routes/video-rendering'; // Import the video rendering router with Shotstack
import diagnosticsRouter from './routes/diagnostics'; // Import diagnostics router for system health checks
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs for tasks
import { authenticate } from './middleware/auth';
import { awardCourseCompletionAchievement } from './achievements';
import { setupFiverServicesRoutes } from './routes/fiverr-services';
import { setupOutreachRoutes } from './routes/outreach'; // Music industry contacts outreach system
import apiProxySecure from './routes/api-proxy-secure';
import firebaseTokenRouter from './routes/firebase-token'; // Import Firebase token generator
import artistWalletRouter from './routes/artist-wallet'; // Import Artist Wallet for earnings and credits
import motionDnaImagesRouter from './routes/motion-dna-images'; // Import MotionDNA images router
import printfulRouter from './routes/printful'; // Import Printful integration router
import merchContractRouter from './routes/merch-contract'; // Import Merch Collaboration Contract router
import artistStoreRouter from './routes/artist-store'; // Import Artist Store (public catalog) router
import amazonCuratedRouter from './routes/amazon-curated'; // Import Amazon Cultural Storefront (curated affiliate picks) router
import fashionStoreRouter from './routes/fashion-store'; // Fashion Virtual Store — artist fashion brand universe
import fanMonetizationRouter from './routes/fan-monetization'; // Fan monetization — pay-what-you-want catalog unlock
import moduleUnlocksRouter from './routes/module-unlocks'; // Module unlocks — one-time platform module purchases
import artistCardWalletRouter from './routes/artist-card-wallet'; // Artist Card wallet resolver (iOS/Android + fallback)
import merchConfigRouter from './routes/merch-config'; // Import Merch Store Configuration router
import merchMarketingRouter from './routes/merch-marketing'; // Import Merch Marketing Hub router
import merchAnalyticsRouter from './routes/merch-analytics'; // Import Merch Analytics router
import crowdfundingRouter from './routes/crowdfunding'; // Import Crowdfunding router
import tvMonetizationRouter from './routes/tv-monetization'; // Import TV Monetization (tips, revenue) router
import tvContentRouter from './routes/tv-content'; // Boostify TV Content (categories, AI generation, schedule)
import tokenizationRouter from './routes/tokenization'; // Import Tokenization (Web3/Blockchain) router
import btfServicesRouter from './routes/btf-services'; // Import BTF Token Economy services router
import btfCardPurchaseRouter from './routes/btf-card-purchase'; // Import BTF Card Purchase (Stripe USD → BTF)
import btfLegalRouter from './routes/btf-legal'; // Import BTF Legal Acknowledgement router
import adminImportArtistsRouter from './routes/admin-import-artists'; // Import Admin artists import router
import virtualRecordLabelRouter from './routes/virtual-record-label'; // Import Virtual Record Label integration router
import ogImageRouter from './routes/og-image.tsx'; // Import Open Graph image generator
import youtubeToolsRouter from './routes/youtube-tools'; // Import YouTube Growth Tools (Gemini AI + Apify)
import tiktokToolsRouter from './routes/tiktok-tools'; // Import TikTok Growth Tools (AI-powered)
import spotifyToolsRouter from './routes/spotify-tools'; // Import Spotify Growth Tools (Gemini AI + Apify)
import spotifyExtensionRouter from './routes/spotify-extension'; // Spotify Chrome Extension Sync API
import spotifyAiAgentRouter from './routes/spotify-ai-agent'; // Spotify AI Agent (OpenClaw-powered)
import instagramToolsRouter from './routes/instagram-tools'; // Import Instagram Boost AI Tools (Gemini AI)
import instagramOAuthRouter from './routes/instagram-oauth'; // Import Instagram OAuth for real API connection
import tiktokAuthRouter from './routes/tiktok-auth'; // TikTok OAuth Login Kit v2
import youtubeAuthRouter from './routes/youtube-auth'; // YouTube OAuth — connect channel for lyric-video publishing
import musicVideoRouter from './routes/music-video'; // Import Music Video Concept Generation (Gemini AI)
import audioAnalysisRouter from './routes/audio-analysis'; // Import Audio Analysis for intelligent video editing
import autoEditRouter from './routes/auto-edit'; // Import Auto-Edit Engine for genre-based intelligent editing
import artistProfilesRouter from './routes/artist-profiles'; // Import Artist Profiles auto-generation
import apifyInstagramRouter from './routes/apify-instagram'; // Import Apify Instagram integration for real data
import viralProductsRouter from './routes/viral-products'; // Import Viral Product Content Generator (TikTok Shop + FAL AI)
import influencerBrandsRouter from './routes/influencer-brands'; // Import Influencer Brand Collaborations (Artist × Brand Content)
import businessPlanRouter from './routes/business-plan'; // Import Artist Business Plan (financial planning, pitch deck, roadmap)
import investorRoomRouter from './routes/investor-room'; // Interactive pitch-deck investor agent + feedback capture
import fashionStudioRouter from './routes/fashion-studio'; // Import Artist Fashion Studio (FAL + Gemini)
import myUniverseRouter from './routes/my-universe'; // My Universe — artist discography landing page
import financialImagesRouter from './routes/financial-images'; // Financial Enablement marketing images (OpenAI gpt-image-1)
import hologauzeImagesRouter from './routes/hologauze-images'; // Hologauze Live Concert System — AI-generated marketing imagery (cached)
import notificationsRouter from './routes/notifications'; // Import Notifications router for internal messaging
import webhookStripeRouter from './routes/webhook-stripe'; // Import Stripe Webhook handler
import resendWebhooksRouter from './routes/resend-webhooks'; // Import Resend Email Webhooks handler (legacy)
import brevoWebhooksRouter from './routes/brevo-webhooks'; // Import Brevo Email Webhooks handler
import subscriptionApiRouter from './routes/subscription-api'; // Import Subscription API routes (PostgreSQL)
import apiUsageRouter from './routes/api-usage'; // Import API usage monitoring router
import accountingRouter from './routes/accounting'; // Import accounting/transactions router
import adminAgentRouter from './routes/admin-agent'; // Import AI admin agent
import contentModerationRouter from './routes/content-moderation'; // Import Content Moderation (AI safety)
import adminReportsRouter, { startWeeklyReportScheduler } from './routes/admin-reports'; // Import Admin Reports & Diagnostics router
import codeEngineRouter from './routes/code-engine'; // Import AI Code Engine router
import stripeEventsAdminRouter from './routes/stripe-events-admin'; // Import Stripe Events admin router
import adminUsersRouter from './routes/admin-users'; // Import Admin Users management router
import boostiswapContractsRouter from './routes/boostiswap-contracts'; // Import BoostiSwap Smart Contracts router
import boostiswapRouter from './routes/boostiswap'; // Import BoostiSwap Marketplace router
import adminBoostiswapArtistsRouter from './routes/admin-boostiswap-artists'; // Import BoostiSwap Artists admin management router
import adminArtistsRouter from './routes/admin-artists'; // Import admin artists route
import adminArtistLeadsRouter from './routes/admin-artist-leads'; // Import admin artist leads (music industry contacts)
import adminArtistDiscoveryRouter from './routes/admin-artist-discovery'; // Import Artist Discovery Agent routes
import adminArtistAcquisitionRouter from './routes/admin-artist-acquisition'; // Artist Acquisition System dashboard aggregator
import adminArtistIdentityRouter from './routes/admin-artist-identity'; // Artist Identity & Account Provisioning System (AIAPS)
import webhooksAiapsRouter from './routes/webhooks-aiaps'; // Public webhooks for AIAPS (Twilio SMS, inbound email)
import { startScheduler as startAiapsScheduler } from './services/aiaps/scheduler';
import adminBoostifyAlliancesRouter from './routes/admin-boostify-alliances'; // Boostify Alliances admin dashboard aggregator
import { startDiscoveryScheduler } from './services/artist-discovery'; // Artist Discovery scheduler
import { startAutoGeneration } from './services/artist-discovery/contacts-to-artists'; // Auto-generation scheduler
import artistActivationRouter from './routes/artist-activation'; // Artist Activation Engine routes
import { startActivationScheduler } from './services/artist-activation'; // Activation drip scheduler
import artistEnrichmentRouter from './routes/artist-enrichment'; // Artist Enrichment Agent routes
import { startEnrichmentScheduler } from './services/artist-enrichment'; // Artist Enrichment scheduler
import adminCSuiteRouter from './routes/admin-c-suite'; // C-Suite AI executive team admin endpoints
import adminSongAnalysisRouter from './routes/admin-song-analysis'; // Admin Song Analyzer + promote helpers
import songPromotionRouter from './routes/song-promotion'; // Lazy Firestore→Postgres sync for promote button
import promoteEngineRouter from './routes/promote-engine'; // Cinematic promo pipeline (LoRA + flux-pro/kontext)
import artistSuiteRouter, { adminArtistSuiteRouter } from './routes/artist-suite'; // Artist Career Suite (Elite tier, per-artist)
import socialMediaRouter from './routes/social-media'; // Import Social Media Content Generator router
import platformAnalyticsRouter from './routes/platform-analytics'; // Import Platform Analytics (real DB stats)
import { seedTokenizedSongs } from './seed-tokenized-songs'; // Import seed function
import educationGeminiRouter from './routes/education-gemini'; // Import Education Gemini AI router for course generation
import renderQueueRouter from './routes/render-queue'; // Import Render Queue for video pipeline processing
import voiceAiRouter from './routes/voice-ai'; // Import Voice AI router for voice cloning and transformation
import monetizationRouter from './routes/monetization'; // Import Monetization router for revenue tracking
import aiIntelligenceRouter from './routes/ai-intelligence'; // Import AI Intelligence (News, Whisper, Outreach)
import youtubeExtensionRouter from './routes/youtube-extension'; // Import YouTube Chrome Extension Sync API
import instagramExtensionRouter from './routes/instagram-extension'; // Import Instagram Chrome Extension Sync API
import sponsorApiRouter from './routes/sponsor-api'; // Sponsor Acquisition Module (search, campaigns, deals, payments)
import lyricsWorkflowRouter from './routes/lyrics-workflow'; // Lyrics Copywrite Workflow (authorship traceability)
import copyrightCertRouter from './routes/copyright-certification'; // Copyright Certification (SHA-256 + Polygon)
import venueOutreachRouter from './routes/venue-outreach'; // Venue Booking Outreach (Google Maps scrape + email proposals)
import explicitRouter from './routes/explicit'; // Boostify Explicit — Exclusive Content Module
import aasRouter from './routes/aas-core'; // AAS — Autonomous Artist Survival System
import artistModulesStatusRouter from './routes/artist-modules-status'; // Unified health snapshot for the 6 artist modules
import instagramAiAgentRouter from './routes/instagram-ai-agent'; // Instagram AI Agent (OpenClaw-powered growth assistant)
import instagramContentGenRouter from './routes/instagram-content-gen'; // Instagram Visual Content Generator (OpenAI images + fal.ai video)
import choreographyRouter from './routes/choreography'; // Choreography — Dance motion transfer (DreamActor v2)
import videoserviceRouter from './routes/videoservice'; // Video Service — Landing page lead capture & Stripe deposits
import { startFollowUpScheduler } from './services/sponsor-followup-scheduler'; // Auto follow-up scheduler
import podcastStudioRouter from './routes/podcast-studio'; // Live Podcast Studio API
import audienceCaptureRouter from './routes/audience-capture'; // Audience Capture Engine
import { initSocketIO } from './socket'; // Socket.io for real-time podcast communication
import { initHolostageGateway } from './holostage-gateway'; // HoloStage real-time orchestrator bridge (/ws/holostage)
import artistIntelRouter from './routes/artist-intelligence'; // Artist Intelligence Engine (cross-platform stats, growth, competitors)
import publishingRouter from './routes/publishing'; // Publishing & Sync Licensing Hub (briefs, submissions, deals, pitching)
import musicIntelRouter from './routes/music-intelligence'; // Playlist & Chart Intelligence (editorial tracking, global charts)
import songIntelRouter from './routes/song-intelligence'; // Song DNA & Market Analysis (audio features, demographics, market potential)
import tourIntelRouter from './routes/tour-intelligence'; // Tour Intelligence (opening acts, festivals, venues)
import mcpServerRouter from './routes/mcp-server'; // MCP Server — AI agent tools protocol (SSE + HTTP)
import newsRouter from './routes/news'; // Boostify News — AI-generated daily articles
import artistShareRouter from './routes/artist-share'; // Artist profile social share cards (OG image + meta page)
import stageSyncRouter from './routes/stage-sync'; // Boostify StageSync AI — live show production module
import hologramShowRouter from './routes/hologram-show'; // Boostify Hologram Live Show Engine — lead capture + FAL asset generation
import crowdSyncDjRouter from './routes/crowdsync-dj'; // Boostify CrowdSync DJ — live crowd intelligence module
import liveStageRouter from './routes/live-stage'; // Boostify Live Stage — live video monetization module
import concertsRouter from './routes/concerts'; // Concert Command Center — events, tickets, messaging
import seatMapRouter from './routes/seat-map'; // Live Ticketing & Seat Map Engine — venues, seats, holds
import adminConcertsRouter from './routes/admin-concerts'; // Admin — concert commission settings + reports
import legacyCatalogResurrectionRouter from './routes/legacy-catalog-resurrection'; // Catalog Resurrection Engine — archive catalog revival module
import artistGrowthEngineRouter from './routes/artist-growth-engine'; // Artist Growth Engine — $500 master product + 2-sales expansion rule
import investorDocsRouter from './routes/investor-docs'; // Investor Documents — Juno 2.0 CLO Negotiation System
import hermesRouter from './routes/hermes'; // Hermes Agent Integration — REST API for AI agent memory/tools
import artistHermesProxyRouter from './routes/artist-hermes-proxy'; // Hermes Proxy — Clerk-authenticated frontend facade
import agentGatewayRouter from './routes/agent-gateway'; // Artist Agent Gateway — communication system
import seoRouter from './routes/seo'; // SEO — sitemap.xml, robots.txt, news-sitemap
import { shouldRunSchedulers } from './bootstrap/role'; // Gate background schedulers by service role
import { cacheRoute } from './middleware/cache-route'; // Short-TTL response cache for hot public reads
import { startDailyNewsScheduler, startArtistNewsAutopilot } from './services/news-generator'; // Daily news article auto-generation
import { startReleasePublisher } from './services/release-publisher'; // Scheduled song release publisher
import autoMusicRouter from './routes/auto-music'; // Music Auto-Pilot — scheduled auto-generation from catalog references
import { startAutoMusicScheduler } from './services/auto-music-scheduler'; // Music Auto-Pilot scheduler
import influencerContentRouter from './routes/influencer-content'; // Influencer Module — content pipeline, voice, avatar, scheduling
import { startInfluencerContentScheduler } from './services/influencer-content-scheduler'; // Influencer auto-generation scheduler
import promoClipsRouter from './routes/promo-clips'; // Promo Clips — Song-to-Visual Lipsync Engine (FAL OmniHuman + Sync-3)
import artistCommandRouter from './routes/artist-command'; // Artist Command Engine — voice/text commands → AI module orchestration
import whatsappRouter from './routes/whatsapp'; // WhatsApp Artist Command Center — OpenWA gateway, fans, campaigns, AI agent
import promoContentRouter from './routes/promo-content'; // Promo Content Library — songs/videos/products/tickets/gallery as ready promo links
import telegramRouter from './routes/telegram'; // Telegram Artist Command Center — Bot API gateway, fans, campaigns, communities, AI agent
import facebookGroupsRouter from './routes/facebook-groups'; // Facebook Groups — controlled auto-publishing engine (Hybrid mode)
import { startFacebookGroupsScheduler } from './services/facebook-groups-scheduler'; // FB Groups queue prep + readiness scheduler
import redditRouter from './routes/reddit'; // Reddit Artist Intelligence Center — read-only market intelligence, fan discovery, trends, AI strategy
import discordRouter from './routes/discord'; // Discord Fan Nation — community hub: OAuth2 + bot, server setup, roles, BTF token gate, campaigns, events, AI moderator & concierge
import adsCampaignsRouter from './routes/ads-campaigns'; // Ads Campaign Manager — Facebook, Instagram, TikTok paid ads
import contentEngineRouter from './routes/content-engine'; // Artist Content Engine - unified assets + orchestration plans
import gammaPresentationsRouter from './routes/gamma-presentations'; // Gamma AI Presentations — slide decks from artist context
import hologramGalleryRouter from './routes/hologram-gallery'; // Hologram AI Gallery — FAL Flux Pro Kontext
import motionCaptureRouter from './routes/motion-capture'; // Motion Capture — phone-QR Live Link + recorded takes
import karaokeRouter from './routes/karaoke'; // Karaoke — Whisper-synced lyrics player
import lyricsVideoRouter from './routes/lyrics-video'; // Lyrics Video — Remotion karaoke 16:9 MP4 (YouTube)
import avatarTalkRouter from './routes/avatar-talk'; // Avatar Talk — HeyGen Avatar4 image-to-video
import aiVideoStudioRouter from './routes/ai-video-studio'; // AI Video Studio — Boostify HyperFrame Video Engine
import nodeWorkflowRouter from './routes/node-workflow'; // Node Workflow — AI canvas automation save/load
import nodeFlowAgentRouter from './routes/node-flow-agent'; // Node Flow Agent — AI command coordinator
import { workflowScheduler } from './services/workflow-scheduler'; // Cron scheduler for ScheduleTrigger nodes
import { PRIMARY_MODEL } from './utils/ai-config';


if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing Stripe secret key');
}

// Initialize OpenAI
const openai = createTrackedOpenAI({ apiKey: process.env.VITE_OPENAI_API_KEY });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-01-27.acacia' as any, // Actualizada marzo 2025
});

// Export the configured server
export async function registerRoutes(app: Express): Promise<HttpServer> {
  // API Proxy seguro para producción
  app.use('/api/proxy', apiProxySecure);

  // ─── Node Workflow — AI canvas automation ────────────────────────────────────
  app.use('/api/node-workflow', nodeWorkflowRouter);
  
  // ─── Node Flow Agent — AI command coordinator ────────────────────────────────
  app.use('/api/node-flow-agent', nodeFlowAgentRouter);

  // ─── INVESTOR DOCUMENTS — Juno 2.0 CLO System ────────────────────────────────
  app.use('/api/investor-docs', investorDocsRouter);
  
  // IMPORTANTE: Configurar rutas públicas antes de cualquier middleware de autenticación
  
  // Ruta pública para obtener la clave publicable de Stripe (fuera de cualquier middleware de autenticación)
  app.get('/api/stripe/publishable-key', (req, res) => {
    console.log('Accediendo a clave publicable de Stripe (ruta global)');
    res.json({
      key: process.env.STRIPE_PUBLISHABLE_KEY || '',
      success: true
    });
  });
  
  // Auth middleware is configured via Clerk in server/index.ts
  // Session handling is done by Clerk's clerkMiddleware()

  // Endpoint público para buscar artista por slug (usado por artist-profile.tsx)
  // Cacheado 30s por slug: la página fanea ~6 llamadas idénticas por carga y el
  // perfil público cambia rara vez → evita golpear Neon en cada request.
  app.get('/api/artist/by-slug/:slug', cacheRoute(30, req => `artist-by-slug:${req.params.slug}`), async (req, res) => {
    try {
      const { slug } = req.params;
      console.log(`🔍 Buscando artista con slug: ${slug}`);
      
      // Buscar en PostgreSQL
      const artist = await db.select().from(users).where(eq(users.slug, slug)).limit(1);
      
      if (artist.length > 0) {
        const artistData = artist[0];
        console.log(`✅ Artista encontrado en PostgreSQL: ${artistData.artistName}`);
        
        res.json({
          success: true,
          artist: {
            id: artistData.id,
            firestoreId: artistData.firestoreId || String(artistData.id),
            artistName: artistData.artistName,
            slug: artistData.slug,
            biography: artistData.biography,
            profileImage: artistData.profileImage,
            coverImage: artistData.coverImage,
            genres: artistData.genres,
            country: artistData.country,
            location: artistData.location,
            instagramHandle: artistData.instagramHandle,
            twitterHandle: artistData.twitterHandle,
            youtubeHandle: artistData.youtubeHandle,
            spotifyUrl: artistData.spotifyUrl,
            isAIGenerated: artistData.isAIGenerated,
            generatedBy: artistData.generatedBy,
            blockchainArtistId: artistData.blockchainArtistId,
            blockchainNetwork: artistData.blockchainNetwork,
            blockchainTxHash: artistData.blockchainTxHash,
            pageMode: artistData.pageMode || 'artist',
            loopVideoUrl: artistData.loopVideoUrl,
          }
        });
      } else {
        console.log(`⚠️ No se encontró artista con slug: ${slug}`);
        res.status(404).json({
          success: false,
          error: 'Artist not found'
        });
      }
    } catch (error) {
      console.error('❌ Error buscando artista por slug:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  });

  // (Health check movido a server/index.ts — handler único para evitar duplicados)

  // Platform stats for homepage (public endpoint - fetches from Supabase leads)
  app.get('/api/platform-stats', async (req, res) => {
    try {
      const pg = await import('pg');
      const { Client } = pg.default || pg;
      const supabaseUrl = 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';
      
      const client = new Client({ connectionString: supabaseUrl });
      await client.connect();
      
      // Get leads count from Supabase
      const leadsResult = await client.query('SELECT COUNT(*) FROM leads');
      const leadsCount = parseInt(leadsResult.rows[0].count) || 0;
      
      await client.end();
      
      // Get songs count from Neon (main app db)
      const { songs } = await import('./db/schema');
      const songsResult = await db.select().from(songs);
      
      res.json({
        activeArtists: leadsCount, // Leads as potential artists
        musicVideosCreated: songsResult.length * 3 + 50000, // Estimated
        tracksPromoted: leadsCount * 35 + 250000, // Estimated
        monthlyViews: leadsCount * 2000 + 15000000 // Estimated
      });
    } catch (error) {
      console.error('Error fetching platform stats:', error);
      // Fallback values
      res.json({
        activeArtists: 7500,
        musicVideosCreated: 50000,
        tracksPromoted: 250000,
        monthlyViews: 15000000
      });
    }
  });

  app.get('/api/status', (req, res) => {
    // Check database connection if needed
    const databaseStatus = db ? 'connected' : 'disconnected';
    
    // Basic system information
    const status = {
      server: {
        status: 'ok',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
      },
      database: {
        status: databaseStatus
      },
      serviceStatus: {
        firebase: !!process.env.VITE_FIREBASE_API_KEY ? 'configured' : 'not_configured',
        stripe: !!process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured',
        openai: !!process.env.OPENAI_API_KEY ? 'configured' : 'not_configured',
        apify: !!(process.env.APIFY_API_TOKEN || process.env.APIFY_API_KEY) ? 'configured' : 'not_configured',
      }
    };
    
    res.status(200).json(status);
  });
  
  // Endpoint de diagnóstico para verificar conectividad desde cualquier dispositivo
  app.get('/api/diagnostics', (req, res) => {
    const userAgent = req.headers['user-agent'] || 'unknown';
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    const isSafari = /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent);
    const cookies = req.headers.cookie || 'no cookies';
    
    res.status(200).json({
      success: true,
      message: '¡Servidor funcionando correctamente!',
      device: {
        userAgent,
        isIOS,
        isSafari,
        platform: isIOS ? 'iOS' : 'other',
      },
      network: {
        ip: req.ip || req.connection.remoteAddress,
        protocol: req.protocol,
        secure: req.secure,
      },
      cookies: {
        present: cookies !== 'no cookies',
        count: cookies.split(';').length,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // Register Firebase token generator (requires Replit Auth)
  app.use(firebaseTokenRouter);

  // Register translation routes
  app.use('/api', translationRouter);

  // Register video generation router (direct implementation)
  app.use('/api/video-generation', videoGenerationRouter);
  
  // Register video upscale router for final rendering with Qubico/video-toolkit
  app.use('/api/proxy/piapi/video-upscale', videoUpscaleRouter);

  app.use('/api/manager', managerRouter);
  app.use('/api/manager/documents', managerDocumentsRouter);
  app.use('/api/artist', artistRouter);
  app.use('/api/artist', fanMonetizationRouter); // /:artistId/access + /:artistId/unlock-checkout
  app.use('/api/modules', moduleUnlocksRouter); // /catalog + /access + /:moduleKey/unlock-checkout
  app.use('/api/fan-leads', artistFanLeadsRouter);
  app.use('/api/fan-club', fanClubRouter);

  // Configurar las rutas que NO requieren autenticación primero
  setupOpenAIRoutes(app);
  setupEducationRoutes(app);
  app.use(educationProgressiveRouter);
  app.use(educationGeminiRouter);
  setupFilesRoutes(app);

  // Register generated artists routes (no authentication required)
  app.use(generatedArtistsRouter);

  // Register artist generator routes (no authentication required)
  app.use('/api/artist-generator', artistGeneratorRouter); // La URL resultante será /api/artist-generator/generate-artist

  // Register Superstar Blueprint routes (owner-authenticated)
  app.use('/api/artist-blueprint', artistBlueprintRouter);

  // Register Emotional Studio routes (owner-authenticated)
  app.use('/api/emotional-studio', emotionalStudioRouter);

  // Register Marketing Context & Skills API (powers ai-skills-injector across all modules)
  app.use('/api/marketing-context', marketingContextRouter);

  // Register Legal / DMCA / Copyright protection system (safe-harbor infrastructure)
  app.use('/api/legal', legalRouter);

  // Register Artist Domain Manager routes (owner-authenticated)
  app.use('/api/artist-domain', artistDomainRouter);

  // Registrar el router de proxy API (sin autenticación)
  app.use('/api', apiProxyRouter);
  
  // Registrar el router dedicado para estado de videos (sin autenticación)
  app.use('/api/video', videoStatusRouter);
  
  // Registrar las rutas de la API de Kling (sin autenticación para permitir proceso de imágenes)
  app.use('/api/kling', klingApiRouter);
  
  // Registrar las rutas específicas para LipSync con Kling
  app.use('/api/kling', klingLipsyncRouter);
  
  // Registrar el procesador de imágenes para API de uploads
  app.use('/api', uploadApiRouter);
  app.use('/api', uploadImageRouter);
  
  // Registrar las rutas de prueba de Kling (solo para desarrollo)
  app.use('/api/kling-test', klingTestRouter);
  
  // Registrar el router para generación de música (requiere autenticación parcial)
  app.use('/api/music', musicRouter);
  
  // Registrar el router para Kits.ai audio tools (mastering, stem separation, voice conversion)
  app.use('/api/kits', kitsAiRouter);

  // Registrar el router para AI Mastering Suite (FAL: demucs, stable-audio, f5-tts, wizper)
  app.use('/api/mastering', masteringRouter);
  
  // Registrar el router para Voice AI (clonación y transformación de voz)
  app.use('/api/voice-ai', voiceAiRouter);
  
  // Registrar el router para Flux API (generación de imágenes avanzada)
  app.use('/api', fluxApiRouter);
  
  // Registrar el router para Gemini Image Generation (Nano Banana)
  app.use('/api/gemini-image', geminiImageRouter);
  
  // MotionDNA images router
  app.use('/api/images', motionDnaImagesRouter);
  
  // Registrar el router para Face Analysis con Gemini Vision
  app.use('/api/gemini', faceAnalysisRouter);
  
  // Registrar el router para Artist Profile Generation (Gemini)
  app.use('/api/artist-profile', artistProfileRouter);
  
  // Registrar el router para Image Gallery (generación de galerías de imágenes)
  app.use('/api/image-gallery', imageGalleryRouter);
  
  app.use('/api/minimax', minimaxVideoRouter);
  
  // Registrar el router para transcripción de audio
  console.log('📢 Registrando router de transcripción de audio en /api/audio');
  app.use('/api/audio', audioTranscriptionRouter);
  console.log('✅ Router de transcripción de audio registrado');
  
  // Registrar el router para videos generados (con autenticación)
  console.log('📢 Registrando router de videos generados en /api/videos');
  app.use('/api/videos', generatedVideosRouter);
  console.log('✅ Router de videos generados registrado');
  
  // Registrar el router para proyectos de music video (guardado/carga)
  console.log('📢 Registrando router de proyectos de music video en /api/music-video-projects');
  app.use('/api/music-video-projects', musicVideoProjectsRouter);
  app.use('/api/video-projects', videoProjectsRouter); // Timeline export → Shotstack render + status polling
  app.use('/api/music-video', musicVideoRouter);
  app.use('/api/audio-analysis', audioAnalysisRouter); // Audio analysis for intelligent video editing
  app.use('/api/auto-edit', autoEditRouter); // Auto-edit engine with genre-based intelligent cuts
  app.use('/api/artist-profiles', artistProfilesRouter);
  app.use('/api/video-rendering', videoRenderingRouter);
  app.use('/api/render-queue', renderQueueRouter); // Video pipeline queue for full video generation
  app.use('/api/diagnostics', diagnosticsRouter); // System health check endpoints
  console.log('✅ Router de proyectos de music video registrado');
  console.log('✅ Router de perfiles de artista auto-generados registrado');
  
  // Registrar el router para musician clips (timeline musicians)
  console.log('📢 Registrando router de musician clips');
  app.use(musicianClipsRouter);
  console.log('✅ Router de musician clips registrado');
  
  // Registrar el router para camera angles (cinematographic variations)
  console.log('📢 Registrando router de camera angles');
  app.use(cameraAnglesRouter);
  console.log('✅ Router de camera angles registrado');
  
  // Registrar el router para performance segments (lip-sync automation)
  console.log('📢 Registrando router de performance segments en /api/performance-segments');
  app.use('/api/performance-segments', performanceSegmentsRouter);
  console.log('✅ Router de performance segments registrado');
  
  // Registrar rutas de perfil de artista, canciones y merchandise
  console.log('📢 Registrando rutas de perfil de artista');
  app.use('/api/profile', profileRouter);
  app.use('/api/video-concepts', videoConceptsRouter); // Boostify Video Concepts API
  app.use('/api/events', cinematicEventsRouter); // Cinematic Event Landing API (isolated guest JWT)
  app.use('/api/songs', songsRouter);
  app.use('/api/music-auto', autoMusicRouter); // Music Auto-Pilot — weekly single / monthly album auto-generation
  app.use('/api/merch', merchRouter);
  app.use('/api/store', storeEnhancementsRouter); // Official Store enhancements: bundles, views, AI, seasonal, pre-orders
  app.use('/api/marketing', marketingRouter); // Marketing tools and campaigns
  app.use('/api/artist-wallet', artistWalletRouter);
  app.use('/api/ai', aiAssistantRouter);
  app.use('/api', albumGeneratorRouter);
  app.use('/api/fal', falApiRouter); // FAL AI backend routes (MuseTalk lip-sync, etc.)
  
  // Lyria 3 Music Generation (Google Gemini)
  const lyriaMusicRouter = (await import('./routes/lyria-music')).default;
  app.use('/api/music/lyria', lyriaMusicRouter);

  app.use('/api/choreography', choreographyRouter); // Choreography — Dance motion transfer (DreamActor v2)

  // Dynamic UI Style System
  const uiStyleRouter = (await import('./routes/ui-style')).default;
  app.use('/api/ui-style', uiStyleRouter);
  app.use('/api/gemini-agents', geminiAgentsRouter);
  app.use('/api/agents', aiAgentsRouter); // AI Agents System (sessions, saved results, analytics)
  app.use('/api/agents-sdk', agentsSdkRouter); // OpenAI Agents SDK (conversational chat)
  app.use('/api/marketplace/agents', agentMarketplaceRouter); // Agent Marketplace (browse, install, rate)
  app.use('/api/ai-advisor', aiAdvisorRouter); // AI Advisor Chat (real-time chat with specialist advisors)
  
  // MCP (Model Context Protocol) Server for AI Agents
  const { registerMCPRoutes } = await import('./mcp/index');
  registerMCPRoutes(app);
  
  // AI Social Agents - Primera Red Social IA-Nativa de Música
  // Sistema de agentes autónomos que genera contenido y comunicación entre artistas IA
  const aiSocialAgentsRouter = await import('./routes/ai-social-agents');
  app.use('/api/ai-social', aiSocialAgentsRouter.default);
  console.log('🤖 AI Social Agents routes registered at /api/ai-social');
  
  // AI Ecosystem - Autonomous Agent Ecosystem (Collaborations, Economy, Beefs, Music)
  // Sistema autónomo que autofinancia Boostify y crea un ecosistema musical completo
  const aiEcosystemRouter = await import('./routes/ai-ecosystem');
  app.use('/api/ai-ecosystem', aiEcosystemRouter.default);
  console.log('🌐 AI Ecosystem routes registered at /api/ai-ecosystem');
  
  app.use('/api/printful', printfulRouter); // Printful integration routes
  app.use('/api/merch-contract', merchContractRouter); // Merch Collaboration Contract routes
  app.use('/api/artist-store', artistStoreRouter); // Artist Store public catalog routes
  app.use('/api/amazon-curated', amazonCuratedRouter); // Amazon Cultural Storefront (curated affiliate picks)
  app.use('/api/fashion-store', fashionStoreRouter); // Fashion Virtual Store — artist fashion brand universe
  app.use('/api/artist-card', artistCardWalletRouter); // Artist Card wallet integration
  app.use('/api/merch-config', merchConfigRouter); // Merch Store Configuration (pricing, visibility, featured)
  app.use('/api/merch-marketing', merchMarketingRouter); // Merch Marketing Hub (contacts, campaigns, AI content)
  app.use('/api/merch-analytics', merchAnalyticsRouter); // Merch Analytics (sales, revenue, trends)
  app.use('/api/platform-analytics', platformAnalyticsRouter); // Platform Analytics (real DB stats - users, revenue, songs, subscriptions)
  app.use('/api/crowdfunding', crowdfundingRouter); // Crowdfunding routes
  app.use('/api/tv/monetization', tvMonetizationRouter); // Boostify TV Monetization (tips, revenue)
  app.use('/api/tv/content', tvContentRouter); // Boostify TV Content (categories, AI generation, schedule, news)
  app.use('/api/tokenization', tokenizationRouter); // Tokenization (Web3/Blockchain) routes
  app.use('/api/btf-services', btfServicesRouter); // BTF Token Economy — payments, boosts, tips, verification
  app.use('/api/btf-card', btfCardPurchaseRouter); // BTF Card Purchase — buy BTF with credit/debit card via Stripe
  app.use('/api/btf', btfLegalRouter); // BTF Legal — acknowledge-terms endpoint

  // NFT Metadata APIfor BTF-2300 tokens (must be public for blockchain access)
  const nftMetadataRouter = await import('./routes/nft-metadata');
  app.use('/api/metadata', nftMetadataRouter.default); // NFT metadata for artists, songs, catalogs, licenses
  
  app.use('/api/admin/import-artists', adminImportArtistsRouter); // Admin: Import artists from JSON/Excel
  app.use('/api/admin/api-usage', apiUsageRouter);
  app.use('/api/admin/accounting', accountingRouter);
  app.use('/api/admin/agent', adminAgentRouter);
  app.use('/api/admin/moderation', contentModerationRouter); // Content Moderation queue (admin)
  app.use('/api/moderation', contentModerationRouter); // Content Moderation public check endpoint
  app.use('/api/admin/reports', adminReportsRouter); // Admin: Platform reports, diagnostics & competitive intel
  if (shouldRunSchedulers()) startWeeklyReportScheduler(); // Start auto-weekly email report scheduler
  app.use('/api/admin/code-engine', codeEngineRouter); // Admin: AI Code Engine - auto-improvements
  app.use('/api/admin/stripe-events', stripeEventsAdminRouter);
  app.use('/api/admin/boostiswap-artists', adminBoostiswapArtistsRouter); // Admin: BoostiSwap artists management
  app.use('/api/admin/artists', adminArtistsRouter); // Admin: Musicians search/management
  app.use('/api/admin/artist-leads', adminArtistLeadsRouter); // Admin: Music industry contacts & invite system
  app.use('/api/admin/artist-discovery', adminArtistDiscoveryRouter); // Admin: Artist Discovery Agent (auto-find artists)
  app.use('/api/admin/artist-acquisition', adminArtistAcquisitionRouter); // Admin: Artist Acquisition System dashboard
  app.use('/api/admin/artist-identity', adminArtistIdentityRouter); // Admin: Artist Identity & Account Provisioning System (AIAPS)
  app.use('/api/webhooks/aiaps', webhooksAiapsRouter); // Public: AIAPS webhooks (Twilio SMS / inbound email)
  if (shouldRunSchedulers()) startAiapsScheduler(); // Start AIAPS health + warm-up scheduler
  app.use('/api/admin/boostify-alliances', adminBoostifyAlliancesRouter); // Admin: Boostify Alliances dashboard
  app.use('/api/admin/artist-activation', artistActivationRouter); // Admin: Artist Activation Engine (drip, scoring, conversion)
  app.use('/api/artist-activation', artistActivationRouter); // Public: Magic links + unsubscribe
  // Noisy background schedulers — set DISABLE_DISCOVERY_SCHEDULERS=1 in dev to silence
  if (shouldRunSchedulers() && process.env.DISABLE_DISCOVERY_SCHEDULERS !== '1') {
    startDiscoveryScheduler(); // Start artist discovery every 6 hours
    startActivationScheduler(); // Start activation drip engine every 30 minutes
    startAutoGeneration(); // Start auto-generation: contacts → artist pages every 4 hours
  } else {
    console.log('⏸️  [Schedulers] Discovery/Activation/AutoGen disabled (role/env)');
  }
  app.use('/api/admin/artist-enrichment', artistEnrichmentRouter); // Admin: Artist Enrichment Agent (auto-enrich profiles)
  app.use('/api/artist-enrichment', artistEnrichmentRouter); // Public: enrichment status
  if (shouldRunSchedulers() && process.env.DISABLE_DISCOVERY_SCHEDULERS !== '1') {
    startEnrichmentScheduler(); // Start artist enrichment every 15 minutes
  }
  app.use('/api/admin/c-suite', adminCSuiteRouter); // Admin: C-Suite AI executive team (CEO + 9 chiefs)
  app.use('/api/admin/song-analysis', adminSongAnalysisRouter); // Admin: Song Analyzer + promote helpers
  app.use('/api/song-promotion', songPromotionRouter); // Lazy Firestore→Postgres sync for Promote button
  app.use('/api/promote-engine', promoteEngineRouter); // Cinematic promo pipeline (LoRA training + 3-style packs)
  app.use('/api/artist/suite', artistSuiteRouter); // Artist Career Suite — per-artist AI executive team (Elite)
  app.use('/api/admin/artist-suite', adminArtistSuiteRouter); // Admin: Artist Career Suite approvals + dashboard

  // NOTE: OpenClaw admin routes are registered in server/index.ts (pre-auth) so they work even when Clerk middleware is active

  app.use('/api/admin', adminUsersRouter); // Admin: User management, roles, permissions (MUST be after more specific /api/admin/* routes)
  app.use('/api/virtual-label', virtualRecordLabelRouter); // Virtual Record Label integration routes
  app.use('/api/og-image', ogImageRouter); // Open Graph dynamic image generation
  app.use('/api/youtube', youtubeToolsRouter); // YouTube Growth Tools (Pre-Launch Score, Keywords, Title Analyzer, Content Ideas)
  app.use('/api/tiktok', tiktokToolsRouter); // TikTok Growth Tools (Reel Creator, Trends, Captions, Calendar, Viral Score)
  app.use('/api/youtube-ext', youtubeExtensionRouter); // YouTube Chrome Extension Sync API (connect, sync, actions, events)
  app.use('/api/instagram-ext', instagramExtensionRouter); // Instagram Chrome Extension Sync API (connect, sync, actions, events)
  app.use('/api/spotify-ext', spotifyExtensionRouter); // Spotify Chrome Extension Sync API
  app.use('/api/spotify/ai-agent', spotifyAiAgentRouter); // Spotify AI Agent (OpenClaw-powered growth assistant)
  app.use('/api/spotify', spotifyToolsRouter); // Spotify Growth Tools (Listeners Prediction, Playlist Match, Curator Finder, SEO Optimizer)
  app.use('/api/instagram/ai-agent', instagramAiAgentRouter); // Instagram AI Agent (OpenClaw-powered growth assistant)
  app.use('/api/instagram/content-gen', instagramContentGenRouter); // Instagram Visual Content Generator (images, carousels, reels, stories)
  app.use('/api/instagram', instagramToolsRouter); // Instagram Boost AI Tools (Caption Generator, Hashtags, Content Ideas, Best Time, Bio Optimizer)
  app.use('/api/instagram/auth', instagramOAuthRouter); // Instagram OAuth for real API connection
  app.use('/api/auth/tiktok', tiktokAuthRouter); // TikTok OAuth Login Kit v2 — connect/callback/disconnect
  console.log('🎵 TikTok OAuth registered at /api/auth/tiktok');
  app.use('/api/auth/youtube', youtubeAuthRouter); // YouTube OAuth — connect channel to publish lyric videos
  console.log('▶️ YouTube OAuth registered at /api/auth/youtube');
  app.use('/api/apify/instagram', apifyInstagramRouter); // Apify Instagram integration for real Instagram data
  app.use('/api/fashion', fashionStudioRouter); // Artist Fashion Studio (Virtual Try-On, AI Advisor, Kling Videos)
  app.use('/api/my-universe', myUniverseRouter); // My Universe — artist discography landing page
  app.use('/api/financial-enablement', financialImagesRouter); // Financial Enablement page — AI-generated marketing imagery (cached)
  app.use('/api/hologauze', hologauzeImagesRouter); // Hologauze Live Concert System — AI-generated marketing imagery (cached)
  app.use('/api/notifications', notificationsRouter); // Internal notifications system
  app.use('/api/sponsors', sponsorApiRouter); // Sponsor Acquisition Module (contacts, campaigns, deals, payments)
  app.use('/api/publishing', publishingRouter); // Publishing & Sync Licensing Hub (briefs, submissions, deals, pitching)
  app.use('/api/lyrics-workflow', lyricsWorkflowRouter); // Lyrics Copywrite Workflow (authorship traceability)
  app.use('/api/copyright', copyrightCertRouter); // Copyright Certification (SHA-256 + Polygon blockchain)

  // Original Song Pipeline — Boostify Music Generator + authorship + certificate
  const musicOriginalRouter = (await import('./routes/music-original')).default;
  app.use('/api/music-original', musicOriginalRouter);
  const songCollaboratorsRouter = (await import('./routes/song-collaborators')).default;
  app.use('/api/song-collaborators', songCollaboratorsRouter);

  // Social Integration — real users, follows, email notifications, external publish, platform events
  const socialIntegrationRouter = (await import('./routes/social-integration')).default;
  app.use('/api/social-integration', socialIntegrationRouter);
  console.log('🌐 Social Integration routes registered at /api/social-integration');

  app.use('/api/venue-outreach', venueOutreachRouter); // Venue Booking Outreach (Google Maps + email)
  app.use('/api/explicit', explicitRouter); // Boostify Explicit — Exclusive Content Module
  app.use('/api/aas', aasRouter); // AAS — Autonomous Artist Survival System
  app.use('/api/videoservice', videoserviceRouter); // Video Service — Lead capture, Stripe deposits, email workflow
  app.use('/api/viral-products', viralProductsRouter); // Viral Product Content Generator (TikTok Shop + FAL)
  app.use('/api/influencer', influencerBrandsRouter); // Influencer Brand Collaborations (Artist × Brand Content)
  app.use('/api/artist-modules', artistModulesStatusRouter); // Unified health snapshot for the 6 artist modules
  app.use('/api/business-plan', businessPlanRouter); // Artist Business Plan (financial planning, pitch deck, roadmap)
  app.use('/api/investor-room', investorRoomRouter); // Interactive pitch-deck investor agent + feedback capture

  // ── Economic Engine (Layer 3 — Hidden Motor) ──
  const economicEngineRouter = (await import('./routes/economic-engine')).default;
  app.use('/api/economic-engine', economicEngineRouter);
  console.log('💰 Economic Engine routes registered at /api/economic-engine');

  // ── CEX Trading — Funding Rate Arbitrage & Multi-Exchange ──
  const cexTradingRouter = (await import('./routes/cex-trading')).default;
  app.use('/api/cex', cexTradingRouter);
  console.log('📈 CEX Trading routes registered at /api/cex');

  // ── Crypto Community (per-artist community agent) ──
  const cryptoCommunityRouter = (await import('./routes/crypto-community')).default;
  app.use('/api/crypto-community', cryptoCommunityRouter);
  console.log('🌐 Crypto Community routes registered at /api/crypto-community');

  app.use('/api/podcast-studio', podcastStudioRouter); // Live Podcast Studio (sessions, participants, destinations)

  // Audience Capture Engine — hooks, scoring, profiles, experiments, daily plans
  app.use('/api/audience-capture', audienceCaptureRouter);
  console.log('🎯 Audience Capture Engine registered at /api/audience-capture');

  // ── Intelligence Engine (Phases 1-4 + MCP) ──
  app.use('/api/artist-intel', artistIntelRouter); // Artist Intelligence (stats, growth, geographic, similar, competitors)
  app.use('/api/music-intel', musicIntelRouter); // Playlist & Chart Intelligence (editorial, active playlists, charts)
  app.use('/api/song-intel', songIntelRouter); // Song DNA (metadata, performance, audio features, demographics, market)
  app.use('/api/tour-intel', tourIntelRouter); // Tour Intelligence (opening acts, festivals, venues)
  app.use('/api/mcp', mcpServerRouter); // MCP Server — AI agent tools via SSE + HTTP
  console.log('🧠 Intelligence Engine registered: artist-intel, music-intel, song-intel, tour-intel, mcp');

  // Boostify News — AI-generated daily articles about innovations & technologies
  app.use('/api/news', newsRouter);
  if (shouldRunSchedulers()) startDailyNewsScheduler();
  if (shouldRunSchedulers()) startArtistNewsAutopilot();
  console.log('📰 Boostify News Engine registered at /api/news (daily auto-generation active)');

  // Artist profile social sharing — rich OG card + share page
  app.use('/api/artist-share', artistShareRouter);
  console.log('🎤 Artist Share Cards registered at /api/artist-share');

  // Boostify StageSync AI — live show production (setlist, visuals, cue timeline, technical exports)
  app.use('/api/stage-sync', stageSyncRouter);
  console.log('🎬 Boostify StageSync AI registered at /api/stage-sync');

  // Boostify Hologram Live Show Engine — lead capture, FAL asset generation
  app.use('/api/hologram-show', hologramShowRouter);
  console.log('🌐 Boostify Hologram Live Show Engine registered at /api/hologram-show');

  // Promo Clips — Song-to-Visual Lipsync Engine (FAL OmniHuman v1.5 + Sync Labs Sync-3)
  app.use('/api/promo-clips', promoClipsRouter);
  console.log('🎬 Promo Clips Lipsync Engine registered at /api/promo-clips');

  // Artist Command Engine — "Hey <artist>, crea una canción…" → intent router + module orchestrator
  app.use('/api/artist-command', artistCommandRouter);
  console.log('🎙️ Artist Command Engine registered at /api/artist-command');

  // WhatsApp Artist Command Center — OpenWA gateway (sessions, fans, campaigns, tickets, merch, AI agent)
  app.use('/api/whatsapp', whatsappRouter);
  console.log('💬 WhatsApp Artist Command Center registered at /api/whatsapp');

  // Promo Content Library — aggregates songs/videos/products/tickets/gallery into ready-to-use promo links + captions
  app.use('/api/promo-content', promoContentRouter);
  console.log('🔗 Promo Content Library registered at /api/promo-content');

  // Telegram Artist Command Center — Bot API gateway (bots, fans, campaigns, communities, tickets, merch, AI agent)
  app.use('/api/telegram', telegramRouter);
  console.log('📨 Telegram Artist Command Center registered at /api/telegram');

  // Facebook Groups — controlled auto-publishing engine (groups, content pool, AI captions, queue, Hybrid 1-click publish)
  app.use('/api/facebook-groups', facebookGroupsRouter);
  console.log('📘 Facebook Groups auto-publish engine registered at /api/facebook-groups');
  if (shouldRunSchedulers()) startFacebookGroupsScheduler(); // Queue prep + readiness (Hybrid — never auto-posts)

  // Reddit Artist Intelligence Center — read-only market intelligence (trends, communities, fan discovery, competitors, AI strategy)
  app.use('/api/reddit', redditRouter);
  console.log('🟠 Reddit Artist Intelligence Center registered at /api/reddit');

  // Discord Fan Nation — premium community hub (OAuth2 + bot, server setup, roles, BTF token gate, campaigns, events, AI moderator & concierge)
  app.use('/api/discord', discordRouter);
  console.log('🎮 Discord Fan Nation registered at /api/discord');

  // Ads Campaign Manager — Multi-platform paid ads (Facebook, Instagram, TikTok)
  app.use('/api/ads-campaigns', adsCampaignsRouter);
  console.log('📣 Ads Campaign Manager registered at /api/ads-campaigns');

  // Artist Content Engine - shared content assets + generation pack plans
  app.use('/api/content-engine', contentEngineRouter);
  console.log('Artist Content Engine registered at /api/content-engine');

  // Gamma AI Presentations — slide decks generated from artist context
  app.use('/api/gamma-presentations', gammaPresentationsRouter);
  console.log('🎯 Gamma Presentations registered at /api/gamma-presentations');

  // Hologram AI Gallery — FAL Flux Pro Kontext generates cinematic hologram show images
  app.use('/api/hologram-gallery', hologramGalleryRouter);
  console.log('🎭 Hologram Gallery registered at /api/hologram-gallery');

  // Motion Capture — phone-as-camera (QR pairing) Live Link + recorded performance takes
  app.use('/api/motion-capture', motionCaptureRouter);
  console.log('🕺 Motion Capture registered at /api/motion-capture');

  // Karaoke — Whisper-synced lyrics fullscreen player
  app.use('/api/karaoke', karaokeRouter);
  console.log('🎤 Karaoke module registered at /api/karaoke');

  // Lyrics Video — Remotion 16:9 karaoke video generator + YouTube upload
  app.use('/api/lyrics-video', lyricsVideoRouter);
  console.log('🎬 Lyrics Video module registered at /api/lyrics-video');

  // YouTube Shopping — product feed (Google Merchant Center / RSS) para vender merch en YouTube
  const youtubeShoppingRouter = (await import('./routes/youtube-shopping')).default;
  app.use('/api/youtube-shopping', youtubeShoppingRouter);
  console.log('🛍️ YouTube Shopping feed registered at /api/youtube-shopping/feed/:artistId.xml');

  // Google Merchant Center — OAuth + Content API sync (sube los productos automáticamente)
  const merchantRouter = (await import('./routes/merchant')).default;
  app.use('/api/merchant', merchantRouter);
  console.log('🟢 Google Merchant Center registered at /api/merchant (connect/sync/status)');

  // Vinyl Pre-Order Module — Diggers Factory integration
  const vinylRouter = (await import('./routes/vinyl')).default;
  app.use('/api/vinyl', vinylRouter);
  console.log('🎵 Vinyl Pre-Order module registered at /api/vinyl');

  // Vinyl Editions Token System — Limited editions 100/300/500 copies
  const vinylEditionsRouter = (await import('./routes/vinyl-editions')).default;
  app.use('/api/vinyl-editions', vinylEditionsRouter);
  console.log('💿 Vinyl Editions Token System registered at /api/vinyl-editions');

  // Art Gallery / Auction Module — Visual art (paintings, sculpture, plastic arts)
  const artGalleryRouter = (await import('./routes/art-gallery')).default;
  app.use('/api/art-gallery', artGalleryRouter);
  console.log('🎨 Art Gallery / Auction module registered at /api/art-gallery');

  // Smart Merch Engine — NFC/QR physical products with pre-sale threshold fulfillment
  const smartMerchRouter = (await import('./routes/smart-merch')).default;
  app.use('/api/smart-merch', smartMerchRouter);
  console.log('🛍️ Smart Merch Engine registered at /api/smart-merch');

  // Avatar Talk — HeyGen Avatar4 AI talking head videos
  app.use('/api/avatar-talk', avatarTalkRouter);
  console.log('🎬 Avatar Talk registered at /api/avatar-talk');

  // AI Video Studio — Boostify HyperFrame Video Engine (HyperFrames + HeyGen)
  app.use('/api/ai-video-studio', aiVideoStudioRouter);
  console.log('🎬 AI Video Studio registered at /api/ai-video-studio');

  // HoloStage Engine — StageOS REST API (characters, shows, DMX, motion source, show packages)
  const holostageRouter = (await import('./routes/holostage')).default;
  app.use('/api/holostage', holostageRouter);
  console.log('🎭 HoloStage Engine API registered at /api/holostage');

  // HoloSuit Startup — investor expressions of interest + Stripe Checkout
  const holosuitRouter = (await import('./routes/holosuit')).default;
  app.use('/api/holosuit', holosuitRouter);
  console.log('🥽 HoloSuit API registered at /api/holosuit');

  // HoloSuit Investor Outreach — email sequence engine + lead management
  const holosuitOutreachRouter = (await import('./routes/holosuit-outreach')).default;
  app.use('/api/holosuit-outreach', holosuitOutreachRouter);
  console.log('📧 HoloSuit Outreach API registered at /api/holosuit-outreach');

  // Character Forge — AI Character Creator Morph Engine (CC4 + Rokoko + StageOS)
  const characterForgeRouter = (await import('./routes/character-forge')).default;
  app.use('/api/character-forge', characterForgeRouter);
  console.log('🧬 Character Forge API registered at /api/character-forge');

  // Boostify CrowdSync DJ — live crowd intelligence, AI music actions, DJ network reports
  app.use('/api/crowdsync-dj', crowdSyncDjRouter);
  console.log('🎧 Boostify CrowdSync DJ registered at /api/crowdsync-dj');

  // Boostify Live Stage — live video, gifts, credits economy, StageRank, payouts
  app.use('/api/live-stage', liveStageRouter);
  console.log('🎤 Boostify Live Stage registered at /api/live-stage');

  // Concert Command Center — events, ticketing, buyer messaging, admin commission
  app.use('/api/concerts', concertsRouter);
  app.use('/api/seat-map', seatMapRouter);
  app.use('/api/admin/concerts', adminConcertsRouter);
  console.log('🎫 Concert Command Center registered at /api/concerts (admin: /api/admin/concerts)');
  console.log('🪑 Seat Map Engine registered at /api/seat-map');

  // Boostify Catalog Resurrection Engine — archive catalog matching, PDF brief, visual pack
  app.use('/api/legacy-catalog-resurrection', legacyCatalogResurrectionRouter);
  console.log('🗄️ Boostify Catalog Resurrection Engine registered at /api/legacy-catalog-resurrection');

  // Boostify Artist Growth Engine — landing $500, wizard, dashboard, 2-sales expansion rule
  app.use('/api/age', artistGrowthEngineRouter);
  console.log('🎯 Boostify Artist Growth Engine registered at /api/age');

  // Hermes Agent Integration — REST API for AI agent to read/update artist data
  app.use('/api/hermes', hermesRouter);
  console.log('🤖 Hermes Agent Integration registered at /api/hermes');

  // Hermes Frontend Proxy — Clerk-authenticated API for artist profile Hermes module
  app.use('/api/artist-hermes', artistHermesProxyRouter);
  console.log('🔮 Hermes Frontend Proxy registered at /api/artist-hermes');

  // Artist Agent Gateway — communication system with AI agents
  app.use('/api/agent-gateway', agentGatewayRouter);
  console.log('🛡️ Artist Agent Gateway registered at /api/agent-gateway');

  // SEO — sitemap.xml, robots.txt, sitemap-news.xml (mounted at root, not /api)
  app.use('/', seoRouter);
  console.log('🔍 SEO routes registered: /sitemap.xml, /sitemap-news.xml, /sitemap-artists.xml, /robots.txt');

  // Release Publisher — Scheduled song publication worker (cadence releases)
  if (shouldRunSchedulers()) startReleasePublisher();
  console.log('🎵 Release Publisher started (auto-publishes songs on release date)');

  // Music Auto-Pilot — scheduled active music generation (weekly single, monthly album)
  if (shouldRunSchedulers()) startAutoMusicScheduler();
  console.log('🤖 Music Auto-Pilot scheduler started (catalog-referenced auto-generation)');

  // Influencer Module — Content pipeline, voice cloning, avatar videos, scheduling
  app.use('/api/influencer', influencerContentRouter);
  if (shouldRunSchedulers()) startInfluencerContentScheduler();
  console.log('🎬 Influencer Module registered at /api/influencer (auto-generation active)');

  // Talk To Me — ElevenLabs Conversational AI for fans to voice-chat with artist AI doubles
  const talkToMeRouter = (await import('./routes/talk-to-me')).default;
  app.use('/api/talk-to-me', talkToMeRouter);
  console.log('📞 Talk To Me module registered at /api/talk-to-me');

  // Streaming — Spotify-style streaming surface (browse artists, playlists, AI-ranked featured)
  const streamingRouter = (await import('./routes/streaming')).default;
  app.use('/api/streaming', streamingRouter);
  console.log('🎧 Streaming module registered at /api/streaming');

  // Node Workflow Scheduler — boot cron jobs for all artist ScheduleTrigger nodes
  if (shouldRunSchedulers()) {
    workflowScheduler.bootstrap().then(() => {
      console.log(`⏰ Workflow Scheduler bootstrapped (${workflowScheduler.getActiveCount()} tasks active)`);
    }).catch(err => console.error('❌ Workflow Scheduler bootstrap failed:', err));
  }

  // Customer Support Chat — OpenAI-powered support agent (platform-wide)
  const customerSupportChatRouter = (await import('./routes/customer-support-chat')).default;
  app.use('/api/support-chat', customerSupportChatRouter);

  // Distribution Orchestrator — Music distribution, partners, releases, royalties
  const distributionRouter = (await import('./routes/distribution')).default;
  app.use('/api/distribution', distributionRouter);
  console.log('🎵 Distribution Orchestrator routes registered at /api/distribution');

  // Start auto follow-up scheduler for sponsor deals
  if (shouldRunSchedulers()) startFollowUpScheduler();
  app.use(creditsRouter); // Credits and payment routes
  app.use(adminPricingRouter); // Admin pricing management
  app.use('/api/video-budget', videoBudgetRouter); // Video Budget system (pre-generation Stripe payment)

  // Gig Credits — Marketplace credit system (1 credit = $1)
  const gigCreditsRouter = (await import('./routes/gig-credits')).default;
  app.use('/api/gig-credits', gigCreditsRouter);
  console.log('💰 Gig Credits routes registered at /api/gig-credits');

  // Gig Escrow — Payment protection, delivery, disputes
  const gigEscrowRouter = (await import('./routes/gig-escrow')).default;
  app.use('/api/gig-escrow', gigEscrowRouter);
  console.log('🔒 Gig Escrow routes registered at /api/gig-escrow');
  
  // Helper function para obtener features de cada plan
  function getPlanFeatures(plan: string): string[] {
    const features: Record<string, string[]> = {
      free: [
        'Acceso básico a la plataforma',
        'Perfil de artista',
        'Subir canciones',
        'Funcionalidades limitadas'
      ],
      essential: [
        '1 Music Video Premium por mes',
        'Calidad HD 1080p',
        'Generación con IA',
        'Primer mes gratis',
        'Soporte básico'
      ],
      gold: [
        '2 Music Videos Premium por mes',
        'Calidad 4K',
        'Generación avanzada con IA',
        'Efectos visuales premium',
        'Primer mes gratis',
        'Soporte prioritario'
      ],
      platinum: [
        '4 Music Videos Premium por mes',
        'Calidad 4K HDR',
        'Efectos visuales profesionales',
        'Edición personalizada',
        'Primer mes gratis',
        'Soporte 24/7'
      ],
      diamond: [
        '8 Music Videos Premium por mes',
        'Calidad 8K',
        'Efectos visuales cinematográficos',
        'Director de arte dedicado',
        'Revisiones ilimitadas',
        'Primer mes gratis',
        'Soporte VIP 24/7'
      ]
    };
    
    return features[plan] || features.free;
  }
  
  // Endpoint para obtener la suscripción actual del usuario
  app.get('/api/subscriptions/current', async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      
      if (!userId) {
        // Usuario no autenticado - devolver plan free
        return res.json({
          plan: 'free',
          status: 'active',
          price: 0,
          currency: 'usd',
          features: [
            'Acceso básico a la plataforma',
            'Perfil de artista',
            'Subir canciones',
            'Funcionalidades limitadas'
          ]
        });
      }

      const { subscriptions } = await import ('./db/schema');
      const { eq, desc } = await import ('drizzle-orm');
      
      // Obtener la suscripción activa del usuario
      const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      if (!subscription) {
        // Usuario sin suscripción (free tier)
        return res.json({
          plan: 'free',
          status: 'active',
          price: 0,
          currency: 'usd',
          features: [
            'Acceso básico a la plataforma',
            'Perfil de artista',
            'Subir canciones',
            'Funcionalidades limitadas'
          ]
        });
      }

      // Información completa de la suscripción
      return res.json({
        id: subscription.id,
        plan: subscription.plan,
        status: subscription.status,
        price: subscription.price ? parseFloat(subscription.price.toString()) : 0,
        currency: subscription.currency || 'usd',
        currentPeriodEnd: subscription.currentPeriodEnd,
        currentPeriodStart: subscription.currentPeriodStart,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        features: getPlanFeatures(subscription.plan)
      });
    } catch (error) {
      console.error("Error obteniendo suscripción:", error);
      // En caso de error, devolver plan free en lugar de 500
      return res.json({
        plan: 'free',
        status: 'active',
        price: 0,
        currency: 'usd',
        features: ['Acceso básico a la plataforma']
      });
    }
  });

  // Endpoint para obtener suscripción por userId (PARA CONTEXTO DE SUSCRIPCIÓN)
  app.get('/api/subscription/user/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const numUserId = parseInt(userId, 10);
      
      if (isNaN(numUserId)) {
        return res.status(200).json(null);
      }
      
      // Intentar obtener la suscripción, pero devolver null silenciosamente si falla
      try {
        const results = await db
          .select({
            id: subscriptions.id,
            userId: subscriptions.userId,
            plan: subscriptions.plan,
            status: subscriptions.status,
            currentPeriodStart: subscriptions.currentPeriodStart,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
            interval: subscriptions.interval,
            stripeCustomerId: subscriptions.stripeCustomerId,
            stripeSubscriptionId: subscriptions.stripeSubscriptionId,
            isTrial: subscriptions.isTrial,
            trialEndsAt: subscriptions.trialEndsAt,
            createdAt: subscriptions.createdAt,
            updatedAt: subscriptions.updatedAt,
          })
          .from(subscriptions)
          .where(eq(subscriptions.userId, numUserId))
          .orderBy(desc(subscriptions.createdAt))
          .limit(1);

        const subscription = results?.[0];

        // Retornar null si no hay suscripción (usuario en plan free)
        if (!subscription) {
          return res.json(null);
        }

        return res.json({
          id: subscription.id,
          userId: subscription.userId,
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          interval: subscription.interval,
          stripeCustomerId: subscription.stripeCustomerId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          isTrial: subscription.isTrial,
          trialEndsAt: subscription.trialEndsAt,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
        });
      } catch (dbError) {
        // Database error - just return null
        console.warn("Database error fetching subscription:", dbError);
        return res.json(null);
      }
    } catch (error) {
      console.error("Error in subscription endpoint:", error);
      return res.json(null);
    }
  });

  // Endpoint para obtener rol de usuario por userId (PARA CONTEXTO DE SUSCRIPCIÓN)
  app.get('/api/user/role/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const numUserId = parseInt(userId, 10);
      
      if (isNaN(numUserId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }
      
      // Retornar rol por defecto para todos los usuarios (simplificado)
      // En el futuro se puede conectar a tabla user_roles si es necesario
      return res.json({
        userId: numUserId,
        role: 'user',
        permissions: [],
        grantedAt: new Date()
      });
    } catch (error) {
      console.error("Error fetching user role:", error);
      return res.json({
        userId: parseInt(req.params.userId, 10),
        role: 'user',
        permissions: [],
        grantedAt: new Date()
      });
    }
  });

  // Endpoint para cambiar de plan (CAMBIO DE PLAN CON PRORATION)
  app.post('/api/subscription/change', async (req, res) => {
    try {
      const userId = req.user?.id;
      const { newPlanPriceId } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      if (!newPlanPriceId) {
        return res.status(400).json({ error: "newPlanPriceId requerido" });
      }

      const { subscriptions } = await import ('./db/schema');
      const { eq } = await import ('drizzle-orm');
      
      // Obtener suscripción actual
      const [currentSub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);

      if (!currentSub || !currentSub.stripeSubscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      // Obtener suscripción de Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(currentSub.stripeSubscriptionId);
      
      // Actualizar suscripción en Stripe (cambiar plan con proration)
      const updatedSubscription = await stripe.subscriptions.update(
        currentSub.stripeSubscriptionId,
        {
          items: [{
            id: stripeSubscription.items.data[0].id,
            price: newPlanPriceId
          }],
          proration_behavior: 'create_prorations' // Crear proración automática
        }
      );

      console.log(`✅ Plan cambió para usuario ${userId}: ${updatedSubscription.id}`);
      
      return res.json({
        success: true,
        message: "Plan actualizado exitosamente",
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000)
        }
      });
    } catch (error) {
      console.error("Error changing plan:", error);
      return res.status(500).json({ error: "Error al cambiar de plan" });
    }
  });

  // Endpoint para cancelar suscripción
  app.post('/api/subscription/cancel', async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }

      const { subscriptions } = await import ('./db/schema');
      const { eq } = await import ('drizzle-orm');
      
      // Obtener suscripción actual
      const [currentSub] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);

      if (!currentSub || !currentSub.stripeSubscriptionId) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      // Cancelar en Stripe (al final del período)
      const cancelledSubscription = await stripe.subscriptions.update(
        currentSub.stripeSubscriptionId,
        {
          cancel_at_period_end: true
        }
      );

      console.log(`✅ Suscripción cancelada al final del período para usuario ${userId}`);
      
      return res.json({
        success: true,
        message: "Subscription will be cancelled at the end of the billing period",
        subscription: {
          id: cancelledSubscription.id,
          cancelAtPeriodEnd: cancelledSubscription.cancel_at_period_end,
          currentPeriodEnd: new Date(cancelledSubscription.current_period_end * 1000)
        }
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      return res.status(500).json({ error: "Error al cancelar suscripción" });
    }
  });

  // ENDPOINT DE PRUEBA - Enviar evento de ejemplo a Make para ver estructura
  app.get('/api/test/send-to-make', async (req, res) => {
    try {
      console.log('📤 Enviando evento de prueba a Make...');
      
      const testEvent = {
        event: 'subscription_created',
        timestamp: new Date().toISOString(),
        data: {
          userEmail: 'artista@example.com',
          userName: 'Artist Demo',
          planTier: 'professional',
          priceAmount: 99.99,
          currency: 'usd',
          currentPeriodEnd: '2025-12-24',
          interval: 'monthly'
        }
      };

      // Enviar a Make
      const response = await fetch('https://hook.us2.make.com/ow1m732j9t4mjmnod9cyahk6im7w6uet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testEvent)
      });

      if (!response.ok) {
        console.error(`❌ Error: ${response.statusText}`);
        return res.status(500).json({ 
          success: false, 
          error: response.statusText,
          message: 'Make webhook no respondió correctamente'
        });
      }

      console.log('✅ Evento enviado a Make exitosamente');
      return res.json({
        success: true,
        message: 'Evento de prueba enviado a Make',
        eventSent: testEvent
      });
    } catch (error) {
      console.error('Error sending test event:', error);
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ENDPOINT DE PRUEBA - Enviar evento de PAGO EXITOSO
  app.get('/api/test/send-to-make/payment-success', async (req, res) => {
    try {
      console.log('📤 Enviando evento de PAGO EXITOSO a Make...');
      
      const testEvent = {
        event: 'payment_succeeded',
        timestamp: new Date().toISOString(),
        data: {
          userEmail: 'beatmaker@example.com',
          userName: 'Beat Producer Pro',
          amount: 59.99,
          currency: 'usd',
          invoiceId: 'in_1QR7XK2eZvKYlo2CxH5q8qKl',
          paidDate: '2025-11-24'
        }
      };

      const response = await fetch('https://hook.us2.make.com/ow1m732j9t4mjmnod9cyahk6im7w6uet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testEvent)
      });

      if (!response.ok) {
        console.error(`❌ Error: ${response.statusText}`);
        return res.status(500).json({ 
          success: false, 
          error: response.statusText
        });
      }

      console.log('✅ Evento de pago exitoso enviado a Make');
      return res.json({
        success: true,
        message: 'Evento de pago exitoso enviado a Make',
        eventSent: testEvent
      });
    } catch (error) {
      console.error('Error sending payment success event:', error);
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ENDPOINT DE PRUEBA - Enviar evento de PLAN CAMBIADO
  app.get('/api/test/send-to-make/plan-changed', async (req, res) => {
    try {
      console.log('📤 Enviando evento de PLAN CAMBIADO a Make...');
      
      const testEvent = {
        event: 'plan_changed',
        timestamp: new Date().toISOString(),
        data: {
          userEmail: 'producer@example.com',
          userName: 'Music Producer Studio',
          oldPlan: 'basic',
          newPlan: 'professional',
          priceAmount: 99.99,
          currency: 'usd'
        }
      };

      const response = await fetch('https://hook.us2.make.com/ow1m732j9t4mjmnod9cyahk6im7w6uet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testEvent)
      });

      if (!response.ok) {
        console.error(`❌ Error: ${response.statusText}`);
        return res.status(500).json({ 
          success: false, 
          error: response.statusText
        });
      }

      console.log('✅ Evento de plan cambiado enviado a Make');
      return res.json({
        success: true,
        message: 'Evento de plan cambiado enviado a Make',
        eventSent: testEvent
      });
    } catch (error) {
      console.error('Error sending plan changed event:', error);
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ENDPOINT DE PRUEBA - Enviar evento de PAGO FALLIDO
  app.get('/api/test/send-to-make/payment-failed', async (req, res) => {
    try {
      console.log('📤 Enviando evento de PAGO FALLIDO a Make...');
      
      const testEvent = {
        event: 'payment_failed',
        timestamp: new Date().toISOString(),
        data: {
          userEmail: 'customer@example.com',
          userName: 'Failed Customer',
          amount: 149.99,
          currency: 'usd',
          failedDate: '2025-11-24'
        }
      };

      const response = await fetch('https://hook.us2.make.com/ow1m732j9t4mjmnod9cyahk6im7w6uet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testEvent)
      });

      if (!response.ok) {
        console.error(`❌ Error: ${response.statusText}`);
        return res.status(500).json({ 
          success: false, 
          error: response.statusText
        });
      }

      console.log('✅ Evento de pago fallido enviado a Make');
      return res.json({
        success: true,
        message: 'Evento de pago fallido enviado a Make',
        eventSent: testEvent
      });
    } catch (error) {
      console.error('Error sending payment failed event:', error);
      return res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  // Contracts router - Auth is now handled by Clerk middleware
  console.log('✅ Rutas de perfil, songs, merch, AI assistant, FAL AI, Gemini agents, y Printful registradas');
  
  // ☑️ Rutas de Kling API ahora están separadas en su propio router
  // Véase server/routes/kling-api.ts para la implementación

  // Ruta específica para generación de video (sin autenticación)
  app.post('/api/video/generate', async (req, res) => {
    try {
      console.log('Recibiendo solicitud de generación de video:', req.body);

      // Obtener parámetros del cuerpo de la solicitud
      const { 
        prompt, 
        apiProvider, 
        duration, 
        style,
        cameraMovements,
        piapiModel,
        image_url
      } = req.body;

      // Validar que tenemos un prompt y un proveedor
      if (!prompt || !apiProvider) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere un prompt y un proveedor API'
        });
      }

      // Si el proveedor es piapi, redireccionar al endpoint de PiAPI
      if (apiProvider === 'piapi') {
        // Preparar el cuerpo de la solicitud para el endpoint de PiAPI
        const requestBody: any = {
          prompt: prompt,
          model: piapiModel || 't2v-01',
          expand_prompt: true
        };

        // Si hay movimientos de cámara y es el modelo director, incluirlos
        if (piapiModel === 't2v-01-director' && cameraMovements?.length) {
          requestBody.camera_movement = cameraMovements.join(',');
        }

        // Si hay una URL de imagen y es un modelo basado en imagen, incluirla
        if (image_url && ['i2v-01', 'i2v-01-live', 's2v-01'].includes(piapiModel)) {
          requestBody.image_url = image_url;
        }

        // Hacer solicitud al endpoint de PiAPI a través del proxy
        const apiResponse = await axios.post('/api/proxy/piapi/video/start', requestBody, {
          baseURL: `${req.protocol}://${req.get('host')}`
        });

        // Devolver la respuesta del endpoint de PiAPI
        console.log('Respuesta del endpoint de PiAPI:', apiResponse.data);
        return res.json({
          success: true,
          url: apiResponse.data.result?.url || null,
          taskId: apiResponse.data.taskId,
          status: apiResponse.data.status,
          provider: 'piapi'
        });
      } else {
        // Si es otro proveedor, devolver error no implementado
        return res.status(400).json({
          success: false,
          error: `Proveedor ${apiProvider} no implementado aún`
        });
      }
    } catch (error: any) {
      console.error('Error generando video:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message || 'Error al generar video'
      });
    }
  });

  // Definir los endpoints adicionales de estado que no requieren autenticación
  /**
   * Endpoint específico para verificar el estado de tareas de generación de video
   * Esta ruta es pública y no requiere autenticación
   */
  app.get('/api/video/status', async (req, res) => {
    try {
      const { taskId, provider } = req.query;
      
      console.log('Procesando solicitud de estado de video:', { taskId, provider });
      
      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere el ID de la tarea'
        });
      }
      
      if (provider === 'piapi') {
        // Verificar estado en PiAPI
        console.log(`Verificando estado de tarea de video ${taskId} con proveedor ${provider}`);
        try {
          const proxyRes = await axios.get(
            `${req.protocol}://${req.get('host')}/api/proxy/piapi/video/status?taskId=${taskId}`
          );
          
          console.log('Respuesta de verificación de estado:', proxyRes.data);
          return res.json(proxyRes.data);
        } catch (proxyError) {
          console.error('Error al verificar estado en proxy:', proxyError);
          return res.status(500).json({
            success: false,
            error: 'Error al verificar estado de la tarea de video'
          });
        }
      } else if (provider === 'luma') {
        // Verificar estado en Luma
        try {
          const proxyRes = await axios.get(
            `${req.protocol}://${req.get('host')}/api/proxy/luma/status?taskId=${taskId}`
          );
          
          return res.json(proxyRes.data);
        } catch (proxyError) {
          return res.status(500).json({
            success: false,
            error: 'Error al verificar estado de la tarea en Luma'
          });
        }
      } else if (provider === 'kling') {
        // Verificar estado en Kling
        try {
          const proxyRes = await axios.get(
            `${req.protocol}://${req.get('host')}/api/proxy/kling/video/status?taskId=${taskId}`
          );
          
          return res.json(proxyRes.data);
        } catch (proxyError) {
          return res.status(500).json({
            success: false,
            error: 'Error al verificar estado de la tarea en Kling'
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: `Proveedor no soportado: ${provider}`
        });
      }
    } catch (error: any) {
      console.error('Error al verificar estado de tarea de video:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor'
      });
    }
  });
  
  /**
   * Endpoint general para verificar el estado de cualquier tarea asíncrona
   * Esta ruta también es pública y no requiere autenticación
   */
  app.get('/api/task/status', async (req, res) => {
    try {
      const { taskId, provider } = req.query;
      
      console.log('Procesando solicitud general de estado de tarea:', { taskId, provider });
      
      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere el ID de la tarea'
        });
      }
      
      // Redirigir a los endpoints específicos según el proveedor
      if (provider === 'piapi' || provider === 'luma' || provider === 'kling') {
        // Para proveedores de video, usar el endpoint de video
        try {
          const proxyUrl = `${req.protocol}://${req.get('host')}/api/video/status?taskId=${taskId}&provider=${provider}`;
          console.log(`Redirigiendo a endpoint de video: ${proxyUrl}`);
          const videoRes = await axios.get(proxyUrl);
          return res.json(videoRes.data);
        } catch (error) {
          console.error('Error al redirigir a endpoint de video:', error);
          return res.status(500).json({
            success: false,
            error: 'Error al verificar estado de la tarea de video'
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: `Proveedor no soportado o no especificado: ${provider}`
        });
      }
    } catch (error: any) {
      console.error('Error verificando estado de tarea:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor'
      });
    }
  });

  // IMPORTANTE: Registrar esta ruta pública antes de cualquier middleware de autenticación global
  // Esta ruta proporciona información pública sobre los planes de suscripción
  app.get('/api/subscription-plans', (req, res) => {
    res.json({
      success: true,
      message: 'Información sobre planes de suscripción',
      plans: [
        { 
          name: 'Free', 
          price: 0,
          features: [
            'Acceso básico a la plataforma',
            'Visualización de tutoriales gratuitos',
            'Comunidad de artistas',
            'Funcionalidades limitadas'
          ]
        },
        { 
          name: 'Basic', 
          price: 59.99,
          features: [
            'Cursos básicos de producción musical',
            'Análisis básico de canciones',
            'Generación básica de audio con IA',
            'Hasta 10 producciones mensuales'
          ]
        },
        { 
          name: 'Pro', 
          price: 99.99,
          features: [
            'Todas las funcionalidades Basic',
            'Cursos avanzados de producción musical',
            'Análisis detallado de canciones con IA',
            'Generación avanzada de audio con IA',
            'Hasta 30 producciones mensuales',
            'Acceso a herramientas de masterización'
          ]
        },
        { 
          name: 'Premium', 
          price: 149.99,
          features: [
            'Todas las funcionalidades Pro',
            'Masterclasses exclusivas con artistas reconocidos',
            'Análisis predictivo de tendencias musicales',
            'Generación ilimitada de audio con IA',
            'Herramientas avanzadas de distribución musical',
            'Soporte personalizado 24/7',
            'Acceso temprano a nuevas funcionalidades'
          ]
        }
      ]
    });
  });
  
  // NOTE: Clerk Auth middleware is configured in server/index.ts BEFORE registerRoutes()
  // This ensures all /api routes have access to req.user via clerkAuthMiddleware
  
  // Register contracts router (Passport is initialized in server/index.ts)
  app.use('/api/contracts', contractsRouter);
  console.log('✅ Router de contratos registrado');
  
  // Register BoostiSwap Smart Contracts router
  app.use('/api/boostiswap/contracts', boostiswapContractsRouter);
  console.log('✅ Router de BoostiSwap Smart Contracts registrado');
  
  // Register BoostiSwap Marketplace router
  app.use('/api/boostiswap', boostiswapRouter);
  console.log('✅ Router de BoostiSwap Marketplace registrado');

  // Register Monetization router (Revenue tracking, fees, promotions)
  app.use('/api/monetization', monetizationRouter);
  console.log('✅ Router de Monetización registrado');

  // Social Media Content Generator routes
  app.use('/api/social-media', socialMediaRouter);
  console.log('✅ Router de Social Media Content Generator registrado');

  // AI Intelligence routes (News Agent, Whisper Agent, Outreach Agent)
  app.use('/api/ai-intelligence', aiIntelligenceRouter);
  console.log('✅ Router de AI Intelligence registrado (News, Whisper, Outreach)');
  
  // Seed tokenized songs on startup (non-blocking)
  seedTokenizedSongs().catch(error => {
    console.error('⚠️ Error seeding tokenized songs:', error);
  });
  
  setupSpotifyRoutes(app);
  setupInstagramRoutes(app);
  setupVideosRoutes(app);
  // Video Notes (time-coded annotations on videos)
  registerVideoNotesList(app); // GET & POST under /api/videos/:videoId/notes
  app.use('/api/video-notes', videoNotesRouter); // PATCH/DELETE /:id
  setupEmailRoutes(app);
  setupApifyRoutes(app);
  setupLeadRoutes(app); // Lead capture from landing pages
  setupFiverServicesRoutes(app);
  setupOutreachRoutes(app); // Music industry contacts outreach system
  setupSocialNetworkRoutes(app);
  app.use('/api/stripe', stripeRouter);
  
  // Stripe Webhook (debe estar antes de cualquier middleware de autenticación)
  app.use('/api/stripe', webhookStripeRouter);
  
  // Resend Email Webhooks (legacy - keeping for backward compatibility)
  app.use('/api/webhooks/resend', resendWebhooksRouter);
  console.log('✅ Resend Email Webhooks router registered (legacy)');
  
  // Brevo Email Webhooks (primary email provider for info@boostifymusic.com)
  app.use('/api/webhooks/brevo', brevoWebhooksRouter);
  console.log('✅ Brevo Email Webhooks router registered');
  
  // Subscription API (PostgreSQL)
  app.use('/api/subscription', subscriptionApiRouter);
  app.use('/api/user', subscriptionApiRouter);
  
  // Setup subscription-protected routes
  setupSubscriptionRoutes(app);
  
  app.use('/api/subscription', authenticate, subscriptionRoutesRouter);

  // Usar Firestore para la red social
  app.use('/api/firestore-social', firestoreSocialNetworkRouter);

  // Register courses routes
  app.use(coursesRouter);

  // Register achievements routes
  app.use(achievementsRouter);

  // Register investors routes
  app.use('/api/investors', investorsRouter);
  app.use('/api/admin/investor-payments', adminInvestorPaymentsRouter);
  
  // Register Professional Editor routes
  app.use('/api/editor', professionalEditorRouter);
  
  // Register music generation routes - specific routes handling
  // Separate public test endpoint from authenticated routes
  
  // Register affiliate program routes
  app.use('/api/affiliate', affiliateRouter);
  app.use('/', affiliateTrackingRouter); // Tracking routes (public, no auth required)
  
  // Register PR Agent routes
  app.use('/api/pr', prAgentRouter);
  app.use('/api/pr-ai', prAIRouter);
  
  // Register EPK Generator routes
  app.use('/api/epk', epkRouter);
  // Pretty public alias: /epk/:slug → same HTML page (delegates to the API route)
  app.get('/epk/:slug', (req, res, next) => {
    req.url = `/${req.params.slug}/html`;
    return (epkRouter as any).handle(req, res, next);
  });
  
  // Register musicians routes
  app.use('/api', musiciansRouter);
  app.use('/api', musicianImportRouter); // /api/musicians/import, /api/musicians/import/batches
  app.use('/api/musician-messaging', musicianMessagingRouter); // conversations + contracts
  app.use('/api/mini-studio', miniStudioLyricsRouter); // Lyrics generate + rewrite
  app.use('/api/mini-studio', miniStudioRouter); // DAW projects + AI generation + mastering + release
  app.use('/api/song-dna', songDnaSavedRouter); // Song DNA saved analyses (/saved, /save, /saved/:id)
  app.use('/api/service-requests', serviceRequestsRouter); // Service requests & bidding system (Uber-style)
  app.use('/api/studio', studioRouter); // Studio projects & version control
  
  app.post('/api/music/test-integration', (req, res) => {
    try {
      const { prompt = 'Una melodía suave de piano' } = req.body;
      
      const taskId = uuidv4();
      
      // Solo verificamos si existe la API key para este test público
      if (process.env.PIAPI_API_KEY) {
        return res.status(200).json({ 
          success: true, 
          message: 'API key de PiAPI encontrada, la integración parece estar correctamente configurada',
          test_only: true,
          api_key_present: true
        });
      } else {
        return res.status(200).json({
          success: false,
          message: 'No se encontró API_KEY para PiAPI en variables de entorno'
        });
      }
    } catch (error) {
      console.error('Error en test de integración:', error);
      res.status(500).json({ error: 'Error interno al probar la integración' });
    }
  });
  
  // Eliminamos la línea duplicada que registra las rutas de música
  // (ya está registrada en la línea 125)


  // AI Campaign Suggestions Route
  app.post("/api/ai/campaign-suggestion", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const { name, description, platform, budget } = req.body;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const completion = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a marketing expert specialized in music promotion campaigns. Provide suggestions in Spanish to optimize campaign performance. Format your response as JSON with a 'suggestions' field containing an array of string suggestions."
          },
          {
            role: "user",
            content: `Por favor analiza y proporciona sugerencias para esta campaña:
              Nombre: ${name}
              Descripción: ${description}
              Plataforma: ${platform}
              Presupuesto: $${budget}

              Proporciona sugerencias específicas y prácticas para mejorar la efectividad de la campaña.`
          }
        ],
        response_format: { type: "json_object" }
      });

      // Parse the response and ensure it has the expected structure
      const suggestions = JSON.parse(completion.choices[0].message.content);
      if (!suggestions.suggestions) {
        throw new Error('Formato de respuesta AI inválido');
      }

      res.json({ suggestion: suggestions.suggestions.join('\n\n') });
    } catch (error: any) {
      console.error('Error getting AI suggestions:', error);
      res.status(500).json({
        error: "Error al generar sugerencias para la campaña",
        details: error.message
      });
    }
  });

  app.post("/api/generate-strategy", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const completion = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [
          {
            role: "system",
            content: "You are a music industry expert specialized in artist growth strategies. Generate 3-5 actionable focus points for the artist's growth strategy in Spanish. Format your response as JSON with a 'strategy' array containing string items. Each strategy point should be specific and actionable."
          },
          {
            role: "user",
            content: "Generate a strategic growth plan for an emerging music artist focusing on social media presence, music releases, and collaborations. Consider aspects like content creation, audience engagement, and promotional activities. Provide the response in Spanish."
          }
        ],
        response_format: { type: "json_object" }
      });

      // Parse the response and ensure it has the expected structure
      const result = JSON.parse(completion.choices[0].message.content);
      if (!Array.isArray(result.strategy)) {
        throw new Error('Invalid AI response format');
      }

      return res.json({ strategy: result.strategy });
    } catch (error: any) {
      console.error('Error generating strategy:', error);
      return res.status(500).json({
        error: "Error al generar estrategia",
        details: error.message
      });
    }
  });

  // Create subscription checkout session
  // Eliminamos esta ruta duplicada ya que ahora usamos '/api/stripe/create-subscription' 
  // definida en server/routes/stripe.ts


  // Create checkout session
  app.post("/api/create-checkout-session", async (req, res) => {
    console.log('Received checkout session request:', {
      body: req.body,
      user: req.user,
      isAuthenticated: req.isAuthenticated()
    });

    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const { musicianId, price, currency } = req.body;

      if (!musicianId || !price || !currency) {
        return res.status(400).json({
          error: "Missing required fields: musicianId, price, or currency"
        });
      }

      console.log('Creating checkout session for:', { musicianId, price, currency });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: 'Music Session Booking',
                description: `Session booking with musician ID: ${musicianId}`,
              },
              unit_amount: Math.round(price * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.PRODUCTION_URL || 'https://boostifymusic.com'}/booking-confirmation?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${process.env.PRODUCTION_URL || 'https://boostifymusic.com'}/booking-confirmation?canceled=true`,
        metadata: {
          musicianId,
          userId: req.user!.id,
        },
      });

      console.log('Created session:', session.id);

      return res.json({
        sessionId: session.id
      });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      return res.status(500).json({
        error: error.message || "Error creating checkout session"
      });
    }
  });

  // Add the new course checkout route here
  app.post("/api/create-course-checkout", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const { courseId, title, price, thumbnail } = req.body;

      if (!courseId || !title || !price) {
        return res.status(400).json({
          error: "Missing required fields: courseId, title, or price"
        });
      }

      console.log('Creating course checkout session for:', { courseId, title, price });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: title,
                description: `Enrollment for course: ${title}`,
                images: thumbnail ? [thumbnail] : undefined,
              },
              unit_amount: Math.round(price * 100), // Convert to cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.PRODUCTION_URL || 'https://boostifymusic.com'}/course/${courseId}?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${process.env.PRODUCTION_URL || 'https://boostifymusic.com'}/education?canceled=true`,
        metadata: {
          courseId,
          userId: req.user!.id,
        },
      });

      console.log('Created session:', session.id);

      return res.json({
        sessionId: session.id
      });
    } catch (error: any) {
      console.error('Error creating course checkout session:', error);
      return res.status(500).json({
        error: error.message || "Error creating checkout session"
      });
    }
  });

  // Update the webhook handler to handle checkout.session.completed events
  app.post("/api/webhook", express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig || '',
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error('Webhook Error:', err.message);
      res.status(400).json({ error: `Webhook Error: ${err.message}` });
      return;
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      try {
        const { userId, musicianId } = session.metadata || {};

        if (userId && musicianId) {
          // Create the booking record
          await db.insert(bookings).values({
            userId: parseInt(userId),
            musicianId,
            status: 'pending',
            paymentStatus: 'paid',
            price: session.amount_total! / 100,
            currency: session.currency,
          });
        }
      } catch (error) {
        console.error('Error processing successful payment:', error);
      }
    }

    res.json({ received: true });
  });

  // Get user's metrics
  app.get("/api/metrics", async (req, res) => {
    if (!req.user?.id) return res.sendStatus(401);

    const [metrics] = await db
      .select()
      .from(marketingMetrics)
      .where(eq(marketingMetrics.userId, req.user.id))
      .limit(1);

    res.json(metrics ?? {
      spotifyFollowers: 0,
      instagramFollowers: 0,
      playlistPlacements: 0,
      monthlyListeners: 0
    });
  });

  // Save a new contract
  app.post("/api/contracts", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "No token provided" });

    try {
      const contractData = contractSchema.parse(req.body);

      const [result] = await db.insert(contracts).values({
        title: contractData.title,
        type: contractData.type,
        content: contractData.content,
        status: contractData.status,
        userId: req.user!.id,
      }).returning();

      res.status(201).json(result);
    } catch (error) {
      console.error('Error saving contract:', error);
      res.status(400).json({ error: 'Invalid contract data' });
    }
  });

  // Get user's contracts
  app.get("/api/contracts", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "No token provided" });

    try {
      const userContracts = await db.select().from(contracts)
        .where(eq(contracts.userId, req.user!.id))
        .orderBy(desc(contracts.createdAt));

      res.json(userContracts);
    } catch (error) {
      console.error('Error fetching contracts:', error);
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  });

  // Get a specific contract
  app.get("/api/contracts/:id", async (req, res) => {
    if (!req.user?.id) return res.sendStatus(401);

    try {
      const [contract] = await db.query.contracts.findMany({
        where: and(
          eq(contracts.id, parseInt(req.params.id)),
          eq(contracts.userId, req.user.id)
        ),
        limit: 1
      });

      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      res.json(contract);
    } catch (error) {
      console.error('Error fetching contract:', error);
      res.status(500).json({ error: 'Failed to fetch contract' });
    }
  });

  // Create a new booking
  app.post("/api/bookings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

    try {
      const bookingData = insertBookingSchema.parse(req.body);

      const [result] = await db
        .insert(bookings)
        .values({
          ...bookingData,
          userId: req.user!.id,
        })
        .returning();

      res.status(201).json(result);
    } catch (error) {
      console.error('Error creating booking:', error);
      res.status(400).json({ error: 'Invalid booking data' });
    }
  });

  // Get user's bookings
  app.get("/api/bookings", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

    try {
      const userBookings = await db
        .select()
        .from(bookings)
        .where(eq(bookings.userId, req.user!.id))
        .orderBy(desc(bookings.createdAt));

      res.json(userBookings);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      res.status(500).json({ error: 'Failed to fetch bookings' });
    }
  });


  // Add Stripe payment intent creation endpoint
  app.post("/api/create-payment-intent", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const { musicianId, price, currency } = req.body;

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(price * 100), // Stripe expects amounts in cents
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          musicianId,
          userId: req.user.id,
        },
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error) {
      console.error('Error creating payment intent:', error);
      res.status(500).json({ error: 'Failed to create payment intent' });
    }
  });

  // Add Stripe webhook handler
  app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;

        // Update booking and payment status
        const [booking] = await db
          .select()
          .from(bookings)
          .where(eq(bookings.id, parseInt(paymentIntent.metadata.bookingId)))
          .limit(1);

        if (booking) {
          await db.transaction(async (tx) => {
            await tx
              .update(bookings)
              .set({ paymentStatus: 'paid' })
              .where(eq(bookings.id, booking.id));

            await tx
              .insert(payments)
              .values({
                bookingId: booking.id,
                stripePaymentIntentId: paymentIntent.id,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency,
                status: 'succeeded',
              });
          });
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      console.error('Error handling webhook:', error);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  });

  // Get user's current analytics metrics
  app.get("/api/analytics/metrics", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

    try {
      const [metrics] = await db
        .select()
        .from(marketingMetrics)
        .where(eq(marketingMetrics.userId, req.user!.id))
        .limit(1);

      if (!metrics) {
        // Initialize metrics if they don't exist
        const [newMetrics] = await db
          .insert(marketingMetrics)
          .values({
            userId: req.user!.id,
            updatedAt: new Date(),
          })
          .returning();

        return res.json(newMetrics);
      }

      res.json(metrics);
    } catch (error) {
      console.error('Error fetching analytics metrics:', error);
      res.status(500).json({ error: 'Failed to fetch analytics metrics' });
    }
  });

  // Get analytics history with optional date range
  app.get("/api/analytics/history", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

    try {
      const { startDate, endDate, metrics } = req.query;
      let query = db
        .select()
        .from(analyticsHistory)
        .where(eq(analyticsHistory.userId, req.user!.id))
        .orderBy(desc(analyticsHistory.timestamp));

      if (startDate) {
        query = query.where(gte(analyticsHistory.timestamp, new Date(startDate as string)));
      }

      if (endDate) {
        query = query.where(lte(analyticsHistory.timestamp, new Date(endDate as string)));
      }

      if (metrics) {
        const metricsList = (metrics as string).split(',');
        query = query.where(inArray(analyticsHistory.metricName, metricsList));
      }

      const history = await query;

      res.json(history);
    } catch (error) {
      console.error('Error fetching analytics history:', error);
      res.status(500).json({ error: 'Failed to fetch analytics history' });
    }
  });

  // Get analytics summary for dashboard
  app.get("/api/analytics/summary", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

    try {
      const [metrics] = await db
        .select({
          totalEngagement: marketingMetrics.totalEngagement,
          websiteVisits: marketingMetrics.websiteVisits,
          totalRevenue: marketingMetrics.totalRevenue,
          spotifyFollowers: marketingMetrics.spotifyFollowers,
          instagramFollowers: marketingMetrics.instagramFollowers,
          youtubeViews: marketingMetrics.youtubeViews
        })
        .from(marketingMetrics)
        .where(eq(marketingMetrics.userId, req.user!.id))
        .limit(1);

      const last30DaysHistory = await db
        .select()
        .from(analyticsHistory)
        .where(
          and(
            eq(analyticsHistory.userId, req.user!.id),
            gte(analyticsHistory.timestamp, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
          )
        )
        .orderBy(desc(analyticsHistory.timestamp));

      res.json({
        currentMetrics: metrics || {
          totalEngagement: 0,
          websiteVisits: 0,
          totalRevenue: 0,
          spotifyFollowers: 0,
          instagramFollowers: 0,
          youtubeViews: 0
        },
        history: last30DaysHistory
      });
    } catch (error) {
      console.error('Error fetching analytics summary:', error);
      res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
  });

  // Get all events for a user
  app.get("/api/events", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

    try {
      const userEvents = await db
        .select()
        .from(events)
        .where(eq(events.userId, req.user!.id))
        .orderBy(desc(events.startDate));

      res.json(userEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  // Update the events creation route
  app.post("/api/events", async (req, res) => {
    console.log('Create event request:', {
      body: req.body,
      user: req.user,
      isAuthenticated: req.isAuthenticated()
    });

    if (!req.isAuthenticated()) {
      console.log('User not authenticated');
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      if (!req.body.title || !req.body.startDate || !req.body.endDate || !req.body.location) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const eventData = {
        ...req.body,
        userId: req.user!.id,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        status: req.body.status || 'upcoming',
        type: req.body.type || 'other'
      };

      console.log('Attempting to create event with data:', eventData);

      const [event] = await db
        .insert(events)
        .values(eventData)
        .returning();

      if (!event) {
        throw new Error('Failed to create event in database');
      }

      console.log('Event created successfully:', event);
      res.status(201).json(event);
    } catch (error: any) {
      console.error('Error creating event:', error);
      res.status(400).json({
        error: error.message || "Failed to create event",
        details: error
      });
    }
  });

  // Delete an event
  app.delete("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

    try {
      const [deletedEvent] = await db
        .delete(events)
        .where(
          and(
            eq(events.id, parseInt(req.params.id)),
            eq(events.userId, req.user!.id)
          )
        )
        .returning();

      if (!deletedEvent) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ error: 'Failed to delete event' });
    }
  });

  // Update an event
  app.patch("/api/events/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Authentication required" });

    try {
      const [updatedEvent] = await db
        .update(events)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(events.id, parseInt(req.params.id)),
            eq(events.userId, req.user!.id)
          )
        )
        .returning();

      if (!updatedEvent) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json(updatedEvent);
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ error: 'Failed to update event' });
    }
  });

  // When a course is completed, award the achievement
  app.post("/api/courses/:courseId/complete", authenticate, async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const courseId = parseInt(req.params.courseId);

      // Update course enrollment status
      await db
        .update(courseEnrollments)
        .set({
          status: 'completed',
          completedAt: new Date(),
          progress: 100
        })
        .where(
          and(
            eq(courseEnrollments.courseId, courseId),
            eq(courseEnrollments.userId, req.user.id)
          )
        );

      // Award achievement
      await awardCourseCompletionAchievement(req.user.id, courseId);

      res.json({ message: 'Course completed successfully' });
    } catch (error) {
      console.error('Error completing course:', error);
      res.status(500).json({ error: 'Failed to complete course' });
    }
  });

  // Endpoint de API para verificación de salud sin interferir con el enrutamiento de frontend
  // Importante: SOLO definimos endpoints que comiencen con '/api' para evitar conflictos
  app.get('/api/status', (req, res) => {
    res.status(200).json({
      status: "online",
      message: "Boostify Music API is running",
      timestamp: new Date().toISOString()
    });
  });

  // Health check duplicado eliminado — ver server/index.ts (handler único)
  
  // Eliminamos completamente el manejador de ruta raíz '/'
  // Esto permite que Vite se encargue correctamente de servir la aplicación frontend
  // en modo desarrollo, y en producción se manejará a través de la configuración en server/index.ts

  // Deployment verification endpoint
  app.get("/api/deployment-info", (_req, res) => {
    res.status(200).json({
      status: "online",
      version: "1.0.0",
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      serverPath: __dirname
    });
  });

  /**
   * Endpoint para generar videos con PiAPI/Hailuo
   * Conecta el frontend con el endpoint del proxy
   */
  app.post('/api/video/generate', async (req, res) => {
    try {
      console.log('Recibiendo solicitud de generación de video:', req.body);
      
      // Preparar los parámetros para enviar al proxy
      const apiProvider = req.body.apiProvider;
      
      if (apiProvider === 'piapi') {
        // Preparar parámetros para PiAPI - manejo de nombres de parámetros esperados
        // Extraer el modelo del piapiModel si existe, o usar el campo model, o fallback a t2v-01
        const model = req.body.piapiModel || req.body.model || 't2v-01';
        
        // Extrae los movimientos de cámara que pueden venir en formato array o string
        let cameraMovement = null;
        if (req.body.cameraMovements && Array.isArray(req.body.cameraMovements)) {
          // Si es un array (formato del frontend), lo convertimos a string separado por comas
          cameraMovement = req.body.cameraMovements.join(',');
        } else if (req.body.camera_movement) {
          // Si ya viene como string (camera_movement), lo usamos directamente
          cameraMovement = req.body.camera_movement;
        }
        
        const proxyReq = {
          prompt: req.body.prompt,
          model: model,
          camera_movement: cameraMovement,
          image_url: req.body.image_url
        };
        
        console.log('Enviando solicitud al proxy con parámetros:', proxyReq);
        
        // Realizar la solicitud al proxy interno
        const proxyRes = await axios.post(
          `${req.protocol}://${req.get('host')}/api/proxy/piapi/video/start`,
          proxyReq
        );
        
        // Verificar si la respuesta fue exitosa
        if (proxyRes.data.success) {
          // La generación se inició correctamente, devolver el ID de tarea
          return res.json({
            success: true,
            taskId: proxyRes.data.taskId,
            provider: 'piapi',
            status: 'processing',
            // Para compatibilidad con el frontend actual, también devolvemos una URL temporal
            url: '/temp-processing.mp4'
          });
        } else {
          // Hubo un error en el proxy
          throw new Error(proxyRes.data.error || 'Error desconocido en el proxy de PiAPI');
        }
      } else {
        // Proveedores no soportados
        return res.status(400).json({
          success: false,
          error: `Proveedor no soportado: ${apiProvider}`
        });
      }
    } catch (error: any) {
      console.error('Error generando video:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor'
      });
    }
  });
  
  /**
   * Endpoint específico para verificar el estado de tareas de generación de video
   * Esta ruta es pública y no requiere autenticación
   */
  app.get('/api/video/status', async (req, res) => {
    try {
      const { taskId, provider } = req.query;
      
      console.log('Procesando solicitud de estado de video:', { taskId, provider });
      
      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere el ID de la tarea'
        });
      }
      
      if (provider === 'piapi') {
        // Verificar estado en PiAPI
        console.log(`Verificando estado de tarea de video ${taskId} con proveedor ${provider}`);
        try {
          const proxyRes = await axios.get(
            `${req.protocol}://${req.get('host')}/api/proxy/piapi/video/status?taskId=${taskId}`
          );
          
          console.log('Respuesta de verificación de estado:', proxyRes.data);
          return res.json(proxyRes.data);
        } catch (proxyError) {
          console.error('Error al verificar estado en proxy:', proxyError);
          return res.status(500).json({
            success: false,
            error: 'Error al verificar estado de la tarea de video'
          });
        }
      } else if (provider === 'luma') {
        // Verificar estado en Luma
        try {
          const proxyRes = await axios.get(
            `${req.protocol}://${req.get('host')}/api/proxy/luma/status?taskId=${taskId}`
          );
          
          return res.json(proxyRes.data);
        } catch (proxyError) {
          return res.status(500).json({
            success: false,
            error: 'Error al verificar estado de la tarea en Luma'
          });
        }
      } else if (provider === 'kling') {
        // Verificar estado en Kling
        try {
          const proxyRes = await axios.get(
            `${req.protocol}://${req.get('host')}/api/proxy/kling/video/status?taskId=${taskId}`
          );
          
          return res.json(proxyRes.data);
        } catch (proxyError) {
          return res.status(500).json({
            success: false,
            error: 'Error al verificar estado de la tarea en Kling'
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: `Proveedor no soportado: ${provider}`
        });
      }
    } catch (error: any) {
      console.error('Error al verificar estado de tarea de video:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor'
      });
    }
  });
  
  /**
   * Endpoint general para verificar el estado de cualquier tarea asíncrona
   * Esta ruta también es pública y no requiere autenticación
   */
  app.get('/api/task/status', async (req, res) => {
    try {
      const { taskId, provider } = req.query;
      
      console.log('Procesando solicitud general de estado de tarea:', { taskId, provider });
      
      if (!taskId) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere el ID de la tarea'
        });
      }
      
      // Redirigir a los endpoints específicos según el proveedor
      if (provider === 'piapi' || provider === 'luma' || provider === 'kling') {
        // Para proveedores de video, usar el endpoint de video
        try {
          const proxyUrl = `${req.protocol}://${req.get('host')}/api/video/status?taskId=${taskId}&provider=${provider}`;
          console.log(`Redirigiendo a endpoint de video: ${proxyUrl}`);
          const videoRes = await axios.get(proxyUrl);
          return res.json(videoRes.data);
        } catch (error) {
          console.error('Error al redirigir a endpoint de video:', error);
          return res.status(500).json({
            success: false,
            error: 'Error al verificar estado de la tarea de video'
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: `Proveedor no soportado o no especificado: ${provider}`
        });
      }
    } catch (error: any) {
      console.error('Error verificando estado de tarea:', error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor'
      });
    }
  });

  /**
   * Save Artist Profile Layout
   */
  app.post('/api/profile/:artistId/layout', async (req, res) => {
    try {
      const { artistId } = req.params;
      const { order, visibility, expanded, rightOrder, rightExpanded, rightVisibility, colorTheme, customBlocks, mobileColumnFirst, fontKey, sideOverride, presets } = req.body;

      if (!order || !visibility) {
        return res.status(400).json({
          success: false,
          error: 'Order and visibility are required'
        });
      }

      // artistId may be either a numeric PostgreSQL id (as string) OR a
      // Firestore UUID string. Resolve to the numeric users.id before updating,
      // otherwise parseInt on a UUID yields NaN and the update silently
      // matches zero rows (this was why layout changes weren't persisting).
      let numericId: number | null = null;
      const parsed = parseInt(artistId, 10);
      if (!isNaN(parsed) && String(parsed) === String(artistId)) {
        numericId = parsed;
      } else {
        const [byFirestore] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.firestoreId, artistId))
          .limit(1);
        if (byFirestore) numericId = byFirestore.id;
      }

      if (numericId == null) {
        return res.status(404).json({
          success: false,
          error: 'Artist not found'
        });
      }

      // Update layout in PostgreSQL
      const result = await db.update(users)
        .set({
          profileLayout: {
            order,
            visibility,
            expanded: expanded || {},
            rightOrder: rightOrder || [],
            rightExpanded: rightExpanded || {},
            rightVisibility: rightVisibility || {},
            colorTheme: colorTheme || null,
            fontKey: fontKey || 'default',
            customBlocks: customBlocks || {},
            mobileColumnFirst: mobileColumnFirst === 'right' ? 'right' : 'left',
            sideOverride: (sideOverride && typeof sideOverride === 'object' && !Array.isArray(sideOverride)) ? sideOverride : {},
            presets: Array.isArray(presets) ? presets : [],
          } as any,
          updatedAt: new Date()
        })
        .where(eq(users.id, numericId))
        .returning({ id: users.id });

      console.log('✅ Profile layout saved for artist:', artistId, '(pg id:', numericId, ') rows:', result.length);

      return res.json({
        success: true,
        message: 'Layout saved successfully'
      });
    } catch (error: any) {
      console.error('❌ Error saving profile layout:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save layout'
      });
    }
  });

  /**
   * Early Access Signup - Send to Make.com webhook
   */
  app.post('/api/early-access/signup', async (req, res) => {
    try {
      const { name, artistName, phone, email } = req.body;
      
      // Validate input
      if (!name || !artistName || !phone || !email) {
        return res.status(400).json({
          success: false,
          error: 'All fields are required'
        });
      }

      // Send to Make.com webhook
      const webhookUrl = 'https://hook.us2.make.com/fdp25ml6h3r5781gocrujzqyuenp8ms6';
      
      await axios.post(webhookUrl, {
        name,
        artistName,
        phone,
        email,
        timestamp: new Date().toISOString()
      });

      console.log('✅ Early access signup sent to webhook:', { name, artistName, email });

      return res.json({
        success: true,
        message: 'Successfully registered for early access'
      });
    } catch (error: any) {
      console.error('❌ Error sending early access signup to webhook:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to register for early access'
      });
    }
  });

  /**
   * Artist Token Purchase Endpoints
   */

  /**
   * Artist Token Purchase Endpoints
   */
  app.post('/api/token-purchase', async (req: any, res) => {
    try {
      const { artistId, tokenAmount } = req.body;
      
      if (!artistId || !tokenAmount) {
        return res.status(400).json({ error: 'Missing artistId or tokenAmount' });
      }

      console.log(`🛒 Token purchase request: Artist ${artistId}, Amount: ${tokenAmount}`);

      res.json({
        success: true,
        transactionId: `TXN_${Date.now()}`,
        artistId,
        tokenAmount,
        status: 'pending',
        message: 'Purchase initiated. Redirecting to payment...'
      });
    } catch (error) {
      console.error('❌ Token purchase error:', error);
      res.status(500).json({ error: 'Failed to process token purchase' });
    }
  });

  app.get('/checkout', (req: any, res) => {
    try {
      const { artistId, amount } = req.query;
      console.log(`💳 Checkout page requested for artist ${artistId}, amount: ${amount}`);
      
      res.json({
        success: true,
        artistId,
        tokenAmount: amount,
        pricePerToken: 0.50,
        totalPrice: parseFloat(amount) * 0.50,
        paymentMethods: ['stripe', 'crypto', 'paypal'],
        status: 'ready_for_checkout'
      });
    } catch (error) {
      console.error('❌ Checkout error:', error);
      res.status(500).json({ error: 'Failed to initiate checkout' });
    }
  });

  // Auto-create sample courses endpoint
  app.post('/api/education/create-sample-courses', async (req: any, res) => {
    try {
      const admin = require('firebase-admin');
      const db = admin.firestore();
      
      const sampleCourses = [
        { title: "Music Marketing Mastery", description: "Learn advanced digital marketing strategies specifically tailored for musicians and music industry professionals. From social media optimization to email campaigns, discover how to effectively promote your music in the digital age.", category: "Marketing", level: "Intermediate", price: 199 },
        { title: "Music Business Essentials", description: "Master the fundamentals of the music business. Learn about copyright law, royalties, music licensing, and how to navigate contracts. Essential knowledge for any music professional.", category: "Business", level: "Beginner", price: 249 },
        { title: "Advanced Music Production & Engineering", description: "Deep dive into professional music production techniques. From advanced mixing and mastering to studio workflow optimization, take your production skills to the next level.", category: "Production", level: "Advanced", price: 299 },
        { title: "Artist Brand Development", description: "Learn how to build and maintain a strong artist brand. Cover everything from visual identity to social media presence, and create a compelling artist narrative that resonates with your audience.", category: "Branding", level: "Intermediate", price: 179 },
        { title: "Digital Music Distribution Mastery", description: "Master the digital distribution landscape. Learn about streaming platforms, playlist pitching, release strategies, and how to maximize your music's reach in the digital age.", category: "Distribution", level: "Beginner", price: 149 }
      ];

      const defaultImages = {
        "Marketing": "https://storage.googleapis.com/pai-images/ae9e7782ddee4a0b9a1d2f5374fc0167.jpeg",
        "Business": "https://storage.googleapis.com/pai-images/a0bb7f209be241cbbc4982a177f2d7d1.jpeg",
        "Production": "https://storage.googleapis.com/pai-images/fd0f6b4aff5d4469ab4afd39d0490253.jpeg",
        "Branding": "https://storage.googleapis.com/pai-images/16c2b91fafb84224b52e7bb0e13e4fe4.jpeg",
        "Distribution": "https://storage.googleapis.com/pai-images/8e9a835ef5404252b5ff5eba50d04aec.jpeg"
      };

      // Check if courses already exist
      const coursesRef = db.collection('courses');
      const existingCourses = await coursesRef.limit(1).get();
      
      if (!existingCourses.empty) {
        return res.json({ success: true, message: 'Courses already exist', count: 0 });
      }

      let createdCount = 0;
      for (const course of sampleCourses) {
        const courseData = {
          ...course,
          thumbnail: defaultImages[course.category] || defaultImages["Marketing"],
          lessons: 4,
          duration: "4 weeks",
          rating: Number((Math.random() * (5 - 3.5) + 3.5).toFixed(1)),
          totalReviews: Math.floor(Math.random() * (1000 - 50 + 1)) + 50,
          enrolledStudents: Math.floor(Math.random() * (5000 - 100 + 1)) + 100,
          content: { curriculum: [{ title: "Lesson 1" }], overview: course.description },
          createdAt: admin.firestore.Timestamp.now(),
          createdBy: "system"
        };

        await coursesRef.add(courseData);
        createdCount++;
      }

      console.log(`✅ Created ${createdCount} sample courses`);
      res.json({ success: true, message: `Created ${createdCount} courses`, count: createdCount });
    } catch (error: any) {
      console.error('❌ Error creating courses:', error);
      res.status(500).json({ error: error.message || 'Failed to create courses' });
    }
  });

  const httpServer = createServer(app);
  
  // Initialize Socket.io for real-time podcast studio communication
  initSocketIO(httpServer);

  // Initialize the HoloStage real-time gateway (Show Orchestrator bridge at /ws/holostage)
  initHolostageGateway(httpServer);
  
  httpServer.timeout = 900000;
  httpServer.keepAliveTimeout = 900000;
  httpServer.headersTimeout = 910000;
  
  console.log('⏱️ Server timeouts configured: 15 minutes for long-running operations');
  
  return httpServer;
}
