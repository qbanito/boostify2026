# 🔐 Mobile Authentication Setup Guide

## ✅ Cambios Realizados

### 1. **reCAPTCHA Enterprise Integrado**
- ✅ Script agregado a `index.html`
- ✅ App Check inicializado en `client/src/firebase.ts`
- ✅ Site Key: `6LeloAssAAAAAG7GWlxW1QGReAw_2y-bYSVmmH3K`

### 2. **Código de Autenticación Mejorado**
- ✅ Mejor detección de dispositivos móviles (iOS, Android, tablets)
- ✅ Logs detallados para debugging en móviles
- ✅ Manejo mejorado de redirects en Safari iOS

---

## 🚀 Próximos Pasos (CRÍTICO)

### **Paso 1: Configurar Firebase Console**

#### A. App Check → Enforcement
1. Ve a Firebase Console: https://console.firebase.google.com
2. Selecciona proyecto "artist-boost"
3. Menu lateral → **App Check**
4. Tab **"APIs"**
5. Para cada API, cambia a **"Enforced"**:
   - ✅ Identity Platform API → **Enforced**
   - ✅ Cloud Firestore API → **Enforced** (o "Unenforced" si da problemas)
   - ✅ Cloud Storage API → **Enforced** (o "Unenforced" si da problemas)

**Nota**: Si tienes errores en desktop, puedes dejar Firestore/Storage en "Unenforced" y solo forzar Authentication.

#### B. Authorized Domains
1. En Firebase Console → **Authentication**
2. Tab **"Settings"**
3. Scroll down a **"Authorized domains"**
4. Verifica que estén todos estos dominios:
   ```
   ✅ artist-boost.firebaseapp.com
   ✅ artist-boost.web.app
   ✅ localhost
   ✅ [tu-dominio-replit].replit.app (si usas Replit)
   ✅ [tu-dominio-replit].replit.dev (si usas Replit)
   ```

5. Si falta alguno, agrégalo con el botón **"Add domain"**

### **Paso 2: Google Cloud Console** (Opcional pero recomendado)

#### Verificar OAuth 2.0 Redirect URIs
1. Ve a: https://console.cloud.google.com
2. Selecciona proyecto "artist-boost"
3. Menu → **APIs & Services** → **Credentials**
4. Encuentra **OAuth 2.0 Client IDs** → Click en el web client
5. En **"Authorized redirect URIs"** debe estar:
   ```
   https://artist-boost.firebaseapp.com/__/auth/handler
   ```

6. Si no está, agrégalo y **Save**

---

## 🧪 Cómo Probar

### **Prueba 1: Desktop (debe seguir funcionando)**
1. Abre tu app en Chrome/Firefox desktop
2. Click en "Sign in with Google"
3. Debería abrir popup
4. Abre Console (F12) → busca:
   ```
   ✅ [APP CHECK] Firebase App Check initialized
   ✅ [AUTH] Device detection: { isMobile: false, ... }
   ```

### **Prueba 2: Móvil (iPhone/Android)**
1. Abre Safari en iPhone o Chrome en Android
2. Ve a tu URL de producción (NO localhost)
3. Click en "Sign in with Google"
4. Debería redirigir a Google (no popup)
5. Después de autenticar, debe volver a tu app

#### Cómo ver logs en móvil:
**iPhone Safari:**
1. En Mac: Safari → Develop → [tu iPhone] → [tu página]
2. Se abrirá el inspector web

**Android Chrome:**
1. En PC: Chrome → `chrome://inspect`
2. Conecta tu Android via USB
3. Click "inspect" en tu página

**Logs esperados:**
```
🔐 [MOBILE] Dispositivo móvil/iOS detectado
🔐 [MOBILE] authDomain: artist-boost.firebaseapp.com
🔐 [MOBILE] Verificando resultado de redirección...
✅ [MOBILE] Redirección exitosa! Usuario autenticado: [email]
```

---

## ❌ Troubleshooting

### Error: "auth/unauthorized-domain"
**Problema**: El dominio no está autorizado

**Solución**:
1. Firebase Console → Authentication → Settings → Authorized domains
2. Agrega el dominio exacto que aparece en el error
3. Ejemplo: si el error dice `https://abc123.replit.dev`, agrega `abc123.replit.dev`

### Error: "auth/operation-not-allowed"
**Problema**: Google Sign-In no está habilitado

**Solución**:
1. Firebase Console → Authentication → Sign-in method
2. Google → **Enable**
3. Guarda cambios

### Error: reCAPTCHA no carga
**Problema**: App Check bloqueando requests

**Solución temporal**:
1. Firebase Console → App Check → APIs
2. Pon todas las APIs en **"Unenforced"** temporalmente
3. Prueba de nuevo
4. Si funciona, activa una por una para encontrar el problema

### Login funciona en desktop pero NO en móvil
**Problema posible**: Popup vs Redirect

**Verificación**:
1. Abre Console en móvil (instrucciones arriba)
2. Busca: `🔐 [AUTH] Device detection`
3. Debería mostrar `isMobile: true`
4. Si muestra `false`, el device detection falló

**Solución**: El código ya fue actualizado con mejor detección

---

## 📊 Checklist Final

Antes de declarar "listo", verifica:

- [ ] Firebase Console → App Check → Apps → **"Registered"** (no "Unregistered")
- [ ] Firebase Console → Authentication → Sign-in method → Google **Enabled**
- [ ] Firebase Console → Authentication → Settings → Authorized domains: **todos los dominios agregados**
- [ ] Google Cloud Console → OAuth 2.0 → Redirect URIs: **`/__/auth/handler`**
- [ ] Login funciona en **Chrome desktop**
- [ ] Login funciona en **Safari iPhone**
- [ ] Login funciona en **Chrome Android**
- [ ] Console logs muestran: **✅ [APP CHECK] initialized**

---

## 🆘 Si Nada Funciona

**Plan B: Debug mode**

Agrega esto temporalmente a `client/src/firebase.ts` (después de línea 91):

```typescript
// DEBUG: Activar modo de depuración de App Check
if (typeof window !== 'undefined') {
  (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
```

Luego:
1. Abre la app
2. Abre Console
3. Copia el debug token que aparece
4. Firebase Console → App Check → Debug tokens → Add token
5. Pega el token y guarda

Esto desactiva App Check para ese navegador específico.

---

## 📝 Notas Importantes

1. **App Check solo funciona en producción**: En localhost se salta automáticamente
2. **reCAPTCHA es invisible**: Los usuarios no ven ningún captcha
3. **Primer login puede tardar 2-3 segundos**: Normal, reCAPTCHA se inicializa
4. **Email temporal sigue funcionando**: No usa Google Auth, por eso no tiene problemas

---

## ✅ Siguiente Acción Recomendada

1. **Commit y deploy** estos cambios
2. **Prueba en móvil real** (no simulador)
3. **Verifica logs** en consola móvil
4. Si falla, comparte:
   - Screenshot del error
   - Logs de consola móvil
   - Dispositivo (iPhone/Android, versión)
