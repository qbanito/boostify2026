#!/usr/bin/env tsx
/**
 * SEED SCRIPT: Initialize Firestore with investor demo data
 * Run: npx tsx server/scripts/seed-investor-data.ts
 * 
 * Creates:
 * - investor_documents collection (2 demo documents)
 * - investor_proposals collection (proposals linked to documents)
 * - clo_decisions collection (Juno 2.0 analysis results)
 * - investor_audit_log collection (audit trail)
 */

import 'dotenv/config';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, cert } from 'firebase-admin/app';
import { createPrivateKey } from 'crypto';

// Initialize Firebase Admin SDK
let projectId: string | undefined;
let clientEmail: string | undefined;
let privateKey: string | undefined;

if (process.env.FIREBASE_ADMIN_KEY) {
  try {
    const raw = process.env.FIREBASE_ADMIN_KEY.trim().replace(/^['"]|['"]$/g, '');
    const sa = JSON.parse(raw);
    projectId = sa.project_id;
    clientEmail = sa.client_email;
    privateKey = sa.private_key;
  } catch (err) {
    console.error('Failed to parse FIREBASE_ADMIN_KEY');
    process.exit(1);
  }
} else {
  projectId = process.env.FIREBASE_PROJECT_ID;
  clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  privateKey = process.env.FIREBASE_PRIVATE_KEY;
}

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase credentials');
  process.exit(1);
}

// Normalize private key
let pem = privateKey.trim().replace(/^['"]|['"]$/g, '');
pem = pem.replace(/\\n/g, '\n');
try {
  const keyObject = createPrivateKey(pem);
  pem = keyObject.export({ type: 'pkcs8', format: 'pem' }) as string;
} catch {
  // Continue with original if normalization fails
}

const app = initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey: pem
  })
});

const db = getFirestore(app);

// ═══════════════════════════════════════════════════════════════════════════════
// DEMO DATA STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════════

interface InvestorDocument {
  id: string;
  investorId: string;
  investorName: string;
  investorEmail: string;
  title: string;
  type: 'SAFE' | 'ADVANCED_SUBSCRIPTION' | 'EQUITY' | 'CONVERTIBLE_NOTE';
  status: 'pending' | 'counter' | 'accepted' | 'signed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  terms: {
    valuation?: string;
    discount?: string;
    cap?: string;
    mfn?: boolean;
    boardSeat?: boolean;
    proRata?: string;
  };
  negotiationId: string;
}

interface InvestorProposal {
  id: string;
  documentId: string;
  proposedBy: 'investor' | 'boostify' | 'juno';
  proposedTerms: {
    valuation?: string;
    discount?: string;
    cap?: string;
    mfn?: boolean;
    boardSeat?: boolean;
    proRata?: string;
    [key: string]: any;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  notes?: string;
}

interface CloDecision {
  id: string;
  proposalId: string;
  documentId: string;
  verdict: 'auto_approve' | 'counter_propose' | 'escalate_ceo' | 'reject';
  riskScore: number;
  riskBreakdown: {
    policyRisk: number;
    legalRisk: number;
    founderProtectionRisk: number;
    precedentRisk: number;
  };
  reasoning: string;
  counterProposal?: {
    valuation?: string;
    discount?: string;
    cap?: string;
    mfn?: boolean;
    boardSeat?: boolean;
    proRata?: string;
    [key: string]: any;
  };
  analyzedAt: Timestamp;
  modelVersion: string;
}

interface AuditLogEntry {
  id: string;
  documentId: string;
  action: string;
  actor: string;
  details: any;
  timestamp: Timestamp;
  severity: 'info' | 'warning' | 'error';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEED DATA
// ═══════════════════════════════════════════════════════════════════════════════

async function seedInvestorData() {
  console.log('🌱 Starting Firestore seed...\n');

  try {
    // Demo Investors
    const investors = [
      {
        id: 'investor-001',
        name: 'Sequoia Capital',
        email: 'deals@sequoiacap.com',
        fundSize: '$5B',
        focusAreas: ['music', 'entertainment', 'creator-economy']
      },
      {
        id: 'investor-002',
        name: 'Silver Lake',
        email: 'investment@silverlake.com',
        fundSize: '$100B',
        focusAreas: ['media', 'entertainment', 'technology']
      }
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // 1. CREATE investor_documents
    // ─────────────────────────────────────────────────────────────────────────
    console.log('📄 Creating investor_documents...');

    const doc1: InvestorDocument = {
      id: 'doc-001',
      investorId: 'investor-001',
      investorName: 'Sequoia Capital',
      investorEmail: 'deals@sequoiacap.com',
      title: 'Series A - Round 1',
      type: 'ADVANCED_SUBSCRIPTION',
      status: 'counter',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
      updatedAt: Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
      terms: {
        valuation: '$50M',
        discount: '25%',
        boardSeat: true,
        proRata: '2x'
      },
      negotiationId: 'neg-001'
    };

    const doc2: InvestorDocument = {
      id: 'doc-002',
      investorId: 'investor-002',
      investorName: 'Silver Lake',
      investorEmail: 'investment@silverlake.com',
      title: 'SAFE Agreement - Standard Terms',
      type: 'SAFE',
      status: 'pending',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
      updatedAt: Timestamp.fromDate(new Date()),
      terms: {
        cap: '$75M',
        discount: '15%',
        mfn: true
      },
      negotiationId: 'neg-002'
    };

    await db.collection('investor_documents').doc(doc1.id).set(doc1);
    console.log(`  ✅ Created: ${doc1.title}`);

    await db.collection('investor_documents').doc(doc2.id).set(doc2);
    console.log(`  ✅ Created: ${doc2.title}\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. CREATE investor_proposals
    // ─────────────────────────────────────────────────────────────────────────
    console.log('💬 Creating investor_proposals...');

    const proposal1: InvestorProposal = {
      id: 'prop-001',
      documentId: 'doc-001',
      proposedBy: 'investor',
      proposedTerms: {
        valuation: '$50M',
        discount: '25%',
        boardSeat: true,
        proRata: '2x'
      },
      status: 'pending',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
      updatedAt: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
      notes: 'Initial offer from Sequoia Capital'
    };

    const proposal2: InvestorProposal = {
      id: 'prop-002',
      documentId: 'doc-002',
      proposedBy: 'investor',
      proposedTerms: {
        cap: '$75M',
        discount: '15%',
        mfn: true
      },
      status: 'pending',
      createdAt: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
      updatedAt: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
      notes: 'SAFE with market-standard terms'
    };

    await db.collection('investor_documents').doc(doc1.id).collection('proposals').doc(proposal1.id).set(proposal1);
    console.log(`  ✅ Created: Proposal for ${doc1.title}`);

    await db.collection('investor_documents').doc(doc2.id).collection('proposals').doc(proposal2.id).set(proposal2);
    console.log(`  ✅ Created: Proposal for ${doc2.title}\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CREATE clo_decisions (Juno 2.0 Analysis)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('⚖️  Creating clo_decisions (Juno 2.0 Analysis)...');

    const decision1: CloDecision = {
      id: 'clo-001',
      proposalId: 'prop-001',
      documentId: 'doc-001',
      verdict: 'counter_propose',
      riskScore: 0.42,
      riskBreakdown: {
        policyRisk: 0.5,
        legalRisk: 0.35,
        founderProtectionRisk: 0.4,
        precedentRisk: 0.35
      },
      reasoning: `Valuation is below our $40.9M minimum threshold and discount exceeds our 22% policy limit. Sequoia is proposing $50M @ 25%, which violates core Boostify investment policy. Historical precedent shows similar-stage music platforms raise at $55-65M with 18-20% discounts. Recommend counter-propose with market-standard terms that protect founder equity while maintaining investor upside.`,
      counterProposal: {
        valuation: '$52M',
        discount: '18%',
        boardSeat: false,
        proRata: '1.5x'
      },
      analyzedAt: Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
      modelVersion: 'juno-2.0'
    };

    const decision2: CloDecision = {
      id: 'clo-002',
      proposalId: 'prop-002',
      documentId: 'doc-002',
      verdict: 'auto_approve',
      riskScore: 0.12,
      riskBreakdown: {
        policyRisk: 0.1,
        legalRisk: 0.08,
        founderProtectionRisk: 0.15,
        precedentRisk: 0.12
      },
      reasoning: `Terms align perfectly with SAFE best practices. Silver Lake's $75M cap is reasonable for current Boostify valuation trajectory, 15% discount is conservative and below our 22% policy maximum, and MFN is standard market practice. Analysis of 15 comparable Series A rounds in music/creator-economy shows these terms are in the 75th percentile for investor favorability. Immediate approval recommended.`,
      counterProposal: null,
      analyzedAt: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
      modelVersion: 'juno-2.0'
    };

    await db.collection('clo_decisions').doc(decision1.id).set(decision1);
    console.log(`  ✅ Created: Analysis for Proposal 1 (COUNTER_PROPOSE)`);

    await db.collection('clo_decisions').doc(decision2.id).set(decision2);
    console.log(`  ✅ Created: Analysis for Proposal 2 (AUTO_APPROVE)\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. CREATE investor_audit_log
    // ─────────────────────────────────────────────────────────────────────────
    console.log('📋 Creating investor_audit_log...');

    const auditEntries: AuditLogEntry[] = [
      {
        id: 'audit-001',
        documentId: 'doc-001',
        action: 'document_created',
        actor: 'system',
        details: { type: 'ADVANCED_SUBSCRIPTION', investorName: 'Sequoia Capital' },
        timestamp: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
        severity: 'info'
      },
      {
        id: 'audit-002',
        documentId: 'doc-001',
        action: 'proposal_received',
        actor: 'investor-001',
        details: { proposalId: 'prop-001', valuation: '$50M', discount: '25%' },
        timestamp: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
        severity: 'info'
      },
      {
        id: 'audit-003',
        documentId: 'doc-001',
        action: 'juno_analysis_complete',
        actor: 'juno-2.0',
        details: { verdict: 'counter_propose', riskScore: 0.42 },
        timestamp: Timestamp.fromDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)),
        severity: 'info'
      }
    ];

    for (const entry of auditEntries) {
      await db.collection('investor_audit_log').doc(entry.id).set(entry);
    }
    console.log(`  ✅ Created: ${auditEntries.length} audit log entries\n`);

    // ─────────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────────────────────────────────
    console.log('✅ SEED COMPLETE!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Collections created:');
    console.log('  • investor_documents: 2 documents');
    console.log('  • investor_documents/{doc}/proposals: 2 proposals');
    console.log('  • clo_decisions: 2 analyses');
    console.log('  • investor_audit_log: 3 entries');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🔗 Access demo data:');
    console.log('  • http://localhost:5000/investor-documents');
    console.log('\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seedInvestorData();
