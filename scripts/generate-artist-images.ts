/**
 * Script para generar imágenes de artistas virtuales usando FAL AI Nano Banana Pro
 */
import { generateArtistImagesWithFAL } from '../server/services/fal-service';
import { logger } from '../server/utils/logger';

export interface ArtistImageUrls {
  profileUrl: string;
  coverUrl: string;
}

/**
 * Genera imágenes para un artista basándose en su descripción
 * Usa FAL AI Nano Banana Pro para generación de alta calidad
 * @param description - Descripción física del artista generada por IA
 * @param artistName - Nombre del artista (opcional)
 * @param genre - Género musical del artista (opcional)
 * @returns URLs de las imágenes generadas (perfil y portada)
 */
export async function generateArtistImages(
  description: string,
  artistName: string = 'Unknown Artist',
  genre: string = 'pop'
): Promise<ArtistImageUrls> {
  logger.log(`🎨 Generando imágenes para artista con FAL AI Nano Banana Pro...`);
  logger.log(`📝 Descripción: ${description.substring(0, 100)}...`);

  try {
    const result = await generateArtistImagesWithFAL(description, artistName, genre);
    
    logger.log(`✅ Imagen de perfil generada: ${result.profileUrl.substring(0, 80)}...`);
    logger.log(`✅ Imagen de portada generada: ${result.coverUrl.substring(0, 80)}...`);
    
    return result;
  } catch (error) {
    logger.error('❌ Error generando imágenes del artista:', error);
    throw error;
  }
}
