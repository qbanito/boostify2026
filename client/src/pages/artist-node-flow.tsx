/**
 * BOOSTIFY ARTIST NODE FLOW â€” Main Page
 * Route: /artist/:slug/flow
 * Profile Sync: active modules â†’ rich canvas nodes | inactive â†’ library panel
 * AI Actions: n8n-style automation flow editor
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { NodeFlowCanvas } from '../components/artist/node-flow/NodeFlowCanvas';
import { NodePalette } from '../components/artist/node-flow/NodePalette';
import { PresetPanel } from '../components/artist/node-flow/PresetPanel';
import { FlowToolbar } from '../components/artist/node-flow/FlowToolbar';
import { NodeInspector } from '../components/artist/node-flow/NodeInspector';
import { InactiveModulesPanel } from '../components/artist/node-flow/InactiveModulesPanel';
import { ProfilePresetPanel } from '../components/artist/node-flow/ProfilePresetPanel';
import { useFlowStore } from '../components/artist/node-flow/useFlowStore';
import { useProfileLayout } from '../components/artist/node-flow/useProfileLayout';
import { useWorkflowPersistence } from '../components/artist/node-flow/useWorkflowPersistence';

// â”€â”€â”€ Desktop guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DesktopGuard({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  if (width < 1024) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-8 text-center" style={{ background: '#08080e' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>🖥️</div>
        <p className="text-white font-bold text-lg">Desktop Required</p>
        <p className="text-slate-400 text-sm max-w-xs">The Artist Node Flow editor requires a desktop browser (min 1024px).</p>
      </div>
    );
  }
  return <>{children}</>;
}

// â”€â”€â”€ Mode tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type FlowMode = 'profile' | 'ai';

function ModeTab({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
      style={{
        background: active ? 'rgba(99,102,241,0.25)' : 'transparent',
        border: active ? '1px solid rgba(99,102,241,0.5)' : '1px solid transparent',
        color: active ? '#a78bfa' : '#64748b',
      }}
    >
      {label}
      {count !== undefined && (
        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.06)', color: active ? '#c4b5fd' : '#475569' }}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Profile preview pane ────────────────────────────────────────────────────

function ProfilePreviewPane({ slug, width, onResize, onClose }: {
  slug: string;
  width: number;
  onResize: (w: number) => void;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { setLoaded(false); setReloadKey(k => k + 1); }, [slug]);

  const handleRefresh = () => { setLoaded(false); setReloadKey(k => k + 1); };

  // Resize drag handle logic
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(width);

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      // Dragging left = wider preview; dragging right = narrower
      const delta = dragStartX.current - ev.clientX;
      const newW = Math.min(1000, Math.max(280, dragStartWidth.current + delta));
      onResize(newW);
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width, onResize]);

  return (
    <div style={{
      width, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'rgba(4,4,10,0.98)',
      borderLeft: '1px solid rgba(99,102,241,0.2)',
      boxShadow: '-4px 0 30px rgba(99,102,241,0.08)',
      position: 'relative',
      userSelect: isDragging ? 'none' : undefined,
    }}>
      {/* ── Drag resize handle ── */}
      <div
        onMouseDown={onHandleMouseDown}
        title="Drag to resize"
        style={{
          position: 'absolute', left: -4, top: 0, bottom: 0,
          width: 8, zIndex: 50, cursor: 'ew-resize',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* Visual indicator */}
        <div style={{
          width: 3, height: 40, borderRadius: 3,
          background: isDragging
            ? 'rgba(99,102,241,0.9)'
            : 'rgba(99,102,241,0.3)',
          boxShadow: isDragging ? '0 0 10px rgba(99,102,241,0.7)' : 'none',
          transition: 'background 0.15s, box-shadow 0.15s',
        }} />
      </div>

      {/* Overlay to capture mouse during drag (prevents iframe swallowing events) */}
      {isDragging && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'ew-resize' }} />
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        borderBottom: '1px solid rgba(99,102,241,0.15)',
        background: 'rgba(99,102,241,0.06)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 13 }}>👁</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#a5b4fc', margin: 0 }}>LIVE PREVIEW</p>
          <p style={{ fontSize: 9, color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            /artist/{slug} — {Math.round(width)}px
          </p>
        </div>
        {/* Refresh */}
        <button onClick={handleRefresh} title="Refresh preview" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 6,
          background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
          color: '#818cf8', cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.25)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
        >↻</button>
        {/* Open in new tab */}
        <a href={`/artist/${slug}`} target="_blank" rel="noopener noreferrer" title="Open in new tab" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 6,
          background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
          color: '#818cf8', fontSize: 12, textDecoration: 'none', transition: 'all 0.15s',
        }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.25)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.12)')}
        >↗</a>
        {/* Close */}
        <button onClick={onClose} title="Close preview" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 6,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171', cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
        >✕</button>
      </div>

      {/* Animated gradient line */}
      <div style={{
        height: 2, flexShrink: 0,
        background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.7), rgba(139,92,246,0.7), transparent)',
      }} />

      {/* iframe */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!loaded && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(4,4,10,0.95)', gap: 10,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '3px solid rgba(99,102,241,0.2)',
              borderTop: '3px solid #6366f1',
              animation: 'previewSpin 0.8s linear infinite',
            }} />
            <p style={{ color: '#4f46e5', fontSize: 11, fontWeight: 600 }}>Loading preview…</p>
          </div>
        )}
        <style>{`@keyframes previewSpin { to { transform: rotate(360deg); } }`}</style>
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={`/artist/${slug}`}
          style={{
            width: '100%', height: '100%', border: 'none', background: 'transparent',
            opacity: loaded ? 1 : 0, transition: 'opacity 0.3s',
            pointerEvents: isDragging ? 'none' : 'auto',
          }}
          onLoad={() => setLoaded(true)}
          title="Artist profile preview"
        />
      </div>
    </div>
  );
}

// â”€â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ArtistNodeFlowPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const store = useFlowStore();
  const [flowMode, setFlowMode] = useState<FlowMode>('profile');
  const [numericArtistId, setNumericArtistId] = useState<number | null>(null);
  const workflow = useWorkflowPersistence(numericArtistId);
  const [showPreview, setShowPreview] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(440);
  // Selected artist can be the URL artist initially, then switched via ProfileRootNode
  const [selectedArtistId, setSelectedArtistId] = useState<string | number | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string>(slug ?? '');
  const [selectedArtistInfo, setSelectedArtistInfo] = useState<{
    name: string | null; image: string | null; genre: string | null; country: string | null;
  }>({ name: null, image: null, genre: null, country: null });
  const [layoutKey, setLayoutKey] = useState(0);

  // Initial load from URL slug
  useEffect(() => {
    if (!slug) return;
    setSelectedSlug(slug);
    fetch(`/api/profile/${slug}/flow`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        // Numeric slugs identify generated artists. Keep that ID available
        // when Render/API is briefly unavailable, so Flow can still render
        // the local profile graph and its default connections.
        const slugId = /^\d+$/.test(String(slug)) ? Number(slug) : null;
        const id = data?.id ?? data?.pgId ?? slugId;
        setSelectedArtistId(id);
        if (typeof id === 'number') setNumericArtistId(id);
        setSelectedArtistInfo({
          name: data?.artistName ?? data?.firstName ?? null,
          image: data?.profileImage ?? data?.profileImageUrl ?? null,
          genre: data?.genre ?? null,
          country: data?.country ?? null,
        });
        store.setArtistContext(id, slug);
      })
      .catch(() => {
        const fallbackId = /^\d+$/.test(String(slug)) ? Number(slug) : null;
        setSelectedArtistId(fallbackId);
        if (fallbackId !== null) setNumericArtistId(fallbackId);
        store.setArtistContext(fallbackId as any, slug ?? '');
      });
  }, [slug]);

  const { profileNodes, profileEdges, inactiveModules, isLoading, dataSource, activateModule, activateModules, reorderModulesFromEdge, resetPositions } =
    useProfileLayout(selectedArtistId, selectedSlug || null);

  // When the user draws a connection between two profile module nodes on the canvas,
  // extract the moduleId from each node ID ("pm-<moduleId>-<version>") and reorder
  // the profile sections so the source module appears before the target module.
  const handleModuleConnect = useCallback((sourceNodeId: string, targetNodeId: string) => {
    const extractModuleId = (nodeId: string) => nodeId.match(/^pm-(.+?)-\d+$/)?.[1] ?? null;
    const src = extractModuleId(sourceNodeId);
    const tgt = extractModuleId(targetNodeId);
    if (src && tgt) reorderModulesFromEdge(src, tgt);
  }, [reorderModulesFromEdge]);

  // Switch artist from the ProfileRootNode picker
  const handleArtistSelect = useCallback(async (id: number, newSlug: string) => {
    const data = await fetch(`/api/profile/${newSlug}/flow`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    setSelectedArtistId(id);
    setSelectedSlug(newSlug);
    setSelectedArtistInfo({
      name: data?.artistName ?? data?.firstName ?? null,
      image: data?.profileImage ?? data?.profileImageUrl ?? null,
      genre: data?.genre ?? null,
      country: data?.country ?? null,
    });
    store.setArtistContext(id, newSlug);
    resetPositions();
    setLayoutKey(k => k + 1);
  }, [store, resetPositions]);

  // Auto-layout
  const handleAutoLayout = () => {
    resetPositions();
    setLayoutKey(k => k + 1);
  };

  // Root node always present in Profile Sync mode — positioned to the left of all module columns
  const profileRootNode = useMemo(() => ({
    id: 'profile-root',
    type: 'profileRoot' as const,
    position: { x: -360, y: 80 },
    data: {
      artistId: selectedArtistId,
      artistSlug: selectedSlug,
      artistName: selectedArtistInfo.name,
      artistImage: selectedArtistInfo.image,
      artistGenre: selectedArtistInfo.genre,
      artistCountry: selectedArtistInfo.country,
      onArtistSelect: handleArtistSelect,
    },
    draggable: true,
  }), [selectedArtistId, selectedSlug, selectedArtistInfo, handleArtistSelect]);

  // Connect root to category-hub profile nodes (primary modules per category)
  const ROOT_HUBS = ['songs', 'social-hub', 'social-posts', 'merchandise', 'analytics', 'business-plan', 'electronic-press-kit', 'renaissance-studio', 'audience-engine', 'galleries'];
  const rootEdges = useMemo(() =>
    profileNodes
      .filter(n => ROOT_HUBS.some(m => n.id.startsWith(`pm-${m}-`)))
      .map(n => ({
        id: `root-to-${n.id}`,
        source: 'profile-root',
        target: n.id,
        type: 'animated',
        style: { stroke: '#6366f1', strokeWidth: 1.5, strokeOpacity: 0.3 },
      })),
    [profileNodes]
  );

  // Keep graph inputs stable between renders. NodeFlowCanvas maintains
  // measured React Flow state locally, so unstable array references can reset
  // or drop derived connections while the profile is loading.
  const profileCanvasNodes = useMemo(
    () => [profileRootNode, ...profileNodes],
    [profileRootNode, profileNodes],
  );
  const profileCanvasEdges = useMemo(
    () => {
      const edges = [...rootEdges, ...profileEdges];
      const connected = new Set<string>();
      edges.forEach(edge => {
        connected.add(edge.source);
        connected.add(edge.target);
      });

      // Every visible node must belong to the profile graph. The catalogue
      // contains many optional widgets that do not have a semantic module edge
      // yet, so attach those isolated nodes to the profile root with a quiet
      // fallback edge instead of leaving them floating disconnected.
      profileNodes.forEach(node => {
        if (connected.has(node.id)) return;
        edges.push({
          id: `root-fallback-${node.id}`,
          source: 'profile-root',
          target: node.id,
          type: 'animated',
          style: { stroke: '#475569', strokeWidth: 1, strokeOpacity: 0.28, strokeDasharray: '5 5' },
        });
        connected.add(node.id);
      });

      return edges;
    },
    [rootEdges, profileEdges, profileNodes],
  );

  // Module IDs that are currently active (for preset panel)
  const activeModuleIds = useMemo(() =>
    profileNodes.map(n => {
      const m = n.id.match(/^pm-(.+)-\d+$/);
      return m ? m[1] : '';
    }).filter(Boolean),
    [profileNodes]
  );

  return (
    <DesktopGuard>
      <ReactFlowProvider>
        <div
          className="flex flex-col"
          style={{ height: '100dvh', width: '100vw', background: '#07070f', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}
        >
          {/* Toolbar */}
          <FlowToolbar
            onBack={() => navigate(`/artist/${slug}`)}
            nodeCount={flowMode === 'profile' ? profileCanvasNodes.length : undefined}
            edgeCount={flowMode === 'profile' ? profileCanvasEdges.length : undefined}
          />

          {/* Mode tabs */}
          <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0" style={{ background: 'rgba(7,7,15,0.98)', borderBottom: '1px solid rgba(99,102,241,0.12)', boxShadow: '0 1px 20px rgba(99,102,241,0.08)' }}>
            <ModeTab
              active={flowMode === 'profile'}
              label="🗺️ Profile Sync"
              count={profileNodes.length}
              onClick={() => setFlowMode('profile')}
            />
            <ModeTab
              active={flowMode === 'ai'}
              label="⚡ AI Actions"
              count={store.nodes.length}
              onClick={async () => {
                setFlowMode('ai');
                // Load saved workflow on first switch to AI mode
                if (store.nodes.length === 0 && numericArtistId) {
                  const wf = await workflow.loadWorkflow();
                  if (wf?.nodes?.length) {
                    store.clearFlow();
                    wf.nodes.forEach((n: any) => store.addNode(n));
                  }
                }
              }}
            />
            <div className="ml-auto flex items-center gap-3">
              {flowMode === 'profile' && (
                <>
                  <span className="text-[10px] text-slate-600">
                    {isLoading
                      ? 'Loading…'
                      : `${profileNodes.length} active · ${inactiveModules.length} in library`}
                  </span>
                  {dataSource !== 'default' && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                      style={{
                        background: dataSource === 'firestore' ? 'rgba(96,165,250,0.12)' : 'rgba(74,222,128,0.12)',
                        color: dataSource === 'firestore' ? '#60a5fa' : '#4ade80',
                      }}
                    >
                      {dataSource === 'firestore' ? 'Firestore' : 'API'}
                    </span>
                  )}
                  <button
                    onClick={handleAutoLayout}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all"
                    style={{
                      background: 'rgba(99,102,241,0.15)',
                      border: '1px solid rgba(99,102,241,0.35)',
                      color: '#a5b4fc',
                      boxShadow: '0 0 10px rgba(99,102,241,0.2)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 18px rgba(99,102,241,0.45)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 10px rgba(99,102,241,0.2)')}
                    title="Re-arrange all nodes to their computed positions"
                  >
                    ↻ Auto Layout
                  </button>
                </>
              )}
              {/* AI mode: Save Workflow button */}
              {flowMode === 'ai' && (
                <button
                  onClick={() => workflow.saveWorkflow(store.nodes as any, store.edges as any)}
                  disabled={workflow.isSaving}
                  title={workflow.lastSaved ? `Last saved: ${workflow.lastSaved.toLocaleTimeString()}` : 'Save workflow to database'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 8, cursor: workflow.isSaving ? 'not-allowed' : 'pointer',
                    fontSize: 10, fontWeight: 700, transition: 'all 0.2s',
                    background: workflow.isSaving ? 'rgba(251,191,36,0.15)' : workflow.lastSaved ? 'rgba(34,197,94,0.15)' : 'rgba(99,102,241,0.12)',
                    border: `1px solid ${workflow.isSaving ? 'rgba(251,191,36,0.4)' : workflow.lastSaved ? 'rgba(34,197,94,0.4)' : 'rgba(99,102,241,0.3)'}`,
                    color: workflow.isSaving ? '#fbbf24' : workflow.lastSaved ? '#4ade80' : '#a5b4fc',
                    opacity: workflow.isSaving ? 0.7 : 1,
                  }}
                >
                  {workflow.isSaving ? '⏳ Saving…' : workflow.lastSaved ? `✓ Saved ${workflow.lastSaved.toLocaleTimeString()}` : '💾 Save Workflow'}
                </button>
              )}
              {/* Live Preview toggle */}
              <button
                onClick={() => setShowPreview(p => !p)}
                title={showPreview ? 'Close live preview' : 'Open artist profile preview'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                  fontSize: 10, fontWeight: 700, transition: 'all 0.2s',
                  background: showPreview ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.08)',
                  border: showPreview ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(99,102,241,0.2)',
                  color: showPreview ? '#c4b5fd' : '#6366f1',
                  boxShadow: showPreview ? '0 0 14px rgba(99,102,241,0.35)' : 'none',
                }}
                onMouseEnter={e => { if (!showPreview) e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; }}
                onMouseLeave={e => { if (!showPreview) e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; }}
              >
                <span style={{ fontSize: 12 }}>👁</span>
                {showPreview ? 'Cerrar Preview' : 'Vista Previa'}
              </button>
            </div>
          </div>

          {/* Main workspace */}
          <div className="flex flex-1 min-h-0">

            {/* LEFT PANEL */}
            {flowMode === 'profile' ? (
              <InactiveModulesPanel
                inactiveModules={inactiveModules}
                onActivate={activateModule}
              />
            ) : (
              <NodePalette />
            )}

            {/* CENTER CANVAS */}
            <div className="flex-1 relative min-w-0">
              <NodeFlowCanvas
                extraNodes={flowMode === 'profile' ? profileCanvasNodes : []}
                extraEdges={flowMode === 'profile' ? profileCanvasEdges : []}
                layoutKey={layoutKey}
                onAutoLayout={handleAutoLayout}
                onModuleConnect={flowMode === 'profile' ? handleModuleConnect : undefined}
              />
              {/* Profile mode: empty canvas hint */}
              {flowMode === 'profile' && profileNodes.length === 0 && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center px-8 py-6 rounded-2xl" style={{ background: 'rgba(13,13,26,0.8)', border: '1px dashed rgba(99,102,241,0.3)' }}>
                    <p className="text-2xl mb-2">🔭</p>
                    <p className="text-white font-bold text-sm">No active modules</p>
                    <p className="text-slate-500 text-xs mt-1">Click + on any module in the library to activate it</p>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT PANEL — hidden when preview is open */}
            {!showPreview && (
              flowMode === 'profile' ? (
                <ProfilePresetPanel
                  activeModuleIds={activeModuleIds}
                  onActivatePreset={async (ids) => {
                    await activateModules(ids);
                    resetPositions();
                    setLayoutKey(k => k + 1);
                  }}
                />
              ) : (
                <PresetPanel />
              )
            )}

            {/* LIVE PREVIEW PANEL */}
            {showPreview && (
              <ProfilePreviewPane
                slug={selectedSlug || slug || ''}
                width={previewWidth}
                onResize={setPreviewWidth}
                onClose={() => setShowPreview(false)}
              />
            )}
          </div>

          {/* Node inspector */}
          <NodeInspector />
        </div>
      </ReactFlowProvider>
    </DesktopGuard>
  );
}

// â”€â”€â”€ Profile legend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const LEGEND_ITEMS = [
  { label: 'MUSIC',    color: '#3b82f6' },
  { label: 'SOCIAL',   color: '#22d3ee' },
  { label: 'COMMERCE', color: '#f97316' },
  { label: 'MONETIZE', color: '#10b981' },
  { label: 'GROWTH',   color: '#a78bfa' },
  { label: 'BUSINESS', color: '#f59e0b' },
  { label: 'IDENTITY', color: '#ec4899' },
  { label: 'CREATIVE', color: '#8b5cf6' },
];

function ProfileLegend({ activeCount, inactiveCount }: { activeCount: number; inactiveCount: number }) {
  return (
    <div
      className="flex flex-col h-full overflow-y-auto"
      style={{ width: 170, background: 'rgba(6,6,12,0.97)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="px-3 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Categories</p>
      </div>
      <div className="flex-1 px-2 py-2 space-y-1">
        {LEGEND_ITEMS.map(item => (
          <div key={item.label} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: `${item.color}0d` }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <span className="text-[10px] font-bold tracking-wider" style={{ color: item.color }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-500">Active</span>
            <span className="text-[10px] font-bold text-green-400">{activeCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-500">Library</span>
            <span className="text-[10px] font-bold text-slate-500">{inactiveCount}</span>
          </div>
        </div>
        <p className="text-[9px] text-slate-700 mt-2 leading-relaxed">
          Active modules appear on the canvas. Click eye to toggle.
        </p>
      </div>
    </div>
  );
}
