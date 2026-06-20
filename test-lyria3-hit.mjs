/**
 * 🎵 LYRIA 3 HIT MACHINE — Test Script
 * Genera una canción hit mundial usando Google Lyria 3 Pro
 * API: Gemini GenerateContent con modelo lyria-3-pro-preview
 */

import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const API_KEY = "AIzaSyBNt4IP_T7d3azpbNlpBmGdgDh7qGRXXao";

const client = new GoogleGenAI({ apiKey: API_KEY });

// ═══════════════════════════════════════════════════════════════
// PROMPT DE HIT MUNDIAL — Nivel Grammy / Billboard #1
// ═══════════════════════════════════════════════════════════════
const HIT_PROMPT = `
Create a 2-minute global pop hit song. This must sound like a #1 Billboard Hot 100 track.

Genre: Modern pop with electronic and R&B influences.
Tempo: 118 BPM.
Key: G Major.
Mood: Euphoric, uplifting, anthemic — the kind of song that makes people feel alive.

Instruments: Bright synth pads, punchy electronic drums, deep bass synth, shimmering arpeggiated synths, 
claps, ambient vocal chops, subtle guitar plucks, lush string section in the chorus.

Production style: Ultra-polished pop production. Max Martin / FINNEAS level quality. 
Crispy mix, wide stereo image, punchy low end, bright high frequencies, 
professional mastering level loudness. Radio-ready.

Vocals: Powerful female vocals, crystal clear tone, emotional delivery with modern pop inflections.
Soaring high notes in the chorus with layered harmonies. Breathy intimate verse delivery 
transitioning to full powerful chorus belting.

[0:00 - 0:08] Intro: Sparkling synth arpeggios with a rising filter sweep, building anticipation.
[0:08 - 0:35] Verse 1: Intimate, pulled-back production. Soft beat with the vocalist telling a story 
              about chasing dreams against all odds. Breathy, personal delivery.
[0:35 - 0:50] Pre-Chorus: Energy builds — drums intensify, synths layer up, vocal melody rises 
              with anticipation. "Are you ready for the light?"
[0:50 - 1:15] Chorus: MASSIVE drop into full production. Anthemic melody that's instantly memorable. 
              Layered vocals, full drums, soaring synths. The hook must be catchy enough to 
              sing after one listen. Stadium-worthy.
[1:15 - 1:40] Verse 2: Slightly more energetic than verse 1, additional instrumental layers.
              The story deepens — overcoming doubt, finding inner strength.
[1:40 - 1:55] Pre-Chorus: Even bigger build than first time, with additional vocal harmonies.
[1:55 - 2:00] Final Chorus Hit: The biggest moment — all instruments at maximum power, 
              vocal ad-libs soaring over the top. Ends on a powerful sustained note.

Lyrics theme: Empowerment, self-discovery, becoming unstoppable. 
Universal message that resonates across cultures and languages.
The chorus hook must be simple, catchy, and instantly singable.

This song should sound like it belongs on Spotify's Today's Top Hits playlist alongside 
Dua Lipa, The Weeknd, and Billie Eilish. World-class production quality.
`;

console.log("🎵 BOOSTIFY HIT MACHINE — Lyria 3 Pro Test");
console.log("═".repeat(60));
console.log(`🔑 API Key: ${API_KEY.substring(0, 12)}...`);
console.log(`📡 Model: lyria-3-pro-preview`);
console.log(`📝 Prompt: ${HIT_PROMPT.length} chars`);
console.log("═".repeat(60));
console.log("⏳ Generating world-class hit song...\n");

try {
  const response = await client.models.generateContent({
    model: "lyria-3-pro-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: HIT_PROMPT }],
      },
    ],
    config: {
      responseModalities: ["AUDIO", "TEXT"],
    },
  });

  // Parse response
  let audioData = null;
  let audioMimeType = "audio/mpeg";
  const lyrics = [];

  if (response.candidates && response.candidates[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        lyrics.push(part.text);
      } else if (part.inlineData) {
        audioData = Buffer.from(part.inlineData.data, "base64");
        audioMimeType = part.inlineData.mimeType || "audio/mpeg";
      }
    }
  }

  console.log("═".repeat(60));

  if (audioData) {
    const ext = audioMimeType.includes("wav") ? "wav" : "mp3";
    const fileName = `lyria3_hit_test_${Date.now()}.${ext}`;
    fs.writeFileSync(fileName, audioData);
    const sizeMB = (audioData.length / (1024 * 1024)).toFixed(2);
    console.log(`✅ SONG GENERATED SUCCESSFULLY!`);
    console.log(`📁 File: ${fileName}`);
    console.log(`📊 Size: ${sizeMB} MB`);
    console.log(`🎵 Format: ${audioMimeType}`);
  } else {
    console.log("❌ No audio data in response");
    console.log("Response:", JSON.stringify(response, null, 2).substring(0, 500));
  }

  if (lyrics.length > 0) {
    console.log("\n📝 LYRICS / STRUCTURE:");
    console.log("─".repeat(40));
    console.log(lyrics.join("\n"));
  }

  console.log("\n═".repeat(60));
  console.log("🎵 Lyria 3 Pro test complete!");

} catch (error) {
  console.error("❌ ERROR:", error.message);
  if (error.response?.data) {
    console.error("API Response:", JSON.stringify(error.response.data, null, 2));
  }
  if (error.status) {
    console.error("Status:", error.status);
  }
  // Log full error for debugging
  console.error("\nFull error:", error);
}
