import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from 'remotion';

// ============================================
// ANIMATED COMPONENTS FOR INSTAGRAM BOOST
// ============================================

const InstagramGradient = () => {
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
        background: `conic-gradient(from ${rotation}deg, #833ab4, #fd1d1d, #fcb045, #833ab4)`,
        opacity: 0.15,
        filter: 'blur(100px)',
      }}
    />
  );
};

const GlowOrb = ({ delay = 0, x = 0, y = 0, color = "#E1306C", size = 200 }: { 
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

const FloatingIcon = ({ 
  children, 
  delay = 0, 
  x = 0, 
  y = 0,
  floatRange = 10
}: { 
  children: React.ReactNode; 
  delay?: number;
  x?: number;
  y?: number;
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
  
  // If x and y are provided, use absolute positioning; otherwise use relative
  const useAbsolute = x !== 0 || y !== 0;
  
  return (
    <div
      style={{
        position: useAbsolute ? 'absolute' : 'relative',
        left: useAbsolute ? x : undefined,
        top: useAbsolute ? y : undefined,
        transform: `scale(${scale}) translateY(${floatY}px)`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};

const ProgressBar = ({ delay = 0, progress = 100, color = "#E1306C" }: { 
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
          background: `linear-gradient(90deg, ${color}, #FCAF45)`,
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

// ============================================
// SCENE COMPONENTS
// ============================================

const Scene1_Welcome = () => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <InstagramGradient />
      <GlowOrb x={100} y={100} color="#833ab4" size={300} delay={0} />
      <GlowOrb x={500} y={350} color="#fd1d1d" size={250} delay={10} />
      <GlowOrb x={200} y={400} color="#fcb045" size={200} delay={20} />
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        gap: 20,
        zIndex: 10 
      }}>
        {/* Instagram Icon */}
        <FloatingIcon delay={5}>
          <div style={{
            width: 80,
            height: 80,
            background: 'linear-gradient(45deg, #833ab4, #fd1d1d, #fcb045)',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 40px rgba(131, 58, 180, 0.4)',
          }}>
            <svg width="50" height="50" viewBox="0 0 24 24" fill="white">
              <path d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153.509.5.902 1.105 1.153 1.772.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 01-1.153 1.772c-.5.508-1.105.902-1.772 1.153-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 01-1.772-1.153 4.904 4.904 0 01-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.217-1.79.465-2.428a4.88 4.88 0 011.153-1.772A4.897 4.897 0 015.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 5a5 5 0 100 10 5 5 0 000-10zm6.5-.25a1.25 1.25 0 10-2.5 0 1.25 1.25 0 002.5 0zM12 9a3 3 0 110 6 3 3 0 010-6z"/>
            </svg>
          </div>
        </FloatingIcon>
        
        <AnimatedText text="Instagram Boost" delay={15} size={56} />
        <AnimatedText text="Grow Your Audience 10x Faster" delay={30} size={24} color="rgba(255,255,255,0.7)" />
      </div>
    </AbsoluteFill>
  );
};

const Scene2_AITools = () => {
  const frame = useCurrentFrame();
  
  const tools = [
    { name: 'Caption AI', icon: '✍️', color: '#E1306C', delay: 0 },
    { name: 'Hashtag Pro', icon: '#️⃣', color: '#833ab4', delay: 10 },
    { name: 'Content Ideas', icon: '💡', color: '#fd1d1d', delay: 20 },
    { name: 'Best Timing', icon: '⏰', color: '#fcb045', delay: 30 },
    { name: 'Bio Optimizer', icon: '👤', color: '#5851DB', delay: 40 },
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
      <InstagramGradient />
      
      <AnimatedText text="AI-Powered Tools" delay={0} size={48} />
      
      <div style={{ 
        display: 'flex', 
        gap: 20, 
        flexWrap: 'wrap',
        justifyContent: 'center',
        maxWidth: 700,
      }}>
        {tools.map((tool, index) => (
          <FloatingIcon key={tool.name} delay={tool.delay + 15} floatRange={5}>
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
          </FloatingIcon>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Scene3_ContentGeneration = () => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 60,
        padding: 60,
      }}
    >
      <InstagramGradient />
      <GlowOrb x={600} y={200} color="#E1306C" size={300} delay={0} />
      
      {/* Input Side */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: 20,
        flex: 1,
      }}>
        <AnimatedText text="1. Enter Your Topic" delay={0} size={28} />
        
        <FloatingIcon delay={15}>
          <div style={{
            width: 300,
            padding: 20,
            background: 'rgba(255,255,255,0.1)',
            borderRadius: 12,
            border: '2px solid rgba(255,255,255,0.2)',
          }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 8 }}>
              Post Topic
            </div>
            <div style={{ color: '#fff', fontSize: 18 }}>
              New Music Release 🎵
            </div>
          </div>
        </FloatingIcon>
        
        <FloatingIcon delay={30}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 24px',
            background: 'linear-gradient(90deg, #E1306C, #833ab4)',
            borderRadius: 30,
            boxShadow: '0 10px 30px rgba(225, 48, 108, 0.4)',
          }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
              Generate AI Caption
            </span>
            <span style={{ fontSize: 20 }}>✨</span>
          </div>
        </FloatingIcon>
      </div>
      
      {/* Arrow */}
      <FloatingIcon delay={45} floatRange={0}>
        <div style={{ 
          fontSize: 48, 
          color: '#E1306C',
          textShadow: '0 0 30px #E1306C' 
        }}>
          →
        </div>
      </FloatingIcon>
      
      {/* Output Side */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: 20,
        flex: 1,
      }}>
        <AnimatedText text="2. AI Creates Content" delay={50} size={28} />
        
        <FloatingIcon delay={60}>
          <div style={{
            width: 320,
            padding: 24,
            background: 'linear-gradient(135deg, rgba(131, 58, 180, 0.2), rgba(225, 48, 108, 0.2))',
            borderRadius: 16,
            border: '2px solid rgba(225, 48, 108, 0.4)',
          }}>
            <div style={{ color: '#fff', fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
              🎶 New music dropping NOW! This track has been months in the making and I can't wait for you to hear it. Link in bio 🔗
            </div>
            <div style={{ 
              display: 'flex', 
              gap: 8, 
              flexWrap: 'wrap' 
            }}>
              {['#NewMusic', '#Artist', '#Spotify'].map(tag => (
                <span key={tag} style={{
                  padding: '4px 12px',
                  background: 'rgba(225, 48, 108, 0.3)',
                  borderRadius: 20,
                  color: '#fff',
                  fontSize: 12,
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </FloatingIcon>
      </div>
    </AbsoluteFill>
  );
};

const Scene4_Analytics = () => {
  const frame = useCurrentFrame();
  
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
      <InstagramGradient />
      
      <AnimatedText text="Track Your Growth" delay={0} size={48} />
      
      <div style={{ display: 'flex', gap: 40, marginTop: 20 }}>
        {/* Followers Card */}
        <FloatingIcon delay={15} floatRange={8}>
          <div style={{
            padding: 30,
            background: 'linear-gradient(135deg, #833ab420, #833ab440)',
            border: '2px solid #833ab460',
            borderRadius: 20,
            textAlign: 'center',
            minWidth: 180,
          }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              Followers
            </div>
            <div style={{ color: '#fff' }}>
              <CounterAnimation delay={20} from={0} to={12500} suffix="+" duration={50} />
            </div>
            <div style={{ 
              marginTop: 12, 
              color: '#22c55e', 
              fontSize: 14, 
              fontWeight: 600 
            }}>
              ↑ 45% this month
            </div>
          </div>
        </FloatingIcon>
        
        {/* Engagement Card */}
        <FloatingIcon delay={25} floatRange={8}>
          <div style={{
            padding: 30,
            background: 'linear-gradient(135deg, #E1306C20, #E1306C40)',
            border: '2px solid #E1306C60',
            borderRadius: 20,
            textAlign: 'center',
            minWidth: 180,
          }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              Engagement
            </div>
            <div style={{ color: '#fff' }}>
              <CounterAnimation delay={30} from={0} to={89} suffix="%" duration={50} />
            </div>
            <div style={{ 
              marginTop: 12, 
              color: '#22c55e', 
              fontSize: 14, 
              fontWeight: 600 
            }}>
              ↑ Above average
            </div>
          </div>
        </FloatingIcon>
        
        {/* Reach Card */}
        <FloatingIcon delay={35} floatRange={8}>
          <div style={{
            padding: 30,
            background: 'linear-gradient(135deg, #fcb04520, #fcb04540)',
            border: '2px solid #fcb04560',
            borderRadius: 20,
            textAlign: 'center',
            minWidth: 180,
          }}>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
              Reach
            </div>
            <div style={{ color: '#fff' }}>
              <CounterAnimation delay={40} from={0} to={250} suffix="K" duration={50} />
            </div>
            <div style={{ 
              marginTop: 12, 
              color: '#22c55e', 
              fontSize: 14, 
              fontWeight: 600 
            }}>
              ↑ 120% boost
            </div>
          </div>
        </FloatingIcon>
      </div>
      
      {/* Progress Bar */}
      <FloatingIcon delay={50}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginBottom: 10 }}>
            Monthly Goal Progress
          </div>
          <ProgressBar delay={55} progress={85} />
        </div>
      </FloatingIcon>
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
      <InstagramGradient />
      <GlowOrb x={300} y={200} color="#E1306C" size={400} delay={0} />
      <GlowOrb x={400} y={350} color="#833ab4" size={300} delay={10} />
      
      <AnimatedText text="Ready to Grow?" delay={0} size={56} />
      <AnimatedText 
        text="Join 10,000+ artists boosting their Instagram" 
        delay={15} 
        size={22} 
        color="rgba(255,255,255,0.7)" 
      />
      
      <div
        style={{
          marginTop: 20,
          padding: '20px 50px',
          background: 'linear-gradient(90deg, #833ab4, #E1306C, #fcb045)',
          borderRadius: 40,
          transform: `scale(${buttonScale * pulse})`,
          boxShadow: '0 20px 50px rgba(225, 48, 108, 0.5)',
          cursor: 'pointer',
        }}
      >
        <span style={{ 
          color: '#fff', 
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

export const InstagramBoostAnimation: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {/* Scene 1: Welcome (0-90 frames = 3 seconds) */}
      <Sequence from={0} durationInFrames={90}>
        <Scene1_Welcome />
      </Sequence>

      {/* Scene 2: AI Tools Overview (90-180 frames = 3 seconds) */}
      <Sequence from={90} durationInFrames={90}>
        <Scene2_AITools />
      </Sequence>

      {/* Scene 3: Content Generation Demo (180-300 frames = 4 seconds) */}
      <Sequence from={180} durationInFrames={120}>
        <Scene3_ContentGeneration />
      </Sequence>

      {/* Scene 4: Analytics/Growth (300-420 frames = 4 seconds) */}
      <Sequence from={300} durationInFrames={120}>
        <Scene4_Analytics />
      </Sequence>

      {/* Scene 5: Call to Action (420-540 frames = 4 seconds) */}
      <Sequence from={420} durationInFrames={120}>
        <Scene5_CTA />
      </Sequence>
    </AbsoluteFill>
  );
};

export default InstagramBoostAnimation;
