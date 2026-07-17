import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  authenticateScim,
  scimError,
  scimJson,
  toScimUser,
  scimListResponse,
  extractEmail,
  extractNames,
  baseUrlFrom,
  SCIM_EXTERNAL_SOURCE,
  SCIM_USER_COLUMNS,
} from "@/lib/scim";

/** Parse `userName eq "x"` / `externalId eq "x"` SCIM filters (the common case). */
function parseFilter(filter: string | null): { column: string; value: string } | null {
  if (!filter) return null;
  const m = /^\s*(userName|externalId)\s+eq\s+"([^"]*)"\s*$/i.exec(filter);
  if (!m) return null;
  const attr = m[1].toLowerCase();
  return { column: attr === "username" ? "email" : "external_id", value: m[2] };
}

export async function GET(request: NextRequest) {
  const provider = await authenticateScim(request);
  if (!provider) return scimError(401, "Invalid or missing SCIM bearer token");

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const startIndex = Math.max(1, parseInt(searchParams.get("startIndex") || "1"));
  const count = Math.min(200, Math.max(0, parseInt(searchParams.get("count") || "100")));
  const filter = parseFilter(searchParams.get("filter"));

  let query = service
    .from("users")
    .select(SCIM_USER_COLUMNS, { count: "exact" })
    .eq("external_source", SCIM_EXTERNAL_SOURCE)
    .order("created_at", { ascending: true })
    .range(startIndex - 1, startIndex - 1 + Math.max(0, count - 1));

  if (filter) {
    query = query.eq(filter.column, filter.column === "email" ? filter.value.toLowerCase() : filter.value);
  }

  const { data, count: total, error } = await query;
  if (error) {
    console.error("SCIM Users list error:", error.message);
    return scimError(500, "Internal error listing users");
  }

  const baseUrl = baseUrlFrom(request);
  const resources = (data ?? []).map((u: any) => toScimUser(u, baseUrl));
  return scimJson(scimListResponse(resources, total ?? resources.length, startIndex));
}

export async function POST(request: NextRequest) {
  const provider = await authenticateScim(request);
  if (!provider) return scimError(401, "Invalid or missing SCIM bearer token");

  let body: any;
  try {
    body = await request.json();
  } catch {
    return scimError(400, "Invalid JSON body", "invalidValue");
  }

  const email = extractEmail(body);
  if (!email) return scimError(400, "userName (email) is required", "invalidValue");

  const service = createServiceClient();

  // Email is globally unique; a pre-existing account (any source) is a conflict.
  const { data: existing } = await service
    .from("users")
    .select("id, external_source")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return scimError(409, "A user with this userName already exists", "uniqueness");
  }

  const { first_name, last_name } = extractNames(body, email);
  const active = body?.active !== false; // default true

  const { data: created, error } = await service
    .from("users")
    .insert({
      email,
      first_name,
      last_name,
      role: "learner",
      status: active ? "active" : "inactive",
      external_source: SCIM_EXTERNAL_SOURCE,
      external_id: typeof body?.externalId === "string" ? body.externalId : null,
    })
    .select(SCIM_USER_COLUMNS)
    .single();

  if (error) {
    console.error("SCIM Users create error:", error.message);
    return scimError(500, "Internal error creating user");
  }

  return scimJson(toScimUser(created as any, baseUrlFrom(request)), 201);
}
