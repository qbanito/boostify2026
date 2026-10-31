import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls, useTexture } from '@react-three/drei';
import { ArrowUpRight, Loader2, Send, Sparkles, X } from 'lucide-react';
import * as THREE from 'three';

export type SpiderNode = { id: string; name: string; surface: 'section' | 'widget' | 'profile'; status: 'visible' | 'working' | 'done' | 'error' };
export type SpiderEdge = { from: string; to: string };
type Message = { role: 'user' | 'assistant'; content: string };
type Point = [number, number, number];

class SceneBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="grid h-full place-items-center px-8 text-center text-sm text-white/45">The 3D view is unavailable on this device. Your live module list remains available.</div> : this.props.children;
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

function Weaver({ target, moving, reduced }: { target: Point; moving: boolean; reduced: boolean }) {
  const body = useRef<THREE.Group>(null);
  const texture = useTexture('/assets/spider-mode/chrome-spider.webp');
  const destination = useMemo(() => new THREE.Vector3(...target), [target[0], target[1], target[2]]);
  useFrame(({ clock }, delta) => {
    if (!body.current) return;
    const desired = destination.clone();
    if (!reduced) {
      desired.x += Math.sin(clock.elapsedTime * (moving ? 1.3 : 0.45)) * (moving ? 0.24 : 0.07);
      desired.y += Math.cos(clock.elapsedTime * (moving ? 1.5 : 0.5)) * 0.08;
    }
    body.current.position.lerp(desired, reduced ? 1 : 1 - Math.exp(-delta * 2));
    body.current.rotation.z = reduced ? 0 : Math.sin(clock.elapsedTime * 1.8) * (moving ? 0.07 : 0.025);
  });
  return <group ref={body} position={target}>
    <mesh position={[0, 0, -0.08]} scale={[1.15, 1.15, 1]}><circleGeometry args={[1, 48]} /><meshBasicMaterial color="#2acbff" transparent opacity={0.08} depthWrite={false} /></mesh>
    <mesh><planeGeometry args={[1.9, 1.9]} /><meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} /></mesh>
  </group>;
}

function WeavingThread({ from, to, color, reduced }: { from: Point; to: Point; color: string; reduced: boolean }) {
  const spark = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const value = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...from)]);
    return value;
  }, [from[0], from[1], from[2], to[0], to[1], to[2]]);
  const line = useMemo(() => new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 })), [geometry, color]);
  const progress = useRef(reduced ? 1 : 0);
  useEffect(() => { progress.current = reduced ? 1 : 0; return () => { geometry.dispose(); line.material.dispose(); }; }, [geometry, line, reduced]);
  useFrame((state, delta) => {
    progress.current = Math.min(1, progress.current + delta * 1.25);
    const t = progress.current;
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.setXYZ(1, from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t);
    attr.needsUpdate = true;
    if (spark.current) {
      const pulse = reduced ? 1 : (state.clock.elapsedTime * 0.3) % 1;
      spark.current.position.set(from[0] + (to[0] - from[0]) * pulse, from[1] + (to[1] - from[1]) * pulse, from[2] + (to[2] - from[2]) * pulse);
    }
  });
  return <><primitive object={line} /><mesh ref={spark} position={from}><sphereGeometry args={[0.055, 12, 8]} /><meshBasicMaterial color="#dcffff" /></mesh></>;
}

function SignalLights({ reduced }: { reduced: boolean }) {
  const group = useRef<THREE.Group>(null);
  const points = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const angle = i * 2.39996;
    const radius = 0.6 + (i % 7) * 0.52;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.65, -0.4 + (i % 5) * 0.2] as Point;
  }), []);
  useFrame(({ clock }) => { if (group.current && !reduced) group.current.rotation.z = Math.sin(clock.elapsedTime * 0.13) * 0.04; });
  return <group ref={group}>{points.map((point, i) => <group key={i} position={point}><mesh><sphereGeometry args={[0.025 + (i % 3) * 0.008, 8, 8]} /><meshBasicMaterial color={i % 3 === 0 ? '#b7a4ff' : '#9ffaff'} /></mesh><mesh><sphereGeometry args={[0.08, 8, 8]} /><meshBasicMaterial color={i % 3 === 0 ? '#9268ff' : '#3fdcff'} transparent opacity={0.16} depthWrite={false} /></mesh></group>)}</group>;
}

function NeonWeb({ scaffold, reduced }: { scaffold: Point[]; reduced: boolean }) {
  const web = useRef<THREE.Group>(null);
  const rings = useMemo(() => [0.18, 0.31, 0.44, 0.57, 0.70, 0.84, 1].map((scale) => {
    const points: Point[] = [];
    for (let i = 0; i < scaffold.length; i++) {
      const a = scaffold[i];
      const b = scaffold[(i + 1) % scaffold.length];
      for (let step = 0; step < 6; step++) {
        const t = step / 6;
        const dip = 1 - 0.055 * Math.sin(Math.PI * t);
        points.push([(a[0] * (1 - t) + b[0] * t) * scale * dip, (a[1] * (1 - t) + b[1] * t) * scale * dip, (a[2] * (1 - t) + b[2] * t) * scale - Math.sin(Math.PI * t) * 0.08]);
      }
    }
    return [...points, points[0]];
  }), [scaffold]);
  useFrame(({ clock }) => {
    if (!web.current || reduced) return;
    web.current.children.forEach((child, index) => {
      const material = (child as THREE.Line).material as THREE.Material | undefined;
      if (material) material.opacity = (index % 2 ? 0.025 : 0.18) + (index % 2 ? 0.035 : 0.14) * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 0.65 + index * 0.55));
    });
  });
  const center: Point = [0, 0, 0];
  return <group ref={web}>
    {rings.flatMap((points, index) => {
      return [<Line key={`${index}-core`} points={points} color="#9bc5ff" transparent opacity={0.25} lineWidth={0.75} />, <Line key={`${index}-glow`} points={points} color="#517bd5" transparent opacity={0.04} lineWidth={3} blending={THREE.AdditiveBlending} depthWrite={false} />];
    })}
    {scaffold.flatMap((point, index) => [<Line key={`${index}-core`} points={[center, point]} color={index % 2 ? '#a596db' : '#8fbfff'} transparent opacity={0.25} lineWidth={0.75} />, <Line key={`${index}-glow`} points={[center, point]} color={index % 2 ? '#7254ac' : '#4f80bf'} transparent opacity={0.04} lineWidth={3} blending={THREE.AdditiveBlending} depthWrite={false} />])}
  </group>;
}

function WebScene({ nodes, edges, onOpen, reduced, busy }: { nodes: SpiderNode[]; edges: SpiderEdge[]; onOpen: (node: SpiderNode) => void; reduced: boolean; busy: boolean }) {
  const displayed = useMemo(() => {
    const active = nodes.filter((node) => node.status !== 'visible');
    return [...active, ...nodes.filter((node) => node.status === 'visible')].slice(0, 8);
  }, [nodes]);
  const positions = useMemo(() => new Map(displayed.map((node, index) => {
    const angle = (index / Math.max(displayed.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return [node.id, [Math.cos(angle) * 2.9, Math.sin(angle) * 1.85, Math.sin(angle * 2) * 0.45] as Point];
  })), [displayed]);
  const points = Array.from(positions.values());
  const scaffold = useMemo(() => Array.from({ length: 16 }, (_, index) => {
    const angle = (index / 16) * Math.PI * 2;
    return [Math.cos(angle) * 3.35, Math.sin(angle) * 2.25, Math.sin(angle * 3) * 0.5 - 0.45] as Point;
  }), []);
  const center: Point = [0, 0, 0];
  const active = [...displayed].reverse().find((node) => node.status === 'working');
  const activePoint = active ? positions.get(active.id) : undefined;
  const target: Point = activePoint ? [activePoint[0] * 0.55, activePoint[1] * 0.55, 0.6] : [0, 0, 0.6];
  return (
    <>
      <ambientLight intensity={0.8} /><pointLight position={[1, 3, 5]} intensity={45} color="#9eefff" /><pointLight position={[-4, -2, 2]} intensity={25} color="#895cff" /><pointLight position={[3, -2, 3]} intensity={16} color="#ff8b38" />
      <NeonWeb scaffold={scaffold} reduced={reduced} />
      {points.map((point, index) => <Line key={`base-${displayed[index].id}`} points={[center, point]} color="#568bff" transparent opacity={0.3} lineWidth={1} />)}
      {edges.map((edge, index) => { const from = edge.from === 'goal' ? center : positions.get(edge.from); const to = positions.get(edge.to); return from && to ? <WeavingThread key={`${edge.from}-${edge.to}-${index}`} from={from} to={to} color="#7cffff" reduced={reduced} /> : null; })}
      <mesh position={[0, 0, -0.15]}><sphereGeometry args={[0.13, 16, 16]} /><meshBasicMaterial color="#6af4ff" /></mesh>
      {displayed.map((node) => {
        const point = positions.get(node.id)!;
        const color = node.status === 'error' ? '#f87171' : node.status === 'working' ? '#fff1d0' : node.status === 'done' ? '#ffae69' : '#72deff';
        return <group key={node.id} position={point}>
          <mesh><sphereGeometry args={[node.status === 'working' ? 0.16 : 0.12, 20, 16]} /><meshBasicMaterial color={color} /></mesh>
          <mesh><sphereGeometry args={[0.26, 20, 16]} /><meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} /></mesh>
          <Html position={[0, 0.34, 0]} center distanceFactor={6}>
            <button type="button" disabled={busy} onClick={() => onOpen(node)} className={`min-w-[105px] max-w-[155px] rounded-xl border px-3 py-2 text-center text-[12px] font-semibold leading-tight shadow-[0_0_20px_rgba(59,188,255,0.18)] backdrop-blur-md disabled:cursor-wait ${node.status === 'working' ? 'border-orange-300/70 bg-[#422215]/95 text-orange-100' : node.status === 'error' ? 'border-red-400/60 bg-red-950/95 text-red-100' : 'border-cyan-200/40 bg-[#071322]/95 text-white hover:border-cyan-200/80'}`} title={`Open ${node.name}`}>{node.name}</button>
          </Html>
        </group>;
      })}
      <SignalLights reduced={reduced} />
      <Weaver target={target} moving={Boolean(active)} reduced={reduced} />
      <OrbitControls enablePan={false} enableDamping={!reduced} minDistance={6} maxDistance={12} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI * 2 / 3} />
    </>
  );
}

export default function ArtistCopilotSpiderMode({ artistName, nodes, edges, goal, messages, activity, busy, error, draft, setDraft, onSend, onStop, onClose, onOpenNode }: {
  artistName: string; nodes: SpiderNode[]; edges: SpiderEdge[]; goal: string; messages: Message[]; activity: string[];
  busy: boolean; error: string; draft: string; setDraft: (value: string) => void; onSend: () => void; onStop: () => void; onClose: () => void; onOpenNode: (node: SpiderNode) => void;
}) {
  const reduced = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const closeHandler = useRef(onClose);
  closeHandler.current = onClose;
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeHandler.current(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.getClientRects().length > 0);
      if (!controls.length) { event.preventDefault(); dialogRef.current.focus(); return; }
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus(); };
  }, []);
  useEffect(() => {
    if (conversationRef.current) conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
  }, [messages, activity, busy]);
  return (
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Artist Copilot Spider Mode" data-profile-copilot-chat className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/85 p-2 text-white backdrop-blur-md sm:p-6">
      <div className="flex h-[min(900px,calc(100dvh-1rem))] w-full max-w-[1480px] flex-col overflow-hidden rounded-2xl border border-orange-200/15 bg-[#0d0a11] shadow-[0_30px_120px_#000] sm:h-[min(900px,calc(100dvh-3rem))] sm:rounded-3xl">
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-orange-300/25 bg-orange-400/10 text-orange-300"><Sparkles className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1"><p className="truncate whitespace-nowrap text-[10px] font-semibold uppercase tracking-[.18em] text-orange-300/70">Boostify · Artist Copilot</p><h2 className="truncate text-lg font-semibold tracking-tight">Spider Mode <span className="font-normal text-white/40">/ {artistName}</span></h2></div>
          <button ref={closeRef} type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs text-white/70 hover:bg-white/10"><span className="hidden sm:inline">View profile</span><X className="h-4 w-4" /><span className="sr-only">Close Spider Mode</span></button>
        </header>
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(210px,52%)_minmax(0,1fr)] overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-1">
          <section className="relative isolate min-h-0 overflow-hidden border-b border-white/10 bg-[#050b17] lg:border-b-0 lg:border-r" aria-label="Live module web">
            <style>{`@keyframes spider-scene-drift { 0%,100% { transform: scale(1.06) translate3d(0,0,0); } 50% { transform: scale(1.11) translate3d(-1%,0.6%,0); } } @keyframes spider-scene-glow { 0%,100% { opacity:.25; } 50% { opacity:.48; } }`}</style>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-cover bg-center motion-safe:animate-[spider-scene-drift_24s_ease-in-out_infinite]" style={{ backgroundImage: "url('/assets/spider-mode/neon-web-background.webp')" }} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#040914]/65 via-transparent to-[#040914]/80" />
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_65%,rgba(45,179,255,.32),transparent_55%)] motion-safe:animate-[spider-scene-glow_5s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute left-4 top-3 z-10 sm:left-5 sm:top-5"><p className="text-[10px] font-semibold uppercase tracking-[.25em] text-orange-200/55">Live workspace</p><p className="mt-1 max-w-[240px] truncate text-sm text-white/75">{goal || 'Your artist profile'}</p></div>
            <div className="absolute inset-x-2 bottom-9 top-12 sm:bottom-12 sm:top-14"><SceneBoundary><Canvas camera={{ position: [0, 0, 8], fov: 38 }} dpr={[1, 1.5]} gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }} frameloop={reduced ? 'demand' : 'always'} fallback={<div className="grid h-full place-items-center px-8 text-center text-sm text-white/50">3D is unavailable. Use the module list to navigate.</div>}><WebScene nodes={nodes} edges={edges} onOpen={onOpenNode} reduced={reduced} busy={busy} /></Canvas></SceneBoundary></div>
            <div className="pointer-events-none absolute bottom-2 left-4 right-4 z-10 flex items-end justify-between gap-4"><p className="max-w-[210px] text-[10px] leading-4 text-white/65 sm:max-w-[300px] sm:text-[11px]"><span className="sm:hidden">Drag to explore. Select a module.</span><span className="hidden sm:inline">Drag to orbit, scroll to zoom. Threads follow real Copilot actions.</span></p><span className="whitespace-nowrap rounded-full border border-cyan-300/20 bg-black/30 px-2 py-1 text-[10px] text-cyan-100/70">{nodes.length} modules</span></div>
          </section>
          <aside aria-label="Your working web and Copilot conversation" className="flex min-h-0 flex-col bg-[#0c1420]">
            <div className="hidden shrink-0 border-b border-white/10 px-4 py-3 sm:block"><p className="text-xs font-semibold text-white/85">Your working web</p><p className="mt-1 text-[11px] text-white/40">Visible modules and the steps in this task</p></div>
            <div className="shrink-0 overflow-x-auto border-b border-white/10 px-4 py-2"><div className="flex min-w-max gap-1.5">{nodes.length ? nodes.map((node) => <button key={node.id} type="button" disabled={busy} onClick={() => onOpenNode(node)} className={`min-h-11 rounded-xl border px-3 text-[10px] disabled:cursor-wait ${node.status === 'error' ? 'border-red-400/30 text-red-300' : node.status === 'working' ? 'border-orange-300/50 text-orange-200' : 'border-white/10 text-white/55 hover:text-white'}`}>{node.name}</button>) : <span className="py-2 text-xs text-white/35">Ask for a goal to begin.</span>}</div></div>
            <div ref={conversationRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-2 sm:py-3" aria-live="polite">
              {messages.slice(-4).map((message, index) => <div key={`${message.role}-${index}`} className={`rounded-xl px-3 py-2 text-xs leading-5 ${message.role === 'user' ? 'ml-6 bg-orange-300/10 text-orange-50/90' : 'mr-3 bg-white/[0.04] text-white/70'}`}>{message.content}</div>)}
              {activity.length > 0 && <div className="space-y-1 border-l border-orange-300/30 pl-3 text-[11px] leading-5 text-white/50">{activity.slice(-4).map((step, index) => <p key={`${index}-${step}`}>{step}</p>)}</div>}
              {error && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}
            </div>
            <form onSubmit={(event) => { event.preventDefault(); onSend(); }} className="shrink-0 border-t border-white/10 p-2 sm:p-3">
              <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-black/30 p-2 focus-within:border-orange-300/40"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); } }} maxLength={5000} rows={2} disabled={busy} placeholder="What would you like to achieve?" className="min-h-[44px] flex-1 resize-none bg-transparent px-1 py-1 text-sm text-white outline-none placeholder:text-white/25" /><button type="submit" disabled={busy || !draft.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-orange-300 text-black disabled:opacity-40" aria-label="Send to Copilot">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button></div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-white/35"><span>{busy ? 'Working on your request' : 'Ready for your next goal'}</span>{busy && <button type="button" onClick={onStop} className="flex min-h-8 items-center gap-1 text-white/55 hover:text-white">Stop task <ArrowUpRight className="h-3 w-3" /></button>}</div>
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}
