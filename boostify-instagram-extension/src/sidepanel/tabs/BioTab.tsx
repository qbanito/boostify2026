import { useState } from 'react';
import { optimizeBio } from '../../shared/api-client';
import { usePanelStore } from '../store';

export default function BioTab() {
  const { connection, snapshot } = usePanelStore();
  const [currentBio, setCurrentBio] = useState(snapshot?.bio || '');
  const [goals, setGoals] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  const goalOptions = [
    { value: 'followers', label: '📈 Más seguidores' },
    { value: 'sales', label: '💰 Más ventas' },
    { value: 'engagement', label: '💬 Más engagement' },
    { value: 'brand', label: '🎯 Branding' },
    { value: 'traffic', label: '🔗 Tráfico web' },
    { value: 'music', label: '🎵 Promoción musical' },
  ];

  async function handleOptimize() {
    setLoading(true);
    setSuggestions([]);
    try {
      const data = await optimizeBio({
        currentBio,
        goals,
        username: connection?.instagramUsername,
      });
      setSuggestions(data.suggestions || data.bios || []);
    } catch (err: any) {
      setSuggestions([`Error: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  }

  async function copyBio(text: string, idx: number) {
    await navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
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
          ✨ Optimizador de Bio
        </h3>
        <p className="text-xs text-white/40 mb-4">Mejora tu bio para atraer más seguidores y engagement</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Tu Bio Actual</label>
            <textarea
              value={currentBio}
              onChange={(e) => setCurrentBio(e.target.value)}
              placeholder="Pega o escribe tu bio actual..."
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm placeholder:text-white/20 focus:outline-none focus:border-pink-500/50 resize-none h-20"
            />
            <div className="text-right text-[10px] text-white/30 mt-1">
              {currentBio.length}/150 caracteres
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Objetivo</label>
            <div className="grid grid-cols-2 gap-1.5">
              {goalOptions.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setGoals(g.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    goals === g.value
                      ? 'bg-pink-500/20 border border-pink-500/40 text-pink-300'
                      : 'bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06]'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleOptimize}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 font-semibold text-sm transition-all disabled:opacity-50"
          >
            {loading ? '⟳ Optimizando...' : '✨ Optimizar Bio'}
          </button>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white/70">Sugerencias</h4>
          {suggestions.map((bio, i) => (
            <div
              key={i}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 group relative"
            >
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{bio}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
                <span className="text-[10px] text-white/30">{bio.length}/150 chars</span>
                <button
                  onClick={() => copyBio(bio, i)}
                  className="px-2 py-1 rounded-lg bg-pink-500/15 text-pink-400 text-xs hover:bg-pink-500/25 transition-all"
                >
                  {copied === i ? '✓ Copiado' : '📋 Copiar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
