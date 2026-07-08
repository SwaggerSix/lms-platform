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
  primaryTextColor: "#49641D",  // deep green — AA text contrast on light/wash

  sidebarBg: "#FBFCFA",         // page canvas (light shell)
  sidebarText: "#495057",       // gray 600 body
  sidebarActiveBg: "#F1F7E4",   // green wash
  sidebarActiveText: "#49641D", // deep green — AA text contrast on wash

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

/* ------------------------------------------------------------------ */
/*  Tenant color derivation                                            */
/* ------------------------------------------------------------------ */

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const int = parseInt(match[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Derive the companion brand shades from a tenant's single primary color:
 * hover (darker), light wash (very light tint), and text/active-text (dark
 * enough for AA contrast on the wash). Returns null for an invalid hex so
 * callers can fall back to the platform branding untouched.
 */
export function deriveBrandShades(
  primaryHex: string
): Pick<
  BrandingConfig,
  | "primaryColor"
  | "primaryHoverColor"
  | "primaryLightColor"
  | "primaryTextColor"
  | "sidebarActiveBg"
  | "sidebarActiveText"
> | null {
  const hsl = hexToHsl(primaryHex);
  if (!hsl) return null;
  const { h, s, l } = hsl;
  const hover = hslToHex(h, s, Math.max(0, l * 0.78));
  const light = hslToHex(h, Math.min(1, s * 0.7), 0.94);
  const text = hslToHex(h, s, Math.min(l, 0.26));
  return {
    primaryColor: hslToHex(h, s, l),
    primaryHoverColor: hover,
    primaryLightColor: light,
    primaryTextColor: text,
    sidebarActiveBg: light,
    sidebarActiveText: text,
  };
}

/**
 * Preset brand themes for quick selection.
 */
export const brandPresets: Record<string, Partial<BrandingConfig>> = {
  // gothamCulture brand presets. All use the same light shell and differ
  // only in the primary hue. Each key is named for the hue it applies and
  // every preset has a UNIQUE primaryColor — the branding UI both labels
  // buttons by key and marks the active one by primaryColor equality, so
  // duplicate colors would mislabel buttons and highlight several at once.
  // Text/active-text tokens are kept dark enough to clear WCAG AA (4.5:1)
  // on their light backgrounds.
  green: {
    primaryColor: "#91C53C",
    primaryHoverColor: "#739E2D",
    primaryLightColor: "#F1F7E4",
    primaryTextColor: "#49641D",
    sidebarBg: "#FBFCFA",
    sidebarText: "#495057",
    sidebarActiveBg: "#F1F7E4",
    sidebarActiveText: "#49641D",
  },
  forest: {
    primaryColor: "#739E2D",
    primaryHoverColor: "#5C7E24",
    primaryLightColor: "#F1F7E4",
    primaryTextColor: "#49641D",
    sidebarBg: "#FBFCFA",
    sidebarText: "#495057",
    sidebarActiveBg: "#F1F7E4",
    sidebarActiveText: "#49641D",
  },
  gold: {
    primaryColor: "#F0A800",
    primaryHoverColor: "#C78A00",
    primaryLightColor: "#FDF3DA",
    primaryTextColor: "#946700",
    sidebarBg: "#FBFCFA",
    sidebarText: "#495057",
    sidebarActiveBg: "#FDF3DA",
    sidebarActiveText: "#946700",
  },
  charcoal: {
    primaryColor: "#53585C",
    primaryHoverColor: "#3F4346",
    primaryLightColor: "#EEF0F1",
    primaryTextColor: "#3F4346",
    sidebarBg: "#FBFCFA",
    sidebarText: "#495057",
    sidebarActiveBg: "#EEF0F1",
    sidebarActiveText: "#3F4346",
  },
};
