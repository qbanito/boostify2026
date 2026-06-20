/**
 * FashionCampaignGenerator — AI-powered campaign creator for fashion drops
 */
import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Copy, Download, Megaphone, Hash, Instagram, Video } from 'lucide-react';
import type { FashionBrand } from './FashionVirtualStore';

interface Campaign {
  id: number;
  title: string;
  concept: string;
  campaignImages: string[];
  targetPlatforms: string[];
  hashtags: string[];
  caption: string;
  videoPrompt: string;
  status: string;
  createdAt: string;
}

interface Props {
  artistId: number;
  brand: FashionBrand | null;
  isOwner: boolean;
  colors: { hexPrimary: string; hexAccent: string; hexBorder: string };
}

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'tiktok', label: 'TikTok', icon: Video },
];

export function FashionCampaignGenerator({ artistId, brand, isOwner, colors }: Props) {
  const { toast } = useToast();
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'tiktok']);
  const [collectionId, setCollectionId] = useState<string>('all');
  const [latestCampaign, setLatestCampaign] = useState<Campaign | null>(null);
  const [activeImgIdx, setActiveImgIdx] = useState(0);

  const { data: colData } = useQuery<{ collections: any[] }>({
    queryKey: ['fashion-collections', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/collections`),
    staleTime: 5 * 60 * 1000,
    enabled: !!brand,
  });

  const { data: campData } = useQuery<{ campaigns: Campaign[] }>({
    queryKey: ['fashion-campaigns', artistId],
    queryFn: () => apiRequest('GET', `/api/fashion-store/${artistId}/campaigns`),
    staleTime: 2 * 60 * 1000,
    enabled: !!brand,
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest('POST', `/api/fashion-store/${artistId}/campaigns/generate`, {
      collectionId: collectionId && collectionId !== 'all' ? collectionId : undefined,
      targetPlatforms: selectedPlatforms,
    }),
    onSuccess: (d: any) => {
      setLatestCampaign(d.campaign);
      setActiveImgIdx(0);
      toast({ title: '🎬 Campaign generated!' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const collections = colData?.collections || [];
  const campaigns = campData?.campaigns || [];
  const displayCampaign = latestCampaign || campaigns[0] || null;

  if (!brand) {
    return <p className="text-white/30 text-sm py-8 text-center">Create your fashion brand first.</p>;
  }

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <p className="text-white/30 text-[11px] uppercase tracking-widest">Latest Campaign</p>
        {displayCampaign ? <CampaignView campaign={displayCampaign} colors={colors} activeIdx={activeImgIdx} setActiveIdx={setActiveImgIdx} /> : (
          <p className="text-white/25 text-sm py-6 text-center">No campaigns yet</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.hexBorder}` }}>
        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest">Generate Campaign</p>

        {collections.length > 0 && (
          <Select value={collectionId} onValueChange={setCollectionId}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white text-sm">
              <SelectValue placeholder="For collection (optional)" />
            </SelectTrigger>
            <SelectContent className="bg-[#0d0d18] border-white/10 text-white">
              <SelectItem value="all">Brand-wide campaign</SelectItem>
              {collections.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div>
          <p className="text-white/30 text-xs mb-2">Target platforms</p>
          <div className="flex gap-2 flex-wrap">
            {PLATFORMS.map(p => (
              <button key={p.id}
                onClick={() => setSelectedPlatforms(prev =>
                  prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                )}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={selectedPlatforms.includes(p.id)
                  ? { background: colors.hexPrimary, color: 'white' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
                <p.icon className="w-3 h-3" />{p.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="w-full rounded-xl font-semibold text-sm"
          style={{ background: colors.hexPrimary }}>
          {generateMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating Campaign…</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" /> Generate Campaign</>
          )}
        </Button>
      </div>

      {/* Latest / generated campaign */}
      {displayCampaign && (
        <CampaignView campaign={displayCampaign} colors={colors} activeIdx={activeImgIdx} setActiveIdx={setActiveImgIdx} />
      )}

      {/* Past campaigns list */}
      {campaigns.length > 1 && (
        <div>
          <p className="text-white/25 text-[11px] uppercase tracking-widest mb-3">Past Campaigns</p>
          <div className="space-y-2">
            {campaigns.slice(1).map(c => (
              <button key={c.id} onClick={() => { setLatestCampaign(c); setActiveImgIdx(0); }}
                className="w-full text-left rounded-xl p-3 flex items-center gap-3 transition-all hover:bg-white/5"
                style={{ border: `1px solid ${colors.hexBorder}` }}>
                {c.campaignImages?.[0] && (
                  <img src={c.campaignImages[0]} alt={c.title} className="w-10 h-10 object-cover rounded-lg shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{c.title}</p>
                  <p className="text-white/30 text-[10px]">{c.targetPlatforms?.join(', ')}</p>
                </div>
                <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] shrink-0"
                  style={{ background: `${colors.hexPrimary}20`, color: colors.hexAccent }}>
                  {c.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CampaignView({ campaign, colors, activeIdx, setActiveIdx }: {
  campaign: Campaign; colors: any; activeIdx: number; setActiveIdx: (i: number) => void;
}) {
  const { toast } = useToast();

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-white font-bold text-sm">{campaign.title}</p>
        <span className="text-white/30 text-[10px]">{campaign.targetPlatforms?.join(' · ')}</span>
      </div>

      {/* Image gallery */}
      {campaign.campaignImages && campaign.campaignImages.length > 0 && (
        <div>
          <img
            src={campaign.campaignImages[activeIdx]}
            alt="Campaign visual"
            className="w-full rounded-xl object-cover"
            style={{ maxHeight: 280, border: `1px solid ${colors.hexBorder}` }}
          />
          <div className="flex gap-1.5 mt-2 justify-center">
            {campaign.campaignImages.map((_, i) => (
              <button key={i} onClick={() => setActiveIdx(i)}
                className="w-1.5 h-1.5 rounded-full transition-all"
                style={{ background: i === activeIdx ? colors.hexAccent : 'rgba(255,255,255,0.2)' }} />
            ))}
          </div>
        </div>
      )}

      {/* Concept */}
      {campaign.concept && (
        <p className="text-white/50 text-xs leading-relaxed italic">{campaign.concept}</p>
      )}

      {/* Caption */}
      {campaign.caption && (
        <div className="rounded-xl p-3 relative group" style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.hexBorder}` }}>
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2">Caption</p>
          <p className="text-white/70 text-xs whitespace-pre-line leading-relaxed">{campaign.caption}</p>
          <button onClick={() => copy(campaign.caption)}
            className="absolute top-3 right-3 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <Copy className="w-3 h-3 text-white/50" />
          </button>
        </div>
      )}

      {/* Hashtags */}
      {campaign.hashtags && campaign.hashtags.length > 0 && (
        <div>
          <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2 flex items-center gap-1">
            <Hash className="w-3 h-3" /> Hashtags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {campaign.hashtags.map((h, i) => (
              <button key={i} onClick={() => copy(h)}
                className="px-2 py-0.5 rounded-full text-[11px] transition-all hover:opacity-80"
                style={{ background: `${colors.hexPrimary}15`, color: colors.hexAccent, border: `1px solid ${colors.hexBorder}` }}>
                {h}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Download images */}
      {campaign.campaignImages && campaign.campaignImages.length > 0 && (
        <Button size="sm" variant="outline" className="w-full rounded-xl text-xs border-white/10 text-white/50"
          onClick={() => window.open(campaign.campaignImages[activeIdx], '_blank')}>
          <Download className="w-3.5 h-3.5 mr-1.5" /> Download Selected Image
        </Button>
      )}
    </div>
  );
}
