import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { SectionCard } from '../shared/SectionCard';
import { TOKENS, FONT_MONO } from '../shared/tokens';
import { masterJson } from '../../../data/mockArtistAcquisition';

export function MasterJsonCard({ data }: { data?: Record<string, any> | null }) {
  const [copied, setCopied] = useState(false);
  const payload = data || masterJson;
  const json = JSON.stringify(payload, null, 2);

  const onCopy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <SectionCard
      number="03"
      title="Master JSON"
      action={
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 text-[11.5px] px-2.5 py-1 rounded-md transition-colors hover:bg-white/5"
          style={{ color: TOKENS.MUTED, border: `1px solid ${TOKENS.BORDER}` }}
        >
          {copied ? (
            <>
              <Check size={11} style={{ color: TOKENS.POSITIVE }} />
              Copied
            </>
          ) : (
            <>
              <Copy size={11} />
              Copy
            </>
          )}
        </button>
      }
      bodyClassName="!p-0"
    >
      <pre
        className="overflow-auto px-5 py-4 text-[11.5px] leading-[1.55] custom-scroll"
        style={{
          fontFamily: FONT_MONO,
          color: TOKENS.MUTED,
          maxHeight: 280,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.01), transparent)',
        }}
      >
        <Highlighted lines={json.split('\n')} />
      </pre>
    </SectionCard>
  );
}

function Highlighted({ lines }: { lines: string[] }) {
  return (
    <code style={{ display: 'block' }}>
      {lines.map((line, i) => (
        <div key={i} className="flex">
          <span
            className="select-none pr-3 text-right shrink-0"
            style={{ color: TOKENS.MUTED_2, width: 22 }}
          >
            {i + 1}
          </span>
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {colorize(line)}
          </span>
        </div>
      ))}
    </code>
  );
}

function colorize(line: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let rest = line;
  let key = 0;
  // Match key: "..." :
  const keyRe = /^(\s*)("[^"]+")(\s*:\s*)/;
  const km = rest.match(keyRe);
  if (km) {
    parts.push(km[1]);
    parts.push(
      <span key={key++} style={{ color: TOKENS.ORANGE_GLOW }}>
        {km[2]}
      </span>
    );
    parts.push(km[3]);
    rest = rest.slice(km[0].length);
  }
  // Highlight strings, numbers, booleans, null in remainder
  const tokenRe = /("[^"]*")|(-?\d+\.?\d*)|(true|false|null)/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(rest))) {
    if (m.index > lastIdx) parts.push(rest.slice(lastIdx, m.index));
    if (m[1]) {
      parts.push(
        <span key={key++} style={{ color: '#cbd5e1' }}>
          {m[1]}
        </span>
      );
    } else if (m[2]) {
      parts.push(
        <span key={key++} style={{ color: TOKENS.POSITIVE }}>
          {m[2]}
        </span>
      );
    } else if (m[3]) {
      parts.push(
        <span key={key++} style={{ color: '#a78bfa' }}>
          {m[3]}
        </span>
      );
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < rest.length) parts.push(rest.slice(lastIdx));
  return parts;
}
