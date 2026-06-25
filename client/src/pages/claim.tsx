import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Sparkles, ShieldCheck, Music2, ArrowRight } from "lucide-react";

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
        setErrorMsg("Enlace inválido. Falta el identificador del perfil.");
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
              ? "Este enlace ha expirado. Pide uno nuevo o reclama tu perfil desde tu página pública."
              : "No encontramos el perfil que intentas reclamar.",
          );
          return;
        }
        setArtist(data.artist);
        setPhase(data.alreadyClaimed ? "already" : "ready");
      } catch {
        if (!cancelled) {
          setPhase("error");
          setErrorMsg("No pudimos cargar el perfil. Inténtalo de nuevo.");
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
      toast({ title: "¡Perfil reclamado!", description: "Bienvenido a Boostify. Tu carrera empieza ahora." });
      const dest = data?.slug || artist?.slug;
      setTimeout(() => {
        window.location.href = dest ? `/artist/${dest}` : "/dashboard";
      }, 1800);
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("already_claimed")) {
        setPhase("error");
        setErrorMsg("Este perfil ya fue reclamado por otra cuenta. Si crees que es un error, contáctanos.");
      } else if (msg.includes("already_have_profile")) {
        setPhase("error");
        setErrorMsg("Tu cuenta ya tiene otro perfil de artista. Escríbenos para fusionarlos.");
      } else if (msg.includes("email_mismatch")) {
        setPhase("error");
        setErrorMsg("El email de tu cuenta no coincide con el de este perfil. Inicia sesión con el email correcto.");
      } else {
        setPhase("error");
        setErrorMsg("No pudimos completar el reclamo. Inténtalo de nuevo en un momento.");
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

  const cover = artist?.coverImage || artist?.profileImage || "";
  const name = artist?.artistName || "tu perfil";

  return (
    <div className="min-h-screen w-full bg-[#0b0b0f] text-white flex items-center justify-center p-4">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-[#101016] shadow-[0_30px_120px_-20px_rgba(124,92,255,0.45)]">
        {/* Cover */}
        <div className="relative h-56 w-full sm:h-72">
          {cover ? (
            <img
              src={cover}
              alt={name}
              className="h-full w-full object-cover"
              style={{ objectPosition: "center top" }}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#7c5cff] via-[#ff2d95] to-[#ff7b00]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#101016] via-[#101016]/40 to-transparent" />
          <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-[#e8c98a]" />
            Perfil creado por Boostify AI
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
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando tu perfil…
            </div>
          )}

          {(phase === "ready" || phase === "claiming") && (
            <>
              <p className="mt-5 text-lg font-medium text-white">
                ¿Eres <span className="text-[#e8c98a]">{name}</span>? Este perfil es tuyo.
              </p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/60">
                {artist?.biography
                  ? artist.biography.slice(0, 220) + (artist.biography.length > 220 ? "…" : "")
                  : "Ya construimos tu página de artista con IA. Reclámala gratis para tomar el control, publicar tu música y activar todas las herramientas de Boostify."}
              </p>

              <ul className="mt-5 grid grid-cols-1 gap-2 text-sm text-white/70 sm:grid-cols-2">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#7c5cff]" /> Control total de tu página</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#7c5cff]" /> Sube tu música y videos</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#7c5cff]" /> Tienda y merch con IA</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#7c5cff]" /> Marketing y fans automatizados</li>
              </ul>

              <button
                onClick={handleClaimClick}
                disabled={phase === "claiming" || authLoading}
                className="group mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#7c5cff] via-[#ff2d95] to-[#ff7b00] px-6 py-4 text-base font-semibold text-white shadow-lg transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e8c98a] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {phase === "claiming" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" /> Reclamando…
                  </>
                ) : (
                  <>
                    Reclamar mi perfil gratis
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              <p className="mt-3 flex items-center gap-1.5 text-xs text-white/40">
                <ShieldCheck className="h-3.5 w-3.5" /> Gratis para siempre. Sin tarjeta de crédito.
              </p>
            </>
          )}

          {phase === "claimed" && (
            <div className="mt-8 rounded-2xl border border-[#7c5cff]/30 bg-[#7c5cff]/10 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#7c5cff]" />
              <p className="mt-3 text-lg font-semibold">¡Perfil reclamado!</p>
              <p className="mt-1 text-sm text-white/60">Llevándote a tu página de artista…</p>
            </div>
          )}

          {phase === "already" && (
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <p className="mt-3 text-lg font-semibold">Este perfil ya fue reclamado.</p>
              {artist?.slug && (
                <a
                  href={`/artist/${artist.slug}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-medium hover:bg-white/15"
                >
                  Ver el perfil <ArrowRight className="h-4 w-4" />
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
                Ir al inicio
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
