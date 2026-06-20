import { useState } from 'react';
import { generateContentIdeas } from '../../shared/api-client';
import { usePanelStore } from '../store';

export default function IdeasTab() {
  const { connection } = usePanelStore();
  const [niche, setNiche] = useState('music');
  const [format, setFormat] = useState('all');
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<any[]>([]);

  const formats = [
    { value: 'all', label: '🎯 Todos' },
    { value: 'post', label: '📸 Post' },
    { value: 'reel', label: '🎬 Reel' },
    { value: 'story', label: '📱 Story' },
    { value: 'carousel', label: '🎠 Carrusel' },
  ];

  async function handleGenerate() {
    setLoading(true);
    setIdeas([]);
    try {
      const data = await generateContentIdeas({ niche, format });
      setIdeas(data.ideas || []);
    } catch (err: any) {
      setIdeas([{ title: 'Error', description: err.message }]);
    } finally {
      setLoading(false);
    }
  }

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
        <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
          💡 Ideas de Contenido
        </h3>
        <p className="text-xs text-white/40 mb-4">Genera ideas creativas para tu próximo contenido</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Nicho</label>
            <input
              type="text"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Tu nicho o tema principal..."
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm placeholder:text-white/20 focus:outline-none focus:border-pink-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Formato</label>
            <div className="flex gap-1.5 flex-wrap">
              {formats.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    format === f.value
                      ? 'bg-orange-500/20 border border-orange-500/40 text-orange-300'
                      : 'bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 font-semibold text-sm transition-all disabled:opacity-50"
          >
            {loading ? '⟳ Generando...' : '💡 Generar Ideas'}
          </button>
        </div>
      </div>

      {/* Ideas list */}
      {ideas.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white/70">{ideas.length} Ideas</h4>
          {ideas.map((idea, i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="flex items-start gap-2">
                <span className="text-lg mt-0.5">
                  {idea.format === 'reel' ? '🎬' : idea.format === 'story' ? '📱' : idea.format === 'carousel' ? '🎠' : '📸'}
                </span>
                <div className="flex-1">
                  <h5 className="text-sm font-semibold mb-1">{idea.title}</h5>
                  <p className="text-xs text-white/50 leading-relaxed">{idea.description}</p>
                  {idea.hashtags && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {idea.hashtags.slice(0, 5).map((tag: string, j: number) => (
                        <span key={j} className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
