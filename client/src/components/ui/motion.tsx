/**
import { logger } from "../../lib/logger";
 * UI Motion components for animation
 * 
 * This file provides motion-enhanced versions of common UI components
 * that can be used to add animations throughout the application.
 */

"use client";

import { cn } from "../../lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

// Motion-enhanced div component
export const MotionDiv = motion.div;

// Motion-enhanced section component
export const MotionSection = motion.section;

// Motion-enhanced span component
export const MotionSpan = motion.span;

// Motion-enhanced button component
export const MotionButton = motion.button;

// Motion-enhanced Image component
export const MotionImage = motion.img;

// Common animation presets
export const fadeIn = (delay: number = 0, duration: number = 0.5) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration, delay }
});

export const slideInFromLeft = (delay: number = 0, duration: number = 0.5) => ({
  initial: { x: -100, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { duration, delay, type: "spring", stiffness: 100 }
});

export const slideInFromRight = (delay: number = 0, duration: number = 0.5) => ({
  initial: { x: 100, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { duration, delay, type: "spring", stiffness: 100 }
});

export const slideInFromTop = (delay: number = 0, duration: number = 0.5) => ({
  initial: { y: -100, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { duration, delay, type: "spring", stiffness: 100 }
});

export const slideInFromBottom = (delay: number = 0, duration: number = 0.5) => ({
  initial: { y: 100, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  transition: { duration, delay, type: "spring", stiffness: 100 }
});

export const scaleIn = (delay: number = 0, duration: number = 0.5) => ({
  initial: { scale: 0.8, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration, delay, type: "spring", stiffness: 100 }
});

// Container component that animates its children with staggered timing
interface StaggerContainerProps extends HTMLMotionProps<"div"> {
  className?: string;
  delayChildren?: number;
  staggerChildren?: number;
}

export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  className,
  delayChildren = 0,
  staggerChildren = 0.1,
  ...props
}) => {
  return (
    <motion.div
      className={cn(className)}
      initial="initial"
      animate="animate"
      viewport={{ once: true, amount: 0.25 }}
      variants={{
        initial: {},
        animate: {
          transition: {
            delayChildren,
            staggerChildren,
          },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
};