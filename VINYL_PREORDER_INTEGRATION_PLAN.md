# VINYL PRE-ORDER MODULE — DIGGERS FACTORY INTEGRATION PLAN

## 1. VISIÓN DEL PRODUCTO

El **Vinyl Pre-Order Module** permite a cualquier artista en Boostify lanzar una campaña de pre-orden de discos de vinilo físicos fabricados por **Diggers Factory** (diggersfactory.com). El módulo:

- Muestra una animación de vinilo girando con la portada del álbum
- Permite pre-ordenar hasta alcanzar el mínimo de **100 unidades**
- Cobra al fan en el momento de la pre-orden (Stripe PaymentIntent con capture manual)
- Genera la portada 1000×1000 con IA (o subida manual)
- Cuando se alcanzan 100 unidades, el sistema notifica al artista y genera el paquete de fulfillment para Diggers Factory
- El precio de venta = **costo de producción por unidad × 2** (100% de ganancia)

---

## 2. CONTEXTO: DIGGERS FACTORY

**URL:** https://www.diggersfactory.com/es/creation/vinyl

### Modelo de negocio compatible
Diggers Factory ofrece dos modos:
- **Make on demand** ← El que usaremos. Pre-órdenes de fans financian la producción. **Sin costo inicial**.
- Make now — Pago adelantado, no aplica.

### Especificaciones del vinilo (opciones disponibles)
| Parámetro | Opciones |
|-----------|---------|
| Cantidad mínima | **100 unidades** |
| Cantidades | 100, 200, 300, 500, 1000, 2000, 3000, 5000 |
| Formato | 7", 10", 12" |
| Tipo | 1 LP, 2 LP, 3 LP, 4 LP |
| Color | Negro, Color sólido, Splatter, Cloudy, A-side/B-side, Mármol, Color-in-color, Half&Half, Picture Disc |
| Peso | 140g, 180g |
| Velocidad | 33 RPM, 45 RPM |
| Cubierta | Color, Discobag, Gatefold doble, Gatefold triple, PVC Deluxe |
| Acabado de impresión | Gloss varnish, Matte varnish, Returned cardboard |
| Inner sleeve | Blanco, Negro, Impreso, White polylined, Black polylined |
| Numeración | Ninguna, Automática, A mano |
| Extras opcionales | Shrink wrap, Polybag, Insert (1 cara, 2 caras, Booklet 8 pág.), Sticker de marketing, Barcode sticker |
| Add-ons de servicio | Mastering (€60/track), Distribución física, Distribución digital, Download digital, Diseño asistido |

### Costos de referencia (USD estimados)
| Cantidad | 12" LP negro 140g | Por unidad |
|----------|-------------------|------------|
| 100      | ~$1,800            | ~$18.00    |
| 200      | ~$2,600            | ~$13.00    |
| 300      | ~$3,200            | ~$10.67    |
| 500      | ~$4,500            | ~$9.00     |

> **Regla de precio de venta:** `precio_venta = costo_por_unidad × 2`
> Ejemplo: 100 unidades a $18/unit → precio de venta = **$36 USD**

### ¿Tiene API pública Diggers Factory?
**No.** La integración es semi-automática:
1. Artista cotiza en diggersfactory.com y obtiene el costo total
2. Introduce ese costo en Boostify
3. Boostify gestiona los pre-pedidos y pagos
4. Al alcanzar 100 unidades, Boostify genera un **Fulfillment Report** que el artista sube manualmente en Diggers Factory (o el equipo de Boostify lo tramita)

---

## 3. ARQUITECTURA TÉCNICA

```
┌─────────────────────────────────────────────────────────────────┐
│                     BOOSTIFY FRONTEND                           │
│                                                                 │
│  VinylPreorderModule (artist-profile-card.tsx)                  │
│  ├── SpinningVinyl (animación CSS + Framer Motion)              │
│  ├── CampaignForm (crear campaña: portada 1000×1000, tracklist) │
│  ├── PreOrderCard (para fans: contador, botón comprar)          │
│  └── FulfillmentDashboard (artista ve pedidos acumulados)       │
└─────────────┬───────────────────────────────────────────────────┘
              │ REST API
┌─────────────▼───────────────────────────────────────────────────┐
│                     BOOSTIFY BACKEND                            │
│                                                                 │
│  server/routes/vinyl.ts                                         │
│  ├── GET    /api/vinyl/:artistId/campaigns      → listar campañas│
│  ├── POST   /api/vinyl/campaigns                → crear campaña  │
│  ├── GET    /api/vinyl/campaigns/:id            → detalle        │
│  ├── POST   /api/vinyl/campaigns/:id/preorder   → crear pre-orden│
│  ├── POST   /api/vinyl/campaigns/:id/checkout   → Stripe intent  │
│  ├── POST   /api/vinyl/webhook                  → Stripe webhook  │
│  ├── GET    /api/vinyl/campaigns/:id/orders     → ver pedidos    │
│  └── POST   /api/vinyl/campaigns/:id/fulfill    → generar report │
└─────────────┬───────────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────────┐
│                     POSTGRESQL (Neon)                           │
│                                                                 │
│  vinyl_campaigns      vinyl_preorders                           │
│  ─────────────        ────────────────                          │
│  id                   id                                        │
│  artist_id            campaign_id                               │
│  title                buyer_email                               │
│  cover_image_1000     buyer_name                                │
│  tracklist_json       quantity                                  │
│  vinyl_format         unit_price                                │
│  vinyl_color          total_price                               │
│  vinyl_weight         stripe_payment_intent_id                  │
│  vinyl_speed          stripe_payment_status                     │
│  production_cost      shipping_address_json                     │
│  unit_cost            status                                    │
│  sell_price           fulfilled_at                              │
│  minimum_units        created_at                                │
│  current_units                                                  │
│  campaign_status                                                │
│  diggers_project_url                                            │
│  diggers_quote_ref                                              │
│  fulfillment_sent_at                                            │
│  created_at                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. FLUJO COMPLETO (HAPPY PATH)

```
Artista                    Boostify                  Fan                Diggers Factory
   │                          │                        │                      │
   │── Crea campaña ─────────►│                        │                      │
   │   (portada 1000x1000,    │                        │                      │
   │    tracklist, specs,     │                        │                      │
   │    costo cotizado)       │◄─ Guarda en DB ────────│                      │
   │                          │                        │                      │
   │                          │◄── Ve perfil artista ──│                      │
   │                          │    SpinningVinyl       │                      │
   │                          │    Counter: 0/100      │                      │
   │                          │                        │                      │
   │                          │◄── Click Pre-Order ────│                      │
   │                          │    (Stripe Checkout)   │                      │
   │                          │──────────────────────► Pago en hold ($X)      │
   │                          │    Counter: 1/100      │                      │
   │                          │       ...              │                      │
   │                          │    Counter: 100/100    │                      │
   │◄── Email notificación ───│                        │                      │
   │    "¡100 pre-órdenes!"   │                        │                      │
   │                          │──────────────────────────────► Artista sube   │
   │── Fulfillment report ───►│  (CSV + JSON con todos  │      orden en       │
   │   descargado             │   los pedidos)           │      diggersfactory │
   │                          │                          │                     │
   │                          │  Stripe captura todos ──►│                     │
   │                          │  los payments            │                     │
   │                          │                          │◄── Producción 6-8 wks│
   │                          │◄─── Notificación de ─────────────────────────│
   │                          │     envío/tracking        │                     │
```

---

## 5. MODELO DE DATOS SQL

### `vinyl_campaigns`
```sql
CREATE TABLE vinyl_campaigns (
  id                  SERIAL PRIMARY KEY,
  artist_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT NOT NULL,                        -- "Nombre del álbum"
  subtitle            TEXT,                                 -- Subtítulo o edición
  cover_image_1000    TEXT NOT NULL,                        -- URL Firebase Storage (1000×1000)
  cover_image_back    TEXT,                                 -- Contraportada (opcional)
  tracklist_json      JSONB NOT NULL DEFAULT '[]',          -- [{side:'A',track:1,title:'...',duration:'3:45'}]
  
  -- Especificaciones del vinilo
  vinyl_format        TEXT NOT NULL DEFAULT '12',           -- '7' | '10' | '12'
  vinyl_type          TEXT NOT NULL DEFAULT '1LP',          -- '1LP' | '2LP'
  vinyl_color         TEXT NOT NULL DEFAULT 'black',        -- 'black' | 'color' | 'splatter' | ...
  vinyl_weight        TEXT NOT NULL DEFAULT '140g',         -- '140g' | '180g'
  vinyl_speed         TEXT NOT NULL DEFAULT '33RPM',        -- '33RPM' | '45RPM'
  sleeve_type         TEXT NOT NULL DEFAULT 'color',        -- 'color' | 'gatefold' | 'double_gatefold' | ...
  print_finish        TEXT NOT NULL DEFAULT 'gloss',        -- 'gloss' | 'matte' | 'cardboard'
  inner_sleeve        TEXT NOT NULL DEFAULT 'white',        -- 'white' | 'black' | 'printed' | ...
  numbered            TEXT NOT NULL DEFAULT 'none',         -- 'none' | 'automatic' | 'hand'
  with_insert         TEXT NOT NULL DEFAULT 'none',         -- 'none' | 'one_side' | 'two_sides' | 'booklet'
  with_shrink         BOOLEAN NOT NULL DEFAULT false,
  with_barcode        BOOLEAN NOT NULL DEFAULT true,
  include_mastering   BOOLEAN NOT NULL DEFAULT false,
  
  -- Economía
  diggers_quote_ref   TEXT,                                 -- Referencia de cotización en Diggers
  diggers_project_url TEXT,                                 -- URL del proyecto en Diggers Factory
  production_cost_total DECIMAL(10,2) NOT NULL,             -- Costo total cotizado en Diggers ($)
  minimum_units       INTEGER NOT NULL DEFAULT 100,         -- Mínimo para activar producción
  max_units           INTEGER NOT NULL DEFAULT 300,         -- Tope de la campaña
  unit_cost           DECIMAL(10,2) NOT NULL,               -- = production_cost_total / minimum_units
  sell_price          DECIMAL(10,2) NOT NULL,               -- = unit_cost * 2 (100% markup)
  
  -- Estado
  current_units       INTEGER NOT NULL DEFAULT 0,           -- Pre-órdenes actuales
  campaign_status     TEXT NOT NULL DEFAULT 'active',       -- 'active' | 'goal_reached' | 'fulfilled' | 'cancelled'
  is_published        BOOLEAN NOT NULL DEFAULT true,
  
  -- Fulfillment
  fulfillment_sent_at TIMESTAMP,
  fulfillment_report  JSONB,                                -- JSON del reporte enviado a Diggers
  
  -- Fechas
  campaign_start      TIMESTAMP NOT NULL DEFAULT NOW(),
  campaign_end        TIMESTAMP,                            -- Opcional: deadline de pre-orden
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### `vinyl_preorders`
```sql
CREATE TABLE vinyl_preorders (
  id                        SERIAL PRIMARY KEY,
  campaign_id               INTEGER NOT NULL REFERENCES vinyl_campaigns(id) ON DELETE CASCADE,
  artist_id                 INTEGER NOT NULL REFERENCES users(id),
  buyer_clerk_id            TEXT,                           -- Clerk user ID si está logueado
  buyer_email               TEXT NOT NULL,
  buyer_name                TEXT NOT NULL,
  quantity                  INTEGER NOT NULL DEFAULT 1,
  unit_price                DECIMAL(10,2) NOT NULL,
  total_price               DECIMAL(10,2) NOT NULL,         -- quantity * unit_price
  
  -- Stripe
  stripe_payment_intent_id  TEXT UNIQUE,
  stripe_payment_status     TEXT NOT NULL DEFAULT 'pending', -- pending | authorized | captured | refunded
  stripe_session_id         TEXT,
  
  -- Dirección de envío
  shipping_name             TEXT,
  shipping_address_line1    TEXT,
  shipping_address_line2    TEXT,
  shipping_city             TEXT,
  shipping_state            TEXT,
  shipping_postal_code      TEXT,
  shipping_country          TEXT NOT NULL DEFAULT 'US',
  
  -- Estado del pedido
  status                    TEXT NOT NULL DEFAULT 'pending',  -- pending | confirmed | shipped | delivered | cancelled | refunded
  tracking_number           TEXT,
  tracking_url              TEXT,
  notes                     TEXT,
  
  -- Timestamps
  created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 6. PORTADA 1000×1000 (COVER ART)

La portada debe cumplir los requisitos de Diggers Factory:

| Requisito | Valor |
|-----------|-------|
| Tamaño canvas mínimo | 1000×1000 px (12" sleeve requiere 3150×3150 px con bleed) |
| Formato de exportación | PNG o JPG alta calidad |
| DPI para print | 300 DPI (Diggers Factory provee templates) |

### Flujo de generación
1. **Manual**: Artista sube imagen 1000×1000 vía Firebase Storage upload
2. **AI-assisted**: El módulo usa el generador de portadas existente (GPT-Image-1 / fal) con prompt específico para vinilo:
   ```
   "Album cover for vinyl LP '{title}' by {artistName}. 
    12-inch vinyl record artwork, 1:1 square format, 
    high contrast, bold typography, printed press-quality design."
   ```
3. El módulo muestra un **preview centrado en el vinilo girando** (center label art)

### Capas del diseño de portada en el módulo
```
┌─────────────────────────────┐
│  Front Cover (1000×1000)    │
│  ┌─────────────────────┐    │
│  │                     │    │
│  │  [Imagen principal] │    │
│  │                     │    │
│  │  ARTIST NAME        │    │  ← generado con AI o manual
│  │  Album Title        │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

---

## 7. ANIMACIÓN DEL VINILO (SpinningVinyl)

Componente React standalone con CSS + Framer Motion:

```tsx
// Capas de la animación:
// 1. Sleeve (portada) — se abre al hover para revelar el vinilo
// 2. Vinyl record (SVG círculo negro con grooves, rotación continua)
// 3. Center label (portada 1000×1000 reducida al centro del disco)
// 4. Reflection highlight (arco de brillo en el disco)
// 5. Tonearm (brazo del tocadiscos que baja al hacer hover)
```

### Estados de la animación
- `idle`: Disco estático, sleeve cerrado, portada visible
- `playing`: Disco girando a 33 RPM (animación CSS `@keyframes spin`)
- `hover`: Sleeve se desliza para revelar el disco (slide-left)
- `ordered`: Número de orden en el centro del label + tick verde

---

## 8. FLUJO DE PAGO (STRIPE)

### Estrategia: **Capture Manual** (Authorize-and-Capture)

```
Fan hace pre-orden
       │
       ▼
Stripe PaymentIntent (capture_method: 'manual')
→ Estado: 'requires_capture' (dinero reservado, NO cobrado)
       │
       │ Cuando current_units >= 100
       ▼
Boostify captura TODOS los PaymentIntents
→ stripe.paymentIntents.capture(paymentIntentId)
→ Dinero cobra → artista recibe fondos menos comisión Boostify
       │
       │ Si la campaña se cancela / no llega a 100 antes del deadline
       ▼
Boostify cancela / no captura los PaymentIntents
→ Dinero devuelto automáticamente al fan
```

### Ventajas
- Fan no pierde dinero si el mínimo no se alcanza
- No se necesita refund manual
- El PaymentIntent de Stripe tiene un límite de captura de 7 días (requiere refresh para campañas largas)

### Precio con envío (Diggers Factory envía directo al fan)
```
Total = unit_sell_price + shipping_estimate
       = (unit_cost × 2)  + ~$12 USD (flat rate international)
```

---

## 9. NOTIFICACIONES

| Evento | Destinatario | Canal |
|--------|-------------|-------|
| Nueva pre-orden | Artista | Email (Brevo) + in-app |
| Pre-orden confirmada | Fan | Email (Brevo) |
| 50% alcanzado (50/100) | Artista + Fans | Email + in-app banner |
| 100% alcanzado (100/100) | Artista | Email urgente + in-app |
| Fulfillment report generado | Artista | Email con adjunto CSV/JSON |
| Orden enviada por Diggers | Fan | Email con tracking |

---

## 10. ESTRUCTURA DE ARCHIVOS A CREAR

```
BOOSTIFY-MUSIC/
├── add-vinyl-tables.mjs                          ← Migración DB
├── server/
│   ├── routes/
│   │   └── vinyl.ts                              ← API routes
├── client/src/
│   └── components/
│       └── vinyl/
│           ├── spinning-vinyl.tsx                ← Animación del disco
│           └── vinyl-preorder-module.tsx         ← Módulo completo
```

---

## 11. INTEGRACIÓN EN EL PERFIL DEL ARTISTA

Se añade el módulo `'vinyl-records'` al array `defaultOrder` en `artist-profile-card.tsx`:

```typescript
// En defaultOrder:
'vinyl-records', // después de 'merchandise'

// En sectionsConfig:
'vinyl-records': { name: 'Vinyl Records', icon: Disc3, isOwnerOnly: false },

// En renderSection():
case 'vinyl-records':
  return <VinylPreorderModule artist={artist} />;
```

---

## 12. PLAN DE IMPLEMENTACIÓN (FASES)

### FASE 1 — MVP (Implementar ahora)
- [x] Plan y arquitectura
- [ ] Migración DB (`add-vinyl-tables.mjs`)
- [ ] Server routes (`server/routes/vinyl.ts`)
- [ ] SpinningVinyl animation component
- [ ] VinylPreorderModule UI completo
- [ ] Registro de ruta en `server/index.ts`
- [ ] Integración en `artist-profile-card.tsx`

### FASE 2 — Pagos Reales
- [ ] Stripe Checkout Session con capture_method: 'manual'
- [ ] Webhook handler: captura masiva al llegar a 100 unidades
- [ ] Email de confirmación al fan (Brevo)
- [ ] Email de alerta al artista

### FASE 3 — Fulfillment
- [ ] Generador de reporte CSV/JSON compatible con Diggers Factory
- [ ] Descarga de portada en template de Diggers Factory (3150×3150 px)
- [ ] Dashboard de fulfillment para el artista
- [ ] Auto-capture de todos los PaymentIntents al alcanzar el mínimo

### FASE 4 — Automatización Avanzada
- [ ] Monitoreo de API de Diggers Factory (si la publican en el futuro)
- [ ] Tracking de envío integrado
- [ ] Múltiples campañas concurrentes por artista
- [ ] Ediciones limitadas con numeración a mano

---

## 13. CONSIDERACIONES LEGALES Y ROYALTIES

- El artista es responsable de tener los derechos para prensar el material
- Diggers Factory requiere prueba de afiliación a organización de copyright (BMI, ASCAP, SDRM, etc.)
- Boostify debe incluir en el formulario: checkbox de confirmación de derechos + campo para organización de copyright
- **Mastering para vinilo**: El audio para vinilo requiere mastering especial (corte de frecuencias, RIAA equalization). Costo: ~€60/track en Diggers Factory. El módulo debe ofrecer esta opción.

---

## 14. PRICING FINAL (EJEMPLO CONCRETO)

```
Artista: REDWINE - ISLA CALLADA
Álbum: "Isla Callada" en vinilo 12" LP negro 140g, 100 unidades

Cotización Diggers Factory:
  Producción 100 uds.:  $1,800 USD
  Mastering (2 tracks): $134 USD (€120 convertidos)
  TOTAL producción:     $1,934 USD

Cálculo en Boostify:
  Costo por unidad:     $1,934 / 100 = $19.34
  Markup 100%:          $19.34 × 2  = $38.68 → redondeado: $39.00 USD
  Envío estimado:       $12.00 USD (flat rate)
  
  PRECIO AL FAN:        $51.00 USD (vinilo + envío)
  GANANCIA artista:     $19.66/unidad × 100 = $1,966 USD
  COMISIÓN Boostify:    10% de ganancia = $196 USD
  NETO artista:         ~$1,770 USD para 100 unidades vendidas
```

---

## 15. REFERENCIA TÉCNICA RÁPIDA

```bash
# Correr migración
node add-vinyl-tables.mjs

# Endpoints principales
GET  /api/vinyl/:artistId/campaigns
POST /api/vinyl/campaigns          { artistId, title, coverImage1000, tracklist, specs, productionCostTotal }
GET  /api/vinyl/campaigns/:id
POST /api/vinyl/campaigns/:id/checkout  { quantity, buyerEmail, shippingAddress }
POST /api/vinyl/webhook             [Stripe webhook]
GET  /api/vinyl/campaigns/:id/orders
POST /api/vinyl/campaigns/:id/fulfill   [genera fulfillment report + captura Stripe]
```
