/**
 * Maps URL path prefixes to the feature key that gates them.
 *
 * Used by middleware to enforce per-tenant feature flags: if a tenant's user
 * requests a path whose feature is disabled, page requests redirect to the
 * dashboard and API requests get a 403.
 *
 * Order matters only for readability — `getFeatureForPath` picks the longest
 * matching prefix so more specific paths win.
 */

interface RouteFeature {
  prefix: string;
  feature: string;
}

// Page routes (under the (dashboard) route group).
const PAGE_ROUTES: RouteFeature[] = [
  { prefix: "/learn/catalog", feature: "courses" },
  { prefix: "/learn/my-courses", feature: "courses" },
  { prefix: "/learn/player", feature: "courses" },
  { prefix: "/learn/transcript", feature: "courses" },
  { prefix: "/learn/classes", feature: "classes" },
  { prefix: "/learn/assessments", feature: "assessments" },
  { prefix: "/learn/certifications", feature: "certifications" },
  { prefix: "/learn/documents", feature: "documents" },
  { prefix: "/learn/knowledge-base", feature: "knowledge_base" },
  { prefix: "/learn/achievements", feature: "gamification" },
  { prefix: "/learn/discussions", feature: "social_learning" },
  { prefix: "/learn/messages", feature: "social_learning" },
  { prefix: "/learn/chat", feature: "ai_chat" },
  { prefix: "/learn/mentorship", feature: "mentorship" },
  { prefix: "/learn/microlearning", feature: "microlearning" },
  { prefix: "/learn/marketplace", feature: "marketplace" },
  { prefix: "/learn/feedback", feature: "feedback_360" },
  { prefix: "/learn/observations", feature: "observations" },
  { prefix: "/learn/evaluations", feature: "evaluations" },
  { prefix: "/learn/nudges", feature: "nudges" },
  { prefix: "/learn/ilt-sessions", feature: "ilt_sessions" },
  { prefix: "/learn/paths", feature: "learning_paths" },
  { prefix: "/learn/recommendations", feature: "predictive_analytics" },
  { prefix: "/shop", feature: "ecommerce" },
];

// API routes.
const API_ROUTES: RouteFeature[] = [
  { prefix: "/api/classes", feature: "classes" },
  { prefix: "/api/assessments", feature: "assessments" },
  { prefix: "/api/ratings", feature: "course_ratings" },
  { prefix: "/api/gamification", feature: "gamification" },
  { prefix: "/api/discussions", feature: "social_learning" },
  { prefix: "/api/messages", feature: "social_learning" },
  { prefix: "/api/ai", feature: "ai_chat" },
  { prefix: "/api/chat", feature: "ai_chat" },
  { prefix: "/api/mentorship", feature: "mentorship" },
  { prefix: "/api/microlearning", feature: "microlearning" },
  { prefix: "/api/marketplace", feature: "marketplace" },
  { prefix: "/api/feedback", feature: "feedback_360" },
  { prefix: "/api/observations", feature: "observations" },
  { prefix: "/api/evaluations", feature: "evaluations" },
  { prefix: "/api/nudges", feature: "nudges" },
  { prefix: "/api/ilt-sessions", feature: "ilt_sessions" },
  { prefix: "/api/paths", feature: "learning_paths" },
  { prefix: "/api/recommendations", feature: "predictive_analytics" },
  { prefix: "/api/shop", feature: "ecommerce" },
  { prefix: "/api/skills", feature: "skills_tracking" },
];

const ALL_ROUTES: RouteFeature[] = [...PAGE_ROUTES, ...API_ROUTES].sort(
  (a, b) => b.prefix.length - a.prefix.length
);

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

/**
 * Return the feature key that gates the given pathname, or null if the path
 * is not feature-gated. Picks the most specific (longest) matching prefix.
 */
export function getFeatureForPath(pathname: string): string | null {
  for (const route of ALL_ROUTES) {
    if (matchesPrefix(pathname, route.prefix)) return route.feature;
  }
  return null;
}
