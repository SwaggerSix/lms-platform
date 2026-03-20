import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, xapiStatementSchema } from "@/lib/validations";

/**
 * GET /api/xapi/statements
 * Query xAPI statements with standard xAPI query parameters.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const agent = searchParams.get("agent");
  const verb = searchParams.get("verb");
  const activity = searchParams.get("activity");
  const since = searchParams.get("since");
  const until = searchParams.get("until");
  const limit = Math.min(parseInt(searchParams.get("limit") || "25"), 100);
  const ascending = searchParams.get("ascending") === "true";
  const page = parseInt(searchParams.get("page") || "1");
  const offset = (page - 1) * limit;

  const service = createServiceClient();
  let query = service
    .from("xapi_statements")
    .select("*", { count: "exact" })
    .eq("voided", false);

  // Non-admin users can only see their own statements
  if (auth.user.role !== "admin") {
    query = query.eq("actor_id", auth.user.id);
  }

  // Apply filters
  if (agent) {
    // agent param could be a user ID or JSON actor
    query = query.eq("actor_id", agent);
  }
  if (verb) query = query.eq("verb", verb);
  if (activity) query = query.eq("object_id", activity);
  if (since) query = query.gte("stored_at", since);
  if (until) query = query.lte("stored_at", until);

  query = query
    .order("stored_at", { ascending })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error("xAPI statements query error:", error.message);
    return NextResponse.json({ error: "Failed to query statements" }, { status: 500 });
  }

  return NextResponse.json(
    {
      statements: data,
      total: count,
      page,
      limit,
      more: (count || 0) > offset + limit,
    },
    {
      headers: {
        "X-Experience-API-Version": "1.0.3",
      },
    }
  );
}

/**
 * POST /api/xapi/statements
 * Store one or more xAPI statements.
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = await rateLimit(`xapi-post-${auth.user.id}`, 60, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await request.json();

  // Support both single statement and array of statements
  const statements = Array.isArray(body) ? body : [body];

  if (statements.length === 0) {
    return NextResponse.json({ error: "No statements provided" }, { status: 400 });
  }

  if (statements.length > 50) {
    return NextResponse.json({ error: "Maximum 50 statements per request" }, { status: 400 });
  }

  const service = createServiceClient();
  const ids: string[] = [];

  for (const stmt of statements) {
    const validation = validateBody(xapiStatementSchema, stmt);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const data = validation.data;
    const statementId = data.id || crypto.randomUUID();

    const { error } = await service.from("xapi_statements").insert({
      statement_id: statementId,
      actor_id: auth.user.id,
      verb: data.verb.id,
      verb_display: data.verb.display?.["en-US"] || null,
      object_type: data.object?.objectType?.toLowerCase() || "activity",
      object_id: data.object?.id || "",
      object_name: data.object?.definition?.name?.["en-US"] || null,
      result_score_scaled: data.result?.score?.scaled ?? null,
      result_score_raw: data.result?.score?.raw ?? null,
      result_score_min: data.result?.score?.min ?? null,
      result_score_max: data.result?.score?.max ?? null,
      result_success: data.result?.success ?? null,
      result_completion: data.result?.completion ?? null,
      result_duration: data.result?.duration ?? null,
      context_registration: data.context?.registration ?? null,
      context_extensions: data.context?.extensions ?? {},
      timestamp: data.timestamp || new Date().toISOString(),
      raw_statement: stmt,
    });

    if (error) {
      console.error("Failed to store xAPI statement:", error.message);
      // Skip duplicates (unique constraint on statement_id)
      if (!error.message.includes("duplicate")) {
        return NextResponse.json({ error: "Failed to store statement" }, { status: 500 });
      }
    }

    ids.push(statementId);
  }

  return NextResponse.json(ids, {
    status: 200,
    headers: { "X-Experience-API-Version": "1.0.3" },
  });
}

/**
 * PUT /api/xapi/statements
 * Store a single xAPI statement (xAPI spec requires PUT support with statementId param).
 */
export async function PUT(request: NextRequest) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const rl = await rateLimit(`xapi-put-${auth.user.id}`, 60, 60000);
  if (!rl.success) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const statementId = searchParams.get("statementId");

  if (!statementId) {
    return NextResponse.json({ error: "statementId parameter required" }, { status: 400 });
  }

  const body = await request.json();
  const validation = validateBody(xapiStatementSchema, body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const data = validation.data;
  const service = createServiceClient();

  // Check if statement already exists
  const { data: existing } = await service
    .from("xapi_statements")
    .select("id")
    .eq("statement_id", statementId)
    .single();

  if (existing) {
    return NextResponse.json(null, {
      status: 204,
      headers: { "X-Experience-API-Version": "1.0.3" },
    });
  }

  const { error } = await service.from("xapi_statements").insert({
    statement_id: statementId,
    actor_id: auth.user.id,
    verb: data.verb.id,
    verb_display: data.verb.display?.["en-US"] || null,
    object_type: data.object?.objectType?.toLowerCase() || "activity",
    object_id: data.object?.id || "",
    object_name: data.object?.definition?.name?.["en-US"] || null,
    result_score_scaled: data.result?.score?.scaled ?? null,
    result_score_raw: data.result?.score?.raw ?? null,
    result_score_min: data.result?.score?.min ?? null,
    result_score_max: data.result?.score?.max ?? null,
    result_success: data.result?.success ?? null,
    result_completion: data.result?.completion ?? null,
    result_duration: data.result?.duration ?? null,
    context_registration: data.context?.registration ?? null,
    context_extensions: data.context?.extensions ?? {},
    timestamp: data.timestamp || new Date().toISOString(),
    raw_statement: body,
  });

  if (error) {
    console.error("Failed to store xAPI statement:", error.message);
    return NextResponse.json({ error: "Failed to store statement" }, { status: 500 });
  }

  return NextResponse.json(null, {
    status: 204,
    headers: { "X-Experience-API-Version": "1.0.3" },
  });
}
