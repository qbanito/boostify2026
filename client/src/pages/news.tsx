import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { Header } from "../components/layout/header";
import { Head } from "../components/ui/head";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Newspaper, Clock, Eye, Heart, Share2, ArrowRight,
  Sparkles, ChevronLeft, ChevronRight, Zap,
  Bot, Cpu, Globe, Rocket, Shield, Users,
  Facebook, Twitter, Linkedin, MessageCircle, Link2, Instagram,
  BookOpen, TrendingUp, Music, Pencil, RefreshCw, ImageIcon, Loader2, Save, X
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../hooks/use-auth";
import { NewsInteractions } from "../components/news/news-interactions";

// ── Types ──────────────────────────────────────────────
interface NewsArticle {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  htmlContent?: string;
  coverImageUrl: string | null;
  category: string | null;
  tags: string[] | null;
  readTimeMinutes: number | null;
  publishedAt: string | null;
  views: number | null;
  likes: number | null;
  shares: number | null;
}

interface ArticlesResponse {
  success: boolean;
  articles: NewsArticle[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface SingleArticleResponse {
  success: boolean;
  article: NewsArticle;
  related: NewsArticle[];
}

// ── Constants ──────────────────────────────────────────
const AUTHOR = {
  name: "Neiver Alvarez",
  role: "CEO & Founder",
  company: "Boostify Music",
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: any; accent: string; bg: string }> = {
  "technology":         { label: "Technology",         icon: Cpu,      accent: "text-blue-500",    bg: "bg-blue-500/10" },
  "innovation":         { label: "Innovation",         icon: Sparkles, accent: "text-purple-500",  bg: "bg-purple-500/10" },
  "autonomous-artists": { label: "Autonomous Artists", icon: Bot,      accent: "text-orange-500",  bg: "bg-orange-500/10" },
  "web3":               { label: "Web3 & Blockchain",  icon: Shield,   accent: "text-emerald-500", bg: "bg-emerald-500/10" },
  "ai-music":           { label: "AI Music",           icon: Zap,      accent: "text-amber-500",   bg: "bg-amber-500/10" },
  "platform-updates":   { label: "Platform Updates",   icon: Rocket,   accent: "text-indigo-500",  bg: "bg-indigo-500/10" },
  "industry-vision":    { label: "Industry Vision",    icon: Globe,    accent: "text-rose-500",    bg: "bg-rose-500/10" },
  "partnerships":       { label: "Partnerships",       icon: Users,    accent: "text-violet-500",  bg: "bg-violet-500/10" },
  "artist-news":        { label: "Artist News",         icon: Music,    accent: "text-pink-500",    bg: "bg-pink-500/10" },
};

// ── Helpers ──────────────────────────────────────────────
function getArticleUrl(slug: string) {
  const base = typeof window !== "undefined" ? window.location.origin : "https://boostifymusic.com";
  return `${base}/news?article=${slug}`;
}

function getOgImageUrl(articleId: number) {
  const base = typeof window !== "undefined" ? window.location.origin : "https://boostifymusic.com";
  return `${base}/api/news/articles/${articleId}/image`;
}

// ── Social Share Menu ──────────────────────────────────
function SocialShareMenu({ title, summary, slug, onShare, variant = "ghost" }: {
  title: string;
  summary?: string | null;
  slug: string;
  onShare?: () => void;
  variant?: "ghost" | "outline";
}) {
  const { toast } = useToast();
  const url = getArticleUrl(slug);
  const text = `${title} \u2014 by ${AUTHOR.name}, ${AUTHOR.role} at ${AUTHOR.company}`;

  const share = (platform: string, shareUrl: string) => {
    window.open(shareUrl, "_blank", "width=600,height=500,noopener,noreferrer");
    onShare?.();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="icon" className="rounded-full h-9 w-9">
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => share("facebook", `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}>
          <Facebook className="h-4 w-4 mr-2 text-[#1877F2]" /> Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => share("twitter", `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`)}>
          <Twitter className="h-4 w-4 mr-2" /> X (Twitter)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => share("linkedin", `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`)}>
          <Linkedin className="h-4 w-4 mr-2 text-[#0A66C2]" /> LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => share("whatsapp", `https://wa.me/?text=${encodeURIComponent(title + "\n\n" + url)}`)}>
          <MessageCircle className="h-4 w-4 mr-2 text-[#25D366]" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => {
          navigator.clipboard.writeText(url);
          toast({ title: "Link copied to clipboard!" });
          onShare?.();
        }}>
          <Link2 className="h-4 w-4 mr-2" /> Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Author Signature ──────────────────────────────────
function AuthorSignature({ publishedAt, compact = false }: { publishedAt?: string | null; compact?: boolean }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <img src="/images/founder.webp" alt={AUTHOR.name} className="h-6 w-6 rounded-full object-cover ring-1 ring-orange-500/30" />
        <span className="text-xs text-muted-foreground">
          {AUTHOR.name}
          {publishedAt && (
            <> &middot; {formatDistanceToNow(new Date(publishedAt), { addSuffix: true })}</>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <img src="/images/founder.webp" alt={AUTHOR.name} className="h-10 w-10 rounded-full object-cover shadow-lg shadow-orange-500/20 ring-2 ring-orange-500/30" />
      <div>
        <p className="font-semibold text-sm">{AUTHOR.name}</p>
        <p className="text-xs text-muted-foreground">
          {publishedAt && format(new Date(publishedAt), "MMMM d, yyyy")}
        </p>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════
// ── Article List View ─────────────────────────────────
// ═══════════════════════════════════════════════════════
function ArticleListView({ onArticleClick }: { onArticleClick: (slug: string) => void }) {
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ArticlesResponse>({
    queryKey: ["boostify-news", page, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "12" });
      if (selectedCategory) params.set("category", selectedCategory);
      const res = await fetch(`/api/news/articles?${params}`);
      return res.json();
    },
    staleTime: 60000,
  });

  const articles = data?.articles || [];
  const pagination = data?.pagination;

  return (
    <>
      {/* ── Hero Banner with Image ─────────────── */}
      <div className="relative -mx-4 sm:-mx-6 lg:-mx-8 mb-10 overflow-hidden rounded-2xl sm:rounded-3xl">
        <div className="relative min-h-[280px] sm:min-h-[320px] md:min-h-[380px]">
          {/* Background image */}
          <img
            src="/images/AI_influencer_hero_image_0af5142f.png"
            alt="Boostify News"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-black/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

          <div className="relative flex flex-col justify-end h-full min-h-[280px] sm:min-h-[320px] md:min-h-[380px] p-5 sm:p-8 md:p-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 backdrop-blur-sm text-orange-300 text-[11px] font-semibold tracking-wider uppercase mb-3 w-fit border border-orange-500/20">
              <Zap className="h-3 w-3" />
              AI-Powered Insights
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-2 sm:mb-3 drop-shadow-lg leading-[1.1]">
              Boostify News
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-white/70 max-w-xl leading-relaxed">
              Perspectives on AI, autonomous music, and the future of creative technology.
            </p>
            <div className="flex items-center gap-4 sm:gap-6 mt-4 sm:mt-6 flex-wrap">
              <div className="flex items-center gap-1.5 text-white/50 text-xs sm:text-sm">
                <Bot className="h-3.5 w-3.5" />
                <span>AI Generated</span>
              </div>
              <div className="h-3 w-px bg-white/20" />
              <div className="flex items-center gap-1.5 text-white/50 text-xs sm:text-sm">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Industry Insights</span>
              </div>
              <div className="hidden sm:block h-3 w-px bg-white/20" />
              <div className="hidden sm:flex items-center gap-1.5 text-white/50 text-xs sm:text-sm">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Fresh Daily</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Filters ─────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-1.5 sm:gap-2 mb-10">
        <button
          className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 truncate ${
            !selectedCategory
              ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          onClick={() => { setSelectedCategory(null); setPage(1); }}
        >
          <Newspaper className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
          <span className="truncate">All</span>
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          const isActive = selectedCategory === key;
          return (
            <button
              key={key}
              className={`flex items-center justify-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 truncate ${
                isActive
                  ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              onClick={() => {
                setSelectedCategory(isActive ? null : key);
                setPage(1);
              }}
            >
              <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              <span className="truncate">{config.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Featured Article (large card) ──────────── */}
      {!isLoading && articles.length > 0 && page === 1 && (
        <Card
          className="group cursor-pointer mb-10 overflow-hidden border-0 shadow-xl hover:shadow-2xl transition-all duration-300"
          onClick={() => onArticleClick(articles[0].slug)}
        >
          <div className="grid md:grid-cols-2 gap-0">
            {/* Image */}
            <div className="relative aspect-[16/10] md:aspect-auto overflow-hidden bg-muted">
              {articles[0].coverImageUrl ? (
                <img
                  src={articles[0].coverImageUrl}
                  alt={articles[0].title}
                  className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700 ease-out"
                />
              ) : (
                <div className="w-full h-full min-h-[300px] bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
                  <Newspaper className="h-16 w-16 text-white/50" />
                </div>
              )}
              {articles[0].category && CATEGORY_CONFIG[articles[0].category] && (
                <div className="absolute top-4 left-4">
                  <Badge className="bg-black/60 backdrop-blur-sm text-white border-0 shadow-lg">
                    {CATEGORY_CONFIG[articles[0].category].label}
                  </Badge>
                </div>
              )}
            </div>

            {/* Content */}
            <CardContent className="flex flex-col justify-center p-6 md:p-10">
              <div className="inline-flex items-center gap-2 text-orange-500 text-xs font-bold uppercase tracking-widest mb-4">
                <Sparkles className="h-3.5 w-3.5" />
                Featured Article
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3 leading-tight group-hover:text-orange-500 transition-colors">
                {articles[0].title}
              </h2>
              {articles[0].summary && (
                <p className="text-muted-foreground leading-relaxed mb-6 line-clamp-3">
                  {articles[0].summary}
                </p>
              )}
              <div className="flex items-center justify-between mt-auto">
                <AuthorSignature publishedAt={articles[0].publishedAt} />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    {articles[0].readTimeMinutes || 5} min
                  </span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <SocialShareMenu
                      title={articles[0].title}
                      summary={articles[0].summary}
                      slug={articles[0].slug}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {/* ── Articles Grid (Cards) ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[16/10] w-full" />
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center gap-2 pt-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          (page === 1 ? articles.slice(1) : articles).map((article) => {
            const catConfig = article.category ? CATEGORY_CONFIG[article.category] : null;
            return (
              <Card
                key={article.id}
                className="group cursor-pointer overflow-hidden border hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                onClick={() => onArticleClick(article.slug)}
              >
                {/* Thumbnail */}
                <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                  {article.coverImageUrl ? (
                    <img
                      src={article.coverImageUrl}
                      alt={article.title}
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-400 to-amber-300 flex items-center justify-center">
                      <Newspaper className="h-10 w-10 text-white/40" />
                    </div>
                  )}
                  {catConfig && (
                    <div className="absolute top-3 left-3">
                      <Badge className={`${catConfig.bg} ${catConfig.accent} border-0 text-xs font-semibold`}>
                        {catConfig.label}
                      </Badge>
                    </div>
                  )}
                  <div
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <SocialShareMenu
                      title={article.title}
                      summary={article.summary}
                      slug={article.slug}
                      variant="outline"
                    />
                  </div>
                </div>

                {/* Card Body */}
                <CardContent className="p-5">
                  <h3 className="font-bold text-lg leading-snug mb-2 group-hover:text-orange-500 transition-colors duration-200 line-clamp-2">
                    {article.title}
                  </h3>
                  {article.summary && (
                    <p className="text-muted-foreground text-sm leading-relaxed mb-4 line-clamp-2">
                      {article.summary}
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <AuthorSignature publishedAt={article.publishedAt} compact />
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {article.readTimeMinutes || 5} min
                      </span>
                      {(article.likes || 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3 text-red-400" />
                          {article.likes}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ── Empty State ──────────────────────────────── */}
      {!isLoading && articles.length === 0 && (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-orange-500/10 mb-6">
            <Newspaper className="h-8 w-8 text-orange-500" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No articles yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            The first AI-generated article will appear here soon.
          </p>
        </div>
      )}

      {/* ── Pagination ───────────────────────────────── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-8 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-4">
            Page {page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
            disabled={page === pagination.totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </>
  );
}


// ═══════════════════════════════════════════════════════
// ── Article Detail View ───────────────────────────────
// ═══════════════════════════════════════════════════════
function ArticleDetailView({ slug, onBack }: { slug: string; onBack: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<NewsArticle>>({});

  const { data, isLoading } = useQuery<SingleArticleResponse>({
    queryKey: ["boostify-news-article", slug],
    queryFn: async () => {
      const res = await fetch(`/api/news/articles/${slug}`);
      if (!res.ok) throw new Error("Article not found");
      return res.json();
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/news/articles/${id}/like`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boostify-news-article", slug] });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/news/articles/${id}/share`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["boostify-news-article", slug] });
    },
  });

  // ── Admin: full edit ──
  const editMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<NewsArticle> }) => {
      const res = await fetch(`/api/news/articles/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Update failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Article updated" });
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["boostify-news-article", slug] });
      queryClient.invalidateQueries({ queryKey: ["boostify-news-articles"] });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e?.message, variant: "destructive" }),
  });

  // ── Admin: regenerate cover image ──
  const regenImageMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/news/articles/${id}/regenerate-image`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Regenerate image failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cover image regenerated" });
      queryClient.invalidateQueries({ queryKey: ["boostify-news-article", slug] });
    },
    onError: (e: any) => toast({ title: "Image regen failed", description: e?.message, variant: "destructive" }),
  });

  // ── Admin: regenerate full content (artist articles only) ──
  const regenContentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/news/articles/${id}/regenerate-content`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Regenerate failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Article content regenerated" });
      queryClient.invalidateQueries({ queryKey: ["boostify-news-article", slug] });
    },
    onError: (e: any) => toast({ title: "Regenerate failed", description: e?.message, variant: "destructive" }),
  });

  const article = data?.article;
  const related = data?.related || [];
  const articleRef = useRef<HTMLElement>(null);

  // Entrance animation
  useEffect(() => {
    if (article && articleRef.current) {
      articleRef.current.style.opacity = '0';
      articleRef.current.style.transform = 'translateY(24px)';
      requestAnimationFrame(() => {
        if (articleRef.current) {
          articleRef.current.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
          articleRef.current.style.opacity = '1';
          articleRef.current.style.transform = 'translateY(0)';
        }
      });
    }
  }, [article]);

  // Process HTML content: remove broken images, enhance headings
  const processedContent = (() => {
    if (!article?.htmlContent) return '';
    let html = article.htmlContent;
    // Remove img tags that have base64 src or empty src (broken images)
    html = html.replace(/<img[^>]*src=["'](?:data:image\/[^;]*;base64,[^"']*|)["'][^>]*\/?>/gi, '');
    // Remove empty img tags
    html = html.replace(/<img[^>]*src=["']["'][^>]*\/?>/gi, '');
    return html;
  })();

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pt-8 animate-pulse">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-6 w-2/3" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <div className="space-y-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" style={{ opacity: 1 - i * 0.08 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-24 max-w-md mx-auto">
        <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-orange-500/10 mb-6">
          <Newspaper className="h-8 w-8 text-orange-500" />
        </div>
        <h3 className="text-2xl font-bold mb-3">Article not found</h3>
        <p className="text-muted-foreground mb-6">This article may have been removed or is no longer available.</p>
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" /> Back to News
        </Button>
      </div>
    );
  }

  const catConfig = article.category ? CATEGORY_CONFIG[article.category] : null;
  const articleUrl = getArticleUrl(slug);
  const ogImageUrl = getOgImageUrl(article.id);

  return (
    <>
      {/* Dynamic OG Meta Tags */}
      <Head
        title={`${article.title} \u2014 ${AUTHOR.name} | Boostify News`}
        description={article.summary || article.subtitle || article.title}
        image={ogImageUrl}
        url={articleUrl}
        type="article"
      />

      {/* Scoped styles for article content */}
      <style>{`
        .article-body h2 {
          position: relative;
          background: linear-gradient(135deg, #f97316 0%, #f59e0b 50%, #f97316 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          padding-bottom: 1rem;
          margin-top: 3.5rem;
          margin-bottom: 1.75rem;
          letter-spacing: -0.02em;
        }
        .article-body h2::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 80px;
          height: 3px;
          background: linear-gradient(90deg, #f97316, #fbbf24, transparent);
          border-radius: 2px;
        }
        .article-body h3 {
          background: linear-gradient(135deg, hsl(var(--foreground)) 20%, #f97316 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-top: 2.75rem;
          margin-bottom: 1.25rem;
          letter-spacing: -0.01em;
        }
        .article-body h4 {
          color: #f97316;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        .article-body strong {
          color: #f97316 !important;
          -webkit-text-fill-color: #f97316;
          font-weight: 700;
        }
        .article-body > p:first-of-type {
          font-size: 1.25rem;
          line-height: 2;
          color: hsl(var(--foreground));
          font-weight: 500;
          margin-bottom: 2rem;
        }
        .article-body > p:first-of-type::first-letter {
          font-size: 4rem;
          font-weight: 800;
          float: left;
          line-height: 0.8;
          margin-right: 0.6rem;
          margin-top: 0.15rem;
          padding-right: 0.1rem;
          background: linear-gradient(135deg, #f97316, #fbbf24);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .article-body p {
          margin-bottom: 1.75rem;
          line-height: 2;
        }
        .article-body ul, .article-body ol {
          margin-top: 1.5rem;
          margin-bottom: 2rem;
          padding-left: 1.75rem;
        }
        .article-body li {
          margin-bottom: 0.75rem;
          padding-left: 0.5rem;
        }
        .article-body li::marker {
          color: #f97316;
        }
        .article-body blockquote {
          border-left: 4px solid #f97316;
          background: linear-gradient(90deg, rgba(249,115,22,0.06) 0%, transparent 100%);
          padding: 1.5rem 2rem;
          margin: 2.5rem 0;
          border-radius: 0 1rem 1rem 0;
          font-style: normal;
          font-weight: 500;
          font-size: 1.125rem;
          line-height: 1.8;
        }
        .article-body blockquote p {
          margin-bottom: 0;
          color: hsl(var(--foreground)) !important;
          -webkit-text-fill-color: hsl(var(--foreground));
        }
        .article-body a {
          color: #f97316;
          font-weight: 600;
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }
        .article-body a:hover {
          border-bottom-color: #f97316;
        }
        .article-body hr {
          border: none;
          height: 1px;
          background: linear-gradient(90deg, transparent, #f97316, transparent);
          margin: 3rem 0;
          opacity: 0.3;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .article-fade-in > * {
          animation: fadeInUp 0.5s ease-out both;
        }
        .article-fade-in > *:nth-child(1) { animation-delay: 0.05s; }
        .article-fade-in > *:nth-child(2) { animation-delay: 0.1s; }
        .article-fade-in > *:nth-child(3) { animation-delay: 0.15s; }
        .article-fade-in > *:nth-child(4) { animation-delay: 0.2s; }
        .article-fade-in > *:nth-child(5) { animation-delay: 0.25s; }
        .article-fade-in > *:nth-child(n+6) { animation-delay: 0.3s; }
        .article-body img { display: none !important; }
      `}</style>

      <article ref={articleRef} className="max-w-4xl mx-auto">
        {/* ── Back nav ────────────────────────────── */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-orange-500 transition-all duration-200 mb-8 group"
        >
          <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" />
          Back to News
        </button>

        {/* ── Admin Toolbar ───────────────────────── */}
        {isAdmin && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/5 p-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">Admin</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditForm({
                  title: article.title,
                  subtitle: article.subtitle,
                  summary: article.summary,
                  htmlContent: article.htmlContent,
                  category: article.category,
                  tags: article.tags,
                });
                setEditMode(true);
              }}
            >
              <Pencil className="mr-1 h-3 w-3" /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={regenImageMutation.isPending}
              onClick={() => regenImageMutation.mutate(article.id)}
            >
              {regenImageMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <ImageIcon className="mr-1 h-3 w-3" />
              )}
              Regenerate Image
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={regenContentMutation.isPending}
              onClick={() => regenContentMutation.mutate(article.id)}
            >
              {regenContentMutation.isPending ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3 w-3" />
              )}
              Regenerate Content
            </Button>
            <a
              href={`/api/news/share/${article.slug}`}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-xs text-orange-400 hover:underline"
            >
              Open share page →
            </a>
          </div>
        )}

        {/* ── Edit Dialog (admin) ─────────────────── */}
        {isAdmin && editMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setEditMode(false)}>
            <div
              className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold">Edit article</h2>
                <button onClick={() => setEditMode(false)} className="text-zinc-400 hover:text-zinc-200">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs uppercase text-zinc-500">Title</label>
                  <input
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    value={editForm.title || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-zinc-500">Subtitle</label>
                  <input
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    value={editForm.subtitle || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, subtitle: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-zinc-500">Summary</label>
                  <textarea
                    rows={2}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                    value={editForm.summary || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-zinc-500">HTML Content</label>
                  <textarea
                    rows={16}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs"
                    value={editForm.htmlContent || ""}
                    onChange={(e) => setEditForm((f) => ({ ...f, htmlContent: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs uppercase text-zinc-500">Category</label>
                    <input
                      className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                      value={editForm.category || ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value as any }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase text-zinc-500">Tags (comma-separated)</label>
                    <input
                      className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm"
                      value={(editForm.tags || []).join(", ")}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }))
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setEditMode(false)}>Cancel</Button>
                <Button
                  disabled={editMutation.isPending}
                  onClick={() => editMutation.mutate({ id: article.id, patch: editForm })}
                  className="bg-orange-500 text-black hover:bg-orange-400"
                >
                  {editMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Gradient Title Header ─────────────────── */}
        <div className="relative overflow-hidden rounded-3xl mb-10">
          {/* Background gradient with animated decorative orbs */}
          <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-12 sm:py-16 md:py-20 px-6 sm:px-10 md:px-14">
            {/* Animated orbs */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-orange-400/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />
            </div>
            {/* Grid pattern */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Ccircle cx='20' cy='20' r='1'/%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />

            <div className="relative">
              {catConfig && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm mb-5">
                  {(() => { const Icon = catConfig.icon; return <Icon className="h-3.5 w-3.5 text-orange-400" />; })()}
                  <span className="text-xs font-semibold text-orange-300 tracking-wider uppercase">{catConfig.label}</span>
                </div>
              )}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-[1.15] mb-4 max-w-3xl">
                {article.title}
              </h1>
              {article.subtitle && (
                <p className="text-lg sm:text-xl text-white/60 max-w-2xl leading-relaxed">
                  {article.subtitle}
                </p>
              )}
              {/* Meta row */}
              <div className="flex items-center gap-4 mt-8 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <img src="/images/founder.webp" alt={AUTHOR.name} className="h-8 w-8 rounded-full object-cover ring-2 ring-orange-500/40" />
                  <div>
                    <p className="text-white text-sm font-semibold">{AUTHOR.name}</p>
                    <p className="text-white/40 text-xs">{AUTHOR.role}</p>
                  </div>
                </div>
                <div className="h-5 w-px bg-white/20" />
                <span className="text-white/50 text-sm flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {article.publishedAt && format(new Date(article.publishedAt), "MMM d, yyyy")}
                </span>
                <span className="text-white/50 text-sm flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" />
                  {article.readTimeMinutes || 5} min read
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Cover Image (below header, if exists) ─── */}
        {article.coverImageUrl && (
          <div className="relative rounded-2xl overflow-hidden mb-12 shadow-2xl shadow-black/10 ring-1 ring-white/10">
            <img
              src={article.coverImageUrl}
              alt={article.title}
              className="w-full aspect-[21/9] object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* ── Actions Bar (floating style) ────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-12 py-4 px-6 rounded-2xl bg-muted/30 border border-border/50">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              {article.views || 0} views
            </span>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 hover:text-red-500 rounded-full"
              onClick={() => likeMutation.mutate(article.id)}
            >
              <Heart className={`h-4 w-4 transition-all ${(article.likes || 0) > 0 ? "fill-red-500 text-red-500 scale-110" : ""}`} />
              {article.likes || 0}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <SocialShareMenu
              title={article.title}
              summary={article.summary}
              slug={article.slug}
              onShare={() => shareMutation.mutate(article.id)}
            />
          </div>
        </div>

        {/* ── Article Body ────────────────────────── */}
        <div
          className="article-body article-fade-in prose prose-lg dark:prose-invert max-w-none mb-16
            prose-headings:font-extrabold prose-headings:tracking-tight
            prose-h2:text-2xl prose-h2:sm:text-3xl
            prose-h3:text-xl prose-h3:sm:text-2xl
            prose-h4:text-lg prose-h4:font-bold
            prose-p:text-muted-foreground prose-p:leading-[2] prose-p:text-[17px]
            prose-strong:font-bold
            prose-li:text-muted-foreground prose-li:leading-relaxed prose-li:text-[16.5px]
            prose-a:transition-colors
            prose-code:bg-muted prose-code:px-2 prose-code:py-1 prose-code:rounded-lg prose-code:text-sm prose-code:font-mono
            prose-pre:bg-muted prose-pre:rounded-2xl prose-pre:border prose-pre:shadow-sm"
          dangerouslySetInnerHTML={{ __html: processedContent }}
        />

        {/* ── Decorative divider ──────────────────── */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-orange-500/50" />
          <Sparkles className="h-5 w-5 text-orange-500/50" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-orange-500/50" />
        </div>

        {/* ── Author Sign-off Card ────────────────── */}
        <Card className="mb-12 overflow-hidden border-0 shadow-xl">
          <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-amber-500 p-[1px] rounded-xl">
            <div className="bg-background rounded-xl p-8">
              <div className="flex items-center gap-5">
                <img src="/images/founder.webp" alt={AUTHOR.name} className="h-16 w-16 rounded-full object-cover shrink-0 shadow-lg shadow-orange-500/20 ring-2 ring-orange-500/30" />
                <div>
                  <p className="font-bold text-lg">{AUTHOR.name}</p>
                  <p className="text-orange-500 text-sm font-medium mb-2">{AUTHOR.role}, {AUTHOR.company}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-xl">
                    Building the future of autonomous music. Boostify empowers artists with AI-powered tools
                    for creation, distribution, and growth &mdash; no labels, no limits.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Tags ────────────────────────────────── */}
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-12">
            {article.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center px-3 py-1.5 rounded-full bg-muted/60 text-xs font-medium text-muted-foreground hover:bg-orange-500/10 hover:text-orange-500 transition-colors cursor-default">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* ── Share Bar ──────────────────────────── */}
        <div className="mb-16 py-6 px-8 rounded-2xl bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-orange-500/5 border border-orange-500/10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-sm mb-0.5">Enjoyed this article?</p>
              <p className="text-xs text-muted-foreground">Share it with your network</p>
            </div>
            <div className="flex items-center gap-2">
              {[
                { icon: Facebook, color: "hover:text-[#1877F2] hover:bg-[#1877F2]/10", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}` },
                { icon: Twitter, color: "hover:text-foreground hover:bg-foreground/10", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title + " \u2014 " + AUTHOR.name)}&url=${encodeURIComponent(articleUrl)}` },
                { icon: Linkedin, color: "hover:text-[#0A66C2] hover:bg-[#0A66C2]/10", url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}` },
                { icon: MessageCircle, color: "hover:text-[#25D366] hover:bg-[#25D366]/10", url: `https://wa.me/?text=${encodeURIComponent(article.title + "\n\n" + articleUrl)}` },
              ].map((s, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  size="icon"
                  className={`rounded-full h-10 w-10 text-muted-foreground transition-all duration-200 ${s.color}`}
                  onClick={() => {
                    window.open(s.url, "_blank", "width=600,height=500");
                    shareMutation.mutate(article.id);
                  }}
                >
                  <s.icon className="h-4 w-4" />
                </Button>
              ))}
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-10 w-10 text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10 transition-all duration-200"
                onClick={() => {
                  navigator.clipboard.writeText(articleUrl);
                  toast({ title: "Link copied!" });
                }}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ── News Interactions: Reactions, Comments & Debates ── */}
        <div className="mb-16">
          <NewsInteractions articleId={article.id} />
        </div>

        {/* ── Related Articles ───────────────────── */}
        {related.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="h-8 w-1 rounded-full bg-gradient-to-b from-orange-500 to-amber-400" />
              <h3 className="text-2xl font-bold tracking-tight">Related Articles</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((rel) => (
                <Card
                  key={rel.id}
                  className="group cursor-pointer overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-border/50"
                  onClick={onBack}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                    {rel.coverImageUrl ? (
                      <img
                        src={rel.coverImageUrl}
                        alt={rel.title}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center">
                        <Newspaper className="h-8 w-8 text-white/40" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm group-hover:text-orange-500 transition-colors line-clamp-2 mb-2">
                      {rel.title}
                    </h4>
                    <AuthorSignature publishedAt={rel.publishedAt} compact />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </article>
    </>
  );
}


// ═══════════════════════════════════════════════════════
// ── Main News Page ────────────────────────────────────
// ═══════════════════════════════════════════════════════
export default function NewsPage() {
  const [viewingSlug, setViewingSlug] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("article");
    if (slug) setViewingSlug(slug);
  }, []);

  const navigateToArticle = useCallback((slug: string) => {
    setViewingSlug(slug);
    window.history.pushState({}, "", `/news?article=${slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const navigateToList = useCallback(() => {
    setViewingSlug(null);
    window.history.pushState({}, "", "/news");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const handler = () => {
      const params = new URLSearchParams(window.location.search);
      setViewingSlug(params.get("article"));
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewingSlug ? (
          <ArticleDetailView slug={viewingSlug} onBack={navigateToList} />
        ) : (
          <ArticleListView onArticleClick={navigateToArticle} />
        )}
      </main>
    </div>
  );
}
