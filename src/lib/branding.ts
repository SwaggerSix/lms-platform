/**
 * Branding configuration system.
 * Supports per-organization custom branding for the learning portal.
 */

export interface BrandingConfig {
  /** Organization/portal display name */
  portalName: string;
  /** Tagline shown on login/registration pages */
  tagline: string;
  /** URL to logo image (displayed in sidebar and auth pages) */
  logoUrl: string | null;
  /** URL to favicon */
  faviconUrl: string | null;

  /** Primary brand color (hex). Used for buttons, links, active states */
  primaryColor: string;
  /** Primary hover color (hex) */
  primaryHoverColor: string;
  /** Primary light/background tint (hex) */
  primaryLightColor: string;
  /** Primary text on light bg (hex) */
  primaryTextColor: string;

  /** Sidebar background color (hex) */
  sidebarBg: string;
  /** Sidebar text color (hex) */
  sidebarText: string;
  /** Sidebar active item bg (hex) */
  sidebarActiveBg: string;
  /** Sidebar active item text (hex) */
  sidebarActiveText: string;

  /** Login page background style */
  loginBgStyle: "gradient" | "solid" | "image";
  /** Login background image URL (if style is "image") */
  loginBgImageUrl: string | null;
  /** Login background gradient or solid color */
  loginBgColor: string;

  /** Support email */
  supportEmail: string;
  /** Custom footer text */
  footerText: string;
}

/**
 * Default branding — LearnHub indigo theme.
 */
export const defaultBranding: BrandingConfig = {
  portalName: "LearnHub",
  tagline: "Empowering continuous learning for federal agencies",
  logoUrl: null,
  faviconUrl: null,

  primaryColor: "#4f46e5",      // indigo-600
  primaryHoverColor: "#4338ca", // indigo-700
  primaryLightColor: "#eef2ff", // indigo-50
  primaryTextColor: "#4338ca",  // indigo-700

  sidebarBg: "#111827",         // gray-900
  sidebarText: "#9ca3af",       // gray-400
  sidebarActiveBg: "rgba(79, 70, 229, 0.2)", // indigo-600/20
  sidebarActiveText: "#818cf8", // indigo-400

  loginBgStyle: "gradient",
  loginBgImageUrl: null,
  loginBgColor: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",

  supportEmail: "support@learnhub.gov",
  footerText: "© {year} LearnHub. All rights reserved.",
};

/**
 * Converts branding config to CSS custom properties.
 */
export function brandingToCSSVars(config: BrandingConfig): Record<string, string> {
  return {
    "--brand-primary": config.primaryColor,
    "--brand-primary-hover": config.primaryHoverColor,
    "--brand-primary-light": config.primaryLightColor,
    "--brand-primary-text": config.primaryTextColor,
    "--brand-sidebar-bg": config.sidebarBg,
    "--brand-sidebar-text": config.sidebarText,
    "--brand-sidebar-active-bg": config.sidebarActiveBg,
    "--brand-sidebar-active-text": config.sidebarActiveText,
  };
}

/**
 * Preset brand themes for quick selection.
 */
export const brandPresets: Record<string, Partial<BrandingConfig>> = {
  indigo: {
    primaryColor: "#4f46e5",
    primaryHoverColor: "#4338ca",
    primaryLightColor: "#eef2ff",
    primaryTextColor: "#4338ca",
    sidebarBg: "#111827",
    sidebarActiveText: "#818cf8",
  },
  blue: {
    primaryColor: "#2563eb",
    primaryHoverColor: "#1d4ed8",
    primaryLightColor: "#eff6ff",
    primaryTextColor: "#1d4ed8",
    sidebarBg: "#0f172a",
    sidebarActiveText: "#60a5fa",
  },
  green: {
    primaryColor: "#059669",
    primaryHoverColor: "#047857",
    primaryLightColor: "#ecfdf5",
    primaryTextColor: "#047857",
    sidebarBg: "#022c22",
    sidebarActiveText: "#34d399",
  },
  red: {
    primaryColor: "#dc2626",
    primaryHoverColor: "#b91c1c",
    primaryLightColor: "#fef2f2",
    primaryTextColor: "#b91c1c",
    sidebarBg: "#1c1917",
    sidebarActiveText: "#f87171",
  },
  purple: {
    primaryColor: "#7c3aed",
    primaryHoverColor: "#6d28d9",
    primaryLightColor: "#f5f3ff",
    primaryTextColor: "#6d28d9",
    sidebarBg: "#1e1b4b",
    sidebarActiveText: "#a78bfa",
  },
  teal: {
    primaryColor: "#0d9488",
    primaryHoverColor: "#0f766e",
    primaryLightColor: "#f0fdfa",
    primaryTextColor: "#0f766e",
    sidebarBg: "#042f2e",
    sidebarActiveText: "#2dd4bf",
  },
};
