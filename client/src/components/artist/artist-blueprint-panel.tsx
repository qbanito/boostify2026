/**
 * Artist Superstar Blueprint Panel
 *
 * Genera y muestra el JSON maestro de 13 módulos de un artista.
 * Se embute como una sección en el artist-profile-card (owner-only).
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Trophy,
  Zap,
  Music2,
  Eye,
  Target,
  BarChart3,
  DollarSign,
  Globe,
  Users,
  Mic2,
  Megaphone,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BlueprintApiResponse {
  success: boolean;
  hasBlueprint: boolean;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  blueprintId?: number;
  globalArtistScore?: number;
  currentEra?: string;
  primaryGenre?: string;
  brandArchetype?: string;
  generatedAt?: string;
  blueprint?: Record<string, unknown>;
  error?: string;
}

interface ArtistBlueprintPanelProps {
  artistId: number;
  artistName: string;
  isOwnProfile?: boolean;
}

// ─── Helper components ────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
    score >= 60 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                  'bg-rose-500/20 text-rose-300 border-rose-500/40';
  const label =
    score >= 80 ? 'Superstar Potential' :
    score >= 60 ? 'Rising Talent' :
    score >= 40 ? 'Emerging Artist' : 'Needs Development';

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold ${color}`}>
      <Trophy className="w-4 h-4" />
      <span>{score}/100</span>
      <span className="text-xs font-normal opacity-80">— {label}</span>
    </div>
  );
}

function ModuleSection({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-white/90 font-semibold text-sm">
        <Icon className="w-4 h-4 text-purple-400" />
        <span>{title}</span>
      </div>
      <div className="pl-6 space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 text-sm">
      <span className="text-white/50 min-w-[160px] shrink-0">{label}</span>
      <span className="text-white/80">{value}</span>
    </div>
  );
}

function TagList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span
          key={i}
          className="px-2 py-0.5 rounded-md bg-white/10 text-white/70 text-xs"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ─── Module renderers ─────────────────────────────────────────────────────────

function DNATab({ bp }: { bp: Record<string, unknown> }) {
  const dna = bp.artist_dna as Record<string, unknown> | undefined;
  const identity = bp.identity as Record<string, unknown> | undefined;
  if (!dna && !identity) return <p className="text-white/40 text-sm">No data available</p>;

  return (
    <div className="space-y-6">
      {dna && (
        <ModuleSection icon={Mic2} title="Artist DNA">
          <InfoRow label="Artist Name" value={String(dna.artist_name || '')} />
          <InfoRow label="Type" value={String(dna.artist_type || '')} />
          <InfoRow label="Primary Genre" value={String(dna.primary_genre || '')} />
          <InfoRow label="Career Stage" value={String(dna.career_stage || '')} />
          <InfoRow label="Brand Essence" value={String(dna.brand_essence || '')} />
          <InfoRow label="Tagline" value={<em className="text-purple-300">"{String(dna.tagline || '')}"</em>} />
          {Array.isArray(dna.secondary_genres) && dna.secondary_genres.length > 0 && (
            <InfoRow label="Secondary Genres" value={<TagList items={dna.secondary_genres as string[]} />} />
          )}
        </ModuleSection>
      )}
      {identity && (
        <ModuleSection icon={Sparkles} title="Identity">
          <InfoRow label="Brand Archetype" value={
            <span className="text-purple-300 font-medium">{String(identity.brand_archetype || '')}</span>
          } />
          {Array.isArray(identity.personality_traits) && (
            <InfoRow label="Traits" value={<TagList items={identity.personality_traits as string[]} />} />
          )}
          <InfoRow label="Communication" value={String(identity.communication_style || '')} />
          <InfoRow label="Social Voice" value={String(identity.social_media_voice || '')} />
          <InfoRow label="Visual Signature" value={String(identity.visual_signature || '')} />
          <InfoRow label="UVP" value={String(identity.unique_value_proposition || '')} />
        </ModuleSection>
      )}
    </div>
  );
}

function SoundTab({ bp }: { bp: Record<string, unknown> }) {
  const sound = bp.sound as Record<string, unknown> | undefined;
  const talent = bp.talent as Record<string, unknown> | undefined;
  if (!sound && !talent) return <p className="text-white/40 text-sm">No data available</p>;

  return (
    <div className="space-y-6">
      {sound && (
        <ModuleSection icon={Music2} title="Sound Engine">
          <InfoRow label="Primary Genre" value={String(sound.primary_genre || '')} />
          <InfoRow label="BPM Range" value={
            sound.bpm_range
              ? `${(sound.bpm_range as Record<string, number>).min} – ${(sound.bpm_range as Record<string, number>).max} BPM`
              : ''
          } />
          <InfoRow label="Vocal Style" value={String(sound.vocal_style || '')} />
          <InfoRow label="Production Style" value={String(sound.production_style || '')} />
          <InfoRow label="Signature Sound" value={String(sound.signature_sound || '')} />
          <InfoRow label="Hit Formula" value={String(sound.hit_formula || '')} />
          <InfoRow label="Hit Potential" value={
            <span className="text-emerald-400 font-bold">{String(sound.hit_potential_score || 0)}/100</span>
          } />
          {Array.isArray(sound.sonic_influences) && (
            <InfoRow label="Influences" value={<TagList items={sound.sonic_influences as string[]} />} />
          )}
          {Array.isArray(sound.mood_keywords) && (
            <InfoRow label="Moods" value={<TagList items={sound.mood_keywords as string[]} />} />
          )}
          {Array.isArray(sound.lyric_themes) && (
            <InfoRow label="Lyric Themes" value={<TagList items={sound.lyric_themes as string[]} />} />
          )}
        </ModuleSection>
      )}
      {talent && (
        <ModuleSection icon={Mic2} title="Talent Profile">
          <InfoRow label="Primary Talent" value={String(talent.primary_talent || '')} />
          <InfoRow label="Vocal Range" value={String(talent.vocal_range || '')} />
          <InfoRow label="Dance Ability" value={String(talent.dance_ability || '')} />
          <InfoRow label="Production" value={String(talent.production_involvement || '')} />
          {Array.isArray(talent.secondary_talents) && (
            <InfoRow label="Secondary Talents" value={<TagList items={talent.secondary_talents as string[]} />} />
          )}
          {Array.isArray(talent.development_focus) && (
            <InfoRow label="Development Focus" value={<TagList items={talent.development_focus as string[]} />} />
          )}
        </ModuleSection>
      )}
    </div>
  );
}

function VisualTab({ bp }: { bp: Record<string, unknown> }) {
  const visual = bp.visual_universe as Record<string, unknown> | undefined;
  if (!visual) return <p className="text-white/40 text-sm">No data available</p>;

  const palette = Array.isArray(visual.color_palette) ? visual.color_palette as string[] : [];

  return (
    <div className="space-y-6">
      <ModuleSection icon={Eye} title="Visual Universe">
        <InfoRow label="Aesthetic" value={
          <span className="text-pink-300 font-medium">{String(visual.aesthetic || '')}</span>
        } />
        <InfoRow label="Palette" value={
          <div className="flex items-center gap-2">
            {palette.map((color, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-full border border-white/20 shadow"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <span className="text-white/50 text-xs ml-1">{String(visual.palette_name || '')}</span>
          </div>
        } />
        {Array.isArray(visual.fashion_keywords) && (
          <InfoRow label="Fashion" value={<TagList items={visual.fashion_keywords as string[]} />} />
        )}
        <InfoRow label="Cinematic Style" value={String(visual.cinematic_style || '')} />
        <InfoRow label="Logo Concept" value={String(visual.logo_concept || '')} />
        <InfoRow label="Cover Art Direction" value={String(visual.cover_art_direction || '')} />
        <InfoRow label="Video Style" value={String(visual.video_style || '')} />
        <InfoRow label="Photography" value={String(visual.photography_direction || '')} />
        {visual.art_direction_brief && (
          <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs leading-relaxed">
            {String(visual.art_direction_brief)}
          </div>
        )}
      </ModuleSection>
    </div>
  );
}

function CampaignTab({ bp }: { bp: Record<string, unknown> }) {
  const campaign = bp.launch_campaign as Record<string, unknown> | undefined;
  const dist = bp.distribution as Record<string, unknown> | undefined;
  if (!campaign && !dist) return <p className="text-white/40 text-sm">No data available</p>;

  const platformStrategy = campaign?.platform_strategy as Record<string, string> | undefined;
  const launchSequence = Array.isArray(campaign?.launch_sequence) ? campaign!.launch_sequence as string[] : [];
  const kpis = campaign?.kpis as Record<string, number | string> | undefined;

  return (
    <div className="space-y-6">
      {campaign && (
        <ModuleSection icon={Target} title="Launch Campaign">
          <InfoRow label="Campaign Name" value={
            <span className="text-yellow-300 font-semibold">{String(campaign.campaign_name || '')}</span>
          } />
          <InfoRow label="Concept" value={String(campaign.campaign_concept || '')} />
          <InfoRow label="Duration" value={`${String(campaign.content_calendar_weeks || 6)} weeks`} />

          {kpis && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {Object.entries(kpis).map(([key, val]) => (
                <div key={key} className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-white/40 text-xs">{key.replace(/_/g, ' ')}</div>
                  <div className="text-white font-bold text-sm">{typeof val === 'number' ? val.toLocaleString() : String(val)}</div>
                </div>
              ))}
            </div>
          )}

          {platformStrategy && (
            <div className="space-y-1.5 mt-2">
              {Object.entries(platformStrategy).map(([platform, strategy]) => (
                <div key={platform} className="flex gap-2 text-xs">
                  <span className="text-purple-400 font-medium capitalize min-w-[70px]">{platform}</span>
                  <span className="text-white/60">{String(strategy)}</span>
                </div>
              ))}
            </div>
          )}

          {launchSequence.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {launchSequence.map((step, i) => (
                <div key={i} className="flex gap-2 text-xs items-start">
                  <ChevronRight className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
                  <span className="text-white/70">{String(step)}</span>
                </div>
              ))}
            </div>
          )}
        </ModuleSection>
      )}

      {dist && (
        <ModuleSection icon={Globe} title="Distribution">
          <InfoRow label="Release Frequency" value={String(dist.release_frequency || '')} />
          <InfoRow label="Strategy" value={String(dist.distribution_strategy || '')} />
          {Array.isArray(dist.primary_platforms) && (
            <InfoRow label="Primary Platforms" value={<TagList items={dist.primary_platforms as string[]} />} />
          )}
          {Array.isArray(dist.playlist_targets) && (
            <InfoRow label="Playlist Targets" value={<TagList items={dist.playlist_targets as string[]} />} />
          )}
          {Array.isArray(dist.international_markets) && (
            <InfoRow label="Markets" value={<TagList items={dist.international_markets as string[]} />} />
          )}
        </ModuleSection>
      )}
    </div>
  );
}

function MoneyTab({ bp }: { bp: Record<string, unknown> }) {
  const money = bp.monetization as Record<string, unknown> | undefined;
  const fanbase = bp.fanbase as Record<string, unknown> | undefined;
  if (!money && !fanbase) return <p className="text-white/40 text-sm">No data available</p>;

  const merch = Array.isArray(money?.merch_products) ? money!.merch_products as Array<{ name: string; type: string; price_usd: number }> : [];
  const fanSegments = Array.isArray(fanbase?.fan_segments) ? fanbase!.fan_segments as Array<{ name: string; percentage: number; behavior: string }> : [];
  const streamTargets = money?.streaming_targets as Record<string, number> | undefined;

  return (
    <div className="space-y-6">
      {money && (
        <ModuleSection icon={DollarSign} title="Monetization Engine">
          <InfoRow label="Revenue Model" value={String(money.revenue_model || '')} />
          <InfoRow label="Projected Year 1" value={
            <span className="text-emerald-400 font-bold">
              ${(money.projected_year1_revenue_usd as number || 0).toLocaleString()}
            </span>
          } />
          {Array.isArray(money.revenue_pillars) && (
            <InfoRow label="Revenue Pillars" value={<TagList items={money.revenue_pillars as string[]} />} />
          )}

          {streamTargets && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {Object.entries(streamTargets).map(([key, val]) => (
                <div key={key} className="p-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-white/40 text-xs">{key.replace(/_/g, ' ')}</div>
                  <div className="text-white font-bold text-sm">{typeof val === 'number' ? val.toLocaleString() : String(val)}</div>
                </div>
              ))}
            </div>
          )}

          {merch.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="text-white/50 text-xs mb-1">Merch Products</div>
              {merch.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                  <span className="text-white/70">{item.name}</span>
                  <span className="text-emerald-400 font-medium">${item.price_usd}</span>
                </div>
              ))}
            </div>
          )}

          {Array.isArray(money.value_protection_rules) && (
            <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="text-amber-400 text-xs font-semibold mb-1.5">Value Protection Rules</div>
              {(money.value_protection_rules as string[]).map((rule, i) => (
                <div key={i} className="text-amber-200/60 text-xs flex gap-1.5 items-start">
                  <span>•</span><span>{rule}</span>
                </div>
              ))}
            </div>
          )}
        </ModuleSection>
      )}

      {fanbase && (
        <ModuleSection icon={Users} title="Fanbase">
          <InfoRow label="Community Name" value={
            <span className="text-pink-300">{String(fanbase.community_name || '')}</span>
          } />
          <InfoRow label="Estimated Fans" value={(fanbase.total_estimated_fans as number || 0).toLocaleString()} />
          {fanSegments.length > 0 && (
            <div className="space-y-2 mt-2">
              {fanSegments.map((seg, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/70">{seg.name}</span>
                    <span className="text-purple-400">{seg.percentage}%</span>
                  </div>
                  <Progress value={seg.percentage} className="h-1" />
                  <p className="text-white/40 text-xs">{seg.behavior}</p>
                </div>
              ))}
            </div>
          )}
        </ModuleSection>
      )}
    </div>
  );
}

function EraTab({ bp }: { bp: Record<string, unknown> }) {
  const era = bp.era_evolution as Record<string, unknown> | undefined;
  const pr = bp.pr_narrative as Record<string, unknown> | undefined;
  const meta = bp._meta as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      {era && (
        <ModuleSection icon={BarChart3} title="Era Evolution">
          <InfoRow label="Current Era" value={
            <span className="text-yellow-300 font-bold">{String(era.current_era || '')}</span>
          } />
          <InfoRow label="Duration" value={`${String(era.era_duration_months || 12)} months`} />
          <InfoRow label="Era Concept" value={String(era.era_concept || '')} />
          <InfoRow label="Next Era" value={String(era.next_era_concept || '')} />
          <InfoRow label="Legacy Vision" value={String(era.legacy_vision || '')} />
          {Array.isArray(era.era_milestones) && (
            <div className="mt-2 space-y-1.5">
              {(era.era_milestones as string[]).map((m, i) => (
                <div key={i} className="flex gap-2 text-xs items-start">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-white/70">{m}</span>
                </div>
              ))}
            </div>
          )}
        </ModuleSection>
      )}

      {pr && (
        <ModuleSection icon={Megaphone} title="PR Narrative">
          <InfoRow label="Press Headline" value={
            <em className="text-white/80 font-medium">{String(pr.press_headline || '')}</em>
          } />
          <InfoRow label="Origin Story" value={String(pr.origin_story || '')} />
          <InfoRow label="Current Chapter" value={String(pr.current_chapter || '')} />
          {Array.isArray(pr.media_angles) && (
            <InfoRow label="Media Angles" value={
              <div className="space-y-1">
                {(pr.media_angles as string[]).map((angle, i) => (
                  <div key={i} className="text-xs text-white/60 flex gap-1.5 items-start">
                    <span className="text-purple-400">→</span><span>{angle}</span>
                  </div>
                ))}
              </div>
            } />
          )}
        </ModuleSection>
      )}

      {meta && Array.isArray(meta.next_actions) && (
        <ModuleSection icon={Target} title="Next 30-Day Actions">
          {(meta.next_actions as string[]).map((action, i) => (
            <div key={i} className="flex gap-2 text-sm items-start py-1 border-b border-white/5 last:border-0">
              <div className="w-5 h-5 rounded-full bg-purple-500/30 text-purple-300 text-xs flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </div>
              <span className="text-white/70">{String(action)}</span>
            </div>
          ))}
        </ModuleSection>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArtistBlueprintPanel({ artistId, artistName, isOwnProfile = false }: ArtistBlueprintPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const queryKey = [`/api/artist-blueprint/${artistId}`];

  // Poll while generating
  const [polling, setPolling] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationSuccess, setMutationSuccess] = useState(false);

  const { data, isLoading, refetch } = useQuery<BlueprintApiResponse>({
    queryKey,
    queryFn: async () => {
      try {
        const result = await apiRequest('GET', `/api/artist-blueprint/${artistId}`);
        return result as BlueprintApiResponse;
      } catch (err: any) {
        const msg: string = err?.message ?? '';
        // 404 = blueprint doesn't exist yet — not an error, just "pending"
        if (msg.startsWith('404')) {
          return { success: false, hasBlueprint: false, status: 'pending' as const };
        }
        // 401 = not authenticated — surface gracefully
        if (msg.startsWith('401')) {
          return { success: false, hasBlueprint: false, status: 'pending' as const, error: 'auth' };
        }
        throw err;
      }
    },
    refetchInterval: polling ? 3000 : false,
    refetchIntervalInBackground: true,
    retry: false,
  });

  // Auto-start or stop polling based on status
  useEffect(() => {
    if (data?.status === 'completed' || data?.status === 'failed') {
      setPolling(false);
    } else if (data?.status === 'generating') {
      setPolling(true);
    }
  }, [data?.status]);

  const generateMutation = useMutation({
    mutationFn: async () => {
      try {
        return await apiRequest('POST', `/api/artist-blueprint/${artistId}/generate`);
      } catch (err: any) {
        const msg: string = err?.message ?? 'Failed to start blueprint generation';
        throw new Error(msg);
      }
    },
    onSuccess: () => {
      setPolling(true);
      setMutationError(null);
      setMutationSuccess(true);
      setTimeout(() => setMutationSuccess(false), 5000);
      toast({ title: '⚡ Blueprint generation started', description: 'This takes ~30 seconds. Auto-updating...' });
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: Error) => {
      setMutationError(err.message);
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleDownload = () => {
    if (!data?.blueprint) return;
    const blob = new Blob([JSON.stringify(data.blueprint, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artistName.replace(/\s+/g, '_')}_superstar_blueprint.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const bp = data?.blueprint as Record<string, unknown> | undefined;

  return (
    <div className="space-y-5 p-4">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-2xl p-5"
        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(219,39,119,0.08) 100%)', border: '1px solid rgba(255,255,255,0.09)' }}>
        {/* top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
          style={{ background: 'linear-gradient(90deg, transparent, #7c3aed, #db2777, transparent)' }} />
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed33, #db277733)' }}>
                <Trophy className="w-4 h-4 text-yellow-400" />
              </div>
              <h2 className="text-base font-black text-white tracking-tight">Superstar Blueprint</h2>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest" style={{ background: 'rgba(124,58,237,0.25)', color: '#a78bfa' }}>v2.0</span>
            </div>
            <p className="text-white/40 text-xs pl-[44px]">
              AI-generated master strategy — feeds all platform systems
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            {bp && (
              <Button
                size="sm"
                variant="outline"
                className="border-white/15 text-white/60 hover:text-white text-xs h-8"
                onClick={handleDownload}
              >
                <Download className="w-3 h-3 mr-1.5" />
                JSON
              </Button>
            )}
            {isOwnProfile && (
              <Button
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending || polling || data?.status === 'generating'}
                className="text-white text-xs h-8"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)' }}
              >
                {(generateMutation.isPending || polling || data?.status === 'generating') ? (
                  <><RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />Generating...</>
                ) : bp ? (
                  <><RefreshCw className="w-3 h-3 mr-1.5" />Regenerate</>
                ) : (
                  <><Zap className="w-3 h-3 mr-1.5" />Generate</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Status area */}
      {isLoading && (
        <div className="flex items-center gap-2 text-white/50 text-sm p-4 rounded-xl bg-white/5 border border-white/10">
          <Clock className="w-4 h-4 animate-pulse" />
          Loading blueprint data...
        </div>
      )}

      {/* Inline mutation success banner (since Toaster may be hidden) */}
      {mutationSuccess && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <p className="text-green-300 font-medium text-sm">⚡ Blueprint generation started — auto-updating every 3 seconds…</p>
        </div>
      )}

      {/* Inline mutation error banner (since Toaster may be hidden) */}
      {mutationError && !mutationSuccess && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-rose-300 font-medium text-sm">Generation failed</p>
            <p className="text-white/40 text-xs mt-0.5">
              {mutationError.includes('401') || mutationError.includes('Authentication')
                ? 'You need to be signed in to generate a blueprint. Please log in and try again.'
                : mutationError}
            </p>
          </div>
          <button onClick={() => setMutationError(null)} className="text-white/30 hover:text-white/60 text-xs shrink-0">✕</button>
        </div>
      )}

      {data?.status === 'generating' && (
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-3">
          <div className="flex items-center gap-2 text-purple-300 font-medium">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Generating your Superstar Blueprint...
          </div>
          <p className="text-white/50 text-xs">
            The AI is analyzing all your artist data and generating the 13-module blueprint.
            This takes approximately 20–60 seconds.
          </p>
          <Progress value={undefined} className="h-1.5 animate-pulse" />
        </div>
      )}

      {data?.status === 'failed' && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-rose-300 font-medium text-sm">Generation failed</p>
            <p className="text-white/40 text-xs mt-0.5">{data.error || 'An unknown error occurred. Try regenerating.'}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !bp && data?.status !== 'generating' && data?.status !== 'failed' && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-purple-400" />
          </div>
          {isOwnProfile ? (
            <>
              <div>
                <h3 className="text-white font-semibold mb-1">No Blueprint Yet</h3>
                <p className="text-white/40 text-sm max-w-sm">
                  Generate your personalized Superstar Blueprint to get a complete 13-module strategic roadmap
                  tailored to {artistName}'s real data.
                </p>
              </div>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="bg-purple-600 hover:bg-purple-500 text-white gap-2"
              >
                <Zap className="w-4 h-4" />
                Generate My Superstar Blueprint
              </Button>
            </>
          ) : (
            <div>
              <h3 className="text-white font-semibold mb-1">Blueprint Not Generated Yet</h3>
              <p className="text-white/40 text-sm max-w-sm">
                {artistName} hasn't generated their Superstar Blueprint yet. Check back later.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Blueprint content */}
      {bp && data?.status === 'completed' && (
        <div className="space-y-4">
          {/* ── Score & Meta card ─────────────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-2xl p-5"
            style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.22) 0%, rgba(219,39,119,0.12) 50%, rgba(37,99,235,0.18) 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* animated glow orbs */}
            <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30"
              style={{ background: 'radial-gradient(circle, #7c3aed, transparent 70%)', filter: 'blur(32px)', animation: 'pulse 4s ease-in-out infinite' }} />
            <div className="pointer-events-none absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, #db2777, transparent 70%)', filter: 'blur(28px)', animation: 'pulse 6s ease-in-out infinite reverse' }} />

            <div className="relative flex items-center gap-5">
              {/* Score ring */}
              {data.globalArtistScore != null && (
                <div className="flex-shrink-0 relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                    <circle cx="40" cy="40" r="32" fill="none"
                      stroke="url(#scoreGrad)" strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 32 * data.globalArtistScore / 100} ${2 * Math.PI * 32}`}
                      style={{ transition: 'stroke-dasharray 1.2s ease-out' }}
                    />
                    <defs>
                      <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#7c3aed" />
                        <stop offset="100%" stopColor="#db2777" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-white font-black text-xl leading-none">{data.globalArtistScore}</span>
                    <span className="text-white/40 text-[9px] uppercase tracking-wide">score</span>
                  </div>
                </div>
              )}

              {/* Meta pills */}
              <div className="flex-1 min-w-0 space-y-2">
                {data.globalArtistScore != null && (
                  <ScoreBadge score={data.globalArtistScore} />
                )}
                <div className="flex flex-wrap gap-1.5">
                  {data.currentEra && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>
                      ✦ {data.currentEra}
                    </span>
                  )}
                  {data.primaryGenre && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                      {data.primaryGenre}
                    </span>
                  )}
                  {data.brandArchetype && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'rgba(244,114,182,0.15)', color: '#f472b6', border: '1px solid rgba(244,114,182,0.25)' }}>
                      {data.brandArchetype}
                    </span>
                  )}
                </div>
                {data.generatedAt && (
                  <p className="text-white/25 text-[10px]">Generated {new Date(data.generatedAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="dna" className="w-full">
            <ScrollArea className="w-full" type="scroll">
              <TabsList className="bg-white/5 border border-white/10 h-auto flex-wrap gap-1 p-1 mb-4">
                {[
                  { value: 'dna', label: 'DNA & Identity', icon: Sparkles },
                  { value: 'sound', label: 'Sound & Talent', icon: Music2 },
                  { value: 'visual', label: 'Visual Universe', icon: Eye },
                  { value: 'campaign', label: 'Campaign & Dist.', icon: Target },
                  { value: 'money', label: 'Monetization', icon: DollarSign },
                  { value: 'era', label: 'Era & PR', icon: BarChart3 },
                ].map(tab => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="data-[state=active]:bg-purple-600 data-[state=active]:text-white text-white/60 text-xs px-3 py-1.5 flex items-center gap-1.5"
                  >
                    <tab.icon className="w-3 h-3" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>

            <ScrollArea className="h-[500px] pr-3">
              <TabsContent value="dna" className="mt-0">
                <DNATab bp={bp} />
              </TabsContent>
              <TabsContent value="sound" className="mt-0">
                <SoundTab bp={bp} />
              </TabsContent>
              <TabsContent value="visual" className="mt-0">
                <VisualTab bp={bp} />
              </TabsContent>
              <TabsContent value="campaign" className="mt-0">
                <CampaignTab bp={bp} />
              </TabsContent>
              <TabsContent value="money" className="mt-0">
                <MoneyTab bp={bp} />
              </TabsContent>
              <TabsContent value="era" className="mt-0">
                <EraTab bp={bp} />
              </TabsContent>
            </ScrollArea>
          </Tabs>

          {/* Full page CTA — prominent gradient button */}
          <div className="pt-1">
            <button
              className="group w-full relative overflow-hidden rounded-2xl px-5 py-4 font-bold text-sm text-white transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #db2777 50%, #2563eb 100%)', boxShadow: '0 4px 24px rgba(124,58,237,0.45), 0 0 0 1px rgba(255,255,255,0.1)' }}
              onClick={() => setLocation(`/artist-blueprint/${artistId}`)}
            >
              {/* shimmer sweep */}
              <div className="pointer-events-none absolute inset-0 -skew-x-12 translate-x-[-120%] group-hover:translate-x-[120%] transition-transform duration-700"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }} />
              <div className="relative flex items-center justify-center gap-2.5">
                <Trophy className="w-4.5 h-4.5 flex-shrink-0" style={{ width: '18px', height: '18px' }} />
                <span className="tracking-wide">Ver Blueprint Completo</span>
                <span className="ml-auto text-white/60 text-xs font-normal">13 módulos →</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
