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

// Boostify-branded theme for all Clerk UI (sign-in / sign-up modal, user profile…).
const clerkAppearance = {
  layout: {
    logoImageUrl: "/btf_logo.png",
    logoPlacement: "inside" as const,
    socialButtonsVariant: "blockButton" as const,
    helpPageUrl: "/",
  },
  variables: {
    colorPrimary: "#ff2d95",
    colorText: "#f5f5f7",
    colorTextSecondary: "rgba(255,255,255,0.55)",
    colorBackground: "#101016",
    colorInputBackground: "#17171f",
    colorInputText: "#ffffff",
    colorDanger: "#ff5470",
    colorSuccess: "#34d399",
    borderRadius: "0.85rem",
    fontFamily: "inherit",
  },
  elements: {
    card: "bg-[#101016] border border-white/10 shadow-[0_30px_120px_-20px_rgba(124,92,255,0.45)]",
    headerTitle: "text-white",
    headerSubtitle: "text-white/60",
    socialButtonsBlockButton: "border border-white/10 bg-white/5 text-white hover:bg-white/10",
    socialButtonsBlockButtonText: "text-white",
    dividerLine: "bg-white/10",
    dividerText: "text-white/40",
    formFieldLabel: "text-white/80",
    formFieldInput: "bg-[#17171f] border border-white/10 text-white placeholder:text-white/30",
    formButtonPrimary:
      "bg-gradient-to-r from-[#7c5cff] via-[#ff2d95] to-[#ff7b00] text-white normal-case hover:brightness-110",
    formFieldInputShowPasswordButton: "text-white/50",
    otpCodeFieldInput: "bg-[#17171f] border border-white/10 text-white",
    footerActionText: "text-white/50",
    footerActionLink: "text-[#e8c98a] hover:text-[#f3e3c0]",
    identityPreviewText: "text-white",
    identityPreviewEditButton: "text-[#e8c98a]",
    badge: "bg-[#7c5cff]/20 text-[#c9b6ff]",
    profileSectionTitleText: "text-white",
    userButtonPopoverCard: "bg-[#101016] border border-white/10",
  },
};

// Branded copy for the Clerk sign-in / sign-up flows (overrides the default
// "Sign in to Boostify_Music" template title).
const clerkLocalization = {
  signIn: {
    start: {
      title: "Sign in to Boostify Music",
      subtitle: "Welcome back! Sign in to claim and manage your profile.",
    },
  },
  signUp: {
    start: {
      title: "Create your Boostify Music account",
      subtitle: "Claim your profile and unlock the full platform.",
    },
  },
};

// Reemplazamos el enrutador de hash y usamos el enfoque básico
// Esto evitará problemas de reactividad y carga infinita
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        afterSignOutUrl="/"
        appearance={clerkAppearance}
        localization={clerkLocalization}
      >
        <App />
      </ClerkProvider>
    </HelmetProvider>
  </React.StrictMode>
);
