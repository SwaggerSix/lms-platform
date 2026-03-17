import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type BrandingConfig,
  defaultBranding,
  brandingToCSSVars,
} from "@/lib/branding";

interface BrandingState {
  config: BrandingConfig;
  setConfig: (config: Partial<BrandingConfig>) => void;
  resetConfig: () => void;
  applyToDOM: () => void;
}

export const useBrandingStore = create<BrandingState>()(
  persist(
    (set, get) => ({
      config: defaultBranding,

      setConfig: (partial) => {
        set((state) => ({
          config: { ...state.config, ...partial },
        }));
        // Auto-apply CSS vars when config changes
        get().applyToDOM();
      },

      resetConfig: () => {
        set({ config: defaultBranding });
        get().applyToDOM();
      },

      applyToDOM: () => {
        const vars = brandingToCSSVars(get().config);
        const root = document.documentElement;
        Object.entries(vars).forEach(([key, value]) => {
          root.style.setProperty(key, value);
        });
      },
    }),
    {
      name: "lms-branding",
      partialize: (state) => ({ config: state.config }),
    }
  )
);
