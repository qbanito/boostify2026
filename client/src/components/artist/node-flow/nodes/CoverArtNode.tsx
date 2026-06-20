import { NodeProps } from '@xyflow/react';
import { Image } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { NodeFlowData } from '../useFlowStore';

export function CoverArtNode(props: NodeProps<NodeFlowData>) {
  const { data } = props;
  const imgUrl = (data.output as any)?.imageUrl;
  return (
    <BaseNode nodeProps={props} variant="process" icon={Image} title="Cover Art" subtitle="POST /api/generate/cover-art">
      <p className="text-[10px] text-slate-400">AI-generated cover art from artist style.</p>
      {data.status === 'done' && imgUrl && (
        <img src={imgUrl} alt="cover" className="w-full h-20 object-cover rounded-md mt-1 border border-purple-500/30" />
      )}
    </BaseNode>
  );
}
