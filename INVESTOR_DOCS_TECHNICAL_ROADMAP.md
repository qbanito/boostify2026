# 📋 INVESTOR DOCS SYSTEM — TECHNICAL IMPLEMENTATION ROADMAP

**Status:** READY TO BUILD  
**Estimated Time:** 5–6 days  
**Start Date:** Today (2026-06-16)  
**Target Launch:** 2026-06-22

---

## 📁 FILES TO CREATE

### Backend

#### 1. **server/agents/clo-agent.ts** (NEW)
```typescript
/**
 * Juno — CLO Agent for Investor Document Negotiation
 * 
 * Responsibilities:
 * - Listen to investor proposals via EventBus
 * - Analyze against company policy + board decisions
 * - Auto-approve, counter-propose, or escalate
 * - Provide reasoning for every decision
 * - Learn from closed deals (precedent)
 */

export async function initializeCLOAgent() {
  // Wire into EventBus
}

export async function reviewInvestorProposal(proposalId: string) {
  // Main decision logic
}

export async function generateCounterProposal(proposal, analysis) {
  // Uses Claude API to draft counter-offer
}

export async function escalateToExecutive(proposal, analysis) {
  // Flag for CEO approval
}

export async function recordDecision(decision) {
  // Store in clo_decisions table for audit
}

export async function recordPrecedent(deal) {
  // Learn from closed deal for future decisions
}
```

#### 2. **server/routes/investor-docs.ts** (NEW)
```typescript
/**
 * Investor Documents API Routes
 * 
 * GET  /api/investor-docs/:investorId              — list docs
 * GET  /api/investor-docs/:docId                   — view doc
 * POST /api/investor-docs/:docId/proposals         — propose edit
 * GET  /api/investor-docs/:docId/proposals         — list proposals
 * GET  /api/investor-docs/:docId/versions          — version history
 * POST /api/investor-docs/:docId/sign              — e-signature
 * GET  /api/investor-docs/:docId/audit-trail       — audit log
 * 
 * POST /api/investor-docs/:proposalId/investor-response — accept/reject/counter
 */

export async function getInvestorDocuments(investorId: string) {
  // Query investor_documents from Firestore
}

export async function submitInvestorProposal(docId: string, proposal) {
  // Store in investor_proposals
  // Emit EventBus event
  // Trigger CLO agent
}

export async function getProposalTimeline(docId: string) {
  // Return all proposals + responses in order
}

export async function submitInvestorSignature(docId: string, signature) {
  // Store signature
  // Update document status
  // Send notifications
}
```

#### 3. **server/routes/clo-admin.ts** (NEW)
```typescript
/**
 * CLO Admin Routes (for Boostify team)
 * 
 * GET  /api/admin/clo/decisions/:negotiationId       — see CLO decisions
 * POST /api/admin/clo/decisions/:proposalId/override — override CLO
 * GET  /api/admin/negotiations                        — all negotiations
 * GET  /api/admin/clo/analytics                       — decision accuracy, etc.
 */

export async function getCLODecisions(negotiationId: string) {
  // Return all CLO decisions for negotiation
}

export async function overrideCLODecision(proposalId: string, override) {
  // CEO/CFO override Juno's decision
  // Log with reason
}

export async function getActiveNegotiations() {
  // Dashboard widget data
}
```

#### 4. **server/db/schema.ts** (MODIFICATIONS)
```typescript
// Add to existing Drizzle schema:

export const investorDocuments = pgTable('investor_documents', {
  id: text().primaryKey(),
  investorId: text().notNull(),
  documentType: text().notNull(),
  title: text().notNull(),
  status: text().notNull(),
  currentVersion: integer().notNull().default(1),
  controlledBy: text().notNull(),
  boostifySignedAt: timestamp(),
  investorSignedAt: timestamp(),
  cloReviewedAt: timestamp(),
  cloRiskScore: numeric({ precision: 3, scale: 2 }),
  createdAt: timestamp().defaultNow(),
  updatedAt: timestamp().defaultNow(),
});

export const investorProposals = pgTable('investor_proposals', {
  id: text().primaryKey(),
  parentDocId: text().notNull(),
  investorId: text().notNull(),
  proposedBy: text().notNull(),
  proposedByAgent: text(),
  proposalType: text().notNull(),
  clauseId: text(),
  originalText: text(),
  proposedText: text(),
  rationale: text(),
  status: text().notNull(),
  cloVerdictAt: timestamp(),
  cloVerdict: text(),
  cloReasoning: text(),
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
});

export const cloDecisions = pgTable('clo_decisions', {
  id: text().primaryKey(),
  agentId: text().notNull(), // juno_clo
  relatedProposalId: text(),
  relatedNegotiationId: text(),
  action: text().notNull(),
  riskScore: numeric({ precision: 3, scale: 2 }),
  verdict: text(),
  reasoning: text(),
  escalationNeeded: boolean().default(false),
  executionStatus: text(),
  createdAt: timestamp().defaultNow(),
  executedAt: timestamp(),
});

export const investorAuditLog = pgTable('investor_audit_log', {
  id: text().primaryKey(),
  timestamp: timestamp().defaultNow(),
  actor: text().notNull(),
  actorType: text().notNull(),
  action: text().notNull(),
  resourceId: text(),
  resourceType: text(),
  details: jsonb(),
  ipAddress: text(),
  userAgent: text(),
});
```

#### 5. **server/agents/events.ts** (MODIFICATIONS)
```typescript
// Add new event types:

export enum AgentEventType {
  // ... existing events ...
  
  // New for investor docs
  INVESTOR_PROPOSAL_SUBMITTED = 'investor:proposal:submitted',
  INVESTOR_NEGOTIATION_STARTED = 'investor:negotiation:started',
  CLO_REVIEW_TRIGGERED = 'investor:clo:review_triggered',
  CLO_DECISION_MADE = 'investor:clo:decision_made',
  INVESTOR_RESPONSE_RECEIVED = 'investor:proposal:response',
  DOCUMENT_SIGNED = 'investor:document:signed',
}
```

### Frontend

#### 1. **client/src/pages/investor-documents.tsx** (NEW)
```typescript
/**
 * Main Investor Documents Page
 * 
 * - Protected: Requires NDA signed + session storage token
 * - Shows document list with status badges
 * - Allows clicking to open document viewer
 * - Shows negotiation timeline
 */

export default function InvestorDocumentsPage() {
  // Component tree:
  // InvestorDocumentsPage
  //   ├─ DocumentListPanel
  //   ├─ DocumentViewerPanel
  //   ├─ ProposalTimelinePanel
  //   └─ ESignatureFlow
}
```

#### 2. **client/src/components/investor/document-list.tsx** (NEW)
```typescript
/**
 * Table of all investor documents
 * 
 * Columns:
 * - Document Type (SAFE, Side Letter, etc.)
 * - Version
 * - Status (Signed, Under Negotiation, Ready, Draft)
 * - Last Updated
 * - Actions (View, Edit, Sign)
 */

export function DocumentList() {}
```

#### 3. **client/src/components/investor/document-viewer.tsx** (NEW)
```typescript
/**
 * Full-screen document renderer
 * 
 * Features:
 * - Render markdown/HTML
 * - Highlight clauses
 * - [EDIT] button on each clause
 * - Diff view (show what changed)
 * - Rationale panel (why is this clause here?)
 * - Print to PDF
 */

export function DocumentViewer() {}
```

#### 4. **client/src/components/investor/proposal-form.tsx** (NEW)
```typescript
/**
 * Form for investor to propose edits
 * 
 * Fields:
 * - Original text (read-only, highlighted)
 * - Proposed text (textarea)
 * - Rationale (textarea)
 * - [SUBMIT PROPOSAL]
 * 
 * Shows: "Your proposal will be reviewed by Boostify's CLO (Juno)"
 */

export function ProposalForm() {}
```

#### 5. **client/src/components/investor/proposal-timeline.tsx** (NEW)
```typescript
/**
 * Chat-like timeline of all proposals + responses
 * 
 * Shows:
 * - Investor proposals (left-aligned, blue)
 * - CLO responses (right-aligned, orange)
 * - Investor responses to CLO (left-aligned, blue)
 * - Status badges (pending, approved, rejected, countered)
 * - Timestamps
 * - Risk scores (when CLO responds)
 */

export function ProposalTimeline() {}
```

#### 6. **client/src/components/investor/e-signature-flow.tsx** (NEW)
```typescript
/**
 * E-Signature workflow
 * 
 * Steps:
 * 1. "Ready to sign?" (both parties)
 * 2. Investor signature (name + confirm)
 * 3. Boostify signature (CEO name + confirm)
 * 4. Document signed ✅
 * 5. Download PDF + email confirmation
 */

export function ESignatureFlow() {}
```

#### 7. **client/src/components/admin/negotiations-dashboard.tsx** (NEW)
```typescript
/**
 * Executive dashboard widget for CEO/CFO/CLO
 * 
 * Shows:
 * - List of active negotiations
 * - CLO decisions (with risk scores)
 * - Last activity
 * - Quick actions (override, send message)
 */

export function NegotiationsDashboard() {}
```

#### 8. **client/src/pages/investors-dashboard.tsx** (MODIFICATION)
```typescript
// Add button to existing page:

<Button 
  onClick={() => navigate('/investor-documents')}
  className="..." 
>
  <FileText className="h-4 w-4 mr-2" />
  📄 Review & Sign Investment Documents
</Button>
```

---

## 🔌 MODIFICATIONS TO EXISTING FILES

### 1. **server/index.ts** (Mount new routes)
```typescript
// After other investor routes:

import investorDocsRouter from './routes/investor-docs';
import cloAdminRouter from './routes/clo-admin';

app.use('/api/investor-docs', investorDocsRouter);
app.use('/api/admin/clo', cloAdminRouter);
```

### 2. **server/agents/index.ts** (Export CLO module)
```typescript
export { 
  initializeCLOAgent,
  reviewInvestorProposal,
  generateCounterProposal,
  escalateToExecutive,
  recordDecision,
  recordPrecedent
} from './clo-agent';
```

### 3. **server/agents/events.ts** (Add event types — see above)

### 4. **server/services/c-suite/agents.ts** (Update CLO persona)
```typescript
// Extend Juno's persona with investor doc responsibilities

const CLO_PERSONA = `
You are Juno, Boostify's Chief Legal Officer.

EXISTING responsibilities:
- Royalties & copyright management
- Contracts & compliance

NEW responsibilities for Investor Document Negotiation:
- Review investor proposals to change SAFE/Side Letter/etc.
- Analyze against board policy + Series A assumptions
- Auto-propose counter-offers when policy is violated
- Provide reasoning for every decision
- Escalate high-risk proposals to CEO

...rest of persona...
`;
```

### 5. **client/src/components/layout/header.tsx** or **client/src/components/layout/bottom-nav.tsx** (Add link to investor docs)
```typescript
// Add to nav:
{
  label: "Investment Docs",
  href: "/investor-documents",
  icon: FileText,
  requiresAuth: true,
  requiresGate: true  // Only show if NDA signed
}
```

### 6. **client/src/App.tsx** (Add route)
```typescript
const InvestorDocuments = lazy(() => 
  import("./pages/investor-documents")
);

// In routes section:
{getRouteComponent("/investor-documents", WrappedInvestorDocuments, "investor")}
```

### 7. **Firestore Security Rules** (Add)
```javascript
// firestore.rules

match /investor_documents/{docId} {
  allow read: if 
    request.auth.uid == resource.data.investorId ||
    isBoostifyTeam(request.auth.uid);
  allow write: if isBoostifyTeam(request.auth.uid);
}

match /investor_proposals/{proposalId} {
  allow read: if 
    request.auth.uid == resource.data.investorId ||
    isBoostifyTeam(request.auth.uid);
  allow write: if request.auth.uid == resource.data.investorId;
}

match /clo_decisions/{decisionId} {
  allow read: if isBoostifyTeam(request.auth.uid);
  allow write: if isBoostifyTeam(request.auth.uid);
}
```

---

## 🧪 TESTING CHECKLIST

### Backend Tests
- [ ] Firestore collections can be created/updated
- [ ] Drizzle migrations run successfully
- [ ] API endpoints return correct data
- [ ] CLO agent reviews proposals in < 5 seconds
- [ ] EventBus fires correctly
- [ ] Notifications are sent
- [ ] Audit logs are complete

### Frontend Tests
- [ ] `/investor-documents` page loads
- [ ] Document list shows all docs with correct statuses
- [ ] Document viewer renders markdown
- [ ] Clicking [EDIT] opens proposal form
- [ ] Submitting proposal triggers backend
- [ ] Timeline shows all proposals + responses
- [ ] E-signature flow works (both parties sign)
- [ ] Downloaded PDF includes all signatures
- [ ] Mobile responsive (viewport < 600px)

### Integration Tests
- [ ] End-to-end: investor proposes → CLO counters → investor accepts → both sign
- [ ] CLO escalation flow (high-risk proposal)
- [ ] CEO override flow
- [ ] Multiple simultaneous negotiations
- [ ] Audit trail complete for all actions

### Security Tests
- [ ] Investor can only see their own docs
- [ ] Boostify team can see all docs
- [ ] CLO agent has correct permissions
- [ ] E-signatures are non-repudiable
- [ ] No injection attacks in proposal text
- [ ] Firestore rules enforced

---

## 📊 DATA SEEDING (For Testing)

Create test data in Firestore:

```javascript
// Test investor
{
  id: "inv_test_jane",
  name: "Jane Q. Investor",
  email: "jane@test.fund",
  company: "Test Ventures",
  nda_signed: true,
  nda_signed_at: "2026-06-16T10:00:00Z"
}

// Test documents
{
  id: "doc_safe_test_v1",
  investorId: "inv_test_jane",
  documentType: "safe",
  status: "under_negotiation",
  currentVersion: 2,
  content: { /* full SAFE markdown */ }
}

// Test proposal
{
  id: "prop_test_001",
  parentDocId: "doc_safe_test_v1",
  investorId: "inv_test_jane",
  proposedBy: "jane@test.fund",
  clauseId: "post_money_cap",
  originalText: "$42,857,143",
  proposedText: "$40,000,000",
  status: "clo_reviewed"
}
```

---

## 🚀 DEPLOYMENT STEPS

1. **DB Setup**
   ```bash
   npm run db:migrate  # Creates new Drizzle tables
   ```

2. **Firestore Setup**
   ```bash
   # Deploy firestore.rules with new collections
   firebase deploy --only firestore:rules
   ```

3. **Build & Test**
   ```bash
   npm run build
   npm run test
   ```

4. **Deploy to Render**
   ```bash
   git add -A
   git commit -m "feat: investor docs + CLO negotiation system"
   git push origin main
   # Render auto-deploys on main push
   ```

5. **Verify Live**
   - Visit: https://boostifymusic.com/investors-dashboard
   - Click new button: "📄 Review & Sign Investment Documents"
   - Should navigate to: https://boostifymusic.com/investor-documents
   - Should show: Document list (requires session storage "boostify_investor_access_v1")

---

## 💰 COST IMPACT

### Infrastructure
- Firestore reads/writes: ~$0/month (< free tier)
- Additional storage: ~$1/month
- Additional API calls: ~$0/month (reuse existing backend)

### AI/Claude API
- CLO reviews per deal: ~$0.10 (small API calls)
- 100 negotiations per month = $10/month

**Total Monthly Cost:** ~$12/month (negligible)

---

## ⚡ QUICK START

**If approved today (2026-06-16), here's the timeline:**

| Day | Phase | Deliverable |
|-----|-------|-------------|
| Day 1 (Today) | Backend DB + API | Firestore collections + Drizzle tables + 3 API routes |
| Day 2 | CLO Agent | clo-agent.ts wired to EventBus |
| Day 3 | Frontend (Core) | investor-documents page + document viewer |
| Day 4 | Frontend (Negotiation) | Proposal form + timeline + e-signature |
| Day 5 | Polish + Testing | Button in dashboard, mobile responsive, all tests |
| Day 6 | Deploy | All systems live on production |

**Launch Date: 2026-06-22 (6 days)**

---

## 📞 DEPENDENCIES

- ✅ CLO Agent (Juno) — already exists
- ✅ EventBus — already exists
- ✅ Firestore — already configured
- ✅ PostgreSQL + Drizzle — already in use
- ✅ Claude/OpenAI API — already integrated
- ✅ E-signature (we'll use simple crypto + UI, or integrate DocuSign)
- ✅ Email notifications — Brevo/Resend already working

**No external dependencies needed** ✨

---

## 🎯 SUCCESS METRICS (1 month after launch)

- [ ] First investor uses /investor-documents to propose edit
- [ ] CLO (Juno) reviews in < 5 minutes
- [ ] Investor accepts counter in < 24 hours
- [ ] Deal closes in < 30 days (vs current 60+ days)
- [ ] CEO/CFO use executive dashboard to track deals
- [ ] Zero manual legal review overhead
- [ ] Zero missed legal risks (CLO catches 100%)

---

**Ready? Let's build! 🚀**

`Author: Neiver Alvarez-AI`  
`Review Date: 2026-06-16`  
`Status: APPROVED FOR IMPLEMENTATION`
