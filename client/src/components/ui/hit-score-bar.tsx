import React, { useEffect, useState, useMemo } from 'react';
import { Flame, Snowflake, TrendingUp, Sparkles, Zap } from 'lucide-react';

interface HitScoreBarProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

/**
 * HitScoreBar - Barra de progreso que muestra el potencial de hit de una canción
 * Gradiente de frío (azul) a caliente (rojo/naranja/fuego)
 * 0-25: Frío (azul)
 * 26-50: Templado (verde-amarillo)
 * 51-75: Caliente (naranja)
 * 76-100: En llamas (rojo con animación de fuego)
 */
export function HitScoreBar({ 
  score, 
  size = 'sm', 
  showLabel = true, 
  animated = true,
  className = '' 
}: HitScoreBarProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [pulseIntensity, setPulseIntensity] = useState(0);

  // Memoizar el score para evitar recálculos
  const stableScore = useMemo(() => Math.min(100, Math.max(0, score)), [score]);

  // Animación de entrada
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Animación del score
  useEffect(() => {
    if (!animated) {
      setAnimatedScore(stableScore);
      return;
    }

    const duration = 1500;
    const steps = 60;
    const increment = stableScore / steps;
    let current = 0;

    const interval = setInterval(() => {
      current += increment;
      if (current >= stableScore) {
        setAnimatedScore(stableScore);
        clearInterval(interval);
      } else {
        setAnimatedScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [stableScore, animated]);

  // Efecto de pulso para scores altos
  useEffect(() => {
    if (stableScore > 75) {
      const pulseInterval = setInterval(() => {
        setPulseIntensity(prev => (prev + 1) % 3);
      }, 500);
      return () => clearInterval(pulseInterval);
    }
  }, [stableScore]);

  // Obtener el gradiente según el score
  const getGradient = () => {
    if (stableScore <= 25) {
      return 'from-blue-600 via-blue-400 to-cyan-300';
    } else if (stableScore <= 50) {
      return 'from-cyan-400 via-emerald-400 to-yellow-300';
    } else if (stableScore <= 75) {
      return 'from-yellow-400 via-orange-500 to-red-400';
    } else {
      return 'from-orange-500 via-red-500 to-rose-600';
    }
  };

  // Obtener el color de fondo del track
  const getTrackBg = () => {
    if (stableScore <= 25) return 'bg-blue-950/30';
    if (stableScore <= 50) return 'bg-emerald-950/30';
    if (stableScore <= 75) return 'bg-orange-950/30';
    return 'bg-red-950/40';
  };

  // Obtener el icono según el score
  const getIcon = () => {
    if (stableScore <= 25) {
      return <Snowflake className="h-3 w-3 text-blue-400 animate-pulse" style={{ animationDuration: '3s' }} />;
    } else if (stableScore <= 50) {
      return <TrendingUp className="h-3 w-3 text-emerald-400" />;
    } else if (stableScore <= 75) {
      return <Sparkles className="h-3 w-3 text-orange-400 animate-spin" style={{ animationDuration: '4s' }} />;
    } else {
      return <Flame className="h-3 w-3 text-red-500 animate-bounce" style={{ animationDuration: '0.5s' }} />;
    }
  };

  // Obtener el label según el score
  const getLabel = () => {
    if (stableScore <= 15) return '❄️ Cold';
    if (stableScore <= 25) return '🧊 Cool';
    if (stableScore <= 40) return '📈 Rising';
    if (stableScore <= 50) return '✨ Trending';
    if (stableScore <= 65) return '🔥 Hot';
    if (stableScore <= 75) return '⚡ Very Hot';
    if (stableScore <= 90) return '💥 Explosive';
    return '🚀 Viral Hit!';
  };

  // Obtener color del texto del porcentaje
  const getScoreColor = () => {
    if (stableScore <= 25) return 'text-blue-400';
    if (stableScore <= 50) return 'text-emerald-400';
    if (stableScore <= 75) return 'text-orange-400';
    return 'text-red-400';
  };

  // Tamaños
  const heights = {
    sm: 'h-2',
    md: 'h-2.5',
    lg: 'h-3'
  };

  // Partículas de fuego para scores muy altos
  const FireParticles = () => {
    if (stableScore <= 75) return null;
    
    return (
      <div className="absolute -top-3 right-0 flex gap-0.5 pointer-events-none">
        {[...Array(Math.min(3, Math.floor((stableScore - 75) / 8)))].map((_, i) => (
          <span 
            key={i} 
            className="text-[8px] animate-bounce opacity-80"
            style={{ 
              animationDelay: `${i * 0.15}s`,
              animationDuration: '0.6s'
            }}
          >
            {stableScore > 90 ? '🔥' : '✨'}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div 
      className={`w-full relative ${className} transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            {getIcon()}
            <span className="text-[10px] font-medium text-gray-400 tracking-wide">Hit Potential</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-bold ${getScoreColor()} tabular-nums`}>
              {animatedScore}%
            </span>
            <span className="text-[9px] text-gray-500 font-medium">{getLabel()}</span>
          </div>
        </div>
      )}
      
      {/* Contenedor de la barra con efecto glow */}
      <div className={`relative w-full ${heights[size]} ${getTrackBg()} rounded-full overflow-hidden border border-gray-800/50`}>
        {/* Barra de progreso con gradiente */}
        <div
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getGradient()} rounded-full transition-all duration-1000 ease-out`}
          style={{ 
            width: `${animatedScore}%`,
            boxShadow: stableScore > 50 
              ? `0 0 ${8 + pulseIntensity * 4}px ${stableScore > 75 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(249, 115, 22, 0.5)'}` 
              : 'none'
          }}
        >
          {/* Efecto de brillo que se mueve */}
          {animated && (
            <div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              style={{
                animation: 'hitbar-shimmer 2.5s infinite linear'
              }}
            />
          )}
          
          {/* Brillo intenso en el borde derecho */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-l from-white/40 to-transparent rounded-r-full"
          />
        </div>

        {/* Efectos especiales para scores muy altos */}
        {stableScore > 85 && (
          <div 
            className="absolute inset-0 bg-gradient-to-r from-transparent via-red-400/10 to-transparent"
            style={{ 
              animation: 'hitbar-pulse 0.8s ease-in-out infinite alternate' 
            }}
          />
        )}
      </div>

      {/* Partículas flotantes */}
      <FireParticles />

      {/* Estilos CSS para las animaciones */}
      <style>{`
        @keyframes hitbar-shimmer {
          0% {
            transform: translateX(-150%);
          }
          100% {
            transform: translateX(250%);
          }
        }
        @keyframes hitbar-pulse {
          0% {
            opacity: 0.3;
          }
          100% {
            opacity: 0.8;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Calcula el Hit Score basado en las métricas de la canción
 * Factores: plays, likes, shares, tiempo de escucha, engagement rate, etc.
 */
export function calculateHitScore(song: {
  plays?: number;
  likes?: number;
  shares?: number;
  duration?: string;
  createdAt?: string | Date;
  mood?: string;
  genre?: string;
}): number {
  let score = 0;

  // Base score por reproducciones
  const plays = song.plays || Math.floor(Math.random() * 10000);
  if (plays > 0) {
    score += Math.min(30, Math.log10(plays + 1) * 10);
  }

  // Bonus por likes
  const likes = song.likes || Math.floor(Math.random() * 1000);
  if (likes > 0) {
    score += Math.min(20, Math.log10(likes + 1) * 8);
  }

  // Bonus por shares (viral potential)
  const shares = song.shares || Math.floor(Math.random() * 200);
  if (shares > 0) {
    score += Math.min(25, Math.log10(shares + 1) * 12);
  }

  // Bonus por mood "energetic" o "upbeat"
  if (song.mood === 'energetic' || song.mood === 'upbeat') {
    score += 10;
  }

  // Bonus por géneros populares
  const popularGenres = ['pop', 'hip-hop', 'reggaeton', 'electronic'];
  if (song.genre && popularGenres.includes(song.genre.toLowerCase())) {
    score += 8;
  }

  // Bonus por ser canción nueva (última semana)
  if (song.createdAt) {
    const created = new Date(song.createdAt);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (created > weekAgo) {
      score += 15;
    }
  }

  // Normalizar entre 0 y 100
  return Math.min(100, Math.max(0, Math.round(score)));
}

export default HitScoreBar;
