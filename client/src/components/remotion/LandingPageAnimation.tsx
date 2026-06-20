import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Sequence } from 'remotion';

// ============================================
// ANIMATED COMPONENTS
// ============================================

const GlowingOrb = ({ delay = 0, color = "#f97316" }: { delay?: number; color?: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const scale = spring({
    frame: frame - delay,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  
  const opacity = interpolate(frame - delay, [0, 15], [0, 0.8], {
    extrapolateRight: 'clamp',
  });
  
  const pulse = Math.sin((frame - delay) / 10) * 0.1 + 1;
  
  return (
    <div
      style={{
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
        transform: `scale(${scale * pulse})`,
        opacity,
        filter: 'blur(40px)',
        position: 'absolute',
      }}
    />
  );
};

const TypewriterText = ({ text, delay = 0 }: { text: string; delay?: number }) => {
  const frame = useCurrentFrame();
  const charsToShow = Math.floor((frame - delay) / 2);
  const displayText = text.slice(0, Math.max(0, charsToShow));
  
  return (
    <span style={{ fontFamily: 'monospace' }}>
      {displayText}
      {charsToShow < text.length && charsToShow > 0 && (
        <span style={{ opacity: Math.sin(frame / 3) > 0 ? 1 : 0 }}>|</span>
      )}
    </span>
  );
};

const FloatingCard = ({ 
  children, 
  delay = 0,
  x = 0,
  y = 0,
  rotation = 0
}: { 
  children: React.ReactNode; 
  delay?: number;
  x?: number;
  y?: number;
  rotation?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const translateY = spring({
    frame: frame - delay,
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  
  const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  const floatY = Math.sin((frame - delay) / 20) * 5;
  
  return (
    <div
      style={{
        transform: `translateY(${(1 - translateY) * 100 + floatY}px) translateX(${x}px) rotate(${rotation}deg)`,
        opacity,
        position: 'absolute',
        top: y,
      }}
    >
      {children}
    </div>
  );
};

// ============================================
// SCENE COMPONENTS
// ============================================

const Scene1_Welcome = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const titleScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  
  const subtitleOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateRight: 'clamp',
  });
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background orbs */}
      <div style={{ position: 'absolute', top: '20%', left: '10%' }}>
        <GlowingOrb delay={0} color="#f97316" />
      </div>
      <div style={{ position: 'absolute', bottom: '20%', right: '15%' }}>
        <GlowingOrb delay={10} color="#ea580c" />
      </div>
      
      {/* Main title */}
      <div
        style={{
          transform: `scale(${titleScale})`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 80,
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #dc2626 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-2px',
          }}
        >
          Boostify Music
        </div>
      </div>
      
      {/* Subtitle with typewriter effect */}
      <div
        style={{
          marginTop: 20,
          fontSize: 24,
          color: '#9ca3af',
          opacity: subtitleOpacity,
        }}
      >
        <TypewriterText text="Create your artist page in 60 seconds" delay={30} />
      </div>
    </AbsoluteFill>
  );
};

const Scene2_ProfileCreation = () => {
  const frame = useCurrentFrame();
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background */}
      <div style={{ position: 'absolute', top: '30%', left: '20%' }}>
        <GlowingOrb delay={0} color="#f97316" />
      </div>
      
      {/* Mock profile card */}
      <FloatingCard delay={0} y={50}>
        <div
          style={{
            width: 400,
            backgroundColor: '#1f1f23',
            borderRadius: 20,
            padding: 30,
            border: '1px solid #374151',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
            }}
          >
            🎤
          </div>
          
          {/* Name input simulation */}
          <div
            style={{
              backgroundColor: '#111',
              borderRadius: 12,
              padding: '15px 20px',
              marginBottom: 15,
              border: '2px solid #f97316',
            }}
          >
            <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 5 }}>
              Artist Name
            </div>
            <div style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
              <TypewriterText text="DJ Nova" delay={20} />
            </div>
          </div>
          
          {/* Genre input */}
          <div
            style={{
              backgroundColor: '#111',
              borderRadius: 12,
              padding: '15px 20px',
              marginBottom: 15,
              border: '1px solid #374151',
              opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 5 }}>
              Genre
            </div>
            <div style={{ color: '#fff', fontSize: 18 }}>
              <TypewriterText text="Electronic / House" delay={60} />
            </div>
          </div>
          
          {/* Social links */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'center',
              marginTop: 20,
              opacity: interpolate(frame, [80, 100], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            {['🎵', '📸', '🎬', '🎧'].map((icon, i) => (
              <div
                key={i}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 12,
                  backgroundColor: '#f97316',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                }}
              >
                {icon}
              </div>
            ))}
          </div>
        </div>
      </FloatingCard>
      
      {/* Step indicator */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#f97316',
          fontSize: 16,
          fontWeight: 'bold',
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        STEP 1: Create Your Profile
      </div>
    </AbsoluteFill>
  );
};

const Scene3_LandingPagePreview = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const browserScale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background glow */}
      <div style={{ position: 'absolute', top: '40%', left: '30%' }}>
        <GlowingOrb delay={0} color="#f97316" />
      </div>
      
      {/* Browser mockup */}
      <div
        style={{
          transform: `scale(${browserScale})`,
          width: 700,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(249, 115, 22, 0.3)',
        }}
      >
        {/* Browser header */}
        <div
          style={{
            backgroundColor: '#1f1f23',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ef4444' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#eab308' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#22c55e' }} />
          </div>
          <div
            style={{
              flex: 1,
              marginLeft: 16,
              backgroundColor: '#111',
              borderRadius: 8,
              padding: '8px 16px',
              color: '#6b7280',
              fontSize: 13,
            }}
          >
            boostifymusic.com/artist/dj-nova
          </div>
        </div>
        
        {/* Page content */}
        <div
          style={{
            backgroundColor: '#111',
            padding: 30,
            minHeight: 400,
          }}
        >
          {/* Hero section */}
          <div
            style={{
              background: 'linear-gradient(180deg, #f9731640 0%, transparent 100%)',
              borderRadius: 16,
              padding: 30,
              textAlign: 'center',
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
                margin: '0 auto 15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 35,
              }}
            >
              🎤
            </div>
            <div style={{ color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 5 }}>
              DJ Nova
            </div>
            <div style={{ color: '#f97316', fontSize: 14 }}>
              Electronic / House • Berlin
            </div>
          </div>
          
          {/* Music links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { name: 'Spotify', color: '#22c55e', icon: '🎵' },
              { name: 'Apple Music', color: '#ec4899', icon: '🎧' },
              { name: 'YouTube', color: '#ef4444', icon: '🎬' },
            ].map((link, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: link.color + '20',
                  border: `1px solid ${link.color}40`,
                  borderRadius: 12,
                  padding: '12px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  opacity: interpolate(frame, [20 + i * 15, 40 + i * 15], [0, 1], { extrapolateRight: 'clamp' }),
                  transform: `translateX(${interpolate(frame, [20 + i * 15, 40 + i * 15], [-30, 0], { extrapolateRight: 'clamp' })}px)`,
                }}
              >
                <span style={{ fontSize: 20 }}>{link.icon}</span>
                <span style={{ color: '#fff', fontWeight: '500' }}>{link.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Step indicator */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#f97316',
          fontSize: 16,
          fontWeight: 'bold',
        }}
      >
        STEP 2: Your Landing Page is Ready!
      </div>
    </AbsoluteFill>
  );
};

const Scene4_Features = () => {
  const frame = useCurrentFrame();
  
  const features = [
    { icon: '📊', title: 'Analytics', desc: 'Track your visitors' },
    { icon: '🔗', title: 'Smart Links', desc: 'All platforms in one' },
    { icon: '🎨', title: 'Custom Design', desc: 'Match your brand' },
    { icon: '📱', title: 'Mobile Ready', desc: 'Looks great everywhere' },
  ];
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Background */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        <GlowingOrb delay={0} color="#f97316" />
      </div>
      
      {/* Title */}
      <div
        style={{
          fontSize: 40,
          fontWeight: 'bold',
          color: '#fff',
          marginBottom: 50,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        Powerful <span style={{ color: '#f97316' }}>Features</span>
      </div>
      
      {/* Features grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 20,
        }}
      >
        {features.map((feature, i) => (
          <FloatingCard key={i} delay={20 + i * 15}>
            <div
              style={{
                width: 200,
                backgroundColor: '#1f1f23',
                borderRadius: 16,
                padding: 25,
                border: '1px solid #374151',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 10 }}>{feature.icon}</div>
              <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: 5 }}>{feature.title}</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>{feature.desc}</div>
            </div>
          </FloatingCard>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const Scene5_CTA = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const buttonScale = spring({
    frame: frame - 30,
    fps,
    config: { damping: 10, stiffness: 200 },
  });
  
  const pulse = Math.sin(frame / 8) * 0.05 + 1;
  
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Multiple background orbs */}
      <div style={{ position: 'absolute', top: '20%', left: '20%' }}>
        <GlowingOrb delay={0} color="#f97316" />
      </div>
      <div style={{ position: 'absolute', bottom: '20%', right: '20%' }}>
        <GlowingOrb delay={10} color="#dc2626" />
      </div>
      <div style={{ position: 'absolute', top: '60%', left: '60%' }}>
        <GlowingOrb delay={20} color="#ea580c" />
      </div>
      
      {/* Main text */}
      <div
        style={{
          fontSize: 50,
          fontWeight: 'bold',
          color: '#fff',
          textAlign: 'center',
          marginBottom: 20,
          opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        Ready to <span style={{ color: '#f97316' }}>Stand Out</span>?
      </div>
      
      <div
        style={{
          fontSize: 20,
          color: '#9ca3af',
          marginBottom: 40,
          opacity: interpolate(frame, [15, 35], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        Join 10,000+ artists on Boostify
      </div>
      
      {/* CTA Button */}
      <div
        style={{
          transform: `scale(${buttonScale * pulse})`,
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #dc2626 100%)',
          borderRadius: 16,
          padding: '20px 50px',
          fontSize: 22,
          fontWeight: 'bold',
          color: '#fff',
          boxShadow: '0 20px 40px -10px rgba(249, 115, 22, 0.5)',
          cursor: 'pointer',
        }}
      >
        🚀 Create My Free Page
      </div>
      
      <div
        style={{
          marginTop: 20,
          fontSize: 14,
          color: '#6b7280',
          opacity: interpolate(frame, [50, 70], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        No credit card required • Free forever
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// MAIN COMPOSITION
// ============================================

export const LandingPageAnimation = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <Sequence from={0} durationInFrames={90}>
        <Scene1_Welcome />
      </Sequence>
      
      <Sequence from={90} durationInFrames={120}>
        <Scene2_ProfileCreation />
      </Sequence>
      
      <Sequence from={210} durationInFrames={120}>
        <Scene3_LandingPagePreview />
      </Sequence>
      
      <Sequence from={330} durationInFrames={100}>
        <Scene4_Features />
      </Sequence>
      
      <Sequence from={430} durationInFrames={120}>
        <Scene5_CTA />
      </Sequence>
    </AbsoluteFill>
  );
};

export default LandingPageAnimation;
