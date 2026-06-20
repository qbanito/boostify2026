import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Copy, RefreshCw, Instagram, Facebook, Loader2,
  Hash, TrendingUp, Share2, ChevronDown, ChevronUp, Music2,
  ImageIcon, Download, Wand2, Send
} from 'lucide-react';

interface SocialPost {
  id: number;
  platform: 'facebook' | 'instagram' | 'tiktok';
  caption: string;
  hashtags: string[];
  cta: string;
  viralScore?: number;
  imageUrl?: string | null;
  imageModel?: string | null;
  createdAt: string;
}

interface SocialPostsDisplayProps {
  userId: number;
  isOwner?: boolean;
  colors?: { hexAccent: string; hexPrimary: string; hexBorder: string };
}

const PLATFORM_CONFIG = {
  instagram: {
    label: 'Instagram',
    icon: Instagram,
    gradient: 'from-pink-500 via-purple-500 to-orange-400',
    bg: 'rgba(236,72,153,0.08)',
    border: 'rgba(236,72,153,0.25)',
    color: '#ec4899',
  },
  tiktok: {
    label: 'TikTok',
    icon: Music2,
    gradient: 'from-black via-zinc-800 to-red-500',
    bg: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.12)',
    color: '#f97316',
  },
  facebook: {
    label: 'Facebook',
    icon: Facebook,
    gradient: 'from-blue-600 to-blue-400',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.25)',
    color: '#3b82f6',
  },
};

export function SocialPostsDisplay({ userId, isOwner = false, colors }: SocialPostsDisplayProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedPost, setExpandedPost] = useState<number | null>(null);
  const [generatingImageFor, setGeneratingImageFor] = useState<number | null>(null);
  const [publishingFor, setPublishingFor] = useState<number | null>(null);
  const accent = colors?.hexAccent || '#f97316';

  const { data, isLoading } = useQuery<{ success: boolean; posts: SocialPost[] }>({
    queryKey: ['/api/social-media/posts', userId],
    queryFn: async () => {
      const res = await fetch(`/api/social-media/posts/${userId}`);
      return res.json();
    },
    enabled: !!userId,
  });

  const posts: SocialPost[] = data?.posts || [];

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/social-media/generate-from-master/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Generation failed');
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts', userId] });
      toast({ title: `✅ ${data.count} posts generated!`, description: 'Posts + publishable images ready to share on your socials.' });
    },
    onError: (err: any) => {
      toast({ title: '❌ Generation failed', description: err.message, variant: 'destructive' });
    },
  });

  const imageMutation = useMutation({
    mutationFn: async (postId: number) => {
      setGeneratingImageFor(postId);
      const res = await fetch(`/api/social-media/posts/${postId}/generate-image`, { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Image generation failed');
      return json;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-media/posts', userId] });
      const isOpenAI = data.model?.startsWith('dall-e') || data.model?.startsWith('gpt-image');
      toast({ title: '🖼️ Image ready!', description: `Generated with ${isOpenAI ? 'OpenAI' : 'FAL AI'} — ready to publish.` });
    },
    onError: (err: any) => {
      toast({ title: '❌ Image generation failed', description: err.message, variant: 'destructive' });
    },
    onSettled: () => setGeneratingImageFor(null),
  });

  // Publish a post to the artist's connected social account via the Chrome
  // extension bridge (POST /api/social-integration/publish-external). Returns a
  // friendly message when no extension is connected (HTTP 409).
  const publishMutation = useMutation({
    mutationFn: async (post: SocialPost) => {
      setPublishingFor(post.id);
      return apiRequest('/api/social-integration/publish-external', 'POST', {
        sourceType: 'social_post',
        sourceId: post.id,
        platform: post.platform,
        caption: `${post.caption}\n\n${post.hashtags.map(t => `#${t}`).join(' ')}`.trim(),
        imageUrl: post.imageUrl || undefined,
        hashtags: post.hashtags,
        priority: 5,
      });
    },
    onSuccess: (data: any, post) => {
      const label = PLATFORM_CONFIG[post.platform]?.label || post.platform;
      toast({ title: `🚀 Encolado para ${label}`, description: data?.message || 'Se publicará en el próximo sync de la extensión.' });
    },
    onError: (err: any) => {
      // apiRequest throws "409: {json}" — surface the friendly server message.
      let msg = err?.message || 'No se pudo publicar.';
      const m = /^\d+:\s*(\{.*\})$/.exec(msg);
      if (m) {
        try { msg = JSON.parse(m[1]).error || msg; } catch { /* keep raw */ }
      }
      toast({ title: 'No se pudo publicar', description: msg, variant: 'destructive' });
    },
    onSettled: () => setPublishingFor(null),
  });

  const downloadImage = async (post: SocialPost) => {
    if (!post.imageUrl) return;
    try {
      const resp = await fetch(post.imageUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${post.platform}-post-${post.id}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(post.imageUrl, '_blank');
    }
  };

  const copyToClipboard = (post: SocialPost) => {
    const text = `${post.caption}\n\n${post.hashtags.map(t => `#${t}`).join(' ')}\n\n${post.cta}`;
    navigator.clipboard.writeText(text);
    toast({ title: '📋 Copied!', description: `${PLATFORM_CONFIG[post.platform]?.label} post copied to clipboard.` });
  };

  if (isLoading) {
    return (
      <div className="space-y-3 mt-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  // Empty state — owner sees generate button, visitors see nothing
  if (posts.length === 0) {
    if (!isOwner) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-4 flex flex-col items-center justify-center py-10 px-4 rounded-2xl border border-dashed text-center"
        style={{ borderColor: `${accent}40`, background: `${accent}06` }}
      >
        <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          style={{ background: `${accent}15` }}>
          <Share2 className="w-7 h-7" style={{ color: accent }} />
        </div>
        <h4 className="text-white font-bold text-lg mb-1">No social posts yet</h4>
        <p className="text-gray-400 text-sm mb-5 max-w-xs">
          Let AI generate 3 viral posts with publishable images for Instagram, TikTok & Facebook — personalized to your artist DNA.
        </p>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="font-bold shadow-lg"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: 'white' }}
        >
          {generateMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />Generate AI Posts</>
          )}
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: accent }} />
          <span className="text-sm font-semibold text-white">AI-Generated Posts</span>
          <Badge className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}>
            {posts.length} posts
          </Badge>
        </div>
        {isOwner && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="text-xs h-7 px-3 text-gray-400 hover:text-white"
          >
            {generateMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Regenerate
          </Button>
        )}
      </div>

      {/* Post cards */}
      <div className="grid grid-cols-1 gap-3">
        {posts.map((post, i) => {
          const cfg = PLATFORM_CONFIG[post.platform] || PLATFORM_CONFIG.instagram;
          const Icon = cfg.icon;
          const isExpanded = expandedPost === i;

          return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl overflow-hidden border"
              style={{ background: cfg.bg, borderColor: cfg.border }}
            >
              {/* Platform bar */}
              <div className="flex items-center justify-between px-3 py-2"
                style={{ background: `${cfg.color}15`, borderBottom: `1px solid ${cfg.border}` }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center"
                    style={{ background: cfg.color }}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-bold text-white">{cfg.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {post.viralScore && (
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-green-400" />
                      <span className="text-[10px] text-green-400 font-bold">{post.viralScore}</span>
                    </div>
                  )}
                  <button
                    onClick={() => setExpandedPost(isExpanded ? null : i)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Publishable image */}
              {post.imageUrl ? (
                <div className="relative group/img flex justify-center bg-black/30">
                  <img
                    src={post.imageUrl}
                    alt={`${cfg.label} post image`}
                    loading="lazy"
                    className="mx-auto w-auto max-w-full max-h-[480px] object-contain"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity" />
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover/img:opacity-100 transition-opacity">
                    {isOwner && (
                      <button
                        onClick={() => imageMutation.mutate(post.id)}
                        disabled={generatingImageFor !== null}
                        title="Regenerate image"
                        className="w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-md bg-black/50 border border-white/20 text-white hover:bg-black/70 transition-colors"
                      >
                        {generatingImageFor === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    <button
                      onClick={() => downloadImage(post)}
                      title="Download image"
                      className="w-8 h-8 rounded-lg flex items-center justify-center backdrop-blur-md bg-black/50 border border-white/20 text-white hover:bg-black/70 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {post.imageModel && (
                    <span className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded backdrop-blur-md bg-black/50 text-white/80 border border-white/15">
                      {post.imageModel.startsWith('dall-e') || post.imageModel.startsWith('gpt-image') ? 'OpenAI' : 'AI'}
                    </span>
                  )}
                </div>
              ) : isOwner ? (
                <div className="px-3 pt-2">
                  <button
                    onClick={() => imageMutation.mutate(post.id)}
                    disabled={generatingImageFor !== null}
                    className="w-full h-20 rounded-lg border border-dashed flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors hover:bg-white/5 disabled:opacity-60"
                    style={{ borderColor: cfg.border, color: cfg.color }}
                  >
                    {generatingImageFor === post.id ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Generating image…</>
                    ) : (
                      <><ImageIcon className="w-4 h-4" />Generate publishable image</>
                    )}
                  </button>
                </div>
              ) : null}

              {/* Caption preview */}
              <div className="px-3 py-2">
                <p className="text-sm text-gray-200 leading-relaxed"
                  style={{ display: '-webkit-box', WebkitLineClamp: isExpanded ? 'unset' : 2, WebkitBoxOrient: 'vertical', overflow: isExpanded ? 'visible' : 'hidden' }}>
                  {post.caption}
                </p>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-3 pb-3 space-y-2"
                  >
                    {/* Hashtags */}
                    <div className="flex items-start gap-1.5 flex-wrap">
                      <Hash className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: cfg.color }} />
                      <div className="flex flex-wrap gap-1">
                        {post.hashtags.map((tag, j) => (
                          <span key={j} className="text-[11px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: `${cfg.color}20`, color: cfg.color }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    {/* CTA */}
                    <p className="text-xs text-gray-400 italic">{post.cta}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Copy + Publish buttons */}
              <div className="px-3 pb-3 space-y-2">
                <Button
                  size="sm"
                  className="w-full h-8 text-xs font-semibold"
                  style={{ background: `${cfg.color}25`, color: cfg.color, border: `1px solid ${cfg.border}` }}
                  onClick={() => copyToClipboard(post)}
                >
                  <Copy className="w-3 h-3 mr-1.5" />
                  Copy {cfg.label} Post
                </Button>
                {isOwner && (
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs font-bold"
                    style={{ background: `linear-gradient(135deg, ${cfg.color}, ${cfg.color}cc)`, color: 'white' }}
                    disabled={publishingFor !== null}
                    onClick={() => publishMutation.mutate(post)}
                    title={`Publicar en ${cfg.label}`}
                  >
                    {publishingFor === post.id ? (
                      <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Publicando…</>
                    ) : (
                      <><Send className="w-3 h-3 mr-1.5" />Publicar en {cfg.label}</>
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

