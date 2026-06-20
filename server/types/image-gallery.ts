/**
 * Tipos para la galería de imágenes generadas del artista
 */

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: Date | string;
  isVideo: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
}

export interface ImageGallery {
  id: string;
  userId: string;
  singleName: string;
  artistName: string;
  basePrompt: string;
  styleInstructions: string;
  referenceImageUrls: string[];
  generatedImages: GeneratedImage[];
  createdAt: Date | string;
  updatedAt: Date | string;
  isPublic: boolean;
}

export interface CreateGalleryRequest {
  singleName: string;
  artistName: string;
  basePrompt: string;
  styleInstructions: string;
  referenceImages: string[]; // Base64 encoded images
}

export interface GenerateImagesRequest {
  galleryId: string;
  count?: number; // Default 6
}
