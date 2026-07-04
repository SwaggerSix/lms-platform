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
  /** Fetch the platform-wide branding saved in platform_settings and apply it. */
  loadFromServer: () => Promise<void>;
  /** Persist the current config platform-wide (admin only). Returns success. */
  saveToServer: () => Promise<boolean>;
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

      loadFromServer: async () => {
        try {
          const res = await fetch("/api/settings?key=branding");
          if (!res.ok) return;
          const data = await res.json();
          const value = data?.value;
          if (value && typeof value === "object" && Object.keys(value).length > 0) {
            set({ config: { ...defaultBranding, ...(value as Partial<BrandingConfig>) } });
            get().applyToDOM();
          }
        } catch {
          // Offline or unauthenticated — keep the locally cached config
        }
      },

      saveToServer: async () => {
        try {
          const res = await fetch("/api/settings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: "branding", value: get().config }),
          });
          return res.ok;
        } catch {
          return false;
        }
      },
    }),
    {
      name: "lms-branding",
      partialize: (state) => ({ config: state.config }),
    }
  )
);
