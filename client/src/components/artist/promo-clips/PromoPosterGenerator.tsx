/**
 * PromoPosterGenerator
 * Hollywood-style movie poster generation for the promo clip
 * Uses GPT-4o for copywriting + fal.ai Flux Pro for the 9:16 image
 * Auto-saves to the artist's photo gallery
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, Loader2, Download, FolderOpen, Sparkles, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiRequest } from '../../../lib/queryClient';

export interface PosterResult {
  posterUrl: string;
  galleryId: string;
  headline: string;
  tagline: string;
  storyText: string;
}

interface PromoPosterGeneratorProps {
  artistId: string;
  artistName: string;
  songName?: string;
  songGenre?: string;
  analysis?: {
    viral_hook?: string;
    story_seed?: string;
    mood?: string;
    energy_level?: string;
  };
  referenceImageUrl?: string;
  colorGradient?: string;
  colorPromptHint?: string;
  generatedImageUrl?: string;
  accent?: string;
  onPosterReady?: (result: PosterResult) => void;
}

export function PromoPosterGenerator({
  artistId,
  artistName,
  songName,
  songGenre,
  analysis,
  referenceImageUrl,
  colorGradient,
  colorPromptHint,
  generatedImageUrl,
  accent = '#ec4899',
  onPosterReady,
}: PromoPosterGeneratorProps) {
  const [poster, setPoster] = useState<PosterResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToGallery, setSavedToGallery] = useState(false);

  const generatePoster = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiRequest({
        url: `/api/promo-clips/${artistId}/generate-hollywood-poster`,
        method: 'POST',
        data: {
          artistName,
          songName: songName || 'Untitled',
          songGenre: songGenre || 'Music',
          viralHook: analysis?.viral_hook || '',
          storySeed: analysis?.story_seed || '',
          mood: analysis?.mood || '',
          energyLevel: analysis?.energy_level || '',
          referenceImageUrl: generatedImageUrl || referenceImageUrl || '',
          colorPromptHint: colorPromptHint || '',
        },
      });

      if (data.success && data.posterUrl) {
        const result: PosterResult = {
          posterUrl: data.posterUrl,
          galleryId: data.galleryId || '',
          headline: data.headline || artistName,
          tagline: data.tagline || songName || '',
          storyText: data.storyText || '',
        };
        setPoster(result);
        setSavedToGallery(!!data.galleryId);
        onPosterReady?.(result);
      } else {
        setError(data.error || 'Poster generation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate poster');
    } finally {
      setLoading(false);
    }
  };

  const downloadPoster = () => {
    if (!poster?.posterUrl) return;
    const a = document.createElement('a');
    a.href = poster.posterUrl;
    a.download = `${artistName}-${songName || 'poster'}-hollywood.jpg`;
    a.target = '_blank';
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4" style={{ color: accent }} />
          <span className="text-sm font-semibold text-white">Hollywood Poster</span>
          <span className="text-xs px-2 py-0.5 rounded-full text-white/40"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            Optional
          </span>
        </div>
        {savedToGallery && (
          <div className="flex items-center gap-1 text-xs text-green-400">
            <CheckCircle2 className="w-3 h-3" />
            Saved to Gallery
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-white/40 leading-relaxed">
        Generate a cinematic 9:16 movie poster for your song — AI writes the headline, tagline, and story hook in Hollywood style. Automatically saved to your photo gallery.
      </p>

      {/* Main area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Generate card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: poster?.posterUrl
              ? undefined
              : colorGradient || 'linear-gradient(135deg, #0a0015, #1a003d)',
            border: '1px solid rgba(255,255,255,0.1)',
            aspectRatio: poster?.posterUrl ? undefined : '9/16',
            maxHeight: '340px',
          }}
        >
          {!poster?.posterUrl ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
              {/* Decorative poster mock */}
              <div className="space-y-2 w-full max-w-[160px]">
                <div className="h-1 rounded-full bg-white/10 mx-auto w-3/4" />
                <div className="h-3 rounded bg-white/15 mx-auto w-full" />
                <div className="h-1.5 rounded-full bg-white/8 mx-auto w-1/2" />
                <div className="h-8 rounded-lg bg-white/5 mx-auto w-full" />
                <div className="h-1 rounded-full bg-white/6 mx-auto w-4/5" />
                <div className="h-1 rounded-full bg-white/4 mx-auto w-3/5" />
              </div>

              <div>
                <p className="text-white/50 text-xs font-medium mb-0.5">AI Poster Generator</p>
                <p className="text-white/25 text-[10px]">Hollywood-style 9:16</p>
              </div>

              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="w-8 h-8" style={{ color: accent }} />
                  </motion.div>
                  <p className="text-xs text-white/40">Crafting your poster...</p>
                  <p className="text-[10px] text-white/25">GPT writing copy • Flux rendering visuals</p>
                </div>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={generatePoster}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${accent}, #8b5cf6)`,
                    boxShadow: `0 0 20px ${accent}44`,
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Poster
                </motion.button>
              )}
            </div>
          ) : (
            <div className="relative" style={{ aspectRatio: '9/16', maxHeight: '340px' }}>
              <img
                src={poster.posterUrl}
                alt="Hollywood Poster"
                className="w-full h-full object-cover"
              />
              {/* Overlay gradient */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 40%)',
                }}
              />
              {/* Poster text on image */}
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-white font-black text-lg leading-tight drop-shadow-lg">{poster.headline}</p>
                <p className="text-white/70 text-xs italic mt-0.5 drop-shadow">{poster.tagline}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Details and actions */}
        <div className="space-y-3">
          {poster ? (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {/* Copy details */}
                <div
                  className="p-3 rounded-xl space-y-2"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-1">Headline</p>
                    <p className="text-white font-bold text-sm leading-snug">{poster.headline}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-1">Tagline</p>
                    <p className="text-white/70 text-xs italic">{poster.tagline}</p>
                  </div>
                  {poster.storyText && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-white/30 font-mono mb-1">Story</p>
                      <p className="text-white/50 text-xs leading-relaxed">{poster.storyText}</p>
                    </div>
                  )}
                </div>

                {/* Gallery badge */}
                {savedToGallery && (
                  <div
                    className="flex items-center gap-2 p-2.5 rounded-xl text-xs"
                    style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#86efac' }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    Poster saved to your photo gallery automatically
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={downloadPoster}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium"
                    style={{ background: `${accent}22`, border: `1px solid ${accent}44`, color: accent }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={generatePoster}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Regenerate
                  </motion.button>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="space-y-3">
              {/* What to expect */}
              <div
                className="p-3 rounded-xl space-y-2"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-mono">What You'll Get</p>
                {[
                  { icon: '🎬', text: 'Cinematic 9:16 portrait poster' },
                  { icon: '✍️', text: 'AI-written Hollywood headline & tagline' },
                  { icon: '🎨', text: 'Styled with your selected color mood' },
                  { icon: '📸', text: 'Auto-saved to your photo gallery' },
                  { icon: '⬇️', text: 'Download-ready high resolution image' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-white/50">
                    <span>{item.icon}</span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>

              {!referenceImageUrl && !generatedImageUrl && (
                <div
                  className="flex items-start gap-2 p-3 rounded-xl text-xs"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: '#fde68a' }}
                >
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  Generate an artist image first for best poster quality
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl text-xs"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
            >
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
