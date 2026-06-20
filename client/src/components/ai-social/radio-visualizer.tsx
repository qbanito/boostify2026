import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Waves, Eye, EyeOff } from 'lucide-react';

type VisualizerMode = 'bars' | 'wave' | 'circular' | 'particles';

const COLORS = {
  bars: ['#a855f7', '#ec4899', '#8b5cf6', '#f43f5e'],
  wave: ['#06b6d4', '#8b5cf6', '#3b82f6'],
  circular: ['#f97316', '#ef4444', '#f59e0b', '#ec4899'],
  particles: ['#10b981', '#06b6d4', '#8b5cf6', '#6366f1'],
};

interface RadioVisualizerProps {
  /** Pass the audio element ref from the radio widget */
  audioRef?: React.RefObject<HTMLAudioElement>;
  /** Compact mode for embedding */
  compact?: boolean;
}

export function RadioVisualizer({ audioRef, compact = false }: RadioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const [mode, setMode] = useState<VisualizerMode>('bars');
  const [isActive, setIsActive] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const particlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; size: number; color: string; life: number }>>([]);

  // Connect to audio element
  const connectAudio = useCallback(() => {
    const audio = audioRef?.current;
    if (!audio) return false;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;

      if (!sourceRef.current) {
        sourceRef.current = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        sourceRef.current.connect(analyser);
        analyser.connect(ctx.destination);
        analyserRef.current = analyser;
      }

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      setIsActive(true);
      return true;
    } catch {
      return false;
    }
  }, [audioRef]);

  // Simulated data when no audio connected
  const getSimulatedData = useCallback((bufferLength: number): Uint8Array => {
    const data = new Uint8Array(bufferLength);
    const time = Date.now() / 1000;
    for (let i = 0; i < bufferLength; i++) {
      const base = Math.sin(time * 2 + i * 0.3) * 40 + 60;
      const noise = Math.sin(time * 5 + i * 0.8) * 20;
      const pulse = Math.sin(time * 1.5) * 15;
      data[i] = Math.max(0, Math.min(255, base + noise + pulse));
    }
    return data;
  }, []);

  // Draw bars visualization
  const drawBars = (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
    const bars = data.length;
    const barWidth = w / bars;
    const colors = COLORS.bars;

    for (let i = 0; i < bars; i++) {
      const value = data[i] / 255;
      const barH = value * h * 0.9;
      const colorIdx = Math.floor((i / bars) * colors.length);
      const color = colors[colorIdx % colors.length];

      // Gradient bar
      const grad = ctx.createLinearGradient(0, h, 0, h - barH);
      grad.addColorStop(0, color + '99');
      grad.addColorStop(1, color);
      ctx.fillStyle = grad;

      const x = i * barWidth;
      const radius = Math.min(barWidth / 2 - 1, 3);
      ctx.beginPath();
      ctx.moveTo(x + 1, h);
      ctx.lineTo(x + 1, h - barH + radius);
      ctx.quadraticCurveTo(x + 1, h - barH, x + 1 + radius, h - barH);
      ctx.lineTo(x + barWidth - 1 - radius, h - barH);
      ctx.quadraticCurveTo(x + barWidth - 1, h - barH, x + barWidth - 1, h - barH + radius);
      ctx.lineTo(x + barWidth - 1, h);
      ctx.fill();

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = value * 15;
      ctx.fillRect(x + 1, h - barH, barWidth - 2, 2);
      ctx.shadowBlur = 0;
    }
  };

  // Draw wave visualization
  const drawWave = (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
    const colors = COLORS.wave;
    
    colors.forEach((color, layerIdx) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

      const offset = layerIdx * 0.3;
      for (let i = 0; i < data.length; i++) {
        const x = (i / data.length) * w;
        const value = data[i] / 255;
        const y = h / 2 + (value - 0.5) * h * 0.8 * (1 - offset * 0.3);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
  };

  // Draw circular visualization
  const drawCircular = (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2;
    const baseRadius = Math.min(w, h) * 0.25;
    const colors = COLORS.circular;
    const bars = data.length;

    // Inner glow ring
    const avgLevel = data.reduce((a, b) => a + b, 0) / bars / 255;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(168, 85, 247, ${avgLevel * 0.3})`;
    ctx.fill();

    for (let i = 0; i < bars; i++) {
      const value = data[i] / 255;
      const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
      const barLen = value * baseRadius * 0.8 + 4;
      const colorIdx = Math.floor((i / bars) * colors.length);

      const x1 = cx + Math.cos(angle) * baseRadius;
      const y1 = cy + Math.sin(angle) * baseRadius;
      const x2 = cx + Math.cos(angle) * (baseRadius + barLen);
      const y2 = cy + Math.sin(angle) * (baseRadius + barLen);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = colors[colorIdx % colors.length];
      ctx.lineWidth = Math.max(1, (w / bars) * 0.6);
      ctx.lineCap = 'round';
      ctx.shadowColor = colors[colorIdx % colors.length];
      ctx.shadowBlur = value * 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  };

  // Draw particles visualization
  const drawParticles = (ctx: CanvasRenderingContext2D, data: Uint8Array, w: number, h: number) => {
    const avgLevel = data.reduce((a, b) => a + b, 0) / data.length / 255;
    const colors = COLORS.particles;
    const particles = particlesRef.current;

    // Spawn new particles based on volume
    const spawnCount = Math.floor(avgLevel * 5);
    for (let i = 0; i < spawnCount; i++) {
      particles.push({
        x: Math.random() * w,
        y: h + 5,
        vx: (Math.random() - 0.5) * 2,
        vy: -(Math.random() * 3 + 1) * (avgLevel + 0.3),
        size: Math.random() * 4 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1,
      });
    }

    // Update + draw
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.015;
      p.vy *= 0.99;

      if (p.life <= 0 || p.y < -10) {
        particles.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color + Math.floor(p.life * 255).toString(16).padStart(2, '0');
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.size * 2;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Limit particles
    if (particles.length > 300) particles.splice(0, particles.length - 300);

    // Also draw a mini waveform at bottom
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < data.length; i++) {
      const x = (i / data.length) * w;
      const y = h - (data[i] / 255) * 20;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };

  // Main render loop
  useEffect(() => {
    if (!isVisible) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current?.frequencyBinCount || 128;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);

      const w = canvas.width;
      const h = canvas.height;

      // Clear with fade effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(0, 0, w, h);

      // Get frequency data
      let data: Uint8Array;
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        data = dataArray;
      } else {
        data = getSimulatedData(bufferLength);
      }

      // Draw based on mode
      switch (mode) {
        case 'bars':
          drawBars(ctx, data, w, h);
          break;
        case 'wave':
          drawWave(ctx, data, w, h);
          break;
        case 'circular':
          drawCircular(ctx, data, w, h);
          break;
        case 'particles':
          drawParticles(ctx, data, w, h);
          break;
      }
    };

    // Canvas resize
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = (compact ? 80 : 160) * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        canvas.style.width = rect.width + 'px';
        canvas.style.height = (compact ? 80 : 160) + 'px';
      }
    };
    resize();
    window.addEventListener('resize', resize);

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [mode, isVisible, compact, getSimulatedData]);

  // Try connecting when audio element changes
  useEffect(() => {
    if (audioRef?.current && !isActive) {
      const tryConnect = () => connectAudio();
      audioRef.current.addEventListener('play', tryConnect);
      return () => audioRef?.current?.removeEventListener('play', tryConnect);
    }
  }, [audioRef, isActive, connectAudio]);

  if (!isVisible && compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-purple-400"
        onClick={() => setIsVisible(true)}
      >
        <Eye className="w-3 h-3" />
      </Button>
    );
  }

  const modeButtons: { mode: VisualizerMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'bars', icon: <Activity className="w-3 h-3" />, label: 'Bars' },
    { mode: 'wave', icon: <Waves className="w-3 h-3" />, label: 'Wave' },
    { mode: 'circular', icon: <span className="text-[10px]">◉</span>, label: 'Circle' },
    { mode: 'particles', icon: <span className="text-[10px]">✦</span>, label: 'Particles' },
  ];

  if (compact) {
    return (
      <div className="relative w-full">
        <canvas ref={canvasRef} className="w-full rounded-lg" />
        <div className="absolute top-1 right-1 flex gap-1">
          {modeButtons.map((m) => (
            <button
              key={m.mode}
              onClick={() => setMode(m.mode)}
              className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                mode === m.mode
                  ? 'bg-purple-500/60 text-white'
                  : 'bg-black/40 text-gray-400 hover:text-white'
              }`}
            >
              {m.icon}
            </button>
          ))}
          <button
            onClick={() => setIsVisible(false)}
            className="w-5 h-5 rounded flex items-center justify-center bg-black/40 text-gray-400 hover:text-white"
          >
            <EyeOff className="w-3 h-3" />
          </button>
        </div>
        {!isActive && audioRef?.current && (
          <button
            onClick={connectAudio}
            className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg hover:bg-black/20 transition"
          >
            <span className="text-xs text-purple-300">🎵 Tap to connect audio</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <Card className="bg-black/40 border-purple-500/20 backdrop-blur-sm overflow-hidden">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-medium text-gray-300">Audio Visualizer</span>
            {isActive && (
              <span className="text-[10px] text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Connected
              </span>
            )}
          </div>
          <div className="flex gap-1">
            {modeButtons.map((m) => (
              <Button
                key={m.mode}
                variant="ghost"
                size="sm"
                className={`h-6 px-2 text-[10px] ${
                  mode === m.mode ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400'
                }`}
                onClick={() => setMode(m.mode)}
              >
                {m.icon}
                <span className="ml-1 hidden sm:inline">{m.label}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="relative rounded-lg overflow-hidden bg-black/60">
          <canvas ref={canvasRef} className="w-full" />
          {!isActive && audioRef?.current && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={connectAudio}
              className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 hover:bg-black/30 transition"
            >
              <Waves className="w-6 h-6 text-purple-400 mb-1" />
              <span className="text-xs text-purple-300">Click to connect audio</span>
            </motion.button>
          )}
          {!audioRef?.current && (
            <div className="absolute bottom-1 left-2 text-[10px] text-gray-500">
              Simulated • Play radio to connect
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
