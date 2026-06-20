/**
 * ExplicitContentSection — Main module component for Boostify Explicit
 * Renders inside artist-profile-card as section 'explicit-content'
 * 5 internal tabs: Content / AI Studio / Chat / Earnings / Settings
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { useToast } from "../../hooks/use-toast";
import {
  Flame, Lock, Unlock, Image, Video, MessageCircle,
  DollarSign, Settings, Sparkles, Send, Upload, Trash2,
  Eye, Heart, ChevronDown, ChevronRight, Wand2, Play,
  Check, X, Loader2, Crown, Star, Zap, HelpCircle,
  CreditCard, MessageSquare,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const GUIDE_ITEMS = [
  {
    icon: Flame,
    color: '#f97316',
    title: 'What is Exclusive Content?',
    body: 'Your Exclusive Content module is a built-in subscription platform. Fans pay a monthly or yearly fee to access your premium content — behind-the-scenes footage, unreleased music, personal videos, and exclusive photos.',
  },
  {
    icon: Image,
    color: '#a855f7',
    title: 'Content Tab — Upload & Manage',
    body: 'Upload images, videos, or audio files up to 100MB. Each piece can be set as free (visible to all) or paywalled (subscribers only). Click the trash icon to hide content; Shift+click to permanently delete it.',
  },
  {
    icon: Lock,
    color: '#3b82f6',
    title: 'Paywall & Pricing',
    body: 'In Settings, configure your Monthly, Yearly, and per-item Single Purchase price. Paywalled content shows a blurred preview with a lock icon to non-subscribers, giving them a reason to subscribe.',
  },
  {
    icon: Wand2,
    color: '#ec4899',
    title: 'AI Studio — Generate Content',
    body: 'Generate exclusive images and videos using AI models like FLUX Dev, FLUX Schnell, or the uncensored FHDR model. Once generated, click "Publish" to instantly add them to your exclusive content feed.',
  },
  {
    icon: MessageSquare,
    color: '#10b981',
    title: 'Chat with Fans',
    body: 'Subscribers can send you direct messages through the Chat tab. You can reply to create a personal connection. Fans can also attach tips to their messages as a form of support.',
  },
  {
    icon: DollarSign,
    color: '#f59e0b',
    title: 'Earnings & Revenue',
    body: 'The Earnings tab tracks your active subscribers, total subscription revenue, individual content purchases, and tips received. AI generation costs are shown so you can track your net profit.',
  },
  {
    icon: Settings,
    color: '#06b6d4',
    title: 'Settings & Configuration',
    body: 'Enable or disable the entire module from Settings. Configure pricing, write a welcome message for new subscribers, and toggle features like Chat, AI Generation, and image watermarking.',
  },
  {
    icon: Crown,
    color: '#8b5cf6',
    title: 'Tips for Success',
    body: 'Post at least 3–5 pieces of content before enabling the module. Mix free previews with paywalled exclusives to show fans what they are missing. Use AI Studio to generate content quickly without expensive shoots.',
  },
];

interface ExplicitContentSectionProps {
  artistId: string;
  userId?: string | number | null;
  isOwnProfile: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  colors: {
    hexAccent: string;
    hexPrimary: string;
    hexSecondary?: string;
  };
  cardStyles: string;
  cardStyleInline: React.CSSProperties;
  artistName?: string;
}

type Tab = 'content' | 'ai-studio' | 'chat' | 'earnings' | 'settings';

interface ExplicitContentItem {
  id: number;
  type: string;
  title: string;
  description?: string;
  category?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  blurredPreviewUrl?: string;
  isPaywalled: boolean;
  singlePurchasePrice?: string;
  viewCount: number;
  likeCount: number;
  createdAt: string;
  locked?: boolean;
  purchased?: boolean;
  aiModel?: string;
  aiPrompt?: string;
}

interface AiGeneration {
  id: number;
  type: string;
  model: string;
  prompt: string;
  resultUrl?: string;
  thumbnailUrl?: string;
  status: string;
  costUsd?: string;
  createdAt: string;
  publishedAsContentId?: number | null;
  allImages?: Array<{ url: string }>;
}

interface ChatMessage {
  id: number;
  senderId: number;
  receiverId: number;
  message: string;
  mediaUrl?: string;
  mediaType?: string;
  tipAmount?: string;
  createdAt: string;
}

interface ExplicitSettings {
  enabled: boolean;
  monthlyPrice?: string;
  yearlyPrice?: string;
  singleContentPrice?: string;
  welcomeMessage?: string;
  contentCategories?: string[];
  chatEnabled?: boolean;
  aiGenerationEnabled?: boolean;
  watermarkEnabled?: boolean;
}

interface EarningsData {
  activeSubscribers: number;
  purchaseRevenue: number;
  tipRevenue: number;
  totalRevenue: number;
  contentCount: number;
  aiGenerationCosts: number;
}

const API_BASE = '/api/explicit';

// Use the shared apiRequest so the Clerk Bearer token is attached automatically
// and requests run with credentials. JSON body is auto-stringified; FormData is
// passed as-is so the browser sets the correct multipart boundary.
async function fetchApi(path: string, options?: { method?: string; body?: any; headers?: HeadersInit }) {
  const method = options?.method || 'GET';
  const isForm = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  let data: any;
  if (options?.body == null) {
    data = undefined;
  } else if (isForm) {
    data = options.body;
  } else if (typeof options.body === 'string') {
    try { data = JSON.parse(options.body); } catch { data = options.body; }
  } else {
    data = options.body;
  }
  return apiRequest(`${API_BASE}${path}`, {
    method,
    data,
    headers: options?.headers,
  });
}

export function ExplicitContentSection({
  artistId, userId, isOwnProfile, isExpanded, onToggleExpand,
  colors, cardStyles, cardStyleInline, artistName,
}: ExplicitContentSectionProps) {
  const [activeTab, setActiveTab] = useState<Tab>('content');
  const [showGuide, setShowGuide] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Settings ───
  const { data: settings } = useQuery<ExplicitSettings>({
    queryKey: ['explicit-settings', artistId],
    queryFn: () => fetchApi(`/settings/${artistId}`),
  });

  // ─── Subscription check ───
  const { data: subStatus } = useQuery({
    queryKey: ['explicit-sub-check', artistId],
    queryFn: () => fetchApi(`/subscription/check/${artistId}`),
    enabled: !isOwnProfile,
  });

  const hasAccess = isOwnProfile || subStatus?.subscribed || subStatus?.isOwner;

  // Don't render if module is not enabled and not owner
  if (!isOwnProfile && !settings?.enabled) return null;

  const tabs: Array<{ key: Tab; label: string; icon: any; ownerOnly?: boolean }> = [
    { key: 'content', label: 'Content', icon: Image },
    { key: 'ai-studio', label: 'AI Studio', icon: Wand2, ownerOnly: true },
    { key: 'chat', label: 'Chat', icon: MessageCircle },
    { key: 'earnings', label: 'Earnings', icon: DollarSign, ownerOnly: true },
    { key: 'settings', label: 'Settings', icon: Settings, ownerOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.ownerOnly || isOwnProfile);

  return (
    <div className={cardStyles} style={cardStyleInline}>

      {/* ── GUIDE OVERLAY ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showGuide && (
          <motion.div
            key="exclusive-guide"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowGuide(false); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10"
              style={{ background: 'linear-gradient(145deg,#0f0f14,#1a1a24)' }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/8" style={{ background: 'rgba(15,15,20,0.95)', backdropFilter: 'blur(12px)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${colors.hexAccent}25` }}>
                    <HelpCircle className="w-4 h-4" style={{ color: colors.hexAccent }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black tracking-widest uppercase" style={{ color: colors.hexAccent }}>How it works</p>
                    <h3 className="text-base font-bold text-white leading-tight">Exclusive Content Guide</h3>
                  </div>
                </div>
                <button onClick={() => setShowGuide(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-4 sm:px-6 py-4 space-y-3">
                {GUIDE_ITEMS.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex gap-3 p-3 rounded-xl border border-white/6"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ background: `${item.color}20` }}>
                      <item.icon className="w-4 h-4" style={{ color: item.color }} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white mb-1">{item.title}</p>
                      <p className="text-xs text-gray-400 leading-relaxed">{item.body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="px-4 sm:px-6 py-4 border-t border-white/8">
                <p className="text-[10px] text-gray-500 text-center">Subscriptions processed via Stripe · Content stored on Firebase</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Section header */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={onToggleExpand}
          className="flex-1 text-left flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
        >
          <div className="text-base font-semibold flex items-center gap-2 min-w-0" style={{ color: colors.hexAccent }}>
            {isExpanded ? <ChevronDown className="h-5 w-5 flex-shrink-0" /> : <ChevronRight className="h-5 w-5 flex-shrink-0" />}
            <Flame className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">🔥 Exclusive Content</span>
            {!settings?.enabled && isOwnProfile && (
              <Badge variant="outline" className="ml-2 text-xs flex-shrink-0">Disabled</Badge>
            )}
          </div>
        </button>
        <button
          onClick={() => setShowGuide(true)}
          className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-gray-400 hover:opacity-80 transition-colors"
          style={{ color: colors.hexAccent }}
          title="How it works"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Tab navigation */}
          <div className="flex gap-1 overflow-x-auto pb-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {visibleTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.key ? 'text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
                }`}
                style={activeTab === tab.key ? { backgroundColor: colors.hexAccent } : undefined}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'content' && (
            <ContentTab artistId={artistId} isOwnProfile={isOwnProfile} hasAccess={hasAccess} colors={colors} settings={settings} />
          )}
          {activeTab === 'ai-studio' && isOwnProfile && (
            <AiStudioTab artistId={artistId} colors={colors} />
          )}
          {activeTab === 'chat' && hasAccess && (
            <ChatTab artistId={artistId} isOwnProfile={isOwnProfile} colors={colors} />
          )}
          {activeTab === 'chat' && !hasAccess && (
            <SubscribeCTA artistId={artistId} settings={settings} colors={colors} artistName={artistName} />
          )}
          {activeTab === 'earnings' && isOwnProfile && (
            <EarningsTab artistId={artistId} colors={colors} />
          )}
          {activeTab === 'settings' && isOwnProfile && (
            <SettingsTab artistId={artistId} settings={settings} colors={colors} />
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CONTENT TAB
// ═══════════════════════════════════════════════════════════════
function ContentTab({ artistId, isOwnProfile, hasAccess, colors, settings }: {
  artistId: string; isOwnProfile: boolean; hasAccess: boolean;
  colors: { hexAccent: string }; settings?: ExplicitSettings;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: '', description: '', mediaUrl: '', type: 'image' as string, isPaywalled: true });
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading } = useQuery<{ items: ExplicitContentItem[]; hasAccess: boolean }>({
    queryKey: ['explicit-content', artistId],
    queryFn: () => fetchApi(`/content/${artistId}`),
  });

  // Upload selected file -> Firebase via /content/upload, then auto-fill mediaUrl
  const handleFilePick = useCallback(async (file: File) => {
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 100MB.', variant: 'destructive' });
      return;
    }
    setIsUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const result = await fetchApi('/content/upload', { method: 'POST', body: fd });
      if (!result?.success || !result?.mediaUrl) {
        throw new Error(result?.error || 'Upload failed');
      }
      const detected =
        file.type.startsWith('video/') ? 'video' :
        file.type.startsWith('audio/') ? 'audio' : 'image';
      setUploadForm(prev => ({
        ...prev,
        mediaUrl: result.mediaUrl,
        type: detected,
        title: prev.title || file.name.replace(/\.[^.]+$/, ''),
      }));
      toast({ title: 'File uploaded', description: 'Add a title and click Publish.' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setIsUploadingFile(false);
    }
  }, [toast]);

  const uploadMutation = useMutation({
    mutationFn: (payload: any) => fetchApi('/content', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explicit-content', artistId] });
      setShowUpload(false);
      setUploadForm({ title: '', description: '', mediaUrl: '', type: 'image', isPaywalled: true });
      toast({ title: 'Content published!' });
    },
    onError: (err: Error) => toast({ title: 'Publish failed', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, hard }: { id: number; hard?: boolean }) =>
      fetchApi(`/content/${id}${hard ? '?hard=true' : ''}`, { method: 'DELETE' }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['explicit-content', artistId] });
      toast({ title: vars.hard ? 'Content permanently deleted' : 'Content hidden' });
    },
    onError: (err: Error) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' }),
  });

  const [editItem, setEditItem] = useState<ExplicitContentItem | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', isPaywalled: true, singlePurchasePrice: '' });

  const openEdit = useCallback((item: ExplicitContentItem) => {
    setEditItem(item);
    setEditForm({
      title: item.title || '',
      description: item.description || '',
      isPaywalled: item.isPaywalled,
      singlePurchasePrice: item.singlePurchasePrice || '',
    });
  }, []);

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      fetchApi(`/content/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explicit-content', artistId] });
      setEditItem(null);
      toast({ title: 'Content updated' });
    },
    onError: (err: Error) => toast({ title: 'Update failed', description: err.message, variant: 'destructive' }),
  });

  const items = data?.items || [];

  return (
    <div className="space-y-4">
      {/* Upload button for owner */}
      {isOwnProfile && (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => setShowUpload(!showUpload)}
            style={{ backgroundColor: colors.hexAccent }}
            className="text-white"
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload Content
          </Button>
        </div>
      )}

      {/* Upload form */}
      {showUpload && isOwnProfile && (
        <div className="p-4 rounded-lg border space-y-3" style={{ borderColor: colors.hexAccent + '40' }}>
          {/* File picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleFilePick(f);
              e.currentTarget.value = '';
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isUploadingFile}
              onClick={() => fileInputRef.current?.click()}
              style={{ borderColor: colors.hexAccent, color: colors.hexAccent }}
            >
              {isUploadingFile ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4 mr-1" /> Pick file</>}
            </Button>
            <span className="text-[11px] opacity-60">Image / video / audio · max 100MB</span>
          </div>

          {uploadForm.mediaUrl && (
            <div className="flex items-center gap-2 text-[11px] opacity-70 break-all">
              <Check className="h-3 w-3 text-green-400 shrink-0" />
              <span className="truncate" title={uploadForm.mediaUrl}>{uploadForm.mediaUrl}</span>
            </div>
          )}

          <Input
            placeholder="Title"
            value={uploadForm.title}
            onChange={e => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
          />
          <Textarea
            placeholder="Description"
            value={uploadForm.description}
            onChange={e => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
          />
          <Input
            placeholder="Or paste a Media URL (optional if you picked a file)"
            value={uploadForm.mediaUrl}
            onChange={e => setUploadForm(prev => ({ ...prev, mediaUrl: e.target.value }))}
          />
          <div className="flex gap-2">
            <select
              className="rounded border px-2 py-1 text-sm bg-black/20"
              value={uploadForm.type}
              onChange={e => setUploadForm(prev => ({ ...prev, type: e.target.value }))}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="gallery">Gallery</option>
            </select>
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={uploadForm.isPaywalled}
                onChange={e => setUploadForm(prev => ({ ...prev, isPaywalled: e.target.checked }))}
              />
              Paywalled
            </label>
          </div>
          <Button
            size="sm"
            disabled={!uploadForm.title || !uploadForm.mediaUrl || uploadMutation.isPending || isUploadingFile}
            onClick={() => uploadMutation.mutate(uploadForm)}
            style={{ backgroundColor: colors.hexAccent }}
            className="text-white"
          >
            {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish'}
          </Button>
        </div>
      )}

      {/* Content grid */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: colors.hexAccent }} />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm opacity-60 py-8">
          {isOwnProfile ? 'No content yet. Upload your first exclusive content!' : 'No exclusive content available yet.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {items.map(item => (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative rounded-xl overflow-hidden group cursor-pointer"
              style={{ border: `1px solid ${colors.hexAccent}25` }}
            >
              {/* Thumbnail / preview */}
              <div className="aspect-square bg-black/30 flex items-center justify-center relative">
                {item.thumbnailUrl || item.mediaUrl ? (
                  <img
                    src={item.locked ? (item.blurredPreviewUrl || item.thumbnailUrl) : (item.thumbnailUrl || item.mediaUrl)}
                    alt={item.title}
                    className={`w-full h-full object-cover ${item.locked ? 'blur-xl' : ''}`}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 opacity-40">
                    {item.type === 'video' ? <Video className="h-8 w-8" /> : <Image className="h-8 w-8" />}
                  </div>
                )}

                {/* Lock overlay */}
                {item.locked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.35) 100%)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1.5" style={{ background: `${colors.hexAccent}30`, border: `1px solid ${colors.hexAccent}50` }}>
                      <Lock className="h-5 w-5" style={{ color: colors.hexAccent }} />
                    </div>
                    {item.singlePurchasePrice && (
                      <span className="text-white text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.hexAccent + 'cc' }}>${item.singlePurchasePrice}</span>
                    )}
                  </div>
                )}

                {/* Type badge */}
                <Badge
                  className="absolute top-2 left-2 text-[10px]"
                  style={{ backgroundColor: colors.hexAccent }}
                >
                  {item.type}
                </Badge>

                {/* Delete button (owner) — click = hide, Shift+click = permanent */}
                {isOwnProfile && (
                  <button
                    title="Click to hide · Shift+click to permanently delete"
                    onClick={e => {
                      e.stopPropagation();
                      const hard = e.shiftKey;
                      const msg = hard
                        ? `Permanently delete "${item.title}"? This removes the file from storage and cannot be undone.`
                        : `Hide "${item.title}" from your profile?`;
                      if (window.confirm(msg)) {
                        deleteMutation.mutate({ id: item.id, hard });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="absolute top-2 right-2 p-1 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                )}

                {/* Edit button (owner) */}
                {isOwnProfile && (
                  <button
                    title="Edit content"
                    onClick={e => { e.stopPropagation(); openEdit(item); }}
                    className="absolute top-2 right-10 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: colors.hexAccent + 'cc' }}
                  >
                    <Settings className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Info */}
              <div className="p-2.5" style={{ background: 'rgba(0,0,0,0.6)' }}>
                <p className="text-xs font-semibold text-white truncate">{item.title}</p>
                <div className="flex gap-2 text-[10px] text-gray-400 mt-1">
                  <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" /> {item.viewCount}</span>
                  <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" style={{ color: item.likeCount > 0 ? '#f43f5e' : undefined }} /> {item.likeCount}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Subscribe CTA for non-subscribed visitors */}
      {!hasAccess && !isOwnProfile && items.length > 0 && (
        <SubscribeCTA artistId={artistId} settings={settings} colors={colors} />
      )}

      {/* Edit modal (owner) */}
      <AnimatePresence>
        {editItem && (
          <motion.div
            key="edit-content-modal"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setEditItem(null); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="relative w-full sm:max-w-md max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-white/10"
              style={{ background: 'linear-gradient(145deg,#0f0f14,#1a1a24)' }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <h3 className="text-base font-bold text-white">Edit content</h3>
                <button onClick={() => setEditItem(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-5 py-4 space-y-3">
                {editItem.mediaUrl && editItem.type === 'image' && (
                  <img src={editItem.mediaUrl} alt={editItem.title} className="w-full max-h-48 object-contain rounded-lg bg-black/30" />
                )}
                <div>
                  <label className="text-xs text-gray-400">Title</label>
                  <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Description</label>
                  <Textarea rows={2} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                </div>
                <div className="flex items-center justify-between">
                  <label className="text-sm text-white flex items-center gap-2">
                    <Lock className="h-4 w-4" style={{ color: colors.hexAccent }} /> Paywalled (subscribers only)
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, isPaywalled: !f.isPaywalled }))}
                    className="relative w-11 h-6 rounded-full transition-colors"
                    style={{ backgroundColor: editForm.isPaywalled ? colors.hexAccent : 'rgba(255,255,255,0.2)' }}
                  >
                    <span className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform" style={{ transform: editForm.isPaywalled ? 'translateX(20px)' : 'none' }} />
                  </button>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Single purchase price ($, optional)</label>
                  <Input
                    type="number" step="0.01" min="0" placeholder="4.99"
                    value={editForm.singlePurchasePrice}
                    onChange={e => setEditForm(f => ({ ...f, singlePurchasePrice: e.target.value }))}
                  />
                </div>
              </div>
              <div className="px-5 py-4 border-t border-white/8 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditItem(null)}>Cancel</Button>
                <Button
                  className="flex-1 text-white"
                  style={{ backgroundColor: colors.hexAccent }}
                  disabled={editMutation.isPending || !editForm.title.trim()}
                  onClick={() => editMutation.mutate({
                    id: editItem.id,
                    payload: {
                      title: editForm.title,
                      description: editForm.description,
                      isPaywalled: editForm.isPaywalled,
                      singlePurchasePrice: editForm.singlePurchasePrice || null,
                    },
                  })}
                >
                  {editMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving…</> : <><Check className="h-4 w-4 mr-1" /> Save</>}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUBSCRIBE CTA
// ═══════════════════════════════════════════════════════════════
function SubscribeCTA({ artistId, settings, colors, artistName }: {
  artistId: string; settings?: ExplicitSettings; colors: { hexAccent: string }; artistName?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-6 text-center space-y-4 border border-white/10"
      style={{ background: `linear-gradient(145deg, ${colors.hexAccent}12, rgba(0,0,0,0.45))` }}>
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-40 h-40 rounded-full blur-[70px]" style={{ backgroundColor: colors.hexAccent + '28' }} />
      </div>
      <div className="relative z-10 space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${colors.hexAccent}40, ${colors.hexAccent}18)`, border: `1px solid ${colors.hexAccent}35` }}>
            <Crown className="h-8 w-8" style={{ color: colors.hexAccent }} />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Unlock Exclusive Content</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
            Subscribe to {artistName || 'this artist'} to access all exclusive content, chat directly, and get special perks.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          {settings?.monthlyPrice && (
            <Button className="text-white font-bold" style={{ background: `linear-gradient(135deg, ${colors.hexAccent}, ${colors.hexAccent}bb)` }}>
              <Zap className="h-4 w-4 mr-1.5" />
              ${settings.monthlyPrice} / month
            </Button>
          )}
          {settings?.yearlyPrice && (
            <Button variant="outline" style={{ borderColor: colors.hexAccent + '55', color: colors.hexAccent }}>
              <Star className="h-4 w-4 mr-1.5" />
              ${settings.yearlyPrice} / year
              <span className="ml-1.5 text-[10px] opacity-60">Best value</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AI STUDIO TAB
// ═══════════════════════════════════════════════════════════════
function AiStudioTab({ artistId, colors }: { artistId: string; colors: { hexAccent: string } }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [genType, setGenType] = useState<'image' | 'video'>('image');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [model, setModel] = useState('replicate/realistic-vision');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const refFileInputRef = useRef<HTMLInputElement | null>(null);

  const needsReference = model === 'replicate/instant-id';

  const handleRefPick = useCallback(async (file: File) => {
    if (!file) return;
    setIsUploadingRef(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const result = await fetchApi('/content/upload', { method: 'POST', body: fd });
      if (!result?.success || !result?.mediaUrl) throw new Error(result?.error || 'Upload failed');
      setReferenceImageUrl(result.mediaUrl);
      toast({ title: 'Reference photo ready', description: 'Identity will be preserved in generation.' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err?.message || String(err), variant: 'destructive' });
    } finally {
      setIsUploadingRef(false);
    }
  }, [toast]);


  const { data: generations = [] } = useQuery<AiGeneration[]>({
    queryKey: ['explicit-ai-generations'],
    queryFn: () => fetchApi('/ai/generations'),
  });

  const generateImage = useMutation({
    mutationFn: (payload: any) => fetchApi('/ai/generate-image', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explicit-ai-generations'] });
      toast({ title: 'Image generated!' });
      setPrompt('');
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const generateVideo = useMutation({
    mutationFn: (payload: any) => fetchApi('/ai/generate-video', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explicit-ai-generations'] });
      toast({ title: 'Video generated!' });
      setPrompt('');
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const publishMutation = useMutation({
    mutationFn: (genId: number) => fetchApi(`/ai/publish/${genId}`, { method: 'POST', body: JSON.stringify({ isPaywalled: true }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explicit-content', artistId] });
      toast({ title: 'Published as content!' });
    },
  });

  const isGenerating = generateImage.isPending || generateVideo.isPending;

  return (
    <div className="space-y-4">
      {/* Generation Type Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setGenType('image')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${genType === 'image' ? 'text-white' : 'opacity-60'}`}
          style={{ backgroundColor: genType === 'image' ? colors.hexAccent : 'transparent' }}
        >
          <Image className="h-4 w-4" /> Image
        </button>
        <button
          onClick={() => setGenType('video')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${genType === 'video' ? 'text-white' : 'opacity-60'}`}
          style={{ backgroundColor: genType === 'video' ? colors.hexAccent : 'transparent' }}
        >
          <Video className="h-4 w-4" /> Video
        </button>
      </div>

      {/* Generation Form */}
      <div className="space-y-3 p-4 rounded-lg border" style={{ borderColor: colors.hexAccent + '30' }}>
        <Textarea
          placeholder="Describe what you want to generate... (no restrictions)"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={3}
        />
        <Input
          placeholder="Negative prompt (optional)"
          value={negativePrompt}
          onChange={e => setNegativePrompt(e.target.value)}
        />

        {genType === 'image' && (
          <select
            className="w-full rounded border px-2 py-1.5 text-sm bg-black/20"
            value={model}
            onChange={e => setModel(e.target.value)}
          >
            <option value="replicate/realistic-vision">🔥 Realistic Uncensored — No Restrictions</option>
            <option value="replicate/instant-id">👤 Artist Likeness — Uses artist photo (Uncensored)</option>
            <option value="fal-ai/flux/dev">FLUX Dev — High Quality</option>
            <option value="fal-ai/flux/schnell">FLUX Schnell — Fast</option>
            <option value="local/fhdr-uncensored">FHDR Uncensored — HuggingFace / Local GPU</option>
          </select>
        )}

        {/* Reference photo for artist likeness */}
        {genType === 'image' && needsReference && (
          <div className="p-3 rounded-lg border space-y-2" style={{ borderColor: colors.hexAccent + '40', background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: colors.hexAccent }}>
              <Image className="h-3.5 w-3.5" /> Foto de referencia del artista (rostro visible)
            </p>
            <input
              ref={refFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleRefPick(f); e.currentTarget.value = ''; }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button" size="sm" variant="outline" disabled={isUploadingRef}
                onClick={() => refFileInputRef.current?.click()}
                style={{ borderColor: colors.hexAccent, color: colors.hexAccent }}
              >
                {isUploadingRef ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Subiendo…</> : <><Upload className="h-4 w-4 mr-1" /> Subir foto</>}
              </Button>
              {referenceImageUrl && (
                <img src={referenceImageUrl} alt="reference" className="h-10 w-10 rounded-lg object-cover border" style={{ borderColor: colors.hexAccent + '60' }} />
              )}
            </div>
            <Input
              placeholder="…o pega la URL de una foto del artista"
              value={referenceImageUrl}
              onChange={e => setReferenceImageUrl(e.target.value)}
              className="text-xs"
            />
            <p className="text-[10px] text-gray-500">Si lo dejas vacío, se usará la foto de perfil del artista automáticamente.</p>
          </div>
        )}

        {genType === 'video' && (
          <Input
            placeholder="Image URL (optional — for image-to-video)"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
          />
        )}

        <Button
          className="w-full text-white"
          style={{ backgroundColor: colors.hexAccent }}
          disabled={!prompt || isGenerating}
          onClick={() => {
            if (genType === 'image') {
              generateImage.mutate({ prompt, negativePrompt, model, referenceImageUrl: referenceImageUrl || undefined });
            } else {
              generateVideo.mutate({ prompt, negativePrompt, imageUrl: imageUrl || undefined });
            }
          }}
        >
          {isGenerating ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Generating...</>
          ) : (
            <><Wand2 className="h-4 w-4 mr-1" /> Generate {genType === 'image' ? 'Image' : 'Video'}</>
          )}
        </Button>
      </div>

      {/* Recent Generations */}
      {generations.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2" style={{ color: colors.hexAccent }}>Recent Generations</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {generations.map(gen => (
              <div key={gen.id} className="rounded-xl overflow-hidden border relative group" style={{ borderColor: colors.hexAccent + '20' }}>
                <div className="aspect-square bg-black/30 flex items-center justify-center">
                  {gen.status === 'completed' && gen.resultUrl ? (
                    gen.type === 'video' ? (
                      <video src={gen.resultUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={gen.resultUrl} alt={gen.prompt} className="w-full h-full object-cover" />
                    )
                  ) : gen.status === 'processing' ? (
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: colors.hexAccent }} />
                  ) : (
                    <X className="h-8 w-8 text-red-400" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[10px] truncate opacity-60">{gen.prompt}</p>
                  <div className="flex items-center justify-between mt-1">
                    <Badge className="text-[9px]" style={{ backgroundColor: gen.status === 'completed' ? '#22c55e' : gen.status === 'processing' ? colors.hexAccent : '#ef4444' }}>
                      {gen.status}
                    </Badge>
                    {gen.status === 'completed' && !gen.publishedAsContentId && (
                      <button
                        onClick={() => publishMutation.mutate(gen.id)}
                        className="text-[10px] flex items-center gap-0.5 hover:opacity-80"
                        style={{ color: colors.hexAccent }}
                      >
                        <Upload className="h-3 w-3" /> Publish
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CHAT TAB
// ═══════════════════════════════════════════════════════════════
function ChatTab({ artistId, isOwnProfile, colors }: {
  artistId: string; isOwnProfile: boolean; colors: { hexAccent: string };
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [message, setMessage] = useState('');

  const { data: messages = [] } = useQuery<ChatMessage[]>({
    queryKey: ['explicit-chat', artistId],
    queryFn: () => fetchApi(`/chat/${artistId}`),
    refetchInterval: 5000, // Poll every 5s
  });

  const sendMessage = useMutation({
    mutationFn: (msg: string) => fetchApi(`/chat/${artistId}`, {
      method: 'POST',
      body: JSON.stringify({ message: msg }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explicit-chat', artistId] });
      setMessage('');
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-3">
      {/* Messages */}
      <div className="max-h-80 overflow-y-auto space-y-2 p-3 rounded-lg bg-black/10">
        {messages.length === 0 ? (
          <p className="text-center text-sm opacity-40 py-8">
            {isOwnProfile ? 'Messages from subscribers will appear here' : 'Start a conversation!'}
          </p>
        ) : (
          messages.map(msg => {
            const isMine = isOwnProfile
              ? msg.senderId === Number(artistId)
              : msg.senderId !== Number(artistId);
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${isMine ? 'text-white' : 'bg-white/10'}`}
                  style={isMine ? { backgroundColor: colors.hexAccent } : undefined}
                >
                  {msg.message}
                  {msg.tipAmount && (
                    <Badge className="ml-1 text-[9px]" style={{ backgroundColor: '#f59e0b' }}>
                      💰 ${msg.tipAmount}
                    </Badge>
                  )}
                  <div className="text-[9px] opacity-50 mt-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Message input */}
      <div className="flex gap-2">
        <Input
          placeholder="Type a message..."
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && message.trim()) {
              sendMessage.mutate(message.trim());
            }
          }}
          className="flex-1"
        />
        <Button
          size="sm"
          disabled={!message.trim() || sendMessage.isPending}
          onClick={() => sendMessage.mutate(message.trim())}
          style={{ backgroundColor: colors.hexAccent }}
          className="text-white"
        >
          {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EARNINGS TAB
// ═══════════════════════════════════════════════════════════════
function EarningsTab({ artistId, colors }: { artistId: string; colors: { hexAccent: string } }) {
  const { data: earnings, isLoading } = useQuery<EarningsData>({
    queryKey: ['explicit-earnings', artistId],
    queryFn: () => fetchApi(`/earnings/${artistId}`),
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" style={{ color: colors.hexAccent }} /></div>;

  if (!earnings) return <p className="text-center text-sm opacity-60 py-8">No earnings data available.</p>;

  const stats = [
    { label: 'Active Subscribers', value: earnings.activeSubscribers, icon: Users2 },
    { label: 'Total Revenue', value: `$${earnings.totalRevenue.toFixed(2)}`, icon: DollarSign },
    { label: 'Purchases', value: `$${earnings.purchaseRevenue.toFixed(2)}`, icon: ShoppingBag },
    { label: 'Tips', value: `$${earnings.tipRevenue.toFixed(2)}`, icon: Heart },
    { label: 'Content Items', value: earnings.contentCount, icon: Image },
    { label: 'AI Costs', value: `$${earnings.aiGenerationCosts.toFixed(2)}`, icon: Wand2 },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className="relative overflow-hidden p-3 rounded-xl border text-center transition-transform hover:scale-[1.02]"
          style={{
            borderColor: colors.hexAccent + '25',
            background: `linear-gradient(145deg, ${colors.hexAccent}10, rgba(0,0,0,0.2))`,
          }}
        >
          <div className="absolute top-0 right-0 w-12 h-12 rounded-full blur-[20px] opacity-20" style={{ backgroundColor: colors.hexAccent }} />
          <div className="relative z-10">
            <stat.icon className="h-5 w-5 mx-auto mb-1" style={{ color: colors.hexAccent }} />
            <p className="text-lg font-bold text-white">{stat.value}</p>
            <p className="text-[10px] text-gray-500">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Inline placeholder icons not in lucide
function Users2(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
}

function ShoppingBag(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
}

// ═══════════════════════════════════════════════════════════════
// SETTINGS TAB
// ═══════════════════════════════════════════════════════════════
function SettingsTab({ artistId, settings, colors }: {
  artistId: string; settings?: ExplicitSettings; colors: { hexAccent: string };
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<ExplicitSettings>({
    enabled: settings?.enabled || false,
    monthlyPrice: settings?.monthlyPrice || '9.99',
    yearlyPrice: settings?.yearlyPrice || '89.99',
    singleContentPrice: settings?.singleContentPrice || '4.99',
    welcomeMessage: settings?.welcomeMessage || '',
    chatEnabled: settings?.chatEnabled ?? true,
    aiGenerationEnabled: settings?.aiGenerationEnabled ?? true,
    watermarkEnabled: settings?.watermarkEnabled ?? true,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        enabled: settings.enabled,
        monthlyPrice: settings.monthlyPrice || '9.99',
        yearlyPrice: settings.yearlyPrice || '89.99',
        singleContentPrice: settings.singleContentPrice || '4.99',
        welcomeMessage: settings.welcomeMessage || '',
        chatEnabled: settings.chatEnabled ?? true,
        aiGenerationEnabled: settings.aiGenerationEnabled ?? true,
        watermarkEnabled: settings.watermarkEnabled ?? true,
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () => fetchApi('/settings', { method: 'PUT', body: JSON.stringify(form) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explicit-settings', artistId] });
      toast({ title: 'Settings saved!' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer" style={{ borderColor: colors.hexAccent + '30' }}>
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={e => setForm(prev => ({ ...prev, enabled: e.target.checked }))}
          className="h-4 w-4"
        />
        <div>
          <p className="text-sm font-medium">Enable Exclusive Content Module</p>
          <p className="text-[10px] opacity-50">When enabled, visitors will see your exclusive content section</p>
        </div>
      </label>

      {/* Pricing */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] opacity-50 mb-1 block">Monthly ($)</label>
          <Input
            type="number"
            step="0.01"
            value={form.monthlyPrice}
            onChange={e => setForm(prev => ({ ...prev, monthlyPrice: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-[10px] opacity-50 mb-1 block">Yearly ($)</label>
          <Input
            type="number"
            step="0.01"
            value={form.yearlyPrice}
            onChange={e => setForm(prev => ({ ...prev, yearlyPrice: e.target.value }))}
          />
        </div>
        <div>
          <label className="text-[10px] opacity-50 mb-1 block">Single ($)</label>
          <Input
            type="number"
            step="0.01"
            value={form.singleContentPrice}
            onChange={e => setForm(prev => ({ ...prev, singleContentPrice: e.target.value }))}
          />
        </div>
      </div>

      {/* Welcome message */}
      <div>
        <label className="text-[10px] opacity-50 mb-1 block">Welcome Message</label>
        <Textarea
          placeholder="Welcome message for new subscribers..."
          value={form.welcomeMessage}
          onChange={e => setForm(prev => ({ ...prev, welcomeMessage: e.target.value }))}
          rows={2}
        />
      </div>

      {/* Feature toggles */}
      <div className="space-y-2">
        {[
          { key: 'chatEnabled' as const, label: 'Enable Chat', desc: 'Allow subscribers to chat with you' },
          { key: 'aiGenerationEnabled' as const, label: 'AI Generation', desc: 'Enable AI image/video generation studio' },
          { key: 'watermarkEnabled' as const, label: 'Watermark', desc: 'Add watermark to preview images' },
        ].map(toggle => (
          <label key={toggle.key} className="flex items-center gap-3 p-2 rounded border cursor-pointer" style={{ borderColor: colors.hexAccent + '20' }}>
            <input
              type="checkbox"
              checked={!!form[toggle.key]}
              onChange={e => setForm(prev => ({ ...prev, [toggle.key]: e.target.checked }))}
              className="h-3.5 w-3.5"
            />
            <div>
              <p className="text-xs font-medium">{toggle.label}</p>
              <p className="text-[9px] opacity-40">{toggle.desc}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Save */}
      <Button
        className="w-full text-white"
        style={{ backgroundColor: colors.hexAccent }}
        disabled={saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
      >
        {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
        Save Settings
      </Button>
    </div>
  );
}
