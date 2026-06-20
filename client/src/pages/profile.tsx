import { ArtistProfileCard } from "../components/artist/artist-profile-card";
import { useParams } from "wouter";
import { useAuth } from "../hooks/use-auth";
import { Head } from "../components/ui/head";
import { useQuery } from "@tanstack/react-query";
import { ArtistLandingPage } from "../components/artist/artist-landing-page";

interface ArtistData {
  name: string;
  biography: string;
  profileImage: string;
  genre?: string;
  location?: string;
  socialLinks?: {
    spotify?: string;
    instagram?: string;
    youtube?: string;
  };
}

export default function ProfilePage() {
  const { id } = useParams();
  const { user, isLoading: isAuthLoading } = useAuth();

  // Use the URL id or fallback to the authenticated user's id
  // Use user.id > 0 check to ensure we have a valid ID from the database
  const artistId = id || (user?.id && user.id > 0 ? String(user.id) : null);
  
  // Check if this is the user's own profile
  const isOwnProfile = !id && !!user && user.id > 0;

  // Query para obtener datos del artista
  const { data: artistData, isLoading: isArtistLoading } = useQuery<ArtistData>({
    queryKey: ["/api/artist", artistId],
    enabled: !!artistId && (!isOwnProfile || user?.id !== 0)
  });

  // Show loading only while auth is initially loading (brief moment)
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-black pt-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  // If no user and no id in URL, show premium landing page
  if (!artistId) {
    return <ArtistLandingPage />;
  }

  if (isArtistLoading) {
    return (
      <div className="min-h-screen bg-black pt-4 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white text-sm">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  const fullUrl = window.location.origin + '/profile/' + artistId;

  // Usar imagen Open Graph dinámica generada por el servidor
  // Esta imagen incluye: nombre del artista, género, biografía, imagen de perfil, badge AI si aplica
  const ogImageUrl = `${window.location.origin}/api/og-image/artist/${artistId}`;
  
  // Fallback a imagen de perfil si la OG image falla
  const getAbsoluteImageUrl = (imageUrl?: string) => {
    if (!imageUrl) return `${window.location.origin}/assets/freepik__boostify_music_organe_abstract_icon.png`;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${window.location.origin}${imageUrl}`;
  };

  const profileImage = getAbsoluteImageUrl(artistData?.profileImage);

  // Valores por defecto para meta tags
  const title = artistData?.name 
    ? `${artistData.name} - Music Artist Profile | Boostify Music`
    : "Discover Amazing Musicians on Boostify Music";

  const description = artistData?.biography 
    ? `Check out ${artistData.name}'s music profile on Boostify Music. ${artistData.biography.slice(0, 150)}${artistData.biography.length > 150 ? '...' : ''}`
    : `Discover and connect with talented musicians on Boostify Music. Join our community of artists, producers, and music enthusiasts.`;

  return (
    <>
      {/* Solo renderizar Head cuando tenemos los datos necesarios */}
      {artistData && (
        <Head
          title={title}
          description={description}
          url={fullUrl}
          image={ogImageUrl}
          type="profile"
          siteName="Boostify Music"
        />
      )}
      <div className="min-h-screen bg-black pt-4">
        <ArtistProfileCard artistId={artistId} />
      </div>
    </>
  );
}