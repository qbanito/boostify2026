import { logger } from "../logger";
/**
 * Audio Segmentation Service
 * Corta audio en segmentos específicos basados en timestamps del guión
 * Usa Web Audio API para precisión perfecta
 */

export interface AudioSegment {
  startTime: number;
  endTime: number;
  duration: number;
  blob: Blob;
  url: string;
}

/**
 * Corta un audio en un segmento específico
 * @param audioBuffer - AudioBuffer del audio completo
 * @param startTime - Tiempo de inicio en segundos
 * @param endTime - Tiempo de fin en segundos
 * @param audioContext - AudioContext (opcional, se crea uno si no se provee)
 * @returns Objeto con el blob del audio cortado y su URL
 */
export async function cutAudioSegment(
  audioBuffer: AudioBuffer,
  startTime: number,
  endTime: number,
  audioContext?: AudioContext
): Promise<AudioSegment> {
  logger.info(`✂️ Cortando audio: ${startTime}s - ${endTime}s`);
  
  const ctx = audioContext || new AudioContext();
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  
  // Calcular frames
  const startFrame = Math.floor(startTime * sampleRate);
  const endFrame = Math.floor(endTime * sampleRate);
  const frameCount = endFrame - startFrame;
  
  // Crear nuevo buffer para el segmento
  const segmentBuffer = ctx.createBuffer(
    numberOfChannels,
    frameCount,
    sampleRate
  );
  
  // Copiar datos de cada canal
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const segmentData = segmentBuffer.getChannelData(channel);
    
    for (let i = 0; i < frameCount; i++) {
      segmentData[i] = originalData[startFrame + i];
    }
  }
  
  // Convertir buffer a WAV blob
  const blob = await audioBufferToWav(segmentBuffer);
  const url = URL.createObjectURL(blob);
  
  logger.info(`✅ Segmento creado: ${(blob.size / 1024).toFixed(2)}KB`);
  
  return {
    startTime,
    endTime,
    duration: endTime - startTime,
    blob,
    url
  };
}

/**
 * Corta múltiples segmentos de audio en batch
 * Útil para procesar todas las escenas de performance de una vez
 */
export async function cutAudioSegments(
  audioBuffer: AudioBuffer,
  segments: Array<{ startTime: number; endTime: number; id: string }>
): Promise<Map<string, AudioSegment>> {
  logger.info(`📦 Cortando ${segments.length} segmentos de audio...`);
  
  const ctx = new AudioContext();
  const results = new Map<string, AudioSegment>();
  
  for (const segment of segments) {
    try {
      const audioSegment = await cutAudioSegment(
        audioBuffer,
        segment.startTime,
        segment.endTime,
        ctx
      );
      
      results.set(segment.id, audioSegment);
      logger.info(`✅ Segmento ${segment.id} procesado`);
    } catch (error) {
      logger.error(`❌ Error cortando segmento ${segment.id}:`, error);
    }
  }
  
  logger.info(`🎉 ${results.size}/${segments.length} segmentos cortados exitosamente`);
  
  return results;
}

/**
 * Convierte un AudioBuffer a formato WAV
 * Compatible con todas las APIs de generación de video
 */
async function audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  
  const data = interleave(buffer);
  const dataLength = data.length * bytesPerSample;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // WAV Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Write PCM samples
  floatTo16BitPCM(view, 44, data);
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Entrelaza múltiples canales de audio
 */
function interleave(buffer: AudioBuffer): Float32Array {
  const numberOfChannels = buffer.numberOfChannels;
  const length = buffer.length * numberOfChannels;
  const result = new Float32Array(length);
  
  let index = 0;
  const inputL = buffer.getChannelData(0);
  const inputR = numberOfChannels > 1 ? buffer.getChannelData(1) : inputL;
  
  for (let i = 0; i < buffer.length; i++) {
    result[index++] = inputL[i];
    if (numberOfChannels > 1) {
      result[index++] = inputR[i];
    }
  }
  
  return result;
}

/**
 * Escribe string en DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Convierte float a 16-bit PCM
 */
function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array): void {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

/**
 * Carga un archivo de audio y devuelve su AudioBuffer
 * Útil para procesar archivos antes de cortar
 */
export async function loadAudioFile(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new AudioContext();
  return await audioContext.decodeAudioData(arrayBuffer);
}
