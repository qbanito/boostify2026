/**
 * Emotional Studio Panel
 *
 * A 10-block emotional intelligence workspace for artists.
 * Helps artists discover and articulate their core identity,
 * transform personal experience into art, and measure authentic human depth.
 */

import React, { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Film,
  Eye,
  Heart,
  Layers,
  User,
  Feather,
  Maximize2,
  Grid,
  Globe,
  Wind,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  Upload,
  Link,
  ImageIcon,
} from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IconicIdentity {
  silhouette_description?: string;
  signature_gesture?: string;
  dominant_color?: string;
  walk_style?: string;
  verbal_mark?: string;
  emotional_wound?: string;
  social_message?: string;
  tenderness_quotient?: number;
  universal_emotion?: string;
  emotional_studio_score?: number;
}

interface EmotionalStudioData {
  hasData: boolean;
  iconicIdentity: IconicIdentity | null;
}

interface VisualAnalysis {
  primaryEmotion?: string;
  emotionScore?: number;
  silhouetteReadable?: boolean;
  communicatesWithoutText?: boolean;
  bodyLanguageNotes?: string;
  improvementNote?: string;
}

interface PainToArtResult {
  lyricFragment?: string;
  visualConcept?: string;
  albumConcept?: string;
  campaignAngle?: string;
  universalEmotion?: string;
  socialMeaningLayer?: { surface?: string; depth?: string };
}

interface HumanLayerResult {
  humanScore: number;
  status: 'authentic' | 'hybrid' | 'ai-native';
  certificate: string;
  missingLayers: string[];
  layers: Array<{ label: string; active: boolean; weight: number }>;
}

interface Props {
  artistId: number;
  artistName?: string;
  genre?: string;
  isOwnProfile: boolean;
  profileImage?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    text?: string;
    border?: string;
  };
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value, label, colorClass = 'bg-violet-500' }: { value: number; label: string; colorClass?: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/70">{label}</span>
        <span className="font-bold text-white">{value}/100</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colorClass}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

// ─── Block Container ──────────────────────────────────────────────────────────

function Block({
  icon: Icon,
  title,
  subtitle,
  children,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 flex-shrink-0 text-violet-400" />
          <div>
            <h3 className="text-sm font-bold text-white">{title}</h3>
            {subtitle && <p className="text-[11px] text-white/50">{subtitle}</p>}
          </div>
        </div>
        {badge && (
          <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function EmotionalStudioPanel({ artistId, artistName, genre, isOwnProfile, profileImage, colors }: Props) {
  // ── State ──
  const [imageUrl, setImageUrl] = useState(profileImage || '');
  const [imageSource, setImageSource] = useState<'profile' | 'upload' | 'url'>(profileImage ? 'profile' : 'url');
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active image URL used for analysis
  const activeImageUrl = imageSource === 'profile'
    ? (profileImage || '')
    : imageSource === 'upload'
    ? (uploadedPreview || '')
    : imageUrl;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadedPreview(dataUrl);
      setImageSource('upload');
    };
    reader.readAsDataURL(file);
  };

  const [experience, setExperience] = useState('');
  const [humanChecks, setHumanChecks] = useState({
    hasHumanVocal: false,
    hasHumanLyricEdit: false,
    hasPersonalStory: false,
    hasHumanMix: false,
    hasRealInstrument: false,
    hasManualArtDirection: false,
  });
  const [visualResult, setVisualResult] = useState<VisualAnalysis | null>(null);
  const [artResult, setArtResult] = useState<PainToArtResult | null>(null);
  const [humanResult, setHumanResult] = useState<HumanLayerResult | null>(null);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  // ── Data Fetch ──
  const { data: studioData, isLoading, refetch } = useQuery<EmotionalStudioData>({
    queryKey: ['emotional-studio', artistId],
    queryFn: () =>
      apiRequest({ url: `/api/emotional-studio/${artistId}`, method: 'GET' }).then((r: any) => r),
    enabled: !!artistId,
  });

  const identity = studioData?.iconicIdentity;

  // ── Mutations ──
  const analyzeVisual = useMutation({
    mutationFn: () =>
      apiRequest({
        url: `/api/emotional-studio/${artistId}/analyze-visual`,
        method: 'POST',
        data: { imageUrl: activeImageUrl, artistName, genre },
      }).then((r: any) => r.analysis),
    onSuccess: (data) => setVisualResult(data),
  });

  const painToArt = useMutation({
    mutationFn: () =>
      apiRequest({
        url: `/api/emotional-studio/${artistId}/pain-to-art`,
        method: 'POST',
        data: { experience, artistName, genre },
      }).then((r: any) => r.result),
    onSuccess: (data) => setArtResult(data),
  });

  const validateHuman = useMutation({
    mutationFn: () =>
      apiRequest({
        url: `/api/emotional-studio/${artistId}/human-layer`,
        method: 'POST',
        data: humanChecks,
      }).then((r: any) => r),
    onSuccess: (data) => setHumanResult(data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  const toggleBlock = (id: string) => setExpandedBlock(prev => prev === id ? null : id);

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Film className="h-6 w-6 text-violet-400" />
        <div>
          <h2 className="text-lg font-black tracking-tight text-white">Emotional Studio</h2>
          <p className="text-xs text-white/50">Identity depth, pain transformation, and human validation tools</p>
        </div>
        <button
          onClick={() => refetch()}
          className="ml-auto rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Blueprint not generated yet ── */}
      {!studioData?.hasData && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>
              Generate your Artist Blueprint first to unlock the <strong>Iconic Identity</strong> data. The tools below are available immediately.
            </span>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 1 — Iconic Identity Builder
          ═════════════════════════════════════════════════════════════════════ */}
      <Block icon={User} title="Iconic Identity" subtitle="Your recognizable character architecture" badge={identity ? `Score ${identity.emotional_studio_score ?? '—'}/100` : 'No data yet'}>
        {identity ? (
          <div className="space-y-3">
            {identity.emotional_studio_score !== undefined && (
              <ScoreBar value={identity.emotional_studio_score} label="Identity Strength" colorClass="bg-violet-500" />
            )}
            {identity.tenderness_quotient !== undefined && (
              <ScoreBar value={identity.tenderness_quotient} label="Tenderness Score" colorClass="bg-pink-500" />
            )}
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
              {identity.silhouette_description && (
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="font-semibold text-violet-300">Silhouette</p>
                  <p className="text-white/80">{identity.silhouette_description}</p>
                </div>
              )}
              {identity.signature_gesture && (
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="font-semibold text-violet-300">Signature Gesture</p>
                  <p className="text-white/80">{identity.signature_gesture}</p>
                </div>
              )}
              {identity.dominant_color && (
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="font-semibold text-violet-300">Dominant Color</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-4 w-4 rounded-full border border-white/20"
                      style={{ backgroundColor: identity.dominant_color }}
                    />
                    <p className="text-white/80">{identity.dominant_color}</p>
                  </div>
                </div>
              )}
              {identity.walk_style && (
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="font-semibold text-violet-300">Walk Style</p>
                  <p className="text-white/80">{identity.walk_style}</p>
                </div>
              )}
              {identity.verbal_mark && (
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="font-semibold text-violet-300">Verbal Mark</p>
                  <p className="font-mono text-white/80">"{identity.verbal_mark}"</p>
                </div>
              )}
              {identity.universal_emotion && (
                <div className="rounded-lg bg-white/5 p-2">
                  <p className="font-semibold text-violet-300">Core Emotion</p>
                  <p className="font-bold capitalize text-white">{identity.universal_emotion}</p>
                </div>
              )}
            </div>
            {identity.emotional_wound && (
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                <p className="mb-1 font-semibold text-white/50">THE WOUND</p>
                <p className="italic text-white/70">"{identity.emotional_wound}"</p>
              </div>
            )}
            {identity.social_message && (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-xs">
                <p className="mb-1 font-semibold text-violet-400">SOCIAL MESSAGE</p>
                <p className="text-white/80">{identity.social_message}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-white/40 italic">Generate your Artist Blueprint to populate identity fields.</p>
        )}
      </Block>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 2 — Silent Emotion Engine
          ═════════════════════════════════════════════════════════════════════ */}
      <Block icon={Eye} title="Silent Emotion Engine" subtitle="Does your image communicate without words?">
        <div className="space-y-3">
          {/* ── Source selector tabs ── */}
          <div className="flex gap-1 rounded-xl bg-white/5 p-1">
            {[
              { key: 'profile' as const, icon: ImageIcon, label: 'Profile Photo', disabled: !profileImage },
              { key: 'upload' as const, icon: Upload, label: 'Upload Image', disabled: false },
              { key: 'url' as const, icon: Link, label: 'Paste URL', disabled: false },
            ].map(({ key, icon: Icon, label, disabled }) => (
              <button
                key={key}
                onClick={() => !disabled && setImageSource(key)}
                disabled={disabled}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition ${
                  imageSource === key
                    ? 'bg-violet-600 text-white shadow'
                    : disabled
                    ? 'cursor-not-allowed text-white/20'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {/* ── Profile photo preview ── */}
          {imageSource === 'profile' && profileImage && (
            <div className="flex items-center gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
              <img src={profileImage} alt="Profile" className="h-14 w-14 rounded-xl object-cover border border-white/10" />
              <div className="text-xs">
                <p className="font-semibold text-violet-300">Artist Profile Photo</p>
                <p className="text-white/50 mt-0.5">This image will be analyzed for emotional impact.</p>
              </div>
            </div>
          )}

          {/* ── File upload ── */}
          {imageSource === 'upload' && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              {uploadedPreview ? (
                <div className="relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  <img src={uploadedPreview} alt="Uploaded" className="h-14 w-14 rounded-xl object-cover border border-white/10" />
                  <div className="flex-1 text-xs">
                    <p className="font-semibold text-white">Image uploaded</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-1 text-violet-400 hover:text-violet-300 underline"
                    >Change image</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 py-6 text-xs text-white/50 transition hover:border-violet-500/50 hover:text-violet-300"
                >
                  <Upload className="h-6 w-6" />
                  <span>Click to upload an image</span>
                  <span className="text-[10px] text-white/30">JPG, PNG, WEBP supported</span>
                </button>
              )}
            </div>
          )}

          {/* ── URL paste input ── */}
          {imageSource === 'url' && (
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Paste an image URL to analyze..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500 focus:outline-none"
            />
          )}

          <button
            onClick={() => analyzeVisual.mutate()}
            disabled={!activeImageUrl.trim() || analyzeVisual.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {analyzeVisual.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Analyze Emotional Impact
          </button>
          {visualResult && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <ScoreBar value={visualResult.emotionScore ?? 0} label="Emotion Clarity Score" colorClass="bg-emerald-500" />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className={`rounded-lg p-2 ${visualResult.communicatesWithoutText ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                  {visualResult.communicatesWithoutText ? <CheckCircle className="mb-1 h-3 w-3" /> : <AlertCircle className="mb-1 h-3 w-3" />}
                  Text-free communication
                </div>
                <div className={`rounded-lg p-2 ${visualResult.silhouetteReadable ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                  {visualResult.silhouetteReadable ? <CheckCircle className="mb-1 h-3 w-3" /> : <AlertCircle className="mb-1 h-3 w-3" />}
                  Silhouette readable
                </div>
              </div>
              {visualResult.primaryEmotion && (
                <p className="text-xs text-white/70">
                  <span className="font-semibold text-violet-300">Primary emotion:</span> {visualResult.primaryEmotion}
                </p>
              )}
              {visualResult.bodyLanguageNotes && (
                <p className="text-xs text-white/60 italic">{visualResult.bodyLanguageNotes}</p>
              )}
              {visualResult.improvementNote && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-300">
                  <strong>Improve:</strong> {visualResult.improvementNote}
                </div>
              )}
            </div>
          )}
        </div>
      </Block>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 3 — Pain-to-Art Generator
          ═════════════════════════════════════════════════════════════════════ */}
      <Block icon={Feather} title="Pain-to-Art Generator" subtitle="Transform a real experience into art">
        <div className="space-y-3">
          <textarea
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder="Describe a real experience, pain, loss, or defining moment... (be specific, not poetic)"
            rows={3}
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-violet-500 focus:outline-none"
          />
          <button
            onClick={() => painToArt.mutate()}
            disabled={experience.trim().length < 10 || painToArt.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-pink-600 py-2 text-sm font-bold text-white transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {painToArt.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Feather className="h-4 w-4" />}
            Transform into Art
          </button>
          {artResult && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
              {artResult.lyricFragment && (
                <div>
                  <p className="mb-1 font-bold text-pink-300">LYRIC FRAGMENT</p>
                  <pre className="whitespace-pre-wrap font-mono leading-relaxed text-white/80">{artResult.lyricFragment}</pre>
                </div>
              )}
              {artResult.universalEmotion && (
                <p className="text-white/70"><span className="font-semibold text-pink-300">Universal emotion:</span> {artResult.universalEmotion}</p>
              )}
              {artResult.visualConcept && (
                <div>
                  <p className="mb-1 font-bold text-violet-300">VISUAL CONCEPT</p>
                  <p className="text-white/70">{artResult.visualConcept}</p>
                </div>
              )}
              {artResult.albumConcept && (
                <div>
                  <p className="mb-1 font-bold text-violet-300">ALBUM CONCEPT</p>
                  <p className="text-white/70">{artResult.albumConcept}</p>
                </div>
              )}
              {artResult.campaignAngle && (
                <div>
                  <p className="mb-1 font-bold text-amber-300">CAMPAIGN ANGLE</p>
                  <p className="text-white/70">{artResult.campaignAngle}</p>
                </div>
              )}
              {artResult.socialMeaningLayer && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="font-semibold text-white/50">Surface layer</p>
                    <p className="text-white/70">{artResult.socialMeaningLayer.surface}</p>
                  </div>
                  <div className="rounded-lg bg-violet-500/10 p-2">
                    <p className="font-semibold text-violet-300">Depth layer</p>
                    <p className="text-white/70">{artResult.socialMeaningLayer.depth}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Block>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 4 — Social Meaning Layer
          ═════════════════════════════════════════════════════════════════════ */}
      <Block icon={Layers} title="Social Meaning Layer" subtitle="Dual-layer content framework">
        <div className="space-y-3 text-xs text-white/70">
          <p className="leading-relaxed">
            Every work has two simultaneous layers. The <span className="font-semibold text-white">surface</span> captures attention —
            rhythm, hook, visual appeal. The <span className="font-semibold text-violet-300">depth</span> creates memory —
            a human truth that stays with the listener after the song ends.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="mb-1 font-bold text-white">Surface Layer</p>
              <ul className="space-y-1 text-white/60">
                <li>• Rhythmic hook or signature sound</li>
                <li>• Visual appeal and shareability</li>
                <li>• Commercial accessibility</li>
                <li>• Danceability / replay value</li>
              </ul>
            </div>
            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <p className="mb-1 font-bold text-violet-300">Depth Layer</p>
              <ul className="space-y-1 text-white/60">
                <li>• A social observation or critique</li>
                <li>• A human truth or universal pain</li>
                <li>• A personal story that scales</li>
                <li>• What journalists can write about</li>
              </ul>
            </div>
          </div>
          <p className="text-[11px] text-white/40">
            Test: if you cover all lyrics and visuals, does the melody alone carry an emotional intention?
          </p>
        </div>
      </Block>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 5 — Body Performance Director
          ═════════════════════════════════════════════════════════════════════ */}
      <Block icon={Wind} title="Body Performance Director" subtitle="Emotion → posture → movement mapping">
        <div className="space-y-2 text-xs">
          {[
            { emotion: 'Grief', posture: 'Shoulders inward, chin slightly down, weight on one foot' },
            { emotion: 'Defiance', posture: 'Chest high, direct eye contact, controlled hands' },
            { emotion: 'Desire', posture: 'Open body, slow movement, intentional eye contact' },
            { emotion: 'Joy', posture: 'Full-body engagement, upward energy, loose arms' },
            { emotion: 'Conviction', posture: 'Closed fist, planted feet, measured pace' },
          ].map(({ emotion, posture }) => (
            <div key={emotion} className="flex gap-3 rounded-lg bg-white/5 p-2">
              <span className="w-16 flex-shrink-0 font-semibold text-violet-300">{emotion}</span>
              <span className="text-white/70">{posture}</span>
            </div>
          ))}
          <p className="pt-1 text-[11px] text-white/40">
            Define your walk in 3 words. That walk appears in every video, live show, and visual production.
          </p>
          {identity?.walk_style && (
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-2">
              <span className="text-xs font-bold text-violet-300">Your walk: </span>
              <span className="text-sm font-bold uppercase tracking-widest text-white">{identity.walk_style}</span>
            </div>
          )}
        </div>
      </Block>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 6 — Human Layer Validator
          ═════════════════════════════════════════════════════════════════════ */}
      <Block icon={Heart} title="Human Layer Validator" subtitle="Measure the authentic human contribution">
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Object.entries({
              hasHumanVocal: { label: 'Human vocal performance', weight: 25 },
              hasHumanLyricEdit: { label: 'Human lyric authorship', weight: 20 },
              hasPersonalStory: { label: 'Personal story or real experience', weight: 20 },
              hasHumanMix: { label: 'Manual mix decisions', weight: 15 },
              hasRealInstrument: { label: 'Real instrument recorded', weight: 10 },
              hasManualArtDirection: { label: 'Human art direction', weight: 10 },
            }).map(([key, { label, weight }]) => (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs transition ${
                  humanChecks[key as keyof typeof humanChecks]
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-white/60 hover:border-white/20'
                }`}
              >
                <input
                  type="checkbox"
                  checked={humanChecks[key as keyof typeof humanChecks]}
                  onChange={(e) => setHumanChecks(prev => ({ ...prev, [key]: e.target.checked }))}
                  className="h-3.5 w-3.5 accent-emerald-500"
                />
                <span className="flex-1">{label}</span>
                <span className="text-[10px] opacity-60">+{weight}</span>
              </label>
            ))}
          </div>
          <button
            onClick={() => validateHuman.mutate()}
            disabled={validateHuman.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-40"
          >
            {validateHuman.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Validate Human Layer
          </button>
          {humanResult && (
            <div className="space-y-2 rounded-xl border border-white/10 bg-black/20 p-3">
              <ScoreBar
                value={humanResult.humanScore}
                label="Human Layer Score"
                colorClass={humanResult.humanScore >= 75 ? 'bg-emerald-500' : humanResult.humanScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}
              />
              <p className={`text-center text-xs font-bold ${
                humanResult.status === 'authentic' ? 'text-emerald-300' :
                humanResult.status === 'hybrid' ? 'text-amber-300' : 'text-red-300'
              }`}>{humanResult.certificate}</p>
              {humanResult.missingLayers.length > 0 && (
                <div className="text-xs text-white/50">
                  <p className="mb-1 font-semibold text-white/70">To increase score, add:</p>
                  {humanResult.missingLayers.map((l) => (
                    <p key={l} className="ml-2">• {l}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Block>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 7 — Minimal Scene Composer
          ═════════════════════════════════════════════════════════════════════ */}
      <Block icon={Maximize2} title="Minimal Scene Composer" subtitle="One location. One light. One emotion.">
        <div className="space-y-2 text-xs text-white/70">
          <p className="leading-relaxed">
            The most powerful visual concepts are the most constrained. Budget limitation forces emotional precision.
            A single frame that works without music or caption is worth more than a fully produced video that needs context.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { label: '1 Location', desc: 'One place that carries the whole story' },
              { label: '1 Light', desc: 'One source. Direction defines emotion.' },
              { label: '1 Gesture', desc: 'The single physical act that says everything' },
            ].map(({ label, desc }) => (
              <div key={label} className="rounded-lg bg-white/5 p-2 text-center">
                <p className="font-bold text-white">{label}</p>
                <p className="text-[11px] text-white/50">{desc}</p>
              </div>
            ))}
          </div>
          <p className="pt-1 text-[11px] text-white/40">
            Ask: what single still image could summarize this entire song? That image is your album cover, video thumbnail, and campaign visual.
          </p>
        </div>
      </Block>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 8 — Full Creative Control Map
          ═════════════════════════════════════════════════════════════════════ */}
      <Block icon={Grid} title="Full Creative Control" subtitle="Mini-map of all creative decisions">
        <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
          {[
            'Sonic Identity',
            'Visual Identity',
            'Lyric Voice',
            'Live Presence',
            'Brand Archetype',
            'Fan Communication',
            'Color System',
            'Gesture Language',
            'Era Concept',
            'Campaign Angle',
            'Content Tone',
            'Social Message',
          ].map((item) => (
            <div key={item} className="rounded-lg bg-white/5 p-2 text-center text-white/60 hover:bg-white/10 hover:text-white transition cursor-default">
              {item}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-white/30">
          Every element above should derive from your Iconic Identity. Consistency across all 12 dimensions = cultural impact.
        </p>
      </Block>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 9 — Universal Emotion Mapper
          ═════════════════════════════════════════════════════════════════════ */}
      <Block icon={Globe} title="Universal Emotion Mapper" subtitle="Global resonance across cultures and languages">
        <div className="space-y-3">
          {identity?.universal_emotion ? (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3">
              <p className="text-xs text-white/50">Core emotion for {artistName || 'this artist'}</p>
              <p className="mt-1 text-xl font-black capitalize text-white">{identity.universal_emotion}</p>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            {[
              { emotion: 'longing', markets: 'Latin America, Mediterranean, Southeast Asia' },
              { emotion: 'defiance', markets: 'North America, West Africa, UK Urban' },
              { emotion: 'tenderness', markets: 'East Asia, Scandinavia, Brazil' },
              { emotion: 'joy', markets: 'Universal — all markets respond' },
              { emotion: 'grief', markets: 'Global — highest lyric memorability' },
              { emotion: 'ambition', markets: 'US, Nigeria, South Korea, Gulf' },
            ].map(({ emotion, markets }) => (
              <div
                key={emotion}
                className={`rounded-lg p-2 transition ${
                  identity?.universal_emotion === emotion
                    ? 'border border-violet-500/50 bg-violet-500/20'
                    : 'bg-white/5'
                }`}
              >
                <p className="font-semibold capitalize text-white">{emotion}</p>
                <p className="text-white/50">{markets}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/40">
            Test: does the melody carry this emotion without lyrics? If yes, the emotion is genuine.
          </p>
        </div>
      </Block>

      {/* ═══════════════════════════════════════════════════════════════════════
          BLOCK 10 — Tenderness Layer
          ═════════════════════════════════════════════════════════════════════ */}
      <Block
        icon={Heart}
        title="Tenderness Layer"
        subtitle="Human connection depth score"
        badge={identity?.tenderness_quotient !== undefined ? `${identity.tenderness_quotient}/100` : undefined}
      >
        <div className="space-y-3 text-xs text-white/70">
          {identity?.tenderness_quotient !== undefined && (
            <ScoreBar value={identity.tenderness_quotient} label="Tenderness Quotient" colorClass="bg-pink-500" />
          )}
          <p className="leading-relaxed">
            Tenderness is not softness. It is the moment when a listener feels the artist is genuinely human —
            uncertain, longing, afraid, or grateful. A street rapper can have a high tenderness score.
            A pop ballad can have a low one if it feels manufactured.
          </p>
          <div className="space-y-1">
            {[
              { range: '80–100', label: 'Deeply felt', desc: 'Work lives in memory years later' },
              { range: '60–79', label: 'Human', desc: 'Audience identifies with the artist' },
              { range: '40–59', label: 'Produced', desc: 'Enjoyable but forgettable' },
              { range: '0–39', label: 'Polished product', desc: 'No emotional residue' },
            ].map(({ range, label, desc }) => (
              <div key={range} className="flex gap-3">
                <span className="w-14 flex-shrink-0 font-mono text-[10px] text-white/40">{range}</span>
                <span className="font-semibold text-white/70">{label}</span>
                <span className="text-white/40">{desc}</span>
              </div>
            ))}
          </div>
          <p className="pt-1 text-[11px] text-white/30">
            Recommendation: any score below 60 requires revisiting the emotional core of the work before release.
          </p>
        </div>
      </Block>
    </div>
  );
}

export default EmotionalStudioPanel;
