# Enhanced Professional Timeline Editor

## 📖 Descripción

Timeline profesional 100% funcional y responsivo para edición de video, optimizado tanto para desktop como para dispositivos móviles (iPad, tablets, smartphones).

## ✨ Características Principales

### 1. **Sistema Completo de Undo/Redo**
- Historial de cambios con stack completo
- Hasta 50 niveles de deshacer
- Atajos de teclado: `Cmd/Ctrl+Z` (deshacer), `Cmd/Ctrl+Y` (rehacer)

### 2. **Drag & Drop Avanzado**
- Mover clips con detección de colisiones
- Snap automático a la grilla y otros clips
- Prevención de solapamientos
- Soporte para touch en móvil

### 3. **Trim/Resize de Clips**
- Ajustar inicio y fin de clips desde los bordes
- Duración mínima protegida (0.1s)
- Modo "Trim" dedicado con handles visibles
- Feedback visual en tiempo real

### 4. **Split/Cortar Clips**
- Herramienta "Razor" para cortar clips
- División precisa en cualquier punto
- Mantiene propiedades del clip original
- Atajos: tecla `C`

### 5. **100% Responsivo Móvil**
- Diseño adaptable a todas las pantallas
- Touch gestures optimizados:
  - **Pinch-to-zoom**: Dos dedos para zoom
  - **Drag**: Mover clips con un dedo
  - **Tap**: Seleccionar clips
- Botones grandes y accesibles en móvil
- Toolbar adaptable según tamaño de pantalla

### 6. **Multi-Track Support**
- Soporte para múltiples pistas (Video, Audio, Mix)
- Gestión de visibilidad y bloqueo por pista
- Colores personalizados por tipo de clip
- Hasta 5 pistas simultáneas

### 7. **Herramientas Profesionales**
- **Select (V)**: Selección y movimiento de clips
- **Razor (C)**: Cortar clips
- **Trim (T)**: Ajustar duración
- **Hand (H)**: Pan/navegación

### 8. **Atajos de Teclado**
```
Space       - Play/Pause
V           - Select Tool
C           - Razor Tool
T           - Trim Tool
H           - Hand Tool
Delete      - Eliminar clips seleccionados
Cmd/Ctrl+Z  - Deshacer
Cmd/Ctrl+Y  - Rehacer
Cmd/Ctrl+D  - Duplicar clips
```

## 🚀 Uso

### Importación Básica

```tsx
import { EnhancedTimeline } from '@/components/professional-editor/EnhancedTimeline';

// En tu componente
<EnhancedTimeline
  clips={clips}
  tracks={tracks}
  currentTime={currentTime}
  duration={duration}
  isPlaying={isPlaying}
  onClipsChange={handleClipsChange}
  onSeek={handleSeek}
  onPlay={handlePlay}
  onPause={handlePause}
/>
```

### Estructura de Datos

```typescript
// Clip
interface TimelineClip {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'image' | 'text';
  start: number;        // segundos
  duration: number;     // segundos
  url: string;
  trackId: string;
  color?: string;
  selected?: boolean;
  locked?: boolean;
}

// Track
interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'mix';
  visible: boolean;
  locked: boolean;
  color?: string;
}
```

### Ejemplo Completo

```tsx
import { useState } from 'react';
import { EnhancedTimeline, TimelineClip, TimelineTrack } from '@/components/professional-editor';

export function MyVideoEditor() {
  const [clips, setClips] = useState<TimelineClip[]>([
    {
      id: 'clip-1',
      title: 'Intro',
      type: 'video',
      start: 0,
      duration: 5,
      url: '/video1.mp4',
      trackId: '0'
    }
  ]);

  const [tracks] = useState<TimelineTrack[]>([
    {
      id: '0',
      name: 'Video Track',
      type: 'video',
      visible: true,
      locked: false
    }
  ]);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <EnhancedTimeline
      clips={clips}
      tracks={tracks}
      currentTime={currentTime}
      duration={60}
      isPlaying={isPlaying}
      onClipsChange={setClips}
      onSeek={setCurrentTime}
      onPlay={() => setIsPlaying(true)}
      onPause={() => setIsPlaying(false)}
    />
  );
}
```

## 📱 Optimización Móvil

### Touch Gestures

1. **Pinch to Zoom**
   - Usa dos dedos para hacer zoom in/out
   - Zoom range: 25% a 400%

2. **Drag Clips**
   - Toca y arrastra clips para moverlos
   - La colisión se detecta automáticamente

3. **Trim en Móvil**
   - Selecciona modo "Trim"
   - Toca y arrastra los bordes del clip

### Responsive Toolbar

- Desktop: Botones icon + herramientas completas
- Mobile: Botones más grandes + herramientas esenciales
- iPad: Vista híbrida optimizada

## 🎨 Personalización

### Colores de Clips

Los colores se asignan automáticamente por tipo:
- Video: `#8B5CF6` (púrpura)
- Audio: `#3B82F6` (azul)
- Image: `#10B981` (verde)
- Text: `#F59E0B` (ámbar)

Puedes sobrescribir con la propiedad `color` en cada clip.

### Zoom Levels

El zoom se calcula como:
```typescript
scaledPixelsPerSecond = 100 * zoom
// zoom range: 0.25x - 4x
```

## 🔧 API Callbacks

### onClipsChange
```typescript
onClipsChange?: (clips: TimelineClip[]) => void
```
Se llama cada vez que los clips cambian (mover, resize, delete, etc.)

### onSeek
```typescript
onSeek?: (time: number) => void
```
Se llama cuando el usuario busca una posición diferente en el timeline.

### onPlay / onPause
```typescript
onPlay?: () => void
onPause?: () => void
```
Control de reproducción.

## 🐛 Detección de Colisiones

El sistema previene automáticamente que los clips se solapen:

```typescript
// Ejemplo interno
const checkCollision = (clipId, newStart, newDuration, trackId) => {
  // Verifica si el nuevo rango colisiona con otros clips
  // en la misma pista
  return clips.some(clip => {
    if (clip.id === clipId || clip.trackId !== trackId) return false;
    const clipEnd = clip.start + clip.duration;
    const newEnd = newStart + newDuration;
    return (newStart < clipEnd && newEnd > clip.start);
  });
};
```

## 📊 Demo

Visita `/timeline-demo` para ver una demostración completa con:
- Clips de ejemplo pre-cargados
- Todas las herramientas habilitadas
- Instrucciones de uso
- Atajos de teclado
- Exportación a JSON

## 🔗 Integración con Proyectos Existentes

### Reemplazar Timeline Antiguo

```tsx
// Antes
import ProfessionalTimeline from '@/components/professional-editor/fixed-timeline';

// Después
import { EnhancedTimeline as ProfessionalTimeline } from '@/components/professional-editor';
```

### Compatibilidad de Tipos

El `EnhancedTimeline` usa tipos más simples que son compatibles con la mayoría de sistemas existentes. Si necesitas convertir:

```typescript
// Convertir de TimelineClip antiguo a nuevo
const convertClip = (oldClip: OldTimelineClip): TimelineClip => ({
  id: oldClip.id.toString(),
  title: oldClip.title || oldClip.name,
  type: oldClip.type,
  start: oldClip.start || oldClip.startTime,
  duration: oldClip.duration,
  url: oldClip.url || oldClip.mediaUrl || '',
  trackId: oldClip.trackId || oldClip.layer?.toString() || '0',
  selected: oldClip.selected,
  locked: oldClip.locked
});
```

## 🎯 Casos de Uso

### 1. Editor de Videos Musicales
```tsx
<EnhancedTimeline
  clips={musicVideoClips}
  tracks={videoTracks}
  currentTime={audioTime}
  duration={songDuration}
  // ...
/>
```

### 2. Editor de Podcasts
```tsx
<EnhancedTimeline
  clips={audioSegments}
  tracks={[mainTrack, introTrack, musicTrack]}
  // ...
/>
```

### 3. Editor de Presentaciones
```tsx
<EnhancedTimeline
  clips={slideClips}
  tracks={presentationTracks}
  // ...
/>
```

## 📝 Notas

- El sistema está optimizado para 60 FPS en desktop y 30 FPS en móvil
- Historial limitado a 50 acciones para performance
- Duración mínima de clip: 0.1 segundos
- Snap threshold: 0.1 segundos

## 🚧 Próximas Características

- [ ] Multi-selección con shift-click
- [ ] Copy/paste de clips
- [ ] Efectos de transición visuales
- [ ] Marcadores personalizados
- [ ] Exportación a video

## 📄 Licencia

Parte del proyecto Boostify Music Platform.
