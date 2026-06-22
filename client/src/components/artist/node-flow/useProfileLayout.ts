/**
 * BOOSTIFY NODE FLOW — useProfileLayout
 * Fetches the artist's profile layout from the DB and converts every
 * section (module) into a React Flow node, positioned by category column.
 * Also provides a toggleVisibility() that writes back to the DB.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Node, Edge } from '@xyflow/react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ProfileModuleData } from './nodes/ProfileModuleNode';

// ─── Module catalogue (mirrors artist-profile-card.tsx allSections) ─────────

interface ModuleDef {
  name: string;
  category: string;
  color: string;
  isOwnerOnly: boolean;
}

// Mirrors the defaultVisibility in artist-profile-card.tsx EXACTLY.
// Used when profileLayout.visibility is null/empty so the Node Flow shows
// the same modules that the artist profile shows by default.
// Keep this 1:1 with `defaultVisibility` in artist-profile-card.tsx so the
// canvas never shows a module as active that the profile renders as hidden.
const DEFAULT_VISIBILITY: Record<string, boolean> = {
  // ── Default ON for new profiles ──
  'songs':              true,
  'fanclub':            true,
  'videos':             true,
  'galleries':          true,
  'karaoke':            true,
  'fashion-store':      true,
  // ── Everything else OFF — activated on demand ──
  'news':               false,
  'social-posts':       false,
  'social-hub':         false,
  'merchandise':        false,
  'smart-merch':        false,
  'art-gallery':        false,
  'vinyl-records':      false,
  'vinyl-editions':     false,
  'downloads':          false,
  'tokenization':       false,
  'monetize-cta':       false,
  'analytics':          false,
  'earnings':           false,
  'crowdfunding':       false,
  'sponsors':           false,
  'venueBooking':       false,
  'explicit-content':   false,
  'aas-engine':         false,
  'audience-engine':    false,
  'viral-products':     false,
  'brand-collabs':      false,
  'business-plan':      false,
  'influencer-module':  false,
  'amazon-picks':       false,
  'career-suite':       false,
  'artist-blueprint':   false,
  'emotional-studio':   false,
  'artist-domain':      false,
  'electronic-press-kit': false,
  'agent-gateway':      false,
  'hologram':           false,
  'talk-to-me':         false,
  'whatsapp-command-center': false,
  'telegram-command-center': false,
  'facebook-groups-command-center': false,
  'reddit-intelligence-center': false,
  'discord-fan-nation': false,
  'ads-campaigns':      false,
  'gamma-presentations': false,
  'renaissance-studio': false,
  'observation-engine': false,
  'deep-brief':         false,
  'promo-clips':        false,
  'ai-video-studio':    false,
  'lyrics-video':       false,
  'avatar-talk':        false,
  'hermes-agent':       false,
  'my-universe':        false,
  // Right-column widgets — match defaultRightVisibility in artist-profile-card.tsx
  'qr-card':            true,
  'physical-cards':     true,
  'statistics':         true,
  'tokenized-music':    true,
  'information':        true,
  'social-media':       true,
  'spotify':            true,
  'premium-tools':      true,
  'upcoming-shows':     true,
  'economic-engine':    true,
  'crypto-community':   true,
};

const MODULE_DEFS: Record<string, ModuleDef> = {
  // ── MUSIC ──────────────────────────────────────────────────────────
  'songs':              { name: 'Music',               category: 'MUSIC',      color: '#3b82f6', isOwnerOnly: false },
  'videos':             { name: 'Videos',              category: 'MUSIC',      color: '#3b82f6', isOwnerOnly: false },
  'karaoke':            { name: 'Karaoke',             category: 'MUSIC',      color: '#3b82f6', isOwnerOnly: false },
  'lyrics-video':       { name: 'Lyrics Video',        category: 'MUSIC',      color: '#7c3aed', isOwnerOnly: true  },
  'avatar-talk':        { name: 'Avatar Talk',         category: 'MUSIC',      color: '#a855f7', isOwnerOnly: false },
  'promo-clips':        { name: 'Promo Clips',         category: 'MUSIC',      color: '#3b82f6', isOwnerOnly: true  },
  'ai-video-studio':    { name: 'AI Video Studio',     category: 'MUSIC',      color: '#3b82f6', isOwnerOnly: true  },
  'galleries':          { name: 'Image Galleries',     category: 'MUSIC',      color: '#3b82f6', isOwnerOnly: false },
  'downloads':          { name: 'Downloads',           category: 'MUSIC',      color: '#3b82f6', isOwnerOnly: false },

  // ── SOCIAL ─────────────────────────────────────────────────────────
  'fanclub':            { name: 'Fan Club',            category: 'SOCIAL',     color: '#22d3ee', isOwnerOnly: false },
  'social-hub':         { name: 'Broadcast Studio',    category: 'SOCIAL',     color: '#22d3ee', isOwnerOnly: false },
  'social-posts':       { name: 'Social Posts',        category: 'SOCIAL',     color: '#22d3ee', isOwnerOnly: false },
  'news':               { name: 'News',                category: 'SOCIAL',     color: '#22d3ee', isOwnerOnly: false },
  'explicit-content':   { name: 'Inner Circle',        category: 'SOCIAL',     color: '#22d3ee', isOwnerOnly: false },

  // ── COMMERCE ───────────────────────────────────────────────────────
  'merchandise':        { name: 'Merchandise',         category: 'COMMERCE',   color: '#f97316', isOwnerOnly: false },
  'fashion-store':      { name: 'Fashion Store',       category: 'COMMERCE',   color: '#f97316', isOwnerOnly: false },
  'smart-merch':        { name: 'Smart Merch',         category: 'COMMERCE',   color: '#f97316', isOwnerOnly: false },
  'art-gallery':        { name: 'Art Gallery',         category: 'COMMERCE',   color: '#f97316', isOwnerOnly: false },
  'vinyl-records':      { name: 'Vinyl Records',       category: 'COMMERCE',   color: '#f97316', isOwnerOnly: false },
  'vinyl-editions':     { name: 'Vinyl Tokens',        category: 'COMMERCE',   color: '#f97316', isOwnerOnly: true  },
  'amazon-picks':       { name: 'Amazon Picks',        category: 'COMMERCE',   color: '#f97316', isOwnerOnly: false },
  'tokenization':       { name: 'Token Assets',        category: 'COMMERCE',   color: '#f97316', isOwnerOnly: true  },
  'monetize-cta':       { name: 'Monetize Talent',     category: 'COMMERCE',   color: '#f97316', isOwnerOnly: false },

  // ── MONETIZE ───────────────────────────────────────────────────────
  'earnings':           { name: 'Earnings',            category: 'MONETIZE',   color: '#10b981', isOwnerOnly: true  },
  'crowdfunding':       { name: 'Crowdfunding',        category: 'MONETIZE',   color: '#10b981', isOwnerOnly: true  },
  'sponsors':           { name: 'Sponsor Acquisition', category: 'MONETIZE',   color: '#10b981', isOwnerOnly: true  },
  'venueBooking':       { name: 'Venue Booking',       category: 'MONETIZE',   color: '#10b981', isOwnerOnly: true  },

  // ── GROWTH ─────────────────────────────────────────────────────────
  'analytics':          { name: 'Observatory',         category: 'GROWTH',     color: '#a78bfa', isOwnerOnly: true  },
  'aas-engine':         { name: 'Genesis Engine',      category: 'GROWTH',     color: '#a78bfa', isOwnerOnly: true  },
  'audience-engine':    { name: 'Signal Pulse',        category: 'GROWTH',     color: '#a78bfa', isOwnerOnly: true  },
  'influencer-module':  { name: 'Amplify Network',     category: 'GROWTH',     color: '#a78bfa', isOwnerOnly: true  },
  'viral-products':     { name: 'Ecosystem Drops',     category: 'GROWTH',     color: '#a78bfa', isOwnerOnly: true  },
  'ads-campaigns':      { name: 'Ads Campaign Manager', category: 'GROWTH',    color: '#a78bfa', isOwnerOnly: true  },

  // ── BUSINESS ───────────────────────────────────────────────────────
  'business-plan':      { name: 'Commerce Blueprint',  category: 'BUSINESS',   color: '#f59e0b', isOwnerOnly: false },
  'career-suite':       { name: 'The Atelier',         category: 'BUSINESS',   color: '#f59e0b', isOwnerOnly: true  },
  'artist-blueprint':   { name: 'Superstar Blueprint',        category: 'BUSINESS',   color: '#f59e0b', isOwnerOnly: false },
  'brand-collabs':      { name: 'The Forge',           category: 'BUSINESS',   color: '#f59e0b', isOwnerOnly: true  },
  'observation-engine': { name: 'Observation Engine',  category: 'BUSINESS',   color: '#f59e0b', isOwnerOnly: true  },
  'deep-brief':         { name: 'Deep Brief',          category: 'BUSINESS',   color: '#f59e0b', isOwnerOnly: true  },

  // ── IDENTITY ───────────────────────────────────────────────────────
  'electronic-press-kit': { name: 'Press Room',        category: 'IDENTITY',   color: '#ec4899', isOwnerOnly: false },
  'agent-gateway':      { name: 'The Gateway',         category: 'IDENTITY',   color: '#ec4899', isOwnerOnly: false },
  'hermes-agent':       { name: 'The Codex',           category: 'IDENTITY',   color: '#ec4899', isOwnerOnly: true  },
  'artist-domain':      { name: 'My Domain',           category: 'IDENTITY',   color: '#ec4899', isOwnerOnly: true  },

  // ── CREATIVE ───────────────────────────────────────────────────────
  'renaissance-studio': { name: 'Renaissance Studio',  category: 'CREATIVE',   color: '#8b5cf6', isOwnerOnly: false },
  'hologram':           { name: 'HoloStage Live',      category: 'CREATIVE',   color: '#8b5cf6', isOwnerOnly: false },
  'talk-to-me':         { name: 'Talk To Me',          category: 'CREATIVE',   color: '#8b5cf6', isOwnerOnly: false },
  'emotional-studio':   { name: 'Emotional Studio',    category: 'CREATIVE',   color: '#8b5cf6', isOwnerOnly: true  },
  'gamma-presentations': { name: 'Gamma Presentations', category: 'CREATIVE',  color: '#8b5cf6', isOwnerOnly: true  },
  'my-universe':        { name: 'My Universe',         category: 'CREATIVE',   color: '#8b5cf6', isOwnerOnly: false },

  // ── RIGHT-COLUMN WIDGETS ─────────────────────────────────────────────────
  'qr-card':            { name: 'Artist QR Card',      category: 'WIDGET',     color: '#06b6d4', isOwnerOnly: false },
  'physical-cards':     { name: 'Physical Cards',      category: 'WIDGET',     color: '#06b6d4', isOwnerOnly: false },
  'statistics':         { name: 'Profile Statistics',  category: 'WIDGET',     color: '#06b6d4', isOwnerOnly: false },
  'tokenized-music':    { name: 'Tokenized Music',     category: 'WIDGET',     color: '#06b6d4', isOwnerOnly: false },
  'information':        { name: 'Information',         category: 'WIDGET',     color: '#06b6d4', isOwnerOnly: false },
  'social-media':       { name: 'Social Media',        category: 'WIDGET',     color: '#06b6d4', isOwnerOnly: false },
  'spotify':            { name: 'Spotify',             category: 'WIDGET',     color: '#06b6d4', isOwnerOnly: false },
  'premium-tools':      { name: 'Premium Tools',       category: 'WIDGET',     color: '#06b6d4', isOwnerOnly: true  },
  'upcoming-shows':     { name: 'Upcoming Shows',      category: 'WIDGET',     color: '#06b6d4', isOwnerOnly: false },
  'economic-engine':    { name: 'Revenue Engine',      category: 'WIDGET',     color: '#06b6d4', isOwnerOnly: false },
  'crypto-community':   { name: 'Crypto Community',    category: 'WIDGET',     color: '#06b6d4', isOwnerOnly: false },
};

// Category column layout — each category maps to a logical x-column index.
// Within-category stacking uses a per-category row counter.
// Columns are kept compact so edges stay short.
const CATEGORY_COLUMNS: Record<string, number> = {
  MUSIC:    0,
  SOCIAL:   1,
  COMMERCE: 2,
  MONETIZE: 3,
  GROWTH:   4,
  BUSINESS: 5,
  IDENTITY: 6,
  CREATIVE: 7,
  WIDGET:   8,
};

const COL_WIDTH  = 240;  // reduced from 280 → less horizontal spread
const ROW_HEIGHT = 250;  // reduced from 320 → more compact
const HEADER_Y   = 60;

// ─── Edge definitions: [source, target] ─────────────────────────────────────
// Only include edges between same-area nodes to avoid long cross-canvas wires.
// Widget ↔ non-widget edges are excluded — they would span the full canvas width.

const MODULE_EDGES: [string, string][] = [
  // MUSIC flow
  ['songs', 'karaoke'],
  ['songs', 'lyrics-video'],
  ['songs', 'avatar-talk'],
  ['songs', 'promo-clips'],
  ['songs', 'downloads'],
  ['songs', 'tokenization'],
  ['songs', 'social-posts'],
  ['songs', 'vinyl-records'],
  ['videos', 'social-posts'],
  ['videos', 'ai-video-studio'],
  ['lyrics-video', 'promo-clips'],
  ['lyrics-video', 'avatar-talk'],
  ['lyrics-video', 'ads-campaigns'],
  ['promo-clips', 'ads-campaigns'],
  ['avatar-talk', 'ads-campaigns'],
  ['ai-video-studio', 'promo-clips'],
  ['ai-video-studio', 'ads-campaigns'],
  // SOCIAL flow
  ['social-hub', 'social-posts'],
  ['social-hub', 'news'],
  ['songs', 'fanclub'],
  ['fanclub', 'explicit-content'],
  // COMMERCE / MONETIZE flow
  ['merchandise', 'fashion-store'],
  ['fashion-store', 'smart-merch'],
  ['merchandise', 'smart-merch'],
  ['art-gallery', 'merchandise'],
  ['vinyl-records', 'vinyl-editions'],
  ['merchandise', 'earnings'],
  ['fashion-store', 'earnings'],
  ['smart-merch', 'earnings'],
  ['vinyl-editions', 'earnings'],
  ['tokenization', 'earnings'],
  ['crowdfunding', 'earnings'],
  // GROWTH flow
  ['analytics', 'aas-engine'],
  ['aas-engine', 'audience-engine'],
  ['audience-engine', 'influencer-module'],
  ['analytics', 'earnings'],
  // BUSINESS flow
  ['business-plan', 'career-suite'],
  ['career-suite', 'artist-blueprint'],
  ['artist-blueprint', 'brand-collabs'],
  // IDENTITY flow
  ['electronic-press-kit', 'agent-gateway'],
  ['agent-gateway', 'hermes-agent'],
  // CREATIVE flow
  ['renaissance-studio', 'hologram'],
  ['renaissance-studio', 'talk-to-me'],
  ['renaissance-studio', 'my-universe'],
  ['artist-blueprint', 'gamma-presentations'],
  ['business-plan', 'gamma-presentations'],
  ['agent-gateway', 'talk-to-me'],
  ['talk-to-me', 'avatar-talk'],
  ['talk-to-me', 'promo-clips'],
  ['talk-to-me', 'ads-campaigns'],
  // Analysis chain
  ['observation-engine', 'analytics'],
  ['deep-brief', 'business-plan'],
  // WIDGET-only edges (within the widget column)
  ['information', 'qr-card'],
  ['qr-card', 'physical-cards'],
];

// ─── Hook ────────────────────────────────────────────────────────────────────

export interface InactiveModule {
  moduleId: string;
  moduleName: string;
  categoryLabel: string;
  categoryColor: string;
  isOwnerOnly: boolean;
}

export interface ProfileLayoutHook {
  profileNodes: Node<ProfileModuleData>[];
  profileEdges: Edge[];
  inactiveModules: InactiveModule[];
  isLoading: boolean;
  dataSource: 'api' | 'firestore' | 'default';
  toggleVisibility: (moduleId: string, visible: boolean) => Promise<void>;
  activateModule: (moduleId: string) => Promise<void>;
  /** Activate all modules in the given list (for profile presets) */
  activateModules: (moduleIds: string[]) => Promise<void>;
  saveNote: (moduleId: string, text: string) => void;
  resetPositions: () => void;
}

// ─── Notes stored in localStorage ────────────────────────────────────────────

function notesKey(slug: string) { return `boostify_node_notes_${slug}`; }

function loadNotes(slug: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(notesKey(slug)) ?? '{}');
  } catch { return {}; }
}

function persistNotes(slug: string, notes: Record<string, string>) {
  try { localStorage.setItem(notesKey(slug), JSON.stringify(notes)); } catch { /* noop */ }
}

export function useProfileLayout(
  artistId: string | number | null,
  artistSlug: string | null
): ProfileLayoutHook {
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [rawLayout, setRawLayout] = useState<any>(null);
  const [artistData, setArtistData] = useState<any>(null);
  const [firestoreData, setFirestoreData] = useState<{ songs: any[]; videos: any[]; merch: any[] } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dataSource, setDataSource] = useState<'api' | 'firestore' | 'default'>('default');
  const [notes, setNotes] = useState<Record<string, string>>(() => loadNotes(artistSlug ?? ''));
  const [layoutVersion, setLayoutVersion] = useState(0);
  const isMounted = useRef(true);

  // ── Firestore direct fetch — mirrors exact strategy of artist-profile-card ──
  const fetchFromFirestore = useCallback(async (
    slug: string,
    pgId?: string | number | null,
    firestoreId?: string | null,   // Firebase UID / Firestore artist ID
    username?: string | null,       // PG username column = Firebase UID
  ) => {
    try {
      const songsRef = collection(db, 'songs');
      const videosRef = collection(db, 'videos');
      const seenSongIds = new Set<string>();
      const seenVideoIds = new Set<string>();
      let foundSongs: any[] = [];
      let foundVideos: any[] = [];

      const addSongs = (docs: any[]) => {
        for (const d of docs) {
          if (!seenSongIds.has(d.id)) { seenSongIds.add(d.id); foundSongs.push(d); }
        }
      };
      const addVideos = (docs: any[]) => {
        for (const d of docs) {
          if (!seenVideoIds.has(d.id)) { seenVideoIds.add(d.id); foundVideos.push(d); }
        }
      };

      // The primary Firestore ID used to store songs is `artistId`.
      // artist-profile-card resolves it as: firestoreId ?? artistId (slug fallback)
      const primaryFsId = firestoreId || username || slug;

      // ── SONGS strategies (order mirrors artist-profile-card.tsx) ─────────────
      // 1. artistId == primaryFsId  (primary strategy)
      try {
        const snap = await getDocs(query(songsRef, where('artistId', '==', primaryFsId)));
        addSongs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { /* skip */ }

      // 2. userId == pgId (number) — AI-generated artists
      if (pgId) {
        const pgNum = Number(pgId);
        if (!isNaN(pgNum) && pgNum > 0) {
          try {
            const snap = await getDocs(query(songsRef, where('userId', '==', pgNum)));
            addSongs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch { /* skip */ }
        }
        // 3. userId == pgId (string)
        try {
          const snap = await getDocs(query(songsRef, where('userId', '==', String(pgId))));
          addSongs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch { /* skip */ }
      }

      // 4. userId == firestoreId / username (legacy uploads)
      if (firestoreId && firestoreId !== String(pgId) && firestoreId !== slug) {
        try {
          const snap = await getDocs(query(songsRef, where('userId', '==', firestoreId)));
          addSongs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch { /* skip */ }
      }
      if (username && username !== String(pgId) && username !== firestoreId) {
        try {
          const snap = await getDocs(query(songsRef, where('userId', '==', username)));
          addSongs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch { /* skip */ }
      }

      // 5. userId == slug (legacy)
      if (slug) {
        try {
          const snap = await getDocs(query(songsRef, where('userId', '==', slug)));
          addSongs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch { /* skip */ }
      }

      // ── VIDEOS strategies (mirrors artist-profile-card.tsx) ────────────────
      // 0. artistId == primaryFsId (primary — same field as songs)
      try {
        const snap = await getDocs(query(videosRef, where('artistId', '==', primaryFsId)));
        addVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { /* skip */ }
      if (pgId) {
        const pgNum = Number(pgId);
        if (!isNaN(pgNum) && pgNum > 0) {
          try {
            const snap = await getDocs(query(videosRef, where('userId', '==', pgNum)));
            addVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch { /* skip */ }
        }
        try {
          const snap = await getDocs(query(videosRef, where('userId', '==', String(pgId))));
          addVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch { /* skip */ }
      }
      if (firestoreId && firestoreId !== String(pgId)) {
        try {
          const snap = await getDocs(query(videosRef, where('userId', '==', firestoreId)));
          addVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch { /* skip */ }
      }
      if (username && username !== String(pgId) && username !== firestoreId) {
        try {
          const snap = await getDocs(query(videosRef, where('userId', '==', username)));
          addVideos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch { /* skip */ }
      }

      return { songs: foundSongs, videos: foundVideos, merch: [] };
    } catch (e) {
      return null;
    }
  }, []);

  // ── API fetch ───────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    if (!artistSlug) return;
    setIsLoading(true);
    setNotes(loadNotes(artistSlug));

    fetch(`/api/profile/${artistSlug}`)
      .then(r => r.ok ? r.json() : null)
      .then(async data => {
        if (!isMounted.current) return;
        // API failed or artist not found — fall back to defaults then try Firestore
        if (!data) {
          setVisibility({ ...DEFAULT_VISIBILITY });
          setSectionOrder(Object.keys(MODULE_DEFS));
          // Try Firestore direct
          const fsData = await fetchFromFirestore(artistSlug!, null);
          if (isMounted.current && fsData) {
            setFirestoreData(fsData);
            if (fsData.songs.length > 0 || fsData.videos.length > 0) {
              setDataSource('firestore');
            } else {
              setDataSource('default');
            }
          }
          return;
        }
        setArtistData(data);
        setDataSource('api');
        const layout = data.profileLayout ?? null;
        setRawLayout(layout);

        const savedVis =
          layout?.visibility && typeof layout.visibility === 'object' && !Array.isArray(layout.visibility)
            ? layout.visibility as Record<string, boolean>
            : {};
        setVisibility({ ...DEFAULT_VISIBILITY, ...savedVis });

        if (Array.isArray(layout?.order) && layout.order.length > 0) {
          setSectionOrder(layout.order);
        } else {
          setSectionOrder(Object.keys(MODULE_DEFS));
        }

        // Always try Firestore to supplement or replace empty API data
        // Pass firestoreId and username (Firebase UID) for the best query coverage
        const fsData = await fetchFromFirestore(
          artistSlug!,
          data.id ?? data.pgId,
          data.firestoreId ?? null,
          data.username ?? null,
        );
        if (isMounted.current && fsData && (fsData.songs.length > 0 || fsData.videos.length > 0)) {
          setFirestoreData(fsData);
          // If API returned no songs/videos, mark source as Firestore
          if ((data.songs ?? []).length === 0 && (data.videos ?? []).length === 0) {
            setDataSource('firestore');
          }
        }
      })
      .catch(async () => {
        if (!isMounted.current) return;
        setVisibility({ ...DEFAULT_VISIBILITY });
        setSectionOrder(Object.keys(MODULE_DEFS));
        // Try Firestore even on network error
        const fsData = await fetchFromFirestore(artistSlug!, null);
        if (isMounted.current && fsData) {
          setFirestoreData(fsData);
          setDataSource(fsData.songs.length > 0 ? 'firestore' : 'default');
        }
      })
      .finally(() => {
        if (isMounted.current) setIsLoading(false);
      });
    return () => { isMounted.current = false; };
  }, [artistSlug]);

  // Shared persist helper — newOrder is optional; defaults to current sectionOrder
  const persistLayout = useCallback(async (newVis: Record<string, boolean>, newOrder?: string[]) => {
    if (!artistId) return;
    try {
      await fetch(`/api/profile/${artistId}/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          order: newOrder ?? rawLayout?.order ?? sectionOrder,
          visibility: newVis,
          expanded: rawLayout?.expanded ?? {},
          rightOrder: rawLayout?.rightOrder ?? [],
          rightVisibility: rawLayout?.rightVisibility ?? {},
          rightExpanded: rawLayout?.rightExpanded ?? {},
          colorTheme: rawLayout?.colorTheme ?? null,
          customBlocks: rawLayout?.customBlocks ?? {},
          mobileColumnFirst: rawLayout?.mobileColumnFirst ?? 'left',
        }),
      });
    } catch (e) {
      console.error('[useProfileLayout] Failed to persist layout', e);
    }
  }, [artistId, rawLayout, sectionOrder]);

  // Toggle visibility (eye button on node)
  const toggleVisibility = useCallback(async (moduleId: string, visible: boolean) => {
    const newVis = { ...visibility, [moduleId]: visible };
    setVisibility(newVis);
    await persistLayout(newVis);
  }, [visibility, persistLayout]);

  // Activate a hidden module (from the InactiveModulesPanel)
  const activateModule = useCallback(async (moduleId: string) => {
    await toggleVisibility(moduleId, true);
  }, [toggleVisibility]);

  // Activate a batch of modules at once (for profile presets)
  const activateModules = useCallback(async (moduleIds: string[]) => {
    const newVis = { ...visibility };
    moduleIds.forEach(id => { if (MODULE_DEFS[id]) newVis[id] = true; });
    setVisibility(newVis);
    await persistLayout(newVis);
  }, [visibility, persistLayout]);

  // Reorder modules based on a canvas connection: move sourceModuleId immediately before targetModuleId
  const reorderModulesFromEdge = useCallback(async (sourceModuleId: string, targetModuleId: string) => {
    if (!MODULE_DEFS[sourceModuleId] || !MODULE_DEFS[targetModuleId]) return;
    const newOrder = [...sectionOrder];
    const sourceIdx = newOrder.indexOf(sourceModuleId);
    const targetIdx = newOrder.indexOf(targetModuleId);
    // Already in correct order — nothing to do
    if (sourceIdx !== -1 && targetIdx !== -1 && sourceIdx < targetIdx) return;
    // Remove source from its current position
    const src = sourceIdx !== -1 ? newOrder.splice(sourceIdx, 1)[0] : sourceModuleId;
    // Insert just before target
    const insertAt = newOrder.indexOf(targetModuleId);
    if (insertAt !== -1) {
      newOrder.splice(insertAt, 0, src);
    } else {
      newOrder.push(src);
    }
    setSectionOrder(newOrder);
    await persistLayout(visibility, newOrder);
  }, [sectionOrder, visibility, persistLayout]);

  // Save a per-module note/prompt in localStorage
  const saveNote = useCallback((moduleId: string, text: string) => {
    if (!artistSlug) return;
    const updated = { ...notes, [moduleId]: text };
    setNotes(updated);
    persistNotes(artistSlug, updated);
  }, [notes, artistSlug]);

  // Trigger auto-layout re-position (increments version so nodes get fresh positions)
  const resetPositions = useCallback(() => {
    setLayoutVersion(v => v + 1);
  }, []);

  // Merge API data with Firestore, preferring API records but adding unique Firestore ones
  const apiSongs: any[] = artistData?.songs ?? [];
  const apiVideos: any[] = artistData?.videos ?? [];
  const apiMerch: any[] = artistData?.merchandise ?? [];

  // Deduplicate by normalised title — add FS items not already in API list
  function mergeByTitle(api: any[], fs: any[]): any[] {
    if (!fs.length) return api;
    const seen = new Set(api.map(x => (x.title ?? x.name ?? '').toLowerCase().trim()));
    const extras = fs.filter(x => !seen.has((x.title ?? x.name ?? '').toLowerCase().trim()));
    return [...api, ...extras];
  }

  const songs  = mergeByTitle(apiSongs,  firestoreData?.songs  ?? []);
  const videos = mergeByTitle(apiVideos, firestoreData?.videos ?? []);
  const merch  = apiMerch.length > 0 ? apiMerch : (firestoreData?.merch ?? []);

  const socialHandles = [
    artistData?.instagramHandle && { platform: 'Instagram', handle: artistData.instagramHandle },
    artistData?.twitterHandle && { platform: 'X/Twitter', handle: artistData.twitterHandle },
    artistData?.youtubeChannel && { platform: 'YouTube', handle: artistData.youtubeChannel },
  ].filter(Boolean) as { platform: string; handle: string }[];

  const apiOffline = dataSource === 'default';

  // Build canvas nodes — only ACTIVE (visible) modules appear on canvas
  // layoutVersion is included in deps so nodes reset position when resetPositions() is called
  const profileNodes = (() => {
    const colCounters: Record<string, number> = {};
    const nodes: Node<ProfileModuleData>[] = [];

    const orderedIds = [
      ...sectionOrder.filter(id => MODULE_DEFS[id]),
      ...Object.keys(MODULE_DEFS).filter(id => !sectionOrder.includes(id)),
    ];

    orderedIds.forEach(id => {
      const def = MODULE_DEFS[id];
      if (!def) return;
      const isVis = visibility[id] ?? false;
      if (!isVis) return;

      const colIdx = CATEGORY_COLUMNS[def.category] ?? 0;
      const rowIdx = colCounters[def.category] ?? 0;
      colCounters[def.category] = rowIdx + 1;

      nodes.push({
        id: `pm-${id}-${layoutVersion}`,
        type: 'profileModule',
        position: {
          x: colIdx * COL_WIDTH + 40,
          y: HEADER_Y + rowIdx * ROW_HEIGHT,
        },
        data: {
          moduleId: id,
          moduleName: def.name,
          categoryLabel: def.category,
          categoryColor: def.color,
          isVisible: true,
          isOwnerOnly: def.isOwnerOnly,
          artistId,
          artistSlug,
          dataSource,
          apiOffline,
          noteText: notes[id] ?? '',
          onSaveNote: saveNote,
          // Stats
          songCount: songs.length,
          videoCount: videos.length,
          merchCount: merch.length,
          topSong: songs[0]?.title ?? songs[0]?.name ?? undefined,
          latestVideo: videos[0]?.title ?? videos[0]?.name ?? undefined,
          socialHandles,
          // Full arrays for rich node panels
          songs: songs.slice(0, 8).map((s: any) => ({
            id: s.id ?? s.firestoreId ?? String(Math.random()),
            title: s.title ?? s.name ?? 'Untitled',
            genre: s.genre ?? undefined,
            duration: s.duration ?? undefined,
          })),
          videos: videos.slice(0, 6).map((v: any) => ({
            id: v.id ?? v.firestoreId ?? String(Math.random()),
            title: v.title ?? v.name ?? 'Untitled',
            platform: v.platform ?? v.source ?? undefined,
          })),
          merchandise: merch.slice(0, 6).map((m: any) => ({
            id: m.id ?? String(Math.random()),
            name: m.name ?? m.title ?? 'Product',
            price: m.price ?? m.retailPrice ?? undefined,
            currency: m.currency ?? 'USD',
          })),
          onToggleVisibility: toggleVisibility,
        },
        draggable: true,
      });
    });

    return nodes;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })();

  // ── Agent Command Node — positioned below profileRootNode (x=-360) so it's
  // always inside the canvas bounding box and never clipped by the toolbar ────
  const agentNode: Node = {
    id: `agent-command-${layoutVersion}`,
    type: 'agentCommand',
    position: { x: -360, y: 370 },
    style: { background: 'transparent', border: 'none', padding: 0, boxShadow: 'none' },
    data: {
      artistSlug,
      artistId,
      artistName: artistData?.artistName ?? artistSlug,
    },
    draggable: true,
  };

  const allProfileNodes = [agentNode, ...profileNodes];

  // Inactive modules for the left panel
  const inactiveModules: InactiveModule[] = Object.entries(MODULE_DEFS)
    .filter(([id]) => !(visibility[id] ?? false))
    .map(([id, def]) => ({
      moduleId: id,
      moduleName: def.name,
      categoryLabel: def.category,
      categoryColor: def.color,
      isOwnerOnly: def.isOwnerOnly,
    }));

  // Build edges only between ACTIVE nodes — use base moduleId without version suffix
  const activeIds = new Set(Object.keys(MODULE_DEFS).filter(id => visibility[id] ?? false));
  const profileEdges: Edge[] = MODULE_EDGES
    .filter(([s, t]) => activeIds.has(s) && activeIds.has(t))
    .map(([s, t]) => ({
      id: `pm-edge-${s}-${t}-${layoutVersion}`,
      source: `pm-${s}-${layoutVersion}`,
      target: `pm-${t}-${layoutVersion}`,
      type: 'animated',
      style: { stroke: MODULE_DEFS[s].color, strokeWidth: 1.5, strokeOpacity: 0.5 },
    }));

  return {
    profileNodes: allProfileNodes,
    profileEdges,
    inactiveModules,
    isLoading,
    dataSource,
    toggleVisibility,
    activateModule,
    activateModules,
    reorderModulesFromEdge,
    saveNote,
    resetPositions,
  };
}
