/**
 * MCPApiKeysManager — Admin panel component for managing MCP API keys
 *
 * Allows admins (and eventually artists) to:
 *  - View their API keys (prefix + metadata; never the raw key)
 *  - Create new keys (raw key shown once in a modal)
 *  - Toggle active/inactive
 *  - Delete (revoke) keys
 *
 * Design: dark theme, orange-500 accents, slate backgrounds — matches admin panel.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Key, Plus, Trash2, RefreshCw, Copy, Eye, EyeOff,
  Loader2, Check, Shield, Zap, Clock, Power,
  ToggleLeft, ToggleRight, X, Activity, Server, PlayCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type MCPApiKeyScope = "tools:read" | "tools:execute" | "sse:connect";

interface MCPApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  scopes: MCPApiKeyScope[];
  rateLimit: number;
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface CreatedKey extends MCPApiKey {
  key: string;   // raw key — shown once
  warning: string;
}

interface TestResult {
  success: boolean;
  reachable?: { tools: number; categories: number; transports: string[] };
  checks?: { name: string; ok: boolean }[];
  expired?: boolean;
  probeAt?: string;
  error?: string;
}

interface MCPSystemStatus {
  server: { name: string; version: string; online: boolean; transports: string[] };
  tools: { total: number; categories: number; byCategory: { category: string; count: number }[] };
  keys: { total: number; active: number; expired: number; lastUsedAt: string | null };
  scopesSupported: string[];
}

const ALL_SCOPES: MCPApiKeyScope[] = ["tools:read", "tools:execute", "sse:connect"];

const SCOPE_INFO: Record<MCPApiKeyScope, { label: string; description: string; color: string }> = {
  "tools:read":    { label: "Tools Read",    description: "List & browse available tools",       color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  "tools:execute": { label: "Tools Execute", description: "Execute tools via POST /execute",      color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  "sse:connect":   { label: "SSE Stream",    description: "Connect & execute via SSE transport",  color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScopeBadge({ scope }: { scope: MCPApiKeyScope }) {
  const info = SCOPE_INFO[scope];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${info.color}`}>
      {info.label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 p-1 rounded hover:bg-slate-700/60 transition-colors text-slate-400 hover:text-orange-400"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

// ─── Create Key Modal ──────────────────────────────────────────────────────────

interface CreateKeyModalProps {
  onClose: () => void;
  onCreated: (key: CreatedKey) => void;
}

function CreateKeyModal({ onClose, onCreated }: CreateKeyModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<MCPApiKeyScope[]>([...ALL_SCOPES]);
  const [rateLimit, setRateLimit] = useState(60);
  const [loading, setLoading] = useState(false);

  const toggleScope = (s: MCPApiKeyScope) => {
    setScopes(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Enter a name for this key.", variant: "destructive" });
      return;
    }
    if (scopes.length === 0) {
      toast({ title: "Select at least one scope", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/mcp/keys", { name: name.trim(), scopes, rateLimit });
      const data = await res.json() as CreatedKey;
      onCreated(data);
    } catch {
      toast({ title: "Failed to create key", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-orange-500/30 rounded-xl shadow-2xl shadow-orange-500/10 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Key className="h-5 w-5 text-orange-400" />
            Create API Key
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Name */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Key Name</label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. My Claude Agent"
            className="bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-orange-500"
            maxLength={80}
          />
        </div>

        {/* Scopes */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Scopes</label>
          <div className="space-y-2">
            {ALL_SCOPES.map(s => {
              const info = SCOPE_INFO[s];
              const active = scopes.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => toggleScope(s)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                    active
                      ? "border-orange-500/50 bg-orange-500/10"
                      : "border-slate-700/50 bg-slate-800/40 opacity-60"
                  }`}
                >
                  <div className={`w-4 h-4 mt-0.5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                    active ? "border-orange-500 bg-orange-500" : "border-slate-600"
                  }`}>
                    {active && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{info.label}</div>
                    <div className="text-xs text-slate-400">{info.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Rate limit */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Rate Limit (req/min)</label>
          <Input
            type="number"
            value={rateLimit}
            onChange={e => setRateLimit(Math.max(1, parseInt(e.target.value) || 60))}
            min={1}
            max={1000}
            className="bg-slate-800 border-slate-700 text-white focus:border-orange-500"
          />
        </div>

        <Button
          onClick={handleCreate}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Generate Key
        </Button>
      </div>
    </div>
  );
}

// ─── Reveal Modal (shown once after creation) ─────────────────────────────────

interface RevealModalProps {
  created: CreatedKey;
  onClose: () => void;
}

function RevealModal({ created, onClose }: RevealModalProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-green-500/40 rounded-xl shadow-2xl shadow-green-500/10 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <Shield className="h-5 w-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">API Key Created</h3>
            <p className="text-xs text-slate-400">Copy it now — it won't be shown again</p>
          </div>
        </div>

        <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">Secret Key</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setVisible(v => !v)}
                className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                title={visible ? "Hide" : "Reveal"}
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <CopyButton text={created.key} />
            </div>
          </div>
          <code className="text-sm font-mono text-orange-400 break-all">
            {visible ? created.key : `${created.key.slice(0, 12)}${"•".repeat(Math.max(0, created.key.length - 12))}`}
          </code>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-800/40 rounded-lg p-3">
            <div className="text-slate-400 text-xs mb-1">Name</div>
            <div className="text-white font-medium">{created.name}</div>
          </div>
          <div className="bg-slate-800/40 rounded-lg p-3">
            <div className="text-slate-400 text-xs mb-1">Rate Limit</div>
            <div className="text-white font-medium">{created.rateLimit} req/min</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">Scopes</div>
          <div className="flex flex-wrap gap-2">
            {created.scopes.map(s => <ScopeBadge key={s} scope={s} />)}
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-400">
          ⚠️ {created.warning}
        </div>

        <div className="space-y-2 text-xs text-slate-400 bg-slate-800/40 rounded-lg p-3">
          <div className="font-medium text-slate-300 mb-1">Usage examples:</div>
          <div><span className="text-slate-500">Header:</span> <code className="text-orange-400">X-API-Key: {created.key.slice(0, 16)}...</code></div>
          <div><span className="text-slate-500">Bearer:</span> <code className="text-orange-400">Authorization: Bearer {created.key.slice(0, 16)}...</code></div>
        </div>

        <Button onClick={onClose} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold">
          <Check className="h-4 w-4 mr-2" />
          I've saved the key
        </Button>
      </div>
    </div>
  );
}

// ─── Key Row ──────────────────────────────────────────────────────────────────

interface KeyRowProps {
  apiKey: MCPApiKey;
  onToggle: (id: number, isActive: boolean) => void;
  onDelete: (id: number) => void;
  onTest: (id: number) => void;
  isDeleting: boolean;
  isToggling: boolean;
  isTesting: boolean;
  lastTestResult?: TestResult;
}

function KeyRow({ apiKey, onToggle, onDelete, onTest, isDeleting, isToggling, isTesting, lastTestResult }: KeyRowProps) {
  const expired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();
  return (
    <div className={`p-4 rounded-xl border transition-all ${
      apiKey.isActive && !expired
        ? "border-slate-700/60 bg-slate-800/40"
        : "border-slate-800/60 bg-slate-900/40 opacity-70"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white text-sm">{apiKey.name}</span>
            {expired ? (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Expired</Badge>
            ) : apiKey.isActive ? (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Active</Badge>
            ) : (
              <Badge className="bg-slate-600/30 text-slate-400 border-slate-600/30 text-[10px]">Inactive</Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 min-w-0">
            <code className="text-xs font-mono text-orange-400/80 truncate block w-full" title={apiKey.keyPrefix}>
              {apiKey.keyPrefix}••••••••••••••••••••••••••••••••••••••••••••••••••••••••
            </code>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {apiKey.scopes.map(s => <ScopeBadge key={s} scope={s} />)}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {apiKey.rateLimit} req/min
            </span>
            {apiKey.lastUsedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Last used {formatDistanceToNow(new Date(apiKey.lastUsedAt), { addSuffix: true })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Key className="h-3 w-3" />
              Created {formatDistanceToNow(new Date(apiKey.createdAt), { addSuffix: true })}
            </span>
            {apiKey.expiresAt && (
              <span className={`flex items-center gap-1 ${expired ? "text-red-400" : ""}`}>
                <Clock className="h-3 w-3" />
                {expired ? "Expired" : "Expires"} {formatDistanceToNow(new Date(apiKey.expiresAt), { addSuffix: true })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onTest(apiKey.id)}
            disabled={isTesting}
            title="Test this key — verifies active status, scopes & reachable tools"
            className="p-1.5 rounded-lg hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors disabled:opacity-40"
          >
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          </button>
          <button
            onClick={() => onToggle(apiKey.id, !apiKey.isActive)}
            disabled={isToggling || !!expired}
            title={apiKey.isActive ? "Deactivate key" : "Activate key"}
            className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-orange-400 transition-colors disabled:opacity-40"
          >
            {isToggling
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : apiKey.isActive
                ? <ToggleRight className="h-5 w-5 text-green-400" />
                : <ToggleLeft className="h-5 w-5" />
            }
          </button>
          <button
            onClick={() => onDelete(apiKey.id)}
            disabled={isDeleting}
            title="Revoke key permanently"
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-40"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {lastTestResult && (
        <div className={`mt-3 p-2.5 rounded-lg border text-xs ${
          lastTestResult.success
            ? 'bg-green-500/10 border-green-500/30 text-green-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          <div className="flex items-center gap-2 font-medium">
            {lastTestResult.success ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            <span>{lastTestResult.success ? 'Key passed all checks' : 'Key has issues'}</span>
            {lastTestResult.reachable && (
              <span className="text-slate-400 font-normal ml-auto">
                {lastTestResult.reachable.tools} tools · {lastTestResult.reachable.categories} cats · {lastTestResult.reachable.transports.join('/')}
              </span>
            )}
          </div>
          {lastTestResult.checks && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lastTestResult.checks.map(c => (
                <span key={c.name} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                  c.ok ? 'bg-green-500/15 text-green-400' : 'bg-slate-700/40 text-slate-500'
                }`}>
                  {c.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MCPApiKeysManager() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<MCPApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [revealKey, setRevealKey] = useState<CreatedKey | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, TestResult>>({});
  const [sysStatus, setSysStatus] = useState<MCPSystemStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiRequest("GET", "/api/mcp/admin/status");
      const data = await res.json() as { success: boolean } & MCPSystemStatus;
      if (data.success) setSysStatus(data);
    } catch {
      /* non-blocking */
    }
  }, []);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/mcp/keys");
      const data = await res.json() as { keys: MCPApiKey[] };
      setKeys(data.keys ?? []);
    } catch {
      toast({ title: "Failed to load API keys", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchKeys();
    fetchStatus();
    const iv = setInterval(fetchStatus, 30_000);
    return () => clearInterval(iv);
  }, [fetchKeys, fetchStatus]);

  const handleCreated = (created: CreatedKey) => {
    setShowCreate(false);
    setRevealKey(created);
    setKeys(prev => [
      {
        id: created.id,
        name: created.name,
        keyPrefix: created.keyPrefix,
        scopes: created.scopes,
        rateLimit: created.rateLimit,
        isActive: true,
        lastUsedAt: null,
        expiresAt: created.expiresAt,
        createdAt: created.createdAt,
      },
      ...prev,
    ]);
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    setTogglingId(id);
    try {
      const res = await apiRequest("PATCH", `/api/mcp/keys/${id}`, { isActive });
      const updated = await res.json() as MCPApiKey;
      setKeys(prev => prev.map(k => k.id === id ? { ...k, isActive: updated.isActive } : k));
    } catch {
      toast({ title: "Failed to update key", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await apiRequest("DELETE", `/api/mcp/keys/${id}`);
      setKeys(prev => prev.filter(k => k.id !== id));
      toast({ title: "Key revoked", description: "The API key has been permanently deleted." });
    } catch {
      toast({ title: "Failed to revoke key", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      const res = await apiRequest("POST", `/api/mcp/keys/${id}/test`);
      const data = await res.json() as TestResult;
      setTestResults(prev => ({ ...prev, [id]: data }));
      toast({
        title: data.success ? "Key is healthy" : "Key has issues",
        description: data.reachable
          ? `${data.reachable.tools} tools reachable · ${data.reachable.transports.join(', ')}`
          : "See checks below",
        variant: data.success ? undefined : "destructive",
      });
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [id]: { success: false, error: err.message } }));
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  };

  const activeCount = keys.filter(k => k.isActive && (!k.expiresAt || new Date(k.expiresAt) >= new Date())).length;

  return (
    <div className="space-y-6">
      {/* Modals */}
      {showCreate && <CreateKeyModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {revealKey && <RevealModal created={revealKey} onClose={() => setRevealKey(null)} />}

      {/* System Status — proves the MCP server is wired and reachable */}
      {sysStatus && (
        <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-green-500/20">
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${sysStatus.server.online ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <Server className="h-4 w-4 text-slate-300" />
                <span className="text-sm font-semibold text-white">{sysStatus.server.name}</span>
                <Badge className="bg-slate-800/60 text-slate-300 border border-slate-700 text-[10px]">
                  v{sysStatus.server.version}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1 ml-auto">
                {sysStatus.server.transports.map(t => (
                  <Badge key={t} className="bg-orange-500/15 text-orange-300 border border-orange-500/30 text-[10px] uppercase">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/40">
                <div className="flex items-center gap-2 text-[11px] text-slate-400 uppercase tracking-wide">
                  <Zap className="h-3 w-3" /> Tools
                </div>
                <div className="text-xl font-bold text-orange-400 mt-1">{sysStatus.tools.total}</div>
                <div className="text-[10px] text-slate-500">{sysStatus.tools.categories} categories</div>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/40">
                <div className="flex items-center gap-2 text-[11px] text-slate-400 uppercase tracking-wide">
                  <Key className="h-3 w-3" /> Keys
                </div>
                <div className="text-xl font-bold text-white mt-1">
                  {sysStatus.keys.active}<span className="text-slate-500 text-sm">/{sysStatus.keys.total}</span>
                </div>
                <div className="text-[10px] text-slate-500">{sysStatus.keys.expired} expired</div>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/40">
                <div className="flex items-center gap-2 text-[11px] text-slate-400 uppercase tracking-wide">
                  <Activity className="h-3 w-3" /> Last Use
                </div>
                <div className="text-sm font-medium text-white mt-1 truncate">
                  {sysStatus.keys.lastUsedAt
                    ? formatDistanceToNow(new Date(sysStatus.keys.lastUsedAt), { addSuffix: true })
                    : 'Never'}
                </div>
              </div>
              <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-700/40">
                <div className="flex items-center gap-2 text-[11px] text-slate-400 uppercase tracking-wide">
                  <Shield className="h-3 w-3" /> Scopes
                </div>
                <div className="text-sm font-medium text-white mt-1">{sysStatus.scopesSupported.length} supported</div>
                <div className="text-[10px] text-slate-500">SHA-256 hashed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle className="text-orange-400 flex items-center gap-2">
                <Key className="h-5 w-5" />
                MCP API Keys
              </CardTitle>
              <p className="text-slate-400 text-sm mt-1">
                Grant external AI agents access to Boostify's 26 intelligence tools via the MCP protocol.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchKeys}
                disabled={loading}
                className="p-2 rounded-lg border border-slate-700/60 bg-slate-800/40 hover:bg-slate-700/60 text-slate-400 hover:text-white transition-all"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Key
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
            {[
              { label: "Total Keys",   value: keys.length,  icon: Key,    color: "text-slate-300" },
              { label: "Active",       value: activeCount,  icon: Power,  color: "text-green-400" },
              { label: "Inactive",     value: keys.length - activeCount, icon: ToggleLeft, color: "text-slate-400" },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-slate-800/40 rounded-xl p-2 sm:p-3 border border-slate-700/40 text-center">
                  <Icon className={`h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 ${stat.color}`} />
                  <div className={`text-lg sm:text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-[10px] sm:text-xs text-slate-500">{stat.label}</div>
                </div>
              );
            })}
          </div>

          {/* Key list */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading keys…
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Key className="h-7 w-7 text-orange-400" />
              </div>
              <p className="text-slate-300 font-medium">No API keys yet</p>
              <p className="text-slate-500 text-sm max-w-xs">
                Create a key to let external AI agents (Claude, GPT-4o, custom bots) call Boostify's MCP tools.
              </p>
              <Button
                onClick={() => setShowCreate(true)}
                className="mt-2 bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map(k => (
                <KeyRow
                  key={k.id}
                  apiKey={k}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onTest={handleTest}
                  isDeleting={deletingId === k.id}
                  isToggling={togglingId === k.id}
                  isTesting={testingId === k.id}
                  lastTestResult={testResults[k.id]}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="bg-slate-900/40 border border-slate-700/40">
        <CardContent className="pt-5">
          <div className="text-sm text-slate-400 space-y-3">
            <div className="flex items-start gap-3">
              <Shield className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-slate-300 font-medium">Security: </span>
                Keys are hashed with SHA-256 before storage. The raw key is only shown once at creation.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-slate-300 font-medium">Usage: </span>
                Send <code className="text-orange-400 text-xs bg-slate-800 px-1 py-0.5 rounded">X-API-Key: bmcp_…</code> or{" "}
                <code className="text-orange-400 text-xs bg-slate-800 px-1 py-0.5 rounded">Authorization: Bearer bmcp_…</code> with every MCP request.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Key className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <span className="text-slate-300 font-medium">Scopes: </span>
                <em>tools:read</em> lists tools, <em>tools:execute</em> runs them, <em>sse:connect</em> enables streaming.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
