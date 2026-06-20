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

export default function CopyrightPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-16 pt-28">
        <div className="mb-10">
          <h1 className="mb-2 text-4xl font-bold">Política de Copyright</h1>
          <p className="text-sm text-slate-400">Vigente desde: {EFFECTIVE_DATE} · {COMPANY}</p>
        </div>

        <Section id="ownership" title="1. Titularidad del contenido">
          <p>
            Conservas la titularidad de todo el contenido original que subes a Boostify. Al subirlo, nos concedes una
            licencia mundial, no exclusiva y libre de regalías para almacenar, reproducir, procesar y distribuir dicho
            contenido con el único fin de prestarte los servicios de la plataforma.
          </p>
        </Section>

        <Section id="warranty" title="2. Declaración de derechos">
          <p>
            Antes de cada subida debes confirmar que eres el titular de los derechos o cuentas con licencia/autorización
            válida. Cada archivo recibe una huella digital (SHA-256, MD5, tamaño, fecha/hora, IP, propietario y un UUID
            único) que sirve como evidencia de la cadena de custodia.
          </p>
        </Section>

        <Section id="licenses" title="3. Licencias de terceros">
          <p>
            Si tu contenido incluye samples, interpolaciones, imágenes, fuentes o cualquier material de terceros, eres
            responsable de obtener todas las licencias necesarias. Boostify no concede ni gestiona dichas licencias en tu nombre.
          </p>
        </Section>

        <Section id="claims" title="4. Reclamaciones de copyright">
          <p>
            Si crees que tu obra se utiliza sin autorización, presenta una notificación a través de nuestra{" "}
            <a className="text-orange-400 hover:underline" href="/legal/dmca">Política DMCA</a>. Procesamos las reclamaciones de
            forma expedita y mantenemos un registro auditado de cada caso.
          </p>
        </Section>

        <Section id="indemnity" title="5. Indemnización">
          <p>
            Aceptas indemnizar y mantener indemne a {COMPANY} frente a cualquier reclamación, daño o gasto (incluidos
            honorarios legales razonables) derivados del contenido que subas o de la infracción de derechos de terceros.
          </p>
        </Section>

        <p className="text-xs text-slate-500">
          Consultas: <a className="text-orange-400 hover:underline" href={`mailto:${EMAIL_LEGAL}`}>{EMAIL_LEGAL}</a>
        </p>
      </main>
    </div>
  );
}
