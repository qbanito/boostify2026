// Small reusable "Copyright Protected" trust card. Drops into artist profile
// sidebars, dashboards, etc. Links to the Legal Center and DMCA policy.
import { Link } from "wouter";
import { ArtistVerificationBadge } from "./verification-badge";

export function LegalTrustCard({
  artistUserId,
  artistName,
  compact = false,
}: {
  artistUserId?: number | string | null;
  artistName?: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-gradient-to-br from-slate-900 to-slate-800/60 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-lg">🛡️</span>
        <h3 className="text-sm font-bold text-white">Protección de Copyright</h3>
        {artistUserId != null && <ArtistVerificationBadge userId={artistUserId} size="sm" />}
      </div>
      {!compact && (
        <p className="mb-3 text-xs leading-relaxed text-slate-400">
          {artistName ? `El contenido de ${artistName}` : "Este contenido"} está protegido y registrado con huella
          digital (SHA-256). Boostify cumple con la DMCA y responde a reclamaciones de copyright.
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        <Link href="/legal">
          <span className="cursor-pointer rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 hover:border-orange-500/60 hover:text-orange-300">
            Centro Legal
          </span>
        </Link>
        <Link href="/legal/dmca">
          <span className="cursor-pointer rounded-lg border border-slate-600 px-3 py-1.5 text-slate-200 hover:border-orange-500/60 hover:text-orange-300">
            Reportar infracción
          </span>
        </Link>
      </div>
    </div>
  );
}

export default LegalTrustCard;
