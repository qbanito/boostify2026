/**
 * CopyrightCertificateCard
 *
 * Shows the result after the original song pipeline completes.
 * Polls /api/music-original/:id every 3s until status === 'complete' | 'failed'.
 *
 * Displays:
 *  - Status while processing
 *  - Audio player
 *  - 4 stem download buttons
 *  - Authorship declaration summary
 *  - Document hash
 *  - "Abrir en Mini Studio" button → /mini-studio?songId=projectId
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import {
  Shield, CheckCircle, Loader2, Download, Music,
  Mic, Drum, Guitar, Radio, ExternalLink, Copy, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string;
  title: string;
  genre: string;
  mood: string;
  status: string;
  audioUrl: string | null;
  stemsVocalsUrl: string | null;
  stemsDrumsUrl: string | null;
  stemsBassUrl: string | null;
  stemsOtherUrl: string | null;
  documentHash: string | null;
  blockchainTx: string | null;
  creativeStory: string | null;
  originalVerse: string | null;
  declarationSignedAt: string | null;
  certifiedAt: string | null;
  errorMessage: string | null;
}

interface CopyrightCertificateCardProps {
  projectId: string;
  onStartNew?: () => void;
}

// ─── Status display helpers ───────────────────────────────────────────────────

const STATUS_MESSAGES: Record<string, { label: string; sub: string; done: boolean }> = {
  generating:  { label: 'Generando tu canción...', sub: 'Boostify Music Generator está componiendo tu obra', done: false },
  separating:  { label: 'Separando stems...', sub: 'Dividiendo la canción en 4 pistas independientes', done: false },
  certifying:  { label: 'Generando certificado...', sub: 'Calculando huella digital SHA-256 y registrando en blockchain', done: false },
  complete:    { label: 'Certificado emitido', sub: 'Revisa tu email — el certificado fue enviado a tu correo', done: true },
  failed:      { label: 'Error en el proceso', sub: 'Hubo un problema — revisa los detalles abajo', done: false },
};

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' });
}

// ─── Stem button ──────────────────────────────────────────────────────────────

function StemButton({ url, label, icon: Icon, color }: {
  url: string | null; label: string; icon: any; color: string;
}) {
  const { toast } = useToast();

  if (!url) {
    return (
      <div className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-white/10 opacity-40`}>
        <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-xs text-white/40">{label}</span>
        <span className="text-xs text-white/20">Procesando…</span>
      </div>
    );
  }

  return (
    <a
      href={url}
      download
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 transition-all group`}
      onClick={() => toast({ title: `Descargando ${label}` })}
    >
      <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className="w-5 h-5 text-black" />
      </div>
      <span className="text-xs text-white/80 font-medium">{label}</span>
      <Download className="w-3 h-3 text-white/40 group-hover:text-white/80 transition-colors" />
    </a>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function CopyrightCertificateCard({ projectId, onStartNew }: CopyrightCertificateCardProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Poll for status
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    let attempts = 0;
    const MAX = 120; // 6 minutes max

    async function poll() {
      try {
        const res = await apiRequest('GET', `/api/music-original/${projectId}`);
        if (!res.ok) return;
        const data = await res.json();
        const p: Project = {
          id: data.project?.id,
          title: data.project?.title,
          genre: data.project?.genre,
          mood: data.project?.mood,
          status: data.project?.status,
          audioUrl: data.project?.audio_url,
          stemsVocalsUrl: data.project?.stems_vocals_url,
          stemsDrumsUrl: data.project?.stems_drums_url,
          stemsBassUrl: data.project?.stems_bass_url,
          stemsOtherUrl: data.project?.stems_other_url,
          documentHash: data.project?.document_hash,
          blockchainTx: data.project?.blockchain_tx,
          creativeStory: data.project?.creative_story,
          originalVerse: data.project?.original_verse,
          declarationSignedAt: data.project?.declaration_signed_at,
          certifiedAt: data.project?.certified_at,
          errorMessage: data.project?.error_message,
        };
        setProject(p);
        setLoading(false);
        if (p.status === 'complete' || p.status === 'failed') {
          clearInterval(timer);
        }
      } catch {
        // continue polling
      }
      attempts++;
      if (attempts >= MAX) clearInterval(timer);
    }

    poll();
    timer = setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [projectId]);

  function copyHash() {
    if (!project?.documentHash) return;
    navigator.clipboard.writeText(project.documentHash);
    toast({ title: 'Hash copiado al portapapeles' });
  }

  // ── Loading state ──
  if (loading || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="w-12 h-12 text-orange-400 animate-spin" />
        <p className="text-white/60">Iniciando pipeline…</p>
      </div>
    );
  }

  const statusInfo = STATUS_MESSAGES[project.status] || STATUS_MESSAGES['generating'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      {/* Status header */}
      <div className={`rounded-2xl border p-6 text-center transition-all ${
        project.status === 'complete'
          ? 'border-green-500/40 bg-green-500/5'
          : project.status === 'failed'
          ? 'border-red-500/40 bg-red-500/5'
          : 'border-orange-500/30 bg-orange-500/5'
      }`}>
        <div className="mb-4">
          {project.status === 'complete' ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500/60 flex items-center justify-center mx-auto"
            >
              <Shield className="w-8 h-8 text-green-400" />
            </motion.div>
          ) : project.status === 'failed' ? (
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto" />
          ) : (
            <div className="relative w-16 h-16 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-orange-500/20 animate-ping" />
              <div className="w-full h-full rounded-full bg-orange-500/20 border-2 border-orange-500/40 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              </div>
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold text-white mb-1">{statusInfo.label}</h2>
        <p className="text-white/50 text-sm">
          {project.status === 'failed' && project.errorMessage
            ? project.errorMessage
            : statusInfo.sub}
        </p>
        <p className="text-2xl font-black text-white mt-3">"{project.title}"</p>
      </div>

      {/* Processing steps */}
      {project.status !== 'complete' && project.status !== 'failed' && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Generando', active: project.status === 'generating' },
            { label: 'Stems', active: project.status === 'separating' },
            { label: 'Certificado', active: project.status === 'certifying' },
          ].map((s, i) => {
            const statuses = ['generating', 'separating', 'certifying'];
            const currentIdx = statuses.indexOf(project.status);
            const isDone = i < currentIdx;
            return (
              <div key={i} className={`rounded-lg p-3 border text-center text-xs transition-all ${
                s.active ? 'border-orange-500/50 bg-orange-500/10 text-orange-300' :
                isDone ? 'border-green-500/30 bg-green-500/5 text-green-400' :
                'border-white/10 bg-white/5 text-white/30'
              }`}>
                {isDone ? '✓ ' : s.active ? '⟳ ' : ''}{s.label}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {project.status === 'complete' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-5"
          >
            {/* Audio player */}
            {project.audioUrl && (
              <div className="bg-white/5 rounded-xl p-5 border border-white/10">
                <p className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
                  <Music className="w-4 h-4" /> Tu canción
                </p>
                <audio controls className="w-full" src={project.audioUrl}>
                  Tu navegador no soporta audio.
                </audio>
              </div>
            )}

            {/* Stems */}
            <div className="bg-white/5 rounded-xl p-5 border border-white/10">
              <p className="text-sm font-semibold text-white/60 mb-4 flex items-center gap-2">
                <Radio className="w-4 h-4" /> 4 Stems independientes
              </p>
              <div className="grid grid-cols-4 gap-3">
                <StemButton url={project.stemsVocalsUrl} label="Vocals" icon={Mic} color="bg-purple-500" />
                <StemButton url={project.stemsDrumsUrl} label="Drums" icon={Drum} color="bg-orange-500" />
                <StemButton url={project.stemsBassUrl} label="Bass" icon={Guitar} color="bg-blue-500" />
                <StemButton url={project.stemsOtherUrl} label="Instruments" icon={Music} color="bg-green-500" />
              </div>
            </div>

            {/* Authorship summary */}
            <div className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-3">
              <p className="text-sm font-semibold text-white/60 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" /> Declaración de autoría firmada
              </p>
              {project.creativeStory && (
                <div className="bg-white/5 rounded-lg p-3 border-l-2 border-orange-500/60">
                  <p className="text-xs text-white/40 mb-1">Historia creativa</p>
                  <p className="text-sm text-white/80 italic">"{project.creativeStory}"</p>
                </div>
              )}
              {project.originalVerse && (
                <div className="bg-white/5 rounded-lg p-3 border-l-2 border-purple-500/60">
                  <p className="text-xs text-white/40 mb-1">Verso original</p>
                  <p className="text-sm text-white/80 italic">"{project.originalVerse}"</p>
                </div>
              )}
              <p className="text-xs text-white/30">Firmada el {fmtDate(project.declarationSignedAt)}</p>
            </div>

            {/* Hash */}
            <div className="bg-white/5 rounded-xl p-5 border border-orange-500/30">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Huella digital SHA-256
                </p>
                <button
                  onClick={copyHash}
                  className="text-xs text-white/40 hover:text-white/80 flex items-center gap-1 transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copiar
                </button>
              </div>
              <p className="font-mono text-xs text-orange-300/80 break-all leading-relaxed bg-black/20 p-3 rounded-lg">
                {project.documentHash}
              </p>
              {project.blockchainTx && (
                <p className="text-xs text-white/30 mt-2">
                  Polygon TX: <span className="font-mono text-blue-400">{project.blockchainTx.slice(0, 16)}…{project.blockchainTx.slice(-8)}</span>
                </p>
              )}
            </div>

            {/* CTAs */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => navigate(`/mini-studio?songProjectId=${projectId}`)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir en Mini Studio
              </Button>
              {onStartNew && (
                <Button
                  onClick={onStartNew}
                  variant="outline"
                  className="border-white/20 text-white/70 hover:text-white hover:bg-white/10"
                >
                  <Music className="w-4 h-4 mr-2" />
                  Nueva canción
                </Button>
              )}
            </div>

            <p className="text-center text-xs text-white/30">
              El certificado completo fue enviado a tu correo electrónico · {fmtDate(project.certifiedAt)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
