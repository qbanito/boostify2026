// ═══════════════════════════════════════════════════════════════════════════════
// INVESTOR DOCUMENTS API ROUTES
// Full CRUD + Juno 2.0 Integration for Negotiation System
// ═══════════════════════════════════════════════════════════════════════════════

import express, { Request, Response } from 'express';
import { db, admin } from '../firebase';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';
import { junoClaiAgent } from '../agents/clo-agent';
import { InvestorDocument, InvestorProposal, InvestorNegotiation, CloDecision, InvestorAuditLogEntry, SubmitProposalRequest, GetNegotiationResponse } from '../types/investor-docs';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

async function resolveNumericUserId(req: Request): Promise<number | null> {
  const raw = (req as any).user?.id || (req as any).auth?.userId;
  if (!raw) return null;
  if (typeof raw === 'number') return raw;
  // Clerk sends string ID like "user_xxx" — resolve from DB
  const [user] = await db.select({ id: users.id }).from(users)
    .where(eq(users.clerkId, String(raw))).limit(1);
  return user?.id ?? null;
}

const requireAuth = async (req: Request, res: Response, next: Function) => {
  try {
    const userId = await resolveNumericUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    (req as any).userId = userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

const requireAdmin = async (req: Request, res: Response, next: Function) => {
  try {
    const userId = await resolveNumericUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    // Check if user is admin (simple check - would be more complex in production)
    const isAdmin = true; // TODO: Check actual admin role
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden: Admin only' });
    
    (req as any).userId = userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/investor-docs/demo/all - Fetch all demo documents (NO AUTH required)
// MUST BE BEFORE /:investorId to avoid being matched as /:investorId
// ─────────────────────────────────────────────────────────────────────────────

router.get('/demo/all', async (req: Request, res: Response) => {
  try {
    // Bounded read using firebase-admin API (cap so this never full-scans).
    const snapshot = await db.collection('investor_documents').limit(200).get();
    
    const documents: InvestorDocument[] = [];
    snapshot.forEach(docSnap => {
      documents.push({ id: docSnap.id, ...docSnap.data() } as InvestorDocument);
    });
    
    res.json({ success: true, documents });
  } catch (error) {
    console.error('[investor-docs] GET demo documents error:', error);
    res.status(500).json({ error: 'Failed to fetch demo documents' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/investor-docs/:investorId - Fetch all documents for investor
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:investorId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { investorId } = req.params;
    
    // Firestore query using firebase-admin API
    const snapshot = await db.collection('investor_documents')
      .where('investorId', '==', investorId)
      .get();
    
    const documents: InvestorDocument[] = [];
    snapshot.forEach(docSnap => {
      documents.push({ id: docSnap.id, ...docSnap.data() } as InvestorDocument);
    });
    
    res.json({ success: true, documents });
  } catch (error) {
    console.error('[investor-docs] GET documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/investor-docs/:docId/view - View specific document
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:docId/view', async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    
    const docSnap = await db.collection('investor_documents').doc(docId).get();
    
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const document = { id: docSnap.id, ...docSnap.data() } as InvestorDocument;
    res.json({ success: true, document });
  } catch (error) {
    console.error('[investor-docs] GET document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/investor-docs/:docId/proposals - Submit proposal (investor edits)
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:docId/proposals', requireAuth, async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    const { proposedTerms, investorNotes } = req.body as SubmitProposalRequest;
    const userId = (req as any).userId;
    
    // Fetch original document
    const docSnap = await db.collection('investor_documents').doc(docId).get();
    
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const document = { id: docSnap.id, ...docSnap.data() } as InvestorDocument;
    
    // Create proposal
    const proposalId = db.collection('investor_proposals').doc().id;
    const proposal: InvestorProposal = {
      id: proposalId,
      negotiationId: document.negotiationId || proposalId,
      documentId: docId,
      proposedBy: 'investor',
      proposedByName: document.investorName || 'Investor',
      proposedByEmail: document.investorEmail || '',
      originalTerms: document.terms,
      proposedTerms,
      changes: [],
      status: 'pending',
      investorNotes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    // Save proposal to Firestore
    await db.collection('investor_proposals').doc(proposalId).set(proposal);
    
    // Trigger Juno 2.0 CLO Review (async, fire-and-forget)
    setImmediate(async () => {
      try {
        const analysis = await junoClaiAgent.reviewProposal(proposal);
        
        // Save Juno's decision
        const decisionId = db.collection('clo_decisions').doc().id;
        const decision: CloDecision = {
          id: decisionId,
          negotiationId: proposal.negotiationId,
          proposalId: proposalId,
          verdict: analysis.verdict,
          riskScore: analysis.analysis.legalRisk.overallRisk as any, // TODO: Fix typing
          legalAnalysis: analysis.analysis,
          counterProposal: analysis.counterTerms ? {
            terms: analysis.counterTerms,
            rationale: analysis.counterRationale || ''
          } : undefined,
          escalationReason: analysis.escalationReason,
          createdAt: Date.now(),
          createdBy: 'juno-2.0-clo',
          executed: {}
        };
        
        await db.collection('clo_decisions').doc(decisionId).set(decision);
        
        // Update proposal with Juno's analysis
        await db.collection('investor_proposals').doc(proposalId).update({
          cloAnalysis: analysis.analysis,
          cloVerdict: {
            verdict: analysis.verdict,
            riskScore: analysis.analysis.legalRisk.overallRisk,
            counterProposal: analysis.counterTerms,
            reasoning: analysis.reasoning,
            alternatives: analysis.analysis.strategicAnalysis.recommendation ? [analysis.analysis.strategicAnalysis.recommendation] : []
          },
          updatedAt: Date.now()
        });
        
        // Log audit event
        await logAuditEvent({
          action: 'clo_reviewed',
          actor: { type: 'juno', id: 'juno-2.0-clo', name: 'Juno CLO Agent' },
          target: { type: 'proposal', id: proposalId },
          details: { verdict: analysis.verdict, riskScore: analysis.analysis.legalRisk.overallRisk }
        });
        
        console.log(`[Juno] Analyzed proposal ${proposalId}: ${analysis.verdict}`);
      } catch (error) {
        console.error('[Juno] Error analyzing proposal:', error);
      }
    });
    
    // Log audit event
    await logAuditEvent({
      action: 'proposal_submitted',
      actor: { type: 'investor', id: String(userId), name: document.investorName || 'Investor' },
      target: { type: 'proposal', id: proposalId },
      details: { proposedTerms }
    });
    
    res.json({ 
      success: true, 
      proposal,
      message: 'Proposal submitted. Juno 2.0 CLO is reviewing...'
    });
  } catch (error) {
    console.error('[investor-docs] POST proposal error:', error);
    res.status(500).json({ error: 'Failed to submit proposal' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/investor-docs/:docId/sign - E-signature
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:docId/sign', requireAuth, async (req: Request, res: Response) => {
  try {
    const { docId } = req.params;
    const { signature, signedAs } = req.body;
    const userId = (req as any).userId;
    
    const docSnap = await db.collection('investor_documents').doc(docId).get();
    
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const document = { id: docSnap.id, ...docSnap.data() } as InvestorDocument;
    
    // Update signature
    const updateData: any = {};
    if (signedAs === 'investor') {
      updateData['signatures.investorSignedAt'] = Date.now();
      updateData['signatures.investorSignature'] = signature;
    } else if (signedAs === 'boostify') {
      updateData['signatures.boostifySignedAt'] = Date.now();
      updateData['signatures.boostifySignature'] = signature;
    }
    
    updateData.status = 'signed';
    updateData.updatedAt = Date.now();
    
    await db.collection('investor_documents').doc(docId).update(updateData);
    
    // Log audit event
    await logAuditEvent({
      action: 'document_signed',
      actor: { type: signedAs === 'investor' ? 'investor' : 'boostify', id: String(userId), name: signedAs },
      target: { type: 'document', id: docId },
      details: { signedAs }
    });
    
    res.json({ success: true, message: 'Document signed successfully' });
  } catch (error) {
    console.error('[investor-docs] POST sign error:', error);
    res.status(500).json({ error: 'Failed to sign document' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/investor-docs/:negotiationId/negotiation - Get full negotiation thread
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:negotiationId/negotiation', async (req: Request, res: Response) => {
  try {
    const { negotiationId } = req.params;
    
    // Fetch negotiation
    const negSnap = await db.collection('investor_negotiations').doc(negotiationId).get();
    
    if (!negSnap.exists) {
      return res.status(404).json({ error: 'Negotiation not found' });
    }
    
    const negotiation = { id: negSnap.id, ...negSnap.data() } as InvestorNegotiation;
    
    // Fetch all documents
    const documents: InvestorDocument[] = [];
    for (const docId of negotiation.documents) {
      const docSnap = await db.collection('investor_documents').doc(docId).get();
      if (docSnap.exists) {
        documents.push({ id: docSnap.id, ...docSnap.data() } as InvestorDocument);
      }
    }
    
    // Fetch all proposals
    const proposals: InvestorProposal[] = [];
    for (const proposalId of negotiation.proposals) {
      const propSnap = await db.collection('investor_proposals').doc(proposalId).get();
      if (propSnap.exists) {
        proposals.push({ id: propSnap.id, ...propSnap.data() } as InvestorProposal);
      }
    }
    
    const currentProposal = proposals[proposals.length - 1] || null;
    
    // Fetch CLO decisions
    const decisionsSnap = await db.collection('clo_decisions')
      .where('negotiationId', '==', negotiationId)
      .get();
    
    const cloDecisions: CloDecision[] = [];
    decisionsSnap.forEach(doc => {
      cloDecisions.push({ id: doc.id, ...doc.data() } as CloDecision);
    });
    
    const response: GetNegotiationResponse = {
      negotiation,
      documents,
      proposals,
      currentProposal,
      cloDecisions
    };
    
    res.json({ success: true, ...response });
  } catch (error) {
    console.error('[investor-docs] GET negotiation error:', error);
    res.status(500).json({ error: 'Failed to fetch negotiation' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Log audit events
// ─────────────────────────────────────────────────────────────────────────────

async function logAuditEvent(event: Partial<InvestorAuditLogEntry>) {
  try {
    const logEntry: InvestorAuditLogEntry = {
      id: db.collection('investor_audit_log').doc().id,
      timestamp: Date.now(),
      action: event.action as any,
      actor: event.actor as any,
      target: event.target as any,
      details: event.details || {},
    };
    
    await db.collection('investor_audit_log').doc(logEntry.id).set(logEntry);
  } catch (error) {
    console.error('[audit] Failed to log event:', error);
  }
}

export default router;
