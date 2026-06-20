# GSAP Integration - Music Video Creator

## 📖 Overview

Se ha integrado **GSAP (GreenSock Animation Platform)** al timeline de music-video-creator para proporcionar transiciones cinemáticas profesionales entre escenas.

## ✨ Features

### Transiciones Disponibles
- **Fade**: Desvanecimiento suave
- **Crossfade**: Disolución cruzada entre escenas
- **Slide** (left/right/up/down): Deslizamiento direccional
- **Zoom** (in/out): Acercamiento/alejamiento
- **Wipe**: Barrido
- **Dissolve**: Disolución
- **Cut**: Corte directo

### Movimientos de Cámara
- **Pan** (left/right): Panorámica horizontal
- **Zoom** (in/out): Acercamiento/alejamiento gradual
- **Static**: Sin movimiento

### Controles de Reproducción
- ▶️ Play / Pause
- ⏮️ Skip backward / forward (5s)
- 🔄 Restart
- 🎯 Seek (timeline slider)
- ⛶ Fullscreen

## 🎯 Cómo Usar

### 1. Generar Imágenes
1. Ve a `/music-video-creator`
2. Selecciona un director o usa AI Video Creation
3. Genera las imágenes para tu video

### 2. Configurar Transiciones
En el **ImageSequenceManager**:
- Cada imagen puede tener:
  - **Shot Type**: close-up, medium, wide
  - **Transition Type**: crossfade, fade, slide, zoom
  - **Camera Movement**: pan-left, pan-right, zoom-in, zoom-out

### 3. Preview con GSAP
1. Haz clic en el botón **"Preview GSAP"**
2. Se abrirá el reproductor con animaciones en tiempo real
3. Usa los controles para reproducir, pausar, o saltar
4. Las transiciones configuradas se ejecutan con GSAP

## 🛠️ Archivos Creados

```
client/src/lib/services/gsap-transitions.ts
  └── Servicio principal de GSAP con toda la lógica de transiciones

client/src/components/music-video/gsap-video-preview.tsx
  └── Componente de preview con controles de reproducción

client/src/components/music-video/image-sequence-manager.tsx
  └── Actualizado con botón "Preview GSAP" (línea 416-426)
```

## 🎬 Ejemplo de Uso

```typescript
// Las transiciones se configuran automáticamente desde ImageSequenceManager
const scenes = [
  {
    imageUrl: "https://...",
    duration: 3,
    transitionType: "crossfade",
    transitionDuration: 0.5,
    cameraMovement: "zoom-in",
    shotType: "close-up"
  },
  {
    imageUrl: "https://...",
    duration: 4,
    transitionType: "slide-left",
    transitionDuration: 0.8,
    cameraMovement: "pan-right",
    shotType: "wide"
  }
];

// El componente GSAPVideoPreview maneja todo automáticamente
<GSAPVideoPreview scenes={scenes} onClose={() => setShowPreview(false)} />
```

## 🔧 Personalización

### Agregar Nueva Transición

Edita `client/src/lib/services/gsap-transitions.ts`:

```typescript
case 'mi-transicion':
  this.timeline!.to(element, {
    // Propiedades GSAP personalizadas
    opacity: 0,
    rotation: 360,
    duration: transition.duration,
    ease: 'power2.inOut'
  });
  break;
```

### Cambiar Easing

```typescript
transition: {
  type: 'fade',
  duration: 1,
  ease: 'elastic.out(1, 0.3)' // ← Easing personalizado
}
```

## 💡 Tips Profesionales

1. **Crossfade para transiciones suaves**: Úsalo entre escenas relacionadas
2. **Cut para cambios bruscos**: Ideal para ritmo rápido
3. **Zoom + Pan juntos**: Efecto Ken Burns clásico
4. **Duración de transición**: 0.3-0.8s para sutileza, 1-2s para drama

## ✅ Integración No Destructiva

- ✅ El código existente NO fue modificado
- ✅ GSAP solo se activa cuando presionas "Preview GSAP"
- ✅ El timeline original sigue funcionando igual
- ✅ Puede coexistir con framer-motion sin conflictos

## 📦 Dependencias

```json
{
  "gsap": "^3.x.x"
}
```

## 🎨 Próximas Mejoras Posibles

- [ ] Sincronización con música (beat detection)
- [ ] Efectos de color grading con GSAP
- [ ] Exportar video con transiciones
- [ ] Presets de transiciones (Cinematic, Fast, Smooth)
- [ ] Keyframes personalizados por escena

---

**Creado**: Noviembre 2024  
**Versión**: 1.0  
**Framework**: GSAP 3.x + React + TypeScript
