import { useState } from 'react';
import { analyzeBestTime } from '../../shared/api-client';
import { usePanelStore } from '../store';

export default function TimingTab() {
  const { connection } = usePanelStore();
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);

  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  async function handleAnalyze() {
    setLoading(true);
    setAnalysis(null);
    try {
      const data = await analyzeBestTime({ timezone, username: connection?.instagramUsername });
      setAnalysis(data);
    } catch (err: any) {
      setAnalysis({ error: err.message });
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
          ⏰ Mejor Hora para Publicar
        </h3>
        <p className="text-xs text-white/40 mb-4">Analiza cuándo tu audiencia está más activa</p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Zona Horaria</label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm focus:outline-none focus:border-pink-500/50"
            />
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 font-semibold text-sm transition-all disabled:opacity-50"
          >
            {loading ? '⟳ Analizando...' : '⏰ Analizar Mejor Hora'}
          </button>
        </div>
      </div>

      {/* Results */}
      {analysis && !analysis.error && (
        <>
          {/* Best times */}
          {analysis.bestTimes && (
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
              <h4 className="font-semibold text-sm mb-3">🏆 Mejores Horarios</h4>
              <div className="space-y-2">
                {analysis.bestTimes.map((time: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : 'text-orange-400'}`}>
                        #{i + 1}
                      </span>
                      <span className="text-sm">{time.day} - {time.hour}</span>
                    </div>
                    <span className="text-xs text-green-400">{time.engagement}% eng</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekly heatmap */}
          {analysis.heatmap && (
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
              <h4 className="font-semibold text-sm mb-3">📊 Mapa de Actividad</h4>
              <div className="grid grid-cols-7 gap-1">
                {dayNames.map((day, i) => (
                  <div key={day} className="text-center">
                    <div className="text-[10px] text-white/40 mb-1">{day}</div>
                    <div
                      className="w-full aspect-square rounded-md"
                      style={{
                        backgroundColor: `rgba(225, 48, 108, ${(analysis.heatmap?.[i] || 0) / 100})`,
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          {analysis.tips && (
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
              <h4 className="font-semibold text-sm mb-3">💡 Consejos</h4>
              <ul className="space-y-2">
                {analysis.tips.map((tip: string, i: number) => (
                  <li key={i} className="text-xs text-white/60 flex items-start gap-2">
                    <span className="text-pink-400 mt-0.5">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {analysis?.error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
          {analysis.error}
        </div>
      )}
    </div>
  );
}
