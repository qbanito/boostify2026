import { NodeProps } from '@xyflow/react';
import { UserCog } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { NodeFlowData } from '../useFlowStore';

export function ProfileUpdateNode(props: NodeProps<NodeFlowData>) {
  return (
    <BaseNode nodeProps={props} variant="output" icon={UserCog} title="Profile Update" subtitle="PATCH /api/artist/:id" hasOutput={false}>
      <p className="text-[10px] text-slate-400">Saves biography or images back to the artist profile.</p>
    </BaseNode>
  );
}
