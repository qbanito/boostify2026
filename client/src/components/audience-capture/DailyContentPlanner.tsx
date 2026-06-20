import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';
import { CalendarDays, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

interface DailyContentPlannerProps {
  artistId: number;
}

interface PlanItem {
  label: string;
  key: string;
  emoji: string;
  description: string;
  recommended?: boolean;
}

const PLAN_ITEMS: PlanItem[] = [
  { key: 'hookTests', label: 'Hook Tests', emoji: '⚡', description: 'Test variations of your hook' },
  { key: 'shortReels', label: 'Short Reels', emoji: '🎬', description: '15-60s reels' },
  { key: 'stories', label: 'Stories', emoji: '📸', description: 'Stories across platforms' },
  { key: 'communityPosts', label: 'Community Posts', emoji: '💬', description: 'Engage your audience' },
  { key: 'conversionPosts', label: 'Conversion Posts', emoji: '💰', description: 'Drive to action' },
  { key: 'adVariations', label: 'Ad Variations', emoji: '📢', description: 'Paid campaign assets' },
  { key: 'retargetingAssets', label: 'Retargeting', emoji: '🎯', description: 'Re-engage warm audience' },
];

function today() {
  return new Date().toISOString().split('T')[0];
}

export function DailyContentPlanner({ artistId }: DailyContentPlannerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(today());

  const { data, isLoading } = useQuery({
    queryKey: [`/api/audience-capture/plan/${artistId}`, selectedDate],
    queryFn: () =>
      apiRequest('GET', `/api/audience-capture/plan/${artistId}?date=${selectedDate}`) as Promise<{ plan: any }>,
    staleTime: 60_000,
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/audience-capture/plan', { artistId, date: selectedDate }),
    onSuccess: () => {
      toast({ title: 'Daily plan generated', description: `Plan for ${selectedDate} is ready.` });
      queryClient.invalidateQueries({ queryKey: [`/api/audience-capture/plan/${artistId}`] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const plan = data?.plan;
  const totalPieces = plan
    ? PLAN_ITEMS.reduce((acc, item) => acc + (plan[item.key] ?? 0), 0)
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays size={16} className="text-orange-400" />
        <h3 className="text-sm font-semibold text-white">Daily Content Planner</h3>
      </div>

      {/* Date picker */}
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg text-sm text-white/80 px-3 h-9 focus:outline-none focus:border-orange-500/40"
        />
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {generateMutation.isPending ? (
            <><Loader2 size={14} className="animate-spin mr-1.5" /> Generating…</>
          ) : (
            <><Sparkles size={14} className="mr-1.5" /> {plan ? 'Regenerate' : 'Generate Plan'}</>
          )}
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={18} className="animate-spin text-orange-400" />
        </div>
      )}

      {plan && !isLoading && (
        <div className="space-y-3">
          {/* Summary chip */}
          <div className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-400" />
            <span className="text-xs text-green-400 font-medium">{totalPieces} pieces of content for {selectedDate}</span>
            <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full border ${
              plan.status === 'published' ? 'text-green-400 border-green-500/30 bg-green-500/10' :
              plan.status === 'approved' ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' :
              'text-white/40 border-white/15 bg-white/5'
            }`}>
              {plan.status}
            </span>
          </div>

          {/* Plan grid */}
          <div className="grid grid-cols-2 gap-2">
            {PLAN_ITEMS.map((item) => {
              const count: number = plan[item.key] ?? 0;
              return (
                <div
                  key={item.key}
                  className={`rounded-xl border p-3 ${
                    count > 0 ? 'border-white/12 bg-white/[0.04]' : 'border-white/5 bg-white/[0.01] opacity-40'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-lg leading-none mb-1">{item.emoji}</div>
                      <div className="text-[11px] font-medium text-white/80">{item.label}</div>
                      <div className="text-[10px] text-white/35">{item.description}</div>
                    </div>
                    <div
                      className={`text-2xl font-black tabular-nums ${
                        count >= 5 ? 'text-orange-400' : count >= 2 ? 'text-white/80' : 'text-white/30'
                      }`}
                    >
                      {count}
                    </div>
                  </div>
                  {/* mini bar */}
                  <div className="mt-2 h-1 rounded-full bg-white/8 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-500/70"
                      style={{ width: `${Math.min(100, (count / 10) * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Minimum vs ideal comparison */}
          <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <div className="text-[11px] text-white/40 mb-2 font-medium">Production Level</div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/30">Minimum (16/day)</span>
                  <span className="text-[10px] text-white/30">Ideal (38/day)</span>
                </div>
                <div className="h-2 rounded-full bg-white/8 relative overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all"
                    style={{ width: `${Math.min(100, (totalPieces / 38) * 100)}%` }}
                  />
                  {/* Minimum marker */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-white/30"
                    style={{ left: `${(16 / 38) * 100}%` }}
                  />
                </div>
              </div>
              <div className={`text-lg font-black tabular-nums ${totalPieces >= 16 ? 'text-green-400' : 'text-red-400'}`}>
                {totalPieces}
              </div>
            </div>
          </div>
        </div>
      )}

      {!plan && !isLoading && (
        <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
          <CalendarDays size={24} className="mx-auto mb-2 text-white/20" />
          <p className="text-sm text-white/30">No plan for this date yet.</p>
          <p className="text-[11px] text-white/20 mt-1">Click Generate Plan to create one with AI.</p>
        </div>
      )}
    </div>
  );
}
