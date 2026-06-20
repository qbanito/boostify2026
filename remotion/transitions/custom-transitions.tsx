/**
 * Custom Remotion Transition Presentations
 * Adapted from claude-code-video-toolkit (digitalsamba/claude-code-video-toolkit)
 *
 * 7 effects: glitch, rgbSplit, zoomBlur, lightLeak, clockWipe, pixelate, checkerboard
 *
 * Usage with TransitionSeries:
 *   <TransitionSeries>
 *     <TransitionSeries.Sequence durationInFrames={120}>
 *       <SceneA />
 *     </TransitionSeries.Sequence>
 *     <TransitionSeries.Transition timing={springTiming({ damping: 200 })} presentation={glitch()} />
 *     <TransitionSeries.Sequence durationInFrames={120}>
 *       <SceneB />
 *     </TransitionSeries.Sequence>
 *   </TransitionSeries>
 *
 * Frame-based overlay effects (for LyricsVideoComposition):
 *   Use getSegmentTransitionStyle() to get CSS for a div rendered at segment changes.
 */

import React from 'react';
import { interpolate } from 'remotion';
import type { TransitionPresentation } from '@remotion/transitions';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CustomTransition =
  | 'glitch'
  | 'rgbSplit'
  | 'zoomBlur'
  | 'lightLeak'
  | 'clockWipe'
  | 'pixelate'
  | 'checkerboard';

export type LyricsTransitionEffect = 'none' | 'flash' | 'glitch' | 'rgbSplit' | 'zoomBlur';

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Bell-curve: 0 at start and end, peaks at middle of transition */
const peakCurve = (progress: number) => Math.sin(progress * Math.PI);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Glitch  ─ horizontal band displacement
// ─────────────────────────────────────────────────────────────────────────────

type GlitchProps = { color?: string; intensity?: number };

const GlitchPresentation: React.FC<{
  children: React.ReactNode;
  presentationProgress: number;
  presentationDirection: 'entering' | 'exiting';
  passedProps: GlitchProps;
}> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const intensity = (passedProps.intensity ?? 1) * peakCurve(presentationProgress);
  const shift = (presentationDirection === 'exiting' ? -1 : 1) * 14 * intensity;
  const bands = [8, 21, 36, 51, 67, 82];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '100%', transform: `translateX(${shift * 0.4}px)` }}>
        {children}
      </div>
      {bands.map((top, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `${top}%`,
            height: `${2 + (i % 3) * 1.5}%`,
            left: 0,
            right: 0,
            background: `rgba(${i % 2 === 0 ? '255,0,80' : '0,200,255'},${0.4 * intensity})`,
            transform: `translateX(${(i % 2 === 0 ? 1 : -1) * 10 * intensity}px)`,
            mixBlendMode: 'screen' as const,
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  );
};

export function glitch(props: GlitchProps = {}): TransitionPresentation<GlitchProps> {
  return { component: GlitchPresentation as any, props };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RGB Split  ─ chromatic aberration
// ─────────────────────────────────────────────────────────────────────────────

type RgbSplitProps = { amount?: number };

const RgbSplitPresentation: React.FC<{
  children: React.ReactNode;
  presentationProgress: number;
  presentationDirection: 'entering' | 'exiting';
  passedProps: RgbSplitProps;
}> = ({ children, presentationProgress, passedProps }) => {
  const amount = (passedProps.amount ?? 14) * peakCurve(presentationProgress);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Red channel */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateX(${amount}px)`,
          opacity: 0.6,
          mixBlendMode: 'screen' as const,
        }}
      >
        <div style={{ width: '100%', height: '100%', filter: 'saturate(8) hue-rotate(0deg)' }}>
          {children}
        </div>
      </div>
      {/* Blue channel */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateX(${-amount}px)`,
          opacity: 0.6,
          mixBlendMode: 'screen' as const,
        }}
      >
        <div style={{ width: '100%', height: '100%', filter: 'saturate(8) hue-rotate(240deg)' }}>
          {children}
        </div>
      </div>
      {/* Base layer */}
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - peakCurve(presentationProgress) * 0.3 }}>
        {children}
      </div>
    </div>
  );
};

export function rgbSplit(props: RgbSplitProps = {}): TransitionPresentation<RgbSplitProps> {
  return { component: RgbSplitPresentation as any, props };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Zoom Blur  ─ scale + blur through transition
// ─────────────────────────────────────────────────────────────────────────────

type ZoomBlurProps = { scale?: number };

const ZoomBlurPresentation: React.FC<{
  children: React.ReactNode;
  presentationProgress: number;
  presentationDirection: 'entering' | 'exiting';
  passedProps: ZoomBlurProps;
}> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const maxScale = passedProps.scale ?? 1.08;
  const scaleVal =
    presentationDirection === 'entering'
      ? interpolate(presentationProgress, [0, 1], [maxScale, 1])
      : interpolate(presentationProgress, [0, 1], [1, maxScale]);
  const blurPx = peakCurve(presentationProgress) * 10;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transform: `scale(${scaleVal})`,
        filter: `blur(${blurPx}px)`,
        transformOrigin: 'center center',
      }}
    >
      {children}
    </div>
  );
};

export function zoomBlur(props: ZoomBlurProps = {}): TransitionPresentation<ZoomBlurProps> {
  return { component: ZoomBlurPresentation as any, props };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Light Leak  ─ bright radial sweep
// ─────────────────────────────────────────────────────────────────────────────

type LightLeakProps = { color?: string };

const LightLeakPresentation: React.FC<{
  children: React.ReactNode;
  presentationProgress: number;
  presentationDirection: 'entering' | 'exiting';
  passedProps: LightLeakProps;
}> = ({ children, presentationProgress, passedProps }) => {
  const color = passedProps.color ?? '#fff8e0';
  const opacity = peakCurve(presentationProgress) * 0.75;
  const x = interpolate(presentationProgress, [0, 1], [-20, 120]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {children}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 45% 100% at ${x}% 50%, ${color}, transparent)`,
          opacity,
          mixBlendMode: 'screen' as const,
        }}
      />
    </div>
  );
};

export function lightLeak(props: LightLeakProps = {}): TransitionPresentation<LightLeakProps> {
  return { component: LightLeakPresentation as any, props };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Clock Wipe  ─ clock-sweep clip-path reveal
// ─────────────────────────────────────────────────────────────────────────────

function buildClockPolygon(deg: number): string {
  if (deg >= 360) return 'polygon(0 0, 100% 0, 100% 100%, 0 100%)';
  const points = ['50% 50%', '50% 0%'];
  const corners: Array<[string, number]> = [
    ['100% 0%', 45],
    ['100% 100%', 135],
    ['0% 100%', 225],
    ['0% 0%', 315],
  ];
  corners.forEach(([pt, threshold]) => {
    if (deg > threshold) points.push(pt);
  });
  const rad = ((deg - 90) * Math.PI) / 180;
  const ex = (Math.cos(rad) * 100 + 100) / 2;
  const ey = (Math.sin(rad) * 100 + 100) / 2;
  points.push(`${ex.toFixed(1)}% ${ey.toFixed(1)}%`);
  points.push('50% 50%');
  return `polygon(${points.join(', ')})`;
}

const ClockWipePresentation: React.FC<{
  children: React.ReactNode;
  presentationProgress: number;
  presentationDirection: 'entering' | 'exiting';
  passedProps: Record<string, unknown>;
}> = ({ children, presentationProgress, presentationDirection }) => {
  const deg =
    presentationDirection === 'entering'
      ? interpolate(presentationProgress, [0, 1], [0, 360])
      : interpolate(presentationProgress, [0, 1], [360, 0]);

  return (
    <div style={{ width: '100%', height: '100%', clipPath: buildClockPolygon(deg) }}>
      {children}
    </div>
  );
};

export function clockWipe(): TransitionPresentation<Record<string, unknown>> {
  return { component: ClockWipePresentation as any, props: {} };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Pixelate  ─ pixelation through transition
// ─────────────────────────────────────────────────────────────────────────────

type PixelateProps = { maxPixelSize?: number };

const PixelatePresentation: React.FC<{
  children: React.ReactNode;
  presentationProgress: number;
  presentationDirection: 'entering' | 'exiting';
  passedProps: PixelateProps;
}> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const maxSize = passedProps.maxPixelSize ?? 48;
  const pixelSize =
    presentationDirection === 'entering'
      ? interpolate(presentationProgress, [0, 0.5, 1], [maxSize, maxSize / 2, 1])
      : interpolate(presentationProgress, [0, 0.5, 1], [1, maxSize / 2, maxSize]);
  const ps = Math.max(pixelSize, 1);
  const scale = 1 / ps;

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          width: `${100 * ps}%`,
          height: `${100 * ps}%`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          imageRendering: 'pixelated',
        }}
      >
        {children}
      </div>
    </div>
  );
};

export function pixelate(props: PixelateProps = {}): TransitionPresentation<PixelateProps> {
  return { component: PixelatePresentation as any, props };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Checkerboard  ─ tiled checker reveal
// ─────────────────────────────────────────────────────────────────────────────

type CheckerboardProps = { tileSize?: number; color?: string };

const CheckerboardPresentation: React.FC<{
  children: React.ReactNode;
  presentationProgress: number;
  presentationDirection: 'entering' | 'exiting';
  passedProps: CheckerboardProps;
}> = ({ children, presentationProgress, presentationDirection, passedProps }) => {
  const tiles = passedProps.tileSize ?? 80;
  const color = passedProps.color ?? '#000000';
  const overlayOpacity =
    presentationDirection === 'entering' ? 1 - presentationProgress : presentationProgress;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {children}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: `repeating-conic-gradient(${color} 0% 25%, transparent 0% 50%)`,
          backgroundSize: `${tiles}px ${tiles}px`,
          opacity: overlayOpacity,
        }}
      />
    </div>
  );
};

export function checkerboard(
  props: CheckerboardProps = {},
): TransitionPresentation<CheckerboardProps> {
  return { component: CheckerboardPresentation as any, props };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const CUSTOM_TRANSITIONS: Record<
  CustomTransition,
  (props?: any) => TransitionPresentation<any>
> = {
  glitch,
  rgbSplit,
  zoomBlur,
  lightLeak,
  clockWipe,
  pixelate,
  checkerboard,
};

// ─────────────────────────────────────────────────────────────────────────────
// Frame-based overlay helper for LyricsVideoComposition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns inline CSS style for a full-cover overlay div shown at segment change.
 * Fires for the first ~0.25s of each new segment.
 *
 * @param frameSinceSegmentStart - frames since current lyric segment started
 * @param fps - frames per second of the composition
 * @param effect - which visual effect to use
 * @param accentRgb - { r, g, b } values of the accent color
 * @returns CSS properties object or null if outside the transition window
 */
export function getSegmentTransitionStyle(
  frameSinceSegmentStart: number,
  fps: number,
  effect: LyricsTransitionEffect,
  accentRgb: { r: number; g: number; b: number },
): React.CSSProperties | null {
  const TRANSITION_FRAMES = Math.round(fps * 0.25); // ≈ 8 frames @ 30fps
  if (effect === 'none' || frameSinceSegmentStart < 0 || frameSinceSegmentStart >= TRANSITION_FRAMES) {
    return null;
  }

  const t = frameSinceSegmentStart / TRANSITION_FRAMES; // 0 → 1
  const fadeOut = 1 - t;
  const { r, g, b } = accentRgb;

  switch (effect) {
    case 'flash':
      return {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `rgba(${r},${g},${b},${fadeOut * 0.5})`,
        zIndex: 100,
      };

    case 'glitch': {
      const intensity = Math.sin(t * Math.PI);
      return {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: `
          repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 7px,
            rgba(255,0,80,${0.35 * intensity}) 7px,
            rgba(255,0,80,${0.35 * intensity}) 9px,
            transparent 9px,
            transparent 22px,
            rgba(0,200,255,${0.28 * intensity}) 22px,
            rgba(0,200,255,${0.28 * intensity}) 24px
          )
        `,
        transform: `translateX(${(t < 0.5 ? 5 : -3) * intensity}px)`,
        zIndex: 100,
      };
    }

    case 'rgbSplit':
      return {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        boxShadow: `${10 * fadeOut}px 0 0 rgba(255,0,80,0.45), ${-10 * fadeOut}px 0 0 rgba(0,200,255,0.45)`,
        zIndex: 100,
      };

    case 'zoomBlur':
      return {
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backdropFilter: `blur(${fadeOut * 4}px)`,
        zIndex: 100,
      };

    default:
      return null;
  }
}
