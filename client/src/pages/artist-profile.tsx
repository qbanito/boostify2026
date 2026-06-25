import { useEffect, useState } from "react";
import { logger } from "../lib/logger";
import { useParams } from "wouter";
import { ArtistProfileCard } from "../components/artist/artist-profile-card";
import { CrowdfundingButton } from "../components/crowdfunding/crowdfunding-button";
import { MyUniverseModule } from "../components/artist/my-universe-module";
import { ArtistCommandEngine } from "../components/artist/command-engine/ArtistCommandEngine";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { Command } from "lucide-react";
import { Head } from "../components/ui/head";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../hooks/use-auth";
import { useArtistPWA } from "../hooks/use-artist-pwa";
import { InstallAppBanner, OfflineIndicator } from "../components/artist/install-app-banner";
import { formatLocation } from "../lib/formatLocation";
import { useNavigationVisibilityStore } from "../hooks/use-navigation-visibility";
import { setCommandContext } from "../lib/command-context";

function ProfileParallaxBackdrop({ imageUrl }: { imageUrl?: string | null }) {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 26,
    mass: 0.25,
  });

  const heroY = useTransform(smoothProgress, [0, 1], [0, 220]);
  const glowAY = useTransform(smoothProgress, [0, 1], [0, 340]);
  const glowBY = useTransform(smoothProgress, [0, 1], [0, 160]);
  const glowRotate = useTransform(smoothProgress, [0, 1], [0, 28]);
  const veilOpacity = useTransform(smoothProgress, [0, 0.75, 1], [0.48, 0.24, 0.14]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base atmosphere so the page feels alive while scrolling */}
      <motion.div
        className="absolute -top-24 left-1/2 h-[66vh] w-[120vw] -translate-x-1/2 rounded-full"
        style={{
          y: reduceMotion ? 0 : glowAY,
          opacity: reduceMotion ? 0.32 : veilOpacity,
          background:
            "radial-gradient(circle at 50% 35%, rgba(249,115,22,0.32), rgba(251,146,60,0.14) 34%, rgba(239,68,68,0.08) 58%, transparent 78%)",
          filter: "blur(18px)",
        }}
      />

      {imageUrl && (
        <motion.div
          className="absolute inset-x-0 top-0 h-[72vh]"
          style={{
            y: reduceMotion ? 0 : heroY,
            opacity: 0.2,
            backgroundImage: `url(${imageUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            filter: "blur(38px) saturate(1.2) brightness(0.6)",
            willChange: "transform",
          }}
        />
      )}

      <motion.div
        className="absolute -left-24 top-[26%] h-72 w-72 rounded-full"
        style={{
          y: reduceMotion ? 0 : glowBY,
          rotate: reduceMotion ? 0 : glowRotate,
          background: "radial-gradient(circle, rgba(251,146,60,0.22), rgba(251,146,60,0.02) 70%)",
          filter: "blur(8px)",
        }}
      />

      <motion.div
        className="absolute -right-20 top-[40%] h-80 w-80 rounded-full"
        style={{
          y: reduceMotion ? 0 : glowAY,
          rotate: reduceMotion ? 0 : glowRotate,
          background: "radial-gradient(circle, rgba(249,115,22,0.2), rgba(249,115,22,0.02) 72%)",
          filter: "blur(10px)",
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-black/82" />
    </div>
  );
}

export default function ArtistProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user: currentUser } = useAuth();
  const setNavVisible = useNavigationVisibilityStore((s) => s.setIsVisible);

  // Hide the bottom nav when viewing a shared artist profile so it doesn't
  // confuse visitors. Double-click anywhere to show it (existing behaviour).
  // Restore visibility when leaving the page.
  useEffect(() => {
    setNavVisible(false);
    return () => setNavVisible(true);
  }, [setNavVisible]);
  const [artistId, setArtistId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [artistData, setArtistData] = useState<any>(null);
  const [postgresId, setPostgresId] = useState<number | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    const findArtistBySlug = async () => {
      if (!slug) {
        setError(true);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        logger.info(`🔍 Looking for artist with slug: ${slug}`);
        
        // Primero intentar buscar en PostgreSQL
        try {
          const response = await fetch(`/api/artist/by-slug/${slug}`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.artist) {
              logger.info(`✅ Artist found in PostgreSQL:`, data.artist);
              
              // Usar el firestoreId o el id como artistId
              const artistIdToUse = data.artist.firestoreId || String(data.artist.id);
              setArtistId(artistIdToUse);
              setPostgresId(data.artist.id);
              
              // Adaptar la estructura de datos para que sea compatible con ArtistProfileCard
              setArtistData({
                uid: artistIdToUse,
                displayName: data.artist.artistName,
                name: data.artist.artistName,
                slug: data.artist.slug,
                biography: data.artist.biography,
                bannerImage: data.artist.coverImage,
                profileImage: data.artist.profileImage,
                photoURL: data.artist.profileImage,
                genre: data.artist.genres?.[0] || '',
                location: data.artist.location || data.artist.country,
                instagram: data.artist.instagramHandle,
                twitter: data.artist.twitterHandle,
                youtube: data.artist.youtubeHandle,
                spotify: data.artist.spotifyUrl,
                generatedBy: data.artist.generatedBy,
                isAIGenerated: data.artist.isAIGenerated,
                isClaimed: data.artist.isClaimed,
                blockchainArtistId: data.artist.blockchainArtistId,
                blockchainNetwork: data.artist.blockchainNetwork,
                blockchainTxHash: data.artist.blockchainTxHash,
                pageMode: data.artist.pageMode || 'artist',
                loopVideoUrl: data.artist.loopVideoUrl || null,
                postgresId: data.artist.id,
              });
              setError(false);
              setIsLoading(false);
              return;
            }
          }
        } catch (pgError) {
          logger.info(`⚠️ PostgreSQL lookup failed, trying Firestore:`, pgError);
        }
        
        // Si no se encuentra en PostgreSQL, buscar en Firestore (fallback)
        logger.info(`🔍 Searching in Firestore for slug: ${slug}`);
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("slug", "==", slug));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          logger.info(`✅ Artist found in Firestore:`, {
            uid: userData.uid,
            name: userData.displayName || userData.name,
            slug: userData.slug
          });
          setArtistId(userData.uid);
          setArtistData(userData);
          setError(false);
        } else {
          logger.warn(`⚠️ No artist found with slug: ${slug}`);
          setError(true);
        }
      } catch (err) {
        logger.error("❌ Error finding artist by slug:", err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    findArtistBySlug();
  }, [slug]);

  // Check own profile separately — does NOT trigger loading, never flashes
  useEffect(() => {
    if (!currentUser || !postgresId) return;
    if (currentUser.id === postgresId) setIsOwnProfile(true);
  }, [currentUser, postgresId]);

  // Publish command context for the floating assistant (owner only) so it can
  // route module-creation commands to the Artist Command Engine. Cleared on
  // unmount or when the visitor is not the owner.
  useEffect(() => {
    if (isOwnProfile && artistId && artistData) {
      setCommandContext({
        artistId,
        artistName: artistData.displayName || artistData.name || 'Artist',
        artistImageUrl: artistData.profileImage || artistData.photoURL || null,
        genre: artistData.genre || '',
      });
    } else {
      setCommandContext(null);
    }
    return () => setCommandContext(null);
  }, [isOwnProfile, artistId, artistData]);

  // PWA: offline mode and install-to-home-screen
  // Must be called before any early returns to respect React hooks rules
  const pwa = useArtistPWA(
    artistData && slug
      ? {
          artistName: artistData.displayName || artistData.name || 'Artist',
          slug,
          profileImage: artistData.profileImage || artistData.photoURL,
          genre: artistData.genre,
          themeColor: '#f97316',
        }
      : undefined
  );

  // Cache artist data for offline when loaded
  useEffect(() => {
    if (artistData && slug && pwa.isOfflineReady) {
      pwa.cacheArtistPage({
        success: true,
        artist: artistData,
      });
    }
  }, [artistData, slug, pwa.isOfflineReady]);

  // PWA install help dialog — shown when no native beforeinstallprompt
  // is available (desktop browsers, iOS Safari, etc.) so the button
  // never silently does nothing.
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    const handleInstallEvent = async () => {
      // Already running as a standalone app — nothing to do.
      if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
        return;
      }
      if (pwa.isInstallable) {
        await pwa.promptInstall();
      } else {
        // Fallback: show platform-specific instructions.
        setShowInstallHelp(true);
      }
    };
    window.addEventListener('boostify-install-app', handleInstallEvent);
    return () => window.removeEventListener('boostify-install-app', handleInstallEvent);
  }, [pwa.isInstallable, pwa.promptInstall]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">Loading profile...</p>
      </div>
    );
  }

  if (error || !artistId) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Artist Not Found</h1>
          <p className="text-gray-400">
            The profile you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  const fullUrl = `${window.location.origin}/artist/${slug}`;
  
  // Usar la imagen OG dinámica generada por el servidor (thumbnail profesional 1200x630)
  const ogImageUrl = `${window.location.origin}/api/og-image/artist/slug/${slug}`;

  // Fallback para imagen de perfil estática
  const getAbsoluteImageUrl = (imageUrl?: string) => {
    if (!imageUrl) return `${window.location.origin}/assets/freepik__boostify_music_organe_abstract_icon.png`;
    if (imageUrl.startsWith('http')) return imageUrl;
    return `${window.location.origin}${imageUrl}`;
  };

  // La imagen de share usa el thumbnail dinámico del servidor
  const shareImage = ogImageUrl;

  const artistName = artistData?.displayName || artistData?.name || 'Artist';
  const biography = artistData?.biography || '';
  const genre = artistData?.genre || '';
  const location = formatLocation(artistData?.location);

  // Título optimizado para SEO y redes sociales
  const title = `${artistName}${genre ? ` - ${genre}` : ''} | Boostify Music`;
  
  // Descripción optimizada con información del artista
  let description = '';
  if (biography && biography.trim().length > 0) {
    description = biography.length > 155 ? `${biography.slice(0, 152)}...` : biography;
  } else {
    const parts = [`Discover the music of ${artistName}`];
    if (genre) parts.push(`${genre} artist`);
    if (location) parts.push(`from ${location}`);
    description = parts.join(', ') + '. Listen to songs, watch videos and connect directly on Boostify Music.';
  }

  return (
    <>
      <Head
        title={title}
        description={description}
        url={fullUrl}
        image={shareImage}
        type="profile"
        siteName="Boostify Music"
        twitterUsername="@boostifymusic"
      />
      {/* Offline mode indicator */}
      <OfflineIndicator isOnline={pwa.isOnline} />
      {/* Owner-only quick launcher → Artist Command Engine */}
      {isOwnProfile && artistId && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() =>
            document
              .getElementById("artist-command-engine")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          aria-label="Abrir Artist Command Engine"
          title="Artist Command Engine"
          className="fixed bottom-24 left-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-orange-500/40 bg-gradient-to-br from-orange-500 to-orange-600 text-black shadow-[0_0_24px_rgba(249,115,22,0.45)]"
        >
          <Command className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-300 opacity-70" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-200" />
          </span>
        </motion.button>
      )}
      <div className="min-h-screen bg-black overflow-x-hidden relative scroll-smooth">
        <ProfileParallaxBackdrop
          imageUrl={
            artistData?.bannerImage ||
            artistData?.coverImage ||
            artistData?.profileImage ||
            artistData?.photoURL
          }
        />

        <div className="relative z-10">
          {/* Claim Loop banner — pre-built AI profile, not yet claimed, viewer is not the owner */}
          {!isOwnProfile && artistData?.isAIGenerated && !artistData?.isClaimed && slug && (
            <a
              href={`/claim?slug=${encodeURIComponent(slug)}`}
              className="group sticky top-0 z-30 flex items-center justify-center gap-2 bg-gradient-to-r from-[#7c5cff] via-[#ff2d95] to-[#ff7b00] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110"
            >
              <span>
                ¿Eres <span className="underline decoration-white/60 underline-offset-2">{artistData?.displayName || artistData?.name || 'tú'}</span>? Este perfil es tuyo — recl&aacute;malo gratis
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs transition-transform group-hover:translate-x-0.5">
                Reclamar →
              </span>
            </a>
          )}

          {slug && (
            <CrowdfundingButton 
              artistSlug={slug} 
              colors={{
                hexAccent: '#F97316',
                hexPrimary: '#FF8800',
                hexBorder: '#5E2B0C',
              }}
            />
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <ArtistProfileCard artistId={artistId} initialArtistData={artistData} />
          </motion.div>

          {/* My Universe module — only visible to profile owner */}
          {isOwnProfile && postgresId && (
            <div className="max-w-2xl mx-auto px-4 pb-8 -mt-2">
              <MyUniverseModule ownerPgId={postgresId} />
            </div>
          )}

          {/* Artist Command Engine — owner-only voice/text command surface */}
          {isOwnProfile && artistId && (
            <div id="artist-command-engine" className="max-w-2xl mx-auto px-4 pb-8 scroll-mt-24">
              <ArtistCommandEngine
                artistId={artistId}
                artistName={artistName}
                artistImageUrl={artistData?.profileImage || artistData?.photoURL}
                genre={genre}
              />
            </div>
          )}

          {/* PWA Install Banner */}
          <InstallAppBanner
            artistName={artistName}
            profileImage={artistData?.profileImage || artistData?.photoURL}
            isInstallable={pwa.isInstallable}
            isInstalled={pwa.isInstalled}
            isOfflineReady={pwa.isOfflineReady}
            isOnline={pwa.isOnline}
            onInstall={pwa.promptInstall}
            themeColor="#f97316"
            genre={genre}
          />
        </div>

        {/* Install help fallback — fired by the in-page Install App button
            when the browser hasn't surfaced a beforeinstallprompt event
            (desktop, iOS Safari, some Android browsers). */}
        {showInstallHelp && <InstallHelpDialog onClose={() => setShowInstallHelp(false)} artistName={artistName} />}
      </div>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// Helper: install instructions modal shown when there's no native
// beforeinstallprompt to invoke. We detect the platform and show the
// matching steps so users always get something actionable when they
// click the "Instalar App" button.
// ──────────────────────────────────────────────────────────────────
function InstallHelpDialog({ onClose, artistName }: { onClose: () => void; artistName: string }) {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(typeof window !== 'undefined' && (window as any).MSStream);
  const isAndroid = /Android/.test(ua);
  const isSafariDesktop = /Safari/.test(ua) && !/Chrome|Edg|OPR/.test(ua) && !isIOS;

  let title = 'Install Boostify Music';
  let steps: string[] = [];
  if (isIOS) {
    title = `Add ${artistName} to your Home Screen`;
    steps = [
      'Tap the Share button at the bottom (or top) of Safari.',
      'Scroll down and tap "Add to Home Screen".',
      'Tap "Add" — the app icon will appear like any other app.',
    ];
  } else if (isAndroid) {
    title = `Install ${artistName}`;
    steps = [
      'Open the browser menu (⋮ or ⋯) in the top-right.',
      'Tap "Install app" or "Add to Home Screen".',
      'Confirm — the app installs like any Play Store app.',
    ];
  } else if (isSafariDesktop) {
    steps = [
      'Open File → "Add to Dock" in Safari\'s menu bar.',
      'Click "Add" to install Boostify Music as a dock app.',
    ];
  } else {
    steps = [
      'Look for the install icon (⊕ or 📥) in your browser address bar.',
      'Click it, then click "Install".',
      'If you don\'t see it, open the browser menu and choose "Install Boostify Music" or "Apps → Install this site as an app".',
    ];
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[210] flex items-center justify-center px-4 py-6 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-950 to-zinc-900 p-6 shadow-[0_30px_80px_-20px_rgba(249,115,22,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          ✕
        </button>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-xl">📲</div>
          <div>
            <h2 className="text-lg font-bold text-white leading-tight">{title}</h2>
            <p className="text-xs text-white/50">Get one-tap access from your home screen.</p>
          </div>
        </div>
        <ol className="space-y-2.5 mb-5">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 items-start text-sm text-white/80">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-2xl font-semibold text-white bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 transition-all shadow-[0_10px_30px_-10px_rgba(249,115,22,0.6)]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
