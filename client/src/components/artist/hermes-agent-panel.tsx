/**
 * Hermes Agent Panel — Artist Profile Module
 *
 * Full control center for the Hermes AI Agent from inside the Artist Profile.
 * Shows connection status, memory, soul, goals, and skill triggers.
 * Owner-only, calls /api/artist-hermes/:id/* (Clerk-authenticated proxy).
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Bot,
  Brain,
  Target,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Zap,
  Calendar,
  BarChart3,
  BookOpen,
  Heart,
  Activity,
  Play,
  Eye,
  EyeOff,
  HelpCircle,
  X,
  MessageSquare,
  Shield,
  Cpu,
  Radio,
  Layers,
  ArrowRight,
  BookMarked,
  PenLine,
  Plus,
  Trash2,
  Clock,
  Music,
  Image,
  Megaphone,
  FileText,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface HermesAgentPanelProps {
  artistId: string;
  pgId?: number;
  isOwnProfile: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  colors: {
    hexAccent: string;
    hexPrimary: string;
    hexBorder: string;
    textMuted: string;
    bgGradient: string;
    shadow: string;
  };
  cardStyles: string;
  cardStyleInline: React.CSSProperties;
  artistName: string;
}

interface HermesGoal {
  id: string;
  title: string;
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'active' | 'completed' | 'paused';
}

// ─── Guide items ───────────────────────────────────────────────────────────────

const GUIDE_ITEMS = [
  {
    icon: Bot,
    color: '#a855f7',
    title: '¿Qué es Hermes?',
    body: 'Hermes es tu agente de IA autónomo personal. Aprende tu historia, tus metas y tu identidad como artista para actuar como tu mánager digital 24/7, sin que tengas que pedirle nada.',
  },
  {
    icon: Brain,
    color: '#8b5cf6',
    title: 'Memoria (MEMORY.md)',
    body: 'Cada vez que Hermes inicia, lee un archivo de memoria con todo tu historial: streams, posts, logros, colaboraciones y evolución de carrera. Cuanto más aprende, mejor actúa.',
  },
  {
    icon: Heart,
    color: '#ec4899',
    title: 'Alma (SOUL.md)',
    body: 'SOUL.md define la personalidad de Hermes cuando actúa en tu nombre: tu tono de comunicación, tus valores, tu estilo. Así responde como "tú" y no como un bot genérico.',
  },
  {
    icon: Target,
    color: '#f59e0b',
    title: 'Objetivos activos',
    body: 'Hermes genera automáticamente metas a partir de tu Superstar Blueprint y las actualiza según tu progreso. Cada objetivo tiene prioridad y estado para que no pierdas el foco.',
  },
  {
    icon: Calendar,
    color: '#10b981',
    title: 'Skill: Content Calendar',
    body: 'Genera un plan de contenido de 30 días para redes sociales, adaptado a tu género, audiencia y momentos clave de la industria. Se activa automáticamente cada mes.',
  },
  {
    icon: Activity,
    color: '#3b82f6',
    title: 'Skill: Weekly Check',
    body: 'Cada lunes a las 9 AM, Hermes analiza tus streams, publicaciones y metas de la semana anterior, genera un reporte de salud y sugiere ajustes para la semana entrante.',
  },
  {
    icon: BarChart3,
    color: '#f97316',
    title: 'Skill: Competitor Analysis',
    body: 'Investiga 5 artistas similares a ti, detecta oportunidades que ellos están aprovechando y te presenta un informe con acciones concretas que puedes tomar.',
  },
  {
    icon: Shield,
    color: '#06b6d4',
    title: 'Privacidad y control',
    body: 'Hermes solo opera cuando tú lo activas. Toda la memoria y el alma son archivos de texto que puedes editar, eliminar o exportar en cualquier momento. Tú tienes el control total.',
  },
];

// ─── Simulated activity feed ───────────────────────────────────────────────────

const ACTIVITY_FEED = [
  { icon: Brain, color: '#a855f7', text: 'Memory loaded — 847 tokens read' },
  { icon: Target, color: '#f59e0b', text: 'Goals refreshed — 3 active objectives' },
  { icon: Calendar, color: '#10b981', text: 'Content calendar generated for May' },
  { icon: Activity, color: '#3b82f6', text: 'Weekly check completed — streams +12%' },
  { icon: BarChart3, color: '#f97316', text: 'Competitor analysis queued' },
  { icon: Sparkles, color: '#ec4899', text: 'Soul.md synced with Blueprint' },
  { icon: Zap, color: '#eab308', text: 'New skill triggered: promo strategy' },
  { icon: Bot, color: '#8b5cf6', text: 'Hermes online — awaiting instructions' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function priorityColor(priority?: string) {
  if (priority === 'high') return 'text-red-400 bg-red-500/10 border-red-500/30';
  if (priority === 'medium') return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
  return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
}

function priorityLabel(priority?: string) {
  if (priority === 'high') return '🔴 High';
  if (priority === 'medium') return '🟡 Medium';
  return '🔵 Low';
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function HermesAgentPanel({
  artistId,
  pgId,
  isOwnProfile,
  isExpanded,
  onToggleExpand,
  colors,
  cardStyles,
  cardStyleInline,
  artistName,
}: HermesAgentPanelProps) {
  const { toast } = useToast();
  const numericId = pgId || parseInt(artistId, 10);
  const [activeTab, setActiveTab] = useState<'overview' | 'memory' | 'soul' | 'goals' | 'ledger'>('overview');
  const [showFullMemory, setShowFullMemory] = useState(false);
  const [showFullSoul, setShowFullSoul] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // ── Creative Ledger state ────────────────────────────────────────────────
  type LedgerEntry = { id: string; type: string; title: string; note: string; date: string };
  const ledgerStorageKey = `codex-ledger-${artistId}`;
  const loadLedger = (): LedgerEntry[] => {
    try { return JSON.parse(localStorage.getItem(ledgerStorageKey) || '[]'); } catch { return []; }
  };
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>(loadLedger);
  const [newEntry, setNewEntry] = useState({ type: 'song', title: '', note: '' });
  const [showAddEntry, setShowAddEntry] = useState(false);

  const saveLedger = (entries: LedgerEntry[]) => {
    setLedgerEntries(entries);
    try { localStorage.setItem(ledgerStorageKey, JSON.stringify(entries)); } catch {}
  };

  const addLedgerEntry = () => {
    if (!newEntry.title.trim()) return;
    const entry: LedgerEntry = {
      id: Date.now().toString(),
      type: newEntry.type,
      title: newEntry.title.trim(),
      note: newEntry.note.trim(),
      date: new Date().toISOString(),
    };
    saveLedger([entry, ...ledgerEntries]);
    setNewEntry({ type: 'song', title: '', note: '' });
    setShowAddEntry(false);
  };

  const deleteLedgerEntry = (id: string) => {
    saveLedger(ledgerEntries.filter((e) => e.id !== id));
  };

  const LEDGER_TYPES: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    song: { icon: Music, color: '#818cf8', label: 'Song' },
    visual: { icon: Image, color: '#c084fc', label: 'Visual' },
    campaign: { icon: Megaphone, color: '#f59e0b', label: 'Campaign' },
    decision: { icon: Brain, color: '#34d399', label: 'Decision' },
    collab: { icon: FileText, color: '#fb923c', label: 'Collab' },
  };

  const renderLedger = () => (
    <div className="px-4 py-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Creative Ledger · {ledgerEntries.length} registros
        </p>
        <button
          type="button"
          onClick={() => setShowAddEntry(!showAddEntry)}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all"
          style={{ background: `${accent}20`, color: accent, border: `1px solid ${accentBorder}` }}
        >
          <Plus className="h-3 w-3" />
          Agregar
        </button>
      </div>

      {showAddEntry && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-3 space-y-2"
          style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
        >
          <div className="flex gap-1 overflow-x-auto pb-1">
            {Object.entries(LEDGER_TYPES).map(([key, { icon: Icon, color, label }]) => (
              <button
                key={key}
                type="button"
                onClick={() => setNewEntry((e) => ({ ...e, type: key }))}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all"
                style={{
                  background: newEntry.type === key ? `${color}25` : 'rgba(255,255,255,0.03)',
                  color: newEntry.type === key ? color : '#6b7280',
                  border: `1px solid ${newEntry.type === key ? `${color}40` : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                <Icon className="h-3 w-3" />{label}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Título de la entrada..."
            value={newEntry.title}
            onChange={(e) => setNewEntry((n) => ({ ...n, title: e.target.value }))}
            className="w-full bg-transparent text-xs text-white placeholder-gray-600 outline-none px-2 py-1.5 rounded-lg"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          />
          <textarea
            placeholder="Nota, decisión, contexto..."
            value={newEntry.note}
            onChange={(e) => setNewEntry((n) => ({ ...n, note: e.target.value }))}
            rows={2}
            className="w-full bg-transparent text-xs text-white placeholder-gray-600 outline-none resize-none px-2 py-1.5 rounded-lg"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowAddEntry(false)}
              className="text-[11px] text-gray-600 hover:text-gray-300 transition-colors">Cancelar</button>
            <button type="button" onClick={addLedgerEntry}
              className="text-[11px] px-3 py-1 rounded-lg font-semibold"
              style={{ background: `${accent}25`, color: accent }}>
              <Plus className="h-3 w-3 inline mr-1" />Guardar
            </button>
          </div>
        </motion.div>
      )}

      {ledgerEntries.length === 0 && (
        <div className="text-center py-6 text-gray-600">
          <BookMarked className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">El Creative Ledger está vacío.</p>
          <p className="text-[10px] mt-1">Documenta cada decisión creativa aquí.</p>
        </div>
      )}

      <div className="space-y-2">
        {ledgerEntries.map((entry) => {
          const typeDef = LEDGER_TYPES[entry.type] || LEDGER_TYPES.song;
          const TypeIcon = typeDef.icon;
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-xl p-3 flex items-start gap-2.5"
              style={{ background: `${typeDef.color}0c`, border: `1px solid ${typeDef.color}20` }}
            >
              <span
                className="flex-shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-lg"
                style={{ background: `${typeDef.color}20`, color: typeDef.color }}
              >
                <TypeIcon className="h-3 w-3" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{entry.title}</p>
                {entry.note && (
                  <p className="text-[10px] text-gray-400 leading-snug mt-0.5 line-clamp-2">{entry.note}</p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                    style={{ background: `${typeDef.color}15`, color: typeDef.color }}>
                    {typeDef.label}
                  </span>
                  <span className="text-[9px] text-gray-600 flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {new Date(entry.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button type="button" onClick={() => deleteLedgerEntry(entry.id)}
                className="flex-shrink-0 text-gray-700 hover:text-red-400 transition-colors">
                <Trash2 className="h-3 w-3" />
              </button>
            </motion.div>
          );
        })}
      </div>
    </div>
  );

  // Live activity feed ticker
  const [feedIndex, setFeedIndex] = useState(0);
  const [feedVisible, setFeedVisible] = useState(true);
  useEffect(() => {
    if (!isExpanded) return;
    const id = setInterval(() => {
      setFeedVisible(false);
      setTimeout(() => {
        setFeedIndex(i => (i + 1) % ACTIVITY_FEED.length);
        setFeedVisible(true);
      }, 350);
    }, 3200);
    return () => clearInterval(id);
  }, [isExpanded]);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const { data: statusData, isLoading: statusLoading } = useQuery<any>({
    queryKey: ['/api/artist-hermes', numericId, 'status'],
    queryFn: () => apiRequest({ url: `/api/artist-hermes/${numericId}/status`, method: 'GET' }),
    enabled: !!numericId && isOwnProfile,
    staleTime: 30_000,
  });

  const { data: goalsData, isLoading: goalsLoading } = useQuery<any>({
    queryKey: ['/api/artist-hermes', numericId, 'goals'],
    queryFn: () => apiRequest({ url: `/api/artist-hermes/${numericId}/goals`, method: 'GET' }),
    enabled: !!numericId && isOwnProfile && activeTab === 'goals',
    staleTime: 60_000,
  });

  const { data: memoryData, isLoading: memoryLoading } = useQuery<any>({
    queryKey: ['/api/artist-hermes', numericId, 'memory'],
    queryFn: () => apiRequest({ url: `/api/artist-hermes/${numericId}/memory`, method: 'GET' }),
    enabled: !!numericId && isOwnProfile && activeTab === 'memory',
    staleTime: 60_000,
  });

  const { data: soulData, isLoading: soulLoading } = useQuery<any>({
    queryKey: ['/api/artist-hermes', numericId, 'soul'],
    queryFn: () => apiRequest({ url: `/api/artist-hermes/${numericId}/soul`, method: 'GET' }),
    enabled: !!numericId && isOwnProfile && activeTab === 'soul',
    staleTime: 60_000,
  });

  // ── Styles ──────────────────────────────────────────────────────────────────

  const accent = colors.hexAccent || '#a855f7';
  const accentBg = `${accent}18`;
  const accentBorder = `${accent}40`;

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    background: isActive ? `${accent}22` : 'rgba(255,255,255,0.03)',
    color: isActive ? accent : 'rgba(255,255,255,0.45)',
    border: `1px solid ${isActive ? accentBorder : 'rgba(255,255,255,0.06)'}`,
    borderRadius: '0.5rem',
    padding: '0.35rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: isActive ? 700 : 400,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
  });

  const isOnline = statusData?.status === 'ok';
  const feedItem = ACTIVITY_FEED[feedIndex];

  // ── Render helpers ──────────────────────────────────────────────────────────

  function renderHeader() {
    return (
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: isExpanded ? `1px solid ${accentBorder}` : 'none' }}>
        {/* Expand toggle button */}
        <button
          onClick={onToggleExpand}
          className="flex-1 flex items-center gap-2.5 text-left hover:opacity-80 transition-opacity min-w-0"
        >
          {/* Animated bot icon */}
          <div className="relative flex-shrink-0">
            <motion.div
              animate={isOnline ? { boxShadow: [`0 0 0px ${accent}00`, `0 0 10px ${accent}60`, `0 0 0px ${accent}00`] } : {}}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: accentBg, color: accent, border: `1px solid ${accentBorder}` }}
            >
              <Bot className="h-4.5 w-4.5 h-[18px] w-[18px]" />
            </motion.div>
            {isOnline && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#0d0d12]">
                <motion.span
                  animate={{ scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-full bg-green-400"
                />
              </span>
            )}
          </div>

          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight flex items-center gap-1.5">
              Hermes Agent
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${accent}20`, color: accent }}>AI</span>
            </p>
            <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Tu mánager de IA autónomo
            </p>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-shrink-0">
            {statusLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: accent }} />
            ) : isOnline ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                <XCircle className="h-3 w-3" />
                Offline
              </span>
            )}
            {isExpanded ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
          </div>
        </button>

        {/* Guide button */}
        <button
          onClick={e => { e.stopPropagation(); setShowGuide(true); }}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:opacity-80 transition-colors"
          style={{ color: accent }}
          title="¿Cómo funciona Hermes?"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    );
  }

  function renderOverview() {
    const capabilities: string[] = statusData?.capabilities || [];

    return (
      <div className="px-4 pt-4 pb-3 space-y-4">

        {/* ── Live activity ticker ────────────────────────────── */}
        <motion.div
          className="rounded-xl px-3 py-2.5 flex items-center gap-2.5 overflow-hidden"
          style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${accentBorder}` }}
        >
          <div className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center" style={{ background: accentBg }}>
            <Radio className="h-3 w-3 animate-pulse" style={{ color: accent }} />
          </div>
          <AnimatePresence mode="wait">
            {feedVisible && (
              <motion.div
                key={feedIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
                className="flex items-center gap-2 min-w-0"
              >
                <feedItem.icon className="h-3 w-3 flex-shrink-0" style={{ color: feedItem.color }} />
                <p className="text-xs text-white/70 truncate">{feedItem.text}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="ml-auto flex items-center gap-1 flex-shrink-0">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ scaleY: [0.4, 1.2, 0.4] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18 }}
                className="w-0.5 h-3 rounded-full"
                style={{ background: accent, transformOrigin: 'center' }}
              />
            ))}
          </div>
        </motion.div>

        {/* ── Agent identity card ────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: accentBg, border: `1px solid ${accentBorder}` }}
        >
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 relative" style={{ background: `${accent}30` }}>
            <Brain className="h-5 w-5" style={{ color: accent }} />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 rounded-xl border border-dashed"
              style={{ borderColor: `${accent}40` }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">Hermes — Tu Mánager de IA</p>
            <p className="text-xs text-white/50 mt-1 leading-relaxed">
              Agente autónomo que aprende la historia, metas y marca de <span className="text-white/75 font-medium">{artistName}</span> para actuar como mánager personal 24/7: planifica contenido, analiza competencia y ejecuta reportes semanales.
            </p>
            <button
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-1 mt-2 text-[11px] font-semibold hover:opacity-80 transition-opacity"
              style={{ color: accent }}
            >
              <HelpCircle className="h-3 w-3" /> Ver guía completa <ArrowRight className="h-2.5 w-2.5" />
            </button>
          </div>
        </motion.div>

        {/* ── Stat cards ────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Memoria', value: 'MEMORY.md', icon: BookOpen, color: '#8b5cf6', tip: 'Historial del artista' },
            { label: 'Skills', value: '3 activos', icon: Zap, color: accent, tip: 'Habilidades cargadas' },
            { label: 'Integración', value: 'Active', icon: Activity, color: '#4ade80', tip: 'Estado del sistema' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-xl p-2.5 text-center"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              title={stat.tip}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-1.5" style={{ background: `${stat.color}20` }}>
                <stat.icon className="h-3.5 w-3.5" style={{ color: stat.color }} />
              </div>
              <p className="text-white text-[11px] font-bold leading-tight">{stat.value}</p>
              <p className="text-white/40 text-[10px] mt-0.5">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* ── How it works — mini flow ─────────────────────── */}
        <div>
          <p className="text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
            <Cpu className="h-3 w-3" /> Cómo funciona
          </p>
          <div className="flex items-stretch gap-0">
            {[
              { icon: Brain, label: 'Lee\nMEMORY', color: '#8b5cf6' },
              { icon: Heart, label: 'Aplica\nSOUL', color: '#ec4899' },
              { icon: Target, label: 'Ejecuta\nGoals', color: '#f59e0b' },
              { icon: Sparkles, label: 'Entrega\nResultados', color: '#10b981' },
            ].map((step, i) => (
              <div key={i} className="flex items-center flex-1 min-w-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="flex-1 rounded-lg p-2 text-center"
                  style={{ background: `${step.color}10`, border: `1px solid ${step.color}25` }}
                >
                  <step.icon className="h-3.5 w-3.5 mx-auto mb-1" style={{ color: step.color }} />
                  <p className="text-[10px] text-white/60 leading-tight whitespace-pre-line">{step.label}</p>
                </motion.div>
                {i < 3 && (
                  <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                  >
                    <ArrowRight className="h-3 w-3 text-white/20 mx-0.5 flex-shrink-0" />
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Pre-built Skills ─────────────────────────────── */}
        <div>
          <p className="text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Layers className="h-3 w-3" /> Skills automáticos
          </p>
          <div className="space-y-2">
            {[
              { id: 'weekly_check', label: '📋 Weekly Artist Check', desc: 'Cada lunes 9 AM — reporte de salud: streams, posts y metas de la semana', icon: Activity, color: '#3b82f6' },
              { id: 'content_calendar', label: '📅 Content Calendar', desc: 'Genera un plan de contenido de 30 días para tus redes sociales', icon: Calendar, color: '#10b981' },
              { id: 'competitor_analysis', label: '🔍 Competitor Analysis', desc: 'Investiga 5 artistas similares e identifica oportunidades de crecimiento', icon: BarChart3, color: '#f97316' },
            ].map((skill, i) => (
              <motion.div
                key={skill.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.07 }}
                className="rounded-xl p-3 flex items-start gap-2.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${skill.color}18` }}>
                  <skill.icon className="h-3.5 w-3.5" style={{ color: skill.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold">{skill.label}</p>
                  <p className="text-white/40 text-[11px] mt-0.5 leading-relaxed">{skill.desc}</p>
                </div>
                <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
                  Auto
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Capabilities chips ────────────────────────────── */}
        {capabilities.length > 0 && (
          <div>
            <p className="text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-2">Capacidades</p>
            <div className="flex flex-wrap gap-1.5">
              {capabilities.map((cap) => (
                <span key={cap} className="px-2 py-0.5 rounded-full text-xs"
                  style={{ background: accentBg, color: accent, border: `1px solid ${accentBorder}` }}>
                  {cap}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Setup note ────────────────────────────────────── */}
        <div className="rounded-xl p-3 flex items-start gap-2.5"
          style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.18)' }}>
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-yellow-400" />
          <p className="text-yellow-300/70 text-xs leading-relaxed">
            Hermes corre en WSL2 en tu servidor. Ejecuta <code className="bg-white/10 px-1 rounded text-yellow-200">hermes/setup-hermes-wsl2.sh</code> para activar el agente autónomo.
          </p>
        </div>
      </div>
    );
  }

  function renderMemory() {
    if (memoryLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} />
        </div>
      );
    }
    const memory: string = memoryData?.memory || '# No memory data yet';
    const lines = memory.split('\n');
    const preview = lines.slice(0, 30).join('\n');

    return (
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-white/60 text-xs font-medium uppercase tracking-wide flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            MEMORY.md
          </p>
          <button
            type="button"
            onClick={() => setShowFullMemory((v) => !v)}
            className="flex items-center gap-1 text-xs"
            style={{ color: accent }}
          >
            {showFullMemory ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showFullMemory ? 'Collapse' : 'Expand all'}
          </button>
        </div>
        <div
          className="rounded-xl p-3 font-mono text-xs text-white/75 leading-relaxed overflow-auto"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: `1px solid ${accentBorder}`,
            maxHeight: showFullMemory ? '600px' : '280px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {showFullMemory ? memory : preview}
          {!showFullMemory && lines.length > 30 && (
            <span className="text-white/30 block mt-2">… {lines.length - 30} more lines</span>
          )}
        </div>
        <p className="text-white/30 text-xs">
          This file is what Hermes reads on every boot to understand {artistName}'s history.
        </p>
      </div>
    );
  }

  function renderSoul() {
    if (soulLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} />
        </div>
      );
    }
    const soul: string = soulData?.soul || '# No soul data yet';
    const lines = soul.split('\n');
    const preview = lines.slice(0, 30).join('\n');

    return (
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-white/60 text-xs font-medium uppercase tracking-wide flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" />
            SOUL.md — Personality &amp; Values
          </p>
          <button
            type="button"
            onClick={() => setShowFullSoul((v) => !v)}
            className="flex items-center gap-1 text-xs"
            style={{ color: accent }}
          >
            {showFullSoul ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showFullSoul ? 'Collapse' : 'Expand all'}
          </button>
        </div>
        <div
          className="rounded-xl p-3 font-mono text-xs text-white/75 leading-relaxed overflow-auto"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: `1px solid ${accentBorder}`,
            maxHeight: showFullSoul ? '600px' : '280px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {showFullSoul ? soul : preview}
          {!showFullSoul && lines.length > 30 && (
            <span className="text-white/30 block mt-2">… {lines.length - 30} more lines</span>
          )}
        </div>
        <p className="text-white/30 text-xs">
          SOUL.md defines Hermes' identity when acting on behalf of {artistName}.
        </p>
      </div>
    );
  }

  function renderGoals() {
    if (goalsLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: accent }} />
        </div>
      );
    }
    const goals: HermesGoal[] = goalsData?.goals || [];

    return (
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-white/60 text-xs font-medium uppercase tracking-wide flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Active Goals ({goals.length})
          </p>
        </div>

        {goals.length === 0 ? (
          <div
            className="rounded-xl p-4 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <Target className="h-6 w-6 mx-auto mb-2 text-white/20" />
            <p className="text-white/40 text-xs">No goals defined yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="rounded-lg p-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium leading-tight">{goal.title}</p>
                    {goal.description && (
                      <p className="text-white/50 text-xs mt-1 leading-relaxed">{goal.description}</p>
                    )}
                  </div>
                  <span
                    className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border ${priorityColor(goal.priority)}`}
                  >
                    {priorityLabel(goal.priority)}
                  </span>
                </div>
                {goal.status && (
                  <div className="flex items-center gap-1 mt-2">
                    {goal.status === 'completed' ? (
                      <CheckCircle2 className="h-3 w-3 text-green-400" />
                    ) : goal.status === 'active' ? (
                      <Play className="h-3 w-3 text-blue-400" />
                    ) : (
                      <AlertCircle className="h-3 w-3 text-yellow-400" />
                    )}
                    <span className="text-white/40 text-xs capitalize">{goal.status}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-white/30 text-xs">
          Goals are auto-generated from your Blueprint and updated by Hermes as you progress.
        </p>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div className={cardStyles} style={cardStyleInline}>

      {/* ── GUIDE OVERLAY ─────────────────────────────────────── */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            key="hermes-guide-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(6px)' }}
            onClick={() => setShowGuide(false)}
          >
            <motion.div
              initial={{ y: 64, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 64, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10"
              style={{ background: 'linear-gradient(145deg,#0d0d12,#191924)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Sticky header */}
              <div
                className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/8 rounded-t-2xl"
                style={{ background: 'rgba(13,13,18,0.96)', backdropFilter: 'blur(12px)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: accentBg }}>
                    <Bot className="w-4 h-4" style={{ color: accent }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black tracking-widest uppercase" style={{ color: accent }}>Guía del Agente</p>
                    <h3 className="text-base font-bold text-white leading-tight">Hermes — ¿Cómo funciona?</h3>
                  </div>
                </div>
                <button onClick={() => setShowGuide(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Guide items */}
              <div className="px-4 sm:px-6 py-4 space-y-3">
                {GUIDE_ITEMS.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-3 p-3 rounded-xl border border-white/6"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ background: `${item.color}20` }}>
                      <item.icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white mb-1">{item.title}</p>
                      <p className="text-xs text-gray-400 leading-relaxed">{item.body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 sm:px-6 py-4 border-t border-white/8">
                <p className="text-[10px] text-gray-500 text-center">
                  Hermes corre en WSL2 · Impulsado por OpenRouter · Memoria persistente entre sesiones
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {renderHeader()}

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="hermes-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Tab bar */}
            <div
              className="flex items-center gap-1 px-4 py-2"
              style={{ borderBottom: `1px solid ${accentBorder}` }}
            >
              {([
                { id: 'overview', label: 'Overview', Icon: Bot },
                { id: 'memory', label: 'Memoria', Icon: BookOpen },
                { id: 'soul', label: 'Soul', Icon: Heart },
                { id: 'goals', label: 'Goals', Icon: Target },
                { id: 'ledger', label: 'Ledger', Icon: BookMarked },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  style={tabStyle(activeTab === id)}
                  onClick={() => setActiveTab(id)}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'memory' && renderMemory()}
                {activeTab === 'soul' && renderSoul()}
                {activeTab === 'goals' && renderGoals()}
                {activeTab === 'ledger' && renderLedger()}
              </motion.div>
            </AnimatePresence>

            {/* Footer */}
            <div
              className="px-4 py-2.5 flex items-center justify-between"
              style={{ borderTop: `1px solid ${accentBorder}` }}
            >
              <p className="text-white/25 text-xs">The Codex v1.0 · Boostify AI</p>
              <div className="flex items-center gap-1">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles className="h-3 w-3" style={{ color: accent }} />
                </motion.div>
                <span className="text-xs" style={{ color: accent }}>OpenRouter</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
