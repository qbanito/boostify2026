# 🎬 DIAGNÓSTICO: Estructura JSON del Guión y Flujo de Datos

**Fecha:** Febrero 5, 2026  
**Archivo analizado:** Sistema completo de generación de video musical

---

## 📊 RESUMEN EJECUTIVO

| Área | Estado | Puntuación |
|------|--------|------------|
| Estructura JSON del Guión | ✅ BIEN | 9/10 |
| Flujo de Letras al Prompt | ✅ CORREGIDO | 9/10 |
| Flujo de Director al Prompt | ✅ CORREGIDO | 9/10 |
| Validación de Letras | ✅ BIEN | 8/10 |
| Consistencia Visual | ✅ BIEN | 8/10 |
| Balance 50/50 Escenas | ✅ BIEN | 10/10 |

---

## 🎬 INFLUENCIA DEL DIRECTOR EN IMÁGENES

### ✅ CORREGIDO - Director ahora influye en cada imagen

**Antes:** El director solo se usaba en:
- Conceptos (3 opciones)
- Script (prompt de GPT-4o)
- Pósters (Hollywood-style)

**AHORA el director influye en CADA ESCENA:**

```typescript
// CinematicScene ahora incluye:
interface CinematicScene {
  director_name?: string;       // "Spike Jonze", "Hype Williams", etc.
  director_signature?: string;  // Estilo visual específico
  color_grading?: string;       // Color grading del director
}
```

El prompt de generación ahora incluye:
```
🎬 DIRECTOR VISION: ${directorName}
SIGNATURE STYLE: ${directorSignature}
COLOR GRADING: ${colorGrading}

CRITICAL: Apply ${directorName}'s unmistakable visual signature.
```

---

## 1️⃣ ESTRUCTURA JSON DEL GUIÓN (MusicVideoScene)

### ✅ CAMPOS DEFINIDOS CORRECTAMENTE

La interfaz `MusicVideoScene` en [music-video-scene.ts](client/src/types/music-video-scene.ts#L141-L270) está **muy bien diseñada**:

```typescript
export interface MusicVideoScene {
  // ✅ Identificadores
  scene_id: string;                    // "scene-1", "scene-2", etc.
  
  // ✅ Temporalidad (sincronizada con beats)
  start_time: number;                  // Tiempo en segundos
  duration: number;                    // Duración en segundos
  beat_index?: number;                 // Índice del beat
  
  // ✅ Rol y tipo de plano
  role: SceneRole;                     // 'performance' | 'b-roll'
  shot_type: ShotType;                 // ECU, CU, MS, LS, etc.
  
  // ✅ LETRAS - Campo crítico
  lyrics_segment?: string;             // ← FRAGMENTO DE LETRA PARA ESTA ESCENA
  
  // ✅ Contexto Narrativo NUEVO
  narrative_context?: string;          // Contexto narrativo
  connection_to_lyrics?: string;       // ← CONEXIÓN EXPLÍCITA CON LA LETRA
  
  // ✅ Descripción visual
  description: string;                 // Para generación de imagen
  
  // ✅ Estado de generación
  image_url?: string;
  video_url?: string;
}
```

### ✅ ENUMS BIEN DEFINIDOS

- `ShotType`: 13 tipos de planos cinematográficos (ECU, CU, MCU, MS, etc.)
- `SceneRole`: PERFORMANCE | BROLL 
- `CameraMovement`: 10 tipos (STATIC, PAN, DOLLY, etc.)
- `LensType`: 6 tipos (14mm a 135mm)
- `VisualStyle`: 9 estilos visuales
- `LightingType`: 8 tipos de iluminación
- `MusicSection`: 7 secciones (intro, verse, chorus, etc.)

---

## 2️⃣ FLUJO DE GENERACIÓN DEL SCRIPT

### Ruta: `/api/music-video/generate-script`

Ubicación: [music-video.ts](server/routes/music-video.ts#L653-L1080)

```
┌─────────────────┐
│  LETRA COMPLETA │
│  (transcription)│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  GPT-4o/Gemini GENERA SCRIPT JSON                       │
│                                                         │
│  Prompt incluye:                                        │
│  • "lyrics" field MUST contain actual lyrics            │
│  • "lyric_connection" field explains visual connection  │
│  • "narrative_context" connects scene to story          │
│                                                         │
│  Distribución:                                          │
│  • 30% PERFORMANCE (use_artist_reference=true)          │
│  • 40% B-ROLL (use_artist_reference=false)              │
│  • 30% STORY (use_artist_reference=true)                │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│  AUDIO ANALYSIS ENRICHMENT (si hay audioUrl)            │
│                                                         │
│  • Timestamps alineados a beats                         │
│  • Sección musical (verse, chorus, etc.)                │
│  • Duración inteligente por sección                     │
│  • Transiciones según energía                           │
└────────┬────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  SCRIPT JSON    │
│  CON ESCENAS    │
└─────────────────┘
```

### ✅ LO QUE ESTÁ BIEN

1. **El prompt de generación exige explícitamente**:
   ```
   Each scene's "lyrics" field MUST contain the actual lyrics for that moment
   The "lyric_connection" field MUST explain how the visual interprets those specific lyrics
   The "narrative_context" MUST connect the scene to the overall story
   ```

2. **División inteligente de letras**:
   ```typescript
   const lyricsLines = lyrics.split('\n').filter(line => line.trim().length > 0);
   const linesPerScene = Math.max(1, Math.ceil(lyricsLines.length / targetScenes));
   ```

3. **Balance 30/40/30** bien definido en el prompt.

---

## 3️⃣ ✅ CORRECCIÓN APLICADA: LETRAS EN EL PROMPT DE IMAGEN

### Ubicación de la Corrección

En [gemini-image-service.ts](server/services/gemini-image-service.ts#L114-L127), se actualizó la interfaz y los prompts:

```typescript
// ✅ INTERFAZ ACTUALIZADA
export interface CinematicScene {
  id: number;
  scene: string;
  camera: string;
  lighting: string;
  style: string;
  movement: string;
  // 🎤 LYRICS - Campos para conectar la imagen con la letra
  lyrics?: string;              // Fragmento de letra para esta escena
  lyrics_segment?: string;      // Alias para lyrics
  lyric_connection?: string;    // Conexión visual con la letra
  narrative_context?: string;   // Contexto narrativo de la escena
  emotion?: string;             // Emoción dominante
}
```

### ✅ PROMPT ACTUALIZADO

```typescript
const cinematicPrompt = `
Professional cinematic photography for a music video:

Scene: ${scene.scene}
Camera Setup: ${scene.camera}
...

🎤 LYRICS FOR THIS MOMENT: "${lyricsText}"
🎬 VISUAL CONCEPT: ${lyricConnection || 'Visualize the emotion...'}
📖 NARRATIVE: ${narrativeContext || 'Capture the emotional essence...'}
🎭 EMOTION: ${emotion || 'Match the emotional intensity...'}

IMPORTANT: The visual must directly reflect these specific lyrics.
`;
```

### ✅ FUNCIONES CORREGIDAS

1. `generateBatchImagesWithMultipleFaceReferences()` - Línea ~860
2. `generateImageFromCinematicScene()` - Línea ~430

### ✅ LOGS DE DIAGNÓSTICO AGREGADOS

```typescript
if (lyricsText) {
  logger.log(`🎤 Escena ${scene.id} - Letra: "${lyricsText.substring(0, 50)}..."`); 
}
```

---

## 4️⃣ VALIDACIÓN DE LETRAS EN ESCENAS

### ✅ FUNCIÓN DE VALIDACIÓN EXISTE

En [music-video-scene.ts](client/src/types/music-video-scene.ts#L437-L502):

```typescript
export function validateLyricsInScenes(scenes: MusicVideoScene[], fullLyrics?: string): {
  valid: boolean;
  scenesWithLyrics: number;
  scenesWithoutLyrics: number;
  coveragePercent: number;
  warnings: string[];
  errors: string[];
}
```

### ✅ VALIDACIONES QUE REALIZA

1. **Escenas con/sin letras**: Cuenta cuántas tienen `lyrics_segment`
2. **Escenas PERFORMANCE sin letras**: Marca como ERROR crítico
3. **Letras duplicadas**: Warning si se repite más de 2 veces
4. **Cobertura mínima**: Error si < 50%, Warning si < 75%
5. **Cobertura de letra completa**: Verifica que la letra original esté cubierta

### ⚠️ PROBLEMA: La validación existe PERO...

La validación está en el **cliente** (`client/src/types/`) pero no se usa en el **servidor** antes de generar imágenes.

---

## 5️⃣ FLUJO ACTUAL vs FLUJO IDEAL

### FLUJO ACTUAL (Problema)

```
SCRIPT JSON          GENERACIÓN IMAGEN
┌───────────────┐    ┌──────────────────────────┐
│ scene.lyrics  │    │ Prompt = scene.scene     │
│ scene.lyric_  │ ──▶│ (sin lyrics_segment)     │
│   connection  │    │ (sin lyric_connection)   │
│ scene.visual  │    │ (sin narrative_context)  │
│   _description│    └──────────────────────────┘
└───────────────┘
        ↓
    DATOS PERDIDOS ❌
```

### FLUJO IDEAL (Solución)

```
SCRIPT JSON          GENERACIÓN IMAGEN
┌───────────────┐    ┌──────────────────────────────────┐
│ scene.lyrics  │    │ Prompt = scene.visual_description│
│ scene.lyric_  │ ──▶│ + "Lyrics: " + scene.lyrics     │ ✅
│   connection  │    │ + "Concept: " + lyric_connection │ ✅
│ scene.visual  │    │ + "Context: " + narrative_context│ ✅
│   _description│    └──────────────────────────────────┘
└───────────────┘
        ↓
    IMAGEN CONECTADA CON LETRA ✅
```

---

## 6️⃣ ARCHIVOS CLAVE Y UBICACIONES

| Archivo | Función | Líneas Clave |
|---------|---------|--------------|
| `client/src/types/music-video-scene.ts` | Definición de tipos | 141-270 (MusicVideoScene) |
| `server/routes/music-video.ts` | Generación de script | 653-1080 |
| `server/services/gemini-image-service.ts` | Generación de imágenes | 830-870 |
| `client/src/lib/api/openrouter.fixed.ts` | Fallback del script | 1150-1280 |
| `client/src/lib/api/music-video-generator.ts` | Helper del generador | 1-200 |

---

## 7️⃣ RECOMENDACIONES

### 🔴 CRÍTICA: Incluir letras en prompt de imagen

```typescript
// gemini-image-service.ts - generateBatchImagesWithMultipleFaceReferences()

const cinematicPrompt = `
Professional cinematic photography for a music video:

Scene: ${scene.scene}
Camera Setup: ${scene.camera}
Lighting: ${scene.lighting}
Visual Style: ${scene.style}

🎤 LYRICS FOR THIS SCENE: "${scene.lyrics || scene.lyrics_segment || ''}"
🎬 VISUAL CONNECTION: ${scene.lyric_connection || scene.narrative_context || ''}

The visual must reflect the emotion and meaning of these specific lyrics.
`.trim();
```

### 🟡 IMPORTANTE: Validar letras antes de generar

En el servidor, antes de generar imágenes:

```typescript
import { validateLyricsInScenes } from '../../client/src/types/music-video-scene';

// Antes de generar imágenes
const validation = validateLyricsInScenes(scenes, fullLyrics);
if (!validation.valid) {
  logger.warn('⚠️ Escenas sin letras:', validation.errors);
}
```

### 🟢 MEJORA: Agregar logs de diagnóstico

```typescript
// Log para verificar que la letra llega a la generación
logger.log(`🎤 Escena ${scene.scene_id}:`);
logger.log(`   Letra: "${(scene.lyrics_segment || '').substring(0, 50)}..."`);
logger.log(`   Conexión: ${scene.lyric_connection || 'N/A'}`);
```

---

## 8️⃣ CONCLUSIÓN

| Aspecto | Estado | Acción Requerida |
|---------|--------|------------------|
| Estructura JSON | ✅ Excelente | Ninguna |
| Campos de letras | ✅ Definidos | Ninguna |
| Generación de script | ✅ Incluye letras | Ninguna |
| Prompt de imagen | ✅ CORREGIDO | ~~CORREGIR~~ ✅ |
| Validación | ⚠️ Solo en cliente | Opcional: mover a servidor |

**✅ CORRECCIÓN APLICADA:** Las letras ahora se incluyen en los prompts de generación de imágenes.

---

*Diagnóstico actualizado - BOOSTIFY AI System - Feb 5, 2026*
