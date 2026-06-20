import { useState, useEffect } from "react";
import { Header } from "../components/layout/header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../hooks/use-auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import {
  BookOpen, Search, Sparkles, GraduationCap, Award, Clock,
  ChevronRight, ChevronLeft, ArrowLeft, Loader2, Play, CheckCircle2,
  Target, Star, Brain, Dumbbell,
  BookMarked, TrendingUp, Zap, ShoppingCart, Lock, Volume2, HelpCircle, MessageCircle,
  Video, Music2, Lightbulb, Trophy, Flame, BarChart3, PlayCircle, RotateCcw, ImageIcon
} from "lucide-react";
import { CourseCertificate, getEarnedCertificate } from "../components/education/course-certificate";
import { LessonQuiz, QuizScoreBadge, countPassedQuizzes, type QuizQuestion } from "../components/education/lesson-quiz";
import { CourseDiscussions, getThreadCount } from "../components/education/course-discussions";

// ═══════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════

interface Course {
  id: string;
  title: string;
  description: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  thumbnail: string | null;
  price: string;
  estimatedHours: number;
  learningOutcome?: string;
  targetAudience?: string;
  objectives?: string[];
  prerequisites?: string[];
  skills?: string[];
  topics?: string[];
  preview?: Array<{ title: string; description: string; duration: string; type?: string }>;
  fullCurriculum?: Array<{ title: string; description: string; duration: string; topics?: string[]; type?: string }>;
  quiz?: QuizQuestion[];
}

interface LessonContent {
  content: string;
  keyTakeaways?: string[];
  exercises?: Array<{ title: string; description: string; difficulty: string; estimatedMinutes?: number }>;
  quiz?: QuizQuestion[];
  image?: string | null;
  musicSamplePrompt?: string | null;
  musicSampleLyrics?: string | null;
  additionalResources?: Array<{ title: string; description: string; type?: string }>;
}

// ═══════════════════════════════════════════════════
// Simple Markdown to HTML converter
// ═══════════════════════════════════════════════════

function markdownToHtml(md: string): string {
  if (!md) return '';
  let html = md
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr />')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br />');
  html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');
  return `<p>${html}</p>`;
}

// ═══════════════════════════════════════════════════
// Education Page
// ═══════════════════════════════════════════════════

export default function EducationPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedLessonIdx, setSelectedLessonIdx] = useState<number | null>(null);
  const [lessonContent, setLessonContent] = useState<LessonContent | null>(null);
  const [isLoadingLesson, setIsLoadingLesson] = useState(false);
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [showCertificate, setShowCertificate] = useState(false);
  const [courseTab, setCourseTab] = useState<"curriculum" | "discussion">("curriculum");

  // Create course dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [newCourseTopic, setNewCourseTopic] = useState("");
  const [newCourseLevel, setNewCourseLevel] = useState<string>("Intermediate");
  const [newCourseLessons, setNewCourseLessons] = useState("8");

  // Purchased courses (persisted in localStorage)
  const [purchasedCourses, setPurchasedCourses] = useState<Set<string>>(new Set());
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Audio player
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  // Quiz state (used in handleOpenLesson reset)
  const [quizMode, setQuizMode] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Intro video
  const [introVideoUrl, setIntroVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [showIntroVideo, setShowIntroVideo] = useState(false);

  // Fill missing thumbnails
  const [isFillingImages, setIsFillingImages] = useState(false);

  // Music sample
  const [musicSampleUrl, setMusicSampleUrl] = useState<string | null>(null);
  const [isGeneratingMusicSample, setIsGeneratingMusicSample] = useState(false);

  // Adaptive recommendations
  const [recommendations, setRecommendations] = useState<{
    nextTopics: string[];
    practiceAreas: string[];
    motivationalMessage: string;
    suggestedPace: string;
    weeklyGoal: string;
  } | null>(null);

  // Auth guard
  useEffect(() => {
    if (!user) setLocation('/auth');
  }, [user, setLocation]);

  // Load courses
  useEffect(() => {
    loadCourses();
  }, []);

  // Load completed lessons from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('completed_lessons');
      if (saved) setCompletedLessons(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  // Reset video state when changing courses
  useEffect(() => {
    setIntroVideoUrl(null);
    setShowIntroVideo(false);
    setRecommendations(null);
    setMusicSampleUrl(null);
    if (selectedCourse) {
      void handleGetRecommendations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourse?.id]);

  // Load purchased courses from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('purchased_courses');
      if (saved) setPurchasedCourses(new Set(JSON.parse(saved)));
    } catch { /* ignore */ }
  }, []);

  // Handle Stripe payment return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const courseId = params.get('courseId');
    if (payment === 'success' && courseId) {
      setPurchasedCourses(prev => {
        const updated = new Set(prev);
        updated.add(decodeURIComponent(courseId));
        try { localStorage.setItem('purchased_courses', JSON.stringify([...updated])); } catch { /* */ }
        return updated;
      });
      toast({ title: '🎉 Enrollment Successful!', description: 'You now have full access to this course.' });
      window.history.replaceState({}, '', '/education');
    } else if (payment === 'cancelled') {
      toast({ title: 'Payment cancelled', description: 'You were not charged.', variant: 'destructive' });
      window.history.replaceState({}, '', '/education');
    }
  }, []);

  const saveCompletedLessons = (updated: Set<string>) => {
    setCompletedLessons(updated);
    try { localStorage.setItem('completed_lessons', JSON.stringify([...updated])); } catch { /* */ }
  };

  const loadCourses = async () => {
    try {
      setIsLoading(true);
      const cached = localStorage.getItem('ai_courses_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Invalidate old cache where all prices were 0.00
          const hasValidPricing = parsed.some((c: any) => c.price && c.price !== '0.00');
          if (hasValidPricing) {
            setCourses(parsed);
            setIsLoading(false);
            return;
          }
          localStorage.removeItem('ai_courses_cache');
        }
      }
      const response = await apiRequest('/api/education/generate-20-courses', { method: 'POST' });
      if (response.success && Array.isArray(response.courses)) {
        const mapped = response.courses.map((c: any) => ({
          id: c.id || `course-${Math.random()}`,
          title: c.title || 'Untitled Course',
          description: c.description || '',
          level: c.level || 'Beginner',
          thumbnail: c.thumbnail || null,
          price: c.price || '0.00',
          estimatedHours: c.estimatedHours || 10,
          objectives: c.objectives || [],
          prerequisites: c.prerequisites || [],
          skills: c.skills || [],
          topics: c.topics || [],
          preview: c.preview || [],
          fullCurriculum: c.fullCurriculum || c.preview || [],
          quiz: c.quiz
        }));
        setCourses(mapped);
        try { localStorage.setItem('ai_courses_cache', JSON.stringify(mapped)); } catch { /* */ }
        toast({ title: '🎉 Courses Ready!', description: `${mapped.length} AI-generated courses loaded.` });
      }
    } catch (error: any) {
      console.error('Error loading courses:', error);
      toast({ title: 'Error', description: 'Failed to load courses.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillMissingImages = async () => {
    const missing = courses.filter(c => !c.thumbnail);
    if (missing.length === 0) {
      toast({ title: 'All courses have images', description: 'No missing thumbnails to generate.' });
      return;
    }
    setIsFillingImages(true);
    try {
      const response = await apiRequest('/api/education/fill-missing-images', {
        method: 'POST',
        body: JSON.stringify({ courses: missing.map(c => ({ id: c.id, title: c.title, level: c.level, imagePrompt: null })) }),
      });
      if (response.success && Array.isArray(response.updated) && response.updated.length > 0) {
        const patchMap = new Map<string, string>(response.updated.map((u: any) => [u.id, u.thumbnail]));
        const patched = courses.map(c => patchMap.has(c.id) ? { ...c, thumbnail: patchMap.get(c.id)! } : c);
        setCourses(patched);
        try { localStorage.setItem('ai_courses_cache', JSON.stringify(patched)); } catch { /* */ }
        toast({ title: `✅ ${response.updated.length} thumbnails generated!`, description: `${response.totalProcessed - response.updated.length} could not be generated.` });
      } else {
        toast({ title: 'No thumbnails generated', description: response.message || 'Try again later.', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to generate thumbnails.', variant: 'destructive' });
    } finally {
      setIsFillingImages(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!newCourseTopic.trim()) {
      toast({ title: 'Topic required', variant: 'destructive' }); return;
    }
    setIsGenerating(true);
    try {
      const response = await apiRequest('/api/education/generate-single-course', {
        method: 'POST',
        body: JSON.stringify({ topic: newCourseTopic, level: newCourseLevel, lessonsCount: parseInt(newCourseLessons) || 8 })
      });
      if (response.success && response.course) {
        const newCourse: Course = {
          id: response.course.id,
          title: response.course.title,
          description: response.course.description,
          level: (response.course.level || newCourseLevel) as any,
          thumbnail: response.course.thumbnail,
          price: response.course.price || '39.99',
          estimatedHours: response.course.estimatedHours || 10,
          objectives: response.course.objectives || [],
          prerequisites: response.course.prerequisites || [],
          skills: response.course.skills || [],
          topics: response.course.topics || [],
          preview: response.course.preview || [],
          fullCurriculum: response.course.fullCurriculum || response.course.preview || [],
        };
        const updated = [newCourse, ...courses];
        setCourses(updated);
        try { localStorage.setItem('ai_courses_cache', JSON.stringify(updated)); } catch { /* */ }
        toast({ title: '🎉 Course Created!', description: `"${newCourse.title}" is ready with AI content and image.` });
        setCreateOpen(false);
        setNewCourseTopic("");
        setSelectedCourse(newCourse);
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create course', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenLesson = async (course: Course, lessonIdx: number) => {
    // Lock paid lessons (allow first lesson as free preview)
    const isPaid = parseFloat(course.price || '0') > 0;
    const isPurchased = purchasedCourses.has(course.id);
    if (isPaid && !isPurchased && lessonIdx > 0) {
      toast({ title: '🔒 Locked', description: 'Purchase this course to access all lessons.', variant: 'destructive' });
      return;
    }
    const curriculum = course.fullCurriculum || course.preview || [];
    const lesson = curriculum[lessonIdx];
    if (!lesson) return;
    setSelectedLessonIdx(lessonIdx);
    setLessonContent(null);
    setIsLoadingLesson(true);
    setQuizMode(false);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setAudioUrl(null);
    setIsGeneratingAudio(false);
    setMusicSampleUrl(null);
    setIsGeneratingMusicSample(false);
    try {
      const response = await apiRequest('/api/education/generate-lesson-content', {
        method: 'POST',
        body: JSON.stringify({ courseTitle: course.title, lessonTitle: lesson.title, lessonIndex: lessonIdx, level: course.level, courseTopics: course.topics })
      });
      if (response.success && response.lesson) setLessonContent(response.lesson);
    } catch {
      toast({ title: 'Error', description: 'Failed to generate lesson content', variant: 'destructive' });
    } finally {
      setIsLoadingLesson(false);
    }
  };

  const handleGenerateIntroVideo = async (course: Course) => {
    setIsGeneratingVideo(true);
    setIntroVideoUrl(null);
    try {
      const response = await apiRequest('/api/education/generate-intro-video', {
        method: 'POST',
        body: JSON.stringify({
          courseTitle: course.title,
          courseLevel: course.level,
          thumbnailUrl: course.thumbnail || null,
        }),
      });
      if (response.success && response.videoUrl) {
        setIntroVideoUrl(response.videoUrl);
        setShowIntroVideo(true);
        toast({ title: '🎬 Intro Video Ready!', description: 'AI instructor video generated with FAL.' });
      } else if (response.success && response.thumbnailUrl) {
        toast({ title: '⚠️ Video unavailable', description: 'Showing course thumbnail instead.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to generate intro video.', variant: 'destructive' });
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleGenerateMusicSample = async (lessonTitle: string, courseTitle: string, musicSamplePrompt?: string | null, musicSampleLyrics?: string | null) => {
    setIsGeneratingMusicSample(true);
    setMusicSampleUrl(null);
    try {
      const response = await apiRequest('/api/education/generate-music-sample', {
        method: 'POST',
        body: JSON.stringify({
          lessonTitle,
          courseTitle,
          stylePrompt: musicSamplePrompt || undefined,
          lyricsPrompt: musicSampleLyrics || undefined,
        }),
      });
      if (response.success && (response.audioUrl || response.audioBase64)) {
        let url = response.audioUrl;
        if (!url && response.audioBase64) {
          const binary = atob(response.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: 'audio/mp3' });
          url = URL.createObjectURL(blob);
        }
        setMusicSampleUrl(url!);
        toast({ title: '🎵 Music Sample Ready!', description: 'AI-generated musical example created with MiniMax Music V2.' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to generate music sample.', variant: 'destructive' });
    } finally {
      setIsGeneratingMusicSample(false);
    }
  };

  const handleGetRecommendations = async () => {
    if (!selectedCourse) return;
    try {
      const quizScores: number[] = [];
      const curriculum = selectedCourse.fullCurriculum || selectedCourse.preview || [];
      curriculum.forEach((_, idx) => {
        try {
          const saved = localStorage.getItem(`quiz_result_${selectedCourse.id}_${idx}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.score !== undefined) quizScores.push(parsed.score);
          }
        } catch { /* ignore */ }
      });
      const response = await apiRequest('/api/education/get-recommendations', {
        method: 'POST',
        body: JSON.stringify({
          completedCourseIds: [...purchasedCourses],
          currentCourseTitle: selectedCourse.title,
          currentLevel: selectedCourse.level,
          quizScores,
        }),
      });
      if (response.success && response.recommendations) {
        setRecommendations(response.recommendations);
      }
    } catch { /* silent */ }
  };

  const handleCompleteLesson = () => {
    if (!selectedCourse || selectedLessonIdx === null) return;
    const key = `${selectedCourse.id}-${selectedLessonIdx}`;
    const wasAlreadyDone = completedLessons.has(key);
    const updated = new Set(completedLessons);
    updated.add(key);
    saveCompletedLessons(updated);
    toast({ title: '✅ Lesson Complete!' });

    // Auto-celebrate certificate when course reaches 100% for the first time
    if (!wasAlreadyDone) {
      const curriculum = selectedCourse.fullCurriculum || selectedCourse.preview || [];
      const totalLessons = curriculum.length;
      if (totalLessons > 0) {
        const doneCount = curriculum.filter((_, i) =>
          updated.has(`${selectedCourse.id}-${i}`)
        ).length;
        if (doneCount === totalLessons && !getEarnedCertificate(selectedCourse.id)) {
          toast({
            title: '🎓 Course Completed!',
            description: 'Your Certificate of Completion is ready.',
          });
          // Slight delay so the lesson-complete toast lands first
          setTimeout(() => setShowCertificate(true), 600);
        }
      }
    }
  };

  const handleBuyCourse = async (course: Course, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsCheckingOut(true);
    try {
      const response = await apiRequest('/api/education/checkout', {
        method: 'POST',
        body: JSON.stringify({
          courseId: course.id,
          courseTitle: course.title,
          price: course.price,
          level: course.level,
          thumbnail: course.thumbnail,
        }),
      });
      if (response.success && response.url) {
        window.location.href = response.url;
      } else {
        toast({ title: 'Error', description: 'Could not create checkout session.', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to start checkout.', variant: 'destructive' });
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleGenerateAudio = async (lesson: { title: string; description: string }, content: string) => {
    setIsGeneratingAudio(true);
    setAudioUrl(null);
    try {
      const plainText = content
        .replace(/```[\s\S]*?```/g, '')
        .replace(/[#*`_\[\]()\->]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 4000);
      const response = await apiRequest('/api/education/generate-audio', {
        method: 'POST',
        body: JSON.stringify({ text: plainText, lessonTitle: lesson.title }),
      });
      if (response.success && response.audioContent) {
        const binary = atob(response.audioContent);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'audio/mp3' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        toast({ title: '🎙️ Audio Ready!', description: `Generated with Google TTS (${response.voice})` });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to generate audio narration.', variant: 'destructive' });
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const filteredCourses = courses.filter((c) => {
    const matchSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchTab = activeTab === "all" || c.level.toLowerCase() === activeTab;
    return matchSearch && matchTab;
  });

  const levelColors: Record<string, string> = {
    Beginner: "bg-green-500/10 text-green-400 border-green-500/20",
    Intermediate: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Advanced: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };

  // Auth guard render
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="bg-zinc-900/50 border-orange-500/20 p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-white/70 mb-6">You need to be logged in to access Education.</p>
          <Button onClick={() => setLocation('/auth')} className="w-full bg-gradient-to-r from-orange-500 to-red-500">Sign In / Sign Up</Button>
        </Card>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // LESSON DETAIL VIEW
  // ═══════════════════════════════════════════════════

  if (selectedCourse && selectedLessonIdx !== null) {
    const curriculum = selectedCourse.fullCurriculum || selectedCourse.preview || [];
    const currentLesson = curriculum[selectedLessonIdx];

    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-6 max-w-5xl">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedLessonIdx(null); setLessonContent(null); }}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Course
            </Button>
            <span className="text-muted-foreground text-sm">Lesson {selectedLessonIdx + 1} of {curriculum.length}</span>
            {!isLoadingLesson && lessonContent && (
              <Button variant="ghost" size="sm" className="ml-auto text-xs text-muted-foreground hover:text-white"
                onClick={() => handleOpenLesson(selectedCourse, selectedLessonIdx)}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" /> Regenerate
              </Button>
            )}
          </div>

          {isLoadingLesson ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="relative">
                <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
                <Sparkles className="w-5 h-5 text-orange-400 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <h3 className="text-xl font-semibold">Generating Masterpiece Lesson...</h3>
              <p className="text-muted-foreground text-sm max-w-md text-center">
                Creating 2000+ words of professional content, exercises, quiz, and music examples for "{currentLesson?.title}"
              </p>
              <div className="flex items-center gap-6 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1"><Brain className="w-3.5 h-3.5 text-orange-400" /> GPT-4o writing</span>
                <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-orange-400" /> FAL generating image</span>
                <span className="flex items-center gap-1"><Music2 className="w-3.5 h-3.5 text-orange-400" /> Music examples ready</span>
              </div>
            </div>
          ) : lessonContent ? (
            <div className="space-y-8">
              {/* Lesson header */}
              <div>
                {lessonContent.image && (
                  <div className="w-full h-48 sm:h-64 rounded-xl overflow-hidden mb-6">
                    <img src={lessonContent.image} alt={currentLesson?.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <Badge className={levelColors[selectedCourse.level] || levelColors.Beginner}>{selectedCourse.level}</Badge>
                <h1 className="text-2xl sm:text-3xl font-bold mt-3">{currentLesson?.title}</h1>
                <p className="text-muted-foreground mt-2">{currentLesson?.description}</p>
              </div>

              {/* Audio Tools Row */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* AI Voice Narration */}
                <Card className="p-5 bg-zinc-900/60 border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2 text-sm">
                      <Volume2 className="w-4 h-4 text-orange-400" /> AI Voice Narration
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => lessonContent && currentLesson && handleGenerateAudio(currentLesson, lessonContent.content || '')}
                      disabled={isGeneratingAudio}
                      className="bg-orange-500 hover:bg-orange-600 h-7 text-xs"
                    >
                      {isGeneratingAudio
                        ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                        : <><Sparkles className="w-3 h-3 mr-1" /> Generate</>}
                    </Button>
                  </div>
                  {audioUrl ? (
                    <audio controls className="w-full mt-1 rounded-lg h-8" src={audioUrl} />
                  ) : (
                    <p className="text-xs text-muted-foreground">Google Journey voice narration of this lesson.</p>
                  )}
                </Card>

                {/* AI Music Sample */}
                <Card className="p-5 bg-zinc-900/60 border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center gap-2 text-sm">
                      <Music2 className="w-4 h-4 text-orange-400" /> Music Example
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => currentLesson && handleGenerateMusicSample(
                        currentLesson.title,
                        selectedCourse?.title || '',
                        lessonContent?.musicSamplePrompt,
                        lessonContent?.musicSampleLyrics,
                      )}
                      disabled={isGeneratingMusicSample}
                      className="bg-purple-600 hover:bg-purple-700 h-7 text-xs"
                    >
                      {isGeneratingMusicSample
                        ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                        : <><PlayCircle className="w-3 h-3 mr-1" /> Generate</>}
                    </Button>
                  </div>
                  {musicSampleUrl ? (
                    <audio controls className="w-full mt-1 rounded-lg h-8" src={musicSampleUrl} />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {lessonContent?.musicSamplePrompt
                        ? `Style: ${lessonContent.musicSamplePrompt.slice(0, 60)}...`
                        : 'AI-generated music example via MiniMax Music V2.'}
                    </p>
                  )}
                </Card>
              </div>

              {/* Key Takeaways */}
              {lessonContent.keyTakeaways && lessonContent.keyTakeaways.length > 0 && (
                <Card className="p-5 bg-orange-500/5 border-orange-500/20">
                  <h3 className="font-semibold flex items-center gap-2 mb-3"><Target className="w-5 h-5 text-orange-400" /> Key Takeaways</h3>
                  <ul className="space-y-2">
                    {lessonContent.keyTakeaways.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" /><span>{t}</span></li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* Content */}
              <Card className="p-6 sm:p-8">
                <div className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-gray-300 prose-strong:text-white prose-li:text-gray-300 prose-code:text-orange-400 prose-code:bg-orange-500/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
                  <div dangerouslySetInnerHTML={{ __html: markdownToHtml(lessonContent.content || '') }} />
                </div>
              </Card>

              {/* Exercises */}
              {lessonContent.exercises && lessonContent.exercises.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 mb-4"><Dumbbell className="w-5 h-5 text-orange-400" /> Practical Exercises</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {lessonContent.exercises.map((ex, i) => (
                      <Card key={i} className="p-4 bg-zinc-900/60 border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm">{ex.title}</h4>
                          <Badge variant="outline" className={ex.difficulty === 'easy' ? 'text-green-400 border-green-500/30' : ex.difficulty === 'medium' ? 'text-yellow-400 border-yellow-500/30' : 'text-red-400 border-red-500/30'}>
                            {ex.difficulty}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{ex.description}</p>
                        {ex.estimatedMinutes && (
                          <div className="flex items-center gap-1 text-[10px] text-orange-400">
                            <Clock className="w-3 h-3" /> {ex.estimatedMinutes} min
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Quiz */}
              {lessonContent.quiz && lessonContent.quiz.length > 0 && (
                <LessonQuiz
                  questions={lessonContent.quiz}
                  courseId={selectedCourse.id}
                  lessonIdx={selectedLessonIdx}
                  lessonTitle={currentLesson?.title ?? ''}
                  onComplete={() => {
                    // Scroll past the quiz after completion
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              )}

              {/* Additional Resources */}
              {lessonContent.additionalResources && lessonContent.additionalResources.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-3"><BookMarked className="w-5 h-5 text-orange-400" /> Additional Resources</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {lessonContent.additionalResources.map((r, i) => {
                      const typeIcons: Record<string, React.ReactNode> = {
                        book: <BookOpen className="w-3.5 h-3.5 text-blue-400" />,
                        video: <Video className="w-3.5 h-3.5 text-purple-400" />,
                        tool: <Zap className="w-3.5 h-3.5 text-yellow-400" />,
                        practice: <Dumbbell className="w-3.5 h-3.5 text-green-400" />,
                      };
                      const icon = typeIcons[r.type || ''] || <Lightbulb className="w-3.5 h-3.5 text-orange-400" />;
                      return (
                        <Card key={i} className="p-3 bg-zinc-900/40 border-white/5">
                          <div className="flex items-center gap-1.5 mb-1">{icon}<h4 className="font-medium text-xs">{r.title}</h4></div>
                          <p className="text-[10px] text-muted-foreground">{r.description}</p>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bottom nav */}
              <div className="flex items-center justify-between pt-6 border-t border-white/10">
                <Button variant="outline" disabled={selectedLessonIdx <= 0} onClick={() => handleOpenLesson(selectedCourse, selectedLessonIdx - 1)}>
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <Button onClick={handleCompleteLesson} className={completedLessons.has(`${selectedCourse.id}-${selectedLessonIdx}`) ? "bg-green-600 hover:bg-green-700" : "bg-orange-500 hover:bg-orange-600"}>
                  <CheckCircle2 className="w-4 h-4 mr-1" /> {completedLessons.has(`${selectedCourse.id}-${selectedLessonIdx}`) ? 'Completed' : 'Mark Complete'}
                </Button>
                <Button variant="outline" disabled={selectedLessonIdx >= curriculum.length - 1} onClick={() => handleOpenLesson(selectedCourse, selectedLessonIdx + 1)}>
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Failed to load lesson content.</p>
              <Button className="mt-4" onClick={() => handleOpenLesson(selectedCourse, selectedLessonIdx)}>Retry</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // COURSE DETAIL VIEW
  // ═══════════════════════════════════════════════════

  if (selectedCourse) {
    const curriculum = selectedCourse.fullCurriculum || selectedCourse.preview || [];
    const completedCount = curriculum.filter((_, i) => completedLessons.has(`${selectedCourse.id}-${i}`)).length;
    const progressPct = curriculum.length > 0 ? Math.round((completedCount / curriculum.length) * 100) : 0;
    const threadCount = getThreadCount(selectedCourse.id);
    const displayName =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
      user?.username ||
      user?.email?.split('@')[0] ||
      'Boostify Learner';

    return (
      <div className="min-h-screen bg-background">
        <Header />

        {/* Hero Banner */}
        <div className="relative w-full h-[28vh] sm:h-[35vh] overflow-hidden">
          {selectedCourse.thumbnail ? (
            <img src={selectedCourse.thumbnail} alt={selectedCourse.title} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-orange-600/30 to-purple-600/30" />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
          <div className="relative z-10 container mx-auto px-4 h-full flex flex-col justify-end pb-8">
            <Button variant="ghost" size="sm" className="absolute top-20 left-4 text-white/70 hover:text-white" onClick={() => setSelectedCourse(null)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> All Courses
            </Button>
            <Badge className={`${levelColors[selectedCourse.level] || ''} w-fit`}>{selectedCourse.level}</Badge>
            <h1 className="text-2xl sm:text-4xl font-bold text-white mt-2">{selectedCourse.title}</h1>
            <p className="text-white/70 mt-2 max-w-2xl text-sm sm:text-base">{selectedCourse.description}</p>
            {selectedCourse.learningOutcome && (
              <div className="mt-2 flex items-start gap-2 max-w-xl">
                <Trophy className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-white/90 text-sm font-medium">{selectedCourse.learningOutcome}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-white/60">
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {selectedCourse.estimatedHours}h</span>
              <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" /> {curriculum.length} lessons</span>
              <span className="flex items-center gap-1"><Star className="w-4 h-4 text-orange-400" /> AI Generated</span>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main — Tabbed: Curriculum / Discussion */}
            <div className="lg:col-span-2 space-y-6">
              {/* Tab switcher */}
              <div className="flex gap-1 p-1 bg-zinc-900/60 border border-white/5 rounded-xl w-fit">
                <button
                  type="button"
                  onClick={() => setCourseTab("curriculum")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    courseTab === "curriculum"
                      ? "bg-orange-500 text-white"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  <BookOpen className="w-4 h-4" /> Curriculum
                </button>
                <button
                  type="button"
                  onClick={() => setCourseTab("discussion")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    courseTab === "discussion"
                      ? "bg-orange-500 text-white"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  <MessageCircle className="w-4 h-4" />
                  Discussion
                  {threadCount > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      courseTab === "discussion" ? "bg-white/20 text-white" : "bg-orange-500/20 text-orange-400"
                    }`}>
                      {threadCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Curriculum tab */}
              {courseTab === "curriculum" && (
                <div className="space-y-8">
              {completedCount > 0 && (
                <Card className="p-4 bg-zinc-900/60 border-white/5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Your Progress</span>
                    <span className="text-sm text-orange-400 font-bold">{progressPct}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{completedCount} of {curriculum.length} lessons completed</p>
                  {progressPct === 100 && curriculum.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-orange-500/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-orange-400" />
                        <div>
                          <p className="text-sm font-semibold text-orange-300">Course Completed!</p>
                          <p className="text-xs text-muted-foreground">Your certificate is ready to download.</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => setShowCertificate(true)}
                        className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 w-full sm:w-auto"
                      >
                        <Award className="w-4 h-4 mr-1.5" /> View Certificate
                      </Button>
                    </div>
                  )}
                </Card>
              )}

              {selectedCourse.objectives && selectedCourse.objectives.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-3"><Target className="w-5 h-5 text-orange-400" /> What You'll Learn</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {selectedCourse.objectives.map((obj, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-zinc-900/40 border border-white/5">
                        <CheckCircle2 className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" /><span className="text-sm">{obj}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Curriculum */}
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><BookOpen className="w-5 h-5 text-orange-400" /> Course Curriculum</h3>
                {parseFloat(selectedCourse.price || '0') > 0 && !purchasedCourses.has(selectedCourse.id) && (
                  <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm text-orange-400">
                    <Lock className="w-4 h-4 flex-shrink-0" /> Lesson 1 is a free preview. Purchase the course to unlock all lessons.
                  </div>
                )}
                <div className="space-y-2">
                  {curriculum.map((lesson, idx) => {
                    const isDone = completedLessons.has(`${selectedCourse.id}-${idx}`);
                    const isPaid = parseFloat(selectedCourse.price || '0') > 0;
                    const isPurchased = purchasedCourses.has(selectedCourse.id);
                    const isLocked = isPaid && !isPurchased && idx > 0;
                    return (
                      <button key={idx} onClick={() => handleOpenLesson(selectedCourse, idx)}
                        className={`w-full text-left p-4 rounded-xl border transition-all group ${
                          isLocked
                            ? 'bg-zinc-900/20 border-white/5 cursor-not-allowed opacity-60'
                            : isDone ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40' : 'bg-zinc-900/40 border-white/5 hover:border-orange-500/30 hover:bg-orange-500/5'
                        }`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${isLocked ? 'bg-white/5 text-white/30' : isDone ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>
                            {isLocked ? <Lock className="w-3.5 h-3.5" /> : isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className={`font-medium text-sm transition-colors truncate ${isLocked ? 'text-white/40' : 'group-hover:text-orange-400'}`}>{lesson.title}</h4>
                              {lesson.type && !isLocked && (
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                  lesson.type === 'project' ? 'bg-purple-500/20 text-purple-400' :
                                  lesson.type === 'lab' ? 'bg-green-500/20 text-green-400' :
                                  lesson.type === 'quiz' ? 'bg-yellow-500/20 text-yellow-400' :
                                  lesson.type === 'workshop' ? 'bg-blue-500/20 text-blue-400' :
                                  'bg-zinc-700 text-zinc-400'
                                }`}>{lesson.type}</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{lesson.description}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {lesson.duration && <span className="text-xs text-muted-foreground">{lesson.duration}</span>}
                            {!isLocked && <QuizScoreBadge courseId={selectedCourse.id} lessonIdx={idx} />}
                            {!isLocked && <Play className="w-4 h-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              </div>
              )} {/* end curriculum tab */}

              {/* Discussion tab */}
              {courseTab === "discussion" && (
                <CourseDiscussions
                  courseId={selectedCourse.id}
                  courseTitle={selectedCourse.title}
                  userId={user?.id?.toString() ?? "guest"}
                  userName={displayName}
                />
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card className="p-5 bg-zinc-900/60 border-white/5 sticky top-24">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold text-orange-400">
                    {parseFloat(selectedCourse.price || '0') === 0 ? 'Free' : `$${parseFloat(selectedCourse.price).toFixed(2)}`}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {parseFloat(selectedCourse.price || '0') === 0 ? 'No payment required' : 'One-time payment — lifetime access'}
                  </p>
                </div>
                {parseFloat(selectedCourse.price || '0') > 0 && !purchasedCourses.has(selectedCourse.id) ? (
                  <Button
                    className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 mb-3"
                    onClick={() => handleBuyCourse(selectedCourse)}
                    disabled={isCheckingOut}
                  >
                    {isCheckingOut
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                      : <><ShoppingCart className="w-4 h-4 mr-2" /> Buy for ${parseFloat(selectedCourse.price).toFixed(2)}</>}
                  </Button>
                ) : (
                  <Button className="w-full bg-orange-500 hover:bg-orange-600 mb-3" onClick={() => handleOpenLesson(selectedCourse, 0)}>
                    <Play className="w-4 h-4 mr-2" />
                    {purchasedCourses.has(selectedCourse.id) ? 'Access Course' : 'Start Learning'}
                  </Button>
                )}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 text-sm"><BookOpen className="w-4 h-4 text-muted-foreground" /><span>{curriculum.length} lessons</span></div>
                  <div className="flex items-center gap-2 text-sm"><Clock className="w-4 h-4 text-muted-foreground" /><span>{selectedCourse.estimatedHours} hours</span></div>
                  <div className="flex items-center gap-2 text-sm">
                    <Award className={`w-4 h-4 ${progressPct === 100 ? 'text-orange-400' : 'text-muted-foreground'}`} />
                    {progressPct === 100 ? (
                      <button
                        type="button"
                        onClick={() => setShowCertificate(true)}
                        className="text-orange-400 hover:text-orange-300 font-medium underline-offset-2 hover:underline transition-colors"
                      >
                        View your certificate
                      </button>
                    ) : (
                      <span>Certificate on completion</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm"><Sparkles className="w-4 h-4 text-muted-foreground" /><span>AI-generated with OpenAI</span></div>
                <div className="flex items-center gap-2 text-sm"><Music2 className="w-4 h-4 text-muted-foreground" /><span>Music samples with MiniMax V2</span></div>
                </div>
                {selectedCourse.skills && selectedCourse.skills.length > 0 && (
                  <div className="pt-4 border-t border-white/10 mt-4">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Skills You'll Gain</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCourse.skills.map((s, i) => <Badge key={i} variant="outline" className="text-xs border-orange-500/20 text-orange-400">{s}</Badge>)}
                    </div>
                  </div>
                )}
                {selectedCourse.prerequisites && selectedCourse.prerequisites.length > 0 && (
                  <div className="pt-4 border-t border-white/10 mt-4">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Prerequisites</h4>
                    <ul className="space-y-1">
                      {selectedCourse.prerequisites.map((p, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5"><ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" /> {p}</li>)}
                    </ul>
                  </div>
                )}
              </Card>

              {/* Intro Video Card */}
              <Card className="p-5 bg-zinc-900/60 border-white/5">
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                  <Video className="w-3.5 h-3.5 text-orange-400" /> Course Introduction
                </h4>
                {showIntroVideo && introVideoUrl ? (
                  <div className="rounded-lg overflow-hidden">
                    <video controls autoPlay className="w-full rounded-lg" src={introVideoUrl} />
                  </div>
                ) : selectedCourse.thumbnail ? (
                  <div className="relative rounded-lg overflow-hidden group cursor-pointer"
                    onClick={() => introVideoUrl ? setShowIntroVideo(true) : handleGenerateIntroVideo(selectedCourse)}>
                    <img src={selectedCourse.thumbnail} alt={selectedCourse.title} className="w-full h-32 object-cover" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                      {isGeneratingVideo
                        ? <Loader2 className="w-8 h-8 text-white animate-spin" />
                        : <PlayCircle className="w-10 h-10 text-white/90" />}
                    </div>
                    {!isGeneratingVideo && (
                      <div className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-white/80 font-medium">
                        {introVideoUrl ? 'Watch Intro' : 'Generate AI Intro Video'}
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleGenerateIntroVideo(selectedCourse)}
                    disabled={isGeneratingVideo}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-xs h-8"
                  >
                    {isGeneratingVideo
                      ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating Video...</>
                      : <><Video className="w-3 h-3 mr-1" /> Generate AI Intro</>}
                  </Button>
                )}
                {selectedCourse.learningOutcome && (
                  <p className="text-xs text-muted-foreground mt-2 italic">"{selectedCourse.learningOutcome}"</p>
                )}
              </Card>

              {/* Adaptive Recommendations */}
              {recommendations && (
                <Card className="p-5 bg-gradient-to-br from-orange-500/5 to-purple-500/5 border-orange-500/10">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5 text-orange-400" /> AI Learning Coach
                  </h4>
                  <p className="text-sm text-orange-200 mb-3 italic">"{recommendations.motivationalMessage}"</p>
                  {recommendations.weeklyGoal && (
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 mb-3">
                      <div className="text-[10px] font-bold text-orange-400 uppercase mb-0.5">Weekly Goal</div>
                      <p className="text-xs text-white">{recommendations.weeklyGoal}</p>
                    </div>
                  )}
                  {recommendations.nextTopics && recommendations.nextTopics.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5">Recommended Next</div>
                      <div className="space-y-1">
                        {recommendations.nextTopics.slice(0, 3).map((t, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-zinc-300">
                            <ChevronRight className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" /> {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Quiz Progress Card */}
              {(() => {
                const passedCount = countPassedQuizzes(selectedCourse.id, curriculum.length);
                if (passedCount === 0) return null;
                return (
                  <Card className="p-5 bg-zinc-900/60 border-white/5">
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                      <HelpCircle className="w-3.5 h-3.5" /> Quiz Scores
                    </h4>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Quizzes passed</span>
                      <span className="text-sm font-bold text-orange-400">{passedCount} / {curriculum.length}</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all"
                        style={{ width: `${curriculum.length > 0 ? Math.round((passedCount / curriculum.length) * 100) : 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Pass {Math.round((passedCount / curriculum.length) * 100)}% of quizzes — keep going!
                    </p>
                  </Card>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Certificate Dialog */}
        <CourseCertificate
          open={showCertificate}
          onOpenChange={setShowCertificate}
          courseId={selectedCourse.id}
          courseTitle={selectedCourse.title}
          courseLevel={selectedCourse.level}
          estimatedHours={selectedCourse.estimatedHours}
          userName={displayName}
        />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // COURSE LISTING (MAIN VIEW)
  // ═══════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-500/10 via-background to-purple-500/10 border-b border-white/5">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="container mx-auto px-4 py-12 sm:py-16 relative">
          <div className="max-w-3xl mx-auto text-center space-y-5">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-medium text-orange-400">AI Music Academy — Powered by GPT-4o + FAL AI</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-red-400 to-orange-400">
              Master Your Craft
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Masterpiece AI-generated courses with 2000+ word lessons, music samples, AI intro videos, voice narration, adaptive quizzes and completion certificates.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button size="lg" className="gap-2 bg-orange-500 hover:bg-orange-600" onClick={() => setCreateOpen(true)}>
                <Sparkles className="w-5 h-5" /> Create AI Course
              </Button>
              <Button size="lg" variant="outline" className="gap-2 border-white/20" onClick={() => {
                localStorage.removeItem('ai_courses_cache');
                setCourses([]);
                loadCourses();
              }}>
                <Zap className="w-5 h-5" /> Regenerate All
              </Button>
              {courses.some(c => !c.thumbnail) && (
                <Button size="lg" variant="outline" className="gap-2 border-orange-500/40 text-orange-400 hover:bg-orange-500/10" onClick={handleFillMissingImages} disabled={isFillingImages}>
                  {isFillingImages ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                  {isFillingImages ? 'Generating…' : `Fill ${courses.filter(c => !c.thumbnail).length} Images`}
                </Button>
              )}
            </div>
            <div className="flex justify-center flex-wrap gap-6 pt-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4 text-orange-400" /><strong className="text-white">{courses.length}</strong> courses</span>
              <span className="flex items-center gap-1.5"><Brain className="w-4 h-4 text-orange-400" /><strong className="text-white">GPT-4o</strong> lessons</span>
              <span className="flex items-center gap-1.5"><Music2 className="w-4 h-4 text-orange-400" /><strong className="text-white">MiniMax</strong> music samples</span>
              <span className="flex items-center gap-1.5"><Video className="w-4 h-4 text-orange-400" /><strong className="text-white">Grok</strong> intro videos</span>
              <span className="flex items-center gap-1.5"><Award className="w-4 h-4 text-orange-400" /><strong className="text-white">Certificates</strong> on completion</span>
            </div>
          </div>
        </div>
      </div>

      {/* Course Grid */}
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <Input placeholder="Search courses..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-2xl bg-zinc-900/50 border border-white/5">
            <TabsTrigger value="all">All Courses</TabsTrigger>
            <TabsTrigger value="beginner">Beginner</TabsTrigger>
            <TabsTrigger value="intermediate">Intermediate</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-6">
            {isLoading ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="overflow-hidden animate-pulse bg-zinc-900/40 border-white/5 rounded-2xl">
                    <div className="h-48 bg-zinc-800" />
                    <div className="p-6 space-y-3">
                      <div className="h-5 bg-zinc-800 rounded w-3/4" />
                      <div className="h-4 bg-zinc-800 rounded w-full" />
                      <div className="h-4 bg-zinc-800 rounded w-1/2" />
                      <div className="h-10 bg-zinc-800 rounded w-full mt-4" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredCourses.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No courses found</h3>
                <p className="text-muted-foreground mb-6">Try adjusting your search or create a new course</p>
                <Button onClick={() => setCreateOpen(true)} className="bg-orange-500 hover:bg-orange-600"><Sparkles className="w-4 h-4 mr-2" /> Create AI Course</Button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course) => {
                  const cur = course.fullCurriculum || course.preview || [];
                  const done = cur.filter((_, i) => completedLessons.has(`${course.id}-${i}`)).length;
                  const pct = cur.length > 0 ? Math.round((done / cur.length) * 100) : 0;

                  return (
                    <Card key={course.id} onClick={() => setSelectedCourse(course)}
                      className="overflow-hidden bg-zinc-900/60 border-white/5 hover:border-orange-500/30 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10 cursor-pointer group flex flex-col">
                      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-orange-500/10 to-purple-500/10">
                        {course.thumbnail ? (
                          <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-16 h-16 text-orange-500/20" /></div>
                        )}
                        <Badge className="absolute top-3 left-3 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs"><Sparkles className="w-3 h-3 mr-1" /> AI Generated</Badge>
                        <Badge className={`absolute top-3 right-3 ${levelColors[course.level] || ''} text-xs`}>{course.level}</Badge>
                        {parseFloat(course.price || '0') > 0 && !purchasedCourses.has(course.id) && (
                          <div className="absolute bottom-3 right-3 bg-black/70 rounded-full p-1">
                            <Lock className="w-4 h-4 text-white/70" />
                          </div>
                        )}
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="text-base font-bold group-hover:text-orange-400 transition-colors line-clamp-2 mb-2">{course.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{course.description}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                          <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {cur.length} lessons</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {course.estimatedHours}h</span>
                        </div>
                        {done > 0 && (
                          <div className="mb-3">
                            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden"><div className="h-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${pct}%` }} /></div>
                            <span className="text-[10px] text-muted-foreground">{pct}% complete</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-3 border-t border-white/5">
                          <span className="text-lg font-bold text-orange-400">
                            {parseFloat(course.price || '0') === 0 ? 'Free' : `$${parseFloat(course.price).toFixed(2)}`}
                          </span>
                          {parseFloat(course.price || '0') > 0 && !purchasedCourses.has(course.id) ? (
                            <Button
                              size="sm"
                              onClick={(e) => handleBuyCourse(course, e)}
                              disabled={isCheckingOut}
                              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-xs h-8"
                            >
                              {isCheckingOut ? <Loader2 className="w-3 h-3 animate-spin" /> : <><ShoppingCart className="w-3 h-3 mr-1" /> Buy Now</>}
                            </Button>
                          ) : (
                            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-xs h-8">
                              {done > 0 ? 'Continue' : 'Start'} <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Course Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-orange-400" /> Create AI Course</DialogTitle>
            <DialogDescription>Generate a complete professional course with OpenAI — including content, images, exercises, and quizzes.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Course Topic *</Label>
              <Input placeholder="e.g., Music Production Fundamentals, Jazz Piano..." value={newCourseTopic} onChange={(e) => setNewCourseTopic(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={newCourseLevel} onValueChange={setNewCourseLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lessons</Label>
                <Input type="number" min="3" max="20" value={newCourseLessons} onChange={(e) => setNewCourseLessons(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isGenerating}>Cancel</Button>
            <Button onClick={handleCreateCourse} disabled={isGenerating} className="gap-2 bg-orange-500 hover:bg-orange-600">
              {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Course</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
