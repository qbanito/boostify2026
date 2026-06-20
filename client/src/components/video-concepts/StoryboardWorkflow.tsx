// ────────────────────────────────────────────────────────────────────
// StoryboardWorkflow.tsx
// ────────────────────────────────────────────────────────────────────
// Three-stage post-deposit experience:
//   1. BRIEF — client uploads reference photos + fills creative form.
//   2. GENERATING — calls /storyboard/generate; UI polls /:id while
//                   each scene image renders in the background.
//   3. VIEWER — interactive 10-scene grid: edit text, regenerate any
//               image, view prompts, request human revision.
// ────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, X, ImageIcon, Wand2, Sparkles, Loader2, CheckCircle2,
  RefreshCw, Edit3, Save, Music2, Camera, Clock, FileText,
  AlertCircle, Eye, EyeOff, Film,
} from 'lucide-react';
import { apiRequest } from '../../lib/queryClient';
import { t, type Lang } from '../../lib/video-concepts-i18n';

// ── Types ──────────────────────────────────────────────────────────────
type SceneStatus = 'pending' | 'generating' | 'ready' | 'error';

export type Scene = {
  id: string;
  order: number;
  title: string;
  narration: string;
  narrationEn?: string;
  visualDirection: string;
  cameraMove: string;
  duration: string;
  musicCue: string;
  imagePrompt: string;
  imageUrl?: string | null;
  generatedAt?: string | null;
  generationStatus: SceneStatus;
  generationProvider?: string | null;
  sourceAssetUrl?: string | null;
  error?: string | null;
};

export type Storyboard = {
  version: string;
  generatedAt: string;
  title: string;
  logline: string;
  tagline?: string;
  tone: string[];
  palette: string[];
  storyArc: string;
  visualTheme?: {
    palette?: string[];
    lightingStyle?: string;
    lensCharacter?: string;
    filmLook?: string;
    motionLanguage?: string;
    colorTemperature?: string;
    contrast?: string;
    depthOfField?: string;
    atmospherics?: string;
    subjectTreatment?: string;
    cinematicReference?: string;
    platformNote?: string;
  };
  scenes: Scene[];
};

export type StoryboardBrief = {
  storyTone?: string;
  mustHaveMoments?: string[];
  peopleToFeature?: string;
  colorPreferences?: string;
  musicVibe?: string;
  narrationStyle?: string;
  inspirationKeywords?: string;
  language?: 'es' | 'en';
  notes?: string;
  uploadedAssetUrls?: string[];
  updatedAt?: string;
};

export type Asset = {
  id: number;
  kind: string;
  url: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
};

type Props = {
  projectId: number;
  galleryToken: string;
  lang: Lang;
  brief: StoryboardBrief | null;
  storyboard: Storyboard | null;
  storyboardStatus: string | null;
  assets: Asset[];
  onProjectRefresh: () => Promise<void> | void;
  onClose?: () => void;
};
type Stage = 'brief' | 'generating' | 'viewer';

const TONE_OPTIONS: Array<{ id: string; key: any }> = [
  { id: 'romantic', key: 'sbToneRomantic' },
  { id: 'epic', key: 'sbToneEpic' },
  { id: 'intimate', key: 'sbToneIntimate' },
  { id: 'playful', key: 'sbTonePlayful' },
  { id: 'cinematic', key: 'sbToneCinematic' },
  { id: 'documentary', key: 'sbToneDocumentary' },
];

const NARRATION_OPTIONS: Array<{ id: string; key: any }> = [
  { id: 'voiceover', key: 'sbNarrVoiceover' },
  { id: 'lyrical', key: 'sbNarrLyrical' },
  { id: 'silent', key: 'sbNarrSilent' },
  { id: 'interview', key: 'sbNarrInterview' },
];

// ── Helpers ────────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function pickStage(brief: StoryboardBrief | null, sb: Storyboard | null, status: string | null): Stage {
  if (sb?.scenes?.length) return 'viewer';
  if (status === 'generating') return 'generating';
  if (brief && (brief.storyTone || (brief.mustHaveMoments?.length ?? 0) > 0)) {
    return 'brief'; // re-open with previous answers prefilled
  }
  return 'brief';
}

// ── Main component ─────────────────────────────────────────────────────

export default function StoryboardWorkflow(props: Props) {
  const { projectId, galleryToken, lang, brief, storyboard, storyboardStatus, assets, onProjectRefresh, onClose } = props;
  const [stage, setStage] = useState<Stage>(() => pickStage(brief, storyboard, storyboardStatus));

  // Re-evaluate when parent reloads project (e.g. polling brings new scenes in).
  useEffect(() => {
    setStage(pickStage(brief, storyboard, storyboardStatus));
  }, [brief, storyboard, storyboardStatus]);

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {stage === 'brief' && (
          <motion.div key="brief" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <BriefStage
              projectId={projectId}
              galleryToken={galleryToken}
              lang={lang}
              brief={brief}
              assets={assets}
              onAssetsRefresh={onProjectRefresh}
              onSubmitted={async () => { await onProjectRefresh(); setStage('generating'); }}
              onClose={onClose}
            />
          </motion.div>
        )}
        {stage === 'generating' && (
          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GeneratingStage
              projectId={projectId}
              galleryToken={galleryToken}
              lang={lang}
              storyboard={storyboard}
              storyboardStatus={storyboardStatus}
              onProjectRefresh={onProjectRefresh}
            />
          </motion.div>
        )}
        {stage === 'viewer' && storyboard && (
          <motion.div key="viewer" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ViewerStage
              projectId={projectId}
              galleryToken={galleryToken}
              lang={lang}
              storyboard={storyboard}
              storyboardStatus={storyboardStatus}
              onProjectRefresh={onProjectRefresh}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 1. Brief stage — uploads + creative form
// ════════════════════════════════════════════════════════════════════

function BriefStage(props: {
  projectId: number;
  galleryToken: string;
  lang: Lang;
  brief: StoryboardBrief | null;
  assets: Asset[];
  onAssetsRefresh: () => Promise<void> | void;
  onSubmitted: () => Promise<void> | void;
  onClose?: () => void;
}) {
  const { projectId, galleryToken, lang, brief, assets, onAssetsRefresh, onSubmitted, onClose } = props;

  const refAssets = useMemo(() => assets.filter((a) => a.kind === 'photo' || a.kind === 'reference'), [assets]);
  const [storyTone, setStoryTone] = useState(brief?.storyTone || '');
  const [mustHave, setMustHave] = useState((brief?.mustHaveMoments || []).join('\n'));
  const [people, setPeople] = useState(brief?.peopleToFeature || '');
  const [palette, setPalette] = useState(brief?.colorPreferences || '');
  const [musicVibe, setMusicVibe] = useState(brief?.musicVibe || '');
  const [narrStyle, setNarrStyle] = useState(brief?.narrationStyle || '');
  const [notes, setNotes] = useState(brief?.notes || '');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const arr = Array.from(files).slice(0, 12 - refAssets.length);
    if (!arr.length) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: arr.length });
    try {
      for (let i = 0; i < arr.length; i++) {
        const f = arr[i];
        const fileBase64 = await readFileAsDataUrl(f);
        await apiRequest(`/api/video-concepts/${projectId}/assets`, 'POST', {
          galleryToken,
          kind: 'photo',
          fileBase64,
          originalName: f.name,
          mimeType: f.type || 'image/jpeg',
        });
        setUploadProgress({ done: i + 1, total: arr.length });
      }
      // Refresh parent so newly uploaded assets show in the grid below.
      await onAssetsRefresh();
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [projectId, galleryToken, refAssets.length, onAssetsRefresh]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };

  const saveBrief = async (alsoGenerate: boolean) => {
    setError(null);
    if (refAssets.length < 1) {
      setError(lang === 'es' ? 'Sube al menos una foto.' : 'Upload at least one photo.');
      return;
    }
    setSaving(true);
    try {
      await apiRequest(`/api/video-concepts/${projectId}/storyboard/brief`, 'POST', {
        galleryToken,
        language: lang,
        storyTone: storyTone || undefined,
        mustHaveMoments: mustHave.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20),
        peopleToFeature: people || undefined,
        colorPreferences: palette || undefined,
        musicVibe: musicVibe || undefined,
        narrationStyle: narrStyle || undefined,
        notes: notes || undefined,
      });
      if (alsoGenerate) {
        setGenerating(true);
        await apiRequest(`/api/video-concepts/${projectId}/storyboard/generate`, 'POST', {
          galleryToken,
          language: lang,
        });
      }
      await onSubmitted();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-black/50 p-6 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
            {t('sbFormTitle', lang)}
          </h2>
          <p className="text-white/55 text-sm mt-2 max-w-2xl">{t('sbFormSub', lang)}</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-white/40 hover:text-white/80 p-2 rounded-full">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 1. Photo uploads */}
      <section className="space-y-3">
        <div>
          <h3 className="font-semibold text-white">{t('sbStep1', lang)}</h3>
          <p className="text-white/45 text-sm">{t('sbStep1Sub', lang)}</p>
        </div>
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-2xl border-2 border-dashed border-white/15 bg-black/30 p-8 text-center cursor-pointer hover:border-amber-500/50 hover:bg-amber-500/[0.03] transition-colors"
        >
          <Upload className="w-9 h-9 text-amber-400 mx-auto mb-3" />
          <p className="text-white font-medium">{t('sbUploadDrop', lang)}</p>
          <p className="text-white/40 text-xs mt-1">{t('sbUploadHint', lang)}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }}
        />
        {uploading && (
          <p className="text-amber-300 text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('sbUploading', lang)} {uploadProgress.done}/{uploadProgress.total}
          </p>
        )}
        {refAssets.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-2">
            {refAssets.map((a) => (
              <div key={a.id} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/40">
                <img src={a.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        )}
        {refAssets.length > 0 && (
          <p className="text-emerald-400 text-xs">✓ {refAssets.length} {t('sbUploadedCount', lang)}</p>
        )}
      </section>

      {/* 2. Story tone */}
      <section className="space-y-3">
        <h3 className="font-semibold text-white">{t('sbStep2', lang)}</h3>
        <div className="flex flex-wrap gap-2">
          {TONE_OPTIONS.map((opt) => {
            const active = storyTone === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setStoryTone(active ? '' : opt.id)}
                className={`px-4 py-2 rounded-full border text-sm transition-colors ${
                  active
                    ? 'bg-amber-500 border-amber-500 text-black font-bold'
                    : 'border-white/15 bg-white/[0.04] text-white/70 hover:text-white hover:border-amber-500/40'
                }`}
              >
                {t(opt.key, lang)}
              </button>
            );
          })}
        </div>
      </section>

      {/* 3-6 text inputs */}
      <FormField title={t('sbStep3', lang)}>
        <textarea
          value={mustHave}
          onChange={(e) => setMustHave(e.target.value)}
          placeholder={t('sbStep3Ph', lang)}
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none resize-y"
        />
      </FormField>

      <FormField title={t('sbStep4', lang)}>
        <textarea
          value={people}
          onChange={(e) => setPeople(e.target.value)}
          placeholder={t('sbStep4Ph', lang)}
          rows={2}
          className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none resize-y"
        />
      </FormField>

      <div className="grid sm:grid-cols-2 gap-4">
        <FormField title={t('sbStep5', lang)}>
          <input
            value={palette}
            onChange={(e) => setPalette(e.target.value)}
            placeholder={t('sbStep5Ph', lang)}
            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
          />
        </FormField>
        <FormField title={t('sbStep6', lang)}>
          <input
            value={musicVibe}
            onChange={(e) => setMusicVibe(e.target.value)}
            placeholder={t('sbStep6Ph', lang)}
            className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
          />
        </FormField>
      </div>

      {/* 7. Narration style */}
      <section className="space-y-3">
        <h3 className="font-semibold text-white">{t('sbStep7', lang)}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {NARRATION_OPTIONS.map((opt) => {
            const active = narrStyle === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setNarrStyle(active ? '' : opt.id)}
                className={`px-3 py-2.5 rounded-xl border text-xs transition-colors ${
                  active
                    ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                    : 'border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:border-white/30'
                }`}
              >
                {t(opt.key, lang)}
              </button>
            );
          })}
        </div>
      </section>

      <FormField title={t('sbStep8', lang)}>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('sbStep8Ph', lang)}
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none resize-y"
        />
      </FormField>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2 border-t border-white/[0.06]">
        <button
          onClick={() => saveBrief(true)}
          disabled={saving || generating || refAssets.length === 0}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100 transition-transform"
        >
          {saving || generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {generating ? t('sbGenerating', lang) : saving ? t('sbUploading', lang) : t('sbGenerate', lang)}
        </button>
        <button
          onClick={() => saveBrief(false)}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/15 bg-white/[0.03] text-white/80 hover:text-white hover:border-white/30 disabled:opacity-50 transition-colors text-sm"
        >
          <Save className="w-4 h-4" /> {t('sbSaveBrief', lang)}
        </button>
      </div>
    </div>
  );
}

function FormField({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-semibold text-white text-sm">{title}</h3>
      {children}
    </section>
  );
}

// ════════════════════════════════════════════════════════════════════
// 2. Generating stage — polls /:id every 4 s while images render
// ════════════════════════════════════════════════════════════════════

function GeneratingStage(props: {
  projectId: number;
  galleryToken: string;
  lang: Lang;
  storyboard: Storyboard | null;
  storyboardStatus: string | null;
  onProjectRefresh: () => Promise<void> | void;
}) {
  const { lang, storyboard, storyboardStatus, onProjectRefresh } = props;

  // Poll the project every 4 s until status === 'ready' or 'error'.
  useEffect(() => {
    if (storyboardStatus === 'ready' || storyboardStatus === 'error') return;
    const interval = setInterval(() => { void onProjectRefresh(); }, 4000);
    return () => clearInterval(interval);
  }, [storyboardStatus, onProjectRefresh]);

  const total = storyboard?.scenes?.length || 0;
  const ready = storyboard?.scenes?.filter((s) => s.generationStatus === 'ready').length || 0;

  return (
    <div className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-500/[0.06] to-black p-8 md:p-12 text-center space-y-6">
      <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30">
        <Sparkles className="w-9 h-9 text-amber-300 animate-pulse" />
      </div>
      <div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{t('sbGenerateTitle', lang)}</h2>
        <p className="text-white/60 max-w-xl mx-auto leading-relaxed">{t('sbGenerateSub', lang)}</p>
      </div>

      {total > 0 && (
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between text-xs text-white/55 mb-2">
            <span>{t('sbGeneratingScenes', lang)}</span>
            <span className="font-mono text-amber-300">{ready}/{total}</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500"
              animate={{ width: `${total ? (ready / total) * 100 : 0}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>
      )}

      {storyboard?.scenes && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 max-w-3xl mx-auto pt-4">
          {storyboard.scenes.map((s) => (
            <div
              key={s.id}
              className={`aspect-[4/5] rounded-lg border overflow-hidden relative ${
                s.generationStatus === 'ready'
                  ? 'border-emerald-500/40'
                  : s.generationStatus === 'error'
                  ? 'border-rose-500/40'
                  : 'border-white/10'
              }`}
            >
              {s.imageUrl ? (
                <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/40">
                  {s.generationStatus === 'generating' ? (
                    <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
                  ) : s.generationStatus === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  ) : (
                    <Clock className="w-5 h-5 text-white/30" />
                  )}
                </div>
              )}
              <span className="absolute bottom-1 left-1 text-[10px] text-white/70 font-mono bg-black/60 px-1.5 rounded">
                {s.order}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// 3. Viewer stage — interactive 10-scene grid
// ════════════════════════════════════════════════════════════════════

function ViewerStage(props: {
  projectId: number;
  galleryToken: string;
  lang: Lang;
  storyboard: Storyboard;
  storyboardStatus: string | null;
  onProjectRefresh: () => Promise<void> | void;
}) {
  const { projectId, galleryToken, lang, storyboard, storyboardStatus, onProjectRefresh } = props;
  const [activeIndex, setActiveIndex] = useState(0);
  const [showPrompts, setShowPrompts] = useState(false);
  const [editing, setEditing] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [animateProgress, setAnimateProgress] = useState(0);
  const [animateLog, setAnimateLog] = useState<string[]>([]);
  const [animateError, setAnimateError] = useState<string | null>(null);
  const [animateDone, setAnimateDone] = useState(false);
  const [showTheme, setShowTheme] = useState(false);

  const readyScenesCount = storyboard.scenes.filter((s) => s.imageUrl).length;
  const canAnimate = readyScenesCount >= 2;

  const handleAnimateStoryboard = async () => {
    if (!canAnimate || animating) return;
    setAnimating(true);
    setAnimateProgress(0);
    setAnimateLog([]);
    setAnimateError(null);
    setAnimateDone(false);

    try {
      const resp = await fetch(`/api/video-concepts/${projectId}/storyboard/animate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      if (!resp.body) throw new Error('No response stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const data = JSON.parse(line.slice(5).trim());
            if (data.progress !== undefined) setAnimateProgress(data.progress);
            if (data.error) { setAnimateError(data.error); break; }
            if (data.sceneId) {
              setAnimateLog((prev) => [...prev.slice(-9), `Scene ${data.order}: ${data.error ? '✗ ' + data.error : '✓ done'}`]);
            }
            if (data.success) {
              setAnimateDone(true);
              setAnimateProgress(100);
              void onProjectRefresh();
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setAnimateError(err?.message || 'Animation failed');
    } finally {
      setAnimating(false);
    }
  };

  // Keep polling while ANY scene is still generating (e.g. user just triggered a regen).
  useEffect(() => {
    const stillRendering = storyboard.scenes.some((s) => s.generationStatus === 'generating' || s.generationStatus === 'pending');
    if (!stillRendering) return;
    const interval = setInterval(() => { void onProjectRefresh(); }, 4000);
    return () => clearInterval(interval);
  }, [storyboard, onProjectRefresh]);

  const scene = storyboard.scenes[activeIndex];
  if (!scene) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-br from-amber-500/[0.04] via-black to-black p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2 max-w-3xl">
            <p className="text-[10px] uppercase tracking-[0.25em] text-amber-300/80 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" />
              {storyboardStatus === 'ready' ? t('sbStoryboardReady', lang) : t('sbViewerTitle', lang)}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-br from-white to-amber-200 bg-clip-text text-transparent">
              {storyboard.title}
            </h2>
            {storyboard.tagline && <p className="text-amber-100/70 italic">{storyboard.tagline}</p>}
            <p className="text-white/65 leading-relaxed">{storyboard.logline}</p>
            {storyboard.tone?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {storyboard.tone.map((tag) => (
                  <span key={tag} className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-white/70">{tag}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowPrompts((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 bg-white/[0.03] text-xs text-white/70 hover:text-white hover:border-white/30 transition-colors"
            >
              {showPrompts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPrompts ? t('sbHidePrompts', lang) : t('sbViewPrompts', lang)}
            </button>
            {storyboard.visualTheme && (
              <button
                onClick={() => setShowTheme((v) => !v)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-amber-500/30 bg-amber-500/[0.06] text-xs text-amber-200/80 hover:text-amber-100 hover:border-amber-400/50 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Production Bible
              </button>
            )}
            <button
              onClick={handleAnimateStoryboard}
              disabled={!canAnimate || animating}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-purple-500/40 bg-purple-500/[0.08] text-xs text-purple-200/80 hover:text-purple-100 hover:border-purple-400/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {animating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Film className="w-3.5 h-3.5" />}
              {animating ? `Animating… ${animateProgress}%` : animateDone ? '✓ Animated' : 'Animate Storyboard'}
            </button>
          </div>
        </div>

        {/* Visual Theme / Production Bible */}
        {showTheme && storyboard.visualTheme && (
          <div className="mt-5 pt-5 border-t border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/60 mb-3">Production Bible — Visual Theme</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
              {([
                ['Lighting', storyboard.visualTheme.lightingStyle],
                ['Lens', storyboard.visualTheme.lensCharacter],
                ['Film Look', storyboard.visualTheme.filmLook],
                ['Motion', storyboard.visualTheme.motionLanguage],
                ['Color Temp', storyboard.visualTheme.colorTemperature],
                ['Contrast', storyboard.visualTheme.contrast],
                ['Depth of Field', storyboard.visualTheme.depthOfField],
                ['Atmospherics', storyboard.visualTheme.atmospherics],
                ['Cinematic Ref', storyboard.visualTheme.cinematicReference],
              ] as [string, string | undefined][]).filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-2.5">
                  <p className="text-white/40 text-[10px] mb-0.5">{label}</p>
                  <p className="text-white/80">{value}</p>
                </div>
              ))}
            </div>
            {storyboard.visualTheme.platformNote && (
              <p className="mt-2 text-[11px] text-amber-200/60 italic">{storyboard.visualTheme.platformNote}</p>
            )}
          </div>
        )}

        {/* Animation progress log */}
        {(animating || animateDone || animateError) && (
          <div className="mt-4 pt-4 border-t border-white/[0.06]">
            {animateError && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" />{animateError}</p>
            )}
            {animateLog.length > 0 && (
              <div className="space-y-0.5">
                {animateLog.map((line, i) => (
                  <p key={i} className="text-[11px] text-white/50 font-mono">{line}</p>
                ))}
              </div>
            )}
            {animating && (
              <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-purple-500/70 transition-all duration-500" style={{ width: `${animateProgress}%` }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scene grid (mini) */}
      <div className="grid grid-cols-5 gap-2">
        {storyboard.scenes.map((s, i) => (
          <button
            key={s.id}
            onClick={() => { setActiveIndex(i); setEditing(false); }}
            className={`aspect-[4/5] rounded-lg overflow-hidden relative border transition-all ${
              i === activeIndex ? 'border-amber-400 ring-2 ring-amber-500/40 scale-[1.02]' : 'border-white/10 hover:border-white/30'
            }`}
          >
            {s.imageUrl ? (
              <img src={s.imageUrl} alt={s.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black/40">
                {s.generationStatus === 'generating' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                ) : s.generationStatus === 'error' ? (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-white/30" />
                )}
              </div>
            )}
            <span className="absolute bottom-1 left-1 text-[10px] font-mono text-white/80 bg-black/60 px-1.5 rounded">
              {s.order}
            </span>
          </button>
        ))}
      </div>

      {/* Active scene detail */}
      <SceneDetail
        key={scene.id}
        scene={scene}
        sceneCount={storyboard.scenes.length}
        projectId={projectId}
        galleryToken={galleryToken}
        lang={lang}
        showPrompts={showPrompts}
        editing={editing}
        setEditing={setEditing}
        onProjectRefresh={onProjectRefresh}
      />
    </div>
  );
}

function SceneDetail(props: {
  scene: Scene;
  sceneCount: number;
  projectId: number;
  galleryToken: string;
  lang: Lang;
  showPrompts: boolean;
  editing: boolean;
  setEditing: (b: boolean) => void;
  onProjectRefresh: () => Promise<void> | void;
}) {
  const { scene, sceneCount, projectId, galleryToken, lang, showPrompts, editing, setEditing, onProjectRefresh } = props;
  const [draftTitle, setDraftTitle] = useState(scene.title);
  const [draftNarration, setDraftNarration] = useState(scene.narration);
  const [draftDirection, setDraftDirection] = useState(scene.visualDirection);
  const [draftMusic, setDraftMusic] = useState(scene.musicCue);
  const [draftPrompt, setDraftPrompt] = useState(scene.imagePrompt);
  const [saving, setSaving] = useState(false);
  const [regenning, setRegenning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftTitle(scene.title);
    setDraftNarration(scene.narration);
    setDraftDirection(scene.visualDirection);
    setDraftMusic(scene.musicCue);
    setDraftPrompt(scene.imagePrompt);
  }, [scene.id]);

  const saveText = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/api/video-concepts/${projectId}/storyboard/scene/${scene.id}`, 'PATCH', {
        galleryToken,
        title: draftTitle,
        narration: draftNarration,
        visualDirection: draftDirection,
        musicCue: draftMusic,
        imagePrompt: draftPrompt,
      });
      await onProjectRefresh();
      setEditing(false);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const regenImage = async () => {
    setRegenning(true);
    setError(null);
    try {
      await apiRequest(`/api/video-concepts/${projectId}/storyboard/scene/${scene.id}/image`, 'POST', {
        galleryToken,
        imagePrompt: draftPrompt || scene.imagePrompt,
      });
      await onProjectRefresh();
    } catch (e: any) {
      setError(e?.message || 'Regeneration failed');
    } finally {
      setRegenning(false);
    }
  };

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-black/40 overflow-hidden">
      <div className="grid lg:grid-cols-[1fr_1fr] gap-0">
        {/* Image */}
        <div className="relative aspect-[4/5] lg:aspect-auto bg-black border-b lg:border-b-0 lg:border-r border-white/[0.06]">
          {scene.imageUrl ? (
            <img src={scene.imageUrl} alt={scene.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-3">
              {scene.generationStatus === 'generating' ? (
                <>
                  <Loader2 className="w-8 h-8 animate-spin text-amber-300" />
                  <p className="text-sm">{t('sbSceneGenerating', lang)}</p>
                </>
              ) : scene.generationStatus === 'error' ? (
                <>
                  <AlertCircle className="w-8 h-8 text-rose-400" />
                  <p className="text-sm text-rose-300">{t('sbSceneError', lang)}</p>
                  {scene.error && <p className="text-[11px] text-white/40 max-w-xs text-center px-4">{scene.error}</p>}
                </>
              ) : (
                <>
                  <ImageIcon className="w-8 h-8" />
                  <p className="text-sm">{t('sbScenePending', lang)}</p>
                </>
              )}
            </div>
          )}
          <div className="absolute top-3 left-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/70 backdrop-blur text-[11px] text-white/80 border border-white/10">
            {t('sbScene', lang)} {scene.order} {t('sbSceneOf', lang)} {sceneCount}
          </div>
          <button
            onClick={regenImage}
            disabled={regenning || scene.generationStatus === 'generating'}
            className="absolute bottom-3 right-3 inline-flex items-center gap-2 px-3 py-2 rounded-full bg-black/70 backdrop-blur border border-white/15 text-xs text-white hover:bg-amber-500 hover:text-black hover:border-amber-500 disabled:opacity-50 transition-colors"
          >
            {regenning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {regenning ? t('sbRegenerating', lang) : t('sbRegenerateImage', lang)}
          </button>
        </div>

        {/* Text */}
        <div className="p-5 md:p-7 space-y-4">
          {!editing ? (
            <>
              <h3 className="text-2xl font-bold text-white">{scene.title}</h3>
              <Field icon={<FileText className="w-3.5 h-3.5" />} label={t('sbNarration', lang)}>
                <p className="text-white/85 leading-relaxed italic font-serif">"{scene.narration}"</p>
              </Field>
              <Field icon={<Camera className="w-3.5 h-3.5" />} label={t('sbVisualDir', lang)}>
                <p className="text-white/70 text-sm">{scene.visualDirection}</p>
              </Field>
              <div className="grid grid-cols-3 gap-3 pt-1">
                <MetaPill icon={<Camera className="w-3.5 h-3.5" />} label={t('sbCameraMove', lang)} value={scene.cameraMove} />
                <MetaPill icon={<Clock className="w-3.5 h-3.5" />} label={t('sbDuration', lang)} value={scene.duration} />
                <MetaPill icon={<Music2 className="w-3.5 h-3.5" />} label={t('sbMusicCue', lang)} value={scene.musicCue} />
              </div>
              {showPrompts && (
                <Field icon={<Wand2 className="w-3.5 h-3.5" />} label={t('sbImagePrompt', lang)}>
                  <p className="text-white/55 text-[11px] font-mono bg-black/30 p-3 rounded-lg border border-white/[0.06]">{scene.imagePrompt}</p>
                </Field>
              )}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-white/[0.06]">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.03] text-xs text-white/80 hover:text-white hover:border-white/30 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" /> {t('sbEditScene', lang)}
                </button>
                {scene.generationProvider && (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] text-white/40 font-mono">
                    via {scene.generationProvider}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <input
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-xl font-bold focus:border-amber-500/50 focus:outline-none"
              />
              <textarea
                value={draftNarration}
                onChange={(e) => setDraftNarration(e.target.value)}
                rows={3}
                placeholder={t('sbNarration', lang)}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/90 italic font-serif focus:border-amber-500/50 focus:outline-none resize-y"
              />
              <textarea
                value={draftDirection}
                onChange={(e) => setDraftDirection(e.target.value)}
                rows={3}
                placeholder={t('sbVisualDir', lang)}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/80 text-sm focus:border-amber-500/50 focus:outline-none resize-y"
              />
              <input
                value={draftMusic}
                onChange={(e) => setDraftMusic(e.target.value)}
                placeholder={t('sbMusicCue', lang)}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/80 text-sm focus:border-amber-500/50 focus:outline-none"
              />
              <textarea
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                rows={3}
                placeholder={t('sbImagePrompt', lang)}
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white/60 text-xs font-mono focus:border-amber-500/50 focus:outline-none resize-y"
              />
              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveText}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {t('sbSaveScene', lang)}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 text-white/70 text-sm hover:text-white"
                >
                  <X className="w-3.5 h-3.5" /> {t('sbCancel', lang)}
                </button>
              </div>
            </>
          )}
          {error && <p className="text-rose-300 text-xs">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      {children}
    </div>
  );
}

function MetaPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/30 border border-white/[0.06] p-2.5">
      <p className="text-[9px] uppercase tracking-widest text-white/40 flex items-center gap-1">{icon}{label}</p>
      <p className="text-xs text-white/85 mt-1 font-medium truncate">{value || '—'}</p>
    </div>
  );
}
