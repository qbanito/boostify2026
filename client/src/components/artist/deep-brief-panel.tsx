/**
 * Deep Brief Panel
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-creation interview based on Da Vinci's "deep questions" principle.
 * The artist selects from preset answers (+ optional custom) for 8 questions
 * before starting a new project. Answers feed Career Suite / Genesis Engine.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  ChevronDown,
  Save,
  Trash2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Pencil,
  X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DeepBriefPanelProps {
  artistId: string;
  pgId?: number;
  isOwnProfile: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  colors: {
    hexAccent: string;
    hexPrimary: string;
    hexBorder: string;
    textMuted: string;
    bgGradient: string;
    shadow: string;
  };
  cardStyles: string;
  cardStyleInline: React.CSSProperties;
  artistName: string;
}

interface BriefAnswers {
  savedAt?: string;
  [key: string]: string | undefined;
}

// ─── The 8 Da Vinci questions with preset options ─────────────────────────────

const QUESTIONS = [
  {
    id: 'wound',
    icon: '🩸',
    question: 'What emotional wound does this work represent?',
    hint: 'Da Vinci began every work by understanding the human emotion behind it.',
    options: [
      'Loneliness and the need to belong',
      'Fear of failure or being forgotten',
      'Heartbreak and lost love',
      'Anger at injustice or betrayal',
      'Grief and the pain of loss',
      'Identity crisis — not knowing who you are',
      'Anxiety about the future',
      'The weight of family expectations',
    ],
  },
  {
    id: 'statement',
    icon: '🔥',
    question: 'What is the artist trying to prove with this?',
    hint: 'Every work is a declaration. What is yours?',
    options: [
      'That I am capable of creating something timeless',
      'That this generation deserves to be heard',
      'That vulnerability is strength',
      'That my culture and roots deserve a spotlight',
      'That mainstream isn\'t the only path to success',
      'That love still wins in the end',
      'That I have evolved — this is the new me',
      'That authenticity is more powerful than perfection',
    ],
  },
  {
    id: 'image',
    icon: '🎨',
    question: 'What image should stay in the audience\'s mind?',
    hint: 'The first visual/emotional impression defines everything.',
    options: [
      'An intimate close-up — raw and real',
      'A cinematic wide shot with cinematic light',
      'Dark, moody atmosphere with neon accents',
      'A euphoric crowd losing themselves in the moment',
      'Minimalist — one person, one truth',
      'A surreal / dreamlike visual world',
      'Urban grit — streets, city lights, real life',
      'Nature or cosmic imagery — something bigger than us',
    ],
  },
  {
    id: 'viral',
    icon: '⚡',
    question: 'What phrase or moment could go viral?',
    hint: 'Design the viral moment before creating. Don\'t wait for it to happen.',
    options: [
      'A hook that names a universal feeling everyone has but never said out loud',
      'A bridge that flips the story completely in 8 seconds',
      'A single lyric that fits every situation people screenshot',
      'A visual concept that gets recreated as a trend (like a TikTok filter)',
      'A spoken/whispered line before the drop',
      'A call-and-response moment that live audiences will scream back',
      'A metaphor so specific it feels personally written for every listener',
      'A silence or pause that hits harder than any note',
    ],
  },
  {
    id: 'conflict',
    icon: '⚔️',
    question: 'What human conflict sustains the story?',
    hint: 'The most powerful works explore or resolve a universal conflict.',
    options: [
      'Love vs. pride',
      'Freedom vs. security',
      'Success vs. authenticity',
      'Staying vs. leaving',
      'Trust vs. self-protection',
      'Past self vs. who you\'re becoming',
      'Loyalty vs. personal growth',
      'Fame vs. privacy',
    ],
  },
  {
    id: 'product',
    icon: '💎',
    question: 'What product or experience can grow from this work?',
    hint: 'Da Vinci thought in systems. What ecosystem does this work generate?',
    options: [
      'A limited merch drop tied directly to the concept',
      'An immersive live show or pop-up experience',
      'A visual art series / zine / photography book',
      'A collaboration with a complementary brand or artist',
      'A documentary or short film',
      'A fan community or exclusive membership',
      'A digital collectible / NFT edition',
      'A podcast or voice series exploring the themes',
    ],
  },
  {
    id: 'audience',
    icon: '👁️',
    question: 'Who is this made for — specifically?',
    hint: 'The more specific the audience, the deeper the impact.',
    options: [
      'People who have felt invisible their whole life',
      'Late-night thinkers who feel everything too deeply',
      'Anyone who\'s had to rebuild themselves from scratch',
      'First-generation kids carrying two cultures at once',
      'People going through a silent heartbreak right now',
      'Young creatives doubting if their art is worth it',
      'Anyone who moved cities chasing a dream',
      'People in that phase — not where they were, not yet where they\'re going',
    ],
  },
  {
    id: 'legacy',
    icon: '🏛️',
    question: 'What should be remembered about this work in 10 years?',
    hint: 'Da Vinci built for the future. What do you leave behind?',
    options: [
      'That it was the first time this sound existed in this form',
      'That it defined the emotional soundtrack of this era',
      'That it was brutally honest when everything else was filtered',
      'That it launched a creative movement, not just a song',
      'That it made people feel seen who had never felt seen',
      'That it proved independent artists can create at this level',
      'That it bridged cultures that rarely share the same stage',
      'That it was a turning point — everything after was different',
    ],
  },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────

function storageKey(artistId: string) {
  return `deep-brief-${artistId}`;
}

function loadBrief(artistId: string): BriefAnswers {
  try {
    const raw = localStorage.getItem(storageKey(artistId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBrief(artistId: string, answers: BriefAnswers) {
  try {
    localStorage.setItem(
      storageKey(artistId),
      JSON.stringify({ ...answers, savedAt: new Date().toISOString() })
    );
  } catch {
    // storage not available
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DeepBriefPanel({
  artistId,
  isOwnProfile,
  isExpanded,
  onToggleExpand,
  colors,
  cardStyles,
  cardStyleInline,
  artistName,
}: DeepBriefPanelProps) {
  const [answers, setAnswers] = useState<BriefAnswers>({});
  const [saved, setSaved] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  // Per-question custom text mode (when "Other" is active)
  const [customMode, setCustomMode] = useState<Record<string, boolean>>({});
  const [customText, setCustomText] = useState<Record<string, string>>({});

  const accent = '#fbbf24'; // amber — IMAGINE phase color

  // Load saved brief on mount
  useEffect(() => {
    const saved = loadBrief(artistId);
    setAnswers(saved);
    // Detect if any saved answer is not in the preset list → restore custom mode
    const cm: Record<string, boolean> = {};
    const ct: Record<string, string> = {};
    QUESTIONS.forEach((q) => {
      const val = saved[q.id];
      if (val && !q.options.includes(val)) {
        cm[q.id] = true;
        ct[q.id] = val;
      }
    });
    setCustomMode(cm);
    setCustomText(ct);
  }, [artistId]);

  const filledCount = QUESTIONS.filter((q) => (answers[q.id] || '').trim().length > 0).length;
  const completionPct = Math.round((filledCount / QUESTIONS.length) * 100);

  const handleSelect = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  const toggleCustom = (id: string) => {
    setCustomMode((prev) => ({ ...prev, [id]: !prev[id] }));
    if (!customMode[id]) {
      // Switching to custom — pre-fill with current answer if it was a preset
      setCustomText((prev) => ({ ...prev, [id]: answers[id] || '' }));
    }
  };

  const handleCustomChange = (id: string, value: string) => {
    setCustomText((prev) => ({ ...prev, [id]: value }));
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveBrief(artistId, answers);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleClear = () => {
    if (window.confirm('Delete the saved Deep Brief?')) {
      setAnswers({});
      setCustomMode({});
      setCustomText({});
      try { localStorage.removeItem(storageKey(artistId)); } catch {}
    }
  };

  if (!isOwnProfile) return null;

  const q = QUESTIONS[currentQ];
  const currentAnswer = answers[q.id] || '';
  const isCustom = !!customMode[q.id];

  return (
    <div
      className={cardStyles}
      style={{
        ...cardStyleInline,
        borderColor: `${accent}50`,
        backgroundImage: `linear-gradient(135deg, rgba(251,191,36,0.08) 0%, rgba(8,8,14,0.96) 50%, rgba(245,158,11,0.05) 100%)`,
      }}
    >
      {/* ── Header ── */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-3 group"
      >
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-base"
            style={{ background: `${accent}20`, color: accent }}
          >
            <Lightbulb className="h-4 w-4" />
          </span>
          <div className="text-left">
            <span className="text-sm font-bold text-white">Deep Brief</span>
            <p className="text-[10px] text-gray-500 leading-none mt-0.5">
              8 Da Vinci questions · {filledCount}/{QUESTIONS.length} answered
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filledCount > 0 && (
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: `${accent}20`, color: accent }}
            >
              {completionPct}%
            </span>
          )}
          <motion.span animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4 text-gray-500 group-hover:text-gray-300" />
          </motion.span>
        </div>
      </button>

      {/* ── Body ── */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="brief-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">Completed</span>
                  <span className="text-[10px] font-bold" style={{ color: accent }}>
                    {completionPct}%
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${accent}, #f59e0b)` }}
                    animate={{ width: `${completionPct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Question navigator */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {QUESTIONS.map((q, i) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentQ(i)}
                    className="flex-shrink-0 w-7 h-7 rounded-lg text-[10px] font-bold transition-all"
                    style={{
                      background: currentQ === i
                        ? `${accent}25`
                        : (answers[q.id] || '').trim()
                        ? 'rgba(52,211,153,0.12)'
                        : 'rgba(255,255,255,0.03)',
                      color: currentQ === i
                        ? accent
                        : (answers[q.id] || '').trim()
                        ? '#34d399'
                        : '#6b7280',
                      border: `1px solid ${
                        currentQ === i
                          ? `${accent}40`
                          : (answers[q.id] || '').trim()
                          ? 'rgba(52,211,153,0.2)'
                          : 'rgba(255,255,255,0.06)'
                      }`,
                    }}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              {/* Current question */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQ}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-xl p-3 space-y-3"
                  style={{ background: `${accent}08`, border: `1px solid ${accent}20` }}
                >
                  {/* Question text */}
                  <div className="flex items-start gap-2">
                    <span className="text-base flex-shrink-0">{q.icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-white leading-snug">
                        {q.question}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5 italic">
                        {q.hint}
                      </p>
                    </div>
                  </div>

                  {/* ── Preset options ── */}
                  {!isCustom && (
                    <div className="flex flex-col gap-1.5">
                      {q.options.map((opt) => {
                        const selected = currentAnswer === opt;
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => handleSelect(q.id, opt)}
                            className="w-full text-left px-3 py-2 rounded-lg text-[11px] leading-snug transition-all"
                            style={{
                              background: selected ? `${accent}20` : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${selected ? `${accent}50` : 'rgba(255,255,255,0.07)'}`,
                              color: selected ? accent : '#9ca3af',
                              fontWeight: selected ? 700 : 400,
                            }}
                          >
                            {selected && <span className="mr-1.5">✓</span>}
                            {opt}
                          </button>
                        );
                      })}
                      {/* Other / custom */}
                      <button
                        type="button"
                        onClick={() => toggleCustom(q.id)}
                        className="w-full text-left px-3 py-2 rounded-lg text-[11px] flex items-center gap-1.5 transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px dashed rgba(255,255,255,0.12)',
                          color: '#6b7280',
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                        Write my own answer…
                      </button>
                    </div>
                  )}

                  {/* ── Custom text input ── */}
                  {isCustom && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500">Custom answer</span>
                        <button
                          type="button"
                          onClick={() => toggleCustom(q.id)}
                          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          <X className="h-3 w-3" /> Back to options
                        </button>
                      </div>
                      <textarea
                        value={customText[q.id] || ''}
                        onChange={(e) => handleCustomChange(q.id, e.target.value)}
                        placeholder="Type your own answer…"
                        rows={3}
                        className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none resize-none focus:border-yellow-500/40"
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Navigation buttons */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentQ((i) => Math.max(0, i - 1))}
                  disabled={currentQ === 0}
                  className="text-[11px] text-gray-500 hover:text-gray-300 disabled:opacity-30 transition-colors flex items-center gap-1"
                >
                  ← Back
                </button>
                <span className="text-[10px] text-gray-600">
                  {currentQ + 1} / {QUESTIONS.length}
                </span>
                {currentQ < QUESTIONS.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentQ((i) => Math.min(QUESTIONS.length - 1, i + 1))}
                    className="text-[11px] hover:opacity-80 transition-opacity flex items-center gap-1"
                    style={{ color: accent }}
                  >
                    Next <ArrowRight className="h-3 w-3" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    className="text-[11px] flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all hover:opacity-90"
                    style={{ background: `${accent}25`, color: accent, border: `1px solid ${accent}40` }}
                  >
                    {saved ? (
                      <><CheckCircle2 className="h-3 w-3" /> Saved!</>
                    ) : (
                      <><Save className="h-3 w-3" /> Save Brief</>
                    )}
                  </button>
                )}
              </div>

              {/* Action bar */}
              <div
                className="flex items-center justify-between pt-2"
                style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
              >
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-semibold transition-all hover:opacity-90"
                  style={{
                    background: saved ? 'rgba(52,211,153,0.15)' : `${accent}20`,
                    color: saved ? '#34d399' : accent,
                    border: `1px solid ${saved ? 'rgba(52,211,153,0.3)' : `${accent}30`}`,
                  }}
                >
                  {saved ? <CheckCircle2 className="h-3 w-3" /> : <Save className="h-3 w-3" />}
                  {saved ? 'Brief saved!' : 'Save all'}
                </button>
                <div className="flex items-center gap-2">
                  {answers.savedAt && (
                    <span className="text-[9px] text-gray-600">
                      Last saved: {new Date(answers.savedAt).toLocaleDateString()}
                    </span>
                  )}
                  {filledCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-[11px] text-gray-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Hint strip */}
              <div
                className="rounded-lg px-3 py-2 flex items-center gap-2"
                style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.10)' }}
              >
                <Sparkles className="h-3 w-3 flex-shrink-0" style={{ color: accent }} />
                <p className="text-[9px] text-gray-500 leading-relaxed">
                  Your answers feed The Atelier and Genesis Engine to create projects
                  with real purpose — not random tracks.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

