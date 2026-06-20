import React from 'react';
import { Sequence, useCurrentFrame, useVideoConfig } from 'remotion';

export const MyComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ flex: 1, backgroundColor: 'black', color: 'white', fontSize: 50 }}>
      <Sequence from={0} durationInFrames={fps * 5}>
        <div style={{ textAlign: 'center', marginTop: '20%' }}>
          Welcome to Spotify Boost!
        </div>
      </Sequence>
      <Sequence from={fps * 5} durationInFrames={fps * 5}>
        <div style={{ textAlign: 'center', marginTop: '20%' }}>
          Let's Grow Your Streams!
        </div>
      </Sequence>
    </div>
  );
};
