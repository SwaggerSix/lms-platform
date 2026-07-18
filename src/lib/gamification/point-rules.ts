import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Point rules engine.
 *
 * Admins configure how many points each action awards on the Gamification page,
 * which persists to platform_settings under the `point_rules` key. The awarding
 * sites call awardForAction(), which resolves the configured points for the
 * action's canonical `key` (falling back to the built-in default) and skips the
 * award entirely when the rule is disabled — so the saved rules actually drive
 * awards instead of being decorative.
 */

export const POINT_RULES_SETTINGS_KEY = "point_rules";
export const GAMIFICATION_SETTINGS_KEY = "gamification";

// Default points per level. Admins can override via platform_settings key
// "gamification" → { points_per_level }; callers with a service client should
// resolve the configured value with getPointsPerLevel() and pass it in.
export const POINTS_PER_LEVEL = 500;

// Overrides below this would make levels meaninglessly cheap (or, at 0,
// divide by zero) — treat them as misconfiguration and fall back.
const MIN_POINTS_PER_LEVEL = 10;

export function levelForPoints(
  points: number,
  pointsPerLevel: number = POINTS_PER_LEVEL
): number {
  const per =
    Number.isFinite(pointsPerLevel) && pointsPerLevel >= MIN_POINTS_PER_LEVEL
      ? Math.floor(pointsPerLevel)
      : POINTS_PER_LEVEL;
  return Math.floor(Math.max(0, points) / per) + 1;
}

/** Resolve the configured points-per-level, falling back to the default. */
export async function getPointsPerLevel(service: SupabaseClient): Promise<number> {
  try {
    const { data } = await service
      .from("platform_settings")
      .select("value")
      .eq("key", GAMIFICATION_SETTINGS_KEY)
      .maybeSingle();
    const raw = Number((data?.value as { points_per_level?: unknown } | null)?.points_per_level);
    if (Number.isFinite(raw) && raw >= MIN_POINTS_PER_LEVEL) return Math.floor(raw);
  } catch {
    // fall through to default
  }
  return POINTS_PER_LEVEL;
}

export interface PointRuleConfig {
  /** Canonical action key emitted into points_ledger.action_type. */
  key: string;
  /** Human label shown in the admin UI. */
  action: string;
  points: number;
  description: string;
  enabled: boolean;
}

/**
 * Built-in defaults. The point values match the previously-hardcoded award
 * amounts, so behaviour is unchanged until an admin edits a rule. Each `key`
 * corresponds to an action_type emitted by an award site.
 */
export const DEFAULT_POINT_RULES: PointRuleConfig[] = [
  { key: "enrollment", action: "Enrollment", points: 10, description: "Awarded when a learner enrolls in a new course", enabled: true },
  { key: "lesson_completion", action: "Lesson Completion", points: 10, description: "Awarded for completing a lesson", enabled: true },
  { key: "course_completion", action: "Course Completion", points: 50, description: "Awarded when a learner completes every lesson in a course", enabled: true },
  { key: "quiz_pass", action: "Quiz Pass", points: 50, description: "Awarded for passing a quiz above the threshold", enabled: true },
  { key: "quiz_attempt", action: "Quiz Attempt", points: 10, description: "Awarded for attempting a quiz (below the pass threshold)", enabled: true },
  { key: "perfect_score", action: "Perfect Score", points: 25, description: "Bonus for scoring 100% on an assessment", enabled: true },
  { key: "badge_earned", action: "Badge Bonus", points: 50, description: "Bonus points granted when a badge is earned", enabled: true },
];

const DEFAULT_BY_KEY = new Map(DEFAULT_POINT_RULES.map((r) => [r.key, r]));

interface SavedRule {
  id?: string;
  key?: string;
  action?: string;
  points?: number;
  description?: string;
  enabled?: boolean;
}

/**
 * Resolve the full rule list for display: built-in defaults with any saved
 * overrides (matched by key) applied, plus any admin-added custom rules.
 */
export async function getResolvedPointRules(
  supabase: SupabaseClient
): Promise<PointRuleConfig[]> {
  const saved = await readSavedRules(supabase);
  const savedByKey = new Map<string, SavedRule>();
  const customs: PointRuleConfig[] = [];

  for (const r of saved) {
    const k = r.key || r.id;
    if (k && DEFAULT_BY_KEY.has(k)) {
      savedByKey.set(k, r);
    } else if (r.action) {
      // Custom rule with no matching award site — stored, shown, but inert.
      customs.push({
        key: r.key || r.id || r.action,
        action: r.action,
        points: Number(r.points) || 0,
        description: r.description || "",
        enabled: r.enabled !== false,
      });
    }
  }

  const merged = DEFAULT_POINT_RULES.map((def) => {
    const s = savedByKey.get(def.key);
    if (!s) return def;
    return {
      ...def,
      points: typeof s.points === "number" ? s.points : def.points,
      enabled: typeof s.enabled === "boolean" ? s.enabled : def.enabled,
    };
  });

  return [...merged, ...customs];
}

async function readSavedRules(supabase: SupabaseClient): Promise<SavedRule[]> {
  try {
    const { data } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", POINT_RULES_SETTINGS_KEY)
      .maybeSingle();
    const value = (data as { value?: unknown } | null)?.value;
    return Array.isArray(value) ? (value as SavedRule[]) : [];
  } catch {
    return [];
  }
}

/**
 * Award points for a canonical action, honouring the configured rule: uses the
 * admin-set point value (or the built-in default), and skips the award when the
 * rule is disabled or resolves to zero points.
 */
export async function awardForAction(
  supabase: SupabaseClient,
  userId: string,
  key: string,
  opts: { referenceType?: string; referenceId?: string } = {}
): Promise<{ awarded: number; skipped: boolean; error?: unknown }> {
  const saved = await readSavedRules(supabase);
  const savedRule = saved.find((r) => (r.key || r.id) === key);
  const def = DEFAULT_BY_KEY.get(key);

  const enabled = savedRule?.enabled ?? def?.enabled ?? true;
  if (!enabled) return { awarded: 0, skipped: true };

  const points =
    typeof savedRule?.points === "number" ? savedRule.points : def?.points ?? 0;
  if (!points) return { awarded: 0, skipped: true };

  const row: Record<string, unknown> = {
    user_id: userId,
    action_type: key,
    points,
  };
  if (opts.referenceType) row.reference_type = opts.referenceType;
  if (opts.referenceId) row.reference_id = opts.referenceId;

  const { error } = await supabase.from("points_ledger").insert(row);
  return { awarded: error ? 0 : points, skipped: false, error };
}
