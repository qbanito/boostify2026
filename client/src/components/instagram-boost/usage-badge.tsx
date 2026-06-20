/**
 * Small badge showing remaining uses for a tool category.
 * Shows green when plenty left, amber when low, red when exhausted.
 */
import { Badge } from '../ui/badge';
import { Zap, Lock } from 'lucide-react';
import type { ToolCategory } from '../../hooks/use-ig-boost-limits';

interface UsageBadgeProps {
  remaining: number;
  display: string;
  category: ToolCategory;
  plan: string;
}

export function UsageBadge({ remaining, display, plan }: UsageBadgeProps) {
  if (plan === 'premium') {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-500 bg-amber-500/5">
        <Zap className="w-2.5 h-2.5" /> Unlimited
      </Badge>
    );
  }

  if (remaining <= 0) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 border-red-500/30 text-red-500 bg-red-500/5">
        <Lock className="w-2.5 h-2.5" /> {display} — Upgrade
      </Badge>
    );
  }

  if (remaining <= 2) {
    return (
      <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/30 text-amber-600 bg-amber-500/5">
        <Zap className="w-2.5 h-2.5" /> {display} left today
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-[10px] gap-1 border-green-500/30 text-green-600 bg-green-500/5">
      <Zap className="w-2.5 h-2.5" /> {display} today
    </Badge>
  );
}
