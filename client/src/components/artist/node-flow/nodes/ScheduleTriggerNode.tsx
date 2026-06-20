/**
 * BOOSTIFY NODE FLOW — ScheduleTriggerNode
 * Time-based automation trigger. Configures cron schedules that fire
 * connected workflow actions (generate song, publish post, etc.) automatically.
 */

import { useState, useCallback } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Clock, Play, Pause, ChevronDown, ChevronUp, Zap, Save } from 'lucide-react';
import { useFlowStore } from '../useFlowStore';
import { NodeBorderRing, type NodeRingStatus } from './NodeBorderRing';

interface ScheduleConfig {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  dayOfWeek: number;    // 0=Sun … 6=Sat
  dayOfMonth: number;   // 1-31
  time: string;         // "HH:MM"
  cronExpr: string;     // for custom mode
  action: string;
  prompt: string;
  lastRun: string | null;
  nextRunLabel?: string;
}

const ACTIONS = [
  { value: 'generate-song',  label: '🎵 Generate Song',       desc: 'AI music generation' },
  { value: 'generate-bio',   label: '📝 Generate Bio',        desc: 'Rewrite artist biography' },
  { value: 'publish-post',   label: '📱 Publish Social Post', desc: 'Auto-post to social media' },
  { value: 'generate-image', label: '🖼️ Generate Image',     desc: 'Create AI artwork' },
  { value: 'custom-api',     label: '⚡ Custom API Call',     desc: 'Call any HTTP endpoint' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const FREQ_OPTIONS = [
  { value: 'hourly',  label: 'Every Hour' },
  { value: 'daily',   label: 'Every Day' },
  { value: 'weekly',  label: 'Every Week' },
  { value: 'monthly', label: 'Every Month' },
  { value: 'custom',  label: 'Custom Cron' },
];

function computeNextLabel(cfg: ScheduleConfig): string {
  if (!cfg.enabled) return 'Paused';
  const now = new Date();
  const [hh, mm] = (cfg.time || '09:00').split(':').map(Number);
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hh, mm);

  switch (cfg.frequency) {
    case 'hourly': {
      const n = new Date(now);
      n.setSeconds(0, 0);
      n.setMinutes(Number(mm));
      if (n <= now) n.setHours(n.getHours() + 1);
      return `~${n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    case 'daily': {
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    }
    case 'weekly': {
      const target = cfg.dayOfWeek ?? 1;
      const diff = (target - now.getDay() + 7) % 7 || 7;
      next.setDate(now.getDate() + diff);
      return `${DAYS[target]} ${next.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    }
    case 'monthly': {
      next.setDate(cfg.dayOfMonth ?? 1);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      return next.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    case 'custom':
      return cfg.cronExpr ? 'Custom cron' : 'Invalid cron';
    default:
      return '—';
  }
}

export function ScheduleTriggerNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);

  const initSchedule: ScheduleConfig = {
    enabled: false,
    frequency: 'weekly',
    dayOfWeek: 1,
    dayOfMonth: 1,
    time: '09:00',
    cronExpr: '',
    action: 'generate-song',
    prompt: '',
    lastRun: null,
    ...(data?.schedule ?? {}),
  };

  const [schedule, setSchedule] = useState<ScheduleConfig>(initSchedule);
  const [expanded, setExpanded] = useState(true);
  const [saved, setSaved] = useState(false);

  const patch = useCallback(<K extends keyof ScheduleConfig>(key: K, val: ScheduleConfig[K]) => {
    setSchedule(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    const withLabel = { ...schedule, nextRunLabel: computeNextLabel(schedule) };
    updateNodeData(id, { schedule: withLabel });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [id, schedule, updateNodeData]);

  const isEnabled = schedule.enabled;
  const accentColor = isEnabled ? '#22c55e' : '#64748b';
  const ringStatus: NodeRingStatus = isEnabled ? 'active' : 'paused';
  const nodeBg = 'linear-gradient(145deg, #0c0f1e, #080b16)';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ position: 'relative', width: 280, fontFamily: "'Inter', sans-serif" }}
    >
      <NodeBorderRing status={ringStatus} radius={14} borderWidth={2} bg={nodeBg} />

      {/* Output handle — outside card so overflow:hidden doesn't clip it */}
      <Handle type="source" position={Position.Right} style={{ background: accentColor, width: 10, height: 10, border: '2px solid #0c0f1e', zIndex: 10 }} />

      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%',
        background: nodeBg,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        background: isEnabled ? 'rgba(34,197,94,0.08)' : 'rgba(99,102,241,0.08)',
        borderBottom: `1px solid ${accentColor}30`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: isEnabled ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Clock size={15} color={accentColor} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.02em' }}>
            Schedule Trigger
          </div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
            {isEnabled ? `⚡ Active · Next: ${computeNextLabel(schedule)}` : '⏸ Paused'}
          </div>
        </div>
        {/* Enable toggle */}
        <button
          onClick={() => patch('enabled', !isEnabled)}
          title={isEnabled ? 'Pause schedule' : 'Activate schedule'}
          style={{
            width: 28, height: 28, borderRadius: 7, border: 'none', cursor: 'pointer',
            background: isEnabled ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)',
            color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isEnabled ? <Pause size={12} /> : <Play size={12} />}
        </button>
        {/* Expand/collapse */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            width: 20, height: 20, borderRadius: 5, border: 'none', cursor: 'pointer',
            background: 'transparent', color: '#475569',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {/* Config panel */}
      {expanded && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Frequency */}
          <div>
            <label style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Frequency</label>
            <select
              value={schedule.frequency}
              onChange={e => patch('frequency', e.target.value as ScheduleConfig['frequency'])}
              style={inputStyle}
            >
              {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Day of week (weekly only) */}
          {schedule.frequency === 'weekly' && (
            <div>
              <label style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Day of Week</label>
              <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                {DAYS.map((d, i) => (
                  <button key={i} onClick={() => patch('dayOfWeek', i)} style={{
                    flex: 1, padding: '4px 0', fontSize: 8, fontWeight: 700, borderRadius: 5,
                    border: 'none', cursor: 'pointer',
                    background: schedule.dayOfWeek === i ? accentColor : 'rgba(255,255,255,0.06)',
                    color: schedule.dayOfWeek === i ? '#000' : '#64748b',
                  }}>{d}</button>
                ))}
              </div>
            </div>
          )}

          {/* Day of month (monthly only) */}
          {schedule.frequency === 'monthly' && (
            <div>
              <label style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Day of Month</label>
              <input
                type="number" min={1} max={28} value={schedule.dayOfMonth}
                onChange={e => patch('dayOfMonth', parseInt(e.target.value) || 1)}
                style={inputStyle}
              />
            </div>
          )}

          {/* Time (not for hourly or custom) */}
          {schedule.frequency !== 'hourly' && schedule.frequency !== 'custom' && (
            <div>
              <label style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Time (UTC)</label>
              <input
                type="time" value={schedule.time}
                onChange={e => patch('time', e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {/* Custom cron expression */}
          {schedule.frequency === 'custom' && (
            <div>
              <label style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Cron Expression</label>
              <input
                type="text"
                value={schedule.cronExpr}
                onChange={e => patch('cronExpr', e.target.value)}
                placeholder="0 9 * * 1"
                style={inputStyle}
              />
              <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>e.g. "0 9 * * 1" = Mon 9am UTC</div>
            </div>
          )}

          {/* Action */}
          <div>
            <label style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Action</label>
            <select
              value={schedule.action}
              onChange={e => patch('action', e.target.value)}
              style={inputStyle}
            >
              {ACTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>
              {ACTIONS.find(a => a.value === schedule.action)?.desc}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Prompt / Instructions
            </label>
            <textarea
              value={schedule.prompt}
              onChange={e => patch('prompt', e.target.value)}
              placeholder={
                schedule.action === 'generate-song'
                  ? 'e.g. Create a soulful blues track about heartbreak at midnight, slow tempo, guitar-driven...'
                  : schedule.action === 'custom-api'
                  ? 'Enter the URL to POST to...'
                  : 'Describe what to generate...'
              }
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 56, lineHeight: 1.4 }}
            />
            <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>
              Variables: {'{artist_name}'} {'{genre}'} {'{date}'}
            </div>
          </div>

          {/* Last run info */}
          {schedule.lastRun && (
            <div style={{
              padding: '5px 8px', borderRadius: 6, fontSize: 9,
              background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
              color: '#4ade80',
            }}>
              ✓ Last run: {new Date(schedule.lastRun).toLocaleString()}
            </div>
          )}

          {/* Save button */}
          <button onClick={handleSave} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 10, letterSpacing: '0.04em',
            background: saved ? 'rgba(34,197,94,0.2)' : `${accentColor}20`,
            color: saved ? '#4ade80' : accentColor,
            transition: 'all 0.2s',
          }}>
            {saved ? <><Zap size={11} /> Saved!</> : <><Save size={11} /> Save Schedule</>}
          </button>
        </div>
      )}
      </div>{/* /card */}
    </motion.div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  marginTop: 4, padding: '5px 8px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 7, color: '#e2e8f0', fontSize: 10,
  outline: 'none', fontFamily: 'inherit',
};
