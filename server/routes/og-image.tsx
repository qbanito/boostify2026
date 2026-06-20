import { Router } from 'express';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { db as pgDb } from '../db';
import { users, artistNews, songs } from '@db/schema';
import { eq } from 'drizzle-orm';
import { neon } from '@neondatabase/serverless';
import React from 'react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Load fonts once at startup
let fontBold: Buffer | null = null;
let fontRegular: Buffer | null = null;

function loadFonts() {
  if (!fontBold) {
    const boldPath = path.resolve(__dirname, '..', 'fonts', 'Inter-Bold.ttf');
    const regularPath = path.resolve(__dirname, '..', 'fonts', 'Inter-Regular.ttf');
    try {
      fontBold = fs.readFileSync(boldPath);
      fontRegular = fs.readFileSync(regularPath);
      console.log('[OG Image] Fonts loaded successfully');
    } catch (e) {
      console.error('[OG Image] Font files not found at:', boldPath);
      fontBold = null;
      fontRegular = null;
    }
  }
}

function getFontConfig() {
  loadFonts();
  const fonts: any[] = [];
  if (fontBold) {
    fonts.push({ name: 'Inter', data: fontBold, weight: 700 as const, style: 'normal' as const });
  }
  if (fontRegular) {
    fonts.push({ name: 'Inter', data: fontRegular, weight: 400 as const, style: 'normal' as const });
  }
  return fonts;
}

/**
 * Convert image URL to a base64 data URI so satori can render it.
 * Handles both relative URLs (local files) and absolute URLs (internet).
 */
async function fetchImageAsDataUri(imageUrl: string): Promise<string | null> {
  try {
    let url = imageUrl;

    // Skip obvious non-image assets (e.g. .mp4 video banners) so satori falls
    // back to the placeholder instead of trying to embed a video as an <img>.
    if (/\.(mp4|webm|mov|m4v|avi|mkv|flv|mp3|wav|m4a|aac|ogg|opus|pdf)(\?|#|$)/i.test(url)) {
      return null;
    }

    // If relative URL, try local filesystem first
    if (url.startsWith('/')) {
      const possiblePaths = [
        path.resolve(__dirname, '..', '..', 'client', 'public', url.replace(/^\//, '')),
        path.resolve(__dirname, '..', '..', 'public', url.replace(/^\//, '')),
        path.resolve(__dirname, '..', '..', url.replace(/^\//, '')),
      ];
      
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          const data = fs.readFileSync(filePath);
          const ext = path.extname(filePath).toLowerCase();
          const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
          return `data:${mime};base64,${data.toString('base64')}`;
        }
      }
      
      // Try fetching from local server
      const port = process.env.PORT || '5000';
      url = `http://localhost:${port}${imageUrl}`;
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: { 'User-Agent': 'BoostifyOG/1.0' }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    // Only embed real images; reject video/html/json so satori never chokes.
    if (!/^image\//i.test(contentType)) return null;
    const buffer = await response.arrayBuffer();
    return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
  } catch (error) {
    console.log(`[OG Image] Could not fetch image: ${imageUrl}`, (error as Error).message);
    return null;
  }
}

/**
 * Render React JSX to PNG buffer using satori + resvg
 */
async function renderToPng(element: React.ReactNode, width = 1200, height = 630): Promise<Buffer> {
  const fonts = getFontConfig();
  
  if (fonts.length === 0) {
    throw new Error('No fonts available for OG image generation');
  }

  const svg = await satori(element as any, {
    width,
    height,
    fonts,
  });
  
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width' as const, value: width },
  });
  
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}

// ============================================================
// Endpoint: OG image by Firestore artist ID
// ============================================================
router.get('/artist/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;
    
    const userDoc = await getDocs(query(collection(db, "users"), where("uid", "==", artistId)));
    
    if (userDoc.empty) {
      return res.status(404).json({ error: 'Artist not found' });
    }
    
    const artistData = userDoc.docs[0].data();
    
    const artistName = artistData.name || artistData.displayName || 'Unknown Artist';
    const genre = artistData.genre || 'Music';
    const biography = artistData.biography || 'Music Artist on Boostify Music';
    const rawImage = artistData.photoURL || artistData.profileImage || '';
    
    // Convert image to data URI for satori
    const profileImage = rawImage ? await fetchImageAsDataUri(rawImage) : null;
    
    const pngBuffer = await renderToPng(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          backgroundImage: 'linear-gradient(135deg, #000000 0%, #1a0a00 50%, #000000 100%)',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: '60px 80px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left side - Artist info */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              maxWidth: '600px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '40px' }}>
              <div style={{ fontSize: '32px', fontWeight: 700, color: '#ea580c' }}>
                BOOSTIFY MUSIC
              </div>
            </div>
            
            <div style={{ fontSize: '64px', fontWeight: 700, color: '#fff', lineHeight: 1.1, marginBottom: '20px' }}>
              {artistName}
            </div>
            
            <div style={{ display: 'flex', marginBottom: '25px' }}>
              <div
                style={{
                  backgroundColor: '#ea580c',
                  color: '#fff',
                  padding: '12px 28px',
                  borderRadius: '50px',
                  fontSize: '24px',
                  fontWeight: 700,
                }}
              >
                {genre}
              </div>
            </div>
            
            <div style={{ fontSize: '22px', color: '#cbd5e1', lineHeight: 1.5, display: 'flex' }}>
              {biography.length > 120 ? biography.substring(0, 120) + '...' : biography}
            </div>
          </div>
          
          {/* Right side - Artist image */}
          {profileImage ? (
            <div
              style={{
                display: 'flex',
                width: '350px',
                height: '350px',
                borderRadius: '24px',
                overflow: 'hidden',
                marginLeft: '60px',
                border: '4px solid #ea580c',
              }}
            >
              <img src={profileImage} width={350} height={350} style={{ objectFit: 'cover' }} />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                width: '350px',
                height: '350px',
                borderRadius: '24px',
                border: '4px solid #ea580c',
                backgroundColor: '#1a1a2e',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '100px',
                marginLeft: '60px',
              }}
            >
              🎤
            </div>
          )}
        </div>
        
        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '8px',
            background: 'linear-gradient(90deg, #ea580c 0%, #f97316 50%, #ea580c 100%)',
            display: 'flex',
          }}
        />
      </div>
    );
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
    res.send(pngBuffer);
    
  } catch (error) {
    console.error('Error generating OG image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// ============================================================
// Endpoint: OG image for news articles
// ============================================================
router.get('/news/:newsId', async (req, res) => {
  try {
    const { newsId } = req.params;
    
    const [newsItem] = await pgDb
      .select({
        title: artistNews.title,
        summary: artistNews.summary,
        imageUrl: artistNews.imageUrl,
        category: artistNews.category,
        artistName: users.artistName,
        profileImage: users.profileImage
      })
      .from(artistNews)
      .leftJoin(users, eq(artistNews.userId, users.id))
      .where(eq(artistNews.id, parseInt(newsId)))
      .limit(1);
    
    if (!newsItem) {
      return res.status(404).json({ error: 'News article not found' });
    }
    
    const categoryColors: Record<string, { bg: string; text: string }> = {
      release: { bg: '#10B981', text: 'Lanzamiento' },
      performance: { bg: '#8B5CF6', text: 'Performance' },
      collaboration: { bg: '#F59E0B', text: 'Colaboracion' },
      achievement: { bg: '#EF4444', text: 'Logro' },
      lifestyle: { bg: '#3B82F6', text: 'Lifestyle' }
    };

    const categoryInfo = categoryColors[newsItem.category as keyof typeof categoryColors] || { bg: '#FF6B35', text: newsItem.category };
    
    const profileImg = newsItem.profileImage ? await fetchImageAsDataUri(newsItem.profileImage) : null;
    const title = newsItem.title && newsItem.title.length > 80 ? newsItem.title.substring(0, 77) + '...' : (newsItem.title || '');
    const summary = newsItem.summary && newsItem.summary.length > 120 ? newsItem.summary.substring(0, 117) + '...' : (newsItem.summary || '');
    
    const pngBuffer = await renderToPng(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#000',
          backgroundImage: 'linear-gradient(135deg, #000000 0%, #1a0a00 50%, #000000 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: '60px 80px',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '32px', fontWeight: 700, color: '#ea580c' }}>
              BOOSTIFY MUSIC
            </div>
            <div
              style={{
                padding: '12px 32px',
                borderRadius: '999px',
                fontSize: '24px',
                fontWeight: 700,
                color: '#fff',
                backgroundColor: categoryInfo.bg,
                display: 'flex',
              }}
            >
              {categoryInfo.text}
            </div>
          </div>
          
          <div style={{ fontSize: '56px', fontWeight: 700, color: '#fff', lineHeight: 1.2, display: 'flex' }}>
            {title}
          </div>
          
          <div style={{ fontSize: '28px', color: 'rgba(255, 255, 255, 0.8)', lineHeight: 1.4, display: 'flex' }}>
            {summary}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {profileImg && (
              <img
                src={profileImg}
                width={60}
                height={60}
                style={{ borderRadius: '50%', border: '3px solid #ea580c', marginRight: '20px' }}
              />
            )}
            <div style={{ fontSize: '28px', color: '#fff', fontWeight: 700 }}>
              {newsItem.artistName || 'Boostify Music'}
            </div>
          </div>
        </div>
      </div>
    );

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(pngBuffer);
  } catch (error) {
    console.error('Error generating news OG image:', error);
    return res.status(500).json({ error: 'Failed to generate OG image' });
  }
});

// ============================================================
// Endpoint: Professional OG image for artist by slug (MAIN)
// Used when sharing artist pages on Facebook, WhatsApp, Twitter, etc.
// ============================================================
router.get('/artist/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    const [artist] = await pgDb
      .select({
        artistName: users.artistName,
        biography: users.biography,
        profileImage: users.profileImage,
        coverImage: users.coverImage,
        genres: users.genres,
        location: users.location,
        country: users.country,
        role: users.role,
        instagramHandle: users.instagramHandle,
        spotifyUrl: users.spotifyUrl,
        firestoreId: users.firestoreId,
        clerkId: users.clerkId,
      })
      .from(users)
      .where(eq(users.slug, slug))
      .limit(1);
    
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }
    
    const genre = artist.genres?.[0] || '';
    const location = artist.location || artist.country || '';
    const hasSpotify = !!artist.spotifyUrl;
    const hasInstagram = !!artist.instagramHandle;
    const bio = artist.biography 
      ? (artist.biography.length > 90 ? artist.biography.substring(0, 87) + '...' : artist.biography)
      : '';
    const nameSize = artist.artistName && artist.artistName.length > 16 ? 56 : 72;
    
    // Resolve profile image: Postgres first, Firestore fallback
    let rawProfileImage = artist.profileImage || '';
    if (!rawProfileImage && (artist.firestoreId || artist.clerkId)) {
      try {
        const firestoreUid = artist.firestoreId || artist.clerkId;
        const snap = await getDocs(query(collection(db, 'users'), where('uid', '==', firestoreUid)));
        if (!snap.empty) {
          const fsData = snap.docs[0].data();
          rawProfileImage = fsData.profileImage || fsData.photoURL || '';
        }
      } catch (_) {}
    }

    // Fetch profile image as data URI for satori
    const profileImg = rawProfileImage ? await fetchImageAsDataUri(rawProfileImage) : null;

    console.log(`[OG Image] Generating for slug: ${slug}, artist: ${artist.artistName}, hasImage: ${!!profileImg}`);

    const pngBuffer = await renderToPng(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          position: 'relative',
          backgroundColor: '#0a0a0a',
          backgroundImage: 'linear-gradient(135deg, #0a0a0a 0%, #1a0d00 40%, #0d0d0d 100%)',
        }}
      >
        {/* Main content layout */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: '50px 70px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Left side - Artist Info */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              maxWidth: '620px',
            }}
          >
            {/* Boostify Logo + accent bar */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '8px',
                  height: '32px',
                  background: 'linear-gradient(180deg, #ea580c, #f97316)',
                  borderRadius: '4px',
                  display: 'flex',
                  marginRight: '12px',
                }}
              />
              <div
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#ea580c',
                  letterSpacing: '3px',
                }}
              >
                BOOSTIFY MUSIC
              </div>
            </div>
            
            {/* Artist Name - Big & Bold */}
            <div
              style={{
                fontSize: `${nameSize}px`,
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.05,
                letterSpacing: '-1px',
                marginBottom: '16px',
                display: 'flex',
              }}
            >
              {artist.artistName || 'Artist'}
            </div>
            
            {/* Genre & Location badges */}
            <div style={{ display: 'flex', marginBottom: '20px' }}>
              {genre ? (
                <div
                  style={{
                    padding: '10px 24px',
                    borderRadius: '999px',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: '#fff',
                    background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
                    marginRight: '12px',
                    display: 'flex',
                  }}
                >
                  {genre.toUpperCase()}
                </div>
              ) : null}
              {location ? (
                <div
                  style={{
                    padding: '10px 24px',
                    borderRadius: '999px',
                    fontSize: '20px',
                    color: '#e2e8f0',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    border: '2px solid rgba(234,88,12,0.4)',
                    display: 'flex',
                  }}
                >
                  {location}
                </div>
              ) : null}
            </div>
            
            {/* Biography snippet */}
            {bio ? (
              <div
                style={{
                  fontSize: '21px',
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.5,
                  marginBottom: '20px',
                  display: 'flex',
                }}
              >
                {bio}
              </div>
            ) : null}

            {/* Platform / CTA row */}
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '8px' }}>
              {hasSpotify ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: '#1DB954',
                    fontSize: '18px',
                    fontWeight: 700,
                    marginRight: '24px',
                  }}
                >
                  Spotify
                </div>
              ) : null}
              {hasInstagram ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    color: '#E1306C',
                    fontSize: '18px',
                    fontWeight: 700,
                    marginRight: '24px',
                  }}
                >
                  Instagram
                </div>
              ) : null}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: '#f97316',
                  fontSize: '16px',
                  fontWeight: 700,
                  padding: '8px 20px',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(234,88,12,0.15)',
                  border: '1px solid rgba(234,88,12,0.3)',
                }}
              >
                Listen Now
              </div>
            </div>
          </div>
          
          {/* Right side - Artist Photo */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '40px',
            }}
          >
            {profileImg ? (
              <div style={{ display: 'flex', position: 'relative' }}>
                {/* Glow ring behind image */}
                <div
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '-6px',
                    width: '352px',
                    height: '352px',
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #ea580c, #f97316, #ea580c)',
                    display: 'flex',
                  }}
                />
                <img
                  src={profileImg}
                  width={340}
                  height={340}
                  style={{ borderRadius: '20px', objectFit: 'cover' }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: '340px',
                  height: '340px',
                  borderRadius: '20px',
                  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                  border: '4px solid #ea580c',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '100px',
                }}
              >
                🎤
              </div>
            )}
          </div>
        </div>
        
        {/* Bottom gradient bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '6px',
            background: 'linear-gradient(90deg, #ea580c 0%, #f97316 25%, #fbbf24 50%, #f97316 75%, #ea580c 100%)',
            display: 'flex',
          }}
        />

        {/* Top-right label */}
        <div
          style={{
            position: 'absolute',
            top: '24px',
            right: '30px',
            fontSize: '14px',
            fontWeight: 700,
            color: 'rgba(234,88,12,0.6)',
            letterSpacing: '3px',
            display: 'flex',
          }}
        >
          ARTIST PROFILE
        </div>
      </div>
    );

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
    res.send(pngBuffer);
  } catch (error) {
    console.error('Error generating artist OG image:', error);
    return res.status(500).json({ error: 'Failed to generate OG image' });
  }
});

// ============================================================
// Endpoint: OG image for individual songs
// Used when sharing /song/:id on Facebook, Twitter, LinkedIn, etc.
// Shows a stunning 1200×630 card: cover art + song title + artist + genre
// ============================================================
router.get('/song/:songId', async (req, res) => {
  try {
    const songId = parseInt(req.params.songId, 10);
    if (isNaN(songId)) return res.status(400).json({ error: 'Invalid song ID' });

    const [songItem] = await pgDb
      .select({
        title: songs.title,
        description: songs.description,
        coverArt: songs.coverArt,
        genre: songs.genre,
        mood: songs.mood,
        artistName: users.artistName,
        profileImage: users.profileImage,
        biography: users.biography,
        slug: users.slug,
      })
      .from(songs)
      .leftJoin(users, eq(songs.userId, users.id))
      .where(eq(songs.id, songId))
      .limit(1);

    if (!songItem) return res.status(404).json({ error: 'Song not found' });

    const coverUri = songItem.coverArt ? await fetchImageAsDataUri(songItem.coverArt) : null;
    const profileUri = songItem.profileImage ? await fetchImageAsDataUri(songItem.profileImage) : null;

    const title = songItem.title || 'Unknown Track';
    const artist = songItem.artistName || 'Artist';
    const genre = songItem.genre || '';
    const mood = songItem.mood || '';
    const titleSize = title.length > 22 ? 52 : title.length > 14 ? 64 : 80;

    const pngBuffer = await renderToPng(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          position: 'relative',
          backgroundColor: '#060606',
          backgroundImage: 'linear-gradient(135deg, #060606 0%, #170a00 45%, #060606 100%)',
        }}
      >
        {/* Cover art — full left half blurred background */}
        {coverUri && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '500px',
              height: '100%',
              display: 'flex',
              overflow: 'hidden',
              opacity: 0.18,
            }}
          >
            <img src={coverUri} width={500} height={630} style={{ objectFit: 'cover' }} />
          </div>
        )}

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: '50px 60px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Cover Art box */}
          <div style={{ display: 'flex', position: 'relative', flexShrink: 0 }}>
            {/* Orange glow */}
            <div
              style={{
                position: 'absolute',
                top: '-8px',
                left: '-8px',
                width: '432px',
                height: '432px',
                borderRadius: '28px',
                background: 'linear-gradient(135deg, #ea580c, #f97316, #fbbf24)',
                display: 'flex',
              }}
            />
            {coverUri ? (
              <img
                src={coverUri}
                width={416}
                height={416}
                style={{ borderRadius: '22px', objectFit: 'cover', position: 'relative' }}
              />
            ) : (
              <div
                style={{
                  width: '416px',
                  height: '416px',
                  borderRadius: '22px',
                  background: 'linear-gradient(135deg, #1a0d00 0%, #2a1400 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '120px',
                  position: 'relative',
                }}
              >
                🎵
              </div>
            )}
          </div>

          {/* Right side — Text info */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingLeft: '60px',
              maxWidth: '580px',
            }}
          >
            {/* Boostify label */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  width: '6px',
                  height: '28px',
                  background: 'linear-gradient(180deg, #ea580c, #f97316)',
                  borderRadius: '3px',
                  display: 'flex',
                  marginRight: '10px',
                }}
              />
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#ea580c', letterSpacing: '4px' }}>
                BOOSTIFY MUSIC
              </div>
            </div>

            {/* Song title */}
            <div
              style={{
                fontSize: `${titleSize}px`,
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.05,
                letterSpacing: '-1px',
                marginBottom: '14px',
                display: 'flex',
              }}
            >
              {title}
            </div>

            {/* Artist row with mini avatar */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              {profileUri && (
                <div style={{ position: 'relative', display: 'flex', marginRight: '14px' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      left: '-2px',
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ea580c, #f97316)',
                      display: 'flex',
                    }}
                  />
                  <img src={profileUri} width={44} height={44} style={{ borderRadius: '50%', objectFit: 'cover', position: 'relative' }} />
                </div>
              )}
              <div style={{ fontSize: '30px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', display: 'flex' }}>
                {artist}
              </div>
            </div>

            {/* Genre + Mood badges */}
            <div style={{ display: 'flex', marginBottom: '28px' }}>
              {genre ? (
                <div
                  style={{
                    padding: '10px 24px',
                    borderRadius: '999px',
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#fff',
                    background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
                    marginRight: '10px',
                    display: 'flex',
                  }}
                >
                  {genre.toUpperCase()}
                </div>
              ) : null}
              {mood ? (
                <div
                  style={{
                    padding: '10px 24px',
                    borderRadius: '999px',
                    fontSize: '18px',
                    color: '#e2e8f0',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    border: '2px solid rgba(234,88,12,0.35)',
                    display: 'flex',
                  }}
                >
                  {mood}
                </div>
              ) : null}
            </div>

            {/* Play CTA */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 36px',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
                color: '#fff',
                fontSize: '22px',
                fontWeight: 700,
                width: 'fit-content',
                letterSpacing: '1px',
              }}
            >
              ▶  Listen Now
            </div>
          </div>
        </div>

        {/* Bottom gradient bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '6px',
            background: 'linear-gradient(90deg, #ea580c 0%, #f97316 25%, #fbbf24 50%, #f97316 75%, #ea580c 100%)',
            display: 'flex',
          }}
        />

        {/* Top-right stamp */}
        <div
          style={{
            position: 'absolute',
            top: '22px',
            right: '28px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'rgba(234,88,12,0.55)',
            letterSpacing: '3px',
            display: 'flex',
          }}
        >
          NOW PLAYING
        </div>
      </div>
    );

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
    res.send(pngBuffer);
  } catch (error) {
    console.error('Error generating song OG image:', error);
    return res.status(500).json({ error: 'Failed to generate OG image' });
  }
});

// ============================================================
// Endpoint: OG image for a shareable playlist  /api/og-image/playlist/:id
// Used by the social-share card of /embed/playlist/:id
// ============================================================
router.get('/playlist/:id', async (req, res) => {
  try {
    const playlistId = parseInt(req.params.id, 10);
    if (isNaN(playlistId)) return res.status(400).json({ error: 'Invalid playlist ID' });

    const sql = neon(process.env.DATABASE_URL!);
    const [pl] = await sql`
      SELECT p.title, p.description, p.cover_art, p.is_public,
             u.artist_name, u.first_name, u.last_name, u.username,
             u.profile_image, u.profile_image_url,
             (SELECT COUNT(*) FROM playlist_songs ps WHERE ps.playlist_id = p.id) AS track_count,
             (SELECT s.cover_art FROM playlist_songs ps2
                INNER JOIN songs s ON s.id = ps2.song_id
                WHERE ps2.playlist_id = p.id
                ORDER BY ps2.order_index ASC, ps2.added_at ASC
                LIMIT 1) AS first_song_cover
      FROM playlists p
      INNER JOIN users u ON u.id = p.user_id
      WHERE p.id = ${playlistId}
      LIMIT 1
    `;

    if (!pl) return res.status(404).json({ error: 'Playlist not found' });

    const ownerName =
      pl.artist_name ||
      [pl.first_name, pl.last_name].filter(Boolean).join(' ') ||
      pl.username ||
      'Boostify';
    const coverSource =
      pl.cover_art || pl.first_song_cover || pl.profile_image_url || pl.profile_image || null;
    const coverUri = coverSource ? await fetchImageAsDataUri(coverSource) : null;
    const profileSource = pl.profile_image_url || pl.profile_image || null;
    const profileUri = profileSource ? await fetchImageAsDataUri(profileSource) : null;

    const title = pl.title || 'Playlist';
    const trackCount = Number(pl.track_count || 0);
    const titleSize = title.length > 22 ? 52 : title.length > 14 ? 64 : 80;

    const pngBuffer = await renderToPng(
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          position: 'relative',
          backgroundColor: '#060606',
          backgroundImage: 'linear-gradient(135deg, #060606 0%, #170a00 45%, #060606 100%)',
        }}
      >
        {/* Cover art — full left half blurred background */}
        {coverUri && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '500px',
              height: '100%',
              display: 'flex',
              overflow: 'hidden',
              opacity: 0.18,
            }}
          >
            <img src={coverUri} width={500} height={630} style={{ objectFit: 'cover' }} />
          </div>
        )}

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: '50px 60px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Cover Art box */}
          <div style={{ display: 'flex', position: 'relative', flexShrink: 0 }}>
            {/* Orange glow */}
            <div
              style={{
                position: 'absolute',
                top: '-8px',
                left: '-8px',
                width: '432px',
                height: '432px',
                borderRadius: '28px',
                background: 'linear-gradient(135deg, #ea580c, #f97316, #fbbf24)',
                display: 'flex',
              }}
            />
            {coverUri ? (
              <img
                src={coverUri}
                width={416}
                height={416}
                style={{ borderRadius: '22px', objectFit: 'cover', position: 'relative' }}
              />
            ) : (
              <div
                style={{
                  width: '416px',
                  height: '416px',
                  borderRadius: '22px',
                  background: 'linear-gradient(135deg, #1a0d00 0%, #2a1400 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '120px',
                  position: 'relative',
                }}
              >
                🎵
              </div>
            )}
            {/* Stacked-playlist hint cards behind the cover */}
            <div
              style={{
                position: 'absolute',
                top: '14px',
                right: '-22px',
                width: '416px',
                height: '416px',
                borderRadius: '22px',
                backgroundColor: 'rgba(249,115,22,0.18)',
                border: '2px solid rgba(249,115,22,0.25)',
                display: 'flex',
                zIndex: -1,
              }}
            />
          </div>

          {/* Right side — Text info */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              paddingLeft: '64px',
              maxWidth: '580px',
            }}
          >
            {/* Playlist label */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  width: '6px',
                  height: '28px',
                  background: 'linear-gradient(180deg, #ea580c, #f97316)',
                  borderRadius: '3px',
                  display: 'flex',
                  marginRight: '10px',
                }}
              />
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#ea580c', letterSpacing: '4px' }}>
                BOOSTIFY · PLAYLIST
              </div>
            </div>

            {/* Playlist title */}
            <div
              style={{
                fontSize: `${titleSize}px`,
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.05,
                letterSpacing: '-1px',
                marginBottom: '14px',
                display: 'flex',
              }}
            >
              {title}
            </div>

            {/* Owner row with mini avatar */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '22px' }}>
              {profileUri && (
                <div style={{ position: 'relative', display: 'flex', marginRight: '14px' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      left: '-2px',
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ea580c, #f97316)',
                      display: 'flex',
                    }}
                  />
                  <img
                    src={profileUri}
                    width={44}
                    height={44}
                    style={{ borderRadius: '50%', objectFit: 'cover', position: 'relative' }}
                  />
                </div>
              )}
              <div style={{ fontSize: '30px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', display: 'flex' }}>
                {ownerName}
              </div>
            </div>

            {/* Track-count badge */}
            <div style={{ display: 'flex', marginBottom: '28px' }}>
              <div
                style={{
                  padding: '10px 24px',
                  borderRadius: '999px',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#fff',
                  background: 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)',
                  display: 'flex',
                }}
              >
                {trackCount > 0 ? `${trackCount} TRACK${trackCount === 1 ? '' : 'S'}` : 'PLAYLIST'}
              </div>
            </div>

            {/* Play CTA */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 36px',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)',
                color: '#fff',
                fontSize: '22px',
                fontWeight: 700,
                width: 'fit-content',
                letterSpacing: '1px',
              }}
            >
              ▶  Play Playlist
            </div>
          </div>
        </div>

        {/* Bottom gradient bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '6px',
            background: 'linear-gradient(90deg, #ea580c 0%, #f97316 25%, #fbbf24 50%, #f97316 75%, #ea580c 100%)',
            display: 'flex',
          }}
        />

        {/* Top-right stamp */}
        <div
          style={{
            position: 'absolute',
            top: '22px',
            right: '28px',
            fontSize: '13px',
            fontWeight: 700,
            color: 'rgba(234,88,12,0.55)',
            letterSpacing: '3px',
            display: 'flex',
          }}
        >
          PLAYLIST
        </div>
      </div>
    );

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
    res.send(pngBuffer);
  } catch (error) {
    console.error('Error generating playlist OG image:', error);
    return res.status(500).json({ error: 'Failed to generate OG image' });
  }
});

export default router;
