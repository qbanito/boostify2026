# 📋 INVENTARIO COMPLETO DE PÁGINAS - BOOSTIFY

**Total de Páginas**: 100 archivos .tsx  
**Recomendación**: Reducir a ~30-40 páginas esenciales

---

## 🚨 PÁGINAS DUPLICADAS / VERSIONES ANTIGUAS (Eliminar: ~15 páginas)

| Página Antigua | Página Nueva | Acción |
|----------------|--------------|--------|
| `ai-advisors.tsx` | `ai-advisors-v2.tsx` | ❌ Eliminar antigua |
| `artist-image-advisor.tsx` | `artist-image-advisor-improved.tsx` | ❌ Eliminar antigua |
| `course-detail.tsx` | `course-detail-new.tsx` | ❌ Eliminar antigua |
| `education.tsx` | `education-new.tsx` | ❌ Eliminar antigua |
| `instagram-boost-old.tsx` | `instagram-boost.tsx` | ❌ Eliminar antigua |
| `image-generator.tsx` | `image-generator-simple.tsx` | ⚠️ Consolidar en 1 |
| `music-video-workflow-page.tsx` | `music-video-workflow-enhanced.tsx` | ⚠️ Consolidar en 1 |
| `youtube-views.tsx.backup` | - | ❌ Eliminar backup |

---

## 🧪 PÁGINAS DE TESTING/DEBUG (Eliminar: ~12 páginas)

**Candidatas a Eliminación:**
- ❌ `camera-movements-test.tsx`
- ❌ `debug-firebase.tsx`
- ❌ `diagnostics.tsx`
- ❌ `init-products.tsx` (script de inicialización)
- ❌ `kling-test.tsx`
- ❌ `layer-filter-demo.tsx`
- ❌ `subscription-example.tsx`
- ❌ `test-page.tsx`
- ❌ `test-progress.tsx`
- ❌ `timeline-demo.tsx`
- ❌ `video-generation-test.tsx`
- ⚠️ `animated-workflow.tsx` (¿demo o real?)

---

## ✅ PÁGINAS ESENCIALES (MANTENER: ~15 páginas)

### **Autenticación & Onboarding**
- ✅ `auth-page.tsx`
- ✅ `login.tsx`
- ✅ `auth-signup.tsx`
- ✅ `home.tsx`

### **Dashboard & Perfil**
- ✅ `dashboard.tsx`
- ✅ `profile.tsx`
- ✅ `account.tsx`
- ✅ `settings.tsx`

### **Pricing & Subscripciones**
- ✅ `pricing.tsx`
- ✅ `music-video-pricing.tsx`
- ✅ `subscription-success.tsx`
- ✅ `subscription-cancelled.tsx`

### **Legal**
- ✅ `terms.tsx`
- ✅ `privacy.tsx`
- ✅ `cookies.tsx`

### **Errores**
- ✅ `not-found.tsx`

---

## 🎵 PÁGINAS DE MÚSICA & VIDEOS (CONSOLIDAR: 10 → 5 páginas)

### **Music Video Creation** (3 páginas → 1)
- ⚠️ `music-video-creator.tsx` (¿principal?)
- ⚠️ `music-video-workflow-page.tsx` (¿duplicado?)
- ⚠️ `music-video-workflow-enhanced.tsx` (¿versión mejorada?)
- **Acción**: Consolidar en 1 sola página

### **Music Generation**
- ✅ `music-generator.tsx`
- ✅ `music-mastering.tsx`

### **Motion DNA** (landing page premium Q2 2026)
- ✅ `motion-dna.tsx`

### **Resultados**
- ✅ `music-video-success.tsx`
- ✅ `music-video-cancelled.tsx`

### **AI Video**
- ⚠️ `ai-video-creation.tsx` (¿diferente a music-video-creator?)

---

## 🤖 PÁGINAS DE AI & HERRAMIENTAS (CONSOLIDAR: 15 → 8 páginas)

### **AI Agents & Advisors**
- ✅ `ai-agents.tsx`
- ✅ `ai-advisors-v2.tsx` (mantener v2)
- ❌ `ai-advisors.tsx` (eliminar)
- ✅ `artist-image-advisor-improved.tsx` (mantener improved)
- ❌ `artist-image-advisor.tsx` (eliminar)

### **Image Generation**
- ✅ `image-generator-simple.tsx` (consolidar con image-generator)
- ❌ `image-generator.tsx` (si es menos usada)
- ✅ `artist-generator.tsx`
- ✅ `face-swap.tsx`

### **Kling (Video AI)**
- ⚠️ `kling-tools.tsx`
- ⚠️ `kling-store.tsx`
- ❌ `kling-test.tsx` (test page)
- **Acción**: ¿Consolidar en 1 página Kling?

### **Otras Herramientas**
- ⚠️ `real-time-translator.tsx`
- ⚠️ `try-on-page.tsx`
- ⚠️ `professional-editor.tsx`

---

## 📊 PÁGINAS DE ANALYTICS & GROWTH (MANTENER: 8 páginas)

- ✅ `analytics.tsx`
- ✅ `instagram-boost.tsx`
- ✅ `youtube-views.tsx`
- ✅ `spotify.tsx`
- ✅ `promotion.tsx`
- ✅ `global.tsx`
- ✅ `pr.tsx`
- ⚠️ `manager-tools.tsx`
- ⚠️ `producer-tools.tsx`

---

## 🎓 PÁGINAS DE EDUCACIÓN & CONTENIDO (CONSOLIDAR: 10 → 6 páginas)

### **Education Hub**
- ✅ `education-new.tsx` (mantener new)
- ❌ `education.tsx` (eliminar)
- ✅ `course-detail-new.tsx` (mantener new)
- ❌ `course-detail.tsx` (eliminar)
- ✅ `achievements-page.tsx`

### **Content Pages**
- ✅ `blog.tsx`
- ✅ `article.tsx` (para posts individuales)
- ✅ `news.tsx`
- ⚠️ `tips.tsx`
- ⚠️ `guides.tsx`
- ⚠️ `resources.tsx`
- **Acción**: ¿Consolidar tips/guides/resources en blog?

---

## 👥 PÁGINAS SOCIALES & COMUNIDAD (CONSOLIDAR: 8 → 4 páginas)

### **Social Network**
- ⚠️ `social-network.tsx`
- ⚠️ `firestore-social.tsx`
- **Acción**: ¿Son 2 implementaciones diferentes? Consolidar

### **Artist Profiles**
- ✅ `artist-profile.tsx`
- ✅ `my-artist.tsx`
- ✅ `my-artists.tsx`

### **Communication**
- ✅ `messages.tsx`
- ✅ `contacts.tsx`

### **Events**
- ⚠️ `events.tsx`

---

## 💼 PÁGINAS DE NEGOCIO & SERVICIOS (MANTENER: 8 páginas)

### **Record Label & Services**
- ✅ `record-label-services.tsx`
- ✅ `virtual-record-label.tsx`
- ✅ `contracts.tsx`

### **E-commerce**
- ✅ `store.tsx`
- ✅ `merchandise.tsx`
- ⚠️ `tokenization.tsx`

### **Business Tools**
- ✅ `investors-dashboard.tsx`
- ✅ `affiliates.tsx`
- ⚠️ `affiliate-redirect.tsx`

---

## 🌍 PÁGINAS DE DISTRIBUCIÓN GLOBAL (CONSOLIDAR: 3 → 1 página?)

- ⚠️ `boostify-international.tsx`
- ⚠️ `boostify-tv.tsx`
- ⚠️ `boostify-explicit.tsx`
- **Acción**: ¿Consolidar en 1 página con tabs?

---

## 🎨 PÁGINAS ESPECIALES & FEATURES (EVALUAR: 8 páginas)

- ⚠️ `ecosystem.tsx`
- ⚠️ `smart-cards.tsx`
- ⚠️ `features.tsx`
- ⚠️ `tools.tsx`
- ⚠️ `plugins.tsx`
- ⚠️ `videos.tsx`
- ⚠️ `artist-dashboard.tsx`
- **Acción**: Evaluar si están en uso activo

---

## 🔧 PÁGINAS ADMINISTRATIVAS (MANTENER: 1 página)

- ✅ `admin.tsx`

---

## 📊 RESUMEN DE SIMPLIFICACIÓN

### **Acción Inmediata - Eliminar (~30 páginas)**

#### ❌ **Duplicados Confirmados (8 páginas)**
```bash
rm client/src/pages/ai-advisors.tsx
rm client/src/pages/artist-image-advisor.tsx
rm client/src/pages/course-detail.tsx
rm client/src/pages/education.tsx
rm client/src/pages/instagram-boost-old.tsx
rm client/src/pages/youtube-views.tsx.backup
```

#### ❌ **Testing/Debug (12 páginas)**
```bash
rm client/src/pages/camera-movements-test.tsx
rm client/src/pages/debug-firebase.tsx
rm client/src/pages/diagnostics.tsx
rm client/src/pages/init-products.tsx
rm client/src/pages/kling-test.tsx
rm client/src/pages/layer-filter-demo.tsx
rm client/src/pages/subscription-example.tsx
rm client/src/pages/test-page.tsx
rm client/src/pages/test-progress.tsx
rm client/src/pages/timeline-demo.tsx
rm client/src/pages/video-generation-test.tsx
rm client/src/pages/animated-workflow.tsx
```

### **Consolidación Sugerida (~20 páginas → 10)**

1. **Music Video**: 3 páginas → 1 página principal
2. **Image Generator**: 2 páginas → 1 página
3. **Kling Tools**: 3 páginas → 1 página
4. **Education Content**: tips/guides/resources → incluir en blog
5. **Social Network**: 2 implementaciones → 1 sola
6. **Boostify Global**: 3 páginas → 1 con tabs

### **Resultado Final Esperado**

- **Antes**: 100 páginas
- **Eliminar duplicados/tests**: -20 páginas
- **Consolidar similares**: -20 páginas
- **Después**: ~60 páginas (mejor, pero aún se puede optimizar)
- **Ideal**: 30-40 páginas core

---

## 🎯 RECOMENDACIÓN FINAL

### **FASE 1: Limpieza Rápida (Hoy)**
Eliminar 20 páginas de testing y duplicados obvios → **80 páginas restantes**

### **FASE 2: Consolidación (Esta semana)**
Consolidar funcionalidades similares → **50-60 páginas**

### **FASE 3: Optimización (Próxima semana)**
Evaluar métricas de uso real y eliminar lo no usado → **30-40 páginas finales**

---

## ❓ PREGUNTAS PARA TI

1. **¿Cuáles de estas páginas usan tus usuarios activamente?**
   - Analytics en Plausible/Google Analytics podría ayudar

2. **¿Qué funcionalidades son críticas para Q1 2026?**
   - Priorizar esas y postergar/eliminar el resto

3. **¿Cuál es tu público objetivo principal?**
   - Artistas emergentes → Enfocarse en creator tools
   - Record labels → Enfocarse en business tools
   - Ambos → Necesitas 2 dashboards separados

**¿Por dónde quieres empezar? Te sugiero comenzar eliminando los duplicados y test pages (20 archivos fáciles).**
