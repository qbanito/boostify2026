# Artist Agent Gateway — Integration Plan

> **The only official way to communicate with a Boostify artist.**

---

## 1. Executive Summary

The **Artist Agent Gateway** transforms every Boostify artist into an autonomous entity with an AI-powered communication layer. Instead of exposing email addresses or DMs, all external contact flows through specialized AI agents that classify, evaluate, negotiate, and protect the artist.

**Core Principle:** *"Nobody reaches the artist directly without passing through their agents."*

---

## 2. Architecture Overview

```
External Party (Brand / Fan / Label / Promoter / Producer / Supervisor)
        │
        ▼
┌─────────────────────────────────────────────┐
│         ARTIST AGENT GATEWAY (Public)        │
│  /artist/:slug/gateway                       │
│                                              │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐      │
│  │ Booking │ │Licensing│ │ Brand    │      │
│  │ Request │ │ Request │ │ Collab   │      │
│  └────┬────┘ └────┬────┘ └────┬─────┘      │
│       │           │           │              │
│  ┌────┴────┐ ┌────┴────┐ ┌───┴──────┐      │
│  │  Press  │ │  Collab │ │  Fan     │      │
│  │ Request │ │ Request │ │ Message  │      │
│  └────┬────┘ └────┬────┘ └────┬─────┘      │
└───────┼───────────┼───────────┼─────────────┘
        │           │           │
        ▼           ▼           ▼
┌─────────────────────────────────────────────┐
│           AGENT ROUTING ENGINE               │
│                                              │
│  Intent Classification → Agent Selection     │
│  Value Scoring → Risk Assessment             │
│  Missing Info Detection → Auto-Response      │
└──────────────────┬──────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ Booking  │ │Licensing │ │ Brand    │
│ Agent    │ │ Agent    │ │ Agent    │
├──────────┤ ├──────────┤ ├──────────┤
│Collab    │ │ Fan      │ │ Press    │
│ Agent    │ │ Agent    │ │ Agent    │
├──────────┤ ├──────────┤ ├──────────┤
│ Manager  │ │ Legal    │ │ Finance  │
│ Agent    │ │ Guard    │ │ Agent    │
└────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │
     ▼            ▼            ▼
┌─────────────────────────────────────────────┐
│         ARTIST PROTECTION LAYER              │
│                                              │
│  • Spam filtering                            │
│  • Scam detection                            │
│  • Contract abuse detection                  │
│  • Master/publishing/image rights protection │
│  • Budget threshold enforcement              │
│  • Human approval escalation                 │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│       PRIVATE AGENT CONSOLE (Owner)          │
│  /artist/:slug/agent-console                 │
│                                              │
│  • Incoming opportunities dashboard          │
│  • Approve / reject / counter-offer          │
│  • Agent rules configuration                 │
│  • Communication history                     │
│  • Revenue & pipeline analytics              │
└─────────────────────────────────────────────┘
```

---

## 3. Database Schema

### 3.1 New Tables

```sql
-- ============================================================
-- ARTIST AGENT GATEWAY TABLES
-- ============================================================

-- Agent Gateway Configuration per artist
CREATE TABLE agent_gateway_config (
  id                    SERIAL PRIMARY KEY,
  artist_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  communication_mode    TEXT NOT NULL DEFAULT 'agents_only'
                        CHECK (communication_mode IN ('agents_only', 'hybrid', 'direct')),
  public_email_visible  BOOLEAN DEFAULT FALSE,
  direct_dm_enabled     BOOLEAN DEFAULT FALSE,
  gateway_enabled       BOOLEAN DEFAULT TRUE,
  welcome_message       TEXT DEFAULT 'All communication is managed by the artist''s AI agent team.',
  auto_reply_enabled    BOOLEAN DEFAULT TRUE,
  human_approval_rules  JSONB DEFAULT '{}',
  agent_team_config     JSONB DEFAULT '{}',
  protection_rules      JSONB DEFAULT '{}',
  branding              JSONB DEFAULT '{}',
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Agent definitions per artist
CREATE TABLE artist_agents (
  id                SERIAL PRIMARY KEY,
  artist_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type        TEXT NOT NULL CHECK (agent_type IN (
                      'manager', 'booking', 'licensing', 'brand_deals',
                      'collaboration', 'fan_relations', 'press',
                      'legal_guard', 'finance', 'merch', 'distribution'
                    )),
  name              TEXT NOT NULL,
  description       TEXT,
  system_prompt     TEXT NOT NULL,
  capabilities      JSONB DEFAULT '[]',
  authority_level   INTEGER DEFAULT 2 CHECK (authority_level BETWEEN 1 AND 5),
  rules             JSONB DEFAULT '{}',
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(artist_id, agent_type)
);

-- Gateway requests (every incoming communication)
CREATE TABLE agent_gateway_requests (
  id                      SERIAL PRIMARY KEY,
  artist_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type              TEXT NOT NULL,
  conversation_id         TEXT NOT NULL UNIQUE,
  
  -- Sender info
  sender_type             TEXT NOT NULL CHECK (sender_type IN (
                            'brand', 'fan', 'label', 'promoter', 'producer',
                            'supervisor', 'press', 'distributor', 'other'
                          )),
  sender_name             TEXT,
  sender_email            TEXT,
  sender_company          TEXT,
  sender_clerk_id         TEXT,  -- null if external (not logged in)
  
  -- Intent & classification
  intent                  TEXT NOT NULL,
  intent_confidence       REAL DEFAULT 0,
  
  -- Structured data collected by agent
  collected_data          JSONB DEFAULT '{}',
  
  -- Scoring
  opportunity_score       INTEGER DEFAULT 0 CHECK (opportunity_score BETWEEN 0 AND 100),
  risk_level              TEXT DEFAULT 'unknown' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  compatibility_score     INTEGER DEFAULT 0,
  
  -- Status workflow
  status                  TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
                            'new', 'collecting_info', 'qualified', 'negotiating',
                            'pending_approval', 'approved', 'rejected',
                            'counter_offered', 'executing', 'completed', 'expired', 'spam'
                          )),
  
  -- Agent response
  agent_summary           TEXT,
  agent_recommendation    TEXT,
  requires_human_approval BOOLEAN DEFAULT FALSE,
  
  -- Financials
  estimated_value_min     NUMERIC(12,2),
  estimated_value_max     NUMERIC(12,2),
  proposed_budget         NUMERIC(12,2),
  
  -- Metadata
  territory               TEXT,
  deadline                TIMESTAMPTZ,
  metadata                JSONB DEFAULT '{}',
  
  created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Messages within a gateway conversation
CREATE TABLE agent_gateway_messages (
  id                SERIAL PRIMARY KEY,
  request_id        INTEGER NOT NULL REFERENCES agent_gateway_requests(id) ON DELETE CASCADE,
  conversation_id   TEXT NOT NULL,
  
  role              TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system', 'human_approver')),
  agent_type        TEXT,  -- which agent sent this
  content           TEXT NOT NULL,
  
  -- Structured data attached to message
  structured_data   JSONB,
  
  -- For agent messages: what action was taken
  action            TEXT CHECK (action IN (
                      'info_request', 'qualification', 'negotiation',
                      'auto_reply', 'escalation', 'approval_request',
                      'rejection', 'counter_offer', 'contract_draft',
                      'meeting_scheduled', 'executed'
                    )),
  
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Approval queue for human review
CREATE TABLE agent_approval_queue (
  id                SERIAL PRIMARY KEY,
  request_id        INTEGER NOT NULL REFERENCES agent_gateway_requests(id) ON DELETE CASCADE,
  artist_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  approval_type     TEXT NOT NULL CHECK (approval_type IN (
                      'contract', 'brand_usage', 'exclusive_rights',
                      'high_value_payment', 'media_interview',
                      'image_rights', 'master_license', 'custom'
                    )),
  
  agent_recommendation  TEXT NOT NULL,
  agent_proposed_action TEXT NOT NULL,
  risk_assessment       JSONB DEFAULT '{}',
  
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                      'pending', 'approved', 'rejected', 'expired'
                    )),
  decided_by        TEXT,  -- clerk user id of approver
  decision_note     TEXT,
  decided_at        TIMESTAMPTZ,
  
  expires_at        TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '72 hours'),
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Audit log for all gateway actions
CREATE TABLE agent_gateway_audit_log (
  id                SERIAL PRIMARY KEY,
  artist_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id        INTEGER REFERENCES agent_gateway_requests(id) ON DELETE SET NULL,
  action            TEXT NOT NULL,
  actor_type        TEXT NOT NULL CHECK (actor_type IN ('agent', 'human', 'system')),
  actor_detail      TEXT,
  details           JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- External contacts database
CREATE TABLE agent_external_contacts (
  id                SERIAL PRIMARY KEY,
  artist_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  email             TEXT,
  company           TEXT,
  contact_type      TEXT CHECK (contact_type IN (
                      'brand', 'label', 'promoter', 'producer',
                      'supervisor', 'press', 'fan_vip', 'other'
                    )),
  total_requests    INTEGER DEFAULT 0,
  total_value       NUMERIC(12,2) DEFAULT 0,
  trust_score       INTEGER DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  notes             TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_gw_config_artist ON agent_gateway_config(artist_id);
CREATE INDEX idx_gw_requests_artist ON agent_gateway_requests(artist_id);
CREATE INDEX idx_gw_requests_status ON agent_gateway_requests(status);
CREATE INDEX idx_gw_requests_agent ON agent_gateway_requests(agent_type);
CREATE INDEX idx_gw_requests_conv ON agent_gateway_requests(conversation_id);
CREATE INDEX idx_gw_messages_request ON agent_gateway_messages(request_id);
CREATE INDEX idx_gw_messages_conv ON agent_gateway_messages(conversation_id);
CREATE INDEX idx_gw_approval_artist ON agent_approval_queue(artist_id);
CREATE INDEX idx_gw_approval_status ON agent_approval_queue(status);
CREATE INDEX idx_gw_audit_artist ON agent_gateway_audit_log(artist_id);
CREATE INDEX idx_gw_contacts_artist ON agent_external_contacts(artist_id);
```

### 3.2 Schema Integration with `db/schema.ts`

Add to the existing Drizzle schema file alongside current tables. All tables use the existing `users.id` foreign key pattern.

---

## 4. File Structure

### 4.1 Server — New Files

```
server/
├── routes/
│   └── agent-gateway.ts              # Public + private REST API
├── services/
│   ├── gateway-engine.ts             # Core routing, classification, scoring
│   ├── gateway-agents/
│   │   ├── base-agent.ts             # Abstract base class for all agents
│   │   ├── manager-agent.ts          # Chief of staff, routes to specialists
│   │   ├── booking-agent.ts          # Events, shows, appearances
│   │   ├── licensing-agent.ts        # Music licensing, sync
│   │   ├── brand-deals-agent.ts      # Brand partnerships, endorsements
│   │   ├── collaboration-agent.ts    # Producer/artist collaborations
│   │   ├── fan-relations-agent.ts    # Fan messages, community
│   │   ├── press-agent.ts            # Interviews, press, media
│   │   ├── legal-guard-agent.ts      # Contract protection, rights
│   │   └── finance-agent.ts          # Budget evaluation, payments
│   ├── gateway-protection.ts         # Artist Protection Layer
│   ├── gateway-contract-gen.ts       # Preliminary contract generation
│   └── gateway-seed.ts               # Default agent seeding for new artists
└── middleware/
    └── gateway-auth.ts               # Public vs owner auth for gateway routes
```

### 4.2 Client — New Files

```
client/src/
├── components/
│   └── agent-gateway/
│       ├── gateway-panel.tsx              # Main section in artist profile (public)
│       ├── gateway-chat.tsx               # Chat interface with agent
│       ├── gateway-request-form.tsx       # Smart dynamic form per intent type
│       ├── gateway-status-tracker.tsx     # Track submitted request status
│       ├── agent-console.tsx              # Private owner console
│       ├── agent-console-dashboard.tsx    # Opportunities dashboard
│       ├── agent-console-settings.tsx     # Agent rules configuration
│       ├── agent-console-history.tsx      # Communication history
│       ├── approval-card.tsx              # Human approval card
│       └── opportunity-card.tsx           # Opportunity display card
├── pages/
│   └── artist-agent-gateway-page.tsx      # Full-page gateway view
└── hooks/
    └── use-agent-gateway.ts               # Shared hook for gateway data
```

---

## 5. API Endpoints

### 5.1 Public Endpoints (No auth required — for external visitors)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agent-gateway/:artistId/config` | Get gateway config (public view) |
| `GET` | `/api/agent-gateway/:artistId/agents` | List active agents (public info) |
| `POST` | `/api/agent-gateway/:artistId/start` | Start a new conversation |
| `POST` | `/api/agent-gateway/:conversationId/message` | Send message in conversation |
| `GET` | `/api/agent-gateway/:conversationId/messages` | Get conversation history |
| `GET` | `/api/agent-gateway/status/:conversationId` | Check request status |

### 5.2 Owner Endpoints (Requires auth + ownership)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agent-gateway/:artistId/console/requests` | List all incoming requests |
| `GET` | `/api/agent-gateway/:artistId/console/request/:requestId` | Get full request detail |
| `POST` | `/api/agent-gateway/:artistId/console/approve/:requestId` | Approve a request |
| `POST` | `/api/agent-gateway/:artistId/console/reject/:requestId` | Reject a request |
| `POST` | `/api/agent-gateway/:artistId/console/counter/:requestId` | Send counter-offer |
| `PUT` | `/api/agent-gateway/:artistId/console/config` | Update gateway config |
| `PUT` | `/api/agent-gateway/:artistId/console/agents/:agentType` | Update agent config |
| `GET` | `/api/agent-gateway/:artistId/console/approvals` | List pending approvals |
| `POST` | `/api/agent-gateway/:artistId/console/approvals/:approvalId` | Decide on approval |
| `GET` | `/api/agent-gateway/:artistId/console/contacts` | List external contacts |
| `GET` | `/api/agent-gateway/:artistId/console/audit-log` | View audit trail |
| `GET` | `/api/agent-gateway/:artistId/console/stats` | Pipeline & revenue stats |

---

## 6. Agent Authority Levels

| Level | Name | Can Do | Example |
|-------|------|--------|---------|
| **1** | Information | Answer public data only | "Qbanito's latest album is…" |
| **2** | Qualification | Ask questions, classify, score | "What's your budget range?" |
| **3** | Limited Negotiation | Negotiate within pre-set ranges | "The minimum for this license is $1,500" |
| **4** | Human Approval | Escalate to owner for decisions | "This requires artist approval" |
| **5** | Execution | Generate contracts, invoices, schedule | "Contract draft attached" |

### Default Authority per Agent

| Agent | Default Level | Can Escalate To |
|-------|--------------|-----------------|
| Fan Relations | 1→2 | N/A |
| Press | 2→4 | Manager |
| Collaboration | 2→3 | Manager |
| Booking | 3→4 | Manager |
| Licensing | 3→4 | Legal Guard → Manager |
| Brand Deals | 3→4 | Legal Guard → Finance → Manager |
| Manager | 4→5 | Human (owner) |
| Legal Guard | 4 | Human (owner) |
| Finance | 4 | Human (owner) |

---

## 7. Conversation Flow

### 7.1 Standard Flow

```
1. External visitor clicks "Book This Artist" on profile
2. Gateway opens chat with Booking Agent
3. Agent greets and asks structured questions:
   - Event date
   - City / Venue
   - Expected attendance
   - Budget range
   - Technical requirements
   - Travel covered?
   - Type of show (full set / DJ set / appearance)
4. Agent classifies: intent=booking, confidence=0.95
5. Agent scores: opportunity_score=78, risk=low
6. Agent responds with summary + next steps
7. If requires human approval → queued in owner's console
8. Owner approves/rejects/counter-offers
9. Agent communicates decision to external party
10. If approved → agent can draft contract, schedule meeting
```

### 7.2 Auto-Reply Flow (Fan Message)

```
1. Fan sends message through gateway
2. Fan Relations Agent classifies intent
3. If simple info request → auto-reply with public data
4. If premium request → escalate
5. Fan gets instant response
6. Logged in audit trail
```

### 7.3 Protection Flow (Spam/Scam)

```
1. Suspicious request detected
2. Legal Guard Agent flags: risk=critical
3. Auto-reject with professional message
4. Contact added to blocklist
5. Logged in audit trail
6. Owner notified
```

---

## 8. Artist Protection Layer Rules

### 8.1 Auto-Reject Conditions

- Budget below artist minimum threshold
- Known spam/scam patterns
- Incomplete requests (3+ missing required fields)
- Requests from blocked contacts
- Expired opportunities (deadline passed)

### 8.2 Auto-Escalate Conditions

- Contracts or legal documents
- Exclusive rights requests
- Payments above configured threshold
- Image/likeness usage
- Master recording access
- Publishing rights
- Media interviews (for high-profile artists)

### 8.3 Auto-Approve Conditions (if configured)

- Fan messages (auto-reply)
- Information requests
- Low-value licensing (below threshold)
- Returning trusted contacts

---

## 9. Integration with Existing Systems

### 9.1 Hermes Agent

The Gateway agents leverage the existing Hermes memory system:
- `MEMORY.md` → agent context about the artist
- `SOUL.md` → personality and communication style
- `goals.json` → strategic priorities that influence agent decisions

### 9.2 Career Suite Agents

The existing 5 Career Suite agents (manager, marketing, ar, merch, finance) serve as the **internal** team. The Gateway agents are the **external-facing** layer. They share data but have different interfaces.

### 9.3 Contracts System

The existing `contracts` table is extended:
- Gateway can auto-generate preliminary contracts
- Contracts link back to `agent_gateway_requests`
- Status flows: `draft → pending_approval → active → completed`

### 9.4 Notifications

Gateway events create notifications:
- New opportunity received
- Approval needed
- Opportunity approved/rejected
- Contract ready for review
- High-value opportunity alert

### 9.5 AI Routing

All agents use `callAI()` from `server/utils/smart-ai.ts`:
- Classification: lightweight model (gpt-4o-mini)
- Agent responses: primary model cascade
- Contract generation: heavy model (gpt-4o)

---

## 10. Profile Card Integration

### 10.1 Section Registration

```typescript
// In artist-profile-card.tsx sectionConfig
'agent-gateway': {
  name: 'Agent Gateway 🛡️',
  icon: Shield,
  isOwnerOnly: false  // visible to everyone
}
```

### 10.2 Public View (Visitors)

The section shows:
- Gateway status badge ("Agents Only" / "Hybrid" / "Direct")
- Intent buttons: Book, License, Brand Collab, Collaborate, Press, Fan Message
- Each button opens the gateway chat with the appropriate agent
- "Direct contact is not available" footer

### 10.3 Owner View

The section shows:
- All public view elements (preview)
- "Open Agent Console" button → full-page console
- Quick stats: pending approvals, new opportunities, pipeline value

### 10.4 Default Visibility

```typescript
defaultVisibility['agent-gateway'] = true;  // always visible
```

---

## 11. Implementation Phases

### Phase 1 — MVP (Week 1-2)

**Goal:** Working gateway with 3 agents, basic chat, classification.

- [ ] Database schema (7 tables)
- [ ] `gateway-engine.ts` — routing, classification, scoring
- [ ] `base-agent.ts` — abstract agent with LLM integration
- [ ] `fan-relations-agent.ts` — auto-reply for fans
- [ ] `booking-agent.ts` — structured booking requests
- [ ] `licensing-agent.ts` — music licensing requests
- [ ] `agent-gateway.ts` routes — public + owner endpoints
- [ ] `gateway-panel.tsx` — public section in profile card
- [ ] `gateway-chat.tsx` — chat interface
- [ ] `gateway-request-form.tsx` — smart form per intent
- [ ] Profile card integration (section, visibility, rendering)
- [ ] Default agent seeding for all artists
- [ ] Basic audit logging

### Phase 2 — Full Agent Team (Week 3-4)

**Goal:** All 9 agents, protection layer, approval workflow.

- [ ] `brand-deals-agent.ts`
- [ ] `collaboration-agent.ts`
- [ ] `press-agent.ts`
- [ ] `manager-agent.ts` (supervisor)
- [ ] `legal-guard-agent.ts`
- [ ] `finance-agent.ts`
- [ ] `gateway-protection.ts` — spam/scam/abuse detection
- [ ] `agent-console.tsx` — private owner dashboard
- [ ] `agent-console-dashboard.tsx` — opportunities pipeline
- [ ] `approval-card.tsx` — human approval workflow
- [ ] Notification integration
- [ ] External contacts database

### Phase 3 — Advanced (Week 5-6)

**Goal:** Contract generation, negotiation, analytics.

- [ ] `gateway-contract-gen.ts` — preliminary contract drafting
- [ ] Negotiation flow (counter-offers, multi-round)
- [ ] `agent-console-settings.tsx` — full rules configuration
- [ ] `agent-console-history.tsx` — communication history
- [ ] Pipeline analytics & revenue tracking
- [ ] Trust scoring for external contacts
- [ ] Gateway branding customization
- [ ] Full-page dedicated gateway page
- [ ] Operator manual & documentation

---

## 12. Commercial Positioning

### Taglines

- *"The only official way to communicate with a Boostify artist."*
- *"Your artist never receives noise. Only qualified opportunities."*
- *"Every artist has their own executive AI team."*

### Key Differentiators

| Feature | Traditional | Boostify Gateway |
|---------|------------|-----------------|
| Contact method | Email / DM | AI Agent conversation |
| Spam protection | Manual filtering | Automated protection layer |
| Opportunity scoring | Gut feeling | AI-scored 0-100 |
| Response time | Hours/days | Instant (agent) + human when needed |
| Contract drafting | Manual/legal | AI-preliminary + human review |
| Availability | Business hours | 24/7/365 |
| Professionalism | Variable | Consistent, structured |

---

## 13. Security Considerations

1. **Rate limiting** — Max 10 requests per IP per hour per artist
2. **Captcha** — Required for unauthenticated submissions
3. **Email verification** — External senders must verify email
4. **Data retention** — Conversations retained 1 year, audit logs 3 years
5. **GDPR** — External contacts can request data deletion
6. **Abuse detection** — Pattern matching for known scam templates
7. **Agent guardrails** — Agents cannot reveal internal artist data beyond public info
8. **Human override** — Owner can always intervene in any conversation

---

*Document version: 1.0 — May 2026*
*Boostify Music — Artist Agent Gateway*
