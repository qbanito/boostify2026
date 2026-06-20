import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { TOKENS } from './tokens';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_MAP = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className={`w-full ${SIZE_MAP[size]} max-h-[90vh] flex flex-col rounded-2xl overflow-hidden`}
        style={{
          background: TOKENS.SURFACE_2,
          border: `1px solid ${TOKENS.BORDER}`,
          boxShadow:
            '0 30px 80px rgba(0,0,0,0.5), 0 0 60px rgba(255,122,0,0.08)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div
            className="flex items-start justify-between gap-3 px-5 py-4"
            style={{ borderBottom: `1px solid ${TOKENS.BORDER}` }}
          >
            <div className="min-w-0">
              {title && (
                <h3
                  className="text-[16px] font-semibold leading-tight"
                  style={{ color: TOKENS.TEXT }}
                >
                  {title}
                </h3>
              )}
              {subtitle && (
                <p
                  className="text-[12px] mt-0.5"
                  style={{ color: TOKENS.MUTED }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-white/5"
              style={{
                color: TOKENS.MUTED,
                border: `1px solid ${TOKENS.BORDER}`,
              }}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto custom-scroll p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
