import { useState } from "react";
import { Button } from "../ui/button";
import { Plus, Users, Loader2, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { CollapsibleSection } from "./collapsible-section";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";

export function MyArtistsCompact() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const createArtistMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest({
        url: "/api/artist-generator/generate-artist/secure",
        method: "POST"
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "¡Artista creado!",
        description: `${data.name} ha sido creado exitosamente.`,
      });
      setIsGenerating(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el artista",
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });

  const handleCreateArtist = () => {
    setIsGenerating(true);
    createArtistMutation.mutate();
  };

  return (
    <CollapsibleSection
      title="Mis Artistas"
      icon={<Users className="h-4 w-4" />}
      defaultOpen={false}
    >
      <div className="space-y-3">
        <p className="text-xs text-gray-400">
          Crea y administra perfiles de artistas generados con IA
        </p>

        <div className="flex gap-2">
          <Button
            onClick={handleCreateArtist}
            disabled={isGenerating}
            size="sm"
            className="flex-1 bg-orange-500 hover:bg-orange-600"
            data-testid="button-create-artist-compact"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Plus className="h-3 w-3 mr-1" />
                Crear Artista
              </>
            )}
          </Button>

          <Link href="/my-artists">
            <Button
              size="sm"
              variant="outline"
              className="border-gray-700 hover:bg-gray-800"
              data-testid="button-view-my-artists-compact"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Ver Todos
            </Button>
          </Link>
        </div>

        <div className="text-xs text-gray-500 pt-2 border-t border-gray-800">
          💡 Los artistas IA pueden tener perfiles completos, noticias y más
        </div>
      </div>
    </CollapsibleSection>
  );
}
