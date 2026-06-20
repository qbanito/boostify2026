# 🎯 BOOSTIFY YouTube Chrome Extension — Architecture Plan

## OBJETIVO
Conectar los 12 tabs del YouTube Tools (`/youtube-views`) a una Chrome Extension que interactúe directamente con el canal de YouTube del artista, manteniendo todas las herramientas perfectamente sincronizadas y activas en tiempo real.

---

## 📐 ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BOOSTIFY PLATFORM (Web App)                      │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │
│  │ youtube-views│  │ youtube-store│  │ ecosystem-dashboard    │    │
│  │ (12 tabs)    │  │ (Firestore)  │  │ (metrics display)     │    │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘    │
│         │                 │                      │                  │
│  ┌──────▼─────────────────▼──────────────────────▼──────────────┐  │
│  │              BOOSTIFY API (Express Server :3000)              │  │
│  │                                                               │  │
│  │  /api/youtube/*          (16 endpoints existentes)            │  │
│  │  /api/youtube-ext/*      (🆕 6 endpoints para extensión)      │  │
│  │  /api/youtube-ext/ws     (🆕 WebSocket para sync real-time)   │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   CHROME EXTENSION │
                    │                    │
                    │  ┌──────────────┐  │
                    │  │ Background   │  │  ← Service Worker permanente
                    │  │ Service      │  │  ← Heartbeat + sync cada 5min
                    │  │ Worker       │  │  ← Queue de acciones pendientes
                    │  └──────┬───────┘  │
                    │         │          │
                    │  ┌──────▼───────┐  │
                    │  │ Content      │  │  ← Se inyecta en youtube.com/*
                    │  │ Scripts      │  │  ← Lee métricas del Studio
                    │  │              │  │  ← Ejecuta acciones (SEO, etc)
                    │  └──────┬───────┘  │
                    │         │          │
                    │  ┌──────▼───────┐  │
                    │  │ Popup UI     │  │  ← Mini dashboard
                    │  │ (React)      │  │  ← Estado de sync
                    │  └──────────────┘  │
                    │                    │
                    │  ┌──────────────┐  │
                    │  │ Side Panel   │  │  ← Panel lateral en YouTube
                    │  │ (React)      │  │  ← Muestra Boostify tools inline
                    │  └──────────────┘  │
                    └────────────────────┘
```

---

## 🧩 COMPONENTES DE LA CHROME EXTENSION

### 1. Background Service Worker (`background.ts`)
El cerebro de la extensión. Se ejecuta permanentemente, sin necesidad de que YouTube esté abierto.

```
Responsabilidades:
├── 🔐 Auth Sync: Almacena JWT token de Boostify (chrome.storage.session)
├── ⏰ Cron Jobs:
│   ├── Cada 5 min → sync channel stats (views, subs, recent uploads)
│   ├── Cada 1 hora → fetch optimization suggestions from Boostify API
│   └── Cada 24 hrs → full channel audit (competitor + trends)
├── 📡 WebSocket Client:
│   └── Conecta a /api/youtube-ext/ws para recibir push notifications
│       (ej: "Nuevo trend detectado", "Optimization ready")
├── 📋 Action Queue:
│   └── Cola de acciones programadas por Boostify
│       (ej: actualizar título, cambiar tags, publicar video)
└── 🔔 Notifications:
    └── Chrome notifications para alertas (trend spike, ranking drop)
```

### 2. Content Scripts (`content-youtube-studio.ts`, `content-youtube.ts`)
Se inyectan directamente en las páginas de YouTube.

#### `content-youtube.ts` → Se inyecta en `youtube.com/*`
```
Extrae:
├── Canal actualmente visible (nombre, ID, subscribers)
├── Datos del video actual (título, descripción, tags, views, likes)
├── Comentarios recientes (sentimiento, engagement rate)
├── Thumbnails de los videos del canal
└── Posición en trending/search results

Inyecta:
├── 🏷️ Boostify Badge: Overlay con score del video
├── 📊 Quick Stats Panel: Mini panel lateral con métricas Boostify
├── 💡 SEO Suggestions: Tooltip con sugerencias de optimización
└── 🔗 "Analyze in Boostify" button junto a cada video
```

#### `content-youtube-studio.ts` → Se inyecta en `studio.youtube.com/*`
```
Extrae (del YouTube Studio del artista):
├── Analytics en tiempo real (views, watch time, CTR)
├── Revenue data (si es monetizado)
├── Audience demographics
├── Traffic sources
├── Video performance comparisons
├── Scheduled/draft videos
└── Comments pending review

Inyecta:
├── 🎯 Boostify Sidebar: Panel completo de herramientas
├── 📝 Auto-fill buttons: "Apply Boostify Title/Tags/Description"
├── 📅 Calendar Integration: Muestra el content calendar de Boostify
├── ⚡ One-click Optimize: Botón para aplicar todas las recomendaciones
└── 📊 A/B Test Launcher: Compara thumbnails/títulos directamente
```

### 3. Popup UI (`popup.tsx` — React + Tailwind)
Aparece al hacer click en el icono de la extensión.

```
┌─────────────────────────────┐
│  🚀 BOOSTIFY YOUTUBE SYNC  │
│  ─────────────────────────  │
│                             │
│  Channel: @ArtistName       │
│  Status: 🟢 Connected       │
│  Last Sync: 2 min ago       │
│                             │
│  ┌─────────┐ ┌─────────┐   │
│  │ 12.5K   │ │ +340    │   │
│  │ Views   │ │ Today   │   │
│  │ Today   │ │ Subs    │   │
│  └─────────┘ └─────────┘   │
│                             │
│  📋 Pending Actions (3)     │
│  ├─ Update "Song X" title   │
│  ├─ Apply SEO tags (5 vids) │
│  └─ Publish scheduled post  │
│                             │
│  🔥 Alerts                  │
│  ├─ Trend: "Lo-fi hip hop"  │
│  └─ Video "Y" ranking ↓    │
│                             │
│  [Open Boostify Dashboard]  │
│  [Open YouTube Studio]      │
└─────────────────────────────┘
```

### 4. Side Panel (`sidepanel.tsx` — React)
Panel lateral que se abre dentro de YouTube Studio, mostrando las herramientas de Boostify en contexto.

```
Incluye versiones compactas de los 12 tabs:
├── Pre-Launch Score  → Se auto-llena con el video draft actual
├── Keywords          → Sugiere keywords para el video que estás editando
├── Title Analyzer    → Analiza el título actual vs alternativas
├── Content Ideas     → Ideas basadas en tu nicho + trends actuales
├── Thumbnail         → Genera thumbnails para el video actual
├── Competitor        → Muestra lo que hace tu competencia ahora
├── Trend Predictor   → Trends relevantes a tu canal
├── Transcript        → Transcripción del video actual
├── Multi-Channel     → Dashboard de todos tus canales
├── Content Calendar  → Tu calendario sincronizado
├── Auto-Optimization → Estado de las reglas activas
└── API Access        → Keys + usage stats
```

---

## 🔌 NUEVOS ENDPOINTS DE API (server side)

### Archivo: `server/routes/youtube-extension.ts`

| Endpoint | Method | Descripción |
|----------|--------|-------------|
| `/api/youtube-ext/connect` | POST | Registra la extensión. Recibe `extensionId`, `channelId`, `channelUrl`. Genera un `syncToken` JWT para la extensión. |
| `/api/youtube-ext/sync-stats` | POST | Recibe stats del canal extraídas por el content script: `{ views, subs, watchTime, topVideos[], recentUploads[] }`. Actualiza `users.youtubeChannel`, `marketingMetrics.youtubeViews`, `users.topYoutubeVideos` en PostgreSQL. |
| `/api/youtube-ext/pending-actions` | GET | Devuelve acciones pendientes generadas por los tools de Boostify (ej: nuevos títulos optimizados, tags SEO, calendario de publicación). |
| `/api/youtube-ext/action-result` | POST | Confirma que una acción fue ejecutada en YouTube (ej: "Título actualizado con éxito"). Actualiza estado en DB. |
| `/api/youtube-ext/live-metrics` | GET | SSE (Server-Sent Events) stream de métricas en tiempo real para el popup de la extensión. |
| `/api/youtube-ext/webhook` | POST | Recibe webhooks desde la extensión: eventos como "video publicado", "nuevo comentario", "suscriptor milestone". |

---

## 🗄️ NUEVAS TABLAS EN DB (`db/schema.ts`)

```typescript
// ---------- YouTube Extension Sync ----------

export const youtubeExtensionConnections = pgTable("youtube_extension_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  extensionId: text("extension_id").notNull(),        // Chrome extension instance ID
  channelId: text("channel_id").notNull(),             // YouTube channel ID (UC...)
  channelUrl: text("channel_url"),
  channelName: text("channel_name"),
  syncToken: text("sync_token").notNull(),             // JWT for auth
  status: text("status").default("active"),            // active | paused | revoked
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const youtubeChannelSnapshots = pgTable("youtube_channel_snapshots", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => youtubeExtensionConnections.id),
  subscribers: integer("subscribers"),
  totalViews: integer("total_views"),
  videoCount: integer("video_count"),
  watchTimeHours: real("watch_time_hours"),
  avgViewDuration: real("avg_view_duration"),
  topVideos: json("top_videos"),                       // [{videoId, title, views, ctr}]
  recentUploads: json("recent_uploads"),               // [{videoId, title, publishedAt, views}]
  trafficSources: json("traffic_sources"),             // {search: %, suggested: %, direct: %}
  demographics: json("demographics"),                  // {age: {}, gender: {}, geo: {}}
  snapshotAt: timestamp("snapshot_at").defaultNow(),
});

export const youtubePendingActions = pgTable("youtube_pending_actions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  connectionId: integer("connection_id").references(() => youtubeExtensionConnections.id),
  actionType: text("action_type").notNull(),           // update_title | update_tags | update_description
                                                        // update_thumbnail | schedule_video | publish_video
  targetVideoId: text("target_video_id"),              // YouTube video ID
  payload: json("payload").notNull(),                  // { newTitle: "...", newTags: [...] }
  status: text("status").default("pending"),           // pending | sent | applied | failed | cancelled
  generatedBy: text("generated_by"),                   // "pre-launch" | "auto-optimization" | "keyword-gen"
  priority: integer("priority").default(5),            // 1=urgent, 10=low
  createdAt: timestamp("created_at").defaultNow(),
  appliedAt: timestamp("applied_at"),
  resultMessage: text("result_message"),
});

export const youtubeExtensionEvents = pgTable("youtube_extension_events", {
  id: serial("id").primaryKey(),
  connectionId: integer("connection_id").references(() => youtubeExtensionConnections.id),
  eventType: text("event_type").notNull(),             // video_published | comment_received
                                                        // subscriber_milestone | ranking_change
                                                        // revenue_update | strike_received
  eventData: json("event_data"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

---

## 🔄 FLUJOS DE SINCRONIZACIÓN

### Flow 1: Conexión Inicial
```
User en Boostify                    Chrome Extension                 YouTube
────────────                        ────────────────                 ───────
1. Click "Connect Extension"
   → genera QR code / deep link
   con userId + sync token
                            ────►
                                    2. Extension abre popup
                                       → User confirma permisos
                                    3. Background worker envía
                                       POST /api/youtube-ext/connect
                                       { extensionId, channelId }
                            ◄────
4. API valida, crea
   youtubeExtensionConnections row
   → devuelve syncToken JWT
                            ────►
                                    5. Extension almacena token
                                       en chrome.storage.session
                                    6. Primer sync completo:
                                       Content script navega            ────►
                                       youtube.com/@channel             ◄────
                                       → Extrae stats
                                    7. POST /api/youtube-ext/sync-stats
                                       { subs, views, topVideos[] }
                            ◄────
8. Boostify actualiza:
   - users.youtubeChannel
   - marketingMetrics.youtubeViews
   - users.topYoutubeVideos
   - Crea primer snapshot
   → Devuelve pending actions
                            ────►
                                    9. Extension muestra
                                       "✅ Connected & Synced"
```

### Flow 2: Sync Periódico (cada 5 min)
```
Background Worker                   Boostify API                    PostgreSQL
────────────────                    ────────────                    ──────────
1. Alarm fires (5 min)
2. Content script extrae
   stats del tab de YouTube
   (si hay tab abierta) o
   usa YouTube Data API v3
3. POST /sync-stats
   { views, subs, etc }
                            ────►
                                    4. Compara con último
                                       snapshot                     ────►
                                    5. Si delta significativo:
                                       - Actualiza marketing
                                         metrics                    ◄────
                                       - Crea nuevo snapshot
                                       - Trigger auto-optimization
                                         si hay reglas activas
                                    6. Devuelve:
                                       { pendingActions[], alerts[] }
                            ◄────
7. Extension actualiza popup
   badge con # de actions
8. Muestra notifications
   si hay alertas urgentes
```

### Flow 3: Aplicar Optimización desde Boostify
```
User en Boostify                    API                     Extension                YouTube Studio
────────────                        ───                     ─────────                ──────────────
1. Genera keywords en
   "Keywords" tab para
   video "X"
2. Click "Apply to YouTube"
   → POST /youtube-ext/
     create-action
   { type: "update_tags",
     videoId: "abc123",
     payload: { tags: [...] } }
                            ────►
                                    3. Crea row en
                                       youtube_pending_actions
                                       status: "pending"
                                    4. Push via WebSocket
                                       → "new_action" event
                                                        ────►
                                                                5. Extension recibe
                                                                   action via WS
                                                                6. Navega a Studio
                                                                   → youtube.com/
                                                                     video/abc123/edit
                                                                7. Content script
                                                                   auto-fills tags         ────►
                                                                8. Waits for user         ◄────
                                                                   confirmation
                                                                   "Apply Changes?"
                                                                   [Yes] [Skip]
                                                                9. If Yes:
                                                                   → Clicks "Save"         ────►
                                                                10. POST /action-result    ◄────
                                                                    { actionId, status:
                                                                      "applied" }
                                                        ◄────
                                    11. Updates row
                                        status: "applied"
                            ◄────
12. UI shows ✅
    "Tags updated on YouTube!"
```

### Flow 4: Evento en YouTube → Notificación en Boostify
```
YouTube                     Extension Content Script         Boostify API            User
───────                     ────────────────────────         ────────────            ────
1. Artist pubblica
   nuevo video
                    ────►
                            2. Content script detecta
                               nuevo video en feed/studio
                            3. Extrae: { title, videoId,
                               thumbnail, publishedAt }
                            4. POST /webhook
                               { event: "video_published",
                                 data: {...} }
                                                    ────►
                                                             5. Crea event row
                                                             6. Trigger AI analysis:
                                                                - Pre-launch score
                                                                - SEO keywords
                                                                - Title alternatives
                                                                - Trending fit check
                                                             7. Crea pending_actions:
                                                                - "Optimize title"
                                                                - "Add SEO tags"
                                                                - "Generate thumbnail"
                                                             8. Push notification
                                                                via WebSocket
                                                                                    ────►
                                                                                           9. Chrome notif:
                                                                                              "New video detected!
                                                                                               Score: 7.2/10
                                                                                               3 optimizations
                                                                                               ready"
```

---

## 🗂️ ESTRUCTURA DE LA CHROME EXTENSION

```
boostify-youtube-extension/
├── manifest.json                      (Manifest V3)
├── package.json
├── tsconfig.json
├── vite.config.ts                     (Build con Vite + CRXJS)
│
├── src/
│   ├── background/
│   │   ├── index.ts                   ← Service Worker entry
│   │   ├── sync-manager.ts            ← Cron jobs, periodic sync
│   │   ├── websocket-client.ts        ← WS connection to Boostify
│   │   ├── action-queue.ts            ← Queue de acciones pendientes
│   │   └── notifications.ts           ← Chrome notifications
│   │
│   ├── content/
│   │   ├── youtube-public.ts          ← Inyectado en youtube.com/*
│   │   ├── youtube-studio.ts          ← Inyectado en studio.youtube.com/*
│   │   ├── extractors/
│   │   │   ├── channel-stats.ts       ← Extrae stats del canal
│   │   │   ├── video-data.ts          ← Extrae datos de un video
│   │   │   ├── analytics.ts           ← Extrae analytics del Studio
│   │   │   ├── comments.ts            ← Extrae comentarios
│   │   │   └── search-rank.ts         ← Posición en search results
│   │   ├── injectors/
│   │   │   ├── boostify-badge.ts      ← Overlay de score en videos
│   │   │   ├── seo-hints.ts           ← Tooltips con sugerencias
│   │   │   ├── auto-fill.ts           ← Auto-rellenar título/tags
│   │   │   └── sidebar-panel.ts       ← Panel lateral de Boostify
│   │   └── observers/
│   │       ├── page-change.ts         ← Detecta navegación SPA
│   │       ├── video-events.ts        ← Detecta nuevos videos/edits
│   │       └── studio-events.ts       ← Detecta cambios en Studio
│   │
│   ├── popup/
│   │   ├── App.tsx                    ← Popup principal (React)
│   │   ├── components/
│   │   │   ├── ConnectionStatus.tsx
│   │   │   ├── QuickStats.tsx
│   │   │   ├── PendingActions.tsx
│   │   │   ├── Alerts.tsx
│   │   │   └── SyncButton.tsx
│   │   └── hooks/
│   │       ├── useBoostifyAPI.ts
│   │       └── useChannelStats.ts
│   │
│   ├── sidepanel/
│   │   ├── App.tsx                    ← Side panel (React)
│   │   └── tabs/                      ← Mini versiones de los 12 tabs
│   │       ├── PreLaunchMini.tsx
│   │       ├── KeywordsMini.tsx
│   │       ├── TitleMini.tsx
│   │       ├── ContentIdeasMini.tsx
│   │       ├── ThumbnailMini.tsx
│   │       ├── CompetitorMini.tsx
│   │       ├── TrendsMini.tsx
│   │       ├── TranscriptMini.tsx
│   │       ├── ChannelsMini.tsx
│   │       ├── CalendarMini.tsx
│   │       ├── AutoOptMini.tsx
│   │       └── ApiAccessMini.tsx
│   │
│   ├── shared/
│   │   ├── api-client.ts             ← Fetch wrapper con auth
│   │   ├── storage.ts                ← chrome.storage helpers
│   │   ├── constants.ts
│   │   └── types.ts                  ← Tipos compartidos
│   │
│   └── assets/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
│
├── public/
│   ├── popup.html
│   └── sidepanel.html
│
└── tests/
    ├── background.test.ts
    ├── extractors.test.ts
    └── sync.test.ts
```

### `manifest.json` (Manifest V3)
```json
{
  "manifest_version": 3,
  "name": "Boostify YouTube Sync",
  "version": "1.0.0",
  "description": "Sync your YouTube channel with Boostify AI tools in real-time",
  "permissions": [
    "storage",
    "alarms",
    "notifications",
    "sidePanel",
    "activeTab",
    "tabs"
  ],
  "host_permissions": [
    "https://www.youtube.com/*",
    "https://studio.youtube.com/*",
    "https://boostify.replit.app/*",
    "https://your-production-domain.com/*"
  ],
  "background": {
    "service_worker": "src/background/index.ts",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/*"],
      "js": ["src/content/youtube-public.ts"],
      "css": ["src/content/styles/boostify-overlay.css"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://studio.youtube.com/*"],
      "js": ["src/content/youtube-studio.ts"],
      "css": ["src/content/styles/boostify-studio.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "public/popup.html",
    "default_icon": {
      "16": "src/assets/icon-16.png",
      "32": "src/assets/icon-32.png",
      "48": "src/assets/icon-48.png",
      "128": "src/assets/icon-128.png"
    }
  },
  "side_panel": {
    "default_path": "public/sidepanel.html"
  },
  "icons": {
    "16": "src/assets/icon-16.png",
    "32": "src/assets/icon-32.png",
    "48": "src/assets/icon-48.png",
    "128": "src/assets/icon-128.png"
  }
}
```

---

## 🔗 MAPEO: TABS EXISTENTES ↔ FUNCIONES DE LA EXTENSIÓN

| # | Tab en youtube-views | Endpoint existente | Función en la Extensión | Sync Direction |
|---|----------------------|-------------------|------------------------|----------------|
| 1 | **Pre-Launch Score** | `POST /pre-launch-score` | Auto-score de videos draft detectados en Studio. El content script detecta que estás editando un draft → extrae título/desc/tags → llama el endpoint → muestra score como overlay | `Extension → API → Extension` |
| 2 | **Keywords Generator** | `POST /generate-keywords` | Cuando editas un video en Studio, el side panel muestra keywords sugeridos + botón "Apply Tags" que auto-rellena el campo de tags | `API → Extension → YouTube` |
| 3 | **Title Analyzer** | `POST /analyze-title` | Analiza el título actual del video en edición. Muestra score + alternativas mejoradas. Botón "Replace Title" aplica la mejor opción | `Extension → API → Extension → YouTube` |
| 4 | **Content Ideas** | `POST /content-ideas` | Se ejecuta semanalmente basado en el nicho del canal. Resultados aparecen en el popup como "Content Suggestions". Click abre Boostify web | `API → Extension (popup)` |
| 5 | **Thumbnail Generator** | `POST /generate-thumbnail` | Genera conceptos de thumbnail basados en el video actual. Muestra previews en side panel. "Download" para aplicar en Studio | `Extension → API → Extension` |
| 6 | **Competitor Analysis** | `POST /analyze-competitor` | Background worker analiza competitors cada 24hrs. Alertas cuando competitor sube video similar. Side panel muestra comparación | `API → Extension (notification)` |
| 7 | **Trend Predictor** | `POST /predict-trends` | Background worker chequea trends cada 6hrs. Push notification cuando trend relevante al nicho del artista aparece | `API → Extension (notification)` |
| 8 | **Transcript Extractor** | `POST /extract-transcript` | Extrae transcript del video actual via YouTube Data API. Side panel muestra y permite editar subtítulos | `Extension → API → Extension` |
| 9 | **Multi-Channel** | `GET /multi-channel-analytics` | El popup muestra mini dashboard de todos los canales. Stats se actualizan via sync periódico | `Extension → API → Extension (popup)` |
| 10 | **Content Calendar** | `POST /generate-calendar` | Side panel en Studio muestra el calendario. Permite drag & drop para ajustar schedule. Sync bidireccional | `API ↔ Extension ↔ YouTube` |
| 11 | **Auto-Optimization** | `POST /setup-auto-optimization` | Background worker ejecuta reglas automáticas: actualiza títulos/tags basado en performance. Requiere confirmación en popup | `API → Extension → YouTube (con confirm)` |
| 12 | **API Access** | `GET /api-keys`, `POST /api-key/generate` | Keys visibles en popup settings. Usage stats sincronizados | `API → Extension (popup)` |

---

## 🔐 AUTENTICACIÓN Y SEGURIDAD

### Flujo de Auth
```
1. User logueado en Boostify (Clerk auth)
2. En /youtube-views → botón "Connect Chrome Extension"
3. Genera deep link: boostify-ext://connect?token=JWT_TOKEN&userId=X
4. Extension intercepta el deep link (URL handler en manifest)
5. Background worker almacena token en chrome.storage.session
6. Todos los requests a /api/youtube-ext/* incluyen:
   Header: Authorization: Bearer <syncToken>
7. Server valida JWT + verifica userId + extensionId match
```

### Seguridad
- **chrome.storage.session**: Token se borra cuando se cierra el browser (no persiste)
- **chrome.storage.local**: Solo guarda preferencias, nunca tokens
- **Content Security Policy**: Restricto a dominios de Boostify
- **Rate Limiting**: Max 100 sync requests/hora por usuario
- **Action Confirmation**: Acciones destructivas (editar título, publicar) SIEMPRE requieren click del usuario en la extensión

---

## 📊 DASHBOARD DE SINCRONIZACIÓN (nueva sección en youtube-views)

Agregar un **Tab 13: "Extension Sync"** al page de youtube-views.

```
┌─────────────────────────────────────────────────────────────┐
│  🔌 CHROME EXTENSION SYNC                                  │
│  ═══════════════════════                                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────────────────────────────┐ │
│  │ CONNECTION   │  │ SYNC ACTIVITY (last 24hrs)           │ │
│  │              │  │                                      │ │
│  │ Status: 🟢   │  │  ▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░  │ │
│  │ Connected    │  │  ↑ 847 data points synced            │ │
│  │              │  │                                      │ │
│  │ Channel:     │  │  Actions Applied: 12                 │ │
│  │ @ArtistX     │  │  Actions Pending: 3                  │ │
│  │              │  │  Actions Failed: 0                   │ │
│  │ Last Sync:   │  │                                      │ │
│  │ 2 min ago    │  └──────────────────────────────────────┘ │
│  │              │                                           │
│  │ [Disconnect] │  ┌──────────────────────────────────────┐ │
│  │ [Re-sync]    │  │ CHANNEL GROWTH (from snapshots)      │ │
│  │ [Settings]   │  │                                      │ │
│  └──────────────┘  │  Subscribers: 5,230 (+127 this week) │ │
│                     │  Total Views: 892K (+45K this week)  │ │
│  ┌──────────────┐  │  Avg CTR: 4.8% (+0.3%)              │ │
│  │ INSTALL      │  │  Watch Time: 12.5h/day               │ │
│  │ EXTENSION    │  │                                      │ │
│  │              │  │  [View Full Analytics →]              │ │
│  │ [Chrome      │  └──────────────────────────────────────┘ │
│  │  Web Store]  │                                           │
│  │              │  ┌──────────────────────────────────────┐ │
│  │ Or scan QR:  │  │ PENDING ACTIONS                      │ │
│  │  ┌────────┐  │  │                                      │ │
│  │  │ QR     │  │  │  1. Update "Sunset" title (Auto-Opt) │ │
│  │  │ CODE   │  │  │  2. Add tags to 3 videos (Keywords)  │ │
│  │  │        │  │  │  3. Schedule "New Track" (Calendar)   │ │
│  │  └────────┘  │  │                                      │ │
│  └──────────────┘  │  [Push All to Extension]              │ │
│                     └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 PLAN DE IMPLEMENTACIÓN (Fases)

### FASE 1: Foundation (1-2 semanas)
```
Backend:
├── [ ] Crear server/routes/youtube-extension.ts
│       ├── POST /connect
│       ├── POST /sync-stats
│       ├── GET /pending-actions
│       ├── POST /action-result
│       └── POST /webhook
├── [ ] Agregar 4 tablas nuevas al schema (db/schema.ts)
├── [ ] Migración Drizzle
└── [ ] Tests de integración

Extension Scaffold:
├── [ ] Crear proyecto boostify-youtube-extension/
├── [ ] manifest.json (Manifest V3)
├── [ ] Vite + CRXJS build setup
├── [ ] Background service worker (basic)
├── [ ] Popup UI (connection screen)
└── [ ] Auth flow (token storage)
```

### FASE 2: Core Sync (1-2 semanas)
```
Extension:
├── [ ] Content script: youtube.com/* (extractors)
│       ├── channel-stats.ts
│       ├── video-data.ts
│       └── page-change.ts (MutationObserver for SPA)
├── [ ] Periodic sync (chrome.alarms, cada 5 min)
├── [ ] Popup: ConnectionStatus + QuickStats
└── [ ] Badge icon con # de actions pendientes

Backend:
├── [ ] youtube_channel_snapshots: almacenamiento + delta tracking
├── [ ] Actualizar marketing metrics automáticamente
├── [ ] Conectar datos de sync a todos los 12 tabs existentes
└── [ ] WebSocket server para push notifications
```

### FASE 3: YouTube Studio Integration (2 semanas)
```
Extension:
├── [ ] Content script: studio.youtube.com/*
│       ├── analytics.ts (extraer analytics)
│       ├── auto-fill.ts (rellenar título/tags/desc)
│       └── studio-events.ts (detectar nuevos videos)
├── [ ] Side Panel con mini-tabs de Boostify
├── [ ] Action Queue execution
│       ├── Receive action from WS
│       ├── Navigate to video edit page
│       ├── Auto-fill changes
│       └── Await user confirmation
└── [ ] Notifications (trend alerts, ranking drops)

Backend:
├── [ ] Auto-create pending actions cuando se generan
│       resultados en los tabs de Boostify
├── [ ] SSE endpoint para live metrics
└── [ ] Event processing pipeline (from extension webhooks)
```

### FASE 4: Intelligence Layer (1-2 semanas)
```
├── [ ] Auto-optimization engine:
│       ├── Rule-based: si CTR < 3%, sugerir nuevo título
│       ├── Schedule-based: publicar en mejor hora
│       └── Trend-reactive: adaptar SEO a trending topics
├── [ ] A/B testing framework:
│       ├── Rotate thumbnails cada 48hrs
│       ├── Track CTR per variant
│       └── Auto-pick winner
├── [ ] Competitor watch:
│       ├── Alert cuando competitor sube video similar
│       └── Sugerir response content
└── [ ] Tab 13 "Extension Sync" en youtube-views page
```

### FASE 5: Polish & Chrome Web Store (1 semana)
```
├── [ ] UI/UX refinement (animations, loading states)
├── [ ] Error handling & retry logic
├── [ ] Offline mode (queue actions when no connection)
├── [ ] Privacy policy & terms (Chrome Store requirement)
├── [ ] Chrome Web Store listing
│       ├── Screenshots
│       ├── Description
│       ├── Category: Productivity
│       └── Submit for review
└── [ ] Documentation para artistas
```

---

## ⚡ QUICK WINS (se pueden hacer YA sin la extensión)

Mientras se desarrolla la extensión completa, estos cambios mejoran la plataforma inmediatamente:

1. **YouTube Data API v3 Integration** — Reemplazar los endpoints "demo" (transcript, analytics) con llamadas reales usando la `YOUTUBE_API_KEY` que ya existe en `.env`

2. **YouTube OAuth2 Flow** — Agregar autenticación OAuth para poder acceder al YouTube Studio API directamente desde Boostify (sin extensión), habilitando:
   - Lectura de analytics reales
   - Lectura de comentarios
   - Actualizar títulos/descripciones via API

3. **Webhook de YouTube** — Configurar `PubSubHubbub` (YouTube push notifications) para recibir alertas de nuevos videos sin polling

---

## 🔑 TECNOLOGÍAS CLAVE

| Componente | Tecnología |
|------------|-----------|
| Extension Framework | Chrome Manifest V3 + CRXJS (Vite plugin) |
| Extension UI | React 18 + Tailwind CSS (misma stack que Boostify) |
| Extension Build | Vite + @crxjs/vite-plugin |
| Extension State | Zustand (ligero, compatible con content scripts) |
| Background Comm | chrome.runtime.sendMessage + chrome.storage |
| Content Script DOM | MutationObserver (YouTube es SPA, DOM cambia sin page load) |
| Real-time Sync | WebSocket (ws library en server) + chrome.alarms (fallback) |
| Auth | JWT tokens (generados por Express, almacenados en chrome.storage.session) |
| API | Misma Express API, nuevos endpoints en /api/youtube-ext/* |
| DB | PostgreSQL (4 tablas nuevas via Drizzle) |

---

## 📏 MÉTRICAS DE ÉXITO

| Métrica | Target |
|---------|--------|
| Sync latency | < 30 segundos entre YouTube y Boostify |
| Action apply rate | > 80% de acciones recomendadas aceptadas |
| Extension DAU | > 60% de usuarios Pro mantienen extensión activa |
| CTR improvement | +15% CTR promedio para artistas que usan Auto-Optimization |
| Time saved | -50% tiempo en optimizar SEO por video vs manual |

---

> **RESUMEN**: La extensión actúa como un **puente bidireccional** entre la plataforma Boostify y YouTube. Los 12 tabs existentes de youtube-views generan insights y recomendaciones → la extensión las aplica directamente en YouTube Studio. La extensión recopila stats en tiempo real → los envía a Boostify para alimentar los análisis con datos frescos. Todo sincronizado via WebSocket + periodic sync + action queue.
