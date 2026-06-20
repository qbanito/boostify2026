// ─── DMX Schema ───────────────────────────────────────────────────────────────

export interface DMXChannel {
  channel: number;  // 1-512
  value: number;    // 0-255
  label?: string;
}

export interface DMXFixture {
  id: string;
  name: string;
  type: 'spot' | 'wash' | 'led_bar' | 'strobe' | 'fog' | 'laser';
  startChannel: number;
  channelCount: number;
  color?: string;     // current color in hex
  dimmer: number;     // 0-255
}

export interface DMXScene {
  id: string;
  name: string;
  description?: string;
  channels: DMXChannel[];
  fixtures: DMXFixture[];
  color: string;       // primary color (hex) for display
  fadeIn: number;      // ms
  fadeOut: number;     // ms
  intensity: number;   // 0-1 master dimmer
  mood: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'blackout' | 'custom';
}

export const PRESET_DMX_SCENES: DMXScene[] = [
  {
    id: 'scene-intro',
    name: 'Intro — Niebla Azul',
    description: 'Niebla lenta con backlight azul profundo',
    channels: [
      { channel: 1, value: 180, label: 'Red' },
      { channel: 2, value: 60, label: 'Green' },
      { channel: 3, value: 255, label: 'Blue' },
      { channel: 4, value: 200, label: 'Dimmer' },
    ],
    fixtures: [],
    color: '#1a3a8f',
    fadeIn: 3000,
    fadeOut: 2000,
    intensity: 0.7,
    mood: 'intro',
  },
  {
    id: 'scene-chorus',
    name: 'Chorus — Explosión Naranja',
    description: 'Strobes y spots en naranja intenso',
    channels: [
      { channel: 1, value: 255, label: 'Red' },
      { channel: 2, value: 100, label: 'Green' },
      { channel: 3, value: 0, label: 'Blue' },
      { channel: 4, value: 255, label: 'Dimmer' },
      { channel: 5, value: 180, label: 'Strobe' },
    ],
    fixtures: [],
    color: '#f97316',
    fadeIn: 500,
    fadeOut: 1000,
    intensity: 1.0,
    mood: 'chorus',
  },
  {
    id: 'scene-verse',
    name: 'Verso — Púrpura Suave',
    description: 'Iluminación suave para letras',
    channels: [
      { channel: 1, value: 120, label: 'Red' },
      { channel: 2, value: 20, label: 'Green' },
      { channel: 3, value: 180, label: 'Blue' },
      { channel: 4, value: 160, label: 'Dimmer' },
    ],
    fixtures: [],
    color: '#7c3aed',
    fadeIn: 1500,
    fadeOut: 1500,
    intensity: 0.6,
    mood: 'verse',
  },
  {
    id: 'scene-blackout',
    name: 'Blackout',
    description: 'Apagado total',
    channels: [
      { channel: 1, value: 0 },
      { channel: 2, value: 0 },
      { channel: 3, value: 0 },
      { channel: 4, value: 0 },
    ],
    fixtures: [],
    color: '#0a0a0a',
    fadeIn: 100,
    fadeOut: 100,
    intensity: 0,
    mood: 'blackout',
  },
];
