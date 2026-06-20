import { useState } from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';
import { Zap, Copy, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';

type HookType = 'curiosity' | 'status' | 'emotional' | 'community' | 'mixed';
type Platform = 'tiktok' | 'instagram' | 'youtube' | 'facebook' | 'threads';

interface HookItem {
  id: string;
  text: string;
  type: Exclude<HookType, 'mixed'>;
  score: number;
  platform: Platform;
}

interface HookGeneratorProps {
  artistId: number;
  songs?: Array<{ id: number; title: string }>;
  onSaveWinner?: (hook: string, platform: Platform) => void;
}

const TYPE_COLORS: Record<string, string> = {
  curiosity: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
  status: 'border-yellow-500/40 text-yellow-300 bg-yellow-500/10',
  emotional: 'border-pink-500/40 text-pink-300 bg-pink-500/10',
  community: 'border-green-500/40 text-green-300 bg-green-500/10',
};

const PLATFORMS: Platform[] = ['instagram', 'tiktok', 'youtube', 'facebook', 'threads'];
const HOOK_TYPES: HookType[] = ['mixed', 'curiosity', 'status', 'emotional', 'community'];
const COUNT_OPTIONS = [5, 8, 10];

export function HookGenerator({ artistId, songs = [], onSaveWinner }: HookGeneratorProps) {
  const { toast } = useToast();
  const [platform, setPlatform] = useState<Platform>('instagram');
  const [hookType, setHookType] = useState<HookType>('mixed');
  const [selectedSong, setSelectedSong] = useState<number | undefined>();
  const [count, setCount] = useState(10);
  const [hooks, setHooks] = useState<HookItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/audience-capture/hooks', {
        artistId,
        songId: selectedSong,
        platform,
        count,
        hookType,
      }) as Promise<{ hooks: HookItem[] }>,
    onSuccess: (data) => {
      setHooks(data.hooks ?? []);
    },
    onError: (err: any) => {
      toast({ title: 'Error generating hooks', description: err.message, variant: 'destructive' });
    },
  });

  const saveWinnerMutation = useMutation({
    mutationFn: (hook: HookItem) =>
      apiRequest('POST', '/api/audience-capture/memory', {
        artistId,
        type: 'winning_hook',
        value: hook.text,
        platform: hook.platform,
        score: hook.score,
        tags: [hook.type],
      }),
    onSuccess: (_, hook) => {
      toast({ title: '✓ Hook saved as Winner', description: 'Added to your winning patterns.' });
      onSaveWinner?.(hook.text, hook.platform);
    },
  });

  const saveLossMutation = useMutation({
    mutationFn: (hook: HookItem) =>
      apiRequest('POST', '/api/audience-capture/memory', {
        artistId,
        type: 'losing_hook',
        value: hook.text,
        platform: hook.platform,
        score: hook.score,
        tags: [hook.type],
      }),
    onSuccess: () => {
      toast({ title: 'Hook marked as weak', description: 'Will be avoided in future generations.' });
    },
  });

  function copyHook(hook: HookItem) {
    navigator.clipboard.writeText(hook.text).catch(() => {});
    setCopiedId(hook.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="grid grid-cols-2 gap-3">
        {/* Platform */}
        <div>
          <label className="text-[11px] text-white/50 mb-1.5 block">Platform</label>
          <div className="flex flex-wrap gap-1">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all capitalize ${
                  platform === p
                    ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                    : 'bg-white/5 border-white/10 text-white/40 hover:border-white/25'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Hook type */}
        <div>
          <label className="text-[11px] text-white/50 mb-1.5 block">Hook Type</label>
          <div className="flex flex-wrap gap-1">
            {HOOK_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setHookType(t)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all capitalize ${
                  hookType === t
                    ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                    : 'bg-white/5 border-white/10 text-white/40 hover:border-white/25'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Song selector + count */}
      <div className="flex items-end gap-3">
        {songs.length > 0 && (
          <div className="flex-1">
            <label className="text-[11px] text-white/50 mb-1.5 block">Song (optional)</label>
            <Select
              value={selectedSong ? String(selectedSong) : '__none__'}
              onValueChange={(v) => setSelectedSong(v === '__none__' ? undefined : parseInt(v))}
            >
              <SelectTrigger className="w-full h-9 bg-zinc-900 border-white/10 text-white/80 text-sm focus:ring-orange-500/40 focus:border-orange-500/40">
                <SelectValue placeholder="No specific song" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-white/10 text-white">
                <SelectItem value="__none__" className="text-white/50 focus:bg-white/10 focus:text-white">
                  No specific song
                </SelectItem>
                {songs.map((s) => (
                  <SelectItem
                    key={s.id}
                    value={String(s.id)}
                    className="text-white/80 focus:bg-orange-500/20 focus:text-orange-200"
                  >
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <label className="text-[11px] text-white/50 mb-1.5 block">Count</label>
          <div className="flex gap-1">
            {COUNT_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCount(c)}
                className={`w-10 h-9 rounded-lg text-sm font-bold border transition-all ${
                  count === c
                    ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                    : 'bg-white/5 border-white/10 text-white/50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Generate button */}
      <Button
        onClick={() => generateMutation.mutate()}
        disabled={generateMutation.isPending}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold h-11"
      >
        {generateMutation.isPending ? (
          <><Loader2 size={16} className="animate-spin mr-2" /> Generating {count} hooks…</>
        ) : (
          <><Zap size={16} className="mr-2" /> Generate {count} Hooks</>
        )}
      </Button>

      {/* Hooks list */}
      {hooks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">{hooks.length} hooks generated</span>
            <span className="text-[10px] text-white/30">Click thumbs to train memory</span>
          </div>
          {hooks.map((hook, i) => (
            <div
              key={hook.id}
              className="group rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:border-white/20 transition-all"
            >
              <div className="flex items-start gap-3">
                <span className="text-[11px] text-white/20 font-mono mt-0.5 flex-shrink-0 w-4">{i + 1}</span>
                <p className="flex-1 text-sm text-white/90 leading-relaxed">{hook.text}</p>
              </div>
              <div className="flex items-center gap-2 mt-2 pl-7">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-0.5 ${TYPE_COLORS[hook.type] ?? 'border-white/20 text-white/50'}`}
                >
                  {hook.type}
                </Badge>
                {/* Score mini bar */}
                <div className="flex items-center gap-1.5 flex-1">
                  <div className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-400"
                      style={{ width: `${hook.score}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-orange-400 font-bold">{hook.score}</span>
                </div>
                {/* Actions */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={() => copyHook(hook)}
                    title="Copy"
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                  >
                    {copiedId === hook.id ? <span className="text-[9px]">✓</span> : <Copy size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => saveWinnerMutation.mutate(hook)}
                    title="Mark as winner"
                    className="w-7 h-7 rounded-lg bg-green-500/10 hover:bg-green-500/20 flex items-center justify-center text-green-400 transition-all"
                  >
                    <ThumbsUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => saveLossMutation.mutate(hook)}
                    title="Mark as weak"
                    className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center text-red-400 transition-all"
                  >
                    <ThumbsDown size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
