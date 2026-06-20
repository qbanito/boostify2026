// Mock data for the Artist Acquisition Dashboard.
// Designed to mirror the reference dashboard 1:1 (Nova Ray + ecosystem).
export type SparkPoint = { x: number; y: number };

const spark = (seed: number, len = 14): SparkPoint[] =>
  Array.from({ length: len }, (_, i) => {
    const v = Math.sin(i * 0.6 + seed) * 0.4 + Math.cos(i * 0.3 + seed * 1.3) * 0.3;
    return { x: i, y: 50 + v * 20 + i * 1.4 };
  });

export const featuredArtist = {
  id: 'ART_8XJ21NOVA',
  name: 'Nova Ray',
  verified: true,
  genres: ['Alternative Pop', 'Indie'],
  location: 'Los Angeles, CA, USA',
  avatar:
    'https://images.unsplash.com/photo-1535324492437-d8dea70a38a7?w=400&q=80&auto=format&fit=crop',
  growthScore: 87,
  growthSpark: spark(2.1),
  metrics: {
    monthlyListeners: '126K',
    followers: '48.7K',
    engagement: '8.6%',
    saveRatio: '36%',
  },
};

export const ecosystemNodes = [
  { id: 'manager', label: 'Manager', value: 'Lena Morris', angle: -90 },
  { id: 'producer', label: 'Producer', value: 'Dreamnote', angle: -150 },
  { id: 'collaborators', label: 'Collaborators', value: '12', angle: -210 },
  { id: 'labels', label: 'Labels', value: '3 Interested', angle: 90 },
  { id: 'fans', label: 'Fans', value: '12.4K', angle: 30 },
  { id: 'playlists', label: 'Playlists', value: '43', angle: -30 },
];

export const masterJson = {
  artist_id: 'ART_8XJ21NOVA',
  name: 'Nova Ray',
  genre: ['Alternative Pop', 'Indie'],
  location: 'Los Angeles, CA, USA',
  growth_score: 87,
  monthly_listeners: 126000,
  followers: {
    instagram: 48700,
    tiktok: 23100,
    spotify: 18900,
  },
  engagement_rate: 0.086,
  save_ratio: 0.36,
  collaborators: 12,
  playlists: 43,
  labels_interested: 3,
  manager: 'Lena Morris',
  producer: 'Dreamnote',
  discovery_source: 'Spotify + TikTok',
  created_at: '2025-05-18T09:42:11Z',
};

export const visualAssets = {
  tabs: ['Cover Art', 'Promo Image', 'Story', 'Video Teaser'],
  active: 'Cover Art',
  itemsByTab: {
    'Cover Art': [
      {
        title: 'NOVA RAY',
        subtitle: 'LOST IN HUES',
        img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80&auto=format&fit=crop',
      },
      {
        title: 'LIVE YOUR',
        subtitle: 'TRUTH',
        img: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600&q=80&auto=format&fit=crop',
      },
      {
        title: 'LOSE YOURSELF',
        subtitle: 'OUT NOW',
        img: 'https://images.unsplash.com/photo-1485579149621-3123dd979885?w=600&q=80&auto=format&fit=crop',
      },
    ],
    'Promo Image': [
      {
        title: 'SPRING TOUR',
        subtitle: 'NOVA RAY 2026',
        img: 'https://images.unsplash.com/photo-1501612780327-45045538702b?w=600&q=80&auto=format&fit=crop',
      },
      {
        title: 'NEW SINGLE',
        subtitle: 'OUT FRIDAY',
        img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80&auto=format&fit=crop',
      },
      {
        title: 'LIVE SHOW',
        subtitle: 'LA · MAY 18',
        img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&q=80&auto=format&fit=crop',
      },
    ],
    Story: [
      {
        title: 'SWIPE UP',
        subtitle: 'LISTEN NOW',
        img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80&auto=format&fit=crop',
      },
      {
        title: 'BEHIND',
        subtitle: 'THE STUDIO',
        img: 'https://images.unsplash.com/photo-1598387846148-47e82ee120cc?w=600&q=80&auto=format&fit=crop',
      },
      {
        title: 'COUNTDOWN',
        subtitle: '3 DAYS TO GO',
        img: 'https://images.unsplash.com/photo-1518972559570-7cc1309f3229?w=600&q=80&auto=format&fit=crop',
      },
    ],
    'Video Teaser': [
      {
        title: 'TEASER 01',
        subtitle: '0:15 CLIP',
        img: 'https://images.unsplash.com/photo-1598387181032-a3103a2db5b3?w=600&q=80&auto=format&fit=crop',
      },
      {
        title: 'TEASER 02',
        subtitle: '0:30 CLIP',
        img: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&q=80&auto=format&fit=crop',
      },
      {
        title: 'TEASER 03',
        subtitle: 'REEL EDIT',
        img: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=600&q=80&auto=format&fit=crop',
      },
    ],
  } as Record<string, { title: string; subtitle: string; img: string }[]>,
  items: [
    {
      title: 'NOVA RAY',
      subtitle: 'LOST IN HUES',
      img: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80&auto=format&fit=crop',
    },
    {
      title: 'LIVE YOUR',
      subtitle: 'TRUTH',
      img: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=600&q=80&auto=format&fit=crop',
    },
    {
      title: 'LOSE YOURSELF',
      subtitle: 'OUT NOW',
      img: 'https://images.unsplash.com/photo-1485579149621-3123dd979885?w=600&q=80&auto=format&fit=crop',
    },
  ],
};

export const sequence = {
  steps: [
    { id: 'email', label: 'Email', day: 'Day 1', active: true },
    { id: 'instagram', label: 'Instagram', day: 'Day 2' },
    { id: 'tiktok', label: 'TikTok', day: 'Day 3' },
    { id: 'whatsapp', label: 'WhatsApp', day: 'Day 5' },
    { id: 'followup', label: 'Follow-up', day: 'Day 7' },
  ],
  performance: {
    delivered: '1,243',
    openRate: '68%',
    replyRate: '17%',
    positiveReply: '89',
    spark: spark(1.4, 18),
  },
};

export const pipeline = {
  range: 'This Month',
  stages: [
    { label: 'Discovered', value: '1,243', width: 100 },
    { label: 'Engaged', value: '648', width: 82 },
    { label: 'Interested', value: '312', width: 64 },
    { label: 'Qualified', value: '128', width: 46 },
    { label: 'Converted', value: '34', width: 28 },
  ],
  conversionRate: '2.74%',
  delta: '+32% vs last month',
  sources: [
    { label: 'Spotify', pct: 45 },
    { label: 'TikTok', pct: 28 },
    { label: 'Instagram', pct: 17 },
    { label: 'Other', pct: 10 },
  ],
};

export const analytics = {
  ranges: ['7D', '30D', '90D', '12M'],
  active: '30D',
  kpis: [
    { label: 'Artists Discovered', value: '1,243', delta: '+28%', spark: spark(0.4) },
    { label: 'Engagement Rate', value: '24.6%', delta: '+18%', spark: spark(1.1) },
    { label: 'Reply Rate', value: '17.4%', delta: '+22%', spark: spark(1.8) },
    { label: 'Positive Reply', value: '89', delta: '+31%', spark: spark(2.4) },
    { label: 'Conversions', value: '34', delta: '+37%', spark: spark(3.1) },
    { label: 'Revenue Impact', value: '$18.6K', delta: '+42%', spark: spark(3.7) },
  ],
};

export const activity = [
  { icon: 'mail', text: 'Nova Ray replied to your email', time: '2m ago' },
  { icon: 'users', text: 'Dreamnote added to ecosystem', time: '15m ago' },
  { icon: 'music', text: 'New playlist "Fresh Finds" matched', time: '1h ago' },
  { icon: 'spark', text: 'Lena Morris opened the EPK link', time: '2h ago' },
  { icon: 'mail', text: 'Outreach sequence step 2 sent (12 leads)', time: '3h ago' },
];
