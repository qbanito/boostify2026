import { useState, useEffect, useCallback } from "react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { 
  Plug, RefreshCw, Zap, Copy, CheckCircle, AlertTriangle, 
  ArrowUpRight, Clock, Users, Eye, Video, TrendingUp, 
  Loader2, Trash2, Activity, Download, Chrome, ExternalLink,
  MonitorSmartphone, Shield, Wifi
} from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "../../hooks/use-toast";
import { useAuth } from "../../hooks/use-auth";

// Chrome Web Store URL — update EXTENSION_ID after publishing
const CHROME_WEBSTORE_URL = "https://chromewebstore.google.com/detail/boostify-youtube-sync/EXTENSION_ID_HERE";

interface ExtConnection {
  id: number;
  extensionId: string;
  channelId: string | null;
  status: string;
  lastSyncAt: string | null;
  createdAt: string;
}

interface ExtEvent {
  id: number;
  eventType: string;
  eventData: any;
  createdAt: string;
}

interface ExtSnapshot {
  id: number;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  snapshotAt: string;
}

interface PendingAction {
  id: number;
  actionType: string;
  payload: any;
  status: string;
  priority: string;
  generatedBy: string;
  createdAt: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const EVENT_ICONS: Record<string, string> = {
  video_published: "🎬",
  stats_synced: "📊",
  action_applied: "✅",
  action_skipped: "⏭",
  connected: "🔗",
  disconnected: "🔌",
  error: "❌",
  milestone: "🏆",
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  optimize_title: "Optimize Title",
  optimize_description: "Optimize Description",
  optimize_tags: "Optimize Tags",
  change_thumbnail: "Change Thumbnail",
  schedule_post: "Schedule Post",
  seo_audit: "SEO Audit",
  promote_video: "Promote Video",
  custom: "Custom",
};

export function ExtensionSyncTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<ExtConnection | null>(null);
  const [events, setEvents] = useState<ExtEvent[]>([]);
  const [snapshots, setSnapshots] = useState<ExtSnapshot[]>([]);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [connectToken, setConnectToken] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [newActionType, setNewActionType] = useState("optimize_title");
  const [newActionVideoId, setNewActionVideoId] = useState("");
  const [newActionPayload, setNewActionPayload] = useState("");
  const [creatingAction, setCreatingAction] = useState(false);

  const userId = user?.id;

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // Load connection status
      const statusRes = await fetch(`/api/youtube-ext/status/${userId}`);
      if (statusRes.ok) {
        const data = await statusRes.json();
        if (data.connections?.length > 0) {
          setConnection(data.connections[0]);
        } else {
          setConnection(null);
        }
      }
    } catch (err) {
      console.error("Failed to load extension data:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleGenerateToken = async () => {
    const uid = userId || user?.clerkId;
    if (!uid) {
      toast({ title: "Error", description: "Debes iniciar sesión primero", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/youtube-ext/generate-connect-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: String(uid) }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const token = data.connectToken || data.token;
      if (!token) throw new Error("No token returned");
      setConnectToken(token);
      toast({ title: "Token Generado", description: "Copia el token y pégalo en el popup de la extensión de Chrome." });
    } catch (err: any) {
      console.error("Generate token error:", err);
      toast({ title: "Error", description: err.message || "Failed to generate connect token", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copyToken = () => {
    if (connectToken) {
      navigator.clipboard.writeText(connectToken);
      toast({ title: "Copied!", description: "Token copied to clipboard" });
    }
  };

  const handleCreateAction = async () => {
    if (!connection) return;
    setCreatingAction(true);
    try {
      let payload: any = {};
      try { payload = newActionPayload ? JSON.parse(newActionPayload) : {}; } catch { payload = { text: newActionPayload }; }
      if (newActionVideoId) payload.videoId = newActionVideoId;

      const res = await fetch("/api/youtube-ext/create-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: connection.id,
          actionType: newActionType,
          payload,
          priority: "medium",
          generatedBy: "dashboard",
        }),
      });
      if (!res.ok) throw new Error("Failed to create action");
      toast({ title: "Action Created", description: "The extension will pick it up on next sync." });
      setNewActionVideoId("");
      setNewActionPayload("");
      await loadData();
    } catch {
      toast({ title: "Error", description: "Failed to create action", variant: "destructive" });
    } finally {
      setCreatingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm flex items-center justify-center min-h-[300px]">
        <Loader2 className="animate-spin w-8 h-8 text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Download Card */}
      <div className="overflow-hidden rounded-2xl border-white/[0.06]">
        <div className="relative bg-gradient-to-br from-emerald-600 via-green-600 to-teal-700 p-8">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIi8+PC9zdmc+')] opacity-50" />
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                    <Chrome className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white">
                      Boostify YouTube Extension
                    </h2>
                    <p className="text-green-100 text-sm">
                      Chrome Extension v1.0.0
                    </p>
                  </div>
                </div>
                <p className="text-green-50/90 text-base max-w-xl mb-4">
                  Sincroniza tu canal de YouTube con Boostify en tiempo real. Obtén optimización SEO, 
                  alertas de tendencias y analíticas directamente dentro de YouTube.
                </p>
                <div className="flex flex-wrap gap-4 text-sm text-green-100">
                  <span className="flex items-center gap-1.5">
                    <Wifi className="w-4 h-4" /> Sync en tiempo real
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4" /> Auto-optimización SEO
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4" /> Conexión segura
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MonitorSmartphone className="w-4 h-4" /> Side Panel
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3 shrink-0">
                <Button
                  size="lg"
                  className="bg-white text-green-700 hover:bg-green-50 font-bold text-base px-8 py-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
                  onClick={() => window.open(CHROME_WEBSTORE_URL, '_blank')}
                >
                  <Chrome className="w-5 h-5 mr-2" />
                  Añadir a Chrome — Gratis
                </Button>
                <p className="text-[11px] text-green-200 text-center">
                  Instalación directa desde Chrome Web Store
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Installation Steps */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
        <h4 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          Cómo instalar en 2 pasos
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InstallStepCard
            step={1}
            icon={<Chrome className="w-6 h-6" />}
            title="Añadir a Chrome"
            description='Haz clic en "Añadir a Chrome" arriba. Se instala automáticamente desde Chrome Web Store en 1 clic.'
            color="green"
          />
          <InstallStepCard
            step={2}
            icon={<Plug className="w-6 h-6" />}
            title="Conectar"
            description="Genera un token abajo, abre el popup de la extensión en Chrome y pégalo"
            color="orange"
          />
        </div>
      </div>

      {/* Connection Section */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
        <div className="flex items-center gap-5 mb-6">
          <div className="p-4 bg-gradient-to-br from-emerald-500/20 to-green-500/10 rounded-2xl border border-emerald-500/10">
            <Plug className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">Estado de Conexión</h3>
            <p className="text-white/35">
              Conecta tu extensión de Chrome con tu cuenta de Boostify
            </p>
          </div>
          <Button onClick={loadData} variant="outline" className="ml-auto border-white/[0.1] hover:bg-white/[0.05]" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Connection Status */}
        {connection ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 p-4 bg-green-500/5 border border-green-500/20 rounded-lg mb-4">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <div className="flex-1">
                <p className="font-semibold text-green-400">✅ Extensión Conectada</p>
                <p className="text-sm text-white/35">
                  ID: {connection.extensionId.slice(0, 20)}…
                  {connection.channelId && ` · Canal: ${connection.channelId}`}
                </p>
              </div>
              <div className="text-right">
                {connection.lastSyncAt && (
                  <p className="text-xs text-white/35">
                    Último sync: {timeAgo(connection.lastSyncAt)}
                  </p>
                )}
                <Badge variant="outline" className="border-green-500/30 text-green-400">
                  {connection.status}
                </Badge>
              </div>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <p className="font-semibold text-amber-400">Extensión no conectada</p>
              </div>
              <p className="text-sm text-white/35 mb-4">
                Genera un token de conexión y pégalo en el popup de la extensión de Chrome.
              </p>

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateToken}
                  disabled={generating}
                  className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-[0_0_25px_rgba(16,185,129,0.25)] rounded-xl font-semibold transition-all duration-300"
                >
                  {generating ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Zap className="mr-2 w-4 h-4" />}
                  Generar Token de Conexión
                </Button>
              </div>

              {connectToken && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-background border-2 border-green-500/30 rounded-lg"
                >
                  <p className="text-xs text-white/35 mb-2">
                    Tu token de conexión (expira en 10 minutos):
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono truncate select-all">
                      {connectToken}
                    </code>
                    <Button size="sm" variant="outline" onClick={copyToken} className="shrink-0">
                      <Copy className="w-4 h-4 mr-1" /> Copiar
                    </Button>
                  </div>
                  <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Ahora abre la extensión en Chrome y pega este token
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Action (only if connected) */}
      {connection && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm">
          <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            Enviar Acción a la Extensión
          </h4>
          <p className="text-sm text-white/35 mb-4">
            Crea una acción de optimización que la extensión aplicará cuando visites YouTube Studio.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <select
              value={newActionType}
              onChange={(e) => setNewActionType(e.target.value)}
              className="bg-background border rounded-lg px-3 py-2 text-sm"
            >
              {Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <Input
              placeholder="Video ID (opcional)"
              value={newActionVideoId}
              onChange={(e) => setNewActionVideoId(e.target.value)}
            />
            <Input
              placeholder='Payload (texto o JSON)'
              value={newActionPayload}
              onChange={(e) => setNewActionPayload(e.target.value)}
            />
          </div>
          <Button
            onClick={handleCreateAction}
            disabled={creatingAction}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-[0_0_25px_rgba(245,158,11,0.25)] rounded-xl font-semibold transition-all duration-300"
          >
            {creatingAction ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <ArrowUpRight className="mr-2 w-4 h-4" />}
            Crear Acción
          </Button>
        </div>
      )}

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeatureCard
          icon={<TrendingUp className="w-6 h-6 text-blue-400" />}
          title="Sync Automático"
          description="Sincroniza subs, views y datos del canal cada 5 minutos automáticamente"
        />
        <FeatureCard
          icon={<Zap className="w-6 h-6 text-orange-400" />}
          title="Auto-Fill SEO"
          description="Aplica títulos, descripciones y tags optimizados directamente en YouTube Studio"
        />
        <FeatureCard
          icon={<Eye className="w-6 h-6 text-green-400" />}
          title="Análisis en Vivo"
          description="Badges de puntuación SEO en thumbnails y panel de análisis en páginas de video"
        />
      </div>
    </div>
  );
}

function InstallStepCard({ step, icon, title, description, color }: { 
  step: number; icon: React.ReactNode; title: string; description: string; color: string 
}) {
  const colors: Record<string, string> = {
    green: "from-green-500/10 to-green-500/5 border-green-500/20",
    blue: "from-blue-500/10 to-blue-500/5 border-blue-500/20",
    purple: "from-purple-500/10 to-purple-500/5 border-purple-500/20",
    orange: "from-orange-500/10 to-orange-500/5 border-orange-500/20",
  };
  const stepColors: Record<string, string> = {
    green: "bg-green-500 text-white",
    blue: "bg-blue-500 text-white",
    purple: "bg-purple-500 text-white",
    orange: "bg-orange-500 text-white",
  };
  return (
    <div className={`relative p-4 rounded-xl bg-gradient-to-b ${colors[color]} border transition-all hover:scale-[1.02]`}>
      <div className={`absolute -top-3 -left-2 w-7 h-7 rounded-full ${stepColors[color]} text-xs font-bold flex items-center justify-center shadow-lg`}>
        {step}
      </div>
      <div className="mt-1 mb-2 opacity-70">{icon}</div>
      <h5 className="font-semibold text-sm mb-1">{title}</h5>
      <p className="text-xs text-white/35 leading-relaxed">{description}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-5 rounded-2xl bg-white/[0.02] border-white/[0.06] backdrop-blur-sm hover:border-emerald-500/20 transition-all duration-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]">
      <div className="mb-3">{icon}</div>
      <h5 className="font-semibold text-sm text-white mb-1">{title}</h5>
      <p className="text-xs text-white/35 leading-relaxed">{description}</p>
    </div>
  );
}
