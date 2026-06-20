import { useState, useEffect, useCallback } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  MessageCircle,
  Plus,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  ThumbsUp,
  Send,
  X,
  Flame,
  Clock,
  Search,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════
// Types
// ════════════════════════════════════════════════════════════════

export interface Reply {
  id: string;
  authorName: string;
  authorId: string;
  content: string;
  createdAt: string; // ISO
  likes: string[];   // array of authorIds who liked
}

export interface Thread {
  id: string;
  courseId: string;
  authorName: string;
  authorId: string;
  title: string;
  content: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO — updated on each new reply
  likes: string[];   // array of authorIds who liked
  replies: Reply[];
  pinned: boolean;
}

type SortMode = "latest" | "popular" | "oldest";

// ════════════════════════════════════════════════════════════════
// Storage helpers
// ════════════════════════════════════════════════════════════════

const STORAGE_KEY = "edu_discussions";

function loadThreads(courseId: string): Thread[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all: Record<string, Thread[]> = JSON.parse(raw);
    return Array.isArray(all[courseId]) ? all[courseId] : [];
  } catch {
    return [];
  }
}

function saveThreads(courseId: string, threads: Thread[]): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: Record<string, Thread[]> = raw ? JSON.parse(raw) : {};
    all[courseId] = threads;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}

export function getThreadCount(courseId: string): number {
  return loadThreads(courseId).length;
}

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

const AVATAR_COLORS = [
  "bg-orange-500", "bg-red-500", "bg-pink-500", "bg-purple-500",
  "bg-blue-500", "bg-cyan-500", "bg-green-500", "bg-yellow-500",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ════════════════════════════════════════════════════════════════
// Avatar
// ════════════════════════════════════════════════════════════════

function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const dim = size === "md" ? "w-9 h-9 text-sm" : "w-7 h-7 text-xs";
  return (
    <div
      className={`${dim} ${avatarColor(name)} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}
    >
      {initials(name) || "?"}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// NewThreadForm
// ════════════════════════════════════════════════════════════════

interface NewThreadFormProps {
  onSubmit: (title: string, content: string) => void;
  onCancel: () => void;
}

function NewThreadForm({ onSubmit, onCancel }: NewThreadFormProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const titleTrimmed = title.trim();
  const contentTrimmed = content.trim();
  const valid = titleTrimmed.length >= 3 && contentTrimmed.length >= 10;

  return (
    <Card className="p-5 bg-zinc-900/70 border-orange-500/20">
      <h4 className="font-semibold mb-4 flex items-center gap-2">
        <Plus className="w-4 h-4 text-orange-400" /> New Discussion Thread
      </h4>
      <div className="space-y-3">
        <div>
          <Input
            placeholder="Thread title (min. 3 characters)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-zinc-800/60 border-white/10 focus:border-orange-500/50"
            maxLength={120}
          />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
            {title.length}/120
          </p>
        </div>
        <div>
          <textarea
            placeholder="Share your question, idea, or insight... (min. 10 characters)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            maxLength={2000}
            className="w-full rounded-md border border-white/10 bg-zinc-800/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-orange-500/50 focus:outline-none resize-none"
          />
          <p className="text-[10px] text-muted-foreground mt-1 text-right">
            {content.length}/2000
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="border-white/10 hover:border-white/20"
          >
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => valid && onSubmit(titleTrimmed, contentTrimmed)}
            disabled={!valid}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Send className="w-3.5 h-3.5 mr-1" /> Post Thread
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
// ReplyForm
// ════════════════════════════════════════════════════════════════

interface ReplyFormProps {
  onSubmit: (content: string) => void;
  onCancel: () => void;
  authorName: string;
}

function ReplyForm({ onSubmit, onCancel, authorName }: ReplyFormProps) {
  const [content, setContent] = useState("");
  const trimmed = content.trim();

  return (
    <div className="flex gap-3 mt-3">
      <Avatar name={authorName} />
      <div className="flex-1 space-y-2">
        <textarea
          placeholder="Write a reply..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          maxLength={1000}
          className="w-full rounded-md border border-white/10 bg-zinc-800/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-orange-500/50 focus:outline-none resize-none"
        />
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => trimmed.length >= 2 && onSubmit(trimmed)}
            disabled={trimmed.length < 2}
            className="h-7 bg-orange-500 hover:bg-orange-600 text-xs"
          >
            <Send className="w-3 h-3 mr-1" /> Reply
          </Button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ThreadItem
// ════════════════════════════════════════════════════════════════

interface ThreadItemProps {
  thread: Thread;
  currentUserId: string;
  currentUserName: string;
  onLikeThread: (threadId: string) => void;
  onLikeReply: (threadId: string, replyId: string) => void;
  onAddReply: (threadId: string, content: string) => void;
}

function ThreadItem({
  thread,
  currentUserId,
  currentUserName,
  onLikeThread,
  onLikeReply,
  onAddReply,
}: ThreadItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);

  const isLikedByMe = thread.likes.includes(currentUserId);

  return (
    <Card
      className={`p-4 bg-zinc-900/50 border-white/5 hover:border-white/10 transition-colors ${
        thread.pinned ? "border-orange-500/20 bg-orange-500/5" : ""
      }`}
    >
      {/* Thread header */}
      <div className="flex gap-3">
        <Avatar name={thread.authorName} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {thread.pinned && (
                <Badge className="text-[10px] h-4 bg-orange-500/20 text-orange-400 border-orange-500/20">
                  📌 Pinned
                </Badge>
              )}
              <h4 className="font-semibold text-sm leading-snug">{thread.title}</h4>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-shrink-0">
              <Clock className="w-3 h-3" />
              {relativeTime(thread.createdAt)}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{thread.authorName}</p>
          <p className="text-sm text-gray-300 mt-2 leading-relaxed">{thread.content}</p>

          {/* Actions row */}
          <div className="flex items-center gap-3 mt-3">
            <button
              type="button"
              onClick={() => onLikeThread(thread.id)}
              className={`flex items-center gap-1 text-xs transition-colors ${
                isLikedByMe
                  ? "text-orange-400 font-semibold"
                  : "text-muted-foreground hover:text-orange-400"
              }`}
            >
              <ThumbsUp className="w-3.5 h-3.5" />
              {thread.likes.length > 0 && (
                <span>{thread.likes.length}</span>
              )}
              {isLikedByMe ? "Liked" : "Like"}
            </button>

            <button
              type="button"
              onClick={() => {
                setExpanded(true);
                setShowReplyForm(true);
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-orange-400 transition-colors"
            >
              <CornerDownRight className="w-3.5 h-3.5" /> Reply
            </button>

            {thread.replies.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors ml-auto"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {thread.replies.length}{" "}
                {thread.replies.length === 1 ? "reply" : "replies"}
                {expanded ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {expanded && (
        <div className="mt-4 pl-4 border-l border-white/10 space-y-4">
          {thread.replies.map((reply) => {
            const replyLikedByMe = reply.likes.includes(currentUserId);
            return (
              <div key={reply.id} className="flex gap-3">
                <Avatar name={reply.authorName} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">{reply.authorName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {relativeTime(reply.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{reply.content}</p>
                  <button
                    type="button"
                    onClick={() => onLikeReply(thread.id, reply.id)}
                    className={`flex items-center gap-1 text-[11px] mt-1.5 transition-colors ${
                      replyLikedByMe
                        ? "text-orange-400 font-semibold"
                        : "text-muted-foreground hover:text-orange-400"
                    }`}
                  >
                    <ThumbsUp className="w-3 h-3" />
                    {reply.likes.length > 0 && <span>{reply.likes.length}</span>}
                    {replyLikedByMe ? "Liked" : "Like"}
                  </button>
                </div>
              </div>
            );
          })}

          {showReplyForm ? (
            <ReplyForm
              authorName={currentUserName}
              onSubmit={(content) => {
                onAddReply(thread.id, content);
                setShowReplyForm(false);
              }}
              onCancel={() => setShowReplyForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowReplyForm(true)}
              className="text-xs text-muted-foreground hover:text-orange-400 flex items-center gap-1 transition-colors"
            >
              <CornerDownRight className="w-3.5 h-3.5" /> Add a reply…
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
// CourseDiscussions — main export
// ════════════════════════════════════════════════════════════════

export interface CourseDiscussionsProps {
  courseId: string;
  courseTitle: string;
  userId: string;
  userName: string;
}

export function CourseDiscussions({
  courseId,
  courseTitle,
  userId,
  userName,
}: CourseDiscussionsProps) {
  const [threads, setThreads] = useState<Thread[]>(() => loadThreads(courseId));
  const [showNewForm, setShowNewForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("latest");

  // Persist whenever threads change
  useEffect(() => {
    saveThreads(courseId, threads);
  }, [courseId, threads]);

  // Seed welcome thread on first visit
  useEffect(() => {
    if (threads.length === 0) {
      const welcome: Thread = {
        id: uid(),
        courseId,
        authorName: "Boostify Academy",
        authorId: "system",
        title: `Welcome to the ${courseTitle} discussion!`,
        content:
          "This is the community space for this course. Ask questions, share tips, and help each other grow. " +
          "No question is too basic — every expert was once a beginner. 🎵",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        likes: [],
        replies: [],
        pinned: true,
      };
      setThreads([welcome]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // ── Mutators ────────────────────────────────────

  const handleNewThread = useCallback(
    (title: string, content: string) => {
      const thread: Thread = {
        id: uid(),
        courseId,
        authorName: userName,
        authorId: userId,
        title,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        likes: [],
        replies: [],
        pinned: false,
      };
      setThreads((prev) => [thread, ...prev]);
      setShowNewForm(false);
    },
    [courseId, userId, userName]
  );

  const handleLikeThread = useCallback((threadId: string) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        const alreadyLiked = t.likes.includes(userId);
        return {
          ...t,
          likes: alreadyLiked
            ? t.likes.filter((id) => id !== userId)
            : [...t.likes, userId],
        };
      })
    );
  }, [userId]);

  const handleLikeReply = useCallback((threadId: string, replyId: string) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        return {
          ...t,
          replies: t.replies.map((r) => {
            if (r.id !== replyId) return r;
            const alreadyLiked = r.likes.includes(userId);
            return {
              ...r,
              likes: alreadyLiked
                ? r.likes.filter((id) => id !== userId)
                : [...r.likes, userId],
            };
          }),
        };
      })
    );
  }, [userId]);

  const handleAddReply = useCallback(
    (threadId: string, content: string) => {
      const reply: Reply = {
        id: uid(),
        authorName: userName,
        authorId: userId,
        content,
        createdAt: new Date().toISOString(),
        likes: [],
      };
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId
            ? {
                ...t,
                replies: [...t.replies, reply],
                updatedAt: new Date().toISOString(),
              }
            : t
        )
      );
    },
    [userId, userName]
  );

  // ── Filtering & sorting ──────────────────────────

  const filtered = threads
    .filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.content.toLowerCase().includes(q);
    })
    .slice()
    .sort((a, b) => {
      // Pinned always first
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === "popular") {
        const scoreA = a.likes.length + a.replies.length * 2;
        const scoreB = b.likes.length + b.replies.length * 2;
        return scoreB - scoreA;
      }
      if (sort === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      // latest: sort by most recent activity (updatedAt)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const totalReplies = threads.reduce((acc, t) => acc + t.replies.length, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-orange-400" /> Community Discussion
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {threads.length} thread{threads.length !== 1 ? "s" : ""} · {totalReplies} repl
            {totalReplies !== 1 ? "ies" : "y"}
          </p>
        </div>
        <Button
          onClick={() => setShowNewForm((v) => !v)}
          className="bg-orange-500 hover:bg-orange-600 h-9 w-full sm:w-auto"
        >
          {showNewForm ? (
            <>
              <X className="w-4 h-4 mr-1.5" /> Cancel
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-1.5" /> New Thread
            </>
          )}
        </Button>
      </div>

      {/* New Thread Form */}
      {showNewForm && (
        <NewThreadForm
          onSubmit={handleNewThread}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search threads…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-zinc-800/50 pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:border-orange-500/50 focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {(["latest", "popular", "oldest"] as SortMode[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                sort === s
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                  : "bg-zinc-800/50 text-muted-foreground hover:text-white border border-white/5"
              }`}
            >
              {s === "popular" && <Flame className="inline w-3 h-3 mr-1" />}
              {s === "latest" && <Clock className="inline w-3 h-3 mr-1" />}
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Thread list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">
            {searchQuery
              ? "No threads match your search."
              : "No discussions yet — be the first to start one!"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              currentUserId={userId}
              currentUserName={userName}
              onLikeThread={handleLikeThread}
              onLikeReply={handleLikeReply}
              onAddReply={handleAddReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}
