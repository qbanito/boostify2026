/**
 * My Universe Module
 *
 * Panel shown on an artist's own profile page that lets them:
 *  - Toggle which of their artists are visible in the public landing page
 *  - Copy / open the public universe URL
 *  - Jump straight to the landing page
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Globe, Lock, Eye, EyeOff, Check, Copy, ExternalLink,
  Sparkles, ChevronDown, ChevronUp, Crown, X, Loader2,
  Disc3, Music,
} from "lucide-react";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest } from "../../lib/queryClient";

interface MyUniverseModuleProps {
  ownerPgId: number;
  isOwnProfile?: boolean;
}

interface ArtistEntry {
  id: number;
  artistName: string | null;
  name: string | null;
  slug: string | null;
  profileImage: string | null;
  genres: string[] | null;
}

interface UniverseSettings {
  visibleArtistIds: number[];
  isPublic: boolean;
  title: string;
  bio: string;
  theme: string;
}

function displayName(a: ArtistEntry) {
  return a.artistName || a.name || `Artist #${a.id}`;
}

// ── Orbiting disc wheel (artist's releases spinning around the avatar) ──
function UniverseDiscWheel({ ownerPgId, onOpen }: { ownerPgId: number; onOpen: () => void }) {
  const { data } = useQuery<{
    success: boolean;
    owner: { id: number; artistName: string | null; profileImage: string | null } | null;
    artists: { id: number; artistName: string | null; name: string | null; profileImage: string | null; coverImage?: string | null }[];
    discography: { id: number; title: string; coverArt: string | null }[];
  }>({
    queryKey: [`/api/my-universe/public/${ownerPgId}`],
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const discs = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: number; title: string; cover: string }[] = [];
    for (const s of data?.discography || []) {
      if (!s.coverArt || seen.has(s.coverArt)) continue;
      seen.add(s.coverArt);
      out.push({ id: s.id, title: s.title, cover: s.coverArt });
      if (out.length >= 10) break;
    }
    return out;
  }, [data?.discography]);

  if (!data?.success || discs.length === 0) return null;

  const centerImg =
    data.owner?.profileImage ||
    data.artists?.[0]?.profileImage ||
    data.artists?.[0]?.coverImage ||
    null;
  const totalSongs = data.discography.length;

  const SIZE = 280;          // wheel box
  const DISC = 48;           // disc diameter
  const R = SIZE / 2 - DISC / 2 - 6; // orbit radius
  const ORBIT_DURATION = 36; // seconds per full orbit

  return (
    <div className="flex flex-col items-center px-4 pb-4 pt-5">
      <motion.button
        type="button"
        onClick={onOpen}
        aria-label="Open My Universe"
        className="relative block cursor-pointer"
        style={{ width: SIZE, height: SIZE }}
        whileHover={{ scale: 1.03 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
      >
        {/* Radial glow */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(168,85,247,0.28) 0%, rgba(217,70,239,0.12) 45%, transparent 72%)",
            filter: "blur(8px)",
          }}
        />

        {/* Dashed orbit track */}
        <div
          className="absolute rounded-full border border-dashed border-fuchsia-500/20 pointer-events-none"
          style={{ inset: SIZE / 2 - R - DISC / 2 + 6 }}
        />

        {/* Orbiting disc covers */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: ORBIT_DURATION, repeat: Infinity, ease: "linear" }}
        >
          {discs.map((d, i) => {
            const angle = (i / discs.length) * 2 * Math.PI;
            const cx = SIZE / 2 + R * Math.cos(angle);
            const cy = SIZE / 2 + R * Math.sin(angle);
            return (
              <div
                key={d.id}
                className="absolute"
                style={{ left: cx - DISC / 2, top: cy - DISC / 2, width: DISC, height: DISC }}
              >
                {/* Self-spin like a vinyl record (also counters orbit rotation) */}
                <motion.div
                  className="relative w-full h-full rounded-full overflow-hidden ring-2 ring-fuchsia-500/60 shadow-lg shadow-fuchsia-900/50 bg-black"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                >
                  <img
                    src={d.cover}
                    alt={d.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {/* Vinyl groove shading + center hole */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ boxShadow: "inset 0 0 8px rgba(0,0,0,0.65)" }}
                  />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-black ring-1 ring-white/40" />
                </motion.div>
              </div>
            );
          })}
        </motion.div>

        {/* Spinning conic gradient ring around the center */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            inset: SIZE / 2 - 56,
            background:
              "conic-gradient(from 0deg, #7c3aed 0%, #c026d3 30%, #ec4899 60%, #a855f7 80%, #7c3aed 100%)",
            padding: 3,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-full h-full rounded-full bg-[#0a0a14]" />
        </motion.div>

        {/* Center avatar */}
        <div
          className="absolute rounded-full overflow-hidden"
          style={{ inset: SIZE / 2 - 50 }}
        >
          {centerImg ? (
            <img src={centerImg} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-700 to-fuchsia-700 flex items-center justify-center">
              <Music className="w-7 h-7 text-white/80" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-center pb-1.5">
            <Globe className="w-3.5 h-3.5 text-white/90" />
          </div>
        </div>
      </motion.button>

      <p className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-500 uppercase tracking-widest">
        <Disc3 className="w-3 h-3 text-fuchsia-400" />
        {discs.length} release{discs.length !== 1 ? "s" : ""} orbiting · {totalSongs} song{totalSongs !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export function MyUniverseModule({ ownerPgId, isOwnProfile = false }: MyUniverseModuleProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [expanded, setExpanded] = useState(false);
  const [visibleIds, setVisibleIds] = useState<number[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [copied, setCopied] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load settings ────────────────────────────────────────────────
  const { data, isLoading } = useQuery<{
    success: boolean;
    settings: UniverseSettings;
    allArtists: ArtistEntry[];
    universeUrl: string;
  }>({
    queryKey: ["/api/my-universe/settings"],
    enabled: expanded,
  });

  // Use the URL returned by the API (which correctly resolves to the account owner ID).
  // Falls back to ownerPgId while data is still loading.
  const universeUrl = data?.universeUrl
    ? `${window.location.origin}${data.universeUrl}`
    : `${window.location.origin}/universe/${ownerPgId}`;

  useEffect(() => {
    if (data?.settings) {
      setVisibleIds(data.settings.visibleArtistIds || []);
      setIsPublic(data.settings.isPublic ?? true);
      setTitle(data.settings.title || "");
      setBio(data.settings.bio || "");
      setDirty(false);
    }
  }, [data?.settings]);

  // ── Save mutation ────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("PUT", "/api/my-universe/settings", {
        visibleArtistIds: visibleIds,
        isPublic,
        title,
        bio,
      });
    },
    onSuccess: () => {
      toast({ title: "Universe updated", description: "Your public page is live" });
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/my-universe/settings"] });
    },
    onError: (err: any) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleArtist = (id: number) => {
    const newIds = visibleIds.includes(id)
      ? visibleIds.filter((x) => x !== id)
      : [...visibleIds, id];
    setVisibleIds(newIds);
    setDirty(true);
    // Auto-save artist selection 700ms after last toggle
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setAutoSaving(true);
      try {
        await apiRequest("PUT", "/api/my-universe/settings", {
          visibleArtistIds: newIds,
          isPublic,
          title,
          bio,
        });
        setDirty(false);
        queryClient.invalidateQueries({ queryKey: ["/api/my-universe/settings"] });
      } catch { /* will still show dirty=true so user can retry */ }
      finally { setAutoSaving(false); }
    }, 700);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(universeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const allArtists: ArtistEntry[] = data?.allArtists || [];
  // "all visible" means empty array in the API (show all by default)
  const activeCount = visibleIds.length === 0 ? allArtists.length : visibleIds.length;

  // ── Visitor view (not the owner) ────────────────────────────────
  if (!isOwnProfile) {
    return (
      <div className="rounded-2xl border border-white/8 bg-[#0a0a14] overflow-hidden">
        <UniverseDiscWheel ownerPgId={ownerPgId} onOpen={() => setLocation(`/universe/${ownerPgId}`)} />
        <div className="flex items-center gap-3 p-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/20 shrink-0">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm">My Universe</p>
            <p className="text-[11px] text-zinc-500 truncate">Artist&apos;s full discography landing page</p>
          </div>
          <button
            onClick={() => setLocation(`/universe/${ownerPgId}`)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-white text-xs transition-opacity hover:opacity-90 shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7, #db2777)' }}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Visit Universe
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-[#0a0a14] overflow-hidden">
      {/* Orbiting disc wheel — artist's releases */}
      <UniverseDiscWheel ownerPgId={ownerPgId} onOpen={() => setLocation(`/universe/${ownerPgId}`)} />

      {/* Header / toggle button */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.03] transition-colors group"
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/20 shrink-0">
          <Globe className="w-5 h-5 text-white" />
        </div>

        <div className="text-left flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">My Universe</span>
            <Badge className="bg-fuchsia-600/20 text-fuchsia-300 border-fuchsia-500/30 text-[9px]">
              {isPublic ? "PUBLIC" : "PRIVATE"}
            </Badge>
          </div>
          <p className="text-[11px] text-zinc-500 truncate">
            {isLoading ? "Loading..." : `${activeCount} artist${activeCount !== 1 ? "s" : ""} · discography landing page`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-fuchsia-400 font-semibold hidden sm:block">
            {expanded ? "Close" : "Configure"}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      </button>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-5 space-y-5 border-t border-white/8 pt-4">

              {/* Link row */}
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    readOnly
                    value={universeUrl}
                    className="bg-white/5 border-white/10 text-zinc-300 text-xs pr-10 cursor-pointer h-9"
                    onClick={handleCopyLink}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyLink}
                  className="border-white/10 text-zinc-300 hover:bg-white/10 h-9 px-3 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setLocation(`/universe/${ownerPgId}`)}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white h-9 px-3 shrink-0 font-bold"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  Open
                </Button>
              </div>

              {/* Public / Private toggle */}
              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center gap-2.5">
                  {isPublic ? <Globe className="w-4 h-4 text-emerald-400" /> : <Lock className="w-4 h-4 text-zinc-500" />}
                  <div>
                    <p className="text-xs font-semibold text-white">{isPublic ? "Public Universe" : "Private Universe"}</p>
                    <p className="text-[11px] text-zinc-500">{isPublic ? "Anyone with the link can view" : "Only you can see this"}</p>
                  </div>
                </div>
                <Switch
                  checked={isPublic}
                  onCheckedChange={(v) => { setIsPublic(v); setDirty(true); }}
                />
              </div>

              {/* Title & bio */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-zinc-500 font-medium block mb-1">Page title <span className="text-zinc-600">(optional)</span></label>
                  <Input
                    value={title}
                    onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                    placeholder="e.g. My Music Universe"
                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 h-9 text-sm"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 font-medium block mb-1">Short bio <span className="text-zinc-600">(optional)</span></label>
                  <Textarea
                    value={bio}
                    onChange={(e) => { setBio(e.target.value); setDirty(true); }}
                    placeholder="Describe your universe..."
                    className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 text-sm resize-none min-h-[64px]"
                    maxLength={280}
                  />
                </div>
              </div>

              {/* Artist selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-widest">
                    Visible artists
                    <span className="ml-2 text-zinc-600 normal-case">(empty = show all)</span>
                  </p>
                  {autoSaving && (
                    <span className="flex items-center gap-1 text-[10px] text-fuchsia-400">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Connecting…
                    </span>
                  )}
                  {!autoSaving && !dirty && visibleIds.length > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                      <Check className="w-2.5 h-2.5" />
                      {visibleIds.length} connected
                    </span>
                  )}
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 text-fuchsia-400 animate-spin" />
                  </div>
                ) : allArtists.length === 0 ? (
                  <p className="text-xs text-zinc-600 py-3 text-center">No artists found in your account</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {allArtists.map((artist) => {
                      const selected = visibleIds.includes(artist.id);
                      const isConnected = selected && !dirty && !autoSaving;
                      return (
                        <button
                          key={artist.id}
                          onClick={() => toggleArtist(artist.id)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-left ${
                            selected
                              ? "border-fuchsia-500/50 bg-fuchsia-600/10"
                              : "border-white/8 bg-white/[0.02] hover:border-white/15"
                          }`}
                        >
                          <div className="relative shrink-0">
                            {artist.profileImage ? (
                              <img
                                src={artist.profileImage}
                                alt={displayName(artist)}
                                className="w-9 h-9 rounded-lg object-cover ring-1 ring-white/10"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center">
                                <Crown className="w-4 h-4 text-white" />
                              </div>
                            )}
                            {isConnected && (
                              <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border border-[#0a0a14] flex items-center justify-center">
                                <Check className="w-1.5 h-1.5 text-white" />
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{displayName(artist)}</p>
                            <p className="text-[10px] text-zinc-500 truncate">
                              {isConnected ? <span className="text-emerald-400/80">Connected to universe</span> : artist.genres?.slice(0, 2).join(", ") || "Artist"}
                            </p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                            selected
                              ? "bg-fuchsia-600 border-fuchsia-500"
                              : "border-white/20"
                          }`}>
                            {selected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Save button */}
              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || autoSaving || !dirty}
                  className={`flex-1 font-bold h-10 transition-all ${
                    dirty
                      ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90 text-white shadow-lg shadow-fuchsia-500/20"
                      : "bg-white/5 text-zinc-500 border border-white/10 cursor-not-allowed"
                  }`}
                >
                  {saveMutation.isPending || autoSaving ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{autoSaving ? "Auto-saving…" : "Saving…"}</>
                  ) : dirty ? (
                    <><Sparkles className="w-4 h-4 mr-2" />Save Universe</>
                  ) : (
                    <><Check className="w-4 h-4 mr-2 text-emerald-400" />Saved</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLocation(`/universe/${ownerPgId}`)}
                  className="border-white/10 text-zinc-300 hover:bg-white/10 h-10 px-4 shrink-0"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Preview
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
