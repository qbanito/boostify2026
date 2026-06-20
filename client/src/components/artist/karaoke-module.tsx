import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic2, Play, Sparkles, CheckCircle2, AlertCircle, Music,
  ChevronLeft, ChevronRight, Loader2, RotateCcw,
  Share2, X, Copy, Download, Check,
} from 'lucide-react';
import { KaraokePlayer } from './KaraokePlayer';
import type { KaraokeLine } from '@/hooks/use-karaoke-sync';
import { apiRequest } from '@/lib/queryClient';
import { getAuthToken } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface Song {
  id: number | string;
  title: string;
  audioUrl: string;
  coverArt?: string;
  duration?: string;
  genre?: string;
  lyrics?: string;
}

interface KaraokeModuleProps {
  songs: Song[];
  artistName: string;
  artistProfileImage?: string;
  isOwnProfile: boolean;
  /** ID of the song currently playing in the main audio player — auto-navigates carousel */
  currentlyPlayingSongId?: string | null;
}

// ── Animated equalizer / wave bars ───────────────────────────────────────────
const WAVE_BARS = [0.45, 0.7, 1, 0.82, 0.6, 0.9, 0.55, 0.75, 0.95, 0.65, 0.85, 0.5];
const BAR_DELAYS = [0, 0.18, 0.06, 0.28, 0.12, 0.34, 0.08, 0.22, 0.04, 0.30, 0.16, 0.26];

function WaveBars({ active, color = '#a855f7' }: { active: boolean; color?: string }) {
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 28 }}>
      {WAVE_BARS.map((base, i) => (
        <motion.div
          key={i}
          className="rounded-full flex-shrink-0"
          style={{ width: 3, background: color, opacity: active ? 0.85 : 0.22 }}
          animate={active ? {
            height: [
              `${base * 28 * 0.35}px`,
              `${base * 28}px`,
              `${base * 28 * 0.55}px`,
              `${base * 28 * 0.9}px`,
              `${base * 28 * 0.35}px`,
            ],
          } : { height: `${base * 28 * 0.18}px` }}
          transition={active ? {
            duration: 1.05 + i * 0.04,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: BAR_DELAYS[i],
          } : { duration: 0.4 }}
        />
      ))}
    </div>
  );
}

type KaraokeStatus = 'unknown' | 'ready' | 'pending' | 'processing' | 'failed';

const SLIDE_VARIANTS = {
  enter: (dir: number) => ({ x: dir > 0 ? 280 : -280, opacity: 0, scale: 0.92 }),
  center: { x: 0, opacity: 1, scale: 1, transition: { duration: 0.38, ease: [0.32, 0.72, 0, 1] } },
  exit: (dir: number) => ({ x: dir > 0 ? -280 : 280, opacity: 0, scale: 0.92, transition: { duration: 0.28 } }),
};

// ── Canvas share-card generator ───────────────────────────────────────────────
async function generateShareCard(
  song: Song,
  artistName: string,
  artistProfileImage?: string,
): Promise<void> {
  const SIZE = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  const loadImg = (src: string): Promise<HTMLImageElement> =>
    new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('load failed'));
      img.src = src;
    });

  // rounded rect helper (ctx.roundRect not universally available)
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  // ── Background ──────────────────────────────────────────────────────────────
  const bgGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bgGrad.addColorStop(0, '#12062b');
  bgGrad.addColorStop(0.45, '#2a0e6e');
  bgGrad.addColorStop(1, '#46034a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── Blurred cover background ─────────────────────────────────────────────────
  if (song.coverArt) {
    try {
      const coverImg = await loadImg(song.coverArt);
      ctx.save();
      ctx.filter = 'blur(60px) brightness(0.22) saturate(2.8)';
      ctx.drawImage(coverImg, -120, -120, SIZE + 240, SIZE + 240);
      ctx.restore();
    } catch { /* CORS / load failure — skip */ }
  }

  // Dark gradient overlay
  const ov = ctx.createLinearGradient(0, 0, 0, SIZE);
  ov.addColorStop(0, 'rgba(0,0,0,0.1)');
  ov.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = ov;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── Album art ───────────────────────────────────────────────────────────────
  const ART = 370;
  const artX = (SIZE - ART) / 2;
  const artY = 195;
  if (song.coverArt) {
    try {
      const coverImg = await loadImg(song.coverArt);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 10;
      rr(artX, artY, ART, ART, 46);
      ctx.clip();
      ctx.drawImage(coverImg, artX, artY, ART, ART);
      ctx.restore();
      ctx.save();
      rr(artX, artY, ART, ART, 46);
      ctx.strokeStyle = 'rgba(168,85,247,0.6)';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    } catch { /* skip */ }
  } else {
    const artGrad = ctx.createLinearGradient(artX, artY, artX + ART, artY + ART);
    artGrad.addColorStop(0, '#3b0764');
    artGrad.addColorStop(1, '#7c3aed');
    ctx.save();
    rr(artX, artY, ART, ART, 46);
    ctx.fillStyle = artGrad;
    ctx.fill();
    ctx.restore();
  }

  // ── Artist profile badge (bottom-right of art) ────────────────────────────
  if (artistProfileImage) {
    try {
      const aImg = await loadImg(artistProfileImage);
      const AS = 88;
      const ax = artX + ART - AS / 2 + 10;
      const ay = artY + ART - AS / 2 + 10;
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax + AS / 2, ay + AS / 2, AS / 2 + 4, 0, Math.PI * 2);
      ctx.fillStyle = '#12062b';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ax + AS / 2, ay + AS / 2, AS / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(aImg, ax, ay, AS, AS);
      ctx.restore();
    } catch { /* skip */ }
  }

  // ── 🎤 Mic badge (top-left of art) ───────────────────────────────────────
  const MS = 76;
  const mx = artX - MS / 2 + 12;
  const my = artY - MS / 2 + 12;
  ctx.save();
  ctx.shadowColor = 'rgba(168,85,247,0.8)';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(mx + MS / 2, my + MS / 2, MS / 2, 0, Math.PI * 2);
  const micGrad = ctx.createRadialGradient(mx + MS / 2, my + MS / 2 - 8, 0, mx + MS / 2, my + MS / 2, MS / 2);
  micGrad.addColorStop(0, '#9333ea');
  micGrad.addColorStop(1, '#6b21a8');
  ctx.fillStyle = micGrad;
  ctx.fill();
  ctx.restore();
  ctx.font = '38px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎤', mx + MS / 2, my + MS / 2 + 2);

  // ── Song title ──────────────────────────────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const titleY = artY + ART + 88;
  ctx.font = 'bold 66px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  let title = song.title;
  while (ctx.measureText(title).width > SIZE - 100 && title.length > 3) {
    title = title.slice(0, -1);
  }
  if (title !== song.title) title += '\u2026';
  ctx.fillText(title, SIZE / 2, titleY);

  // ── Artist name ──────────────────────────────────────────────────────────────
  ctx.font = '46px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(196,148,255,0.88)';
  ctx.fillText(artistName, SIZE / 2, titleY + 72);

  // ── KARAOKE pill ────────────────────────────────────────────────────────────
  const PW = 268, PH = 60;
  const px = (SIZE - PW) / 2;
  const py = titleY + 115;
  ctx.save();
  rr(px, py, PW, PH, 30);
  ctx.fillStyle = 'rgba(168,85,247,0.18)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(168,85,247,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  ctx.font = 'bold 30px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#e9d5ff';
  ctx.textBaseline = 'middle';
  ctx.fillText('\uD83C\uDFA4  KARAOKE', SIZE / 2, py + PH / 2);

  // ── Bottom branding bar ──────────────────────────────────────────────────────
  const barGrad = ctx.createLinearGradient(0, SIZE - 80, SIZE, SIZE - 80);
  barGrad.addColorStop(0, 'rgba(124,58,237,0.22)');
  barGrad.addColorStop(1, 'rgba(219,39,119,0.22)');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, SIZE - 76, SIZE, 76);
  ctx.save();
  ctx.beginPath();
  ctx.arc(SIZE / 2 - 96, SIZE - 38, 9, 0, Math.PI * 2);
  ctx.fillStyle = '#f97316';
  ctx.fill();
  ctx.restore();
  ctx.font = 'bold 28px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('BOOSTIFY MUSIC', SIZE / 2 + 8, SIZE - 38);

  // ── Trigger download ─────────────────────────────────────────────────────────
  const a = document.createElement('a');
  a.download = `${song.title.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 35)}-karaoke.png`;
  a.href = canvas.toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ── Share Modal ───────────────────────────────────────────────────────────────
function KaraokeShareModal({
  song,
  artistName,
  artistProfileImage,
  onClose,
}: {
  song: Song;
  artistName: string;
  artistProfileImage?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `\uD83C\uDFA4 Sing along to \u201C${song.title}\u201D by ${artistName} on Boostify!`;
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* clipboard denied */ }
  };

  const handleNativeShare = () => {
    if (canNativeShare) {
      (navigator as Navigator & { share: (d: object) => Promise<void> }).share({
        title: `${song.title} \u2014 Karaoke`,
        text: shareText,
        url: shareUrl,
      });
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await generateShareCard(song, artistName, artistProfileImage);
    } catch (e) {
      console.error('[share card]', e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(14px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 64, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 64, opacity: 0 }}
        transition={{ duration: 0.36, ease: [0.32, 0.72, 0, 1] }}
        className="w-full sm:max-w-[360px] rounded-t-3xl sm:rounded-2xl overflow-hidden"
        style={{ background: '#0f0a20', border: '1px solid rgba(168,85,247,0.2)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <p className="text-white font-semibold text-[15px]">Share Karaoke \uD83C\uDFA4</p>
            <p className="text-white/35 text-[11px] mt-0.5 truncate max-w-[230px]">
              &ldquo;{song.title}&rdquo; &middot; {artistName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        {/* Card preview */}
        <div className="px-5 pb-4">
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{ aspectRatio: '1 / 1', background: 'linear-gradient(135deg, #12062b 0%, #2a0e6e 50%, #46034a 100%)' }}
          >
            {song.coverArt && (
              <img
                src={song.coverArt}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-25"
                style={{ filter: 'blur(22px) saturate(2.2)' }}
              />
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.08), rgba(0,0,0,0.65))' }} />
            <div className="relative z-10 flex flex-col items-center justify-center h-full gap-2.5 p-5">
              {/* Art + badges */}
              <div className="relative">
                {song.coverArt ? (
                  <img
                    src={song.coverArt}
                    alt={song.title}
                    className="w-28 h-28 rounded-2xl object-cover"
                    style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.65), 0 0 0 2px rgba(168,85,247,0.45)' }}
                  />
                ) : (
                  <div
                    className="w-28 h-28 rounded-2xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #3b0764, #7c3aed)' }}
                  >
                    <Music className="w-10 h-10 text-purple-200/40" />
                  </div>
                )}
                <div
                  className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-base"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 2px 12px rgba(168,85,247,0.7)' }}
                >
                  \uD83C\uDFA4
                </div>
                {artistProfileImage && (
                  <img
                    src={artistProfileImage}
                    alt={artistName}
                    className="absolute -bottom-2.5 -right-2.5 w-10 h-10 rounded-full object-cover"
                    style={{ border: '2.5px solid #0f0a20', boxShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
                  />
                )}
              </div>
              <div className="text-center mt-1">
                <p className="text-white font-bold text-sm leading-tight">{song.title}</p>
                <p className="text-purple-300/75 text-xs mt-0.5">{artistName}</p>
              </div>
              <div
                className="px-3.5 py-1 rounded-full text-[10px] font-semibold tracking-widest uppercase"
                style={{ background: 'rgba(168,85,247,0.18)', border: '1px solid rgba(168,85,247,0.4)', color: '#e9d5ff' }}
              >
                \uD83C\uDFA4 Karaoke
              </div>
              <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-[8px] font-bold text-white/30 tracking-[0.18em] uppercase">Boostify Music</span>
              </div>
            </div>
          </div>
        </div>

        {/* Share actions */}
        <div className="px-5 pb-6 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all active:scale-95"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.28)', color: '#c4b5fd' }}
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Save Card
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all active:scale-95"
              style={{
                background: copied ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${copied ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.1)'}`,
                color: copied ? '#6ee7b7' : 'rgba(255,255,255,0.55)',
              }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all active:scale-95"
              style={{ background: 'rgba(29,155,240,0.09)', border: '1px solid rgba(29,155,240,0.25)', color: '#60a5fa' }}
            >
              <span className="font-bold text-[15px] leading-none">\uD835\uDD4F</span>
              Twitter / X
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all active:scale-95"
              style={{ background: 'rgba(37,211,102,0.09)', border: '1px solid rgba(37,211,102,0.25)', color: '#4ade80' }}
            >
              <span className="text-base leading-none">\uD83D\uDCAC</span>
              WhatsApp
            </a>
          </div>
          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(219,39,119,0.18))',
                border: '1px solid rgba(168,85,247,0.32)',
                color: '#c4b5fd',
              }}
            >
              <Share2 className="w-4 h-4" />
              More options\u2026
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function KaraokeModule({ songs, artistName, artistProfileImage, isOwnProfile, currentlyPlayingSongId }: KaraokeModuleProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [statusMap, setStatusMap] = useState<Record<string | number, KaraokeStatus>>({});
  const [linesCache, setLinesCache] = useState<Record<string | number, KaraokeLine[]>>({});
  const [activeSong, setActiveSong] = useState<Song | null>(null);
  const [generatingIds, setGeneratingIds] = useState<Set<string | number>>(new Set());
  const [errorMap, setErrorMap] = useState<Record<string | number, string>>({});
  const { toast } = useToast();
  const prevPlayingId = useRef<string | null | undefined>(null);
  const [shareModal, setShareModal] = useState<Song | null>(null);
  // Ref-based fetch guard — never stale, survives rapid parent re-renders
  const fetchedIdsRef = useRef<Set<string | number>>(new Set());

  // ── Auto-navigate to currently playing song ──────────────────────────────
  useEffect(() => {
    if (!currentlyPlayingSongId || currentlyPlayingSongId === prevPlayingId.current) return;
    prevPlayingId.current = currentlyPlayingSongId;
    const idx = songs.findIndex(s => String(s.id) === String(currentlyPlayingSongId));
    if (idx !== -1 && idx !== currentIndex) {
      setDirection(idx > currentIndex ? 1 : -1);
      setCurrentIndex(idx);
    }
  }, [currentlyPlayingSongId, songs, currentIndex]);

  // ── Check karaoke status lazily — only the visible song, avoids burst requests ──
  useEffect(() => {
    if (!songs?.length) return;
    const song = songs[currentIndex];
    if (!song) return;
    // Use ref-based guard to prevent re-fetching regardless of stale closures
    if (fetchedIdsRef.current.has(song.id)) return;
    fetchedIdsRef.current.add(song.id);
    apiRequest({ url: `/api/karaoke/${song.id}`, method: 'GET' })
      .then((data: any) => {
        const status = (data.exists ? (data.karaoke?.status ?? 'pending') : 'unknown') as KaraokeStatus;
        setStatusMap(prev => ({ ...prev, [song.id]: status }));
        // Cache lyrics so player opens instantly
        if (status === 'ready' && Array.isArray(data.karaoke?.syncedLyrics)) {
          setLinesCache(prev => ({ ...prev, [song.id]: data.karaoke.syncedLyrics as KaraokeLine[] }));
        }
      })
      .catch(() => {
        // Remove from fetched set on error so retry is possible
        fetchedIdsRef.current.delete(song.id);
        setStatusMap(prev => ({ ...prev, [song.id]: 'unknown' as KaraokeStatus } as Record<string | number, KaraokeStatus>));
      });
  }, [songs, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigate carousel ────────────────────────────────────────────────────
  const navigate = (dir: number) => {
    setDirection(dir);
    setCurrentIndex(prev => (prev + dir + songs.length) % songs.length);
  };

  // ── Generate karaoke for a song ──────────────────────────────────────────
  const handleGenerate = async (song: Song) => {
    setGeneratingIds(prev => new Set(prev).add(song.id));
    setStatusMap(prev => ({ ...prev, [song.id]: 'processing' as KaraokeStatus } as Record<string | number, KaraokeStatus>));
    setErrorMap(prev => { const m = { ...prev }; delete m[song.id]; return m; });
    try {
      const token = await getAuthToken();
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const data: any = await apiRequest({
        url: `/api/karaoke/${song.id}/generate`,
        method: 'POST',
        headers: authHeaders,
      });
      if (data.success && Array.isArray(data.karaoke?.syncedLyrics) && data.karaoke.syncedLyrics.length > 0) {
        setStatusMap(prev => ({ ...prev, [song.id]: 'ready' as KaraokeStatus }));
        setLinesCache(prev => ({ ...prev, [song.id]: data.karaoke.syncedLyrics as KaraokeLine[] }));
        setActiveSong(song);
      } else if (data.success && Array.isArray(data.karaoke?.syncedLyrics) && data.karaoke.syncedLyrics.length === 0) {
        // Generation succeeded but returned no lyric lines (silent track or transcription issue)
        const errMsg = 'No lyrics detected in this track. Try adding lyrics manually first.';
        setStatusMap(prev => ({ ...prev, [song.id]: 'failed' as KaraokeStatus } as Record<string | number, KaraokeStatus>));
        setErrorMap(prev => ({ ...prev, [song.id]: errMsg }));
        toast({ title: '⚠️ No lyrics detected', description: errMsg, variant: 'destructive' });
      } else {
        const errMsg = data?.message || data?.error || 'Generation failed';
        setStatusMap(prev => ({ ...prev, [song.id]: 'failed' as KaraokeStatus } as Record<string | number, KaraokeStatus>));
        setErrorMap(prev => ({ ...prev, [song.id]: errMsg }));
        toast({ title: '❌ Karaoke generation failed', description: errMsg, variant: 'destructive' });
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Network error';
      console.error('[karaoke] generate failed:', errMsg);
      setStatusMap(prev => ({ ...prev, [song.id]: 'failed' as KaraokeStatus } as Record<string | number, KaraokeStatus>));
      setErrorMap(prev => ({ ...prev, [song.id]: errMsg }));
      toast({ title: '❌ Karaoke generation failed', description: errMsg, variant: 'destructive' });
    } finally {
      setGeneratingIds(prev => { const s = new Set(prev); s.delete(song.id); return s; });
    }
  };

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!songs?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="p-5 rounded-3xl bg-purple-500/10 border border-purple-500/15">
          <Mic2 className="w-12 h-12 text-purple-400/30" />
        </div>
        <p className="text-white/30 text-sm">No songs uploaded yet.</p>
      </div>
    );
  }

  const song = songs[currentIndex];
  const status = statusMap[song.id] ?? 'unknown';
  const isGenerating = generatingIds.has(song.id) || status === 'processing';
  const isReady = status === 'ready';
  const hasFailed = status === 'failed';

  return (
    <>
      {/* ── Counter ─────────────────────────────────────────────────────────── */}
      {songs.length > 1 && (
        <div className="flex items-center justify-end px-1 mb-3">
          <span className="text-white/20 text-xs tabular-nums">
            {currentIndex + 1} / {songs.length}
          </span>
        </div>
      )}

      {/* ── Carousel wrapper ─────────────────────────────────────────────────── */}
      <div className="relative px-5">
        {/* Left arrow */}
        {songs.length > 1 && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate(-1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(168,85,247,0.15)',
              border: '1px solid rgba(168,85,247,0.25)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <ChevronLeft className="w-4 h-4 text-purple-300" />
          </motion.button>
        )}

        {/* Sliding card */}
        <div className="overflow-hidden rounded-2xl">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={song.id}
              custom={direction}
              variants={SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              className="relative rounded-2xl overflow-hidden"
              style={{ minHeight: 260 }}
            >
              {/* Blurred cover art background */}
              <div className="absolute inset-0">
                {song.coverArt ? (
                  <img
                    src={song.coverArt}
                    alt=""
                    className="w-full h-full object-cover scale-110"
                    style={{ filter: 'blur(28px) brightness(0.28) saturate(1.6)' }}
                    draggable={false}
                  />
                ) : (
                  <div
                    className="w-full h-full"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(124,58,237,0.5) 0%, rgba(168,85,247,0.25) 50%, rgba(219,39,119,0.35) 100%)',
                    }}
                  />
                )}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.65) 100%)',
                  }}
                />
              </div>

              {/* Animated shimmer sweep */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
                style={{
                  backgroundSize: '300% 300%',
                  backgroundImage:
                    'linear-gradient(135deg, transparent 0%, rgba(168,85,247,0.12) 50%, transparent 100%)',
                }}
              />

              {/* Share button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShareModal(song); }}
                className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                style={{ background: 'rgba(0,0,0,0.38)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)' }}
              >
                <Share2 className="w-3.5 h-3.5 text-white/65" />
              </button>

              {/* Card content */}
              <div className="relative z-10 flex flex-col items-center px-6 py-8 gap-5">
                {/* Album art */}
                <motion.div
                  initial={{ scale: 0.82, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.08, duration: 0.42, ease: [0.32, 0.72, 0, 1] }}
                  className="relative w-[88px] h-[88px] rounded-2xl overflow-hidden flex-shrink-0"
                  style={{
                    boxShadow:
                      '0 8px 36px rgba(0,0,0,0.55), 0 0 0 1px rgba(168,85,247,0.25)',
                  }}
                >
                  {song.coverArt ? (
                    <img
                      src={song.coverArt}
                      alt={song.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{
                        background: 'linear-gradient(135deg, #3b0764, #7c3aed)',
                      }}
                    >
                      <Music className="w-9 h-9 text-purple-200/50" />
                    </div>
                  )}
                  {/* Ready glow ring */}
                  {isReady && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl pointer-events-none"
                      animate={{
                        boxShadow: [
                          '0 0 0 2px rgba(168,85,247,0.7), 0 0 18px rgba(168,85,247,0.45)',
                          '0 0 0 2px rgba(168,85,247,0.3), 0 0 6px rgba(168,85,247,0.15)',
                          '0 0 0 2px rgba(168,85,247,0.7), 0 0 18px rgba(168,85,247,0.45)',
                        ],
                      }}
                      transition={{ duration: 2.2, repeat: Infinity }}
                    />
                  )}
                </motion.div>

                {/* Song info */}
                <div className="text-center space-y-1">
                  <h3
                    className="text-white font-bold leading-tight"
                    style={{ fontSize: 'clamp(0.95rem, 3vw, 1.15rem)' }}
                  >
                    {song.title}
                  </h3>
                  <p className="text-purple-300/75 text-sm">{artistName}</p>
                  {song.genre && (
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-full text-xs text-purple-200/65 capitalize"
                      style={{
                        background: 'rgba(168,85,247,0.12)',
                        border: '1px solid rgba(168,85,247,0.2)',
                      }}
                    >
                      {song.genre}
                    </span>
                  )}
                </div>

                {/* ── Wave bars ──────────────────────────────────────────── */}
                <div className="flex flex-col items-center gap-1">
                  <WaveBars
                    active={isReady && !!currentlyPlayingSongId && String(song.id) === String(currentlyPlayingSongId)}
                    color={isReady ? '#a855f7' : 'rgba(168,85,247,0.4)'}
                  />
                  {isReady && currentlyPlayingSongId && String(song.id) === String(currentlyPlayingSongId) && (
                    <motion.span
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] font-semibold tracking-wide"
                      style={{ color: '#a855f7' }}
                    >
                      NOW PLAYING
                    </motion.span>
                  )}
                </div>

                {/* ── Action area ──────────────────────────────────────────── */}
                <div className="flex flex-col items-center gap-2.5 w-full" style={{ maxWidth: 210 }}>
                  {/* Ready → Play button */}
                  {isReady && (
                    <>
                      <motion.button
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setActiveSong(song)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-white text-sm"
                        style={{
                          background: 'linear-gradient(135deg, #7c3aed, #a855f7, #db2777)',
                          boxShadow: '0 4px 22px rgba(168,85,247,0.55)',
                        }}
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Start Karaoke
                      </motion.button>
                      <span className="flex items-center gap-1.5 text-emerald-400/75 text-xs">
                        <CheckCircle2 className="w-3 h-3" />
                        Lyrics synced
                      </span>
                    </>
                  )}

                  {/* Unknown → Generate (owner) */}
                  {status === 'unknown' && isOwnProfile && !isGenerating && (
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleGenerate(song)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm"
                      style={{
                        background: 'rgba(168,85,247,0.13)',
                        border: '1px solid rgba(168,85,247,0.35)',
                        color: '#d8b4fe',
                      }}
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate Karaoke
                    </motion.button>
                  )}

                  {/* Unknown → visitor message / generate button */}
                  {status === 'unknown' && !isOwnProfile && !isGenerating && (
                    <motion.button
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleGenerate(song)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm"
                      style={{
                        background: 'rgba(168,85,247,0.13)',
                        border: '1px solid rgba(168,85,247,0.35)',
                        color: '#d8b4fe',
                      }}
                    >
                      <Sparkles className="w-4 h-4" />
                      Generate Karaoke
                    </motion.button>
                  )}

                  {/* Failed */}
                  {hasFailed && !isGenerating && (
                    <div className="flex flex-col items-center gap-2 w-full">
                      <span className="flex items-center gap-1.5 text-red-400/80 text-xs">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Generation failed
                      </span>
                      {errorMap[song.id] && (
                        <p className="text-[10px] text-red-300/60 text-center max-w-xs px-2">
                          {errorMap[song.id]}
                        </p>
                      )}
                      {isOwnProfile && (
                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleGenerate(song)}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-medium"
                          style={{
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.25)',
                            color: '#fca5a5',
                          }}
                        >
                          <RotateCcw className="w-3 h-3" />
                          Retry
                        </motion.button>
                      )}
                    </div>
                  )}

                  {/* Processing / generating */}
                  {isGenerating && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-2 text-amber-300 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating…</span>
                      </div>
                      <p className="text-white/25 text-xs text-center" style={{ maxWidth: 180 }}>
                        AI is syncing lyrics — about 30 seconds
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right arrow */}
        {songs.length > 1 && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => navigate(1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(168,85,247,0.15)',
              border: '1px solid rgba(168,85,247,0.25)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <ChevronRight className="w-4 h-4 text-purple-300" />
          </motion.button>
        )}
      </div>

      {/* ── Dot navigation ──────────────────────────────────────────────────── */}
      {songs.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {songs.map((s, i) => {
            const st = statusMap[s.id] ?? 'unknown';
            const isActive = i === currentIndex;
            const isNowPlaying = currentlyPlayingSongId && String(s.id) === String(currentlyPlayingSongId);
            return (
              <motion.button
                key={s.id}
                onClick={() => {
                  setDirection(i > currentIndex ? 1 : -1);
                  setCurrentIndex(i);
                }}
                animate={{ width: isActive ? 22 : 6 }}
                transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                className="h-1.5 rounded-full flex-shrink-0"
                style={{
                  background: isActive
                    ? 'linear-gradient(90deg, #7c3aed, #a855f7)'
                    : isNowPlaying
                    ? 'rgba(168,85,247,0.6)'
                    : st === 'ready'
                    ? 'rgba(52,211,153,0.45)'
                    : 'rgba(255,255,255,0.15)',
                }}
              />
            );
          })}
        </div>
      )}

      {/* ── Owner info strip ────────────────────────────────────────────────── */}
      {isOwnProfile && (
        <div
          className="mt-3 mx-1 px-3 py-2.5 rounded-xl flex items-start gap-2"
          style={{
            background: 'rgba(168,85,247,0.05)',
            border: '1px solid rgba(168,85,247,0.1)',
          }}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400/45 mt-0.5 flex-shrink-0" />
          <p className="text-white/28 text-xs leading-relaxed">
            Songs with lyrics use GPT for instant sync. Others use Whisper audio analysis (~30s).
            Generated once per song — no repeated costs.
          </p>
        </div>
      )}

      {/* ── Fullscreen Karaoke Player portal ────────────────────────────────── */}
      <AnimatePresence>
        {activeSong && (
          <KaraokePlayer
            key={activeSong.id}
            song={activeSong}
            artistName={artistName}
            artistProfileImage={artistProfileImage}
            onClose={() => setActiveSong(null)}
            initialLines={linesCache[activeSong.id]}
          />
        )}
      </AnimatePresence>

      {/* ── Share Card Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {shareModal && (
          <KaraokeShareModal
            key={`share-${shareModal.id}`}
            song={shareModal}
            artistName={artistName}
            artistProfileImage={artistProfileImage}
            onClose={() => setShareModal(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
