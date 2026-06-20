import { Router } from 'express';
import { db } from '../../db';
import { instagramConnections } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { 
  exchangeCodeForToken, 
  exchangeForLongLivedToken,
  getInstagramBusinessAccount,
  refreshLongLivedToken,
  InstagramGraphAPI
} from '../services/instagram-api';
import { authenticate } from '../middleware/auth';

const router = Router();

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const REDIRECT_URI = process.env.INSTAGRAM_REDIRECT_URI || 'https://your-replit-url.replit.dev/api/instagram/auth/callback';

/**
 * @route   GET /api/instagram/auth/connect
 * @desc    Initiate Instagram OAuth flow
 * @access  Private
 */
router.get('/connect', authenticate, (req, res) => {
  const authUrl = `https://www.facebook.com/v22.0/dialog/oauth?` +
    `client_id=${FACEBOOK_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=instagram_basic,instagram_content_publish,instagram_manage_insights,pages_show_list` +
    `&response_type=code` +
    `&state=${req.user?.id || ''}`;

  res.json({ authUrl });
});

/**
 * @route   GET /api/instagram/auth/callback
 * @desc    Handle OAuth callback from Instagram
 * @access  Public (but validates state)
 */
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.redirect('/?error=instagram_auth_failed');
  }

  const userId = parseInt(state as string);

  try {
    // Step 1: Exchange authorization code for short-lived token
    const shortTokenData = await exchangeCodeForToken(
      code as string,
      FACEBOOK_APP_ID,
      FACEBOOK_APP_SECRET,
      REDIRECT_URI
    );

    // Step 2: Exchange short-lived token for long-lived token (60 days)
    const longTokenData = await exchangeForLongLivedToken(
      shortTokenData.access_token,
      FACEBOOK_APP_ID,
      FACEBOOK_APP_SECRET
    );

    // Step 3: Get Facebook Pages with Instagram Business accounts
    const pagesWithIG = await getInstagramBusinessAccount(longTokenData.access_token);

    if (pagesWithIG.length === 0) {
      return res.redirect('/?error=no_instagram_business_account');
    }

    const firstPage = pagesWithIG[0];
    const instagramUserId = firstPage.instagram_business_account.id;

    // Step 4: Get Instagram username
    const igApi = new InstagramGraphAPI(firstPage.access_token, instagramUserId);
    const profile = await igApi.getProfile();

    // Step 5: Calculate token expiration (60 days from now)
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 60);

    // Step 6: Save or update connection in database
    const existingConnection = await db.query.instagramConnections.findFirst({
      where: eq(instagramConnections.userId, userId)
    });

    if (existingConnection) {
      // Update existing connection
      await db.update(instagramConnections)
        .set({
          accessToken: longTokenData.access_token,
          instagramUserId,
          instagramUsername: profile.username,
          pageId: firstPage.id,
          pageAccessToken: firstPage.access_token,
          tokenExpiresAt,
          isActive: true,
          updatedAt: new Date()
        })
        .where(eq(instagramConnections.userId, userId));
    } else {
      // Create new connection
      await db.insert(instagramConnections).values({
        userId,
        accessToken: longTokenData.access_token,
        instagramUserId,
        instagramUsername: profile.username,
        pageId: firstPage.id,
        pageAccessToken: firstPage.access_token,
        tokenExpiresAt,
        isActive: true
      });
    }

    // Redirect to success page
    res.redirect('/instagram-boost?connected=true');

  } catch (error: any) {
    console.error('Instagram OAuth callback error:', error);
    res.redirect(`/?error=instagram_auth_failed&message=${encodeURIComponent(error.message)}`);
  }
});

/**
 * @route   GET /api/instagram/auth/status
 * @desc    Check if user has connected Instagram account
 * @access  Private
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const connection = await db.query.instagramConnections.findFirst({
      where: eq(instagramConnections.userId, req.user!.id)
    });

    if (!connection) {
      return res.json({ connected: false });
    }

    // Check if token is expired
    const isExpired = new Date() >= new Date(connection.tokenExpiresAt);

    res.json({
      connected: connection.isActive && !isExpired,
      username: connection.instagramUsername,
      expiresAt: connection.tokenExpiresAt,
      needsRefresh: isExpired
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/instagram/auth/disconnect
 * @desc    Disconnect Instagram account
 * @access  Private
 */
router.post('/disconnect', authenticate, async (req, res) => {
  try {
    await db.update(instagramConnections)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(instagramConnections.userId, req.user!.id));

    res.json({ success: true, message: 'Instagram account disconnected' });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/instagram/auth/refresh
 * @desc    Refresh Instagram access token
 * @access  Private
 */
router.post('/refresh', authenticate, async (req, res) => {
  try {
    const connection = await db.query.instagramConnections.findFirst({
      where: eq(instagramConnections.userId, req.user!.id)
    });

    if (!connection) {
      return res.status(404).json({ error: 'No Instagram connection found' });
    }

    // Refresh the long-lived token
    const refreshedTokenData = await refreshLongLivedToken(
      connection.accessToken,
      FACEBOOK_APP_ID,
      FACEBOOK_APP_SECRET
    );

    // Update token expiration (another 60 days)
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 60);

    await db.update(instagramConnections)
      .set({
        accessToken: refreshedTokenData.access_token,
        tokenExpiresAt,
        updatedAt: new Date()
      })
      .where(eq(instagramConnections.userId, req.user!.id));

    res.json({ 
      success: true, 
      message: 'Token refreshed successfully',
      expiresAt: tokenExpiresAt
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper function to get Instagram API instance for a user
 */
export async function getInstagramAPIForUser(userId: number): Promise<InstagramGraphAPI | null> {
  const connection = await db.query.instagramConnections.findFirst({
    where: eq(instagramConnections.userId, userId)
  });

  if (!connection || !connection.isActive) {
    return null;
  }

  // Check if token is expired
  if (new Date() >= new Date(connection.tokenExpiresAt)) {
    return null;
  }

  return new InstagramGraphAPI(connection.pageAccessToken, connection.instagramUserId);
}

export default router;
