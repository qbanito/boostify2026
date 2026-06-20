import { useEffect, useState } from "react";
import { logger } from "../lib/logger";
import { useAuth } from "../hooks/use-auth";
import { Redirect } from "wouter";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

export default function MyArtistPage() {
  const { user, isLoading } = useAuth();
  const [artistSlug, setArtistSlug] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const fetchUserSlug = async () => {
      if (!user?.id) {
        setChecking(false);
        return;
      }

      try {
        const firebaseUid = String(user.id);
        logger.info('🔍 [My Artist] Looking for user with Firebase UID:', firebaseUid);
        
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("uid", "==", firebaseUid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          logger.info('✅ [My Artist] User found:', { slug: userData.slug, name: userData.displayName || userData.name });
          setArtistSlug(userData.slug);
        } else {
          logger.warn('⚠️ [My Artist] No Firestore user found for UID:', firebaseUid);
          setArtistSlug(null);
        }
      } catch (error) {
        logger.error('❌ [My Artist] Error fetching user slug:', error);
        setArtistSlug(null);
      } finally {
        setChecking(false);
      }
    };

    if (!isLoading) {
      fetchUserSlug();
    }
  }, [user, isLoading]);

  if (isLoading || checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-white">Cargando tu perfil de artista...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/auth?returnTo=/my-artist" />;
  }

  if (!artistSlug) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-2xl font-bold text-white mb-4">Perfil no configurado</h1>
          <p className="text-gray-400 mb-6">
            Aún no tienes un perfil de artista configurado. Por favor, completa tu perfil primero.
          </p>
          <a 
            href="/profile" 
            className="inline-block px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            Ir a configurar perfil
          </a>
        </div>
      </div>
    );
  }

  return <Redirect to={`/artist/${artistSlug}`} />;
}
