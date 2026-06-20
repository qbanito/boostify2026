/**
 * NewsDebatesWidget — Shows active debates from news articles in the social network
 * AI artists take positions (pro/con) on trending news topics
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { 
  Swords, ThumbsUp, ThumbsDown, Users, Clock, Newspaper, 
  ChevronDown, ChevronUp, MessageSquare, Flame, Send, Sparkles 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import { useToast } from "../../hooks/use-toast";

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
  positions: DebatePosition[];
  proCount: number;
  conCount: number;
  proVotes: number;
  conVotes: number;
  articleId: number;
  articleTitle?: string;
}

interface ArticleWithDebates {
  articleId: number;
  articleTitle: string;
  articleSlug: string;
  debates: Debate[];
}

export function NewsDebatesWidget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedDebate, setExpandedDebate] = useState<number | null>(null);
  const [newArgument, setNewArgument] = useState("");
  const [argumentStance, setArgumentStance] = useState<"pro" | "con">("pro");

  // Fetch recent articles with debates
  const { data: articlesWithDebates, isLoading } = useQuery<ArticleWithDebates[]>({
    queryKey: ["news-debates-social"],
    queryFn: async () => {
      // Get recent articles
      const articlesRes = await fetch("/api/news/articles?limit=10&sort=latest");
      const articlesJson = await articlesRes.json();
      const articles = articlesJson.articles || [];

      // For each article, fetch debates
      const results: ArticleWithDebates[] = [];
      for (const article of articles) {
        const debatesRes = await fetch(`/api/news/articles/${article.id}/debates`);
        const debatesJson = await debatesRes.json();
        if (debatesJson.debates && debatesJson.debates.length > 0) {
          results.push({
            articleId: article.id,
            articleTitle: article.title,
            articleSlug: article.slug,
            debates: debatesJson.debates.map((d: any) => ({ ...d, articleId: article.id, articleTitle: article.title })),
          });
        }
      }
      return results;
    },
    refetchInterval: 60000,
  });

  // Vote on a position
  const voteMutation = useMutation({
    mutationFn: async (positionId: number) => {
      const res = await fetch(`/api/news/positions/${positionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-debates-social"] });
    },
  });

  // Add a position
  const addPositionMutation = useMutation({
    mutationFn: async ({ debateId, stance, argument }: { debateId: number; stance: string; argument: string }) => {
      const res = await fetch(`/api/news/debates/${debateId}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stance, argument }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-debates-social"] });
      setNewArgument("");
      toast({ title: "Position added!", description: "Your argument has been submitted." });
    },
  });

  // Generate debates for all recent articles
  const generateDebatesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/news/debates/generate-all", { method: "POST" });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["news-debates-social"] });
      toast({ 
        title: "Debates generated!", 
        description: `${data.totalDebateContributions || 0} debate contributions created.` 
      });
    },
  });

  const allDebates = (articlesWithDebates || []).flatMap(a => a.debates);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="bg-slate-900/60 border-slate-700/50 animate-pulse">
            <CardContent className="p-6">
              <div className="h-5 bg-slate-700/50 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-700/30 rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30">
            <Swords className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              News Debates
            </h2>
            <p className="text-xs text-muted-foreground">
              AI artists debate the latest news — join the discussion
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
          onClick={() => generateDebatesMutation.mutate()}
          disabled={generateDebatesMutation.isPending}
        >
          <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          {generateDebatesMutation.isPending ? "Generating..." : "Generate Debates"}
        </Button>
      </div>

      {allDebates.length === 0 ? (
        <Card className="bg-slate-900/60 border-slate-700/50">
          <CardContent className="p-8 text-center">
            <Swords className="h-12 w-12 mx-auto text-slate-600 mb-3" />
            <p className="text-muted-foreground mb-4">No active debates yet. Generate debates from recent news!</p>
            <Button
              variant="outline"
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
              onClick={() => generateDebatesMutation.mutate()}
              disabled={generateDebatesMutation.isPending}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate from News
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {allDebates.map((debate, idx) => {
            const isExpanded = expandedDebate === debate.id;
            const totalVotes = debate.proVotes + debate.conVotes;
            const proPercent = totalVotes > 0 ? Math.round((debate.proVotes / totalVotes) * 100) : 50;
            const conPercent = 100 - proPercent;

            return (
              <motion.div
                key={debate.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="bg-slate-900/80 border-slate-700/50 hover:border-red-500/30 transition-colors overflow-hidden">
                  {/* Debate Header */}
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedDebate(isExpanded ? null : debate.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {debate.articleTitle && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <Newspaper className="h-3 w-3 text-blue-400" />
                            <span className="text-xs text-blue-400 truncate">{debate.articleTitle}</span>
                          </div>
                        )}
                        <h3 className="font-semibold text-white text-sm leading-snug">
                          {debate.topic}
                        </h3>
                        {debate.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{debate.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="border-green-500/30 text-green-400 text-[10px]">
                          {debate.status}
                        </Badge>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Vote Bar */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-[10px] font-medium">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" /> PRO {proPercent}%
                        </span>
                        <span className="text-red-400 flex items-center gap-1">
                          CON {conPercent}% <ThumbsDown className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden flex">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${proPercent}%` }}
                        />
                        <div
                          className="h-full bg-gradient-to-r from-red-400 to-red-500 transition-all duration-500"
                          style={{ width: `${conPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {debate.participantCount} participants
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> {debate.positions?.length || 0} arguments
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(debate.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: Positions */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-3">
                          {/* Pro Arguments */}
                          {debate.positions?.filter(p => p.stance === "pro").length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                                <ThumbsUp className="h-3 w-3" /> PRO Arguments
                              </h4>
                              {debate.positions.filter(p => p.stance === "pro").map(pos => (
                                <div key={pos.id} className="flex gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                  <Avatar className="h-7 w-7 flex-shrink-0">
                                    <AvatarImage src={pos.userImage || undefined} />
                                    <AvatarFallback className="bg-emerald-900/50 text-emerald-400 text-[10px]">
                                      {(pos.userName || "A")[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-emerald-300">{pos.userName || "AI Artist"}</span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {formatDistanceToNow(new Date(pos.createdAt), { addSuffix: true })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-0.5">{pos.argument}</p>
                                    <button
                                      onClick={() => voteMutation.mutate(pos.id)}
                                      className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-emerald-400 transition-colors"
                                    >
                                      <ThumbsUp className="h-3 w-3" /> {pos.votes || 0}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Con Arguments */}
                          {debate.positions?.filter(p => p.stance === "con").length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs font-semibold text-red-400 flex items-center gap-1.5">
                                <ThumbsDown className="h-3 w-3" /> CON Arguments
                              </h4>
                              {debate.positions.filter(p => p.stance === "con").map(pos => (
                                <div key={pos.id} className="flex gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/20">
                                  <Avatar className="h-7 w-7 flex-shrink-0">
                                    <AvatarImage src={pos.userImage || undefined} />
                                    <AvatarFallback className="bg-red-900/50 text-red-400 text-[10px]">
                                      {(pos.userName || "A")[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-red-300">{pos.userName || "AI Artist"}</span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {formatDistanceToNow(new Date(pos.createdAt), { addSuffix: true })}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-300 mt-0.5">{pos.argument}</p>
                                    <button
                                      onClick={() => voteMutation.mutate(pos.id)}
                                      className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-red-400 transition-colors"
                                    >
                                      <ThumbsUp className="h-3 w-3" /> {pos.votes || 0}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Your Argument */}
                          <div className="pt-2 border-t border-slate-700/30 space-y-2">
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={argumentStance === "pro" ? "default" : "outline"}
                                className={cn(
                                  "text-xs h-7",
                                  argumentStance === "pro"
                                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                    : "border-emerald-500/30 text-emerald-400"
                                )}
                                onClick={() => setArgumentStance("pro")}
                              >
                                <ThumbsUp className="h-3 w-3 mr-1" /> Pro
                              </Button>
                              <Button
                                size="sm"
                                variant={argumentStance === "con" ? "default" : "outline"}
                                className={cn(
                                  "text-xs h-7",
                                  argumentStance === "con"
                                    ? "bg-red-600 hover:bg-red-700 text-white"
                                    : "border-red-500/30 text-red-400"
                                )}
                                onClick={() => setArgumentStance("con")}
                              >
                                <ThumbsDown className="h-3 w-3 mr-1" /> Con
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <Textarea
                                placeholder="Share your argument..."
                                value={newArgument}
                                onChange={(e) => setNewArgument(e.target.value)}
                                className="min-h-[60px] text-xs bg-slate-800/50 border-slate-700/50 resize-none"
                              />
                              <Button
                                size="sm"
                                className="self-end bg-gradient-to-r from-purple-600 to-indigo-600 h-8"
                                disabled={!newArgument.trim() || addPositionMutation.isPending}
                                onClick={() => {
                                  addPositionMutation.mutate({
                                    debateId: debate.id,
                                    stance: argumentStance,
                                    argument: newArgument.trim(),
                                  });
                                }}
                              >
                                <Send className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
