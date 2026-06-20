/**
 * Email Templates V2 — PREMIUM DESIGN
 * Rich HTML emails with gradient cards, feature grids, social proof,
 * testimonials, progress indicators, and direct signup CTAs.
 */

const PLATFORM_URL = process.env.BASE_URL || 'https://boostifymusic.com';
const SIGNUP_URL = `${PLATFORM_URL}/auth/register`;
const PRICING_URL = `${PLATFORM_URL}/pricing`;

// ─── Design tokens ────────────────────────────────────────────────
const C = {
  bg: '#050510', card: '#0d0d1f', border: '#1a1a3e',
  purple: '#8B5CF6', pink: '#EC4899', cyan: '#06B6D4',
  green: '#10B981', amber: '#F59E0B', red: '#EF4444',
  txt: '#ffffff', txt2: '#c4b5fd', muted: '#94a3b8', dim: '#64748b',
};
const G = {
  main: 'linear-gradient(135deg,#8B5CF6 0%,#EC4899 100%)',
  head: 'linear-gradient(135deg,#1e0533 0%,#0f0326 50%,#150520 100%)',
  card: 'linear-gradient(145deg,#13132b 0%,#0d0d1f 100%)',
  cta: 'linear-gradient(90deg,#8B5CF6 0%,#EC4899 50%,#8B5CF6 100%)',
  ctaG: 'linear-gradient(90deg,#10B981 0%,#06B6D4 100%)',
  ctaA: 'linear-gradient(90deg,#F59E0B 0%,#EF4444 100%)',
};

// ─── Reusable Components ──────────────────────────────────────────

function shell(body: string, opts: { unsub?: string; pre?: string } = {}): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="dark"><title>Boostify Music</title></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
${opts.pre ? `<div style="display:none;max-height:0;overflow:hidden;">${opts.pre}${'&zwnj;&nbsp;'.repeat(30)}</div>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:20px 10px 40px;"><tr><td align="center">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;border-radius:20px;overflow:hidden;border:1px solid ${C.border};box-shadow:0 25px 50px rgba(139,92,246,0.15);">
<!-- HEADER -->
<tr><td style="background:${G.head};padding:0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="height:4px;background:${G.main};"></td></tr>
    <tr><td style="padding:28px 36px 20px;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
        <td style="width:44px;height:44px;border-radius:12px;background:${G.main};text-align:center;vertical-align:middle;font-size:22px;line-height:44px;">🎵</td>
        <td style="padding-left:14px;">
          <div style="font-size:22px;font-weight:800;color:#fff;letter-spacing:1.5px;">BOOSTIFY</div>
          <div style="font-size:11px;color:${C.txt2};letter-spacing:3px;margin-top:-2px;">MUSIC PLATFORM</div>
        </td>
      </tr></table>
    </td></tr>
  </table>
</td></tr>
<!-- BODY -->
<tr><td style="background:${C.card};padding:0;">${body}</td></tr>
<!-- FOOTER -->
<tr><td style="background:${C.bg};padding:28px 36px;border-top:1px solid ${C.border};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="text-align:center;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
      <td style="padding:0 10px;"><a href="https://instagram.com/boostifymusic" style="color:${C.dim};font-size:12px;text-decoration:none;">Instagram</a></td>
      <td style="color:${C.border};">|</td>
      <td style="padding:0 10px;"><a href="https://twitter.com/boostifymusic" style="color:${C.dim};font-size:12px;text-decoration:none;">Twitter/X</a></td>
      <td style="color:${C.border};">|</td>
      <td style="padding:0 10px;"><a href="https://tiktok.com/@boostifymusic" style="color:${C.dim};font-size:12px;text-decoration:none;">TikTok</a></td>
    </tr></table>
    <p style="color:${C.dim};font-size:11px;margin:14px 0 0;">© 2026 Boostify Music Inc · Miami, FL</p>
    ${opts.unsub ? `<p style="margin:8px 0 0;"><a href="${opts.unsub}" style="color:${C.dim};font-size:10px;text-decoration:underline;">Unsubscribe from these emails</a></p>` : ''}
  </td></tr></table>
</td></tr>
</table></td></tr></table></body></html>`;
}

function hero(title: string, sub: string, emoji?: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${G.head};padding:32px 36px 28px;">
<tr><td style="text-align:center;">
  ${emoji ? `<div style="font-size:52px;margin-bottom:14px;">${emoji}</div>` : ''}
  <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;line-height:1.3;">${title}</h1>
  <p style="margin:12px auto 0;max-width:480px;color:${C.txt2};font-size:15px;line-height:1.6;">${sub}</p>
</td></tr></table>`;
}

function cta(text: string, url: string, v: 'p' | 'g' | 'a' = 'p'): string {
  const bg = v === 'g' ? G.ctaG : v === 'a' ? G.ctaA : G.cta;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 36px;">
<tr><td align="center">
  <a href="${url}" style="display:inline-block;background:${bg};color:#fff;text-decoration:none;padding:16px 48px;border-radius:12px;font-weight:700;font-size:16px;letter-spacing:0.5px;box-shadow:0 8px 25px rgba(139,92,246,0.3);">${text}</a>
</td></tr>
<tr><td align="center" style="padding-top:10px;"><span style="color:${C.dim};font-size:12px;">🔒 No credit card · Free forever plan · Cancel anytime</span></td></tr>
</table>`;
}

function grid(items: { icon: string; title: string; desc: string }[]): string {
  const rows: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const a = items[i], b = items[i + 1];
    const cell = (f: { icon: string; title: string; desc: string }) => `<td width="50%" style="padding:8px;vertical-align:top;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:1px solid ${C.border};border-radius:12px;padding:20px 16px;">
      <tr><td><div style="font-size:28px;margin-bottom:10px;">${f.icon}</div>
        <div style="color:#fff;font-size:14px;font-weight:700;margin-bottom:5px;">${f.title}</div>
        <div style="color:${C.muted};font-size:12px;line-height:1.5;">${f.desc}</div>
      </td></tr></table></td>`;
    rows.push(`<tr>${cell(a)}${b ? cell(b) : '<td width="50%"></td>'}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:4px 28px;">${rows.join('')}</table>`;
}

function stats(items: { value: string; label: string; color?: string }[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:8px 36px;"><tr>
${items.map(i => `<td style="text-align:center;padding:16px 8px;background:${C.bg};border:1px solid ${C.border};border-radius:12px;">
  <div style="font-size:28px;font-weight:800;color:${i.color || C.purple};">${i.value}</div>
  <div style="font-size:10px;color:${C.muted};margin-top:5px;text-transform:uppercase;letter-spacing:1px;">${i.label}</div>
</td>`).join('<td width="8"></td>')}
</tr></table>`;
}

function quote(name: string, role: string, text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:8px 36px;">
<tr><td style="background:${C.bg};border:1px solid ${C.border};border-left:3px solid ${C.purple};border-radius:12px;padding:20px 22px;">
  <p style="color:${C.txt2};font-size:14px;font-style:italic;line-height:1.6;margin:0 0 12px;">"${text}"</p>
  <p style="color:${C.muted};font-size:12px;margin:0;"><strong style="color:#fff;">${name}</strong> · ${role}</p>
</td></tr></table>`;
}

function section(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 36px 8px;">
<tr><td><h2 style="margin:0;color:#fff;font-size:18px;font-weight:700;">${text}</h2>
<div style="width:40px;height:3px;background:${G.main};border-radius:2px;margin-top:8px;"></div></td></tr></table>`;
}

function txt(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:12px 36px;">
<tr><td style="color:${C.muted};font-size:15px;line-height:1.7;">${html}</td></tr></table>`;
}

function checks(items: string[]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:8px 36px;">
${items.map(i => `<tr><td style="padding:7px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
  <td style="width:26px;height:26px;border-radius:50%;background:rgba(16,185,129,0.15);text-align:center;line-height:26px;font-size:13px;">✓</td>
  <td style="padding-left:12px;color:${C.txt2};font-size:14px;">${i}</td>
</tr></table></td></tr>`).join('')}</table>`;
}

function divider(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:8px 36px;"><tr><td style="border-top:1px solid ${C.border};"></td></tr></table>`;
}

function urgency(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:0 36px 8px;">
<tr><td style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:12px 18px;text-align:center;">
<span style="color:${C.red};font-size:13px;font-weight:700;">⏰ ${text}</span></td></tr></table>`;
}

function pricing(name: string, price: string, period: string, features: string[], hl: boolean, url: string): string {
  const brd = hl ? C.purple : C.border;
  const badge = hl ? `<div style="background:${G.main};color:#fff;font-size:10px;font-weight:700;padding:4px 12px;border-radius:4px;display:inline-block;margin-bottom:10px;letter-spacing:1px;">MOST POPULAR</div>` : '';
  return `<td width="33%" style="padding:6px;vertical-align:top;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:${hl ? '2' : '1'}px solid ${brd};border-radius:14px;padding:20px 12px;text-align:center;"><tr><td>
  ${badge}
  <div style="color:${C.txt2};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;">${name}</div>
  <div style="color:#fff;font-size:32px;font-weight:800;margin:8px 0 2px;">${price}</div>
  <div style="color:${C.dim};font-size:11px;margin-bottom:14px;">${period}</div>
  ${features.map(f => `<div style="color:${C.muted};font-size:11px;padding:3px 0;">✓ ${f}</div>`).join('')}
  <a href="${url}" style="display:inline-block;margin-top:14px;background:${hl ? G.main : C.border};color:#fff;padding:10px 20px;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">${hl ? 'Start Free Trial' : 'Choose Plan'}</a>
</td></tr></table></td>`;
}

// ─── Interface ────────────────────────────────────────────────────

export interface TemplateData {
  artistName: string;
  email: string;
  genre?: string;
  country?: string;
  spotifyUrl?: string;
  instagramHandle?: string;
  soundcloudUrl?: string;
  magicLinkUrl?: string;
  landingPageUrl?: string;
  unsubscribeUrl?: string;
}

function signupUrl(d: TemplateData): string {
  const p = new URLSearchParams();
  if (d.email) p.set('email', d.email);
  if (d.artistName) p.set('name', d.artistName);
  if (d.genre) p.set('genre', d.genre);
  p.set('ref', 'drip');
  return d.magicLinkUrl || `${SIGNUP_URL}?${p.toString()}`;
}

// ══════════════════════════════════════════════════════════════════
//  WELCOME COLD — 5 emails / 14 days
// ══════════════════════════════════════════════════════════════════

export function welcomeCold_step0(d: TemplateData): { subject: string; html: string } {
  const url = signupUrl(d);
  return { subject: `🎵 ${d.artistName}, we built you a free artist page`, html: shell([
    hero(`${d.artistName}, Your Free<br>Artist Page Is Ready`, `We discovered your ${d.genre || 'music'} and we're impressed. We pre-built a professional landing page just for you — claim it in 30 seconds.`, '🚀'),
    stats([
      { value: '12K+', label: 'Artists Active', color: C.purple },
      { value: '$0', label: 'Setup Cost', color: C.green },
      { value: '50', label: 'Free AI Credits', color: C.pink },
    ]),
    section('Everything included — 100% free'),
    grid([
      { icon: '🎨', title: 'Landing Page', desc: 'Professional page with music player, bio, and social links' },
      { icon: '🔗', title: 'Link-in-Bio', desc: 'Replace Linktree — one link for all your platforms and content' },
      { icon: '🤖', title: 'AI Art Generator', desc: '50 free credits to create album covers, graphics, and video clips' },
      { icon: '📊', title: 'Fan Analytics', desc: 'Track visitors, plays, clicks, and engagement in real-time' },
      { icon: '📱', title: 'QR Code', desc: 'Printable QR code for live shows, flyers, and business cards' },
      { icon: '🎵', title: 'Music Player', desc: 'Upload up to 3 songs with a beautiful embedded player' },
    ]),
    quote('María Santos', 'Indie Pop · 15K monthly listeners', 'I set up my Boostify page during a coffee break. Now it\'s my main link on Instagram — fans love it. The AI art tool blew my mind.'),
    cta('Create My Free Page →', url),
    txt(`<div style="text-align:center;color:${C.dim};font-size:12px;">Your reserved URL: <strong style="color:${C.purple};">boostifymusic.com/artist/${(d.artistName || 'you').toLowerCase().replace(/[^a-z0-9]+/g, '-')}</strong> — expires in 7 days</div>`),
  ].join(''), { unsub: d.unsubscribeUrl, pre: `We found your music and built you a free page — claim it now, ${d.artistName}` })};
}

export function welcomeCold_step1(d: TemplateData): { subject: string; html: string } {
  const url = signupUrl(d);
  return { subject: `${d.artistName}, here's what 12,000 artists get for free`, html: shell([
    hero('What 12,000 Artists Get<br>For $0/Month', `Boostify gives independent ${d.genre || 'music'} artists professional tools that labels charge thousands for.`),
    section('Your free plan includes'),
    checks([
      '<strong style="color:#fff;">Professional Landing Page</strong> — Custom URL, dark theme, responsive',
      '<strong style="color:#fff;">Music Player</strong> — Upload 3 songs, stream from your page',
      '<strong style="color:#fff;">Link-in-Bio Toolkit</strong> — Replace Linktree with unlimited links',
      '<strong style="color:#fff;">AI Album Art Gen.</strong> — Stunning covers from text prompts',
      '<strong style="color:#fff;">QR Code Generator</strong> — For live shows, merch inserts, promo',
      '<strong style="color:#fff;">Social Hub</strong> — All platforms in one page',
      '<strong style="color:#fff;">Fan Analytics</strong> — Visitors, plays, clicks, and geo data',
      '<strong style="color:#fff;">50 AI Credits</strong> — $5 value, free on signup',
    ]),
    divider(),
    txt(`Most artists stay on free and love it. Paid plans (<strong style="color:${C.purple};">$9.99/mo</strong>) add unlimited uploads, AI videos, merch stores, and growth tools. <strong style="color:#fff;">Zero pressure</strong> — free is free forever.`),
    quote('DJ Kripto', 'Electronic · Medellín', 'I was paying $15/mo for Linktree Pro + $10 for a website. Boostify replaced both for free AND gave me AI tools. No brainer.'),
    cta('Sign Up Free — 30 Seconds →', url, 'g'),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'Professional page, music player, AI art, analytics — all free' })};
}

export function welcomeCold_step2(d: TemplateData): { subject: string; html: string } {
  const url = signupUrl(d);
  return { subject: `🎨 ${d.artistName}, create AI album art for free`, html: shell([
    hero('Create Stunning Album Art<br>With AI — For Free', 'Type a description → get professional artwork in seconds. Your 50 free credits are waiting.', '🎨'),
    txt(`<strong style="color:#fff;">${d.artistName}</strong>, imagine typing <em style="color:${C.txt2};">"dark cyberpunk city with neon ${d.genre || 'music'} vibes"</em> and getting pro artwork instantly. That's our AI — and you get <strong style="color:${C.purple};">50 free credits</strong>.`),
    section('What you can create'),
    grid([
      { icon: '💿', title: 'Album Covers · 5 cr', desc: 'Pro artwork from text prompts — any style, any vibe' },
      { icon: '📸', title: 'Social Graphics · 5 cr', desc: 'Instagram posts, stories, banners for your promo' },
      { icon: '🎬', title: 'Video Clips · 15 cr', desc: '10-sec animated clips synced to your track for Reels/TikTok' },
      { icon: '📝', title: 'AI Bio Writer · 2 cr', desc: 'Professional artist bio from your music info' },
    ]),
    stats([
      { value: '50', label: 'Free Credits', color: C.green },
      { value: '10+', label: 'Art Styles', color: C.cyan },
      { value: '<10s', label: 'Gen. Time', color: C.amber },
    ]),
    quote('Alex Vega', 'Reggaeton · Puerto Rico', 'I spent $200 on a cover designer. Then I made 10 better ones with Boostify AI in 5 minutes. For FREE.'),
    cta('Try AI Art Generator Free →', url),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'Type a description → get professional album art in seconds' })};
}

export function welcomeCold_step3(d: TemplateData): { subject: string; html: string } {
  const url = signupUrl(d);
  return { subject: `${d.artistName}, quick question about your music career`, html: shell([
    hero('What Would Help Your<br>Music Career Most?', `We've reached out a few times — just want to make sure you know what's available.`),
    section('Common questions answered'),
    txt(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${[
        { q: '"Is it really free?"', a: 'Yes. No credit card, no trial, no catch. Free plan = free forever.' },
        { q: '"Will it take long?"', a: '30 seconds. We pre-fill your info from your socials. Just confirm.' },
        { q: '"Is my data safe?"', a: 'Enterprise encryption. We never sell your data. Period.' },
        { q: '"What if I don\'t like it?"', a: 'Delete your account anytime. One click. No questions.' },
      ].map(i => `<tr><td style="padding:8px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:1px solid ${C.border};border-radius:10px;padding:14px 18px;"><tr><td>
          <div style="color:${C.purple};font-size:14px;font-weight:700;margin-bottom:4px;">${i.q}</div>
          <div style="color:${C.muted};font-size:13px;">${i.a}</div>
        </td></tr></table></td></tr>`).join('')}</table>`),
    stats([
      { value: '12K+', label: 'Artists Trust Us', color: C.green },
      { value: '4.9★', label: 'Artist Rating', color: C.amber },
      { value: '$0', label: 'Hidden Fees', color: C.cyan },
    ]),
    cta('Create Free Account →', url, 'g'),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'FAQ: everything you need to know in 30 seconds' })};
}

export function welcomeCold_step4(d: TemplateData): { subject: string; html: string } {
  const url = signupUrl(d);
  const slug = (d.artistName || 'you').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return { subject: `⏰ ${d.artistName}, your reserved page expires in 48h`, html: shell([
    urgency('Your reserved URL and 50 credits expire in 48 hours'),
    hero(`Last Call, ${d.artistName}`, 'Your personalized URL and free credits are about to be released to other artists.', '⏰'),
    txt(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:1px solid ${C.border};border-radius:12px;padding:20px 24px;"><tr><td>
      <div style="color:${C.dim};font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Your Reserved URL</div>
      <div style="color:${C.purple};font-size:22px;font-weight:800;">boostifymusic.com/artist/${slug}</div>
      <div style="margin-top:14px;border-top:1px solid ${C.border};padding-top:14px;">
        <span style="color:${C.red};font-size:13px;font-weight:700;">⏰ Expires in 48 hours</span>
        <span style="color:${C.dim};font-size:12px;margin-left:12px;">After that, this URL becomes available to anyone</span>
      </div>
    </td></tr></table>`),
    section("What you lose if you don't claim it"),
    checks([
      `Your unique URL: <strong style="color:${C.purple};">boostifymusic.com/artist/${slug}</strong>`,
      '<strong style="color:#fff;">50 free AI credits</strong> ($5 value)',
      '<strong style="color:#fff;">Pre-built landing page</strong> with your music and links',
      '<strong style="color:#fff;">Early adopter perks</strong> — first 15K artists get extras',
    ]),
    cta('Claim My Page Before It Expires →', url, 'a'),
    txt(`<div style="text-align:center;color:${C.dim};font-size:12px;">Not interested? No worries — this is our last email. 💜</div>`),
  ].join(''), { unsub: d.unsubscribeUrl, pre: `Your URL boostifymusic.com/artist/${slug} expires in 48 hours` })};
}

// ══════════════════════════════════════════════════════════════════
//  LANDING BUILDER — 4 emails / 7 days
// ══════════════════════════════════════════════════════════════════

export function landingBuilder_step0(d: TemplateData): { subject: string; html: string } {
  return { subject: `🎉 Welcome ${d.artistName}! Let's make your page fire`, html: shell([
    hero(`You're In, ${d.artistName}! 🎉`, 'Your account is live. Let\'s make your artist page stand out in under 5 minutes.'),
    section('Complete your page in 4 steps'),
    txt(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${[
        { n: '01', t: 'Upload a profile photo', d: 'Square image, 400×400px min. Shows on your page and QR.', time: '30s' },
        { n: '02', t: 'Add your top songs', d: 'Upload up to 3 tracks (MP3/WAV). Beautiful embedded player.', time: '1 min' },
        { n: '03', t: 'Connect social links', d: 'Spotify, Instagram, YouTube, SoundCloud — all in one hub.', time: '30s' },
        { n: '04', t: 'Share your page!', d: 'Copy your link, paste in your Instagram bio, share with fans!', time: '10s' },
      ].map(s => `<tr><td style="padding:8px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:1px solid ${C.border};border-radius:12px;padding:16px 18px;"><tr>
          <td style="width:48px;"><div style="width:40px;height:40px;border-radius:10px;background:${G.main};text-align:center;line-height:40px;font-size:16px;font-weight:800;color:#fff;">${s.n}</div></td>
          <td style="padding-left:14px;"><div style="color:#fff;font-size:15px;font-weight:700;">${s.t}</div><div style="color:${C.muted};font-size:13px;margin-top:3px;">${s.d}</div></td>
          <td style="width:50px;text-align:right;"><span style="color:${C.dim};font-size:11px;background:${C.bg};border:1px solid ${C.border};padding:4px 8px;border-radius:6px;">~${s.time}</span></td>
        </tr></table></td></tr>`).join('')}</table>`),
    cta('Complete My Page →', d.landingPageUrl || `${PLATFORM_URL}/my-artists`, 'g'),
  ].join(''), { unsub: d.unsubscribeUrl, pre: '4 steps to a fire artist page — under 5 minutes' })};
}

export function landingBuilder_step1(d: TemplateData): { subject: string; html: string } {
  return { subject: `🤖 ${d.artistName}, your 50 AI credits are waiting`, html: shell([
    hero('Unlock Your AI Superpowers', 'You have 50 free credits — here\'s exactly what you can make with them.', '🤖'),
    txt(`<strong style="color:#fff;">${d.artistName}</strong>, your account comes loaded with <span style="color:${C.purple};font-weight:800;">50 AI credits</span> — $5 of creative power:`),
    grid([
      { icon: '💿', title: 'Album Covers · 5 cr', desc: 'Describe your vibe → get pro artwork instantly' },
      { icon: '🎬', title: 'Video Clips · 15 cr', desc: '10-sec animated clip synced to your track for Reels' },
      { icon: '📸', title: 'Social Graphics · 5 cr', desc: 'Instagram posts, stories, and promo banners' },
      { icon: '📝', title: 'AI Bio · 2 cr', desc: 'Professional artist bio from your music info' },
    ]),
    txt(`<div style="background:${C.bg};border:1px solid ${C.border};border-radius:10px;padding:16px 20px;text-align:center;"><span style="color:${C.green};font-weight:700;">💡 Pro tip:</span> <span style="color:${C.muted};">Create an album cover first — 10 seconds, looks insane on your page</span></div>`),
    cta('Use My 50 Free Credits →', `${PLATFORM_URL}/my-artists`),
  ].join(''), { unsub: d.unsubscribeUrl, pre: '50 AI credits = album art + video clips + graphics + bio' })};
}

export function landingBuilder_step2(d: TemplateData): { subject: string; html: string } {
  return { subject: `📢 Time to share your page, ${d.artistName}`, html: shell([
    hero('Your Page Is Ready.<br>Now Let The World See It.', 'A page without visitors is like a song nobody hears. Here are 5 proven ways to drive traffic.', '📢'),
    section('5 ways to drive fans to your page'),
    txt(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${[
        { i: '📱', t: 'Instagram Bio', d: 'Replace your Linktree with your Boostify URL.', imp: 'High' },
        { i: '🐦', t: 'Twitter/X', d: 'Tweet your page with #NewMusic. Pin it to your profile.', imp: 'Med' },
        { i: '🎵', t: 'TikTok Bio', d: 'Add to your TikTok. Perfect for music discovery.', imp: 'High' },
        { i: '📋', t: 'QR at Shows', d: 'Print QR on flyers, setlists, or merch tags.', imp: 'High' },
        { i: '💬', t: 'DMs & WhatsApp', d: 'Share with collaborators, friends, and fans.', imp: 'Med' },
      ].map(s => `<tr><td style="padding:6px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:1px solid ${C.border};border-radius:10px;padding:14px 16px;"><tr>
          <td style="width:36px;font-size:22px;">${s.i}</td>
          <td style="padding-left:10px;"><div style="color:#fff;font-size:14px;font-weight:700;">${s.t}</div><div style="color:${C.muted};font-size:12px;margin-top:2px;">${s.d}</div></td>
          <td style="width:55px;text-align:right;"><span style="color:${s.imp === 'High' ? C.green : C.amber};font-size:10px;font-weight:700;background:${s.imp === 'High' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)'};padding:3px 8px;border-radius:4px;">${s.imp}</span></td>
        </tr></table></td></tr>`).join('')}</table>`),
    cta('View & Share My Page →', d.landingPageUrl || `${PLATFORM_URL}/my-artists`, 'g'),
  ].join(''), { unsub: d.unsubscribeUrl, pre: '5 proven ways to drive fans to your artist page' })};
}

export function landingBuilder_step3(d: TemplateData): { subject: string; html: string } {
  return { subject: `🔥 ${d.artistName}, here's what's next for your career`, html: shell([
    hero('You Set Up Your Page.<br>Now Let\'s Go Further.', 'Everything else Boostify can do for your career — most of it free or incredibly affordable.'),
    section('Unlock more as you grow'),
    grid([
      { icon: '🎬', title: 'AI Music Videos', desc: 'Turn any song into a professional video from $99' },
      { icon: '👕', title: 'Merch Store', desc: 'Sell custom merch from your page. Zero inventory' },
      { icon: '📈', title: 'Growth Tools', desc: 'Smart tools to grow Spotify streams and IG followers' },
      { icon: '🪙', title: 'Music Tokens', desc: 'Let fans invest in your music on blockchain' },
      { icon: '📧', title: 'Fan Mailing List', desc: 'Collect emails and send updates to fans directly' },
      { icon: '🎤', title: 'Copyright Registry', desc: 'Register songs on blockchain for proof of ownership' },
    ]),
    divider(),
    section('Plans that grow with you'),
    txt(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${pricing('Free', '$0', 'forever', ['3 songs', '2 videos', '50 credits', 'Landing page'], false, PRICING_URL)}
      ${pricing('Creator', '$9.99', '/month', ['20 songs', '10 videos', '500 credits', 'AI tools'], true, PRICING_URL)}
      ${pricing('Pro', '$24.99', '/month', ['Unlimited', 'Merch store', '2K credits', 'Priority AI'], false, PRICING_URL)}
    </tr></table>`),
    cta('Explore All Features →', PRICING_URL),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'AI videos, merch, growth tools, tokens — all on Boostify' })};
}

// ══════════════════════════════════════════════════════════════════
//  VALUE SHOWCASE — 6 emails / 21 days
// ══════════════════════════════════════════════════════════════════

export function valueShowcase_step0(d: TemplateData): { subject: string; html: string } {
  return { subject: `🎨 ${d.artistName}, create album art in 10 seconds`, html: shell([
    hero('AI Album Art Generator', 'Type a description → Get professional artwork. It\'s that simple.', '🎨'),
    txt(`<strong style="color:#fff;">${d.artistName}</strong>, stop paying designers $200+ for covers. Our AI creates pro artwork from a simple text prompt.`),
    section('How it works'),
    txt(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${[
        { n: '1', t: 'Describe your vibe: <em style="color:' + C.txt2 + ';">"neon Tokyo streets, anime, rain"</em>' },
        { n: '2', t: 'Pick a style: cyberpunk, watercolor, 3D, minimal, etc.' },
        { n: '3', t: 'Generate in seconds — download in HD' },
      ].map(s => `<tr><td style="padding:6px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:32px;height:32px;border-radius:50%;background:${G.main};text-align:center;line-height:32px;font-size:14px;font-weight:800;color:#fff;">${s.n}</td>
        <td style="padding-left:12px;color:${C.muted};font-size:14px;">${s.t}</td>
      </tr></table></td></tr>`).join('')}</table>`),
    stats([ { value: '5', label: 'Credits/Image', color: C.purple }, { value: '<10s', label: 'Generation', color: C.green }, { value: 'HD', label: 'Resolution', color: C.cyan } ]),
    quote('Luna B.', 'R&B · London', 'I\'ve made 8 album covers with Boostify AI. Each looks like I paid a graphic designer. My fans think I hired a team.'),
    cta('Try AI Art Generator →', `${PLATFORM_URL}/my-artists`, 'g'),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'Describe your vibe → get professional album art in seconds' })};
}

export function valueShowcase_step1(d: TemplateData): { subject: string; html: string } {
  return { subject: `🎬 Turn your song into a music video — no camera`, html: shell([
    hero('AI Music Video Creator', 'Upload your track. Get a professional video. No camera, no crew, no studio.', '🎬'),
    txt(`<strong style="color:#fff;">${d.artistName}</strong>, music videos cost $5K-$50K to produce. Our AI creates them from <strong style="color:${C.purple};">$99</strong>.`),
    grid([
      { icon: '🎥', title: 'Full-Length Video', desc: 'AI visuals synced to your entire track' },
      { icon: '✨', title: 'Visual Effects', desc: 'Particles, transitions, color grading, and more' },
      { icon: '📝', title: 'Lyric Overlays', desc: 'Animated lyrics synced to your vocals' },
      { icon: '📲', title: 'Multi-Format', desc: 'YouTube (16:9), Instagram (1:1), TikTok (9:16)' },
    ]),
    quote('Mateo Cifuentes', 'Trap · Bogotá', 'My Boostify video hit 50K views on YouTube in the first week. People thought I spent thousands. I spent $99.'),
    cta('Create My Music Video →', `${PLATFORM_URL}/music-video`),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'Professional music video from $99 — AI does the heavy lifting' })};
}

export function valueShowcase_step2(d: TemplateData): { subject: string; html: string } {
  return { subject: `👕 Sell merch from your page — zero inventory`, html: shell([
    hero('Print-on-Demand<br>Merch Store', 'T-shirts, hoodies, posters — designed by AI, printed and shipped automatically.', '👕'),
    txt(`<strong style="color:#fff;">${d.artistName}</strong>, your fans want to rep your brand. Sell custom products directly from your page — <strong style="color:#fff;">zero upfront cost</strong>.`),
    checks([
      'Design with AI or upload your artwork',
      'Choose products: tees, hoodies, posters, phone cases',
      'Set your price — you keep the profit margin',
      'Fan orders → printed and shipped automatically',
      'You never touch inventory. We handle everything.',
    ]),
    stats([ { value: '$0', label: 'Upfront Cost', color: C.green }, { value: '50+', label: 'Products', color: C.purple }, { value: '$15-30', label: 'Avg Profit', color: C.amber } ]),
    cta('Set Up My Merch Store →', `${PLATFORM_URL}/my-artists`),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'Zero inventory, zero risk. AI designs + automatic printing & shipping' })};
}

export function valueShowcase_step3(d: TemplateData): { subject: string; html: string } {
  return { subject: `🪙 Your fans can invest in your music`, html: shell([
    hero('Tokenize Your Music<br>on BoostiSwap', 'Let fans become investors. Sell music tokens on blockchain.', '🪙'),
    txt(`<strong style="color:#fff;">${d.artistName}</strong>, imagine fans buying tokens tied to your music. They get ownership, you get funding. It's the future of independent music.`),
    grid([
      { icon: '🎵', title: 'Mint Tokens', desc: 'Create BTF tokens tied to your songs or albums' },
      { icon: '💰', title: 'Fan Funding', desc: 'Fans buy tokens = you get funded directly' },
      { icon: '📈', title: 'Token Value', desc: 'As your career grows, token value appreciates' },
      { icon: '🔒', title: 'On Blockchain', desc: 'Transparent, secure, on Polygon network' },
    ]),
    cta('Explore BoostiSwap →', `${PLATFORM_URL}/boostiswap`),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'Fans buy tokens in your music = you get funded' })};
}

export function valueShowcase_step4(d: TemplateData): { subject: string; html: string } {
  return { subject: `📊 Grow your Spotify & Instagram, ${d.artistName}`, html: shell([
    hero('Smart Growth Tools', 'Real followers. Real streams. Smart automation that grows your audience.', '📊'),
    txt(`<strong style="color:#fff;">${d.artistName}</strong>, growing on Spotify and Instagram takes time — or smart tools. Automate the boring stuff.`),
    grid([
      { icon: '🎧', title: 'Spotify Boost', desc: 'Playlist pitching, promotion, and stream optimization' },
      { icon: '📱', title: 'IG Boost Pro', desc: 'Automated engagement, hashtags, and follower growth' },
      { icon: '📊', title: 'Analytics Hub', desc: 'All platforms in one dashboard — streams, follows, engagement' },
      { icon: '🎯', title: 'Smart Targeting', desc: 'AI finds fans who match your genre and style' },
    ]),
    cta('See Growth Tools →', PRICING_URL),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'Real streams, real followers — smart tools for your audience' })};
}

export function valueShowcase_step5(d: TemplateData): { subject: string; html: string } {
  return { subject: `${d.artistName}, ready to go pro? 🚀`, html: shell([
    hero('Ready to Level Up?', 'You\'ve seen what free can do. Here\'s what pro unlocks.', '🚀'),
    section('Choose your path'),
    txt(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${pricing('Free', '$0', 'forever', ['3 songs', '6 photos', '50 credits'], false, PRICING_URL)}
      ${pricing('Creator', '$9.99', '/month', ['20 songs', '500 credits', 'AI tools', 'No watermark'], true, PRICING_URL)}
      ${pricing('Pro', '$24.99', '/month', ['Unlimited', '2K credits', 'Merch store', 'Growth tools'], false, PRICING_URL)}
    </tr></table>`),
    quote('Indie Survey', '500+ artists polled', '94% of artists who upgraded to Creator said it paid for itself within the first month through merch sales and saved design costs.'),
    cta('Compare All Plans →', PRICING_URL),
    txt(`<div style="text-align:center;color:${C.dim};font-size:12px;">No pressure — your free plan never expires. 💜</div>`),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'Free is great. Pro is game-changing.' })};
}

// ══════════════════════════════════════════════════════════════════
//  UPGRADE NUDGE — 4 emails / 14 days
// ══════════════════════════════════════════════════════════════════

export function upgradeNudge_step0(d: TemplateData): { subject: string; html: string } {
  return { subject: `${d.artistName}, you're hitting your free plan limits 📈`, html: shell([
    hero('You\'ve Outgrown Free,<br>' + d.artistName, 'You\'re one of our most active artists — and bumping against limits.'),
    section('Free vs Creator comparison'),
    txt(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:14px;overflow:hidden;">
      <tr style="background:${C.bg};"><td style="padding:12px 16px;color:${C.dim};font-size:12px;font-weight:700;letter-spacing:1px;">FEATURE</td><td style="padding:12px;color:${C.dim};font-size:12px;font-weight:700;text-align:center;">FREE</td><td style="padding:12px;color:${C.purple};font-size:12px;font-weight:700;text-align:center;">CREATOR $9.99</td></tr>
      ${[['Songs','3','20'],['Videos','2','10'],['Photos','6','50'],['AI Credits','50 once','500/month'],['Custom Design','❌','✅ Drag & Drop'],['Watermark','Boostify','❌ Removed'],['Merch Store','❌','✅ Full Access'],['Priority Support','❌','✅ 24/7']].map((r,i) =>
        `<tr style="background:${i%2===0?C.card:C.bg};"><td style="padding:10px 16px;color:${C.muted};font-size:13px;">${r[0]}</td><td style="padding:10px;color:${C.dim};font-size:13px;text-align:center;">${r[1]}</td><td style="padding:10px;color:#fff;font-size:13px;text-align:center;font-weight:600;">${r[2]}</td></tr>`).join('')}
    </table>`),
    cta('Upgrade to Creator — $9.99/mo →', PRICING_URL),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'You need more space. Creator = 20 songs, 500 credits, merch store' })};
}

export function upgradeNudge_step1(d: TemplateData): { subject: string; html: string } {
  return { subject: `🎁 Exclusive: 50% off your first month`, html: shell([
    urgency('This discount is exclusive to you — expires in 5 days'),
    hero('50% Off Your First Month', 'Because you\'re an active member, here\'s an exclusive deal.', '🎁'),
    stats([ { value: '$4.99', label: 'Creator', color: C.green }, { value: '$12.49', label: 'Pro', color: C.purple }, { value: '$24.99', label: 'Enterprise', color: C.amber } ]),
    section('What $4.99 gets you'),
    checks([
      '20 songs (vs 3 on free)', '500 AI credits monthly',
      'Drag & drop page customization', 'Boostify watermark removed',
      'Merch store access', 'Priority support',
    ]),
    txt(`<div style="text-align:center;"><span style="color:${C.dim};font-size:13px;">Use code:</span> <span style="background:${C.bg};border:2px dashed ${C.purple};border-radius:8px;padding:8px 24px;color:${C.purple};font-size:20px;font-weight:800;letter-spacing:2px;">ARTIST50</span></div>`),
    cta('Get 50% Off Now →', `${PRICING_URL}?promo=ARTIST50`, 'g'),
    txt(`<div style="text-align:center;color:${C.dim};font-size:12px;">First month only · Cancel anytime · No questions</div>`),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'Creator for $4.99 — use code ARTIST50' })};
}

export function upgradeNudge_step2(d: TemplateData): { subject: string; html: string } {
  return { subject: `What ${d.genre || 'top'} artists achieve on Boostify`, html: shell([
    hero('Real Artists.<br>Real Results.', `See what ${d.genre || 'independent'} artists achieve with paid plans.`),
    section('Success stories'),
    txt(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${[
        { n: 'Sofia Reyes', g: 'Latin Pop', s: '3x page visits', q: 'Page went from 200 to 600 visits/month. Custom design makes a huge difference.' },
        { n: 'Marcus Cole', g: 'Hip-Hop', s: '$850/mo merch', q: 'Sell hoodies and tees from my page. Zero inventory, just pure profit.' },
        { n: 'Kira Waves', g: 'Electronic', s: '100K video views', q: 'My AI video hit 100K on YouTube. I spent $99. My friend spent $3K on a real video and got 500 views.' },
      ].map(t => `<tr><td style="padding:8px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:1px solid ${C.border};border-radius:12px;padding:18px 20px;"><tr><td>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td><div style="color:#fff;font-size:14px;font-weight:700;">${t.n}</div><div style="color:${C.dim};font-size:11px;">${t.g}</div></td>
            <td style="padding-left:20px;text-align:right;"><span style="background:rgba(139,92,246,0.15);color:${C.purple};font-size:12px;font-weight:700;padding:4px 10px;border-radius:6px;">${t.s}</span></td>
          </tr></table>
          <p style="color:${C.txt2};font-size:13px;font-style:italic;line-height:1.5;margin:10px 0 0;">"${t.q}"</p>
        </td></tr></table></td></tr>`).join('')}</table>`),
    cta('See All Plans →', PRICING_URL),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'Sofia 3x visits. Marcus $850/mo merch. Kira 100K views.' })};
}

export function upgradeNudge_step3(d: TemplateData): { subject: string; html: string } {
  return { subject: `⏰ Last chance: 50% discount expires tomorrow`, html: shell([
    urgency('Your ARTIST50 code expires in 24 hours'),
    hero('24 Hours Left,<br>' + d.artistName, 'Your exclusive 50% discount expires tomorrow. After that — full price.', '⏰'),
    stats([ { value: '24h', label: 'Time Left', color: C.red }, { value: '50%', label: 'Discount', color: C.green }, { value: '$4.99', label: 'Creator', color: C.purple } ]),
    txt(`<div style="text-align:center;"><span style="color:${C.dim};">Code:</span><br><span style="background:${C.bg};border:2px dashed ${C.red};border-radius:8px;padding:8px 24px;color:${C.red};font-size:20px;font-weight:800;letter-spacing:2px;display:inline-block;margin-top:8px;">ARTIST50</span></div>`),
    cta('Upgrade Now — Save 50% →', `${PRICING_URL}?promo=ARTIST50`, 'a'),
    txt(`<div style="text-align:center;color:${C.dim};font-size:12px;">Not ready? Your free page stays active forever. 💜</div>`),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'ARTIST50 expires in 24h. Creator for $4.99. Last chance.' })};
}

// ══════════════════════════════════════════════════════════════════
//  WIN-BACK — 3 emails / 10 days
// ══════════════════════════════════════════════════════════════════

export function winBack_step0(d: TemplateData): { subject: string; html: string } {
  return { subject: `💜 We miss you, ${d.artistName}`, html: shell([
    hero('Hey ' + d.artistName + ',<br>We Miss You', 'Your page is still live and getting visits. Don\'t let that momentum die.', '💜'),
    section('What\'s new since you left'),
    grid([
      { icon: '🎬', title: 'AI Music Videos', desc: 'NEW — Turn any song into a full video from $99' },
      { icon: '👕', title: 'Merch Stores', desc: 'NEW — Sell merch from your page, zero inventory' },
      { icon: '⚡', title: 'Faster AI', desc: 'IMPROVED — 3x faster art generation, better quality' },
      { icon: '📊', title: 'Better Analytics', desc: 'IMPROVED — See visitor sources, clicks, and geo data' },
    ]),
    cta('Check Out What\'s New →', d.landingPageUrl || `${PLATFORM_URL}/my-artists`, 'g'),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'New: AI music videos, merch stores, faster AI, better analytics' })};
}

export function winBack_step1(d: TemplateData): { subject: string; html: string } {
  return { subject: `🎁 ${d.artistName}, 100 free credits on us`, html: shell([
    hero('A Gift For You:<br>100 Free Credits', 'We\'re adding $10 worth of credits to your account. No strings.', '🎁'),
    stats([ { value: '100', label: 'Free Credits', color: C.green }, { value: '$10', label: 'Value', color: C.purple }, { value: '30d', label: 'Expires In', color: C.amber } ]),
    section('What 100 credits can make'),
    txt(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${[
        { t: '20 AI album covers', c: '5 ea' },
        { t: '6 video clips for TikTok/Reels', c: '15 ea' },
        { t: '1 cover + 1 video + 10 graphics', c: 'mixed' },
        { t: '50 AI bios for different platforms', c: '2 ea' },
      ].map(i => `<tr><td style="padding:5px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:1px solid ${C.border};border-radius:8px;padding:10px 14px;"><tr>
          <td style="color:${C.txt2};font-size:13px;">✨ ${i.t}</td>
          <td style="width:60px;text-align:right;color:${C.dim};font-size:11px;">${i.c}</td>
        </tr></table></td></tr>`).join('')}</table>`),
    cta('Use My 100 Free Credits →', `${PLATFORM_URL}/my-artists`),
    txt(`<div style="text-align:center;color:${C.dim};font-size:12px;">Credits expire in 30 days ⏳</div>`),
  ].join(''), { unsub: d.unsubscribeUrl, pre: '100 free credits ($10 value) in your account' })};
}

export function winBack_step2(d: TemplateData): { subject: string; html: string } {
  return { subject: `${d.artistName}, this is our last email 💜`, html: shell([
    hero('Last Check-In', 'We don\'t want to be annoying. This is our last email for a while.', '💌'),
    txt(`<strong style="color:#fff;">${d.artistName}</strong>, here's what's waiting whenever you're ready:`),
    checks([
      'Your <strong style="color:#fff;">landing page is still live</strong> and getting visits',
      'Your <strong style="color:#fff;">100 bonus credits</strong> are ready (30 days left)',
      'All <strong style="color:#fff;">new features</strong> — AI videos, merch, growth tools',
      'Your <strong style="color:#fff;">unique URL</strong> is reserved under your name',
    ]),
    txt(`<div style="background:${C.bg};border:1px solid ${C.border};border-radius:12px;padding:20px 24px;text-align:center;">
      <div style="color:${C.txt2};font-size:15px;line-height:1.6;">We'll be here when the time is right.<br>Your page, credits, and tools aren't going anywhere.</div>
      <div style="color:${C.dim};font-size:12px;margin-top:10px;">💜 The Boostify Team</div>
    </div>`),
    cta('Come Back Anytime →', `${PLATFORM_URL}/my-artists`, 'g'),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'Your page, credits, and tools are waiting' })};
}

// ══════════════════════════════════════════════════════════════════
//  REFERRAL PUSH — 2 emails / 7 days
// ══════════════════════════════════════════════════════════════════

export function referralPush_step0(d: TemplateData): { subject: string; html: string } {
  return { subject: `🤝 Invite friends → get free credits + upgrades`, html: shell([
    hero('Share Boostify.<br>Get Rewarded.', 'For every artist you bring, you both get 200 credits. Bring 3 = free month of Creator.', '🤝'),
    stats([ { value: '200', label: 'Credits/Referral', color: C.purple }, { value: '200', label: 'Friend Gets Too', color: C.green }, { value: '∞', label: 'Max Referrals', color: C.amber } ]),
    section('How it works'),
    txt(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${[
        { n: '1', t: 'Get your unique referral link', d: 'One click in your dashboard' },
        { n: '2', t: 'Share with artist friends', d: 'Bandmates, producers, DJs, collabs' },
        { n: '3', t: 'They sign up, you both win', d: '200 credits each. Both free.' },
      ].map(s => `<tr><td style="padding:6px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:1px solid ${C.border};border-radius:10px;padding:14px 16px;"><tr>
          <td style="width:36px;height:36px;border-radius:50%;background:${G.main};text-align:center;line-height:36px;font-size:15px;font-weight:800;color:#fff;">${s.n}</td>
          <td style="padding-left:12px;"><div style="color:#fff;font-size:14px;font-weight:700;">${s.t}</div><div style="color:${C.muted};font-size:12px;">${s.d}</div></td>
        </tr></table></td></tr>`).join('')}</table>`),
    divider(),
    txt(`<div style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);border-radius:12px;padding:18px 22px;text-align:center;">
      <div style="color:${C.purple};font-size:14px;font-weight:700;">🎉 BONUS: Refer 3 = Free month of Creator ($9.99)</div>
      <div style="color:${C.muted};font-size:12px;margin-top:6px;">20 songs, 500 credits, no watermark — free.</div>
    </div>`),
    cta('Get My Referral Link →', `${PLATFORM_URL}/my-artists`, 'g'),
  ].join(''), { unsub: d.unsubscribeUrl, pre: 'Refer artists → 200 credits each. Refer 3 → free Creator month.' })};
}

export function referralPush_step1(d: TemplateData): { subject: string; html: string } {
  return { subject: `${d.artistName}, 3 referrals = free Creator plan 🎉`, html: shell([
    hero('Refer 3 Artists.<br>Get Creator Free.', 'Collaborators, bandmates, producers — 3 signups = full Creator for a month.', '🎉'),
    txt(`<strong style="color:#fff;">${d.artistName}</strong>, you love Boostify — help other artists discover it. Here's what 3 referrals unlock:`),
    grid([
      { icon: '🎵', title: '20 Song Uploads', desc: 'vs 3 on free — fill your page with music' },
      { icon: '🤖', title: '500 AI Credits', desc: 'Covers, clips, and graphics all month' },
      { icon: '🎨', title: 'Custom Design', desc: 'Drag & drop builder, no watermark' },
      { icon: '👕', title: 'Merch Store', desc: 'Sell products from your page' },
    ]),
    quote('Nico Torres', 'Producer · Buenos Aires', 'Referred my band + two producer friends. Got a free Creator month — used the 500 credits for all our cover art. Easiest deal ever.'),
    cta('Start Referring Now →', `${PLATFORM_URL}/my-artists`),
  ].join(''), { unsub: d.unsubscribeUrl, pre: '3 referrals = free Creator ($9.99). Bandmates count!' })};
}

// ─── Registry ─────────────────────────────────────────────────────

export type SequenceType = 'welcome_cold' | 'landing_builder' | 'value_showcase' | 'upgrade_nudge' | 'win_back' | 'referral_push';
type TemplateFn = (d: TemplateData) => { subject: string; html: string };

export const SEQUENCE_TEMPLATES: Record<SequenceType, TemplateFn[]> = {
  welcome_cold: [welcomeCold_step0, welcomeCold_step1, welcomeCold_step2, welcomeCold_step3, welcomeCold_step4],
  landing_builder: [landingBuilder_step0, landingBuilder_step1, landingBuilder_step2, landingBuilder_step3],
  value_showcase: [valueShowcase_step0, valueShowcase_step1, valueShowcase_step2, valueShowcase_step3, valueShowcase_step4, valueShowcase_step5],
  upgrade_nudge: [upgradeNudge_step0, upgradeNudge_step1, upgradeNudge_step2, upgradeNudge_step3],
  win_back: [winBack_step0, winBack_step1, winBack_step2],
  referral_push: [referralPush_step0, referralPush_step1],
};

export const SEQUENCE_STEPS: Record<SequenceType, number> = {
  welcome_cold: 5, landing_builder: 4, value_showcase: 6,
  upgrade_nudge: 4, win_back: 3, referral_push: 2,
};

export const SEQUENCE_DELAYS: Record<SequenceType, number[]> = {
  welcome_cold: [0, 48, 72, 96, 120],
  landing_builder: [0, 24, 72, 144],
  value_showcase: [0, 72, 144, 216, 336, 504],
  upgrade_nudge: [0, 72, 168, 312],
  win_back: [0, 72, 240],
  referral_push: [0, 168],
};
