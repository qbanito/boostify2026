/**
 * Reusable per-page diagnostic panel.
 * Drop into any page to show health score, improvements & Code Engine execution.
 * Usage: <PageDiagnosticPanel pageId="ig-boost" />
 */
import { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Cpu, Loader2, GitCommit, Eye, Undo2, Zap, Shield, X, Terminal, Bot
} from "lucide-react";

interface Improvement {
  task: string;
  priority: "critical" | "high" | "medium" | "low";
  deadline: string;
  assignee?: string;
}

interface PageDiagnostic {
  id: string;
  name: string;
  route: string;
  category: string;
  status: string;
  healthScore: number;
  completedFeatures: string[];
  improvements: Improvement[];
  lastUpdated: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  critical: { label: "CRITICAL", color: "bg-red-500/15 text-red-400", icon: AlertTriangle },
  high: { label: "HIGH", color: "bg-orange-500/15 text-orange-400", icon: Zap },
  medium: { label: "MEDIUM", color: "bg-yellow-500/15 text-yellow-400", icon: Shield },
  low: { label: "LOW", color: "bg-blue-500/15 text-blue-400", icon: Activity },
};

interface Props {
  pageId: string;
}

// Rich display for each streamed agent event
function AgentEventRow({ event }: { event: { type: string; data: any; time: number } }) {
  const { type, data } = event;
  switch (type) {
    case "status":
      return (
        <div className="flex items-center gap-1.5 text-[10px] text-cyan-300">
          <span className="text-cyan-500">●</span> {data.message}
        </div>
      );
    case "iteration":
      return (
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 border-t border-slate-800 pt-0.5 mt-0.5">
          ─── Iteration {data.current}/{data.max} ───
        </div>
      );
    case "thinking":
      return (
        <div className="text-[10px] text-purple-400">
          🧠 AI response ({data.latencyMs}ms)
        </div>
      );
    case "tool_call": {
      const toolIcons: Record<string, string> = {
        read_file: "📖", search_codebase: "🔍", list_directory: "📂",
        edit_file: "✏️", create_file: "📝", validate_changes: "✅",
      };
      const icon = toolIcons[data.tool] || "🔧";
      const argsStr = Object.entries(data.args || {})
        .map(([k, v]) => `${k}=${String(v).slice(0, 50)}`)
        .join(", ");
      return (
        <div className="text-[10px] font-mono">
          <span className="text-yellow-400">{icon} {data.tool}</span>
          <span className="text-slate-500 ml-1">({argsStr})</span>
        </div>
      );
    }
    case "tool_result":
      return (
        <div className={`text-[10px] font-mono pl-4 ${data.success ? "text-green-400/70" : "text-red-400"}`}>
          {data.success ? "→" : "✗"} {data.preview?.slice(0, 120)}
        </div>
      );
    case "summary":
      return (
        <div className="text-[10px] text-green-300 border-t border-green-500/20 pt-1 mt-1">
          📋 {data.text}
        </div>
      );
    case "complete":
      return (
        <div className={`text-[10px] font-semibold border-t pt-1 mt-1 ${data.success ? "text-green-400 border-green-500/20" : "text-red-400 border-red-500/20"}`}>
          {data.success ? `✅ Done: ${data.filesChanged?.length || 0} files, ${data.toolCalls} tools` : `❌ Failed: ${data.error?.slice(0, 200)}`}
          {data.commitHash && <span className="text-slate-400 ml-1">[{data.commitHash}]</span>}
        </div>
      );
    case "error":
      return <div className="text-[10px] text-red-400">❌ {data.message}</div>;
    default:
      return <div className="text-[10px] text-slate-500">{JSON.stringify(data).slice(0, 120)}</div>;
  }
}

export function PageDiagnosticPanel({ pageId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diagnostic, setDiagnostic] = useState<PageDiagnostic | null>(null);
  const [expandedSection, setExpandedSection] = useState<"improvements" | "completed" | null>("improvements");
  const [previewingTask, setPreviewingTask] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [applyingChanges, setApplyingChanges] = useState(false);
  const [appliedTasks, setAppliedTasks] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ applied: number; total: number } | null>(null);
  const [agentRunning, setAgentRunning] = useState<string | null>(null);
  const [agentEvents, setAgentEvents] = useState<Array<{ type: string; data: any; time: number }>>([]);
  const [agentPhase, setAgentPhase] = useState<string>("");
  const agentLogRef = useRef<HTMLDivElement>(null);

  const fetchDiagnostic = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/reports/diagnostics/${pageId}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setDiagnostic(data.diagnostic);
      } else {
        setMessage({ type: "error", text: data.error || "Failed to load diagnostics" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  const handleOpen = () => {
    setOpen(true);
    if (!diagnostic) fetchDiagnostic();
  };

  const previewImprovement = async (task: string, priority: string) => {
    setPreviewingTask(task);
    setPreviewData(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/code-engine/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pageId, task, priority }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData({ ...data, pageId, task });
        setMessage({ type: "info", text: `Preview: ${data.filesAffected} file(s) via ${data.provider}` });
      } else {
        setMessage({ type: "error", text: data.error || "Preview failed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setPreviewingTask(null);
    }
  };

  const applyChanges = async () => {
    if (!previewData?.rawChanges) return;
    setApplyingChanges(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/code-engine/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          previewId: previewData.previewId,
          changes: previewData.rawChanges,
          task: previewData.task,
          pageId: previewData.pageId,
          autoCommit: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const fileList = data.fileDetails?.map((f: any) => `${f.action}: ${f.filePath}`).join(", ") || "";
        setMessage({ type: "success", text: `${data.message || "Applied!"} [${fileList}]` });
        if (previewData.task) {
          setAppliedTasks(prev => new Set(prev).add(previewData.task));
        }
        setPreviewData(null);
        fetchDiagnostic(); // Refresh
      } else {
        setMessage({ type: "error", text: data.tsErrors ? `TS errors — rolled back: ${data.tsErrors.slice(0, 300)}` : (data.error || "Apply failed") });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setApplyingChanges(false);
    }
  };

  // Agent mode via SSE: streams real-time progress like VSCode agent
  const agentExecute = async (task: string, priority: string) => {
    setAgentRunning(task);
    setAgentEvents([]);
    setAgentPhase("connecting");
    setMessage(null);

    const params = new URLSearchParams({ pageId, task, priority });
    const eventSource = new EventSource(`/api/admin/code-engine/agent-stream?${params}`);

    const pushEvent = (type: string, data: any) => {
      setAgentEvents(prev => [...prev, { type, data, time: Date.now() }]);
      // Auto-scroll
      setTimeout(() => {
        if (agentLogRef.current) {
          agentLogRef.current.scrollTop = agentLogRef.current.scrollHeight;
        }
      }, 50);
    };

    eventSource.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      setAgentPhase(data.phase || "working");
      pushEvent("status", data);
    });

    eventSource.addEventListener("iteration", (e) => {
      const data = JSON.parse(e.data);
      setAgentPhase(`Iteration ${data.current}/${data.max}`);
      pushEvent("iteration", data);
    });

    eventSource.addEventListener("thinking", (e) => {
      const data = JSON.parse(e.data);
      pushEvent("thinking", data);
    });

    eventSource.addEventListener("tool_call", (e) => {
      const data = JSON.parse(e.data);
      setAgentPhase(`${data.tool}(${Object.values(data.args || {}).join(", ").slice(0, 40)})`);
      pushEvent("tool_call", data);
    });

    eventSource.addEventListener("tool_result", (e) => {
      const data = JSON.parse(e.data);
      pushEvent("tool_result", data);
    });

    eventSource.addEventListener("summary", (e) => {
      const data = JSON.parse(e.data);
      setAgentPhase("complete");
      pushEvent("summary", data);
    });

    eventSource.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      eventSource.close();
      setAgentRunning(null);
      setAgentPhase("");
      if (data.success) {
        setMessage({
          type: "success",
          text: `Agent: ${data.filesChanged?.length || 0} files, ${data.toolCalls} tools, ${data.iterations} iters${data.commitHash ? ` [${data.commitHash}]` : ""}`,
        });
        setAppliedTasks(prev => new Set(prev).add(task));
        fetchDiagnostic();
      } else {
        setMessage({ type: "error", text: data.error || "Agent failed" });
      }
      pushEvent("complete", data);
    });

    eventSource.addEventListener("error_event", (e) => {
      const data = JSON.parse(e.data);
      pushEvent("error", data);
    });

    eventSource.onerror = () => {
      eventSource.close();
      setAgentRunning(null);
      setAgentPhase("");
      setMessage({ type: "error", text: "Agent stream connection lost" });
    };
  };

  const getScoreColor = (score: number) =>
    score >= 90 ? "text-green-400" : score >= 75 ? "text-yellow-400" : score >= 50 ? "text-orange-400" : "text-red-400";

  const runAllImprovements = async () => {
    if (!diagnostic?.improvements?.length) return;
    const pending = diagnostic.improvements.filter(imp => !appliedTasks.has(imp.task));
    if (pending.length === 0) { setMessage({ type: "info", text: "All improvements already applied." }); return; }

    setBatchRunning(true);
    setBatchProgress({ applied: 0, total: pending.length });
    setMessage({ type: "info", text: `Running ${pending.length} tasks...` });

    try {
      const res = await fetch("/api/admin/code-engine/batch-execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pageId,
          tasks: pending.map(imp => ({ task: imp.task, priority: imp.priority })),
          maxRetries: 1,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBatchProgress({ applied: data.applied, total: data.totalTasks });
        const newApplied = new Set(appliedTasks);
        data.results?.forEach((r: any) => { if (r.status === "applied") newApplied.add(r.task); });
        setAppliedTasks(newApplied);
        setMessage({ type: "success", text: `Batch complete: ${data.applied}/${data.totalTasks} applied, ${data.failed} failed` });
        fetchDiagnostic();
      } else {
        setMessage({ type: "error", text: data.error || "Batch execute failed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setBatchRunning(false);
    }
  };

  const getScoreBg = (score: number) =>
    score >= 90 ? "bg-green-500" : score >= 75 ? "bg-yellow-500" : score >= 50 ? "bg-orange-500" : "bg-red-500";

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
        title="Run diagnostics for this page"
      >
        <Activity className="h-4 w-4" />
        Diagnostics
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 sm:w-[420px] max-h-[80vh] overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-cyan-500/10">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white">
            {diagnostic?.name || "Page Diagnostics"}
          </span>
          {diagnostic && (
            <span className={`text-sm font-bold ${getScoreColor(diagnostic.healthScore)}`}>
              {diagnostic.healthScore}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {diagnostic && diagnostic.improvements.length > 0 && (
            <button
              onClick={runAllImprovements}
              disabled={batchRunning || applyingChanges}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white text-[9px] font-semibold disabled:opacity-50 transition-all"
              title="Run all improvements automatically"
            >
              {batchRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              {batchRunning ? `${batchProgress?.applied || 0}/${batchProgress?.total || "..."}` : "Run All"}
            </button>
          )}
          <button onClick={fetchDiagnostic} className="p-1 hover:bg-slate-700 rounded" title="Refresh">
            <Loader2 className={`h-3.5 w-3.5 text-slate-400 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-slate-700 rounded">
            <X className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Health Bar */}
      {diagnostic && (
        <div className="px-3 pt-2">
          <div className="w-full bg-slate-800 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full transition-all ${getScoreBg(diagnostic.healthScore)}`} style={{ width: `${diagnostic.healthScore}%` }} />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-slate-500">{diagnostic.completedFeatures.length} completed</span>
            <span className="text-[10px] text-slate-500">{diagnostic.improvements.length} pending</span>
          </div>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`mx-3 mt-2 p-2 rounded-lg text-[11px] ${
          message.type === "success" ? "bg-green-500/10 border border-green-500/30 text-green-300" :
          message.type === "error" ? "bg-red-500/10 border border-red-500/30 text-red-300" :
          "bg-cyan-500/10 border border-cyan-500/30 text-cyan-300"
        }`}>
          <div className="flex items-start gap-1.5">
            <span className="flex-1 whitespace-pre-wrap">{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white flex-shrink-0">✕</button>
          </div>
        </div>
      )}

      {/* Preview Overlay */}
      {previewData && (
        <div className="mx-3 mt-2 border border-cyan-500/30 rounded-lg overflow-hidden">
          <div className="p-2 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
            <span className="text-[11px] text-cyan-300 font-medium">
              <Eye className="h-3 w-3 inline mr-1" />
              Preview: {previewData.filesAffected} file(s)
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" onClick={applyChanges} disabled={applyingChanges}
                className="h-6 px-2 text-[10px] bg-green-600 hover:bg-green-500">
                {applyingChanges ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitCommit className="h-3 w-3" />}
                <span className="ml-1">{applyingChanges ? "..." : "Apply"}</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPreviewData(null)} className="h-6 px-2 text-[10px] border-slate-600">
                Cancel
              </Button>
            </div>
          </div>
          <div className="max-h-32 overflow-auto p-2">
            {previewData.changes?.map((c: any, i: number) => (
              <div key={i} className="text-[10px] font-mono text-slate-300 mb-1">
                <span className={c.action === "create" ? "text-green-400" : "text-yellow-400"}>{c.action}</span>
                {" "}{c.filePath}
                <span className="text-green-500 ml-1">+{c.linesAdded}</span>
                <span className="text-red-500 ml-1">-{c.linesRemoved}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="overflow-auto max-h-[55vh] p-3 space-y-2">
        {loading && !diagnostic ? (
          <div className="text-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-400 mx-auto" />
            <p className="text-xs text-slate-400 mt-2">Running diagnostics...</p>
          </div>
        ) : diagnostic ? (
          <>
            {/* Improvements */}
            <div>
              <button
                onClick={() => setExpandedSection(expandedSection === "improvements" ? null : "improvements")}
                className="flex items-center justify-between w-full text-left"
              >
                <h4 className="text-[11px] text-orange-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Improvements ({diagnostic.improvements.length})
                </h4>
                {expandedSection === "improvements" ? <ChevronUp className="h-3 w-3 text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-500" />}
              </button>
              {expandedSection === "improvements" && (
                <div className="mt-2 space-y-1.5">
                  {diagnostic.improvements.map((imp, i) => {
                    const pcfg = PRIORITY_CONFIG[imp.priority];
                    const PIcon = pcfg.icon;
                    const isOverdue = new Date(imp.deadline) < new Date();
                    const isPreviewing = previewingTask === imp.task;
                    const isApplied = appliedTasks.has(imp.task);
                    return (
                      <div key={i} className={`flex items-center gap-2 p-2 rounded-lg border text-[11px] ${
                        isApplied ? "bg-green-500/10 border-green-500/20" :
                        isOverdue ? "bg-slate-800/50 border-red-500/20" : "bg-slate-800/50 border-slate-700"
                      }`}>
                        {isApplied ? (
                          <CheckCircle2 className="h-3 w-3 text-green-400 flex-shrink-0" />
                        ) : (
                          <PIcon className={`h-3 w-3 flex-shrink-0 ${pcfg.color.split(" ")[1]}`} />
                        )}
                        <span className={`flex-1 min-w-0 truncate ${isApplied ? "text-green-300 line-through" : "text-white"}`}>{imp.task}</span>
                        {isApplied ? (
                          <Badge className="bg-green-500/20 text-green-300 text-[9px] px-1 py-0">Done</Badge>
                        ) : (
                          <>
                            <Badge className={`${pcfg.color} text-[9px] px-1 py-0`}>{pcfg.label}</Badge>
                            <button
                              onClick={() => agentExecute(imp.task, imp.priority)}
                              disabled={!!agentRunning || isPreviewing || applyingChanges || batchRunning}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-[9px] font-medium disabled:opacity-50 transition-all flex-shrink-0"
                              title="Agent mode: reads, edits, validates & self-corrects like VSCode"
                            >
                              {agentRunning === imp.task ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Cpu className="h-2.5 w-2.5" />}
                              {agentRunning === imp.task ? "..." : "Agent"}
                            </button>
                            <button
                              onClick={() => previewImprovement(imp.task, imp.priority)}
                              disabled={isPreviewing || applyingChanges || batchRunning || !!agentRunning}
                              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-[9px] font-medium disabled:opacity-50 transition-all flex-shrink-0"
                              title="Preview mode: shows diff before applying"
                            >
                              {isPreviewing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Eye className="h-2.5 w-2.5" />}
                              {isPreviewing ? "..." : "Fix"}
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Completed Features */}
            <div>
              <button
                onClick={() => setExpandedSection(expandedSection === "completed" ? null : "completed")}
                className="flex items-center justify-between w-full text-left"
              >
                <h4 className="text-[11px] text-green-400 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Completed ({diagnostic.completedFeatures.length})
                </h4>
                {expandedSection === "completed" ? <ChevronUp className="h-3 w-3 text-slate-500" /> : <ChevronDown className="h-3 w-3 text-slate-500" />}
              </button>
              {expandedSection === "completed" && (
                <div className="mt-2 space-y-1">
                  {diagnostic.completedFeatures.map((f, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                      <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>

      {/* Agent Live Stream */}
      {(agentRunning || agentEvents.length > 0) && (
        <div className="border-t border-slate-700">
          <div className="p-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bot className="h-3.5 w-3.5 text-green-400" />
              <span className="text-[10px] text-green-400 font-semibold uppercase tracking-wider">
                Agent {agentRunning ? "Working" : "Log"}
              </span>
              {agentPhase && (
                <span className="text-[9px] text-slate-400 font-mono ml-1">{agentPhase}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {agentRunning && <Loader2 className="h-3 w-3 animate-spin text-green-400" />}
              {!agentRunning && (
                <button onClick={() => setAgentEvents([])} className="text-slate-400 hover:text-white text-[10px]">Clear</button>
              )}
            </div>
          </div>
          <div ref={agentLogRef} className="max-h-48 overflow-auto px-2 pb-2 space-y-0.5">
            {agentEvents.map((evt, i) => (
              <AgentEventRow key={i} event={evt} />
            ))}
            {agentRunning && (
              <div className="flex items-center gap-1 text-[10px] text-green-400/60 animate-pulse">
                <span>●</span> Thinking...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
