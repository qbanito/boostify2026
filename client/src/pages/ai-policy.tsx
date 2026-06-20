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

export default function AiPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 py-16 pt-28">
        <div className="mb-10">
          <h1 className="mb-2 text-4xl font-bold">Política de Contenido Generado por IA</h1>
          <p className="text-sm text-slate-400">Vigente desde: {EFFECTIVE_DATE} · {COMPANY}</p>
        </div>

        <Section id="scope" title="1. Alcance">
          <p>
            Boostify ofrece herramientas de inteligencia artificial para crear música, imágenes, vídeos, avatares, voces,
            textos y otros materiales ("Contenido IA"). Esta política regula la titularidad, el uso y la responsabilidad de
            dicho contenido.
          </p>
        </Section>

        <Section id="ownership" title="2. Licencia y uso del Contenido IA">
          <p>
            Sujeto al cumplimiento de los Términos de Servicio y al pago de los créditos correspondientes, te concedemos una
            licencia para usar el Contenido IA que generes con fines personales y comerciales dentro de la plataforma. El
            Contenido IA se proporciona "tal cual", sin garantía de originalidad absoluta ni de no infracción.
          </p>
        </Section>

        <Section id="responsibility" title="3. Responsabilidad del usuario">
          <p>
            Eres el único responsable de cómo utilizas el Contenido IA. Debes asegurarte de que:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>No infringe derechos de copyright, marca, imagen o privacidad de terceros.</li>
            <li>No reproduce la voz, rostro o identidad de una persona sin su autorización.</li>
            <li>No imita el estilo de un artista de forma que induzca a confusión o competencia desleal.</li>
            <li>Cumple con las leyes aplicables sobre etiquetado de contenido sintético, cuando proceda.</li>
          </ul>
        </Section>

        <Section id="indemnity" title="4. Cláusula de indemnización">
          <p>
            <strong>Aceptas defender, indemnizar y mantener indemne a {COMPANY}</strong>, sus directivos, empleados y socios,
            frente a cualquier reclamación, responsabilidad, daño, pérdida o gasto (incluidos honorarios de abogados
            razonables) que surja de: (a) tu uso del Contenido IA; (b) la infracción de derechos de terceros mediante dicho
            contenido; o (c) cualquier incumplimiento de esta política o de los Términos de Servicio. Esta obligación
            sobrevive a la terminación de tu cuenta.
          </p>
        </Section>

        <Section id="moderation" title="5. Moderación y retirada">
          <p>
            Nos reservamos el derecho de revisar, restringir o retirar Contenido IA que infrinja esta política, responda a una
            notificación DMCA, o que consideremos abusivo, ilegal o perjudicial, sin obligación de reembolso de créditos
            consumidos de mala fe.
          </p>
        </Section>

        <p className="text-xs text-slate-500">
          Consultas: <a className="text-orange-400 hover:underline" href={`mailto:${EMAIL_LEGAL}`}>{EMAIL_LEGAL}</a>
        </p>
      </main>
    </div>
  );
}
