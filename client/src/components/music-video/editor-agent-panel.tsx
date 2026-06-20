/**
 * Editor Agent Panel — AI-powered timeline editing recommendations
 * Fully responsive: PC + Mobile. Dark theme integrated.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Wand2,
  Loader2,
  AlertCircle,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  Film,
  Music,
  Sparkles,
  Clock,
  Target,
} from "lucide-react";
import { logger } from "@/lib/logger";
import {
  generateTimelineEditPlan,
  type TimelineEditPlan,
} from "@/lib/api/timeline-editor-agent";
import type { TimelineItem } from "@/components/timeline/TimelineClipUnified";

interface EditorAgentPanelProps {
  timeline: TimelineItem[];
  audioBuffer?: AudioBuffer;
  genreHint?: string;
  onApplySuggestions?: (plan: TimelineEditPlan) => void;
}

export const EditorAgentPanel: React.FC<EditorAgentPanelProps> = ({
  timeline,
  audioBuffer,
  genreHint,
  onApplySuggestions,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editPlan, setEditPlan] = useState<TimelineEditPlan | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(
    new Set()
  );
  const [error, setError] = useState<string | null>(null);
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(
    null
  );
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Prevent body scroll on mobile when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) setIsOpen(false);
    },
    []
  );

  const handleAnalyzeTimeline = async () => {
    if (timeline.length === 0) {
      setError("Timeline vacío. Agrega clips antes de analizar.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logger.info("🎬 [UI] Generando plan de edición...");
      const plan = await generateTimelineEditPlan(
        timeline,
        audioBuffer,
        genreHint
      );
      setEditPlan(plan);

      const allIds = new Set(
        plan.suggestions.map((_, i) => `suggestion-${i}`)
      );
      setSelectedSuggestions(allIds);

      logger.info(
        `✅ [UI] Plan generado: ${plan.suggestions.length} sugerencias`
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      logger.error("❌ [UI] Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSuggestion = (idx: number) => {
    const newSet = new Set(selectedSuggestions);
    const id = `suggestion-${idx}`;
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedSuggestions(newSet);
  };

  const toggleAllSuggestions = () => {
    if (!editPlan) return;
    if (selectedSuggestions.size === editPlan.suggestions.length) {
      setSelectedSuggestions(new Set());
    } else {
      setSelectedSuggestions(
        new Set(editPlan.suggestions.map((_, i) => `suggestion-${i}`))
      );
    }
  };

  const handleApplyChanges = () => {
    if (editPlan && onApplySuggestions) {
      const selectedPlan = {
        ...editPlan,
        suggestions: editPlan.suggestions.filter((_, i) =>
          selectedSuggestions.has(`suggestion-${i}`)
        ),
      };
      onApplySuggestions(selectedPlan);
      setIsOpen(false);
      logger.info(
        `✅ [UI] Aplicadas ${selectedPlan.suggestions.length} sugerencias`
      );
    }
  };

  const handleReset = () => {
    setEditPlan(null);
    setSelectedSuggestions(new Set());
    setError(null);
    setExpandedSuggestion(null);
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-400";
    if (score >= 0.6) return "text-yellow-400";
    return "text-orange-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.6) return "bg-yellow-500";
    return "bg-orange-500";
  };

  const getPaceIcon = (pace: string) => {
    switch (pace) {
      case "ultra-fast":
        return <Zap size={12} className="text-red-400" />;
      case "fast":
        return <Zap size={12} className="text-orange-400" />;
      case "slow":
        return <Clock size={12} className="text-blue-400" />;
      default:
        return <Music size={12} className="text-purple-400" />;
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="h-6 px-2 gap-1 text-[10px] bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 border-0 shadow-lg shadow-orange-500/20"
        variant="default"
        size="sm"
        title="AI Editor Agent"
      >
        <Wand2 className="w-3 h-3" />
        <span className="hidden sm:inline">AI Agent</span>
      </Button>

      {/* Full-screen overlay + Panel */}
      {isOpen && (
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px",
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          {/* Panel */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              width: "100%",
              maxWidth: "min(95vw, 42rem)",
              maxHeight: "calc(100vh - 16px)",
              backgroundColor: "#171717",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                background: "linear-gradient(90deg, #171717, #262626, #171717)",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "linear-gradient(135deg, #f97316, #f59e0b)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Wand2 size={16} className="text-white" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h2
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "#fff",
                      margin: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    AI Editor Agent
                  </h2>
                  <p
                    style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.5)",
                      margin: 0,
                    }}
                  >
                    Análisis inteligente del timeline
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  padding: 6,
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.1)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
                title="Cerrar"
              >
                <X size={16} color="rgba(255,255,255,0.6)" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                overscrollBehavior: "contain",
                padding: "12px",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {!editPlan ? (
                /* ====================== ANALYZE VIEW ====================== */
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Status Card */}
                  <div
                    style={{
                      borderRadius: 8,
                      background: "rgba(38,38,38,0.8)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      padding: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <Film size={14} className="text-orange-400" />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#fff",
                        }}
                      >
                        Estado del Timeline
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          background: "rgba(64,64,64,0.5)",
                          borderRadius: 8,
                          padding: 10,
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: "#fff",
                          }}
                        >
                          {timeline.length}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.5)",
                          }}
                        >
                          Clips
                        </div>
                      </div>
                      <div
                        style={{
                          background: "rgba(64,64,64,0.5)",
                          borderRadius: 8,
                          padding: 10,
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: "#f97316",
                          }}
                        >
                          {timeline.length > 0
                            ? `${timeline
                                .reduce(
                                  (sum, t) => sum + (t.duration || 0),
                                  0
                                )
                                .toFixed(1)}s`
                            : "0s"}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.5)",
                          }}
                        >
                          Duración
                        </div>
                      </div>
                      <div
                        style={{
                          background: "rgba(64,64,64,0.5)",
                          borderRadius: 8,
                          padding: 10,
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: "#f59e0b",
                          }}
                        >
                          {audioBuffer ? "✓" : "—"}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.5)",
                          }}
                        >
                          Audio
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div
                    style={{
                      borderRadius: 8,
                      background:
                        "linear-gradient(135deg, rgba(249,115,22,0.08), rgba(245,158,11,0.04))",
                      border: "1px solid rgba(249,115,22,0.2)",
                      padding: "12px",
                    }}
                  >
                    <div style={{ display: "flex", gap: 8 }}>
                      <Sparkles
                        size={14}
                        className="text-orange-400"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <div>
                        <p
                          style={{
                            fontSize: 12,
                            color: "rgba(255,255,255,0.8)",
                            lineHeight: 1.6,
                            margin: 0,
                          }}
                        >
                          El AI Editor Agent analizará tu timeline, detectará el
                          género musical y ritmo, y recomendará cambios de
                          edición profesionales basados en editores legendarios
                          como Hype Williams, Dave Meyers y Cole Bennett.
                        </p>
                        {genreHint && (
                          <Badge
                            variant="outline"
                            className="mt-2 text-[10px] px-2 py-0.5 border-orange-500/30 text-orange-400 bg-orange-500/10"
                          >
                            <Music size={10} className="mr-1" />
                            {genreHint}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Analyze Button */}
                  <Button
                    onClick={handleAnalyzeTimeline}
                    disabled={isLoading || timeline.length === 0}
                    className="w-full gap-2 h-11 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-sm border-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analizando timeline...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Analizar Timeline
                      </>
                    )}
                  </Button>

                  {/* Error */}
                  {error && (
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        padding: 12,
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        borderRadius: 8,
                      }}
                    >
                      <AlertCircle
                        size={16}
                        className="text-red-400"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      />
                      <p
                        style={{
                          fontSize: 12,
                          color: "#fca5a5",
                          margin: 0,
                        }}
                      >
                        {error}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* ====================== RESULTS VIEW ====================== */
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Editor Profile Card */}
                  <div
                    style={{
                      borderRadius: 8,
                      background:
                        "linear-gradient(135deg, #262626, rgba(38,38,38,0.5))",
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "12px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background:
                            "linear-gradient(135deg, #f97316, #d97706)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Film size={20} className="text-white" />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <h3
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: "#fff",
                              margin: 0,
                            }}
                          >
                            {editPlan.editor.name}
                          </h3>
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 border-orange-500/30 text-orange-400 bg-orange-500/10"
                          >
                            {getPaceIcon(
                              editPlan.editor.signature_style.pace
                            )}
                            <span className="ml-1 capitalize">
                              {editPlan.editor.signature_style.pace}
                            </span>
                          </Badge>
                        </div>
                        <p
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.5)",
                            marginTop: 4,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {editPlan.editor.signature_style.description}
                        </p>
                        <p
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.4)",
                            marginTop: 4,
                          }}
                        >
                          Técnica:{" "}
                          <span style={{ color: "rgba(255,255,255,0.6)" }}>
                            {
                              editPlan.editor.signature_style
                                .dominant_technique
                            }
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Scores Row */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    {/* Confidence */}
                    <div
                      style={{
                        borderRadius: 8,
                        background: "rgba(38,38,38,0.6)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.5)",
                            fontWeight: 500,
                          }}
                        >
                          Confianza
                        </span>
                        <span
                          className={getScoreColor(
                            editPlan.confidence_score
                          )}
                          style={{ fontSize: 13, fontWeight: 700 }}
                        >
                          {(editPlan.confidence_score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          background: "#404040",
                          borderRadius: 99,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          className={getScoreBg(
                            editPlan.confidence_score
                          )}
                          style={{
                            height: "100%",
                            borderRadius: 99,
                            width: `${
                              editPlan.confidence_score * 100
                            }%`,
                            transition: "width 0.5s ease",
                          }}
                        />
                      </div>
                    </div>

                    {/* Suggestion count */}
                    <div
                      style={{
                        borderRadius: 8,
                        background: "rgba(38,38,38,0.6)",
                        border: "1px solid rgba(255,255,255,0.05)",
                        padding: "10px 12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.5)",
                            fontWeight: 500,
                          }}
                        >
                          Sugerencias
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: "#f97316",
                          }}
                        >
                          {editPlan.suggestions.length}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Target
                          size={10}
                          color="rgba(255,255,255,0.3)"
                        />
                        <span
                          style={{
                            fontSize: 10,
                            color: "rgba(255,255,255,0.4)",
                          }}
                        >
                          {selectedSuggestions.size} seleccionadas
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Approach & Impact */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 8,
                        background: "rgba(59,130,246,0.06)",
                        border: "1px solid rgba(59,130,246,0.12)",
                        padding: "10px 12px",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#60a5fa",
                          marginBottom: 4,
                        }}
                      >
                        Enfoque de Edición
                      </h4>
                      <p
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.6)",
                          lineHeight: 1.5,
                          margin: 0,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {editPlan.overall_approach}
                      </p>
                    </div>
                    <div
                      style={{
                        borderRadius: 8,
                        background: "rgba(34,197,94,0.06)",
                        border: "1px solid rgba(34,197,94,0.12)",
                        padding: "10px 12px",
                      }}
                    >
                      <h4
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#4ade80",
                          marginBottom: 4,
                        }}
                      >
                        Impacto Esperado
                      </h4>
                      <p
                        style={{
                          fontSize: 11,
                          color: "rgba(255,255,255,0.6)",
                          lineHeight: 1.5,
                          margin: 0,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {editPlan.expected_impact}
                      </p>
                    </div>
                  </div>

                  {/* Suggestions List */}
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <h4
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#fff",
                          margin: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Sparkles size={12} className="text-orange-400" />
                        Sugerencias de Edición
                      </h4>
                      <button
                        onClick={toggleAllSuggestions}
                        style={{
                          fontSize: 10,
                          color: "#f97316",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px 8px",
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "rgba(249,115,22,0.1)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "none")
                        }
                      >
                        {selectedSuggestions.size ===
                        editPlan.suggestions.length
                          ? "Deseleccionar todo"
                          : "Seleccionar todo"}
                      </button>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        maxHeight: "clamp(140px, 30vh, 260px)",
                        overflowY: "auto",
                        overscrollBehavior: "contain",
                        paddingRight: 4,
                        WebkitOverflowScrolling: "touch",
                      }}
                    >
                      {editPlan.suggestions.map((suggestion, idx) => {
                        const isSelected = selectedSuggestions.has(
                          `suggestion-${idx}`
                        );
                        const isExpanded = expandedSuggestion === idx;

                        return (
                          <div
                            key={idx}
                            style={{
                              borderRadius: 8,
                              border: isSelected
                                ? "1px solid rgba(249,115,22,0.3)"
                                : "1px solid rgba(255,255,255,0.05)",
                              background: isSelected
                                ? "rgba(249,115,22,0.08)"
                                : "rgba(38,38,38,0.4)",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {/* Suggestion Header */}
                            <div
                              onClick={() => toggleSuggestion(idx)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "10px 12px",
                              }}
                            >
                              {/* Checkbox */}
                              <div
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: 4,
                                  border: isSelected
                                    ? "2px solid #f97316"
                                    : "2px solid rgba(255,255,255,0.3)",
                                  background: isSelected
                                    ? "#f97316"
                                    : "transparent",
                                  flexShrink: 0,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {isSelected && (
                                  <CheckCircle2
                                    size={10}
                                    className="text-white"
                                  />
                                )}
                              </div>

                              {/* Content */}
                              <div
                                style={{
                                  flex: 1,
                                  minWidth: 0,
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontWeight: 600,
                                      color: "#fff",
                                    }}
                                  >
                                    Escena {idx + 1}
                                  </span>
                                  {suggestion.micro_edits.length > 0 && (
                                    <Badge
                                      variant="outline"
                                      className="text-[8px] px-1 py-0 border-purple-500/30 text-purple-400 bg-purple-500/10"
                                    >
                                      {suggestion.micro_edits.length} micro
                                    </Badge>
                                  )}
                                  <span
                                    className={getScoreColor(
                                      suggestion.confidence
                                    )}
                                    style={{
                                      fontSize: 9,
                                      marginLeft: "auto",
                                    }}
                                  >
                                    {(
                                      suggestion.confidence * 100
                                    ).toFixed(0)}
                                    %
                                  </span>
                                </div>
                                <p
                                  style={{
                                    fontSize: 10,
                                    color: "rgba(255,255,255,0.5)",
                                    marginTop: 2,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    margin: "2px 0 0 0",
                                  }}
                                >
                                  {suggestion.reason}
                                </p>
                              </div>

                              {/* Expand toggle */}
                              {suggestion.micro_edits.length > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedSuggestion(
                                      isExpanded ? null : idx
                                    );
                                  }}
                                  style={{
                                    padding: 4,
                                    borderRadius: 4,
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    flexShrink: 0,
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                >
                                  {isExpanded ? (
                                    <ChevronUp
                                      size={12}
                                      color="rgba(255,255,255,0.4)"
                                    />
                                  ) : (
                                    <ChevronDown
                                      size={12}
                                      color="rgba(255,255,255,0.4)"
                                    />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Expanded micro-edits */}
                            {isExpanded &&
                              suggestion.micro_edits.length > 0 && (
                                <div
                                  style={{
                                    padding: "0 12px 10px 40px",
                                    borderTop:
                                      "1px solid rgba(255,255,255,0.05)",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: 4,
                                      paddingTop: 8,
                                    }}
                                  >
                                    {suggestion.micro_edits.map(
                                      (edit, editIdx) => (
                                        <div
                                          key={editIdx}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            fontSize: 10,
                                            color:
                                              "rgba(255,255,255,0.4)",
                                          }}
                                        >
                                          <div
                                            style={{
                                              width: 5,
                                              height: 5,
                                              borderRadius: "50%",
                                              background: "#a855f7",
                                              flexShrink: 0,
                                            }}
                                          />
                                          <span
                                            style={{
                                              color: "#c084fc",
                                              textTransform: "capitalize",
                                            }}
                                          >
                                            {edit.type.replace(
                                              /_/g,
                                              " "
                                            )}
                                          </span>
                                          <span
                                            style={{
                                              color:
                                                "rgba(255,255,255,0.3)",
                                            }}
                                          >
                                            @{" "}
                                            {edit.timestamp.toFixed(2)}s
                                          </span>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {editPlan && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  padding: "12px 12px",
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  background: "#171717",
                  flexShrink: 0,
                }}
              >
                <Button
                  onClick={handleApplyChanges}
                  disabled={selectedSuggestions.size === 0}
                  className="flex-1 gap-1.5 h-10 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-xs sm:text-sm border-0 disabled:opacity-40"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Aplicar ({selectedSuggestions.size})
                </Button>
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="h-10 px-3 sm:px-4 border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs sm:text-sm"
                >
                  Nuevo
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
