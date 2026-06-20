import { NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';
import { BaseNode } from './BaseNode';
import type { NodeFlowData } from '../useFlowStore';

export function BioGeneratorNode(props: NodeProps<NodeFlowData>) {
  const { data } = props;
  return (
    <BaseNode nodeProps={props} variant="process" icon={FileText} title="Bio Generator" subtitle="POST /api/generate/biography">
      <p className="text-[10px] text-slate-400">Generates AI biography from artist name, genre & location.</p>
      {data.status === 'done' && (data.output as any)?.biography && (
        <p className="text-[10px] text-emerald-300 line-clamp-2 mt-1">{String((data.output as any).biography).slice(0, 80)}…</p>
      )}
    </BaseNode>
  );
}
