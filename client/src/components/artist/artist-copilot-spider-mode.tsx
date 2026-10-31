import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, Line, OrbitControls } from '@react-three/drei';
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

function Limb({ from, to, radius = 0.035 }: { from: Point; to: Point; radius?: number }) {
  const a = useMemo(() => new THREE.Vector3(...from), [from[0], from[1], from[2]]);
  const b = useMemo(() => new THREE.Vector3(...to), [to[0], to[1], to[2]]);
  const direction = useMemo(() => b.clone().sub(a), [a, b]);
  const rotation = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()), [direction]);
  return <mesh position={a.clone().add(b).multiplyScalar(0.5)} quaternion={rotation}><cylinderGeometry args={[radius * 0.65, radius, direction.length(), 8]} /><meshStandardMaterial color="#192b41" emissive="#084f70" emissiveIntensity={0.8} metalness={0.85} roughness={0.18} /></mesh>;
}

function Weaver({ target, moving, reduced }: { target: Point; moving: boolean; reduced: boolean }) {
  const body = useRef<THREE.Group>(null);
  const legs = useRef<Array<THREE.Group | null>>([]);
  const destination = useMemo(() => new THREE.Vector3(...target), [target[0], target[1], target[2]]);
  useFrame(({ clock }, delta) => {
    if (!body.current) return;
    const desired = destination.clone();
    if (!reduced) { desired.x += Math.sin(clock.elapsedTime * (moving ? 1.1 : 0.35)) * (moving ? 0.24 : 0.08); desired.y += Math.cos(clock.elapsedTime * (moving ? 1.4 : 0.4)) * 0.08; }
    body.current.position.lerp(desired, reduced ? 1 : 1 - Math.exp(-delta * 2.5));
    body.current.rotation.z = reduced ? 0 : Math.sin(clock.elapsedTime * 2) * (moving ? 0.08 : 0.025);
    legs.current.forEach((leg, index) => { if (leg) leg.rotation.z = reduced ? 0 : Math.sin(clock.elapsedTime * 8 + index * 1.7) * (moving ? 0.12 : 0.025); });
  });
  return (
    <group ref={body} position={target} scale={1.45}>
      <mesh position={[0, -0.22, 0.13]} scale={[0.38, 0.48, 0.3]}><icosahedronGeometry args={[1, 2]} /><meshStandardMaterial color="#152c45" emissive="#073d69" emissiveIntensity={0.6} metalness={0.9} roughness={0.18} /></mesh>
      <mesh position={[0, 0.27, 0.16]} scale={[0.27, 0.27, 0.23]}><icosahedronGeometry args={[1, 2]} /><meshStandardMaterial color="#304a66" emissive="#093a59" emissiveIntensity={0.5} metalness={0.85} roughness={0.18} /></mesh>
      <mesh position={[0, -0.24, 0.4]} scale={[0.16, 0.23, 0.035]}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#7be8ff" emissive="#00bfff" emissiveIntensity={1.5} metalness={0.5} /></mesh>
      {[-1, 1].map((side) => Array.from({ length: 4 }, (_, index) => (
        <group key={`${side}-${index}`} ref={(element) => { legs.current[(side === -1 ? 0 : 4) + index] = element; }}>
          <Limb from={[side * 0.18, 0.25 - index * 0.16, 0.02]} to={[side * (0.52 + index * 0.03), 0.52 - index * 0.18, 0.25]} radius={0.045} />
          <Limb from={[side * (0.52 + index * 0.03), 0.52 - index * 0.18, 0.25]} to={[side * (0.95 - index * 0.04), 0.62 - index * 0.25, -0.08]} radius={0.03} />
          <mesh position={[side * (0.52 + index * 0.03), 0.52 - index * 0.18, 0.25]}><sphereGeometry args={[0.055, 12, 8]} /><meshBasicMaterial color="#38d8ff" /></mesh>
        </group>
      )))}
      {[-1, 1].map((side) => <mesh key={side} position={[side * 0.11, 0.37, 0.35]}><sphereGeometry args={[0.045, 10, 8]} /><meshBasicMaterial color="#ff9b42" /></mesh>)}
    </group>
  );
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

function WebScene({ nodes, edges, onOpen, reduced, busy }: { nodes: SpiderNode[]; edges: SpiderEdge[]; onOpen: (node: SpiderNode) => void; reduced: boolean; busy: boolean }) {
  const positions = useMemo(() => new Map(nodes.map((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return [node.id, [Math.cos(angle) * 3.35, Math.sin(angle) * 2.25, Math.sin(angle * 2) * 0.8] as Point];
  })), [nodes]);
  const points = Array.from(positions.values());
  const scaffold = useMemo(() => Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2;
    return [Math.cos(angle) * 3.35, Math.sin(angle) * 2.25, Math.sin(angle * 3) * 0.5 - 0.45] as Point;
  }), []);
  const active = [...nodes].reverse().find((node) => node.status === 'working') || [...nodes].reverse().find((node) => node.status === 'done');
  const activePoint = active ? positions.get(active.id) : undefined;
  const target: Point = activePoint ? [activePoint[0] * 0.28, activePoint[1] * 0.28, activePoint[2] + 0.5] : [0, 0, 0.5];
  const center: Point = [0, 0, 0];
  return (
    <>
      <ambientLight intensity={0.8} /><pointLight position={[1, 3, 5]} intensity={45} color="#9eefff" /><pointLight position={[-4, -2, 2]} intensity={25} color="#895cff" /><pointLight position={[3, -2, 3]} intensity={16} color="#ff8b38" />
      {[0.25, 0.5, 0.75, 1].map((scale) => <Line key={scale} points={[...scaffold, scaffold[0]].map(([x, y, z]) => [x * scale, y * scale, z * scale] as Point)} color="#4fdcff" transparent opacity={0.6} lineWidth={1.5} />)}
      {scaffold.map((point, index) => <Line key={`scaffold-${index}`} points={[center, point]} color={index % 2 ? '#8c65ff' : '#40dfff'} transparent opacity={0.48} lineWidth={1.2} />)}
      {points.map((point, index) => <Line key={`base-${nodes[index].id}`} points={[center, point]} color="#568bff" transparent opacity={0.38} lineWidth={1} />)}
      {edges.map((edge, index) => { const from = edge.from === 'goal' ? center : positions.get(edge.from); const to = positions.get(edge.to); return from && to ? <WeavingThread key={`${edge.from}-${edge.to}-${index}`} from={from} to={to} color="#7cffff" reduced={reduced} /> : null; })}
      <mesh position={[0, 0, -0.15]}><sphereGeometry args={[0.13, 16, 16]} /><meshBasicMaterial color="#6af4ff" /></mesh>
      {nodes.map((node) => {
        const point = positions.get(node.id)!;
        const color = node.status === 'error' ? '#f87171' : node.status === 'working' ? '#fff1d0' : node.status === 'done' ? '#ffae69' : '#72deff';
        return <group key={node.id} position={point}>
          <mesh><sphereGeometry args={[node.status === 'working' ? 0.13 : 0.09, 16, 16]} /><meshBasicMaterial color={color} /></mesh>
          <mesh><sphereGeometry args={[0.19, 16, 16]} /><meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} /></mesh>
          <Html position={[0, 0.28, 0]} center distanceFactor={10}>
            <button type="button" disabled={busy} onClick={() => onOpen(node)} className={`max-w-[135px] rounded-lg border px-2 py-1 text-center text-[10px] font-medium leading-tight shadow-lg backdrop-blur disabled:cursor-wait ${node.status === 'working' ? 'border-orange-300/60 bg-orange-300/20 text-orange-100' : node.status === 'error' ? 'border-red-400/50 bg-red-950/80 text-red-200' : 'border-white/15 bg-[#17111e]/90 text-white/85 hover:border-orange-300/50'}`} title={`Open ${node.name}`}>{node.name}</button>
          </Html>
        </group>;
      })}
      <Weaver target={target} moving={nodes.some((node) => node.status === 'working')} reduced={reduced} />
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
          <section className="relative isolate min-h-0 overflow-hidden border-b border-white/10 bg-[radial-gradient(ellipse_at_50%_45%,#12314b_0%,#10142b_42%,#060b15_78%)] lg:border-b-0 lg:border-r" aria-label="Live module web">
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
