/**
 * 🔥 ChallengeEngineCard
 *
 * 4-step wizard embedded in the Promote Song modal:
 * 1. Analyze virality (GPT-4o-mini)
 * 2. Optional reference video upload
 * 3. Generate 3 Kling challenge videos (Urban | Group Dance | Luxury)
 * 4. Build 15-day launch campaign calendar
 */
import React, { useRef, useState } from 'react';
import { Flame, TrendingUp, Music2, Zap, Calendar, Upload, Play, ChevronRight, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useChallengeEngine } from '../../hooks/use-challenge-engine';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import firebaseApp from '../../lib/firebase';

interface Props {
  songId: number;
  artistId: number | null | undefined;
  songTitle?: string;
}

const PLATFORM_ICONS: Record<string, string> = {
  tiktok: '🎵',
  instagram: '📸',
  youtube_shorts: '▶️',
  all: '🌐',
};

const CONTENT_TYPE_COLORS: Record<string, string> = {
  launch: 'bg-orange-500',
  repost: 'bg-blue-500',
  challenge_cta: 'bg-purple-500',
  reaction: 'bg-pink-500',
  milestone: 'bg-yellow-500',
  winner: 'bg-green-500',
};

function ViralScoreBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  const label = pct >= 75 ? 'Viral' : pct >= 50 ? 'Strong' : pct >= 25 ? 'Moderate' : 'Low';
  const labelColor = pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-yellow-400' : pct >= 25 ? 'text-orange-400' : 'text-red-400';
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-400 font-medium">Viral Score</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${labelColor}`}>{label}</span>
          <span className="text-lg font-bold text-white">{pct}<span className="text-sm text-slate-500">/100</span></span>
        </div>
      </div>
      <div className="relative w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-orange-500 to-emerald-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function ChallengeEngineCard({ songId, artistId, songTitle }: Props) {
  const { analyzeMutation, generateMutation, calendarMutation, useCampaignStatus } =
    useChallengeEngine(songId);

  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [refVideoUrl, setRefVideoUrl] = useState<string | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [calendar, setCalendar] = useState<any[]>([]);
  const refVideoInputRef = useRef<HTMLInputElement>(null);

  // Poll campaign status while generating
  const statusQ = useCampaignStatus(campaignId);
  const campaign = statusQ.data?.campaign;
  const isGenerating = campaign?.status === 'generating' || campaign?.status === 'analyzing';
  const isDone = campaign?.status === 'done';
  const isFailed = campaign?.status === 'failed';

  // ── Step 1: Analyze ──────────────────────────────────────────────────
  const handleAnalyze = async () => {
    try {
      const res = await analyzeMutation.mutateAsync();
      if (res.ok) {
        setCampaignId(res.campaignId);
        setStep(2);
      }
    } catch (_) {
      // Error already shown as toast via onError in useChallengeEngine
    }
  };

  // ── Step 2: Upload reference video ───────────────────────────────────
  const handleRefVideoUpload = async (file: File) => {
    setUploadingRef(true);
    setUploadProgress(0);
    try {
      const storage = getStorage(firebaseApp);
      const fileRef = ref(storage, `challenge-refs/${songId}/${Date.now()}-${file.name}`);
      const task = uploadBytesResumable(fileRef, file);
      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            setRefVideoUrl(url);
            resolve();
          },
        );
      });
    } catch (err: any) {
      console.error('[ChallengeEngineCard] ref upload failed', err);
    } finally {
      setUploadingRef(false);
    }
  };

  // ── Step 3: Generate videos ───────────────────────────────────────────
  const handleGenerate = async () => {
    if (!campaignId) return;
    try {
      await generateMutation.mutateAsync({ campaignId, referenceVideoUrl: refVideoUrl ?? undefined });
      setStep(3);
    } catch (_) {
      // Error already shown as toast via onError in useChallengeEngine
    }
  };

  // ── Step 4: Build calendar ────────────────────────────────────────────
  const handleBuildCalendar = async () => {
    if (!campaignId) return;
    try {
      const res = await calendarMutation.mutateAsync(campaignId);
      if (res.ok) {
        setCalendar(res.calendar);
        setStep(4);
      }
    } catch (_) {
      // Error already shown as toast via onError in useChallengeEngine
    }
  };

  const analyzeData = analyzeMutation.data;

  return (
    <Card className="bg-white/[0.03] border-white/8 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2.5 text-base font-bold text-white">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-500/20 shrink-0">
            <Flame className="h-4 w-4 text-orange-400" />
          </div>
          Challenge Engine
          <Badge className="ml-auto bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs font-semibold">
            Viral Factory
          </Badge>
        </CardTitle>
        <p className="text-xs text-slate-500 ml-10">
          Viral TikTok / Instagram challenge for <span className="text-slate-300 font-medium">{songTitle || `Song #${songId}`}</span>
        </p>
      </CardHeader>

      <CardContent className="space-y-5">

        {/* ── Step Indicator ── */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map((s) => (
            <React.Fragment key={s}>
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-colors ${
                  step > s
                    ? 'bg-green-500 text-white'
                    : step === s
                    ? 'bg-orange-500 text-white'
                    : 'bg-white/10 text-muted-foreground'
                }`}
              >
                {step > s ? <CheckCircle2 className="h-3 w-3" /> : s}
              </div>
              {s < 4 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-green-500' : 'bg-white/10'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── STEP 1: Analyze ── */}
        <div className={step === 1 ? 'block' : 'block'}>
          {!analyzeData && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                AI analyzes your song's BPM, energy, and danceability to generate a viral challenge concept.
              </p>
              <Button
                onClick={handleAnalyze}
                disabled={analyzeMutation.isPending}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
              >
                {analyzeMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing…</>
                ) : (
                  <><TrendingUp className="h-4 w-4 mr-2" /> Analyze Virality</>
                )}
              </Button>
            </div>
          )}

          {analyzeData && (
            <div className="space-y-4 rounded-xl bg-white/5 border border-white/8 p-4">
              <ViralScoreBar score={analyzeData.viralScore} />
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2.5 bg-white/5 rounded-lg border border-white/5">
                  <Music2 className="h-3.5 w-3.5 text-blue-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">BPM</p>
                  <p className="text-base font-bold text-white">{analyzeData.bpm?.toFixed(0) ?? '—'}</p>
                </div>
                <div className="text-center p-2.5 bg-white/5 rounded-lg border border-white/5">
                  <Zap className="h-3.5 w-3.5 text-yellow-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">Energy</p>
                  <p className="text-base font-bold text-white">{analyzeData.energyLevel != null ? `${Math.round(analyzeData.energyLevel * 100)}%` : '—'}</p>
                </div>
                <div className="text-center p-2.5 bg-white/5 rounded-lg border border-white/5">
                  <Flame className="h-3.5 w-3.5 text-orange-400 mx-auto mb-1" />
                  <p className="text-xs text-slate-500">Dance</p>
                  <p className="text-base font-bold text-white">{analyzeData.danceability != null ? `${Math.round(analyzeData.danceability * 100)}%` : '—'}</p>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Challenge Name</p>
                  <p className="text-sm font-bold text-white">{analyzeData.challengeName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Hashtag</p>
                  <p className="text-sm font-semibold text-orange-300">{analyzeData.hashtag}</p>
                </div>
                {analyzeData.hookText && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Hook</p>
                    <p className="text-sm text-white/80 italic">"{analyzeData.hookText}"</p>
                  </div>
                )}
              </div>
              {step === 1 && (
                <Button
                  onClick={() => setStep(2)}
                  size="sm"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                >
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ── STEP 2: Reference Video ── */}
        {step >= 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Reference Video <span className="text-xs text-muted-foreground font-normal">(optional)</span></p>
              {step === 2 && (
                <Button
                  onClick={() => setStep(3)}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground h-7"
                >
                  Skip
                </Button>
              )}
            </div>
            {step === 2 && (
              <>
                <p className="text-xs text-muted-foreground">
                  Upload a short video clip as visual reference for the AI. Otherwise your artist profile image will be used.
                </p>
                <input
                  ref={refVideoInputRef}
                  type="file"
                  accept="video/*,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleRefVideoUpload(f);
                  }}
                />
                {uploadingRef ? (
                  <div className="space-y-1">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">{uploadProgress}%</p>
                  </div>
                ) : refVideoUrl ? (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Reference uploaded
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refVideoInputRef.current?.click()}
                    className="w-full border-white/20 text-white/80"
                  >
                    <Upload className="h-4 w-4 mr-2" /> Upload Reference
                  </Button>
                )}
                <Button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending || uploadingRef}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
                >
                  {generateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Starting…</>
                  ) : (
                    <><Zap className="h-4 w-4 mr-2" /> Generate 3 Challenge Videos</>
                  )}
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── STEP 3: Videos ── */}
        {step >= 3 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">Challenge Videos</p>

            {isGenerating && (
              <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <Loader2 className="h-4 w-4 text-orange-400 animate-spin shrink-0" />
                <p className="text-xs text-orange-300">
                  Kling AI is generating 3 video styles… This takes 3-5 minutes. You can close this modal and come back.
                </p>
              </div>
            )}

            {isFailed && (
              <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-red-300">Video generation failed.</p>
                  {campaign?.errorMessage && <p className="text-xs text-red-400/70 truncate">{campaign.errorMessage}</p>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-red-300 shrink-0"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                >
                  <RefreshCw className="h-3 w-3 mr-1" /> Retry
                </Button>
              </div>
            )}

            {isDone && campaign && (
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { label: 'Urban', url: campaign.urbanVideoUrl, emoji: '🏙️' },
                  { label: 'Group Dance', url: campaign.groupDanceVideoUrl, emoji: '💃' },
                  { label: 'Luxury', url: campaign.luxuryVideoUrl, emoji: '✨' },
                ].map(({ label, url, emoji }) => (
                  <div key={label} className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-300">{emoji} {label}</p>
                    {url ? (
                      <video
                        src={url}
                        controls
                        playsInline
                        className="w-full rounded-lg aspect-[9/16] object-cover bg-black/60"
                      />
                    ) : (
                      <div className="w-full aspect-[9/16] bg-white/5 rounded-lg border border-white/8 flex items-center justify-center">
                        <Play className="h-5 w-5 text-white/20" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {isDone && step === 3 && (
              <Button
                onClick={handleBuildCalendar}
                disabled={calendarMutation.isPending}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
              >
                {calendarMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Building Calendar…</>
                ) : (
                  <><Calendar className="h-4 w-4 mr-2" /> Build 15-Day Campaign</>
                )}
              </Button>
            )}
          </div>
        )}

        {/* ── STEP 4: Calendar ── */}
        {step >= 4 && calendar.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-400" />
              15-Day Campaign Calendar
            </p>
            <div className="space-y-2">
              {calendar.map((day: any) => (
                <div
                  key={day.day}
                  className="flex gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/8 hover:border-orange-500/20 transition-colors"
                >
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/20 flex items-center justify-center text-sm font-bold text-orange-300">
                      {day.day}
                    </div>
                    <span className="text-sm">{PLATFORM_ICONS[day.platform] ?? '🌐'}</span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${CONTENT_TYPE_COLORS[day.contentType] ?? 'bg-gray-500'}`} />
                      <span className="text-xs text-slate-400 capitalize">{day.contentType?.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-slate-600 ml-auto shrink-0">{day.bestTime}</span>
                    </div>
                    <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">{day.caption}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(day.hashtags || []).slice(0, 3).map((h: string) => (
                        <span key={h} className="text-xs text-orange-300/60">#{h.replace(/^#/, '')}</span>
                      ))}
                    </div>
                    {day.engagementTip && (
                      <p className="text-xs text-blue-300/60 italic">💡 {day.engagementTip}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
