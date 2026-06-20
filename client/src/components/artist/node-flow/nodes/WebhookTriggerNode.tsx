/**
 * BOOSTIFY NODE FLOW — WebhookTriggerNode
 * External HTTP trigger. Any POST to the displayed URL activates the workflow.
 * Generates a unique token per node and stores last trigger payload.
 */

import { useState, useCallback, useEffect } from 'react';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
import { Globe, Copy, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useFlowStore } from '../useFlowStore';
import { NodeBorderRing, type NodeRingStatus } from './NodeBorderRing';

function generateToken(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function WebhookTriggerNode({ id, data }: NodeProps) {
  const updateNodeData = useFlowStore(s => s.updateNodeData);
  const artistSlug = useFlowStore(s => s.artistSlug);

  const [token, setToken] = useState<string>(data?.webhookToken ?? '');
  const [copied, setCopied] = useState(false);

  // Generate token once on first mount if not set
  useEffect(() => {
    if (!token) {
      const t = generateToken();
      setToken(t);
      updateNodeData(id, { webhookToken: t });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const webhookUrl = token && artistSlug
    ? `${window.location.origin}/api/node-workflow/webhook/${artistSlug}/${token}`
    : '(save workflow to generate URL)';

  const handleCopy = useCallback(() => {
    if (!token) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [webhookUrl, token]);

  const handleRegenerate = useCallback(() => {
    const t = generateToken();
    setToken(t);
    updateNodeData(id, { webhookToken: t, lastTriggered: null, lastPayload: null });
  }, [id, updateNodeData]);

  const lastTriggered = data?.lastTriggered as string | null;
  const lastPayload = data?.lastPayload as string | null;

  const webhookRingStatus: NodeRingStatus = token ? 'active' : 'paused';
  const webhookBg = 'linear-gradient(145deg, #0c1120, #080e1c)';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ position: 'relative', width: 268, fontFamily: "'Inter', sans-serif" }}
    >
      <NodeBorderRing status={webhookRingStatus} radius={14} borderWidth={2} bg={webhookBg} />

      {/* Output handle — outside card so overflow:hidden doesn't clip it */}
      <Handle type="source" position={Position.Right}
        style={{ background: '#06b6d4', width: 10, height: 10, border: '2px solid #080e1c', zIndex: 10 }} />

      <div style={{
        position: 'relative', zIndex: 2,
        width: '100%',
        background: webhookBg,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        background: 'rgba(6,182,212,0.07)',
        borderBottom: '1px solid rgba(6,182,212,0.15)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'rgba(6,182,212,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Globe size={15} color="#06b6d4" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0' }}>Webhook Trigger</div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
            {lastTriggered
              ? `Last triggered: ${new Date(lastTriggered).toLocaleString()}`
              : 'Not triggered yet'}
          </div>
        </div>
        {/* Listening indicator */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: token ? '#22c55e' : '#475569',
          boxShadow: token ? '0 0 6px rgba(34,197,94,0.7)' : 'none',
          animation: token ? 'pulse 2s ease-in-out infinite' : 'none',
        }} />
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Webhook URL */}
        <div>
          <label style={labelStyle}>Webhook URL (POST)</label>
          <div style={{
            marginTop: 4, padding: '6px 8px',
            background: 'rgba(6,182,212,0.06)',
            border: '1px solid rgba(6,182,212,0.2)',
            borderRadius: 7, display: 'flex', gap: 6, alignItems: 'center',
          }}>
            <span style={{
              flex: 1, fontSize: 8, color: '#22d3ee',
              wordBreak: 'break-all', lineHeight: 1.4,
              fontFamily: 'monospace',
            }}>
              {webhookUrl}
            </span>
            <button onClick={handleCopy} title="Copy URL" style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: copied ? '#4ade80' : '#06b6d4', flexShrink: 0,
              display: 'flex', alignItems: 'center',
            }}>
              {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
            </button>
          </div>
        </div>

        {/* Instruction */}
        <div style={{
          padding: '6px 8px', borderRadius: 7, fontSize: 9, color: '#64748b',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          lineHeight: 1.5,
        }}>
          Send a <span style={{ color: '#22d3ee', fontWeight: 700 }}>POST</span> request to the URL above to trigger this workflow. Payload (JSON) is passed to connected nodes.
        </div>

        {/* Last payload */}
        {lastPayload && (
          <div>
            <label style={labelStyle}>Last Payload</label>
            <div style={{
              marginTop: 4, padding: '5px 8px',
              background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.12)',
              borderRadius: 7, fontFamily: 'monospace', fontSize: 8, color: '#7dd3fc',
              maxHeight: 60, overflow: 'auto', wordBreak: 'break-all',
            }}>
              {lastPayload}
            </div>
          </div>
        )}

        {/* Regenerate token */}
        <button onClick={handleRegenerate} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          padding: '6px 0', borderRadius: 8, border: '1px solid rgba(6,182,212,0.2)',
          cursor: 'pointer', fontWeight: 700, fontSize: 9, letterSpacing: '0.04em',
          background: 'transparent', color: '#06b6d4',
        }}>
          <RefreshCw size={10} /> Regenerate Token
        </button>
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }`}</style>
      </div>{/* /card */}
    </motion.div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, color: '#64748b', fontWeight: 700,
  letterSpacing: '0.06em', textTransform: 'uppercase',
};
