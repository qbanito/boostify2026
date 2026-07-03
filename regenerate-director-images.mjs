// One-off: regenerate the 14 Featured Directors images with cinematic, on-set,
// style-representative portraits. Overwrites the SAME filenames in
// client/public/assets/generated_images/ (git-committed → reversible).
// Provider chain: OpenAI gpt-image-1 → FAL flux/schnell → HF FLUX.1-schnell (free).
// Usage: node regenerate-director-images.mjs [--only sofia-ramirez,david-kim]
import fs from "fs";
import path from "path";

// ── tiny .env loader ──
const envText = fs.readFileSync(new URL("./.env", import.meta.url), "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
}

const OUT_DIR = path.resolve("client/public/assets/generated_images");

const BASE_SUFFIX =
  "Cinematic film-still, shot on 35mm anamorphic lens, shallow depth of field, volumetric atmosphere, " +
  "rich film grain, photorealistic, editorial magazine quality, dramatic cinematic lighting. " +
  "The director is the clear hero of the frame, mid-shot or close portrait, looking confident and in command. " +
  "Absolutely no text, no words, no letters, no logos, no watermarks.";

const DIRECTORS = [
  {
    id: "sofia-ramirez",
    file: "sofia_ramirez_director_headshot_portrait.png",
    prompt:
      "A confident Latina woman film director in her 30s wearing an urban bomber jacket and gold chain, directing a hip-hop music video at night on a gritty city rooftop set. She stands low-angle framed like royalty beside a cinema camera on a tripod, pointing decisively at the skyline. Behind her: neon color pops, graffiti walls, city lights bokeh, a lit LED ring and film crew silhouettes. Palette: deep urban grays punched with vivid orange and magenta neon.",
  },
  {
    id: "marcus-chen",
    file: "marcus_chen_director_professional_headshot.png",
    prompt:
      "An East Asian man film director in his 30s with an effortless indie look (vintage jacket, film camera slung on shoulder), directing an alternative rock music video inside a raw brick warehouse stage. Tungsten practical bulbs and haze drift behind him, a drum kit and amps out of focus, he peers through a director's viewfinder with intense focus. Palette: warm amber tungsten against moody teal shadows, analog grain.",
  },
  {
    id: "isabella-moretti",
    file: "isabella_moretti_director_professional_portrait.png",
    prompt:
      "An elegant Italian woman film director in her 30s with fashion-forward tailoring, directing a glossy pop music video inside a high-end studio with a bold colored cyclorama backdrop. She gestures gracefully while reviewing a director's monitor, fashion strobes and softboxes glowing around her, stylists and a dancer blurred in the background. Palette: saturated candy pink, electric blue and glossy white, polished vogue-editorial light.",
  },
  {
    id: "david-kim",
    file: "david_kim_director_professional_headshot.png",
    prompt:
      "A Korean man film director in his 30s wearing sleek black techwear, directing an electronic techno music video inside a futuristic LED volume stage. Electric blue and neon purple panels wrap around him, laser lines cut through haze, he raises a hand cueing a take beside a robotic camera crane. Palette: electric blue, cyber magenta, chrome silver on deep void black — Blade Runner atmosphere.",
  },
  {
    id: "amara-johnson",
    file: "amara_johnson_director_professional_portrait.png",
    prompt:
      "A graceful Black woman film director in her 30s with natural hair and elegant earth-toned wardrobe, directing an intimate R&B music video in a sunlit loft during golden hour. Warm amber backlight halos her as she frames a shot with her hands, silk curtains and floating dust particles glow, a vintage cinema camera beside her. Palette: warm amber gold, deep burgundy velvet, champagne blush — soulful, romantic, deeply human light that honors her skin tone.",
  },
  {
    id: "carlos-rodriguez",
    file: "carlos_rodriguez_director_headshot_portrait.png",
    prompt:
      "A charismatic Latino man film director in his 30s in an open tropical-print shirt, directing a reggaeton music video at a vibrant street carnival set at dusk. He laughs commanding the scene beside a steadicam operator, dancers and confetti explode with motion blur behind him, string lights and a colorful mural glow. Palette: tropical turquoise, burning sunset orange, vibrant coral and golden yellow — pure celebratory energy.",
  },
  {
    id: "yuki-tanaka",
    file: "yuki_tanaka_director_professional_headshot.png",
    prompt:
      "A stylish Japanese woman film director in her late 20s with polished harajuku-inspired fashion, directing a K-pop music video inside an elaborate pastel concept set. She stands perfectly centered in a symmetrical candy-colored world of pink and sky-blue geometric set pieces, holding a clapperboard-style monitor, idol performers posed in flawless formation behind her. Palette: candy pastel pink, baby blue, soft lavender, holographic silver — immaculate, dreamlike polish.",
  },
  {
    id: "elena-petrov",
    file: "elena_petrov_director_professional_portrait.png",
    prompt:
      "A commanding Eastern European woman film director in her 40s in a long dramatic wool coat, directing an epic orchestral music video on a grand misty period film set at dawn. She stands on a camera crane platform gesturing across a fog-covered field with torches and costumed extras below, painterly golden light breaking through clouds like a classical painting. Palette: deep cinematic blue, burnished gold, aged burgundy — mythic, timeless scale.",
  },
  {
    id: "michael-brooks",
    file: "michael_brooks_director_professional_headshot.png",
    prompt:
      "A warm rugged American man film director in his 40s wearing denim and a felt hat, directing a country-folk music video in a golden wheat field at dusk. He leans against a vintage pickup truck mounted with a cinema camera, pointing toward the horizon, warm natural sunlight flaring across the frame, a guitarist silhouetted in the background. Palette: honey gold, dusty amber, faded denim blue — authentic Americana warmth.",
  },
  {
    id: "david-oconnor",
    file: "david_oconnor_director_professional_headshot.png",
    prompt:
      "A rugged Irish man film director in his 40s in a black leather jacket, directing a rock-metal music video on a dark concert stage engulfed in haze and pyrotechnic sparks. Hard rim light carves his profile as he yells action beside a smoke machine, a wall of amps and a drummer silhouette burning behind him, embers floating through the beam of a spotlight. Palette: charcoal black, molten orange sparks, steel blue rim light — raw power.",
  },
  {
    id: "elena-rodriguez",
    file: "elena_rodriguez_director_professional_portrait.png",
    prompt:
      "A radiant Latina woman film director in her 30s with bold statement earrings and vibrant wardrobe, directing a Latin music video on a carnival float set exploding with color. She dances while directing, one hand on a gimbal camera, confetti and feathered dancers in saturated motion behind her, golden string lights crisscrossing above. Palette: hot fuchsia, tropical turquoise, mango orange, electric lime — joyful, festival-bright cinematography.",
  },
  {
    id: "alex-thompson",
    file: "alex_thompson_director_professional_portrait.png",
    prompt:
      "A young creative white man film director in his late 20s wearing a quirky knitted sweater and round glasses, directing an indie-pop music video inside a whimsical handmade bedroom-pop set. Practical lamps, paper moons and pastel props surround him as he adjusts a vintage 16mm film camera, fairy lights bokeh everywhere. Palette: muted teal, dusty pastel pink, warm cream — handcrafted, dreamy, lo-fi charm.",
  },
  {
    id: "james-wilson",
    file: "james_wilson_director_headshot_portrait.png",
    prompt:
      "A distinguished Black man film director in his 40s in a tailored velvet blazer, directing a classic soul R&B music video inside a velvet-draped vintage studio. Warm smoke curls through a spotlight behind him as he listens on headphones beside a film camera, a golden vintage ribbon microphone and grand piano out of focus. Palette: deep burgundy velvet, warm brass gold, midnight blue — timeless Motown elegance.",
  },
  {
    id: "nina-patel",
    file: "nina_patel_director_professional_portrait.png",
    prompt:
      "A bold Indian woman film director in her 30s with modern festival techwear and statement jewelry, directing an electronic dance music video from atop a festival mainstage riser at night. Massive LED walls pulse magenta and cyan behind her, lasers fan over a blurred crowd as she signals the drop with raised arms beside a jib camera. Palette: neon magenta, electric cyan, ultraviolet — euphoric mainstage energy.",
  },
];

// ── providers ──
async function tryOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", quality: "high", n: 1 }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  return b64 ? Buffer.from(b64, "base64") : null;
}

async function tryFal(prompt) {
  const keys = [process.env.FAL_KEY || process.env.FAL_API_KEY, process.env.FAL_KEY_BACKUP].filter(Boolean);
  for (const key of keys) {
    const res = await fetch("https://fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, image_size: "square_hd", num_images: 1, enable_safety_checker: true }),
    });
    if (!res.ok) { console.warn(`  FAL ${res.status}`); continue; }
    const json = await res.json();
    const url = json?.images?.[0]?.url;
    if (!url) continue;
    const img = await fetch(url);
    if (img.ok) return Buffer.from(await img.arrayBuffer());
  }
  return null;
}

async function tryHF(prompt) {
  const key = process.env.HUGGINGFACE_TOKEN;
  if (!key) return null;
  const res = await fetch("https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "image/png" },
    body: JSON.stringify({ inputs: prompt }),
  });
  if (!res.ok) throw new Error(`HF ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function generateOne(d) {
  const fullPrompt = `${d.prompt} ${BASE_SUFFIX}`;
  const chain = [
    ["openai", tryOpenAI],
    ["fal", tryFal],
    ["hf", tryHF],
  ];
  for (const [name, fn] of chain) {
    try {
      const buf = await fn(fullPrompt);
      if (buf && buf.length > 20_000) {
        fs.writeFileSync(path.join(OUT_DIR, d.file), buf);
        console.log(`✅ ${d.id} via ${name} (${Math.round(buf.length / 1024)} KB)`);
        return true;
      }
      if (buf) console.warn(`  ${name} returned tiny buffer (${buf.length}b), skipping`);
    } catch (e) {
      console.warn(`  ${name} failed for ${d.id}: ${e.message}`);
    }
  }
  console.error(`❌ ${d.id}: ALL providers failed`);
  return false;
}

const onlyArg = process.argv.find((a) => a.startsWith("--only"));
const only = onlyArg ? (process.argv[process.argv.indexOf(onlyArg) + 1] || onlyArg.split("=")[1] || "").split(",").filter(Boolean) : null;
const list = only ? DIRECTORS.filter((d) => only.includes(d.id)) : DIRECTORS;

let ok = 0;
for (const d of list) {
  console.log(`\n🎬 Generating ${d.id}…`);
  if (await generateOne(d)) ok++;
}
console.log(`\nDone: ${ok}/${list.length} regenerated in ${OUT_DIR}`);
