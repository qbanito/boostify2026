import { useState, useEffect, useCallback } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Brain,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trophy,
  BookOpen,
  AlertCircle,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuizScore {
  courseId: string;
  lessonIdx: number;
  score: number;     // 0–100 percentage
  correct: number;
  total: number;
  passed: boolean;
  attempts: number;
  bestScore: number;
  lastAttemptAt: string; // ISO
}

// ════════════════════════════════════════════════════════════════
// Storage
// ════════════════════════════════════════════════════════════════

const STORAGE_KEY = "quiz_scores";
const PASS_THRESHOLD = 70; // percent

function loadAllScores(): Record<string, QuizScore> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function quizKey(courseId: string, lessonIdx: number): string {
  return `${courseId}::${lessonIdx}`;
}

function saveScore(score: QuizScore): void {
  try {
    const all = loadAllScores();
    all[quizKey(score.courseId, score.lessonIdx)] = score;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota errors */
  }
}

/** Read-only access for external consumers */
export function getQuizScore(
  courseId: string,
  lessonIdx: number
): QuizScore | null {
  return loadAllScores()[quizKey(courseId, lessonIdx)] ?? null;
}

/** How many lessons in a course have a passing quiz score */
export function countPassedQuizzes(
  courseId: string,
  lessonCount: number
): number {
  const all = loadAllScores();
  let count = 0;
  for (let i = 0; i < lessonCount; i++) {
    const s = all[quizKey(courseId, i)];
    if (s?.passed) count++;
  }
  return count;
}

// ════════════════════════════════════════════════════════════════
// QuizScoreBadge — compact indicator for lesson list rows
// ════════════════════════════════════════════════════════════════

interface QuizScoreBadgeProps {
  courseId: string;
  lessonIdx: number;
}

export function QuizScoreBadge({ courseId, lessonIdx }: QuizScoreBadgeProps) {
  const score = getQuizScore(courseId, lessonIdx);
  if (!score) return null;

  return (
    <Badge
      variant="outline"
      className={
        score.passed
          ? "text-xs border-green-500/40 text-green-400 bg-green-500/5"
          : "text-xs border-orange-500/40 text-orange-400 bg-orange-500/5"
      }
    >
      <Brain className="w-2.5 h-2.5 mr-1" />
      {score.bestScore}%
    </Badge>
  );
}

// ════════════════════════════════════════════════════════════════
// Quiz states
// ════════════════════════════════════════════════════════════════

type QuizState = "intro" | "active" | "results";

interface LessonQuizProps {
  questions: QuizQuestion[];
  courseId: string;
  lessonIdx: number;
  lessonTitle: string;
  /** Called when the user clicks "Continue" on the results screen */
  onComplete?: () => void;
}

// ════════════════════════════════════════════════════════════════
// LessonQuiz
// ════════════════════════════════════════════════════════════════

export function LessonQuiz({
  questions,
  courseId,
  lessonIdx,
  lessonTitle,
  onComplete,
}: LessonQuizProps) {
  const [state, setState] = useState<QuizState>("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState(false); // answer revealed for current q
  const [savedScore, setSavedScore] = useState<QuizScore | null>(() =>
    getQuizScore(courseId, lessonIdx)
  );

  // Reset to intro if questions change (different lesson loaded)
  useEffect(() => {
    setState("intro");
    setCurrentQ(0);
    setAnswers({});
    setRevealed(false);
    setSavedScore(getQuizScore(courseId, lessonIdx));
  }, [courseId, lessonIdx]);

  const total = questions.length;

  // ── Derived ──────────────────────────────────────
  const currentQuestion = questions[currentQ] ?? null;
  const selectedAnswer = answers[currentQ] ?? -1;
  const isCorrect =
    currentQuestion !== null && selectedAnswer === currentQuestion.correctIndex;

  // ── Handlers ─────────────────────────────────────

  const handleSelectAnswer = (optIdx: number) => {
    if (revealed) return;
    setAnswers((prev) => ({ ...prev, [currentQ]: optIdx }));
  };

  const handleReveal = () => {
    if (selectedAnswer === -1) return;
    setRevealed(true);
  };

  const handleNext = () => {
    if (currentQ < total - 1) {
      setCurrentQ((q) => q + 1);
      setRevealed(false);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = useCallback(() => {
    const correct = questions.reduce((acc, q, i) => {
      return acc + (answers[i] === q.correctIndex ? 1 : 0);
    }, 0);
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = score >= PASS_THRESHOLD;

    const existing = getQuizScore(courseId, lessonIdx);
    const attempts = (existing?.attempts ?? 0) + 1;
    const bestScore = Math.max(existing?.bestScore ?? 0, score);

    const result: QuizScore = {
      courseId,
      lessonIdx,
      score,
      correct,
      total,
      passed,
      attempts,
      bestScore,
      lastAttemptAt: new Date().toISOString(),
    };
    saveScore(result);
    setSavedScore(result);
    setState("results");
  }, [questions, answers, courseId, lessonIdx, total]);

  const handleRetry = () => {
    setCurrentQ(0);
    setAnswers({});
    setRevealed(false);
    setState("active");
  };

  // ════════════════════════════════════════════════
  // Render: Intro
  // ════════════════════════════════════════════════

  if (state === "intro") {
    return (
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-orange-400" /> Lesson Quiz
        </h3>
        <Card className="p-6 text-center bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20">
          <Brain className="w-12 h-12 text-orange-400 mx-auto mb-3" />
          <h4 className="text-lg font-semibold mb-1">Test Your Knowledge</h4>
          <p className="text-muted-foreground text-sm mb-1">
            {total} question{total !== 1 ? "s" : ""} — pass with {PASS_THRESHOLD}%
          </p>
          {savedScore && (
            <p className="text-xs text-muted-foreground mb-3">
              Best score:{" "}
              <span
                className={
                  savedScore.passed ? "text-green-400 font-bold" : "text-orange-400 font-bold"
                }
              >
                {savedScore.bestScore}%
              </span>{" "}
              · Attempts: {savedScore.attempts}
            </p>
          )}
          <Button
            onClick={() => setState("active")}
            className="bg-orange-500 hover:bg-orange-600 mt-2"
          >
            {savedScore ? "Retake Quiz" : "Start Quiz"}{" "}
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </Card>
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // Render: Active quiz
  // ════════════════════════════════════════════════

  if (state === "active" && currentQuestion) {
    const progress = ((currentQ + 1) / total) * 100;

    return (
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-orange-400" /> Lesson Quiz
        </h3>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>
              Question {currentQ + 1} of {total}
            </span>
            <span>{Math.round(progress)}% through</span>
          </div>
          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <Card
          className="p-6 bg-zinc-900/60 border-white/5"
          key={currentQ}
        >
          <p className="font-semibold text-base mb-5 leading-relaxed">
            <span className="text-orange-400 mr-2">Q{currentQ + 1}.</span>
            {currentQuestion.question}
          </p>

          <div className="space-y-2.5">
            {currentQuestion.options.map((opt, oi) => {
              let cls =
                "w-full text-left p-3 rounded-xl border text-sm transition-all duration-150 ";
              if (!revealed) {
                cls +=
                  selectedAnswer === oi
                    ? "bg-orange-500/15 border-orange-500/50 text-orange-200"
                    : "border-white/10 hover:border-white/25 text-gray-300 hover:bg-white/5 cursor-pointer";
              } else {
                if (oi === currentQuestion.correctIndex) {
                  cls += "bg-green-500/15 border-green-500/40 text-green-300";
                } else if (oi === selectedAnswer) {
                  cls += "bg-red-500/15 border-red-500/40 text-red-300 line-through opacity-75";
                } else {
                  cls += "border-white/5 text-muted-foreground opacity-50";
                }
              }

              return (
                <button
                  key={oi}
                  type="button"
                  className={cls}
                  onClick={() => handleSelectAnswer(oi)}
                  disabled={revealed}
                >
                  <span className="font-semibold mr-2 text-xs opacity-60">
                    {String.fromCharCode(65 + oi)}.
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>

          {/* Revealed feedback */}
          {revealed && (
            <div
              className={`mt-4 p-3 rounded-lg flex items-start gap-2 text-sm ${
                isCorrect
                  ? "bg-green-500/10 border border-green-500/20 text-green-300"
                  : "bg-red-500/10 border border-red-500/20 text-red-300"
              }`}
            >
              {isCorrect ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              )}
              <span>{currentQuestion.explanation}</span>
            </div>
          )}
        </Card>

        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted-foreground">
            {Object.keys(answers).length} answered
          </span>
          {!revealed ? (
            <Button
              onClick={handleReveal}
              disabled={selectedAnswer === -1}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Check Answer
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {currentQ < total - 1 ? (
                <>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                "See Results"
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════
  // Render: Results
  // ════════════════════════════════════════════════

  if (state === "results" && savedScore) {
    const { score, correct, passed } = savedScore;

    return (
      <div>
        <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-orange-400" /> Quiz Results
        </h3>

        {/* Score hero */}
        <Card
          className={`p-6 text-center mb-6 ${
            passed
              ? "bg-green-500/10 border-green-500/20"
              : "bg-orange-500/10 border-orange-500/20"
          }`}
        >
          {passed ? (
            <Trophy className="w-12 h-12 text-green-400 mx-auto mb-3" />
          ) : (
            <AlertCircle className="w-12 h-12 text-orange-400 mx-auto mb-3" />
          )}
          <div
            className={`text-5xl font-black mb-1 ${
              passed ? "text-green-400" : "text-orange-400"
            }`}
          >
            {score}%
          </div>
          <p
            className={`font-semibold mb-1 ${
              passed ? "text-green-300" : "text-orange-300"
            }`}
          >
            {passed ? "🎉 Quiz Passed!" : "📚 Keep Studying"}
          </p>
          <p className="text-sm text-muted-foreground">
            {correct} of {total} correct · Need {PASS_THRESHOLD}% to pass
          </p>
        </Card>

        {/* Per-question breakdown */}
        <div className="space-y-3 mb-6">
          {questions.map((q, qi) => {
            const chosen = answers[qi] ?? -1;
            const wasCorrect = chosen === q.correctIndex;
            return (
              <div
                key={qi}
                className={`p-4 rounded-xl border text-sm ${
                  wasCorrect
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-red-500/5 border-red-500/20"
                }`}
              >
                <div className="flex items-start gap-2 mb-2">
                  {wasCorrect ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  )}
                  <p className="font-medium leading-snug">{q.question}</p>
                </div>
                {!wasCorrect && (
                  <div className="ml-6 space-y-1 text-xs">
                    <p className="text-red-400">
                      Your answer:{" "}
                      <span className="line-through">
                        {chosen >= 0 ? q.options[chosen] : "No answer"}
                      </span>
                    </p>
                    <p className="text-green-400">
                      Correct: {q.options[q.correctIndex]}
                    </p>
                    {q.explanation && (
                      <p className="text-muted-foreground mt-1 italic">
                        {q.explanation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleRetry}
            className="border-white/10 hover:border-orange-500/40 hover:text-orange-400 flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" /> Try Again
          </Button>
          <Button
            onClick={onComplete}
            className="bg-orange-500 hover:bg-orange-600 flex-1"
          >
            <BookOpen className="w-4 h-4 mr-1.5" /> Continue Lesson
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
