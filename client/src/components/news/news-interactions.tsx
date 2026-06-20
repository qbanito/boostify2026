/**
 * News Interactions — Comments, Reactions & Debates for news articles
 * Full interaction system for artist engagement on Boostify News
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import { useToast } from "../../hooks/use-toast";
import { useUser } from "@clerk/clerk-react";
import {
  MessageCircle, Heart, Send, Reply, ChevronDown, ChevronUp,
  Flame, Lightbulb, Music, HandMetal, Rocket,
  Swords, ThumbsUp, ThumbsDown, Plus, Users, Clock,
  Sparkles, Shield,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────
interface Comment {
  id: number;
  articleId: number;
  userId: number;
  parentId: number | null;
  content: string;
  likes: number;
  isPinned: boolean;
  isEdited: boolean;
  createdAt: string;
  userName: string | null;
  userImage: string | null;
  artistName: string | null;
}

interface ReactionCount {
  reaction: string;
  count: number;
}

interface DebatePosition {
  id: number;
  stance: "pro" | "con";
  argument: string;
  votes: number;
  createdAt: string;
  userName: string | null;
  userImage: string | null;
}

interface Debate {
  id: number;
  topic: string;
  description: string | null;
  status: string;
  participantCount: number;
  createdAt: string;
  closesAt: string | null;
  createdByName: string | null;
  createdByImage: string | null;
  positions: DebatePosition[];
  proCount: number;
  conCount: number;
  proVotes: number;
  conVotes: number;
}

const REACTION_CONFIG = [
  { key: "fire", icon: Flame, label: "🔥", color: "text-orange-500", bg: "bg-orange-500/10 hover:bg-orange-500/20 border-orange-500/30" },
  { key: "lightbulb", icon: Lightbulb, label: "💡", color: "text-yellow-500", bg: "bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/30" },
  { key: "music", icon: Music, label: "🎵", color: "text-purple-500", bg: "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30" },
  { key: "clap", icon: HandMetal, label: "👏", color: "text-blue-500", bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30" },
  { key: "rocket", icon: Rocket, label: "🚀", color: "text-green-500", bg: "bg-green-500/10 hover:bg-green-500/20 border-green-500/30" },
];

// ═══════════════════════════════════════════════════════
// ── Reactions Bar ─────────────────────────────────────
// ═══════════════════════════════════════════════════════
function ReactionsBar({ articleId }: { articleId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSignedIn } = useUser();

  const { data: reactions } = useQuery<ReactionCount[]>({
    queryKey: ["/api/news/articles", articleId, "reactions"],
    queryFn: async () => {
      const res = await fetch(`/api/news/articles/${articleId}/reactions`);
      const json = await res.json();
      return json.reactions || [];
    },
  });

  const toggleReaction = useMutation({
    mutationFn: async (reaction: string) => {
      const res = await fetch(`/api/news/articles/${articleId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reaction }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news/articles", articleId, "reactions"] });
    },
  });

  const getCount = (key: string) => reactions?.find(r => r.reaction === key)?.count || 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground font-medium mr-1">React:</span>
      {REACTION_CONFIG.map(({ key, label, bg }) => {
        const count = getCount(key);
        return (
          <button
            key={key}
            onClick={() => {
              if (!isSignedIn) return toast({ title: "Sign in to react", variant: "destructive" });
              toggleReaction.mutate(key);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-200",
              count > 0 ? bg : "bg-muted/50 hover:bg-muted border-border/50"
            )}
          >
            <span className="text-base">{label}</span>
            {count > 0 && <span className="text-xs font-bold">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ── Single Comment ────────────────────────────────────
// ═══════════════════════════════════════════════════════
function CommentItem({
  comment,
  replies,
  articleId,
  depth = 0,
}: {
  comment: Comment;
  replies: Comment[];
  articleId: number;
  depth?: number;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [expanded, setExpanded] = useState(depth < 2);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSignedIn } = useUser();

  const likeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/news/comments/${comment.id}/like`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news/articles", articleId, "comments"] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/news/articles/${articleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: replyText, parentId: comment.id }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news/articles", articleId, "comments"] });
      setReplyText("");
      setShowReply(false);
      toast({ title: "Reply posted!" });
    },
  });

  const displayName = comment.artistName || comment.userName || "Anonymous";
  const childReplies = replies.filter(r => r.parentId === comment.id);

  return (
    <div className={cn("group", depth > 0 && "ml-6 pl-4 border-l-2 border-border/30")}>
      <div className="flex gap-3 py-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {comment.userImage ? (
            <img
              src={comment.userImage}
              alt={displayName}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-border/50"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-white text-xs font-bold">
              {displayName[0]?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold">{displayName}</span>
            {comment.isPinned && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-500/40 text-orange-500">
                Pinned
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
            {comment.isEdited && <span className="text-[10px] text-muted-foreground">(edited)</span>}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
            {comment.content}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => {
                if (!isSignedIn) return toast({ title: "Sign in to like", variant: "destructive" });
                likeMutation.mutate();
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Heart className={cn("h-3.5 w-3.5", (comment.likes || 0) > 0 && "fill-red-500/30 text-red-500")} />
              {comment.likes || 0}
            </button>
            <button
              onClick={() => {
                if (!isSignedIn) return toast({ title: "Sign in to reply", variant: "destructive" });
                setShowReply(!showReply);
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-orange-500 transition-colors"
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
            </button>
          </div>

          {/* Reply form */}
          <AnimatePresence>
            {showReply && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3"
              >
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Write a reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="min-h-[60px] text-sm resize-none bg-muted/30 border-border/50"
                    maxLength={2000}
                  />
                  <Button
                    size="icon"
                    className="self-end bg-orange-500 hover:bg-orange-600 text-white h-9 w-9"
                    onClick={() => replyMutation.mutate()}
                    disabled={!replyText.trim() || replyMutation.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Child replies */}
      {childReplies.length > 0 && (
        <>
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="ml-11 text-xs text-orange-500 hover:text-orange-400 flex items-center gap-1 mb-2"
            >
              <ChevronDown className="h-3 w-3" />
              Show {childReplies.length} {childReplies.length === 1 ? "reply" : "replies"}
            </button>
          )}
          <AnimatePresence>
            {expanded && childReplies.map(reply => (
              <motion.div
                key={reply.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <CommentItem
                  comment={reply}
                  replies={replies}
                  articleId={articleId}
                  depth={depth + 1}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {expanded && childReplies.length > 0 && depth < 2 && (
            <button
              onClick={() => setExpanded(false)}
              className="ml-11 text-xs text-muted-foreground hover:text-orange-500 flex items-center gap-1 mb-2"
            >
              <ChevronUp className="h-3 w-3" />
              Hide replies
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ── Comments Section ──────────────────────────────────
// ═══════════════════════════════════════════════════════
function CommentsSection({ articleId }: { articleId: number }) {
  const [commentText, setCommentText] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSignedIn } = useUser();

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ["/api/news/articles", articleId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/news/articles/${articleId}/comments`);
      const json = await res.json();
      return json.comments || [];
    },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/news/articles/${articleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news/articles", articleId, "comments"] });
      setCommentText("");
      toast({ title: "Comment posted!" });
    },
  });

  const rootComments = comments.filter(c => !c.parentId);
  const totalCount = comments.length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-8 w-1 rounded-full bg-gradient-to-b from-orange-500 to-amber-400" />
        <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-orange-500" />
          Discussion
          {totalCount > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">{totalCount}</Badge>
          )}
        </h3>
      </div>

      {/* New comment form */}
      <div className="mb-6">
        <Textarea
          placeholder={isSignedIn ? "Share your thoughts on this article..." : "Sign in to join the discussion..."}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          disabled={!isSignedIn}
          className="min-h-[80px] resize-none bg-muted/20 border-border/50 focus:border-orange-500/50 transition-colors"
          maxLength={2000}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted-foreground">{commentText.length}/2000</span>
          <Button
            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white gap-2"
            onClick={() => {
              if (!isSignedIn) return toast({ title: "Sign in to comment", variant: "destructive" });
              postMutation.mutate();
            }}
            disabled={!commentText.trim() || postMutation.isPending}
          >
            <Send className="h-4 w-4" />
            Post Comment
          </Button>
        </div>
      </div>

      {/* Comments list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-4 w-full bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : rootComments.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No comments yet</p>
          <p className="text-xs mt-1">Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="divide-y divide-border/30">
          {rootComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={comments}
              articleId={articleId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ── Debate Card ───────────────────────────────────────
// ═══════════════════════════════════════════════════════
function DebateCard({ debate, articleId }: { debate: Debate; articleId: number }) {
  const [showForm, setShowForm] = useState(false);
  const [stance, setStance] = useState<"pro" | "con">("pro");
  const [argument, setArgument] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSignedIn } = useUser();

  const addPosition = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/news/debates/${debate.id}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stance, argument }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news/articles", articleId, "debates"] });
      setArgument("");
      setShowForm(false);
      toast({ title: "Argument posted!" });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (positionId: number) => {
      const res = await fetch(`/api/news/positions/${positionId}/vote`, { method: "POST" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news/articles", articleId, "debates"] });
    },
  });

  const totalVotes = debate.proVotes + debate.conVotes;
  const proPercent = totalVotes > 0 ? Math.round((debate.proVotes / totalVotes) * 100) : 50;
  const conPercent = 100 - proPercent;
  const proPositions = debate.positions.filter(p => p.stance === "pro");
  const conPositions = debate.positions.filter(p => p.stance === "con");

  return (
    <Card className="overflow-hidden border-border/50 hover:border-orange-500/30 transition-colors">
      {/* Debate header */}
      <div className="bg-gradient-to-r from-orange-500/5 via-transparent to-blue-500/5 p-5 border-b border-border/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Swords className="h-4 w-4 text-orange-500" />
              <Badge variant={debate.status === "open" ? "default" : "secondary"} className="text-[10px]">
                {debate.status === "open" ? "Active Debate" : debate.status}
              </Badge>
            </div>
            <h4 className="font-bold text-lg">{debate.topic}</h4>
            {debate.description && (
              <p className="text-sm text-muted-foreground mt-1">{debate.description}</p>
            )}
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div className="flex items-center gap-1 justify-end">
              <Users className="h-3 w-3" />
              {debate.participantCount} participants
            </div>
            <div className="flex items-center gap-1 justify-end mt-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(debate.createdAt), { addSuffix: true })}
            </div>
          </div>
        </div>

        {/* Vote bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-green-500 flex items-center gap-1">
              <ThumbsUp className="h-3 w-3" /> PRO {proPercent}%
            </span>
            <span className="text-red-500 flex items-center gap-1">
              CON {conPercent}% <ThumbsDown className="h-3 w-3" />
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
            <div
              className="bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${proPercent}%` }}
            />
            <div
              className="bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500"
              style={{ width: `${conPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>{debate.proVotes} votes</span>
            <span>{debate.conVotes} votes</span>
          </div>
        </div>
      </div>

      {/* Positions - two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/30">
        {/* PRO side */}
        <div className="p-4">
          <h5 className="text-xs font-bold text-green-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ThumbsUp className="h-3 w-3" /> In Favor ({debate.proCount})
          </h5>
          <div className="space-y-3">
            {proPositions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No arguments yet</p>
            ) : (
              proPositions.map(pos => (
                <div key={pos.id} className="bg-green-500/5 border border-green-500/10 rounded-lg p-3">
                  <p className="text-sm leading-relaxed">{pos.argument}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-muted-foreground">
                      {pos.userName || "Anonymous"}
                    </span>
                    <button
                      onClick={() => {
                        if (!isSignedIn) return toast({ title: "Sign in to vote", variant: "destructive" });
                        voteMutation.mutate(pos.id);
                      }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-green-500 transition-colors"
                    >
                      <ThumbsUp className="h-3 w-3" />
                      {pos.votes || 0}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CON side */}
        <div className="p-4">
          <h5 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <ThumbsDown className="h-3 w-3" /> Against ({debate.conCount})
          </h5>
          <div className="space-y-3">
            {conPositions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No arguments yet</p>
            ) : (
              conPositions.map(pos => (
                <div key={pos.id} className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                  <p className="text-sm leading-relaxed">{pos.argument}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-muted-foreground">
                      {pos.userName || "Anonymous"}
                    </span>
                    <button
                      onClick={() => {
                        if (!isSignedIn) return toast({ title: "Sign in to vote", variant: "destructive" });
                        voteMutation.mutate(pos.id);
                      }}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <ThumbsUp className="h-3 w-3" />
                      {pos.votes || 0}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add argument form */}
      {debate.status === "open" && (
        <div className="border-t border-border/30 p-4">
          {!showForm ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-dashed border-border/50"
              onClick={() => {
                if (!isSignedIn) return toast({ title: "Sign in to debate", variant: "destructive" });
                setShowForm(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Your Argument
            </Button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={stance === "pro" ? "default" : "outline"}
                  className={cn(stance === "pro" && "bg-green-500 hover:bg-green-600")}
                  onClick={() => setStance("pro")}
                >
                  <ThumbsUp className="h-3.5 w-3.5 mr-1.5" /> Pro
                </Button>
                <Button
                  size="sm"
                  variant={stance === "con" ? "default" : "outline"}
                  className={cn(stance === "con" && "bg-red-500 hover:bg-red-600")}
                  onClick={() => setStance("con")}
                >
                  <ThumbsDown className="h-3.5 w-3.5 mr-1.5" /> Con
                </Button>
              </div>
              <Textarea
                placeholder="Present your argument..."
                value={argument}
                onChange={(e) => setArgument(e.target.value)}
                className="min-h-[80px] resize-none bg-muted/20"
                maxLength={1000}
              />
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                  onClick={() => addPosition.mutate()}
                  disabled={!argument.trim() || addPosition.isPending}
                >
                  <Send className="h-3.5 w-3.5" />
                  Submit Argument
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// ── Debates Section ───────────────────────────────────
// ═══════════════════════════════════════════════════════
function DebatesSection({ articleId }: { articleId: number }) {
  const [showCreate, setShowCreate] = useState(false);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSignedIn } = useUser();

  const { data: debates = [], isLoading } = useQuery<Debate[]>({
    queryKey: ["/api/news/articles", articleId, "debates"],
    queryFn: async () => {
      const res = await fetch(`/api/news/articles/${articleId}/debates`);
      const json = await res.json();
      return json.debates || [];
    },
  });

  const createDebate = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/news/articles/${articleId}/debates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, description }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/news/articles", articleId, "debates"] });
      setTopic("");
      setDescription("");
      setShowCreate(false);
      toast({ title: "Debate created!" });
    },
  });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-gradient-to-b from-orange-500 to-red-500" />
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Swords className="h-5 w-5 text-orange-500" />
            Debates
            {debates.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{debates.length}</Badge>
            )}
          </h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-orange-500/30 text-orange-500 hover:bg-orange-500/10"
          onClick={() => {
            if (!isSignedIn) return toast({ title: "Sign in to start a debate", variant: "destructive" });
            setShowCreate(!showCreate);
          }}
        >
          <Plus className="h-4 w-4" />
          Start Debate
        </Button>
      </div>

      {/* Create debate form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6"
          >
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardContent className="p-5 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                  Start a New Debate
                </h4>
                <Input
                  placeholder="What's the debate topic? (e.g., 'Will AI replace human musicians?')"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="bg-background"
                  maxLength={200}
                />
                <Textarea
                  placeholder="Optional: Add context or description..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[60px] resize-none bg-background"
                  maxLength={500}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-orange-500 hover:bg-orange-600 text-white gap-2"
                    onClick={() => createDebate.mutate()}
                    disabled={!topic.trim() || createDebate.isPending}
                  >
                    <Swords className="h-3.5 w-3.5" />
                    Create Debate
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debates list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : debates.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed border-border/50 rounded-xl">
          <Swords className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No debates yet</p>
          <p className="text-xs mt-1">Start a debate to discuss this article's ideas!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {debates.map(debate => (
            <DebateCard key={debate.id} debate={debate} articleId={articleId} />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ── Main Export: NewsInteractions ─────────────────────
// ═══════════════════════════════════════════════════════
export function NewsInteractions({ articleId }: { articleId: number }) {
  return (
    <div className="space-y-12">
      {/* Reactions */}
      <ReactionsBar articleId={articleId} />

      {/* Comments */}
      <CommentsSection articleId={articleId} />

      {/* Debates */}
      <DebatesSection articleId={articleId} />
    </div>
  );
}
