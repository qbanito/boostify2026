# BOOSTIFY EXPLICIT - Plan de Implementación (Módulo del Artista)

## Visión General: Módulo Integrado en el Landing del Artista

**Cambio de enfoque**: En lugar de una plataforma separada, Boostify Explicit será un **módulo más** dentro del sistema de secciones del landing del artista (`artist-profile-card.tsx`), siguiendo exactamente el mismo patrón de los 15 módulos existentes (songs, videos, merchandise, etc.).

### Cómo funciona actualmente el sistema de módulos:

```
artist-profile-card.tsx usa:
├── allSections{}           → Define cada módulo: { name, icon, isOwnerOnly }
├── defaultOrder[]          → Orden por defecto: ['songs', 'videos', ..., 'venueBooking']
├── defaultVisibility{}     → Toggle on/off por sección
├── sectionExpanded{}       → Colapsado/expandido
├── sectionOrder.filter()   → Renderiza solo las visibles
├── Drag & drop             → @hello-pangea/dnd para reordenar
├── PremiumGate             → Gate de plan para módulos premium
└── autoSaveLayout()        → Guarda en DB: users.profileLayout (JSON)
```

### Lo que vamos a hacer:

```
NUEVO MÓDULO: 'explicit-content'
├── Se agrega a allSections con icon Flame y name "Exclusive Content 🔥"
├── Se agrega a defaultOrder (al final, después de 'venueBooking')
├── defaultVisibility: false (desactivado por defecto, el artista lo activa)
├── isOwnerOnly: false (el público lo ve, pero con paywall)
├── El artista activa el módulo desde el panel de visibilidad (toggle)
├── Para VISITANTES: muestra grid de contenido con blur + botón "Subscribe"
├── Para SUSCRIPTORES: muestra contenido completo + chat + tips
├── Para el ARTISTA (owner): upload, AI studio, earnings, mensajes
└── Age Gate 18+: se muestra antes de desbloquear el módulo
```

### Ventajas de este enfoque:
1. **Cero páginas nuevas de routing** — todo vive dentro de `/artist/:slug`
2. **Reusa la infraestructura existente** — drag-and-drop, layout persistence, theme, PremiumGate
3. **Activación simple** — el artista solo activa el toggle del módulo
4. **Coherencia visual** — usa los mismos colores, estilos y patrones del landing
5. **Menos código frontend** — un componente principal `ExplicitContentSection` con subcomponentes internos

---

## FASE 1: Base de Datos

### 1.1 Nuevas Tablas en `db/schema.ts`

```typescript
// ═══════════════════════════════════════════
// BOOSTIFY EXPLICIT - TABLAS (Módulo del Artista)
// ═══════════════════════════════════════════

// Configuración explicit del artista (vinculado al usuario existente)
explicitSettings = pgTable('explicit_settings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).unique(), // FK al artista
  isEnabled: boolean('is_enabled').default(false),
  isAgeVerified: boolean('is_age_verified').default(false),       // Artista confirmó 18+
  monthlyPrice: decimal('monthly_price', { precision: 10, scale: 2 }).default('9.99'),
  yearlyPrice: decimal('yearly_price', { precision: 10, scale: 2 }),
  welcomeMessage: text('welcome_message'),                         // Mensaje para nuevos suscriptores
  totalSubscribers: integer('total_subscribers').default(0),
  totalEarnings: decimal('total_earnings', { precision: 10, scale: 2 }).default('0.00'),
  stripeConnectedAccountId: text('stripe_connected_account_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// Contenido explícito (fotos/videos subidos por el artista)
explicitContent = pgTable('explicit_content', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),          // FK directa al artista
  type: text('type', { enum: ['image', 'video'] }).notNull(),
  title: text('title'),
  description: text('description'),
  mediaUrl: text('media_url').notNull(),                          // URL completa (suscriptores)
  thumbnailUrl: text('thumbnail_url'),                             // Preview borroso (no suscriptores)
  previewUrl: text('preview_url'),                                 // Preview corto (videos)
  isAiGenerated: boolean('is_ai_generated').default(false),
  aiModel: text('ai_model'),
  aiPrompt: text('ai_prompt'),
  isPremium: boolean('is_premium').default(false),                 // Requiere compra extra
  singlePrice: decimal('single_price', { precision: 10, scale: 2 }),
  viewCount: integer('view_count').default(0),
  likeCount: integer('like_count').default(0),
  isPublished: boolean('is_published').default(true),
  tags: text('tags').array(),
  createdAt: timestamp('created_at').defaultNow(),
})

// Suscripciones de fans al contenido explicit de un artista
explicitSubscriptions = pgTable('explicit_subscriptions', {
  id: serial('id').primaryKey(),
  subscriberId: integer('subscriber_id').references(() => users.id),  // Fan
  artistId: integer('artist_id').references(() => users.id),           // Artista
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  status: text('status', { enum: ['active', 'cancelled', 'expired', 'past_due'] }).default('active'),
  plan: text('plan', { enum: ['monthly', 'yearly'] }).default('monthly'),
  price: decimal('price', { precision: 10, scale: 2 }),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// Compras individuales de contenido premium
explicitPurchases = pgTable('explicit_purchases', {
  id: serial('id').primaryKey(),
  buyerId: integer('buyer_id').references(() => users.id),
  contentId: integer('content_id').references(() => explicitContent.id),
  artistId: integer('artist_id').references(() => users.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal('platform_fee', { precision: 10, scale: 2 }),
  artistEarning: decimal('artist_earning', { precision: 10, scale: 2 }),
  stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
  status: text('status', { enum: ['pending', 'completed', 'refunded'] }).default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
})

// Chat messages (sin censura, entre fan suscriptor y artista)
explicitChatMessages = pgTable('explicit_chat_messages', {
  id: serial('id').primaryKey(),
  roomId: text('room_id').notNull(),                            // "chat_{artistUserId}_{fanUserId}"
  senderId: integer('sender_id').references(() => users.id),
  receiverId: integer('receiver_id').references(() => users.id),
  type: text('type', { enum: ['text', 'image', 'video', 'ai_image', 'ai_video', 'tip'] }).default('text'),
  content: text('content'),
  mediaUrl: text('media_url'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
})

// Generaciones AI explícitas (tracking)
explicitAiGenerations = pgTable('explicit_ai_generations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  type: text('type', { enum: ['image', 'video'] }).notNull(),
  model: text('model').notNull(),
  prompt: text('prompt').notNull(),
  resultUrl: text('result_url'),
  cost: decimal('cost', { precision: 10, scale: 4 }),
  status: text('status', { enum: ['pending', 'completed', 'failed'] }).default('pending'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
})

// Tips/Propinas
explicitTips = pgTable('explicit_tips', {
  id: serial('id').primaryKey(),
  senderId: integer('sender_id').references(() => users.id),
  artistId: integer('artist_id').references(() => users.id),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal('platform_fee', { precision: 10, scale: 2 }),
  artistEarning: decimal('artist_earning', { precision: 10, scale: 2 }),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  message: text('message'),
  createdAt: timestamp('created_at').defaultNow(),
})
```

---

## FASE 2: Modelos FAL AI Sin Censura

### 2.1 Modelos Confirmados con `enable_safety_checker: false`

#### Generación de Imágenes (NSFW)

| Modelo | ID en FAL | Costo | Velocidad | Uso |
|--------|-----------|-------|-----------|-----|
| **FLUX.1 [dev]** | `fal-ai/flux/dev` | ~$0.025/img | 28 steps (~5s) | **Principal** - Alta calidad |
| **FLUX.1 [schnell]** | `fal-ai/flux/schnell` | ~$0.003/img | 4 steps (~1s) | **Rápido** - Previews |
| **FLUX LoRA** | `fal-ai/flux-lora` | ~$0.025/img | 28 steps (~5s) | **Personalizado** - LoRAs custom |

#### Generación de Video (NSFW)

| Modelo | ID en FAL | Costo | Resolución | Uso |
|--------|-----------|-------|------------|-----|
| **LTX-2 19B** | `fal-ai/ltx-2-19b/image-to-video` | ~$0.10/vid | 1248x704 | **Principal** - Con audio |
| **LTX-2.3** | `fal-ai/ltx-2.3/text-to-video` | ~$0.10/vid | 1080p | **Texto directo** |

> **IMPORTANTE**: Solo modelos open-source (FLUX, LTX, Wan) permiten `enable_safety_checker: false`. Kling, Veo 3, Sora 2 NO lo permiten.

### 2.2 Servicio: `server/services/explicit-ai-service.ts`

```typescript
export const EXPLICIT_FAL_MODELS = {
  IMAGE_HIGH_QUALITY: 'fal-ai/flux/dev',
  IMAGE_FAST: 'fal-ai/flux/schnell',
  IMAGE_LORA: 'fal-ai/flux-lora',
  VIDEO_FROM_IMAGE: 'fal-ai/ltx-2-19b/image-to-video',
  VIDEO_FROM_TEXT: 'fal-ai/ltx-2.3/text-to-video',
}

// Todas las funciones usan enable_safety_checker: false
```

---

## FASE 3: Integración en el Módulo del Artista

### 3.1 Cambios en `artist-profile-card.tsx`

```typescript
// 1. AGREGAR A allSections:
'explicit-content': { name: 'Exclusive Content 🔥', icon: Flame, isOwnerOnly: false },

// 2. AGREGAR A defaultOrder (al final):
const defaultOrder = [...existente..., 'explicit-content'];

// 3. AGREGAR A defaultVisibility (desactivado por defecto):
'explicit-content': false,

// 4. AGREGAR A defaultExpanded:
'explicit-content': false,

// 5. NUEVO IMPORT:
import { ExplicitContentSection } from './explicit-content-section';

// 6. EN EL RENDER de secciones, agregar el else if:
} else if (sectionId === 'explicit-content') {
  sectionElement = (
    <ExplicitContentSection
      artistId={artistId}
      userId={user?.id}
      isOwnProfile={isOwnProfile}
      isExpanded={sectionExpanded[sectionId]}
      onToggleExpand={() => setSectionExpanded(prev => ({
        ...prev, [sectionId]: !prev[sectionId]
      }))}
      colors={colors}
      cardStyles={cardStyles}
      cardStyleInline={cardStyleInline}
    />
  );
}
```

### 3.2 Componente Principal: `ExplicitContentSection`

```
client/src/components/artist/explicit-content-section.tsx

COMPORTAMIENTO POR ROL:

╔═══════════════════════════════════════════════════════════════════╗
║ ROL: ARTISTA (isOwnProfile = true)                              ║
╠═══════════════════════════════════════════════════════════════════╣
║ Vista: Panel de gestión con tabs internos                       ║
║                                                                  ║
║ [📸 Contenido] [🤖 AI Studio] [💬 Chat] [💰 Earnings] [⚙️ Settings]║
║                                                                  ║
║ Tab Contenido:                                                   ║
║ ├── Botón "Upload Foto/Video"                                   ║
║ ├── Grid de contenido subido (con stats: views, likes, $)       ║
║ ├── Toggle premium/gratis por contenido                         ║
║ └── Editar/Eliminar                                             ║
║                                                                  ║
║ Tab AI Studio:                                                   ║
║ ├── Prompt + opciones de generación                             ║
║ ├── Selector modelo (rápido/calidad)                            ║
║ ├── Selector imagen/video                                       ║
║ ├── Resultado → "Publicar" / "Guardar" / "Enviar en chat"      ║
║ └── Historial de generaciones                                   ║
║                                                                  ║
║ Tab Chat:                                                        ║
║ ├── Lista de conversaciones con suscriptores                    ║
║ ├── Chat en tiempo real (WebSocket)                             ║
║ └── Enviar texto/imagen/video/AI generado                       ║
║                                                                  ║
║ Tab Earnings:                                                    ║
║ ├── Total ganado este mes                                       ║
║ ├── Breakdown: suscripciones / compras / tips                   ║
║ ├── Gráfico de ganancias                                        ║
║ └── Botón "Request Payout"                                      ║
║                                                                  ║
║ Tab Settings:                                                    ║
║ ├── Precio mensual/anual de suscripción                         ║
║ ├── Mensaje de bienvenida                                       ║
║ ├── Verificación 18+ (checkbox obligatorio)                     ║
║ └── Stripe Connect setup                                        ║
╚═══════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════╗
║ ROL: VISITANTE NO SUSCRITO                                       ║
╠═══════════════════════════════════════════════════════════════════╣
║ [🔥 Age Gate 18+ modal si no verificado]                         ║
║                                                                  ║
║ Grid de contenido:                                               ║
║ ├── 🔒 Imágenes con blur (CSS filter: blur(20px))               ║
║ ├── 🔒 Videos con thumbnail borroso                             ║
║ ├── Título visible, precio visible                              ║
║ └── Cada card tiene overlay "🔓 Subscribe to unlock"            ║
║                                                                  ║
║ CTA Principal:                                                   ║
║ ┌─────────────────────────────────────────────┐                  ║
║ │ 🔥 Subscribe to [Artist Name]'s Exclusive   │                  ║
║ │    Content for $9.99/month                   │                  ║
║ │           [Subscribe Now]                    │                  ║
║ └─────────────────────────────────────────────┘                  ║
╚═══════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════╗
║ ROL: SUSCRIPTOR ACTIVO                                           ║
╠═══════════════════════════════════════════════════════════════════╣
║ Grid de contenido:                                               ║
║ ├── ✅ Imágenes sin blur (acceso completo)                       ║
║ ├── ✅ Videos reproducibles                                      ║
║ ├── 🔒 Contenido premium → botón "Buy $X"                       ║
║ └── Likes, comentarios, compartir                                ║
║                                                                  ║
║ [💬 Chat with Artist] → Abre chat inline                        ║
║ [💰 Send Tip $1/$5/$10/$25] → Stripe payment                   ║
║                                                                  ║
║ [Manage Subscription] → Cancelar/Cambiar plan                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### 3.3 Subcomponentes Internos

```
client/src/components/explicit/
├── ExplicitContentGrid.tsx      ← Grid de contenido (blur/unlock)
├── ExplicitContentCard.tsx      ← Card individual con blur overlay
├── ExplicitContentViewer.tsx    ← Visor fullscreen
├── ExplicitAiStudio.tsx         ← Interfaz de generación AI
├── ExplicitChat.tsx             ← Chat con WebSocket
├── ExplicitChatMessage.tsx      ← Mensaje individual
├── ExplicitEarnings.tsx         ← Panel de ganancias
├── ExplicitSettings.tsx         ← Configuración del módulo
├── ExplicitUploader.tsx         ← Upload de contenido
├── ExplicitSubscribeButton.tsx  ← Botón de suscripción con Stripe
├── ExplicitTipButton.tsx        ← Botón de propinas
├── AgeVerificationGate.tsx      ← Modal 18+ obligatorio
└── ExplicitPurchaseButton.tsx   ← Compra individual
```

---

## FASE 4: Sistema de Pagos con Stripe

### 4.1 Flujo de Pagos (dentro del módulo)

```
SUSCRIPCIÓN (visitante → suscriptor):
1. Visitante ve contenido borroso en el módulo del artista
2. Click "Subscribe $9.99/month"
3. → Age Gate 18+ (si no verificado)
4. → Stripe Checkout Session
5. → Webhook → DB (explicitSubscriptions)
6. → Refresca módulo → contenido desbloqueado
7. → 80% artista / 20% plataforma

COMPRA INDIVIDUAL (premium content):
1. Suscriptor ve contenido premium con precio
2. Click "Buy $4.99"
3. → Stripe PaymentIntent
4. → Webhook → DB (explicitPurchases)
5. → Desbloquea ese contenido específico

TIPS EN CHAT:
1. En el chat, click botón de tip
2. Selecciona monto ($1/$5/$10/$25/$50/$100)
3. → Stripe PaymentIntent rápido
4. → Mensaje especial en el chat + notificación artista
```

### 4.2 Endpoints API: `server/routes/explicit.ts`

```
// Contenido
POST   /api/explicit/content/upload           → Upload foto/video
GET    /api/explicit/content/:artistId        → Feed del artista (respeta acceso)
GET    /api/explicit/content/item/:contentId  → Item individual
DELETE /api/explicit/content/:contentId        → Eliminar (owner)
PATCH  /api/explicit/content/:contentId        → Editar metadata

// Pagos
POST   /api/explicit/subscribe/:artistId      → Crear suscripción
POST   /api/explicit/purchase/:contentId      → Comprar contenido individual
POST   /api/explicit/tip/:artistId            → Enviar propina
GET    /api/explicit/subscription/:artistId   → Mi estado de suscripción
POST   /api/explicit/cancel-subscription      → Cancelar suscripción
GET    /api/explicit/earnings                 → Ganancias del artista

// AI
POST   /api/explicit/ai/generate-image       → Imagen sin filtro (FLUX)
POST   /api/explicit/ai/generate-video       → Video sin filtro (LTX-2)
GET    /api/explicit/ai/generations           → Historial

// Chat
GET    /api/explicit/chat/rooms               → Mis conversaciones
GET    /api/explicit/chat/:roomId/messages    → Mensajes de un room
POST   /api/explicit/chat/:roomId/send        → Enviar mensaje (REST fallback)

// Settings
GET    /api/explicit/settings                 → Config del artista
PUT    /api/explicit/settings                 → Actualizar config
POST   /api/explicit/settings/verify-age      → Verificar 18+

// Webhook
POST   /api/explicit/webhook                  → Stripe webhook
```

---

## FASE 5: Chat en Tiempo Real (WebSocket)

### 5.1 Socket.IO integrado al servidor Express existente

```typescript
// server/websocket/explicit-chat.ts
// Se integra al httpServer existente (NO un servidor separado)

import { Server } from 'socket.io';

export function setupExplicitChat(httpServer) {
  const io = new Server(httpServer, {
    path: '/explicit-chat',
    cors: { origin: '*' }
  });

  io.use(authMiddleware);  // Verifica token + suscripción activa

  io.on('connection', (socket) => {
    socket.on('join_room', ({ roomId }) => { ... });
    socket.on('message', ({ roomId, content, type }) => { ... });
    socket.on('typing', ({ roomId }) => { ... });
    socket.on('tip', ({ roomId, amount }) => { ... });
  });
}
```

### 5.2 Integración en el módulo

El chat se abre **inline** dentro del módulo explicit del landing del artista:
- Para el **artista**: ve lista de suscriptores + click para abrir chat
- Para el **suscriptor**: ve botón "Chat with [Artist]" → chat inline
- El chat vive dentro de `ExplicitContentSection`, NO en una página separada

---

## FASE 6: Seguridad y Age Gate

### 6.1 Age Verification Gate
```
FLUJO:
1. Módulo explicit-content se renderiza en el landing
2. Antes de mostrar contenido → verifica localStorage('explicit_age_verified')
3. Si no verificado → Modal overlay:
   "⚠️ Este contenido es para mayores de 18 años.
    Al continuar, confirmas que tienes 18+ años."
   [Confirmo que soy mayor de 18] [Salir]
4. Al confirmar → localStorage + se muestra el contenido
```

### 6.2 Para el artista (activar módulo)
```
1. Artista activa módulo "Exclusive Content 🔥" desde el toggle de visibilidad
2. Primera vez → Settings aparece → debe verificar 18+ (checkbox + ToS)
3. Configura precio mensual/anual
4. Setup Stripe Connect (si no tiene)
5. Empieza a subir contenido
```

### 6.3 Protección de contenido
- **Signed URLs** de Firebase Storage (expiran en 1h)
- **Blur CSS** para no-suscriptores (`filter: blur(20px)`)
- **Watermark** sutil en previews
- **Rate limiting** en API

---

## ORDEN DE IMPLEMENTACIÓN

### Sprint 1: Base DB + Backend
1. Tablas en `db/schema.ts` (7 tablas)
2. Migración (`drizzle-kit push`)
3. Servicio AI explícito (`explicit-ai-service.ts`)
4. Rutas API (`server/routes/explicit.ts`)

### Sprint 2: Módulo Frontend
5. `ExplicitContentSection` (componente principal)
6. Integración en `artist-profile-card.tsx` (allSections + render)
7. `AgeVerificationGate`
8. `ExplicitContentGrid` + `ExplicitContentCard` (blur/unlock)
9. `ExplicitUploader` (upload contenido)

### Sprint 3: Pagos + Chat
10. Endpoints Stripe (suscripción, compra, tips)
11. Webhook handler
12. `ExplicitSubscribeButton` + flujo de pago
13. Socket.IO setup + `ExplicitChat`
14. `ExplicitTipButton`

### Sprint 4: AI + Earnings
15. `ExplicitAiStudio` (generación imagen/video sin filtro)
16. AI → Publicar como contenido
17. `ExplicitEarnings` panel
18. `ExplicitSettings` con Stripe Connect

### Sprint 5: Polish
19. Testing de flujo completo (artista → visitante → suscriptor)
20. Moderación y reportes

---

## ARCHIVOS A CREAR

```
BACKEND (5 archivos nuevos):
├── server/services/explicit-ai-service.ts    ← FAL sin filtro
├── server/routes/explicit.ts                 ← Todos los endpoints
├── server/websocket/explicit-chat.ts         ← WebSocket chat
└── server/services/explicit-media.ts         ← Blur thumbnails, upload

FRONTEND (14 archivos nuevos):
├── client/src/components/artist/
│   └── explicit-content-section.tsx          ← Componente PRINCIPAL del módulo
├── client/src/components/explicit/
│   ├── ExplicitContentGrid.tsx               ← Grid con blur/unlock
│   ├── ExplicitContentCard.tsx               ← Card individual
│   ├── ExplicitContentViewer.tsx             ← Visor fullscreen
│   ├── ExplicitAiStudio.tsx                  ← Generación AI
│   ├── ExplicitChat.tsx                      ← Chat WebSocket
│   ├── ExplicitChatMessage.tsx               ← Mensaje individual
│   ├── ExplicitEarnings.tsx                  ← Panel ganancias
│   ├── ExplicitSettings.tsx                  ← Configuración
│   ├── ExplicitUploader.tsx                  ← Upload contenido
│   ├── ExplicitSubscribeButton.tsx           ← Suscripción Stripe
│   ├── ExplicitTipButton.tsx                 ← Propinas
│   ├── ExplicitPurchaseButton.tsx            ← Compra individual
│   └── AgeVerificationGate.tsx               ← Modal 18+

MODIFICACIONES (2 archivos existentes):
├── db/schema.ts                              ← +7 tablas nuevas
└── client/src/components/artist/
    └── artist-profile-card.tsx               ← +1 sección en allSections
                                                 +1 en defaultOrder
                                                 +1 en defaultVisibility
                                                 +1 else if en render
                                                 +1 import
```

---

## COSTOS Y MODELO DE NEGOCIO

| Servicio | Costo | Notas |
|----------|-------|-------|
| FAL imagen (FLUX dev) | $0.025/img | Alta calidad, sin filtro |
| FAL imagen (FLUX schnell) | $0.003/img | Preview rápido |
| FAL video (LTX-2 5s) | ~$0.10/vid | Con audio |
| Stripe fees | 2.9% + $0.30 | Por transacción |
| Firebase Storage | $0.026/GB | Almacenamiento |
| Socket.IO | Incluido | Mismo servidor Express |

```
INGRESOS:
├── 20% comisión en suscripciones fan→artista
├── 20% comisión en compras individuales
├── 20% comisión en tips
├── Margen en créditos AI (pack $4.99 → costo ~$0.75)

EJEMPLO: Artista con 100 suscriptores a $9.99/mes
→ $999/mes bruto → $200/plataforma → $799/artista
```

---

## PRÓXIMO PASO

**¿Empezamos con Sprint 1?**

1. Agregar 7 tablas en `db/schema.ts`
2. Crear `server/services/explicit-ai-service.ts`
3. Crear `server/routes/explicit.ts`
4. Agregar módulo en `artist-profile-card.tsx`
