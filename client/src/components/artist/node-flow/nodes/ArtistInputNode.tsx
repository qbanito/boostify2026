import { NodeProps } from '@xyflow/react';
import { User } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { NodeFlowData } from '../useFlowStore';

export function ArtistInputNode(props: NodeProps<NodeFlowData>) {
  const { data } = props;
  return (
    <BaseNode nodeProps={props} variant="input" icon={User} title="Artist Input" subtitle="Source: artist data" hasInput={false}>
      {data.artistSlug ? (
        <p className="text-[10px] text-blue-300 truncate">@{data.artistSlug}</p>
      ) : (
        <p className="text-[10px] text-slate-500 italic">No artist selected</p>
      )}
    </BaseNode>
  );
}
