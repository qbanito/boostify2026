import { useEffect } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import MiniStudio from '../components/producer/MiniStudio';

/**
 * /mini-studio — Boostify Mini Studio DAW console rendered in
 * true full-screen mode (bypasses the standard PageWrapper chrome
 * so the producer has the entire viewport to work with).
 */
export default function MiniStudioPage() {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const goFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-[#0a0a0d] flex flex-col">
      <div
        className="shrink-0 border-b border-white/10 bg-[#0a0a0d]/95 backdrop-blur"
        style={{
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
        }}
      >
        <div className="flex h-11 items-center justify-between gap-2 px-2 sm:px-3">
          <div className="min-w-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 hidden sm:block">
            Boostify Mini Studio
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/producer-tools" className="h-8 px-3 rounded-md bg-white/10 hover:bg-white/20 text-zinc-200 text-xs font-medium flex items-center gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" /> Salir
            </Link>
            <button onClick={goFullscreen} className="h-8 px-2.5 rounded-md bg-white/10 hover:bg-white/20 text-zinc-200 text-xs font-medium flex items-center gap-1.5" title="Pantalla completa">
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Expandir</span>
            </button>
          </div>
        </div>
      </div>
      <div
        className="flex-1 min-h-0 mini-studio-fullscreen"
        style={{
          paddingRight: 'env(safe-area-inset-right, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
        }}
      >
        <MiniStudio />
      </div>
      <style>{`
        .mini-studio-fullscreen > div { height: 100% !important; min-height: 0 !important; border-radius: 0 !important; border: none !important; }
      `}</style>
    </div>
  );
}
