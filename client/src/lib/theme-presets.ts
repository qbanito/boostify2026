/**
 * BOOSTIFY Dynamic UI System — Theme Presets
 * 
 * Each preset defines all CSS custom properties used by shadcn/ui components.
 * The "default" preset matches the current index.css values exactly (no-op when active).
 * 
 * IMPORTANT: No UI components are modified. Only CSS variable VALUES change at runtime.
 */

export type PresetId = "default" | "minimal" | "vibrant" | "neon" | "earth" | "monochrome" | "moon";

export interface ThemePreset {
  id: PresetId;
  name: string;
  description: string;
  emoji: string;
  preview: {
    primary: string;     // hex for preview swatch
    bg: string;          // hex for preview bg
    card: string;        // hex for preview card
    accent: string;      // hex for accent swatch
  };
  variables: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
  /** Extra CSS class added to <html> for preset-specific overrides (buttons, etc.) */
  htmlClass: string;
  animations: "minimal" | "normal" | "enhanced";
  /** Force light or dark mode regardless of system preference. null = keep current */
  forceMode: "light" | "dark" | null;
  /** UI density: which decorative sections to show */
  density: "full" | "clean" | "minimal";
}

// ─── Current Boostify values (index.css) — used as the "default" preset ───
// When this preset is active, the ThemeEngine does NOT inject any inline styles.
const DEFAULT_LIGHT: Record<string, string> = {
  "--background": "0 0% 100%",
  "--foreground": "240 10% 3.9%",
  "--card": "0 0% 100%",
  "--card-foreground": "240 10% 3.9%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "240 10% 3.9%",
  "--primary": "24 96% 53%",
  "--primary-foreground": "0 0% 98%",
  "--secondary": "240 4.8% 95.9%",
  "--secondary-foreground": "240 5.9% 10%",
  "--muted": "240 4.8% 95.9%",
  "--muted-foreground": "240 3.8% 46.1%",
  "--accent": "240 4.8% 95.9%",
  "--accent-foreground": "240 5.9% 10%",
  "--destructive": "0 84.2% 60.2%",
  "--destructive-foreground": "0 0% 98%",
  "--border": "240 5.9% 90%",
  "--input": "240 5.9% 90%",
  "--ring": "24 96% 53%",
  "--radius": "0.5rem",
  "--chart-1": "24 96% 53%",
  "--chart-2": "245 58% 51%",
  "--chart-3": "120 100% 31%",
  "--chart-4": "340 82% 52%",
  "--chart-5": "291 64% 42%",
  "--sidebar-background": "240 10% 8%",
  "--sidebar-foreground": "0 0% 98%",
  "--sidebar-primary": "25 95% 53%",
  "--sidebar-primary-foreground": "0 0% 98%",
  "--sidebar-accent": "240 20% 15%",
  "--sidebar-accent-foreground": "0 0% 98%",
  "--sidebar-border": "240 12% 20%",
  "--sidebar-ring": "25 95% 53%",
};

const DEFAULT_DARK: Record<string, string> = {
  "--background": "240 10% 3.9%",
  "--foreground": "0 0% 98%",
  "--card": "240 10% 3.9%",
  "--card-foreground": "0 0% 98%",
  "--popover": "240 10% 3.9%",
  "--popover-foreground": "0 0% 98%",
  "--primary": "24 96% 53%",
  "--primary-foreground": "0 0% 98%",
  "--secondary": "240 3.7% 15.9%",
  "--secondary-foreground": "0 0% 98%",
  "--muted": "240 3.7% 15.9%",
  "--muted-foreground": "240 5% 64.9%",
  "--accent": "240 3.7% 15.9%",
  "--accent-foreground": "0 0% 98%",
  "--destructive": "0 62.8% 30.6%",
  "--destructive-foreground": "0 0% 98%",
  "--border": "240 3.7% 15.9%",
  "--input": "240 3.7% 15.9%",
  "--ring": "24 96% 53%",
  "--radius": "0.5rem",
  "--chart-1": "24 96% 53%",
  "--chart-2": "245 58% 51%",
  "--chart-3": "120 100% 31%",
  "--chart-4": "340 82% 52%",
  "--chart-5": "291 64% 42%",
  "--sidebar-background": "240 10% 8%",
  "--sidebar-foreground": "0 0% 98%",
  "--sidebar-primary": "25 95% 53%",
  "--sidebar-primary-foreground": "0 0% 98%",
  "--sidebar-accent": "240 20% 15%",
  "--sidebar-accent-foreground": "0 0% 98%",
  "--sidebar-border": "240 12% 20%",
  "--sidebar-ring": "25 95% 53%",
};

// ─── Presets ───

export const themePresets: Record<PresetId, ThemePreset> = {
  // ── DEFAULT: Current Boostify (orange, dark) ──
  default: {
    id: "default",
    name: "Boostify Classic",
    description: "The original Boostify look — bold orange on dark",
    emoji: "🔥",
    preview: { primary: "#f97316", bg: "#0a0a0f", card: "#111118", accent: "#6d28d9" },
    variables: { light: DEFAULT_LIGHT, dark: DEFAULT_DARK },
    htmlClass: "",
    animations: "normal",
    forceMode: null,
    density: "full",
  },

  // ── MINIMAL: Apple.com design language — precise, premium, light ──
  minimal: {
    id: "minimal",
    name: "Minimal",
    description: "Apple-precision design — clean, premium, trustworthy",
    emoji: "✨",
    preview: { primary: "#0071e3", bg: "#f5f5f7", card: "#ffffff", accent: "#86868b" },
    variables: {
      light: {
        ...DEFAULT_LIGHT,
        "--background": "240 10% 96%",         // #f5f5f7 — Apple surface gray
        "--foreground": "240 3% 12%",           // #1d1d1f — Apple headline black
        "--card": "0 0% 100%",                  // #ffffff — clean white
        "--card-foreground": "240 3% 12%",      // #1d1d1f
        "--popover": "0 0% 100%",               // #ffffff
        "--popover-foreground": "240 3% 12%",   // #1d1d1f
        "--primary": "211 100% 45%",            // #0071e3 — Apple blue
        "--primary-foreground": "0 0% 100%",    // white
        "--secondary": "240 6% 93%",            // #ededf0 — subtle off-white
        "--secondary-foreground": "240 3% 12%", // #1d1d1f
        "--muted": "240 5% 93%",                // #eeeef0
        "--muted-foreground": "240 2% 44%",     // #6e6e73 — Apple secondary text
        "--accent": "240 5% 93%",               // #ededf0
        "--accent-foreground": "240 3% 12%",    // #1d1d1f
        "--destructive": "0 72% 51%",           // Apple-style red
        "--destructive-foreground": "0 0% 100%",
        "--border": "240 5% 83%",               // #d2d2d7 — Apple border
        "--input": "240 5% 83%",                // same as border
        "--ring": "211 100% 45%",               // Apple blue
        "--radius": "0.75rem",                  // 12px base
        "--chart-1": "211 100% 45%",            // Blue
        "--chart-2": "259 56% 57%",             // Purple
        "--chart-3": "142 64% 40%",             // Green
        "--chart-4": "35 92% 50%",              // Amber
        "--chart-5": "195 85% 43%",             // Teal
        "--sidebar-background": "240 10% 96%",  // #f5f5f7
        "--sidebar-foreground": "240 3% 12%",   // #1d1d1f
        "--sidebar-primary": "211 100% 45%",    // Apple blue
        "--sidebar-primary-foreground": "0 0% 100%",
        "--sidebar-accent": "240 5% 93%",       // #ededf0
        "--sidebar-accent-foreground": "240 3% 12%",
        "--sidebar-border": "240 5% 90%",       // slightly lighter
        "--sidebar-ring": "211 100% 45%",       // Apple blue
      },
      dark: {
        ...DEFAULT_DARK,
        "--background": "240 6% 6%",
        "--foreground": "0 0% 96%",
        "--card": "240 5% 9%",
        "--card-foreground": "0 0% 96%",
        "--popover": "240 5% 9%",
        "--popover-foreground": "0 0% 96%",
        "--primary": "211 100% 50%",
        "--primary-foreground": "0 0% 100%",
        "--secondary": "240 4% 14%",
        "--secondary-foreground": "0 0% 96%",
        "--muted": "240 4% 14%",
        "--muted-foreground": "240 3% 55%",
        "--accent": "240 4% 14%",
        "--accent-foreground": "0 0% 96%",
        "--destructive": "0 63% 31%",
        "--destructive-foreground": "0 0% 98%",
        "--border": "240 4% 16%",
        "--input": "240 4% 16%",
        "--ring": "211 100% 50%",
        "--radius": "0.75rem",
        "--chart-1": "211 100% 50%",
        "--chart-2": "259 56% 57%",
        "--chart-3": "142 64% 40%",
        "--chart-4": "35 92% 50%",
        "--chart-5": "195 85% 43%",
        "--sidebar-background": "240 6% 5%",
        "--sidebar-foreground": "0 0% 96%",
        "--sidebar-primary": "211 100% 50%",
        "--sidebar-primary-foreground": "0 0% 100%",
        "--sidebar-accent": "240 5% 12%",
        "--sidebar-accent-foreground": "0 0% 96%",
        "--sidebar-border": "240 4% 16%",
        "--sidebar-ring": "211 100% 50%",
      },
    },
    htmlClass: "theme-minimal",
    animations: "minimal",
    forceMode: "light",
    density: "minimal",
  },

  // ── VIBRANT: Spotify/Figma inspired — energetic green ──
  vibrant: {
    id: "vibrant",
    name: "Vibrant",
    description: "Energetic & bold — Spotify-inspired green accents",
    emoji: "💚",
    preview: { primary: "#22c55e", bg: "#0c1117", card: "#131a22", accent: "#3b82f6" },
    variables: {
      light: {
        ...DEFAULT_LIGHT,
        "--primary": "142 71% 45%",
        "--primary-foreground": "0 0% 100%",
        "--ring": "142 71% 45%",
        "--radius": "0.5rem",
        "--chart-1": "142 71% 45%",
        "--chart-2": "217 91% 60%",
        "--chart-3": "48 96% 53%",
        "--chart-4": "340 82% 52%",
        "--chart-5": "262 83% 58%",
        "--sidebar-primary": "142 71% 45%",
        "--sidebar-ring": "142 71% 45%",
      },
      dark: {
        ...DEFAULT_DARK,
        "--background": "215 20% 5%",
        "--foreground": "0 0% 97%",
        "--card": "215 16% 8%",
        "--card-foreground": "0 0% 97%",
        "--popover": "215 16% 8%",
        "--popover-foreground": "0 0% 97%",
        "--primary": "142 71% 45%",
        "--primary-foreground": "0 0% 100%",
        "--secondary": "215 14% 14%",
        "--secondary-foreground": "0 0% 97%",
        "--muted": "215 14% 14%",
        "--muted-foreground": "215 10% 55%",
        "--accent": "215 14% 14%",
        "--accent-foreground": "0 0% 97%",
        "--destructive": "0 63% 31%",
        "--destructive-foreground": "0 0% 98%",
        "--border": "215 14% 16%",
        "--input": "215 14% 16%",
        "--ring": "142 71% 45%",
        "--radius": "0.5rem",
        "--chart-1": "142 71% 45%",
        "--chart-2": "217 91% 60%",
        "--chart-3": "48 96% 53%",
        "--chart-4": "340 82% 52%",
        "--chart-5": "262 83% 58%",
        "--sidebar-background": "215 18% 6%",
        "--sidebar-foreground": "0 0% 97%",
        "--sidebar-primary": "142 71% 45%",
        "--sidebar-primary-foreground": "0 0% 100%",
        "--sidebar-accent": "215 16% 12%",
        "--sidebar-accent-foreground": "0 0% 97%",
        "--sidebar-border": "215 14% 16%",
        "--sidebar-ring": "142 71% 45%",
      },
    },
    htmlClass: "theme-vibrant",
    animations: "enhanced",
    forceMode: "dark",
    density: "full",
  },

  // ── NEON: Cyberpunk/Gaming — cyan on pure black ──
  neon: {
    id: "neon",
    name: "Neon",
    description: "Cyberpunk vibes — neon cyan on deep black",
    emoji: "⚡",
    preview: { primary: "#06b6d4", bg: "#030304", card: "#0a0a0d", accent: "#d946ef" },
    variables: {
      light: {
        ...DEFAULT_LIGHT,
        "--primary": "187 92% 43%",
        "--primary-foreground": "0 0% 2%",
        "--ring": "187 92% 43%",
        "--radius": "0.25rem",
        "--chart-1": "187 92% 43%",
        "--chart-2": "292 84% 61%",
        "--chart-3": "142 71% 45%",
        "--chart-4": "48 96% 53%",
        "--chart-5": "0 84% 60%",
        "--sidebar-primary": "187 92% 43%",
        "--sidebar-ring": "187 92% 43%",
      },
      dark: {
        ...DEFAULT_DARK,
        "--background": "240 10% 1.5%",
        "--foreground": "0 0% 95%",
        "--card": "240 8% 4%",
        "--card-foreground": "0 0% 95%",
        "--popover": "240 8% 4%",
        "--popover-foreground": "0 0% 95%",
        "--primary": "187 92% 43%",
        "--primary-foreground": "0 0% 2%",
        "--secondary": "240 6% 10%",
        "--secondary-foreground": "0 0% 95%",
        "--muted": "240 6% 10%",
        "--muted-foreground": "240 4% 50%",
        "--accent": "240 6% 10%",
        "--accent-foreground": "0 0% 95%",
        "--destructive": "0 70% 40%",
        "--destructive-foreground": "0 0% 98%",
        "--border": "240 6% 12%",
        "--input": "240 6% 12%",
        "--ring": "187 92% 43%",
        "--radius": "0.25rem",
        "--chart-1": "187 92% 43%",
        "--chart-2": "292 84% 61%",
        "--chart-3": "142 71% 45%",
        "--chart-4": "48 96% 53%",
        "--chart-5": "0 84% 60%",
        "--sidebar-background": "240 10% 2%",
        "--sidebar-foreground": "0 0% 95%",
        "--sidebar-primary": "187 92% 43%",
        "--sidebar-primary-foreground": "0 0% 2%",
        "--sidebar-accent": "240 8% 8%",
        "--sidebar-accent-foreground": "0 0% 95%",
        "--sidebar-border": "240 6% 12%",
        "--sidebar-ring": "187 92% 43%",
      },
    },
    htmlClass: "theme-neon",
    animations: "enhanced",
    forceMode: "dark",
    density: "full",
  },

  // ── EARTH: Warm/Nature tones — LIGHT mode, warm cream paper ──
  earth: {
    id: "earth",
    name: "Earth",
    description: "Warm cream canvas — amber tones, serif headings, natural feel",
    emoji: "🌿",
    preview: { primary: "#d97706", bg: "#faf8f5", card: "#ffffff", accent: "#78716c" },
    variables: {
      light: {
        ...DEFAULT_LIGHT,
        "--background": "35 30% 97%",
        "--foreground": "25 15% 12%",
        "--card": "0 0% 100%",
        "--card-foreground": "25 15% 12%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "25 15% 12%",
        "--primary": "38 92% 44%",
        "--primary-foreground": "0 0% 100%",
        "--secondary": "35 20% 93%",
        "--secondary-foreground": "25 15% 15%",
        "--muted": "35 15% 93%",
        "--muted-foreground": "25 10% 45%",
        "--accent": "35 15% 93%",
        "--accent-foreground": "25 15% 15%",
        "--destructive": "0 84% 60%",
        "--destructive-foreground": "0 0% 98%",
        "--border": "35 15% 88%",
        "--input": "35 15% 88%",
        "--ring": "38 92% 44%",
        "--radius": "1rem",
        "--chart-1": "38 92% 44%",
        "--chart-2": "25 95% 53%",
        "--chart-3": "142 50% 38%",
        "--chart-4": "350 70% 50%",
        "--chart-5": "200 50% 45%",
        "--sidebar-background": "35 20% 95%",
        "--sidebar-foreground": "25 15% 12%",
        "--sidebar-primary": "38 92% 44%",
        "--sidebar-primary-foreground": "0 0% 100%",
        "--sidebar-accent": "35 15% 91%",
        "--sidebar-accent-foreground": "25 15% 12%",
        "--sidebar-border": "35 15% 88%",
        "--sidebar-ring": "38 92% 44%",
      },
      dark: {
        ...DEFAULT_DARK,
        "--background": "30 12% 4%",
        "--foreground": "40 10% 90%",
        "--card": "30 10% 7%",
        "--card-foreground": "40 10% 90%",
        "--popover": "30 10% 7%",
        "--popover-foreground": "40 10% 90%",
        "--primary": "38 92% 50%",
        "--primary-foreground": "0 0% 100%",
        "--secondary": "30 8% 14%",
        "--secondary-foreground": "40 10% 90%",
        "--muted": "30 8% 14%",
        "--muted-foreground": "30 6% 50%",
        "--accent": "30 8% 14%",
        "--accent-foreground": "40 10% 90%",
        "--destructive": "0 60% 35%",
        "--destructive-foreground": "0 0% 98%",
        "--border": "30 8% 16%",
        "--input": "30 8% 16%",
        "--ring": "38 92% 50%",
        "--radius": "1rem",
        "--chart-1": "38 92% 50%",
        "--chart-2": "25 95% 53%",
        "--chart-3": "142 50% 38%",
        "--chart-4": "350 70% 50%",
        "--chart-5": "200 50% 45%",
        "--sidebar-background": "30 12% 5%",
        "--sidebar-foreground": "40 10% 90%",
        "--sidebar-primary": "38 92% 50%",
        "--sidebar-primary-foreground": "0 0% 100%",
        "--sidebar-accent": "30 10% 11%",
        "--sidebar-accent-foreground": "40 10% 90%",
        "--sidebar-border": "30 8% 16%",
        "--sidebar-ring": "38 92% 50%",
      },
    },
    htmlClass: "theme-earth",
    animations: "normal",
    forceMode: "light",
    density: "clean",
  },

  // ── MONOCHROME: Pro/Editorial — LIGHT mode, newspaper-like ──
  monochrome: {
    id: "monochrome",
    name: "Monochrome",
    description: "Sharp editorial — pure black on white, newspaper style",
    emoji: "◼️",
    preview: { primary: "#18181b", bg: "#fafafa", card: "#ffffff", accent: "#52525b" },
    variables: {
      light: {
        ...DEFAULT_LIGHT,
        "--background": "0 0% 98%",
        "--foreground": "0 0% 9%",
        "--card": "0 0% 100%",
        "--card-foreground": "0 0% 9%",
        "--popover": "0 0% 100%",
        "--popover-foreground": "0 0% 9%",
        "--primary": "0 0% 9%",
        "--primary-foreground": "0 0% 98%",
        "--secondary": "0 0% 96%",
        "--secondary-foreground": "0 0% 9%",
        "--muted": "0 0% 96%",
        "--muted-foreground": "0 0% 45%",
        "--accent": "0 0% 96%",
        "--accent-foreground": "0 0% 9%",
        "--destructive": "0 84% 60%",
        "--destructive-foreground": "0 0% 98%",
        "--border": "0 0% 90%",
        "--input": "0 0% 90%",
        "--ring": "0 0% 9%",
        "--radius": "0rem",
        "--chart-1": "0 0% 9%",
        "--chart-2": "0 0% 30%",
        "--chart-3": "0 0% 50%",
        "--chart-4": "0 0% 65%",
        "--chart-5": "0 0% 80%",
        "--sidebar-background": "0 0% 97%",
        "--sidebar-foreground": "0 0% 9%",
        "--sidebar-primary": "0 0% 9%",
        "--sidebar-primary-foreground": "0 0% 98%",
        "--sidebar-accent": "0 0% 95%",
        "--sidebar-accent-foreground": "0 0% 9%",
        "--sidebar-border": "0 0% 90%",
        "--sidebar-ring": "0 0% 9%",
      },
      dark: {
        ...DEFAULT_DARK,
        "--background": "0 0% 3.5%",
        "--foreground": "0 0% 93%",
        "--card": "0 0% 5.5%",
        "--card-foreground": "0 0% 93%",
        "--popover": "0 0% 5.5%",
        "--popover-foreground": "0 0% 93%",
        "--primary": "0 0% 90%",
        "--primary-foreground": "0 0% 5%",
        "--secondary": "0 0% 12%",
        "--secondary-foreground": "0 0% 93%",
        "--muted": "0 0% 12%",
        "--muted-foreground": "0 0% 50%",
        "--accent": "0 0% 12%",
        "--accent-foreground": "0 0% 93%",
        "--destructive": "0 60% 35%",
        "--destructive-foreground": "0 0% 98%",
        "--border": "0 0% 14%",
        "--input": "0 0% 14%",
        "--ring": "0 0% 90%",
        "--radius": "0rem",
        "--chart-1": "0 0% 90%",
        "--chart-2": "0 0% 70%",
        "--chart-3": "0 0% 55%",
        "--chart-4": "0 0% 40%",
        "--chart-5": "0 0% 25%",
        "--sidebar-background": "0 0% 4%",
        "--sidebar-foreground": "0 0% 93%",
        "--sidebar-primary": "0 0% 90%",
        "--sidebar-primary-foreground": "0 0% 5%",
        "--sidebar-accent": "0 0% 10%",
        "--sidebar-accent-foreground": "0 0% 93%",
        "--sidebar-border": "0 0% 14%",
        "--sidebar-ring": "0 0% 90%",
      },
    },
    htmlClass: "theme-monochrome",
    animations: "minimal",
    forceMode: "light",
    density: "minimal",
  },

  // ── MOON: Dark Side of the Moon — dusty mauve & plum on deep black ──
  moon: {
    id: "moon",
    name: "Lado Oculto",
    description: "Dark side of the moon — dusty mauve, plum & soft rose",
    emoji: "🌑",
    preview: { primary: "#A17F8D", bg: "#0D060A", card: "#1A0F16", accent: "#C1ABBA" },
    variables: {
      light: {
        ...DEFAULT_LIGHT,
        "--primary": "330 15% 56%",
        "--primary-foreground": "0 0% 100%",
        "--secondary": "320 10% 92%",
        "--secondary-foreground": "316 28% 18%",
        "--muted": "320 8% 92%",
        "--muted-foreground": "320 10% 45%",
        "--accent": "318 13% 85%",
        "--accent-foreground": "316 28% 18%",
        "--border": "320 10% 88%",
        "--input": "320 10% 88%",
        "--ring": "330 15% 56%",
        "--radius": "0.625rem",
        "--chart-1": "330 15% 56%",
        "--chart-2": "316 28% 28%",
        "--chart-3": "15 20% 68%",
        "--chart-4": "318 13% 71%",
        "--chart-5": "8 16% 79%",
        "--sidebar-primary": "330 15% 56%",
        "--sidebar-ring": "330 15% 56%",
      },
      dark: {
        ...DEFAULT_DARK,
        "--background": "316 30% 3%",
        "--foreground": "15 18% 88%",
        "--card": "316 25% 6%",
        "--card-foreground": "15 18% 88%",
        "--popover": "316 25% 6%",
        "--popover-foreground": "15 18% 88%",
        "--primary": "330 15% 56%",
        "--primary-foreground": "0 0% 100%",
        "--secondary": "316 18% 12%",
        "--secondary-foreground": "15 18% 88%",
        "--muted": "316 18% 12%",
        "--muted-foreground": "318 10% 50%",
        "--accent": "316 18% 12%",
        "--accent-foreground": "15 18% 88%",
        "--destructive": "0 60% 35%",
        "--destructive-foreground": "0 0% 98%",
        "--border": "316 15% 15%",
        "--input": "316 15% 15%",
        "--ring": "330 15% 56%",
        "--radius": "0.625rem",
        "--chart-1": "330 15% 56%",
        "--chart-2": "316 28% 28%",
        "--chart-3": "15 20% 68%",
        "--chart-4": "318 13% 71%",
        "--chart-5": "8 16% 79%",
        "--sidebar-background": "316 30% 4%",
        "--sidebar-foreground": "15 18% 88%",
        "--sidebar-primary": "330 15% 56%",
        "--sidebar-primary-foreground": "0 0% 100%",
        "--sidebar-accent": "316 20% 10%",
        "--sidebar-accent-foreground": "15 18% 88%",
        "--sidebar-border": "316 15% 15%",
        "--sidebar-ring": "330 15% 56%",
      },
    },
    htmlClass: "theme-moon",
    animations: "normal",
    forceMode: "dark",
    density: "clean",
  },
};

/** All preset IDs in display order */
export const presetIds: PresetId[] = ["default", "minimal", "vibrant", "neon", "earth", "monochrome", "moon"];

/** Get a preset by ID, fallback to default */
export function getPreset(id: string | null | undefined): ThemePreset {
  if (id && id in themePresets) return themePresets[id as PresetId];
  return themePresets.default;
}

/** All CSS variable keys that the engine manages */
export const MANAGED_CSS_VARS = Object.keys(DEFAULT_DARK);
