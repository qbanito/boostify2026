/**
 * Tipos para la funcionalidad de modelos de voz personalizados
 * Basados en la API de Voice Models de Revocalize
 * 
 * Incluye definiciones para:
 * - Modelos de voz (VoiceModel)
 * - Estado de entrenamiento (TrainingStatus)
 * - Solicitudes de conversión (VoiceConversionRequest)
 * - Estado de tareas de conversión (VoiceConversionTaskStatus)
 * - Registro de conversiones (VoiceConversionRecord)
 */

// Enumera los géneros disponibles para los modelos de voz
export type VoiceModelGenre = 
  | 'pop' 
  | 'rock' 
  | 'hip-hop' 
  | 'r&b' 
  | 'country' 
  | 'jazz' 
  | 'classical' 
  | 'electronic' 
  | 'world' 
  | 'other';

// Enumera los tipos de voces disponibles
export type VoiceType = 
  | 'soprano' 
  | 'mezzo-soprano' 
  | 'alto' 
  | 'tenor' 
  | 'baritone' 
  | 'bass';

// Enumera las categorías de edad
export type AgeCategory = 
  | 'child' 
  | 'young adult' 
  | 'adult';

// Define el rango vocal
export interface VocalRange {
  min: string; // Ejemplo: 'C3'
  max: string; // Ejemplo: 'C7'
}

// Define el modelo de voz completo
export interface VoiceModel {
  id: string;
  name: string;
  description: string;
  type?: string; // 'inference', 'custom', etc.
  gender?: 'male' | 'female' | 'neutral';
  language?: string; // En formato ISO 639-1 (ej: 'en-US', 'es-ES')
  tags?: string[];
  samples?: string[]; // URLs de muestras de audio
  // Campos adicionales para modelos detallados
  age?: AgeCategory;
  traits?: string[];
  genre?: VoiceModelGenre;
  voice_type?: VoiceType;
  vocal_range?: VocalRange;
  isCustom?: boolean;
  isReady?: boolean;
  createdAt?: Date;
  userId?: string;
}

// Tipo para crear un nuevo modelo de voz
export interface NewVoiceModel {
  name: string;
  gender: 'male' | 'female';
  age: AgeCategory;
  description: string;
  base_language: string;
  traits: string[];
  genre: VoiceModelGenre;
  voice_type: VoiceType;
  vocal_range: VocalRange;
}

// Estado de entrenamiento del modelo
export interface TrainingStatus {
  status: 'pending' | 'training' | 'completed' | 'failed';
  model_id: string;
  current_epoch?: number;
  total_epochs?: number;
  error?: string;
  created_at?: Date;
  updated_at?: Date;
}

// Tipo para la respuesta al verificar el estado de una tarea de conversión
export interface VoiceConversionTaskStatus {
  status: 'in_progress' | 'completed' | 'failed';
  progress?: number;
  result?: {
    url: string;
  };
  error?: string;
}

// Tipo para los efectos de audio
export interface AudioEffect {
  name: string;
  enabled: boolean;
  settings: {
    [key: string]: number | string | boolean;
  };
}

// Tipo para la solicitud de conversión de audio
export interface VoiceConversionRequest {
  // Nuevo formato en camelCase
  audioFile: File;
  model: string;
  transpose?: number;
  generationsCount?: number;
  effects?: AudioEffect[];
  // Campos en el formato anterior para compatibilidad
  audio_file?: File; // @deprecated - usar audioFile
  generations_count?: number; // @deprecated - usar generationsCount
}

// Tipo para la respuesta de la API al convertir audio
export interface VoiceConversionResponse {
  taskId: string;
  // Mantenido para compatibilidad con código anterior que todavía usa este campo
  recordId?: string;
}

// Tipo para registros de conversiones de voz almacenados
export interface VoiceConversionRecord {
  id?: string;
  taskId: string;
  userId: string;
  model: string;
  modelName?: string;
  status: 'in_progress' | 'completed' | 'failed';
  inputUrl: string;
  outputUrl?: string;
  // Campos compatibles con versiones anteriores - marcar como deprecated
  task_id?: string; // @deprecated - usar taskId
  input_audio_url?: string; // @deprecated - usar inputUrl
  output_audio_urls?: string[]; // @deprecated - usar outputUrl
  effects?: AudioEffect[];
  transpose?: number;
  createdAt: Date | any; // Puede ser Timestamp de Firestore
  updatedAt: Date | any;
}