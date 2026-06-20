# 🎬 Plan de Mejora: Promociones Atractivas + Audio de Canción

## Problema Actual

Los prompts para generar promociones son muy técnicos pero no optimizados para:
- ✗ Viralidad en redes sociales (TikTok, Instagram Reels)
- ✗ Engagement y scroll-stopping power
- ✗ Integración de audio de la canción
- ✗ Hooks emocionales dirigidos

## Solución Propuesta

### PHASE 1: Mejorar Prompts de Imágenes (Flux Pro/Kontext)

**Archivo a mejorar**: `server/services/promo-style-presets.ts`

Agregar 3 campos nuevos a cada estilo:
```typescript
interface StylePreset {
  // ... campos existentes ...
  viralHook: string;          // Por qué se detiene el scroll
  compositionalRule: string;   // Reglas de composición viral
  engagementTrigger: string;   // Elemento que genera reacción
}
```

**Ejemplo mejorado - Estilo Cinematic:**
```javascript
{
  viralHook: 'Cinematic intensity — stops the scroll with pure drama',
  compositionalRule: 'Subject off-center with leading lines, eyes to camera, 40/60 color contrast',
  engagementTrigger: 'Lens flare catching light, creates "wow" moment',
  promptSuffix: '...shot on Arri Alexa, award-winning photograph, scroll-stopping moment, viral potential...'
}
```

### PHASE 2: Mejorar Scripts Hablados (HeyGen)

**Archivo a mejorar**: `server/services/promo-video-prompts.ts`

**Nuevo sistema SYS_SPOKEN optimizado:**
```
Rules mejoradas:
- Hook first 3 seconds: statistic OR emotional question OR controversial take
- Pattern: HOOK → EMOTIONAL CONTEXT → CTA WITH SONG TITLE
- Tone: confident, intimate, like texting a friend, NOT like ad read
- Include song lyric snippet if memorable
- End with emotional resonance, not just "listen now"

Examples:
❌ Bad: "Hey everyone, listen to my new song called Dreams"
✅ Good: "They said dreams were dead — but then I made this song. It's called Dreams. Hear what happened."

❌ Bad: "Check out my new track"
✅ Good: "I almost didn't release this one. But the hook broke me. It's called Dreams and it's dropping now."
```

### PHASE 3: Integrar Audio de la Canción

**Nueva orquestación:** `server/services/promo-audio-mixer.ts`

La idea: Mezclar video HeyGen + audio de la canción

```typescript
export async function generatePromoWithSongAudio(args: {
  videoAssetId: number;        // HeyGen video
  songId: number;               // Get audio track
  songAudioClip?: {             // Optional: specific clip
    startSec: number;           // Start at 15s
    durationSec: number;         // Use 6 seconds
  };
  mixLevel?: number;            // 0-100: video audio vs song
  fadeIn?: boolean;             // Fade song in
  fadeOut?: boolean;             // Fade song out
}): Promise<{
  mixedVideoUrl: string;
  durationSeconds: number;
  format: 'mp4' | 'webm';
}>
```

**Workflow:**
1. Load HeyGen video (9:16, 15-30s)
2. Extract song audio OR use user-selected clip
3. Mix audio streams (HeyGen speaking + song background)
4. Add crossfade at beginning/end
5. Re-encode as single MP4
6. Save to Firebase storage

### PHASE 4: Audio Extraction from Song

**Nuevo servicio:** `server/services/song-audio-extractor.ts`

```typescript
// Get the best clip from the song for promo use
export async function extractSongClipForPromo(args: {
  songId: number;
  // Options:
  strategy: 'hook' | 'chorus' | 'best-section' | 'drop' | 'custom';
  customStart?: number;  // seconds into song
  customDuration?: number; // seconds to extract
  targetDuration?: number; // resample to this (e.g., 6 seconds)
}): Promise<{
  audioUrl: string;           // Extracted clip
  startTime: number;          // Where it started in original
  durationSeconds: number;
  confidence: number;         // 0-1: how good is this clip
}>

// Strategies:
// - 'hook': First 15 seconds (most memorable)
// - 'chorus': Find and extract main chorus (~8-15s)
// - 'best-section': AI analysis of energy/drops
// - 'drop': Find highest energy moment
// - 'custom': Use provided times
```

### PHASE 5: Enhanced Spoken Promo Script Builder

**Improve:** `server/services/promo-video-prompts.ts`

New SYS_SPOKEN with better hooks:

```javascript
const SYS_SPOKEN_V2 = `You write ENGAGING first-person spoken-promo scripts.

HOOK PATTERNS (use one):
1. STAT: "1 in 3 people said this song haunted them for weeks"
2. QUESTION: "What if your sadness had a soundtrack?"
3. CONTROVERSIAL: "They said sad songs don't chart. I made [TITLE] to prove them wrong"
4. PERSONAL: "I wrote this when everything fell apart"
5. MYSTERY: "Nobody knows why this song hits different"

STRUCTURE:
- Seconds 0-3: Hook (stat/question/take)
- Seconds 3-8: Emotional context (1 sentence)
- Seconds 8-12: Call-to-action (song title + where to listen)
- Tone: Intimate, conversational, confident

FORBIDDEN:
- Never say "Boostify" or mention platform
- Never sound like an advertisement
- No robotic inflection markers
- No generic phrasing

REQUIRED:
- Mention song title naturally
- Include one moment of vulnerability
- End on emotional high, not transactional`;
```

### PHASE 6: New Viral Image Concepts

Add new styles optimized for viral growth:

```typescript
'tiktok_trend': {
  label: 'TikTok Trending',
  description: 'Over-shoulder trends, trending audio visual language',
  viralHook: 'Instantly recognizable trend format',
  compositionalRule: 'Subject facing camera or 3/4, room for text overlay, high saturation',
},
'short_form_hero': {
  label: 'Hero Shot',
  description: 'Stop-scrolling power moment, maximum impact',
  viralHook: 'Impossible to ignore — pure visual impact',
  compositionalRule: 'Subject dominates frame, dramatic lighting, emotional expression',
},
'intimate_closeup': {
  label: 'Intimate Close-up',
  description: 'Eye contact, vulnerability, connection',
  viralHook: 'Feels like personal message to viewer',
  compositionalRule: 'Fills frame with face, direct eye contact, subtle movement',
}
```

## Implementation Roadmap

### Priority 1: Script Improvement (1 day)
- ✅ Update SYS_SPOKEN with better hook patterns
- ✅ Add confidence scoring to scripts
- ✅ Test with sample songs

### Priority 2: Image Prompts (1 day)
- ✅ Add viralHook + compositionalRule to all styles
- ✅ Add new trending styles
- ✅ Update concept generation to use viral hooks

### Priority 3: Audio Extraction (2 days)
- ✅ Extract best clip from song
- ✅ Analyze energy/emotion
- ✅ Auto-select best section

### Priority 4: Audio Mixing (2 days)
- ✅ Integrate FFmpeg for audio mixing
- ✅ Mix HeyGen audio + song clip
- ✅ Add fade in/out

### Priority 5: End-to-End Testing (1 day)
- ✅ Test full flow: image → script → video → audio mix
- ✅ Quality check on outputs
- ✅ User testing

## Database Schema Updates

### promoAssets table — new fields:
```sql
ALTER TABLE promo_assets ADD COLUMN (
  audio_url VARCHAR(500),              -- song clip mixed into video
  audio_duration_seconds INT,
  mixing_strategy VARCHAR(50),          -- 'hook' | 'chorus' | 'custom'
  engagement_metrics JSONB DEFAULT '{}'  -- engagement_hooks, viral_score, etc
);
```

## API Endpoints

### New Routes:

**1. Extract song clip for promo**
```
POST /api/songs/:songId/extract-promo-clip
Body: { strategy: 'hook|chorus|best-section', duration?: number }
Response: { audioUrl, startTime, durationSeconds, confidence }
```

**2. Mix video + audio**
```
POST /api/promote-engine/asset/:videoAssetId/mix-audio
Body: { songClipUrl, mixLevel?: 75 }
Response: { mixedVideoUrl, durationSeconds }
```

**3. Get improved prompts**
```
GET /api/promo-engine/improved-styles
Response: { styles: [{ ...existing, viralHook, compositionalRule, engagementTrigger }] }
```

## Results Expected

### Before (Current)
- Promo images: Good quality but generic
- Scripts: Functional but boring
- Videos: Just HeyGen speaking without song context
- Virality: Low engagement on social media

### After (Proposed)
- Promo images: Scroll-stopping visual impact + composition optimized for feeds
- Scripts: Engaging, personal, hook-driven + emotional connection
- Videos: HeyGen speaking + song audio backdrop + immersive experience
- Virality: 3-5x higher engagement potential

## Example Workflow

```
User generates promo pack for song "Broken Dreams"
   ↓
1. IMPROVED IMAGE GENERATION
   Cinematic style with:
   - viralHook: "Cinematic intensity stops the scroll"
   - compositionalRule: "Off-center framing with strong eye contact"
   - Prompt includes: "...scroll-stopping moment, award-winning photograph..."
   ✅ Image: Professional, stopping power
   
   ↓
2. IMPROVED SCRIPT GENERATION
   Hook pattern: STAT
   Script: "1 in 3 people said 'Broken Dreams' stayed with them for weeks.
            I was in that place when I wrote it. You can hear it now."
   ✅ Script: Engaging, personal, 12 seconds
   
   ↓
3. VIDEO GENERATION (HeyGen)
   Input: Cinematic image + compelling script
   ✅ Video: Artist speaking, 15 seconds, 9:16
   
   ↓
4. SONG AUDIO EXTRACTION
   Strategy: 'hook' (best opening 6 seconds)
   ✅ Audio clip: Song intro/hook, 6 seconds
   
   ↓
5. AUDIO MIXING
   Mix: HeyGen voice (70%) + Song audio (30%)
   Fade song in at 2 seconds, out at end
   ✅ Final video: Immersive experience with song context
   
   ↓
Result: Complete promotional package ready for TikTok/Reels
- Visual: Scroll-stopping image
- Audio: Engaging script + song vibes
- Impact: Artist personality + song essence combined
```

## Success Metrics

- Engagement rate: Track likes, shares, comments
- Save rate: How many save the video
- Click-through: To full song link
- Playlist adds: From promo direct attribution
- Social reach: Impressions, comments, shares

---

**Status**: Ready to implement immediately
**Complexity**: Medium (mostly prompt engineering + FFmpeg integration)
**ROI**: High (should increase promo effectiveness 3-5x)
