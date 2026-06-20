/**
 * PromoAutoFlow
 * Futuristic animated pipeline overlay for automated promo clip generation
 * Shows real-time animated progress for each step with holographic-style UI
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Wand2, Sparkles, Film, MessageSquare, Image, Camera,
  CheckCircle2, XCircle, Loader2, X,
} from 'lucide-react';

export type AutoFlowStepId =
  | 'analyze'
  | 'direction'
  | 'style-image'
  | 'video'
  | 'captions'
  | 'poster'
  | 'gallery';

export type AutoFlowStepStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped';

export interface AutoFlowStep {
  id: AutoFlowStepId;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  sublabel: string;
  status: AutoFlowStepStatus;
  progress: number; // 0-100
  detail?: string;
}

const STEP_DEFS: Omit<AutoFlowStep, 'status' | 'progress'>[] = [
  { id: 'analyze', icon: Zap, label: 'Analyzing Viral Moments', sublabel: 'AI scanning song energy & detecting the perfect hook' },
  { id: 'direction', icon: Wand2, label: 'Crafting Visual Direction', sublabel: 'Director AI composing scene layout & cinematography' },
  { id: 'style-image', icon: Sparkles, label: 'Generating Artist Frame', sublabel: 'Flux Kontext Pro rendering your signature look' },
  { id: 'video', icon: Film, label: 'Rendering Promo Video', sublabel: 'Lipsync engine composing synchronized frames' },
  { id: 'captions', icon: MessageSquare, label: 'Writing Viral Captions', sublabel: 'AI copywriter crafting hooks & hashtags' },
  { id: 'poster', icon: Image, label: 'Creating Hollywood Poster', sublabel: 'Designing your cinematic story cover' },
  { id: 'gallery', icon: Camera, label: 'Saving to Gallery', sublabel: 'Publishing masterpiece to your profile' },
];

const FUN_FACTS = [
  'The first music video ever was "Bohemian Rhapsody" by Queen in 1975.',
  'TikTok videos under 30 seconds get 60% more completions on average.',
  'Over 70% of viral hits were discovered through short video content.',
  'Lipsync AI processes over 24 frames per second for perfect mouth tracking.',
  'Flux Kontext Pro generates 1024×1024 images in under 5 seconds.',
  'Studies show the first 3 seconds determine 90% of watch-through rate.',
  'The most shared content emotionally peaks in the first 7 seconds.',
  'Instagram Reels with captions get 40% higher engagement rates.',
  'AI-generated promo clips reduce production time from weeks to minutes.',
  'Professional Hollywood posters use the rule of thirds for composition.',
  'Music video color grading influences mood perception by up to 30%.',
  'The average attention span on TikTok is 2.5 seconds before a swipe.',
];

interface PromoAutoFlowProps {
  isOpen: boolean;
  steps: AutoFlowStep[];
  currentStepId?: AutoFlowStepId;
  onCancel: () => void;
  accent?: string;
  songName?: string;
}

export function PromoAutoFlow({
  isOpen,
  steps,
  currentStepId,
  onCancel,
  accent = '#ec4899',
  songName,
}: PromoAutoFlowProps) {
  const [factIndex, setFactIndex] = useState(0);
  const factTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    factTimer.current = setInterval(() => {
      setFactIndex(i => (i + 1) % FUN_FACTS.length);
    }, 5000);
    return () => { if (factTimer.current) clearInterval(factTimer.current); };
  }, [isOpen]);

  const completedCount = steps.filter(s => s.status === 'done').length;
  const totalCount = steps.filter(s => s.status !== 'skipped').length;
  const overallProgress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allDone = completedCount === totalCount && totalCount > 0;
  const hasError = steps.some(s => s.status === 'error');

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            background: 'rgba(0,0,0,0.9)',
            backdropFilter: 'blur(24px)',
          }}
        >
          {/* Animated BG grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(rgba(168,85,247,0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(168,85,247,0.03) 1px, transparent 1px)
              `,
              backgroundSize: '48px 48px',
            }}
          />

          {/* Animated corner accents */}
          {['-top-px -left-px', '-top-px -right-px', '-bottom-px -left-px', '-bottom-px -right-px'].map((pos, i) => (
            <motion.div
              key={i}
              className={`absolute ${pos} w-24 h-24 pointer-events-none`}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 }}
              style={{
                background: `radial-gradient(circle at ${i < 2 ? 'top' : 'bottom'} ${i % 2 === 0 ? 'left' : 'right'}, ${accent}22 0%, transparent 70%)`,
              }}
            />
          ))}

          {/* Main panel */}
          <motion.div
            className="relative w-full max-w-lg mx-4"
            initial={{ scale: 0.9, y: 32 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 32 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <div
              className="rounded-3xl p-6 space-y-5"
              style={{
                background: 'rgba(5,0,20,0.95)',
                border: `1px solid ${accent}33`,
                boxShadow: `0 0 60px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.06)`,
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <motion.div
                    className="flex items-center gap-2 mb-1"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
                    <span className="text-xs font-mono tracking-widest uppercase text-white/50">
                      Auto-Flow Active
                    </span>
                  </motion.div>
                  <h2 className="text-xl font-bold text-white leading-tight">
                    {allDone ? '🎉 All Done!' : hasError ? '⚠️ Flow Error' : '⚡ Generating Promo'}
                  </h2>
                  {songName && (
                    <p className="text-white/40 text-sm mt-0.5">"{songName}"</p>
                  )}
                </div>

                {/* Cancel */}
                {!allDone && (
                  <button
                    onClick={onCancel}
                    className="p-2 rounded-xl transition-all hover:bg-white/10"
                    style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <X className="w-4 h-4 text-white/50" />
                  </button>
                )}
              </div>

              {/* Overall progress bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-white/40 font-mono">OVERALL PROGRESS</span>
                  <span className="font-mono font-bold" style={{ color: accent }}>{overallProgress}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    animate={{ width: `${overallProgress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{
                      background: `linear-gradient(90deg, ${accent}, #8b5cf6)`,
                      boxShadow: `0 0 12px ${accent}`,
                    }}
                  />
                </div>
              </div>

              {/* Step list */}
              <div className="space-y-2">
                {steps.filter(s => s.status !== 'skipped').map((step, idx) => {
                  const isActive = step.id === currentStepId && step.status === 'running';
                  const isDone = step.status === 'done';
                  const isError = step.status === 'error';
                  const Icon = STEP_DEFS[idx]?.icon || Sparkles;

                  return (
                    <motion.div
                      key={step.id}
                      layout
                      className="flex items-center gap-3 p-3 rounded-2xl"
                      animate={isActive ? {
                        borderColor: [`${accent}44`, `${accent}88`, `${accent}44`],
                      } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{
                        background: isActive
                          ? `rgba(${accent === '#ec4899' ? '236,72,153' : '168,85,247'},0.06)`
                          : isDone
                          ? 'rgba(34,197,94,0.04)'
                          : 'rgba(255,255,255,0.025)',
                        border: isActive
                          ? `1px solid ${accent}44`
                          : isDone
                          ? '1px solid rgba(34,197,94,0.2)'
                          : isError
                          ? '1px solid rgba(239,68,68,0.3)'
                          : '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isDone
                            ? 'rgba(34,197,94,0.15)'
                            : isError
                            ? 'rgba(239,68,68,0.15)'
                            : isActive
                            ? `${accent}22`
                            : 'rgba(255,255,255,0.04)',
                        }}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : isError ? (
                          <XCircle className="w-4 h-4 text-red-400" />
                        ) : isActive ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                          >
                            <Loader2 className="w-4 h-4" style={{ color: accent }} />
                          </motion.div>
                        ) : (
                          <Icon className="w-4 h-4 text-white/30" />
                        )}
                      </div>

                      {/* Labels */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold leading-tight ${isDone ? 'text-green-300' : isError ? 'text-red-300' : isActive ? 'text-white' : 'text-white/40'}`}>
                          {step.label}
                        </p>
                        {(isActive || isDone) && (
                          <p className="text-[10px] text-white/30 mt-0.5 leading-tight truncate">
                            {step.detail || step.sublabel}
                          </p>
                        )}
                      </div>

                      {/* Progress bar (for active/running steps) */}
                      {isActive && step.progress > 0 && (
                        <div className="w-20 flex-shrink-0">
                          <div className="h-1 rounded-full overflow-hidden bg-white/10">
                            <motion.div
                              className="h-full rounded-full"
                              animate={{ width: `${step.progress}%` }}
                              transition={{ duration: 0.4 }}
                              style={{ background: accent }}
                            />
                          </div>
                          <p className="text-[9px] text-right font-mono mt-0.5" style={{ color: accent }}>
                            {step.progress}%
                          </p>
                        </div>
                      )}

                      {/* Done checkmark badge */}
                      {isDone && (
                        <span className="text-[9px] font-mono text-green-400 uppercase tracking-wider flex-shrink-0">
                          DONE
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Fun fact ticker */}
              {!allDone && !hasError && (
                <div
                  className="p-3 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <p className="text-[10px] uppercase tracking-widest font-mono text-white/25 mb-1">Did You Know?</p>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={factIndex}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="text-xs text-white/50 leading-relaxed"
                    >
                      {FUN_FACTS[factIndex]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                {allDone && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onCancel}
                    className="flex-1 py-3 rounded-2xl text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)` }}
                  >
                    View Results ✨
                  </motion.button>
                )}
                {hasError && (
                  <button
                    onClick={onCancel}
                    className="flex-1 py-3 rounded-2xl text-sm font-medium"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                  >
                    Close & Review
                  </button>
                )}
                {!allDone && !hasError && (
                  <button
                    onClick={onCancel}
                    className="ml-auto text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    Cancel Auto-Flow
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Hook: useAutoFlow ─────────────────────────────────────────────────────────

export function useAutoFlow() {
  const [steps, setSteps] = useState<AutoFlowStep[]>(
    STEP_DEFS.map(d => ({ ...d, status: 'idle', progress: 0 }))
  );
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepId, setCurrentStepId] = useState<AutoFlowStepId | undefined>();

  const startFlow = () => {
    setSteps(STEP_DEFS.map(d => ({ ...d, status: 'idle', progress: 0 })));
    setCurrentStepId(undefined);
    setIsOpen(true);
  };

  const closeFlow = () => setIsOpen(false);

  const setStepRunning = (id: AutoFlowStepId, detail?: string) => {
    setCurrentStepId(id);
    setSteps(prev => prev.map(s =>
      s.id === id ? { ...s, status: 'running', progress: 0, detail } : s
    ));
  };

  const setStepProgress = (id: AutoFlowStepId, progress: number, detail?: string) => {
    setSteps(prev => prev.map(s =>
      s.id === id ? { ...s, progress, ...(detail ? { detail } : {}) } : s
    ));
  };

  const setStepDone = (id: AutoFlowStepId, detail?: string) => {
    setSteps(prev => prev.map(s =>
      s.id === id ? { ...s, status: 'done', progress: 100, detail } : s
    ));
  };

  const setStepError = (id: AutoFlowStepId, detail?: string) => {
    setSteps(prev => prev.map(s =>
      s.id === id ? { ...s, status: 'error', detail } : s
    ));
  };

  const setStepSkipped = (id: AutoFlowStepId) => {
    setSteps(prev => prev.map(s =>
      s.id === id ? { ...s, status: 'skipped' } : s
    ));
  };

  return {
    steps,
    isOpen,
    currentStepId,
    startFlow,
    closeFlow,
    setStepRunning,
    setStepProgress,
    setStepDone,
    setStepError,
    setStepSkipped,
  };
}
