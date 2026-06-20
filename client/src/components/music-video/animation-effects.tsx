/**
import { logger } from "../../lib/logger";
 * Componentes de Efectos de Animación para Music-Video-AI
 * 
 * Este archivo contiene componentes reutilizables para crear efectos visuales
 * animados que mejoran la experiencia del flujo de trabajo de creación de videos musicales.
 * 
 * Incluye:
 * - Animaciones de partículas dinámicas
 * - Efectos de transición entre pasos
 * - Mensajes elegantes con animaciones
 * - Efectos de brillo y gradientes animados
 */
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Sparkles, Music, Video, FileText, Mic, Palette, Wand2, Layers } from 'lucide-react';

// Colores principales de la paleta (sincronizados con la aplicación)
const COLORS = {
  orange: "from-orange-500 to-orange-600",
  purple: "from-purple-500 to-purple-600",
  blue: "from-blue-500 to-blue-600",
  teal: "from-teal-500 to-teal-600",
  pink: "from-pink-500 to-pink-600",
  amber: "from-amber-500 to-amber-600",
};

// Mensajes descriptivos según la etapa del proceso
export const STEP_MESSAGES = {
  'transcription': [
    "Analizando patrones de audio...",
    "Reconociendo letras y versos...",
    "Procesando estructura musical..."
  ],
  'script': [
    "Analizando tono y temática...",
    "Diseñando narrativa visual...",
    "Creando secuencia cinematográfica..."
  ],
  'sync': [
    "Identificando beats y ritmos...",
    "Marcando puntos de sincronización...",
    "Ajustando tiempos visuales..."
  ],
  'scenes': [
    "Diseñando planos y composiciones...",
    "Creando escenas para cada verso...",
    "Estructurando secuencia narrativa..."
  ],
  'customization': [
    "Aplicando estilo visual personalizado...",
    "Refinando paleta de colores...",
    "Ajustando ambiente cinematográfico..."
  ],
  'movement': [
    "Incorporando coreografías...",
    "Añadiendo transiciones dinámicas...",
    "Diseñando movimientos de cámara..."
  ],
  'lipsync': [
    "Analizando fonemas vocales...",
    "Sincronizando movimientos labiales...",
    "Perfeccionando expresiones faciales..."
  ],
  'generation': [
    "Renderizando escenas individuales...",
    "Generando secuencias visuales...",
    "Procesando efectos especiales..."
  ],
  'rendering': [
    "Compilando escenas finales...",
    "Aplicando efectos de post-producción...",
    "Optimizando calidad de video..."
  ]
};

// Componente para el mensaje animado que aparece durante el proceso
export const AnimatedMessage = ({ 
  message, 
  delay = 0,
  icon 
}: { 
  message: string;
  delay?: number;
  icon?: React.ReactNode;
}) => {
  return (
    <motion.div
      className="flex items-center gap-3 text-sm font-medium text-white px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/90 to-purple-500/90 shadow-lg backdrop-blur-sm"
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ 
        duration: 0.5, 
        delay: delay,
        type: "spring",
        stiffness: 100
      }}
    >
      {icon && <div className="text-white">{icon}</div>}
      <span>{message}</span>
    </motion.div>
  );
};

// Gradiente animado para el fondo
export const AnimatedGradient = ({ 
  className,
  colors = ["orange", "purple", "blue"],
  duration = 8,
  currentStep = 1,
  speed = 5
}: {
  className?: string;
  colors?: (keyof typeof COLORS)[] | string[];
  duration?: number;
  currentStep?: number;
  speed?: number;
}) => {
  // Determina los colores según la etapa actual
  let gradientColors = [...colors];
  
  // Ajusta los colores según la etapa
  if (currentStep >= 7) {
    gradientColors = ["blue", "purple", "teal"];
  } else if (currentStep >= 4) {
    gradientColors = ["purple", "pink", "blue"];
  } else {
    gradientColors = ["orange", "amber", "purple"];
  }
  
  return (
    <motion.div 
      className={cn(
        "absolute inset-0 -z-10 rounded-xl opacity-20",
        className
      )}
      animate={{
        background: [
          `linear-gradient(45deg, var(--${gradientColors[0]}) 0%, var(--${gradientColors[1]}) 50%, var(--${gradientColors[2]}) 100%)`,
          `linear-gradient(45deg, var(--${gradientColors[2]}) 0%, var(--${gradientColors[0]}) 50%, var(--${gradientColors[1]}) 100%)`,
          `linear-gradient(45deg, var(--${gradientColors[1]}) 0%, var(--${gradientColors[2]}) 50%, var(--${gradientColors[0]}) 100%)`
        ]
      }}
      transition={{
        duration: duration,
        repeat: Infinity,
        ease: "linear"
      }}
      style={{
        "--orange": "rgb(249 115 22)",
        "--purple": "rgb(168 85 247)",
        "--blue": "rgb(59 130 246)",
        "--teal": "rgb(20 184 166)",
        "--pink": "rgb(236 72 153)",
        "--amber": "rgb(245 158 11)"
      } as React.CSSProperties}
    />
  );
};

// Sistema de partículas reactivas al proceso
export const ParticleSystem = ({ 
  count = 8, 
  currentStep = 1,
  active = true
}: { 
  count?: number;
  currentStep?: number;
  active?: boolean;
}) => {
  // Determine colors based on current step
  let particleColors: (keyof typeof COLORS)[] = ["orange", "purple", "blue"];
  if (currentStep >= 7) {
    particleColors = ["blue", "teal", "purple"];
  } else if (currentStep >= 4) {
    particleColors = ["purple", "pink", "blue"];
  } else {
    particleColors = ["orange", "amber", "purple"];
  }
  
  if (!active) return null;
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: count }).map((_, i) => (
        <Particle 
          key={i}
          delay={i * 0.2} 
          color={particleColors[i % particleColors.length]}
          size={(i % 3) + 1}
          speed={1 + (i % 3) * 0.3}
          currentStep={currentStep}
        />
      ))}
    </div>
  );
};

// Partícula individual
const Particle = ({ 
  delay = 0, 
  color = "orange", 
  size = 1, 
  speed = 1,
  currentStep = 1
}: { 
  delay?: number;
  color?: keyof typeof COLORS;
  size?: number;
  speed?: number;
  currentStep?: number;
}) => {
  // Las partículas se vuelven más dinámicas a medida que el proceso avanza
  const dynamicFactor = Math.min(1 + (currentStep / 10), 2);
  
  return (
    <motion.div
      className={cn(
        "absolute rounded-full bg-gradient-to-br",
        COLORS[color],
        size === 1 ? "w-1 h-1" : 
        size === 2 ? "w-1.5 h-1.5" : 
        "w-2 h-2"
      )}
      initial={{ 
        opacity: 0, 
        scale: 0,
        x: "50%",
        y: "50%"
      }}
      animate={{ 
        opacity: [0, 0.8, 0],
        scale: [0, 1.2, 0],
        x: [
          "50%", 
          `${50 + (Math.random() * 40 - 20) * dynamicFactor}%`
        ],
        y: [
          "50%", 
          `${50 + (Math.random() * 40 - 20) * dynamicFactor}%`
        ]
      }}
      transition={{
        duration: 2 / speed,
        delay: delay,
        repeat: Infinity,
        repeatDelay: Math.random() * (3 - currentStep * 0.2),
        ease: "easeInOut"
      }}
    />
  );
};

// Efecto de brillo para pasos avanzados
export const GlowEffect = ({ 
  active = false,
  color = "orange" as keyof typeof COLORS | string,
  intensity = 0.3,
  size,
  x,
  y,
  pulsate,
  className
}: {
  active?: boolean;
  color?: keyof typeof COLORS | string;
  intensity?: number;
  size?: number;
  x?: number;
  y?: number;
  pulsate?: boolean;
  className?: string;
}) => {
  if (!active) return null;
  
  return (
    <motion.div
      className={cn(
        "absolute inset-0 -z-10 rounded-xl bg-gradient-to-r",
        typeof color === 'string' && color in COLORS ? COLORS[color as keyof typeof COLORS] : 'from-purple-500 to-purple-600',
        "opacity-0",
        className
      )}
      animate={{ 
        opacity: [0, intensity, 0]
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
  );
};

// Componente para mostrar el ícono animado que corresponde a cada paso
export const StepIcon = ({ 
  stepId, 
  active = false,
  completed = false
}: { 
  stepId: string;
  active?: boolean;
  completed?: boolean;
}) => {
  const icons: Record<string, React.ReactNode> = {
    'transcription': <Music className="h-5 w-5" />,
    'script': <FileText className="h-5 w-5" />,
    'sync': <Music className="h-5 w-5" />,
    'scenes': <Video className="h-5 w-5" />,
    'customization': <Palette className="h-5 w-5" />,
    'movement': <Wand2 className="h-5 w-5" />,
    'lipsync': <Mic className="h-5 w-5" />,
    'generation': <Video className="h-5 w-5" />,
    'rendering': <Layers className="h-5 w-5" />
  };

  return (
    <motion.div
      className={cn(
        "flex items-center justify-center rounded-full p-2",
        active ? "text-white bg-gradient-to-br from-orange-500 to-orange-600" : 
        completed ? "text-white bg-gradient-to-br from-green-500 to-green-600" :
        "text-muted-foreground bg-muted/50"
      )}
      initial={{ scale: 0.8 }}
      animate={{ 
        scale: active ? [0.9, 1.1, 0.9] : 1,
        rotate: completed ? [0, 10, 0] : 0
      }}
      transition={{ 
        duration: active ? 2 : 0.3,
        repeat: active ? Infinity : 0,
        ease: "easeInOut"
      }}
    >
      {icons[stepId] || <Sparkles className="h-5 w-5" />}
    </motion.div>
  );
};