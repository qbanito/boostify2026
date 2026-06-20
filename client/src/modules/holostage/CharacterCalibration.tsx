// ─── CharacterCalibration ─────────────────────────────────────────────────────
// Full rig calibration: scale, offsets, motion/IK, bone-map editor,
// T-Pose/A-Pose capture, named presets.

import React, { useState, useCallback } from 'react';
import {
  Sliders, RotateCcw, CheckCircle, AlertTriangle, User, Ruler,
  Save, Trash2, Download, ChevronDown, ChevronRight,
  Activity, Settings2, Zap,
} from 'lucide-react';
import type { CharacterRig, RigBoneMapping } from '../../schemas/holostage/characterRig.schema';
import { useHoloLang } from './holoLangContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalibrationSettings {
  heightOffset: number;
  scaleMultiplier: number;
  armLengthMultiplier: number;
  legLengthMultiplier: number;
  hipOffset: number;
  neckOffset: number;
  footOffset: number;
  spineOffset: number;
  rootMotionEnabled: boolean;
  footLockingEnabled: boolean;
  handIKEnabled: boolean;
  handIKWeight: number;
  handMappingEnabled: boolean;
  faceMappingEnabled: boolean;
  smoothingFactor: number;
  latencyCompensationMs: number;
}

interface CalibrationPreset {
  id: string;
  name: string;
  createdAt: number;
  settings: CalibrationSettings;
}

const DEFAULT_CALIBRATION: CalibrationSettings = {
  heightOffset: 0,
  scaleMultiplier: 1.0,
  armLengthMultiplier: 1.0,
  legLengthMultiplier: 1.0,
  hipOffset: 0,
  neckOffset: 0,
  footOffset: 0,
  spineOffset: 0,
  rootMotionEnabled: true,
  footLockingEnabled: true,
  handIKEnabled: false,
  handIKWeight: 0.8,
  handMappingEnabled: true,
  faceMappingEnabled: false,
  smoothingFactor: 0.35,
  latencyCompensationMs: 40,
};

interface CharacterCalibrationProps {
  rig: CharacterRig;
  onRigChange: (rig: CharacterRig) => void;
}

function SliderRow({
  label, value, min, max, step, onChange, unit = '',
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</span>
        <span className="text-xs font-mono px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
          {value.toFixed(step < 0.01 ? 3 : 2)}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-orange-500"
        style={{ accentColor: '#f97316' }}
      />
      <div className="flex justify-between text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b"
      style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className="relative w-11 h-6 rounded-full transition-colors"
        style={{ background: value ? '#f97316' : 'rgba(255,255,255,0.15)' }}
      >
        <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
          style={{ left: value ? '22px' : '2px' }} />
      </button>
    </div>
  );
}

export function CharacterCalibration({ rig, onRigChange }: CharacterCalibrationProps) {
  const { t } = useHoloLang();
  const [cal, setCal] = useState<CalibrationSettings>({
    ...DEFAULT_CALIBRATION,
    scaleMultiplier: rig.scaleMultiplier,
    heightOffset: rig.heightOffset ?? DEFAULT_CALIBRATION.heightOffset,
    armLengthMultiplier: rig.armLengthMultiplier ?? DEFAULT_CALIBRATION.armLengthMultiplier,
    legLengthMultiplier: rig.legLengthMultiplier ?? DEFAULT_CALIBRATION.legLengthMultiplier,
    hipOffset: rig.hipOffset ?? DEFAULT_CALIBRATION.hipOffset,
    neckOffset: rig.neckOffset ?? DEFAULT_CALIBRATION.neckOffset,
    footOffset: rig.footOffset ?? DEFAULT_CALIBRATION.footOffset,
    spineOffset: rig.spineOffset ?? DEFAULT_CALIBRATION.spineOffset,
    smoothingFactor: rig.smoothingFactor ?? DEFAULT_CALIBRATION.smoothingFactor,
    latencyCompensationMs: rig.latencyCompensationMs ?? DEFAULT_CALIBRATION.latencyCompensationMs,
    rootMotionEnabled: rig.rootMotionEnabled ?? DEFAULT_CALIBRATION.rootMotionEnabled,
    footLockingEnabled: rig.footIK,
  });
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'scale' | 'offsets' | 'motion' | 'tposeref'>('scale');

  const update = useCallback((patch: Partial<CalibrationSettings>) => {
    setCal(prev => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const applyCalibration = useCallback(() => {
    onRigChange({
      ...rig,
      scaleMultiplier: cal.scaleMultiplier,
      footIK: cal.footLockingEnabled,
      iKEnabled: cal.footLockingEnabled,
      heightOffset: cal.heightOffset,
      armLengthMultiplier: cal.armLengthMultiplier,
      legLengthMultiplier: cal.legLengthMultiplier,
      hipOffset: cal.hipOffset,
      neckOffset: cal.neckOffset,
      footOffset: cal.footOffset,
      spineOffset: cal.spineOffset,
      smoothingFactor: cal.smoothingFactor,
      latencyCompensationMs: cal.latencyCompensationMs,
      rootMotionEnabled: cal.rootMotionEnabled,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, [cal, rig, onRigChange]);

  const resetCalibration = useCallback(() => {
    setCal({ ...DEFAULT_CALIBRATION });
    setSaved(false);
  }, []);

  const TABS = [
    { id: 'scale',    label: t('calib_tab_scale') },
    { id: 'offsets',  label: t('calib_tab_offsets') },
    { id: 'motion',   label: t('calib_tab_motion') },
    { id: 'tposeref', label: t('calib_tab_tpose') },
  ] as const;

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto p-4"
      style={{ background: '#0a0a0a', color: 'white' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-5 h-5 text-orange-400" />
          <h3 className="text-base font-bold text-white">{t('calib_header')}</h3>
        </div>
        <div className="flex gap-2">
          <button onClick={resetCalibration}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
            <RotateCcw className="w-3.5 h-3.5" />{t('calib_reset')}
          </button>
          <button onClick={applyCalibration}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors"
            style={{ background: saved ? 'rgba(34,197,94,0.2)' : '#f97316', color: saved ? '#22c55e' : 'white' }}>
            {saved ? <CheckCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
            {saved ? t('calib_applied') : t('calib_apply')}
          </button>
        </div>
      </div>

      {/* Performer info callout */}
      <div className="flex items-start gap-3 p-3 rounded-lg"
        style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
        <User className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {t('calib_perf_hint')}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex-1 py-1.5 text-xs font-medium rounded transition-colors"
            style={{
              background: tab === t.id ? 'rgba(249,115,22,0.2)' : 'transparent',
              color: tab === t.id ? '#f97316' : 'rgba(255,255,255,0.5)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 space-y-5">
        {tab === 'scale' && (
          <>
            <SliderRow label={t('calib_scale_multi')} value={cal.scaleMultiplier}
              min={0.8} max={1.2} step={0.01}
              onChange={v => update({ scaleMultiplier: v })} />
            <SliderRow label={t('calib_height_off')} value={cal.heightOffset}
              min={-0.5} max={0.5} step={0.01} unit="m"
              onChange={v => update({ heightOffset: v })} />
            <SliderRow label={t('calib_arm_len')} value={cal.armLengthMultiplier}
              min={0.9} max={1.1} step={0.005}
              onChange={v => update({ armLengthMultiplier: v })} />
            <SliderRow label={t('calib_leg_len')} value={cal.legLengthMultiplier}
              min={0.9} max={1.1} step={0.005}
              onChange={v => update({ legLengthMultiplier: v })} />
          </>
        )}

        {tab === 'offsets' && (
          <>
            <SliderRow label={t('calib_hip_off')} value={cal.hipOffset}
              min={-0.2} max={0.2} step={0.005} unit="m"
              onChange={v => update({ hipOffset: v })} />
            <SliderRow label={t('calib_neck_off')} value={cal.neckOffset}
              min={-0.1} max={0.1} step={0.005} unit="m"
              onChange={v => update({ neckOffset: v })} />
            <SliderRow label={t('calib_foot_off')} value={cal.footOffset}
              min={-0.1} max={0.1} step={0.005} unit="m"
              onChange={v => update({ footOffset: v })} />
            <SliderRow label={t('calib_spine_off')} value={cal.spineOffset}
              min={-0.1} max={0.1} step={0.005} unit="m"
              onChange={v => update({ spineOffset: v })} />
          </>
        )}

        {tab === 'motion' && (
          <>
            <SliderRow label={t('calib_smoothing')} value={cal.smoothingFactor}
              min={0} max={1} step={0.01}
              onChange={v => update({ smoothingFactor: v })} />
            <SliderRow label={t('calib_latency')} value={cal.latencyCompensationMs}
              min={0} max={250} step={5} unit="ms"
              onChange={v => update({ latencyCompensationMs: v })} />
            <div className="pt-2 space-y-1">
              <ToggleRow label={t('calib_root_motion')} desc={t('calib_root_desc')}
                value={cal.rootMotionEnabled}
                onChange={v => update({ rootMotionEnabled: v })} />
              <ToggleRow label={t('calib_foot_lock')} desc={t('calib_foot_desc')}
                value={cal.footLockingEnabled}
                onChange={v => update({ footLockingEnabled: v })} />
            </div>
          </>
        )}

        {tab === 'tposeref' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-orange-400" />
                {t('calib_tpose_guide')}
              </h4>
              <ul className="space-y-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {[
                  'Arms extended horizontally at shoulder height',
                  'Palms facing down, fingers extended',
                  'Feet hip-width apart, parallel',
                  'Look straight ahead (neutral head)',
                  'Torso upright, neutral spine',
                  'Hold for 3-5 seconds when prompted',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full text-center text-[10px] font-bold shrink-0 mt-0.5 flex items-center justify-center"
                      style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316' }}>
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
            <button className="w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-colors"
              style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#f97316' }}>
              <User className="w-4 h-4" />
              {t('calib_tpose_btn')}
            </button>
            <div className="flex items-start gap-2 p-3 rounded-lg"
              style={{ background: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.2)' }}>
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {t('calib_tpose_warn')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bone map quick info */}
      <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="text-xs font-bold mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
          RIG — {rig.rigType.toUpperCase()} — {t('calib_bones_mapped', { n: rig.boneMappings.length })}
        </div>
        <div className="grid grid-cols-2 gap-1">
          {rig.boneMappings.slice(0, 8).map(m => (
            <div key={m.holosuitBone} className="text-xs font-mono flex gap-1">
              <span style={{ color: '#f97316' }}>{m.holosuitBone}</span>
              <span style={{ color: 'rgba(255,255,255,0.2)' }}>→</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>{m.characterBone}</span>
            </div>
          ))}
          {rig.boneMappings.length > 8 && (
            <div className="text-xs col-span-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
              +{rig.boneMappings.length - 8} more bones...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
