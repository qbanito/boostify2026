// ─── WorkflowPipelinePanel ────────────────────────────────────────────────────
// Complete redesign — HoloSuit → CC4 → iClone → Boostify pipeline
// Fully wired to: cc4WorkflowBridge, holosuitBridge, showTimelineEngine
// Sections: Pipeline | Bone Map | Recordings | Config

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, CheckCircle, Circle, AlertCircle, Play, Square, Zap,
  Settings, ChevronDown, ChevronRight, Music, User, Sliders,
  GitBranch, ArrowRight, Download, RefreshCw, Search, Filter,
  Cpu, Wifi, Database, Terminal, Radio, Eye, BarChart3,
  Layers, ToggleLeft, ToggleRight, ChevronUp, Info, X,
} from 'lucide-react';

import {
  cc4WorkflowBridge,
  CC4_CHARACTER_TEMPLATES,
  buildWorkflowSteps,
  DEFAULT_WORKFLOW_CONFIG,
  type CC4WorkflowConfig,
  type WorkflowStep,
  type CC4TemplateName,
  type CC4Pose,
} from '../../services/holostage/cc4WorkflowBridge';

import { ICLONE_MOTION_MASKS } from '../../services/holostage/cc4BoneMapping';

import {
  HOLOSUIT_RECORDING_CATALOG,
  type HoloSuitRecordingInfo,
} from '../../services/holostage/holosuitRecordingParser';

import {
  CC4_BODY_MAPPING,
  CC4_ALL_BONES,
  type CC4MotionPart,
} from '../../services/holostage/cc4BoneMapping';

import {
  HOLOSUIT_STREAMING_DEFAULTS,
  HOLOSUIT_DEFAULT_RECORDINGS,
} from '../../services/holostage/holosuitStreamingProtocol';

import { holosuitBridge } from '../../services/holostage/holosuitBridge';
import { showTimelineEngine } from '../../services/holostage/showTimelineEngine';

import type { CharacterAsset } from '../../schemas/holostage/character.schema';
import type { ShowSong } from '../../schemas/holostage/showPackage.schema';
import type { HoloSuitConfig } from '../../schemas/holostage/motionSource.schema';
import { useHoloLang } from './holoLangContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOL_COLORS: Record<string, string> = {
  holosuit: '#6366f1',
  cc4:      '#f97316',
  iclone:   '#22c55e',
  boostify: '#f97316',
};

const CATEGORY_COLORS: Record<string, string> = {
  music:    '#f97316',
  fantasy:  '#8b5cf6',
  action:   '#ef4444',
  sports:   '#22c55e',
  social:   '#3b82f6',
  speech:   '#06b6d4',
  martial:  '#f59e0b',
  everyday: '#6b7280',
};

const PART_COLORS: Record<string, string> = {
  Head:          '#06b6d4',
  Torso:         '#f97316',
  LeftArm:       '#6366f1',
  RightArm:      '#6366f1',
  LeftHand:      '#8b5cf6',
  RightHand:     '#8b5cf6',
  LeftFingers:   '#ec4899',
  RightFingers:  '#ec4899',
  LeftLeg:       '#22c55e',
  RightLeg:      '#22c55e',
};

type SectionId = 'pipeline' | 'mapping' | 'recordings' | 'config';

// ─── PipelineArrow ────────────────────────────────────────────────────────────

function PipelineArrow({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center py-0.5">
      <div
        className="h-5 w-0.5 rounded-full transition-all duration-500"
        style={{ background: active ? '#f97316' : 'rgba(255,255,255,0.08)' }}
      />
      <div
        className="w-0 h-0 absolute"
        style={{
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: `5px solid ${active ? '#f97316' : 'rgba(255,255,255,0.08)'}`,
          marginTop: '16px',
        }}
      />
    </div>
  );
}

// ─── StepCard ─────────────────────────────────────────────────────────────────

function StepCard({ step, isLast }: { step: WorkflowStep; isLast: boolean }) {
  const color = TOOL_COLORS[step.tool] ?? '#6b7280';

  const iconEl = (() => {
    switch (step.status) {
      case 'complete': return (
        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#22c55e22' }}>
          <CheckCircle className="w-3.5 h-3.5" style={{ color: '#22c55e' }} />
        </div>
      );
      case 'active':   return (
        <div className="w-6 h-6 rounded-full flex items-center justify-center animate-pulse" style={{ background: color + '22' }}>
          <Activity className="w-3.5 h-3.5" style={{ color }} />
        </div>
      );
      case 'error':    return (
        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#ef444422' }}>
          <AlertCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
        </div>
      );
      default:         return (
        <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <Circle className="w-3.5 h-3.5" style={{ color: '#374151' }} />
        </div>
      );
    }
  })();

  return (
    <div className="relative">
      <div
        className="flex items-start gap-3 px-3 py-2.5 rounded-xl transition-all duration-300"
        style={{
          background: step.status === 'active'
            ? `rgba(${step.tool === 'holosuit' ? '99,102,241' : step.tool === 'iclone' ? '34,197,94' : '249,115,22'},0.10)`
            : step.status === 'complete'
              ? 'rgba(34,197,94,0.04)'
              : 'rgba(255,255,255,0.03)',
          border: `1px solid ${
            step.status === 'active'
              ? color + '44'
              : step.status === 'complete'
                ? '#22c55e22'
                : 'rgba(255,255,255,0.06)'
          }`,
          boxShadow: step.status === 'active' ? `0 0 12px ${color}22` : 'none',
        }}
      >
        {/* Left accent */}
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5 rounded-l-xl transition-all duration-300"
          style={{
            background: step.status === 'active'
              ? color
              : step.status === 'complete'
                ? '#22c55e'
                : 'transparent',
          }}
        />
        {iconEl}
        <div className="flex-1 min-w-0 pl-0.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-white">{step.name}</p>
            <span
              className="text-xs font-bold px-1.5 py-0.5 rounded shrink-0"
              style={{ background: color + '22', color, fontSize: '9px', letterSpacing: '0.06em' }}
            >
              {step.tool.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.description}</p>
        </div>
      </div>
      {!isLast && (
        <div className="flex justify-center my-1">
          <div
            className="w-px h-4 transition-all duration-500"
            style={{
              background: step.status === 'complete'
                ? '#22c55e'
                : 'rgba(255,255,255,0.08)',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── LivePoseMonitor ──────────────────────────────────────────────────────────

function LivePoseMonitor({ lastPose }: { lastPose: CC4Pose | null }) {
  if (!lastPose) {
    return (
      <div
        className="rounded-lg px-3 py-2 flex items-center gap-2"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="w-2 h-2 rounded-full bg-gray-700" />
        <span className="text-xs text-gray-600">No live pose data — run pipeline to activate</span>
      </div>
    );
  }

  const boneCount = Object.keys(lastPose.bones).length;
  const fingerCount = lastPose.fingers ? Object.keys(lastPose.fingers).length : 0;

  return (
    <div
      className="rounded-lg p-3 space-y-2"
      style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-xs font-bold text-indigo-300">Live CC4 Pose</span>
        </div>
        <span className="text-xs text-gray-600 font-mono">frame #{lastPose.frameIndex}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded px-2 py-1.5 text-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
          <p className="text-sm font-black text-indigo-300">{boneCount}</p>
          <p className="text-xs text-gray-600" style={{ fontSize: '9px' }}>BODY BONES</p>
        </div>
        <div className="rounded px-2 py-1.5 text-center" style={{ background: 'rgba(249,115,22,0.08)' }}>
          <p className="text-sm font-black text-orange-400">{fingerCount}</p>
          <p className="text-xs text-gray-600" style={{ fontSize: '9px' }}>FINGER BONES</p>
        </div>
        <div className="rounded px-2 py-1.5 text-center" style={{ background: 'rgba(6,182,212,0.08)' }}>
          <p className="text-sm font-black text-cyan-400">{lastPose.face ? '✓' : '—'}</p>
          <p className="text-xs text-gray-600" style={{ fontSize: '9px' }}>FACE</p>
        </div>
      </div>
    </div>
  );
}

// ─── BoneMappingSection ───────────────────────────────────────────────────────

function BoneMappingSection({ activePose }: { activePose: CC4Pose | null }) {
  const [search, setSearch] = useState('');
  const [filterPart, setFilterPart] = useState<CC4MotionPart | 'All'>('All');
  const [collapsed, setCollapsed] = useState(false);

  const parts: Array<CC4MotionPart | 'All'> = [
    'All', 'Head', 'Torso', 'LeftArm', 'RightArm',
    'LeftHand', 'RightHand', 'LeftFingers', 'RightFingers',
    'LeftLeg', 'RightLeg',
  ];

  const filtered = CC4_BODY_MAPPING.filter(m => {
    const matchSearch = search === '' ||
      m.holosuitBone.toLowerCase().includes(search.toLowerCase()) ||
      m.cc4Bone.toLowerCase().includes(search.toLowerCase());
    const matchPart = filterPart === 'All' || m.motionPart === filterPart;
    return matchSearch && matchPart;
  });

  const activeBones = activePose ? new Set(Object.keys(activePose.bones)) : new Set<string>();
  const mappedCount = CC4_BODY_MAPPING.length;
  const totalCC4 = CC4_ALL_BONES.length;

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div
        className="rounded-xl p-3 grid grid-cols-3 gap-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="text-center">
          <p className="text-base font-black" style={{ color: '#6366f1' }}>{mappedCount}</p>
          <p className="text-xs text-gray-600" style={{ fontSize: '9px' }}>MAPPED</p>
        </div>
        <div className="text-center">
          <p className="text-base font-black" style={{ color: '#f97316' }}>{totalCC4}</p>
          <p className="text-xs text-gray-600" style={{ fontSize: '9px' }}>CC4 TOTAL</p>
        </div>
        <div className="text-center">
          <p className="text-base font-black" style={{ color: '#22c55e' }}>{Math.round(mappedCount / totalCC4 * 100)}%</p>
          <p className="text-xs text-gray-600" style={{ fontSize: '9px' }}>COVERAGE</p>
        </div>
      </div>

      {/* Coverage bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.round(mappedCount / totalCC4 * 100)}%`,
            background: 'linear-gradient(90deg,#6366f1,#f97316)',
          }}
        />
      </div>

      {/* Part filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {parts.map(p => (
          <button
            key={p}
            onClick={() => setFilterPart(p)}
            className="px-2 py-0.5 rounded-full text-xs font-medium transition-all"
            style={{
              background: filterPart === p
                ? (p === 'All' ? 'rgba(249,115,22,0.15)' : (PART_COLORS[p as string] ?? '#6b7280') + '22')
                : 'rgba(255,255,255,0.04)',
              color: filterPart === p
                ? (p === 'All' ? '#f97316' : (PART_COLORS[p as string] ?? '#9ca3af'))
                : '#6b7280',
              border: `1px solid ${filterPart === p ? ((p === 'All' ? '#f97316' : PART_COLORS[p as string] ?? '#6b7280') + '40') : 'transparent'}`,
              fontSize: '10px',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
        <input
          type="text"
          placeholder="Search bones..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs text-white placeholder-gray-600 outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        />
        {search && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
            onClick={() => setSearch('')}
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div
          className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
          style={{ background: 'rgba(255,255,255,0.03)' }}
          onClick={() => setCollapsed(c => !c)}
        >
          <span className="text-xs font-bold text-white">
            Body Mapping — {filtered.length} bones
            {activeBones.size > 0 && (
              <span className="ml-2 text-indigo-400 font-normal">
                ({activeBones.size} active)
              </span>
            )}
          </span>
          {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-600" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-600" />}
        </div>
        {!collapsed && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  <th className="px-3 py-1.5 text-left text-gray-600 font-medium">HoloSuit</th>
                  <th className="px-3 py-1.5 text-left font-medium" style={{ color: '#f97316' }}>CC4 Bone</th>
                  <th className="px-3 py-1.5 text-left text-gray-600 font-medium hidden sm:table-cell">HIK</th>
                  <th className="px-3 py-1.5 text-left text-gray-600 font-medium hidden sm:table-cell">Part</th>
                  <th className="px-3 py-1.5 text-center text-gray-600 font-medium">Live</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => {
                  const isActive = activeBones.has(m.cc4Bone);
                  return (
                    <tr
                      key={m.cc4Bone}
                      style={{
                        background: isActive
                          ? 'rgba(99,102,241,0.08)'
                          : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                        transition: 'background 0.3s',
                      }}
                    >
                      <td className="px-3 py-1 font-mono text-indigo-400">{m.holosuitBone}</td>
                      <td className="px-3 py-1 font-mono" style={{ color: PART_COLORS[m.motionPart ?? ''] ?? '#f97316' }}>{m.cc4Bone}</td>
                      <td className="px-3 py-1 text-gray-600 hidden sm:table-cell">{m.icloneHikId ?? '—'}</td>
                      <td className="px-3 py-1 hidden sm:table-cell">
                        {m.motionPart && (
                          <span
                            className="px-1 rounded text-xs"
                            style={{
                              background: (PART_COLORS[m.motionPart] ?? '#6b7280') + '18',
                              color: PART_COLORS[m.motionPart] ?? '#6b7280',
                              fontSize: '9px',
                            }}
                          >
                            {m.motionPart}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1 text-center">
                        <div
                          className="inline-block w-1.5 h-1.5 rounded-full transition-all duration-300"
                          style={{
                            background: isActive ? '#22c55e' : '#374151',
                            boxShadow: isActive ? '0 0 4px #22c55e' : 'none',
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-600 px-1">
        + 30 finger bones (15 per hand, CC4 RL_L/R_Finger naming)
      </p>
    </div>
  );
}

// ─── RecordingCard ────────────────────────────────────────────────────────────

function RecordingCard({
  rec, isSelected, isPlaying, onSelect, onPlay,
}: {
  rec: HoloSuitRecordingInfo;
  isSelected: boolean;
  isPlaying: boolean;
  onSelect: () => void;
  onPlay: () => void;
}) {
  const color = CATEGORY_COLORS[rec.category] ?? '#6b7280';

  return (
    <div
      className="rounded-xl overflow-hidden transition-all duration-200"
      style={{
        background: isSelected
          ? 'rgba(249,115,22,0.08)'
          : rec.recommendedForBoostify
            ? 'rgba(249,115,22,0.04)'
            : 'rgba(255,255,255,0.03)',
        border: `1px solid ${
          isSelected
            ? '#f9731644'
            : rec.recommendedForBoostify
              ? '#f9731618'
              : 'rgba(255,255,255,0.06)'
        }`,
        transform: isSelected ? 'scale(1.005)' : 'scale(1)',
      }}
    >
      <div
        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
        onClick={onSelect}
      >
        {/* Category dot */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: color + '20' }}
        >
          <Music className="w-4 h-4" style={{ color }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-white truncate">{rec.displayName}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="font-bold" style={{ color, fontSize: '9px' }}>
              {rec.category.toUpperCase()}
            </span>
            {rec.hasFace && (
              <span className="px-1 rounded" style={{ background: '#06b6d418', color: '#06b6d4', fontSize: '9px' }}>
                FACE
              </span>
            )}
            {rec.recommendedForBoostify && (
              <span className="px-1 rounded" style={{ background: '#f9731418', color: '#f97316', fontSize: '9px' }}>
                ★ BOOST
              </span>
            )}
          </div>
        </div>

        {/* Play */}
        <button
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all"
          style={{
            background: isPlaying ? '#ef444420' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${isPlaying ? '#ef444444' : 'rgba(255,255,255,0.08)'}`,
          }}
          onClick={e => { e.stopPropagation(); onPlay(); }}
        >
          {isPlaying
            ? <Square className="w-3 h-3 text-red-400" />
            : <Play className="w-3 h-3 text-gray-400" />
          }
        </button>
      </div>

      {/* Expanded detail when selected */}
      {isSelected && (
        <div
          className="px-3 pb-2.5 space-y-1"
          style={{ borderTop: '1px solid rgba(249,115,22,0.12)' }}
        >
          <p className="text-xs text-orange-400 font-bold pt-2">Recording Path</p>
          <p className="text-xs text-gray-500 font-mono break-all">{rec.srecPath}</p>
          <p className="text-xs text-gray-600 mt-1">
            Load in HoloSuit Studio → Enable Custom Streaming → Connect to Boostify HoloStage
          </p>
        </div>
      )}
    </div>
  );
}

// ─── RecordingsSection ────────────────────────────────────────────────────────

function RecordingsSection() {
  const [selectedRecording, setSelectedRecording] = useState<string | null>(null);
  const [playingRecording, setPlayingRecording] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const categories = ['All', ...Array.from(new Set(HOLOSUIT_RECORDING_CATALOG.map(r => r.category)))];

  const filtered = HOLOSUIT_RECORDING_CATALOG.filter(r =>
    categoryFilter === 'All' || r.category === categoryFilter
  );

  const musicCount = HOLOSUIT_RECORDING_CATALOG.filter(r => r.category === 'music').length;
  const faceCount  = HOLOSUIT_RECORDING_CATALOG.filter(r => r.hasFace).length;

  const handlePlay = (name: string) => {
    if (playingRecording === name) {
      setPlayingRecording(null);
      holosuitBridge.stopSimulation();
    } else {
      setPlayingRecording(name);
      // Start simulation to simulate playing
      holosuitBridge.startSimulation(30, 0.7);
      setTimeout(() => {
        if (playingRecording === name) {
          setPlayingRecording(null);
          holosuitBridge.stopSimulation();
        }
      }, 8000);
    }
  };

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div
        className="rounded-xl p-3 grid grid-cols-3 gap-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="text-center">
          <p className="text-base font-black" style={{ color: '#f97316' }}>
            {HOLOSUIT_RECORDING_CATALOG.length}
          </p>
          <p className="text-xs text-gray-600" style={{ fontSize: '9px' }}>TOTAL</p>
        </div>
        <div className="text-center">
          <p className="text-base font-black" style={{ color: '#22c55e' }}>{musicCount}</p>
          <p className="text-xs text-gray-600" style={{ fontSize: '9px' }}>MUSIC</p>
        </div>
        <div className="text-center">
          <p className="text-base font-black" style={{ color: '#06b6d4' }}>{faceCount}</p>
          <p className="text-xs text-gray-600" style={{ fontSize: '9px' }}>WITH FACE</p>
        </div>
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 flex-wrap">
        {categories.map(cat => {
          const color = cat === 'All' ? '#f97316' : (CATEGORY_COLORS[cat] ?? '#6b7280');
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="px-2 py-0.5 rounded-full text-xs font-medium capitalize transition-all"
              style={{
                background: categoryFilter === cat ? color + '22' : 'rgba(255,255,255,0.04)',
                color: categoryFilter === cat ? color : '#6b7280',
                border: `1px solid ${categoryFilter === cat ? color + '44' : 'transparent'}`,
                fontSize: '10px',
              }}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Recording list */}
      <div className="space-y-1.5">
        {filtered.map(rec => (
          <RecordingCard
            key={rec.name}
            rec={rec}
            isSelected={selectedRecording === rec.name}
            isPlaying={playingRecording === rec.name}
            onSelect={() => setSelectedRecording(selectedRecording === rec.name ? null : rec.name)}
            onPlay={() => handlePlay(rec.name)}
          />
        ))}
      </div>

      {playingRecording && (
        <div
          className="rounded-lg px-3 py-2 flex items-center gap-2"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}
        >
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-400 font-bold">
            Simulating: {playingRecording}
          </span>
          <span className="text-xs text-gray-600 ml-auto">HoloSuit bridge active</span>
        </div>
      )}
    </div>
  );
}

// ─── ConfigSection ────────────────────────────────────────────────────────────

function ConfigSection({
  config, onUpdate, holosuitConfig, holosuitConnected, latency,
}: {
  config: CC4WorkflowConfig;
  onUpdate: (p: Partial<CC4WorkflowConfig>) => void;
  holosuitConfig?: HoloSuitConfig;
  holosuitConnected: boolean;
  latency: number;
}) {
  return (
    <div className="space-y-3">
      {/* HoloSuit Connection */}
      <div
        className="rounded-xl p-3 space-y-2"
        style={{
          background: holosuitConnected ? 'rgba(99,102,241,0.07)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${holosuitConnected ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)'}`,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5" style={{ color: holosuitConnected ? '#6366f1' : '#4b5563' }} />
            <span className="text-xs font-bold" style={{ color: holosuitConnected ? '#a5b4fc' : '#6b7280' }}>
              HoloSuit Studio Connection
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${holosuitConnected ? 'animate-pulse' : ''}`}
              style={{ background: holosuitConnected ? '#6366f1' : '#374151' }}
            />
            <span className="text-xs font-mono" style={{ color: holosuitConnected ? '#6366f1' : '#4b5563' }}>
              {holosuitConnected ? 'CONNECTED' : 'OFFLINE'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {[
            ['Host', holosuitConfig?.host ?? HOLOSUIT_STREAMING_DEFAULTS.udpPort.toString()],
            ['Port', holosuitConfig?.port ?? HOLOSUIT_STREAMING_DEFAULTS.udpPort],
            ['Protocol', HOLOSUIT_STREAMING_DEFAULTS.protocol],
            ['Send Rate', `${HOLOSUIT_STREAMING_DEFAULTS.sendRate} fps`],
            ['Coord Sys', HOLOSUIT_STREAMING_DEFAULTS.coordinateSystem],
            ['Latency', holosuitConnected ? `${latency}ms` : '—'],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-2">
              <span className="text-xs text-gray-600">{k}</span>
              <span className="text-xs text-gray-400 font-mono">{String(v)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Retargeting config */}
      <div
        className="rounded-xl p-3 space-y-3"
        style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.15)' }}
      >
        <p className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5" /> Retargeting Settings
        </p>

        {/* Smoothing */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-xs text-gray-500">Smoothing Factor</label>
            <span className="text-xs font-mono text-orange-400">{config.smoothingFactor.toFixed(2)}</span>
          </div>
          <input
            type="range" min="0" max="1" step="0.01"
            value={config.smoothingFactor}
            onChange={e => onUpdate({ smoothingFactor: parseFloat(e.target.value) })}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: '#f97316' }}
          />
          <div className="flex justify-between text-xs text-gray-700" style={{ fontSize: '9px' }}>
            <span>Raw (0)</span><span>Max Smooth (1)</span>
          </div>
        </div>

        {/* Scale */}
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-xs text-gray-500">Scale Multiplier</label>
            <span className="text-xs font-mono text-orange-400">{config.scaleMultiplier.toFixed(2)}×</span>
          </div>
          <input
            type="range" min="0.5" max="2.0" step="0.01"
            value={config.scaleMultiplier}
            onChange={e => onUpdate({ scaleMultiplier: parseFloat(e.target.value) })}
            className="w-full h-1 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: '#f97316' }}
          />
          <div className="flex justify-between text-xs text-gray-700" style={{ fontSize: '9px' }}>
            <span>0.5×</span><span>2.0×</span>
          </div>
        </div>
      </div>

      {/* Feature toggles */}
      <div
        className="rounded-xl p-3 space-y-2"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <p className="text-xs font-bold text-gray-400 flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5" /> Feature Toggles
        </p>
        {[
          { key: 'includeFingers', label: 'Finger Tracking', desc: '30 finger bones (Glove Pro)' },
          { key: 'includeFace',    label: 'Face Blendshapes', desc: 'ARKit-compatible face data' },
          { key: 'applyTPoseOffset', label: 'T-Pose Offset', desc: 'A-Pose → T-Pose arm correction' },
        ].map(({ key, label, desc }) => {
          const val = config[key as keyof CC4WorkflowConfig] as boolean;
          return (
            <div
              key={key}
              className="flex items-center justify-between cursor-pointer group"
              onClick={() => onUpdate({ [key]: !val } as Partial<CC4WorkflowConfig>)}
            >
              <div>
                <p className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">
                  {label}
                </p>
                <p className="text-xs text-gray-600" style={{ fontSize: '10px' }}>{desc}</p>
              </div>
              <div
                className="w-8 h-4 rounded-full flex items-center transition-all duration-300 cursor-pointer shrink-0"
                style={{
                  background: val ? '#22c55e' : 'rgba(255,255,255,0.1)',
                  padding: '1px',
                }}
              >
                <div
                  className="w-3 h-3 rounded-full bg-white transition-all duration-300"
                  style={{ transform: val ? 'translateX(16px)' : 'translateX(0)' }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Export / Reset */}
      <div className="flex gap-2">
        <button
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all"
          style={{
            background: 'rgba(99,102,241,0.12)',
            color: '#a5b4fc',
            border: '1px solid rgba(99,102,241,0.3)',
          }}
          onClick={() => {
            cc4WorkflowBridge.configure(config);
          }}
        >
          <Download className="w-3 h-3" /> Apply Config
        </button>
        <button
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            color: '#6b7280',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          onClick={() => onUpdate({ ...DEFAULT_WORKFLOW_CONFIG })}
        >
          <RefreshCw className="w-3 h-3" /> Reset
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface WorkflowPipelinePanelProps {
  character?: CharacterAsset | null;
  songs?: ShowSong[];
  holosuitConfig?: HoloSuitConfig;
}

export function WorkflowPipelinePanel({ character, songs = [], holosuitConfig }: WorkflowPipelinePanelProps) {
  const { t } = useHoloLang();

  // ── Config & Steps state ──────────────────────────────────────────────────
  const [config, setConfig] = useState<CC4WorkflowConfig>({ ...DEFAULT_WORKFLOW_CONFIG });
  const [steps, setSteps] = useState<WorkflowStep[]>(() => buildWorkflowSteps(true));
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'complete' | 'error'>('idle');
  const [selectedTemplate, setSelectedTemplate] = useState<CC4TemplateName>('CC3Plus_Default');

  // ── Live data state ───────────────────────────────────────────────────────
  const [lastPose, setLastPose] = useState<CC4Pose | null>(null);
  const [holosuitConnected, setHolosuitConnected] = useState(false);
  const [latency, setLatency] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);

  // ── Section ───────────────────────────────────────────────────────────────
  const [section, setSection] = useState<SectionId>('pipeline');

  // ─── Wire to holosuitBridge ──────────────────────────────────────────────
  useEffect(() => {
    setHolosuitConnected(holosuitBridge.isConnected());

    const unsub = holosuitBridge.onFrame(frame => {
      setHolosuitConnected(true);
      setFrameCount(c => c + 1);
      if (frame.timestamp) {
        setLatency(Math.max(0, Date.now() - frame.timestamp));
      }
    });

    return unsub;
  }, []);

  // ─── Wire to cc4WorkflowBridge ────────────────────────────────────────────
  useEffect(() => {
    const unsub = cc4WorkflowBridge.onPose(pose => {
      setLastPose(pose);
    });
    return unsub;
  }, []);

  // ─── Wire to showTimelineEngine ───────────────────────────────────────────
  useEffect(() => {
    const state = showTimelineEngine.getState();
    setCurrentSongId(state.currentSongId ?? null);

    const unsub = showTimelineEngine.onCueFiredEvent(_cue => {
      setCurrentSongId(showTimelineEngine.getState().currentSongId ?? null);
    });
    return unsub;
  }, []);

  // ─── Config update ────────────────────────────────────────────────────────
  const updateConfig = useCallback((partial: Partial<CC4WorkflowConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...partial };
      cc4WorkflowBridge.configure(next);
      return next;
    });
  }, []);

  // ─── Pipeline run simulation ──────────────────────────────────────────────
  const simulatePipelineRun = useCallback(() => {
    if (isRunning) {
      setIsRunning(false);
      setRunStatus('idle');
      setRunProgress(0);
      setSteps(buildWorkflowSteps(true));
      return;
    }

    setIsRunning(true);
    setRunStatus('running');
    setRunProgress(0);

    const allSteps = buildWorkflowSteps(true);
    setSteps([...allSteps]);
    let stepIdx = 0;

    const advance = () => {
      if (stepIdx >= allSteps.length) {
        setIsRunning(false);
        setRunStatus('complete');
        setRunProgress(100);
        // Start HoloSuit simulation when pipeline completes
        holosuitBridge.startSimulation(30, 0.6);
        setHolosuitConnected(true);
        return;
      }

      allSteps[stepIdx] = { ...allSteps[stepIdx], status: 'active' };
      setSteps([...allSteps]);
      setRunProgress(Math.round((stepIdx / allSteps.length) * 100));

      setTimeout(() => {
        allSteps[stepIdx] = { ...allSteps[stepIdx], status: 'complete' };
        setSteps([...allSteps]);
        stepIdx++;
        advance();
      }, 500 + Math.random() * 400);
    };

    advance();
  }, [isRunning]);

  // ─── Current song from context ────────────────────────────────────────────
  const currentSong = songs.find(s => s.id === currentSongId) ?? songs[0] ?? null;

  // ─── Status colors ─────────────────────────────────────────────────────────
  const statusStyle = {
    idle:     { color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
    running:  { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
    complete: { color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    error:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  }[runStatus];

  const SECTION_TABS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
    { id: 'pipeline',   label: 'Pipeline',    icon: <GitBranch className="w-3 h-3" /> },
    { id: 'mapping',    label: 'Bone Map',    icon: <Layers className="w-3 h-3" /> },
    { id: 'recordings', label: 'Recordings',  icon: <Music className="w-3 h-3" /> },
    { id: 'config',     label: 'Config',      icon: <Settings className="w-3 h-3" /> },
  ];

  return (
    <div className="space-y-4">

      {/* ── Header banner ───────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4"
        style={{
          background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(249,115,22,0.08))',
          border: '1px solid rgba(249,115,22,0.18)',
        }}
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-black text-white tracking-wider">WORKFLOW PIPELINE</h3>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: statusStyle.bg, color: statusStyle.color }}
              >
                {runStatus.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 ml-6">
              HoloSuit Studio → CC4 → iClone 8 → Boostify HoloStage
            </p>

            {/* Context badges */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap ml-6">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{
                  background: character ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
                  color: character ? '#f97316' : '#4b5563',
                }}
              >
                <User className="w-2.5 h-2.5 inline mr-1" />
                {character ? character.name : 'No character'}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{
                  background: songs.length > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.05)',
                  color: songs.length > 0 ? '#22c55e' : '#4b5563',
                }}
              >
                <Music className="w-2.5 h-2.5 inline mr-1" />
                {songs.length > 0 ? `${songs.length} song${songs.length !== 1 ? 's' : ''}` : 'No songs'}
              </span>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{
                  background: holosuitConnected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
                  color: holosuitConnected ? '#818cf8' : '#4b5563',
                }}
              >
                <Wifi className="w-2.5 h-2.5 inline mr-1" />
                HoloSuit {holosuitConnected ? (holosuitConfig ? `${holosuitConfig.host}:${holosuitConfig.port}` : 'Live') : 'Offline'}
              </span>
              {currentSong && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(168,85,247,0.12)', color: '#a78bfa' }}
                >
                  ♪ {currentSong.title}
                </span>
              )}
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={simulatePipelineRun}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
            style={{
              background: isRunning ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.18)',
              color: isRunning ? '#ef4444' : '#f97316',
              border: `1px solid ${isRunning ? 'rgba(239,68,68,0.4)' : 'rgba(249,115,22,0.4)'}`,
              boxShadow: isRunning ? '0 0 12px rgba(239,68,68,0.15)' : '0 0 12px rgba(249,115,22,0.15)',
            }}
          >
            {isRunning ? <Square className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            {isRunning ? 'STOP' : 'RUN'}
          </button>
        </div>

        {/* Progress bar */}
        {(isRunning || runStatus === 'complete') && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span style={{ color: '#6b7280', fontSize: '10px' }}>Pipeline Progress</span>
              <span style={{ color: runStatus === 'complete' ? '#22c55e' : '#f97316', fontSize: '10px' }}>
                {runProgress}%
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${runProgress}%`,
                  background: runStatus === 'complete'
                    ? 'linear-gradient(90deg,#22c55e,#6366f1)'
                    : 'linear-gradient(90deg,#6366f1,#f97316)',
                }}
              />
            </div>
          </div>
        )}

        {/* Live telemetry chips */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${holosuitConnected ? 'animate-pulse' : ''}`}
              style={{ background: holosuitConnected ? '#6366f1' : '#374151' }}
            />
            <span className="text-xs text-gray-500" style={{ fontSize: '10px' }}>
              HoloSuit {holosuitConnected ? `${frameCount} frames` : 'offline'}
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Cpu className="w-2.5 h-2.5 text-orange-400" />
            <span className="text-xs text-gray-500" style={{ fontSize: '10px' }}>
              CC4 {lastPose ? `${Object.keys(lastPose.bones).length} bones` : 'idle'}
            </span>
          </div>
          {holosuitConnected && (
            <div
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Radio className="w-2.5 h-2.5 text-green-400" />
              <span className="text-xs text-gray-500" style={{ fontSize: '10px' }}>
                {latency}ms latency
              </span>
            </div>
          )}
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 mt-3 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.25)' }}>
          {SECTION_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSection(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: section === tab.id ? 'rgba(249,115,22,0.18)' : 'transparent',
                color: section === tab.id ? '#f97316' : '#6b7280',
                border: `1px solid ${section === tab.id ? 'rgba(249,115,22,0.35)' : 'transparent'}`,
              }}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Pipeline section ─────────────────────────────────────────────── */}
      {section === 'pipeline' && (
        <div className="space-y-4">

          {/* Template selector */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 px-1 flex items-center gap-1.5">
              <User className="w-3 h-3" /> CC4 Character Template
            </p>
            <div className="space-y-1.5">
              {(Object.keys(CC4_CHARACTER_TEMPLATES) as CC4TemplateName[]).map(key => {
                const tmpl = CC4_CHARACTER_TEMPLATES[key];
                const sel = selectedTemplate === key;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedTemplate(key);
                      updateConfig({ avatarUid: tmpl.avatarUid });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      background: sel ? 'rgba(249,115,22,0.10)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${sel ? 'rgba(249,115,22,0.35)' : 'rgba(255,255,255,0.06)'}`,
                      boxShadow: sel ? '0 0 8px rgba(249,115,22,0.1)' : 'none',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: sel ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.06)' }}
                    >
                      <User className="w-4 h-4" style={{ color: sel ? '#f97316' : '#4b5563' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: sel ? '#f97316' : '#9ca3af' }}>
                        {tmpl.displayName}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5" style={{ fontSize: '10px' }}>
                        {tmpl.avatarUid}
                        {tmpl.tPoseArmOffset ? ` · ${tmpl.tPoseArmOffset}° arm offset` : ''}
                        {tmpl.hasFingers ? ' · Fingers ✓' : ''}
                        {tmpl.hasFace ? ' · Face ✓' : ''}
                      </p>
                    </div>
                    {sel && <CheckCircle className="w-4 h-4 text-orange-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Motion mask */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-gray-500 px-1 flex items-center gap-1.5">
              <Filter className="w-3 h-3" /> iClone Motion Mask
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(ICLONE_MOTION_MASKS) as Array<keyof typeof ICLONE_MOTION_MASKS>).map(mask => {
                const sel = config.maskPreset === mask;
                return (
                  <button
                    key={mask}
                    onClick={() => updateConfig({ maskPreset: mask })}
                    className="px-2 py-2 rounded-xl text-xs font-medium transition-all text-left"
                    style={{
                      background: sel ? 'rgba(99,102,241,0.14)' : 'rgba(255,255,255,0.03)',
                      color: sel ? '#a5b4fc' : '#6b7280',
                      border: `1px solid ${sel ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <span className="font-bold block">{mask}</span>
                    <span style={{ fontSize: '9px', opacity: 0.7 }}>
                      {ICLONE_MOTION_MASKS[mask].length} parts
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feature toggles row */}
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'includeFingers',   label: 'Fingers'  },
              { key: 'includeFace',      label: 'Face'     },
              { key: 'applyTPoseOffset', label: 'T-Pose'   },
            ].map(({ key, label }) => {
              const val = config[key as keyof CC4WorkflowConfig] as boolean;
              return (
                <button
                  key={key}
                  onClick={() => updateConfig({ [key]: !val } as Partial<CC4WorkflowConfig>)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{
                    background: val ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                    color: val ? '#22c55e' : '#6b7280',
                    border: `1px solid ${val ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.07)'}`,
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: val ? '#22c55e' : '#374151' }}
                  />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Steps list */}
          <div>
            <p className="text-xs font-bold text-gray-500 px-1 flex items-center gap-1.5 mb-2">
              <Database className="w-3 h-3" /> Pipeline Steps
            </p>
            {steps.map((step, i) => (
              <StepCard key={step.id} step={step} isLast={i === steps.length - 1} />
            ))}
          </div>

          {/* Live pose monitor */}
          <LivePoseMonitor lastPose={lastPose} />

          {/* HoloSuit config info */}
          <div
            className="rounded-xl p-3"
            style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)' }}
          >
            <p className="text-xs font-bold text-indigo-400 mb-2 flex items-center gap-1.5">
              <Info className="w-3 h-3" /> HoloSuit Studio Defaults
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {[
                ['UDP Port',     HOLOSUIT_STREAMING_DEFAULTS.udpPort],
                ['Protocol',     HOLOSUIT_STREAMING_DEFAULTS.protocol],
                ['Send Rate',    `${HOLOSUIT_STREAMING_DEFAULTS.sendRate} fps`],
                ['Coord System', HOLOSUIT_STREAMING_DEFAULTS.coordinateSystem],
                ['Body Bones',   '20 (HoloSuit Pro)'],
                ['Hand Bones',   '15/hand (Glove Pro)'],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between gap-2">
                  <span className="text-xs text-gray-600">{k}</span>
                  <span className="text-xs text-gray-400 font-mono">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Bone Map section ─────────────────────────────────────────────── */}
      {section === 'mapping' && (
        <BoneMappingSection activePose={lastPose} />
      )}

      {/* ── Recordings section ───────────────────────────────────────────── */}
      {section === 'recordings' && (
        <RecordingsSection />
      )}

      {/* ── Config section ───────────────────────────────────────────────── */}
      {section === 'config' && (
        <ConfigSection
          config={config}
          onUpdate={updateConfig}
          holosuitConfig={holosuitConfig}
          holosuitConnected={holosuitConnected}
          latency={latency}
        />
      )}
    </div>
  );
}
