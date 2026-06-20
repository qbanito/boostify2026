/**
 * BOOSTIFY NODE FLOW — NodeBorderRing (shared utility)
 * Traveling-light animated border ring for custom node components.
 * Injects keyframes once, renders an absolutely-positioned rotating conic-gradient.
 *
 * Status color convention:
 *   active / done   → green  (#22c55e)
 *   running / busy  → amber  (#fbbf24)
 *   error           → red    (#ef4444)
 *   paused / idle   → no ring (null)
 */

let _injected = false;

export function injectNodeRingKeyframes() {
  if (_injected || typeof document === 'undefined') return;
  _injected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes nodeRingRotate {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    @keyframes nodeRingPulse {
      0%, 100% { opacity: 0.9; }
      50%       { opacity: 0.45; }
    }
  `;
  document.head.appendChild(s);
}

export type NodeRingStatus = 'active' | 'running' | 'paused' | 'error' | 'off';

const STATUS_RING_CONFIG: Record<NodeRingStatus, { color: string; glow: string; speed: string } | null> = {
  active:  { color: '#22c55e', glow: 'rgba(34,197,94,0.65)',   speed: '2.4s' },
  running: { color: '#fbbf24', glow: 'rgba(251,191,36,0.65)',  speed: '1.4s' },
  paused:  { color: '#f59e0b', glow: 'rgba(245,158,11,0.45)',  speed: '3.5s' },
  error:   { color: '#ef4444', glow: 'rgba(239,68,68,0.7)',    speed: '0.85s' },
  off:     null,
};

export function getNodeRingConfig(status: NodeRingStatus) {
  return STATUS_RING_CONFIG[status];
}

interface NodeBorderRingProps {
  status: NodeRingStatus;
  radius?: number;        // border-radius of the node in px
  borderWidth?: number;   // ring thickness in px
  /** Background color of the node interior (used for the cutout) */
  bg?: string;
}

export function NodeBorderRing({
  status, radius = 14, borderWidth = 2,
  bg = 'linear-gradient(145deg, #0c0f1e, #080b16)',
}: NodeBorderRingProps) {
  injectNodeRingKeyframes();
  const cfg = getNodeRingConfig(status);
  if (!cfg) return null;

  const { color, glow, speed } = cfg;

  return (
    <>
      {/* Outer pulsing halo */}
      <div style={{
        position: 'absolute',
        inset: -(borderWidth + 3),
        borderRadius: radius + borderWidth + 3,
        pointerEvents: 'none', zIndex: 0,
        boxShadow: `0 0 20px 5px ${glow}, 0 0 40px 10px ${glow}50`,
        animation: `nodeRingPulse ${speed} ease-in-out infinite`,
      }} />

      {/* Rotating conic arc ring */}
      <div style={{
        position: 'absolute',
        inset: -borderWidth,
        borderRadius: radius + borderWidth,
        overflow: 'hidden',
        pointerEvents: 'none', zIndex: 1,
      }}>
        {/* Rotator — must be oversized to cover corners */}
        <div style={{
          position: 'absolute',
          width: '200%', height: '200%',
          top: '-50%', left: '-50%',
          background: `conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 230deg,
            ${color}99 280deg,
            ${color} 330deg,
            ${color}99 360deg
          )`,
          animation: `nodeRingRotate ${speed} linear infinite`,
          transformOrigin: '50% 50%',
        }} />
        {/* Interior cutout so only the ring border is visible */}
        <div style={{
          position: 'absolute',
          inset: borderWidth,
          borderRadius: radius,
          background: bg,
        }} />
      </div>
    </>
  );
}
