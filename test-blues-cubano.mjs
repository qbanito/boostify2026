/**
 * 🎵 BOOSTIFY HIT MACHINE — Modern Blues x Cuban Fusion
 */
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const API_KEY = "AIzaSyBNt4IP_T7d3azpbNlpBmGdgDh7qGRXXao";
const client = new GoogleGenAI({ apiKey: API_KEY });

const PROMPT = `
Create a 2-minute modern blues song fused with Cuban bolero and son traditions.
Grammy-quality production with deep emotional storytelling and Caribbean soul.

Title: "Lluvia en el Malecón"

GENRE FUSION: Modern electric blues meets Cuban bolero melancholy and son cubano rhythms.
A hybrid genre where 12-bar blues progression is reharmonized with Cuban chord voicings,
and the bolero romanticism enhances every guitar bend.

TEMPO: 72 BPM — slow blues groove with Cuban cinquillo rhythmic undercurrent.
KEY: E minor — E minor pentatonic with Phrygian mode inflections for Spanish-Cuban color.

INSTRUMENTS:
- Fender Stratocaster electric guitar — warm tube amp tone, sustain, expressive blues bends
- Cuban tres guitar playing bolero arpeggios underneath, dialoguing with the Stratocaster
- Upright acoustic bass — walking line fusing blues root movement with Cuban tumbao
- Brushed jazz drums — soft, intimate, with cinquillo syncopation in the hi-hat
- Bongos and cajón adding Afro-Cuban ghost notes underneath
- Hammond B3 organ with Leslie speaker — warm chords that swell and breathe
- Muted flugelhorn in the bridge — lonely, searching, spacious melody
- Maracas providing a gentle constant shaker pulse
- Rain ambient texture and distant thunder

VOCALS: Deep, warm male voice singing in Spanish with natural emotion.
Experienced voice with natural vibrato, slight rasp, warm low register.
Voice carries genuine feeling on every line — intimate and powerful.
Occasionally lets English phrases slip in naturally.

PRODUCTION:
- Analog warmth — recorded-live feel with natural room reverb
- Tube amp saturation on guitar — warm and musical
- Deep, round bass felt in the chest
- Drums mixed quietly — they breathe, not pound
- Subtle tape warmth on the master
- Wide dynamic range — quiet intimate moments building to emotional peaks

SONG STRUCTURE WITH TIMESTAMPS:

[0:00 - 0:10] Intro: Rain atmosphere. A single Stratocaster note rings out 
with long sustain, bending upward. The tres cubano answers with a bolero arpeggio.

[0:10 - 0:35] Verse 1: Brushed drums enter with gentle shuffle and cinquillo syncopation.
Tres plays tender bolero pattern. Voice enters low, telling of a rainy evening 
on the Malecón, watching waves crash against the seawall.
Lyrics are intimate confessions about missing someone who left.
Bass enters at 0:20 with a walking tumbao. Bongos add ghost notes.

[0:35 - 0:50] Chorus: Hammond organ swells in. Vocal rises with undeniable emotion.
The hook melody aches — simple enough to hum, deep enough to close your eyes.
Stratocaster plays sustained tremolo chords.
"Lluvia en el Malecón, lávame el corazón..."
Maracas steady underneath like a heartbeat.

[0:50 - 1:15] Verse 2: More intensity — Stratocaster plays blues licks between vocals.
Tres and electric guitar weave around each other.
Lyrics deepen — memories of dancing in the rain, promises on a balcony in Habana,
the specific way she laughed that he cannot forget.
Bongos more assertive. Bass gets funkier. Cajón adds slap patterns.

[1:15 - 1:30] Chorus 2: Bigger. Organ holds sustained chords. Bass walks with authority.
A second vocal harmony appears, ghostly and distant.

[1:30 - 1:45] Bridge: Everything drops to tres cubano playing a delicate bolero figure.
Muted flugelhorn enters floating above — yearning melody with space between notes.
Hammond hums a single low chord underneath, barely there.

[1:45 - 1:57] Final Chorus: Full band at peak emotion. Voice reaches for the high note 
with everything in it. Stratocaster sustained bend. Organ swells to peak.
One powerful snare crack.

[1:57 - 2:00] Outro: Silence. Rain returns. One tres guitar note fades into the storm.
A whispered "...siempre llueve..." barely audible.

LYRICAL DIRECTION:
About a specific night — someone on the Malecón seawall during a storm,
remembering someone who moved away years ago.
He still catches her perfume when it rains. Still sees her in every doorway of Habana Vieja.
The city is a character — the old buildings, salt air, classic cars in the rain,
someone practicing piano upstairs.
Every line must feel real and specific — not generic love words.
Spanish intimacy with blues directness.
The chorus hook should be simple and unforgettable.
`;

console.log("🎵 BOOSTIFY HIT MACHINE — Modern Blues x Cuban Fusion");
console.log("═".repeat(60));
console.log("📡 Model: lyria-3-pro-preview");
console.log(`📝 Prompt: ${PROMPT.length} chars`);
console.log("═".repeat(60));
console.log("⏳ Generando blues cubano...\n");

const start = Date.now();

try {
  const response = await client.models.generateContent({
    model: "lyria-3-pro-preview",
    contents: [{ role: "user", parts: [{ text: PROMPT }] }],
    config: { responseModalities: ["AUDIO", "TEXT"] },
  });

  let audioData = null;
  let audioMimeType = "audio/mpeg";
  const lyrics = [];

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.text) lyrics.push(part.text);
      else if (part.inlineData) {
        audioData = Buffer.from(part.inlineData.data, "base64");
        audioMimeType = part.inlineData.mimeType || "audio/mpeg";
      }
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log("═".repeat(60));

  if (audioData) {
    const ext = audioMimeType.includes("wav") ? "wav" : "mp3";
    const fileName = `lluvia_en_el_malecon_${Date.now()}.${ext}`;
    fs.writeFileSync(fileName, audioData);
    const sizeMB = (audioData.length / (1024 * 1024)).toFixed(2);
    console.log(`✅ ¡CANCIÓN GENERADA!`);
    console.log(`📁 Archivo: ${fileName}`);
    console.log(`📊 Tamaño: ${sizeMB} MB`);
    console.log(`🎵 Formato: ${audioMimeType}`);
    console.log(`⏱️ Tiempo: ${elapsed}s`);
  } else {
    console.log("❌ No audio data");
    console.log("Candidates:", JSON.stringify(response.candidates, null, 2)?.substring(0, 2000));
    console.log("PromptFeedback:", JSON.stringify(response.promptFeedback, null, 2));
    console.log("UsageMetadata:", JSON.stringify(response.usageMetadata, null, 2));
  }

  if (lyrics.length > 0) {
    console.log("\n📝 LETRAS / ESTRUCTURA:");
    console.log("─".repeat(40));
    console.log(lyrics.join("\n"));
  }
} catch (error) {
  console.error("❌ ERROR:", error.message);
  if (error.status) console.error("Status:", error.status);
}
