/**
 * GammaPresentationsModule
 * AI-powered presentation & slide deck generator connected to the artist's full context.
 * Uses Gamma API to produce professional decks: Bio, EPK, Investor Pitch, Tour, Album Launch, etc.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Presentation,
  Plus,
  Sparkles,
  Loader2,
  ExternalLink,
  Trash2,
  Copy,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Key,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
  FileText,
  Mic2,
  Globe,
  TrendingUp,
  Handshake,
  Music2,
  Users,
  Megaphone,
  Calendar,
  Star,
  Zap,
  BookOpen,
  Shield,
  Link,
  X,
} from 'lucide-react';
import { apiRequest } from '../../../lib/queryClient';
import { useToast } from '../../../hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

type DeckType =
  | 'artist_bio'
  | 'press_kit'
  | 'pitch_deck'
  | 'tour_deck'
  | 'album_launch'
  | 'brand_deck'
  | 'fan_story'
  | 'sponsor_deck'
  | 'label_pitch'
  | 'event_proposal';

type DeckStatus = 'pending' | 'generating' | 'ready' | 'error';

interface GammaDeck {
  id: string;
  type: DeckType;
  title: string;
  description: string;
  prompt: string;
  gammaUrl?: string;
  thumbnailUrl?: string;
  status: DeckStatus;
  theme?: string;
  slideCount?: number;
  errorMessage?: string;
  createdAt: string;
}

type ActiveTab = 'generate' | 'decks' | 'connect';

interface Props {
  artistId: string;
  artistName?: string;
  artistGenre?: string;
  artistBio?: string;
  accent?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DECK_TEMPLATES: Array<{
  id: DeckType;
  emoji: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  slides: number;
}> = [
  { id: 'artist_bio', emoji: '🎤', label: 'Artist Bio', desc: 'Story, journey, music & vision', icon: <Mic2 className="w-4 h-4" />, color: '#ec4899', slides: 10 },
  { id: 'press_kit', emoji: '📰', label: 'Press Kit (EPK)', desc: 'Media-ready electronic press kit', icon: <FileText className="w-4 h-4" />, color: '#8b5cf6', slides: 12 },
  { id: 'pitch_deck', emoji: '💼', label: 'Investor Pitch', desc: 'Market opportunity & revenue model', icon: <TrendingUp className="w-4 h-4" />, color: '#f59e0b', slides: 14 },
  { id: 'label_pitch', emoji: '🏷️', label: 'Label Pitch', desc: 'Pitch to record labels & A&R', icon: <Music2 className="w-4 h-4" />, color: '#10b981', slides: 12 },
  { id: 'tour_deck', emoji: '🎭', label: 'Tour Deck', desc: 'Venue & promoter tour proposal', icon: <Calendar className="w-4 h-4" />, color: '#3b82f6', slides: 10 },
  { id: 'album_launch', emoji: '💿', label: 'Album Launch', desc: 'Release strategy & marketing plan', icon: <Sparkles className="w-4 h-4" />, color: '#ef4444', slides: 12 },
  { id: 'brand_deck', emoji: '✨', label: 'Brand Partnership', desc: 'Co-branding & collab proposals', icon: <Handshake className="w-4 h-4" />, color: '#06b6d4' , slides: 10 },
  { id: 'sponsor_deck', emoji: '🤝', label: 'Sponsorship', desc: 'Sponsorship tiers & ROI', icon: <Star className="w-4 h-4" />, color: '#fbbf24', slides: 10 },
  { id: 'fan_story', emoji: '❤️', label: 'Fan Story', desc: 'Community & fan engagement deck', icon: <Users className="w-4 h-4" />, color: '#f43f5e', slides: 8 },
  { id: 'event_proposal', emoji: '🎪', label: 'Event Proposal', desc: 'Concert & event pitch deck', icon: <Megaphone className="w-4 h-4" />, color: '#a855f7', slides: 10 },
];

const THEMES = [
  { id: 'dark', label: 'Dark', preview: 'bg-gray-900' },
  { id: 'light', label: 'Light', preview: 'bg-white' },
  { id: 'gradient', label: 'Gradient', preview: 'bg-gradient-to-r from-purple-500 to-pink-500' },
  { id: 'minimal', label: 'Minimal', preview: 'bg-gray-100' },
  { id: 'bold', label: 'Bold', preview: 'bg-black' },
];

const STATUS_STYLE: Record<DeckStatus, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  pending: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Saved', icon: <BookOpen className="w-3 h-3" /> },
  generating: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)', label: 'Generating…', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  ready: { color: '#34d399', bg: 'rgba(52,211,153,0.1)', label: 'Ready', icon: <CheckCircle className="w-3 h-3" /> },
  error: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', label: 'Error', icon: <AlertCircle className="w-3 h-3" /> },
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function GammaPresentationsModule({
  artistId,
  artistName = 'Artist',
  artistGenre = '',
  artistBio = '',
  accent = '#8b5cf6',
}: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>('generate');
  const [decks, setDecks] = useState<GammaDeck[]>([]);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [apiConnected, setApiConnected] = useState(false);
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);

  // Generate form state
  const [selectedTemplate, setSelectedTemplate] = useState<DeckType>('artist_bio');
  const [selectedTheme, setSelectedTheme] = useState('dark');
  const [customTitle, setCustomTitle] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [slideCount, setSlideCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [lastGeneratedPrompt, setLastGeneratedPrompt] = useState<string | null>(null);
  const [showPromptCopy, setShowPromptCopy] = useState(false);

  // Connect form
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // Load on mount
  useEffect(() => {
    loadDecks();
    loadCredentials();
  }, [artistId]);

  // Auto-set slide count when template changes
  useEffect(() => {
    const tpl = DECK_TEMPLATES.find((t) => t.id === selectedTemplate);
    if (tpl) setSlideCount(tpl.slides);
  }, [selectedTemplate]);

  const loadDecks = async () => {
    setLoadingDecks(true);
    try {
      const data: any = await apiRequest({ url: `/api/gamma-presentations/${artistId}/decks`, method: 'GET' });
      if (data?.decks) setDecks(data.decks);
    } catch { /* first load empty */ }
    finally { setLoadingDecks(false); }
  };

  const loadCredentials = async () => {
    try {
      const data: any = await apiRequest({ url: `/api/gamma-presentations/${artistId}/credentials`, method: 'GET' });
      setApiConnected(!!data?.connected);
      setApiKeyMasked(data?.credentials?.gammaApiKeyMasked || null);
    } catch { /* ignore */ }
  };

  const generateDeck = async () => {
    setGenerating(true);
    setLastGeneratedPrompt(null);
    try {
      const payload: any = {
        type: selectedTemplate,
        theme: selectedTheme,
        slideCount,
      };
      if (customTitle) payload.title = customTitle;
      if (useCustomPrompt && customPrompt) payload.customPrompt = customPrompt;

      const data: any = await apiRequest({
        url: `/api/gamma-presentations/${artistId}/generate`,
        method: 'POST',
        data: payload,
      });

      if (data?.deck) {
        setDecks((prev) => [data.deck, ...prev]);

        if (data.apiConnected && data.deck.status === 'ready') {
          toast({ title: '✦ Presentation Generated!', description: 'Your deck is ready on Gamma — click Open to view' });
          setActiveTab('decks');
        } else if (data.apiConnected && data.deck.status === 'error') {
          toast({ title: '⚠️ Generation Failed', description: data.error || 'Gamma API returned an error', variant: 'destructive' });
        } else {
          // No API key — show the prompt for manual use
          const promptText = data.prompt || data.deck?.prompt || data.deck?.description || '';
          setLastGeneratedPrompt(promptText || 'Prompt saved — go to Gamma.app to use it manually.');
          setShowPromptCopy(true);
          setActiveTab('decks');
          toast({ title: '📋 Prompt Ready', description: 'Copy the prompt and paste it into gamma.app — or connect your API key to automate' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Error generating deck', description: err?.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const deleteDeck = async (deckId: string) => {
    try {
      await apiRequest({ url: `/api/gamma-presentations/${artistId}/decks/${deckId}`, method: 'DELETE' });
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
      toast({ title: 'Deck deleted' });
    } catch {
      toast({ title: 'Error deleting deck', variant: 'destructive' });
    }
  };

  const saveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      await apiRequest({
        url: `/api/gamma-presentations/${artistId}/credentials`,
        method: 'POST',
        data: { gammaApiKey: apiKeyInput.trim() },
      });
      await loadCredentials();
      setApiKeyInput('');
      toast({ title: '🔑 API Key Connected', description: 'Gamma is now ready to auto-generate presentations' });
    } catch {
      toast({ title: 'Error saving API key', variant: 'destructive' });
    } finally {
      setSavingKey(false);
    }
  };

  const copyToClipboard = async (text: string, label = 'Copied') => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `✓ ${label}` });
    } catch { /* ignore */ }
  };

  const selectedTpl = DECK_TEMPLATES.find((t) => t.id === selectedTemplate)!;
  const readyDecks = decks.filter((d) => d.status === 'ready').length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(236,72,153,0.06))',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${accent}, #ec4899)` }}
            >
              <Presentation className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Gamma Presentations</h3>
              <p className="text-[11px] text-white/40">AI-powered slide decks from your artist context</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold"
              style={{
                background: apiConnected ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.06)',
                color: apiConnected ? '#34d399' : 'rgba(255,255,255,0.3)',
                border: `1px solid ${apiConnected ? '#34d39933' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: apiConnected ? '#34d399' : '#666' }} />
              {apiConnected ? 'Gamma Connected' : 'Not Connected'}
            </div>
          </div>
        </div>

        {decks.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { label: 'Total Decks', value: decks.length, color: '#a78bfa' },
              { label: 'Ready', value: readyDecks, color: '#34d399' },
              { label: 'Drafts', value: decks.length - readyDecks, color: '#60a5fa' },
            ].map((s) => (
              <div key={s.label} className="p-2.5 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="font-black text-lg" style={{ color: s.color }}>{s.value}</p>
                <p className="text-white/35 text-[9px] uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-xl"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        {([
          { id: 'generate' as ActiveTab, label: 'Generate', emoji: '✦' },
          { id: 'decks' as ActiveTab, label: 'My Decks', emoji: '📋' },
          { id: 'connect' as ActiveTab, label: 'Connect', emoji: '🔑' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: activeTab === tab.id ? `linear-gradient(135deg, ${accent}, #ec4899)` : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.4)',
              boxShadow: activeTab === tab.id ? `0 0 16px ${accent}33` : 'none',
            }}
          >
            <span className="mr-1">{tab.emoji}</span>
            {tab.label}
            {tab.id === 'decks' && decks.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px]" style={{ background: 'rgba(255,255,255,0.15)' }}>
                {decks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── GENERATE TAB ── */}
        {activeTab === 'generate' && (
          <motion.div key="generate" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">

            {/* Artist context pill */}
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/50"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: accent }} />
              Using context: <span className="text-white/70 font-semibold">{artistName}</span>
              {artistGenre && <> · <span className="text-white/50">{artistGenre}</span></>}
              {artistBio && <> · bio ✓</>}
            </div>

            {/* Template grid */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/35 mb-2">Presentation Type</p>
              <div className="grid grid-cols-2 gap-2">
                {DECK_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    className="p-3 rounded-xl text-left transition-all"
                    style={{
                      background: selectedTemplate === tpl.id ? `${tpl.color}15` : 'rgba(255,255,255,0.03)',
                      border: `1.5px solid ${selectedTemplate === tpl.id ? tpl.color + '44' : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: selectedTemplate === tpl.id ? `0 0 16px ${tpl.color}22` : 'none',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl leading-none">{tpl.emoji}</span>
                      <span className="text-white font-bold text-xs">{tpl.label}</span>
                    </div>
                    <p className="text-white/35 text-[10px]">{tpl.desc}</p>
                    <p className="text-[9px] mt-1" style={{ color: tpl.color }}>{tpl.slides} slides</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {/* Title */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5">Custom Title <span className="text-white/20 normal-case font-normal">(optional)</span></label>
                <input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder={`${artistName} — ${selectedTpl?.label || 'Presentation'}`}
                  className="w-full px-3 py-2.5 rounded-xl text-sm bg-transparent outline-none text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
                />
              </div>

              {/* Theme */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/30 mb-2">Theme</label>
                <div className="flex gap-1.5 flex-wrap">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTheme(t.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: selectedTheme === t.id ? `${accent}20` : 'rgba(255,255,255,0.05)',
                        color: selectedTheme === t.id ? accent : 'rgba(255,255,255,0.4)',
                        border: `1px solid ${selectedTheme === t.id ? accent + '44' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      <span className={`w-3 h-3 rounded-full flex-shrink-0 ${t.preview}`} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slide count */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-white/30 mb-1.5">Slides: {slideCount}</label>
                <input
                  type="range"
                  min={5}
                  max={20}
                  value={slideCount}
                  onChange={(e) => setSlideCount(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[9px] text-white/25 mt-0.5">
                  <span>5</span><span>20</span>
                </div>
              </div>

              {/* Custom prompt toggle */}
              <div>
                <button
                  onClick={() => setUseCustomPrompt((v) => !v)}
                  className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  {useCustomPrompt ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {useCustomPrompt ? 'Hide custom prompt' : 'Add custom instructions (optional)'}
                </button>
                <AnimatePresence>
                  {useCustomPrompt && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden mt-2">
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder={`Extra instructions for the deck — e.g. "Focus on streaming numbers and Spotify growth. Include a slide about the upcoming collaboration with..."`}
                        rows={4}
                        className="w-full px-3 py-2.5 rounded-xl text-xs bg-transparent outline-none text-white resize-none"
                        style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* API status notice */}
            {!apiConnected && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-xl text-xs"
                style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}
              >
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-300 font-semibold">Gamma API not connected</p>
                  <p className="text-amber-400/60 mt-0.5">The AI-enriched prompt will be saved and you can copy it to gamma.app manually. Connect your API key in the Connect tab to auto-generate.</p>
                </div>
              </div>
            )}

            {/* Generate button */}
            <button
              onClick={generateDeck}
              disabled={generating}
              className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:scale-[1.01]"
              style={{ background: `linear-gradient(135deg, ${accent}, #ec4899)`, color: '#fff' }}
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating Deck…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> {apiConnected ? 'Generate Presentation' : 'Save Prompt & Generate'}</>
              )}
            </button>
          </motion.div>
        )}

        {/* ── DECKS TAB ── */}
        {activeTab === 'decks' && (
          <motion.div key="decks" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-3">

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-white/35">{decks.length} Presentations</span>
              <button
                onClick={() => setActiveTab('generate')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${accent}, #ec4899)` }}
              >
                <Plus className="w-3 h-3" /> New Deck
              </button>
            </div>

            {/* Latest generated prompt for manual copy */}
            <AnimatePresence>
              {showPromptCopy && lastGeneratedPrompt && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                  className="rounded-2xl overflow-hidden" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="text-amber-300 font-bold text-sm">AI-Enriched Prompt Ready</span>
                      </div>
                      <button onClick={() => setShowPromptCopy(false)} className="text-white/30 hover:text-white/60">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-white/50 text-xs leading-relaxed bg-black/30 rounded-xl p-3 max-h-32 overflow-y-auto">
                      {lastGeneratedPrompt}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(lastGeneratedPrompt, 'Prompt copied!')}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white flex-1"
                        style={{ background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.3)' }}
                      >
                        <Copy className="w-3 h-3" /> Copy Prompt
                      </button>
                      <a
                        href="https://gamma.app/create"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white"
                        style={{ background: `${accent}20`, border: `1px solid ${accent}44` }}
                      >
                        <ExternalLink className="w-3 h-3" /> Open Gamma
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {loadingDecks ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-white/30" />
              </div>
            ) : decks.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center" style={{ background: `${accent}15` }}>
                  <Presentation className="w-6 h-6" style={{ color: accent }} />
                </div>
                <p className="text-white font-semibold text-sm">No presentations yet</p>
                <p className="text-white/35 text-xs max-w-xs mx-auto">Generate your first AI-powered slide deck from your artist context</p>
                <button
                  onClick={() => setActiveTab('generate')}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${accent}, #ec4899)` }}
                >
                  Generate First Deck
                </button>
              </div>
            ) : (
              decks.map((deck) => (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  accent={accent}
                  onDelete={() => deleteDeck(deck.id)}
                  onCopyPrompt={() => copyToClipboard(deck.prompt, 'Prompt copied!')}
                />
              ))
            )}
          </motion.div>
        )}

        {/* ── CONNECT TAB ── */}
        {activeTab === 'connect' && (
          <motion.div key="connect" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">

            {/* Status card */}
            <div
              className="p-4 rounded-2xl flex items-center gap-3"
              style={{
                background: apiConnected ? 'rgba(52,211,153,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${apiConnected ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: apiConnected ? 'rgba(52,211,153,0.15)' : `${accent}15` }}
              >
                {apiConnected
                  ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                  : <Key className="w-5 h-5" style={{ color: accent }} />}
              </div>
              <div>
                <p className="text-white font-semibold text-sm">
                  {apiConnected ? 'Gamma API Connected ✓' : 'Connect Your Gamma API'}
                </p>
                <p className="text-white/40 text-xs mt-0.5">
                  {apiConnected
                    ? `Key: ${apiKeyMasked || '••••••••'} — Auto-generation is active`
                    : 'Add your API key to auto-generate presentations without copy-paste'}
                </p>
              </div>
            </div>

            {/* Security notice */}
            <div
              className="flex items-start gap-3 p-3 rounded-xl text-xs"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}
            >
              <Shield className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
              <p className="text-indigo-300">Your API key is stored encrypted in your private Firestore and never exposed in the frontend or logs.</p>
            </div>

            {/* How to get Gamma API key */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="p-4 space-y-3">
                <p className="text-white font-semibold text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4" style={{ color: accent }} /> How to get your Gamma API key
                </p>
                <ol className="space-y-2 text-xs text-white/50 list-none">
                  {[
                    'Go to gamma.app and sign in to your account',
                    'Open Settings → Integrations → API',
                    'Click "Generate New API Key"',
                    'Copy the key and paste it below',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5"
                        style={{ background: `${accent}20`, color: accent }}>{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <a
                  href="https://gamma.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-semibold mt-2 transition-colors hover:opacity-80"
                  style={{ color: accent }}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open gamma.app
                </a>
              </div>
            </div>

            {/* API Key input */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-white/30">Gamma API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={apiConnected ? '••••••••••••••••• (already set)' : 'Paste your Gamma API key here…'}
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm bg-transparent outline-none text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
                  autoComplete="new-password"
                />
                {apiConnected && !apiKeyInput && (
                  <div className="flex items-center px-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={saveApiKey}
              disabled={savingKey || !apiKeyInput.trim()}
              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
              style={{ background: `linear-gradient(135deg, ${accent}, #ec4899)`, color: '#fff' }}
            >
              {savingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              {apiConnected ? 'Update API Key' : 'Connect Gamma API'}
            </button>

            {/* What happens without key */}
            <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-white/50 text-xs font-semibold mb-2">Without API key:</p>
              <ul className="space-y-1 text-xs text-white/35">
                <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-400/60 flex-shrink-0" />AI enriches your prompt with GPT</li>
                <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-400/60 flex-shrink-0" />Prompt is saved to your deck library</li>
                <li className="flex items-center gap-1.5"><CheckCircle className="w-3 h-3 text-green-400/60 flex-shrink-0" />Copy it and paste into gamma.app manually</li>
                <li className="flex items-center gap-1.5"><AlertCircle className="w-3 h-3 text-amber-400/60 flex-shrink-0" />No auto-generation — manual step required</li>
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── DeckCard ─────────────────────────────────────────────────────────────────

function DeckCard({ deck, accent, onDelete, onCopyPrompt }: {
  deck: GammaDeck;
  accent: string;
  onDelete: () => void;
  onCopyPrompt: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_STYLE[deck.status];
  const template = DECK_TEMPLATES.find((t) => t.id === deck.type);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="p-4 flex items-start gap-3">
        {/* Emoji icon */}
        <div
          className="w-11 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ background: template ? `${template.color}18` : 'rgba(255,255,255,0.06)' }}
        >
          {template?.emoji || '📊'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap mb-1">
            <p className="text-white font-bold text-sm leading-tight flex-1 min-w-0 truncate">{deck.title}</p>
            <span
              className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: status.bg, color: status.color }}
            >
              {status.icon} {status.label}
            </span>
          </div>
          <p className="text-white/35 text-[10px] leading-relaxed line-clamp-2">{deck.description}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/30">
            <span>{template?.label || deck.type.replace(/_/g, ' ')}</span>
            {deck.slideCount && <span>{deck.slideCount} slides</span>}
            <span>{deck.theme || 'dark'} theme</span>
            <span>{new Date(deck.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <div className="p-4 space-y-3">
              {/* Thumbnail */}
              {deck.thumbnailUrl && (
                <img src={deck.thumbnailUrl} alt={deck.title} className="w-full rounded-xl object-cover" style={{ maxHeight: 180 }} />
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {deck.gammaUrl ? (
                  <a
                    href={deck.gammaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${accent}, #ec4899)` }}
                  >
                    <Eye className="w-3 h-3" /> Open Deck
                  </a>
                ) : deck.status === 'pending' && (
                  <a
                    href="https://gamma.app/create"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
                    style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
                  >
                    <ExternalLink className="w-3 h-3" /> Open Gamma ↗
                  </a>
                )}
                <button
                  onClick={onCopyPrompt}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <Copy className="w-3 h-3" /> Copy Prompt
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-red-400 hover:text-red-300 transition-colors ml-auto"
                  style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>

              {/* Prompt preview */}
              <div>
                <p className="text-[10px] text-white/25 mb-1 uppercase tracking-wide">AI-Enriched Prompt</p>
                <p className="text-white/35 text-[10px] leading-relaxed bg-black/20 rounded-xl p-2.5 max-h-24 overflow-y-auto">
                  {deck.prompt}
                </p>
              </div>

              {/* Error message */}
              {deck.status === 'error' && deck.errorMessage && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl text-xs" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300">{deck.errorMessage}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
