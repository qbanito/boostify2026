import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import type { PresetId } from '../lib/theme-presets';

export const themeOptions = ['light', 'dark', 'system'] as const;
export const densityOptions = ['compact', 'comfortable'] as const;
export const languageOptions = ['es', 'en'] as const;
export const presetOptions = ['default', 'minimal', 'vibrant', 'neon', 'earth', 'monochrome', 'moon'] as const;

// Schema para validación
export const settingsSchema = z.object({
  profile: z.object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    language: z.enum(languageOptions).default('es'),
  }),
  notifications: z.object({
    emailNotifications: z.boolean().default(true),
    pushNotifications: z.boolean().default(true),
    newsletter: z.boolean().default(false),
  }),
  appearance: z.object({
    theme: z.enum(themeOptions).default('system'),
    density: z.enum(densityOptions).default('comfortable'),
  }),
  security: z.object({
    twoFactorEnabled: z.boolean().default(false),
    lastPasswordChange: z.date().optional(),
  }),
  // Dynamic UI style system
  style: z.object({
    activePreset: z.enum(presetOptions).default('default'),
    autoAdapt: z.boolean().default(false),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;

interface SettingsState extends Settings {
  updateProfile: (profile: Partial<Settings['profile']>) => void;
  updateNotifications: (notifications: Partial<Settings['notifications']>) => void;
  updateAppearance: (appearance: Partial<Settings['appearance']>) => void;
  updateSecurity: (security: Partial<Settings['security']>) => void;
  updateStyle: (style: Partial<Settings['style']>) => void;
  resetSettings: () => void;
}

// Estado inicial
const initialSettings: Settings = {
  profile: {
    name: '',
    email: '',
    language: 'es',
  },
  notifications: {
    emailNotifications: true,
    pushNotifications: true,
    newsletter: false,
  },
  appearance: {
    theme: 'system',
    density: 'comfortable',
  },
  security: {
    twoFactorEnabled: false,
  },
  style: {
    activePreset: 'default',
    autoAdapt: false,
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...initialSettings,
      
      updateProfile: (profile) => 
        set((state) => ({
          profile: { ...state.profile, ...profile }
        })),
      
      updateNotifications: (notifications) => 
        set((state) => ({
          notifications: { ...state.notifications, ...notifications }
        })),
      
      updateAppearance: (appearance) => 
        set((state) => ({
          appearance: { ...state.appearance, ...appearance }
        })),
      
      updateSecurity: (security) => 
        set((state) => ({
          security: { ...state.security, ...security }
        })),

      updateStyle: (style) =>
        set((state) => ({
          style: { ...state.style, ...style }
        })),
      
      resetSettings: () => set(initialSettings),
    }),
    {
      name: 'boostify-settings',
    }
  )
);