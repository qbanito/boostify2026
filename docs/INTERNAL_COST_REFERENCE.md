# 🔒 BOOSTIFY INTERNAL COST REFERENCE
## CONFIDENTIAL — Solo para administración interna
### Última actualización: Febrero 6, 2026

---

## 📐 VARIABLES BASE

| Variable | Valor |
|---|---|
| Canción promedio | 3:30 (210 seg) |
| Duración por corte | 3–5 seg (promedio 4 seg) |
| Clips totales (promedio) | **52 clips** |
| Rango real | 42 clips (5s) — 70 clips (3s) |
| Tasa de rechazo técnico | ~15% (+8 re-generaciones) |
| Tasa de corrección usuario | ~30% primera ronda, ~10% segunda ronda |

---

## 🎨 COSTOS DE IMAGEN (FAL - Feb 2026)

| Modelo | Costo/imagen | Uso |
|---|---|---|
| **Nano Banana Pro** (Gemini 3 Pro) | **$0.15** | Premium — T2I principal |
| Nano Banana (Gemini 2.5 Flash) | $0.039 | Budget — T2I básico |
| Nano Banana Pro Edit (I2I) | $0.15 | Correcciones de imagen |
| Flux Pro | $0.005 | Alternativa rápida |
| Flux Schnell | $0.003 | Posters rápidos |
| Flux Realism | $0.005 | Estilo fotorrealista |

---

## 🎬 COSTOS DE VIDEO I2V (FAL - Feb 2026)

### Tier S — Ultra Premium
| Modelo | $/seg (sin audio) | $/seg (con audio) | 5s clip | 10s clip |
|---|---|---|---|---|
| **Veo 3 Standard** | $0.50 | $0.75 | $2.50 / $3.75 | $5.00 / $7.50 |
| **Veo 3.1** (1080p) | $0.20 | $0.40 | $1.00 / $2.00 | $2.00 / $4.00 |
| **Veo 3.1** (4K) | $0.40 | $0.60 | $2.00 / $3.00 | $4.00 / $6.00 |

### Tier A — Premium
| Modelo | $/seg (sin audio) | $/seg (con audio) | 5s clip |
|---|---|---|---|
| **Kling 3.0 (O3)** | $0.168 | $0.224 | $0.84 / $1.12 |
| **Kling 2.6 Pro** | $0.07 | $0.14 | $0.35 / $0.70 |
| Kling 2.1 Master | $0.28 | — | $1.40 |

### Tier B — Standard
| Modelo | $/seg | 5s clip |
|---|---|---|
| **Kling 2.1 Pro** | $0.09 | $0.45 |
| Kling O1 I2V | $0.06 | $0.30 |
| Kling 2.1 Standard | $0.05 | $0.25 |
| Grok Imagine Video | $0.05 | $0.30 |

### Tier C — Económico
| Modelo | $/seg | 5s clip |
|---|---|---|
| Framepack | $0.033 | $0.17 |
| Wan 2.5 I2V | — | $0.40 (flat) |

---

## 🤖 COSTOS LLM (OpenAI - Feb 2026)

| Modelo | $/1M input | $/1M output | Uso en pipeline |
|---|---|---|---|
| **GPT-4o** | $5.00 | $15.00 | Guión, conceptos |
| GPT-4o-mini | $0.15 | $0.60 | Enhancement de prompts |
| Whisper-1 | $0.006/min | — | Transcripción audio |

---

## 🎤 COSTOS LIPSYNC & MOTION

| Modelo | $/seg | Max duración |
|---|---|---|
| PixVerse Lipsync | $0.04 | 30s |
| DreamActor v2 | ~$0.10 | 30s |
| OmniHuman v1.5 | ~$0.15 | 60s |

---

## 🎞️ COSTOS RENDER (Shotstack)

| Tipo | Costo |
|---|---|
| Pay-as-you-go | $0.40/min renderizado |
| Subscription | $0.20/min renderizado |

---

## 💰 COSTO INTERNO POR VIDEO COMPLETO (3:30, 52 clips, 5s c/u)

### Escenario: Nano Banana Pro + Modelo de Video seleccionado

| Fase | Veo 3 Std | Veo 3.1 | Kling O3 | Kling 2.6 | Kling 2.1 Pro |
|---|---|---|---|---|---|
| **OpenAI (guión + prompts)** | $0.96 | $0.96 | $0.96 | $0.96 | $0.96 |
| **Imágenes (70 imgs)** | $10.50 | $10.50 | $10.50 | $10.50 | $10.50 |
| **Videos (60 clips × 5s)** | $150.00 | $60.00 | $50.40 | $21.00 | $27.00 |
| **Lipsync (16 clips)** | $4.00 | $4.00 | $4.00 | $4.00 | $4.00 |
| **Motion Transfer (5 clips)** | $3.50 | $3.50 | $3.50 | $3.50 | $3.50 |
| **Renders (4 passes)** | $5.60 | $5.60 | $5.60 | $5.60 | $5.60 |
| **Correcciones usuario** | $25.00 | $14.00 | $12.00 | $7.50 | $8.00 |
| **TOTAL MI COSTO** | **$199.56** | **$98.56** | **$86.96** | **$53.06** | **$59.56** |

---

## 📊 TABLA DE PRICING (4x markup)

### Fórmula: `precio_usuario = costo_interno × 4`

| Modelo Video | Mi Costo | 4x Markup | Precio Sugerido |
|---|---|---|---|
| **Veo 3 Standard** | ~$200 | $800 | **$799** |
| **Veo 3.1** | ~$99 | $396 | **$399** |
| **Kling 3.0 (O3)** | ~$87 | $348 | **$349** |
| **Kling 2.6 Pro** | ~$53 | $212 | **$199** |
| **Kling 2.1 Pro** | ~$60 | $240 | **$249** |

---

## 🔢 FÓRMULA DE CÁLCULO DINÁMICO

```
COSTO_USUARIO = (
  (num_clips × costo_imagen × 1.35)           // imágenes + 35% correcciones
  + (num_clips × duracion_clip × costo_video_seg × 1.25)  // videos + 25% regens
  + (num_clips_performance × duracion_clip × costo_lipsync)  // lipsync
  + (costo_openai_fijo)                        // ~$0.96
  + (duracion_cancion_min × costo_render × 4)  // 4 render passes
  + (5 × costo_motion_transfer)                // motion transfer clips
) × MARKUP_MULTIPLIER (4.0)
```

### Variables dinámicas por canción:
- `num_clips` = ceil(duracion_cancion_seg / duracion_promedio_clip)
- `num_clips_performance` = ceil(num_clips × 0.30) // 30% son PERFORMANCE
- `duracion_promedio_clip` = seleccionado por usuario (3s, 4s, 5s)
- `costo_video_seg` = según modelo seleccionado
- `costo_imagen` = $0.15 (Nano Banana Pro)
- `MARKUP_MULTIPLIER` = 4.0

---

## 📋 SCALING POR DURACIÓN DE CANCIÓN

| Duración | Clips (4s avg) | Mi Costo (Kling 2.6) | Precio 4x |
|---|---|---|---|
| 2:00 (120s) | 30 | ~$32 | **$129** |
| 2:30 (150s) | 38 | ~$39 | **$159** |
| 3:00 (180s) | 45 | ~$47 | **$189** |
| 3:30 (210s) | 52 | ~$53 | **$199** |
| 4:00 (240s) | 60 | ~$61 | **$249** |
| 4:30 (270s) | 68 | ~$70 | **$279** |
| 5:00 (300s) | 75 | ~$77 | **$299** |

---

## ⚠️ NOTAS IMPORTANTES

1. **Nano Banana Pro subió de $0.039 a $0.15/imagen** — ahora basado en Gemini 3 Pro
2. **Kling 3.0 (O3) es NUEVO** — exclusivo FAL, $0.168/seg sin audio
3. **Veo 3.1 soporta first/last frame** — ideal para transiciones controladas
4. **Los costos de FAL pueden cambiar** — verificar mensualmente en fal.ai/pricing
5. **El markup de 4x** incluye: profit + infraestructura + soporte + storage + CDN
6. **Admin bypass:** convoycubano@gmail.com NUNCA paga
7. **Buffer recomendado:** siempre presupuestar +30% sobre el costo calculado para usuarios difíciles
