interface ScoreGaugeProps {
  score: number;        // 0-100
  size?: number;        // svg size px (default 120)
  label?: string;
  showLabel?: boolean;
}

/**
 * Circular gauge — animates on first render via stroke-dashoffset.
 */
export function ScoreGauge({ score, size = 120, label = 'Score', showLabel = true }: ScoreGaugeProps) {
  const center = size / 2;
  const strokeW = size * 0.08;
  const radius = center - strokeW;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;
  const empty = circumference - filled;

  // Color by score
  const color =
    score >= 80 ? '#22c55e'  // green
    : score >= 65 ? '#f97316' // orange
    : '#ef4444';              // red

  const scoreFontSize = size * 0.22;
  const labelFontSize = size * 0.10;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Progress */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${empty}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      {/* Text overlay — rotated back */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{ width: size, height: size, marginTop: -size }}
      >
        <span
          className="font-black tabular-nums leading-none"
          style={{ fontSize: scoreFontSize, color }}
        >
          {score}
        </span>
        {showLabel && (
          <span
            className="text-white/40 font-medium leading-none mt-0.5"
            style={{ fontSize: labelFontSize }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── ContentScorePanel ────────────────────────────────────────────────────────

interface ContentScorePanelProps {
  score: {
    hookStrength: number;
    retentionPotential: number;
    identityAlignment: number;
    sharePotential: number;
    commentTrigger: number;
    conversionIntent: number;
    platformFit: number;
    overallScore: number;
  };
  compact?: boolean;
}

const METRICS: Array<{ key: keyof ContentScorePanelProps['score']; label: string; icon: string }> = [
  { key: 'hookStrength', label: 'Hook', icon: '⚡' },
  { key: 'retentionPotential', label: 'Retention', icon: '🔁' },
  { key: 'identityAlignment', label: 'Identity', icon: '🎯' },
  { key: 'sharePotential', label: 'Share', icon: '📤' },
  { key: 'commentTrigger', label: 'Comment', icon: '💬' },
  { key: 'conversionIntent', label: 'Convert', icon: '💰' },
  { key: 'platformFit', label: 'Platform', icon: '📱' },
];

function scoreColor(v: number) {
  if (v >= 80) return 'bg-green-500';
  if (v >= 65) return 'bg-orange-500';
  return 'bg-red-500';
}

function scoreTextColor(v: number) {
  if (v >= 80) return 'text-green-400';
  if (v >= 65) return 'text-orange-400';
  return 'text-red-400';
}

export function ContentScorePanel({ score, compact = false }: ContentScorePanelProps) {
  const overall = score.overallScore;
  const overallColor = overall >= 80 ? '#22c55e' : overall >= 65 ? '#f97316' : '#ef4444';

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-10 h-10 rounded-full border-2 flex items-center justify-center font-black text-sm"
          style={{ borderColor: overallColor, color: overallColor }}
        >
          {overall}
        </div>
        <div className="flex gap-1 flex-wrap">
          {METRICS.map((m) => (
            <div key={m.key} className="text-center" title={m.label}>
              <div className="text-[9px] text-white/40">{m.icon}</div>
              <div className={`text-[10px] font-bold ${scoreTextColor(score[m.key] as number)}`}>
                {score[m.key]}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4">
      {/* Overall */}
      <div className="flex items-center gap-4">
        <div className="relative flex items-center justify-center">
          <ScoreGauge score={overall} size={100} label="Overall" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white mb-0.5">Content Capture Score</div>
          <div className={`text-[11px] font-medium ${overall >= 80 ? 'text-green-400' : overall >= 65 ? 'text-orange-400' : 'text-red-400'}`}>
            {overall >= 80 ? '✓ Ready to publish' : overall >= 65 ? '⚠ Needs improvement' : '✕ Regenerate recommended'}
          </div>
          {overall < 80 && (
            <div className="text-[10px] text-white/30 mt-1">Score below 80 — AI will auto-regenerate</div>
          )}
        </div>
      </div>

      {/* Metrics bars */}
      <div className="space-y-2">
        {METRICS.map((m) => {
          const val = score[m.key] as number;
          return (
            <div key={m.key} className="flex items-center gap-2">
              <span className="text-[11px] w-20 text-white/50">{m.icon} {m.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${scoreColor(val)}`}
                  style={{ width: `${val}%` }}
                />
              </div>
              <span className={`text-[11px] font-bold w-7 text-right ${scoreTextColor(val)}`}>{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
