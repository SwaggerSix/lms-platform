/**
 * Canonical catalog of toggleable platform features.
 *
 * This is the single source of truth for per-tenant feature flags. Each entry
 * has a stable `key` (snake_case) that is stored in `tenants.features` and
 * `platform_settings[features]` as `{ [key]: boolean }`, referenced by the
 * sidebar `featureKey` values, and used to gate routes in middleware.
 *
 * To add a new toggleable feature: add an entry here, point the relevant nav
 * item's `featureKey` at it (src/components/layout/sidebar.tsx), and add a
 * route mapping in src/lib/features/routes.ts so it is enforced.
 */

export interface FeatureDefinition {
  key: string;
  name: string;
  description: string;
  category: FeatureCategory;
  /** Default state when neither the tenant nor the platform has an override. */
  defaultEnabled: boolean;
}

export type FeatureCategory =
  | "Learning"
  | "Assessment"
  | "Engagement"
  | "Social"
  | "Commerce"
  | "AI & Analytics"
  | "Platform";

export const FEATURE_CATALOG: FeatureDefinition[] = [
  // Learning
  { key: "learning_paths", name: "Learning Paths", description: "Guided, sequenced course journeys", category: "Learning", defaultEnabled: true },
  { key: "microlearning", name: "Microlearning", description: "Bite-sized lessons and daily learning", category: "Learning", defaultEnabled: true },
  { key: "ilt_sessions", name: "ILT Sessions", description: "Instructor-led training sessions and scheduling", category: "Learning", defaultEnabled: true },
  { key: "content_authoring", name: "Content Authoring", description: "In-app course and content authoring tools", category: "Learning", defaultEnabled: true },

  // Assessment
  { key: "evaluations", name: "Evaluations", description: "Post-training evaluation surveys (Kirkpatrick L1–L4)", category: "Assessment", defaultEnabled: true },
  { key: "observations", name: "Observations", description: "Observation checklists and on-the-job assessments", category: "Assessment", defaultEnabled: true },
  { key: "feedback_360", name: "360° Feedback", description: "Multi-rater 360-degree feedback", category: "Assessment", defaultEnabled: true },

  // Engagement
  { key: "gamification", name: "Gamification", description: "Points, badges, and leaderboards", category: "Engagement", defaultEnabled: true },
  { key: "skills_tracking", name: "Skills Tracking", description: "Skills engine and competency frameworks", category: "Engagement", defaultEnabled: true },
  { key: "course_ratings", name: "Course Ratings", description: "Let learners rate and review courses", category: "Engagement", defaultEnabled: true },
  { key: "nudges", name: "Nudges", description: "Behavioral nudges and reminders", category: "Engagement", defaultEnabled: true },

  // Social
  { key: "social_learning", name: "Social Learning", description: "Discussion forums, messages, and peer interaction", category: "Social", defaultEnabled: true },
  { key: "mentorship", name: "Mentorship", description: "Mentor–mentee pairing and tracking", category: "Social", defaultEnabled: true },

  // Commerce
  { key: "ecommerce", name: "E-Commerce", description: "Course shop with pricing and checkout", category: "Commerce", defaultEnabled: true },
  { key: "marketplace", name: "Marketplace", description: "Third-party / external content marketplace", category: "Commerce", defaultEnabled: true },

  // AI & Analytics
  { key: "ai_chat", name: "AI Chat", description: "AI learning assistant and chatbot", category: "AI & Analytics", defaultEnabled: true },
  { key: "predictive_analytics", name: "Predictive Analytics", description: "Recommendations and predictive insights", category: "AI & Analytics", defaultEnabled: true },

  // Platform
  { key: "self_registration", name: "Self-Registration", description: "Allow users to create their own accounts", category: "Platform", defaultEnabled: false },
];

export const FEATURE_KEYS: string[] = FEATURE_CATALOG.map((f) => f.key);

export const FEATURE_KEY_SET: Set<string> = new Set(FEATURE_KEYS);

/** Ordered list of categories as they should appear in admin UIs. */
export const FEATURE_CATEGORIES: FeatureCategory[] = [
  "Learning",
  "Assessment",
  "Engagement",
  "Social",
  "Commerce",
  "AI & Analytics",
  "Platform",
];

/** The default enabled-state map (catalog defaults only, no overrides). */
export function defaultFeatureMap(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const f of FEATURE_CATALOG) map[f.key] = f.defaultEnabled;
  return map;
}

/**
 * Normalize a stored `features` value into a `{ key: boolean }` map.
 *
 * Tolerates both the canonical map shape and the legacy array shape
 * (`[{ id, name, enabled }]`) that older platform_settings rows may use,
 * best-effort mapping legacy display names onto catalog keys.
 */
export function normalizeFeatures(value: unknown): Record<string, boolean> {
  if (!value) return {};

  // Canonical shape: { key: boolean }
  if (!Array.isArray(value) && typeof value === "object") {
    const out: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = Boolean(v);
    }
    return out;
  }

  // Legacy array shape: [{ id, name, description, enabled }]
  if (Array.isArray(value)) {
    const out: Record<string, boolean> = {};
    for (const item of value as Array<Record<string, unknown>>) {
      if (!item) continue;
      const key =
        (typeof item.key === "string" && item.key) ||
        legacyNameToKey(typeof item.name === "string" ? item.name : "");
      if (key) out[key] = Boolean(item.enabled);
    }
    return out;
  }

  return {};
}

const LEGACY_NAME_OVERRIDES: Record<string, string> = {
  "self registration": "self_registration",
  "self-registration": "self_registration",
  "360 feedback": "feedback_360",
  "e-commerce": "ecommerce",
  "ecommerce": "ecommerce",
  "ai chat": "ai_chat",
  "ilt sessions": "ilt_sessions",
};

function legacyNameToKey(name: string): string {
  if (!name) return "";
  const lower = name.trim().toLowerCase();
  if (LEGACY_NAME_OVERRIDES[lower]) return LEGACY_NAME_OVERRIDES[lower];
  const slug = lower.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return FEATURE_KEY_SET.has(slug) ? slug : "";
}
