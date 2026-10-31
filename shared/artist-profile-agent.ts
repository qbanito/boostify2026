/**
 * Server allowlist and shared catalog for the Artist Profile assistant.
 * These IDs map to the stable section/widget IDs rendered in ArtistProfileCard.
 */
export type ProfileAssistantSurface = 'section' | 'widget';

export interface ProfileAssistantModule {
  id: string;
  name: string;
  surface: ProfileAssistantSurface;
  summary: string;
}

export type ArtistProfileAgentAction =
  | { type: 'open_module'; moduleId: string; surface: ProfileAssistantSurface }
  | { type: 'configure_layout'; enableSections: string[]; disableSections: string[]; enableWidgets: string[]; disableWidgets: string[]; moveSections: Array<{ id: string; side: 'left' | 'right' }> };

export const PROFILE_ASSISTANT_MODULES: ProfileAssistantModule[] = [
  { id: 'songs', name: 'Music', surface: 'section', summary: 'Manage and showcase the artist song catalog.' },
  { id: 'fanclub', name: 'Fan Club', surface: 'section', summary: 'Connect with fans and manage fan engagement.' },
  { id: 'live-stage', name: 'Boostify Live Stage', surface: 'section', summary: 'Show live artist experiences and performances.' },
  { id: 'live-map', name: 'Artist Services Map', surface: 'section', summary: 'Explore services and support for the artist.' },
  { id: 'fashion-image-studio', name: 'AI Fashion Photos', surface: 'section', summary: 'Create artist fashion and editorial imagery.' },
  { id: 'tiktok-live', name: 'TikTok Live Tools', surface: 'section', summary: 'Plan and manage TikTok live activity.' },
  { id: 'youtube-channel', name: 'YouTube Growth', surface: 'section', summary: 'Improve the artist YouTube channel and content.' },
  { id: 'videos', name: 'Videos', surface: 'section', summary: 'Showcase published artist videos.' },
  { id: 'news', name: 'News', surface: 'section', summary: 'Create and display artist news.' },
  { id: 'social-posts', name: 'Social Posts', surface: 'section', summary: 'Draft and manage social media content.' },
  { id: 'social-hub', name: 'Social Media Hub', surface: 'section', summary: 'Coordinate social media presence and content.' },
  { id: 'merchandise', name: 'Merchandise', surface: 'section', summary: 'Show the artist merchandise store.' },
  { id: 'galleries', name: 'Image Galleries', surface: 'section', summary: 'Show artist image galleries.' },
  { id: 'downloads', name: 'Downloads', surface: 'section', summary: 'Share downloadable artist files.' },
  { id: 'tokenization', name: 'Music Tokens', surface: 'section', summary: 'Manage music tokenization and token assets.' },
  { id: 'monetize-cta', name: 'Hire This Artist', surface: 'section', summary: 'Let visitors contact or hire the artist.' },
  { id: 'analytics', name: 'Artist Analytics', surface: 'section', summary: 'Review profile, audience, and content analytics.' },
  { id: 'earnings', name: 'Earnings', surface: 'section', summary: 'Review artist earnings and payouts.' },
  { id: 'crowdfunding', name: 'Crowdfunding', surface: 'section', summary: 'Create or manage a crowdfunding campaign.' },
  { id: 'sponsors', name: 'Sponsor Acquisition', surface: 'section', summary: 'Find and manage brand sponsorship opportunities.' },
  { id: 'venueBooking', name: 'Venue Booking', surface: 'section', summary: 'Manage venue outreach and booking.' },
  { id: 'explicit-content', name: 'Paid Fan Content', surface: 'section', summary: 'Manage paid, non-explicit content for fans.' },
  { id: 'aas-engine', name: 'Music Release Growth', surface: 'section', summary: 'Plan a music release and growth campaign.' },
  { id: 'audience-engine', name: 'Audience Growth', surface: 'section', summary: 'Plan audience growth and engagement.' },
  { id: 'viral-products', name: 'Viral Product Promos', surface: 'section', summary: 'Create promotions for artist products.' },
  { id: 'brand-collabs', name: 'Brand Partnerships', surface: 'section', summary: 'Manage brand collaboration opportunities.' },
  { id: 'business-plan', name: 'Artist Business Plan', surface: 'section', summary: 'Build and review the artist business plan.' },
  { id: 'influencer-module', name: 'AI Influencer Studio', surface: 'section', summary: 'Create AI influencer content for the artist brand.' },
  { id: 'amazon-picks', name: 'Amazon Picks', surface: 'section', summary: 'Curate products relevant to the artist audience.' },
  { id: 'career-suite', name: 'Artist Career Support', surface: 'section', summary: 'Get career planning and management support.' },
  { id: 'artist-blueprint', name: 'Artist Growth Plan', surface: 'section', summary: 'Create a personalized artist growth plan.' },
  { id: 'artist-domain', name: 'Artist Website', surface: 'section', summary: 'Manage the artist website and domain.' },
  { id: 'hermes-agent', name: 'Artist AI Assistant', surface: 'section', summary: 'Open the artist manager and creative advisor.' },
  { id: 'electronic-press-kit', name: 'Press Kit', surface: 'section', summary: 'Create and manage a premium press kit.' },
  { id: 'agent-gateway', name: 'AI Agent Profile', surface: 'section', summary: 'Configure the public artist AI agent profile.' },
  { id: 'hologram', name: 'Hologram Shows', surface: 'section', summary: 'Create and manage hologram show experiences.' },
  { id: 'renaissance-studio', name: 'Release Growth Roadmap', surface: 'section', summary: 'Plan a release strategy and artist growth roadmap.' },
  { id: 'observation-engine', name: 'Music Market Research', surface: 'section', summary: 'Research music trends, markets, and audiences.' },
  { id: 'deep-brief', name: 'Project Brief', surface: 'section', summary: 'Create a focused brief for an artist project.' },
  { id: 'emotional-studio', name: 'Creative Story Studio', surface: 'section', summary: 'Develop emotionally grounded artist stories.' },
  { id: 'promo-clips', name: 'Promo Video Clips', surface: 'section', summary: 'Create short promotional clips.' },
  { id: 'podcast-clips', name: 'Podcast Studio', surface: 'section', summary: 'Create artist podcast clips using music and profile context.' },
  { id: 'world-tour', name: 'Tour Videos', surface: 'section', summary: 'Create realistic concert videos in global destinations.' },
  { id: 'ai-video-studio', name: 'AI Video Studio', surface: 'section', summary: 'Create AI-powered artist videos.' },
  { id: 'ads-campaigns', name: 'Ad Campaigns', surface: 'section', summary: 'Plan and manage paid advertising campaigns.' },
  { id: 'gamma-presentations', name: 'Presentations', surface: 'section', summary: 'Create presentations for artist projects.' },
  { id: 'karaoke', name: 'Karaoke', surface: 'section', summary: 'Create and manage karaoke experiences.' },
  { id: 'lyrics-video', name: 'Lyric Videos', surface: 'section', summary: 'Create and edit lyric videos.' },
  { id: 'avatar-talk', name: 'Talking Avatar', surface: 'section', summary: 'Create artist talking-avatar content.' },
  { id: 'talk-to-me', name: 'Artist Chat', surface: 'section', summary: 'Let visitors chat with the artist profile.' },
  { id: 'whatsapp-command-center', name: 'WhatsApp Manager', surface: 'section', summary: 'Manage artist WhatsApp communications.' },
  { id: 'telegram-command-center', name: 'Telegram Manager', surface: 'section', summary: 'Manage artist Telegram communications.' },
  { id: 'facebook-groups-command-center', name: 'Facebook Group Manager', surface: 'section', summary: 'Manage artist Facebook groups.' },
  { id: 'reddit-intelligence-center', name: 'Reddit Insights', surface: 'section', summary: 'Monitor and plan artist activity on Reddit.' },
  { id: 'discord-fan-nation', name: 'Discord Community', surface: 'section', summary: 'Manage the artist Discord community.' },
  { id: 'my-universe', name: 'Artist Universe Page', surface: 'section', summary: 'Manage the artist universe and connected profiles.' },
  { id: 'vinyl-records', name: 'Vinyl Records', surface: 'section', summary: 'Show and manage artist vinyl records.' },
  { id: 'vinyl-editions', name: 'Digital Vinyl Collectibles', surface: 'section', summary: 'Manage digital vinyl collectibles.' },
  { id: 'fashion-store', name: 'Fashion Store', surface: 'section', summary: 'Manage the artist fashion store.' },
  { id: 'art-gallery', name: 'Art Gallery', surface: 'section', summary: 'Show and manage artist artwork.' },
  { id: 'smart-merch', name: 'Smart Merch', surface: 'section', summary: 'Manage interactive artist merchandise.' },
  { id: 'qr-card', name: 'Artist QR Card', surface: 'widget', summary: 'Display the artist profile QR card.' },
  { id: 'physical-cards', name: 'Physical Cards', surface: 'widget', summary: 'Manage artist physical cards.' },
  { id: 'statistics', name: 'Profile Statistics', surface: 'widget', summary: 'Display profile statistics.' },
  { id: 'tokenized-music', name: 'Tokenized Music', surface: 'widget', summary: 'Display tokenized music information.' },
  { id: 'information', name: 'Information', surface: 'widget', summary: 'Display artist profile information.' },
  { id: 'social-media', name: 'Social Media', surface: 'widget', summary: 'Display artist social accounts.' },
  { id: 'spotify', name: 'Spotify', surface: 'widget', summary: 'Display the artist Spotify player.' },
  { id: 'premium-tools', name: 'Premium Tools', surface: 'widget', summary: 'Access premium profile tools.' },
  { id: 'upcoming-shows', name: 'Upcoming Shows', surface: 'widget', summary: 'Display upcoming artist shows.' },
  { id: 'economic-engine', name: 'Earnings Overview', surface: 'widget', summary: 'Review an overview of artist revenue.' },
  { id: 'crypto-community', name: 'Crypto Community', surface: 'widget', summary: 'Display crypto community activity.' },
  { id: 'concert-hub', name: 'Concert Center', surface: 'widget', summary: 'Manage concert information.' },
];

export const PROFILE_ASSISTANT_MODULE_MAP = Object.fromEntries(
  PROFILE_ASSISTANT_MODULES.map((module) => [`${module.surface}:${module.id}`, module]),
) as Record<string, ProfileAssistantModule>;
