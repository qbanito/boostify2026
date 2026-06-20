import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { db } from '../db';
import { db as firebaseDb } from '../firebase';
import { users, subscriptions, songs, payments, investors, courses, crowdfundingCampaigns, musicians } from '../db/schema';
import { eq, sql, count } from 'drizzle-orm';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { requireAdmin } from '../middleware/require-admin';

const router = Router();
router.use(requireAdmin);

// ─── Saved Reports Directory ────────────────────────────────────
const REPORTS_DIR = path.join(process.cwd(), "server", "data", "reports");
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// ─── Completed Tasks (from Code Engine logs) ────────────────────
const ENGINE_LOG_DIR = path.join(process.cwd(), "server", "data", "code-engine");

function getAppliedTaskNames(pageId?: string): Set<string> {
  if (!fs.existsSync(ENGINE_LOG_DIR)) return new Set();
  const applied = new Set<string>();
  try {
    const files = fs.readdirSync(ENGINE_LOG_DIR).filter(f => f.endsWith(".json"));
    for (const f of files) {
      try {
        const log = JSON.parse(fs.readFileSync(path.join(ENGINE_LOG_DIR, f), "utf-8"));
        if ((log.status === "committed" || log.status === "applied") && log.task) {
          if (!pageId || log.pageId === pageId) {
            applied.add(log.task);
          }
        }
      } catch {}
    }
  } catch {}
  return applied;
}

const WEEKLY_RECIPIENT = "convoycubano@gmail.com";
const WEEKLY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ─── Platform Page Diagnostics ──────────────────────────────────
// Each page definition: name, route, status, score, improvements, deadline
interface PageDiagnostic {
  id: string;
  name: string;
  route: string;
  category: string;
  status: "live" | "beta" | "in-progress" | "planned";
  healthScore: number; // 0-100
  completedFeatures: string[];
  improvements: { task: string; priority: "critical" | "high" | "medium" | "low"; deadline: string; assignee?: string }[];
  lastUpdated: string;
}

function getPlatformDiagnostics(): PageDiagnostic[] {
  const now = new Date().toISOString().split("T")[0];
  return [
    {
      id: "ig-boost",
      name: "Instagram Boost",
      route: "/instagram-boost",
      category: "Growth Tools",
      status: "live",
      healthScore: 85,
      completedFeatures: [
        "AI-powered follower growth engine",
        "Engagement analytics dashboard",
        "Standalone pricing modal ($19/$16/$12)",
        "Stripe checkout integration",
        "Chrome extension connection",
        "Reports tab with campaign tracking",
      ],
      improvements: [
        { task: "Add usage limits hook for free tier daily caps", priority: "high", deadline: "2026-04-15" },
        { task: "Implement subscription banner component", priority: "medium", deadline: "2026-04-20" },
        { task: "Add conversion tracking analytics per product", priority: "medium", deadline: "2026-04-25" },
        { task: "Webhook handler for ig_boost_pro subscription events", priority: "high", deadline: "2026-04-12" },
      ],
      lastUpdated: now,
    },
    {
      id: "spotify-boost",
      name: "Spotify Growth Suite",
      route: "/spotify",
      category: "Growth Tools",
      status: "live",
      healthScore: 82,
      completedFeatures: [
        "5-tab interface (Connect, Tools, Pitch, Growth, Analytics)",
        "Standalone pricing modal ($19/$16/$12)",
        "Stripe checkout integration",
        "Playlist pitching tools",
        "Stream optimization engine",
      ],
      improvements: [
        { task: "Add usage limits hook for free tier", priority: "high", deadline: "2026-04-15" },
        { task: "Implement Remotion animation player", priority: "low", deadline: "2026-05-01" },
        { task: "Fix encoding issues in UI strings", priority: "medium", deadline: "2026-04-10" },
        { task: "Webhook handler for spotify_boost_pro events", priority: "high", deadline: "2026-04-12" },
      ],
      lastUpdated: now,
    },
    {
      id: "youtube-boost",
      name: "YouTube Boost",
      route: "/youtube-views",
      category: "Growth Tools",
      status: "live",
      healthScore: 78,
      completedFeatures: [
        "12 AI-powered growth tools",
        "Standalone pricing modal ($19/$16/$12)",
        "Stripe checkout integration",
        "Video SEO optimization",
        "Thumbnail analysis",
      ],
      improvements: [
        { task: "Create use-youtube-boost-limits.ts hook", priority: "high", deadline: "2026-04-15" },
        { task: "Add SubscriptionBanner component", priority: "medium", deadline: "2026-04-20" },
        { task: "Webhook handler for youtube_boost events", priority: "high", deadline: "2026-04-12" },
        { task: "Channel analytics deep integration", priority: "low", deadline: "2026-05-15" },
      ],
      lastUpdated: now,
    },
    {
      id: "artist-setup",
      name: "Artist Setup",
      route: "/artist-setup",
      category: "Onboarding",
      status: "live",
      healthScore: 90,
      completedFeatures: [
        "Free onboarding landing page",
        "3-step flow (Account → Profile → Launch)",
        "9 tools showcase with branded cards",
        "Platform icons grid (IG, Spotify, YT, TikTok)",
        "Features & benefits section with stats",
        "Responsive design (mobile + desktop)",
      ],
      improvements: [
        { task: "Add onboarding analytics funnel tracking", priority: "medium", deadline: "2026-04-20" },
        { task: "A/B test hero CTA variants", priority: "low", deadline: "2026-05-01" },
      ],
      lastUpdated: now,
    },
    {
      id: "music-video-creator",
      name: "Music Video Creator",
      route: "/music-video-creator",
      category: "Content Creation",
      status: "live",
      healthScore: 75,
      completedFeatures: [
        "AI-generated visuals and effects",
        "Video rendering pipeline",
        "Shotstack integration",
        "Template system",
      ],
      improvements: [
        { task: "Improve rendering speed", priority: "high", deadline: "2026-04-30" },
        { task: "Add more video templates", priority: "medium", deadline: "2026-05-15" },
        { task: "Mobile preview optimization", priority: "medium", deadline: "2026-04-25" },
      ],
      lastUpdated: now,
    },
    {
      id: "ai-image-gen",
      name: "AI Image Generator",
      route: "/image-generator-simple",
      category: "Content Creation",
      status: "live",
      healthScore: 80,
      completedFeatures: [
        "Album cover generation",
        "Social media post graphics",
        "Promotional materials",
        "Style presets",
      ],
      improvements: [
        { task: "Add batch generation for multiple images", priority: "medium", deadline: "2026-05-01" },
        { task: "Implement image editing/refinement", priority: "high", deadline: "2026-04-25" },
      ],
      lastUpdated: now,
    },
    {
      id: "merchandise",
      name: "Merch Store",
      route: "/merchandise",
      category: "Commerce",
      status: "live",
      healthScore: 72,
      completedFeatures: [
        "Printful print-on-demand integration",
        "Product design tools",
        "Artist branding customization",
        "Order management",
      ],
      improvements: [
        { task: "Add more product types (hats, posters)", priority: "medium", deadline: "2026-05-15" },
        { task: "Implement order tracking dashboard", priority: "high", deadline: "2026-04-30" },
        { task: "Revenue analytics per product", priority: "medium", deadline: "2026-05-01" },
      ],
      lastUpdated: now,
    },
    {
      id: "boostify-tv",
      name: "Boostify TV",
      route: "/boostify-tv",
      category: "Media",
      status: "beta",
      healthScore: 60,
      completedFeatures: [
        "Live streaming platform",
        "Channel browsing",
        "Basic playback",
      ],
      improvements: [
        { task: "Add chat overlay for live streams", priority: "high", deadline: "2026-05-01" },
        { task: "Implement stream recording", priority: "medium", deadline: "2026-05-15" },
        { task: "Add monetization features", priority: "high", deadline: "2026-05-30" },
      ],
      lastUpdated: now,
    },
    {
      id: "education",
      name: "Education Platform",
      route: "/education",
      category: "Education",
      status: "live",
      healthScore: 70,
      completedFeatures: [
        "Course catalog",
        "Video lessons",
        "Progress tracking",
      ],
      improvements: [
        { task: "Add certificate generation", priority: "medium", deadline: "2026-05-15" },
        { task: "Implement quiz system", priority: "high", deadline: "2026-05-01" },
        { task: "Add community discussion forums", priority: "low", deadline: "2026-06-01" },
      ],
      lastUpdated: now,
    },
    {
      id: "boostiswap",
      name: "BoostiSwap DEX",
      route: "/boostiswap",
      category: "Web3",
      status: "live",
      healthScore: 68,
      completedFeatures: [
        "Token swap interface",
        "BTF token wallet",
        "Staking mechanism",
        "Artist NFT minting",
      ],
      improvements: [
        { task: "Improve swap UX/speed", priority: "high", deadline: "2026-04-30" },
        { task: "Add liquidity pool analytics", priority: "medium", deadline: "2026-05-15" },
        { task: "Implement limit orders", priority: "low", deadline: "2026-06-01" },
      ],
      lastUpdated: now,
    },
    {
      id: "social-network",
      name: "Social Network",
      route: "/social-network",
      category: "Community",
      status: "beta",
      healthScore: 55,
      completedFeatures: [
        "User profiles",
        "Feed system",
        "Basic interactions",
      ],
      improvements: [
        { task: "Add messaging/DMs", priority: "high", deadline: "2026-05-01" },
        { task: "Implement notifications system", priority: "high", deadline: "2026-04-25" },
        { task: "Add content moderation AI", priority: "critical", deadline: "2026-04-15" },
      ],
      lastUpdated: now,
    },
    {
      id: "ai-agents",
      name: "AI Agents System",
      route: "/ai-agents",
      category: "AI",
      status: "beta",
      healthScore: 65,
      completedFeatures: [
        "Autonomous social media management",
        "Outreach automation",
        "Multi-agent orchestration",
      ],
      improvements: [
        { task: "Add agent performance dashboards", priority: "high", deadline: "2026-04-30" },
        { task: "Implement agent marketplace", priority: "medium", deadline: "2026-05-15" },
        { task: "Add custom agent builder", priority: "low", deadline: "2026-06-15" },
      ],
      lastUpdated: now,
    },
    // ─── NEW: Intelligence Engine Modules ─────────────────────────
    {
      id: "artist-intelligence",
      name: "Artist Intelligence Engine",
      route: "/api/artist-intel",
      category: "Intelligence",
      status: "live",
      healthScore: 95,
      completedFeatures: [
        "Cross-platform artist search (Spotify + YouTube)",
        "Multi-platform stats (followers, popularity, subscribers, views)",
        "Geographic listener distribution (genre-to-region mapping)",
        "Growth rate analysis with trend classification",
        "Similar artists discovery (Fans Also Like graph)",
        "Genre competitor analysis with market position",
        "Career stage classification (6 tiers)",
        "7 API endpoints at /api/artist-intel/*",
      ],
      improvements: [
        { task: "Add historical data snapshots for true growth tracking", priority: "medium", deadline: "2026-05-15" },
        { task: "Integrate Apple Music stats", priority: "low", deadline: "2026-06-01" },
      ],
      lastUpdated: now,
    },
    {
      id: "playlist-chart-intelligence",
      name: "Playlist & Chart Intelligence",
      route: "/api/music-intel",
      category: "Intelligence",
      status: "live",
      healthScore: 92,
      completedFeatures: [
        "Editorial playlist placement tracking",
        "Active playlist enumeration per artist",
        "Genre-based global playlist search",
        "11 Spotify chart definitions (Global, US, MX, ES, GB, BR, DE, FR, CO, AR, Viral 50)",
        "Real-time chart ranking data from Spotify playlist IDs",
        "6 API endpoints at /api/music-intel/*",
      ],
      improvements: [
        { task: "Add Apple Music charts", priority: "medium", deadline: "2026-05-20" },
        { task: "Historical chart position tracking", priority: "low", deadline: "2026-06-15" },
      ],
      lastUpdated: now,
    },
    {
      id: "song-market-intelligence",
      name: "Song DNA & Market Analysis",
      route: "/api/song-intel",
      category: "Intelligence",
      status: "live",
      healthScore: 100,
      completedFeatures: [
        "Song identity resolution (ISRC, Spotify ID, title+artist)",
        "Full Song DNA: audio features, genres, mood, key, tempo",
        "Song performance metrics with stream estimates",
        "Spotify Audio Features (danceability, energy, valence, acousticness, etc.)",
        "Genre-aware audience demographics (age, gender, countries, interests)",
        "Market potential analysis (TAM, penetration, growth gap per city)",
        "Cross-platform song matching (Spotify, Apple Music, Deezer, MusicBrainz, YouTube)",
        "ISRC-based exact matching + text search fallback per platform",
        "Per-platform confidence scoring (exact / high / medium / low)",
        "POST /api/song-intel/cross-platform",
        "Predictive hit potential scoring (multi-factor: D&E, valence, tempo, loudness, artist momentum, genre trend, duration)",
        "Hit grade system: S / A / B / C / D with actionable recommendations",
        "8 API endpoints at /api/song-intel/*",
        "MCP tools: match_song_across_platforms, predict_hit_potential",
      ],
      improvements: [],
      lastUpdated: now,
    },
    {
      id: "tour-intelligence",
      name: "Tour Intelligence & Festivals",
      route: "/api/tour-intel",
      category: "Intelligence",
      status: "live",
      healthScore: 99,
      completedFeatures: [
        "Local opening act discovery (country-filtered, genre-matched)",
        "Strategic opening act finder (high-growth emerging artists)",
        "Festival database (18+ major global festivals across tiers)",
        "Festival search by genre, country, or name",
        "Upcoming festivals feed with genre filtering",
        "Venue search by genre and capacity",
        "Songkick API — artist calendar + metro-area nearby events",
        "Bandsintown API — artist event feed with ticket status",
        "Parallel dual-source fetch with deduplication",
        "GET /api/tour-intel/events/artist — live artist events",
        "GET /api/tour-intel/events/nearby — location-based events",
        "GET /api/tour-intel/events/sources — API config status",
        "Tour routing optimizer — Nearest-Neighbour TSP + 2-opt improvement",
        "Built-in coordinate DB with 200+ music-market cities",
        "Nominatim geocoding fallback for unlisted cities",
        "Per-stop travel mode (drive/train/fly) + hours estimate",
        "Rest-day suggestion logic per leg",
        "Efficiency gain vs. naive input order",
        "POST /api/tour-intel/routing/optimize",
        "9 API endpoints at /api/tour-intel/*",
        "4 new MCP tools: get_artist_live_events, get_nearby_live_events, get_live_event_sources, optimize_tour_route",
      ],
      improvements: [],
      lastUpdated: now,
    },
    {
      id: "mcp-server",
      name: "MCP Server (AI Agent Protocol)",
      route: "/api/mcp",
      category: "Intelligence",
      status: "live",
      healthScore: 88,
      completedFeatures: [
        "26 AI agent tools exposed via MCP protocol",
        "HTTP + SSE transport support",
        "Tool categories: artist-intel, playlist, chart, song, tour, content, audio, voice, distribution",
        "Tool execution engine with dynamic imports",
        "Tool listing and category browsing endpoints",
        "Streaming SSE execution endpoint",
        "Server info and documentation endpoint",
      ],
      improvements: [
        { task: "Add API key auth for external agent access", priority: "high", deadline: "2026-05-05" },
        { task: "Add Stdio transport for local agent use", priority: "medium", deadline: "2026-05-20" },
        { task: "Rate limiting per tool category", priority: "medium", deadline: "2026-05-15" },
      ],
      lastUpdated: now,
    },
  ];
}

// ─── GET /api/admin/reports/diagnostics ──────────────────────────
router.get("/diagnostics", (_req: Request, res: Response) => {
  try {
    const diagnostics = getPlatformDiagnostics();
    const appliedTasks = getAppliedTaskNames();

    // Filter out completed tasks & move them to completedFeatures
    for (const page of diagnostics) {
      const done = page.improvements.filter(imp => appliedTasks.has(imp.task));
      page.completedFeatures.push(...done.map(d => `✅ ${d.task}`));
      page.improvements = page.improvements.filter(imp => !appliedTasks.has(imp.task));
      // Boost health score for completed improvements
      page.healthScore = Math.min(100, page.healthScore + done.length * 5);
    }

    const avgScore = Math.round(diagnostics.reduce((a, d) => a + d.healthScore, 0) / diagnostics.length);
    const totalImprovements = diagnostics.reduce((a, d) => a + d.improvements.length, 0);
    const criticalItems = diagnostics.reduce((a, d) => a + d.improvements.filter(i => i.priority === "critical" || i.priority === "high").length, 0);

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      summary: {
        totalPages: diagnostics.length,
        averageHealthScore: avgScore,
        totalImprovements: totalImprovements,
        criticalHighItems: criticalItems,
        livePages: diagnostics.filter(d => d.status === "live").length,
        betaPages: diagnostics.filter(d => d.status === "beta").length,
      },
      diagnostics,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/admin/reports/diagnostics/:pageId ──────────────────
// Single-page diagnostic — lightweight endpoint for per-page use
router.get("/diagnostics/:pageId", (req: Request, res: Response) => {
  try {
    const { pageId } = req.params;
    const allDiagnostics = getPlatformDiagnostics();
    const page = allDiagnostics.find(d => d.id === pageId);
    if (!page) {
      return res.status(404).json({ success: false, error: `Page '${pageId}' not found` });
    }

    // Filter out completed tasks
    const appliedTasks = getAppliedTaskNames(pageId);
    const done = page.improvements.filter(imp => appliedTasks.has(imp.task));
    page.completedFeatures.push(...done.map(d => `✅ ${d.task}`));
    page.improvements = page.improvements.filter(imp => !appliedTasks.has(imp.task));
    page.healthScore = Math.min(100, page.healthScore + done.length * 5);

    res.json({
      success: true,
      generatedAt: new Date().toISOString(),
      diagnostic: page,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/admin/reports/send-email ──────────────────────────
router.post("/send-email", async (req: Request, res: Response) => {
  try {
    const { recipients, subject, reportHtml } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ success: false, error: "Recipients required" });
    }
    if (!subject || !reportHtml) {
      return res.status(400).json({ success: false, error: "Subject and reportHtml required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of recipients) {
      if (!emailRegex.test(email)) {
        return res.status(400).json({ success: false, error: `Invalid email: ${email}` });
      }
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    if (!BREVO_API_KEY) {
      return res.status(500).json({ success: false, error: "Email service not configured" });
    }

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: "info@boostifymusic.com", name: "Boostify Admin" },
        to: recipients.map((email: string) => ({ email })),
        subject,
        htmlContent: reportHtml,
      }),
    });

    const result = await response.json();

    if (result.messageId) {
      res.json({ success: true, messageId: result.messageId });
    } else {
      res.status(500).json({ success: false, error: result.message || "Failed to send email" });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/admin/reports/competitive-scan ────────────────────
// OpenClaw competitive intelligence scan
router.post("/competitive-scan", async (req: Request, res: Response) => {
  try {
    const { category } = req.body; // "competitors" | "technologies" | "trends"

    const openaiKey = process.env.OPENAI_API_KEY;

    // Generate competitive intelligence report
    const competitorData = getCompetitiveIntelligence(category || "all");

    if (openaiKey) {
      try {
        const { createTrackedOpenAI } = await import("../utils/tracked-openai");
        const openai = createTrackedOpenAI({ apiKey: openaiKey });
        const completion = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [
            {
              role: "system",
              content: `You are a competitive intelligence analyst for Boostify Music, an AI-powered music industry platform. Analyze the competitive landscape and provide actionable insights. Format with markdown headers and bullet points. Current date: ${new Date().toISOString().split("T")[0]}.`
            },
            {
              role: "user",
              content: `Provide a competitive intelligence report for category: ${category || "all"}. 
              
              Current known data:
              ${JSON.stringify(competitorData, null, 2)}
              
              Include:
              1. Competitor Analysis (DistroKid, TuneCore, CD Baby, Amuse, UnitedMasters, Linkfire, Chartmetric)
              2. Technology Trends (AI in music, Web3 music, social growth tools)
              3. Market Opportunities
              4. Threats & Risks
              5. Recommended Actions with deadlines
              6. How Boostify stays ahead`
            }
          ],
          max_tokens: 2000,
        });

        return res.json({
          success: true,
          report: completion.choices[0].message.content,
          data: competitorData,
          generatedAt: new Date().toISOString(),
          aiPowered: true,
          savedAs: saveReport({ type: "competitive", generatedAt: new Date().toISOString(), category, report: completion.choices[0].message.content, data: competitorData, aiPowered: true }, "competitive"),
        });
      } catch (aiErr: any) {
        console.error("AI scan failed, using static data:", aiErr.message);
      }
    }

    // Fallback: static competitive data
    const staticReport = generateStaticReport(competitorData);
    res.json({
      success: true,
      report: staticReport,
      data: competitorData,
      generatedAt: new Date().toISOString(),
      aiPowered: false,
      savedAs: saveReport({ type: "competitive", generatedAt: new Date().toISOString(), category, report: staticReport, data: competitorData, aiPowered: false }, "competitive"),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function getCompetitiveIntelligence(category: string) {
  return {
    competitors: [
      { name: "DistroKid", focus: "Music distribution", pricing: "$22.99/yr", weakness: "No AI growth tools", threat: "high" },
      { name: "TuneCore", focus: "Distribution + publishing", pricing: "$9.99/single", weakness: "Expensive per-release model", threat: "medium" },
      { name: "CD Baby", focus: "Distribution + sync licensing", pricing: "$9.95/single", weakness: "Outdated UI, slow innovation", threat: "low" },
      { name: "Amuse", focus: "Free distribution + label", pricing: "Free-$60/yr", weakness: "Limited analytics", threat: "medium" },
      { name: "UnitedMasters", focus: "Distribution + brand deals", pricing: "Free-$5.99/mo", weakness: "US-centric", threat: "medium" },
      { name: "Chartmetric", focus: "Music analytics", pricing: "$120+/mo", weakness: "Analytics only, no growth tools", threat: "low" },
      { name: "Linkfire", focus: "Smart links + insights", pricing: "$9.99/mo", weakness: "Single feature product", threat: "low" },
      { name: "Hypeddit", focus: "Music promotion", pricing: "Free-$18/mo", weakness: "Limited to pre-saves", threat: "medium" },
    ],
    technologies: [
      { tech: "AI Music Generation", status: "Boostify has it", leaders: ["Suno", "Udio", "AIVA"], opportunity: "Differentiate with artist-specific training" },
      { tech: "AI Video Generation", status: "Boostify has it", leaders: ["Runway", "Kling", "Sora"], opportunity: "Music-specific video templates" },
      { tech: "Web3/NFTs for Music", status: "Boostify has it (BoostiSwap)", leaders: ["Sound.xyz", "Audius"], opportunity: "Artist tokenization is unique differentiator" },
      { tech: "AI Social Growth", status: "Boostify leads", leaders: ["Later", "Hootsuite"], opportunity: "Platform-specific AI for musicians is niche" },
      { tech: "Print-on-Demand Merch", status: "Boostify has it", leaders: ["Printful", "Spring"], opportunity: "Integrated with artist profile is advantage" },
    ],
    trends: [
      { trend: "AI-assisted songwriting", impact: "high", timeline: "Now", action: "Expand music generator capabilities" },
      { trend: "Short-form video dominance", impact: "high", timeline: "Now", action: "Add TikTok/Reels auto-generation" },
      { trend: "Fan tokenization", impact: "medium", timeline: "2026-2027", action: "Expand BoostiSwap features" },
      { trend: "Virtual concerts & metaverse", impact: "medium", timeline: "2026-2028", action: "Research VR integration" },
      { trend: "AI voice cloning for artists", impact: "high", timeline: "Now", action: "Add voice cloning tool" },
      { trend: "Decentralized music streaming", impact: "low", timeline: "2027+", action: "Monitor Audius, Emanate" },
    ],
    boostifyAdvantages: [
      "All-in-one platform (no competitor offers everything)",
      "AI-native from day one",
      "Independent standalone tools model (pay only what you need)",
      "Web3 integration (BoostiSwap, NFT minting)",
      "20+ tools vs competitors' 1-3 features",
      "Aggressive pricing ($12-19/mo vs $120+/mo for analytics alone)",
    ],
  };
}

function generateStaticReport(data: ReturnType<typeof getCompetitiveIntelligence>): string {
  return `# Competitive Intelligence Report
## Generated: ${new Date().toISOString().split("T")[0]}

### Competitor Landscape
${data.competitors.map(c => `- **${c.name}** (${c.focus}) - ${c.pricing} | Threat: ${c.threat} | Weakness: ${c.weakness}`).join("\n")}

### Technology Position
${data.technologies.map(t => `- **${t.tech}**: ${t.status} | Opportunity: ${t.opportunity}`).join("\n")}

### Market Trends
${data.trends.map(t => `- **${t.trend}** (Impact: ${t.impact}, Timeline: ${t.timeline}) → ${t.action}`).join("\n")}

### Boostify Competitive Advantages
${data.boostifyAdvantages.map(a => `- ${a}`).join("\n")}

### Recommended Actions
1. **Immediate**: Complete webhook handlers for all standalone products (Apr 12)
2. **Short-term**: Add usage limits and subscription banners (Apr 15-20)
3. **Medium-term**: Launch TikTok Boost as 4th standalone tool (May 2026)
4. **Strategic**: Expand AI agent marketplace (Q3 2026)
`;
}

// ─── Implementation Prompts Generator ───────────────────────────
function generateImplementationPrompts(diagnostics: PageDiagnostic[]): { pageId: string; pageName: string; prompts: { task: string; priority: string; prompt: string }[] }[] {
  return diagnostics.map((page) => ({
    pageId: page.id,
    pageName: page.name,
    prompts: page.improvements.map((imp) => ({
      task: imp.task,
      priority: imp.priority,
      prompt: buildPromptForTask(page, imp),
    })),
  }));
}

function buildPromptForTask(page: PageDiagnostic, imp: { task: string; priority: string; deadline: string }): string {
  const base = `You are working on the Boostify Music platform. The page "${page.name}" (route: ${page.route}, category: ${page.category}) currently has a health score of ${page.healthScore}%. `;
  const features = `Already completed features: ${page.completedFeatures.join(", ")}. `;
  const taskDesc = `\n\nTASK: ${imp.task}\nPriority: ${imp.priority.toUpperCase()}\nDeadline: ${imp.deadline}\n\n`;

  const instructions: Record<string, string> = {
    "Add usage limits hook for free tier daily caps": `Create a new React hook \`use-instagram-boost-limits.ts\` in client/src/hooks/ that:
1. Fetches the user's current subscription tier from /api/auth/user
2. Defines daily/monthly limits per tier (free: 5 actions/day, pro: unlimited)
3. Tracks usage via localStorage with daily reset
4. Returns { canUse, remaining, limit, tier, isLoading }
5. Shows a toast when limit is reached suggesting upgrade
Reference the existing \`use-spotify-boost-limits.ts\` for pattern consistency.`,

    "Implement subscription banner component": `Create a SubscriptionBanner component for ${page.name} that:
1. Shows when user is on free tier
2. Displays remaining daily actions and progress bar
3. Has "Upgrade to Pro" CTA linking to the standalone pricing modal
4. Matches the gradient style: orange-500 to red-500
5. Auto-hides after upgrade via subscription check
Reference existing subscription-banner.tsx in spotify-boost for pattern.`,

    "Create use-youtube-boost-limits.ts hook": `Create client/src/hooks/use-youtube-boost-limits.ts following the exact pattern of use-spotify-boost-limits.ts:
1. Define YouTube-specific limits (free: 5 tools/day, pro: unlimited)
2. Add tier detection from user subscription data
3. Track usage in localStorage with key "yt_boost_usage"
4. Export { canUse, remaining, limit, tier, isLoading, trackUsage }`,

    "Webhook handler for ig_boost_pro subscription events": `In server/routes/stripe.ts, add webhook handling for ig_boost_pro:
1. Listen for checkout.session.completed with metadata.product === "ig_boost_pro"
2. Update user's subscription status in the database
3. Set tier = "pro" and subscription period dates
4. Send confirmation email via Brevo API
5. Log the event for analytics`,

    "Webhook handler for spotify_boost_pro events": `In server/routes/stripe.ts, add webhook case for spotify_boost_pro:
1. On checkout.session.completed, extract plan from metadata
2. Update users table: spotifyBoostTier = "pro", spotifyBoostExpiry = +30 days
3. Send welcome email with Brevo
4. Trigger analytics event`,

    "Webhook handler for youtube_boost events": `In server/routes/stripe.ts, add webhook handling for youtube_boost_pro:
1. On checkout.session.completed with metadata.product === "youtube_boost_pro"
2. Set youtubeBoostTier = "pro" in user record
3. Send confirmation email
4. Enable all 12 AI tools for the user`,

    "Add content moderation AI": `Create server/routes/content-moderation.ts:
1. Use OpenAI moderation API endpoint
2. Check all user-generated content (posts, comments, profile text)
3. Auto-flag content with high toxicity scores
4. Create moderation queue UI in admin panel
5. Add webhook to notify admin of flagged content
This is CRITICAL priority - implement immediately.`,
  };

  const specific = instructions[imp.task];
  if (specific) {
    return base + features + taskDesc + "IMPLEMENTATION INSTRUCTIONS:\n" + specific;
  }

  // Generic prompt for tasks without specific instructions
  return base + features + taskDesc + `IMPLEMENTATION INSTRUCTIONS:
1. Analyze the current codebase for ${page.name} at ${page.route}
2. Identify the exact files that need modification
3. Implement ${imp.task} following existing patterns in the codebase
4. Ensure TypeScript types are correct (no \`any\` where avoidable)
5. Add proper error handling
6. Test the implementation
7. Maintain the existing UI style (dark theme, orange-500 accents, slate backgrounds)`;
}

// ─── Save Report to Disk ────────────────────────────────────────
function saveReport(reportData: any, reportType: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${reportType}_${timestamp}.json`;
  const filepath = path.join(REPORTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(reportData, null, 2), "utf-8");
  console.log(`📄 Report saved: ${filepath}`);
  return filename;
}

// ─── Send Email via Brevo ───────────────────────────────────────
async function sendBrevoEmail(recipients: string[], subject: string, htmlContent: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) return { success: false, error: "BREVO_API_KEY not set" };

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { email: "info@boostifymusic.com", name: "Boostify Admin" },
        to: recipients.map((email) => ({ email })),
        subject,
        htmlContent,
      }),
    });

    const result = await response.json();
    if (result.messageId) {
      return { success: true, messageId: result.messageId };
    }
    return { success: false, error: result.message || "Unknown Brevo error" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Generate Full Weekly Email HTML ────────────────────────────
function generateWeeklyEmailHtml(
  diagnostics: PageDiagnostic[],
  competitiveReport: string | null,
  implementationPrompts: ReturnType<typeof generateImplementationPrompts>,
  aiPowered: boolean,
): string {
  const now = new Date();
  const avgScore = Math.round(diagnostics.reduce((a, d) => a + d.healthScore, 0) / diagnostics.length);
  const totalImprovements = diagnostics.reduce((a, d) => a + d.improvements.length, 0);
  const criticalItems = diagnostics.reduce((a, d) => a + d.improvements.filter(i => i.priority === "critical" || i.priority === "high").length, 0);

  let html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 900px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #fb923c; font-size: 28px; margin: 0;">🔥 Boostify Weekly Intelligence Report</h1>
        <p style="color: #94a3b8; font-size: 14px;">Week of ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        <p style="color: #64748b; font-size: 12px;">Auto-generated by OpenClaw Engine</p>
      </div>

      <!-- Summary Cards -->
      <div style="display: flex; gap: 12px; margin-bottom: 28px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 100px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #fb923c;">${diagnostics.length}</div>
          <div style="font-size: 11px; color: #94a3b8;">Pages</div>
        </div>
        <div style="flex: 1; min-width: 100px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: ${avgScore >= 75 ? '#4ade80' : '#fbbf24'};">${avgScore}%</div>
          <div style="font-size: 11px; color: #94a3b8;">Health</div>
        </div>
        <div style="flex: 1; min-width: 100px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #f87171;">${criticalItems}</div>
          <div style="font-size: 11px; color: #94a3b8;">Critical/High</div>
        </div>
        <div style="flex: 1; min-width: 100px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; text-align: center;">
          <div style="font-size: 24px; font-weight: bold; color: #fbbf24;">${totalImprovements}</div>
          <div style="font-size: 11px; color: #94a3b8;">Tasks</div>
        </div>
      </div>

      <!-- Section 1: Page Diagnostics -->
      <h2 style="color: #fb923c; font-size: 20px; border-bottom: 2px solid #334155; padding-bottom: 8px; margin-top: 0;">📊 Platform Diagnostics</h2>
  `;

  for (const page of diagnostics) {
    const scoreColor = page.healthScore >= 80 ? "#4ade80" : page.healthScore >= 60 ? "#fbbf24" : "#f87171";
    const statusBadge = page.status === "live" ? "🟢" : page.status === "beta" ? "🟣" : "🟡";
    html += `
      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin: 10px 0;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="color: #f1f5f9; margin: 0; font-size: 15px;">${statusBadge} ${page.name}</h3>
          <span style="color: ${scoreColor}; font-weight: bold; font-size: 18px;">${page.healthScore}%</span>
        </div>
        <p style="color: #94a3b8; font-size: 11px; margin: 4px 0;">${page.route} · ${page.category}</p>
        <div style="background: #0f172a; border-radius: 4px; height: 6px; margin: 8px 0; overflow: hidden;">
          <div style="height: 100%; width: ${page.healthScore}%; background: ${scoreColor}; border-radius: 4px;"></div>
        </div>
        ${page.improvements.length > 0 ? `
          <div style="margin-top: 10px;">
            ${page.improvements.map((imp) => {
              const pColor = imp.priority === "critical" ? "#f87171" : imp.priority === "high" ? "#fb923c" : imp.priority === "medium" ? "#fbbf24" : "#60a5fa";
              const isOverdue = new Date(imp.deadline) < now;
              return `<div style="display: flex; align-items: center; gap: 8px; margin: 3px 0; font-size: 12px;">
                <span style="color: ${pColor}; font-weight: 700; text-transform: uppercase; font-size: 10px; min-width: 55px;">[${imp.priority}]</span>
                <span style="color: #e2e8f0; flex: 1;">${imp.task}</span>
                <span style="color: ${isOverdue ? '#f87171' : '#94a3b8'}; font-size: 10px;">${isOverdue ? '⚠ OVERDUE ' : ''}${imp.deadline}</span>
              </div>`;
            }).join("")}
          </div>
        ` : ""}
      </div>
    `;
  }

  // Section 2: Competitive Intelligence
  if (competitiveReport) {
    html += `
      <h2 style="color: #fb923c; font-size: 20px; border-bottom: 2px solid #334155; padding-bottom: 8px; margin-top: 32px;">🔍 OpenClaw Competitive Intelligence</h2>
      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; font-size: 12px; line-height: 1.7;">
        ${competitiveReport.replace(/\n/g, "<br>").replace(/^#+\s*(.+)/gm, '<strong style="color: #fb923c;">$1</strong>')}
      </div>
      ${aiPowered ? '<p style="color: #a78bfa; font-size: 11px; text-align: right;">🤖 AI-Powered by GPT-4o-mini</p>' : ''}
    `;
  }

  // Section 3: Implementation Prompts
  html += `
    <h2 style="color: #fb923c; font-size: 20px; border-bottom: 2px solid #334155; padding-bottom: 8px; margin-top: 32px;">🛠️ Implementation Prompts</h2>
    <p style="color: #94a3b8; font-size: 12px; margin-bottom: 12px;">Copy these prompts into your AI assistant to implement each task:</p>
  `;

  for (const pagePrompts of implementationPrompts) {
    if (pagePrompts.prompts.length === 0) continue;
    html += `
      <div style="margin: 16px 0;">
        <h3 style="color: #f1f5f9; font-size: 14px; margin-bottom: 8px;">📄 ${pagePrompts.pageName}</h3>
    `;
    for (const p of pagePrompts.prompts) {
      const pColor = p.priority === "critical" ? "#f87171" : p.priority === "high" ? "#fb923c" : p.priority === "medium" ? "#fbbf24" : "#60a5fa";
      html += `
        <div style="background: #0f172a; border: 1px solid #334155; border-left: 3px solid ${pColor}; border-radius: 6px; padding: 12px; margin: 8px 0;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <strong style="color: #e2e8f0; font-size: 12px;">${p.task}</strong>
            <span style="color: ${pColor}; font-size: 10px; text-transform: uppercase; font-weight: 700;">${p.priority}</span>
          </div>
          <pre style="background: #1e293b; border: 1px solid #334155; border-radius: 4px; padding: 10px; font-size: 11px; color: #cbd5e1; white-space: pre-wrap; word-wrap: break-word; margin: 0; font-family: 'SF Mono', Monaco, monospace; line-height: 1.5;">${p.prompt.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
        </div>
      `;
    }
    html += `</div>`;
  }

  html += `
      <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #334155;">
        <p style="color: #fb923c; font-size: 13px; font-weight: 600;">Boostify Music · Enterprise Control Hub</p>
        <p style="color: #64748b; font-size: 11px;">Auto-sent weekly · Next report in 7 days</p>
      </div>
    </div>
  `;
  return html;
}

// ─── Run Full Weekly Report ─────────────────────────────────────
async function runWeeklyReport(): Promise<{ success: boolean; filename?: string; emailResult?: any; error?: string }> {
  console.log("📧 [WeeklyReport] Running weekly report generation...");

  try {
    // 1. Get diagnostics
    const diagnostics = getPlatformDiagnostics();

    // 2. Get competitive intelligence (with AI if available)
    let competitiveReport: string | null = null;
    let aiPowered = false;
    const competitorData = getCompetitiveIntelligence("all");

    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      try {
        const { createTrackedOpenAI } = await import("../utils/tracked-openai");
        const openai = createTrackedOpenAI({ apiKey: openaiKey });
        const completion = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [
            {
              role: "system",
              content: `You are a competitive intelligence analyst for Boostify Music, an AI-powered music industry platform. Provide a comprehensive weekly competitive analysis with actionable insights. Current date: ${new Date().toISOString().split("T")[0]}.`
            },
            {
              role: "user",
              content: `Generate a weekly competitive intelligence report for Boostify Music.
              
              Current data: ${JSON.stringify(competitorData, null, 2)}
              
              Include:
              1. Key Market Movements This Week
              2. Competitor Updates (DistroKid, TuneCore, CD Baby, Amuse, UnitedMasters, Chartmetric, Linkfire, Hypeddit)
              3. Technology Trends & Opportunities
              4. Threats & Risks
              5. Recommended Actions with deadlines
              6. Strategic Priorities for Next Week`
            }
          ],
          max_tokens: 2500,
        });
        competitiveReport = completion.choices[0].message.content || null;
        aiPowered = true;
      } catch (aiErr: any) {
        console.error("[WeeklyReport] AI competitive scan failed:", aiErr.message);
      }
    }

    if (!competitiveReport) {
      competitiveReport = generateStaticReport(competitorData);
    }

    // 3. Generate implementation prompts
    const implementationPrompts = generateImplementationPrompts(diagnostics);

    // 4. Build email HTML
    const emailHtml = generateWeeklyEmailHtml(diagnostics, competitiveReport, implementationPrompts, aiPowered);

    // 5. Save report to disk
    const reportPayload = {
      generatedAt: new Date().toISOString(),
      type: "weekly",
      diagnostics,
      competitiveReport,
      aiPowered,
      implementationPrompts,
      recipient: WEEKLY_RECIPIENT,
    };
    const filename = saveReport(reportPayload, "weekly");

    // 6. Send email
    const subject = `🔥 Boostify Weekly Report — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const emailResult = await sendBrevoEmail([WEEKLY_RECIPIENT], subject, emailHtml);

    if (emailResult.success) {
      console.log(`✅ [WeeklyReport] Sent to ${WEEKLY_RECIPIENT}, messageId: ${emailResult.messageId}`);
    } else {
      console.error(`❌ [WeeklyReport] Email failed: ${emailResult.error}`);
    }

    return { success: true, filename, emailResult };
  } catch (err: any) {
    console.error(`❌ [WeeklyReport] Error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ─── Platform Metrics (Live Data) ───────────────────────────────
router.get('/platform-metrics', async (_req: Request, res: Response) => {
  try {
    // ── PostgreSQL queries (parallel) ──
    const [
      usersResult,
      activeSubsResult,
      allSubsResult,
      songsResult,
      paymentsResult,
      investorsResult,
      coursesResult,
      campaignsResult,
      musiciansResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(subscriptions).where(eq(subscriptions.status, 'active')),
      db.select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        count: sql<number>`count(*)::int`,
      }).from(subscriptions).groupBy(subscriptions.plan, subscriptions.status),
      db.select({ count: sql<number>`count(*)::int` }).from(songs),
      db.select({
        total: sql<string>`COALESCE(SUM(amount), 0)`,
        count: sql<number>`count(*)::int`,
      }).from(payments),
      db.select({ count: sql<number>`count(*)::int` }).from(investors),
      db.select({ count: sql<number>`count(*)::int` }).from(courses),
      db.select({ count: sql<number>`count(*)::int` }).from(crowdfundingCampaigns),
      db.select({ count: sql<number>`count(*)::int` }).from(musicians),
    ]);

    // ── Firestore queries (subscription events for growth) ──
    let recentEvents = 0;
    let firestoreSubscriptions = 0;
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const eventsSnap = await firebaseDb.collection('subscription_events')
        .where('timestamp', '>=', thirtyDaysAgo)
        .get();
      recentEvents = eventsSnap.size;

      const fsSubsSnap = await firebaseDb.collection('subscriptions')
        .where('status', '==', 'active')
        .get();
      firestoreSubscriptions = fsSubsSnap.size;
    } catch (fsErr) {
      console.warn('⚠️ [PlatformMetrics] Firestore query failed (non-critical):', fsErr);
    }

    // ── Build subscription breakdown ──
    const subsByPlan: Record<string, { active: number; total: number }> = {};
    for (const row of allSubsResult) {
      if (!subsByPlan[row.plan]) subsByPlan[row.plan] = { active: 0, total: 0 };
      subsByPlan[row.plan].total += row.count;
      if (row.status === 'active') subsByPlan[row.plan].active += row.count;
    }

    const totalUsers = usersResult[0]?.count || 0;
    const activeSubscriptions = activeSubsResult[0]?.count || 0;
    const totalRevenue = parseFloat(paymentsResult[0]?.total || '0');

    // ── Monthly growth estimate (based on recent subscription events) ──
    const growthPct = totalUsers > 0
      ? Math.round((recentEvents / Math.max(totalUsers, 1)) * 100)
      : 0;

    res.json({
      success: true,
      metrics: {
        // Top-level stat cards
        totalUsers,
        totalArtists: musiciansResult[0]?.count || 0,
        totalSongs: songsResult[0]?.count || 0,
        activeSubscriptions: activeSubscriptions + firestoreSubscriptions,
        totalInvestors: investorsResult[0]?.count || 0,
        totalCourses: coursesResult[0]?.count || 0,
        totalCampaigns: campaignsResult[0]?.count || 0,
        totalPayments: paymentsResult[0]?.count || 0,
        totalRevenue: Math.round(totalRevenue * 100) / 100,

        // Subscription breakdown
        subscriptionsByPlan: subsByPlan,

        // Growth
        recentEvents30d: recentEvents,
        monthlyGrowthPct: growthPct,

        // Firestore boost subscriptions
        firestoreActiveSubscriptions: firestoreSubscriptions,

        // Timestamp
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ [PlatformMetrics] Error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

// ─── Weekly Scheduler ───────────────────────────────────────────
let weeklyTimer: ReturnType<typeof setInterval> | null = null;
let nextScheduledRun: Date | null = null;
let lastRunResult: any = null;

// Persisted state so server restarts don't re-send the report
const SCHEDULER_STATE_FILE = path.join(REPORTS_DIR, "weekly-scheduler-state.json");

function readLastSentWeekKey(): string | null {
  try {
    if (!fs.existsSync(SCHEDULER_STATE_FILE)) return null;
    const raw = fs.readFileSync(SCHEDULER_STATE_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return typeof parsed?.lastSentWeekKey === "string" ? parsed.lastSentWeekKey : null;
  } catch {
    return null;
  }
}

function writeLastSentWeekKey(weekKey: string) {
  try {
    fs.writeFileSync(
      SCHEDULER_STATE_FILE,
      JSON.stringify({ lastSentWeekKey: weekKey, updatedAt: new Date().toISOString() }, null, 2),
      "utf-8"
    );
  } catch (err: any) {
    console.error("[WeeklyScheduler] Failed to persist state:", err?.message);
  }
}

// ISO week key (e.g. "2026-W17") — unique per calendar week
function getISOWeekKey(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// Next Monday at 09:00 local time
function getNextMonday9am(from: Date = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun .. 6=Sat
  const daysUntilMonday = (1 - day + 7) % 7 || 7; // always future Monday
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function startWeeklyReportScheduler() {
  console.log("⏰ [WeeklyScheduler] Starting TRUE weekly report scheduler (Mondays 09:00, max 1/week)...");
  console.log(`📧 [WeeklyScheduler] Reports will be sent to: ${WEEKLY_RECIPIENT}`);

  let lastSentWeekKey = readLastSentWeekKey();
  console.log(`⏰ [WeeklyScheduler] Last sent week: ${lastSentWeekKey ?? "(never)"}`);

  const trySend = async (reason: string) => {
    const now = new Date();
    const currentWeek = getISOWeekKey(now);
    if (lastSentWeekKey === currentWeek) {
      // Already sent this ISO week — skip
      return;
    }
    // Only send on Monday after 09:00 local time (avoid startup bursts)
    if (now.getDay() !== 1 || now.getHours() < 9) {
      return;
    }
    console.log(`⏰ [WeeklyScheduler] Triggering weekly report (${reason}) — week ${currentWeek}`);
    lastRunResult = await runWeeklyReport();
    if (lastRunResult?.success) {
      lastSentWeekKey = currentWeek;
      writeLastSentWeekKey(currentWeek);
    }
    nextScheduledRun = getNextMonday9am(new Date());
    console.log(`⏰ [WeeklyScheduler] Next scheduled run: ${nextScheduledRun.toISOString()}`);
  };

  nextScheduledRun = getNextMonday9am(new Date());
  console.log(`⏰ [WeeklyScheduler] Next scheduled run: ${nextScheduledRun.toISOString()}`);

  // Check once per hour whether it's time to send (Monday 09:xx in a new ISO week).
  // Never send on startup — only on the scheduled Monday slot.
  weeklyTimer = setInterval(() => {
    trySend("hourly-tick").catch(err =>
      console.error("[WeeklyScheduler] tick error:", err?.message)
    );
  }, 60 * 60 * 1000);
}

// ─── POST /api/admin/reports/trigger-weekly ─────────────────────
// Manually trigger the weekly report
router.post("/trigger-weekly", async (_req: Request, res: Response) => {
  try {
    console.log("🔄 [ManualTrigger] Weekly report triggered manually");
    const result = await runWeeklyReport();
    lastRunResult = result;
    nextScheduledRun = new Date(Date.now() + WEEKLY_INTERVAL_MS);
    const { success: _, ...rest } = result;
    res.json({ success: true, ...rest, nextScheduledRun: nextScheduledRun.toISOString() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/admin/reports/schedule-status ─────────────────────
router.get("/schedule-status", (_req: Request, res: Response) => {
  res.json({
    success: true,
    recipient: WEEKLY_RECIPIENT,
    intervalDays: 7,
    nextScheduledRun: nextScheduledRun?.toISOString() || null,
    lastRunResult: lastRunResult ? {
      success: lastRunResult.success,
      filename: lastRunResult.filename,
      emailSent: lastRunResult.emailResult?.success || false,
      error: lastRunResult.error,
      ranAt: lastRunResult.filename ? lastRunResult.filename.split("_").slice(1).join("_").replace(".json", "").replace(/-/g, ":").slice(0, -3) : null,
    } : null,
    schedulerActive: weeklyTimer !== null,
  });
});

// ─── POST /api/admin/reports/generate-prompts ───────────────────
router.post("/generate-prompts", async (req: Request, res: Response) => {
  try {
    const { pageId } = req.body; // optional: filter to specific page
    const diagnostics = getPlatformDiagnostics();
    const filtered = pageId ? diagnostics.filter(d => d.id === pageId) : diagnostics;
    const prompts = generateImplementationPrompts(filtered);

    // Save prompts
    const filename = saveReport({ generatedAt: new Date().toISOString(), type: "prompts", prompts }, "prompts");

    res.json({ success: true, prompts, filename });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/admin/reports/saved ───────────────────────────────
router.get("/saved", (_req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => f.endsWith(".json"))
      .sort((a, b) => b.localeCompare(a)) // newest first
      .slice(0, 50);

    const reports = files.map(f => {
      const filepath = path.join(REPORTS_DIR, f);
      const stats = fs.statSync(filepath);
      const data = JSON.parse(fs.readFileSync(filepath, "utf-8"));
      return {
        filename: f,
        type: data.type || "unknown",
        generatedAt: data.generatedAt,
        size: stats.size,
        aiPowered: data.aiPowered || false,
      };
    });

    res.json({ success: true, reports, total: reports.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/admin/reports/saved/:filename ─────────────────────
router.get("/saved/:filename", (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    // Prevent path traversal
    const safe = path.basename(filename);
    const filepath = path.join(REPORTS_DIR, safe);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }
    const data = JSON.parse(fs.readFileSync(filepath, "utf-8"));
    res.json({ success: true, report: data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
