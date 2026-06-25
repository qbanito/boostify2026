import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  staticFile,
} from 'remotion';
import { noise2D } from '@remotion/noise';
import { Circle } from '@remotion/shapes';
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
  /** Pool of background VIDEO clips (artist gallery) interleaved with the
   *  photos as cinematic moving backdrops. */
  backgroundVideos?: string[];
  /** Brand secondary color — feeds the animated aurora gradient so the look is
   *  coherent with the artist's visual identity. */
  secondaryColor?: string;
  /** Artist genre — currently informational / future tuning. */
  genre?: string;
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

  // Auto-fit the active line size so long lines never overflow the stage.
  // Heuristic (render-safe, no DOM measurement): shrink as char count grows.
  const activeText = active ? (preset.uppercase ? active.text.toUpperCase() : active.text) : '';
  const activeChars = activeText.length;
  const ACTIVE_SIZE = activeChars > 46 ? 58 : activeChars > 34 ? 70 : activeChars > 24 ? 82 : 96;
  const SIDE_SIZE = 40;

  // Beat-driven punch applied to the whole active line.
  const linePunch = 1 + 0.022 * (audioPulse - 0.5);

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
      <div style={{ minHeight: ACTIVE_SIZE * preset.lineHeight, transform: `scale(${linePunch})`, willChange: 'transform' }}>
        {renderActiveLine()}
      </div>
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
// MODERN CINEMATIC LAYERS (new)
// ─────────────────────────────────────────────────────────────────────────────

/** Flowing aurora mesh gradient driven by Perlin noise, tinted with the
 *  artist's brand palette. Cheap: only a handful of blurred radial blobs whose
 *  centers drift via noise — no per-pixel sampling. */
const AuroraGradient: React.FC<{
  frame: number;
  fps: number;
  primary: string;
  secondary: string;
}> = ({ frame, fps, primary, secondary }) => {
  const t = frame / fps;
  const p = hexToRgb(primary);
  const s = hexToRgb(secondary);
  const blobs = [
    { c: p, seed: 11, bx: 26, by: 30, r: 820 },
    { c: s, seed: 23, bx: 74, by: 38, r: 880 },
    { c: p, seed: 41, bx: 48, by: 78, r: 760 },
    { c: s, seed: 57, bx: 84, by: 82, r: 700 },
  ];
  return (
    <AbsoluteFill style={{ background: '#05030c' }}>
      {blobs.map((b, i) => {
        const nx = noise2D(b.seed, t * 0.06, 0.5);
        const ny = noise2D(b.seed + 100, 0.5, t * 0.06);
        const x = b.bx + nx * 15;
        const y = b.by + ny * 15;
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.4 + i);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: b.r,
              height: b.r,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle, rgba(${b.c.r},${b.c.g},${b.c.b},0.55) 0%, rgba(${b.c.r},${b.c.g},${b.c.b},0) 68%)`,
              filter: 'blur(60px)',
              opacity: 0.5 + 0.28 * pulse,
              mixBlendMode: 'screen',
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{ background: 'radial-gradient(ellipse at 50% 42%, transparent 38%, rgba(0,0,0,0.55) 100%)' }}
      />
    </AbsoluteFill>
  );
};

/** Subtle film grain overlay (re-seeded every few frames so it shimmers). */
const FilmGrain: React.FC<{ frame: number; opacity?: number }> = ({ frame, opacity = 0.05 }) => {
  const seed = Math.floor(frame / 3) % 6;
  return (
    <AbsoluteFill style={{ opacity, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={1} seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

/** A soft diagonal light-leak streak that sweeps slowly across the frame. */
const LightLeak: React.FC<{ frame: number; fps: number; color: string }> = ({ frame, fps, color }) => {
  const t = frame / fps;
  const { r, g, b } = hexToRgb(color);
  const x = interpolate(Math.sin(t * 0.16), [-1, 1], [-25, 120]);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', opacity: 0.16 }}>
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: `${x}%`,
          width: 380,
          height: '140%',
          transform: 'rotate(18deg)',
          background: `linear-gradient(90deg, transparent, rgba(${r},${g},${b},0.6), transparent)`,
          filter: 'blur(42px)',
        }}
      />
    </AbsoluteFill>
  );
};

/** Thin decorative rings that rotate + breathe with the beat. */
const DecorShapes: React.FC<{
  frame: number;
  fps: number;
  accentColor: string;
  secondaryColor: string;
  pulse: number;
}> = ({ frame, fps, accentColor, secondaryColor, pulse }) => {
  const t = frame / fps;
  const a = hexToRgb(accentColor);
  const s = hexToRgb(secondaryColor);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          right: 130,
          top: 150,
          opacity: 0.16 + 0.1 * pulse,
          transform: `rotate(${t * 7}deg) scale(${1 + 0.05 * pulse})`,
        }}
      >
        <Circle radius={64} fill="transparent" stroke={`rgb(${a.r},${a.g},${a.b})`} strokeWidth={3} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 150,
          bottom: 170,
          opacity: 0.13 + 0.1 * pulse,
          transform: `rotate(${-t * 5}deg)`,
        }}
      >
        <Circle radius={104} fill="transparent" stroke={`rgb(${s.r},${s.g},${s.b})`} strokeWidth={2} />
      </div>
    </AbsoluteFill>
  );
};

/** Unified cinematic background: interleaves artist photos (Ken-Burns) with
 *  gallery video clips, cross-fading between slots. Falls back gracefully when
 *  only photos (or nothing) are available. */
const MediaBackground: React.FC<{
  images: string[];
  videos: string[];
  frame: number;
  fps: number;
  accentColor: string;
}> = ({ images, videos, frame, fps, accentColor }) => {
  const { r, g, b } = hexToRgb(accentColor);
  const t = frame / fps;

  type Slot = { kind: 'image' | 'video'; src: string; hold: number };
  const slots: Slot[] = [];
  let vi = 0;
  images.forEach((src, i) => {
    slots.push({ kind: 'image', src, hold: 7 });
    if (videos.length && (i + 1) % 2 === 0 && vi < videos.length) {
      slots.push({ kind: 'video', src: videos[vi++], hold: 4 });
    }
  });
  while (vi < videos.length) slots.push({ kind: 'video', src: videos[vi++], hold: 4 });
  if (slots.length === 0) return null;

  const FADE = 1.3;
  const starts: number[] = [];
  let acc = 0;
  for (const sl of slots) {
    starts.push(acc);
    acc += sl.hold;
  }
  const loop = acc;

  return (
    <>
      {slots.map((slot, i) => {
        const start = starts[i];
        const phase = (((t - start) % loop) + loop) % loop;
        let opacity = 0;
        if (phase < FADE) opacity = phase / FADE;
        else if (phase < slot.hold) opacity = 1;
        else if (phase < slot.hold + FADE) opacity = 1 - (phase - slot.hold) / FADE;
        else opacity = 0;
        if (opacity <= 0.001) return null;

        const dir = i % 2 === 0 ? 1 : -1;
        const scale = 1.06 + (phase / (slot.hold + FADE)) * 0.12;
        const driftX = dir * interpolate(phase, [0, slot.hold + FADE], [-2, 2], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        const inner = (
          <AbsoluteFill
            style={{
              filter: 'blur(14px) brightness(0.6) saturate(1.25)',
              transform: `scale(${scale}) translate(${driftX}%, 0%)`,
            }}
          >
            {slot.kind === 'image' ? (
              <Img src={slot.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <OffthreadVideo src={slot.src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </AbsoluteFill>
        );

        // Videos must play from their own t=0 each time the slot appears: wrap
        // in a Sequence offset so the clip's internal time = phase (constant
        // `from` within a slot appearance, render-safe).
        if (slot.kind === 'video') {
          const fromFrame = frame - Math.round(phase * fps);
          return (
            <AbsoluteFill key={i} style={{ opacity }}>
              <Sequence from={fromFrame} layout="none">
                {inner}
              </Sequence>
            </AbsoluteFill>
          );
        }
        return (
          <AbsoluteFill key={i} style={{ opacity }}>
            {inner}
          </AbsoluteFill>
        );
      })}

      {/* Legibility veils */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.24) 38%, rgba(0,0,0,0.30) 64%, rgba(0,0,0,0.66) 100%)',
        }}
      />
      <AbsoluteFill
        style={{ background: 'radial-gradient(ellipse at 50% 48%, transparent 36%, rgba(0,0,0,0.42) 100%)' }}
      />
      <AbsoluteFill
        style={{ background: `linear-gradient(120deg, rgba(${r},${g},${b},0.12) 0%, transparent 55%)` }}
      />
    </>
  );
};

/** Cinematic intro title card: artist photo + song title reveal. */
const IntroCard: React.FC<{
  artistName: string;
  songTitle: string;
  coverArt?: string;
  accentColor: string;
  frame: number;
  fps: number;
  introSec: number;
}> = ({ artistName, songTitle, coverArt, accentColor, frame, fps, introSec }) => {
  const { r, g, b } = hexToRgb(accentColor);
  const t = frame / fps;
  const inP = spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.7) });
  const out = interpolate(t, [introSec - 0.6, introSec], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = inP * out;
  if (opacity <= 0.001) return null;
  const rise = (1 - inP) * 40;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        background: 'rgba(0,0,0,0.28)',
        backdropFilter: 'blur(2px)',
      }}
    >
      {coverArt ? (
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: '50%',
            overflow: 'hidden',
            transform: `translateY(${rise}px) scale(${0.9 + inP * 0.1})`,
            boxShadow: `0 0 0 6px rgba(${r},${g},${b},0.5), 0 30px 80px rgba(0,0,0,0.6), 0 0 80px rgba(${r},${g},${b},0.45)`,
            marginBottom: 44,
          }}
        >
          <Img src={coverArt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      ) : null}
      <div
        style={{
          fontSize: 96,
          fontWeight: 900,
          color: '#fff',
          letterSpacing: -1,
          textAlign: 'center',
          transform: `translateY(${rise * 0.6}px)`,
          textShadow: `0 0 50px rgba(${r},${g},${b},0.6), 0 10px 40px rgba(0,0,0,0.7)`,
          maxWidth: 1500,
          lineHeight: 1.05,
        }}
      >
        {songTitle}
      </div>
      <div
        style={{
          marginTop: 18,
          fontSize: 34,
          fontWeight: 700,
          letterSpacing: 6,
          textTransform: 'uppercase',
          color: `rgb(${r},${g},${b})`,
          transform: `translateY(${rise * 0.4}px)`,
        }}
      >
        {artistName}
      </div>
    </AbsoluteFill>
  );
};

/** Cinematic outro card: thanks + CTA + brand. */
const OutroCard: React.FC<{
  artistName: string;
  accentColor: string;
  frame: number;
  fps: number;
  startFrame: number;
}> = ({ artistName, accentColor, frame, fps, startFrame }) => {
  const { r, g, b } = hexToRgb(accentColor);
  const local = frame - startFrame;
  if (local < 0) return null;
  const inP = spring({ frame: local, fps, config: { damping: 200 }, durationInFrames: Math.round(fps * 0.8) });
  const rise = (1 - inP) * 36;
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: inP,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        style={{
          fontSize: 72,
          fontWeight: 900,
          color: '#fff',
          letterSpacing: -0.5,
          transform: `translateY(${rise}px)`,
          textShadow: `0 0 50px rgba(${r},${g},${b},0.6)`,
        }}
      >
        {artistName}
      </div>
      <div
        style={{
          marginTop: 22,
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: 3,
          color: `rgb(${r},${g},${b})`,
          transform: `translateY(${rise * 0.6}px)`,
        }}
      >
        ♫ Thanks for listening
      </div>
      <div
        style={{
          marginTop: 50,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 6,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        BOOSTIFY MUSIC
      </div>
    </AbsoluteFill>
  );
};

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
  backgroundVideos,
  secondaryColor,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const timeSec = frame / fps;
  const totalProgress = frame / durationInFrames;
  const activeIdx = getActiveSegmentIdx(segments, timeSec);

  // Resolve the lyric typography preset (font + animation flavor + glow).
  const preset = resolveLyricPreset(lyricStyle);

  // Secondary brand color (aurora gradient). Falls back to the accent.
  const isHex = (c?: string) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
  const secondary = isHex(secondaryColor) ? (secondaryColor as string) : accentColor;

  // Background image pool: rotate the gallery photos when provided, otherwise
  // fall back to the single cover art. Dedupe + keep only valid http(s) URLs.
  const bgSources = (() => {
    const pool = (backgroundImages && backgroundImages.length > 0
      ? backgroundImages
      : coverArt
      ? [coverArt]
      : []
    ).filter((u): u is string => typeof u === 'string' && /^https?:\/\//.test(u));
    return Array.from(new Set(pool)).slice(0, 8);
  })();

  // Background video pool (artist gallery clips) — interleaved with the photos.
  const bgVideos = (() => {
    const pool = (backgroundVideos || []).filter(
      (u): u is string => typeof u === 'string' && /^https?:\/\//.test(u),
    );
    return Array.from(new Set(pool)).slice(0, 3);
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
      {/* Animated aurora mesh gradient (brand palette) — cinematic depth base. */}
      <AuroraGradient frame={frame} fps={fps} primary={accentColor} secondary={secondary} />

      {/* Cinematic media background — artist photos (Ken-Burns) interleaved with
          gallery video clips, cross-fading. Falls back gracefully. */}
      {bgSources.length > 0 || bgVideos.length > 0 ? (
        <MediaBackground
          images={bgSources}
          videos={bgVideos}
          frame={frame}
          fps={fps}
          accentColor={accentColor}
        />
      ) : null}

      {/* Soft light-leak sweep + decorative beat-reactive rings */}
      <LightLeak frame={frame} fps={fps} color={secondary} />
      <DecorShapes
        frame={frame}
        fps={fps}
        accentColor={accentColor}
        secondaryColor={secondary}
        pulse={audioPulse}
      />

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

      {/* Film grain texture for a premium cinematic finish */}
      <FilmGrain frame={frame} opacity={0.05} />

      {/* Progress bar */}
      {showProgressBar && <ProgressBar progress={totalProgress} accentColor={accentColor} />}

      {/* Watermark */}
      {showWatermark && <Watermark />}

      {/* Cinematic intro title card (first ~2.6s) */}
      <IntroCard
        artistName={artistName}
        songTitle={songTitle}
        coverArt={coverArt}
        accentColor={accentColor}
        frame={frame}
        fps={fps}
        introSec={2.6}
      />

      {/* Cinematic outro card (last ~3.2s) */}
      <OutroCard
        artistName={artistName}
        accentColor={accentColor}
        frame={frame}
        fps={fps}
        startFrame={Math.max(0, durationInFrames - Math.round(fps * 3.2))}
      />

      {/* Audio — only mount when a real URL is present; Remotion's <Audio>
          throws "No 'src' was passed" when src is empty (e.g. live preview). */}
      {audioUrl ? <Audio src={audioUrl} /> : null}
    </AbsoluteFill>
  );
};

export default LyricsVideoComposition;
