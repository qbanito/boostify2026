/**
 * 🎬 VideoService AI Proposal Generator
 * 
 * Pipeline: Audio → Whisper Lyrics → GPT Script + Director → Image Generation → Proposal Email
 * 
 * Uses:
 * - OpenAI Whisper for lyrics extraction
 * - OpenAI GPT-4o for script generation + director assignment
 * - OpenAI gpt-image-1 for concept image generation
 * - Brevo for sending the proposal email
 */

import { createTrackedOpenAI } from '../utils/tracked-openai';
import { storage } from '../firebase';
import { PRIMARY_MODEL } from '../utils/ai-config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const openai = OPENAI_API_KEY ? createTrackedOpenAI({ apiKey: OPENAI_API_KEY }) : null;

const BASE_URL = process.env.PRODUCTION_URL || process.env.BASE_URL || 'https://boostifymusic.com';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FROM_EMAIL = 'info@boostifymusic.com';
const FROM_NAME = 'Boostify Video Service';

// ── Interfaces ──────────────────────────────────────────────────────

export interface ProposalInput {
  projectId: number;
  artistName: string;
  email: string;
  songName: string;
  genre?: string;
  aesthetic?: string;
  description?: string;
  videoType?: string;
  lang: 'es' | 'en';
  audioBuffer: Buffer;
  audioFileName: string;
  audioMimeType: string;
  artistPageUrl?: string;
  artistImageUrl?: string;
  calculatedPrice?: string;
}

export interface SceneScript {
  sceneNumber: number;
  title: string;
  duration: string;
  description: string;
  visualPrompt: string;
  lyrics: string;
  cameraMovement: string;
  mood: string;
}

export interface DirectorProfile {
  name: string;
  specialty: string;
  bio: string;
  style: string;
  emoji: string;
}

export interface ProposalResult {
  success: boolean;
  lyrics?: string;
  director?: DirectorProfile;
  scenes?: SceneScript[];
  sceneImages?: string[]; // URLs of generated images
  error?: string;
}

// ── 1. TRANSCRIBE LYRICS WITH WHISPER ───────────────────────────────

async function transcribeLyrics(audioBuffer: Buffer, fileName: string, mimeType: string): Promise<{ text: string; language: string; duration: number }> {
  if (!openai) throw new Error('OpenAI API key not configured');

  console.log(`🎤 [AI-Proposal] Transcribing lyrics from ${fileName} (${(audioBuffer.length / 1024 / 1024).toFixed(1)}MB)...`);

  const audioFile = new File([new Uint8Array(audioBuffer)], fileName, { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });

  const text = transcription.text || '';
  const language = (transcription as any).language || 'es';
  const duration = (transcription as any).duration || 180;

  console.log(`✅ [AI-Proposal] Lyrics extracted: ${text.length} chars, language: ${language}, duration: ${duration}s`);

  return { text, language, duration };
}

// ── 2. GENERATE SCRIPT + ASSIGN DIRECTOR WITH GPT ──────────────────

async function generateScriptAndDirector(input: {
  lyrics: string;
  songName: string;
  artistName: string;
  genre?: string;
  aesthetic?: string;
  description?: string;
  videoType?: string;
  lang: 'es' | 'en';
  duration: number;
}): Promise<{ director: DirectorProfile; scenes: SceneScript[] }> {
  if (!openai) throw new Error('OpenAI API key not configured');

  const isEs = input.lang === 'es';
  console.log(`🎬 [AI-Proposal] Generating script for "${input.songName}" by ${input.artistName}...`);

  const systemPrompt = `You are the creative head of Boostify Video Service, a premium AI music video production studio. 
Your job is to:
1. Analyze the song lyrics and genre to assign the perfect creative director from the Boostify team
2. Create a detailed 5-7 scene video script/storyboard that matches the song's emotion, tempo, and lyrics

The response must be in ${isEs ? 'Spanish' : 'English'}.

DIRECTORS AVAILABLE (choose the best match based on genre/style):
- "Alejandro Vega" - Urban/Reggaeton/Trap specialist. Bold colors, nightlife, street culture, sports cars, flashy aesthetics.
- "Sofia Luna" - Pop/R&B/Latin. Dreamy, romantic, soft lighting, nature, emotional storytelling, dance sequences.
- "Marcus Wright" - Hip-Hop/Rap. Gritty, raw, documentary style, B&W + color contrasts, urban landscapes.
- "Isabella Torres" - Indie/Alternative/Rock. Artistic, surreal, film grain, vintage aesthetics, symbolic imagery.
- "Diego Chen" - Electronic/EDM/Experimental. Futuristic, neon, abstract visuals, geometric, cyberpunk.

You MUST respond with ONLY valid JSON (no markdown, no code blocks) matching this structure:
{
  "director": {
    "name": "Director Name",
    "specialty": "Genre specialty",
    "bio": "2-sentence director bio",
    "style": "visual style description",
    "emoji": "🎬"
  },
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Scene title",
      "duration": "0:00 - 0:25",
      "description": "Detailed description of what happens in this scene",
      "visualPrompt": "Detailed prompt for generating a concept image of this scene. Include: setting, lighting, colors, mood, composition, camera angle. Make it cinematographic and specific.",
      "lyrics": "Relevant lyrics for this section (or 'Instrumental' if none)",
      "cameraMovement": "Camera movement description",
      "mood": "Emotional mood of the scene"
    }
  ]
}`;

  const userPrompt = `Create a professional video script for:
- Song: "${input.songName}" by ${input.artistName}
- Genre: ${input.genre || 'Urban/Latin'}
- Aesthetic: ${input.aesthetic || 'Cinematic'}
- Song duration: ~${Math.round(input.duration)}s
- Video type: ${input.videoType || 'music_video'}
${input.description ? `- Artist's vision: ${input.description}` : ''}

LYRICS:
${input.lyrics || '(Instrumental - no lyrics detected)'}

Create 5-7 scenes that flow with the song's structure and emotion. Each visualPrompt must be extremely detailed for AI image generation - describe the exact visual composition, lighting, colors, and mood.`;

  const response = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: 4000,
  });

  const content = response.choices[0]?.message?.content || '';

  // Parse JSON response - handle potential markdown wrapping
  let parsed: { director: DirectorProfile; scenes: SceneScript[] };
  try {
    const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error('❌ [AI-Proposal] Failed to parse GPT response:', content.substring(0, 200));
    throw new Error('Failed to parse script response from AI');
  }

  console.log(`✅ [AI-Proposal] Script generated: ${parsed.scenes.length} scenes, Director: ${parsed.director.name}`);
  return parsed;
}

// ── 3. GENERATE CONCEPT IMAGES ──────────────────────────────────────

async function generateSceneImage(visualPrompt: string, sceneNum: number, projectId: number): Promise<string | null> {
  if (!openai) return null;

  try {
    console.log(`🎨 [AI-Proposal] Generating image for scene ${sceneNum}...`);

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: `Cinematic music video frame, high production value, widescreen 16:9 composition. ${visualPrompt}. Professional lighting, shallow depth of field, film-like color grading. Do NOT include any text or watermarks.`,
      n: 1,
      size: '1536x1024',
      quality: 'medium',
    });

    const imageData = response.data?.[0];
    if (!imageData) return null;

    // gpt-image-1 returns base64 data
    const b64 = (imageData as any).b64_json;
    if (!b64) {
      // If URL is returned instead
      const url = (imageData as any).url;
      if (url) return url;
      return null;
    }

    // Upload base64 image to Firebase Storage
    const imageBuffer = Buffer.from(b64, 'base64');
    const fileName = `videoservice-proposals/${projectId}/scene_${sceneNum}_${Date.now()}.png`;

    if (storage) {
      const bucket = storage.bucket();
      const file = bucket.file(fileName);
      await file.save(imageBuffer, { metadata: { contentType: 'image/png' }, validation: false });
      const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
      console.log(`✅ [AI-Proposal] Scene ${sceneNum} image uploaded: ${publicUrl}`);
      return publicUrl;
    }

    return null;
  } catch (error: any) {
    console.error(`❌ [AI-Proposal] Scene ${sceneNum} image generation failed:`, error.message);
    return null;
  }
}

async function generateAllSceneImages(scenes: SceneScript[], projectId: number): Promise<string[]> {
  console.log(`🎨 [AI-Proposal] Generating ${scenes.length} concept images...`);

  // Generate images sequentially to avoid rate limits
  const images: string[] = [];
  for (const scene of scenes) {
    const url = await generateSceneImage(scene.visualPrompt, scene.sceneNumber, projectId);
    images.push(url || '');
  }

  const successCount = images.filter(u => u).length;
  console.log(`✅ [AI-Proposal] Generated ${successCount}/${scenes.length} concept images`);
  return images;
}

// ── 4. SEND PROPOSAL EMAIL ──────────────────────────────────────────

function buildProposalEmail(input: {
  artistName: string;
  songName: string;
  projectId: number;
  lang: 'es' | 'en';
  director: DirectorProfile;
  scenes: SceneScript[];
  sceneImages: string[];
  lyrics: string;
  artistPageUrl?: string;
  artistImageUrl?: string;
  calculatedPrice?: string;
}): string {
  const isEs = input.lang === 'es';

  const scenesHtml = input.scenes.map((scene, i) => {
    const imgUrl = input.sceneImages[i];
    return `
      <div style="margin-bottom:24px;background:#1a1a2e;border-radius:12px;overflow:hidden;border:1px solid #2d2d4e">
        ${imgUrl ? `<img src="${imgUrl}" alt="Scene ${scene.sceneNumber}" width="100%" style="display:block;max-height:300px;object-fit:cover" />` : ''}
        <div style="padding:16px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="background:#f97316;color:#fff;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px">${isEs ? 'ESCENA' : 'SCENE'} ${scene.sceneNumber}</span>
            <span style="color:#9ca3af;font-size:12px">${scene.duration}</span>
          </div>
          <h3 style="color:#fff;margin:0 0 8px;font-size:16px">${scene.title}</h3>
          <p style="color:#d1d5db;font-size:13px;line-height:1.6;margin:0 0 12px">${scene.description}</p>
          ${scene.lyrics && scene.lyrics !== 'Instrumental' ? `
            <div style="background:#0f0f23;border-left:3px solid #f97316;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:10px">
              <p style="color:#f97316;font-size:10px;font-weight:700;margin:0 0 4px;text-transform:uppercase">${isEs ? '🎤 Letra' : '🎤 Lyrics'}</p>
              <p style="color:#e5e7eb;font-size:13px;font-style:italic;margin:0;line-height:1.5">"${scene.lyrics}"</p>
            </div>
          ` : ''}
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0"><span style="color:#6b7280;font-size:11px">📷 ${isEs ? 'Cámara' : 'Camera'}:</span> <span style="color:#9ca3af;font-size:11px">${scene.cameraMovement}</span></td>
            </tr>
            <tr>
              <td style="padding:4px 0"><span style="color:#6b7280;font-size:11px">🎭 Mood:</span> <span style="color:#9ca3af;font-size:11px">${scene.mood}</span></td>
            </tr>
          </table>
        </div>
      </div>
    `;
  }).join('');

  const lyricsPreview = input.lyrics.length > 500 ? input.lyrics.substring(0, 500) + '...' : input.lyrics;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px">
<table width="640" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #222;max-width:100%">

<!-- Header -->
<tr><td style="background:linear-gradient(135deg,#f97316,#dc2626);padding:32px;text-align:center">
  <div style="color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">BOOSTIFY VIDEO SERVICE</div>
  <div style="color:#fff;font-size:26px;font-weight:800;line-height:1.2">${isEs ? '🎬 Tu Guión de Video Está Listo' : '🎬 Your Video Script is Ready'}</div>
  <div style="color:rgba(255,255,255,0.7);font-size:14px;margin-top:8px">"${input.songName}" — ${input.artistName}</div>
</td></tr>

<!-- Director Section -->
<tr><td style="padding:24px 32px 0">
  <div style="background:linear-gradient(135deg,#1a1a3e,#16213e);border-radius:12px;padding:20px;border:1px solid #f97316;margin-bottom:24px">
    <div style="display:flex;gap:16px">
      <div>
        <div style="font-size:11px;color:#f97316;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${isEs ? '🎬 TU DIRECTOR CREATIVO' : '🎬 YOUR CREATIVE DIRECTOR'}</div>
        <div style="color:#fff;font-size:20px;font-weight:700;margin-bottom:4px">${input.director.emoji} ${input.director.name}</div>
        <div style="color:#f97316;font-size:13px;font-weight:600;margin-bottom:8px">${input.director.specialty}</div>
        <div style="color:#9ca3af;font-size:13px;line-height:1.5">${input.director.bio}</div>
        <div style="color:#6b7280;font-size:12px;margin-top:8px;font-style:italic">${isEs ? 'Estilo' : 'Style'}: ${input.director.style}</div>
      </div>
    </div>
  </div>
</td></tr>

<!-- Lyrics Section -->
<tr><td style="padding:0 32px">
  <div style="background:#0f0f23;border-radius:12px;padding:20px;margin-bottom:24px;border:1px solid #2d2d4e">
    <div style="color:#f97316;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">${isEs ? '🎤 LETRA EXTRAÍDA POR IA' : '🎤 AI-EXTRACTED LYRICS'}</div>
    <p style="color:#d1d5db;font-size:13px;line-height:1.8;margin:0;white-space:pre-line">${lyricsPreview}</p>
  </div>
</td></tr>

<!-- Script/Storyboard -->
<tr><td style="padding:0 32px">
  <div style="text-align:center;margin-bottom:20px">
    <div style="color:#f97316;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${isEs ? '🎬 GUIÓN VISUAL' : '🎬 VISUAL SCRIPT'}</div>
    <div style="color:#fff;font-size:22px;font-weight:700">${isEs ? 'Storyboard de Tu Video' : 'Your Video Storyboard'}</div>
    <div style="color:#6b7280;font-size:13px">${input.scenes.length} ${isEs ? 'escenas • Concepto generado con IA' : 'scenes • AI-generated concept'}</div>
  </div>
  ${scenesHtml}
</td></tr>

${input.artistPageUrl ? `
<!-- Artist Page -->
<tr><td style="padding:0 32px">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;border:1px solid #f97316">
    <div style="font-size:24px;margin-bottom:8px">🎁</div>
    <div style="color:#f97316;font-size:16px;font-weight:700;margin-bottom:8px">${isEs ? '¡Tu Landing Page de Artista GRATIS!' : 'Your FREE Artist Landing Page!'}</div>
    ${input.artistImageUrl ? `<img src="${input.artistImageUrl}" alt="Artist" width="80" height="80" style="border-radius:50%;margin:8px auto;display:block;border:2px solid #f97316;object-fit:cover" />` : ''}
    <a href="${input.artistPageUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-top:8px">${isEs ? 'Ver Mi Página' : 'View My Page'}</a>
  </div>
</td></tr>
` : ''}

<!-- CTA: Approve and Produce -->
<tr><td style="padding:0 32px 32px">
  <div style="background:linear-gradient(135deg,#f97316,#dc2626);border-radius:16px;padding:32px;text-align:center">
    <div style="color:#fff;font-size:20px;font-weight:800;margin-bottom:8px">${isEs ? '¿Te gusta el guión?' : 'Like the script?'}</div>
    <div style="color:rgba(255,255,255,0.8);font-size:14px;margin-bottom:20px">${isEs
      ? 'Aprueba tu propuesta y comencemos a producir tu video musical profesional'
      : 'Approve your proposal and let\'s start producing your professional music video'}</div>
    ${input.calculatedPrice ? `<div style="color:#fff;font-size:36px;font-weight:900;margin-bottom:4px">$${input.calculatedPrice}</div><div style="color:rgba(255,255,255,0.6);font-size:12px;margin-bottom:16px">${isEs ? 'Depósito 50% para iniciar' : '50% deposit to start'}</div>` : ''}
    <a href="${BASE_URL}/videoservice/success?project_id=${input.projectId}" style="display:inline-block;background:#fff;color:#f97316;padding:16px 48px;border-radius:12px;text-decoration:none;font-weight:800;font-size:16px;box-shadow:0 4px 20px rgba(0,0,0,0.3)">${isEs ? '🚀 Aprobar y Producir Mi Video' : '🚀 Approve & Produce My Video'}</a>
    <div style="margin-top:16px">
      <a href="https://wa.me/17865432478?text=${encodeURIComponent(isEs ? `Hola! Quiero aprobar el guión de mi video "${input.songName}". Proyecto #${input.projectId}` : `Hi! I want to approve the script for my video "${input.songName}". Project #${input.projectId}`)}" style="color:#fff;font-size:13px;text-decoration:underline">${isEs ? '💬 O escríbenos por WhatsApp' : '💬 Or message us on WhatsApp'}</a>
    </div>
  </div>
</td></tr>

<!-- Footer -->
<tr><td style="padding:16px 32px;border-top:1px solid #222;text-align:center;color:#6b7280;font-size:11px">
  &copy; ${new Date().getFullYear()} Boostify Music &bull; <a href="${BASE_URL}/terms" style="color:#f97316">Terms</a> &bull;
  <a href="${BASE_URL}/privacy" style="color:#f97316">Privacy</a>
  <br><span style="color:#444;font-size:10px">${isEs ? 'Guión generado con IA. Las imágenes son conceptuales.' : 'AI-generated script. Images are conceptual.'}</span>
</td></tr>

</table></td></tr></table></body></html>`;
}

async function sendProposalEmail(
  email: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email }],
        subject,
        htmlContent: html,
      }),
    });
    const data = await res.json();
    return data.messageId ? { success: true } : { success: false, error: data.message };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ── MAIN PIPELINE ───────────────────────────────────────────────────

export async function generateAIProposal(input: ProposalInput): Promise<ProposalResult> {
  console.log(`\n🚀 [AI-Proposal] ════════════════════════════════════════`);
  console.log(`🚀 [AI-Proposal] Starting proposal for "${input.songName}" by ${input.artistName}`);
  console.log(`🚀 [AI-Proposal] Project #${input.projectId} | Email: ${input.email}`);
  console.log(`🚀 [AI-Proposal] ════════════════════════════════════════\n`);

  try {
    // ── STEP 1: Transcribe lyrics ──
    let lyrics = '';
    let language = input.lang;
    let duration = 180;
    
    try {
      const transcription = await transcribeLyrics(input.audioBuffer, input.audioFileName, input.audioMimeType);
      lyrics = transcription.text;
      language = transcription.language as 'es' | 'en';
      duration = transcription.duration;
    } catch (err: any) {
      console.warn(`⚠️ [AI-Proposal] Lyrics extraction failed: ${err.message}. Proceeding without lyrics.`);
    }

    // ── STEP 2: Generate script + assign director ──
    const { director, scenes } = await generateScriptAndDirector({
      lyrics,
      songName: input.songName,
      artistName: input.artistName,
      genre: input.genre,
      aesthetic: input.aesthetic,
      description: input.description,
      videoType: input.videoType,
      lang: input.lang,
      duration,
    });

    // ── STEP 3: Generate concept images for each scene ──
    const sceneImages = await generateAllSceneImages(scenes, input.projectId);

    // ── STEP 4: Build and send proposal email ──
    const isEs = input.lang === 'es';
    const subject = isEs
      ? `🎬 Tu Guión de Video Está Listo – "${input.songName}" | Boostify #${input.projectId}`
      : `🎬 Your Video Script is Ready – "${input.songName}" | Boostify #${input.projectId}`;

    const html = buildProposalEmail({
      artistName: input.artistName,
      songName: input.songName,
      projectId: input.projectId,
      lang: input.lang,
      director,
      scenes,
      sceneImages,
      lyrics,
      artistPageUrl: input.artistPageUrl,
      artistImageUrl: input.artistImageUrl,
      calculatedPrice: input.calculatedPrice,
    });

    const emailResult = await sendProposalEmail(input.email, subject, html);

    if (emailResult.success) {
      console.log(`✅ [AI-Proposal] Proposal email sent to ${input.email}`);
    } else {
      console.error(`❌ [AI-Proposal] Proposal email failed:`, emailResult.error);
    }

    console.log(`\n🎬 [AI-Proposal] ═══ PIPELINE COMPLETE ═══`);
    console.log(`🎬 [AI-Proposal] Director: ${director.name}`);
    console.log(`🎬 [AI-Proposal] Scenes: ${scenes.length}`);
    console.log(`🎬 [AI-Proposal] Images: ${sceneImages.filter(u => u).length}`);
    console.log(`🎬 [AI-Proposal] Email: ${emailResult.success ? '✅ Sent' : '❌ Failed'}\n`);

    return {
      success: true,
      lyrics,
      director,
      scenes,
      sceneImages,
    };
  } catch (error: any) {
    console.error(`❌ [AI-Proposal] Pipeline error:`, error.message);
    return { success: false, error: error.message };
  }
}
