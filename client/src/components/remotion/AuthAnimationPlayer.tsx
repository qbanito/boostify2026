import React from 'react';
import { Player } from '@remotion/player';
import { LandingPageAnimation } from './LandingPageAnimation';

interface AuthAnimationPlayerProps {
  width?: number;
  height?: number;
  autoPlay?: boolean;
  loop?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * AuthAnimationPlayer - Displays the Remotion animation for the auth page
 * 
 * This component wraps the Remotion Player to show a beautiful animation
 * demonstrating how artists can create their landing page on Boostify.
 * 
 * Animation scenes:
 * 1. Welcome screen with Boostify branding
 * 2. Profile creation simulation
 * 3. Landing page preview
 * 4. Features showcase
 * 5. Call to action
 */
export const AuthAnimationPlayer: React.FC<AuthAnimationPlayerProps> = ({
  width = 600,
  height = 400,
  autoPlay = true,
  loop = true,
  className = '',
  style = {},
}) => {
  // Total frames: 550 frames at 30fps = ~18.3 seconds
  const durationInFrames = 550;
  const fps = 30;

  return (
    <div 
      className={`remotion-animation-container ${className}`}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(249, 115, 22, 0.25)',
        ...style,
      }}
    >
      <Player
        component={LandingPageAnimation}
        durationInFrames={durationInFrames}
        fps={fps}
        compositionWidth={800}
        compositionHeight={600}
        style={{
          width,
          height,
        }}
        autoPlay={autoPlay}
        loop={loop}
        controls={false}
        showVolumeControls={false}
      />
    </div>
  );
};

export default AuthAnimationPlayer;
