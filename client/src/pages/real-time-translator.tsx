import { Header } from "../components/layout/header";
import { RealTimeTranslator } from "../components/translation/real-time-translator";

export default function RealTimeTranslatorPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Traductor en Tiempo Real</h1>
            <p className="text-muted-foreground">
              Traduce texto instantáneamente entre múltiples idiomas utilizando tecnología de IA avanzada
            </p>
          </div>
          <RealTimeTranslator />
        </div>
      </main>
    </div>
  );
}
