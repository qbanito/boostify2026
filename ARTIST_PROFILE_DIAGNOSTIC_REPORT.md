# 🔬 BOOSTIFY ARTIST PROFILE — DIAGNOSTIC COMPLETO DEL SISTEMA
**Fecha:** Junio 2025  
**Archivos auditados:** `artist-profile-card.tsx` · `useProfileLayout.ts` · `server/routes.ts`  
**Estado del sistema tras las correcciones:** ✅ SINCRONIZADO

---

## 📋 INVENTARIO COMPLETO DE MÓDULOS (40 módulos + 11 widgets)

### 🎵 MÚSICA
| ID | Nombre | isOwnerOnly | Backend Route | Render Block | NODE DEF | Visibility Default |
|----|--------|-------------|---------------|--------------|----------|--------------------|
| `songs` | Music 🎵 | ❌ público | `/api/songs` | ✅ L6829 | ✅ MUSIC | ✅ `true` |
| `videos` | Videos 🎬 | ❌ público | `/api/videos` | ✅ L7944 | ✅ MUSIC | ✅ `true` |
| `karaoke` | Karaoke 🎤 | ❌ público | `/api/karaoke` | ✅ L9440 | ✅ MUSIC | ✅ `true` |
| `avatar-talk` | Avatar Talk 🎬 | ❌ público | `/api/avatar-talk` | ✅ L9450 | ✅ MUSIC | ✅ `true` |
| `promo-clips` | Promo Clips 🎬 | ✅ owner | `/api/promo-clips` | ✅ L9405 | ✅ MUSIC | ✅ `true` |
| `galleries` | Image Galleries 🖼️ | ❌ público | `/api/image-gallery` | ✅ L8784 | ✅ MUSIC | ✅ `true` |
| `downloads` | Downloads 📥 | ❌ público | `/api/files` | ✅ L8798 | ✅ MUSIC | ❌ `false` |

### 📡 SOCIAL
| ID | Nombre | isOwnerOnly | Backend Route | Render Block | NODE DEF | Visibility Default |
|----|--------|-------------|---------------|--------------|----------|--------------------|
| `social-hub` | Broadcast Studio 📡 | ❌ público | `/api/social-integration` | ✅ L8496 | ✅ SOCIAL | ❌ `false` |
| `social-posts` | Social Posts 📲 | ❌ público | `/api/social-network` | ✅ L8650 | ✅ SOCIAL | ❌ `false` |
| `news` | News 📰 | ❌ público | `/api/news` | ✅ L8395 | ✅ SOCIAL | ❌ `false` |
| `explicit-content` | Inner Circle 💎 | ❌ público | `/api/explicit` | ✅ L9056 | ✅ SOCIAL | ❌ `false` |
| `talk-to-me` | Talk To Me 📞 | ❌ público | `/api/talk-to-me` | ✅ L9163 | ✅ CREATIVE | ✅ `true` |

### 🛍️ COMERCIO
| ID | Nombre | isOwnerOnly | Backend Route | Render Block | NODE DEF | Visibility Default |
|----|--------|-------------|---------------|--------------|----------|--------------------|
| `merchandise` | Merchandise 👕 | ❌ público | `/api/merch` | ✅ L8673 | ✅ COMMERCE | ❌ `false` |
| `amazon-picks` | Amazon Picks 🛍️ | ❌ público | `/api/amazon-curated` | ✅ L9176 | ✅ COMMERCE | ❌ `false` |
| `tokenization` | Token Assets 🪙 | ✅ owner | `/api/tokenization` | ✅ L8659 | ✅ COMMERCE | ❌ `false` |
| `monetize-cta` | Monetize Talent ✨ | ❌ público | `/api/monetization` | ✅ L8812 | ✅ COMMERCE | ❌ `false` |

### 💸 MONETIZACIÓN
| ID | Nombre | isOwnerOnly | Backend Route | Render Block | NODE DEF | Visibility Default |
|----|--------|-------------|---------------|--------------|----------|--------------------|
| `earnings` | Earnings 💸 | ✅ owner | `/api/monetization` | ✅ L9014 | ✅ MONETIZE | ❌ `false` |
| `crowdfunding` | Crowdfunding 🎯 | ✅ owner | `/api/crowdfunding` | ✅ L9026 | ✅ MONETIZE | ❌ `false` |
| `sponsors` | Sponsor Acquisition 🤝 | ✅ owner | `/api/sponsors` | ✅ L9036 | ✅ MONETIZE | ❌ `false` |
| `venueBooking` | Venue Booking 📍 | ✅ owner | `/api/venue-outreach` | ✅ L9046 | ✅ MONETIZE | ❌ `false` |

### 📈 GROWTH
| ID | Nombre | isOwnerOnly | Backend Route | Render Block | NODE DEF | Visibility Default |
|----|--------|-------------|---------------|--------------|----------|--------------------|
| `analytics` | Observatory 📡 | ✅ owner | `/api/platform-analytics` | ✅ L8916 | ✅ GROWTH | ❌ `false` |
| `aas-engine` | Genesis Engine ⚡ | ✅ owner | `/api/aas` | ✅ L9070 | ✅ GROWTH | ❌ `false` |
| `audience-engine` | Signal Pulse 🎯 | ✅ owner | `/api/audience-capture` | ✅ L9084 | ✅ GROWTH | ✅ `true` |
| `influencer-module` | Amplify Network 📢 | ✅ owner | `/api/influencer-content` | ✅ L9152 | ✅ GROWTH | ❌ `false` |
| `viral-products` | Ecosystem Drops 🔥 | ✅ owner | `/api/viral-products` | ✅ L9101 | ✅ GROWTH | ❌ `false` |
| `ads-campaigns` | Ads Campaign Manager 📣 | ✅ owner | `/api/ads-campaigns` | ✅ L9417 | ✅ GROWTH | ❌ `false` |

### 💼 BUSINESS
| ID | Nombre | isOwnerOnly | Backend Route | Render Block | NODE DEF | Visibility Default |
|----|--------|-------------|---------------|--------------|----------|--------------------|
| `business-plan` | Commerce Blueprint 💎 | ❌ público | `/api/business-plan` | ✅ L9118 | ✅ BUSINESS | ✅ `true` |
| `career-suite` | The Atelier 🧠 | ✅ owner | `/api/artist/suite` | ✅ L9199 | ✅ BUSINESS | ❌ `false` |
| `artist-blueprint` | Grand Design 🏆 | ❌ público | `/api/artist-blueprint` | ✅ L9236 | ✅ BUSINESS | ✅ `true` |
| `brand-collabs` | The Forge 🤝 | ✅ owner | `/api/influencer-brands` | ✅ L9137 | ✅ BUSINESS | ❌ `false` |
| `observation-engine` | Observation Engine 🔭 | ✅ owner | Uses `/api/aas/score` | ✅ L9364 | ✅ BUSINESS | ❌ `false` |
| `deep-brief` | Deep Brief 💡 | ✅ owner | localStorage only | ✅ L9381 | ✅ BUSINESS | ❌ `false` |

### 🪪 IDENTITY
| ID | Nombre | isOwnerOnly | Backend Route | Render Block | NODE DEF | Visibility Default |
|----|--------|-------------|---------------|--------------|----------|--------------------|
| `electronic-press-kit` | Press Room 📰 | ❌ público | `/api/epk` | ✅ L9302 | ✅ IDENTITY | ❌ `false` |
| `agent-gateway` | The Gateway 🛡️ | ❌ público | `/api/agent-gateway` | ✅ L9320 | ✅ IDENTITY | ✅ `true` |
| `hermes-agent` | The Codex 📓 | ✅ owner | `/api/artist-hermes` | ✅ L9288 | ✅ IDENTITY | ❌ `false` |
| `artist-domain` | My Domain 🌐 | ✅ owner | `/api/artist-domain` | ✅ L9277 | ✅ IDENTITY | ❌ `false` |

### 🎨 CREATIVE
| ID | Nombre | isOwnerOnly | Backend Route | Render Block | NODE DEF | Visibility Default |
|----|--------|-------------|---------------|--------------|----------|--------------------|
| `renaissance-studio` | Renaissance Studio ✨ | ❌ público | `/api/mini-studio` | ✅ L9350 | ✅ CREATIVE | ✅ `true` |
| `hologram` | HoloStage Live 🎭 | ❌ público | `/api/hologram-gallery` + `/api/hologram-show` | ✅ L9339 | ✅ CREATIVE | ✅ `true` |
| `emotional-studio` | Emotional Studio 🎭 | ✅ owner | `/api/emotional-studio` | ✅ L9394 | ✅ CREATIVE | ❌ `false` |
| `gamma-presentations` | Gamma Presentations 🎯 | ✅ owner | `/api/gamma-presentations` | ✅ L9428 | ✅ CREATIVE | ❌ `false` |

---

## 🔴 GAPS ENCONTRADOS (pre-corrección)

### GAP CRÍTICO #1: `ads-campaigns` faltaba en `useProfileLayout.ts`
- **Problema**: Completamente ausente de `MODULE_DEFS` y `DEFAULT_VISIBILITY` del Node Flow.
- **Impacto**: No aparecía como nodo en el editor de nodos. El artista no podía activarlo/desactivarlo desde el Node Flow.
- **Fix aplicado**: Añadido a `MODULE_DEFS` (categoría GROWTH, isOwnerOnly: true) y `DEFAULT_VISIBILITY` (false).

### GAP CRÍTICO #2: `gamma-presentations` faltaba en `useProfileLayout.ts`
- **Problema**: Completamente ausente de `MODULE_DEFS` y `DEFAULT_VISIBILITY` del Node Flow.
- **Impacto**: Idéntico al anterior — invisible para el sistema de nodos.
- **Fix aplicado**: Añadido a `MODULE_DEFS` (categoría CREATIVE, isOwnerOnly: true) y `DEFAULT_VISIBILITY` (false).

### GAP #3: `talk-to-me` desincronizado entre los dos sistemas
- **Problema**: `artist-profile-card.tsx` tenía `'talk-to-me': true`, pero `useProfileLayout.ts` tenía `'talk-to-me': false`.
- **Impacto**: El módulo aparecía en el perfil pero el Node Flow lo marcaba como inactivo.
- **Fix aplicado**: `useProfileLayout.ts` actualizado a `'talk-to-me': true`.

### GAP #4: `talk-to-me` clasificado como SOCIAL en MODULE_DEFS
- **Problema**: `talk-to-me` estaba en categoría SOCIAL pero es un módulo de interacción creativa/avatar.
- **Fix aplicado**: Movido a categoría CREATIVE, color `#8b5cf6` (morado, mismo que hologram/renaissance).

### GAP #5: `ads-campaigns`, `gamma-presentations`, `hermes-agent` faltaban en `defaultVisibility` de `artist-profile-card.tsx`
- **Problema**: Tenían render blocks activos pero su visibilidad inicial era `undefined` (implícitamente false pero inconsistente).
- **Fix aplicado**: Añadidos con `false` (ads-campaigns, gamma-presentations) y `false` (hermes-agent).

### GAP #6: Edges inteligentes incompletos en `MODULE_EDGES`
- **Problema**: El grafo de nodos no reflejaba los flujos de datos reales entre módulos.
- **Edges faltantes:**
  - `songs → avatar-talk` (Avatar Talk consume canciones como input)
  - `promo-clips → ads-campaigns` (los clips se lanzan como anuncios)
  - `avatar-talk → ads-campaigns` (videos de avatar usados en campañas)
  - `artist-blueprint → gamma-presentations` (el blueprint alimenta las presentaciones)
  - `business-plan → gamma-presentations` (el plan alimenta los slide decks)
  - `renaissance-studio → talk-to-me` (el avatar del studio se usa en talk-to-me)
  - `agent-gateway → talk-to-me` (talk-to-me es parte del gateway)
- **Fix aplicado**: Todos los edges añadidos a `MODULE_EDGES`.

---

## ✅ ESTADO FINAL TRAS CORRECCIONES

| Sistema | Estado |
|---------|--------|
| `allSections` en artist-profile-card.tsx | ✅ 40 módulos completos |
| `defaultOrder` en artist-profile-card.tsx | ✅ 40 módulos en orden |
| `defaultVisibility` en artist-profile-card.tsx | ✅ 40 módulos declarados |
| Render blocks en artist-profile-card.tsx | ✅ 40 bloques (L6829–L9450+) |
| `MODULE_DEFS` en useProfileLayout.ts | ✅ 40 módulos + 11 widgets |
| `DEFAULT_VISIBILITY` en useProfileLayout.ts | ✅ Sincronizado con artist-profile-card.tsx |
| `MODULE_EDGES` inteligentes | ✅ Ampliado con 7 edges nuevos |
| Backend routes para todos los módulos | ✅ Todos cubiertos |

---

## 🕸️ GRAFO DE CONEXIONES INTELIGENTES (actualizado)

```
MUSIC COLUMN
songs ──────┬──→ karaoke
            ├──→ avatar-talk ─────→ ads-campaigns
            ├──→ promo-clips ─────→ ads-campaigns
            ├──→ downloads
            ├──→ tokenization ────→ earnings
            └──→ social-posts ←─── social-hub
videos ─────────→ social-posts          │
                                        └──→ news

SOCIAL COLUMN
social-hub ─────→ social-posts
                └──→ news

COMMERCE / MONETIZE
merchandise ────→ earnings
crowdfunding ───→ earnings
tokenization ───→ earnings

GROWTH COLUMN
analytics ──────→ aas-engine ──→ audience-engine ──→ influencer-module
analytics ──────→ earnings
observation-engine → analytics

BUSINESS COLUMN
deep-brief ─────→ business-plan ─┬──→ career-suite ──→ artist-blueprint ──→ brand-collabs
                                  └──→ gamma-presentations ←─── artist-blueprint

IDENTITY COLUMN
electronic-press-kit → agent-gateway ─┬──→ hermes-agent
                                       └──→ talk-to-me

CREATIVE COLUMN
renaissance-studio ─┬──→ hologram
                    └──→ talk-to-me
```

---

## 🗂️ COVERAGE BACKEND POR MÓDULO

| Módulo | Ruta API | Archivo |
|--------|----------|---------|
| songs | `/api/songs` | `server/routes/songs.ts` |
| videos | `/api/videos` | `server/routes/videos.ts` |
| karaoke | `/api/karaoke` | `server/routes/karaoke.ts` |
| avatar-talk | `/api/avatar-talk` | `server/routes/avatar-talk.ts` |
| promo-clips | `/api/promo-clips` | `server/routes/promo-clips.ts` |
| galleries | `/api/image-gallery` | `server/routes/image-gallery.ts` |
| downloads | `/api/files` | `server/routes/files.ts` |
| social-hub | `/api/social-integration` | `server/routes/social-integration.ts` |
| social-posts | `/api/social-network` | `server/routes/social-network.ts` |
| news | `/api/news` | `server/routes/news.ts` |
| explicit-content | `/api/explicit` | `server/routes/explicit.ts` |
| talk-to-me | `/api/talk-to-me` | `server/routes/talk-to-me.ts` |
| merchandise | `/api/merch` | `server/routes/merch.ts` |
| amazon-picks | `/api/amazon-curated` | `server/routes/amazon-curated.ts` |
| tokenization | `/api/tokenization` | `server/routes/tokenization.ts` |
| monetize-cta | `/api/monetization` | `server/routes/monetization.ts` |
| earnings | `/api/monetization` | `server/routes/monetization.ts` |
| crowdfunding | `/api/crowdfunding` | `server/routes/crowdfunding.ts` |
| sponsors | `/api/sponsors` | `server/routes/sponsor-api.ts` |
| venueBooking | `/api/venue-outreach` | `server/routes/venue-outreach.ts` |
| analytics | `/api/platform-analytics` | `server/routes/platform-analytics.ts` |
| aas-engine | `/api/aas` | `server/routes/aas-core.ts` |
| audience-engine | `/api/audience-capture` | `server/routes/audience-capture.ts` |
| influencer-module | `/api/influencer-content` | `server/routes/influencer-content.ts` |
| viral-products | `/api/viral-products` | `server/routes/viral-products.ts` |
| ads-campaigns | `/api/ads-campaigns` | `server/routes/ads-campaigns.ts` |
| business-plan | `/api/business-plan` | `server/routes/business-plan.ts` |
| career-suite | `/api/artist/suite` | `server/routes/artist-suite.ts` |
| artist-blueprint | `/api/artist-blueprint` | `server/routes/artist-blueprint.ts` |
| brand-collabs | `/api/influencer-brands` | `server/routes/influencer-brands.ts` |
| observation-engine | Uses `/api/aas/score` | `server/routes/aas-core.ts` |
| deep-brief | localStorage only | — |
| electronic-press-kit | `/api/epk` | `server/routes/epk.ts` |
| agent-gateway | `/api/agent-gateway` | `server/routes/agent-gateway.ts` |
| hermes-agent | `/api/artist-hermes` | `server/routes/artist-hermes-proxy.ts` |
| artist-domain | `/api/artist-domain` | `server/routes/artist-domain.ts` |
| renaissance-studio | `/api/mini-studio` | `server/routes/mini-studio.ts` |
| hologram | `/api/hologram-gallery` + `/api/hologram-show` | `server/routes/hologram-gallery.ts` |
| emotional-studio | `/api/emotional-studio` | `server/routes/emotional-studio.ts` |
| gamma-presentations | `/api/gamma-presentations` | `server/routes/gamma-presentations.ts` |

---

## 🚀 PLAN DE MEJORAS IMPLEMENTADAS (ya aplicadas)

### Capa 1: Sincronización del Node Flow (APLICADO ✅)
1. ~~`ads-campaigns` faltaba en MODULE_DEFS~~ → Añadido (GROWTH, isOwnerOnly: true)
2. ~~`gamma-presentations` faltaba en MODULE_DEFS~~ → Añadido (CREATIVE, isOwnerOnly: true)
3. ~~`ads-campaigns` faltaba en DEFAULT_VISIBILITY~~ → Añadido como `false`
4. ~~`gamma-presentations` faltaba en DEFAULT_VISIBILITY~~ → Añadido como `false`
5. ~~`talk-to-me` desincronizado~~ → Corregido a `true` en useProfileLayout.ts
6. ~~`talk-to-me` categoría incorrecta (SOCIAL)~~ → Movido a CREATIVE

### Capa 2: Sincronización de defaultVisibility del perfil (APLICADO ✅)
7. ~~`ads-campaigns` sin visibilidad declarada~~ → `false`
8. ~~`gamma-presentations` sin visibilidad declarada~~ → `false`
9. ~~`hermes-agent` sin visibilidad declarada~~ → `false`

### Capa 3: Edges inteligentes del Node Flow (APLICADO ✅)
10. ~~`songs → avatar-talk` faltaba~~ → Añadido
11. ~~`promo-clips → ads-campaigns` faltaba~~ → Añadido
12. ~~`avatar-talk → ads-campaigns` faltaba~~ → Añadido
13. ~~`artist-blueprint → gamma-presentations` faltaba~~ → Añadido
14. ~~`business-plan → gamma-presentations` faltaba~~ → Añadido
15. ~~`renaissance-studio → talk-to-me` faltaba~~ → Añadido
16. ~~`agent-gateway → talk-to-me` faltaba~~ → Añadido

---

## 🔮 PRÓXIMAS MEJORAS RECOMENDADAS (no aplicadas aún)

### Alta prioridad
- **Cross-module data sharing**: El módulo `avatar-talk` debería poder leer automáticamente la lista de canciones del artista (pre-poblar el selector de canciones desde el módulo `songs`).
- **observation-engine → analytics edge bidireccional**: La Observation Engine analiza el mercado y debería poder enviar señales a analytics, no solo leer de aas-engine.
- **Preset layouts**: Los presets (`performance`, `label`, `minimal`) deberían incluir `ads-campaigns` y `gamma-presentations` en el preset `full`.

### Media prioridad  
- **deep-brief → backend persistence**: Actualmente guarda en localStorage. Migrar a PostgreSQL para persistencia real entre dispositivos.
- **hologram → avatar-talk edge**: El HoloStage genera imágenes del artista; esas imágenes deberían poder usarse directamente como `image_url` en Avatar Talk.
- **observation-engine → renaissance-studio edge**: El análisis de mercado de Observation Engine debería informar el flujo creativo de Renaissance Studio.

### Baja prioridad
- **isOwnerOnly alignment audit**: Verificar que los módulos public-facing (`social-hub`, `news`, `galleries`) efectivamente no requieren `isOwnProfile` en sus render conditions.
- **Node Flow preset sync**: El sistema de preset layouts en artist-profile-card.tsx debería reflejar los mismos IDs en el Node Flow para que los presets activen los nodos correctos.

---

## 📊 RESUMEN EJECUTIVO

**Antes de las correcciones:**
- 2 módulos activos (`ads-campaigns`, `gamma-presentations`) completamente invisibles para el Node Flow editor
- 1 módulo (`talk-to-me`) con visibilidad desincronizada entre los dos sistemas
- 1 módulo (`talk-to-me`) en categoría incorrecta en el grafo de nodos  
- 3 módulos sin `defaultVisibility` declarada en el perfil
- 7 conexiones lógicas faltantes en el grafo inteligente

**Después de las correcciones:**
- ✅ Los 40 módulos están registrados en los 4 mapas de registro del perfil
- ✅ Los 40 módulos tienen entrada en MODULE_DEFS del Node Flow
- ✅ Los 40 módulos tienen DEFAULT_VISIBILITY declarada en ambos sistemas
- ✅ `DEFAULT_VISIBILITY` sincronizada entre `artist-profile-card.tsx` y `useProfileLayout.ts`
- ✅ 20 edges inteligentes en el grafo de nodos (vs 13 anteriores)
- ✅ Todos los módulos tienen cobertura de backend

**El sistema de nodos ahora responde de forma inteligente** — las conexiones entre módulos reflejan los flujos de datos reales: canciones alimentan karaoke/avatar/clips; los clips y avatares alimentan las campañas de ads; el blueprint y business plan alimentan las presentaciones gamma; el gateway conecta con talk-to-me.
