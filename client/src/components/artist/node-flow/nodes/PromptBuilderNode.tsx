/**
 * BOOSTIFY NODE FLOW — PromptBuilderNode
 * Editable prompt template with variable insertion chips.
 * Builds dynamic prompt text that flows into downstream generation nodes.
 */

import { useState, useCallback, useRef } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { MessageSquarePlus, ChevronDown, ChevronUp, Save, Zap, Copy, CheckCircle2 } from 'lucide-react';
import { useFlowStore } from '../useFlowStore';
import { NodeBorderRing, type NodeRingStatus } from './NodeBorderRing';

const VARIABLES = [
  { key: '{artist_name}',  label: 'Artist',   color: '#60a5fa' },
  { key: '{genre}',        label: 'Genre',    color: '#34d399' },
  { key: '{mood}',         label: 'Mood',     color: '#f472b6' },
  { key: '{song_title}',   label: 'Song',     color: '#fbbf24' },
  { key: '{date}',         label: 'Date',     color: '#a78bfa' },
  { key: '{week_number}',  label: 'Week#',    color: '#fb923c' },
  { key: '{year}',         label: 'Year',     color: '#38bdf8' },
  { key: '{language}',     label: 'Lang',     color: '#4ade80' },
];

const PRESET_TEMPLATES = [
  {
    label: 'Weekly Song',
    value: 'Create a brand new {genre} track for {artist_name}. The mood should be {mood}. Date: {date}, Week {week_number}. Make it unique and release-ready.',
  },
  {
    label: 'Bio Update',
    value: 'Write an updated artist biography for {artist_name} — a {genre} artist. Highlight their style, achievements, and {year} releases. Tone: professional yet personal.',
  },
  {
    label: 'Social Post',
    value: 'Write a short, engaging social media post for {artist_name}. Announce the new {genre} track "{song_title}". Include relevant emojis. Keep it under 280 characters.',
  },
  {
    label: 'Lyrics Prompt',
    value: 'Write lyrics for a {mood} {genre} song called "{song_title}" by {artist_name}. Structure: verse, chorus, verse, chorus, bridge, chorus. Language: {language}.',
  },
];

export function PromptBuilderNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);

  const [template, setTemplate] = useState<string>(data?.promptTemplate ?? '');
  const [expanded, setExpanded] = useState(true);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPresets, setShowPresets] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = useCallback(() => {
    updateNodeData(id, { promptTemplate: template });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [id, template, updateNodeData]);

  const insertVariable = useCallback((varKey: string) => {
    const el = textareaRef.current;
    if (!el) {
      setTemplate(prev => prev + varKey);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = template.slice(0, start) + varKey + template.slice(end);
    setTemplate(newVal);
    setSaved(false);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + varKey.length, start + varKey.length);
    }, 0);
  }, [template]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [template]);

  const applyPreset = useCallback((value: string) => {
    setTemplate(value);
    setShowPresets(false);
    setSaved(false);
  }, []);

  const charCount = template.length;
  const isLong = charCount > 500;

  const promptRingStatus: NodeRingStatus = saved ? 'active' : template ? 'paused' : 'off';
  const promptBg = 'linear-gradient(145deg, #0e0c1e, #0a0816)';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ position: 'relative', width: 300, fontFamily: "'Inter', sans-serif" }}
    >
      <NodeBorderRing status={promptRingStatus} radius={14} borderWidth={2} bg={promptBg} />

      {/* Handles — outside card so overflow:hidden doesn't clip them */}
      <Handle type="target" position={Position.Left}
        style={{ background: '#f472b6', width: 10, height: 10, border: '2px solid #0a0816', zIndex: 10 }} />
      <Handle type="source" position={Position.Right}
        style={{ background: '#f472b6', width: 10, height: 10, border: '2px solid #0a0816', zIndex: 10 }} />

      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%',
        background: promptBg,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        background: 'rgba(244,114,182,0.07)',
        borderBottom: '1px solid rgba(244,114,182,0.15)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'rgba(244,114,182,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MessageSquarePlus size={15} color="#f472b6" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0' }}>Prompt Builder</div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
            {template ? `${charCount} chars` : 'Build your AI prompt template'}
          </div>
        </div>
        <button onClick={() => setExpanded(e => !e)} style={{
          width: 20, height: 20, borderRadius: 5, border: 'none', cursor: 'pointer',
          background: 'transparent', color: '#475569',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Preset templates */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowPresets(p => !p)} style={{
              width: '100%', padding: '5px 8px', borderRadius: 7,
              border: '1px solid rgba(244,114,182,0.2)',
              background: 'rgba(244,114,182,0.05)', cursor: 'pointer',
              color: '#f472b6', fontSize: 9, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>📋 Load Preset Template</span>
              {showPresets ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
            {showPresets && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10,
                background: '#0e0c1e', border: '1px solid rgba(244,114,182,0.25)',
                borderRadius: 8, overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              }}>
                {PRESET_TEMPLATES.map(p => (
                  <button key={p.label} onClick={() => applyPreset(p.value)} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '7px 10px', border: 'none', cursor: 'pointer',
                    background: 'transparent', color: '#e2e8f0', fontSize: 9,
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,114,182,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ fontWeight: 700, color: '#f472b6', marginBottom: 2 }}>{p.label}</div>
                    <div style={{ color: '#64748b', lineHeight: 1.4 }}>
                      {p.value.substring(0, 70)}…
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Variable chips */}
          <div>
            <label style={labelStyle}>Insert Variable</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
              {VARIABLES.map(v => (
                <button key={v.key} onClick={() => insertVariable(v.key)} title={v.key} style={{
                  padding: '3px 7px', borderRadius: 5, cursor: 'pointer',
                  background: `${v.color}15`,
                  color: v.color, fontSize: 8, fontWeight: 700,
                  border: `1px solid ${v.color}30`,
                  transition: 'all 0.15s',
                }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Template textarea */}
          <div>
            <label style={labelStyle}>Prompt Template</label>
            <textarea
              ref={textareaRef}
              value={template}
              onChange={e => { setTemplate(e.target.value); setSaved(false); }}
              placeholder="e.g. Create a {genre} song for {artist_name} that captures a {mood} feeling. Week {week_number} of {year}..."
              rows={5}
              style={{
                width: '100%', boxSizing: 'border-box',
                marginTop: 4, padding: '7px 9px',
                background: 'rgba(244,114,182,0.04)',
                border: `1px solid rgba(244,114,182,${isLong ? '0.3' : '0.15'})`,
                borderRadius: 8, color: '#e2e8f0', fontSize: 10,
                outline: 'none', fontFamily: 'inherit',
                resize: 'vertical', lineHeight: 1.5, minHeight: 90,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, fontSize: 8 }}>
              <span style={{ color: isLong ? '#fb923c' : '#475569' }}>{charCount} characters</span>
              <span style={{ color: '#475569' }}>
                Variables: {VARIABLES.filter(v => template.includes(v.key)).map(v => v.label).join(', ') || 'none'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleCopy} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '6px 0', borderRadius: 7, border: '1px solid rgba(244,114,182,0.2)',
              cursor: 'pointer', fontWeight: 700, fontSize: 9,
              background: 'transparent', color: copied ? '#4ade80' : '#f472b6',
              transition: 'all 0.2s',
            }}>
              {copied ? <><CheckCircle2 size={10} /> Copied!</> : <><Copy size={10} /> Copy</>}
            </button>
            <button onClick={handleSave} style={{
              flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '6px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 10,
              background: saved ? 'rgba(34,197,94,0.15)' : 'rgba(244,114,182,0.12)',
              color: saved ? '#4ade80' : '#f472b6',
              transition: 'all 0.2s',
            }}>
              {saved ? <><Zap size={11} /> Saved!</> : <><Save size={11} /> Save Prompt</>}
            </button>
          </div>
        </div>
      )}
      </div>{/* /card */}
    </motion.div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, color: '#64748b', fontWeight: 700,
  letterSpacing: '0.06em', textTransform: 'uppercase',
};
