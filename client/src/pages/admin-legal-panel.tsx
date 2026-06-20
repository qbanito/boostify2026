import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Header } from "../components/layout/header";
import { apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/use-auth";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  received: { label: "Recibida", cls: "bg-blue-500/20 text-blue-300" },
  under_review: { label: "En revisión", cls: "bg-yellow-500/20 text-yellow-300" },
  content_disabled: { label: "Desactivado", cls: "bg-red-500/20 text-red-300" },
  counter_received: { label: "Contranotificación", cls: "bg-purple-500/20 text-purple-300" },
  reinstated: { label: "Reactivado", cls: "bg-green-500/20 text-green-300" },
  rejected: { label: "Rechazada", cls: "bg-slate-500/20 text-slate-300" },
  resolved: { label: "Resuelta", cls: "bg-slate-500/20 text-slate-300" },
};

const ACTIONS: { key: string; label: string; cls: string }[] = [
  { key: "under_review", label: "Marcar en revisión", cls: "bg-yellow-600 hover:bg-yellow-700" },
  { key: "disable_content", label: "Desactivar contenido", cls: "bg-red-600 hover:bg-red-700" },
  { key: "reinstate", label: "Reactivar contenido", cls: "bg-green-600 hover:bg-green-700" },
  { key: "resolve", label: "Resolver", cls: "bg-slate-600 hover:bg-slate-700" },
  { key: "reject", label: "Rechazar", cls: "bg-slate-600 hover:bg-slate-700" },
];

export default function AdminLegalPanelPage() {
  const { isAdmin, isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("");
  const [openCase, setOpenCase] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"queue" | "verifications" | "audit">("queue");

  const queueQ = useQuery({
    queryKey: ["legal-admin-queue", filter],
    queryFn: () => apiRequest(`/api/legal/admin/queue${filter ? `?status=${filter}` : ""}`, { method: "GET" }),
    enabled: isAdmin && tab === "queue",
  });

  const caseQ = useQuery({
    queryKey: ["legal-admin-case", openCase],
    queryFn: () => apiRequest(`/api/legal/admin/case/${openCase}`, { method: "GET" }),
    enabled: isAdmin && openCase != null,
  });

  const verifQ = useQuery({
    queryKey: ["legal-admin-verifications"],
    queryFn: () => apiRequest("/api/legal/admin/verifications", { method: "GET" }),
    enabled: isAdmin && tab === "verifications",
  });

  const auditQ = useQuery({
    queryKey: ["legal-admin-audit"],
    queryFn: () => apiRequest("/api/legal/admin/audit", { method: "GET" }),
    enabled: isAdmin && tab === "audit",
  });

  const actionM = useMutation({
    mutationFn: (vars: { id: number; action: string; note?: string }) =>
      apiRequest(`/api/legal/admin/case/${vars.id}/action`, { method: "POST", data: { action: vars.action, note: vars.note } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["legal-admin-queue"] });
      qc.invalidateQueries({ queryKey: ["legal-admin-case", openCase] });
      setNote("");
    },
  });

  const verifM = useMutation({
    mutationFn: (vars: { id: number; decision: string; level?: string; note?: string }) =>
      apiRequest(`/api/legal/admin/verification/${vars.id}`, { method: "POST", data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["legal-admin-verifications"] }),
  });

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-white">
        <Header />
        <main className="container mx-auto max-w-3xl px-4 py-16 pt-28">
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
            🔒 Acceso restringido al equipo legal de Boostify.
          </div>
        </main>
      </div>
    );
  }

  const counts: Record<string, number> = {};
  (queueQ.data?.counts || []).forEach((c: any) => (counts[c.status] = c.n));
  const totalOpen = (counts.received || 0) + (counts.under_review || 0) + (counts.content_disabled || 0) + (counts.counter_received || 0);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <main className="container mx-auto max-w-6xl px-4 py-16 pt-28">
        <div className="mb-6 flex items-center gap-3">
          <span className="text-2xl">⚖️</span>
          <div>
            <h1 className="text-2xl font-bold">Panel Legal — Equipo de Cumplimiento</h1>
            <p className="text-xs text-slate-400">Cola DMCA · verificaciones · registro de auditoría</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-slate-700">
          {([["queue", `Cola DMCA${totalOpen ? ` (${totalOpen})` : ""}`], ["verifications", "Verificaciones"], ["audit", "Auditoría"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k as any)}
              className={`px-4 py-2 text-sm font-medium ${tab === k ? "border-b-2 border-orange-500 text-orange-300" : "text-slate-400 hover:text-white"}`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* QUEUE */}
        {tab === "queue" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                {["", "received", "under_review", "content_disabled", "counter_received", "resolved", "rejected"].map((s) => (
                  <button
                    key={s || "all"}
                    onClick={() => setFilter(s)}
                    className={`rounded-full px-3 py-1 text-xs ${filter === s ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
                  >
                    {s ? STATUS_LABEL[s]?.label || s : "Todas"} {s && counts[s] ? `(${counts[s]})` : ""}
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-800/30">
                {queueQ.isLoading ? (
                  <div className="p-6 text-sm text-slate-400">Cargando…</div>
                ) : (queueQ.data?.cases || []).length === 0 ? (
                  <div className="p-6 text-sm text-slate-400">No hay casos.</div>
                ) : (
                  <ul className="divide-y divide-slate-700/60">
                    {queueQ.data.cases.map((c: any) => {
                      const st = STATUS_LABEL[c.status] || { label: c.status, cls: "bg-slate-500/20 text-slate-300" };
                      return (
                        <li
                          key={c.id}
                          onClick={() => setOpenCase(c.id)}
                          className={`cursor-pointer p-4 hover:bg-slate-800/60 ${openCase === c.id ? "bg-slate-800/80" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-white">{c.workDescription}</p>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {c.claimantName} · <span className="font-mono">{c.uuid}</span>
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Case detail */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-5">
              {openCase == null ? (
                <p className="text-sm text-slate-400">Selecciona un caso para ver el expediente.</p>
              ) : caseQ.isLoading ? (
                <p className="text-sm text-slate-400">Cargando expediente…</p>
              ) : caseQ.data?.case ? (
                <CaseDetail
                  data={caseQ.data}
                  note={note}
                  setNote={setNote}
                  onAction={(action) => actionM.mutate({ id: openCase, action, note })}
                  busy={actionM.isPending}
                />
              ) : (
                <p className="text-sm text-red-400">No se pudo cargar el caso.</p>
              )}
            </div>
          </div>
        )}

        {/* VERIFICATIONS */}
        {tab === "verifications" && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/30">
            {verifQ.isLoading ? (
              <div className="p-6 text-sm text-slate-400">Cargando…</div>
            ) : (verifQ.data?.verifications || []).length === 0 ? (
              <div className="p-6 text-sm text-slate-400">No hay solicitudes de verificación.</div>
            ) : (
              <ul className="divide-y divide-slate-700/60">
                {verifQ.data.verifications.map((v: any) => (
                  <li key={v.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{v.legalName || v.organization || `Usuario #${v.userId}`}</p>
                      <p className="text-xs text-slate-500">Nivel solicitado: {v.level} · Estado: {v.status}</p>
                    </div>
                    {v.status === "pending" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <select id={`lvl-${v.id}`} defaultValue={v.level} className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-white">
                          <option value="verified">🟢 Verificado</option>
                          <option value="label">🔵 Sello</option>
                          <option value="distributor">🟠 Distribuidor</option>
                          <option value="company">🟣 Empresa</option>
                          <option value="rights_admin">🔴 Admin derechos</option>
                        </select>
                        <button
                          onClick={() => {
                            const lvl = (document.getElementById(`lvl-${v.id}`) as HTMLSelectElement)?.value;
                            verifM.mutate({ id: v.id, decision: "approve", level: lvl });
                          }}
                          className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                        >
                          Aprobar
                        </button>
                        <button onClick={() => verifM.mutate({ id: v.id, decision: "reject" })} className="rounded bg-slate-600 px-3 py-1 text-xs text-white hover:bg-slate-700">
                          Rechazar
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* AUDIT */}
        {tab === "audit" && (
          <div className="rounded-xl border border-slate-700 bg-slate-800/30">
            {auditQ.isLoading ? (
              <div className="p-6 text-sm text-slate-400">Cargando…</div>
            ) : (
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-900 text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Fecha</th>
                      <th className="px-3 py-2">Acción</th>
                      <th className="px-3 py-2">Entidad</th>
                      <th className="px-3 py-2">Actor</th>
                      <th className="px-3 py-2">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(auditQ.data?.audit || []).map((a: any) => (
                      <tr key={a.id} className="text-slate-300">
                        <td className="whitespace-nowrap px-3 py-2 text-slate-500">{new Date(a.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2 font-mono text-orange-300">{a.action}</td>
                        <td className="px-3 py-2">{a.entityType} #{a.entityId}</td>
                        <td className="px-3 py-2">{a.actorEmail || a.actorId || "—"}</td>
                        <td className="px-3 py-2 text-slate-500">{a.ip || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function CaseDetail({ data, note, setNote, onAction, busy }: { data: any; note: string; setNote: (s: string) => void; onAction: (a: string) => void; busy: boolean }) {
  const c = data.case;
  const st = STATUS_LABEL[c.status] || { label: c.status, cls: "bg-slate-500/20 text-slate-300" };
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Caso {c.uuid}</h3>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <Info label="Reclamante" value={c.claimantName} />
        <Info label="Email" value={c.claimantEmail} />
        <Info label="Organización" value={c.claimantOrg || "—"} />
        <Info label="URL señalada" value={c.targetUrl || "—"} />
      </div>

      <Block label="Obra protegida" value={c.workDescription} />
      <Block label="Descripción de la infracción" value={c.infringementDescription} />

      {data.targetUser && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-xs">
          <p className="mb-1 font-semibold text-white">Usuario afectado</p>
          <p className="text-slate-400">{data.targetUser.email || data.targetUser.username || `#${data.targetUser.id}`}</p>
          {data.targetStrikes && (
            <p className="mt-1 text-slate-500">
              Strikes: {data.targetStrikes.strikeCount}/3 · Total: {data.targetStrikes.totalClaims} ·{" "}
              {data.targetStrikes.suspended ? <span className="text-red-400">SUSPENDIDO</span> : "Activo"}
            </p>
          )}
        </div>
      )}

      {data.fingerprint && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-xs">
          <p className="mb-1 font-semibold text-white">Huella del archivo</p>
          <p className="break-all font-mono text-slate-500">SHA-256: {data.fingerprint.sha256}</p>
          <p className="text-slate-500">Estado: {data.fingerprint.status} · {data.fingerprint.fileName}</p>
        </div>
      )}

      {(data.counterNotices || []).length > 0 && (
        <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 text-xs">
          <p className="mb-1 font-semibold text-purple-300">Contranotificaciones</p>
          {data.counterNotices.map((cn: any) => (
            <p key={cn.id} className="text-slate-400">{cn.fullName} — {cn.explanation}</p>
          ))}
        </div>
      )}

      <div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota de resolución (opcional)…"
          rows={2}
          className="w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-white"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button key={a.key} disabled={busy} onClick={() => onAction(a.key)} className={`rounded px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 ${a.cls}`}>
            {a.label}
          </button>
        ))}
        <a href={`/api/legal/admin/case/${c.id}/export`} target="_blank" rel="noreferrer" className="rounded bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600">
          Exportar expediente
        </a>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="truncate text-slate-200">{value}</p>
    </div>
  );
}
function Block({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">{label}</p>
      <p className="rounded-lg bg-slate-900/50 p-3 text-xs text-slate-300">{value}</p>
    </div>
  );
}
