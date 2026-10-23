export const fundingRules = {
  revenueStability: 25,
  revenueScale: 20,
  revenueGrowth: 15,
  catalogOwnership: 15,
  catalogLongevity: 10,
  dataCompleteness: 10,
  existingObligations: 5,
} as const;

export function getReadinessScore(input: {
  monthlyRevenue: number;
  monthsHistory: number;
  growth: number;
  hasGrowthData: boolean;
  masterOwnership: number;
  publishingOwnership: number;
  catalogYears: number;
  hasCatalogAge: boolean;
  completedFields: number;
  hasAdvance: boolean;
}) {
  const score =
    (input.monthsHistory > 0 ? fundingRules.revenueStability : 0) +
    (input.monthlyRevenue > 0 ? fundingRules.revenueScale : 0) +
    (input.hasGrowthData ? fundingRules.revenueGrowth : 0) +
    (input.masterOwnership > 0 || input.publishingOwnership > 0 ? fundingRules.catalogOwnership : 0) +
    (input.hasCatalogAge ? fundingRules.catalogLongevity : 0) +
    (input.completedFields / 6) * fundingRules.dataCompleteness +
    (input.hasAdvance ? 0 : fundingRules.existingObligations);
  return Math.round(Math.max(0, Math.min(score, 100)));
}

export function scoreLabel(score: number) {
  if (score >= 80) return "Strong profile";
  if (score >= 65) return "Potentially eligible";
  if (score >= 45) return "Needs more data";
  return "Not ready yet";
}
