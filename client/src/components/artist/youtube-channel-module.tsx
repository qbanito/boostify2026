import { Button } from "@/components/ui/button";
import { ArrowUpRight, Upload } from "lucide-react";
import { SiYoutube } from "react-icons/si";
import { ChannelSeoWidgets } from "@/components/youtube/channel-seo-widgets";

interface YoutubeChannelModuleProps {
  artistId: number;
  artistName: string;
  genre?: string;
  colors: { primary: string; accent: string };
  isOwner: boolean;
}

/**
 * YouTube Channel module — artist profile section wired directly to the
 * /youtube-views page. Uses the SAME OAuth connection the upload flow
 * (karaoke / lyrics-video) already stores, and renders the compact real-time
 * SEO widgets: channel health score, worst-scoring videos, one-click AI fixes
 * applied straight to the live channel.
 */
export function YoutubeChannelModule({ artistName, genre, isOwner }: YoutubeChannelModuleProps) {
  if (!isOwner) return null;

  return (
    <div className="space-y-3">
      <ChannelSeoWidgets artistName={artistName} genre={genre} compact />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs text-white flex-1 min-w-[140px]"
          style={{ background: "#ff0033" }}
          onClick={() => (window.location.href = "/youtube-views?tab=channel-seo")}
        >
          <SiYoutube className="w-3.5 h-3.5" /> SEO Cockpit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs flex-1 min-w-[140px]"
          onClick={() => (window.location.href = "/youtube-views")}
        >
          <ArrowUpRight className="w-3.5 h-3.5" /> YouTube Tools
        </Button>
      </div>
      <p className="text-[10px] text-white/35 flex items-center gap-1">
        <Upload className="w-3 h-3" /> Uses the same channel connection as video uploads (karaoke &amp; lyric videos).
      </p>
    </div>
  );
}
