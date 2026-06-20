import { NodeProps } from '@xyflow/react';
import { CreditCard } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { NodeFlowData } from '../useFlowStore';

export function ShareCardNode(props: NodeProps<NodeFlowData>) {
  const { data } = props;
  const cardUrl = (data.output as any)?.cardPngDataUrl;
  return (
    <BaseNode nodeProps={props} variant="process" icon={CreditCard} title="Share Card" subtitle="Canvas — local generation">
      <p className="text-[10px] text-slate-400">Generates PNG share card from name, title & cover.</p>
      {data.status === 'done' && cardUrl && (
        <img src={cardUrl} alt="share card" className="w-full h-20 object-cover rounded-md mt-1 border border-purple-500/30" />
      )}
    </BaseNode>
  );
}
