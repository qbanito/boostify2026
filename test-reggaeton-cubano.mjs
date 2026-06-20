/**
 * 🎵 BOOSTIFY HIT MACHINE — Reggaetón x Cuban Fusion
 * Prompt elite basado en la guía oficial de DeepMind Lyria 3
 */
import { GoogleGenAI } from "@google/genai";
import fs from "fs";

const API_KEY = "AIzaSyBNt4IP_T7d3azpbNlpBmGdgDh7qGRXXao";
const client = new GoogleGenAI({ apiKey: API_KEY });

const PROMPT = `
Create a 2-minute reggaetón song fused with traditional Cuban son and timba influences.
This must sound like a global #1 hit — the kind of track that dominates both Latin Billboard and mainstream charts worldwide.

Title: "Fuego en La Habana"

GENRE FUSION: Modern reggaetón dembow rhythm blended with Cuban timba piano tumbaos,
son montuno guitar patterns, and Afro-Cuban batá drum textures woven into the beat.
The fusion must feel organic — not two genres pasted together, but a NEW sound that 
could only exist when these worlds collide.

TEMPO: 96 BPM — slightly faster than classic reggaetón, with a swing feel inherited from Cuban music.
KEY: D minor — dark, sensual, with occasional modal shifts to D Dorian for the Cuban sections.

INSTRUMENTS (specific, not generic):
- Dembow drum pattern on a Roland TR-808 kick and snare as the rhythmic backbone
- Cuban tumbao piano pattern on a warm Fender Rhodes with slight overdrive
- Tres cubano guitar playing syncopated montuno riffs in the verses
- Congas and timbales providing Afro-Cuban polyrhythmic layers ON TOP of the dembow
- Deep 808 sub-bass with a pitch bend slide on every 4th bar
- Güiro scratching pattern adding percussive texture
- Brass section (trumpets and trombones) playing Cuban-style mambo hits in the chorus
- Ambient reverb-drenched vocal chops as transitions between sections
- Claves playing the 3-2 son clave pattern subtly underneath everything

VOCALS: Powerful male vocals with a smooth, sensual Caribbean tone. 
Switches between melodic reggaetón singing in the chorus and rapid-fire 
Cuban-style pregón (call-and-response) flow in the verses.
Vocal texture: warm, slightly raspy, with natural vibrato on held notes.
Ad-libs: "¡Dale!", "¡Azúcar!", whispered "fuego" between phrases.

PRODUCTION: 
- Side-chained compression on the synth pads pumping to the kick drum
- Analog tape saturation on the master bus for warmth
- Wide stereo image with the Cuban percussion panned hard left/right
- The 808 bass should physically rattle speakers — felt in the chest
- Brass should cut through the mix bright and punchy
- Vocal doubles on the chorus hook, slightly detuned for width

DYNAMICS:
- Verse: Pulled back — just voice, tres guitar, and minimal drums. Intimate, storytelling.
- Pre-chorus: Energy builds — congas enter, piano tumbao starts, bass rises
- Chorus: EXPLOSIVE — full brass, driving dembow, layered vocals, maximum energy
- Bridge: Stripped to just piano and voice — raw emotional moment — then DROPS back in

SONG STRUCTURE WITH TIMESTAMPS:

[0:00 - 0:08] Intro: A lone Cuban tres guitar plays a melancholic melody over vinyl crackle 
              and distant conga hits. A whispered "fuego..." as the 808 kick fades in.

[0:08 - 0:30] Verse 1: The dembow drops in softly with the tres guitar montuno.
              Intimate male vocals tell a story of a love found in the streets of Havana —
              real emotion, not clichés. The lyrics paint vivid images:
              walking through Habana Vieja at midnight, the smell of the sea,
              a stranger's eyes that changed everything.
              Piano tumbao enters at 0:20, building warmth.

[0:30 - 0:40] Pre-Chorus: Congas and timbales layer in with Afro-Cuban polyrhythms.
              The vocal melody rises with building tension:
              "Y el fuego que tú enciendes no se apaga con el mar..."
              Rising brass stabs build anticipation. Snare roll into chorus.

[0:40 - 1:05] Chorus: MASSIVE explosion of sound. Full brass mambo hits,
              driving 808 dembow, piano tumbao at full intensity.
              The hook must be undeniably catchy — singable after one listen:
              a melody that combines reggaetón's bounce with Cuban call-and-response.
              Layered vocal harmonies. This is the stadium moment.
              Ad-libs: "¡Dale fuego!" "¡Azúcar!"

[1:05 - 1:25] Verse 2: More intense than verse 1. The tres guitar plays 
              counter-melodies against the vocal. The story deepens — 
              the love becomes real, raw, complicated. 
              Incorporating Cuban slang and street poetry.
              Rapid pregón-style delivery in the second half, almost like spoken word.

[1:25 - 1:35] Pre-Chorus: Even bigger build. Timbales do a fill.
              Brass plays ascending chromatic hits. 
              The vocal strains with emotion on the high notes.

[1:35 - 1:48] Chorus 2: Same massive energy but with added vocal ad-libs,
              brass counter-melodies, and a new rhythmic variation in the drums.
              
[1:48 - 1:55] Bridge: Everything cuts out except the Fender Rhodes piano 
              playing a beautiful, stripped-down Cuban bolero melody.
              The voice delivers the most emotional line of the song — 
              a raw confession. Silence between the notes. Goosebumps moment.

[1:55 - 2:00] Final Drop: The full production SLAMS back in for 5 seconds —
              brass, 808, dembow, congas — maximum power. 
              Ends on a sustained brass chord with the voice holding a high note
              that fades into reverb with a final güiro scratch.

LYRICAL DIRECTION:
The lyrics must tell a REAL story — not generic party lyrics.
A person who left Cuba years ago returns and finds an unexpected love.
The tension between nostalgia for home and the fire of new passion.
Use vivid sensory imagery: the salt air, crumbling colorful walls, 
vintage cars, rum, the sound of music pouring from every window.
Mix Spanish street poetry with universal emotions anyone can feel.
Every line must either create a vivid image or hit an emotional nerve.
NO filler words, NO empty phrases, NO "baby baby" repetition.

This song should make someone who has never been to Cuba FEEL Cuba.
And make someone who has been there cry with recognition.
`;

console.log("🎵 BOOSTIFY HIT MACHINE — Reggaetón x Cuban Fusion");
console.log("═".repeat(60));
console.log("📡 Model: lyria-3-pro-preview");
console.log(`📝 Prompt: ${PROMPT.length} chars`);
console.log("═".repeat(60));
console.log("⏳ Generando hit mundial...\n");

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
    const fileName = `fuego_en_la_habana_${Date.now()}.${ext}`;
    fs.writeFileSync(fileName, audioData);
    const sizeMB = (audioData.length / (1024 * 1024)).toFixed(2);
    console.log(`✅ ¡CANCIÓN GENERADA!`);
    console.log(`📁 Archivo: ${fileName}`);
    console.log(`📊 Tamaño: ${sizeMB} MB`);
    console.log(`🎵 Formato: ${audioMimeType}`);
    console.log(`⏱️ Tiempo: ${elapsed}s`);
  } else {
    console.log("❌ No audio data");
    console.log("Response:", JSON.stringify(response, null, 2).substring(0, 500));
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
