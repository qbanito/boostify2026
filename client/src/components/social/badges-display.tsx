import React from "react";
import { 
  CheckCircle, 
  Flame, 
  Handshake, 
  TrendingUp 
} from "lucide-react";

interface BadgesDisplayProps {
  badges?: string[];
  isVerified?: boolean;
}

export function BadgesDisplay({ badges = [], isVerified }: BadgesDisplayProps) {
  const getBadgeIcon = (badgeType: string) => {
    switch (badgeType) {
      case "verified":
        return <CheckCircle className="h-4 w-4 text-blue-400" />;
      case "trending":
        return <Flame className="h-4 w-4 text-orange-400" />;
      case "collaborator":
        return <Handshake className="h-4 w-4 text-purple-400" />;
      case "trending_creator":
        return <TrendingUp className="h-4 w-4 text-red-400" />;
      default:
        return null;
    }
  };

  const getBadgeLabel = (badgeType: string) => {
    switch (badgeType) {
      case "verified":
        return "Verificado";
      case "trending":
        return "Trending";
      case "collaborator":
        return "Colaborador";
      case "trending_creator":
        return "Creador Trending";
      default:
        return badgeType;
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {isVerified && (
        <div className="inline-flex items-center gap-1 bg-blue-500/20 border border-blue-500/50 text-blue-400 px-2 py-1 rounded-full text-xs">
          <CheckCircle className="h-3 w-3" />
          <span>Verificado</span>
        </div>
      )}
      
      {badges?.map((badge, idx) => (
        <div 
          key={idx}
          className="inline-flex items-center gap-1 bg-orange-500/20 border border-orange-500/50 text-orange-400 px-2 py-1 rounded-full text-xs"
        >
          {getBadgeIcon(badge)}
          <span>{getBadgeLabel(badge)}</span>
        </div>
      ))}
    </div>
  );
}
