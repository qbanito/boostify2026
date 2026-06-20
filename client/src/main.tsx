import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n/config";
import { setupHMRErrorHandler } from "./utils/hmr-error-handler";
import { ClerkProvider } from "@clerk/clerk-react";
import { HelmetProvider } from "react-helmet-async";

// Clerk Publishable Key - loaded from env or fallback for development
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_YWNlLW1hZ3BpZS0xOS5jbGVyay5hY2NvdW50cy5kZXYk";

// Configurar el manejador de errores de HMR
setupHMRErrorHandler();

// Si clerk-js no puede descargarse (sin conexión, DNS, adblock...), Clerk lanza
// "failed_to_load_clerk_js" como promesa no manejada y el overlay de Vite tumba la app.
// Lo degradamos a un warning para que la página siga funcionando sin sesión.
const isClerkLoadError = (reason: unknown) => {
  const msg = (reason as any)?.message || String(reason ?? "");
  return msg.includes("failed_to_load_clerk_js") || msg.includes("Failed to load Clerk");
};
window.addEventListener("unhandledrejection", (event) => {
  if (isClerkLoadError(event.reason)) {
    console.warn("[clerk] No se pudo cargar clerk-js (¿conexión?). La app continúa sin sesión.");
    event.preventDefault();
  }
});
window.addEventListener("error", (event) => {
  if (isClerkLoadError(event.error) || isClerkLoadError(event.message)) {
    event.preventDefault();
  }
});

// Reemplazamos el enrutador de hash y usamos el enfoque básico
// Esto evitará problemas de reactividad y carga infinita
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <App />
      </ClerkProvider>
    </HelmetProvider>
  </React.StrictMode>
);
