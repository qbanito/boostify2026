# 🎵 Sistema de Automatización de Emails para Artistas - Boostify Music

Sistema completamente separado del outreach de inversores, diseñado específicamente para convertir artistas en usuarios activos de la plataforma.

## 📋 Índice

1. [Descripción General](#descripción-general)
2. [Configuración de API Keys](#configuración-de-api-keys)
3. [Estructura de Archivos](#estructura-de-archivos)
4. [Secuencia de 10 Emails](#secuencia-de-10-emails)
5. [Uso del Sistema](#uso-del-sistema)
6. [Automatización con GitHub Actions](#automatización-con-github-actions)
7. [Firestore Schema](#firestore-schema)

---

## 🎯 Descripción General

Este sistema automatiza el proceso de conversión de leads de artistas en usuarios activos de Boostify Music. Incluye:

- **Scraping de leads** usando Apify actor `code_crafter/leads-finder`
- **Secuencia de 10 emails** con diseño profesional orientado a artistas
- **Integración con Resend** para envío de emails
- **Firestore** para gestión de leads y tracking

### URLs Promocionadas

| Página | URL | Descripción |
|--------|-----|-------------|
| My Artists | `https://boostifymusic.com/my-artists` | Crear página de artista gratis |
| Ejemplo | `https://boostifymusic.com/artist/birdie-krajcik` | Página de artista demo |
| BoostiSwap | `https://boostifymusic.com/boostiswap` | Colaboraciones entre artistas |
| YouTube Views | `https://boostifymusic.com/youtube-views` | Aumentar vistas de YouTube |

---

## 🔑 Configuración de API Keys

### Resend (Artistas - SEPARADO de inversores)
```
API Key: re_Q73PRQ8o_8wYWWVHufVwDocuKaLRrVJhf
From: artistas@boostifymusic.com
```

### Apify
```
API Key: apify_api_nrudThRO1hQ9XCTFzUZkRI0VKCcSkv2h3mYq
Actor: code_crafter/leads-finder
```

### Variables de Entorno Requeridas

```bash
# .env o GitHub Secrets
ARTIST_RESEND_API_KEY=re_Q73PRQ8o_8wYWWVHufVwDocuKaLRrVJhf
APIFY_API_KEY=apify_api_nrudThRO1hQ9XCTFzUZkRI0VKCcSkv2h3mYq
FIREBASE_SERVICE_ACCOUNT=<JSON del service account>
```

---

## 📁 Estructura de Archivos

```
scripts/artist-outreach/
├── artist-email-templates.ts   # 10 templates de email con diseño
├── apify-artist-scraper.ts     # Scraper de leads de artistas
├── artist-outreach.ts          # Sistema de envío automatizado
└── ARTIST_OUTREACH_GUIDE.md    # Esta documentación
```

---

## 📧 Secuencia de 10 Emails

### Email 1: Bienvenida 🎵
**Asunto:** `{{artistName}}, tu página de artista profesional te espera (GRATIS)`
**Objetivo:** Crear página de artista gratis
**Espera:** 0 días (inmediato)

### Email 2: Showcase 🌟
**Asunto:** `{{artistName}}, mira cómo estos artistas están creciendo con Boostify`
**Objetivo:** Mostrar casos de éxito
**Espera:** 2 días

### Email 3: BoostiSwap 🤝
**Asunto:** `{{artistName}}, conecta con artistas que quieren colaborar contigo`
**Objetivo:** Promocionar BoostiSwap
**Espera:** 3 días

### Email 4: YouTube Views 📈
**Asunto:** `{{artistName}}, multiplica las vistas de tus videos de YouTube`
**Objetivo:** Promocionar herramientas de YouTube
**Espera:** 4 días

### Email 5: Recordatorio 👋
**Asunto:** `{{artistName}}, tu página de artista sigue esperándote`
**Objetivo:** Re-engagement
**Espera:** 5 días

### Email 6: Testimonials 💬
**Asunto:** `"Boostify cambió mi carrera" - Lee lo que dicen otros artistas`
**Objetivo:** Social proof con testimonios
**Espera:** 4 días

### Email 7: Analytics 📊
**Asunto:** `{{artistName}}, conoce a tus fans como nunca antes`
**Objetivo:** Destacar analytics profesionales
**Espera:** 4 días

### Email 8: Urgency 🔥
**Asunto:** `{{artistName}}, última oportunidad: Premium GRATIS por 1 año`
**Objetivo:** Crear urgencia con oferta limitada
**Espera:** 5 días

### Email 9: Social Proof 🚀
**Asunto:** `{{artistName}}, ya somos +5,000 artistas creciendo juntos`
**Objetivo:** Mostrar tamaño de comunidad
**Espera:** 5 días

### Email 10: Final 💜
**Asunto:** `{{artistName}}, este es mi último mensaje (por ahora)`
**Objetivo:** Cierre emocional + resumen de beneficios
**Espera:** 7 días

---

## 🚀 Uso del Sistema

### Instalación de Dependencias

```bash
npm install resend apify-client firebase-admin
```

### Comandos Disponibles

#### 1. Scraper de Artistas

```bash
# Scraping con queries en español
npx ts-node scripts/artist-outreach/apify-artist-scraper.ts scrape spanish

# Scraping con queries en inglés
npx ts-node scripts/artist-outreach/apify-artist-scraper.ts scrape english

# Importar desde dataset existente
npx ts-node scripts/artist-outreach/apify-artist-scraper.ts import-dataset <datasetId>

# Importar desde archivo JSON
npx ts-node scripts/artist-outreach/apify-artist-scraper.ts import-file ./leads.json
```

#### 2. Sistema de Outreach

```bash
# Enviar emails de bienvenida a nuevos leads
npx ts-node scripts/artist-outreach/artist-outreach.ts welcome

# Procesar cola de emails (enviar siguientes en secuencia)
npx ts-node scripts/artist-outreach/artist-outreach.ts process 100

# Ver estadísticas de la campaña
npx ts-node scripts/artist-outreach/artist-outreach.ts stats

# Ejecutar rutina diaria completa
npx ts-node scripts/artist-outreach/artist-outreach.ts run-daily

# Modo dry-run (preview sin enviar)
npx ts-node scripts/artist-outreach/artist-outreach.ts welcome --dry-run
```

---

## ⚙️ Automatización con GitHub Actions

Crea el archivo `.github/workflows/artist-outreach.yml`:

```yaml
name: 🎵 Artist Outreach Automation

on:
  schedule:
    # Ejecutar diariamente a las 10:00 AM UTC
    - cron: '0 10 * * *'
  workflow_dispatch:
    inputs:
      action:
        description: 'Action to perform'
        required: true
        default: 'run-daily'
        type: choice
        options:
          - run-daily
          - welcome
          - process
          - stats

env:
  ARTIST_RESEND_API_KEY: ${{ secrets.ARTIST_RESEND_API_KEY }}
  APIFY_API_KEY: ${{ secrets.APIFY_API_KEY }}
  FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}

jobs:
  artist-outreach:
    runs-on: ubuntu-latest
    steps:
      - name: 📥 Checkout code
        uses: actions/checkout@v4

      - name: 📦 Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: 📚 Install dependencies
        run: npm ci

      - name: 🎵 Run artist outreach
        run: |
          npx ts-node scripts/artist-outreach/artist-outreach.ts ${{ github.event.inputs.action || 'run-daily' }}
```

### Secrets Requeridos en GitHub

| Secret | Valor |
|--------|-------|
| `ARTIST_RESEND_API_KEY` | `re_Q73PRQ8o_8wYWWVHufVwDocuKaLRrVJhf` |
| `APIFY_API_KEY` | `apify_api_nrudThRO1hQ9XCTFzUZkRI0VKCcSkv2h3mYq` |
| `FIREBASE_SERVICE_ACCOUNT` | JSON del service account |

---

## 🗄️ Firestore Schema

### Colección: `artist_leads`

```typescript
interface ArtistLead {
  id: string;                    // Document ID
  email: string;                 // Email del artista
  name: string;                  // Nombre real
  artistName?: string;           // Nombre artístico
  genre?: string;                // Género musical
  platform?: string;             // Plataforma principal
  followers?: number;            // Número de seguidores
  source: string;                // Fuente del lead
  status: ArtistStatus;          // Estado actual
  currentSequence: number;       // Email actual en secuencia (0-10)
  lastEmailSent?: Timestamp;     // Último email enviado
  createdAt: Timestamp;          // Fecha de creación
  activatedAt?: Timestamp;       // Fecha de activación
  metadata?: {
    instagram?: string;
    spotify?: string;
    youtube?: string;
    website?: string;
    bio?: string;
    location?: string;
  };
  emailHistory?: {
    [key: string]: {
      sentAt?: Timestamp;
      attemptedAt?: Timestamp;
      success: boolean;
    };
  };
}

type ArtistStatus = 
  | 'new'
  | 'sequence_1' | 'sequence_2' | 'sequence_3'
  | 'sequence_4' | 'sequence_5' | 'sequence_6'
  | 'sequence_7' | 'sequence_8' | 'sequence_9'
  | 'sequence_10'
  | 'activated'
  | 'unsubscribed';
```

### Reglas de Firestore

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artist_leads/{leadId} {
      // Solo acceso desde backend (Admin SDK)
      allow read, write: if false;
    }
  }
}
```

---

## 📊 Métricas y Tracking

El sistema trackea automáticamente:

- **Total de leads** por estado
- **Progreso en secuencia** (cuántos en cada paso)
- **Tasa de conversión** (leads activados vs total)
- **Historial de emails** por lead

### Ver Estadísticas

```bash
npx ts-node scripts/artist-outreach/artist-outreach.ts stats
```

Salida ejemplo:
```
🎵 BOOSTIFY ARTIST OUTREACH - Campaign Statistics
══════════════════════════════════════════════════

📊 Total Artist Leads: 1,247

📈 By Status:
   new              150 ██████████████
   sequence_1       320 ████████████████████████████████
   sequence_2       250 █████████████████████████
   sequence_3       180 ██████████████████
   activated        347 ███████████████████████████████████

📧 By Email Sequence:
   Not started       150 ██████████████
   Email 1           320 ████████████████████████████████
   Email 2           250 █████████████████████████
   ...

🎯 Conversion Rate: 27.83%
```

---

## 🎨 Diseño de Emails

Los emails usan un diseño moderno y profesional con:

- **Fondo oscuro** con gradientes violeta/rosa
- **Tipografía Inter** para legibilidad
- **Botones CTA** con gradientes y sombras
- **Cards** para features y testimonios
- **Responsive design** para móviles

### Colores del Brand

| Color | Hex | Uso |
|-------|-----|-----|
| Primary | `#8B5CF6` | Violeta vibrante |
| Secondary | `#EC4899` | Rosa/Magenta |
| Accent | `#06B6D4` | Cyan |
| Gold | `#F59E0B` | Urgencia/Premium |
| Dark | `#0F0F23` | Fondo |

---

## ✅ Checklist de Implementación

- [x] Templates de 10 emails con diseño profesional
- [x] Scraper de Apify para leads de artistas
- [x] Sistema de envío automatizado
- [x] Integración con Firestore
- [x] Documentación completa
- [ ] Configurar GitHub Actions workflow
- [ ] Añadir secrets a GitHub
- [ ] Primera campaña de prueba

---

## 🆘 Soporte

Para problemas o preguntas sobre el sistema:

1. Revisa los logs de la ejecución
2. Verifica las API keys
3. Comprueba la conexión con Firestore
4. Revisa el estado de los leads en Firebase Console

---

*Última actualización: Enero 2025*
