/**
 * Artist Growth Engine (AGE) - Backend Routes
 *
 * Sistema que vende el paquete maestro "Crea Tu Artista Digital + Curso de Videos
 * Musicales con IA" ($500) y aplica la regla "no se crea un nuevo artista hasta
 * que el actual confirme 2 ventas".
 *
 * Mounted at: /api/age
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { eq, and, isNull, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  ageArtistGrowthUnits,
  ageFingerprints,
  ageLeads,
  ageWizardSessions,
  agePurchases,
  ageCampaignMetrics,
  ageFinanceLedger,
  ageExpansionApprovals,
} from '../db/schema';
import { generateImageWithGPTImage1, generateImageWithNanoBanana } from '../services/fal-service';
import { PRODUCTION_URL } from '../../shared/constants';

const router = Router();

const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' as any }) : null;

const PRICE_USD_CENTS = 50000; // $500
const REQUIRED_SALES = 2;
const REQUIRED_REVENUE_CENTS = 100000; // $1,000
const NEW_ARTIST_RESERVE_CENTS = 10000; // $100 (10%)

const getBaseUrl = () => {
  if (process.env.NODE_ENV === 'production') return process.env.PRODUCTION_URL || PRODUCTION_URL;
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`;
  return 'http://localhost:5000';
};

// ============================================================================
//  HELPERS
// ============================================================================

function hashString(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);
}

function ensureVisitorId(req: Request, res: Response): string {
  let id = req.cookies?.age_visitor_id;
  if (!id) {
    id = crypto.randomUUID();
    res.cookie('age_visitor_id', id, {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 días
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return id;
}

async function getOrCreateUnitBySlug(slug: string, fallbackName?: string) {
  const existing = await db.select().from(ageArtistGrowthUnits).where(eq(ageArtistGrowthUnits.slug, slug)).limit(1);
  if (existing.length) return existing[0];

  const [created] = await db
    .insert(ageArtistGrowthUnits)
    .values({
      slug,
      artistName: fallbackName || slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      status: 'testing',
      personalizedMessage:
        'Crea tu propio artista digital con Boostify. Sistema completo: nombre, concepto, música, imagen y curso para producir videos con IA.',
    })
    .returning();
  return created;
}

// ============================================================================
//  PUBLIC LANDING DATA
//  GET /api/age/landing/:slug?  (slug opcional → unit por defecto)
// ============================================================================

router.get('/landing/:slug?', async (req: Request, res: Response) => {
  try {
    const slug = (req.params.slug || 'boostify').toLowerCase().trim();
    const unit = await getOrCreateUnitBySlug(slug);
    const visitorId = ensureVisitorId(req, res);

    // Persist fingerprint si trae UTMs
    const utm = req.query as Record<string, string>;
    if (utm.utm_source || utm.utm_campaign || utm.utm_content || utm.ad_id || utm.campaign_id) {
      await db.insert(ageFingerprints).values({
        unitId: unit.id,
        visitorId,
        campaignId: utm.campaign_id || null,
        adId: utm.ad_id || null,
        trafficSource: utm.utm_source || null,
        utmSource: utm.utm_source || null,
        utmCampaign: utm.utm_campaign || null,
        utmContent: utm.utm_content || null,
        referralCode: utm.ref || null,
        ipHash: hashString(req.ip || ''),
        userAgentHash: hashString(req.headers['user-agent'] || ''),
      });
    }

    res.json({
      success: true,
      visitorId,
      unit: {
        id: unit.id,
        slug: unit.slug,
        artistName: unit.artistName,
        avatarUrl: unit.avatarUrl,
        teaserVideoUrl: unit.teaserVideoUrl,
        personalizedMessage: unit.personalizedMessage,
        personality: unit.personality,
        aesthetic: unit.aesthetic,
        genre: unit.genre,
      },
      product: {
        sku: 'AGE_MASTER_500',
        name: 'Crea Tu Artista Digital + Curso de Videos Musicales con IA',
        priceUsd: 500,
        perceivedValueUsd: 5500,
      },
    });
  } catch (err: any) {
    console.error('[AGE] landing error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
//  WIZARD - genera preview gratuito (OpenAI gpt-image-1 + texto)
//  POST /api/age/wizard
// ============================================================================

router.post('/wizard', async (req: Request, res: Response) => {
  try {
    const {
      slug,
      email,
      name,
      phone,
      language,
      artistType,
      genre,
      personality,
      aesthetic,
      audience,
      monetization,
      videoStyle,
      experience,
      affiliateInterest,
    } = req.body || {};

    if (!email) return res.status(400).json({ success: false, error: 'Email requerido' });

    const unit = await getOrCreateUnitBySlug((slug || 'boostify').toLowerCase().trim());
    const visitorId = ensureVisitorId(req, res);

    // Fingerprint match
    const [fp] = await db
      .select()
      .from(ageFingerprints)
      .where(and(eq(ageFingerprints.unitId, unit.id), eq(ageFingerprints.visitorId, visitorId)))
      .limit(1);

    // Lead upsert (por email + unit)
    const existingLeads = await db
      .select()
      .from(ageLeads)
      .where(and(eq(ageLeads.unitId, unit.id), eq(ageLeads.email, email)))
      .limit(1);

    let leadId: number;
    if (existingLeads.length) {
      leadId = existingLeads[0].id;
      await db
        .update(ageLeads)
        .set({
          status: 'wizard_complete',
          name: name || existingLeads[0].name,
          phone: phone || existingLeads[0].phone,
          language: language || existingLeads[0].language,
          lastTouchAt: new Date(),
        })
        .where(eq(ageLeads.id, leadId));
    } else {
      const [created] = await db
        .insert(ageLeads)
        .values({
          unitId: unit.id,
          fingerprintId: fp?.id || null,
          email,
          name: name || null,
          phone: phone || null,
          language: language || null,
          status: 'wizard_complete',
        })
        .returning();
      leadId = created.id;
    }

    // Generar preview con AI
    const conceptName = await generateConceptName({ artistType, genre, aesthetic, personality });
    const conceptDescription = `Un artista ${aesthetic || 'visualmente único'} de ${genre || 'género propio'} con personalidad ${personality || 'auténtica'}. Dirigido a ${audience || 'audiencia conectada'}, con foco en ${monetization || 'monetización por video'}.`;

    const visualPrompt = [
      `Editorial portrait of a digital music artist named "${conceptName}".`,
      `Genre: ${genre || 'pop'}. Aesthetic: ${aesthetic || 'cinematic, modern, colorful'}.`,
      `Personality: ${personality || 'confident, magnetic'}. Audience: ${audience || 'global gen-z'}.`,
      `Studio lighting, premium album-cover composition, no text, ultra-detailed, 4k.`,
    ].join(' ');

    let previewImageUrl: string | null = null;
    let provider = 'none';
    try {
      const openai = await generateImageWithGPTImage1(visualPrompt, { size: '1024x1024', quality: 'high' });
      if (openai.success && openai.imageUrl) {
        previewImageUrl = openai.imageUrl;
        provider = 'openai:gpt-image-1';
      } else {
        const fal = await generateImageWithNanoBanana(visualPrompt, { aspectRatio: '1:1', outputFormat: 'png' });
        if (fal.success && fal.imageUrl) {
          previewImageUrl = fal.imageUrl;
          provider = 'fal:nano-banana-2';
        }
      }
    } catch (e) {
      console.warn('[AGE] preview image generation failed:', e);
    }

    const preview = {
      name: conceptName,
      description: conceptDescription,
      visualStyle: aesthetic || 'cinematic-modern',
      singleIdea: `"${conceptName}: ${pickHook(genre, aesthetic)}"`,
      videoConcept: videoStyle || 'Performance + retrato cinematográfico con luz dramática',
      provider,
    };

    const inputs = {
      artistType,
      genre,
      personality,
      aesthetic,
      audience,
      monetization,
      videoStyle,
      experience,
      affiliateInterest,
      language,
    };

    const [session] = await db
      .insert(ageWizardSessions)
      .values({
        leadId,
        unitId: unit.id,
        inputs,
        preview,
        previewImageUrl,
        completed: true,
      })
      .returning();

    res.json({
      success: true,
      sessionId: session.id,
      leadId,
      preview,
      previewImageUrl,
    });
  } catch (err: any) {
    console.error('[AGE] wizard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

function pickHook(genre?: string, aesthetic?: string) {
  const hooks = [
    'una nueva voz emerge en la escena',
    'el sonido que cambia la noche',
    'identidad pura, energía cruda',
    'la próxima estrella digital',
    'cuando la música se vuelve identidad',
  ];
  const idx = ((genre?.length || 0) + (aesthetic?.length || 0)) % hooks.length;
  return hooks[idx];
}

async function generateConceptName(args: { artistType?: string; genre?: string; aesthetic?: string; personality?: string }) {
  // MVP: heurística determinista. Fase 2: LLM.
  const seeds = [
    'Lumen', 'Nova', 'Echo', 'Vela', 'Iris', 'Solé', 'Kira', 'Ravo', 'Mira', 'Zenit',
    'Halo', 'Onyx', 'Rune', 'Sable', 'Aurora', 'Vex', 'Moon', 'Solas',
  ];
  const surnames = ['Vega', 'Royal', 'Ortega', 'Storm', 'Lunar', 'Nights', 'Vibe', 'Castle', 'Wave', 'Rivera'];
  const hash = (args.genre || '') + (args.aesthetic || '') + (args.personality || '') + Date.now();
  const a = seeds[hash.length % seeds.length];
  const b = surnames[(hash.length * 7) % surnames.length];
  return `${a} ${b}`;
}

// ============================================================================
//  CHECKOUT - Crea sesión de Stripe para el paquete $500
//  POST /api/age/checkout
// ============================================================================

router.post('/checkout', async (req: Request, res: Response) => {
  try {
    if (!stripe) return res.status(500).json({ success: false, error: 'Stripe no configurado' });

    const { slug, email, leadId, sessionId } = req.body || {};
    if (!email) return res.status(400).json({ success: false, error: 'Email requerido' });

    const unit = await getOrCreateUnitBySlug((slug || 'boostify').toLowerCase().trim());
    const baseUrl = getBaseUrl();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: PRICE_USD_CENTS,
            product_data: {
              name: 'Crea Tu Artista Digital + Curso de Videos Musicales con IA',
              description:
                'Paquete maestro Boostify: artista digital completo, curso, herramientas, plan de monetización y programa de afiliados.',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        age: '1',
        age_unit_id: String(unit.id),
        age_unit_slug: unit.slug,
        age_lead_id: leadId ? String(leadId) : '',
        age_wizard_session_id: sessionId ? String(sessionId) : '',
      },
      success_url: `${baseUrl}/create-artist/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/create-artist?artist=${unit.slug}&cancelled=1`,
    });

    // Marca lead como checkout_started
    if (leadId) {
      await db.update(ageLeads).set({ status: 'checkout_started', lastTouchAt: new Date() }).where(eq(ageLeads.id, Number(leadId)));
    }

    // Crea registro de pending purchase
    await db.insert(agePurchases).values({
      leadId: leadId ? Number(leadId) : null,
      unitId: unit.id,
      provider: 'stripe',
      externalId: checkoutSession.id,
      productSku: 'AGE_MASTER_500',
      amountCents: PRICE_USD_CENTS,
      status: 'pending',
      buyerEmail: email,
    });

    res.json({ success: true, checkoutUrl: checkoutSession.url, sessionId: checkoutSession.id });
  } catch (err: any) {
    console.error('[AGE] checkout error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
//  WEBHOOK HANDLER (lo invoca server/routes/webhook-stripe.ts)
//  Exportado para reuso, no monta su propia ruta
// ============================================================================

export async function handleAgeStripeEvent(event: Stripe.Event) {
  if (!event?.data?.object) return false;
  const obj: any = event.data.object;
  const meta = obj.metadata || {};
  if (meta.age !== '1') return false; // No es evento AGE

  if (event.type === 'checkout.session.completed') {
    const unitId = Number(meta.age_unit_id);
    const externalId = obj.id;
    const amount = obj.amount_total ?? PRICE_USD_CENTS;

    const existing = await db.select().from(agePurchases).where(eq(agePurchases.externalId, externalId)).limit(1);
    if (!existing.length) return true;

    const purchase = existing[0];
    if (purchase.status === 'confirmed') return true;
    if (amount < PRICE_USD_CENTS) {
      console.warn('[AGE] webhook: monto insuficiente, no cuenta como venta', { externalId, amount });
      await db.update(agePurchases).set({ status: 'failed', webhookPayload: obj as any }).where(eq(agePurchases.id, purchase.id));
      return true;
    }

    await db
      .update(agePurchases)
      .set({
        status: 'confirmed',
        amountCents: amount,
        confirmedAt: new Date(),
        buyerEmail: obj.customer_email || obj.customer_details?.email || purchase.buyerEmail,
        buyerName: obj.customer_details?.name || null,
        webhookPayload: obj as any,
      })
      .where(eq(agePurchases.id, purchase.id));

    if (purchase.leadId) {
      await db.update(ageLeads).set({ status: 'purchased', lastTouchAt: new Date() }).where(eq(ageLeads.id, purchase.leadId));
    }

    // Ledger: revenue +$500
    await db.insert(ageFinanceLedger).values({
      unitId,
      type: 'revenue',
      amountCents: amount,
      referenceId: externalId,
      note: 'AGE_MASTER_500 confirmed sale',
    });

    // Evaluar expansión
    await evaluateExpansion(unitId);
    return true;
  }

  if (event.type === 'charge.refunded' || event.type === 'refund.created') {
    const externalId = obj.payment_intent || obj.charge;
    if (!externalId) return true;
    const existing = await db.select().from(agePurchases).where(eq(agePurchases.externalId, externalId)).limit(1);
    if (!existing.length) return true;
    const purchase = existing[0];
    await db
      .update(agePurchases)
      .set({ status: 'refunded', refundedAt: new Date(), webhookPayload: obj as any })
      .where(eq(agePurchases.id, purchase.id));

    await db.insert(ageFinanceLedger).values({
      unitId: purchase.unitId,
      type: 'refund',
      amountCents: -purchase.amountCents,
      referenceId: String(externalId),
    });

    await evaluateExpansion(purchase.unitId);
    return true;
  }

  return false;
}

// ============================================================================
//  FINANCE ORCHESTRATOR - Evalúa si un unit alcanzó 2 ventas confirmadas
// ============================================================================

export async function evaluateExpansion(unitId: number) {
  const sales = await db
    .select()
    .from(agePurchases)
    .where(and(eq(agePurchases.unitId, unitId), eq(agePurchases.status, 'confirmed'), isNull(agePurchases.refundedAt)));

  const confirmedSales = sales.length;
  const grossRevenue = sales.reduce((acc, s) => acc + (s.amountCents || 0), 0);

  // Existe aprobación pendiente?
  const existingApprovals = await db
    .select()
    .from(ageExpansionApprovals)
    .where(and(eq(ageExpansionApprovals.sourceUnitId, unitId), eq(ageExpansionApprovals.status, 'approved')))
    .limit(1);

  if (confirmedSales >= REQUIRED_SALES && grossRevenue >= REQUIRED_REVENUE_CENTS && existingApprovals.length === 0) {
    await db.insert(ageExpansionApprovals).values({
      sourceUnitId: unitId,
      confirmedSales,
      grossRevenueCents: grossRevenue,
      status: 'approved',
      reservedAmountCents: NEW_ARTIST_RESERVE_CENTS,
      decidedAt: new Date(),
    });
    await db.insert(ageFinanceLedger).values({
      unitId,
      type: 'reinvestment_lock',
      amountCents: NEW_ARTIST_RESERVE_CENTS,
      note: 'Lock $100 for new artist creation (2 confirmed sales rule)',
    });
    await db.update(ageArtistGrowthUnits).set({ status: 'validated', updatedAt: new Date() }).where(eq(ageArtistGrowthUnits.id, unitId));
  } else if (confirmedSales < REQUIRED_SALES && existingApprovals.length > 0) {
    // Revoca si por reembolso bajó de 2 ventas y aún no se consumió
    for (const ap of existingApprovals) {
      if (!ap.newUnitId) {
        await db.update(ageExpansionApprovals).set({ status: 'revoked', decidedAt: new Date() }).where(eq(ageExpansionApprovals.id, ap.id));
      }
    }
  }

  return { confirmedSales, grossRevenue, expansionReady: confirmedSales >= REQUIRED_SALES && grossRevenue >= REQUIRED_REVENUE_CENTS };
}

// ============================================================================
//  DASHBOARD DATA
//  GET /api/age/dashboard
// ============================================================================

router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const units = await db.select().from(ageArtistGrowthUnits).orderBy(desc(ageArtistGrowthUnits.createdAt));

    const summaries = await Promise.all(
      units.map(async (u) => {
        const sales = await db
          .select()
          .from(agePurchases)
          .where(and(eq(agePurchases.unitId, u.id), eq(agePurchases.status, 'confirmed'), isNull(agePurchases.refundedAt)));
        const allLeads = await db.select().from(ageLeads).where(eq(ageLeads.unitId, u.id));
        const wizards = await db.select().from(ageWizardSessions).where(eq(ageWizardSessions.unitId, u.id));
        const checkouts = allLeads.filter((l) => ['checkout_started', 'purchased'].includes(l.status));
        const metrics = await db.select().from(ageCampaignMetrics).where(eq(ageCampaignMetrics.unitId, u.id));
        const totalSpend = metrics.reduce((acc, m) => acc + (m.spendCents || 0), 0);
        const totalRevenue = sales.reduce((acc, s) => acc + (s.amountCents || 0), 0);
        return {
          id: u.id,
          slug: u.slug,
          artistName: u.artistName,
          status: u.status,
          createdAt: u.createdAt,
          confirmedSales: sales.length,
          grossRevenueCents: totalRevenue,
          spendCents: totalSpend,
          roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
          leads: allLeads.length,
          wizardCompleted: wizards.length,
          checkoutStarted: checkouts.length,
          expansionReady: sales.length >= REQUIRED_SALES && totalRevenue >= REQUIRED_REVENUE_CENTS,
          requiredSales: REQUIRED_SALES,
        };
      })
    );

    const approvals = await db
      .select()
      .from(ageExpansionApprovals)
      .where(eq(ageExpansionApprovals.status, 'approved'))
      .orderBy(desc(ageExpansionApprovals.createdAt))
      .limit(20);

    const ledger = await db.select().from(ageFinanceLedger).orderBy(desc(ageFinanceLedger.createdAt)).limit(50);

    const totals = {
      totalArtists: summaries.length,
      validated: summaries.filter((s) => s.expansionReady).length,
      totalRevenueCents: summaries.reduce((a, s) => a + s.grossRevenueCents, 0),
      totalSpendCents: summaries.reduce((a, s) => a + s.spendCents, 0),
      totalSales: summaries.reduce((a, s) => a + s.confirmedSales, 0),
      totalLeads: summaries.reduce((a, s) => a + s.leads, 0),
      pendingExpansions: approvals.length,
    };

    res.json({ success: true, totals, units: summaries, approvals, ledger });
  } catch (err: any) {
    console.error('[AGE] dashboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
//  CREATE UNIT (admin) - manualmente registrar un nuevo artista de prueba
//  POST /api/age/units
// ============================================================================

router.post('/units', async (req: Request, res: Response) => {
  try {
    const { slug, artistName, personality, aesthetic, genre, personalizedMessage, avatarUrl } = req.body || {};
    if (!slug || !artistName) return res.status(400).json({ success: false, error: 'slug y artistName requeridos' });
    const [unit] = await db
      .insert(ageArtistGrowthUnits)
      .values({
        slug: String(slug).toLowerCase().trim(),
        artistName,
        personality: personality || null,
        aesthetic: aesthetic || null,
        genre: genre || null,
        personalizedMessage: personalizedMessage || null,
        avatarUrl: avatarUrl || null,
      })
      .returning();
    res.json({ success: true, unit });
  } catch (err: any) {
    console.error('[AGE] create unit error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
//  MANUAL AD METRIC ENTRY (Fase 1 manual)
//  POST /api/age/metrics
// ============================================================================

router.post('/metrics', async (req: Request, res: Response) => {
  try {
    const { unitId, spendCents, impressions, clicks, leads, notes } = req.body || {};
    if (!unitId) return res.status(400).json({ success: false, error: 'unitId requerido' });
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spendCents / clicks / 100 : 0;
    const cpm = impressions > 0 ? (spendCents / impressions) * 1000 / 100 : 0;
    const [m] = await db
      .insert(ageCampaignMetrics)
      .values({
        unitId: Number(unitId),
        spendCents: Number(spendCents) || 0,
        impressions: Number(impressions) || 0,
        clicks: Number(clicks) || 0,
        ctr,
        cpc,
        cpm,
        leads: Number(leads) || 0,
        notes: notes || null,
      })
      .returning();

    if (spendCents) {
      await db.insert(ageFinanceLedger).values({
        unitId: Number(unitId),
        type: 'ad_spend',
        amountCents: -Math.abs(Number(spendCents)),
        note: 'Manual ad spend entry',
      });
    }

    res.json({ success: true, metric: m });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
