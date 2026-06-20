import { useUser } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';
import { ArtistLandingPage } from '../components/artist/artist-landing-page';

export default function AuthPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [, setLocation] = useLocation();

  // Redirect to stored path or dashboard if already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const redirectPath = localStorage.getItem('auth_redirect_path') || '/dashboard';
      localStorage.removeItem('auth_redirect_path');
      setLocation(redirectPath);
    }
  }, [isLoaded, isSignedIn, setLocation]);

  // Show loading while Clerk initializes
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Not signed in — show the artist landing page (same as /my-artists and /profile)
  if (!isSignedIn) {
    return <ArtistLandingPage />;
  }

  // Already signed in — show brief loading while redirect effect fires
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        <p className="text-gray-400">Redirecting...</p>
      </div>
    </div>
  );
}
