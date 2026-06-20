/**
 * BOOSTIFY NODE FLOW — RouterNode
 * Conditional routing: evaluates a condition and sends flow to branch A, B, or C.
 * Multiple output handles positioned on the right side, labeled A / B / C.
 */

import { useState, useCallback } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { GitBranch, ChevronDown, ChevronUp, Save, Zap } from 'lucide-react';
import { useFlowStore } from '../useFlowStore';
import { NodeBorderRing } from './NodeBorderRing';

interface RouterBranch {
  id: 'A' | 'B' | 'C';
  label: string;
  condition: string;
  color: string;
}

const DEFAULT_BRANCHES: RouterBranch[] = [
  { id: 'A', label: 'Branch A (if true)',   condition: 'songs > 0',    color: '#22c55e' },
  { id: 'B', label: 'Branch B (else)',       condition: 'default',      color: '#f97316' },
  { id: 'C', label: 'Branch C (optional)',   condition: '',             color: '#a78bfa' },
];

const BRANCH_Y_OFFSETS = { A: 30, B: 70, C: 110 };

export function RouterNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);

  const [branches, setBranches] = useState<RouterBranch[]>(
    data?.branches ?? DEFAULT_BRANCHES
  );
  const [mode, setMode] = useState<'condition' | 'roundrobin' | 'random'>(
    data?.routerMode ?? 'condition'
  );
  const [expanded, setExpanded] = useState(true);
  const [saved, setSaved] = useState(false);

  const patchBranch = useCallback((branchId: string, key: keyof RouterBranch, val: string) => {
    setBranches(prev => prev.map(b => b.id === branchId ? { ...b, [key]: val } : b));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    updateNodeData(id, { branches, routerMode: mode });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [id, branches, mode, updateNodeData]);

  const routerBg = 'linear-gradient(145deg, #0d0f1e, #090b17)';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ position: 'relative', width: 268, fontFamily: "'Inter', sans-serif" }}
    >
      <NodeBorderRing status="paused" radius={14} borderWidth={2} bg={routerBg} />

      {/* Input handle */}
      <Handle type="target" position={Position.Left}
        style={{ background: '#a78bfa', width: 10, height: 10, border: '2px solid #090b17', zIndex: 10 }} />

      {/* Output handles — A, B, C — distributed vertically on the right */}
      {DEFAULT_BRANCHES.map(b => (
        <Handle
          key={b.id}
          id={b.id}
          type="source"
          position={Position.Right}
          style={{
            background: b.color,
            width: 10, height: 10,
            border: '2px solid #090b17',
            top: BRANCH_Y_OFFSETS[b.id],
            zIndex: 10,
          }}
        />
      ))}

      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%',
        background: routerBg,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        background: 'rgba(167,139,250,0.07)',
        borderBottom: '1px solid rgba(167,139,250,0.15)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'rgba(167,139,250,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <GitBranch size={15} color="#a78bfa" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0' }}>Router</div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
            {mode === 'condition' ? 'Condition-based routing'
             : mode === 'roundrobin' ? 'Round-robin routing'
             : 'Random routing'}
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

          {/* Router mode */}
          <div>
            <label style={labelStyle}>Mode</label>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {(['condition', 'roundrobin', 'random'] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setSaved(false); }} style={{
                  flex: 1, padding: '4px 0', fontSize: 8, fontWeight: 700, borderRadius: 6,
                  border: 'none', cursor: 'pointer',
                  background: mode === m ? '#a78bfa' : 'rgba(255,255,255,0.06)',
                  color: mode === m ? '#000' : '#64748b',
                }}>
                  {m === 'roundrobin' ? 'Round Robin' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Branch configs */}
          {branches.map(b => (
            <div key={b.id} style={{
              padding: '8px 9px', borderRadius: 9,
              background: `${b.color}08`,
              border: `1px solid ${b.color}25`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 5,
                  background: b.color, color: '#000',
                  fontSize: 9, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>{b.id}</div>
                <input
                  value={b.label}
                  onChange={e => patchBranch(b.id, 'label', e.target.value)}
                  placeholder="Branch label"
                  style={{ ...inputStyle, flex: 1, padding: '3px 6px' }}
                />
              </div>
              {mode === 'condition' && (
                <>
                  <label style={{ ...labelStyle, fontSize: 8 }}>Condition</label>
                  <input
                    value={b.condition}
                    onChange={e => patchBranch(b.id, 'condition', e.target.value)}
                    placeholder={b.id === 'B' ? 'default (always matches)' : 'e.g. songs > 0'}
                    style={{ ...inputStyle, marginTop: 3, fontSize: 9 }}
                  />
                </>
              )}
            </div>
          ))}

          {/* Save */}
          <button onClick={handleSave} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 10,
            background: saved ? 'rgba(34,197,94,0.15)' : 'rgba(167,139,250,0.12)',
            color: saved ? '#4ade80' : '#a78bfa',
            transition: 'all 0.2s',
          }}>
            {saved ? <><Zap size={11} /> Saved!</> : <><Save size={11} /> Save Router</>}
          </button>
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

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '4px 7px', marginTop: 3,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, color: '#e2e8f0', fontSize: 10,
  outline: 'none', fontFamily: 'inherit',
};
