console.log('[BOOT] Loading dotenv...');
import 'dotenv/config';
console.log('[BOOT] Loading express...');
import express from "express";
import type { Request, Response, NextFunction } from "express";
console.log('[BOOT] Loading routes...');
import { registerRoutes } from "./routes";
console.log('[BOOT] Loading logger...');
import { log } from "./logger";
console.log('[BOOT] Loading path utilities...');
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs';
import fileUpload from 'express-fileupload';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { audit, auditFromReq } from './utils/audit-logger';
import { isAdminEmail } from '../shared/constants';
import { db as pgDb } from './db';
import { users, artistNews, artistFanLeads, songs } from '@db/schema';
import { eq, and, lte, lt } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import { sendFanDay3Email, sendFanDay7Email } from './services/brevo-email-service';
console.log('[BOOT] All imports completed');

// Global error handlers to prevent server from crashing
process.on('uncaughtException', (err: any) => {
  // Ignore EPIPE errors (broken pipe on stdout/stderr — happens in PowerShell terminals)
  if (err.code === 'EPIPE') return;
  console.error('❌ Uncaught Exception:', err.message);
  console.error(err.stack);
  // Don't exit - let the server keep running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - let the server keep running
});

// Ignore EPIPE errors on stdout/stderr (broken pipe when PowerShell terminal overflows)
process.stdout.on('error', (err: any) => { if (err.code !== 'EPIPE') console.error('stdout error:', err.message); });
process.stderr.on('error', (err: any) => { if (err.code !== 'EPIPE') console.error('stderr error:', err.message); });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Detect deployment environment
// Use NODE_ENV from environment variables or default to development
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

const isProduction = process.env.NODE_ENV === 'production';
console.log('='.repeat(60));
console.log(`🚀 BOOSTIFY SERVER STARTING`);
console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`Is Production: ${isProduction}`);
console.log(`Working Directory: ${process.cwd()}`);
console.log('='.repeat(60));
log(`🚀 Running in ${process.env.NODE_ENV} mode`);

const app = express();

app.set('trust proxy', 1);

function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === '::1'
    || /^10\./.test(host)
    || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    || /^169\.254\./.test(host)
    || /^fd[0-9a-f]{2}:/i.test(host)
    || /^fc[0-9a-f]{2}:/i.test(host);
}

app.use((req, res, next) => {
  const forceHttps = isProduction || process.env.FORCE_HTTPS === 'true';
  if (!forceHttps) return next();

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0]?.trim().toLowerCase();
  const isSecureRequest = req.secure || forwardedProto === 'https';
  if (isSecureRequest) return next();

  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0]?.trim();
  const hostHeader = forwardedHost || req.headers.host || '';
  const hostname = hostHeader.split(':')[0] || '';
  if (!hostHeader || isLocalOrPrivateHost(hostname)) return next();

  return res.redirect(308, `https://${hostHeader}${req.originalUrl}`);
});

// ═══ CORS — Whitelist allowed origins ═══
const allowedOrigins = [
  'https://boostifymusic.com',
  'https://www.boostifymusic.com',
  process.env.RENDER_EXTERNAL_URL,
  ...(isProduction ? [] : ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:5173']),
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    // Use EXACT origin matching — `startsWith` would let `https://boostifymusic.com.evil.com`
    // pass, which combined with credentials:true is a cross-origin data-leak risk.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ═══ HELMET — Security headers (HSTS, X-Frame, XSS, noSniff, CSP) ═══
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", "https://storage.googleapis.com", "https://*.googleapis.com", "https://www.gstatic.com", "https://*.firebasestorage.app", "https://*.clerk.accounts.dev", "https://*.clerk.com", "https://challenges.cloudflare.com", "https://js.stripe.com", "https://translate.google.com", "https://*.coinbase.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://www.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:", "https://storage.googleapis.com", "https://*.firebasestorage.app", "https://firebasestorage.googleapis.com", "https://*.media-amazon.com", "https://*.ssl-images-amazon.com", "https://m.media-amazon.com", "https://images-na.ssl-images-amazon.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://r2cdn.perplexity.ai", "https://frontend-cdn.perplexity.ai", "data:"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://www.gstatic.com", "https://*.firebaseio.com", "https://*.firebasestorage.app", "https://firebasestorage.googleapis.com", "https://*.freepik.com", "https://api.piapi.ai", "https://api.fal.ai", "https://*.unsplash.com", "wss://*.firebaseio.com", "https://*.clerk.accounts.dev", "https://*.clerk.com", "https://*.stripe.com", "https://*.coinbase.com", "https://1rpc.io", "https://rpc.ankr.com", "https://polygon-rpc.com", "https://polygon-bor-rpc.publicnode.com", "https://*.publicnode.com", "https://api.web3modal.org", "https://api.web3modal.com", "https://pulse.walletconnect.org", "https://pulse.walletconnect.com", "https://relay.walletconnect.org", "https://relay.walletconnect.com", "https://explorer-api.walletconnect.com", "wss://relay.walletconnect.org", "wss://relay.walletconnect.com", "https://*.walletconnect.org", "https://*.walletconnect.com", "wss://*.walletconnect.org", "wss://*.walletconnect.com", "https://*.reown.com", "wss://*.reown.com", "https://picsum.photos", "https://*.picsum.photos", "https://assets.coingecko.com", "https://*.elevenlabs.io", "wss://*.elevenlabs.io", "https://api.elevenlabs.io", "wss://api.elevenlabs.io"],
      manifestSrc: ["'self'", "blob:"],
      mediaSrc: ["'self'", "https:", "blob:", "https://*.firebasestorage.app", "https://*.elevenlabs.io"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'self'", "https://*.clerk.accounts.dev", "https://*.clerk.com", "https://challenges.cloudflare.com", "https://open.spotify.com", "https://*.spotify.com", "https://js.stripe.com", "https://*.stripe.com", "https://*.coinbase.com", "https://app.heygen.com", "https://*.heygen.com"],
    }
  },
  crossOriginEmbedderPolicy: false, // Required for external images/media
  crossOriginOpenerPolicy: false, // Base/Coinbase wallet SDK requires COOP not to be same-origin
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Required for CDN assets
}));

// ═══ RATE LIMITING ═══
const isDev = process.env.NODE_ENV !== 'production';

// General API rate limit
// Artist profile pages fire 15-25 simultaneous requests on load, so production
// limit must be high enough to handle several page refreshes per minute per user.
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDev ? 10000 : 500, // 500/min in prod — handles burst page loads comfortably
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
  skip: (req) => {
    const ip = req.ip || '';
    const shouldSkip = req.path === '/api/health'
      || req.path.startsWith('/api/stripe/webhook')
      || req.path.endsWith('/webhook')
      || req.path.startsWith('/api/investor-docs/demo')  // Public investor documents demo
      || ip === '127.0.0.1'
      || ip === '::1'
      || ip === '::ffff:127.0.0.1';
    
    if (req.path.includes('investor-docs')) {
      console.log('[RATE-LIMITER] investor-docs request:', {
        path: req.path,
        ip: req.ip,
        shouldSkip,
      });
    }
    
    return shouldSkip;
  },
});

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 10000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts, please try again later.' },
  skip: (req) => {
    const ip = req.ip || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
});

// Strict rate limit for AI generation endpoints (expensive operations)
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 10000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'AI generation rate limit reached. Please try again later.' },
  skip: (req) => {
    const ip = req.ip || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  },
});

// Apply rate limiters
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/login', authLimiter);
app.use('/api/music/generate', aiLimiter);
app.use('/api/video/generate', aiLimiter);
app.use('/api/kits-ai/', aiLimiter);
app.use('/api/fashion/', aiLimiter);

// JSON body limit — 10MB default (upload routes handle larger files via fileUpload)
// Videoservice lead endpoint accepts image + audio as base64 in a single request,
// so it needs a larger limit.
app.use('/api/videoservice/lead', express.json({ limit: '75mb' }));
app.use('/api/videoservice/lead', express.urlencoded({ extended: false, limit: '75mb' }));
// Cinematic event media upload accepts base64 video (up to ~5 min) in a single
// JSON request, so it needs a much larger body limit than the global default.
app.use('/api/events/upload-media', express.json({ limit: '400mb' }));
app.use('/api/events/upload-media', express.urlencoded({ extended: false, limit: '400mb' }));
// Stripe webhooks require the raw, unparsed body to verify the signature.
// These must run BEFORE the global express.json parser (express.raw sets
// req._body = true so express.json skips re-parsing them).
app.use('/api/vinyl/webhook', express.raw({ type: 'application/json' }));
app.use('/api/vinyl-editions/webhook', express.raw({ type: 'application/json' }));
app.use('/api/art-gallery/webhook', express.raw({ type: 'application/json' }));
app.use('/api/smart-merch/webhook', express.raw({ type: 'application/json' }));
app.use('/api/crowdsync-dj/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Gestión de errores para express.json
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err && err.type === 'entity.too.large') {
    console.error('Error al procesar JSON: payload demasiado grande');
    return res.status(413).json({
      success: false,
      error: 'La imagen es demasiado grande. El tamaño máximo permitido es 20MB.'
    });
  }
  next(err);
});

// Configure middleware for file processing (100MB limit for audio files)
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  createParentPath: true,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  abortOnLimit: true,
  debug: false
}));

// Manejo de errores para fileUpload
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    console.error('Error al cargar archivo: tamaño excedido');
    return res.status(413).json({
      success: false,
      error: 'El archivo es demasiado grande. El tamaño máximo permitido es 100MB.'
    });
  }
  next(err);
});

// Health check endpoint for monitoring
app.get('/api/health', (req, res) => {
  const healthData = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    build: {
      version: process.env.npm_package_version || 'unknown',
      nodeVersion: process.version
    }
  };
  res.status(200).json(healthData);
});

// AI providers health check endpoint
app.get('/api/health/ai-providers', (req, res) => {
  const providers = {
    openai: {
      configured: !!(process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY),
      keyPrefix: (process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '').slice(0, 7) || null
    },
    openrouter: {
      configured: !!(process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY),
      keyPrefix: (process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '').slice(0, 10) || null,
      freeModels: ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free', 'nousresearch/hermes-3-llama-3.1-405b:free', 'qwen/qwen3-next-80b-a3b-instruct:free', 'google/gemma-4-31b-it:free', 'openai/gpt-oss-20b:free']
    },
    fal: {
      configured: !!(process.env.FAL_KEY || process.env.VITE_FAL_KEY)
    },
    gemini: {
      configured: !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY)
    }
  };
  const fallbackReady = providers.openrouter.configured;
  res.status(200).json({ status: 'ok', fallbackReady, providers });
});

// Basic request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  log(`📥 Incoming request: ${req.method} ${req.path}`);
  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`📤 Response: ${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
  });
  next();
});

(async () => {
  try {
    console.log('🔄 [1/10] Starting server setup...');
    log('🔄 Starting server setup...');

    console.log('🔄 [2/10] Importing environment check...');
    const { checkEnvironment } = await import('./utils/environment-check');
    console.log('🔄 [3/10] Running environment check...');
    checkEnvironment();
    console.log('🔄 [4/10] Environment check completed');
    
    // Log AI model configuration (OpenRouter MiMo primary, OpenAI fallback)
    try {
      const { logAIConfig } = await import('./utils/ai-config');
      logAIConfig();
    } catch (e) { console.warn('⚠️ Could not load AI config'); }
    
    // PUBLIC ROUTES: NFT Metadata API (must be accessible without auth for blockchain/OpenSea)
    console.log('🔗 Setting up public NFT metadata routes...');
    try {
      const nftMetadataRouter = await import('./routes/nft-metadata');
      app.use('/api/metadata', nftMetadataRouter.default);
      console.log('✅ NFT metadata routes configured (public access)');
    } catch (error) {
      console.error('⚠️ NFT metadata routes failed to load:', error);
    }

    // PUBLIC ROUTES: Investor Documents Demo (public access for development)
    console.log('🔗 Setting up public investor documents routes...');
    try {
      const { db } = await import('./firebase');
      app.get('/api/investor-docs/demo/all', async (req, res) => {
        try {
          // Bounded read: cap the page so this never becomes a full-collection scan.
          const snapshot = await db.collection('investor_documents').limit(200).get();
          const documents: any[] = [];
          snapshot.forEach(docSnap => {
            documents.push({ id: docSnap.id, ...docSnap.data() });
          });
          res.json({ success: true, documents });
        } catch (error) {
          console.error('[investor-docs] GET demo documents error:', error);
          res.status(500).json({ error: 'Failed to fetch demo documents' });
        }
      });
      console.log('✅ Public investor documents endpoint configured (demo/all)');
    } catch (error) {
      console.error('⚠️ Investor documents public routes failed to load:', error);
    }

    // Setup Clerk Auth middleware (replacing Replit Auth)
    console.log('🔐 [5/10] Setting up Clerk Auth middleware...');
    log('🔐 Setting up Clerk Auth middleware...');
    try {
      const { clerkMiddleware } = await import('@clerk/express');
      const { clerkAuthMiddleware } = await import('./middleware/clerk-auth');
      
      // Define public routes that should NOT require authentication
      const publicApiRoutes = [
        '/api/artist/by-slug',
        '/api/platform-stats',
        '/api/subscription-plans',
        '/api/health',
        '/api/metadata',
        '/api/crowdfunding/campaign',
        '/api/profile/',
        '/api/investor-docs/demo', // Demo investor documents (public for development)
      ];

      // Public, CRAWLER-FACING routes that must NEVER trigger Clerk's handshake.
      // Clerk (especially on a development instance) issues a 307 redirect to its
      // accounts.dev handshake endpoint for any request that lacks a Clerk
      // session — including social crawlers (Facebook, WhatsApp, Twitter/X,
      // Discord, LinkedIn). That redirect stops crawlers from ever reading the
      // server-rendered Open Graph meta tags and the dynamic OG image, so shared
      // artist/song/article pages fall back to the generic Boostify icon.
      // Bypassing Clerk for these public routes (and the OG image endpoint) keeps
      // them crawlable. Server-side auth is only needed for protected /api routes;
      // the SPA handles user auth entirely client-side, so page routes never need
      // Clerk on the server.
      const clerkPublicApiPrefixes = [
        '/api/og-image',
        '/api/artist/by-slug',
        '/api/platform-stats',
        '/api/subscription-plans',
        '/api/health',
        '/api/metadata',
        '/api/crowdfunding/campaign',
        '/api/profile/',
        '/api/news',
        '/api/investor-docs/demo', // Demo investor documents (public for development)
      ];

      const clerk = clerkMiddleware({
        // Don't require auth for any route by default
        // Individual routes will use isAuthenticated middleware when needed
      });

      // Apply Clerk's built-in middleware, but skip it for non-API (SPA page)
      // routes and public API routes so social crawlers and the OG image
      // generator are never hijacked by the Clerk handshake redirect.
      app.use((req, res, next) => {
        if (!req.path.startsWith('/api/')) return next();
        if (clerkPublicApiPrefixes.some((p) => req.path.startsWith(p))) return next();
        return clerk(req as any, res as any, next);
      });
      
      // Then apply our custom middleware to populate req.user (skip public routes)
      app.use('/api', (req, res, next) => {
        // Skip auth middleware for public API routes
        const isPublicRoute = publicApiRoutes.some(route => req.path.startsWith(route.replace('/api', '')));
        
        // DEBUG: Log the path check
        if (req.path.includes('investor-docs')) {
          console.log('[DEBUG] Investor-docs request:', {
            fullPath: req.path,
            publicRoutes: publicApiRoutes.map(r => r.replace('/api', '')),
            isPublicRoute,
          });
        }
        
        if (isPublicRoute) {
          return next();
        }
        return clerkAuthMiddleware(req, res, next);
      });
      console.log('✅ [6/10] Clerk Auth middleware configured successfully');
      log('✅ Clerk Auth middleware configured successfully');
    } catch (error) {
      console.error('❌ ERROR setting up Clerk Auth:', error);
      log(`❌ ERROR setting up Clerk Auth: ${error}`);
      console.error('Full error:', error);
      throw error;
    }

    // AUTHENTICATED ROUTES: OpenClaw Admin API (after Clerk auth for security)
    console.log('🔗 Setting up OpenClaw admin routes (post-auth)...');
    try {
      const { default: openclawAdminRouter } = await import('./routes/openclaw-admin');
      app.use('/api/admin/openclaw', openclawAdminRouter);
      console.log('✅ OpenClaw admin routes configured (post-auth)');
    } catch (error) {
      console.error('⚠️ OpenClaw admin routes failed to load:', error);
      const { Router } = await import('express');
      const fallbackRouter = Router();
      fallbackRouter.get('/status', (_req, res) => {
        res.json({ success: true, status: { enabled: false, running: false, pid: null, port: 18789, uptime: null, lastHealthCheck: null, error: `OpenClaw module failed to load: ${error}` } });
      });
      fallbackRouter.post('/toggle', (_req, res) => {
        res.json({ success: false, error: 'OpenClaw module not loaded' });
      });
      app.use('/api/admin/openclaw', fallbackRouter);
    }
    
    // CDN redirect middleware: serves /assets/*.mp4 etc. from Firebase Storage
    // in production when local files are excluded from git/build.
    // No-op in dev when files exist locally (Vite serves them first).
    const { assetCdnMiddleware } = await import('./middleware/asset-cdn');
    app.use(assetCdnMiddleware);
    log('📡 Asset CDN middleware registered');

    // Serve uploaded files statically
    const uploadsPath = path.join(process.cwd(), 'uploads');
    app.use('/uploads', express.static(uploadsPath));
    log(`📁 Serving uploaded files from: ${uploadsPath}`);

    // Serve attached assets (generated images, AI content, etc)
    // Use process.cwd() to ensure correct path regardless of where server is running from
    const assetsPath = path.join(process.cwd(), 'attached_assets');
    if (fs.existsSync(assetsPath)) {
      app.use('/attached_assets', express.static(assetsPath, {
        maxAge: '1d', // Cache for 1 day
        setHeaders: (res, filePath) => {
          // Set proper CORS headers for images
          res.setHeader('Access-Control-Allow-Origin', '*');
          // Set proper content type for images
          if (filePath.endsWith('.png')) {
            res.setHeader('Content-Type', 'image/png');
          } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
            res.setHeader('Content-Type', 'image/jpeg');
          } else if (filePath.endsWith('.webp')) {
            res.setHeader('Content-Type', 'image/webp');
          }
        }
      }));
      log(`🖼️ Serving attached assets from: ${assetsPath}`);
    } else {
      log(`⚠️ Warning: attached_assets folder not found at: ${assetsPath}`);
    }

    // Serve DEMO TIGUER assets (client demo page)
    const demoTiguerPath = path.join(process.cwd(), 'public', 'DEMO TIGUER');
    if (fs.existsSync(demoTiguerPath)) {
      app.use('/DEMO TIGUER', express.static(demoTiguerPath, {
        setHeaders: (res) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Accept-Ranges', 'bytes');
        }
      }));
      log(`🎬 Serving DEMO TIGUER assets from: ${demoTiguerPath}`);
    }

    // Serve public/assets statically (PDF briefs, images, etc.)
    const publicAssetsPath = path.join(process.cwd(), 'public', 'assets');
    if (fs.existsSync(publicAssetsPath)) {
      app.use('/static-assets', express.static(publicAssetsPath, {
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Accept-Ranges', 'bytes');
          if (filePath.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
          }
        },
      }));
      log(`📄 Serving public assets from: ${publicAssetsPath}`);
    }

    // IMPORTANT: Register API routes BEFORE static file serving
    const server = await registerRoutes(app);
    log('✅ API routes registered successfully');

    // Register /api/auth/user endpoint (Clerk-based)
    log('🔐 Registering /api/auth/user endpoint...');
    app.get('/api/auth/user', async (req: any, res) => {
      try {
        const user = req.user;
        console.log('[/api/auth/user] req.user:', user ? { clerkUserId: user.clerkUserId, email: user.email } : 'undefined');
        
        // Check if user is authenticated via Clerk middleware
        if (!user || !user.clerkUserId) {
          console.log('❌ User not authenticated - no clerkUserId');
          audit({ action: 'auth.access_denied', severity: 'warn', ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || undefined, userAgent: req.headers['user-agent'] });
          return res.status(401).json({ message: "Unauthorized" });
        }
        
        const clerkUserId = user.clerkUserId;
        const userEmail = user.email;
        
        // Check if user is admin
        const isAdmin = isAdminEmail(userEmail);
        
        const { db } = await import('./db');
        const { users } = await import('@db/schema');
        const { eq } = await import('drizzle-orm');
        
        // Try to find user by clerkId; if not found, create new user
        let [dbUser] = await db
          .select()
          .from(users)
          .where(eq(users.clerkId, clerkUserId))
          .limit(1);
        
        if (!dbUser) {
          // Create user on first login
          const [newUser] = await db
            .insert(users)
            .values({
              clerkId: clerkUserId,
              email: userEmail || null,
              role: 'artist',
            })
            .returning();
          dbUser = newUser;
        }
        
        // Return user with admin status
        audit({ action: 'auth.login', actorId: dbUser.id, actorEmail: userEmail || undefined, severity: 'info', ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || undefined, details: { isAdmin } });
        res.json({
          ...dbUser,
          isAdmin,
          role: isAdmin ? 'admin' : (dbUser.role || 'artist')
        });
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Failed to fetch user" });
      }
    });
    log('✅ /api/auth/user endpoint registered');
    
    // Aumentar timeout del servidor a 5 minutos (300 segundos) para generar galerías de imágenes
    server.timeout = 300000; // 5 minutos en milisegundos
    log('⏱️ Server timeout set to 5 minutes for long-running image generation requests');

    // Setup static file serving based on environment
    // This must come AFTER API routes registration
    if (process.env.NODE_ENV === "production") {
      log('🚀 Running in production mode');

      // Try multiple possible dist paths (in order of preference)
      const possiblePaths = [
        path.resolve(process.cwd(), 'dist', 'client'),
        path.resolve(process.cwd(), 'dist', 'public'),
        path.resolve(__dirname, '..', 'client'),
      ];

      let distPath = possiblePaths[0];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          distPath = p;
          break;
        }
      }

      log(`📁 Serving static files from: ${distPath}`);

      // Serve static files
      app.use(express.static(distPath));
      
      // SPA fallback - catch all other routes and serve index.html
      // This MUST be the last route
      app.get('*', async (req, res) => {
        // Don't log API requests here as they're already handled
        if (!req.path.startsWith('/api/')) {
          log(`📄 Serving index.html for: ${req.path}`);
        }

        // ── OG Tag injection for /article/:id ─────────────────────────────
        // Facebook, Twitter and other social crawlers don't execute JS.
        // We detect article routes and inject per-article OG meta tags into
        // the HTML before sending so crawlers can build a proper preview card.
        const articleMatch = req.path.match(/^\/article\/(\d+)$/);
        if (articleMatch) {
          try {
            const newsId = parseInt(articleMatch[1], 10);
            const [item] = await pgDb
              .select({
                title: artistNews.title,
                summary: artistNews.summary,
                imageUrl: artistNews.imageUrl,
                category: artistNews.category,
                artistName: users.artistName,
              })
              .from(artistNews)
              .leftJoin(users, eq(artistNews.userId, users.id))
              .where(eq(artistNews.id, newsId))
              .limit(1);

            if (item) {
              const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://boostifymusic.com';
              const ogTitle = `${item.title} | Boostify Music`;
              const ogDescription = item.summary || `Music news by ${item.artistName || 'Boostify Music'}`;
              // Use the dynamic OG image generator we already have
              const ogImage = `${baseUrl}/api/og-image/news/${newsId}`;
              const ogUrl = `${baseUrl}/article/${newsId}`;

              const escape = (s: string) =>
                s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

              const html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
              const injected = html
                .replace(/<meta property="og:title"[^>]*>/g,
                  `<meta property="og:title" content="${escape(ogTitle)}" />`)
                .replace(/<meta property="og:description"[^>]*>/g,
                  `<meta property="og:description" content="${escape(ogDescription)}" />`)
                .replace(/<meta property="og:image"[^>]*>/g,
                  `<meta property="og:image" content="${escape(ogImage)}" />`)
                .replace(/<meta property="og:url"[^>]*>/g,
                  `<meta property="og:url" content="${escape(ogUrl)}" />`)
                .replace(/<meta property="og:type"[^>]*>/g,
                  `<meta property="og:type" content="article" />`)
                .replace(/<meta name="twitter:title"[^>]*>/g,
                  `<meta name="twitter:title" content="${escape(ogTitle)}" />`)
                .replace(/<meta name="twitter:description"[^>]*>/g,
                  `<meta name="twitter:description" content="${escape(ogDescription)}" />`)
                .replace(/<meta name="twitter:image"[^>]*>/g,
                  `<meta name="twitter:image" content="${escape(ogImage)}" />`)
                .replace(/<title>[^<]*<\/title>/,
                  `<title>${escape(ogTitle)}</title>`);

              return res.setHeader('Content-Type', 'text/html').send(injected);
            }
          } catch (e) {
            log(`⚠️ OG injection failed for ${req.path}: ${(e as Error).message}`);
            // Fall through to normal index.html serving
          }
        }
        // ──────────────────────────────────────────────────────────────────

        // ── OG Tag injection for /artist/:slug ────────────────────────────
        const artistMatch = req.path.match(/^\/artist\/([\w-]+)$/);
        if (artistMatch) {
          try {
            const slug = artistMatch[1];
            const [artist] = await pgDb
              .select({
                artistName: users.artistName,
                biography: users.biography,
                profileImage: users.profileImage,
                coverImage: users.coverImage,
                genres: users.genres,
                location: users.location,
                country: users.country,
              })
              .from(users)
              .where(eq(users.slug, slug))
              .limit(1);

            if (artist) {
              const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://boostifymusic.com';
              const name = artist.artistName || 'Artist';
              const genre = artist.genres?.[0] || 'Music Artist';
              const location = artist.location || artist.country || '';
              const bio = artist.biography || `Listen to ${name} on Boostify Music`;
              const ogTitle = `${name} | Boostify Music`;
              const ogDescription = `${genre}${location ? ' · ' + location : ''} — ${bio.length > 120 ? bio.substring(0, 117) + '...' : bio}`;
              const ogImage = `${baseUrl}/api/og-image/artist/slug/${encodeURIComponent(slug)}`;
              const ogUrl = `${baseUrl}/artist/${slug}`;

              const escape = (s: string) =>
                s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

              const html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
              const injected = html
                .replace(/<title>[^<]*<\/title>/, `<title>${escape(ogTitle)}</title>`)
                .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(ogDescription)}" />`)
                .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escape(ogTitle)}" />`)
                .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escape(ogDescription)}" />`)
                .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escape(ogImage)}" />`)
                .replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="profile" />`)
                .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escape(ogUrl)}" />`)
                .replace(/<meta name="twitter:card"[^>]*>/, `<meta name="twitter:card" content="summary_large_image" />`)
                .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escape(ogTitle)}" />`)
                .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escape(ogDescription)}" />`)
                .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escape(ogImage)}" />`);

              return res.setHeader('Content-Type', 'text/html').send(injected);
            }
          } catch (e) {
            log(`⚠️ Artist OG injection failed for ${req.path}: ${(e as Error).message}`);
          }
        }
        // ──────────────────────────────────────────────────────────────────

        // ── OG Tag injection for /song/:id ────────────────────────────────
        const songMatch = req.path.match(/^\/song\/(\d+)$/);
        if (songMatch) {
          try {
            const songId = parseInt(songMatch[1], 10);
            const [songItem] = await pgDb
              .select({
                title: songs.title,
                description: songs.description,
                coverArt: songs.coverArt,
                genre: songs.genre,
                artistName: users.artistName,
                slug: users.slug,
              })
              .from(songs)
              .leftJoin(users, eq(songs.userId, users.id))
              .where(eq(songs.id, songId))
              .limit(1);

            if (songItem) {
              const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://boostifymusic.com';
              const ogTitle = `${songItem.title} — ${songItem.artistName || 'Artist'} | Boostify Music`;
              const ogDescription = songItem.description
                ? songItem.description.substring(0, 150)
                : `${songItem.genre ? songItem.genre + ' · ' : ''}Listen to ${songItem.title} by ${songItem.artistName || 'Artist'} on Boostify Music`;
              const ogImage = `${baseUrl}/api/og-image/song/${songId}`;
              const ogUrl = `${baseUrl}/song/${songId}`;

              const escape = (s: string) =>
                s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

              const html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
              const injected = html
                .replace(/<title>[^<]*<\/title>/, `<title>${escape(ogTitle)}</title>`)
                .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(ogDescription)}" />`)
                .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escape(ogTitle)}" />`)
                .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escape(ogDescription)}" />`)
                .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escape(ogImage)}" />`)
                .replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="music.song" />`)
                .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escape(ogUrl)}" />`)
                .replace(/<meta name="twitter:card"[^>]*>/, `<meta name="twitter:card" content="summary_large_image" />`)
                .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escape(ogTitle)}" />`)
                .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escape(ogDescription)}" />`)
                .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escape(ogImage)}" />`);

              return res.setHeader('Content-Type', 'text/html').send(injected);
            }
          } catch (e) {
            log(`⚠️ Song OG injection failed for ${req.path}: ${(e as Error).message}`);
          }
        }
        // ──────────────────────────────────────────────────────────────────

        // ── OG Tag injection for /embed/playlist/:id ──────────────────────
        // The shareable playlist widget is a client-side React route, so social
        // crawlers (Facebook, WhatsApp, X…) only see the generic index.html.
        // Inject per-playlist OG tags + a branded card image so the share looks
        // like a real playlist preview instead of the default Boostify logo.
        const playlistEmbedMatch = req.path.match(/^\/embed\/playlist\/(\d+)$/);
        if (playlistEmbedMatch) {
          try {
            const playlistId = parseInt(playlistEmbedMatch[1], 10);
            const sql = neon(process.env.DATABASE_URL!);
            const [pl] = await sql`
              SELECT p.title, p.description, p.is_public,
                     u.artist_name, u.first_name, u.last_name, u.username,
                     (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS track_count
              FROM playlists p
              INNER JOIN users u ON u.id = p.user_id
              WHERE p.id = ${playlistId}
              LIMIT 1
            `;

            if (pl && pl.is_public) {
              const baseUrl = process.env.RENDER_EXTERNAL_URL || 'https://boostifymusic.com';
              const ownerName =
                pl.artist_name ||
                [pl.first_name, pl.last_name].filter(Boolean).join(' ') ||
                pl.username ||
                'Boostify';
              const trackCount = Number(pl.track_count || 0);
              const ogTitle = `${pl.title || 'Playlist'} — ${ownerName} | Boostify Music`;
              const ogDescription = pl.description
                ? String(pl.description).substring(0, 150)
                : `Playlist by ${ownerName}${trackCount ? ` · ${trackCount} track${trackCount === 1 ? '' : 's'}` : ''} — listen on Boostify Music.`;
              const ogImage = `${baseUrl}/api/og-image/playlist/${playlistId}`;
              const ogUrl = `${baseUrl}/embed/playlist/${playlistId}`;

              const escape = (s: string) =>
                s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

              const html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
              const injected = html
                .replace(/<title>[^<]*<\/title>/, `<title>${escape(ogTitle)}</title>`)
                .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(ogDescription)}" />`)
                .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escape(ogTitle)}" />`)
                .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escape(ogDescription)}" />`)
                .replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${escape(ogImage)}" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />`)
                .replace(/<meta property="og:type"[^>]*>/, `<meta property="og:type" content="music.playlist" />`)
                .replace(/<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${escape(ogUrl)}" />`)
                .replace(/<meta name="twitter:card"[^>]*>/, `<meta name="twitter:card" content="summary_large_image" />`)
                .replace(/<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${escape(ogTitle)}" />`)
                .replace(/<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${escape(ogDescription)}" />`)
                .replace(/<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${escape(ogImage)}" />`);

              return res.setHeader('Content-Type', 'text/html').send(injected);
            }
          } catch (e) {
            log(`⚠️ Playlist OG injection failed for ${req.path}: ${(e as Error).message}`);
          }
        }
        // ──────────────────────────────────────────────────────────────────

        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      log('🛠 Running in development mode');
      app.use(express.static(path.join(process.cwd(), 'client/public')));
      log('🔍 Vite will handle frontend routes in development mode');
    }

    // Global error handler
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      console.error('❌ Server error:', err);
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      log(`❌ Error handling request ${req.method} ${req.path}: ${err.message}`);
      res.status(status).json({
        message,
        path: req.path,
        timestamp: new Date().toISOString()
      });
    });

    // Check for required environment variables in production
    if (process.env.NODE_ENV === "production") {
      const criticalEnvVars = [
        { name: 'OPENAI_API_KEY', description: 'OpenAI API access' },
        { name: 'SESSION_SECRET', description: 'Secure session management' },
        { name: 'DATABASE_URL', description: 'Database connection' }
      ];

      criticalEnvVars.forEach(({ name, description }) => {
        if (!process.env[name]) {
          log(`⚠️ Warning: ${name} environment variable is not set (${description})`);
        } else {
          log(`✅ ${name} is configured and ready for use`);
        }
      });

      if (process.env.PM2_HOME) {
        log('✅ Running under PM2 process manager');
        if (process.env.PM2_INSTANCES) {
          log(`📊 PM2 Instances: ${process.env.PM2_INSTANCES}`);
        }
        if (process.env.PM2_EXEC_MODE) {
          log(`📊 PM2 Execution Mode: ${process.env.PM2_EXEC_MODE}`);
        }
      } else {
        log('⚠️ Not running under PM2. For production, it is recommended to use PM2 for process management');
      }
    } else if (process.env.OPENAI_API_KEY) {
      log('✅ OPENAI_API_KEY is configured and ready for use');
    }

    // ONLY setup Vite in development - NEVER in production builds
    // Skip internal Vite completely - use external Vite via npm run dev
    // This prevents esbuild EPIPE errors on Windows
    if (process.env.NODE_ENV !== "production" && !isProduction) {
      console.log('⏭️ Development mode: Using external Vite dev server (port 5000)');
      console.log('📌 API server running on port 3000, frontend proxies /api requests');
    } else {
      console.log('🚀 Production mode: Serving static files, Vite disabled');
    }

    const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

    const isReplitEnv = !!process.env.REPL_SLUG || !!process.env.REPLIT_IDENTITY;

    if (process.env.NODE_ENV === "production") {
      log(`🚀 Starting server in production mode on port ${PORT}`);
    }

    server.listen(PORT, '0.0.0.0', () => {
      log(`✅ Server started on port ${PORT}`);
      log(`🌍 Environment: ${process.env.NODE_ENV || app.get("env")}`);
      log(`📂 Static files served from: ${process.env.NODE_ENV === "production" ?
        path.resolve(process.cwd(), 'dist', 'client') :
        path.join(process.cwd(), 'client/public')}`);

      const accessURL = process.env.PRODUCTION_URL ||
        (process.env.NODE_ENV === "production" ?
          `https://boostifymusic.com` :
          `http://localhost:${PORT}`);

      log(`🔗 Access URL: ${accessURL}`);
      
      // Keep the server running with a heartbeat
      console.log('💓 Server heartbeat started - server is running...');
    });
    
    // Keep-alive interval to prevent Node from exiting
    setInterval(() => {
      // Silent heartbeat every 30 seconds to keep the event loop active
    }, 30000);

    // Daily fan sequence emails (runs every 24h)
    const runFanSequence = async () => {
      try {
        const now = new Date();
        const pending = await pgDb
          .select()
          .from(artistFanLeads)
          .where(
            and(
              eq(artistFanLeads.isUnsubscribed, false),
              lt(artistFanLeads.sequenceStep, 2),
              lte(artistFanLeads.nextEmailAt, now)
            )
          );

        if (!pending.length) return;
        console.log(`📧 [FanSequence] Processing ${pending.length} pending sequence emails...`);

        for (const fan of pending) {
          try {
            const [artist] = await pgDb
              .select({ artistName: users.artistName, slug: users.slug })
              .from(users)
              .where(eq(users.id, fan.artistId))
              .limit(1);
            if (!artist) continue;

            const artistName = artist.artistName || 'your artist';
            const artistSlug = fan.artistSlug || artist.slug || String(fan.artistId);
            const day7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

            if (fan.sequenceStep === 0) {
              await sendFanDay3Email(fan.email, fan.name || '', artistName, artistSlug);
              await pgDb
                .update(artistFanLeads)
                .set({ sequenceStep: 1, lastEmailSentAt: now, nextEmailAt: day7 })
                .where(eq(artistFanLeads.id, fan.id));
            } else if (fan.sequenceStep === 1) {
              await sendFanDay7Email(fan.email, fan.name || '', artistName, artistSlug);
              await pgDb
                .update(artistFanLeads)
                .set({ sequenceStep: 2, lastEmailSentAt: now, nextEmailAt: null })
                .where(eq(artistFanLeads.id, fan.id));
            }
          } catch (fanErr: any) {
            console.warn(`⚠️ [FanSequence] Fan #${fan.id} error:`, fanErr?.message);
          }
        }
      } catch (err: any) {
        console.error('❌ [FanSequence] Cron error:', err?.message);
      }
    };

    // Run once on startup (catches any missed emails), then every 24h
    setTimeout(runFanSequence, 60_000);
    setInterval(runFanSequence, 24 * 60 * 60 * 1000);

    // Social Integration Worker — email notifications, external publish, platform events
    try {
      const { startSocialIntegrationWorker } = await import('./services/social-integration-worker');
      startSocialIntegrationWorker();
    } catch (workerErr) {
      console.warn('⚠️ [SocialWorker] Could not start:', workerErr);
    }

    // Aggregated stats cron — keeps artist_stats / event_stats fresh (drift +
    // high-churn counters like song plays that are kept off the trigger path).
    try {
      const { startStatsCron } = await import('./services/stats-aggregates');
      startStatsCron();
    } catch (statsErr) {
      console.warn('⚠️ [StatsCron] Could not start:', statsErr);
    }

    server.on('error', (error: any) => {
      // Ignore EPIPE — broken pipe on stdout/stderr (harmless in PowerShell terminals)
      if (error.code === 'EPIPE') return;
      if (error.code === 'EADDRINUSE') {
        log(`⚠️ Port ${PORT} already in use — another server instance is running. This process will continue running schedulers only.`);
        // Don't exit — schedulers and background workers continue running
        return;
      }
      log(`❌ Server error: ${error.message}`);
      // Only exit for truly fatal server errors (not EADDRINUSE or EPIPE)
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
})();