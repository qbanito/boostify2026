/**
 * UtilityDisclaimer — Reusable BTF legal disclaimer component
 * Variants: short | long | es (Spanish)
 * Sizes: xs | sm | md
 */
import React from "react";
import { ShieldCheck } from "lucide-react";

interface UtilityDisclaimerProps {
  variant?: "short" | "long" | "es";
  size?: "xs" | "sm" | "md";
  className?: string;
  showIcon?: boolean;
}

const DISCLAIMERS = {
  short:
    "BTF is a utility token used only inside Boostify to access digital services. BTF is not an investment product and does not provide royalties, dividends, revenue share, ownership, profit rights, or investment returns.",
  long:
    "BTF and Boostify digital access tokens are designed solely for utility within the Boostify ecosystem. They allow users to access, activate, and consume digital services such as AI music generation, video creation, artwork generation, artist access packs, campaign tools, and other platform services. They do not represent equity, debt, securities, dividends, royalties, revenue share, ownership, investment returns, or profit rights. Users should not purchase BTF or any Boostify digital token with an expectation of financial return.",
  es:
    "BTF y los tokens digitales de acceso de Boostify están diseñados únicamente para uso dentro del ecosistema Boostify. Permiten acceder, activar y consumir servicios digitales como generación musical con IA, creación de videos, generación de portadas, paquetes de acceso de artistas, herramientas de campaña y otros servicios de la plataforma. No representan acciones, deuda, valores, dividendos, regalías, participación en ingresos, propiedad, retornos de inversión ni derechos de ganancia. Los usuarios no deben comprar BTF ni ningún token digital de Boostify con expectativa de retorno financiero.",
};

const sizeClasses = {
  xs: "text-xs px-2 py-1.5",
  sm: "text-xs px-3 py-2",
  md: "text-sm px-4 py-3",
};

export function UtilityDisclaimer({
  variant = "short",
  size = "sm",
  className = "",
  showIcon = true,
}: UtilityDisclaimerProps) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg bg-gray-900/60 border border-gray-700/50 text-gray-400 leading-relaxed ${sizeClasses[size]} ${className}`}
    >
      {showIcon && (
        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-500" />
      )}
      <p>{DISCLAIMERS[variant]}</p>
    </div>
  );
}

/** Standalone text export for use in non-JSX contexts */
export const UTILITY_DISCLAIMER_SHORT = DISCLAIMERS.short;
export const UTILITY_DISCLAIMER_LONG = DISCLAIMERS.long;
export const UTILITY_DISCLAIMER_ES = DISCLAIMERS.es;
