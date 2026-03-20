/**
 * xAPI Tracking Helper
 * High-level functions that create and store xAPI statements for common LMS events,
 * and auto-push to configured external LRS endpoints.
 */

import { createServiceClient } from "@/lib/supabase/service";
import {
  buildStatement,
  buildActor,
  buildActivity,
  buildResult,
  secondsToXAPIDuration,
  XAPI_VERBS,
  ACTIVITY_TYPES,
  type XAPIStatement,
  type XAPIContext,
} from "./statement-builder";
import { LRSClient, type LRSConfig } from "./lrs-client";

// ─── Internal Helpers ────────────────────────────────────────────────────────

async function getUserData(userId: string) {
  const service = createServiceClient();
  const { data } = await service
    .from("users")
    .select("id, email, first_name, last_name")
    .eq("id", userId)
    .single();
  return data;
}

async function getCourseData(courseId: string) {
  const service = createServiceClient();
  const { data } = await service
    .from("courses")
    .select("id, title, slug")
    .eq("id", courseId)
    .single();
  return data;
}

async function storeStatement(statement: XAPIStatement, actorId: string, courseId?: string) {
  const service = createServiceClient();

  const verb = statement.verb.id;
  const verbDisplay = statement.verb.display?.["en-US"] || "";
  const obj = statement.object;
  const objectType =
    "objectType" in obj && obj.objectType === "Activity" ? "activity" : "activity";
  const objectId = "id" in obj ? obj.id : "";
  const objectName =
    "definition" in obj && obj.definition?.name?.["en-US"]
      ? obj.definition.name["en-US"]
      : "";

  const { error } = await service.from("xapi_statements").insert({
    statement_id: statement.id || crypto.randomUUID(),
    actor_id: actorId,
    verb,
    verb_display: verbDisplay,
    object_type: objectType,
    object_id: objectId,
    object_name: objectName,
    result_score_scaled: statement.result?.score?.scaled ?? null,
    result_score_raw: statement.result?.score?.raw ?? null,
    result_score_min: statement.result?.score?.min ?? null,
    result_score_max: statement.result?.score?.max ?? null,
    result_success: statement.result?.success ?? null,
    result_completion: statement.result?.completion ?? null,
    result_duration: statement.result?.duration ?? null,
    context_registration: statement.context?.registration ?? null,
    context_course_id: courseId ?? null,
    context_extensions: statement.context?.extensions ?? {},
    timestamp: statement.timestamp,
    raw_statement: statement as unknown as Record<string, unknown>,
  });

  if (error) {
    console.error("Failed to store xAPI statement:", error.message);
  }
}

async function pushToExternalLRS(statement: XAPIStatement) {
  const service = createServiceClient();
  const { data: configs } = await service
    .from("lrs_configurations")
    .select("*")
    .eq("is_active", true)
    .in("sync_direction", ["push", "both"]);

  if (!configs || configs.length === 0) return;

  const pushPromises = configs.map(async (config: LRSConfig) => {
    try {
      const client = new LRSClient(config);
      await client.pushStatement(statement);
    } catch (error) {
      console.error(`Failed to push to LRS "${config.id}":`, error);
    }
  });

  // Fire and forget - don't block the caller
  await Promise.allSettled(pushPromises);
}

async function trackEvent(statement: XAPIStatement, actorId: string, courseId?: string) {
  await storeStatement(statement, actorId, courseId);
  // Push to external LRS in background (non-blocking)
  pushToExternalLRS(statement).catch(() => {});
}

// ─── Public Tracking Functions ───────────────────────────────────────────────

/**
 * Track when a user starts/launches a course.
 */
export async function trackCourseStarted(userId: string, courseId: string) {
  const user = await getUserData(userId);
  if (!user) return;

  const course = await getCourseData(courseId);
  if (!course) return;

  const actor = buildActor(user);
  const activity = buildActivity(
    `courses/${courseId}`,
    course.title,
    ACTIVITY_TYPES.course
  );

  const context: XAPIContext = {
    extensions: {
      "https://lms.example.com/extensions/course-id": courseId,
    },
  };

  const statement = buildStatement(
    actor,
    XAPI_VERBS.launched,
    activity,
    undefined,
    context
  );

  await trackEvent(statement, userId, courseId);
}

/**
 * Track when a user completes a lesson within a course.
 */
export async function trackLessonCompleted(
  userId: string,
  courseId: string,
  lessonId: string,
  durationSeconds?: number
) {
  const user = await getUserData(userId);
  if (!user) return;

  const actor = buildActor(user);
  const activity = buildActivity(
    `lessons/${lessonId}`,
    `Lesson ${lessonId}`,
    ACTIVITY_TYPES.lesson
  );

  const result = buildResult({
    completion: true,
    duration: durationSeconds ? secondsToXAPIDuration(durationSeconds) : undefined,
  });

  const context: XAPIContext = {
    contextActivities: {
      parent: [
        buildActivity(`courses/${courseId}`, "Parent Course", ACTIVITY_TYPES.course),
      ],
    },
    extensions: {
      "https://lms.example.com/extensions/course-id": courseId,
      "https://lms.example.com/extensions/lesson-id": lessonId,
    },
  };

  const statement = buildStatement(actor, XAPI_VERBS.completed, activity, result, context);
  await trackEvent(statement, userId, courseId);
}

/**
 * Track when a user attempts an assessment.
 */
export async function trackAssessmentAttempted(
  userId: string,
  assessmentId: string,
  score: number,
  passed: boolean,
  maxScore: number = 100
) {
  const user = await getUserData(userId);
  if (!user) return;

  const actor = buildActor(user);
  const activity = buildActivity(
    `assessments/${assessmentId}`,
    `Assessment ${assessmentId}`,
    ACTIVITY_TYPES.assessment
  );

  const scaled = maxScore > 0 ? score / maxScore : 0;
  const verb = passed ? XAPI_VERBS.passed : XAPI_VERBS.failed;

  const result = buildResult({
    score: {
      scaled: Math.round(scaled * 10000) / 10000,
      raw: score,
      min: 0,
      max: maxScore,
    },
    success: passed,
    completion: true,
  });

  const context: XAPIContext = {
    extensions: {
      "https://lms.example.com/extensions/assessment-id": assessmentId,
    },
  };

  const statement = buildStatement(actor, verb, activity, result, context);
  await trackEvent(statement, userId);
}

/**
 * Track when a user completes an entire course.
 */
export async function trackCourseCompleted(
  userId: string,
  courseId: string,
  score?: number,
  maxScore: number = 100
) {
  const user = await getUserData(userId);
  if (!user) return;

  const course = await getCourseData(courseId);
  if (!course) return;

  const actor = buildActor(user);
  const activity = buildActivity(
    `courses/${courseId}`,
    course.title,
    ACTIVITY_TYPES.course
  );

  const resultOptions: Parameters<typeof buildResult>[0] = {
    completion: true,
    success: true,
  };

  if (score !== undefined) {
    const scaled = maxScore > 0 ? score / maxScore : 0;
    resultOptions.score = {
      scaled: Math.round(scaled * 10000) / 10000,
      raw: score,
      min: 0,
      max: maxScore,
    };
  }

  const result = buildResult(resultOptions);

  const context: XAPIContext = {
    extensions: {
      "https://lms.example.com/extensions/course-id": courseId,
    },
  };

  const statement = buildStatement(actor, XAPI_VERBS.completed, activity, result, context);
  await trackEvent(statement, userId, courseId);
}
