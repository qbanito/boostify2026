/**
 * BOOSTIFY ARTIST NODE FLOW — FlowToolbar
 * Top bar: Run / Stop / Clear / artist name display.
 */

import { Play, Square, Trash2, ChevronLeft, Network } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFlowStore } from './useFlowStore';
import { useFlowRunner } from './useFlowRunner';

interface FlowToolbarProps {
  onBack: () => void;
}

export function FlowToolbar({ onBack }: FlowToolbarProps) {
  const store = useFlowStore();
  const { run } = useFlowRunner();

  const nodeCount = store.nodes.length;
  const edgeCount = store.edges.length;
  const hasNodes = nodeCount > 0;
  const isRunning = store.isRunning;

  return (
    <div
      className="flex items-center justify-between px-4 h-12 flex-shrink-0 z-10"
      style={{
        background: 'rgba(8,8,14,0.97)',
        borderBottom: '1px solid rgba(99,102,241,0.2)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Left: back + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded-md hover:bg-white/5"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Profile
        </button>

        <div className="w-px h-5 bg-white/10" />

        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-bold text-white tracking-wide">ARTIST NODE FLOW</span>
          {store.artistSlug && (
            <span className="text-xs text-slate-500">— @{store.artistSlug}</span>
          )}
        </div>

        <div className="flex items-center gap-2 ml-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
            {nodeCount} nodes
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: '#64748b' }}>
            {edgeCount} edges
          </span>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Clear */}
        <button
          onClick={store.clearFlow}
          disabled={!hasNodes || isRunning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 text-slate-400 hover:text-white"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear
        </button>

        {/* Stop */}
        {isRunning && (
          <button
            onClick={() => store.setIsRunning(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop
          </button>
        )}

        {/* Run */}
        <motion.button
          whileHover={hasNodes && !isRunning ? { scale: 1.04 } : {}}
          whileTap={hasNodes && !isRunning ? { scale: 0.96 } : {}}
          onClick={hasNodes && !isRunning ? run : undefined}
          disabled={!hasNodes || isRunning}
          className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: hasNodes && !isRunning
              ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
              : 'rgba(99,102,241,0.2)',
            color: '#fff',
            border: '1px solid rgba(139,92,246,0.5)',
            boxShadow: hasNodes && !isRunning ? '0 0 16px rgba(99,102,241,0.4)' : 'none',
          }}
        >
          {isRunning ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Flow
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
