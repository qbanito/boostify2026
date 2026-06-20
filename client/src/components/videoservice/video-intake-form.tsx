import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Music2, Film, Palette, Settings, User, ArrowRight, ArrowLeft, CheckCircle2, Loader2, Sparkles, ImagePlus, Gift } from 'lucide-react';
import { Button } from '../ui/button';
import { t, type Lang } from '../../lib/videoservice-i18n';
import { BudgetCalculator, calculateBudget, type BudgetInputs } from './budget-calculator';
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';

interface Props { lang: Lang }

const TOTAL_STEPS = 5;

const stepIcons = [Music2, Film, Settings, Palette, User];

export function VideoIntakeForm({ lang }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [songName, setSongName] = useState('');
  const [genre, setGenre] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [videoType, setVideoType] = useState<'music_video' | 'commercial' | 'lyric_video'>('music_video');
  const [aesthetic, setAesthetic] = useState('');
  const [description, setDescription] = useState('');

  const [needsRealVideo, setNeedsRealVideo] = useState(false);
  const [needsLipSync, setNeedsLipSync] = useState(false);
  const [resolution, setResolution] = useState<'1080p' | '4k'>('1080p');
  const [videoDuration, setVideoDuration] = useState('');
  const [locations, setLocations] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [spotify, setSpotify] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [artistImage, setArtistImage] = useState<File | null>(null);
  const [artistImagePreview, setArtistImagePreview] = useState<string | null>(null);

  const budgetInputs: BudgetInputs = { needsRealVideo, needsLipSync, resolution, videoDuration, locations };
  const budget = calculateBudget(budgetInputs);

  const canNext = useCallback(() => {
    if (step === 0) return songName.trim().length > 0;
    if (step === 1) return true;
    if (step === 2) return true;
    if (step === 3) return true;
    if (step === 4) return fullName.trim().length > 0 && email.includes('@') && acceptTerms;
    return true;
  }, [step, songName, fullName, email, acceptTerms]);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Convert image to base64 if present
      let imageBase64: string | undefined;
      if (artistImage) {
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(artistImage);
        });
      }

      // Convert audio to base64 if present
      let audioBase64: string | undefined;
      if (audioFile) {
        audioBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(audioFile);
        });
      }

      // 1. Create lead + generate artist page
      const leadRes = await apiRequest('/api/videoservice/lead', 'POST', {
        leadName: fullName,
        leadEmail: email,
        leadPhone: phone || undefined,
        leadInstagram: instagram || undefined,
        leadSpotify: spotify || undefined,
        songName,
        songGenre: genre || undefined,
        videoType,
        aesthetic: aesthetic || undefined,
        description: description || undefined,
        needsRealVideo,
        needsLipSync,
        resolution,
        videoDuration: videoDuration || undefined,
        locations: locations || undefined,
        calculatedPrice: String(budget.total),
        depositAmount: String(budget.deposit),
        lang,
        artistImage: imageBase64,
        audioFile: audioBase64,
      });

      if (!leadRes.success) throw new Error(leadRes.error || 'Failed');

      const projectId = leadRes.projectId;

      // Redirect to success/tracking page
      window.location.href = `/videoservice/success?project_id=${projectId}`;
    } catch (e: any) {
      const msg = e?.message || '';
      const isTooLarge = /413|too large|payload/i.test(msg);
      toast({
        title: isTooLarge
          ? (lang === 'es' ? 'Archivos demasiado grandes' : 'Files too large')
          : 'Error',
        description: isTooLarge
          ? (lang === 'es'
              ? 'Tu audio o imagen supera el límite. Usa un audio de menos de 40MB y una imagen de menos de 10MB.'
              : 'Your audio or image is too large. Please use an audio under 40MB and an image under 10MB.')
          : (msg || (lang === 'es' ? 'Algo salió mal' : 'Something went wrong')),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image too large (max 10MB)', variant: 'destructive' });
      return;
    }
    setArtistImage(file);
    const url = URL.createObjectURL(file);
    setArtistImagePreview(url);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|m4a|ogg|flac)$/i))) {
      handleAudioSelect(file);
    }
  };

  const handleAudioSelect = (file: File) => {
    // Max 40MB raw (becomes ~53MB base64, under our 75MB server limit)
    if (file.size > 40 * 1024 * 1024) {
      toast({
        title: lang === 'es' ? 'Audio demasiado grande' : 'Audio too large',
        description: lang === 'es'
          ? 'El archivo de audio supera 40MB. Comprímelo o sube una versión más corta.'
          : 'Your audio file is over 40MB. Please compress it or upload a shorter version.',
        variant: 'destructive',
      });
      return;
    }
    setAudioFile(file);
  };

  return (
    <div className="relative rounded-3xl overflow-hidden">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl" />
      <div className="absolute inset-0 border border-white/[0.08] rounded-3xl" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
      
      <div className="relative">
        {/* Step progress */}
        <div className="px-4 sm:px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
              const Icon = stepIcons[i];
              const active = i === step;
              const done = i < step;
              return (
                <React.Fragment key={i}>
                  <button onClick={() => i < step && setStep(i)}
                    className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-300
                      ${active ? 'bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/30 scale-110' : done ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/[0.04] border border-white/[0.08]'}`}>
                    {done ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Icon className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-600'}`} />}
                    {active && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-orange-500 rounded-full" />}
                  </button>
                  {i < TOTAL_STEPS - 1 && (
                    <div className={`flex-1 h-[2px] mx-1.5 rounded-full transition-colors duration-500 ${i < step ? 'bg-green-500/40' : 'bg-white/[0.06]'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-600 px-1">
            {(['step1Title', 'step2Title', 'step3Title', 'step4Title', 'step5Title'] as const).map((k, i) => (
              <span key={k} className={`text-center w-11 ${i === step ? 'text-orange-400 font-medium' : i < step ? 'text-green-500/70' : ''}`}>
                {(t(k, lang) as string).split(' ')[0]}
              </span>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        {/* Step content */}
        <div className="p-5 sm:p-7 md:p-9 min-h-[320px]">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 30, filter: 'blur(4px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: -30, filter: 'blur(4px)' }} transition={{ duration: 0.3 }}>
            {step === 0 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{t('step1Title', lang)}</h3>
                <div className="group">
                  <label className="block text-sm text-gray-400 mb-2 font-medium">{t('songNameLabel', lang)} *</label>
                  <input value={songName} onChange={e => setSongName(e.target.value)} placeholder={t('songNamePh', lang) as string}
                    className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder:text-gray-600 focus:border-orange-500/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-300" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-medium">{t('genreLabel', lang)}</label>
                  <select value={genre} onChange={e => setGenre(e.target.value)}
                    className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3.5 text-white focus:border-orange-500/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-300">
                    <option value="">—</option>
                    {(t('genres', lang) as string[]).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-medium">{t('uploadSong', lang)}</label>
                  <div onDragOver={e => e.preventDefault()} onDrop={handleFileDrop}
                    className="group/drop border-2 border-dashed border-white/[0.08] rounded-2xl p-8 text-center hover:border-orange-500/40 hover:bg-orange-500/[0.03] transition-all duration-300 cursor-pointer"
                    onClick={() => document.getElementById('audio-upload')?.click()}>
                    <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-white/[0.04] flex items-center justify-center group-hover/drop:bg-orange-500/10 group-hover/drop:scale-110 transition-all">
                      <Upload className="w-6 h-6 text-gray-600 group-hover/drop:text-orange-400 transition-colors" />
                    </div>
                    <p className="text-sm text-gray-500">{audioFile ? <span className="text-green-400">✓ {audioFile.name}</span> : t('uploadDrag', lang)}</p>
                    <p className="text-xs text-gray-700 mt-1">{t('uploadMax', lang)}</p>
                    <input id="audio-upload" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" className="hidden"
                      onChange={e => e.target.files?.[0] && handleAudioSelect(e.target.files[0])} />
                  </div>
                </div>
                {/* Artist image upload */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-medium">{t('uploadImageLabel', lang)}</label>
                  <p className="text-xs text-orange-400/80 mb-2">{t('uploadImageDesc', lang)}</p>
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && f.type.startsWith('image/')) handleImageSelect(f); }}
                    className="group/img border-2 border-dashed border-white/[0.08] rounded-2xl p-6 text-center hover:border-orange-500/40 hover:bg-orange-500/[0.03] transition-all duration-300 cursor-pointer relative overflow-hidden"
                    onClick={() => document.getElementById('artist-image-upload')?.click()}>
                    {artistImagePreview ? (
                      <div className="relative">
                        <img src={artistImagePreview} alt="Preview" className="w-24 h-24 object-cover rounded-xl mx-auto border-2 border-orange-500/40 shadow-lg shadow-orange-500/10" />
                        <p className="text-xs text-green-400 mt-3 font-medium">✓ {lang === 'es' ? 'Imagen seleccionada' : 'Image selected'}</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-white/[0.04] flex items-center justify-center group-hover/img:bg-orange-500/10 group-hover/img:scale-110 transition-all">
                          <ImagePlus className="w-6 h-6 text-gray-600 group-hover/img:text-orange-400 transition-colors" />
                        </div>
                        <p className="text-sm text-gray-500">{t('uploadImageDrag', lang)}</p>
                        <p className="text-xs text-gray-700 mt-1">{t('uploadImageMax', lang)}</p>
                      </>
                    )}
                    <input id="artist-image-upload" type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      onChange={e => e.target.files?.[0] && handleImageSelect(e.target.files[0])} />
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{t('step2Title', lang)}</h3>
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-medium">{t('videoTypeLabel', lang)}</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['music_video', 'commercial', 'lyric_video'] as const).map(vt => (
                      <button key={vt} onClick={() => setVideoType(vt)}
                        className={`p-4 rounded-xl border text-sm font-medium transition-all duration-300 ${videoType === vt ? 'bg-gradient-to-br from-orange-500/20 to-red-500/10 border-orange-500/50 text-orange-400 shadow-lg shadow-orange-500/10 scale-[1.02]' : 'border-white/[0.08] text-gray-400 hover:bg-white/[0.03] hover:border-white/15'}`}>
                        {(t('videoTypes', lang) as Record<string, string>)[vt]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-medium">{t('aestheticLabel', lang)}</label>
                  <div className="flex flex-wrap gap-2">
                    {(t('aesthetics', lang) as string[]).map(a => (
                      <button key={a} onClick={() => setAesthetic(a)}
                        className={`px-4 py-2 rounded-full text-xs font-medium border transition-all duration-300 ${aesthetic === a ? 'bg-gradient-to-r from-orange-500/20 to-red-500/10 border-orange-500/50 text-orange-400 shadow-sm shadow-orange-500/10' : 'border-white/[0.08] text-gray-400 hover:bg-white/[0.03] hover:border-white/15'}`}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-medium">{t('visionLabel', lang)}</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('visionPh', lang) as string}
                    rows={3} className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder:text-gray-600 focus:border-orange-500/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-300 resize-none" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{t('step3Title', lang)}</h3>
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-medium">{t('realVideoQ', lang)}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setNeedsRealVideo(false)}
                      className={`p-4 rounded-xl border text-sm transition-all duration-300 ${!needsRealVideo ? 'bg-gradient-to-br from-orange-500/20 to-red-500/10 border-orange-500/50 text-orange-400 shadow-lg shadow-orange-500/10' : 'border-white/[0.08] text-gray-400 hover:bg-white/[0.03]'}`}>
                      <Sparkles className="w-5 h-5 mx-auto mb-2" /> {t('realVideoNo', lang)}
                    </button>
                    <button onClick={() => setNeedsRealVideo(true)}
                      className={`p-4 rounded-xl border text-sm transition-all duration-300 ${needsRealVideo ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/10 border-purple-500/50 text-purple-400 shadow-lg shadow-purple-500/10' : 'border-white/[0.08] text-gray-400 hover:bg-white/[0.03]'}`}>
                      <Film className="w-5 h-5 mx-auto mb-2" /> {t('realVideoYes', lang)}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">{t('lipSyncQ', lang)}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setNeedsLipSync(true)}
                        className={`py-2.5 rounded-xl border text-sm font-medium transition-all duration-300 ${needsLipSync ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'border-white/[0.08] text-gray-400 hover:bg-white/[0.03]'}`}>
                        {t('lipSyncYes', lang)}
                      </button>
                      <button onClick={() => setNeedsLipSync(false)}
                        className={`py-2.5 rounded-xl border text-sm font-medium transition-all duration-300 ${!needsLipSync ? 'bg-white/10 border-white/20 text-white' : 'border-white/[0.08] text-gray-400 hover:bg-white/[0.03]'}`}>
                        {t('lipSyncNo', lang)}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">{t('resolutionLabel', lang)}</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setResolution('1080p')}
                        className={`py-2.5 rounded-xl border text-sm font-medium transition-all duration-300 ${resolution === '1080p' ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'border-white/[0.08] text-gray-400 hover:bg-white/[0.03]'}`}>
                        1080p
                      </button>
                      <button onClick={() => setResolution('4k')}
                        className={`py-2.5 rounded-xl border text-sm font-medium transition-all duration-300 ${resolution === '4k' ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'border-white/[0.08] text-gray-400 hover:bg-white/[0.03]'}`}>
                        4K
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-medium">{t('videoDurationLabel', lang)}</label>
                  <select value={videoDuration} onChange={e => setVideoDuration(e.target.value)}
                    className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3.5 text-white focus:border-orange-500/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-300">
                    <option value="">—</option>
                    {(t('durations', lang) as string[]).map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                {needsRealVideo && (
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">{t('locationsLabel', lang)}</label>
                    <input value={locations} onChange={e => setLocations(e.target.value)} placeholder={t('locationsPh', lang) as string}
                      className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder:text-gray-600 focus:border-orange-500/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-300" />
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{t('step4Title', lang)}</h3>
                <BudgetCalculator inputs={budgetInputs} lang={lang} />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{t('step5Title', lang)}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">{t('fullNameLabel', lang)} *</label>
                    <input value={fullName} onChange={e => setFullName(e.target.value)}
                      className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3.5 text-white focus:border-orange-500/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-300" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">{t('emailLabel', lang)} *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3.5 text-white focus:border-orange-500/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-300" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">{t('phoneLabel', lang)}</label>
                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3.5 text-white focus:border-orange-500/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-300" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2 font-medium">{t('instagramLabel', lang)}</label>
                    <input value={instagram} onChange={e => setInstagram(e.target.value)} placeholder="@username"
                      className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder:text-gray-600 focus:border-orange-500/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-300" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2 font-medium">{t('spotifyLabel', lang)}</label>
                  <input value={spotify} onChange={e => setSpotify(e.target.value)} placeholder="https://open.spotify.com/artist/..."
                    className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder:text-gray-600 focus:border-orange-500/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all duration-300" />
                </div>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)}
                    className="mt-1 w-5 h-5 accent-orange-500 rounded" />
                  <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">{t('termsLabel', lang)}</span>
                </label>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

        {/* Navigation */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
        <div className="flex items-center justify-between p-5 sm:p-7">
          <div>
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="text-gray-400 hover:text-white rounded-xl">
                <ArrowLeft className="w-4 h-4 mr-1" /> {t('prev', lang)}
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            {step < TOTAL_STEPS - 1 ? (
              <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-40 rounded-xl shadow-lg shadow-orange-500/20 font-semibold px-6">
                {t('next', lang)} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5 text-sm backdrop-blur-sm">
                  <Gift className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  <span className="text-orange-300 font-medium">{t('freeLandingBanner', lang)}</span>
                </div>
                <Button onClick={() => handleSubmit()} disabled={!canNext() || submitting}
                  className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:opacity-40 text-base px-10 py-4 rounded-xl shadow-lg shadow-orange-500/30 font-bold">
                  {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2" />}
                  {submitting ? (t('submitting', lang)) : t('submitAndGetPage', lang)}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
