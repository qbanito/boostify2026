import { motion } from 'framer-motion';
import {
  PenLine, Music2, Wand2, Image as ImageIcon, Clapperboard, Hash, ListMusic,
  Megaphone, Film, Sparkles, Check, X, Loader2,
} from 'lucide-react';
import type { CommandTask } from '../../../hooks/use-artist-command';

const ICONS: Record<string, any> = {
  PenLine, Music2, Wand2, Image: ImageIcon, Clapperboard, Hash, ListMusic, Megaphone, Film, Sparkles,
};

interface AnimationProps {
  artistName: string;
  artistImageUrl?: string | null;
  tasks: CommandTask[];
  progress: number;
  status: string;
  currentModule?: string;
}

function NodeIcon({ name, className }: { name: string; className?: string }) {
  const Comp = ICONS[name] || Sparkles;
  return <Comp className={className} />;
}

/**
 * Cinematic execution stage — dark backdrop, orange energy, artist avatar in
 * the center radiating to module "nodes" that light up as each task runs.
 */
export function ArtistCommandAnimation({
  artistName, artistImageUrl, tasks, progress, status, currentModule,
}: AnimationProps) {
  const count = Math.max(tasks.length, 1);
  const radius = 120;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-b from-[#1a0f05] via-black to-black p-6">
      {/* ambient glow */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/10 blur-3xl"
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      {/* scanning rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="pointer-events-none absolute left-1/2 top-1/2 rounded-full border border-orange-500/15"
          style={{ width: 160 + i * 70, height: 160 + i * 70, x: '-50%', y: '-50%' }}
          animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
          transition={{ duration: 24 + i * 8, repeat: Infinity, ease: 'linear' }}
        />
      ))}

      <div className="relative mx-auto flex h-[300px] w-full max-w-[340px] items-center justify-center">
        {/* center avatar */}
        <motion.div
          className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        >
          <div className="absolute inset-0 rounded-full bg-orange-500/30 blur-md" />
          <div className="absolute -inset-1 rounded-full border-2 border-orange-400/60" />
          {artistImageUrl ? (
            <img
              src={artistImageUrl}
              alt={artistName}
              className="relative h-24 w-24 rounded-full object-cover ring-2 ring-orange-400/70"
            />
          ) : (
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-orange-500/20 text-2xl font-bold text-orange-200 ring-2 ring-orange-400/70">
              {artistName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </motion.div>

        {/* module nodes orbiting */}
        {tasks.map((task, i) => {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const active = task.status === 'running' || task.moduleKey === currentModule;
          const done = task.status === 'completed';
          const failed = task.status === 'failed';
          return (
            <motion.div
              key={task.id}
              className="absolute left-1/2 top-1/2 z-20"
              style={{ x, y }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06 }}
            >
              <div className="-translate-x-1/2 -translate-y-1/2">
                <motion.div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl border backdrop-blur ${
                    failed ? 'border-red-500/60 bg-red-500/10 text-red-300'
                    : done ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                    : active ? 'border-orange-400 bg-orange-500/20 text-orange-200'
                    : 'border-white/15 bg-white/5 text-white/40'
                  }`}
                  animate={active ? { scale: [1, 1.12, 1], boxShadow: ['0 0 0px rgba(249,115,22,0)', '0 0 18px rgba(249,115,22,0.6)', '0 0 0px rgba(249,115,22,0)'] } : {}}
                  transition={{ duration: 1.4, repeat: active ? Infinity : 0 }}
                >
                  {failed ? <X className="h-5 w-5" />
                    : done ? <Check className="h-5 w-5" />
                    : active ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <NodeIcon name={task.icon} className="h-5 w-5" />}
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* global progress */}
      <div className="relative mt-2">
        <div className="mb-1 flex items-center justify-between text-[11px] text-white/60">
          <span>
            {status === 'completed' ? '✨ Creación lista'
              : status === 'failed' ? 'Algunos módulos fallaron'
              : currentModule ? `Procesando · ${tasks.find((t) => t.moduleKey === currentModule)?.label || ''}`
              : 'Inicializando módulos…'}
          </span>
          <span className="font-semibold text-orange-300">{progress}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-300"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
      </div>
    </div>
  );
}
