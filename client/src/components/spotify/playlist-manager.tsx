import { Button } from "../ui/button";
import { logger } from "../../lib/logger";
import { SiSpotify } from "react-icons/si";
import { Card } from "../ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { useAuth } from "../../hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { getSpotifyData } from "../../lib/spotify-store";
import { useToast } from "../../hooks/use-toast";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export function PlaylistManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);

  const { data: spotifyData, isLoading, error } = useQuery({
    queryKey: ["spotify", user?.uid],
    queryFn: async () => {
      if (!user) return null;
      return getSpotifyData(user);
    },
    enabled: !!user,
    retry: 1,
    onError: (error: any) => {
      logger.error("Error fetching Spotify data:", error);
      if (error.code === "permission-denied") {
        toast({
          title: "Error de permisos",
          description: "No tienes permiso para acceder a estos datos. Por favor, inténtalo de nuevo.",
          variant: "destructive"
        });
      }
    }
  });

  const handleConnect = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para conectar Spotify",
        variant: "destructive"
      });
      return;
    }

    try {
      // Redirigir al usuario al flujo de OAuth de Spotify
      window.location.href = `/api/spotify/auth`;
    } catch (error) {
      logger.error("Error connecting to Spotify:", error);
      toast({
        title: "Error",
        description: "No se pudo conectar con Spotify. Por favor, inténtalo de nuevo.",
        variant: "destructive"
      });
    }
  };

  const isConnected = !!spotifyData?.accessToken;

  if (isLoading) {
    return (
      <Card className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card/50 backdrop-blur-sm border-primary/10 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1DB954]/20 via-[#1DB954]/10 to-transparent" />

      <div className="relative text-center py-8">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 bg-[#1DB954] rounded-full animate-ping opacity-20"></div>
          <div className="relative flex items-center justify-center w-20 h-20 bg-[#1DB954] rounded-full">
            <SiSpotify className="w-10 h-10 text-white" />
          </div>
        </div>

        <h3 className="text-2xl font-bold mb-3">
          {isConnected ? 'Spotify Connected' : 'Connect Spotify'}
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          {isConnected 
            ? 'Your Spotify account is connected. View your analytics and manage your music.'
            : 'Link your Spotify account to manage playlists, track performance, and grow your audience reach.'}
        </p>

        <div className="flex flex-col items-center gap-4">
          <Button 
            className="bg-[#1DB954] hover:bg-[#1ed760] text-white gap-2 px-8"
            size="lg"
            onClick={() => setShowDialog(true)}
          >
            <SiSpotify className="w-5 h-5" />
            {isConnected ? 'Refresh Connection' : 'Connect Spotify'}
          </Button>
          <span className="text-xs text-muted-foreground">
            Powered by Spotify Web API
          </span>
        </div>

        {isConnected && (
          <div className="mt-8 grid grid-cols-3 gap-4 max-w-sm mx-auto">
            {[
              { label: "Monthly Listeners", value: spotifyData?.monthlyListeners?.toLocaleString() ?? "0" },
              { label: "Followers", value: spotifyData?.followers?.toLocaleString() ?? "0" },
              { label: "Total Streams", value: spotifyData?.totalStreams?.toLocaleString() ?? "0" }
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conectar con Spotify</DialogTitle>
            <DialogDescription>
              Conecta tu cuenta de Spotify para acceder a estadísticas detalladas y gestionar tu música
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p>Al conectar tu cuenta de Spotify, podrás:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Ver estadísticas detalladas de tus oyentes</li>
              <li>Gestionar tus playlists</li>
              <li>Analizar el rendimiento de tu música</li>
            </ul>
            <Button 
              className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-white"
              onClick={() => {
                handleConnect();
                setShowDialog(false);
              }}
            >
              <SiSpotify className="w-5 h-5 mr-2" />
              Conectar Spotify
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}