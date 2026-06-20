/**
 * Tipos centralizados para funcionalidades de audio y multimedia
 */

import { Timestamp } from "firebase/firestore";

// Definiciones de tipos de audio

/** Estados posibles para una conversión de audio */
export const ConversionStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed'
} as const;

export type ConversionStatus = typeof ConversionStatus[keyof typeof ConversionStatus];

/** Configuración para procesamiento de voz */
export type VoiceSettings = {
  conversionStrength?: number;
  modelVolumeMix?: number;
  pitchShift?: number;
  usePreprocessing?: boolean;
  usePostprocessing?: boolean;
};

/** Registro de conversión de voz en la base de datos */
export type VoiceConversionRecord = {
  id?: string;
  userId: string;
  fileName: string;
  modelId: number;
  modelName?: string;
  originalFileUrl: string;
  resultFileUrl?: string | null;
  createdAt: Timestamp;
  completedAt?: Timestamp | null;
  status: ConversionStatus;
  progress?: number;
  duration?: string;
  settings?: VoiceSettings;
};

/** Modelo de voz para conversiones */
export type VoiceModel = {
  id: number;
  name: string;
  description: string;
  previewUrl?: string;
};

/** Conversión de voz para la interfaz de usuario */
export type VoiceConversion = {
  id: number | string; 
  createdAt: string;
  type: string;
  voiceModelId: number;
  modelName?: string;
  status: ConversionStatus | string;
  jobStartTime: string;
  jobEndTime: string | null;
  resultUrl?: string | null;
  fileName?: string;
  originalUrl?: string | null;
  duration?: string;
  progress?: number;
};

// Reutilizamos las definiciones de model-types.ts para evitar duplicación
import type { ImageResult as ModelImageResult, VideoResult as ModelVideoResult } from './model-types';

// Re-exportamos los tipos para mantener compatibilidad
export type ImageResult = ModelImageResult;
export type VideoResult = ModelVideoResult;

/** Datos simulados para pruebas */
export type MockVoiceData = {
  id: string;
  userId: string;
  fileName: string;
  modelId: number;
  modelName: string;
  originalFileUrl: string;
  resultFileUrl: string | null;
  createdAt: Timestamp;
  completedAt: Timestamp | null;
  status: ConversionStatus;
  settings: VoiceSettings;
  progress: number;
  duration: string;
};