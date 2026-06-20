import React, { useState, useEffect } from 'react';
import { Player } from '@remotion/player';
import { SpotifyBoostAnimation } from './SpotifyBoostAnimation';

interface SpotifyAnimationPlayerProps {
  width?: number | string;
  height?: number | string;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * SpotifyAnimationPlayer - Displays the Remotion animation for Spotify page
 * 
 * This component wraps the Remotion Player to show a beautiful animation
 * demonstrating how the Spotify Growth Tools work.
 * 
 * Animation scenes:
 * 1. Welcome screen with Spotify branding
 * 2. AI Tools showcase
 * 3. Playlist matching demo
 * 4. Growth metrics and stats
 * 5. Call to action
 * 
 * Total duration: 540 frames at 30fps = 18 seconds
 */
export const SpotifyAnimationPlayer: React.FC<SpotifyAnimationPlayerProps> = ({
  width = '100%',
  height = 400,
  autoPlay = true,
  loop = true,
  className = '',
  style = {},
}) => {
  const durationInFrames = 540;
  const fps = 30;
  
  // Use state for responsive sizing
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const responsiveHeight = isMobile ? 220 : (typeof height === 'number' ? height : 400);

  return (
    <div 
      className={`spotify-animation-container ${className}`}
      style={{
        borderRadius: isMobile ? 16 : 24,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(29, 185, 84, 0.2), rgba(25, 20, 20, 0.4))',
        boxShadow: '0 25px 50px -12px rgba(29, 185, 84, 0.3)',
        border: '1px solid rgba(29, 185, 84, 0.3)',
        maxWidth: '100%',
        ...style,
      }}
    >
      <Player
        component={SpotifyBoostAnimation}
        durationInFrames={durationInFrames}
        fps={fps}
        compositionWidth={800}
        compositionHeight={500}
        style={{
          width: '100%',
          height: responsiveHeight,
          aspectRatio: '16/10',
        }}
        autoPlay={autoPlay}
        loop={loop}
        controls={false}
        showVolumeControls={false}
      />
    </div>
  );
};

export default SpotifyAnimationPlayer;
