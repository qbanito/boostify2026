// Mandatory upload-consent gate.
// Renders 4 obligatory legal declarations that MUST all be checked before an
// upload can proceed. On confirm it records the consent server-side and returns
// the consentId so the caller can attach it to the subsequent upload request.
import { useState } from "react";
import { apiRequest } from "../../lib/queryClient";

export interface UploadConsentGateProps {
  contentType?: string;       // e.g. "song" | "image" | "video"
  contextRef?: string;        // page/module identifier
  onConfirmed: (consentId: number) => void;
  onCancel?: () => void;
}

const DECLARATIONS = [
  {
    key: "ownsRights" as const,
    text: "Declaro que soy el titular de los derechos o cuento con licencia/autorización válida sobre el contenido que voy a subir.",
  },
  {
    key: "noFalseDeclaration" as const,
    text: "Entiendo que una declaración falsa de titularidad puede acarrear responsabilidad civil y penal, y la suspensión de mi cuenta.",
  },
  {
    key: "authorizesStorageDistribution" as const,
    text: "Autorizo a Boostify a almacenar, procesar y distribuir este contenido en la plataforma conforme a los Términos de Servicio.",
  },
  {
    key: "acceptsDmcaTos" as const,
    text: "Acepto la Política DMCA, la Política de Copyright y los Términos de Servicio de Boostify.",
  },
];

export function UploadConsentGate({ contentType, contextRef, onConfirmed, onCancel }: UploadConsentGateProps) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = DECLARATIONS.every((d) => checks[d.key]);

  async function handleConfirm() {
    if (!allChecked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiRequest("/api/legal/consent", {
        method: "POST",
        data: {
          ownsRights: !!checks.ownsRights,
          noFalseDeclaration: !!checks.noFalseDeclaration,
          authorizesStorageDistribution: !!checks.authorizesStorageDistribution,
          acceptsDmcaTos: !!checks.acceptsDmcaTos,
          contentType: contentType || null,
          contextRef: contextRef || null,
        },
      });
      if (res?.success && res?.consentId) {
        onConfirmed(res.consentId);
      } else {
        setError(res?.error || "No se pudo registrar el consentimiento.");
      }
    } catch (e: any) {
      setError(e?.message || "Error de red al registrar el consentimiento.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-orange-500/40 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20 text-xl">🛡️</div>
          <div>
            <h2 className="text-lg font-bold text-white">Confirmación legal obligatoria</h2>
            <p className="text-xs text-slate-400">Necesario antes de subir cualquier contenido</p>
          </div>
        </div>

        <div className="space-y-3">
          {DECLARATIONS.map((d) => (
            <label key={d.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3 hover:border-orange-500/50">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-orange-500"
                checked={!!checks[d.key]}
                onChange={(e) => setChecks((c) => ({ ...c, [d.key]: e.target.checked }))}
              />
              <span className="text-xs leading-relaxed text-slate-200">{d.text}</span>
            </label>
          ))}
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          {onCancel && (
            <button onClick={onCancel} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
              Cancelar
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={!allChecked || submitting}
            className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-orange-600"
          >
            {submitting ? "Registrando…" : "Acepto y continúo"}
          </button>
        </div>
        <p className="mt-3 text-center text-[10px] text-slate-500">
          Tu aceptación queda registrada con fecha, hora, IP y huella de auditoría.
        </p>
      </div>
    </div>
  );
}

export default UploadConsentGate;
