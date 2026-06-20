import * as React from "react"
import { logger } from "../../lib/logger";
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../../lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: 
          "border-transparent bg-green-500 text-white hover:bg-green-600",
        warning: 
          "border-transparent bg-amber-500 text-white hover:bg-amber-600",
        info: 
          "border-transparent bg-blue-500 text-white hover:bg-blue-600",
        // Special affiliate level badges
        basic: 
          "border-transparent bg-gray-500 text-white hover:bg-gray-600",
        silver: 
          "border-transparent bg-gray-300 text-gray-800 hover:bg-gray-400",
        gold: 
          "border-transparent bg-amber-400 text-amber-950 hover:bg-amber-500",
        platinum: 
          "border-transparent bg-gradient-to-r from-gray-300 to-gray-100 text-gray-800 hover:from-gray-400 hover:to-gray-200",
        // Investment plan badges
        standard: 
          "border-transparent bg-gradient-to-r from-green-400 to-emerald-300 text-emerald-950 hover:from-green-500 hover:to-emerald-400",
        premium: 
          "border-transparent bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 hover:from-amber-500 hover:to-yellow-400",
        elite: 
          "border-transparent bg-gradient-to-r from-purple-400 to-indigo-300 text-indigo-950 hover:from-purple-500 hover:to-indigo-400",
      },
      size: {
        default: "px-2.5 py-0.5 text-xs",
        sm: "px-2 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
        xl: "px-4 py-1.5 text-base",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn(badgeVariants({ variant, size, className }))} 
        {...props} 
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }