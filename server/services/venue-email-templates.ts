/**
 * Venue Booking Email Templates — 5 mobile-first designs
 * Focus: show proposal details, benefits for the venue, direct CTA to artist landing page
 */

const PLATFORM_URL = process.env.BASE_URL || 'https://boostifymusic.com';

export interface VenueEmailData {
  artistName: string;
  artistSlug: string;
  artistGenre: string;
  artistBio: string;
  artistImage: string;
  spotifyUrl: string;
  youtubeChannel: string;
  instagramHandle: string;
  venueName: string;
  showFee?: string;
  setDuration?: string;
  availability?: string;
  technicalRequirements?: string;
  customMessage?: string;
  dealId: number;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  subjectLine: (data: VenueEmailData) => string;
  generate: (data: VenueEmailData) => string;
}

// ─── Shared helpers ───────────────────────────────────────────────

function artistUrl(data: VenueEmailData): string {
  return `${PLATFORM_URL}/artist/${data.artistSlug || 'profile'}`;
}

function proposalUrl(data: VenueEmailData): string {
  return data.dealId > 0 ? `${PLATFORM_URL}/venue-proposal/${data.dealId}` : artistUrl(data);
}

function avatarSrc(data: VenueEmailData): string {
  return data.artistImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.artistName)}&size=200&background=F59E0B&color=fff&bold=true`;
}

function shortBio(bio: string, max = 180): string {
  if (!bio) return 'Professional live act bringing exceptional energy and a loyal fanbase to every stage.';
  return bio.length > max ? bio.substring(0, max) + '…' : bio;
}

/** Responsive wrapper — works in Gmail, Outlook, Apple Mail, mobile clients */
function mobileWrapper(bgColor: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Booking Proposal</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  /* Reset */
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0}
  img{-ms-interpolation-mode:bicubic;border:0;height:auto;line-height:100%;outline:none;text-decoration:none}
  body{margin:0;padding:0;width:100%!important;height:100%!important;background:${bgColor}}
  /* Mobile */
  @media only screen and (max-width:620px){
    .outer{width:100%!important;min-width:100%!important}
    .inner{padding:20px 16px!important}
    .hero-img{width:80px!important;height:80px!important}
    .btn{display:block!important;width:100%!important;text-align:center!important}
    .detail-cell{display:block!important;width:100%!important;padding:8px 0!important}
    .hide-mobile{display:none!important}
    .stack-mobile{display:block!important;width:100%!important;text-align:center!important}
    h1{font-size:22px!important}
    h2{font-size:18px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<center>
<!--[if mso]><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center"><tr><td><![endif]-->
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto;" class="outer">
${inner}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</center>
</body>
</html>`;
}

/** CTA button — mobile-responsive */
function ctaButton(href: string, text: string, bgColor: string, textColor = '#fff'): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;">
<tr><td align="center">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${href}" style="height:52px;width:320px;v-text-anchor:middle;" arcsize="50%" fillcolor="${bgColor}"><center style="color:${textColor};font-family:sans-serif;font-size:16px;font-weight:bold;">${text}</center></v:roundrect><![endif]-->
<!--[if !mso]><!-->
<a href="${href}" class="btn" style="display:inline-block;padding:16px 40px;background:${bgColor};color:${textColor};text-decoration:none;border-radius:28px;font-size:16px;font-weight:700;letter-spacing:0.3px;min-width:240px;text-align:center;mso-hide:all;">${text}</a>
<!--<![endif]-->
</td></tr></table>`;
}

/** Detail row for show info */
function detailRow(icon: string, label: string, value: string, colors: { label: string; value: string; border: string }): string {
  return `<tr>
<td style="padding:12px 16px;border-bottom:1px solid ${colors.border};">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
    <td style="color:${colors.label};font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:4px;">${icon} ${label}</td>
  </tr><tr>
    <td style="color:${colors.value};font-size:15px;font-weight:700;">${value}</td>
  </tr></table>
</td></tr>`;
}

/** Benefits block */
function benefitsBlock(benefits: string[], colors: { bg: string; accent: string; text: string; border: string }): string {
  const items = benefits.map(b =>
    `<tr><td style="padding:8px 12px;vertical-align:top;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
        <td style="color:${colors.accent};font-size:16px;padding-right:10px;vertical-align:top;">✓</td>
        <td style="color:${colors.text};font-size:14px;line-height:1.5;">${b}</td>
      </tr></table>
    </td></tr>`
  ).join('');
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${colors.bg};border-radius:12px;border:1px solid ${colors.border};margin:16px 0;">
<tr><td style="padding:16px;">
  <p style="color:${colors.accent};font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:0 0 12px;">Why Book This Artist?</p>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">${items}</table>
</td></tr></table>`;
}

/** Show details table */
function showDetails(data: VenueEmailData, colors: { label: string; value: string; border: string; bg: string }): string {
  const rows: string[] = [];
  if (data.showFee) rows.push(detailRow('💰', 'Show Fee', data.showFee, colors));
  if (data.setDuration) rows.push(detailRow('⏱️', 'Set Duration', data.setDuration, colors));
  if (data.availability) rows.push(detailRow('📅', 'Availability', data.availability, colors));
  if (data.technicalRequirements) rows.push(detailRow('🔧', 'Tech Requirements', data.technicalRequirements, colors));
  if (!rows.length) return '';
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${colors.bg};border-radius:12px;margin:16px 0;">
<tr><td style="padding:4px 0;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">${rows.join('')}</table>
</td></tr></table>`;
}

/** Custom message block */
function messageBlock(msg: string | undefined, colors: { bg: string; text: string; border: string; accent: string }): string {
  if (!msg) return '';
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;">
<tr><td style="background:${colors.bg};border-radius:12px;border-left:4px solid ${colors.accent};padding:16px 20px;">
  <p style="color:${colors.accent};font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Personal Message</p>
  <p style="color:${colors.text};font-size:14px;line-height:1.7;margin:0;font-style:italic;">"${msg}"</p>
</td></tr></table>`;
}

/** Footer */
function footer(proposalHref: string, colors: { bg: string; text: string; link: string }): string {
  return `<tr><td style="padding:24px 20px;text-align:center;background:${colors.bg};border-radius:0 0 16px 16px;">
  <p style="color:${colors.text};font-size:12px;line-height:1.6;margin:0;">
    Sent via <a href="${PLATFORM_URL}" style="color:${colors.link};text-decoration:none;font-weight:600;">Boostify Music</a> — The platform connecting artists with venues worldwide.
  </p>
  <p style="color:${colors.text};font-size:11px;margin:8px 0 0;opacity:0.7;">
    If this email reaches you by mistake, simply ignore it.
  </p>
</td></tr>`;
}


// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE 1: PROFESSIONAL PITCH — Clean, corporate, elegant
// ═══════════════════════════════════════════════════════════════════════
const professionalPitch: EmailTemplate = {
  id: 'professional_pitch',
  name: 'Professional Pitch',
  description: 'Clean and elegant corporate design. Perfect for high-end venues, hotels, and upscale restaurants.',
  icon: '💼',
  category: 'formal',
  subjectLine: (d) => `Live Music Booking Proposal — ${d.artistName} at ${d.venueName}`,
  generate: (data) => {
    const c = {
      bg: '#0f0f0f', card: '#1a1a1a', accent: '#F59E0B', text: '#e0e0e0',
      heading: '#ffffff', muted: '#888', border: 'rgba(245,158,11,0.15)',
      detailBg: 'rgba(245,158,11,0.04)', benefitBg: 'rgba(245,158,11,0.06)',
    };

    const benefits = [
      `<strong>${data.artistGenre}</strong> act with a dedicated, engaged fanbase that will fill your venue`,
      'Professional setup — artist arrives with own sound check protocol and stage plan',
      'Full promotional support: we co-promote the event to the artist\'s audience via social media',
      'Flexible scheduling and competitive rates for recurring bookings',
      'Boostify-verified artist with professional booking history and ratings',
    ];

    return mobileWrapper(c.bg, `
<!-- Header accent bar -->
<tr><td style="height:4px;background:linear-gradient(90deg,${c.accent},#D97706);border-radius:16px 16px 0 0;"></td></tr>

<!-- Main card -->
<tr><td style="background:${c.card};padding:32px 28px 0;" class="inner">

  <!-- Artist header -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
    <td style="width:90px;vertical-align:top;" class="stack-mobile">
      <img src="${avatarSrc(data)}" alt="${data.artistName}" width="80" height="80" class="hero-img" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid ${c.accent};">
    </td>
    <td style="padding-left:16px;vertical-align:middle;" class="stack-mobile">
      <h1 style="color:${c.heading};font-size:26px;font-weight:800;margin:0;line-height:1.2;">${data.artistName}</h1>
      <p style="color:${c.accent};font-size:14px;font-weight:600;margin:4px 0 0;text-transform:uppercase;letter-spacing:0.5px;">${data.artistGenre}</p>
    </td>
  </tr></table>

  <!-- Greeting -->
  <p style="color:${c.text};font-size:15px;line-height:1.7;margin:24px 0 0;">
    Dear <strong style="color:${c.heading};">${data.venueName}</strong> team,
  </p>
  <p style="color:${c.text};font-size:15px;line-height:1.7;margin:12px 0;">
    We'd like to present <strong style="color:${c.heading};">${data.artistName}</strong> — a
    ${data.artistGenre.toLowerCase()} act that would be an exceptional fit for your venue's atmosphere and audience.
  </p>
  <p style="color:${c.muted};font-size:14px;line-height:1.7;margin:0 0 8px;">
    ${shortBio(data.artistBio, 200)}
  </p>

  <!-- Show proposal details -->
  <h2 style="color:${c.heading};font-size:16px;font-weight:700;margin:24px 0 8px;text-transform:uppercase;letter-spacing:0.5px;">📋 Show Proposal</h2>
  ${showDetails(data, { label: c.muted, value: c.heading, border: c.border, bg: c.detailBg })}

  ${messageBlock(data.customMessage, { bg: c.detailBg, text: c.text, border: c.border, accent: c.accent })}

  <!-- Benefits -->
  ${benefitsBlock(benefits, { bg: c.benefitBg, accent: c.accent, text: c.text, border: c.border })}

  <!-- CTA -->
  ${ctaButton(artistUrl(data), '🎵 View Artist Profile & Listen', c.accent, '#000')}

  <p style="text-align:center;margin:0 0 24px;">
    <a href="${proposalUrl(data)}" style="color:${c.accent};font-size:13px;text-decoration:underline;">View full booking proposal →</a>
  </p>

</td></tr>

${footer(proposalUrl(data), { bg: '#111', text: '#666', link: c.accent })}
`);
  },
};


// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE 2: CLUB NIGHT — Neon, bold, electric
// ═══════════════════════════════════════════════════════════════════════
const clubNight: EmailTemplate = {
  id: 'club_night',
  name: 'Club Night',
  description: 'Neon and electric design with bold colors. Ideal for nightclubs, DJ venues, and dance bars.',
  icon: '🎵',
  category: 'nightlife',
  subjectLine: (d) => `⚡ ${d.artistName} wants to light up ${d.venueName} — Booking Inquiry`,
  generate: (data) => {
    const c = {
      bg: '#0a0015', card: '#120025', accent: '#8B5CF6', accent2: '#06B6D4',
      text: '#d0d0e0', heading: '#ffffff', muted: '#8888aa',
      border: 'rgba(139,92,246,0.2)', detailBg: 'rgba(139,92,246,0.06)',
      benefitBg: 'rgba(6,182,212,0.06)',
    };

    const benefits = [
      `<strong>${data.artistGenre}</strong> specialist — knows how to move a dance floor and keep the energy high all night`,
      'Brings a loyal nightlife crowd that increases bar sales and door revenue',
      'Full DJ/live setup — seamless integration with your existing sound system',
      'Social media promotion to thousands of nightlife followers before the event',
      'Available for residencies, guest spots, and private events',
    ];

    return mobileWrapper(c.bg, `
<!-- Neon gradient top -->
<tr><td style="height:4px;background:linear-gradient(90deg,${c.accent},${c.accent2});border-radius:16px 16px 0 0;"></td></tr>

<!-- Card -->
<tr><td style="background:${c.card};padding:32px 28px 0;" class="inner">

  <!-- Artist centered -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
  <tr><td align="center">
    <img src="${avatarSrc(data)}" alt="${data.artistName}" width="90" height="90" class="hero-img" style="width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid ${c.accent};box-shadow:0 0 30px rgba(139,92,246,0.3);">
    <h1 style="color:${c.heading};font-size:28px;font-weight:900;margin:16px 0 0;text-transform:uppercase;letter-spacing:2px;">${data.artistName}</h1>
    <p style="color:${c.accent2};font-size:13px;font-weight:700;margin:4px 0 0;text-transform:uppercase;letter-spacing:1px;">⚡ ${data.artistGenre}</p>
  </td></tr></table>

  <!-- Line separator -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;">
  <tr><td style="height:1px;background:linear-gradient(90deg,transparent,${c.accent},${c.accent2},transparent);"></td></tr></table>

  <p style="color:${c.text};font-size:15px;line-height:1.7;margin:0;">
    Hey <strong style="color:${c.heading};">${data.venueName}</strong> 👋
  </p>
  <p style="color:${c.text};font-size:15px;line-height:1.7;margin:12px 0;">
    <strong style="color:${c.heading};">${data.artistName}</strong> is looking to bring an unforgettable night
    to your stage. Here's what we have in mind:
  </p>
  <p style="color:${c.muted};font-size:14px;line-height:1.6;margin:0 0 8px;">
    ${shortBio(data.artistBio, 200)}
  </p>

  <!-- Proposal -->
  <h2 style="color:${c.accent};font-size:14px;font-weight:800;margin:24px 0 8px;text-transform:uppercase;letter-spacing:1px;">🎤 Event Proposal</h2>
  ${showDetails(data, { label: c.muted, value: c.heading, border: c.border, bg: c.detailBg })}

  ${messageBlock(data.customMessage, { bg: c.detailBg, text: c.text, border: c.border, accent: c.accent })}

  ${benefitsBlock(benefits, { bg: c.benefitBg, accent: c.accent2, text: c.text, border: 'rgba(6,182,212,0.15)' })}

  ${ctaButton(artistUrl(data), '⚡ Check Out The Artist', `linear-gradient(135deg,${c.accent},${c.accent2})`)}

  <p style="text-align:center;margin:0 0 24px;">
    <a href="${proposalUrl(data)}" style="color:${c.accent};font-size:13px;text-decoration:underline;">See full proposal details →</a>
  </p>

</td></tr>

${footer(proposalUrl(data), { bg: '#0d001a', text: '#555', link: c.accent })}
`);
  },
};


// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE 3: INTIMATE VENUE — Warm, cozy, earthy
// ═══════════════════════════════════════════════════════════════════════
const intimateVenue: EmailTemplate = {
  id: 'intimate_venue',
  name: 'Intimate Acoustic',
  description: 'Warm and cozy design with earthy tones. Perfect for bars, restaurants, cafés, and lounges.',
  icon: '🎸',
  category: 'casual',
  subjectLine: (d) => `🎸 Live Acoustic Experience — ${d.artistName} for ${d.venueName}`,
  generate: (data) => {
    const c = {
      bg: '#faf7f2', card: '#ffffff', accent: '#B45309', accent2: '#92400E',
      text: '#4a3f35', heading: '#1a1510', muted: '#8a7e72',
      border: 'rgba(180,83,9,0.15)', detailBg: '#faf5ee',
      benefitBg: '#f7f0e6',
    };

    const benefits = [
      `<strong>${data.artistGenre}</strong> performed in an intimate acoustic setting — perfect ambiance for dining and socializing`,
      'Creates a warm, inviting atmosphere that encourages guests to stay longer and spend more',
      'Minimal equipment footprint — we adapt to your space, large or small',
      'Cross-promotion to the artist\'s local following, driving new customers to your venue',
      'Ideal for recurring weekend slots, private dining events, and special occasions',
    ];

    return mobileWrapper(c.bg, `
<!-- Warm top bar -->
<tr><td style="height:4px;background:linear-gradient(90deg,${c.accent},#D97706,#B45309);border-radius:16px 16px 0 0;"></td></tr>

<!-- Card -->
<tr><td style="background:${c.card};padding:32px 28px 0;border-left:1px solid #ede8e0;border-right:1px solid #ede8e0;" class="inner">

  <!-- Artist -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
    <td style="width:90px;vertical-align:top;" class="stack-mobile">
      <img src="${avatarSrc(data)}" alt="${data.artistName}" width="80" height="80" class="hero-img" style="width:80px;height:80px;border-radius:16px;object-fit:cover;border:3px solid ${c.accent};">
    </td>
    <td style="padding-left:16px;vertical-align:middle;" class="stack-mobile">
      <h1 style="color:${c.heading};font-size:24px;font-weight:800;margin:0;">${data.artistName}</h1>
      <p style="color:${c.accent};font-size:14px;font-weight:600;margin:4px 0 0;">🎸 ${data.artistGenre}</p>
    </td>
  </tr></table>

  <p style="color:${c.text};font-size:15px;line-height:1.8;margin:24px 0 0;">
    Hello <strong style="color:${c.heading};">${data.venueName}</strong>,
  </p>
  <p style="color:${c.text};font-size:15px;line-height:1.8;margin:12px 0;">
    We think <strong style="color:${c.heading};">${data.artistName}</strong> would be a wonderful
    addition to your venue's live music program. An intimate ${data.artistGenre.toLowerCase()} performance
    that complements your space beautifully.
  </p>
  <p style="color:${c.muted};font-size:14px;line-height:1.7;margin:0 0 8px;">
    ${shortBio(data.artistBio, 200)}
  </p>

  <h2 style="color:${c.heading};font-size:15px;font-weight:700;margin:24px 0 8px;">📋 Proposal Details</h2>
  ${showDetails(data, { label: c.muted, value: c.heading, border: c.border, bg: c.detailBg })}

  ${messageBlock(data.customMessage, { bg: c.detailBg, text: c.text, border: c.border, accent: c.accent })}

  ${benefitsBlock(benefits, { bg: c.benefitBg, accent: c.accent, text: c.text, border: c.border })}

  ${ctaButton(artistUrl(data), '🎸 Discover The Artist', c.accent)}

  <p style="text-align:center;margin:0 0 24px;">
    <a href="${proposalUrl(data)}" style="color:${c.accent};font-size:13px;text-decoration:underline;">View full booking proposal →</a>
  </p>

</td></tr>

${footer(proposalUrl(data), { bg: '#f5f0e8', text: '#999', link: c.accent })}
`);
  },
};


// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE 4: FESTIVAL / EVENT — Bold, impactful, large-scale
// ═══════════════════════════════════════════════════════════════════════
const festivalApplication: EmailTemplate = {
  id: 'festival_application',
  name: 'Festival / Event',
  description: 'Bold and impactful design for large-scale events. Great for festivals, concerts, and outdoor events.',
  icon: '🎪',
  category: 'events',
  subjectLine: (d) => `🎪 Artist Submission: ${d.artistName} — Perfect for ${d.venueName}`,
  generate: (data) => {
    const c = {
      bg: '#0a0a0a', card: '#151515', accent: '#EF4444', accent2: '#F97316',
      text: '#d0d0d0', heading: '#ffffff', muted: '#888',
      border: 'rgba(239,68,68,0.2)', detailBg: 'rgba(239,68,68,0.05)',
      benefitBg: 'rgba(249,115,22,0.05)',
    };

    const benefits = [
      `<strong>${data.artistGenre}</strong> performer with stage presence designed for large crowds and open-air environments`,
      'Proven crowd engagement — the kind of act that creates shareable, talk-of-the-event moments',
      'Brings an active social media audience that amplifies your event\'s reach before, during, and after',
      'Full production-ready act: comes with detailed stage plot and professional crew',
      'Flexible with scheduling — available for main stage, side stage, or after-party slots',
    ];

    return mobileWrapper(c.bg, `
<!-- Fire gradient -->
<tr><td style="height:5px;background:linear-gradient(90deg,${c.accent},${c.accent2},${c.accent});border-radius:16px 16px 0 0;"></td></tr>

<!-- Card -->
<tr><td style="background:${c.card};padding:32px 28px 0;" class="inner">

  <!-- Centered hero -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
  <tr><td align="center">
    <p style="color:${c.accent};font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:3px;margin:0 0 16px;">🎪 Artist Submission</p>
    <img src="${avatarSrc(data)}" alt="${data.artistName}" width="100" height="100" class="hero-img" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:4px solid ${c.accent};box-shadow:0 0 40px rgba(239,68,68,0.25);">
    <h1 style="color:${c.heading};font-size:30px;font-weight:900;margin:16px 0 0;text-transform:uppercase;letter-spacing:1px;">${data.artistName}</h1>
    <p style="color:${c.accent2};font-size:14px;font-weight:700;margin:6px 0 0;">${data.artistGenre}</p>
  </td></tr></table>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0;">
  <tr><td style="height:1px;background:linear-gradient(90deg,transparent,${c.accent},${c.accent2},transparent);"></td></tr></table>

  <p style="color:${c.text};font-size:15px;line-height:1.7;margin:0;">
    To the <strong style="color:${c.heading};">${data.venueName}</strong> programming team,
  </p>
  <p style="color:${c.text};font-size:15px;line-height:1.7;margin:12px 0;">
    We're submitting <strong style="color:${c.heading};">${data.artistName}</strong> for consideration
    at your upcoming events. This is an act that delivers massive energy and leaves audiences wanting more.
  </p>
  <p style="color:${c.muted};font-size:14px;line-height:1.6;margin:0 0 8px;">
    ${shortBio(data.artistBio, 200)}
  </p>

  <h2 style="color:${c.accent};font-size:14px;font-weight:800;margin:24px 0 8px;text-transform:uppercase;letter-spacing:1px;">🔥 Performance Proposal</h2>
  ${showDetails(data, { label: c.muted, value: c.heading, border: c.border, bg: c.detailBg })}

  ${messageBlock(data.customMessage, { bg: c.detailBg, text: c.text, border: c.border, accent: c.accent })}

  ${benefitsBlock(benefits, { bg: c.benefitBg, accent: c.accent2, text: c.text, border: 'rgba(249,115,22,0.15)' })}

  ${ctaButton(artistUrl(data), '🔥 See The Artist In Action', `linear-gradient(135deg,${c.accent},${c.accent2})`)}

  <p style="text-align:center;margin:0 0 24px;">
    <a href="${proposalUrl(data)}" style="color:${c.accent};font-size:13px;text-decoration:underline;">View detailed submission →</a>
  </p>

</td></tr>

${footer(proposalUrl(data), { bg: '#0d0d0d', text: '#555', link: c.accent })}
`);
  },
};


// ═══════════════════════════════════════════════════════════════════════
// TEMPLATE 5: FOLLOW UP — Friendly, short, no-pressure
// ═══════════════════════════════════════════════════════════════════════
const followUp: EmailTemplate = {
  id: 'follow_up',
  name: 'Follow Up',
  description: 'Friendly follow-up for venues that haven\'t responded. Short, warm, no-pressure approach.',
  icon: '🔄',
  category: 'follow_up',
  subjectLine: (d) => `Quick follow-up: ${d.artistName} for ${d.venueName} — Still interested?`,
  generate: (data) => {
    const c = {
      bg: '#0f1117', card: '#181c25', accent: '#10B981', accent2: '#34D399',
      text: '#c8cdd5', heading: '#ffffff', muted: '#7a8290',
      border: 'rgba(16,185,129,0.15)', detailBg: 'rgba(16,185,129,0.04)',
      benefitBg: 'rgba(16,185,129,0.06)',
    };

    return mobileWrapper(c.bg, `
<!-- Green top -->
<tr><td style="height:3px;background:linear-gradient(90deg,${c.accent},${c.accent2});border-radius:16px 16px 0 0;"></td></tr>

<!-- Card -->
<tr><td style="background:${c.card};padding:32px 28px 0;" class="inner">

  <!-- Compact header -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr>
    <td style="width:60px;vertical-align:middle;">
      <img src="${avatarSrc(data)}" alt="${data.artistName}" width="48" height="48" style="width:48px;height:48px;border-radius:50%;object-fit:cover;border:2px solid ${c.accent};">
    </td>
    <td style="padding-left:12px;vertical-align:middle;">
      <p style="color:${c.heading};font-size:18px;font-weight:700;margin:0;">${data.artistName}</p>
      <p style="color:${c.accent};font-size:12px;font-weight:600;margin:2px 0 0;">${data.artistGenre}</p>
    </td>
  </tr></table>

  <p style="color:${c.text};font-size:15px;line-height:1.8;margin:20px 0 0;">
    Hi <strong style="color:${c.heading};">${data.venueName}</strong> 👋
  </p>
  <p style="color:${c.text};font-size:15px;line-height:1.8;margin:12px 0;">
    Just a quick follow-up regarding <strong style="color:${c.heading};">${data.artistName}</strong>'s
    booking proposal. We understand you're busy, so here's a quick recap:
  </p>

  ${showDetails(data, { label: c.muted, value: c.heading, border: c.border, bg: c.detailBg })}

  <p style="color:${c.text};font-size:15px;line-height:1.8;margin:16px 0;">
    We'd love to make this happen and are happy to adjust the proposal to better fit your needs —
    whether it's dates, set length, or budget. No pressure at all.
  </p>

  ${messageBlock(data.customMessage, { bg: c.detailBg, text: c.text, border: c.border, accent: c.accent })}

  ${ctaButton(artistUrl(data), '🎵 Revisit Artist Profile', c.accent)}

  <p style="text-align:center;margin:0 0 8px;">
    <a href="${proposalUrl(data)}" style="color:${c.accent};font-size:13px;text-decoration:underline;">View original proposal →</a>
  </p>
  <p style="text-align:center;color:${c.muted};font-size:13px;margin:0 0 24px;">
    Just reply to this email and we'll take it from there 🤝
  </p>

</td></tr>

${footer(proposalUrl(data), { bg: '#141820', text: '#555', link: c.accent })}
`);
  },
};


// ═══════════════════════════════════════════════════════════════════════
// Registry & Exports
// ═══════════════════════════════════════════════════════════════════════

const templates: Record<string, EmailTemplate> = {
  professional_pitch: professionalPitch,
  club_night: clubNight,
  intimate_venue: intimateVenue,
  festival_application: festivalApplication,
  follow_up: followUp,
};

export function getTemplateList(): { id: string; name: string; description: string; icon: string; category: string }[] {
  return Object.values(templates).map(t => ({
    id: t.id, name: t.name, description: t.description, icon: t.icon, category: t.category,
  }));
}

export function generateEmailFromTemplate(templateId: string, data: VenueEmailData): { html: string; subject: string } {
  const tpl = templates[templateId] || templates.professional_pitch;
  return {
    html: tpl.generate(data),
    subject: tpl.subjectLine(data),
  };
}
