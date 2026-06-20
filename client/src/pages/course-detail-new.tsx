import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Header } from "../components/layout/header";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Progress } from "../components/ui/progress";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  BookOpen, Lock, CheckCircle2, PlayCircle, Clock, 
  Award, Sparkles, ChevronLeft, Loader2, GraduationCap,
  ChevronRight, Star, Users, Target, Download, Trophy,
  Crown, Video, FileText, Zap, ArrowRight, Play,
  Volume2, ImageIcon, Headphones
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { QuizDialog } from "../components/education/quiz-dialog";
import { getCourseBySlug, getTotalDuration, LEARNING_PATHS, type AcademyCourse } from "@/lib/academy-courses";

// ─── Minimal markdown → HTML (lesson content rendering) ────
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

// Deterministic gradient placeholder (data URI) so a lesson never shows a
// broken image if media generation is temporarily unavailable.
function lessonGradientFallback(seed: string): string {
  let h = 0;
  for (let i = 0; i < (seed || 'lesson').length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const c1 = `hsl(${h}, 70%, 22%)`;
  const c2 = `hsl(${(h + 60) % 360}, 75%, 38%)`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='450'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='800' height='450' fill='url(#g)'/><circle cx='650' cy='90' r='120' fill='rgba(255,255,255,0.06)'/><circle cx='120' cy='380' r='90' fill='rgba(255,255,255,0.05)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// ─── Full lesson narration player ──────────────────────────
function LessonAudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  const fmt = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
  };

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setCurrent(a.currentTime);
          setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrent(0); }}
      />
      <Button size="icon" className="h-10 w-10 rounded-full flex-shrink-0" onClick={toggle}>
        {playing ? <Volume2 className="w-5 h-5 animate-pulse" /> : <Play className="w-5 h-5" />}
      </Button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Headphones className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">AI Narration</span>
        </div>
        <div
          className="h-1.5 rounded-full bg-muted overflow-hidden cursor-pointer"
          onClick={(e) => {
            const a = audioRef.current;
            if (!a || !a.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            a.currentTime = pct * a.duration;
          }}
        >
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
        {fmt(current)} / {fmt(duration)}
      </span>
    </div>
  );
}

// ─── Generating-in-progress animation ──────────────────────
function LessonGeneratingState() {
  const steps = [
    { icon: FileText, label: 'Writing lesson content' },
    { icon: ImageIcon, label: 'Creating illustration' },
    { icon: Headphones, label: 'Recording narration' },
    { icon: Award, label: 'Building quiz' },
  ];
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-6 space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="font-semibold text-sm">Generating your lesson dynamically…</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {steps.map(({ icon: Icon, label }, i) => (
          <div
            key={label}
            className="flex items-center gap-2 text-xs text-muted-foreground rounded-md bg-muted/40 p-2.5"
            style={{ animation: `pulse 1.5s ease-in-out ${i * 0.3}s infinite` }}
          >
            <Icon className="w-4 h-4 text-primary flex-shrink-0" />
            {label}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        This may take up to a minute the first time — text, image and audio are created just for you.
      </p>
    </div>
  );
}

// ─── Lesson type icon ──────────────────────────────────────
function LessonTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'video': return <Video className="w-4 h-4" />;
    case 'interactive': return <Zap className="w-4 h-4" />;
    case 'text': return <FileText className="w-4 h-4" />;
    default: return <BookOpen className="w-4 h-4" />;
  }
}

// ─── Sidebar Stats Card ────────────────────────────────────
function CourseStatsCard({ 
  course, enrollment, progressPercentage, completedLessons, totalLessons,
  onEnroll, enrolling
}: { 
  course: AcademyCourse | any;
  enrollment: any;
  progressPercentage: number;
  completedLessons: number;
  totalLessons: number;
  onEnroll: () => void;
  enrolling: boolean;
}) {
  const isAcademy = 'slug' in course;
  const price = isAcademy ? course.price : parseFloat(course.price || '0');
  const lessonCount = isAcademy ? course.lessons.length : (course.lessonsCount || totalLessons);
  const duration = isAcademy ? getTotalDuration(course) : (course.duration || 'Self-paced');
  const level = course.level;

  return (
    <Card className="p-6 sticky top-4 space-y-5 border-white/10">
      {/* Price */}
      <div className="text-center">
        <div className="text-4xl font-bold mb-1">
          {price === 0 ? (
            <span className="text-green-400">Free</span>
          ) : (
            <span className="text-primary">${price}</span>
          )}
        </div>
        {price > 0 && (
          <p className="text-xs text-muted-foreground">One-time purchase • Lifetime access</p>
        )}
      </div>

      {/* Enroll / Continue */}
      {enrollment ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-400 justify-center">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Enrolled</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-bold text-primary">{progressPercentage.toFixed(0)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {completedLessons} of {totalLessons} lessons completed
            </p>
          </div>
          {progressPercentage === 100 && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-center">
              <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
              <p className="text-sm font-semibold text-green-400">Course Completed!</p>
              <p className="text-xs text-muted-foreground">Certificate available</p>
            </div>
          )}
        </div>
      ) : (
        <Button 
          className="w-full gap-2 h-12 text-base"
          onClick={onEnroll}
          disabled={enrolling}
        >
          {enrolling ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Enrolling...</>
          ) : (
            <><PlayCircle className="w-5 h-5" />{price === 0 ? 'Enroll Free' : 'Enroll Now'}</>
          )}
        </Button>
      )}

      {/* Info */}
      <div className="space-y-3 pt-3 border-t border-white/5">
        {[
          { icon: BookOpen, label: 'Lessons', value: String(lessonCount) },
          { icon: Clock, label: 'Duration', value: duration },
          { icon: GraduationCap, label: 'Level', value: level },
          { icon: Trophy, label: 'Certificate', value: 'Included' },
          { icon: Download, label: 'Access', value: 'Lifetime' },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Icon className="w-4 h-4" />{label}
            </span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Derive learning topics from lesson title + description ─
function getLessonTopics(title: string, description: string): string[] {
  const combined = `${title}. ${description}`;
  // Extract actionable topics from the description
  const topics: string[] = [];
  
  // Split by commas and "and" to find sub-topics
  const parts = description
    .replace(/\.$/, '')
    .split(/,\s*(?:and\s+)?|\s+and\s+/)
    .map(p => p.trim())
    .filter(p => p.length > 10);
  
  if (parts.length >= 2) {
    return parts.slice(0, 4).map(p => {
      // Capitalize first letter
      return p.charAt(0).toUpperCase() + p.slice(1);
    });
  }
  
  // Fallback: generate from keywords
  topics.push(`Understand ${title.toLowerCase()}`);
  if (description.length > 20) {
    topics.push(`Practice the concepts covered in this lesson`);
  }
  topics.push('Apply what you learn to your own projects');
  return topics;
}

// ─── MAIN COMPONENT ────────────────────────────────────────
export default function CourseDetailPage() {
  const [, params] = useRoute("/course/:id");
  const courseId = params?.id;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [expandedLesson, setExpandedLesson] = useState<number | null>(null);
  // Dynamically-generated lesson content cache (keyed by DB lesson id)
  const [lessonContents, setLessonContents] = useState<Record<number, any>>({});
  const [generatingLessonId, setGeneratingLessonId] = useState<number | null>(null);
  const [lessonErrors, setLessonErrors] = useState<Record<number, string>>({});

  // Check if this is an academy slug or a DB id
  const academyCourse = useMemo(() => getCourseBySlug(courseId || ''), [courseId]);
  const isDbCourse = !academyCourse && courseId;

  // DB course queries (only if not academy course)
  const { data: dbCourseData, isLoading: dbLoading } = useQuery({
    queryKey: [`/api/education/courses/${courseId}`],
    enabled: !!isDbCourse,
  });

  // Enrollment status — works for both academy (slug) and DB (numeric) courses
  const { data: enrollment } = useQuery({
    queryKey: [`/api/education/enrollment/${courseId}`],
    enabled: !!courseId,
  });

  // DB lessons for this course (also resolves slugs on server)
  const { data: dbLessons = [] } = useQuery({
    queryKey: [`/api/education/course-lessons/${courseId}`],
    enabled: !!courseId,
  });

  // Lesson progress
  const { data: progress = [] } = useQuery({
    queryKey: [`/api/education/progress/${courseId}`],
    enabled: !!courseId && !!enrollment,
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (academyCourse) {
        // Academy course — use slug-based enrollment that auto-creates DB entry
        return apiRequest({
          url: `/api/education/enroll-academy/${academyCourse.slug}`,
          method: "POST",
          data: {
            title: academyCourse.title,
            description: academyCourse.description,
            level: academyCourse.level,
            category: academyCourse.category,
            price: academyCourse.price,
            lessonsCount: academyCourse.lessons.length,
            lessonTitles: academyCourse.lessons.map(l => l.title),
            lessonDescriptions: academyCourse.lessons.map(l => l.description || ''),
            lessonDurations: academyCourse.lessons.map(l => l.duration || 15),
          },
        });
      }
      return apiRequest({
        url: `/api/education/enroll/${courseId}`,
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({ title: "🎉 Successfully Enrolled!", description: "You can now start learning" });
      queryClient.invalidateQueries({ queryKey: [`/api/education/enrollment/${courseId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/education/progress/${courseId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/education/course-lessons/${courseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/education/my-courses"] });
    },
    onError: (error: any) => {
      toast({ title: "Enrollment Failed", description: error.message, variant: "destructive" });
    },
  });

  const completeLessonMutation = useMutation({
    mutationFn: async (lessonId: number) => {
      return apiRequest({ url: `/api/education/lessons/${lessonId}/complete`, method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/education/progress/${courseId}`] });
      toast({ title: "Lesson Complete! ✅", description: "Great progress — keep going!" });
    },
  });

  // ─── Dynamic lesson generation: fetch (and generate on first open) ──
  const loadLessonContent = async (lessonId: number) => {
    if (!lessonId || lessonContents[lessonId] || generatingLessonId === lessonId) return;
    setGeneratingLessonId(lessonId);
    setLessonErrors((prev) => { const n = { ...prev }; delete n[lessonId]; return n; });
    try {
      const res = await apiRequest({ url: `/api/education/lessons/${lessonId}`, method: "GET" });
      const lesson = res?.lesson || res;
      if (lesson) {
        setLessonContents((prev) => ({ ...prev, [lessonId]: lesson }));
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to load lesson";
      setLessonErrors((prev) => ({ ...prev, [lessonId]: msg }));
    } finally {
      setGeneratingLessonId((cur) => (cur === lessonId ? null : cur));
    }
  };

  // Loading state
  if (isDbCourse && dbLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Resolve course data
  const courseData = academyCourse || (dbCourseData as any)?.course || dbCourseData;
  if (!courseData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Course not found</h2>
          <p className="text-muted-foreground mb-6">This course may have been removed or the URL is incorrect.</p>
          <Button onClick={() => navigate("/education")} className="gap-2">
            <ChevronLeft className="w-4 h-4" />
            Back to Academy
          </Button>
        </div>
      </div>
    );
  }

  // Resolve lesson data — merge academy hardcoded data with DB lessons (for real IDs)
  const dbLessonsList = (dbLessons as any[]) || [];
  const lessons = academyCourse 
    ? academyCourse.lessons.map((l, i) => {
        // If enrolled, merge with DB lesson to get real ID for progress tracking
        const dbLesson = dbLessonsList[i];
        return { 
          id: dbLesson?.id ?? null, // Real DB ID or null if not enrolled yet
          orderIndex: i, 
          ...l,
          content: dbLesson?.content || l.description,
        };
      })
    : ((dbCourseData as any)?.lessons || dbLessonsList) as any[];
  
  const progressData = (progress as any[]) || [];
  const completedLessons = progressData.filter((p: any) => p.completed).length;
  const totalLessons = lessons.length;
  const progressPercentage = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  const isLessonUnlocked = (lesson: any, index: number) => {
    if (!enrollment) return index === 0; // Show first lesson preview
    // First lesson always unlocked for enrolled users
    if (index === 0) return true;
    // Sequential: previous must be completed
    return progressData.some((p: any) => p.lessonIndex === index - 1 && p.completed);
  };

  const isLessonCompleted = (lesson: any, index: number) => {
    return progressData.some((p: any) => p.lessonIndex === index && p.completed);
  };

  const title = academyCourse ? academyCourse.title : courseData.title;
  const description = academyCourse ? academyCourse.description : courseData.description;
  const level = academyCourse ? academyCourse.level : courseData.level;
  const category = academyCourse ? academyCourse.category : (courseData.category || 'General');
  const objectives = academyCourse ? academyCourse.objectives : [];
  const tags = academyCourse ? academyCourse.tags : [];
  const instructor = academyCourse ? academyCourse.instructor : 'AI Instructor';
  const isOfficial = academyCourse?.isBoostifyOfficial || false;
  const learningPath = academyCourse?.learningPath;
  const pathInfo = learningPath ? LEARNING_PATHS.find(p => p.id === learningPath) : null;
  const thumbnail = (() => {
    // DB course thumbnail
    if (!academyCourse) return courseData.thumbnail || null;
    // Academy course: check localStorage cache (v2 = Nano Banana coherent), then the static value
    try {
      const cached = localStorage.getItem('boostify_course_thumbnails_v2');
      if (cached) {
        const map = JSON.parse(cached);
        if (map[academyCourse.slug]) return map[academyCourse.slug];
      }
    } catch {}
    return academyCourse.thumbnail;
  })();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ─── COURSE HEADER ──────────────────────────────── */}
      <div className="relative border-b overflow-hidden">
        {/* Thumbnail background */}
        {thumbnail && (
          <div className="absolute inset-0">
            <img src={thumbnail} alt="" className="w-full h-full object-cover opacity-15 blur-sm" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background/90 to-orange-500/10" />
        <div className="container mx-auto px-4 py-8 relative">
          <Button 
            variant="ghost" 
            className="mb-6 gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/education")}
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Academy
          </Button>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-5">
              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={
                  level === 'Beginner' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                  level === 'Intermediate' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  'bg-purple-500/10 text-purple-400 border-purple-500/20'
                }>
                  {level}
                </Badge>
                <Badge variant="secondary">{category}</Badge>
                {isOfficial && (
                  <Badge variant="outline" className="gap-1 border-primary/40">
                    <Crown className="w-3 h-3" /> Official
                  </Badge>
                )}
                {!academyCourse && courseData.isAIGenerated && (
                  <Badge variant="outline" className="gap-1 border-orange-500/40">
                    <Sparkles className="w-3 h-3" /> AI Generated
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">{title}</h1>
              <p className="text-lg text-muted-foreground leading-relaxed">{description}</p>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  {totalLessons} lessons
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {academyCourse ? getTotalDuration(academyCourse) : (courseData.duration || 'Self-paced')}
                </span>
                <span className="flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" />
                  {instructor}
                </span>
                {pathInfo && (
                  <span className="flex items-center gap-1.5">
                    <ArrowRight className="w-4 h-4" />
                    {pathInfo.icon} {pathInfo.title} Path
                  </span>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <CourseStatsCard
              course={academyCourse || courseData}
              enrollment={enrollment}
              progressPercentage={progressPercentage}
              completedLessons={completedLessons}
              totalLessons={totalLessons}
              onEnroll={() => enrollMutation.mutate()}
              enrolling={enrollMutation.isPending}
            />
          </div>
        </div>
      </div>

      {/* ─── COURSE CONTENT ─────────────────────────────── */}
      <div className="container mx-auto px-4 py-10">
        <Tabs defaultValue="curriculum" className="space-y-6">
          <TabsList className="h-10">
            <TabsTrigger value="curriculum" className="gap-1.5">
              <BookOpen className="w-4 h-4" /> Curriculum
            </TabsTrigger>
            <TabsTrigger value="about" className="gap-1.5">
              <Target className="w-4 h-4" /> About
            </TabsTrigger>
          </TabsList>

          {/* ─── CURRICULUM TAB ─────────────────────────── */}
          <TabsContent value="curriculum" className="space-y-3">
            {lessons.length === 0 ? (
              <Card className="p-10 text-center">
                <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Lessons will be generated as you progress through the course.
                </p>
              </Card>
            ) : (
              <div className="space-y-2">
                {lessons.map((lesson: any, index: number) => {
                  const unlocked = isLessonUnlocked(lesson, index);
                  const completed = isLessonCompleted(lesson, index);
                  const isExpanded = expandedLesson === index;
                  const lessonType = lesson.type || 'video';
                  const isFree = lesson.isFree || false;

                  return (
                    <Card
                      key={lesson.id ?? index}
                      className={`overflow-hidden transition-all duration-200 ${
                        unlocked ? 'hover:border-primary/30 cursor-pointer' : 'opacity-50'
                      } ${completed ? 'border-green-500/20' : ''} ${isExpanded ? 'border-primary/30' : ''}`}
                      onClick={() => {
                        if (!unlocked) return;
                        const opening = !isExpanded;
                        setExpandedLesson(opening ? index : null);
                        // Trigger dynamic generation on first open (enrolled + real DB id)
                        if (opening && enrollment && lesson.id != null) {
                          loadLessonContent(lesson.id);
                        }
                      }}
                    >
                      <div className="p-4 flex items-center gap-4">
                        {/* Number/Status */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          completed ? 'bg-green-500 text-white' :
                          unlocked ? 'bg-primary/10 text-primary' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {completed ? <CheckCircle2 className="w-5 h-5" /> : String(index + 1).padStart(2, '0')}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-semibold text-sm truncate">{lesson.title}</h3>
                            {isFree && !enrollment && (
                              <Badge className="bg-green-500/10 text-green-400 text-[10px] h-5">Free</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <LessonTypeIcon type={lessonType} />
                              {lessonType === 'video' ? 'Video' : lessonType === 'interactive' ? 'Interactive' : 'Reading'}
                            </span>
                            {lesson.duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {lesson.duration}min
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right icon */}
                        <div className="flex-shrink-0">
                          {!unlocked ? (
                            <Lock className="w-4 h-4 text-muted-foreground" />
                          ) : completed ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          )}
                        </div>
                      </div>

                      {/* Expanded content */}
                      {isExpanded && unlocked && (() => {
                        const generated = lesson.id != null ? lessonContents[lesson.id] : null;
                        const isGenerating = lesson.id != null && generatingLessonId === lesson.id;
                        const loadError = lesson.id != null ? lessonErrors[lesson.id] : null;
                        // Prefer dynamically-generated media, fall back to static lesson data
                        const displayImage = generated?.imageUrl || lesson.imageUrl;
                        const displayVideo = generated?.videoUrl || generated?.materials?.video?.embedUrl || (lesson as any).videoUrl || null;
                        const videoTitle = generated?.materials?.video?.title || null;
                        const displayContent = generated?.content && generated.content.length > 60 ? generated.content : null;
                        const audioUrl = generated?.materials?.audioUrl || generated?.materials?.audioIntroUrl || lesson.materials?.audioIntroUrl;
                        const keyPoints: string[] = generated?.materials?.keyPoints || [];

                        return (
                        <div className="px-4 pb-5 pt-2 pl-[4.5rem] space-y-4 border-t border-white/5">
                          {/* Generating state (dynamic creation) */}
                          {isGenerating && !generated && <LessonGeneratingState />}

                          {/* Generation error with retry */}
                          {loadError && !isGenerating && !generated && (
                            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
                              <p className="text-sm text-destructive">Couldn't generate this lesson. {loadError}</p>
                              <Button size="sm" variant="outline" className="gap-1.5 h-8"
                                onClick={(e) => { e.stopPropagation(); if (lesson.id != null) loadLessonContent(lesson.id); }}>
                                <Sparkles className="w-3.5 h-3.5" /> Retry generation
                              </Button>
                            </div>
                          )}

                          {/* Lesson image (generated or static) */}
                          {displayImage && (
                            <div className="rounded-lg overflow-hidden border border-white/10">
                              <img
                                src={displayImage}
                                alt={lesson.title}
                                className="w-full max-h-72 object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  const img = e.currentTarget;
                                  if (img.dataset.fallback) { img.style.display = 'none'; return; }
                                  img.dataset.fallback = '1';
                                  img.src = lessonGradientFallback(lesson.title);
                                }}
                              />
                            </div>
                          )}

                          {/* Lesson video (embedded YouTube tutorial — free) */}
                          {displayVideo && (
                            <div className="rounded-lg overflow-hidden border border-white/10 bg-black">
                              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                                <iframe
                                  src={displayVideo}
                                  title={videoTitle || lesson.title}
                                  className="absolute inset-0 w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  allowFullScreen
                                  loading="lazy"
                                />
                              </div>
                              {videoTitle && (
                                <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                                  <Video className="w-3.5 h-3.5 text-primary" /> {videoTitle}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Audio narration player (full lesson) */}
                          {audioUrl && <LessonAudioPlayer url={audioUrl} />}

                          {/* Lesson body */}
                          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                            <div className="flex items-center gap-2 text-primary text-sm font-semibold">
                              <BookOpen className="w-4 h-4" />
                              Lesson {index + 1} — {lesson.title}
                            </div>

                            {/* Full generated content (markdown) or fallback description */}
                            {displayContent ? (
                              <div
                                className="prose prose-sm prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1 prose-code:rounded"
                                dangerouslySetInnerHTML={{ __html: markdownToHtml(displayContent) }}
                              />
                            ) : (
                              <p className="text-sm leading-relaxed">{lesson.description}</p>
                            )}

                            {/* Key takeaways (from generated content) */}
                            {keyPoints.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-white/5">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Key takeaways:</span>
                                <ul className="space-y-1.5">
                                  {keyPoints.map((topic, ti) => (
                                    <li key={ti} className="flex items-start gap-2 text-sm text-muted-foreground">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                                      {topic}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Heuristic practice points (academy, only when no generated content yet) */}
                            {academyCourse && !displayContent && keyPoints.length === 0 && (
                              <div className="space-y-2 pt-2 border-t border-white/5">
                                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What you'll practice:</span>
                                <ul className="space-y-1.5">
                                  {getLessonTopics(lesson.title, lesson.description).map((topic, ti) => (
                                    <li key={ti} className="flex items-start gap-2 text-sm text-muted-foreground">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                                      {topic}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Lesson type indicator */}
                            <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <LessonTypeIcon type={lessonType} />
                                {lessonType === 'video' ? 'Video Lesson' : lessonType === 'interactive' ? 'Interactive Exercise' : 'Reading Material'}
                              </Badge>
                              {lesson.duration && (
                                <Badge variant="outline" className="gap-1 text-xs">
                                  <Clock className="w-3 h-3" />
                                  {lesson.duration} min
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {!completed && enrollment && lesson.id != null && (
                              <Button
                                size="sm"
                                className="gap-1.5 h-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  completeLessonMutation.mutate(lesson.id);
                                }}
                                disabled={completeLessonMutation.isPending}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Mark Complete
                              </Button>
                            )}
                            {!enrollment && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 h-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  enrollMutation.mutate();
                                }}
                                disabled={enrollMutation.isPending}
                              >
                                <PlayCircle className="w-3.5 h-3.5" />
                                Enroll to Start
                              </Button>
                            )}
                            {lesson.id != null && (generated || !academyCourse) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 h-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLessonId(lesson.id);
                                }}
                              >
                                <Award className="w-3.5 h-3.5" />
                                Take Quiz
                              </Button>
                            )}
                          </div>
                        </div>
                        );
                      })()}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── ABOUT TAB ──────────────────────────────── */}
          <TabsContent value="about" className="space-y-6">
            {/* Objectives */}
            {objectives.length > 0 && (
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  What You'll Learn
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {objectives.map((obj, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{obj}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Course Description */}
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-3">About This Course</h3>
              <p className="text-muted-foreground leading-relaxed">{description}</p>
            </Card>

            {/* Learning Path */}
            {pathInfo && (
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                  {pathInfo.icon} Part of the {pathInfo.title} Path
                </h3>
                <p className="text-sm text-muted-foreground mb-4">{pathInfo.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {pathInfo.courseSlugs.map((slug, i) => {
                    const isCurrentCourse = slug === academyCourse?.slug;
                    return (
                      <div key={slug} className="flex items-center gap-2">
                        {i > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
                        <Badge variant={isCurrentCourse ? "default" : "secondary"} className="text-xs">
                          {isCurrentCourse ? '📍 ' : ''}{slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Instructor */}
            <Card className="p-6">
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-primary" />
                Instructor
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">{instructor}</p>
                  <p className="text-sm text-muted-foreground">{category} Expert</p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Quiz Dialog */}
      {selectedLessonId && (
        <QuizDialog
          lessonId={selectedLessonId}
          courseId={courseId!}
          onClose={() => setSelectedLessonId(null)}
        />
      )}
    </div>
  );
}
