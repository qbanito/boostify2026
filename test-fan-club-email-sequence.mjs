/**
 * Fan Club — spectacular email sequence TEST
 *
 * Sends a 4-email "fan journey" to a test inbox so you can preview the new
 * magazine-style HTML (artist hero image + brand gradient + signature CTA).
 *
 * Run:  node test-fan-club-email-sequence.mjs            (→ convoycubano@gmail.com)
 *       TEST_TO=you@mail.com node test-fan-club-email-sequence.mjs
 *
 * Uses the SAME builder + sender the live campaigns use (server/services/
 * fan-club-email.ts) so the preview is faithful. Artist data (name, image,
 * slug, genre) is pulled from Postgres for REDWINE CONTROL (id 1417); the brand
 * palette is loaded from the brand-profile service, with a tasteful fallback.
 */
import 'dotenv/config';
import pg from 'pg';

const TEST_TO = process.env.TEST_TO || 'convoycubano@gmail.com';
const ARTIST_ID = Number(process.env.TEST_ARTIST_ID || 1417);
const BASE_URL = process.env.PRODUCTION_URL || process.env.PUBLIC_URL || process.env.APP_URL || 'https://boostifymusic.com';

async function loadServices() {
  // The service is TypeScript ESM — run this file with tsx (see runner below).
  const mailMod = await import('./server/services/fan-club-email.ts');
  let loadBrandProfile = null;
  try {
    ({ loadBrandProfile } = await import('./server/services/artist-brand-profile.ts'));
  } catch { /* brand profile optional */ }
  return { ...mailMod, loadBrandProfile };
}

async function loadArtist() {
  const { Pool } = pg;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const r = await pool.query(
      `SELECT artist_name, username, slug, genre, profile_image_url, profile_image
         FROM users WHERE id = $1`,
      [ARTIST_ID],
    );
    const row = r.rows[0] || {};
    return {
      name: row.artist_name || row.username || 'The Artist',
      slug: row.slug || row.username || String(ARTIST_ID),
      genre: row.genre || undefined,
      imageUrl: row.profile_image_url || row.profile_image || undefined,
    };
  } finally {
    await pool.end();
  }
}

function buildSequence(artist, colors, profileUrl) {
  const unsubscribeUrl = `${BASE_URL}/api/fan-club/unsubscribe?token=PREVIEW`;
  const common = {
    artistName: artist.name,
    fanName: 'Alex',
    imageUrl: artist.imageUrl,
    unsubscribeUrl,
    profileUrl,
    genre: artist.genre,
    accentColor: colors.accent,
    primaryColor: colors.primary,
    secondaryColor: colors.secondary,
  };

  return [
    {
      ...common,
      eyebrow: 'Welcome to the inner circle',
      preheader: `You're officially in. Here's what being a ${artist.name} fan really means.`,
      headline: `You're In. Welcome to the Family.`,
      body:
        `I don't take this lightly — you chose to be part of my world, and that means everything to me.\n\n` +
        `From here on, you'll hear things first: unreleased songs, the stories behind the music, secret shows and little moments I don't share anywhere else.\n\n` +
        `No noise, no spam. Just me, the music, and the people who actually care. Thank you for being one of them.`,
      ctaLabel: 'Enter the Fan Club',
      ctaUrl: profileUrl + '#fanclub',
    },
    {
      ...common,
      eyebrow: 'New single · out now',
      preheader: `My new single is finally here — and you're hearing it before anyone else.`,
      headline: `My New Single Is Out — You Heard It First.`,
      body:
        `This one came from a long night and a feeling I couldn't shake. I poured everything into it, and tonight it's finally yours.\n\n` +
        `Because you're in the Fan Club, you get it before the rest of the world wakes up to it. Play it loud. Tell me what it makes you feel.\n\n` +
        `Your support is the only reason songs like this get to exist.`,
      ctaLabel: 'Listen now',
      ctaUrl: profileUrl,
    },
    {
      ...common,
      eyebrow: 'Live · fan presale',
      preheader: `I'm going on tour — and Fan Club members get first access to tickets.`,
      headline: `I'm Coming to Your City. You Get First Tickets.`,
      body:
        `There's nothing like being in the same room, sharing the same song at the same second. I've missed it.\n\n` +
        `So before tickets go public, I'm opening a private presale just for the Fan Club. You were here first, so you choose your seats first.\n\n` +
        `Come sing these songs with me. I'll be looking for you in the crowd.`,
      ctaLabel: 'Get presale access',
      ctaUrl: profileUrl + '#shows',
    },
    {
      ...common,
      eyebrow: 'Behind the scenes · members only',
      preheader: `A look inside the studio — the part of the process no one usually sees.`,
      headline: `Behind the Music: A Look You Won't See Anywhere Else.`,
      body:
        `I filmed something special for you — the messy, honest, beautiful process of making a record. The takes that didn't make it, the 3am breakthroughs, the doubts and the wins.\n\n` +
        `This is just for the Fan Club. It's my way of letting you all the way in.\n\n` +
        `Thank you for caring about the art and not just the noise. It means more than you know.`,
      ctaLabel: 'Watch the exclusive',
      ctaUrl: profileUrl + '#fanclub',
    },
  ];
}

async function main() {
  const svc = await loadServices();
  const artist = await loadArtist();
  const profileUrl = `${BASE_URL}/artist/${artist.slug}`;

  // Brand palette: prefer the artist's real brand profile, else a tasteful
  // Blues/gold default that fits REDWINE CONTROL.
  let colors = { primary: '#b8893b', secondary: '#5b1f24', accent: '#e8c98a' };
  if (svc.loadBrandProfile) {
    try {
      const bp = await svc.loadBrandProfile(ARTIST_ID);
      if (bp?.brandColors?.primary) {
        colors = {
          primary: bp.brandColors.primary,
          secondary: bp.brandColors.secondary || colors.secondary,
          accent: bp.brandColors.accent || bp.brandColors.primary,
        };
      }
    } catch { /* keep default */ }
  }

  console.log(`\n🎤 Artist: ${artist.name} (#${ARTIST_ID})  genre=${artist.genre || 'n/a'}`);
  console.log(`🖼️  Hero image: ${artist.imageUrl ? 'yes' : 'MISSING'}`);
  console.log(`🎨 Palette: ${colors.primary} / ${colors.secondary} / ${colors.accent}`);
  console.log(`📨 Sending sequence to: ${TEST_TO}\n`);

  const sequence = buildSequence(artist, colors, profileUrl);
  let ok = 0;
  for (let i = 0; i < sequence.length; i++) {
    const data = sequence[i];
    const subject = `[${i + 1}/${sequence.length}] ${data.headline}`;
    const html = svc.buildFanNewsEmail({ ...data, headline: data.headline });
    const result = await svc.sendFanNewsEmail(TEST_TO, subject, html, artist.name);
    if (result.success) {
      ok++;
      console.log(`✅ Email ${i + 1} sent  (${result.provider}, id=${result.messageId})  — "${data.eyebrow}"`);
    } else {
      console.log(`❌ Email ${i + 1} FAILED  — ${result.error}`);
    }
    // small gap to respect provider rate limits
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log(`\n📊 Done: ${ok}/${sequence.length} delivered to ${TEST_TO}\n`);
  process.exit(ok === sequence.length ? 0 : 1);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
