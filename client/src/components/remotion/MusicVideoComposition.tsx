/**
 * Re-export de MusicVideoComposition para uso dentro del proyecto cliente.
 * La composición principal vive en /remotion/Composition.tsx y se usa 
 * tanto aquí (Player preview) como en Remotion Studio/CLI (render).
 */
export { MusicVideoComposition } from '../../../../remotion/Composition';
export type { MusicVideoProps, RemotionClip } from '../../../../remotion/Composition';
