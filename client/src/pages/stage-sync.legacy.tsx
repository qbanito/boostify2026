// ────────────────────────────────────────────────────────────────────
// Boostify StageSync AI — Live Show Production Module (frontend)
// ────────────────────────────────────────────────────────────────────
// Premium dark UI for designing, generating and operating live shows.
// All UI text in English by design.
// ────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Boxes, Cable, Camera, Cog, Cpu,
  Download, Drum, Film, FlaskConical, Gauge, GitBranch, Layers,
  Library, ListMusic, Loader2, Maximize2, Megaphone, Monitor,
  MoreHorizontal, Music, Pause, Play, Plus, Power, Radio, Rocket,
  Settings2, Sliders, Sparkles, Target, Trash2, Tv2, Wand2, Wifi, Workflow, Zap,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ScrollArea } from "../components/ui/scroll-area";
import { Skeleton } from "../components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Progress } from "../components/ui/progress";
import { useToast } from "../hooks/use-toast";
import { apiRequest } from "../lib/queryClient";

// ── Types ──────────────────────────────────────────────────────
interface ShowSummary {
  id: string;
  show_id?: string;
  show_title?: string;
  artist_name?: string;
  status?: string;
  updatedAt?: any;
  createdAt?: any;
}

interface ShowSong {
  position: number;
  song_title: string;
  duration: string;
  bpm: number;
  mood: string;
  visual_scene?: { intro?: string; verse?: string; chorus?: string; bridge?: string; final?: string };
  cue_points?: Array<{ at: string; action: string }>;
  fallback_visual?: string;
  technical_notes?: string;
}

interface ShowFull {
  show: any;
  songs: any[];
  setlist: ShowSong[];
  visualAssets: any[];
  cueTimeline: any[];
  technicalExports: any[];
  liveSessions: any[];
  devices: any[];
}

interface ShowTemplate {
  id: string;
  name: string;
  description: string;
  defaultDuration: number;
  defaultVibe: string;
  defaultPalette: string[];
}

// ── Indicator Pill ─────────────────────────────────────────────
function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; dot: string }> = {
    ready:    { label: "Ready",     cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
    playing:  { label: "Playing",   cls: "bg-orange-500/10 text-orange-400 border-orange-500/30",     dot: "bg-orange-400 animate-pulse" },
    next_cue: { label: "Next Cue",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/30",        dot: "bg-amber-400" },
    error:    { label: "Error",     cls: "bg-red-500/10 text-red-400 border-red-500/30",              dot: "bg-red-400" },
    fallback: { label: "Fallback",  cls: "bg-violet-500/10 text-violet-400 border-violet-500/30",    dot: "bg-violet-400" },
    draft:    { label: "Draft",     cls: "bg-zinc-700/40 text-zinc-300 border-zinc-600/40",          dot: "bg-zinc-400" },
  };
  const k = (status || "draft").toLowerCase().replace(/\s/g, "_");
  const m = map[k] || map.draft;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${m.cls}`}>
      <span className={`h-2 w-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ── Hero ───────────────────────────────────────────────────────
function Hero({ onCreateShow }: { onCreateShow: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-orange-500/20 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_theme(colors.orange.500/20),_transparent_60%)]" />
      <div className="relative p-8 md:p-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-300">
            Boostify · Live Production AI
          </div>
          <Badge variant="outline" className="border-orange-500/40 text-orange-300">v1.0</Badge>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white">
          Stage<span className="text-orange-500">Sync</span> AI
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-300">
          Design, rehearse and operate cinematic live shows — setlists, visuals, cue timelines and
          technical exports for Resolume · TouchDesigner · MIDI · OSC · SMPTE · Art-Net · Ableton Link.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" onClick={onCreateShow} className="bg-orange-500 text-black hover:bg-orange-400">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Show JSON
          </Button>
          <Button size="lg" variant="outline" className="border-zinc-700 text-zinc-200 hover:bg-zinc-800">
            <Film className="mr-2 h-4 w-4" />
            Watch Demo
          </Button>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { icon: ListMusic, label: "AI Setlist Architect" },
            { icon: Wand2, label: "Visual Identity Engine" },
            { icon: Workflow, label: "Cue Timeline Compiler" },
            { icon: Cable, label: "Multi-Protocol Sync" },
          ].map((f) => (
            <div key={f.label} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <f.icon className="h-5 w-5 text-orange-400" />
              <div className="mt-2 text-sm font-medium text-zinc-200">{f.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Show Dashboard ─────────────────────────────────────────────
function ShowDashboard({
  shows, isLoading, onSelect, onCreate,
}: {
  shows: ShowSummary[];
  isLoading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Library className="h-5 w-5 text-orange-400" /> Show Dashboard
        </CardTitle>
        <Button size="sm" onClick={onCreate} className="bg-orange-500 text-black hover:bg-orange-400">
          <Plus className="mr-1 h-4 w-4" /> New Show
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full bg-zinc-800/60" />)}
          </div>
        ) : shows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center text-zinc-400">
            No shows yet. Click <span className="text-orange-300">New Show</span> to design your first live experience.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {shows.map((s) => (
              <motion.button
                key={s.id}
                whileHover={{ y: -2 }}
                onClick={() => onSelect(s.id)}
                className="group rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4 text-left hover:border-orange-500/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-zinc-500">SHOW</span>
                  <StatusPill status={s.status || "draft"} />
                </div>
                <div className="mt-3 truncate text-base font-semibold text-zinc-100">
                  {s.show_title || "Untitled Show"}
                </div>
                <div className="text-sm text-zinc-400">{s.artist_name || "—"}</div>
                <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500 group-hover:text-orange-300">
                  Open <Cog className="h-3 w-3" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Repertoire Manager (songs library) ─────────────────────────
function RepertoireManager({ show }: { show: ShowFull | null }) {
  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Music className="h-5 w-5 text-orange-400" /> Repertoire Manager
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!show ? (
          <p className="text-sm text-zinc-400">Select or create a show to manage its repertoire.</p>
        ) : (
          <ScrollArea className="h-72 pr-2">
            <div className="space-y-2">
              {(show.setlist || []).map((s) => (
                <div key={s.position} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500/15 text-sm font-semibold text-orange-300">
                      {s.position}
                    </span>
                    <div>
                      <div className="font-medium text-zinc-100">{s.song_title}</div>
                      <div className="text-xs text-zinc-500">{s.duration} · {s.bpm} BPM · {s.mood}</div>
                    </div>
                  </div>
                </div>
              ))}
              {(!show.setlist || show.setlist.length === 0) && (
                <div className="text-sm text-zinc-500">No songs yet. Use the orchestrator to generate a setlist.</div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ── Setlist Builder (drag-free numbered list) ──────────────────
function SetlistBuilder({ show, onSave }: { show: ShowFull | null; onSave: (setlist: ShowSong[]) => void }) {
  const [rows, setRows] = useState<ShowSong[]>([]);
  useEffect(() => {
    setRows(show?.setlist || []);
  }, [show?.setlist]);

  function update(i: number, patch: Partial<ShowSong>) {
    setRows((r) => r.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function add() {
    setRows((r) => [...r, { position: r.length + 1, song_title: "New Song", duration: "3:30", bpm: 100, mood: "cinematic" }]);
  }
  function remove(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, position: idx + 1 })));
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <ListMusic className="h-5 w-5 text-orange-400" /> Setlist Builder
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={add} className="border-zinc-700">
            <Plus className="mr-1 h-4 w-4" /> Add Song
          </Button>
          <Button size="sm" onClick={() => onSave(rows)} className="bg-orange-500 text-black hover:bg-orange-400">
            Save Setlist
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((s, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
              <span className="col-span-1 text-center text-sm text-orange-300">#{s.position}</span>
              <Input className="col-span-4 border-zinc-700 bg-zinc-950" value={s.song_title} onChange={(e) => update(i, { song_title: e.target.value })} />
              <Input className="col-span-2 border-zinc-700 bg-zinc-950" value={s.duration} onChange={(e) => update(i, { duration: e.target.value })} placeholder="mm:ss" />
              <Input className="col-span-1 border-zinc-700 bg-zinc-950" type="number" value={s.bpm} onChange={(e) => update(i, { bpm: Number(e.target.value) })} />
              <Input className="col-span-3 border-zinc-700 bg-zinc-950" value={s.mood} onChange={(e) => update(i, { mood: e.target.value })} placeholder="mood" />
              <Button size="icon" variant="ghost" onClick={() => remove(i)} className="col-span-1 text-zinc-400 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {rows.length === 0 && <div className="text-sm text-zinc-500">No songs in setlist.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Visual Identity Generator ──────────────────────────────────
function VisualIdentityPanel({ show, onRegenerate }: { show: ShowFull | null; onRegenerate: () => void; isLoading?: boolean }) {
  const vi = show?.show?.visual_identity;
  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Sparkles className="h-5 w-5 text-orange-400" /> Visual Identity Generator
        </CardTitle>
        <Button size="sm" onClick={onRegenerate} className="bg-orange-500 text-black hover:bg-orange-400">
          Regenerate
        </Button>
      </CardHeader>
      <CardContent>
        {!vi ? (
          <p className="text-sm text-zinc-400">Generate a show first to compose its visual identity.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Style" value={vi.style} />
            <Field label="Motion Language" value={vi.motion_language} />
            <Field label="Camera Style" value={vi.camera_style} />
            <Field label="Texture System" value={vi.texture_system} />
            <div className="md:col-span-2">
              <div className="text-xs uppercase text-zinc-500">Palette</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(vi.palette || []).map((c: string) => (
                  <div key={c} className="flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-200">
                    <span className="h-3 w-3 rounded-full" style={{ background: c }} />
                    {c}
                  </div>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs uppercase text-zinc-500">Forbidden Styles</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(vi.forbidden_styles || []).map((s: string) => (
                  <Badge key={s} variant="outline" className="border-red-500/40 text-red-300">{s}</Badge>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-sm text-zinc-100">{value}</div>
    </div>
  );
}

// ── Song Visual Builder ────────────────────────────────────────
function SongVisualBuilder({ show }: { show: ShowFull | null }) {
  const va = show?.visualAssets || [];
  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Camera className="h-5 w-5 text-orange-400" /> Song Visual Builder
        </CardTitle>
      </CardHeader>
      <CardContent>
        {va.length === 0 ? (
          <p className="text-sm text-zinc-400">No visual assets generated yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {va.map((a: any) => (
              <div key={a.id} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                <div className="text-xs text-orange-300">#{a.songPosition} · {a.songTitle}</div>
                <div className="mt-2 text-sm text-zinc-200">{a.loop_strategy}</div>
                <div className="mt-3 space-y-1 text-xs text-zinc-400">
                  {(a.prompts || []).slice(0, 3).map((p: string, i: number) => (
                    <div key={i} className="rounded border border-zinc-800 bg-zinc-950 p-2">{p}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Loop Generator Panel ───────────────────────────────────────
function LoopGeneratorPanel({ show, onGenerate, busy }: { show: ShowFull | null; onGenerate: () => void; busy: boolean }) {
  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Drum className="h-5 w-5 text-orange-400" /> Loop Generator
        </CardTitle>
        <Button size="sm" onClick={onGenerate} disabled={!show || busy} className="bg-orange-500 text-black hover:bg-orange-400">
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
          Generate Visual Package
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-zinc-400">
          The Loop Generator Agent compiles BPM-synced video loop specs for every song in your setlist.
          Output is ready for Runway · Sora · Veo3 · Stable Video Diffusion pipelines.
        </p>
      </CardContent>
    </Card>
  );
}

// ── Cue Timeline (visual scrubber) ─────────────────────────────
function CueTimeline({ show }: { show: ShowFull | null }) {
  const setlist = show?.setlist || [];
  const totalSeconds = useMemo(() => {
    return setlist.reduce((acc, s) => {
      const [m, sec] = (s.duration || "0:00").split(":").map((n) => Number(n) || 0);
      return acc + m * 60 + sec;
    }, 0);
  }, [setlist]);

  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Workflow className="h-5 w-5 text-orange-400" /> Cue Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {setlist.length === 0 ? (
          <p className="text-sm text-zinc-400">Build a setlist to view the cue timeline.</p>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-zinc-500">
              Total: {Math.floor(totalSeconds / 60)} min {totalSeconds % 60}s
            </div>
            <div className="overflow-x-auto">
              <div className="flex min-w-full items-stretch">
                {setlist.map((s, i) => {
                  const [m, sec] = (s.duration || "0:00").split(":").map((n) => Number(n) || 0);
                  const dur = m * 60 + sec || 60;
                  const widthPct = (dur / Math.max(totalSeconds, 1)) * 100;
                  const color = i % 2 === 0 ? "bg-orange-500/40" : "bg-orange-400/30";
                  return (
                    <div
                      key={i}
                      className={`relative h-20 border-r border-zinc-800 ${color} hover:brightness-125`}
                      style={{ width: `${Math.max(widthPct, 6)}%` }}
                      title={`${s.song_title} · ${s.duration}`}
                    >
                      <div className="absolute inset-x-1 top-1 truncate text-[10px] font-medium text-zinc-900">
                        #{s.position} {s.song_title}
                      </div>
                      <div className="absolute inset-x-1 bottom-1 text-[10px] text-zinc-900/80">
                        {s.bpm} BPM · {s.mood}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Live Control Panel ─────────────────────────────────────────
function LiveControlPanel({
  show, onStart, onEnd, onEmergency, fullscreen, onToggleFullscreen,
}: {
  show: ShowFull | null;
  onStart: (mode: "rehearsal" | "live") => void;
  onEnd: (sessionId: string) => void;
  onEmergency: (symptom: string) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const active = (show?.liveSessions || []).find((s: any) => s.status === "running");
  const [emergency, setEmergency] = useState("");

  return (
    <Card className={`border-zinc-800 bg-zinc-950/50 ${fullscreen ? "fixed inset-0 z-50 rounded-none border-0" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Power className="h-5 w-5 text-orange-400" /> Live Control Panel
        </CardTitle>
        <div className="flex gap-2">
          <StatusPill status={active ? "playing" : "ready"} />
          <Button size="icon" variant="ghost" onClick={onToggleFullscreen}>
            <Maximize2 className="h-4 w-4 text-zinc-400" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Button onClick={() => onStart("rehearsal")} disabled={!show || !!active} variant="outline" className="border-zinc-700 text-zinc-200 hover:bg-zinc-800">
            <FlaskConical className="mr-2 h-4 w-4 text-amber-400" /> Start Rehearsal Mode
          </Button>
          <Button onClick={() => onStart("live")} disabled={!show || !!active} className="bg-orange-500 text-black hover:bg-orange-400">
            <Play className="mr-2 h-4 w-4" /> Start Live Mode
          </Button>
          <Button onClick={() => active && onEnd(active.sessionId)} disabled={!active} variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10">
            <Pause className="mr-2 h-4 w-4" /> End Session
          </Button>
        </div>
        <Separator className="my-6 bg-zinc-800" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <KPI icon={<Gauge className="h-4 w-4 text-orange-400" />} label="Songs" value={String(show?.setlist?.length || 0)} />
          <KPI icon={<Cable className="h-4 w-4 text-orange-400" />} label="Devices" value={String(show?.devices?.length || 0)} />
          <KPI icon={<Layers className="h-4 w-4 text-orange-400" />} label="Visual Assets" value={String(show?.visualAssets?.length || 0)} />
        </div>
        <Separator className="my-6 bg-zinc-800" />
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-zinc-300">
            <AlertTriangle className="h-4 w-4 text-red-400" /> Emergency Show Assistant
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Describe what's wrong (audio drop, screen black, sync loss…)"
              value={emergency}
              onChange={(e) => setEmergency(e.target.value)}
              className="border-zinc-700 bg-zinc-950"
            />
            <Button onClick={() => emergency && onEmergency(emergency)} variant="outline" className="border-red-500/40 text-red-300 hover:bg-red-500/10">
              Trigger Recovery
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{value}</div>
    </div>
  );
}

// ── Technical Export Center ────────────────────────────────────
function TechnicalExportCenter({ show, onBuild, busy }: { show: ShowFull | null; onBuild: (targets: string[]) => void; busy: boolean }) {
  const ALL_TARGETS = ["Resolume", "TouchDesigner", "MIDI", "OSC", "SMPTE", "Art-Net", "Ableton Link"];
  const [selected, setSelected] = useState<string[]>(ALL_TARGETS);
  const exports = show?.technicalExports || [];

  function toggle(t: string) {
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  }

  function downloadJson(obj: any, filename: string) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Download className="h-5 w-5 text-orange-400" /> Technical Export Center
        </CardTitle>
        <Button size="sm" onClick={() => onBuild(selected)} disabled={!show || busy} className="bg-orange-500 text-black hover:bg-orange-400">
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Rocket className="mr-1 h-4 w-4" />}
          Export Technical Package
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          {ALL_TARGETS.map((t) => (
            <button
              key={t}
              onClick={() => toggle(t)}
              className={`rounded-full border px-3 py-1 text-xs ${
                selected.includes(t)
                  ? "border-orange-500/40 bg-orange-500/10 text-orange-300"
                  : "border-zinc-700 bg-zinc-900/40 text-zinc-400"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {exports.length === 0 ? (
          <p className="text-sm text-zinc-400">No exports built yet.</p>
        ) : (
          <div className="space-y-2">
            {exports.map((e: any) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div>
                  <div className="text-sm font-medium text-zinc-100">{e.format}</div>
                  <div className="text-xs text-zinc-400">{e.description}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => downloadJson(e.payload, `${e.format.replace(/\W+/g, "_").toLowerCase()}.json`)} className="border-zinc-700">
                  <Download className="mr-1 h-3 w-3" /> .json
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Asset Library ──────────────────────────────────────────────
function AssetLibrary({ show }: { show: ShowFull | null }) {
  const items = (show?.visualAssets || []) as any[];
  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Boxes className="h-5 w-5 text-orange-400" /> Asset Library
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-400">All visual assets, loops and exports will appear here.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {items.map((a: any) => (
              <div key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <Tv2 className="h-4 w-4 text-orange-300" />
                <div className="mt-2 truncate text-xs text-zinc-200">{a.songTitle}</div>
                <div className="text-[10px] text-zinc-500">{(a.prompts || []).length} loops</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Device Sync Panel ──────────────────────────────────────────
function DeviceSyncPanel({ show, onSave }: { show: ShowFull | null; onSave: (devices: any[]) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => setRows(show?.devices || []), [show?.devices]);

  function add() {
    setRows((r) => [...r, { id: `dev_${r.length + 1}`, name: "New Device", type: "LED Wall", protocol: "Art-Net", status: "ready" }]);
  }
  function update(i: number, patch: any) {
    setRows((r) => r.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function remove(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Wifi className="h-5 w-5 text-orange-400" /> Device Sync
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={add} className="border-zinc-700">
            <Plus className="mr-1 h-4 w-4" /> Add Device
          </Button>
          <Button size="sm" onClick={() => onSave(rows)} className="bg-orange-500 text-black hover:bg-orange-400">Save</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((d, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
              <Input className="col-span-3 border-zinc-700 bg-zinc-950" value={d.name} onChange={(e) => update(i, { name: e.target.value })} />
              <Input className="col-span-3 border-zinc-700 bg-zinc-950" value={d.type} onChange={(e) => update(i, { type: e.target.value })} placeholder="LED Wall, IMAG, Lights…" />
              <Select value={d.protocol || "OSC"} onValueChange={(v) => update(i, { protocol: v })}>
                <SelectTrigger className="col-span-3 border-zinc-700 bg-zinc-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["OSC", "MIDI", "Art-Net", "SMPTE", "Ableton Link", "DMX", "WebSocket"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="col-span-2 flex items-center"><StatusPill status={d.status || "ready"} /></div>
              <Button size="icon" variant="ghost" onClick={() => remove(i)} className="col-span-1 text-zinc-400 hover:text-red-400">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {rows.length === 0 && <div className="text-sm text-zinc-500">No devices configured.</div>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Show Templates ─────────────────────────────────────────────
function ShowTemplateSelector({
  templates, onPick,
}: {
  templates: ShowTemplate[];
  onPick: (t: ShowTemplate) => void;
}) {
  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <GitBranch className="h-5 w-5 text-orange-400" /> Show Templates
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-4 text-left hover:border-orange-500/40"
            >
              <div className="text-sm font-semibold text-zinc-100">{t.name}</div>
              <div className="mt-1 text-xs text-zinc-400">{t.description}</div>
              <div className="mt-2 flex gap-1">
                {t.defaultPalette.map((c) => (
                  <span key={c} className="h-3 w-3 rounded-full border border-zinc-700" style={{ background: c }} />
                ))}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Agent Orchestrator Panel ───────────────────────────────────
function AgentOrchestratorPanel() {
  const agents = [
    { name: "Repertoire Architect", icon: ListMusic, desc: "Designs energy-curve setlists from artist DNA" },
    { name: "Visual Director", icon: Sparkles, desc: "Composes the visual identity for the show" },
    { name: "Loop Generator", icon: Drum, desc: "BPM-synced video loop specs per section" },
    { name: "Stage Technical Director", icon: Sliders, desc: "Builds Resolume/TouchDesigner/MIDI/OSC packages" },
    { name: "Sync Engine", icon: Cable, desc: "Compiles a unified cue timeline across all devices" },
    { name: "Emergency Show Assistant", icon: AlertTriangle, desc: "Instant recovery plans during live emergencies" },
  ];
  return (
    <Card className="border-zinc-800 bg-zinc-950/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-zinc-100">
          <Cpu className="h-5 w-5 text-orange-400" /> AI Agent Orchestra
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {agents.map((a) => (
            <div key={a.name} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <a.icon className="h-5 w-5 text-orange-400" />
              <div className="mt-2 text-sm font-semibold text-zinc-100">{a.name}</div>
              <div className="text-xs text-zinc-400">{a.desc}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Pricing / Upgrade CTA ──────────────────────────────────────
function UpgradeCTA() {
  return (
    <section className="rounded-3xl border border-orange-500/30 bg-gradient-to-r from-orange-500/15 via-zinc-900 to-zinc-950 p-8">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h3 className="text-xl font-bold text-zinc-100">Upgrade for unlimited shows</h3>
          <p className="text-sm text-zinc-400">
            Boostify Pro unlocks unlimited shows, multi-device sync, and Premium agent runs.
          </p>
        </div>
        <Button size="lg" className="bg-orange-500 text-black hover:bg-orange-400">
          See Pricing <Megaphone className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}

// ── Generate Show Dialog ───────────────────────────────────────
function GenerateShowDialog({
  open, onOpenChange, onSubmit, busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (input: any) => void;
  busy: boolean;
}) {
  const [artistName, setArtistName] = useState("");
  const [genre, setGenre] = useState("pop");
  const [showTitle, setShowTitle] = useState("");
  const [vibe, setVibe] = useState("cinematic intimate");
  const [duration, setDuration] = useState(60);
  const [palette, setPalette] = useState("#F97316,#1F2937,#FFFFFF,#FCD34D");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-zinc-800 bg-zinc-950 text-zinc-100">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-orange-400" /> Generate Show JSON</DialogTitle>
          <DialogDescription className="text-zinc-400">
            The Repertoire Architect + Visual Director agents will design your live show.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Artist name</Label>
            <Input value={artistName} onChange={(e) => setArtistName(e.target.value)} placeholder="Romy Alvarez" className="border-zinc-700 bg-zinc-900" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Genre</Label>
              <Input value={genre} onChange={(e) => setGenre(e.target.value)} className="border-zinc-700 bg-zinc-900" />
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="border-zinc-700 bg-zinc-900" />
            </div>
          </div>
          <div>
            <Label>Show title</Label>
            <Input value={showTitle} onChange={(e) => setShowTitle(e.target.value)} placeholder="Lluvia de Oro Live Experience" className="border-zinc-700 bg-zinc-900" />
          </div>
          <div>
            <Label>Vibe</Label>
            <Input value={vibe} onChange={(e) => setVibe(e.target.value)} className="border-zinc-700 bg-zinc-900" />
          </div>
          <div>
            <Label>Brand palette (comma-separated hex)</Label>
            <Input value={palette} onChange={(e) => setPalette(e.target.value)} className="border-zinc-700 bg-zinc-900" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!artistName || busy}
            onClick={() =>
              onSubmit({
                artistName,
                genre,
                showTitle,
                vibe,
                durationMinutes: duration,
                brandColors: palette.split(",").map((c) => c.trim()).filter(Boolean),
              })
            }
            className="bg-orange-500 text-black hover:bg-orange-400"
          >
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            Generate Show
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════
// Main Page
// ════════════════════════════════════════════════════════════════
export default function StageSyncPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const { data: showsData, isLoading: showsLoading } = useQuery<{ shows: ShowSummary[] }>({
    queryKey: ["/api/stage-sync/shows"],
  });
  const shows = showsData?.shows || [];

  const { data: showFullData } = useQuery<ShowFull>({
    queryKey: [`/api/stage-sync/shows/${selectedShowId}`],
    enabled: !!selectedShowId,
  });
  const show = showFullData ?? null;

  const { data: tplData } = useQuery<{ templates: ShowTemplate[] }>({
    queryKey: ["/api/stage-sync/templates"],
  });
  const templates = tplData?.templates || [];

  const generateMutation = useMutation({
    mutationFn: async (input: any) =>
      apiRequest("/api/stage-sync/orchestrator/generate-show", { method: "POST", data: input }),
    onSuccess: (res: any) => {
      toast({ title: "Show generated", description: res?.master?.show_title || "Show ready" });
      setGenOpen(false);
      if (res?.showId) setSelectedShowId(res.showId);
      qc.invalidateQueries({ queryKey: ["/api/stage-sync/shows"] });
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e?.message || "Unknown error", variant: "destructive" }),
  });

  const visualPackageMutation = useMutation({
    mutationFn: async (showId: string) =>
      apiRequest(`/api/stage-sync/shows/${showId}/visual-package`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Visual package generated" });
      if (selectedShowId) qc.invalidateQueries({ queryKey: [`/api/stage-sync/shows/${selectedShowId}`] });
    },
    onError: (e: any) => toast({ title: "Visual package failed", description: e?.message, variant: "destructive" }),
  });

  const techPackageMutation = useMutation({
    mutationFn: async ({ showId, targets }: { showId: string; targets: string[] }) =>
      apiRequest(`/api/stage-sync/shows/${showId}/technical-package`, { method: "POST", data: { targets } }),
    onSuccess: () => {
      toast({ title: "Technical package built" });
      if (selectedShowId) qc.invalidateQueries({ queryKey: [`/api/stage-sync/shows/${selectedShowId}`] });
    },
    onError: (e: any) => toast({ title: "Technical export failed", description: e?.message, variant: "destructive" }),
  });

  const setlistMutation = useMutation({
    mutationFn: async ({ showId, setlist }: { showId: string; setlist: ShowSong[] }) =>
      apiRequest(`/api/stage-sync/shows/${showId}/setlist`, { method: "PUT", data: { setlist } }),
    onSuccess: () => {
      toast({ title: "Setlist saved" });
      if (selectedShowId) qc.invalidateQueries({ queryKey: [`/api/stage-sync/shows/${selectedShowId}`] });
    },
  });

  const devicesMutation = useMutation({
    mutationFn: async ({ showId, devices }: { showId: string; devices: any[] }) =>
      apiRequest(`/api/stage-sync/shows/${showId}/devices`, { method: "PUT", data: { devices } }),
    onSuccess: () => {
      toast({ title: "Devices saved" });
      if (selectedShowId) qc.invalidateQueries({ queryKey: [`/api/stage-sync/shows/${selectedShowId}`] });
    },
  });

  const startSession = useMutation({
    mutationFn: async ({ showId, mode }: { showId: string; mode: "live" | "rehearsal" }) =>
      apiRequest(`/api/stage-sync/shows/${showId}/sessions/start`, { method: "POST", data: { mode } }),
    onSuccess: (_d, vars) => {
      toast({ title: vars.mode === "live" ? "Live session started" : "Rehearsal started" });
      if (selectedShowId) qc.invalidateQueries({ queryKey: [`/api/stage-sync/shows/${selectedShowId}`] });
    },
  });

  const endSession = useMutation({
    mutationFn: async ({ showId, sessionId }: { showId: string; sessionId: string }) =>
      apiRequest(`/api/stage-sync/shows/${showId}/sessions/${sessionId}/end`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Session ended" });
      if (selectedShowId) qc.invalidateQueries({ queryKey: [`/api/stage-sync/shows/${selectedShowId}`] });
    },
  });

  const emergencyMutation = useMutation({
    mutationFn: async (symptom: string) =>
      apiRequest("/api/stage-sync/agents/emergency", { method: "POST", data: { symptom, show: show?.show, currentSongPosition: 0 } }),
    onSuccess: (res: any) => {
      const data = res?.data;
      toast({
        title: `Recovery plan (${data?.severity || "?"})`,
        description: (data?.recoveryPlan || []).join(" → ").slice(0, 240),
      });
    },
  });

  const visualDirectorMutation = useMutation({
    mutationFn: async () => {
      if (!show?.show) return null;
      return apiRequest("/api/stage-sync/agents/visual-director", {
        method: "POST",
        data: {
          artistName: show.show.artist_name,
          showTitle: show.show.show_title,
          brandColors: show.show.visual_identity?.palette,
          vibe: "cinematic",
        },
      });
    },
    onSuccess: async (res: any) => {
      if (res?.data && selectedShowId) {
        await apiRequest(`/api/stage-sync/shows/${selectedShowId}`, { method: "PATCH", data: { visual_identity: res.data } });
        qc.invalidateQueries({ queryKey: [`/api/stage-sync/shows/${selectedShowId}`] });
        toast({ title: "Visual identity regenerated" });
      }
    },
  });

  function handleTemplate(t: ShowTemplate) {
    setGenOpen(true);
    // The dialog state is inside the dialog component; user fills artist name + clicks generate.
    toast({ title: `Template selected: ${t.name}`, description: "Fill the artist name to generate." });
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8 md:py-12">
        <Hero onCreateShow={() => setGenOpen(true)} />

        <ShowDashboard
          shows={shows}
          isLoading={showsLoading}
          onSelect={setSelectedShowId}
          onCreate={() => setGenOpen(true)}
        />

        {selectedShowId && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 gap-1 bg-zinc-900 md:grid-cols-7">
              <TabsTrigger value="overview"><Activity className="mr-1 h-3 w-3" /> Overview</TabsTrigger>
              <TabsTrigger value="setlist"><ListMusic className="mr-1 h-3 w-3" /> Setlist</TabsTrigger>
              <TabsTrigger value="visuals"><Sparkles className="mr-1 h-3 w-3" /> Visuals</TabsTrigger>
              <TabsTrigger value="cues"><Workflow className="mr-1 h-3 w-3" /> Cues</TabsTrigger>
              <TabsTrigger value="technical"><Sliders className="mr-1 h-3 w-3" /> Technical</TabsTrigger>
              <TabsTrigger value="devices"><Wifi className="mr-1 h-3 w-3" /> Devices</TabsTrigger>
              <TabsTrigger value="live"><Power className="mr-1 h-3 w-3" /> Live</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <RepertoireManager show={show} />
                <VisualIdentityPanel show={show} onRegenerate={() => visualDirectorMutation.mutate()} />
              </div>
              <AgentOrchestratorPanel />
            </TabsContent>

            <TabsContent value="setlist" className="mt-6 space-y-6">
              <SetlistBuilder
                show={show}
                onSave={(setlist) => selectedShowId && setlistMutation.mutate({ showId: selectedShowId, setlist })}
              />
            </TabsContent>

            <TabsContent value="visuals" className="mt-6 space-y-6">
              <LoopGeneratorPanel
                show={show}
                busy={visualPackageMutation.isPending}
                onGenerate={() => selectedShowId && visualPackageMutation.mutate(selectedShowId)}
              />
              <SongVisualBuilder show={show} />
              <AssetLibrary show={show} />
            </TabsContent>

            <TabsContent value="cues" className="mt-6 space-y-6">
              <CueTimeline show={show} />
            </TabsContent>

            <TabsContent value="technical" className="mt-6 space-y-6">
              <TechnicalExportCenter
                show={show}
                busy={techPackageMutation.isPending}
                onBuild={(targets) => selectedShowId && techPackageMutation.mutate({ showId: selectedShowId, targets })}
              />
            </TabsContent>

            <TabsContent value="devices" className="mt-6 space-y-6">
              <DeviceSyncPanel
                show={show}
                onSave={(devices) => selectedShowId && devicesMutation.mutate({ showId: selectedShowId, devices })}
              />
            </TabsContent>

            <TabsContent value="live" className="mt-6 space-y-6">
              <LiveControlPanel
                show={show}
                fullscreen={fullscreen}
                onToggleFullscreen={() => setFullscreen((v) => !v)}
                onStart={(mode) => selectedShowId && startSession.mutate({ showId: selectedShowId, mode })}
                onEnd={(sessionId) => selectedShowId && endSession.mutate({ showId: selectedShowId, sessionId })}
                onEmergency={(symptom) => emergencyMutation.mutate(symptom)}
              />
            </TabsContent>
          </Tabs>
        )}

        <ShowTemplateSelector templates={templates} onPick={handleTemplate} />
        <UpgradeCTA />
      </div>

      <GenerateShowDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        busy={generateMutation.isPending}
        onSubmit={(input) => generateMutation.mutate(input)}
      />
    </div>
  );
}
