import React, { useState } from "react";
import { logger } from "@/lib/logger";
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader 
} from "../ui/card";
import { 
  Avatar, 
  AvatarFallback, 
  AvatarImage 
} from "../ui/avatar";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { useToast } from "../../hooks/use-toast";
import { useAuth } from "../../hooks/use-auth";
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  ChevronUp, 
  ChevronDown,
  Sparkles,
  Edit2,
  Trash2,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { Post, Comment, CreateCommentRequest } from "../../lib/social/types";

interface PostCardProps {
  post: Post;
}

export function PostCard({ post }: PostCardProps) {
  const { toast } = useToast();
  const { user } = useAuth() || {};
  const queryClient = useQueryClient();
  const [isCommenting, setIsCommenting] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [showAllComments, setShowAllComments] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Check if current user is the post owner
  const isOwner = user?.id === post.userId;

  // Dar formato a la fecha relativa (hace X tiempo)
  const getRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    // Si el usuario lo ve en español, mostrar la fecha en español
    const isSpanish = post.user?.language === 'es' || 
                      navigator.language.startsWith('es');
    
    return formatDistanceToNow(date, { 
      addSuffix: true,
      locale: isSpanish ? es : undefined
    });
  };

  // Identificar si es un bot y obtener su insignia
  const getBotBadge = () => {
    if (!post.user?.isBot) return null;
    
    return (
      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 inline-flex items-center">
        <Sparkles className="h-3 w-3 mr-1" />
        AI
      </span>
    );
  };

  // Identificar idioma y obtener su insignia
  const getLanguageBadge = () => {
    if (!post.user?.language) return null;
    
    if (post.user.language === "es") {
      return (
        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-100">
          ES
        </span>
      );
    } else {
      return (
        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100">
          EN
        </span>
      );
    }
  };

  // Mutación para dar like a un post
  const likeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest({
        url: `/api/social/posts/${post.id}/like`,
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      toast({
        description: "You liked this post",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Could not like the post",
        variant: "destructive",
      });
      logger.error(error);
    },
  });

  // Mutación para crear un comentario
  const commentMutation = useMutation({
    mutationFn: async (newComment: CreateCommentRequest) => {
      return apiRequest({
        url: `/api/social/posts/${post.id}/comments`,
        method: "POST",
        data: newComment,
      });
    },
    onSuccess: () => {
      setCommentContent("");
      setIsCommenting(false);
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      toast({
        description: "Comment posted",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Could not post comment",
        variant: "destructive",
      });
      logger.error(error);
    },
  });

  // Mutación para editar post
  const editMutation = useMutation({
    mutationFn: async () => {
      return apiRequest({
        url: `/api/social/posts/${post.id}`,
        method: "PATCH",
        data: {
          content: editContent,
          userId: user?.id
        }
      });
    },
    onSuccess: () => {
      setIsEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      toast({
        description: "Post updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not edit post",
        variant: "destructive",
      });
    },
  });

  // Mutación para borrar post
  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest({
        url: `/api/social/posts/${post.id}`,
        method: "DELETE",
        data: { userId: user?.id }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      toast({
        description: "Post deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not delete post",
        variant: "destructive",
      });
    },
  });

  // Manejar envío de comentario
  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    
    commentMutation.mutate({
      content: commentContent,
      isReply: false,
      parentId: null
    });
  };

  // Obtener iniciales para el avatar
  const getUserInitials = (name: string = "User") => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  // Limitar la cantidad de comentarios mostrados
  const visibleComments = showAllComments 
    ? post.comments || [] 
    : (post.comments || []).slice(0, 2);

  const hasMoreComments = (post.comments?.length || 0) > 2;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 flex space-x-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={post.user?.avatar || undefined} alt={post.user?.displayName || "User"} />
          <AvatarFallback>{getUserInitials(post.user?.displayName)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <div className="flex items-center">
            <span className="font-medium">{post.user?.displayName || "User"}</span>
            {getBotBadge()}
            {getLanguageBadge()}
          </div>
          <div className="text-xs text-muted-foreground flex items-center space-x-2">
            <span>{getRelativeDate(post.createdAt || new Date().toISOString())}</span>
            {post.user?.interests && post.user.interests.length > 0 && (
              <>
                <span>•</span>
                <span>{post.user.interests.slice(0, 2).join(", ")}</span>
              </>
            )}
          </div>
        </div>
        
        {/* Edit/Delete buttons - only show to post owner */}
        {isOwner && !isEditMode && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditMode(true)}
              className="h-8 w-8 p-0 hover:bg-orange-500/20 hover:text-orange-400"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="h-8 w-8 p-0 hover:bg-red-500/20 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditMode ? (
          <div className="space-y-3 bg-slate-800/30 p-4 rounded-lg border border-orange-500/20">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending || editContent === post.content}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsEditMode(false);
                  setEditContent(post.content);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          post.content && (
            <p className="whitespace-pre-line">{post.content}</p>
          )
        )}
        
        {/* Renderizar media */}
        {(post as any).mediaType && (post as any).mediaData && (
          <div className="rounded-lg overflow-hidden bg-slate-900/50 border border-slate-700">
            {(post as any).mediaType === 'image' && (
              <img 
                src={(post as any).mediaData} 
                alt="Post media"
                className="max-h-96 w-full object-cover"
              />
            )}
            {(post as any).mediaType === 'video' && (
              <video 
                src={(post as any).mediaData}
                controls
                className="max-h-96 w-full"
              />
            )}
            {((post as any).mediaType === 'audio' || (post as any).mediaType === 'voice-note') && (
              <div className="flex items-center justify-center p-6 space-x-4 bg-gradient-to-r from-orange-900/20 to-red-900/20">
                <div className="animate-pulse text-orange-400 text-3xl">🎵</div>
                <audio 
                  src={(post as any).mediaData}
                  controls
                  className="flex-1"
                />
              </div>
            )}
          </div>
        )}
        
        {/* WhatsApp Link */}
        {(post as any).whatsappUrl && (
          <a
            href={(post as any).whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/50 text-green-400 px-4 py-2 rounded-lg hover:bg-green-500/30 transition-colors"
          >
            <span>💬</span>
            <span className="text-sm font-medium">Contact on WhatsApp</span>
          </a>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch space-y-3 px-4 pt-0">
        <div className="flex justify-between items-center">
          <div className="flex space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex items-center space-x-1 text-muted-foreground hover:text-foreground" 
              onClick={() => likeMutation.mutate()}
            >
              <Heart className={`h-4 w-4 ${post.isLiked ? "fill-red-500 text-red-500" : ""}`} />
              <span>{post.likes || 0}</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex items-center space-x-1 text-muted-foreground hover:text-foreground" 
              onClick={() => setIsCommenting(!isCommenting)}
            >
              <MessageCircle className="h-4 w-4" />
              <span>{post.comments?.length || 0}</span>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex items-center space-x-1 text-muted-foreground hover:text-foreground" 
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Formulario para comentar */}
        {isCommenting && (
          <form onSubmit={handleSubmitComment} className="space-y-2">
            <div className="flex space-x-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback>
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <Textarea
                placeholder="Write a comment..."
                className="flex-1 resize-none text-sm min-h-[80px]"
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button 
                size="sm" 
                type="submit" 
                disabled={!commentContent.trim() || commentMutation.isPending}
              >
                {commentMutation.isPending ? "Posting..." : "Comment"}
              </Button>
            </div>
          </form>
        )}

        {/* Lista de comentarios */}
        {visibleComments.length > 0 && (
          <div className="space-y-3 pt-2">
            {visibleComments.map((comment: Comment) => (
              <div key={comment.id} className="flex space-x-3 text-sm">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={comment.user?.avatar || undefined} alt={comment.user?.displayName || "User"} />
                  <AvatarFallback>{getUserInitials(comment.user?.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center">
                    <span className="font-medium">{comment.user?.displayName || "User"}</span>
                    {comment.user?.isBot && (
                      <span className="ml-1 text-xs px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100">
                        AI
                      </span>
                    )}
                  </div>
                  <p className="text-sm">{comment.content}</p>
                  <div className="flex space-x-2 text-xs text-muted-foreground">
                    <span>{getRelativeDate(comment.createdAt || new Date().toISOString())}</span>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                      Reply
                    </Button>
                    {comment.likes > 0 && (
                      <span className="flex items-center space-x-1">
                        <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                        <span>{comment.likes}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {hasMoreComments && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-xs w-full text-muted-foreground hover:text-foreground" 
                onClick={() => setShowAllComments(!showAllComments)}
              >
                {showAllComments ? (
                  <span className="flex items-center">
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Show less
                  </span>
                ) : (
                  <span className="flex items-center">
                    <ChevronDown className="h-4 w-4 mr-1" />
                    View {post.comments?.length && post.comments.length > 2 ? post.comments.length - 2 : ''} more comments
                  </span>
                )}
              </Button>
            )}
          </div>
        )}
      </CardFooter>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}