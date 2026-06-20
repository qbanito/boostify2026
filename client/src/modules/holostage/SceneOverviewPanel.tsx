// ─── SceneOverviewPanel ───────────────────────────────────────────────────────
// HoloSuit-style right sidebar: live scene hierarchy, smartsuit info,
// actor selector, Live Stream toggle, quick-add objects.
// Modeled after: HoloSuit Studio 1.7 Scene Overview right panel.

import React, { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronRight, Eye, EyeOff, Lock, User, Music,
  Radio, Cpu, Activity, Wifi, WifiOff, Plus, Zap, Square,
  Video, VideoOff, Monitor, Package, TriangleAlert, Battery,
  Signal, Circle, CheckCircle2, PanelRightClose,
} from 'lucide-react';
import { holosuitBridge } from '../../services/holostage/holosuitBridge';
import type {
  HoloSuitActorInfo, HoloSuitSensorStatus, HoloSuitNotification,
} from '../../schemas/holostage/motionSource.schema';
import type { CharacterAsset } from '../../schemas/holostage/character.schema';
import type { ShowSong } from '../../schemas/holostage/showPackage.schema';
import type { PlaybackState } from '../../services/holostage/showTimelineEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SceneOverviewPanelProps {
  character: CharacterAsset | null;
  songs: ShowSong[];
  playbackState: PlaybackState;
  isStreaming: boolean;
  onStreamingToggle: () => void;
  onTabChange: (tab: string) => void;
  onCollapse?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function minBattery(sensors: HoloSuitSensorStatus[]): number | null {
  if (!sensors.length) return null;
  return Math.min(...sensors.map(s => s.batteryPercent));
}

function avgSignal(sensors: HoloSuitSensorStatus[]): number | null {
  if (!sensors.length) return null;
  return sensors.reduce((sum, s) => sum + s.signalStrength, 0) / sensors.length;
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({
  label, open, onToggle,
}: { label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-1.5 px-3 py-2 text-left transition-colors hover:bg-white/5"
    >
      {open
        ? <ChevronDown className="w-3 h-3 text-gray-500 shrink-0" />
        : <ChevronRight className="w-3 h-3 text-gray-500 shrink-0" />
      }
      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-gray-400">
        {label}
      </span>
    </button>
  );
}

// ─── SceneObjectRow ───────────────────────────────────────────────────────────

function SceneObjectRow({
  label, icon: Icon, color = '#6b7280', indent = 0,
  active = false, connected = true, badge, onClick,
}: {
  label: string;
  icon?: React.ElementType;
  color?: string;
  indent?: number;
  active?: boolean;
  connected?: boolean;
  badge?: string;
  onClick?: () => void;
}) {
  const [visible, setVisible] = useState(true);

  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-1.5 px-2 py-1 rounded transition-all cursor-pointer"
      style={{
        paddingLeft: 8 + indent * 14,
        background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
      }}
    >
      {indent > 0 && (
        <div
          className="shrink-0"
          style={{
            width: 1, height: 14, marginRight: 2,
            background: 'rgba(255,255,255,0.1)',
            marginLeft: -6,
          }}
        />
      )}
      {Icon && <Icon className="w-3 h-3 shrink-0" style={{ color: active ? color : '#4b5563' }} />}
      <span
        className="flex-1 text-xs truncate"
        style={{ color: active ? '#f0f0f0' : '#6b7280', fontSize: 11 }}
      >
        {label}
      </span>
      {badge && (
        <span
          className="text-[8px] font-bold px-1 rounded shrink-0"
          style={{ background: color + '22', color }}
        >
          {badge}
        </span>
      )}
      {/* Connection dot */}
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: !connected ? '#ef444480' : active ? color : '#374151' }}
      />
      {/* Eye visibility toggle (shows on hover) */}
      <button
        onClick={e => { e.stopPropagation(); setVisible(v => !v); }}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {visible
          ? <Eye className="w-3 h-3 text-gray-600" />
          : <EyeOff className="w-3 h-3 text-gray-600" />
        }
      </button>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SceneOverviewPanel({
  character, songs, playbackState, isStreaming,
  onStreamingToggle, onTabChange, onCollapse,
}: SceneOverviewPanelProps) {
  const [sceneOpen,    setSceneOpen]    = useState(true);
  const [addOpen,      setAddOpen]      = useState(false);
  const [suitOpen,     setSuitOpen]     = useState(true);
  const [actors,       setActors]       = useState<HoloSuitActorInfo[]>([]);
  const [sensors,      setSensors]      = useState<HoloSuitSensorStatus[]>([]);
  const [selectedActor,setSelectedActor]= useState<string | null>(null);
  const [notifications,setNotifications]= useState<HoloSuitNotification[]>([]);
  const [notifExpanded,setNotifExpanded]= useState(false);

  // Poll bridge data at 1Hz — no heavy re-renders
  useEffect(() => {
    const id = setInterval(() => {
      setActors(holosuitBridge.getActors());
      setSensors(holosuitBridge.getSensorStatuses());
      setSelectedActor(holosuitBridge.getSelectedActorName());
      setNotifications(holosuitBridge.getNotifications().filter(n => !n.dismissed).slice(0, 5));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const battery   = minBattery(sensors);
  const signal    = avgSignal(sensors);
  const isLive    = actors.some(a => a.isActive);
  const suitReady = sensors.length > 0;

  // ─── Notification count badge ──────────────────────────────────────────────
  const criticalCount = notifications.filter(n =>
    n.type === 'battery_critical' || n.type === 'sensor_lost',
  ).length;

  return (
    <aside
      className="flex flex-col h-full overflow-hidden border-l"
      style={{
        width: '100%',
        background: '#0d0d0d',
        borderColor: 'rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}
    >
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-3 py-2.5 border-b shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-gray-300">
          Scene overview
        </span>
        <div className="flex items-center gap-1">
          {criticalCount > 0 && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <TriangleAlert className="w-2.5 h-2.5 text-red-400" />
              <span className="text-[9px] font-bold text-red-400">{criticalCount}</span>
            </div>
          )}
          {onCollapse && (
            <button
              onClick={onCollapse}
              title="Collapse Scene Overview"
              className="p-0.5 rounded text-gray-600 hover:text-gray-300 transition-colors"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ─── Live Stream On/Off ───────────────────────────────────────── */}
        <div className="px-3 pt-3 pb-2">
          <button
            onClick={onStreamingToggle}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all"
            style={
              isStreaming
                ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.35)' }
                : { background: 'rgba(255,255,255,0.04)', color: '#4b5563', border: '1px solid rgba(255,255,255,0.08)' }
            }
          >
            {isStreaming
              ? <><Radio className="w-3.5 h-3.5 animate-pulse" /> Live Stream On</>
              : <><RadioOff className="w-3.5 h-3.5" /> Live Stream Off</>
            }
          </button>
        </div>

        {/* ─── Notifications strip ──────────────────────────────────────── */}
        {notifications.length > 0 && (
          <div className="mx-3 mb-2">
            <button
              onClick={() => setNotifExpanded(e => !e)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <TriangleAlert className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="flex-1 text-amber-300 text-left" style={{ fontSize: 10 }}>
                {notifications[0].message.substring(0, 34)}{notifications[0].message.length > 34 ? '…' : ''}
              </span>
              {notifExpanded
                ? <ChevronDown className="w-3 h-3 text-amber-400 shrink-0" />
                : <ChevronRight className="w-3 h-3 text-amber-400 shrink-0" />
              }
            </button>
            {notifExpanded && (
              <div className="mt-1 space-y-0.5">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className="px-2 py-1 rounded text-[10px] text-amber-300/70"
                    style={{ background: 'rgba(245,158,11,0.05)' }}
                  >
                    {n.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Live Scene Objects ───────────────────────────────────────── */}
        <SectionHeader label="Live scene objects" open={sceneOpen} onToggle={() => setSceneOpen(o => !o)} />

        {sceneOpen && (
          <div className="pb-1">
            {/* Character root */}
            {character ? (
              <>
                <SceneObjectRow
                  label={character.name}
                  icon={User}
                  color="#f97316"
                  active
                  badge="CHAR"
                  onClick={() => onTabChange('character')}
                />
                {/* Body actor */}
                {actors.filter(a => a.hasBody).map(actor => (
                  <SceneObjectRow
                    key={actor.actorName}
                    label={actor.actorName}
                    icon={Activity}
                    color="#6366f1"
                    indent={1}
                    active={selectedActor === actor.actorName}
                    connected={actor.isActive}
                    badge="BODY"
                    onClick={() => {
                      holosuitBridge.selectActor(actor.actorName);
                      setSelectedActor(actor.actorName);
                    }}
                  />
                ))}
                {/* Face actor */}
                {actors.filter(a => a.hasFace).map(actor => (
                  <SceneObjectRow
                    key={`face-${actor.actorName}`}
                    label={`${actor.actorName} (face)`}
                    icon={Cpu}
                    color="#3b82f6"
                    indent={1}
                    connected={actor.isActive}
                    badge="FACE"
                    onClick={() => onTabChange('holosuit')}
                  />
                ))}
                {/* Gloves actors */}
                {actors.filter(a => a.hasHands).slice(0, 1).map(actor => (
                  <SceneObjectRow
                    key={`hands-${actor.actorName}`}
                    label={`${actor.actorName} (gloves)`}
                    icon={Zap}
                    color="#a855f7"
                    indent={1}
                    connected={actor.isActive}
                    badge="HANDS"
                    onClick={() => onTabChange('holosuit')}
                  />
                ))}
              </>
            ) : (
              <div className="px-4 py-2">
                <button
                  onClick={() => onTabChange('character')}
                  className="w-full flex items-center gap-2 py-1.5 text-xs rounded-lg transition-all"
                  style={{ color: '#4b5563' }}
                >
                  <Plus className="w-3 h-3 shrink-0" />
                  Add character…
                </button>
              </div>
            )}

            {/* Songs */}
            {songs.slice(0, 4).map((song, i) => (
              <SceneObjectRow
                key={song.id}
                label={`${i + 1}. ${song.title}`}
                icon={Music}
                color="#22c55e"
                indent={character ? 0 : 0}
                badge={i === 0 && playbackState === 'playing' ? '▶' : undefined}
                onClick={() => onTabChange('repertoire')}
              />
            ))}
            {songs.length > 4 && (
              <div className="px-4 py-1">
                <span className="text-[10px] text-gray-600">+{songs.length - 4} more songs</span>
              </div>
            )}
          </div>
        )}

        {/* ─── Add Objects ─────────────────────────────────────────────── */}
        <SectionHeader label="Add objects" open={addOpen} onToggle={() => setAddOpen(o => !o)} />

        {addOpen && (
          <div className="px-3 pb-3">
            <div className="flex gap-2 pt-1">
              {[
                { label: 'Avatar', icon: User,  color: '#f97316', tab: 'character' },
                { label: 'Song',   icon: Music,  color: '#22c55e', tab: 'repertoire' },
                { label: 'Light',  icon: Zap,    color: '#f59e0b', tab: 'dmx' },
                { label: 'Export', icon: Package, color: '#6b7280', tab: 'export' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => onTabChange(item.tab)}
                  className="flex flex-col items-center gap-1 flex-1 py-2 rounded-lg transition-all hover:bg-white/5"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: item.color + '20' }}
                  >
                    <item.icon className="w-3 h-3" style={{ color: item.color }} />
                  </div>
                  <span className="text-[9px] text-gray-600">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── HoloSuit Info ───────────────────────────────────────────── */}
        <SectionHeader label="HoloSuit info" open={suitOpen} onToggle={() => setSuitOpen(o => !o)} />

        {suitOpen && (
          <div className="px-3 pb-3 space-y-2">
            {!suitReady ? (
              <>
                <p className="text-[11px] text-gray-600 py-1">No available HoloSuit Pro</p>
                <button
                  onClick={() => onTabChange('holosuit')}
                  className="w-full py-1.5 text-xs font-bold tracking-widest uppercase rounded-lg transition-all"
                  style={{
                    background: 'rgba(99,102,241,0.1)',
                    color: '#818cf8',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }}
                >
                  Start Streaming
                </button>
              </>
            ) : (
              <>
                {/* Actor / suit name */}
                {actors.slice(0, 2).map(actor => (
                  <div
                    key={actor.actorName}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{
                      background: selectedActor === actor.actorName
                        ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selectedActor === actor.actorName ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0 animate-pulse"
                      style={{ background: actor.isActive ? '#22c55e' : '#374151' }}
                    />
                    <span className="flex-1 text-xs font-mono text-gray-300">{actor.actorName}</span>
                    <span className="text-[9px] font-bold text-gray-600">{actor.frameRate}fps</span>
                  </div>
                ))}

                {/* Battery summary */}
                {battery !== null && (
                  <div className="flex items-center gap-2">
                    <Battery
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: battery < 15 ? '#ef4444' : battery < 30 ? '#f59e0b' : '#22c55e' }}
                    />
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${battery}%`,
                          background: battery < 15 ? '#ef4444' : battery < 30 ? '#f59e0b' : '#22c55e',
                        }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-mono shrink-0 w-8 text-right"
                      style={{ color: battery < 30 ? '#f59e0b' : '#6b7280' }}
                    >
                      {battery.toFixed(0)}%
                    </span>
                  </div>
                )}

                {/* Signal summary */}
                {signal !== null && (
                  <div className="flex items-center gap-2">
                    <Signal
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: signal < 25 ? '#ef4444' : signal < 50 ? '#f59e0b' : '#22c55e' }}
                    />
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${signal}%`,
                          background: signal < 25 ? '#ef4444' : signal < 50 ? '#f59e0b' : '#6366f1',
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-gray-600 shrink-0 w-8 text-right">
                      {signal.toFixed(0)}%
                    </span>
                  </div>
                )}

                {/* Sensor count */}
                <div className="flex items-center gap-2 text-[10px] text-gray-600">
                  <Cpu className="w-3 h-3 shrink-0" />
                  <span>{sensors.filter(s => s.connected).length} / {sensors.length} sensors connected</span>
                </div>

                <button
                  onClick={() => onTabChange('holosuit')}
                  className="w-full py-1.5 text-xs font-bold tracking-widest uppercase rounded-lg transition-all"
                  style={{
                    background: 'rgba(99,102,241,0.1)',
                    color: '#818cf8',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }}
                >
                  Open Bridge Panel
                </button>
              </>
            )}
          </div>
        )}

        {/* ─── Virtual Production ───────────────────────────────────────── */}
        <SectionHeader label="Virtual Production" open={false} onToggle={() => onTabChange('output')} />

        {/* ─── Exporter ────────────────────────────────────────────────── */}
        <div className="px-3 py-2 mt-auto">
          <button
            onClick={() => onTabChange('export')}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#6b7280', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Package className="w-3.5 h-3.5" />
            Exporter
          </button>
        </div>
      </div>
    </aside>
  );
}

// Inline icon since lucide doesn't have RadioOff
function RadioOff({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2l20 20" />
      <path d="M8.56 2.9A7 7 0 0 1 19.07 14" />
      <path d="M10.91 5.25A7 7 0 0 1 21 12c0 1.5-.5 3-1.3 4.2" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
