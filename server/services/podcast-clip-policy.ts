type PodcastActor = { id?: number | string; isAdmin?: boolean };
type PodcastArtist = { id: number; generatedBy?: number | null };

export function canManagePodcastArtist(actor: PodcastActor, artist: PodcastArtist): boolean {
  const actorId = Number(actor.id);
  if (!Number.isInteger(actorId) || actorId <= 0) return false;
  return actor.isAdmin === true || artist.id === actorId || artist.generatedBy === actorId;
}

function publicHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try { return new URL(value).protocol === 'https:' ? value : undefined; }
  catch { return undefined; }
}

function timestampIso(value: any): string | null {
  const date = value?.toDate?.() ?? (value instanceof Date ? value : null);
  return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** Explicit public allowlist: never expose scripts, emails, billing, or provider job URLs. */
export function toPublicPodcastClip(id: string, job: Record<string, any>) {
  const videoUrl = publicHttpsUrl(job.videoUrl);
  if (job.status !== 'COMPLETED' || job.refunded === true || !videoUrl) return null;
  return {
    id,
    title: typeof job.title === 'string' && job.title.trim() ? job.title.trim().slice(0, 120) : 'Podcast episode',
    videoUrl,
    posterUrl: publicHttpsUrl(job.posterUrl),
    styleId: typeof job.styleId === 'string' ? job.styleId : 'studio',
    duration: 30,
    createdAt: timestampIso(job.completedAt) || timestampIso(job.createdAt),
  };
}
