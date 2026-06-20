// ─── HologramRenderer ─────────────────────────────────────────────────────────
// Black-background 3D renderer using <model-viewer> web component.
// Overlays hologram visual effects (scanlines, glow, flicker).

import React, { useEffect, useRef, useState } from 'react';
import type { CharacterAsset } from '../../schemas/holostage/character.schema';
import type { HologramOutputSettings } from '../../schemas/holostage/hologramOutput.schema';
import type { PlaybackState } from '../../services/holostage/showTimelineEngine';
import { hologramOutputManager } from '../../services/holostage/hologramOutputManager';
import type { AvatarSpaceTransform } from './AvatarSpacePositioner';

// Teach TS about the model-viewer web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        src?: string;
        alt?: string;
        'auto-rotate'?: boolean | string;
        'camera-controls'?: boolean | string;
        'shadow-intensity'?: string;
        'environment-image'?: string;
        exposure?: string;
        'animation-name'?: string;
        autoplay?: boolean | string;
        style?: React.CSSProperties;
        ref?: React.Ref<HTMLElement>;
      }, HTMLElement>;
    }
  }
}

interface HologramRendererProps {
  character: CharacterAsset | null;
  settings: HologramOutputSettings;
  playbackState: PlaybackState;
  currentAnimation?: string;
  avatarTransform?: AvatarSpaceTransform;
  rendererRef?: React.RefObject<HTMLDivElement>;
  /** Fired once the GLB loads — reports the real animation clip names found in the model. */
  onAnimationsDiscovered?: (names: string[]) => void;
}

const HOLOGRAM_ANIMATIONS = ['idle', 'dance', 'wave', 'bow', 'walk'];

export function HologramRenderer({
  character,
  settings,
  playbackState,
  currentAnimation = 'idle',
  avatarTransform,
  rendererRef,
  onAnimationsDiscovered,
}: HologramRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelViewerRef = useRef<HTMLElement | null>(null);
  const [modelViewerReady, setModelViewerReady] = useState(false);
  const [clipNames, setClipNames] = useState<string[]>([]);
  const [flickerOpacity, setFlickerOpacity] = useState(1);
  const flickerRef = useRef<number | null>(null);

  // ─── Load model-viewer script ────────────────────────────────────────────
  useEffect(() => {
    if (document.querySelector('script[data-model-viewer]')) {
      setModelViewerReady(true);
      return;
    }
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    script.setAttribute('data-model-viewer', 'true');
    script.onload = () => setModelViewerReady(true);
    document.head.appendChild(script);
  }, []);

  // ─── Discover real animation clips once the GLB loads ───────────────────
  useEffect(() => {
    const mv = modelViewerRef.current as any;
    if (!mv) return;
    const report = () => {
      const names: string[] = Array.isArray(mv.availableAnimations) ? [...mv.availableAnimations] : [];
      setClipNames(names);
      if (names.length) onAnimationsDiscovered?.(names);
    };
    if (mv.loaded) report();
    mv.addEventListener('load', report);
    return () => mv.removeEventListener('load', report);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelViewerReady, character?.glbUrl]);

  // ─── Hologram flicker effect ─────────────────────────────────────────────
  useEffect(() => {
    if (playbackState !== 'playing' || settings.hologramEffect === 'none') {
      setFlickerOpacity(1);
      return;
    }
    const flicker = () => {
      const rand = Math.random();
      if (rand < 0.03) {
        setFlickerOpacity(0.6 + Math.random() * 0.4);
        setTimeout(() => setFlickerOpacity(1), 50 + Math.random() * 100);
      }
      flickerRef.current = requestAnimationFrame(flicker);
    };
    flickerRef.current = requestAnimationFrame(flicker);
    return () => { if (flickerRef.current) cancelAnimationFrame(flickerRef.current); };
  }, [playbackState, settings.hologramEffect]);

  const isBlackout = playbackState === 'blackout';
  const isStopped = playbackState === 'stopped';

  // CSS filter from output settings
  const filterCSS = hologramOutputManager.buildFilterCSS(settings);

  // Hologram color tint based on effect
  const effectColors: Record<string, string> = {
    holographic: 'rgba(0, 220, 255, 0.08)',
    scanlines: 'rgba(0, 255, 180, 0.05)',
    crt: 'rgba(0, 180, 255, 0.06)',
    phosphor: 'rgba(0, 255, 100, 0.07)',
    none: 'transparent',
  };
  const tintColor = effectColors[settings.hologramEffect] || 'transparent';

  return (
    <div
      ref={rendererRef ?? containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ background: '#000000' }}
    >
      {/* Pure black background */}
      <div className="absolute inset-0 bg-black" />

      {/* Subtle floor reflection gradient */}
      {!isBlackout && (
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: '30%',
            background: 'linear-gradient(to top, rgba(249,115,22,0.04) 0%, transparent 100%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Model viewer */}
      {modelViewerReady && character && !isBlackout && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            filter: filterCSS,
            opacity: flickerOpacity,
            transition: 'opacity 50ms',
            transform: avatarTransform
              ? `translateX(${avatarTransform.x}px) translateY(${-avatarTransform.y}px) scale(${avatarTransform.scale}) rotateY(${avatarTransform.rotY}deg)${settings.mirrorMode ? ' scaleX(-1)' : ''}`
              : settings.mirrorMode ? 'scaleX(-1)' : undefined,
          }}
        >
          {/* @ts-ignore - model-viewer web component */}
          <model-viewer
            ref={modelViewerRef}
            key={character.glbUrl}
            src={character.glbUrl}
            alt={character.name}
            loading="eager"
            draco-decoder-location="https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
            auto-rotate={playbackState === 'stopped' ? 'true' : undefined}
            shadow-intensity="0"
            environment-image="neutral"
            exposure="1.2"
            animation-name={clipNames.includes(currentAnimation) ? currentAnimation : undefined}
            autoplay={clipNames.length > 0 ? true : undefined}
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
              '--poster-color': 'transparent',
            } as React.CSSProperties}
          />
        </div>
      )}

      {/* No character placeholder */}
      {!character && !isBlackout && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div
            className="w-32 h-32 rounded-full border-2 border-dashed"
            style={{ borderColor: 'rgba(249,115,22,0.4)' }}
          >
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-5xl opacity-20">👤</span>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'rgba(249,115,22,0.5)' }}>
            Sin character cargado
          </p>
        </div>
      )}

      {/* Hologram color tint overlay */}
      {!isBlackout && settings.hologramEffect !== 'none' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: tintColor, mixBlendMode: 'screen' }}
        />
      )}

      {/* Scanlines overlay */}
      {!isBlackout && (settings.hologramEffect === 'scanlines' || settings.hologramEffect === 'holographic') && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
            opacity: 0.5 * settings.effectIntensity,
          }}
        />
      )}

      {/* Chromatic Aberration overlay */}
      {!isBlackout && settings.chromaticAberration && (() => {
        const caStyle = hologramOutputManager.buildCAStyle(settings);
        return caStyle ? <div className="absolute inset-0 pointer-events-none" style={caStyle} /> : null;
      })()}

      {/* CRT curvature vignette */}
      {!isBlackout && settings.vignetteEnabled && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,${settings.vignetteStrength ?? 0.7}) 100%)`,
          }}
        />
      )}

      {/* Glitch effect */}
      {!isBlackout && settings.glitchEnabled && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ mixBlendMode: 'difference', opacity: settings.glitchIntensity ?? 0.3 }}
        >
          <div style={{
            position: 'absolute',
            top: `${20 + Math.random() * 60}%`,
            left: 0, right: 0,
            height: `${2 + (settings.glitchIntensity ?? 0.3) * 4}px`,
            background: 'rgba(0,212,255,0.6)',
            transform: `translateX(${(Math.random() - 0.5) * 20 * (settings.glitchIntensity ?? 0.3)}px)`,
          }} />
        </div>
      )}

      {/* Bloom/glow edge effect */}
      {!isBlackout && settings.bloomEnabled && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 ${60 * settings.bloomIntensity}px rgba(249,115,22,${0.15 * settings.bloomIntensity})`,
          }}
        />
      )}

      {/* Blackout overlay */}
      {isBlackout && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-2xl font-bold tracking-widest uppercase" style={{ color: '#f97316' }}>
              BLACKOUT
            </p>
            <p className="text-xs tracking-widest" style={{ color: 'rgba(249,115,22,0.4)' }}>
              Click BLACKOUT para restaurar
            </p>
          </div>
        </div>
      )}

      {/* Fallback indicator */}
      {playbackState === 'fallback' && (
        <div
          className="absolute top-3 left-3 px-3 py-1 text-xs font-bold tracking-widest uppercase rounded"
          style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}
        >
          FALLBACK MODE
        </div>
      )}

      {/* Status HUD - top right */}
      <div
        className="absolute top-3 right-3 text-right space-y-1"
        style={{ color: 'rgba(249,115,22,0.6)' }}
      >
        <div className="text-xs font-mono tracking-wider uppercase">
          {playbackState === 'playing' && '● LIVE'}
          {playbackState === 'paused' && '⏸ PAUSED'}
          {playbackState === 'stopped' && '■ STOPPED'}
          {playbackState === 'blackout' && '■ BLACKOUT'}
          {playbackState === 'fallback' && '▲ FALLBACK'}
        </div>
        {character && (
          <div className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {character.name}
          </div>
        )}
      </div>

      {/* Corner scan effect lines */}
      {!isBlackout && (
        <>
          <div className="absolute top-0 left-0 w-8 h-8 pointer-events-none" style={{ borderTop: '1px solid rgba(249,115,22,0.4)', borderLeft: '1px solid rgba(249,115,22,0.4)' }} />
          <div className="absolute top-0 right-0 w-8 h-8 pointer-events-none" style={{ borderTop: '1px solid rgba(249,115,22,0.4)', borderRight: '1px solid rgba(249,115,22,0.4)' }} />
          <div className="absolute bottom-0 left-0 w-8 h-8 pointer-events-none" style={{ borderBottom: '1px solid rgba(249,115,22,0.4)', borderLeft: '1px solid rgba(249,115,22,0.4)' }} />
          <div className="absolute bottom-0 right-0 w-8 h-8 pointer-events-none" style={{ borderBottom: '1px solid rgba(249,115,22,0.4)', borderRight: '1px solid rgba(249,115,22,0.4)' }} />
        </>
      )}
    </div>
  );
}
