import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Slider } from "../ui/slider";
import { Textarea } from "../ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import {
  Loader2, Mic, Download, Waves, Music, Split,
  AudioLines, Wand2, Play, Pause, Upload, Headphones,
  Zap, Layers, Volume2, Star, ChevronRight, Clock,
  FileAudio, MicVocal, Sparkles, Radio, Guitar, Drum,
  Piano, Music2, CheckCircle2, AlertCircle
} from "lucide-react";
import { uploadAudioFile } from "../../lib/firebase-storage";
import { auth } from "../../firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { apiRequest } from "@/lib/queryClient";

// ─── Hero images (Unsplash free) ──────────────────────────────────────────────
const HERO_IMAGES = {
  stems:     "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=800&q=80",
  voice:     "https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&q=80",
  beat:      "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=800&q=80",
  transcribe:"https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
  cloneVoice:"https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&q=80",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = "stems" | "voice-clone" | "beat" | "transcribe" | "history";

interface StemResult {
  vocals: string | null;
  drums: string | null;
  bass: string | null;
  other: string | null;
}

interface HistoryItem {
  id: string;
  type: Tab;
  label: string;
  audioUrl?: string;
  result?: any;
  createdAt: Date;
}

// ─── Small reusable audio player ─────────────────────────────────────────────
function AudioPlayer({ url, label }: { url: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if (!ref.current) return;
    if (playing) { ref.current.pause(); setPlaying(false); }
    else { ref.current.play(); setPlaying(true); }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onEnd = () => setPlaying(false);
    el.addEventListener("ended", onEnd);
    return () => el.removeEventListener("ended", onEnd);
  }, []);

  return (
    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
      <Button size="icon" variant="ghost"
        className="h-9 w-9 rounded-full bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 flex-shrink-0"
        onClick={toggle}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{url.split("/").pop()?.split("?")[0]}</p>
      </div>
      <a href={url} download className="text-muted-foreground hover:text-orange-400 transition-colors">
        <Download className="w-4 h-4" />
      </a>
      <audio ref={ref} src={url} preload="none" />
    </div>
  );
}

// ─── Tool card ────────────────────────────────────────────────────────────────
function ToolCard({
  icon: Icon, title, description, badge, image, active, onClick
}: {
  icon: any; title: string; description: string; badge?: string;
  image: string; active: boolean; onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl text-left transition-all duration-200 border ${
        active
          ? "border-orange-500/60 ring-1 ring-orange-500/30 bg-zinc-900"
          : "border-white/5 bg-zinc-900/50 hover:border-white/15"
      }`}
    >
      <div className="relative h-28 overflow-hidden">
        <img src={image} alt={title} className="w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-zinc-900" />
        {badge && (
          <Badge className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] px-1.5 py-0.5">
            {badge}
          </Badge>
        )}
        {active && (
          <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`w-3.5 h-3.5 ${active ? "text-orange-400" : "text-muted-foreground"}`} />
          <span className={`text-sm font-semibold ${active ? "text-orange-400" : "text-white"}`}>{title}</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">{description}</p>
      </div>
    </motion.button>
  );
}

// ─── File Upload Zone ─────────────────────────────────────────────────────────
function UploadZone({
  label, hint, onChange, file, accept = "audio/*"
}: {
  label: string; hint?: string; onChange: (f: File | null) => void;
  file: File | null; accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
        file
          ? "border-orange-500/40 bg-orange-500/5"
          : "border-white/10 hover:border-white/25 bg-white/2.5"
      }`}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => onChange(e.target.files?.[0] || null)} />
      {file ? (
        <div className="flex items-center gap-3 justify-center">
          <FileAudio className="w-6 h-6 text-orange-400 flex-shrink-0" />
          <div className="text-left">
            <p className="text-sm font-medium text-orange-400 truncate max-w-48">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-orange-400 flex-shrink-0" />
        </div>
      ) : (
        <>
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {hint && <p className="text-xs text-muted-foreground/60 mt-1">{hint}</p>}
        </>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function AudioMastering() {
  const { toast } = useToast();
  const [user] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState<Tab>("stems");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // ── Stems state
  const [stemsFile, setStemsFile] = useState<File | null>(null);
  const [stemResult, setStemResult] = useState<StemResult | null>(null);
  const [stemsModel, setStemsModel] = useState<"htdemucs" | "htdemucs_ft" | "mdx_extra">("htdemucs");

  // ── Voice clone state
  const [cloneRefFile, setCloneRefFile] = useState<File | null>(null);
  const [cloneRefText, setCloneRefText] = useState("");
  const [cloneGenText, setCloneGenText] = useState("");
  const [cloneResult, setCloneResult] = useState<string | null>(null);

  // ── Beat generation state
  const [beatPrompt, setBeatPrompt] = useState("");
  const [beatSeconds, setBeatSeconds] = useState(30);
  const [beatResult, setBeatResult] = useState<string | null>(null);

  // ── Transcription state
  const [transcribeFile, setTranscribeFile] = useState<File | null>(null);
  const [transcribeText, setTranscribeText] = useState<string | null>(null);
  const [transcribeChunks, setTranscribeChunks] = useState<any[]>([]);

  // ─── Upload helper
  async function uploadFile(file: File): Promise<string> {
    if (user?.uid) {
      return uploadAudioFile(file, "mastering", user.uid);
    }
    // fallback: convert to object URL for demo
    return URL.createObjectURL(file);
  }

  // ─── Stem separation
  const handleSeparateStems = async () => {
    if (!stemsFile) { toast({ title: "Upload an audio file first", variant: "destructive" }); return; }
    setBusy(true); setProgress(10); setStemResult(null);
    try {
      toast({ title: "⏳ Uploading file…" });
      const audioUrl = await uploadFile(stemsFile);
      setProgress(35);
      toast({ title: "🎚️ Separating stems with FAL Demucs…" });
      const data = await apiRequest("/api/mastering/separate-stems", {
        method: "POST",
        body: JSON.stringify({ audioUrl, model: stemsModel }),
      });
      setProgress(100);
      setStemResult(data.stems);
      addHistory("stems", stemsFile.name, undefined, data.stems);
      toast({ title: "✅ Stems separated!", description: "Vocals, drums, bass & other are ready." });
    } catch (err: any) {
      toast({ title: "Stem separation failed", description: err.message, variant: "destructive" });
    } finally { setBusy(false); setProgress(0); }
  };

  // ─── Beat generation
  const handleGenerateBeat = async () => {
    if (!beatPrompt.trim()) { toast({ title: "Enter a beat prompt first", variant: "destructive" }); return; }
    setBusy(true); setProgress(20); setBeatResult(null);
    try {
      toast({ title: "🥁 Generating beat with Stable Audio…" });
      const data = await apiRequest("/api/mastering/generate-beat", {
        method: "POST",
        body: JSON.stringify({ prompt: beatPrompt, seconds: beatSeconds }),
      });
      setProgress(100);
      setBeatResult(data.audioUrl);
      addHistory("beat", beatPrompt.slice(0, 40), data.audioUrl);
      toast({ title: "✅ Beat generated!" });
    } catch (err: any) {
      toast({ title: "Beat generation failed", description: err.message, variant: "destructive" });
    } finally { setBusy(false); setProgress(0); }
  };

  // ─── Voice clone
  const handleCloneVoice = async () => {
    if (!cloneRefFile) { toast({ title: "Upload a reference voice file", variant: "destructive" }); return; }
    if (!cloneGenText.trim()) { toast({ title: "Enter text to generate", variant: "destructive" }); return; }
    setBusy(true); setProgress(15); setCloneResult(null);
    try {
      toast({ title: "⏳ Uploading reference audio…" });
      const refAudioUrl = await uploadFile(cloneRefFile);
      setProgress(40);
      toast({ title: "🎤 Cloning voice with F5-TTS…" });
      const data = await apiRequest("/api/mastering/clone-voice", {
        method: "POST",
        body: JSON.stringify({ refAudioUrl, refText: cloneRefText, genText: cloneGenText }),
      });
      setProgress(100);
      setCloneResult(data.audioUrl);
      addHistory("voice-clone", cloneGenText.slice(0, 40), data.audioUrl);
      toast({ title: "✅ Voice cloned successfully!" });
    } catch (err: any) {
      toast({ title: "Voice cloning failed", description: err.message, variant: "destructive" });
    } finally { setBusy(false); setProgress(0); }
  };

  // ─── Transcription
  const handleTranscribe = async () => {
    if (!transcribeFile) { toast({ title: "Upload an audio file first", variant: "destructive" }); return; }
    setBusy(true); setProgress(15); setTranscribeText(null); setTranscribeChunks([]);
    try {
      toast({ title: "⏳ Uploading file…" });
      const audioUrl = await uploadFile(transcribeFile);
      setProgress(40);
      toast({ title: "📝 Transcribing with Whisper v3…" });
      const data = await apiRequest("/api/mastering/transcribe", {
        method: "POST",
        body: JSON.stringify({ audioUrl }),
      });
      setProgress(100);
      setTranscribeText(data.text);
      setTranscribeChunks(data.chunks || []);
      addHistory("transcribe", transcribeFile.name, undefined, { text: data.text });
      toast({ title: "✅ Transcription complete!" });
    } catch (err: any) {
      toast({ title: "Transcription failed", description: err.message, variant: "destructive" });
    } finally { setBusy(false); setProgress(0); }
  };

  function addHistory(type: Tab, label: string, audioUrl?: string, result?: any) {
    setHistory(prev => [
      { id: crypto.randomUUID(), type, label, audioUrl, result, createdAt: new Date() },
      ...prev.slice(0, 19),
    ]);
  }

  // ─── Beat prompt presets
  const BEAT_PRESETS = [
    "Trap beat 140 BPM, 808 bass, hi-hats rolling",
    "Lo-fi hip hop chill, jazz chords, soft drums",
    "Deep house 124 BPM, four-on-floor kick, soulful chords",
    "Latin reggaeton beat, dembow pattern, brass stabs",
    "Drill beat 140 BPM, sliding 808, dark melody",
    "R&B smooth ballad, live drums, warm bass",
  ];

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-500/10 via-background to-purple-600/10 border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.12),transparent_70%)]" />
        <div className="container mx-auto px-4 py-10 relative">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1 space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20">
                <Radio className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
                <span className="text-xs font-medium text-orange-400">AI Audio Suite — Powered by FAL AI</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-orange-100 to-orange-400">
                Audio Production Suite
              </h1>
              <p className="text-sm md:text-base text-muted-foreground max-w-xl">
                Professional AI-powered audio tools. Separate stems, clone voices, generate beats, and transcribe lyrics — all in one place.
              </p>
              <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
                {[
                  { icon: Split, label: "Demucs Stem Separation" },
                  { icon: MicVocal, label: "F5-TTS Voice Clone" },
                  { icon: Drum, label: "Stable Audio Beats" },
                  { icon: FileAudio, label: "Whisper v3 Transcribe" },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-orange-400" />
                    <span>{label}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="hidden lg:flex gap-3">
              {[HERO_IMAGES.stems, HERO_IMAGES.voice, HERO_IMAGES.beat].map((src, i) => (
                <div key={i} className="w-24 h-24 rounded-2xl overflow-hidden border border-white/10 opacity-80"
                  style={{ transform: `rotate(${[-3, 1, -2][i]}deg)` }}>
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tool grid ──────────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 pt-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ToolCard icon={Split}     title="Stem Separation" description="Isolate vocals, drums, bass & more"
            badge="FAL Demucs" image={HERO_IMAGES.stems}      active={activeTab === "stems"}        onClick={() => setActiveTab("stems")} />
          <ToolCard icon={MicVocal}  title="Voice Clone"     description="Synthesize speech with any voice"
            badge="F5-TTS"     image={HERO_IMAGES.cloneVoice} active={activeTab === "voice-clone"}  onClick={() => setActiveTab("voice-clone")} />
          <ToolCard icon={Drum}      title="Beat Generator"  description="Text-to-audio beat generation"
            badge="Stable Audio" image={HERO_IMAGES.beat}     active={activeTab === "beat"}         onClick={() => setActiveTab("beat")} />
          <ToolCard icon={FileAudio} title="Transcribe"      description="Extract lyrics with timestamps"
            badge="Whisper v3"  image={HERO_IMAGES.transcribe} active={activeTab === "transcribe"}  onClick={() => setActiveTab("transcribe")} />
        </div>

        {/* ─── Progress bar ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {busy && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="bg-zinc-900 border border-white/5 rounded-2xl p-4 flex items-center gap-4">
              <Loader2 className="w-5 h-5 text-orange-400 animate-spin flex-shrink-0" />
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-orange-400 font-medium">Processing with FAL AI…</span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Panel ──────────────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {/* ══ STEM SEPARATION ══ */}
          {activeTab === "stems" && (
            <motion.div key="stems" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="grid md:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                    <Split className="w-5 h-5 text-orange-400" /> Stem Separation
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Split any mixed audio into individual stems using Facebook's Demucs model. Get clean vocals, drums, bass and other instruments separately.
                  </p>
                </div>

                <UploadZone label="Drop your audio file here" hint="WAV, MP3, FLAC · max 100 MB"
                  file={stemsFile} onChange={setStemsFile} />

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model Quality</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: "htdemucs", label: "HTDemucs", sub: "Fast · Good" },
                      { id: "htdemucs_ft", label: "Fine-tuned", sub: "Balanced" },
                      { id: "mdx_extra", label: "MDX Extra", sub: "Best quality" },
                    ] as const).map(m => (
                      <button key={m.id} onClick={() => setStemsModel(m.id)}
                        className={`rounded-xl border p-2 text-center transition-all ${
                          stemsModel === m.id
                            ? "border-orange-500/60 bg-orange-500/10 text-orange-400"
                            : "border-white/8 bg-white/3 text-muted-foreground hover:border-white/20"
                        }`}>
                        <p className="text-xs font-semibold">{m.label}</p>
                        <p className="text-[10px] opacity-70">{m.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleSeparateStems} disabled={busy || !stemsFile}
                  className="w-full h-11 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 font-semibold">
                  {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Separating…</> : <><Split className="w-4 h-4 mr-2" /> Separate Stems</>}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="relative h-52 rounded-2xl overflow-hidden border border-white/5">
                  <img src={HERO_IMAGES.stems} alt="stems" className="w-full h-full object-cover opacity-50" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    {[
                      { icon: MicVocal, label: "Vocals", color: "text-orange-400" },
                      { icon: Drum, label: "Drums", color: "text-blue-400" },
                      { icon: AudioLines, label: "Bass", color: "text-purple-400" },
                      { icon: Music2, label: "Other", color: "text-green-400" },
                    ].map(({ icon: Icon, label, color }) => (
                      <div key={label} className="flex items-center gap-2 bg-black/60 rounded-full px-4 py-1.5">
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                        <span className={`text-xs font-medium ${color}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {stemResult && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                    <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Stems Ready
                    </h3>
                    {[
                      { key: "vocals", label: "🎤 Vocals", icon: MicVocal },
                      { key: "drums", label: "🥁 Drums", icon: Drum },
                      { key: "bass", label: "🎸 Bass", icon: AudioLines },
                      { key: "other", label: "🎹 Other", icon: Music2 },
                    ].map(({ key, label }) => {
                      const url = (stemResult as any)[key];
                      return url ? <AudioPlayer key={key} url={url} label={label} /> : null;
                    })}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* ══ VOICE CLONE ══ */}
          {activeTab === "voice-clone" && (
            <motion.div key="voice-clone" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="grid md:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                    <MicVocal className="w-5 h-5 text-orange-400" /> Voice Clone
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Clone any voice from a reference audio clip and synthesize new speech using F5-TTS. Perfect for AI vocals, dubbing, and creative content.
                  </p>
                </div>

                <UploadZone label="Reference voice audio" hint="3–30 seconds of clear speech · WAV or MP3"
                  file={cloneRefFile} onChange={setCloneRefFile} />

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reference transcript (optional)</Label>
                  <Input value={cloneRefText} onChange={e => setCloneRefText(e.target.value)}
                    placeholder="What is being said in the reference clip…"
                    className="bg-zinc-900 border-white/10 focus:border-orange-500/50" />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Text to synthesize *</Label>
                  <Textarea value={cloneGenText} onChange={e => setCloneGenText(e.target.value)} rows={3}
                    placeholder="Enter the text you want spoken in the cloned voice…"
                    className="bg-zinc-900 border-white/10 focus:border-orange-500/50 resize-none" />
                  <p className="text-xs text-muted-foreground">{cloneGenText.length} / 1000</p>
                </div>

                <Button onClick={handleCloneVoice} disabled={busy || !cloneRefFile || !cloneGenText.trim()}
                  className="w-full h-11 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 font-semibold">
                  {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Cloning…</> : <><MicVocal className="w-4 h-4 mr-2" /> Clone Voice</>}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="relative h-52 rounded-2xl overflow-hidden border border-white/5">
                  <img src={HERO_IMAGES.cloneVoice} alt="voice" className="w-full h-full object-cover opacity-50" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
                    <MicVocal className="w-10 h-10 text-orange-400 opacity-80" />
                    <p className="text-sm font-semibold">F5-TTS Voice Cloning</p>
                    <p className="text-xs text-muted-foreground">Any voice, any text. Zero-shot voice clone in seconds.</p>
                  </div>
                </div>

                {cloneResult && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                    <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Cloned Voice Ready
                    </h3>
                    <AudioPlayer url={cloneResult} label="🎤 Cloned Voice Output" />
                  </motion.div>
                )}

                <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">How it works</p>
                  {[
                    "Upload 3–30s of reference voice",
                    "F5-TTS extracts voice characteristics",
                    "Synthesize any text in that voice",
                    "Download the generated audio",
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0 text-[10px] font-bold">
                        {i + 1}
                      </span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ BEAT GENERATOR ══ */}
          {activeTab === "beat" && (
            <motion.div key="beat" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="grid md:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                    <Drum className="w-5 h-5 text-orange-400" /> Beat Generator
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Generate professional beats and instrumentals from a text description using Stable Audio. From trap to classical — any genre in seconds.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Beat Description *</Label>
                  <Textarea value={beatPrompt} onChange={e => setBeatPrompt(e.target.value)} rows={3}
                    placeholder="e.g. Trap beat 140 BPM, 808 bass, dark melody, hi-hat rolls…"
                    className="bg-zinc-900 border-white/10 focus:border-orange-500/50 resize-none" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</Label>
                    <span className="text-xs text-orange-400 font-semibold">{beatSeconds}s</span>
                  </div>
                  <Slider min={5} max={90} step={5} value={[beatSeconds]} onValueChange={v => setBeatSeconds(v[0])}
                    className="py-2" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>5s</span><span>30s</span><span>60s</span><span>90s</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Presets</Label>
                  <div className="flex flex-wrap gap-2">
                    {BEAT_PRESETS.map(p => (
                      <button key={p} onClick={() => setBeatPrompt(p)}
                        className="text-[11px] px-3 py-1 rounded-full bg-white/5 border border-white/8 hover:border-orange-500/40 hover:text-orange-400 transition-all truncate max-w-44">
                        {p.split(",")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleGenerateBeat} disabled={busy || !beatPrompt.trim()}
                  className="w-full h-11 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 font-semibold">
                  {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating…</> : <><Drum className="w-4 h-4 mr-2" /> Generate Beat</>}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="relative h-52 rounded-2xl overflow-hidden border border-white/5">
                  <img src={HERO_IMAGES.beat} alt="beat" className="w-full h-full object-cover opacity-50" />
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-purple-500/20 flex items-center justify-center">
                    <div className="flex items-end gap-1">
                      {Array.from({ length: 20 }, (_, i) => (
                        <div key={i} className="w-1.5 bg-orange-400/60 rounded-full animate-pulse"
                          style={{ height: `${20 + Math.random() * 50}px`, animationDelay: `${i * 0.05}s` }} />
                      ))}
                    </div>
                  </div>
                </div>

                {beatResult && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                    <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Beat Ready
                    </h3>
                    <AudioPlayer url={beatResult} label={`🥁 ${beatPrompt.slice(0, 40)}…`} />
                  </motion.div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Zap, title: "AI-Powered", desc: "Stable Audio model" },
                    { icon: Clock, title: "Up to 90s", desc: "Full tracks" },
                    { icon: Music2, title: "Any Genre", desc: "Trap, house, jazz…" },
                    { icon: Download, title: "Royalty-Free", desc: "Use commercially" },
                  ].map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="bg-zinc-900 border border-white/5 rounded-xl p-3 flex items-start gap-2">
                      <Icon className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold">{title}</p>
                        <p className="text-[10px] text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* ══ TRANSCRIBE ══ */}
          {activeTab === "transcribe" && (
            <motion.div key="transcribe" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="grid md:grid-cols-2 gap-6">
              <div className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                    <FileAudio className="w-5 h-5 text-orange-400" /> Transcribe Audio
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Extract lyrics and transcriptions from any audio using OpenAI Whisper Large v3. Get word-level timestamps perfect for lyric videos.
                  </p>
                </div>

                <UploadZone label="Drop your audio or song here" hint="WAV, MP3, M4A, FLAC · max 100 MB"
                  file={transcribeFile} onChange={setTranscribeFile} />

                <Button onClick={handleTranscribe} disabled={busy || !transcribeFile}
                  className="w-full h-11 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 font-semibold">
                  {busy ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Transcribing…</> : <><FileAudio className="w-4 h-4 mr-2" /> Transcribe</>}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="relative h-52 rounded-2xl overflow-hidden border border-white/5">
                  <img src={HERO_IMAGES.transcribe} alt="transcribe" className="w-full h-full object-cover opacity-40" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
                    <FileAudio className="w-10 h-10 text-orange-400 opacity-80" />
                    <p className="text-sm font-semibold">Whisper Large v3</p>
                    <p className="text-xs text-muted-foreground text-center">99+ languages · Word timestamps · 99% accuracy</p>
                  </div>
                </div>

                {transcribeText && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Transcription Complete
                    </h3>
                    <div className="bg-zinc-900 border border-white/8 rounded-2xl p-4 max-h-64 overflow-y-auto">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{transcribeText}</p>
                    </div>
                    {transcribeChunks.length > 0 && (
                      <div className="bg-zinc-900 border border-white/5 rounded-2xl p-4 max-h-48 overflow-y-auto space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Timestamps</p>
                        {transcribeChunks.slice(0, 30).map((c: any, i: number) => (
                          <div key={i} className="flex gap-3 text-xs">
                            <span className="text-orange-400 font-mono flex-shrink-0 w-16">
                              {c.timestamp?.[0] != null ? `${c.timestamp[0].toFixed(1)}s` : "–"}
                            </span>
                            <span className="text-muted-foreground">{c.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="w-full border-white/10"
                      onClick={() => { const blob = new Blob([transcribeText], { type: "text/plain" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "transcription.txt"; a.click(); }}>
                      <Download className="w-4 h-4 mr-2" /> Download .txt
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── History ─────────────────────────────────────────────────────── */}
        {history.length > 0 && (
          <div className="pt-4 border-t border-white/5 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-400" /> Recent Results
            </h3>
            <div className="grid md:grid-cols-2 gap-2">
              {history.slice(0, 6).map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-zinc-900/60 border border-white/5 rounded-xl px-4 py-2.5">
                  <Badge variant="outline" className="text-[10px] border-white/10 capitalize">{item.type.replace("-", " ")}</Badge>
                  <span className="text-xs text-muted-foreground truncate flex-1">{item.label}</span>
                  {item.audioUrl && (
                    <a href={item.audioUrl} download className="text-muted-foreground hover:text-orange-400">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {item.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}