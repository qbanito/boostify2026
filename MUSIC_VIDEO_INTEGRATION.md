# 🎬 Music Video Integration - Flujo Completo

## Resumen

Sistema completo de creación de videos musicales que integra:
1. Upload de imagen artista + canción
2. Transcripción automática
3. Generación de guion con IA
4. Generación de imágenes para cada escena  
5. Timeline editor profesional
6. Generación de videos con IA (KLING, Luma, MiniMax)
7. Exportación a MP4

## 🔗 Rutas Principales

### `/music-video-flow` - Flujo Integrado Completo
**Componente**: `MusicVideoWorkflowEnhanced.tsx`
**Servicio**: `music-video-timeline-integration.ts`

Flujo paso a paso automatizado que conecta todas las funcionalidades.

### `/timeline-demo` - Demo del Timeline
**Componente**: `EnhancedTimeline.tsx`

Demo standalone del editor de timeline profesional.

## 📋 Flujo Completo de Uso

### Paso 1: Upload de Archivos
```tsx
// Usuario sube:
- Imagen del artista (opcional)
- Archivo de audio (canción)

// El sistema:
- Sube archivos a Firebase Storage
- Obtiene URLs permanentes
- Detecta duración del audio
```

### Paso 2: Transcripción
```tsx
// Sistema transcribe la canción
const transcription = await transcribeAudio(audioFile);

// Resultado: Letra con timing aproximado
```

### Paso 3: Generación de Guion
```tsx
// Genera guion cinematográfico con IA
const script = await generateMusicVideoPrompts(
  transcription,
  audioDuration,
  isPaid // true = 30 escenas, false = 5 escenas
);

// Resultado: MusicVideoScript
{
  title: string;
  total_duration: number;
  total_scenes: number;
  scenes: [
    {
      scene_id: number;
      start_time: number;  // Timing exacto
      duration: number;
      prompt: string;      // Prompt visual
      lyrics_segment: string;
    }
  ]
}
```

### Paso 4: Convertir Script a Timeline
```tsx
import { convertScriptToTimelineClips } from './services/music-video-timeline-integration';

const { clips, tracks } = convertScriptToTimelineClips({
  script,
  audioUrl
});

// Resultado:
clips = [
  {
    id: 'scene-1',
    type: 'image',
    start: 0,
    duration: 5,
    url: '', // Se llenará con imagen generada
    metadata: {
      prompt: "Escena cinematográfica...",
      sceneId: 1
    }
  },
  // ... más clips
  {
    id: 'audio-main',
    type: 'audio',
    start: 0,
    duration: 120,
    url: audioUrl
  }
];
```

### Paso 5: Generar Imágenes
```tsx
import { generateImagesForScript } from './services/music-video-timeline-integration';

const generatedImages = await generateImagesForScript({
  script,
  artistImageUrl,
  onProgress: (progress) => {
    console.log(`${progress.current}/${progress.total} imágenes generadas`);
  }
});

// Resultado:
[
  {
    sceneId: 1,
    imageUrl: 'https://storage.../scene-1.png',
    prompt: '...'
  }
]
```

### Paso 6: Actualizar Timeline con Imágenes
```tsx
import { updateTimelineClipsWithImages } from './services/music-video-timeline-integration';

const clipsWithImages = updateTimelineClipsWithImages(clips, generatedImages);

// Ahora todos los clips tienen URL de imagen
```

### Paso 7: Editar en Timeline
```tsx
<EnhancedTimeline
  clips={clipsWithImages}
  tracks={tracks}
  duration={script.total_duration}
  onClipsChange={setClips}
/>

// El usuario puede:
// - Mover clips (drag & drop)
// - Recortar duración (trim)
// - Cortar clips (razor)
// - Ajustar timing
// - Deshacer/rehacer
```

### Paso 8: Generar Videos con IA
```tsx
import { generateBatchVideosFromClips } from './services/timeline-video-generation-service';

const videoResults = await generateBatchVideosFromClips({
  clips: imageClips,
  model: 'kling-2.1-pro-i2v', // Modelo recomendado
  onProgress: (progress) => {
    console.log(`${progress.progress}% - ${progress.status}`);
  }
});

// Convierte cada imagen en video animado de 5s
```

### Paso 9: Exportar MP4 Final
```tsx
import { exportTimelineToMP4 } from './services/timeline-export-service';

const result = await exportTimelineToMP4({
  clips: finalClips,
  tracks,
  duration: script.total_duration,
  resolution: '1080p',
  quality: 'high',
  includeAudio: true
}, (progress) => {
  console.log(`Exportando: ${progress.progress}%`);
});

// Resultado: Video MP4 descargable
```

## 🎨 Modelos de Generación de Video Disponibles

### KLING (FAL)
- **KLING 2.5 Pro** - Máxima calidad ($Premium)
- **KLING 2.1 Master** - Premium ($1.40/5seg)
- **KLING 2.1 Pro** - Recomendado ⭐ ($0.45/5seg)
- **KLING 2.1 Standard** - Económico ($0.25/5seg)

### Otros Modelos
- **Luma Dream Machine** - Balance calidad-velocidad
- **MiniMax Hailuo 2.3** - Última versión
- **MiniMax Hailuo 02** - Versión estable

## 🗂️ Estructura de Archivos

```
client/src/
├── components/
│   ├── professional-editor/
│   │   ├── EnhancedTimeline.tsx        # Timeline editor
│   │   └── TimelineActions.tsx         # Botones generación/export
│   └── music-video/
│       └── MusicVideoWorkflowEnhanced.tsx  # Flujo completo
│
├── lib/
│   ├── services/
│   │   ├── music-video-timeline-integration.ts  # 🔗 INTEGRACIÓN PRINCIPAL
│   │   ├── timeline-video-generation-service.ts # Generación videos
│   │   └── timeline-export-service.ts           # Exportación MP4
│   └── api/
│       ├── music-video-generator.ts     # Generación de guiones
│       ├── fal-video-service.ts         # KLING, Luma
│       └── minimax-video.ts             # MiniMax
│
└── pages/
    ├── music-video-flow.tsx             # Página flujo completo
    └── timeline-demo.tsx                # Demo standalone
```

## 🔧 Servicios Principales

### `music-video-timeline-integration.ts`
**Función**: Conecta todo el flujo
**Métodos clave**:
```ts
// Convertir script a clips
convertScriptToTimelineClips(options)

// Generar imágenes para escenas
generateImagesForScript(options)

// Actualizar clips con imágenes
updateTimelineClipsWithImages(clips, images)

// Flujo completo automatizado
createMusicVideoFromScript(project, options)

// Persistencia
saveMusicVideoProject(project)
loadMusicVideoProject(projectId)
```

### `timeline-video-generation-service.ts`
**Función**: Generar videos desde imágenes
**Métodos clave**:
```ts
// Generar video individual
generateVideoFromClip(request, onProgress)

// Batch generation
generateBatchVideosFromClips(request)

// Info de modelos
getAvailableVideoModels()
```

### `timeline-export-service.ts`
**Función**: Exportar timeline a MP4
**Métodos clave**:
```ts
// Exportar completo
exportTimelineToMP4(options, onProgress)

// Estimaciones
estimateExportSize(duration, resolution, quality)

// Preview
generateTimelinePreview(clips, duration)
```

## 📊 Tipos de Datos

```typescript
// Proyecto completo
interface MusicVideoProject {
  id: string;
  title: string;
  artistName?: string;
  artistImageUrl?: string;
  audioUrl: string;
  audioDuration: number;
  transcription?: string;
  script?: MusicVideoScript;
  generatedImages?: Array<{
    sceneId: number;
    imageUrl: string;
    prompt: string;
  }>;
  timelineClips?: TimelineClip[];
  finalVideoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Clip del timeline
interface TimelineClip {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'image' | 'text';
  start: number;
  duration: number;
  trackId: string;
  url: string;
  color?: string;
  locked?: boolean;
  metadata?: {
    prompt?: string;
    sceneId?: number;
    lyrics?: string;
  };
}

// Script de video musical
interface MusicVideoScript {
  title: string;
  total_duration: number;
  total_scenes: number;
  scenes: ScenePrompt[];
}

interface ScenePrompt {
  scene_id: number;
  start_time: number;
  duration: number;
  prompt: string;
  negative_prompt?: string;
  lyrics_segment?: string;
}
```

## 🎯 Ejemplo Completo de Uso

```tsx
import { 
  convertScriptToTimelineClips,
  generateImagesForScript,
  updateTimelineClipsWithImages 
} from './services/music-video-timeline-integration';
import { generateBatchVideosFromClips } from './services/timeline-video-generation-service';
import { exportTimelineToMP4 } from './services/timeline-export-service';

async function createMusicVideo() {
  // 1. Generar guion
  const script = await generateMusicVideoPrompts(transcription, 120, true);
  
  // 2. Convertir a timeline
  const { clips, tracks } = convertScriptToTimelineClips({ script, audioUrl });
  
  // 3. Generar imágenes
  const images = await generateImagesForScript({ script });
  
  // 4. Actualizar clips
  const clipsWithImages = updateTimelineClipsWithImages(clips, images);
  
  // 5. Generar videos
  const videoResults = await generateBatchVideosFromClips({
    clips: clipsWithImages.filter(c => c.type === 'image'),
    model: 'kling-2.1-pro-i2v'
  });
  
  // 6. Actualizar clips con videos
  const finalClips = clipsWithImages.map(clip => {
    const result = videoResults.find(r => r.clipId === clip.id);
    if (result?.videoUrl) {
      return { ...clip, type: 'video', url: result.videoUrl };
    }
    return clip;
  });
  
  // 7. Exportar MP4
  const video = await exportTimelineToMP4({
    clips: finalClips,
    tracks,
    duration: script.total_duration,
    quality: 'high'
  });
  
  return video.videoUrl;
}
```

## 🎨 UI Components

### TimelineActions
Botones integrados en el timeline:

```tsx
<TimelineActions
  clips={clips}
  tracks={tracks}
  duration={duration}
  onClipsUpdate={setClips}
/>
```

**Incluye**:
- 🪄 Botón "Generar Videos" - Convierte imágenes a videos
- ⬇️ Botón "Exportar MP4" - Descarga video final

### EnhancedTimeline
Timeline editor profesional:

```tsx
<EnhancedTimeline
  clips={clips}
  tracks={tracks}
  duration={120}
  currentTime={currentTime}
  onClipsChange={setClips}
  onSeek={setCurrentTime}
/>
```

**Funcionalidades**:
- Drag & drop de clips
- Trim desde ambos lados
- Split/Cut con razor tool
- Undo/Redo (50 acciones)
- Zoom timeline
- Multi-track support
- Touch gestures (iPad)

## ⚡ Optimizaciones y Mejores Prácticas

### Performance
- Generación de imágenes en batch (paralelo limitado)
- Videos generados secuencialmente para evitar sobrecarga
- Progress tracking en tiempo real
- Cache de resultados intermedios

### Calidad
- KLING 2.1 Pro recomendado para balance calidad/precio
- Resolución 1080p por defecto
- Calidad "high" para exportación
- Timing preciso desde el guion

### UX
- Progress bars detallados
- Mensajes de estado claros
- Preview antes de exportar
- Estimación de tamaño de archivo
- Auto-save de proyectos

## 🐛 Troubleshooting

### "Error generando imagen para escena X"
- Verificar que el prompt sea válido
- Comprobar límites de API
- Revisar Firebase Storage

### "Timeout en generación de video"
- Videos grandes pueden tardar 5-10min
- Usar modelo más rápido (MiniMax en lugar de KLING)
- Verificar estado de API externa

### "Error exportando MP4"
- Verificar que todos los clips tengan URL
- Comprobar duración total
- Revisar formato de clips

## 📝 TODO / Mejoras Futuras

- [ ] Sistema de preview en tiempo real
- [ ] Transiciones automáticas entre clips
- [ ] Efectos visuales integrados
- [ ] Subtítulos automáticos
- [ ] Multi-idioma para guiones
- [ ] Template library de estilos
- [ ] Collaborative editing
- [ ] Version control para proyectos

## 📚 Referencias

- [FAL Video Models](https://fal.ai/models)
- [MiniMax API](https://minimax.ai)
- [Firebase Storage](https://firebase.google.com/docs/storage)
- [Firestore](https://firebase.google.com/docs/firestore)

---

**Última actualización**: Noviembre 2025
**Versión**: 1.0.0
**Mantenedor**: Boostify Team
