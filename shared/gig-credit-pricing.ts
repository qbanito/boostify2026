/**
 * BOOSTIFY Gig Credit Pricing System
 * ====================================
 * Credits for marketplace gig applications.
 * 
 * 1 GIG CREDIT = $1 USD
 * Application cost = 5% of job budget (min 1 credit)
 * Platform commission = 20% on completed services
 */

// ── Credit Packages ──
export interface GigCreditPackage {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  priceUsd: number;
  savings: string;       // "0%", "8%", "14%", etc.
  popular?: boolean;
}

export const GIG_CREDIT_PACKAGES: GigCreditPackage[] = [
  {
    id: "gig_10",
    name: "Starter",
    credits: 10,
    bonusCredits: 0,
    priceUsd: 10,
    savings: "0%",
  },
  {
    id: "gig_25",
    name: "Basic",
    credits: 25,
    bonusCredits: 2,
    priceUsd: 25,
    savings: "8%",
  },
  {
    id: "gig_50",
    name: "Pro",
    credits: 50,
    bonusCredits: 7,
    priceUsd: 50,
    savings: "14%",
    popular: true,
  },
  {
    id: "gig_100",
    name: "Business",
    credits: 100,
    bonusCredits: 20,
    priceUsd: 100,
    savings: "20%",
  },
  {
    id: "gig_250",
    name: "Enterprise",
    credits: 250,
    bonusCredits: 75,
    priceUsd: 250,
    savings: "30%",
  },
];

// ── Application Cost Formula ──
// 5% of job budget, min 1 credit, max 50 credits
export function calculateApplicationCost(jobBudgetUsd: number): number {
  const cost = Math.ceil(jobBudgetUsd * 0.05);
  return Math.max(1, Math.min(cost, 50));
}

// ── Platform Commission ──
export const PLATFORM_COMMISSION_RATE = 0.20; // 20%

export function calculateCommission(serviceAmount: number): {
  platformFee: number;
  musicianPayout: number;
} {
  const platformFee = Math.round(serviceAmount * PLATFORM_COMMISSION_RATE * 100) / 100;
  const musicianPayout = Math.round((serviceAmount - platformFee) * 100) / 100;
  return { platformFee, musicianPayout };
}

// ── Free Credit Rewards ──
export interface CreditReward {
  type: string;
  credits: number;
  title: string;
  description: string;
  icon: string;
  oneTime: boolean;  // Can only claim once
}

export const CREDIT_REWARDS: CreditReward[] = [
  {
    type: "signup",
    credits: 5,
    title: "Welcome Bonus",
    description: "Sign up and create your account",
    icon: "🎉",
    oneTime: true,
  },
  {
    type: "complete_profile",
    credits: 3,
    title: "Complete Profile",
    description: "Fill out your bio, photo, and skills",
    icon: "👤",
    oneTime: true,
  },
  {
    type: "first_portfolio",
    credits: 2,
    title: "First Portfolio Upload",
    description: "Upload your first audio demo or video",
    icon: "🎵",
    oneTime: true,
  },
  {
    type: "referral",
    credits: 5,
    title: "Refer a Musician",
    description: "Earn credits when your referral signs up",
    icon: "🤝",
    oneTime: false,
  },
  {
    type: "five_star_review",
    credits: 2,
    title: "5-Star Review",
    description: "Receive a 5-star review on a completed gig",
    icon: "⭐",
    oneTime: false,
  },
  {
    type: "daily_streak_7",
    credits: 3,
    title: "7-Day Login Streak",
    description: "Log in for 7 consecutive days",
    icon: "🔥",
    oneTime: false,
  },
  {
    type: "social_share",
    credits: 1,
    title: "Social Share",
    description: "Share your profile on social media",
    icon: "📱",
    oneTime: false,
  },
  {
    type: "first_gig_complete",
    credits: 5,
    title: "First Gig Completed",
    description: "Successfully complete your first service",
    icon: "🏆",
    oneTime: true,
  },
];
