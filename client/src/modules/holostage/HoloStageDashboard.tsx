// ─── HoloStageDashboard ───────────────────────────────────────────────────────
// Main orchestrator for Boostify StageOS / HoloStage Engine MVP1.
// Holds all HoloShow state and wires all sub-components together.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  User, Music, List, Lightbulb, Activity, Monitor, PlayCircle, Package,
  ChevronLeft, ChevronRight, Sliders, Radio, GitBranch, Scan, Film,
  Play, Pause, Square, SkipForward, SkipBack, Moon, AlertTriangle,
  Maximize2, Minimize2, PanelLeftClose, PanelRightClose,
  Camera, Users, Building2, X,
} from 'lucide-react';
import type { HoloShow, ShowSong, ShowMetadata } from '../../schemas/holostage/showPackage.schema';
import type { TimelineCue } from '../../schemas/holostage/timelineCue.schema';
import type { DMXScene } from '../../schemas/holostage/dmx.schema';
import type { CharacterAsset } from '../../schemas/holostage/character.schema';
import type { CharacterRig } from '../../schemas/holostage/characterRig.schema';
import type { HologramOutputSettings } from '../../schemas/holostage/hologramOutput.schema';
import type { HoloSuitConfig } from '../../schemas/holostage/motionSource.schema';
import type { TimelineState } from '../../services/holostage/showTimelineEngine';

import { DEFAULT_OUTPUT_SETTINGS } from '../../schemas/holostage/hologramOutput.schema';
import { DEFAULT_HOLOSUIT_CONFIG } from '../../schemas/holostage/motionSource.schema';
import { DEFAULT_HUMANOID_MAPPING } from '../../schemas/holostage/characterRig.schema';
import { PRESET_DMX_SCENES } from '../../schemas/holostage/dmx.schema';

import { showTimelineEngine } from '../../services/holostage/showTimelineEngine';
import { hologramOutputManager } from '../../services/holostage/hologramOutputManager';
import { holosuitBridge } from '../../services/holostage/holosuitBridge';
import { holostageGateway } from '../../services/holostage/holostageGateway';

import { HoloLangProvider, useHoloLang } from './holoLangContext';
import { HologramRenderer } from './HologramRenderer';
import { CharacterImporter } from './CharacterImporter';
import { CharacterPreview } from './CharacterPreview';
import { RepertoireBuilder } from './RepertoireBuilder';
import { SongTimelineEditor } from './SongTimelineEditor';
import { CueEditor } from './CueEditor';
import { DMXSceneBuilder } from './DMXSceneBuilder';
import { HoloSuitBridgePanel } from './HoloSuitBridgePanel';
import { HologramOutputSettings as OutputSettingsPanel } from './HologramOutputSettings';
import { LiveShowController } from './LiveShowController';
import { ShowPackageExporter } from './ShowPackageExporter';
import { CharacterCalibration } from './CharacterCalibration';
import { MotionSourceSetup } from './MotionSourceSetup';
import { WorkflowPipelinePanel } from './WorkflowPipelinePanel';
import { AvatarSpacePositioner, type AvatarSpaceTransform } from './AvatarSpacePositioner';
import { AnimationStudio } from './AnimationStudio';
import { SceneOverviewPanel } from './SceneOverviewPanel';
import { CaptureDevicesPanel } from './CaptureDevicesPanel';
import { ActorManagerPanel } from './ActorManagerPanel';
import { VenueOSDashboard } from '../venueos/VenueOSDashboard';
import { HoloStageGuide } from './HoloStageGuide';

// ─── Persistence ─────────────────────────────────────────────────────────────
const STORAGE_KEY = 'boostify_holoshow_v1';

function loadStoredShow(): HoloShow | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<HoloShow>;
    const empty = buildEmptyShow();
    // Merge with defaults so old/partial shows never have undefined required fields
    return {
      ...empty,
      ...parsed,
      holosuitConfig: parsed.holosuitConfig ?? empty.holosuitConfig,
      outputSettings: parsed.outputSettings ?? empty.outputSettings,
      characterRig:   parsed.characterRig   ?? empty.characterRig,
      dmxScenes:      parsed.dmxScenes      ?? empty.dmxScenes,
      songs:          parsed.songs          ?? [],
      cues:           parsed.cues           ?? [],
      metadata:       parsed.metadata       ?? {},
    };
  } catch {
    return null;
  }
}

function saveShowToStorage(show: HoloShow): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(show));
  } catch {
    // quota exceeded — silently ignore
  }
}

// ─── Initial State ────────────────────────────────────────────────────────────

function buildEmptyShow(): HoloShow {
  const now = new Date().toISOString();
  return {
    id: `show-${Date.now()}`,
    name: 'My HoloShow',
    artistName: 'Artist',
    status: 'draft',
    songs: [],
    cues: [],
    dmxScenes: [...PRESET_DMX_SCENES],
    character: null,
    characterRig: {
      id: 'default-humanoid',
      characterId: '',
      rigType: 'humanoid',
      boneMappings: DEFAULT_HUMANOID_MAPPING,
      rootBone: 'Hips',
      scaleMultiplier: 1.0,
      handMappingEnabled: true,
      faceMappingEnabled: true,
      iKEnabled: false,
      footIK: false,
      handIK: false,
    },
    outputSettings: { ...DEFAULT_OUTPUT_SETTINGS },
    holosuitConfig: { ...DEFAULT_HOLOSUIT_CONFIG },
    metadata: {},
    createdAt: now,
    updatedAt: now,
    version: '1.0.0',
    format: 'boostify-holostage-v1',
  };
}

// ─── Nav Tabs ─────────────────────────────────────────────────────────────────

type TabId = 'character' | 'repertoire' | 'timeline' | 'dmx' | 'holosuit' | 'output' | 'live' | 'export' | 'calibration' | 'motionsource' | 'workflow' | 'vrspace' | 'animation' | 'capture' | 'actors' | 'venue';

type NavTab = { id: TabId; labelKey: string; icon: React.ComponentType<{ className?: string }>; badge?: string };

const NAV_TABS_DEF: NavTab[] = [
  // ── Phase 1: Venue & Artist Setup ───────────────────────────
  { id: 'venue',        labelKey: 'nav_venue',       icon: Building2  },
  { id: 'character',    labelKey: 'nav_character',   icon: User       },
  { id: 'actors',       labelKey: 'nav_actors',      icon: Users      },
  // ── Phase 2: Capture & Motion ────────────────────────────────
  { id: 'capture',      labelKey: 'nav_capture',     icon: Camera     },
  { id: 'holosuit',       labelKey: 'nav_mocap',       icon: Activity   },
  { id: 'motionsource', labelKey: 'nav_mocap_pro',   icon: Radio      },
  { id: 'calibration',  labelKey: 'nav_calibrate',   icon: Sliders    },
  // ── Phase 3: Show Content ────────────────────────────────────
  { id: 'repertoire',   labelKey: 'nav_repertoire',  icon: Music      },
  { id: 'timeline',     labelKey: 'nav_timeline',    icon: List       },
  { id: 'animation',    labelKey: 'nav_animation',   icon: Film       },
  { id: 'dmx',          labelKey: 'nav_lighting',    icon: Lightbulb  },
  // ── Phase 4: Output & Performance ───────────────────────────
  { id: 'output',       labelKey: 'nav_output',      icon: Monitor    },
  { id: 'vrspace',      labelKey: 'nav_vrspace',     icon: Scan       },
  { id: 'workflow',     labelKey: 'nav_pipeline',    icon: GitBranch  },
  { id: 'live',         labelKey: 'nav_live',        icon: PlayCircle, badge: 'LIVE' },
  { id: 'export',       labelKey: 'nav_export',      icon: Package    },
];

// ─── Layout Presets ─────────────────────────────────────────────────────────

type LayoutSlot = { leftPanelW: number; rightPanelW: number; sidebarCollapsed: boolean; label: string; icon?: string };

const BUILTIN_LAYOUT_PRESETS: LayoutSlot[] = [
  { label: 'SETUP',   icon: '⚙',  leftPanelW: 380, rightPanelW: 0,   sidebarCollapsed: false },
  { label: 'STUDIO',  icon: '🎬', leftPanelW: 300, rightPanelW: 220, sidebarCollapsed: true  },
  { label: 'LIVE',    icon: '▶',  leftPanelW: 0,   rightPanelW: 0,   sidebarCollapsed: true  },
  { label: 'FULL',    icon: '⊞',  leftPanelW: 280, rightPanelW: 280, sidebarCollapsed: false },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function HoloStageDashboard({ onExit, initialCharacter }: { onExit?: () => void; initialCharacter?: CharacterAsset | null } = {}) {
  return (
    <HoloLangProvider>
      <HoloStageDashboardInner onExit={onExit} initialCharacter={initialCharacter} />
    </HoloLangProvider>
  );
}

function HoloStageDashboardInner({ onExit, initialCharacter }: { onExit?: () => void; initialCharacter?: CharacterAsset | null }) {
  const { lang, setLang, t } = useHoloLang();

  // ─── Layout persistence — must be before any useState that uses it ──────
  const LAYOUT_KEY = 'boostify_holostage_layout_v1';
  const SLOT_KEY   = 'boostify_holostage_slots_v1';
  const savedLayout = (() => { try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? 'null'); } catch { return null; } })();

  const [show, setShow] = useState<HoloShow>(() => loadStoredShow() ?? buildEmptyShow());
  const [activeTab, setActiveTab] = useState<TabId>('character');
  const NAV_TABS = NAV_TABS_DEF.map(tab => ({ ...tab, label: t(tab.labelKey as Parameters<typeof t>[0]) }));
  const [selectedCue, setSelectedCue] = useState<TimelineCue | null>(null);
  const [timelineState, setTimelineState] = useState<TimelineState>(showTimelineEngine.getState());
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(savedLayout?.sidebarCollapsed ?? true);
  const [avatarTransform, setAvatarTransform] = useState<AvatarSpaceTransform>({ x: 0, y: 0, z: 0, rotY: 0, scale: 1 });
  const [currentAnimation, setCurrentAnimation] = useState<string>('idle');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [editingName, setEditingName] = useState(false);
  // ─── Resizable panels (persisted) ──────────────────────────────────────

  const [leftPanelW,  setLeftPanelW]  = useState<number>(savedLayout?.leftPanelW  ?? 260);
  const [rightPanelW, setRightPanelW] = useState<number>(savedLayout?.rightPanelW ?? 0);
  const [viewportMaximized, setViewportMaximized] = useState(false);
  const [dragging, setDragging] = useState<'left' | 'right' | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartWRef = useRef(0);
  const prevPanelWidths = useRef<{ left: number; right: number } | null>(null);

  const [slots, setSlots] = useState<LayoutSlot[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SLOT_KEY) ?? 'null');
      if (Array.isArray(saved) && saved.length === 4) return saved as LayoutSlot[];
    } catch {}
    return [...BUILTIN_LAYOUT_PRESETS];
  });

  const persistLayout = (lw: number, rw: number, sb: boolean) => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify({ leftPanelW: lw, rightPanelW: rw, sidebarCollapsed: sb })); } catch {}
  };

  const saveSlot = (i: number) => {
    const base = BUILTIN_LAYOUT_PRESETS[i];
    const entry: LayoutSlot = { leftPanelW, rightPanelW, sidebarCollapsed, label: base?.label ?? `SLOT ${i + 1}`, icon: base?.icon };
    const next = [...slots]; next[i] = entry;
    setSlots(next);
    try { localStorage.setItem(SLOT_KEY, JSON.stringify(next)); } catch {}
  };

  const loadSlot = (i: number) => {
    const s = slots[i]; if (!s) return;
    setLeftPanelW(s.leftPanelW);
    setRightPanelW(s.rightPanelW);
    setSidebarCollapsed(s.sidebarCollapsed);
    persistLayout(s.leftPanelW, s.rightPanelW, s.sidebarCollapsed);
  };
  const rendererContainerRef = useRef<HTMLDivElement>(null);
  const rendererElementRef = useRef<HTMLDivElement>(null);

  const handleStreamingToggle = () => {
    setIsStreaming(prev => {
      const next = !prev;
      const cfg = show.holosuitConfig ?? DEFAULT_HOLOSUIT_CONFIG;
      if (next) holosuitBridge.startSimulation(cfg.fps, cfg.simulationIntensity);
      else holosuitBridge.stopSimulation();
      return next;
    });
  };

  // Drag-to-resize — no upper limit, just clamp to 0
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartXRef.current;
      if (dragging === 'left') {
        setLeftPanelW(Math.max(0, dragStartWRef.current + delta));
      } else {
        setRightPanelW(Math.max(0, dragStartWRef.current - delta));
      }
    };
    const onUp = () => {
      setDragging(null);
      persistLayout(leftPanelW, rightPanelW, sidebarCollapsed);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, leftPanelW, rightPanelW, sidebarCollapsed]);

  const toggleMaximize = () => {
    if (viewportMaximized) {
      if (prevPanelWidths.current) {
        setLeftPanelW(prevPanelWidths.current.left);
        setRightPanelW(prevPanelWidths.current.right);
        persistLayout(prevPanelWidths.current.left, prevPanelWidths.current.right, sidebarCollapsed);
      }
      setViewportMaximized(false);
    } else {
      prevPanelWidths.current = { left: leftPanelW, right: rightPanelW };
      setLeftPanelW(0);
      setRightPanelW(0);
      setViewportMaximized(true);
      persistLayout(0, 0, sidebarCollapsed);
    }
  };

  // Subscribe to timeline state changes
  useEffect(() => {
    const unsub = showTimelineEngine.onStateChanged(state => setTimelineState(state));
    return unsub;
  }, []);

  // ─── Real-time Show Orchestrator bridge (/ws/holostage) ─────────────────
  // Opens the gateway WebSocket as the operator. This publishes
  // `window.__holostageWS`, which activates the Art-Net / sACN DMX relay and
  // lets us dispatch show commands to the Stage Node + Unreal runtime.
  useEffect(() => {
    holostageGateway.connect({
      role: 'operator',
      artistId: initialCharacter?.id ?? 'preview',
      showId: show.id ?? 'live',
      label: 'HoloStage Studio',
    });
    return () => { holostageGateway.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to cue fired events — dispatch effects to renderer
  useEffect(() => {
    const unsub = showTimelineEngine.onCueFiredEvent((cue) => {
      if (cue.type === 'animation') {
        const animData = cue.data as { animationName?: string };
        if (animData.animationName) setCurrentAnimation(animData.animationName);
      } else if (cue.type === 'blackout') {
        showTimelineEngine.blackout();
      } else if (cue.type === 'fallback') {
        showTimelineEngine.fallback();
      } else if (cue.type === 'effect') {
        // Effect cues are read from activeCues in the renderer via timelineState
      }
    });
    return unsub;
  }, []);

  // Persist show to localStorage on every change
  useEffect(() => {
    saveShowToStorage(show);
  }, [show]);

  // Load show into timeline engine whenever show changes structurally
  useEffect(() => {
    showTimelineEngine.loadShow(show);
  }, [show.id, show.songs.length]); // structural changes only — cue edits use updateCues

  // ─── Show mutators ──────────────────────────────────────────────────────

  const updateShow = useCallback((partial: Partial<HoloShow>) => {
    setShow(prev => ({ ...prev, ...partial, updatedAt: new Date().toISOString() }));
  }, []);

  const setCharacter = (char: CharacterAsset | null) => updateShow({ character: char });

  // Auto-load the artist's 3D character arriving from the Hologram Showcase
  const seededCharacterRef = useRef(false);
  useEffect(() => {
    if (!initialCharacter) return;
    if (!show.character) {
      if (seededCharacterRef.current) return;
      seededCharacterRef.current = true;
      updateShow({ character: initialCharacter, artistName: initialCharacter.name || show.artistName });
    } else if (
      show.character.id === initialCharacter.id &&
      show.character.glbUrl !== initialCharacter.glbUrl
    ) {
      // The stored show has a stale copy of this artist's character (e.g. an old
      // static GLB) — refresh it with the latest rigged/animated model.
      updateShow({
        character: {
          ...show.character,
          glbUrl: initialCharacter.glbUrl,
          thumbnailUrl: initialCharacter.thumbnailUrl ?? show.character.thumbnailUrl,
          availableAnimations: initialCharacter.availableAnimations ?? [],
          format: initialCharacter.format ?? show.character.format,
        },
      });
    }
  }, [initialCharacter, show.character, show.artistName, updateShow]);

  const setSongs = (songs: ShowSong[]) => updateShow({ songs: songs.map((s, i) => ({ ...s, order: i })) });

  const setCues = (cues: TimelineCue[]) => {
    showTimelineEngine.updateCues(cues);  // keep engine in sync without resetting playback
    updateShow({ cues });
  };

  const setDmxScenes = (dmxScenes: DMXScene[]) => updateShow({ dmxScenes });

  const setHoloSuitConfig = (holosuitConfig: HoloSuitConfig) => updateShow({ holosuitConfig });

  const setOutputSettings = (outputSettings: HologramOutputSettings) => updateShow({ outputSettings });

  // ─── Transport ──────────────────────────────────────────────────────────

  const handlePlay = () => {
    if (show.songs.length === 0) return;
    showTimelineEngine.play();
    if (show.outputSettings.fullscreenOnPlay && rendererContainerRef.current) {
      hologramOutputManager.requestFullscreen(rendererContainerRef.current);
    }
  };

  const handleRequestFullscreen = () => {
    if (rendererContainerRef.current) {
      hologramOutputManager.requestFullscreen(rendererContainerRef.current);
    }
  };

  // ─── Render panels ──────────────────────────────────────────────────────

  const renderPanel = () => {
    switch (activeTab) {
      case 'character':
        return (
          <div className="space-y-4">
            <CharacterImporter
              currentCharacter={show.character}
              onImport={setCharacter}
            />
            {show.character && (
              <CharacterPreview
                character={show.character}
                onAnimationChange={(anim) => setCurrentAnimation(anim)}
                onTransformChange={(transform) =>
                  updateShow({ character: { ...show.character!, transform } })
                }
              />
            )}
          </div>
        );

      case 'repertoire':
        return (
          <RepertoireBuilder
            songs={show.songs}
            onChange={setSongs}
            cues={show.cues}
            currentSongId={timelineState.currentSongId}
            onSelectSong={(songId) => {
              const idx = show.songs.findIndex(s => s.id === songId);
              if (idx >= 0) showTimelineEngine.jumpToSong(idx);
            }}
          />
        );

      case 'timeline':
        return (
          <div className="space-y-4">
            <SongTimelineEditor
              songs={show.songs}
              cues={show.cues}
              onCuesChange={setCues}
              currentSongId={timelineState.currentSongId}
              currentPosition={timelineState.position}
              onSongSelect={(songId) => {
                const idx = show.songs.findIndex(s => s.id === songId);
                if (idx >= 0) showTimelineEngine.jumpToSong(idx);
              }}
              onCueSelect={setSelectedCue}
              onSeek={(s) => showTimelineEngine.seekTo(s)}
            />
            {selectedCue && (
              <CueEditor
                cue={selectedCue}
                dmxScenes={show.dmxScenes}
                animations={show.character?.availableAnimations}
                songs={show.songs}
                songTitle={show.songs.find(s => s.id === selectedCue.songId)?.title}
                onUpdate={(updated) => {
                  setCues(show.cues.map(c => c.id === updated.id ? updated : c));
                  setSelectedCue(updated);
                }}
                onDelete={(id) => {
                  setCues(show.cues.filter(c => c.id !== id));
                  setSelectedCue(null);
                }}
                onClose={() => setSelectedCue(null)}
              />
            )}
          </div>
        );

      case 'dmx':
        return (
          <DMXSceneBuilder
            scenes={show.dmxScenes}
            onChange={setDmxScenes}
          />
        );

      case 'holosuit':
        return (
          <HoloSuitBridgePanel
            config={show.holosuitConfig}
            onConfigChange={setHoloSuitConfig}
          />
        );

      case 'output':
        return (
          <OutputSettingsPanel
            settings={show.outputSettings}
            onChange={setOutputSettings}
            onRequestFullscreen={handleRequestFullscreen}
          />
        );

      case 'live':
        return (
          <LiveShowController
            timelineState={timelineState}
            songs={show.songs}
            onPlay={handlePlay}
            onPause={() => showTimelineEngine.pause()}
            onStop={() => showTimelineEngine.stop()}
            onNextSong={() => showTimelineEngine.nextSong()}
            onPrevSong={() => showTimelineEngine.previousSong()}
            onBlackout={() => showTimelineEngine.blackout()}
            onFallback={() => showTimelineEngine.fallback()}
            onSeek={(s) => showTimelineEngine.seekTo(s)}
          />
        );

      case 'export':
        return (
          <ShowPackageExporter
            show={show}
            onShowImported={(imported) => setShow(imported)}
            onMetadataChange={(updated) => setShow(updated)}
          />
        );

      case 'calibration':
        if (!show.characterRig) return null;
        return (
          <CharacterCalibration
            rig={show.characterRig}
            onRigChange={(rig) => updateShow({ characterRig: rig })}
          />
        );

      case 'motionsource':
        return (
          <MotionSourceSetup
            config={show.holosuitConfig}
            onConfigChange={setHoloSuitConfig}
          />
        );

      case 'workflow':
        return (
          <WorkflowPipelinePanel
            character={show.character}
            songs={show.songs}
            holosuitConfig={show.holosuitConfig}
          />
        );

      case 'vrspace':
        return (
          <AvatarSpacePositioner
            transform={avatarTransform}
            onChange={setAvatarTransform}
          />
        );

      case 'animation':
        return (
          <AnimationStudio
            character={show.character}
            artistId={show.character?.id ? String(show.character.id).replace(/^artist-/, '') : undefined}
            songs={show.songs}
            holosuitConfig={show.holosuitConfig}
            currentSongId={timelineState.currentSongId}
            currentPosition={timelineState.position}
            onAnimationChange={setCurrentAnimation}
          />
        );

      case 'capture':
        return <CaptureDevicesPanel artistId={show.character?.id ? String(show.character.id).replace(/^artist-/, '') : undefined} />;

      case 'actors':
        return <ActorManagerPanel />;

      case 'venue':
        return (
          <VenueOSDashboard
            initialVenue={show.venueData ?? undefined}
            onSendToStageOS={(venue) => {
              updateShow({
                venueData: venue,
                metadata: {
                  ...show.metadata,
                  venue: venue.venueId,
                  venueName: venue.venueName,
                  city: venue.city,
                  country: venue.country,
                },
              });
            }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: '#000000', color: '#fff', fontFamily: 'system-ui, sans-serif', cursor: dragging ? 'col-resize' : undefined, userSelect: dragging ? 'none' : undefined }}
    >
      {/* ─── Top toolbar (HoloSuit-style) ────────────────────────────────── */}
      <header
        className="flex items-center gap-3 px-3 h-10 border-b shrink-0"
        style={{ background: '#0a0a0a', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <span className="text-xs font-black tracking-widest uppercase text-orange-400">
          BOOSTIFY · HoloStage
        </span>
        <div className="w-px h-4 bg-white/10" />
        {/* Quick mode buttons — production workflow order */}
        {[
          { id: 'venue'        as TabId,  label: 'VenueOS',   icon: Building2  },
          { id: 'character'    as TabId,  label: 'Character', icon: User       },
          { id: 'actors'       as TabId,  label: 'Actors',    icon: Users      },
          { id: 'capture'      as TabId,  label: 'Capture',   icon: Camera     },
          { id: 'holosuit'     as TabId,  label: 'MoCap',     icon: Activity   },
          { id: 'motionsource' as TabId,  label: 'MoCap Pro', icon: Radio      },
          { id: 'calibration'  as TabId,  label: 'Calibrate', icon: Sliders    },
          { id: 'repertoire'   as TabId,  label: 'Songs',     icon: Music      },
          { id: 'timeline'     as TabId,  label: 'Timeline',  icon: List       },
          { id: 'animation'    as TabId,  label: 'Animation', icon: Film       },
          { id: 'dmx'          as TabId,  label: 'Lighting',  icon: Lightbulb  },
          { id: 'output'       as TabId,  label: 'Output',    icon: Monitor    },
          { id: 'vrspace'      as TabId,  label: 'VR Space',  icon: Scan       },
          { id: 'workflow'     as TabId,  label: 'Pipeline',  icon: GitBranch  },
          { id: 'live'         as TabId,  label: 'Live',      icon: PlayCircle },
          { id: 'export'       as TabId,  label: 'Export',    icon: Package    },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            title={item.label}
            className="flex items-center gap-1.5 px-2 py-1 rounded transition-all"
            style={{
              background: activeTab === item.id ? 'rgba(249,115,22,0.15)' : 'transparent',
              color: activeTab === item.id ? '#f97316' : '#4b5563',
            }}
          >
            <item.icon className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold tracking-wider hidden xl:block">{item.label}</span>
          </button>
        ))}

        <div className="flex-1" />

        {/* Show name — click to rename */}
        {editingName ? (
          <input
            autoFocus
            defaultValue={show.name}
            onBlur={e => { updateShow({ name: e.target.value.trim() || show.name }); setEditingName(false); }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditingName(false); }}
            className="text-xs text-white font-bold outline-none rounded px-2 py-0.5 w-32 hidden lg:block"
            style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.5)' }}
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            title="Click to rename show"
            className="text-xs text-gray-500 hover:text-white transition-colors hidden lg:block truncate max-w-36 px-1.5 py-0.5 rounded hover:bg-white/5"
          >
            {show.name}
          </button>
        )}

        {/* Playback state pill */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold tracking-wider"
          style={{
            background: timelineState.playbackState === 'playing'
              ? 'rgba(249,115,22,0.15)'
              : 'rgba(255,255,255,0.04)',
            color: timelineState.playbackState === 'playing' ? '#f97316' : '#4b5563',
            border: `1px solid ${timelineState.playbackState === 'playing' ? 'rgba(249,115,22,0.3)' : 'rgba(255,255,255,0.07)'}`,
          }}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${timelineState.playbackState === 'playing' ? 'bg-orange-400 animate-pulse' : 'bg-gray-700'}`}
          />
          {timelineState.playbackState.toUpperCase()}
        </div>

        {/* ─── Layout presets ─── */}
        <div className="flex items-center gap-1 border-l pl-2 mr-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <span className="text-[9px] font-bold text-gray-700 uppercase tracking-widest hidden 2xl:block mr-0.5">Layout</span>
          {([0, 1, 2, 3] as const).map(i => {
            const slot = slots[i];
            const builtin = BUILTIN_LAYOUT_PRESETS[i];
            const isActive = slot && slot.leftPanelW === leftPanelW && slot.rightPanelW === rightPanelW && slot.sidebarCollapsed === sidebarCollapsed;
            return (
              <button
                key={i}
                onClick={() => loadSlot(i)}
                onContextMenu={e => { e.preventDefault(); saveSlot(i); }}
                title={`${slot?.label ?? builtin?.label} — Click: load · Right-click: save current layout`}
                className="flex items-center gap-0.5 px-1.5 h-5 rounded text-[9px] font-black tracking-widest uppercase transition-all"
                style={{
                  background: isActive ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? '#f97316' : slot ? '#9ca3af' : '#4b5563',
                  border: `1px solid ${isActive ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.06)'}`,
                }}
              >
                {slot?.label ?? builtin?.label}
              </button>
            );
          })}
        </div>

        {/* Guide button */}
        <button
          onClick={() => setShowGuide(true)}
          title="Guía de módulos"
          className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-black transition-all hover:bg-white/10"
          style={{ color: '#6b7280', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          ?
        </button>

        {/* Language toggle */}
        <div className="flex gap-1">
          {(['en', 'es'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className="px-1.5 py-0.5 rounded text-[9px] font-black tracking-widest uppercase transition-all"
              style={{
                background: lang === l ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                color: lang === l ? '#f97316' : '#4b5563',
                border: `1px solid ${lang === l ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Exit Studio */}
        {onExit && (
          <>
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={onExit}
              title="Exit Studio"
              className="flex items-center justify-center w-6 h-6 rounded-md transition-all hover:scale-110"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </header>

      {/* ─── Guide overlay ────────────────────────────────────────────────── */}
      {showGuide && <HoloStageGuide onClose={() => setShowGuide(false)} />}

      {/* ─── Main area ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── Left icon nav ─────────────────────────────────────────────── */}
        <aside
          className="flex flex-col shrink-0 border-r overflow-hidden"
          style={{
            width: sidebarCollapsed ? 44 : 152,
            background: '#0a0a0a',
            borderColor: 'rgba(255,255,255,0.07)',
            transition: 'width 0.2s ease',
          }}
        >
          <button
            onClick={() => { const next = !sidebarCollapsed; setSidebarCollapsed(next); persistLayout(leftPanelW, rightPanelW, next); }}
            className="flex items-center justify-center h-8 text-gray-600 hover:text-gray-300 transition-colors border-b shrink-0"
            style={{ borderColor: 'rgba(255,255,255,0.07)' }}
          >
            {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>

          <nav className="flex-1 py-1 overflow-y-auto space-y-0.5">
            {NAV_TABS.map(tab => {
              const TabIcon = tab.icon as React.ComponentType<{ className?: string }>;
              return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.label}
                className="w-full flex items-center gap-2 transition-all relative"
                style={{
                  padding: sidebarCollapsed ? '8px 10px' : '7px 10px',
                  background: activeTab === tab.id ? 'rgba(249,115,22,0.1)' : 'transparent',
                  borderLeft: `2px solid ${activeTab === tab.id ? '#f97316' : 'transparent'}`,
                  color: activeTab === tab.id ? '#f97316' : '#4b5563',
                }}
              >
                <TabIcon className="w-3.5 h-3.5 shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-[11px] font-medium truncate">{tab.label}</span>
                )}
                {tab.badge && !sidebarCollapsed && (
                  <span
                    className="ml-auto text-[7px] font-black px-1 py-0 rounded shrink-0"
                    style={{ background: tab.badge === 'LIVE' ? 'rgba(239,68,68,0.2)' : 'rgba(249,115,22,0.15)', color: tab.badge === 'LIVE' ? '#ef4444' : '#f97316', letterSpacing: '0.08em' }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
              );
            })}
          </nav>

          {/* Bottom: show info */}
          {!sidebarCollapsed && (
            <div className="px-2.5 py-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <p className="text-[10px] text-white font-bold truncate">{show.name}</p>
              <p className="text-[10px] text-gray-600 truncate">{show.artistName}</p>
            </div>
          )}
        </aside>

        {/* ─── Active panel content ─────────────────────────────────────── */}
        <div
          className="shrink-0 overflow-hidden border-r flex flex-col"
          style={{
            width: leftPanelW,
            minWidth: 0,
            background: '#0a0a0a',
            borderColor: 'rgba(255,255,255,0.06)',
            transition: dragging ? 'none' : 'width 0.15s ease',
          }}
        >
          {leftPanelW > 40 && (
            <>
              {/* Panel header */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0"
                style={{ background: '#0a0a0a', borderColor: 'rgba(255,255,255,0.07)' }}
              >
                {React.createElement((NAV_TABS.find(tab => tab.id === activeTab)?.icon ?? User) as React.ComponentType<{ className?: string }>, {
                  className: 'w-3.5 h-3.5 text-orange-400',
                })}
                <h2 className="text-[11px] font-bold text-white tracking-widest uppercase flex-1 truncate">
                  {NAV_TABS.find(tab => tab.id === activeTab)?.label}
                </h2>
                <button
                  onClick={() => setLeftPanelW(0)}
                  title="Collapse panel"
                  className="p-0.5 rounded text-gray-600 hover:text-gray-300 transition-colors"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-3 overflow-y-auto flex-1">
                {renderPanel()}
              </div>
            </>
          )}
        </div>

        {/* ─── Left drag handle ─────────────────────────────────────────── */}
        <div
          className="shrink-0 flex items-center justify-center cursor-col-resize group"
          style={{ width: 8, background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)' }}
          onMouseDown={e => { setDragging('left'); dragStartXRef.current = e.clientX; dragStartWRef.current = leftPanelW; e.preventDefault(); }}
          onDoubleClick={() => setLeftPanelW(leftPanelW > 0 ? 0 : 290)}
          title="Drag to resize · Double-click to collapse"
        >
          <div className="w-0.5 h-10 rounded-full group-hover:bg-orange-400/60 transition-colors" style={{ background: 'rgba(255,255,255,0.12)' }} />
        </div>

        {/* ─── Center viewport ──────────────────────────────────────────── */}
        <div
          ref={rendererContainerRef}
          className="flex-1 flex flex-col items-center justify-center relative"
          style={{ background: '#060606', minWidth: 0, overflow: 'hidden' }}
        >
          {/* Top viewport label */}
          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-1.5 z-10"
            style={{ background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold tracking-widest text-gray-600 uppercase">
                {show.outputSettings?.outputType ?? 'Preview'}
              </span>
              {show.character && (
                <span className="text-[9px] text-orange-400/70 font-mono">
                  {show.character.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-gray-600">
              {isStreaming && (
                <span className="flex items-center gap-1 text-emerald-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  STREAMING
                </span>
              )}
              {timelineState.playbackState === 'playing' && (
                <span className="flex items-center gap-1 text-orange-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                  LIVE
                </span>
              )}
              {/* Maximize / restore viewport */}
              <button
                onClick={toggleMaximize}
                title={viewportMaximized ? 'Restore panels' : 'Maximize viewport'}
                className="p-1 rounded hover:text-white transition-colors ml-1"
                style={{ color: viewportMaximized ? '#f97316' : '#4b5563', background: viewportMaximized ? 'rgba(249,115,22,0.1)' : 'transparent' }}
              >
                {viewportMaximized ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              </button>
              {/* Restore left panel if collapsed */}
              {leftPanelW === 0 && !viewportMaximized && (
                <button
                  onClick={() => setLeftPanelW(290)}
                  title="Show panel"
                  className="p-1 rounded hover:text-white transition-colors"
                  style={{ color: '#4b5563' }}
                >
                  <PanelLeftClose className="w-3 h-3 rotate-180" />
                </button>
              )}
            </div>
          </div>

          {/* Corner bracket decorations */}
          {(['top-8 left-2', 'top-8 right-2', 'bottom-14 left-2', 'bottom-14 right-2'] as const).map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-4 h-4 pointer-events-none`} style={{ opacity: 0.25 }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="#f97316" strokeWidth={1.5}>
                {i === 0 && <polyline points="0,8 0,0 8,0" />}
                {i === 1 && <polyline points="8,0 16,0 16,8" />}
                {i === 2 && <polyline points="0,8 0,16 8,16" />}
                {i === 3 && <polyline points="8,16 16,16 16,8" />}
              </svg>
            </div>
          ))}

          {/* Renderer — no width cap, fills the viewport */}
          <div style={{ width: '100%', aspectRatio: '9/16', maxHeight: 'calc(100% - 88px)' }}>
            <HologramRenderer
              character={show.character}
              settings={show.outputSettings}
              playbackState={timelineState.playbackState}
              currentAnimation={currentAnimation}
              avatarTransform={avatarTransform}
              rendererRef={rendererElementRef}
              onAnimationsDiscovered={(names) => {
                if (!show.character || names.length === 0) return;
                const prev = show.character.availableAnimations ?? [];
                if (prev.length === names.length && prev.every((n, i) => n === names[i])) return;
                updateShow({ character: { ...show.character, availableAnimations: names } });
              }}
            />
          </div>

          {/* Song info overlay */}
          {timelineState.currentSongId && (
            <div
              className="absolute bottom-14 left-4 right-4 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="text-xs font-bold text-white truncate">
                {show.songs.find(s => s.id === timelineState.currentSongId)?.title ?? '—'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {show.songs.find(s => s.id === timelineState.currentSongId)?.artist ?? ''}
              </p>
            </div>
          )}

          {/* ─── Bottom transport bar ───────────────────────────────────── */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center gap-2 px-3 py-2 border-t"
            style={{ background: 'rgba(0,0,0,0.85)', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            {/* Record button */}
            <button
              className="flex items-center justify-center w-7 h-7 rounded-full transition-all"
              style={{ background: isStreaming ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${isStreaming ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}` }}
              title="Record"
              onClick={handleStreamingToggle}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
            </button>

            <button onClick={() => showTimelineEngine.previousSong()} className="p-1.5 rounded text-gray-500 hover:text-white transition-colors" title="Previous">
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => showTimelineEngine.stop()} className="p-1.5 rounded text-gray-500 hover:text-white transition-colors" title="Stop">
              <Square className="w-3.5 h-3.5" />
            </button>
            {timelineState.playbackState === 'playing' ? (
              <button
                onClick={() => showTimelineEngine.pause()}
                className="flex items-center justify-center w-8 h-8 rounded-full transition-all"
                style={{ background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.4)', color: '#f97316' }}
                title="Pause"
              >
                <Pause className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handlePlay}
                className="flex items-center justify-center w-8 h-8 rounded-full transition-all"
                style={{ background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.4)', color: '#f97316' }}
                title="Play"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => showTimelineEngine.nextSong()} className="p-1.5 rounded text-gray-500 hover:text-white transition-colors" title="Next">
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            {/* Timeline scrubber */}
            <div className="flex-1 mx-2">
              {show.songs.length > 0 && (() => {
                const song = show.songs.find(s => s.id === timelineState.currentSongId) ?? show.songs[0];
                const pct = song ? Math.min(1, timelineState.position / song.duration) * 100 : 0;
                return (
                  <div
                    className="relative h-1.5 rounded-full overflow-hidden cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.1)' }}
                    onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const t = (e.clientX - rect.left) / rect.width * (song?.duration ?? 0);
                      showTimelineEngine.seekTo(Math.max(0, t));
                    }}
                  >
                    <div className="h-full rounded-full transition-none" style={{ width: `${pct}%`, background: 'linear-gradient(to right, #f97316, #fb923c)' }} />
                  </div>
                );
              })()}
            </div>

            {/* Blackout button */}
            <button
              onClick={() => showTimelineEngine.blackout()}
              className="p-1.5 rounded transition-all"
              style={{
                background: timelineState.playbackState === 'blackout' ? 'rgba(239,68,68,0.15)' : 'transparent',
                color: timelineState.playbackState === 'blackout' ? '#ef4444' : '#4b5563',
              }}
              title="Blackout"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>

            {/* Fallback button */}
            <button
              onClick={() => showTimelineEngine.fallback()}
              className="p-1.5 rounded transition-all"
              style={{
                background: timelineState.playbackState === 'fallback' ? 'rgba(245,158,11,0.15)' : 'transparent',
                color: timelineState.playbackState === 'fallback' ? '#f59e0b' : '#4b5563',
              }}
              title="Fallback Animation"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ─── Right drag handle ────────────────────────────────────────── */}
        <div
          className="shrink-0 flex flex-col items-center justify-center cursor-col-resize group gap-1"
          style={{ width: 16, background: 'rgba(255,255,255,0.02)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
          onMouseDown={e => { setDragging('right'); dragStartXRef.current = e.clientX; dragStartWRef.current = rightPanelW; e.preventDefault(); }}
          onDoubleClick={() => setRightPanelW(rightPanelW > 0 ? 0 : 220)}
          title="Drag to resize · Double-click to toggle"
        >
          {rightPanelW === 0 ? (
            <button
              onClick={e => { e.stopPropagation(); setRightPanelW(220); }}
              className="flex items-center justify-center w-5 h-5 rounded transition-colors hover:bg-orange-400/20"
              style={{ color: '#4b5563' }}
              title="Open Scene Overview"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="w-0.5 h-10 rounded-full group-hover:bg-orange-400/60 transition-colors" style={{ background: 'rgba(255,255,255,0.12)' }} />
          )}
        </div>

        {/* ─── Right: Scene Overview (HoloSuit-style) ─────────────────────── */}
        <div
          className="shrink-0 overflow-hidden"
          style={{
            width: rightPanelW,
            minWidth: 0,
            transition: dragging ? 'none' : 'width 0.15s ease',
          }}
        >
          {rightPanelW > 40 && (
            <div style={{ width: '100%', height: '100%' }}>
              <SceneOverviewPanel
                character={show.character}
                songs={show.songs}
                playbackState={timelineState.playbackState}
                isStreaming={isStreaming}
                onStreamingToggle={handleStreamingToggle}
                onTabChange={(tab) => setActiveTab(tab as TabId)}
                onCollapse={() => setRightPanelW(0)}
              />
            </div>
          )}
          {rightPanelW <= 40 && rightPanelW > 0 && (
            <div className="h-full flex flex-col items-center pt-3 gap-2" style={{ width: rightPanelW }}>
              <button
                onClick={() => setRightPanelW(220)}
                title="Show Scene Overview"
                className="p-1 rounded text-gray-600 hover:text-orange-400 transition-colors"
              >
                <PanelRightClose className="w-3.5 h-3.5 rotate-180" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

