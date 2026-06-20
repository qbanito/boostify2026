import { useQuery } from '@tanstack/react-query';

const BASE = '/api/admin/boostify-alliances';

async function jsonFetch(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'request failed');
  return data;
}

export function useOverview() {
  return useQuery({
    queryKey: [BASE + '/overview'],
    queryFn: () => jsonFetch(BASE + '/overview'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useArtistRadar(q: string) {
  return useQuery({
    queryKey: [BASE + '/artist-radar', q],
    queryFn: () => jsonFetch(BASE + '/artist-radar?q=' + encodeURIComponent(q) + '&limit=10'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useDecisionCircle(contactId: number | null) {
  return useQuery({
    queryKey: [BASE + '/decision-circle', contactId],
    queryFn: () =>
      jsonFetch(BASE + '/decision-circle' + (contactId ? `?contactId=${contactId}` : '')),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useFitScore(contactId: number | null) {
  return useQuery({
    queryKey: [BASE + '/fit-score', contactId],
    queryFn: () =>
      jsonFetch(BASE + '/fit-score' + (contactId ? `?contactId=${contactId}` : '')),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useOutreachSequence(contactId: number | null) {
  return useQuery({
    queryKey: [BASE + '/outreach-sequence', contactId],
    queryFn: () =>
      jsonFetch(BASE + '/outreach-sequence' + (contactId ? `?contactId=${contactId}` : '')),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function usePipeline() {
  return useQuery({
    queryKey: [BASE + '/pipeline'],
    queryFn: () => jsonFetch(BASE + '/pipeline'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useMasterJson(contactId: number | null) {
  return useQuery({
    queryKey: [BASE + '/master-json', contactId],
    queryFn: () =>
      jsonFetch(BASE + '/master-json' + (contactId ? `?contactId=${contactId}` : '')),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useOffers() {
  return useQuery({
    queryKey: [BASE + '/offers'],
    queryFn: () => jsonFetch(BASE + '/offers'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useAssets() {
  return useQuery({
    queryKey: [BASE + '/assets'],
    queryFn: () => jsonFetch(BASE + '/assets'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useAnalytics() {
  return useQuery({
    queryKey: [BASE + '/analytics'],
    queryFn: () => jsonFetch(BASE + '/analytics'),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export async function movePipelineStage(contactId: number, stage: string) {
  const res = await fetch(BASE + `/pipeline/${contactId}/move`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
