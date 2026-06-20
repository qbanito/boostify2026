# Publicar Boostify YouTube Sync en Chrome Web Store

## Resumen

Una vez publicada, los usuarios instalan con **1 clic** ("Añadir a Chrome") — sin ZIP, sin modo desarrollador.

---

## Paso 1 — Crear cuenta de desarrollador ($5 una vez)

1. Ve a **https://chrome.google.com/webstore/devconsole**
2. Inicia sesión con tu cuenta de Google
3. Paga la tarifa única de **$5 USD**
4. Completa la verificación de identidad

---

## Paso 2 — Generar el ZIP para subir

Desde la carpeta `boostify-youtube-extension/`:

```bash
npm run build:store
```

Esto genera `boostify-youtube-sync-chrome-web-store.zip` listo para subir.

> El script automáticamente usa `manifest.production.json` (sin permisos de localhost).

---

## Paso 3 — Subir la extensión

1. En el [Developer Dashboard](https://chrome.google.com/webstore/devconsole), clic en **"New Item"**
2. Sube el archivo `boostify-youtube-sync-chrome-web-store.zip`
3. Completa los campos:

### Información requerida

| Campo | Valor |
|-------|-------|
| **Name** | Boostify YouTube Sync |
| **Summary** (132 chars max) | Sync your YouTube channel with Boostify AI: real-time SEO, trend alerts & analytics inside YouTube Studio. |
| **Description** | *(ver abajo)* |
| **Category** | Productivity |
| **Language** | English (with Spanish UI) |

### Descripción completa (copiar y pegar)

```
Boostify YouTube Sync connects your YouTube channel with the Boostify AI platform to supercharge your content strategy.

🎯 KEY FEATURES:

• Real-time Channel Sync — Your subscriber count, views, and video metrics sync automatically to Boostify
• AI-Powered SEO — Get title, description, and tag suggestions optimized for YouTube's algorithm
• Trend Alerts — Receive notifications when trending topics match your niche
• In-Page Analytics — See Boostify insights directly inside YouTube and YouTube Studio
• Side Panel — Access all Boostify tools without leaving YouTube
• Secure Connection — Token-based authentication, no password required

📊 WORKS WITH:
• YouTube (youtube.com) — Public channel data extraction
• YouTube Studio (studio.youtube.com) — In-depth analytics overlay

🔒 PRIVACY:
• We only read publicly visible channel data
• No access to your Google account credentials
• No browsing history collected
• No ads or tracking
• Full privacy policy: https://boostifymusic.com/privacy/extension

🚀 HOW IT WORKS:
1. Install this extension
2. Sign up at boostifymusic.com
3. Generate a connection token in your Boostify dashboard
4. Paste the token in the extension popup
5. Your channel syncs automatically!

Built by the Boostify team — AI-powered tools for music artists and content creators.
```

---

## Paso 4 — Assets gráficos requeridos

Chrome Web Store requiere estos assets:

| Asset | Tamaño | Formato | Descripción |
|-------|--------|---------|-------------|
| **Icon** | 128×128 px | PNG | ✅ Ya existe: `public/icons/icon-128.png` |
| **Small promo tile** | 440×280 px | PNG/JPG | Banner para resultados de búsqueda |
| **Screenshots** (min 1, max 5) | 1280×800 px ó 640×400 px | PNG/JPG | Capturas de la extensión en acción |

### Cómo crear los assets

**Small Promo Tile (440×280):**
- Fondo: gradiente emerald (#065f46 → #059669)
- Logo Boostify + texto "YouTube Sync"
- Subtítulo: "AI-powered SEO & Analytics"
- Puedes usar Canva o Figma

**Screenshots recomendados:**
1. El popup de la extensión conectado (mostrando stats)
2. YouTube Studio con el overlay de Boostify
3. El Side Panel abierto en YouTube
4. La página de conexión en boostifymusic.com/youtube-views

> Tip: Usa una resolución de 1280×800 para las capturas.

---

## Paso 5 — Privacy Policy

Chrome Web Store exige una URL pública de privacy policy.

Ya está creada en la app: **https://boostifymusic.com/privacy/extension**

Pega esta URL en el campo "Privacy policy URL" del dashboard.

---

## Paso 6 — Permisos justification

Chrome pedirá justificar cada permiso. Usa estas respuestas:

| Permiso | Justificación |
|---------|--------------|
| **activeTab** | To detect when the user is on YouTube/YouTube Studio and inject Boostify analytics overlays |
| **tabs** | To identify YouTube tabs to apply content scripts and sync channel data |
| **storage** | To persist the user's connection token and extension settings locally |
| **alarms** | To schedule periodic sync of YouTube channel data (every 30 minutes) |
| **notifications** | To alert users about trending topics and sync status changes |
| **sidePanel** | To display the Boostify tools side panel within Chrome |
| **host: youtube.com** | To read publicly visible channel data (subscriber count, video views, etc.) on YouTube pages |
| **host: studio.youtube.com** | To overlay Boostify SEO suggestions inside YouTube Studio |
| **host: boostifymusic.com** | To communicate with the Boostify API for AI analysis and data sync |

---

## Paso 7 — Enviar para revisión

1. Revisa todos los campos
2. Clic en **"Submit for Review"**
3. Google revisa en **1-3 días hábiles** (primera vez puede tardar más)
4. Recibirás email cuando se apruebe o si piden cambios

---

## Paso 8 — Actualizar la URL en el código

Una vez aprobada, Google te da un **Extension ID** (algo como `abcdefghijklmnopqrstuvwxyz1234`).

Actualiza la constante en **2 archivos**:

```
// En client/src/pages/youtube-views.tsx
const CHROME_WEBSTORE_URL = "https://chromewebstore.google.com/detail/boostify-youtube-sync/TU_EXTENSION_ID";

// En client/src/components/youtube-views/extension-sync-tab.tsx
const CHROME_WEBSTORE_URL = "https://chromewebstore.google.com/detail/boostify-youtube-sync/TU_EXTENSION_ID";
```

Reemplaza `TU_EXTENSION_ID` con el ID real.

---

## Checklist final

- [ ] Cuenta de desarrollador creada y verificada
- [ ] ZIP generado con `npm run build:store`
- [ ] Información de listing completada (nombre, descripción, categoría)
- [ ] Icon 128×128 subido (ya existe)
- [ ] Small promo tile 440×280 creado y subido
- [ ] Al menos 1 screenshot 1280×800 subido
- [ ] Privacy policy URL: `https://boostifymusic.com/privacy/extension`
- [ ] Justificaciones de permisos completadas
- [ ] Enviado para revisión
- [ ] Extension ID actualizado en el código después de aprobación
