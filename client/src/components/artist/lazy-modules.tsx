import { Suspense, lazy, type FC } from "react";
import { ProfileSectionErrorBoundary } from "./profile-section-error-boundary";
import { ModuleSkeleton } from "./module-skeleton";

/**
 * lazy-modules
 * ------------------------------------------------------------------
 * Code-splitting barrel for the heavy Artist Profile modules.
 *
 * Each export below is a drop-in replacement for the original eager import:
 * the component name and props API are identical, so NO call site inside
 * artist-profile-card.tsx changes. The difference is that the underlying
 * module's JS chunk is now downloaded ON DEMAND (only when the section is
 * actually rendered / visible) instead of being bundled into the initial
 * profile chunk.
 *
 * Every module is individually wrapped with:
 *   - <Suspense>  -> shows an elegant <ModuleSkeleton> while the chunk loads
 *   - <ProfileSectionErrorBoundary> -> a broken module never white-screens
 *     the whole profile (req: "Agregar fallback si un módulo falla").
 *
 * Because Artist Profile sections only mount when `sectionVisibility[id]` is
 * true, hidden modules never download their chunk at all.
 */

type Loader = () => Promise<{ default: FC<any> }>;

/** Wrap a lazily-loaded module with Suspense + an error boundary. */
function withLazy(sectionId: string, loader: Loader, compact = false): FC<any> {
  const LazyComp = lazy(loader);
  const Wrapped: FC<any> = (props) => (
    <ProfileSectionErrorBoundary sectionId={sectionId}>
      <Suspense fallback={<ModuleSkeleton compact={compact} />}>
        <LazyComp {...props} />
      </Suspense>
    </ProfileSectionErrorBoundary>
  );
  Wrapped.displayName = `Lazy(${sectionId})`;
  return Wrapped;
}

/** Helper for named exports: resolves `{ default: m.Name }`. */
const named =
  (importer: () => Promise<Record<string, any>>, name: string): Loader =>
  () =>
    importer().then((m) => ({ default: m[name] }));

/* ----------------------------- AI / Studio ----------------------------- */
export const AIVideoStudio = withLazy("ai-video-studio", () =>
  import("./ai-video-studio/AIVideoStudio"),
);
export const LyricsVideoModule = withLazy(
  "lyrics-video",
  named(() => import("../lyrics-video/LyricsVideoModule"), "LyricsVideoModule"),
);
export const GammaPresentationsModule = withLazy(
  "gamma-presentations",
  named(() => import("./gamma-presentations/GammaPresentationsModule"), "GammaPresentationsModule"),
);
export const KaraokeModule = withLazy(
  "karaoke",
  named(() => import("./karaoke-module"), "KaraokeModule"),
);
export const KaraokePlayer = withLazy(
  "karaoke-player",
  named(() => import("./KaraokePlayer"), "KaraokePlayer"),
);
export const RenaissanceStudioSection = withLazy(
  "renaissance-studio",
  named(() => import("./renaissance-studio-section"), "RenaissanceStudioSection"),
);
export const EmotionalStudioPanel = withLazy(
  "emotional-studio",
  named(() => import("./emotional-studio-panel"), "EmotionalStudioPanel"),
);
export const HologramProjectPanel = withLazy(
  "hologram-project",
  named(() => import("./hologram-project-panel"), "HologramProjectPanel"),
);
export const AvatarTalkModule = withLazy(
  "avatar-talk",
  named(() => import("./avatar-talk-module"), "AvatarTalkModule"),
);
export const TalkToMeModule = withLazy(
  "talk-to-me",
  named(() => import("../artist-profile/talk-to-me-module"), "TalkToMeModule"),
);
export const WhatsAppCommandCenter = withLazy(
  "whatsapp-command-center",
  named(
    () => import("./whatsapp-command-center/WhatsAppCommandCenter"),
    "WhatsAppCommandCenter",
  ),
);
export const TelegramCommandCenter = withLazy(
  "telegram-command-center",
  named(
    () => import("./telegram-command-center/TelegramCommandCenter"),
    "TelegramCommandCenter",
  ),
);
export const FacebookGroupsCommandCenter = withLazy(
  "facebook-groups-command-center",
  named(
    () => import("./facebook-groups-command-center/FacebookGroupsCommandCenter"),
    "FacebookGroupsCommandCenter",
  ),
);
export const RedditIntelligenceCenter = withLazy(
  "reddit-intelligence-center",
  named(
    () => import("./reddit-intelligence-center/RedditIntelligenceCenter"),
    "RedditIntelligenceCenter",
  ),
);
export const DiscordFanNation = withLazy(
  "discord-fan-nation",
  named(
    () => import("./discord-fan-nation/DiscordFanNation"),
    "DiscordFanNation",
  ),
);
export const ArtistPromoClipsModule = withLazy("promo-clips", () =>
  import("./promo-clips/ArtistPromoClipsModule"),
);

/* ----------------------------- Agents / AAS ---------------------------- */
export const HermesAgentPanel = withLazy(
  "hermes-agent",
  named(() => import("./hermes-agent-panel"), "HermesAgentPanel"),
);
export const AgentGatewayPanel = withLazy(
  "agent-gateway",
  named(() => import("../agent-gateway/gateway-panel"), "AgentGatewayPanel"),
);
export const AgentConsole = withLazy(
  "agent-console",
  named(() => import("../agent-gateway/agent-console"), "AgentConsole"),
);
export const AASEnginePanel = withLazy(
  "aas-engine",
  named(() => import("../aas/aas-engine-panel"), "AASEnginePanel"),
);
export const ObservationEnginePanel = withLazy(
  "observation-engine",
  named(() => import("./observation-engine-panel"), "ObservationEnginePanel"),
);
export const DeepBriefPanel = withLazy(
  "deep-brief",
  named(() => import("./deep-brief-panel"), "DeepBriefPanel"),
);
export const ArtistBlueprintPanel = withLazy("artist-blueprint", () =>
  import("./artist-blueprint-panel"),
);
export const ArtistDomainManager = withLazy("artist-domain", () =>
  import("./artist-domain-manager"),
);

/* --------------------------- Web3 / Economic --------------------------- */
export const EconomicEngineDashboard = withLazy(
  "economic-engine",
  named(() => import("../economic-engine/economic-engine-dashboard"), "EconomicEngineDashboard"),
);
export const CryptoCommunityDashboard = withLazy(
  "crypto-community",
  named(() => import("../crypto-community/crypto-community-dashboard"), "CryptoCommunityDashboard"),
);
export const TokenizationPanel = withLazy(
  "tokenization",
  named(() => import("../tokenization/tokenization-panel"), "TokenizationPanel"),
);
export const TokenizedMusicView = withLazy(
  "tokenized-music",
  named(() => import("../tokenization/tokenized-music-view"), "TokenizedMusicView"),
);

/* ------------------------------ Commerce ------------------------------- */
export const FashionVirtualStore = withLazy(
  "fashion-store",
  named(() => import("../fashion-store/FashionVirtualStore"), "FashionVirtualStore"),
);
export const OfficialStoreSection = withLazy(
  "official-store",
  named(() => import("./official-store-section"), "OfficialStoreSection"),
);
export const ArtGalleryModule = withLazy("art-gallery", () =>
  import("../art-gallery/ArtGalleryModule"),
);
export const SmartMerchModule = withLazy("smart-merch", () =>
  import("../smart-merch/SmartMerchModule"),
);
export const VinylPreorderModule = withLazy(
  "vinyl-preorder",
  named(() => import("../vinyl/vinyl-preorder-module"), "VinylPreorderModule"),
);
export const VinylEditionModule = withLazy(
  "vinyl-edition",
  named(() => import("../vinyl/VinylEditionModule"), "VinylEditionModule"),
);
export const VinylRecordsHub = withLazy(
  "vinyl-records",
  named(() => import("../vinyl/VinylRecordsHub"), "VinylRecordsHub"),
);
export const AmazonCuratedPicksModule = withLazy(
  "amazon-picks",
  named(() => import("../artist-profile/amazon-curated-picks-module"), "AmazonCuratedPicksModule"),
);

/* --------------------------- Fans / Live / Biz ------------------------- */
export const BoostifyLiveStage = withLazy(
  "live-stage",
  named(() => import("./live-stage/BoostifyLiveStage"), "BoostifyLiveStage"),
);
export const FanClubPanel = withLazy(
  "fan-club",
  named(() => import("./FanClubPanel"), "FanClubPanel"),
);
export const ConcertCommandCenter = withLazy(
  "concert-hub",
  named(() => import("./ConcertCommandCenter"), "ConcertCommandCenter"),
);
export const VenueBookingPanel = withLazy(
  "venue-booking",
  named(() => import("./venue-booking-panel"), "VenueBookingPanel"),
);
export const SponsorPanel = withLazy(
  "sponsor",
  named(() => import("../sponsor/sponsor-panel"), "SponsorPanel"),
);
export const BrandCollabPanel = withLazy("brand-collab", () =>
  import("./brand-collab-panel"),
);
export const ViralProductGenerator = withLazy(
  "viral-product",
  named(() => import("./viral-product-generator"), "ViralProductGenerator"),
);
export const ArtistBusinessPlan = withLazy(
  "business-plan",
  named(() => import("../business-plan/artist-business-plan"), "ArtistBusinessPlan"),
);
export const ArtistBusinessPlanV2 = withLazy(
  "business-plan-v2",
  named(() => import("../business-plan/artist-business-plan-v2"), "ArtistBusinessPlanV2"),
);
export const ArtistCareerSuite = withLazy(
  "career-suite",
  named(() => import("../artist/career-suite/ArtistCareerSuite"), "ArtistCareerSuite"),
);
export const AudienceCaptureDashboard = withLazy(
  "audience-capture",
  named(() => import("../audience-capture"), "AudienceCaptureDashboard"),
);
export const AdsCampaignManager = withLazy(
  "ads-campaign",
  named(() => import("./ads-campaign-manager/AdsCampaignManager"), "AdsCampaignManager"),
);
export const MyUniverseModule = withLazy(
  "my-universe",
  named(() => import("./my-universe-module"), "MyUniverseModule"),
);
export const InfluencerModule = withLazy(
  "influencer",
  named(() => import("../artist-profile/influencer-module"), "InfluencerModule"),
);
export const ArtistNewsGenerator = withLazy(
  "news-generator",
  named(() => import("../artist-profile/artist-news-generator"), "ArtistNewsGenerator"),
);
export const ExplicitContentSection = withLazy(
  "explicit-content",
  named(() => import("../explicit/explicit-content-section"), "ExplicitContentSection"),
);
export const EpkSection = withLazy(
  "epk",
  named(() => import("./profile-modules/epk-section"), "EpkSection"),
);
export const EarningsChart = withLazy(
  "earnings-chart",
  named(() => import("../wallet/earnings-chart"), "EarningsChart"),
  true,
);
export const PayoutsPanel = withLazy(
  "payouts-panel",
  named(() => import("../wallet/payouts-panel"), "PayoutsPanel"),
  true,
);
