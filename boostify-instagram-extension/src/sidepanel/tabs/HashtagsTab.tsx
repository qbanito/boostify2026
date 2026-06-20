import { useState } from 'react';
import { generateHashtags } from '../../shared/api-client';
import { usePanelStore } from '../store';

export default function HashtagsTab() {
  const { connection } = usePanelStore();
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('music');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{ hashtags: string[]; categories?: any } | null>(null);
  const [copied, setCopied] = useState(false);

  const niches = [
    { value: 'music', label: '🎵 Música' },
    { value: 'art', label: '🎨 Arte' },
    { value: 'fashion', label: '👗 Moda' },
    { value: 'fitness', label: '💪 Fitness' },
    { value: 'food', label: '🍕 Comida' },
    { value: 'travel', label: '✈️ Viajes' },
    { value: 'tech', label: '💻 Tech' },
    { value: 'lifestyle', label: '🌿 Lifestyle' },
  ];

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setResults(null);
    try {
      const data = await generateHashtags({ topic, niche });
      setResults(data);
    } catch (err: any) {
      setResults({ hashtags: [`Error: ${err.message}`] });
    } finally {
      setLoading(false);
    }
  }

  async function copyAll() {
    if (!results?.hashtags) return;
    const text = results.hashtags.map(h => h.startsWith('#') ? h : `#${h}`).join(' ');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          #️⃣ Generador de Hashtags
        </h3>
        <p className="text-xs text-white/40 mb-4">Encuentra los mejores hashtags para maximizar tu alcance</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Tema / Post</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Describe tu post o tema..."
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm placeholder:text-white/20 focus:outline-none focus:border-pink-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Nicho</label>
            <div className="grid grid-cols-2 gap-1.5">
              {niches.map((n) => (
                <button
                  key={n.value}
                  onClick={() => setNiche(n.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    niche === n.value
                      ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                      : 'bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06]'
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-semibold text-sm transition-all disabled:opacity-50"
          >
            {loading ? '⟳ Buscando...' : '#️⃣ Generar Hashtags'}
          </button>
        </div>
      </div>

      {/* Results */}
      {results && results.hashtags.length > 0 && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white/70">
              {results.hashtags.length} Hashtags
            </h4>
            <button
              onClick={copyAll}
              className="px-3 py-1 rounded-lg bg-pink-500/15 text-pink-400 text-xs font-medium hover:bg-pink-500/25 transition-all"
            >
              {copied ? '✓ Copiado' : '📋 Copiar todos'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {results.hashtags.map((tag, i) => (
              <button
                key={i}
                onClick={() => {
                  const t = tag.startsWith('#') ? tag : `#${tag}`;
                  navigator.clipboard.writeText(t);
                }}
                className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-300 text-xs hover:bg-purple-500/20 transition-all cursor-pointer"
              >
                {tag.startsWith('#') ? tag : `#${tag}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
