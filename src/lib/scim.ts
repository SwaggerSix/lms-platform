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
