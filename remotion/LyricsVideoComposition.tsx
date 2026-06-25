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

/** All available lyric-video compositions (12 cinematic arrangements). */
export type LyricsLayout =
  | 'center'
  | 'side'
  | 'lower'
  | 'top'
  | 'minimal'
  | 'left'
  | 'karaoke'
  | 'banner'
  | 'spotlight'
  | 'split'
  | 'cover'
  | 'stacked';

/** Placement config that drives how the kinetic lyrics stage is positioned. */
interface LyricPlacement {
  vertical: 'center' | 'top' | 'bottom';
  align: 'center' | 'left' | 'right';
  context: boolean; // show ghost prev/next lines
  sizeScale: number; // multiplier on the auto-fit active line size
  band: boolean; // translucent rounded band behind the active line
  maxWidth?: number;
  area?: { left?: number; right?: number; top?: number; bottom?: number };
}

/** Distinct, animated background "engines". Each template gets its own so the
 *  12 compositions look genuinely different (not all blurred the same way). */
export type BgStyle =
  | 'kenburns' // sharp slow zoom + pan, light cinematic grade
  | 'bokeh' // soft dreamy blur (the only fully-blurred one)
  | 'duotone' // brand-color duotone, beat-pulsing
  | 'parallax' // 3 sliding vertical panels (depth)
  | 'mirror' // mirrored kaleidoscope symmetry
  | 'mosaic' // animated video-wall tile grid
  | 'glitch' // RGB-split chromatic glitch
  | 'cinematic' // teal/orange grade + letterbox push-in
  | 'spotlight' // moving light reveal over a dark frame
  | 'zoomburst' // scale punches on the beat
  | 'panorama' // wide sharp horizontal pan
  | 'filmstrip'; // hard diagonal wipe slideshow

/** Per-layout recipe: which chrome to show + how to place the lyrics + which
 *  animated background engine to use. */
const LAYOUT_RECIPES: Record<
  LyricsLayout,
  { chip: boolean; cover: 'none' | 'full' | 'left' | 'circle-top'; bg: BgStyle; placement: LyricPlacement }
> = {
  center:    { chip: true,  cover: 'none',       bg: 'kenburns',  placement: { vertical: 'center', align: 'center', context: true,  sizeScale: 1,    band: false } },
  side:      { chip: false, cover: 'none',       bg: 'bokeh',     placement: { vertical: 'center', align: 'center', context: true,  sizeScale: 1,    band: false } },
  lower:     { chip: false, cover: 'none',       bg: 'cinematic', placement: { vertical: 'bottom', align: 'center', context: false, sizeScale: 0.78, band: true,  area: { bottom: 120 } } },
  top:       { chip: true,  cover: 'none',       bg: 'panorama',  placement: { vertical: 'top',    align: 'center', context: true,  sizeScale: 0.92, band: false, area: { top: 150 } } },
  minimal:   { chip: false, cover: 'none',       bg: 'spotlight', placement: { vertical: 'center', align: 'center', context: false, sizeScale: 1.08, band: false } },
  left:      { chip: false, cover: 'none',       bg: 'parallax',  placement: { vertical: 'center', align: 'left',   context: true,  sizeScale: 0.95, band: false, maxWidth: 1200, area: { left: 110, right: 110 } } },
  karaoke:   { chip: false, cover: 'none',       bg: 'duotone',   placement: { vertical: 'bottom', align: 'center', context: true,  sizeScale: 0.82, band: true,  area: { bottom: 90 } } },
  banner:    { chip: false, cover: 'none',       bg: 'mosaic',    placement: { vertical: 'center', align: 'center', context: false, sizeScale: 0.9,  band: true } },
  spotlight: { chip: false, cover: 'circle-top', bg: 'zoomburst', placement: { vertical: 'bottom', align: 'center', context: false, sizeScale: 0.8,  band: false, area: { bottom: 120 } } },
  split:     { chip: false, cover: 'left',       bg: 'mirror',    placement: { vertical: 'center', align: 'left',   context: true,  sizeScale: 0.74, band: false, maxWidth: 920, area: { left: 920, right: 70 } } },
  cover:     { chip: false, cover: 'full',       bg: 'kenburns',  placement: { vertical: 'bottom', align: 'center', context: false, sizeScale: 0.85, band: true,  area: { bottom: 130 } } },
  stacked:   { chip: true,  cover: 'none',       bg: 'glitch',    placement: { vertical: 'center', align: 'left',   context: true,  sizeScale: 0.72, band: false, maxWidth: 1300, area: { left: 140, right: 140 } } },
};


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
  /** Layout / composition of the lyrics on screen. 12 cinematic arrangements. */
  layout?: LyricsLayout;
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
  placement?: LyricPlacement;
}> = ({ segments, activeIdx, timeSec, accentColor, frame, fps, preset, audioPulse, placement }) => {
  const { r, g, b } = hexToRgb(accentColor);
  const active = activeIdx >= 0 ? segments[activeIdx] : null;
  const prev = activeIdx - 1 >= 0 ? segments[activeIdx - 1] : null;
  const next = activeIdx + 1 < segments.length ? segments[activeIdx + 1] : null;

  // Placement (drives the 12 composition variants). Falls back to centered.
  const place: LyricPlacement = placement ?? {
    vertical: 'center',
    align: 'center',
    context: true,
    sizeScale: 1,
    band: false,
  };
  const alignItems = place.align === 'left' ? 'flex-start' : place.align === 'right' ? 'flex-end' : 'center';
  const justifyContent = place.vertical === 'top' ? 'flex-start' : place.vertical === 'bottom' ? 'flex-end' : 'center';
  const wordsJustify = place.align === 'left' ? 'flex-start' : place.align === 'right' ? 'flex-end' : 'center';
  const textAlign = place.align as 'left' | 'right' | 'center';

  const tx = (s: string) => (preset.uppercase ? s.toUpperCase() : s);

  // Breath keeps the glow alive on quiet passages; audioPulse adds punch.
  const breath = 0.85 + 0.15 * Math.sin(timeSec * 2.2);
  const glow = preset.glow * (0.6 + 0.4 * audioPulse) * breath;

  // Auto-fit the active line size so long lines never overflow the stage.
  // Heuristic (render-safe, no DOM measurement): shrink as char count grows.
  const activeText = active ? (preset.uppercase ? active.text.toUpperCase() : active.text) : '';
  const activeChars = activeText.length;
  const baseSize = activeChars > 46 ? 58 : activeChars > 34 ? 70 : activeChars > 24 ? 82 : 96;
  const ACTIVE_SIZE = Math.round(baseSize * place.sizeScale);
  const SIDE_SIZE = Math.round(40 * place.sizeScale);

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
          justifyContent: wordsJustify,
          alignItems: 'baseline',
          gap: '6px 20px',
          maxWidth: place.maxWidth ?? 1500,
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
          maxWidth: place.maxWidth ?? 1300,
          textAlign,
          transform: `translateY(${dir === 'up' ? -4 : 4}px)`,
          filter: 'blur(0.4px)',
        }}
      >
        {tx(seg.text)}
      </div>
    );
  };

  // Translucent legibility band (used by subtitle/karaoke/cover layouts).
  const bandStyle: React.CSSProperties = place.band
    ? {
        background: 'rgba(8,6,18,0.46)',
        backdropFilter: 'blur(10px)',
        borderRadius: 26,
        padding: '22px 46px',
        border: `1px solid rgba(${r},${g},${b},0.22)`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }
    : {};

  return (
    <div
      style={{
        position: 'absolute',
        left: place.area?.left ?? 0,
        right: place.area?.right ?? 0,
        top: place.area?.top ?? 0,
        bottom: place.area?.bottom ?? 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems,
        justifyContent,
        gap: 34,
        padding: '0 90px',
        textAlign,
      }}
    >
      {place.context ? sideLine(prev, 'up') : null}
      <div
        style={{
          minHeight: ACTIVE_SIZE * preset.lineHeight,
          transform: `scale(${linePunch})`,
          willChange: 'transform',
          ...bandStyle,
        }}
      >
        {renderActiveLine()}
      </div>
      {place.context ? sideLine(next, 'down') : null}
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

/** Renders a single still photo with a chosen animated treatment. Pure helper
 *  used by MediaBackground so every template can have its own look. */
const StyledPhoto: React.FC<{
  src: string;
  bg: BgStyle;
  t: number;
  phase: number;
  progress: number;
  dir: number;
  pulse: number;
  a: { r: number; g: number; b: number };
  s: { r: number; g: number; b: number };
}> = ({ src, bg, t, phase, progress, dir, pulse, a, s }) => {
  const cover: React.CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
  const grade = 'brightness(0.86) contrast(1.07) saturate(1.16)';

  switch (bg) {
    case 'bokeh': {
      const scale = 1.06 + progress * 0.14;
      const dx = dir * (progress * 5 - 2.5);
      return (
        <Img src={src} style={{ ...cover, filter: 'blur(18px) brightness(0.58) saturate(1.35)', transform: `scale(${scale}) translate(${dx}%, 0)` }} />
      );
    }
    case 'duotone': {
      const p = 0.78 + 0.28 * pulse;
      const scale = 1.04 + progress * 0.14;
      return (
        <>
          <Img src={src} style={{ ...cover, filter: `grayscale(1) contrast(1.18) brightness(${p})`, transform: `scale(${scale})` }} />
          <AbsoluteFill style={{ background: `linear-gradient(135deg, rgba(${a.r},${a.g},${a.b},0.92), rgba(${s.r},${s.g},${s.b},0.78))`, mixBlendMode: 'color' }} />
          <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, rgba(${a.r},${a.g},${a.b},${0.16 + 0.18 * pulse}), transparent 60%)`, mixBlendMode: 'screen' }} />
        </>
      );
    }
    case 'parallax': {
      const scale = 1.1 + progress * 0.1;
      return (
        <AbsoluteFill style={{ display: 'flex' }}>
          {[0, 1, 2].map((si) => {
            const ty = Math.sin(t * 0.32 * (1 + si * 0.5) + si * 1.7) * 3.5;
            return (
              <div key={si} style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                <Img src={src} style={{ position: 'absolute', top: 0, left: `${-si * 100}%`, width: '300%', height: '100%', objectFit: 'cover', filter: grade, transform: `translateY(${ty}%) scale(${scale})` }} />
              </div>
            );
          })}
        </AbsoluteFill>
      );
    }
    case 'mirror': {
      const scale = 1.06 + progress * 0.12;
      const drift = Math.sin(t * 0.4) * 2.5;
      const half: React.CSSProperties = { position: 'absolute', inset: 0, width: '200%', height: '100%', objectFit: 'cover', filter: grade, transform: `scale(${scale}) translateX(${drift}%)` };
      return (
        <AbsoluteFill style={{ display: 'flex' }}>
          <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
            <Img src={src} style={half} />
          </div>
          <div style={{ position: 'relative', flex: 1, overflow: 'hidden', transform: 'scaleX(-1)' }}>
            <Img src={src} style={half} />
          </div>
        </AbsoluteFill>
      );
    }
    case 'mosaic': {
      return (
        <AbsoluteFill style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gridTemplateRows: 'repeat(2,1fr)', gap: 6, background: '#000' }}>
          {Array.from({ length: 6 }).map((_, ti) => {
            const tp = 0.5 + 0.5 * Math.sin(t * 1.3 + ti * 0.9);
            const sc = 1.02 + progress * 0.06 + 0.07 * tp;
            return (
              <div key={ti} style={{ position: 'relative', overflow: 'hidden' }}>
                <Img src={src} style={{ ...cover, filter: grade, transform: `scale(${sc})`, opacity: 0.82 + 0.18 * tp }} />
              </div>
            );
          })}
        </AbsoluteFill>
      );
    }
    case 'glitch': {
      const scale = 1.05 + progress * 0.12;
      const tick = Math.floor(t * 12);
      const jit = tick % 5 === 0 ? noise2D('glitch', tick, dir) * 9 : 0;
      return (
        <>
          <Img src={src} style={{ ...cover, filter: grade, transform: `scale(${scale})` }} />
          <AbsoluteFill style={{ mixBlendMode: 'screen', transform: `translate(${7 + jit}px, ${jit * 0.4}px)`, opacity: 0.55 }}>
            <Img src={src} style={{ ...cover, filter: 'sepia(1) hue-rotate(-55deg) saturate(7) brightness(1)' }} />
          </AbsoluteFill>
          <AbsoluteFill style={{ mixBlendMode: 'screen', transform: `translate(${-7 - jit}px, ${-jit * 0.4}px)`, opacity: 0.55 }}>
            <Img src={src} style={{ ...cover, filter: 'sepia(1) hue-rotate(130deg) saturate(7) brightness(1)' }} />
          </AbsoluteFill>
          <AbsoluteFill style={{ background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.0) 0px, rgba(0,0,0,0.22) 2px, rgba(0,0,0,0.0) 4px)', opacity: 0.5 }} />
        </>
      );
    }
    case 'cinematic': {
      const scale = 1.04 + progress * 0.11;
      const dx = dir * (progress * 3 - 1.5);
      return (
        <>
          <Img src={src} style={{ ...cover, filter: 'contrast(1.14) saturate(1.12) brightness(0.82)', transform: `scale(${scale}) translateX(${dx}%)` }} />
          <AbsoluteFill style={{ background: 'linear-gradient(120deg, rgba(0,70,95,0.40), rgba(95,45,0,0.34))', mixBlendMode: 'soft-light' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '9%', background: '#000' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '9%', background: '#000' }} />
        </>
      );
    }
    case 'spotlight': {
      const scale = 1.05 + progress * 0.1;
      const sx = 50 + Math.sin(t * 0.5) * 24;
      const sy = 46 + Math.cos(t * 0.42) * 18;
      const mask = `radial-gradient(circle at ${sx}% ${sy}%, black 0%, black 20%, transparent 42%)`;
      return (
        <>
          <Img src={src} style={{ ...cover, filter: 'brightness(0.34) contrast(1.12) saturate(1.05)', transform: `scale(${scale})` }} />
          <AbsoluteFill style={{ WebkitMaskImage: mask, maskImage: mask }}>
            <Img src={src} style={{ ...cover, filter: 'brightness(1.08) contrast(1.12) saturate(1.18)', transform: `scale(${scale})` }} />
          </AbsoluteFill>
          <AbsoluteFill style={{ background: `radial-gradient(circle at ${sx}% ${sy}%, rgba(${a.r},${a.g},${a.b},0.22) 0%, transparent 34%)`, mixBlendMode: 'screen' }} />
        </>
      );
    }
    case 'zoomburst': {
      const base = 1.06 + progress * 0.1;
      const burst = base + 0.12 * pulse;
      const rot = Math.sin(t * 0.3) * 1.6;
      return (
        <>
          <Img src={src} style={{ ...cover, filter: grade, transform: `scale(${burst}) rotate(${rot}deg)` }} />
          <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, rgba(${a.r},${a.g},${a.b},${0.1 + 0.16 * pulse}) 0%, transparent 45%)`, mixBlendMode: 'screen' }} />
        </>
      );
    }
    case 'panorama': {
      const px = interpolate(progress, [0, 1], [0, -26]) * dir;
      return (
        <Img src={src} style={{ position: 'absolute', top: 0, left: `${dir > 0 ? 0 : -28}%`, width: '128%', height: '100%', objectFit: 'cover', filter: grade, transform: `translateX(${px}%) scale(1.12)` }} />
      );
    }
    case 'filmstrip':
    case 'kenburns':
    default: {
      const scale = 1.05 + progress * 0.17;
      const panX = dir * (progress * 4.5 - 2.25);
      const panY = progress * 3 - 1.5;
      return <Img src={src} style={{ ...cover, filter: grade, transform: `scale(${scale}) translate(${panX}%, ${panY}%)` }} />;
    }
  }
};

/** Unified cinematic background: interleaves artist photos with gallery video
 *  clips, cross-fading between slots, and applies the per-template animated
 *  treatment selected by `bgStyle`. Falls back gracefully when only photos (or
 *  nothing) are available. */
const MediaBackground: React.FC<{
  images: string[];
  videos: string[];
  frame: number;
  fps: number;
  accentColor: string;
  secondaryColor: string;
  pulse: number;
  bgStyle: BgStyle;
}> = ({ images, videos, frame, fps, accentColor, secondaryColor, pulse, bgStyle }) => {
  const a = hexToRgb(accentColor);
  const s = hexToRgb(secondaryColor);
  const { r, g, b } = a;
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

  // Hard-cut style wipes fast; glitch snaps; everything else cross-fades.
  const FADE = bgStyle === 'filmstrip' ? 0.45 : bgStyle === 'glitch' ? 0.4 : 1.2;
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
        const progress = phase / (slot.hold + FADE);

        // Diagonal hard-wipe entrance for the filmstrip engine.
        let clipPath: string | undefined;
        if (bgStyle === 'filmstrip') {
          const w = phase < FADE ? phase / FADE : 1;
          const edge = w * 150;
          clipPath = `polygon(0 0, ${edge}% 0, ${edge - 30}% 100%, 0 100%)`;
        }

        if (slot.kind === 'video') {
          // Videos keep a sharp Ken-Burns treatment (tiling/mirroring a live
          // clip is too costly); still graded + moving.
          const fromFrame = frame - Math.round(phase * fps);
          const scale = 1.06 + progress * 0.14;
          const dx = dir * (progress * 4 - 2);
          const vfilter = bgStyle === 'bokeh' ? 'blur(16px) brightness(0.6) saturate(1.3)' : 'brightness(0.84) contrast(1.06) saturate(1.15)';
          return (
            <AbsoluteFill key={i} style={{ opacity, clipPath }}>
              <Sequence from={fromFrame} layout="none">
                <AbsoluteFill style={{ filter: vfilter, transform: `scale(${scale}) translate(${dx}%, 0)` }}>
                  <OffthreadVideo src={slot.src} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </AbsoluteFill>
              </Sequence>
            </AbsoluteFill>
          );
        }

        return (
          <AbsoluteFill key={i} style={{ opacity, clipPath }}>
            <StyledPhoto src={slot.src} bg={bgStyle} t={t} phase={phase} progress={progress} dir={dir} pulse={pulse} a={a} s={s} />
          </AbsoluteFill>
        );
      })}

      {/* Legibility veils — lighter for sharp engines so the photo reads, the
          lyrics carry their own shadow/band on top. */}
      <AbsoluteFill
        style={{
          background:
            bgStyle === 'bokeh'
              ? 'linear-gradient(180deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.24) 38%, rgba(0,0,0,0.30) 64%, rgba(0,0,0,0.66) 100%)'
              : 'linear-gradient(180deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.08) 34%, rgba(0,0,0,0.14) 60%, rgba(0,0,0,0.52) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            bgStyle === 'bokeh'
              ? 'radial-gradient(ellipse at 50% 48%, transparent 36%, rgba(0,0,0,0.42) 100%)'
              : 'radial-gradient(ellipse at 50% 50%, transparent 52%, rgba(0,0,0,0.26) 100%)',
        }}
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
// Layout chrome helpers (cover art arrangements + now-playing chip)
// ─────────────────────────────────────────────────────────────────────────────

/** Now-playing chip with cover thumbnail + song title + artist. */
const NowPlayingChip: React.FC<{
  coverArt?: string;
  songTitle: string;
  artistName: string;
  accentColor: string;
  position?: 'top' | 'top-left';
}> = ({ coverArt, songTitle, artistName, accentColor, position = 'top' }) => {
  const { r, g, b } = hexToRgb(accentColor);
  const posStyle: React.CSSProperties =
    position === 'top-left'
      ? { top: 56, left: 70 }
      : { top: 56, left: '50%', transform: 'translateX(-50%)' };
  return (
    <div
      style={{
        position: 'absolute',
        ...posStyle,
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
        <Img src={coverArt} style={{ width: 46, height: 46, borderRadius: 10, objectFit: 'cover' }} />
      ) : null}
      <div style={{ textAlign: 'left' }}>
        <div style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }}>{songTitle}</div>
        <div style={{ color: `rgba(${r},${g},${b},1)`, fontSize: 15, fontWeight: 600, marginTop: 2, letterSpacing: 1 }}>
          {artistName}
        </div>
      </div>
    </div>
  );
};

/** Full-bleed cover artwork backdrop with a dark legibility veil. */
const FullCoverBg: React.FC<{ src?: string; frame: number; fps: number }> = ({ src, frame, fps }) => {
  if (!src) return null;
  const t = frame / fps;
  const scale = 1.08 + 0.05 * Math.sin(t * 0.12); // slow Ken-Burns breathing
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, filter: 'brightness(0.7)' }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

/** Left-half cover panel (split layout) with a soft fade into the lyrics side. */
const LeftCoverPanel: React.FC<{ src?: string; accentColor: string; frame: number; fps: number }> = ({
  src,
  accentColor,
  frame,
  fps,
}) => {
  if (!src) return null;
  const { r, g, b } = hexToRgb(accentColor);
  const t = frame / fps;
  const scale = 1.06 + 0.04 * Math.sin(t * 0.1);
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 840, overflow: 'hidden' }}>
      <Img
        src={src}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to right, rgba(0,0,0,0.15), rgba(8,6,18,0.0) 55%, rgba(8,6,18,1) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: 4,
          background: `linear-gradient(to bottom, transparent, rgba(${r},${g},${b},0.6), transparent)`,
        }}
      />
    </div>
  );
};

/** Large circular cover near the top-center (spotlight layout). */
const CircleCoverTop: React.FC<{ src?: string; accentColor: string; frame: number; fps: number }> = ({
  src,
  accentColor,
  frame,
  fps,
}) => {
  if (!src) return null;
  const { r, g, b } = hexToRgb(accentColor);
  const t = frame / fps;
  const float = Math.sin(t * 0.8) * 8;
  const spin = (t * 6) % 360;
  return (
    <div
      style={{
        position: 'absolute',
        top: 140,
        left: '50%',
        transform: `translateX(-50%) translateY(${float}px)`,
      }}
    >
      <div
        style={{
          width: 360,
          height: 360,
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: `0 0 0 5px rgba(${r},${g},${b},0.5), 0 30px 90px rgba(0,0,0,0.6), 0 0 90px rgba(${r},${g},${b},0.4)`,
        }}
      >
        <Img
          src={src}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `rotate(${spin}deg)` }}
        />
      </div>
    </div>
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

  // Resolve the composition recipe (one of 12 cinematic arrangements).
  const recipe = LAYOUT_RECIPES[layout] ?? LAYOUT_RECIPES.center;

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
    return Array.from(new Set(pool)).slice(0, 16);
  })();

  // Background video pool (artist gallery clips) — interleaved with the photos.
  const bgVideos = (() => {
    const pool = (backgroundVideos || []).filter(
      (u): u is string => typeof u === 'string' && /^https?:\/\//.test(u),
    );
    return Array.from(new Set(pool)).slice(0, 4);
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
          secondaryColor={secondary}
          pulse={audioPulse}
          bgStyle={recipe.bg}
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

      {/* ── CENTER-family layouts (all non-side compositions) ── */}
      {layout !== 'side' && (
        <>
          {/* Optional cover-art chrome per recipe */}
          {recipe.cover === 'full' && <FullCoverBg src={coverArt} frame={frame} fps={fps} />}
          {recipe.cover === 'left' && (
            <LeftCoverPanel src={coverArt} accentColor={accentColor} frame={frame} fps={fps} />
          )}
          {recipe.cover === 'circle-top' && (
            <CircleCoverTop src={coverArt} accentColor={accentColor} frame={frame} fps={fps} />
          )}

          {/* Now-playing chip (only for recipes that want it) */}
          {recipe.chip && (
            <NowPlayingChip
              coverArt={coverArt}
              songTitle={songTitle}
              artistName={artistName}
              accentColor={accentColor}
              position={layout === 'stacked' ? 'top-left' : 'top'}
            />
          )}

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
              placement={recipe.placement}
            />
          )}
        </>
      )}

      {/* Idle message before first segment */}
      {activeIdx === -1 && timeSec < (segments[0]?.start ?? 0) && (
        <div
          style={{
            position: 'absolute',
            ...(layout !== 'side'
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
