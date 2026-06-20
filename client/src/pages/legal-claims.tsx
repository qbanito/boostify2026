import { useQuery } from "@tanstack/react-query";
import { Header } from "../components/layout/header";
import { apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/use-auth";
import { Link } from "wouter";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  received: { label: "Recibida", cls: "bg-blue-500/20 text-blue-300" },
  under_review: { label: "En revisión", cls: "bg-yellow-500/20 text-yellow-300" },
  content_disabled: { label: "Contenido desactivado", cls: "bg-red-500/20 text-red-300" },
  counter_received: { label: "Contranotificación enviada", cls: "bg-purple-500/20 text-purple-300" },
  reinstated: { label: "Reactivado", cls: "bg-green-500/20 text-green-300" },
  rejected: { label: "Rechazada", cls: "bg-slate-500/20 text-slate-300" },
  resolved: { label: "Resuelta", cls: "bg-slate-500/20 text-slate-300" },
};

export default function LegalClaimsPage() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["legal-my-claims"],
    queryFn: () => apiRequest("/api/legal/my/claims", { method: "GET" }),
    enabled: isAuthenticated,
  });

  const strikes = data?.strikes;
  const maxStrikes = data?.maxStrikes ?? 3;
  const claims = data?.claims ?? [];
  const strikeCount = strikes?.strikeCount ?? 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-16 pt-28">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">Mis Reclamaciones</h1>
          <p className="text-sm text-slate-400">
            Historial de reclamaciones de copyright sobre tu contenido y tu puntuación de strikes.
          </p>
        </div>

        {!isAuthenticated && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-6 text-sm text-slate-300">
            Inicia sesión para ver tus reclamaciones.{" "}
            <Link href="/login"><span className="cursor-pointer text-orange-400 hover:underline">Iniciar sesión</span></Link>
          </div>
        )}

        {isAuthenticated && (
          <>
            {/* Strike score + stats */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
                <p className="text-xs text-slate-400">Strike Score</p>
                <p className={`mt-1 text-2xl font-bold ${strikeCount >= maxStrikes ? "text-red-400" : strikeCount > 0 ? "text-yellow-400" : "text-green-400"}`}>
                  {strikeCount} / {maxStrikes}
                </p>
                {strikes?.suspended && <p className="mt-1 text-xs text-red-400">Cuenta suspendida</p>}
              </div>
              <Stat label="Total reclamaciones" value={strikes?.totalClaims ?? 0} />
              <Stat label="Contranotificaciones" value={strikes?.counterClaims ?? 0} />
              <Stat label="Resueltas" value={strikes?.resolvedClaims ?? 0} />
              <Stat label="Pendientes" value={strikes?.pendingClaims ?? 0} />
            </div>

            {/* Claims list */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/30">
              <div className="border-b border-slate-700 px-5 py-3 text-sm font-semibold text-white">
                Historial de reclamaciones
              </div>
              {isLoading ? (
                <div className="p-6 text-sm text-slate-400">Cargando…</div>
              ) : claims.length === 0 ? (
                <div className="p-6 text-sm text-slate-400">No tienes reclamaciones. 🎉</div>
              ) : (
                <ul className="divide-y divide-slate-700/60">
                  {claims.map((c: any) => {
                    const st = STATUS_LABEL[c.status] || { label: c.status, cls: "bg-slate-500/20 text-slate-300" };
                    return (
                      <li key={c.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-white">{c.workDescription}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            Caso <span className="font-mono text-slate-400">{c.caseNumber}</span>
                            {c.targetUrl && <> · {c.targetUrl}</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
                          {(c.status === "content_disabled" || c.status === "received") && (
                            <Link href="/legal/dmca#counter">
                              <span className="cursor-pointer text-xs text-orange-400 hover:underline">Apelar</span>
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <p className="mt-6 text-xs text-slate-500">
              ¿Necesitas apelar una retirada? Usa la{" "}
              <Link href="/legal/dmca#counter"><span className="cursor-pointer text-orange-400 hover:underline">contranotificación</span></Link>.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
