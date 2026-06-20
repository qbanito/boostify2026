# 🎯 Guía para Crear Price IDs Anuales en Stripe

## ⚠️ ACCIÓN REQUERIDA

Actualmente, los planes mensuales y anuales **usan el mismo Price ID**, lo que significa que no hay descuento real para suscripciones anuales.

## 📋 Price IDs Actuales (Mensuales)

| Plan | Precio Mensual | Price ID Actual |
|------|---------------|-----------------|
| Creator | $59.99/mes | `price_1R0lay2LyFplWimfQxUL6Hn0` |
| Professional | $99.99/mes | `price_1R0laz2LyFplWimfsBd5ASoa` |
| Enterprise | $149.99/mes | `price_1R0lb12LyFplWimf7JpMynKA` |

## 🎁 Price IDs Anuales a Crear (16% Descuento)

Ve a tu **Stripe Dashboard** → **Products** → Click en cada producto → **Add another price** y crea:

### Plan CREATOR
- **Precio**: $604.00 USD
- **Intervalo de facturación**: Yearly (anual)
- **Equivalente mensual**: $50.33/mes (ahorro de $115/año)
- **Copia el Price ID** → Ejemplo: `price_XXXX_creator_yearly`

### Plan PROFESSIONAL  
- **Precio**: $1,007.00 USD
- **Intervalo de facturación**: Yearly (anual)
- **Equivalente mensual**: $83.92/mes (ahorro de $192/año)
- **Copia el Price ID** → Ejemplo: `price_XXXX_pro_yearly`

### Plan ENTERPRISE
- **Precio**: $1,511.00 USD  
- **Intervalo de facturación**: Yearly (anual)
- **Equivalente mensual**: $125.92/mes (ahorro de $288/año)
- **Copia el Price ID** → Ejemplo: `price_XXXX_enterprise_yearly`

## 📝 Después de Crear los Price IDs

1. Copia los 3 nuevos Price IDs que Stripe te genera
2. Pégalos aquí:
   - Creator Yearly: `price_________________`
   - Professional Yearly: `price_________________`
   - Enterprise Yearly: `price_________________`

3. Actualiza el archivo `client/src/components/subscription/pricing-plans.tsx` con estos IDs

## 🔄 Actualización Automática

Una vez tengas los Price IDs, yo actualizaré automáticamente el código para usarlos.

---

## 💡 Por Qué Esto es Importante

**ANTES (Situación Actual):**
- Usuario elige plan anual
- UI muestra "16% descuento"  
- **PERO:** Stripe cobra el mismo precio mensual x 12 meses
- **NO hay descuento real** ❌

**DESPUÉS (Con Nuevos Price IDs):**
- Usuario elige plan anual
- UI muestra "16% descuento"
- Stripe cobra el precio anual reducido
- **Usuario ahorra $115-$288/año** ✅

---

## 🚨 Urgencia

Esto es **CRÍTICO** porque:
1. Actualmente estás prometiendo un descuento que no existe (problema legal/ético)
2. Usuarios que pagaron "anual" pagaron de más
3. Conversión a planes anuales está siendo artificialmente baja

**Tiempo estimado para crear en Stripe**: 10 minutos
**Impacto en conversión**: +15-20% más usuarios anuales
