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
        const config = get().config;
        const root = document.documentElement;
        // Shell variables differ per theme; the theme toggle re-invokes this
        // after switching the `dark` class.
        const vars = brandingToCSSVars(config, {
          dark: root.classList.contains("dark"),
        });
        Object.entries(vars).forEach(([key, value]) => {
          root.style.setProperty(key, value);
        });
        // Keep the browser/PWA chrome on the brand color too.
        const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
        if (themeMeta) themeMeta.content = config.primaryColor;
      },

      loadFromServer: async () => {
        try {
          // Resolves platform branding plus the caller's tenant overrides
          // (tenants.primary_color etc.), so tenant white-labeling re-themes
          // the app for that tenant's users.
          const res = await fetch("/api/branding");
          if (!res.ok) return;
          const data = await res.json();
          const value = data?.branding;
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
