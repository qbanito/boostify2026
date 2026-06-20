import {
  Music, Video, Newspaper, Share2, ShoppingBag, Image, Download, Coins,
  Sparkles, TrendingUp, DollarSign, Target, Handshake, MapPin, Flame, Zap,
  Users, Briefcase, GraduationCap, Clock, Globe, Heart, Star, Camera,
  FileText, Phone, Mail, Award, Layers
} from 'lucide-react';

// ============================================================
// Page Mode Types
// ============================================================

export type PageMode = 'artist' | 'influencer' | 'personal' | 'business';

export interface PageModeConfig {
  id: PageMode;
  label: string;
  description: string;
  icon: any;
  emoji: string;
  color: string;
  heroTitle: string;
  // Default sections visible for this mode
  defaultVisibleSections: string[];
  // Default order of sections
  defaultSectionOrder: string[];
  // Default right widgets visible
  defaultRightWidgets: string[];
  // Custom labels to override section names
  sectionLabels: Record<string, string>;
  // Custom labels for right widgets
  widgetLabels: Record<string, string>;
  // Default genre text when empty
  defaultGenreLabel: string;
  // Default biography placeholder
  biographyPlaceholder: string;
}

// ============================================================
// Mode Configurations
// ============================================================

export const PAGE_MODES: Record<PageMode, PageModeConfig> = {
  artist: {
    id: 'artist',
    label: 'Artista',
    description: 'Músicos, bandas, DJs, productores',
    icon: Music,
    emoji: '🎵',
    color: '#f97316',
    heroTitle: 'Artist',
    // Minimal default for fresh profiles: music · video · gallery only.
    // Other sections are still in defaultSectionOrder and available via
    // Customize Layout — they just start hidden so new users see a clean page.
    defaultVisibleSections: [
      'songs', 'videos', 'galleries',
    ],
    defaultSectionOrder: [
      'influencer-module', 'songs', 'videos', 'news', 'social-posts', 'social-hub',
      'merchandise', 'galleries', 'smart-merch', 'art-gallery', 'downloads', 'tokenization',
      'monetize-cta', 'analytics', 'earnings', 'crowdfunding',
      'sponsors', 'venueBooking', 'explicit-content', 'aas-engine', 'viral-products', 'brand-collabs', 'hermes-agent',
    ],
    defaultRightWidgets: [
      'qr-card', 'economic-engine', 'crypto-community', 'physical-cards', 'statistics', 'tokenized-music',
      'information', 'social-media', 'spotify', 'premium-tools', 'upcoming-shows',
    ],
    sectionLabels: {},
    widgetLabels: {},
    defaultGenreLabel: 'Music Artist',
    biographyPlaceholder: 'Tell your fans about your music journey...',
  },

  influencer: {
    id: 'influencer',
    label: 'Influencer',
    description: 'Creadores de contenido, streamers, YouTubers',
    icon: Camera,
    emoji: '📸',
    color: '#ec4899',
    heroTitle: 'Creator',
    defaultVisibleSections: [
      'videos', 'social-posts', 'social-hub', 'galleries',
      'merchandise', 'news', 'downloads', 'analytics',
      'sponsors', 'monetize-cta', 'explicit-content', 'viral-products', 'brand-collabs', 'influencer-module',
    ],
    defaultSectionOrder: [
      'influencer-module', 'social-posts', 'videos', 'social-hub', 'galleries',
      'merchandise', 'news', 'downloads', 'sponsors', 'brand-collabs',
      'analytics', 'monetize-cta', 'earnings', 'explicit-content',
      'viral-products', 'crowdfunding', 'aas-engine',
      'songs', 'tokenization', 'venueBooking',
    ],
    defaultRightWidgets: [
      'qr-card', 'economic-engine', 'crypto-community', 'statistics', 'social-media', 'information',
      'premium-tools', 'physical-cards',
    ],
    sectionLabels: {
      'songs': 'Audio / Podcasts',
      'videos': 'Content',
      'news': 'Blog / Updates',
      'merchandise': 'Merch & Collabs',
      'galleries': 'Photo Gallery',
      'downloads': 'Free Downloads',
      'sponsors': 'Brand Collabs',
      'brand-collabs': 'Brand Partnerships 🤝',
      'venueBooking': 'Event Booking',
      'monetize-cta': 'Grow Your Brand',
      'explicit-content': 'Exclusive Content 🔥',
      'crowdfunding': 'Fan Support',
    },
    widgetLabels: {
      'upcoming-shows': 'Upcoming Events',
      'tokenized-music': 'Digital Collectibles',
    },
    defaultGenreLabel: 'Content Creator',
    biographyPlaceholder: 'Tell your audience about your content and brand...',
  },

  personal: {
    id: 'personal',
    label: 'Personal',
    description: 'Portfolio, CV digital, freelancers, profesionales',
    icon: GraduationCap,
    emoji: '👤',
    color: '#3b82f6',
    heroTitle: 'Professional',
    defaultVisibleSections: [
      'galleries', 'downloads', 'news', 'videos',
      'social-hub', 'analytics', 'monetize-cta',
    ],
    defaultSectionOrder: [
      'galleries', 'videos', 'downloads', 'news',
      'social-hub', 'social-posts', 'merchandise',
      'analytics', 'monetize-cta', 'earnings',
      'sponsors', 'explicit-content', 'crowdfunding',
      'influencer-module', 'songs', 'tokenization', 'venueBooking', 'aas-engine', 'viral-products',
    ],
    defaultRightWidgets: [
      'qr-card', 'economic-engine', 'crypto-community', 'information', 'social-media', 'statistics',
      'premium-tools',
    ],
    sectionLabels: {
      'songs': 'Audio / Podcasts',
      'videos': 'Video Portfolio',
      'news': 'Blog / Articles',
      'social-posts': 'Activity Feed',
      'social-hub': 'Connect',
      'merchandise': 'Products / Services',
      'galleries': 'Portfolio',
      'downloads': 'CV & Documents',
      'sponsors': 'Collaborations',
      'venueBooking': 'Book a Meeting',
      'monetize-cta': 'Hire Me',
      'analytics': 'Profile Views',
      'crowdfunding': 'Support My Work',
      'explicit-content': 'Premium Content 🔒',
    },
    widgetLabels: {
      'upcoming-shows': 'Upcoming Events',
      'tokenized-music': 'Digital Assets',
      'spotify': 'Featured Link',
    },
    defaultGenreLabel: 'Professional',
    biographyPlaceholder: 'Describe your skills, experience, and what you do...',
  },

  business: {
    id: 'business',
    label: 'Negocio',
    description: 'Empresas, marcas, restaurantes, tiendas',
    icon: Briefcase,
    emoji: '🏢',
    color: '#10b981',
    heroTitle: 'Business',
    defaultVisibleSections: [
      'merchandise', 'galleries', 'news', 'videos',
      'social-hub', 'social-posts', 'downloads', 'analytics',
      'monetize-cta',
    ],
    defaultSectionOrder: [
      'merchandise', 'galleries', 'news', 'videos',
      'social-hub', 'social-posts', 'downloads',
      'analytics', 'monetize-cta', 'earnings',
      'sponsors', 'explicit-content', 'crowdfunding',
      'viral-products', 'songs', 'tokenization',
      'influencer-module', 'venueBooking', 'aas-engine',
    ],
    defaultRightWidgets: [
      'qr-card', 'economic-engine', 'crypto-community', 'information', 'social-media', 'statistics',
      'physical-cards', 'premium-tools',
    ],
    sectionLabels: {
      'songs': 'Audio / Podcasts',
      'videos': 'Videos',
      'news': 'News & Announcements',
      'social-posts': 'Social Feed',
      'social-hub': 'Follow Us',
      'merchandise': 'Products & Services',
      'galleries': 'Photo Gallery',
      'downloads': 'Catalogs & Documents',
      'sponsors': 'Partners',
      'venueBooking': 'Book / Reserve',
      'monetize-cta': 'Get Started',
      'analytics': 'Business Stats',
      'crowdfunding': 'Invest',
      'explicit-content': 'Members Only 🔒',
      'earnings': 'Revenue',
    },
    widgetLabels: {
      'upcoming-shows': 'Upcoming Events',
      'tokenized-music': 'Digital Products',
      'spotify': 'Featured Link',
    },
    defaultGenreLabel: 'Business',
    biographyPlaceholder: 'Describe your business, products, and services...',
  },
};

// ============================================================
// Helpers
// ============================================================

/** Get mode config with fallback to artist */
export function getPageModeConfig(mode?: string | null): PageModeConfig {
  if (mode && mode in PAGE_MODES) {
    return PAGE_MODES[mode as PageMode];
  }
  return PAGE_MODES.artist;
}

/** Get the label for a section based on page mode */
export function getSectionLabel(
  mode: PageMode | string | undefined | null,
  sectionKey: string,
  defaultLabel: string
): string {
  const config = getPageModeConfig(mode);
  return config.sectionLabels[sectionKey] || defaultLabel;
}

/** Get the label for a right widget based on page mode */
export function getWidgetLabel(
  mode: PageMode | string | undefined | null,
  widgetKey: string,
  defaultLabel: string
): string {
  const config = getPageModeConfig(mode);
  return config.widgetLabels[widgetKey] || defaultLabel;
}

/** Get default visibility map for a given mode */
export function getDefaultVisibility(mode: PageMode | string | undefined | null): Record<string, boolean> {
  const config = getPageModeConfig(mode);
  const allSectionKeys = PAGE_MODES.artist.defaultSectionOrder;
  const visibility: Record<string, boolean> = {};
  for (const key of allSectionKeys) {
    visibility[key] = config.defaultVisibleSections.includes(key);
  }
  return visibility;
}

/** All available mode keys */
export const PAGE_MODE_OPTIONS: PageMode[] = ['artist', 'influencer', 'personal', 'business'];
