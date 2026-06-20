import React from "react";
import {
  Disc3,
  Video,
  Megaphone,
  TrendingUp,
  Award,
  Headphones,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Milestone {
  id: string;
  title: string;
  description: string;
  status: "completed" | "in_progress" | "coming_soon";
  progress: number;
  icon: "album" | "video" | "campaign" | "chart" | "award" | "headphones";
}

interface ArtistProgressWidgetProps {
  milestones?: Milestone[];
  streams: number;
}

const iconMap = {
  album: Disc3,
  video: Video,
  campaign: Megaphone,
  chart: TrendingUp,
  award: Award,
  headphones: Headphones,
};

const statusConfig = {
  completed: {
    color: "from-green-500/20 to-emerald-500/10",
    border: "border-green-500/30",
    badge: "bg-green-500/20 text-green-300",
    icon: CheckCircle2,
  },
  in_progress: {
    color: "from-orange-500/20 to-amber-500/10",
    border: "border-orange-500/30",
    badge: "bg-orange-500/20 text-orange-300",
    icon: Clock,
  },
  coming_soon: {
    color: "from-purple-500/20 to-indigo-500/10",
    border: "border-purple-500/30",
    badge: "bg-purple-500/20 text-purple-300",
    icon: AlertCircle,
  },
};

export function ArtistProgressWidget({
  milestones,
  streams,
}: ArtistProgressWidgetProps) {
  if (!milestones || milestones.length === 0) {
    return null;
  }

  const formatStreams = (num: number) => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + "B";
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  return (
    <div className="space-y-4">
      {/* Streams Display */}
      <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/10 rounded-lg p-3 border border-purple-500/30">
        <div className="flex items-center gap-2 mb-2">
          <Headphones className="h-4 w-4 text-purple-400" />
          <p className="text-xs font-semibold text-purple-300">Total Streams</p>
        </div>
        <p className="text-2xl font-bold text-purple-300">
          {formatStreams(streams)}
        </p>
      </div>

      {/* Milestones Title */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-orange-400" />
        <h3 className="font-semibold text-sm text-white">Artist Milestones</h3>
      </div>

      {/* Milestones Grid */}
      <div className="space-y-2">
        {milestones.map((milestone) => {
          const config = statusConfig[milestone.status];
          const Icon = iconMap[milestone.icon];
          const StatusIcon = config.icon;

          return (
            <div
              key={milestone.id}
              className={`bg-gradient-to-r ${config.color} rounded-lg p-3 border ${config.border} transition-all hover:shadow-lg`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-start gap-2 flex-1">
                  <Icon className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate">
                      {milestone.title}
                    </h4>
                    <p className="text-xs text-slate-300 line-clamp-1">
                      {milestone.description}
                    </p>
                  </div>
                </div>
                <Badge className={`${config.badge} border-0 text-xs flex-shrink-0`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {milestone.status === "completed"
                    ? "Done"
                    : milestone.status === "in_progress"
                      ? "Active"
                      : "Soon"}
                </Badge>
              </div>

              {/* Progress Bar */}
              {milestone.progress > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                      style={{ width: `${milestone.progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-white/80 w-10 text-right">
                    {milestone.progress}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
