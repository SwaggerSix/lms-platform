import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Minimal SCIM 2.0 (RFC 7643/7644) support for the Users resource, used by an
 * IdP to provision/deprovision LMS accounts. Authentication is the per-provider
 * SCIM bearer token (hashed into sso_providers.scim_token_hash); there is no
 * user session. SCIM only manages the accounts it created (external_source =
 * 'scim'), so it can never deactivate a manually-created admin.
 */

export const SCIM_EXTERNAL_SOURCE = "scim";
export const SCIM_CONTENT_TYPE = "application/scim+json";

const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";
const LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";

export interface ScimProvider {
  providerId: string;
  domain: string | null;
}

/** Authenticate a SCIM request against the stored per-provider token hash. */
export async function authenticateScim(request: NextRequest): Promise<ScimProvider | null> {
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  const hash = createHash("sha256").update(token).digest("hex");
  const service = createServiceClient();
  const { data } = await service
    .from("sso_providers")
    .select("id, domain, scim_enabled")
    .eq("scim_token_hash", hash)
    .maybeSingle();

  if (!data || data.scim_enabled !== true) return null;
  return { providerId: data.id, domain: data.domain ?? null };
}

export function scimJson(body: unknown, status = 200): NextResponse {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "Content-Type": SCIM_CONTENT_TYPE },
  });
}

export function scimError(status: number, detail: string, scimType?: string): NextResponse {
  return scimJson(
    { schemas: [ERROR_SCHEMA], status: String(status), ...(scimType ? { scimType } : {}), detail },
    status
  );
}

export interface DbUserRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export function toScimUser(u: DbUserRow, baseUrl: string) {
  const displayName = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || u.email;
  return {
    schemas: [USER_SCHEMA],
    id: u.id,
    ...(u.external_id ? { externalId: u.external_id } : {}),
    userName: u.email,
    name: { givenName: u.first_name ?? "", familyName: u.last_name ?? "", formatted: displayName },
    displayName,
    emails: [{ value: u.email, primary: true, type: "work" }],
    active: u.status === "active",
    meta: {
      resourceType: "User",
      created: u.created_at,
      lastModified: u.updated_at,
      location: `${baseUrl}/api/scim/v2/Users/${u.id}`,
    },
  };
}

export function scimListResponse(resources: unknown[], totalResults: number, startIndex: number) {
  return {
    schemas: [LIST_SCHEMA],
    totalResults,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
  };
}

/** Extract the primary email (userName) from a SCIM create/replace payload. */
export function extractEmail(body: any): string | null {
  if (typeof body?.userName === "string" && body.userName.includes("@")) {
    return body.userName.trim().toLowerCase();
  }
  if (Array.isArray(body?.emails)) {
    const primary = body.emails.find((e: any) => e?.primary) ?? body.emails[0];
    if (typeof primary?.value === "string") return primary.value.trim().toLowerCase();
  }
  if (typeof body?.userName === "string" && body.userName.trim()) {
    return body.userName.trim().toLowerCase();
  }
  return null;
}

export function extractNames(body: any, email: string): { first_name: string; last_name: string } {
  const given = typeof body?.name?.givenName === "string" ? body.name.givenName.trim() : "";
  const family = typeof body?.name?.familyName === "string" ? body.name.familyName.trim() : "";
  return {
    first_name: given || email.split("@")[0],
    last_name: family || "",
  };
}

/** The columns SCIM reads back, in one place. */
export const SCIM_USER_COLUMNS =
  "id, email, first_name, last_name, status, external_id, created_at, updated_at";

export function baseUrlFrom(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

// ─── Groups ↔ organizations ─────────────────────────────────────
//
// A SCIM Group maps to an `organizations` row; membership maps to
// `users.organization_id`. SCIM-managed orgs are tagged in metadata so SCIM
// never touches a manually-created organization. Note: the LMS gives each user
// a single organization, so a user can belong to only one SCIM group at a time.

export const SCIM_GROUP_COLUMNS = "id, name, metadata, created_at, updated_at";

export interface DbOrgRow {
  id: string;
  name: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ScimMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export function isScimManagedOrg(org: { metadata?: Record<string, unknown> | null }): boolean {
  return org.metadata?.scim_managed === true;
}

export function orgExternalId(org: { metadata?: Record<string, unknown> | null }): string | null {
  const v = org.metadata?.scim_external_id;
  return typeof v === "string" ? v : null;
}

export function scimGroupMetadata(externalId: string | null): Record<string, unknown> {
  return { scim_managed: true, ...(externalId ? { scim_external_id: externalId } : {}) };
}

export function toScimGroup(org: DbOrgRow, members: ScimMember[], baseUrl: string) {
  const externalId = orgExternalId(org);
  return {
    schemas: [GROUP_SCHEMA],
    id: org.id,
    ...(externalId ? { externalId } : {}),
    displayName: org.name,
    members: members.map((m) => ({
      value: m.id,
      display: `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email,
      $ref: `${baseUrl}/api/scim/v2/Users/${m.id}`,
    })),
    meta: {
      resourceType: "Group",
      created: org.created_at,
      lastModified: org.updated_at,
      location: `${baseUrl}/api/scim/v2/Groups/${org.id}`,
    },
  };
}

/** Member ids from a SCIM group create/replace/patch value. */
export function extractMemberIds(value: any): string[] {
  const members = Array.isArray(value?.members) ? value.members : Array.isArray(value) ? value : [];
  return members
    .map((m: any) => (typeof m === "string" ? m : m?.value))
    .filter((v: unknown): v is string => typeof v === "string" && v.length > 0);
}
