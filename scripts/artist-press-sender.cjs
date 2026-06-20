/**
 * 🎤 BOOSTIFY ARTIST PRESS RELEASE SENDER
 * Sends personalized press release emails to music industry contacts
 * promoting Redwine & Qbanito landing pages on Boostify Music.
 *
 * TARGET: Labels, publishers, A&R, booking agents, managers, media, sync, PR
 * SOURCE: music_industry_contacts table (Supabase) — 2,458 contacts
 * PROVIDER: Brevo (industry contacts)
 * TRACKING: outreach_email_log
 *
 * CLI:
 *   node scripts/artist-press-sender.cjs --artist=redwine_vinoconsal --max=40 --preview=true
 *   node scripts/artist-press-sender.cjs --artist=qbanito_conciencia --max=30
 *   node scripts/artist-press-sender.cjs --artist=random --max=40
 *   node scripts/artist-press-sender.cjs --artist=redwine --max=40  (sends all 3 Redwine pages rotated)
 *   node scripts/artist-press-sender.cjs --artist=qbanito --max=40  (sends all 3 Qbanito pages rotated)
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.secrets') });

const { sendWithBrevo, recordSends, getBrevoQuota, REPLY_TO } = require('./email-smart-router.cjs');

// ─── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2).reduce((acc, a) => {
  const [k, v] = a.replace('--', '').split('=');
  acc[k] = v;
  return acc;
}, {});

const ARTIST_ARG    = args.artist || 'random';
const MAX_EMAILS    = parseInt(args.max || '40');
const PREVIEW_MODE  = args.preview === 'true';
const PREVIEW_EMAIL = 'convoycubano@gmail.com';
const DRY_RUN       = args.dry === 'true';
const CAMPAIGN_ID   = args.campaign || `press_${Date.now()}`;

// ─── Supabase pool (leads + outreach log) ─────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});

// ─── NeonDB pool (artist profile images) ──────────────────────────────────────
const neonPool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
}) : null;

const artistImages = {}; // cache: slug → imageUrl

async function prefetchArtistImages() {
  if (!neonPool) { console.warn('⚠️  DATABASE_URL not set — no profile images'); return; }
  const slugs = Object.keys(ARTIST_ROSTER);
  try {
    const client = await neonPool.connect();
    try {
      const res = await client.query(
        'SELECT slug, profile_image FROM users WHERE slug = ANY($1)',
        [slugs]
      );
      res.rows.forEach(r => { if (r.profile_image) artistImages[r.slug] = r.profile_image; });
      console.log(`📸 Artist images loaded: ${Object.keys(artistImages).length}/${slugs.length}`);
    } finally {
      client.release();
    }
  } catch (err) {
    console.warn('⚠️  Could not fetch artist images:', err.message);
  }
}

// ─── Artist Roster ─────────────────────────────────────────────────────────────
const ARTIST_ROSTER = {
  // ── REDWINE ─────────────────────────────────────────────────────────────────
  redwine_vinoconsal: {
    slug:       'redwine_vinoconsal',
    name:       'Redwine',
    project:    'Vino con Sal',
    tagline:    'From the Streets of Miami to the World Stage',
    genre:      'Pop · Hip-Hop · Reggaeton · R&B',
    origin:     'Miami, FL',
    bio:        'Redwine is a multifaceted artist from Miami whose music spans pop, hip-hop, reggaeton, and R&B. Born from the cultural melting pot of South Florida, his sound blends authentic street poetry with polished modern production — captivating audiences across the US and Latin America. "Vino con Sal" captures the raw, real side of his artistry.',
    featuredSong: 'Vino con Sal (Title Track)',
    pitchLine:  'A Miami-bred artist crossing genre boundaries with radio-ready sound and undeniable commercial appeal.',
    url:        'https://boostifymusic.com/artist/redwine_vinoconsal',
    ig:         '@redwine_official',
    youtubeKeyword: 'Redwine Vino con Sal',
    tags:       ['#Miami', '#Reggaeton', '#PopLatino', '#HipHop', '#NewArtist'],
    color:      '#c0392b',      // deep wine red
    coverEmoji: '🍷',
  },
  redwine_lifevol2: {
    slug:       'redwine_lifevol2',
    name:       'Redwine',
    project:    'Life Vol. II',
    tagline:    'The Evolution Continues — Life, Raw and Unfiltered',
    genre:      'Pop · R&B · Reggaeton · Urban',
    origin:     'Miami, FL',
    bio:        'Life Vol. II is the next chapter of Redwine\'s artistic journey — a deeply personal collection that marries urban sensibility with emotional depth. Produced in Miami\'s vibrant underground scene, this project showcases Redwine\'s evolution as a songwriter and performer, pushing boundaries while staying authentic to his roots.',
    featuredSong: 'Life Vol. II (Album Single)',
    pitchLine:  'A conceptual project that blends introspection with infectious hooks — Redwine\'s most ambitious work yet.',
    url:        'https://boostifymusic.com/artist/redwine_lifevol2',
    ig:         '@redwinevol2',
    youtubeKeyword: 'Redwine Life Vol 2',
    tags:       ['#Miami', '#R&B', '#UrbanPop', '#Songwriter', '#IndieArtist'],
    color:      '#8b0000',
    coverEmoji: '🎵',
  },
  redwineli: {
    slug:       'redwineli',
    name:       'Redwine',
    project:    'Redwine Li — Full Catalog',
    tagline:    'One Artist. Infinite Sounds.',
    genre:      'Pop · Blues · Hip-Hop · Electronic · Reggaeton',
    origin:     'Miami, FL',
    bio:        'Redwine is a genre-defying powerhouse from Miami, Florida. With a vocal range that moves seamlessly from soulful blues to trap-influenced hip-hop and radio-ready pop, he has built a loyal audience drawn to his fearless experimentation. His Boostify page is a curated portal into his entire universe — from debut records to latest drops.',
    featuredSong: 'Latest Release',
    pitchLine:  'One of Miami\'s most versatile emerging artists — a 360° talent ready for major label attention.',
    url:        'https://boostifymusic.com/artist/redwineli',
    ig:         '@redwine_official',
    youtubeKeyword: 'Redwine Miami music',
    tags:       ['#Miami', '#MultiGenre', '#Blues', '#TrapSoul', '#ElectronicPop'],
    color:      '#6d0000',
    coverEmoji: '🎤',
  },
  // ── QBANITO ─────────────────────────────────────────────────────────────────
  'qbanito-nocturnal': {
    slug:       'qbanito-nocturnal',
    name:       'Qbanito',
    project:    'Nocturnal',
    tagline:    'After Midnight, the City Belongs to Qbanito',
    genre:      'Electronic · Dark Pop · Urban · Synthwave',
    origin:     'Miami, FL',
    bio:        'Nocturnal is Qbanito\'s electrifying foray into nocturnal soundscapes — a dark, cinematic project that fuses electronic production with urban lyricism. Inspired by Miami\'s neon-lit nights and the raw energy of its underground club circuit, this project is a bold statement of artistic vision and commercial viability.',
    featuredSong: 'Nocturnal Pressure (Lead Single)',
    pitchLine:  'Dark electronic beats meet street-level storytelling — a perfect fit for sync placements and tastemaker playlists.',
    url:        'https://boostifymusic.com/artist/qbanito-nocturnal',
    ig:         '@neiver.creative',
    youtubeKeyword: 'Qbanito Nocturnal Miami',
    tags:       ['#Electronic', '#DarkPop', '#Synthwave', '#Miami', '#SyncReady'],
    color:      '#1a1a2e',
    coverEmoji: '🌙',
  },
  qbanito_conciencia: {
    slug:       'qbanito_conciencia',
    name:       'Qbanito',
    project:    'Conciencia',
    tagline:    'The Rhythm of Awakening — Where Afrobeat Meets the Street',
    genre:      'Afrobeat · Deep House · Urban · Conscious Hip-Hop',
    origin:     'Miami, FL',
    bio:        '"Conciencia" is Qbanito\'s most socially conscious work — a cinematic journey through inequality, forgotten youth, and the urgent need for collective awakening. Blending afrobeat grooves, deep house textures, and urban realism, this album moves both the body and the mind. Critically acclaimed for its fearless honesty and irresistible danceability.',
    featuredSong: 'Minuit Caliente (ft. Vocal)',
    pitchLine:  'Afrobeat-driven conscious music with global crossover appeal — think Burna Boy meets J. Cole in Miami.',
    url:        'https://boostifymusic.com/artist/qbanito_conciencia',
    ig:         '@neiver.creative',
    youtubeKeyword: 'Qbanito Conciencia afrobeat',
    tags:       ['#Afrobeat', '#DeepHouse', '#ConsciousHipHop', '#Miami', '#Global'],
    color:      '#1a5276',
    coverEmoji: '🌍',
  },
  qbanitobollwood: {
    slug:       'qbanitobollwood',
    name:       'Qbanito',
    project:    'Latin Bollywood',
    tagline:    'Where Bollywood Glamour Meets Latin Fire',
    genre:      'Latin Bollywood · Reggaeton · Pop Fusion · World Music',
    origin:     'Miami, FL',
    bio:        'Qbanito\'s "Latin Bollywood" is a truly unique cross-cultural explosion — merging the cinematic grandeur of Bollywood with the infectious rhythms of Latin urban music. A visionary project that targets dual global markets (Latin America & South Asia) simultaneously, representing an untapped fusion opportunity with massive streaming potential.',
    featuredSong: 'Baila Pa Mi — Fuego Mundial',
    pitchLine:  'First-mover in the Latin-Bollywood fusion space — targeting 2 billion listeners across Latin America and South Asia.',
    url:        'https://boostifymusic.com/artist/qbanitobollwood',
    ig:         '@neiver.creative',
    youtubeKeyword: 'Qbanito Latin Bollywood',
    tags:       ['#LatinBollywood', '#Fusion', '#WorldMusic', '#Reggaeton', '#BollywoodPop'],
    color:      '#7d3c98',
    coverEmoji: '🎬',
  },
};

// ─── Resolve which artist(s) to send ──────────────────────────────────────────
function resolveArtistList(arg) {
  if (arg === 'random') {
    const keys = Object.keys(ARTIST_ROSTER);
    return [ARTIST_ROSTER[keys[Math.floor(Math.random() * keys.length)]]];
  }
  if (arg === 'redwine') {
    return ['redwine_vinoconsal', 'redwine_lifevol2', 'redwineli'].map(k => ARTIST_ROSTER[k]);
  }
  if (arg === 'qbanito') {
    return ['qbanito-nocturnal', 'qbanito_conciencia', 'qbanitobollwood'].map(k => ARTIST_ROSTER[k]);
  }
  if (arg === 'all') return Object.values(ARTIST_ROSTER);
  if (ARTIST_ROSTER[arg]) return [ARTIST_ROSTER[arg]];
  console.error(`Unknown artist: "${arg}". Valid options: ${Object.keys(ARTIST_ROSTER).join(', ')}, redwine, qbanito, all, random`);
  process.exit(1);
}

// ─── Target industry categories ────────────────────────────────────────────────
const INDUSTRY_CATEGORIES = [
  'record_label', 'publishing', 'management', 'booking',
  'media', 'pr', 'sync', 'radio', 'distribution', 'streaming',
];

// ─── Fetch contacts ─────────────────────────────────────────────────────────────
async function fetchContacts(limit) {
  const client = await pool.connect();
  try {
    // Exclude already emailed for this campaign type AND bounced/unsubscribed
    const res = await client.query(`
      SELECT c.id, c.first_name, c.last_name, c.email, c.job_title, c.company_name, c.category, c.city, c.country
      FROM music_industry_contacts c
      WHERE c.email IS NOT NULL
        AND c.email != ''
        AND (c.status IS NULL OR c.status NOT IN ('bounced', 'unsubscribed', 'spam'))
        AND c.category = ANY($1)
        AND NOT EXISTS (
          SELECT 1 FROM outreach_email_log oel
          WHERE oel.contact_id = c.id
            AND oel.campaign_id LIKE 'artist_press_%'
            AND oel.status = 'sent'
            AND oel.sent_at > NOW() - INTERVAL '30 days'
        )
      ORDER BY RANDOM()
      LIMIT $2
    `, [INDUSTRY_CATEGORIES, limit]);
    return res.rows;
  } finally {
    client.release();
  }
}

// ─── Log sent email ────────────────────────────────────────────────────────────
async function logSend(contactId, toEmail, toName, subject, status, messageId = null, errorMsg = null) {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO outreach_email_log
        (campaign_id, contact_id, to_email, to_name, subject, status, brevo_message_id, error_message, sent_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    `, [`artist_press_${ARTIST_ARG}`, contactId, toEmail, toName, subject, status, messageId, errorMsg]);
  } finally {
    client.release();
  }
}

// ─── Email Template: Professional Press Release ─────────────────────────────────
function buildPressReleaseHtml(artist, recipientName, recipientCompany, imageUrl = null) {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const firstName = recipientName ? recipientName.split(' ')[0] : 'there';
  const companyLine = recipientCompany ? ` at <strong style="color:#1e293b;">${recipientCompany}</strong>` : '';
  const genreShort = artist.genre.split(' · ').slice(0, 2).join(' / ');
  const tagsHtml = [...artist.tags, `#${artist.origin.split(',')[0].trim()}`, '#BoostifyMusic']
    .map(t => `<span style="display:inline-block;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:20px;padding:3px 12px;font-size:11px;font-family:Arial,sans-serif;color:#64748b;margin:3px 2px;white-space:nowrap;">${t}</span>`).join('');
  const profileImg = imageUrl || 'https://boostifymusic.com/assets/freepik__boostify_music_organe_abstract_icon.png';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Press Release: ${artist.name} — ${artist.project}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">

<!-- PREHEADER -->
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#f0f2f5;">${artist.pitchLine} — ${artist.name} | ${artist.project} | Boostify Music Press</div>

<!-- WRAPPER -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2f5;">
<tr><td align="center" style="padding:28px 12px;">

  <!-- CARD -->
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

    <!-- TOP ORANGE BAR -->
    <tr>
      <td style="background:#f97316;padding:0;height:5px;font-size:0;line-height:0;">&nbsp;</td>
    </tr>

    <!-- BOOSTIFY BRANDING HEADER -->
    <tr>
      <td style="background:#0f172a;padding:24px 40px 20px;">
        <p style="margin:0;font-size:12px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#f97316;font-family:Arial,sans-serif;">🎵 BOOSTIFY MUSIC &nbsp;·&nbsp; ARTIST PRESS RELEASE</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
          <tr><td style="height:1px;background:linear-gradient(to right,#f97316,transparent);font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
        <p style="margin:10px 0 0;font-size:11px;color:#64748b;letter-spacing:1px;font-family:Arial,sans-serif;">${today} &nbsp;·&nbsp; ${artist.origin} &nbsp;·&nbsp; ${artist.genre.split(' · ')[0].toUpperCase()}</p>
      </td>
    </tr>

    <!-- ARTIST PROFILE IMAGE -->
    <tr>
      <td style="padding:0;background:#0f172a;line-height:0;">
        <img src="${profileImg}" alt="${artist.name} — ${artist.project}" width="600"
          style="width:100%;max-width:600px;height:300px;object-fit:cover;display:block;" />
      </td>
    </tr>

    <!-- ARTIST NAME SECTION -->
    <tr>
      <td style="background:#0f172a;padding:24px 40px 28px;border-top:3px solid ${artist.color};">
        <h1 style="margin:0 0 6px 0;font-size:32px;font-weight:900;color:#ffffff;line-height:1.2;font-family:Arial,Helvetica,sans-serif;letter-spacing:-0.5px;">${artist.name}</h1>
        <h2 style="margin:0 0 14px 0;font-size:18px;font-weight:400;color:${artist.color};font-style:italic;font-family:Georgia,'Times New Roman',serif;line-height:1.4;">&ldquo;${artist.project}&rdquo; &mdash; ${artist.tagline}</h2>
        <span style="display:inline-block;background:${artist.color}22;border:1px solid ${artist.color}55;border-radius:20px;padding:5px 16px;font-size:12px;color:${artist.color};font-family:Arial,sans-serif;font-weight:600;letter-spacing:0.5px;">${artist.genre}</span>
      </td>
    </tr>

    <!-- GREETING -->
    <tr>
      <td style="padding:32px 40px 0;background:#ffffff;">
        <p style="margin:0;font-size:15px;color:#334155;font-family:Arial,sans-serif;line-height:1.6;">Dear ${firstName}${companyLine},</p>
      </td>
    </tr>

    <!-- PITCH QUOTE -->
    <tr>
      <td style="padding:20px 40px 0;background:#ffffff;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:#fff7ed;border-left:4px solid #f97316;padding:18px 22px;border-radius:0 10px 10px 0;">
              <p style="margin:0;font-size:16px;color:#1e293b;font-style:italic;font-family:Georgia,'Times New Roman',serif;line-height:1.7;">&ldquo;${artist.pitchLine}&rdquo;</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- ARTIST OVERVIEW -->
    <tr>
      <td style="padding:28px 40px 0;background:#ffffff;">
        <p style="margin:0 0 10px 0;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#f97316;font-family:Arial,sans-serif;">ARTIST OVERVIEW</p>
        <p style="margin:0;font-size:14px;color:#475569;font-family:Arial,sans-serif;line-height:1.85;">${artist.bio}</p>
      </td>
    </tr>

    <!-- FEATURED RELEASE CARD -->
    <tr>
      <td style="padding:24px 40px 0;background:#ffffff;">
        <p style="margin:0 0 12px 0;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#f97316;font-family:Arial,sans-serif;">FEATURED RELEASE</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:#0f172a;border-radius:12px;padding:20px 24px;border-left:4px solid ${artist.color};">
              <p style="margin:0 0 6px 0;font-size:17px;font-weight:700;color:#ffffff;font-family:Arial,sans-serif;">&#127925;&nbsp; ${artist.featuredSong}</p>
              <p style="margin:0;font-size:13px;color:#94a3b8;font-family:Arial,sans-serif;">
                <strong style="color:#cbd5e1;">${artist.name}</strong> &nbsp;&middot;&nbsp; &ldquo;${artist.project}&rdquo; &nbsp;&middot;&nbsp; ${genreShort}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- TAGS -->
    <tr>
      <td style="padding:20px 40px 0;background:#ffffff;">
        <p style="margin:0;">${tagsHtml}</p>
      </td>
    </tr>

    <!-- CTA BUTTON (Boostify orange) -->
    <tr>
      <td style="padding:32px 40px;background:#ffffff;text-align:center;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 14px;">
          <tr>
            <td style="border-radius:10px;background:#f97316;">
              <a href="${artist.url}" style="display:inline-block;padding:16px 44px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;letter-spacing:0.5px;border-radius:10px;">&#127908;&nbsp; VIEW OFFICIAL ARTIST PAGE</a>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:12px;color:#94a3b8;font-family:Arial,sans-serif;">
          <a href="${artist.url}" style="color:#f97316;text-decoration:none;">boostifymusic.com/artist/${artist.slug}</a>
          ${artist.ig ? `&nbsp;&middot;&nbsp; <a href="https://instagram.com/${artist.ig.replace('@','')}" style="color:#94a3b8;text-decoration:none;">${artist.ig}</a>` : ''}
        </p>
      </td>
    </tr>

    <!-- DIVIDER -->
    <tr>
      <td style="padding:0 40px;background:#ffffff;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="height:1px;background:#e2e8f0;font-size:0;line-height:0;">&nbsp;</td></tr>
        </table>
      </td>
    </tr>

    <!-- CONTACT SECTION -->
    <tr>
      <td style="padding:24px 40px 32px;background:#ffffff;">
        <p style="margin:0 0 12px 0;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#f97316;font-family:Arial,sans-serif;">PRESS CONTACT</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:3px 0;font-size:13px;font-family:Arial,sans-serif;color:#64748b;"><strong style="color:#1e293b;">Press Office:</strong>&nbsp; Boostify Music</td></tr>
          <tr><td style="padding:3px 0;font-size:13px;font-family:Arial,sans-serif;color:#64748b;"><strong style="color:#1e293b;">Email:</strong>&nbsp; <a href="mailto:artists@boostifymusic.com" style="color:#f97316;text-decoration:none;">artists@boostifymusic.com</a></td></tr>
          <tr><td style="padding:3px 0;font-size:13px;font-family:Arial,sans-serif;color:#64748b;"><strong style="color:#1e293b;">Website:</strong>&nbsp; <a href="https://boostifymusic.com" style="color:#f97316;text-decoration:none;">boostifymusic.com</a></td></tr>
          <tr><td style="padding:3px 0;font-size:13px;font-family:Arial,sans-serif;color:#64748b;"><strong style="color:#1e293b;">Artist Page:</strong>&nbsp; <a href="${artist.url}" style="color:#f97316;text-decoration:none;">${artist.url}</a></td></tr>
        </table>
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td style="background:#0f172a;padding:28px 40px;text-align:center;border-radius:0 0 16px 16px;border-top:3px solid #f97316;">
        <p style="margin:0 0 6px 0;font-size:18px;font-weight:900;color:#f97316;font-family:Arial,sans-serif;letter-spacing:1px;">🎵 BOOSTIFY MUSIC</p>
        <p style="margin:0 0 16px 0;font-size:11px;color:#475569;font-family:Arial,sans-serif;">The Next Generation Music Platform &nbsp;&middot;&nbsp; AI &middot; Distribution &middot; Artist Promotion</p>
        <p style="margin:0 0 16px 0;">
          <a href="https://boostifymusic.com" style="font-size:11px;color:#64748b;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px;">Platform</a>
          <a href="https://boostifymusic.com/news" style="font-size:11px;color:#64748b;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px;">News</a>
          <a href="https://boostifymusic.com/artists" style="font-size:11px;color:#64748b;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px;">Artists</a>
          <a href="mailto:artists@boostifymusic.com" style="font-size:11px;color:#64748b;text-decoration:none;font-family:Arial,sans-serif;margin:0 8px;">Contact</a>
        </p>
        <p style="margin:0;font-size:10px;color:#334155;font-family:Arial,sans-serif;line-height:1.7;">
          You are receiving this press release as a registered music industry professional.<br>
          To unsubscribe, reply with &ldquo;REMOVE&rdquo; to <a href="mailto:convoycubano@gmail.com" style="color:#475569;text-decoration:underline;">convoycubano@gmail.com</a>
        </p>
      </td>
    </tr>

  </table>
  <!-- END CARD -->

</td></tr>
</table>
<!-- END WRAPPER -->

</body>
</html>`;
}

// ─── Subject Line Generator ────────────────────────────────────────────────────
function buildSubject(artist, recipientName) {
  const subjects = [
    `[Press Release] ${artist.name} — "${artist.project}" | New Music from ${artist.origin}`,
    `PRESS RELEASE: ${artist.name} — ${artist.tagline}`,
    `Music Press: ${artist.name} Drops "${artist.project}" — ${artist.genre.split(' · ')[0]} · ${artist.origin}`,
    `FOR IMMEDIATE RELEASE: ${artist.name} — "${artist.project}" | Boostify Music`,
    `[New Artist Alert] ${artist.name} | "${artist.project}" | ${artist.genre.split(' · ').slice(0, 2).join(' / ')}`,
  ];
  return subjects[Math.floor(Math.random() * subjects.length)];
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🎤 BOOSTIFY ARTIST PRESS SENDER');
  console.log('━'.repeat(50));
  console.log(`Artist arg:   ${ARTIST_ARG}`);
  console.log(`Max emails:   ${MAX_EMAILS}`);
  console.log(`Preview mode: ${PREVIEW_MODE}`);
  console.log(`Campaign ID:  artist_press_${ARTIST_ARG}`);
  console.log('');

  // Prefetch artist profile images from NeonDB
  await prefetchArtistImages();

  // Check Brevo quota
  const quota = await getBrevoQuota(pool);
  console.log(`Brevo quota: ${quota.remainingToday} remaining`);
  if (quota.remainingToday < 5) {
    console.log('⚠️  Brevo quota exhausted for today. Exiting.');
    process.exit(0);
  }

  const available = Math.min(MAX_EMAILS, quota.remainingToday);

  // Resolve artist list
  const artistList = resolveArtistList(ARTIST_ARG);
  console.log(`Artists: ${artistList.map(a => a.slug).join(', ')}`);

  if (PREVIEW_MODE) {
    const artist = artistList[0];
    const html = buildPressReleaseHtml(artist, 'John Smith', 'Atlantic Records', artistImages[artist.slug] || null);
    const subject = buildSubject(artist, 'John Smith');
    console.log(`\n📧 PREVIEW MODE → sending to ${PREVIEW_EMAIL}`);
    console.log(`Subject: ${subject}`);
    const result = await sendWithBrevo({
      to:        PREVIEW_EMAIL,
      subject,
      html,
      fromEmail: 'artists@boostifymusic.com',
      fromName:  'Boostify Music Press',
    });
    if (result.messageId) {
      console.log('✅ Preview sent successfully! messageId:', result.messageId);
      await recordSends(pool, 'BREVO', 1);
    } else {
      console.log('❌ Preview failed:', result.error);
    }
    await pool.end();
    if (neonPool) await neonPool.end().catch(() => {});
    return;
  }

  // Fetch contacts
  console.log(`\nFetching up to ${available} industry contacts...`);
  const contacts = await fetchContacts(available);
  console.log(`Found ${contacts.length} eligible contacts`);

  if (contacts.length === 0) {
    console.log('No eligible contacts found. All may have been contacted recently.');
    await pool.end();
    if (neonPool) await neonPool.end().catch(() => {});
    return;
  }

  let sent = 0, failed = 0, skipped = 0;
  const perArtist = Math.ceil(contacts.length / artistList.length);

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    // Rotate through artists
    const artist = artistList[i % artistList.length];

    const toName = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Music Professional';
    const toEmail = contact.email;
    const subject = buildSubject(artist, toName);
    const html = buildPressReleaseHtml(artist, toName, contact.company_name, artistImages[artist.slug] || null);

    if (DRY_RUN) {
      console.log(`[DRY] Would send to: ${toEmail} | ${artist.slug} | ${subject}`);
      skipped++;
      continue;
    }

    try {
      const result = await sendWithBrevo({
        to:        toEmail,
        subject,
        html,
        fromEmail: 'artists@boostifymusic.com',
        fromName:  'Boostify Music Press',
      });

      if (result.messageId) {
        sent++;
        await logSend(contact.id, toEmail, toName, subject, 'sent', result.messageId);
        console.log(`✅ [${sent}] ${toEmail} → ${artist.slug}`);
      } else {
        failed++;
        await logSend(contact.id, toEmail, toName, subject, 'failed', null, result.error);
        console.log(`❌ [${failed}] ${toEmail} — ${result.error}`);
      }
    } catch (err) {
      failed++;
      await logSend(contact.id, toEmail, toName, subject, 'error', null, err.message);
      console.log(`💥 ${toEmail} — ${err.message}`);
    }

    // Rate limiting: 4 per second for Brevo safety
    if (i % 4 === 3) await new Promise(r => setTimeout(r, 1000));
  }

  // Record sends
  if (sent > 0) await recordSends(pool, 'BREVO', sent);
  if (neonPool) await neonPool.end().catch(() => {});

  console.log('\n' + '━'.repeat(50));
  console.log(`📊 CAMPAIGN COMPLETE`);
  console.log(`   ✅ Sent:    ${sent}`);
  console.log(`   ❌ Failed:  ${failed}`);
  console.log(`   ⏭  Skipped: ${skipped}`);
  console.log(`   🎨 Artists: ${artistList.map(a => a.project).join(', ')}`);
  console.log('━'.repeat(50));

  await pool.end();
}

main().catch(async (err) => {
  console.error('\n💥 Fatal error:', err.message);
  await pool.end().catch(() => {});
  if (neonPool) await neonPool.end().catch(() => {});
  process.exit(1);
});
