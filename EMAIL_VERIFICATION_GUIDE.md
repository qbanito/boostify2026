# 📧 Sistema de Verificación de Emails

## Problema Actual
- **Bounce Rate:** 8% (objetivo: < 2%)
- **Impacto:** Daña reputación del dominio, puede llevar a blacklisting

## Solución Implementada

### 1. Servicio de Verificación Multi-Capa

```
📁 server/services/email-verification-service.ts
```

**Capas de verificación:**
1. ✅ **Sintaxis** - Valida formato correcto del email
2. ✅ **Dominios desechables** - 200+ dominios temp-mail bloqueados
3. ✅ **MX Records** - Verifica que el dominio puede recibir emails
4. ✅ **Emails role-based** - Detecta info@, admin@, support@, etc.
5. ✅ **Historial de bounces** - Evita reenviar a emails que ya bouncearon
6. ✅ **APIs externas** (opcional) - ZeroBounce, Hunter.io, NeverBounce

### 2. Script de Verificación Masiva

```bash
# Verificar lista completa (dry run)
npx tsx scripts/verify-email-list.ts

# Verificar y marcar inválidos en DB
npx tsx scripts/verify-email-list.ts --fix

# Usar API externa (consume créditos)
npx tsx scripts/verify-email-list.ts --api --fix

# Verificar tabla específica
npx tsx scripts/verify-email-list.ts --table=investor_leads --fix

# Limitar cantidad
npx tsx scripts/verify-email-list.ts --limit=100 --fix

# Modo estricto (rechaza role-based emails)
npx tsx scripts/verify-email-list.ts --strict --fix
```

### 3. Webhooks de Brevo (Automático)

Los bounces ahora se registran automáticamente:

```
📁 server/routes/brevo-webhooks.ts
URL: https://boostifymusic.com/api/webhooks/brevo
```

**Eventos manejados:**
- `hard_bounce` → Marca como bounced, nunca más envía
- `soft_bounce` → Cuenta, después de 3 marca como hard
- `spam` → Blacklist permanente
- `unsubscribed` → Respeta preferencia
- `blocked` → Trata como hard bounce

---

## 🚀 Setup Inicial

### Paso 1: Ejecutar migración
```bash
npx tsx scripts/migrations/add-email-verification-columns.ts
```

### Paso 2: Verificar lista actual
```bash
# Primero ver el estado (sin cambios)
npx tsx scripts/verify-email-list.ts

# Luego aplicar cambios
npx tsx scripts/verify-email-list.ts --fix
```

### Paso 3: Configurar Webhooks en Brevo

1. Ve a: https://app.brevo.com/settings/webhooks
2. Agrega nuevo webhook:
   - **URL:** `https://boostifymusic.com/api/webhooks/brevo`
   - **Eventos:** `hard_bounce`, `soft_bounce`, `spam`, `unsubscribed`, `blocked`, `invalid_email`
3. Guarda y prueba

### Paso 4 (Opcional): Configurar APIs Externas

Para verificación más precisa, agrega estas API keys:

```env
# ZeroBounce (más preciso, $15/10k emails)
ZEROBOUNCE_API_KEY=xxxxxx

# Hunter.io (alternativa, $49/1k verificaciones)
HUNTER_API_KEY=xxxxxx

# NeverBounce (bulk friendly, $8/10k)
NEVERBOUNCE_API_KEY=xxxxxx
```

---

## 📊 Reducción Esperada de Bounce Rate

| Antes | Después Verificación Local | Con API Externa |
|-------|---------------------------|-----------------|
| 8%    | ~3-4%                     | ~1-2%           |

**Desglose típico de emails inválidos:**
- 30% Sintaxis/dominios sin MX
- 25% Emails desechables/temporales
- 20% Role-based (info@, admin@)
- 15% Ya bouncearon antes
- 10% Otros (catch-all, trampas)

---

## 🔧 Uso en Código

### Verificar un email antes de enviar
```typescript
import { verifyEmail, quickVerify } from '../services/email-verification-service';

// Verificación rápida (sin API)
const quick = await quickVerify('test@example.com');
if (!quick.valid) {
  console.log('Email inválido:', quick.reason);
  if (quick.suggestion) {
    console.log('Quizás quisiste decir:', quick.suggestion);
  }
}

// Verificación completa
const result = await verifyEmail('test@example.com', {
  useExternalAPI: true,  // Usa ZeroBounce si hay API key
  checkMX: true,
  strict: false
});

if (result.isDeliverable) {
  // Enviar email
} else {
  console.log(`No enviar: ${result.reason}`);
}
```

### Verificar lista antes de campaña
```typescript
import { verifyEmailList } from '../services/email-verification-service';

const emails = ['a@test.com', 'b@mailinator.com', 'c@gmail.com'];

const result = await verifyEmailList(emails, {
  checkMX: true,
  removeInvalid: true,
  removeRisky: false
});

console.log('Válidos:', result.validEmails);
console.log('Inválidos:', result.invalidEmails);
```

### Registrar bounce manualmente
```typescript
import { registerBounce } from '../services/email-verification-service';

// Después de recibir un bounce
registerBounce('bounced@example.com');
```

---

## 📋 Dominios Desechables Bloqueados

El servicio bloquea 200+ dominios de email temporal incluyendo:
- tempmail.com, temp-mail.org
- guerrillamail.com, mailinator.com
- 10minutemail.com, throwawaymail.com
- yopmail.com, sharklasers.com
- nespj.com, fxavaj.com (detectados en tu lista)
- Y muchos más...

---

## 🎯 Recomendaciones

1. **Ejecuta verificación antes de cada campaña grande**
   ```bash
   npx tsx scripts/verify-email-list.ts --fix
   ```

2. **Revisa los emails riesgosos** (role-based) manualmente
   - Algunos info@ pueden ser válidos
   - Usa `--strict` solo si quieres excluirlos

3. **Monitorea el bounce rate** después de cada envío
   - Los webhooks actualizan automáticamente

4. **Considera API externa** si sigues con >3% bounce
   - ZeroBounce es el más preciso
   - NeverBounce es más económico para bulk

5. **Limpia la lista periódicamente**
   - Los emails se vuelven inválidos con el tiempo
   - Verifica cada 3-6 meses

---

## 📁 Archivos Creados

```
server/services/email-verification-service.ts  # Servicio principal
scripts/verify-email-list.ts                   # Script de verificación masiva
scripts/migrations/add-email-verification-columns.ts  # Migración DB
server/routes/brevo-webhooks.ts                # Actualizado con handlers
EMAIL_VERIFICATION_GUIDE.md                    # Esta guía
```
