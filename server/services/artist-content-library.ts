import { desc, inArray } from 'drizzle-orm';
import { db as firestoreDb } from '../firebase';
import { db as pgDb, pool } from '../db';
import { artistAvatarVideos } from '../../db/schema';
import { ArtistIdentity, resolveArtistIdentity } from './artist-identity-resolver';

export type ArtistVideoSource = 'promo_clips' | 'cinematic' | 'avatar_talk' | 'lyrics_video';

export interface ArtistVideoAsset {
  id: string;
  url: string;
  source: ArtistVideoSource;
  label: string;
  thumbnail?: string;
  title?: string;
  songId?: string | number | null;
  songTitle?: string | null;
  duration?: number | null;
  aspectRatio?: string | null;
  createdAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ArtistVideoAssetResult {
  identity: ArtistIdentity;
  videos: ArtistVideoAsset[];
}

function toIso(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  return null;
}

function pushVideo(videos: ArtistVideoAsset[], seenUrls: Set<string>, asset: Omit<ArtistVideoAsset, 'id'> & { id?: string }) {
  if (!asset.url || seenUrls.has(asset.url)) return;
  seenUrls.add(asset.url);
  videos.push({ ...asset, id: asset.id || `${asset.source}_${videos.length + 1}` });
}

async function collectPromoClipVideos(identity: ArtistIdentity, videos: ArtistVideoAsset[], seenUrls: Set<string>) {
  for (const candidateId of identity.textIds.slice(0, 6)) {
    try {
      const snap = await firestoreDb.collection('artistPromoGalleries')
        .where('userId', '==', candidateId)
        .limit(20)
        .get();

      for (const doc of snap.docs) {
        const data = doc.data();
        if (data.videoUrl) {
          pushVideo(videos, seenUrls, {
            id: `promo_gallery_${doc.id}`,
            url: data.videoUrl,
            source: 'promo_clips',
            label: `Promo: ${data.singleName || data.title || 'Video'}`,
            thumbnail: data.thumbnailUrl || data.thumbnail,
            title: data.singleName || data.title,
            songTitle: data.singleName || data.songTitle || null,
            createdAt: toIso(data.createdAt),
            metadata: { collection: 'artistPromoGalleries', docId: doc.id },
          });
        }

        const generatedVideos: any[] = data.generatedVideos || [];
        generatedVideos.slice(0, 3).forEach((video, index) => {
          if (!video?.url) return;
          pushVideo(videos, seenUrls, {
            id: `promo_gallery_${doc.id}_${index}`,
            url: video.url,
            source: 'promo_clips',
            label: `Promo: ${data.singleName || data.title || 'Clip'}`,
            thumbnail: video.thumbnail || data.thumbnailUrl,
            title: data.singleName || data.title,
            songTitle: data.singleName || data.songTitle || null,
            duration: typeof video.duration === 'number' ? video.duration : null,
            aspectRatio: video.aspectRatio || data.aspectRatio || null,
            createdAt: toIso(data.createdAt),
            metadata: { collection: 'artistPromoGalleries', docId: doc.id, index },
          });
        });
      }
    } catch {
      // Optional source; ignore missing indexes/collections.
    }

    try {
      const snap = await firestoreDb.collection('promoClips')
        .where('artistId', '==', candidateId)
        .limit(15)
        .get();

      for (const doc of snap.docs) {
        const data = doc.data();
        if (!data.videoUrl) continue;
        pushVideo(videos, seenUrls, {
          id: `cinematic_${doc.id}`,
          url: data.videoUrl,
          source: 'cinematic',
          label: `Cinematic: ${data.title || data.songTitle || 'Promo'}`,
          thumbnail: data.thumbnail || data.thumbnailUrl,
          title: data.title || data.songTitle,
          songTitle: data.songTitle || null,
          createdAt: toIso(data.createdAt),
          metadata: { collection: 'promoClips', docId: doc.id },
        });
      }
    } catch {
      // Optional source; ignore missing indexes/collections.
    }
  }
}

async function collectAvatarTalkVideos(identity: ArtistIdentity, videos: ArtistVideoAsset[], seenUrls: Set<string>) {
  if (!identity.textIds.length) return;

  try {
    const rows = await pgDb
      .select()
      .from(artistAvatarVideos)
      .where(inArray(artistAvatarVideos.artistId, identity.textIds))
      .orderBy(desc(artistAvatarVideos.createdAt))
      .limit(20);

    for (const row of rows) {
      if (row.status !== 'ready') continue;
      pushVideo(videos, seenUrls, {
        id: `avatar_talk_${row.id}`,
        url: row.videoUrl,
        source: 'avatar_talk',
        label: `Avatar Talk: ${row.title || row.scene || 'Artist update'}`,
        thumbnail: row.thumbnailUrl || undefined,
        title: row.title || undefined,
        aspectRatio: row.aspectRatio || null,
        createdAt: toIso(row.createdAt),
        metadata: {
          videoId: row.id,
          scene: row.scene,
          voice: row.voice,
          talkingStyle: row.talkingStyle,
          captionsEnabled: row.captionsEnabled,
        },
      });
    }
  } catch {
    // Optional table; ignore when migration has not run.
  }
}

async function collectLyricsVideoAssets(identity: ArtistIdentity, videos: ArtistVideoAsset[], seenUrls: Set<string>) {
  if (!identity.numericId) return;

  try {
    const { rows } = await pool.query(
      `SELECT id, output_url, youtube_url, song_id, song_title, artist_name, cover_art_url,
              duration_secs, theme, accent_color, created_at
       FROM lyrics_video_jobs
       WHERE artist_id=$1 AND status='done' AND output_url IS NOT NULL
       ORDER BY created_at DESC LIMIT 20`,
      [identity.numericId]
    );

    for (const row of rows) {
      pushVideo(videos, seenUrls, {
        id: `lyrics_video_${row.id}`,
        url: row.output_url,
        source: 'lyrics_video',
        label: `Lyrics Video: ${row.song_title || 'Rendered video'}`,
        thumbnail: row.cover_art_url || undefined,
        title: row.song_title || undefined,
        songId: row.song_id,
        songTitle: row.song_title || null,
        duration: row.duration_secs ? Number(row.duration_secs) : null,
        aspectRatio: '16:9',
        createdAt: toIso(row.created_at),
        metadata: {
          jobId: row.id,
          artistName: row.artist_name,
          youtubeUrl: row.youtube_url,
          theme: row.theme,
          accentColor: row.accent_color,
        },
      });
    }
  } catch {
    // Optional table; ignore when migration has not run.
  }
}

export async function listArtistVideoAssets(artistId: string | number): Promise<ArtistVideoAssetResult> {
  const identity = await resolveArtistIdentity(artistId);
  const videos: ArtistVideoAsset[] = [];
  const seenUrls = new Set<string>();

  await collectPromoClipVideos(identity, videos, seenUrls);
  await collectAvatarTalkVideos(identity, videos, seenUrls);
  await collectLyricsVideoAssets(identity, videos, seenUrls);

  videos.sort((a, b) => {
    const left = a.createdAt ? Date.parse(a.createdAt) : 0;
    const right = b.createdAt ? Date.parse(b.createdAt) : 0;
    return right - left;
  });

  return { identity, videos };
}