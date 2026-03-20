/**
 * xAPI 1.0.3 Statement Builder
 * Constructs xAPI-compliant statement JSON for learning events.
 */

// ─── xAPI TypeScript Interfaces ──────────────────────────────────────────────

export interface XAPIActor {
  objectType: "Agent" | "Group";
  name?: string;
  mbox?: string;
  mbox_sha1sum?: string;
  openid?: string;
  account?: {
    homePage: string;
    name: string;
  };
}

export interface XAPIVerb {
  id: string;
  display: Record<string, string>;
}

export interface XAPIActivityDefinition {
  type?: string;
  name?: Record<string, string>;
  description?: Record<string, string>;
  moreInfo?: string;
  extensions?: Record<string, unknown>;
  interactionType?: string;
  correctResponsesPattern?: string[];
}

export interface XAPIActivity {
  objectType: "Activity";
  id: string;
  definition?: XAPIActivityDefinition;
}

export interface XAPIStatementRef {
  objectType: "StatementRef";
  id: string;
}

export type XAPIObject = XAPIActivity | XAPIStatementRef | XAPIActor;

export interface XAPIScore {
  scaled?: number;
  raw?: number;
  min?: number;
  max?: number;
}

export interface XAPIResult {
  score?: XAPIScore;
  success?: boolean;
  completion?: boolean;
  response?: string;
  duration?: string;
  extensions?: Record<string, unknown>;
}

export interface XAPIContextActivities {
  parent?: XAPIActivity[];
  grouping?: XAPIActivity[];
  category?: XAPIActivity[];
  other?: XAPIActivity[];
}

export interface XAPIContext {
  registration?: string;
  instructor?: XAPIActor;
  team?: XAPIActor;
  contextActivities?: XAPIContextActivities;
  revision?: string;
  platform?: string;
  language?: string;
  statement?: XAPIStatementRef;
  extensions?: Record<string, unknown>;
}

export interface XAPIStatement {
  id?: string;
  actor: XAPIActor;
  verb: XAPIVerb;
  object: XAPIObject;
  result?: XAPIResult;
  context?: XAPIContext;
  timestamp?: string;
  stored?: string;
  authority?: XAPIActor;
  version?: string;
}

// ─── xAPI Verb Constants (ADL verb registry) ────────────────────────────────

export const XAPI_VERBS = {
  completed: {
    id: "http://adlnet.gov/expapi/verbs/completed",
    display: { "en-US": "completed" },
  },
  attempted: {
    id: "http://adlnet.gov/expapi/verbs/attempted",
    display: { "en-US": "attempted" },
  },
  passed: {
    id: "http://adlnet.gov/expapi/verbs/passed",
    display: { "en-US": "passed" },
  },
  failed: {
    id: "http://adlnet.gov/expapi/verbs/failed",
    display: { "en-US": "failed" },
  },
  experienced: {
    id: "http://adlnet.gov/expapi/verbs/experienced",
    display: { "en-US": "experienced" },
  },
  answered: {
    id: "http://adlnet.gov/expapi/verbs/answered",
    display: { "en-US": "answered" },
  },
  interacted: {
    id: "http://adlnet.gov/expapi/verbs/interacted",
    display: { "en-US": "interacted" },
  },
  launched: {
    id: "http://adlnet.gov/expapi/verbs/launched",
    display: { "en-US": "launched" },
  },
  initialized: {
    id: "http://adlnet.gov/expapi/verbs/initialized",
    display: { "en-US": "initialized" },
  },
  terminated: {
    id: "http://adlnet.gov/expapi/verbs/terminated",
    display: { "en-US": "terminated" },
  },
} as const satisfies Record<string, XAPIVerb>;

export type VerbKey = keyof typeof XAPI_VERBS;

// ─── Activity Type Constants ─────────────────────────────────────────────────

export const ACTIVITY_TYPES = {
  course: "http://adlnet.gov/expapi/activities/course",
  module: "http://adlnet.gov/expapi/activities/module",
  lesson: "http://adlnet.gov/expapi/activities/lesson",
  assessment: "http://adlnet.gov/expapi/activities/assessment",
  interaction: "http://adlnet.gov/expapi/activities/interaction",
  media: "http://adlnet.gov/expapi/activities/media",
} as const;

// ─── Builder Functions ───────────────────────────────────────────────────────

/**
 * Build an xAPI Actor from user data.
 */
export function buildActor(user: {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
}): XAPIActor {
  const name =
    user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : undefined;

  return {
    objectType: "Agent",
    name,
    account: {
      homePage: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      name: user.id,
    },
    ...(user.email ? { mbox: `mailto:${user.email}` } : {}),
  };
}

/**
 * Build an xAPI Activity object.
 */
export function buildActivity(
  id: string,
  name: string,
  type?: string,
  description?: string
): XAPIActivity {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return {
    objectType: "Activity",
    id: id.startsWith("http") ? id : `${baseUrl}/activities/${id}`,
    definition: {
      name: { "en-US": name },
      ...(type ? { type } : {}),
      ...(description ? { description: { "en-US": description } } : {}),
    },
  };
}

/**
 * Build an xAPI Result object.
 */
export function buildResult(options?: {
  score?: { scaled?: number; raw?: number; min?: number; max?: number };
  success?: boolean;
  completion?: boolean;
  duration?: string;
  response?: string;
  extensions?: Record<string, unknown>;
}): XAPIResult | undefined {
  if (!options) return undefined;

  const result: XAPIResult = {};

  if (options.score) {
    result.score = {};
    if (options.score.scaled !== undefined) result.score.scaled = options.score.scaled;
    if (options.score.raw !== undefined) result.score.raw = options.score.raw;
    if (options.score.min !== undefined) result.score.min = options.score.min;
    if (options.score.max !== undefined) result.score.max = options.score.max;
  }

  if (options.success !== undefined) result.success = options.success;
  if (options.completion !== undefined) result.completion = options.completion;
  if (options.duration) result.duration = options.duration;
  if (options.response) result.response = options.response;
  if (options.extensions) result.extensions = options.extensions;

  return result;
}

/**
 * Build a complete xAPI statement.
 */
export function buildStatement(
  actor: XAPIActor,
  verb: XAPIVerb,
  object: XAPIObject,
  result?: XAPIResult,
  context?: XAPIContext
): XAPIStatement {
  const statement: XAPIStatement = {
    id: crypto.randomUUID(),
    actor,
    verb,
    object,
    timestamp: new Date().toISOString(),
    version: "1.0.3",
  };

  if (result) statement.result = result;
  if (context) statement.context = context;

  return statement;
}

/**
 * Convert an ISO 8601 duration in seconds to xAPI duration format (PT__H__M__S).
 */
export function secondsToXAPIDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.round(seconds % 60);

  let duration = "PT";
  if (hours > 0) duration += `${hours}H`;
  if (minutes > 0) duration += `${minutes}M`;
  if (secs > 0 || duration === "PT") duration += `${secs}S`;

  return duration;
}

/**
 * Push a statement to an external LRS endpoint.
 */
export async function sendToLRS(
  statement: XAPIStatement,
  lrsConfig: {
    endpoint_url: string;
    auth_type: "basic" | "oauth";
    username?: string;
    password_encrypted?: string;
    token_encrypted?: string;
  }
): Promise<void> {
  const url = `${lrsConfig.endpoint_url.replace(/\/$/, "")}/statements`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Experience-API-Version": "1.0.3",
  };

  if (lrsConfig.auth_type === "basic" && lrsConfig.username && lrsConfig.password_encrypted) {
    const credentials = Buffer.from(
      `${lrsConfig.username}:${lrsConfig.password_encrypted}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  } else if (lrsConfig.auth_type === "oauth" && lrsConfig.token_encrypted) {
    headers["Authorization"] = `Bearer ${lrsConfig.token_encrypted}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(statement),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`LRS push failed (${response.status}): ${errorText}`);
  }
}
