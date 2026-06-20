/**
 * Boostify Distribution Orchestrator
 * Complete music distribution management system
 * 
 * Modules:
 * 1. Partner Manager — CRUD for white-label distribution partners
 * 2. Release Builder — Create releases, validate metadata, assign ISRC/UPC
 * 3. Delivery Engine — Submit releases to DSPs, track status
 * 4. Royalty Engine — Track earnings, splits, payouts
 * 5. Module Audit — Status of all distribution infrastructure
 */

import { db } from "../db";
import {
  distributionPartners, releases, releaseTracks,
  distributionSubmissions, royaltyTransactions, streamingAnalytics,
  dspPlatforms, songs, users,
  type InsertDistributionPartner, type InsertRelease,
  type InsertReleaseTrack, type InsertDistributionSubmission,
  type InsertRoyaltyTransaction
} from "../../db/schema";
import { eq, desc, and, sql, count, sum } from "drizzle-orm";
import { randomBytes } from "crypto";

// ============================================================================
// ISRC / UPC Generation
// ============================================================================

function generateISRC(): string {
  // Format: CC-XXX-YY-NNNNN (Country-Registrant-Year-Designation)
  const year = new Date().getFullYear().toString().slice(-2);
  const designation = Math.floor(10000 + Math.random() * 90000).toString();
  return `US-BFY-${year}-${designation}`;
}

function generateUPC(): string {
  // 12-digit UPC code
  const base = "8" + Math.floor(10000000000 + Math.random() * 90000000000).toString().slice(0, 11);
  return base.slice(0, 12);
}

// ============================================================================
// 1. PARTNER MANAGER
// ============================================================================

/**
 * Comprehensive partner profiles — verified from official sources only.
 * Contact data from official websites, support portals, and public pages.
 */
export interface PartnerProfile {
  name: string;
  slug: string;
  type: "white_label" | "api" | "affiliate" | "direct";
  tier: "tier1" | "tier2" | "tier3";
  website: string;
  contactEmail: string;
  contactRoutes: string[];      // Official backup contact methods
  apiDocs: string | null;       // Developer / API documentation URL
  whiteLabelOffering: string;   // What their WL program looks like
  b2bPath: string;              // How to initiate B2B partnership
  fitNotes: string;             // Why this partner fits Boostify
  priorityScore: number;        // 1-10, 10 = most urgent
  revSharePercent: string;
  setupFee: string;
  monthlyFee: string;
  territories: number;
  features: string[];
}

const RESEARCHED_PARTNERS: PartnerProfile[] = [
  {
    name: "FUGA (Downtown Music)",
    slug: "fuga",
    type: "white_label",
    tier: "tier1",
    website: "https://fuga.com",
    contactEmail: "support@fuga.com",
    contactRoutes: [
      "Support form: https://support.fuga.com/hc/en-us/requests/new",
      "LinkedIn: https://www.linkedin.com/company/fugamusic/",
      "Parent company: Downtown Music — https://downtownmusic.com/services/",
    ],
    apiDocs: "https://support.fuga.com/hc/en-us (API docs available to partners)",
    whiteLabelOffering: "Full white-label distribution platform, branded dashboards, API-first architecture. Labels operate under their own brand with FUGA powering the backend.",
    b2bPath: "Submit form at support.fuga.com → request partnership meeting → NDA → API sandbox → contract",
    fitNotes: "Best-in-class API infrastructure. YouTube CMS, neighboring rights, 200+ DSPs. Ideal primary backend partner for Boostify — powers major labels already.",
    priorityScore: 10,
    revSharePercent: "0",
    setupFee: "5000",
    monthlyFee: "0",
    territories: 200,
    features: ["Full REST API", "Real-time analytics API", "YouTube CMS", "Neighboring rights", "200+ DSPs", "White-label dashboards", "Automated delivery"],
  },
  {
    name: "Believe Digital",
    slug: "believe",
    type: "white_label",
    tier: "tier1",
    website: "https://www.believe.com",
    contactEmail: "contact@believe.com",
    contactRoutes: [
      "Partnership page: https://www.believe.com/contact",
      "LinkedIn: https://www.linkedin.com/company/believe-digital/",
      "Regional offices listed on believe.com/about",
    ],
    apiDocs: null,
    whiteLabelOffering: "TuneCore (subsidiary) provides self-serve; Believe offers managed white-label for labels with catalog >500 tracks. Branded label portals available.",
    b2bPath: "Email contact@believe.com or regional office → introductory call → catalog assessment → custom deal",
    fitNotes: "180+ countries, major indie distributor. Owns TuneCore. Strong in emerging markets (Latin America, Africa, Asia). Good fit for Boostify's global ambitions.",
    priorityScore: 9,
    revSharePercent: "0",
    setupFee: "5000",
    monthlyFee: "5000",
    territories: 180,
    features: ["White-label dashboard", "180+ countries", "Marketing tools", "Artist analytics", "Label services", "TuneCore integration", "Emerging market strength"],
  },
  {
    name: "Symphonic Distribution",
    slug: "symphonic",
    type: "white_label",
    tier: "tier1",
    website: "https://symphonic.com",
    contactEmail: "info@symphonic.com",
    contactRoutes: [
      "Label services: https://symphonic.com/label-services",
      "Contact form: https://symphonic.com/contact",
      "LinkedIn: https://www.linkedin.com/company/symphonic-distribution/",
    ],
    apiDocs: null,
    whiteLabelOffering: "Symphonic for Labels: white-label distribution portal, custom branding, dedicated account manager. Publishing admin included. Revenue sharing or flat-fee models.",
    b2bPath: "Apply via symphonic.com/label-services → review → custom pricing → onboarding",
    fitNotes: "100% royalties option, free tier for small labels, publishing admin, sync licensing. Very artist-friendly — aligns with Boostify's values. Based in Tampa, FL.",
    priorityScore: 9,
    revSharePercent: "0",
    setupFee: "0",
    monthlyFee: "0",
    territories: 150,
    features: ["100% royalties option", "Free tier available", "Label Hub", "Publishing admin", "Sync licensing", "Custom branding", "Dedicated account manager"],
  },
  {
    name: "Stem",
    slug: "stem",
    type: "white_label",
    tier: "tier1",
    website: "https://stem.is",
    contactEmail: "info@stem.is",
    contactRoutes: [
      "Contact page: https://stem.is/contact",
      "LinkedIn: https://www.linkedin.com/company/stemmusic/",
      "Press: press@stem.is",
    ],
    apiDocs: null,
    whiteLabelOffering: "Stem for Business: white-label distribution with automated split payments, transparent royalty tracking, real-time revenue dashboards. Web3-ready infrastructure.",
    b2bPath: "Email info@stem.is → business development call → integration plan → launch",
    fitNotes: "Revenue splitting built-in (solves Boostify's missing contributor splits). Transparent accounting, automated payouts. Web3/blockchain bridge aligns with BTF token vision.",
    priorityScore: 10,
    revSharePercent: "0",
    setupFee: "0",
    monthlyFee: "0",
    territories: 150,
    features: ["Automated revenue splitting", "Transparent accounting", "Web3 bridge", "Real-time analytics", "Automated payouts", "Label dashboard"],
  },
  {
    name: "Label Engine (Create Music Group)",
    slug: "label-engine",
    type: "white_label",
    tier: "tier1",
    website: "https://label-engine.com",
    contactEmail: "info@label-engine.com",
    contactRoutes: [
      "Contact form: https://label-engine.com/contact_us.php",
      "LinkedIn: https://www.linkedin.com/company/label-engine/",
      "Parent: Create Music Group — https://createmusicgroup.com",
    ],
    apiDocs: null,
    whiteLabelOffering: "Full label management platform: distribution to 100+ DSPs, royalty processing, promo tools, demo management. 26M+ tracks delivered, 1B+ royalties processed.",
    b2bPath: "Register at label-engine.com → contact sales → custom enterprise plan for distributors",
    fitNotes: "Proven at scale: Insomniac Music Group, Disciple, Kannibalen. Royalty processing + promo system + DJ pool delivery (Beatport). Ideal for Boostify's electronic/urban audience.",
    priorityScore: 8,
    revSharePercent: "0",
    setupFee: "3000",
    monthlyFee: "3000",
    territories: 120,
    features: ["Enterprise label tools", "Custom branding", "Promo system", "DJ pools", "Beatport integration", "Royalty processing", "Demo management"],
  },
  {
    name: "iMusician",
    slug: "imusician",
    type: "white_label",
    tier: "tier2",
    website: "https://imusician.pro",
    contactEmail: "support@imusician.pro",
    contactRoutes: [
      "Label program: https://imusician.pro/en/labels",
      "LinkedIn: https://www.linkedin.com/company/imusiciandigital/",
      "Based in Berlin, Germany (EU data compliance)",
    ],
    apiDocs: null,
    whiteLabelOffering: "iMusician for Labels/Distributors: flat-fee model, 100% royalties to artist, branded label portal. Apple Music preferred distributor status.",
    b2bPath: "Apply via imusician.pro/labels → fast-track review for distributors with existing catalog",
    fitNotes: "EU-based (GDPR compliant), flat-fee pricing, Apple Music preferred status. Good for European expansion.",
    priorityScore: 6,
    revSharePercent: "0",
    setupFee: "0",
    monthlyFee: "0",
    territories: 150,
    features: ["Flat-fee model", "Distributor program", "EU-based (GDPR)", "Label dashboard", "Apple preferred", "100% royalties"],
  },
  {
    name: "Ditto Music",
    slug: "ditto",
    type: "white_label",
    tier: "tier2",
    website: "https://dittomusic.com",
    contactEmail: "info@dittomusic.com",
    contactRoutes: [
      "Label services: https://dittomusic.com/en/label-services",
      "Contact: https://dittomusic.com/en/contact",
      "LinkedIn: https://www.linkedin.com/company/ditto-music/",
    ],
    apiDocs: null,
    whiteLabelOffering: "Ditto for Labels: white-label distribution, record label services, social media delivery. Multiple pricing tiers for different label sizes.",
    b2bPath: "Contact via dittomusic.com/contact → label assessment → custom white-label setup",
    fitNotes: "White-label available, social media tools, UK-based. Record label services include press releases and playlist pitching.",
    priorityScore: 6,
    revSharePercent: "0",
    setupFee: "0",
    monthlyFee: "0",
    territories: 150,
    features: ["White-label available", "Record label services", "Social media tools", "Analytics", "Global reach", "Playlist pitching"],
  },
  {
    name: "AWAL (Sony Music / Kobalt)",
    slug: "awal",
    type: "api",
    tier: "tier2",
    website: "https://awal.com",
    contactEmail: "info@awal.com",
    contactRoutes: [
      "Apply: https://awal.com/apply",
      "LinkedIn: https://www.linkedin.com/company/awal-digital-ltd/",
      "Note: AWAL is now part of Sony Music Group",
    ],
    apiDocs: null,
    whiteLabelOffering: "No white-label. AWAL operates as a distribution partner taking 15% rev share. Selective admission — curated artist roster only.",
    b2bPath: "Apply at awal.com/apply → A&R review → acceptance → 15% rev share deal",
    fitNotes: "Premium selective distribution with Sony backing. Marketing team, playlist pitching, brand partnerships. Good for Boostify's top-tier artists only.",
    priorityScore: 5,
    revSharePercent: "15",
    setupFee: "0",
    monthlyFee: "0",
    territories: 200,
    features: ["15% rev share", "Sony Music backing", "Marketing team", "Data analytics", "Playlist pitching", "Brand partnerships", "Curated roster"],
  },
  {
    name: "Horus Music",
    slug: "horus",
    type: "white_label",
    tier: "tier2",
    website: "https://horusmusic.global",
    contactEmail: "info@horusmusic.global",
    contactRoutes: [
      "White-label program: https://horusmusic.global/white-label",
      "LinkedIn: https://www.linkedin.com/company/horus-music/",
      "Contact: https://horusmusic.global/contact",
    ],
    apiDocs: null,
    whiteLabelOffering: "Horus White Label: fully branded distribution platform for distributors and label groups. 100% royalties passthrough. YouTube monetization included.",
    b2bPath: "Apply via horusmusic.global/white-label → onboarding call → platform setup → go live",
    fitNotes: "Explicit white-label program. 100% royalties, YouTube monetization, global network. UK-based with good emerging market coverage.",
    priorityScore: 7,
    revSharePercent: "0",
    setupFee: "0",
    monthlyFee: "0",
    territories: 150,
    features: ["White-label program", "Label services", "100% royalties", "YouTube monetization", "Global network", "Branded platform"],
  },
  {
    name: "DistroKid",
    slug: "distrokid",
    type: "affiliate",
    tier: "tier3",
    website: "https://distrokid.com",
    contactEmail: "support@distrokid.com",
    contactRoutes: [
      "Affiliate program: https://distrokid.com/affiliate",
      "LinkedIn: https://www.linkedin.com/company/distrokid/",
      "Note: No white-label or API program; affiliate referral model only",
    ],
    apiDocs: null,
    whiteLabelOffering: "No white-label. Affiliate referral program only (earn per signup). Artists manage their own DistroKid accounts.",
    b2bPath: "Affiliate signup at distrokid.com/affiliate → referral link → earn per artist signup",
    fitNotes: "Fastest delivery, unlimited uploads, Hyperfollow. No API access — only useful as affiliate fallback. Not suitable as primary distribution backend.",
    priorityScore: 3,
    revSharePercent: "0",
    setupFee: "0",
    monthlyFee: "0",
    territories: 150,
    features: ["Fastest delivery", "Unlimited uploads", "Hyperfollow", "Spotify integration", "Affiliate program"],
  },
  {
    name: "TuneCore (Believe)",
    slug: "tunecore",
    type: "affiliate",
    tier: "tier3",
    website: "https://www.tunecore.com",
    contactEmail: "support@tunecore.com",
    contactRoutes: [
      "Partnership: https://www.tunecore.com/about/contact",
      "LinkedIn: https://www.linkedin.com/company/tunecore/",
      "Note: Owned by Believe — consider Believe's B2B program instead",
    ],
    apiDocs: null,
    whiteLabelOffering: "No white-label for external platforms. TuneCore is Believe's self-serve brand. Distributors should inquire through Believe's enterprise path instead.",
    b2bPath: "For B2B, contact parent company Believe at contact@believe.com instead of TuneCore directly",
    fitNotes: "Publishing admin, YouTube monetization, sync licensing. Owned by Believe — approach Believe for B2B. TuneCore is self-serve only.",
    priorityScore: 3,
    revSharePercent: "0",
    setupFee: "0",
    monthlyFee: "0",
    territories: 150,
    features: ["Publishing admin", "YouTube monetization", "Social delivery", "Sync licensing", "Believe-owned"],
  },
];

/** Default DSP platforms */
const DEFAULT_DSPS = [
  { name: "Spotify", slug: "spotify", category: "streaming" as const, payPerStream: "0.003500", territories: 184 },
  { name: "Apple Music", slug: "apple-music", category: "streaming" as const, payPerStream: "0.007000", territories: 175 },
  { name: "YouTube Music", slug: "youtube-music", category: "streaming" as const, payPerStream: "0.002000", territories: 100 },
  { name: "Amazon Music", slug: "amazon-music", category: "streaming" as const, payPerStream: "0.004000", territories: 50 },
  { name: "Tidal", slug: "tidal", category: "streaming" as const, payPerStream: "0.012500", territories: 61 },
  { name: "Deezer", slug: "deezer", category: "streaming" as const, payPerStream: "0.003500", territories: 180 },
  { name: "Pandora", slug: "pandora", category: "streaming" as const, payPerStream: "0.001300", territories: 1 },
  { name: "SoundCloud", slug: "soundcloud", category: "streaming" as const, payPerStream: "0.003000", territories: 190 },
  { name: "TikTok", slug: "tiktok", category: "social" as const, payPerStream: "0.000300", territories: 150 },
  { name: "Instagram/Facebook", slug: "instagram-facebook", category: "social" as const, payPerStream: "0.000100", territories: 200 },
  { name: "Shazam", slug: "shazam", category: "other" as const, payPerStream: "0", territories: 200 },
  { name: "iTunes Store", slug: "itunes", category: "download" as const, payPerStream: "0.700000", territories: 175 },
  { name: "Beatport", slug: "beatport", category: "download" as const, payPerStream: "0", territories: 50 },
  { name: "Triller", slug: "triller", category: "social" as const, payPerStream: "0.000200", territories: 50 },
  { name: "Audiomack", slug: "audiomack", category: "streaming" as const, payPerStream: "0.001200", territories: 30 },
];

export async function seedDistributionPartners(): Promise<{ partners: number; dsps: number }> {
  let partnersSeeded = 0;
  let dspsSeeded = 0;

  for (const partner of RESEARCHED_PARTNERS) {
    const existing = await db.select().from(distributionPartners)
      .where(eq(distributionPartners.slug, partner.slug)).limit(1);
    if (existing.length === 0) {
      await db.insert(distributionPartners).values({
        name: partner.name,
        slug: partner.slug,
        type: partner.type,
        tier: partner.tier,
        website: partner.website,
        contactEmail: partner.contactEmail,
        revSharePercent: partner.revSharePercent,
        setupFee: partner.setupFee,
        monthlyFee: partner.monthlyFee,
        territories: partner.territories,
        features: partner.features,
        notes: `Priority: ${partner.priorityScore}/10\nB2B Path: ${partner.b2bPath}\nWhite-Label: ${partner.whiteLabelOffering}\nFit: ${partner.fitNotes}\nContacts: ${partner.contactRoutes.join(" | ")}\nAPI Docs: ${partner.apiDocs || "Not public"}`,
      });
      partnersSeeded++;
    } else {
      // Update existing partner with enriched data
      await db.update(distributionPartners).set({
        contactEmail: partner.contactEmail,
        website: partner.website,
        features: partner.features,
        notes: `Priority: ${partner.priorityScore}/10\nB2B Path: ${partner.b2bPath}\nWhite-Label: ${partner.whiteLabelOffering}\nFit: ${partner.fitNotes}\nContacts: ${partner.contactRoutes.join(" | ")}\nAPI Docs: ${partner.apiDocs || "Not public"}`,
        updatedAt: new Date(),
      }).where(eq(distributionPartners.slug, partner.slug));
    }
  }

  for (const dsp of DEFAULT_DSPS) {
    const existing = await db.select().from(dspPlatforms)
      .where(eq(dspPlatforms.slug, dsp.slug)).limit(1);
    if (existing.length === 0) {
      await db.insert(dspPlatforms).values(dsp);
      dspsSeeded++;
    }
  }

  return { partners: partnersSeeded, dsps: dspsSeeded };
}

export async function getPartners() {
  return db.select().from(distributionPartners).orderBy(distributionPartners.tier, distributionPartners.name);
}

export async function getPartnerById(id: number) {
  const results = await db.select().from(distributionPartners).where(eq(distributionPartners.id, id)).limit(1);
  return results[0] || null;
}

export async function updatePartner(id: number, data: Partial<InsertDistributionPartner>) {
  return db.update(distributionPartners).set({ ...data, updatedAt: new Date() }).where(eq(distributionPartners.id, id)).returning();
}

export async function getDSPs() {
  return db.select().from(dspPlatforms).where(eq(dspPlatforms.isActive, true)).orderBy(dspPlatforms.name);
}

// ============================================================================
// 2. RELEASE BUILDER
// ============================================================================

export async function createRelease(data: InsertRelease) {
  if (!data.upc) {
    data.upc = generateUPC();
  }
  const [release] = await db.insert(releases).values(data).returning();
  return release;
}

export async function getUserReleases(userId: number) {
  return db.select().from(releases)
    .where(eq(releases.userId, userId))
    .orderBy(desc(releases.createdAt));
}

export async function getReleaseById(id: number) {
  const results = await db.select().from(releases).where(eq(releases.id, id)).limit(1);
  return results[0] || null;
}

export async function updateRelease(id: number, data: Partial<InsertRelease>) {
  return db.update(releases).set({ ...data, updatedAt: new Date() }).where(eq(releases.id, id)).returning();
}

export async function deleteRelease(id: number) {
  return db.delete(releases).where(eq(releases.id, id));
}

export async function addTrackToRelease(data: InsertReleaseTrack) {
  if (!data.isrc) {
    data.isrc = generateISRC();
  }
  const [track] = await db.insert(releaseTracks).values(data).returning();
  return track;
}

export async function getReleaseTracks(releaseId: number) {
  return db.select().from(releaseTracks)
    .where(eq(releaseTracks.releaseId, releaseId))
    .orderBy(releaseTracks.trackNumber);
}

export async function removeTrackFromRelease(trackId: number) {
  return db.delete(releaseTracks).where(eq(releaseTracks.id, trackId));
}

export async function submitRelease(releaseId: number): Promise<{ success: boolean; message: string }> {
  const release = await getReleaseById(releaseId);
  if (!release) return { success: false, message: "Release not found" };
  if (release.status !== "draft" && release.status !== "metadata_complete") {
    return { success: false, message: `Release cannot be submitted in status: ${release.status}` };
  }

  const tracks = await getReleaseTracks(releaseId);
  if (tracks.length === 0) {
    return { success: false, message: "Release must have at least one track" };
  }

  if (!release.coverArtUrl) {
    return { success: false, message: "Release must have cover artwork" };
  }

  // Move to review status
  await updateRelease(releaseId, { status: "review", submittedAt: new Date() });

  // Create submissions for major DSPs 
  const dsps = await getDSPs();
  for (const dsp of dsps) {
    await db.insert(distributionSubmissions).values({
      releaseId,
      dspId: dsp.id,
      dspName: dsp.name,
      status: "queued",
    });
  }

  return { success: true, message: `Release submitted for review. ${dsps.length} DSP submissions queued.` };
}

// ============================================================================
// 3. DELIVERY ENGINE
// ============================================================================

export async function getReleaseSubmissions(releaseId: number) {
  return db.select().from(distributionSubmissions)
    .where(eq(distributionSubmissions.releaseId, releaseId))
    .orderBy(distributionSubmissions.dspName);
}

export async function updateSubmissionStatus(submissionId: number, status: string, details?: { externalUrl?: string; rejectionReason?: string }) {
  const update: any = { status, updatedAt: new Date() };
  if (status === "live") update.liveAt = new Date();
  if (status === "rejected") {
    update.rejectedAt = new Date();
    update.rejectionReason = details?.rejectionReason;
  }
  if (details?.externalUrl) update.externalUrl = details.externalUrl;

  return db.update(distributionSubmissions).set(update).where(eq(distributionSubmissions.id, submissionId)).returning();
}

export async function approveRelease(releaseId: number): Promise<{ success: boolean }> {
  await updateRelease(releaseId, { status: "delivering", approvedAt: new Date() });

  // Move all queued submissions to delivering
  await db.update(distributionSubmissions)
    .set({ status: "delivering", deliveredAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(distributionSubmissions.releaseId, releaseId),
      eq(distributionSubmissions.status, "queued")
    ));

  return { success: true };
}

// ============================================================================
// 4. ROYALTY ENGINE
// ============================================================================

export async function getUserRoyalties(userId: number) {
  return db.select().from(royaltyTransactions)
    .where(eq(royaltyTransactions.userId, userId))
    .orderBy(desc(royaltyTransactions.createdAt));
}

export async function getUserRoyaltySummary(userId: number) {
  const result = await db.select({
    totalStreams: sum(royaltyTransactions.streams),
    totalDownloads: sum(royaltyTransactions.downloads),
    totalGrossRevenue: sum(royaltyTransactions.grossRevenue),
    totalNetRevenue: sum(royaltyTransactions.netRevenue),
    totalPlatformFee: sum(royaltyTransactions.platformFee),
    transactionCount: count(),
  }).from(royaltyTransactions)
    .where(eq(royaltyTransactions.userId, userId));

  return result[0] || {
    totalStreams: 0, totalDownloads: 0,
    totalGrossRevenue: "0", totalNetRevenue: "0",
    totalPlatformFee: "0", transactionCount: 0,
  };
}

export async function addRoyaltyTransaction(data: InsertRoyaltyTransaction) {
  const [tx] = await db.insert(royaltyTransactions).values(data).returning();
  return tx;
}

// ============================================================================
// 5. MODULE AUDIT
// ============================================================================

export type ModuleStatus = "EXISTS_CONNECTED" | "EXISTS_NOT_CONNECTED" | "PARTIAL" | "MISSING_CREATE_NOW" | "PLANNED";

export interface DistributionModuleAudit {
  module: string;
  status: ModuleStatus;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
}

export async function getModuleAudit(): Promise<DistributionModuleAudit[]> {
  const partnerCount = (await db.select({ count: count() }).from(distributionPartners))[0]?.count ?? 0;
  const dspCount = (await db.select({ count: count() }).from(dspPlatforms))[0]?.count ?? 0;

  return [
    // ── CORE DISTRIBUTION ──
    {
      module: "1. Artist Onboarding",
      status: "EXISTS_NOT_CONNECTED",
      description: "Artist setup wizard exists (/artist-setup). Needs step-by-step profile flow feeding into Distribution.",
      priority: "high",
    },
    {
      module: "2. Label Onboarding",
      status: "PARTIAL",
      description: "Virtual Record Label page exists. No dedicated multi-artist label dashboard or label entity.",
      priority: "medium",
    },
    {
      module: "3. Catalog Manager",
      status: "EXISTS_CONNECTED",
      description: "My Songs tab lists all artist songs with metadata, ISRC, plays. Needs bulk ops & search/filter.",
      priority: "high",
    },
    {
      module: "4. Release Builder",
      status: "EXISTS_CONNECTED",
      description: "Create singles/EPs/albums, assign tracks, auto-generate ISRC/UPC. Full draft→live workflow.",
      priority: "critical",
    },
    {
      module: "5. Track Metadata Manager",
      status: "PARTIAL",
      description: "Basic fields (title, genre, mood, duration, ISRC). Missing: language, ISWC, production credits, compliance validation.",
      priority: "high",
    },
    {
      module: "6. Artwork Upload & Validation",
      status: "PARTIAL",
      description: "Cover art URL stored on releases. No dimension validation (3000×3000), format check, or DSP compliance.",
      priority: "medium",
    },
    {
      module: "7. Audio Upload & Validation",
      status: "PARTIAL",
      description: "Audio upload + AI generation via Suno. No bitrate/sample rate/loudness/clipping compliance checks.",
      priority: "medium",
    },
    {
      module: "8. ISRC Manager",
      status: "EXISTS_CONNECTED",
      description: "Auto-generates US-BFY-YY-NNNNN ISRCs. Placeholder codes — needs IFPI registration for real codes.",
      priority: "high",
    },
    {
      module: "9. UPC/EAN Manager",
      status: "EXISTS_CONNECTED",
      description: "Auto-generates 12-digit UPCs. Placeholder codes — needs GS1 registration for real barcodes.",
      priority: "high",
    },
    {
      module: "10. Contributor Splits Manager",
      status: "MISSING_CREATE_NOW",
      description: "No revenue split tracking between collaborators. Critical for multi-artist releases and royalty payouts.",
      priority: "critical",
    },
    {
      module: "11. Rights Ownership Manager",
      status: "PARTIAL",
      description: "PRO reference card (ASCAP/BMI) + blockchain copyright certification. No ownership % or mechanical rights.",
      priority: "high",
    },
    {
      module: "12. Distribution Partner Manager",
      status: partnerCount > 0 ? "EXISTS_CONNECTED" : "MISSING_CREATE_NOW",
      description: `${partnerCount} partners registered. 11 white-label partners (FUGA, Believe, Symphonic, etc.) with outreach engine.`,
      priority: "critical",
    },
    {
      module: "13. Delivery Status Tracker",
      status: "EXISTS_CONNECTED",
      description: "Per-DSP submission status tracking (queued→delivering→live). Simulated — needs real API integration.",
      priority: "critical",
    },
    {
      module: "14. DSP Targeting Manager",
      status: dspCount > 0 ? "EXISTS_CONNECTED" : "MISSING_CREATE_NOW",
      description: `${dspCount} DSPs registered. Missing per-release DSP selection (currently all-or-nothing).`,
      priority: "high",
    },
    {
      module: "15. Takedown / Update Manager",
      status: "PARTIAL",
      description: "Takedown status exists in enums. No dedicated UI, no request flow, no reason tracking, no per-DSP takedown.",
      priority: "medium",
    },
    {
      module: "16. Royalty Dashboard",
      status: "EXISTS_CONNECTED",
      description: "Royalties tab with per-DSP earnings, summary. Schema complete — no live data yet (needs DSP API).",
      priority: "high",
    },
    {
      module: "17. Analytics Dashboard",
      status: "EXISTS_NOT_CONNECTED",
      description: "Full analytics page (/analytics) with charts, period selection, PDF export. Separate from Distribution hub.",
      priority: "medium",
    },
    // ── CONTENT & RIGHTS ──
    {
      module: "18. Publishing Module",
      status: "MISSING_CREATE_NOW",
      description: "No publishing rights management, songwriter registration, publisher entity, or mechanical royalty tracking.",
      priority: "high",
    },
    {
      module: "19. YouTube / Content ID",
      status: "PARTIAL",
      description: "YouTube growth tools exist (SEO, keywords). No Content ID ingestion, fingerprinting, or claim management.",
      priority: "high",
    },
    {
      module: "20. Video Distribution",
      status: "MISSING_CREATE_NOW",
      description: "Video creation tools (Kling, MiniMax, Shotstack). No video delivery to YouTube/Vevo/Apple Music Video.",
      priority: "medium",
    },
    // ── MARKETING & LAUNCH ──
    {
      module: "21. Smart Links / Pre-Save",
      status: "MISSING_CREATE_NOW",
      description: "No smart link generator, pre-save campaigns, or link-in-bio for releases. Only mentioned as advice.",
      priority: "high",
    },
    {
      module: "22. Marketing Launch Engine",
      status: "PARTIAL",
      description: "Email campaigns + social media generator exist. No release-specific launch workflow or playlist pitch automation.",
      priority: "medium",
    },
    {
      module: "23. Merch Module",
      status: "EXISTS_NOT_CONNECTED",
      description: "Full Printful integration with store, analytics, contracts. Not linked from Distribution hub.",
      priority: "low",
    },
    // ── ARTIST & MANAGEMENT ──
    {
      module: "24. Artist Identity / Branding",
      status: "EXISTS_NOT_CONNECTED",
      description: "Profile editing, AI image advisor, EPK generation, image galleries. No unified brand kit.",
      priority: "low",
    },
    {
      module: "25. Contract / Legal Documents",
      status: "EXISTS_NOT_CONNECTED",
      description: "Full AI contract system (Gemini), templates, analysis, PDF export. Not linked from Distribution.",
      priority: "medium",
    },
    {
      module: "26. CRM / Contact Management",
      status: "EXISTS_NOT_CONNECTED",
      description: "Comprehensive CRM with 2600+ contacts, search/filter. Not linked from Distribution hub.",
      priority: "low",
    },
    {
      module: "27. Outreach / Communications",
      status: "EXISTS_CONNECTED",
      description: "Multi-channel outreach: templates, campaigns, email logging, Brevo. Partner outreach integrated.",
      priority: "medium",
    },
    {
      module: "28. Internal Tasks / Workflow",
      status: "EXISTS_NOT_CONNECTED",
      description: "Manager tasks (CRUD, status, priority). No cross-module workflow engine or automated task creation.",
      priority: "low",
    },
    {
      module: "29. Admin Approvals / QA Queue",
      status: "PARTIAL",
      description: "Release review→approved flow exists. AAS approval queue exists. No dedicated admin QA review UI.",
      priority: "high",
    },
  ];
}

// ============================================================================
// 6. OUTREACH ENGINE — Multi-format professional communications
// ============================================================================

export interface OutreachPackage {
  partnerId: number;
  partnerName: string;
  partnerSlug: string;
  emailSubject: string;
  shortOutreach: string;         // 3-4 sentence elevator pitch
  fullPartnershipEmail: string;  // Full HTML email
  followUpEmail: string;         // Follow-up HTML email
  linkedInMessage: string;       // LinkedIn connection message
  contactFormMessage: string;    // For web contact forms
  internalStatusLabel: string;   // Internal tracking label
}

/**
 * Generate complete outreach package with all 7 message formats
 */
export function generateOutreachPackage(partnerName: string, partnerSlug: string): OutreachPackage {
  const year = new Date().getFullYear();
  const profile = RESEARCHED_PARTNERS.find(p => p.slug === partnerSlug);

  // 1. EMAIL SUBJECT
  const emailSubject = `Distribution Partnership Inquiry — Boostify Music × ${partnerName}`;

  // 2. SHORT OUTREACH (3-4 sentences — for cold intro or brief messages)
  const shortOutreach = `Hi ${partnerName} team — I'm writing from Boostify Music, a full-stack artist platform with AI-powered music creation, video production, merchandising, and marketing tools. We're building our distribution layer and believe ${partnerName}'s ${profile?.type === 'white_label' ? 'white-label infrastructure' : 'distribution capabilities'} would be an ideal backend for our growing artist base. We'd love to explore a partnership that lets our artists distribute through ${partnerName} directly within Boostify. Could we schedule a brief introductory call this week? — Boostify Music Team (info@boostifymusic.com)`;

  // 3. FULL PARTNERSHIP EMAIL (HTML)
  const fullPartnershipEmail = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);padding:12px 32px;border-radius:12px;">
      <span style="color:#fff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">BOOSTIFY</span>
      <span style="color:rgba(255,255,255,0.7);font-size:12px;display:block;">Music Distribution Platform</span>
    </div>
  </div>
  <div style="background:linear-gradient(145deg,#1a1a2e,#16213e);border-radius:16px;padding:40px;border:1px solid rgba(249,115,22,0.2);">
    <h1 style="color:#fff;font-size:22px;margin:0 0 20px;">Distribution Partnership Proposal</h1>
    <p style="color:#fdba74;font-size:15px;line-height:1.7;margin:0 0 16px;">Dear ${partnerName} Partnerships Team,</p>
    <p style="color:#fed7aa;font-size:14px;line-height:1.7;margin:0 0 16px;">I'm reaching out from <strong style="color:#fff;">Boostify Music</strong>, a rapidly growing full-stack platform for independent artists. We're building a distribution layer and are evaluating partners to power our backend delivery infrastructure.</p>
    <p style="color:#fed7aa;font-size:14px;line-height:1.7;margin:0 0 16px;">Boostify is not a typical distributor inquiry — we operate an <strong style="color:#fb923c;">end-to-end artist operations platform</strong> that includes:</p>
    <div style="background:rgba(249,115,22,0.1);border-radius:12px;padding:20px;margin:24px 0;border:1px solid rgba(249,115,22,0.15);">
      <h3 style="color:#fb923c;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">Boostify Platform Capabilities</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:#e2e8f0;font-size:13px;">✦ AI-Powered Music & Video Creation</td><td style="padding:6px 0;color:#e2e8f0;font-size:13px;">✦ Autonomous Artist Agent System</td></tr>
        <tr><td style="padding:6px 0;color:#e2e8f0;font-size:13px;">✦ Smart Merch Store (Printful)</td><td style="padding:6px 0;color:#e2e8f0;font-size:13px;">✦ Copyright Registry (Blockchain)</td></tr>
        <tr><td style="padding:6px 0;color:#e2e8f0;font-size:13px;">✦ Spotify/IG/YT Growth Tools</td><td style="padding:6px 0;color:#e2e8f0;font-size:13px;">✦ AI Contract Generation</td></tr>
        <tr><td style="padding:6px 0;color:#e2e8f0;font-size:13px;">✦ Marketing Launch Engine</td><td style="padding:6px 0;color:#e2e8f0;font-size:13px;">✦ CRM & Industry Outreach</td></tr>
        <tr><td style="padding:6px 0;color:#e2e8f0;font-size:13px;">✦ Real-Time Analytics Dashboard</td><td style="padding:6px 0;color:#e2e8f0;font-size:13px;">✦ Revenue Splits & Royalties</td></tr>
      </table>
    </div>
    <p style="color:#fed7aa;font-size:14px;line-height:1.7;margin:0 0 16px;">We're looking for a partner who can provide:</p>
    <ul style="color:#e2e8f0;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px;">
      <li><strong style="color:#fb923c;">API-Based Delivery</strong> — automated release submission to 150+ DSPs</li>
      <li><strong style="color:#fb923c;">White-Label Integration</strong> — seamless embedding within our platform</li>
      <li><strong style="color:#fb923c;">Real-Time Analytics</strong> — streaming data from all major platforms</li>
      <li><strong style="color:#fb923c;">Royalty Infrastructure</strong> — collection, splits, and transparent reporting</li>
      <li><strong style="color:#fb923c;">Rights Management</strong> — publishing, Content ID, neighboring rights</li>
      <li><strong style="color:#fb923c;">Video Distribution</strong> — music video delivery to YouTube/Vevo</li>
    </ul>
    <p style="color:#fed7aa;font-size:14px;line-height:1.7;margin:0 0 16px;">What makes Boostify unique as a distribution partner:</p>
    <ul style="color:#e2e8f0;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px;">
      <li><strong style="color:#fb923c;">Artist Growth Pipeline</strong> — we don't just distribute, we grow artists (AI marketing, social tools, playlist pitching)</li>
      <li><strong style="color:#fb923c;">AI Content Creation</strong> — artists create music, videos, and merch all in-platform, increasing catalog volume</li>
      <li><strong style="color:#fb923c;">Full Monetization Stack</strong> — merch, sync, NFTs, sponsorships alongside streaming revenue</li>
      <li><strong style="color:#fb923c;">Scalable Onboarding</strong> — autonomous agent system onboards artists 24/7</li>
    </ul>
    <p style="color:#fed7aa;font-size:14px;line-height:1.7;margin:0 0 24px;">We'd love to schedule a brief call to discuss how ${partnerName}'s infrastructure could integrate with Boostify's ecosystem. We're ready to move quickly on the right partnership.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="https://boostifymusic.com" style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">Visit Boostify Platform →</a>
    </div>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">Best regards,<br/><strong style="color:#e2e8f0;">Boostify Music Team</strong><br/><a href="mailto:info@boostifymusic.com" style="color:#fb923c;">info@boostifymusic.com</a> · <a href="https://boostifymusic.com" style="color:#fb923c;">boostifymusic.com</a></p>
  </div>
  <div style="text-align:center;margin-top:24px;"><p style="color:#475569;font-size:11px;">© ${year} Boostify Music. All Rights Reserved.</p></div>
</div></body></html>`;

  // 4. FOLLOW-UP EMAIL (HTML)
  const followUpEmail = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);padding:12px 32px;border-radius:12px;">
      <span style="color:#fff;font-size:24px;font-weight:700;">BOOSTIFY</span>
      <span style="color:rgba(255,255,255,0.7);font-size:12px;display:block;">Music Distribution Platform</span>
    </div>
  </div>
  <div style="background:linear-gradient(145deg,#1a1a2e,#16213e);border-radius:16px;padding:40px;border:1px solid rgba(249,115,22,0.2);">
    <h1 style="color:#fff;font-size:20px;margin:0 0 20px;">Following Up — Boostify × ${partnerName}</h1>
    <p style="color:#fdba74;font-size:15px;line-height:1.7;margin:0 0 16px;">Hi ${partnerName} team,</p>
    <p style="color:#fed7aa;font-size:14px;line-height:1.7;margin:0 0 16px;">I wanted to follow up on my previous message regarding a distribution partnership between <strong style="color:#fff;">Boostify Music</strong> and ${partnerName}.</p>
    <p style="color:#fed7aa;font-size:14px;line-height:1.7;margin:0 0 16px;">Since my last email, we've continued building out our platform. Here's what's new:</p>
    <ul style="color:#e2e8f0;font-size:14px;line-height:2;padding-left:20px;margin:0 0 24px;">
      <li>Expanded our artist base with AI-powered onboarding</li>
      <li>Launched autonomous artist agents that create content 24/7</li>
      <li>Built a full release management system with ISRC/UPC auto-generation</li>
      <li>Integrated marketing launch sequences for every release</li>
    </ul>
    <p style="color:#fed7aa;font-size:14px;line-height:1.7;margin:0 0 16px;">We're actively choosing our primary distribution partner and would love to include ${partnerName} in our evaluation. Even a 15-minute introductory call would help us understand if there's mutual fit.</p>
    <p style="color:#fed7aa;font-size:14px;line-height:1.7;margin:0 0 24px;">Would any time this week or next work for a quick call?</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="https://boostifymusic.com" style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;padding:14px 40px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">See Boostify in Action →</a>
    </div>
    <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:0;">Best,<br/><strong style="color:#e2e8f0;">Boostify Music Team</strong><br/><a href="mailto:info@boostifymusic.com" style="color:#fb923c;">info@boostifymusic.com</a></p>
  </div>
</div></body></html>`;

  // 5. LINKEDIN MESSAGE (max ~300 chars for connection request)
  const linkedInMessage = `Hi! I'm from Boostify Music — a full-stack artist platform (AI music/video creation, merch, marketing, copyright). We're building our distribution layer and exploring a partnership with ${partnerName}. Would love to connect and discuss how we might work together. — Boostify Team`;

  // 6. CONTACT FORM MESSAGE (plain text for web forms)
  const contactFormMessage = `Subject: Distribution Partnership Inquiry — Boostify Music

Hello ${partnerName} team,

I'm reaching out from Boostify Music (https://boostifymusic.com), a full-stack artist operations platform. We're building a distribution layer and are evaluating ${profile?.type === 'white_label' ? 'white-label distribution' : 'distribution'} partners.

Our platform offers artists:
- AI-powered music and video creation
- Autonomous artist agent system
- Smart merch store (Printful integration)
- Blockchain copyright registry
- Marketing launch engine
- Spotify/YouTube/Instagram growth tools
- Revenue splits and royalty tracking

We're looking for a partner that provides API-based delivery, real-time analytics, royalty infrastructure, and ideally white-label capabilities. ${partnerName}'s offering aligns well with our needs.

Could we schedule a brief introductory call to discuss partnership possibilities?

Best regards,
Boostify Music Team
info@boostifymusic.com
https://boostifymusic.com`;

  // 7. INTERNAL STATUS LABEL
  const internalStatusLabel = `OUTREACH_READY | ${partnerName} | Priority: ${profile?.priorityScore || '?'}/10 | Type: ${profile?.type || 'unknown'} | Tier: ${profile?.tier || 'unknown'}`;

  return {
    partnerId: 0, // will be set when called with actual partner
    partnerName,
    partnerSlug,
    emailSubject,
    shortOutreach,
    fullPartnershipEmail,
    followUpEmail,
    linkedInMessage,
    contactFormMessage,
    internalStatusLabel,
  };
}

// Keep the legacy function name for backward compat
export function generatePartnershipEmail(partnerName: string, partnerSlug: string): { subject: string; html: string } {
  const pkg = generateOutreachPackage(partnerName, partnerSlug);
  return { subject: pkg.emailSubject, html: pkg.fullPartnershipEmail };
}

/**
 * Send initial partnership email via Brevo
 */
export async function sendPartnerOutreach(partnerId: number, messageType: "full" | "follow_up" = "full"): Promise<{ success: boolean; message: string }> {
  const partner = await getPartnerById(partnerId);
  if (!partner) return { success: false, message: "Partner not found" };
  if (!partner.contactEmail) return { success: false, message: "No contact email for this partner" };

  const pkg = generateOutreachPackage(partner.name, partner.slug);
  const subject = messageType === "follow_up" ? `Follow-Up: ${pkg.emailSubject}` : pkg.emailSubject;
  const html = messageType === "follow_up" ? pkg.followUpEmail : pkg.fullPartnershipEmail;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY || "",
      },
      body: JSON.stringify({
        sender: { name: "Boostify Music", email: "info@boostifymusic.com" },
        to: [{ email: partner.contactEmail, name: partner.name }],
        subject,
        htmlContent: html,
      }),
    });

    if (response.ok) {
      const newStatus = partner.outreachStatus === "email_sent" ? "email_sent" : "email_sent";
      await updatePartner(partnerId, {
        outreachStatus: newStatus,
        lastContactedAt: new Date(),
        notes: (partner.notes || "") + `\n[${new Date().toISOString()}] ${messageType === "follow_up" ? "Follow-up" : "Initial"} email sent to ${partner.contactEmail}`,
      });
      return { success: true, message: `${messageType === "follow_up" ? "Follow-up" : "Partnership"} email sent to ${partner.contactEmail}` };
    } else {
      const err = await response.text();
      return { success: false, message: `Email API error: ${err}` };
    }
  } catch (error: any) {
    return { success: false, message: `Failed to send: ${error.message}` };
  }
}

/**
 * Get full outreach package for a partner (all 7 formats)
 */
export async function getPartnerOutreachPackage(partnerId: number): Promise<OutreachPackage | null> {
  const partner = await getPartnerById(partnerId);
  if (!partner) return null;
  const pkg = generateOutreachPackage(partner.name, partner.slug);
  pkg.partnerId = partner.id;
  return pkg;
}

/**
 * Get all partner profiles with enriched research data
 */
export function getResearchedPartnerProfiles(): PartnerProfile[] {
  return RESEARCHED_PARTNERS;
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export async function getDistributionDashboard(userId: number) {
  const userReleases = await getUserReleases(userId);
  const royaltySummary = await getUserRoyaltySummary(userId);
  const partners = await getPartners();
  const dsps = await getDSPs();
  const audit = await getModuleAudit();
  const userSongs = await getUserSongs(userId);

  // Get all song IDs already in releases
  const allTracks = [];
  for (const r of userReleases) {
    const t = await getReleaseTracks(r.id);
    allTracks.push(...t);
  }
  const trackSongIds = new Set(allTracks.map(t => t.songId));

  // Count releases by status
  const statusCounts: Record<string, number> = {};
  for (const r of userReleases) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  return {
    releases: {
      total: userReleases.length,
      byStatus: statusCounts,
      recent: userReleases.slice(0, 5),
    },
    royalties: royaltySummary,
    partners: {
      total: partners.length,
      active: partners.filter(p => p.status === "active").length,
      contacted: partners.filter(p => p.outreachStatus !== "not_contacted").length,
    },
    dsps: {
      total: dsps.length,
    },
    songs: {
      total: userSongs.length,
      available: userSongs.filter(s => !trackSongIds.has(s.id)).length,
      inReleases: trackSongIds.size,
    },
    audit,
  };
}

// ============================================================================
// 7. ARTIST SONGS CONNECTION — Link existing songs to distribution
// ============================================================================

export async function getUserSongs(userId: number) {
  return db.select().from(songs)
    .where(eq(songs.userId, userId))
    .orderBy(desc(songs.createdAt));
}

export async function getSongById(songId: number) {
  const results = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
  return results[0] || null;
}

/**
 * Get songs that are available (not yet added to any release)
 */
export async function getAvailableSongs(userId: number) {
  const userSongs = await getUserSongs(userId);
  const userReleases = await getUserReleases(userId);

  // Collect all song IDs already in a release
  const usedSongIds = new Set<number>();
  for (const r of userReleases) {
    const tracks = await getReleaseTracks(r.id);
    for (const t of tracks) {
      usedSongIds.add(t.songId);
    }
  }

  return userSongs.filter(s => !usedSongIds.has(s.id));
}

/**
 * Quick-distribute: Create a single release from an existing song
 * Automatically creates release + links the track + assigns ISRC/UPC
 */
export async function quickDistributeSong(userId: number, songId: number): Promise<{ success: boolean; message: string; release?: any }> {
  const song = await getSongById(songId);
  if (!song) return { success: false, message: "Song not found" };
  if (song.userId !== userId) return { success: false, message: "Song does not belong to this user" };

  // Create a release from the song
  const release = await createRelease({
    userId,
    title: song.title,
    type: "single",
    genre: song.genre || undefined,
    coverArtUrl: song.coverArt || undefined,
    releaseDate: song.releaseDate || undefined,
  });

  // Add the track
  const track = await addTrackToRelease({
    releaseId: release.id,
    songId: song.id,
    trackNumber: 1,
    title: song.title,
    artists: [{ name: "Artist", role: "primary" }],
    duration: song.duration ? parseInt(song.duration) : undefined,
    isrc: song.isrc || undefined,
  });

  // Update the song's ISRC if we generated one
  if (track.isrc && !song.isrc) {
    await db.update(songs).set({ isrc: track.isrc, updatedAt: new Date() }).where(eq(songs.id, songId));
  }

  // Update the song's UPC from the release
  if (release.upc && !song.upc) {
    await db.update(songs).set({ upc: release.upc, updatedAt: new Date() }).where(eq(songs.id, songId));
  }

  return {
    success: true,
    message: `Release "${release.title}" created with UPC ${release.upc}. Track assigned ISRC ${track.isrc}.`,
    release,
  };
}

/**
 * Add an existing song to an existing release
 */
export async function addSongToRelease(releaseId: number, songId: number, trackNumber?: number): Promise<{ success: boolean; message: string; track?: any }> {
  const release = await getReleaseById(releaseId);
  if (!release) return { success: false, message: "Release not found" };
  const song = await getSongById(songId);
  if (!song) return { success: false, message: "Song not found" };

  // Auto-calculate track number if not given
  const existingTracks = await getReleaseTracks(releaseId);
  const nextTrackNum = trackNumber || existingTracks.length + 1;

  const track = await addTrackToRelease({
    releaseId,
    songId: song.id,
    trackNumber: nextTrackNum,
    title: song.title,
    duration: song.duration ? parseInt(song.duration) : undefined,
    isrc: song.isrc || undefined,
    artists: [{ name: "Artist", role: "primary" }],
  });

  // Sync ISRC back to the song
  if (track.isrc && !song.isrc) {
    await db.update(songs).set({ isrc: track.isrc, updatedAt: new Date() }).where(eq(songs.id, songId));
  }

  return {
    success: true,
    message: `"${song.title}" added to "${release.title}" as track #${nextTrackNum}`,
    track,
  };
}

/**
 * Get release details with full song info for each track
 */
export async function getReleaseWithSongs(releaseId: number) {
  const release = await getReleaseById(releaseId);
  if (!release) return null;

  const tracks = await getReleaseTracks(releaseId);
  const tracksWithSongs = await Promise.all(
    tracks.map(async (track) => {
      const song = await getSongById(track.songId);
      return {
        ...track,
        song: song ? {
          id: song.id,
          title: song.title,
          audioUrl: song.audioUrl,
          coverArt: song.coverArt,
          genre: song.genre,
          duration: song.duration,
          plays: song.plays,
          generatedWithAI: song.generatedWithAI,
          aiProvider: song.aiProvider,
          isrc: song.isrc,
          upc: song.upc,
        } : null,
      };
    })
  );

  const submissions = await getReleaseSubmissions(releaseId);

  return { ...release, tracks: tracksWithSongs, submissions };
}

// ============================================================================
// 8. INFRASTRUCTURE PLANNING ENGINE (Section F)
// ============================================================================

export interface InfraComponent {
  name: string;
  category: "workflow" | "data_model" | "admin" | "permissions" | "partner_routing" | "metadata" | "error_handling" | "notifications" | "revenue" | "external_api" | "internal_service";
  status: "operational" | "partial" | "missing" | "planned";
  description: string;
  dependencies: string[];
  blockers: string[];
  implementationOrder: number;
  effort: "small" | "medium" | "large" | "xlarge";
}

export interface InfrastructurePlan {
  minimumViableStack: InfraComponent[];
  preferredArchitecture: { layer: string; technology: string; status: string; notes: string }[];
  requiredAPIs: { name: string; purpose: string; provider: string; status: string; priority: string }[];
  internalServices: { name: string; purpose: string; status: string; file: string }[];
  topBlockers: string[];
  recommendedOrder: { phase: number; name: string; components: string[]; estimatedScope: string }[];
  readinessScore: number;
}

export async function getInfrastructurePlan(): Promise<InfrastructurePlan> {
  const audit = await getModuleAudit();
  const partnerCount = (await db.select({ count: count() }).from(distributionPartners))[0]?.count ?? 0;
  const dspCount = (await db.select({ count: count() }).from(dspPlatforms))[0]?.count ?? 0;
  const releaseCount = (await db.select({ count: count() }).from(releases))[0]?.count ?? 0;

  const connected = audit.filter(m => m.status === "EXISTS_CONNECTED").length;
  const readinessScore = Math.round((connected / audit.length) * 100);

  const minimumViableStack: InfraComponent[] = [
    // Product Workflows
    {
      name: "Release Lifecycle Pipeline",
      category: "workflow",
      status: releaseCount > 0 ? "operational" : "partial",
      description: "Draft → Metadata Complete → Review → Approved → Delivering → Live → Takedown. Full state machine with DB-backed transitions.",
      dependencies: ["Release Builder", "Track Metadata Manager", "Artwork Validation"],
      blockers: [],
      implementationOrder: 1,
      effort: "large",
    },
    {
      name: "Submission Delivery Pipeline",
      category: "workflow",
      status: "partial",
      description: "Queued → Delivering → Processing → Live/Rejected. Currently simulated. Needs real partner API integration.",
      dependencies: ["Distribution Partner Manager", "Partner API Connectors"],
      blockers: ["No signed partner agreements yet", "Partner APIs require credentials"],
      implementationOrder: 3,
      effort: "xlarge",
    },
    {
      name: "Takedown / Update Workflow",
      category: "workflow",
      status: "missing",
      description: "Request takedown per-DSP or global, track reason, propagate to partner API, confirm removal.",
      dependencies: ["Delivery Status Tracker", "Partner API Connectors"],
      blockers: [],
      implementationOrder: 6,
      effort: "medium",
    },

    // Data Model
    {
      name: "Distribution Schema (7 Tables)",
      category: "data_model",
      status: "operational",
      description: "distributionPartners, dspPlatforms, releases, releaseTracks, distributionSubmissions, royaltyTransactions, streamingAnalytics — all active in PostgreSQL via Drizzle ORM.",
      dependencies: [],
      blockers: [],
      implementationOrder: 0,
      effort: "small",
    },
    {
      name: "Contributor Splits Table",
      category: "data_model",
      status: "missing",
      description: "Missing table for revenue split percentages between collaborators. Required for multi-artist releases.",
      dependencies: ["Distribution Schema"],
      blockers: [],
      implementationOrder: 4,
      effort: "medium",
    },
    {
      name: "Publishing Rights Table",
      category: "data_model",
      status: "missing",
      description: "Missing songwriters, publishers, mechanical royalty splits, ISWC registry. Required for full publishing.",
      dependencies: ["Contributor Splits Table"],
      blockers: [],
      implementationOrder: 7,
      effort: "large",
    },

    // Admin
    {
      name: "Admin Review Queue",
      category: "admin",
      status: "partial",
      description: "Release approve endpoint exists. No dedicated admin UI for QA review, rejection with notes, bulk approval.",
      dependencies: ["Release Lifecycle Pipeline"],
      blockers: [],
      implementationOrder: 2,
      effort: "medium",
    },
    {
      name: "Admin Partner Management",
      category: "admin",
      status: "operational",
      description: "Full partner CRUD + outreach engine with 7 formats. Research profiles with B2B paths.",
      dependencies: [],
      blockers: [],
      implementationOrder: 0,
      effort: "small",
    },

    // Permissions
    {
      name: "Role-Based Access Control",
      category: "permissions",
      status: "partial",
      description: "User auth exists (Firebase). No artist/label/admin role enforcement on distribution endpoints.",
      dependencies: ["Auth System"],
      blockers: [],
      implementationOrder: 5,
      effort: "medium",
    },
    {
      name: "Label Multi-Artist Permissions",
      category: "permissions",
      status: "missing",
      description: "Labels managing multiple artists need delegated release creation, approval, and royalty viewing.",
      dependencies: ["Role-Based Access Control", "Label Onboarding"],
      blockers: ["Label entity not yet defined"],
      implementationOrder: 8,
      effort: "large",
    },

    // Partner Routing
    {
      name: "Partner Selection Router",
      category: "partner_routing",
      status: "partial",
      description: "Quick-distribute sends to all partners. Missing per-release partner/DSP targeting selection.",
      dependencies: ["Distribution Partner Manager", "DSP Targeting Manager"],
      blockers: [],
      implementationOrder: 4,
      effort: "medium",
    },
    {
      name: "Partner API Connector Layer",
      category: "partner_routing",
      status: "missing",
      description: "Abstraction layer for partner-specific APIs (FUGA, Believe, Symphonic). DDEX/REST adapter pattern.",
      dependencies: ["Signed partner agreements"],
      blockers: ["Requires signed agreements with at least 1 partner"],
      implementationOrder: 5,
      effort: "xlarge",
    },

    // Metadata Standards
    {
      name: "DDEX ERN Compliance",
      category: "metadata",
      status: "missing",
      description: "Digital Data Exchange standard for music metadata. Required by major partners (FUGA, Believe).",
      dependencies: ["Track Metadata Manager"],
      blockers: ["DDEX membership required (~$5K/year)"],
      implementationOrder: 7,
      effort: "xlarge",
    },
    {
      name: "Metadata Validation Engine",
      category: "metadata",
      status: "partial",
      description: "Basic field presence checks. Missing: ISRC format validation, language codes (ISO 639), genre taxonomy, explicit content flags, artwork dimension checks.",
      dependencies: [],
      blockers: [],
      implementationOrder: 2,
      effort: "medium",
    },
    {
      name: "ISRC/UPC Registration",
      category: "metadata",
      status: "partial",
      description: "Auto-generates placeholder codes. Real ISRC requires IFPI registration ($100). UPC requires GS1 ($250/year).",
      dependencies: [],
      blockers: ["IFPI registration pending", "GS1 registration pending"],
      implementationOrder: 3,
      effort: "small",
    },

    // Error Handling
    {
      name: "Distribution Error Pipeline",
      category: "error_handling",
      status: "partial",
      description: "Try/catch on all endpoints. Missing: structured error codes, retry logic, dead-letter queue for failed deliveries, error dashboard.",
      dependencies: [],
      blockers: [],
      implementationOrder: 5,
      effort: "medium",
    },

    // Notifications
    {
      name: "Artist Notification System",
      category: "notifications",
      status: "partial",
      description: "Brevo email sending works. Missing: release status webhooks, in-app notifications, push alerts for go-live/rejection/royalty deposits.",
      dependencies: ["Brevo API"],
      blockers: [],
      implementationOrder: 4,
      effort: "medium",
    },

    // Revenue
    {
      name: "Revenue Reporting Pipeline",
      category: "revenue",
      status: "partial",
      description: "Royalty schema + summary endpoint exist. Missing: automated ingestion from partner reports, payout calculations, tax withholding, invoicing.",
      dependencies: ["Partner API Connector Layer", "Contributor Splits Table"],
      blockers: ["No live royalty data sources yet"],
      implementationOrder: 8,
      effort: "xlarge",
    },
  ];

  const preferredArchitecture = [
    { layer: "Frontend", technology: "React + Vite + TailwindCSS", status: "operational", notes: "Distribution dashboard with 7+ tabs, animated UI" },
    { layer: "API Layer", technology: "Express.js + TypeScript", status: "operational", notes: "30+ distribution endpoints, typed request/response" },
    { layer: "ORM / DB", technology: "Drizzle ORM + PostgreSQL (Neon)", status: "operational", notes: "7 distribution tables, type-safe queries" },
    { layer: "Auth", technology: "Firebase Auth", status: "operational", notes: "User sessions. Needs role enrichment for artist/label/admin" },
    { layer: "Email", technology: "Brevo SMTP API", status: "operational", notes: "Outreach engine, notifications. 300 emails/day free tier" },
    { layer: "File Storage", technology: "Firebase Storage", status: "operational", notes: "Audio + artwork. Needs CDN for DSP delivery" },
    { layer: "Partner Delivery", technology: "TBD — DDEX/REST adapters", status: "planned", notes: "Needs abstraction layer per partner API" },
    { layer: "Analytics", technology: "Proprietary + streamingAnalytics table", status: "partial", notes: "Schema ready, needs data ingestion pipeline" },
    { layer: "Payments", technology: "Stripe", status: "operational", notes: "Subscription billing active. Needs royalty payout integration" },
    { layer: "Background Jobs", technology: "TBD — Bull/BullMQ or cron", status: "planned", notes: "Delivery polling, royalty ingestion, notification scheduling" },
  ];

  const requiredAPIs = [
    { name: "FUGA API", purpose: "White-label distribution to 200+ DSPs", provider: "FUGA/Downtown", status: partnerCount > 0 ? "researched" : "not_started", priority: "critical" },
    { name: "Believe API", purpose: "Major indie distributor with label services", provider: "Believe Digital", status: "researched", priority: "critical" },
    { name: "Symphonic API", purpose: "Distribution + publishing + sync", provider: "Symphonic", status: "researched", priority: "high" },
    { name: "Spotify for Artists API", purpose: "Playlist pitching, analytics", provider: "Spotify", status: "not_started", priority: "high" },
    { name: "Apple Music for Artists", purpose: "Analytics, pre-save", provider: "Apple", status: "not_started", priority: "high" },
    { name: "YouTube Content ID API", purpose: "Content fingerprinting + claims", provider: "Google/YouTube", status: "not_started", priority: "medium" },
    { name: "Stripe Connect", purpose: "Royalty payouts to artists", provider: "Stripe", status: "planned", priority: "high" },
    { name: "ISRC API (IFPI)", purpose: "Real ISRC code allocation", provider: "IFPI", status: "not_started", priority: "high" },
    { name: "GS1 DataKart", purpose: "Real UPC/EAN barcode allocation", provider: "GS1", status: "not_started", priority: "high" },
    { name: "DDEX Standards", purpose: "Industry metadata exchange format", provider: "DDEX Ltd", status: "not_started", priority: "medium" },
    { name: "Brevo API", purpose: "Email notifications + outreach", provider: "Brevo/Sendinblue", status: "active", priority: "medium" },
  ];

  const internalServices = [
    { name: "Distribution Orchestrator", purpose: "Core business logic — releases, partners, royalties, outreach", status: "active", file: "server/services/distribution-orchestrator.ts" },
    { name: "Distribution Routes", purpose: "30+ REST API endpoints for distribution", status: "active", file: "server/routes/distribution.ts" },
    { name: "Artist Dashboard UI", purpose: "7-tab distribution hub (overview, songs, releases, partners, DSPs, royalties, audit)", status: "active", file: "client/src/pages/artist-dashboard.tsx" },
    { name: "Email Template Engine", purpose: "HTML email generation for outreach + notifications", status: "active", file: "server/services/distribution-orchestrator.ts" },
    { name: "Metadata Validator", purpose: "ISRC/UPC generation, field validation", status: "partial", file: "server/services/distribution-orchestrator.ts" },
    { name: "Partner Connector (Abstract)", purpose: "API adapter per partner for delivery + status polling", status: "missing", file: "N/A" },
    { name: "Royalty Ingestion Worker", purpose: "Background job to import partner royalty reports", status: "missing", file: "N/A" },
    { name: "Notification Dispatcher", purpose: "Event-driven artist notifications (release live, rejection, payout)", status: "missing", file: "N/A" },
  ];

  const topBlockers = [
    "No signed distribution partner agreement — can't deliver to DSPs without at least 1 active partner (FUGA or Believe preferred)",
    "Placeholder ISRC/UPC codes — IFPI registration (~$100) and GS1 registration (~$250/year) needed for real codes",
    "No DDEX membership — many partners require DDEX ERN format for metadata delivery (~$5K/year)",
    "No Stripe Connect setup — can't pay out royalties to artists without connected accounts",
    "Missing background job infrastructure — no BullMQ/cron for delivery polling, royalty ingestion, notification scheduling",
  ];

  const recommendedOrder = [
    { phase: 1, name: "Metadata & Validation Hardening", components: ["Metadata Validation Engine", "Artwork Dimensions Check", "Audio Quality Check", "ISRC/UPC format validation"], estimatedScope: "Small — 2-3 service functions + UI form validation" },
    { phase: 2, name: "Admin Review & QA Queue", components: ["Admin Review Queue UI", "Rejection Notes", "Bulk Approval", "Release QA Checklist"], estimatedScope: "Medium — new admin page + API endpoints" },
    { phase: 3, name: "Contributor Splits & Publishing", components: ["Contributor Splits Table", "Split Manager UI", "Publishing Rights Table", "Songwriter Registration"], estimatedScope: "Large — new schema + CRUD + royalty calculation changes" },
    { phase: 4, name: "Partner Agreement & First Delivery", components: ["Sign FUGA or Believe agreement", "Implement Partner API Connector", "First test delivery", "Delivery status webhook"], estimatedScope: "XLarge — legal + API integration + testing" },
    { phase: 5, name: "Royalty Pipeline", components: ["Royalty Report Ingestion", "Revenue Splitting Calculation", "Stripe Connect Payouts", "Artist Payout Dashboard"], estimatedScope: "XLarge — background jobs + financial calculations + compliance" },
    { phase: 6, name: "Notifications & Polish", components: ["Artist Status Notifications", "In-App Notification Center", "Smart Links / Pre-Save", "Marketing Launch Workflow"], estimatedScope: "Medium — event triggers + email templates + new UI components" },
  ];

  return { minimumViableStack, preferredArchitecture, requiredAPIs, internalServices, topBlockers, recommendedOrder, readinessScore };
}

// ============================================================================
// 9. MISSING MODULE GENERATOR (Section G)
// ============================================================================

export interface ModuleGenerationPlan {
  moduleName: string;
  moduleNumber: number;
  purpose: string;
  userTypes: string[];
  keyUISections: string[];
  coreActions: string[];
  dataFields: { name: string; type: string; required: boolean }[];
  integrations: string[];
  automationOpportunities: string[];
  adminControls: string[];
  suggestedTables: { tableName: string; keyColumns: string[] }[];
  eventTriggers: string[];
  nextDependencies: string[];
  priorityScore: number; // 1-10
  scaffold: { files: { path: string; purpose: string }[]; connectionMap: string[] };
}

export async function getMissingModuleGenerationPlans(): Promise<ModuleGenerationPlan[]> {
  const audit = await getModuleAudit();
  const missing = audit.filter(m => m.status === "MISSING_CREATE_NOW");

  const plans: ModuleGenerationPlan[] = [];

  for (const mod of missing) {
    const plan = generateModulePlan(mod.module, mod.priority);
    if (plan) plans.push(plan);
  }

  // Sort by priority score descending
  plans.sort((a, b) => b.priorityScore - a.priorityScore);
  return plans;
}

function generateModulePlan(moduleName: string, priority: string): ModuleGenerationPlan | null {
  const moduleMap: Record<string, Omit<ModuleGenerationPlan, "scaffold">> = {
    "10. Contributor Splits Manager": {
      moduleName: "Contributor Splits Manager",
      moduleNumber: 10,
      purpose: "Track and manage revenue splits between collaborators (artists, producers, songwriters, labels) for each release or track.",
      userTypes: ["artist", "producer", "songwriter", "label_admin", "admin"],
      keyUISections: [
        "Split Editor — slider/percentage input per contributor per track",
        "Collaborator Directory — search/invite collaborators by email or username",
        "Split Summary Dashboard — aggregate splits across all releases",
        "Payout Preview — show projected earnings per contributor based on current royalties",
        "Approval Flow — contributors must accept their assigned split",
      ],
      coreActions: [
        "Add collaborator to track/release with percentage",
        "Edit split percentages (must sum to 100%)",
        "Send split invitation to collaborator",
        "Accept/reject split assignment",
        "Lock splits after release submission",
        "Calculate per-contributor royalty amounts",
        "View payout history per contributor",
      ],
      dataFields: [
        { name: "id", type: "serial", required: true },
        { name: "releaseId", type: "integer", required: true },
        { name: "trackId", type: "integer", required: false },
        { name: "contributorUserId", type: "integer", required: false },
        { name: "contributorEmail", type: "varchar(255)", required: true },
        { name: "contributorName", type: "varchar(255)", required: true },
        { name: "role", type: "enum(artist,producer,songwriter,featured,mixer,mastering)", required: true },
        { name: "splitPercent", type: "decimal(5,2)", required: true },
        { name: "status", type: "enum(pending,accepted,rejected,locked)", required: true },
        { name: "invitedAt", type: "timestamp", required: true },
        { name: "acceptedAt", type: "timestamp", required: false },
        { name: "totalEarned", type: "decimal(10,2)", required: false },
      ],
      integrations: ["Royalty Dashboard", "Release Builder", "Stripe Connect Payouts", "Email Notifications"],
      automationOpportunities: [
        "Auto-calculate payouts when royalties arrive",
        "Email contributors when splits are assigned",
        "Lock splits automatically on release submission",
        "Flag releases without 100% split allocation",
      ],
      adminControls: [
        "Override split percentages",
        "Resolve disputes between collaborators",
        "View all splits across platform",
        "Freeze payouts for disputed releases",
      ],
      suggestedTables: [
        { tableName: "contributor_splits", keyColumns: ["id", "releaseId", "trackId", "contributorUserId", "contributorEmail", "contributorName", "role", "splitPercent", "status", "invitedAt", "acceptedAt"] },
        { tableName: "contributor_payouts", keyColumns: ["id", "splitId", "royaltyTransactionId", "amount", "currency", "status", "paidAt"] },
      ],
      eventTriggers: ["split.created", "split.accepted", "split.rejected", "split.locked", "payout.calculated", "payout.sent"],
      nextDependencies: ["Royalty Pipeline", "Stripe Connect", "Email Notifications"],
      priorityScore: 10,
    },

    "18. Publishing Module": {
      moduleName: "Publishing Module",
      moduleNumber: 18,
      purpose: "Manage publishing rights, songwriter registrations, publisher entities, mechanical royalties, and sync licensing.",
      userTypes: ["songwriter", "publisher", "artist", "admin"],
      keyUISections: [
        "Songwriter Registry — register songwriters with IPI/CAE numbers",
        "Publisher Dashboard — manage publishing entities and catalogs",
        "Song Ownership Table — track writer shares per composition",
        "Mechanical Royalty Tracker — HFA/MLC royalty statements",
        "Sync License Manager — track sync placements and fees",
      ],
      coreActions: [
        "Register songwriter with PRO affiliation (ASCAP/BMI/SESAC)",
        "Create publisher entity",
        "Assign writer shares to compositions",
        "Record mechanical royalty statements",
        "Track sync license opportunities",
        "Generate CWR (Common Works Registration) files",
        "Submit works to PROs",
      ],
      dataFields: [
        { name: "id", type: "serial", required: true },
        { name: "songId", type: "integer", required: true },
        { name: "songwriterName", type: "varchar(255)", required: true },
        { name: "songwriterIPI", type: "varchar(20)", required: false },
        { name: "proAffiliation", type: "enum(ASCAP,BMI,SESAC,PRS,GEMA,SOCAN,other)", required: false },
        { name: "publisherName", type: "varchar(255)", required: false },
        { name: "publisherIPI", type: "varchar(20)", required: false },
        { name: "writerShare", type: "decimal(5,2)", required: true },
        { name: "publisherShare", type: "decimal(5,2)", required: false },
        { name: "iswc", type: "varchar(20)", required: false },
        { name: "mechanicalRoyaltyRate", type: "decimal(6,4)", required: false },
        { name: "territory", type: "varchar(10)", required: false },
      ],
      integrations: ["Rights Ownership Manager", "Contributor Splits", "Royalty Dashboard", "PRO APIs (ASCAP/BMI)"],
      automationOpportunities: [
        "Auto-lookup IPI numbers from PRO databases",
        "Generate CWR files for batch registration",
        "Flag songs without publishing info before submission",
        "Calculate mechanical royalties from stream counts",
      ],
      adminControls: [
        "Manage publisher entities",
        "Override writer/publisher shares",
        "Bulk import publishing catalogs",
        "Audit publishing data completeness",
      ],
      suggestedTables: [
        { tableName: "publishing_rights", keyColumns: ["id", "songId", "songwriterName", "songwriterIPI", "proAffiliation", "writerShare", "publisherName", "publisherShare", "iswc", "territory"] },
        { tableName: "publisher_entities", keyColumns: ["id", "name", "ipi", "proAffiliation", "contactEmail", "catalogs", "status"] },
        { tableName: "sync_licenses", keyColumns: ["id", "songId", "licensee", "licenseType", "fee", "territory", "term", "status"] },
      ],
      eventTriggers: ["publishing.registered", "publishing.updated", "sync.requested", "sync.approved", "cwr.generated"],
      nextDependencies: ["Contributor Splits Manager", "PRO Registration", "CWR Generator"],
      priorityScore: 8,
    },

    "20. Video Distribution": {
      moduleName: "Video Distribution",
      moduleNumber: 20,
      purpose: "Deliver music videos to YouTube/Vevo, Apple Music Video, and other visual platforms through distribution partners.",
      userTypes: ["artist", "label_admin", "admin"],
      keyUISections: [
        "Video Upload Center — upload/link videos with metadata",
        "Video-Track Linking — associate videos with audio releases",
        "Video Delivery Queue — status tracking per platform",
        "Vevo Channel Manager — artist channel setup and management",
        "Video Analytics — views, engagement, revenue per platform",
      ],
      coreActions: [
        "Upload music video with metadata",
        "Link video to existing audio release/track",
        "Submit video to YouTube/Vevo via partner",
        "Submit video to Apple Music Video",
        "Track delivery status per platform",
        "Monitor Content ID claims on uploaded videos",
        "View per-video analytics and revenue",
      ],
      dataFields: [
        { name: "id", type: "serial", required: true },
        { name: "releaseId", type: "integer", required: true },
        { name: "trackId", type: "integer", required: false },
        { name: "videoUrl", type: "text", required: true },
        { name: "videoType", type: "enum(music_video,lyric_video,visualizer,live,behind_scenes)", required: true },
        { name: "resolution", type: "varchar(20)", required: true },
        { name: "duration", type: "integer", required: true },
        { name: "thumbnailUrl", type: "text", required: false },
        { name: "deliveryStatus", type: "enum(draft,processing,delivering,live,rejected)", required: true },
        { name: "platforms", type: "json", required: true },
        { name: "youtubeId", type: "varchar(20)", required: false },
        { name: "vevoId", type: "varchar(30)", required: false },
      ],
      integrations: ["Video Creation Tools (Kling/MiniMax/Shotstack)", "YouTube API", "Apple Music API", "Distribution Partner Video APIs"],
      automationOpportunities: [
        "Auto-generate lyric videos from audio + lyrics",
        "Auto-create visualizers from cover art + audio",
        "Schedule video releases to match audio release dates",
        "Auto-submit to all connected video platforms",
      ],
      adminControls: [
        "Review video content before delivery",
        "Manage Vevo channel applications",
        "Override delivery status",
        "Content moderation flags",
      ],
      suggestedTables: [
        { tableName: "video_distributions", keyColumns: ["id", "releaseId", "trackId", "videoUrl", "videoType", "resolution", "duration", "deliveryStatus", "platforms", "youtubeId", "vevoId", "createdAt"] },
        { tableName: "video_platform_submissions", keyColumns: ["id", "videoDistId", "platform", "status", "externalUrl", "deliveredAt", "liveAt"] },
      ],
      eventTriggers: ["video.uploaded", "video.submitted", "video.live", "video.rejected", "video.analytics_update"],
      nextDependencies: ["YouTube Content ID", "Distribution Partner Manager", "Video Creation Tools"],
      priorityScore: 6,
    },

    "21. Smart Links / Pre-Save": {
      moduleName: "Smart Links & Pre-Save",
      moduleNumber: 21,
      purpose: "Generate smart release links and pre-save campaigns that route fans to their preferred streaming platform.",
      userTypes: ["artist", "label_admin", "marketing_manager", "admin"],
      keyUISections: [
        "Smart Link Builder — create branded landing pages per release",
        "Pre-Save Campaign Creator — set up pre-save with countdown",
        "Link Analytics Dashboard — clicks, conversions, geography",
        "Link-in-Bio Generator — aggregate all release links",
        "QR Code Generator — for physical promo materials",
      ],
      coreActions: [
        "Create smart link for a release",
        "Configure DSP links (Spotify, Apple, YouTube, etc.)",
        "Create pre-save campaign with release date",
        "Customize landing page branding (colors, image, bio)",
        "Generate QR code for physical distribution",
        "Track click analytics per platform per territory",
        "A/B test landing page variants",
      ],
      dataFields: [
        { name: "id", type: "serial", required: true },
        { name: "releaseId", type: "integer", required: true },
        { name: "slug", type: "varchar(100)", required: true },
        { name: "type", type: "enum(smart_link,pre_save,link_in_bio)", required: true },
        { name: "customUrl", type: "text", required: false },
        { name: "dspLinks", type: "json", required: true },
        { name: "brandingConfig", type: "json", required: false },
        { name: "preSaveDate", type: "timestamp", required: false },
        { name: "totalClicks", type: "integer", required: false },
        { name: "isActive", type: "boolean", required: true },
        { name: "qrCodeUrl", type: "text", required: false },
      ],
      integrations: ["Release Builder", "DSP Targeting Manager", "Marketing Launch Engine", "Analytics Dashboard"],
      automationOpportunities: [
        "Auto-generate smart links when release goes live",
        "Auto-populate DSP links from submission data",
        "Send pre-save reminder emails 24h before release",
        "Auto-share on connected social platforms",
      ],
      adminControls: [
        "Custom domain management for smart links",
        "Approve/block custom slugs",
        "View aggregate click analytics",
        "Manage branding templates",
      ],
      suggestedTables: [
        { tableName: "smart_links", keyColumns: ["id", "releaseId", "slug", "type", "customUrl", "dspLinks", "brandingConfig", "preSaveDate", "totalClicks", "isActive", "qrCodeUrl", "createdAt"] },
        { tableName: "smart_link_clicks", keyColumns: ["id", "smartLinkId", "platform", "territory", "referrer", "userAgent", "clickedAt"] },
      ],
      eventTriggers: ["smartlink.created", "smartlink.clicked", "presave.activated", "presave.converted", "presave.reminder_sent"],
      nextDependencies: ["Release Builder", "DSP Targeting Manager", "Custom Domain DNS"],
      priorityScore: 8,
    },
  };

  // Find the matching module
  const key = Object.keys(moduleMap).find(k => moduleName.includes(k.split(". ")[1]!));
  if (!key) return null;

  const base = moduleMap[key]!;
  return {
    ...base,
    scaffold: generateModuleScaffold(base.moduleName, base.suggestedTables),
  };
}

function generateModuleScaffold(moduleName: string, tables: { tableName: string; keyColumns: string[] }[]): { files: { path: string; purpose: string }[]; connectionMap: string[] } {
  const slug = moduleName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");

  const files = [
    { path: `db/schema.ts (add tables: ${tables.map(t => t.tableName).join(", ")})`, purpose: "Database schema — new Drizzle ORM table definitions" },
    { path: `server/services/${slug}-service.ts`, purpose: `Core business logic — CRUD operations, validation, calculations for ${moduleName}` },
    { path: `server/routes/${slug}.ts`, purpose: "REST API endpoints — Express router with typed request/response" },
    { path: `client/src/pages/${slug}.tsx`, purpose: `UI page — React component with full ${moduleName} interface` },
    { path: `server/routes.ts (register router)`, purpose: `Mount new router at /api/${slug}` },
  ];

  const connectionMap = [
    `distribution-orchestrator.ts → import from ${slug}-service.ts for cross-module operations`,
    `artist-dashboard.tsx → add tab or link to ${slug} page`,
    `distribution.ts routes → add summary endpoint for dashboard integration`,
    ...tables.map(t => `db/schema.ts → new table: ${t.tableName} (${t.keyColumns.slice(0, 5).join(", ")}...)`),
  ];

  return { files, connectionMap };
}

// ============================================================================
// 10. LAUNCH READINESS TRACKER (Section H)
// ============================================================================

export interface ReadinessCategory {
  category: string;
  items: ReadinessItem[];
  score: number; // 0-100
  status: "not_ready" | "partial" | "ready" | "launched";
}

export interface ReadinessItem {
  name: string;
  status: "not_started" | "in_progress" | "blocked" | "complete";
  details: string;
  blocker?: string;
  owner: string;
}

export interface LaunchReadiness {
  categories: ReadinessCategory[];
  overallScore: number;
  overallStatus: string;
  criticalBlockers: string[];
  nextActions: string[];
  launchDate: string | null;
}

export async function getLaunchReadiness(): Promise<LaunchReadiness> {
  const audit = await getModuleAudit();
  const partnerCount = (await db.select({ count: count() }).from(distributionPartners))[0]?.count ?? 0;
  const dspCount = (await db.select({ count: count() }).from(dspPlatforms))[0]?.count ?? 0;
  const releaseCount = (await db.select({ count: count() }).from(releases))[0]?.count ?? 0;

  const connected = audit.filter(m => m.status === "EXISTS_CONNECTED").length;
  const missing = audit.filter(m => m.status === "MISSING_CREATE_NOW").length;
  const partial = audit.filter(m => m.status === "PARTIAL").length;

  const categories: ReadinessCategory[] = [
    // 1. Partner Readiness
    {
      category: "Partner Readiness",
      items: [
        { name: "Distribution partner research", status: partnerCount >= 10 ? "complete" : "in_progress", details: `${partnerCount} partners with enriched profiles in database`, owner: "BD Team" },
        { name: "Partner outreach initiated", status: partnerCount > 0 ? "in_progress" : "not_started", details: "7-format outreach engine built. Need to send to priority partners.", owner: "BD Team" },
        { name: "Signed partner agreement", status: "not_started", details: "No signed distribution agreement yet. FUGA or Believe recommended as first partner.", blocker: "Legal review needed + partner response time", owner: "BD Team + Legal" },
        { name: "Partner API credentials obtained", status: "not_started", details: "Can't integrate delivery pipeline without API access from partner.", blocker: "Depends on signed agreement", owner: "Engineering" },
        { name: "Test delivery completed", status: "not_started", details: "Must successfully deliver a test release to at least 1 DSP.", blocker: "Depends on API credentials", owner: "Engineering" },
      ],
      score: partnerCount >= 10 ? 20 : 10,
      status: "partial",
    },

    // 2. Module Readiness
    {
      category: "Module Readiness",
      items: [
        { name: "Core modules connected", status: connected >= 8 ? "complete" : "in_progress", details: `${connected}/29 modules fully connected. ${partial} partial.`, owner: "Engineering" },
        { name: "Missing critical modules built", status: missing === 0 ? "complete" : "in_progress", details: `${missing} modules missing: Contributor Splits, Publishing, Video Dist, Smart Links.`, owner: "Engineering" },
        { name: "Release Builder tested end-to-end", status: releaseCount > 0 ? "in_progress" : "not_started", details: `${releaseCount} releases in system. Need full draft→live test.`, owner: "QA" },
        { name: "Metadata validation hardened", status: "in_progress", details: "Basic validation exists. Needs ISRC format, artwork dimensions, audio quality checks.", owner: "Engineering" },
        { name: "Admin review queue built", status: "in_progress", details: "Approve endpoint exists. Needs dedicated admin UI with rejection notes.", owner: "Engineering" },
      ],
      score: Math.round(((connected + partial * 0.5) / audit.length) * 100),
      status: connected >= 20 ? "ready" : "partial",
    },

    // 3. Metadata Readiness
    {
      category: "Metadata Readiness",
      items: [
        { name: "ISRC registration (IFPI)", status: "not_started", details: "Using placeholder codes. Need IFPI registration (~$100) for real ISRCs.", blocker: "Budget approval needed", owner: "Operations" },
        { name: "UPC registration (GS1)", status: "not_started", details: "Using placeholder codes. Need GS1 registration (~$250/year) for real barcodes.", blocker: "Budget approval needed", owner: "Operations" },
        { name: "DDEX membership", status: "not_started", details: "Many partners require DDEX ERN format. Membership ~$5K/year.", blocker: "Budget approval + technical implementation", owner: "Operations + Engineering" },
        { name: "Genre taxonomy standardized", status: "in_progress", details: "Using free-text genres. Needs mapping to DDEX/Apple/Spotify genre IDs.", owner: "Engineering" },
        { name: "Territory mapping complete", status: "in_progress", details: "Using territory count integers. Needs ISO 3166 country code mapping.", owner: "Engineering" },
      ],
      score: 15,
      status: "partial",
    },

    // 4. Legal Readiness
    {
      category: "Legal Readiness",
      items: [
        { name: "Artist distribution agreement drafted", status: "in_progress", details: "AI contract system exists with templates. Needs distribution-specific terms.", owner: "Legal" },
        { name: "Revenue split policy defined", status: "not_started", details: "Need to define Boostify's take rate, payment terms, minimum thresholds.", blocker: "Business decision", owner: "Legal + Finance" },
        { name: "Content policy published", status: "not_started", details: "Need explicit rules on content types, takedown policies, copyright infringement.", owner: "Legal" },
        { name: "Privacy/GDPR compliance", status: "in_progress", details: "Basic privacy policy exists. Needs data processing addendum for distribution data.", owner: "Legal" },
        { name: "Partner contract template ready", status: "not_started", details: "Need standard partner agreement covering rev share, SLAs, data handling.", owner: "Legal" },
      ],
      score: 15,
      status: "partial",
    },

    // 5. User Onboarding Readiness
    {
      category: "User Onboarding Readiness",
      items: [
        { name: "Artist onboarding flow", status: "in_progress", details: "Artist setup wizard exists. Needs distribution-specific profile completion steps.", owner: "Product" },
        { name: "First-release walkthrough", status: "not_started", details: "Need guided tutorial for creating and submitting first release.", owner: "Product + Design" },
        { name: "Help documentation", status: "not_started", details: "Need FAQ, knowledge base, and video tutorials for distribution features.", owner: "Content" },
        { name: "Support escalation path", status: "not_started", details: "Need support ticket system for release issues, takedowns, royalty disputes.", owner: "Operations" },
        { name: "Beta tester program", status: "not_started", details: "Need 10-50 beta artists to test full flow before public launch.", owner: "Product + Community" },
      ],
      score: 10,
      status: "not_ready",
    },

    // 6. Admin Readiness
    {
      category: "Admin Readiness",
      items: [
        { name: "Admin dashboard built", status: "in_progress", details: "Module audit exists. Needs release queue, partner status, royalty overview panels.", owner: "Engineering" },
        { name: "Release QA review workflow", status: "in_progress", details: "Approve endpoint exists. Needs full UI with rejection notes and revision tracking.", owner: "Engineering" },
        { name: "Partner status monitoring", status: "complete", details: "Partner profiles with outreach status, research data, and contact tracking.", owner: "Engineering" },
        { name: "System health monitoring", status: "not_started", details: "Need uptime monitoring, error rate tracking, API latency dashboards.", owner: "DevOps" },
        { name: "User analytics dashboard", status: "in_progress", details: "Analytics page exists. Needs distribution-specific metrics (releases/day, time-to-live, rejection rate).", owner: "Engineering" },
      ],
      score: 35,
      status: "partial",
    },

    // 7. Communications Readiness
    {
      category: "Communications Readiness",
      items: [
        { name: "Email notification templates", status: "in_progress", details: "Brevo integration active. Outreach emails built. Need release status notification templates.", owner: "Design + Engineering" },
        { name: "Transactional emails configured", status: "in_progress", details: "Brevo SMTP working. Need templates for: release approved, live, rejected, royalty deposited.", owner: "Engineering" },
        { name: "In-app notification system", status: "not_started", details: "No real-time notification center. Need WebSocket or polling-based notification feed.", owner: "Engineering" },
        { name: "Launch announcement prepared", status: "not_started", details: "Need press release, social media content, email blast for distribution launch.", owner: "Marketing" },
        { name: "Partner communications plan", status: "in_progress", details: "7-format outreach engine ready. Need ongoing update templates and status reports.", owner: "BD Team" },
      ],
      score: 30,
      status: "partial",
    },

    // 8. Analytics Readiness
    {
      category: "Analytics Readiness",
      items: [
        { name: "Streaming analytics schema", status: "complete", details: "streamingAnalytics table with per-DSP daily streams, saves, playlist adds, skip rate, territory.", owner: "Engineering" },
        { name: "Royalty reporting schema", status: "complete", details: "royaltyTransactions table with per-track per-DSP revenue, platform fees, periods.", owner: "Engineering" },
        { name: "Data ingestion pipeline", status: "not_started", details: "No automated import from partner royalty reports (CSV/DDEX). Manual only.", blocker: "Depends on partner API access", owner: "Engineering" },
        { name: "Artist-facing analytics UI", status: "in_progress", details: "Analytics page with charts exists. Needs distribution-specific streams/revenue views.", owner: "Engineering" },
        { name: "Internal business metrics", status: "not_started", details: "Need platform-wide KPIs: total releases, active artists, total revenue, partner performance.", owner: "Engineering + Data" },
      ],
      score: 35,
      status: "partial",
    },

    // 9. Release Readiness (Infrastructure)
    {
      category: "Release Readiness",
      items: [
        { name: "CDN for audio delivery", status: "in_progress", details: "Firebase Storage works. May need dedicated CDN for high-quality WAV delivery to partners.", owner: "DevOps" },
        { name: "Background job infrastructure", status: "not_started", details: "No BullMQ/cron setup. Needed for: delivery polling, royalty ingestion, notifications.", blocker: "Architecture decision needed", owner: "Engineering" },
        { name: "Database backup & recovery", status: "in_progress", details: "Neon PostgreSQL has automatic backups. Need point-in-time recovery testing.", owner: "DevOps" },
        { name: "Staging environment", status: "not_started", details: "No staging/test environment. All development against production database.", blocker: "Deploy separate Neon branch", owner: "DevOps" },
        { name: "Load testing completed", status: "not_started", details: "No load testing. Need to verify system handles 100+ concurrent releases.", owner: "Engineering + QA" },
      ],
      score: 15,
      status: "not_ready",
    },
  ];

  const totalScore = Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length);

  const criticalBlockers = [
    "No signed distribution partner agreement — blocking all real DSP deliveries",
    "Placeholder ISRC/UPC codes — IFPI and GS1 registration required for production",
    "No background job infrastructure — can't automate delivery polling or royalty ingestion",
    "No staging environment — all changes tested directly in production",
    "Revenue split policy undefined — can't pay artists without defined terms",
  ];

  const nextActions = [
    "1. Send outreach emails to FUGA (priority 10) and Believe (priority 9) — use the 7-format outreach engine",
    "2. Register for IFPI (ISRC codes, ~$100) and GS1 (UPC barcodes, ~$250/year)",
    "3. Build Contributor Splits Manager (priority score 10, critical for multi-artist releases)",
    "4. Harden metadata validation: artwork dimensions, audio quality, ISRC format checks",
    "5. Build admin release QA review UI with rejection notes and revision tracking",
    "6. Set up BullMQ or cron for background job processing",
    "7. Create staging environment (Neon branch + separate Vite build)",
    "8. Recruit 10-50 beta artists for end-to-end testing",
  ];

  const overallStatus = totalScore >= 80 ? "LAUNCH READY" :
                        totalScore >= 50 ? "APPROACHING READY" :
                        totalScore >= 25 ? "IN DEVELOPMENT" : "EARLY STAGE";

  return {
    categories,
    overallScore: totalScore,
    overallStatus,
    criticalBlockers,
    nextActions,
    launchDate: null, // No date set yet
  };
}
