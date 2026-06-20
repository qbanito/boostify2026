import { useState, useEffect, useCallback, useRef } from 'react';

interface ArtistManifestData {
  artistName: string;
  slug: string;
  profileImage?: string;
  genre?: string;
  themeColor?: string;
}

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOfflineReady: boolean;
  isOnline: boolean;
  promptInstall: () => Promise<void>;
  registerServiceWorker: () => Promise<void>;
  cacheArtistPage: (artistData: any) => void;
}

// BeforeInstallPromptEvent is not in standard TypeScript lib
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

export function useArtistPWA(manifestData?: ArtistManifestData): PWAState {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const manifestLinkRef = useRef<HTMLLinkElement | null>(null);

  // Generate and inject dynamic manifest for this artist
  useEffect(() => {
    if (!manifestData) return;

    const manifest = {
      name: `${manifestData.artistName} - Boostify Music`,
      short_name: manifestData.artistName.length > 12 
        ? manifestData.artistName.substring(0, 12) 
        : manifestData.artistName,
      description: `Official page of ${manifestData.artistName}${manifestData.genre ? ` - ${manifestData.genre}` : ''} on Boostify Music`,
      start_url: `/artist/${manifestData.slug}?source=pwa`,
      scope: `/artist/${manifestData.slug}`,
      display: 'standalone',
      orientation: 'portrait',
      theme_color: manifestData.themeColor || '#f97316',
      background_color: '#000000',
      categories: ['music', 'entertainment'],
      icons: [
        {
          src: manifestData.profileImage || '/assets/freepik__boostify_music_organe_abstract_icon.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: manifestData.profileImage || '/assets/freepik__boostify_music_organe_abstract_icon.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
      shortcuts: [
        {
          name: `${manifestData.artistName} Music`,
          url: `/artist/${manifestData.slug}?source=pwa`,
          icons: [{
            src: manifestData.profileImage || '/assets/freepik__boostify_music_organe_abstract_icon.png',
            sizes: '192x192',
          }],
        },
      ],
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
    const manifestUrl = URL.createObjectURL(blob);

    // Remove previous manifest link if any
    if (manifestLinkRef.current) {
      manifestLinkRef.current.remove();
    }

    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestUrl;
    document.head.appendChild(link);
    manifestLinkRef.current = link;

    // Also update apple-touch-icon
    const existingAppleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (manifestData.profileImage) {
      if (existingAppleIcon) {
        existingAppleIcon.setAttribute('href', manifestData.profileImage);
      } else {
        const appleIcon = document.createElement('link');
        appleIcon.rel = 'apple-touch-icon';
        appleIcon.href = manifestData.profileImage;
        document.head.appendChild(appleIcon);
      }
    }

    // Update theme color
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', manifestData.themeColor || '#f97316');

    return () => {
      URL.revokeObjectURL(manifestUrl);
      if (manifestLinkRef.current) {
        manifestLinkRef.current.remove();
        manifestLinkRef.current = null;
      }
    };
  }, [manifestData?.artistName, manifestData?.slug, manifestData?.profileImage, manifestData?.themeColor, manifestData?.genre]);

  // Listen for install prompt
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      deferredPromptRef.current = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Check if already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register('/artist-sw.js', {
        scope: '/',
      });

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              setIsOfflineReady(true);
            }
          });
        }
      });

      if (registration.active) {
        setIsOfflineReady(true);
      }
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  }, []);

  // Prompt install
  const promptInstall = useCallback(async () => {
    if (deferredPromptRef.current) {
      await deferredPromptRef.current.prompt();
      const result = await deferredPromptRef.current.userChoice;
      if (result.outcome === 'accepted') {
        setIsInstalled(true);
      }
      deferredPromptRef.current = null;
      setIsInstallable(false);
    }
  }, []);

  // Cache artist page data for offline use
  const cacheArtistPage = useCallback((artistData: any) => {
    if (!navigator.serviceWorker?.controller) return;
    
    navigator.serviceWorker.controller.postMessage({
      type: 'CACHE_ARTIST_PAGE',
      slug: manifestData?.slug,
      artistData,
    });
  }, [manifestData?.slug]);

  // Auto-register service worker on mount
  useEffect(() => {
    registerServiceWorker();
  }, [registerServiceWorker]);

  return {
    isInstallable,
    isInstalled,
    isOfflineReady,
    isOnline,
    promptInstall,
    registerServiceWorker,
    cacheArtistPage,
  };
}
