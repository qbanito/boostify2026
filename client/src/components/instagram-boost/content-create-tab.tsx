import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { useToast } from "../../hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Image, Film, LayoutGrid, BookImage, Sparkles, Download,
  Copy, Check, Loader2, ChevronDown, ChevronUp, Instagram,
  Play, Clock, Wand2, Package, ArrowRight, AlertCircle,
  Save, FolderOpen, Trash2, Music, MapPin, Globe, User,
} from "lucide-react";

interface ContentCreateTabProps {
  artistId?: number;
  selectedArtist?: any;
}

type ContentType = 'post' | 'carousel' | 'reel' | 'story' | 'pack';

const CONTENT_TYPES: { id: ContentType; label: string; icon: React.ReactNode; desc: string; badge?: string }[] = [
  { id: 'post', label: 'Post Image', icon: <Image className="w-5 h-5" />, desc: 'AI-generated square image + caption' },
  { id: 'carousel', label: 'Carousel', icon: <LayoutGrid className="w-5 h-5" />, desc: '3-5 slide visual story' },
  { id: 'reel', label: 'Reel Video', icon: <Film className="w-5 h-5" />, desc: 'AI video from your brand', badge: 'PRO' },
  { id: 'story', label: 'Story', icon: <BookImage className="w-5 h-5" />, desc: 'Vertical story image' },
  { id: 'pack', label: 'Week Pack', icon: <Package className="w-5 h-5" />, desc: 'Full week of content', badge: 'PRO' },
];

const STYLES = ['modern minimal', 'bold urban', 'vintage film', 'neon aesthetic', 'natural light', 'abstract art', 'dark moody', 'bright colorful'];
const MOODS = ['energetic', 'chill', 'dramatic', 'romantic', 'mysterious', 'uplifting', 'raw authentic', 'luxurious'];
const STORY_TYPES = [
  { id: 'promotion', label: 'New Release' },
  { id: 'behind_scenes', label: 'Behind Scenes' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'engagement', label: 'Q&A / Poll' },
  { id: 'aesthetic', label: 'Mood Board' },
];

export function ContentCreateTab({ artistId, selectedArtist }: ContentCreateTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [contentType, setContentType] = useState<ContentType>('post');
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('');
  const [mood, setMood] = useState('');
  const [storyType, setStoryType] = useState('promotion');
  const [slideCount, setSlideCount] = useState(4);
  const [reelConcept, setReelConcept] = useState('');
  const [result, setResult] = useState<any>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [reelStatus, setReelStatus] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch artist context from server
  const { data: artistContext } = useQuery({
    queryKey: ['/api/instagram/content-gen/artist-context', artistId],
    queryFn: async () => {
      if (!artistId) return null;
      const res = await fetch(`/api/instagram/content-gen/artist-context/${artistId}`, { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data.artist;
    },
    enabled: !!artistId,
  });

  // Fetch content library
  const { data: library } = useQuery({
    queryKey: ['/api/instagram/content-gen/library'],
    queryFn: async () => {
      const res = await fetch('/api/instagram/content-gen/library', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    },
  });

  // Auto-suggest style based on genre
  useEffect(() => {
    if (!artistContext?.genre || style) return;
    const genreStyles: Record<string, string> = {
      'hip-hop': 'bold urban', 'rap': 'bold urban', 'trap': 'dark moody',
      'pop': 'bright colorful', 'r&b': 'neon aesthetic', 'electronic': 'neon aesthetic',
      'rock': 'vintage film', 'indie': 'natural light', 'latin': 'bright colorful',
      'jazz': 'vintage film', 'classical': 'modern minimal', 'reggaeton': 'neon aesthetic',
    };
    const g = artistContext.genre.toLowerCase();
    const suggested = Object.entries(genreStyles).find(([k]) => g.includes(k));
    if (suggested) setStyle(suggested[1]);
  }, [artistContext?.genre]);

  // Save to library
  const saveToLibrary = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const imageUrls = result.image ? [result.image] :
        result.slides?.filter((s: any) => s.image).map((s: any) => s.image) ||
        result.posts?.filter((p: any) => p.image).map((p: any) => p.image) || [];

      const res = await fetch('/api/instagram/content-gen/save-to-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          contentType,
          title: result.title || topic || `${contentType} - ${new Date().toLocaleDateString()}`,
          caption: result.caption || '',
          hashtags: result.hashtags || [],
          imageUrls,
          videoUrl: result.videoUrl || null,
          slides: result.slides || null,
          style, mood, topic,
          artistName: artistContext?.name || selectedArtist?.artistName || '',
          artistGenre: artistContext?.genre || '',
          metadata: { queuedToExtension: result.queuedToExtension, actionId: result.actionId },
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      toast({ title: 'Saved to Library', description: 'Content saved for future use' });
      queryClient.invalidateQueries({ queryKey: ['/api/instagram/content-gen/library'] });
    } catch (err: any) {
      toast({ title: 'Save Failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Delete from library  
  const deleteFromLibrary = async (id: number) => {
    try {
      await fetch(`/api/instagram/content-gen/library/${id}`, { method: 'DELETE', credentials: 'include' });
      queryClient.invalidateQueries({ queryKey: ['/api/instagram/content-gen/library'] });
      toast({ title: 'Removed from library' });
    } catch { }
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const endpoints: Record<ContentType, string> = {
        post: '/api/instagram/content-gen/generate-post-image',
        carousel: '/api/instagram/content-gen/generate-carousel',
        reel: '/api/instagram/content-gen/generate-reel',
        story: '/api/instagram/content-gen/generate-story',
        pack: '/api/instagram/content-gen/generate-content-pack',
      };

      const bodies: Record<ContentType, any> = {
        post: { topic, style, mood },
        carousel: { topic, slideCount, style },
        reel: { concept: reelConcept || topic, duration: 5, style },
        story: { type: storyType, topic },
        pack: { weekTheme: topic },
      };

      const res = await fetch(endpoints[contentType], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bodies[contentType]),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      const labels: Record<string, string> = {
        post: 'Post Image', carousel: 'Carousel', reel: 'Reel', story: 'Story', pack: 'Content Pack',
      };
      toast({ title: `${labels[contentType]} Generated!`, description: data.queuedToExtension ? 'Queued to Chrome extension' : 'Ready to use' });

      // If reel is generating, start polling
      if (data.status === 'generating' && data.requestId) {
        setReelStatus('generating');
        pollReelStatus(data.requestId);
      }
    },
    onError: (err: any) => toast({ title: 'Generation Failed', description: err.message, variant: 'destructive' }),
  });

  const pollReelStatus = async (requestId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        setReelStatus('timeout');
        return;
      }
      try {
        const res = await fetch(`/api/instagram/content-gen/reel-status/${requestId}`, { credentials: 'include' });
        const data = await res.json();
        if (data.status === 'completed') {
          clearInterval(interval);
          setReelStatus('completed');
          setResult((prev: any) => ({ ...prev, videoUrl: data.videoUrl, status: 'completed' }));
          toast({ title: 'Reel Video Ready!', description: 'Your AI-generated reel is ready to download' });
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setReelStatus('failed');
        }
      } catch { /* ignore polling errors */ }
    }, 5000);
  };

  return (
    <div className="space-y-4">
      {/* Artist Context Banner */}
      {artistContext ? (
        <Card className="p-3 border-[#833ab4]/20 bg-gradient-to-r from-[#833ab4]/5 via-transparent to-[#fd1d1d]/5">
          <div className="flex items-center gap-3">
            {artistContext.profileImage ? (
              <img src={artistContext.profileImage} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-[#833ab4]/30" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#833ab4] to-[#fd1d1d] flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold truncate">{artistContext.name}</span>
                <Badge variant="secondary" className="text-[10px] shrink-0">{artistContext.genre}</Badge>
                {artistContext.instagram && (
                  <Badge variant="outline" className="text-[10px] shrink-0">@{artistContext.instagram}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
                {artistContext.location && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{artistContext.location}</span>}
                {artistContext.songs?.length > 0 && <span className="flex items-center gap-0.5"><Music className="w-2.5 h-2.5" />{artistContext.songs.length} tracks</span>}
                {artistContext.igStats && <span className="flex items-center gap-0.5"><Instagram className="w-2.5 h-2.5" />{(artistContext.igStats.followers || 0).toLocaleString()} followers</span>}
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={() => setShowLibrary(!showLibrary)}>
              <FolderOpen className="w-3 h-3" />
              Library {library?.length ? `(${library.length})` : ''}
            </Button>
          </div>
          {artistContext.bio && (
            <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 italic">"{artistContext.bio}"</p>
          )}
          {artistContext.songs?.length > 0 && (
            <div className="flex gap-1.5 mt-2 overflow-x-auto hide-scrollbar">
              {artistContext.songs.slice(0, 5).map((song: any, i: number) => (
                <Badge key={i} variant="outline" className="text-[10px] px-2 py-0.5 shrink-0 bg-card">
                  <Music className="w-2.5 h-2.5 mr-0.5" />{song.title}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-3 border-dashed border-muted-foreground/30">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="w-4 h-4" />
            <span className="text-xs">Select an artist above to personalize AI-generated content with their brand, genre, bio and latest songs.</span>
          </div>
        </Card>
      )}

      {/* Content Library Panel */}
      {showLibrary && library && library.length > 0 && (
        <Card className="p-3 border-[#833ab4]/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-[#833ab4]" /> Content Library
            </span>
            <Badge variant="secondary" className="text-[10px]">{library.length} saved</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {library.map((item: any) => (
              <div key={item.id} className="rounded-lg border border-border overflow-hidden bg-card group relative">
                {item.imageUrls?.[0] ? (
                  <img src={item.imageUrls[0]} alt="" className="w-full aspect-square object-cover" />
                ) : (
                  <div className="w-full aspect-square bg-muted flex items-center justify-center">
                    {item.contentType === 'reel' ? <Film className="w-6 h-6 text-muted-foreground" /> :
                     item.contentType === 'carousel' ? <LayoutGrid className="w-6 h-6 text-muted-foreground" /> :
                     <Image className="w-6 h-6 text-muted-foreground" />}
                  </div>
                )}
                <div className="p-1.5">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[8px] px-1">{item.contentType}</Badge>
                    <button onClick={() => deleteFromLibrary(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3 h-3 text-red-400 hover:text-red-600" />
                    </button>
                  </div>
                  {item.caption && <p className="text-[9px] text-muted-foreground truncate mt-0.5">{item.caption.substring(0, 40)}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {/* Content Type Selector */}
      <div className="grid grid-cols-5 gap-2">
        {CONTENT_TYPES.map((ct) => (
          <button
            key={ct.id}
            onClick={() => { setContentType(ct.id); setResult(null); }}
            className={`relative rounded-xl p-3 text-center transition-all ${
              contentType === ct.id
                ? 'bg-gradient-to-br from-[#833ab4]/20 to-[#fd1d1d]/20 border-2 border-[#833ab4]/50 shadow-lg'
                : 'bg-card border border-border hover:border-[#833ab4]/30'
            }`}
          >
            <div className={`mx-auto mb-1 ${contentType === ct.id ? 'text-[#833ab4]' : 'text-muted-foreground'}`}>
              {ct.icon}
            </div>
            <span className="text-xs font-medium block">{ct.label}</span>
            {ct.badge && (
              <Badge className="absolute -top-1.5 -right-1.5 text-[8px] px-1 py-0 bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] text-white border-0">{ct.badge}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <Card className="p-4 space-y-3 border-border">
        <div className="flex items-center gap-2 mb-1">
          <Wand2 className="w-4 h-4 text-[#833ab4]" />
          <span className="text-sm font-semibold">
            {contentType === 'post' && 'Generate Post Image'}
            {contentType === 'carousel' && 'Generate Carousel'}
            {contentType === 'reel' && 'Generate Reel Video'}
            {contentType === 'story' && 'Generate Story'}
            {contentType === 'pack' && 'Generate Week Content Pack'}
          </span>
        </div>

        {/* Topic/Theme Input */}
        <Input
          value={contentType === 'reel' ? reelConcept : topic}
          onChange={(e) => contentType === 'reel' ? setReelConcept(e.target.value) : setTopic(e.target.value)}
          placeholder={
            contentType === 'reel' ? 'Reel concept (e.g. "Studio session vibes")...'
              : contentType === 'pack' ? 'Week theme (e.g. "Album launch week")...'
              : 'Topic or theme (leave empty for AI to decide based on your brand)...'
          }
          className="text-sm"
        />

        {/* Story Type Selector */}
        {contentType === 'story' && (
          <div className="flex flex-wrap gap-1.5">
            {STORY_TYPES.map((st) => (
              <button key={st.id} onClick={() => setStoryType(st.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  storyType === st.id
                    ? 'bg-[#833ab4] text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}>
                {st.label}
              </button>
            ))}
          </div>
        )}

        {/* Carousel Slide Count */}
        {contentType === 'carousel' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Slides:</span>
            {[3, 4, 5].map((n) => (
              <button key={n} onClick={() => setSlideCount(n)}
                className={`w-8 h-8 rounded-lg text-xs font-bold ${
                  slideCount === n ? 'bg-[#833ab4] text-white' : 'bg-muted text-muted-foreground'
                }`}>
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Style & Mood Options */}
        <button onClick={() => setShowOptions(!showOptions)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {showOptions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Style & Mood Options
        </button>

        {showOptions && (
          <div className="space-y-2 pt-1">
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">Style</span>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((s) => (
                  <button key={s} onClick={() => setStyle(style === s ? '' : s)}
                    className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
                      style === s ? 'bg-[#833ab4] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">Mood</span>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button key={m} onClick={() => setMood(mood === m ? '' : m)}
                    className={`px-2.5 py-1 rounded-full text-[11px] transition-all ${
                      mood === m ? 'bg-[#fd1d1d] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="w-full h-11 bg-gradient-to-r from-[#833ab4] via-[#fd1d1d] to-[#fcb045] text-white font-semibold hover:opacity-90"
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {contentType === 'pack' ? 'Generating Week Pack...' : 'Creating...'}
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate {contentType === 'pack' ? 'Content Pack' : contentType === 'carousel' ? `${slideCount}-Slide Carousel` : contentType.charAt(0).toUpperCase() + contentType.slice(1)}
            </>
          )}
        </Button>
      </Card>

      {/* Results */}
      {result && (
        <Card className="p-4 space-y-4 border-[#833ab4]/20">
          {/* Single Post Image */}
          {contentType === 'post' && result.image && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-semibold">Post Ready</span>
                  {result.artist && <Badge variant="secondary" className="text-[10px]">{result.artist.genre}</Badge>}
                </div>
                {result.queuedToExtension && (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">
                    <Instagram className="w-3 h-3 mr-0.5" /> Queued
                  </Badge>
                )}
              </div>
              <div className="rounded-xl overflow-hidden border border-border">
                <img src={result.image} alt="Generated post" className="w-full aspect-square object-cover" />
              </div>
              {result.caption && (
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <p className="text-sm leading-relaxed">{result.caption}</p>
                  {result.hashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.hashtags.map((h: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{h.startsWith('#') ? h : `#${h}`}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                      navigator.clipboard.writeText(result.caption + '\n\n' + (result.hashtags || []).join(' '));
                      setCopiedCaption(true); setTimeout(() => setCopiedCaption(false), 2000);
                    }}>
                      {copiedCaption ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />} Copy Caption
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                      const a = document.createElement('a'); a.href = result.image; a.download = `boostify-post-${Date.now()}.png`; a.click();
                    }}>
                      <Download className="w-3 h-3" /> Download
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Carousel */}
          {contentType === 'carousel' && result.slides && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{result.title || 'Carousel Ready'}</span>
                <Badge variant="secondary" className="text-[10px]">{result.slides.filter((s: any) => s.image).length}/{result.slides.length} slides</Badge>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
                {result.slides.map((slide: any, i: number) => (
                  <div key={i} className="shrink-0 w-48 rounded-xl overflow-hidden border border-border">
                    {slide.image ? (
                      <img src={slide.image} alt={`Slide ${i+1}`} className="w-full aspect-square object-cover" />
                    ) : (
                      <div className="w-full aspect-square bg-muted flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-[10px] font-medium truncate">{slide.text}</p>
                      <Badge variant="outline" className="text-[8px] px-1 py-0 mt-0.5">{slide.purpose}</Badge>
                    </div>
                  </div>
                ))}
              </div>
              {result.caption && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm">{result.caption}</p>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 mt-2" onClick={() => {
                    navigator.clipboard.writeText(result.caption + '\n\n' + (result.hashtags || []).join(' '));
                    toast({ title: 'Copied!' });
                  }}>
                    <Copy className="w-3 h-3" /> Copy Caption
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Reel Video */}
          {contentType === 'reel' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[#fd1d1d]" />
                <span className="text-sm font-semibold">
                  {result.status === 'completed' ? 'Reel Ready' :
                   result.status === 'generating' ? 'Generating Video...' :
                   result.status === 'image_only' ? 'Base Frame Generated' : 'Reel'}
                </span>
                {reelStatus === 'generating' && <Loader2 className="w-4 h-4 animate-spin text-[#833ab4]" />}
              </div>

              {result.baseImage && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={result.baseImage} alt="Base frame" className="w-full aspect-video object-cover" />
                  {result.status === 'generating' && (
                    <div className="bg-gradient-to-r from-[#833ab4] to-[#fd1d1d] p-2 text-center">
                      <span className="text-xs text-white font-medium">Video generating... this may take 1-3 minutes</span>
                    </div>
                  )}
                </div>
              )}

              {result.videoUrl && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <video src={result.videoUrl} controls className="w-full" />
                  <div className="p-2 flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                      const a = document.createElement('a'); a.href = result.videoUrl; a.download = `boostify-reel-${Date.now()}.mp4`; a.click();
                    }}>
                      <Download className="w-3 h-3" /> Download Reel
                    </Button>
                  </div>
                </div>
              )}

              {result.caption && (
                <div className="bg-muted/30 rounded-lg p-2">
                  <p className="text-xs">{result.caption}</p>
                </div>
              )}

              {result.message && (
                <p className="text-xs text-muted-foreground">{result.message}</p>
              )}
            </div>
          )}

          {/* Story */}
          {contentType === 'story' && result.image && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BookImage className="w-4 h-4 text-[#fcb045]" />
                <span className="text-sm font-semibold">Story Ready</span>
                <Badge variant="secondary" className="text-[10px]">{result.storyType}</Badge>
              </div>
              <div className="mx-auto w-48 rounded-2xl overflow-hidden border border-border shadow-lg">
                <img src={result.image} alt="Story" className="w-full aspect-[9/16] object-cover" />
              </div>
              <div className="flex justify-center gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => {
                  const a = document.createElement('a'); a.href = result.image; a.download = `boostify-story-${Date.now()}.png`; a.click();
                }}>
                  <Download className="w-3 h-3" /> Download
                </Button>
                {result.queuedToExtension && (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] flex items-center">
                    <Instagram className="w-3 h-3 mr-0.5" /> Queued to Extension
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Week Content Pack */}
          {contentType === 'pack' && result.posts && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#833ab4]" />
                  <span className="text-sm font-semibold">{result.weekTheme}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">{result.totalContent} pieces</Badge>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">Generated Posts</span>
                <div className="grid grid-cols-3 gap-2">
                  {result.posts.map((post: any, i: number) => (
                    <div key={i} className="rounded-xl overflow-hidden border border-border">
                      {post.image ? (
                        <img src={post.image} alt={post.day} className="w-full aspect-square object-cover" />
                      ) : (
                        <div className="w-full aspect-square bg-muted flex items-center justify-center">
                          <Clock className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="p-1.5">
                        <span className="text-[10px] font-bold">{post.day}</span>
                        <p className="text-[9px] text-muted-foreground truncate">{post.caption?.substring(0, 40)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {result.remainingPosts?.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Planned (no images yet)</span>
                  {result.remainingPosts.map((post: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                      <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">{post.day}</Badge>
                      <span className="text-xs truncate">{post.caption?.substring(0, 60)}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.stories?.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-muted-foreground">Story Ideas</span>
                  {result.stories.map((story: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                      <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">{story.day}</Badge>
                      <span className="text-[10px] text-muted-foreground">{story.storyType}</span>
                      <span className="text-xs truncate flex-1">{story.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.queuedToExtension > 0 && (
                <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2 flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">{result.queuedToExtension} posts queued to Chrome extension</span>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Save to Library Button */}
      {result && (
        <div className="flex items-center gap-2">
          <Button
            onClick={saveToLibrary}
            disabled={saving}
            variant="outline"
            className="flex-1 h-9 text-xs border-[#833ab4]/30 hover:bg-[#833ab4]/10"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Save to Library
          </Button>
          {result.queuedToExtension && (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] h-9 px-3 flex items-center">
              <Instagram className="w-3 h-3 mr-1" /> Queued to Extension
            </Badge>
          )}
        </div>
      )}

      {/* Empty State */}
      {!result && !generateMutation.isPending && (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Select a content type and generate</p>
          <p className="text-xs mt-1">
            {artistContext
              ? `AI will create content tailored to ${artistContext.name}'s ${artistContext.genre} brand`
              : 'Select an artist for personalized AI content'
            }
          </p>
        </div>
      )}
    </div>
  );
}
