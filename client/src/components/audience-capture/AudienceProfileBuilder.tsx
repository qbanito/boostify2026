import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { useToast } from '../../hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Users, MapPin, Heart, Smartphone, Target, X, Plus, Save, Loader2 } from 'lucide-react';

interface AudienceProfileBuilderProps {
  artistId: number;
  initialProfile?: any;
  onSaved?: (profile: any) => void;
}

const PLATFORM_OPTIONS = ['TikTok', 'Instagram', 'YouTube', 'Facebook', 'Threads', 'Twitter/X'];
const FORMAT_OPTIONS = [
  'Short videos (15-30s)',
  'Reels (30-60s)',
  'Stories',
  'Behind the scenes',
  'Performance clips',
  'Lifestyle cinematic',
  'Challenge videos',
  'Q&A',
  'Duets/collabs',
];

export function AudienceProfileBuilder({ artistId, initialProfile, onSaved }: AudienceProfileBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [ageRange, setAgeRange] = useState(initialProfile?.primaryAgeRange ?? '18-35');
  const [languages, setLanguages] = useState<string[]>(initialProfile?.languages ?? ['es']);
  const [locations, setLocations] = useState<string[]>(initialProfile?.locations ?? []);
  const [interests, setInterests] = useState<string[]>(initialProfile?.interests ?? []);
  const [emotionalTriggers, setEmotionalTriggers] = useState<string[]>(initialProfile?.emotionalTriggers ?? []);
  const [platforms, setPlatforms] = useState<string[]>(initialProfile?.platforms ?? ['instagram', 'tiktok']);
  const [preferredFormats, setPreferredFormats] = useState<string[]>(initialProfile?.preferredFormats ?? []);
  const [archetype, setArchetype] = useState(initialProfile?.archetype ?? '');
  const [promise, setPromise] = useState(initialProfile?.promise ?? '');
  const [visualIdentity, setVisualIdentity] = useState(initialProfile?.visualIdentity ?? '');
  const [tone, setTone] = useState(initialProfile?.tone ?? '');

  // Tag input helpers
  const [newLang, setNewLang] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [newTrigger, setNewTrigger] = useState('');

  function addTag(list: string[], setList: (v: string[]) => void, value: string) {
    const v = value.trim();
    if (v && !list.includes(v)) setList([...list, v]);
  }
  function removeTag(list: string[], setList: (v: string[]) => void, value: string) {
    setList(list.filter((i) => i !== value));
  }
  function toggleItem(list: string[], setList: (v: string[]) => void, value: string) {
    if (list.includes(value)) setList(list.filter((i) => i !== value));
    else setList([...list, value]);
  }

  const saveMutation = useMutation({
    mutationFn: async () =>
      apiRequest('POST', '/api/audience-capture/profile', {
        artistId,
        primaryAgeRange: ageRange,
        languages,
        locations,
        interests,
        emotionalTriggers,
        platforms: platforms.map((p) => p.toLowerCase()),
        preferredFormats,
        archetype,
        promise,
        visualIdentity,
        tone,
      }),
    onSuccess: (data: any) => {
      toast({ title: 'Audience Profile saved', description: 'Your audience profile is ready.' });
      queryClient.invalidateQueries({ queryKey: [`/api/audience-capture/profile/${artistId}`] });
      onSaved?.(data.profile);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6">
      {/* Demographics */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Demographics</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-white/60 mb-1 block">Age range</Label>
            <Input
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value)}
              placeholder="18-35"
              className="bg-white/5 border-white/10 text-white text-sm h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-white/60 mb-1 block">Languages</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {languages.map((l) => (
                <Badge key={l} variant="outline" className="text-[10px] border-orange-500/40 text-orange-300 gap-1">
                  {l}
                  <X size={10} className="cursor-pointer" onClick={() => removeTag(languages, setLanguages, l)} />
                </Badge>
              ))}
            </div>
            <div className="flex gap-1">
              <Input
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                placeholder="es / en / pt"
                className="bg-white/5 border-white/10 text-white text-sm h-8"
                onKeyDown={(e) => { if (e.key === 'Enter') { addTag(languages, setLanguages, newLang); setNewLang(''); } }}
              />
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => { addTag(languages, setLanguages, newLang); setNewLang(''); }}>
                <Plus size={14} />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Locations */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <MapPin size={16} className="text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Key Locations</h3>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {locations.map((l) => (
            <Badge key={l} variant="outline" className="text-[10px] border-white/20 text-white/70 gap-1">
              {l}
              <X size={10} className="cursor-pointer" onClick={() => removeTag(locations, setLocations, l)} />
            </Badge>
          ))}
        </div>
        <div className="flex gap-1">
          <Input
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            placeholder="Miami, Mexico, Colombia..."
            className="bg-white/5 border-white/10 text-white text-sm h-9"
            onKeyDown={(e) => { if (e.key === 'Enter') { addTag(locations, setLocations, newLocation); setNewLocation(''); } }}
          />
          <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => { addTag(locations, setLocations, newLocation); setNewLocation(''); }}>
            <Plus size={14} />
          </Button>
        </div>
      </section>

      {/* Interests */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Heart size={16} className="text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Audience Interests</h3>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {interests.map((i) => (
            <Badge key={i} variant="outline" className="text-[10px] border-white/20 text-white/70 gap-1">
              {i}
              <X size={10} className="cursor-pointer" onClick={() => removeTag(interests, setInterests, i)} />
            </Badge>
          ))}
        </div>
        <div className="flex gap-1">
          <Input
            value={newInterest}
            onChange={(e) => setNewInterest(e.target.value)}
            placeholder="latin music, nightlife, fashion..."
            className="bg-white/5 border-white/10 text-white text-sm h-9"
            onKeyDown={(e) => { if (e.key === 'Enter') { addTag(interests, setInterests, newInterest); setNewInterest(''); } }}
          />
          <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => { addTag(interests, setInterests, newInterest); setNewInterest(''); }}>
            <Plus size={14} />
          </Button>
        </div>
      </section>

      {/* Emotional Triggers */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Target size={16} className="text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Emotional Triggers</h3>
          <span className="text-[10px] text-white/40">what makes them act</span>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {emotionalTriggers.map((t) => (
            <Badge key={t} variant="outline" className="text-[10px] border-orange-500/30 text-orange-300/80 gap-1">
              {t}
              <X size={10} className="cursor-pointer" onClick={() => removeTag(emotionalTriggers, setEmotionalTriggers, t)} />
            </Badge>
          ))}
        </div>
        <div className="flex gap-1">
          <Input
            value={newTrigger}
            onChange={(e) => setNewTrigger(e.target.value)}
            placeholder="libertad, abundancia, orgullo..."
            className="bg-white/5 border-white/10 text-white text-sm h-9"
            onKeyDown={(e) => { if (e.key === 'Enter') { addTag(emotionalTriggers, setEmotionalTriggers, newTrigger); setNewTrigger(''); } }}
          />
          <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => { addTag(emotionalTriggers, setEmotionalTriggers, newTrigger); setNewTrigger(''); }}>
            <Plus size={14} />
          </Button>
        </div>
      </section>

      {/* Platforms */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Smartphone size={16} className="text-orange-400" />
          <h3 className="text-sm font-semibold text-white">Primary Platforms</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map((p) => {
            const key = p.toLowerCase().replace(/\//g, '_').replace(/\s+/g, '');
            const active = platforms.some((pl) => pl.toLowerCase().includes(p.split('/')[0].toLowerCase().trim()));
            return (
              <button
                key={p}
                type="button"
                onClick={() => toggleItem(platforms, setPlatforms, p.toLowerCase())}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  active
                    ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                    : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </section>

      {/* Preferred Formats */}
      <section>
        <Label className="text-xs text-white/60 mb-2 block">Preferred Content Formats</Label>
        <div className="flex flex-wrap gap-2">
          {FORMAT_OPTIONS.map((f) => {
            const active = preferredFormats.includes(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleItem(preferredFormats, setPreferredFormats, f)}
                className={`px-3 py-1 rounded-full text-[11px] border transition-all ${
                  active
                    ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                    : 'bg-white/5 border-white/10 text-white/40 hover:border-white/25'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      </section>

      {/* Artist Positioning */}
      <section className="border-t border-white/8 pt-5">
        <h3 className="text-sm font-semibold text-white mb-4">Artist Positioning</h3>
        <div className="grid gap-4">
          <div>
            <Label className="text-xs text-white/60 mb-1 block">Archetype</Label>
            <Input
              value={archetype}
              onChange={(e) => setArchetype(e.target.value)}
              placeholder="caribbean luxury performer"
              className="bg-white/5 border-white/10 text-white text-sm h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-white/60 mb-1 block">Core Promise</Label>
            <Input
              value={promise}
              onChange={(e) => setPromise(e.target.value)}
              placeholder="music that makes the audience feel rich, free and unstoppable"
              className="bg-white/5 border-white/10 text-white text-sm h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-white/60 mb-1 block">Visual Identity</Label>
            <Input
              value={visualIdentity}
              onChange={(e) => setVisualIdentity(e.target.value)}
              placeholder="black, orange, gold, tropical luxury, cinematic"
              className="bg-white/5 border-white/10 text-white text-sm h-9"
            />
          </div>
          <div>
            <Label className="text-xs text-white/60 mb-1 block">Communication Tone</Label>
            <Input
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="confident, magnetic, aspirational"
              className="bg-white/5 border-white/10 text-white text-sm h-9"
            />
          </div>
        </div>
      </section>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold"
      >
        {saveMutation.isPending ? (
          <><Loader2 size={16} className="animate-spin mr-2" /> Saving…</>
        ) : (
          <><Save size={16} className="mr-2" /> Save Audience Profile</>
        )}
      </Button>
    </div>
  );
}
