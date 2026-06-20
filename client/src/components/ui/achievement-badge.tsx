import { cn } from "../../lib/utils";
import { logger } from "../../lib/logger";
import { Card } from "./card";
import { Badge } from "lucide-react";

interface AchievementBadgeProps {
  name: string;
  description: string;
  badgeImage: string;
  earned?: boolean;
  earnedAt?: string;
  className?: string;
}

export function AchievementBadge({
  name,
  description,
  badgeImage,
  earned = false,
  earnedAt,
  className
}: AchievementBadgeProps) {
  return (
    <Card className={cn(
      "relative p-4 flex flex-col items-center justify-center gap-2 transition-all duration-300",
      !earned && "opacity-50 grayscale",
      className
    )}>
      {earned && (
        <div className="absolute -top-2 -right-2">
          <Badge className="w-6 h-6 text-primary" />
        </div>
      )}
      
      <div className="w-24 h-24 relative">
        <img
          src={badgeImage}
          alt={name}
          className="w-full h-full object-contain"
        />
      </div>
      
      <h3 className="text-lg font-semibold text-center">{name}</h3>
      <p className="text-sm text-muted-foreground text-center">{description}</p>
      
      {earned && earnedAt && (
        <p className="text-xs text-muted-foreground mt-2">
          Earned {new Date(earnedAt).toLocaleDateString()}
        </p>
      )}
    </Card>
  );
}
