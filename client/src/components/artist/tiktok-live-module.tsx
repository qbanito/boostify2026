import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import QRCode from "react-qr-code";
import { SiTiktok } from "react-icons/si";
import { Radio, ExternalLink, Copy, CheckCircle, QrCode, Sparkles, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TikTokLiveModuleProps {
  artistId: number;
  artistName: string;
  artistSlug?: string;
  colors: { primary: string; accent: string };
  isOwner: boolean;
}

/**
 * TikTok Live Hub module — artist profile section wired directly to the
 * /tiktok-boost page. Shows connection status, a QR that puts THIS artist's
 * Boostify profile on screen during a TikTok LIVE, and deep-link CTAs into
 * the TikTok Boost Live tab pre-selecting this artist.
 */
export function TikTokLiveModule({ artistId, artistName, artistSlug, colors, isOwner }: TikTokLiveModuleProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: connData } = useQuery<{ connection?: any; data?: any }>({
    queryKey: ["/api/auth/tiktok/connection"],
    enabled: isOwner,
    staleTime: 5 * 60 * 1000,
  });
  const conn = (connData as any)?.connection || (connData as any)?.data || null;
  const connected = !!(conn?.connected || conn?.isActive);
  const handle = conn?.displayName ? String(conn.displayName).replace(/^@/, "") : null;

  if (!isOwner) return null;

  const profileUrl = artistSlug ? `${window.location.origin}/artist/${artistSlug}` : window.location.href;

  const copyLink = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    toast({ title: "Profile link copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  const liveTabUrl = `/tiktok-boost?tab=live&artist=${artistId}`;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-4">
      {/* Status row */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center border border-white/10">
          <SiTiktok className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white truncate">TikTok Live Hub</p>
          <p className="text-[11px] text-white/50 truncate">
            {connected ? `Connected as @${handle}` : "TikTok account not connected"}
          </p>
        </div>
        <Badge
          variant="outline"
          className="text-[10px] shrink-0"
          style={connected ? { borderColor: "#00f2ea55", color: "#00f2ea" } : { borderColor: "#ff005055", color: "#ff0050" }}
        >
          {connected ? "Connected" : "Offline"}
        </Badge>
      </div>

      {/* QR — show this artist's profile during a LIVE */}
      <div className="flex items-center gap-4">
        <div className="bg-white p-2 rounded-xl shrink-0">
          <QRCode value={profileUrl} size={88} />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] text-white/60 leading-snug">
            <QrCode className="w-3 h-3 inline mr-1" style={{ color: colors.primary }} />
            Show this QR on your TikTok LIVE — viewers land on {artistName}'s Boostify profile.
          </p>
          <Button size="sm" variant="outline" onClick={copyLink} className="h-7 gap-1.5 text-[11px]">
            {copied ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            Copy profile link
          </Button>
        </div>
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs text-white flex-1 min-w-[130px]"
          style={{ background: "linear-gradient(to right, #ff0050, #7c3aed)" }}
          onClick={() => (window.location.href = liveTabUrl)}
        >
          <Radio className="w-3.5 h-3.5" /> Prepare a LIVE
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs flex-1 min-w-[130px]"
          onClick={() => (window.location.href = connected ? "/tiktok-boost" : "/tiktok-boost?tab=account")}
        >
          {connected ? <Sparkles className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          {connected ? "TikTok AI Tools" : "Connect TikTok"}
        </Button>
        {connected && handle && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => window.open(`https://www.tiktok.com/@${handle}`, "_blank")}
          >
            <ExternalLink className="w-3.5 h-3.5" /> @{handle}
          </Button>
        )}
      </div>
    </div>
  );
}
