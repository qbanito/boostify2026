/**
 * Boostify CrowdSync DJ — live event intelligence API
 * --------------------------------------------------
 * Mounted at /api/crowdsync-dj.
 * Persists DJ events, live sessions, crowd readings, AI actions,
 * generated assets, network posts, agent settings, and reports.
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import { isAuthenticated, getUserId } from '../middleware/clerk-auth';
import { db, FieldValue } from '../firebase';
import { db as pgDb } from '../../db';
import { songs, subscriptions, users } from '../../db/schema';
import { generateArtistSongWithFAL } from '../services/fal-service';
import { chargeCredits } from '../services/credit-engine';

const router = Router();

const EVENTS_COL = 'crowdsync_events';
const AGENTS_COL = 'crowdsync_dj_agents';
const NETWORK_COL = 'boostify_dj_network_posts';
const PAYMENTS_COL = 'crowdsync_payments';
const DJS_COL = 'crowdsync_djs';

const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' as any }) : null;

const CROWDSYNC_PRODUCTS = {
  pro: {
    id: 'crowdsync_pro',
    name: 'CrowdSync DJ Pro',
    mode: 'subscription' as const,
    amount: 2900,
    interval: 'month' as const,
    description: 'Unlimited CrowdSync DJ events, live crowd analytics, Stripe-ready event monetization, and AI music generation tools.',
  },
  event_pass: {
    id: 'crowdsync_event_pass',
    name: 'CrowdSync Event Pass',
    mode: 'payment' as const,
    amount: 4900,
    description: 'One live event pass with mobile camera intelligence, reporting, music generation, and DJ Network publishing.',
  },
  credit_pack: {
    id: 'crowdsync_credit_pack',
    name: 'CrowdSync AI Credit Pack',
    mode: 'payment' as const,
    amount: 2500,
    description: 'AI music and visual generation credit pack for CrowdSync DJ sessions.',
  },
};

type CrowdMood = 'Euforico' | 'Subiendo' | 'Intenso' | 'Elegante';

const moods: CrowdMood[] = ['Euforico', 'Subiendo', 'Intenso', 'Elegante'];

function getBaseUrl(req: Request): string {
  if (process.env.PRODUCTION_URL) return process.env.PRODUCTION_URL.replace(/\/$/, '');
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0];
  const proto = forwardedProto || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
  return `${proto}://${host}`;
}

function requireDb(res: Response): boolean {
  if (!db) {
    res.status(503).json({ success: false, error: 'Firestore unavailable' });
    return false;
  }
  return true;
}

function shortId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clean<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as T;
}

function serialize(value: any): any {
  if (!value) return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, serialize(val)]));
  }
  return value;
}

function docData(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  return serialize({ id: doc.id, ...(doc.data() || {}) });
}

function currentUser(req: Request, res: Response): string | null {
  const userId = getUserId(req) || (req.user as any)?.id || null;
  if (!userId) res.status(401).json({ success: false, error: 'unauthenticated' });
  return userId ? String(userId) : null;
}

function currentEmail(req: Request): string | undefined {
  return (req.user as any)?.email || (req.user as any)?.emailAddresses?.[0]?.emailAddress || undefined;
}

async function getPgUser(clerkUserId: string, email?: string) {
  const byClerk = await pgDb
    .select({
      id: users.id,
      clerkId: users.clerkId,
      email: users.email,
      artistName: users.artistName,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      profileImage: users.profileImage,
      profileImageUrl: users.profileImageUrl,
      coverImage: users.coverImage,
      genre: users.genre,
      genres: users.genres,
      country: users.country,
      slug: users.slug,
      isAIGenerated: users.isAIGenerated,
      masterJson: users.masterJson,
    })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);

  if (byClerk[0]) return byClerk[0];
  if (!email) return null;

  const byEmail = await pgDb
    .select({
      id: users.id,
      clerkId: users.clerkId,
      email: users.email,
      artistName: users.artistName,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      profileImage: users.profileImage,
      profileImageUrl: users.profileImageUrl,
      coverImage: users.coverImage,
      genre: users.genre,
      genres: users.genres,
      country: users.country,
      slug: users.slug,
      isAIGenerated: users.isAIGenerated,
      masterJson: users.masterJson,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return byEmail[0] || null;
}

function artistDisplayName(artist: any): string {
  return artist?.artistName || [artist?.firstName, artist?.lastName].filter(Boolean).join(' ') || artist?.username || 'Boostify Artist';
}

async function getBoostifyMusicLibrary(clerkUserId: string, email?: string) {
  const pgUser = await getPgUser(clerkUserId, email);
  if (!pgUser) return { pgUser: null, artists: [], songs: [] };

  const artistRows = await pgDb
    .select({
      id: users.id,
      artistName: users.artistName,
      firstName: users.firstName,
      lastName: users.lastName,
      username: users.username,
      profileImage: users.profileImage,
      profileImageUrl: users.profileImageUrl,
      coverImage: users.coverImage,
      genre: users.genre,
      genres: users.genres,
      country: users.country,
      slug: users.slug,
      isAIGenerated: users.isAIGenerated,
      generatedBy: users.generatedBy,
      masterJson: users.masterJson,
    })
    .from(users)
    .where(or(eq(users.id, pgUser.id), eq(users.generatedBy, pgUser.id), eq(users.clerkId, clerkUserId)))
    .orderBy(desc(users.updatedAt))
    .limit(40);

  const artists = artistRows.map((artist: any) => ({
    ...artist,
    name: artistDisplayName(artist),
    image: artist.profileImage || artist.profileImageUrl || artist.coverImage || null,
  }));
  const artistIds = artists.map((artist: any) => Number(artist.id)).filter(Boolean);
  const songRows = artistIds.length
    ? await pgDb
        .select({
          id: songs.id,
          userId: songs.userId,
          title: songs.title,
          description: songs.description,
          audioUrl: songs.audioUrl,
          duration: songs.duration,
          genre: songs.genre,
          mood: songs.mood,
          lyrics: songs.lyrics,
          coverArt: songs.coverArt,
          generatedWithAI: songs.generatedWithAI,
          aiProvider: songs.aiProvider,
          plays: songs.plays,
          createdAt: songs.createdAt,
        })
        .from(songs)
        .where(inArray(songs.userId, artistIds))
        .orderBy(desc(songs.createdAt))
        .limit(100)
    : [];

  const artistById = new Map(artists.map((artist: any) => [Number(artist.id), artist]));
  const librarySongs = songRows.map((song: any) => {
    const artist = artistById.get(Number(song.userId));
    return {
      ...song,
      artistName: artist?.name || 'Boostify Artist',
      artistImage: artist?.image || null,
    };
  });

  return { pgUser, artists, songs: librarySongs };
}

async function getBillingStatus(clerkUserId: string, email?: string) {
  const pgUser = await getPgUser(clerkUserId, email);
  const activeSubscription = pgUser
    ? await pgDb
        .select({
          plan: subscriptions.plan,
          status: subscriptions.status,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          interval: subscriptions.interval,
          price: subscriptions.price,
        })
        .from(subscriptions)
        .where(and(eq(subscriptions.userId, pgUser.id), eq(subscriptions.status, 'active')))
        .orderBy(desc(subscriptions.currentPeriodEnd))
        .limit(1)
    : [];

  const paymentsSnap = await db.collection(PAYMENTS_COL).where('ownerId', '==', clerkUserId).limit(12).get();
  const payments = paymentsSnap.docs
    .map(docData)
    .sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return {
    plan: activeSubscription[0]?.plan || 'free',
    status: activeSubscription[0]?.status || 'inactive',
    currentPeriodEnd: activeSubscription[0]?.currentPeriodEnd || null,
    interval: activeSubscription[0]?.interval || null,
    price: activeSubscription[0]?.price || null,
    stripeConfigured: Boolean(stripe),
    products: Object.values(CROWDSYNC_PRODUCTS).map((product) => ({
      id: product.id,
      name: product.name,
      mode: product.mode,
      amount: product.amount,
      interval: product.mode === 'subscription' ? product.interval : null,
      description: product.description,
    })),
    payments,
  };
}

async function assertEventAccess(userId: string, eventId: string) {
  const ref = db.collection(EVENTS_COL).doc(eventId);
  const doc = await ref.get();
  if (!doc.exists) return { ok: false, status: 404, error: 'event not found', ref, data: null as any };
  const data = doc.data() || {};
  if (String(data.ownerId || '') !== userId) return { ok: false, status: 403, error: 'forbidden', ref, data };
  return { ok: true, status: 200, error: null, ref, data };
}

function buildEventJson(event: any) {
  const config = event.config || {};
  const agent = event.agent || {};
  const state = event.currentState || {};
  return {
    event_name: config.eventName || event.name || 'CrowdSync Event',
    event_type: config.eventType || 'Live event',
    location: { city: config.city || '', venue: config.venue || '' },
    audience_profile: {
      estimated_people: Number(config.people) || 0,
      preferred_genres: String(config.genres || '').split(',').map((genre) => genre.trim()).filter(Boolean),
      current_energy: state.energy ?? 87,
      current_mood: state.mood || 'Euforico',
      current_bpm: state.bpm ?? 122,
    },
    dj_mode: {
      type: config.djMode || 'Autonomous agent',
      agent_name: agent.name || 'LUXA VIBE',
      creativity_level: agent.creative ?? 88,
      crowd_sensitivity: agent.sensitivity ?? 92,
      voice_interaction: agent.toggles?.voice ?? true,
      visual_sync: agent.toggles?.visuals ?? true,
      human_override: agent.toggles?.human ?? true,
      autonomous: agent.toggles?.autonomous ?? true,
    },
    boostify_artist_connection: {
      enabled: true,
      featured_artist: config.artist || 'Romy Alvarez',
      selected_artist_id: config.selectedArtistId || null,
      selected_song_id: config.selectedSongId || null,
      current_track: config.currentTrackTitle || null,
      visual_theme: config.visualStyle || 'Ocean gold',
    },
    camera_session: event.cameraSession || {
      enabled: false,
      status: 'offline',
      source: 'mobile-camera',
    },
    post_event_outputs: {
      generate_report: true,
      generate_social_clips: true,
      generate_playlist: true,
      publish_to_boostify_network: true,
    },
  };
}

async function getFullEvent(eventId: string) {
  const ref = db.collection(EVENTS_COL).doc(eventId);
  const [eventDoc, sessionsSnap, cameraSessionsSnap, readingsSnap, actionsSnap, assetsSnap, reportsSnap] = await Promise.all([
    ref.get(),
    ref.collection('live_sessions').orderBy('startedAt', 'desc').limit(10).get(),
    ref.collection('camera_sessions').orderBy('updatedAt', 'desc').limit(20).get(),
    ref.collection('crowd_readings').orderBy('createdAt', 'desc').limit(20).get(),
    ref.collection('action_log').orderBy('createdAt', 'desc').limit(20).get(),
    ref.collection('generated_assets').orderBy('createdAt', 'desc').limit(30).get(),
    ref.collection('event_reports').orderBy('createdAt', 'desc').limit(5).get(),
  ]);

  return {
    event: eventDoc.exists ? docData(eventDoc) : null,
    sessions: sessionsSnap.docs.map(docData),
    cameraSessions: cameraSessionsSnap.docs.map(docData),
    readings: readingsSnap.docs.map(docData),
    actions: actionsSnap.docs.map(docData),
    generatedAssets: assetsSnap.docs.map(docData),
    reports: reportsSnap.docs.map(docData),
  };
}

async function addAction(eventId: string, payload: Record<string, any>) {
  const ref = db.collection(EVENTS_COL).doc(eventId).collection('action_log').doc(shortId('act'));
  const action = clean({ ...payload, id: ref.id, createdAt: FieldValue.serverTimestamp() });
  await ref.set(action);
  return { id: ref.id, ...serialize(action) };
}

async function addGeneratedAsset(eventId: string, payload: Record<string, any>) {
  const ref = db.collection(EVENTS_COL).doc(eventId).collection('generated_assets').doc(shortId('asset'));
  const asset = clean({ ...payload, id: ref.id, createdAt: FieldValue.serverTimestamp() });
  await ref.set(asset);
  return { id: ref.id, ...serialize(asset) };
}

/**
 * Upsert a DJ profile in the crowdsync_djs directory. Called automatically on
 * bootstrap (so every CrowdSync user appears in the DJ database) and explicitly
 * via POST /djs/register.
 */
async function upsertDjProfile(userId: string, email?: string, extras: Record<string, any> = {}) {
  if (!db) return null;
  const [pgUser, existingDoc, eventsSnap, agentDoc] = await Promise.all([
    getPgUser(userId, email).catch(() => null),
    db.collection(DJS_COL).doc(userId).get(),
    db.collection(EVENTS_COL).where('ownerId', '==', userId).limit(60).get().catch(() => null),
    db.collection(AGENTS_COL).doc(userId).get().catch(() => null),
  ]);
  const existing = (existingDoc.data() || {}) as Record<string, any>;
  const agent = (agentDoc?.exists ? agentDoc.data() : {}) as Record<string, any>;
  const profile = clean({
    id: userId,
    ownerId: userId,
    name:
      extras.name ||
      (pgUser as any)?.artistName ||
      (pgUser as any)?.username ||
      [(pgUser as any)?.firstName, (pgUser as any)?.lastName].filter(Boolean).join(' ') ||
      existing.name ||
      (email ? email.split('@')[0] : 'CrowdSync DJ'),
    email: email || (pgUser as any)?.email || existing.email || null,
    style: extras.style || agent?.style || existing.style || 'CrowdSync AI DJ',
    agentName: agent?.name || existing.agentName || null,
    city: extras.city ?? existing.city ?? null,
    genres:
      extras.genres ||
      ((pgUser as any)?.genres?.length ? (pgUser as any).genres : undefined) ||
      ((pgUser as any)?.genre ? [(pgUser as any).genre] : undefined) ||
      existing.genres ||
      [],
    image: extras.image || (pgUser as any)?.profileImage || (pgUser as any)?.profileImageUrl || existing.image || null,
    eventsCount: eventsSnap ? eventsSnap.size : Number(existing.eventsCount || 0),
    lastActiveAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    ...(existingDoc.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
  });
  await db.collection(DJS_COL).doc(userId).set(profile, { merge: true });
  return { id: userId, ...serialize(profile) };
}

const EMPTY_SNAP = { docs: [] as any[], empty: true };
const EMPTY_DOC = { exists: false, data: () => ({}) } as any;

router.get('/bootstrap', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const email = currentEmail(req);

    // Artists and songs come from PostgreSQL — bootstrap must succeed even if
    // Firestore (db) is unavailable.
    const firestoreAvailable = !!db;
    const [eventsSnap, agentDoc, networkSnap, musicLibrary, billing] = await Promise.all([
      firestoreAvailable
        ? db!.collection(EVENTS_COL).where('ownerId', '==', userId).limit(50).get()
        : Promise.resolve(EMPTY_SNAP),
      firestoreAvailable
        ? db!.collection(AGENTS_COL).doc(userId).get()
        : Promise.resolve(EMPTY_DOC),
      firestoreAvailable
        ? db!.collection(NETWORK_COL).orderBy('createdAt', 'desc').limit(20).get()
        : Promise.resolve(EMPTY_SNAP),
      getBoostifyMusicLibrary(userId, email),
      getBillingStatus(userId, email),
    ]);

    const toMillis = (v: any): number => {
      if (!v) return 0;
      if (typeof v?.toMillis === 'function') return v.toMillis();
      if (typeof v === 'string') return Date.parse(v) || 0;
      if (typeof v === 'number') return v;
      if (v?._seconds) return v._seconds * 1000;
      return 0;
    };
    const events = (eventsSnap as any).docs
      .map(docData)
      .sort((a: any, b: any) => toMillis(b?.updatedAt) - toMillis(a?.updatedAt))
      .slice(0, 20);
    const activeEventId = events[0]?.id || null;
    const full = (firestoreAvailable && activeEventId) ? await getFullEvent(activeEventId) : null;

    // Keep the DJ database fresh: auto-register/refresh this user's DJ profile
    // in the crowdsync_djs directory (fire-and-forget, never blocks bootstrap).
    if (firestoreAvailable) {
      void upsertDjProfile(userId, email).catch((djErr: any) =>
        console.warn('[CrowdSyncDJ] DJ profile upsert failed:', djErr?.message || djErr),
      );
    }

    res.json({
      success: true,
      events,
      activeEventId,
      activeEvent: full,
      agent: (agentDoc as any).exists ? docData(agentDoc as any) : null,
      networkPosts: (networkSnap as any).docs.map(docData),
      musicLibrary,
      billing,
    });
  } catch (err: any) {
    console.error('[CrowdSyncDJ] bootstrap failed:', err);
    res.status(500).json({ success: false, error: err?.message || 'bootstrap failed' });
  }
});

router.post('/checkout', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    if (!stripe) return res.status(503).json({ success: false, error: 'Stripe is not configured' });

    const productKey = String(req.body?.product || 'pro') as keyof typeof CROWDSYNC_PRODUCTS;
    const product = CROWDSYNC_PRODUCTS[productKey] || CROWDSYNC_PRODUCTS.pro;
    const eventId = req.body?.eventId ? String(req.body.eventId) : null;
    if (eventId) {
      const access = await assertEventAccess(userId, eventId);
      if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });
    }

    const email = currentEmail(req);
    const customers = email ? await stripe.customers.list({ email, limit: 1 }) : { data: [] as Stripe.Customer[] };
    const customer = customers.data[0] || await stripe.customers.create({
      email,
      metadata: { clerkUserId: userId, source: 'crowdsync-dj' },
    });
    const baseUrl = getBaseUrl(req);
    const successUrl = `${baseUrl}/boostify-crowdsync-dj?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/boostify-crowdsync-dj?payment=cancelled`;

    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: product.amount,
          recurring: product.mode === 'subscription' ? { interval: product.interval } : undefined,
        },
        quantity: 1,
      }],
      mode: product.mode,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      metadata: {
        type: 'crowdsync_dj',
        product: product.id,
        eventId: eventId || '',
        clerkUserId: userId,
        email: email || '',
      },
      subscription_data: product.mode === 'subscription' ? {
        metadata: {
          type: 'crowdsync_dj',
          product: product.id,
          eventId: eventId || '',
          clerkUserId: userId,
        },
      } : undefined,
    });

    await db.collection(PAYMENTS_COL).doc(session.id).set(clean({
      id: session.id,
      ownerId: userId,
      email,
      eventId,
      product: product.id,
      productName: product.name,
      mode: product.mode,
      amount: product.amount / 100,
      currency: 'usd',
      status: 'pending',
      checkoutUrl: session.url,
      stripeCustomerId: customer.id,
      stripeCheckoutSessionId: session.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }));

    if (eventId) {
      await addAction(eventId, { label: 'Stripe checkout created', detail: `${product.name} checkout session ready`, type: 'payment', payload: { sessionId: session.id, product: product.id } });
    }

    res.json({ success: true, url: session.url, sessionId: session.id, product: product.id });
  } catch (err: any) {
    console.error('[CrowdSyncDJ] checkout failed:', err);
    res.status(500).json({ success: false, error: err?.message || 'checkout failed' });
  }
});

router.post('/checkout/verify', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    if (!stripe) return res.status(503).json({ success: false, error: 'Stripe is not configured' });
    const sessionId = String(req.body?.sessionId || '');
    if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId is required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.metadata?.clerkUserId && session.metadata.clerkUserId !== userId) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    const paid = session.payment_status === 'paid' || session.status === 'complete';
    await db.collection(PAYMENTS_COL).doc(session.id).set(clean({
      id: session.id,
      ownerId: userId,
      eventId: session.metadata?.eventId || null,
      product: session.metadata?.product || 'crowdsync_dj',
      status: paid ? 'completed' : session.payment_status || session.status || 'pending',
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : null,
      currency: session.currency || 'usd',
      completedAt: paid ? FieldValue.serverTimestamp() : undefined,
      updatedAt: FieldValue.serverTimestamp(),
    }), { merge: true });

    const eventId = session.metadata?.eventId;
    if (paid && eventId) {
      const access = await assertEventAccess(userId, eventId);
      if (access.ok) {
        await access.ref.set({ billing: { status: 'active', product: session.metadata?.product || 'crowdsync_dj', stripeCheckoutSessionId: session.id, updatedAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        await addAction(eventId, { label: 'Stripe payment confirmed', detail: `${session.metadata?.product || 'CrowdSync'} is active`, type: 'payment', payload: { sessionId: session.id } });
      }
    }

    res.json({ success: true, paid, session: { id: session.id, status: session.status, paymentStatus: session.payment_status, amount: session.amount_total, currency: session.currency } });
  } catch (err: any) {
    console.error('[CrowdSyncDJ] checkout verify failed:', err);
    res.status(500).json({ success: false, error: err?.message || 'checkout verify failed' });
  }
});

// ─── POST /api/crowdsync-dj/webhook (Stripe) ────────────────────────────────
// Fulfils CrowdSync payments automatically (no client round-trip needed). The
// raw body for this route is mounted in server/index.ts (express.raw before the
// global json parser) so the Stripe signature can be verified. Only events
// whose metadata.type === 'crowdsync_dj' are acted on; everything else is
// acknowledged and ignored so it can share an account-wide endpoint safely.
router.post('/webhook', async (req: Request, res: Response) => {
  if (!stripe) return res.status(503).json({ received: false, error: 'Stripe is not configured' });
  const sig = req.headers['stripe-signature'] as string | undefined;
  const webhookSecret = process.env.STRIPE_CROWDSYNC_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[CrowdSyncDJ] webhook secret not configured');
    return res.status(500).json({ received: false, error: 'webhook secret not configured' });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig as string, webhookSecret);
  } catch (err: any) {
    console.error('[CrowdSyncDJ] webhook signature failed:', err?.message || err);
    return res.status(400).json({ received: false, error: `Webhook signature failed: ${err?.message}` });
  }

  // Mark a payment doc + (optionally) the event billing as a given status.
  const settlePayment = async (
    session: Stripe.Checkout.Session,
    status: 'completed' | 'cancelled' | 'pending',
  ) => {
    if (!db) return;
    const paid = status === 'completed';
    await db.collection(PAYMENTS_COL).doc(session.id).set(clean({
      id: session.id,
      ownerId: session.metadata?.clerkUserId || undefined,
      eventId: session.metadata?.eventId || null,
      product: session.metadata?.product || 'crowdsync_dj',
      status,
      stripeCheckoutSessionId: session.id,
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      amount: typeof session.amount_total === 'number' ? session.amount_total / 100 : undefined,
      currency: session.currency || undefined,
      completedAt: paid ? FieldValue.serverTimestamp() : undefined,
      cancelledAt: status === 'cancelled' ? FieldValue.serverTimestamp() : undefined,
      updatedAt: FieldValue.serverTimestamp(),
    }), { merge: true });

    const eventId = session.metadata?.eventId;
    if (eventId) {
      const ref = db.collection(EVENTS_COL).doc(eventId);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.set({
          billing: clean({
            status: paid ? 'active' : status === 'cancelled' ? 'cancelled' : 'pending',
            product: session.metadata?.product || 'crowdsync_dj',
            stripeCheckoutSessionId: session.id,
            updatedAt: FieldValue.serverTimestamp(),
          }),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        if (paid) {
          await addAction(eventId, { label: 'Stripe payment confirmed', detail: `${session.metadata?.product || 'CrowdSync'} is active`, type: 'payment', payload: { sessionId: session.id } });
        }
      }
    }
  };

  try {
    const obj: any = event.data.object;
    // Only handle CrowdSync events; quietly ack anything else.
    const isCrowdSync =
      obj?.metadata?.type === 'crowdsync_dj' ||
      String(obj?.metadata?.product || '').startsWith('crowdsync');

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = obj as Stripe.Checkout.Session;
        if (!isCrowdSync) break;
        const paid = session.payment_status === 'paid' || session.status === 'complete';
        await settlePayment(session, paid ? 'completed' : 'pending');
        break;
      }
      case 'checkout.session.async_payment_succeeded': {
        const session = obj as Stripe.Checkout.Session;
        if (!isCrowdSync) break;
        await settlePayment(session, 'completed');
        break;
      }
      case 'checkout.session.async_payment_failed':
      case 'checkout.session.expired': {
        const session = obj as Stripe.Checkout.Session;
        if (!isCrowdSync) break;
        await settlePayment(session, 'cancelled');
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = obj as Stripe.Subscription;
        if (sub.metadata?.type !== 'crowdsync_dj') break;
        const eventId = sub.metadata?.eventId;
        if (eventId && db) {
          const ref = db.collection(EVENTS_COL).doc(eventId);
          const snap = await ref.get();
          if (snap.exists) {
            await ref.set({ billing: { status: 'cancelled', updatedAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            await addAction(eventId, { label: 'Subscription cancelled', detail: 'CrowdSync DJ Pro subscription ended', type: 'payment', payload: { subscriptionId: sub.id } });
          }
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err: any) {
    console.error('[CrowdSyncDJ] webhook handler failed:', err);
    res.status(500).json({ received: false, error: err?.message || 'webhook handler failed' });
  }
});

router.post('/events', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const { config = {}, agent = {}, currentState = {} } = req.body || {};
    const eventId = shortId('crowdsync');
    const event = clean({
      ownerId: userId,
      name: config.eventName || 'CrowdSync Event',
      status: 'draft',
      config,
      agent,
      currentState: {
        energy: currentState.energy ?? 87,
        bpm: currentState.bpm ?? 122,
        mood: currentState.mood || 'Euforico',
        drop: currentState.drop ?? 48,
      },
      eventJson: buildEventJson({ config, agent, currentState }),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection(EVENTS_COL).doc(eventId).set(event);
    await addAction(eventId, { label: 'Evento creado', detail: `${event.name} guardado en CrowdSync DJ`, type: 'event' });
    res.json({ success: true, eventId, ...(await getFullEvent(eventId)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'event create failed' });
  }
});

router.get('/events/:id', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const access = await assertEventAccess(userId, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });
    res.json({ success: true, ...(await getFullEvent(req.params.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'event fetch failed' });
  }
});

router.patch('/events/:id', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const access = await assertEventAccess(userId, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });
    const patch = clean({
      name: req.body?.config?.eventName,
      config: req.body?.config,
      agent: req.body?.agent,
      currentState: req.body?.currentState,
      status: req.body?.status,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const nextEvent = { ...access.data, ...patch };
    patch.eventJson = buildEventJson(nextEvent);
    await access.ref.set(patch, { merge: true });
    await addAction(req.params.id, { label: 'Evento actualizado', detail: 'Configuracion y blueprint sincronizados', type: 'event' });
    res.json({ success: true, ...(await getFullEvent(req.params.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'event update failed' });
  }
});

router.post('/events/:id/live-session', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const access = await assertEventAccess(userId, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });
    const status = req.body?.status === 'paused' ? 'paused' : 'live';
    const ref = access.ref.collection('live_sessions').doc(shortId('session'));
    await ref.set({
      id: ref.id,
      status,
      source: req.body?.source || 'web-console',
      startedAt: FieldValue.serverTimestamp(),
      metrics: req.body?.metrics || access.data.currentState || {},
    });
    await access.ref.set({ status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await addAction(req.params.id, { label: status === 'live' ? 'Sesion en vivo' : 'Sesion pausada', detail: 'Estado del live engine sincronizado', type: 'session' });
    res.json({ success: true, sessionId: ref.id, ...(await getFullEvent(req.params.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'session failed' });
  }
});

router.post('/events/:id/camera-session', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const access = await assertEventAccess(userId, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });

    const status = ['active', 'stopped', 'error', 'permission_denied'].includes(req.body?.status)
      ? req.body.status
      : 'active';
    const sessionId = String(req.body?.sessionId || shortId('camera'));
    const ref = access.ref.collection('camera_sessions').doc(sessionId);
    const existing = await ref.get();
    const dimensions = clean({
      width: req.body?.width,
      height: req.body?.height,
      aspectRatio: req.body?.aspectRatio,
      frameRate: req.body?.frameRate,
    });
    const cameraSession = clean({
      id: sessionId,
      eventId: req.params.id,
      ownerId: userId,
      status,
      source: req.body?.source || 'mobile-camera',
      deviceLabel: req.body?.deviceLabel || null,
      facingMode: req.body?.facingMode || 'environment',
      permissionState: req.body?.permissionState || (status === 'active' ? 'granted' : status),
      dimensions,
      userAgent: req.body?.userAgent || req.headers['user-agent'] || null,
      lastHeartbeatAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: existing.exists ? undefined : FieldValue.serverTimestamp(),
      endedAt: status === 'stopped' || status === 'error' || status === 'permission_denied' ? FieldValue.serverTimestamp() : undefined,
    });

    await ref.set(cameraSession, { merge: true });
    const eventCameraSession = clean({
      enabled: status === 'active',
      sessionId,
      status,
      source: cameraSession.source,
      deviceLabel: cameraSession.deviceLabel,
      facingMode: cameraSession.facingMode,
      permissionState: cameraSession.permissionState,
      dimensions,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await access.ref.set({
      cameraSession: eventCameraSession,
      eventJson: buildEventJson({ ...access.data, cameraSession: eventCameraSession }),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await addAction(req.params.id, {
      label: status === 'active' ? 'Mobile camera active' : status === 'stopped' ? 'Mobile camera stopped' : 'Mobile camera issue',
      detail: `${eventCameraSession.source} ${status} (${eventCameraSession.facingMode || 'camera'})`,
      type: 'camera',
      payload: { sessionId, dimensions, permissionState: eventCameraSession.permissionState },
    });

    res.json({ success: true, cameraSessionId: sessionId, cameraSession: serialize({ id: sessionId, ...eventCameraSession }), ...(await getFullEvent(req.params.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'camera session failed' });
  }
});

router.post('/events/:id/analyze', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const access = await assertEventAccess(userId, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });
    const prev = access.data.currentState || {};
    const requestedEnergy = Number(req.body?.energy ?? prev.energy ?? 87);
    const frame = typeof req.body?.frame === 'string' && req.body.frame.startsWith('data:image/') ? req.body.frame : null;

    let energy: number | null = null;
    let bpm: number | null = null;
    let mood: CrowdMood | null = null;
    let danceActivity: number | null = null;
    let crowdDensity: number | null = null;
    let recommendation: string | null = null;
    let analysisSource = 'simulation';

    // Real AI crowd analysis: when a camera frame is provided, run OpenAI vision
    // on it instead of the simulated heuristic.
    if (frame && process.env.OPENAI_API_KEY) {
      try {
        const { default: OpenAI } = await import('openai');
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          response_format: { type: 'json_object' },
          max_tokens: 300,
          messages: [
            {
              role: 'system',
              content:
                'You are CrowdSync, an AI that analyzes live event crowd photos for DJs. Estimate the crowd state from the image. Reply ONLY with JSON: {"energy": number 55-99, "bpm": recommended BPM number 90-135, "mood": one of "Euforico"|"Subiendo"|"Intenso"|"Elegante", "danceActivity": number 0-100, "crowdDensity": number 0-100, "recommendation": short actionable DJ tip in Spanish (max 12 words)}.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: `Analyze this live crowd frame. Previous state: energy ${prev.energy ?? 87}, bpm ${prev.bpm ?? 122}, mood ${prev.mood || 'Euforico'}.` },
                { type: 'image_url', image_url: { url: frame, detail: 'low' } },
              ] as any,
            },
          ],
        });
        const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}');
        if (Number.isFinite(Number(parsed.energy))) {
          energy = Math.min(99, Math.max(55, Math.round(Number(parsed.energy))));
          bpm = Math.min(135, Math.max(90, Math.round(Number(parsed.bpm ?? prev.bpm ?? 122))));
          mood = moods.includes(parsed.mood) ? parsed.mood : null;
          danceActivity = Number.isFinite(Number(parsed.danceActivity)) ? Math.min(100, Math.max(0, Math.round(Number(parsed.danceActivity)))) : null;
          crowdDensity = Number.isFinite(Number(parsed.crowdDensity)) ? Math.min(100, Math.max(0, Math.round(Number(parsed.crowdDensity)))) : null;
          recommendation = typeof parsed.recommendation === 'string' && parsed.recommendation.trim() ? parsed.recommendation.trim().slice(0, 160) : null;
          analysisSource = 'openai-vision';
        }
      } catch (visionErr: any) {
        console.warn('[CrowdSyncDJ] Vision analysis failed, falling back to simulation:', visionErr?.message || visionErr);
      }
    }

    // Simulated fallback (no camera frame or vision unavailable).
    if (energy === null) {
      const delta = Math.random() > 0.45 ? 4 : -3;
      energy = Math.min(99, Math.max(55, requestedEnergy + delta));
      bpm = Math.min(135, Math.max(90, Number(prev.bpm ?? 122) + (energy >= requestedEnergy ? 2 : -1)));
    }
    if (!mood) mood = analysisSource === 'simulation' ? moods[Math.floor(Math.random() * moods.length)] : (prev.mood || 'Euforico');
    if (!recommendation) recommendation = energy > 86 ? 'Crear drop y publicar clip' : energy < 70 ? 'Bajar energia y activar visual elegante' : 'Subir percusion y preparar remix';
    if (danceActivity === null) danceActivity = Math.min(98, Math.max(40, energy - 9));
    if (crowdDensity === null) crowdDensity = Math.min(99, Math.max(35, energy - 6));

    const reading = {
      id: shortId('reading'),
      energy,
      bpm: bpm!,
      mood,
      danceActivity,
      crowdDensity,
      recommendation,
      source: analysisSource,
      privacyMode: true,
      createdAt: FieldValue.serverTimestamp(),
    };
    await access.ref.collection('crowd_readings').doc(reading.id).set(reading);
    const currentState = { ...prev, energy, bpm: bpm!, mood, drop: 48, lastRecommendation: recommendation };
    await access.ref.set({ currentState, status: 'live', eventJson: buildEventJson({ ...access.data, currentState }), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await addAction(req.params.id, {
      label: analysisSource === 'openai-vision' ? 'Analisis AI de camara' : 'Analisis anonimo',
      detail: `Energia ${energy}, mood ${mood}. Recomendacion: ${recommendation}`,
      type: 'analysis',
    });
    res.json({ success: true, reading: serialize(reading), currentState, ...(await getFullEvent(req.params.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'analysis failed' });
  }
});

router.post('/events/:id/actions', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const access = await assertEventAccess(userId, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });
    const { label = 'Accion CrowdSync', detail = 'Accion ejecutada', type = 'action', action: actionCode, bpmDelta } = req.body || {};
    const action = await addAction(req.params.id, { label, detail, type, payload: req.body?.payload || null });

    const state = access.data.currentState || {};
    const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    const normalized = String(label).toLowerCase();
    // Prefer an explicit, language-agnostic `action` code; fall back to parsing
    // the human label for backwards compatibility with older clients.
    const code = String(actionCode || '').toLowerCase();
    const isRaise = code === 'raise_energy' || (!code && normalized.includes('subir energia'));
    const isLower = code === 'lower_energy' || (!code && normalized.includes('bajar energia'));
    const isBpm = code === 'set_bpm' || code === 'change_bpm' || (!code && normalized.includes('bpm'));
    if (isRaise) patch.currentState = { ...state, energy: Math.min(99, Number(state.energy || 87) + 5), bpm: Math.min(135, Number(state.bpm || 122) + 2) };
    else if (isLower) patch.currentState = { ...state, energy: Math.max(55, Number(state.energy || 87) - 7), bpm: Math.max(90, Number(state.bpm || 122) - 3) };
    else if (isBpm) patch.currentState = { ...state, bpm: Math.min(135, Math.max(90, Number(state.bpm || 122) + (Number.isFinite(Number(bpmDelta)) ? Number(bpmDelta) : 1))) };
    if (Object.keys(patch).includes('currentState')) patch.eventJson = buildEventJson({ ...access.data, currentState: patch.currentState });
    await access.ref.set(patch, { merge: true });

    let asset = null;
    const assetCodes = new Set(['generate_music', 'live_remix', 'create_drop', 'create_loop', 'add_voice', 'visual_sync', 'publish_clip', 'save_moment', 'camera_snapshot']);
    if (assetCodes.has(code) || /generar|remix|drop|loop|voz|visual|clip|momento|camera|snapshot/i.test(label)) {
      const assetType =
        code === 'camera_snapshot' || normalized.includes('camera') || normalized.includes('snapshot')
          ? 'camera_snapshot'
          : code === 'visual_sync' || normalized.includes('visual')
            ? 'visual'
            : code === 'publish_clip' || normalized.includes('clip')
              ? 'social_clip'
              : 'audio';
      asset = await addGeneratedAsset(req.params.id, {
        type: assetType,
        title: label,
        detail,
        status: 'ready',
        provider: 'crowdsync-orchestrator',
        bpm: patch.currentState?.bpm || state.bpm || 122,
        energy: patch.currentState?.energy || state.energy || 87,
      });
    }

    res.json({ success: true, action, asset, ...(await getFullEvent(req.params.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'action failed' });
  }
});

router.post('/events/:id/generate-music', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const access = await assertEventAccess(userId, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });

    const email = currentEmail(req);
    const library = await getBoostifyMusicLibrary(userId, email);
    if (!library.pgUser || library.artists.length === 0) {
      return res.status(404).json({ success: false, error: 'No Boostify artist found for this account' });
    }

    const requestedArtistId = Number(req.body?.artistId || access.data?.config?.selectedArtistId || library.artists[0]?.id);
    const selectedArtist = library.artists.find((artist: any) => Number(artist.id) === requestedArtistId) || library.artists[0];
    const selectedSongId = req.body?.songId ? Number(req.body.songId) : Number(access.data?.config?.selectedSongId || 0);
    const selectedSong = library.songs.find((song: any) => Number(song.id) === selectedSongId) || null;
    const currentState = access.data.currentState || {};
    const baseGenre = String(req.body?.genre || selectedSong?.genre || selectedArtist.genre || selectedArtist.genres?.[0] || access.data?.config?.genres?.split?.(',')?.[0] || 'deep house').trim();
    const rawMood = String(req.body?.mood || selectedSong?.mood || currentState.mood || 'euphoric').trim();
    // The DJ-agent sliders steer the creative direction of the generated track.
    const creative = Math.min(100, Math.max(0, Number(req.body?.creative ?? access.data?.config?.creativityLevel ?? 88)));
    const sensitivity = Math.min(100, Math.max(0, Number(req.body?.sensitivity ?? access.data?.config?.crowdSensitivity ?? 92)));
    const creativeWords = creative >= 80 ? 'experimental, bold, genre-bending' : creative >= 50 ? 'fresh, modern' : 'classic, safe, familiar';
    const sensitivityWords = sensitivity >= 80 ? 'tightly locked to the crowd energy' : sensitivity >= 50 ? 'crowd-aware' : 'steady, set-driven';
    const baseMood = `${rawMood}, ${creativeWords}, ${sensitivityWords}`;
    const bpm = Number(req.body?.bpm || currentState.bpm || 124);
    const energy = Number(req.body?.energy || currentState.energy || 87);
    const artistName = artistDisplayName(selectedArtist);
    const title = String(req.body?.title || `CrowdSync ${rawMood} Drop ${new Date().toISOString().slice(11, 16).replace(':', '')}`);
    const artistGender = req.body?.artistGender === 'female' ? 'female' : 'male';
    const crowdContext = `${access.data?.config?.eventName || 'CrowdSync live event'} in ${access.data?.config?.city || 'the venue'} at ${bpm} BPM with energy ${energy}`;
    const customLyrics = req.body?.lyrics || `[intro]\nLights on the floor, the crowd is moving\n[verse]\n${artistName} in the signal, heartbeat in the room\nThe camera reads the wave and the night starts blooming\n[chorus]\nWe rise with the crowd, we move as one\nCrowdSync in the air until the morning sun\n[bridge]\n${crowdContext}\n[outro]\nHold the drop, let it shine`;

    // ── Async generation ──────────────────────────────────────────────────
    // FAL MiniMax music can take longer than the HTTP request timeout, so we
    // create a "processing" asset, respond immediately, and finish the heavy
    // work (FAL → Postgres → Firestore → pipelines) in a background job that
    // flips the asset to "ready" (or "failed"). The client polls GET /events/:id.
    const eventId = req.params.id;
    const asset = await addGeneratedAsset(eventId, {
      type: 'audio',
      title,
      detail: `${baseGenre} / ${rawMood} / ${bpm} BPM — generating with FAL MiniMax Music V2…`,
      status: 'processing',
      provider: 'fal-minimax-music-v2',
      artistId: selectedArtist.id,
      artistName,
      bpm,
      energy,
    });

    res.json({ success: true, status: 'processing', jobId: asset.id, asset, ...(await getFullEvent(eventId)) });

    // Background job (fire-and-forget). Errors are captured onto the asset doc.
    void (async () => {
      const assetRef = db.collection(EVENTS_COL).doc(eventId).collection('generated_assets').doc(asset.id);
      try {
        const musicResult = await generateArtistSongWithFAL(
          artistName,
          title,
          baseGenre,
          baseMood,
          artistGender,
          customLyrics,
          selectedArtist.biography || selectedArtist.masterJson?.biography || undefined,
          selectedArtist.masterJson || undefined,
        );

        if (!musicResult.success || !musicResult.audioUrl) {
          await assetRef.set({ status: 'failed', error: musicResult.error || 'MiniMax music generation failed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          await addAction(eventId, { label: 'Music generation failed', detail: musicResult.error || 'MiniMax music generation failed', type: 'music', payload: { assetId: asset.id } });
          return;
        }

        const [song] = await pgDb.insert(songs).values({
          userId: Number(selectedArtist.id),
          title,
          description: `${access.data?.name || 'CrowdSync'} AI-generated ${rawMood} ${baseGenre} track for live DJ performance (creative ${creative}, sensitivity ${sensitivity})`,
          audioUrl: musicResult.audioUrl,
          genre: baseGenre,
          mood: rawMood,
          lyrics: musicResult.lyrics || customLyrics,
          artistGender,
          generatedWithAI: true,
          aiProvider: musicResult.provider || 'fal-minimax-music-v2',
          isPublished: true,
        }).returning({ id: songs.id });

        try {
          await db.collection('songs').add({
            userId: Number(selectedArtist.id),
            artistId: Number(selectedArtist.id),
            artistName,
            name: title,
            title,
            audioUrl: musicResult.audioUrl,
            genre: baseGenre,
            mood: rawMood,
            lyrics: musicResult.lyrics || customLyrics,
            artistGender,
            generatedWithAI: true,
            aiProvider: musicResult.provider || 'fal-minimax-music-v2',
            source: 'crowdsync-dj',
            crowdSyncEventId: eventId,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } catch (syncError: any) {
          console.warn('[CrowdSyncDJ] Firestore song sync failed:', syncError?.message || syncError);
        }

        await assetRef.set({
          status: 'ready',
          detail: `${baseGenre} / ${rawMood} / ${bpm} BPM generated with FAL MiniMax Music V2`,
          provider: musicResult.provider || 'fal-minimax-music-v2',
          audioUrl: musicResult.audioUrl,
          songId: song.id,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        const nextConfig = {
          ...(access.data.config || {}),
          artist: artistName,
          selectedArtistId: selectedArtist.id,
          selectedSongId: song.id,
          currentTrackTitle: title,
          genres: access.data?.config?.genres || baseGenre,
        };
        await access.ref.set({
          config: nextConfig,
          currentState: { ...currentState, bpm, energy, mood: currentState.mood || 'Euforico' },
          eventJson: buildEventJson({ ...access.data, config: nextConfig, currentState: { ...currentState, bpm, energy } }),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        await addAction(eventId, { label: 'FAL MiniMax track generated', detail: `${title} saved to ${artistName}'s Boostify catalog`, type: 'music', payload: { songId: song.id, audioUrl: musicResult.audioUrl, assetId: asset.id } });

        if (email) {
          await chargeCredits(email, 'audio.minimax_music', {
            description: `CrowdSync MiniMax Music V2: ${title}`,
            metadata: { crowdSyncEventId: eventId, songId: song.id, artistId: selectedArtist.id },
          }).catch((creditError: any) => console.warn('[CrowdSyncDJ] credit charge failed:', creditError?.message || creditError));
        }

        try {
          const { triggerSongMonetizationPipeline } = await import('../services/song-monetization-pipeline');
          triggerSongMonetizationPipeline(song.id, { skipTokenization: false }).catch((err: any) =>
            console.warn(`[CrowdSyncDJ] Monetization pipeline failed for song #${song.id}:`, err?.message || err),
          );
        } catch (pipelineImportError: any) {
          console.warn('[CrowdSyncDJ] Monetization pipeline unavailable:', pipelineImportError?.message || pipelineImportError);
        }

        try {
          const { triggerSongAnalysis } = await import('../services/song-analysis-pipeline');
          triggerSongAnalysis(song.id).catch((err: any) =>
            console.warn(`[CrowdSyncDJ] Song analysis failed for song #${song.id}:`, err?.message || err),
          );
        } catch (analysisImportError: any) {
          console.warn('[CrowdSyncDJ] Song analysis unavailable:', analysisImportError?.message || analysisImportError);
        }
      } catch (jobErr: any) {
        console.error('[CrowdSyncDJ] generate music job failed:', jobErr);
        await assetRef.set({ status: 'failed', error: jobErr?.message || 'music generation failed', updatedAt: FieldValue.serverTimestamp() }, { merge: true }).catch(() => undefined);
        await addAction(eventId, { label: 'Music generation failed', detail: jobErr?.message || 'music generation failed', type: 'music', payload: { assetId: asset.id } }).catch(() => undefined);
      }
    })();
  } catch (err: any) {
    console.error('[CrowdSyncDJ] generate music failed:', err);
    res.status(500).json({ success: false, error: err?.message || 'music generation failed' });
  }
});

router.put('/agents/current', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const agent = clean({
      ownerId: userId,
      name: req.body?.name || 'LUXA VIBE',
      style: req.body?.style || 'AI luxury deep house DJ',
      creative: req.body?.creative ?? 88,
      sensitivity: req.body?.sensitivity ?? 92,
      toggles: req.body?.toggles || {},
      updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection(AGENTS_COL).doc(userId).set(agent, { merge: true });
    if (req.body?.eventId) {
      const access = await assertEventAccess(userId, String(req.body.eventId));
      if (access.ok) {
        await access.ref.set({ agent, eventJson: buildEventJson({ ...access.data, agent }), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        await addAction(String(req.body.eventId), { label: 'Agente guardado', detail: 'LUXA VIBE sincronizado con la base de datos', type: 'agent' });
      }
    }
    res.json({ success: true, agent: serialize(agent) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'agent save failed' });
  }
});

router.post('/events/:id/network-posts', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const access = await assertEventAccess(userId, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });
    const postRef = db.collection(NETWORK_COL).doc(shortId('post'));
    const post = clean({
      id: postRef.id,
      ownerId: userId,
      eventId: req.params.id,
      name: req.body?.name || 'DJ Nova Lux',
      role: req.body?.role || 'Set publicado desde CrowdSync DJ',
      title: req.body?.title || access.data?.name || 'CrowdSync Live Set',
      location: req.body?.location || access.data?.config?.city || 'Live',
      views: req.body?.views || '0',
      likes: req.body?.likes || 0,
      image: req.body?.image || null,
      createdAt: FieldValue.serverTimestamp(),
    });
    await postRef.set(post);
    await addAction(req.params.id, { label: 'Publicado en DJ Network', detail: `${post.title} enviado al feed`, type: 'network' });
    res.json({ success: true, post: serialize(post), ...(await getFullEvent(req.params.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'network publish failed' });
  }
});

router.post('/events/:id/reports', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const access = await assertEventAccess(userId, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });
    const full = await getFullEvent(req.params.id);
    const readings = full.readings || [];
    const assets = full.generatedAssets || [];
    const peak = readings.reduce((max: any, reading: any) => Number(reading.energy || 0) > Number(max.energy || 0) ? reading : max, readings[0] || access.data.currentState || {});
    const reportRef = access.ref.collection('event_reports').doc(shortId('report'));
    const report = {
      id: reportRef.id,
      eventId: req.params.id,
      peakEnergy: peak.energy || access.data.currentState?.energy || 87,
      peakMood: peak.mood || access.data.currentState?.mood || 'Euforico',
      bestGenre: 'Latin afro house',
      generatedTracks: assets.filter((asset: any) => asset.type === 'audio').length,
      socialClips: assets.filter((asset: any) => asset.type === 'social_clip').length,
      recommendations: [
        'Guardar el drop de mayor energia como single promocional',
        'Publicar recap corto en Boostify Network y Reels',
        'Crear playlist post-evento con los remixes generados',
      ],
      createdAt: FieldValue.serverTimestamp(),
    };
    await reportRef.set(report);
    await access.ref.set({ status: 'reported', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await addAction(req.params.id, { label: 'Reporte generado', detail: `Peak energy ${report.peakEnergy}. ${report.generatedTracks} audios creados`, type: 'report' });
    res.json({ success: true, report: serialize(report), ...(await getFullEvent(req.params.id)) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'report failed' });
  }
});

// ─── DJ Database / Directory ─────────────────────────────────────────────────

/** DJ directory: all registered CrowdSync DJs ranked by activity (events, sets, likes). */
router.get('/djs', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const [djsSnap, postsSnap] = await Promise.all([
      db.collection(DJS_COL).limit(100).get(),
      db.collection(NETWORK_COL).orderBy('createdAt', 'desc').limit(120).get().catch(() => ({ docs: [] as any[] })),
    ]);

    // Aggregate network-post stats per DJ (by ownerId, falling back to display name)
    const postStats = new Map<string, { posts: number; likes: number; lastTitle?: string; lastLocation?: string; image?: string }>();
    for (const doc of (postsSnap as any).docs) {
      const post = doc.data() || {};
      for (const key of [post.ownerId, post.name].filter(Boolean).map(String)) {
        const stats = postStats.get(key) || { posts: 0, likes: 0 };
        stats.posts += 1;
        stats.likes += Number(post.likes || 0);
        if (!stats.lastTitle) {
          stats.lastTitle = post.title || undefined;
          stats.lastLocation = post.location || undefined;
          stats.image = post.image || undefined;
        }
        postStats.set(key, stats);
      }
    }

    const djs = djsSnap.docs
      .map((doc) => {
        const data = docData(doc) as Record<string, any>;
        const stats = postStats.get(doc.id) || postStats.get(String(data.name || '')) || { posts: 0, likes: 0 };
        return {
          ...data,
          posts: stats.posts,
          likes: stats.likes,
          lastSetTitle: stats.lastTitle || null,
          lastSetLocation: stats.lastLocation || data.city || null,
          image: data.image || stats.image || null,
          score: Number(data.eventsCount || 0) * 10 + stats.likes + stats.posts * 5,
        };
      })
      .sort((a, b) => b.score - a.score);

    res.json({ success: true, djs, total: djs.length });
  } catch (err: any) {
    console.error('[CrowdSyncDJ] djs directory failed:', err);
    res.status(500).json({ success: false, error: err?.message || 'dj directory failed' });
  }
});

/** Register / update the current user's DJ profile in the directory. */
router.post('/djs/register', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const email = currentEmail(req);
    const extras = clean({
      name: typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim().slice(0, 80) : undefined,
      style: typeof req.body?.style === 'string' && req.body.style.trim() ? req.body.style.trim().slice(0, 120) : undefined,
      city: typeof req.body?.city === 'string' && req.body.city.trim() ? req.body.city.trim().slice(0, 80) : undefined,
      genres: Array.isArray(req.body?.genres) ? req.body.genres.map((g: any) => String(g).slice(0, 40)).slice(0, 8) : undefined,
      image: typeof req.body?.image === 'string' && /^https?:\/\//.test(req.body.image) ? req.body.image : undefined,
    });
    const profile = await upsertDjProfile(userId, email, extras);
    res.json({ success: true, dj: profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'dj register failed' });
  }
});

const INVITE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invite a DJ or a Boostify artist to a CrowdSync event (stored + emailed). */
router.post('/events/:id/invite', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res);
    if (!userId) return;
    const access = await assertEventAccess(userId, req.params.id);
    if (!access.ok) return res.status(access.status).json({ success: false, error: access.error });

    const type = req.body?.type === 'artist' ? 'artist' : 'dj';
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !INVITE_EMAIL_RE.test(email)) {
      return res.status(400).json({ success: false, error: 'A valid email address is required' });
    }
    const name = typeof req.body?.name === 'string' && req.body.name.trim() ? req.body.name.trim().slice(0, 80) : null;
    const message = typeof req.body?.message === 'string' && req.body.message.trim() ? req.body.message.trim().slice(0, 500) : null;

    const eventName = access.data?.name || access.data?.config?.eventName || 'CrowdSync Live Event';
    const eventCity = access.data?.config?.city || '';
    const eventVenue = access.data?.config?.venue || '';

    // Dedupe: one pending invite per email per event
    const dupSnap = await access.ref.collection('invites').where('email', '==', email).limit(1).get();
    if (!dupSnap.empty) {
      return res.json({ success: true, alreadyInvited: true, invite: docData(dupSnap.docs[0]) });
    }

    const inviteRef = access.ref.collection('invites').doc(shortId('invite'));
    const invite = clean({
      id: inviteRef.id,
      eventId: req.params.id,
      type,
      email,
      name,
      message,
      status: 'sent',
      invitedBy: userId,
      createdAt: FieldValue.serverTimestamp(),
    });
    await inviteRef.set(invite);

    const pageUrl = `${getBaseUrl(req)}/boostify-crowdsync-dj`;
    const roleLabel = type === 'dj' ? 'DJ' : 'Artist';
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;background:#07090c;color:#e4e4e7;padding:32px;border-radius:12px;max-width:560px;margin:auto">
        <h2 style="color:#fb923c;margin:0 0 8px">You're invited as a ${roleLabel} 🎧</h2>
        <p style="margin:0 0 16px;color:#a1a1aa">${name ? `Hi ${name}, you` : 'You'} have been invited to join <b style="color:#fff">${eventName}</b>${eventCity || eventVenue ? ` at ${[eventVenue, eventCity].filter(Boolean).join(', ')}` : ''} on Boostify CrowdSync DJ.</p>
        ${message ? `<blockquote style="border-left:3px solid #fb923c;margin:0 0 16px;padding:8px 12px;color:#d4d4d8;background:#101418;border-radius:0 8px 8px 0">${message}</blockquote>` : ''}
        <p style="margin:0 0 24px;color:#a1a1aa">CrowdSync DJ is the AI live-event platform: real-time crowd intelligence, AI music generation, and the Boostify DJ Network.</p>
        <a href="${pageUrl}" style="display:inline-block;background:#ea580c;color:#fff;font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:8px">Join the event →</a>
        <p style="margin:24px 0 0;font-size:12px;color:#52525b">Boostify Music · CrowdSync DJ Platform</p>
      </div>`;
    void sendCrowdSyncEmail(email, `🎧 Invitation: ${eventName} — Boostify CrowdSync DJ`, html).catch((mailErr: any) =>
      console.warn('[CrowdSyncDJ] invite email failed:', mailErr?.message || mailErr),
    );

    await addAction(req.params.id, {
      label: type === 'dj' ? 'DJ invitado' : 'Artista invitado',
      detail: `${name || email} invitado a ${eventName}`,
      type: 'invite',
      payload: { inviteId: inviteRef.id, email, inviteType: type },
    });

    res.json({ success: true, invite: serialize(invite), ...(await getFullEvent(req.params.id)) });
  } catch (err: any) {
    console.error('[CrowdSyncDJ] invite failed:', err);
    res.status(500).json({ success: false, error: err?.message || 'invite failed' });
  }
});

// ─── CrowdSync Waitlist ──────────────────────────────────────────────────────
const WAITLIST_COL = 'crowdsync_waitlist';
const ADMIN_LEAD_EMAIL = 'convoycubano@gmail.com';

// Verified senders: Brevo → info@boostifymusic.com | Resend → info@boostifymusic.site
const BREVO_FROM = 'info@boostifymusic.com';
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'info@boostifymusic.site';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Send via Resend (primary) with Brevo as fallback.
 * Both keys are present in .env — this ensures delivery.
 */
async function sendCrowdSyncEmail(to: string, subject: string, htmlContent: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;

  // ── Try Resend first ──────────────────────────────────────────────────────
  if (resendKey) {
    try {
      const res = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `CrowdSync DJ <${RESEND_FROM}>`,
          to: [to],
          subject,
          html: htmlContent,
        }),
      });
      const result: any = await res.json();
      if (result?.id) {
        console.log(`✅ CrowdSync email sent via Resend → ${to} (id: ${result.id})`);
        return;
      }
      console.warn('⚠️ Resend did not return id — falling back to Brevo:', result);
    } catch (err: any) {
      console.warn('⚠️ Resend CrowdSync send failed — falling back to Brevo:', err.message);
    }
  }

  // ── Brevo fallback ────────────────────────────────────────────────────────
  if (!brevoKey) {
    console.error('❌ Neither RESEND_API_KEY nor BREVO_API_KEY configured — email NOT sent to:', to);
    return;
  }
  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': brevoKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: BREVO_FROM, name: 'CrowdSync DJ' },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });
    const result: any = await res.json();
    if (result?.messageId) {
      console.log(`✅ CrowdSync email sent via Brevo → ${to} (messageId: ${result.messageId})`);
    } else {
      console.error('❌ Brevo CrowdSync error:', JSON.stringify(result));
    }
  } catch (err: any) {
    console.error('❌ Brevo CrowdSync send failed:', err.message);
  }
}

function buildWelcomeEmail(_email: string, launchDate: string): string {
  const features = [
    ['🎧', 'Real-Time Crowd Intelligence', 'AI reads energy, mood &amp; density from your live event feed'],
    ['🎵', 'Live Music Generation', 'Generate tracks on the fly perfectly tuned to the crowd\'s vibe'],
    ['📊', 'Live Analytics Dashboard', 'BPM, crowd density, drop timing — all visible in one glance'],
    ['📸', 'Camera-Powered Crowd Reading', 'Turn your phone into a live crowd sensor in seconds'],
    ['🌐', 'Boostify DJ Network', 'Publish your sets and connect with top DJs worldwide'],
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>You're on the CrowdSync DJ Waitlist</title>
</head>
<body style="margin:0;padding:0;background-color:#07090c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#07090c;padding:48px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border-radius:20px;overflow:hidden;border:1px solid rgba(255,140,0,0.25);box-shadow:0 24px 80px rgba(255,100,0,0.12);">

        <!-- ── Hero Header ───────────────────────────────────────────────── -->
        <tr>
          <td style="background:linear-gradient(160deg,#1c0800 0%,#2a1000 40%,#100028 100%);padding:56px 40px 44px;text-align:center;">
            <!-- Badge -->
            <div style="display:inline-block;border:1px solid rgba(255,140,0,0.45);border-radius:100px;padding:6px 18px;margin-bottom:28px;">
              <span style="color:#ff8c00;font-size:10px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">⚡ Early Access — Waitlist</span>
            </div>
            <!-- Logo pill -->
            <div style="display:inline-flex;align-items:center;background:linear-gradient(135deg,#ff6a00,#cc3700);border-radius:14px;padding:14px 24px;margin-bottom:28px;">
              <span style="color:#fff;font-size:18px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">CrowdSync DJ</span>
              <span style="color:rgba(255,255,255,0.55);font-size:11px;font-weight:700;margin-left:10px;letter-spacing:1px;">by BOOSTIFY</span>
            </div>
            <h1 style="color:#ffffff;font-size:36px;font-weight:900;margin:0 0 12px;line-height:1.1;letter-spacing:-0.5px;">You're on the list. 🎧</h1>
            <p style="color:#ff8c00;font-size:17px;margin:0;font-weight:600;line-height:1.5;">The future of live DJ intelligence is almost here.</p>
          </td>
        </tr>

        <!-- ── Divider line ───────────────────────────────────────────────── -->
        <tr>
          <td style="background:linear-gradient(90deg,transparent,rgba(255,140,0,0.5),transparent);height:1px;padding:0;line-height:1px;font-size:1px;">&nbsp;</td>
        </tr>

        <!-- ── Body ─────────────────────────────────────────────────────── -->
        <tr>
          <td style="background:#0e1117;padding:44px 40px 32px;">
            <p style="color:#cbd5e1;font-size:15px;line-height:1.8;margin:0 0 32px;">
              Welcome to the CrowdSync DJ waitlist. You're one of the first to access the platform that <strong style="color:#f1f5f9;">reads crowds in real time</strong>, generates AI music on the fly, and turns every event into an unforgettable experience.
            </p>

            <!-- Launch box -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(255,140,0,0.07),rgba(168,85,247,0.07));border:1px solid rgba(255,140,0,0.35);border-radius:14px;margin-bottom:36px;">
              <tr>
                <td style="padding:28px;text-align:center;">
                  <p style="color:#94a3b8;font-size:10px;letter-spacing:4px;text-transform:uppercase;margin:0 0 6px;">🗓 Official Launch</p>
                  <p style="color:#ff8c00;font-size:30px;font-weight:900;margin:0 0 6px;letter-spacing:-0.5px;">${launchDate}</p>
                  <p style="color:#475569;font-size:12px;margin:0;">Mark your calendar — waitlist gets priority access.</p>
                </td>
              </tr>
            </table>

            <!-- Features heading -->
            <p style="color:#f1f5f9;font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;margin:0 0 20px;border-left:3px solid #ff6a00;padding-left:12px;">What you unlock on launch day</p>

            <!-- Feature rows -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${features.map(([icon, title, desc]) => `
              <tr>
                <td style="padding:12px 0;vertical-align:top;width:52px;">
                  <div style="background:linear-gradient(135deg,rgba(255,140,0,0.15),rgba(255,70,0,0.08));border:1px solid rgba(255,140,0,0.2);border-radius:10px;width:44px;height:44px;text-align:center;line-height:44px;font-size:20px;">${icon}</div>
                </td>
                <td style="padding:12px 0 12px 14px;vertical-align:middle;border-bottom:1px solid rgba(255,255,255,0.04);">
                  <p style="color:#f1f5f9;font-size:14px;font-weight:700;margin:0 0 3px;">${title}</p>
                  <p style="color:#64748b;font-size:13px;margin:0;line-height:1.5;">${desc}</p>
                </td>
              </tr>`).join('')}
            </table>
          </td>
        </tr>

        <!-- ── CTA ──────────────────────────────────────────────────────── -->
        <tr>
          <td style="background:#0e1117;padding:0 40px 44px;text-align:center;">
            <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:36px;">
              <p style="color:#94a3b8;font-size:14px;margin:0 0 22px;line-height:1.6;">While you wait, explore what Boostify Music already offers<br>for independent artists and DJs worldwide.</p>
              <a href="https://www.boostifymusic.com" style="display:inline-block;background:linear-gradient(135deg,#ff6a00,#cc3700);color:#fff;text-decoration:none;font-size:13px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:16px 40px;border-radius:10px;box-shadow:0 8px 24px rgba(255,100,0,0.35);">Explore Boostify &rarr;</a>
            </div>
          </td>
        </tr>

        <!-- ── Footer ───────────────────────────────────────────────────── -->
        <tr>
          <td style="background:#07090c;padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="color:#334155;font-size:11px;margin:0 0 4px;">You received this because you joined the CrowdSync DJ waitlist.</p>
            <p style="color:#334155;font-size:11px;margin:0;">© 2026 Boostify Music &nbsp;·&nbsp; Miami, FL &nbsp;·&nbsp; <a href="https://www.boostifymusic.com" style="color:#475569;text-decoration:none;">boostifymusic.com</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildAdminLeadEmail(email: string, name: string | undefined, joinedAt: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>🎯 New CrowdSync DJ Lead</title>
</head>
<body style="margin:0;padding:0;background-color:#07090c;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#07090c;padding:48px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-radius:16px;overflow:hidden;border:1px solid rgba(168,85,247,0.35);box-shadow:0 16px 60px rgba(100,0,200,0.15);">

        <!-- ── Header ───────────────────────────────────────────────────── -->
        <tr>
          <td style="background:linear-gradient(160deg,#0d0520 0%,#170a36 60%,#0a1a30 100%);padding:36px 36px 28px;text-align:center;">
            <div style="display:inline-block;border:1px solid rgba(168,85,247,0.4);border-radius:100px;padding:5px 16px;margin-bottom:16px;">
              <span style="color:#a855f7;font-size:9px;font-weight:900;letter-spacing:4px;text-transform:uppercase;">🎯 New Lead Alert</span>
            </div>
            <h2 style="color:#ffffff;font-size:22px;font-weight:900;margin:0;letter-spacing:-0.3px;">CrowdSync DJ Waitlist</h2>
            <p style="color:#94a3b8;font-size:13px;margin:8px 0 0;">Someone just reserved their spot.</p>
          </td>
        </tr>

        <!-- ── Lead Details ──────────────────────────────────────────────── -->
        <tr>
          <td style="background:#0e1117;padding:32px 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">📧 Email</td>
                <td style="text-align:right;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <a href="mailto:${email}" style="color:#60a5fa;font-size:15px;font-weight:700;text-decoration:none;">${email}</a>
                </td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">👤 Name</td>
                <td style="color:#f1f5f9;font-size:14px;font-weight:600;text-align:right;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">${name || '<span style="color:#475569;font-style:italic;">Not provided</span>'}</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">🕐 Joined at</td>
                <td style="color:#f1f5f9;font-size:14px;text-align:right;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.06);">${joinedAt}</td>
              </tr>
              <tr>
                <td style="color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;padding:14px 0;">🔗 Source</td>
                <td style="text-align:right;padding:14px 0;">
                  <span style="background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.3);color:#c084fc;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 12px;border-radius:100px;">CrowdSync Waitlist</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Footer ───────────────────────────────────────────────────── -->
        <tr>
          <td style="background:#07090c;padding:20px 36px;text-align:center;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="color:#334155;font-size:11px;margin:0;">Boostify CrowdSync DJ &nbsp;·&nbsp; Automated lead notification</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

router.post('/waitlist', async (req: Request, res: Response) => {
  const { email, name } = req.body || {};
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.json({ success: false, error: 'Please enter a valid email address.' });
  }

  if (!db) {
    console.warn('⚠️ CrowdSync waitlist: Firestore unavailable — logging lead:', email.trim().toLowerCase());
    return res.json({ success: true, message: "You're on the waitlist! We'll be in touch soon." });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const joinedAt = new Date().toISOString();
    const launchDate = 'June 5, 2026';

    // Check for duplicate
    const existing = await db.collection(WAITLIST_COL).where('email', '==', normalizedEmail).limit(1).get();
    if (!existing.empty) {
      return res.json({ success: true, alreadyRegistered: true, message: "You're already on the waitlist!" });
    }

    // Save to Firestore
    await db.collection(WAITLIST_COL).add({
      email: normalizedEmail,
      name: name?.trim() || null,
      joinedAt,
      source: 'crowdsync_waitlist',
      createdAt: FieldValue.serverTimestamp(),
    });

    // Send confirmation to subscriber (non-blocking)
    sendCrowdSyncEmail(
      normalizedEmail,
      "🎧 You're on the CrowdSync DJ Waitlist — Launch in 30 days!",
      buildWelcomeEmail(normalizedEmail, launchDate),
    ).catch((e) => console.error('❌ Brevo welcome email failed:', e?.message));

    // Notify admin (non-blocking)
    sendCrowdSyncEmail(
      ADMIN_LEAD_EMAIL,
      `🎯 New CrowdSync Waitlist Signup: ${normalizedEmail}`,
      buildAdminLeadEmail(normalizedEmail, name?.trim(), new Date(joinedAt).toLocaleString()),
    ).catch((e) => console.error('❌ Brevo admin email failed:', e?.message));

    console.log(`✅ CrowdSync waitlist: ${normalizedEmail} added`);
    return res.json({ success: true, message: "You're on the waitlist! Check your email." });
  } catch (err: any) {
    console.error('❌ CrowdSync waitlist error:', err);
    return res.json({ success: false, error: 'Failed to save your request. Please try again.' });
  }
});

export default router;