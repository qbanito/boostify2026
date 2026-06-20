# BOOSTIFY AAS ENGINE — Autonomous Artist Survival System
## Plan Detallado de Integración Técnica

> **Motor operativo de supervivencia y monetización autónoma para artistas sintéticos**  
> Integrado 100% con la infraestructura existente de Boostify

---

## INVENTARIO DE HERRAMIENTAS EXISTENTES QUE SE CONECTAN

Antes de construir nada nuevo, aquí está **todo lo que ya tenemos** y cómo se mapea:

### Ya Construido → Módulo AAS

| Herramienta Existente | Ubicación | Módulo AAS Destino |
|---|---|---|
| Agent Orchestrator (tick-based) | `server/agents/orchestrator.ts` | **Núcleo Cognitivo** |
| 25 Agentes especializados | `server/agents/*.ts` | **Capa de Agentes** |
| MCP + Agent Prompts | `server/mcp/agent-prompts.ts` | **Contexto Estratégico** |
| Personality Agent (traits, mood) | `server/agents/personality-agent.ts` | **Identidad Persistente** |
| Memory Agent (short/long-term) | `server/agents/memory-agent.ts` | **Memoria Operativa/Estratégica** |
| Economy Agent | `server/agents/economy-agent.ts` | **Finance Controller** |
| Social Agent + Audience Agent | `server/agents/social-agent.ts` | **Growth Operator** |
| Outreach Agent | `server/agents/outreach-agent.ts` | **Deal Closer** |
| Management Agent | `server/agents/management-agent.ts` | **Survival Strategist** |
| Collaboration Agent | `server/agents/collaboration-agent.ts` | **Deal Closer** |
| Investor Outreach Pipeline | `server/services/investor-outreach/` | **Deal Closer** |
| Sponsor API + Scraper | `server/routes/sponsor-api.ts` | **Revenue Operator** |
| Venue Outreach | `server/routes/venue-outreach.ts` | **Deal Closer** |
| Lead Capture System | `server/routes/leads.ts` | **Growth Operator** |
| Printful Merch + Design Pack | `server/services/printful-service.ts` | **Revenue Operator** |
| FAL AI Image/Music Gen | `server/services/fal-service.ts` | **Content Engine** |
| Gemini Text/Image/Video | `server/services/gemini-service.ts` | **Content Engine** |
| Voice AI | `server/services/voice-ai-service.ts` | **Content Engine** |
| Shotstack Video Rendering | `server/services/video-rendering/` | **Content Engine** |
| Spotify/Instagram/YouTube APIs | `server/services/spotify-service.ts` + extensions | **Analytics + Growth** |
| Apify Scraping (IG, sponsors, venues) | `server/services/apify-*.ts` | **Intelligence Layer** |
| Artist Wallet + Transactions | `artistWallet`, `walletTransactions` tables | **Finance Controller** |
| Sales Transactions | `salesTransactions` table | **Finance Controller** |
| Marketing Metrics | `marketingMetrics` table | **KPI Dashboard** |
| Analytics History | `analyticsHistory` table | **Aprendizaje Adaptativo** |
| Manager Tasks/Contacts | `managerTasks`, `managerContacts` tables | **CRM** |
| Stripe Payments + Webhooks | `server/routes/webhook-stripe.ts` | **Revenue Operator** |
| Brevo + Resend Email | `server/services/brevo-email-service.ts` | **Outreach Engine** |
| BTF Token + Smart Contracts | `contracts/*.sol`, `btf2300-blockchain.ts` | **Token Economy** |
| Copyright Registry | `BoostifyCopyrightRegistry.sol` | **Risk & Compliance** |
| EPK Generator | `server/routes/epk.ts` | **Deal Closer** |
| Chrome Extensions (IG/YT) | `boostify-*-extension/` | **Growth Operator** |

---

## ARQUITECTURA TÉCNICA COMPLETA

```
┌─────────────────────────────────────────────────────────────────┐
│                    AAS ENGINE — CORE LOOP                       │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│  │DIAGNÓSTICO│──▶│PRIORIZAR │──▶│PLAN DIARIO│──▶│ EJECUTAR │   │
│  │  Fase 1   │   │  Fase 2  │   │  Fase 3   │   │  Fase 4  │   │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘   │
│       ▲                                              │         │
│       │         ┌──────────┐   ┌──────────┐          │         │
│       └─────────│ AJUSTAR  │◀──│ EVALUAR  │◀─────────┘         │
│                 │  Fase 6  │   │  Fase 5  │                    │
│                 └──────────┘   └──────────┘                    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SURVIVAL SCORE ENGINE                       │   │
│  │  Score = (Revenue + Pipeline + Audience + Brand + Deals) │   │
│  │          - (BurnRate + LegalRisk + Churn + Fatigue)      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
    ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
    │ AGENTES │         │  DATOS  │         │HERRAMIEN│
    │ESPECIALI│         │ MEMORIA │         │   TAS   │
    │ ZADOS   │         │ SCORING │         │EXISTENTE│
    └─────────┘         └─────────┘         └─────────┘
```

---

## FASE 1 — FUNDACIONES (Semanas 1-3)

### 1.1 Tabla `artist_survival_profile` (Identidad Persistente)

**Archivo:** `shared/schema.ts` — Agregar nueva tabla

```typescript
export const artistSurvivalProfile = pgTable("artist_survival_profile", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  
  // === IDENTIDAD CORE ===
  artistName: text("artist_name").notNull(),
  lore: text("lore"),                              // Historia/backstory completo
  genre: text("genre").notNull(),
  subGenres: json("sub_genres").$type<string[]>(),
  voiceTone: text("voice_tone"),                    // "rebelde pero empático"
  aestheticStyle: text("aesthetic_style"),           // "cyberpunk neon minimal"
  brandValues: json("brand_values").$type<string[]>(), // ["autenticidad", "innovación"]
  moralLimits: json("moral_limits").$type<string[]>(), // ["no political extremism"]
  targetMarket: json("target_market").$type<{
    ageRange: string;
    geoTargets: string[];
    interests: string[];
    platforms: string[];
  }>(),
  
  // === CONFIGURACIÓN ECONÓMICA ===
  pricingTier: text("pricing_tier", { enum: ["budget", "mid", "premium"] }).default("mid"),
  productsEnabled: json("products_enabled").$type<string[]>(), // ["merch","membership","sync","tokens"]
  idealCollaborators: json("ideal_collaborators").$type<string[]>(),
  targetTerritories: json("target_territories").$type<string[]>(),
  primaryLanguage: text("primary_language").default("en"),
  secondaryLanguages: json("secondary_languages").$type<string[]>(),
  
  // === OBJETIVOS TRIMESTRALES ===
  quarterlyGoals: json("quarterly_goals").$type<{
    revenueTarget: number;
    audienceTarget: number;
    dealsTarget: number;
    contentTarget: number;
    period: string; // "2026-Q1"
  }>(),
  
  // === REGLAS DE COMPORTAMIENTO ===
  behaviorRules: json("behavior_rules").$type<{
    maxDailyBudget: number;
    maxOutreachPerDay: number;
    requireApprovalAbove: number; // USD threshold
    allowedChannels: string[];
    blockedActions: string[];
  }>(),
  
  // === ESTADO ===
  isActive: boolean("is_active").default(true),
  survivalScore: decimal("survival_score", { precision: 5, scale: 2 }).default("50.00"),
  lastDailyCycleAt: timestamp("last_daily_cycle_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Conexión existente:** Se enlaza con `users.id` que ya tiene toda la data de artista (blockchain, Stripe, avatar, etc.), `personality` del Personality Agent, y `agent_memory` del Memory Agent.

---

### 1.2 Tabla `survival_metrics` (Panel de Métricas + Survival Score)

```typescript
export const survivalMetrics = pgTable("survival_metrics", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => artistSurvivalProfile.id).notNull(),
  period: text("period").notNull(), // "2026-03-14" (daily) o "2026-W11" (weekly)
  periodType: text("period_type", { enum: ["daily", "weekly", "monthly"] }).notNull(),
  
  // === SURVIVAL SCORE COMPONENTS ===
  revenueHealth: decimal("revenue_health", { precision: 5, scale: 2 }),     // 0-100
  pipelineStrength: decimal("pipeline_strength", { precision: 5, scale: 2 }), // 0-100
  audienceMomentum: decimal("audience_momentum", { precision: 5, scale: 2 }), // 0-100
  brandRelevance: decimal("brand_relevance", { precision: 5, scale: 2 }),    // 0-100
  dealVelocity: decimal("deal_velocity", { precision: 5, scale: 2 }),       // 0-100
  
  burnRate: decimal("burn_rate", { precision: 10, scale: 2 }),              // USD/day
  legalRiskScore: decimal("legal_risk_score", { precision: 5, scale: 2 }), // 0-100
  churnRate: decimal("churn_rate", { precision: 5, scale: 2 }),            // % pérdida
  contentFatigue: decimal("content_fatigue", { precision: 5, scale: 2 }),  // 0-100
  
  // === COMPOSITE SCORE ===
  survivalScore: decimal("survival_score", { precision: 5, scale: 2 }).notNull(),
  
  // === FINANCIAL ACTUALS ===
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0"),
  totalCosts: decimal("total_costs", { precision: 10, scale: 2 }).default("0"),
  netProfit: decimal("net_profit", { precision: 10, scale: 2 }).default("0"),
  runwayDays: integer("runway_days").default(0),
  
  // === AUDIENCE ACTUALS ===
  newFans: integer("new_fans").default(0),
  lostFans: integer("lost_fans").default(0),
  netFanGrowth: integer("net_fan_growth").default(0),
  emailsCaptured: integer("emails_captured").default(0),
  superfanConversions: integer("superfan_conversions").default(0),
  
  // === COMMERCIAL ACTUALS ===
  dealsOpened: integer("deals_opened").default(0),
  dealsClosed: integer("deals_closed").default(0),
  responseRate: decimal("response_rate", { precision: 5, scale: 2 }),
  avgDealValue: decimal("avg_deal_value", { precision: 10, scale: 2 }),
  
  // === CONTENT ===
  contentPublished: integer("content_published").default(0),
  topPerformingContent: json("top_performing_content").$type<string[]>(),
  channelPerformance: json("channel_performance").$type<Record<string, number>>(),
  
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Conexión existente:** Se alimenta de `marketingMetrics`, `analyticsHistory`, `salesTransactions`, `walletTransactions`, y `artistWallet`.

---

### 1.3 Tabla `deal_pipeline` (CRM de Oportunidades)

```typescript
export const dealPipeline = pgTable("deal_pipeline", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => artistSurvivalProfile.id).notNull(),
  
  // === TARGET ===
  targetName: text("target_name").notNull(),
  targetRole: text("target_role"), // "A&R", "Manager", "Brand Director", "Curator"
  targetCompany: text("target_company"),
  targetEmail: text("target_email"),
  targetPlatform: text("target_platform"), // "Instagram", "LinkedIn", "Email"
  targetCategory: text("target_category", { 
    enum: ["label", "manager", "brand", "curator", "artist", "publisher", "supervisor", "festival", "agency"] 
  }).notNull(),
  
  // === PIPELINE STAGE ===
  stage: text("stage", { 
    enum: ["identified", "qualified", "first_contact", "interest_detected", 
           "proposal_sent", "negotiation", "legal_review", "closed_won", 
           "closed_lost", "activated", "expansion"] 
  }).default("identified"),
  
  // === DEAL ECONOMICS ===
  estimatedValue: decimal("estimated_value", { precision: 10, scale: 2 }),
  dealType: text("deal_type", { 
    enum: ["sync_license", "distribution", "collab", "sponsorship", "playlist_placement", 
           "management", "publishing", "merch_collab", "show_booking", "brand_deal"] 
  }),
  
  // === TRACKING ===
  lastContactAt: timestamp("last_contact_at"),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  touchpoints: integer("touchpoints").default(0),
  responseScore: decimal("response_score", { precision: 5, scale: 2 }), // 0-100
  notes: text("notes"),
  
  // === AUTO-GENERATED ASSETS ===
  proposalUrl: text("proposal_url"),
  mediaKitUrl: text("media_kit_url"),
  lastMessageSent: text("last_message_sent"),
  
  // === APPROVAL ===
  requiresHumanApproval: boolean("requires_human_approval").default(false),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Conexión existente:** Unifica data de `managerContacts`, `investors`, sponsors del `sponsor-api.ts`, y venues del `venue-outreach.ts` en un pipeline único. El Outreach Agent y Collaboration Agent ya generan leads — ahora se persistirán aquí.

---

### 1.4 Tabla `daily_action_log` (Registro de Ejecución)

```typescript
export const dailyActionLog = pgTable("daily_action_log", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => artistSurvivalProfile.id).notNull(),
  cycleDate: text("cycle_date").notNull(), // "2026-03-14"
  
  // === PLAN ===
  objectives: json("objectives").$type<string[]>(),        // 3 objetivos críticos
  plannedActions: json("planned_actions").$type<{
    action: string;
    agent: string;
    channel: string;
    budgetAllocated: number;
    status: "pending" | "executing" | "completed" | "failed" | "skipped";
    result?: string;
    costActual?: number;
    revenueGenerated?: number;
  }[]>(),
  maxDailyBudget: decimal("max_daily_budget", { precision: 10, scale: 2 }),
  
  // === RESULTS ===
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"),
  totalEarned: decimal("total_earned", { precision: 10, scale: 2 }).default("0"),
  actionsCompleted: integer("actions_completed").default(0),
  actionsFailed: integer("actions_failed").default(0),
  lessonsLearned: json("lessons_learned").$type<string[]>(),
  
  // === SCORE DELTA ===
  survivalScoreBefore: decimal("survival_score_before", { precision: 5, scale: 2 }),
  survivalScoreAfter: decimal("survival_score_after", { precision: 5, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

### 1.5 Tabla `artist_strategic_memory` (Memoria Estratégica)

```typescript
export const artistStrategicMemory = pgTable("artist_strategic_memory", {
  id: serial("id").primaryKey(),
  artistId: integer("artist_id").references(() => artistSurvivalProfile.id).notNull(),
  
  category: text("category", { 
    enum: ["narrative_performance", "fan_behavior", "deal_insight", "collab_result", 
           "offer_conversion", "segment_ltv", "channel_efficiency", "creative_roi"] 
  }).notNull(),
  
  insight: text("insight").notNull(),           // "Los drops de merch los viernes 6pm convierten 3x más"
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // 0.00-1.00
  evidenceCount: integer("evidence_count").default(1),
  lastValidatedAt: timestamp("last_validated_at"),
  
  metadata: json("metadata").$type<Record<string, any>>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**Conexión existente:** Extiende el `Memory Agent` que ya tiene `createMemory()`, `getMemories()`, `getDecisionContext()`. La memoria operativa ya existe en `agent_memory` — esta tabla es para insights estratégicos de mayor duración.

---

## FASE 2 — LOS 7 AGENTES DE SUPERVIVENCIA (Semanas 3-6)

### Mapeo: Agentes Nuevos → Agentes Existentes + Servicios

Cada agente AAS **no se construye desde cero** — se compone de agentes y servicios que ya existen:

---

### Agente 1: `SurvivalStrategist`

**Archivo:** `server/agents/aas/survival-strategist.ts`

**Rol:** Director estratégico diario. Decide prioridades basado en Survival Score.

**Compuesto de (ya existente):**
- `ManagementAgent` → `server/agents/management-agent.ts` (task planning)
- `EconomyAgent` → `server/agents/economy-agent.ts` (financial analysis)
- `MemoryAgent` → `server/agents/memory-agent.ts` (decision context)
- `PersonalityAgent` → `server/agents/personality-agent.ts` (personality-consistent decisions)
- `survivalMetrics` tabla → historical performance data

**LLM Backend:** Claude Opus 4.6 via Anthropic API (ya disponible en `.env` como `ANTHROPIC_API_KEY`)

**Input diario:**
```typescript
interface DailyDiagnosticInput {
  survivalScore: number;
  runwayDays: number;
  cashAvailable: number;
  weeklyRevenue: number;
  weeklyCosts: number;
  activeDeals: DealPipeline[];
  contentPerformance: ChannelMetrics;
  audienceGrowth: { net: number; churn: number };
  pendingActions: QueuedAction[];
  strategicMemory: StrategicInsight[];
  artistProfile: ArtistSurvivalProfile;
}
```

**Output:**
```typescript
interface DailyPlan {
  objectives: string[];           // 3 critical objectives
  actions: PlannedAction[];       // 5 executable actions
  maxBudget: number;
  priorityMode: "sell" | "grow" | "close_deal" | "launch" | "content" | "recover_leads" | "cut_costs";
  agentAssignments: { agent: string; action: string; budget: number }[];
}
```

**Integración con orchestrator.ts:** Se ejecuta en el tick diario (cada 1440 ticks si intervalo=1min, o configurable). Reemplaza/extiende `processManagementTick()`.

---

### Agente 2: `RevenueOperator`

**Archivo:** `server/agents/aas/revenue-operator.ts`

**Compuesto de:**
- Merch System → `server/services/printful-service.ts` + `server/config/printful-product-map.ts`
- Design Pack → `generateArtistDesignPack()` en `server/services/fal-service.ts`
- Stripe → `server/routes/stripe.ts` + `webhook-stripe.ts`
- Subscription System → `server/routes/subscription-api.ts`
- Sales Tracking → `salesTransactions` + `artistWallet` tables
- Sponsor Deals → `server/routes/sponsor-api.ts`
- Token Economy → `contracts/BTFToken.sol` + `btf2300-blockchain.ts`

**Acciones que puede ejecutar:**

| Acción | Herramienta Existente | Endpoint |
|---|---|---|
| Crear merch drop | Printful Service + Design Pack | `POST /api/artist-profile/generate-design-pack` |
| Activar oferta limitada | Stripe price creation | `POST /api/stripe/create-price` |
| Lanzar membership tier | Subscription routes | `POST /api/subscriptions/create` |
| Generar bundle | Merch + Stripe combo | Nuevo: combinar existentes |
| Precio dinámico | Stripe metadata update | `PATCH /api/merch/update-price` |
| Publicar UGC pack | FAL AI assets + Firebase Storage | `POST /api/fal/generate` |
| Crear token utility | BTF Smart Contracts | `POST /api/tokenization/mint` |
| Propuesta de sponsorship | Sponsor Email Service | `POST /api/sponsors/send-proposal` |
| Sync licensing pitch | Outreach Email Service | `POST /api/outreach/send` |

---

### Agente 3: `DealCloser`

**Archivo:** `server/agents/aas/deal-closer.ts`

**Compuesto de:**
- `OutreachAgent` → `server/agents/outreach-agent.ts`
- `CollaborationAgent` → `server/agents/collaboration-agent.ts`
- Investor Outreach Pipeline → `server/services/investor-outreach/`
- Sponsor Pipeline → `server/routes/sponsor-api.ts` + `apify-sponsor-scraper.ts`
- Venue Outreach → `server/routes/venue-outreach.ts` + `apify-venue-scraper.ts`
- EPK Generator → `server/routes/epk.ts`
- Contact Enrichment → `server/services/contact-enrichment-service.ts`
- Email Services → Brevo + Resend

**Pipeline del Deal Closer:**

```
IDENTIFICAR → CALIFICAR → CONTACTAR → DETECTAR INTERÉS → 
PROPUESTA → NEGOCIAR → LEGAL REVIEW → CERRAR → ACTIVAR → EXPANDIR
```

**Auto-generación de assets (ya disponible):**
- Media Kit → EPK endpoint genera HTML completo
- Deck corto → Gemini Service genera presentación
- Propuesta de collab → Outreach Email Service con templates
- DM scripts → Gemini Text Service
- Emails personalizados → Brevo/Resend con HTML templates
- One-sheet → FAL AI image + Gemini text
- Métricas vivas → `marketingMetrics` + `analyticsHistory`
- Assets visuales → `generateArtistDesignPack()`

**Score de cualificación (nuevo cálculo, datos existentes):**
```
Lead Score = (Relevancia de industria × 0.3) + (Tamaño de audiencia × 0.2) 
           + (Historial de respuesta × 0.2) + (Valor potencial de deal × 0.3)
```

---

### Agente 4: `GrowthOperator`

**Archivo:** `server/agents/aas/growth-operator.ts`

**Compuesto de:**
- `SocialAgent` → `server/agents/social-agent.ts` (ya genera posts)
- `AudienceAgent` → `server/agents/audience-agent.ts` (engagement)
- `StoriesAgent` → `server/agents/stories-agent.ts` (stories content)
- `TrendingTopicsAgent` → `server/agents/trending-topics-agent.ts`
- Instagram Tools → `server/routes/instagram-tools.ts` + Chrome extension
- YouTube Tools → `server/routes/youtube-tools.ts` + Chrome extension
- Spotify Tools → `server/routes/spotify-tools.ts`
- Apify Scraping → `server/services/apify-instagram.ts`
- Lead Capture → `server/routes/leads.ts`
- FAL AI → Image generation para contenido visual
- Gemini → Copywriting para cada plataforma
- Shotstack → Video assembly para clips cortos

**Calendario editorial automático:**
```typescript
interface ContentCalendar {
  date: string;
  slots: {
    time: string;
    platform: "instagram" | "youtube" | "spotify" | "tiktok" | "twitter";
    contentType: "post" | "story" | "reel" | "video" | "playlist_pitch";
    narrative: string;      // Vinculado a identidad del artista
    cta: string;           // Siempre con call-to-action medible
    budgetForAds: number;  // $0 = orgánico
    agentResponsible: string;
    generatedAssets: string[];
  }[];
}
```

---

### Agente 5: `CommunityOperator`

**Archivo:** `server/agents/aas/community-operator.ts`

**Compuesto de:**
- `AudienceAgent` → `server/agents/audience-agent.ts`
- `PollsAgent` → `server/agents/polls-agent.ts`
- `LiveSpacesAgent` → `server/agents/live-spaces-agent.ts`
- Social Network → `server/routes/social-network.ts` + Firestore
- Chrome Extensions → IG/YT engagement tracking
- Challenges System → `challenges` + `challengeParticipants` tables
- Badges/Achievements → `userBadges`, `achievements` tables
- Crowdfunding → `crowdfundingCampaigns` table

**Superfan Funnel:**
```
Follower → Engaged Fan → Email Subscriber → Community Member → Superfan → Brand Ambassador
```

**Acciones automatizables:**
- Crear polls via `PollsAgent`
- Lanzar challenges con rewards
- Activar drops exclusivos
- Email nurture sequences via Brevo
- Votaciones de comunidad via social network
- Leaderboards con XP (`xp-agent.ts` ya existe)

---

### Agente 6: `RiskComplianceAgent`

**Archivo:** `server/agents/aas/risk-compliance.ts`

**Compuesto de:**
- Copyright Registry → `BoostifyCopyrightRegistry.sol` (SHA-256 verification)
- Content Moderation → `server/services/explicit-ai-service.ts`
- Brand Safety → Gemini content classification
- Contract Validation → `server/services/gemini-contracts.ts`

**Reglas hardcoded (no overrideable por otros agentes):**

```typescript
const COMPLIANCE_RULES = {
  // NUNCA sin aprobación humana:
  REQUIRE_HUMAN_APPROVAL: [
    "sign_contract",
    "commit_exclusivity", 
    "transfer_rights",
    "accept_revenue_split",
    "legal_promise",
    "payment_above_threshold",
    "token_launch",
    "third_party_likeness",
  ],
  
  // Límites automáticos:
  MAX_DAILY_OUTREACH_EMAILS: 50,
  MAX_DAILY_DMS: 20,
  MIN_HOURS_BETWEEN_FOLLOWUPS: 72,
  MAX_BUDGET_WITHOUT_APPROVAL: 100, // USD
  
  // Copyright checks:
  REQUIRE_ORIGINALITY_CHECK: ["music", "lyrics", "image", "video"],
  
  // Brand safety:
  BLOCKED_TOPICS: ["violence", "hate_speech", "illegal_substances"],
};
```

**Integración:** Este agente tiene **poder de veto**. Antes de que cualquier otro agente ejecute una acción, pasa por `RiskComplianceAgent.validate(action)`. Si falla → acción bloqueada + notificación al humano.

---

### Agente 7: `FinanceController`

**Archivo:** `server/agents/aas/finance-controller.ts`

**Compuesto de:**
- `EconomyAgent` → `server/agents/economy-agent.ts`
- Artist Wallet → `artistWallet` table
- Wallet Transactions → `walletTransactions` table
- Sales Transactions → `salesTransactions` table
- Stripe Revenue → webhook data
- API Usage Costs → `api_usage` / `apiCosts` tracking

**Cálculos en tiempo real:**

```typescript
interface FinancialSnapshot {
  // Cash Position
  cashAvailable: number;          // From artistWallet.balance
  totalEarningsAllTime: number;   // From artistWallet.totalEarnings
  totalSpentAllTime: number;      // From artistWallet.totalSpent
  
  // Burn Rate
  dailyBurnRate: number;          // Avg costs over last 7 days
  weeklyBurnRate: number;         // Avg costs over last 4 weeks
  
  // Runway
  runwayDays: number;             // cashAvailable / dailyBurnRate
  
  // Revenue Attribution
  revenueByChannel: {
    merch: number;                // From salesTransactions
    subscriptions: number;        // From Stripe recurring
    syncLicenses: number;         // From deals
    sponsorships: number;         // From sponsor deals
    tokens: number;               // From BTF transactions
    crowdfunding: number;         // From crowdfunding table
    streams: number;              // From Spotify/YouTube revenue
  };
  
  // Cost Attribution  
  costByCategory: {
    aiGeneration: number;         // FAL, Gemini, OpenAI API costs
    emailOutreach: number;        // Brevo/Resend costs
    printfulProduction: number;   // Merch COGS
    adSpend: number;              // Paid campaigns
    infrastructure: number;       // Hosting, storage
  };
  
  // Unit Economics
  customerAcquisitionCost: number;  // totalMarketingSpend / newCustomers
  revenuePerFan: number;            // totalRevenue / totalFans
  lifetimeValue: number;            // avgRevenuePerCustomer over lifetime
  returnOnAdSpend: number;          // revenue / adSpend
  marginByProduct: Record<string, number>;
  
  // Survival Threshold
  minimumMonthlyRevenue: number;    // Calculated from costs + safety margin
  isAboveSurvivalThreshold: boolean;
}
```

**Regla de supervivencia:**
```
SURVIVAL = (Revenue >= Costs + 20% safety margin) 
        AND (RunwayDays >= 60)
        AND (NetAudienceGrowth > 0)
        AND (OpenDeals >= 3)
        AND (WeeklyConversionRate > 0.5%)
```

---

## FASE 3 — EL LOOP CENTRAL DIARIO (Semanas 6-8)

### 3.1 Servicio: `AAS Daily Cycle Runner`

**Archivo:** `server/services/aas/daily-cycle.ts`

**Integración con Orchestrator:** Se conecta al tick system existente en `server/agents/orchestrator.ts`. Se ejecuta una vez al día (configurble). Cada fase llama a agentes existentes + nuevos.

```typescript
// Pseudocódigo del ciclo diario
async function runDailyCycle(artistId: number) {
  const profile = await getArtistSurvivalProfile(artistId);
  
  // FASE 1: DIAGNÓSTICO
  const financial = await FinanceController.getSnapshot(artistId);
  const metrics = await gatherMetrics(artistId); // marketingMetrics + analyticsHistory
  const deals = await getDealPipeline(artistId);
  const content = await getContentPerformance(artistId);
  const memory = await MemoryAgent.getDecisionContext(artistId);
  
  // FASE 2: PRIORIZACIÓN (Claude Opus 4.6)
  const diagnosis: DailyDiagnosticInput = { financial, metrics, deals, content, memory, profile };
  const plan = await SurvivalStrategist.createDailyPlan(diagnosis);
  
  // FASE 3: VALIDACIÓN COMPLIANCE
  const validatedPlan = await RiskComplianceAgent.validatePlan(plan);
  
  // FASE 4: EJECUCIÓN
  for (const action of validatedPlan.actions) {
    const agent = getAgentForAction(action); // RevenueOp, DealCloser, GrowthOp, etc.
    const result = await agent.execute(action);
    await logAction(artistId, action, result); // dailyActionLog table
  }
  
  // FASE 5: EVALUACIÓN
  const endOfDayMetrics = await gatherMetrics(artistId);
  const evaluation = await SurvivalStrategist.evaluate(diagnosis, endOfDayMetrics);
  
  // FASE 6: AJUSTE + MEMORIA
  await StrategicMemory.record(artistId, evaluation.insights);
  await updateSurvivalScore(artistId, evaluation.newScore);
  await SurvivalStrategist.adjustNextDayPriorities(evaluation);
  
  return { plan, evaluation };
}
```

### 3.2 Cron Job / Tick Integration

En `server/agents/orchestrator.ts`, agregar:

```typescript
// Cada 1440 ticks (= 1 día si tick interval = 1 min)
if (state.tickCount % 1440 === 0) {
  await processAASCycle(); // Runs for all active AAS artists
}
```

O alternativamente, un cron job independiente via Node.js `node-cron`:

```typescript
// server/services/aas/scheduler.ts
import cron from 'node-cron';

// Run daily at 6 AM UTC
cron.schedule('0 6 * * *', async () => {
  const activeArtists = await getActiveAASArtists();
  for (const artist of activeArtists) {
    await runDailyCycle(artist.id);
  }
});
```

---

## FASE 4 — MONETIZACIÓN MULTICAPA (Semanas 8-12)

### Streams de ingreso y su herramienta existente:

| Stream | Herramienta Boostify | Automatización AAS |
|---|---|---|
| **Merch Drops** | Printful + Design Pack + Stripe | RevenueOp genera designs, crea productos, activa campaña |
| **Contenido Exclusivo** | Boostify Explicit module | CommunityOp crea contenido gated |
| **Memberships** | Stripe Subscriptions | RevenueOp crea tiers, GrowthOp promueve |
| **Sync/Licensing** | Outreach pipeline + EPK | DealCloser encuentra supervisores, envía pitches |
| **Colaboraciones** | CollaborationAgent + Social | DealCloser matchea artistas, gestiona split |
| **Shows Virtuales** | LiveSpacesAgent | CommunityOp organiza, RevenueOp vende tickets |
| **UGC Packs** | FAL AI asset generation | RevenueOp genera packs, Stripe vende |
| **Sponsorships** | Sponsor API + Apify scraper | DealCloser scrapes brands, envía propuestas |
| **Publishing** | Copyright Registry + contracts | DealCloser busca publishers, RiskCompliance valida |
| **Token Utilities** | BTF Token + Smart Contracts | RevenueOp diseña utility, FinanceController evalúa |
| **Fan Funding** | Crowdfunding campaigns | CommunityOp lanza campaign, GrowthOp promueve |
| **Playlist Placement** | Spotify Tools + Outreach | DealCloser identifica curators, envía pitch |

---

## FASE 5 — NEGOCIACIÓN ASISTIDA (Semanas 12-16)

### Deal Closer + Claude Opus 4.6 Negotiation

```typescript
interface NegotiationContext {
  deal: DealPipeline;
  artistProfile: ArtistSurvivalProfile;
  financialPosition: FinancialSnapshot;
  strategicMemory: StrategicInsight[];    // "Este tipo de deal históricamente vale X"
  counterpartyIntel: {
    previousDeals: Deal[];
    marketRate: number;
    reputationScore: number;
  };
}

interface NegotiationOutput {
  recommendedTerms: {
    upfrontPayment: number;
    royaltySplit: number;
    exclusivityDuration: string;
    territories: string[];
    deliverables: string[];
  };
  counterOfferScript: string;           // Texto listo para enviar
  walkAwayThreshold: number;            // Mínimo aceptable
  dealScore: number;                    // 0-100 qué tan bueno es
  requiresHumanApproval: boolean;       // Siempre true para deals > threshold
  risks: string[];
}
```

**Scoring de contraparte (datos de Apify + Contact Enrichment):**
```
Counterparty Score = (Company Size × 0.2) + (Industry Relevance × 0.3) 
                   + (Historical Response × 0.2) + (Market Reputation × 0.3)
```

---

## FASE 6 — DASHBOARD DE SUPERVIVENCIA (Semanas 8-10)

### Nuevo componente: `client/src/pages/artist-survival-dashboard.tsx`

**Widgets que consumen datos existentes:**

```
┌──────────────────────────────────────────────────────────────┐
│  SURVIVAL SCORE: 73.4 / 100                    [▓▓▓▓▓▓▓░░░] │
├──────────────┬───────────────┬────────────────┬──────────────┤
│  💰 Revenue  │  📈 Audience  │  🤝 Deals     │  🔥 Burn     │
│  $2,340/wk   │  +147 fans    │  5 open       │  $89/day     │
│  ↑ 12%       │  ↑ 8%         │  2 closing    │  Runway: 78d │
├──────────────┴───────────────┴────────────────┴──────────────┤
│  TODAY'S PLAN                                                │
│  ○ Push merch drop (Instagram + Email)        [RevenueOp]    │
│  ○ Follow up with Label X A&R                 [DealCloser]   │
│  ○ Publish behind-the-scenes reel             [GrowthOp]     │
│  ○ Send sync license pitch to Supervisor Y    [DealCloser]   │
│  ○ Activate community poll for next drop      [CommunityOp]  │
├──────────────────────────────────────────────────────────────┤
│  DEAL PIPELINE                                               │
│  ┌─────────┬──────────┬────────────┬───────────┬──────────┐  │
│  │Identified│Contacted │ Interested │Negotiating│ Closed   │  │
│  │   12     │    8     │     4      │     2     │    1     │  │
│  └─────────┴──────────┴────────────┴───────────┴──────────┘  │
├──────────────────────────────────────────────────────────────┤
│  REVENUE BREAKDOWN        │  STRATEGIC INSIGHTS              │
│  ▓▓▓▓ Merch     $890      │  • Drops viernes 6PM → 3x conv  │
│  ▓▓▓  Subs      $540      │  • Reels > Posts para reach      │
│  ▓▓   Sync      $450      │  • Label X responde en < 48h     │
│  ▓    Sponsors   $260      │  • Hoodies > T-Shirts en LTV     │
│  ░    Tokens     $200      │  • Email CTR 4.2% (above avg)    │
└──────────────────────────────────────────────────────────────┘
```

**Data sources para cada widget:**
- Survival Score → `survivalMetrics` table
- Revenue → `salesTransactions` + `artistWallet` + Stripe API
- Audience → `marketingMetrics` + `analyticsHistory`
- Deals → `dealPipeline` table
- Burn Rate → `walletTransactions` + API cost tracking
- Today's Plan → `dailyActionLog` table
- Pipeline → `dealPipeline` grouped by stage
- Insights → `artistStrategicMemory` table

---

## ENDPOINTS API NUEVOS NECESARIOS

### AAS Core

| Method | Endpoint | Función |
|---|---|---|
| `POST` | `/api/aas/activate` | Activar AAS Engine para un artista |
| `GET` | `/api/aas/profile/:artistId` | Obtener perfil de supervivencia |
| `PATCH` | `/api/aas/profile/:artistId` | Actualizar configuración |
| `POST` | `/api/aas/run-cycle/:artistId` | Ejecutar ciclo diario manualmente |
| `GET` | `/api/aas/metrics/:artistId` | Obtener métricas de supervivencia |
| `GET` | `/api/aas/score/:artistId` | Survival Score actual |
| `GET` | `/api/aas/plan/:artistId/today` | Plan del día actual |
| `GET` | `/api/aas/log/:artistId` | Historial de acciones |

### Deal Pipeline

| Method | Endpoint | Función |
|---|---|---|
| `GET` | `/api/aas/deals/:artistId` | Lista de deals con filtros |
| `POST` | `/api/aas/deals` | Crear deal manualmente |
| `PATCH` | `/api/aas/deals/:dealId/stage` | Avanzar stage |
| `POST` | `/api/aas/deals/:dealId/send-proposal` | Generar y enviar propuesta |
| `POST` | `/api/aas/deals/:dealId/approve` | Aprobación humana |
| `GET` | `/api/aas/deals/:artistId/pipeline` | Vista de pipeline completo |

### Finance

| Method | Endpoint | Función |
|---|---|---|
| `GET` | `/api/aas/finance/:artistId/snapshot` | Snapshot financiero |
| `GET` | `/api/aas/finance/:artistId/runway` | Runway calculation |
| `GET` | `/api/aas/finance/:artistId/revenue-attribution` | Revenue por canal |
| `GET` | `/api/aas/finance/:artistId/unit-economics` | CAC, LTV, ROAS |

### Approvals (Human-in-the-loop)

| Method | Endpoint | Función |
|---|---|---|
| `GET` | `/api/aas/approvals/:artistId/pending` | Acciones esperando aprobación |
| `POST` | `/api/aas/approvals/:id/approve` | Aprobar acción |
| `POST` | `/api/aas/approvals/:id/reject` | Rechazar acción |

---

## ARCHIVOS A CREAR (Orden de implementación)

### Fase 1 — Fundaciones

```
server/services/aas/
├── types.ts                          # Interfaces compartidas
├── survival-score.ts                 # Cálculo del Survival Score
├── daily-cycle.ts                    # Loop central diario
└── scheduler.ts                      # Cron scheduling

server/agents/aas/
├── survival-strategist.ts            # Agente 1: Director estratégico
├── revenue-operator.ts               # Agente 2: Monetización
├── deal-closer.ts                    # Agente 3: Deals
├── growth-operator.ts                # Agente 4: Crecimiento
├── community-operator.ts             # Agente 5: Comunidad
├── risk-compliance.ts                # Agente 6: Compliance
└── finance-controller.ts             # Agente 7: Finanzas

server/routes/
├── aas-core.ts                       # Endpoints AAS principales
├── aas-deals.ts                      # Pipeline de deals
├── aas-finance.ts                    # Endpoints financieros
└── aas-approvals.ts                  # Human approval workflow

client/src/pages/
├── artist-survival-dashboard.tsx     # Dashboard principal
├── artist-deal-pipeline.tsx          # Vista de pipeline
└── artist-finance-dashboard.tsx      # Dashboard financiero

client/src/components/aas/
├── survival-score-widget.tsx         # Score display
├── daily-plan-widget.tsx             # Plan del día
├── pipeline-kanban.tsx               # Pipeline visual
├── revenue-breakdown.tsx             # Revenue charts
├── strategic-insights.tsx            # Memory insights
└── approval-queue.tsx                # Pending approvals
```

### Tablas nuevas en `shared/schema.ts`:

```
artist_survival_profile     # Identidad + config
survival_metrics            # Scoring periódico
deal_pipeline               # CRM unificado
daily_action_log            # Registro de ejecución
artist_strategic_memory     # Insights de largo plazo
aas_approval_queue          # Acciones pendientes de aprobación humana
```

---

## DEPENDENCIAS NUEVAS NECESARIAS

```json
{
  "node-cron": "^3.0.3",           // Scheduling del ciclo diario
  "@anthropic-ai/sdk": "^0.39.0"   // Claude Opus 4.6 (si no está ya)
}
```

**Todo lo demás ya está instalado:** Stripe, Firebase Admin, Drizzle ORM, FAL AI, Gemini, OpenAI, Brevo, Resend, Apify, etc.

---

## ROADMAP DE IMPLEMENTACIÓN

```
FASE 1 (Sem 1-3): FUNDACIONES
├── [1.1] Schema: artist_survival_profile + migration
├── [1.2] Schema: survival_metrics + deal_pipeline + daily_action_log + strategic_memory
├── [1.3] Service: survival-score.ts (cálculo del score)
├── [1.4] Service: types.ts (interfaces compartidas)
├── [1.5] Route: aas-core.ts (activate, profile CRUD, score)
├── [1.6] Integrar datos existentes (wallet, sales, metrics) en snapshot
│
FASE 2 (Sem 3-6): AGENTES DE SUPERVIVENCIA
├── [2.1] SurvivalStrategist (Claude Opus 4.6 como cerebro)
├── [2.2] FinanceController (wrap EconomyAgent + wallet data)
├── [2.3] RevenueOperator (wrap merch + stripe + subscriptions)
├── [2.4] DealCloser (wrap outreach + sponsors + venues + investors)
├── [2.5] GrowthOperator (wrap social + audience + trending)
├── [2.6] CommunityOperator (wrap polls + challenges + crowdfunding)
├── [2.7] RiskComplianceAgent (wrap copyright + moderation + rules)
│
FASE 3 (Sem 6-8): LOOP CENTRAL
├── [3.1] daily-cycle.ts (6-phase execution)
├── [3.2] scheduler.ts (cron integration)
├── [3.3] Integrar con orchestrator.ts existente
├── [3.4] aas-approvals.ts (human-in-the-loop)
│
FASE 4 (Sem 8-10): DASHBOARD
├── [4.1] artist-survival-dashboard.tsx
├── [4.2] Survival Score widget
├── [4.3] Pipeline Kanban
├── [4.4] Revenue breakdown charts
├── [4.5] Daily plan + action log viewer
│
FASE 5 (Sem 10-12): MONETIZACIÓN MULTICAPA
├── [5.1] Auto-merch drops pipeline
├── [5.2] Membership automation
├── [5.3] Sync/licensing outreach automation
├── [5.4] Token utility deployment automation
│
FASE 6 (Sem 12-16): NEGOCIACIÓN ASISTIDA
├── [6.1] Deal negotiation with Claude Opus 4.6
├── [6.2] Counterparty scoring
├── [6.3] Contract draft generation
├── [6.4] Deal simulation engine
│
FASE 7 (Sem 16-20): MULTI-ARTISTA
├── [7.1] Scale daily cycle to N artists
├── [7.2] Cross-artist collaboration matching
├── [7.3] Portfolio-level financial dashboard
├── [7.4] Shared resource optimization
```

---

## RESUMEN EJECUTIVO

| Dimensión | Lo que ya tenemos | Lo que falta |
|---|---|---|
| **Agentes** | 25 agentes + orchestrator + tick system | 7 agentes AAS wrapper + daily cycle |
| **Identidad** | PersonalityAgent + mood + traits | Perfil de supervivencia persistente |
| **Memoria** | MemoryAgent con short/long-term | Memoria estratégica de negocio |
| **Monetización** | Stripe + Printful + Tokens + Crowdfunding | Orquestación automática multicapa |
| **Deals** | Outreach + Sponsors + Venues + Investors | Pipeline unificado + scoring + negotiation |
| **Growth** | Social + IG/YT extensions + Apify | Calendario editorial autónomo |
| **Finanzas** | Wallet + Sales + Transactions | Survival Score + burn rate + runway |
| **Compliance** | Copyright Registry + Content Moderation | Policy engine + approval workflow |
| **Dashboard** | Analytics page + marketing metrics | Survival dashboard dedicado |

**80% de la infraestructura ya existe.** El AAS Engine es una **capa de orquestación inteligente** sobre servicios existentes, no un sistema desde cero.

La fórmula central:

```
Survival Score = (RevenueHealth + PipelineStrength + AudienceMomentum + BrandRelevance + DealVelocity)
               - (BurnRate + LegalRisk + Churn + ContentFatigue)
```

Ese score decide qué hace cada agente cada día. **Esa es la diferencia entre un artista que publica y un artista que sobrevive.**
