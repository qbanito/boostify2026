import { useState } from 'react';
import { generateCaptions } from '../../shared/api-client';
import { usePanelStore } from '../store';

export default function CaptionsTab() {
  const { connection } = usePanelStore();
  const [topic, setTopic] = useState('');
  const [mood, setMood] = useState('inspirational');
  const [language, setLanguage] = useState('es');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [copied, setCopied] = useState<number | null>(null);

  const moods = [
    { value: 'inspirational', label: '✨ Inspiracional' },
    { value: 'funny', label: '😄 Divertido' },
    { value: 'professional', label: '💼 Profesional' },
    { value: 'casual', label: '😎 Casual' },
    { value: 'promotional', label: '🎯 Promocional' },
    { value: 'storytelling', label: '📖 Storytelling' },
  ];

  async function handleGenerate() {
    if (!topic.trim()) return;
    setLoading(true);
    setResults([]);
    try {
      const data = await generateCaptions({ topic, mood, language });
      setResults(data.captions || []);
    } catch (err: any) {
      setResults([`Error: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard(text: string, idx: number) {
    await navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!connection) {
    return <NotConnectedMsg />;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
        <h3 className="font-bold text-sm mb-1 flex items-center gap-2">
          ✍️ Generador de Captions
        </h3>
        <p className="text-xs text-white/40 mb-4">Crea captions perfectos para tus posts con IA</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Tema / Descripción</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Describe de qué trata tu post..."
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm placeholder:text-white/20 focus:outline-none focus:border-pink-500/50 resize-none h-20"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Tono</label>
            <div className="grid grid-cols-2 gap-1.5">
              {moods.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMood(m.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    mood === m.value
                      ? 'bg-pink-500/20 border border-pink-500/40 text-pink-300'
                      : 'bg-white/[0.03] border border-white/[0.06] text-white/50 hover:bg-white/[0.06]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Idioma</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm focus:outline-none focus:border-pink-500/50"
            >
              <option value="es">🇪🇸 Español</option>
              <option value="en">🇺🇸 English</option>
              <option value="pt">🇧🇷 Português</option>
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 font-semibold text-sm transition-all disabled:opacity-50"
          >
            {loading ? '⟳ Generando...' : '🚀 Generar Captions'}
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white/70">Resultados</h4>
          {results.map((caption, i) => (
            <div
              key={i}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 group relative"
            >
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{caption}</p>
              <button
                onClick={() => copyToClipboard(caption, i)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 px-2 py-1 rounded-lg bg-white/[0.1] text-xs transition-all"
              >
                {copied === i ? '✓ Copiado' : '📋 Copiar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NotConnectedMsg() {
  return (
    <div className="p-6 text-center">
      <p className="text-sm text-white/40">Conecta tu extensión primero</p>
    </div>
  );
}
