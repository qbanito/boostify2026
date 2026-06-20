/**
 * timeline-app.tsx — Standalone entry point for Boostify Timeline Desktop
 *
 * Renders ONLY the TimelineEditor (no social network, marketplace, admin, etc.)
 * Connected to the same backend for cloud save/sync via Clerk auth.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient, setClerkGetToken } from './lib/queryClient';
import { Toaster } from './components/ui/toaster';
import './index.css';

// Signal guest mode BEFORE any React render so useAuth can skip Clerk hooks
(window as any).__BOOSTIFY_GUEST_MODE = true;

// Lazy-load the heavy TimelineEditor
const TimelineEditor = React.lazy(
  () => import('./components/music-video/timeline/TimelineEditor')
);

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  'pk_test_YWNlLW1hZ3BpZS0xOS5jbGVyay5hY2NvdW50cy5kZXYk';

// ─── Error Boundary ──────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Timeline] Error:', error, info);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

// ─── Timeline Shell ──────────────────────────────────────────────────────────
function TimelineShell() {
  const [clips, setClips] = React.useState<any[]>([]);
  const [duration] = React.useState(180);

  return (
    <div className="w-screen h-screen bg-neutral-950 flex flex-col overflow-hidden">
      <React.Suspense
        fallback={
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-white/50">Cargando Timeline Editor...</span>
            </div>
          </div>
        }
      >
        <TimelineEditor
          initialClips={clips}
          duration={duration}
          onChange={setClips}
        />
      </React.Suspense>
    </div>
  );
}

// ─── Auth Wrapper (loads Clerk lazily, falls back to guest mode) ─────────────
function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = React.useState<'loading' | 'clerk' | 'guest'>('loading');
  const [ClerkModule, setClerkModule] = React.useState<any>(null);

  React.useEffect(() => {
    // Clerk doesn't work on custom protocols (app://, file://)
    // Skip directly to guest mode in Electron production
    const isCustomProtocol = window.location.protocol !== 'http:' && window.location.protocol !== 'https:';
    if (isCustomProtocol) {
      console.info('[Timeline] Custom protocol detected, starting in guest mode');
      setAuthState('guest');
      return;
    }

    // Try to load Clerk — if it fails (e.g. no internet, blocked), go guest
    import('@clerk/clerk-react')
      .then((mod) => {
        setClerkModule(mod);
        setAuthState('clerk');
      })
      .catch((err) => {
        console.warn('[Timeline] Clerk unavailable, starting in guest mode:', err);
        setAuthState('guest');
      });

    // Fallback timeout — if Clerk takes too long, go guest
    const timeout = setTimeout(() => {
      setAuthState((prev) => (prev === 'loading' ? 'guest' : prev));
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  if (authState === 'loading') {
    return (
      <div className="w-screen h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-white/50">Conectando...</span>
        </div>
      </div>
    );
  }

  if (authState === 'guest' || !ClerkModule) {
    return <>{children}</>;
  }

  const { ClerkProvider, SignedIn, SignedOut, SignInButton, useAuth: useClerkAuth } = ClerkModule;

  return (
    <ErrorBoundary fallback={<>{children}</>}>
      <ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/">
        <ClerkTokenSync useClerkAuth={useClerkAuth} />
        <SignedIn>{children}</SignedIn>
        <SignedOut>
          <SignInScreen SignInButton={SignInButton} onGuest={() => setAuthState('guest')} />
        </SignedOut>
      </ClerkProvider>
    </ErrorBoundary>
  );
}

// ─── Clerk Token Sync ────────────────────────────────────────────────────────
function ClerkTokenSync({ useClerkAuth }: { useClerkAuth: any }) {
  const { getToken } = useClerkAuth();
  React.useEffect(() => {
    setClerkGetToken(getToken);
  }, [getToken]);
  return null;
}

// ─── Sign-In Screen ──────────────────────────────────────────────────────────
function SignInScreen({ SignInButton, onGuest }: { SignInButton: any; onGuest: () => void }) {
  return (
    <div className="w-screen h-screen bg-neutral-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 p-8 bg-neutral-900 rounded-2xl border border-white/10 shadow-2xl max-w-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-600 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg">
            B
          </div>
          <h1 className="text-xl font-bold text-white">Boostify Timeline</h1>
          <p className="text-sm text-white/50 text-center">
            Inicia sesión para sincronizar tus proyectos con la nube
          </p>
        </div>

        <SignInButton mode="modal">
          <button className="w-full px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors">
            Iniciar Sesión
          </button>
        </SignInButton>

        <button
          onClick={onGuest}
          className="text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          Continuar sin cuenta (modo offline)
        </button>
      </div>
    </div>
  );
}

// ─── App Root ────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary fallback={<TimelineShell />}>
        <AuthWrapper>
          <TimelineShell />
        </AuthWrapper>
      </ErrorBoundary>
      <Toaster />
    </QueryClientProvider>
  );
}

// ─── Mount ───────────────────────────────────────────────────────────────────
const container = document.getElementById('root')!;
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
