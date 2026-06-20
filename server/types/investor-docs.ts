// ═══════════════════════════════════════════════════════════════════════════════
// INVESTOR DOCUMENTS SYSTEM - TypeScript Type Definitions
// Juno 2.0 CLO Agent + Full Negotiation Engine
// ═══════════════════════════════════════════════════════════════════════════════

export type InvestmentInstrument = 'SAFE' | 'SIDE_LETTER' | 'SUBSCRIPTION_AGREEMENT' | 'TERM_SHEET';
export type DocumentStatus = 'draft' | 'proposed' | 'review' | 'counter' | 'accepted' | 'signed';
export type ProposalStatus = 'pending' | 'under_review' | 'counter_proposed' | 'accepted' | 'rejected';
export type CloVerdictType = 'auto_approve' | 'counter_propose' | 'escalate_ceo' | 'reject';
export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED' | 'CRITICAL';

// ─── RISK SCORING ───────────────────────────────────────────────────────────
export interface RiskScoreBreakdown {
  policyViolation: number;        // 0-1: How much does this violate board policy
  legalComplexity: number;        // 0-1: How complex is the legal analysis
  founderImpact: number;          // 0-1: How much impact on founders
  precedentRisk: number;          // 0-1: How risky vs market precedent
  finalScore: number;             // 0-1: Weighted final score
  riskLevel: RiskLevel;           // GREEN | YELLOW | RED | CRITICAL
}

// ─── FIRESTORE DOCUMENT MODELS ───────────────────────────────────────────────
export interface InvestorDocument {
  id: string;
  artistId: string;
  artistName: string;
  investorId?: string;
  investorEmail?: string;
  investorName?: string;
  
  documentType: InvestmentInstrument;
  title: string;
  version: number;
  status: DocumentStatus;
  
  content: string;                // Full markdown/HTML document
  terms: DocumentTerms;           // Parsed key terms
  
  signatures: {
    boostifySignedAt?: number;
    investorSignedAt?: number;
    boostifySignature?: string;
    investorSignature?: string;
  };
  
  cloReview?: {
    reviewedAt: number;
    verdict: CloVerdictType;
    riskScore: RiskScoreBreakdown;
    reasoning: string;
  };
  
  createdAt: number;
  updatedAt: number;
  createdBy: string;
  negotiationId?: string;
}

export interface DocumentTerms {
  valuationCap?: number;
  discount?: number;
  proRataRights?: number;
  mfn?: boolean;
  boardSeats?: number;
  liquidationPreference?: string;
  antiDilution?: string;
  dragAlongRights?: boolean;
  [key: string]: any;
}

export interface InvestorProposal {
  id: string;
  negotiationId: string;
  documentId: string;
  
  proposedBy: 'investor' | 'boostify';
  proposedByName: string;
  proposedByEmail: string;
  
  originalTerms: DocumentTerms;
  proposedTerms: DocumentTerms;
  changes: ProposedChange[];
  
  status: ProposalStatus;
  
  cloAnalysis?: LegalAnalysis;
  cloVerdict?: {
    verdict: CloVerdictType;
    riskScore: RiskScoreBreakdown;
    counterProposal?: DocumentTerms;
    reasoning: string;
    alternatives?: string[];
  };
  
  investorNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProposedChange {
  field: string;
  originalValue: any;
  proposedValue: any;
  rationale?: string;
}

// ─── JUNO 2.0 LEGAL ANALYSIS ───────────────────────────────────────────────
export interface LegalAnalysis {
  // Layer 1: Policy Compliance
  policyCompliance: {
    violations: PolicyViolation[];
    overall: 'compliant' | 'minor_violation' | 'major_violation';
    boardPolicySummary: string;
  };
  
  // Layer 2: Precedent & Market Analysis
  precedentAnalysis: {
    comparableDeals: ComparableDeal[];
    marketPercentile: number;        // 0-100, where investor sits vs peers
    investorTrackRecord: {
      deals: number;
      averageRound: number;
      reputation: 'excellent' | 'good' | 'neutral' | 'concerning';
    };
    marketContext: string;
  };
  
  // Layer 3: Legal Risk Assessment
  legalRisk: {
    clauses: ClauseRiskAnalysis[];
    conflicts: string[];
    overallRisk: number;             // 0-1
    regulatoryHazards: string[];
  };
  
  // Layer 4: Strategic Analysis
  strategicAnalysis: {
    investorValue: string;           // Why this investor matters
    dealShape: 'aggressive_for_boostify' | 'balanced' | 'aggressive_for_investor';
    likelihood: number;              // 0-1: Probability they accept counter
    recommendation: string;
  };
  
  // Layer 5: Human Judgment
  escalationNotes?: string;
  ceoApprovalRequired: boolean;
  
  // Overall
  reasoning: string;                 // 2-3 paragraphs explaining logic
  auditTrail: {
    analyzedAt: number;
    analyzedBy: string;              // 'juno-2.0'
    model: string;
    tokensUsed: number;
  };
}

export interface PolicyViolation {
  policy: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  resolution?: string;
}

export interface ComparableDeal {
  company: string;
  date: string;
  valuationCap: number;
  discount: number;
  proRata: number;
  mfn: boolean;
  source: string;
}

export interface ClauseRiskAnalysis {
  clause: string;
  risk: number;                      // 0-1
  concern: string;
  precedent?: string;
  recommendation: string;
}

// ─── NEGOTIATION STATE ───────────────────────────────────────────────────────
export interface InvestorNegotiation {
  id: string;
  documentId: string;
  investorId: string;
  
  stage: 'proposal' | 'counter_1' | 'counter_2' | 'counter_3' | 'accepted' | 'failed';
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  
  documents: string[];              // Document IDs in thread
  proposals: string[];              // Proposal IDs in order
  
  timeline: {
    startedAt: number;
    lastActivityAt: number;
    completedAt?: number;
    estTimeToClose: string;
  };
  
  metrics: {
    roundsOfNegotiation: number;
    cloAnalysesDone: number;
    counterProposalsGenerated: number;
    estimatedTimeToClose: number;    // milliseconds
  };
  
  outcome?: {
    accepted: boolean;
    finalTerms: DocumentTerms;
    boostifyGainVsInitial: number;   // %, how much better than initial ask
  };
  
  createdAt: number;
  updatedAt: number;
}

// ─── CLO DECISION RECORD ────────────────────────────────────────────────────
export interface CloDecision {
  id: string;
  negotiationId: string;
  proposalId: string;
  
  verdict: CloVerdictType;
  riskScore: RiskScoreBreakdown;
  
  legalAnalysis: LegalAnalysis;
  
  counterProposal?: {
    terms: DocumentTerms;
    rationale: string;
  };
  
  escalationReason?: string;          // If escalate_ceo, why
  
  createdAt: number;
  createdBy: string;
  
  executed: {
    at?: number;
    by?: string;
    outcome?: 'accepted' | 'rejected' | 'countered';
  };
}

// ─── AUDIT LOG ──────────────────────────────────────────────────────────────
export interface InvestorAuditLogEntry {
  id: string;
  timestamp: number;
  
  action: 'document_created' | 'proposal_submitted' | 'clo_reviewed' | 'counter_proposed' | 
          'document_signed' | 'deal_closed' | 'negotiation_abandoned';
  
  actor: {
    type: 'investor' | 'boostify' | 'juno' | 'admin';
    id: string;
    name: string;
  };
  
  target: {
    type: 'document' | 'proposal' | 'negotiation';
    id: string;
  };
  
  details: {
    [key: string]: any;
  };
  
  ipAddress?: string;
  userAgent?: string;
}

// ─── NDA SIGNATURE (PRE-ACCESS GATE) ────────────────────────────────────────
export interface InvestorNdaSignature {
  id: string;
  investorEmail: string;
  investorName?: string;
  
  ndaVersion: string;
  acceptedTerms: boolean;
  signedAt: number;
  
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  
  status: 'valid' | 'revoked' | 'expired';
}

// ─── API PAYLOADS ───────────────────────────────────────────────────────────
export interface SubmitProposalRequest {
  documentId: string;
  proposedTerms: DocumentTerms;
  investorNotes?: string;
}

export interface ReviewProposalRequest {
  proposalId: string;
  // Juno will automatically analyze and respond
}

export interface SignDocumentRequest {
  documentId: string;
  signature: string;
  signedAs: 'investor' | 'boostify';
}

export interface GetNegotiationResponse {
  negotiation: InvestorNegotiation;
  documents: InvestorDocument[];
  proposals: InvestorProposal[];
  currentProposal: InvestorProposal | null;
  cloDecisions: CloDecision[];
}

// ─── JUNO 2.0 DECISION FRAMEWORK ────────────────────────────────────────────
export interface JunoDecisionFramework {
  // Input proposal
  proposal: InvestorProposal;
  
  // 5-layer analysis result
  analysis: LegalAnalysis;
  
  // Decision
  verdict: CloVerdictType;
  
  // If counter: what do we propose
  counterTerms?: DocumentTerms;
  counterRationale?: string;
  
  // Why this verdict
  reasoning: string;                 // 2-3 paragraphs
  
  // Confidence score
  confidence: number;                // 0-1
  
  // When to escalate to CEO
  needsCeoReview: boolean;
  escalationReason?: string;
}

// ─── JUNO PRO-BOOSTIFY CONSTANTS ────────────────────────────────────────────
export const JUNO_POLICY_THRESHOLDS = {
  MIN_VALUATION_CAP: 40_000_000,      // Won't accept <$40M
  MAX_DISCOUNT: 0.30,                 // Won't accept >30% discount
  MIN_PRO_RATA: 1.0,                  // At least 1x pro-rata
  MAX_PRO_RATA: 3.0,                  // Won't exceed 3x
  BOARD_SEATS_RESERVED: 1,            // Max 1 seat for new investor
  MFN_PREFERENCE: true,               // Always push for MFN
};

export const JUNO_BIAS = {
  DEFENSE_STRENGTH: 'professional',   // How aggressively we defend
  COUNTER_STRATEGY: 'market_based',   // Always reference market
  ESCALATION_THRESHOLD: 0.65,         // Risk score that triggers CEO
  AUTO_APPROVE_THRESHOLD: 0.20,       // Risk score for auto-approval
};
