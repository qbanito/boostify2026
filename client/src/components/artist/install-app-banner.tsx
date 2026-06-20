import { useState, useEffect, useCallback } from 'react';
import { Download, Smartphone, Wifi, WifiOff, X, Check, Share, Star, Music, Zap, Shield, ChevronDown } from 'lucide-react';

interface InstallAppBannerProps {
  artistName: string;
  profileImage?: string;
  isInstallable: boolean;
  isInstalled: boolean;
  isOfflineReady: boolean;
  isOnline: boolean;
  onInstall: () => Promise<void>;
  themeColor?: string;
  genre?: string;
}

const DISMISS_KEY = 'boostify_install_dismissed';
const SPLASH_SHOWN_KEY = 'boostify_install_splash_shown';

function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function getDeviceInfo() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);
  const isSamsung = /SamsungBrowser/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  const isChrome = /Chrome/.test(ua) && !/Edge|Edg|OPR/.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
  return { isIOS, isAndroid, isSamsung, isFirefox, isChrome, isMobile: isMobileDevice(), isStandalone };
}

export function InstallAppBanner({
  artistName,
  profileImage,
  isInstallable,
  isInstalled,
  isOfflineReady,
  isOnline,
  onInstall,
  themeColor = '#f97316',
  genre,
}: InstallAppBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showFullSplash, setShowFullSplash] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [device, setDevice] = useState<ReturnType<typeof getDeviceInfo> | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const info = getDeviceInfo();
    setDevice(info);

    // Check if already dismissed permanently
    const wasDismissed = localStorage.getItem(DISMISS_KEY);
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // On mobile first visit, show full-screen splash after 1.5s
    if (info.isMobile && !info.isStandalone) {
      const splashShown = sessionStorage.getItem(SPLASH_SHOWN_KEY);
      if (!splashShown) {
        const timer = setTimeout(() => {
          setShowFullSplash(true);
          sessionStorage.setItem(SPLASH_SHOWN_KEY, 'true');
        }, 1500);
        return () => clearTimeout(timer);
      }
    }

    // Animate mini banner
    const timer = setTimeout(() => setAnimateIn(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setShowFullSplash(false);
  }, []);

  const handleDismissPermanent = useCallback(() => {
    setDismissed(true);
    setShowFullSplash(false);
    localStorage.setItem(DISMISS_KEY, 'true');
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!device) return;

    if (device.isIOS) {
      // Instructions are accessible via the icon on the artist page — just dismiss
      handleDismiss();
    } else if (isInstallable) {
      setInstalling(true);
      try {
        await onInstall();
      } finally {
        setInstalling(false);
      }
    } else {
      // Instructions are accessible via the icon on the artist page — just dismiss
      handleDismiss();
    }
  }, [device, isInstallable, onInstall, handleDismiss]);

  // Don't show if already installed, dismissed, or running as standalone PWA
  if (isInstalled || dismissed) return null;
  if (device?.isStandalone) return null;

  // Don't show if not mobile and not installable
  if (!device?.isMobile && !isInstallable) return null;

  return (
    <>
      {/* ===== FULL-SCREEN APP STORE SPLASH ===== */}
      {showFullSplash && (
        <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#000' }}>
          {/* Background glow */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(ellipse at 50% 20%, ${themeColor}60 0%, transparent 70%)`,
            }}
          />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>

          <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
            {/* App Icon */}
            <div className="relative mb-6">
              <div
                className="w-28 h-28 rounded-[28px] overflow-hidden border-2 shadow-2xl"
                style={{
                  borderColor: `${themeColor}80`,
                  boxShadow: `0 20px 60px ${themeColor}40`,
                }}
              >
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={artistName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${themeColor}, ${adjustColor(themeColor, -40)})` }}
                  >
                    <Music className="w-14 h-14 text-white" />
                  </div>
                )}
              </div>
              {/* Verified badge */}
              <div
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-black"
                style={{ background: themeColor }}
              >
                <Check className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* App Name */}
            <h1 className="text-2xl font-bold text-white text-center mb-1">
              {artistName}
            </h1>
            <p className="text-sm text-gray-400 mb-1">Boostify Music</p>
            {genre && (
              <p className="text-xs text-gray-500 mb-4">{genre}</p>
            )}

            {/* Rating */}
            <div className="flex items-center gap-1 mb-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="text-xs text-gray-400 ml-1">5.0</span>
            </div>

            {/* Install Button */}
            <button
              onClick={handleInstallClick}
              disabled={installing}
              className="w-full max-w-xs flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-lg text-white transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.97] disabled:opacity-70"
              style={{
                background: `linear-gradient(135deg, ${themeColor} 0%, ${adjustColor(themeColor, -30)} 100%)`,
                boxShadow: `0 12px 40px ${themeColor}50`,
              }}
            >
              {installing ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Download className="w-6 h-6" />
              )}
              {installing ? 'Instalando...' : device?.isIOS ? 'Añadir a inicio' : 'Instalar gratis'}
            </button>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 mt-8 w-full max-w-xs">
              <FeaturePill icon={<Zap className="w-4 h-4" />} label="Rápido" color={themeColor} />
              <FeaturePill icon={<WifiOff className="w-4 h-4" />} label="Offline" color={themeColor} />
              <FeaturePill icon={<Shield className="w-4 h-4" />} label="Seguro" color={themeColor} />
            </div>

            {/* Description */}
            <p className="text-center text-gray-400 text-sm mt-6 max-w-xs leading-relaxed">
              Accede directamente desde tu pantalla de inicio. Sin tienda de apps, sin esperas.
            </p>
          </div>

          {/* Bottom actions */}
          <div className="px-6 pb-8 relative z-10" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px) + 1rem)' }}>
            <button
              onClick={handleDismissPermanent}
              className="w-full text-center text-gray-500 text-xs py-2 hover:text-gray-400 transition-colors"
            >
              No volver a mostrar
            </button>
          </div>
        </div>
      )}

      {/* ===== MINI FLOATING BANNER (after splash dismissed or on revisit) ===== */}
      {!showFullSplash && !showIOSGuide && (
        <div
          className={`fixed bottom-4 left-4 right-4 z-50 transition-all duration-500 ${
            animateIn ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
          }`}
          style={{ maxWidth: '420px', margin: '0 auto' }}
        >
          <div
            className="relative rounded-2xl overflow-hidden backdrop-blur-xl border border-white/20 shadow-2xl"
            style={{
              background: `linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(20,20,30,0.95) 100%)`,
              boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${themeColor}20`,
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
              style={{
                background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)`,
              }}
            />

            <button
              onClick={handleDismissPermanent}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>

            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={artistName}
                    className="w-12 h-12 rounded-xl object-cover border-2"
                    style={{ borderColor: themeColor }}
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${themeColor}30` }}
                  >
                    <Smartphone className="w-6 h-6" style={{ color: themeColor }} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-sm truncate">
                    Instalar {artistName}
                  </h3>
                  <p className="text-gray-400 text-xs">
                    Accede directo desde tu pantalla de inicio
                  </p>
                </div>
              </div>

              <button
                onClick={handleInstallClick}
                disabled={installing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: `linear-gradient(135deg, ${themeColor} 0%, ${adjustColor(themeColor, -20)} 100%)`,
                  boxShadow: `0 8px 24px ${themeColor}40`,
                }}
              >
                <Download className="w-4 h-4" />
                {device?.isIOS ? 'Añadir a inicio' : 'Instalar App'}
              </button>

              <div className="flex items-center justify-center gap-2 mt-3">
                {isOfflineReady ? (
                  <span className="flex items-center gap-1.5 text-xs text-green-400">
                    <Check className="w-3 h-3" />
                    Disponible offline
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    {isOnline ? (
                      <>
                        <Wifi className="w-3 h-3" />
                        Preparando modo offline...
                      </>
                    ) : (
                      <>
                        <WifiOff className="w-3 h-3" />
                        Sin conexión
                      </>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== iOS / FALLBACK INSTALLATION GUIDE ===== */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #0a0a15 100%)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="p-6 space-y-5">
              {/* Artist icon at top */}
              <div className="flex flex-col items-center">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={artistName}
                    className="w-16 h-16 rounded-2xl object-cover border-2 mb-3"
                    style={{ borderColor: themeColor }}
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
                    style={{ background: `linear-gradient(135deg, ${themeColor}, ${adjustColor(themeColor, -40)})` }}
                  >
                    <Music className="w-8 h-8 text-white" />
                  </div>
                )}
                <h3 className="text-xl font-bold text-white mb-1">
                  {device?.isIOS ? 'Instalar en iPhone/iPad' : 'Añadir a pantalla de inicio'}
                </h3>
                <p className="text-gray-400 text-sm text-center">
                  {artistName} se instalará como una app en tu dispositivo
                </p>
              </div>

              {/* Steps */}
              <div className="space-y-4">
                {device?.isIOS ? (
                  <>
                    <Step
                      number={1}
                      themeColor={themeColor}
                      icon={
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                          <polyline points="16 6 12 2 8 6" />
                          <line x1="12" y1="2" x2="12" y2="15" />
                        </svg>
                      }
                      title='Toca el botón "Compartir"'
                      description='El ícono ⬆ en la barra inferior de Safari'
                    />
                    <Step
                      number={2}
                      themeColor={themeColor}
                      icon={<span className="text-lg font-bold">+</span>}
                      title='"Añadir a pantalla de inicio"'
                      description="Desplázate hacia abajo en el menú y selecciona esta opción"
                    />
                    <Step
                      number={3}
                      themeColor={themeColor}
                      icon={<Check className="w-5 h-5" />}
                      title='Toca "Añadir"'
                      description={`El ícono de ${artistName} aparecerá en tu pantalla`}
                    />
                  </>
                ) : (
                  <>
                    <Step
                      number={1}
                      themeColor={themeColor}
                      icon={<span className="text-lg">⋮</span>}
                      title="Abre el menú del navegador"
                      description={device?.isSamsung ? 'Toca ☰ en la esquina inferior derecha' : 'Toca los 3 puntos ⋮ en la esquina superior derecha'}
                    />
                    <Step
                      number={2}
                      themeColor={themeColor}
                      icon={<Download className="w-5 h-5" />}
                      title={device?.isFirefox ? '"Instalar"' : '"Añadir a pantalla de inicio"'}
                      description="Busca esta opción en el menú"
                    />
                    <Step
                      number={3}
                      themeColor={themeColor}
                      icon={<Check className="w-5 h-5" />}
                      title='Confirma "Añadir"'
                      description={`${artistName} se instalará como una app`}
                    />
                  </>
                )}
              </div>

              {/* Visual hint for iOS */}
              {device?.isIOS && (
                <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10">
                  <ChevronDown className="w-4 h-4 text-gray-400 animate-bounce" />
                  <span className="text-xs text-gray-400">
                    Busca el ícono ⬆ abajo en Safari
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-400 animate-bounce" />
                </div>
              )}

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-3 rounded-xl font-bold text-white/80 bg-white/10 hover:bg-white/15 transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FeaturePill({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/10">
      <div style={{ color }}>{icon}</div>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

function Step({
  number,
  themeColor,
  icon,
  title,
  description,
}: {
  number: number;
  themeColor: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
        style={{
          backgroundColor: `${themeColor}20`,
          color: themeColor,
          border: `2px solid ${themeColor}40`,
        }}
      >
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          {icon}
          {title}
        </div>
        <p className="text-gray-400 text-xs mt-0.5">{description}</p>
      </div>
    </div>
  );
}

// Offline status bar for the top of the page
export function OfflineIndicator({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-yellow-600/90 backdrop-blur-sm py-1.5 px-4 text-center">
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-white">
        <WifiOff className="w-4 h-4" />
        <span>Modo offline — Mostrando contenido guardado</span>
      </div>
    </div>
  );
}

// Utility function to darken/lighten a hex color
function adjustColor(hex: string, amount: number): string {
  const color = hex.replace('#', '');
  const num = parseInt(color, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
  return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
}
