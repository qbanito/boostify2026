import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { useToast } from "../../hooks/use-toast";
import {
  FileText, Download, Mail, RefreshCw, CheckCircle2, AlertTriangle,
  Clock, Target, TrendingUp, Shield, Zap, Globe, Search,
  ChevronDown, ChevronUp, Send, Copy, ExternalLink, BarChart3,
  AlertCircle, Calendar, Filter, Play, Archive, Code, Timer,
  Cpu, GitCommit, Eye, Undo2, Loader2, Pause,
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
  status: "live" | "beta" | "in-progress" | "planned";
  healthScore: number;
  completedFeatures: string[];
  improvements: Improvement[];
  lastUpdated: string;
}

interface DiagnosticsResponse {
  success: boolean;
  generatedAt: string;
  summary: {
    totalPages: number;
    averageHealthScore: number;
    totalImprovements: number;
    criticalHighItems: number;
    livePages: number;
    betaPages: number;
  };
  diagnostics: PageDiagnostic[];
}

interface CompetitiveScanResponse {
  success: boolean;
  report: string;
  data: any;
  generatedAt: string;
  aiPowered: boolean;
}

interface ImplementationPrompt {
  pageId: string;
  pageName: string;
  prompts: { task: string; priority: string; prompt: string }[];
}

interface SavedReport {
  filename: string;
  type: string;
  generatedAt: string;
  size: number;
  aiPowered: boolean;
}

interface ScheduleStatus {
  recipient: string;
  intervalDays: number;
  nextScheduledRun: string | null;
  lastRunResult: {
    success: boolean;
    filename: string;
    emailSent: boolean;
    error: string | null;
    ranAt: string | null;
  } | null;
  schedulerActive: boolean;
}

const PRIORITY_CONFIG = {
  critical: { color: "bg-red-500/20 text-red-300 border-red-500/30", icon: AlertCircle, label: "Critical" },
  high: { color: "bg-orange-500/20 text-orange-300 border-orange-500/30", icon: AlertTriangle, label: "High" },
  medium: { color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: Clock, label: "Medium" },
  low: { color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: Target, label: "Low" },
};

const STATUS_CONFIG = {
  live: { color: "bg-green-500/20 text-green-300", label: "Live" },
  beta: { color: "bg-purple-500/20 text-purple-300", label: "Beta" },
  "in-progress": { color: "bg-yellow-500/20 text-yellow-300", label: "In Progress" },
  planned: { color: "bg-slate-500/20 text-slate-300", label: "Planned" },
};

export function PlatformReports() {
  const { toast } = useToast();
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResponse | null>(null);
  const [competitiveReport, setCompetitiveReport] = useState<CompetitiveScanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [sending, setSending] = useState(false);
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [emailRecipients, setEmailRecipients] = useState("");
  const [emailSubject, setEmailSubject] = useState("Boostify Platform Report");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [activeView, setActiveView] = useState<"diagnostics" | "competitive" | "timeline" | "prompts" | "saved" | "engine">("diagnostics");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [emailSent, setEmailSent] = useState(false);
  const [implementationPrompts, setImplementationPrompts] = useState<ImplementationPrompt[] | null>(null);
  const [loadingPrompts, setLoadingPrompts] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatus | null>(null);
  const [triggeringWeekly, setTriggeringWeekly] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState<string | null>(null);
  // Code Engine state
  const [engineStatus, setEngineStatus] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [executingTask, setExecutingTask] = useState<string | null>(null);
  const [previewingTask, setPreviewingTask] = useState<string | null>(null);
  const [applyingChanges, setApplyingChanges] = useState(false);
  const [engineLogs, setEngineLogs] = useState<any[]>([]);
  const [engineMessage, setEngineMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [appliedTasks, setAppliedTasks] = useState<Set<string>>(new Set());
  const [autoExecuting, setAutoExecuting] = useState(false);
  const [autoProgress, setAutoProgress] = useState<{ applied: number; total: number; pages: number } | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDiagnostics();
    fetchScheduleStatus();
    fetchEngineStatus();
  }, []);

  // Auto-refresh diagnostics + schedule status every 2 minutes while tab visible.
  useEffect(() => {
    if (!autoRefresh) return;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      fetchDiagnostics({ silent: true });
      fetchScheduleStatus();
    };
    const iv = setInterval(tick, 120_000);
    return () => clearInterval(iv);
  }, [autoRefresh]);

  const fetchDiagnostics = async (opts?: { silent?: boolean }) => {
    if (opts?.silent) setRefreshing(true); else setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/admin/reports/diagnostics", { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setDiagnostics(data);
        setLastRefreshAt(new Date());
      } else {
        throw new Error(data?.error || 'Diagnostics response missing success flag');
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setFetchError(msg);
      if (!opts?.silent) {
        toast({ title: 'Diagnostics failed', description: msg, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const runCompetitiveScan = async (category = "all") => {
    setScanning(true);
    try {
      const res = await fetch("/api/admin/reports/competitive-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category }),
      });
      const data = await res.json();
      if (data.success) setCompetitiveReport(data);
    } catch (err) {
      console.error("Failed to run competitive scan:", err);
    } finally {
      setScanning(false);
    }
  };

  const fetchScheduleStatus = async () => {
    try {
      const res = await fetch("/api/admin/reports/schedule-status", { credentials: "include" });
      const data = await res.json();
      if (data.success) setScheduleStatus(data);
    } catch (err) {
      console.error("Failed to fetch schedule status:", err);
    }
  };

  const fetchImplementationPrompts = async (pageId?: string) => {
    setLoadingPrompts(true);
    try {
      const res = await fetch("/api/admin/reports/generate-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pageId }),
      });
      const data = await res.json();
      if (data.success) setImplementationPrompts(data.prompts);
    } catch (err) {
      console.error("Failed to fetch prompts:", err);
    } finally {
      setLoadingPrompts(false);
    }
  };

  const fetchSavedReports = async () => {
    try {
      const res = await fetch("/api/admin/reports/saved", { credentials: "include" });
      const data = await res.json();
      if (data.success) setSavedReports(data.reports);
    } catch (err) {
      console.error("Failed to fetch saved reports:", err);
    }
  };

  const triggerWeeklyReport = async () => {
    setTriggeringWeekly(true);
    try {
      const res = await fetch("/api/admin/reports/trigger-weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        fetchScheduleStatus();
        fetchSavedReports();
      }
    } catch (err) {
      console.error("Failed to trigger weekly report:", err);
    } finally {
      setTriggeringWeekly(false);
    }
  };

  const copyPromptToClipboard = (prompt: string, taskId: string) => {
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(taskId);
    setTimeout(() => setCopiedPrompt(null), 2000);
  };

  // ─── Code Engine Functions ──────────────────────────────────
  const fetchEngineStatus = async () => {
    try {
      const res = await fetch("/api/admin/code-engine/status", { credentials: "include" });
      const data = await res.json();
      if (data.success) setEngineStatus(data);
    } catch (err) {
      console.error("Failed to fetch engine status:", err);
    }
  };

  const fetchEngineLogs = async () => {
    try {
      const res = await fetch("/api/admin/code-engine/logs", { credentials: "include" });
      const data = await res.json();
      if (data.success) setEngineLogs(data.logs);
    } catch (err) {
      console.error("Failed to fetch engine logs:", err);
    }
  };

  const previewImprovement = async (pageId: string, task: string, priority: string, prompt?: string) => {
    const taskKey = `${pageId}-${task}`;
    setPreviewingTask(taskKey);
    setPreviewData(null);
    setEngineMessage(null);
    try {
      const res = await fetch("/api/admin/code-engine/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pageId, task, priority, implementationPrompt: prompt }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewData({ ...data, pageId, task });
        setEngineMessage({ type: "info", text: `Preview ready: ${data.filesAffected} file(s) via ${data.provider} (${data.model})` });
      } else {
        setEngineMessage({ type: "error", text: data.error || "Preview failed" });
      }
    } catch (err: any) {
      setEngineMessage({ type: "error", text: err.message });
    } finally {
      setPreviewingTask(null);
    }
  };

  const applyPreviewedChanges = async () => {
    if (!previewData?.rawChanges) return;
    setApplyingChanges(true);
    setEngineMessage(null);
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
        const fileList = data.fileDetails?.map((f: any) => `  • ${f.action}: ${f.filePath}`).join("\n") || "";
        setEngineMessage({
          type: "success",
          text: `${data.message || "Applied!"}\n\nFiles modified:\n${fileList}`,
        });
        // Track applied task
        if (previewData.task && previewData.pageId) {
          setAppliedTasks(prev => new Set(prev).add(`${previewData.pageId}-${previewData.task}`));
        }
        setPreviewData(null);
        fetchEngineLogs();
        fetchEngineStatus();
        // Refresh diagnostics to reflect changes
        fetchDiagnostics();
      } else {
        if (data.tsErrors) {
          setEngineMessage({ type: "error", text: `TypeScript errors — rolled back:\n${data.tsErrors.slice(0, 500)}` });
        } else {
          setEngineMessage({ type: "error", text: data.error || "Apply failed" });
        }
      }
    } catch (err: any) {
      setEngineMessage({ type: "error", text: err.message });
    } finally {
      setApplyingChanges(false);
    }
  };

  const rollbackCommit = async (commitHash: string) => {
    try {
      const res = await fetch("/api/admin/code-engine/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ commitHash }),
      });
      const data = await res.json();
      if (data.success) {
        setEngineMessage({ type: "success", text: `Reverted ${commitHash} → ${data.newCommit}` });
        fetchEngineLogs();
      } else {
        setEngineMessage({ type: "error", text: data.error });
      }
    } catch (err: any) {
      setEngineMessage({ type: "error", text: err.message });
    }
  };

  const sendEmailReport = async () => {
    if (!emailRecipients.trim()) return;
    setSending(true);
    setEmailSent(false);
    try {
      const recipients = emailRecipients.split(",").map((e) => e.trim()).filter(Boolean);
      const reportHtml = generateEmailHtml();
      const res = await fetch("/api/admin/reports/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipients, subject: emailSubject, reportHtml }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 5000);
      }
    } catch (err) {
      console.error("Failed to send email:", err);
    } finally {
      setSending(false);
    }
  };

  const generateEmailHtml = (): string => {
    if (!diagnostics) return "";
    const d = diagnostics;
    let html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="color: #fb923c; font-size: 28px; margin: 0;">Boostify Platform Report</h1>
          <p style="color: #94a3b8; font-size: 14px;">Generated: ${new Date(d.generatedAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>

        <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 120px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #fb923c;">${d.summary.totalPages}</div>
            <div style="font-size: 12px; color: #94a3b8;">Total Pages</div>
          </div>
          <div style="flex: 1; min-width: 120px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: ${d.summary.averageHealthScore >= 75 ? '#4ade80' : '#fbbf24'};">${d.summary.averageHealthScore}%</div>
            <div style="font-size: 12px; color: #94a3b8;">Avg Health</div>
          </div>
          <div style="flex: 1; min-width: 120px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; text-align: center;">
            <div style="font-size: 28px; font-weight: bold; color: #f87171;">${d.summary.criticalHighItems}</div>
            <div style="font-size: 12px; color: #94a3b8;">Critical/High</div>
          </div>
        </div>

        <h2 style="color: #fb923c; font-size: 20px; border-bottom: 1px solid #334155; padding-bottom: 8px;">Page Diagnostics</h2>
    `;

    for (const page of d.diagnostics) {
      const scoreColor = page.healthScore >= 80 ? "#4ade80" : page.healthScore >= 60 ? "#fbbf24" : "#f87171";
      html += `
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin: 12px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="color: #f1f5f9; margin: 0; font-size: 16px;">${page.name}</h3>
            <span style="color: ${scoreColor}; font-weight: bold; font-size: 18px;">${page.healthScore}%</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 4px 0;">${page.route} | ${page.category} | Status: ${page.status}</p>
          ${page.improvements.length > 0 ? `
            <div style="margin-top: 12px;">
              <p style="color: #fb923c; font-size: 13px; font-weight: 600; margin-bottom: 6px;">Improvements Needed:</p>
              ${page.improvements
                .map((imp) => {
                  const pColor = imp.priority === "critical" ? "#f87171" : imp.priority === "high" ? "#fb923c" : imp.priority === "medium" ? "#fbbf24" : "#60a5fa";
                  return `<div style="display: flex; align-items: center; gap: 8px; margin: 4px 0; font-size: 13px;">
                    <span style="color: ${pColor}; font-weight: 600; text-transform: uppercase; font-size: 10px; min-width: 55px;">[${imp.priority}]</span>
                    <span style="color: #e2e8f0; flex: 1;">${imp.task}</span>
                    <span style="color: #94a3b8; font-size: 11px;">Due: ${imp.deadline}</span>
                  </div>`;
                })
                .join("")}
            </div>
          ` : ""}
        </div>
      `;
    }

    if (competitiveReport) {
      html += `
        <h2 style="color: #fb923c; font-size: 20px; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-top: 32px;">Competitive Intelligence</h2>
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; white-space: pre-wrap; font-size: 13px; line-height: 1.6;">
          ${competitiveReport.report.replace(/\n/g, "<br>").replace(/#{1,3} /g, '<span style="color: #fb923c; font-weight: bold;">')}
        </div>
      `;
    }

    html += `
        <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #334155;">
          <p style="color: #64748b; font-size: 12px;">Boostify Music - Enterprise Control Hub</p>
        </div>
      </div>
    `;
    return html;
  };

  const handleDownload = () => {
    if (!diagnostics) return;
    const content = generateDownloadContent();
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boostify-report-${new Date().toISOString().split("T")[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateDownloadContent = (): string => {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Boostify Platform Report</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f172a;color:#e2e8f0;padding:32px;margin:0;}
@media print{body{background:white;color:#1e293b}h1,h2,h3{color:#ea580c!important}.card{border:1px solid #d1d5db!important;background:#f8fafc!important}}
</style></head><body>${generateEmailHtml()}</body></html>`;
  };

  const copyReport = () => {
    if (!diagnostics) return;
    let text = `BOOSTIFY PLATFORM REPORT\nGenerated: ${new Date().toLocaleDateString()}\n\n`;
    text += `SUMMARY: ${diagnostics.summary.totalPages} pages | Avg Health: ${diagnostics.summary.averageHealthScore}% | ${diagnostics.summary.criticalHighItems} critical/high items\n\n`;
    for (const page of diagnostics.diagnostics) {
      text += `--- ${page.name} (${page.healthScore}%) [${page.status}] ---\n`;
      text += `Route: ${page.route} | Category: ${page.category}\n`;
      text += `Completed: ${page.completedFeatures.join(", ")}\n`;
      if (page.improvements.length) {
        text += `Improvements:\n`;
        for (const imp of page.improvements) {
          text += `  [${imp.priority.toUpperCase()}] ${imp.task} - Due: ${imp.deadline}\n`;
        }
      }
      text += "\n";
    }
    navigator.clipboard.writeText(text);
  };

  const togglePage = (id: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-400";
    if (score >= 70) return "text-yellow-400";
    if (score >= 50) return "text-orange-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 85) return "bg-green-500";
    if (score >= 70) return "bg-yellow-500";
    if (score >= 50) return "bg-orange-500";
    return "bg-red-500";
  };

  const categories = diagnostics
    ? ["all", ...Array.from(new Set(diagnostics.diagnostics.map((d) => d.category)))]
    : ["all"];

  const filteredDiagnostics = diagnostics?.diagnostics.filter(
    (d) => filterCategory === "all" || d.category === filterCategory
  );

  if (loading) {
    return (
      <Card className="bg-slate-900/80 border-orange-500/20">
        <CardContent className="pt-6 flex items-center justify-center py-12">
          <RefreshCw className="h-5 w-5 text-orange-400 animate-spin mr-2" />
          <span className="text-slate-400">Loading platform diagnostics...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" ref={reportRef}>
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-orange-400 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Platform Reports & Diagnostics
            {refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-300" />}
          </h2>
          {diagnostics && (
            <p className="text-xs text-slate-400 mt-1">
              Generated: {new Date(diagnostics.generatedAt).toLocaleString()}
              {lastRefreshAt && (
                <span className="ml-2 text-slate-500">
                  · Last refresh {lastRefreshAt.toLocaleTimeString()}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className={`text-xs ${autoRefresh ? 'border-green-500/30 text-green-300 hover:bg-green-500/10' : 'border-slate-600 text-slate-400 hover:bg-slate-800'}`}
            onClick={() => {
              setAutoRefresh(v => !v);
              toast({
                title: autoRefresh ? 'Auto-refresh paused' : 'Auto-refresh enabled',
                description: autoRefresh ? 'Diagnostics will not refresh automatically' : 'Refreshing every 2 minutes',
              });
            }}
            title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
          >
            {autoRefresh ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
            Auto
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-orange-500/30 hover:bg-orange-500/10 text-xs"
            onClick={() => fetchDiagnostics()}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-orange-500/30 hover:bg-orange-500/10 text-xs"
            onClick={copyReport}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-orange-500/30 hover:bg-orange-500/10 text-xs"
            onClick={handleDownload}
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs"
            onClick={() => setShowEmailForm(!showEmailForm)}
          >
            <Mail className="h-3 w-3 mr-1" />
            Email Report
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {fetchError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-300">Could not load diagnostics</p>
            <p className="text-xs text-red-200/80 mt-0.5 break-words">{fetchError}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs h-7 flex-shrink-0"
            onClick={() => fetchDiagnostics()}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} /> Retry
          </Button>
        </div>
      )}

      {/* Email Form */}
      {showEmailForm && (
        <Card className="bg-slate-900/80 border-orange-500/20">
          <CardContent className="pt-4 space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Recipients (comma separated)</label>
              <input
                type="text"
                value={emailRecipients}
                onChange={(e) => setEmailRecipients(e.target.value)}
                placeholder="dev@team.com, investor@company.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Subject</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={sendEmailReport}
                disabled={sending || !emailRecipients.trim()}
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white"
              >
                {sending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                {sending ? "Sending..." : "Send Report"}
              </Button>
              {emailSent && (
                <span className="text-green-400 text-xs flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Report sent successfully!
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      {diagnostics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Pages", value: diagnostics.summary.totalPages, icon: BarChart3, color: "text-orange-400" },
            { label: "Avg Health", value: `${diagnostics.summary.averageHealthScore}%`, icon: TrendingUp, color: getScoreColor(diagnostics.summary.averageHealthScore) },
            { label: "Improvements", value: diagnostics.summary.totalImprovements, icon: Target, color: "text-yellow-400" },
            { label: "Critical/High", value: diagnostics.summary.criticalHighItems, icon: AlertTriangle, color: "text-red-400" },
            { label: "Live", value: diagnostics.summary.livePages, icon: CheckCircle2, color: "text-green-400" },
            { label: "Beta", value: diagnostics.summary.betaPages, icon: Zap, color: "text-purple-400" },
          ].map((stat) => (
            <Card key={stat.label} className="bg-slate-900/60 border-slate-700/50">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider">{stat.label}</span>
                </div>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Weekly Scheduler Status */}
      {scheduleStatus && (
        <Card className="bg-gradient-to-r from-slate-900/80 to-purple-900/20 border-purple-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${scheduleStatus.schedulerActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <div>
                  <p className="text-sm text-white font-medium flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5 text-purple-400" />
                    Auto Weekly Report
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Sends every {scheduleStatus.intervalDays} days to <span className="text-purple-300">{scheduleStatus.recipient}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  {scheduleStatus.nextScheduledRun && (
                    <p className="text-[10px] text-slate-400">
                      Next: {new Date(scheduleStatus.nextScheduledRun).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  {scheduleStatus.lastRunResult && (
                    <p className={`text-[10px] ${scheduleStatus.lastRunResult.emailSent ? 'text-green-400' : 'text-red-400'}`}>
                      Last: {scheduleStatus.lastRunResult.emailSent ? '✅ Sent' : '❌ Failed'}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={triggerWeeklyReport}
                  disabled={triggeringWeekly}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs"
                >
                  {triggeringWeekly ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                  {triggeringWeekly ? "Generating..." : "Send Now"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Tabs */}
      <div className="flex gap-1 p-1 bg-slate-900/60 border border-slate-700/50 rounded-lg w-full overflow-x-auto scrollbar-hide">
        {[
          { key: "diagnostics" as const, label: "Diagnostics", icon: FileText },
          { key: "timeline" as const, label: "Timeline", icon: Calendar },
          { key: "competitive" as const, label: "Intel", icon: Search },
          { key: "prompts" as const, label: "Prompts", icon: Code },
          { key: "engine" as const, label: "Engine", icon: Cpu },
          { key: "saved" as const, label: "Saved", icon: Archive },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveView(tab.key);
              if (tab.key === "competitive" && !competitiveReport) runCompetitiveScan();
              if (tab.key === "prompts" && !implementationPrompts) fetchImplementationPrompts();
              if (tab.key === "saved" && savedReports.length === 0) fetchSavedReports();
              if (tab.key === "engine") { fetchEngineStatus(); fetchEngineLogs(); }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${
              activeView === tab.key
                ? "bg-orange-500 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Diagnostics View */}
      {activeView === "diagnostics" && filteredDiagnostics && (
        <div className="space-y-3">
          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  filterCategory === cat
                    ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                    : "bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-orange-500/30"
                }`}
              >
                {cat === "all" ? "All" : cat}
              </button>
            ))}
          </div>

          {filteredDiagnostics.map((page) => {
            const isExpanded = expandedPages.has(page.id);
            const statusCfg = STATUS_CONFIG[page.status];
            return (
              <Card key={page.id} className="bg-slate-900/60 border-slate-700/50 hover:border-orange-500/20 transition-colors">
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => togglePage(page.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Health Score Circle */}
                      <div className="relative flex-shrink-0">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center border-2 ${
                          page.healthScore >= 85 ? "border-green-500/50 bg-green-500/10" :
                          page.healthScore >= 70 ? "border-yellow-500/50 bg-yellow-500/10" :
                          page.healthScore >= 50 ? "border-orange-500/50 bg-orange-500/10" :
                          "border-red-500/50 bg-red-500/10"
                        }`}>
                          <span className={`text-sm font-bold ${getScoreColor(page.healthScore)}`}>
                            {page.healthScore}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-white text-sm truncate max-w-[200px] sm:max-w-none">{page.name}</h3>
                          <Badge className={`${statusCfg.color} text-[10px] px-1.5 py-0`}>
                            {statusCfg.label}
                          </Badge>
                          <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">{page.route}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[11px] text-slate-400">{page.category}</span>
                          <span className="text-[11px] text-slate-500">
                            {page.completedFeatures.length} features | {page.improvements.length} to-do
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {page.improvements.filter((i) => i.priority === "critical" || i.priority === "high").length > 0 && (
                        <Badge className="bg-red-500/15 text-red-400 border-red-500/20 text-[10px]">
                          {page.improvements.filter((i) => i.priority === "critical" || i.priority === "high").length} urgent
                        </Badge>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Health Bar */}
                  <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${getScoreBg(page.healthScore)}`}
                      style={{ width: `${page.healthScore}%` }}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-700/50 pt-3 space-y-4">
                    {/* Completed Features */}
                    <div>
                      <h4 className="text-xs text-green-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Completed Features
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {page.completedFeatures.map((f, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                            <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Improvements */}
                    {page.improvements.length > 0 && (
                      <div>
                        <h4 className="text-xs text-orange-400 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Improvements & Deadlines
                        </h4>
                        <div className="space-y-2">
                          {page.improvements.map((imp, i) => {
                            const pcfg = PRIORITY_CONFIG[imp.priority];
                            const PIcon = pcfg.icon;
                            const isOverdue = new Date(imp.deadline) < new Date();
                            const taskKey = `${page.id}-${imp.task}`;
                            const isThisPreview = previewingTask === taskKey;
                            const isApplied = appliedTasks.has(taskKey);
                            return (
                              <div
                                key={i}
                                className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-2.5 rounded-lg border ${
                                  isApplied ? "bg-green-500/10 border-green-500/30" :
                                  isOverdue ? "bg-slate-800/50 border-red-500/30" : "bg-slate-800/50 border-slate-700"
                                }`}
                              >
                              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                                {isApplied ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-400" />
                                ) : (
                                  <PIcon className={`h-3.5 w-3.5 flex-shrink-0 ${pcfg.color.split(" ")[1]}`} />
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className={`text-xs ${isApplied ? "text-green-300 line-through" : "text-white"}`}>{imp.task}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap pl-5 sm:pl-0">
                                {isApplied ? (
                                  <Badge className="bg-green-500/20 text-green-300 text-[10px] px-1.5 py-0 flex-shrink-0">
                                    Applied
                                  </Badge>
                                ) : (
                                  <Badge className={`${pcfg.color} text-[10px] px-1.5 py-0 flex-shrink-0`}>
                                    {pcfg.label}
                                  </Badge>
                                )}
                                <span className={`text-[10px] flex-shrink-0 font-mono ${isApplied ? "text-green-400" : isOverdue ? "text-red-400" : "text-slate-400"}`}>
                                  {isApplied ? "✓ Done" : isOverdue ? "⚠ " + imp.deadline : imp.deadline}
                                </span>
                                {!isApplied && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); previewImprovement(page.id, imp.task, imp.priority); }}
                                    disabled={isThisPreview || !!executingTask}
                                    className="flex items-center gap-1 px-2 py-1 rounded-md bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-[10px] font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0"
                                    title="Generate AI code changes for this task"
                                  >
                                    {isThisPreview ? <Loader2 className="h-3 w-3 animate-spin" /> : <Cpu className="h-3 w-3" />}
                                    {isThisPreview ? "AI..." : "Execute"}
                                  </button>
                                )}
                              </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Timeline View */}
      {activeView === "timeline" && diagnostics && (
        <Card className="bg-slate-900/60 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Improvement Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {diagnostics.diagnostics
                .flatMap((page) =>
                  page.improvements.map((imp) => ({ ...imp, pageName: page.name, pageId: page.id }))
                )
                .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
                .map((item, i) => {
                  const pcfg = PRIORITY_CONFIG[item.priority];
                  const isOverdue = new Date(item.deadline) < new Date();
                  const isThisWeek = (() => {
                    const d = new Date(item.deadline);
                    const now = new Date();
                    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                    return d >= now && d <= weekEnd;
                  })();
                  return (
                    <div
                      key={i}
                      className={`flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 p-2.5 rounded-lg border transition-colors ${
                        isOverdue
                          ? "bg-red-500/5 border-red-500/20"
                          : isThisWeek
                          ? "bg-orange-500/5 border-orange-500/20"
                          : "bg-slate-800/30 border-slate-700/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          item.priority === "critical" ? "bg-red-500" :
                          item.priority === "high" ? "bg-orange-500" :
                          item.priority === "medium" ? "bg-yellow-500" : "bg-blue-500"
                        }`} />
                        <span className={`text-[10px] font-mono flex-shrink-0 ${isOverdue ? "text-red-400 font-bold" : "text-slate-400"}`}>
                          {item.deadline}
                        </span>
                        <Badge className={`${pcfg.color} text-[10px] px-1.5 py-0 flex-shrink-0`}>
                          {pcfg.label}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 flex-1 min-w-0 pl-4 sm:pl-0">
                        <span className="text-xs text-slate-300 flex-1 min-w-0 truncate">{item.task}</span>
                        <span className="text-[10px] text-slate-500 flex-shrink-0">{item.pageName}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Competitive Intelligence View */}
      {activeView === "competitive" && (
        <div className="space-y-4">
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  OpenClaw Competitive Intelligence
                </CardTitle>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {["all", "competitors", "technologies", "trends"].map((cat) => (
                    <Button
                      key={cat}
                      size="sm"
                      variant="outline"
                      className="border-slate-700 text-xs capitalize h-7 px-2 sm:px-3"
                      onClick={() => runCompetitiveScan(cat)}
                      disabled={scanning}
                    >
                      {cat}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {scanning ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-5 w-5 text-orange-400 animate-spin mr-2" />
                  <span className="text-slate-400">Scanning competitive landscape...</span>
                </div>
              ) : competitiveReport ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>Generated: {new Date(competitiveReport.generatedAt).toLocaleString()}</span>
                    {competitiveReport.aiPowered && (
                      <Badge className="bg-purple-500/20 text-purple-300 text-[10px]">AI-Powered</Badge>
                    )}
                  </div>

                  {/* Report Content */}
                  <div className="prose prose-invert prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-xs text-slate-300 bg-slate-800/50 p-4 rounded-lg border border-slate-700 leading-relaxed overflow-auto max-h-[500px]">
                      {competitiveReport.report}
                    </pre>
                  </div>

                  {/* Data Tables */}
                  {competitiveReport.data?.competitors && (
                    <div>
                      <h4 className="text-xs text-orange-400 font-semibold uppercase tracking-wider mb-2">Competitor Matrix</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-700">
                              <th className="text-left py-2 px-3 text-slate-400">Company</th>
                              <th className="text-left py-2 px-3 text-slate-400">Focus</th>
                              <th className="text-left py-2 px-3 text-slate-400">Pricing</th>
                              <th className="text-left py-2 px-3 text-slate-400">Threat</th>
                              <th className="text-left py-2 px-3 text-slate-400">Weakness</th>
                            </tr>
                          </thead>
                          <tbody>
                            {competitiveReport.data.competitors.map((c: any) => (
                              <tr key={c.name} className="border-b border-slate-800 hover:bg-slate-800/50">
                                <td className="py-2 px-3 text-white font-medium">{c.name}</td>
                                <td className="py-2 px-3 text-slate-300">{c.focus}</td>
                                <td className="py-2 px-3 text-slate-300">{c.pricing}</td>
                                <td className="py-2 px-3">
                                  <Badge className={`text-[10px] px-1.5 py-0 ${
                                    c.threat === "high" ? "bg-red-500/20 text-red-300" :
                                    c.threat === "medium" ? "bg-yellow-500/20 text-yellow-300" :
                                    "bg-green-500/20 text-green-300"
                                  }`}>{c.threat}</Badge>
                                </td>
                                <td className="py-2 px-3 text-slate-400">{c.weakness}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {competitiveReport.data?.technologies && (
                    <div>
                      <h4 className="text-xs text-orange-400 font-semibold uppercase tracking-wider mb-2">Technology Position</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {competitiveReport.data.technologies.map((t: any) => (
                          <div key={t.tech} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-white font-medium">{t.tech}</span>
                              <Badge className="bg-green-500/20 text-green-300 text-[10px]">{t.status}</Badge>
                            </div>
                            <p className="text-[11px] text-slate-400">Leaders: {t.leaders.join(", ")}</p>
                            <p className="text-[11px] text-orange-300 mt-1">→ {t.opportunity}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {competitiveReport.data?.boostifyAdvantages && (
                    <div>
                      <h4 className="text-xs text-orange-400 font-semibold uppercase tracking-wider mb-2">Our Competitive Advantages</h4>
                      <div className="space-y-1.5">
                        {competitiveReport.data.boostifyAdvantages.map((a: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Shield className="h-3 w-3 text-green-400 flex-shrink-0" />
                            <span className="text-slate-300">{a}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Search className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Click a category above to scan the competitive landscape</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Implementation Prompts View */}
      {activeView === "prompts" && (
        <div className="space-y-4">
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Implementation Prompts
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-orange-500/30 hover:bg-orange-500/10 text-xs"
                  onClick={() => fetchImplementationPrompts()}
                  disabled={loadingPrompts}
                >
                  {loadingPrompts ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                  Regenerate
                </Button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Copy these prompts into your AI coding assistant to implement each improvement task.</p>
            </CardHeader>
            <CardContent>
              {loadingPrompts ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-5 w-5 text-orange-400 animate-spin mr-2" />
                  <span className="text-slate-400">Generating implementation prompts...</span>
                </div>
              ) : implementationPrompts ? (
                <div className="space-y-6">
                  {implementationPrompts.map((pagePrompts) => (
                    <div key={pagePrompts.pageId}>
                      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-orange-400" />
                        {pagePrompts.pageName}
                        <Badge className="bg-slate-700 text-slate-300 text-[10px]">{pagePrompts.prompts.length} tasks</Badge>
                      </h3>
                      <div className="space-y-3">
                        {pagePrompts.prompts.map((p, i) => {
                          const pColor = p.priority === "critical" ? "text-red-400" : p.priority === "high" ? "text-orange-400" : p.priority === "medium" ? "text-yellow-400" : "text-blue-400";
                          const taskId = `${pagePrompts.pageId}-${i}`;
                          return (
                            <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 border-b border-slate-700">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`text-[10px] font-bold uppercase ${pColor} flex-shrink-0`}>[{p.priority}]</span>
                                  <span className="text-xs text-white truncate">{p.task}</span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs h-7 px-2"
                                  onClick={() => copyPromptToClipboard(p.prompt, taskId)}
                                >
                                  {copiedPrompt === taskId ? (
                                    <><CheckCircle2 className="h-3 w-3 text-green-400 mr-1" /> Copied!</>
                                  ) : (
                                    <><Copy className="h-3 w-3 mr-1" /> Copy Prompt</>
                                  )}
                                </Button>
                              </div>
                              <pre className="p-3 text-[11px] text-slate-300 whitespace-pre-wrap overflow-auto max-h-48 leading-relaxed font-mono">
                                {p.prompt}
                              </pre>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Code className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Click "Regenerate" to generate implementation prompts</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Code Engine Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center sm:p-4" onClick={() => setPreviewData(null)}>
          <div className="bg-slate-900 border border-cyan-500/30 rounded-t-xl sm:rounded-xl w-full sm:max-w-4xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden shadow-2xl shadow-cyan-500/10" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-3 sm:p-4 border-b border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                  <Cpu className="h-4 w-4 text-cyan-400" />
                  Code Engine Preview
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {previewData.provider} ({previewData.model}) · {previewData.filesAffected} file(s) · {previewData.tokensUsed || "?"} tokens
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={applyPreviewedChanges}
                  disabled={applyingChanges}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-xs flex-1 sm:flex-none"
                >
                  {applyingChanges ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <GitCommit className="h-3 w-3 mr-1" />}
                  {applyingChanges ? "Applying..." : "Apply & Commit"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-600 text-xs"
                  onClick={() => setPreviewData(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
            {/* Task Info */}
            <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700">
              <p className="text-xs text-cyan-300 font-medium">{previewData.task}</p>
              <p className="text-[10px] text-slate-400">Page: {previewData.pageId}</p>
            </div>
            {/* Diff View */}
            <div className="overflow-auto max-h-[60vh] p-4 space-y-4">
              {previewData.changes?.map((change: any, idx: number) => (
                <div key={idx} className="border border-slate-700 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                    <span className="text-xs text-white font-mono">{change.filePath}</span>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[9px] px-1.5 py-0 ${change.action === "create" ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"}`}>
                        {change.action}
                      </Badge>
                      <span className="text-[10px] text-green-400">+{change.linesAdded}</span>
                      <span className="text-[10px] text-red-400">-{change.linesRemoved}</span>
                    </div>
                  </div>
                  <pre className="p-3 text-[11px] font-mono leading-relaxed overflow-auto max-h-72 bg-slate-950">
                    {change.diff.split("\n").map((line: string, li: number) => (
                      <div
                        key={li}
                        className={`${
                          line.startsWith("+") ? "text-green-400 bg-green-500/5" :
                          line.startsWith("-") ? "text-red-400 bg-red-500/5" :
                          line.startsWith("@") ? "text-cyan-400" :
                          "text-slate-400"
                        }`}
                      >
                        {line}
                      </div>
                    ))}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Engine Status Message */}
      {engineMessage && (
        <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
          engineMessage.type === "success" ? "bg-green-500/10 border-green-500/30 text-green-300" :
          engineMessage.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-300" :
          "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
        }`}>
          {engineMessage.type === "success" ? <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" /> :
           engineMessage.type === "error" ? <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> :
           <Cpu className="h-3.5 w-3.5 flex-shrink-0" />}
          <span className="flex-1 whitespace-pre-wrap">{engineMessage.text}</span>
          <button onClick={() => setEngineMessage(null)} className="text-slate-400 hover:text-white ml-2">✕</button>
        </div>
      )}

      {/* Code Engine View */}
      {activeView === "engine" && (
        <div className="space-y-4">
          {/* Engine Status */}
          <Card className="bg-gradient-to-r from-slate-900/80 to-cyan-900/20 border-cyan-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-cyan-400" />
                    AI Code Engine
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {engineStatus?.activeProvider ? (
                      <>Active: <span className="text-cyan-300">{engineStatus.activeProvider}</span></>
                    ) : "No AI provider configured"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {engineStatus?.providers && Object.entries(engineStatus.providers).map(([key, p]: [string, any]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${p.available ? 'bg-green-500' : 'bg-slate-600'}`} />
                      <span className="text-[10px] text-slate-400">{key}: {p.model}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How it works */}
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardContent className="pt-4 pb-3">
              <h4 className="text-xs text-cyan-400 font-semibold uppercase tracking-wider mb-3">How It Works</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { step: "1", title: "Click Execute", desc: "On any improvement task in Diagnostics", icon: Cpu },
                  { step: "2", title: "AI Generates Code", desc: "Claude reads your codebase and writes changes", icon: Code },
                  { step: "3", title: "Preview Diff", desc: "Review the exact changes before applying", icon: Eye },
                  { step: "4", title: "Apply & Commit", desc: "TypeScript validates, then auto-commits", icon: GitCommit },
                ].map((s) => (
                  <div key={s.step} className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-center">
                    <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-2">
                      <s.icon className="h-4 w-4 text-cyan-400" />
                    </div>
                    <p className="text-xs text-white font-medium">{s.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Execution Logs */}
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
                  <GitCommit className="h-4 w-4" />
                  Execution History
                </CardTitle>
                <Button size="sm" variant="outline" className="border-slate-700 text-xs" onClick={fetchEngineLogs}>
                  <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {engineLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Cpu className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-xs">No executions yet. Click "Execute" on any improvement task in Diagnostics to start.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {engineLogs.map((log) => (
                    <div key={log.id} className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg border ${
                      log.status === "committed" ? "bg-green-500/5 border-green-500/20" :
                      log.status === "applied" ? "bg-cyan-500/5 border-cyan-500/20" :
                      log.status === "rolled-back" ? "bg-red-500/5 border-red-500/20" :
                      log.status === "preview" ? "bg-slate-800/50 border-slate-700" :
                      "bg-red-500/5 border-red-500/20"
                    }`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          log.status === "committed" ? "bg-green-500" :
                          log.status === "applied" ? "bg-cyan-500" :
                          log.status === "rolled-back" ? "bg-orange-500" :
                          log.status === "preview" ? "bg-slate-500" :
                          "bg-red-500"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{log.task}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-slate-400">{log.pageId}</span>
                            <span className="text-[10px] text-slate-500 hidden sm:inline">·</span>
                            <span className="text-[10px] text-slate-400">{log.filesChanged?.length || 0} files</span>
                            {log.commitHash && <span className="text-[10px] text-green-400 font-mono truncate max-w-[100px]">{log.commitHash}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap pl-5 sm:pl-0">
                        <Badge className={`text-[9px] px-1.5 py-0 ${
                          log.status === "committed" ? "bg-green-500/20 text-green-300" :
                          log.status === "applied" ? "bg-cyan-500/20 text-cyan-300" :
                          log.status === "rolled-back" ? "bg-orange-500/20 text-orange-300" :
                          "bg-slate-500/20 text-slate-300"
                        }`}>{log.status}</Badge>
                        <span className="text-[10px] text-slate-500 flex-shrink-0">
                          {new Date(log.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {log.commitHash && log.status === "committed" && (
                          <button
                            onClick={() => rollbackCommit(log.commitHash)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-orange-400 hover:bg-orange-500/10 border border-orange-500/20 flex-shrink-0"
                            title="Revert this commit"
                          >
                            <Undo2 className="h-3 w-3" /> Revert
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Saved Reports View */}
      {activeView === "saved" && (
        <div className="space-y-4">
          <Card className="bg-slate-900/60 border-slate-700/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
                  <Archive className="h-4 w-4" />
                  Saved Reports Archive
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-orange-500/30 hover:bg-orange-500/10 text-xs"
                  onClick={fetchSavedReports}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {savedReports.length === 0 ? (
                <div className="text-center py-12">
                  <Archive className="h-8 w-8 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">No saved reports yet. Trigger a weekly report or run a competitive scan.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedReports.map((report) => (
                    <div key={report.filename} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-800/50 border border-slate-700 rounded-lg hover:border-orange-500/20 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          report.type === "weekly" ? "bg-purple-500/20" :
                          report.type === "competitive" ? "bg-blue-500/20" :
                          "bg-orange-500/20"
                        }`}>
                          {report.type === "weekly" ? <Mail className="h-4 w-4 text-purple-400" /> :
                           report.type === "competitive" ? <Search className="h-4 w-4 text-blue-400" /> :
                           <Code className="h-4 w-4 text-orange-400" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-white font-medium truncate">{report.filename}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge className={`text-[9px] px-1 py-0 ${
                              report.type === "weekly" ? "bg-purple-500/20 text-purple-300" :
                              report.type === "competitive" ? "bg-blue-500/20 text-blue-300" :
                              "bg-orange-500/20 text-orange-300"
                            }`}>{report.type}</Badge>
                            {report.aiPowered && <Badge className="bg-green-500/20 text-green-300 text-[9px] px-1 py-0">AI</Badge>}
                            <span className="text-[10px] text-slate-500">{(report.size / 1024).toFixed(1)} KB</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {new Date(report.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
