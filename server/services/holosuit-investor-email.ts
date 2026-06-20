/**
 * HoloSuit Investor Email Intelligence System
 * 5-email outreach sequence + lead/investor alerts
 * Provider: Resend (boostifymusic.site verified domain)
 */

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM = "Boostify HoloSuit <invest@boostifymusic.site>";
const REPLY_TO = "invest@boostifymusic.com";
const OWNER_EMAIL = "convoycubano@gmail.com";
const APP_URL = process.env.APP_URL || "https://boostifymusic.com";

interface SendResult { success: boolean; id?: string; error?: string }

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  bcc?: string[]
): Promise<SendResult> {
  if (!RESEND_API_KEY) return { success: false, error: "RESEND_API_KEY not set" };
  try {
    const body: any = { from: FROM, to: [to], subject, html, reply_to: REPLY_TO };
    if (bcc?.length) body.bcc = bcc;
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.id) return { success: true, id: data.id };
    return { success: false, error: data.message || `HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// ─── Design tokens ───────────────────────────────────────────────────────────
const ORANGE = "#f97316";
const CARD_BG = "#0d0d0d";
const BORDER = "rgba(255,255,255,0.07)";
const TEXT_MUTED = "#71717a";
const TEXT_BODY = "#a1a1aa";

// ─── Product image URLs (hosted on boostifymusic.com public CDN) ──────────────
const CDN = "https://boostifymusic.com/holosuit";
const IMGS = {
  dashboard:  `${CDN}/ec0bf471-5309-45bd-830d-b839ed56c7d9.png`,   // HoloStage VR Space + LIVE performer feed
  performer1: `${CDN}/8c97fcfd-3179-46b3-8ee8-644c227f4024.png`,   // Performer in HoloSuit
  performer2: `${CDN}/a1dbc9be-8a3a-4761-bd1b-84243c639d72.png`,   // Performer 2
  suitDetail: `${CDN}/a26ff5e6-044c-411c-9ab3-df1716221b6a.png`,   // HoloSuit hardware detail
  holostage:  `${CDN}/cd9bf0aa-e7da-4976-86e5-46144977911d.png`,   // HoloStage capture UI
  performer3: `${CDN}/e7a3b738-0983-4c49-ada3-19fc79cf6189.png`,   // Performer 3
  mobileApp:  `${CDN}/holostage-ui-1.png`,                         // Hologram Show Engine mobile
};

// ─── Helper: Product image block ──────────────────────────────────────────────
function productImg(src: string, alt: string, caption?: string): string {
  return `<tr><td style="padding:16px 0 8px">
    <img src="${src}" width="560" alt="${alt}" style="width:100%;max-width:560px;height:auto;border-radius:14px;display:block;border:1px solid rgba(255,255,255,0.08)"/>
    ${caption ? `<p style="color:#3f3f46;font-size:0.68rem;text-align:center;margin:8px 0 0;font-style:italic">${caption}</p>` : ""}
  </td></tr>`;
}

// ─── Base wrapper ─────────────────────────────────────────────────────────────
function wrapper(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<title>Boostify HoloSuit</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  body,table,td,p,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  body{margin:0;padding:0;background:#030303;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
  table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}
  img{border:0;outline:none;text-decoration:none;display:block}
  a{color:inherit;text-decoration:none}
  .preheader{display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;max-width:0;font-size:1px;overflow:hidden;mso-hide:all}
  @media only screen and (max-width:620px){
    .email-wrap{width:100%!important;padding:0 12px!important}
    .hero-h1{font-size:2rem!important;line-height:1.15!important}
    .stat-cell{width:50%!important;display:inline-block!important}
    .hide-sm{display:none!important;max-height:0!important;overflow:hidden!important}
    .two-col td{display:block!important;width:100%!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#030303">
${preheader ? `<span class="preheader">${preheader}</span>` : ""}
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#030303">
<tr><td align="center" style="padding:36px 16px 56px">
<table class="email-wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%">

<!-- ── LOGO ── -->
<tr><td style="padding:0 0 36px;text-align:center">
  <table cellpadding="0" cellspacing="0" border="0" align="center"><tr>
    <td style="background:linear-gradient(135deg,#f97316 0%,#dc2626 100%);border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;font-weight:900;font-size:1.1rem;color:#fff">B</td>
    <td style="padding-left:10px;vertical-align:middle;color:#fff;font-weight:900;font-size:1.1rem;letter-spacing:-0.04em">BOOSTIFY</td>
    <td style="padding-left:8px;vertical-align:middle"><span style="background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);color:#f97316;font-size:0.58rem;font-weight:700;letter-spacing:0.14em;padding:3px 9px;border-radius:4px">HOLOSUIT</span></td>
  </tr></table>
</td></tr>

${content}

<!-- ── FOOTER ── -->
<tr><td style="padding-top:40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center">
  <p style="color:#3f3f46;font-size:0.7rem;line-height:1.8;margin-bottom:8px">You received this because you were identified as a potential strategic investor in immersive entertainment technology.</p>
  <p style="color:#3f3f46;font-size:0.7rem;margin-bottom:10px">Reply anytime &nbsp;·&nbsp; <a href="mailto:invest@boostifymusic.com" style="color:#52525b">invest@boostifymusic.com</a> &nbsp;·&nbsp; <a href="${APP_URL}/holosuit" style="color:#52525b">Unsubscribe</a></p>
  <p style="color:#27272a;font-size:0.65rem">Boostify Music Inc. &nbsp;·&nbsp; Miami, FL</p>
</td></tr>

</table>
</td></tr></table>
</body>
</html>`;
}

// ─── Helper: CTA button ───────────────────────────────────────────────────────
function ctaBtn(text: string, url: string, bg = "linear-gradient(135deg,#f97316,#ea580c)"): string {
  return `<a href="${url}" style="display:inline-block;background:${bg};color:#fff;font-weight:700;font-size:0.95rem;padding:17px 40px;border-radius:12px;letter-spacing:-0.01em;border:0">${text}</a>`;
}

// ─── Helper: Section eyebrow ──────────────────────────────────────────────────
function eyebrow(text: string, color = "#f97316", bg = "rgba(249,115,22,0.1)", border = "rgba(249,115,22,0.25)"): string {
  return `<div style="display:inline-block;background:${bg};border:1px solid ${border};color:${color};font-size:0.62rem;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:20px">${text}</div>`;
}

// ─── Helper: Divider ──────────────────────────────────────────────────────────
function divider(): string {
  return `<tr><td style="padding:8px 0"><div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08) 20%,rgba(255,255,255,0.08) 80%,transparent)"></div></td></tr>`;
}

// ─── EMAIL 1: The Opening ─────────────────────────────────────────────────────
export function buildEmail1(name: string): { subject: string; html: string } {
  const subject = "We're building the infrastructure for the future of live performance";
  const html = wrapper(`
<!-- ━━ HERO ━━ -->
<tr><td style="padding-bottom:6px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(170deg,#0f0800 0%,#1c0e00 45%,#0a0500 100%);border-radius:20px;border:1px solid rgba(249,115,22,0.15);overflow:hidden">
    <tr><td style="padding:52px 40px 40px;text-align:center">
      ${eyebrow("Boostify HoloSuit · Seed Round · Private Investor Preview")}
      <h1 class="hero-h1" style="font-size:2.6rem;font-weight:900;color:#ffffff;line-height:1.08;letter-spacing:-0.04em;margin:0 0 20px">
        One artist.<br/>Every stage on Earth.<br/><span style="color:#f97316">Simultaneously.</span>
      </h1>
      <p style="color:#a1a1aa;font-size:1rem;line-height:1.75;max-width:430px;margin:0 auto 32px">Hi ${name} — we're Boostify, a Miami-based startup building the world's first end-to-end hologram performance system. We're raising our Seed Round and looking for 50 strategic investors to scale with us.</p>
      ${ctaBtn("See the Product →", `${APP_URL}/holosuit`)}
    </td></tr>
    <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#f97316 30%,#fb923c 70%,transparent)"></td></tr>
  </table>
</td></tr>

<!-- ━━ PRODUCT SCREENSHOT ━━ -->
${productImg(IMGS.dashboard, "HoloStage — Live motion capture + hologram preview in real time", "HoloStage Studio — showing live skeleton tracking + performer hologram preview at 17ms latency")}

<!-- ━━ STATS ROW ━━ -->
<tr><td style="padding:8px 0 16px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="stat-cell" style="padding:6px;width:25%">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(249,115,22,0.2);border-radius:14px;text-align:center"><tr><td style="padding:22px 8px">
          <div style="font-size:2rem;font-weight:900;color:#f97316;line-height:1;letter-spacing:-0.03em">$47B</div>
          <div style="font-size:0.62rem;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-top:8px">Market 2028</div>
        </td></tr></table>
      </td>
      <td class="stat-cell" style="padding:6px;width:25%">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(249,115,22,0.2);border-radius:14px;text-align:center"><tr><td style="padding:22px 8px">
          <div style="font-size:2rem;font-weight:900;color:#f97316;line-height:1;letter-spacing:-0.03em">&lt;17ms</div>
          <div style="font-size:0.62rem;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-top:8px">Live Latency</div>
        </td></tr></table>
      </td>
      <td class="stat-cell" style="padding:6px;width:25%">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(249,115,22,0.2);border-radius:14px;text-align:center"><tr><td style="padding:22px 8px">
          <div style="font-size:2rem;font-weight:900;color:#f97316;line-height:1;letter-spacing:-0.03em">120fps</div>
          <div style="font-size:0.62rem;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-top:8px">Capture Rate</div>
        </td></tr></table>
      </td>
      <td class="stat-cell" style="padding:6px;width:25%">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(249,115,22,0.2);border-radius:14px;text-align:center"><tr><td style="padding:22px 8px">
          <div style="font-size:2rem;font-weight:900;color:#f97316;line-height:1;letter-spacing:-0.03em">3×</div>
          <div style="font-size:0.62rem;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-top:8px">Revenue vs Tour</div>
        </td></tr></table>
      </td>
    </tr>
  </table>
</td></tr>

<!-- ━━ ABOUT THE STARTUP ━━ -->
<tr><td style="padding-bottom:12px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:18px">
    <tr><td style="padding:36px 36px 28px">
      <p style="font-size:0.62rem;font-weight:700;color:#f97316;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:14px">About the Company</p>
      <h2 style="font-size:1.45rem;font-weight:800;color:#ffffff;letter-spacing:-0.03em;line-height:1.3;margin-bottom:18px">Boostify is building the OS<br/>for live hologram performance.</h2>
      <p style="color:#a1a1aa;font-size:0.9rem;line-height:1.8;margin-bottom:16px">We started in Miami with one question: <em style="color:#e4e4e7">why does a world-class artist have to physically travel to every city to perform?</em> HoloSuit is our answer — a full-body motion capture system + AI engine that lets any artist perform as a photorealistic hologram on stages worldwide, simultaneously, from a single studio.</p>
      <p style="color:#a1a1aa;font-size:0.9rem;line-height:1.8">We've built the <strong style="color:#e4e4e7">hardware</strong> (HoloSuit Pro + HoloGloves + HoloFace), the <strong style="color:#e4e4e7">software platform</strong> (HoloStage), and the <strong style="color:#e4e4e7">AI pipeline</strong> — all proprietary, all integrated, all production-ready.</p>
    </td></tr>
    <tr><td style="padding:0 36px 32px">
      <table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:8px"><span style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);color:#fb923c;font-size:0.75rem;font-weight:600;padding:6px 14px;border-radius:8px;white-space:nowrap">⚡ HoloSuit Pro</span></td>
        <td style="padding-right:8px"><span style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);color:#fb923c;font-size:0.75rem;font-weight:600;padding:6px 14px;border-radius:8px;white-space:nowrap">🤲 HoloGloves</span></td>
        <td><span style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);color:#fb923c;font-size:0.75rem;font-weight:600;padding:6px 14px;border-radius:8px;white-space:nowrap">🎭 HoloFace</span></td>
      </tr></table>
    </td></tr>
  </table>
</td></tr>

<!-- ━━ WHAT WE'RE RAISING ━━ -->
<tr><td>
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,rgba(249,115,22,0.12) 0%,rgba(249,115,22,0.04) 100%);border:1px solid rgba(249,115,22,0.22);border-radius:18px">
    <tr><td style="padding:40px 36px;text-align:center">
      <h3 style="color:#ffffff;font-size:1.2rem;font-weight:800;letter-spacing:-0.02em;margin-bottom:10px">We're raising $500K — 50 investor spots</h3>
      <p style="color:#a1a1aa;font-size:0.88rem;line-height:1.7;margin-bottom:28px">This is our <strong style="color:#e4e4e7">Seed Round</strong>. Tiers start at <strong style="color:#f97316">$1,000</strong>. Early backers receive equity, beta hardware access, revenue share options, and direct founder access for the first year of commercial operations.</p>
      ${ctaBtn("Explore Investment Tiers →", `${APP_URL}/holosuit#invest`)}
      <p style="color:#52525b;font-size:0.75rem;margin-top:16px">Or reply directly — I read every email personally.</p>
    </td></tr>
  </table>
</td></tr>
  `, "Boostify is building the infrastructure for live hologram performance — we're raising our Seed Round");
  return { subject, html };
}
// ─── EMAIL 2: Traction & Social Proof ────────────────────────────────────────
export function buildEmail2(name: string): { subject: string; html: string } {
  const subject = `${name}, $145K raised in 38 days — here's why investors moved fast`;
  const html = wrapper(`
<!-- ━━ TRACTION BANNER ━━ -->
<tr><td style="padding-bottom:6px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border-top:3px solid #f97316;border-radius:18px;border:1px solid rgba(255,255,255,0.07)">
    <tr><td style="padding:36px 36px 28px">
      <p style="font-size:0.62rem;font-weight:700;color:#f97316;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:14px">🔥 &nbsp;Traction Update · May 2026</p>
      <h1 style="font-size:2.4rem;font-weight:900;color:#ffffff;letter-spacing:-0.04em;line-height:1.1;margin-bottom:18px">38 investors.<br/>38 days.<br/><span style="color:#f97316">$145,000 raised.</span></h1>
      <p style="color:#a1a1aa;font-size:0.92rem;line-height:1.7">Hi ${name} — in case you missed my first email, I'm reaching out because you have a background in <strong style="color:#e4e4e7">immersive tech, entertainment, or deep-tech investing</strong> — exactly the profile of our current backer cohort.</p>
    </td></tr>
  </table>
</td></tr>

<!-- ━━ PRODUCT IMAGE ━━ -->
${productImg(IMGS.performer1, "Boostify HoloSuit — performer demo", "Real performance captured with HoloSuit Pro · 72 joint nodes · sub-17ms latency")}

<!-- ━━ FUNDING METER ━━ -->
<tr><td style="padding:12px 0">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:16px">
    <tr><td style="padding:28px 32px">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><p style="color:#e4e4e7;font-weight:700;font-size:0.9rem;margin-bottom:4px">Seed Round Progress</p></td>
        <td style="text-align:right"><p style="color:#f97316;font-weight:800;font-size:0.9rem;margin-bottom:4px">29% filled</p></td>
      </tr></table>
      <!-- Track -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1c1c1c;border-radius:999px;height:12px;overflow:hidden;margin:10px 0"><tr>
        <td width="29%" style="background:linear-gradient(90deg,#f97316,#fb923c);height:12px;border-radius:999px"></td>
        <td></td>
      </tr></table>
      <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td><p style="color:#52525b;font-size:0.75rem">$145,000 raised</p></td>
        <td style="text-align:right"><p style="color:#52525b;font-size:0.75rem">Goal: $500,000</p></td>
      </tr></table>
    </td></tr>
  </table>
</td></tr>

<!-- ━━ TESTIMONIALS ━━ -->
<tr><td style="padding-bottom:6px">
  <p style="color:#52525b;font-size:0.65rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;margin-bottom:14px;padding-left:4px">Why they invested — in their words</p>
  ${[
    { init: "JM", name: "J. Morrison", title: "Angel Investor · Los Angeles", quote: "First hardware-to-hologram pipeline I've seen that actually works end-to-end. This is the real deal." },
    { init: "RK", name: "R. Kim", title: "Tech VC · Miami", quote: "The $47B market is real. First-mover with fully proprietary tech is an enormous moat. I wrote the check same day." },
    { init: "AS", name: "A. Sánchez", title: "Entertainment Executive · NYC", quote: "Sub-17ms full-body mocap is genuinely insane. This is 3 years ahead of anything else on the market." },
  ].map(t => `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:14px;margin-bottom:8px">
      <tr><td style="padding:24px 28px">
        <p style="color:#d4d4d8;font-size:0.88rem;font-style:italic;line-height:1.7;margin-bottom:16px">"${t.quote}"</p>
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:linear-gradient(135deg,#f97316,#dc2626);border-radius:50%;width:34px;height:34px;text-align:center;vertical-align:middle;font-size:0.7rem;font-weight:800;color:#fff">${t.init}</td>
          <td style="padding-left:12px;vertical-align:middle">
            <p style="color:#e4e4e7;font-size:0.82rem;font-weight:700;margin-bottom:2px">${t.name}</p>
            <p style="color:#52525b;font-size:0.72rem">${t.title}</p>
          </td>
        </tr></table>
      </td></tr>
    </table>
  `).join("")}
</td></tr>

<!-- ━━ TIERS ━━ -->
<tr><td style="padding:12px 0">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:16px">
    <tr><td style="padding:28px 32px 20px">
      <p style="color:#e4e4e7;font-weight:800;font-size:1rem;margin-bottom:20px">Investment Tiers — Still Open</p>
      ${[
        { icon: "🌱", tier: "Seed Backer", amount: "$1,000", perk: "Early equity + HoloSuit beta access" },
        { icon: "🚀", tier: "Pioneer", amount: "$5,000", perk: "Priority deployment + revenue share" },
        { icon: "🤝", tier: "Strategic Partner", amount: "$25,000", perk: "Advisory role + enhanced equity" },
        { icon: "👑", tier: "Lead Investor", amount: "$100,000", perk: "Board observer + full partner terms" },
      ].map((t, i, arr) => `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="${i < arr.length - 1 ? "border-bottom:1px solid rgba(255,255,255,0.05)" : ""}">
          <tr><td style="padding:14px 0">
            <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
              <td style="font-size:1.3rem;width:38px">${t.icon}</td>
              <td style="padding-left:4px">
                <span style="color:#e4e4e7;font-weight:700;font-size:0.88rem">${t.tier}</span>
                <span style="color:#52525b;font-size:0.8rem"> — ${t.perk}</span>
              </td>
              <td style="text-align:right;white-space:nowrap"><span style="color:#f97316;font-weight:800;font-size:0.9rem">${t.amount}</span></td>
            </tr></table>
          </td></tr>
        </table>
      `).join("")}
    </td></tr>
  </table>
</td></tr>

<!-- ━━ CTA ━━ -->
<tr><td style="padding-top:8px;text-align:center">
  ${ctaBtn("Claim Your Tier Before It Fills →", `${APP_URL}/holosuit#invest`)}
  <p style="color:#52525b;font-size:0.75rem;margin-top:14px">Questions? Just reply — I respond within a few hours.</p>
</td></tr>
  `, "38 investors in 38 days — see the traction and secure your spot");
  return { subject, html };
}

// ─── EMAIL 3: Tech Deep Dive ──────────────────────────────────────────────────
export function buildEmail3(name: string): { subject: string; html: string } {
  const subject = "The tech moat nobody can replicate — a closer look inside HoloSuit";
  const html = wrapper(`
<!-- ━━ TECH HERO ━━ -->
<tr><td style="padding-bottom:6px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(170deg,#05060f 0%,#0a0d1f 45%,#050508 100%);border-radius:20px;border:1px solid rgba(99,102,241,0.2);overflow:hidden">
    <tr><td style="padding:52px 40px 48px;text-align:center">
      ${eyebrow("Technical Deep Dive", "#818cf8", "rgba(99,102,241,0.1)", "rgba(99,102,241,0.25)")}
      <h1 class="hero-h1" style="font-size:2.4rem;font-weight:900;color:#ffffff;line-height:1.1;letter-spacing:-0.04em;margin-bottom:18px">
        Hi ${name} — here's<br/>why this <span style="color:#818cf8">cannot</span> be copied.
      </h1>
      <p style="color:#a1a1aa;font-size:0.95rem;line-height:1.7;max-width:420px;margin:0 auto">Most "hologram" companies rent displays. We own the entire stack — from the <strong style="color:#e4e4e7">atoms</strong> (the suit) to the <strong style="color:#e4e4e7">photons</strong> (the projection).</p>
    </td></tr>
    <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#6366f1 30%,#818cf8 70%,transparent)"></td></tr>
  </table>
</td></tr>

<!-- ━━ PRODUCT SCREENSHOT ━━ -->
${productImg(IMGS.dashboard, "HoloStage — Real-time motion capture interface", "HoloStage Studio · Boostify HoloSuit CONNECTED · 17ms · 120fps · Signal: Excellent")}

<!-- ━━ SPEC CARDS 2×3 ━━ -->
<tr><td style="padding:12px 0">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    ${[
      [["⚡", "Sub-17ms Latency", "Body movement to on-screen hologram. Competitors average 80-120ms."],
       ["🧠", "On-Suit AI Chip", "Edge processing on the suit itself. Zero cloud dependency mid-show."]],
      [["🤲", "72 Joint Nodes", "Full skeleton + finger articulation + facial micro-expressions."],
       ["📡", "Wi-Fi 6 / 5G", "Stage-grade wireless. No cables. Works in arenas and festivals."]],
      [["🛡️", "IP54 Certified", "Sweat, dust, and stage abuse resistant. Built for 8 shows/week."],
       ["🔄", "Live Retargeting", "AI maps performer body to any avatar in <2ms. Any artist. Any look."]],
    ].map(row => `
      <tr>
        ${row.map(([icon, title, desc]) => `
          <td style="padding:6px;width:50%;vertical-align:top">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:14px">
              <tr><td style="padding:24px 22px">
                <div style="font-size:1.8rem;margin-bottom:14px">${icon}</div>
                <div style="color:#e4e4e7;font-weight:700;font-size:0.88rem;margin-bottom:8px">${title}</div>
                <div style="color:#71717a;font-size:0.78rem;line-height:1.6">${desc}</div>
              </td></tr>
            </table>
          </td>
        `).join("")}
      </tr>
    `).join("")}
  </table>
</td></tr>

<!-- ━━ COMPARISON TABLE ━━ -->
<tr><td style="padding:6px 0 12px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:16px">
    <tr><td style="padding:28px 32px">
      <p style="color:#e4e4e7;font-weight:800;font-size:1rem;margin-bottom:20px">HoloSuit vs The Field</p>
      <!-- header row -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr style="border-bottom:1px solid rgba(255,255,255,0.08)">
          <td style="color:#52525b;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;padding-bottom:12px;width:50%">Capability</td>
          <td style="color:#f97316;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;padding-bottom:12px;text-align:center;width:25%">HoloSuit</td>
          <td style="color:#52525b;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;padding-bottom:12px;text-align:center;width:25%">Competitors</td>
        </tr>
        ${[
          ["Full-body + face capture", "✅", "⚠️ Partial"],
          ["Sub-20ms end-to-end latency", "✅", "❌ 80-120ms"],
          ["On-suit edge AI", "✅", "❌ Cloud only"],
          ["Live multi-venue broadcast", "✅", "❌ Single venue"],
          ["Consumer price point", "✅", "❌ $200K+ rigs"],
          ["Proprietary hardware + SW", "✅", "⚠️ Licensed"],
        ].map(([cap, us, them], i, arr) => `
          <tr style="${i < arr.length - 1 ? "border-bottom:1px solid rgba(255,255,255,0.04)" : ""}">
            <td style="color:#a1a1aa;font-size:0.83rem;padding:13px 0">${cap}</td>
            <td style="text-align:center;font-size:0.9rem;padding:13px 8px">${us}</td>
            <td style="text-align:center;font-size:0.83rem;padding:13px 8px;color:#52525b">${them}</td>
          </tr>
        `).join("")}
      </table>
    </td></tr>
  </table>
</td></tr>

<!-- ━━ CTA ━━ -->
<tr><td style="padding-top:8px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,rgba(99,102,241,0.1) 0%,rgba(99,102,241,0.03) 100%);border:1px solid rgba(99,102,241,0.2);border-radius:16px">
    <tr><td style="padding:36px 32px;text-align:center">
      <p style="color:#a1a1aa;font-size:0.9rem;line-height:1.7;margin-bottom:24px">Want a 20-minute technical walkthrough with our CTO?<br/>We walk through the full architecture — live demo included.</p>
      ${ctaBtn("Schedule a Technical Call →", `mailto:invest@boostifymusic.com?subject=Technical+Call+Request`, "linear-gradient(135deg,#6366f1,#4f46e5)")}
    </td></tr>
  </table>
</td></tr>
  `, "Sub-17ms latency, on-suit AI, IP54 — a deeper look at why this is 3 years ahead");
  return { subject, html };
}

// ─── EMAIL 4: The $47B Market ─────────────────────────────────────────────────
export function buildEmail4(name: string): { subject: string; html: string } {
  const subject = "A $47B market that nobody has cracked — until now";
  const html = wrapper(`
<!-- ━━ MARKET HERO ━━ -->
<tr><td style="padding-bottom:6px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(170deg,#020c07 0%,#041510 45%,#020805 100%);border-radius:20px;border:1px solid rgba(16,185,129,0.18);overflow:hidden">
    <tr><td style="padding:52px 40px 20px;text-align:center">
      ${eyebrow("Market Opportunity", "#34d399", "rgba(16,185,129,0.1)", "rgba(16,185,129,0.25)")}
      <p style="font-size:4.5rem;font-weight:900;color:#10b981;line-height:1;letter-spacing:-0.05em;margin-bottom:4px">$47B</p>
      <p style="color:#71717a;font-size:0.8rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:24px">Immersive Entertainment Market · 2028</p>
      <p style="color:#a1a1aa;font-size:0.95rem;line-height:1.7;max-width:430px;margin:0 auto">Hi ${name} — the immersive entertainment market is exploding. Here's the precise breakdown of where HoloSuit fits — and why the timing is critical.</p>
    </td></tr>
    <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#10b981 30%,#34d399 70%,transparent)"></td></tr>
  </table>
</td></tr>

<!-- ━━ TAM / SAM / SOM ━━ -->
<tr><td style="padding:12px 0">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding:6px;width:33.3%;vertical-align:top">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(16,185,129,0.2);border-radius:14px;text-align:center"><tr><td style="padding:24px 8px">
          <p style="color:#52525b;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;margin-bottom:10px">TAM</p>
          <p style="font-size:1.9rem;font-weight:900;color:#10b981;letter-spacing:-0.03em;line-height:1;margin-bottom:8px">$47B</p>
          <p style="color:#71717a;font-size:0.72rem">Total market 2028</p>
        </td></tr></table>
      </td>
      <td style="padding:6px;width:33.3%;vertical-align:top">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(16,185,129,0.2);border-radius:14px;text-align:center"><tr><td style="padding:24px 8px">
          <p style="color:#52525b;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;margin-bottom:10px">SAM</p>
          <p style="font-size:1.9rem;font-weight:900;color:#34d399;letter-spacing:-0.03em;line-height:1;margin-bottom:8px">$8.2B</p>
          <p style="color:#71717a;font-size:0.72rem">Live performance tech</p>
        </td></tr></table>
      </td>
      <td style="padding:6px;width:33.3%;vertical-align:top">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(249,115,22,0.2);border-radius:14px;text-align:center"><tr><td style="padding:24px 8px">
          <p style="color:#52525b;font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.14em;margin-bottom:10px">SOM Yr3</p>
          <p style="font-size:1.9rem;font-weight:900;color:#f97316;letter-spacing:-0.03em;line-height:1;margin-bottom:8px">$1.4B</p>
          <p style="color:#71717a;font-size:0.72rem">Serviceable target</p>
        </td></tr></table>
      </td>
    </tr>
  </table>
</td></tr>

<!-- ━━ PRODUCT IMAGE ━━ -->
${productImg(IMGS.mobileApp, "Hologram Live Show Engine — Boostify Mobile Platform", "HoloStage mobile app · Powered by Boostify AI · Available on iOS & Android")}

<!-- ━━ MARKET FORCES ━━ -->
<tr><td style="padding-bottom:12px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:16px">
    <tr><td style="padding:28px 32px">
      <p style="color:#e4e4e7;font-weight:800;font-size:1rem;margin-bottom:22px">5 Forces Driving This Market</p>
      ${[
        ["🎵", "Post-Pandemic Live Revenue Surge", "Live music hit $31B globally in 2025 — 40% above 2019 highs. Artists want more shows, not more travel."],
        ["🤖", "AI Avatar Mainstream Acceptance", "ABBA Voyage: 1M+ tickets. The Weeknd AI concert: sold out in 6 minutes. Audiences are ready now."],
        ["🌐", "5G + Wi-Fi 6 Global Infrastructure", "The wireless backbone required for real-time hologram broadcast now exists in every major venue."],
        ["📺", "Streaming Platforms Hungry for Live XR", "Netflix, Apple TV+, and Amazon are actively investing in live immersive content formats."],
        ["💰", "Venue Owner ROI", "Hologram concerts need zero artist travel, no rider, no production crew. 3× margin vs. physical shows."],
      ].map(([icon, title, desc], i, arr) => `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="${i < arr.length - 1 ? "border-bottom:1px solid rgba(255,255,255,0.05)" : ""}">
          <tr><td style="padding:16px 0">
            <table cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="font-size:1.5rem;vertical-align:top;padding-right:16px;width:36px">${icon}</td>
              <td style="vertical-align:top">
                <p style="color:#e4e4e7;font-weight:700;font-size:0.88rem;margin-bottom:5px">${title}</p>
                <p style="color:#71717a;font-size:0.8rem;line-height:1.6">${desc}</p>
              </td>
            </tr></table>
          </td></tr>
        </table>
      `).join("")}
    </td></tr>
  </table>
</td></tr>

<!-- ━━ REVENUE MODEL ━━ -->
<tr><td style="padding-bottom:12px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:16px">
    <tr><td style="padding:28px 32px">
      <p style="color:#e4e4e7;font-weight:800;font-size:1rem;margin-bottom:20px">Revenue Model</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${[
          ["Hardware Sales", "$15K–$45K / unit + upgrade cycle"],
          ["HoloStage SaaS", "$2,500/mo per venue · white-label"],
          ["Per-Show Revenue Share", "5% of gross hologram concert revenue"],
          ["IP Licensing", "Avatar + motion data library, per-use"],
        ].map(([stream, detail], i, arr) => `
          <tr style="${i < arr.length - 1 ? "border-bottom:1px solid rgba(255,255,255,0.04)" : ""}">
            <td style="padding:13px 0;width:50%">
              <table cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="background:#f97316;border-radius:50%;width:7px;height:7px;vertical-align:middle;padding-right:12px"></td>
                <td style="color:#d4d4d8;font-size:0.85rem;font-weight:600;vertical-align:middle">${stream}</td>
              </tr></table>
            </td>
            <td style="padding:13px 0 13px 16px;color:#52525b;font-size:0.78rem;text-align:right">${detail}</td>
          </tr>
        `).join("")}
      </table>
    </td></tr>
  </table>
</td></tr>

<!-- ━━ CTA ━━ -->
<tr><td style="text-align:center;padding-bottom:4px">
  ${ctaBtn("See Full Investor Deck →", `${APP_URL}/holosuit`, "linear-gradient(135deg,#10b981,#059669)")}
  <p style="color:#52525b;font-size:0.75rem;margin-top:14px">One more email coming — our final round update and closing terms.</p>
</td></tr>
  `, "The $47B immersive entertainment market has a first-mover — here's the breakdown");
  return { subject, html };
}

// ─── EMAIL 5: The Close ───────────────────────────────────────────────────────
export function buildEmail5(name: string): { subject: string; html: string } {
  const subject = `${name} — Seed round closes in 72 hours. Last call.`;
  const html = wrapper(`
<!-- ━━ URGENCY BANNER ━━ -->
<tr><td style="padding-bottom:6px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:12px">
    <tr><td style="padding:14px 24px;text-align:center">
      <span style="color:#fca5a5;font-size:0.72rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase">⏱ &nbsp;ROUND CLOSES IN 72 HOURS — FINAL EMAIL</span>
    </td></tr>
  </table>
</td></tr>

<!-- ━━ CLOSING HERO ━━ -->
<tr><td style="padding-bottom:6px;padding-top:6px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(170deg,#0f0500 0%,#1e0900 45%,#0a0300 100%);border-radius:20px;border:1px solid rgba(239,68,68,0.18);overflow:hidden">
    <tr><td style="padding:52px 40px 48px;text-align:center">
      <h1 class="hero-h1" style="font-size:2.5rem;font-weight:900;color:#ffffff;line-height:1.1;letter-spacing:-0.04em;margin-bottom:20px">
        This is the last email<br/>you'll get from me,<br/><span style="color:#f97316">${name}.</span>
      </h1>
      <p style="color:#a1a1aa;font-size:0.95rem;line-height:1.7;max-width:420px;margin:0 auto">I've shared the technology, the market, the traction, and the team. Our Seed Round closes in <strong style="color:#fca5a5">72 hours</strong>. The decision is yours.</p>
    </td></tr>
    <tr><td style="height:3px;background:linear-gradient(90deg,transparent,#ef4444 30%,#f97316 70%,transparent)"></td></tr>
  </table>
</td></tr>

<!-- ━━ COUNTDOWN STATS ━━ -->
<tr><td style="padding:12px 0">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding:6px;width:25%">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(239,68,68,0.25);border-radius:14px;text-align:center"><tr><td style="padding:22px 8px">
          <div style="font-size:2.2rem;font-weight:900;color:#ef4444;line-height:1;letter-spacing:-0.03em">11</div>
          <div style="font-size:0.6rem;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-top:8px">Spots Left</div>
        </td></tr></table>
      </td>
      <td style="padding:6px;width:25%">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(249,115,22,0.2);border-radius:14px;text-align:center"><tr><td style="padding:22px 8px">
          <div style="font-size:2.2rem;font-weight:900;color:#f97316;line-height:1;letter-spacing:-0.03em">72h</div>
          <div style="font-size:0.6rem;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-top:8px">Until Close</div>
        </td></tr></table>
      </td>
      <td style="padding:6px;width:25%">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(249,115,22,0.2);border-radius:14px;text-align:center"><tr><td style="padding:22px 8px">
          <div style="font-size:2.2rem;font-weight:900;color:#f97316;line-height:1;letter-spacing:-0.03em">$355K</div>
          <div style="font-size:0.6rem;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-top:8px">Still Available</div>
        </td></tr></table>
      </td>
      <td style="padding:6px;width:25%">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(249,115,22,0.2);border-radius:14px;text-align:center"><tr><td style="padding:22px 8px">
          <div style="font-size:2.2rem;font-weight:900;color:#f97316;line-height:1;letter-spacing:-0.03em">38</div>
          <div style="font-size:0.6rem;color:#52525b;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-top:8px">Investors In</div>
        </td></tr></table>
      </td>
    </tr>
  </table>
</td></tr>

<!-- ━━ BENEFITS ━━ -->
<tr><td style="padding-bottom:12px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0d;border:1px solid rgba(255,255,255,0.07);border-radius:16px">
    <tr><td style="padding:28px 32px">
      <p style="color:#e4e4e7;font-weight:800;font-size:1rem;margin-bottom:22px">If you invest in the next 72 hours, you lock in:</p>
      ${[
        ["🏆", "Founding Investor Status", "Your name in every future deck, press release, and investor update — permanently."],
        ["📈", "Pre-Valuation Pricing", "Equity at current terms. Next round will be 3–5× higher. This window closes once."],
        ["🎮", "HoloSuit Beta Unit", "First physical HoloSuit shipped to Seed Backers at $1K+ tier (while supply lasts)."],
        ["🤝", "Direct Founder Access", "Monthly founder calls for the first year. You help shape the product roadmap."],
        ["💸", "Revenue Share Option", "Pioneer+ investors participate in platform revenue from day 1 of commercial launch."],
      ].map(([icon, title, desc], i, arr) => `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="${i < arr.length - 1 ? "border-bottom:1px solid rgba(255,255,255,0.05)" : ""}">
          <tr><td style="padding:15px 0">
            <table cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="font-size:1.4rem;vertical-align:top;padding-right:16px;width:36px">${icon}</td>
              <td style="vertical-align:top">
                <p style="color:#e4e4e7;font-weight:700;font-size:0.88rem;margin-bottom:4px">${title}</p>
                <p style="color:#71717a;font-size:0.8rem;line-height:1.55">${desc}</p>
              </td>
            </tr></table>
          </td></tr>
        </table>
      `).join("")}
    </td></tr>
  </table>
</td></tr>

<!-- ━━ PERSONAL NOTE ━━ -->
<tr><td style="padding-bottom:12px">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:linear-gradient(135deg,rgba(249,115,22,0.08),rgba(249,115,22,0.02));border:1px solid rgba(249,115,22,0.18);border-radius:16px">
    <tr><td style="padding:32px 36px">
      <p style="color:#d4d4d8;font-size:0.92rem;line-height:1.8;margin-bottom:16px">${name} — we've built something genuinely new. Not a demo, not a roadmap. A <strong style="color:#fff">working system</strong> already tested with artists, venue operators, and broadcasting partners.</p>
      <p style="color:#d4d4d8;font-size:0.92rem;line-height:1.8;margin-bottom:20px">The people who move first in category-defining technology are the ones history remembers — and rewards financially.</p>
      <p style="color:#f97316;font-weight:700;font-size:0.9rem">— The Boostify Team</p>
    </td></tr>
  </table>
</td></tr>

<!-- ━━ PRODUCT IMAGE ━━ -->
${productImg(IMGS.performer2, "Boostify HoloSuit — artist performance capture", "The last performance system you'll ever need to build")}

<!-- ━━ DOUBLE CTA ━━ -->
<tr><td style="text-align:center">
  ${ctaBtn("🔐  Secure My Founding Investor Spot →", `${APP_URL}/holosuit#invest`)}
  <p style="margin-top:18px"><a href="mailto:invest@boostifymusic.com?subject=Investor+Inquiry+from+${encodeURIComponent(name)}" style="color:#52525b;font-size:0.82rem;text-decoration:underline">Or reply directly — I read every single one.</a></p>
</td></tr>
  `, "Seed round closes in 72 hours — this is the last call for founding investor pricing");
  return { subject, html };
}

// ─── Lead / Investor Notification Emails ─────────────────────────────────────
export function buildOwnerLeadAlert(lead: {
  name: string; email: string; company?: string; tier: string; message?: string; source: string
}): { subject: string; html: string } {
  const subject = `🔥 NEW HOLOSUIT LEAD — ${lead.name} — ${lead.tier.toUpperCase()} TIER`;
  const html = wrapper(`
    <div style="background:linear-gradient(135deg,rgba(249,115,22,0.15),rgba(249,115,22,0.05));border:2px solid rgba(249,115,22,0.4);border-radius:20px;padding:36px 32px;margin-bottom:24px;text-align:center">
      <div style="font-size:2.5rem;margin-bottom:12px">🔥</div>
      <h1 style="color:#fff;font-size:1.8rem;font-weight:900;letter-spacing:-0.03em;margin-bottom:8px">New Investor Lead!</h1>
      <p style="color:${ORANGE};font-weight:700;font-size:1rem">${lead.source === 'stripe' ? 'PAYMENT COMPLETED' : 'Form Submitted'}</p>
    </div>
    <div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:16px;padding:28px">
      ${[
        ["👤 Name", lead.name],
        ["📧 Email", lead.email],
        ["🏢 Company", lead.company || "—"],
        ["💎 Tier", lead.tier],
        ["📝 Message", lead.message || "—"],
        ["📌 Source", lead.source],
      ].map(([label, value]) => `
        <div style="display:flex;gap:16px;padding:12px 0;border-bottom:1px solid #111">
          <span style="color:#6b7280;font-size:0.85rem;width:120px;flex-shrink:0">${label}</span>
          <span style="color:#fff;font-size:0.85rem;font-weight:600">${value}</span>
        </div>
      `).join("")}
    </div>
    <div style="text-align:center;margin-top:24px">
      <a href="mailto:${lead.email}?subject=Welcome to Boostify HoloSuit — Next Steps" style="display:inline-block;background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;font-weight:700;font-size:0.9rem;padding:14px 28px;border-radius:10px">📬 Reply to ${lead.name}</a>
    </div>
  `);
  return { subject, html };
}

export function buildLeadConfirmation(lead: { name: string; tier: string }): { subject: string; html: string } {
  const tierAmounts: Record<string, string> = {
    seed: "$1,000", pioneer: "$5,000", partner: "$25,000", lead: "$100,000"
  };
  const subject = "Your HoloSuit investment interest is confirmed — here's what's next";
  const html = wrapper(`
    <div style="background:${CARD_BG};border:1px solid rgba(249,115,22,0.25);border-radius:20px;padding:44px 32px;text-align:center;margin-bottom:24px">
      <div style="font-size:2.5rem;margin-bottom:16px">✅</div>
      <h1 style="color:#fff;font-size:1.8rem;font-weight:900;letter-spacing:-0.03em;margin-bottom:12px">
        We received your interest, ${lead.name}.
      </h1>
      <p style="color:#9ca3af;font-size:0.95rem;line-height:1.65;max-width:440px;margin:0 auto">
        You've expressed interest in the <strong style="color:${ORANGE}">${lead.tier.charAt(0).toUpperCase() + lead.tier.slice(1)} Tier (${tierAmounts[lead.tier] || lead.tier})</strong>. Our team will be in touch within 24 hours with next steps.
      </p>
    </div>
    <div style="background:${CARD_BG};border:1px solid ${BORDER};border-radius:16px;padding:28px;margin-bottom:24px">
      <h2 style="color:#fff;font-size:1rem;font-weight:800;margin-bottom:16px">What happens next:</h2>
      ${["Within 24h — Personal reply from our team", "Within 48h — Investor pack + term sheet delivered", "Within 72h — Optional founder call scheduled", "On close — Equity docs and confirmation"].map((step, i) => `
        <div style="display:flex;gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid #111">
          <div style="width:28px;height:28px;border-radius:50%;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <span style="color:${ORANGE};font-size:0.75rem;font-weight:800">${i + 1}</span>
          </div>
          <span style="color:#d1d5db;font-size:0.88rem">${step}</span>
        </div>
      `).join("")}
    </div>
    <div style="text-align:center">
      ${ctaBtn("View Your Investment Tier →", `${APP_URL}/holosuit#invest`)}
    </div>
  `);
  return { subject, html };
}

// ─── Preview: send all 5 emails to a single address for approval ──────────────
export async function sendSequencePreview(previewEmail: string): Promise<void> {
  const dummyName = "Alex";
  const emails = [
    buildEmail1(dummyName),
    buildEmail2(dummyName),
    buildEmail3(dummyName),
    buildEmail4(dummyName),
    buildEmail5(dummyName),
  ];

  for (let i = 0; i < emails.length; i++) {
    const { subject, html } = emails[i];
    const result = await sendViaResend(
      previewEmail,
      `[PREVIEW ${i + 1}/5] ${subject}`,
      html
    );
    if (result.success) {
      console.log(`✅ Preview email ${i + 1}/5 sent — id: ${result.id}`);
    } else {
      console.error(`❌ Preview email ${i + 1}/5 failed:`, result.error);
    }
    // small delay to avoid rate limit
    await new Promise(r => setTimeout(r, 800));
  }
}

// ─── Core send function ───────────────────────────────────────────────────────
export async function sendOutreachEmail(
  contact: { id: number; name: string; email: string },
  step: number
): Promise<SendResult> {
  const builders = [buildEmail1, buildEmail2, buildEmail3, buildEmail4, buildEmail5];
  if (step < 1 || step > 5) return { success: false, error: "Invalid step" };
  const { subject, html } = builders[step - 1](contact.name);
  return sendViaResend(contact.email, subject, html);
}

export async function notifyOwnerOfLead(lead: {
  name: string; email: string; company?: string; tier: string; message?: string; source: string
}): Promise<SendResult> {
  const { subject, html } = buildOwnerLeadAlert(lead);
  return sendViaResend(OWNER_EMAIL, subject, html);
}

export async function sendLeadConfirmationEmail(lead: { name: string; email: string; tier: string }): Promise<SendResult> {
  const { subject, html } = buildLeadConfirmation(lead);
  return sendViaResend(lead.email, subject, html, [OWNER_EMAIL]);
}
