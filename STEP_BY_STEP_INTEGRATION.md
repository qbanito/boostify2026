# 🚀 Step-by-Step Integration Guide

## Complete Checklist for Implementing Enhanced Promo System

---

## STEP 1: Verify Service Files Created ✅

### Files to Verify:

- [x] `server/services/improved-promo-generator.ts` - Viral-optimized prompt generation
- [x] `server/services/song-audio-extractor.ts` - Extract best audio clips
- [x] `server/services/promo-audio-mixer.ts` - Mix video + song audio

### What to Check:
```bash
# Verify files exist and have no syntax errors
cd server/services
ls -la improved-promo-generator.ts song-audio-extractor.ts promo-audio-mixer.ts

# Check for TypeScript compilation errors
npx tsc --noEmit improved-promo-generator.ts
npx tsc --noEmit song-audio-extractor.ts
npx tsc --noEmit promo-audio-mixer.ts
```

---

## STEP 2: Update Promo Orchestrator

### File: `server/services/promo-orchestrator.ts`

**What to Change:**

1. **Add imports at top:**
```typescript
// BEFORE:
import { buildSpokenPromoScript } from './promo-video-prompts';

// AFTER:
import { buildSpokenPromoScript } from './promo-video-prompts';
import { generateViralPromoConcepts, buildImprovedSpokenPromo } from './improved-promo-generator';
```

2. **Replace generateCreativeConcepts call:**
```typescript
// BEFORE (around line 60):
const concepts = await generateCreativeConcepts({
  songTitle: song.title,
  insights,
  styles,
  characterSheet,
});

// AFTER:
const concepts = await generateViralPromoConcepts({
  songTitle: song.title || `Song #${song.id}`,
  songMood: insights?.mood,
  songThemes: insights?.themes,
  songSummary: insights?.summary,
  styles,
  characterSheet,
});
```

3. **For spoken promos, you can keep existing OR use improved version:**
```typescript
// OPTIONAL: If you want enhanced scripts too
// Replace buildSpokenPromoScript with:
const script = await buildImprovedSpokenPromo({
  songTitle: concept.hookLine || song.title,
  songMood: insights?.mood,
  songThemes: insights?.themes,
  artistName: artist.name,
  sheet: characterSheet,
});
```

---

## STEP 3: Update Promo Video Orchestrator

### File: `server/services/promo-video-orchestrator.ts`

**What to Change:**

1. **Add import:**
```typescript
import { buildImprovedSpokenPromo } from './improved-promo-generator';
```

2. **Update script generation:**
```typescript
// BEFORE:
const script = await buildSpokenPromoScript({
  songTitle: song.title,
  mood,
  artistName,
});

// AFTER:
const script = await buildImprovedSpokenPromo({
  songTitle: song.title,
  songMood: [mood],
  artistName,
  sheet: artist?.characterSheet,
});
```

---

## STEP 4: Add New Routes

### File: `server/routes/promote-engine.ts`

**Add three new routes at the end of the file:**

```typescript
/**
 * POST /api/promote-engine/song/:songId/extract-promo-clip
 * Extract best audio clip from song
 */
router.post('/song/:songId/extract-promo-clip', isAuthenticated, async (req, res) => {
  const songId = parseInt(req.params.songId, 10);
  try {
    const clip = await extractSongClipForPromo({
      songId,
      strategy: req.body?.strategy || 'best-section',
      customStart: req.body?.customStart,
      customDuration: req.body?.customDuration,
      targetDuration: req.body?.targetDuration || 6,
    });

    res.json({
      ok: true,
      clipStart: clip.startSeconds,
      clipDuration: clip.durationSeconds,
      reason: clip.reason,
      confidence: clip.confidence,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/promote-engine/asset/:videoAssetId/mix-with-audio
 * Mix video with song audio
 */
router.post('/asset/:videoAssetId/mix-with-audio', isAuthenticated, async (req, res) => {
  const videoAssetId = parseInt(req.params.videoAssetId, 10);
  try {
    const [asset] = await db
      .select()
      .from(promoAssets)
      .where(eq(promoAssets.id, videoAssetId))
      .limit(1);

    if (!asset || asset.type !== 'video') {
      return res.status(400).json({ ok: false, error: 'Not a video asset' });
    }

    const clip = await extractSongClipForPromo({
      songId: asset.songId,
      strategy: req.body?.clipStrategy || 'best-section',
      targetDuration: req.body?.clipDuration || 6,
    });

    const songAudioUrl = req.body?.audioUrl || `firebase://songs/${asset.songId}/audio.mp3`;
    const profile = req.body?.profile || 'BALANCED';

    const mixed = await mixVideoWithSongAudio({
      videoUrl: asset.url,
      audioUrl: songAudioUrl,
      ...MIXING_PROFILES[profile as keyof typeof MIXING_PROFILES],
      outputFormat: 'mp4',
    });

    const [mixedAsset] = await db
      .insert(promoAssets)
      .values({
        songId: asset.songId,
        artistId: asset.artistId,
        type: 'video',
        style: asset.style,
        url: mixed.videoUrl,
        prompt: `${asset.prompt} [AUDIO MIXED: ${profile}]`,
        model: 'fal-ai/heygen + audio-mixer',
        status: 'ready',
        metadata: {
          ...asset.metadata,
          audioMixInfo: mixed.audioMixInfo,
          mixProfile: profile,
        },
      })
      .returning();

    res.json({
      ok: true,
      asset: { id: mixedAsset.id, url: mixedAsset.url },
      audioMixInfo: mixed.audioMixInfo,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/promote-engine/mixing-profiles
 * Get available mixing profiles
 */
router.get('/mixing-profiles', isAuthenticated, async (req, res) => {
  res.json({
    ok: true,
    profiles: {
      VOICE_FOCUSED: { label: 'Voice (75%)', videoLevel: 0.75, songLevel: 0.25 },
      BALANCED: { label: 'Balanced (50%)', videoLevel: 0.5, songLevel: 0.5 },
      MUSIC_FOCUSED: { label: 'Music (70%)', videoLevel: 0.3, songLevel: 0.7 },
      FULL_SONG: { label: 'Full Song (80%)', videoLevel: 0.2, songLevel: 0.8 },
    },
  });
});
```

**Add imports at top:**
```typescript
import { extractSongClipForPromo } from '../services/song-audio-extractor';
import { mixVideoWithSongAudio, MIXING_PROFILES } from '../services/promo-audio-mixer';
```

---

## STEP 5: Update Frontend UI

### File: `client/src/components/admin/cinematic-promo-card.tsx`

**Add state for audio mixing:**
```typescript
const [mixingProfile, setMixingProfile] = useState('BALANCED');
```

**Add mutation for audio mixing:**
```typescript
const mixAudioM = useMutation({
  mutationFn: async (vars: { videoAssetId: number }) => {
    const r = await fetch(`/api/promote-engine/asset/${vars.videoAssetId}/mix-with-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clipStrategy: 'best-section',
        clipDuration: 6,
        profile: mixingProfile,
      }),
    }).then(r => r.json());
    return r;
  },
  onSuccess: () => {
    toast.success('✅ Video mixed with song audio!');
  },
});
```

**Add UI controls in render:**
```typescript
// After the "Hook Video" button, add:
<div className="space-y-2 mt-2">
  <Label htmlFor="mix-profile" className="text-xs">
    Audio Mix Profile
  </Label>
  <Select value={mixingProfile} onValueChange={setMixingProfile}>
    <SelectTrigger id="mix-profile" className="h-8 text-xs">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="VOICE_FOCUSED">Voice Prominent (75%)</SelectItem>
      <SelectItem value="BALANCED">Balanced (50/50)</SelectItem>
      <SelectItem value="MUSIC_FOCUSED">Music Prominent (70%)</SelectItem>
      <SelectItem value="FULL_SONG">Full Song (80%)</SelectItem>
    </SelectContent>
  </Select>
</div>

<Button
  onClick={() => mixAudioM.mutate({ videoAssetId: p.assetId })}
  disabled={mixAudioM.isPending}
  className="w-full mt-2 h-9 sm:h-11 text-xs sm:text-sm"
>
  {mixAudioM.isPending ? 'Mixing...' : '🎵 Mix with Song Audio'}
</Button>
```

---

## STEP 6: System Requirements & Dependencies

### Check Prerequisites:
```bash
# FFmpeg must be installed on server
ffmpeg -version
ffprobe -version

# If not installed:
# Ubuntu/Debian:
sudo apt-get install ffmpeg

# macOS:
brew install ffmpeg

# Windows (via chocolatey):
choco install ffmpeg
```

### Dependencies Already in Project:
- `axios` - For downloading files ✓
- `child_process` - Built-in Node.js ✓
- `OpenAI` - Already integrated ✓
- `firebase-admin` - Already configured ✓

### Add if Missing:
```bash
npm install --save-dev @types/node
```

---

## STEP 7: Database Migrations (Optional)

**If you want to track audio mixing stats, run:**

```sql
ALTER TABLE promo_assets ADD COLUMN (
  mix_profile VARCHAR(50),
  viral_score FLOAT DEFAULT 0.0,
  engagement_metrics JSONB DEFAULT '{}'
);
```

---

## STEP 8: Testing Checklist

### Unit Tests:

```typescript
// Test improved prompts
import { generateViralPromoConcepts } from './improved-promo-generator';

const concepts = await generateViralPromoConcepts({
  songTitle: 'Test Song',
  songMood: ['energetic'],
  styles: ['cinematic'],
});

console.assert(concepts.length > 0, 'Should generate concepts');
console.assert(concepts[0].viralHook.length < 20, 'Hook should be short');
```

```typescript
// Test audio extraction
import { extractSongClipForPromo } from './song-audio-extractor';

const clip = await extractSongClipForPromo({
  songId: 123,
  strategy: 'hook',
  targetDuration: 6,
});

console.assert(clip.durationSeconds <= 6, 'Should respect duration');
console.assert(clip.confidence > 0.5, 'Should have confidence');
```

### Integration Tests:

1. **Test full promo pipeline:**
   - Generate image with improved prompts ✓
   - Generate script with improved prompts ✓
   - Create HeyGen video ✓
   - Extract song audio ✓
   - Mix audio with video ✓
   - Verify final video has both audio streams ✓

2. **Test all mixing profiles:**
   - VOICE_FOCUSED: Voice should be prominent
   - BALANCED: Equal levels
   - MUSIC_FOCUSED: Music should be prominent
   - FULL_SONG: Music throughout

---

## STEP 9: Deployment

### Pre-deployment:
```bash
# Compile TypeScript
npm run build

# Run tests
npm test

# Check for errors
npm run lint
```

### Deployment steps:
1. Merge code to develop branch
2. Deploy to staging environment
3. Run integration tests on staging
4. Get UAT sign-off from marketing team
5. Deploy to production during low-traffic hours
6. Monitor error logs for 24 hours

### Monitor:
- Error rate for new routes
- Audio mixing completion time (target: <60s)
- Video generation time (target: <120s)
- User engagement metrics

---

## STEP 10: Post-Deployment Monitoring

### Metrics to Track:

```sql
-- Query to see audio mixing usage
SELECT 
  DATE(created_at) as day,
  COUNT(*) as total_mixes,
  AVG(metadata->>'videoAudio'::text) as avg_mix_profile
FROM promo_assets
WHERE metadata->>'audioMixInfo' IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

### Key Performance Indicators:
- Audio mix generation time: < 90 seconds
- User adoption: % of videos using audio mixing
- Social engagement: Comments/shares on mixed videos vs original
- Error rate: < 2% failure rate

---

## Quick Reference: Route Endpoints

### Before (7 routes):
```
GET  /api/promote-engine/artist-style/:artistId/status
POST /api/promote-engine/artist-style/:artistId/auto-bootstrap
POST /api/promote-engine/song/:songId/generate-pack          (UPDATED)
POST /api/promote-engine/asset/:assetId/hook-video
POST /api/promote-engine/asset/:assetId/spoken-promo         (UPDATED)
POST /api/promote-engine/artist-style/:artistId/train
GET  /api/promote-engine/styles
```

### After (10 routes):
```
✅ GET  /api/promote-engine/artist-style/:artistId/status
✅ POST /api/promote-engine/artist-style/:artistId/auto-bootstrap
✅ POST /api/promote-engine/song/:songId/generate-pack          [IMPROVED]
✅ POST /api/promote-engine/asset/:assetId/hook-video
✅ POST /api/promote-engine/asset/:assetId/spoken-promo         [IMPROVED]
✅ POST /api/promote-engine/artist-style/:artistId/train
✅ GET  /api/promote-engine/styles

🆕 POST /api/promote-engine/song/:songId/extract-promo-clip
🆕 POST /api/promote-engine/asset/:assetId/mix-with-audio
🆕 GET  /api/promote-engine/mixing-profiles
```

---

## Troubleshooting

### Issue: FFmpeg not found
**Solution:**
```bash
# Install FFmpeg
sudo apt-get install ffmpeg

# Verify path
which ffmpeg
```

### Issue: Audio extraction takes too long
**Solution:**
- Check file size (should be < 10MB)
- Check network speed (Firebase download)
- Cache extracted clips for reuse

### Issue: Video mixing produces silent video
**Solution:**
- Check both audio files exist
- Verify audio codec compatibility
- Run ffmpeg command manually to debug

### Issue: TypeScript compilation errors
**Solution:**
```bash
# Check all files compile
npx tsc --noEmit

# Fix any missing types
npm install --save-dev @types/[package-name]
```

---

## Success Criteria ✅

When complete, you should see:
- ✅ All 10 routes responding to requests
- ✅ Improved prompts generating viral concepts
- ✅ Audio extraction working for all strategies
- ✅ Video + audio mixing producing dual-audio MP4s
- ✅ Frontend UI showing mixing profiles
- ✅ Error logs showing < 2% failure rate
- ✅ Social media engagement metrics increasing

---

**Estimated Implementation Time**: 3-4 hours
**Estimated Testing Time**: 2-3 hours
**Total**: 5-7 hours
