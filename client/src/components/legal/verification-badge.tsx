// Reusable artist verification badge.
// Levels map to a colored seal with an explanatory tooltip:
//   verified 🟢 | label 🔵 | distributor 🟠 | company 🟣 | rights_admin 🔴
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";

export type VerificationLevel =
  | "none"
  | "verified"
  | "label"
  | "distributor"
  | "company"
  | "rights_admin";

export const VERIFICATION_META: Record<
  Exclude<VerificationLevel, "none">,
  { emoji: string; label: string; ring: string; text: string }
> = {
  verified: { emoji: "🟢", label: "Artista verificado", ring: "border-green-400/60 bg-green-400/10", text: "text-green-300" },
  label: { emoji: "🔵", label: "Sello discográfico", ring: "border-blue-400/60 bg-blue-400/10", text: "text-blue-300" },
  distributor: { emoji: "🟠", label: "Distribuidor", ring: "border-orange-400/60 bg-orange-400/10", text: "text-orange-300" },
  company: { emoji: "🟣", label: "Empresa", ring: "border-purple-400/60 bg-purple-400/10", text: "text-purple-300" },
  rights_admin: { emoji: "🔴", label: "Administrador de derechos", ring: "border-red-400/60 bg-red-400/10", text: "text-red-300" },
};

/** Pure presentational badge — render when you already know the level. */
export function VerificationBadge({
  level,
  size = "md",
  showLabel = false,
  className = "",
}: {
  level: VerificationLevel;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  if (!level || level === "none") return null;
  const meta = VERIFICATION_META[level];
  if (!meta) return null;
  const sizes = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-0.5 gap-1.5",
    lg: "text-base px-3 py-1 gap-2",
  }[size];
  return (
    <span
      title={meta.label}
      className={`inline-flex items-center rounded-full border ${meta.ring} ${meta.text} ${sizes} font-medium ${className}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}

/**
 * Self-fetching badge for a public artist profile. Pass the artist's numeric
 * (Postgres) user id. Renders nothing while loading or if unverified.
 */
export function ArtistVerificationBadge({
  userId,
  size = "md",
  showLabel = false,
  className = "",
}: {
  userId?: number | string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}) {
  const id = Number(userId);
  const { data } = useQuery({
    queryKey: ["artist-verification-badge", id],
    queryFn: () => apiRequest(`/api/legal/verification/${id}`, { method: "GET" }),
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 5 * 60 * 1000,
  });
  const level = (data?.level as VerificationLevel) || "none";
  return <VerificationBadge level={level} size={size} showLabel={showLabel} className={className} />;
}

export default VerificationBadge;
