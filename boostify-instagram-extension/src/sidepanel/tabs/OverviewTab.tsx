import { usePanelStore } from '../store';

export default function OverviewTab() {
  const { connection, snapshot, recentPosts } = usePanelStore();

  if (!connection) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-pink-400">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
        <h3 className="text-lg font-bold mb-1">No Conectado</h3>
        <p className="text-xs text-white/40">Conecta tu extensión desde el popup para ver tus estadísticas</p>
      </div>
    );
  }

  const stats = [
    { label: 'Seguidores', value: formatNumber(snapshot?.followers || 0), icon: '👥', color: 'from-purple-500/20 to-purple-600/20' },
    { label: 'Siguiendo', value: formatNumber(snapshot?.following || 0), icon: '👤', color: 'from-blue-500/20 to-blue-600/20' },
    { label: 'Posts', value: formatNumber(snapshot?.postsCount || 0), icon: '📸', color: 'from-pink-500/20 to-pink-600/20' },
    { label: 'Engagement', value: `${(snapshot?.engagementRate || 0).toFixed(2)}%`, icon: '📊', color: 'from-orange-500/20 to-orange-600/20' },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Profile Header */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center text-lg font-bold">
            {connection.instagramUsername?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h3 className="font-bold">@{connection.instagramUsername}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-green-400">Conectado</span>
              {snapshot?.isVerified && <span className="text-blue-400 text-xs">✓</span>}
            </div>
          </div>
        </div>
        {snapshot?.bio && (
          <p className="text-xs text-white/50 mt-3 leading-relaxed">{snapshot.bio}</p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className={`rounded-xl bg-gradient-to-br ${stat.color} border border-white/[0.06] p-3`}>
            <div className="text-lg mb-0.5">{stat.icon}</div>
            <div className="text-xl font-bold">{stat.value}</div>
            <div className="text-xs text-white/40">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Avg Engagement */}
      {snapshot && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
          <h4 className="font-semibold text-sm mb-3">Promedio por Post</h4>
          <div className="flex gap-4">
            <div>
              <span className="text-sm font-bold text-pink-400">{formatNumber(snapshot.avgLikes || 0)}</span>
              <span className="text-xs text-white/40 ml-1">likes</span>
            </div>
            <div>
              <span className="text-sm font-bold text-purple-400">{formatNumber(snapshot.avgComments || 0)}</span>
              <span className="text-xs text-white/40 ml-1">comments</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Hashtags */}
      {snapshot?.topHashtags && snapshot.topHashtags.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
          <h4 className="font-semibold text-sm mb-3">Top Hashtags</h4>
          <div className="flex flex-wrap gap-1.5">
            {snapshot.topHashtags.slice(0, 12).map((tag) => (
              <span key={tag} className="px-2 py-1 rounded-full bg-pink-500/10 text-pink-400 text-xs">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Posts */}
      {recentPosts.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
          <h4 className="font-semibold text-sm mb-3">Posts Recientes</h4>
          <div className="space-y-2">
            {recentPosts.slice(0, 5).map((post, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50">{post.type}</span>
                  <span className="text-xs text-white/60 truncate max-w-[150px]">
                    {post.caption?.slice(0, 40) || 'Sin caption'}...
                  </span>
                </div>
                <div className="flex gap-2 text-xs text-white/40">
                  <span>❤️ {formatNumber(post.likes)}</span>
                  <span>💬 {post.comments}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}
