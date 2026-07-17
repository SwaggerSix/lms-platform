import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  authenticateScim,
  scimError,
  scimJson,
  toScimUser,
  extractNames,
  baseUrlFrom,
  SCIM_EXTERNAL_SOURCE,
  SCIM_USER_COLUMNS,
} from "@/lib/scim";

type Ctx = { params: Promise<{ id: string }> };

/** Fetch a SCIM-managed user (never a manually-created account). */
async function getScimUser(service: ReturnType<typeof createServiceClient>, id: string) {
  const { data } = await service
    .from("users")
    .select(SCIM_USER_COLUMNS + ", auth_id")
    .eq("id", id)
    .eq("external_source", SCIM_EXTERNAL_SOURCE)
    .maybeSingle();
  return data as any;
}

/** Best-effort: block/allow the Supabase auth login when (de)activating. */
async function setAuthBan(
  service: ReturnType<typeof createServiceClient>,
  authId: string | null | undefined,
  banned: boolean
) {
  if (!authId) return;
  try {
    await service.auth.admin.updateUserById(authId, {
      ban_duration: banned ? "876000h" : "none",
    } as any);
  } catch {
    /* non-fatal */
  }
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const provider = await authenticateScim(request);
  if (!provider) return scimError(401, "Invalid or missing SCIM bearer token");

  const service = createServiceClient();
  const { id } = await params;
  const user = await getScimUser(service, id);
  if (!user) return scimError(404, "User not found");
  return scimJson(toScimUser(user, baseUrlFrom(request)));
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const provider = await authenticateScim(request);
  if (!provider) return scimError(401, "Invalid or missing SCIM bearer token");

  const service = createServiceClient();
  const { id } = await params;
  const user = await getScimUser(service, id);
  if (!user) return scimError(404, "User not found");

  let body: any;
  try {
    body = await request.json();
  } catch {
    return scimError(400, "Invalid JSON body", "invalidValue");
  }

  const active = body?.active !== false;
  const { first_name, last_name } = extractNames(body, user.email);
  const updates: Record<string, unknown> = {
    first_name,
    last_name,
    status: active ? "active" : "inactive",
    updated_at: new Date().toISOString(),
  };
  if (typeof body?.externalId === "string") updates.external_id = body.externalId;

  const { data, error } = await service
    .from("users")
    .update(updates)
    .eq("id", id)
    .select(SCIM_USER_COLUMNS)
    .single();
  if (error) {
    console.error("SCIM Users PUT error:", error.message);
    return scimError(500, "Internal error updating user");
  }

  await setAuthBan(service, user.auth_id, !active);
  return scimJson(toScimUser(data as any, baseUrlFrom(request)));
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const provider = await authenticateScim(request);
  if (!provider) return scimError(401, "Invalid or missing SCIM bearer token");

  const service = createServiceClient();
  const { id } = await params;
  const user = await getScimUser(service, id);
  if (!user) return scimError(404, "User not found");

  let body: any;
  try {
    body = await request.json();
  } catch {
    return scimError(400, "Invalid JSON body", "invalidValue");
  }

  const ops = Array.isArray(body?.Operations) ? body.Operations : [];
  const updates: Record<string, unknown> = {};

  const applyField = (path: string, value: unknown) => {
    const p = path.toLowerCase();
    if (p === "active") updates.status = value === false || value === "false" ? "inactive" : "active";
    else if (p === "name.givenname") updates.first_name = String(value ?? "");
    else if (p === "name.familyname") updates.last_name = String(value ?? "");
    else if (p === "externalid") updates.external_id = value == null ? null : String(value);
  };

  for (const op of ops) {
    if (!op || typeof op.op !== "string") continue;
    if (op.op.toLowerCase() === "remove") continue; // nothing removable that we map
    if (typeof op.path === "string") {
      applyField(op.path, op.value);
    } else if (op.value && typeof op.value === "object") {
      // Pathless replace: value is a partial resource.
      if ("active" in op.value) applyField("active", op.value.active);
      if (op.value.name?.givenName !== undefined) applyField("name.givenName", op.value.name.givenName);
      if (op.value.name?.familyName !== undefined) applyField("name.familyName", op.value.name.familyName);
      if (op.value.externalId !== undefined) applyField("externalId", op.value.externalId);
    }
  }

  if (Object.keys(updates).length === 0) {
    return scimJson(toScimUser(user, baseUrlFrom(request)));
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await service
    .from("users")
    .update(updates)
    .eq("id", id)
    .select(SCIM_USER_COLUMNS)
    .single();
  if (error) {
    console.error("SCIM Users PATCH error:", error.message);
    return scimError(500, "Internal error updating user");
  }

  if ("status" in updates) await setAuthBan(service, user.auth_id, updates.status === "inactive");
  return scimJson(toScimUser(data as any, baseUrlFrom(request)));
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const provider = await authenticateScim(request);
  if (!provider) return scimError(401, "Invalid or missing SCIM bearer token");

  const service = createServiceClient();
  const { id } = await params;
  const user = await getScimUser(service, id);
  if (!user) return scimError(404, "User not found");

  // Soft-deactivate: keep training records for audit history, block login.
  const { error } = await service
    .from("users")
    .update({ status: "inactive", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("SCIM Users DELETE error:", error.message);
    return scimError(500, "Internal error deactivating user");
  }

  await setAuthBan(service, user.auth_id, true);
  return new Response(null, { status: 204 });
}
