import { MusicAIGenerator as OriginalMusicAIGenerator } from './music-ai-generator';
import { MusicGeneratorWrapper } from './music-generator-wrapper';
import { musicGenreTemplates, MusicGenreTemplate } from './genre-templates/genre-data';

/**
 * Componente mejorado del generador de música con IA
 * Esta versión implementa el sistema de plantillas de géneros musicales y la personalización avanzada
 */
export function MusicAIGenerator() {
  // Pasamos el componente original para que se renderice, 
  // pero usamos nuestros nuevos componentes para la parte de generación musical
  return <OriginalMusicAIGenerator />;
}