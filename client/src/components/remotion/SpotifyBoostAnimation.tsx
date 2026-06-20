import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from 'remotion';

// ============================================
// ANIMATED COMPONENTS FOR SPOTIFY BOOST
// ============================================

const SpotifyGradient = () => {
  const frame = useCurrentFrame();
  const rotation = interpolate(frame, [0, 300], [0, 360], {
    extrapolateRight: 'extend',
  });
  
  return (
    <div
      style={{
        position: 'absolute',
        width: '150%',
        height: '150%',
        left: '-25%',
        top: '-25%',
        background: `conic-gradient(from ${rotation}deg, #1DB954, #191414, #1DB954)`,
        opacity: 0.15,
        filter: 'blur(100px)',
      }}
    />
  );
};

const GlowOrb = ({ delay = 0, x = 0, y = 0, color = "#1DB954", size = 200 }: { 
  delay?: number; 
  x?: number; 
  y?: number; 
  color?: string;
  size?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  
  const pulse = Math.sin((frame - delay) / 15) * 0.15 + 1;
  
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}50 0%, transparent 70%)`,
        transform: `scale(${scale * pulse})`,
        filter: 'blur(40px)',
        position: 'absolute',
        left: x,
        top: y,
      }}
    />
  );
};

const AnimatedText = ({ text, delay = 0, size = 48, color = "#fff" }: { 
  text: string; 
  delay?: number;
  size?: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  const translateY = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 100 },
  });
  
  return (
    <div
      style={{
        fontSize: size,
        fontWeight: 900,
        color,
        opacity,
        transform: `translateY(${(1 - translateY) * 40}px)`,
      }}
    >
      {text}
    </div>
  );
};

const FloatingElement = ({ 
  children, 
  delay = 0, 
  floatRange = 10
}: { 
  children: React.ReactNode; 
  delay?: number;
  floatRange?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  
  const floatY = Math.sin((frame - delay) / 25) * floatRange;
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  
  return (
    <div
      style={{
        position: 'relative',
        transform: `scale(${scale}) translateY(${floatY}px)`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};

const ProgressBar = ({ delay = 0, progress = 100, color = "#1DB954" }: { 
  delay?: number; 
  progress?: number;
  color?: string;
}) => {
  const frame = useCurrentFrame();
  const currentProgress = interpolate(
    frame - delay,
    [0, 60],
    [0, progress],
    { extrapolateRight: 'clamp' }
  );
  
  return (
    <div
      style={{
        width: 200,
        height: 8,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${currentProgress}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${color}, #1ed760)`,
          borderRadius: 4,
        }}
      />
    </div>
  );
};

const CounterAnimation = ({ 
  delay = 0, 
  from = 0, 
  to = 1000, 
  suffix = "",
  duration = 60 
}: { 
  delay?: number; 
  from?: number; 
  to?: number;
  suffix?: string;
  duration?: number;
}) => {
  const frame = useCurrentFrame();
  const count = Math.floor(interpolate(
    frame - delay,
    [0, duration],
    [from, to],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  ));
  
  return (
    <span style={{ fontWeight: 900, fontSize: 42, fontFamily: 'monospace' }}>
      {count.toLocaleString()}{suffix}
    </span>
  );
};

const SoundWave = ({ delay = 0 }: { delay?: number }) => {
  const frame = useCurrentFrame();
  const bars = [0.3, 0.6, 1, 0.7, 0.5, 0.8, 0.4, 0.9, 0.5, 0.7];
  
  const opacity = interpolate(frame - delay, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  
  return (
    <div style={{ display: 'flex', alignItems: 'end', gap: 4, height: 40, opacity }}>
      {bars.map((height, i) => {
        const animatedHeight = Math.abs(Math.sin((frame + i * 10) / 8)) * height * 40;
        return (
          <div
            key={i}
            style={{
              width: 6,
              height: animatedHeight,
              backgroundColor: '#1DB954',
              borderRadius: 3,
              transition: 'height 0.1s',
            }}
          />
        );
      })}
    </div>
  );
};

// ============================================
// SCENE COMPONENTS
// ============================================

const Scene1_Welcome = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SpotifyGradient />
      <GlowOrb x={100} y={100} color="#1DB954" size={300} delay={0} />
      <GlowOrb x={500} y={350} color="#1ed760" size={250} delay={10} />
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: 20,
        zIndex: 10 
      }}>
        {/* Spotify Icon */}
        <FloatingElement delay={5}>
          <div style={{
            width: 80,
            height: 80,
            background: '#1DB954',
            borderRadius: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 40px rgba(29, 185, 84, 0.4)',
          }}>
            <svg width="50" height="50" viewBox="0 0 24 24" fill="#000">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
          </div>
        </FloatingElement>
        
        <AnimatedText text="Spotify Growth AI" delay={15} size={56} />
        <AnimatedText text="Boost Your Streams & Listeners" delay={30} size={24} color="rgba(255,255,255,0.7)" />
        
        <FloatingElement delay={45}>
          <SoundWave delay={45} />
        </FloatingElement>
      </div>
    </AbsoluteFill>
  );
};

const Scene2_Tools = () => {
  const tools = [
    { name: 'Listeners AI', icon: '👥', color: '#1DB954', delay: 0 },
    { name: 'Playlist Match', icon: '🎵', color: '#1ed760', delay: 10 },
    { name: 'Curator Finder', icon: '📧', color: '#169c46', delay: 20 },
    { name: 'SEO Optimizer', icon: '🔍', color: '#14833a', delay: 30 },
  ];
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
      }}
    >
      <SpotifyGradient />
      
      <AnimatedText text="AI-Powered Tools" delay={0} size={48} />
      
      <div style={{ 
        display: 'flex', 
        gap: 20, 
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 700,
      }}>
        {tools.map((tool) => (
          <FloatingElement key={tool.name} delay={tool.delay + 15} floatRange={5}>
            <div style={{
              padding: '20px 30px',
              background: `linear-gradient(135deg, ${tool.color}20, ${tool.color}40)`,
              border: `2px solid ${tool.color}60`,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <span style={{ fontSize: 32 }}>{tool.icon}</span>
              <span style={{ 
                color: '#fff', 
                fontSize: 18, 
                fontWeight: 600 
              }}>{tool.name}</span>
            </div>
          </FloatingElement>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Scene3_PlaylistMatch = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        padding: 60,
      }}
    >
      <SpotifyGradient />
      <GlowOrb x={600} y={200} color="#1DB954" size={300} delay={0} />
      
      {/* Your Track */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: 20,
        flex: 1,
        alignItems: 'center',
      }}>
        <AnimatedText text="Your Track" delay={0} size={28} />
        
        <FloatingElement delay={15}>
          <div style={{
            width: 200,
            padding: 20,
            background: 'rgba(29, 185, 84, 0.2)',
            borderRadius: 16,
            border: '2px solid rgba(29, 185, 84, 0.4)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🎵</div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
              Your New Single
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
              Indie Pop • 3:24
            </div>
          </div>
        </FloatingElement>
      </div>
      
      {/* Arrow */}
      <FloatingElement delay={30} floatRange={0}>
        <div style={{ 
          fontSize: 48, 
          color: '#1DB954',
          textShadow: '0 0 30px #1DB954' 
        }}>
          →
        </div>
      </FloatingElement>
      
      {/* Matched Playlists */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: 15,
        flex: 1,
      }}>
        <AnimatedText text="Perfect Matches" delay={35} size={28} />
        
        {[
          { name: 'Indie Vibes', followers: '850K', match: 95 },
          { name: 'Fresh Finds', followers: '1.2M', match: 89 },
          { name: 'Discover Weekly', followers: '2.5M', match: 82 },
        ].map((playlist, i) => (
          <FloatingElement key={playlist.name} delay={45 + i * 10} floatRange={3}>
            <div style={{
              padding: '12px 20px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              border: '1px solid rgba(29, 185, 84, 0.3)',
            }}>
              <div>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{playlist.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{playlist.followers} followers</div>
              </div>
              <div style={{
                padding: '4px 12px',
                background: '#1DB954',
                borderRadius: 20,
                color: '#000',
                fontSize: 14,
                fontWeight: 700,
              }}>
                {playlist.match}%
              </div>
            </div>
          </FloatingElement>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Scene4_Growth = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
      }}
    >
      <SpotifyGradient />
      
      <AnimatedText text="Watch Your Growth" delay={0} size={48} />
      
      <div style={{ display: 'flex', gap: 40, marginTop: 20 }}>
        {/* Monthly Listeners */}
        <FloatingElement delay={15} floatRange={8}>
          <div style={{
            padding: 30,
            background: 'linear-gradient(135deg, #1DB95420, #1DB95440)',
            border: '2px solid #1DB95460',
            borderRadius: 20,
            textAlign: 'center',
            minWidth: 180,
          }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              Monthly Listeners
            </div>
            <div style={{ color: '#fff' }}>
              <CounterAnimation delay={20} from={0} to={125000} duration={50} />
            </div>
            <div style={{ 
              marginTop: 12, 
              color: '#1DB954', 
              fontSize: 14, 
              fontWeight: 600 
            }}>
              ↑ 340% growth
            </div>
          </div>
        </FloatingElement>
        
        {/* Streams */}
        <FloatingElement delay={25} floatRange={8}>
          <div style={{
            padding: 30,
            background: 'linear-gradient(135deg, #1ed76020, #1ed76040)',
            border: '2px solid #1ed76060',
            borderRadius: 20,
            textAlign: 'center',
            minWidth: 180,
          }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              Total Streams
            </div>
            <div style={{ color: '#fff' }}>
              <CounterAnimation delay={30} from={0} to={2500000} suffix="" duration={50} />
            </div>
            <div style={{ 
              marginTop: 12, 
              color: '#1DB954', 
              fontSize: 14, 
              fontWeight: 600 
            }}>
              ↑ 2.5M plays
            </div>
          </div>
        </FloatingElement>
        
        {/* Playlists */}
        <FloatingElement delay={35} floatRange={8}>
          <div style={{
            padding: 30,
            background: 'linear-gradient(135deg, #169c4620, #169c4640)',
            border: '2px solid #169c4660',
            borderRadius: 20,
            textAlign: 'center',
            minWidth: 180,
          }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              Playlist Adds
            </div>
            <div style={{ color: '#fff' }}>
              <CounterAnimation delay={40} from={0} to={850} duration={50} />
            </div>
            <div style={{ 
              marginTop: 12, 
              color: '#1DB954', 
              fontSize: 14, 
              fontWeight: 600 
            }}>
              ↑ 850 playlists
            </div>
          </div>
        </FloatingElement>
      </div>
      
      {/* Sound Wave */}
      <FloatingElement delay={50}>
        <SoundWave delay={50} />
      </FloatingElement>
    </AbsoluteFill>
  );
};

const Scene5_CTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const buttonScale = spring({
    frame: frame - 30,
    fps,
    config: { damping: 8, stiffness: 150 },
  });
  
  const pulse = Math.sin((frame - 30) / 8) * 0.05 + 1;
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 30,
      }}
    >
      <SpotifyGradient />
      <GlowOrb x={300} y={200} color="#1DB954" size={400} delay={0} />
      <GlowOrb x={400} y={350} color="#1ed760" size={300} delay={10} />
      
      <AnimatedText text="Ready to Grow?" delay={0} size={56} />
      <AnimatedText 
        text="Join artists getting millions of streams" 
        delay={15} 
        size={22} 
        color="rgba(255,255,255,0.7)" 
      />
      
      <div
        style={{
          marginTop: 20,
          padding: '20px 50px',
          background: '#1DB954',
          borderRadius: 40,
          transform: `scale(${buttonScale * pulse})`,
          boxShadow: '0 20px 50px rgba(29, 185, 84, 0.5)',
          cursor: 'pointer',
        }}
      >
        <span style={{ 
          color: '#000', 
          fontSize: 22, 
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: 2,
        }}>
          Start Growing Now 🚀
        </span>
      </div>
      
      <AnimatedText 
        text="Free AI tools included" 
        delay={45} 
        size={16} 
        color="rgba(255,255,255,0.5)" 
      />
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION
// ============================================

export const SpotifyBoostAnimation: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {/* Scene 1: Welcome (0-90 frames = 3 seconds) */}
      <Sequence from={0} durationInFrames={90}>
        <Scene1_Welcome />
      </Sequence>

      {/* Scene 2: Tools Overview (90-180 frames = 3 seconds) */}
      <Sequence from={90} durationInFrames={90}>
        <Scene2_Tools />
      </Sequence>

      {/* Scene 3: Playlist Match Demo (180-300 frames = 4 seconds) */}
      <Sequence from={180} durationInFrames={120}>
        <Scene3_PlaylistMatch />
      </Sequence>

      {/* Scene 4: Growth Metrics (300-420 frames = 4 seconds) */}
      <Sequence from={300} durationInFrames={120}>
        <Scene4_Growth />
      </Sequence>

      {/* Scene 5: Call to Action (420-540 frames = 4 seconds) */}
      <Sequence from={420} durationInFrames={120}>
        <Scene5_CTA />
      </Sequence>
    </AbsoluteFill>
  );
};

export default SpotifyBoostAnimation;
