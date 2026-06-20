// ─── CharacterPreview ─────────────────────────────────────────────────────────
// Shows the loaded character with optimization analysis and rig info.

import React, { useState } from 'react';
import { Box, Cpu, Zap, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { CharacterAsset } from '../../schemas/holostage/character.schema';
import { useHoloLang } from './holoLangContext';
import {
  analyzeCharacter,
  getReadinessLabel,
} from '../../services/holostage/characterOptimizationEngine';
import { formatFileSize } from '../../services/holostage/characterCreatorImporter';

interface CharacterPreviewProps {
  character: CharacterAsset;
  onAnimationChange?: (anim: string) => void;
  onTransformChange?: (transform: CharacterAsset['transform']) => void;
}

export function CharacterPreview({ character, onAnimationChange, onTransformChange }: CharacterPreviewProps) {
  const { t } = useHoloLang();
  const [expandedSection, setExpandedSection] = useState<string | null>('analysis');
  const report = analyzeCharacter(character);
  const readiness = getReadinessLabel(report.score);

  const toggleSection = (s: string) => setExpandedSection(prev => prev === s ? null : s);

  const SectionHeader = ({ id, label }: { id: string; label: string }) => (
    <button
      onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between py-2 text-xs font-bold tracking-widest uppercase transition-colors"
      style={{ color: expandedSection === id ? '#f97316' : 'rgba(255,255,255,0.4)' }}
    >
      {label}
      {expandedSection === id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* Character header */}
      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(249,115,22,0.15)' }}>
          <Box className="w-5 h-5 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{character.name}</p>
          <p className="text-xs text-gray-500 capitalize">{character.source} · {character.rigType}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold" style={{ color: readiness.color }}>{report.score}</p>
          <p className="text-xs" style={{ color: readiness.color }}>{readiness.label}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t('preview_polygons'), value: report.polyCount > 0 ? report.polyCount.toLocaleString() : 'N/A' },
          { label: t('preview_textures'), value: report.textureCount > 0 ? String(report.textureCount) : 'N/A' },
          { label: 'VRAM Est.', value: report.estimatedVRAM > 0 ? `${report.estimatedVRAM.toFixed(0)}MB` : 'N/A' },
        ].map(stat => (
          <div key={stat.label} className="p-2 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-bold text-white">{stat.value}</p>
            <p className="text-xs text-gray-600">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Analysis section */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <SectionHeader id="analysis" label={t('preview_analysis')} />
        {expandedSection === 'analysis' && (
          <div className="pb-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">{t('preview_lod')}</span>
              <span className="font-bold text-white uppercase">{report.recommendedLOD}</span>
            </div>
            {report.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">{w}</p>
              </div>
            ))}
            {report.suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Zap className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-xs text-gray-400">{s}</p>
              </div>
            ))}
            {report.warnings.length === 0 && report.suggestions.length === 0 && (
              <div className="flex items-center gap-2 p-2 rounded" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-400">{t('preview_optimized')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rig info section */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <SectionHeader id="rig" label={t('preview_rig_info')} />
        {expandedSection === 'rig' && (
          <div className="pb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-gray-600">{t('preview_rig_type')}</p>
                <p className="text-white font-medium capitalize">{character.rigType}</p>
              </div>
              <div className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-gray-600">{t('preview_idle_anim')}</p>
                <p className="text-white font-medium">{character.idleAnimation}</p>
              </div>
              <div className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-gray-600">{t('preview_blendshapes')}</p>
                <p className="text-white font-medium">{character.blendshapes?.length ?? 0}</p>
              </div>
              <div className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-gray-600">{t('preview_animations')}</p>
                <p className="text-white font-medium">{character.availableAnimations.length}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transform section */}
      <div>
        <SectionHeader id="transform" label="Transform" />
        {expandedSection === 'transform' && (
          <div className="pb-3 space-y-2">
            {(['position', 'rotation'] as const).map(field => (
              <div key={field}>
                <p className="text-xs text-gray-600 mb-1 capitalize">{field}</p>
                <div className="grid grid-cols-3 gap-1">
                  {(['x', 'y', 'z'] as const).map(axis => (
                    <div key={axis} className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: axis === 'x' ? '#ef4444' : axis === 'y' ? '#22c55e' : '#3b82f6' }}>
                        {axis.toUpperCase()}
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        value={character.transform[field][axis]}
                        onChange={e => {
                          if (!onTransformChange) return;
                          onTransformChange({
                            ...character.transform,
                            [field]: { ...character.transform[field], [axis]: parseFloat(e.target.value) || 0 },
                          });
                        }}
                        className="w-full bg-black/40 border rounded pl-6 pr-2 py-1 text-xs text-white outline-none focus:border-orange-500"
                        style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <p className="text-xs text-gray-600 mb-1">Scale</p>
              <input
                type="range" min="0.1" max="3" step="0.05"
                value={character.transform.scale}
                onChange={e => onTransformChange?.({ ...character.transform, scale: parseFloat(e.target.value) })}
                className="w-full accent-orange-400"
              />
              <p className="text-xs text-right text-gray-500 mt-1">{character.transform.scale.toFixed(2)}x</p>
            </div>
          </div>
        )}
      </div>

      {/* File info */}
      {character.fileSize && (
        <p className="text-xs text-gray-700 text-center">
          {formatFileSize(character.fileSize)} · importado {new Date(character.importedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
