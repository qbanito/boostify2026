import { NodeProps } from '@xyflow/react';
import { Share2 } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { NodeFlowData } from '../useFlowStore';

export function SocialPostNode(props: NodeProps<NodeFlowData>) {
  const { data } = props;
  const caption = (data.output as any)?.caption;
  return (
    <BaseNode nodeProps={props} variant="process" icon={Share2} title="Social Post" subtitle="POST /api/generate/social-post">
      <p className="text-[10px] text-slate-400">Generates caption + hashtags from artist data.</p>
      {data.status === 'done' && caption && (
        <p className="text-[10px] text-emerald-300 line-clamp-2 mt-1">{String(caption).slice(0, 80)}…</p>
      )}
    </BaseNode>
  );
}
