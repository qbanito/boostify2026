# Apify Instagram Integration Guide

## Overview

Boostify Music now integrates **Apify Instagram Scraper** to fetch real Instagram data without requiring Facebook App approval. This allows you to access Instagram profiles, posts, hashtags, and influencer data directly.

## Features

✅ **Real Instagram Data** - No mock data, all information is scraped from Instagram in real-time  
✅ **No Facebook App Required** - Bypasses Facebook's app approval process  
✅ **Profile Scraping** - Get follower counts, bio, profile picture, and more  
✅ **Post Data** - Fetch recent posts with likes, comments, and media  
✅ **Hashtag Search** - Find posts and users by hashtag  
✅ **Influencer Discovery** - Search influencers by niche and follower count  

## API Endpoints

### 1. Get Profile Data
```http
GET /api/apify/instagram/profile/:username
```

**Example:**
```javascript
const response = await fetch('/api/apify/instagram/profile/nasa');
const data = await response.json();

// Returns:
{
  success: true,
  profile: {
    username: "nasa",
    fullName: "NASA",
    biography: "Exploring the universe...",
    followersCount: 95000000,
    followingCount: 78,
    postsCount: 4200,
    profilePicUrl: "https://...",
    isVerified: true,
    isPrivate: false,
    url: "https://instagram.com/nasa"
  }
}
```

### 2. Get User Posts
```http
GET /api/apify/instagram/posts/:username?limit=12
```

**Example:**
```javascript
const response = await fetch('/api/apify/instagram/posts/nasa?limit=12');
const data = await response.json();

// Returns:
{
  success: true,
  posts: [
    {
      id: "...",
      caption: "Amazing view of Mars...",
      timestamp: "2025-11-17T10:00:00Z",
      likesCount: 250000,
      commentsCount: 5000,
      displayUrl: "https://...",
      videoUrl: null,
      type: "image"
    },
    // ... more posts
  ],
  count: 12
}
```

### 3. Get Profile Insights
```http
GET /api/apify/instagram/insights/:username
```

**Example:**
```javascript
const response = await fetch('/api/apify/instagram/insights/nasa');
const data = await response.json();

// Returns:
{
  success: true,
  insights: {
    username: "nasa",
    totalPosts: 4200,
    avgLikes: 180000,
    avgComments: 3500,
    engagementRate: 2.1,
    topPosts: [/* top 5 posts by engagement */]
  }
}
```

### 4. Search Profiles by Keyword
```http
POST /api/apify/instagram/search
Content-Type: application/json

{
  "keyword": "space",
  "limit": 20
}
```

**Example:**
```javascript
const response = await fetch('/api/apify/instagram/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    keyword: 'space',
    limit: 20
  })
});

const data = await response.json();
// Returns array of profiles that posted with #space
```

### 5. Search Influencers by Niche
```http
POST /api/apify/instagram/influencers
Content-Type: application/json

{
  "niche": "music",
  "minFollowers": 10000,
  "limit": 20
}
```

**Example:**
```javascript
const response = await fetch('/api/apify/instagram/influencers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    niche: 'music',
    minFollowers: 10000,
    limit: 20
  })
});

const data = await response.json();
// Returns array of music influencers with 10K+ followers
```

## Frontend Integration

### Test Interface

Navigate to **Instagram Boost** → **Apify Test** tab to test the integration:

1. Enter an Instagram username (e.g., `nasa`, `spotify`, `netflix`)
2. Click **Get Profile** to fetch profile data
3. Click **Get Posts** to fetch recent posts
4. View real-time Instagram data

### Using in Your Components

```typescript
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

function MyComponent() {
  const { toast } = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchProfile = async (username: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/apify/instagram/profile/${username}`);
      const data = await response.json();
      
      if (data.success) {
        setProfile(data.profile);
        toast({ title: 'Profile loaded successfully!' });
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={() => fetchProfile('nasa')}>
      Load NASA Profile
    </button>
  );
}
```

## Technical Details

### Apify Actor Used
- **Main Actor:** `apify/instagram-scraper` (official Apify actor)
- **Capabilities:** Profiles, Posts, Hashtags, Comments, Stories
- **Rate Limits:** Managed by Apify (configured in your account)

### Configuration
The integration uses your `APIFY_API_TOKEN` from Replit Secrets. No additional configuration needed.

### Performance
- **Profile fetch:** ~5-10 seconds
- **Posts fetch (12):** ~10-15 seconds
- **Hashtag search:** ~15-30 seconds (depends on volume)

### Rate Limiting
Apify manages rate limiting automatically. If you exceed your account limits, you'll receive a clear error message.

## Best Practices

1. **Cache Data** - Store fetched data to avoid repeated API calls
2. **Pagination** - Use `limit` parameter to control data volume
3. **Error Handling** - Always handle errors gracefully
4. **User Feedback** - Show loading states during API calls
5. **Respect Limits** - Don't spam the API with unnecessary requests

## Troubleshooting

### Error: "Profile not found"
- Verify the username is correct
- Check if the account is public
- Ensure the account exists

### Error: "API Token Invalid"
- Verify `APIFY_API_TOKEN` is set in Replit Secrets
- Check your Apify account status

### Slow Response Times
- This is normal for web scraping
- Consider implementing caching
- Use lower `limit` values

## Examples

### Fetch Influencers for Music Niche
```javascript
const response = await fetch('/api/apify/instagram/influencers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    niche: 'music',
    minFollowers: 50000,
    limit: 10
  })
});

const { influencers } = await response.json();
// Use for influencer outreach campaigns
```

### Build a Profile Analytics Dashboard
```javascript
const username = 'your_artist';
const [profile, posts, insights] = await Promise.all([
  fetch(`/api/apify/instagram/profile/${username}`).then(r => r.json()),
  fetch(`/api/apify/instagram/posts/${username}?limit=50`).then(r => r.json()),
  fetch(`/api/apify/instagram/insights/${username}`).then(r => r.json())
]);

// Now build charts, graphs, and analytics
```

## Future Enhancements

- ✅ Profile & Posts scraping
- ✅ Hashtag search
- ✅ Influencer discovery
- 🔄 Story scraping (coming soon)
- 🔄 Competitor analysis (coming soon)
- 🔄 Hashtag performance tracking (coming soon)

## Support

For issues or questions:
1. Check Apify documentation: https://apify.com/apify/instagram-scraper
2. Review backend logs in Replit
3. Test with known public accounts (e.g., `nasa`, `spotify`)

---

**Note:** This integration uses web scraping and may be affected by Instagram's changes. Apify updates their actors regularly to maintain compatibility.
