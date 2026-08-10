/**
 * Hook de autenticación usando Clerk
 * Reemplaza Replit Auth y Firebase Auth
 */
import { useUser, useClerk, useAuth as useClerkAuth } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { useEffect, useRef } from "react";
import { isAdminEmail } from "../../../shared/constants";

// Tipo de usuario basado en el schema de la base de datos
interface User {
  id: number;
  clerkId?: string | null;
  username?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImageUrl?: string | null;
  role: string;
  isAdmin?: boolean;
  isTester?: boolean;
  permissions?: string[] | null;
  subscriptionPlan?: string | null;
  // Artist profile fields
  slug?: string | null;
  artistName?: string | null;
  biography?: string | null;
  genre?: string | null;
  genres?: string[] | null;
  profileImage?: string | null;
  coverImage?: string | null;
}

export function useAuth() {
  // Desktop guest mode — Clerk hooks not available, return safe defaults
  if ((window as any).__BOOSTIFY_GUEST_MODE) {
    return {
      user: null,
      isLoading: false,
      loading: false,
      isAuthenticated: false,
      isAdmin: false,
      isTester: false,
      userSubscription: null,
      logout: async () => {},
      login: () => {},
      register: () => {},
      refetch: async () => ({ data: null }),
    };
  }

  const { user: clerkUser, isLoaded: clerkLoaded, isSignedIn } = useUser();
  const { signOut: clerkSignOut, openSignIn, openSignUp } = useClerk();
  
  // Fetch full user data from our API once Clerk is loaded and user is signed in
  const { data: dbUser, isLoading: dbLoading, refetch } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: clerkLoaded && isSignedIn, // Only fetch when Clerk says user is signed in
    retry: false,
    staleTime: 1000 * 30, // Admin role/plan changes should propagate quickly
    refetchOnWindowFocus: true,
  });

  const isLoading = !clerkLoaded || (isSignedIn && dbLoading);

  // Combine Clerk user with DB user
  const user: User | null = dbUser ?? (isSignedIn && clerkUser ? {
    id: 0, // Will be set from DB
    clerkId: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress || null,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    profileImageUrl: clerkUser.imageUrl,
    role: 'artist',
    username: clerkUser.username,
  } : null);

  // Check if current user is admin (based on email)
  const userEmail = user?.email || clerkUser?.primaryEmailAddress?.emailAddress;
  const isAdmin = Boolean(
    user?.isAdmin || 
    (userEmail && isAdminEmail(userEmail))
  );

  const isTester = Boolean(user?.isTester || user?.role === 'tester');

  // Admins and testers receive complimentary full access. This is an
  // entitlement, not a Stripe purchase, so they never need to pay to use it.
  const userSubscription = isAdmin || isTester
    ? 'enterprise'
    : (user?.subscriptionPlan?.toLowerCase() || null);

  // Auto-sync real user to social network on first login
  const syncedRef = useRef(false);
  useEffect(() => {
    if (dbUser?.id && !syncedRef.current) {
      syncedRef.current = true;
      apiRequest("POST", "/api/social-integration/sync-real-user", {
        email: dbUser.email,
      }).catch(() => {/* fire-and-forget */});
    }
  }, [dbUser?.id]);

  const logout = async () => {
    await clerkSignOut();
  };

  const login = () => {
    openSignIn();
  };

  // Opens the Clerk SIGN-UP modal (with OAuth one-click + optional email prefill).
  // Cold artists arriving from outreach have no account yet, so registration is
  // the right first step — far less friction than showing a sign-in form.
  const register = (opts?: Record<string, any>) => {
    openSignUp(opts);
  };

  return {
    user,
    isLoading,
    loading: isLoading,
    isAuthenticated: isSignedIn ?? false,
    isAdmin,
    isTester,
    userSubscription,
    logout,
    login,
    register,
    refetch,
  };
}
