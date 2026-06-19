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
 * Default branding — gothamCulture green theme (light shell).
 */
export const defaultBranding: BrandingConfig = {
  portalName: "LearnHub",
  tagline: "Empowering continuous learning for federal agencies",
  logoUrl: null,
  faviconUrl: null,

  primaryColor: "#91C53C",      // brand green
  primaryHoverColor: "#739E2D", // green dark
  primaryLightColor: "#F1F7E4", // green wash
  primaryTextColor: "#739E2D",  // green dark (readable on light)

  sidebarBg: "#FBFCFA",         // page canvas (light shell)
  sidebarText: "#495057",       // gray 600 body
  sidebarActiveBg: "#F1F7E4",   // green wash
  sidebarActiveText: "#739E2D", // green dark

  loginBgStyle: "gradient",
  loginBgImageUrl: null,
  loginBgColor: "linear-gradient(135deg, #F1F7E4 0%, #FBFCFA 100%)",

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
  // The exact gothamCulture brand tokens. All presets use a light shell;
  // they differ only in the primary/accent hue, kept brand-coherent.
  indigo: {
    primaryColor: "#91C53C",
    primaryHoverColor: "#739E2D",
    primaryLightColor: "#F1F7E4",
    primaryTextColor: "#739E2D",
    sidebarBg: "#FBFCFA",
    sidebarText: "#495057",
    sidebarActiveBg: "#F1F7E4",
    sidebarActiveText: "#739E2D",
  },
  green: {
    primaryColor: "#91C53C",
    primaryHoverColor: "#739E2D",
    primaryLightColor: "#F1F7E4",
    primaryTextColor: "#739E2D",
    sidebarBg: "#FBFCFA",
    sidebarText: "#495057",
    sidebarActiveBg: "#F1F7E4",
    sidebarActiveText: "#739E2D",
  },
  // Gold accent variant — brand secondary hue on the same light shell.
  blue: {
    primaryColor: "#F0A800",
    primaryHoverColor: "#C78A00",
    primaryLightColor: "#FDF3DA",
    primaryTextColor: "#946700",
    sidebarBg: "#FBFCFA",
    sidebarText: "#495057",
    sidebarActiveBg: "#FDF3DA",
    sidebarActiveText: "#946700",
  },
  // Charcoal/neutral variant — for a more muted brand chrome.
  red: {
    primaryColor: "#53585C",
    primaryHoverColor: "#3F4346",
    primaryLightColor: "#F1F7E4",
    primaryTextColor: "#53585C",
    sidebarBg: "#FBFCFA",
    sidebarText: "#495057",
    sidebarActiveBg: "#F1F7E4",
    sidebarActiveText: "#739E2D",
  },
  // Deeper green variant.
  purple: {
    primaryColor: "#739E2D",
    primaryHoverColor: "#5C7E24",
    primaryLightColor: "#F1F7E4",
    primaryTextColor: "#5C7E24",
    sidebarBg: "#FBFCFA",
    sidebarText: "#495057",
    sidebarActiveBg: "#F1F7E4",
    sidebarActiveText: "#5C7E24",
  },
  teal: {
    primaryColor: "#91C53C",
    primaryHoverColor: "#739E2D",
    primaryLightColor: "#F1F7E4",
    primaryTextColor: "#739E2D",
    sidebarBg: "#FBFCFA",
    sidebarText: "#495057",
    sidebarActiveBg: "#F1F7E4",
    sidebarActiveText: "#739E2D",
  },
};
