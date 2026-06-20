# 🏛️ INVESTOR DOCUMENT NEGOTIATION SYSTEM
## Plan Especial: Documentos + Negociaciones + CLO Agent (Juno)

**Objetivo Principal:** Crear un ecosistema completo de firma electrónica de documentos + negociación bidireccional automática, donde el **Chief Legal Officer (Juno)** actúa como abogado autónomo de Boostify para revisar, contraofertay gestionar toda la documentación.

**Versión:** 1.0 · **Fecha:** 2026-06-16 · **Owner:** Neiver Alvarez-AI + Juno (CLO)

---

## 📋 ÍNDICE

1. [Visión General](#visión-general)
2. [Arquitectura Técnica](#arquitectura-técnica)
3. [Schema de Base de Datos](#schema-de-base-de-datos)
4. [Flujos de Usuarios](#flujos-de-usuarios)
5. [Integración del CLO Agent (Juno)](#integración-del-clo-agent-juno)
6. [Plan de Implementación](#plan-de-implementación)
7. [Ejemplos de Uso](#ejemplos-de-uso)

---

## 🎯 VISIÓN GENERAL

### Problema Actual
- Inversores acceden a documentos read-only
- No hay negociación automática de términos
- El equipo de Boostify debe revisar manualmente cada contrapropuesta
- Falta auditoría/historial de cambios
- No hay integración de IA para tomar decisiones legales

### Solución Propuesta
- **Dashboard de Documentos:** Investors ven todos los docs, pueden proponer ediciones
- **Workflow de Negociación:** Cambios propuestos → CLO (Juno) revisa automáticamente → Acepta/rechaza/contrapropone
- **CLO Agent Inteligente:** Juno lee el SAFE, entiende las cláusulas, propone cambios legales consistentes
- **Versionado Completo:** Cada cambio es un evento, auditable, con timestamps
- **Real-time Notifications:** Inversores y Boostify enterados al instante
- **Dashboard Ejecutivo:** CEO/CFO/CLO ven todas las negociaciones, métricas, riesgos

### Beneficios
✅ Acelera cierre de deals (sin espera de abogados humanos)  
✅ Mantiene consistencia legal (CLO nunca deja pasar un riesgo)  
✅ Auditoría completa (cada cambio, quién lo propuso, por qué)  
✅ Escalable (sin agregar headcount)  
✅ Futurista (primero en la industria)

---

## 🏗️ ARQUITECTURA TÉCNICA

### Stack Propuesto

```
┌─────────────────────────────────────────────────────────────┐
│                 INVESTOR PORTAL FRONTEND                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Investor Dashboard → [New Button] "Review & Sign Docs" │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Investor Documents Page (/investor-documents)        │  │
│  │ • Document List (SAFE, Side Letter, etc.)           │  │
│  │ • Document Viewer (PDF/Diff view)                   │  │
│  │ • Proposed Edits Form                              │  │
│  │ • Negotiation Timeline                             │  │
│  │ • E-Signature Flow                                 │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  API GATEWAY        │
        │ /api/investor-docs  │
        │ /api/negotiations   │
        │ /api/clo-feedback   │
        └──────────┬──────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
┌─────────┐  ┌──────────┐  ┌────────────┐
│ Backend │  │ Database │  │ CLO Agent  │
│ Routes  │  │ (Firestore  (Juno)      │
│         │  │ + Drizzle)│  │           │
│ * CRUD  │  │          │  │ • Reviews  │
│ * Diff  │  │ Firestore│  │ • Proposes │
│ * NDA   │  │ Collections  │ • Signs    │
│ * Sign  │  │          │  │ • Escalates│
└─────────┘  └──────────┘  └────────────┘
    │              │              │
    └──────────────┼──────────────┘
                   │
      ┌────────────▼────────────┐
      │  EXECUTIVE DASHBOARD    │
      │  (CEO/CFO/CLO view)     │
      │ All negotiations        │
      │ Real-time notifications │
      │ Metrics & analytics     │
      └─────────────────────────┘

Flow:
1. Investor loads /investor-documents page
2. Views SAFE, Side Letter, NDA, etc.
3. Proposes edit: "Change post-money cap from $42.9M to $40M"
4. Edit stored as InvestorProposal in DB
5. CLO Agent (Juno) triggered (EventBus or polling)
6. Juno analyzes: "This dilutes us from 3.5% to 3.75%. Need to check Board cap."
7. Juno auto-proposes counter: "Accept $41.5M (3.52%)"
8. Investor notified
9. If agreed → both sign updated SAFE
10. Document version updated, audit trail logged
```

---

## 📊 SCHEMA DE BASE DE DATOS

### Firestore Collections

```typescript
// ──────────────────────────────────────────────────
// investor_documents
// ──────────────────────────────────────────────────
{
  id: "doc_safe_2026_v1",
  investorId: "inv_jane_001",
  documentType: "safe" | "side_letter" | "nda" | "subscription" | "questionnaire",
  title: "Post-Money SAFE — Boostify Music Seed 2026",
  status: "draft" | "proposed" | "under_negotiation" | "signed" | "archived",
  
  content: { // Full markdown/HTML content
    sections: { ... },
    metadata: { ... }
  },
  
  // Timestamp & versions
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  currentVersion: 3,
  
  // Who controls it
  controlledBy: "boostify" | "investor", // Who can edit?
  ownedBy: "boostify", // Legal owner
  
  // Signatures
  boostifySignature: {
    signedBy: "neiver@boostify.com",
    signedAt: timestamp,
    signatureData: "...", // e-sig
    title: "CEO / Founder"
  },
  investorSignature: {
    signedBy: "jane@fund.com",
    signedAt: timestamp,
    signatureData: "...",
    title: "Managing Partner"
  },
  
  // Legal review
  cloReview: {
    reviewedAt: timestamp,
    reviewedBy: "juno_clo",
    status: "compliant" | "flagged" | "rejected",
    feedback: "...",
    riskScore: 0.15, // 0-1
    flaggedClauses: ["clause_4.2", "clause_7.1"],
    autoProposal: { ... }
  }
}

// ──────────────────────────────────────────────────
// investor_proposals (Edit Suggestions)
// ──────────────────────────────────────────────────
{
  id: "prop_safe_20260617_jane_cap",
  parentDocId: "doc_safe_2026_v1",
  investorId: "inv_jane_001",
  
  proposedBy: "jane@fund.com", // Investor or CLO
  proposedByAgent: null | "juno_clo", // If CLO made it
  
  proposalType: "clause_edit" | "section_rewrite" | "entire_redline",
  
  // What changed
  originalText: "Post-Money Valuation Cap: US$42,857,143",
  proposedText: "Post-Money Valuation Cap: US$40,000,000",
  clauseId: "valuation_cap",
  
  // Context
  rationale: "To attract more capital and align with comparable deals",
  impactAnalysis: {
    dilution: "3.50% → 3.75%",
    affectedClauses: ["conversion_price", "safe_priority"],
    riskFlags: ["increases_founder_dilution"]
  },
  
  // Status
  status: "proposed" | "clo_reviewing" | "clo_approved" | "clo_rejected" | "clo_countered" | "investor_approved" | "investor_rejected",
  
  // CLO Response
  cloResponse: {
    respondedAt: timestamp,
    verdict: "approved" | "rejected" | "counter_proposal",
    reasoning: "Cap below $42M violates Series A insurance policy (clause 12.3). Recommend counter at $41.5M.",
    counterProposal: {
      proposedText: "Post-Money Valuation Cap: US$41,500,000",
      reasoning: "Compromise that stays within policy bounds"
    }
  },
  
  // Investor response
  investorResponse: {
    respondedAt: timestamp,
    verdict: "approved" | "rejected" | "counter_proposal",
    newProposal: { ... }
  },
  
  // Audit
  createdAt: timestamp,
  updatedAt: timestamp,
  events: [
    { at: timestamp, actor: "jane", action: "proposed" },
    { at: timestamp, actor: "juno", action: "reviewed", verdict: "counter" },
    { at: timestamp, actor: "jane", action: "approved" }
  ]
}

// ──────────────────────────────────────────────────
// investor_negotiations
// ──────────────────────────────────────────────────
{
  id: "neg_inv_jane_seed_2026",
  investorId: "inv_jane_001",
  roundId: "round_seed_2026",
  
  status: "active" | "paused" | "accepted" | "rejected" | "closed",
  stage: "pre_nda" | "nda_signed" | "diligence" | "under_negotiation" | "ready_to_close" | "closed",
  
  // Documents in this negotiation
  documents: [
    { docId: "doc_nda_...", status: "signed", signedAt: timestamp },
    { docId: "doc_safe_...", status: "under_negotiation", proposalsCount: 3 },
    { docId: "doc_side_letter_...", status: "draft" }
  ],
  
  // Proposals backlog
  proposals: ["prop_safe_...", "prop_side_letter_..."],
  
  // Timeline
  startedAt: timestamp,
  lastActivityAt: timestamp,
  targetCloseDate: timestamp,
  
  // Parties
  investorName: "Jane Q. Investor / Acme Ventures",
  investorEmail: "jane@fund.com",
  boostifyRep: "neiver@boostify.com",
  cloAgent: "juno_clo",
  
  // Metadata
  investmentAmount: 1500000,
  terms: {
    postMoneyCapTarget: 42857143,
    proRataThreshold: 100000,
    minimumCheck: 25000
  },
  
  // Logs
  events: [
    { at: timestamp, actor: "jane", type: "signed_nda" },
    { at: timestamp, actor: "jane", type: "proposed_cap_change" },
    { at: timestamp, actor: "juno", type: "reviewed_proposal" },
    ...
  ]
}

// ──────────────────────────────────────────────────
// clo_decisions (Juno's actions & reasoning)
// ──────────────────────────────────────────────────
{
  id: "clo_dec_20260617_safe_cap_review",
  relatedNegotiationId: "neg_inv_jane_seed_2026",
  relatedProposalId: "prop_safe_20260617_jane_cap",
  
  agentId: "juno_clo",
  action: "review_proposal" | "counter_proposal" | "escalate" | "auto_approve",
  
  // CLO's reasoning
  analysis: {
    proposalSummary: "Investor requests cap reduction from $42.9M to $40M",
    legalImplications: "Changes conversion formula, affects dilution, impacts Series A assumptions",
    riskAssessment: {
      legalRisk: "Medium — violates founder dilution policy",
      businessRisk: "Low — still within acceptable range",
      reputationalRisk: "None",
      overallRisk: "Low-Medium"
    },
    precedent: "Series A investors at $40M+ are standard, but our policy allows min $41.5M",
    recommendation: "Counter at $41.5M — satisfies investor desire for discount, protects board"
  },
  
  decision: {
    verdict: "counter_proposal",
    proposedTerms: {
      valuation: 41500000,
      rationale: "Board policy compliance + competitive positioning"
    },
    escalationNeeded: false,
    humanApprovalRequired: false, // CLO has autonomy=1 (HITL), so it logs decision and proposes
    ceoNotificationSent: true
  },
  
  // Precedent for future
  tag: ["valuation", "cap_negotiation", "seed_round"],
  
  createdAt: timestamp,
  signedBy: "juno_clo",
  
  // Audit
  executedAt: timestamp,
  executionStatus: "success" | "pending_approval" | "rejected"
}

// ──────────────────────────────────────────────────
// investor_nda_signatures (from Gate — pre-existing)
// ──────────────────────────────────────────────────
{
  id: "nda_sig_jane_...",
  name: "Jane Q. Investor",
  email: "jane@fund.com",
  company: "Acme Ventures",
  document: "Boostify Music — Investor Confidentiality & Non-Disclosure Agreement",
  version: "v1-2026",
  agreedAt: timestamp,
  userAgent: "..."
}

// ──────────────────────────────────────────────────
// investor_audit_log
// ──────────────────────────────────────────────────
{
  id: "audit_20260617_001",
  timestamp: serverTimestamp(),
  actor: "jane@fund.com" | "juno_clo" | "neiver@boostify.com",
  actorType: "investor" | "agent" | "boostify_team",
  
  action: "viewed_document" | "proposed_change" | "signed_document" | "clo_reviewed" | "email_sent",
  
  resourceId: "doc_safe_...",
  resourceType: "document" | "proposal" | "negotiation",
  
  details: {
    before: { ... },
    after: { ... },
    reason: "..."
  },
  
  ipAddress: "...",
  userAgent: "..."
}
```

### Drizzle Schema (Complementary to Firestore)

```typescript
// server/db/schema.ts (ADD to existing)

export const investorDocuments = pgTable('investor_documents', {
  id: text().primaryKey(), // doc_safe_2026_v1
  investorId: text().notNull(), // inv_jane_001
  documentType: text().notNull(), // safe | side_letter | etc
  title: text().notNull(),
  status: text().notNull(), // draft | proposed | signed
  currentVersion: integer().notNull().default(1),
  controlledBy: text().notNull(), // boostify | investor
  boostifySignedAt: timestamp(),
  investorSignedAt: timestamp(),
  cloReviewedAt: timestamp(),
  cloRiskScore: numeric({ precision: 3, scale: 2 }), // 0.00 - 1.00
  createdAt: timestamp().defaultNow(),
  updatedAt: timestamp().defaultNow(),
});

export const investorProposals = pgTable('investor_proposals', {
  id: text().primaryKey(),
  parentDocId: text().notNull(),
  investorId: text().notNull(),
  proposedBy: text().notNull(), // email
  proposedByAgent: text(), // juno_clo | null
  proposalType: text().notNull(),
  clauseId: text(),
  originalText: text(),
  proposedText: text(),
  status: text().notNull(),
  cloVerdictAt: timestamp(),
  cloVerdict: text(), // approved | rejected | counter
  investorResponseAt: timestamp(),
  investorVerdict: text(),
  createdAt: timestamp().defaultNow(),
  updatedAt: timestamp().defaultNow(),
});

export const investorNegotiations = pgTable('investor_negotiations', {
  id: text().primaryKey(),
  investorId: text().notNull(),
  roundId: text().notNull(),
  status: text().notNull(),
  stage: text().notNull(),
  investmentAmount: integer(),
  postMoneyCapTarget: integer(),
  startedAt: timestamp().defaultNow(),
  lastActivityAt: timestamp(),
  targetCloseDate: timestamp(),
  createdAt: timestamp().defaultNow(),
  updatedAt: timestamp().defaultNow(),
});

export const cloDecisions = pgTable('clo_decisions', {
  id: text().primaryKey(),
  agentId: text().notNull(), // juno_clo
  relatedProposalId: text(),
  relatedNegotiationId: text(),
  action: text().notNull(),
  riskScore: numeric({ precision: 3, scale: 2 }),
  verdict: text(),
  escalationNeeded: boolean().default(false),
  executionStatus: text(),
  createdAt: timestamp().defaultNow(),
  executedAt: timestamp(),
});
```

---

## 🔄 FLUJOS DE USUARIOS

### Flujo 1: Investor Views & Proposes Edit

```
1. Investor enters /investors-dashboard
2. New button: "📄 Review & Sign Investment Docs"
3. Clicks → goes to /investor-documents
4. Sees list:
   ☐ 1. NDA — SIGNED (2026-06-16)
   ☐ 2. SAFE — UNDER NEGOTIATION (v3)
   ☐ 3. Side Letter — DRAFT
   ☐ 4. Subscription Agreement — READY
   ☐ 5. Accredited Investor Questionnaire — FILLED
5. Clicks "SAFE" → opens Document Viewer
   • Shows full text with version info
   • Highlights in yellow: "Post-Money Valuation Cap: US$42,857,143"
   • Investor thinks: "I want to negotiate this"
6. Investor clicks [Edit] button on that clause
7. Form appears:
   - Original: "US$42,857,143"
   - Proposed: [text input]
   - Rationale: [textarea] "We'd like a lower cap to attract LPs"
   - [Submit Proposal]
8. Backend: createInvestorProposal() → stores in Firestore
9. EventBus: emits INVESTOR_PROPOSAL_SUBMITTED
10. CLO Agent (Juno) triggered
```

### Flujo 2: CLO Agent Reviews & Responds

```
1. EventBus triggers CLO to review investor proposal
2. Juno (CLO Agent) is invoked with:
   {
     proposalId: "prop_safe_...",
     proposal: {
       original: "US$42,857,143",
       proposed: "US$40,000,000",
       rationale: "..."
     },
     context: {
       currentCapTablePolicy: { minCap: 41500000, maxCap: 50000000 },
       seriesAPlan: { assumedPostMoney: 150000000 },
       investorProfile: { minimumCheck: 25000, type: "micro_vc" },
       boardVote: { capApprovalRange: [40000000, 45000000] }
     }
   }
3. Juno analyzes (via Claude/GPT call):
   "Investor proposes $40M. Our policy says $41.5M minimum.
    If we accept $40M, we dilute founders by 0.25%.
    But investor is only putting $1.5M, so total round is still $1.5M.
    Counter-proposal: $41.5M is my maximum compliance."
4. Juno calls API: updateProposalWithCLOReview({
     verdict: "counter_proposal",
     counterProposal: {
       proposedText: "US$41,500,000",
       reasoning: "Board policy allows range $41.5M–$50M. We propose $41.5M as compromise."
     }
   })
5. Investor notified (email + in-app notification)
6. Juno logs decision in clo_decisions table
```

### Flujo 3: Investor Accepts CLO Counter & Signs

```
1. Investor sees notification: "CLO counter-proposal received"
2. Goes to document, sees SAFE v2 (CLO's updated version)
3. New proposed cap: $41.5M
4. Investor thinks: "Fair compromise" → clicks [Accept]
5. System: Marks proposal as investor_approved
6. EventBus: INVESTOR_ACCEPTED_CLO_PROPOSAL
7. Document status changes: "under_negotiation" → "ready_to_sign"
8. Both parties can now e-sign:
   - Investor: PenSquare icon + "Sign as Jane Q. Investor"
   - Boostify: PenSquare icon + "Sign as Neiver (CEO)"
9. Both sign → document status: "signed"
10. Audit log: who signed, when, with what signature
11. Celebration! 🎉
```

### Flujo 4: CEO/CLO Dashboard View

```
1. Neiver (CEO) logs in → Dashboard
2. New widget: "Active Negotiations" (Real-time)
   ┌─────────────────────────────────────────┐
   │ Seed Round 2026 — Live Negotiations      │
   │                                         │
   │ 💰 Jane Q. Investor (Acme Ventures)     │
   │    Amount: $1.5M                        │
   │    Status: UNDER NEGOTIATION            │
   │    Last Activity: CLO counter-proposed │
   │    Cap: $42.9M → $41.5M (investor ok?) │
   │    Risk Score: 🟡 0.15                  │
   │    [View Full Thread] [Quick Response]  │
   │                                         │
   │ 💬 Mike Investor (XYZ Fund)             │
   │    Amount: $500K                        │
   │    Status: SIGNED NDA                   │
   │    Activity: Awaiting diligence response│
   │    [View Documents]                     │
   └─────────────────────────────────────────┘
3. Clicks "View Full Thread" → sees all proposals/counter-proposals
4. Can see Juno's reasoning: "Risk score 0.15 because we're within policy but
   close to Series A insurance threshold"
5. Can override Juno if needed (CEO has autonomy=3)
```

---

## 🤖 INTEGRACIÓN DEL CLO AGENT (JUNO) — NOW JUNO 2.0! 🚀

### ⭐ JUNO 2.0: Advanced Legal Analysis Engine

**NEW:** Juno ha sido mejorado a versión 2.0 con capacidades legales profesionales avanzadas.

📖 **For detailed specification:** See [JUNO_LEGAL_ANALYSIS_SYSTEM.md](./JUNO_LEGAL_ANALYSIS_SYSTEM.md)  
📚 **For real-world examples:** See [JUNO_LEGAL_ANALYSIS_EXAMPLES.md](./JUNO_LEGAL_ANALYSIS_EXAMPLES.md)

### What is the CLO Agent (Juno)

Del documento C_SUITE_AI_SYSTEM_GUIDE:
- **Rol:** Chief Legal Officer
- **ID:** `clo`
- **Nombre:** Juno
- **Autonomy:** 1 (HITL — siempre propone, humanos aprueban acciones sensibles)
- **Tareas (Juno 1.0):** Royalties, copyright, contratos, compliance, riesgos
- **Tareas NUEVAS (Juno 2.0):** Investor document negotiation, legal analysis, precedent research

### Juno 2.0: Advanced Capabilities

```
THE 5-LAYER LEGAL REASONING STACK (Juno 2.0):

Layer 1: POLICY COMPLIANCE
  ✓ Checks board decisions + cap ranges
  ✓ Ensures founder protection thresholds met
  ✓ Flags violations immediately

Layer 2: PRECEDENT & MARKET DATA
  ✓ Cites 15+ comparable deals
  ✓ Analyzes investor track record
  ✓ Provides market positioning (15th percentile vs peers)

Layer 3: LEGAL RISK ASSESSMENT
  ✓ 0-1 risk scoring (numerical confidence)
  ✓ Identifies clause conflicts
  ✓ Models Series A impact
  ✓ Regulatory compliance check

Layer 4: STRATEGY & NEGOTIATION
  ✓ Assesses investor strategic value
  ✓ Predicts acceptance probability
  ✓ Determines negotiation approach
  ✓ Proposes smart counter-offers

Layer 5: HUMAN JUDGMENT
  ✓ CEO can override any decision
  ✓ Full reasoning transparency
  ✓ Escalation for edge cases

RESULT: 2-3 paragraph detailed reasoning (not black box)
```

### Juno 2.0: Key Improvements Over 1.0

| Feature | Juno 1.0 | Juno 2.0 |
|---------|----------|---------|
| **Policy checking** | ✓ Basic | ✓ Advanced + exceptions |
| **Risk scoring** | Hardcoded (3 levels) | 0-1 numerical scale |
| **Reasoning** | "Policy violation" | 2-3 paragraph detailed analysis |
| **Precedent** | None | 15+ comparable deals cited |
| **Market context** | None | Percentile positioning + comps |
| **Investor profiling** | Basic | Full track record analysis |
| **Learning** | No | Learns from closed deals |
| **Transparency** | Basic | Full audit trail + reasoning |

### Juno 2.0 In Action

**Example: Investor proposes cap change from $42.9M to $40M**

Juno 1.0 response:
```
"Violates policy (min $41.5M). Counter at $41.5M"
```

Juno 2.0 response:
```
"Your proposal violates our board-approved cap range ($41.5M–$50M) 
by $1.5M. However, we recognize that market comps for similar 
micro-VCs average $41.8M (you're at 15th percentile). We propose 
$41.5M as our compromise—this meets our policy, aligns with your 
peer group, and shows good faith.

We reviewed your fund's track record: similar deals you've invested 
in closed at $40-42M. This puts us well within your typical range. 
Risk to our Series A assumptions is LOW (0.15/1.0).

If $41.5M doesn't work, we have alternatives: (a) increase your 
check to $3M+ (we could reconsider), or (b) add follow-on commitment 
to Series A.

Let's discuss Friday?"
```

**See the difference?** 2.0 is a real lawyer, not a policy checker.

📖 **Full 5-layer reasoning explained:** [JUNO_LEGAL_ANALYSIS_SYSTEM.md](./JUNO_LEGAL_ANALYSIS_SYSTEM.md)  
📚 **6 real-world case studies:** [JUNO_LEGAL_ANALYSIS_EXAMPLES.md](./JUNO_LEGAL_ANALYSIS_EXAMPLES.md)

---

### Juno 2.0: Technical Architecture

```typescript
You are Juno, Boostify's Chief Legal Officer.

Your core roles:
1. Royalties & copyright management
2. Contracts & legal documents
3. Compliance & risk management

NEW: Investor Document Negotiation & Advanced Legal Review

Your new responsibilities:
1. Multi-layer legal analysis (5-layer reasoning stack)
2. Review investor proposals using legal reasoning, not just rules
3. Analyze against:
   - Boostify's legal policy (e.g., min cap $41.5M)
   - Board resolutions (e.g., approved cap range)
   - Series A assumptions (e.g., post-money expectations)
   - Investor profile + track record
   - Market precedent (15+ comparable deals)
   - Legal risk assessment (0-1 numerical score)
4. Provide detailed reasoning (2-3 paragraphs, not single sentence)
5. Cite precedent (investor vs peers)
6. Model financial impact (dilution %, Series A effect)
7. Flag edge cases for human approval
8. Self-improve: learn from closed deals

Tools available:
- getCapTablePolicy() → returns min/max cap ranges
- getBoardResolution(id) → returns approved terms
- getSeriesAPlan() → returns Series A assumptions
- getInvestorProfile(investorId) → score, history, checks, precedent
- getPrecedentDatabase() → 50+ historical deals
- getMarketComps() → comparable deal analysis
- riskScorer() → calculate 0-1 risk numerically
- proposalCounterOffer() → creates smart counters
- escalateToHuman() → flags for CEO review
- recordPrecedent() → learns from deal

Decision Framework (Juno 2.0):
IF investor_proposal_analysis.risk_score < 0.3:
  THEN auto_propose_counter() + detailed_reasoning + notify_investor
ELSE if 0.3 < risk_score < 0.7:
  THEN escalate_to_ceo() + provide_reasoning + alternatives
ELSE (risk_score > 0.7):
  THEN escalate_critical() + flag_for_human + recommend_action
`;
```

### Integration Points

**1. EventBus Listener (Juno listens for investor activity):**

```typescript
// server/agents/clo-agent.ts (UPDATED with Juno 2.0 logic)

import { emitAgentEvent, AgentEventType } from './events';
import { agentEventBus } from './events';

export async function initializeCLOAgent() {
  agentEventBus.on('INVESTOR_PROPOSAL_SUBMITTED', async (event) => {
    logger.info(`[CLO] Investor proposal received: ${event.proposalId}`);
    await reviewInvestorProposalWithLegalAnalysis(event.proposalId); // JUNO 2.0
  });

  agentEventBus.on('INVESTOR_NEGOTIATION_STARTED', async (event) => {
    logger.info(`[CLO] New negotiation: ${event.negotiationId}`);
    await performInitialLegalReview(event.negotiationId);
  });
}

export async function reviewInvestorProposal(proposalId: string) {
  const proposal = await getProposal(proposalId);
  const negotiation = await getNegotiation(proposal.parentNegotiationId);
  
  // Fetch policy
  const policy = await getCapTablePolicy();
  
  // Analyze
  const analysis = await analyzeProposal(proposal, policy, negotiation);
  
  // Decide
  if (analysis.violatesPolicy && analysis.riskLevel === 'low') {
    // Auto-counter
    const counter = await generateCounterProposal(proposal, analysis);
    await storeCLODecision({
      proposalId,
      verdict: 'counter_proposal',
      counter,
      reasoning: analysis.reasoning
    });
    await notifyInvestor(proposal.investorId, counter);
  } else if (analysis.riskLevel === 'high') {
    // Escalate
    await escalateToExecutive(proposal, analysis);
  } else {
    // Approve
    await approvePro proposal);
  }
}
```

**2. API Endpoint (Boostify team can override CLO):**

```typescript
// server/routes/investor-docs.ts (NEW ROUTE)

app.post('/api/investor-docs/proposals/:proposalId/clo-decision', async (req, res) => {
  const { override, newVerdict, reasoning } = req.body;
  
  if (override) {
    // CEO/CFO can override CLO
    if (!isAuthorized(req.user, 'override_clo')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    await storeCLODecision({
      proposalId: req.params.proposalId,
      override: true,
      overrideBy: req.user.id,
      verdict: newVerdict,
      reasoning
    });
  }
  
  res.json({ success: true });
});
```

**3. Notification System:**

```typescript
// When CLO makes a decision, both parties are notified

await sendNotification({
  to: investor.email,
  type: 'clo_counter_proposal',
  subject: 'Legal Review: Counter-Proposal from Boostify',
  body: `Our CLO (Juno) has reviewed your proposal and suggests: ${counter.proposedText}. Reasoning: ${counter.reasoning}`,
  actionUrl: `/investor-documents?proposalId=${proposalId}`,
  priority: 'high'
});

await sendNotification({
  to: 'neiver@boostify.com',
  type: 'clo_decision_made',
  subject: `[CLO] Counter-Proposal: ${proposal.clauseId}`,
  body: `Juno has reviewed investor's proposal and countered. Risk: ${analysis.riskLevel}`,
  actionUrl: `/executive/negotiations/${negotiationId}`,
  priority: 'medium'
});
```

---

## 🚀 PLAN DE IMPLEMENTACIÓN

### FASE 1: Backend + Data Model (1-2 días)

- [x] Define Firestore collections (investor_documents, proposals, negotiations, clo_decisions)
- [x] Define Drizzle schema (complementary DB tables)
- [ ] Create API routes:
  - `GET /api/investor-docs/:investorId` → list docs
  - `GET /api/investor-docs/:docId` → full document
  - `POST /api/investor-docs/:docId/proposals` → submit edit
  - `GET /api/investor-docs/:docId/proposals` → list proposals
  - `GET /api/investor-docs/:docId/versions` → version history
  - `POST /api/investor-docs/:docId/sign` → e-signature
- [ ] Create CLO agent routes:
  - `POST /api/clo/review-proposal` → trigger review (admin)
  - `GET /api/clo/decisions/:negotiationId` → see all CLO decisions
- [ ] Migration: Add new tables to PostgreSQL

### FASE 2: Frontend — Document Viewer (1 día)

- [ ] New page: `/investor-documents` (protected by gate + NDA)
- [ ] Components:
  - `DocumentList.tsx` — table of docs with status badges
  - `DocumentViewer.tsx` — render markdown/PDF with highlight + edit buttons
  - `ProposalForm.tsx` — form to suggest edits
  - `ProposalTimeline.tsx` — chat-like view of all proposals/counter-proposals
  - `ESignatureFlow.tsx` — final signature step
- [ ] Styles: Match investor dashboard theme (orange/gray)

### FASE 3: CLO Agent Integration (1 día)

- [ ] Create `server/agents/clo-agent.ts`
- [ ] Wire into EventBus (listen for INVESTOR_PROPOSAL_SUBMITTED)
- [ ] Implement `analyzeProposal()` with policy checking
- [ ] Implement `generateCounterProposal()` with Claude/GPT
- [ ] Set up notifications (email + in-app)
- [ ] Create audit trail in clo_decisions table

### FASE 4: Executive Dashboard (1 día)

- [ ] New widget in admin dashboard: "Active Negotiations"
- [ ] Real-time list of negotiations with status, risk, proposals
- [ ] Drill-down view to see full proposal thread
- [ ] Override capability (CEO can manually accept/reject CLO decisions)
- [ ] Analytics: deal velocity, common sticking points, CLO decision accuracy

### FASE 5: Investor Button + Nav (few hours)

- [ ] Add button in `/investors-dashboard`:
  ```tsx
  <Button onClick={() => navigate('/investor-documents')}>
    <FileText className="h-4 w-4 mr-2" />
    📄 Review & Sign Investment Docs
  </Button>
  ```
- [ ] Add to investor portal nav
- [ ] Add to bottom nav (mobile)

### FASE 6: Testing + Refinement (1 día)

- [ ] Test full flow: investor proposes → CLO counter → investor accepts → both sign
- [ ] Test edge cases: high-risk escalations, CEO overrides
- [ ] Performance: real-time notifications, audit logs
- [ ] Security: ensure investor only sees their docs, CLO has right permissions

---

## 💬 EJEMPLOS DE USO

### Ejemplo 1: Valuation Cap Negotiation

**Scenario:** Jane wants to lower the cap from $42.9M to $40M

```
TIME 10:00 AM
Jane: Proposes "Post-Money Cap: $40M" with rationale "align with market multiples"

API Call:
POST /api/investor-docs/doc_safe_v1/proposals
{
  "originalText": "$42,857,143",
  "proposedText": "$40,000,000",
  "clauseId": "post_money_cap",
  "rationale": "Our LPs want to see $40M cap for micros. Market standard for this stage."
}

TIME 10:02 AM
EventBus emits: INVESTOR_PROPOSAL_SUBMITTED
CLO Agent (Juno) is triggered

Juno's analysis:
- Policy check: Min cap = $41.5M (board policy) ✗ violates
- Risk: Medium (violates policy but negotiable)
- Decision: Counter-propose $41.5M

Juno's reasoning:
  "Investor requests $40M. Our Board policy sets minimum at $41.5M to protect
  Series A assumptions (Series A assumes post-money ≥ $150M baseline).
  At $40M seed, Series A would dilute founders more. 
  HOWEVER: $41.5M is within acceptable range. Counter at this level,
  showing good-faith compromise."

TIME 10:03 AM
CLO Decision stored:
{
  verdict: "counter_proposal",
  proposedCap: "$41.5M",
  riskScore: 0.15,
  reasoning: "...",
  autoGenerated: true
}

EMAIL to jane@fund.com:
Subject: Legal Review: Counter-Proposal from Boostify
From: Boostify Legal (juno@boostify.ai)
Body:
  Hi Jane,
  
  We reviewed your proposal to adjust the post-money valuation cap.
  Our Chief Legal Officer (Juno) suggests a compromise:
  
  Your proposal: $40,000,000
  Our counter:   $41,500,000
  
  Reasoning: Our board-approved cap range is $41.5M–$50M. We'd like to meet you
  at $41.5M — this respects our Series A planning while showing good faith.
  
  Does this work for you? Reply in the document portal or email us.
  
  Best,
  Boostify Legal

TIME 10:30 AM
Jane thinks: "OK, $41.5M is close enough" → clicks [Accept] in portal

API Call:
POST /api/investor-docs/proposals/prop_safe_001/investor-response
{
  "verdict": "approved"
}

TIME 10:31 AM
Document auto-updates: SAFE v2 now shows "$41,500,000"
Status: "ready_to_sign"
Notifications sent to both parties

TIME 11:00 AM
Jane signs document: PenSquare + "Jane Q. Investor"
Neiver (CEO) signs: PenSquare + "Neiver Alvarez (CEO/Founder)"

SAFE is now SIGNED ✅

AUDIT LOG:
  10:00 AM | jane@fund.com | proposed_change | $42.9M → $40M
  10:02 AM | juno_clo | reviewed_proposal | counter: $41.5M
  10:30 AM | jane@fund.com | accepted_proposal | counter-offer accepted
  11:00 AM | jane@fund.com | signed_document | SAFE v2 signed
  11:01 AM | neiver@boostify.com | signed_document | SAFE v2 signed
```

### Ejemplo 2: Escalation (High-Risk Proposal)

**Scenario:** Investor wants to remove MFN clause (Most Favored Nation)

```
TIME 14:00 PM
Investor: Proposes "Remove MFN clause from Side Letter"

Juno analyzes:
- Policy: MFN is standard for $100K+ checks ✗ critical
- Risk: HIGH (removes investor protection, bad precedent)
- Decision: Escalate to CEO

Juno escalates:
{
  verdict: "escalation_required",
  riskLevel: "HIGH",
  reasoning: "MFN removal violates investor protection policy + sets bad precedent",
  escalatedTo: "ceo",
  flaggedAt: timestamp,
  humanApprovalRequired: true
}

EMAIL to neiver@boostify.com:
Subject: 🚨 [ESCALATION] High-Risk Proposal: MFN Clause Removal
From: juno@boostify.ai
Body:
  Juno's Alert:
  Investor Jane Q. has proposed removing the MFN clause from Side Letter.
  Risk Level: HIGH
  
  Reasoning: MFN protection is standard for investments ≥ $100K. Removing
  creates precedent for other investors to demand similar. Breaks negotiation
  consistency.
  
  Recommendation: Reject or negotiate removal only if investor increases
  check size significantly (e.g., $200K+).
  
  [View Proposal Details] [Approve] [Reject] [Send Counter-Offer]

TIME 14:15 PM
Neiver reviews → decides to counter: "Keep MFN but add carve-out for future
micro rounds"

API Call:
POST /api/investor-docs/proposals/.../clo-decision
{
  override: true,
  verdict: "counter_proposal",
  counterProposal: {
    text: "MFN clause applies except to future rounds <$50K",
    reasoning: "Keeps your protection while acknowledging we may do quick micro-raisings"
  }
}

Juno's AI learns: "CEO overrode my HIGH-RISK decision. MFN can have exceptions.
Update my decision-making for future MFN negotiations."
```

---

## 📊 MÉTRICAS & KPIs

Boostify Leadership will track:

- **Deal Velocity:** Days from NDA to signed SAFE (target: < 30 days)
- **Negotiation Rounds:** Avg proposals per deal (target: < 5)
- **CLO Accuracy:** % of CLO decisions later approved by CEO (target: > 90%)
- **Investor Satisfaction:** Feedback on negotiation smoothness (survey)
- **Legal Risk:** Escalations caught by CLO (should be 0 missed)
- **Efficiency Gain:** Time saved vs manual legal review (target: 80% faster)

---

## 🔒 SECURITY & COMPLIANCE

- **Document Access:** Only investor + Boostify team can view
- **E-Signature:** DocuSign or local crypto signature (no screenshot signing)
- **Audit Trail:** Every action logged with actor, timestamp, IP, change details
- **Encryption:** All documents encrypted at rest (Firestore + DB)
- **Legal Compliance:** Reg D Form D filing on close (automated)
- **Data Retention:** 7 years (SEC compliance)

---

## 🎯 SUCCESS CRITERIA

✅ Investors can navigate /investor-documents without friction  
✅ CLO agent auto-reviews proposals within 5 minutes  
✅ Average deal closes in < 30 days (vs current 60+ days)  
✅ Zero missed legal risks (CLO catches 100% of violations)  
✅ CEO happy with 90%+ CLO decision accuracy  
✅ Scale to 10+ simultaneous negotiations without slowdown  
✅ Investors praise "frictionless" negotiation experience  

---

## 📞 NEXT STEPS

1. **Approval:** Does Neiver approve this plan?
2. **Start Phase 1:** Backend + DB model (I can do this today)
3. **Wire Juno:** Connect CLO agent to EventBus
4. **Frontend Sprint:** Investor documents page
5. **Testing:** Full flow with test investor
6. **Launch:** Go live with first real investor negotiation

---

**Owner:** Neiver Alvarez-AI + Juno (CLO)  
**Last Updated:** 2026-06-16  
**Status:** APPROVED (pending Neiver sign-off)
