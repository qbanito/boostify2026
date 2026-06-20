/**
 * BOOSTIFY Gig Escrow & Delivery Routes
 * ========================================
 * Full payment protection lifecycle:
 * 1. Client accepts bid → escrow funded via Stripe
 * 2. Musician delivers files → stream-only until approved
 * 3. Client approves → payment released (80% musician, 20% platform)
 * 4. Disputes → admin review
 */

import express from 'express';
import Stripe from 'stripe';
import { db } from '../db';
import {
  gigEscrow,
  gigDeliverables,
  gigDisputes,
  serviceRequests,
  serviceBids,
  notifications,
  gigAutoMessages,
} from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { calculateCommission } from '../../shared/gig-credit-pricing';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

const router = express.Router();

function getUserId(req: express.Request): number | null {
  const user = (req as any).user;
  return user?.id || user?.uid || null;
}

// ════════════════════════════════════════
// 1. ESCROW — Fund on bid acceptance
// ════════════════════════════════════════

/** POST /api/gig-escrow/fund — Create escrow + Stripe checkout when client accepts a bid */
router.post('/fund', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { serviceRequestId, bidId } = req.body;
    if (!serviceRequestId || !bidId) {
      return res.status(400).json({ error: 'serviceRequestId and bidId are required' });
    }

    // Verify ownership — only request owner can fund
    const [request] = await db.select().from(serviceRequests)
      .where(and(eq(serviceRequests.id, serviceRequestId), eq(serviceRequests.userId, userId)));
    if (!request) return res.status(403).json({ error: 'Not your service request' });

    // Get the bid
    const [bid] = await db.select().from(serviceBids)
      .where(eq(serviceBids.id, bidId));
    if (!bid) return res.status(404).json({ error: 'Bid not found' });
    if (bid.status !== 'accepted') return res.status(400).json({ error: 'Bid must be accepted first' });

    // Prevent duplicate escrow
    const [existing] = await db.select().from(gigEscrow)
      .where(and(eq(gigEscrow.serviceRequestId, serviceRequestId), eq(gigEscrow.bidId, bidId)));
    if (existing) {
      return res.json({ success: true, escrow: existing, alreadyFunded: true });
    }

    const totalAmount = parseFloat(bid.amount);
    const { platformFee, musicianPayout } = calculateCommission(totalAmount);
    const musicianUserId = bid.userId || bid.musicianId;

    if (!musicianUserId) return res.status(400).json({ error: 'Musician user not found' });

    // Create Stripe Checkout for escrow
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Escrow: ${request.title}`,
            description: `Payment held in escrow until delivery is approved. Musician receives $${musicianPayout} (80%), platform fee $${platformFee} (20%).`,
          },
          unit_amount: Math.round(totalAmount * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.origin || 'https://boostify.live'}/producer-tools?tab=bids&escrow=funded&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'https://boostify.live'}/producer-tools?tab=bids&escrow=cancelled`,
      metadata: {
        type: 'gig_escrow',
        serviceRequestId: serviceRequestId.toString(),
        bidId: bidId.toString(),
        clientUserId: userId.toString(),
        musicianUserId: musicianUserId.toString(),
        totalAmount: totalAmount.toString(),
        platformFee: platformFee.toString(),
        musicianPayout: musicianPayout.toString(),
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Error creating escrow:', error);
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/gig-escrow/verify — Verify escrow payment after Stripe redirect */
router.post('/verify', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Session ID required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    const meta = session.metadata!;
    if (meta.clientUserId !== userId.toString()) {
      return res.status(403).json({ error: 'Session does not belong to this user' });
    }

    // Prevent double-creation
    const [existing] = await db.select().from(gigEscrow)
      .where(eq(gigEscrow.stripePaymentIntentId, session.payment_intent as string));
    if (existing) {
      return res.json({ success: true, escrow: existing, alreadyFunded: true });
    }

    // Create escrow record
    const [escrow] = await db.insert(gigEscrow).values({
      serviceRequestId: parseInt(meta.serviceRequestId),
      bidId: parseInt(meta.bidId),
      clientUserId: parseInt(meta.clientUserId),
      musicianUserId: parseInt(meta.musicianUserId),
      totalAmount: meta.totalAmount,
      platformFee: meta.platformFee,
      musicianPayout: meta.musicianPayout,
      status: 'funded',
      stripePaymentIntentId: session.payment_intent as string,
    }).returning();

    // Notify musician
    await db.insert(notifications).values({
      userId: parseInt(meta.musicianUserId),
      type: 'ESCROW_FUNDED',
      title: '💰 Payment secured in escrow!',
      message: `The client has funded $${meta.totalAmount} in escrow. You can start working now!`,
      link: `/producer-tools?tab=bids`,
      metadata: { escrowId: escrow.id, serviceRequestId: meta.serviceRequestId },
    });

    res.json({ success: true, escrow });
  } catch (error: any) {
    console.error('Error verifying escrow:', error);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/gig-escrow/:serviceRequestId — Get escrow status for a gig */
router.get('/:serviceRequestId', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const serviceRequestId = parseInt(req.params.serviceRequestId);
    const [escrow] = await db.select().from(gigEscrow)
      .where(eq(gigEscrow.serviceRequestId, serviceRequestId));

    if (!escrow) return res.json({ escrow: null });

    // Only client or musician can view
    if (escrow.clientUserId !== userId && escrow.musicianUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json({ escrow });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// 2. DELIVERABLES — Upload + Stream-only
// ════════════════════════════════════════

/** POST /api/gig-escrow/deliver — Musician uploads deliverables */
router.post('/deliver', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { serviceRequestId, bidId, files, deliveryNote } = req.body;
    // files: Array<{ fileName, fileUrl, fileType, fileSizeBytes, mimeType, previewUrl }>

    if (!serviceRequestId || !files?.length) {
      return res.status(400).json({ error: 'serviceRequestId and files[] are required' });
    }

    // Get escrow
    const [escrow] = await db.select().from(gigEscrow)
      .where(eq(gigEscrow.serviceRequestId, serviceRequestId));

    // Get request + bid for the client ID
    const [request] = await db.select().from(serviceRequests)
      .where(eq(serviceRequests.id, serviceRequestId));
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const clientUserId = request.userId;

    const resolvedBidId = bidId || escrow?.bidId;
    if (!resolvedBidId) return res.status(400).json({ error: 'bidId required (no escrow found)' });

    // Insert deliverables
    const deliverables = [];
    for (const file of files) {
      const [d] = await db.insert(gigDeliverables).values({
        serviceRequestId,
        bidId: resolvedBidId,
        escrowId: escrow?.id,
        musicianUserId: userId,
        clientUserId,
        fileName: file.fileName,
        fileUrl: file.fileUrl,
        fileType: file.fileType || 'audio',
        fileSizeBytes: file.fileSizeBytes,
        mimeType: file.mimeType,
        previewUrl: file.previewUrl || null,
        deliveryNote: deliveryNote || null,
        status: 'delivered',
      }).returning();
      deliverables.push(d);
    }

    // Notify client
    await db.insert(notifications).values({
      userId: clientUserId,
      type: 'DELIVERY_RECEIVED',
      title: '📦 Files delivered!',
      message: `The musician has delivered ${files.length} file(s) for "${request.title}". Review and approve to release payment.`,
      link: `/producer-tools?tab=bids&request=${serviceRequestId}`,
      metadata: { serviceRequestId, deliveryCount: files.length },
    });

    res.json({ success: true, deliverables });
  } catch (error: any) {
    console.error('Error delivering files:', error);
    res.status(500).json({ error: error.message });
  }
});

/** GET /api/gig-escrow/deliverables/:serviceRequestId — Get deliverables for a gig */
router.get('/deliverables/:serviceRequestId', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const serviceRequestId = parseInt(req.params.serviceRequestId);
    const deliverables = await db.select().from(gigDeliverables)
      .where(eq(gigDeliverables.serviceRequestId, serviceRequestId))
      .orderBy(desc(gigDeliverables.createdAt));

    // Filter: client gets previewUrl only (no fileUrl) until approved
    const result = deliverables.map(d => {
      const isMusician = d.musicianUserId === userId;
      const isApproved = d.status === 'approved';
      return {
        ...d,
        // Client can only stream (previewUrl) until approved; musician always sees full URL
        fileUrl: (isMusician || isApproved) ? d.fileUrl : null,
        canDownload: isMusician || isApproved,
        canStream: true,
        streamUrl: d.previewUrl || d.fileUrl,  // prefer watermarked preview
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// 3. APPROVAL — Client approves → release payment
// ════════════════════════════════════════

/** POST /api/gig-escrow/approve — Client approves delivery, releases escrow */
router.post('/approve', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { serviceRequestId } = req.body;

    // Get escrow
    const [escrow] = await db.select().from(gigEscrow)
      .where(and(
        eq(gigEscrow.serviceRequestId, serviceRequestId),
        eq(gigEscrow.clientUserId, userId),
      ));

    if (!escrow) return res.status(404).json({ error: 'Escrow not found' });
    if (escrow.status !== 'funded') {
      return res.status(400).json({ error: `Escrow already ${escrow.status}` });
    }

    // Release escrow
    await db.update(gigEscrow)
      .set({ status: 'released', releasedAt: new Date() })
      .where(eq(gigEscrow.id, escrow.id));

    // Mark all deliverables as approved
    await db.update(gigDeliverables)
      .set({ status: 'approved', approvedAt: new Date() })
      .where(and(
        eq(gigDeliverables.serviceRequestId, serviceRequestId),
        eq(gigDeliverables.status, 'delivered'),
      ));

    // Complete the service request
    await db.update(serviceRequests)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(serviceRequests.id, serviceRequestId));

    // Notify musician — payment released!
    await db.insert(notifications).values({
      userId: escrow.musicianUserId,
      type: 'PAYMENT_RELEASED',
      title: '🎉 Payment released!',
      message: `$${escrow.musicianPayout} has been released for your work! (Total: $${escrow.totalAmount}, platform fee: $${escrow.platformFee})`,
      link: `/producer-tools?tab=bids`,
      metadata: { escrowId: escrow.id, payout: escrow.musicianPayout },
    });

    res.json({
      success: true,
      totalAmount: escrow.totalAmount,
      musicianPayout: escrow.musicianPayout,
      platformFee: escrow.platformFee,
    });
  } catch (error: any) {
    console.error('Error approving delivery:', error);
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/gig-escrow/request-revision — Client requests a revision */
router.post('/request-revision', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { serviceRequestId, revisionNote } = req.body;
    if (!revisionNote?.trim()) return res.status(400).json({ error: 'Revision note required' });

    // Get deliverables owned by this client
    const deliverables = await db.select().from(gigDeliverables)
      .where(and(
        eq(gigDeliverables.serviceRequestId, serviceRequestId),
        eq(gigDeliverables.clientUserId, userId),
        eq(gigDeliverables.status, 'delivered'),
      ));

    if (!deliverables.length) return res.status(404).json({ error: 'No deliverables to revise' });

    // Check max revisions
    const first = deliverables[0];
    if (first.revisionCount >= first.maxRevisions) {
      return res.status(400).json({
        error: `Maximum revisions reached (${first.maxRevisions}). Please approve or open a dispute.`,
      });
    }

    // Update all deliverables to revision status
    await db.update(gigDeliverables)
      .set({
        status: 'revision',
        revisionNote,
        revisionCount: sql`${gigDeliverables.revisionCount} + 1`,
      })
      .where(and(
        eq(gigDeliverables.serviceRequestId, serviceRequestId),
        eq(gigDeliverables.status, 'delivered'),
      ));

    // Notify musician
    if (first.musicianUserId) {
      await db.insert(notifications).values({
        userId: first.musicianUserId,
        type: 'REVISION_REQUESTED',
        title: '🔄 Revision requested',
        message: `Client has requested a revision: "${revisionNote}"`,
        link: `/producer-tools?tab=bids&request=${serviceRequestId}`,
        metadata: { serviceRequestId },
      });
    }

    res.json({ success: true, revisionsUsed: first.revisionCount + 1, maxRevisions: first.maxRevisions });
  } catch (error: any) {
    console.error('Error requesting revision:', error);
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// 4. DISPUTES
// ════════════════════════════════════════

/** POST /api/gig-escrow/dispute — Open a dispute */
router.post('/dispute', authenticate, async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { serviceRequestId, reason, description } = req.body;
    if (!reason || !description) return res.status(400).json({ error: 'reason and description required' });

    const [escrow] = await db.select().from(gigEscrow)
      .where(eq(gigEscrow.serviceRequestId, serviceRequestId));
    if (!escrow) return res.status(404).json({ error: 'Escrow not found' });

    // Only client or musician can dispute
    if (escrow.clientUserId !== userId && escrow.musicianUserId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Create dispute
    const [dispute] = await db.insert(gigDisputes).values({
      serviceRequestId,
      escrowId: escrow.id,
      openedByUserId: userId,
      reason,
      description,
      status: 'open',
    }).returning();

    // Update escrow + deliverables status
    await db.update(gigEscrow)
      .set({ status: 'disputed' })
      .where(eq(gigEscrow.id, escrow.id));

    await db.update(gigDeliverables)
      .set({ status: 'disputed' })
      .where(eq(gigDeliverables.serviceRequestId, serviceRequestId));

    // Notify the other party
    const otherUserId = escrow.clientUserId === userId ? escrow.musicianUserId : escrow.clientUserId;
    await db.insert(notifications).values({
      userId: otherUserId,
      type: 'DISPUTE_OPENED',
      title: '⚠️ Dispute opened',
      message: `A dispute has been opened for this service: "${reason}". Our team will review within 48 hours.`,
      link: `/producer-tools?tab=bids&request=${serviceRequestId}`,
      metadata: { disputeId: dispute.id, serviceRequestId },
    });

    res.json({ success: true, dispute });
  } catch (error: any) {
    console.error('Error opening dispute:', error);
    res.status(500).json({ error: error.message });
  }
});

// ════════════════════════════════════════
// 5. CONTRACT TERMS (static — served as JSON)
// ════════════════════════════════════════

router.get('/contract-terms', (_req, res) => {
  res.json({
    platformName: 'BOOSTIFY',
    lastUpdated: '2026-04-07',
    version: '1.0',
    
    paymentRules: {
      creditSystem: {
        rate: '1 credit = $1 USD',
        minimumPurchase: '$10 (10 credits)',
        applicationCost: '5% of job budget (min 1, max 50 credits)',
        packages: [
          { credits: 10, price: 10, bonus: 0 },
          { credits: 25, price: 25, bonus: 2 },
          { credits: 50, price: 50, bonus: 7 },
          { credits: 100, price: 100, bonus: 20 },
          { credits: 250, price: 250, bonus: 75 },
        ],
      },
      escrow: {
        description: 'All payments are held in secure Stripe-powered escrow until the client approves the delivery.',
        fundingTrigger: 'When client accepts a bid and completes Stripe checkout',
        releaseTrigger: 'When client clicks "Approve Delivery"',
        platformFee: '20% of total service amount',
        musicianPayout: '80% of total service amount',
        refundPolicy: 'Full refund if musician fails to deliver within deadline + 48hrs',
      },
      disputes: {
        timeToOpen: 'Within 7 days of delivery',
        reviewTime: '48 hours by BOOSTIFY team',
        outcomes: [
          'Full refund to client',
          'Partial refund (negotiated)',
          'Payment released to musician',
          'Redelivery required',
        ],
      },
    },

    deliveryRules: {
      fileProtection: {
        beforeApproval: 'Client can STREAM (listen to) delivered files but CANNOT download until payment is approved.',
        afterApproval: 'Full quality files are unlocked for download.',
        watermark: 'Preview files may include audio watermark or reduced quality.',
      },
      revisions: {
        included: 2,
        description: 'Each service includes up to 2 free revisions. Additional revisions must be negotiated between parties.',
        deadline: 'Musician must deliver revisions within 48 hours.',
      },
      deadlines: {
        musicianDelivery: 'Must deliver within the estimated delivery time specified in the bid.',
        gracePeriod: '48 hours grace period after deadline.',
        autoCancel: 'If no delivery after deadline + grace period, client can request automatic refund.',
      },
    },

    serviceContract: {
      title: 'BOOSTIFY Marketplace Service Agreement',
      parties: {
        client: 'The person or entity posting the service request.',
        musician: 'The person or entity submitting a bid and performing the service.',
        platform: 'BOOSTIFY LLC, the marketplace operator.',
      },
      obligations: {
        client: [
          'Provide clear and complete service requirements in the request.',
          'Fund escrow before work begins.',
          'Review deliverables within 72 hours of delivery.',
          'Communicate feedback constructively via platform messaging.',
          'Approve delivery to release payment or request revision within revision limits.',
        ],
        musician: [
          'Deliver original work that matches the service request specifications.',
          'Deliver within the estimated timeframe specified in the bid.',
          'Provide high-quality files in industry-standard formats.',
          'Address revision requests within 48 hours.',
          'Not reuse or resell delivered work without client consent.',
          'Maintain professional communication throughout the project.',
        ],
        platform: [
          'Hold payments securely in Stripe-powered escrow.',
          'Protect both parties intellectual property.',
          'Provide dispute resolution within 48 hours.',
          'Maintain file streaming protection (no downloads until approved).',
          'Process payouts within 3-5 business days after approval.',
        ],
      },
      intellectualProperty: {
        ownership: 'Upon approved delivery and payment release, full rights transfer to the client unless otherwise agreed in the bid message.',
        license: 'Musician retains the right to showcase the work in their portfolio unless client requests confidentiality.',
        copyright: 'All work must be original. Use of copyrighted samples must be disclosed in the bid.',
      },
      termination: {
        clientCancellation: 'Before escrow: free. After escrow but before delivery: full refund minus Stripe processing fee.',
        musicianWithdrawal: 'Before starting: full escrow refund. After partial delivery: negotiated refund via dispute.',
        platformTermination: 'BOOSTIFY reserves the right to terminate accounts violating terms.',
      },
    },

    faq: [
      {
        q: 'How do I apply for a gig?',
        a: 'Browse the Live Services Map, click on a gig that matches your skills, fill out the application form with your price and message, then submit. Each application costs credits (5% of the job budget).',
      },
      {
        q: 'What are Gig Credits and how do I get them?',
        a: 'Gig Credits are the currency for applying to gigs. 1 credit = $1. You can purchase credits starting at $10, or earn free credits by completing your profile, referring musicians, and getting 5-star reviews.',
      },
      {
        q: 'How does the payment escrow work?',
        a: 'When a client accepts your bid, they pay the full amount into a secure Stripe escrow. The money is held safely until you deliver and the client approves. Then 80% is released to you, and 20% goes to the platform.',
      },
      {
        q: 'Can the client listen to my work before paying?',
        a: 'Yes! Clients can stream (listen to) your delivered files, but they CANNOT download the full quality files until they approve the delivery and the payment is released.',
      },
      {
        q: 'What if the client doesn\'t approve my delivery?',
        a: 'The client has 72 hours to review. They can request up to 2 revisions. If there\'s still a disagreement, either party can open a dispute for BOOSTIFY to review.',
      },
      {
        q: 'How long does it take to get paid?',
        a: 'Once the client approves, the payment is released immediately. Funds are processed to your account within 3-5 business days via Stripe.',
      },
      {
        q: 'What happens if there\'s a dispute?',
        a: 'BOOSTIFY reviews all disputes within 48 hours. We examine the original request, the delivery, and all communication. Outcomes include full/partial refund, payment release, or redelivery.',
      },
      {
        q: 'Can I get a refund on credits?',
        a: 'Credits used on applications are non-refundable. Unused credit balance can be refunded within 30 days of purchase, minus any Stripe processing fees.',
      },
      {
        q: 'What file formats should I deliver?',
        a: 'Deliver in industry-standard formats: WAV/FLAC for audio, MP4/MOV for video, PDF for documents. Always include the project file if requested.',
      },
      {
        q: 'How many revisions are included?',
        a: 'Each service includes 2 free revisions. Additional revisions can be negotiated directly between client and musician.',
      },
      {
        q: 'What is the platform fee?',
        a: 'BOOSTIFY charges 20% on completed services. If a gig is $500, the musician receives $400 and the platform receives $100. There are no hidden fees.',
      },
      {
        q: 'Can I cancel after funding escrow?',
        a: 'If the musician hasn\'t started working, you can cancel for a full refund (minus Stripe processing fees). After work has begun, cancellation goes through the dispute process.',
      },
    ],
  });
});

export default router;
