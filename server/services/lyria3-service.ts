/**
 * ============================================================
 * LYRIA 3 MUSIC GENERATION SERVICE
 * ============================================================
 * Google DeepMind's most advanced music generation model
 * Uses Gemini API with lyria-3-pro-preview & lyria-3-clip-preview
 * 
 * Models:
 *   - lyria-3-pro-preview: Full-length songs (up to 3 min) with vocals, lyrics, structure
 *   - lyria-3-clip-preview: 30-second clips for quick previews
 * 
 * Features:
 *   - 44.1 kHz stereo, high-fidelity audio
 *   - Natural vocals with custom lyrics
 *   - BPM, key signature, timestamp & structure control
 *   - Multi-language vocal generation
 *   - Image-to-music composition
 *   - MP3 or WAV output
 */

import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import { log } from "../vite";

// Use real Google API keys for Lyria 3 (not Replit proxy)
const LYRIA_API_KEY = process.env.GOOGLE_API_KEY2 || process.env.GOOGLE_API_KEY3 || process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY || "";

const lyria3Client = new GoogleGenAI({
  apiKey: LYRIA_API_KEY,
});

// ============================================================
// INTERFACES
// ============================================================

export interface Lyria3CompositionParams {
  /** Musical genre (e.g., "pop", "hip-hop", "electronic") */
  genre?: string;
  /** BPM / tempo (e.g., 120, 85, 140) */
  bpm?: number;
  /** Musical key (e.g., "C Major", "D minor", "G# minor") */
  key?: string;
  /** Mood descriptors (e.g., "energetic", "melancholic", "dreamy") */
  mood?: string;
  /** Specific instruments to include */
  instruments?: string[];
  /** Song structure with section tags [Verse], [Chorus], [Bridge] */
  structure?: string;
  /** Timestamp-based structure control */
  timestamps?: Lyria3TimestampSection[];
  /** Custom lyrics with section tags */
  customLyrics?: string;
  /** Whether to generate instrumental only (no vocals) */
  instrumental?: boolean;
  /** Target language for vocals */
  language?: string;
  /** Artist vocal style description */
  vocalStyle?: string;
  /** Duration hint (for Pro model) */
  durationHint?: string;
  /** Output format */
  outputFormat?: "mp3" | "wav";
  /** Use clip model (30s) instead of pro (full length) */
  useClipModel?: boolean;
  /** Artist gender for vocal generation */
  artistGender?: "male" | "female";
  /** Production style descriptors */
  productionStyle?: string;
  /** Dynamic range descriptor */
  dynamics?: string;
}

export interface Lyria3TimestampSection {
  /** Start time (e.g., "0:00") */
  start: string;
  /** End time (e.g., "0:30") */
  end: string;
  /** Description of what happens in this section */
  description: string;
}

export interface Lyria3Result {
  success: boolean;
  audioUrl?: string;
  audioBase64?: string;
  lyrics?: string;
  duration?: number;
  error?: string;
  provider: "lyria-3-pro" | "lyria-3-clip";
  format?: "mp3" | "wav";
}

// ============================================================
// FIREBASE STORAGE UPLOAD HELPER
// ============================================================

let storage: any = null;
try {
  const admin = require("firebase-admin");
  if (admin.apps.length > 0) {
    storage = admin.storage();
  }
} catch (e) {
  // Firebase not initialized
}

async function uploadAudioToStorage(
  audioData: Buffer,
  mimeType: string = "audio/mpeg",
  folder: string = "lyria3-music"
): Promise<string> {
  try {
    if (!storage) {
      log("[Lyria3] Firebase Storage not available, saving locally", "lyria3");
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");
      const ext = mimeType.includes("wav") ? "wav" : "mp3";
      const fileName = `lyria3_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = path.join(os.tmpdir(), fileName);
      fs.writeFileSync(filePath, audioData);
      return filePath;
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const ext = mimeType.includes("wav") ? "wav" : "mp3";
    const fileName = `${folder}/${timestamp}_${randomId}.${ext}`;

    const bucket = storage.bucket();
    const file = bucket.file(fileName);

    await file.save(audioData, {
      metadata: { contentType: mimeType },
      validation: false,
    });

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;

    log(`[Lyria3] Audio uploaded to Storage: ${publicUrl}`, "lyria3");
    return publicUrl;
  } catch (error: any) {
    log(`[Lyria3] Error uploading to Storage: ${error.message}`, "lyria3");
    throw error;
  }
}

// ============================================================
// PROMPT BUILDER
// ============================================================

function buildLyria3Prompt(
  basePrompt: string,
  params: Lyria3CompositionParams
): string {
  const parts: string[] = [];

  // Duration hint
  if (params.durationHint && !params.useClipModel) {
    parts.push(`Create a ${params.durationHint} song.`);
  }

  // Genre & mood
  if (params.genre || params.mood) {
    const genrePart = params.genre ? `${params.genre}` : "";
    const moodPart = params.mood ? `${params.mood}` : "";
    parts.push(`Genre: ${[genrePart, moodPart].filter(Boolean).join(", ")}.`);
  }

  // BPM
  if (params.bpm) {
    parts.push(`Tempo: ${params.bpm} BPM.`);
  }

  // Key signature
  if (params.key) {
    parts.push(`Key: ${params.key}.`);
  }

  // Instruments
  if (params.instruments && params.instruments.length > 0) {
    parts.push(`Instruments: ${params.instruments.join(", ")}.`);
  }

  // Vocal style
  if (params.vocalStyle) {
    parts.push(`Vocals: ${params.vocalStyle}.`);
  } else if (params.artistGender) {
    parts.push(`Vocals: ${params.artistGender === "female" ? "female" : "male"} vocals.`);
  }

  // Instrumental
  if (params.instrumental) {
    parts.push("Instrumental only, no vocals.");
  }

  // Production style
  if (params.productionStyle) {
    parts.push(`Production: ${params.productionStyle}.`);
  }

  // Dynamics
  if (params.dynamics) {
    parts.push(`Dynamics: ${params.dynamics}.`);
  }

  // Language
  if (params.language && params.language !== "en" && params.language !== "english") {
    parts.push(`Generate lyrics and vocals in ${params.language}.`);
  }

  // Main description
  parts.push(basePrompt);

  // Timestamp-based structure
  if (params.timestamps && params.timestamps.length > 0) {
    parts.push("\nSong structure:");
    for (const section of params.timestamps) {
      parts.push(`[${section.start} - ${section.end}] ${section.description}`);
    }
  }

  // Custom lyrics
  if (params.customLyrics) {
    parts.push(`\nLyrics:\n${params.customLyrics}`);
  }

  // Structure tags (if no timestamps and no custom lyrics)
  if (params.structure && !params.timestamps && !params.customLyrics) {
    parts.push(`\nStructure: ${params.structure}`);
  }

  return parts.join("\n");
}

// ============================================================
// MAIN GENERATION FUNCTION
// ============================================================

/**
 * Generate music using Google Lyria 3
 * @param prompt - Text description of the music to generate
 * @param params - Enhanced composition parameters
 * @returns Lyria3Result with audio URL, lyrics, etc.
 */
export async function generateMusicWithLyria3(
  prompt: string,
  params: Lyria3CompositionParams = {}
): Promise<Lyria3Result> {
  const model = params.useClipModel ? "lyria-3-clip-preview" : "lyria-3-pro-preview";
  const provider = params.useClipModel ? "lyria-3-clip" as const : "lyria-3-pro" as const;

  log(`[Lyria3] 🎵 Generating music with ${model}...`, "lyria3");
  log(`[Lyria3] Prompt: ${prompt.substring(0, 150)}...`, "lyria3");

  if (!LYRIA_API_KEY || LYRIA_API_KEY === "_DUMMY_API_KEY_") {
    return {
      success: false,
      error: "Google API key not configured for Lyria 3. Set GOOGLE_API_KEY2 or GEMINI_API_KEY.",
      provider,
    };
  }

  try {
    // Build the full prompt with composition parameters
    const fullPrompt = buildLyria3Prompt(prompt, params);
    log(`[Lyria3] Full prompt (${fullPrompt.length} chars): ${fullPrompt.substring(0, 300)}...`, "lyria3");

    // Configure generation
    const config: any = {
      responseModalities: ["AUDIO", "TEXT"],
    };

    // Set output format for Pro model
    if (!params.useClipModel && params.outputFormat === "wav") {
      config.responseMimeType = "audio/wav";
    }

    const response = await lyria3Client.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [{ text: fullPrompt }],
        },
      ],
      config,
    });

    // Parse response - extract audio and text parts
    let audioData: Buffer | null = null;
    let audioMimeType = "audio/mpeg";
    const lyricsText: string[] = [];

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.text) {
          lyricsText.push(part.text);
        } else if (part.inlineData) {
          audioData = Buffer.from(part.inlineData.data!, "base64");
          audioMimeType = part.inlineData.mimeType || "audio/mpeg";
        }
      }
    }

    if (!audioData) {
      log(`[Lyria3] ❌ No audio data in response`, "lyria3");
      return {
        success: false,
        error: "No audio generated in response. The prompt may have been filtered.",
        provider,
      };
    }

    log(`[Lyria3] ✅ Audio generated (${audioData.length} bytes, ${audioMimeType})`, "lyria3");
    if (lyricsText.length > 0) {
      log(`[Lyria3] 📝 Lyrics/structure: ${lyricsText.join("\n").substring(0, 200)}...`, "lyria3");
    }

    // Upload to Firebase Storage
    const audioUrl = await uploadAudioToStorage(audioData, audioMimeType, "lyria3-music");

    return {
      success: true,
      audioUrl,
      audioBase64: audioData.toString("base64"),
      lyrics: lyricsText.join("\n") || undefined,
      provider,
      format: audioMimeType.includes("wav") ? "wav" : "mp3",
    };
  } catch (error: any) {
    log(`[Lyria3] ❌ Error: ${error.message}`, "lyria3");
    
    // Check for specific error types
    if (error.message?.includes("SAFETY") || error.message?.includes("blocked")) {
      return {
        success: false,
        error: "Content was blocked by safety filters. Try adjusting your prompt.",
        provider,
      };
    }

    return {
      success: false,
      error: error.message || "Unknown error generating music with Lyria 3",
      provider,
    };
  }
}

// ============================================================
// ARTIST SONG GENERATION WITH LYRIA 3
// ============================================================

/**
 * Generate a song for an AI artist using Lyria 3 Pro
 * Enhanced version with full composition control
 */
export async function generateArtistSongWithLyria3(
  artistName: string,
  songTitle: string,
  genre: string,
  mood?: string,
  artistGender: "male" | "female" = "male",
  customLyrics?: string,
  artistBio?: string,
  artistDNA?: {
    biography?: string;
    musicGenres?: string[];
    moodVibe?: string;
    lookDescription?: string;
    influences?: string[];
    vocalStyle?: string;
    productionStyle?: string;
    signatureSound?: string;
    moodKeywords?: string[];
    lyricThemes?: string[];
  }
): Promise<Lyria3Result> {
  log(`[Lyria3] 🎵 HIT MACHINE: Generating "${songTitle}" for ${artistName} (${genre}) - Voice: ${artistGender}`, "lyria3");

  // Genre-specific production profiles for Lyria 3
  const GENRE_PROFILES: Record<string, {
    bpm: number;
    key: string;
    instruments: string[];
    production: string;
    dynamics: string;
    vocalMale: string;
    vocalFemale: string;
    durationHint: string;
  }> = {
    "pop": {
      bpm: 120, key: "G Major", instruments: ["acoustic guitar", "synth pads", "drums", "bass"],
      production: "polished modern pop production, bright mix, radio-ready mastering",
      dynamics: "builds from verse to explosive chorus",
      vocalMale: "clear powerful male tenor, smooth falsetto, emotional delivery with modern pop style",
      vocalFemale: "bright powerful female vocals, crystal clear high notes, expressive pop delivery",
      durationHint: "2 minutes"
    },
    "hip-hop": {
      bpm: 90, key: "D minor", instruments: ["808 bass", "hi-hats", "snare", "synth pads", "piano"],
      production: "hard-hitting hip-hop production, punchy kicks, crisp hi-hats, deep 808s",
      dynamics: "consistent energy with beat switches between verse and hook",
      vocalMale: "confident male rapper, melodic delivery with hard-hitting bars",
      vocalFemale: "fierce female rapper, powerful flow, commanding presence",
      durationHint: "2 minutes"
    },
    "rap": {
      bpm: 140, key: "E minor", instruments: ["TR-808 drum machine", "dark synths", "bass", "hi-hats"],
      production: "aggressive trap production, heavy 808 bass, rapid hi-hats, dark atmosphere",
      dynamics: "intense energy throughout, explosive ad-libs",
      vocalMale: "aggressive male rapper, rapid-fire flow, powerful delivery",
      vocalFemale: "fierce female MC, switching flows, bold delivery",
      durationHint: "2 minutes"
    },
    "electronic": {
      bpm: 128, key: "A minor", instruments: ["synthesizers", "arpeggiators", "electronic drums", "bass synth"],
      production: "modern electronic production, wide stereo, massive drops, euphoric builds",
      dynamics: "builds tension with breakdowns leading to explosive drops",
      vocalMale: "ethereal processed male vocals, vocoder harmonies",
      vocalFemale: "angelic female vocals, soaring high notes, euphoric delivery",
      durationHint: "2 minutes 30 seconds"
    },
    "rock": {
      bpm: 130, key: "E Major", instruments: ["electric guitar", "bass guitar", "drums", "power chords"],
      production: "powerful rock production, crunchy guitars, driving rhythm section",
      dynamics: "quiet verse to loud chorus dynamic, explosive bridge",
      vocalMale: "powerful male rock vocals, raw emotional delivery, soaring melodies",
      vocalFemale: "fierce female rock vocals, powerful range, passionate delivery",
      durationHint: "2 minutes 30 seconds"
    },
    "r&b": {
      bpm: 85, key: "Bb Major", instruments: ["Rhodes piano", "smooth bass", "soft drums", "strings"],
      production: "silky smooth R&B production, warm mix, intimate feel",
      dynamics: "sensual groove with building emotional intensity",
      vocalMale: "smooth soulful male vocals, falsetto runs, romantic delivery",
      vocalFemale: "sultry female R&B vocals, melismatic runs, passionate",
      durationHint: "2 minutes"
    },
    "reggaeton": {
      bpm: 95, key: "C minor", instruments: ["dembow drums", "bass", "synth leads", "Latin percussion"],
      production: "modern reggaeton production, infectious dembow rhythm, club-ready mix",
      dynamics: "high energy throughout with catchy hook sections",
      vocalMale: "energetic male reggaeton vocals, catchy hooks, party energy",
      vocalFemale: "fierce female reggaeton vocals, powerful hooks, commanding",
      durationHint: "2 minutes"
    },
    "latin": {
      bpm: 100, key: "A minor", instruments: ["acoustic guitar", "congas", "timbales", "bass", "piano"],
      production: "vibrant Latin production, rich percussion, warm organic feel",
      dynamics: "passionate build with rhythmic intensity",
      vocalMale: "passionate male Latin vocals, rhythmic flow, charismatic",
      vocalFemale: "fiery female Latin vocals, passionate delivery",
      durationHint: "2 minutes"
    },
    "indie": {
      bpm: 110, key: "C Major", instruments: ["jangly guitar", "soft drums", "bass", "ambient synths"],
      production: "dreamy indie production, reverb-soaked guitars, atmospheric",
      dynamics: "gentle build with emotional peaks",
      vocalMale: "soft introspective male vocals, falsetto, vulnerable delivery",
      vocalFemale: "ethereal female vocals, delicate delivery, haunting beauty",
      durationHint: "2 minutes"
    },
    "jazz": {
      bpm: 110, key: "Db Major", instruments: ["piano", "upright bass", "drums with brushes", "saxophone"],
      production: "warm analog jazz recording, intimate room sound, live feel",
      dynamics: "subtle dynamic shifts, expressive improvisational feel",
      vocalMale: "smooth male jazz vocals, sophisticated phrasing, elegant",
      vocalFemale: "sultry female jazz vocals, intimate phrasing, smoky elegance",
      durationHint: "2 minutes"
    },
    "country": {
      bpm: 115, key: "G Major", instruments: ["acoustic guitar", "steel guitar", "fiddle", "bass", "drums"],
      production: "authentic country production, warm organic feel, Nashville style",
      dynamics: "storytelling build with emotional chorus",
      vocalMale: "authentic male country vocals, storytelling delivery, heartfelt",
      vocalFemale: "powerful female country vocals, emotional range, genuine",
      durationHint: "2 minutes"
    },
    "reggae": {
      bpm: 80, key: "G Major", instruments: ["rhythm guitar", "bass", "drums", "organ", "horn section"],
      production: "classic roots reggae production, offbeat rhythm, warm bass, dub echoes",
      dynamics: "laid-back groove with building intensity",
      vocalMale: "smooth Jamaican male vocals, roots reggae toasting, laid-back",
      vocalFemale: "warm female reggae vocals, melodic island delivery, soulful",
      durationHint: "2 minutes"
    },
    "soul": {
      bpm: 90, key: "F Major", instruments: ["organ", "bass", "drums", "horns", "strings"],
      production: "vintage soul production, warm analog feel, Motown-inspired",
      dynamics: "emotional build from intimate verse to powerful chorus",
      vocalMale: "powerful male soul vocals, gospel-influenced runs, raw emotion",
      vocalFemale: "powerhouse female soul vocals, melismatic runs, emotional intensity",
      durationHint: "2 minutes"
    },
    "blues": {
      bpm: 75, key: "E minor", instruments: ["electric guitar", "harmonica", "bass", "drums", "piano"],
      production: "raw blues production, gritty guitar tone, authentic feel",
      dynamics: "slow burn build with emotional peaks",
      vocalMale: "gritty male blues vocals, raspy delivery, storytelling growl",
      vocalFemale: "powerful female blues vocals, raw emotional grit, soulful",
      durationHint: "2 minutes"
    },
    "gospel": {
      bpm: 100, key: "C Major", instruments: ["piano", "organ", "choir", "drums", "bass"],
      production: "uplifting gospel production, church ambiance, powerful choir",
      dynamics: "building from quiet prayer to explosive praise",
      vocalMale: "powerful male gospel vocals, praise shouts, soaring runs",
      vocalFemale: "soaring female gospel vocals, spirit-filled runs, powerful praise",
      durationHint: "2 minutes"
    },
    "afrobeat": {
      bpm: 105, key: "G minor", instruments: ["talking drum", "guitar", "bass", "horns", "percussion"],
      production: "modern Afrobeats production, infectious rhythm, bright mix",
      dynamics: "groovy energy with building intensity",
      vocalMale: "smooth male Afrobeats vocals, melodic flow, Wizkid-style",
      vocalFemale: "sweet female Afrobeats vocals, ethereal, Tems-style",
      durationHint: "2 minutes"
    },
    "trap": {
      bpm: 145, key: "D minor", instruments: ["808 bass", "sharp hi-hats", "snare", "dark synths"],
      production: "dark atmospheric trap production, heavy 808s, eerie pads, Atlanta style",
      dynamics: "menacing energy with explosive drops",
      vocalMale: "dark male trap vocals, aggressive ad-libs, autotune melodic",
      vocalFemale: "fierce female trap vocals, hard-hitting, confident",
      durationHint: "2 minutes"
    },
    "k-pop": {
      bpm: 125, key: "A Major", instruments: ["synths", "electronic drums", "bass", "strings", "brass"],
      production: "polished K-pop production, genre-blending, dynamic arrangement",
      dynamics: "rapid switches between rap, singing, and dance breaks",
      vocalMale: "crisp male K-pop vocals, precise pitch, rap-to-singing switches",
      vocalFemale: "sweet powerful female K-pop vocals, cute to fierce range",
      durationHint: "2 minutes"
    },
    "lo-fi": {
      bpm: 85, key: "F Major", instruments: ["Rhodes piano", "soft drums", "vinyl crackle", "bass"],
      production: "lo-fi hip hop production, warm tape saturation, dusty vinyl feel",
      dynamics: "mellow consistent groove, relaxing atmosphere",
      vocalMale: "soft whispered male vocals, intimate bedroom feel, gentle",
      vocalFemale: "soft breathy female vocals, intimate whisper, lo-fi warmth",
      durationHint: "1 minute 30 seconds"
    },
    "house": {
      bpm: 124, key: "C minor", instruments: ["four-on-the-floor kick", "hi-hats", "bass synth", "piano stabs"],
      production: "classic house production, driving rhythm, uplifting energy",
      dynamics: "building tension with breakdowns and drops",
      vocalMale: "soulful male house vocals, uplifting hooks, groovy",
      vocalFemale: "powerful female house diva vocals, soaring hooks, euphoric",
      durationHint: "2 minutes 30 seconds"
    },
    "disco": {
      bpm: 120, key: "G Major", instruments: ["funky guitar", "strings", "bass", "drums", "horns"],
      production: "groovy disco production, orchestral elements, dance floor energy",
      dynamics: "consistent party energy with dramatic breakdowns",
      vocalMale: "smooth funky male disco vocals, falsetto hooks, groovy",
      vocalFemale: "powerful female disco diva vocals, commanding, glamorous",
      durationHint: "2 minutes"
    },
    "funk": {
      bpm: 105, key: "E minor", instruments: ["slap bass", "wah guitar", "clavinet", "drums", "horns"],
      production: "tight funk production, deep pocket groove, punchy mix",
      dynamics: "rhythmic intensity with dynamic breaks",
      vocalMale: "groovy male funk vocals, rhythmic shouts, James Brown energy",
      vocalFemale: "fierce funky female vocals, rhythmic precision, sassy",
      durationHint: "2 minutes"
    },
    "metal": {
      bpm: 160, key: "D minor", instruments: ["distorted guitars", "double bass drums", "bass", "orchestral elements"],
      production: "powerful metal production, wall of sound, aggressive mix",
      dynamics: "relentless intensity with breakdowns and solos",
      vocalMale: "powerful male metal vocals, screaming to clean contrast",
      vocalFemale: "fierce female metal vocals, symphonic power, operatic range",
      durationHint: "2 minutes 30 seconds"
    },
    "punk": {
      bpm: 170, key: "A Major", instruments: ["distorted guitar", "bass", "fast drums"],
      production: "raw punk production, lo-fi energy, garage feel",
      dynamics: "relentless high energy from start to finish",
      vocalMale: "raw shouting male punk vocals, fast aggressive delivery",
      vocalFemale: "fierce female punk vocals, shouting energy, rebellious",
      durationHint: "1 minute 30 seconds"
    },
    "dancehall": {
      bpm: 100, key: "Bb minor", instruments: ["dancehall riddim", "bass", "synths", "percussion"],
      production: "energetic dancehall production, bouncy rhythm, party energy",
      dynamics: "high energy with rhythmic variations",
      vocalMale: "energetic male dancehall vocals, Jamaican patois, bouncy",
      vocalFemale: "fierce female dancehall vocals, confident patois flow",
      durationHint: "2 minutes"
    },
  };

  // Genre resolution (same logic as fal-service)
  const GENRE_FALLBACK: Record<string, string> = {
    "rnb": "r&b", "neo-soul": "soul", "neo soul": "soul",
    "bedroom pop": "lo-fi", "dream pop": "indie", "synth-pop": "electronic",
    "synthpop": "electronic", "edm": "electronic", "dance": "house",
    "deep house": "house", "tech house": "house", "dubstep": "electronic",
    "hard rock": "rock", "alt rock": "rock", "alternative": "indie",
    "grunge": "rock", "pop rock": "rock", "pop-rock": "rock",
    "hip hop": "hip-hop", "hiphop": "hip-hop", "boom bap": "hip-hop",
    "conscious rap": "rap", "latin pop": "latin", "latin trap": "trap",
    "latin urban": "reggaeton", "salsa": "latin", "bachata": "latin",
    "bossa nova": "jazz", "smooth jazz": "jazz", "ska": "reggae",
    "dub": "reggae", "afro pop": "afrobeat", "afropop": "afrobeat",
    "afrobeats": "afrobeat", "amapiano": "afrobeat", "grime": "trap",
    "death metal": "metal", "heavy metal": "metal", "metalcore": "metal",
    "pop punk": "punk", "hardcore": "punk", "classical": "indie",
    "chillout": "lo-fi", "chill": "lo-fi", "lofi": "lo-fi",
    "motown": "soul", "neo r&b": "r&b",
  };

  const resolveGenre = (g: string): string => {
    const lower = g.toLowerCase().trim();
    if (GENRE_PROFILES[lower]) return lower;
    const mapped = GENRE_FALLBACK[lower];
    if (mapped && GENRE_PROFILES[mapped]) return mapped;
    return "pop";
  };

  const resolvedGenre = resolveGenre(genre);
  const profile = GENRE_PROFILES[resolvedGenre];
  // Blueprint vocal/production style overrides generic profile when available
  const vocalStyle = artistDNA?.vocalStyle || (artistGender === "female" ? profile.vocalFemale : profile.vocalMale);
  const productionStyle = artistDNA?.productionStyle || profile.production;

  if (resolvedGenre !== genre.toLowerCase()) {
    log(`[Lyria3] Genre mapping: "${genre}" → "${resolvedGenre}"`, "lyria3");
  }

  // Build enhanced prompt
  let lyricsContent = customLyrics;
  
  if (!lyricsContent) {
    // Let Lyria 3 generate lyrics based on the prompt description
    lyricsContent = undefined; // Lyria will auto-generate
  }

  // Build the prompt describing the desired music
  const artistInfluences = artistDNA?.influences?.join(", ") || "";
  const moodVibe = artistDNA?.moodKeywords?.[0] || artistDNA?.moodVibe || mood || "energetic";
  const signatureAddOn = artistDNA?.signatureSound ? ` Signature sound: ${artistDNA.signatureSound}.` : '';
  const lyricThemesHint = artistDNA?.lyricThemes?.length ? ` Lyric themes: ${artistDNA.lyricThemes.slice(0, 3).join(', ')}.` : '';

  const promptParts = [
    `Create a ${profile.durationHint} ${resolvedGenre} song titled "${songTitle}" by ${artistName}.`,
    `${moodVibe} mood, ${productionStyle}.`,
    artistInfluences ? `Influenced by: ${artistInfluences}.` : "",
    artistBio ? `Artist style: ${artistBio.substring(0, 200)}.` : "",
    signatureAddOn,
    lyricThemesHint,
  ].filter(Boolean).join(" ");

  const compositionParams: Lyria3CompositionParams = {
    genre: resolvedGenre,
    bpm: profile.bpm,
    key: profile.key,
    mood: moodVibe,
    instruments: profile.instruments,
    vocalStyle,
    productionStyle,
    dynamics: profile.dynamics,
    durationHint: profile.durationHint,
    artistGender,
    instrumental: false,
    customLyrics: lyricsContent,
    outputFormat: "mp3",
  };

  const result = await generateMusicWithLyria3(promptParts, compositionParams);

  if (result.success) {
    log(`[Lyria3] ✅ Song generated: "${songTitle}" → ${result.audioUrl?.substring(0, 60)}...`, "lyria3");
  } else {
    log(`[Lyria3] ❌ Failed to generate "${songTitle}": ${result.error}`, "lyria3");
  }

  return result;
}
