import React, { useEffect, useRef } from "react";
import { logger } from "../lib/logger";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { BadgeInfo, Globe, Users, User, MessageSquare, Sparkles, BookMarked, Zap, TrendingUp, Bell } from "lucide-react";
import { Link } from "wouter";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { useToast } from "../hooks/use-toast";

// Constantes para estilos reutilizables
const LANGUAGE_BADGE_CLASS = "px-2 py-0.5 rounded-full text-xs inline-flex items-center";
const INFO_GROUP_CLASS = "flex items-center gap-2 text-muted-foreground text-sm";

// Constantes para gradientes
const GRADIENT_TEXT = "bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500 font-bold";

// Interfaces para los tipos de datos
interface SocialUser {
  id?: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  interests?: string[];
  language: 'en' | 'es';
  isBot: boolean;
  personality?: string;
  savedPosts?: string[];
  likedPosts?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface Comment {
  id?: string;
  userId: string;
  postId: string;
  parentId?: string | null;
  content: string;
  likes: number;
  isReply: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: SocialUser;
}

interface Post {
  id?: string;
  userId: string;
  content: string;
  likes: number;
  isLiked?: boolean;
  isSaved?: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: SocialUser;
  comments?: Comment[];
}

export default function FirestoreSocialPage() {
  const { user } = useAuth() || {};
  const [activeTab, setActiveTab] = React.useState("feed");
  const [newPostContent, setNewPostContent] = React.useState("");
  const [editingProfile, setEditingProfile] = React.useState(false);
  const [profileData, setProfileData] = React.useState({
    displayName: '',
    bio: '',
    interests: [] as string[],
    language: 'en' as 'en' | 'es'
  });
  const { toast } = useToast();

  // Referencia para el video de fondo
  const videoRef = useRef<HTMLVideoElement>(null);

  // Asegurarse de que el video se reproduce automáticamente cuando se carga
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(error => {
        logger.error("Video autoplay failed:", error);
      });
    }
  }, []);

  // Sincronizar usuario con Firestore cuando se autentique
  useEffect(() => {
    if (user?.uid) {
      syncUserWithFirestore();
    }
  }, [user?.uid]);

  const syncUserWithFirestore = async () => {
    if (!user) return;
    
    try {
      await apiRequest({
        url: "/api/firestore-social/users/sync",
        method: "POST",
        data: {
          userId: user.uid,
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          avatar: user.photoURL,
          bio: '',
          interests: [],
          language: 'en'
        }
      });
    } catch (error) {
      logger.error("Error syncing user:", error);
    }
  };

  // Consulta para obtener usuarios
  const { data: users } = useQuery({
    queryKey: ["/api/firestore-social/users"],
    queryFn: async () => {
      return apiRequest({ 
        url: "/api/firestore-social/users", 
        method: "GET" 
      }) as Promise<SocialUser[]>;
    }
  });

  // Consulta para obtener perfil del usuario actual
  const { data: currentUserProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["/api/firestore-social/users", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return null;
      return apiRequest({ 
        url: `/api/firestore-social/users/${user.uid}`, 
        method: "GET" 
      }) as Promise<SocialUser>;
    },
    enabled: !!user?.uid
  });

  // Consulta para obtener posts del usuario actual
  const { data: userPosts, refetch: refetchUserPosts } = useQuery({
    queryKey: ["/api/firestore-social/users", user?.uid, "posts"],
    queryFn: async () => {
      if (!user?.uid) return [];
      return apiRequest({ 
        url: `/api/firestore-social/users/${user.uid}/posts`, 
        method: "GET" 
      }) as Promise<Post[]>;
    },
    enabled: !!user?.uid && activeTab === "personal"
  });

  // Actualizar profileData cuando se cargue el perfil
  useEffect(() => {
    if (currentUserProfile) {
      setProfileData({
        displayName: currentUserProfile.displayName || '',
        bio: currentUserProfile.bio || '',
        interests: currentUserProfile.interests || [],
        language: currentUserProfile.language || 'en'
      });
    }
  }, [currentUserProfile]);

  // Consulta para obtener posts
  const { data: posts, refetch: refetchPosts } = useQuery({
    queryKey: ["/api/firestore-social/posts"],
    queryFn: async () => {
      return apiRequest({ 
        url: "/api/firestore-social/posts", 
        method: "GET" 
      }) as Promise<Post[]>;
    }
  });
  
  // Consulta para obtener posts guardados
  const { data: savedPosts, refetch: refetchSavedPosts } = useQuery({
    queryKey: ["/api/firestore-social/user/saved-posts"],
    queryFn: async () => {
      return apiRequest({ 
        url: "/api/firestore-social/user/saved-posts", 
        method: "GET",
        data: { userId: user?.uid || "1" }
      }) as Promise<Post[]>;
    },
    enabled: activeTab === "saved" // Solo se ejecuta cuando la pestaña "saved" está activa
  });

  // Mutación para actualizar perfil
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileData) => {
      if (!user?.uid) throw new Error("User not authenticated");
      return apiRequest({
        url: `/api/firestore-social/users/${user.uid}`,
        method: "PATCH",
        data
      }) as Promise<SocialUser>;
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
      setEditingProfile(false);
      refetchProfile();
    },
    onError: (error) => {
      toast({
        title: "Error updating profile",
        description: "An error occurred while updating your profile. Please try again.",
        variant: "destructive",
      });
      logger.error("Error updating profile:", error);
    }
  });

  // Mutación para crear un nuevo post
  const createPostMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user?.uid) throw new Error("User not authenticated");
      return apiRequest({
        url: "/api/firestore-social/posts",
        method: "POST",
        data: { content, userId: user.uid }
      }) as Promise<Post>;
    },
    onSuccess: () => {
      toast({
        title: "Post created",
        description: "Your post has been published successfully",
      });
      setNewPostContent("");
      refetchPosts();
      if (activeTab === "personal") {
        refetchUserPosts();
      }
    },
    onError: (error) => {
      toast({
        title: "Error creating post",
        description: "An error occurred while publishing your post. Please try again.",
        variant: "destructive",
      });
      logger.error("Error creating post:", error);
    }
  });

  // Mutación para dar like a un post
  const likePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest({
        url: `/api/firestore-social/posts/${postId}/like`,
        method: "POST",
        data: { userId: user?.uid || "1" }
      }) as Promise<Post>;
    },
    onSuccess: () => {
      refetchPosts();
      toast({
        description: "Post liked successfully",
        duration: 2000
      });
    },
    onError: (error) => {
      toast({
        title: "Error liking post",
        description: "An error occurred while liking the post. Please try again.",
        variant: "destructive",
      });
      logger.error("Error liking post:", error);
    }
  });
  
  // Mutación para guardar un post
  const savePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiRequest({
        url: `/api/firestore-social/posts/${postId}/save`,
        method: "POST",
        data: { userId: user?.uid || "1" }
      }) as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      // Actualizar tanto la lista principal como la de posts guardados
      refetchPosts();
      
      // Solo refrescar la lista de posts guardados si estamos en esa pestaña
      if (activeTab === "saved") {
        refetchSavedPosts();
      }
      
      toast({
        description: "Post saved successfully",
        duration: 2000
      });
    },
    onError: (error) => {
      toast({
        title: "Error saving post",
        description: "An error occurred while saving the post. Please try again.",
        variant: "destructive",
      });
      logger.error("Error saving post:", error);
    }
  });

  // Mutación para comentar en un post
  const commentPostMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!user?.uid) throw new Error("User not authenticated");
      return apiRequest({
        url: `/api/firestore-social/posts/${postId}/comments`,
        method: "POST",
        data: { content, userId: user.uid }
      }) as Promise<Comment>;
    },
    onSuccess: () => {
      refetchPosts();
      if (activeTab === "personal") {
        refetchUserPosts();
      }
    }
  });

  // Función para obtener las iniciales del nombre
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };
  
  // Función para generar un color de avatar consistente basado en el nombre
  const getAvatarColor = (name: string) => {
    // Lista de colores para avatares
    const colors = [
      "bg-red-500",
      "bg-blue-500",
      "bg-green-500",
      "bg-yellow-500",
      "bg-purple-500",
      "bg-pink-500",
      "bg-indigo-500",
      "bg-teal-500", 
      "bg-orange-500",
      "bg-cyan-500"
    ];
    
    // Convertir el nombre a un número usando la suma de los códigos de carácter
    const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    // Usar el módulo para elegir un color del array
    const colorIndex = sum % colors.length;
    return colors[colorIndex];
  };

  // Identificar si es un bot y obtener su insignia
  const getBotBadge = (user?: SocialUser | null) => {
    // Verificar que el usuario exista y sea un bot
    if (!user || !user.isBot) return null;
    
    return (
      <div className="flex items-center gap-1 ml-2">
        <Sparkles className="w-3 h-3 text-yellow-500" />
        <span className="text-xs font-medium">AI</span>
      </div>
    );
  };

  // Componente para mostrar un post individual
  const PostCard = ({ post }: { post: Post }) => {
    const [newCommentContent, setNewCommentContent] = React.useState("");
    const [showCommentInput, setShowCommentInput] = React.useState(false);

    const handleLike = () => {
      if (post.id) {
        likePostMutation.mutate(post.id);
      }
    };

    const handleSave = () => {
      if (post.id) {
        savePostMutation.mutate(post.id);
      }
    };

    const handleComment = () => {
      if (post.id && newCommentContent.trim()) {
        commentPostMutation.mutate({
          postId: post.id,
          content: newCommentContent
        });
        setNewCommentContent("");
        setShowCommentInput(false);
      }
    };

    // Formatear la fecha en un formato más amigable
    const formatDate = (date: Date) => {
      const now = new Date();
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 24) {
        return diffInHours === 0 
          ? 'Today' 
          : `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
      } else {
        return date.toLocaleDateString();
      }
    };

    return (
      <Card className="mb-4 shadow-sm hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-center">
            <Avatar className="mr-2 ring-2 ring-primary/10">
              <AvatarImage src={post.user?.avatar} />
              <AvatarFallback className={getAvatarColor(post.user?.displayName || "User")}>{getInitials(post.user?.displayName || "User")}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center">
                <span className="font-medium">{post.user?.displayName}</span>
                {getBotBadge(post.user as SocialUser)}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDate(new Date(post.createdAt))}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className={`${LANGUAGE_BADGE_CLASS} ${
                post.user?.language === 'es' 
                  ? 'bg-orange-100 text-orange-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {post.user?.language === 'es' ? 'ES' : 'EN'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-base">{post.content}</p>
          <div className="flex items-center justify-between text-sm mb-4 border-t border-b py-2">
            <div className="flex items-center gap-4">
              <button 
                className={`${INFO_GROUP_CLASS} ${post.isLiked ? 'text-red-500 font-medium' : ''} transition-colors hover:text-red-400`}
                onClick={handleLike}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill={post.isLiked ? "currentColor" : "none"}
                  stroke="currentColor"
                  className="w-5 h-5"
                  strokeWidth={post.isLiked ? "0" : "2"}
                >
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <span>{post.likes} Likes</span>
              </button>
              <button 
                className={`${INFO_GROUP_CLASS} hover:text-primary/80 transition-colors`}
                onClick={() => setShowCommentInput(!showCommentInput)}
              >
                <MessageSquare className="w-5 h-5" />
                <span>{post.comments?.length || 0} Comments</span>
              </button>
            </div>
            <button 
              className={`${INFO_GROUP_CLASS} ${post.isSaved ? 'text-primary font-medium' : ''} hover:text-primary/80 transition-colors`}
              onClick={handleSave}
            >
              <BookMarked className="w-5 h-5" />
              <span>{post.isSaved ? 'Saved' : 'Save'}</span>
            </button>
          </div>

          {showCommentInput && (
            <div className="mb-4">
              <Textarea
                value={newCommentContent}
                onChange={(e) => setNewCommentContent(e.target.value)}
                placeholder="Write a comment..."
                className="mb-2 focus-visible:ring-primary/50"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCommentInput(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleComment} disabled={!newCommentContent.trim()}>
                  Comment
                </Button>
              </div>
            </div>
          )}

          {post.comments && post.comments.length > 0 && (
            <div className="space-y-3 mt-4 pt-1">
              {post.comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2 animate-in fade-in-50 duration-300">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={comment.user?.avatar} />
                    <AvatarFallback className={getAvatarColor(comment.user?.displayName || "User")}>{getInitials(comment.user?.displayName || "User")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="bg-muted rounded-lg p-2">
                      <div className="flex items-center">
                        <span className="font-medium text-sm">{comment.user?.displayName}</span>
                        {getBotBadge(comment.user as SocialUser)}
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>{formatDate(new Date(comment.createdAt))}</span>
                      <button className="hover:text-primary transition-colors">{comment.likes} Likes</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Función para manejar la creación de nuevos posts
  const handleCreatePost = () => {
    if (newPostContent.trim()) {
      createPostMutation.mutate(newPostContent);
    }
  };

  return (
    <div className="relative min-h-screen">
      {/* Video de fondo con overlay */}
      <div className="fixed inset-0 w-full h-full z-0 overflow-hidden">
        <video 
          ref={videoRef}
          className="absolute min-w-full min-h-full object-cover opacity-20"
          autoPlay 
          loop 
          muted
          playsInline
        >
          <source src="/assets/Standard_Mode_Generated_Video (9).mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-background z-0"></div>
      </div>

      {/* Header moderno con SVG logo y texto con gradiente */}
      <header className="relative z-10 pt-8 pb-6 mb-4 backdrop-blur-sm bg-background/30">
        <div className="container mx-auto">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-4 mb-4">
              <img src="/assets/boostify-logo.svg" alt="Boostify Logo" className="w-16 h-16" />
              <div>
                <h1 className={`text-3xl md:text-4xl font-bold ${GRADIENT_TEXT}`}>
                  Boostify Social
                </h1>
                <p className="text-muted-foreground">Connect with musicians worldwide</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-500" />
                <span className="text-sm">Trending Now</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                <span className="text-sm">Top Artists</span>
              </div>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-orange-500" />
                <span className="text-sm">Notifications</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container relative z-10 mx-auto pb-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-1/4">
            <Card className="backdrop-blur-sm bg-card/90">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Community
                </CardTitle>
                <CardDescription>Social network members</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {users ? (
                    users.map((socialUser: SocialUser) => (
                      <div key={socialUser.id} className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={socialUser.avatar} />
                          <AvatarFallback className={getAvatarColor(socialUser.displayName)}>{getInitials(socialUser.displayName)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="font-medium truncate">{socialUser.displayName}</span>
                            {getBotBadge(socialUser)}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {socialUser.bio?.substring(0, 30)}...
                          </p>
                        </div>
                        <span className={`${LANGUAGE_BADGE_CLASS} ${
                          socialUser.language === 'es' 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {socialUser.language === 'es' ? 'ES' : 'EN'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground text-sm">Loading users...</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="backdrop-blur-sm bg-background/70">
                  <TabsTrigger value="feed" className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    Feed
                  </TabsTrigger>
                  <TabsTrigger value="personal" className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    My Profile
                  </TabsTrigger>
                  <TabsTrigger value="saved" className="flex items-center gap-1">
                    <BookMarked className="w-4 h-4" />
                    Saved
                  </TabsTrigger>
                </TabsList>
                <Link href="/firestore-social">
                  <Button variant="outline" size="sm" className="flex items-center gap-1 backdrop-blur-sm bg-background/60">
                    <BadgeInfo className="w-4 h-4" />
                    Info
                  </Button>
                </Link>
              </div>

              <TabsContent value="feed" className="mt-0">
                {/* Create new post */}
                <Card className="mb-6 backdrop-blur-sm bg-card/90">
                  <CardHeader>
                    <CardTitle className="text-lg">Create new post</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="What's on your mind about music today?"
                      className="mb-3"
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleCreatePost} 
                        disabled={!newPostContent.trim()}
                        className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                      >
                        Post
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Posts list */}
                {posts ? (
                  posts.length > 0 ? (
                    posts.map((post) => <PostCard key={post.id} post={post} />)
                  ) : (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground">No posts available. Be the first to post!</p>
                    </div>
                  )
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">Loading posts...</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="personal">
                {/* Profile Card */}
                <Card className="mb-6 backdrop-blur-sm bg-card/90">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>My Profile</CardTitle>
                        <CardDescription>Manage your profile information</CardDescription>
                      </div>
                      {!editingProfile && (
                        <Button 
                          onClick={() => setEditingProfile(true)}
                          variant="outline"
                          size="sm"
                          data-testid="button-edit-profile"
                        >
                          Edit Profile
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {currentUserProfile ? (
                      editingProfile ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Display Name</label>
                            <input
                              type="text"
                              value={profileData.displayName}
                              onChange={(e) => setProfileData({...profileData, displayName: e.target.value})}
                              className="w-full px-3 py-2 rounded-md border bg-background"
                              placeholder="Your name"
                              data-testid="input-display-name"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Bio</label>
                            <Textarea
                              value={profileData.bio}
                              onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                              placeholder="Tell us about yourself..."
                              className="min-h-[100px]"
                              data-testid="input-bio"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Language</label>
                            <select
                              value={profileData.language}
                              onChange={(e) => setProfileData({...profileData, language: e.target.value as 'en' | 'es'})}
                              className="w-full px-3 py-2 rounded-md border bg-background"
                              data-testid="select-language"
                            >
                              <option value="en">English</option>
                              <option value="es">Español</option>
                            </select>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={() => updateProfileMutation.mutate(profileData)}
                              disabled={updateProfileMutation.isPending}
                              className="bg-gradient-to-r from-orange-500 to-red-500"
                              data-testid="button-save-profile"
                            >
                              {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                            </Button>
                            <Button
                              onClick={() => {
                                setEditingProfile(false);
                                if (currentUserProfile) {
                                  setProfileData({
                                    displayName: currentUserProfile.displayName || '',
                                    bio: currentUserProfile.bio || '',
                                    interests: currentUserProfile.interests || [],
                                    language: currentUserProfile.language || 'en'
                                  });
                                }
                              }}
                              variant="outline"
                              data-testid="button-cancel-edit"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <Avatar className="w-20 h-20 ring-4 ring-primary/10">
                              <AvatarImage src={currentUserProfile.avatar || user?.photoURL || ''} />
                              <AvatarFallback className={getAvatarColor(currentUserProfile.displayName)}>
                                {getInitials(currentUserProfile.displayName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h3 className="text-xl font-bold">{currentUserProfile.displayName}</h3>
                              <p className="text-sm text-muted-foreground">{user?.email}</p>
                              <Badge variant="outline" className="mt-1">
                                {currentUserProfile.language === 'es' ? '🇪🇸 Español' : '🇬🇧 English'}
                              </Badge>
                            </div>
                          </div>

                          {currentUserProfile.bio && (
                            <div>
                              <h4 className="font-medium mb-1">Bio</h4>
                              <p className="text-muted-foreground">{currentUserProfile.bio}</p>
                            </div>
                          )}

                          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                            <div className="text-center">
                              <p className="text-2xl font-bold">{userPosts?.length || 0}</p>
                              <p className="text-xs text-muted-foreground">Posts</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold">{currentUserProfile.likedPosts?.length || 0}</p>
                              <p className="text-xs text-muted-foreground">Likes</p>
                            </div>
                            <div className="text-center">
                              <p className="text-2xl font-bold">{currentUserProfile.savedPosts?.length || 0}</p>
                              <p className="text-xs text-muted-foreground">Saved</p>
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-10">
                        <p className="text-muted-foreground">Loading profile...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* User's Posts */}
                <Card className="backdrop-blur-sm bg-card/90">
                  <CardHeader>
                    <CardTitle>My Posts</CardTitle>
                    <CardDescription>Posts you've created</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {userPosts ? (
                      userPosts.length > 0 ? (
                        <div className="space-y-4">
                          {userPosts.map((post) => <PostCard key={post.id} post={post} />)}
                        </div>
                      ) : (
                        <div className="text-center py-10">
                          <p className="text-muted-foreground">You haven't created any posts yet.</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="mt-4"
                            onClick={() => setActiveTab("feed")}
                          >
                            Create your first post
                          </Button>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-10">
                        <p className="text-muted-foreground">Loading posts...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="saved">
                <Card className="mb-6 backdrop-blur-sm bg-card/90">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookMarked className="w-5 h-5" />
                      Saved Posts
                    </CardTitle>
                    <CardDescription>Posts you've saved for later reference</CardDescription>
                  </CardHeader>
                </Card>

                {/* Lista de posts guardados */}
                {savedPosts ? (
                  savedPosts.length > 0 ? (
                    savedPosts.map((post) => <PostCard key={post.id} post={post} />)
                  ) : (
                    <div className="text-center py-10 backdrop-blur-sm bg-card/30 rounded-lg">
                      <BookMarked className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                      <p className="text-muted-foreground">No saved posts yet.</p>
                      <p className="text-muted-foreground text-sm mt-1">
                        Start saving posts you'd like to refer back to later.
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-4"
                        onClick={() => setActiveTab("feed")}
                      >
                        Browse feed
                      </Button>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 backdrop-blur-sm bg-card/30 rounded-lg">
                    <div className="animate-pulse h-8 w-8 rounded-full bg-muted mb-4"></div>
                    <p className="text-muted-foreground">Loading saved posts...</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}