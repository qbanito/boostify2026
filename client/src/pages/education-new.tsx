import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Header } from "../components/layout/header";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { CreateCourseDialog } from "../components/education/create-course-dialog";
import { 
  ALL_ACADEMY_COURSES, LEARNING_PATHS, FEATURED_COURSES,
  getTotalDuration, getCoursesByPath,
  type AcademyCourse, type LearningPath,
} from "../lib/academy-courses";
import { 
  BookOpen, Search, Sparkles, TrendingUp, Filter, 
  GraduationCap, Award, ChevronRight, Clock, Play,
  Star, Users, Zap, Crown, Video, Music, DollarSign,
  ArrowRight, CheckCircle2, Loader2, BarChart3, Trophy,
  Route, Target
} from "lucide-react";

// ─── Stats bar ─────────────────────────────────────────────
function StatsBar() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto -mt-8 relative z-10 px-4">
      {[
        { icon: BookOpen, label: 'Courses', value: `${ALL_ACADEMY_COURSES.length}+`, color: 'text-purple-400' },
        { icon: Video, label: 'Video Lessons', value: '90+', color: 'text-blue-400' },
        { icon: Route, label: 'Learning Paths', value: String(LEARNING_PATHS.length), color: 'text-emerald-400' },
        { icon: Trophy, label: 'Certificates', value: 'Included', color: 'text-yellow-400' },
      ].map(({ icon: Icon, label, value, color }) => (
        <Card key={label} className="p-4 text-center bg-card/80 backdrop-blur border-white/10">
          <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
          <div className="text-lg font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </Card>
      ))}
    </div>
  );
}

// ─── Learning Path Card ────────────────────────────────────
function LearningPathCard({ path }: { path: LearningPath }) {
  const [, navigate] = useLocation();
  const courses = getCoursesByPath(path.id);

  return (
    <Card 
      className="group cursor-pointer overflow-hidden hover:shadow-xl transition-all duration-300 border-white/10"
      onClick={() => navigate(`/education?path=${path.id}`)}
    >
      <div className={`h-2 bg-gradient-to-r ${path.color}`} />
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <span className="text-3xl">{path.icon}</span>
          <Badge variant="outline" className="text-xs">
            {courses.length} courses
          </Badge>
        </div>
        <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
          {path.title}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">{path.description}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {courses.slice(0, 3).map((c, i) => (
            <span key={c.slug} className="flex items-center gap-1">
              {i > 0 && <ArrowRight className="w-3 h-3" />}
              <span className="truncate max-w-[80px]">{c.title.split(' ').slice(0, 2).join(' ')}</span>
            </span>
          ))}
          {courses.length > 3 && <span>+{courses.length - 3}</span>}
        </div>
      </div>
    </Card>
  );
}

// ─── Featured Course Banner ────────────────────────────────
function FeaturedCourseBanner({ course }: { course: AcademyCourse }) {
  const [, navigate] = useLocation();

  return (
    <Card 
      className="relative overflow-hidden cursor-pointer group border-primary/30 hover:border-primary/60 transition-all"
      onClick={() => navigate(`/course/${course.slug}`)}
    >
      {course.thumbnail && (
        <div className="absolute inset-0">
          <img src={course.thumbnail} alt="" className="w-full h-full object-cover opacity-10 blur-sm" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-purple-500/10 to-orange-500/20" />
      <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center gap-6">
        <div className="flex-1 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-green-500/90 text-white">
              {course.price === 0 ? '100% Free' : `$${course.price}`}
            </Badge>
            {course.isBoostifyOfficial && (
              <Badge variant="outline" className="gap-1 border-primary/40">
                <Crown className="w-3 h-3" />
                Official
              </Badge>
            )}
            <Badge variant="secondary">{course.level}</Badge>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold group-hover:text-primary transition-colors">
            {course.title}
          </h2>
          <p className="text-muted-foreground max-w-2xl">{course.shortDescription}</p>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              {course.lessons.length} lessons
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {getTotalDuration(course)}
            </span>
            <span className="flex items-center gap-1.5">
              <Target className="w-4 h-4" />
              {course.objectives.length} skills
            </span>
          </div>
          <Button size="lg" className="gap-2 mt-2">
            <Play className="w-4 h-4" />
            {course.price === 0 ? 'Start Free Course' : 'View Course'}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="hidden md:flex flex-col gap-2 min-w-[200px]">
          {course.lessons.slice(0, 4).map((lesson, i) => (
            <div key={i} className="flex items-center gap-2 text-sm bg-background/50 rounded-lg px-3 py-2">
              <span className="text-primary font-mono text-xs">{String(i + 1).padStart(2, '0')}</span>
              <span className="text-muted-foreground truncate">{lesson.title}</span>
            </div>
          ))}
          {course.lessons.length > 4 && (
            <div className="text-xs text-muted-foreground text-center">
              +{course.lessons.length - 4} more lessons
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Course Card ───────────────────────────────────────────
function AcademyCourseCard({ course, enrollment }: { course: AcademyCourse; enrollment?: any }) {
  const [, navigate] = useLocation();
  const levelColors: Record<string, string> = {
    Beginner: "bg-green-500/10 text-green-400 border-green-500/20",
    Intermediate: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Advanced: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  };
  const categoryIcons: Record<string, typeof Music> = {
    'Production': Music,
    'Video Production': Video,
    'Marketing': TrendingUp,
    'Business': DollarSign,
    'Branding': Star,
    'Distribution': BarChart3,
    'Audio Engineering': Music,
    'Visual Effects': Zap,
    'Boostify Platform': Crown,
  };
  const CategoryIcon = categoryIcons[course.category] || BookOpen;

  return (
    <Card 
      className="overflow-hidden group cursor-pointer hover:shadow-xl hover:border-primary/30 transition-all duration-300 flex flex-col h-full"
      onClick={() => navigate(`/course/${course.slug}`)}
    >
      {/* Thumbnail area */}
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        {course.thumbnail ? (
          <img
            src={course.thumbnail}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget;
              if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = courseGradientFallback(course.slug || course.title); }
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <CategoryIcon className="w-16 h-16 text-primary/20" />
          </div>
        )}
        {course.price === 0 && (
          <Badge className="absolute top-3 left-3 bg-green-500 text-white">
            Free
          </Badge>
        )}
        {course.isBoostifyOfficial && (
          <Badge className="absolute top-3 right-3 bg-gradient-to-r from-primary to-orange-500 text-white gap-1">
            <Crown className="w-3 h-3" />
            Official
          </Badge>
        )}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card to-transparent h-16" />
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="outline" className={levelColors[course.level] || levelColors.Beginner}>
            {course.level}
          </Badge>
          <span className="text-xs text-muted-foreground">{course.category}</span>
        </div>

        <h3 className="font-bold text-base mb-2 line-clamp-2 group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        <p className="text-xs text-muted-foreground mb-4 line-clamp-2 flex-1">
          {course.shortDescription}
        </p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />
            {course.lessons.length} lessons
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {getTotalDuration(course)}
          </span>
        </div>

        {/* Enrollment progress */}
        {enrollment && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-semibold text-primary">{enrollment.progress || 0}%</span>
            </div>
            <Progress value={enrollment.progress || 0} className="h-1.5" />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
          <div className="text-lg font-bold">
            {course.price === 0 ? (
              <span className="text-green-400">Free</span>
            ) : (
              <span className="text-primary">${course.price}</span>
            )}
          </div>
          <Button size="sm" variant={enrollment ? "default" : "outline"} className="gap-1 text-xs h-8">
            {enrollment ? 'Continue' : course.price === 0 ? 'Start Free' : 'Enroll'}
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── AI-Generated Course Card (for DB courses) ────────────
function DbCourseCard({ course }: { course: any }) {
  const [, navigate] = useLocation();
  return (
    <Card 
      className="overflow-hidden group cursor-pointer hover:shadow-xl hover:border-primary/30 transition-all flex flex-col h-full"
      onClick={() => navigate(`/course/${course.id}`)}
    >
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-orange-500/10 via-primary/5 to-background">
        {course.thumbnail ? (
          <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { const img = e.currentTarget; if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = courseGradientFallback(course.slug || course.title); } }} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-14 h-14 text-orange-500/20" />
          </div>
        )}
        <Badge className="absolute top-3 left-3 bg-gradient-to-r from-orange-500 to-primary text-white gap-1">
          <Sparkles className="w-3 h-3" />
          AI Generated
        </Badge>
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card to-transparent h-12" />
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <Badge variant="outline" className="w-fit mb-2 text-xs">{course.level}</Badge>
        <h3 className="font-bold text-base mb-1 line-clamp-2 group-hover:text-primary transition-colors">{course.title}</h3>
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2 flex-1">{course.description}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5" />{course.lessonsCount} lessons
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />{course.duration}
          </span>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-auto">
          <span className="text-lg font-bold text-primary">
            {parseFloat(course.price || '0') === 0 ? <span className="text-green-400">Free</span> : `$${parseFloat(course.price).toFixed(0)}`}
          </span>
          <Button size="sm" variant="outline" className="gap-1 text-xs h-8">
            View <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Thumbnail cache key ───────────────────────────────────
const THUMB_CACHE_KEY = 'boostify_course_thumbnails_v2'; // v2: coherent Nano Banana 2 images

// Deterministic gradient placeholder so a card never shows a broken image.
function courseGradientFallback(seed: string): string {
  let h = 0;
  for (let i = 0; i < (seed || 'course').length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const c1 = `hsl(${h}, 70%, 22%)`;
  const c2 = `hsl(${(h + 60) % 360}, 75%, 38%)`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='340'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='600' height='340' fill='url(#g)'/><circle cx='480' cy='70' r='90' fill='rgba(255,255,255,0.06)'/><circle cx='90' cy='290' r='70' fill='rgba(255,255,255,0.05)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function useThumbnails() {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>(() => {
    try {
      const cached = localStorage.getItem(THUMB_CACHE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });
  const [generating, setGenerating] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from the shared DB cache first → thumbnails generated once are
  // reused by every visitor (no per-browser regeneration).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/education/academy-thumbnails');
        if (res.ok) {
          const data = await res.json();
          const dbThumbs: Record<string, string> = data?.thumbnails || {};
          if (!cancelled && Object.keys(dbThumbs).length > 0) {
            setThumbnails(prev => {
              const next = { ...dbThumbs, ...prev };
              try { localStorage.setItem(THUMB_CACHE_KEY, JSON.stringify(next)); } catch {}
              return next;
            });
          }
        }
      } catch {
        // ignore — fall back to local generation
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Check which courses still need thumbnails
  const missing = useMemo(() => {
    return ALL_ACADEMY_COURSES.filter(c => !thumbnails[c.slug]);
  }, [thumbnails]);

  // Auto-generate any still-missing thumbnails in the background (and persist
  // them to the DB cache server-side for the next client).
  useEffect(() => {
    if (!hydrated || missing.length === 0 || generating) return;
    setGenerating(true);

    let cancelled = false;
    const generateNext = async () => {
      for (const course of missing) {
        if (cancelled) break;
        try {
          const res = await fetch('/api/education/generate-thumbnail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: course.title,
              category: course.category,
              slug: course.slug,
              description: course.shortDescription,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.thumbnailUrl) {
              setThumbnails(prev => {
                const next = { ...prev, [course.slug]: data.thumbnailUrl };
                try { localStorage.setItem(THUMB_CACHE_KEY, JSON.stringify(next)); } catch {}
                return next;
              });
            }
          }
        } catch {
          // Silently skip failed thumbnails
        }
        // Gentle throttle to avoid hammering the free image provider
        await new Promise(r => setTimeout(r, 400));
      }
      if (!cancelled) setGenerating(false);
    };

    generateNext();
    return () => { cancelled = true; };
  }, [hydrated, missing.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return { thumbnails, generating };
}

// ─── MAIN PAGE ─────────────────────────────────────────────
export default function EducationPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [activeCategory, setActiveCategory] = useState("all");

  // Generate and cache course thumbnails
  const { thumbnails, generating: thumbnailsGenerating } = useThumbnails();

  // Fetch DB courses (AI-generated)
  const { data: dbCourses, isLoading } = useQuery({
    queryKey: ["/api/education/courses"],
  });

  // Fetch user enrollments
  const { data: myCourses } = useQuery({
    queryKey: ["/api/education/my-courses"],
  });

  // Combine academy catalog + filtering
  const categories = useMemo(() => {
    const cats = new Set(ALL_ACADEMY_COURSES.map(c => c.category));
    return ['all', ...Array.from(cats)];
  }, []);

  const filteredAcademyCourses = useMemo(() => {
    return ALL_ACADEMY_COURSES.filter(course => {
      const matchesSearch = !searchQuery || 
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.tags.some(t => t.includes(searchQuery.toLowerCase()));
      const matchesLevel = activeTab === "all" || course.level.toLowerCase() === activeTab;
      const matchesCategory = activeCategory === "all" || course.category === activeCategory;
      return matchesSearch && matchesLevel && matchesCategory;
    });
  }, [searchQuery, activeTab, activeCategory]);

  const filteredDbCourses = useMemo(() => {
    if (!dbCourses) return [];
    return (dbCourses as any[]).filter((course: any) => {
      const matchesSearch = !searchQuery || 
        course.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLevel = activeTab === "all" || course.level?.toLowerCase() === activeTab;
      return matchesSearch && matchesLevel;
    });
  }, [dbCourses, searchQuery, activeTab]);

  const freeCourse = ALL_ACADEMY_COURSES.find(c => c.price === 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ─── HERO ────────────────────────────────────────── */}
      <div className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-orange-500/10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 py-16 md:py-20 relative">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Boostify Music Academy</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-orange-500 to-primary">
                Master Music
              </span>
              {' '}with AI
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Complete courses on music production, video creation, marketing, and business.
              Learn at your pace with AI-generated content that adapts to your progress.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-2">
              <Button size="lg" className="gap-2 h-12 px-8" onClick={() => {
                const el = document.getElementById('courses-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}>
                <Play className="w-5 h-5" />
                Start Learning Free
              </Button>
              <Button size="lg" variant="outline" className="gap-2 h-12 px-8" onClick={() => setCreateDialogOpen(true)}>
                <Sparkles className="w-5 h-5" />
                Create AI Course
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── STATS ───────────────────────────────────────── */}
      <StatsBar />

      <div className="container mx-auto px-4 pt-16 pb-4">

        {/* ─── FREE COURSE BANNER ────────────────────────── */}
        {freeCourse && (
          <section className="mb-16">
            <div className="flex items-center gap-2 mb-6">
              <Crown className="w-5 h-5 text-yellow-500" />
              <h2 className="text-xl font-bold">Start Here — Free</h2>
            </div>
            <FeaturedCourseBanner course={{ ...freeCourse, thumbnail: thumbnails[freeCourse.slug] || freeCourse.thumbnail }} />
          </section>
        )}

        {/* ─── LEARNING PATHS ────────────────────────────── */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">Learning Paths</h2>
            </div>
            <span className="text-sm text-muted-foreground">Guided course sequences</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {LEARNING_PATHS.map(path => (
              <LearningPathCard key={path.id} path={path} />
            ))}
          </div>
        </section>

        {/* ─── MY LEARNING ───────────────────────────────── */}
        {myCourses && (myCourses as any[]).length > 0 && (
          <section className="mb-16">
            <div className="flex items-center gap-2 mb-6">
              <Award className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">My Learning Journey</h2>
              <Badge className="ml-2">{(myCourses as any[]).length} enrolled</Badge>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {(myCourses as any[]).map((enrollment: any) => {
                const academyCourse = ALL_ACADEMY_COURSES.find(c => c.slug === enrollment.courseSlug);
                if (academyCourse) {
                  return <AcademyCourseCard key={academyCourse.slug} course={{ ...academyCourse, thumbnail: thumbnails[academyCourse.slug] || academyCourse.thumbnail }} enrollment={enrollment} />;
                }
                return <DbCourseCard key={enrollment.id} course={enrollment} />;
              })}
            </div>
          </section>
        )}

        {/* ─── COURSE CATALOG ────────────────────────────── */}
        <section id="courses-section" className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Course Catalog</h2>
          </div>

          {/* Search + Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search courses, topics, skills..."
                className="pl-10 h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map(cat => (
                <Button
                  key={cat}
                  size="sm"
                  variant={activeCategory === cat ? "default" : "outline"}
                  className="whitespace-nowrap text-xs h-10"
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat === 'all' ? 'All Categories' : cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Level tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-4 max-w-xl">
              <TabsTrigger value="all">All Levels</TabsTrigger>
              <TabsTrigger value="beginner">Beginner</TabsTrigger>
              <TabsTrigger value="intermediate">Intermediate</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-10">
              {/* Academy Courses */}
              {filteredAcademyCourses.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Crown className="w-4 h-4 text-yellow-500" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Boostify Academy — {filteredAcademyCourses.length} courses
                    </h3>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredAcademyCourses.map(course => (
                      <AcademyCourseCard 
                        key={course.slug} 
                        course={{ ...course, thumbnail: thumbnails[course.slug] || course.thumbnail }} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* AI-Generated Courses from DB */}
              {filteredDbCourses.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-orange-500" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      AI-Generated Courses — {filteredDbCourses.length} courses
                    </h3>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredDbCourses.map((course: any) => (
                      <DbCourseCard key={course.id} course={course} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {filteredAcademyCourses.length === 0 && filteredDbCourses.length === 0 && (
                <div className="text-center py-20">
                  <BookOpen className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No courses match your filters</h3>
                  <p className="text-muted-foreground mb-6">
                    Try adjusting your search or create a custom AI-powered course
                  </p>
                  <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                    <Sparkles className="w-4 h-4" />
                    Create AI Course
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </section>

        {/* ─── CTA SECTION ───────────────────────────────── */}
        <section className="mb-16">
          <Card className="relative overflow-hidden border-white/10">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-orange-500/10 to-primary/20" />
            <div className="relative p-8 md:p-12 text-center space-y-4">
              <Sparkles className="w-10 h-10 text-primary mx-auto" />
              <h2 className="text-2xl md:text-3xl font-bold">
                Can't find what you need?
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Generate a custom course on any music topic with AI. 
                Lessons, quizzes, and images are created automatically as you learn.
              </p>
              <Button size="lg" className="gap-2" onClick={() => setCreateDialogOpen(true)}>
                <Sparkles className="w-5 h-5" />
                Generate Custom Course
              </Button>
            </div>
          </Card>
        </section>

      </div>

      <CreateCourseDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
