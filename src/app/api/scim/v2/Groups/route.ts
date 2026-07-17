import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  authenticateScim,
  scimError,
  scimJson,
  toScimGroup,
  scimListResponse,
  baseUrlFrom,
  scimGroupMetadata,
  extractMemberIds,
  SCIM_GROUP_COLUMNS,
  type ScimMember,
} from "@/lib/scim";

function parseGroupFilter(filter: string | null): string | null {
  if (!filter) return null;
  const m = /^\s*displayName\s+eq\s+"([^"]*)"\s*$/i.exec(filter);
  return m ? m[1] : null;
}

async function fetchMembers(
  service: ReturnType<typeof createServiceClient>,
  orgId: string
): Promise<ScimMember[]> {
  const { data } = await service
    .from("users")
    .select("id, first_name, last_name, email")
    .eq("organization_id", orgId);
  return (data ?? []) as ScimMember[];
}

export async function GET(request: NextRequest) {
  const provider = await authenticateScim(request);
  if (!provider) return scimError(401, "Invalid or missing SCIM bearer token");

  const service = createServiceClient();
  const { searchParams } = new URL(request.url);
  const startIndex = Math.max(1, parseInt(searchParams.get("startIndex") || "1"));
  const count = Math.min(200, Math.max(0, parseInt(searchParams.get("count") || "100")));
  const displayName = parseGroupFilter(searchParams.get("filter"));

  let query = service
    .from("organizations")
    .select(SCIM_GROUP_COLUMNS, { count: "exact" })
    .eq("metadata->>scim_managed", "true")
    .order("created_at", { ascending: true })
    .range(startIndex - 1, startIndex - 1 + Math.max(0, count - 1));
  if (displayName) query = query.eq("name", displayName);

  const { data, count: total, error } = await query;
  if (error) {
    console.error("SCIM Groups list error:", error.message);
    return scimError(500, "Internal error listing groups");
  }

  const baseUrl = baseUrlFrom(request);
  const resources = await Promise.all(
    (data ?? []).map(async (org: any) => toScimGroup(org, await fetchMembers(service, org.id), baseUrl))
  );
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

  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
  if (!displayName) return scimError(400, "displayName is required", "invalidValue");

  const service = createServiceClient();
  const externalId = typeof body?.externalId === "string" ? body.externalId : null;

  const { data: created, error } = await service
    .from("organizations")
    .insert({ name: displayName, type: "team", metadata: scimGroupMetadata(externalId) })
    .select(SCIM_GROUP_COLUMNS)
    .single();
  if (error) {
    console.error("SCIM Groups create error:", error.message);
    return scimError(500, "Internal error creating group");
  }

  // Assign any initial members to this group (one org per user).
  const memberIds = extractMemberIds(body);
  if (memberIds.length > 0) {
    await service.from("users").update({ organization_id: created.id }).in("id", memberIds);
  }

  const baseUrl = baseUrlFrom(request);
  return scimJson(toScimGroup(created as any, await fetchMembers(service, created.id), baseUrl), 201);
}
