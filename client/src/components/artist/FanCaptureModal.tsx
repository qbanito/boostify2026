import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Zap, Star, Music2, Bell } from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';
import { useAudioPlayer } from '../../contexts/audio-player-context';

interface FanCaptureModalProps {
  artistId: number;
  artistName: string;
  artistSlug: string;
  artistImage?: string;
  artistBannerImage?: string;
  primaryColor?: string;
  accentColor?: string;
}

const BENEFITS = [
  { icon: Music2, label: 'First access to new music', tone: 'primary' },
  { icon: Star,   label: 'Exclusive artist-only content', tone: 'accent' },
  { icon: Bell,   label: 'Show, drop, and release alerts', tone: 'fresh' },
];

const FALLBACK_PRIMARY = '#f97316';
const FALLBACK_ACCENT = '#f59e0b';

function normalizeHexColor(value: string | undefined, fallback: string) {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function FanCaptureModal({
  artistId,
  artistName,
  artistSlug,
  artistImage,
  artistBannerImage,
  primaryColor,
  accentColor,
}: FanCaptureModalProps) {
  const [visible, setVisible]       = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [loading, setLoading]       = useState(false);
  const [email, setEmail]           = useState('');
  const [name, setName]             = useState('');
  const [error, setError]           = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKey = `boostify_fan_capture_${artistSlug || artistId}`;
  const primary = normalizeHexColor(primaryColor, FALLBACK_PRIMARY);
  const accent = normalizeHexColor(accentColor, FALLBACK_ACCENT);
  const fresh = '#34d399';
  const cardBg = '#10131c';
  const bodyBg = '#111827';
  const palette = {
    primary,
    accent,
    fresh,
    softPrimary: hexToRgba(primary, 0.2),
    softAccent: hexToRgba(accent, 0.22),
    primaryBorder: hexToRgba(primary, 0.42),
    accentBorder: hexToRgba(accent, 0.46),
    primaryGlow: hexToRgba(primary, 0.34),
    accentGlow: hexToRgba(accent, 0.3),
  };

  // Live audio player state — used to surface the modal after the visitor has
  // genuinely listened to a song for a while (not just sat on the page).
  const { currentTrack, isPlaying } = useAudioPlayer();
  const isPlayingRef = useRef(isPlaying);
  const trackRef = useRef(currentTrack);
  isPlayingRef.current = isPlaying;
  trackRef.current = currentTrack;
  const listenedRef = useRef(0);

  useEffect(() => {
    if (localStorage.getItem(storageKey)) return;
    // Show the modal once the visitor has actually been listening to a song
    // for ~30 seconds (cumulative real playback time, only counted while a
    // track is playing). Robust to seeking and song changes.
    const TRIGGER_SECONDS = 30;
    const interval = setInterval(() => {
      if (isPlayingRef.current && trackRef.current) {
        listenedRef.current += 1;
        if (listenedRef.current >= TRIGGER_SECONDS) {
          setVisible(true);
          clearInterval(interval);
        }
      }
    }, 1000);
    timerRef.current = interval;
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [storageKey]);

  const handleClose = () => {
    setVisible(false);
    localStorage.setItem(storageKey, '1');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimEmail = email.trim();
    if (!trimEmail) { setError('Email is required'); return; }
    setLoading(true);
    try {
      await apiRequest('POST', '/api/fan-leads', {
        email: trimEmail,
        name: name.trim() || undefined,
        artistId,
        artistSlug,
        primaryColor: primary,
        accentColor: accent,
      });
      setSubmitted(true);
      localStorage.setItem(storageKey, '1');
      setTimeout(() => setVisible(false), 4500);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const initials = artistName.charAt(0).toUpperCase();

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="fan-capture-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, pointerEvents: 'auto' }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: 0.25 }}
          onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
            background: 'rgba(0,0,0,0.80)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <motion.div
            key="fan-capture-card"
            className="fm-card"
            initial={{ y: 48, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 32, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '420px',
              borderRadius: '24px',
              overflow: 'hidden',
              background: `linear-gradient(160deg,${cardBg} 0%,#0b0f16 100%)`,
              boxShadow: `0 40px 100px rgba(0,0,0,0.75), 0 0 0 1px ${palette.primaryBorder}`,
            }}
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              style={{
                position: 'absolute', top: 14, right: 14, zIndex: 10,
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#aaa', transition: 'all .15s',
              }}
            >
              <X size={14} />
            </button>

            {/* Hero: banner blur + artist avatar */}
            <div className="fm-hero" style={{ position: 'relative', background: `linear-gradient(160deg,${hexToRgba(primary, 0.24)} 0%,${hexToRgba(accent, 0.18)} 58%,#080b12 100%)`, padding: '36px 24px 0', textAlign: 'center' }}>
              {/* Banner blur background */}
              {artistBannerImage && (
                <div style={{
                  position: 'absolute', inset: 0, zIndex: 0,
                  backgroundImage: `url(${artistBannerImage})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  filter: 'blur(20px) brightness(0.25)',
                  transform: 'scale(1.1)',
                }} />
              )}

              {/* Free access badge */}
              <div className="fm-hero-badge" style={{ position: 'relative', zIndex: 1, marginBottom: 20 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: `linear-gradient(90deg,${palette.softPrimary},${palette.softAccent})`,
                  border: `1px solid ${palette.accentBorder}`,
                  color: '#fff7ed', fontSize: 10, fontWeight: 800,
                  letterSpacing: '2px', textTransform: 'uppercase',
                  padding: '5px 14px', borderRadius: 20,
                }}>
                  <Zap size={10} fill="currentColor" />
                  Free Access
                </span>
              </div>

              {/* Artist avatar */}
              <div className="fm-avatar-wrap" style={{ position: 'relative', zIndex: 1, display: 'inline-block', marginBottom: 16 }}>
                {/* Glow ring */}
                <div style={{
                  position: 'absolute', inset: -4,
                  borderRadius: '50%',
                  background: `conic-gradient(${primary}, ${accent}, ${primary})`,
                  animation: 'spinRing 4s linear infinite',
                }} />
                <div className="fm-avatar" style={{
                  position: 'relative', zIndex: 1,
                  width: 88, height: 88, borderRadius: '50%',
                  background: artistImage ? undefined : `linear-gradient(135deg,${primary},${accent})`,
                  overflow: 'hidden',
                  border: '3px solid #0e0e20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {artistImage ? (
                    <img src={artistImage} alt={artistName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}>{initials}</span>
                  )}
                </div>
              </div>

              <h2 className="fm-hero-title" style={{ position: 'relative', zIndex: 1, margin: '0 0 4px', color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: -0.3 }}>
                {artistName}
              </h2>
              <p className="fm-hero-sub" style={{ position: 'relative', zIndex: 1, margin: '0 0 24px', color: 'rgba(255,255,255,0.72)', fontSize: 13 }}>
                Join the official fan circle
              </p>

              {/* Wave divider */}
              <svg viewBox="0 0 420 28" style={{ position: 'relative', zIndex: 1, display: 'block', marginBottom: -1, width: '100%', lineHeight: 0 }}>
                <path d="M0 0 C70 28 140 28 210 14 C280 0 350 0 420 14 L420 28 L0 28 Z" fill={bodyBg} />
              </svg>
            </div>

            {/* Body */}
            <div className="fm-body" style={{ padding: '20px 28px 28px', background: bodyBg }}>
              <style>{`
                @keyframes spinRing { to { transform: rotate(360deg); } }
                .fm-card {
                  max-height: calc(100vh - 24px);
                  max-height: calc(100dvh - 24px);
                  overflow-y: auto !important;
                  overflow-x: hidden !important;
                  overscroll-behavior: contain;
                  -webkit-overflow-scrolling: touch;
                }
                /* Compact layout for small phones (regular iPhone & smaller) */
                @media (max-height: 780px), (max-width: 380px) {
                  .fm-hero { padding: 20px 20px 0 !important; }
                  .fm-hero-badge { margin-bottom: 12px !important; }
                  .fm-avatar-wrap { margin-bottom: 10px !important; }
                  .fm-avatar { width: 64px !important; height: 64px !important; }
                  .fm-avatar span { font-size: 24px !important; }
                  .fm-hero-title { font-size: 19px !important; }
                  .fm-hero-sub { margin-bottom: 14px !important; font-size: 12px !important; }
                  .fm-body { padding: 14px 20px 18px !important; }
                  .fm-benefits { gap: 6px !important; margin-bottom: 14px !important; }
                  .fm-input { padding: 10px 12px !important; font-size: 13px !important; }
                  .fm-btn { padding: 12px 0 !important; font-size: 14px !important; }
                }
                .fm-input {
                  width:100%; box-sizing:border-box;
                  padding:12px 14px; border-radius:12px;
                  background:rgba(255,255,255,0.06);
                  border:1px solid rgba(255,255,255,0.1);
                  color:#fff; font-size:14px; outline:none;
                  transition:border-color .2s;
                }
                .fm-input::placeholder { color:rgba(255,255,255,0.3); }
                .fm-input:focus { border-color:${palette.accentBorder}; background:${hexToRgba(accent, 0.09)}; }
                .fm-btn {
                  width:100%; padding:14px 0; border:none; border-radius:12px;
                  background:linear-gradient(90deg,${primary},${accent});
                  color:#fff; font-size:15px; font-weight:700; cursor:pointer;
                  letter-spacing:0.2px; transition:opacity .2s, transform .1s;
                  box-shadow: 0 8px 24px ${palette.primaryGlow};
                }
                .fm-btn:hover { opacity:.92; transform:translateY(-1px); }
                .fm-btn:active { transform:translateY(0); }
                .fm-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
              `}</style>

              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{ textAlign: 'center', padding: '16px 0 8px' }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                    style={{
                      width: 64, height: 64, borderRadius: '50%',
                      background: `linear-gradient(135deg,${primary},${accent})`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 16px',
                      boxShadow: `0 8px 24px ${palette.primaryGlow}`,
                    }}
                  >
                    <Check size={28} color="#fff" strokeWidth={2.5} />
                  </motion.div>
                  <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 8px' }}>
                    You are in.
                  </h3>
                  <p style={{ color: 'rgba(229,231,235,0.82)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                    Check your inbox. A welcome note from{' '}
                    <strong style={{ color: accent }}>{artistName}</strong> is on the way.
                  </p>
                </motion.div>
              ) : (
                <>
                  {/* Headline */}
                  <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: '0 0 6px', lineHeight: 1.3 }}>
                    Get closer to {' '}
                    <span style={{ background: `linear-gradient(90deg,${primary},${accent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                      {artistName}
                    </span>
                  </h3>
                  <p style={{ color: 'rgba(196,196,220,0.7)', fontSize: 13, lineHeight: 1.55, margin: '0 0 18px' }}>
                    First in line for new music, drops, and private updates. No spam.
                  </p>

                  {/* Benefits */}
                  <div className="fm-benefits" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                    {BENEFITS.map((b, i) => {
                      const benefitColor = b.tone === 'primary' ? primary : b.tone === 'accent' ? accent : fresh;
                      return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                          background: hexToRgba(benefitColor, 0.12),
                          border: `1px solid ${hexToRgba(benefitColor, 0.28)}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <b.icon size={14} color={benefitColor} />
                        </div>
                        <span style={{ color: 'rgba(226,226,242,0.8)', fontSize: 13, fontWeight: 500 }}>
                          {b.label}
                        </span>
                      </div>
                    );})}
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      className="fm-input"
                      type="text"
                      placeholder="Your name (optional)"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      autoComplete="given-name"
                    />
                    <input
                      className="fm-input"
                      type="email"
                      placeholder="Your email *"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                    {error && (
                      <p style={{ margin: 0, color: '#f87171', fontSize: 12, paddingLeft: 4 }}>{error}</p>
                    )}
                    <button className="fm-btn" type="submit" disabled={loading}>
                      {loading ? 'Joining...' : `Join free ->`}
                    </button>
                  </form>

                  <p style={{ margin: '12px 0 0', color: 'rgba(255,255,255,0.2)', fontSize: 11, textAlign: 'center' }}>
                    No spam. Unsubscribe anytime.
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
