import { NodeProps } from '@xyflow/react';
import { Mic2 } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { NodeFlowData } from '../useFlowStore';

export function KaraokeNode(props: NodeProps<NodeFlowData>) {
  return (
    <BaseNode nodeProps={props} variant="process" icon={Mic2} title="Karaoke" subtitle="POST /api/karaoke/:songId/generate">
      <p className="text-[10px] text-slate-400">Strips vocals and generates lyrics overlay.</p>
    </BaseNode>
  );
}
