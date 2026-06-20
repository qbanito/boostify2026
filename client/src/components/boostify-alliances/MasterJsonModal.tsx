import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useMasterJson } from './hooks/useAlliancesApi';
import { TOKENS, FONT_MONO } from '../artist-acquisition/shared/tokens';

interface MasterJsonModalProps {
  contactId: number | null;
  onClose: () => void;
}

export function MasterJsonModal({ contactId, onClose }: MasterJsonModalProps) {
  const { data, isLoading } = useMasterJson(contactId);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const full = data?.full || {};
  const profile = data?.profile;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: TOKENS.SURFACE_2, border: `1px solid ${TOKENS.BORDER}` }}
        onClick={(e) => e.stopPropagation()}
        data-testid="alliances-master-json-modal"
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${TOKENS.BORDER}` }}
        >
          <div>
            <div className="text-[10px] font-bold tracking-[0.18em]" style={{ color: TOKENS.ORANGE_GLOW }}>
              FULL ARTIST MASTER JSON
            </div>
            <div className="text-[16px] font-semibold mt-0.5" style={{ color: TOKENS.TEXT }}>
              {profile?.name || 'Artist'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: TOKENS.SURFACE_3, border: `1px solid ${TOKENS.BORDER}`, color: TOKENS.MUTED }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-auto custom-scroll p-5">
          {isLoading ? (
            <div className="text-sm" style={{ color: TOKENS.MUTED }}>Loading…</div>
          ) : (
            <pre
              className="text-[11.5px] leading-[1.55] rounded-xl p-4"
              style={{
                background: '#0a0b0e',
                border: `1px solid ${TOKENS.BORDER}`,
                color: TOKENS.ORANGE_GLOW,
                fontFamily: FONT_MONO,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {JSON.stringify(full, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
