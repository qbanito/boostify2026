import { Card } from "../components/ui/card";
import { logger } from "../lib/logger";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Header } from "../components/layout/header";
import { Activity, Plus, Eye, MessageSquare, ThumbsUp, Clock, ImageIcon, Trash2, Share2, Video } from "lucide-react";
import { collection, query, where, orderBy, getDocs, addDoc, Timestamp, updateDoc, doc, deleteDoc, limit } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/use-auth";
import { useToast } from "../hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/ui/alert-dialog";

interface BlogPost {
  id?: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  video?: string; // URL del video (opcional)
  author: string;
  date: Timestamp;
  views: number;
  likes: number;
  comments: number;
  tags: string[];
  userId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export default function BlogPage() {
  const [showNewPostDialog, setShowNewPostDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estado inicial para nuevo/edición de post
  const [postForm, setPostForm] = useState<Partial<BlogPost>>({
    title: '',
    excerpt: '',
    content: '',
    tags: [],
    image: '',
    video: '',
  });

  // Efecto para cargar datos cuando se edita
  useEffect(() => {
    if (editingPost) {
      setPostForm({
        title: editingPost.title,
        excerpt: editingPost.excerpt,
        content: editingPost.content,
        tags: editingPost.tags,
        image: editingPost.image,
        video: editingPost.video || '',
      });
      setShowNewPostDialog(true);
    }
  }, [editingPost]);

  // Mutation para editar posts
  const editPostMutation = useMutation({
    mutationFn: async (updatedPost: Partial<BlogPost>) => {
      if (!user || !editingPost?.id) throw new Error("No se puede editar el post");

      const postRef = doc(db, "blog-posts", editingPost.id);
      const now = Timestamp.now();
      await updateDoc(postRef, {
        ...updatedPost,
        updatedAt: now,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
      toast({
        title: "Éxito",
        description: "Post actualizado exitosamente",
      });
      setShowNewPostDialog(false);
      setEditingPost(null);
      setPostForm({
        title: '',
        excerpt: '',
        content: '',
        tags: [],
        image: '',
        video: '',
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el post",
        variant: "destructive"
      });
    }
  });

  // Mutation para eliminar posts
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      if (!user) throw new Error("Usuario no autenticado");
      await deleteDoc(doc(db, "blog-posts", postId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
      toast({
        title: "Éxito",
        description: "Post eliminado exitosamente",
      });
    }
  });

  // Función para compartir en redes sociales
  const sharePost = (post: BlogPost, platform: 'twitter' | 'facebook' | 'instagram') => {
    const text = `${post.title} - ${post.excerpt}`;
    const url = window.location.href;

    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'instagram':
        // Instagram no tiene API de compartir directa, mostramos un mensaje
        toast({
          title: "Instagram",
          description: "Copia el enlace y compártelo en tu historia de Instagram",
        });
        navigator.clipboard.writeText(url);
        break;
    }
  };

  // ... (resto del código del componente permanece igual hasta el renderizado de los posts)

  // Query para obtener posts (remains largely unchanged)
  const { data: blogPosts = [], isLoading } = useQuery({
    queryKey: ['blog-posts'],
    queryFn: async () => {
      if (!user) return [];

      try {
        logger.info("Intentando obtener posts para usuario:", user.uid);
        const postsRef = collection(db, "blog-posts");

        // Primero intentar sin ordenamiento para debug
        const q = query(
          postsRef,
          where("userId", "==", user.uid)
        );

        logger.info("Ejecutando consulta de Firestore");
        const querySnapshot = await getDocs(q);
        logger.info("Resultado de la consulta:", querySnapshot.size, "documentos");

        const results = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as BlogPost[];

        logger.info("Posts recuperados:", results);
        return results;
      } catch (error) {
        logger.error("Error detallado al obtener posts:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los posts. Por favor, intenta de nuevo.",
          variant: "destructive"
        });
        return [];
      }
    },
    enabled: !!user
  });

  // Mutation para crear posts (remains largely unchanged)
  const createPostMutation = useMutation({
    mutationFn: async (newBlogPost: Partial<BlogPost>) => {
      if (!user) throw new Error("Usuario no autenticado");

      logger.info("Intentando crear nuevo post:", newBlogPost);
      const postsRef = collection(db, "blog-posts");
      try {
        const now = Timestamp.now();
        const docRef = await addDoc(postsRef, {
          ...newBlogPost,
          userId: user.uid,
          author: user.displayName || 'Anonymous',
          date: now,
          views: 0,
          likes: 0,
          comments: 0,
          createdAt: now,
          updatedAt: now,
        });
        logger.info("Post creado exitosamente con ID:", docRef.id);
        return docRef;
      } catch (error) {
        logger.error("Error al crear post:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blog-posts"] });
      toast({
        title: "Éxito",
        description: "Post creado exitosamente",
      });
      setShowNewPostDialog(false);
      setPostForm({
        title: '',
        excerpt: '',
        content: '',
        tags: [],
        image: '',
        video:'',
      });
    },
    onError: (error) => {
      logger.error("Error en mutation al crear post:", error);
      toast({
        title: "Error",
        description: "No se pudo crear el post. Por favor, intenta de nuevo.",
        variant: "destructive"
      });
    }
  });


  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <ScrollArea className="flex-1">
        <div className="container mx-auto px-4 py-6 pt-20">
          {/* ... (código anterior sin cambios) ... */}

          <Dialog open={showNewPostDialog} onOpenChange={(open) => {
            if (!open) {
              setEditingPost(null);
              setPostForm({
                title: '',
                excerpt: '',
                content: '',
                tags: [],
                image: '',
                video: '',
              });
            }
            setShowNewPostDialog(open);
          }}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600">
                <Plus className="mr-2 h-4 w-4" />
                New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingPost ? 'Edit Post' : 'Create New Blog Post'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={postForm.title}
                    onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                    placeholder="Enter post title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="excerpt">Excerpt</Label>
                  <Input
                    id="excerpt"
                    value={postForm.excerpt}
                    onChange={(e) => setPostForm({ ...postForm, excerpt: e.target.value })}
                    placeholder="Brief description of your post"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={postForm.content}
                    onChange={(e) => setPostForm({ ...postForm, content: e.target.value })}
                    placeholder="Write your blog post content here..."
                    className="min-h-[200px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image">Featured Image URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="image"
                      value={postForm.image}
                      onChange={(e) => setPostForm({ ...postForm, image: e.target.value })}
                      placeholder="Enter image URL"
                    />
                    <Button variant="outline" size="icon">
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="video">Video URL (opcional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="video"
                      value={postForm.video}
                      onChange={(e) => setPostForm({ ...postForm, video: e.target.value })}
                      placeholder="Enter video URL (YouTube, Vimeo, etc.)"
                    />
                    <Button variant="outline" size="icon">
                      <Video className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    value={postForm.tags?.join(', ')}
                    onChange={(e) => setPostForm({
                      ...postForm,
                      tags: e.target.value.split(',').map(tag => tag.trim())
                    })}
                    placeholder="Enter tags separated by commas"
                  />
                </div>

                <Button
                  className="w-full bg-orange-500 hover:bg-orange-600"
                  onClick={() => {
                    if (editingPost) {
                      editPostMutation.mutate(postForm);
                    } else {
                      createPostMutation.mutate(postForm);
                    }
                  }}
                  disabled={editPostMutation.isPending || createPostMutation.isPending}
                >
                  {editingPost 
                    ? (editPostMutation.isPending ? 'Updating...' : 'Update Post')
                    : (createPostMutation.isPending ? 'Creating...' : 'Publish Post')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ... (resto del código sin cambios hasta el mapeo de posts) ... */}

          <div className="grid gap-6">
            {isLoading ? (
              <Card className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                </div>
              </Card>
            ) : blogPosts.map((post) => (
              <Card key={post.id} className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-1/3">
                    {post.video ? (
                      <div className="relative aspect-video rounded-lg overflow-hidden">
                        <iframe
                          src={post.video}
                          className="absolute inset-0 w-full h-full"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <div className="relative aspect-video rounded-lg overflow-hidden">
                        <img
                          src={post.image}
                          alt={post.title}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-semibold mb-2">{post.title}</h3>
                        <p className="text-muted-foreground mb-4">{post.excerpt}</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {post.tags.map((tag) => (
                            <span key={tag} className="px-2 py-1 bg-orange-500/10 text-orange-500 rounded-full text-sm">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setEditingPost(post)}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                          >
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" />
                          </svg>
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. El post será eliminado permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => post.id && deletePostMutation.mutate(post.id)}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => sharePost(post, 'twitter')}
                          >
                            X
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => sharePost(post, 'facebook')}
                          >
                            f
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => sharePost(post, 'instagram')}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4"
                            >
                              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {post.date instanceof Timestamp
                          ? post.date.toDate().toLocaleDateString()
                          : new Date(post.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {post.views}
                      </div>
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="h-4 w-4" />
                        {post.likes}
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageSquare className="h-4 w-4" />
                        {post.comments}
                      </div>
                      <div className="text-orange-500">
                        By {post.author}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}