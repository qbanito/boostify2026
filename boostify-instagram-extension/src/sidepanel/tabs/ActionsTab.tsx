import { useEffect, useState } from 'react';
import { usePanelStore } from '../store';

export default function ActionsTab() {
  const { connection, pendingActions } = usePanelStore();
  const [filter, setFilter] = useState<string>('all');

  const actionTypeLabels: Record<string, { icon: string; label: string }> = {
    post_caption: { icon: '✍️', label: 'Caption' },
    update_bio: { icon: '✨', label: 'Bio Update' },
    schedule_post: { icon: '📅', label: 'Post Programado' },
    reply_comment: { icon: '💬', label: 'Responder' },
    follow_user: { icon: '👤', label: 'Seguir' },
    use_hashtags: { icon: '#️⃣', label: 'Hashtags' },
    post_story: { icon: '📱', label: 'Story' },
    post_reel: { icon: '🎬', label: 'Reel' },
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
    cancelled: 'bg-gray-500/20 text-gray-400',
  };

  const filtered = filter === 'all'
    ? pendingActions
    : pendingActions.filter(a => a.status === filter);

  if (!connection) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-white/40">Conecta tu extensión primero</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            📋 Acciones Pendientes
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-400">
            {pendingActions.filter(a => a.status === 'pending').length} pendientes
          </span>
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {['all', 'pending', 'in_progress', 'completed', 'failed'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                filter === s
                  ? 'bg-white/10 text-white'
                  : 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06]'
              }`}
            >
              {s === 'all' ? 'Todos' : s === 'pending' ? 'Pendientes' : s === 'in_progress' ? 'En Progreso' : s === 'completed' ? 'Completados' : 'Fallidos'}
            </button>
          ))}
        </div>
      </div>

      {/* Actions list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm text-white/40">No hay acciones {filter !== 'all' ? 'con ese filtro' : 'pendientes'}</p>
          <p className="text-xs text-white/25 mt-1">Las acciones se crean desde tu dashboard</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((action, i) => {
            const meta = actionTypeLabels[action.actionType] || { icon: '📌', label: action.actionType };
            const statusClass = statusColors[action.status] || 'bg-gray-500/20 text-gray-400';

            return (
              <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{meta.icon}</span>
                    <div>
                      <h5 className="text-sm font-medium">{meta.label}</h5>
                      {action.payload && (
                        <p className="text-xs text-white/40 mt-0.5 max-w-[200px] truncate">
                          {typeof action.payload === 'string' ? action.payload : JSON.stringify(action.payload).slice(0, 80)}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusClass}`}>
                    {action.status}
                  </span>
                </div>
                {action.createdAt && (
                  <div className="text-[10px] text-white/20 mt-2">
                    {new Date(action.createdAt).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
