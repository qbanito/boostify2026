import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, CreditCard, Download,
  Film, Image as ImageIcon, Loader2, Lock, Music2, ShieldCheck,
  Sparkles, Smartphone, Ticket, Wand2,
} from 'lucide-react';
import { apiRequest } from '../lib/queryClient';
import {
  resolveLandingPreset,
  type EventTypeKey,
  type StylePresetKey,
} from '../config/event-landing-presets';
import { LANDING_MODULES } from '../components/video-concepts/landing-modules';
import StoryboardWorkflow, {
  type Storyboard,
  type StoryboardBrief,
  type Asset as SbAsset,
} from '../components/video-concepts/StoryboardWorkflow';

type Lang = 'es' | 'en';

type Project = {
  id: number;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  eventType: 'quinceanera' | 'wedding' | 'corporate' | 'legacy' | 'other';
  eventDate?: string | null;
  eventLocation?: string | null;
  budgetRange?: string | null;
  selectedPreset?: string | null;
  visualStyle?: string | null;
  musicDirection?: string | null;
  emotionalKeywords?: string[];
  notes?: string | null;
  masterJson?: MasterJson | null;
  paymentStatus: 'pending' | 'deposit_paid' | 'paid_in_full' | 'refunded';
  contractAccepted?: boolean;
  contractVersion?: string | null;
  contractSignature?: string | null;
  contractSignedAt?: string | null;
  contractTotalAmount?: number | null;
  contractDepositAmount?: number | null;
  finalPaidAt?: string | null;
  status: string;
  createdAt: string;
  storyboardJson?: Storyboard | null;
  storyboardStatus?: 'none' | 'generating' | 'ready' | 'error' | null;
  clientBriefDetails?: StoryboardBrief | null;
};

type MasterJson = {
  creativeConcept?: {
    title?: string;
    logline?: string;
    visualStyle?: string;
    musicDirection?: string;
    whyItFeelsDifferent?: string[];
  };
  storyScript?: {
    chapters?: Array<{ act: number; title: string; purpose: string; keyShots: string[] }>;
    guestParticipation?: { approach?: string; capturePrompts?: string[] };
  };
  originalMusicSession?: { concept?: string; deliverables?: string[] };
  interactiveApp?: { modules?: string[] };
  referenceImages?: Array<{ title: string; url: string; role: string }>;
  deliverables?: string[];
  nextSteps?: string[];
  [key: string]: unknown;
};

const copy = {
  back: { es: 'Volver a Video Concepts', en: 'Back to Video Concepts' },
  loading: { es: 'Cargando proyecto...', en: 'Loading project...' },
  notFound: { es: 'No pudimos abrir este proyecto', en: 'We could not open this project' },
  notFoundSub: { es: 'Revisa que el enlace privado tenga el token correcto.', en: 'Check that your private link includes the correct token.' },
  privateProject: { es: 'Proyecto privado', en: 'Private project' },
  heroTitle: { es: 'Tu demo cinematográfico está listo para desbloquearse', en: 'Your cinematic demo is ready to unlock' },
  heroPaid: { es: 'Demo desbloqueado', en: 'Demo unlocked' },
  heroSub: {
    es: 'Paga el depósito seguro para recibir el guion, blueprint creativo, referencias visuales y el demo privado de producción.',
    en: 'Pay the secure deposit to receive the script, creative blueprint, visual references and private production demo.',
  },
  heroPaidSub: {
    es: 'Tu pago fue confirmado. Este es el blueprint inicial del proyecto, listo para revisión creativa.',
    en: 'Your payment is confirmed. This is the initial project blueprint, ready for creative review.',
  },
  depositTitle: { es: 'Depósito para recibir el demo', en: 'Deposit to receive the demo' },
  depositSub: { es: 'Procesado por Stripe. Se descuenta del total final del proyecto.', en: 'Processed by Stripe. Credited toward your final project total.' },
  pay: { es: 'Pagar depósito seguro', en: 'Pay secure deposit' },
  paying: { es: 'Abriendo Stripe...', en: 'Opening Stripe...' },
  confirmed: { es: 'Pago confirmado', en: 'Payment confirmed' },
  confirming: { es: 'Confirmando pago con Stripe...', en: 'Confirming payment with Stripe...' },
  cancelled: { es: 'Pago cancelado. Puedes intentarlo de nuevo cuando estés listo.', en: 'Payment cancelled. You can try again when ready.' },
  finalCancelled: { es: 'Pago final cancelado. Puedes reintentarlo cuando quieras.', en: 'Final payment cancelled. You can retry whenever you want.' },
  milestonesTitle: { es: 'Calendario de pagos', en: 'Payment milestones' },
  totalLabel: { es: 'Inversión total', en: 'Total investment' },
  depositLabel: { es: 'Depósito (50 %) — al firmar', en: 'Deposit (50 %) — at signing' },
  finalLabel: { es: 'Saldo (50 %) — día del rodaje', en: 'Balance (50 %) — filming day' },
  paid: { es: 'Pagado', en: 'Paid' },
  pending: { es: 'Pendiente', en: 'Pending' },
  payFinalBtn: { es: 'Pagar saldo final (50 %)', en: 'Pay final balance (50 %)' },
  payFinalSub: { es: 'Procesa el saldo el día del rodaje, antes de comenzar a grabar.', en: 'Process the balance on filming day, before any recording begins.' },
  contractStatusTitle: { es: 'Contrato firmado', en: 'Signed contract' },
  contractSignedBy: { es: 'Firmado por', en: 'Signed by' },
  contractSignedOn: { es: 'el', en: 'on' },
  contractV: { es: 'Versión', en: 'Version' },
  lockedTitle: { es: 'Guion y JSON bloqueados', en: 'Script and JSON locked' },
  lockedSub: { es: 'El blueprint se genera únicamente después de confirmar el depósito.', en: 'The blueprint is generated only after the deposit is confirmed.' },
  afterPay: { es: 'Sistema after-pay', en: 'After-pay system' },
  scriptTitle: { es: 'Guion cinematográfico', en: 'Cinematic script' },
  jsonTitle: { es: 'JSON estructurado del proyecto', en: 'Structured project JSON' },
  refsTitle: { es: 'Imágenes de referencia', en: 'Reference images' },
  appTitle: { es: 'App interactiva del evento', en: 'Interactive event app' },
  musicTitle: { es: 'Sesión musical especial', en: 'Special music session' },
  download: { es: 'Descargar JSON', en: 'Download JSON' },
  generate: { es: 'Generando blueprint...', en: 'Generating blueprint...' },
  stripeNote: { es: 'Stripe Checkout habilita tarjeta, Apple Pay y Google Pay cuando están disponibles.', en: 'Stripe Checkout enables card, Apple Pay and Google Pay when available.' },
  projectDetails: { es: 'Detalles del proyecto', en: 'Project details' },
  nextSteps: { es: 'Próximos pasos', en: 'Next steps' },
} satisfies Record<string, { es: string; en: string }>;

const eventImages: Record<Project['eventType'], string> = {
  quinceanera: '/video-concepts/cat-quinceanera.jpg',
  wedding: '/video-concepts/cat-wedding.jpg',
  corporate: '/video-concepts/cat-corporate.jpg',
  legacy: '/video-concepts/cat-legacy.jpg',
  other: '/video-concepts/hero.jpg',
};

const eventLabels: Record<Project['eventType'], { es: string; en: string }> = {
  quinceanera: { es: 'Quinceañera', en: 'Quinceañera' },
  wedding: { es: 'Boda', en: 'Wedding' },
  corporate: { es: 'Corporativo', en: 'Corporate' },
  legacy: { es: 'Legacy / Memorias', en: 'Legacy / Memories' },
  other: { es: 'Evento privado', en: 'Private event' },
};

function totalAmount(range?: string | null) {
  if (range === '10000_15000') return 10000;
  if (range === '15000_25000') return 15000;
  if (range === '25000_plus') return 25000;
  return 5999;
}

function depositAmount(range?: string | null) {
  return Math.round(totalAmount(range) / 2);
}

function finalAmount(range?: string | null) {
  return totalAmount(range) - depositAmount(range);
}

function currency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function getLang(): Lang {
  try {
    const saved = window.localStorage.getItem('video_concepts_lang');
    if (saved === 'es' || saved === 'en') return saved;
  } catch {}
  return 'es';
}

export default function VideoConceptsProjectPage() {
  const { id } = useParams<{ id: string }>();
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const sessionId = params.get('session_id') || '';
  const paymentState = params.get('payment');
  const [lang, setLang] = useState<Lang>(getLang);
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<SbAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const confirmRef = useRef(false);
  const generateRef = useRef(false);

  const tr = (key: keyof typeof copy) => copy[key][lang];
  const unlocked = project?.paymentStatus === 'deposit_paid' || project?.paymentStatus === 'paid_in_full';
  const fullyPaid = project?.paymentStatus === 'paid_in_full';
  const masterJson = project?.masterJson || null;
  const total = project?.contractTotalAmount ?? totalAmount(project?.budgetRange);
  const amount = project?.contractDepositAmount ?? depositAmount(project?.budgetRange);
  const finalDue = Math.max(0, total - amount);
  const finalConfirmRef = useRef(false);

  const eventImage = useMemo(() => eventImages[project?.eventType || 'other'], [project?.eventType]);
  const eventLabel = project ? eventLabels[project.eventType][lang] : '';

  const landingPreset = useMemo(
    () =>
      resolveLandingPreset(
        project?.eventType as EventTypeKey | undefined,
        project?.selectedPreset as StylePresetKey | undefined,
      ),
    [project?.eventType, project?.selectedPreset],
  );

  useEffect(() => {
    try { window.localStorage.setItem('video_concepts_lang', lang); } catch {}
  }, [lang]);

  const loadProject = async () => {
    if (!id || !token) return;
    const res = await apiRequest(`/api/video-concepts/${id}?token=${encodeURIComponent(token)}`, 'GET');
    setProject(res.project);
    if (Array.isArray(res.assets)) setAssets(res.assets);
  };

  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!id || !token) {
        setError(tr('notFoundSub'));
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        if (sessionId && paymentState === 'success' && !confirmRef.current) {
          confirmRef.current = true;
          setConfirming(true);
          await apiRequest(`/api/video-concepts/${id}/confirm-payment`, 'POST', {
            sessionId,
            galleryToken: token,
          });
        }
        if (sessionId && paymentState === 'final_success' && !finalConfirmRef.current) {
          finalConfirmRef.current = true;
          setConfirming(true);
          await apiRequest(`/api/video-concepts/${id}/confirm-final`, 'POST', {
            sessionId,
            galleryToken: token,
          });
        }
        if (!cancelled) await loadProject();
      } catch (e: any) {
        if (!cancelled) setError(e?.message || tr('notFound'));
      } finally {
        if (!cancelled) {
          setConfirming(false);
          setLoading(false);
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, [id, token, sessionId, paymentState]);

  useEffect(() => {
    if (!project || !unlocked || masterJson || generateRef.current) return;
    generateRef.current = true;
    setGenerating(true);
    apiRequest(`/api/video-concepts/${project.id}/generate-demo`, 'POST', { galleryToken: token })
      .then((res) => setProject((prev) => prev ? { ...prev, masterJson: res.masterJson } : prev))
      .catch((e) => setError(e?.message || 'Could not generate demo'))
      .finally(() => setGenerating(false));
  }, [project, unlocked, masterJson, token]);

  const startCheckout = async () => {
    if (!project || paying) return;
    setPaying(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/video-concepts/${project.id}/checkout`, 'POST', {
        galleryToken: token,
        lang,
      });
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      throw new Error('Stripe did not return a checkout URL');
    } catch (e: any) {
      setError(e?.message || 'Checkout failed');
    } finally {
      setPaying(false);
    }
  };

  const startFinalCheckout = async () => {
    if (!project || paying) return;
    setPaying(true);
    setError(null);
    try {
      const res = await apiRequest(`/api/video-concepts/${project.id}/final-checkout`, 'POST', {
        galleryToken: token,
        lang,
      });
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      throw new Error('Stripe did not return a checkout URL');
    } catch (e: any) {
      setError(e?.message || 'Final checkout failed');
    } finally {
      setPaying(false);
    }
  };

  const downloadJson = () => {
    if (!masterJson || !project) return;
    const blob = new Blob([JSON.stringify(masterJson, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `boostify-video-concept-${project.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-9 h-9 animate-spin text-amber-400 mx-auto mb-4" />
          <p className="text-white/60">{confirming ? tr('confirming') : tr('loading')}</p>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center rounded-3xl border border-white/10 bg-white/[0.03] p-8">
          <Lock className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">{tr('notFound')}</h1>
          <p className="text-white/60 mb-6">{error}</p>
          <Link href="/video-concepts" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-amber-500 text-black font-bold">
            <ArrowLeft className="w-4 h-4" /> {tr('back')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between gap-3 pointer-events-none">
        <Link href="/video-concepts" className="pointer-events-auto inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-black/60 backdrop-blur-md text-white/70 hover:text-white hover:border-amber-500/40 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" /> {tr('back')}
        </Link>
        <div className="pointer-events-auto flex items-center bg-black/60 backdrop-blur-md border border-white/10 rounded-full p-1">
          {(['es', 'en'] as const).map((item) => (
            <button
              key={item}
              onClick={() => setLang(item)}
              className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${lang === item ? 'bg-amber-500 text-black' : 'text-white/50 hover:text-white'}`}
            >
              {item.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <section className="relative min-h-[88svh] flex items-center pt-24 pb-16">
        <img src={eventImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/70 to-black" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black to-transparent" />

        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-[1fr_420px] gap-10 items-center w-full">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-[11px] uppercase tracking-[0.22em] text-amber-300 mb-7">
              <Sparkles className="w-3.5 h-3.5" /> {tr('privateProject')} #{project?.id}
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold leading-[1.02] tracking-tight bg-gradient-to-br from-white via-white to-amber-200 bg-clip-text text-transparent">
              {unlocked ? tr('heroPaid') : tr('heroTitle')}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/72 max-w-3xl leading-relaxed">
              {unlocked ? tr('heroPaidSub') : tr('heroSub')}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {[eventLabel, project?.eventLocation, project?.selectedPreset, project?.visualStyle].filter(Boolean).map((item) => (
                <span key={String(item)} className="px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] text-white/70 text-sm">
                  {String(item)}
                </span>
              ))}
            </div>

            {paymentState === 'cancelled' && (
              <div className="mt-6 max-w-xl rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                {tr('cancelled')}
              </div>
            )}
            {paymentState === 'final_cancelled' && (
              <div className="mt-6 max-w-xl rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-100">
                {tr('finalCancelled')}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1 }} className="rounded-3xl border border-white/10 bg-black/55 backdrop-blur-xl p-6 md:p-7 shadow-2xl shadow-black/40">
            {unlocked ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold leading-tight">{tr('confirmed')}</h2>
                    <p className="text-white/55 text-xs mt-0.5">{generating ? tr('generate') : tr('heroPaidSub')}</p>
                  </div>
                </div>

                {/* Payment milestones breakdown */}
                <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-3">
                    {tr('milestonesTitle')}
                  </p>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/55">{tr('totalLabel')}</span>
                      <span className="font-semibold text-white">{currency(total)}+</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-white/65">{tr('depositLabel')}</span>
                      </div>
                      <span className="font-semibold text-emerald-300">{currency(amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {fullyPaid ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <CreditCard className="w-4 h-4 text-amber-300" />}
                        <span className="text-white/65">{tr('finalLabel')}</span>
                      </div>
                      <span className={`font-semibold ${fullyPaid ? 'text-emerald-300' : 'text-amber-200'}`}>{currency(finalDue)}</span>
                    </div>
                  </div>
                </div>

                {/* Pay final balance CTA */}
                {!fullyPaid && finalDue > 0 && (
                  <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/[0.04] p-4 space-y-3">
                    <p className="text-xs text-white/65 leading-relaxed">{tr('payFinalSub')}</p>
                    <button
                      onClick={startFinalCheckout}
                      disabled={paying}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 transition-transform text-sm"
                    >
                      {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                      {paying ? tr('paying') : `${tr('payFinalBtn')} · ${currency(finalDue)}`}
                    </button>
                  </div>
                )}

                {/* Contract status block */}
                {project?.contractAccepted && project?.contractSignature && (
                  <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      {tr('contractStatusTitle')}
                    </p>
                    <p className="text-sm text-white/75">
                      <span className="text-white/45">{tr('contractSignedBy')}:</span>{' '}
                      <span className="font-serif italic">{project.contractSignature}</span>
                    </p>
                    {project.contractSignedAt && (
                      <p className="text-[11px] text-white/45 mt-1">
                        {tr('contractSignedOn')} {new Date(project.contractSignedAt).toLocaleString(lang === 'es' ? 'es-MX' : 'en-US')}
                        {project.contractVersion && <> · {tr('contractV')} {project.contractVersion}</>}
                      </p>
                    )}
                  </div>
                )}

                {masterJson && (
                  <button onClick={downloadJson} className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-black font-bold hover:bg-amber-100 transition-colors">
                    <Download className="w-4 h-4" /> {tr('download')}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center mb-5">
                  <CreditCard className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-bold mb-2">{tr('depositTitle')}</h2>
                <p className="text-white/60 text-sm leading-relaxed mb-6">{tr('depositSub')}</p>
                <div className="rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/5 border border-amber-500/30 p-5 mb-5">
                  <div className="text-white/50 text-xs uppercase tracking-[0.2em] mb-1">Deposit</div>
                  <div className="text-4xl font-black text-amber-200">{currency(amount)}</div>
                </div>
                <button
                  onClick={startCheckout}
                  disabled={paying}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100 transition-transform"
                >
                  {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
                  {paying ? tr('paying') : tr('pay')}
                </button>
                <p className="mt-4 text-[11px] text-white/42 leading-relaxed">{tr('stripeNote')}</p>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 pb-24 space-y-20">
        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-100 text-sm">
            {error}
          </div>
        )}

        <section className="grid lg:grid-cols-3 gap-5">
          {[
            { icon: <CreditCard />, title: 'Stripe', desc: tr('confirming') },
            { icon: <Wand2 />, title: 'Blueprint', desc: tr('lockedSub') },
            { icon: <Film />, title: 'Demo', desc: unlocked ? tr('heroPaidSub') : tr('depositSub') },
          ].map((item, i) => (
            <motion.div key={item.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06 }} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mb-4">{item.icon}</div>
              <h3 className="font-bold text-lg">{item.title}</h3>
              <p className="text-sm text-white/55 mt-2 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </section>

        <AnimatePresence mode="wait">
          {!unlocked ? (
            <motion.section key="locked" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 md:p-12 text-center">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.12),transparent_55%)]" />
              <div className="relative max-w-2xl mx-auto">
                <Lock className="w-12 h-12 text-amber-300 mx-auto mb-5" />
                <h2 className="text-3xl md:text-5xl font-bold mb-4">{tr('lockedTitle')}</h2>
                <p className="text-white/60 text-lg leading-relaxed">{tr('lockedSub')}</p>
                <div className="mt-8 grid sm:grid-cols-3 gap-3 blur-[1px] opacity-55 pointer-events-none">
                  {['Acto I', 'Acto II', 'Acto III'].map((item) => (
                    <div key={item} className="h-32 rounded-2xl border border-white/10 bg-black/40 p-4 text-left">
                      <div className="h-3 w-20 bg-white/20 rounded-full mb-4" />
                      <div className="h-2 w-full bg-white/10 rounded-full mb-2" />
                      <div className="h-2 w-2/3 bg-white/10 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.section>
          ) : masterJson ? (
            <motion.div key="unlocked" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="space-y-20">
              {project && (
                <section>
                  <StoryboardWorkflow
                    projectId={project.id}
                    galleryToken={token}
                    lang={lang}
                    brief={project.clientBriefDetails || null}
                    storyboard={project.storyboardJson || null}
                    storyboardStatus={project.storyboardStatus || null}
                    assets={assets}
                    onProjectRefresh={loadProject}
                  />
                </section>
              )}

              <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 md:p-10">
                  <div className="flex items-center gap-3 mb-6">
                    <BookOpen className="w-6 h-6 text-amber-300" />
                    <h2 className="text-3xl font-bold">{tr('scriptTitle')}</h2>
                  </div>
                  <h3 className="text-2xl font-bold text-amber-100 mb-3">{masterJson.creativeConcept?.title}</h3>
                  <p className="text-white/68 leading-relaxed mb-8">{masterJson.creativeConcept?.logline}</p>
                  <div className="space-y-4">
                    {masterJson.storyScript?.chapters?.map((chapter) => (
                      <div key={chapter.act} className="rounded-2xl border border-white/[0.08] bg-black/35 p-5">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-amber-300 mb-2">Acto {chapter.act}</div>
                        <h4 className="font-bold text-lg mb-2">{chapter.title}</h4>
                        <p className="text-sm text-white/60 leading-relaxed mb-4">{chapter.purpose}</p>
                        <div className="flex flex-wrap gap-2">
                          {chapter.keyShots.map((shot) => (
                            <span key={shot} className="text-xs px-2.5 py-1 rounded-full border border-white/10 text-white/55 bg-white/[0.03]">{shot}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-7">
                    <div className="flex items-center gap-3 mb-4"><Music2 className="w-5 h-5 text-amber-300" /><h3 className="text-xl font-bold">{tr('musicTitle')}</h3></div>
                    <p className="text-sm text-white/65 leading-relaxed">{masterJson.originalMusicSession?.concept}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {masterJson.originalMusicSession?.deliverables?.map((item) => (
                        <span key={item} className="text-xs px-2.5 py-1 rounded-full bg-black/35 border border-white/10 text-white/60">{item}</span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
                    <div className="flex items-center gap-3 mb-4"><Smartphone className="w-5 h-5 text-amber-300" /><h3 className="text-xl font-bold">{tr('appTitle')}</h3></div>
                    <div className="grid grid-cols-2 gap-2">
                      {masterJson.interactiveApp?.modules?.map((module) => (
                        <div key={module} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white/60">{module.replaceAll('_', ' ')}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-3 mb-6"><ImageIcon className="w-6 h-6 text-amber-300" /><h2 className="text-3xl font-bold">{tr('refsTitle')}</h2></div>
                <div className="grid md:grid-cols-3 gap-5">
                  {masterJson.referenceImages?.map((img) => (
                    <div key={img.url} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
                      <div className="relative h-56 overflow-hidden">
                        <img src={img.url} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="font-bold">{img.title}</h3>
                          <p className="text-xs text-white/50 mt-1">{img.role.replaceAll('_', ' ')}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Preset-driven event modules (countdown, rsvp, gallery, store, …) */}
              {project && (() => {
                const landingProject = {
                  id: project.id,
                  clientName: project.clientName,
                  eventType: project.eventType,
                  eventDate: project.eventDate,
                  eventLocation: project.eventLocation,
                  selectedPreset: project.selectedPreset,
                };
                return landingPreset.modules
                  .map((moduleId) => {
                    const Module = LANDING_MODULES[moduleId];
                    if (!Module) return null;
                    return (
                      <Module
                        key={moduleId}
                        project={landingProject}
                        lang={lang}
                      />
                    );
                  })
                  .filter(Boolean);
              })()}

              <section className="grid lg:grid-cols-2 gap-6">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-7">
                  <h2 className="text-2xl font-bold mb-5">{tr('nextSteps')}</h2>
                  <div className="space-y-3">
                    {masterJson.nextSteps?.map((step, i) => (
                      <div key={step} className="flex gap-3 text-sm text-white/65">
                        <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</span>
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/50 overflow-hidden">
                  <div className="flex items-center justify-between gap-4 p-5 border-b border-white/10">
                    <div className="flex items-center gap-3"><Ticket className="w-5 h-5 text-amber-300" /><h2 className="font-bold">{tr('jsonTitle')}</h2></div>
                    <button onClick={downloadJson} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-black text-xs font-bold"><Download className="w-3.5 h-3.5" /> JSON</button>
                  </div>
                  <pre className="max-h-[520px] overflow-auto p-5 text-[11px] leading-relaxed text-amber-50/72 whitespace-pre-wrap">
                    {JSON.stringify(masterJson, null, 2)}
                  </pre>
                </div>
              </section>
            </motion.div>
          ) : (
            <motion.section key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-amber-300 mx-auto mb-4" />
              <p className="text-white/60">{tr('generate')}</p>
            </motion.section>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}