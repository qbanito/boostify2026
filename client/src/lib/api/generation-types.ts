/**
 * Type definitions for image and video generation results
 */

/**
 * Result of image generation operations
 */
export interface ImageResult {
  url: string;
  provider: string;
  requestId?: string;
  taskId?: string;
  status?: string;
  prompt: string;
  createdAt: Date;
  firestoreId?: string; // ID de referencia en Firestore cuando se guarda
}

/**
 * Result of video generation operations
 */
export interface VideoResult {
  url: string;
  provider: string;
  requestId?: string;
  taskId?: string;
  status?: string;
  prompt: string;
  createdAt: Date;
  firestoreId?: string; // ID de referencia en Firestore cuando se guarda
}