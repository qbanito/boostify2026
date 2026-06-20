/**
 * Audio Waveform Peak Extraction
 * Decodes audio files and produces normalized amplitude peaks for visualization.
 * BOOSTIFY 2025
 */

import { getProxiedUrl } from './firebase-proxy';

// Cache of already-decoded waveform peaks (by URL)
const waveformCache = new Map<string, number[]>();

/**
 * Extract normalized waveform peaks (0-1) from an audio URL.
 * Uses Web Audio API to decode, then downsamples to `numPeaks` points.
 * Results are cached in-memory so repeated calls are instant.
 */
export async function extractWaveformPeaks(
  audioUrl: string,
  numPeaks: number = 200
): Promise<number[]> {
  // Check cache first
  const cacheKey = `${audioUrl}::${numPeaks}`;
  if (waveformCache.has(cacheKey)) {
    return waveformCache.get(cacheKey)!;
  }

  try {
    // Proxy Firebase Storage URLs to avoid CORS issues
    const fetchUrl = getProxiedUrl(audioUrl);
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();

    // Decode audio data
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Use the first channel (mono or left channel)
    const channelData = audioBuffer.getChannelData(0);
    const totalSamples = channelData.length;
    const samplesPerPeak = Math.floor(totalSamples / numPeaks);
    
    if (samplesPerPeak < 1) {
      // Audio shorter than numPeaks — just return raw absolute values
      const peaks = Array.from(channelData).map(s => Math.abs(s));
      waveformCache.set(cacheKey, peaks);
      await audioContext.close();
      return peaks;
    }

    const peaks: number[] = [];
    
    for (let i = 0; i < numPeaks; i++) {
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, totalSamples);
      
      // RMS (root mean square) gives a more musically accurate amplitude
      let sumSquares = 0;
      for (let j = start; j < end; j++) {
        sumSquares += channelData[j] * channelData[j];
      }
      const rms = Math.sqrt(sumSquares / (end - start));
      peaks.push(rms);
    }

    // Normalize peaks to 0-1 range
    const maxPeak = Math.max(...peaks, 0.001); // avoid div by 0
    const normalized = peaks.map(p => p / maxPeak);

    waveformCache.set(cacheKey, normalized);
    await audioContext.close();
    return normalized;
  } catch (err) {
    console.warn('🔊 [Waveform] Failed to extract peaks:', err);
    // Return deterministic fallback
    return Array.from({ length: numPeaks }, (_, i) => {
      const pseudo = Math.abs(Math.sin(i * 12.9898 + 0.5) * 43758.5453) % 1;
      return 0.2 + pseudo * 0.6;
    });
  }
}

/**
 * Clear the waveform cache for a specific URL or all.
 */
export function clearWaveformCache(url?: string): void {
  if (url) {
    for (const key of waveformCache.keys()) {
      if (key.startsWith(url)) waveformCache.delete(key);
    }
  } else {
    waveformCache.clear();
  }
}
