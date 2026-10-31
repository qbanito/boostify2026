import { Download, FileText, Loader2, Sparkles, Trash2, Upload } from 'lucide-react';
import { Link } from 'wouter';

interface ArtistVideoActionsProps {
  videoId: string;
  isOwner: boolean;
  canDownload: boolean;
  hasScript: boolean;
  uploading: boolean;
  accentColor: string;
  onDownload: () => void;
  onViewScript: () => void;
  onUploadScript: (file: File) => void;
  onDelete: () => void;
}

const actionClass = 'inline-flex h-12 min-w-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.04] px-1 text-white/75 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/80 disabled:cursor-not-allowed disabled:opacity-50';

/** Compact controls remain individually labeled and large enough to tap on a phone. */
export function ArtistVideoActions({ videoId, isOwner, canDownload, hasScript, uploading, accentColor, onDownload, onViewScript, onUploadScript, onDelete }: ArtistVideoActionsProps) {
  if (!canDownload && !hasScript && !isOwner) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Video actions">
      {canDownload && <button type="button" className={actionClass} onClick={onDownload} aria-label="Download video" title="Download video" data-testid={`button-download-video-${videoId}`}><Download className="h-4 w-4" aria-hidden="true" /><span className="text-[9px] leading-none">Download</span></button>}
      {hasScript && <button type="button" className={actionClass} onClick={onViewScript} aria-label="View video script" title="View video script" data-testid={`button-view-script-${videoId}`}><FileText className="h-4 w-4" aria-hidden="true" /><span className="text-[9px] leading-none">Script</span></button>}
      {isOwner && !hasScript && (
        <label className={`${actionClass} relative cursor-pointer focus-within:ring-2 focus-within:ring-orange-400/80 ${uploading ? 'opacity-50' : ''}`} title={uploading ? 'Uploading script' : 'Upload video script (PDF)'}>
          <input type="file" accept="application/pdf,.pdf" className="sr-only" aria-label="Upload video script (PDF)" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadScript(file); event.target.value = ''; }} />
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          <span className="text-[9px] leading-none">{uploading ? 'Uploading' : 'Add PDF'}</span>
        </label>
      )}
      {isOwner && <Link href="/youtube-views" className={actionClass} style={{ color: accentColor }} aria-label="Promote video" title="Promote video" data-testid={`button-promote-video-${videoId}`}><Sparkles className="h-4 w-4" aria-hidden="true" /><span className="text-[9px] leading-none">Promote</span></Link>}
      {isOwner && <button type="button" className={`${actionClass} ml-auto text-red-300/80 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-300`} onClick={onDelete} aria-label="Delete video" title="Delete video" data-testid={`button-delete-video-${videoId}`}><Trash2 className="h-4 w-4" aria-hidden="true" /><span className="text-[9px] leading-none">Delete</span></button>}
    </div>
  );
}
