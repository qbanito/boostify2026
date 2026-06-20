import React from "react";
import { logger } from "../../lib/logger";
import { cn } from "../../lib/utils";

export interface ProgressCircularProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * El valor de progreso (0-100)
   * Si se omite, se muestra un spinner indeterminado
   */
  value?: number;
  
  /**
   * El tamaño del componente
   */
  size?: "xs" | "sm" | "md" | "lg";
  
  /**
   * Si es true, la animación se detiene
   */
  paused?: boolean;
  
  /**
   * Clases CSS adicionales
   */
  className?: string;
  
  /**
   * Variante de color
   */
  variant?: "default" | "primary" | "secondary" | "muted";
}

/**
 * Componente ProgressCircular
 * 
 * Muestra un indicador de progreso circular, que puede ser determinado o indeterminado
 */
export function ProgressCircular({
  value,
  size = "md",
  paused = false,
  className,
  variant = "primary",
  ...props
}: ProgressCircularProps) {
  // Calcular el valor para el círculo de progreso (para variante determinada)
  const circleValue = value !== undefined ? Math.min(Math.max(value, 0), 100) : undefined;
  const circumference = 2 * Math.PI * 45; // 45 es el radio del círculo SVG
  
  // Obtener clases de tamaño
  const sizeClasses = {
    xs: "h-4 w-4 border-2",
    sm: "h-5 w-5 border-2",
    md: "h-8 w-8 border-3",
    lg: "h-12 w-12 border-4",
  };
  
  // Obtener clases de color
  const colorClasses = {
    default: "border-muted-foreground/20",
    primary: "border-primary/20",
    secondary: "border-secondary/20",
    muted: "border-muted/20",
  };
  
  // Obtener clases de animación
  const spinnerColorClasses = {
    default: "border-t-muted-foreground/80",
    primary: "border-t-primary/80",
    secondary: "border-t-secondary/80",
    muted: "border-t-muted/80",
  };
  
  // Si es indeterminado, mostrar spinner
  if (circleValue === undefined) {
    return (
      <div
        className={cn(
          "animate-progress-circular rounded-full border-solid",
          sizeClasses[size],
          colorClasses[variant],
          spinnerColorClasses[variant],
          paused && "!animate-none",
          className
        )}
        {...props}
      />
    );
  }
  
  // Para la variante determinada, mostrar un círculo SVG
  const offset = circumference - (circleValue / 100) * circumference;
  
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Círculo de fondo */}
        <circle
          className={cn(
            "stroke-current text-muted/20",
            colorClasses[variant].replace("border-", "text-")
          )}
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
        />
        
        {/* Círculo de progreso */}
        <circle
          className={cn(
            "stroke-current",
            spinnerColorClasses[variant].replace("border-t-", "text-")
          )}
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.3s ease-in-out",
          }}
        />
      </svg>
      
      {props.children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {props.children}
        </div>
      )}
    </div>
  );
}