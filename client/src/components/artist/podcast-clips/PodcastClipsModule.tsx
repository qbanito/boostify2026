import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight, Check, CircleDollarSign, Clapperboard, Download, Film, LoaderCircle,
  Mic2, Music2, Play, RotateCcw, Sparkles, WandSparkles,
} from "lucide-react";
import { useToast } from "../../../hooks/use-toast";
import { PODCAST_MODELS, studioProviderCostUsd, studioCreditsFromUsd } from "../../../../../shared/artist-studio-models";

type PodcastStyle = {
  id: string;
  name: string;
  descriptor: string;
  image: string;
  direction: string;
  accent: string;
};

type Song = {
  id?: string | number;
  title?: string;
  name?: string;
  genre?: string;
  mood?: string;
};

type ClipJob = {
  requestId: string;
  status: string;
  videoUrl?: string;
  error?: string;
  estimatedCredits?: number;
};

type PodcastClipsModuleProps = {
  artistId: number;
  isOwner?: boolean;
  artistName: string;
  artistProfileImage?: string;
  artistGenre?: string;
  artistBiography?: string;
  songs?: Song[];
};

const STYLES: PodcastStyle[] = [
  {
    id: "studio", name: "Mic Check", descriptor: "Warm · intimate",
    image: "/static-assets/podcast-styles/intimate-studio.webp",
    direction: "Intimate recording booth, warm walnut and amber light, close conversational framing",
    accent: "#f2a866",
  },
  {
    id: "backstage", name: "Green Room", descriptor: "Raw · backstage",
    image: "/static-assets/podcast-styles/backstage-documentary.webp",
    direction: "Candid backstage interview, road cases, cable textures and a subtle red stage glow",
    accent: "#f27772",
  },
  {
    id: "radio", name: "Late-Night Radio", descriptor: "Analog · nostalgic",
    image: "/static-assets/podcast-styles/retro-radio.webp",
    direction: "Vintage radio booth, analog mixing desk, reel-to-reel tape and rich amber tones",
    accent: "#d5a26b",
  },
  {
    id: "neon", name: "Neon Frequency", descriptor: "Urban · electric",
    image: "/static-assets/podcast-styles/neon-after-hours.webp",
    direction: "Sleek night-time set with cobalt and magenta neon, black glass and city reflections",
    accent: "#d478ff",
  },
  {
    id: "rooftop", name: "Rooftop Unfiltered", descriptor: "Open · cinematic",
    image: "/static-assets/podcast-styles/rooftop-session.webp",
    direction: "Golden-hour rooftop conversation with an open skyline and soft cinematic haze",
    accent: "#ffd08b",
  },
  {
    id: "editorial", name: "Editorial Sessions", descriptor: "Polished · refined",
    image: "/static-assets/podcast-styles/editorial-luxe.webp",
    direction: "High-end music editorial, sculptural stone, precise soft light and elegant negative space",
    accent: "#d9c8a6",
  },
  {
    id: "lofi", name: "Lo-Fi Listening Room", descriptor: "Soft · reflective",
    image: "/static-assets/podcast-styles/lofi-listening-room.webp",
    direction: "Quiet lo-fi listening nook, rainy window light, muted moss and tactile cassette textures",
    accent: "#a4c5a2",
  },
  {
    id: "street", name: "Street Mic", descriptor: "Spontaneous · direct",
    image: "/static-assets/podcast-styles/street-interview.webp",
    direction: "Spontaneous street interview outside an independent venue, vibrant bokeh and handheld energy",
    accent: "#ff9d71",
  },
  {
    id: "vinyl", name: "Vinyl Stories", descriptor: "Soulful · tactile",
    image: "/static-assets/podcast-styles/vinyl-stories.webp",
    direction: "Record-collector listening corner, vinyl shelves, walnut furniture and warm burgundy tones",
    accent: "#d58a7f",
  },
  {
    id: "future", name: "Future Signal", descriptor: "Experimental · digital",
    image: "/static-assets/podcast-styles/future-signal.webp",
    direction: "Elegant near-future podcast room, translucent light panels and restrained cyan-violet accents",
    accent: "#8fafff",
  },
];

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error || "Something went wrong. Please try again.");
  }
  return payload;
}

function PodcastClipCreator({
  artistId, artistName, artistProfileImage, artistGenre, artistBiography, songs = [],
}: PodcastClipsModuleProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [styleId, setStyleId] = useState(STYLES[0].id);
  const [idea, setIdea] = useState("");
  const [language, setLanguage] = useState("en");
  const [script, setScript] = useState("");
  const [modelId, setModelId] = useState("wan-3");
  const [busy, setBusy] = useState<"script" | "video" | "">("");
  const [job, setJob] = useState<ClipJob | null>(null);
  const selectedStyle = useMemo(() => STYLES.find((style) => style.id === styleId) || STYLES[0], [styleId]);
  const selectedModel = PODCAST_MODELS.find((model) => model.id === modelId) || PODCAST_MODELS[0];
  const estimatedCredits = studioCreditsFromUsd(studioProviderCostUsd(selectedModel, 30, script.length));
  const { data: estimate } = useQuery<{ credits: number }>({
    queryKey: ["/api/podcast-clips/estimate?model=" + modelId + "&characters=" + script.length],
    staleTime: 60_000,
  });

  useEffect(() => {
    if (job?.status === "COMPLETED") {
      queryClient.invalidateQueries({ queryKey: [`/api/podcast-clips/artists/${artistId}/clips`] });
    }
  }, [artistId, job?.status, queryClient]);

  useEffect(() => {
    if (!job?.requestId || job.status === "COMPLETED" || job.status === "FAILED") return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/podcast-clips/jobs/${encodeURIComponent(job.requestId)}`, { credentials: "include" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not check generation status.");
        setJob(payload.job);
      } catch (error) {
        setJob((current) => current ? { ...current, error: error instanceof Error ? error.message : "Could not check generation status." } : current);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [job?.requestId, job?.status]);

  const createScript = async () => {
    if (!Number.isFinite(artistId) || artistId <= 0) {
      toast({ title: "Artist profile unavailable", description: "Refresh your profile and try again.", variant: "destructive" });
      return;
    }
    setBusy("script");
    try {
      const payload = await postJson<{ script: string }>("/api/podcast-clips/script", { artistId, topic: idea, styleId, language });
      setScript(payload.script);
      toast({ title: "Concept ready", description: "Review the script and make it yours before rendering." });
    } catch (error) {
      toast({ title: "Could not create a script", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const generateClip = async () => {
    if (!script.trim()) {
      toast({ title: "Add a script first", description: "Generate a concept or write your own script.", variant: "destructive" });
      return;
    }
    setBusy("video");
    setJob(null);
    try {
      const payload = await postJson<{ job: ClipJob }>("/api/podcast-clips/generate", {
        artistId, styleId, topic: idea, language, script, duration: 30, resolution: "720p", modelId,
      });
      setJob(payload.job);
      toast({ title: "Your clip is in the studio", description: "Credits are charged for this generation and returned if it fails." });
    } catch (error) {
      toast({ title: "Could not start the clip", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const songNames = songs.map((song) => song.title || song.name).filter(Boolean).slice(0, 3) as string[];
  const creatorContext = [artistGenre, songNames.length ? `${songNames.length} tracks connected` : "Artist profile connected", artistBiography ? "Bio connected" : null]
    .filter(Boolean) as string[];

  return (
    <section className="relative isolate overflow-hidden rounded-[28px] border border-white/[0.09] bg-[#09090d] text-white shadow-[0_28px_80px_rgba(0,0,0,.36)]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-32 -top-40 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/[0.13] blur-[120px]" />
        <div className="absolute -bottom-40 left-1/4 h-72 w-72 rounded-full bg-orange-500/[0.09] blur-[100px]" />
      </div>

      <div className="relative border-b border-white/[0.07] px-5 py-6 sm:px-8 sm:py-8">
        <div className="absolute inset-0 -z-10 opacity-[0.19]" style={{ backgroundImage: `linear-gradient(90deg, #09090d 0%, rgba(9,9,13,.82) 47%, rgba(9,9,13,.34) 100%), url(${selectedStyle.image})`, backgroundPosition: "center, 70% 43%", backgroundSize: "cover" }} />
        <div className="grid items-end gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))" }}>
          <div className="max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.26em] text-fuchsia-200/85">
              <span className="grid h-7 w-7 place-items-center rounded-lg border border-fuchsia-200/20 bg-fuchsia-300/[0.09]"><Mic2 className="h-3.5 w-3.5" /></span>
              Boostify · Podcast Studio
            </div>
            <h2 className="max-w-xl text-3xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[42px]">Turn your world into a <span className="bg-gradient-to-r from-orange-200 via-pink-200 to-violet-200 bg-clip-text text-transparent">30-second story.</span></h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/60">Fresh podcast ideas shaped by your music, videos and artist identity. Choose a visual mood, refine the script, then create your clip.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-3 py-2.5 backdrop-blur-xl">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-white/10">
              {artistProfileImage ? <img src={artistProfileImage} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full w-full place-items-center text-sm font-semibold text-white/70">{artistName.slice(0, 1).toUpperCase()}</div>}
            </div>
            <div className="min-w-0"><p className="max-w-40 truncate text-sm font-semibold">{artistName}</p><p className="text-[11px] text-white/45">Artist context connected</p></div>
            <span className="ml-2 flex items-center gap-1.5 rounded-full border border-emerald-300/15 bg-emerald-300/[0.07] px-2.5 py-1 text-[10px] font-medium text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />LIVE</span>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {creatorContext.map((item) => <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/30 px-3 py-1.5 text-[11px] text-white/55"><Check className="h-3 w-3 text-emerald-300/80" />{item}</span>)}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/30 px-3 py-1.5 text-[11px] text-white/55"><Film className="h-3 w-3 text-violet-200/80" />Video direction connected</span>
        </div>
      </div>

      <div className="px-5 py-6 sm:px-8 sm:py-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.23em] text-white/35">01 / Visual direction</div><h3 className="text-lg font-semibold tracking-tight">Pick the world of your episode</h3></div>
          <span className="rounded-full border border-white/[0.09] bg-white/[0.035] px-3 py-1.5 text-[10px] font-medium text-white/45">10 original references</span>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 128px), 1fr))" }}>
          {STYLES.map((style, index) => {
            const selected = style.id === styleId;
            return <motion.button
              key={style.id}
              type="button"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setStyleId(style.id)}
              aria-pressed={selected}
              className={`group relative aspect-[1.3/1] overflow-hidden rounded-2xl border text-left transition-colors ${selected ? "border-white/65 ring-1 ring-white/60" : "border-white/[0.08] hover:border-white/25"}`}
              style={{ boxShadow: selected ? `0 0 0 3px ${style.accent}28, 0 12px 32px rgba(0,0,0,.3)` : undefined }}
            >
              <img src={style.image} alt={`${style.name} podcast style reference`} loading={index > 4 ? "lazy" : "eager"} className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/12 to-black/5" />
              <div className="absolute inset-x-0 bottom-0 p-3">
                <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.13em]" style={{ color: style.accent }}>{style.descriptor}</div>
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold leading-tight text-white sm:text-[13px]">{style.name}</span>{selected && <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-black"><Check className="h-3 w-3" /></span>}</div>
              </div>
            </motion.button>;
          })}
        </div>

        <div className="mt-7 grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3"><div><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">02 / Episode idea</div><h3 className="text-base font-semibold">Give it a starting point</h3></div><span className="grid h-9 w-9 place-items-center rounded-xl border border-orange-200/15 bg-orange-200/[0.06] text-orange-100"><Music2 className="h-4 w-4" /></span></div>
            <label className="mb-2 block text-xs font-medium text-white/60" htmlFor="podcast-clip-idea">Topic, song, story or fan question</label>
            <textarea id="podcast-clip-idea" value={idea} onChange={(event) => setIdea(event.target.value)} maxLength={500} placeholder="A story behind a track, a question from fans, a turning point…" className="min-h-28 w-full resize-y rounded-xl border border-white/[0.09] bg-black/30 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-fuchsia-200/40 focus:ring-2 focus:ring-fuchsia-300/10" />
            <div className="mt-4 flex items-center justify-between gap-3">
              <label className="sr-only" htmlFor="podcast-clip-language">Script language</label>
              <select id="podcast-clip-language" value={language} onChange={(event) => setLanguage(event.target.value)} className="h-10 rounded-xl border border-white/[0.09] bg-[#111116] px-3 text-xs text-white/75 outline-none focus:border-fuchsia-200/40"><option value="en">English</option><option value="es">Spanish</option><option value="pt">Portuguese</option></select>
              <button type="button" onClick={createScript} disabled={!!busy} className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-orange-200 via-pink-200 to-violet-200 px-4 text-xs font-bold text-[#171015] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
                {busy === "script" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
                Build my concept
              </button>
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-white/[0.035] px-3 py-2.5 text-[11px] leading-5 text-white/45"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fuchsia-200/75" />The concept uses available profile details, songs and video projects. You can edit every line before generation.</div>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3"><div><div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">03 / Script & render</div><h3 className="text-base font-semibold">Make the story yours</h3></div><div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/15 bg-violet-200/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-violet-100/80"><Clapperboard className="h-3 w-3" />{selectedModel.name}</div></div>
            <label className="sr-only" htmlFor="podcast-clip-script">Podcast clip script</label>
            <textarea id="podcast-clip-script" value={script} onChange={(event) => setScript(event.target.value)} maxLength={1200} placeholder="Your 30-second script will appear here. Build a concept or write your own…" className="min-h-36 w-full resize-y rounded-xl border border-white/[0.09] bg-black/30 px-3.5 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/25 focus:border-fuchsia-200/40 focus:ring-2 focus:ring-fuchsia-300/10" />
            <label htmlFor="podcast-clip-model" className="mb-2 mt-3 block text-xs font-medium text-white/60">Video model</label>
            <select id="podcast-clip-model" value={modelId} onChange={(event) => setModelId(event.target.value)} className="h-11 w-full rounded-xl border border-white/[0.09] bg-[#111116] px-3 text-xs text-white/80 outline-none focus:border-fuchsia-200/40">
              {PODCAST_MODELS.map((model) => <option key={model.id} value={model.id}>{model.name} — {model.note}</option>)}
            </select>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-white/45"><CircleDollarSign className="h-3.5 w-3.5 text-amber-200/80" />{(estimate?.credits ?? estimatedCredits).toLocaleString("en-US")} credits · 30s · 3× provider cost</div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-[11px] text-white/45"><CircleDollarSign className="h-3.5 w-3.5 text-amber-200/80" />Estimated {estimate?.credits?.toLocaleString("en-US") ?? "—"} credits · 30s · 720p</div>
              <button type="button" onClick={generateClip} disabled={!!busy || !script.trim()} className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/15 bg-white px-4 text-xs font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40">
                {busy === "video" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                Generate 30-second clip
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {job && <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-5 overflow-hidden rounded-2xl border border-white/[0.09] bg-black/30 p-4 sm:p-5" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className={`grid h-9 w-9 place-items-center rounded-xl ${job.status === "COMPLETED" ? "bg-emerald-300/10 text-emerald-200" : job.status === "FAILED" ? "bg-red-300/10 text-red-200" : "bg-fuchsia-300/10 text-fuchsia-100"}`}>{job.status === "COMPLETED" ? <Check className="h-4 w-4" /> : job.status === "FAILED" ? <RotateCcw className="h-4 w-4" /> : <LoaderCircle className="h-4 w-4 animate-spin" />}</span><div><p className="text-sm font-semibold">{job.status === "COMPLETED" ? "Your clip is ready" : job.status === "FAILED" ? "This render didn’t finish" : "Building your episode"}</p><p className="text-xs text-white/45">{job.status === "COMPLETED" ? "Preview and download your generated video." : job.status === "FAILED" ? "Credits are returned automatically when generation fails." : "Fal is rendering your 30-second visual."}</p></div></div>{job.estimatedCredits ? <span className="text-[11px] text-white/40">{job.estimatedCredits.toLocaleString("en-US")} credits</span> : null}</div>
            {job.error && <p className="mt-3 text-xs text-red-200">{job.error}</p>}
            {job.videoUrl && <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"><video src={job.videoUrl} controls playsInline className="max-h-[440px] w-full rounded-xl bg-black sm:max-w-sm" /><a href={job.videoUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06]"><Download className="h-3.5 w-3.5" />Download clip</a></div>}
          </motion.div>}
        </AnimatePresence>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-3.5 sm:px-8">
        <p className="text-[10px] text-white/35">Style images are visual references only; generated clips follow your artist identity.</p>
        <p className="text-[10px] text-white/35">30 sec · Vertical 9:16 · {selectedStyle.name}</p>
      </div>
    </section>
  );
}

type PublishedPodcastClip = {
  id: string;
  title: string;
  videoUrl: string;
  posterUrl?: string;
  styleId: string;
  duration: number;
  createdAt: string | null;
};

export default function PodcastClipsModule(props: PodcastClipsModuleProps) {
  const { artistId, artistName, isOwner = false } = props;
  const feedUrl = `/api/podcast-clips/artists/${artistId}/clips`;
  const { data, isError, refetch } = useQuery<{ clips: PublishedPodcastClip[] }>({
    queryKey: [feedUrl],
    enabled: Number.isInteger(artistId) && artistId > 0,
    queryFn: async () => {
      const response = await fetch(feedUrl, { credentials: "omit" });
      if (!response.ok) throw new Error("Could not load podcast episodes.");
      return response.json();
    },
    staleTime: 30_000,
  });
  const clips = data?.clips || [];

  if (!isOwner && clips.length === 0) return null;

  return (
    <div className="space-y-5">
      {isOwner && <PodcastClipCreator {...props} />}
      {clips.length > 0 && (
        <section aria-label="Podcast episodes" className="overflow-hidden rounded-[28px] border border-white/10 bg-[#09090d] p-5 text-white sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-fuchsia-300/10 text-fuchsia-200"><Mic2 className="h-5 w-5" /></span>
            <div><h2 className="text-xl font-semibold tracking-tight">Podcast Episodes</h2><p className="text-sm text-white/50">Short stories from {artistName}.</p></div>
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
            {clips.map((clip) => (
              <article key={clip.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                <video controls playsInline preload="metadata" poster={clip.posterUrl} aria-label={clip.title} className="aspect-[9/16] max-h-[480px] w-full bg-black object-contain">
                  <source src={clip.videoUrl} type="video/mp4" />
                  Your browser does not support video playback.
                </video>
                <div className="p-4"><h3 className="text-sm font-semibold">{clip.title}</h3><p className="mt-1 text-xs text-white/45">{clip.duration} sec · {STYLES.find((style) => style.id === clip.styleId)?.name || "Podcast"}</p></div>
              </article>
            ))}
          </div>
        </section>
      )}
      {isOwner && clips.length === 0 && !isError && <p className="px-3 text-xs text-white/50">Completed podcast clips appear here automatically for visitors to your profile.</p>}
      {isOwner && isError && <div className="flex items-center gap-3 px-3 text-xs text-white/60"><span>Could not load your podcast episodes.</span><button type="button" onClick={() => refetch()} className="underline underline-offset-4">Try again</button></div>}
    </div>
  );
}
