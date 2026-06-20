import { TOKENS } from './tokens';

interface SparklineProps {
  data: { x: number; y: number }[];
  color?: string;
  height?: number;
  width?: number | string;
  fill?: boolean;
  strokeWidth?: number;
}

export function Sparkline({
  data,
  color = TOKENS.ORANGE,
  height = 40,
  width = '100%',
  fill = true,
  strokeWidth = 1.6,
}: SparklineProps) {
  if (!data.length) return null;
  const ys = data.map((d) => d.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = maxY - minY || 1;
  const w = 100;
  const h = 40;
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d.y - minY) / rangeY) * h;
    return [x, y] as const;
  });
  const path = points
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(' ');
  const area = `${path} L${w},${h} L0,${h} Z`;
  const gradId = `spark-grad-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      width={width}
      height={height}
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gradId})`} />}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
