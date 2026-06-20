import { useState } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Loader2, Save, Music2, User, BookOpen, Sunset, Users, ShoppingBag, Award } from 'lucide-react';

const PILLARS: Array<{
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  accent: string;
}> = [
  { key: 'music', label: 'Music', description: 'Songs, hooks, previews, remixes', icon: Music2, accent: 'text-orange-400 border-orange-500/40 bg-orange-500/10' },
  { key: 'character', label: 'Personaje', description: 'Figura pública, marca personal', icon: User, accent: 'text-violet-400 border-violet-500/40 bg-violet-500/10' },
  { key: 'story', label: 'Historia', description: 'Origen, propósito, evolución, conflicto', icon: BookOpen, accent: 'text-blue-400 border-blue-500/40 bg-blue-500/10' },
  { key: 'lifestyle', label: 'Lifestyle', description: 'Mundo aspiracional del artista', icon: Sunset, accent: 'text-amber-400 border-amber-500/40 bg-amber-500/10' },
  { key: 'community', label: 'Comunidad', description: 'Retos, preguntas, participación', icon: Users, accent: 'text-green-400 border-green-500/40 bg-green-500/10' },
  { key: 'product', label: 'Producto', description: 'Merch, membresías, tickets, licencias', icon: ShoppingBag, accent: 'text-pink-400 border-pink-500/40 bg-pink-500/10' },
  { key: 'authority', label: 'Autoridad', description: 'Símbolo cultural, movimiento', icon: Award, accent: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10' },
];

interface PillarState {
  key: string;
  isActive: boolean;
  weight: number;
  notes: string;
}

interface ContentPillarsEditorProps {
  artistId: number;
  initialPillars?: any[];
  onSaved?: () => void;
}

export function ContentPillarsEditor({ artistId, initialPillars = [], onSaved }: ContentPillarsEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pillars, setPillars] = useState<PillarState[]>(() =>
    PILLARS.map((p) => {
      const existing = initialPillars.find((ip: any) => ip.pillar === p.key);
      return {
        key: p.key,
        isActive: existing?.isActive ?? true,
        weight: existing?.weight ?? 5,
        notes: existing?.notes ?? '',
      };
    }),
  );

  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  function updatePillar(key: string, update: Partial<PillarState>) {
    setPillars((prev) => prev.map((p) => (p.key === key ? { ...p, ...update } : p)));
  }

  const saveMutation = useMutation({
    mutationFn: async () =>
      apiRequest('POST', '/api/audience-capture/pillars/bulk', {
        artistId,
        pillars: pillars.map((p) => ({
          pillar: p.key,
          isActive: p.isActive,
          weight: p.weight,
          notes: p.notes,
        })),
      }),
    onSuccess: () => {
      toast({ title: 'Content Pillars saved', description: '7 pillars updated successfully.' });
      queryClient.invalidateQueries({ queryKey: [`/api/audience-capture/profile/${artistId}`] });
      onSaved?.();
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50 mb-4">
        Activate the content pillars that fit this artist. Each pillar has a weight (1–10) that
        determines how often the AI prioritises it in content plans.
      </p>

      {PILLARS.map((pillar) => {
        const state = pillars.find((p) => p.key === pillar.key)!;
        const Icon = pillar.icon;
        const isExpanded = expandedKey === pillar.key;

        return (
          <div
            key={pillar.key}
            className={`rounded-xl border transition-all ${
              state.isActive ? `border-white/15 bg-white/[0.04]` : 'border-white/5 bg-white/[0.01] opacity-50'
            }`}
          >
            <div className="flex items-center gap-3 p-3">
              {/* Toggle */}
              <button
                type="button"
                onClick={() => updatePillar(pillar.key, { isActive: !state.isActive })}
                className={`w-9 h-5 rounded-full transition-all flex-shrink-0 ${
                  state.isActive ? 'bg-orange-500' : 'bg-white/10'
                }`}
              >
                <span
                  className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    state.isActive ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>

              {/* Icon */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${pillar.accent} flex-shrink-0`}>
                <Icon size={14} />
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{pillar.label}</div>
                <div className="text-[10px] text-white/40">{pillar.description}</div>
              </div>

              {/* Weight */}
              {state.isActive && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => updatePillar(pillar.key, { weight: Math.max(1, state.weight - 1) })}
                    className="w-5 h-5 rounded text-white/50 hover:text-white text-sm flex items-center justify-center"
                  >−</button>
                  <span className="w-5 text-center text-sm font-bold text-orange-400">{state.weight}</span>
                  <button
                    type="button"
                    onClick={() => updatePillar(pillar.key, { weight: Math.min(10, state.weight + 1) })}
                    className="w-5 h-5 rounded text-white/50 hover:text-white text-sm flex items-center justify-center"
                  >+</button>
                </div>
              )}

              {/* Expand notes */}
              {state.isActive && (
                <button
                  type="button"
                  onClick={() => setExpandedKey(isExpanded ? null : pillar.key)}
                  className="text-[10px] text-white/30 hover:text-white/60 flex-shrink-0"
                >
                  {isExpanded ? '▲' : '▼'}
                </button>
              )}
            </div>

            {isExpanded && state.isActive && (
              <div className="px-3 pb-3">
                <textarea
                  value={state.notes}
                  onChange={(e) => updatePillar(pillar.key, { notes: e.target.value })}
                  placeholder="Notes: specific topics, restrictions, examples..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg text-xs text-white/70 p-2 resize-none h-16 focus:outline-none focus:border-orange-500/40 placeholder:text-white/20"
                />
              </div>
            )}
          </div>
        );
      })}

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold mt-2"
      >
        {saveMutation.isPending ? (
          <><Loader2 size={16} className="animate-spin mr-2" /> Saving…</>
        ) : (
          <><Save size={16} className="mr-2" /> Save Content Pillars</>
        )}
      </Button>
    </div>
  );
}
