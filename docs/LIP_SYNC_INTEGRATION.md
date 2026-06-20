# 🎤 Integración de Lip-Sync en Videos Musicales

## Resumen del Flujo

Este documento explica cómo usar el servicio de lip-sync para sincronizar el canto del artista con el audio original.

## 🔄 Flujo Completo de Generación

```
1. Transcripción del Audio
   ↓
2. Generación de Script JSON (con duraciones 2-4s y lyrics_segment)
   ↓
3. Generación de Imágenes (FLUX Kontext Pro para preservar rostro)
   ↓
4. Conversión Imagen → Video (MiniMax o FAL Video)
   ↓
5. ✨ APLICAR LIP-SYNC a escenas de "performance"
   ↓
6. Unir todos los clips en timeline final
```

## 📝 Cambios en el Script JSON

El script ahora incluye el campo `lyrics_segment` para cada escena:

```json
{
  "scenes": [
    {
      "scene_id": "scene-1",
      "start_time": 0,
      "duration": 3.5,
      "lyrics_segment": "I wake up every morning with the sun in my eyes",
      "role": "performance",
      "shot_type": "CU",
      ...
    }
  ]
}
```

## 🎬 Uso del Servicio de Lip-Sync

### Importar el servicio

```typescript
import { applyLipSync, batchLipSync } from '@/lib/api/fal-lipsync';
```

### Aplicar lip-sync a un video individual

```typescript
const result = await applyLipSync({
  videoUrl: 'https://example.com/generated-video.mp4',
  audioUrl: 'https://example.com/original-song.mp3',
  syncMode: 'cut_off' // Corta el video cuando el audio termina
});

if (result.success) {
  console.log('Video sincronizado:', result.videoUrl);
}
```

### Procesar múltiples escenas en batch

```typescript
const videosToSync = scenes
  .filter(scene => scene.role === 'performance') // Solo escenas de canto
  .map(scene => ({
    sceneId: scene.scene_id,
    videoUrl: scene.generatedVideoUrl,
    audioUrl: originalAudioUrl // El audio completo de la canción
  }));

const results = await batchLipSync(videosToSync);

// Actualizar las escenas con los videos sincronizados
for (const [sceneId, result] of results.entries()) {
  if (result.success) {
    const scene = scenes.find(s => s.scene_id === sceneId);
    if (scene) {
      scene.syncedVideoUrl = result.videoUrl;
    }
  }
}
```

## ⚙️ Opciones de Sync Mode

| Modo | Descripción | Cuándo usar |
|------|-------------|-------------|
| `cut_off` | Corta el video cuando el audio termina | **Recomendado** - Para escenas cortas |
| `loop` | Repite el video hasta que el audio termine | Videos muy cortos |
| `bounce` | Reproduce el video hacia adelante y atrás | Efectos creativos |
| `silence` | Añade silencio al audio para igualar duración | Poco común |
| `remap` | Ajusta velocidad del video para coincidir | Ajustes sutiles |

## 🎯 Integración en el Componente Principal

### Paso 1: Generar videos sin lip-sync

```typescript
// Generar videos usando MiniMax o FAL
const videoResults = await generateVideos(scenes);
```

### Paso 2: Aplicar lip-sync solo a escenas de performance

```typescript
const performanceScenes = scenes.filter(s => s.role === 'performance');

for (const scene of performanceScenes) {
  const syncResult = await applyLipSync({
    videoUrl: scene.generatedVideoUrl,
    audioUrl: audioFileUrl, // Audio original completo
    syncMode: 'cut_off'
  });
  
  if (syncResult.success) {
    scene.finalVideoUrl = syncResult.videoUrl; // Video con lip-sync
  } else {
    scene.finalVideoUrl = scene.generatedVideoUrl; // Fallback al video sin sync
    console.warn(`Lip-sync falló para ${scene.scene_id}, usando video original`);
  }
}

// Las escenas de b-roll no necesitan lip-sync
for (const scene of scenes.filter(s => s.role === 'b-roll')) {
  scene.finalVideoUrl = scene.generatedVideoUrl;
}
```

## 💰 Costos

- **Sync Lipsync 2.0**: ~$0.091 por video
- **LatentSync**: $0.20 por video hasta 40 segundos ($0.005/segundo adicional)

Para 10 escenas (5 performance + 5 b-roll):
- Solo se procesan 5 escenas de performance
- Costo total: ~$0.45 - $1.00

## ⏱️ Tiempo de Procesamiento

- Video de 3 segundos: ~30-60 segundos
- Video de 10 segundos: ~2-3 minutos
- Batch de 5 videos: ~5-10 minutos total

## 🐛 Troubleshooting

### Error: "FAL_API_KEY no configurada"
- Verifica que `VITE_FAL_API_KEY` esté en las variables de entorno
- Reinicia el servidor después de agregar la clave

### Error: "Lip-sync timeout"
- El video puede ser muy largo (>40 segundos)
- Verifica que la URL del video sea accesible públicamente
- Intenta con un video más corto

### Video desincronizado
- Asegúrate de usar `cut_off` como syncMode
- Verifica que las duraciones en el JSON coincidan con el audio
- El campo `lyrics_segment` debe contener las letras exactas del segmento

## 📊 Monitoreo

El servicio incluye logs detallados:

```
🎤 Iniciando lip-sync con Sync Lipsync 2.0...
📹 Video: https://...
🎵 Audio: https://...
⏳ Lip-sync job submitted: req_12345
🔄 Esperando resultado...
⏳ Status: IN_PROGRESS (attempt 1/60)
✅ Lip-sync completado exitosamente!
```

## 🎨 Próximos Pasos

1. ✅ Script con duraciones 2-4 segundos
2. ✅ Campo `lyrics_segment` incluido
3. ✅ Servicio de lip-sync creado
4. 🔜 Integrar en el flujo de generación de videos
5. 🔜 UI para mostrar progreso de lip-sync
6. 🔜 Sistema de cache para videos sincronizados

## 📚 Recursos

- [Sync Lipsync 2.0 Docs](https://fal.ai/models/fal-ai/sync-lipsync/v2)
- [LatentSync Alternative](https://fal.ai/models/fal-ai/latentsync)
- [FAL AI API Reference](https://fal.ai/docs)
