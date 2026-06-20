# Marketing Skills Integration — Implementation Document

> **Proyecto**: Boostify Music Platform  
> **Integración**: `coreyhaines31/marketingskills` → módulos existentes del Artist Profile  
> **Fecha**: 2025  
> **Estado**: ✅ Completamente implementado y migración ejecutada

---

## 1. Resumen Ejecutivo

Se integró el repositorio `coreyhaines31/marketingskills` —una colección de 40 archivos de instrucciones de marketing especializadas— directamente en los módulos existentes del Artist Profile de Boostify Music, enriqueciendo las llamadas a IA con contexto de marketing de alta calidad sin crear ningún módulo nuevo.

**Principio fundamental**: no se creó ningún módulo nuevo. Todo se inyectó silenciosamente en los servicios y rutas ya existentes, mejorando la calidad de las respuestas de IA de forma transparente.

---

## 2. Arquitectura de la Integración

```
.agents/marketingskills/skills/{skill-name}/SKILL.md
              │
              ▼
server/services/marketing-skills-loader.ts
  (lee archivos del disco, elimina frontmatter YAML, cachea en memoria)
              │
              ▼
server/utils/ai-skills-injector.ts
  (mapea módulos → skills, construye prompts enriquecidos)
              │
       ┌──────┴────────────────────────────────┐
       │                                       │
       ▼                                       ▼
server/services/                       server/services/
artist-marketing-context.ts            (todos los módulos AI)
  (contexto personalizado por         social-media-service.ts
   artista desde la BD)               news-generator.ts
              │                       improved-promo-generator.ts
              ▼                       ads-campaigns.ts
DB: artist_marketing_context          business-plan-full-generator.ts
    (tabla PostgreSQL nueva)          artist-blueprint-generator.ts
                                      ai-proposal-generator.ts
                                      influencer-script-service.ts
                                      epk.ts, audience-capture.ts
                                      emotional-studio.ts
                                      gamma-presentations.ts
                                      base-agent.ts (gateway)
              │
              ▼
server/routes/marketing-context.ts
  (API REST para gestionar el contexto)
```

### Tres niveles de inyección

| Función | Tipo | Cuando usar |
|---------|------|-------------|
| `buildEnrichedSystemPrompt(module, base, userId?)` | async | Request handlers con userId disponible; añade skills + contexto de artista de la BD |
| `buildGatewayAgentPrompt(agent, base, userId?)` | async | Agentes del gateway; mismo patrón pero con mapeo de agentes |
| `buildSkillsOnlyPrompt(module, base)` | sync | Constantes de módulo, código sin userId; añade solo skills |

---

## 3. Archivos Nuevos Creados

### `.agents/marketingskills/` (git submodule)
- **Qué es**: Submodulo git del repositorio `coreyhaines31/marketingskills`
- **Contenido**: 40 directorios de skills, cada uno con `SKILL.md`
- **Ruta**: `.agents/marketingskills/skills/{skill-name}/SKILL.md`
- **Cómo agregar**: `git submodule add https://github.com/coreyhaines31/marketingskills.git .agents/marketingskills`

---

### `server/services/marketing-skills-loader.ts`
- **Propósito**: Lee los archivos SKILL.md del disco, elimina frontmatter YAML, cachea en memoria
- **Exports principales**:
  - `loadSkill(name)` → string | null  
  - `loadSkills(...names)` → string[]  
  - `listAvailableSkills()` → string[]
  - `MarketingSkillName` — tipo union de los 40 nombres de skills

---

### `server/utils/ai-skills-injector.ts`
- **Propósito**: Pieza central. Mapea cada módulo de Boostify a skills relevantes y construye prompts enriquecidos
- **MODULE_SKILLS mapping**: 21 módulos → arrays de skills
- **GATEWAY_AGENT_SKILLS mapping**: 9 agentes del gateway → arrays de skills
- **Exports**: `buildEnrichedSystemPrompt`, `buildGatewayAgentPrompt`, `buildSkillsOnlyPrompt`, tipos `BoostifyModule`, `GatewayAgent`

---

### `server/services/artist-marketing-context.ts`
- **Propósito**: Lee, genera y persiste contexto de marketing específico del artista desde su perfil
- **Exports principales**:
  - `getArtistMarketingContext(userId)` → contexto desde BD
  - `generateArtistMarketingContext(userId)` → genera via IA y persiste
  - `getOrGenerateContext(userId)` → punto de entrada principal (auto-genera en primer uso)
- **Fuentes de datos**: tabla `users` (nombre, bio, género, redes), tabla `songs` (lanzamientos recientes)
- **Destino**: tabla `artist_marketing_context`

---

### `server/routes/marketing-context.ts`
- **Propósito**: API REST para gestionar el contexto de marketing y consultar skills
- **Endpoints**:
  - `GET /api/marketing-context/:userId` — obtener contexto almacenado
  - `POST /api/marketing-context/:userId/generate` — (re)generar contexto
  - `PUT /api/marketing-context/:userId` — actualización manual de campos
  - `GET /api/marketing-context/skills/list` — listar todas las skills disponibles
  - `GET /api/marketing-context/skills/:skillName` — contenido de una skill específica

---

### `add-artist-marketing-context.mjs`
- **Propósito**: Script de migración para crear la tabla `artist_marketing_context` en PostgreSQL
- **Estado**: ✅ Ejecutado — tabla e índice creados en Neon DB
- **Ejecución**: `node add-artist-marketing-context.mjs` (requiere `DATABASE_URL`)

---

### `db/schema.ts` (modificado — final del archivo)
Nueva tabla Drizzle ORM añadida:

```typescript
export const artistMarketingContext = pgTable('artist_marketing_context', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  artistName: text('artist_name'),
  genre: text('genre').array(),
  subgenre: text('subgenre'),
  targetAudience: text('target_audience'),
  brandVoice: text('brand_voice'),
  usp: text('usp'),
  positioning: text('positioning'),
  primaryGoals: text('primary_goals').array(),
  socialChannels: jsonb('social_channels'),
  keyReleases: jsonb('key_releases'),
  contentPillars: text('content_pillars').array(),
  similarArtists: text('similar_artists').array(),
  differentiators: text('differentiators').array(),
  contextMd: text('context_md'),          // markdown completo del contexto
  lastGeneratedAt: timestamp('last_generated_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

---

## 4. Módulos Mejorados — Detalle Completo

### 4.1 Social Hub
- **Archivo modificado**: `server/services/social-media-service.ts`
- **Función afectada**: `generateSocialMediaContent()`
- **Skills inyectadas**: `social`, `copywriting`, `content-strategy`
- **Tipo de inyección**: `buildEnrichedSystemPrompt` (async, con userId)
- **Mejora**: Los posts generados siguen la estrategia de contenido del artista, voz de marca y técnicas de copywriting probadas. Considera el contexto del artista para tono y audiencia.

---

### 4.2 News / PR
- **Archivo modificado**: `server/services/news-generator.ts`
- **Función afectada**: `generateArticleText()`
- **Skills inyectadas**: `copywriting`, `copy-editing`, `content-strategy`
- **Tipo de inyección**: `buildSkillsOnlyPrompt` (sync)
- **Mejora**: Los artículos de noticias tienen estructura editorial profesional, jerarquía de titulares optimizada y lenguaje de PR de calidad.

---

### 4.3 Promo Clips
- **Archivo modificado**: `server/services/improved-promo-generator.ts`
- **Constante afectada**: `SYS_CONCEPT_IMPROVED`
- **Skills inyectadas**: `social`, `ad-creative`, `video`, `copywriting`
- **Tipo de inyección**: `buildSkillsOnlyPrompt` (sync, nivel módulo)
- **Mejora**: Los conceptos de clips promocionales incorporan técnicas de creatividad publicitaria, hooks de video para redes sociales y copy optimizado para cada plataforma.

---

### 4.4 Ads Campaigns
- **Archivo modificado**: `server/routes/ads-campaigns.ts`
- **Endpoint afectado**: `POST /:artistId/generate-copy`
- **Skills inyectadas**: `ads`, `ad-creative`, `cro`, `ab-testing`
- **Tipo de inyección**: `buildEnrichedSystemPrompt` (async, con userId)
- **Mejora**: El copy de anuncios usa frameworks de CRO, principios de A/B testing, y técnicas de creative publicitario validadas. El contexto del artista permite personalización real.

---

### 4.5 Business Plan
- **Archivo modificado**: `server/services/business-plan-full-generator.ts`
- **Función afectada**: `generateFullBusinessPlan()`
- **Skills inyectadas**: `pricing`, `launch`, `revops`, `sales-enablement`
- **Tipo de inyección**: `buildEnrichedSystemPrompt` (async, con artistId)
- **Mejora**: Los planes de negocio incluyen estrategias de pricing basadas en valor, playbooks de lanzamiento y frameworks de revenue operations reales.

---

### 4.6 Artist Blueprint (Superstar Blueprint)
- **Archivo modificado**: `server/services/artist-blueprint-generator.ts`
- **Skills inyectadas**: `product-marketing`, `marketing-psychology`, `content-strategy`
- **Tipo de inyección**: `buildEnrichedSystemPrompt` (async, con artistId)
- **Mejora**: Los blueprints incorporan psicología de marketing para construir autoridad y posicionamiento, y frameworks de product marketing para escalar la carrera artística.

---

### 4.7 Sponsors / Brand Proposals
- **Archivo modificado**: `server/services/ai-proposal-generator.ts`
- **Función afectada**: `generateAIProposal()`
- **Skills inyectadas**: `cold-email`, `sales-enablement`, `revops`
- **Tipo de inyección**: `buildSkillsOnlyPrompt` (sync)
- **Mejora**: Las propuestas a sponsors usan técnicas de cold outreach probadas, frameworks de sales enablement y estructura de revenue operations para maximizar la tasa de cierre.

---

### 4.8 Electronic Press Kit (EPK)
- **Archivo modificado**: `server/routes/epk.ts`
- **Skills inyectadas**: `sales-enablement`, `copywriting`
- **Tipo de inyección**: `buildSkillsOnlyPrompt` (sync)
- **Mejora**: Los EPKs tienen copy más persuasivo, estructura orientada a conversión y los elementos que los booking managers y promotores realmente buscan.

---

### 4.9 Audience Capture (Fan Email Leads)
- **Archivo modificado**: `server/routes/audience-capture.ts`
- **Endpoint afectado**: setup auto-AI
- **Skills inyectadas**: `cro`, `lead-magnets`, `emails`, `popups`
- **Tipo de inyección**: `buildEnrichedSystemPrompt` (async, con userId)
- **Mejora**: Las estrategias de captura de fans usan mejores prácticas de lead magnets, optimización de formularios (CRO) y secuencias de email de activación.

---

### 4.10 Emotional Studio
- **Archivo modificado**: `server/routes/emotional-studio.ts`
- **Endpoints afectados**: `analyze-visual`, `pain-to-art`
- **Skills inyectadas**: `marketing-psychology`, `copywriting`
- **Tipo de inyección**: `buildSkillsOnlyPrompt` (sync)
- **Mejora**: Los análisis visuales y la transformación de dolor en arte incorporan psicología del consumidor y técnicas de storytelling emocional para crear conexión más profunda.

---

### 4.11 Gamma Presentations
- **Archivo modificado**: `server/routes/gamma-presentations.ts`
- **Función afectada**: `enrichPromptWithGPT()`
- **Skills inyectadas**: `sales-enablement`, `copywriting`
- **Tipo de inyección**: `buildSkillsOnlyPrompt` (sync)
- **Mejora**: Las presentaciones generadas para inversores y partners usan estructura de pitch profesional y narrativa persuasiva de ventas.

---

### 4.12 Influencer Module
- **Archivo modificado**: `server/services/influencer-script-service.ts`
- **Función afectada**: `generateScript()`
- **Skills inyectadas**: `co-marketing`, `referrals`, `lead-magnets`
- **Tipo de inyección**: `buildSkillsOnlyPrompt` (sync)
- **Mejora**: Los scripts para influencers incorporan principios de co-marketing, mecanismos de referral y diseño de lead magnets para maximizar el alcance de las campañas.

---

### 4.13 Artist Gateway Agents (TODOS los 9 agentes)
- **Archivo modificado**: `server/services/gateway-agents/base-agent.ts`
- **Método afectado**: `processMessage()`
- **Agentes mejorados**: manager, booking, licensing, brand-deals, collaboration, fan-relations, press, legal-guard, finance
- **Skills por agente**:

| Agente | Skills Inyectadas |
|--------|-------------------|
| manager | `launch`, `marketing-ideas` |
| booking | `cold-email`, `revops` |
| licensing | `sales-enablement`, `pricing` |
| brand-deals | `cold-email`, `sales-enablement`, `co-marketing` |
| collaboration | `co-marketing`, `copywriting` |
| fan-relations | `emails`, `churn-prevention`, `community-marketing` |
| press | `copywriting`, `copy-editing`, `sales-enablement` |
| legal-guard | `revops` |
| finance | `pricing`, `revops` |

- **Tipo de inyección**: `buildGatewayAgentPrompt` (async, con artistId)
- **Mejora**: Cada agente del gateway opera ahora con conocimiento especializado de su dominio. El agente de booking sabe cómo hacer outreach de cold email. El de fan-relations conoce técnicas de churn prevention. El de finanzas entiende pricing strategy. Todos usan el contexto personalizado del artista.

---

## 5. Mapeo Completo Módulos → Skills

| Módulo Boostify | Skills del Repositorio |
|-----------------|------------------------|
| `social-hub` | social, copywriting, content-strategy |
| `promo-clips` | social, ad-creative, video, copywriting |
| `ads-campaigns` | ads, ad-creative, cro, ab-testing |
| `observation-engine` | analytics, competitor-profiling, customer-research |
| `deep-brief` | customer-research, competitor-profiling, product-marketing, marketing-psychology |
| `career-suite` | launch, pricing, marketing-ideas, marketing-psychology |
| `artist-blueprint` | product-marketing, marketing-psychology, content-strategy |
| `business-plan` | pricing, launch, revops, sales-enablement |
| `sponsors` | cold-email, sales-enablement, revops |
| `agent-gateway` | cold-email, sales-enablement, co-marketing |
| `news` | copywriting, copy-editing, content-strategy |
| `hermes-agent` | product-marketing |
| `influencer-module` | co-marketing, referrals, lead-magnets |
| `audience-capture` | cro, lead-magnets, emails, popups |
| `renaissance-studio` | copywriting, image, content-strategy |
| `emotional-studio` | marketing-psychology, copywriting |
| `aas-engine` | marketing-ideas, marketing-psychology, product-marketing |
| `brand-collabs` | co-marketing, sales-enablement, pricing |
| `viral-products` | marketing-ideas, pricing, free-tools |
| `electronic-press-kit` | sales-enablement, copywriting |
| `gamma-presentations` | sales-enablement, copywriting |

---

## 6. Catálogo Completo de Skills (40 skills)

| Skill | Dominio | Descripción |
|-------|---------|-------------|
| `ab-testing` | Growth | Diseño y análisis de experimentos A/B para optimizar conversión |
| `ad-creative` | Advertising | Creación de creatividades publicitarias de alto impacto |
| `ads` | Advertising | Estrategia y gestión de campañas de pago (Meta, Google, TikTok) |
| `ai-seo` | SEO | SEO asistido por IA, generación de contenido optimizado |
| `analytics` | Data | Análisis de métricas, dashboards y toma de decisiones basada en datos |
| `aso` | Mobile | App Store Optimization para visibilidad en tiendas de apps |
| `churn-prevention` | Retention | Estrategias para reducir la pérdida de usuarios/fans |
| `cold-email` | Outreach | Secuencias de email frío de alta tasa de respuesta |
| `co-marketing` | Partnerships | Colaboraciones de marketing para amplificar alcance |
| `community-marketing` | Community | Construcción y activación de comunidades de marca |
| `competitor-profiling` | Research | Análisis profundo de competidores y posicionamiento |
| `competitors` | Research | Monitoreo competitivo y benchmarking |
| `content-strategy` | Content | Estrategia de contenido para crecimiento orgánico |
| `copy-editing` | Copy | Edición y mejora de textos para calidad editorial |
| `copywriting` | Copy | Escritura persuasiva que convierte |
| `cro` | Conversion | Optimización de la tasa de conversión en landing pages y flows |
| `customer-research` | Research | Investigación de usuarios: entrevistas, surveys, análisis |
| `directory-submissions` | SEO | Envío a directorios para backlinks y visibilidad |
| `emails` | Email Marketing | Campañas de email: nurture, activación, retención |
| `free-tools` | Growth | Creación de herramientas gratuitas como canal de adquisición |
| `image` | Visual | Estrategia de imagen de marca y assets visuales |
| `launch` | Growth | Playbooks de lanzamiento de productos/canciones/proyectos |
| `lead-magnets` | Growth | Diseño de lead magnets para captura de emails y datos |
| `marketing-ideas` | Ideation | Generación de ideas creativas de marketing |
| `marketing-psychology` | Psychology | Aplicación de psicología del comportamiento al marketing |
| `onboarding` | Product | Flujos de onboarding para activar nuevos usuarios |
| `paywalls` | Monetization | Diseño de paywalls que maximizan conversión a pago |
| `popups` | CRO | Popups y overlays de alta conversión (timing, copy, design) |
| `pricing` | Monetization | Estrategia de precios basada en valor y psicología |
| `product-marketing` | PMM | Posicionamiento, messaging y go-to-market |
| `programmatic-seo` | SEO | SEO programático para escalar contenido a miles de páginas |
| `referrals` | Growth | Programas de referidos para crecimiento viral |
| `revops` | Revenue | Revenue Operations: procesos, pipelines y forecasting |
| `sales-enablement` | Sales | Materiales y procesos para empoderar al equipo de ventas |
| `schema` | SEO | Structured data / schema markup para rich snippets |
| `seo-audit` | SEO | Auditoría técnica de SEO |
| `signup` | CRO | Optimización del flujo de registro para maximizar signups |
| `site-architecture` | SEO/UX | Arquitectura de sitio para SEO y experiencia de usuario |
| `sms` | Marketing | Estrategias de SMS marketing para alta apertura |
| `social` | Social Media | Estrategia de redes sociales, algoritmos, engagement |
| `video` | Video | Estrategia de contenido en video para plataformas sociales |

---

## 7. Base de Datos

### Tabla: `artist_marketing_context`

```sql
CREATE TABLE artist_marketing_context (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  artist_name       TEXT,
  genre             TEXT[],
  subgenre          TEXT,
  target_audience   TEXT,
  brand_voice       TEXT,
  usp               TEXT,                      -- Propuesta de Valor Única
  positioning       TEXT,
  primary_goals     TEXT[],
  social_channels   JSONB,                     -- { platform: followerCount }
  key_releases      JSONB,                     -- últimos lanzamientos
  content_pillars   TEXT[],
  similar_artists   TEXT[],
  differentiators   TEXT[],
  context_md        TEXT,                      -- markdown completo del contexto
  last_generated_at TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_marketing_ctx_user ON artist_marketing_context(user_id);
```

### Flujo de generación

1. En el primer uso de un módulo con `buildEnrichedSystemPrompt()`, se llama `getOrGenerateContext(userId)`
2. Si no existe contexto, `generateArtistMarketingContext()` lee el perfil del artista y llama a la IA para generar el contexto estructurado
3. El contexto se persiste en `artist_marketing_context` y se añade al system prompt como sección `## ARTIST CONTEXT`
4. En usos posteriores, el contexto se lee directamente de la BD (caché de ~24h)

---

## 8. API de Marketing Context

### Endpoints disponibles

```
GET    /api/marketing-context/:userId
POST   /api/marketing-context/:userId/generate
PUT    /api/marketing-context/:userId
GET    /api/marketing-context/skills/list
GET    /api/marketing-context/skills/:skillName
```

### Ejemplo de uso (frontend)

```typescript
// Obtener contexto del artista
const res = await fetch(`/api/marketing-context/${userId}`);
const { context } = await res.json();

// (Re)generar contexto
const res = await fetch(`/api/marketing-context/${userId}/generate`, { method: 'POST' });
const { contextMd } = await res.json();

// Actualizar campos manualmente
await fetch(`/api/marketing-context/${userId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    brandVoice: 'Auténtico, urbano, con actitud',
    usp: 'El primer artista de reggaeton experimental de Buenos Aires',
    targetAudience: 'Millennials latinos, 22-35 años'
  })
});

// Listar skills disponibles
const { skills } = await (await fetch('/api/marketing-context/skills/list')).json();
```

---

## 9. Gestión del Submodulo Git

```bash
# Clonar el repo con el submodulo incluido
git clone --recurse-submodules <repo-url>

# Si ya tienes el repo clonado sin el submodulo
git submodule update --init --recursive

# Actualizar el submodulo a la última versión de marketingskills
git submodule update --remote .agents/marketingskills

# Ver estado del submodulo
git submodule status
```

---

## 10. Cómo Añadir Nuevas Skills a un Módulo

1. Identificar el módulo en `MODULE_SKILLS` dentro de `server/utils/ai-skills-injector.ts`
2. Añadir el nombre de la skill al array del módulo
3. Verificar que el SKILL.md existe en `.agents/marketingskills/skills/{nombre}/SKILL.md`
4. La skill se cargará automáticamente en el siguiente ciclo de vida del servidor

```typescript
// Ejemplo: añadir 'pricing' al módulo 'electronic-press-kit'
export const MODULE_SKILLS: Record<BoostifyModule, MarketingSkillName[]> = {
  // ...
  'electronic-press-kit': ['sales-enablement', 'copywriting', 'pricing'], // ← añadido
  // ...
};
```

---

## 11. Consideraciones de Rendimiento

- **Cache de skills**: Los archivos SKILL.md se leen una sola vez del disco y se cachean en memoria. El cache se invalida solo si se llama `clearSkillCache()` explícitamente.
- **Cache de contexto de artista**: El contexto se regenera máximo una vez cada 24 horas. Reads posteriores van directamente a la BD (tabla con índice en `user_id`).
- **Fallo silencioso**: Si `buildEnrichedSystemPrompt()` falla (no hay skills, error de BD), devuelve el `baseSystemPrompt` original sin modificar. Los módulos nunca se rompen por la integración.
- **Tokens extra**: Cada skill añade ~200-800 tokens al system prompt. Con el mapeo actual, la mayoría de módulos añaden 2-4 skills = ~400-2000 tokens extra por llamada. Está dentro de los límites de todos los modelos en uso.

---

## 12. Impacto por Área

| Área | Módulos Mejorados | Impacto Principal |
|------|-------------------|-------------------|
| **Contenido Social** | Social Hub, Promo Clips, News | Calidad editorial y engagement |
| **Monetización** | Sponsors, Business Plan, Pricing | Tasa de cierre y revenue |
| **Crecimiento** | Audience Capture, Influencer Module | Conversión y adquisición |
| **Branding** | EPK, Artist Blueprint, Gamma Presentations | Posicionamiento y percepción |
| **Agentes IA** | Los 9 agentes del Gateway | Especialización por rol |
| **Creatividad** | Emotional Studio, Promo Clips | Conexión emocional y viralidad |
| **Publicidad** | Ads Campaigns | ROAS y calidad de creative |

---

*Documento generado automáticamente al finalizar la implementación. Para preguntas técnicas, consultar los archivos fuente en `server/utils/ai-skills-injector.ts` y `server/services/marketing-skills-loader.ts`.*
