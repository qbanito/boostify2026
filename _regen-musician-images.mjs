/**
 * One-off: regenerate musician portraits (dead fal.media URLs) with
 * HF FLUX.1-schnell (free) and persist PERMANENTLY in Firebase Storage.
 * Updates 15 existing musician_images docs (3 per category).
 */
import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function normKey(k) { if (!k) return k; let s = k.trim().replace(/^['"]|['"]$/g, ''); if (s.includes('\\n')) s = s.replace(/\\n/g, '\n'); return s; }
let creds;
if (process.env.FIREBASE_ADMIN_KEY) {
  const sa = JSON.parse(process.env.FIREBASE_ADMIN_KEY.trim().replace(/^['"]|['"]$/g, ''));
  creds = { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: normKey(sa.private_key) };
} else {
  creds = { projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: normKey(process.env.FIREBASE_PRIVATE_KEY) };
}
initializeApp({ credential: cert(creds), storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${creds.projectId}.firebasestorage.app` });
const db = getFirestore();
const bucket = getStorage().bucket();

const PHOTO_STYLE = 'candid documentary photograph, shot on Sony A7IV with 85mm f/1.4 lens, shallow depth of field, natural realistic skin texture with visible pores, subtle film grain, true-to-life color grading, imperfect natural pose, no retouching, editorial music magazine photography';
const PROMPTS = [
  { prompt: `a male rock guitarist in his 30s playing a worn Fender Stratocaster in a dim recording studio, tungsten practical lamps glowing in the background, sweat on his brow, ${PHOTO_STYLE}`, category: 'Guitar' },
  { prompt: `a female guitarist with an acoustic guitar sitting by a large window in a home studio, soft overcast daylight, loose hair, denim jacket, mid-strum candid moment, ${PHOTO_STYLE}`, category: 'Guitar' },
  { prompt: `a veteran jazz guitarist in his 50s performing in a smoky small club, warm amber stage light, vintage Gibson archtop, eyes closed mid-solo, ${PHOTO_STYLE}`, category: 'Guitar' },
  { prompt: `a drummer in his 20s behind a modern drum kit in a rehearsal room, motion blur on the drumsticks, harsh fluorescent mixed with warm lamp light, band posters on the wall, ${PHOTO_STYLE}`, category: 'Drums' },
  { prompt: `a female drummer laughing behind a Pearl drum kit during a studio session break, natural window light from the side, drumsticks resting on the snare, ${PHOTO_STYLE}`, category: 'Drums' },
  { prompt: `an older jazz drummer with a vintage Gretsch kit in a wood-paneled studio, brushes in hand, warm afternoon light through blinds, ${PHOTO_STYLE}`, category: 'Drums' },
  { prompt: `a classical pianist in a dark suit at a grand piano in an empty concert hall, single warm stage light, hands on the keys, photographed from the side, ${PHOTO_STYLE}`, category: 'Piano' },
  { prompt: `a jazz pianist at an old Steinway in a dim basement club, cigarette-smoke haze in the air, moody low-key lighting, leaning into the keys, ${PHOTO_STYLE}`, category: 'Piano' },
  { prompt: `a young pianist with headphones around her neck at a digital piano in a cluttered bedroom studio, cables and coffee mug on the desk, warm desk lamp light, ${PHOTO_STYLE}`, category: 'Piano' },
  { prompt: `a female pop singer recording vocals in a booth, eyes closed behind a Neumann microphone with pop filter, headphones on, dim warm booth lighting, ${PHOTO_STYLE}`, category: 'Vocals' },
  { prompt: `a soul singer mid-performance on a small stage, gripping a vintage Shure 55 microphone, single dramatic spotlight, sweat glistening, audience blurred in darkness, ${PHOTO_STYLE}`, category: 'Vocals' },
  { prompt: `a jazz vocalist in an elegant evening dress at a supper club microphone, warm string lights bokeh behind her, mid-phrase expression, ${PHOTO_STYLE}`, category: 'Vocals' },
  { prompt: `a music producer at a large SSL mixing console in a dark control room, screens glowing, one hand on a fader, tired focused expression, ${PHOTO_STYLE}`, category: 'Production' },
  { prompt: `a female electronic music producer adjusting a modular synthesizer in a loft studio, LED and daylight mix, cables everywhere, candid working moment, ${PHOTO_STYLE}`, category: 'Production' },
  { prompt: `a rock producer in a mixing room full of vintage analog outboard gear, leaning back in his chair listening on studio monitors, warm practical lighting, ${PHOTO_STYLE}`, category: 'Production' },
];

const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

async function openaiGenerate(prompt) {
  if (!OPENAI_KEY) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1536', quality: 'high', n: 1 }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { console.warn(`  gpt-image-1 -> ${r.status} ${j.error?.message?.slice(0, 100) || ''}`); if (r.status === 429) { await new Promise(s => setTimeout(s, 15000)); continue; } return null; }
      const b64 = j.data?.[0]?.b64_json;
      if (!b64) return null;
      return { buf: Buffer.from(b64, 'base64'), tag: 'openai-gpt-image-1' };
    } catch (e) { console.warn(`  gpt-image-1 err: ${e.message}`); }
  }
  return null;
}

const MODELS = [
  { id: 'black-forest-labs/FLUX.1-dev', params: { width: 768, height: 1024, num_inference_steps: 28, guidance_scale: 3.5 }, tag: 'hf-flux-dev' },
  { id: 'black-forest-labs/FLUX.1-schnell', params: { width: 768, height: 1024 }, tag: 'hf-flux-schnell' },
];
async function hfGenerate(prompt) {
  if (!HF_TOKEN) return null;
  for (const { id, params, tag } of MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${id}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json', Accept: 'image/png' },
          body: JSON.stringify({ inputs: prompt, parameters: params }),
        });
        if (resp.status === 503) { await new Promise(r => setTimeout(r, 8000)); continue; } // model loading
        if (!resp.ok) { console.warn(`  ${id} -> ${resp.status}`); break; }
        const ct = resp.headers.get('content-type') || '';
        if (!ct.startsWith('image/')) break;
        return { buf: Buffer.from(await resp.arrayBuffer()), tag };
      } catch (e) { console.warn(`  ${id} err: ${e.message}`); }
    }
  }
  return null;
}

// Existing docs grouped by category — prefer the live (storage.googleapis.com) docs so we overwrite the same 15
const snap = await db.collection('musician_images').get();
const byCat = {};
snap.forEach(d => { const c = d.data().category || 'Other'; (byCat[c] ||= []).push({ ref: d.ref, live: (d.data().url || '').includes('storage.googleapis.com') }); });
for (const c of Object.keys(byCat)) byCat[c].sort((a, b) => Number(b.live) - Number(a.live));

const catCounter = {};
let ok = 0, fail = 0;
for (const { prompt, category } of PROMPTS) {
  const idx = catCounter[category] = (catCounter[category] || 0);
  catCounter[category]++;
  process.stdout.write(`[${category} #${idx + 1}] generating... `);
  const gen = (await openaiGenerate(prompt)) || (await hfGenerate(prompt));
  if (!gen) { console.log('FAILED'); fail++; continue; }

  const fileName = `musician-images/${category.toLowerCase()}-${idx + 1}-${Date.now()}.png`;
  const file = bucket.file(fileName);
  await file.save(gen.buf, { metadata: { contentType: 'image/png' }, public: true });
  const url = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

  const entry = (byCat[category] || [])[idx];
  if (entry) {
    await entry.ref.update({ url, prompt, provider: gen.tag, regeneratedAt: new Date().toISOString() });
    console.log(`OK [${gen.tag}] -> ${url} (updated ${entry.ref.id})`);
  } else {
    const nd = await db.collection('musician_images').add({ url, prompt, category, provider: gen.tag, createdAt: new Date().toISOString() });
    console.log(`OK [${gen.tag}] -> ${url} (new doc ${nd.id})`);
  }
  ok++;
  await new Promise(r => setTimeout(r, 1500)); // gentle on free tier
}
console.log(`\nDone: ${ok} ok, ${fail} failed`);
process.exit(0);
