import React, { lazy, Suspense, ReactNode, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { queryClient, setClerkGetToken } from "./lib/queryClient";
import { wagmiConfig } from "./lib/web3-config";
import { Toaster } from "./components/ui/toaster";
import { PageLoader } from "./components/ui/page-loader";
import { ProtectedRoute } from "./lib/protected-route";
import { SubscriptionProtectedRoute } from "./lib/subscription-protected-route";
import { ModuleGate } from "./components/subscription/module-gate";
import { useToast } from "./hooks/use-toast";
import { SubscriptionProvider } from "./lib/context/subscription-context";
import { ThemeEngineProvider } from "./components/providers/theme-engine-provider";
import { SubscriptionPlan } from "./lib/api/subscription-service";
import { ViteHMRErrorHandler } from "./components/improved-websocket-context";
import { EditorProvider } from "./lib/context/editor-context";
import { AudioPlayerProvider } from "./contexts/audio-player-context";
import { CartProvider } from "./contexts/cart-context";
import { CartDrawer, CartFloatingButton } from "./components/merch/cart-drawer";
import { MiniPlayer } from "./components/audio/MiniPlayer";
import { GlobalAuthGuard } from "./lib/global-auth-guard";
import { BottomNav } from "./components/layout/bottom-nav";
import { BoostifyRadio } from "./components/radio/boostify-radio";
import { useAuth } from "@clerk/clerk-react";
import { Web3NotReadyProvider, Web3ReadyInternalProvider } from "./lib/context/web3-context";
import { MotionConfig } from "framer-motion";

// Web3 Provider wrapper - NO BLOQUEA, carga Web3 de forma lazy
function Web3Wrapper({ children }: { children: ReactNode }) {
  const [web3Enabled, setWeb3Enabled] = useState(false);

  useEffect(() => {
    // Cargar Web3 después de que la app ya esté renderizada
    const timer = setTimeout(() => {
      setWeb3Enabled(true);
    }, 1000); // 1 segundo delay para no interferir con la carga inicial
    return () => clearTimeout(timer);
  }, []);

  // SIEMPRE renderizar children con el contexto de Web3Ready
  // Web3 se activa después en background
  if (!web3Enabled) {
    return (
      <Web3NotReadyProvider>
        {children}
      </Web3NotReadyProvider>
    );
  }

  try {
    return (
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider>
          <Web3ReadyInternalProvider>
            {children}
          </Web3ReadyInternalProvider>
        </RainbowKitProvider>
      </WagmiProvider>
    );
  } catch (error) {
    console.warn('[Web3] Failed to initialize, continuing without Web3:', error);
    return (
      <Web3NotReadyProvider>
        {children}
      </Web3NotReadyProvider>
    );
  }
}
import { CustomerServiceAgent } from "./components/agents/customer-service-agent";
import { SupportChatWidget } from "./components/support/support-chat-widget";

import NotFound from "./pages/not-found";
import HomePage from "./pages/home";
import AuthPage from "./pages/auth-page";
import LoginPage from "./pages/login";
import AuthSignupPage from "./pages/auth-signup";
import DashboardPage from "./pages/dashboard";
import CartSuccessPage from "./pages/cart-success";
import CartCanceledPage from "./pages/cart-canceled";
import ArtistOrdersPage from "./pages/artist-orders";
import ProfilePage from "./pages/profile";

const AdminPage = lazy(() => import("./pages/admin"));
const ArtistAcquisitionDashboard = lazy(() => import("./pages/artist-acquisition-dashboard"));
const BoostifyAlliancesDashboard = lazy(() => import("./pages/boostify-alliances-dashboard"));
const AdminArtistIdentity = lazy(() => import("./pages/admin-artist-identity"));
const AIAgentsPage = lazy(() => import("./pages/ai-agents"));
const AgentNodesPage = lazy(() => import("./pages/agent-nodes"));
const ArtistNodeFlowPage = lazy(() => import("./pages/artist-node-flow"));
const AIAdvisorsPage = lazy(() => import("./pages/ai-advisors-new"));
const AIAdvisorsPageV2 = lazy(() => import("./pages/ai-advisors-v2"));
const AnalyticsPage = lazy(() => import("./pages/analytics"));
const ArtistDashboard = lazy(() => import("./pages/artist-dashboard"));
const ArtistImageAdvisor = lazy(() => import("./pages/artist-image-advisor"));
const ArtistImageAdvisorImproved = lazy(() => import("./pages/artist-image-advisor-improved"));
const ArtistGeneratorPage = lazy(() => import("./pages/artist-generator"));
const BlogPage = lazy(() => import("./pages/blog"));
const BoostifyInternationalPage = lazy(() => import("./pages/boostify-international"));
const BoostifyTVPage = lazy(() => import("./pages/boostify-tv"));
const LivePodcastStudioPage = lazy(() => import("./pages/live-podcast-studio"));
const PodcastEpisodesPage = lazy(() => import("./pages/podcast-episodes"));
const BoostifyExplicitPage = lazy(() => import("./pages/boostify-explicit"));
const ContactsPage = lazy(() => import("./pages/contacts"));
const ContractsPage = lazy(() => import("./pages/contracts"));
const CopyrightVerifyPage = lazy(() => import("./pages/copyright-verify"));
const CookiesPage = lazy(() => import("./pages/cookies"));
const GigMarketplaceRulesPage = lazy(() => import("./pages/gig-marketplace-rules"));
const EcosystemPage = lazy(() => import("./pages/ecosystem"));
const EventsPage = lazy(() => import("./pages/events"));
const ExplorePage = lazy(() => import("./pages/explore"));
const MyTicketsPage = lazy(() => import("./pages/my-tickets"));
const FaceSwapPage = lazy(() => import("./pages/face-swap"));
const GlobalPage = lazy(() => import("./pages/global"));
const ImageGeneratorPage = lazy(() => import("./pages/image-generator"));
const ImageGeneratorSimplePage = lazy(() => import("./pages/image-generator-simple"));
const InstagramBoostPage = lazy(() => import("./pages/instagram-boost"));
const KlingToolsPage = lazy(() => import("./pages/kling-tools"));
const KlingStorePage = lazy(() => import("./pages/kling-store"));
const KlingTestPage = lazy(() => import("./pages/kling-test"));
const ManagerToolsPage = lazy(() => import("./pages/manager-tools"));
const MerchandisePage = lazy(() => import("./pages/merchandise"));
const MessagesPage = lazy(() => import("./pages/messages"));
const MusicVideoCreator = lazy(() => import("./pages/music-video-creator"));
const MusicVideoWorkflowPage = lazy(() => import("./pages/music-video-workflow-page"));
const MusicVideoWorkflowEnhancedPage = lazy(() => import("./pages/music-video-workflow-enhanced"));
const MusicGeneratorPage = lazy(() => import("./pages/music-generator"));
const MotionDNAPage = lazy(() => import("./pages/motion-dna"));
const NewsPage = lazy(() => import("./pages/news"));
const StageSyncPage = lazy(() => import("./pages/stage-sync"));
const HologramShowEnginePage = lazy(() => import("./pages/hologram-show-engine"));
const HoloSuitStartupPage = lazy(() => import("./pages/holosuit-startup"));
const CharacterForgePage = lazy(() => import("./pages/character-forge"));
const VRStudioPage = lazy(() => import("./pages/vr-studio"));
const CrowdSyncDJPage = lazy(() => import("./pages/boostify-crowdsync-dj"));
const LegacyCatalogResurrectionPage = lazy(() => import("./pages/legacy-catalog-resurrection"));
const DemoTiguerPage = lazy(() => import("./pages/demo-tiguer"));
const HologramShowcasePage = lazy(() => import("./pages/hologram-showcase"));
const MotionCaptureStudioPage = lazy(() => import("./pages/motion-capture-studio"));
const MotionCaptureMobilePage = lazy(() => import("./pages/motion-capture-mobile"));
const CreateArtistLandingPage = lazy(() => import("./pages/create-artist"));
const CreateArtistSuccessPage = lazy(() => import("./pages/create-artist-success"));
const ArtistGrowthEngineDashboardPage = lazy(() => import("./pages/artist-growth-engine"));
const PRPage = lazy(() => import("./pages/pr"));
const PrivacyPage = lazy(() => import("./pages/privacy"));
const PrivacyExtensionPage = lazy(() => import("./pages/privacy-extension"));
// Legal / DMCA / Copyright protection system
const LegalCenterPage = lazy(() => import("./pages/legal-center"));
const DmcaPolicyPage = lazy(() => import("./pages/dmca-policy"));
const CopyrightPolicyPage = lazy(() => import("./pages/copyright-policy"));
const AiPolicyPage = lazy(() => import("./pages/ai-policy"));
const ProhibitedContentPage = lazy(() => import("./pages/prohibited-content"));
const TransparencyPage = lazy(() => import("./pages/transparency"));
const LegalClaimsPage = lazy(() => import("./pages/legal-claims"));
const AdminLegalPanelPage = lazy(() => import("./pages/admin-legal-panel"));
const ProducerToolsPage = lazy(() => import("./pages/producer-tools"));
const MiniStudioPage = lazy(() => import("./pages/mini-studio"));
const PromotionPage = lazy(() => import("./pages/promotion"));
const RecordLabelServices = lazy(() => import("./pages/record-label-services"));
const SettingsPage = lazy(() => import("./pages/settings"));
const SpotifyPage = lazy(() => import("./pages/spotify"));
const StreamingPage = lazy(() => import("./pages/streaming"));
const PlaylistEmbedPage = lazy(() => import("./pages/playlist-embed"));
const StorePage = lazy(() => import("./pages/store"));
const TermsPage = lazy(() => import("./pages/terms"));
const TryOnPage = lazy(() => import("./pages/try-on-page"));
const VideosPage = lazy(() => import("./pages/videos"));
const VideoGenerationTestPage = lazy(() => import("./pages/video-generation-test"));
const CameraMovementsTestPage = lazy(() => import("./pages/camera-movements-test"));
const TikTokBoostPage = lazy(() => import("./pages/tiktok-boost"));
const YoutubeViewsPage = lazy(() => import("./pages/youtube-views"));
const RealTimeTranslator = lazy(() => import("./pages/real-time-translator"));
const EducationPage = lazy(() => import("./pages/education-new"));
const AchievementsPage = lazy(() => import("./pages/achievements-page"));
const CourseDetailPage = lazy(() => import("./pages/course-detail-new"));
const SmartCardsPage = lazy(() => import("./pages/smart-cards"));
const InvestorsPage = lazy(() => import("./pages/investors"));
const InvestorsDashboard = lazy(() => import("./pages/investors-dashboard"));
const InvestorDocumentsPage = lazy(() => import("./pages/investor-documents"));
const SocialNetworkPage = lazy(() => import("./pages/social-network"));
const FirestoreSocialPage = lazy(() => import("./pages/firestore-social"));
const ArtistProfilePage = lazy(() => import("./pages/artist-profile"));
const ArtistBlueprintPage = lazy(() => import("./pages/artist-blueprint-page"));
const ArtistBusinessPlanPage = lazy(() => import("./pages/artist-business-plan-page"));
const ArtistStorePage = lazy(() => import("./pages/artist-store"));
const ArtistSetupPage = lazy(() => import("./pages/artist-setup"));
const MyArtistPage = lazy(() => import("./pages/my-artist"));
const MyArtistsPage = lazy(() => import("./pages/my-artists"));
const ArticlePage = lazy(() => import("./pages/article"));
const DiagnosticsPage = lazy(() => import("./pages/diagnostics"));
const AffiliatesPage = lazy(() => import("./pages/affiliates"));
const AffiliatesNewPage = lazy(() => import("./pages/affiliates-new"));
const AffiliateAdminPage = lazy(() => import("./pages/affiliate-admin"));
const InitProductsPage = lazy(() => import("./pages/init-products"));
const MusicMasteringPage = lazy(() => import("./pages/music-mastering"));
const VirtualRecordLabelPage = lazy(() => import("./pages/virtual-record-label"));
const TestProgressPage = lazy(() => import("./pages/test-progress"));
const PluginsPage = lazy(() => import("./pages/plugins"));
const PricingPage = lazy(() => import("./pages/pricing"));
const MusicVideoPricing = lazy(() => import("./pages/music-video-pricing"));
const AccountPage = lazy(() => import("./pages/account"));
const SubscriptionSuccessPage = lazy(() => import("./pages/subscription-success"));
const SubscriptionCancelledPage = lazy(() => import("./pages/subscription-cancelled"));
const MusicVideoSuccess = lazy(() => import("./pages/music-video-success"));
const MusicVideoCancelled = lazy(() => import("./pages/music-video-cancelled"));
const ProductSuccessPage = lazy(() => import("./pages/product-success"));
const ProductCancelledPage = lazy(() => import("./pages/product-cancelled"));
const SubscriptionExamplePage = lazy(() => import("./pages/subscription-example"));
const ProfessionalEditorPage = lazy(() => import("./pages/professional-editor"));
const LayerFilterDemoPage = lazy(() => import("./pages/layer-filter-demo"));
const AnimatedWorkflowPage = lazy(() => import("./pages/animated-workflow"));
const TokenizationPage = lazy(() => import("./pages/tokenization"));
const BoostiSwapPage = lazy(() => import("./pages/boostiswap"));
const BTFWalletPage = lazy(() => import("./pages/btf-wallet"));
const BTFStakingPage = lazy(() => import("./pages/btf-staking"));
const BTFArtistMintPage = lazy(() => import("./pages/btf-artist-mint"));
const ResourcesPage = lazy(() => import("./pages/resources"));
const TipsPage = lazy(() => import("./pages/tips"));
const GuidesPage = lazy(() => import("./pages/guides"));
const ToolsPage = lazy(() => import("./pages/tools"));
const FeaturesPage = lazy(() => import("./pages/features"));
const AIVideoCreationPage = lazy(() => import("./pages/ai-video-creation"));
const TimelineDemoPage = lazy(() => import("./pages/timeline-demo"));
const DebugFirebasePage = lazy(() => import("./pages/debug-firebase"));
const TimelineEditorPage = lazy(() => import("./pages/timeline-editor"));
const SocialMediaGeneratorPage = lazy(() => import("./pages/social-media-generator"));
const FinancialEnablementPage = lazy(() => import("./pages/financial-enablement"));
const TokenPurchaseSuccessPage = lazy(() => import("./pages/token-purchase-success"));
const SponsorProposalPage = lazy(() => import("./pages/sponsor-proposal"));
const VenueProposalPage = lazy(() => import("./pages/venue-proposal"));
const VideoServicePage = lazy(() => import("./pages/videoservice"));
const VideoConceptsPage = lazy(() => import("./pages/video-concepts"));
const VideoConceptsProjectPage = lazy(() => import("./pages/video-concepts-project"));
const VideoServiceSuccessPage = lazy(() => import("./pages/videoservice-success"));
const SongSharePage = lazy(() => import("./pages/song-share"));
const MyUniversePage = lazy(() => import("./pages/my-universe"));
// Cinematic Event Landing — standalone, no Boostify nav
const EventLandingPage = lazy(() => import("./pages/event-landing"));
// Cinematic Event Creator — admin panel to manage event pages
const EventCreatorPage = lazy(() => import("./pages/event-creator"));
const SmartMerchActivationPage = lazy(() => import("./pages/smart-merch-activation"));

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

// Función helper para crear imports con retry
const lazyWithRetry = (importFn: () => Promise<any>, retries = 3, interval = 1000) => {
  return lazy(() => {
    return new Promise((resolve, reject) => {
      const attemptLoad = (retriesLeft: number) => {
        importFn()
          .then(resolve)
          .catch((error: Error) => {
            if (retriesLeft > 0) {
              console.warn(`[LazyLoad] Retrying import... (${retries - retriesLeft + 1}/${retries})`);
              setTimeout(() => attemptLoad(retriesLeft - 1), interval);
            } else {
              console.error('[LazyLoad] Failed after all retries:', error);
              reject(error);
            }
          });
      };
      attemptLoad(retries);
    });
  });
};

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('React Error Boundary caught an error:', error, errorInfo);
    
    // Si es un error de carga de módulo, intentar recargar automáticamente
    const isChunkLoadError = error.message?.includes('Loading chunk') || 
                             error.message?.includes('Failed to fetch') ||
                             error.message?.includes('importing a module') ||
                             error.message?.includes('dynamically imported module') ||
                             error.name === 'ChunkLoadError';
    
    if (isChunkLoadError && this.state.retryCount < 2) {
      console.log('[ErrorBoundary] Chunk load error detected, auto-retrying...');
      this.setState(prev => ({ retryCount: prev.retryCount + 1, hasError: false, error: null }));
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, retryCount: 0 });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      const isModuleError = this.state.error?.message?.includes('module') || 
                           this.state.error?.message?.includes('chunk') ||
                           this.state.error?.message?.includes('fetch');
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md p-6 sm:p-8 rounded-lg bg-card border text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-destructive mb-4">
              {isModuleError ? 'Error de conexión' : 'Algo salió mal'}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-4">
              {isModuleError 
                ? 'No se pudo cargar el contenido. Esto puede deberse a una conexión lenta. Por favor, inténtalo de nuevo.'
                : (this.state.error?.message || 'Ha ocurrido un error inesperado')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm sm:text-base"
                onClick={this.handleRetry}
              >
                Reintentar
              </button>
              <button
                className="bg-secondary text-secondary-foreground px-4 py-2 rounded text-sm sm:text-base"
                onClick={() => window.location.reload()}
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Componente para inicializar el token de Clerk en el queryClient
const ClerkTokenInitializer = ({ children }: { children: ReactNode }) => {
  const { getToken, isSignedIn } = useAuth();
  
  useEffect(() => {
    // Configurar la función getToken de Clerk en el queryClient
    setClerkGetToken(getToken);
    console.log('✅ Clerk token initializer configured');
  }, [getToken]);

  // Inicializar Firebase Auth (puente Clerk → Firebase) en cuanto el usuario
  // está logueado en Clerk. Sin esto, las reglas de Firestore/Storage que
  // requieren `request.auth != null` rechazan todas las operaciones (galería,
  // merch, perfiles, etc.) con "Missing or insufficient permissions".
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const { ensureFirebaseAuth } = await import('./lib/firebase-auth');
        if (cancelled) return;
        const ok = await ensureFirebaseAuth();
        if (!ok) console.warn('⚠️ Firebase auth bridge no se pudo inicializar');
      } catch (err) {
        console.error('❌ Error inicializando Firebase auth bridge:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [isSignedIn]);
  
  return <>{children}</>;
};

const PageWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <div className="pb-20">
      {children}
    </div>
  );
};

// HOC para envolver componentes con el PageWrapper
const withPageWrapper = (Component: React.ComponentType<any>) => {
  return (props: any) => (
    <PageWrapper>
      <Component {...props} />
    </PageWrapper>
  );
};

/**
 * Wrap a page with a ModuleGate (one-time unlock OR subscription OR admin).
 * The page only renders for users who can access `moduleKey`; everyone else
 * sees the paywall with both "Unlock $X" and "Subscribe" paths.
 */
const withModuleGate = (Component: React.ComponentType<any>, moduleKey: string) => {
  return (props: any) => (
    <PageWrapper>
      <ModuleGate moduleKey={moduleKey}>
        <Component {...props} />
      </ModuleGate>
    </PageWrapper>
  );
};

// Función para seleccionar qué componente de ruta usar según el nivel de suscripción requerido
const getRouteComponent = (path: string, Component: React.ComponentType<any>, requiredPlan: SubscriptionPlan | null = null) => {
  // Si no se requiere nivel de suscripción, usar ruta normal (pública)
  if (requiredPlan === null) {
    return <Route path={path} component={Component} />;
  }
  
  // Si solo se requiere autenticación pero no suscripción, usar ProtectedRoute
  if (requiredPlan === 'free') {
    return <ProtectedRoute path={path} component={Component} />;
  }
  
  // Si se requiere suscripción específica, usar SubscriptionProtectedRoute
  return <SubscriptionProtectedRoute path={path} component={Component} requiredPlan={requiredPlan} />;
};

const Router = () => {
  const [showRadio, setShowRadio] = useState(false);
  const [location] = useLocation();
  const isFullscreenRoute =
    location === '/mini-studio' ||
    location.startsWith('/mini-studio/') ||
    location === '/legacy-catalog-resurrection' ||
    location === '/demotiguer' ||
    location === '/create-artist' ||
    location === '/create-artist/success' ||
    location === '/boostify-crowdsync-dj' ||
    location === '/dj-live' ||
    location.startsWith('/artist-blueprint/') ||
    location.startsWith('/business-plan/') ||
    location.startsWith('/hologram-showcase/') ||
    location.startsWith('/motion-capture/') ||
    location.startsWith('/m/mocap/') ||
    location.startsWith('/embed/playlist/') ||
    location.endsWith('/flow');

  useEffect(() => {
    const handleToggleRadio = () => setShowRadio(prev => !prev);
    window.addEventListener('toggle-radio', handleToggleRadio);
    return () => window.removeEventListener('toggle-radio', handleToggleRadio);
  }, []);

  // Aplicamos el HOC a todos los componentes de página
  const WrappedHomePage = withPageWrapper(HomePage);
  const WrappedTermsPage = withPageWrapper(TermsPage);
  const WrappedPrivacyPage = withPageWrapper(PrivacyPage);
  const WrappedPrivacyExtensionPage = withPageWrapper(PrivacyExtensionPage);
  const WrappedCookiesPage = withPageWrapper(CookiesPage);
  const WrappedLegalCenterPage = withPageWrapper(LegalCenterPage);
  const WrappedDmcaPolicyPage = withPageWrapper(DmcaPolicyPage);
  const WrappedCopyrightPolicyPage = withPageWrapper(CopyrightPolicyPage);
  const WrappedAiPolicyPage = withPageWrapper(AiPolicyPage);
  const WrappedProhibitedContentPage = withPageWrapper(ProhibitedContentPage);
  const WrappedTransparencyPage = withPageWrapper(TransparencyPage);
  const WrappedLegalClaimsPage = withPageWrapper(LegalClaimsPage);
  const WrappedAdminLegalPanelPage = withPageWrapper(AdminLegalPanelPage);
  const WrappedProfilePage = withPageWrapper(ProfilePage);
  const WrappedArtistProfilePage = withPageWrapper(ArtistProfilePage);
  const WrappedArtistBlueprintPage = withPageWrapper(ArtistBlueprintPage);
  const WrappedArtistBusinessPlanPage = withPageWrapper(ArtistBusinessPlanPage);
  const WrappedArtistStorePage = withPageWrapper(ArtistStorePage);
  const WrappedCartSuccessPage = withPageWrapper(CartSuccessPage);
  const WrappedCartCanceledPage = withPageWrapper(CartCanceledPage);
  const WrappedArtistOrdersPage = withPageWrapper(ArtistOrdersPage);
  const WrappedArtistSetupPage = withPageWrapper(ArtistSetupPage);
  const WrappedMyArtistPage = withPageWrapper(MyArtistPage);
  const WrappedMyArtistsPage = withPageWrapper(MyArtistsPage);
  const WrappedDashboardPage = withPageWrapper(DashboardPage);
  const WrappedAdminPage = withPageWrapper(AdminPage);
  const WrappedArtistDashboard = withPageWrapper(ArtistDashboard);
  const WrappedSpotifyPage = withPageWrapper(SpotifyPage);
  const WrappedContractsPage = withPageWrapper(ContractsPage);
  const WrappedGigMarketplaceRulesPage = withPageWrapper(GigMarketplaceRulesPage);
  const WrappedCopyrightVerifyPage = withPageWrapper(CopyrightVerifyPage);
  const WrappedBoostifyInternationalPage = withPageWrapper(BoostifyInternationalPage);
  const WrappedBoostifyTVPage = withPageWrapper(BoostifyTVPage);
  const WrappedLivePodcastStudioPage = withPageWrapper(LivePodcastStudioPage);
  const WrappedPodcastEpisodesPage = withPageWrapper(PodcastEpisodesPage);
  const WrappedBoostifyExplicitPage = withPageWrapper(BoostifyExplicitPage);
  const WrappedPRPage = withPageWrapper(PRPage);
  const WrappedNewsPage = withPageWrapper(NewsPage);
  const WrappedStageSyncPage = withPageWrapper(StageSyncPage);
  const WrappedHologramShowEnginePage = withModuleGate(HologramShowEnginePage, 'hologram-show-engine');
  const WrappedCharacterForgePage = withPageWrapper(CharacterForgePage);
  const WrappedHoloSuitStartupPage = withPageWrapper(HoloSuitStartupPage);
  const WrappedCrowdSyncDJPage = withPageWrapper(CrowdSyncDJPage);
  const WrappedStreamingPage = withPageWrapper(StreamingPage);
  const WrappedEventsPage = withPageWrapper(EventsPage);
  const WrappedExplorePage = withPageWrapper(ExplorePage);
  const WrappedMyTicketsPage = withPageWrapper(MyTicketsPage);
  const WrappedAnalyticsPage = withModuleGate(AnalyticsPage, 'analytics-observatory');
  const WrappedGlobalPage = withPageWrapper(GlobalPage);
  const WrappedVideosPage = withPageWrapper(VideosPage);
  const WrappedBlogPage = withPageWrapper(BlogPage);
  const WrappedPromotionPage = withPageWrapper(PromotionPage);
  const WrappedYoutubeViewsPage = withPageWrapper(YoutubeViewsPage);
  const WrappedInstagramBoostPage = withPageWrapper(InstagramBoostPage);
  const WrappedTikTokBoostPage = withPageWrapper(TikTokBoostPage);
  const WrappedSettingsPage = withPageWrapper(SettingsPage);
  const WrappedContactsPage = withPageWrapper(ContactsPage);
  const WrappedMessagesPage = withPageWrapper(MessagesPage);
  const WrappedManagerToolsPage = withPageWrapper(ManagerToolsPage);
  const WrappedProducerToolsPage = withModuleGate(ProducerToolsPage, 'producer-tools');
  const WrappedMiniStudioPage = withPageWrapper(MiniStudioPage);
  const WrappedMusicVideoCreator = withModuleGate(MusicVideoCreator, 'music-video-creator');
  const WrappedMusicVideoWorkflowPage = withPageWrapper(MusicVideoWorkflowPage);
  const WrappedMusicVideoWorkflowEnhancedPage = withPageWrapper(MusicVideoWorkflowEnhancedPage);
  const WrappedMusicGeneratorPage = withModuleGate(MusicGeneratorPage, 'ai-music-generator');
  const WrappedMotionDNAPage = withPageWrapper(MotionDNAPage);
  const WrappedRecordLabelServices = withPageWrapper(RecordLabelServices);
  const WrappedAIAgentsPage = withModuleGate(AIAgentsPage, 'ai-agents');
  const WrappedAgentNodesPage = withPageWrapper(AgentNodesPage);
  const WrappedAIAdvisorsPage = withPageWrapper(AIAdvisorsPage);
  const WrappedAIAdvisorsPageV2 = withPageWrapper(AIAdvisorsPageV2);
  const WrappedArtistImageAdvisor = withPageWrapper(ArtistImageAdvisor);
  const WrappedArtistImageAdvisorImproved = withPageWrapper(ArtistImageAdvisorImproved);
  const WrappedArtistGeneratorPage = withModuleGate(ArtistGeneratorPage, 'artist-generator');
  const WrappedMerchandisePage = withPageWrapper(MerchandisePage);
  const WrappedEcosystemPage = withPageWrapper(EcosystemPage);
  const WrappedStorePage = withPageWrapper(StorePage);
  const WrappedRealTimeTranslator = withPageWrapper(RealTimeTranslator);
  const WrappedEducationPage = withPageWrapper(EducationPage);
  const WrappedAchievementsPage = withPageWrapper(AchievementsPage);
  const WrappedCourseDetailPage = withPageWrapper(CourseDetailPage);
  const WrappedSmartCardsPage = withPageWrapper(SmartCardsPage);
  const WrappedInvestorsPage = withPageWrapper(InvestorsPage);
  const WrappedInvestorsDashboard = withPageWrapper(InvestorsDashboard);
  const WrappedInvestorDocumentsPage = withPageWrapper(InvestorDocumentsPage);
  const WrappedAffiliatesPage = withPageWrapper(AffiliatesPage);
  const WrappedAffiliatesNewPage = withPageWrapper(AffiliatesNewPage);
  const WrappedAffiliateAdminPage = withPageWrapper(AffiliateAdminPage);
  const WrappedInitProductsPage = withPageWrapper(InitProductsPage);
  const WrappedSocialNetworkPage = withPageWrapper(SocialNetworkPage);
  const WrappedFirestoreSocialPage = withPageWrapper(FirestoreSocialPage);
  const WrappedBoostiSwapPage = withPageWrapper(BoostiSwapPage);
  const WrappedBTFWalletPage = withPageWrapper(BTFWalletPage);
  const WrappedBTFStakingPage = withPageWrapper(BTFStakingPage);
  const WrappedBTFArtistMintPage = withPageWrapper(BTFArtistMintPage);
  const WrappedImageGeneratorPage = withPageWrapper(ImageGeneratorPage);
  const WrappedImageGeneratorSimplePage = withPageWrapper(ImageGeneratorSimplePage);
  const WrappedFaceSwapPage = withPageWrapper(FaceSwapPage);
  const WrappedKlingToolsPage = withPageWrapper(KlingToolsPage);
  const WrappedKlingStorePage = withPageWrapper(KlingStorePage);
  const WrappedKlingTestPage = withPageWrapper(KlingTestPage);
  const WrappedVideoGenerationTestPage = withPageWrapper(VideoGenerationTestPage);
  const WrappedCameraMovementsTestPage = withPageWrapper(CameraMovementsTestPage);
  const WrappedMusicMasteringPage = withPageWrapper(MusicMasteringPage);
  const WrappedVirtualRecordLabelPage = withModuleGate(VirtualRecordLabelPage, 'virtual-record-label');
  const WrappedTestProgressPage = withPageWrapper(TestProgressPage);
  const WrappedAuthPage = withPageWrapper(AuthPage);
  const WrappedLoginPage = withPageWrapper(LoginPage);
  const WrappedAuthSignupPage = withPageWrapper(AuthSignupPage);
  const WrappedPluginsPage = withPageWrapper(PluginsPage);
  const WrappedTryOnPage = withPageWrapper(TryOnPage);
  const WrappedPricingPage = withPageWrapper(PricingPage);
  const WrappedMusicVideoPricing = withPageWrapper(MusicVideoPricing);
  const WrappedAccountPage = withPageWrapper(AccountPage);
  const WrappedSubscriptionSuccessPage = withPageWrapper(SubscriptionSuccessPage);
  const WrappedSubscriptionCancelledPage = withPageWrapper(SubscriptionCancelledPage);
  const WrappedSubscriptionExamplePage = withPageWrapper(SubscriptionExamplePage);
  const WrappedMusicVideoSuccess = withPageWrapper(MusicVideoSuccess);
  const WrappedMusicVideoCancelled = withPageWrapper(MusicVideoCancelled);
  const WrappedProductSuccessPage = withPageWrapper(ProductSuccessPage);
  const WrappedProductCancelledPage = withPageWrapper(ProductCancelledPage);
  const WrappedProfessionalEditorPage = withPageWrapper(ProfessionalEditorPage);
  const WrappedLayerFilterDemoPage = withPageWrapper(LayerFilterDemoPage);
  const WrappedAnimatedWorkflowPage = withPageWrapper(AnimatedWorkflowPage);
  const WrappedTokenizationPage = withModuleGate(TokenizationPage, 'tokenization');
  const WrappedResourcesPage = withPageWrapper(ResourcesPage);
  const WrappedTipsPage = withPageWrapper(TipsPage);
  const WrappedGuidesPage = withPageWrapper(GuidesPage);
  const WrappedToolsPage = withPageWrapper(ToolsPage);
  const WrappedFeaturesPage = withPageWrapper(FeaturesPage);
  const WrappedAIVideoCreationPage = withPageWrapper(AIVideoCreationPage);
  const WrappedTimelineDemoPage = withPageWrapper(TimelineDemoPage);
  const WrappedDebugFirebasePage = withPageWrapper(DebugFirebasePage);
  const WrappedTimelineEditorPage = withPageWrapper(TimelineEditorPage);
  const WrappedDiagnosticsPage = withPageWrapper(DiagnosticsPage);
  const WrappedArticlePage = withPageWrapper(ArticlePage);
  const WrappedSocialMediaGeneratorPage = withPageWrapper(SocialMediaGeneratorPage);
  const WrappedFinancialEnablementPage = withPageWrapper(FinancialEnablementPage);
  const WrappedTokenPurchaseSuccessPage = withPageWrapper(TokenPurchaseSuccessPage);
  const WrappedSponsorProposalPage = withPageWrapper(SponsorProposalPage);
  const WrappedVenueProposalPage = withPageWrapper(VenueProposalPage);
  const WrappedVideoServicePage = withPageWrapper(VideoServicePage);
  const WrappedVideoConceptsPage = withPageWrapper(VideoConceptsPage);
  const WrappedVideoConceptsProjectPage = withPageWrapper(VideoConceptsProjectPage);
  const WrappedVideoServiceSuccessPage = withPageWrapper(VideoServiceSuccessPage);
  const WrappedNotFound = withPageWrapper(NotFound);
  const WrappedSongSharePage = withPageWrapper(SongSharePage);

  return (
    <>
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Switch>
          {/* Rutas públicas - accesibles sin autenticación */}
          {getRouteComponent("/", WrappedHomePage, null)}
          {getRouteComponent("/auth", WrappedAuthPage, null)}
          {getRouteComponent("/auth/register", WrappedAuthSignupPage, null)}
          {getRouteComponent("/register", WrappedAuthSignupPage, null)}
          {getRouteComponent("/signup", WrappedAuthSignupPage, null)}
          {getRouteComponent("/login", WrappedLoginPage, null)}
          {getRouteComponent("/diagnostics", WrappedDiagnosticsPage, null)}
          {getRouteComponent("/terms", WrappedTermsPage, null)}
          {getRouteComponent("/privacy", WrappedPrivacyPage, null)}
          {getRouteComponent("/privacy/extension", WrappedPrivacyExtensionPage, null)}
          {getRouteComponent("/cookies", WrappedCookiesPage, null)}
          {/* Legal / DMCA / Copyright protection system */}
          {getRouteComponent("/legal", WrappedLegalCenterPage, null)}
          {getRouteComponent("/legal/dmca", WrappedDmcaPolicyPage, null)}
          {getRouteComponent("/legal/copyright", WrappedCopyrightPolicyPage, null)}
          {getRouteComponent("/legal/ai-content", WrappedAiPolicyPage, null)}
          {getRouteComponent("/legal/prohibited", WrappedProhibitedContentPage, null)}
          {getRouteComponent("/legal/transparency", WrappedTransparencyPage, null)}
          {getRouteComponent("/legal/my-claims", WrappedLegalClaimsPage, null)}
          {getRouteComponent("/admin/legal", WrappedAdminLegalPanelPage, null)}
          {getRouteComponent("/gig-rules", WrappedGigMarketplaceRulesPage, null)}
          {getRouteComponent("/article/:id", WrappedArticlePage, null)}
          {getRouteComponent("/song/:id", WrappedSongSharePage, null)}
          {getRouteComponent("/embed/playlist/:id", PlaylistEmbedPage, null)}
          {getRouteComponent("/verify/:hash", WrappedCopyrightVerifyPage, null)}
          {getRouteComponent("/sponsor/proposal/:dealId", WrappedSponsorProposalPage, null)}
          {getRouteComponent("/venue-proposal/:dealId", WrappedVenueProposalPage, null)}
          {getRouteComponent("/videoservice", WrappedVideoServicePage, null)}
          {getRouteComponent("/legacy-catalog-resurrection", LegacyCatalogResurrectionPage, null)}
          {getRouteComponent("/demotiguer", DemoTiguerPage, null)}
          {getRouteComponent("/hologram-showcase/:artistId", HologramShowcasePage, null)}
          {getRouteComponent("/motion-capture/:artistId", MotionCaptureStudioPage, null)}
          {getRouteComponent("/m/mocap/:artistId", MotionCaptureMobilePage, null)}
          {getRouteComponent("/create-artist", CreateArtistLandingPage, null)}
          {getRouteComponent("/create-artist/success", CreateArtistSuccessPage, null)}
          {getRouteComponent("/artist-growth-engine", ArtistGrowthEngineDashboardPage, 'pro')}
          {getRouteComponent("/video-concepts", WrappedVideoConceptsPage, null)}
          {getRouteComponent("/video-concepts/project/:id", WrappedVideoConceptsProjectPage, null)}
          {getRouteComponent("/videoservice/success", WrappedVideoServiceSuccessPage, null)}
          {/* Cinematic Event Creator — admin panel (wrapped, needs Boostify nav) */}
          {getRouteComponent("/event-creator", withPageWrapper(EventCreatorPage), 'free')}
          {/* Cinematic Event Landing — isolated guest experience, NO withPageWrapper */}
          <Route path="/event/:slug" component={EventLandingPage} />
          {getRouteComponent("/profile/:id", WrappedProfilePage, null)}
          {getRouteComponent("/artist/:slug/flow", ArtistNodeFlowPage, null)}
          {getRouteComponent("/artist/:slug/store", WrappedArtistStorePage, null)}
          {getRouteComponent("/activate/:artistId/:productId/:serialId", SmartMerchActivationPage, null)}
          {getRouteComponent("/cart/success", WrappedCartSuccessPage, null)}
          {getRouteComponent("/cart/canceled", WrappedCartCanceledPage, null)}
          {getRouteComponent("/dashboard/orders", WrappedArtistOrdersPage, 'free')}
          {getRouteComponent("/artist/:slug", WrappedArtistProfilePage, null)}
          {getRouteComponent("/universe/:userId", MyUniversePage, null)}
          {getRouteComponent("/artist-blueprint/:artistId", WrappedArtistBlueprintPage, 'artist')}
          {getRouteComponent("/business-plan/:artistId", WrappedArtistBusinessPlanPage, null)}
          {getRouteComponent("/artist-setup", WrappedArtistSetupPage, null)}
          {getRouteComponent("/my-artist", WrappedMyArtistPage, 'free')}
          {getRouteComponent("/my-artists", WrappedMyArtistsPage, 'free')}
          {getRouteComponent("/pricing", WrappedPricingPage, null)}
          {getRouteComponent("/music-video-pricing", WrappedMusicVideoPricing, null)}
          {getRouteComponent("/boostify-explicit", WrappedBoostifyExplicitPage, null)}
          {getRouteComponent("/explore", WrappedExplorePage, null)}
          {getRouteComponent("/explorar", WrappedExplorePage, null)}
          {getRouteComponent("/marketplace", WrappedExplorePage, null)}
          
          {/* FREE — requieren autenticación pero no suscripción */}
          {getRouteComponent("/dashboard", WrappedDashboardPage, 'free')}
          {getRouteComponent("/profile", WrappedProfilePage, 'free')}
          {getRouteComponent("/settings", WrappedSettingsPage, 'free')}
          {getRouteComponent("/messages", WrappedMessagesPage, 'free')}
          {getRouteComponent("/account", WrappedAccountPage, 'free')}
          {getRouteComponent("/subscription/success", WrappedSubscriptionSuccessPage, 'free')}
          {getRouteComponent("/subscription/cancelled", WrappedSubscriptionCancelledPage, 'free')}
          {getRouteComponent("/subscription/example", WrappedSubscriptionExamplePage, 'free')}
          {getRouteComponent("/music-video-success", WrappedMusicVideoSuccess, 'free')}
          {getRouteComponent("/music-video-cancelled", WrappedMusicVideoCancelled, 'free')}
          {getRouteComponent("/product-success", WrappedProductSuccessPage, null)}
          {getRouteComponent("/product-cancelled", WrappedProductCancelledPage, null)}
          {getRouteComponent("/token-purchase-success", WrappedTokenPurchaseSuccessPage, null)}
          {getRouteComponent("/boostify-tv", WrappedBoostifyTVPage, 'free')}
          {getRouteComponent("/social-network", WrappedSocialNetworkPage, 'free')}
          {getRouteComponent("/firestore-social", WrappedFirestoreSocialPage, 'free')}
          {getRouteComponent("/education", WrappedEducationPage, 'free')}
          {getRouteComponent("/blog", WrappedBlogPage, 'free')}
          {getRouteComponent("/news", WrappedNewsPage, 'free')}
          {getRouteComponent("/stage-sync", WrappedStageSyncPage, 'free')}
          {getRouteComponent("/hologram-show-engine", WrappedHologramShowEnginePage, null)}
          {getRouteComponent("/holosuit", WrappedHoloSuitStartupPage, null)}
          {getRouteComponent("/character-forge", WrappedCharacterForgePage, null)}
          {getRouteComponent("/vr-studio", withPageWrapper(VRStudioPage), null)}
          {getRouteComponent("/boostify-crowdsync-dj", WrappedCrowdSyncDJPage, 'free')}
          {getRouteComponent("/dj-live", WrappedCrowdSyncDJPage, 'free')}
          {getRouteComponent("/streaming", WrappedStreamingPage, 'free')}
          {getRouteComponent("/events", WrappedEventsPage, 'free')}
          {getRouteComponent("/my-tickets", WrappedMyTicketsPage, 'free')}
          {getRouteComponent("/tickets", WrappedMyTicketsPage, 'free')}
          {getRouteComponent("/store", WrappedStorePage, 'free')}
          {getRouteComponent("/affiliates", WrappedAffiliatesPage, 'free')}
          {getRouteComponent("/affiliates-new", WrappedAffiliatesNewPage, 'free')}
          {getRouteComponent("/spotify", WrappedSpotifyPage, 'free')}
          {getRouteComponent("/youtube-views", WrappedYoutubeViewsPage, 'free')}
          {getRouteComponent("/instagram-boost", WrappedInstagramBoostPage, 'free')}
          {getRouteComponent("/tiktok-boost", WrappedTikTokBoostPage, 'free')}

          {/* ARTIST ($19.99) — Artist hub & basic tools */}
          {getRouteComponent("/artist-dashboard", WrappedArtistDashboard, 'artist')}
          {getRouteComponent("/live-podcast-studio", WrappedLivePodcastStudioPage, 'artist')}
          {getRouteComponent("/podcast-episodes", WrappedPodcastEpisodesPage, 'artist')}
          {getRouteComponent("/contracts", WrappedContractsPage, 'artist')}
          {getRouteComponent("/videos", WrappedVideosPage, 'artist')}
          {getRouteComponent("/social-media-generator", WrappedSocialMediaGeneratorPage, 'artist')}
          {getRouteComponent("/image-generator-simple", WrappedImageGeneratorSimplePage, 'artist')}
          {getRouteComponent("/artist-image-advisor", WrappedArtistImageAdvisor, 'artist')}
          {getRouteComponent("/artist-image-advisor-improved", WrappedArtistImageAdvisorImproved, 'artist')}
          {getRouteComponent("/merchandise", WrappedMerchandisePage, 'artist')}
          {getRouteComponent("/course/:id", WrappedCourseDetailPage, 'artist')}

          {/* ELEVATE / CREATOR ($49.99) — Growth & content creation */}
          {getRouteComponent("/pr", WrappedPRPage, 'basic')}
          {getRouteComponent("/promotion", WrappedPromotionPage, 'basic')}
          {getRouteComponent("/music-video-creator", WrappedMusicVideoCreator, 'basic')}
          {getRouteComponent("/music-video-workflow", WrappedMusicVideoWorkflowPage, 'basic')}
          {getRouteComponent("/music-video-flow", WrappedMusicVideoWorkflowEnhancedPage, 'basic')}
          {getRouteComponent("/ai-advisors", WrappedAIAdvisorsPage, 'basic')}
          {getRouteComponent("/achievements", WrappedAchievementsPage, 'basic')}

          {/* AMPLIFY / PROFESSIONAL ($89.99) — Pro analytics & AI tools */}
          {getRouteComponent("/analytics", WrappedAnalyticsPage, 'pro')}
          {getRouteComponent("/global", WrappedGlobalPage, 'pro')}
          {getRouteComponent("/financial-enablement", WrappedFinancialEnablementPage, 'pro')}
          {getRouteComponent("/manager-tools", WrappedManagerToolsPage, 'pro')}
          {getRouteComponent("/producer-tools", WrappedProducerToolsPage, 'pro')}
          {getRouteComponent("/mini-studio", MiniStudioPage, 'free')}
          {getRouteComponent("/music-generator", WrappedMusicGeneratorPage, 'pro')}
          {getRouteComponent("/music-mastering", WrappedMusicMasteringPage, 'pro')}
          {getRouteComponent("/image-generator", WrappedImageGeneratorPage, 'pro')}
          {getRouteComponent("/face-swap", WrappedFaceSwapPage, 'pro')}
          {getRouteComponent("/professional-editor", WrappedProfessionalEditorPage, 'pro')}
          {getRouteComponent("/smart-cards", WrappedSmartCardsPage, 'pro')}
          {getRouteComponent("/translator", WrappedRealTimeTranslator, 'pro')}
          {getRouteComponent("/ai-agents", WrappedAIAgentsPage, 'pro')}
          {getRouteComponent("/agent-nodes", WrappedAgentNodesPage, 'pro')}
          {getRouteComponent("/ai-video-creation", WrappedAIVideoCreationPage, 'pro')}

          {/* DOMINATE / ENTERPRISE ($149.99) — Virtual Label & Web3 */}
          {getRouteComponent("/virtual-record-label", WrappedVirtualRecordLabelPage, 'premium')}
          {getRouteComponent("/vrl", WrappedVirtualRecordLabelPage, 'premium')}
          {getRouteComponent("/record-label-services", WrappedRecordLabelServices, 'premium')}
          {getRouteComponent("/artist-generator", WrappedArtistGeneratorPage, 'premium')}
          {getRouteComponent("/motion-dna", WrappedMotionDNAPage, 'premium')}
          {getRouteComponent("/kling-tools", WrappedKlingToolsPage, 'premium')}
          {getRouteComponent("/kling-store", WrappedKlingStorePage, 'premium')}
          {getRouteComponent("/ecosystem", WrappedEcosystemPage, 'premium')}
          {getRouteComponent("/boostify-international", WrappedBoostifyInternationalPage, 'premium')}
          {getRouteComponent("/contacts", WrappedContactsPage, 'premium')}
          {getRouteComponent("/tokenization", WrappedTokenizationPage, 'premium')}
          {getRouteComponent("/btf-wallet", WrappedBTFWalletPage, 'premium')}
          {getRouteComponent("/btf-staking", WrappedBTFStakingPage, 'premium')}
          {getRouteComponent("/btf-artist-mint", WrappedBTFArtistMintPage, 'premium')}

          {/* Admin & misc */}
          {getRouteComponent("/admin", WrappedAdminPage, null)}
          {/* Artist Acquisition System — admin-only, full-screen layout (no PageWrapper) */}
          <Route path="/admin/artist-acquisition" component={ArtistAcquisitionDashboard} />
          <Route path="/admin/boostify-alliances" component={BoostifyAlliancesDashboard} />
          <Route path="/admin/artist-identity" component={AdminArtistIdentity} />
          {getRouteComponent("/affiliate-admin", WrappedAffiliateAdminPage, null)}
          {getRouteComponent("/investors", WrappedInvestorsPage, null)}
          {getRouteComponent("/investors-dashboard", WrappedInvestorsDashboard, null)}
          {getRouteComponent("/investor-documents", WrappedInvestorDocumentsPage, null)}
          {getRouteComponent("/init-products", WrappedInitProductsPage, 'free')}
          {getRouteComponent("/plugins", WrappedPluginsPage, 'free')}
          {getRouteComponent("/try-on", WrappedTryOnPage, 'free')}
          {getRouteComponent("/try-on-page", WrappedTryOnPage, 'free')}
          {getRouteComponent("/boostiswap", WrappedBoostiSwapPage, null)}
          {getRouteComponent("/resources", WrappedResourcesPage, null)}
          {getRouteComponent("/tips", WrappedTipsPage, null)}
          {getRouteComponent("/guides", WrappedGuidesPage, null)}
          {getRouteComponent("/tools", WrappedToolsPage, null)}
          {getRouteComponent("/features", WrappedFeaturesPage, null)}
          {getRouteComponent("/tools/royalty-calculator", WrappedToolsPage, 'free')}
          {getRouteComponent("/tools/press-kit", WrappedToolsPage, 'free')}
          {getRouteComponent("/tools/release-planner", WrappedToolsPage, 'free')}
          {getRouteComponent("/tools/playlist-submission", WrappedToolsPage, 'free')}

          {/* Test / Demo pages */}
          {getRouteComponent("/kling-test", WrappedKlingTestPage, 'free')}
          {getRouteComponent("/video-generation-test", WrappedVideoGenerationTestPage, 'free')}
          {getRouteComponent("/camera-movements-test", WrappedCameraMovementsTestPage, 'free')}
          {getRouteComponent("/test-progress", WrappedTestProgressPage, 'free')}
          {getRouteComponent("/layer-filter-demo", WrappedLayerFilterDemoPage, 'free')}
          {getRouteComponent("/animated-workflow", WrappedAnimatedWorkflowPage, 'free')}
          {getRouteComponent("/timeline-demo", WrappedTimelineDemoPage, 'free')}
          {getRouteComponent("/timeline", WrappedTimelineEditorPage, 'free')}
          {getRouteComponent("/timeline/:projectId", WrappedTimelineEditorPage, 'free')}
          {getRouteComponent("/debug-firebase", WrappedDebugFirebasePage, null)}
          
          {/* Página de error 404 */}
          <Route component={WrappedNotFound} />
        </Switch>
        </Suspense>
      </ErrorBoundary>
      {!isFullscreenRoute && <BottomNav />}
      {!isFullscreenRoute && showRadio && <BoostifyRadio onClose={() => setShowRadio(false)} />}
      {/* CustomerServiceAgent - Temporarily disabled */}
      {/* <CustomerServiceAgent /> */}
      {!isFullscreenRoute && <SupportChatWidget />}
    </>
  );
};

const App = () => {
  const [initError, setInitError] = useState<Error | null>(null);

  useEffect(() => {
    // Ya no necesitamos verificar los activos críticos porque
    // los hemos configurado correctamente en index.html
    
    return () => {
      // No hay temporizadores para limpiar
    };
  }, []);

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md p-8 rounded-lg bg-card border text-center">
          <h2 className="text-2xl font-bold text-destructive mb-4">Initialization Error</h2>
          <p className="text-muted-foreground mb-4">{initError.message}</p>
          <button
            className="bg-primary text-primary-foreground px-4 py-2 rounded"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {/* Componente invisible para manejar errores de WebSocket */}
      <div className="min-h-screen bg-background text-foreground">
        <ViteHMRErrorHandler />
        <ClerkTokenInitializer>
          <QueryClientProvider client={queryClient}>
            <MotionConfig reducedMotion="user">
            <ThemeEngineProvider>
            <SubscriptionProvider>
              <GlobalAuthGuard>
                <EditorProvider>
                  <AudioPlayerProvider>
                    <CartProvider>
                    <Web3Wrapper>
                      <Router />
                    </Web3Wrapper>
                    <MiniPlayer />
                    <CartDrawer />
                    <CartFloatingButton />
                    {/* Toaster hidden by request — notifications disabled */}
                    </CartProvider>
                  </AudioPlayerProvider>
                </EditorProvider>
              </GlobalAuthGuard>
            </SubscriptionProvider>
            </ThemeEngineProvider>
            </MotionConfig>
          </QueryClientProvider>
        </ClerkTokenInitializer>
      </div>
    </ErrorBoundary>
  );
};

export default App;