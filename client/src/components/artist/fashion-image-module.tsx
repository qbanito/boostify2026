/**
 * FashionImageModule — Artist Profile module that connects to the
 * Fashion Image Studio (/artist-image-advisor).
 *
 * Owner sees: editorial style highlights, recent generated fashion imagery,
 * and one-click CTAs into the studio (image generator pre-selected for this
 * artist via ?artist=<pgId>&view=imagegen deep-link).
 */
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Camera, Sparkles, ImageIcon, Shirt, Film, Palette, ArrowRight, Loader2, Star,
} from "lucide-react";

interface FashionImageModuleProps {
  artistId: number | string;
  artistName: string;
  artistImage?: string;
  colors: { primary: string; accent: string };
  isOwner: boolean;
}

interface StylePreset { key: string; label: string; description: string; }

const STUDIO_TOOLS = [
  { icon: ImageIcon, label: "Editorial Images", desc: "8 curated fashion styles", view: "imagegen" },
  { icon: Shirt, label: "Virtual Try-On", desc: "Wear any outfit with AI", view: "tryon" },
  { icon: Film, label: "Fashion Video", desc: "Cinematic campaign clips", view: "video" },
  { icon: Palette, label: "AI Stylist", desc: "Color & style analysis", view: "stylist" },
];

export function FashionImageModule({ artistId, artistName, artistImage, colors, isOwner }: FashionImageModuleProps) {
  const [, setLocation] = useLocation();
  const numericArtistId = Number(artistId);

  // Curated style presets (public endpoint)
  const { data: presetsData } = useQuery<{ success: boolean; presets: StylePreset[] }>({
    queryKey: ["/api/fashion/style-presets"],
    staleTime: 10 * 60_000,
  });
  const presets = (presetsData?.presets || []).slice(0, 4);

  // Recent fashion portfolio (owner only — endpoint is authenticated)
  const { data: portfolioData, isLoading: portfolioLoading } = useQuery<any>({
    queryKey: [`/api/fashion/portfolio?userId=${numericArtistId}&limit=6`],
    enabled: isOwner && !!numericArtistId,
  });
  const recentImages: Array<{ imageUrl?: string; resultUrl?: string; title?: string }> =
    (portfolioData?.portfolio || portfolioData?.items || portfolioData || [])
      ?.filter?.((p: any) => p.imageUrl || p.resultUrl)?.slice(0, 6) || [];

  const openStudio = (view = "imagegen") =>
    setLocation(`/artist-image-advisor?artist=${numericArtistId}&view=${view}`);

  return (
    <div className="space-y-4">
      {/* Hero strip */}
      <div
        className="relative overflow-hidden rounded-xl border p-4 sm:p-5"
        style={{
          borderColor: `${colors.accent}33`,
          background: `linear-gradient(120deg, ${colors.primary}14, transparent 55%), rgba(0,0,0,0.35)`,
        }}
      >
        <div className="flex items-center gap-4 flex-wrap">
          {artistImage && (
            <img
              src={artistImage}
              alt={artistName}
              className="h-14 w-14 rounded-xl object-cover ring-2"
              style={{ ["--tw-ring-color" as any]: `${colors.accent}66` }}
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-base font-bold text-white">Fashion Image Studio</h4>
              <Badge variant="outline" className="text-[10px] border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-500/10">
                FLUX KONTEXT · LIKENESS
              </Badge>
            </div>
            <p className="text-xs text-white/55 mt-0.5">
              Magazine-grade editorial imagery of {artistName} — real face, commercial fashion look
            </p>
          </div>
          {isOwner && (
            <Button
              onClick={() => openStudio("imagegen")}
              className="rounded-full text-white gap-1.5 shrink-0"
              style={{ backgroundColor: colors.primary }}
            >
              <Sparkles className="h-4 w-4" /> Open Studio <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Editorial style chips */}
        {presets.length > 0 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={isOwner ? () => openStudio("imagegen") : undefined}
                className={`text-left rounded-lg border border-white/10 bg-black/30 p-2.5 ${isOwner ? "hover:border-fuchsia-500/40 cursor-pointer" : "cursor-default"} transition-colors`}
              >
                <p className="text-[11px] font-bold text-white truncate">{p.label}</p>
                <p className="text-[10px] text-white/45 leading-snug line-clamp-2">{p.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Owner: studio tools + recent work */}
      {isOwner && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STUDIO_TOOLS.map((tool) => (
              <button
                key={tool.view}
                onClick={() => openStudio(tool.view)}
                className="flex flex-col items-start gap-1.5 rounded-xl border border-white/10 bg-black/25 p-3 text-left hover:border-white/25 transition-colors"
              >
                <tool.icon className="h-4 w-4" style={{ color: colors.accent }} />
                <p className="text-xs font-semibold text-white">{tool.label}</p>
                <p className="text-[10px] text-white/45">{tool.desc}</p>
              </button>
            ))}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-3.5 w-3.5" style={{ color: colors.accent }} />
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Recent fashion work</p>
            </div>
            {portfolioLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-white/30" />
              </div>
            ) : recentImages.length === 0 ? (
              <button
                onClick={() => openStudio("imagegen")}
                className="w-full rounded-xl border border-dashed border-white/15 p-5 text-center hover:border-fuchsia-500/40 transition-colors"
              >
                <Camera className="mx-auto h-7 w-7 text-white/25 mb-1.5" />
                <p className="text-xs text-white/55">No fashion imagery yet — generate your first editorial set</p>
              </button>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {recentImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => openStudio("portfolio")}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-white/10"
                  >
                    <img
                      src={img.imageUrl || img.resultUrl}
                      alt={img.title || `Fashion ${i + 1}`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default FashionImageModule;
