/**
 * Definiciones de tipos para los modelos de datos utilizados en la aplicación
 */

/**
 * Resultado de una generación de imagen
 */
export interface ImageResult {
  id: string;
  url: string;
  prompt?: string;
  createdAt: Date;
  model?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Resultado de una generación de música
 */
export interface MusicResult {
  id: string;
  url: string;
  title?: string;
  prompt?: string;
  createdAt: Date;
  model?: string;
  userId?: string;
  duration?: number;
  bpm?: number;
  metadata?: Record<string, any>;
}

/**
 * Resultado de una generación de video
 */
export interface VideoResult {
  id: string;
  url: string;
  title?: string;
  prompt?: string;
  createdAt: Date;
  model?: string;
  userId?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Resultado de un análisis de estilo musical
 */
export interface StyleAnalysisResult {
  id: string;
  genre: string;
  recommendations: string[];
  colorPalette: string[];
  imageUrl?: string;
  createdAt: Date;
  userId?: string;
}

/**
 * Resultado de Virtual Try-On
 */
export interface TryOnResult {
  id: string;
  resultUrl?: string;
  modelImageUrl: string;
  clothingImageUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  userId?: string;
  error?: string;
}