/**
 * Artist News Generator — Generate personalized AI news articles from the artist's master JSON.
 * Reads canonical name, genre, aesthetic, narrative, themes, etc. and pre-fills smart suggestions.
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import {
  Newspaper, Sparkles, Loader2, ChevronDown, ChevronUp,
  Info, ArrowRight, BookOpen, Zap, Tag, RefreshCw, ExternalLink,
  Clock, CheckCircle2, AlertCircle, Pencil, Trash2, X, Save,
} from "lucide-react";
import { format } from "date-fns";

// ── Types ──────────────────────────────────────────────────────
interface ArtistNewsGeneratorProps {
  userId: number;
  artistName: string;
  isOwner: boolean;
  colors: {
    hexAccent: string;
    hexPrimary: string;
    hexBorder: string;
    textMuted: string;
    bgGradient: string;
    shadow: string;
  };
}

interface GeneratedArticle {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  category: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  readTimeMinutes: number | null;
  views: number | null;
  likes: number | null;
}

const CATEGORY_OPTIONS = [
  { value: "artist-news",        label: "🎤 Artist News" },
  { value: "ai-music",           label: "🎵 AI Music" },
  { value: "innovation",         label: "✨ Innovation" },
  { value: "industry-vision",    label: "🌐 Industry Vision" },
  { value: "technology",         label: "💻 Technology" },
  { value: "platform-updates",   label: "🚀 Platform Updates" },
  { value: "partnerships",       label: "🤝 Partnerships" },
  { value: "web3",               label: "🔗 Web3 & Blockchain" },
  { value: "autonomous-artists", label: "🤖 Autonomous Artists" },
];

// ── Component ──────────────────────────────────────────────────
export function ArtistNewsGenerator({ userId, artistName, isOwner, colors }: ArtistNewsGeneratorProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  // Form state
  const [topic, setTopic] = useState("");
  const [angle, setAngle] = useState("");
  const [category, setCategory] = useState("artist-news");
  const [lastResult, setLastResult] = useState<{ articleId?: number; title?: string; error?: string } | null>(null);

  // ── Fetch masterJson ──
  const { data: masterJsonData } = useQuery({
    queryKey: [`/api/artist-generator/${userId}/master-json`],
    enabled: !!userId,
    retry: false,
  });
  const masterJson: any = (masterJsonData as any)?.masterJson || (masterJsonData as any) || null;

  // ── Fetch artist's own articles ──
  const { data: articlesData, isLoading: articlesLoading, refetch: refetchArticles } = useQuery<{
    success: boolean;
    articles: GeneratedArticle[];
    pagination: any;
  }>({
    queryKey: [`/api/news/articles?artistId=${userId}&limit=6`],
    enabled: !!userId && expanded,
    queryFn: async () => {
      const res = await fetch(`/api/news/articles?artistId=${userId}&limit=6`);
      return res.json();
    },
    staleTime: 30000,
  });
  const articles = articlesData?.articles || [];

  // ── Derive context from masterJson ──
  const canonicalName: string = masterJson?.canonical?.artist_name || artistName;
  const genre: string = masterJson?.canonical?.primary_genre || masterJson?.musical_dna?.genre_tags?.[0] || "";
  const aesthetic: string = (masterJson?.visual_dna?.aesthetic_keywords || []).slice(0, 3).join(" · ");
  const currentChapter: string = masterJson?.narrative?.current_chapter || "";
  const lyricThemes: string[] = masterJson?.musical_dna?.lyric_themes?.slice(0, 4) || [];
  const artistGoals: string[] = masterJson?.agent_context?.artist_goals?.slice(0, 3) || [];

  // Smart angle suggestions derived from masterJson
  const suggestions: { topic: string; angle: string; category: string }[] = [
    currentChapter && {
      topic: `${canonicalName} — Artist Story`,
      angle: `${canonicalName}'s current journey: "${currentChapter}" — what it means for their music and fanbase`,
      category: "artist-news",
    },
    genre && lyricThemes.length > 0 && {
      topic: `${canonicalName} — Sound & Vision`,
      angle: `How ${canonicalName}'s ${genre} sound explores ${lyricThemes.slice(0, 2).join(" and ")} in an AI-powered era`,
      category: "ai-music",
    },
    aesthetic && {
      topic: `${canonicalName} — Visual Identity`,
      angle: `The visual world of ${canonicalName}: how "${aesthetic}" aesthetic shapes their brand and audience connection`,
      category: "innovation",
    },
    artistGoals.length > 0 && {
      topic: `${canonicalName} — Vision 2025`,
      angle: `${canonicalName}'s bold goals: ${artistGoals.join(", ")} — and how Boostify's AI makes them achievable`,
      category: "platform-updates",
    },
    genre && {
      topic: `${canonicalName} — Industry Impact`,
      angle: `Why ${canonicalName} represents the new wave of autonomous ${genre} artists redefining the industry`,
      category: "autonomous-artists",
    },
  ].filter(Boolean) as { topic: string; angle: string; category: string }[];

  // ── Generate mutation ──
  const generateMutation = useMutation({
    mutationFn: (data: { userId: number; topic: string; angle: string; category: string }) =>
      apiRequest({ url: "/api/news/generate/artist", method: "POST", data }),
    onSuccess: (data: any) => {
      if (data.success) {
        setLastResult({ articleId: data.articleId, title: data.title });
        refetchArticles();
        queryClient.invalidateQueries({ queryKey: [`/api/news/articles?artistId=${userId}&limit=6`] });
      } else {
        setLastResult({ error: data.error || "Generation failed" });
      }
    },
    onError: (err: any) => setLastResult({ error: err.message || "Generation failed" }),
  });

  // ── Edit / Delete state + mutations ──
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; summary: string; category: string }>({
    title: "",
    summary: "",
    category: "artist-news",
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; title: string; summary: string; category: string }) =>
      apiRequest({
        url: `/api/news/articles/${data.id}`,
        method: "PUT",
        data: { title: data.title, summary: data.summary, category: data.category },
      }),
    onSuccess: () => {
      setEditingId(null);
      refetchArticles();
      queryClient.invalidateQueries({ queryKey: [`/api/news/articles?artistId=${userId}&limit=6`] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest({ url: `/api/news/articles/${id}`, method: "DELETE" }),
    onSuccess: () => {
      refetchArticles();
      queryClient.invalidateQueries({ queryKey: [`/api/news/articles?artistId=${userId}&limit=6`] });
    },
  });

  const handleStartEdit = (article: GeneratedArticle) => {
    setEditingId(article.id);
    setEditForm({
      title: article.title || "",
      summary: article.summary || "",
      category: article.category || "artist-news",
    });
  };

  const handleSaveEdit = () => {
    if (editingId == null) return;
    updateMutation.mutate({ id: editingId, ...editForm });
  };

  const handleDelete = (id: number, title: string) => {
    if (!confirm(`Delete article "${title}"? This cannot be undone.`)) return;
    deleteMutation.mutate(id);
  };

  const handleGenerate = () => {
    setLastResult(null);
    generateMutation.mutate({
      userId,
      topic: topic || suggestions[0]?.topic || `${canonicalName} Feature`,
      angle: angle || suggestions[0]?.angle || `The rise of ${canonicalName}`,
      category,
    });
  };

  const handleUseSuggestion = (s: { topic: string; angle: string; category: string }) => {
    setTopic(s.topic);
    setAngle(s.angle);
    setCategory(s.category);
  };

  // ── Styles ──
  const cardStyles = "rounded-2xl bg-black/40 backdrop-blur-sm p-5 border";
  const inputStyles = "w-full bg-black/40 border rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 resize-none";

  if (!isOwner) return null;

  return (
    <div className={cardStyles} style={{ borderColor: colors.hexBorder }}>
      {/* ── Header ── */}
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: colors.hexAccent + "18", border: `1px solid ${colors.hexAccent}30` }}
          >
            <Newspaper className="h-4 w-4" style={{ color: colors.hexAccent }} />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">AI Artist News</div>
            <div className="text-[11px] text-gray-500">
              {genre && aesthetic ? `${genre} · ${aesthetic}` : "Generate press articles from your profile"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {articles.length > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: colors.hexAccent + "18", color: colors.hexAccent }}
            >
              {articles.length} article{articles.length !== 1 ? "s" : ""}
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </button>

      {!expanded && <div className="h-px mt-4 mb-0" style={{ backgroundColor: colors.hexBorder + "40" }} />}

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="mt-5 space-y-5">
          {/* Artist context card (from masterJson) */}
          {masterJson && (
            <div className="flex items-start gap-2 p-3 rounded-xl border border-blue-500/15 bg-blue-500/5">
              <Info className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-blue-200">Profile loaded from Master JSON</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {canonicalName && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/70">
                      🎤 {canonicalName}
                    </span>
                  )}
                  {genre && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/70">
                      🎵 {genre}
                    </span>
                  )}
                  {aesthetic && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/70">
                      ✨ {aesthetic}
                    </span>
                  )}
                  {currentChapter && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-blue-300/80">
                      📖 {String(currentChapter).slice(0, 40)}{currentChapter.length > 40 ? "…" : ""}
                    </span>
                  )}
                  {lyricThemes.map((t, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                      # {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Smart Suggestions ── */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                <Zap className="h-3 w-3 inline mr-1" style={{ color: colors.hexAccent }} />
                Smart suggestions from your profile
              </p>
              <div className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleUseSuggestion(s)}
                    className="w-full text-left p-2.5 rounded-xl border transition-all hover:scale-[1.01]"
                    style={{
                      borderColor:
                        angle === s.angle ? colors.hexAccent + "40" : colors.hexBorder + "60",
                      backgroundColor: angle === s.angle ? colors.hexAccent + "0a" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <ArrowRight
                        className="h-3 w-3 mt-0.5 flex-shrink-0"
                        style={{ color: angle === s.angle ? colors.hexAccent : "#4b5563" }}
                      />
                      <div>
                        <div className="text-[11px] font-medium text-white/80 line-clamp-1">{s.topic}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{s.angle}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Custom topic/angle form ── */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Or write your own
            </p>

            <div className="space-y-1">
              <label className="text-[11px] text-gray-500">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={`e.g. "${canonicalName} — New Era"`}
                className={inputStyles}
                style={{ borderColor: colors.hexBorder }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-gray-500">Angle / narrative</label>
              <textarea
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                placeholder={
                  currentChapter
                    ? `e.g. How "${currentChapter}" defines ${canonicalName}'s artistic evolution`
                    : `e.g. Why ${canonicalName} represents the future of independent music`
                }
                rows={2}
                className={inputStyles}
                style={{ borderColor: colors.hexBorder }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-gray-500">Category</label>
              <div className="grid grid-cols-3 gap-1">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className="py-1.5 px-2 rounded-xl text-[10px] text-left font-medium transition-all"
                    style={
                      category === cat.value
                        ? {
                            backgroundColor: colors.hexAccent + "18",
                            border: `1px solid ${colors.hexAccent}40`,
                            color: colors.hexAccent,
                          }
                        : {
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(255,255,255,0.06)",
                            color: "#9ca3af",
                          }
                    }
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="w-full py-3 rounded-xl font-semibold text-sm text-black flex items-center justify-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-40"
            style={{ backgroundColor: colors.hexAccent }}
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating article…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate News Article
              </>
            )}
          </button>

          {/* Status feedback */}
          {lastResult?.articleId && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[11px] text-green-300 font-medium">Article published!</p>
                <p className="text-[10px] text-green-400/70 mt-0.5 line-clamp-1">{lastResult.title}</p>
              </div>
              <a
                href={`/news`}
                className="text-[10px] text-green-300 hover:text-green-200 flex items-center gap-0.5"
              >
                View <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
              </a>
            </div>
          )}
          {lastResult?.error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
              <span className="text-[11px] text-red-400">{lastResult.error}</span>
            </div>
          )}

          {/* ── Generated Articles List ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                <Newspaper className="h-3 w-3 inline mr-1" />
                Your articles ({articles.length})
              </p>
              <button
                onClick={() => refetchArticles()}
                className="text-gray-600 hover:text-gray-400 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>

            {articlesLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
              </div>
            )}

            {!articlesLoading && articles.length === 0 && (
              <p className="text-[11px] text-gray-600 text-center py-4">
                No articles yet — generate your first one above.
              </p>
            )}

            {!articlesLoading && articles.map((article) => {
              const isEditing = editingId === article.id;
              return (
                <div
                  key={article.id}
                  className="block p-3 rounded-xl border transition-all hover:border-white/10 hover:bg-white/3"
                  style={{ borderColor: colors.hexBorder + "50" }}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full bg-black/40 border rounded-lg px-2 py-1.5 text-[12px] text-white focus:outline-none focus:ring-1"
                        style={{ borderColor: colors.hexBorder }}
                        placeholder="Title"
                      />
                      <textarea
                        value={editForm.summary}
                        onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                        rows={2}
                        className="w-full bg-black/40 border rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:ring-1 resize-none"
                        style={{ borderColor: colors.hexBorder }}
                        placeholder="Summary"
                      />
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full bg-black/40 border rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:ring-1"
                        style={{ borderColor: colors.hexBorder }}
                      >
                        {CATEGORY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          onClick={handleSaveEdit}
                          disabled={updateMutation.isPending}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-black flex items-center justify-center gap-1 disabled:opacity-50"
                          style={{ backgroundColor: colors.hexAccent }}
                        >
                          {updateMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <><Save className="h-3 w-3" /> Save</>
                          )}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-300 border border-white/10 hover:bg-white/5 flex items-center gap-1"
                        >
                          <X className="h-3 w-3" /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      {article.coverImageUrl && (
                        <a
                          href={`/news?article=${article.slug}`}
                          className="w-14 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-white/5"
                        >
                          <img
                            src={article.coverImageUrl.startsWith("data:") ? "/images/AI_influencer_hero_image_0af5142f.png" : article.coverImageUrl}
                            alt={article.title}
                            className="w-full h-full object-cover"
                          />
                        </a>
                      )}
                      <div className="flex-1 min-w-0">
                        <a href={`/news?article=${article.slug}`} className="block">
                          <p className="text-[12px] font-semibold text-white line-clamp-2 leading-tight">
                            {article.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {article.category && (
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: colors.hexAccent + "18", color: colors.hexAccent }}
                              >
                                {CATEGORY_OPTIONS.find((c) => c.value === article.category)?.label || article.category}
                              </span>
                            )}
                            {article.publishedAt && (
                              <span className="text-[9px] text-gray-600 flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {format(new Date(article.publishedAt), "MMM d, yyyy")}
                              </span>
                            )}
                            {article.readTimeMinutes && (
                              <span className="text-[9px] text-gray-600 flex items-center gap-0.5">
                                <BookOpen className="h-2.5 w-2.5" />
                                {article.readTimeMinutes} min
                              </span>
                            )}
                            {(article.views || 0) > 0 && (
                              <span className="text-[9px] text-gray-600">
                                {article.views} views
                              </span>
                            )}
                          </div>
                        </a>
                      </div>
                      <div className="flex flex-col gap-1 self-center">
                        <button
                          onClick={() => handleStartEdit(article)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete(article.id, article.title)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deleteMutation.isPending && deleteMutation.variables === article.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
