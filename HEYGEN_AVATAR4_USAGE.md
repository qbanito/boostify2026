/**
 * 🗣️ HeyGen Avatar4 Model Usage Map
 * Model: fal-ai/heygen/avatar4/image-to-video
 * Purpose: Generate talking-head spoken promo videos
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. SERVICE LAYER: server/services/heygen-avatar.ts
// ═══════════════════════════════════════════════════════════════════════════

interface HeygenSubmitArgs {
  imageUrl: string;                    // Artist photo from promo pack
  audioUrl?: string;                   // Pre-rendered TTS audio (preferred)
  script?: string;                     // Alternative: text script
  voiceId?: string;                    // HeyGen voice ID for TTS
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

async function submitHeygenAvatar(args: HeygenSubmitArgs): Promise<HeygenSubmitResponse> {
  // Posts to: https://queue.fal.run/fal-ai/heygen/avatar4/image-to-video
  // Returns: { requestId, statusUrl, responseUrl, model }
}

async function generateHeygenBlocking(args): Promise<{
  videoUrl: string;
  durationSeconds: number;
}> {
  // Calls submitHeygenAvatar() and polls for completion
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. ORCHESTRATOR: server/services/promo-video-orchestrator.ts
// ═══════════════════════════════════════════════════════════════════════════

export async function generateSpokenPromoFromAsset(args: {
  imageAssetId: number;
  audioUrl?: string;        // Pre-rendered TTS (recommended)
  voiceId?: string;         // HeyGen voice (alternative)
  language?: string;
  createdBy?: number;
}): Promise<SpokenPromoResult> {
  // 1. Load image asset (from promo pack generation)
  // 2. Load song metadata
  // 3. Build spoken promo script using buildSpokenPromoScript()
  // 4. Call generateHeygenBlocking({
  //      imageUrl: imageAsset.url,
  //      audioUrl or script + voiceId,
  //      aspectRatio: '9:16'
  //    })
  // 5. Mirror video to Firebase storage
  // 6. Save to database as new promoAsset with type='video' + status='ready'
  
  const heygen = await generateHeygenBlocking({
    imageUrl: imageAsset.url,
    audioUrl: args.audioUrl,
    script: script.script,
    voiceId: args.voiceId,
    aspectRatio: '9:16',
  });
  
  // Video is now ready to use
  return {
    videoUrl: ownedUrl,
    assetId: videoAsset.id,
    language,
    durationSeconds: heygen.durationSeconds,
    model: 'fal-ai/heygen/avatar4/image-to-video',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. BACKEND ROUTE: server/routes/promote-engine.ts
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/promote-engine/asset/:imageAssetId/spoken-promo
// Request body: { audioUrl?: string, voiceId?: string, language?: string }
// Response: { ok: true, videoUrl, assetId, durationSeconds, model }

router.post('/asset/:imageAssetId/spoken-promo', isAuthenticated, async (req, res) => {
  const result = await generateSpokenPromoFromAsset({
    imageAssetId: req.params.imageAssetId,
    audioUrl: req.body?.audioUrl,
    voiceId: req.body?.voiceId,
    language: req.body?.language,
    createdBy: caller?.id,
  });
  res.json({ ok: true, ...result });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. FRONTEND UI: client/src/components/admin/cinematic-promo-card.tsx
// ═══════════════════════════════════════════════════════════════════════════

const spokenM = useMutation({
  mutationFn: async (vars: { assetId: number; voiceId?: string; audioUrl?: string }) => {
    // Click "Spoken Promo" button on image in promo pack
    // OR auto-trigger when pack image is generated
    
    const r = await apiRequest(
      `/api/promote-engine/asset/${vars.assetId}/spoken-promo`,
      {
        method: 'POST',
        data: {
          voiceId: vars.voiceId,
          audioUrl: vars.audioUrl,
        },
      },
    );
    return r as { ok: boolean; videoUrl: string; assetId: number };
  },
  onSuccess: (data) => {
    // Video generated successfully - display in UI
    // Show video preview of artist talking about the song
  },
});

// Usage in UI:
// onClick={() => spokenM.mutate({ assetId: p.assetId, voiceId: 'default' })}

// ═══════════════════════════════════════════════════════════════════════════
// WORKFLOW: How It Works End-to-End
// ═══════════════════════════════════════════════════════════════════════════

/*
  CINEMATIC PROMO MODAL → SPOKEN PROMO GENERATION:
  
  1. User generates promo pack (3 images with Flux Pro/Kontext)
  2. For each image, user can click "Spoken Promo" button
  3. UI calls POST /api/promote-engine/asset/:id/spoken-promo
  4. Backend:
     a) Loads the image asset from database
     b) Builds personalized script using GPT + character sheet
     c) Calls HeyGen Avatar4 Model with:
        - Image URL (artist photo from promo pack)
        - Either: pre-rendered audio OR script + voice ID
     d) Polls FAL endpoint until video is ready
     e) Mirrors video to Firebase storage
     f) Saves video asset to database
  5. UI displays video preview
  6. Artist can download or share the talking-head promo
  
  VIDEO OUTPUT:
  - Aspect ratio: 9:16 (vertical, TikTok/Instagram Reels style)
  - Duration: 15-30 seconds typically
  - Quality: HD video of artist "speaking" about the song
  - With LoRA: Artist appearance consistent from image
*/

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE STORAGE: promoAssets table
// ═══════════════════════════════════════════════════════════════════════════

// Type: 'video' (after generation from image)
// url: Firebase storage URL
// metadata: {
//   scriptContent: "string - what was spoken",
//   voiceId: "HeyGen voice used",
//   durationSeconds: 25,
//   characterSheetSnapshot: { ... },
//   spokenPromptUsed: "string - original GPT prompt"
// }
// model: 'fal-ai/heygen/avatar4/image-to-video'
// status: 'ready'

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION & DEPLOYMENT
// ═══════════════════════════════════════════════════════════════════════════

// Requirements:
// - FAL_API_KEY environment variable set
// - HeyGen voice IDs configured (default: 'default' or custom)
// - Firebase storage configured for video storage
// - OPENAI_API_KEY for building scripts

// Status in Boostify:
// ✅ Service implemented: heygen-avatar.ts
// ✅ Orchestrator integrated: promo-video-orchestrator.ts
// ✅ Route active: POST /promote-engine/asset/:id/spoken-promo
// ✅ Frontend UI: Button in cinematic-promo-card.tsx
// ⏳ Auto-trigger: Optional (manual click or timed trigger)
// ⏳ Sprint 2: Integrate with hook videos

// Current Status: PRODUCTION READY (Sprint 2)
