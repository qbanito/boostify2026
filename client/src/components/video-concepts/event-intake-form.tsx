import React, { useCallback, useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, Crown, Building2, Film, Sparkles, Calendar, MapPin, Users,
  Music2, Mail, Phone, User as UserIcon, ArrowRight, ArrowLeft,
  CheckCircle2, Loader2, Send, Palette, DollarSign, Star, FileText, ShieldCheck,
} from 'lucide-react';
import { t, type Lang } from '../../lib/video-concepts-i18n';

const TOTAL_STEPS = 6;
const stepIcons = [Heart, Palette, Calendar, DollarSign, UserIcon, FileText];
const CONTRACT_VERSION = 'v1.0-2026-04';
const IMG = (slug: string) => `/video-concepts/${slug}.jpg`;

type EventType = 'wedding' | 'quinceanera' | 'corporate' | 'legacy' | 'other';
type BudgetRange = '5999_9999' | '10000_15000' | '15000_25000' | '25000_plus';
type EmotionKey = 'emoJoy' | 'emoLove' | 'emoEpic' | 'emoNostalgia' | 'emoElegance' | 'emoIntimate' | 'emoCelebration' | 'emoFamily';

const EVENT_TYPES: Array<{
  key: EventType;
  icon: React.ReactNode;
  titleKey: 'evWedding' | 'evQuince' | 'evCorporate' | 'evLegacy' | 'evOther';
  descKey: 'evWeddingDesc' | 'evQuinceDesc' | 'evCorporateDesc' | 'evLegacyDesc' | 'evOtherDesc';
  gradient: string;
  image: string;
}> = [
  { key: 'wedding', icon: <Heart className="w-7 h-7" />, titleKey: 'evWedding', descKey: 'evWeddingDesc', gradient: 'from-rose-500 to-pink-500', image: IMG('cat-wedding') },
  { key: 'quinceanera', icon: <Crown className="w-7 h-7" />, titleKey: 'evQuince', descKey: 'evQuinceDesc', gradient: 'from-amber-500 to-orange-500', image: IMG('cat-quinceanera') },
  { key: 'corporate', icon: <Building2 className="w-7 h-7" />, titleKey: 'evCorporate', descKey: 'evCorporateDesc', gradient: 'from-sky-500 to-blue-500', image: IMG('cat-corporate') },
  { key: 'legacy', icon: <Film className="w-7 h-7" />, titleKey: 'evLegacy', descKey: 'evLegacyDesc', gradient: 'from-violet-500 to-purple-500', image: IMG('cat-legacy') },
  { key: 'other', icon: <Sparkles className="w-7 h-7" />, titleKey: 'evOther', descKey: 'evOtherDesc', gradient: 'from-emerald-500 to-teal-500', image: IMG('hero') },
];

/**
 * Visual style presets — one card per *aesthetic*, intentionally decoupled
 * from event/client type. The event type is already chosen in Step 0; here
 * the user picks the *visual soul* of the film (look + sound + emotions).
 *
 * Each preset renders as a typographic "swatch" card whose palette and
 * type treatment communicate the style itself, so no bespoke photo is
 * required (and the cards never confuse the user with a wedding/quince
 * photo when they're really choosing a *mood*).
 */
const PRESETS: Array<{
  id: string;
  title: { es: string; en: string };
  desc: { es: string; en: string };
  /** Tailwind classes for the card background gradient. */
  bg: string;
  /** Tailwind classes for the giant typographic mark. */
  markClass: string;
  /** Single character / glyph drawn huge as the style mark. */
  mark: string;
  /** CSS font-family used for the mark + title (creates the style feel). */
  fontFamily: string;
  /** Two accent dots that hint the palette. */
  accent: [string, string];
  visualStyle: { es: string; en: string };
  music: { es: string; en: string };
  emotions: EmotionKey[];
}> = [
  {
    id: 'editorial',
    title: { es: 'Editorial', en: 'Editorial' },
    desc: {
      es: 'Cover de revista. Composición limpia, tipografía fuerte, miradas premeditadas.',
      en: 'Magazine cover. Clean composition, strong typography, deliberate gazes.',
    },
    bg: 'bg-gradient-to-br from-neutral-200 via-neutral-400 to-neutral-900',
    markClass: 'text-black/80',
    mark: 'E',
    fontFamily: '"Playfair Display", "Didot", "Bodoni Moda", serif',
    accent: ['bg-black', 'bg-white'],
    visualStyle: {
      es: 'Editorial de revista con composiciones limpias, contrastes marcados y tipografía cinematográfica',
      en: 'Magazine editorial with clean composition, strong contrast and cinematic typography',
    },
    music: {
      es: 'Score moderno con piano y cuerdas minimalistas, cortes secos al ritmo',
      en: 'Modern score with minimalist piano and strings, sharp rhythmic cuts',
    },
    emotions: ['emoElegance', 'emoEpic', 'emoIntimate'],
  },
  {
    id: 'romantic',
    title: { es: 'Romántico', en: 'Romantic' },
    desc: {
      es: 'Hora dorada, miradas suaves, manos que se buscan. Calidez sin forzar.',
      en: 'Golden hour, soft glances, hands finding each other. Warmth without forcing it.',
    },
    bg: 'bg-gradient-to-br from-rose-200 via-orange-200 to-amber-300',
    markClass: 'text-rose-900/70',
    mark: 'R',
    fontFamily: '"Cormorant Garamond", "Playfair Display", serif',
    accent: ['bg-rose-400', 'bg-amber-300'],
    visualStyle: {
      es: 'Hora dorada con luz suave, tonos rosa-durazno y enfoque íntimo',
      en: 'Golden-hour soft light, rose-peach palette and intimate focus',
    },
    music: {
      es: 'Tema emocional con guitarra acústica, piano y voces cálidas',
      en: 'Emotional theme with acoustic guitar, piano and warm vocals',
    },
    emotions: ['emoLove', 'emoIntimate', 'emoJoy'],
  },
  {
    id: 'cinematic',
    title: { es: 'Cinemático', en: 'Cinematic' },
    desc: {
      es: 'Anamórfico teal & orange. Lentes largas, slow motion, escala de película.',
      en: 'Anamorphic teal & orange. Long lenses, slow motion, feature-film scale.',
    },
    bg: 'bg-gradient-to-br from-cyan-900 via-slate-900 to-orange-700',
    markClass: 'text-orange-200/85',
    mark: 'C',
    fontFamily: '"Bebas Neue", "Oswald", "Impact", sans-serif',
    accent: ['bg-cyan-400', 'bg-orange-500'],
    visualStyle: {
      es: 'Cinematográfico anamórfico, paleta teal & orange, lentes largas y cámara lenta dramática',
      en: 'Anamorphic cinematic with teal & orange palette, long lenses and dramatic slow motion',
    },
    music: {
      es: 'Score orquestal épico con percusión y crescendos al estilo Hans Zimmer',
      en: 'Epic orchestral score with percussion and Hans Zimmer-style crescendos',
    },
    emotions: ['emoEpic', 'emoElegance', 'emoNostalgia'],
  },
  {
    id: 'vintage_film',
    title: { es: 'Vintage / Film', en: 'Vintage / Film' },
    desc: {
      es: 'Grano 16 mm, halaciones, calor analógico. Recuerdos hechos para guardarse.',
      en: '16 mm grain, halation, analog warmth. Memories built to be kept.',
    },
    bg: 'bg-gradient-to-br from-amber-100 via-yellow-700 to-stone-800',
    markClass: 'text-stone-900/75',
    mark: 'V',
    fontFamily: '"Special Elite", "Courier Prime", "Courier New", monospace',
    accent: ['bg-yellow-600', 'bg-stone-700'],
    visualStyle: {
      es: 'Estética 16mm con grano, halaciones y temperatura cálida nostálgica',
      en: 'Grainy 16mm aesthetic with halation and warm nostalgic temperature',
    },
    music: {
      es: 'Vinilo, piano antiguo y cuerdas con textura de cinta vintage',
      en: 'Vinyl warmth, old piano and strings with vintage tape texture',
    },
    emotions: ['emoNostalgia', 'emoFamily', 'emoIntimate'],
  },
  {
    id: 'minimal_luxury',
    title: { es: 'Lujo minimalista', en: 'Minimal luxury' },
    desc: {
      es: 'Champaña, mármol, espacio negativo. Menos cosas, todas perfectas.',
      en: 'Champagne, marble, negative space. Fewer things, all perfect.',
    },
    bg: 'bg-gradient-to-br from-stone-100 via-amber-50 to-yellow-100',
    markClass: 'text-stone-700/70',
    mark: 'M',
    fontFamily: '"Inter", "Helvetica Neue", "Helvetica", sans-serif',
    accent: ['bg-stone-300', 'bg-amber-200'],
    visualStyle: {
      es: 'Minimalismo de lujo con paleta champaña, mármol y mucho espacio negativo',
      en: 'Minimal luxury with champagne palette, marble tones and generous negative space',
    },
    music: {
      es: 'Piano contenido, cuerdas etéreas y silencios cuidados',
      en: 'Restrained piano, ethereal strings and considered silences',
    },
    emotions: ['emoElegance', 'emoIntimate', 'emoEpic'],
  },
  {
    id: 'vibrant',
    title: { es: 'Vibrante', en: 'Vibrant' },
    desc: {
      es: 'Color saturado, ritmo rápido, energía de fiesta. Para gente que se mueve.',
      en: 'Saturated color, fast cuts, party energy. For people who move.',
    },
    bg: 'bg-gradient-to-br from-fuchsia-500 via-orange-400 to-yellow-300',
    markClass: 'text-white drop-shadow',
    mark: '★',
    fontFamily: '"Space Grotesk", "Poppins", "Inter", sans-serif',
    accent: ['bg-fuchsia-500', 'bg-cyan-300'],
    visualStyle: {
      es: 'Saturación alta, cortes rápidos al beat, energía pop con neones',
      en: 'High saturation, beat-driven fast cuts and neon-pop energy',
    },
    music: {
      es: 'Pop / electrónica con drop fuerte y voces sampleadas de invitados',
      en: 'Pop / electronic with a strong drop and sampled guest vocals',
    },
    emotions: ['emoJoy', 'emoCelebration', 'emoEpic'],
  },
  {
    id: 'modern',
    title: { es: 'Moderno', en: 'Modern' },
    desc: {
      es: 'Líneas duras, blanco puro, motion gráfico. Diseñado, no filmado.',
      en: 'Hard lines, pure white, motion graphics. Designed, not just filmed.',
    },
    bg: 'bg-gradient-to-br from-white via-neutral-200 to-black',
    markClass: 'text-black',
    mark: '/',
    fontFamily: '"Space Grotesk", "Inter", "Helvetica Neue", sans-serif',
    accent: ['bg-black', 'bg-lime-400'],
    visualStyle: {
      es: 'Diseño moderno con tipografía geométrica, motion graphics y composiciones blanco-negro',
      en: 'Modern design with geometric type, motion graphics and stark black-white compositions',
    },
    music: {
      es: 'Electrónica minimal, sintetizadores limpios y percusión programada',
      en: 'Minimal electronic, clean synths and programmed percussion',
    },
    emotions: ['emoEpic', 'emoElegance', 'emoCelebration'],
  },
];

const EMOTIONS: EmotionKey[] = [
  'emoJoy', 'emoLove', 'emoEpic', 'emoNostalgia', 'emoElegance', 'emoIntimate', 'emoCelebration', 'emoFamily',
];

const BUDGETS: Array<{
  key: BudgetRange;
  label: 'bud1' | 'bud2' | 'bud3' | 'bud4';
  desc: 'bud1Desc' | 'bud2Desc' | 'bud3Desc' | 'bud4Desc';
  featured?: boolean;
}> = [
  { key: '5999_9999', label: 'bud1', desc: 'bud1Desc' },
  { key: '10000_15000', label: 'bud2', desc: 'bud2Desc', featured: true },
  { key: '15000_25000', label: 'bud3', desc: 'bud3Desc' },
  { key: '25000_plus', label: 'bud4', desc: 'bud4Desc' },
];

interface Props {
  lang: Lang;
}

export function EventIntakeForm({ lang }: Props) {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // form state
  const [eventType, setEventType] = useState<EventType | ''>('');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [visualStyle, setVisualStyle] = useState<string>('');
  const [musicDirection, setMusicDirection] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [guests, setGuests] = useState('');
  const [emotions, setEmotions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [budgetRange, setBudgetRange] = useState<BudgetRange | ''>('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  // Step 5 — service contract
  const [contractAccepted, setContractAccepted] = useState(false);
  const [contractSignature, setContractSignature] = useState('');

  // submission result
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const toggleEmotion = (e: string) =>
    setEmotions((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const applyPreset = (preset: typeof PRESETS[number]) => {
    setSelectedPreset(preset.id);
    setVisualStyle(preset.visualStyle[lang]);
    setMusicDirection(preset.music[lang]);
    setEmotions(preset.emotions);
  };

  const canNext = useCallback(() => {
    if (step === 0) return !!eventType;
    if (step === 1) return !!visualStyle;
    if (step === 2) return true;
    if (step === 3) return !!budgetRange;
    if (step === 4) return clientName.trim().length > 0 && /.+@.+\..+/.test(clientEmail) && acceptTerms;
    if (step === 5) return contractAccepted && contractSignature.trim().length >= 2;
    return true;
  }, [step, eventType, visualStyle, budgetRange, clientName, clientEmail, acceptTerms, contractAccepted, contractSignature]);

  async function handleSubmit() {
    if (submitting || !canNext()) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/video-concepts/intake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName,
          clientEmail,
          clientPhone: clientPhone || undefined,
          eventType: eventType || 'other',
          eventDate: eventDate || undefined,
          eventLocation: eventLocation || undefined,
          budgetRange: budgetRange || '5999_9999',
          selectedPreset: selectedPreset || undefined,
          visualStyle: visualStyle || undefined,
          musicDirection: musicDirection || undefined,
          emotionalKeywords: emotions.map((e) => t(e as any, lang)),
          notes: [
            guests ? `Guests: ${guests}` : '',
            instagram ? `Instagram: ${instagram}` : '',
            notes,
          ].filter(Boolean).join('\n'),
          // Service contract — server stamps timestamp + IP/UA for audit.
          contractAccepted,
          contractSignature: contractSignature.trim(),
          contractVersion: CONTRACT_VERSION,
          lang,
        }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = await res.json();
      const project = data?.project ?? data;
      if (project?.id && project?.galleryToken) {
        setResultUrl(`/video-concepts/project/${project.id}?token=${project.galleryToken}`);
      }
      setDone(true);
    } catch (e: any) {
      setErrorMsg(e?.message || 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-black p-10 md:p-14 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 }}
          className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30"
        >
          <CheckCircle2 className="w-10 h-10 text-black" />
        </motion.div>
        <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">{t('formSuccess', lang)}</h3>
        <p className="text-white/65 mb-8 max-w-md mx-auto leading-relaxed">{t('formSuccessSub', lang)}</p>
        {resultUrl && (
          <Link
            href={resultUrl}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold tracking-wide hover:scale-[1.03] transition-transform"
          >
            {t('openProject', lang)} <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </motion.div>
    );
  }

  const inputCls =
    'w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder:text-white/30 focus:border-amber-500/60 focus:bg-black/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all duration-300';

  return (
    <div className="relative rounded-3xl overflow-hidden">
      {/* Glassmorphism background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-white/[0.02] backdrop-blur-xl" />
      <div className="absolute inset-0 border border-white/[0.08] rounded-3xl pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <div className="relative">
        {/* Step progress */}
        <div className="px-4 sm:px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-3">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
              const Icon = stepIcons[i];
              const active = i === step;
              const doneStep = i < step;
              return (
                <React.Fragment key={i}>
                  <button
                    onClick={() => i < step && setStep(i)}
                    className={`relative flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-300
                      ${active ? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30 scale-110' : doneStep ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-white/[0.04] border border-white/[0.08]'}`}
                  >
                    {doneStep ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Icon className={`w-5 h-5 ${active ? 'text-black' : 'text-white/40'}`} />
                    )}
                    {active && <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                  </button>
                  {i < TOTAL_STEPS - 1 && (
                    <div className={`flex-1 h-[2px] mx-1.5 rounded-full transition-colors duration-500 ${i < step ? 'bg-emerald-500/40' : 'bg-white/[0.06]'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[10px] text-white/40 px-1">
            {(['stepEventLabel', 'stepStyleLabel', 'stepDetailsLabel', 'stepBudgetLabel', 'stepContactLabel', 'stepContractLabel'] as const).map((k, i) => (
              <span key={k} className={`text-center w-11 ${i === step ? 'text-amber-400 font-medium' : i < step ? 'text-emerald-500/70' : ''}`}>
                {t(k, lang)}
              </span>
            ))}
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        {/* Step content */}
        <div className="p-5 sm:p-7 md:p-9 min-h-[360px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 30, filter: 'blur(4px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -30, filter: 'blur(4px)' }}
              transition={{ duration: 0.3 }}
            >
              {/* ─── Step 0 — Event type ─────────────────────── */}
              {step === 0 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">{t('s1Title', lang)}</h3>
                    <p className="text-sm text-white/50 mt-2">{t('s1Sub', lang)}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {EVENT_TYPES.map((et) => {
                      const active = eventType === et.key;
                      return (
                        <button
                          key={et.key}
                          onClick={() => setEventType(et.key)}
                          className={`group relative overflow-hidden text-left rounded-2xl border transition-all duration-300 ${
                            active
                              ? 'border-amber-500/60 bg-gradient-to-br from-amber-500/10 to-orange-500/5 shadow-lg shadow-amber-500/10 scale-[1.02]'
                              : 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="relative h-28 overflow-hidden">
                            <img src={et.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-110 transition-all duration-700" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
                            <div className={`absolute bottom-3 left-3 w-11 h-11 rounded-xl bg-gradient-to-br ${et.gradient} flex items-center justify-center text-white ${active ? 'shadow-lg' : ''} group-hover:scale-110 transition-transform`}>
                              {et.icon}
                            </div>
                          </div>
                          <div className="p-4">
                            <h4 className={`font-semibold text-base ${active ? 'text-amber-300' : 'text-white'}`}>{t(et.titleKey, lang)}</h4>
                            <p className="text-xs text-white/50 mt-1 leading-relaxed">{t(et.descKey, lang)}</p>
                          </div>
                          {active && (
                            <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-amber-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── Step 1 — Style + music ──────────────────── */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">{t('s2Title', lang)}</h3>
                    <p className="text-sm text-white/50 mt-2">{t('s2Sub', lang)}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-white/60 mb-3 font-medium">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      {lang === 'es' ? 'Estilo visual' : 'Visual style'}
                    </div>
                    {/*
                      Each card is a typographic *swatch* — its palette and type
                      treatment communicate the style itself, decoupled from the
                      event/client type chosen in the previous step.
                    */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {PRESETS.map((preset) => {
                        const active = selectedPreset === preset.id;
                        return (
                          <button
                            key={preset.id}
                            onClick={() => applyPreset(preset)}
                            className={`group relative overflow-hidden rounded-2xl border text-left aspect-[4/5] transition-all duration-300 ${
                              active
                                ? 'border-amber-500/70 shadow-lg shadow-amber-500/15 scale-[1.02]'
                                : 'border-white/[0.08] hover:border-white/25 hover:scale-[1.01]'
                            }`}
                          >
                            {/* Palette fallback shown until the AI-generated image loads (or if missing) */}
                            <div className={`absolute inset-0 ${preset.bg}`} />
                            {/* AI-generated style photograph (fal-ai/openai/gpt-image-2) */}
                            <img
                              src={`/video-concepts/styles/${preset.id}.jpg`}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                            />
                            {/* Bottom legibility scrim */}
                            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/55 to-transparent" />
                            {/* Palette accents */}
                            <div className="absolute top-3 left-3 flex gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${preset.accent[0]}`} />
                              <span className={`w-2 h-2 rounded-full ${preset.accent[1]}`} />
                            </div>
                            {/* Title + description */}
                            <div className="relative h-full flex flex-col justify-end p-4">
                              <h4
                                className={`text-base font-bold tracking-tight ${active ? 'text-amber-200' : 'text-white'}`}
                                style={{ fontFamily: preset.fontFamily }}
                              >
                                {preset.title[lang]}
                              </h4>
                              <p className="text-[11px] text-white/65 leading-snug mt-1 line-clamp-3">
                                {preset.desc[lang]}
                              </p>
                            </div>
                            {active && (
                              <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-amber-300 drop-shadow" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm text-white/60 mb-2 font-medium">
                      <Music2 className="w-4 h-4 text-amber-400" /> {t('musicLabel', lang)}
                    </label>
                    <input
                      value={musicDirection}
                      onChange={(e) => setMusicDirection(e.target.value)}
                      placeholder={t('musicPh', lang)}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {/* ─── Step 2 — Event details ──────────────────── */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">{t('s3Title', lang)}</h3>
                    <p className="text-sm text-white/50 mt-2">{t('s3Sub', lang)}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm text-white/60 mb-2 font-medium">
                        <Calendar className="w-4 h-4 text-amber-400" /> {t('eventDateLabel', lang)}
                      </label>
                      <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm text-white/60 mb-2 font-medium">
                        <Users className="w-4 h-4 text-amber-400" /> {t('guestsLabel', lang)}
                      </label>
                      <input type="number" min={0} value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="120" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm text-white/60 mb-2 font-medium">
                      <MapPin className="w-4 h-4 text-amber-400" /> {t('eventLocationLabel', lang)}
                    </label>
                    <input value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder={t('eventLocationPh', lang)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2 font-medium">{t('emotionsLabel', lang)}</label>
                    <div className="flex flex-wrap gap-2">
                      {EMOTIONS.map((e) => {
                        const active = emotions.includes(e);
                        return (
                          <button
                            key={e}
                            onClick={() => toggleEmotion(e)}
                            className={`px-3.5 py-2 rounded-full text-xs font-medium border transition-all duration-300 ${
                              active
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                : 'border-white/[0.08] text-white/60 hover:bg-white/[0.04]'
                            }`}
                          >
                            {t(e, lang)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2 font-medium">{t('notesLabel', lang)}</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t('notesPh', lang)}
                      rows={3}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                </div>
              )}

              {/* ─── Step 3 — Budget ─────────────────────────── */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">{t('s4Title', lang)}</h3>
                    <p className="text-sm text-white/50 mt-2">{t('s4Sub', lang)}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {BUDGETS.map((b) => {
                      const active = budgetRange === b.key;
                      return (
                        <button
                          key={b.key}
                          onClick={() => setBudgetRange(b.key)}
                          className={`relative text-left p-5 rounded-2xl border transition-all duration-300 ${
                            active
                              ? 'border-amber-500/60 bg-gradient-to-br from-amber-500/15 to-orange-500/5 shadow-lg shadow-amber-500/10 scale-[1.02]'
                              : 'border-white/[0.08] hover:bg-white/[0.03] hover:border-white/20'
                          }`}
                        >
                          {b.featured && (
                            <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase tracking-wider">
                              {lang === 'es' ? 'Popular' : 'Popular'}
                            </span>
                          )}
                          <p className={`text-xl font-bold ${active ? 'text-amber-300' : 'text-white'}`}>{t(b.label, lang)}</p>
                          <p className="text-sm text-white/55 mt-1">{t(b.desc, lang)}</p>
                          {active && (
                            <CheckCircle2 className="absolute bottom-3 right-3 w-5 h-5 text-amber-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── Step 4 — Contact ────────────────────────── */}
              {step === 4 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">{t('s5Title', lang)}</h3>
                    <p className="text-sm text-white/50 mt-2">{t('s5Sub', lang)}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm text-white/60 mb-2 font-medium">
                        <UserIcon className="w-4 h-4 text-amber-400" /> {t('formName', lang)} *
                      </label>
                      <input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={t('formNamePh', lang)} className={inputCls} />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm text-white/60 mb-2 font-medium">
                        <Mail className="w-4 h-4 text-amber-400" /> {t('formEmail', lang)} *
                      </label>
                      <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder={t('formEmailPh', lang)} className={inputCls} />
                    </div>
                    <div>
                      <label className="flex items-center gap-2 text-sm text-white/60 mb-2 font-medium">
                        <Phone className="w-4 h-4 text-amber-400" /> {t('formPhone', lang)}
                      </label>
                      <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder={t('formPhonePh', lang)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm text-white/60 mb-2 font-medium">{t('formInstagram', lang)}</label>
                      <input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder={t('formInstagramPh', lang)} className={inputCls} />
                    </div>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer group pt-2">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-1 w-5 h-5 accent-amber-500 rounded"
                    />
                    <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">{t('termsLabel', lang)}</span>
                  </label>
                </div>
              )}

              {/* ─── Step 5 — Service contract + electronic signature ── */}
              {step === 5 && (() => {
                const baseTotal = budgetRange === '10000_15000' ? 10000
                  : budgetRange === '15000_25000' ? 15000
                  : budgetRange === '25000_plus'  ? 25000
                  : 5999;
                const deposit = Math.round(baseTotal / 2);
                const finalAmt = baseTotal - deposit;
                const fmt = (n: number) => `$${n.toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')} USD`;
                const clauses: Array<{ title: any; body: any; bullets?: any[] }> = [
                  { title: 'contractPartiesTitle',        body: 'contractPartiesBody' },
                  { title: 'contractScopeTitle',          body: 'contractScopeBody' },
                  { title: 'contractFeesTitle',           body: 'contractFeesBody', bullets: ['contractFee1', 'contractFee2', 'contractFeeNote'] },
                  { title: 'contractDeliverablesTitle',   body: 'contractDeliverablesBody' },
                  { title: 'contractTimelineTitle',       body: 'contractTimelineBody' },
                  { title: 'contractRevisionsTitle',      body: 'contractRevisionsBody' },
                  { title: 'contractCancellationTitle',   body: 'contractCancellationBody' },
                  { title: 'contractIpTitle',             body: 'contractIpBody' },
                  { title: 'contractPrivacyTitle',        body: 'contractPrivacyBody' },
                  { title: 'contractForceMajeureTitle',   body: 'contractForceMajeureBody' },
                  { title: 'contractLiabilityTitle',      body: 'contractLiabilityBody' },
                  { title: 'contractConfidentialityTitle',body: 'contractConfidentialityBody' },
                  { title: 'contractCommsTitle',          body: 'contractCommsBody' },
                  { title: 'contractLawTitle',            body: 'contractLawBody' },
                  { title: 'contractSignatureTitle',      body: 'contractSignatureBody' },
                ];
                return (
                  <div className="space-y-5">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30">
                        <ShieldCheck className="w-5 h-5 text-black" />
                      </div>
                      <div>
                        <h3 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                          {t('s6Title', lang)}
                        </h3>
                        <p className="text-sm text-white/55 mt-1.5 max-w-xl">{t('s6Sub', lang)}</p>
                        <p className="text-[10px] uppercase tracking-widest text-white/35 mt-2">
                          {t('contractVersionLabel', lang)} · {CONTRACT_VERSION}
                        </p>
                      </div>
                    </div>

                    {/* Financial summary card — front and centre */}
                    <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-orange-500/[0.04] to-black p-5">
                      <p className="text-[11px] uppercase tracking-widest text-amber-300/80 font-semibold mb-3">
                        {t('contractSummaryTitle', lang)}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl bg-black/30 border border-white/[0.06] p-3">
                          <p className="text-[10px] uppercase tracking-widest text-white/40">{t('contractSummaryTotal', lang)}</p>
                          <p className="text-xl font-bold text-white mt-1">{fmt(baseTotal)}+</p>
                        </div>
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3">
                          <p className="text-[10px] uppercase tracking-widest text-amber-300/80">{t('contractSummaryDeposit', lang)}</p>
                          <p className="text-xl font-bold text-amber-200 mt-1">{fmt(deposit)}</p>
                        </div>
                        <div className="rounded-xl bg-black/30 border border-white/[0.06] p-3">
                          <p className="text-[10px] uppercase tracking-widest text-white/40">{t('contractSummaryFinal', lang)}</p>
                          <p className="text-xl font-bold text-white mt-1">{fmt(finalAmt)}</p>
                        </div>
                      </div>
                      <p className="text-[11px] text-white/45 mt-3 leading-relaxed">{t('contractSummaryDisclaimer', lang)}</p>
                    </div>

                    {/* Scrollable contract body */}
                    <div className="rounded-2xl border border-white/[0.08] bg-black/40">
                      <div className="px-5 pt-5 pb-3 border-b border-white/[0.06]">
                        <p className="text-[11px] uppercase tracking-widest text-white/40 font-semibold">
                          {t('contractHeader', lang)}
                        </p>
                      </div>
                      <div className="max-h-80 overflow-y-auto px-5 py-4 space-y-4 text-sm text-white/70 leading-relaxed">
                        {clauses.map((c) => (
                          <div key={c.title}>
                            <h4 className="text-white font-semibold mb-1">{t(c.title as any, lang)}</h4>
                            <p>{t(c.body as any, lang)}</p>
                            {c.bullets && (
                              <ul className="mt-2 space-y-1.5 list-disc list-outside ml-5 text-white/65">
                                {c.bullets.map((b) => (
                                  <li key={b}>{t(b as any, lang)}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Signature */}
                    <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-5 space-y-4">
                      <div>
                        <label className="flex items-center gap-2 text-sm text-white/70 mb-2 font-medium">
                          <FileText className="w-4 h-4 text-amber-400" />
                          {t('contractSignatureLabel', lang)} *
                        </label>
                        <input
                          value={contractSignature}
                          onChange={(e) => setContractSignature(e.target.value)}
                          placeholder={t('contractSignaturePh', lang)}
                          className={`${inputCls} font-serif italic text-lg tracking-wide`}
                          autoComplete="off"
                        />
                        {contractSignature.trim().length >= 2 && (
                          <p className="text-[11px] text-emerald-400/80 mt-2">
                            ✓ {new Date().toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')}
                          </p>
                        )}
                      </div>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={contractAccepted}
                          onChange={(e) => setContractAccepted(e.target.checked)}
                          className="mt-1 w-5 h-5 accent-amber-500 rounded"
                        />
                        <span className="text-sm text-white/70 group-hover:text-white transition-colors">
                          {t('contractAcceptLabel', lang)}
                        </span>
                      </label>
                      <p className="text-[11px] text-white/40 leading-relaxed">{t('contractDownloadHint', lang)}</p>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

        {/* Navigation */}
        <div className="flex items-center justify-between p-5 sm:p-7">
          <div>
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-white/60 hover:text-white rounded-xl transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> {t('prev', lang)}
              </button>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {errorMsg && <span className="text-rose-400 text-xs">{t('formError', lang)}</span>}
            {step < TOTAL_STEPS - 1 ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded-xl shadow-lg shadow-amber-500/20 font-semibold transition-all"
              >
                {t('next', lang)} <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canNext() || submitting}
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-black rounded-xl shadow-lg shadow-amber-500/30 font-bold text-base transition-all"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {submitting ? t('formSending', lang) : t('formSubmit', lang)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
