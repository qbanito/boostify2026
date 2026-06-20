import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, AlertCircle } from "lucide-react";
import { Link } from "wouter";

type PlanTier = "free" | "artist" | "creator" | "professional" | "enterprise";
// Legacy aliases for backward compatibility
type LegacyPlan = "basic" | "pro" | "premium" | "Premium" | "Basic" | "Pro";

interface PlanTierGuardProps {
  requiredPlan: PlanTier | LegacyPlan;
  userSubscription: string | null;
  children: React.ReactNode;
  featureName: string;
  isAdmin?: boolean;
}

// Map legacy plan names to new tier keys
const LEGACY_MAP: Record<string, PlanTier> = {
  "basic": "creator",
  "Basic": "creator",
  "pro": "professional",
  "Pro": "professional",
  "premium": "enterprise",
  "Premium": "enterprise",
};

const PLAN_HIERARCHY: Record<PlanTier, number> = {
  "free": 0,
  "artist": 1,
  "creator": 2,
  "professional": 3,
  "enterprise": 4,
};

const PLAN_NAMES: Record<PlanTier, string> = {
  "free": "DISCOVER (Free)",
  "artist": "ARTIST ($19.99/mo)",
  "creator": "ELEVATE ($49.99/mo)",
  "professional": "AMPLIFY ($89.99/mo)",
  "enterprise": "DOMINATE ($149.99/mo)",
};

function resolvePlan(plan: string): PlanTier {
  if (plan in LEGACY_MAP) return LEGACY_MAP[plan];
  if (plan in PLAN_HIERARCHY) return plan as PlanTier;
  return "free";
}

export function PlanTierGuard({
  requiredPlan,
  userSubscription,
  children,
  featureName,
  isAdmin = false,
}: PlanTierGuardProps) {
  const resolvedRequired = resolvePlan(requiredPlan);
  const resolvedUser = resolvePlan(userSubscription || "free");
  const userPlanLevel = PLAN_HIERARCHY[resolvedUser];
  const requiredPlanLevel = PLAN_HIERARCHY[resolvedRequired];
  const hasAccess = isAdmin || userPlanLevel >= requiredPlanLevel;

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-orange-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-400">
          <Lock className="h-5 w-5" />
          {featureName} - Requires {PLAN_NAMES[resolvedRequired]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
          <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-orange-300 font-semibold">Feature Locked</p>
            <p className="text-xs text-orange-200/70 mt-1">
              You're currently on {PLAN_NAMES[resolvedUser]}. 
              Upgrade to {PLAN_NAMES[resolvedRequired]} to unlock {featureName}.
            </p>
          </div>
        </div>
        <Link href="/pricing">
          <Button className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
            View Subscription Plans
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
