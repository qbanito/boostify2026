/**
 * AmazonCuratedPicksModule — Cultural Storefront module for the artist profile.
 *
 * Renders 20+ Amazon products curated from the artist's masterJson + country +
 * genre, monetized through their per-artist Amazon Associates tag.
 *
 * Compliance:
 *  - FTC disclosure visible.
 *  - Outbound links use rel="sponsored noopener noreferrer".
 *  - Prices shown only from server-cached PA-API responses (≤24h).
 */

import { useState } from 'react';
import {
  ShoppingBag,
  Star,
  RefreshCw,
  Settings,
  ExternalLink,
  Sparkles,
  Info,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  BookOpen,
  X,
  ShoppingCart,
  Tag,
  Globe,
  Zap,
  TrendingUp,
} from 'lucide-react';
import {
  useAmazonPicksByArtist,
  useRefreshAmazonPicks,
  trackAmazonClick,
  type AmazonProduct,
} from '../../hooks/use-amazon-picks';
import { AmazonAffiliateSettings } from './amazon-affiliate-settings';

interface AmazonCuratedPicksModuleProps {
  artistId: number;
  artistName: string;
  isOwner: boolean;
  colors: {
    hexAccent: string;
    hexPrimary: string;
    hexBorder: string;
    textMuted?: string;
  };
}

const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23222"/><text x="100" y="105" text-anchor="middle" font-size="14" fill="%23888" font-family="sans-serif">No image</text></svg>';

const GUIDE_ITEMS = [
  {
    icon: ShoppingCart,
    color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20',
    title: 'What is Amazon Cultural Picks?',
    description: 'A curated storefront of Amazon products handpicked to match your artist identity — genre, aesthetic, lifestyle and culture. Every purchase earns you affiliate commission automatically.',
  },
  {
    icon: Sparkles,
    color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20',
    title: 'AI Curation Engine',
    description: 'The platform reads your bio, genre, location and Superstar Blueprint to select products your fans actually want. Books, gear, apparel, instruments — all relevant to your world.',
  },
  {
    icon: Tag,
    color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20',
    title: 'Your Amazon Affiliate Tag',
    description: 'Go to Settings and paste your Amazon Associates tag (e.g. yourname-20). Every link in the grid will automatically include your tag so you earn commission on every qualifying sale.',
  },
  {
    icon: Zap,
    color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20',
    title: 'Manual Mode (Instant)',
    description: 'No PA-API needed. Open Settings and paste any Amazon product URLs or ASINs directly. Products appear in your storefront immediately with your affiliate tag appended.',
  },
  {
    icon: Globe,
    color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20',
    title: 'Auto Mode (API-Powered)',
    description: 'When the platform admin has configured Amazon PA-API credentials, picks are fetched and refreshed automatically every 24 hours with live pricing and ratings from Amazon.',
  },
  {
    icon: TrendingUp,
    color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20',
    title: 'Refresh & Performance',
    description: 'Hit Refresh to update picks with latest products. Results are cached for 24 hours to stay within API limits. You can track click-through performance in your earnings dashboard.',
  },
];

function StarRating({ rating, count }: { rating: number | null; count: number | null }) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-1 text-xs text-zinc-300">
      <div className="flex">
        {[0, 1, 2, 3, 4].map((i) => (
          <Star
            key={i}
            className={`w-3 h-3 ${
              i < full
                ? 'fill-amber-400 text-amber-400'
                : i === full && half
                ? 'fill-amber-400/50 text-amber-400'
                : 'text-zinc-600'
            }`}
          />
        ))}
      </div>
      {typeof count === 'number' && count > 0 && (
        <span className="text-zinc-500">({count.toLocaleString()})</span>
      )}
    </div>
  );
}

function ProductCard({
  product,
  artistId,
  affiliateTag,
}: {
  product: AmazonProduct;
  artistId: number;
  affiliateTag: string | null;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!affiliateTag) {
      window.open(product.url, '_blank', 'noopener,noreferrer');
      return;
    }
    trackAmazonClick({
      artistId,
      asin: product.asin,
      affiliateTag,
      url: product.url,
    });
  };

  return (
    <a
      href={product.url}
      onClick={handleClick}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className="group flex flex-col bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 rounded-lg overflow-hidden transition-all duration-200 hover:scale-[1.02]"
      data-asin={product.asin}
    >
      <div className="relative aspect-square bg-zinc-950 overflow-hidden">
        <img
          src={product.imageUrl || PLACEHOLDER_IMG}
          alt={product.title}
          loading="lazy"
          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_IMG;
          }}
        />
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/90 text-black">
          Amazon
        </div>
      </div>
      <div className="flex flex-col flex-1 p-3 gap-1.5">
        <h4 className="text-sm font-medium text-zinc-100 line-clamp-2 leading-snug min-h-[2.5em]">
          {product.title || 'Untitled'}
        </h4>
        {product.brand && (
          <p className="text-[11px] text-zinc-500 truncate">{product.brand}</p>
        )}
        <StarRating rating={product.rating} count={product.reviewCount} />
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-base font-semibold text-white">
            {product.price?.display || '—'}
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
        </div>
      </div>
    </a>
  );
}

export function AmazonCuratedPicksModule({
  artistId,
  artistName,
  isOwner,
  colors,
}: AmazonCuratedPicksModuleProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  const { data, isLoading, isError, error } = useAmazonPicksByArtist(artistId);
  const refresh = useRefreshAmazonPicks(artistId);

  const products = data?.products ?? [];
  const configured = data?.configured ?? false;
  const tag = data?.affiliateTag ?? null;

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-zinc-400 text-xs">
          <Sparkles className="w-3.5 h-3.5" style={{ color: colors.hexAccent }} />
          <span>
            Curated by {artistName} · As an Amazon Associate, the artist earns from
            qualifying purchases.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {data?.cached && (
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
              Cached
            </span>
          )}
          {isOwner && (
            <>
              <button
                onClick={() => refresh.mutate()}
                disabled={refresh.isPending}
                className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 disabled:opacity-50"
                title="Refresh picks now"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refresh.isPending ? 'animate-spin' : ''}`}
                />
                Refresh
              </button>
              <button
                onClick={() => setShowSettings((s) => !s)}
                className="flex items-center gap-1 text-xs text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-zinc-800"
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </button>
            </>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setShowGuide(true); }}
            title="How it works"
            className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/5 hover:bg-amber-500/15 border border-white/8 hover:border-amber-500/30 transition-all"
          >
            <HelpCircle className="w-3.5 h-3.5 text-zinc-400 hover:text-amber-400" />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-zinc-400 hover:text-white p-1"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Owner settings panel */}
      {isOwner && showSettings && (
        <AmazonAffiliateSettings
          artistId={artistId}
          colors={colors}
          onClose={() => setShowSettings(false)}
        />
      )}

      {!expanded ? null : (
        <>
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-zinc-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading curated picks...
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="flex items-start gap-2 p-4 rounded-lg bg-red-950/30 border border-red-900/50 text-sm text-red-200">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                Couldn't load Amazon picks right now. Please try again later.
                <div className="text-xs text-red-300/70 mt-1">
                  {(error as any)?.message || 'Unknown error'}
                </div>
              </div>
            </div>
          )}

          {/* Unconfigured (admin only — visitors see empty silently) */}
          {!isLoading && !isError && !configured && (
            <div className="flex items-start gap-2 p-4 rounded-lg bg-amber-950/20 border border-amber-900/40 text-sm text-amber-100">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                {isOwner ? (
                  <>
                    <strong>No picks yet.</strong> You have two ways to populate your storefront:
                    <ul className="mt-1.5 ml-4 list-disc space-y-0.5 text-amber-100/90">
                      <li>
                        <strong>Manual mode (instant, no API needed):</strong> open Settings above
                        and paste Amazon product links or ASINs. They&rsquo;ll appear here right away
                        with your affiliate tag.
                      </li>
                      <li>
                        <strong>Auto mode:</strong> requires the platform admin to configure
                        PA-API credentials. Once enabled, picks are AI-curated based on your bio,
                        country, and genre.
                      </li>
                    </ul>
                  </>
                ) : (
                  `${artistName}'s curated picks are coming soon.`
                )}
              </div>
            </div>
          )}

          {/* Empty (configured but no products yet) */}
          {!isLoading && !isError && configured && products.length === 0 && (
            <div className="flex items-start gap-2 p-4 rounded-lg bg-zinc-900/40 border border-zinc-800 text-sm text-zinc-300">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                No picks available yet.{' '}
                {isOwner ? (
                  <>
                    Hit <strong>Refresh</strong> above to fetch products tailored to your
                    profile.
                  </>
                ) : (
                  'Check back soon!'
                )}
              </div>
            </div>
          )}

          {/* Grid */}
          {products.length > 0 && (
            <>
              <div
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
                data-testid="amazon-picks-grid"
              >
                {products.map((p) => (
                  <ProductCard
                    key={p.asin}
                    product={p}
                    artistId={artistId}
                    affiliateTag={tag}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-900">
                <span>
                  {products.length} curated product{products.length === 1 ? '' : 's'} ·
                  refreshed every 24h
                </span>
                <span className="opacity-70">Powered by Amazon Associates</span>
              </div>
            </>
          )}
        </>
      )}

      {/* Guide Overlay */}
      {showGuide && (
        <div
          className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="relative w-full sm:max-w-md bg-[#0d0d18] border border-white/10 rounded-t-3xl sm:rounded-3xl max-h-[88dvh] sm:max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-4 sm:pt-5 pb-4 border-b border-white/6 shrink-0">
              <button
                onClick={() => setShowGuide(false)}
                className="flex items-center justify-center w-[34px] h-[34px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 transition-colors shrink-0"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-white">How It Works</h2>
                <p className="text-[11px] text-white/35 mt-0.5">Amazon Cultural Picks — Complete Guide</p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 shrink-0">
                <BookOpen className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wide">Guide</span>
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
              {GUIDE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className={`flex gap-3 p-3.5 rounded-2xl border ${item.border} bg-white/[0.02]`}
                  >
                    <div className={`shrink-0 w-9 h-9 rounded-xl ${item.bg} border ${item.border} flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${item.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold mb-1 ${item.color}`}>{item.title}</p>
                      <p className="text-xs text-white/50 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                );
              })}

              {/* FTC notice */}
              <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-500/[0.07] border border-amber-500/20">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-300 mb-1">FTC Disclosure</p>
                  <p className="text-xs text-white/45 leading-relaxed">
                    As an Amazon Associate, the artist earns from qualifying purchases made through links on this page. Prices and availability are subject to change.
                  </p>
                </div>
              </div>

              <div style={{ height: 8 }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AmazonCuratedPicksModule;
