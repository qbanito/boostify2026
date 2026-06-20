/**
 * 🎬 Promo Audio Mixer
 * 
 * Combines HeyGen video (with artist speaking) + song audio clip
 * Creates immersive promo videos with dual audio streams
 * 
 * Uses FFmpeg for audio/video mixing
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { storage } from '../firebase';

const execFileAsync = promisify(execFile);

async function uploadLocalFileToFirebase(filePath: string, folder: string, filename: string): Promise<string> {
  const bucket = storage.bucket();
  const destination = `${folder}/${filename}`;
  await bucket.upload(filePath, {
    destination,
    metadata: { contentType: 'video/mp4' },
  });
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
    bucket.name,
  )}/o/${encodeURIComponent(destination)}?alt=media`;
}

export interface AudioMixConfig {
  videoUrl: string;            // HeyGen video (9:16, 15-30s)
  audioUrl: string;            // Song audio clip
  mixLevel: number;            // 0-100: balance (50 = equal)
  fadeInDuration: number;      // Seconds to fade in song
  fadeOutDuration: number;     // Seconds to fade out song
  outputFormat: 'mp4' | 'webm';
}

export interface MixedVideoResult {
  videoUrl: string;
  durationSeconds: number;
  format: string;
  sizeBytes: number;
  audioMixInfo: {
    videoAudio: string;        // "Original HeyGen audio"
    songAudio: string;         // "Song clip [mm:ss - mm:ss]"
    mixRatio: string;          // "70% video, 30% song"
  };
}

/**
 * Download file from URL to temporary location
 */
async function downloadFile(url: string, tempPath: string): Promise<void> {
  const response = await axios.get(url, { responseType: 'stream' });
  const writer = fs.createWriteStream(tempPath);

  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/**
 * Mix video + audio using FFmpeg
 * 
 * FFmpeg command structure:
 * ffmpeg \
 *   -i video.mp4 (video input)
 *   -i audio.mp3 (audio input)
 *   -filter_complex "[1:a]volume=0.3,afade=t=in:st=0:d=2,afade=t=out:st=8:d=2[aud];[0:a]volume=0.7[vid];[vid][aud]amix=inputs=2" \
 *   -c:v libx264 (video codec)
 *   -c:a aac (audio codec)
 *   output.mp4
 */
async function mixAudioWithFFmpeg(args: {
  videoPath: string;
  audioPath: string;
  outputPath: string;
  config: AudioMixConfig;
}): Promise<void> {
  // Calculate audio levels (0-1 scale)
  const videoLevel = (100 - args.config.mixLevel) / 100;
  const audioLevel = args.config.mixLevel / 100;

  // Build audio filter string
  // Format: apply fade in/out + volume to audio, mix both streams
  const audioFilterPart =
    `[1:a]` +
    `volume=${audioLevel}` + // Set song audio volume
    `,afade=t=in:st=0:d=${args.config.fadeInDuration}` + // Fade in
    `,afade=t=out:st=${Math.max(0, 20 - args.config.fadeOutDuration)}:d=${args.config.fadeOutDuration}` + // Fade out
    `[aud]`; // Label output

  const videoAudioPart = `[0:a]volume=${videoLevel}[vid]`; // Reduce HeyGen audio volume

  const mixPart = `[vid][aud]amix=inputs=2:duration=first[out]`; // Mix both audio streams

  const filterComplex = `${audioFilterPart};${videoAudioPart};${mixPart}`;

  logger.info('[AudioMixer] FFmpeg command', {
    videoPath: path.basename(args.videoPath),
    audioPath: path.basename(args.audioPath),
    filterComplex,
  });

  try {
    await execFileAsync('ffmpeg', [
      '-i', args.videoPath,
      '-i', args.audioPath,
      '-filter_complex', filterComplex,
      '-map', '0:v:0', // Video from first input
      '-map', '[out]', // Mixed audio
      '-c:v', args.config.outputFormat === 'webm' ? 'libvpx-vp9' : 'libx264',
      '-crf', '23', // Quality (0-51, lower = better)
      '-preset', 'medium', // Speed vs quality tradeoff
      '-c:a', 'aac', // Audio codec
      '-b:a', '128k', // Audio bitrate
      '-movflags', 'faststart', // Enable streaming
      args.outputPath,
    ]);

    logger.info('[AudioMixer] FFmpeg completed', { output: args.outputPath });
  } catch (err: any) {
    logger.error('[AudioMixer] FFmpeg failed', { err: err.message, stderr: err.stderr });
    throw new Error(`FFmpeg mixing failed: ${err.message}`);
  }
}

/**
 * Mix HeyGen video with song audio
 * Main orchestration function
 */
export async function mixVideoWithSongAudio(config: AudioMixConfig): Promise<MixedVideoResult> {
  const tempDir = path.join(process.cwd(), 'temp-audio-mix');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const videoPath = path.join(tempDir, 'video.mp4');
  const audioPath = path.join(tempDir, 'audio.mp3');
  const outputPath = path.join(tempDir, `mixed-${Date.now()}.mp4`);

  try {
    // Download files
    logger.info('[AudioMixer] downloading video and audio', {
      videoUrl: config.videoUrl.substring(0, 50),
      audioUrl: config.audioUrl.substring(0, 50),
    });

    await Promise.all([
      downloadFile(config.videoUrl, videoPath),
      downloadFile(config.audioUrl, audioPath),
    ]);

    // Get duration info from video
    const getVideoInfo = async () => {
      const { stdout } = await execFileAsync('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1:nokey=1',
        videoPath,
      ]);
      return parseFloat(stdout.trim());
    };

    const videoDuration = await getVideoInfo();

    // Mix audio
    logger.info('[AudioMixer] mixing audio with FFmpeg', {
      mixLevel: config.mixLevel,
      fadeIn: config.fadeInDuration,
      fadeOut: config.fadeOutDuration,
    });

    await mixAudioWithFFmpeg({
      videoPath,
      audioPath,
      outputPath,
      config,
    });

    // Get output file size
    const stats = fs.statSync(outputPath);
    const sizeBytes = stats.size;

    // Upload to Firebase
    logger.info('[AudioMixer] uploading to Firebase', { size: sizeBytes });
    const firebaseUrl = await uploadLocalFileToFirebase(
      outputPath,
      'promo-assets/audio-mixed',
      `mixed-${Date.now()}.mp4`,
    );

    // Cleanup
    fs.unlinkSync(videoPath);
    fs.unlinkSync(audioPath);
    fs.unlinkSync(outputPath);

    return {
      videoUrl: firebaseUrl,
      durationSeconds: Math.round(videoDuration),
      format: 'mp4',
      sizeBytes,
      audioMixInfo: {
        videoAudio: 'HeyGen spoken promo',
        songAudio: 'Song audio clip',
        mixRatio: `${100 - config.mixLevel}% video, ${config.mixLevel}% song`,
      },
    };
  } catch (err: any) {
    logger.error('[AudioMixer] failed', { err: err.message });
    
    // Cleanup on error
    [videoPath, audioPath, outputPath].forEach((p) => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    throw err;
  }
}

/**
 * Pre-set mixing profiles for different use cases
 */
export const MIXING_PROFILES = {
  // HeyGen voice prominent, song subtle background
  VOICE_FOCUSED: {
    mixLevel: 25, // 75% video, 25% song
    fadeInDuration: 2,
    fadeOutDuration: 1,
  },

  // Balanced mix of both
  BALANCED: {
    mixLevel: 50, // 50% video, 50% song
    fadeInDuration: 1.5,
    fadeOutDuration: 1.5,
  },

  // Song audio prominent, voice as accent
  MUSIC_FOCUSED: {
    mixLevel: 70, // 30% video, 70% song
    fadeInDuration: 1,
    fadeOutDuration: 2,
  },

  // Full song from start, voice underneath
  FULL_SONG: {
    mixLevel: 80, // 20% video, 80% song
    fadeInDuration: 0.5,
    fadeOutDuration: 0.5,
  },
};
