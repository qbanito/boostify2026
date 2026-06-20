import { Router } from 'express';
import { db } from '@db';
import { users, marketingMetrics } from '@db/schema';
import { eq, or } from 'drizzle-orm';
import { db as firestore } from '../firebase';

const router = Router();

// GET /api/artist - Get current authenticated user's artist profile
router.get('/', async (req, res) => {
  try {
    const authUser = req.user as any;
    if (!authUser || !authUser.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userId = authUser.id;
    
    // Determine if userId is a Clerk ID (string starting with 'user_') or PostgreSQL ID (number)
    let user;
    if (typeof userId === 'string' && userId.startsWith('user_')) {
      // Clerk ID - look up by clerkId field
      [user] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, userId))
        .limit(1);
    } else {
      // PostgreSQL ID (number) - look up by id field
      const numericId = typeof userId === 'number' ? userId : parseInt(userId);
      [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, numericId))
        .limit(1);
    }

    if (!user) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Try to get profile data from Firestore using PostgreSQL user ID
    let firestoreProfile = null;
    try {
      const userDoc = await firestore.collection('users').doc(String(user.id)).get();
      if (userDoc.exists) {
        firestoreProfile = userDoc.data();
      }
    } catch (error) {
      console.log('No Firestore profile found, using PostgreSQL data');
    }

    // Get marketing metrics
    const [metrics] = await db
      .select()
      .from(marketingMetrics)
      .where(eq(marketingMetrics.userId, user.id))
      .limit(1);

    const artistData = {
      id: user.id,
      name: firestoreProfile?.displayName || firestoreProfile?.name || user.username || user.artistName || 'Artist',
      biography: firestoreProfile?.biography || user.biography || '',
      genre: firestoreProfile?.genre || user.genre || '',
      location: firestoreProfile?.location || user.location || '',
      email: user.email,
      profileImage: firestoreProfile?.profileImage || firestoreProfile?.photoURL || user.profileImage || '',
      bannerImage: firestoreProfile?.bannerImage || user.coverImage || '',
      slug: firestoreProfile?.slug || user.slug || '',
      socialMedia: {
        instagram: firestoreProfile?.instagram || user.instagramHandle || '',
        twitter: firestoreProfile?.twitter || user.twitterHandle || '',
        youtube: firestoreProfile?.youtube || user.youtubeChannel || '',
        spotify: firestoreProfile?.spotify || user.spotifyUrl || ''
      },
      stats: {
        monthlyListeners: metrics?.monthlyListeners || 0,
        followers: metrics?.instagramFollowers || 0,
        views: metrics?.youtubeViews || 0
      }
    };

    res.json(artistData);
  } catch (error) {
    console.error('Error fetching authenticated artist data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/artist/my-artists - Get current artist + AI generated artists for promotions
// IMPORTANT: This route MUST be defined BEFORE /:id to avoid being caught by the wildcard
router.get('/my-artists', async (req, res) => {
  try {
    const authUser = req.user as any;
    if (!authUser || !authUser.id) {
      return res.status(401).json({ success: false, error: 'Not authenticated', artists: [], currentArtist: null });
    }

    const userId = authUser.id;
    
    // Determine PostgreSQL user ID
    let currentUser;
    if (typeof userId === 'string' && userId.startsWith('user_')) {
      [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.clerkId, userId))
        .limit(1);
    } else {
      const numericId = typeof userId === 'number' ? userId : parseInt(userId);
      [currentUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, numericId))
        .limit(1);
    }

    if (!currentUser) {
      return res.status(404).json({ success: false, error: 'User not found', artists: [], currentArtist: null });
    }

    // Map user to ArtistProfile format
    const mapToArtistProfile = (user: any) => ({
      id: user.id,
      artistName: user.artistName || user.username || 'Unknown Artist',
      youtubeChannel: user.youtubeChannel,
      topYoutubeVideos: user.topYoutubeVideos || [],
      spotifyUrl: user.spotifyUrl,
      genres: user.genres || (user.genre ? [user.genre] : []),
      genre: user.genre,
      instagramHandle: user.instagramHandle,
      twitterHandle: user.twitterHandle,
      tiktokUrl: user.tiktokUrl,
      facebookUrl: user.facebookUrl,
      biography: user.biography,
      profileImage: user.profileImage || user.profileImageUrl,
      coverImage: user.coverImage,
      location: user.location,
      country: user.country,
      isAIGenerated: user.isAIGenerated || false,
    });

    const currentArtist = mapToArtistProfile(currentUser);

    // Get AI-generated artists created by this user
    const aiArtists = await db
      .select()
      .from(users)
      .where(eq(users.generatedBy, currentUser.id));

    const myArtists = aiArtists.map(mapToArtistProfile);

    res.json({
      success: true,
      currentArtist,
      artists: myArtists,
    });
  } catch (error) {
    console.error('Error fetching my artists:', error);
    res.status(500).json({ success: false, error: 'Internal server error', artists: [], currentArtist: null });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID is a valid number
    const numericId = parseInt(id);
    if (isNaN(numericId)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    // Get user data from PostgreSQL
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, numericId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Try to get profile data from Firestore first (using user ID as uid)
    let firestoreProfile = null;
    try {
      const userDoc = await firestore.collection('users').doc(String(id)).get();
      if (userDoc.exists) {
        firestoreProfile = userDoc.data();
      }
    } catch (error) {
      console.log('No Firestore profile found, using PostgreSQL data');
    }

    // Get marketing metrics from PostgreSQL
    const [metrics] = await db
      .select()
      .from(marketingMetrics)
      .where(eq(marketingMetrics.userId, user.id))
      .limit(1);

    // Get music from Firestore (with defensive error handling)
    let music: any[] = [];
    try {
      const musicSnapshot = await firestore
        .collection('songs')
        .where('userId', '==', user.id)
        .get();

      music = musicSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.name,
          url: data.audioUrl,
          storageRef: data.storageRef,
          createdAt: data.createdAt?.toDate()
        };
      });
    } catch (error) {
      console.log('Error fetching music from Firestore, returning empty array');
    }

    // Get videos from Firestore (with defensive error handling)
    let videos: any[] = [];
    try {
      const videosSnapshot = await firestore
        .collection('videos')
        .where('userId', '==', user.id)
        .get();

      videos = videosSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title,
          url: data.url,
          thumbnail: data.thumbnailUrl,
          createdAt: data.createdAt?.toDate()
        };
      });
    } catch (error) {
      console.log('Error fetching videos from Firestore, returning empty array');
    }

    // Combine all data, prioritizing Firestore profile data if available
    const artistData = {
      name: firestoreProfile?.displayName || firestoreProfile?.name || user.username || user.artistName || 'Artist',
      biography: firestoreProfile?.biography || user.biography || 'Biography not available',
      genre: firestoreProfile?.genre || user.genre || 'Genre not specified',
      location: firestoreProfile?.location || user.location || 'Location not specified',
      email: user.email,
      phone: firestoreProfile?.contactPhone || user.phone || 'Phone not specified',
      website: user.website || '',
      profileImage: firestoreProfile?.profileImage || firestoreProfile?.photoURL || user.profileImage || '',
      bannerImage: firestoreProfile?.bannerImage || user.coverImage || '',
      bannerPosition: firestoreProfile?.bannerPosition || '50',
      loopVideoUrl: firestoreProfile?.loopVideoUrl || '',
      slug: firestoreProfile?.slug || user.slug || '',
      socialMedia: {
        instagram: firestoreProfile?.instagram || user.instagramHandle || '',
        twitter: firestoreProfile?.twitter || user.twitterHandle || '',
        youtube: firestoreProfile?.youtube || user.youtubeChannel || '',
        spotify: firestoreProfile?.spotify || user.spotifyUrl || ''
      },
      stats: {
        monthlyListeners: metrics?.monthlyListeners || 0,
        followers: metrics?.instagramFollowers || 0,
        views: metrics?.youtubeViews || 0
      },
      music,
      videos,
      technicalRider: user.technicalRider || {
        stage: 'Standard stage setup with minimum dimensions of 6x4 meters',
        sound: 'Professional PA system with minimum 4 monitor speakers',
        lighting: 'Basic stage lighting with ability to control colors and intensity',
        backline: 'Drum kit, bass amp, and guitar amps provided by venue'
      }
    };

    res.json(artistData);
  } catch (error) {
    console.error('Error fetching artist data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;