import { Router } from 'express';
import { apifyInstagram } from '../services/apify-instagram';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /api/apify/instagram/profile/:username
 * Get Instagram profile data using Apify
 */
router.get('/profile/:username', authenticate, async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    console.log(`📱 API Request: Get profile for @${username}`);
    const profile = await apifyInstagram.getProfile(username);
    
    res.json({ success: true, profile });
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch Instagram profile' 
    });
  }
});

/**
 * GET /api/apify/instagram/posts/:username
 * Get Instagram posts using Apify
 */
router.get('/posts/:username', authenticate, async (req, res) => {
  try {
    const { username } = req.params;
    const limit = parseInt(req.query.limit as string) || 12;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    console.log(`📸 API Request: Get ${limit} posts for @${username}`);
    const posts = await apifyInstagram.getPosts(username, limit);
    
    res.json({ success: true, posts, count: posts.length });
  } catch (error: any) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch Instagram posts' 
    });
  }
});

/**
 * GET /api/apify/instagram/insights/:username
 * Get Instagram insights and analytics using Apify
 */
router.get('/insights/:username', authenticate, async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    console.log(`📊 API Request: Get insights for @${username}`);
    const insights = await apifyInstagram.getInsights(username);
    
    res.json({ success: true, insights });
  } catch (error: any) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch Instagram insights' 
    });
  }
});

/**
 * POST /api/apify/instagram/search
 * Search Instagram profiles by keyword/hashtag using Apify
 */
router.post('/search', authenticate, async (req, res) => {
  try {
    const { keyword, limit = 20 } = req.body;
    
    if (!keyword) {
      return res.status(400).json({ error: 'Keyword is required' });
    }

    console.log(`🔍 API Request: Search profiles with keyword: ${keyword}`);
    const profiles = await apifyInstagram.searchProfiles(keyword, limit);
    
    res.json({ success: true, profiles, count: profiles.length });
  } catch (error: any) {
    console.error('Error searching profiles:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to search Instagram profiles' 
    });
  }
});

/**
 * POST /api/apify/instagram/influencers
 * Search for influencers by niche using Apify
 */
router.post('/influencers', authenticate, async (req, res) => {
  try {
    const { niche, minFollowers = 1000, limit = 20 } = req.body;
    
    if (!niche) {
      return res.status(400).json({ error: 'Niche is required' });
    }

    console.log(`👥 API Request: Search influencers in ${niche} (min ${minFollowers} followers)`);
    const influencers = await apifyInstagram.searchInfluencers(niche, minFollowers, limit);
    
    res.json({ success: true, influencers, count: influencers.length });
  } catch (error: any) {
    console.error('Error searching influencers:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to search influencers' 
    });
  }
});

export default router;
