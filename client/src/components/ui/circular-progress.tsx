import React from "react";
import { logger } from "../../lib/logger";

interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

/**
 * Circular progress component that shows a percentage in a circular format
 * Can contain children that will be centered within the circle
 */
export function CircularProgress({
  value,
  strokeWidth = 6,
  children,
  className,
  ...props
}: CircularProgressProps) {
  const radius = 50 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} {...props}>
      <svg
        className="transform -rotate-90"
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background circle */}
        <circle
          className="text-muted-foreground/20"
          stroke="currentColor"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={radius}
          cx="50"
          cy="50"
        />
        {/* Progress circle */}
        <circle
          className="text-primary"
          stroke="currentColor"
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          r={radius}
          cx="50"
          cy="50"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}