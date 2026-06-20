// ─── HoloStageGuide ───────────────────────────────────────────────────────────
// Full-screen overlay documenting every HoloStage module.
// Fully bilingual (EN/ES) via holoLangContext.

import React, { useState } from 'react';
import {
  X, Building2, User, Users, Camera, Activity, Radio, Sliders,
  Music, List, Film, Lightbulb, Monitor, Scan, GitBranch, PlayCircle, Package,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useHoloLang } from './holoLangContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModuleDoc {
  id:         string;
  icon:       React.ElementType;
  nameKey:    string;
  phase:      string;
  phaseColor: string;
  taglineKey: string;
  descKey:    string;
  actionKeys: string[];
  tipKeys?:   string[];
}

// ─── Phase definitions ────────────────────────────────────────────────────────

const PHASES = [
  { id: 'p1', color: '#3b82f6', labelKey: 'guide_phase1' },
  { id: 'p2', color: '#a855f7', labelKey: 'guide_phase2' },
  { id: 'p3', color: '#f59e0b', labelKey: 'guide_phase3' },
  { id: 'p4', color: '#22c55e', labelKey: 'guide_phase4' },
] as const;

// ─── Module catalogue ─────────────────────────────────────────────────────────

const MODULES: ModuleDoc[] = [
  // ── Phase 1 ─────────────────────────────────────────────────────────────
  {
    id: 'venue', icon: Building2, nameKey: 'nav_venue',
    phase: 'p1', phaseColor: '#3b82f6',
    taglineKey: 'guide_venue_tagline', descKey: 'guide_venue_desc',
    actionKeys: ['guide_venue_a1','guide_venue_a2','guide_venue_a3','guide_venue_a4',
                 'guide_venue_a5','guide_venue_a6','guide_venue_a7','guide_venue_a8','guide_venue_a9'],
    tipKeys: ['guide_venue_t1','guide_venue_t2','guide_venue_t3'],
  },
  {
    id: 'character', icon: User, nameKey: 'nav_character',
    phase: 'p1', phaseColor: '#3b82f6',
    taglineKey: 'guide_char_tagline', descKey: 'guide_char_desc',
    actionKeys: ['guide_char_a1','guide_char_a2','guide_char_a3','guide_char_a4'],
    tipKeys: ['guide_char_t1','guide_char_t2'],
  },
  {
    id: 'actors', icon: Users, nameKey: 'nav_actors',
    phase: 'p1', phaseColor: '#3b82f6',
    taglineKey: 'guide_actors_tagline', descKey: 'guide_actors_desc',
    actionKeys: ['guide_actors_a1','guide_actors_a2','guide_actors_a3'],
  },
  // ── Phase 2 ─────────────────────────────────────────────────────────────
  {
    id: 'capture', icon: Camera, nameKey: 'nav_capture',
    phase: 'p2', phaseColor: '#a855f7',
    taglineKey: 'guide_capture_tagline', descKey: 'guide_capture_desc',
    actionKeys: ['guide_capture_a1','guide_capture_a2','guide_capture_a3','guide_capture_a4'],
    tipKeys: ['guide_capture_t1','guide_capture_t2'],
  },
  {
    id: 'holosuit', icon: Activity, nameKey: 'nav_mocap',
    phase: 'p2', phaseColor: '#a855f7',
    taglineKey: 'guide_holosuit_tagline', descKey: 'guide_holosuit_desc',
    actionKeys: ['guide_holosuit_a1','guide_holosuit_a2','guide_holosuit_a3','guide_holosuit_a4'],
    tipKeys: ['guide_holosuit_t1','guide_holosuit_t2'],
  },
  {
    id: 'motionsource', icon: Radio, nameKey: 'nav_mocap_pro',
    phase: 'p2', phaseColor: '#a855f7',
    taglineKey: 'guide_motion_tagline', descKey: 'guide_motion_desc',
    actionKeys: ['guide_motion_a1','guide_motion_a2','guide_motion_a3','guide_motion_a4'],
  },
  {
    id: 'calibration', icon: Sliders, nameKey: 'nav_calibrate',
    phase: 'p2', phaseColor: '#a855f7',
    taglineKey: 'guide_calib_tagline', descKey: 'guide_calib_desc',
    actionKeys: ['guide_calib_a1','guide_calib_a2','guide_calib_a3','guide_calib_a4'],
    tipKeys: ['guide_calib_t1'],
  },
  // ── Phase 3 ─────────────────────────────────────────────────────────────
  {
    id: 'repertoire', icon: Music, nameKey: 'nav_repertoire',
    phase: 'p3', phaseColor: '#f59e0b',
    taglineKey: 'guide_rep_tagline', descKey: 'guide_rep_desc',
    actionKeys: ['guide_rep_a1','guide_rep_a2','guide_rep_a3','guide_rep_a4','guide_rep_a5'],
    tipKeys: ['guide_rep_t1','guide_rep_t2'],
  },
  {
    id: 'timeline', icon: List, nameKey: 'nav_timeline',
    phase: 'p3', phaseColor: '#f59e0b',
    taglineKey: 'guide_tl_tagline', descKey: 'guide_tl_desc',
    actionKeys: ['guide_tl_a1','guide_tl_a2','guide_tl_a3','guide_tl_a4','guide_tl_a5'],
    tipKeys: ['guide_tl_t1','guide_tl_t2','guide_tl_t3'],
  },
  {
    id: 'animation', icon: Film, nameKey: 'nav_animation',
    phase: 'p3', phaseColor: '#f59e0b',
    taglineKey: 'guide_anim_tagline', descKey: 'guide_anim_desc',
    actionKeys: ['guide_anim_a1','guide_anim_a2','guide_anim_a3','guide_anim_a4'],
    tipKeys: ['guide_anim_t1'],
  },
  {
    id: 'dmx', icon: Lightbulb, nameKey: 'nav_lighting',
    phase: 'p3', phaseColor: '#f59e0b',
    taglineKey: 'guide_dmx_tagline', descKey: 'guide_dmx_desc',
    actionKeys: ['guide_dmx_a1','guide_dmx_a2','guide_dmx_a3','guide_dmx_a4'],
    tipKeys: ['guide_dmx_t1'],
  },
  // ── Phase 4 ─────────────────────────────────────────────────────────────
  {
    id: 'output', icon: Monitor, nameKey: 'nav_output',
    phase: 'p4', phaseColor: '#22c55e',
    taglineKey: 'guide_output_tagline', descKey: 'guide_output_desc',
    actionKeys: ['guide_output_a1','guide_output_a2','guide_output_a3','guide_output_a4'],
  },
  {
    id: 'vrspace', icon: Scan, nameKey: 'nav_vrspace',
    phase: 'p4', phaseColor: '#22c55e',
    taglineKey: 'guide_vr_tagline', descKey: 'guide_vr_desc',
    actionKeys: ['guide_vr_a1','guide_vr_a2','guide_vr_a3'],
  },
  {
    id: 'workflow', icon: GitBranch, nameKey: 'nav_pipeline',
    phase: 'p4', phaseColor: '#22c55e',
    taglineKey: 'guide_wf_tagline', descKey: 'guide_wf_desc',
    actionKeys: ['guide_wf_a1','guide_wf_a2','guide_wf_a3'],
    tipKeys: ['guide_wf_t1'],
  },
  {
    id: 'live', icon: PlayCircle, nameKey: 'nav_live',
    phase: 'p4', phaseColor: '#22c55e',
    taglineKey: 'guide_live_tagline', descKey: 'guide_live_desc',
    actionKeys: ['guide_live_a1','guide_live_a2','guide_live_a3','guide_live_a4','guide_live_a5'],
    tipKeys: ['guide_live_t1','guide_live_t2'],
  },
  {
    id: 'export', icon: Package, nameKey: 'nav_export',
    phase: 'p4', phaseColor: '#22c55e',
    taglineKey: 'guide_export_tagline', descKey: 'guide_export_desc',
    actionKeys: ['guide_export_a1','guide_export_a2','guide_export_a3','guide_export_a4'],
    tipKeys: ['guide_export_t1'],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface HoloStageGuideProps {
  onClose: () => void;
}

export function HoloStageGuide({ onClose }: HoloStageGuideProps) {
  const { t } = useHoloLang();
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const filtered  = activePhase ? MODULES.filter(m => m.phase === activePhase) : MODULES;
  const subtitle  = t('guide_subtitle' as Parameters<typeof t>[0]).replace('{n}', String(MODULES.length));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
    >
      <div
        className="relative w-full max-w-4xl my-8 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(249,115,22,0.05)' }}
        >
          <div>
            <h1 className="text-lg font-black tracking-widest uppercase text-white">
              BOOSTIFY · HoloStage{' '}
              <span className="text-orange-400">{t('guide_title' as Parameters<typeof t>[0])}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all hover:bg-white/10 text-gray-500 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Phase filter pills ── */}
        <div
          className="flex gap-2 px-6 py-3 border-b overflow-x-auto"
          style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#080808' }}
        >
          <button
            onClick={() => setActivePhase(null)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
            style={{
              background: activePhase === null ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.05)',
              color:      activePhase === null ? '#f97316' : '#6b7280',
              border:    `1px solid ${activePhase === null ? 'rgba(249,115,22,0.35)' : 'transparent'}`,
            }}
          >
            {t('guide_filter_all' as Parameters<typeof t>[0])}
          </button>
          {PHASES.map(p => {
            const active = activePhase === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePhase(prev => prev === p.id ? null : p.id)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                style={{
                  background: active ? `${p.color}22` : 'rgba(255,255,255,0.05)',
                  color:      active ? p.color : '#6b7280',
                  border:    `1px solid ${active ? `${p.color}55` : 'transparent'}`,
                }}
              >
                {t(p.labelKey as Parameters<typeof t>[0])}
              </button>
            );
          })}
        </div>

        {/* ── Module list ── */}
        <div className="px-6 py-4 space-y-2">
          {filtered.map(mod => {
            const Icon  = mod.icon;
            const open  = expanded.has(mod.id);
            const phase = PHASES.find(p => p.id === mod.phase)!;
            const phaseFull  = t(phase.labelKey as Parameters<typeof t>[0]);
            const phaseShort = phaseFull.includes('—') ? phaseFull.split('—')[1].trim() : phaseFull;

            return (
              <div
                key={mod.id}
                className="rounded-xl overflow-hidden border transition-all"
                style={{
                  borderColor: open ? `${mod.phaseColor}33` : 'rgba(255,255,255,0.07)',
                  background:  open ? `${mod.phaseColor}08` : 'rgba(255,255,255,0.02)',
                }}
              >
                {/* Row */}
                <button
                  onClick={() => toggle(mod.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-white/5"
                >
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                    style={{ background: `${mod.phaseColor}20`, color: mod.phaseColor }}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">
                        {t(mod.nameKey as Parameters<typeof t>[0])}
                      </span>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: `${mod.phaseColor}18`, color: mod.phaseColor }}
                      >
                        {phaseShort}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {t(mod.taglineKey as Parameters<typeof t>[0])}
                    </p>
                  </div>
                  <div className="text-gray-600 shrink-0">
                    {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </div>
                </button>

                {/* Expanded */}
                {open && (
                  <div className="px-4 pb-4 space-y-4 border-t" style={{ borderColor: `${mod.phaseColor}18` }}>
                    <p className="text-sm text-gray-300 leading-relaxed pt-3">
                      {t(mod.descKey as Parameters<typeof t>[0])}
                    </p>

                    {/* Key Actions */}
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: mod.phaseColor }}>
                        {t('guide_key_actions' as Parameters<typeof t>[0])}
                      </p>
                      <div className="space-y-1.5">
                        {mod.actionKeys.map((key, i) => (
                          <div key={key} className="flex items-start gap-2">
                            <div
                              className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5"
                              style={{ background: `${mod.phaseColor}20`, color: mod.phaseColor }}
                            >
                              {i + 1}
                            </div>
                            <p className="text-xs text-gray-400 leading-relaxed">
                              {t(key as Parameters<typeof t>[0])}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tips */}
                    {mod.tipKeys && mod.tipKeys.length > 0 && (
                      <div
                        className="rounded-lg p-3 space-y-1.5"
                        style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}
                      >
                        <p className="text-[10px] font-black uppercase tracking-widest text-orange-400 mb-2">
                          💡 {t('guide_tips' as Parameters<typeof t>[0])}
                        </p>
                        {mod.tipKeys.map(key => (
                          <p key={key} className="text-xs text-orange-200/70 leading-relaxed">
                            • {t(key as Parameters<typeof t>[0])}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div
          className="px-6 py-4 border-t flex items-center justify-between"
          style={{ borderColor: 'rgba(255,255,255,0.07)', background: '#080808' }}
        >
          <div className="flex gap-4 flex-wrap">
            {PHASES.map(p => {
              const count = MODULES.filter(m => m.phase === p.id).length;
              return (
                <div key={p.id} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                  <span className="text-[10px] text-gray-600">
                    {count} {t('guide_modules_label' as Parameters<typeof t>[0])}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105"
            style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}
          >
            {t('guide_close' as Parameters<typeof t>[0])}
          </button>
        </div>
      </div>
    </div>
  );
}
