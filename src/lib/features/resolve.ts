import { defaultFeatureMap, normalizeFeatures } from "./catalog";

/**
 * Minimal shape of the Supabase client we use here. Kept intentionally loose
 * (`from` returning `any`) so both server code (createServiceClient) and the
 * middleware's own supabase-js client can share this resolution logic without
 * fighting the client's deeply-generic query-builder types.
 */
interface QueryableClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

/**
 * Resolve the effective feature-enablement map for a tenant.
 *
 * Precedence (lowest to highest): catalog defaults → platform_settings
 * overrides → tenant overrides. A tenant with no override inherits the
 * platform value; the platform with no override inherits the catalog default.
 */
export async function resolveEnabledFeatures(
  client: QueryableClient,
  tenantId: string | null
): Promise<Record<string, boolean>> {
  const result = defaultFeatureMap();

  // Platform-level overrides
  const { data: settings } = await client
    .from("platform_settings")
    .select("value")
    .eq("key", "features")
    .single();
  Object.assign(result, normalizeFeatures(settings?.value));

  // Tenant-level overrides
  if (tenantId) {
    const { data: tenant } = await client
      .from("tenants")
      .select("features")
      .eq("id", tenantId)
      .single();
    Object.assign(result, normalizeFeatures(tenant?.features));
  }

  return result;
}
