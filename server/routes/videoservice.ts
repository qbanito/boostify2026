import { Router } from 'express';
import { db } from '../db';
import { videoServiceProjects } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import Stripe from 'stripe';
import { storage } from '../firebase';
import { editImageWithNanoBanana, generateImageWithNanoBanana } from '../services/fal-service';
import { ensureArtistProfile } from '../services/artist-profile-auto';
import { bootstrapArtistFromLead } from '../services/videoservice-artist-bootstrap';
import {
  sendProjectReceivedEmail,
  sendScriptCreationEmail,
  sendProposalEmail,
  sendInProductionEmail,
  sendDeliveryEmail,
  sendFreeRequestReceivedEmail,
  sendAdminLeadNotification,
  __sendBrevoRaw,
  __sendResendRaw,
  type VideoProjectEmailData,
} from '../services/videoservice-email';
import { generateAIProposal } from '../services/videoservice-ai-proposal';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27.acacia' as any,
});

const router = Router();

const BASE_URL = process.env.PRODUCTION_URL || process.env.BASE_URL || 'https://boostifymusic.com';

// ── Validation ──────────────────────────────────────────────────────
const leadSchema = z.object({
  leadName: z.string().min(1).max(200),
  leadEmail: z.string().email().max(320),
  leadPhone: z.string().max(30).optional(),
  leadInstagram: z.string().max(200).optional(),
  leadSpotify: z.string().max(500).optional(),
  songName: z.string().min(1).max(300),
  songGenre: z.string().max(100).optional(),
  videoType: z.enum(['music_video', 'commercial', 'lyric_video']).optional(),
  aesthetic: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  needsRealVideo: z.boolean().default(false),
  needsLipSync: z.boolean().default(false),
  resolution: z.enum(['1080p', '4k']).default('1080p'),
  videoDuration: z.string().max(50).optional(),
  locations: z.string().max(1000).optional(),
  calculatedPrice: z.string().optional(),
  depositAmount: z.string().optional(),
  lang: z.enum(['es', 'en']).default('es'),
  artistImage: z.string().optional(), // base64 data URL
  audioFile: z.string().optional(), // base64 data URL of audio
});

// ── POST /lead – Capture lead & create project + artist page ────────
router.post('/lead', async (req, res) => {
  try {
    const data = leadSchema.parse(req.body);

    const [project] = await db.insert(videoServiceProjects).values({
      leadName: data.leadName,
      leadEmail: data.leadEmail,
      leadPhone: data.leadPhone || null,
      leadInstagram: data.leadInstagram || null,
      leadSpotify: data.leadSpotify || null,
      songName: data.songName,
      songGenre: data.songGenre || null,
      videoType: data.videoType || null,
      aesthetic: data.aesthetic || null,
      description: data.description || null,
      needsRealVideo: data.needsRealVideo,
      needsLipSync: data.needsLipSync,
      resolution: data.resolution,
      videoDuration: data.videoDuration || null,
      locations: data.locations || null,
      calculatedPrice: data.calculatedPrice || null,
      depositAmount: data.depositAmount || null,
      lang: data.lang,
      projectStatus: 'received',
      freeLandingDays: 30,
    }).returning();

    console.log(`✅ [VideoService] Lead captured: ${data.leadEmail} – project #${project.id}`);

    // Process artist image with FAL AI and create artist page (async, don't block response)
    let artistPageUrl: string | null = null;
    let artistImageUrl: string | null = null;

    // Parse audio file if provided (base64 data URL → buffer)
    let audioBuffer: Buffer | null = null;
    let audioFileName = 'audio.mp3';
    let audioMimeType = 'audio/mpeg';
    if (data.audioFile) {
      const audioMatch = data.audioFile.match(/^data:(audio\/[\w.+-]+);base64,(.+)$/);
      if (audioMatch) {
        audioMimeType = audioMatch[1];
        const audioBase64 = audioMatch[2];
        audioBuffer = Buffer.from(audioBase64, 'base64');
        const ext = audioMimeType.includes('wav') ? 'wav' : audioMimeType.includes('m4a') || audioMimeType.includes('mp4') ? 'm4a' : audioMimeType.includes('ogg') ? 'ogg' : 'mp3';
        audioFileName = `${data.songName.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
        console.log(`🎵 [VideoService] Audio received: ${audioFileName} (${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
      }
    }

    const processArtistPage = async () => {
      try {
        // 1. Upload original image to Firebase Storage if provided
        let originalImageUrl: string | null = null;
        if (data.artistImage && storage) {
          const base64Match = data.artistImage.match(/^data:image\/([\w+]+);base64,(.+)$/);
          if (base64Match) {
            const mimeType = `image/${base64Match[1]}`;
            const base64Data = base64Match[2];
            const imageBuffer = Buffer.from(base64Data, 'base64');
            const ext = base64Match[1] === 'jpeg' ? 'jpg' : base64Match[1];
            const fileName = `videoservice-uploads/${project.id}_${Date.now()}.${ext}`;
            const bucket = storage.bucket();
            const file = bucket.file(fileName);
            await file.save(imageBuffer, { metadata: { contentType: mimeType }, validation: false });
            originalImageUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
            console.log(`✅ [VideoService] Image uploaded: ${originalImageUrl}`);
          }
        }

        // 2. Create artist profile (skeleton) — masterJson, hero banner,
        //    polished portrait and personalized bio are filled in step 3
        //    by the bootstrap service so the lead becomes a fully usable
        //    Boostify artist account from day 1.
        const firebaseUid = `videoservice_${project.id}_${Date.now()}`;
        const profileResult = await ensureArtistProfile({
          firebaseUid,
          email: data.leadEmail,
          displayName: data.leadName,
          genre: data.songGenre,
        });

        const pageUrl = `${BASE_URL}/artist/${profileResult.slug}`;
        artistPageUrl = pageUrl;

        // 3. Bootstrap the artist into a real-feeling profile:
        //    — cinematic 16:9 hero banner
        //    — polished 3:4 profile portrait
        //    — personalized 3-tier biography (OpenAI w/ fallback)
        //    — seeded master JSON for AI modules
        //    — strategic minimal default profile layout
        const parsedPrice = data.calculatedPrice ? Number(data.calculatedPrice) : null;
        const bootstrap = await bootstrapArtistFromLead({
          userId: profileResult.userId,
          artistName: data.leadName,
          originalImageUrl,
          email: data.leadEmail,
          phone: data.leadPhone,
          instagramHandle: data.leadInstagram,
          spotifyUrl: data.leadSpotify,
          genre: data.songGenre,
          aesthetic: data.aesthetic,
          videoType: data.videoType,
          description: data.description,
          songName: data.songName,
          lang: data.lang,
          videoServiceProjectId: project.id,
          calculatedPrice: parsedPrice && !Number.isNaN(parsedPrice) ? parsedPrice : null,
        }).catch(err => {
          console.error('❌ [VideoService] Artist bootstrap failed:', err);
          return null;
        });

        // Prefer the polished portrait as the project's artist image,
        // fall back to the hero banner if portrait failed.
        const artImageUrl =
          bootstrap?.profileImageUrl ||
          bootstrap?.heroBannerUrl ||
          null;
        artistImageUrl = artImageUrl;

        // 4. Update project with artist page URL and image
        await db.update(videoServiceProjects)
          .set({
            artistPageUrl: pageUrl,
            artistImageUrl: artImageUrl,
          })
          .where(eq(videoServiceProjects.id, project.id));

        console.log(`✅ [VideoService] Artist page created: ${pageUrl}`);

        // 5. Profile image, hero banner, biography, master JSON and
        //    strategic layout are already persisted by `bootstrapArtistFromLead`.

        // 6. If audio was uploaded, trigger AI proposal pipeline (async)
        if (audioBuffer && audioFileName && audioMimeType) {
          console.log('🎬 [VideoService] Audio detected — launching AI proposal pipeline...');
          generateAIProposal({
            projectId: project.id,
            artistName: data.leadName,
            email: data.leadEmail,
            songName: data.songName,
            genre: data.songGenre,
            aesthetic: data.aesthetic,
            description: data.description,
            videoType: data.videoType,
            lang: data.lang,
            audioBuffer,
            audioFileName,
            audioMimeType,
            artistPageUrl: pageUrl,
            artistImageUrl: artImageUrl || undefined,
            calculatedPrice: data.calculatedPrice,
          }).catch(err => console.error('❌ [VideoService] AI Proposal pipeline failed:', err));
        }
      } catch (err) {
        console.error('❌ [VideoService] Artist page creation error:', err);
      }
    };

    // Send admin notification immediately (don't wait for artist page)
    sendAdminLeadNotification({
      email: data.leadEmail,
      name: data.leadName,
      projectId: project.id,
      songName: data.songName,
      calculatedPrice: data.calculatedPrice || '0',
      depositAmount: data.depositAmount || '0',
      lang: data.lang,
      phone: data.leadPhone,
      instagram: data.leadInstagram,
      spotify: data.leadSpotify,
      videoType: data.videoType || undefined,
      aesthetic: data.aesthetic || undefined,
      description: data.description || undefined,
    }).then(r => console.log(`📧 [VideoService] Admin notification: ${r.success ? 'sent via ' + (r.provider || 'unknown') : 'FAILED: ' + r.error}`))
      .catch(e => console.error('❌ [VideoService] Admin notification failed:', e));

    // Send user confirmation email IMMEDIATELY (don't wait for artist page processing)
    const immediateEmailData: VideoProjectEmailData = {
      email: data.leadEmail,
      name: data.leadName,
      projectId: project.id,
      songName: data.songName,
      calculatedPrice: data.calculatedPrice || '0',
      depositAmount: data.depositAmount || '0',
      lang: data.lang,
    };
    sendFreeRequestReceivedEmail(immediateEmailData)
      .then(r => console.log(`📧 [VideoService] User confirmation email: ${r.success ? 'sent via ' + (r.provider || 'unknown') : 'FAILED: ' + r.error}`))
      .catch(e => console.error('❌ [VideoService] User confirmation email failed:', e));

    // Start processing artist page in background, then send updated email with artist page link
    processArtistPage().then(async () => {
      if (artistPageUrl) {
        // Send updated email with artist page & image once ready
        const updatedEmailData: VideoProjectEmailData & { artistPageUrl?: string; artistImageUrl?: string } = {
          email: data.leadEmail,
          name: data.leadName,
          projectId: project.id,
          songName: data.songName,
          calculatedPrice: data.calculatedPrice || '0',
          depositAmount: data.depositAmount || '0',
          lang: data.lang,
          artistPageUrl: artistPageUrl || undefined,
          artistImageUrl: artistImageUrl || undefined,
        };
        sendFreeRequestReceivedEmail(updatedEmailData)
          .then(r => console.log(`📧 [VideoService] Updated email with artist page: ${r.success ? 'sent via ' + (r.provider || 'unknown') : 'FAILED: ' + r.error}`))
          .catch(e => console.error('❌ [VideoService] Updated email failed:', e));

        // Also send admin the artist page link
        sendAdminLeadNotification({
          email: data.leadEmail,
          name: data.leadName,
          projectId: project.id,
          songName: data.songName,
          calculatedPrice: data.calculatedPrice || '0',
          depositAmount: data.depositAmount || '0',
          lang: data.lang,
          artistPageUrl,
        }).catch(() => {});
      }
    }).catch(err => {
      console.error('❌ [VideoService] Artist page processing failed:', err);
    });

    return res.json({ success: true, projectId: project.id });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors[0]?.message || 'Validation error' });
    }
    console.error('❌ [VideoService] Lead capture error:', error);
    return res.status(500).json({ success: false, error: 'Failed to save project' });
  }
});

// ── POST /checkout – Create Stripe checkout session ─────────────────
// Two payment stages:
//   1. paymentType = 'reservation'   → $99 lock-in, kicks off script production
//   2. paymentType = 'script_balance' → 50% of total minus reservation, after script approved
router.post('/checkout', async (req, res) => {
  try {
    const { projectId, depositAmount, songName, lang, paymentType } = req.body as {
      projectId?: number;
      depositAmount?: number | string;
      songName?: string;
      lang?: 'es' | 'en';
      paymentType?: 'reservation' | 'script_balance';
    };
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'Missing projectId' });
    }

    // Load the project to compute the right amount server-side (don't trust client for amount-of-record)
    const [project] = await db.select().from(videoServiceProjects).where(eq(videoServiceProjects.id, Number(projectId)));
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    const stage: 'reservation' | 'script_balance' =
      paymentType === 'script_balance' ? 'script_balance'
      : paymentType === 'reservation' ? 'reservation'
      // Backwards-compat: if no paymentType and reservation already paid, assume script_balance
      : project.reservationPaid ? 'script_balance' : 'reservation';

    let amount: number;
    if (stage === 'reservation') {
      // Always $99 to lock in
      amount = 99;
    } else {
      const total = Number(project.calculatedPrice || 0);
      const reservation = Number(project.reservationAmount || 99);
      amount = Math.max(0, Math.round(total * 0.5) - reservation);
      // Allow client override only if it lowers the amount (safety net)
      const clientAmt = Number(depositAmount || 0);
      if (clientAmt > 0 && clientAmt < amount) amount = Math.round(clientAmt);
    }

    const cents = Math.round(amount * 100);
    if (cents < 100) {
      return res.status(400).json({ success: false, error: 'Invalid payment amount' });
    }

    const isEs = lang === 'es' || (project.lang === 'es' && lang !== 'en');
    const songLabel = songName || project.songName || (isEs ? 'Proyecto' : 'Project');

    const productName = stage === 'reservation'
      ? (isEs ? `Reserva Video — "${songLabel}"` : `Video Reservation — "${songLabel}"`)
      : (isEs ? `Pago de guión (50%) — "${songLabel}"` : `Script payment (50%) — "${songLabel}"`);
    const productDescription = stage === 'reservation'
      ? (isEs ? 'Reserva tu cupo de producción de video Boostify por solo $99. Se descuenta del total.' : 'Lock your Boostify video production slot for just $99. Credited toward your total.')
      : (isEs ? 'Pago del 50% tras aprobar el guión. Comenzamos la producción inmediatamente.' : '50% payment after script approval. Production starts immediately.');

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: productName, description: productDescription },
          unit_amount: cents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${BASE_URL}/videoservice/success?session_id={CHECKOUT_SESSION_ID}&project_id=${projectId}&stage=${stage}`,
      cancel_url: `${BASE_URL}/videoservice?cancelled=1`,
      metadata: { projectId: String(projectId), type: 'videoservice', stage },
    });

    // Save stripe session ID per stage
    const updates: any = { stripeSessionId: session.id };
    if (stage === 'reservation') updates.reservationStripeId = session.id;
    else updates.scriptPaymentStripeId = session.id;
    await db.update(videoServiceProjects).set(updates).where(eq(videoServiceProjects.id, Number(projectId)));

    return res.json({ success: true, url: session.url, stage, amount });
  } catch (error: any) {
    console.error('❌ [VideoService] Checkout error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
});

// ── POST /confirm-payment – Called after Stripe redirect ────────────
router.post('/confirm-payment', async (req, res) => {
  try {
    const { sessionId, projectId, stage: stageHint } = req.body as { sessionId?: string; projectId?: number; stage?: 'reservation' | 'script_balance' };
    if (!sessionId || !projectId) {
      return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ success: false, error: 'Payment not completed' });
    }

    const amountPaid = (session.amount_total || 0) / 100;
    const stage: 'reservation' | 'script_balance' = (session.metadata?.stage as any) || stageHint || (amountPaid <= 200 ? 'reservation' : 'script_balance');

    const [existing] = await db.select().from(videoServiceProjects).where(eq(videoServiceProjects.id, Number(projectId)));
    if (!existing) return res.status(404).json({ success: false, error: 'Project not found' });

    const updates: any = {
      stripePaymentId: session.payment_intent as string,
      updatedAt: new Date(),
    };

    if (stage === 'reservation') {
      updates.reservationPaid = true;
      updates.reservationAmount = String(amountPaid);
      // Move project into script creation phase as soon as the reservation is paid
      if (existing.projectStatus === 'received') updates.projectStatus = 'script_creation';
    } else {
      updates.scriptPaymentPaid = true;
      updates.scriptPaymentAmount = String(amountPaid);
      // Legacy fields for compatibility with existing UI/admin flows
      updates.depositPaid = true;
      updates.depositAmount = String(amountPaid);
      // Premium perk eligibility: total project ≥ $5,000 → 1 year of Boostify Premium + 35% off AI video
      const total = Number(existing.calculatedPrice || 0);
      if (total >= 5000 && !existing.premiumAccessGranted) {
        const expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);
        updates.premiumAccessGranted = true;
        updates.premiumAccessExpiresAt = expires;
        updates.aiVideoDiscountPct = 35;
        updates.freeLandingDays = 365;
      } else if (!updates.freeLandingDays) {
        updates.freeLandingDays = total >= 2900 ? 365 : 30;
      }
    }

    await db.update(videoServiceProjects).set(updates).where(eq(videoServiceProjects.id, Number(projectId)));

    // Fetch updated project to send the right email
    const [project] = await db.select().from(videoServiceProjects).where(eq(videoServiceProjects.id, Number(projectId)));
    if (project) {
      sendProjectReceivedEmail({
        email: project.leadEmail,
        name: project.leadName,
        projectId: project.id,
        songName: project.songName || 'Video Project',
        calculatedPrice: project.calculatedPrice || String(amountPaid),
        depositAmount: String(amountPaid),
        lang: (project.lang as 'es' | 'en') || 'es',
      }).then(r => console.log(`📧 [VideoService] Payment confirmation email: ${r.success ? 'sent via ' + (r.provider || 'unknown') : 'FAILED: ' + r.error}`))
        .catch(e => console.error('❌ [VideoService] Payment confirmation email failed:', e));
    }

    console.log(`✅ [VideoService] ${stage === 'reservation' ? 'Reservation' : 'Script payment'} confirmed for project #${projectId} – $${amountPaid}`);
    return res.json({
      success: true,
      stage,
      amount: amountPaid,
      premiumAccessGranted: !!updates.premiumAccessGranted || !!project?.premiumAccessGranted,
      aiVideoDiscountPct: updates.aiVideoDiscountPct ?? project?.aiVideoDiscountPct ?? 0,
    });
  } catch (error: any) {
    console.error('❌ [VideoService] Confirm payment error:', error);
    return res.status(500).json({ success: false, error: 'Failed to confirm payment' });
  }
});

// ── GET /project/:id – Get project status ───────────────────────────
router.get('/project/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'Invalid project ID' });

    const [project] = await db.select().from(videoServiceProjects).where(eq(videoServiceProjects.id, id));
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    return res.json({
      success: true,
      project: {
        id: project.id,
        songName: project.songName,
        projectStatus: project.projectStatus,
        depositPaid: project.depositPaid,
        calculatedPrice: project.calculatedPrice,
        depositAmount: project.depositAmount,
        freeLandingDays: project.freeLandingDays,
        createdAt: project.createdAt,
        artistPageUrl: project.artistPageUrl,
        artistImageUrl: project.artistImageUrl,
        lang: project.lang,
        // Two-stage payment + premium perk
        reservationPaid: project.reservationPaid,
        reservationAmount: project.reservationAmount,
        scriptPaymentPaid: project.scriptPaymentPaid,
        scriptPaymentAmount: project.scriptPaymentAmount,
        premiumAccessGranted: project.premiumAccessGranted,
        premiumAccessExpiresAt: project.premiumAccessExpiresAt,
        aiVideoDiscountPct: project.aiVideoDiscountPct,
      },
    });
  } catch (error: any) {
    console.error('❌ [VideoService] Get project error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get project',
      detail: error?.message || String(error),
    });
  }
});

// ── POST /update-status – Admin: update project status & trigger phase email ─
router.post('/update-status', async (req, res) => {
  try {
    const { projectId, status } = req.body;
    const validStatuses = ['received', 'script_creation', 'proposal_sent', 'in_production', 'delivered'] as const;
    if (!projectId || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid projectId or status' });
    }

    await db.update(videoServiceProjects)
      .set({ projectStatus: status, updatedAt: new Date() })
      .where(eq(videoServiceProjects.id, Number(projectId)));

    const [project] = await db.select().from(videoServiceProjects)
      .where(eq(videoServiceProjects.id, Number(projectId)));

    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    const emailData: VideoProjectEmailData = {
      email: project.leadEmail,
      name: project.leadName,
      projectId: project.id,
      songName: project.songName || 'Video Project',
      calculatedPrice: project.calculatedPrice || '0',
      depositAmount: project.depositAmount || '0',
      lang: (project.lang as 'es' | 'en') || 'es',
    };

    // Send the corresponding phase email
    const emailMap: Record<string, () => Promise<any>> = {
      script_creation: () => sendScriptCreationEmail(emailData),
      proposal_sent: () => sendProposalEmail(emailData),
      in_production: () => sendInProductionEmail(emailData),
      delivered: () => sendDeliveryEmail(emailData),
    };

    if (emailMap[status]) {
      emailMap[status]().catch(e => console.error(`❌ [VideoService] Phase email failed for ${status}:`, e));
    }

    console.log(`✅ [VideoService] Project #${projectId} status → ${status}`);
    return res.json({ success: true, status });
  } catch (error: any) {
    console.error('❌ [VideoService] Update status error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// ── GET /email-status – Diagnostic: check which providers are configured ──
router.get('/email-status', (_req, res) => {
  res.json({
    success: true,
    providers: {
      brevo: { configured: !!process.env.BREVO_API_KEY, keyLength: (process.env.BREVO_API_KEY || '').length },
      resend: { configured: !!process.env.RESEND_API_KEY, keyLength: (process.env.RESEND_API_KEY || '').length },
    },
    fromEmail: 'info@boostifymusic.com',
    adminEmail: 'convoycubano@gmail.com',
    baseUrl: BASE_URL,
  });
});

// ── POST /email-test – Awaited test send to verify delivery end-to-end ──
// Body: { to: "address@example.com", lang?: "es" | "en" }
router.post('/email-test', async (req, res) => {
  try {
    const to = String(req.body?.to || '').trim();
    const lang = (req.body?.lang === 'es' ? 'es' : 'en') as 'es' | 'en';
    if (!to || !to.includes('@')) {
      return res.status(400).json({ success: false, error: 'Missing or invalid "to" email' });
    }
    const testData: VideoProjectEmailData = {
      email: to,
      name: 'Email Test',
      projectId: 0,
      songName: 'Test Song',
      calculatedPrice: '0',
      depositAmount: '0',
      lang,
    };
    const userResult = await sendFreeRequestReceivedEmail(testData);
    const adminResult = await sendAdminLeadNotification({
      email: to,
      name: 'Email Test',
      projectId: 0,
      songName: 'Test Song',
      calculatedPrice: '0',
      depositAmount: '0',
      lang,
    });
    return res.json({
      success: userResult.success && adminResult.success,
      user: userResult,
      admin: adminResult,
    });
  } catch (error: any) {
    console.error('❌ [VideoService] Email test error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Test failed' });
  }
});

// ── POST /email-test-provider – Force a specific provider (brevo|resend) ──
// Body: { to, provider: "brevo" | "resend" }
router.post('/email-test-provider', async (req, res) => {
  try {
    const to = String(req.body?.to || '').trim();
    const provider = String(req.body?.provider || 'resend').toLowerCase();
    if (!to || !to.includes('@')) {
      return res.status(400).json({ success: false, error: 'Missing or invalid "to"' });
    }
    const subject = `[Boostify ${provider.toUpperCase()} Test] ${new Date().toISOString()}`;
    const html = `
      <div style="font-family:Arial,sans-serif;padding:20px;">
        <h2>🧪 Provider Test — ${provider}</h2>
        <p>If you see this email in your inbox, the <b>${provider}</b> provider and its DNS authentication (SPF/DKIM) are working correctly.</p>
        <p>Timestamp: ${new Date().toISOString()}</p>
        <p>— Boostify Music</p>
      </div>
    `;
    const result = provider === 'brevo'
      ? await __sendBrevoRaw(to, subject, html)
      : await __sendResendRaw(to, subject, html);
    return res.json({ success: result.success, provider, result });
  } catch (error: any) {
    console.error('❌ [VideoService] Provider test error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
