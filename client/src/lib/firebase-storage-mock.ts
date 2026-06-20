/**
 * Este archivo se mantiene para compatibilidad con código existente.
 * La funcionalidad principal ha sido centralizada en otros módulos.
 * 
 * Usamos re-exportación para mantener compatibilidad hacia atrás
 * mientras se consolida la arquitectura del código.
 */

// Re-exportamos todos los tipos y funciones desde sus ubicaciones actuales
export { getMockVoiceData } from './mock-voice-data';

export { 
  uploadAudioFile,
  saveVoiceConversion, 
  updateVoiceConversion,
  getUserVoiceConversions,
  getMockVoiceConversions,
  deleteStorageFile,
  downloadFileFromStorage,
  getOrCreateUserDocument
} from './firebase-storage';

// Re-exportamos todos los tipos desde el archivo centralizado de tipos
export { 
  VoiceSettings, 
  VoiceConversionRecord, 
  VoiceModel,
  VoiceConversion, 
  ConversionStatus,
  MockVoiceData
} from "../lib/types/audio-types";