// Datos de muestra para el editor profesional de videos musicales

// Clips de ejemplo para la línea de tiempo
export const sampleClips = [
  {
    id: 1,
    title: 'Intro',
    start: 0,
    duration: 10,
    type: 'video',
    color: '#4CAF50',
    thumbnail: '/assets/thumbnails/intro.jpg',
    layer: 1,
    format: 'mp4',
    resolution: '1920x1080',
    filters: [],
    effects: [],
    speed: 1.0,
    volume: 1.0,
    rotation: 0,
    cropData: null,
    sceneType: 'establishing_shot',
    metadata: {
      dateCreated: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      source: 'imported'
    }
  },
  {
    id: 2,
    title: 'Verso 1',
    start: 10,
    duration: 15,
    type: 'video',
    color: '#4CAF50',
    thumbnail: '/assets/thumbnails/verse.jpg',
    layer: 1,
    format: 'mp4',
    resolution: '1920x1080',
    filters: [{id: 'brightness', value: 0.1, enabled: true}],
    effects: [],
    speed: 1.0,
    volume: 1.0,
    rotation: 0,
    cropData: null,
    sceneType: 'medium_shot',
    metadata: {
      dateCreated: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      source: 'imported'
    }
  },
  {
    id: 3,
    title: 'Coro',
    start: 25,
    duration: 20,
    type: 'video',
    color: '#4CAF50',
    thumbnail: '/assets/thumbnails/chorus.jpg',
    layer: 1,
    format: 'mp4',
    resolution: '1920x1080',
    filters: [],
    effects: [{id: 'zoom', intensity: 0.5, startTime: 2, endTime: 5}],
    speed: 1.1,
    volume: 1.0,
    rotation: 0,
    cropData: null,
    sceneType: 'wide_shot',
    metadata: {
      dateCreated: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      source: 'imported'
    }
  },
  {
    id: 4,
    title: 'Overlay Título',
    start: 5,
    duration: 8,
    type: 'text',
    color: '#9C27B0',
    thumbnail: null,
    layer: 2,
    format: 'text',
    content: 'Mi Video Musical',
    textStyle: {
      fontFamily: 'Arial',
      fontSize: 48,
      fontWeight: 'bold',
      color: '#FFFFFF',
      shadow: true,
      alignment: 'center',
      animation: 'fade-in',
      animationDuration: 1.5
    },
    effects: [{id: 'fade', intensity: 0.8, startTime: 0, endTime: 1}],
    position: { x: 0.5, y: 0.5 }, // Coordenadas normalizadas (0-1)
    metadata: {
      dateCreated: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      source: 'created'
    }
  },
  {
    id: 5,
    title: 'Efecto Transición',
    start: 24,
    duration: 2,
    type: 'effect',
    color: '#FF9800',
    thumbnail: null,
    layer: 3,
    effectType: 'transition',
    effectParams: {
      type: 'dissolve',
      intensity: 0.7
    },
    metadata: {
      dateCreated: new Date().toISOString(),
      lastModified: new Date().toISOString()
    }
  },
  {
    id: 6,
    title: 'Imagen Superpuesta',
    start: 15,
    duration: 10,
    type: 'image',
    color: '#2196F3',
    thumbnail: '/assets/thumbnails/overlay.jpg',
    layer: 2,
    format: 'png',
    resolution: '1200x800',
    opacity: 0.8,
    filters: [{id: 'blur', value: 0.1, enabled: true}],
    effects: [{id: 'fade', intensity: 0.6, startTime: 0, endTime: 1}],
    position: { x: 0.7, y: 0.3 },
    scale: 0.5,
    rotation: 0,
    metadata: {
      dateCreated: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      source: 'imported'
    }
  }
];

// Datos de forma de onda de audio
export const sampleAudioData = {
  waveform: Array(1000).fill(0).map(() => Math.random() * 0.8),
  peaks: [
    { time: 10, label: 'Verso 1', type: 'section' },
    { time: 25, label: 'Coro', type: 'section' },
    { time: 45, label: 'Verso 2', type: 'section' },
    { time: 60, label: 'Puente', type: 'section' },
    { time: 70, label: 'Coro Final', type: 'section' }
  ]
};

// Efectos disponibles
export const sampleEffects = [
  // Transiciones
  { id: 'fade', name: 'Fundido', icon: 'fade', category: 'transition' },
  { id: 'dissolve', name: 'Disolución', icon: 'dissolve', category: 'transition' },
  { id: 'wipe', name: 'Barrido', icon: 'wipe', category: 'transition' },
  { id: 'zoom', name: 'Zoom', icon: 'zoom', category: 'transition' },
  { id: 'slide', name: 'Deslizamiento', icon: 'slide', category: 'transition' },
  { id: 'push', name: 'Empujar', icon: 'push', category: 'transition' },
  { id: 'flip', name: 'Voltear', icon: 'flip', category: 'transition' },
  { id: 'rotate', name: 'Rotar', icon: 'rotate', category: 'transition' },
  { id: 'morph', name: 'Transformación', icon: 'morph', category: 'transition' },
  
  // Filtros visuales
  { id: 'blur', name: 'Desenfoque', icon: 'blur', category: 'visual' },
  { id: 'b&w', name: 'Blanco y Negro', icon: 'b&w', category: 'visual' },
  { id: 'sepia', name: 'Sepia', icon: 'sepia', category: 'visual' },
  { id: 'vignette', name: 'Viñeta', icon: 'vignette', category: 'visual' },
  { id: 'grainy', name: 'Granulado', icon: 'grainy', category: 'visual' },
  { id: 'mirror', name: 'Espejo', icon: 'mirror', category: 'visual' },
  { id: 'pixelate', name: 'Pixelar', icon: 'pixelate', category: 'visual' },
  
  // Corrección de color
  { id: 'brightness', name: 'Brillo', icon: 'brightness', category: 'color', min: -1, max: 1, default: 0 },
  { id: 'contrast', name: 'Contraste', icon: 'contrast', category: 'color', min: -1, max: 1, default: 0 },
  { id: 'saturation', name: 'Saturación', icon: 'saturation', category: 'color', min: 0, max: 2, default: 1 },
  { id: 'hue', name: 'Tono', icon: 'hue', category: 'color', min: 0, max: 360, default: 0 },
  { id: 'temperature', name: 'Temperatura', icon: 'temperature', category: 'color', min: -1, max: 1, default: 0 },
  { id: 'vibrance', name: 'Vibración', icon: 'vibrance', category: 'color', min: 0, max: 2, default: 1 },
  { id: 'gamma', name: 'Gamma', icon: 'gamma', category: 'color', min: 0.5, max: 2.5, default: 1 },
  
  // Estabilización y mejoras
  { id: 'stabilize', name: 'Estabilizar', icon: 'stabilize', category: 'enhance' },
  { id: 'denoise', name: 'Reducir Ruido', icon: 'denoise', category: 'enhance' },
  { id: 'sharpen', name: 'Enfocar', icon: 'sharpen', category: 'enhance' },
  { id: 'grain', name: 'Añadir Grano', icon: 'grain', category: 'enhance' },
  { id: 'lut', name: 'LUT', icon: 'lut', category: 'enhance', lutOptions: [
    {id: 'cinematic', name: 'Cinematográfico'},
    {id: 'warm', name: 'Cálido'},
    {id: 'cool', name: 'Frío'},
    {id: 'vibrant', name: 'Vibrante'}
  ] }
];

// Datos de beats para la visualización de tiempo musical
export const sampleBeats = {
  metadata: {
    songTitle: 'Canción de Demostración',
    artist: 'Artista de Prueba',
    duration: 120,
    bpm: 128,
    key: 'C Mayor',
    timeSignature: '4/4',
    complexity: 'Media',
    generatedAt: new Date().toISOString(),
    beatAnalysis: {
      totalBeats: 240,
      beatTypes: {
        downbeats: 60,
        accents: 60,
        regularBeats: 120
      },
      averageInterval: 0.5,
      patternComplexity: 'Media'
    }
  },
  // Generar beats cada 0.5 segundos (simulando 120 BPM en 4/4)
  beats: Array(240).fill(0).map((_, i) => {
    // En 4/4, cada 4 beats es un downbeat (primer tiempo del compás)
    const isDownbeat = i % 4 === 0;
    // Los tiempos 2 y 4 de cada compás son acentos en muchos géneros
    const isAccent = i % 4 === 1 || i % 4 === 3;
    
    return {
      time: i * 0.5, // Cada beat ocurre cada 0.5 segundos
      type: isDownbeat ? 'downbeat' : (isAccent ? 'accent' : 'beat'),
      intensity: isDownbeat ? 0.9 : (isAccent ? 0.7 : 0.5 + Math.random() * 0.2),
      energy: isDownbeat ? (0.8 + Math.random() * 0.2) : (isAccent ? (0.6 + Math.random() * 0.2) : (0.4 + Math.random() * 0.2)),
      isDownbeat
    };
  })
};