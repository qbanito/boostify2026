/**
 * Definiciones de tipos para el módulo de conversión de voz
 */

import { Timestamp } from "firebase/firestore";

// Ajustes para la conversión de voz
export type VoiceSettings = {
  conversionStrength?: number;
  modelVolumeMix?: number;
  pitchShift?: number;
  usePreprocessing?: boolean;
  usePostprocessing?: boolean;
};

// Estados posibles para una conversión
export type VoiceStatus = 'pending' | 'processing' | 'running' | 'completed' | 'failed';

// Registro de una conversión de voz
export type VoiceRecord = {
  id?: string;
  userId: string;
  fileName: string;
  modelId: number;
  modelName?: string;
  originalFileUrl: string;
  resultFileUrl?: string | null;
  createdAt: Timestamp;
  completedAt?: Timestamp | null;
  status: VoiceStatus;
  progress?: number;
  duration?: string;
  settings?: VoiceSettings;
};

// Modelo de voz disponible
export type VoiceModelType = {
  id: number;
  name: string;
  description: string;
  previewUrl?: string;
};

// Datos para conversiones simuladas en desarrollo
export type MockVoiceType = {
  id: string;
  userId: string;
  fileName: string;
  modelId: number;
  modelName: string;
  originalFileUrl: string;
  resultFileUrl: string | null;
  createdAt: Timestamp;
  completedAt: Timestamp | null;
  status: VoiceStatus;
  settings: VoiceSettings;
  progress: number;
  duration: string;
};