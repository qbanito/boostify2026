import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Zap, Send, Loader2, Copy, Check, ChevronDown, ChevronUp,
  Instagram, Play, Hash, FileText, Target, TrendingUp, Calendar,
  Clock, CheckCircle2, AlertCircle, Sparkles
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "../../hooks/use-toast";

// ─── Types ──────────────────────────────────────────────────

interface ActionButton {
  label: string;
  action: string;
  params?: Record<string, any>;
  icon?: React.ReactNode;
}

interface TabAiAssistantProps {
  tabName: string;
  description: string;
  actions: ActionButton[];
  artistId?: number;
  context?: string;
}

interface ActionResultData {
  action: string;
  data: any;
  queuedToExtension?: boolean;
  actionId?: number;
}

// ─── Result Renderers ───────────────────────────────────────

function CaptionResults({ data, onQueue }: { data: any; onQueue: (caption: any) => void }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const captions = data?.captions || [];
  if (!captions.length) return <p className="text-sm text-muted-foreground">No captions generated.</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-[#833ab4]" />
        <span className="text-sm font-semibold">{captions.length} Captions Ready to Use</span>
      </div>
      {captions.map((c: any, i: number) => (
        <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
          <p className="text-sm leading-relaxed">{c.text}</p>
          {c.hashtags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {c.hashtags.slice(0, 8).map((h: string, j: number) => (
                <Badge key={j} variant="secondary" className="text-[10px] px-1.5 py-0">{h.startsWith('#') ? h : `#${h}`}</Badge>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            {c.engagementScore && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                <TrendingUp className="w-3 h-3 mr-0.5" /> {c.engagementScore}%
              </Badge>
            )}
            <div className="flex-1" />
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
              onClick={() => {
                navigator.clipboard.writeText(c.text + (c.hashtags ? '\n\n' + c.hashtags.join(' ') : ''));
                setCopiedIdx(i);
                setTimeout(() => setCopiedIdx(null), 2000);
              }}>
              {copiedIdx === i ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              Copy
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1 bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white hover:opacity-90"
              onClick={() => onQueue(c)}>
              <Instagram className="w-3 h-3" /> Queue
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function HashtagResults({ data, onQueue }: { data: any; onQueue: (hashtags: string[]) => void }) {
  const [copied, setCopied] = useState(false);
  const groups = data?.groups || {};
  const recommended = data?.recommended_set || [];
  const allTags = [...(groups.high_volume || []), ...(groups.medium_volume || []), ...(groups.low_volume || [])];
  if (!allTags.length && !recommended.length) return <p className="text-sm text-muted-foreground">No hashtags generated.</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Hash className="w-4 h-4 text-[#fd1d1d]" />
        <span className="text-sm font-semibold">{allTags.length || recommended.length} Hashtags Generated</span>
      </div>
      {Object.entries(groups).map(([group, tags]: [string, any]) => (
        <div key={group} className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground capitalize">{group.replace(/_/g, ' ')}</span>
          <div className="flex flex-wrap gap-1">
            {tags.map((t: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5">{t.startsWith('#') ? t : `#${t}`}</Badge>
            ))}
          </div>
        </div>
      ))}
      {recommended.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border">
          <span className="text-xs font-medium text-[#833ab4]">Recommended Set</span>
          <div className="flex flex-wrap gap-1">
            {recommended.map((t: string, i: number) => (
              <Badge key={i} className="text-xs px-2 py-0.5 bg-[#833ab4]/10 text-[#833ab4] border-[#833ab4]/20">{t}</Badge>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
          navigator.clipboard.writeText((recommended.length ? recommended : allTags).join(' '));
          setCopied(true); setTimeout(() => setCopied(false), 2000);
        }}>
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />} Copy All
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1 bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white hover:opacity-90"
          onClick={() => onQueue(recommended.length ? recommended : allTags)}>
          <Instagram className="w-3 h-3" /> Queue
        </Button>
      </div>
    </div>
  );
}

function ContentIdeasResults({ data }: { data: any }) {
  const ideas = data?.ideas || [];
  if (!ideas.length) return <p className="text-sm text-muted-foreground">No ideas generated.</p>;
  const fmtIcons: Record<string, React.ReactNode> = {
    'Reel': <Play className="w-3 h-3" />, 'Carousel': <FileText className="w-3 h-3" />,
    'Story': <Clock className="w-3 h-3" />, 'Post': <Instagram className="w-3 h-3" />,
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[#fcb045]" />
        <span className="text-sm font-semibold">{ideas.length} Content Ideas</span>
      </div>
      {ideas.map((idea: any, i: number) => (
        <div key={i} className="rounded-lg border border-border bg-card p-3 flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#833ab4]/20 to-[#fcb045]/20 flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{idea.title}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">{fmtIcons[idea.format] || <Sparkles className="w-3 h-3" />}{idea.format}</Badge>
              {idea.bestDay && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{idea.bestDay}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{idea.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function BestTimesResults({ data }: { data: any }) {
  const bestTimes = data?.bestTimes || [];
  if (!bestTimes.length) return <p className="text-sm text-muted-foreground">No timing data.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-green-500" />
        <span className="text-sm font-semibold">Optimal Posting Schedule</span>
      </div>
      {data.summary && <p className="text-xs text-muted-foreground">{data.summary}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {bestTimes.map((t: any, i: number) => (
          <div key={i} className="rounded-lg border border-green-500/20 bg-green-500/5 p-2.5 text-center space-y-1">
            <span className="text-xs font-bold">{t.day}</span>
            <div className="flex flex-wrap gap-1 justify-center">
              {t.times?.map((time: string, j: number) => (
                <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-600">{time}</Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
      {data.worstTimes?.length > 0 && (
        <div className="pt-2 border-t border-border">
          <span className="text-xs font-medium text-red-400">Avoid:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {data.worstTimes.map((t: any, i: number) => (
              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 border-red-400/30 text-red-400">{t.day} {t.times?.join(', ')}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BioResults({ data, onQueue }: { data: any; onQueue: (bio: string) => void }) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const bios = data?.bios || [];
  if (!bios.length) return <p className="text-sm text-muted-foreground">No bio options generated.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-[#fd1d1d]" />
        <span className="text-sm font-semibold">{bios.length} Bio Options</span>
      </div>
      {bios.map((b: any, i: number) => (
        <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
          <p className="text-sm font-medium">{b.text}</p>
          <div className="flex items-center gap-2">
            {b.characterCount && <span className="text-[10px] text-muted-foreground">{b.characterCount} chars</span>}
            {b.focus && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{b.focus}</Badge>}
            <div className="flex-1" />
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
              onClick={() => { navigator.clipboard.writeText(b.text); setCopiedIdx(i); setTimeout(() => setCopiedIdx(null), 2000); }}>
              {copiedIdx === i ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />} Copy
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1 bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white hover:opacity-90"
              onClick={() => onQueue(b.text)}>
              <Instagram className="w-3 h-3" /> Apply
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditResults({ data }: { data: any }) {
  if (data?.status === 'no-data') {
    return (
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-semibold text-yellow-600">Instagram Not Connected</span>
        </div>
        <p className="text-sm text-muted-foreground">{data.message}</p>
        {data.genericTips && (
          <ul className="space-y-1">
            {data.genericTips.map((tip: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />{tip}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[#833ab4]" />
          <span className="text-sm font-semibold">Profile Audit</span>
        </div>
        {data.score != null && (
          <div className={`text-xl font-black ${data.score >= 80 ? 'text-green-500' : data.score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
            {data.score}/100 {data.grade && <span className="text-sm">{data.grade}</span>}
          </div>
        )}
      </div>
      {data.strengths && (
        <div><span className="text-xs font-medium text-green-500">Strengths</span>
          <ul className="mt-1 space-y-0.5">{data.strengths.map((s: string, i: number) => (
            <li key={i} className="flex items-start gap-1.5 text-xs"><CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />{s}</li>
          ))}</ul>
        </div>
      )}
      {data.weaknesses && (
        <div><span className="text-xs font-medium text-red-400">Weaknesses</span>
          <ul className="mt-1 space-y-0.5">{data.weaknesses.map((w: string, i: number) => (
            <li key={i} className="flex items-start gap-1.5 text-xs"><AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />{w}</li>
          ))}</ul>
        </div>
      )}
      {data.quickWins && (
        <div className="pt-2 border-t border-border">
          <span className="text-xs font-medium text-[#fcb045]">Quick Wins</span>
          <div className="grid gap-1.5 mt-1">{data.quickWins.map((q: any, i: number) => (
            <div key={i} className="flex items-center gap-2 rounded border border-[#fcb045]/20 bg-[#fcb045]/5 p-2 text-xs">
              <Zap className="w-3 h-3 text-[#fcb045] shrink-0" />
              <span className="flex-1">{typeof q === 'string' ? q : q.action}</span>
              {q.impact && <Badge variant="outline" className="text-[10px] px-1 py-0">{q.impact}</Badge>}
            </div>
          ))}</div>
        </div>
      )}
      {data.growthProjection && (
        <div className="pt-2 border-t border-border">
          <span className="text-xs font-medium text-[#833ab4]">Growth Projection</span>
          <div className="grid grid-cols-3 gap-2 mt-1">{Object.entries(data.growthProjection).map(([period, value]: [string, any]) => (
            <div key={period} className="rounded border border-[#833ab4]/20 bg-[#833ab4]/5 p-2 text-center">
              <div className="text-xs text-muted-foreground">{period}</div>
              <div className="text-sm font-bold text-[#833ab4]">{value}</div>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  );
}

function GrowthPlanResults({ data }: { data: any }) {
  const plan = data?.plan;
  if (!plan) return <p className="text-sm text-muted-foreground">No plan generated.</p>;
  const pColors: Record<string, string> = { high: 'text-red-500', medium: 'text-yellow-500', low: 'text-green-500' };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-green-500" />
        <span className="text-sm font-semibold">30-Day Growth Plan</span>
      </div>
      {data.expectedResults && <p className="text-xs text-muted-foreground italic">{data.expectedResults}</p>}
      {Object.entries(plan).map(([week, wd]: [string, any]) => (
        <div key={week} className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-muted-foreground">{week.replace(/(\d)/, ' $1')}</span>
            {wd.theme && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{wd.theme}</Badge>}
          </div>
          <div className="space-y-1">{wd.tasks?.map((task: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-8 font-medium text-muted-foreground">{task.day}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0">{task.type}</Badge>
              <span className="flex-1">{task.action}</span>
              {task.priority && <span className={`text-[10px] font-medium ${pColors[task.priority] || ''}`}>{task.priority}</span>}
            </div>
          ))}</div>
        </div>
      ))}
    </div>
  );
}

function ReelsResults({ data }: { data: any }) {
  const reels = data?.reels || [];
  if (!reels.length) return <p className="text-sm text-muted-foreground">No reel ideas generated.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Play className="w-4 h-4 text-[#fd1d1d]" />
        <span className="text-sm font-semibold">{reels.length} Reel Ideas</span>
      </div>
      {reels.map((r: any, i: number) => (
        <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#fd1d1d]/10 flex items-center justify-center text-xs font-bold text-[#fd1d1d]">{i + 1}</div>
            <span className="text-sm font-medium">{r.title}</span>
            {r.viewsPotential && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{r.viewsPotential}</Badge>}
          </div>
          {r.hook && <p className="text-xs"><span className="font-medium text-[#fcb045]">Hook:</span> {r.hook}</p>}
          {r.concept && <p className="text-xs text-muted-foreground">{r.concept}</p>}
          {r.audioSuggestion && <p className="text-xs text-muted-foreground flex items-center gap-1"><Play className="w-3 h-3" /> {r.audioSuggestion}</p>}
          {r.script && <div className="mt-1 p-2 rounded bg-muted/30 text-xs text-muted-foreground"><span className="font-medium text-foreground">Script: </span>{r.script}</div>}
        </div>
      ))}
    </div>
  );
}

// ─── Result Router ──────────────────────────────────────────

function ActionResultView({ result, onQueue }: { result: ActionResultData; onQueue: (type: string, payload: any) => void }) {
  const { action, data, queuedToExtension } = result;
  const view = () => {
    switch (action) {
      case 'generate_captions': return <CaptionResults data={data} onQueue={(c) => onQueue('post_caption', { caption: c.text, hashtags: c.hashtags })} />;
      case 'generate_hashtags': return <HashtagResults data={data} onQueue={(h) => onQueue('post_caption', { hashtags: h })} />;
      case 'generate_content_ideas': return <ContentIdeasResults data={data} />;
      case 'analyze_best_times': return <BestTimesResults data={data} />;
      case 'optimize_bio': return <BioResults data={data} onQueue={(bio) => onQueue('update_bio', { bio })} />;
      case 'full_audit': return <AuditResults data={data} />;
      case 'growth_plan': return <GrowthPlanResults data={data} />;
      case 'reels_ideas': return <ReelsResults data={data} />;
      default: return <pre className="text-sm whitespace-pre-wrap font-sans">{typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</pre>;
    }
  };
  return (
    <div className="space-y-2">
      {view()}
      {queuedToExtension && (
        <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-500/5 rounded px-2 py-1.5 border border-green-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" /> Queued to Chrome Extension
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export function TabAiAssistant({ tabName, description, actions, artistId, context }: TabAiAssistantProps) {
  const [chatQuery, setChatQuery] = useState("");
  const [chatResponse, setChatResponse] = useState("");
  const [actionResult, setActionResult] = useState<ActionResultData | null>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const { toast } = useToast();

  const executeMutation = useMutation({
    mutationFn: async ({ action, params }: { action: string; params?: Record<string, any> }) => {
      const res = await fetch("/api/instagram/ai-agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, params: { ...params, artistId }, autoQueue: false }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Action failed");
      return res.json();
    },
    onSuccess: (data) => { setChatResponse(""); setActionResult(data); setActiveAction(data.action); },
    onError: (err: any) => { toast({ title: "Action Failed", description: err.message, variant: "destructive" }); },
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await fetch("/api/instagram/ai-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: `[${tabName}] ${message}`, artistId }),
      });
      if (!res.ok) throw new Error("Chat failed");
      return res.json();
    },
    onSuccess: (data) => { setActionResult(null); setChatResponse(data.response || "No response."); },
    onError: () => { toast({ title: "Error", description: "Could not get response.", variant: "destructive" }); },
  });

  const queueMutation = useMutation({
    mutationFn: async ({ actionType, payload }: { actionType: string; payload: any }) => {
      const res = await fetch("/api/instagram-ext/create-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actionType, payload: { ...payload, source: 'ai-agent' }, generatedBy: 'ai-agent', priority: 3 }),
      });
      if (!res.ok) throw new Error("Queue failed");
      return res.json();
    },
    onSuccess: () => { toast({ title: "Queued!", description: "Sent to Chrome Extension. Executes on next sync." }); },
    onError: () => { toast({ title: "Queue Failed", description: "Could not send. Is the extension connected?", variant: "destructive" }); },
  });

  const handleAction = (a: ActionButton) => { setActiveAction(a.action); executeMutation.mutate({ action: a.action, params: a.params }); };
  const handleChat = () => { if (!chatQuery.trim()) return; chatMutation.mutate(chatQuery.trim()); };
  const isLoading = executeMutation.isPending || chatMutation.isPending;

  return (
    <div className="rounded-xl border border-[#833ab4]/20 bg-gradient-to-r from-[#833ab4]/5 via-[#fd1d1d]/5 to-[#fcb045]/5 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#833ab4] to-[#fd1d1d] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">AI Actions</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#833ab4]/30 text-[#833ab4]">Executes Real Tools</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-3">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            {actions.map((a, i) => (
              <Button key={i} size="sm"
                variant={activeAction === a.action ? "default" : "outline"}
                className={`text-xs h-8 sm:h-9 px-2.5 sm:px-3 gap-1.5 transition-all ${
                  activeAction === a.action ? "bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white border-0" : "border-[#833ab4]/20 hover:border-[#833ab4]/50 hover:bg-[#833ab4]/5"
                }`}
                onClick={() => handleAction(a)} disabled={isLoading}>
                {isLoading && activeAction === a.action ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (a.icon || <Zap className="w-3.5 h-3.5" />)}
                <span className="truncate">{a.label}</span>
              </Button>
            ))}
          </div>

          <div className="flex gap-2">
            <Input placeholder={`Ask anything about ${tabName.toLowerCase()}...`} value={chatQuery}
              onChange={(e) => setChatQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleChat()}
              className="text-sm h-9 bg-background/50" disabled={isLoading} />
            <Button size="sm" className="h-9 px-3 bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] hover:opacity-90 text-white"
              onClick={handleChat} disabled={!chatQuery.trim() || isLoading}>
              {chatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>

          {isLoading && !actionResult && !chatResponse && (
            <div className="rounded-lg border border-border bg-background/80 p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-[#833ab4]" />
              <div>
                <span className="text-sm font-medium">Executing action...</span>
                <p className="text-xs text-muted-foreground">Generating real results, not just chat</p>
              </div>
            </div>
          )}

          {actionResult && !isLoading && (
            <div className="rounded-lg border border-border bg-background/80 p-3 sm:p-4 max-h-[500px] overflow-y-auto">
              <ActionResultView result={actionResult} onQueue={(type, payload) => queueMutation.mutate({ actionType: type, payload })} />
            </div>
          )}

          {chatResponse && !actionResult && !isLoading && (
            <div className="rounded-lg border border-border bg-background/80 p-3 sm:p-4 max-h-[300px] overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{chatResponse}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
