import { Header } from "../components/layout/header";

const COMPANY = "Boostify Music, Inc.";
const EMAIL_LEGAL = "legal@boostify.music";
const EFFECTIVE_DATE = "Junio 2026";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-10 scroll-mt-28">
      <h2 className="mb-3 border-l-4 border-orange-500 pl-3 text-xl font-bold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export default function TransparencyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-16 pt-28">
        <div className="mb-10">
          <h1 className="mb-2 text-4xl font-bold">Transparencia & Apelaciones</h1>
          <p className="text-sm text-slate-400">Vigente desde: {EFFECTIVE_DATE} · {COMPANY}</p>
        </div>

        <Section id="commitment" title="1. Nuestro compromiso">
          <p>
            Creemos en un proceso justo y transparente. Cada notificación, retirada, contranotificación y decisión queda
            registrada en un log de auditoría inmutable con sello de tiempo. Publicamos periódicamente estadísticas agregadas
            sobre la actividad de cumplimiento.
          </p>
        </Section>

        <Section id="process" title="2. Proceso de apelación">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Recibes una notificación cuando tu contenido es retirado, con el motivo y el número de caso.</li>
            <li>Puedes presentar una contranotificación desde la <a className="text-orange-400 hover:underline" href="/legal/dmca#counter">Política DMCA</a>.</li>
            <li>Nuestro equipo legal revisa la apelación y reenvía la contranotificación al reclamante.</li>
            <li>Si procede, el contenido se reactiva y la acción queda registrada.</li>
            <li>Puedes seguir el estado en <a className="text-orange-400 hover:underline" href="/legal/my-claims">Mis Reclamaciones</a>.</li>
          </ol>
        </Section>

        <Section id="strikes" title="3. Sistema de strikes y reincidencia">
          <p>
            Aplicamos una política de infractores reincidentes. Las reclamaciones válidas acumulan strikes; al alcanzar 3
            strikes la cuenta se suspende automáticamente. Las contranotificaciones aceptadas no cuentan como strike.
          </p>
        </Section>

        <Section id="contact" title="4. Contacto">
          <p>
            Para cualquier duda sobre una decisión de cumplimiento, escribe a{" "}
            <a className="text-orange-400 hover:underline" href={`mailto:${EMAIL_LEGAL}`}>{EMAIL_LEGAL}</a>.
          </p>
        </Section>
      </main>
    </div>
  );
}
