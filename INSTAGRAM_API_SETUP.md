# 📱 Instagram Graph API - Configuración

## 🔑 Cómo Obtener las Credenciales de Facebook

Sigue estos pasos para conectar tu app con Instagram real:

### 1. Crear Facebook App

1. Ve a **https://developers.facebook.com**
2. Click en "**My Apps**" → "**Create App**"
3. Selecciona tipo "**Business**"
4. Completa:
   - **App Name**: Boostify Music
   - **App Contact Email**: tu email
   - Click "**Create App**"

### 2. Configurar Facebook Login

1. En el dashboard de tu app, click "**Add Product**"
2. Busca "**Facebook Login**" y click "**Set Up**"
3. Selecciona "**Web**" como plataforma
4. En "**Site URL**" ingresa tu URL de Replit:
   ```
   https://tu-replit-url.replit.dev
   ```

### 3. Configurar OAuth Settings

1. Ve a "**Facebook Login**" → "**Settings**" en el menú lateral
2. En "**Valid OAuth Redirect URIs**" agrega:
   ```
   https://tu-replit-url.replit.dev/api/instagram/auth/callback
   ```
3. Activa estas opciones:
   - ✅ **Client OAuth Login**
   - ✅ **Web OAuth Login**
4. Click "**Save Changes**"

### 4. Obtener App ID y App Secret

1. Ve a "**Settings**" → "**Basic**" en el menú lateral
2. Copia estos valores:
   - **App ID**: (número de 15-16 dígitos)
   - **App Secret**: click "**Show**" para verlo

### 5. Agregar los Secretos en Replit

1. En tu Replit, abre la pestaña "**Secrets**" (ícono de llave 🔑)
2. Agrega estos 3 secretos:

| Key | Value |
|-----|-------|
| `FACEBOOK_APP_ID` | Tu App ID de Facebook |
| `FACEBOOK_APP_SECRET` | Tu App Secret de Facebook |
| `INSTAGRAM_REDIRECT_URI` | `https://tu-replit-url.replit.dev/api/instagram/auth/callback` |

### 6. Requisitos de la Cuenta de Instagram

⚠️ **IMPORTANTE**: Tu cuenta de Instagram debe cumplir:

- ✅ **Cuenta Business o Creator** (NO personal)
- ✅ **Conectada a una Página de Facebook**
- ✅ Si no tienes página de Facebook:
  1. Ve a **https://facebook.com/pages/create**
  2. Crea una página para tu música/artista
  3. Ve a configuración de Instagram → "**Switch to Professional Account**"
  4. Conecta tu Instagram a la página de Facebook creada

---

## 🚀 Cómo Funciona la Integración

### 1. Conectar Cuenta
```javascript
// Usuario hace click en "Conectar Instagram"
// Frontend hace GET a: /api/instagram/auth/connect
// Backend genera URL de autorización de Facebook
// Usuario autoriza en Facebook
// Callback guarda tokens en base de datos
```

### 2. Endpoints Disponibles

#### OAuth
- `GET /api/instagram/auth/connect` - Iniciar conexión
- `GET /api/instagram/auth/callback` - Callback de OAuth
- `GET /api/instagram/auth/status` - Ver estado de conexión
- `POST /api/instagram/auth/disconnect` - Desconectar cuenta
- `POST /api/instagram/auth/refresh` - Refrescar token

#### Datos Reales (requieren conexión activa)
- `GET /api/instagram/community/calendar` - Posts recientes
- `GET /api/instagram/community/engagement` - Estadísticas de engagement
- `GET /api/instagram/reports/analytics` - Analíticas completas
- `GET /api/instagram/strategies/content-mix` - Mix de contenido
- Etc.

---

## 📊 Datos que se Obtienen

### Profile
- Username
- Followers count
- Following count
- Biography
- Profile picture

### Posts
- Caption
- Media type (foto/video/carrusel)
- URL
- Timestamp
- Likes
- Comments

### Insights
- Engagement (likes + comments + saves + shares)
- Reach (cuentas únicas alcanzadas)
- Impressions (vistas totales)
- Saves
- Profile views
- Website clicks

---

## 🔄 Gestión de Tokens

Los tokens de Instagram tienen validez de **60 días**:

- ✅ Se guardan automáticamente en la base de datos
- ✅ El sistema verifica la expiración antes de cada llamada
- ✅ Endpoint `/api/instagram/auth/refresh` renueva el token
- ⚙️ (Próximamente) Cron job para auto-refresh cada 50 días

---

## ⚠️ Limitaciones de Instagram Graph API

1. **Solo cuentas Business/Creator**: No funciona con cuentas personales
2. **Requiere página de Facebook**: Debe estar vinculada
3. **Rate Limits**: ~200 llamadas por hora por usuario
4. **Datos propios**: Solo puedes acceder a tus propios datos
5. **Delay de insights**: Algunos datos pueden tardar hasta 48 horas

---

## 🧪 Testing

Para probar la integración:

1. Asegúrate de tener todos los secretos configurados
2. Ve a `/instagram-boost` en tu app
3. Click en "Conectar Instagram"
4. Autoriza en Facebook
5. Verás tus datos reales en los tabs Community, Reports, etc.

---

## 🐛 Troubleshooting

### Error: "No Instagram Business account found"
- ✅ Verifica que tu Instagram sea Business/Creator
- ✅ Verifica que esté conectado a una página de Facebook

### Error: "Invalid OAuth redirect URI"
- ✅ Verifica que la URL en Facebook Login settings coincida exactamente
- ✅ No olvides el `/api/instagram/auth/callback`

### Error: "Token expired"
- ✅ Usa el endpoint `/api/instagram/auth/refresh` para renovar

### No aparecen datos
- ✅ Verifica que `/api/instagram/auth/status` retorne `connected: true`
- ✅ Revisa los logs del backend para ver si hay errores de API

---

## 📚 Documentación Oficial

- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api/)
- [Facebook Login](https://developers.facebook.com/docs/facebook-login/)
- [Access Tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/)
