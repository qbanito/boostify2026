import { BadgeCheck, MapPin, Sparkles, Eye } from 'lucide-react';
import { Modal } from './Modal';
import { TOKENS } from './tokens';
import type { AcquisitionFeaturedArtist } from '../../../hooks/use-acquisition-overview';
import { formatLocation } from '../../../lib/formatLocation';

export function NewMatchModal({
  artist,
  open,
  onClose,
  onViewFull,
}: {
  artist: AcquisitionFeaturedArtist | null;
  open: boolean;
  onClose: () => void;
  onViewFull?: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Match Found"
      subtitle="Hunter surfaced a fresh high-potential artist"
      size="md"
    >
      {!artist ? (
        <div className="text-[12px]" style={{ color: TOKENS.MUTED }}>
          No new artist surfaced yet. Try again in a moment.
        </div>
      ) : (
        <div>
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: '0 0 24px 4px rgba(255,122,0,0.4)' }}
              />
              <div
                className="relative w-[72px] h-[72px] rounded-full overflow-hidden"
                style={{ border: `2px solid ${TOKENS.ORANGE}`, padding: 2, background: TOKENS.SURFACE }}
              >
                <img src={artist.avatar} alt={artist.name} className="w-full h-full rounded-full object-cover" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-[18px] font-semibold" style={{ color: TOKENS.TEXT }}>
                  {artist.name}
                </h4>
                {artist.verified && (
                  <BadgeCheck size={16} style={{ color: TOKENS.ORANGE_GLOW }} fill="rgba(255,138,31,0.15)" />
                )}
              </div>
              <div className="text-[12px] mt-1" style={{ color: TOKENS.MUTED }}>
                {artist.genres.join(' • ')}
              </div>
              <div className="text-[12px] mt-1 flex items-center gap-1.5" style={{ color: TOKENS.MUTED }}>
                <MapPin size={11} />
                {formatLocation(artist.location)}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10.5px] uppercase tracking-wider" style={{ color: TOKENS.MUTED }}>
                Score
              </div>
              <div className="text-[26px] font-bold leading-none" style={{ color: TOKENS.ORANGE_GLOW }}>
                {artist.growthScore}
              </div>
            </div>
          </div>

          {/* Metrics snapshot */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Listeners" value={artist.metrics.monthlyListeners} />
            <Stat label="Followers" value={artist.metrics.followers} />
            <Stat label="Engagement" value={artist.metrics.engagement} />
            <Stat label="Save" value={artist.metrics.saveRatio} />
          </div>

          {/* Score dims preview */}
          {artist.scoreDimensions && (
            <div
              className="mt-4 rounded-lg px-3 py-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2"
              style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
            >
              {Object.entries(artist.scoreDimensions).map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: TOKENS.MUTED }}>
                    {k}
                  </div>
                  <div className="text-[13px] font-semibold" style={{ color: TOKENS.TEXT }}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors hover:bg-white/5"
              style={{ color: TOKENS.MUTED, border: `1px solid ${TOKENS.BORDER}` }}
            >
              Close
            </button>
            <button
              onClick={() => {
                onViewFull?.();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-semibold"
              style={{ background: TOKENS.ORANGE, color: '#0a0a0a' }}
            >
              <Eye size={12} />
              View full profile
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-md px-2.5 py-1.5"
      style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}` }}
    >
      <div className="text-[10px] uppercase tracking-wider" style={{ color: TOKENS.MUTED }}>
        {label}
      </div>
      <div className="text-[13px] font-semibold" style={{ color: TOKENS.TEXT }}>
        {value}
      </div>
    </div>
  );
}
