/**
 * DirectorSuggestionsPanel
 * Panel lateral con sugerencias de mejora del director seleccionado.
 * Analiza el timeline y propone cambios aplicables con un clic.
 */
import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { DirectorProfile } from '../../../data/directors/director-schema';
import type { TimelineClip } from '../../../interfaces/timeline';
import {
  generateDirectorSuggestions,
  getDirectorImageUrl,
  type DirectorSuggestion,
} from '../../../lib/services/director-ai-service';
import {
  Sparkles, Check, X, Loader2, ChevronRight, ChevronDown,
  RefreshCw, RotateCcw, Camera, Clock, Film, Lightbulb,
  Scissors, BookOpen, ImagePlus, Megaphone,
} from 'lucide-react';

interface DirectorSuggestionsPanelProps {
  director: DirectorProfile;
  clips: TimelineClip[];
  isOpen: boolean;
  onClose: () => void;
  onApplySuggestion: (suggestion: DirectorSuggestion) => void;
  onRevertAll: () => void;
  appliedCount: number;
  scriptContent?: string;
}

const SUGGESTION_ICONS: Record<string, React.ReactNode> = {
  shot_change: <Camera size={14} />,
  duration: <Clock size={14} />,
  transition: <Film size={14} />,
  lighting: <Lightbulb size={14} />,
  camera: <Camera size={14} />,
  pacing: <Scissors size={14} />,
  narrative: <BookOpen size={14} />,
  regenerate: <ImagePlus size={14} />,
};

const SUGGESTION_COLORS: Record<string, string> = {
  shot_change: '#f97316',
  duration: '#3b82f6',
  transition: '#a855f7',
  lighting: '#eab308',
  camera: '#ec4899',
  pacing: '#10b981',
  narrative: '#6366f1',
  regenerate: '#f43f5e',
};

const DirectorSuggestionsPanel: React.FC<DirectorSuggestionsPanelProps> = ({
  director,
  clips,
  isOpen,
  onClose,
  onApplySuggestion,
  onRevertAll,
  appliedCount,
  scriptContent,
}) => {
  const [suggestions, setSuggestions] = useState<DirectorSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    if (!director || clips.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateDirectorSuggestions(director, clips, scriptContent);
      setSuggestions(result);
    } catch (err) {
      setError('Error generando sugerencias');
    } finally {
      setIsLoading(false);
    }
  }, [director, clips, scriptContent]);

  // Auto-fetch on open if no suggestions yet
  useEffect(() => {
    if (isOpen && suggestions.length === 0 && !isLoading) {
      fetchSuggestions();
    }
  }, [isOpen, suggestions.length, isLoading, fetchSuggestions]);

  const handleApply = (sug: DirectorSuggestion) => {
    onApplySuggestion(sug);
    setSuggestions(prev => prev.map(s => s.id === sug.id ? { ...s, applied: true } : s));
  };

  const handleDismiss = (sugId: string) => {
    setSuggestions(prev => prev.map(s => s.id === sugId ? { ...s, dismissed: true } : s));
  };

  const activeSuggestions = suggestions.filter(s => !s.dismissed);
  const confidenceLabel = (c: number) => c >= 0.8 ? 'Alta' : c >= 0.5 ? 'Media' : 'Baja';

  if (!isOpen) return null;

  return createPortal(
    <div className="director-panel-overlay" onClick={onClose}>
      <div
        className="director-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="dp-header">
          <div className="dp-header-info">
            <img
              src={getDirectorImageUrl(director)}
              alt={director.name}
              className="dp-avatar"
              onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(director.name)}&scale=80`; }}
            />
            <div>
              <div className="dp-director-name">{director.name}</div>
              <div className="dp-director-specialty">{director.specialty}</div>
            </div>
          </div>
          <div className="dp-header-actions">
            <button className="dp-icon-btn" onClick={fetchSuggestions} title="Refrescar sugerencias">
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button className="dp-icon-btn" onClick={onClose} title="Cerrar">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Applied count badge */}
        {appliedCount > 0 && (
          <div className="dp-applied-bar">
            <Sparkles size={12} />
            <span>{appliedCount} cambio{appliedCount > 1 ? 's' : ''} de {director.name} aplicado{appliedCount > 1 ? 's' : ''}</span>
            <button className="dp-revert-btn" onClick={onRevertAll}>
              <RotateCcw size={11} />
              Revertir todo
            </button>
          </div>
        )}

        {/* Content */}
        <div className="dp-content">
          {isLoading && (
            <div className="dp-loading">
              <Loader2 size={24} className="animate-spin" />
              <p>{director.name} está analizando tu timeline...</p>
            </div>
          )}

          {error && (
            <div className="dp-error">
              <p>{error}</p>
              <button onClick={fetchSuggestions} className="dp-retry-btn">Reintentar</button>
            </div>
          )}

          {!isLoading && !error && activeSuggestions.length === 0 && suggestions.length > 0 && (
            <div className="dp-empty">
              <Check size={24} />
              <p>Todas las sugerencias han sido procesadas</p>
            </div>
          )}

          {!isLoading && activeSuggestions.map((sug) => {
            const color = SUGGESTION_COLORS[sug.type] || '#f97316';
            const icon = SUGGESTION_ICONS[sug.type] || <Sparkles size={14} />;
            const isExpanded = expandedId === sug.id;

            return (
              <div
                key={sug.id}
                className={`dp-suggestion ${sug.applied ? 'applied' : ''}`}
                style={{ '--sug-color': color } as React.CSSProperties}
              >
                <div
                  className="dp-sug-header"
                  onClick={() => setExpandedId(isExpanded ? null : sug.id)}
                >
                  <div className="dp-sug-icon" style={{ color, background: `${color}15` }}>
                    {icon}
                  </div>
                  <div className="dp-sug-info">
                    <div className="dp-sug-title">{sug.title}</div>
                    <div className="dp-sug-meta">
                      <span className="dp-sug-type">{sug.type.replace('_', ' ')}</span>
                      <span className="dp-sug-conf" style={{ color }}>
                        {confidenceLabel(sug.confidence)} ({Math.round(sug.confidence * 100)}%)
                      </span>
                    </div>
                  </div>
                  <div className="dp-sug-chevron">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="dp-sug-body">
                    <p className="dp-sug-desc">{sug.description}</p>
                    {sug.clipId && (
                      <div className="dp-sug-clip">
                        Escena: Clip #{sug.clipId}
                      </div>
                    )}
                    {!sug.applied && (
                      <div className="dp-sug-actions">
                        <button
                          className="dp-apply-btn"
                          onClick={() => handleApply(sug)}
                        >
                          <Check size={12} />
                          Aplicar
                        </button>
                        <button
                          className="dp-dismiss-btn"
                          onClick={() => handleDismiss(sug.id)}
                        >
                          <X size={12} />
                          Descartar
                        </button>
                      </div>
                    )}
                    {sug.applied && (
                      <div className="dp-sug-applied-label">
                        <Check size={12} /> Aplicado
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Panel inline styles */}
        <style>{`
          .director-panel-overlay {
            position: fixed !important;
            inset: 0 !important;
            z-index: 2147483647 !important;
            background: rgba(0,0,0,0.45);
            display: flex;
            justify-content: flex-end;
          }
          .director-panel {
            width: 380px;
            max-width: 90vw;
            height: 100vh;
            background: linear-gradient(180deg, #141418 0%, #0c0c10 100%);
            border-left: 1px solid rgba(249,115,22,0.2);
            display: flex;
            flex-direction: column;
            animation: panelSlideIn 0.22s cubic-bezier(0.16,1,0.3,1);
            overflow: hidden;
          }
          @keyframes panelSlideIn {
            from { transform: translateX(100%); opacity: 0.5; }
            to { transform: translateX(0); opacity: 1; }
          }

          .dp-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 16px 18px;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            background: rgba(249,115,22,0.04);
          }
          .dp-header-info { display: flex; align-items: center; gap: 12px; }
          .dp-avatar {
            width: 36px; height: 36px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid rgba(249,115,22,0.5);
            box-shadow: 0 0 12px rgba(249,115,22,0.2);
          }
          .dp-director-name {
            font-size: 14px; font-weight: 700; color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .dp-director-specialty {
            font-size: 11px; color: rgba(255,255,255,0.45);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .dp-header-actions { display: flex; gap: 6px; }
          .dp-icon-btn {
            width: 30px; height: 30px;
            display: flex; align-items: center; justify-content: center;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            background: rgba(255,255,255,0.04);
            color: rgba(255,255,255,0.6);
            cursor: pointer;
            transition: all 0.12s;
          }
          .dp-icon-btn:hover {
            background: rgba(255,255,255,0.1);
            color: #fff;
          }

          .dp-applied-bar {
            display: flex; align-items: center; gap: 8px;
            padding: 8px 18px;
            background: rgba(249,115,22,0.08);
            border-bottom: 1px solid rgba(249,115,22,0.15);
            font-size: 12px; color: #fb923c;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .dp-revert-btn {
            margin-left: auto;
            display: flex; align-items: center; gap: 4px;
            padding: 3px 8px;
            border-radius: 4px;
            border: 1px solid rgba(239,68,68,0.3);
            background: rgba(239,68,68,0.08);
            color: #f87171;
            font-size: 10px; font-weight: 600;
            cursor: pointer;
            transition: all 0.12s;
          }
          .dp-revert-btn:hover { background: rgba(239,68,68,0.2); }

          .dp-content {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .dp-loading, .dp-error, .dp-empty {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; gap: 12px;
            padding: 40px 20px;
            color: rgba(255,255,255,0.5);
            font-size: 13px; text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .dp-loading svg { color: #f97316; }
          .dp-retry-btn {
            padding: 6px 14px; border-radius: 6px;
            background: rgba(249,115,22,0.15); border: 1px solid rgba(249,115,22,0.3);
            color: #f97316; font-size: 12px; font-weight: 600; cursor: pointer;
          }

          .dp-suggestion {
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 10px;
            background: rgba(255,255,255,0.02);
            overflow: hidden;
            transition: all 0.15s;
          }
          .dp-suggestion:hover { background: rgba(255,255,255,0.04); }
          .dp-suggestion.applied { opacity: 0.6; }

          .dp-sug-header {
            display: flex; align-items: center; gap: 10px;
            padding: 12px 14px;
            cursor: pointer;
          }
          .dp-sug-icon {
            width: 30px; height: 30px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 8px; flex-shrink: 0;
          }
          .dp-sug-info { flex: 1; min-width: 0; }
          .dp-sug-title {
            font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.9);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .dp-sug-meta {
            display: flex; gap: 8px;
            font-size: 10px; color: rgba(255,255,255,0.35);
            margin-top: 2px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .dp-sug-type { text-transform: capitalize; }
          .dp-sug-conf { font-weight: 600; }
          .dp-sug-chevron { color: rgba(255,255,255,0.3); }

          .dp-sug-body {
            padding: 0 14px 14px;
            border-top: 1px solid rgba(255,255,255,0.04);
          }
          .dp-sug-desc {
            font-size: 12px; color: rgba(255,255,255,0.6);
            line-height: 1.5; margin: 10px 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .dp-sug-clip {
            font-size: 10px; color: rgba(255,255,255,0.3);
            margin-bottom: 10px;
            font-family: 'Courier New', monospace;
          }

          .dp-sug-actions {
            display: flex; gap: 8px;
          }
          .dp-apply-btn, .dp-dismiss-btn {
            display: flex; align-items: center; gap: 4px;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 12px; font-weight: 600;
            cursor: pointer;
            transition: all 0.12s;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
          .dp-apply-btn {
            background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3);
            color: #4ade80;
          }
          .dp-apply-btn:hover { background: rgba(34,197,94,0.25); }
          .dp-dismiss-btn {
            background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1);
            color: rgba(255,255,255,0.5);
          }
          .dp-dismiss-btn:hover { background: rgba(255,255,255,0.1); }

          .dp-sug-applied-label {
            display: flex; align-items: center; gap: 4px;
            font-size: 11px; color: #4ade80; font-weight: 600;
            margin-top: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
        `}</style>
      </div>
    </div>,
    document.body
  );
};

export default DirectorSuggestionsPanel;
