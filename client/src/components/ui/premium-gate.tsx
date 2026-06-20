/**
 * PremiumGate — Overlay component for locked premium modules
 * Shows a compact, uniform locked card instead of blurred content
 * Responsive across all devices (desktop, tablet, mobile)
 */
import React from 'react';
import { Lock, ArrowRight } from 'lucide-react';

interface PremiumGateProps {
  children: React.ReactNode;
  locked: boolean;
  featureName?: string;
  accentColor?: string;
}

export function PremiumGate({ children, locked, featureName, accentColor = '#F97316' }: PremiumGateProps) {
  if (!locked) return <>{children}</>;

  return (
    <div
      className="rounded-2xl sm:rounded-3xl border p-4 sm:p-6"
      style={{
        background: `linear-gradient(135deg, rgba(0,0,0,0.6), rgba(0,0,0,0.4))`,
        borderColor: `${accentColor}25`,
      }}
    >
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        {/* Lock icon */}
        <div
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}08)`,
            border: `1px solid ${accentColor}30`,
          }}
        >
          <Lock className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: accentColor }} />
        </div>

        {/* Text content */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <p className="text-white font-semibold text-sm sm:text-base truncate">
            {featureName || 'Premium Feature'}
          </p>
          <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
            Upgrade your plan to unlock this module
          </p>
        </div>

        {/* CTA button */}
        <a
          href="/pricing"
          className="flex items-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold text-black transition-all hover:scale-105 hover:shadow-lg flex-shrink-0 whitespace-nowrap"
          style={{
            background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)`,
            boxShadow: `0 4px 20px ${accentColor}30`,
          }}
        >
          Upgrade
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

/**
 * UploadLimitBanner — Shows remaining uploads with progress bar
 */
interface UploadLimitBannerProps {
  current: number;
  max: number;
  type: 'songs' | 'videos' | 'photos';
  accentColor?: string;
}

export function UploadLimitBanner({ current, max, type, accentColor = '#F97316' }: UploadLimitBannerProps) {
  if (max === Infinity) return null;
  // Only surface usage when the user has hit/exceeded the plan limit. Below
  // the limit we stay invisible so new users aren't bombarded with counters.
  if (current < max) return null;

  const remaining = Math.max(0, max - current);
  const percentage = Math.min(100, (current / max) * 100);
  const isNearLimit = percentage >= 66;
  const isAtLimit = current >= max;

  const labels: Record<string, string> = {
    songs: 'songs',
    videos: 'videos',
    photos: 'photos',
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-800/50 border border-gray-700/50 text-xs">
      <div className="flex-1">
        <div className="flex justify-between mb-1">
          <span className="text-gray-300">
            {current}/{max} {labels[type]} used
          </span>
          {isAtLimit ? (
            <a href="/pricing" className="font-bold hover:underline" style={{ color: accentColor }}>
              Upgrade
            </a>
          ) : (
            <span className={isNearLimit ? 'text-amber-400' : 'text-gray-500'}>
              {remaining} remaining
            </span>
          )}
        </div>
        <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percentage}%`,
              background: isAtLimit
                ? '#EF4444'
                : isNearLimit
                  ? '#F59E0B'
                  : accentColor,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * MODULE_GUIDES — Short instructions for each profile module (English)
 * Shown to logged-in users below each module
 */
const MODULE_GUIDES: Record<string, string> = {
  // Left column
  'songs': 'Upload your tracks here. Fans can listen, download, or purchase them directly from your profile.',
  'videos': 'Add music videos or visual content. Supports YouTube, Vimeo, and direct uploads.',
  'news': 'Post updates, announcements, and news to keep your audience engaged.',
  'social-posts': 'Share quick social updates with your followers right from your profile.',
  'social-hub': 'Connect and display all your social media feeds in one place.',
  'merchandise': 'Sell merch directly to fans — t-shirts, posters, vinyl, and more.',
  'galleries': 'Create photo galleries to showcase press shots, live performances, and artwork.',
  'downloads': 'Offer free or paid downloads — EPKs, stems, samples, or bonus content.',
  'tokenization': 'Tokenize your songs on the blockchain and let fans invest in your music.',
  'monetize-cta': 'Set up tipping, subscriptions, and other ways for fans to support you.',
  'analytics': 'Track your profile views, plays, and audience growth over time.',
  'earnings': 'Monitor your revenue from streams, merch sales, tips, and token sales.',
  'crowdfunding': 'Launch funding campaigns for albums, tours, or creative projects.',
  'sponsors': 'Attract and manage brand sponsorship opportunities.',
  'venueBooking': 'Let venues and promoters book you for live shows directly.',
  'explicit-content': 'Share exclusive behind-the-scenes or premium content for paying fans.',
  'aas-engine': 'AI-powered autonomous agent that promotes and manages your music career.',
  'viral-products': 'Generate AI-powered viral product ads to boost your merch sales.',
  'business-plan': 'AI-generated business plan for your music career and brand.',
  // Right column
  'qr-card': 'Your personalized QR card — share it at shows or on social media for instant profile access.',
  'physical-cards': 'Order printed NFC or QR business cards to hand out at events and gigs.',
  'statistics': 'Quick snapshot of your profile stats — views, followers, and engagement.',
  'tokenized-music': 'View and manage your tokenized tracks and fan investments.',
  'information': 'Edit your bio, genre, location, and contact details.',
  'social-media': 'Display links to your Spotify, Instagram, YouTube, and other platforms.',
  'spotify': 'Embedded Spotify player so fans can stream your music right here.',
  'premium-tools': 'Access AI tools, advanced analytics, and pro marketing features.',
  'upcoming-shows': 'List your upcoming live shows, tours, and event dates.',
};

interface ModuleGuideProps {
  moduleId: string;
  accentColor?: string;
}

export function ModuleGuide({ moduleId, accentColor = '#F97316' }: ModuleGuideProps) {
  const guide = MODULE_GUIDES[moduleId];
  if (!guide) return null;

  return (
    <p
      className="text-[11px] sm:text-xs leading-relaxed px-3 sm:px-4 py-2 rounded-xl mt-1.5"
      style={{ color: `${accentColor}99`, background: `${accentColor}08` }}
    >
      💡 {guide}
    </p>
  );
}
