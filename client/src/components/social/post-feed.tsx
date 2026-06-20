import React, { useState, useEffect } from "react";
import { logger } from "@/lib/logger";
import { PostCard } from "./post-card";
import { CreatePostForm } from "./create-post-form";
import { AdvancedSearch } from "./advanced-search";
import { ChallengesSection } from "./challenges-section";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Skeleton } from "../ui/skeleton";
import { useToast } from "../../hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../hooks/use-auth";
import { apiRequest } from "../../lib/queryClient";
import { Post, CreatePostRequest } from "../../lib/social/types";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { Button } from "../ui/button";

interface PostFeedProps {
  userId?: number | null;
}

export function PostFeed({ userId: propUserId }: PostFeedProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth() || {};
  const [activeTab, setActiveTab] = useState("all");
  const [artistData, setArtistData] = useState<any>(null);
  
  // Usar el ID del usuario autenticado como fallback
  const userId = propUserId || user?.id;

  // Cargar datos del artista desde Firestore
  useEffect(() => {
    const loadArtistData = async () => {
      if (!user?.id) return;
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("uid", "==", String(user.id)));
        const snapshot = await getDocs(q);
        if (snapshot.docs.length > 0) {
          setArtistData(snapshot.docs[0].data());
        }
      } catch (error) {
        console.error("Error loading artist data:", error);
      }
    };
    loadArtistData();
  }, [user?.id]);

  // Consulta para obtener los posts
  const { data: posts, isLoading, error } = useQuery({
    queryKey: ["/api/social/posts"],
    queryFn: async () => {
      return apiRequest({ 
        url: "/api/social/posts", 
        method: "GET" 
      }) as Promise<Post[]>;
    }
  });



  // Filtrar posts según la pestaña activa
  const filteredPosts = React.useMemo(() => {
    if (!posts) return [];
    
    switch (activeTab) {
      case "spanish":
        // Filtrar posts en español (simple heurística)
        return posts.filter(post => {
          const content = post.content.toLowerCase();
          return content.includes("¿") || 
                 content.includes("á") || 
                 content.includes("é") || 
                 content.includes("í") || 
                 content.includes("ó") || 
                 content.includes("ú") || 
                 content.startsWith("¡");
        });
      case "english":
        // Filtrar posts que probablemente estén en inglés
        return posts.filter(post => {
          const content = post.content.toLowerCase();
          return !content.includes("¿") && 
                 !content.includes("á") && 
                 !content.includes("é") && 
                 !content.includes("í") && 
                 !content.includes("ó") && 
                 !content.includes("ú") && 
                 !content.startsWith("¡");
        });
      case "ai":
        // Filtrar posts creados por bots de IA
        return posts.filter(post => post.user?.isBot);
      case "trending":
        // Posts con más likes o comentarios
        return [...posts].sort((a, b) => {
          const aScore = (a.likes || 0) + (a.comments?.length || 0);
          const bScore = (b.likes || 0) + (b.comments?.length || 0);
          return bScore - aScore;
        }).slice(0, 5);
      default:
        return posts;
    }
  }, [posts, activeTab]);

  if (error) {
    return (
      <Card className="border-red-300 dark:border-red-800">
        <CardContent className="p-6 text-center">
          <p className="text-red-500 mb-4">Error al cargar las publicaciones</p>
          <Button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] })}
            variant="outline"
          >
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Desafíos en vivo */}
      <ChallengesSection />

      {/* Búsqueda avanzada */}
      <AdvancedSearch />

      {/* Formulario creativo para nueva publicación */}
      <CreatePostForm 
        userId={userId}
        artistData={artistData}
        onPostCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] })}
      />

      {/* Tabs para filtrar publicaciones */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 mb-4">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="spanish">Español</TabsTrigger>
          <TabsTrigger value="english">English</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
          <TabsTrigger value="trending">Trending</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-6">
          {isLoading ? (
            // Esqueletos para estado de carga
            Array(3).fill(null).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-3 flex space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))
          ) : filteredPosts.length > 0 ? (
            filteredPosts.map((post) => <PostCard key={post.id} post={post} />)
          ) : (
            <Card className="overflow-hidden">
              <CardContent className="p-6 text-center">
                <p className="text-muted-foreground">No hay publicaciones disponibles</p>
                <p className="text-sm mt-2">¡Sé el primero en publicar algo!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Indicador de carga de posts */}
      {posts && posts.length > 0 && (
        <div className="text-center text-sm text-muted-foreground py-2">
          Mostrando {filteredPosts.length} de {posts.length} publicaciones
        </div>
      )}
    </div>
  );
}