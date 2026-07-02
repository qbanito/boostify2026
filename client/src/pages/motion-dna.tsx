/**
 * Boostify MotionDNA — Landing page
 * Aligned 1:1 with the BOOSTIFY DATASET STUDIO landing (landing/index.html).
 * Assets served from /motion-dna/assets (copied from the Dataset Studio project).
 * "Try the model" opens the static demo at /motion-dna/try.html.
 * Beta form stays connected to the existing Make.com webhook.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

const A = "/motion-dna/assets";
const RELEASES_URL = "https://github.com/qbanito/boostifymodel/releases/latest";
const RELEASES_PAGE = "https://github.com/qbanito/boostifymodel/releases";

const CSS = `
.mdna { margin:0; background:#0b0d10; color:#e7ecf2; font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif; line-height:1.6; -webkit-font-smoothing:antialiased; min-height:100vh;
  --bg:#0b0d10; --surface:#121519; --surface2:#171b21; --border:#232932; --fg:#e7ecf2; --muted:#8b97a6; --accent:#ff6a2b; --accent2:#ffb02e; --good:#39d98a; --info:#4ea8ff; }
.mdna * { box-sizing:border-box; }
.mdna a { color:inherit; text-decoration:none; }
.mdna .wrap { max-width:1120px; margin:0 auto; padding:0 24px; }
.mdna .glow { position:fixed; inset:0; z-index:0; pointer-events:none;
  background:radial-gradient(700px 460px at 72% -10%, rgba(255,106,43,.2), transparent 60%), radial-gradient(560px 380px at 8% 6%, rgba(255,176,46,.1), transparent 60%); }
.mdna .content { position:relative; z-index:1; }
.mdna header.mdna-hdr { display:flex; align-items:center; justify-content:space-between; padding:20px 0; position:sticky; top:0; z-index:20; background:rgba(11,13,16,.72); backdrop-filter:blur(12px); border-bottom:1px solid transparent; }
.mdna header.mdna-hdr.scrolled { border-bottom-color:var(--border); }
.mdna .brand { display:flex; align-items:center; gap:12px; font-weight:700; letter-spacing:-.02em; font-size:17px; }
.mdna .logo { width:38px; height:38px; border-radius:10px; background:linear-gradient(135deg,var(--accent),var(--accent2)); display:grid; place-items:center; box-shadow:0 8px 24px rgba(255,106,43,.35); flex:none; }
.mdna .brand small { display:block; font-weight:500; font-size:11px; color:var(--muted); letter-spacing:.04em; text-transform:uppercase; }
.mdna .nav-links { display:flex; align-items:center; gap:26px; font-size:14px; color:var(--muted); }
.mdna .nav-links a:hover { color:var(--fg); }
.mdna .nav-toggle { display:none; position:relative; width:44px; height:44px; border-radius:11px; border:1px solid var(--border); background:var(--surface2); color:var(--fg); cursor:pointer; align-items:center; justify-content:center; flex:none; transition:border-color .15s ease, background .15s ease; }
.mdna .nav-toggle:hover { border-color:var(--accent); }
.mdna .nav-toggle .bars, .mdna .nav-toggle .bars::before, .mdna .nav-toggle .bars::after { content:""; display:block; position:absolute; left:50%; width:20px; height:2px; margin-left:-10px; background:currentColor; border-radius:2px; transition:transform .25s ease, opacity .2s ease; }
.mdna .nav-toggle .bars { top:50%; margin-top:-1px; }
.mdna .nav-toggle .bars::before { top:-7px; }
.mdna .nav-toggle .bars::after { top:7px; }
.mdna header.mdna-hdr.menu-open .nav-toggle .bars { background:transparent; }
.mdna header.mdna-hdr.menu-open .nav-toggle .bars::before { top:0; transform:rotate(45deg); }
.mdna header.mdna-hdr.menu-open .nav-toggle .bars::after { top:0; transform:rotate(-45deg); }
.mdna .btn { display:inline-flex; align-items:center; justify-content:center; gap:10px; padding:13px 22px; border-radius:11px; font-size:15px; font-weight:600; border:1px solid var(--border); background:var(--surface2); color:var(--fg); transition:transform .15s ease, border-color .15s ease, box-shadow .2s ease, opacity .15s ease; cursor:pointer; font-family:inherit; }
.mdna .btn svg { width:18px; height:18px; }
.mdna .btn:hover { transform:translateY(-2px); border-color:#3a424e; }
.mdna .btn.primary { background:linear-gradient(135deg,var(--accent),var(--accent2)); border-color:transparent; color:#160a02; box-shadow:0 12px 30px rgba(255,106,43,.3); }
.mdna .btn.sm { padding:9px 16px; font-size:14px; }
.mdna .hero { text-align:center; padding:84px 0 40px; position:relative; z-index:1; }
.mdna .hero-bg { position:absolute; left:50%; top:-40px; transform:translateX(-50%); width:100vw; height:calc(100% + 120px); z-index:-1; overflow:hidden; pointer-events:none;
  -webkit-mask-image:radial-gradient(120% 100% at 50% 35%, #000 45%, transparent 80%); mask-image:radial-gradient(120% 100% at 50% 35%, #000 45%, transparent 80%); }
.mdna .hero-bg video { width:100%; height:100%; object-fit:cover; opacity:.5; }
.mdna .showcase { position:relative; max-width:940px; margin:8px auto 0; border-radius:20px; overflow:hidden; border:1px solid var(--border); box-shadow:0 30px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,106,43,.08); background:#000; }
.mdna .showcase video { display:block; width:100%; height:auto; }
.mdna .showcase .ring { position:absolute; inset:0; pointer-events:none; border-radius:20px; box-shadow:inset 0 0 0 1px rgba(255,255,255,.06); }
.mdna .media-frame { border-radius:14px; overflow:hidden; border:1px solid var(--border); margin-bottom:18px; background:#000; }
.mdna .media-frame img { display:block; width:100%; height:auto; }
.mdna .gallery { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; max-width:900px; margin:8px auto 36px; }
.mdna .gallery figure { margin:0; border-radius:14px; overflow:hidden; border:1px solid var(--border); background:#000; aspect-ratio:1/1; }
.mdna .gallery img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .5s ease; }
.mdna .gallery figure:hover img { transform:scale(1.07); }
.mdna .pill { display:inline-flex; align-items:center; gap:8px; padding:6px 15px; border:1px solid var(--border); background:var(--surface); border-radius:999px; font-size:13px; color:var(--muted); margin-bottom:28px; }
.mdna .pill .dot { width:7px; height:7px; border-radius:50%; background:var(--good); box-shadow:0 0 0 3px rgba(57,217,138,.18); }
.mdna h1 { font-size:clamp(36px,6.4vw,66px); line-height:1.04; letter-spacing:-.035em; margin:0 0 22px; font-weight:800; }
.mdna .grad { background:linear-gradient(120deg,var(--accent),var(--accent2)); -webkit-background-clip:text; background-clip:text; color:transparent; }
.mdna .sub { max-width:720px; margin:0 auto 38px; font-size:clamp(16px,2.4vw,20px); color:var(--muted); }
.mdna .hero-cta { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
.mdna .req { margin-top:18px; font-size:13px; color:var(--muted); }
.mdna .dl-buttons { display:flex; gap:16px; justify-content:center; flex-wrap:wrap; margin-top:8px; }
.mdna .dl { display:inline-flex; align-items:center; gap:13px; padding:16px 26px; border-radius:14px; border:1px solid var(--border); background:var(--surface2); color:var(--fg); min-width:230px; transition:transform .15s ease, border-color .15s ease, box-shadow .2s ease; }
.mdna .dl:hover { transform:translateY(-2px); border-color:#3a424e; }
.mdna .dl svg { width:28px; height:28px; flex:none; }
.mdna .dl .lbl { text-align:left; line-height:1.2; }
.mdna .dl .lbl small { display:block; font-size:11.5px; color:var(--muted); font-weight:500; }
.mdna .dl .lbl b { font-size:16px; font-weight:700; }
.mdna .dl.primary { background:linear-gradient(135deg,var(--accent),var(--accent2)); border-color:transparent; color:#160a02; box-shadow:0 12px 30px rgba(255,106,43,.3); }
.mdna .dl.primary .lbl small { color:rgba(22,10,2,.7); }
.mdna .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; max-width:760px; margin:56px auto 0; }
.mdna .stat { border:1px solid var(--border); background:var(--surface); border-radius:14px; padding:22px 14px; }
.mdna .stat .v { font-size:clamp(22px,3vw,30px); font-weight:800; letter-spacing:-.02em; }
.mdna .stat .v.grad { background:linear-gradient(120deg,var(--accent),var(--accent2)); -webkit-background-clip:text; background-clip:text; color:transparent; }
.mdna .stat .k { font-size:12.5px; color:var(--muted); margin-top:4px; }
.mdna section.block { padding:84px 0; }
.mdna .eyebrow { color:var(--accent2); font-weight:600; font-size:13px; letter-spacing:.1em; text-transform:uppercase; text-align:center; }
.mdna h2 { text-align:center; font-size:clamp(27px,4.2vw,40px); letter-spacing:-.025em; margin:12px auto 18px; max-width:760px; }
.mdna .lead { text-align:center; color:var(--muted); max-width:720px; margin:0 auto 50px; font-size:17px; }
.mdna .grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
.mdna .grid-2 { display:grid; grid-template-columns:repeat(2,1fr); gap:18px; }
.mdna .card { border:1px solid var(--border); background:var(--surface); border-radius:16px; padding:26px; transition:border-color .2s ease, transform .2s ease; }
.mdna .card:hover { border-color:#3a424e; transform:translateY(-3px); }
.mdna .card .ic { width:46px; height:46px; border-radius:12px; display:grid; place-items:center; background:rgba(255,106,43,.12); color:var(--accent2); margin-bottom:18px; }
.mdna .card h3 { margin:0 0 9px; font-size:18px; letter-spacing:-.01em; }
.mdna .card p { margin:0; font-size:14.5px; color:var(--muted); }
.mdna .split { display:grid; grid-template-columns:1.05fr .95fr; gap:48px; align-items:center; }
.mdna .split h2, .mdna .split .eyebrow { text-align:left; }
.mdna .split h2 { margin-left:0; }
.mdna .split p.body { color:var(--muted); font-size:16.5px; margin:0 0 26px; }
.mdna .check { list-style:none; padding:0; margin:0; display:grid; gap:14px; }
.mdna .check li { display:flex; gap:13px; align-items:flex-start; font-size:15.5px; }
.mdna .check li .tick { flex:none; width:24px; height:24px; border-radius:7px; background:rgba(57,217,138,.14); color:var(--good); display:grid; place-items:center; margin-top:2px; }
.mdna .panel { border:1px solid var(--border); border-radius:18px; background:radial-gradient(400px 240px at 80% 0%, rgba(255,106,43,.12), transparent 70%), var(--surface); padding:32px; }
.mdna .panel .row { display:flex; align-items:center; gap:14px; padding:14px 0; border-bottom:1px solid var(--border); }
.mdna .panel .row:last-child { border-bottom:none; }
.mdna .panel .row .n { flex:none; width:34px; height:34px; border-radius:9px; background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#160a02; font-weight:800; display:grid; place-items:center; font-size:14px; }
.mdna .panel .row b { font-size:15px; }
.mdna .panel .row span { display:block; font-size:13px; color:var(--muted); }
.mdna .steps { display:grid; grid-template-columns:repeat(5,1fr); gap:14px; }
.mdna .step { border:1px solid var(--border); background:var(--surface); border-radius:14px; padding:22px 18px; position:relative; }
.mdna .step .num { width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg,var(--accent),var(--accent2)); color:#160a02; font-weight:800; display:grid; place-items:center; margin-bottom:14px; }
.mdna .step h4 { margin:0 0 6px; font-size:15px; }
.mdna .step p { margin:0; font-size:13px; color:var(--muted); }
.mdna .feat { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.mdna .feat .item { display:flex; gap:14px; align-items:flex-start; border:1px solid var(--border); background:var(--surface); border-radius:13px; padding:18px 20px; }
.mdna .feat .item .tick { flex:none; width:26px; height:26px; border-radius:8px; background:rgba(255,106,43,.14); color:var(--accent2); display:grid; place-items:center; margin-top:1px; }
.mdna .feat .item b { font-size:15px; }
.mdna .feat .item span { color:var(--muted); font-size:14px; }
.mdna .beta { border:1px solid var(--border); border-radius:22px; background:radial-gradient(560px 320px at 50% 0%, rgba(255,106,43,.14), transparent 70%), var(--surface); padding:56px 40px; }
.mdna .beta .head { text-align:center; margin-bottom:40px; }
.mdna .form { max-width:640px; margin:0 auto; display:grid; gap:16px; }
.mdna .field { display:grid; gap:7px; }
.mdna .field.two { grid-template-columns:1fr 1fr; gap:16px; display:grid; }
.mdna label { font-size:13px; color:var(--muted); font-weight:500; }
.mdna input, .mdna select, .mdna textarea { width:100%; background:var(--bg); border:1px solid var(--border); color:var(--fg); border-radius:11px; padding:13px 15px; font-size:15px; font-family:inherit; transition:border-color .15s ease, box-shadow .15s ease; }
.mdna input:focus, .mdna select:focus, .mdna textarea:focus { outline:none; border-color:var(--accent); box-shadow:0 0 0 3px rgba(255,106,43,.18); }
.mdna textarea { resize:vertical; min-height:96px; }
.mdna .form .btn.primary { padding:15px; font-size:16px; margin-top:6px; }
.mdna .form-note { text-align:center; font-size:12.5px; color:var(--muted); margin-top:2px; }
.mdna .success { text-align:center; border:1px solid rgba(57,217,138,.4); background:rgba(57,217,138,.08); border-radius:14px; padding:30px; max-width:640px; margin:0 auto; }
.mdna .success .ico { width:54px; height:54px; border-radius:50%; background:rgba(57,217,138,.16); color:var(--good); display:grid; place-items:center; margin:0 auto 16px; }
.mdna .success h3 { margin:0 0 8px; font-size:20px; }
.mdna .success p { margin:0; color:var(--muted); }
.mdna footer.mdna-ftr { border-top:1px solid var(--border); padding:34px 0; margin-top:30px; color:var(--muted); font-size:13px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px; }
.mdna footer.mdna-ftr a:hover { color:var(--fg); }
@media (max-width:900px){ .mdna .steps{grid-template-columns:repeat(2,1fr);} .mdna .split{grid-template-columns:1fr; gap:32px;} }
@media (max-width:760px){
  .mdna header.mdna-hdr .wrap{position:relative;}
  .mdna .nav-toggle{display:inline-flex;}
  .mdna .nav-links{position:absolute; top:calc(100% + 14px); right:0; min-width:232px; max-width:calc(100vw - 40px); flex-direction:column; align-items:stretch; gap:4px; padding:10px; background:var(--surface); border:1px solid var(--border); border-radius:14px; box-shadow:0 18px 50px rgba(0,0,0,.55); opacity:0; transform:translateY(-8px); pointer-events:none; transition:opacity .2s ease, transform .2s ease; z-index:60;}
  .mdna header.mdna-hdr.menu-open .nav-links{opacity:1; transform:none; pointer-events:auto;}
  .mdna .nav-links a{padding:12px 14px; border-radius:10px; font-size:15px; color:var(--fg);}
  .mdna .nav-links a:not(.btn):hover{background:var(--surface2);}
  .mdna .nav-links a.btn{width:100%; justify-content:center; margin-top:4px;}
  .mdna .grid-3, .mdna .grid-2, .mdna .feat{grid-template-columns:1fr;}
  .mdna .stats{grid-template-columns:repeat(2,1fr);}
  .mdna .field.two{grid-template-columns:1fr;}
  .mdna .beta{padding:40px 22px;}
  .mdna .gallery{grid-template-columns:1fr; max-width:380px;}
}
@media (prefers-reduced-motion:reduce){ .mdna .hero-bg video, .mdna .showcase video{display:none;} }
`;

const Tick = ({ w = 14 }: { w?: number }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
);
const PlayIco = ({ w = 15 }: { w?: number }) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M8 5v14l11-7z" /></svg>
);
const WaveLogo = ({ s = 22 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
    <path d="M8 20c2-8 4-8 6 0s4 8 6 0" stroke="#0b0d10" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function MotionDNAPage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const isWindows = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const plat = navigator.platform || "";
    return (/Win/i.test(plat) || /Windows/i.test(ua)) && !/Mac/i.test(plat);
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = "Boostify MotionDNA — The Motion Model Trained on 700+ Real Music Videos";
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll);
    return () => {
      document.title = prev;
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    setIsSubmitting(true);
    const fd = new FormData(form);
    try {
      const res = await fetch("https://hook.us2.make.com/vie6k5f6ryrv7fk5d51qqiu1msr49e0a", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "motion_dna_beta_request",
          name: fd.get("name") || "",
          email: fd.get("email") || "",
          city: fd.get("location") || "",
          role: fd.get("role") || "",
          message: fd.get("project") || "",
          timestamp: new Date().toISOString(),
          source: "motion_dna_landing",
        }),
      });
      if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
      setSubmitted(true);
    } catch (error) {
      logger.error("Error submitting MotionDNA beta form", { error });
      // Match the landing behavior: still confirm so the visitor isn't blocked
      setSubmitted(true);
      toast({
        title: "Request received",
        description: "If you don't hear from us, write to info@boostifymusic.com.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const macBtn = (
    <a className={`dl ${isWindows ? "" : "primary"}`} href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16.365 1.43c0 1.14-.467 2.22-1.222 3.01-.81.85-2.13 1.51-3.243 1.42-.13-1.09.41-2.24 1.16-2.99.82-.83 2.24-1.45 3.305-1.44zM20.5 17.06c-.57 1.31-.84 1.89-1.57 3.05-1.02 1.62-2.46 3.64-4.24 3.65-1.58.02-1.99-1.04-4.14-1.03-2.15.01-2.6 1.05-4.18 1.04-1.78-.01-3.14-1.83-4.16-3.45-2.85-4.53-3.15-9.85-1.39-12.68 1.25-2.01 3.23-3.19 5.09-3.19 1.89 0 3.08 1.04 4.64 1.04 1.52 0 2.44-1.04 4.64-1.04 1.66 0 3.42.9 4.67 2.46-4.1 2.25-3.44 8.11.04 9.65z" />
      </svg>
      <span className="lbl"><small>Download for</small><b>macOS</b></span>
    </a>
  );
  const winBtn = (
    <a className={`dl ${isWindows ? "primary" : ""}`} href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M3 5.1 10.5 4v7.5H3V5.1zM10.5 12.5V20L3 18.9V12.5h7.5zM11.5 3.85 21 2.5v9H11.5V3.85zM21 12.5V21.5l-9.5-1.35V12.5H21z" />
      </svg>
      <span className="lbl"><small>Download for</small><b>Windows (PC)</b></span>
    </a>
  );

  return (
    <div className="mdna">
      <style>{CSS}</style>
      <div className="glow" />
      <div className="content">
        <header className={`mdna-hdr ${scrolled ? "scrolled" : ""} ${menuOpen ? "menu-open" : ""}`}>
          <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 0, width: "100%" }}>
            <Link href="/" className="brand" aria-label="Boostify home">
              <span className="logo" aria-hidden="true"><WaveLogo /></span>
              <span>Boostify <small>MotionDNA</small></span>
            </Link>
            <nav className="nav-links" onClick={() => setMenuOpen(false)}>
              <a href="#what">What is it</a>
              <a href="#how">How it works</a>
              <a href="/motion-dna/try.html">Try the model</a>
              <a href="#download">Download</a>
              <a href="#beta" className="btn primary sm">Join Early Access</a>
            </nav>
            <button
              type="button"
              className="nav-toggle"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              data-testid="motion-dna-nav-toggle"
            >
              <span className="bars" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="wrap">
          {/* HERO */}
          <section className="hero">
            <div className="hero-bg">
              <video src={`${A}/hero-loop.mp4`} poster={`${A}/hero-poster.jpg`} autoPlay muted loop playsInline />
            </div>
            <span className="pill"><span className="dot" /> Closed beta · Launching Q2 2026</span>
            <h1>
              The Motion Model Trained on<br />
              <span className="grad">700+ Real Music Videos</span>
            </h1>
            <p className="sub">
              Transform any song into a video with real artist movements, natural
              choreography and stage energy — without filming a single take.
            </p>
            <div className="hero-cta">
              <a href="#download" className="btn primary">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download App
              </a>
              <a href="/motion-dna/try.html" className="btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 3l14 9-14 9z" strokeLinejoin="round" />
                </svg>
                Try the model
              </a>
              <a href="#beta" className="btn">Join Early Access</a>
            </div>
            <p className="req">Available for macOS and Windows · Free download</p>

            <div className="stats">
              <div className="stat"><div className="v grad">700+</div><div className="k">Music Videos</div></div>
              <div className="stat"><div className="v">AI</div><div className="k">Powered</div></div>
              <div className="stat"><div className="v">Real</div><div className="k">Movements</div></div>
              <div className="stat"><div className="v">Q2 2026</div><div className="k">Launch</div></div>
            </div>
          </section>

          {/* PROMO SHOWCASE */}
          <section className="block" style={{ paddingTop: 18 }}>
            <div className="showcase">
              <video src={`${A}/promo.mp4`} poster={`${A}/hero-poster.jpg`} autoPlay muted loop playsInline controls />
              <div className="ring" />
            </div>
          </section>

          {/* PILLARS */}
          <section className="block" style={{ paddingTop: 30 }}>
            <div className="grid-3">
              <div className="card">
                <div className="ic">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="2.5" /><path d="M12 7.5V13M12 13l-4 5M12 13l4 5M6 10l6 1 6-1" /></svg>
                </div>
                <h3>Motion Capture AI</h3>
                <p>Advanced neural networks analyze real artist performances frame by frame.</p>
              </div>
              <div className="card">
                <div className="ic">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h10" /><circle cx="19" cy="17" r="2" /></svg>
                </div>
                <h3>Training Pipeline</h3>
                <p>700+ music videos transformed into reusable movement patterns.</p>
              </div>
              <div className="card">
                <div className="ic">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h3l2 6 4-14 2 8h7" /></svg>
                </div>
                <h3>Real-Time Analysis</h3>
                <p>Instant motion generation synced to the tempo and energy of your music.</p>
              </div>
            </div>
          </section>

          {/* WHAT IS IT */}
          <section className="block" id="what">
            <div className="split">
              <div>
                <p className="eyebrow">What is Boostify MotionDNA?</p>
                <h2>A proprietary motion model, not another image generator</h2>
                <p className="body">
                  Boostify MotionDNA is the official motion-capture model of
                  Boostify, trained on over 700 music videos filmed in real
                  productions. Instead of generating static images, it focuses on
                  something far more valuable: movement.
                </p>
                <ul className="check">
                  <li><span className="tick"><Tick /></span><div>How an artist moves on stage</div></li>
                  <li><span className="tick"><Tick /></span><div>How choreography breathes</div></li>
                  <li><span className="tick"><Tick /></span><div>How a camera follows the performance</div></li>
                </ul>
              </div>
              <div className="panel">
                <div className="media-frame">
                  <img src={`${A}/motion-panel.png`} alt="Motion-capture point cloud of a performer" loading="lazy" />
                </div>
                <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--muted)" }}>
                  That knowledge becomes a model Boostify applies to your
                  AI-generated videos — making them look like music videos
                  directed by real professionals, not generic algorithms.
                </p>
                <div className="row"><span className="n">01</span><div><b>Real productions</b><span>700+ professional shoots</span></div></div>
                <div className="row"><span className="n">02</span><div><b>Movement patterns</b><span>Poses, intensity, camera paths</span></div></div>
                <div className="row"><span className="n">03</span><div><b>Applied to your clips</b><span>Directed, professional feel</span></div></div>
              </div>
            </div>
          </section>

          {/* AUDIENCE */}
          <section className="block">
            <p className="eyebrow">Who it's for</p>
            <h2>Built for artists, directors &amp; labels who want more than templates</h2>
            <div className="grid-2">
              <div className="card">
                <div className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M5 21v-1a7 7 0 0 1 14 0v1" /></svg></div>
                <h3>Independent Artists</h3>
                <p>Get music videos with real stage presence — no crew, no studio.</p>
              </div>
              <div className="card">
                <div className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 18 0" /><circle cx="12" cy="14" r="3" /></svg></div>
                <h3>Music Producers</h3>
                <p>Constant visual content without 20 shoots per month.</p>
              </div>
              <div className="card">
                <div className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="14" height="12" rx="2" /><path d="M17 10l4-2v8l-4-2" /></svg></div>
                <h3>Directors &amp; Creatives</h3>
                <p>Use AI without losing professional video language.</p>
              </div>
              <div className="card">
                <div className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21V8l9-5 9 5v13" /><path d="M9 21v-6h6v6" /></svg></div>
                <h3>Labels &amp; Managers</h3>
                <p>Standardize visual quality with automated workflows.</p>
              </div>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section className="block" id="how">
            <p className="eyebrow">The workflow</p>
            <h2>How Boostify MotionDNA works</h2>
            <p className="lead">We handle the technical complexity. You focus on the music and the creativity.</p>
            <div className="steps">
              <div className="step"><div className="num">1</div><h4>Analyze Music</h4><p>Upload your song. The system reads tempo, energy and structure.</p></div>
              <div className="step"><div className="num">2</div><h4>Select MotionDNA</h4><p>Boostify chooses a movement profile based on your style.</p></div>
              <div className="step"><div className="num">3</div><h4>Generate Movements</h4><p>AI builds a timeline of poses, intensities and camera angles.</p></div>
              <div className="step"><div className="num">4</div><h4>Apply to Video</h4><p>The motion skeleton is applied to your AI-generated clips.</p></div>
              <div className="step"><div className="num">5</div><h4>Fine-tune &amp; Export</h4><p>Adjust intensity, speed and camera. Export ready to publish.</p></div>
            </div>
          </section>

          {/* UNIQUE */}
          <section className="block" id="unique">
            <p className="eyebrow">The difference</p>
            <h2>What makes Boostify MotionDNA unique</h2>
            <div className="feat">
              <div className="item"><span className="tick"><Tick w={15} /></span><div><b>Trained on real productions</b><br /><span>700+ professional music videos as its foundation.</span></div></div>
              <div className="item"><span className="tick"><Tick w={15} /></span><div><b>Music-video language</b><br /><span>Patterns learned from real artists on stage, not templates.</span></div></div>
              <div className="item"><span className="tick"><Tick w={15} /></span><div><b>Genre adaptive</b><br /><span>Rock, urban, pop, bachata, salsa, electronic &amp; more.</span></div></div>
              <div className="item"><span className="tick"><Tick w={15} /></span><div><b>Modern-AI ready</b><br /><span>Integrates with text-to-video, image-to-video &amp; avatars.</span></div></div>
              <div className="item"><span className="tick"><Tick w={15} /></span><div><b>Brand consistency</b><br /><span>Define movement lines to keep personality across videos.</span></div></div>
              <div className="item"><span className="tick"><Tick w={15} /></span><div><b>Proprietary dataset</b><br /><span>Impossible to replicate with generic datasets.</span></div></div>
            </div>
          </section>

          {/* CREATE */}
          <section className="block">
            <p className="eyebrow">Use cases</p>
            <h2>What you can create with MotionDNA</h2>
            <div className="gallery">
              <figure><img src={`${A}/usecase-music.png`} alt="AI-generated stage performance" loading="lazy" /></figure>
              <figure><img src={`${A}/usecase-dance.png`} alt="Motion-capture choreography" loading="lazy" /></figure>
              <figure><img src={`${A}/usecase-camera.png`} alt="Cinematic camera tracking a performer" loading="lazy" /></figure>
            </div>
            <div className="split" style={{ marginTop: 4, alignItems: "stretch" }}>
              <figure className="media-frame" style={{ margin: 0 }}>
                <img src={`${A}/usecase-create.png`} alt="Artist performing with a live motion-capture overlay" loading="lazy" />
              </figure>
              <div className="feat" style={{ gridTemplateColumns: "1fr", alignContent: "center" }}>
                <div className="item"><span className="tick"><PlayIco /></span><div><span style={{ color: "var(--fg)" }}>Complete AI-generated music videos with real artist movements.</span></div></div>
                <div className="item"><span className="tick"><PlayIco /></span><div><span style={{ color: "var(--fg)" }}>Visualizers and loops with expressive motion for Spotify, YouTube, TikTok.</span></div></div>
                <div className="item"><span className="tick"><PlayIco /></span><div><span style={{ color: "var(--fg)" }}>Lyric videos with live camera and dynamic scenes.</span></div></div>
                <div className="item"><span className="tick"><PlayIco /></span><div><span style={{ color: "var(--fg)" }}>Social content (shorts, reels, stories) with choreography hooks.</span></div></div>
                <div className="item"><span className="tick"><PlayIco /></span><div><span style={{ color: "var(--fg)" }}>Creative experiments combining different movement styles.</span></div></div>
                <div className="item"><span className="tick"><PlayIco /></span><div><span style={{ color: "var(--fg)" }}>Performance videos without expensive production costs.</span></div></div>
              </div>
            </div>
          </section>

          {/* DOWNLOAD */}
          <section className="block" id="download">
            <p className="eyebrow">Get the app</p>
            <h2>Download Boostify for desktop</h2>
            <p className="lead">
              Run MotionDNA on your own machine. Native apps for macOS and Windows — free to download.
            </p>
            <div className="dl-buttons">
              {isWindows ? (<>{winBtn}{macBtn}</>) : (<>{macBtn}{winBtn}</>)}
            </div>
            <p className="req" style={{ textAlign: "center" }}>
              macOS 11+ (Apple Silicon) · Windows 10 / 11 (64-bit) · Builds are published on{" "}
              <a href={RELEASES_PAGE} target="_blank" rel="noopener noreferrer" style={{ color: "var(--info)" }}>GitHub Releases</a>.
            </p>
          </section>

          {/* BETA FORM */}
          <section className="block" id="beta">
            <div className="beta">
              <div className="head">
                <p className="eyebrow">Launching Q2 2026</p>
                <h2>Join the first generation of artists with MotionDNA</h2>
                <p className="lead" style={{ marginBottom: 0 }}>
                  We're opening a closed beta for a limited group of artists,
                  producers, directors, managers and labels who want to use this
                  model before anyone else — and help us refine the system.
                </p>
              </div>

              {!submitted ? (
                <form className="form" onSubmit={handleSubmit} data-testid="motion-dna-beta-form">
                  <div className="field">
                    <label htmlFor="mdna-name">Name / Artist Name</label>
                    <input id="mdna-name" name="name" type="text" required placeholder="Your name or stage name" />
                  </div>
                  <div className="field two">
                    <div className="field">
                      <label htmlFor="mdna-email">Email</label>
                      <input id="mdna-email" name="email" type="email" required placeholder="you@email.com" />
                    </div>
                    <div className="field">
                      <label htmlFor="mdna-location">Country / City</label>
                      <input id="mdna-location" name="location" type="text" placeholder="e.g. Miami, USA" />
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="mdna-role">Role</label>
                    <select id="mdna-role" name="role" required defaultValue="">
                      <option value="" disabled>Select your role</option>
                      <option>Artist</option>
                      <option>Producer</option>
                      <option>Director / Creative</option>
                      <option>Manager</option>
                      <option>Record Label</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="mdna-project">Tell us about your project (optional)</label>
                    <textarea id="mdna-project" name="project" placeholder="What do you want to create with MotionDNA?" />
                  </div>
                  <button type="submit" className="btn primary" disabled={isSubmitting}>
                    {isSubmitting ? "Sending…" : "Request Beta Access"}
                  </button>
                  <p className="form-note">Limited spots · No spam · We'll only email you about the beta.</p>
                </form>
              ) : (
                <div className="success" data-testid="motion-dna-beta-success">
                  <div className="ico">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3>You're on the list!</h3>
                  <p>Thanks for requesting access. We'll reach out as the closed beta opens in Q2 2026.</p>
                </div>
              )}
            </div>
          </section>

          <footer className="mdna-ftr">
            <div className="brand" style={{ fontSize: 14 }}>
              <span className="logo" style={{ width: 28, height: 28 }} aria-hidden="true"><WaveLogo s={16} /></span>
              Boostify MotionDNA
            </div>
            <div>
              © {new Date().getFullYear()} Boostify · The motion model for music videos ·{" "}
              <Link href="/">boostifymusic.com</Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
