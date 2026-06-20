import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PenLine, Music2, Wand2, Image as ImageIcon, Clapperboard, Hash, ListMusic,
  Megaphone, Film, Sparkles, Check, X, Loader2, Clock, ChevronDown, Copy, CheckCheck,
} from 'lucide-react';
import type { CommandTask } from '../../../hooks/use-artist-command';

const ICONS: Record<string, any> = {
  PenLine, Music2, Wand2, Image: ImageIcon, Clapperboard, Hash, ListMusic, Megaphone, Film, Sparkles,
};

function StatusBadge({ status }: { status: CommandTask['status'] }) {
  const map = {
    pending: { label: 'En cola', cls: 'text-white/40 bg-white/5 border-white/10', icon: Clock },
    running: { label: 'Generando', cls: 'text-orange-300 bg-orange-500/10 border-orange-500/30', icon: Loader2 },
    completed: { label: 'Listo', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', icon: Check },
    failed: { label: 'Error', cls: 'text-red-300 bg-red-500/10 border-red-500/30', icon: X },
  }[status];
  const Icon = map.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${map.cls}`}>
      <Icon className={`h-3 w-3 ${status === 'running' ? 'animate-spin' : ''}`} />
      {map.label}
    </span>
  );
}

function ResultBody({ task }: { task: CommandTask }) {
  const [copied, setCopied] = useState(false);
  const out = task.output;
  if (task.status === 'failed') {
    return <p className="text-xs text-red-300/80">{task.error || 'No se pudo generar este módulo.'}</p>;
  }
  if (!out) return null;

  if (out.type === 'image' && out.imageUrl) {
    return (
      <img src={out.imageUrl} alt={out.title} className="w-full rounded-lg border border-white/10 object-cover" />
    );
  }

  const text = out.type === 'json'
    ? JSON.stringify(out.data, null, 2)
    : (out.content || '');

  const copy = () => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div className="relative">
      <button
        onClick={copy}
        className="absolute right-1 top-1 rounded-md bg-white/5 p-1.5 text-white/50 transition hover:bg-white/10 hover:text-orange-300"
        title="Copiar"
      >
        {copied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 pr-9 text-[12px] leading-relaxed text-white/80">
        {text}
      </pre>
    </div>
  );
}

interface PanelProps {
  tasks: CommandTask[];
}

export function CommandExecutionPanel({ tasks }: PanelProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const Icon = ICONS[task.icon] || Sparkles;
        const isOpen = open[task.id] ?? (task.status === 'completed');
        const hasBody = task.status === 'completed' || task.status === 'failed';
        return (
          <motion.div
            key={task.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]"
          >
            <button
              type="button"
              onClick={() => hasBody && setOpen((p) => ({ ...p, [task.id]: !isOpen }))}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                task.status === 'completed' ? 'bg-emerald-500/10 text-emerald-300'
                : task.status === 'running' ? 'bg-orange-500/10 text-orange-300'
                : task.status === 'failed' ? 'bg-red-500/10 text-red-300'
                : 'bg-white/5 text-white/40'
              }`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-medium text-white/90">{task.label}</span>
              <StatusBadge status={task.status} />
              {hasBody && (
                <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              )}
            </button>
            <AnimatePresence initial={false}>
              {hasBody && isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-3 pb-3"
                >
                  <ResultBody task={task} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
