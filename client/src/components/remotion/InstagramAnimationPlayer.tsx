import React, { useState, useEffect } from 'react';
import { Player } from '@remotion/player';
import { InstagramBoostAnimation } from './InstagramBoostAnimation';

interface InstagramAnimationPlayerProps {
  width?: number | string;
  height?: number | string;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * InstagramAnimationPlayer - Displays the Remotion animation for Instagram Boost page
 * 
 * This component wraps the Remotion Player to show a beautiful animation
 * demonstrating how the Instagram Boost features work.
 * 
 * Animation scenes:
 * 1. Welcome screen with Instagram branding
 * 2. AI Tools showcase
 * 3. Content generation demo
 * 4. Analytics and growth metrics
 * 5. Call to action
 * 
 * Total duration: 540 frames at 30fps = 18 seconds
 */
export const InstagramAnimationPlayer: React.FC<InstagramAnimationPlayerProps> = ({
  width = '100%',
  height = 400,
  autoPlay = true,
  loop = true,
  className = '',
  style = {},
}) => {
  // Total frames: 540 frames at 30fps = 18 seconds
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
      className={`instagram-animation-container ${className}`}
      style={{
        borderRadius: isMobile ? 16 : 24,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(131, 58, 180, 0.2), rgba(225, 48, 108, 0.2), rgba(252, 175, 69, 0.2))',
        boxShadow: '0 25px 50px -12px rgba(225, 48, 108, 0.3)',
        border: '1px solid rgba(225, 48, 108, 0.3)',
        maxWidth: '100%',
        ...style,
      }}
    >
      <Player
        component={InstagramBoostAnimation}
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

export default InstagramAnimationPlayer;
