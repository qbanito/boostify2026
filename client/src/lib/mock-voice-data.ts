/**
 * Este archivo proporciona datos simulados para la funcionalidad
 * de conversión de voz, útil para desarrollo y demostración.
 */

import { Timestamp } from "firebase/firestore";
import type { VoiceConversionRecord, VoiceSettings } from "./types/audio-types";

/**
 * Genera datos simulados para conversiones de voz
 */
export function getMockVoiceData(): VoiceConversionRecord[] {
  // URLs reales para la demostración
  const demoUrls = {
    original1: "https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Foriginal_voice_sample.mp3?alt=media&token=12345678-abcd-efgh-ijkl-mnopqrstuvwx",
    result1: "https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Fmastered_audio_sample.mp3?alt=media&token=93a82642-59e3-406c-a7b6-8d4cc3b5c6a8",
    result2: "https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Fvoice_conversion_sample.mp3?alt=media&token=1be2a3c4-5d6e-7f8g-9h0i-jk1l2m3n4o5p"
  };

  // Timestamp para crear datos con fechas coherentes
  const now = Timestamp.now();
  const hourAgo = Timestamp.fromMillis(now.toMillis() - 3600000);
  const twoHoursAgo = Timestamp.fromMillis(now.toMillis() - 7200000);
  const halfHourAgo = Timestamp.fromMillis(now.toMillis() - 1800000);

  // Generar datos de conversión simulados
  return [
    {
      id: "conv-001",
      userId: "demo-user",
      fileName: "Vocal_Demo_01.wav",
      modelId: 2,
      modelName: "Female Warm Pop",
      originalFileUrl: demoUrls.original1,
      resultFileUrl: demoUrls.result1,
      createdAt: twoHoursAgo,
      completedAt: Timestamp.fromMillis(twoHoursAgo.toMillis() + 300000),
      status: "completed",
      progress: 100,
      duration: "3:45",
      settings: {
        conversionStrength: 0.75,
        modelVolumeMix: 0.6,
        pitchShift: 0,
        usePreprocessing: true,
        usePostprocessing: true
      }
    },
    {
      id: "conv-002",
      userId: "demo-user",
      fileName: "Rock_Vocal_Mix.wav",
      modelId: 4,
      modelName: "Male Gritty Rock",
      originalFileUrl: demoUrls.original1,
      resultFileUrl: demoUrls.result2,
      createdAt: hourAgo,
      completedAt: Timestamp.fromMillis(hourAgo.toMillis() + 300000),
      status: "completed",
      progress: 100,
      duration: "2:58",
      settings: {
        conversionStrength: 0.8,
        modelVolumeMix: 0.7,
        pitchShift: -2,
        usePreprocessing: true,
        usePostprocessing: false
      }
    },
    {
      id: "conv-003",
      userId: "demo-user",
      fileName: "New_Song_Draft.mp3",
      modelId: 7,
      modelName: "Female Jazz",
      originalFileUrl: demoUrls.original1,
      resultFileUrl: null,
      createdAt: halfHourAgo,
      completedAt: null,
      status: "processing",
      progress: 65,
      duration: "4:12",
      settings: {
        conversionStrength: 0.65,
        modelVolumeMix: 0.5,
        pitchShift: 1,
        usePreprocessing: false,
        usePostprocessing: true
      }
    }
  ];
}