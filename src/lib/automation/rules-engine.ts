import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RuleConditions {
  role?: string[];
  organization_id?: string[];
  hire_date_within_days?: number;
  job_title_contains?: string;
  completed_course_id?: string;
}

export interface RuleAction {
  type: "enroll_course" | "enroll_path" | "assign_badge" | "send_notification";
  course_id?: string;
  path_id?: string;
  badge_id?: string;
  due_days?: number;
  notification_text?: string;
}

export interface EnrollmentRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  conditions: RuleConditions;
  actions: RuleAction[];
  last_run_at: string | null;
  run_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRecord {
  id: string;
  role: string;
  organization_id: string | null;
  hire_date: string | null;
  job_title: string | null;
  status: string;
}

export interface RuleExecutionResult {
  action_type: string;
  action_target_id: string | null;
  status: "success" | "skipped" | "error";
  error_message?: string;
}

// ── Evaluate ───────────────────────────────────────────────────────────────

/**
 * Check whether a user matches ALL conditions in a rule.
 * Returns true only if every specified condition is satisfied.
 */
export function evaluateRule(rule: EnrollmentRule, user: UserRecord, completedCourseIds?: string[]): boolean {
  const cond = rule.conditions;

  // Role match
  if (cond.role && cond.role.length > 0) {
    if (!cond.role.includes(user.role)) return false;
  }

  // Organization match
  if (cond.organization_id && cond.organization_id.length > 0) {
    if (!user.organization_id || !cond.organization_id.includes(user.organization_id)) return false;
  }

  // Hire date within N days
  if (cond.hire_date_within_days != null) {
    if (!user.hire_date) return false;
    const hireDate = new Date(user.hire_date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0 || diffDays > cond.hire_date_within_days) return false;
  }

  // Job title contains
  if (cond.job_title_contains) {
    if (!user.job_title) return false;
    if (!user.job_title.toLowerCase().includes(cond.job_title_contains.toLowerCase())) return false;
  }

  // Completed specific course
  if (cond.completed_course_id) {
    if (!completedCourseIds || !completedCourseIds.includes(cond.completed_course_id)) return false;
  }

  return true;
}

// ── Execute Actions ────────────────────────────────────────────────────────

/**
 * Execute all actions for a rule against a single user.
 * Logs each action to enrollment_rule_logs. Skips duplicates.
 */
export async function executeRuleActions(
  rule: EnrollmentRule,
  userId: string
): Promise<RuleExecutionResult[]> {
  const service = createServiceClient();
  const results: RuleExecutionResult[] = [];

  // Fetch user hire_date for due_days calculation
  const { data: userRow } = await service
    .from("users")
    .select("hire_date")
    .eq("id", userId)
    .single();

  for (const action of rule.actions) {
    let result: RuleExecutionResult;

    try {
      switch (action.type) {
        case "enroll_course": {
          if (!action.course_id) {
            result = { action_type: action.type, action_target_id: null, status: "error", error_message: "Missing course_id" };
            break;
          }

          // Check if already enrolled
          const { data: existing } = await service
            .from("enrollments")
            .select("id")
            .eq("user_id", userId)
            .eq("course_id", action.course_id)
            .maybeSingle();

          if (existing) {
            result = { action_type: action.type, action_target_id: action.course_id, status: "skipped", error_message: "Already enrolled" };
            break;
          }

          // Calculate due date
          let dueDate: string | null = null;
          if (action.due_days) {
            const base = userRow?.hire_date ? new Date(userRow.hire_date) : new Date();
            base.setDate(base.getDate() + action.due_days);
            dueDate = base.toISOString().split("T")[0];
          }

          const { error: enrollErr } = await service
            .from("enrollments")
            .insert({
              user_id: userId,
              course_id: action.course_id,
              due_date: dueDate,
              assigned_by: rule.created_by,
            });

          if (enrollErr) {
            // 23505 = unique violation (already enrolled via race condition)
            if (enrollErr.code === "23505") {
              result = { action_type: action.type, action_target_id: action.course_id, status: "skipped", error_message: "Already enrolled" };
            } else {
              result = { action_type: action.type, action_target_id: action.course_id, status: "error", error_message: enrollErr.message };
            }
          } else {
            result = { action_type: action.type, action_target_id: action.course_id, status: "success" };
          }
          break;
        }

        case "enroll_path": {
          if (!action.path_id) {
            result = { action_type: action.type, action_target_id: null, status: "error", error_message: "Missing path_id" };
            break;
          }

          // Check if already enrolled in path
          const { data: existingPath } = await service
            .from("path_enrollments")
            .select("id")
            .eq("user_id", userId)
            .eq("path_id", action.path_id)
            .maybeSingle();

          if (existingPath) {
            result = { action_type: action.type, action_target_id: action.path_id, status: "skipped", error_message: "Already enrolled in path" };
            break;
          }

          const { error: pathErr } = await service
            .from("path_enrollments")
            .insert({
              user_id: userId,
              path_id: action.path_id,
            });

          if (pathErr) {
            if (pathErr.code === "23505") {
              result = { action_type: action.type, action_target_id: action.path_id, status: "skipped", error_message: "Already enrolled in path" };
            } else {
              result = { action_type: action.type, action_target_id: action.path_id, status: "error", error_message: pathErr.message };
            }
          } else {
            result = { action_type: action.type, action_target_id: action.path_id, status: "success" };
          }
          break;
        }

        case "assign_badge": {
          if (!action.badge_id) {
            result = { action_type: action.type, action_target_id: null, status: "error", error_message: "Missing badge_id" };
            break;
          }

          // Check if badge already awarded
          const { data: existingBadge } = await service
            .from("user_badges")
            .select("id")
            .eq("user_id", userId)
            .eq("badge_id", action.badge_id)
            .maybeSingle();

          if (existingBadge) {
            result = { action_type: action.type, action_target_id: action.badge_id, status: "skipped", error_message: "Badge already awarded" };
            break;
          }

          const { error: badgeErr } = await service
            .from("user_badges")
            .insert({
              user_id: userId,
              badge_id: action.badge_id,
            });

          if (badgeErr) {
            if (badgeErr.code === "23505") {
              result = { action_type: action.type, action_target_id: action.badge_id, status: "skipped", error_message: "Badge already awarded" };
            } else {
              result = { action_type: action.type, action_target_id: action.badge_id, status: "error", error_message: badgeErr.message };
            }
          } else {
            result = { action_type: action.type, action_target_id: action.badge_id, status: "success" };
          }
          break;
        }

        case "send_notification": {
          const text = action.notification_text || `Automated notification from rule: ${rule.name}`;

          const { error: notifErr } = await service
            .from("notifications")
            .insert({
              user_id: userId,
              title: `Automation: ${rule.name}`,
              body: text,
              type: "system",
              is_read: false,
            });

          if (notifErr) {
            result = { action_type: action.type, action_target_id: null, status: "error", error_message: notifErr.message };
          } else {
            result = { action_type: action.type, action_target_id: null, status: "success" };
          }
          break;
        }

        default:
          result = { action_type: action.type, action_target_id: null, status: "error", error_message: `Unknown action type: ${action.type}` };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      result = { action_type: action.type, action_target_id: null, status: "error", error_message: msg };
    }

    // Log result
    await service.from("enrollment_rule_logs").insert({
      rule_id: rule.id,
      user_id: userId,
      action_type: result.action_type,
      action_target_id: result.action_target_id,
      status: result.status,
      error_message: result.error_message ?? null,
    });

    results.push(result);
  }

  return results;
}

// ── Process Rules for User ─────────────────────────────────────────────────

/**
 * Find all active rules matching a trigger type, evaluate conditions for
 * the given user, and execute actions for matching rules.
 * Designed to be called fire-and-forget after a trigger event.
 */
export async function processRulesForUser(userId: string, triggerType: string): Promise<void> {
  const service = createServiceClient();

  // Fetch active rules for this trigger
  const { data: rules, error: rulesErr } = await service
    .from("enrollment_rules")
    .select("*")
    .eq("is_active", true)
    .eq("trigger_type", triggerType);

  if (rulesErr || !rules || rules.length === 0) return;

  // Fetch the user
  const { data: user } = await service
    .from("users")
    .select("id, role, organization_id, hire_date, job_title, status")
    .eq("id", userId)
    .single();

  if (!user || user.status !== "active") return;

  // Fetch completed course IDs for the user (needed for course_completed conditions)
  const { data: completedEnrollments } = await service
    .from("enrollments")
    .select("course_id")
    .eq("user_id", userId)
    .eq("status", "completed");

  const completedCourseIds = (completedEnrollments ?? []).map((e: { course_id: string }) => e.course_id);

  for (const rule of rules as EnrollmentRule[]) {
    const matches = evaluateRule(rule, user as UserRecord, completedCourseIds);
    if (!matches) continue;

    const results = await executeRuleActions(rule, userId);

    // Update rule run stats
    await service
      .from("enrollment_rules")
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (rule.run_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rule.id);

    // Audit log for successful actions
    const successCount = results.filter((r) => r.status === "success").length;
    if (successCount > 0) {
      logAudit({
        userId: rule.created_by ?? undefined,
        action: "rule_executed",
        entityType: "enrollment_rule",
        entityId: rule.id,
        newValues: { trigger: triggerType, target_user: userId, success_count: successCount },
      });
    }
  }
}

// ── Run Scheduled Rules ────────────────────────────────────────────────────

/**
 * Find all active scheduled rules, find matching users who haven't been
 * processed yet, and execute actions for each.
 */
export async function runScheduledRules(): Promise<{ rulesProcessed: number; usersProcessed: number }> {
  const service = createServiceClient();
  let rulesProcessed = 0;
  let usersProcessed = 0;

  // Fetch active scheduled rules
  const { data: rules, error: rulesErr } = await service
    .from("enrollment_rules")
    .select("*")
    .eq("is_active", true)
    .eq("trigger_type", "schedule");

  if (rulesErr || !rules || rules.length === 0) {
    return { rulesProcessed: 0, usersProcessed: 0 };
  }

  for (const rule of rules as EnrollmentRule[]) {
    // Fetch all active users
    const { data: users } = await service
      .from("users")
      .select("id, role, organization_id, hire_date, job_title, status")
      .eq("status", "active");

    if (!users || users.length === 0) continue;

    // Get user IDs that already have logs for this rule (already processed)
    const { data: existingLogs } = await service
      .from("enrollment_rule_logs")
      .select("user_id")
      .eq("rule_id", rule.id);

    const processedUserIds = new Set((existingLogs ?? []).map((l: { user_id: string }) => l.user_id));

    // Fetch completed courses for all users in bulk
    const { data: allCompletedEnrollments } = await service
      .from("enrollments")
      .select("user_id, course_id")
      .eq("status", "completed");

    const completedByUser = new Map<string, string[]>();
    for (const e of allCompletedEnrollments ?? []) {
      const existing = completedByUser.get(e.user_id) ?? [];
      existing.push(e.course_id);
      completedByUser.set(e.user_id, existing);
    }

    let ruleUserCount = 0;

    for (const user of users as UserRecord[]) {
      // Skip already-processed users
      if (processedUserIds.has(user.id)) continue;

      const completedCourseIds = completedByUser.get(user.id) ?? [];
      const matches = evaluateRule(rule, user, completedCourseIds);
      if (!matches) continue;

      await executeRuleActions(rule, user.id);
      ruleUserCount++;
      usersProcessed++;
    }

    if (ruleUserCount > 0) {
      // Update rule run stats
      await service
        .from("enrollment_rules")
        .update({
          last_run_at: new Date().toISOString(),
          run_count: (rule.run_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rule.id);

      logAudit({
        userId: rule.created_by ?? undefined,
        action: "scheduled_rule_executed",
        entityType: "enrollment_rule",
        entityId: rule.id,
        newValues: { users_processed: ruleUserCount },
      });
    }

    rulesProcessed++;
  }

  return { rulesProcessed, usersProcessed };
}
