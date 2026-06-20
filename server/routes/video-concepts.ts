import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { eq, desc, and } from 'drizzle-orm';
import Stripe from 'stripe';
import { db } from '../db';
import {
  videoConceptProjects,
  videoConceptAssets,
  videoConceptComments,
  users,
} from '../db/schema';
import { authenticate } from '../middleware/auth';
import { storage } from '../firebase';
import { buildStoryboardJson, generateSceneImage, STORYBOARD_SCENE_COUNT, type ClientBriefDetails, type StoryboardJson, type StoryboardScene } from '../services/video-concepts-storyboard';
import { generateConsistentSceneImage } from '../services/video-concepts-consistency';
import { animateFullStoryboard, type AnimationProvider } from '../services/storyboard-to-video-pipeline';
import {
  sendIntakeReceivedClient,
  sendIntakeAdminAlert,
  sendDepositPaidClient,
  sendDepositPaidAdmin,
  sendFinalPaidClient,
  sendFinalPaidAdmin,
  sendStoryboardReadyClient,
  sendStoryboardReadyAdmin,
  type VideoConceptEmailData,
} from '../services/video-concepts-email';

/**
 * Boostify Video Concepts API
 *
 * Powers the premium AI-driven event-film service. Endpoints fall into three
 * audiences:
 *   - PUBLIC: lead intake (no auth required so prospects can submit a brief).
 *   - OWNER: clients with a Clerk account viewing or commenting on their own
 *            project.
 *   - ADMIN: internal team browsing the queue, generating master JSON, and
 *            uploading deliverables.
 */
const router = Router();

const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' as any })
  : null;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const generateGalleryToken = () => crypto.randomBytes(24).toString('hex');

const getBaseUrl = (req: Request) => {
  const origin = req.headers.origin;
  if (origin?.startsWith('http://localhost')) return origin;
  return process.env.PRODUCTION_URL || process.env.BASE_URL || origin || 'http://localhost:5000';
};

/**
 * Estimated total contract amount (USD whole dollars). We use the LOWER
 * bound of the selected budget range as the base price; the producer can
 * adjust this per project before any milestone checkout.
 */
const getContractBaseAmount = (budgetRange?: string | null) => {
  switch (budgetRange) {
    case '10000_15000': return 10000;
    case '15000_25000': return 15000;
    case '25000_plus':  return 25000;
    case '5999_9999':
    default:            return 5999;
  }
};

/**
 * Booking deposit = 50 % of the contract total (per signed service
 * contract). It locks the filming date, triggers the AI master concept
 * unlock and is non-refundable past the cancellation window.
 */
const getDepositAmount = (budgetRange?: string | null) =>
  Math.round(getContractBaseAmount(budgetRange) / 2);

/**
 * Remaining 50 % balance, due on the filming day before the shoot starts.
 */
const getFinalAmount = (totalAmount: number, depositAmount: number) =>
  Math.max(0, totalAmount - depositAmount);

const CONTRACT_VERSION = 'v1.0-2026-04';

const eventLabels: Record<string, string> = {
  quinceanera: 'Quinceañera',
  wedding: 'Boda',
  corporate: 'Evento corporativo',
  legacy: 'Legacy / memorias familiares',
  other: 'Evento privado',
};

const referenceSets: Record<string, Array<{ title: string; url: string; role: string }>> = {
  quinceanera: [
    { title: 'Entrada editorial de quinceañera', url: '/video-concepts/cat-quinceanera.jpg', role: 'hero_reference' },
    { title: 'Retrato de portada', url: '/video-concepts/gallery-preview.jpg', role: 'portrait_reference' },
    { title: 'Familia y ceremonia', url: '/video-concepts/cat-legacy.jpg', role: 'emotion_reference' },
  ],
  wedding: [
    { title: 'Ceremonia cinematográfica', url: '/video-concepts/cat-wedding.jpg', role: 'hero_reference' },
    { title: 'Detalles editoriales', url: '/video-concepts/gallery-preview.jpg', role: 'details_reference' },
    { title: 'Celebración familiar', url: '/video-concepts/cat-legacy.jpg', role: 'emotion_reference' },
  ],
  corporate: [
    { title: 'Evento corporativo premium', url: '/video-concepts/cat-corporate.jpg', role: 'hero_reference' },
    { title: 'Marca y escenario', url: '/video-concepts/agents-bg.jpg', role: 'brand_reference' },
    { title: 'Galería interactiva', url: '/video-concepts/gallery-preview.jpg', role: 'platform_reference' },
  ],
  legacy: [
    { title: 'Memorias familiares', url: '/video-concepts/cat-legacy.jpg', role: 'hero_reference' },
    { title: 'Retrato generacional', url: '/video-concepts/gallery-preview.jpg', role: 'portrait_reference' },
    { title: 'Celebración íntima', url: '/video-concepts/cat-wedding.jpg', role: 'emotion_reference' },
  ],
  other: [
    { title: 'Concepto cinematográfico', url: '/video-concepts/hero.jpg', role: 'hero_reference' },
    { title: 'Galería premium', url: '/video-concepts/gallery-preview.jpg', role: 'platform_reference' },
    { title: 'Dirección creativa', url: '/video-concepts/agents-bg.jpg', role: 'creative_reference' },
  ],
};

function buildMasterJson(project: typeof videoConceptProjects.$inferSelect) {
  const eventLabel = eventLabels[project.eventType] || eventLabels.other;
  const references = referenceSets[project.eventType] || referenceSets.other;
  const visualStyle = project.visualStyle || 'Cinematográfico editorial';
  const musicDirection = project.musicDirection || 'Banda sonora original, emotiva y elegante';
  const emotions = Array.isArray(project.emotionalKeywords) && project.emotionalKeywords.length
    ? project.emotionalKeywords
    : ['alegría', 'familia', 'celebración', 'elegancia'];

  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    projectId: project.id,
    client: {
      name: project.clientName,
      email: project.clientEmail,
      phone: project.clientPhone,
    },
    event: {
      type: project.eventType,
      label: eventLabel,
      date: project.eventDate,
      location: project.eventLocation,
      budgetRange: project.budgetRange,
      selectedPreset: project.selectedPreset,
      emotionalKeywords: emotions,
    },
    creativeConcept: {
      title: `${eventLabel}: una película de autor`,
      logline: `Una producción cinematográfica donde ${project.clientName} y sus invitados viven el evento como protagonistas de una historia visual, musical e interactiva.`,
      visualStyle,
      musicDirection,
      tone: emotions,
      whyItFeelsDifferent: [
        'Todos los invitados participan como parte activa de la película.',
        'La historia se construye en capítulos, no como una simple grabación del evento.',
        'El proyecto incluye libro editorial, tienda de recuerdos, invitaciones electrónicas y app interactiva.',
        'El equipo viaja a cualquier destino con producción, dirección y logística especializada.',
      ],
    },
    storyScript: {
      structure: 'cinematic_three_act_event_film',
      chapters: [
        {
          act: 1,
          title: 'El origen de la celebración',
          purpose: 'Presentar familia, lugar, detalles, símbolos y expectativa antes de la llegada principal.',
          keyShots: ['drone/establishing', 'detalle de invitaciones', 'preparación íntima', 'primeros abrazos'],
        },
        {
          act: 2,
          title: 'La entrada de los protagonistas',
          purpose: 'Convertir la llegada y los momentos centrales en escenas con tensión, emoción y ritmo musical.',
          keyShots: ['entrada principal', 'reacciones de invitados', 'familia cercana', 'votos/discurso/ceremonia'],
        },
        {
          act: 3,
          title: 'La noche se vuelve legado',
          purpose: 'Cerrar con celebración, baile, mensajes personales y un final diseñado para verse como película.',
          keyShots: ['baile principal', 'brindis', 'mensajes de invitados', 'gran cierre cinematográfico'],
        },
      ],
      guestParticipation: {
        approach: 'Cada invitado clave recibe una micro-escena o momento de reacción dentro del montaje.',
        capturePrompts: [
          'Mensaje de 10 segundos para los protagonistas.',
          'Recuerdo favorito antes del evento.',
          'Una frase que deberá aparecer en la canción o cierre de película.',
        ],
      },
    },
    originalMusicSession: {
      concept: 'Canción original del evento con nombres y frases de invitados seleccionados.',
      deliverables: ['demo vocal', 'instrumental', 'versión para trailer', 'versión final para película'],
      guestMentions: {
        source: 'guest_questionnaire_after_deposit',
        note: 'Los nombres se confirman con el cliente antes de grabar la versión final.',
      },
    },
    interactiveApp: {
      modules: [
        'private_gallery',
        'interactive_video_builder',
        'guest_uploads',
        'electronic_invitations',
        'memorabilia_store',
        'approval_and_downloads',
      ],
      demoUnlockedByDeposit: true,
    },
    referenceImages: references,
    deliverables: [
      'Película cinematográfica principal',
      'Trailer vertical y horizontal',
      'Libro editorial del evento',
      'Invitaciones electrónicas premium',
      'Tienda privada de recuerdos',
      'Sesión musical original',
      'Galería privada y app interactiva',
    ],
    nextSteps: [
      'Confirmar nombres de invitados principales.',
      'Enviar referencias de vestido, locación, decoración y música.',
      'Reunión creativa con director para cerrar guion.',
      'Bloqueo de fechas de rodaje y logística de viaje.',
    ],
  };
}

async function isAdmin(userId: number | string | undefined | null): Promise<boolean> {
  if (userId === undefined || userId === null || userId === '') return false;
  try {
    let rows: Array<{ role: string | null }> = [];
    if (typeof userId === 'number' && Number.isFinite(userId)) {
      rows = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    } else if (typeof userId === 'string') {
      if (/^\d+$/.test(userId)) {
        rows = await db.select({ role: users.role }).from(users).where(eq(users.id, parseInt(userId, 10))).limit(1);
      } else {
        rows = await db.select({ role: users.role }).from(users).where(eq(users.clerkId, userId)).limit(1);
      }
    }
    return rows[0]?.role === 'admin';
  } catch (err) {
    console.warn('[VIDEO-CONCEPTS] isAdmin lookup failed', err);
    return false;
  }
}

const intakeSchema = z.object({
  clientName: z.string().trim().min(2).max(120),
  clientEmail: z.string().trim().email(),
  clientPhone: z.string().trim().max(40).optional().nullable(),
  eventType: z.enum(['quinceanera', 'wedding', 'corporate', 'legacy', 'other']),
  eventDate: z.string().optional().nullable(), // ISO date
  eventLocation: z.string().trim().max(240).optional().nullable(),
  budgetRange: z.enum(['5999_9999', '10000_15000', '15000_25000', '25000_plus']).optional().nullable(),
  selectedPreset: z.string().max(80).optional().nullable(),
  visualStyle: z.string().max(2000).optional().nullable(),
  musicDirection: z.string().max(2000).optional().nullable(),
  emotionalKeywords: z.array(z.string().max(60)).max(20).optional(),
  importantPeople: z.string().max(2000).optional().nullable(),
  visualReferences: z.array(z.string().url()).max(20).optional(),
  notes: z.string().max(4000).optional().nullable(),
  // Service contract — required to create the project
  contractAccepted: z.boolean().refine((v) => v === true, {
    message: 'You must accept the service contract to continue.',
  }),
  contractSignature: z.string().trim().min(2).max(160), // typed full legal name
  contractVersion: z.string().max(40).optional().nullable(),
  lang: z.enum(['es', 'en']).optional(),
});

/**
 * Build the email payload from a project row. Used by every email trigger so
 * the templates always receive a consistent shape (event labels, monetary
 * amounts, gallery URL, language, etc.).
 */
function buildEmailData(
  project: typeof videoConceptProjects.$inferSelect,
  req: Request,
  langOverride?: 'es' | 'en',
): VideoConceptEmailData {
  const galleryUrl = `${getBaseUrl(req)}/video-concepts/project/${project.id}?token=${project.galleryToken || ''}`;
  const total = project.contractTotalAmount ?? getContractBaseAmount(project.budgetRange);
  const deposit = project.contractDepositAmount ?? getDepositAmount(project.budgetRange);
  const finalAmount = getFinalAmount(total, deposit);
  const acceptLang = String(req.headers['accept-language'] || '').toLowerCase();
  const inferred: 'es' | 'en' = acceptLang.startsWith('en') ? 'en' : 'es';
  return {
    email: project.clientEmail,
    name: project.clientName,
    projectId: project.id,
    eventType: project.eventType,
    eventDate: project.eventDate,
    eventLocation: project.eventLocation,
    budgetRange: project.budgetRange,
    selectedPreset: project.selectedPreset,
    visualStyle: project.visualStyle,
    musicDirection: project.musicDirection,
    notes: project.notes,
    totalAmount: total,
    depositAmount: deposit,
    finalAmount,
    galleryUrl,
    lang: langOverride || inferred,
    phone: project.clientPhone,
    importantPeople: project.importantPeople,
    emotionalKeywords: project.emotionalKeywords as string[] | null,
    contractSignature: project.contractSignature,
    contractVersion: project.contractVersion,
  };
}

// ─────────────────────────────────────────────────────────────
// PUBLIC — Lead intake
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/video-concepts/intake
 * Public endpoint that creates a new project record. Returns the project id
 * and a one-time gallery token the client can use to revisit / upload assets.
 */
router.post('/intake', async (req: Request, res: Response) => {
  try {
    const parsed = intakeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: parsed.error.flatten() });
    }
    const data = parsed.data;

    const galleryToken = generateGalleryToken();
    const clientIp = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim()
      || (req.socket?.remoteAddress ?? null);
    const userAgent = (req.headers['user-agent'] as string | undefined) ?? null;
    const contractTotal = getContractBaseAmount(data.budgetRange);

    const [created] = await db
      .insert(videoConceptProjects)
      .values({
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        clientPhone: data.clientPhone ?? null,
        eventType: data.eventType,
        eventDate: data.eventDate ? new Date(data.eventDate) : null,
        eventLocation: data.eventLocation ?? null,
        budgetRange: data.budgetRange ?? null,
        selectedPreset: data.selectedPreset ?? null,
        visualStyle: data.visualStyle ?? null,
        musicDirection: data.musicDirection ?? null,
        emotionalKeywords: data.emotionalKeywords ?? [],
        importantPeople: data.importantPeople ?? null,
        visualReferences: data.visualReferences ?? [],
        notes: data.notes ?? null,
        status: 'intake_completed',
        galleryToken,
        // Contract acceptance — server stamps timestamp + IP/UA for audit
        contractAccepted: true,
        contractVersion: data.contractVersion || CONTRACT_VERSION,
        contractSignature: data.contractSignature,
        contractSignedAt: new Date(),
        contractIp: clientIp,
        contractUserAgent: userAgent,
        contractDepositAmount: getDepositAmount(data.budgetRange),
        contractTotalAmount: contractTotal,
      })
      .returning({ id: videoConceptProjects.id, galleryToken: videoConceptProjects.galleryToken });

    console.log('🎬 [VIDEO-CONCEPTS] new intake', { id: created.id, email: data.clientEmail });

    // Fire-and-forget notification emails — never block the intake response.
    void (async () => {
      try {
        const [full] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, created.id)).limit(1);
        if (!full) return;
        const payload = buildEmailData(full, req, data.lang);
        await Promise.all([
          sendIntakeReceivedClient(payload).catch((e) => console.error('❌ [VIDEO-CONCEPTS] intake client email failed', e)),
          sendIntakeAdminAlert(payload).catch((e) => console.error('❌ [VIDEO-CONCEPTS] intake admin alert failed', e)),
        ]);
      } catch (e) {
        console.error('❌ [VIDEO-CONCEPTS] intake email dispatch failed', e);
      }
    })();

    return res.json({
      success: true,
      project: {
        id: created.id,
        galleryToken: created.galleryToken,
      },
    });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] intake error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Intake failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// PUBLIC — Deposit checkout + paid demo unlock
// ─────────────────────────────────────────────────────────────

const projectAccessSchema = z.object({
  galleryToken: z.string().min(20).max(128).optional(),
  lang: z.enum(['es', 'en']).optional(),
});

function tokenFrom(req: Request) {
  return (req.body?.galleryToken as string | undefined)
    || (req.query.token as string | undefined)
    || (req.headers['x-gallery-token'] as string | undefined);
}

/**
 * POST /api/video-concepts/:id/checkout
 * Creates a Stripe Checkout session for the demo deposit. The amount is
 * computed server-side from the project's budget range.
 */
router.post('/:id/checkout', async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(503).json({ success: false, error: 'Stripe is not configured' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' });

    const parsed = projectAccessSchema.safeParse({ ...req.body, galleryToken: tokenFrom(req) });
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid checkout payload' });
    }

    const [project] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, id)).limit(1);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!parsed.data.galleryToken || parsed.data.galleryToken !== project.galleryToken) {
      return res.status(403).json({ success: false, error: 'Invalid gallery token' });
    }

    if (project.paymentStatus === 'deposit_paid' || project.paymentStatus === 'paid_in_full') {
      return res.json({
        success: true,
        alreadyPaid: true,
        url: `${getBaseUrl(req)}/video-concepts/project/${id}?token=${project.galleryToken}`,
      });
    }

    const amount = getDepositAmount(project.budgetRange);
    const cents = amount * 100;
    const isEs = parsed.data.lang !== 'en';
    const eventLabel = eventLabels[project.eventType] || eventLabels.other;
    const projectUrl = `${getBaseUrl(req)}/video-concepts/project/${id}?token=${project.galleryToken}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: project.clientEmail,
      mode: 'payment',
      allow_promotion_codes: true,
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: isEs ? `Depósito demo — ${eventLabel}` : `Demo deposit — ${eventLabel}`,
            description: isEs
              ? 'Desbloquea el guion, blueprint creativo y demo privado de tu proyecto Boostify Video Concepts.'
              : 'Unlock the script, creative blueprint and private demo for your Boostify Video Concepts project.',
          },
          unit_amount: cents,
        },
        quantity: 1,
      }],
      success_url: `${projectUrl}&payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${projectUrl}&payment=cancelled`,
      metadata: {
        type: 'video_concepts_deposit',
        projectId: String(project.id),
        galleryToken: project.galleryToken || '',
        eventType: project.eventType,
      },
    });

    await db.update(videoConceptProjects)
      .set({ stripeSessionId: session.id, updatedAt: new Date() })
      .where(eq(videoConceptProjects.id, id));

    return res.json({ success: true, url: session.url, amount, sessionId: session.id });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] checkout error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to create checkout' });
  }
});

/**
 * POST /api/video-concepts/:id/confirm-payment
 * Confirms the Stripe Checkout session and generates the master JSON only
 * after Stripe reports the payment as paid.
 */
router.post('/:id/confirm-payment', async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(503).json({ success: false, error: 'Stripe is not configured' });
    }

    const id = parseInt(req.params.id, 10);
    const { sessionId } = req.body as { sessionId?: string };
    const galleryToken = tokenFrom(req);
    if (isNaN(id) || !sessionId) return res.status(400).json({ success: false, error: 'Missing parameters' });

    const [project] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, id)).limit(1);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!galleryToken || galleryToken !== project.galleryToken) {
      return res.status(403).json({ success: false, error: 'Invalid gallery token' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ success: false, error: 'Payment not completed' });
    }
    if (session.metadata?.type !== 'video_concepts_deposit' || session.metadata?.projectId !== String(id)) {
      return res.status(400).json({ success: false, error: 'Session does not match project' });
    }

    const masterJson = project.masterJson || buildMasterJson(project);
    await db.update(videoConceptProjects)
      .set({
        paymentStatus: 'deposit_paid',
        status: 'json_generated',
        stripeSessionId: session.id,
        masterJson,
        galleryUrl: `/video-concepts/project/${id}?token=${project.galleryToken}`,
        updatedAt: new Date(),
      })
      .where(eq(videoConceptProjects.id, id));

    console.log('✅ [VIDEO-CONCEPTS] deposit confirmed', { id, sessionId: session.id });

    // Fire-and-forget — notify both client and admin once payment is confirmed.
    void (async () => {
      try {
        const [updated] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, id)).limit(1);
        if (!updated) return;
        const payload = buildEmailData(updated, req);
        await Promise.all([
          sendDepositPaidClient(payload).catch((e) => console.error('❌ [VIDEO-CONCEPTS] deposit client email failed', e)),
          sendDepositPaidAdmin(payload).catch((e) => console.error('❌ [VIDEO-CONCEPTS] deposit admin email failed', e)),
        ]);
      } catch (e) {
        console.error('❌ [VIDEO-CONCEPTS] deposit email dispatch failed', e);
      }
    })();

    return res.json({ success: true, paymentStatus: 'deposit_paid', masterJson });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] confirm payment error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to confirm payment' });
  }
});

/**
 * POST /api/video-concepts/:id/final-checkout
 * Creates a Stripe Checkout session for the remaining 50 % balance, due on
 * the filming day before the shoot starts (per signed service contract).
 * The amount is the contract total minus whatever was charged as deposit.
 */
router.post('/:id/final-checkout', async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(503).json({ success: false, error: 'Stripe is not configured' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' });

    const parsed = projectAccessSchema.safeParse({ ...req.body, galleryToken: tokenFrom(req) });
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid checkout payload' });
    }

    const [project] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, id)).limit(1);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!parsed.data.galleryToken || parsed.data.galleryToken !== project.galleryToken) {
      return res.status(403).json({ success: false, error: 'Invalid gallery token' });
    }

    if (project.paymentStatus !== 'deposit_paid') {
      return res.status(400).json({
        success: false,
        error: 'Final balance is only available once the deposit has been paid.',
      });
    }
    if (project.paymentStatus === 'paid_in_full') {
      return res.json({
        success: true,
        alreadyPaid: true,
        url: `${getBaseUrl(req)}/video-concepts/project/${id}?token=${project.galleryToken}`,
      });
    }

    const total = project.contractTotalAmount ?? getContractBaseAmount(project.budgetRange);
    const deposit = project.contractDepositAmount ?? getDepositAmount(project.budgetRange);
    const amount = getFinalAmount(total, deposit);
    if (amount <= 0) {
      return res.status(400).json({ success: false, error: 'Nothing left to charge' });
    }
    const cents = amount * 100;
    const isEs = parsed.data.lang !== 'en';
    const eventLabel = eventLabels[project.eventType] || eventLabels.other;
    const projectUrl = `${getBaseUrl(req)}/video-concepts/project/${id}?token=${project.galleryToken}`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: project.clientEmail,
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: isEs
              ? `Saldo final (50 %) — ${eventLabel}`
              : `Final balance (50%) — ${eventLabel}`,
            description: isEs
              ? 'Pago restante del 50 % del contrato, exigible el día del rodaje antes de iniciar la producción.'
              : 'Remaining 50 % of the contract, due on the filming day before production begins.',
          },
          unit_amount: cents,
        },
        quantity: 1,
      }],
      success_url: `${projectUrl}&payment=final_success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${projectUrl}&payment=final_cancelled`,
      metadata: {
        type: 'video_concepts_final',
        projectId: String(project.id),
        galleryToken: project.galleryToken || '',
        eventType: project.eventType,
      },
    });

    return res.json({ success: true, url: session.url, amount, sessionId: session.id });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] final checkout error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to create final checkout' });
  }
});

/**
 * POST /api/video-concepts/:id/confirm-final
 * Verifies a final-balance Stripe session and marks the project paid_in_full.
 */
router.post('/:id/confirm-final', async (req: Request, res: Response) => {
  try {
    if (!stripe) {
      return res.status(503).json({ success: false, error: 'Stripe is not configured' });
    }
    const id = parseInt(req.params.id, 10);
    const { sessionId } = req.body as { sessionId?: string };
    const galleryToken = tokenFrom(req);
    if (isNaN(id) || !sessionId) return res.status(400).json({ success: false, error: 'Missing parameters' });

    const [project] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, id)).limit(1);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!galleryToken || galleryToken !== project.galleryToken) {
      return res.status(403).json({ success: false, error: 'Invalid gallery token' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ success: false, error: 'Payment not completed' });
    }
    if (session.metadata?.type !== 'video_concepts_final' || session.metadata?.projectId !== String(id)) {
      return res.status(400).json({ success: false, error: 'Session does not match project' });
    }

    await db.update(videoConceptProjects)
      .set({
        paymentStatus: 'paid_in_full',
        finalPaidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videoConceptProjects.id, id));

    console.log('✅ [VIDEO-CONCEPTS] final balance confirmed', { id });

    // Fire-and-forget — notify both sides of full payment.
    void (async () => {
      try {
        const [updated] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, id)).limit(1);
        if (!updated) return;
        const payload = buildEmailData(updated, req);
        await Promise.all([
          sendFinalPaidClient(payload).catch((e) => console.error('❌ [VIDEO-CONCEPTS] final client email failed', e)),
          sendFinalPaidAdmin(payload).catch((e) => console.error('❌ [VIDEO-CONCEPTS] final admin email failed', e)),
        ]);
      } catch (e) {
        console.error('❌ [VIDEO-CONCEPTS] final email dispatch failed', e);
      }
    })();

    return res.json({ success: true, paymentStatus: 'paid_in_full' });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] confirm final error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to confirm final payment' });
  }
});

/**
 * POST /api/video-concepts/:id/generate-demo
 * Safety endpoint for paid projects that were confirmed elsewhere. It refuses
 * to generate the JSON until payment_status is deposit_paid or paid_in_full.
 */
router.post('/:id/generate-demo', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const galleryToken = tokenFrom(req);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' });

    const [project] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, id)).limit(1);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!galleryToken || galleryToken !== project.galleryToken) {
      return res.status(403).json({ success: false, error: 'Invalid gallery token' });
    }
    if (project.paymentStatus !== 'deposit_paid' && project.paymentStatus !== 'paid_in_full') {
      return res.status(402).json({ success: false, error: 'Deposit required before generating demo' });
    }

    const masterJson = project.masterJson || buildMasterJson(project);
    if (!project.masterJson) {
      await db.update(videoConceptProjects)
        .set({ masterJson, status: 'json_generated', updatedAt: new Date() })
        .where(eq(videoConceptProjects.id, id));
    }

    return res.json({ success: true, masterJson });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] generate demo error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to generate demo' });
  }
});

// ─────────────────────────────────────────────────────────────
// OWNER / ADMIN — Read project
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/video-concepts/:id
 * Accessible to (a) the project owner if signed in, (b) anyone holding the
 * gallery token, (c) admins.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' });

    const [project] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, id)).limit(1);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    const token = (req.query.token as string | undefined) || (req.headers['x-gallery-token'] as string | undefined);
    const rawUserId = (req as any).user?.id as number | string | undefined;
    const numericUserId = typeof rawUserId === 'number'
      ? rawUserId
      : (typeof rawUserId === 'string' && /^\d+$/.test(rawUserId) ? parseInt(rawUserId, 10) : undefined);

    const ownerMatches = !!numericUserId && project.userId === numericUserId;
    const tokenMatches = !!token && token === project.galleryToken;
    const admin = await isAdmin(rawUserId);

    if (!ownerMatches && !tokenMatches && !admin) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const assets = await db
      .select()
      .from(videoConceptAssets)
      .where(eq(videoConceptAssets.projectId, id))
      .orderBy(desc(videoConceptAssets.uploadedAt));

    const comments = await db
      .select()
      .from(videoConceptComments)
      .where(eq(videoConceptComments.projectId, id))
      .orderBy(desc(videoConceptComments.createdAt));

    // Hide internal-only fields from non-admins, and keep the blueprint locked until deposit is paid.
    const canRevealDemo = admin || project.paymentStatus === 'deposit_paid' || project.paymentStatus === 'paid_in_full';
    const safeProject = admin
      ? project
      : { ...project, internalNotes: undefined, masterJson: canRevealDemo ? project.masterJson : null };

    return res.json({ success: true, project: safeProject, assets, comments });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] get project error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to load project' });
  }
});

// ─────────────────────────────────────────────────────────────
// OWNER / ADMIN — Upload assets
// ─────────────────────────────────────────────────────────────

const uploadSchema = z.object({
  kind: z.enum(['photo', 'video', 'reference', 'music', 'ai_image', 'ai_video', 'final']),
  fileBase64: z.string().min(20),
  originalName: z.string().min(1).max(240),
  mimeType: z.string().min(3).max(120),
  galleryToken: z.string().optional(),
});

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB per file

/**
 * POST /api/video-concepts/:id/assets
 * Accepts a base64 file payload, stores it in Firebase Storage, and registers
 * the resulting public URL on the project. Authorisation is the same model as
 * the GET endpoint (owner | gallery token | admin).
 */
router.post('/:id/assets', async (req: Request, res: Response) => {
  try {
    if (!storage) {
      return res.status(503).json({ success: false, error: 'Storage not configured on server' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' });

    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const [project] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, id)).limit(1);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    const userId = (req as any).user?.id as number | undefined;
    const ownerMatches = !!userId && project.userId === userId;
    const tokenMatches = parsed.data.galleryToken && parsed.data.galleryToken === project.galleryToken;
    const admin = await isAdmin(userId);
    if (!ownerMatches && !tokenMatches && !admin) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Strip data URL prefix if present.
    const b64 = parsed.data.fileBase64.includes(',')
      ? parsed.data.fileBase64.split(',', 2)[1]!
      : parsed.data.fileBase64;
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.byteLength > MAX_BYTES) {
      return res.status(413).json({ success: false, error: `File exceeds ${MAX_BYTES / (1024 * 1024)} MB limit` });
    }

    const safeName = parsed.data.originalName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const objectPath = `video-concepts/${id}/${parsed.data.kind}/${Date.now()}_${safeName}`;

    const bucket = storage.bucket();
    const file = bucket.file(objectPath);
    await file.save(buffer, {
      metadata: { contentType: parsed.data.mimeType, cacheControl: 'public, max-age=31536000' },
      resumable: false,
    });
    try {
      await file.makePublic();
    } catch {
      // bucket may already enforce public access; ignore.
    }
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(objectPath)}`;

    const [asset] = await db
      .insert(videoConceptAssets)
      .values({
        projectId: id,
        kind: parsed.data.kind,
        url: publicUrl,
        storagePath: objectPath,
        originalName: parsed.data.originalName,
        mimeType: parsed.data.mimeType,
        sizeBytes: buffer.byteLength,
      })
      .returning();

    // Bump status if this is the first asset upload phase.
    if (project.status === 'intake_completed') {
      await db
        .update(videoConceptProjects)
        .set({ status: 'assets_uploaded', updatedAt: new Date() })
        .where(eq(videoConceptProjects.id, id));
    }

    return res.json({ success: true, asset });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] upload error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Upload failed' });
  }
});

// ─────────────────────────────────────────────────────────────
// OWNER — Comments / revision requests
// ─────────────────────────────────────────────────────────────

const commentSchema = z.object({
  body: z.string().min(1).max(4000),
  type: z.enum(['comment', 'revision_request', 'approval']).default('comment'),
  authorName: z.string().max(120).optional(),
  galleryToken: z.string().optional(),
  assetId: z.number().int().positive().optional(),
});

router.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' });
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid payload' });

    const [project] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, id)).limit(1);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    const userId = (req as any).user?.id as number | undefined;
    const ownerMatches = !!userId && project.userId === userId;
    const tokenMatches = parsed.data.galleryToken && parsed.data.galleryToken === project.galleryToken;
    const admin = await isAdmin(userId);
    if (!ownerMatches && !tokenMatches && !admin) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const [comment] = await db
      .insert(videoConceptComments)
      .values({
        projectId: id,
        authorUserId: userId ?? null,
        authorName: parsed.data.authorName ?? null,
        body: parsed.data.body,
        type: parsed.data.type,
        assetId: parsed.data.assetId ?? null,
      })
      .returning();

    return res.json({ success: true, comment });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] comment error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to add comment' });
  }
});

// ─────────────────────────────────────────────────────────────
// OWNER — Post-deposit interactive storyboard (10-scene script)
// ─────────────────────────────────────────────────────────────
//
// After paying the booking deposit the client unlocks an interactive
// storyboard generator: they upload reference photos via /assets, fill an
// extra brief here, then trigger /storyboard/generate which:
//   1. asks GPT-4o for a structured 10-scene JSON,
//   2. renders each scene image in the background using fal's
//      `gpt-image-2`-equivalent in EDIT mode (with their photos as the
//      reference base) and falls back to OpenAI Images if every fal
//      model fails.
//
// Scenes are individually editable and regeneratable so the client can
// iterate visually before the shoot.

const briefSchema = z.object({
  galleryToken: z.string().optional(),
  storyTone: z.string().max(160).optional(),
  mustHaveMoments: z.array(z.string().max(240)).max(20).optional(),
  peopleToFeature: z.string().max(2000).optional(),
  colorPreferences: z.string().max(600).optional(),
  musicVibe: z.string().max(600).optional(),
  narrationStyle: z.string().max(160).optional(),
  inspirationKeywords: z.string().max(600).optional(),
  language: z.enum(['es', 'en']).optional(),
  notes: z.string().max(4000).optional(),
});

const generateStoryboardSchema = z.object({
  galleryToken: z.string().optional(),
  language: z.enum(['es', 'en']).optional(),
});

const sceneEditSchema = z.object({
  galleryToken: z.string().optional(),
  title: z.string().max(160).optional(),
  narration: z.string().max(2000).optional(),
  narrationEn: z.string().max(2000).optional(),
  visualDirection: z.string().max(2000).optional(),
  cameraMove: z.string().max(160).optional(),
  duration: z.string().max(20).optional(),
  musicCue: z.string().max(400).optional(),
  imagePrompt: z.string().max(2000).optional(),
});

const sceneImageSchema = z.object({
  galleryToken: z.string().optional(),
  imagePrompt: z.string().max(2000).optional(),
  referenceUrls: z.array(z.string().url()).max(6).optional(),
});

/**
 * Resolve project + verify the requester is owner / has gallery token / is admin.
 * Also enforces deposit_paid (or paid_in_full) before any storyboard mutation.
 */
async function resolveStoryboardAccess(req: Request, res: Response) {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ success: false, error: 'Invalid id' });
    return null;
  }

  const [project] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, id)).limit(1);
  if (!project) {
    res.status(404).json({ success: false, error: 'Project not found' });
    return null;
  }

  const userId = (req as any).user?.id as number | undefined;
  const token = (req.body?.galleryToken as string | undefined) || (req.query.token as string | undefined);
  const ownerMatches = !!userId && project.userId === userId;
  const tokenMatches = token && token === project.galleryToken;
  const admin = await isAdmin(userId);
  if (!ownerMatches && !tokenMatches && !admin) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return null;
  }

  if (project.paymentStatus !== 'deposit_paid' && project.paymentStatus !== 'paid_in_full') {
    res.status(402).json({ success: false, error: 'Deposit required before unlocking the storyboard' });
    return null;
  }

  return { id, project };
}

/**
 * POST /:id/storyboard/brief
 * Save the client's extra brief (story tone, must-have moments, etc.) before
 * generation. Idempotent — overwrites the previous brief.
 */
router.post('/:id/storyboard/brief', async (req: Request, res: Response) => {
  try {
    const ctx = await resolveStoryboardAccess(req, res);
    if (!ctx) return;
    const parsed = briefSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const brief: ClientBriefDetails = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    };

    const [updated] = await db
      .update(videoConceptProjects)
      .set({ clientBriefDetails: brief as any, updatedAt: new Date() })
      .where(eq(videoConceptProjects.id, ctx.id))
      .returning();

    return res.json({ success: true, project: updated });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] brief error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to save brief' });
  }
});

/**
 * POST /:id/storyboard/generate
 * Generate the storyboard JSON (10 scenes) and kick off background image
 * rendering for each scene. Returns immediately with `storyboardJson` set
 * to status='generating' on every scene; client polls GET /:id to see
 * scenes flip to 'ready' as fal/OpenAI finish.
 */
router.post('/:id/storyboard/generate', async (req: Request, res: Response) => {
  try {
    const ctx = await resolveStoryboardAccess(req, res);
    if (!ctx) return;
    const parsed = generateStoryboardSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid payload' });

    const brief: ClientBriefDetails = (ctx.project.clientBriefDetails as any) || {};
    const language: 'es' | 'en' = parsed.data.language || (brief.language === 'en' ? 'en' : 'es');

    // Pull all reference / photo assets the client uploaded for this project.
    const assets = await db
      .select()
      .from(videoConceptAssets)
      .where(eq(videoConceptAssets.projectId, ctx.id));
    const referenceAssets = assets.filter((a) => a.kind === 'photo' || a.kind === 'reference');
    const referenceUrls = referenceAssets.map((a) => a.url).filter((u): u is string => !!u);

    // 1. Build storyboard text via GPT-4o.
    const storyboard = await buildStoryboardJson({
      project: ctx.project,
      brief: { ...brief, uploadedAssetUrls: referenceUrls, language },
      assetUrls: referenceUrls,
      language,
    });

    // Persist the initial JSON immediately so the UI can show titles + narration
    // while images render in the background.
    await db
      .update(videoConceptProjects)
      .set({
        storyboardJson: storyboard as any,
        storyboardStatus: 'generating',
        storyboardUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videoConceptProjects.id, ctx.id));

    // 2. Fire-and-forget: render each scene image sequentially in the background.
    void (async () => {
      const generatedSceneUrls: string[] = []; // Track for consistency check (Fase 3)

      for (const scene of storyboard.scenes) {
        try {
          // Mark scene as generating + persist.
          await patchScene(ctx.id, scene.id, { generationStatus: 'generating', error: null });

          let imageUrl: string;
          let provider: string;
          let consistencyScore: number | null = null;

          // ── FASE 3: Use consistency check for scene 3+ ───────────────────────
          // Scenes 1-2: simple generation (no prior context)
          // Scenes 3+: generate 2 variants, VLM selects most consistent one
          if (scene.order >= 3 && generatedSceneUrls.length >= 2) {
            try {
              const consistencyResult = await generateConsistentSceneImage({
                prompt: scene.imagePrompt,
                sceneOrder: scene.order,
                sceneDescription: scene.visualDirection || scene.title,
                referenceUrls,
                previousSceneUrls: generatedSceneUrls.slice(-3), // last 3 for context
                visualTheme: storyboard.visualTheme,
              });
              imageUrl = consistencyResult.selectedUrl;
              provider = consistencyResult.selectedProvider;
              consistencyScore = consistencyResult.consistencyScore;
            } catch (consistencyErr) {
              // Fallback to standard generation if consistency check fails
              console.warn(`[STORYBOARD] Consistency check failed for scene ${scene.order}, using fallback:`, consistencyErr);
              const result = await generateSceneImage({ prompt: scene.imagePrompt, referenceUrls });
              imageUrl = result.url;
              provider = result.provider;
            }
          } else {
            const result = await generateSceneImage({ prompt: scene.imagePrompt, referenceUrls });
            imageUrl = result.url;
            provider = result.provider;
          }

          generatedSceneUrls.push(imageUrl);

          await patchScene(ctx.id, scene.id, {
            generationStatus: 'ready',
            imageUrl,
            generationProvider: provider,
            sourceAssetUrl: referenceUrls[0] || null,
            generatedAt: new Date().toISOString(),
            consistencyScore,
            error: null,
          });
        } catch (err: any) {
          console.error(`❌ [STORYBOARD] scene ${scene.order} failed`, err?.message || err);
          await patchScene(ctx.id, scene.id, {
            generationStatus: 'error',
            error: String(err?.message || err).slice(0, 600),
          });
        }
      }

      // Once all scenes are done, flip status to 'ready'.
      await db
        .update(videoConceptProjects)
        .set({ storyboardStatus: 'ready', storyboardUpdatedAt: new Date(), updatedAt: new Date() })
        .where(eq(videoConceptProjects.id, ctx.id));

      // Notify client + admin that the storyboard is ready.
      try {
        const [updated] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, ctx.id)).limit(1);
        if (updated) {
          const payload = {
            ...buildEmailData(updated, req, language),
            storyboardTitle: storyboard.title,
            sceneCount: storyboard.scenes.length,
          };
          await Promise.all([
            sendStoryboardReadyClient(payload).catch((e) => console.error('❌ [VIDEO-CONCEPTS] storyboard client email failed', e)),
            sendStoryboardReadyAdmin(payload).catch((e) => console.error('❌ [VIDEO-CONCEPTS] storyboard admin email failed', e)),
          ]);
        }
      } catch (e) {
        console.error('❌ [VIDEO-CONCEPTS] storyboard email dispatch failed', e);
      }
    })().catch((err) => {
      console.error('❌ [STORYBOARD] background runner failed', err);
    });

    return res.json({ success: true, storyboard });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] storyboard generate error', error);
    await db
      .update(videoConceptProjects)
      .set({ storyboardStatus: 'error', storyboardUpdatedAt: new Date() })
      .where(eq(videoConceptProjects.id, parseInt(req.params.id, 10)))
      .catch(() => {});
    return res.status(500).json({ success: false, error: error?.message || 'Failed to generate storyboard' });
  }
});

/**
 * Helper: merge a partial scene update into the persisted storyboardJson.
 */
async function patchScene(projectId: number, sceneId: string, patch: Partial<StoryboardScene>) {
  const [row] = await db
    .select({ storyboardJson: videoConceptProjects.storyboardJson })
    .from(videoConceptProjects)
    .where(eq(videoConceptProjects.id, projectId))
    .limit(1);
  const sb = (row?.storyboardJson as StoryboardJson | null) || null;
  if (!sb || !Array.isArray(sb.scenes)) return;
  const idx = sb.scenes.findIndex((s) => s.id === sceneId);
  if (idx === -1) return;
  sb.scenes[idx] = { ...sb.scenes[idx], ...patch } as StoryboardScene;
  await db
    .update(videoConceptProjects)
    .set({ storyboardJson: sb as any, storyboardUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(videoConceptProjects.id, projectId));
}

/**
 * PATCH /:id/storyboard/scene/:sceneId
 * Edit textual fields of a single scene (no image regeneration).
 */
router.patch('/:id/storyboard/scene/:sceneId', async (req: Request, res: Response) => {
  try {
    const ctx = await resolveStoryboardAccess(req, res);
    if (!ctx) return;
    const sceneId = String(req.params.sceneId || '');
    if (!sceneId) return res.status(400).json({ success: false, error: 'Invalid sceneId' });
    const parsed = sceneEditSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid payload' });

    const { galleryToken, ...patch } = parsed.data;
    await patchScene(ctx.id, sceneId, patch as Partial<StoryboardScene>);

    const [updated] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, ctx.id)).limit(1);
    return res.json({ success: true, project: updated });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] scene edit error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to edit scene' });
  }
});

/**
 * POST /:id/storyboard/scene/:sceneId/image
 * Regenerate ONE scene's image (using the latest imagePrompt from the JSON
 * unless a new prompt is provided in the request body).
 */
router.post('/:id/storyboard/scene/:sceneId/image', async (req: Request, res: Response) => {
  try {
    const ctx = await resolveStoryboardAccess(req, res);
    if (!ctx) return;
    const sceneId = String(req.params.sceneId || '');
    if (!sceneId) return res.status(400).json({ success: false, error: 'Invalid sceneId' });
    const parsed = sceneImageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid payload' });

    const sb = (ctx.project.storyboardJson as StoryboardJson | null) || null;
    const scene = sb?.scenes?.find((s) => s.id === sceneId);
    if (!scene) return res.status(404).json({ success: false, error: 'Scene not found' });

    const prompt = parsed.data.imagePrompt || scene.imagePrompt;
    if (!prompt) return res.status(400).json({ success: false, error: 'Empty prompt' });

    // Default reference set: client-uploaded photos.
    let referenceUrls = parsed.data.referenceUrls;
    if (!referenceUrls?.length) {
      const assets = await db
        .select()
        .from(videoConceptAssets)
        .where(eq(videoConceptAssets.projectId, ctx.id));
      referenceUrls = assets
        .filter((a) => a.kind === 'photo' || a.kind === 'reference')
        .map((a) => a.url)
        .filter((u): u is string => !!u);
    }

    await patchScene(ctx.id, sceneId, { generationStatus: 'generating', error: null });
    try {
      const result = await generateSceneImage({ prompt, referenceUrls });
      await patchScene(ctx.id, sceneId, {
        generationStatus: 'ready',
        imageUrl: result.url,
        generationProvider: result.provider,
        imagePrompt: prompt,
        sourceAssetUrl: referenceUrls?.[0] || null,
        generatedAt: new Date().toISOString(),
        error: null,
      });
    } catch (err: any) {
      await patchScene(ctx.id, sceneId, {
        generationStatus: 'error',
        error: String(err?.message || err).slice(0, 600),
      });
      return res.status(502).json({ success: false, error: err?.message || 'Image generation failed' });
    }

    const [updated] = await db.select().from(videoConceptProjects).where(eq(videoConceptProjects.id, ctx.id)).limit(1);
    return res.json({ success: true, project: updated });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] scene image error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to generate scene image' });
  }
});

// ─────────────────────────────────────────────────────────────
// ADMIN — Project management
// ─────────────────────────────────────────────────────────────

const adminGate = [
  authenticate,
  async (req: Request, res: Response, next: any) => {
    const userId = (req as any).user?.id as number | undefined;
    if (!(await isAdmin(userId))) {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }
    next();
  },
];

router.get('/admin/projects', ...adminGate, async (_req: Request, res: Response) => {
  try {
    const projects = await db
      .select()
      .from(videoConceptProjects)
      .orderBy(desc(videoConceptProjects.createdAt))
      .limit(200);
    return res.json({ success: true, projects });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] admin list error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to load projects' });
  }
});

const adminUpdateSchema = z.object({
  status: z
    .enum([
      'new_project',
      'intake_completed',
      'assets_uploaded',
      'json_generated',
      'concept_approved',
      'in_ai_production',
      'in_editing',
      'first_version_sent',
      'revisions_requested',
      'approved',
      'delivered',
      'archived',
    ])
    .optional(),
  paymentStatus: z.enum(['pending', 'deposit_paid', 'paid_in_full', 'refunded']).optional(),
  internalNotes: z.string().max(8000).optional(),
  assignedTeam: z.array(z.string()).optional(),
  masterJson: z.any().optional(),
});

router.patch('/admin/:id', ...adminGate, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid id' });
    const parsed = adminUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, error: 'Invalid payload' });

    const [updated] = await db
      .update(videoConceptProjects)
      .set({ ...parsed.data, updatedAt: new Date() } as any)
      .where(eq(videoConceptProjects.id, id))
      .returning();

    return res.json({ success: true, project: updated });
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] admin update error', error);
    return res.status(500).json({ success: false, error: error?.message || 'Failed to update project' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /:id/storyboard/animate
// Animates all generated scene images into video clips.
// Uses SSE (text/event-stream) to stream per-scene progress to the client.
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:id/storyboard/animate', authenticate, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId)) return res.status(400).json({ success: false, error: 'Invalid id' });

    const { provider, audioDuration, audioUrl } = req.body as {
      provider?: AnimationProvider;
      audioDuration?: number;
      audioUrl?: string;
    };

    const [project] = await db
      .select()
      .from(videoConceptProjects)
      .where(eq(videoConceptProjects.id, projectId))
      .limit(1);

    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    const storyboard = project.storyboardJson as StoryboardJson | null;
    if (!storyboard?.scenes?.length) {
      return res.status(400).json({ success: false, error: 'No storyboard found — generate it first' });
    }

    const readyScenes = storyboard.scenes.filter((s) => s.imageUrl);
    if (readyScenes.length === 0) {
      return res.status(400).json({ success: false, error: 'No scene images ready — generate images first' });
    }

    // ── SSE setup ─────────────────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('start', { message: 'Animating storyboard scenes...', sceneCount: readyScenes.length });

    const result = await animateFullStoryboard({
      storyboard,
      audioUrl,
      audioDuration,
      provider,
      projectId: String(projectId),
      concurrency: 2,
      onSceneComplete: (sceneResult, progress) => {
        sendEvent('scene', {
          sceneId: sceneResult.sceneId,
          order: sceneResult.order,
          videoUrl: sceneResult.videoUrl || null,
          error: sceneResult.error || null,
          progress,
        });
      },
    });

    // Persist timeline into project metadata
    await db
      .update(videoConceptProjects)
      .set({
        masterJson: {
          ...((project.masterJson as any) || {}),
          animatedTimeline: result.timeline,
          animationProvider: result.provider,
          animationCompletedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(videoConceptProjects.id, projectId));

    sendEvent('complete', {
      success: true,
      timeline: result.timeline,
      animatedSceneCount: result.animatedScenes.length,
      failedScenes: result.failedScenes,
      totalDurationSeconds: result.totalDurationSeconds,
      provider: result.provider,
    });

    res.end();
  } catch (error: any) {
    console.error('❌ [VIDEO-CONCEPTS] animate-storyboard error', error);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: error?.message || 'Animation failed' });
    }
    res.write(`event: error\ndata: ${JSON.stringify({ error: error?.message })}\n\n`);
    res.end();
  }
});

export default router;
