# Artist Agent Gateway — Operator Manual

> **Boostify Music — The only official way to communicate with a Boostify artist.**

---

## Table of Contents

1. [What Is the Artist Agent Gateway?](#1-what-is-the-artist-agent-gateway)
2. [How It Works](#2-how-it-works)
3. [For External Visitors (Brands, Fans, Labels)](#3-for-external-visitors)
4. [For Artist Owners (Private Console)](#4-for-artist-owners)
5. [Agent Types & Capabilities](#5-agent-types--capabilities)
6. [Authority Levels](#6-authority-levels)
7. [Request Lifecycle](#7-request-lifecycle)
8. [Artist Protection Layer](#8-artist-protection-layer)
9. [Configuration Guide](#9-configuration-guide)
10. [API Reference](#10-api-reference)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. What Is the Artist Agent Gateway?

The Artist Agent Gateway is Boostify's proprietary communication system that replaces traditional contact methods (email, DMs, contact forms) with an intelligent AI agent network.

**Instead of:**
> "Contact the artist by email."

**It becomes:**
> "Talk to the Artist Agent."
> "Submit Opportunity to Artist Agent."
> "Negotiate with the Artist's AI Team."

Every artist on Boostify operates as an autonomous entity with a team of specialized AI agents that:
- Receive all incoming communications
- Classify intent and evaluate opportunities
- Collect structured information
- Score and filter proposals
- Negotiate within pre-set parameters
- Protect the artist's rights and interests
- Escalate to human approval when needed

---

## 2. How It Works

### The Communication Flow

```
External Party
    ↓
Artist Agent Gateway (Public Interface)
    ↓
Intent Classification Engine
    ↓
Specialized Agent Selection
    ↓
Information Collection & Qualification
    ↓
Opportunity Scoring & Risk Assessment
    ↓
Agent Response or Negotiation
    ↓
Human Approval (if required)
    ↓
Execution (contract, meeting, rejection)
```

### Key Principles

1. **No direct contact** — All communication passes through agents
2. **Structured data** — Agents collect specific information per request type
3. **Intelligent filtering** — Spam, scams, and low-value requests are filtered automatically
4. **24/7 availability** — Agents respond instantly at any time
5. **Human oversight** — Critical decisions require owner approval
6. **Full audit trail** — Every interaction is logged

---

## 3. For External Visitors

### 3.1 Accessing the Gateway

When you visit an artist's profile on Boostify, you'll see the **Agent Gateway** section with buttons for different request types:

- **Book This Artist** — Event bookings, shows, appearances
- **License Music** — Sync licensing, commercial use
- **Brand Collaboration** — Partnerships, endorsements, campaigns
- **Submit Collaboration** — Producer/artist collaborations
- **Press / Interview** — Media requests, interviews, features
- **Fan Message** — General messages, questions, fan mail

### 3.2 Starting a Conversation

1. Click the appropriate button for your request type
2. The specialized AI agent will greet you and explain what information is needed
3. Answer the agent's questions — they are designed to collect everything needed to evaluate your proposal
4. The agent will provide a summary and next steps

### 3.3 What Happens After

- **Simple requests** (fan messages, info requests): Auto-replied instantly
- **Business opportunities**: Classified, scored, and forwarded to the artist's team
- **High-value proposals**: May require human review — you'll be notified when a decision is made
- **Incomplete requests**: The agent will ask for missing information before proceeding

### 3.4 Tracking Your Request

After submitting a request, you receive a **conversation ID**. You can use this to:
- Check the status of your request
- View the conversation history
- Respond to follow-up questions from the agent

### 3.5 Important Notes

- **Direct contact is not available** — All opportunities are reviewed by the artist's Agent Network
- **Be specific** — The more detail you provide, the faster your request will be evaluated
- **Budget is important** — Requests without budget information may be deprioritized
- **Response time** — Agent responses are instant; human decisions may take 24-72 hours

---

## 4. For Artist Owners

### 4.1 The Private Agent Console

As an artist owner, you have access to the **Agent Console** — a private dashboard where you can:

- View all incoming opportunities
- Approve, reject, or counter-offer proposals
- Configure agent behavior and rules
- Review communication history
- Manage your agent team
- Track pipeline value and analytics

### 4.2 Accessing the Console

1. Go to your artist profile
2. Find the **Agent Gateway** section
3. Click **"Open Agent Console"**
4. Or navigate directly to `/artist/:slug/agent-console`

### 4.3 Console Dashboard

The dashboard shows:

**Pending Approvals**
- Requests that require your decision
- Agent recommendation and risk assessment
- One-click approve/reject/counter-offer

**Active Conversations**
- Ongoing negotiations
- Information being collected
- Awaiting external response

**Pipeline Summary**
- Total estimated value of incoming opportunities
- Breakdown by type (booking, licensing, brand, etc.)
- Conversion rate (submitted → approved → completed)

**Recent Activity**
- Latest messages and agent actions
- New contacts
- Completed deals

### 4.4 Approval Workflow

When an agent determines that a request needs human approval:

1. You receive a notification
2. The request appears in your **Pending Approvals** queue
3. You see:
   - Full request details
   - Agent's analysis and recommendation
   - Risk assessment
   - Estimated value
   - Suggested action (approve / reject / counter at $X)
4. You decide:
   - **Approve** — Agent proceeds with execution
   - **Reject** — Agent sends professional rejection
   - **Counter** — Agent sends your counter-offer
   - **Request More Info** — Agent asks for additional details

### 4.5 Configuring Agents

Each agent can be configured with:

**Communication Style**
- Tone (professional, friendly, formal)
- Response length (concise, detailed)
- Language preferences

**Authority Rules**
- What the agent can do autonomously
- Budget thresholds for auto-approval
- Which request types require human review

**Qualification Criteria**
- Minimum budget for consideration
- Required information fields
- Geographic preferences
- Brand compatibility rules

---

## 5. Agent Types & Capabilities

### 5.1 Manager Agent
**Role:** Chief of Staff — routes requests, oversees other agents
**Authority Level:** 4 (Human Approval)
**Capabilities:**
- Routes incoming requests to the appropriate specialist agent
- Resolves conflicts between agents
- Escalates critical decisions to the artist owner
- Provides strategic recommendations
- Manages the overall communication policy

### 5.2 Booking Agent
**Role:** Handles event bookings, shows, and appearances
**Authority Level:** 3 (Limited Negotiation)
**Collects:**
- Event date and duration
- City and venue
- Expected attendance
- Budget range
- Technical requirements
- Travel and accommodation arrangements
- Type of show (full set, DJ set, appearance, meet & greet)

**Evaluates:**
- Venue capacity vs. artist draw
- Budget vs. market rate
- Geographic feasibility
- Schedule conflicts
- Strategic value of the event

### 5.3 Licensing Agent
**Role:** Handles music licensing and sync placements
**Authority Level:** 3 (Limited Negotiation)
**Collects:**
- Song(s) requested
- Type of use (film, TV, commercial, game, social media)
- Territory (worldwide, specific regions)
- Duration of license
- Budget/fee offered
- Platforms where it will be used
- Exclusivity requirements
- Campaign description

**Evaluates:**
- Fair market value for the usage type
- Territory scope impact
- Duration合理性
- Brand compatibility
- Exclusivity implications

### 5.4 Brand Deals Agent
**Role:** Handles brand partnerships and endorsements
**Authority Level:** 3 (Limited Negotiation)
**Collects:**
- Company/brand name
- Campaign description
- Product/service category
- Usage of artist image/likeness
- Territory
- Duration
- Budget offered
- Deliverables expected
- Exclusivity requirements

**Evaluates:**
- Brand reputation and compatibility
- Budget vs. market rate
- Image rights implications
- Contractual obligations
- Strategic alignment with artist brand

### 5.5 Collaboration Agent
**Role:** Handles producer/artist collaboration requests
**Authority Level:** 2 (Qualification)
**Collects:**
- Collaborator name and portfolio
- Genre/style of proposed collaboration
- Split/royalty expectations
- Rights and ownership terms
- Timeline
- Reference tracks

**Evaluates:**
- Quality of collaborator's work
- Genre compatibility
- Fair split terms
- Strategic benefit
- Schedule feasibility

### 5.6 Fan Relations Agent
**Role:** Handles fan messages and community interactions
**Authority Level:** 1-2 (Information → Qualification)
**Capabilities:**
- Answers questions about the artist (bio, discography, upcoming releases)
- Provides links to music, merch, social media
- Handles fan mail and messages
- Manages community engagement
- Identifies VIP fans or super-fans
- Auto-replies to common questions

### 5.7 Press Agent
**Role:** Handles media requests, interviews, and press features
**Authority Level:** 2-4 (Qualification → Human Approval)
**Collects:**
- Publication/media outlet name
- Type of feature (interview, review, profile, podcast)
- Audience size and demographics
- Deadline
- Topic/focus
- Format (written, audio, video)

**Evaluates:**
- Publication reach and relevance
- Audience alignment
- Timing appropriateness
- Strategic value

### 5.8 Legal Guard Agent
**Role:** Protects artist's legal interests
**Authority Level:** 4 (Human Approval)
**Capabilities:**
- Reviews contract terms in proposals
- Flags potentially abusive clauses
- Protects master recording rights
- Protects publishing rights
- Protects image/likeness rights
- Detects exploitation patterns
- Recommends legal review when needed

### 5.9 Finance Agent
**Role:** Evaluates financial aspects of opportunities
**Authority Level:** 4 (Human Approval)
**Capabilities:**
- Evaluates budget adequacy
- Compares offers to market rates
- Calculates revenue projections
- Flags suspicious payment terms
- Recommends pricing strategies
- Tracks total pipeline value

---

## 6. Authority Levels

| Level | Name | Description | Example Actions |
|-------|------|-------------|-----------------|
| **1** | Information | Can only provide public data | "Qbanito's latest album is 'Tropical Vibes', released March 2026" |
| **2** | Qualification | Can ask questions and classify requests | "What's your budget range for this licensing request?" |
| **3** | Limited Negotiation | Can negotiate within pre-approved ranges | "The minimum licensing fee for this usage is $1,500. Would you like to proceed?" |
| **4** | Human Approval | Must escalate decisions to the artist owner | "This brand deal requires artist approval. I've submitted it for review." |
| **5** | Execution | Can execute approved actions | "Contract draft has been generated and sent to your email." |

### Authority Escalation

Agents can escalate to higher authority levels when:
- The request exceeds their configured thresholds
- The request involves protected rights (masters, publishing, image)
- The risk assessment is high or critical
- The request type is configured to always require human approval

---

## 7. Request Lifecycle

### Status Flow

```
new → collecting_info → qualified → negotiating → pending_approval → approved/rejected → executing → completed
```

| Status | Description | Who Acts |
|--------|-------------|----------|
| `new` | Just submitted, not yet processed | Agent (auto-classify) |
| `collecting_info` | Agent is gathering required information | External party (answering questions) |
| `qualified` | All info collected, scored and evaluated | Agent (recommendation) |
| `negotiating` | Active negotiation in progress | Agent + External party |
| `pending_approval` | Waiting for human decision | Artist owner |
| `approved` | Human approved the opportunity | Agent (execution) |
| `rejected` | Human or agent rejected | Agent (notify external) |
| `counter_offered` | Agent sent counter-offer | External party |
| `executing` | Approved action being executed | Agent (contract, scheduling) |
| `completed` | Deal done | — |
| `expired` | Timed out without response | — |
| `spam` | Detected as spam/scam | — |

---

## 8. Artist Protection Layer

### 8.1 What It Protects Against

- **Spam** — Mass-sent, irrelevant messages
- **Scams** — Fraudulent offers, phishing attempts
- **Lowball offers** — Budgets significantly below market rate
- **Contract abuse** — Unfair terms, rights grabs
- **Exploitation** — Requests that could harm the artist's interests
- **Master theft** — Unauthorized access to recordings
- **Publishing grabs** — Unfair publishing deals
- **Image misuse** — Unauthorized use of likeness

### 8.2 Auto-Reject Rules

The system automatically rejects requests that:
- Come from known spam sources
- Have budgets below the configured minimum
- Are missing critical required information (after 3 prompts)
- Match known scam patterns
- Come from blocked contacts
- Have passed their stated deadline

### 8.3 Auto-Escalate Rules

The system automatically escalates to human approval for:
- Any contract or legal document
- Exclusive rights requests
- Payments above the configured threshold (default: $500)
- Image/likeness usage
- Master recording access
- Publishing rights
- Media interviews (configurable)

### 8.4 Auto-Approve Rules

The system can auto-approve (if configured):
- Fan messages (auto-reply with public info)
- Simple information requests
- Low-value licensing (below threshold)
- Returning trusted contacts with good history

---

## 9. Configuration Guide

### 9.1 Gateway Settings

```json
{
  "communication_mode": "agents_only",
  "public_email_visible": false,
  "direct_dm_enabled": false,
  "gateway_enabled": true,
  "welcome_message": "All communication with this artist is managed by their AI agent team.",
  "auto_reply_enabled": true
}
```

**Communication Modes:**
- `agents_only` — All contact through agents (recommended)
- `hybrid` — Agents + limited direct contact
- `direct` — Traditional contact (agents disabled)

### 9.2 Human Approval Rules

```json
{
  "human_approval_required_for": [
    "contracts",
    "brand_usage",
    "exclusive_rights",
    "payments_above_500",
    "media_interviews",
    "image_rights",
    "master_licensing"
  ],
  "auto_approve_below_amount": 200,
  "auto_approve_trusted_contacts": true,
  "approval_timeout_hours": 72
}
```

### 9.3 Agent Team Configuration

```json
{
  "active_agents": [
    "manager", "booking", "licensing", "brand_deals",
    "collaboration", "fan_relations", "press",
    "legal_guard", "finance"
  ],
  "agent_authority_overrides": {
    "booking": { "max_auto_approve_amount": 5000 },
    "licensing": { "max_auto_approve_amount": 2000 },
    "fan_relations": { "auto_reply": true }
  }
}
```

### 9.4 Protection Rules

```json
{
  "min_budget_threshold": 500,
  "blocked_domains": ["spam-domain.com"],
  "blocked_keywords": ["exposed", "free promotion"],
  "max_requests_per_sender_per_day": 3,
  "require_email_verification": true,
  "require_company_name_for_brands": true
}
```

---

## 10. API Reference

### 10.1 Public Endpoints

#### Start Conversation
```http
POST /api/agent-gateway/:artistId/start
Content-Type: application/json

{
  "intent": "booking",
  "sender_name": "John Doe",
  "sender_email": "john@company.com",
  "sender_company": "Event Co",
  "sender_type": "promoter",
  "initial_message": "I'd like to book Qbanito for a festival in Miami."
}

Response:
{
  "ok": true,
  "conversationId": "conv_abc123",
  "agentType": "booking",
  "agentName": "Booking Agent",
  "welcomeMessage": "Hello! I'm Qbanito's Booking Agent...",
  "requiredFields": ["event_date", "city", "venue", "budget", "attendance"]
}
```

#### Send Message
```http
POST /api/agent-gateway/:conversationId/message
Content-Type: application/json

{
  "content": "The event is July 15th in Miami, at Bayfront Park. Expected 5,000 attendees. Budget is $15,000."
}

Response:
{
  "ok": true,
  "message": {
    "role": "agent",
    "content": "Thank you for those details. I've evaluated your booking request...",
    "action": "qualification",
    "structured_data": {
      "opportunity_score": 82,
      "risk_level": "low",
      "missing_fields": [],
      "recommendation": "proceed"
    }
  }
}
```

#### Check Status
```http
GET /api/agent-gateway/status/:conversationId

Response:
{
  "ok": true,
  "status": "qualified",
  "opportunityScore": 82,
  "riskLevel": "low",
  "agentRecommendation": "Recommended for approval. Strong opportunity.",
  "lastActivity": "2026-05-01T14:30:00Z"
}
```

### 10.2 Owner Endpoints

#### List Requests
```http
GET /api/agent-gateway/:artistId/console/requests?status=pending_approval&limit=20
Authorization: Bearer <clerk_token>

Response:
{
  "ok": true,
  "requests": [
    {
      "id": 42,
      "agentType": "brand_deals",
      "senderCompany": "Luxury Brand X",
      "intent": "brand_collaboration",
      "opportunityScore": 87,
      "riskLevel": "low",
      "estimatedValueMin": 10000,
      "estimatedValueMax": 18000,
      "status": "pending_approval",
      "agentRecommendation": "Strong brand alignment. Recommend counter at $18,000.",
      "createdAt": "2026-05-01T10:00:00Z"
    }
  ],
  "total": 1,
  "pipelineValue": 14000
}
```

#### Approve Request
```http
POST /api/agent-gateway/:artistId/console/approve/:requestId
Authorization: Bearer <clerk_token>
Content-Type: application/json

{
  "note": "Approved. Proceed with contract at $15,000.",
  "conditions": {
    "final_amount": 15000,
    "territory": "worldwide",
    "duration": "6 months"
  }
}
```

---

## 11. Troubleshooting

### Common Issues

**Q: The agent keeps asking the same questions**
A: Make sure you're providing complete answers. The agent needs specific information to proceed. If you're unsure, say "I don't have that information yet" and the agent will note it.

**Q: My request was rejected automatically**
A: Check if your budget meets the artist's minimum threshold. Ensure you've provided all required information. If you believe this was an error, you can resubmit with more details.

**Q: I haven't received a response**
A: Agent responses are instant. If you're waiting for human approval, this may take 24-72 hours. Check your request status using your conversation ID.

**Q: Can I contact the artist directly?**
A: No. All communication with this artist is managed through their Agent Gateway. This ensures professional, structured interactions and protects the artist's time.

**Q: How do I update my submission?**
A: Send a new message in your existing conversation. The agent will incorporate the updated information.

---

*Document version: 1.0 — May 2026*
*Boostify Music — Artist Agent Gateway*
