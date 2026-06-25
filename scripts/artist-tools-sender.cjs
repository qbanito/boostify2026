/**
 * 🚀 BOOSTIFY ARTIST TOOLS SENDER
 * --------------------------------------------------------------------------
 * Sells the Boostify ARTIST PROFILE tools to artists. Each email is focused
 * on ONE key tool (Lyric Video, AI Music Video, Smart Merch, 3D Store, Fan
 * Club, AI Avatar, Karaoke, Pro EPK...) with its concrete benefits + a real
 * example, an elegant graphic design, and an IRRESISTIBLE offer:
 *
 *      ⭐ 30 DAYS FREE · No card · No commitment ⭐
 *      → Activate your free Artist Profile at boostifymusic.com
 *
 * Bilingual: auto-detects LATAM / Spanish-speaking contacts → Spanish,
 * otherwise English (default).
 *
 * TARGET : artists audience in music_industry_contacts
 * PROVIDER: Resend (artist domains) with smart rotation; reply-to → convoycubano
 *
 * CLI:
 *   node scripts/artist-tools-sender.cjs --tool=lyrics_video --max=40 --preview=true
 *   node scripts/artist-tools-sender.cjs --tool=random --max=60
 *   node scripts/artist-tools-sender.cjs --tool=all --max=80          (rotate every tool)
 *   node scripts/artist-tools-sender.cjs --tool=smart_merch --lang=es --preview=true
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.secrets') });

const {
  fetchContacts,
  markContacted,
  getBestArtistProvider,
  sendWithResend,
  sendWithBrevo,
  recordSends,
  isMissingRelation,
} = require('./email-smart-router.cjs');

// ─── Args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  acc[k] = v === undefined ? 'true' : v;
  return acc;
}, {});

const TOOL_ARG     = args.tool || 'random';
const MAX_EMAILS   = parseInt(args.max || '40', 10);
const PREVIEW_MODE = args.preview === 'true';
const DRY_RUN      = args.dry === 'true';
const LANG_FORCE   = (args.lang || 'auto').toLowerCase(); // auto | en | es
const PREVIEW_EMAIL = 'convoycubano@gmail.com';
const COOLDOWN_DAYS = 7;

const PLATFORM_URL = 'https://www.boostifymusic.com';
const ACTIVATE_URL = 'https://www.boostifymusic.com';
const LOGO_URL = 'https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png';

// ─── Claim Loop — per-contact magic link ───────────────────────────────────────
// Mints a signed link to /claim so the recipient takes ownership of their
// pre-built AI profile in one click. Must match server verifyMagicLink():
// type 'artist_activation', same JWT secret fallback chain.
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'boostify-activation-2026';
function claimUrlFor(contact) {
  try {
    if (!contact || !contact.email || !contact.id) return ACTIVATE_URL;
    const name =
      contact.full_name || contact.fullName ||
      [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
      contact.first_name || '';
    const token = jwt.sign(
      { type: 'artist_activation', cid: contact.id, e: contact.email, n: name },
      JWT_SECRET,
      { expiresIn: '30d' },
    );
    return `${PLATFORM_URL}/claim?token=${token}`;
  } catch {
    return ACTIVATE_URL;
  }
}

// Real demo artists (images filled from DB at runtime via prefetchDemoImages).
const DEMO = {
  redwine: { name: 'REDWINE', slug: 'redwineli', url: 'https://www.boostifymusic.com/artist/redwineli', profile: null, cover: null },
  qbanito: { name: 'QBANITO', slug: 'qbanito-nocturnal', url: 'https://www.boostifymusic.com/artist/qbanito-nocturnal', profile: null, cover: null },
};
// Which demo artist illustrates each tool.
const TOOL_DEMO = { music_video: 'qbanito', avatar_talk: 'qbanito', karaoke: 'qbanito' };
const demoFor = (toolKey) => DEMO[TOOL_DEMO[toolKey] || 'redwine'];

// ─── Pool ─────────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
// Artist profile images live on the consolidated Neon DB (DATABASE_URL).
const neonPool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : pool;

async function prefetchDemoImages() {
  try {
    const slugs = Object.values(DEMO).map((d) => d.slug);
    const res = await neonPool.query(
      'SELECT slug, profile_image, cover_image FROM users WHERE slug = ANY($1)',
      [slugs]
    );
    for (const d of Object.values(DEMO)) {
      const row = res.rows.find((r) => r.slug === d.slug);
      if (row) {
        // Only keep URLs that are genuinely images (a cover_image can be an mp4/video → would break in <img>).
        d.profile = await validImageUrl(row.profile_image);
        d.cover = await validImageUrl(row.cover_image);
      }
    }
    console.log(`📸 Demo images: ${Object.values(DEMO).filter((d) => d.cover || d.profile).length}/${slugs.length} with a valid image`);
  } catch (e) {
    console.warn('⚠️  Could not prefetch demo images:', e.message);
  }
}

// Returns the URL only if it resolves to a real image (content-type image/*), else null.
async function validImageUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    let resp = await fetch(url, { method: 'HEAD' });
    let ct = (resp.headers.get('content-type') || '').toLowerCase();
    if (!ct) { // some CDNs don't return content-type on HEAD → fall back to GET
      resp = await fetch(url, { method: 'GET' });
      ct = (resp.headers.get('content-type') || '').toLowerCase();
    }
    return resp.ok && ct.startsWith('image/') ? url : null;
  } catch (_) {
    return null;
  }
}

// ─── LATAM language detection (country/state → email TLD → job title) ───────────
function isLatamContact(c) {
  const geo = `${c.country || ''} ${c.state || ''} ${c.city || ''}`.trim().toLowerCase();
  if (geo && /(m[eé]xic|colomb|argentin|chile|per[uú]|venezuel|ecuad|guatemal|\bcuba\b|boliv|dominic|hondur|paragu|el salvador|nicaragu|costa rica|panam|urugu|puerto ric|espa[nñ]|\bspain\b|\bmx\b|\bco\b|\bar\b|\bcl\b|\bpe\b|\bve\b|\bec\b|\bgt\b|\bcu\b|\bbo\b|\bdo\b|\bhn\b|\bpy\b|\bsv\b|\bni\b|\bcr\b|\bpa\b|\buy\b|\bpr\b|\bes\b)/.test(geo)) {
    return true;
  }
  const email = (c.email || '').toLowerCase();
  if (/\.(mx|co|ar|cl|pe|ve|ec|gt|cu|bo|do|hn|py|sv|ni|cr|pa|uy|es)(\b|$)/.test(email)) return true;
  const title = `${c.job_title || ''} ${c.company_name || ''}`.toLowerCase();
  if (/(directora|gerente|productor|representante|due[nñ]o|fundador|gesti[oó]n|m[uú]sica|sello|discogr[aá]fic|propietari|encargad|cantante|compositor)/.test(title)) return true;
  return false;
}

function pickLang(contact) {
  if (LANG_FORCE === 'es') return 'es';
  if (LANG_FORCE === 'en') return 'en';
  return isLatamContact(contact) ? 'es' : 'en';
}

// ─── TOOL CATALOG — each tool sells one key Artist Profile feature ──────────────
const TOOLS = {
  lyrics_video: {
    icon: '🎬', accent: '#7c3aed', accent2: '#c026d3',
    en: {
      name: 'Lyric Video Studio',
      tagline: 'Turn any song into a cinematic lyric video — in minutes.',
      hook: 'Your fans want to SEE your words, not just hear them. Boostify turns your track into a scroll-stopping animated lyric video automatically — synced, styled to your vibe, ready for YouTube, Reels & TikTok.',
      benefits: [
        'Auto-synced lyrics with cinematic motion backgrounds — no editor, no designer.',
        'Vertical + horizontal exports for TikTok, Reels, Shorts and YouTube at once.',
        'On-brand colors and typography pulled from your artist identity.',
      ],
      example: 'REDWINE turned “Vino con Sal” into a full animated lyric video on his profile — zero editing software, published straight to his fans.',
      cta: 'Create my first lyric video free',
    },
    es: {
      name: 'Estudio de Lyric Video',
      tagline: 'Convierte cualquier canción en un lyric video cinematográfico — en minutos.',
      hook: 'Tus fans quieren VER tu letra, no solo escucharla. Boostify convierte tu canción en un lyric video animado que detiene el scroll — sincronizado, con tu estilo, listo para YouTube, Reels y TikTok.',
      benefits: [
        'Letra auto-sincronizada con fondos cinematográficos en movimiento — sin editor, sin diseñador.',
        'Exporta vertical y horizontal para TikTok, Reels, Shorts y YouTube a la vez.',
        'Colores y tipografía alineados a tu identidad de artista.',
      ],
      example: 'REDWINE convirtió “Vino con Sal” en un lyric video animado completo en su perfil — sin programas de edición, publicado directo a sus fans.',
      cta: 'Crear mi primer lyric video gratis',
    },
  },
  music_video: {
    icon: '🎥', accent: '#dc2626', accent2: '#f97316',
    en: {
      name: 'AI Music Video Creator',
      tagline: 'A real music video for your song — directed by AI.',
      hook: 'No budget, no film crew, no problem. Describe your vision and Boostify generates a cinematic music video — scenes, shots and visual storytelling built around your track.',
      benefits: [
        'Cinematic AI scenes generated from your song mood and lyrics.',
        'Director-style shot sequencing — intros, drops, choruses, outros.',
        'Publish to your profile and socials with one click.',
      ],
      example: 'QBANITO launched a full visual world for “Nocturnal” without renting a single camera — straight from his Boostify profile.',
      cta: 'Generate my music video free',
    },
    es: {
      name: 'Creador de Video Musical con IA',
      tagline: 'Un video musical real para tu canción — dirigido por IA.',
      hook: 'Sin presupuesto, sin equipo de filmación, sin problema. Describe tu visión y Boostify genera un video musical cinematográfico — escenas, planos y narrativa visual alrededor de tu tema.',
      benefits: [
        'Escenas cinematográficas con IA generadas desde el mood y la letra de tu canción.',
        'Secuencia de planos estilo director — intros, drops, coros, outros.',
        'Publica en tu perfil y redes con un solo clic.',
      ],
      example: 'QBANITO lanzó todo un mundo visual para “Nocturnal” sin alquilar una sola cámara — directo desde su perfil de Boostify.',
      cta: 'Generar mi video musical gratis',
    },
  },
  smart_merch: {
    icon: '👕', accent: '#0891b2', accent2: '#22c55e',
    en: {
      name: 'Smart Merch Engine',
      tagline: 'Your own merch line — designed, mocked-up and ready to sell.',
      hook: 'Stop leaving money on the table. Boostify designs print-ready merch from your brand, builds the product mockups, and sets up your store — you just share the link.',
      benefits: [
        'AI-designed apparel & drops based on your music and aesthetic.',
        'Photoreal product mockups + automatic store — no supplier headaches.',
        'Every fan visit becomes a chance to buy, right on your profile.',
      ],
      example: 'Artists on Boostify sell hoodies, caps and vinyl straight from their profile — designs generated for them, no upfront cost.',
      cta: 'Build my merch line free',
    },
    es: {
      name: 'Motor de Merch Inteligente',
      tagline: 'Tu propia línea de merch — diseñada, con mockups y lista para vender.',
      hook: 'Deja de dejar dinero sobre la mesa. Boostify diseña merch lista para imprimir desde tu marca, crea los mockups y arma tu tienda — tú solo compartes el link.',
      benefits: [
        'Ropa y drops diseñados con IA según tu música y tu estética.',
        'Mockups de producto fotorrealistas + tienda automática — sin líos de proveedores.',
        'Cada visita de un fan se vuelve una oportunidad de compra, en tu perfil.',
      ],
      example: 'Artistas en Boostify venden hoodies, gorras y vinilos directo desde su perfil — con diseños generados para ellos, sin costo inicial.',
      cta: 'Crear mi línea de merch gratis',
    },
  },
  store_3d: {
    icon: '🛍️', accent: '#9333ea', accent2: '#ec4899',
    en: {
      name: 'Virtual 3D Store',
      tagline: 'An immersive 3D boutique for your music & merch.',
      hook: 'Give your fans an experience they will never forget — a luxury 3D store with your avatar inside, your art on the walls, and your products on display.',
      benefits: [
        'Walk-in 3D boutique branded to your colors and genre.',
        'Your products showcased on glowing pedestals — fans click to buy.',
        'A premium feel that makes your project look major-label.',
      ],
      example: 'REDWINE’s profile opens into a 3D boutique with his avatar, gallery art and products on neon pedestals — a true “other level” experience.',
      cta: 'Open my 3D store free',
    },
    es: {
      name: 'Tienda Virtual 3D',
      tagline: 'Una boutique 3D inmersiva para tu música y tu merch.',
      hook: 'Dale a tus fans una experiencia que nunca olvidarán — una tienda 3D de lujo con tu avatar dentro, tu arte en las paredes y tus productos en exhibición.',
      benefits: [
        'Boutique 3D para “entrar” con los colores y el género de tu marca.',
        'Tus productos exhibidos en pedestales luminosos — los fans hacen clic para comprar.',
        'Una sensación premium que hace ver tu proyecto como de major label.',
      ],
      example: 'El perfil de REDWINE abre en una boutique 3D con su avatar, arte de galería y productos en pedestales neón — una experiencia de “otro nivel”.',
      cta: 'Abrir mi tienda 3D gratis',
    },
  },
  fan_club: {
    icon: '💎', accent: '#d97706', accent2: '#facc15',
    en: {
      name: 'Fan Club & Monetization',
      tagline: 'Turn listeners into paying superfans.',
      hook: 'Your most loyal fans want to support you directly. Boostify gives you a built-in fan club with memberships, exclusive content and campaigns — recurring income, on your terms.',
      benefits: [
        'Membership tiers with exclusive drops, messages and perks.',
        'Direct fan support — no middleman taking your cut.',
        'Campaigns and leads that grow your audience automatically.',
      ],
      example: 'Boostify artists collect fan leads and run club campaigns from one dashboard — turning plays into real, recurring revenue.',
      cta: 'Launch my fan club free',
    },
    es: {
      name: 'Fan Club y Monetización',
      tagline: 'Convierte oyentes en superfans que pagan.',
      hook: 'Tus fans más leales quieren apoyarte directamente. Boostify te da un fan club integrado con membresías, contenido exclusivo y campañas — ingresos recurrentes, en tus términos.',
      benefits: [
        'Niveles de membresía con drops exclusivos, mensajes y beneficios.',
        'Apoyo directo de los fans — sin intermediario que se lleve tu parte.',
        'Campañas y leads que hacen crecer tu audiencia automáticamente.',
      ],
      example: 'Artistas en Boostify capturan leads de fans y lanzan campañas de club desde un panel — convirtiendo reproducciones en ingresos reales y recurrentes.',
      cta: 'Lanzar mi fan club gratis',
    },
  },
  avatar_talk: {
    icon: '🗣️', accent: '#2563eb', accent2: '#06b6d4',
    en: {
      name: 'Talk-to-Me AI Avatar',
      tagline: 'A talking AI version of you — for your fans, 24/7.',
      hook: 'Imagine your fans chatting with YOU at any hour. Boostify gives your profile a talking AI avatar with your voice and personality that answers fans, shares your story and keeps them hooked.',
      benefits: [
        'Lifelike avatar that speaks in your voice and style.',
        'Answers fan questions and tells your story around the clock.',
        'Deeper connection = more streams, more loyalty.',
      ],
      example: 'Boostify profiles feature a talking avatar that greets visitors and talks about the music — your presence, even while you sleep.',
      cta: 'Activate my AI avatar free',
    },
    es: {
      name: 'Avatar IA Talk-to-Me',
      tagline: 'Una versión IA de ti que habla — para tus fans, 24/7.',
      hook: 'Imagina a tus fans conversando CONTIGO a cualquier hora. Boostify le da a tu perfil un avatar IA que habla con tu voz y personalidad, responde a los fans, cuenta tu historia y los mantiene enganchados.',
      benefits: [
        'Avatar realista que habla con tu voz y tu estilo.',
        'Responde preguntas de los fans y cuenta tu historia las 24 horas.',
        'Conexión más profunda = más reproducciones, más lealtad.',
      ],
      example: 'Los perfiles de Boostify incluyen un avatar que habla, saluda a los visitantes y cuenta sobre la música — tu presencia, incluso mientras duermes.',
      cta: 'Activar mi avatar IA gratis',
    },
  },
  karaoke: {
    icon: '🎤', accent: '#db2777', accent2: '#8b5cf6',
    en: {
      name: 'Karaoke Maker',
      tagline: 'Turn your song into a karaoke fans can sing.',
      hook: 'Want your fans singing your lyrics back to you? Boostify generates an instrumental + synced karaoke video from your track — the ultimate engagement and viral hook.',
      benefits: [
        'Automatic instrumental + word-by-word synced lyrics.',
        'Shareable karaoke clips built for TikTok & Reels challenges.',
        'Fans participating = your song spreading itself.',
      ],
      example: 'Boostify artists drop karaoke versions of their hits so fans can duet and post — fuelling viral, fan-made reach.',
      cta: 'Make my karaoke free',
    },
    es: {
      name: 'Creador de Karaoke',
      tagline: 'Convierte tu canción en un karaoke que tus fans pueden cantar.',
      hook: '¿Quieres a tus fans cantando tu letra? Boostify genera un instrumental + video karaoke sincronizado desde tu tema — el gancho viral y de engagement definitivo.',
      benefits: [
        'Instrumental automático + letra sincronizada palabra por palabra.',
        'Clips de karaoke listos para retos de TikTok y Reels.',
        'Fans participando = tu canción difundiéndose sola.',
      ],
      example: 'Artistas en Boostify lanzan versiones karaoke de sus hits para que los fans hagan dúo y publiquen — impulsando alcance viral hecho por fans.',
      cta: 'Crear mi karaoke gratis',
    },
  },
  epk: {
    icon: '📁', accent: '#0d9488', accent2: '#3b82f6',
    en: {
      name: 'Pro EPK & Smart Link',
      tagline: 'One professional link with everything you are.',
      hook: 'Stop sending messy links. Boostify builds you a stunning press kit + smart link — your music, bio, photos, stats and contact in one place that makes labels and bookers take you seriously.',
      benefits: [
        'Beautiful auto-built EPK with your bio, releases and visuals.',
        'A single smart link to all your platforms and content.',
        'Looks pro to labels, bookers, press and brands.',
      ],
      example: 'Artists send one Boostify link instead of ten — and instantly look like an established act, not a hobbyist.',
      cta: 'Build my pro EPK free',
    },
    es: {
      name: 'EPK Pro y Smart Link',
      tagline: 'Un solo link profesional con todo lo que eres.',
      hook: 'Deja de enviar links desordenados. Boostify te arma un press kit + smart link impresionante — tu música, bio, fotos, stats y contacto en un solo lugar que hace que sellos y bookers te tomen en serio.',
      benefits: [
        'EPK precioso auto-generado con tu bio, lanzamientos y visuales.',
        'Un único smart link a todas tus plataformas y contenido.',
        'Se ve profesional ante sellos, bookers, prensa y marcas.',
      ],
      example: 'Los artistas envían un solo link de Boostify en lugar de diez — y se ven al instante como un acto establecido, no un aficionado.',
      cta: 'Crear mi EPK pro gratis',
    },
  },
};

const TOOL_KEYS = Object.keys(TOOLS);
const pickToolKey = () => TOOL_KEYS[Math.floor(Math.random() * TOOL_KEYS.length)];

function resolveToolList(arg) {
  if (arg === 'all') return TOOL_KEYS.slice();
  if (arg === 'random' || !TOOLS[arg]) return null; // null → pick per recipient
  return [arg];
}

// ─── Copy strings (bilingual chrome around the tool) ───────────────────────────
const STRINGS = {
  en: {
    brandKicker: 'BOOSTIFY MUSIC · ARTIST PROFILE',
    greeting: (n) => `Hi ${n},`,
    intro: 'You make the music. Boostify gives you the tools the big artists pay teams for — built into one Artist Profile.',
    benefitsTitle: 'WHAT IT DOES FOR YOU',
    exampleTitle: 'REAL EXAMPLE',
    offerKicker: 'IRRESISTIBLE OFFER',
    offerTitle: '30 DAYS FREE',
    offerSub: 'No card. No commitment. Cancel anytime.',
    activate: 'ACTIVATE MY FREE ARTIST PROFILE',
    moreTools: 'This is just 1 of 20+ tools inside your Artist Profile — videos, merch, 3D store, fan club, AI avatar & more.',
    seeLive: 'See a live artist profile',
    ps: 'P.S. It takes 2 minutes to set up and your first creation is free. What would you make first?',
    signoff: 'Neiver Alvarez',
    signTitle: 'Founder & CEO, Boostify Music',
    unsub: 'You received this because you are an artist in our network. To stop, reply “REMOVE”.',
  },
  es: {
    brandKicker: 'BOOSTIFY MUSIC · ARTIST PROFILE',
    greeting: (n) => `Hola ${n},`,
    intro: 'Tú haces la música. Boostify te da las herramientas por las que los grandes artistas pagan equipos enteros — todo dentro de un solo Artist Profile.',
    benefitsTitle: 'LO QUE HACE POR TI',
    exampleTitle: 'EJEMPLO REAL',
    offerKicker: 'OFERTA IRRESISTIBLE',
    offerTitle: '30 DÍAS GRATIS',
    offerSub: 'Sin tarjeta. Sin compromiso. Cancela cuando quieras.',
    activate: 'ACTIVAR GRATIS MI ARTIST PROFILE',
    moreTools: 'Esto es solo 1 de más de 20 herramientas dentro de tu Artist Profile — videos, merch, tienda 3D, fan club, avatar IA y más.',
    seeLive: 'Ver un perfil de artista en vivo',
    ps: 'P.D. Toma 2 minutos configurarlo y tu primera creación es gratis. ¿Qué harías primero?',
    signoff: 'Neiver Alvarez',
    signTitle: 'Fundador y CEO, Boostify Music',
    unsub: 'Recibes esto porque eres un artista en nuestra red. Para no recibir más, responde “REMOVE”.',
  },
};

// ─── Subject lines (bilingual, per tool) ───────────────────────────────────────
function buildSubject(toolKey, lang, contact) {
  const t = TOOLS[toolKey][lang];
  const icon = TOOLS[toolKey].icon;
  const name = contact.first_name || (lang === 'es' ? 'artista' : 'artist');
  const en = [
    `${name}, turn your song into a ${t.name.toLowerCase()} (free 30 days)`,
    `${icon} ${name} — your ${t.name} is ready to activate`,
    `${name}, the tool that does ${t.name} for you — free for 30 days`,
    `${name}, your Artist Profile + ${t.name} = 🔥 (no card needed)`,
    `${name}, see what your music looks like with ${t.name}`,
  ];
  const es = [
    `${name}, convierte tu canción con ${t.name} (30 días gratis)`,
    `${icon} ${name} — tu ${t.name} está listo para activar`,
    `${name}, la herramienta que hace ${t.name} por ti — 30 días gratis`,
    `${name}, tu Artist Profile + ${t.name} = 🔥 (sin tarjeta)`,
    `${name}, mira cómo se ve tu música con ${t.name}`,
  ];
  const list = lang === 'es' ? es : en;
  return list[Math.floor(Math.random() * list.length)];
}

// ─── Premium LIGHT graphic HTML email ──────────────────────────────────────────
function buildHtml(toolKey, lang, contact) {
  const tool = TOOLS[toolKey];
  const t = tool[lang];
  const S = STRINGS[lang];
  const firstName = contact.first_name || (lang === 'es' ? 'artista' : 'there');
  const demo = demoFor(toolKey);
  const ctaUrl = claimUrlFor(contact);
  const grad = `linear-gradient(135deg, ${tool.accent} 0%, ${tool.accent2} 100%)`;

  // Palette (LIGHT)
  const INK = '#0f172a', BODY = '#475569', MUTED = '#94a3b8', HAIR = '#e8eaf0', SOFT = '#f6f7fa';

  const benefitRows = t.benefits.map((b) => `
            <tr>
              <td valign="top" style="padding:9px 13px 9px 0;width:30px;">
                <div style="width:26px;height:26px;border-radius:50%;background:${grad};color:#fff;font-size:13px;font-weight:900;text-align:center;line-height:26px;font-family:Arial,sans-serif;">✓</div>
              </td>
              <td valign="top" style="padding:9px 0;font-size:14px;color:${BODY};font-family:Arial,sans-serif;line-height:1.6;">${b}</td>
            </tr>`).join('');

  // Real artist visual from DB. Prefer the portrait (profile = face, framed) so heads are never cut;
  // fall back to a valid cover. Both are pre-validated as real images (no broken/video sources).
  const heroImg = demo.profile || demo.cover;
  const visualBlock = heroImg ? `
    <tr><td style="padding:22px 30px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:16px;overflow:hidden;border:1px solid ${HAIR};">
        <tr><td style="padding:0;line-height:0;">
          <img src="${heroImg}" alt="${demo.name} on Boostify" width="540" style="width:100%;max-width:540px;height:260px;object-fit:cover;object-position:center top;display:block;background:#e8eaf0;" />
        </td></tr>
        <tr><td style="background:${INK};padding:13px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="font-size:12px;color:#cbd5e1;font-family:Arial,sans-serif;letter-spacing:0.5px;">${tool.icon}&nbsp; <strong style="color:#fff;">${demo.name}</strong> &middot; ${lang === 'es' ? 'artista real en Boostify' : 'real artist on Boostify'}</td>
            <td align="right"><a href="${demo.url}" style="font-size:12px;font-weight:700;color:${tool.accent2};text-decoration:none;font-family:Arial,sans-serif;">${S.seeLive} →</a></td>
          </tr></table>
        </td></tr>
      </table>
    </td></tr>` : '';

  const profileThumb = '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${t.name} — Boostify Music</title>
</head>
<body style="margin:0;padding:0;background:#eef0f4;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#eef0f4;">${t.tagline} — ${S.offerTitle}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef0f4;">
<tr><td align="center" style="padding:26px 12px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.10);border:1px solid #e8eaf0;">

    <!-- ACCENT TOP -->
    <tr><td style="height:5px;background:${grad};font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- BRAND BAR -->
    <tr><td style="padding:16px 30px;border-bottom:1px solid ${HAIR};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="font-size:11px;font-weight:800;letter-spacing:2.5px;color:#f97316;font-family:Arial,sans-serif;">🎵 ${S.brandKicker}</td>
        <td align="right" style="font-size:11px;color:${MUTED};font-family:Arial,sans-serif;">boostifymusic.com</td>
      </tr></table>
    </td></tr>

    <!-- HERO -->
    <tr><td style="padding:34px 30px 8px;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 16px;"><tr>
        <td style="width:66px;height:66px;border-radius:18px;background:${grad};text-align:center;vertical-align:middle;font-size:32px;line-height:66px;box-shadow:0 6px 18px ${tool.accent}40;">${tool.icon}</td>
      </tr></table>
      <h1 style="margin:0 0 8px;font-size:29px;font-weight:900;color:${INK};font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;line-height:1.2;">${t.name}</h1>
      <p style="margin:0;font-size:16px;color:${BODY};font-family:Georgia,'Times New Roman',serif;font-style:italic;line-height:1.5;">${t.tagline}</p>
    </td></tr>

    ${visualBlock}

    <!-- GREETING + INTRO -->
    <tr><td style="padding:26px 30px 0;">
      <p style="margin:0 0 12px;font-size:15px;color:${INK};font-family:Arial,sans-serif;line-height:1.6;">${S.greeting(firstName)}</p>
      <p style="margin:0;font-size:14px;color:${BODY};font-family:Arial,sans-serif;line-height:1.7;">${S.intro}</p>
    </td></tr>

    <!-- HOOK -->
    <tr><td style="padding:18px 30px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:${SOFT};border-left:4px solid ${tool.accent};border-radius:0 12px 12px 0;padding:18px 22px;">
          <p style="margin:0;font-size:15px;color:${INK};font-family:Arial,sans-serif;line-height:1.7;">${t.hook}</p>
        </td>
      </tr></table>
    </td></tr>

    <!-- BENEFITS -->
    <tr><td style="padding:26px 30px 0;">
      <p style="margin:0 0 8px;font-size:10px;font-weight:800;letter-spacing:2.5px;color:${tool.accent};font-family:Arial,sans-serif;">${S.benefitsTitle}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${benefitRows}
      </table>
    </td></tr>

    <!-- EXAMPLE -->
    <tr><td style="padding:24px 30px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:${SOFT};border:1px solid ${HAIR};border-radius:14px;padding:20px 22px;">
          <p style="margin:0 0 12px;font-size:10px;font-weight:800;letter-spacing:2.5px;color:#f97316;font-family:Arial,sans-serif;">${S.exampleTitle}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${profileThumb}
            <td valign="top">
              <p style="margin:0;font-size:14px;color:${BODY};font-family:Arial,sans-serif;line-height:1.7;">${t.example}</p>
              <p style="margin:10px 0 0;"><a href="${demo.url}" style="font-size:13px;color:${tool.accent};text-decoration:none;font-weight:700;font-family:Arial,sans-serif;">▶ ${S.seeLive} →</a></p>
            </td>
          </tr></table>
        </td>
      </tr></table>
    </td></tr>

    <!-- OFFER BANNER -->
    <tr><td style="padding:28px 30px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:${grad};border-radius:16px;padding:26px 24px;text-align:center;box-shadow:0 8px 22px ${tool.accent}33;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:800;letter-spacing:3px;color:rgba(255,255,255,0.9);font-family:Arial,sans-serif;">⭐ ${S.offerKicker} ⭐</p>
          <p style="margin:0 0 4px;font-size:38px;font-weight:900;color:#ffffff;font-family:Arial,Helvetica,sans-serif;letter-spacing:-1px;">${S.offerTitle}</p>
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.92);font-family:Arial,sans-serif;">${S.offerSub}</p>
        </td>
      </tr></table>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:24px 30px 6px;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>
        <td style="border-radius:12px;background:#f97316;box-shadow:0 6px 16px rgba(249,115,22,0.32);">
          <a href="${ctaUrl}" style="display:inline-block;padding:17px 40px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;letter-spacing:0.4px;border-radius:12px;">${S.activate} →</a>
        </td>
      </tr></table>
      <p style="margin:14px 0 0;font-size:12px;color:${MUTED};font-family:Arial,sans-serif;line-height:1.6;">${t.cta} · boostifymusic.com</p>
    </td></tr>

    <!-- MORE TOOLS -->
    <tr><td style="padding:22px 30px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="border-top:1px solid ${HAIR};padding-top:18px;">
          <p style="margin:0;font-size:13px;color:${BODY};font-family:Arial,sans-serif;line-height:1.7;text-align:center;">${S.moreTools}</p>
        </td>
      </tr></table>
    </td></tr>

    <!-- SIGNOFF -->
    <tr><td style="padding:22px 30px 0;">
      <p style="margin:0 0 14px;font-size:13px;color:${BODY};font-family:Arial,sans-serif;line-height:1.7;">${S.ps}</p>
      <p style="margin:0;font-size:14px;color:${INK};font-family:Arial,sans-serif;line-height:1.5;"><strong>${S.signoff}</strong><br><span style="color:${MUTED};font-size:12px;">${S.signTitle}</span></p>
    </td></tr>

    <!-- FOOTER -->
    <tr><td style="padding:26px 30px 30px;text-align:center;border-top:1px solid ${HAIR};margin-top:22px;">
      <p style="margin:14px 0 8px;font-size:16px;font-weight:900;color:#f97316;font-family:Arial,sans-serif;letter-spacing:1px;">🎵 BOOSTIFY MUSIC</p>
      <p style="margin:0 0 14px;font-size:11px;color:${MUTED};font-family:Arial,sans-serif;">${lang === 'es' ? 'La plataforma todo-en-uno para el artista moderno · IA · Video · Merch · Fans' : 'The all-in-one platform for the modern artist · AI · Video · Merch · Fans'}</p>
      <p style="margin:0;font-size:10px;color:#b6bcc8;font-family:Arial,sans-serif;line-height:1.7;">${S.unsub}<br>
      <a href="mailto:${PREVIEW_EMAIL}" style="color:${MUTED};text-decoration:underline;">${PREVIEW_EMAIL}</a></p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🚀 BOOSTIFY ARTIST TOOLS SENDER');
  console.log('━'.repeat(52));
  console.log(`Tool   : ${TOOL_ARG}`);
  console.log(`Max    : ${MAX_EMAILS}`);
  console.log(`Lang   : ${LANG_FORCE}`);
  console.log(`Preview: ${PREVIEW_MODE}`);
  console.log(`Dry    : ${DRY_RUN}\n`);

  await prefetchDemoImages();
  const provider = await getBestArtistProvider(pool);

  // PREVIEW — send one EN + one ES sample of the chosen (or first) tool
  if (PREVIEW_MODE) {
    const toolList = resolveToolList(TOOL_ARG);
    const toolKey = (toolList && toolList[0]) || 'lyrics_video';
    const samples = LANG_FORCE === 'es'
      ? [{ lang: 'es', contact: { first_name: 'Camila', country: 'Colombia', email: 'camila@demo.co' } }]
      : LANG_FORCE === 'en'
      ? [{ lang: 'en', contact: { first_name: 'Jordan', country: 'United States', email: 'jordan@demo.com' } }]
      : [
          { lang: 'en', contact: { first_name: 'Jordan', country: 'United States', email: 'jordan@demo.com' } },
          { lang: 'es', contact: { first_name: 'Camila', country: 'Colombia', email: 'camila@demo.co' } },
        ];
    let ok = 0;
    for (const s of samples) {
      const subject = buildSubject(toolKey, s.lang, s.contact);
      const html = buildHtml(toolKey, s.lang, s.contact);
      console.log(`📧 Preview [${s.lang.toUpperCase()}] tool=${toolKey} → ${PREVIEW_EMAIL}`);
      console.log(`   Subject: ${subject}`);
      if (DRY_RUN) { ok++; continue; }
      // Live path uses Resend; locally (no Resend key) fall back to Brevo so previews deliver.
      const res = provider.apiKey
        ? await sendWithResend({
            to: PREVIEW_EMAIL, subject, html,
            apiKey: provider.apiKey, fromEmail: provider.fromEmail,
            fromName: 'Neiver Alvarez · Boostify Music',
          })
        : await sendWithBrevo({
            to: PREVIEW_EMAIL, subject, html,
            fromEmail: 'info@boostifymusic.com',
            fromName: 'Neiver Alvarez · Boostify Music',
          });
      if (res.messageId) { ok++; console.log(`   ✅ sent (${res.messageId})`); }
      else console.log(`   ❌ ${res.error}`);
    }
    if (ok > 0 && !DRY_RUN) await recordSends(pool, provider.provider, ok);
    await closePools();
    return;
  }

  // LIVE — fetch artist contacts
  let contacts = [];
  try {
    contacts = await fetchContacts(pool, { audience: 'artists', limit: MAX_EMAILS, cooldownDays: COOLDOWN_DAYS });
  } catch (err) {
    if (isMissingRelation(err)) { console.error('❌ Contacts table missing:', err.message); }
    else throw err;
  }
  console.log(`👥 ${contacts.length} eligible artist contacts\n`);
  if (contacts.length === 0) { await closePools(); return; }

  const fixedToolList = resolveToolList(TOOL_ARG); // array or null (random per recipient)
  let sent = 0, failed = 0;

  // ── INTELLIGENT THROTTLE ────────────────────────────────────────────────
  // Never saturate a single Resend account. Each account has a safe daily cap
  // (70/day, see email-smart-router). We send only up to the *remaining* budget
  // for the active account, then rotate to the next account with capacity.
  // Tallies are persisted to email_daily_limits so every workflow shares the
  // same daily ledger and we never exceed the provider's hard 100/day limit.
  let active = provider;
  let budget = Math.max(0, active.remainingToday || 0);
  const sentByProvider = {}; // providerKey -> count pending persistence
  if (!active.apiKey || budget <= 0) {
    console.log('⚠️  No daily budget left on any artist provider — skipping run to protect deliverability.');
    await closePools();
    return;
  }
  console.log(`🧮 Daily budget on ${active.provider}: ${budget} sends remaining (safe cap)\n`);

  for (let i = 0; i < contacts.length; i++) {
    // Rotate to a fresh account when the active one's safe budget is spent.
    if (!DRY_RUN && budget <= 0) {
      if (sentByProvider[active.provider]) {
        await recordSends(pool, active.provider, sentByProvider[active.provider]);
        sentByProvider[active.provider] = 0; // persisted
      }
      const next = await getBestArtistProvider(pool);
      if (!next.apiKey || (next.remainingToday || 0) <= 0) {
        console.log('🛑 All artist accounts reached their safe daily limit — stopping to avoid saturation.');
        break;
      }
      active = next;
      budget = Math.max(0, active.remainingToday || 0);
      console.log(`🔄 Rotated to ${active.provider} (${budget} remaining)\n`);
    }

    const c = contacts[i];
    const lang = pickLang(c);
    const toolKey = fixedToolList ? fixedToolList[i % fixedToolList.length] : pickToolKey();
    const firstName = c.first_name || (lang === 'es' ? 'artista' : 'there');
    const subject = buildSubject(toolKey, lang, c);
    const html = buildHtml(toolKey, lang, c);

    console.log(`📧 [${i + 1}/${contacts.length}] ${firstName} <${c.email}> | ${lang.toUpperCase()} | ${toolKey} | via ${active.provider}`);

    if (DRY_RUN) { console.log(`   [dry] ${subject}`); continue; }

    const res = await sendWithResend({
      to: c.email, subject, html,
      apiKey: active.apiKey, fromEmail: active.fromEmail,
      fromName: 'Neiver Alvarez · Boostify Music',
    });
    if (res.messageId) {
      sent++; budget--;
      sentByProvider[active.provider] = (sentByProvider[active.provider] || 0) + 1;
      console.log(`   ✅ sent`);
      await markContacted(pool, c.id);
    } else {
      failed++;
      console.log(`   ❌ ${res.error}`);
      // A rate/quota error means this account is full → force rotation next loop.
      if (/rate|limit|429|quota|daily/i.test(res.error || '')) budget = 0;
    }
    await new Promise((r) => setTimeout(r, 900)); // gentle pacing
  }

  // Persist any per-account tallies not yet flushed during rotation.
  for (const [pk, n] of Object.entries(sentByProvider)) {
    if (n > 0) await recordSends(pool, pk, n);
  }
  console.log(`\n✅ Sent: ${sent} · ❌ Failed: ${failed}`);
  await closePools();
}

async function closePools() {
  await pool.end().catch(() => {});
  if (neonPool !== pool) await neonPool.end().catch(() => {});
}

main().catch((err) => {
  console.error('💥 Fatal:', err);
  closePools().finally(() => process.exit(1));
});
