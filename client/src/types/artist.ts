/**
 * Tipos comunes para la aplicación de generación de artistas
 */

// Datos de suscripción de un artista
export interface ArtistSubscription {
  plan: 'Basic' | 'Pro' | 'Enterprise';
  price: number;
  status: 'active' | 'trial' | 'expired';
  startDate: string;
  renewalDate: string;
}

// Vídeo adquirido por un artista
export interface ArtistVideo {
  id: string;
  title: string;
  type: string;
  duration: string;
  creationDate: string;
  resolution: string;
  price: number;
}

// Curso adquirido por un artista
export interface ArtistCourse {
  id: string;
  title: string;
  price: number;
  purchaseDate: string;
  progress: number;
  completed: boolean;
}

// Compras realizadas por un artista
export interface ArtistPurchases {
  videos?: {
    count: number;
    totalSpent: number;
    lastPurchase: string | null;
    videos: ArtistVideo[];
  };
  courses?: {
    count: number;
    totalSpent: number;
    lastPurchase: string | null;
    courses: ArtistCourse[];
  };
}

// Apariencia visual del artista
export interface ArtistLook {
  description: string;
  color_scheme: string;
}

// Definición completa de un artista generado
export interface GeneratedArtist {
  id: string;
  firestoreId?: string;
  name: string;
  biography: string;
  album?: {
    id: string;
    name: string;
    release_date: string;
    songs: any[];
    single: { title: string; duration: string; };
  };
  look?: ArtistLook;
  music_genres?: string[];
  subscription?: ArtistSubscription;
  purchases?: ArtistPurchases;
  social_media?: {
    twitter: { handle: string; url: string; };
    instagram: { handle: string; url: string; };
    tiktok: { handle: string; url: string; };
    youtube: { handle: string; url: string; };
    spotify: { handle: string; url: string; };
  };
  password?: {
    value: string;
    last_updated: string;
  };
  management?: {
    email: string;
    phone: string;
  };
  createdAt?: any;
  updatedAt?: any;
}