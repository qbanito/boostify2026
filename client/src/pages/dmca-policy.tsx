import { useState } from "react";
import { Header } from "../components/layout/header";
import { apiRequest } from "../lib/queryClient";

const COMPANY = "Boostify Music, Inc.";
const EMAIL_DMCA = "dmca@boostify.music";
const EFFECTIVE_DATE = "Junio 2026";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-28">
      <h2 className="mb-3 border-l-4 border-orange-500 pl-3 text-xl font-bold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-300">
        {label} {required && <span className="text-orange-400">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-orange-500 focus:outline-none";

function DmcaForm() {
  const [form, setForm] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; caseNumber?: string } | null>(null);

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await apiRequest("/api/legal/dmca", { method: "POST", data: form });
      if (res?.success) {
        setResult({ ok: true, msg: res.message || "Notificación recibida.", caseNumber: res.caseNumber });
        setForm({});
      } else {
        setResult({ ok: false, msg: res?.error || "No se pudo enviar la notificación." });
      }
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message || "Error de red." });
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-6">
        <h3 className="mb-2 text-lg font-bold text-green-300">✅ Notificación recibida</h3>
        <p className="text-sm text-slate-200">{result.msg}</p>
        {result.caseNumber && (
          <p className="mt-3 text-sm text-slate-300">
            Número de caso: <span className="font-mono text-orange-300">{result.caseNumber}</span>
          </p>
        )}
        <button onClick={() => setResult(null)} className="mt-4 rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600">
          Presentar otra notificación
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/30 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo del titular" required>
          <input className={inputCls} value={form.claimantName || ""} onChange={set("claimantName")} required />
        </Field>
        <Field label="Email de contacto" required>
          <input type="email" className={inputCls} value={form.claimantEmail || ""} onChange={set("claimantEmail")} required />
        </Field>
        <Field label="Organización (opcional)">
          <input className={inputCls} value={form.claimantOrg || ""} onChange={set("claimantOrg")} />
        </Field>
        <Field label="Teléfono (opcional)">
          <input className={inputCls} value={form.claimantPhone || ""} onChange={set("claimantPhone")} />
        </Field>
      </div>
      <Field label="Dirección postal (opcional)">
        <input className={inputCls} value={form.claimantAddress || ""} onChange={set("claimantAddress")} />
      </Field>
      <Field label="URL del contenido infractor en la plataforma" required>
        <input className={inputCls} placeholder="https://boostifymusic.com/..." value={form.targetUrl || ""} onChange={set("targetUrl")} required />
      </Field>
      <Field label="Descripción de la obra original protegida" required>
        <textarea className={inputCls} rows={2} value={form.workDescription || ""} onChange={set("workDescription")} required />
      </Field>
      <Field label="Descripción de la infracción" required>
        <textarea className={inputCls} rows={3} value={form.infringementDescription || ""} onChange={set("infringementDescription")} required />
      </Field>

      <div className="space-y-2 rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
        <label className="flex items-start gap-2 text-xs text-slate-200">
          <input type="checkbox" className="mt-0.5 accent-orange-500" checked={!!form.goodFaithStatement} onChange={set("goodFaithStatement")} required />
          Declaro de buena fe que el uso del material no está autorizado por el titular, su agente o la ley.
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-200">
          <input type="checkbox" className="mt-0.5 accent-orange-500" checked={!!form.accuracyStatement} onChange={set("accuracyStatement")} required />
          Bajo pena de perjurio, la información de esta notificación es exacta y soy el titular o estoy autorizado a actuar en su nombre.
        </label>
      </div>

      <Field label="Firma electrónica (nombre completo)" required>
        <input className={inputCls} placeholder="Escribe tu nombre como firma" value={form.authorizedSignature || ""} onChange={set("authorizedSignature")} required />
      </Field>

      {result && !result.ok && <p className="text-sm text-red-400">{result.msg}</p>}

      <button type="submit" disabled={submitting} className="w-full rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40">
        {submitting ? "Enviando…" : "Enviar notificación DMCA"}
      </button>
    </form>
  );
}

function CounterForm() {
  const [form, setForm] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string; caseNumber?: string } | null>(null);
  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await apiRequest("/api/legal/counter-notice", { method: "POST", data: form });
      if (res?.success) {
        setResult({ ok: true, msg: res.message || "Contranotificación recibida.", caseNumber: res.caseNumber });
        setForm({});
      } else {
        setResult({ ok: false, msg: res?.error || "No se pudo enviar." });
      }
    } catch (err: any) {
      setResult({ ok: false, msg: err?.message || "Error de red." });
    } finally {
      setSubmitting(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-6 text-sm text-slate-200">
        ✅ {result.msg} {result.caseNumber && <span className="font-mono text-orange-300">{result.caseNumber}</span>}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-700 bg-slate-800/30 p-6">
      <Field label="ID del caso DMCA (recibido en la notificación)" required>
        <input className={inputCls} value={form.takedownId || ""} onChange={set("takedownId")} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre completo" required>
          <input className={inputCls} value={form.fullName || ""} onChange={set("fullName")} required />
        </Field>
        <Field label="Email" required>
          <input type="email" className={inputCls} value={form.email || ""} onChange={set("email")} required />
        </Field>
      </div>
      <Field label="Dirección postal" required>
        <input className={inputCls} value={form.address || ""} onChange={set("address")} required />
      </Field>
      <Field label="Teléfono (opcional)">
        <input className={inputCls} value={form.phone || ""} onChange={set("phone")} />
      </Field>
      <Field label="Explicación / motivo de la apelación" required>
        <textarea className={inputCls} rows={3} value={form.explanation || ""} onChange={set("explanation")} required />
      </Field>
      <div className="space-y-2 rounded-lg border border-orange-500/30 bg-orange-500/5 p-4">
        <label className="flex items-start gap-2 text-xs text-slate-200">
          <input type="checkbox" className="mt-0.5 accent-orange-500" checked={!!form.statementUnderPenalty} onChange={set("statementUnderPenalty")} required />
          Bajo pena de perjurio, declaro de buena fe que el contenido fue retirado por error o identificación incorrecta.
        </label>
        <label className="flex items-start gap-2 text-xs text-slate-200">
          <input type="checkbox" className="mt-0.5 accent-orange-500" checked={!!form.consentToJurisdiction} onChange={set("consentToJurisdiction")} required />
          Consiento la jurisdicción del tribunal correspondiente y aceptaré la notificación del reclamante.
        </label>
      </div>
      <Field label="Firma electrónica (nombre completo)" required>
        <input className={inputCls} value={form.signature || ""} onChange={set("signature")} required />
      </Field>
      {result && !result.ok && <p className="text-sm text-red-400">{result.msg}</p>}
      <button type="submit" disabled={submitting} className="w-full rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40">
        {submitting ? "Enviando…" : "Enviar contranotificación"}
      </button>
    </form>
  );
}

export default function DmcaPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-16 pt-28">
        <div className="mb-10">
          <h1 className="mb-2 text-4xl font-bold">Política DMCA & Notice and Takedown</h1>
          <p className="text-sm text-slate-400">Vigente desde: {EFFECTIVE_DATE} · {COMPANY}</p>
        </div>

        <Section id="overview" title="1. Compromiso con el copyright">
          <p>
            {COMPANY} respeta los derechos de propiedad intelectual de terceros y espera que sus usuarios hagan lo mismo.
            Conforme a la Digital Millennium Copyright Act (17 U.S.C. §512), respondemos a notificaciones de presunta
            infracción y operamos bajo el régimen de puerto seguro (safe harbor), retirando o desactivando el acceso al
            material señalado de forma expedita.
          </p>
        </Section>

        <Section id="agent" title="2. Agente de copyright designado">
          <p>Las notificaciones de infracción deben enviarse a nuestro agente designado:</p>
          <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4 text-sm">
            <p>{COMPANY} — Copyright Agent</p>
            <p>Email: <a className="text-orange-400 hover:underline" href={`mailto:${EMAIL_DMCA}`}>{EMAIL_DMCA}</a></p>
          </div>
          <p className="text-xs text-slate-500">
            Nota: para mayor protección, recomendamos registrar formalmente al agente DMCA ante la U.S. Copyright Office
            (Designated Agent Directory).
          </p>
        </Section>

        <Section id="process" title="3. Proceso Notice & Takedown">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Recibimos y registramos tu notificación (con sello de tiempo, IP y huella de auditoría).</li>
            <li>Desactivamos el acceso al contenido señalado mientras se revisa.</li>
            <li>Notificamos al usuario afectado y registramos la acción.</li>
            <li>El usuario puede presentar una contranotificación.</li>
            <li>Todo el expediente queda auditado y exportable para el equipo legal.</li>
          </ol>
        </Section>

        <Section id="notice" title="4. Presentar una notificación DMCA">
          <p>Completa el siguiente formulario. Una notificación válida debe incluir todos los elementos exigidos por la §512(c)(3).</p>
          <DmcaForm />
        </Section>

        <Section id="trademark" title="5. Reclamaciones de marca registrada">
          <p>
            Para infracciones de marca (no copyright), envía a <a className="text-orange-400 hover:underline" href={`mailto:${EMAIL_DMCA}`}>{EMAIL_DMCA}</a> tu
            número de registro de marca, la jurisdicción, las URLs afectadas y una descripción de la infracción.
          </p>
        </Section>

        <Section id="counter" title="6. Contranotificación (apelación)">
          <p>
            Si tu contenido fue retirado por error o identificación incorrecta, puedes apelar mediante una contranotificación
            conforme a la §512(g).
          </p>
          <CounterForm />
        </Section>

        <Section id="repeat" title="7. Política de infractores reincidentes">
          <p>
            Mantenemos un sistema de "strikes". Las cuentas que acumulen reclamaciones válidas reiteradas (3 strikes) serán
            suspendidas automáticamente, conforme a nuestra política de infractores reincidentes.
          </p>
        </Section>
      </main>
    </div>
  );
}
