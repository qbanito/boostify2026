/**
 * BOOSTIFY ARTIST NODE FLOW — BaseNode
 * Visual wrapper used by all node types. Handles status glow, handles, layout.
 * Includes smart dependency panel: shows which upstream nodes need to be connected.
 */

import { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, XCircle, CircleDot, ChevronDown } from 'lucide-react';
import type { NodeFlowData, NodeStatus } from '../useFlowStore';
import { useNodeDependency } from '../NodeDependencyContext';
import { NODE_SCHEMA, OUTPUT_KIND_META } from '../NODE_SCHEMA';

export type NodeVariant = 'input' | 'process' | 'output';

interface BaseNodeProps {
  nodeProps: NodeProps<NodeFlowData>;
  variant: NodeVariant;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  hasInput?: boolean;
  hasOutput?: boolean;
  children?: React.ReactNode;
}

const VARIANT_COLORS: Record<NodeVariant, { border: string; glow: string; badge: string; icon: string }> = {
  input:   { border: '#3b82f6', glow: 'rgba(59,130,246,0.35)',  badge: 'rgba(59,130,246,0.15)',  icon: '#60a5fa' },
  process: { border: '#8b5cf6', glow: 'rgba(139,92,246,0.35)',  badge: 'rgba(139,92,246,0.15)',  icon: '#a78bfa' },
  output:  { border: '#10b981', glow: 'rgba(16,185,129,0.35)',  badge: 'rgba(16,185,129,0.15)',  icon: '#34d399' },
};

const STATUS_STYLES: Record<NodeStatus, { border: string; glow: string }> = {
  idle:    { border: '',        glow: '' },
  running: { border: '#f97316', glow: 'rgba(249,115,22,0.5)' },
  done:    { border: '#22c55e', glow: 'rgba(34,197,94,0.4)' },
  error:   { border: '#ef4444', glow: 'rgba(239,68,68,0.4)' },
};

// ─── Status → animated border config ────────────────────────────────────────
// Maps a node status to the traveling-light color + speed + whether it plays.
const BORDER_ANIM: Record<NodeStatus, {
  active: boolean;
  color: string;
  glow: string;
  speed: string;      // CSS animation duration
}> = {
  idle:    { active: false, color: '',         glow: '',                        speed: '0s' },
  running: { active: true,  color: '#fbbf24',  glow: 'rgba(251,191,36,0.7)',   speed: '1.6s' },
  done:    { active: true,  color: '#22c55e',  glow: 'rgba(34,197,94,0.7)',    speed: '2.4s' },
  error:   { active: true,  color: '#ef4444',  glow: 'rgba(239,68,68,0.75)',   speed: '0.9s' },
};

// Inject keyframes once
let _borderAnimInjected = false;
function injectBorderAnimStyle() {
  if (_borderAnimInjected || typeof document === 'undefined') return;
  _borderAnimInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes nodeRingRotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes nodeGlowPulse {
      0%, 100% { opacity: 0.85; }
      50%       { opacity: 0.45; }
    }
  `;
  document.head.appendChild(s);
}

/**
 * Animated traveling-light border ring.
 * Renders as a conic-gradient rotator inside a border-radius clip wrapper.
 * The inner content sits on top, cutting out the center.
 */
function NodeBorderRing({
  color, glow, speed, radius = 12, borderWidth = 2,
}: {
  color: string; glow: string; speed: string;
  radius?: number; borderWidth?: number;
}) {
  injectBorderAnimStyle();
  return (
    <>
      {/* Outer glow halo — static pulsing box-shadow lookalike */}
      <div style={{
        position: 'absolute', inset: -borderWidth - 2,
        borderRadius: radius + borderWidth + 2,
        boxShadow: `0 0 18px 4px ${glow}, 0 0 36px 8px ${glow}40`,
        pointerEvents: 'none', zIndex: 0,
        animation: `nodeGlowPulse ${speed} ease-in-out infinite`,
      }} />
      {/* Rotating conic-gradient ring */}
      <div style={{
        position: 'absolute', inset: -borderWidth,
        borderRadius: radius + borderWidth,
        overflow: 'hidden',
        pointerEvents: 'none', zIndex: 1,
      }}>
        <div style={{
          position: 'absolute', inset: -'50%' as any,
          // Oversized square so the conic fills corners
          width: '200%', height: '200%',
          top: '-50%', left: '-50%',
          background: `conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 240deg,
            ${color}cc 300deg,
            ${color} 340deg,
            ${color}cc 360deg
          )`,
          animation: `nodeRingRotate ${speed} linear infinite`,
          transformOrigin: '50% 50%',
        }} />
        {/* Inner cutout — matches node background to mask interior */}
        <div style={{
          position: 'absolute',
          inset: borderWidth,
          borderRadius: radius,
          background: 'linear-gradient(135deg, #0d0d1a 0%, #111827 100%)',
        }} />
      </div>
    </>
  );
}

function StatusIcon({ status }: { status?: NodeStatus }) {
  if (!status || status === 'idle') return <CircleDot className="w-3.5 h-3.5 text-slate-500" />;
  if (status === 'running') return <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin" />;
  if (status === 'done') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
  return <XCircle className="w-3.5 h-3.5 text-red-400" />;
}

// ─── Smart dependency panel ──────────────────────────────────────────────────

function DependencyPanel({ nodeId, nodeType }: { nodeId: string; nodeType: string }) {
  const dep = useNodeDependency(nodeId);
  const schema = NODE_SCHEMA[nodeType];
  const [expanded, setExpanded] = useState(true);

  // Only show for nodes that have declared dependencies
  if (!dep || !schema || schema.inputs.length === 0) return null;
  // If all required inputs are met and no optionals are missing → hide
  if (dep.isReady && dep.missing.length === 0) return null;

  const hasBlockers = dep.missing.some(r => r.required);
  const requiredMissing = dep.missing.filter(r => r.required);
  const optionalMissing = dep.missing.filter(r => !r.required);
  const met = dep.met;

  // Output kind badge for "what this produces"
  const outputKind = schema.outputKind ? OUTPUT_KIND_META[schema.outputKind] : null;

  const headerColor = hasBlockers ? '#f97316' : '#f59e0b';
  const headerBg = hasBlockers ? 'rgba(249,115,22,0.08)' : 'rgba(245,158,11,0.08)';
  const headerBorder = hasBlockers ? 'rgba(249,115,22,0.25)' : 'rgba(245,158,11,0.25)';

  return (
    <div style={{
      marginTop: 6,
      borderRadius: 8,
      background: headerBg,
      border: `1px solid ${headerBorder}`,
      overflow: 'hidden',
      fontSize: 10,
    }}>
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 8px', background: 'transparent', border: 'none',
          cursor: 'pointer', color: headerColor, fontWeight: 700,
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 10 }}>{hasBlockers ? '⚠️' : '💡'}</span>
        <span style={{ flex: 1 }}>
          {hasBlockers
            ? `${requiredMissing.length} required input${requiredMissing.length > 1 ? 's' : ''} missing`
            : `${optionalMissing.length} optional input${optionalMissing.length > 1 ? 's' : ''} available`}
        </span>
        {outputKind && !hasBlockers && (
          <span style={{
            fontSize: 8, padding: '1px 4px', borderRadius: 3,
            background: `${outputKind.color}22`, color: outputKind.color,
            border: `1px solid ${outputKind.color}40`, fontWeight: 700,
          }}>
            {outputKind.icon} {outputKind.label}
          </span>
        )}
        <ChevronDown
          size={10}
          style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}
        />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>

          {/* Required missing */}
          {requiredMissing.map(req => (
            <div key={req.nodeType} style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              padding: '5px 7px', borderRadius: 6,
              background: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.3)',
            }}>
              <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{req.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 700, color: req.color }}>{req.label}</span>
                  <span style={{
                    fontSize: 8, padding: '0 3px', borderRadius: 2,
                    background: 'rgba(249,115,22,0.2)', color: '#f97316',
                    fontWeight: 700, border: '1px solid rgba(249,115,22,0.4)',
                  }}>REQUERIDO</span>
                </div>
                <p style={{ color: '#94a3b8', margin: '2px 0 0', lineHeight: 1.3 }}>{req.reason}</p>
              </div>
            </div>
          ))}

          {/* Optional missing */}
          {optionalMissing.map(req => (
            <div key={req.nodeType} style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              padding: '5px 7px', borderRadius: 6,
              background: 'rgba(245,158,11,0.07)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}>
              <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{req.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontWeight: 600, color: req.color }}>{req.label}</span>
                  <span style={{
                    fontSize: 8, padding: '0 3px', borderRadius: 2,
                    background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                    fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)',
                  }}>OPCIONAL</span>
                </div>
                <p style={{ color: '#64748b', margin: '2px 0 0', lineHeight: 1.3 }}>{req.reason}</p>
              </div>
            </div>
          ))}

          {/* Already connected (met) */}
          {met.map(req => (
            <div key={req.nodeType} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 7px', borderRadius: 6,
              background: 'rgba(34,197,94,0.07)',
              border: '1px solid rgba(34,197,94,0.2)',
            }}>
              <span style={{ fontSize: 13, lineHeight: 1 }}>{req.icon}</span>
              <span style={{ fontWeight: 600, color: '#4ade80', flex: 1 }}>{req.label}</span>
              <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 700 }}>✓ Connected</span>
            </div>
          ))}

          {/* Output info */}
          {!hasBlockers && outputKind && (
            <div style={{
              marginTop: 2, padding: '4px 7px', borderRadius: 6,
              background: `${outputKind.color}10`,
              border: `1px solid ${outputKind.color}30`,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ fontSize: 12 }}>{outputKind.icon}</span>
              <span style={{ color: outputKind.color, fontWeight: 600 }}>
                Produces: {outputKind.label}
              </span>
              <span style={{ color: '#475569', marginLeft: 'auto', fontSize: 9 }}>→ connect to downstream</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function BaseNode({
  nodeProps,
  variant,
  icon: Icon,
  title,
  subtitle,
  hasInput = true,
  hasOutput = true,
  children,
}: BaseNodeProps) {
  const { id: nodeId, type: nodeType, selected, data } = nodeProps;
  const status = (data.status as NodeStatus | undefined) ?? 'idle';
  const variantColor = VARIANT_COLORS[variant];
  const statusStyle = STATUS_STYLES[status];
  const borderAnim = BORDER_ANIM[status];
  const dep = useNodeDependency(nodeId);

  // Urgent border when required inputs are missing
  const hasMissingRequired = dep?.missing.some(r => r.required) ?? false;
  const borderColor =
    hasMissingRequired && status === 'idle'
      ? 'rgba(249,115,22,0.7)'
      : statusStyle.border || (selected ? variantColor.border : `${variantColor.border}60`);

  const boxShadow =
    borderAnim.active
      ? 'none'  // ring handles the glow
      : hasMissingRequired && status === 'idle'
      ? '0 0 12px rgba(249,115,22,0.3), 0 0 0 1px rgba(249,115,22,0.5)'
      : selected
      ? `0 0 14px ${variantColor.glow}`
      : 'none';

  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{ position: 'relative', width: 220 }}
    >
      {/* Animated traveling-light border — active on running/done/error */}
      {borderAnim.active && (
        <NodeBorderRing
          color={borderAnim.color}
          glow={borderAnim.glow}
          speed={borderAnim.speed}
          radius={12}
          borderWidth={2}
        />
      )}

      {/* Handles positioned on motion.div so they aren't clipped by card overflow:hidden */}
      {hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          style={{
            background: variantColor.border,
            width: 10, height: 10,
            border: '2px solid #0d0d1a',
            left: -6, zIndex: 10,
            boxShadow: `0 0 6px ${variantColor.border}`,
          }}
        />
      )}
      {hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          style={{
            background: variantColor.border,
            width: 10, height: 10,
            border: '2px solid #0d0d1a',
            right: -6, zIndex: 10,
            boxShadow: `0 0 6px ${variantColor.border}`,
          }}
        />
      )}

      {/* Node card */}
      <div style={{
        position: 'relative', zIndex: 2,
        background: 'linear-gradient(135deg, #0d0d1a 0%, #111827 100%)',
        border: borderAnim.active ? 'none' : `1.5px solid ${borderColor}`,
        borderRadius: 12,
        boxShadow: borderAnim.active ? '0 4px 24px rgba(0,0,0,0.5)' : boxShadow,
        transition: 'box-shadow 0.3s, border-color 0.3s',
        cursor: 'grab',
        userSelect: 'none',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-t-xl"
          style={{ borderBottom: `1px solid ${variantColor.border}25`, background: variantColor.badge }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${variantColor.border}25` }}
          >
            <Icon className="w-4 h-4" style={{ color: variantColor.icon }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate leading-tight">{title}</p>
            {subtitle && (
              <p className="text-[10px] text-slate-400 truncate leading-tight">{subtitle}</p>
            )}
          </div>
          {/* Ready indicator */}
          {dep && (dep.isReady
            ? <span title="All required inputs connected" style={{ fontSize: 10 }}>✅</span>
            : hasMissingRequired
            ? <span title="Missing required inputs" style={{ fontSize: 10, animation: 'pulse 1.5s infinite' }}>⚠️</span>
            : <StatusIcon status={status} />
          )}
          {!dep && <StatusIcon status={status} />}
        </div>

        {/* Body */}
        <div className="px-3 py-2.5 space-y-1.5 min-h-[40px]">
          {children}

          {/* Smart dependency panel */}
          <DependencyPanel nodeId={nodeId} nodeType={nodeType ?? ''} />

          {/* Output preview */}
          {status === 'done' && data.output && Object.keys(data.output).length > 0 && (
            <div
              className="text-[10px] text-emerald-300 rounded-md px-2 py-1.5 truncate"
              style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              ✓ {Object.keys(data.output)[0]}: {String(Object.values(data.output)[0]).slice(0, 30)}…
            </div>
          )}
          {status === 'error' && data.error && (
            <div
              className="text-[10px] text-red-300 rounded-md px-2 py-1.5 break-words"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              ✕ {data.error.slice(0, 60)}
            </div>
          )}
        </div>
      </div>{/* /card */}
    </motion.div>
  );
}
