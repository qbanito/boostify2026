/**
 * MediaLibraryPanel — DaVinci Resolve-style media bin system
 * 
 * Features:
 * - Custom user bins (folders) — create/rename/delete via right-click
 * - Smart auto-bins: Master, Images, Videos, Audio
 * - Thumbnail size slider (40-140px)
 * - Grid & List views
 * - Drag reorder within bins + drag items onto bin tabs
 * - Right-click context menu on items (add to timeline, move to bin, rename, delete)
 * - Right-click on empty space (create bin, import)
 * - Search with filter
 * - Source badges (GEN/IMP/EDIT/REGEN/VID)
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Image as ImageIcon, Video as VideoIcon, Volume2 as VolumeIcon,
  Upload, Plus as PlusIcon, Trash2, GripVertical, Search,
  FolderOpen, FolderPlus, Grid3X3, List, X as XIcon, Film, Music, Layers,
  ChevronDown, ChevronRight,
  ArrowRight, Eye, FolderIcon, Pencil,
  Wand2, Camera, RefreshCw, Clapperboard, Timer,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

export interface MediaItem {
  id: string;
  url: string;
  name: string;
  type: 'image' | 'video' | 'audio';
  source: 'generated' | 'imported' | 'edited' | 'regenerated' | 'video-frame';
  prompt?: string;
  mimeType?: string;
  addedAt: number;
  clipId?: number;
  binId?: string;
}

export interface MediaBin {
  id: string;
  name: string;
  color: string;
  isSmartBin?: boolean;
}

type ViewMode = 'grid' | 'list';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  target: 'empty' | 'item' | 'bin';
  itemId?: string;
  binId?: string;
}

interface MediaLibraryPanelProps {
  items: MediaItem[];
  onUpdateItems: (items: MediaItem[]) => void;
  onDelete: (id: string) => void;
  onSelect: (item: MediaItem) => void;
  onAddToTimeline?: (item: MediaItem) => void;
  onImport: () => void;
  selectedId?: string | null;
  width: number;
  // Source Monitor (double-click to set In/Out)
  onOpenSourceMonitor?: (item: MediaItem) => void;
  // Clip actions (right-click menu)
  onEditImage?: (item: MediaItem) => void;
  onCameraAngles?: (item: MediaItem) => void;
  onRegenerate?: (item: MediaItem) => void;
  onGenerateVideo?: (item: MediaItem) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const BIN_COLORS = [
  '#f97316', '#8b5cf6', '#06b6d4', '#22c55e', '#eab308',
  '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f59e0b',
];

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  generated: { label: 'GEN', color: 'bg-orange-500/80' },
  imported: { label: 'IMP', color: 'bg-cyan-500/80' },
  edited: { label: 'EDIT', color: 'bg-green-500/80' },
  regenerated: { label: 'REGEN', color: 'bg-yellow-500/80' },
  'video-frame': { label: 'VID', color: 'bg-purple-500/80' },
};

const SMART_BINS: MediaBin[] = [
  { id: '_all', name: 'Master', color: '#fff', isSmartBin: true },
  { id: '_images', name: 'Imágenes', color: '#f97316', isSmartBin: true },
  { id: '_videos', name: 'Videos', color: '#8b5cf6', isSmartBin: true },
  { id: '_audio', name: 'Audio', color: '#06b6d4', isSmartBin: true },
];

// ── Component ──────────────────────────────────────────────────────────────

export function MediaLibraryPanel({
  items,
  onUpdateItems,
  onDelete,
  onSelect,
  onAddToTimeline,
  onImport,
  selectedId,
  width,
  onOpenSourceMonitor,
  onEditImage,
  onCameraAngles,
  onRegenerate,
  onGenerateVideo,
}: MediaLibraryPanelProps) {
  const [userBins, setUserBins] = useState<MediaBin[]>([]);
  const [activeBinId, setActiveBinId] = useState('_all');
  const [thumbSize, setThumbSize] = useState(72);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, target: 'empty' });
  const [renamingBinId, setRenamingBinId] = useState<string | null>(null);
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const allBins = useMemo(() => [...SMART_BINS, ...userBins], [userBins]);
  const activeBin = allBins.find(b => b.id === activeBinId) || SMART_BINS[0];

  // ── Smart bin filter functions ─────────────────────────────────────────
  const smartFilter = useCallback((binId: string, item: MediaItem) => {
    if (binId === '_all') return true;
    if (binId === '_images') return item.type === 'image';
    if (binId === '_videos') return item.type === 'video';
    if (binId === '_audio') return item.type === 'audio';
    return item.binId === binId;
  }, []);

  // ── Filtering ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = items.filter(i => smartFilter(activeBinId, i));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.prompt && i.prompt.toLowerCase().includes(q)) ||
        i.source.includes(q)
      );
    }
    return result;
  }, [items, activeBinId, searchQuery, smartFilter]);

  // ── Counts ─────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const bin of allBins) {
      c[bin.id] = items.filter(i => smartFilter(bin.id, i)).length;
    }
    return c;
  }, [items, allBins, smartFilter]);

  // ── Close context menu on click outside ────────────────────────────────
  useEffect(() => {
    if (!contextMenu.visible) return;
    const close = () => setContextMenu(prev => ({ ...prev, visible: false }));
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu.visible]);

  // ── Focus rename input ─────────────────────────────────────────────────
  useEffect(() => {
    if ((renamingBinId || renamingItemId) && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingBinId, renamingItemId]);

  // ── Bin actions ────────────────────────────────────────────────────────
  const createBin = useCallback(() => {
    const id = `bin_${Date.now()}`;
    const colorIdx = userBins.length % BIN_COLORS.length;
    const newBin: MediaBin = { id, name: `Bin ${userBins.length + 1}`, color: BIN_COLORS[colorIdx] };
    setUserBins(prev => [...prev, newBin]);
    setActiveBinId(id);
    setRenamingBinId(id);
    setRenameValue(`Bin ${userBins.length + 1}`);
  }, [userBins.length]);

  const deleteBin = useCallback((binId: string) => {
    setUserBins(prev => prev.filter(b => b.id !== binId));
    const updated = items.map(i => i.binId === binId ? { ...i, binId: undefined } : i);
    onUpdateItems(updated);
    if (activeBinId === binId) setActiveBinId('_all');
  }, [items, onUpdateItems, activeBinId]);

  const confirmRename = useCallback(() => {
    if (renamingBinId) {
      setUserBins(prev => prev.map(b => b.id === renamingBinId ? { ...b, name: renameValue.trim() || b.name } : b));
      setRenamingBinId(null);
    } else if (renamingItemId) {
      const updated = items.map(i => i.id === renamingItemId ? { ...i, name: renameValue.trim() || i.name } : i);
      onUpdateItems(updated);
      setRenamingItemId(null);
    }
    setRenameValue('');
  }, [renamingBinId, renamingItemId, renameValue, items, onUpdateItems]);

  const moveItemToBin = useCallback((itemId: string, binId: string | undefined) => {
    const updated = items.map(i => i.id === itemId ? { ...i, binId } : i);
    onUpdateItems(updated);
  }, [items, onUpdateItems]);

  // ── Drag & Drop reorder ────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(id);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return; }
    const fromIdx = items.findIndex(i => i.id === dragId);
    const toIdx = items.findIndex(i => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...items];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    onUpdateItems(reordered);
    setDragId(null);
    setDragOverId(null);
  }, [dragId, items, onUpdateItems]);

  const handleDragEnd = useCallback(() => { setDragId(null); setDragOverId(null); }, []);

  // ── Drop on bin tab (move item to that bin) ────────────────────────────
  const handleDropOnBin = useCallback((e: React.DragEvent, binId: string) => {
    e.preventDefault();
    if (dragId) {
      moveItemToBin(dragId, binId.startsWith('_') ? undefined : binId);
      setDragId(null);
    }
  }, [dragId, moveItemToBin]);

  // ── Context Menus ──────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e: React.MouseEvent, target: 'empty' | 'item' | 'bin', id?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).closest('.media-library-root')?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : e.clientX;
    const y = rect ? e.clientY - rect.top : e.clientY;
    setContextMenu({
      visible: true,
      x: Math.min(x, (rect?.width || 300) - 160),
      y: Math.min(y, (rect?.height || 500) - 200),
      target,
      itemId: target === 'item' ? id : undefined,
      binId: target === 'bin' ? id : undefined,
    });
  }, []);

  // ── Render item ────────────────────────────────────────────────────────
  const renderItem = (item: MediaItem) => {
    const isSelected = item.id === selectedId;
    const isDragOver = item.id === dragOverId;
    const sourceInfo = SOURCE_LABELS[item.source] || SOURCE_LABELS.imported;
    const isRenaming = renamingItemId === item.id;

    if (viewMode === 'list') {
      return (
        <div
          key={item.id}
          draggable
          onDragStart={(e) => handleDragStart(e, item.id)}
          onDragOver={(e) => handleDragOver(e, item.id)}
          onDrop={(e) => handleDrop(e, item.id)}
          onDragEnd={handleDragEnd}
          onContextMenu={(e) => handleContextMenu(e, 'item', item.id)}
          className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer group transition-all ${
            isSelected ? 'bg-orange-500/20 ring-1 ring-orange-500/50' :
            isDragOver ? 'bg-white/10 ring-1 ring-white/30' :
            'hover:bg-white/5'
          }`}
          onClick={() => onSelect(item)}
          onDoubleClick={() => onOpenSourceMonitor?.(item)}
        >
          <GripVertical size={10} className="text-white/20 group-hover:text-white/40 cursor-grab flex-shrink-0" />
          {item.type === 'image' ? (
            <img src={item.url} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" loading="lazy" />
          ) : item.type === 'video' ? (
            <div className="w-8 h-8 rounded bg-purple-900/40 flex items-center justify-center flex-shrink-0">
              <Film size={12} className="text-purple-400" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded bg-cyan-900/40 flex items-center justify-center flex-shrink-0">
              <Music size={12} className="text-cyan-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <input
                ref={renameInputRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={confirmRename}
                onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') { setRenamingItemId(null); setRenameValue(''); } }}
                className="bg-neutral-800 border border-orange-500/50 rounded text-[9px] text-white px-1 py-0 w-full focus:outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <div className="text-[9px] text-white/80 truncate">{item.name}</div>
                <div className="text-[7px] text-white/30">{item.source}{item.binId ? ` · ${userBins.find(b => b.id === item.binId)?.name || ''}` : ''}</div>
              </>
            )}
          </div>
          <div className={`px-1 py-0 rounded text-[6px] font-bold text-white ${sourceInfo.color}`}>{sourceInfo.label}</div>
        </div>
      );
    }

    // Grid view
    return (
      <div
        key={item.id}
        draggable
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragOver={(e) => handleDragOver(e, item.id)}
        onDrop={(e) => handleDrop(e, item.id)}
        onDragEnd={handleDragEnd}
        onContextMenu={(e) => handleContextMenu(e, 'item', item.id)}
        className={`relative rounded overflow-hidden cursor-pointer group transition-all ${
          isSelected ? 'ring-2 ring-orange-500 shadow-lg shadow-orange-500/20' :
          isDragOver ? 'ring-2 ring-white/40' :
          'hover:ring-1 hover:ring-white/20'
        }`}
        style={{ width: thumbSize, height: thumbSize }}
        onClick={() => onSelect(item)}
        onDoubleClick={() => onOpenSourceMonitor?.(item)}
      >
        {item.type === 'image' ? (
          <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : item.type === 'video' ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/50 to-neutral-900 gap-0.5">
            <Film size={thumbSize > 60 ? 18 : 12} className="text-purple-400" />
            <span className="text-[7px] text-purple-300/70 truncate w-full text-center px-0.5">{item.name}</span>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-900/50 to-neutral-900 gap-0.5">
            <Music size={thumbSize > 60 ? 18 : 12} className="text-cyan-400" />
            <span className="text-[7px] text-cyan-300/70 truncate w-full text-center px-0.5">{item.name}</span>
            <div className="flex items-end gap-px h-2.5">
              {Array.from({ length: 8 }).map((_, j) => (
                <div key={j} className="w-0.5 bg-cyan-400/40 rounded-t" style={{ height: `${2 + Math.abs(Math.sin(j * 1.3)) * 8}px` }} />
              ))}
            </div>
          </div>
        )}

        {/* Source badge */}
        <div className={`absolute top-0.5 left-0.5 px-1 py-0 rounded text-[6px] font-bold text-white ${sourceInfo.color}`}>
          {sourceInfo.label}
        </div>

        {/* Name on hover */}
        {isRenaming ? (
          <div className="absolute bottom-0 left-0 right-0 p-0.5 bg-black/80" onClick={(e) => e.stopPropagation()}>
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={confirmRename}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') { setRenamingItemId(null); setRenameValue(''); } }}
              className="bg-neutral-800 border border-orange-500/50 rounded text-[7px] text-white px-1 py-0 w-full focus:outline-none"
            />
          </div>
        ) : (
          <div className="absolute bottom-0 left-0 right-0 px-0.5 py-0.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-[7px] text-white/80 truncate block">{item.name}</span>
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
          {onAddToTimeline && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToTimeline(item); }}
              className="p-1 bg-orange-500 hover:bg-orange-600 rounded-full transition-colors"
              title="Agregar al timeline"
            >
              <PlusIcon size={10} className="text-white" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // ── Context menu renderer ──────────────────────────────────────────────
  const renderContextMenu = () => {
    if (!contextMenu.visible) return null;

    const menuItems: { label: string; icon: React.ReactNode; action: () => void; danger?: boolean; divider?: boolean }[] = [];

    if (contextMenu.target === 'empty') {
      menuItems.push(
        { label: 'Nueva Carpeta', icon: <FolderPlus size={12} />, action: createBin },
        { label: 'Importar Archivos', icon: <Upload size={12} />, action: onImport },
      );
    } else if (contextMenu.target === 'item' && contextMenu.itemId) {
      const item = items.find(i => i.id === contextMenu.itemId);
      if (item) {
        if (onAddToTimeline) {
          menuItems.push({ label: 'Agregar al Timeline', icon: <PlusIcon size={12} />, action: () => onAddToTimeline(item) });
        }
        menuItems.push({ label: 'Previsualizar', icon: <Eye size={12} />, action: () => onSelect(item) });
        if (onOpenSourceMonitor) {
          menuItems.push({ label: 'Marcar In/Out', icon: <Timer size={12} />, action: () => onOpenSourceMonitor(item) });
        }
        // Image-specific actions
        if (item.type === 'image') {
          menuItems.push({ label: '', icon: null, action: () => {}, divider: true });
          if (onEditImage) {
            menuItems.push({ label: 'Editar Imagen (AI)', icon: <Wand2 size={12} />, action: () => onEditImage(item) });
          }
          if (onCameraAngles) {
            menuItems.push({ label: 'Camera Angles', icon: <Camera size={12} />, action: () => onCameraAngles(item) });
          }
          if (onRegenerate) {
            menuItems.push({ label: 'Regenerar Imagen', icon: <RefreshCw size={12} />, action: () => onRegenerate(item) });
          }
          if (onGenerateVideo) {
            menuItems.push({ label: 'Generar Video', icon: <Clapperboard size={12} />, action: () => onGenerateVideo(item) });
          }
        }
        menuItems.push({ label: '', icon: null, action: () => {}, divider: true });
        menuItems.push({
          label: 'Renombrar',
          icon: <Pencil size={12} />,
          action: () => { setRenamingItemId(item.id); setRenameValue(item.name); },
        });
        if (userBins.length > 0) {
          menuItems.push({ label: '', icon: null, action: () => {}, divider: true });
          for (const bin of userBins) {
            if (item.binId !== bin.id) {
              menuItems.push({
                label: `Mover a "${bin.name}"`,
                icon: <ArrowRight size={12} style={{ color: bin.color }} />,
                action: () => moveItemToBin(item.id, bin.id),
              });
            }
          }
          if (item.binId) {
            menuItems.push({
              label: 'Quitar de carpeta',
              icon: <XIcon size={12} />,
              action: () => moveItemToBin(item.id, undefined),
            });
          }
        }
        menuItems.push({ label: '', icon: null, action: () => {}, divider: true });
        menuItems.push({ label: 'Eliminar', icon: <Trash2 size={12} />, action: () => onDelete(item.id), danger: true });
      }
    } else if (contextMenu.target === 'bin' && contextMenu.binId) {
      const bin = userBins.find(b => b.id === contextMenu.binId);
      if (bin) {
        menuItems.push({
          label: 'Renombrar Carpeta',
          icon: <Pencil size={12} />,
          action: () => { setRenamingBinId(bin.id); setRenameValue(bin.name); },
        });
        menuItems.push({ label: 'Eliminar Carpeta', icon: <Trash2 size={12} />, action: () => deleteBin(bin.id), danger: true });
      }
    }

    return (
      <div
        className="absolute z-50 bg-neutral-900 border border-white/15 rounded-lg shadow-xl py-1 min-w-[160px]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {menuItems.map((mi, i) => {
          if (mi.divider) return <div key={i} className="h-px bg-white/10 my-1" />;
          return (
            <button
              key={i}
              onClick={() => { mi.action(); setContextMenu(prev => ({ ...prev, visible: false })); }}
              className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-[10px] transition-colors ${
                mi.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <span className="w-4 flex-shrink-0">{mi.icon}</span>
              {mi.label}
            </button>
          );
        })}
      </div>
    );
  };

  // ── JSX ────────────────────────────────────────────────────────────────
  return (
    <div
      className="media-library-root relative flex flex-col h-full overflow-hidden"
      onContextMenu={(e) => {
        if (!(e.target as HTMLElement).closest('[draggable]')) handleContextMenu(e, 'empty');
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 bg-neutral-900 flex-shrink-0">
        <div className="flex items-center gap-1">
          <FolderOpen size={10} className="text-orange-400" />
          <span className="text-[9px] font-medium text-white/80">Media Pool</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setShowSearch(s => !s)} className={`p-0.5 rounded transition-colors ${showSearch ? 'bg-white/10 text-white' : 'hover:bg-white/10 text-white/50'}`} title="Buscar (Ctrl+F)">
            <Search size={10} />
          </button>
          <button onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')} className="p-0.5 hover:bg-white/10 rounded transition-colors text-white/50" title={viewMode === 'grid' ? 'Vista lista' : 'Vista grid'}>
            {viewMode === 'grid' ? <List size={10} /> : <Grid3X3 size={10} />}
          </button>
          <button onClick={createBin} className="p-0.5 hover:bg-white/10 rounded transition-colors text-white/50" title="Nueva Carpeta">
            <FolderPlus size={10} />
          </button>
          <button onClick={onImport} className="p-0.5 hover:bg-white/10 rounded transition-colors" title="Importar archivos">
            <Upload size={10} className="text-cyan-400" />
          </button>
          <Badge variant="outline" className="text-[8px] px-1 py-0 bg-orange-500/10 border-orange-500/30 text-orange-400 ml-0.5">
            {items.length}
          </Badge>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-2 py-1 border-b border-white/5 flex-shrink-0">
          <div className="relative">
            <Search size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en media pool..."
              className="w-full bg-neutral-800 border border-white/10 rounded text-[9px] text-white pl-5 pr-6 py-1 focus:outline-none focus:border-orange-500/50"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <XIcon size={10} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bin tabs — smart + user bins */}
      <div className="flex items-center gap-0 px-1 py-0.5 border-b border-white/5 bg-neutral-950/50 flex-shrink-0 overflow-x-auto scrollbar-none">
        {SMART_BINS.map(bin => {
          const count = counts[bin.id] || 0;
          const isActive = activeBinId === bin.id;
          return (
            <button
              key={bin.id}
              onClick={() => setActiveBinId(bin.id)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => handleDropOnBin(e, bin.id)}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[8px] transition-all whitespace-nowrap ${
                isActive ? 'bg-white/10 text-white font-medium' : 'text-white/40 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              {bin.id === '_all' ? <Layers size={9} /> :
               bin.id === '_images' ? <ImageIcon size={9} style={{ color: bin.color }} /> :
               bin.id === '_videos' ? <Film size={9} style={{ color: bin.color }} /> :
               <Music size={9} style={{ color: bin.color }} />}
              <span>{bin.name}</span>
              {count > 0 && <span className={`text-[7px] px-1 rounded-full ${isActive ? 'bg-white/15 text-white/70' : 'text-white/25'}`}>{count}</span>}
            </button>
          );
        })}
        {userBins.length > 0 && <div className="h-3 w-px bg-white/10 mx-0.5 flex-shrink-0" />}
        {userBins.map(bin => {
          const count = counts[bin.id] || 0;
          const isActive = activeBinId === bin.id;
          const isRenaming = renamingBinId === bin.id;
          return (
            <button
              key={bin.id}
              onClick={() => setActiveBinId(bin.id)}
              onContextMenu={(e) => handleContextMenu(e, 'bin', bin.id)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => handleDropOnBin(e, bin.id)}
              className={`flex items-center gap-1 px-1.5 py-1 rounded text-[8px] transition-all whitespace-nowrap ${
                isActive ? 'bg-white/10 text-white font-medium' : 'text-white/40 hover:text-white/60 hover:bg-white/5'
              }`}
            >
              <FolderIcon size={9} style={{ color: bin.color }} />
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={confirmRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') { setRenamingBinId(null); setRenameValue(''); } }}
                  className="bg-neutral-800 border border-orange-500/50 rounded text-[8px] text-white px-1 py-0 w-16 focus:outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span>{bin.name}</span>
              )}
              {count > 0 && !isRenaming && <span className={`text-[7px] px-1 rounded-full ${isActive ? 'bg-white/15 text-white/70' : 'text-white/25'}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Thumbnail Size Slider */}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-white/5 flex-shrink-0">
        <ImageIcon size={9} className="text-white/30" />
        <Slider
          min={40}
          max={140}
          step={4}
          value={[thumbSize]}
          onValueChange={([v]) => setThumbSize(v)}
          className="flex-1 h-3"
        />
        <span className="text-[8px] text-white/30 w-6 text-right">{thumbSize}</span>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 p-1.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-white/30 gap-2">
            <FolderOpen size={20} />
            <span className="text-[9px] text-center">
              {searchQuery ? 'Sin resultados' :
               !activeBin.isSmartBin ? 'Carpeta vacía — arrastra archivos aquí' :
               'Sin archivos'}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={onImport} className="text-[9px] text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1">
                <Upload size={10} /> Importar
              </button>
              <button onClick={createBin} className="text-[9px] text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-1">
                <FolderPlus size={10} /> Nueva Carpeta
              </button>
            </div>
          </div>
        ) : (
          viewMode === 'grid' ? (
            <div className="flex flex-wrap gap-1" style={{ maxWidth: '100%' }}>
              {filtered.map(renderItem)}
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {filtered.map(renderItem)}
            </div>
          )
        )}
      </div>

      {/* Context Menu */}
      {renderContextMenu()}
    </div>
  );
}
