/**
 * BOOSTIFY ARTIST NODE FLOW — NodeInspector
 * Bottom panel: shows config and last output of selected node.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronDown, CheckCircle2, XCircle, Loader2, CircleDot } from 'lucide-react';
import { useFlowStore } from './useFlowStore';

const NODE_LABELS: Record<string, string> = {
  artistInput: 'Artist Input',
  songInput: 'Song Input',
  bioGenerator: 'Bio Generator',
  coverArt: 'Cover Art',
  karaoke: 'Karaoke',
  promoClip: 'Promo Clip',
  socialPost: 'Social Post',
  shareCard: 'Share Card',
  profileUpdate: 'Profile Update',
  newsPublisher: 'News Publisher',
};

const NODE_ENDPOINT: Record<string, string> = {
  bioGenerator: 'POST /api/generate/biography',
  coverArt: 'POST /api/generate/cover-art',
  karaoke: 'POST /api/karaoke/:songId/generate',
  promoClip: 'POST /api/promo-clips/generate',
  socialPost: 'POST /api/generate/social-post',
  shareCard: 'Canvas (local)',
  profileUpdate: 'PATCH /api/artist/:id',
  newsPublisher: 'POST /api/artist-news',
  artistInput: 'Store context',
  songInput: 'GET /api/songs/:id',
};

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === 'idle') return <span className="flex items-center gap-1 text-slate-500 text-xs"><CircleDot className="w-3 h-3" /> IDLE</span>;
  if (status === 'running') return <span className="flex items-center gap-1 text-orange-400 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> RUNNING</span>;
  if (status === 'done') return <span className="flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle2 className="w-3 h-3" /> DONE</span>;
  return <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle className="w-3 h-3" /> ERROR</span>;
}

export function NodeInspector() {
  const store = useFlowStore();
  const selectedId = store.selectedNodeId;
  const node = selectedId ? store.nodes.find(n => n.id === selectedId) : null;

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="flex-shrink-0"
          style={{
            height: 180,
            background: 'rgba(8,8,14,0.97)',
            borderTop: '1px solid rgba(99,102,241,0.2)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex h-full">
            {/* Node meta */}
            <div className="w-56 flex-shrink-0 px-4 py-3 border-r border-white/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-white">
                  {NODE_LABELS[node.type ?? ''] ?? node.type}
                </p>
                <button
                  onClick={() => store.selectNode(null)}
                  className="p-0.5 rounded hover:bg-white/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
              <StatusBadge status={node.data.status} />
              <p className="text-[10px] text-slate-600 mt-2 font-mono">
                {NODE_ENDPOINT[node.type ?? ''] ?? '—'}
              </p>
              <p className="text-[10px] text-slate-600 mt-1 font-mono truncate">ID: {node.id}</p>
            </div>

            {/* Output */}
            <div className="flex-1 px-4 py-3 overflow-auto">
              {node.data.error ? (
                <div>
                  <p className="text-[10px] font-semibold text-red-400 mb-1.5">ERROR</p>
                  <p className="text-xs text-red-300 bg-red-500/10 rounded-md px-3 py-2 border border-red-500/20">
                    {node.data.error}
                  </p>
                </div>
              ) : node.data.output && Object.keys(node.data.output).length > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold text-emerald-400 mb-1.5">OUTPUT</p>
                  <div className="space-y-1">
                    {Object.entries(node.data.output).map(([key, val]) => (
                      <div key={key} className="flex gap-2 text-xs">
                        <span className="text-slate-500 font-mono flex-shrink-0">{key}:</span>
                        <span className="text-slate-300 truncate">
                          {typeof val === 'string'
                            ? val.startsWith('data:image') ? '[Image data]' : val.slice(0, 120)
                            : (JSON.stringify(val) ?? 'undefined').slice(0, 120)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-600 text-xs">No output yet — run the flow to see results here</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
