/**
 * WHISPER AGENT - Análisis de Audio y Generación de Historias
 * 
 * Funciones:
 * 1. Transcribe audio de canciones usando OpenAI Whisper
 * 2. Analiza letras para extraer temas y emociones
 * 3. Genera sugerencias de historias para videos musicales
 * 4. Proporciona contexto para colaboraciones basado en contenido lírico
 */

import { createTrackedOpenAI } from '../utils/tracked-openai';
import { db } from '../db';
import { songs, users, aiSocialPosts } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createRequire } from 'module';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PRIMARY_MODEL } from '../utils/ai-config';

const nodeRequire = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);

/**
 * Downloads the audio and transcodes it to a compact mono 16 kHz 64 kbps MP3 via
 * the bundled ffmpeg binary. A full song compresses to ~2-3 MB — far below
 * Whisper's 25 MB limit — so the OpenAI Whisper path works regardless of the
 * source file's size or format (wav/flac/long tracks). If ffmpeg fails, it
 * falls back to the raw downloaded file so transcription still proceeds.
 * Returns the temp file path plus a best-effort cleanup callback.
 */
async function downloadAndCompressForWhisper(
  audioUrl: string,
): Promise<{ filePath: string; cleanup: () => void }> {
  const response = await fetch(audioUrl);
  if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
  const inputBuffer = Buffer.from(await response.arrayBuffer());

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const rawPath = path.join(os.tmpdir(), `whisper-src-${stamp}`);
  const outPath = path.join(os.tmpdir(), `whisper-${stamp}.mp3`);
  fs.writeFileSync(rawPath, inputBuffer);

  try {
    const ffmpegPath = nodeRequire('@ffmpeg-installer/ffmpeg').path as string;
    await execFileAsync(
      ffmpegPath,
      ['-y', '-i', rawPath, '-ac', '1', '-ar', '16000', '-b:a', '64k', '-map', 'a', outPath],
      { timeout: 180_000, maxBuffer: 1024 * 1024 * 64 },
    );
    try { fs.unlinkSync(rawPath); } catch { /* best-effort */ }
    return {
      filePath: outPath,
      cleanup: () => { try { fs.unlinkSync(outPath); } catch { /* best-effort */ } },
    };
  } catch (err) {
    // ffmpeg unavailable / failed → fall back to the raw file (Whisper accepts
    // common audio formats directly; only the 25 MB cap may bite very large files).
    console.warn('⚠️ [WhisperAgent] ffmpeg transcode failed, using raw audio:', (err as Error).message);
    return {
      filePath: rawPath,
      cleanup: () => { try { fs.unlinkSync(rawPath); } catch { /* best-effort */ } },
    };
  }
}

// OpenAI Client
const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const llm = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.8,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// TYPES
// ============================================

interface LyricsAnalysis {
  themes: string[];
  emotions: string[];
  story: string;
  visualConcepts: string[];
  mood: 'upbeat' | 'melancholic' | 'aggressive' | 'romantic' | 'introspective' | 'triumphant';
  suggestedColors: string[];
  characters: string[];
  settings: string[];
}

interface VideoStory {
  title: string;
  logline: string; // One sentence summary
  synopsis: string; // 2-3 paragraphs
  scenes: VideoScene[];
  visualStyle: string;
  colorPalette: string[];
  moodBoard: string[];
  estimatedDuration: string;
}

interface VideoScene {
  sceneNumber: number;
  timestamp: string; // "0:00 - 0:30"
  description: string;
  cameraMovement: string;
  lighting: string;
  action: string;
}

interface TranscriptionResult {
  text: string;
  language: string;
  duration?: number;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

export interface WordTranscriptionResult {
  text: string;
  language: string;
  duration?: number;
  segments: Array<{
    start: number;
    end: number;
    text: string;
    words?: Array<{ word: string; start: number; end: number }>;
  }>;
  words: Array<{ word: string; start: number; end: number }>;
}

// ============================================
// AUDIO TRANSCRIPTION (Whisper)
// ============================================

/**
 * Transcribe audio file using OpenAI Whisper
 */
export async function transcribeAudio(audioPath: string): Promise<TranscriptionResult | null> {
  console.log(`🎙️ [WhisperAgent] Transcribing: ${audioPath}`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      console.error(`❌ [WhisperAgent] File not found: ${audioPath}`);
      return null;
    }
    
    const audioFile = fs.createReadStream(audioPath);
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });
    
    console.log(`✅ [WhisperAgent] Transcription complete: ${transcription.text.substring(0, 100)}...`);
    
    return {
      text: transcription.text,
      language: transcription.language || 'en',
      duration: transcription.duration,
      segments: transcription.segments?.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text
      }))
    };
    
  } catch (error) {
    console.error('❌ [WhisperAgent] Transcription error:', error);
    return null;
  }
}

/**
 * Transcribe audio from URL (downloads first)
 */
export async function transcribeFromUrl(audioUrl: string): Promise<TranscriptionResult | null> {
  console.log(`🎙️ [WhisperAgent] Fetching audio from URL: ${audioUrl}`);
  
  try {
    // Download audio file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Save temporarily
    const tempPath = path.join(process.cwd(), 'uploads', `temp_${Date.now()}.mp3`);
    fs.writeFileSync(tempPath, buffer);
    
    // Transcribe
    const result = await transcribeAudio(tempPath);
    
    // Clean up
    fs.unlinkSync(tempPath);
    
    return result;
    
  } catch (error) {
    console.error('❌ [WhisperAgent] URL transcription error:', error);
    return null;
  }
}

/**
 * Transcribe audio from URL with word-level timestamps (for Lyrics Video / Karaoke)
 * Uses Whisper verbose_json with timestamp_granularities: ['word', 'segment']
 */
export async function transcribeWithWords(audioUrl: string): Promise<WordTranscriptionResult | null> {
  console.log(`🎙️ [WhisperAgent] Word-level transcription from URL: ${audioUrl}`);
  try {
    // Transcode to a compact mono 16 kHz MP3 first so long/large songs stay
    // under Whisper's 25 MB limit and upload/transcription is faster.
    const { filePath: tempPath, cleanup } = await downloadAndCompressForWhisper(audioUrl);

    try {
      const audioFile = fs.createReadStream(tempPath);
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      });

      // Map words flat array
      const rawWords: Array<{ word: string; start: number; end: number }> =
        (transcription as any).words?.map((w: any) => ({
          word: w.word,
          start: w.start,
          end: w.end,
        })) ?? [];

      // Attach words to their segments by overlap
      const enrichedSegments = (transcription.segments ?? []).map((seg: any) => {
        const segWords = rawWords.filter(w => w.start >= seg.start - 0.05 && w.end <= seg.end + 0.05);
        return {
          start: seg.start as number,
          end: seg.end as number,
          text: seg.text as string,
          words: segWords.length > 0 ? segWords : undefined,
        };
      });

      return {
        text: transcription.text,
        language: transcription.language || 'en',
        duration: transcription.duration,
        segments: enrichedSegments,
        words: rawWords,
      };
    } finally {
      cleanup();
    }
  } catch (error) {
    console.error('❌ [WhisperAgent] Word transcription error:', error);
    return null;
  }
}

// ============================================
// LYRICS ANALYSIS
// ============================================

/**
 * Analyze lyrics to extract themes, emotions, and visual concepts
 */
export async function analyzeLyrics(lyrics: string, songTitle: string, artistName: string): Promise<LyricsAnalysis | null> {
  console.log(`📝 [WhisperAgent] Analyzing lyrics for: "${songTitle}" by ${artistName}`);
  
  try {
    const response = await llm.invoke([
      new SystemMessage(`You are a music video director and lyricist with deep understanding of storytelling through music.
      
Analyze the lyrics and return a JSON object with:
- themes: array of 3-5 main themes (love, loss, success, struggle, etc.)
- emotions: array of 3-5 emotions conveyed
- story: 2-3 sentences summarizing the narrative arc
- visualConcepts: array of 4-6 visual ideas that would complement the lyrics
- mood: one of "upbeat", "melancholic", "aggressive", "romantic", "introspective", "triumphant"
- suggestedColors: array of 3-4 colors that match the mood
- characters: array of 2-4 character types that could appear in a video
- settings: array of 2-4 location/setting ideas

Be creative and specific. Think like a director visualizing the music.`),
      new HumanMessage(`Song: "${songTitle}" by ${artistName}

Lyrics:
${lyrics}`)
    ]);
    
    const content = response.content as string;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]) as LyricsAnalysis;
      console.log(`✅ [WhisperAgent] Lyrics analysis complete. Themes: ${analysis.themes.join(', ')}`);
      return analysis;
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ [WhisperAgent] Lyrics analysis error:', error);
    return null;
  }
}

// ============================================
// VIDEO STORY GENERATION
// ============================================

/**
 * Generate a complete music video story/treatment from lyrics
 */
export async function generateVideoStory(
  lyrics: string, 
  songTitle: string, 
  artistName: string,
  artistStyle?: string,
  songDuration?: number // in seconds
): Promise<VideoStory | null> {
  console.log(`🎬 [WhisperAgent] Generating video story for: "${songTitle}"`);
  
  // First analyze the lyrics
  const analysis = await analyzeLyrics(lyrics, songTitle, artistName);
  if (!analysis) {
    console.log('⚠️ [WhisperAgent] Could not analyze lyrics, using basic generation');
  }
  
  const duration = songDuration || 180; // Default 3 minutes
  const numScenes = Math.max(3, Math.min(8, Math.floor(duration / 30))); // 1 scene per 30 seconds
  
  try {
    const response = await llm.invoke([
      new SystemMessage(`You are an award-winning music video director known for creating visually stunning, emotionally resonant videos.

Based on the song analysis, create a complete video treatment/story with:
1. A compelling title for the video concept
2. A logline (one powerful sentence)
3. A synopsis (2-3 paragraphs telling the video's story)
4. ${numScenes} scenes with specific details
5. Visual style description
6. Color palette (4-5 colors as hex codes)
7. Mood board description (5-6 visual references)

For each scene include:
- Scene number
- Timestamp (e.g., "0:00 - 0:30")
- Visual description
- Camera movement
- Lighting style
- Action/what happens

Be creative, cinematic, and specific. Think like you're pitching to a major label.

Return as JSON with this structure:
{
  "title": "string",
  "logline": "string",
  "synopsis": "string",
  "scenes": [{ "sceneNumber": 1, "timestamp": "0:00 - 0:30", "description": "...", "cameraMovement": "...", "lighting": "...", "action": "..." }],
  "visualStyle": "string",
  "colorPalette": ["#hex1", "#hex2"],
  "moodBoard": ["reference1", "reference2"],
  "estimatedDuration": "${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}"
}`),
      new HumanMessage(`Song: "${songTitle}" by ${artistName}
Artist Style: ${artistStyle || 'Contemporary music artist'}
Song Duration: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}

Lyrics:
${lyrics}

${analysis ? `
Lyrics Analysis:
- Themes: ${analysis.themes.join(', ')}
- Emotions: ${analysis.emotions.join(', ')}
- Story Arc: ${analysis.story}
- Mood: ${analysis.mood}
- Suggested Settings: ${analysis.settings.join(', ')}
- Suggested Characters: ${analysis.characters.join(', ')}
` : ''}`)
    ]);
    
    const content = response.content as string;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const story = JSON.parse(jsonMatch[0]) as VideoStory;
      console.log(`✅ [WhisperAgent] Video story generated: "${story.title}"`);
      return story;
    }
    
    return null;
    
  } catch (error) {
    console.error('❌ [WhisperAgent] Video story generation error:', error);
    return null;
  }
}

// ============================================
// SONG DATABASE INTEGRATION
// ============================================

/**
 * Generate video story for a song in the database
 */
export async function generateVideoStoryForSong(songId: number): Promise<VideoStory | null> {
  console.log(`🎬 [WhisperAgent] Generating story for song ID: ${songId}`);
  
  try {
    // Get song from database
    const [song] = await db
      .select({
        id: songs.id,
        title: songs.title,
        lyrics: songs.lyrics,
        audioUrl: songs.audioUrl,
        duration: songs.duration,
        artistId: songs.artistId,
        genre: songs.genre
      })
      .from(songs)
      .where(eq(songs.id, songId))
      .limit(1);
    
    if (!song) {
      console.error(`❌ [WhisperAgent] Song not found: ${songId}`);
      return null;
    }
    
    // Get artist info
    const [artist] = await db
      .select({
        id: users.id,
        artistName: users.artistName,
        genre: users.genre,
        bio: users.bio
      })
      .from(users)
      .where(eq(users.id, song.artistId))
      .limit(1);
    
    let lyrics = song.lyrics;
    
    // If no lyrics, try to transcribe from audio
    if (!lyrics && song.audioUrl) {
      console.log('📝 [WhisperAgent] No lyrics found, attempting transcription...');
      const transcription = await transcribeFromUrl(song.audioUrl);
      if (transcription) {
        lyrics = transcription.text;
        
        // Optionally save transcribed lyrics back to database
        // await db.update(songs).set({ lyrics }).where(eq(songs.id, songId));
      }
    }
    
    if (!lyrics) {
      console.error(`❌ [WhisperAgent] No lyrics available for song: ${songId}`);
      return null;
    }
    
    // Generate video story
    return await generateVideoStory(
      lyrics,
      song.title,
      artist?.artistName || 'Unknown Artist',
      `${song.genre || 'Music'} artist - ${artist?.bio?.substring(0, 100) || 'Contemporary artist'}`,
      song.duration
    );
    
  } catch (error) {
    console.error('❌ [WhisperAgent] Error generating story for song:', error);
    return null;
  }
}

// ============================================
// AI ARTIST VIDEO STORY POSTS
// ============================================

/**
 * AI Artist posts about their upcoming video concept
 */
export async function postVideoConceptTeaser(artistId: number, videoStory: VideoStory, songTitle: string): Promise<boolean> {
  try {
    const teaserContent = `🎬 Excited to share a glimpse of my vision for the "${songTitle}" video!

Concept: "${videoStory.title}"
${videoStory.logline}

The visual style I'm going for: ${videoStory.visualStyle.substring(0, 150)}...

Can't wait to bring this to life! 🎥✨

#MusicVideo #ComingSoon #BehindTheScenes`;

    await db.insert(aiSocialPosts).values({
      artistId,
      contentType: 'text',
      content: teaserContent,
      hashtags: ['MusicVideo', 'ComingSoon', 'BehindTheScenes'],
      mood: 'excited',
      context: {
        type: 'video_concept_teaser',
        videoTitle: videoStory.title,
        songTitle
      },
      engagement: { likes: 0, comments: 0, shares: 0 },
      createdAt: new Date()
    });
    
    console.log(`📝 [WhisperAgent] ${songTitle} video concept teaser posted!`);
    return true;
    
  } catch (error) {
    console.error('❌ [WhisperAgent] Error posting video teaser:', error);
    return false;
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  LyricsAnalysis,
  VideoStory,
  VideoScene,
  TranscriptionResult
};
