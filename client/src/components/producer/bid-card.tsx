import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Star, Clock, DollarSign, CheckCircle, XCircle, MessageSquare, ExternalLink } from "lucide-react";

interface BidCardProps {
  bid: {
    bid: {
      id: number;
      amount: string;
      message: string;
      estimatedDelivery?: string;
      portfolioLinks?: string[];
      status: string;
      createdAt: string;
    };
    musicianName: string;
    musicianPhoto: string;
    musicianRating: string;
    musicianCategory: string;
  };
  isOwner: boolean;
  onAccept?: (bidId: number) => void;
  accepting?: boolean;
}

export function BidCard({ bid, isOwner, onAccept, accepting }: BidCardProps) {
  const { bid: bidData, musicianName, musicianPhoto, musicianRating, musicianCategory } = bid;
  const timeAgo = getTimeAgo(new Date(bidData.createdAt));

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    accepted: "bg-green-500/20 text-green-400 border-green-500/30",
    rejected: "bg-red-500/20 text-red-400 border-red-500/30",
    withdrawn: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };

  return (
    <Card className={`p-4 border transition-all hover:border-orange-500/40 ${
      bidData.status === "accepted" ? "border-green-500/40 bg-green-500/5" : "bg-slate-800/50 border-slate-700"
    }`}>
      <div className="flex items-start gap-3">
        <img
          src={musicianPhoto || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100"}
          alt={musicianName}
          className="w-12 h-12 rounded-full object-cover border-2 border-slate-600"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white">{musicianName}</span>
            <Badge variant="outline" className="text-xs border-slate-600">{musicianCategory}</Badge>
            <div className="flex items-center gap-1 text-yellow-400 text-xs">
              <Star className="h-3 w-3 fill-current" />
              {musicianRating}
            </div>
            <Badge className={`text-xs ${statusColors[bidData.status] || ""}`}>
              {bidData.status}
            </Badge>
          </div>

          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1 text-green-400 font-bold text-lg">
              <DollarSign className="h-4 w-4" />
              {bidData.amount}
            </div>
            {bidData.estimatedDelivery && (
              <div className="flex items-center gap-1 text-slate-400 text-xs">
                <Clock className="h-3 w-3" />
                {bidData.estimatedDelivery}
              </div>
            )}
            <span className="text-xs text-slate-500">{timeAgo}</span>
          </div>

          <p className="text-sm text-slate-300 mt-2 line-clamp-2">
            <MessageSquare className="h-3 w-3 inline mr-1 text-slate-500" />
            {bidData.message}
          </p>

          {bidData.portfolioLinks && bidData.portfolioLinks.length > 0 && (
            <div className="flex gap-2 mt-2">
              {bidData.portfolioLinks.map((link, i) => (
                <a
                  key={i}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300"
                >
                  <ExternalLink className="h-3 w-3" /> Portfolio {i + 1}
                </a>
              ))}
            </div>
          )}

          {isOwner && bidData.status === "pending" && (
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={() => onAccept?.(bidData.id)}
                disabled={accepting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Accept Bid
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
