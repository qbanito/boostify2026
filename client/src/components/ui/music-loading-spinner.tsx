import { motion } from "framer-motion";
import { logger } from "../../lib/logger";
import { Music, Music2 } from "lucide-react";
import { cn } from "../../lib/utils";

interface MusicLoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "subtle";
}

const bars = [1, 2, 3, 4];

export function MusicLoadingSpinner({
  className,
  size = "md",
  variant = "default"
}: MusicLoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32"
  };

  const barWidth = size === "sm" ? "w-1" : size === "md" ? "w-2" : "w-3";
  
  return (
    <div className={cn("relative flex items-center justify-center", sizeClasses[size], className)}>
      {/* Pulsing background circle */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full",
          variant === "default" ? "bg-orange-500/20" : "bg-orange-500/10"
        )}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      {/* Rotating music note */}
      <motion.div
        className="absolute"
        animate={{
          rotate: [0, 360]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "linear"
        }}
      >
        <Music2 className={cn(
          "text-orange-500",
          size === "sm" ? "w-6 h-6" : size === "md" ? "w-8 h-8" : "w-10 h-10"
        )} />
      </motion.div>

      {/* Equalizer bars */}
      <div className="absolute bottom-0 flex gap-1 items-end justify-center">
        {bars.map((bar, index) => (
          <motion.div
            key={bar}
            className={cn(
              barWidth,
              "bg-orange-500 rounded-t-full",
              variant === "subtle" && "opacity-80"
            )}
            animate={{
              height: ["20%", "80%", "40%", "100%", "20%"],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: index * 0.2,
              ease: "easeInOut"
            }}
          />
        ))}
      </div>

      {/* Ripple effect */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full border-2",
          variant === "default" ? "border-orange-500" : "border-orange-500/60"
        )}
        animate={{
          scale: [1, 1.4, 1.8],
          opacity: [0.6, 0.3, 0]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeOut"
        }}
      />
    </div>
  );
}
