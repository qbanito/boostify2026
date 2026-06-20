/**
 * useEventData.ts
 * ───────────────
 * Fetches public event data for a Cinematic Event Landing by slug.
 */

import { useState, useEffect } from 'react';
import { fetchEvent, EventPublicData } from '../lib/event-api';

export interface UseEventDataReturn {
  event: EventPublicData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEventData(slug: string): UseEventDataReturn {
  const [event, setEvent] = useState<EventPublicData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    fetchEvent(slug)
      .then((data) => {
        if (!cancelled) setEvent(data);
      })
      .catch((err: Error) => {
        if (!cancelled)
          setError(err.message ?? 'Failed to load event');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, tick]);

  const refetch = () => setTick((t) => t + 1);

  return { event, isLoading, error, refetch };
}
