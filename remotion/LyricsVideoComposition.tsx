import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
} from 'remotion';
import { getSegmentTransitionStyle, type LyricsTransitionEffect } from './transitions/custom-transitions';
import { resolveLyricPreset, type LyricStyle, type LyricStylePreset } from './lyric-fonts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LyricsWord {
  word: string;
  start: number; // seconds
  end: number;
}

export interface LyricsSegment {
  start: number;
  end: number;
  text: string;
  words?: LyricsWord[];
}

export interface LyricsVideoProps {
  audioUrl: string;
  coverArt?: string;
  artistName: string;
  songTitle: string;
  segments: LyricsSegment[];
  theme?: 'dark' | 'light' | 'gradient' | 'blur';
  accentColor?: string;
  fontFamily?: string;
  showProgressBar?: boolean;
  showWatermark?: boolean;
  durationSecs?: number;
  transitionEffect?: LyricsTransitionEffect;
  /** Visual style of the lyrics typography. Defaults to 'glow' (modern). */
  lyricStyle?: LyricStyle;
  /** Layout of the lyrics: centered stage (modern) or side-by-side card. */
  layout?: 'center' | 'side';
  /** Pool of background images that rotate (cross-fade) behind the lyrics.
   *  Falls back to [coverArt] when empty. */
  backgroundImages?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  const num = parseInt(cleaned, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/** Return current & neighbour segment indices for a given time (seconds) */
function getActiveSegmentIdx(segments: LyricsSegment[], timeSec: number): number {
  for (let i = 0; i < segments.length; i++) {
    if (timeSec >= segments[i].start && timeSec < segments[i].end) return i;
  }
  // After last segment but before end — keep last
  if (segments.length > 0 && timeSec >= segments[segments.length - 1].end) {
    return segments.length - 1;
  }
  return -1;
}

/** word-level progress 0→1 within the active segment */
function getWordProgress(words: LyricsWord[] | undefined, timeSec: number): number[] {
  if (!words || words.length === 0) return [];
  return words.map(w => {
    if (timeSec < w.start) return 0;
    if (timeSec >= w.end) return 1;
    return (timeSec - w.start) / Math.max(w.end - w.start, 0.01);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const BlurredBackground: React.FC<{ sources: string[]; frame: number; fps: number; accentColor: string }> = ({ sources, frame, fps, accentColor }) => {
  const { r, g, b } = hexToRgb(accentColor);
  const timeSec = frame / fps;

  const imgs = sources.filter(Boolean);
  const n = imgs.length;

  // Rotation timeline: each image holds for HOLD_SEC then crossfades over FADE_SEC.
  const HOLD_SEC = 7.5;
  const FADE_SEC = 1.6;
  const loop = n * HOLD_SEC;

  return (
    <>
      {imgs.map((src, i) => {
        // Opacity for a smooth looping crossfade. With a single image it stays 1.
        let opacity = 1;
        if (n > 1) {
          let phase = (((timeSec - i * HOLD_SEC) % loop) + loop) % loop; // 0..loop
          if (phase < FADE_SEC) opacity = phase / FADE_SEC; // fading in
          else if (phase < HOLD_SEC) opacity = 1; // fully visible
          else if (phase < HOLD_SEC + FADE_SEC) opacity = 1 - (phase - HOLD_SEC) / FADE_SEC; // fading out
          else opacity = 0;
        }
        if (opacity <= 0.001) return null;

        // Gentle Ken-Burns per image; alternate the pan direction so each
        // image in the rotation feels distinct.
        const dir = i % 2 === 0 ? 1 : -1;
        const scale = interpolate(timeSec, [i * HOLD_SEC, i * HOLD_SEC + HOLD_SEC + FADE_SEC], [1.06, 1.16], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        const driftX = dir * interpolate(timeSec, [i * HOLD_SEC, i * HOLD_SEC + HOLD_SEC + FADE_SEC], [-2, 2], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <AbsoluteFill key={i} style={{ opacity }}>
            <AbsoluteFill
              style={{
                // Less blur + brighter than before so the artist photo is clearly
                // defined (user: "que se vea más, que se defina un poco").
                filter: 'blur(16px) brightness(0.62) saturate(1.3)',
                transform: `scale(${scale}) translate(${driftX}%, 0%)`,
              }}
            >
              <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </AbsoluteFill>
          </AbsoluteFill>
        );
      })}

      {/* Legibility veils — lighter than before so the photo stays visible while
          the lyrics keep enough contrast (top/bottom darker, center softer). */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.26) 36%, rgba(0,0,0,0.30) 64%, rgba(0,0,0,0.62) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at 50% 48%, transparent 36%, rgba(0,0,0,0.42) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(120deg, rgba(${r},${g},${b},0.12) 0%, transparent 55%)`,
        }}
      />
    </>
  );
};

const AlbumCard: React.FC<{
  src?: string;
  artistName: string;
  songTitle: string;
  frame: number;
  fps: number;
  accentColor: string;
}> = ({ src, artistName, songTitle, frame, fps, accentColor }) => {
  const { r, g, b } = hexToRgb(accentColor);

  const rotateY = interpolate(frame, [0, fps * 8], [8, -4], { extrapolateRight: 'clamp' });
  const rotateX = interpolate(frame, [0, fps * 4, fps * 8], [2, -1, 2], { extrapolateRight: 'clamp' });
  const glowOpacity = interpolate(frame % (fps * 4), [0, fps * 2, fps * 4], [0.4, 0.8, 0.4]);

  return (
    <div
      style={{
        position: 'absolute',
        left: 80,
        top: '50%',
        transform: `translateY(-50%) perspective(1200px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`,
        width: 480,
        height: 480,
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: `0 40px 80px rgba(0,0,0,0.7), 0 0 60px rgba(${r},${g},${b},${glowOpacity})`,
      }}
    >
      {src ? (
        <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(135deg, rgba(${r},${g},${b},0.6), rgba(0,0,0,0.9))`,
          }}
        />
      )}
      {/* Bottom gradient overlay with track info */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '32px 24px 24px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
        }}
      >
        <div style={{ color: '#fff', fontFamily: 'inherit', fontSize: 22, fontWeight: 700, letterSpacing: 0.5 }}>
          {songTitle}
        </div>
        <div style={{ color: `rgba(${r},${g},${b},1)`, fontFamily: 'inherit', fontSize: 16, marginTop: 4 }}>
          {artistName}
        </div>
      </div>
    </div>
  );
};

const KaraokePanel: React.FC<{
  segments: LyricsSegment[];
  activeIdx: number;
  timeSec: number;
  accentColor: string;
  frame: number;
  fps: number;
}> = ({ segments, activeIdx, timeSec, accentColor, frame, fps }) => {
  const { r, g, b } = hexToRgb(accentColor);

  // Collect lines to display: prev-2, prev-1, ACTIVE, next-1, next-2
  const lines: Array<{ seg: LyricsSegment | null; role: 'past' | 'active' | 'future' | 'empty' }> = [];

  for (let offset = -2; offset <= 2; offset++) {
    const idx = activeIdx + offset;
    if (idx < 0 || idx >= segments.length) {
      lines.push({ seg: null, role: 'empty' });
    } else {
      lines.push({
        seg: segments[idx],
        role: offset < 0 ? 'past' : offset > 0 ? 'future' : 'active',
      });
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 620,
        right: 60,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {lines.map(({ seg, role }, i) => {
        if (!seg) return <div key={i} style={{ height: 52 }} />;

        const isActive = role === 'active';
        const opacity = isActive ? 1 : role === 'past' ? (i === 0 ? 0.18 : 0.32) : (i === 3 ? 0.4 : 0.28);
        const scale = isActive ? 1 : 0.88;
        const fontSize = isActive ? 44 : 32;
        const fontWeight = isActive ? 800 : 500;

        // Word-level clip highlighting for active line
        const wordProgressList = isActive ? getWordProgress(seg.words, timeSec) : [];
        const words = seg.words;

        return (
          <div
            key={i}
            style={{
              opacity,
              transform: `scale(${scale})`,
              transformOrigin: 'left center',
              transition: 'opacity 0.3s, transform 0.3s',
              lineHeight: 1.3,
              minHeight: isActive ? 60 : 44,
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0 8px',
              alignItems: 'center',
            }}
          >
            {isActive && words && words.length > 0 ? (
              // Karaoke word-by-word highlight
              words.map((w, wi) => {
                const progress = wordProgressList[wi] ?? 0;
                return (
                  <span
                    key={wi}
                    style={{ position: 'relative', display: 'inline-block', overflow: 'hidden' }}
                  >
                    {/* Base white text */}
                    <span
                      style={{
                        fontSize,
                        fontWeight,
                        color: 'rgba(255,255,255,0.85)',
                        fontFamily: 'inherit',
                        letterSpacing: 0.5,
                        textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                      }}
                    >
                      {w.word}
                    </span>
                    {/* Accent color reveal overlay */}
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        overflow: 'hidden',
                        width: `${progress * 100}%`,
                        color: `rgb(${r},${g},${b})`,
                        fontSize,
                        fontWeight,
                        fontFamily: 'inherit',
                        letterSpacing: 0.5,
                        whiteSpace: 'nowrap',
                        textShadow: `0 0 20px rgba(${r},${g},${b},0.8)`,
                      }}
                    >
                      {w.word}
                    </span>
                  </span>
                );
              })
            ) : (
              // No word timing — show whole line, highlight if active
              <span
                style={{
                  fontSize,
                  fontWeight,
                  color: isActive ? `rgb(${r},${g},${b})` : '#fff',
                  fontFamily: 'inherit',
                  letterSpacing: 0.5,
                  textShadow: isActive
                    ? `0 0 30px rgba(${r},${g},${b},0.6), 0 2px 12px rgba(0,0,0,0.8)`
                    : '0 2px 8px rgba(0,0,0,0.6)',
                }}
              >
                {seg.text}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Modern centered lyric stage — large current line with prev/next faded, and
// per-word kinetic entrance + glowing karaoke fill. This is the "bonito y
// moderno" look (Spotify/Apple-Music style) and the new default layout.
// ─────────────────────────────────────────────────────────────────────────────

const CenterLyrics: React.FC<{
  segments: LyricsSegment[];
  activeIdx: number;
  timeSec: number;
  accentColor: string;
  frame: number;
  fps: number;
  preset: LyricStylePreset;
  audioPulse: number; // 0..1 reactive-ish energy for the glow
}> = ({ segments, activeIdx, timeSec, accentColor, frame, fps, preset, audioPulse }) => {
  const { r, g, b } = hexToRgb(accentColor);
  const active = activeIdx >= 0 ? segments[activeIdx] : null;
  const prev = activeIdx - 1 >= 0 ? segments[activeIdx - 1] : null;
  const next = activeIdx + 1 < segments.length ? segments[activeIdx + 1] : null;

  const tx = (s: string) => (preset.uppercase ? s.toUpperCase() : s);

  // Breath keeps the glow alive on quiet passages; audioPulse adds punch.
  const breath = 0.85 + 0.15 * Math.sin(timeSec * 2.2);
  const glow = preset.glow * (0.6 + 0.4 * audioPulse) * breath;

  const ACTIVE_SIZE = 92;
  const SIDE_SIZE = 40;

  const segStartFrame = active ? Math.round(active.start * fps) : 0;
  const lineIn = active
    ? spring({ frame: frame - segStartFrame, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.45) })
    : 0;

  const renderActiveLine = () => {
    if (!active) return null;
    const words = active.words;
    const fillList = getWordProgress(words, timeSec);

    if (!words || words.length === 0) {
      // No word timing — animate the whole line in.
      return (
        <div
          style={{
            opacity: lineIn,
            transform: `translateY(${(1 - lineIn) * 26}px) scale(${0.96 + lineIn * 0.04})`,
            fontSize: ACTIVE_SIZE,
            fontWeight: preset.weightActive,
            color: `rgb(${r},${g},${b})`,
            letterSpacing: preset.letterSpacing,
            lineHeight: preset.lineHeight,
            fontStyle: preset.italicAccent ? 'italic' : 'normal',
            textShadow: `0 0 ${34 * glow}px rgba(${r},${g},${b},${0.6 * glow}), 0 8px 34px rgba(0,0,0,0.6)`,
          }}
        >
          {tx(active.text)}
        </div>
      );
    }

    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'baseline',
          gap: '6px 20px',
          maxWidth: 1500,
          lineHeight: preset.lineHeight,
        }}
      >
        {words.map((w, wi) => {
          const wStartFrame = Math.round(w.start * fps);
          const local = frame - wStartFrame;
          const enter = spring({
            frame: local,
            fps,
            config: { damping: 16, mass: 0.6, stiffness: 150 },
            durationInFrames: Math.round(fps * 0.6),
          });
          const fill = fillList[wi] ?? 0;

          let ty = 0;
          let scale = 1;
          let blur = 0;
          let opacity = 1;
          if (preset.anim === 'rise') {
            ty = (1 - enter) * 46;
            opacity = Math.min(1, enter * 1.1);
            blur = (1 - enter) * 9;
          } else if (preset.anim === 'pop') {
            scale = 0.55 + enter * 0.45;
            opacity = Math.min(1, enter * 1.15);
          } else {
            opacity = Math.min(1, enter * 1.2);
          }

          return (
            <span
              key={wi}
              style={{
                position: 'relative',
                display: 'inline-block',
                transform: `translateY(${ty}px) scale(${scale})`,
                opacity,
                filter: blur > 0.2 ? `blur(${blur}px)` : undefined,
                willChange: 'transform, opacity',
              }}
            >
              {/* Base (un-sung) word */}
              <span
                style={{
                  fontSize: ACTIVE_SIZE,
                  fontWeight: preset.weightActive,
                  color: 'rgba(255,255,255,0.88)',
                  letterSpacing: preset.letterSpacing,
                  fontStyle: preset.italicAccent ? 'italic' : 'normal',
                  textShadow: '0 8px 34px rgba(0,0,0,0.6)',
                }}
              >
                {tx(w.word)}
              </span>
              {/* Accent karaoke fill overlay */}
              <span
                style={{
                  position: 'absolute',
                  inset: 0,
                  overflow: 'hidden',
                  width: `${fill * 100}%`,
                  whiteSpace: 'nowrap',
                  fontSize: ACTIVE_SIZE,
                  fontWeight: preset.weightActive,
                  letterSpacing: preset.letterSpacing,
                  fontStyle: preset.italicAccent ? 'italic' : 'normal',
                  color: `rgb(${r},${g},${b})`,
                  textShadow: `0 0 ${26 * glow}px rgba(${r},${g},${b},${0.85 * glow})`,
                }}
              >
                {tx(w.word)}
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  const sideLine = (seg: LyricsSegment | null, dir: 'up' | 'down') => {
    if (!seg) return <div style={{ height: SIDE_SIZE * 1.4 }} />;
    return (
      <div
        style={{
          fontSize: SIDE_SIZE,
          fontWeight: preset.weightIdle,
          color: 'rgba(255,255,255,0.32)',
          letterSpacing: preset.letterSpacing,
          lineHeight: 1.25,
          maxWidth: 1300,
          textAlign: 'center',
          transform: `translateY(${dir === 'up' ? -4 : 4}px)`,
          filter: 'blur(0.4px)',
        }}
      >
        {tx(seg.text)}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 34,
        padding: '0 90px',
        textAlign: 'center',
      }}
    >
      {sideLine(prev, 'up')}
      <div style={{ minHeight: ACTIVE_SIZE * preset.lineHeight }}>{renderActiveLine()}</div>
      {sideLine(next, 'down')}
    </div>
  );
};

const ProgressBar: React.FC<{
  progress: number;
  accentColor: string;
}> = ({ progress, accentColor }) => {
  const { r, g, b } = hexToRgb(accentColor);
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 6,
        background: 'rgba(255,255,255,0.1)',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress * 100}%`,
          background: `linear-gradient(90deg, rgba(${r},${g},${b},0.8), rgba(${r},${g},${b},1))`,
          boxShadow: `0 0 12px rgba(${r},${g},${b},0.9)`,
          transition: 'none',
        }}
      />
    </div>
  );
};

const Watermark: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      bottom: 28,
      right: 40,
      color: 'rgba(255,255,255,0.25)',
      fontSize: 18,
      fontFamily: 'inherit',
      letterSpacing: 2,
      textTransform: 'uppercase',
    }}
  >
    BOOSTIFY MUSIC
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Composition
// ─────────────────────────────────────────────────────────────────────────────

export const LyricsVideoComposition: React.FC<LyricsVideoProps> = ({
  audioUrl,
  coverArt,
  artistName,
  songTitle,
  segments,
  theme = 'dark',
  accentColor = '#7c3aed',
  fontFamily = 'Inter',
  showProgressBar = true,
  showWatermark = true,
  durationSecs = 180,
  transitionEffect = 'flash',
  lyricStyle = 'glow',
  layout = 'center',
  backgroundImages,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const timeSec = frame / fps;
  const totalProgress = frame / durationInFrames;
  const activeIdx = getActiveSegmentIdx(segments, timeSec);

  // Resolve the lyric typography preset (font + animation flavor + glow).
  const preset = resolveLyricPreset(lyricStyle);

  // Background image pool: rotate the gallery photos when provided, otherwise
  // fall back to the single cover art. Dedupe + keep only valid http(s) URLs.
  const bgSources = (() => {
    const pool = (backgroundImages && backgroundImages.length > 0
      ? backgroundImages
      : coverArt
      ? [coverArt]
      : []
    ).filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u));
    return Array.from(new Set(pool)).slice(0, 6);
  })();

  // Musical pulse for the glow. Deterministic (render-safe, no audio decode):
  // a sharpened ~2 Hz beat envelope so the lyrics "breathe" with an implied
  // tempo even on headless Lambda renders where Web Audio isn't available.
  const beatEnv = Math.pow(0.5 + 0.5 * Math.sin(timeSec * Math.PI * 2 * 1.9), 3);
  const audioPulse = 0.35 + 0.65 * beatEnv;

  // ── Segment transition overlay ─────────────────────────────────────────────
  const activeSegment = activeIdx >= 0 ? segments[activeIdx] : null;
  const segStartFrame = activeSegment ? Math.round(activeSegment.start * fps) : -1;
  const frameSinceSegmentStart = segStartFrame >= 0 ? frame - segStartFrame : -1;
  const { r, g, b } = hexToRgb(accentColor);
  const transitionOverlayStyle = getSegmentTransitionStyle(
    frameSinceSegmentStart,
    fps,
    transitionEffect,
    { r, g, b },
  );

  // Theme backgrounds
  const bgMap: Record<string, string> = {
    dark: 'radial-gradient(ellipse at 20% 50%, #12004a 0%, #0a0015 60%, #000 100%)',
    light: 'radial-gradient(ellipse at 20% 50%, #ece9ff 0%, #f8f6ff 60%, #fff 100%)',
    gradient: 'linear-gradient(135deg, #0f0028 0%, #1a004a 40%, #00102a 100%)',
    blur: 'transparent',
  };

  // Particles: subtle floating orbs using deterministic math.
  // Kept to 3 (was 6) — large CSS blur orbs are the single most expensive
  // per-frame paint operation in the headless render, so fewer = much faster.
  const particles = Array.from({ length: 3 }, (_, i) => {
    const angle = (i / 3) * Math.PI * 2 + timeSec * (0.08 + i * 0.015);
    const radius = 220 + i * 90;
    const px = 960 + Math.cos(angle) * radius;
    const py = 540 + Math.sin(angle) * radius * 0.5;
    const opacity = 0.04 + 0.03 * Math.sin(timeSec * 0.5 + i);
    return { px, py, opacity };
  });

  return (
    <AbsoluteFill
      style={{
        background: theme === 'blur' ? undefined : bgMap[theme],
        fontFamily: `'${preset.fontFamily}', '${fontFamily}', system-ui, sans-serif`,
        overflow: 'hidden',
      }}
    >
      {/* Rotating artist photo background — uses the gallery pool when provided,
          else the cover art. Cross-fades between images and stays clearly
          defined (low blur) so the artist's photos shine behind the lyrics. */}
      {bgSources.length > 0 ? (
        <BlurredBackground sources={bgSources} frame={frame} fps={fps} accentColor={accentColor} />
      ) : null}

      {/* Ambient particle glow orbs */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.px,
            top: p.py,
            width: 300 + i * 40,
            height: 300 + i * 40,
            borderRadius: '50%',
            background: `rgba(${r},${g},${b},${p.opacity})`,
            filter: 'blur(55px)',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* ── SIDE layout (legacy): album card + right-aligned karaoke list ── */}
      {layout === 'side' && (
        <>
          {/* Divider line between album art and lyrics */}
          <div
            style={{
              position: 'absolute',
              left: 598,
              top: '15%',
              width: 2,
              height: '70%',
              background: `linear-gradient(to bottom, transparent, rgba(${r},${g},${b},0.4), transparent)`,
            }}
          />

          {/* Album art card */}
          <AlbumCard
            src={coverArt}
            artistName={artistName}
            songTitle={songTitle}
            frame={frame}
            fps={fps}
            accentColor={accentColor}
          />

          {/* Karaoke lyrics panel */}
          {activeIdx >= 0 && (
            <KaraokePanel
              segments={segments}
              activeIdx={activeIdx}
              timeSec={timeSec}
              accentColor={accentColor}
              frame={frame}
              fps={fps}
            />
          )}
        </>
      )}

      {/* ── CENTER layout (modern default): big centered kinetic lyrics ── */}
      {layout === 'center' && (
        <>
          {/* Now-playing chip with the song title + artist */}
          <div
            style={{
              position: 'absolute',
              top: 56,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 26px',
              borderRadius: 999,
              background: 'rgba(0,0,0,0.35)',
              border: `1px solid rgba(${r},${g},${b},0.45)`,
              backdropFilter: 'blur(8px)',
              boxShadow: `0 6px 30px rgba(0,0,0,0.45)`,
            }}
          >
            {coverArt ? (
              <Img
                src={coverArt}
                style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover' }}
              />
            ) : null}
            <div style={{ textAlign: 'left' }}>
              <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }}>
                {songTitle}
              </div>
              <div style={{ color: `rgba(${r},${g},${b},1)`, fontSize: 15, fontWeight: 600, marginTop: 2, letterSpacing: 1 }}>
                {artistName}
              </div>
            </div>
          </div>

          {activeIdx >= 0 && (
            <CenterLyrics
              segments={segments}
              activeIdx={activeIdx}
              timeSec={timeSec}
              accentColor={accentColor}
              frame={frame}
              fps={fps}
              preset={preset}
              audioPulse={audioPulse}
            />
          )}
        </>
      )}

      {/* Idle message before first segment */}
      {activeIdx === -1 && timeSec < (segments[0]?.start ?? 0) && (
        <div
          style={{
            position: 'absolute',
            ...(layout === 'center'
              ? { left: 0, right: 0, textAlign: 'center' as const }
              : { left: 620, right: 60 }),
            top: '50%',
            transform: 'translateY(-50%)',
            color: `rgba(${r},${g},${b},0.6)`,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          ♫ {songTitle}
        </div>
      )}

      {/* Segment transition overlay — fires for ~0.25s at each new lyric line */}
      {transitionOverlayStyle && <div style={transitionOverlayStyle} />}

      {/* Progress bar */}
      {showProgressBar && <ProgressBar progress={totalProgress} accentColor={accentColor} />}

      {/* Watermark */}
      {showWatermark && <Watermark />}

      {/* Audio — only mount when a real URL is present; Remotion's <Audio>
          throws "No 'src' was passed" when src is empty (e.g. live preview). */}
      {audioUrl ? <Audio src={audioUrl} /> : null}
    </AbsoluteFill>
  );
};

export default LyricsVideoComposition;
