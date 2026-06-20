import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  Video,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';

// ============================================================
// Types - Compatible with client/src/interfaces/timeline.ts
// ============================================================

export interface RemotionClip {
  id: number;
  type: 'VIDEO' | 'IMAGE' | 'TEXT' | 'AUDIO';
  start: number;        // seconds
  duration: number;      // seconds
  url?: string;
  text?: string;
  volume?: number;
  opacity?: number;
  scale?: number;
  position?: { x: number; y: number };
  transition?: {
    type: 'fade' | 'slide' | 'wipe' | 'none';
    duration: number;  // seconds
  };
  // Ken Burns effect for images
  kenBurns?: {
    startScale: number;
    endScale: number;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  };
  // Text styling
  textStyle?: {
    fontSize: number;
    fontFamily: string;
    color: string;
    backgroundColor?: string;
    position: 'top' | 'center' | 'bottom';
    animation: 'fadeIn' | 'typewriter' | 'slideUp' | 'none';
  };
}

export interface MusicVideoProps {
  clips: RemotionClip[];
  audioUrl?: string;
  audioVolume?: number;
  title?: string;
  artistName?: string;
  backgroundColor?: string;
}

// ============================================================
// Sub-components
// ============================================================

const ImageSlide: React.FC<{
  clip: RemotionClip;
  fps: number;
  durationInFrames: number;
}> = ({ clip, fps, durationInFrames }) => {
  const frame = useCurrentFrame();
  const progress = frame / durationInFrames;

  const kb = clip.kenBurns ?? {
    startScale: 1.0,
    endScale: 1.15,
    startX: 50,
    startY: 50,
    endX: 50,
    endY: 50,
  };

  const scale = interpolate(progress, [0, 1], [kb.startScale, kb.endScale]);
  const translateX = interpolate(progress, [0, 1], [kb.startX - 50, kb.endX - 50]);
  const translateY = interpolate(progress, [0, 1], [kb.startY - 50, kb.endY - 50]);

  const opacity = clip.opacity ?? 1;

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
    >
      {clip.url && (
        <Img
          src={clip.url}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
            opacity,
          }}
        />
      )}
    </AbsoluteFill>
  );
};

const VideoClip: React.FC<{
  clip: RemotionClip;
  fps: number;
}> = ({ clip, fps }) => {
  if (!clip.url) return null;

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Video
        src={clip.url}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: clip.opacity ?? 1,
        }}
        volume={clip.volume ?? 1}
      />
    </AbsoluteFill>
  );
};

const TextOverlay: React.FC<{
  clip: RemotionClip;
  fps: number;
  durationInFrames: number;
}> = ({ clip, fps, durationInFrames }) => {
  const frame = useCurrentFrame();
  const style = clip.textStyle ?? {
    fontSize: 48,
    fontFamily: 'Inter, sans-serif',
    color: '#ffffff',
    position: 'bottom' as const,
    animation: 'fadeIn' as const,
  };

  let textOpacity = 1;
  if (style.animation === 'fadeIn') {
    textOpacity = interpolate(frame, [0, fps * 0.5], [0, 1], {
      extrapolateRight: 'clamp',
    });
  }

  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.3, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  let translateY = 0;
  if (style.animation === 'slideUp') {
    translateY = interpolate(frame, [0, fps * 0.4], [30, 0], {
      extrapolateRight: 'clamp',
    });
  }

  const positionStyle: React.CSSProperties = {
    top: style.position === 'top' ? '10%' : undefined,
    bottom: style.position === 'bottom' ? '10%' : undefined,
    justifyContent: style.position === 'center' ? 'center' : undefined,
  };

  return (
    <AbsoluteFill
      style={{
        ...positionStyle,
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 5%',
      }}
    >
      <div
        style={{
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          color: style.color,
          opacity: textOpacity * fadeOut,
          transform: `translateY(${translateY}px)`,
          textAlign: 'center',
          textShadow: '0 2px 8px rgba(0,0,0,0.8)',
          backgroundColor: style.backgroundColor ?? 'transparent',
          padding: style.backgroundColor ? '8px 16px' : 0,
          borderRadius: style.backgroundColor ? 8 : 0,
          lineHeight: 1.3,
        }}
      >
        {clip.text}
      </div>
    </AbsoluteFill>
  );
};

// ============================================================
// Main Composition
// ============================================================

export const MusicVideoComposition: React.FC<MusicVideoProps> = ({
  clips,
  audioUrl,
  audioVolume = 1,
  backgroundColor = '#000000',
}) => {
  const { fps, durationInFrames } = useVideoConfig();

  // Separate clips by type
  const mediaClips = clips.filter(c => c.type === 'VIDEO' || c.type === 'IMAGE');
  const textClips = clips.filter(c => c.type === 'TEXT');

  // Check if transitions are needed
  const hasTransitions = mediaClips.some(c => c.transition && c.transition.type !== 'none');

  const getTransitionPresentation = (type: string, durationInFrames: number) => {
    switch (type) {
      case 'slide': return slide({ direction: 'from-right' });
      case 'wipe': return wipe({ direction: 'from-left' });
      case 'fade':
      default: return fade();
    }
  };

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {/* Audio track */}
      {audioUrl && (
        <Audio src={audioUrl} volume={audioVolume} />
      )}

      {/* Media clips with transitions */}
      {hasTransitions ? (
        <TransitionSeries>
          {mediaClips.map((clip, index) => {
            const clipDurationFrames = Math.round(clip.duration * fps);
            const transition = clip.transition;
            const transitionDurationFrames = transition
              ? Math.round(transition.duration * fps)
              : 0;

            return (
              <React.Fragment key={clip.id}>
                <TransitionSeries.Sequence durationInFrames={clipDurationFrames}>
                  {clip.type === 'IMAGE' ? (
                    <ImageSlide clip={clip} fps={fps} durationInFrames={clipDurationFrames} />
                  ) : (
                    <VideoClip clip={clip} fps={fps} />
                  )}
                </TransitionSeries.Sequence>
                {transition && transition.type !== 'none' && index < mediaClips.length - 1 && (
                  <TransitionSeries.Transition
                    presentation={getTransitionPresentation(transition.type, transitionDurationFrames)}
                    timing={linearTiming({ durationInFrames: transitionDurationFrames })}
                  />
                )}
              </React.Fragment>
            );
          })}
        </TransitionSeries>
      ) : (
        /* Media clips without transitions - use Sequence */
        mediaClips.map((clip) => {
          const fromFrame = Math.round(clip.start * fps);
          const clipDurationFrames = Math.round(clip.duration * fps);

          return (
            <Sequence
              key={clip.id}
              from={fromFrame}
              durationInFrames={clipDurationFrames}
            >
              {clip.type === 'IMAGE' ? (
                <ImageSlide clip={clip} fps={fps} durationInFrames={clipDurationFrames} />
              ) : (
                <VideoClip clip={clip} fps={fps} />
              )}
            </Sequence>
          );
        })
      )}

      {/* Text overlays */}
      {textClips.map((clip) => {
        const fromFrame = Math.round(clip.start * fps);
        const clipDurationFrames = Math.round(clip.duration * fps);

        return (
          <Sequence
            key={`text-${clip.id}`}
            from={fromFrame}
            durationInFrames={clipDurationFrames}
          >
            <TextOverlay clip={clip} fps={fps} durationInFrames={clipDurationFrames} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
