import { Link, useLocation } from "wouter";
import { logger } from "../../lib/logger";
import { cn } from "../../lib/utils";
import {
  Home, Video, Music2, Bot, User, Radio, Menu, ChevronLeft, ChevronRight, Mic, BarChart2,
  MessageSquare, ShoppingBag, PhoneCall, Users, Layers, BarChart, Settings, BookOpen,
  Headphones, FileText, Rss, Send, Shield, Upload, Zap, Activity, Sparkles, Theater, PartyPopper, Archive, Monitor, Clapperboard
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

// BTF Token icon component that behaves like a Lucide icon
const BTFIcon = ({ className }: { className?: string }) => (
  <img src="/btf_logo.png" alt="BTF" className={cn("object-contain", className)} />
);
import { useNavigationVisibility } from "../../hooks/use-navigation-visibility";
import { useAuth } from "../../hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

export function BottomNav() {
  const [location] = useLocation();
  const [showRadioIndicator, setShowRadioIndicator] = useState(false);
  const [showAllNav, setShowAllNav] = useState(false);
  const { isVisible, setIsVisible, toggle } = useNavigationVisibility();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const lastClickTimeRef = useRef<number>(0);
  const doubleClickThreshold = 300; // ms
  const { user } = useAuth();

  // My Profile button always goes to the edit page (/profile)
  // not to the public artist page (/artist/:slug)
  const profileHref = '/profile';

  // Todos los elementos de navegación para la barra principal - Nuevo orden
  const allNavItems = [
    {
      title: "Home",
      icon: Home,
      href: "/",
      plan: "free"
    },
    {
      title: "Dashboard",
      icon: Activity,
      href: "/dashboard",
      plan: "free"
    },
    {
      title: "My Profile",
      icon: User,
      href: profileHref,
      plan: "free"
    },
    {
      title: "My Artists",
      icon: Mic,
      href: "/my-artists",
      plan: "free",
      highlight: true
    },
    {
      title: "Investors",
      icon: Layers,
      href: "/investors-dashboard",
      plan: null
    },
    {
      title: "Music Video",
      icon: Video,
      href: "/music-video-creator",
      plan: "free"
    },
    { title: "CrowdSync DJ",
      icon: Theater,
      href: "/boostify-crowdsync-dj",
      plan: "free",
      highlight: true
    },
    {
      title: "Streaming",
      icon: Headphones,
      href: "/streaming",
      plan: "free",
      highlight: true
    },
    {
      title: "Hologram Show",
      icon: Monitor,
      href: "/hologram-show-engine",
      plan: "free",
      highlight: true
    },
    {
      title: "Catalog Resurrection",
      icon: Archive,
      href: "/legacy-catalog-resurrection",
      plan: "free",
      highlight: true
    },
    {
      title: "Event Videos",
      icon: PartyPopper,
      href: "/video-concepts",
      plan: "free"
    },
    {
      title: "Event Creator",
      icon: Clapperboard,
      href: "/event-creator",
      plan: "free",
      highlight: true
    },
    {
      title: "Music Gen",
      icon: Sparkles,
      href: "/music-generator",
      plan: "pro"
    },
    {
      title: "Producer Tools",
      icon: Music2,
      href: "/producer-tools",
      plan: "pro"
    },
    {
      title: "Mini Studio",
      icon: Music2,
      href: "/mini-studio",
      plan: "free",
      highlight: true
    },
    {
      title: "Distribution",
      icon: Upload,
      href: "/artist-dashboard",
      plan: "basic"
    },
    {
      title: "BoostiSwap",
      icon: Zap,
      href: "/boostiswap",
      plan: "free"
    },
    {
      title: "BTF Wallet",
      icon: BTFIcon,
      href: "/btf-wallet",
      plan: "free"
    },
    {
      title: "YouTube",
      icon: Video,
      href: "/youtube-views",
      plan: "pro"
    },
    {
      title: "Spotify",
      icon: Music2,
      href: "/spotify",
      plan: "basic"
    },
    {
      title: "Instagram",
      icon: Rss,
      href: "/instagram-boost",
      plan: "pro"
    },
    {
      title: "TikTok",
      icon: Video,
      href: "/tiktok-boost",
      plan: "pro"
    },
    {
      title: "PR",
      icon: Send,
      href: "/pr",
      plan: "basic"
    },
  ];

  // Elementos de navegación para el botón "More" - Resto de páginas organizadas
  const moreNavItems = [
    { title: "Social Network", icon: MessageSquare, href: "/social-network", plan: "basic" },
    { title: "Virtual Record Label", icon: Radio, href: "/virtual-record-label", plan: "premium" },
    { title: "AI Advisors", icon: PhoneCall, href: "/ai-advisors", plan: "premium" },
    // { title: "Store", icon: ShoppingBag, href: "/store", plan: "basic" }, // TEMP: hidden — page kept for future re-integration
    { title: "Affiliates", icon: Users, href: "/affiliates", plan: "basic" },
    { title: "Manager Tools", icon: Settings, href: "/manager-tools", plan: "pro" },
    { title: "Education", icon: BookOpen, href: "/education", plan: "basic" },
    { title: "News", icon: Rss, href: "/news", plan: "free" },
    { title: "Boostify TV", icon: Video, href: "/boostify-tv", plan: "premium" },
    { title: "Record Labels", icon: Headphones, href: "/record-label-services", plan: "premium" },
    { title: "AI Agents", icon: Bot, href: "/ai-agents", plan: "premium" },
    { title: "Artist Image", icon: FileText, href: "/artist-image-advisor", plan: "pro" },
    { title: "Merch", icon: ShoppingBag, href: "/merchandise", plan: "pro" },
    { title: "Contracts", icon: FileText, href: "/contracts", plan: "basic" },
    { title: "Contacts", icon: Users, href: "/contacts", plan: "pro" },
    { title: "Financial", icon: BarChart, href: "/financial-enablement", plan: "free" },
    { title: "BTF Staking", icon: Shield, href: "/btf-staking", plan: "free" },
    { title: "AI Artist Mint", icon: Sparkles, href: "/btf-artist-mint", plan: "free" },
    { title: "Admin", icon: BarChart2, href: "/admin", plan: "free" },
    { title: "Settings", icon: Settings, href: "/settings", plan: "free" },
  ];

  // Listen for radio toggle event
  useEffect(() => {
    const handleRadioToggle = () => {
      setShowRadioIndicator(true);
      setTimeout(() => setShowRadioIndicator(false), 3000);
    };
    
    window.addEventListener('toggle-radio', handleRadioToggle);
    
    return () => {
      window.removeEventListener('toggle-radio', handleRadioToggle);
    };
  }, []);

  // Double-click handler implementado en el hook global useNavigationVisibility
  // Ya no necesitamos el manejo local de doble clic, ya que ahora está centralizado
  // en el hook que afecta a todos los componentes de navegación

  // Handle showing navigation by swiping up from bottom
  useEffect(() => {
    let touchStartY = 0;
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    
    const handleTouchMove = (e: TouchEvent) => {
      const touchY = e.touches[0].clientY;
      const diff = touchStartY - touchY;
      
      // Detect swipe up from bottom
      if (diff > 50 && touchStartY > window.innerHeight - 50 && !isVisible) {
        setIsVisible(true);
      }
    };
    
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isVisible, setIsVisible]);

  // Scroll controls for horizontal navigation
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -100, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 100, behavior: 'smooth' });
    }
  };

  // Toggle between compact and expanded views
  const toggleAllNav = () => {
    setShowAllNav(!showAllNav);
  };

  // Publish the visible height of the bottom nav as a CSS variable on the
  // document root so other fixed-bottom UI (e.g. the global MiniPlayer) can
  // sit just above it without overlapping. When the nav is hidden (translated
  // off-screen) we publish 0 so those elements drop back to the bottom edge.
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const el = navRef.current;
      const h = isVisible && el ? el.getBoundingClientRect().height : 0;
      root.style.setProperty('--bottom-nav-height', `${Math.round(h)}px`);
    };
    update();
    let ro: ResizeObserver | null = null;
    if (navRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(update);
      ro.observe(navRef.current);
    }
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
      // Reset on unmount so floating UI drops to the bottom edge.
      root.style.setProperty('--bottom-nav-height', '0px');
    };
  }, [isVisible, showAllNav]);

  // State para mostrar el mensaje de ayuda temporal
  const [showHelpToast, setShowHelpToast] = useState(true);
  
  // Efecto para ocultar el mensaje de ayuda después de unos segundos
  useEffect(() => {
    if (showHelpToast) {
      const timer = setTimeout(() => {
        setShowHelpToast(false);
      }, 5000); // 5 segundos
      
      return () => clearTimeout(timer);
    }
  }, [showHelpToast]);
  
  return (
    <>
      {/* Navigation bar - adaptable for mobile */}
      <div 
        ref={navRef}
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300",
          !isVisible ? "translate-y-full" : "translate-y-0"
        )}
      >
        {/* Hidden navigation indicator - visible when nav is hidden */}
        {!isVisible && (
          <div 
            className="absolute -top-6 left-0 right-0 flex justify-center"
            onClick={() => setIsVisible(true)}
          >
            <div className="bg-black/90 rounded-t-lg px-6 py-1 border-t border-x border-orange-500/30">
              <ChevronLeft className="w-5 h-5 text-orange-500/70 transform -rotate-90" />
            </div>
          </div>
        )}
        
        <nav
          className="bg-black/90 backdrop-blur-lg border-t border-orange-500/20 shadow-lg"
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            paddingLeft: 'env(safe-area-inset-left, 0px)',
            paddingRight: 'env(safe-area-inset-right, 0px)',
          }}
        >
          <div className="relative max-w-screen-xl mx-auto">
            {/* Expanded view - shows all navigation items in a horizontally scrollable container */}
            {showAllNav && (
              <div className="px-2 py-4 overflow-hidden bg-black/95">
                <div className="flex items-center">
                  <button 
                    onClick={scrollLeft} 
                    className="scroll-control flex-shrink-0 p-2 z-10 bg-gradient-to-r from-black to-transparent pr-4"
                    aria-label="Scroll left"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  
                  <div 
                    ref={scrollContainerRef}
                    className="horizontal-scroll-container flex-1 overflow-x-auto scrollbar-hide flex items-center space-x-3 px-1 py-2"
                  >
                    {/* Mostrar primero los elementos principales de navegación */}
                    {allNavItems.map((item) => (
                      <Link key={item.title} href={item.href} className="horizontal-scroll-item">
                        <div className={cn(
                          "nav-btn flex-shrink-0 flex flex-col items-center p-3 min-w-[5rem] rounded-lg",
                          location === item.href ? "nav-btn-active" : "",
                          (item as any).highlight && "border border-orange-500/50 bg-gradient-to-b from-orange-500/10 to-transparent shadow-[0_0_10px_rgba(249,115,22,0.3)]"
                        )}>
                          <div className="relative flex items-center justify-center">
                            <item.icon
                              className={cn(
                                "w-7 h-7 transition-all duration-300",
                                location === item.href
                                  ? "text-orange-500"
                                  : (item as any).highlight
                                    ? "text-orange-400"
                                    : "text-muted-foreground"
                              )}
                            />
                            {location === item.href && (
                              <div className="absolute -inset-2 bg-orange-500/20 rounded-full blur animate-pulse" />
                            )}
                            {(item as any).highlight && location !== item.href && (
                              <div className="absolute -inset-1 bg-orange-500/10 rounded-full animate-pulse" />
                            )}
                            
                            {/* Indicador de nivel de suscripción requerido */}
                            {item.plan && item.plan !== 'free' && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center">
                                <div className={cn(
                                  "text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center",
                                  item.plan === 'basic' ? "bg-blue-600 text-white" : 
                                  item.plan === 'pro' ? "bg-purple-600 text-white" : 
                                  "bg-orange-600 text-white"
                                )}>
                                  {item.plan === 'basic' ? 'B' : item.plan === 'pro' ? 'P' : 'P+'}
                                </div>
                              </div>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-sm font-medium transition-colors duration-300 whitespace-nowrap mt-2",
                              location === item.href
                                ? "text-orange-500"
                                : (item as any).highlight
                                  ? "text-orange-400"
                                  : "text-muted-foreground"
                            )}
                          >
                            {item.title}
                          </span>
                        </div>
                      </Link>
                    ))}
                    
                    {/* Separador visual entre navegación principal y opciones de More */}
                    <div className="w-px h-16 bg-orange-500/20 mx-2"></div>
                    
                    {/* Mostrar todas las opciones adicionales de "More" */}
                    {moreNavItems.map((item) => (
                      <Link key={item.title} href={item.href} className="horizontal-scroll-item">
                        <div className={cn(
                          "nav-btn flex-shrink-0 flex flex-col items-center p-3 min-w-[5rem] rounded-lg",
                          location === item.href ? "nav-btn-active" : ""
                        )}>
                          <div className="relative flex items-center justify-center">
                            <item.icon
                              className={cn(
                                "w-7 h-7 transition-all duration-300",
                                location === item.href
                                  ? "text-orange-500"
                                  : "text-muted-foreground"
                              )}
                            />
                            {location === item.href && (
                              <div className="absolute -inset-2 bg-orange-500/20 rounded-full blur animate-pulse" />
                            )}
                            
                            {/* Indicador de nivel de suscripción requerido */}
                            {item.plan && item.plan !== 'free' && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center">
                                <div className={cn(
                                  "text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center",
                                  item.plan === 'basic' ? "bg-blue-600 text-white" : 
                                  item.plan === 'pro' ? "bg-purple-600 text-white" : 
                                  "bg-orange-600 text-white"
                                )}>
                                  {item.plan === 'basic' ? 'B' : item.plan === 'pro' ? 'P' : 'P+'}
                                </div>
                              </div>
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-sm font-medium transition-colors duration-300 whitespace-nowrap mt-2",
                              location === item.href
                                ? "text-orange-500"
                                : "text-muted-foreground"
                            )}
                          >
                            {item.title}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                  
                  <button 
                    onClick={scrollRight} 
                    className="scroll-control flex-shrink-0 p-2 z-10 bg-gradient-to-l from-black to-transparent pl-4"
                    aria-label="Scroll right"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="absolute bottom-0 w-full flex justify-center">
                  <button
                    onClick={toggleAllNav}
                    className="nav-toggle mb-[-0.75rem] bg-black border-2 border-orange-500/50 rounded-full p-2 text-orange-500"
                    aria-label="Close expanded navigation"
                  >
                    <ChevronLeft className="w-5 h-5 transform rotate-90" />
                  </button>
                </div>
              </div>
            )}

            {/* Compact view - shows limited navigation items */}
            {!showAllNav && (
              <div className="flex items-center justify-between px-3 py-3">
                {/* First 4 primary navigation items */}
                {allNavItems.slice(0, 4).map((item) => (
                  <Link key={item.title} href={item.href} className="mobile-nav-item">
                    <div className={cn(
                      "nav-btn flex flex-col items-center p-2 min-w-[4.5rem] rounded-lg",
                      location === item.href ? "nav-btn-active" : ""
                    )}>
                      <div className="relative flex items-center justify-center">
                        <item.icon
                          className={cn(
                            "w-6 h-6 transition-all duration-300",
                            location === item.href
                              ? "text-orange-500"
                              : "text-muted-foreground"
                          )}
                        />
                        {location === item.href && (
                          <div className="absolute -inset-1 bg-orange-500/20 rounded-full blur animate-pulse" />
                        )}
                        
                        {/* Indicador de nivel de suscripción requerido */}
                        {item.plan && item.plan !== 'free' && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center">
                            <div className={cn(
                              "text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center",
                              item.plan === 'basic' ? "bg-blue-600 text-white" : 
                              item.plan === 'pro' ? "bg-purple-600 text-white" : 
                              "bg-orange-600 text-white"
                            )}>
                              {item.plan === 'basic' ? 'B' : item.plan === 'pro' ? 'P' : 'P+'}
                            </div>
                          </div>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-xs font-medium mt-1 transition-colors duration-300",
                          location === item.href
                            ? "text-orange-500"
                            : "text-muted-foreground"
                        )}
                      >
                        {item.title}
                      </span>
                    </div>
                  </Link>
                ))}
                
                {/* More button - shows expanded menu with all options */}
                <button
                  onClick={toggleAllNav}
                  className="mobile-nav-item nav-btn flex flex-col items-center p-2 min-w-[4.5rem] rounded-lg"
                  aria-label="Show more navigation options"
                >
                  <div className="relative flex items-center justify-center">
                    <Menu className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <span className="text-xs font-medium mt-1 text-muted-foreground">
                    More
                  </span>
                </button>
                
                {/* Radio button */}
                <button
                  className="mobile-nav-item nav-btn flex flex-col items-center p-2 min-w-[4.5rem] rounded-lg"
                  onClick={() => window.dispatchEvent(new CustomEvent('toggle-radio'))}
                  aria-label="Toggle radio"
                >
                  <div className="relative flex items-center justify-center">
                    <Radio 
                      className={cn(
                        "w-6 h-6 transition-all duration-300",
                        showRadioIndicator 
                          ? "text-orange-500" 
                          : "text-muted-foreground hover:text-orange-500"
                      )}
                    />
                    {showRadioIndicator && (
                      <div className="absolute -inset-1 bg-orange-500/20 rounded-full blur animate-pulse" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-medium mt-1 transition-colors duration-300",
                    showRadioIndicator 
                      ? "text-orange-500" 
                      : "text-muted-foreground"
                  )}>
                    Radio
                  </span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
      
      {/* Toast message for double-click instruction - shown briefly on load */}
      <div className={cn(
        "toast-notification fixed bottom-28 left-0 right-0 mx-auto w-max py-3 px-6 bg-black/90 backdrop-blur-md border border-orange-500/40 rounded-lg text-white text-sm shadow-lg transition-opacity duration-500 z-50 flex items-center space-x-2",
        (showHelpToast && isVisible) ? "opacity-100" : "opacity-0 pointer-events-none"
      )} style={{ bottom: 'calc(var(--bottom-nav-height, 0px) + 0.75rem)' }}>
        <span className="bg-orange-500/20 rounded-full p-1">
          <ChevronLeft className="w-4 h-4 text-orange-500" />
        </span>
        <span>Doble clic para ocultar/mostrar menú</span>
      </div>
    </>
  );
}