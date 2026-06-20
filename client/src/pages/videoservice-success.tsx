import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Sparkles, Film, Send, Rocket, PartyPopper, Globe, CreditCard, Mail, ArrowRight, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { t, type Lang } from '../lib/videoservice-i18n';
import { apiRequest } from '../lib/queryClient';

const PHASES = [
  { key: 'phase1', icon: CheckCircle2 },
  { key: 'phase2', icon: Sparkles },
  { key: 'phase3', icon: Send },
  { key: 'phase4', icon: Film },
  { key: 'phase5', icon: Rocket },
] as const;

const STATUS_ORDER = ['received', 'script_creation', 'proposal_sent', 'in_production', 'delivered'];

export default function VideoServiceSuccess() {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('project_id');
  const sessionId = params.get('session_id');

  // Share language preference with the main videoservice page
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'en';
    try {
      const saved = window.localStorage.getItem('videoservice_lang');
      if (saved === 'es' || saved === 'en') return saved;
    } catch {}
    return (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('es')) ? 'es' : 'en';
  });
  useEffect(() => {
    try { window.localStorage.setItem('videoservice_lang', lang); } catch {}
  }, [lang]);

  const [project, setProject] = useState<any>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payingDeposit, setPayingDeposit] = useState(false);
  const [artistPageReady, setArtistPageReady] = useState(false);
  const [revealedAt, setRevealedAt] = useState<number | null>(null);
  const pollRef = useRef<number | null>(null);

  const isEs = lang === 'es';

  // ── Initial load + payment confirmation ──
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        if (sessionId && projectId) {
          await apiRequest('/api/videoservice/confirm-payment', 'POST', {
            sessionId,
            projectId: Number(projectId),
          });
          if (!cancelled) setConfirmed(true);
        }
        if (projectId) {
          const res = await apiRequest(`/api/videoservice/project/${projectId}`, 'GET');
          if (!cancelled && res.project) {
            setProject(res.project);
            if (res.project.artistPageUrl) {
              setArtistPageReady(true);
              setRevealedAt(Date.now());
            }
          }
        }
      } catch (e) {
        console.error('Error loading project:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();

    return () => { cancelled = true; };
  }, [sessionId, projectId]);

  // ── Poll for artist page readiness (every 4s, up to ~3min) ──
  useEffect(() => {
    if (!projectId || artistPageReady) return;

    let attempts = 0;
    const MAX_ATTEMPTS = 45; // 45 * 4s = 3 min

    const tick = async () => {
      attempts += 1;
      try {
        const res = await apiRequest(`/api/videoservice/project/${projectId}`, 'GET');
        if (res?.project) {
          setProject(res.project);
          if (res.project.artistPageUrl) {
            setArtistPageReady(true);
            setRevealedAt(Date.now());
            if (pollRef.current !== null) {
              window.clearInterval(pollRef.current);
              pollRef.current = null;
            }
            return;
          }
        }
      } catch (e) {
        // ignore transient errors — keep polling
      }
      if (attempts >= MAX_ATTEMPTS && pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    // Polling reducido (8s) — 50% menos requests al endpoint /api/videoservice/project/:id
    pollRef.current = window.setInterval(tick, 8000);
    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [projectId, artistPageReady]);

  const handlePayDeposit = async () => {
    if (!project || payingDeposit) return;
    setPayingDeposit(true);
    try {
      // Two-stage flow:
      //  - If reservation isn't paid → charge $99 reservation
      //  - Else (script approved/sent) → charge 50% balance
      const stage: 'reservation' | 'script_balance' = project.reservationPaid ? 'script_balance' : 'reservation';
      const total = Number(project.calculatedPrice || 0);
      const reservation = Number(project.reservationAmount || 99);
      const amount = stage === 'reservation' ? 99 : Math.max(0, Math.round(total * 0.5) - reservation);
      const checkoutRes = await apiRequest('/api/videoservice/checkout', 'POST', {
        projectId: project.id,
        depositAmount: amount,
        songName: project.songName || 'Video Project',
        lang,
        paymentType: stage,
      });
      if (checkoutRes.url) {
        window.location.href = checkoutRes.url;
        return;
      }
    } catch (e: any) {
      console.error('Checkout error:', e);
    } finally {
      setPayingDeposit(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const buildingArtistPage = !artistPageReady && !!projectId;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Language toggle (pill) */}
      <div className="fixed top-4 right-4 z-50 flex items-center bg-black/60 backdrop-blur-md border border-white/15 rounded-full p-1 shadow-lg shadow-black/40">
        {(['en', 'es'] as const).map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-all duration-200 ${
              lang === l
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-md shadow-orange-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
            aria-pressed={lang === l}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-20">
        {/* Success hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4 mb-10">
          <motion.div
            initial={{ scale: 0.5, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 12 }}
            className="w-20 h-20 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center mx-auto"
          >
            <PartyPopper className="w-10 h-10 text-green-400" />
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-bold">{t('successTitle', lang)}</h1>
          <p className="text-gray-400 text-lg">{t('successSub', lang)}</p>
        </motion.div>

        {/* ── ARTIST PAGE – LIVE REVEAL ─────────────────────────── */}
        <AnimatePresence mode="wait">
          {buildingArtistPage && (
            <motion.div
              key="building"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="relative bg-gradient-to-br from-orange-500/10 via-purple-500/5 to-cyan-500/10 border border-white/10 rounded-2xl p-6 mb-8 overflow-hidden"
            >
              {/* animated shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite] pointer-events-none"
                style={{ backgroundSize: '200% 100%' }} />
              <div className="relative flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white mb-1">
                    {isEs ? '🎨 Construyendo tu Página de Artista...' : '🎨 Building Your Artist Page...'}
                  </p>
                  <p className="text-sm text-gray-400">
                    {isEs
                      ? 'Estamos generando tu imagen artística con IA y preparando tu landing page profesional. Esto toma ~30-90 segundos.'
                      : 'We\'re generating your AI artwork and preparing your professional landing page. This takes ~30-90 seconds.'}
                  </p>
                  <div className="mt-3 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                      initial={{ width: '0%' }}
                      animate={{ width: ['0%', '70%', '85%', '92%'] }}
                      transition={{ duration: 90, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {artistPageReady && project?.artistPageUrl && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 18 }}
              className="relative bg-gradient-to-br from-orange-500/15 via-red-500/10 to-purple-500/15 border border-orange-500/40 rounded-2xl p-6 mb-8 overflow-hidden"
            >
              {/* Confetti-like spark ring */}
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative flex flex-col sm:flex-row items-center gap-5">
                {project.artistImageUrl && (
                  <motion.img
                    src={project.artistImageUrl}
                    alt="Your artist"
                    initial={{ opacity: 0, scale: 0.8, rotate: -6 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                    className="w-28 h-28 rounded-2xl object-cover border-2 border-orange-500/60 shadow-lg shadow-orange-500/30 flex-shrink-0"
                  />
                )}
                <div className="flex-1 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-green-500/20 text-green-300 border border-green-500/30 mb-2 uppercase tracking-wider">
                    <Sparkles className="w-3 h-3" /> {isEs ? 'Listo' : 'Ready'}
                  </div>
                  <h3 className="font-black text-xl mb-1 bg-gradient-to-r from-white to-orange-300 bg-clip-text text-transparent">
                    {isEs ? '🎁 Tu Página de Artista Está Lista' : '🎁 Your Artist Page is Ready'}
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    {isEs
                      ? 'Compártela con tus fans. Podrás personalizarla y subir más contenido en cualquier momento.'
                      : 'Share it with your fans. You can customize it and upload more content anytime.'}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a href={project.artistPageUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 font-bold">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {isEs ? 'Ver Mi Página' : 'View My Page'}
                      </Button>
                    </a>
                    <Button
                      variant="outline"
                      className="flex-1 border-white/20 hover:bg-white/5"
                      onClick={() => {
                        if (navigator.share && project.artistPageUrl) {
                          navigator.share({ title: 'My Artist Page', url: project.artistPageUrl }).catch(() => {});
                        } else if (project.artistPageUrl) {
                          navigator.clipboard?.writeText(project.artistPageUrl);
                        }
                      }}
                    >
                      {isEs ? 'Compartir' : 'Share'}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Project info card */}
        {project && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 mb-8 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{t('successProjectId', lang)}</span>
              <span className="font-mono text-orange-400">#{project.id}</span>
            </div>
            {project.songName && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Song</span>
                <span className="text-white font-medium">{project.songName}</span>
              </div>
            )}
            {project.calculatedPrice && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{isEs ? 'Presupuesto total' : 'Total budget'}</span>
                <span className="text-orange-400 font-medium">${Number(project.calculatedPrice).toLocaleString()}</span>
              </div>
            )}

            {/* Stage 1 — Reservation */}
            {project.reservationPaid ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{isEs ? 'Reserva' : 'Reservation'}</span>
                <span className="text-green-400 font-medium">${project.reservationAmount || 99} ✓</span>
              </div>
            ) : (
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center gap-2 text-orange-300 text-sm mb-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="font-bold">{isEs ? 'Paso 1 — Reserva tu cupo' : 'Step 1 — Lock your slot'}</span>
                </div>
                <p className="text-xs text-gray-400 mb-3">
                  {isEs
                    ? 'Solo $99 hoy. Activa la creación de tu guión inmediatamente. El 50% se paga después al aprobar el guión.'
                    : "Only $99 today. Triggers script creation right away. 50% is paid later, after you approve the script."}
                </p>
                <Button
                  onClick={handlePayDeposit}
                  disabled={payingDeposit}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold"
                >
                  {payingDeposit ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  {isEs ? 'Reservar por $99' : 'Reserve for $99'}
                </Button>
              </div>
            )}

            {/* Stage 2 — Script payment (50% balance) */}
            {project.reservationPaid && (
              project.scriptPaymentPaid ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">{isEs ? 'Pago de guión (50%)' : 'Script payment (50%)'}</span>
                  <span className="text-green-400 font-medium">${Number(project.scriptPaymentAmount || project.depositAmount || 0).toLocaleString()} ✓</span>
                </div>
              ) : (
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm mb-2">
                    <CreditCard className="w-4 h-4" />
                    <span className="font-bold">{isEs ? 'Paso 2 — Pago de guión (50%)' : 'Step 2 — Script payment (50%)'}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    {isEs
                      ? 'Disponible cuando tu guión esté listo. Activa la producción inmediatamente.'
                      : 'Unlocked once your script is ready. Production starts immediately.'}
                  </p>
                  {(project.projectStatus === 'proposal_sent' || project.projectStatus === 'in_production') ? (
                    <Button
                      onClick={handlePayDeposit}
                      disabled={payingDeposit}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
                    >
                      {payingDeposit ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <CreditCard className="w-4 h-4 mr-2" />
                      )}
                      {isEs ? 'Pagar 50%' : 'Pay 50%'} — $
                      {(() => {
                        const total = Number(project.calculatedPrice || 0);
                        const reservation = Number(project.reservationAmount || 99);
                        return Math.max(0, Math.round(total * 0.5) - reservation).toLocaleString();
                      })()}
                    </Button>
                  ) : (
                    <div className="text-xs text-gray-500 italic flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {isEs ? 'Esperando aprobación del guión...' : 'Waiting for script approval...'}
                    </div>
                  )}
                </div>
              )
            )}
          </motion.div>
        )}

        {/* Premium perk banner — 1 year of Boostify Premium granted */}
        {project?.premiumAccessGranted && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.12 }}
            className="relative overflow-hidden bg-gradient-to-br from-purple-500/20 via-fuchsia-500/15 to-orange-500/15 border border-purple-400/40 rounded-2xl p-5 mb-8">
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-purple-500/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/40 mb-2 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> {isEs ? 'Premium activado' : 'Premium activated'}
              </div>
              <h3 className="text-lg font-black text-white mb-1">
                {isEs ? '🎉 1 año GRATIS de Boostify Premium' : '🎉 1 year FREE of Boostify Premium'}
                <span className="ml-2 text-xs font-normal text-purple-200">($7,000 {isEs ? 'valor' : 'value'})</span>
              </h3>
              <ul className="text-sm text-gray-200 space-y-1 mt-2">
                <li>✓ {isEs ? 'Acceso premium a todas las herramientas Boostify' : 'Premium access to every Boostify tool'}</li>
                <li>✓ {isEs ? `${project.aiVideoDiscountPct || 35}% de descuento en el generador de videos AI` : `${project.aiVideoDiscountPct || 35}% off the AI video generator`}</li>
                <li>✓ {isEs ? 'Tu landing page activa por 365 días' : 'Your landing page live for 365 days'}</li>
              </ul>
              {project.premiumAccessExpiresAt && (
                <p className="mt-3 text-[11px] text-purple-200/70">
                  {isEs ? 'Vence' : 'Expires'}: {new Date(project.premiumAccessExpiresAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Confirmed payment banner */}
        {confirmed && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 mb-8 flex items-center gap-4">
            <CheckCircle2 className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-400">
                {isEs ? '¡Pago confirmado!' : 'Payment confirmed!'}
              </p>
              <p className="text-sm text-gray-400">
                {isEs
                  ? 'Tu depósito ha sido procesado. Nuestro equipo comenzará a trabajar de inmediato.'
                  : 'Your deposit has been processed. Our team will start working immediately.'}
              </p>
            </div>
          </motion.div>
        )}

        {/* Email confirmation notice */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-zinc-900/40 border border-white/5 rounded-xl p-4 mb-8 flex items-center gap-3">
          <Mail className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <p className="text-sm text-gray-400">
            {isEs
              ? 'Te hemos enviado un email de confirmación. Recibirás actualizaciones por email en cada fase del proyecto.'
              : 'We\'ve sent you a confirmation email. You\'ll receive email updates at each project phase.'}
          </p>
        </motion.div>

        {/* Timeline */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-6">{t('successTimeline', lang)}</h2>
          <div className="space-y-0">
            {PHASES.map((phase, i) => {
              const Icon = phase.icon;
              const statusIdx = project ? STATUS_ORDER.indexOf(project.projectStatus) : 0;
              const isActive = statusIdx === i;
              const isDone = statusIdx > i;
              return (
                <div key={phase.key} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                      ${isDone ? 'bg-green-500/20 border-green-500 text-green-400' :
                        isActive ? 'bg-orange-500/20 border-orange-500 text-orange-400' :
                        'bg-zinc-800 border-white/10 text-gray-600'}`}>
                      {isDone ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                    </div>
                    {i < PHASES.length - 1 && (
                      <div className={`w-0.5 h-8 ${isDone ? 'bg-green-500/50' : 'bg-white/10'}`} />
                    )}
                  </div>
                  <div className="pb-6">
                    <p className={`font-medium text-sm ${isDone ? 'text-green-400' : isActive ? 'text-orange-400' : 'text-gray-500'}`}>
                      {t(phase.key, lang)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Email notice */}
        <p className="text-center text-sm text-gray-500">{t('successEmail', lang)}</p>
      </div>

      {/* Local keyframes for shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -100% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

