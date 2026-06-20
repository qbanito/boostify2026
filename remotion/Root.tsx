import React from 'react';
import { Composition } from 'remotion';
import { MusicVideoComposition } from './Composition';
import type { MusicVideoProps } from './Composition';
import { LyricsVideoComposition } from './LyricsVideoComposition';
import type { LyricsVideoProps } from './LyricsVideoComposition';

// Default props for preview in Remotion Studio
const defaultProps: MusicVideoProps = {
  clips: [
    {
      id: 1,
      type: 'IMAGE',
      start: 0,
      duration: 4,
      url: 'https://placehold.co/1080x1920/1a1a2e/e94560?text=Scene+1',
      kenBurns: {
        startScale: 1.0,
        endScale: 1.2,
        startX: 48,
        startY: 48,
        endX: 52,
        endY: 52,
      },
      transition: { type: 'fade', duration: 0.5 },
    },
    {
      id: 2,
      type: 'IMAGE',
      start: 4,
      duration: 4,
      url: 'https://placehold.co/1080x1920/16213e/0f3460?text=Scene+2',
      kenBurns: {
        startScale: 1.1,
        endScale: 1.0,
        startX: 52,
        startY: 50,
        endX: 48,
        endY: 50,
      },
      transition: { type: 'slide', duration: 0.5 },
    },
    {
      id: 3,
      type: 'IMAGE',
      start: 8,
      duration: 4,
      url: 'https://placehold.co/1080x1920/533483/e94560?text=Scene+3',
      kenBurns: {
        startScale: 1.0,
        endScale: 1.15,
        startX: 50,
        startY: 45,
        endX: 50,
        endY: 55,
      },
      transition: { type: 'wipe', duration: 0.5 },
    },
    {
      id: 10,
      type: 'TEXT',
      start: 1,
      duration: 3,
      text: 'BOOSTIFY MUSIC',
      textStyle: {
        fontSize: 64,
        fontFamily: 'Inter, sans-serif',
        color: '#ffffff',
        position: 'center',
        animation: 'fadeIn',
      },
    },
    {
      id: 11,
      type: 'TEXT',
      start: 5,
      duration: 3,
      text: 'AI Music Video Creator',
      textStyle: {
        fontSize: 48,
        fontFamily: 'Inter, sans-serif',
        color: '#e94560',
        position: 'bottom',
        animation: 'slideUp',
      },
    },
  ],
  backgroundColor: '#000000',
  title: 'Demo Music Video',
  artistName: 'Boostify Artist',
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Main Music Video - Vertical (TikTok/Reels/Shorts) */}
      <Composition
        id="MusicVideo"
        component={MusicVideoComposition}
        durationInFrames={30 * 12} // 12 seconds default preview
        fps={30}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
      />

      {/* Music Video - Horizontal (YouTube) */}
      <Composition
        id="MusicVideoHorizontal"
        component={MusicVideoComposition}
        durationInFrames={30 * 12}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={defaultProps}
      />

      {/* Music Video - Square (Instagram Feed) */}
      <Composition
        id="MusicVideoSquare"
        component={MusicVideoComposition}
        durationInFrames={30 * 12}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={defaultProps}
      />

      {/* Lyrics Video - Horizontal 16:9 (YouTube Karaoke) */}
      <Composition
        id="LyricsVideoHorizontal"
        component={LyricsVideoComposition}
        durationInFrames={30 * 180} // 3-minute default
        fps={30}
        width={1920}
        height={1080}
        calculateMetadata={({ props }) => {
          // Derive the real clip length from the song duration so the render's
          // requested frame range never exceeds the composition length.
          const fps = 30;
          const p = props as LyricsVideoProps & { durationFrames?: number };
          const fromFrames = typeof p.durationFrames === 'number' && p.durationFrames > 0
            ? p.durationFrames
            : Math.ceil((p.durationSecs ?? 180) * fps) + fps;
          return { durationInFrames: Math.max(fps, fromFrames), fps };
        }}
        defaultProps={{
          audioUrl: '',
          artistName: 'Artist Name',
          songTitle: 'Song Title',
          segments: [
            { start: 2, end: 6, text: '🎵 Your lyrics will appear here' },
            { start: 7, end: 12, text: 'Each line synced to the beat' },
            { start: 13, end: 18, text: 'Word by word karaoke highlight' },
          ],
          theme: 'dark' as const,
          accentColor: '#7c3aed',
          fontFamily: 'Inter',
          showProgressBar: true,
          showWatermark: true,
        } as LyricsVideoProps}
      />
    </>
  );
};
