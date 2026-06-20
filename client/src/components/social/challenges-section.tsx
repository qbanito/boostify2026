import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import { Flame, Plus } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { useAuth } from "../../hooks/use-auth";
import { useToast } from "../../hooks/use-toast";

export function ChallengesSection() {
  const { user } = useAuth() || {};
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hashtag, setHashtag] = useState("#");

  const { data: challenges } = useQuery({
    queryKey: ["/api/social/challenges"],
    queryFn: async () => {
      return apiRequest({ url: "/api/social/challenges", method: "GET" }) as Promise<any[]>;
    },
  });

  const createChallengeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest({
        url: "/api/social/challenges",
        method: "POST",
        data: {
          creatorId: user?.id,
          title,
          description,
          hashtag: hashtag.startsWith("#") ? hashtag : `#${hashtag}`,
        },
      });
    },
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setHashtag("#");
      setShowCreateForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/social/challenges"] });
      toast({
        description: "Desafío creado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el desafío",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-400" />
          Desafíos en Vivo
        </h3>
        {user && (
          <Button
            size="sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="gap-2 bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" />
            Crear Desafío
          </Button>
        )}
      </div>

      {showCreateForm && (
        <Card className="bg-gradient-to-br from-orange-900/20 to-red-900/20 border-orange-500/30">
          <CardHeader>
            <CardTitle className="text-base">Nuevo Desafío Musical</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Título del desafío (ej: Canta este beat)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
            <Input
              placeholder="Hashtag (ej: BoostifyBeat)"
              value={hashtag}
              onChange={(e) =>
                setHashtag(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)
              }
            />
            <div className="flex gap-2">
              <Button
                onClick={() => createChallengeMutation.mutate()}
                disabled={!title || createChallengeMutation.isPending}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {createChallengeMutation.isPending ? "Creando..." : "Crear"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {challenges?.slice(0, 4).map((challenge) => (
          <Card
            key={challenge.id}
            className="hover:border-orange-500/50 transition cursor-pointer"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{challenge.title}</span>
                <Badge className="bg-orange-500/20 text-orange-400">
                  {challenge.participantCount || 0}
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                {challenge.hashtag}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {challenge.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {challenge.description}
                </p>
              )}
              <Button size="sm" className="w-full mt-3 gap-2">
                <Flame className="h-3 w-3" />
                Participar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
