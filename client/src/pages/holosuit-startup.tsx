import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";

// ─── Constants ───────────────────────────────────────────────────────────────
const ORANGE = "#f97316";
const RAISED = 145000;
const GOAL = 500000;
const INVESTOR_COUNT = 38;
const DAYS_LEFT = 127;

const INVESTOR_TIERS = [
  {
    id: "seed",
    label: "Seed Backer",
    amount: 1000,
    badge: "🌱",
    perks: [
      "Early Backer digital badge",
      "HoloSuit insider newsletter",
      "Priority launch notification",
      "Name in Boostify credits",
    ],
    color: "#22c55e",
  },
  {
    id: "pioneer",
    label: "Pioneer",
    amount: 5000,
    badge: "⚡",
    perks: [
      "HoloSuit Body Suit at production cost",
      "Priority access — first delivery wave",
      "Name engraved in credits roll",
      "Private Discord community access",
      "Beta tester for HoloStage App",
    ],
    color: ORANGE,
    featured: true,
  },
  {
    id: "partner",
    label: "Strategic Partner",
    amount: 25000,
    badge: "🔥",
    perks: [
      "Revenue share agreement (0.5%)",
      "Full HoloSuit + HoloGloves + HoloFace kit",
      "Co-branding opportunity on product",
      "Quarterly investor briefings",
      "Named in press materials",
    ],
    color: "#a855f7",
  },
  {
    id: "lead",
    label: "Lead Investor",
    amount: 100000,
    badge: "💎",
    perks: [
      "Equity discussion — board observer seat",
      "Complete HoloSuit Pro system",
      "1-on-1 with founding team",
      "Logo on Boostify homepage",
      "Custom partnership roadmap",
      "All future hardware at cost",
    ],
    color: "#eab308",
  },
];

const PRODUCTS = [
  {
    name: "HoloSuit Pro Body",
    price: 3500,
    img: "/holosuit/ec0bf471-5309-45bd-830d-b839ed56c7d9.png",
    tag: "FULL BODY MoCap",
    specs: [
      "19 IMU sensors embedded",
      "Wireless — 50m range",
      "Sub-0.5° rotation accuracy",
      "3-hour battery / hot swap",
      "Sizes XS–3XL",
    ],
  },
  {
    name: "HoloGloves",
    price: 1250,
    img: "/holosuit/a26ff5e6-044c-411c-9ab3-df1716221b6a.png",
    tag: "FINGER & HAND MoCap",
    specs: [
      "11 sensors per glove",
      "Individual finger tracking",
      "Haptic feedback ready",
      "Ultra-light 80g each",
      "Gesture library 250+ presets",
    ],
  },
  {
    name: "HoloFace Camera",
    price: 650,
    img: "/holosuit/5a8b4e05-4fdc-4dd9-b8d7-1ac7b30b53f4.png",
    tag: "FACE CAPTURE",
    specs: [
      "52 facial blend shapes",
      "4K @ 60fps capture",
      "Real-time expression streaming",
      "USB-C + Bluetooth 5.2",
      "Integrates with HoloStage AI",
    ],
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Suit Up", desc: "Put on the HoloSuit, HoloGloves, and HoloFace camera in under 3 minutes." },
  { step: "02", title: "Connect to HoloStage", desc: "One-tap pairing to Boostify's HoloStage App via USB or Wi-Fi." },
  { step: "03", title: "Calibrate", desc: "AI-guided T-pose calibration in under 10 seconds." },
  { step: "04", title: "Perform", desc: "Move freely. All motion streams live at <5ms latency." },
  { step: "05", title: "AI Cleans the Data", desc: "Sensor drift corrected automatically by the Boostify AI engine." },
  { step: "06", title: "Apply to Avatar", desc: "Motion data maps to your AI-generated virtual artist instantly." },
  { step: "07", title: "Stream or Record", desc: "Broadcast live or render offline to any platform." },
  { step: "08", title: "Export", desc: "Export as BVH, FBX, glTF, or proprietary .holo format." },
  { step: "09", title: "Iterate", desc: "Re-use motion libraries across multiple AI artist personas." },
  { step: "10", title: "Earn", desc: "Monetize performances, clips, and avatar experiences on Boostify." },
];

const WHY_DIFFERENT = [
  {
    icon: "🎭",
    title: "Built for Virtual Artists",
    desc: "Not a generic motion capture tool. Designed from the ground up for AI-generated performers and live streaming.",
  },
  {
    icon: "🤖",
    title: "AI-Native Integration",
    desc: "Natively connected to Boostify's AI Artist Engine. Gestures translate directly to AI avatar expressions.",
  },
  {
    icon: "⚡",
    title: "Sub-5ms Latency",
    desc: "Near-zero delay between performer and avatar. Compete with professional studio setups from home.",
  },
  {
    icon: "🌐",
    title: "Platform-Agnostic",
    desc: "Works with TikTok Live, YouTube, Twitch, Instagram, and proprietary Boostify stages simultaneously.",
  },
  {
    icon: "💡",
    title: "No OptiTrack. No Studio.",
    desc: "Professional-grade capture without $100K+ studio infrastructure. The suit IS the studio.",
  },
  {
    icon: "📈",
    title: "Revenue-Linked Hardware",
    desc: "Every HoloSuit sold connects an artist to the Boostify economy. Hardware drives SaaS revenue.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function HoloSuitStartup() {
  const [, navigate] = useLocation();
  const [selectedTier, setSelectedTier] = useState<typeof INVESTOR_TIERS[0] | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const investRef = useRef<HTMLDivElement>(null);

  const pct = Math.round((RAISED / GOAL) * 100);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightboxImg(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const scrollToInvest = () => {
    investRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTier) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/holosuit/invest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tier: selectedTier.id,
          amount: selectedTier.amount,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setSubmitted(true);
      }
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: "#000", color: "#fff", fontFamily: "'Inter', sans-serif", minHeight: "100vh" }}>

      {/* ── LIGHTBOX ── */}
      {lightboxImg && (
        <div
          onClick={() => setLightboxImg(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.92)",
            backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px", cursor: "zoom-out",
          }}
        >
          <button
            onClick={() => setLightboxImg(null)}
            style={{
              position: "absolute", top: 20, right: 20,
              background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "50%", width: 44, height: 44, cursor: "pointer",
              color: "#fff", fontSize: 20, lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = `rgba(249,115,22,0.4)`)}
            onMouseLeave={e => (e.currentTarget.style.background = `rgba(255,255,255,0.1)`)}
          >
            ✕
          </button>
          <img
            src={lightboxImg}
            alt=""
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: "90vw", maxHeight: "90vh",
              objectFit: "contain", borderRadius: 16,
              boxShadow: "0 0 80px rgba(249,115,22,0.25)",
              cursor: "default",
            }}
          />
        </div>
      )}

      {/* ── NAV ── */}
      <nav className="hs-nav" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(249,115,22,0.15)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 2rem", height: 60,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: ORANGE, fontWeight: 900, fontSize: 20, letterSpacing: 1 }}>BOOSTIFY</span>
          <span style={{ color: "#444", fontSize: 18 }}>|</span>
          <span style={{ color: "#ddd", fontWeight: 600, fontSize: 15, letterSpacing: 2, textTransform: "uppercase" }}>HoloSuit</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="hs-nav-badge" style={{
            background: "rgba(249,115,22,0.15)", color: ORANGE,
            border: `1px solid ${ORANGE}`, borderRadius: 20,
            padding: "4px 12px", fontSize: 12, fontWeight: 700, letterSpacing: 2,
          }}>
            LAUNCHING JUNE 2027
          </span>
          <button onClick={scrollToInvest} style={{
            background: ORANGE, color: "#000", fontWeight: 800,
            border: "none", borderRadius: 8, padding: "8px 18px",
            cursor: "pointer", fontSize: 13, letterSpacing: 1,
          }}>
            INVEST NOW
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div ref={heroRef} style={{
        minHeight: "100vh", position: "relative", display: "flex", alignItems: "center",
        overflow: "hidden", paddingTop: 60,
      }}>
        {/* Background video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="hs-hero-video"
          style={{
            position: "absolute", inset: 0, zIndex: 0,
            width: "100%", height: "100%", objectFit: "cover",
            objectPosition: "center 15%",
            filter: "brightness(0.28)",
          }}
        >
          <source src={encodeURI("/holosuit/kling_20260509_作品__372_0.mp4")} type="video/mp4" />
        </video>
        {/* Orange gradient overlay */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1,
          background: "linear-gradient(135deg, rgba(249,115,22,0.12) 0%, transparent 60%, rgba(0,0,0,0.9) 100%)",
        }} />

        {/* Content */}
        <div style={{
          position: "relative", zIndex: 2, maxWidth: 1200, margin: "0 auto",
          padding: "0 2rem", width: "100%",
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)",
        }} className="hs-hero-content">
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(249,115,22,0.12)", border: `1px solid rgba(249,115,22,0.4)`,
            borderRadius: 20, padding: "6px 16px", marginBottom: 24,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE, animation: "pulse 2s infinite" }} />
            <span style={{ color: ORANGE, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>
              Seed Round Open — Limited Spots
            </span>
          </div>

          <h1 style={{
            fontSize: "clamp(48px, 8vw, 96px)", fontWeight: 900, lineHeight: 1,
            letterSpacing: -2, marginBottom: 16,
          }}>
            Boostify<br />
            <span style={{ color: ORANGE }}>HoloSuit</span>
          </h1>

          <p style={{
            fontSize: "clamp(18px, 3vw, 28px)", color: "#ccc", maxWidth: 640,
            lineHeight: 1.4, marginBottom: 12, fontWeight: 300,
          }}>
            The Live Performance System for the Next Generation of Virtual Artists
          </p>

          <p style={{
            fontSize: 16, color: ORANGE, fontWeight: 600, letterSpacing: 2,
            textTransform: "uppercase", marginBottom: 40,
          }}>
            "You perform. We capture. The world believes."
          </p>

          <div className="hs-hero-btns" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <button onClick={scrollToInvest} style={{
              background: ORANGE, color: "#000", fontWeight: 800,
              border: "none", borderRadius: 12, padding: "16px 36px",
              cursor: "pointer", fontSize: 15, letterSpacing: 1, textTransform: "uppercase",
              boxShadow: `0 0 40px rgba(249,115,22,0.4)`,
              transition: "transform 0.2s, box-shadow 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              Invest Now
            </button>
            <button onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })} style={{
              background: "transparent", color: "#fff", fontWeight: 600,
              border: "1px solid rgba(255,255,255,0.3)", borderRadius: 12, padding: "16px 36px",
              cursor: "pointer", fontSize: 15, letterSpacing: 1, textTransform: "uppercase",
              transition: "border-color 0.2s, color 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = ORANGE; e.currentTarget.style.color = ORANGE; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.color = "#fff"; }}
            >
              View Products
            </button>
          </div>

          {/* Stats bar */}
          <div className="hs-hero-stats" style={{
            display: "flex", gap: 40, marginTop: 64, flexWrap: "wrap",
          }}>
            {[
              { label: "RAISED", value: `$${(RAISED / 1000).toFixed(0)}K` },
              { label: "INVESTORS", value: INVESTOR_COUNT },
              { label: "DAYS LEFT", value: DAYS_LEFT },
              { label: "LAUNCH", value: "JUN 2027" },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#fff" }}>{s.value}</div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: "#666", textTransform: "uppercase" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero image right side */}
        <div className="hs-hero-right" style={{
          position: "absolute", right: 0, top: 60, bottom: 0, width: "42%", zIndex: 2,
          opacity: heroVisible ? 1 : 0,
          transform: heroVisible ? "translateX(0)" : "translateX(60px)",
          transition: "all 1s cubic-bezier(0.16,1,0.3,1) 0.2s",
          display: "flex", alignItems: "flex-end",
          background: "linear-gradient(to right, #000 0%, transparent 20%)",
        }}>
          <img
            src="/holosuit/a1dbc9be-8a3a-4761-bd1b-84243c639d72.png"
            alt="HoloSuit Pro"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
          />
        </div>
      </div>

      {/* ── FUNDRAISING PROGRESS ── */}
      <div style={{
        background: "#0a0a0a", borderTop: `1px solid rgba(249,115,22,0.15)`,
        borderBottom: `1px solid rgba(249,115,22,0.15)`, padding: "60px 2rem",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 42, fontWeight: 900, color: ORANGE }}>
                ${RAISED.toLocaleString()}
              </div>
              <div style={{ fontSize: 14, color: "#666", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>
                raised of ${GOAL.toLocaleString()} goal
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 42, fontWeight: 900, color: "#fff" }}>{pct}%</div>
              <div style={{ fontSize: 14, color: "#666", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>funded</div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{
            background: "#1a1a1a", borderRadius: 999, height: 12, overflow: "hidden",
            border: "1px solid #222",
          }}>
            <div style={{
              width: `${pct}%`, height: "100%",
              background: `linear-gradient(90deg, ${ORANGE}, #fb923c)`,
              borderRadius: 999, transition: "width 1.5s cubic-bezier(0.4,0,0.2,1)",
              boxShadow: `0 0 20px rgba(249,115,22,0.6)`,
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, color: "#555", fontSize: 12 }}>
            <span>{INVESTOR_COUNT} investors</span>
            <span>{DAYS_LEFT} days remaining</span>
          </div>
        </div>
      </div>

      {/* ── PRODUCTS ── */}
      <div id="products" className="hs-section" style={{ padding: "100px 2rem", maxWidth: 1200, margin: "0 auto" }}>
        <SectionLabel>Product Lineup</SectionLabel>
        <h2 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, marginBottom: 16 }}>
          The Complete<br /><span style={{ color: ORANGE }}>HoloSuit System</span>
        </h2>
        <p style={{ color: "#888", fontSize: 16, marginBottom: 60, maxWidth: 560 }}>
          Three precision-engineered devices. One unified motion capture ecosystem. Built to integrate natively with Boostify AI Artists.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          {PRODUCTS.map((p) => (
            <div key={p.name} style={{
              background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 20,
              overflow: "hidden", transition: "border-color 0.2s, transform 0.2s",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = ORANGE; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1a1a1a"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)"; }}
            >
              {/* Product image */}
              <div style={{ background: "#111", height: 280, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <img src={p.img} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
              <div style={{ padding: "24px 28px" }}>
                <div style={{
                  display: "inline-block", background: "rgba(249,115,22,0.1)",
                  color: ORANGE, border: `1px solid rgba(249,115,22,0.3)`,
                  borderRadius: 6, padding: "3px 10px", fontSize: 10,
                  fontWeight: 800, letterSpacing: 2, marginBottom: 12,
                }}>
                  {p.tag}
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{p.name}</h3>
                <div style={{ fontSize: 32, fontWeight: 900, color: ORANGE, marginBottom: 20 }}>
                  ${p.price.toLocaleString()}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {p.specs.map(s => (
                    <li key={s} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, color: "#aaa", fontSize: 14 }}>
                      <span style={{ color: ORANGE, fontSize: 16 }}>›</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Bundle pricing */}
        <div style={{
          marginTop: 40, background: "#0d0d0d", border: `1px solid rgba(249,115,22,0.3)`,
          borderRadius: 20, padding: "32px 36px", display: "flex",
          justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 20,
        }} className="hs-bundle-row">
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 3, color: ORANGE, textTransform: "uppercase", marginBottom: 6 }}>
              Full System Bundle
            </div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>HoloSuit + HoloGloves + HoloFace</div>
            <div style={{ color: "#888", fontSize: 14, marginTop: 4 }}>Save $400 vs. individual pricing</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 14, color: "#555", textDecoration: "line-through" }}>$5,400</div>
            <div style={{ fontSize: 42, fontWeight: 900, color: ORANGE }}>$5,000</div>
            <button onClick={scrollToInvest} style={{
              background: ORANGE, color: "#000", fontWeight: 800,
              border: "none", borderRadius: 10, padding: "12px 28px",
              cursor: "pointer", fontSize: 14, letterSpacing: 1, textTransform: "uppercase",
              marginTop: 8,
            }}>
              Pre-Order Bundle
            </button>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div style={{ background: "#050505", padding: "100px 2rem", borderTop: "1px solid #111", borderBottom: "1px solid #111" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionLabel>Process</SectionLabel>
          <h2 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, marginBottom: 60 }}>
            How It <span style={{ color: ORANGE }}>Works</span>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {HOW_IT_WORKS.map((step) => (
              <div key={step.step} style={{
                display: "flex", gap: 16, alignItems: "flex-start",
                padding: "20px", background: "#0d0d0d", borderRadius: 16, border: "1px solid #1a1a1a",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 900, color: ORANGE, letterSpacing: 2,
                  minWidth: 28, paddingTop: 3,
                }}>{step.step}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{step.title}</div>
                  <div style={{ color: "#777", fontSize: 14, lineHeight: 1.5 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── WHY IT'S DIFFERENT ── */}
      <div style={{ padding: "100px 2rem" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionLabel>Differentiators</SectionLabel>
          <h2 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, marginBottom: 60 }}>
            Why <span style={{ color: ORANGE }}>HoloSuit</span><br />Is Different
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
            {WHY_DIFFERENT.map((d) => (
              <div key={d.title} style={{
                background: "#0d0d0d", border: "1px solid #1a1a1a",
                borderRadius: 20, padding: "28px 32px",
                transition: "border-color 0.2s",
              }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = ORANGE}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = "#1a1a1a"}
              >
                <div style={{ fontSize: 36, marginBottom: 16 }}>{d.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10 }}>{d.title}</div>
                <div style={{ color: "#777", fontSize: 15, lineHeight: 1.6 }}>{d.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI INTEGRATION ── */}
      <div style={{ background: "#050505", padding: "100px 2rem", borderTop: "1px solid #111", borderBottom: "1px solid #111" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }} className="hs-ai-grid">
          <div>
            <SectionLabel>AI Native</SectionLabel>
            <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, marginBottom: 24, lineHeight: 1.1 }}>
              Powered by<br /><span style={{ color: ORANGE }}>Boostify AI</span><br />Artist Engine
            </h2>
            <p style={{ color: "#888", fontSize: 16, lineHeight: 1.7, marginBottom: 24 }}>
              HoloSuit isn't just motion capture hardware — it's the physical bridge between a human performer and an AI-generated virtual artist. Every sensor reading feeds directly into Boostify's neural animation pipeline.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { title: "AI Drift Correction", desc: "Gyroscope drift eliminated in real-time by a lightweight ML model trained on millions of motion frames." },
                { title: "Expression Adaption", desc: "HoloFace data is translated into 52 ARKit blend shapes, driving any AI avatar face with emotional fidelity." },
                { title: "Gesture Library AI", desc: "Recognizes and names gestures automatically, building a searchable motion library from every performance." },
              ].map(f => (
                <div key={f.title} style={{ display: "flex", gap: 14 }}>
                  <div style={{
                    width: 4, minHeight: 40, background: ORANGE, borderRadius: 2, flexShrink: 0,
                  }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{f.title}</div>
                    <div style={{ color: "#666", fontSize: 14, lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="hs-ai-img" style={{ position: "relative" }}>
            <div style={{
              borderRadius: 20, overflow: "hidden", border: `1px solid rgba(249,115,22,0.2)`,
              boxShadow: `0 0 80px rgba(249,115,22,0.15)`,
            }}>
              <img src="/holosuit/8c97fcfd-3179-46b3-8ee8-644c227f4024.png" alt="HoloSuit AI Integration" style={{ width: "100%", display: "block" }} />
            </div>
            {/* Floating badge */}
            <div style={{
              position: "absolute", bottom: -20, right: -20,
              background: "#0d0d0d", border: `1px solid rgba(249,115,22,0.4)`,
              borderRadius: 16, padding: "16px 20px",
              boxShadow: `0 0 40px rgba(0,0,0,0.8)`,
            }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: ORANGE, fontWeight: 800, textTransform: "uppercase" }}>Live Latency</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#fff" }}>&lt;5ms</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── VIDEOS ── */}
      <div style={{ padding: "80px 2rem 0", background: "#000" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionLabel>HoloSuit in Motion</SectionLabel>
          <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, marginBottom: 40 }}>
            See It <span style={{ color: ORANGE }}>Perform</span>
          </h2>
          <div className="hs-video-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(480px, 100%), 1fr))", gap: 20 }}>
            {[
              encodeURI("/holosuit/kling_20260509_作品__372_0.mp4"),
              encodeURI("/holosuit/kling_20260509_作品__382_0.mp4"),
            ].map((src, i) => (
              <div key={i} style={{
                borderRadius: 20, overflow: "hidden",
                border: `1px solid rgba(249,115,22,0.2)`,
                background: "#0d0d0d",
                boxShadow: "0 0 60px rgba(249,115,22,0.08)",
              }}>
                <video
                  src={src}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "contain" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SHOWCASE ── */}
      <div style={{ padding: "60px 2rem 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div className="hs-showcase-grid" style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
          }}>
            {[
              "/holosuit/515e02b3-4e73-46bd-b960-58f59011f2dd.png",
              "/holosuit/795a4237-1aa8-42a3-8af2-6811af76cb51.png",
              "/holosuit/cd9bf0aa-e7da-4976-86e5-46144977911d.png",
            ].map((src, i) => (
              <div
                key={i}
                onClick={() => setLightboxImg(src)}
                style={{
                  borderRadius: 16, overflow: "hidden",
                  border: "1px solid #1a1a1a", background: "#0d0d0d",
                  cursor: "zoom-in", transition: "border-color 0.2s, transform 0.2s",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = ORANGE; (e.currentTarget as HTMLDivElement).style.transform = "scale(1.02)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1a1a1a"; (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
              >
                <img src={src} alt="" style={{ width: "100%", height: "auto", display: "block", objectFit: "contain" }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HOLOSTAGE PROJECT ── */}
      <div style={{ padding: "80px 2rem", background: "#000" }}>
        <div style={{
          maxWidth: 1000, margin: "0 auto",
          background: "linear-gradient(135deg, #0d0d0d 0%, #111 50%, rgba(249,115,22,0.05) 100%)",
          border: `1px solid rgba(249,115,22,0.25)`,
          borderRadius: 28, padding: "clamp(32px, 6vw, 64px)",
          boxShadow: "0 0 80px rgba(249,115,22,0.08)",
          display: "flex", flexDirection: "column" as const, gap: 28,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(249,115,22,0.15)", border: `1px solid rgba(249,115,22,0.4)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🎭</div>
            <SectionLabel>Powered By</SectionLabel>
          </div>
          <h2 style={{ fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 900, lineHeight: 1.1 }}>
            HoloStage<br />
            <span style={{ color: ORANGE }}>Show Engine</span>
          </h2>
          <p style={{ color: "#888", fontSize: "clamp(15px, 2vw, 17px)", lineHeight: 1.75, maxWidth: 640 }}>
            HoloSuit feeds directly into <strong style={{ color: "#ccc" }}>HoloStage</strong> — Boostify's real-time holographic performance engine.
            Stream your motion capture data live onto AI avatars, project virtual artists onto physical stages,
            and deliver impossible performances to audiences around the world.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {[
              { icon: "🔴", label: "Live Hologram Shows" },
              { icon: "🤖", label: "AI Artist Control" },
              { icon: "🌐", label: "Multi-Platform Broadcast" },
              { icon: "⚡", label: "Sub-5ms Sync" },
            ].map(f => (
              <div key={f.label} style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid #1a1a1a",
                borderRadius: 14, padding: "16px 18px",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 22 }}>{f.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#ccc" }}>{f.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" as const }}>
            <button
              onClick={() => navigate("/hologram-show-engine")}
              style={{
                background: ORANGE, color: "#000", fontWeight: 800,
                border: "none", borderRadius: 12, padding: "16px 32px",
                cursor: "pointer", fontSize: 15, letterSpacing: 1, textTransform: "uppercase" as const,
                boxShadow: `0 0 40px rgba(249,115,22,0.35)`,
                transition: "transform 0.2s, box-shadow 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 0 60px rgba(249,115,22,0.55)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 0 40px rgba(249,115,22,0.35)"; }}
            >
              🎬 Open HoloStage Engine
            </button>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(249,115,22,0.08)", border: `1px solid rgba(249,115,22,0.2)`,
              borderRadius: 12, padding: "16px 24px",
              color: ORANGE, fontSize: 13, fontWeight: 700, letterSpacing: 1,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE, display: "inline-block" }} />
              LIVE BETA
            </div>
          </div>
        </div>
      </div>

      {/* ── INVESTOR TIERS ── */}
      <div style={{ background: "#050505", padding: "100px 2rem", borderTop: "1px solid #111" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionLabel>Invest</SectionLabel>
          <h2 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, marginBottom: 16 }}>
            Investor <span style={{ color: ORANGE }}>Tiers</span>
          </h2>
          <p style={{ color: "#888", fontSize: 16, marginBottom: 60, maxWidth: 540 }}>
            Be part of the revolution in virtual performance technology. Every investment directly funds hardware production and software development.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {INVESTOR_TIERS.map((tier) => {
              const isSelected = selectedTier?.id === tier.id;
              return (
                <div
                  key={tier.id}
                  onClick={() => { setSelectedTier(tier); setTimeout(() => investRef.current?.scrollIntoView({ behavior: "smooth" }), 100); }}
                  style={{
                    background: tier.featured ? "rgba(249,115,22,0.06)" : "#0d0d0d",
                    border: `2px solid ${isSelected ? tier.color : tier.featured ? `rgba(249,115,22,0.3)` : "#1a1a1a"}`,
                    borderRadius: 20, padding: "28px", cursor: "pointer",
                    transition: "all 0.2s", position: "relative",
                    transform: tier.featured ? "scale(1.02)" : "scale(1)",
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = tier.color;
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLDivElement).style.borderColor = tier.featured ? "rgba(249,115,22,0.3)" : "#1a1a1a";
                  }}
                >
                  {tier.featured && (
                    <div style={{
                      position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                      background: ORANGE, color: "#000", fontSize: 10, fontWeight: 900,
                      letterSpacing: 2, textTransform: "uppercase", borderRadius: 20, padding: "4px 14px",
                    }}>Most Popular</div>
                  )}
                  <div style={{ fontSize: 32, marginBottom: 12 }}>{tier.badge}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: tier.color, textTransform: "uppercase", marginBottom: 6 }}>
                    {tier.label}
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", marginBottom: 20 }}>
                    ${tier.amount.toLocaleString()}
                  </div>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {tier.perks.map(p => (
                      <li key={p} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10, color: "#bbb", fontSize: 14 }}>
                        <span style={{ color: tier.color, marginTop: 2, flexShrink: 0 }}>✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  <div style={{
                    marginTop: 24, background: isSelected ? tier.color : "transparent",
                    border: `1px solid ${tier.color}`,
                    color: isSelected ? "#000" : tier.color,
                    borderRadius: 10, padding: "10px", textAlign: "center",
                    fontWeight: 700, fontSize: 14, letterSpacing: 1,
                    transition: "all 0.2s",
                  }}>
                    {isSelected ? "Selected ✓" : "Select This Tier"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── INVESTOR FORM ── */}
      <div ref={investRef} style={{ padding: "100px 2rem", background: "#000" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <SectionLabel>Secure Your Spot</SectionLabel>
          <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, marginBottom: 8 }}>
            Invest in <span style={{ color: ORANGE }}>HoloSuit</span>
          </h2>
          <p style={{ color: "#777", fontSize: 16, marginBottom: 40 }}>
            Fill out the form below. You'll be redirected to a secure Stripe checkout to complete your investment.
          </p>

          {submitted ? (
            <div style={{
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
              borderRadius: 20, padding: "48px", textAlign: "center",
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Expression of Interest Received!</div>
              <div style={{ color: "#888", fontSize: 16 }}>Our team will reach out within 48 hours to finalize your investment and payment details.</div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Selected Tier Display */}
              {selectedTier ? (
                <div style={{
                  background: `rgba(249,115,22,0.08)`, border: `1px solid rgba(249,115,22,0.3)`,
                  borderRadius: 16, padding: "16px 20px", marginBottom: 24,
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: ORANGE, textTransform: "uppercase" }}>Selected Tier</div>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedTier.badge} {selectedTier.label}</div>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: ORANGE }}>${selectedTier.amount.toLocaleString()}</div>
                </div>
              ) : (
                <div style={{
                  background: "#0d0d0d", border: "1px dashed #333",
                  borderRadius: 16, padding: "16px 20px", marginBottom: 24,
                  color: "#666", textAlign: "center", fontSize: 14,
                }}>
                  ↑ Select an investor tier above to continue
                </div>
              )}

              <div className="hs-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <FormField label="Full Name *" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Your name" required />
                <FormField label="Email Address *" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="you@company.com" type="email" required />
              </div>
              <div style={{ marginBottom: 16 }}>
                <FormField label="Company / Fund" value={form.company} onChange={v => setForm(f => ({ ...f, company: v }))} placeholder="Optional" />
              </div>
              <div style={{ marginBottom: 28 }}>
                <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#888", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
                  Message (Optional)
                </label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Tell us about yourself or any questions you have..."
                  rows={4}
                  style={{
                    width: "100%", background: "#0d0d0d", border: "1px solid #222",
                    borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 15,
                    outline: "none", resize: "vertical", boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = ORANGE)}
                  onBlur={e => (e.currentTarget.style.borderColor = "#222")}
                />
              </div>

              <button
                type="submit"
                disabled={!selectedTier || !form.name || !form.email || submitting}
                style={{
                  width: "100%", background: selectedTier && form.name && form.email ? ORANGE : "#1a1a1a",
                  color: selectedTier && form.name && form.email ? "#000" : "#444",
                  fontWeight: 800, border: "none", borderRadius: 14, padding: "18px",
                  cursor: selectedTier && form.name && form.email ? "pointer" : "not-allowed",
                  fontSize: 16, letterSpacing: 1, textTransform: "uppercase",
                  transition: "all 0.2s",
                  boxShadow: selectedTier && form.name && form.email ? `0 0 40px rgba(249,115,22,0.3)` : "none",
                }}
              >
                {submitting ? "Processing..." : `Invest $${selectedTier?.amount.toLocaleString() ?? "—"} → Secure Checkout`}
              </button>

              <p style={{ textAlign: "center", color: "#444", fontSize: 12, marginTop: 16 }}>
                🔒 Secured by Stripe · All investments processed securely · No hardware commitment until launch
              </p>
            </form>
          )}
        </div>
      </div>

      {/* ── TECH SPECS ── */}
      <div style={{ background: "#050505", padding: "100px 2rem", borderTop: "1px solid #111" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <SectionLabel>Technical</SectionLabel>
          <h2 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, marginBottom: 60 }}>
            Full Tech <span style={{ color: ORANGE }}>Specifications</span>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            <SpecCard title="HoloSuit Pro Body" color={ORANGE} specs={[
              ["Sensors", "19 IMU (9-axis each)"],
              ["Connectivity", "Wi-Fi 6 / BLE 5.2"],
              ["Range", "50m line-of-sight"],
              ["Latency", "< 5ms"],
              ["Battery", "3h active / hot-swap"],
              ["Accuracy", "0.5° rotation, 1cm position"],
              ["Weight", "850g (full suit)"],
              ["Software", "HoloStage App, BVH/FBX/glTF export"],
              ["Compatibility", "Windows, macOS, Linux, iOS, Android"],
              ["Sizes", "XS, S, M, L, XL, 2XL, 3XL"],
            ]} />
            <SpecCard title="HoloGloves Gen 2" color="#a855f7" specs={[
              ["Sensors", "11 IMU per glove"],
              ["Tracking", "Individual finger + wrist"],
              ["Weight", "80g each"],
              ["Battery", "4h active"],
              ["Connectivity", "BLE 5.2"],
              ["Haptics", "Ready (future update)"],
              ["Presets", "250+ gesture library"],
              ["Export", "Finger bone animation data"],
              ["Calibration", "Auto-calibrate 5 sec"],
              ["Latency", "< 8ms"],
            ]} />
            <SpecCard title="HoloFace Camera" color="#22c55e" specs={[
              ["Resolution", "4K @ 60fps"],
              ["Blend Shapes", "52 ARKit compatible"],
              ["Connectivity", "USB-C + BLE 5.2"],
              ["Weight", "45g"],
              ["FOV", "120° wide angle"],
              ["Streaming", "RTMP / WebRTC"],
              ["AI Processing", "On-device + cloud"],
              ["Rig", "Adjustable headband"],
              ["Latency", "< 3ms face to avatar"],
              ["Software", "HoloStage AI pipeline"],
            ]} />
            <SpecCard title="HoloSystem Bundle" color="#eab308" specs={[
              ["Coverage", "Full body + fingers + face"],
              ["Total Sensors", "53 IMU"],
              ["Combined Latency", "< 5ms synced"],
              ["Integration", "One-app pairing"],
              ["AI Pipeline", "Boostify Neural MoCap"],
              ["Avatar Compat.", "Any rigged 3D model"],
              ["Platforms", "TikTok, YouTube, Twitch, custom"],
              ["Price", "$5,000 bundle (save $400)"],
              ["Launch", "June 2027"],
              ["Support", "24/7 Discord + priority email"],
            ]} />
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{
        background: "#000", borderTop: "1px solid #111", padding: "48px 2rem",
        textAlign: "center", color: "#444",
      }}>
        <div style={{ marginBottom: 12 }}>
          <span style={{ color: ORANGE, fontWeight: 900, fontSize: 18 }}>BOOSTIFY</span>
          <span style={{ marginLeft: 8, color: "#333" }}>· HoloSuit</span>
        </div>
        <p style={{ fontSize: 14, marginBottom: 8 }}>© 2026 Boostify Inc. All rights reserved.</p>
        <p style={{ fontSize: 13, color: "#333" }}>
          HoloSuit is launching June 2027. All investment involves risk. Not a registered securities offering. Contact us for details.
        </p>
        <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 24, fontSize: 14 }}>
          <a href="mailto:invest@boostifymusic.com" style={{ color: "#555", textDecoration: "none" }}>invest@boostifymusic.com</a>
          <span style={{ color: "#222" }}>|</span>
          <button onClick={scrollToInvest} style={{ background: "none", border: "none", color: ORANGE, cursor: "pointer", fontSize: 14 }}>
            Invest Now →
          </button>
        </div>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Mobile Responsive ── */
        @media (max-width: 768px) {
          .hs-nav-links { display: none !important; }
          .hs-nav-badge { display: none !important; }
          .hs-nav { padding: 0 1rem !important; }
          .hs-hero-right { display: none !important; }
          .hs-hero-content { padding: 0 1.25rem !important; }
          .hs-hero-stats { gap: 20px !important; margin-top: 40px !important; }
          .hs-hero-btns { flex-direction: column !important; }
          .hs-hero-btns button { width: 100% !important; text-align: center !important; }
          .hs-hero-video { object-position: center center !important; }
          .hs-section { padding: 60px 1.25rem !important; }
          .hs-section-sm { padding: 48px 1.25rem !important; }
          .hs-ai-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .hs-ai-img { order: -1 !important; }
          .hs-showcase-grid { grid-template-columns: 1fr 1fr !important; }
          .hs-form-grid { grid-template-columns: 1fr !important; }
          .hs-video-grid { grid-template-columns: 1fr !important; }
          .hs-bundle-row { flex-direction: column !important; text-align: center !important; }
          .hs-bundle-row > div:last-child { text-align: center !important; }
        }
        @media (max-width: 480px) {
          .hs-showcase-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 800, letterSpacing: 3, color: ORANGE,
      textTransform: "uppercase", marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}

function FormField({ label, value, onChange, placeholder, type = "text", required }: FormFieldProps) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#888", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          width: "100%", background: "#0d0d0d", border: "1px solid #222",
          borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 15,
          outline: "none", fontFamily: "inherit",
        }}
        onFocus={e => (e.currentTarget.style.borderColor = ORANGE)}
        onBlur={e => (e.currentTarget.style.borderColor = "#222")}
      />
    </div>
  );
}

interface SpecCardProps {
  title: string;
  color: string;
  specs: [string, string][];
}

function SpecCard({ title, color, specs }: SpecCardProps) {
  return (
    <div style={{
      background: "#0d0d0d", border: `1px solid ${color}22`,
      borderRadius: 20, padding: "28px", overflow: "hidden",
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, letterSpacing: 2, color, textTransform: "uppercase", marginBottom: 6,
      }}>SPECS</div>
      <h3 style={{ fontWeight: 800, fontSize: 18, marginBottom: 24 }}>{title}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {specs.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px solid #111", paddingBottom: 10 }}>
            <span style={{ color: "#555", fontSize: 13, flexShrink: 0 }}>{k}</span>
            <span style={{ color: "#ddd", fontSize: 13, textAlign: "right" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
