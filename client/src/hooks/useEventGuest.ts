/**
 * useEventGuest.ts
 * ─────────────────
 * Manages the isolated guest session for a Cinematic Event Landing.
 * Completely separate from Boostify auth — no Firebase, no Clerk.
 */

import { useState, useCallback } from 'react';
import {
  getGuestSession,
  setGuestSession,
  clearGuestSession,
  GuestSessionData,
} from '../lib/event-guest-session';
import { guestLogin } from '../lib/event-api';

export interface UseEventGuestReturn {
  guest: GuestSessionData | null;
  isLoading: boolean;
  error: string | null;
  requiresCode: boolean;
  login: (name: string, accessCode?: string) => Promise<void>;
  logout: () => void;
}

export function useEventGuest(slug: string): UseEventGuestReturn {
  const [guest, setGuest] = useState<GuestSessionData | null>(
    () => getGuestSession(slug)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresCode, setRequiresCode] = useState(false);

  const login = useCallback(
    async (name: string, accessCode?: string) => {
      setIsLoading(true);
      setError(null);
      setRequiresCode(false);
      try {
        const result = await guestLogin(slug, name, accessCode);
        setGuestSession(slug, result.guestToken, result.guestName);
        setGuest(getGuestSession(slug));
      } catch (err: any) {
        setError(err.message ?? 'Login failed');
        setRequiresCode(err.requiresCode ?? false);
      } finally {
        setIsLoading(false);
      }
    },
    [slug]
  );

  const logout = useCallback(() => {
    clearGuestSession(slug);
    setGuest(null);
    setError(null);
    setRequiresCode(false);
  }, [slug]);

  return { guest, isLoading, error, requiresCode, login, logout };
}
