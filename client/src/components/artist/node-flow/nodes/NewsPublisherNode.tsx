import { NodeProps } from '@xyflow/react';
import { Newspaper } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { NodeFlowData } from '../useFlowStore';

export function NewsPublisherNode(props: NodeProps<NodeFlowData>) {
  return (
    <BaseNode nodeProps={props} variant="output" icon={Newspaper} title="News Publisher" subtitle="POST /api/artist-news" hasOutput={false}>
      <p className="text-[10px] text-slate-400">Publishes content to the Boostify news feed.</p>
    </BaseNode>
  );
}
