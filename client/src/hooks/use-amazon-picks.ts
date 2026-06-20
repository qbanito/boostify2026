/**
 * useAmazonPicks — fetch + helpers for the Amazon Cultural Storefront module.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../lib/queryClient';

export interface AmazonProduct {
  asin: string;
  title: string;
  imageUrl: string | null;
  price: { amount: number; currency: string; display: string } | null;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  brand: string | null;
  url: string;
  source: 'amazon' | 'manual';
  note?: string | null;
}

export interface AmazonPicksResponse {
  artistId: number;
  artistSlug: string | null;
  artistName: string | null;
  affiliateTag: string | null;
  configured: boolean;
  cached: boolean;
  source: 'cache' | 'fresh' | 'manual' | 'unconfigured';
  fetchedAt: string;
  expiresAt: string;
  products: AmazonProduct[];
}

export function useAmazonPicksByArtist(artistId: number | null | undefined) {
  return useQuery<AmazonPicksResponse>({
    queryKey: ['/api/amazon-curated/by-artist', artistId],
    queryFn: () =>
      apiRequest({
        url: `/api/amazon-curated/by-artist/${artistId}`,
        method: 'GET',
      }),
    enabled: !!artistId,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}

export function useAmazonPicksBySlug(slug: string | null | undefined) {
  return useQuery<AmazonPicksResponse>({
    queryKey: ['/api/amazon-curated/by-slug', slug],
    queryFn: () =>
      apiRequest({
        url: `/api/amazon-curated/by-slug/${slug}`,
        method: 'GET',
      }),
    enabled: !!slug,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}

export function useRefreshAmazonPicks(artistId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest({
        url: `/api/amazon-curated/refresh/${artistId}`,
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['/api/amazon-curated/by-artist', artistId],
      });
    },
  });
}

export interface ManualPick {
  asin: string;
  title?: string | null;
  note?: string | null;
}

export interface AmazonSettings {
  amazonAffiliateTag: string;
  amazonAiBoosterEnabled: boolean;
  amazonManualPicks: ManualPick[];
  amazonMarketplaceOverride: string;
  paapiConfigured: boolean;
  marketplace?: { country: string; label: string; host: string };
  supportedMarketplaces?: Array<{ code: string; label: string }>;
}

export function useAmazonSettings(artistId: number | null | undefined) {
  return useQuery<AmazonSettings>({
    queryKey: ['/api/amazon-curated/settings', artistId],
    queryFn: () =>
      apiRequest({
        url: `/api/amazon-curated/settings/${artistId}`,
        method: 'GET',
      }),
    enabled: !!artistId,
    retry: false,
  });
}

export function useUpdateAmazonSettings(artistId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AmazonSettings>) =>
      apiRequest({
        url: `/api/amazon-curated/settings/${artistId}`,
        method: 'POST',
        data,
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ['/api/amazon-curated/settings', artistId],
      });
      qc.invalidateQueries({
        queryKey: ['/api/amazon-curated/by-artist', artistId],
      });
    },
  });
}

/** Track a click and open the Amazon URL in a new tab. */
export function trackAmazonClick(opts: {
  artistId: number;
  asin: string;
  affiliateTag: string;
  url: string;
}): void {
  // Fire-and-forget: never block the redirect
  try {
    fetch('/api/amazon-curated/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artistId: opts.artistId,
        asin: opts.asin,
        affiliateTag: opts.affiliateTag,
        referrer: typeof window !== 'undefined' ? window.location.href : null,
      }),
      keepalive: true,
    }).catch(() => {
      /* swallow — analytics is best-effort */
    });
  } catch {
    /* ignore */
  }

  if (typeof window !== 'undefined') {
    window.open(opts.url, '_blank', 'noopener,noreferrer');
  }
}
