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

const BlurredBackground: React.FC<{ src: string; frame: number; fps: number; accentColor: string }> = ({ src, frame, fps, accentColor }) => {
  const { r, g, b } = hexToRgb(accentColor);
  // Slow cinematic Ken-Burns drift so the artist cover feels alive behind the text.
  const scale = interpolate(frame, [0, fps * 60], [1.18, 1.32], { extrapolateRight: 'clamp' });
  const driftX = interpolate(frame, [0, fps * 60], [-2, 2], { extrapolateRight: 'clamp' });
  const driftY = interpolate(frame, [0, fps * 60], [1.5, -1.5], { extrapolateRight: 'clamp' });
  return (
    <>
      <AbsoluteFill
        style={{
          filter: 'blur(45px) brightness(0.4) saturate(1.45)',
          transform: `scale(${scale}) translate(${driftX}%, ${driftY}%)`,
        }}
      >
        <Img src={src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </AbsoluteFill>
      {/* Dark veil + brand tint so overlaid lyrics stay legible on any cover */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(105deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 42%, rgba(${r},${g},${b},0.18) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at 70% 50%, transparent 30%, rgba(0,0,0,0.55) 100%)',
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
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const timeSec = frame / fps;
  const totalProgress = frame / durationInFrames;
  const activeIdx = getActiveSegmentIdx(segments, timeSec);

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
        fontFamily: `'${fontFamily}', system-ui, sans-serif`,
        overflow: 'hidden',
      }}
    >
      {/* Blurred artist cover — always the hero background when a cover exists,
          so the lyrics read "encima" of the blurred portada on every theme. */}
      {coverArt ? (
        <BlurredBackground src={coverArt} frame={frame} fps={fps} accentColor={accentColor} />
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

      {/* Idle message before first segment */}
      {activeIdx === -1 && timeSec < (segments[0]?.start ?? 0) && (
        <div
          style={{
            position: 'absolute',
            left: 620,
            right: 60,
            top: '50%',
            transform: 'translateY(-50%)',
            color: `rgba(${r},${g},${b},0.6)`,
            fontSize: 28,
            fontWeight: 500,
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
