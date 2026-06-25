import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Music2,
  ArrowRight,
  Globe,
  Clapperboard,
  Mic2,
  Store,
  Ticket,
  Users,
  Megaphone,
  Image as ImageIcon,
  Radio,
  TrendingUp,
  Bot,
  Gift,
  type LucideIcon,
} from "lucide-react";

interface ClaimTool {
  icon: LucideIcon;
  title: string;
  desc: string;
}

// The full Boostify arsenal — shown on the claim page so the artist sees the
// whole platform they unlock when they claim their profile.
const CLAIM_TOOLS: ClaimTool[] = [
  { icon: Globe, title: "Professional page", desc: "Your artist site, ready" },
  { icon: Music2, title: "Music & videos", desc: "Upload your whole catalog" },
  { icon: Clapperboard, title: "AI music videos", desc: "Cinematic clips" },
  { icon: Mic2, title: "Karaoke & lyric videos", desc: "Hook your fans" },
  { icon: Store, title: "3D store + AI merch", desc: "Products, zero inventory" },
  { icon: Ticket, title: "Concerts & tickets", desc: "Sell tickets online" },
  { icon: Users, title: "Fan club", desc: "Monetize your community" },
  { icon: Megaphone, title: "Automated marketing", desc: "Social on autopilot" },
  { icon: ImageIcon, title: "AI art & images", desc: "Endless visual gallery" },
  { icon: Radio, title: "Streaming & radio", desc: "Be heard worldwide" },
  { icon: TrendingUp, title: "Economic engine", desc: "Revenue & treasury" },
  { icon: Bot, title: "AI agents 24/7", desc: "Work for you nonstop" },
];

// AI pre-built profiles ship with throwaway placeholder covers (picsum / ui-avatars).
// We never want those as the hero — show the branded animated background instead.
function isPlaceholderCover(url?: string | null): boolean {
  if (!url) return true;
  return /picsum\.photos|ui-avatars\.com|placehold|dummyimage|gravatar/i.test(url);
}

const AURORA_CSS = `
.claim-orb{position:absolute;border-radius:9999px;filter:blur(44px);opacity:.6;mix-blend-mode:screen;will-change:transform}
.claim-orb-1{width:260px;height:260px;left:-50px;top:-70px;background:radial-gradient(circle at 30% 30%,#7c5cff,transparent 70%);animation:claimFloat1 15s ease-in-out infinite}
.claim-orb-2{width:320px;height:320px;right:-70px;top:-50px;background:radial-gradient(circle at 50% 50%,#ff2d95,transparent 70%);animation:claimFloat2 19s ease-in-out infinite}
.claim-orb-3{width:240px;height:240px;left:38%;top:10px;background:radial-gradient(circle at 50% 50%,#ff7b00,transparent 70%);animation:claimFloat3 17s ease-in-out infinite}
.claim-sheen{position:absolute;inset:-60%;background:conic-gradient(from 0deg,transparent,rgba(232,201,138,.12),transparent 38%);animation:claimSpin 24s linear infinite}
.claim-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:42px 42px;-webkit-mask-image:radial-gradient(circle at 50% 35%,#000,transparent 75%);mask-image:radial-gradient(circle at 50% 35%,#000,transparent 75%);animation:claimGrid 7s linear infinite}
.claim-note{position:absolute;bottom:-10px;color:rgba(255,255,255,.5);animation:claimRise 9s linear infinite}
.claim-note-1{left:13%;animation-delay:0s}
.claim-note-2{left:34%;color:rgba(232,201,138,.65);animation-delay:2.6s}
.claim-note-3{left:61%;animation-delay:1.3s}
.claim-note-4{left:83%;color:rgba(255,45,149,.6);animation-delay:3.8s}
@keyframes claimFloat1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(44px,30px) scale(1.15)}}
@keyframes claimFloat2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-42px,26px) scale(1.2)}}
@keyframes claimFloat3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(22px,40px) scale(1.1)}}
@keyframes claimSpin{to{transform:rotate(360deg)}}
@keyframes claimGrid{to{background-position:0 42px}}
@keyframes claimRise{0%{transform:translateY(12px);opacity:0}15%{opacity:.6}85%{opacity:.6}100%{transform:translateY(-170px);opacity:0}}
@media (prefers-reduced-motion:reduce){.claim-orb,.claim-sheen,.claim-grid,.claim-note{animation:none!important}}
`;

// Modern, Boostify-branded animated hero used when no real cover exists.
function BrandAurora() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0b0b0f]">
      <style>{AURORA_CSS}</style>
      <div className="claim-orb claim-orb-1" />
      <div className="claim-orb claim-orb-2" />
      <div className="claim-orb claim-orb-3" />
      <div className="claim-sheen" />
      <div className="claim-grid" />
      <Music2 className="claim-note claim-note-1 h-5 w-5" />
      <Sparkles className="claim-note claim-note-2 h-4 w-4" />
      <Music2 className="claim-note claim-note-3 h-6 w-6" />
      <Sparkles className="claim-note claim-note-4 h-4 w-4" />
    </div>
  );
}

interface ClaimArtist {
  id: number;
  slug: string | null;
  artistName: string;
  profileImage: string | null;
  coverImage: string | null;
  genre: string | null;
  biography: string | null;
  isAIGenerated: boolean;
}

type Phase = "loading" | "ready" | "claiming" | "claimed" | "already" | "error";

export default function ClaimPage() {
  const { isAuthenticated, isLoading: authLoading, login, refetch } = useAuth();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("loading");
  const [artist, setArtist] = useState<ClaimArtist | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const pendingClaim = useRef(false);

  // Read token / slug from the URL once.
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || undefined;
  const slug = params.get("slug") || undefined;

  // 1) Load the profile preview.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token && !slug) {
        setPhase("error");
        setErrorMsg("Invalid link. The profile identifier is missing.");
        return;
      }
      try {
        const qs = token ? `token=${encodeURIComponent(token)}` : `slug=${encodeURIComponent(slug!)}`;
        const res = await fetch(`/api/artist-activation/claim-info?${qs}`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) {
          setPhase("error");
          setErrorMsg(
            data.error === "expired"
              ? "This link has expired. Request a new one or claim your profile from your public page."
              : "We couldn't find the profile you're trying to claim.",
          );
          return;
        }
        setArtist(data.artist);
        setPhase(data.alreadyClaimed ? "already" : "ready");
      } catch {
        if (!cancelled) {
          setPhase("error");
          setErrorMsg("We couldn't load the profile. Please try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitClaim = async () => {
    setPhase("claiming");
    try {
      const data = await apiRequest("POST", "/api/artist-activation/claim", token ? { token } : { slug });
      await refetch().catch(() => {});
      setPhase("claimed");
      toast({ title: "Profile claimed!", description: "Welcome to Boostify. Your career starts now." });
      const dest = data?.slug || artist?.slug;
      setTimeout(() => {
        window.location.href = dest ? `/artist/${dest}` : "/dashboard";
      }, 1800);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("already_claimed")) {
        setPhase("error");
        setErrorMsg("This profile was already claimed by another account. If you think this is a mistake, contact us.");
      } else if (msg.includes("already_have_profile")) {
        setPhase("error");
        setErrorMsg("Your account already has another artist profile. Contact us to merge them.");
      } else if (msg.includes("email_mismatch")) {
        setPhase("error");
        setErrorMsg("Your account email doesn't match this profile. Sign in with the correct email.");
      } else {
        setPhase("error");
        setErrorMsg("We couldn't complete the claim. Please try again in a moment.");
      }
    }
  };

  // 2) When the user signs in after clicking "claim", auto-submit.
  useEffect(() => {
    if (isAuthenticated && pendingClaim.current && phase === "ready") {
      pendingClaim.current = false;
      submitClaim();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, phase]);

  const handleClaimClick = () => {
    if (authLoading) return;
    if (!isAuthenticated) {
      pendingClaim.current = true;
      login(); // opens the Clerk sign-in / sign-up modal
      return;
    }
    submitClaim();
  };

  const realCoverUrl = !isPlaceholderCover(artist?.coverImage)
    ? artist?.coverImage
    : !isPlaceholderCover(artist?.profileImage)
      ? artist?.profileImage
      : "";
  const name = artist?.artistName || "your profile";

  return (
    <div className="min-h-screen w-full bg-[#0b0b0f] text-white flex items-center justify-center p-4 pb-28 sm:pb-12">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#101016] shadow-[0_30px_120px_-20px_rgba(124,92,255,0.45)]">
        {/* Cover */}
        <div className="relative h-56 w-full overflow-hidden sm:h-72">
          {realCoverUrl ? (
            <img
              src={realCoverUrl}
              alt={name}
              className="h-full w-full object-cover"
              style={{ objectPosition: "center top" }}
            />
          ) : (
            <BrandAurora />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#101016] via-[#101016]/40 to-transparent" />
          <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[#e8c98a]" />
            Created by Boostify AI
          </div>
          <div className="absolute right-5 top-5 select-none text-xs font-extrabold tracking-[0.25em] text-white/70">
            BOOSTIFY
          </div>
        </div>

        {/* Body */}
        <div className="relative -mt-14 px-6 pb-8 sm:px-10">
          <div className="flex items-end gap-4">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-[#101016] bg-[#1a1a24] shadow-xl sm:h-28 sm:w-28">
              {artist?.profileImage ? (
                <img src={artist.profileImage} alt={name} className="h-full w-full object-cover" style={{ objectPosition: "center top" }} />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Music2 className="h-8 w-8 text-white/40" />
                </div>
              )}
            </div>
            <div className="pb-1">
              {artist?.genre && (
                <span className="text-xs font-semibold uppercase tracking-wider text-[#e8c98a]">{artist.genre}</span>
              )}
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{name}</h1>
            </div>
          </div>

          {phase === "loading" && (
            <div className="mt-10 flex items-center justify-center gap-3 py-10 text-white/60">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading your profile…
            </div>
          )}

          {(phase === "ready" || phase === "claiming") && (
            <>
              <p className="mt-5 text-lg font-medium text-white">
                Are you <span className="text-[#e8c98a]">{name}</span>? This profile is yours.
              </p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">
                {artist?.biography
                  ? artist.biography.slice(0, 160) + (artist.biography.length > 160 ? "…" : "")
                  : "We already built your AI artist page. Claim it for free and unlock the full platform to take your career to the next level."}
              </p>

              {/* Irresistible offer — the full arsenal */}
              <div className="mt-6">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#e8c98a]" />
                  <p className="text-sm font-semibold text-white">
                    Claim it to unlock your full platform:
                  </p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {CLAIM_TOOLS.map((tool) => (
                    <div
                      key={tool.title}
                      className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-[#7c5cff]/40 hover:bg-white/[0.06]"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#7c5cff]/25 to-[#ff2d95]/25 text-[#c9b6ff]">
                        <tool.icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-tight text-white">{tool.title}</p>
                        <p className="mt-0.5 text-[11px] leading-tight text-white/45">{tool.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Value banner */}
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#e8c98a]/25 bg-gradient-to-r from-[#e8c98a]/12 via-[#e8c98a]/5 to-transparent p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e8c98a]/15 text-[#e8c98a]">
                  <Gift className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    Start with <span className="text-[#e8c98a]">50 free credits</span> to try every tool
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/50">
                    <span className="inline-flex items-center gap-1">
                      <Gift className="h-3.5 w-3.5" /> Free credits every month
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5" /> No credit card required
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Ready in 30 seconds
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={handleClaimClick}
                disabled={phase === "claiming" || authLoading}
                className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#7c5cff] via-[#ff2d95] to-[#ff7b00] px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8c98a] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {phase === "claiming" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Claiming…
                  </>
                ) : (
                  <>
                    Claim my profile — free
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/40">
                <ShieldCheck className="h-3.5 w-3.5" /> Your profile stays 100% under your control.
              </p>
            </>
          )}

          {phase === "claimed" && (
            <div className="mt-8 rounded-2xl border border-[#7c5cff]/30 bg-[#7c5cff]/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#7c5cff]" />
              <p className="mt-3 text-lg font-semibold">Profile claimed!</p>
              <p className="mt-1 text-sm text-white/60">Taking you to your artist page…</p>
            </div>
          )}

          {phase === "already" && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <p className="mt-3 text-lg font-semibold">This profile has already been claimed.</p>
              {artist?.slug && (
                <a
                  href={`/artist/${artist.slug}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/15"
                >
                  View profile <ArrowRight className="h-4 w-4" />
                </a>
              )}
            </div>
          )}

          {phase === "error" && (
            <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center">
              <p className="text-sm text-white/80">{errorMsg}</p>
              <a
                href="/"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/15"
              >
                Go home
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
