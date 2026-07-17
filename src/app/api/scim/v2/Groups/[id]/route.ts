import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  authenticateScim,
  scimError,
  scimJson,
  toScimGroup,
  baseUrlFrom,
  extractMemberIds,
  SCIM_GROUP_COLUMNS,
  isScimManagedOrg,
  type ScimMember,
} from "@/lib/scim";

type Ctx = { params: Promise<{ id: string }> };

async function getScimGroup(service: ReturnType<typeof createServiceClient>, id: string) {
  const { data } = await service
    .from("organizations")
    .select(SCIM_GROUP_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (!data || !isScimManagedOrg(data as any)) return null;
  return data as any;
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

/** Set the group's membership to exactly `ids` (clears users no longer listed). */
async function replaceMembership(
  service: ReturnType<typeof createServiceClient>,
  orgId: string,
  ids: string[]
) {
  const desired = new Set(ids);
  const current = new Set((await fetchMembers(service, orgId)).map((m) => m.id));
  const toRemove = [...current].filter((id) => !desired.has(id));
  if (toRemove.length) await service.from("users").update({ organization_id: null }).in("id", toRemove);
  if (ids.length) await service.from("users").update({ organization_id: orgId }).in("id", ids);
}

async function respond(service: ReturnType<typeof createServiceClient>, org: any, request: NextRequest) {
  return scimJson(toScimGroup(org, await fetchMembers(service, org.id), baseUrlFrom(request)));
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const provider = await authenticateScim(request);
  if (!provider) return scimError(401, "Invalid or missing SCIM bearer token");
  const service = createServiceClient();
  const { id } = await params;
  const org = await getScimGroup(service, id);
  if (!org) return scimError(404, "Group not found");
  return respond(service, org, request);
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const provider = await authenticateScim(request);
  if (!provider) return scimError(401, "Invalid or missing SCIM bearer token");
  const service = createServiceClient();
  const { id } = await params;
  const org = await getScimGroup(service, id);
  if (!org) return scimError(404, "Group not found");

  let body: any;
  try {
    body = await request.json();
  } catch {
    return scimError(400, "Invalid JSON body", "invalidValue");
  }

  const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : org.name;
  const { data: updated, error } = await service
    .from("organizations")
    .update({ name: displayName, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SCIM_GROUP_COLUMNS)
    .single();
  if (error) {
    console.error("SCIM Groups PUT error:", error.message);
    return scimError(500, "Internal error updating group");
  }

  // PUT replaces the whole resource, including membership.
  await replaceMembership(service, id, extractMemberIds(body));
  return respond(service, updated, request);
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const provider = await authenticateScim(request);
  if (!provider) return scimError(401, "Invalid or missing SCIM bearer token");
  const service = createServiceClient();
  const { id } = await params;
  const org = await getScimGroup(service, id);
  if (!org) return scimError(404, "Group not found");

  let body: any;
  try {
    body = await request.json();
  } catch {
    return scimError(400, "Invalid JSON body", "invalidValue");
  }

  const ops = Array.isArray(body?.Operations) ? body.Operations : [];
  let newName: string | undefined;

  for (const op of ops) {
    if (!op || typeof op.op !== "string") continue;
    const opName = op.op.toLowerCase();
    const path: string | undefined = typeof op.path === "string" ? op.path : undefined;

    // displayName
    if (path === "displayName" && typeof op.value === "string") { newName = op.value.trim(); continue; }
    if (!path && op.value && typeof op.value.displayName === "string") { newName = op.value.displayName.trim(); }

    // membership
    if (path && /^members\b/i.test(path)) {
      if (opName === "remove") {
        const single = /members\[\s*value\s+eq\s+"([^"]+)"\s*\]/i.exec(path);
        if (single) {
          await service.from("users").update({ organization_id: null }).eq("id", single[1]).eq("organization_id", id);
        } else if (op.value !== undefined) {
          const ids = extractMemberIds(op.value);
          if (ids.length) await service.from("users").update({ organization_id: null }).in("id", ids).eq("organization_id", id);
        } else {
          // remove all members
          await service.from("users").update({ organization_id: null }).eq("organization_id", id);
        }
      } else if (opName === "add") {
        const ids = extractMemberIds(op.value);
        if (ids.length) await service.from("users").update({ organization_id: id }).in("id", ids);
      } else if (opName === "replace") {
        await replaceMembership(service, id, extractMemberIds(op.value));
      }
      continue;
    }

    // pathless value carrying members
    if (!path && op.value && "members" in op.value) {
      const ids = extractMemberIds(op.value.members);
      if (opName === "add") { if (ids.length) await service.from("users").update({ organization_id: id }).in("id", ids); }
      else if (opName === "replace") { await replaceMembership(service, id, ids); }
      else if (opName === "remove" && ids.length) { await service.from("users").update({ organization_id: null }).in("id", ids).eq("organization_id", id); }
    }
  }

  let current = org;
  if (newName !== undefined && newName) {
    const { data: renamed } = await service
      .from("organizations")
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(SCIM_GROUP_COLUMNS)
      .single();
    if (renamed) current = renamed;
  }
  return respond(service, current, request);
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const provider = await authenticateScim(request);
  if (!provider) return scimError(401, "Invalid or missing SCIM bearer token");
  const service = createServiceClient();
  const { id } = await params;
  const org = await getScimGroup(service, id);
  if (!org) return scimError(404, "Group not found");

  // Deleting a group deletes the org; users' organization_id is cleared by the
  // ON DELETE SET NULL FK, so member accounts are preserved.
  const { error } = await service.from("organizations").delete().eq("id", id);
  if (error) {
    console.error("SCIM Groups DELETE error:", error.message);
    return scimError(500, "Internal error deleting group");
  }
  return new Response(null, { status: 204 });
}
