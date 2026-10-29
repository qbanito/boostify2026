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
    "BTF is designed for access to Boostify digital services. It does not grant ownership, royalties, dividends, revenue share, or promised returns. This describes intended use, not a legal classification guarantee.",
  long:
    "BTF and Boostify digital access tokens are designed to provide access to platform features such as AI music generation, video creation, artwork generation, artist access packs, and campaign tools. They do not grant ownership, dividends, royalties, revenue sharing, or any promised financial return. These statements describe the rights intended by Boostify and are not a legal classification guarantee. Treatment can depend on the asset, transaction, offer, and applicable law. Do not acquire BTF in reliance on a future price or return.",
  es:
    "BTF y los tokens de acceso de Boostify estan disenados para acceder a funciones de la plataforma, como generacion de musica, video, arte, paquetes de acceso de artistas y herramientas de campana. No otorgan propiedad, dividendos, regalias, participacion en ingresos ni rendimientos prometidos. Esta descripcion expresa el uso previsto y no garantiza una clasificacion legal; el tratamiento depende del activo, la transaccion, la oferta y la ley aplicable. No adquieras BTF confiando en un precio o rendimiento futuro.",
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
