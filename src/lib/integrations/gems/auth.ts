import {
  ConfidentialClientApplication,
  type Configuration,
} from "@azure/msal-node";
import type { GemsConfig } from "./types";

// ─────────────────────────────────────────────────────────────────
// GEMS auth — Azure AD OAuth 2.0 client-credentials flow.
//
// Acquires an app-only bearer token for the GEMS backend API using a
// service principal (no signed-in user). MSAL caches tokens in-memory
// and refreshes them automatically, so callers can fetch on every
// request cheaply. Requires the service principal to be granted access
// to the GEMS backend API app (Gems.Access) by the GEMS admin.
// ─────────────────────────────────────────────────────────────────

// One MSAL client per (tenant, client) pair so the in-memory token
// cache survives across calls within a process.
const clientCache = new Map<string, ConfidentialClientApplication>();

function getClient(config: GemsConfig): ConfidentialClientApplication {
  const key = `${config.tenant_id}:${config.client_id}`;
  let client = clientCache.get(key);
  if (!client) {
    const msalConfig: Configuration = {
      auth: {
        clientId: config.client_id,
        authority: `https://login.microsoftonline.com/${config.tenant_id}`,
        clientSecret: config.client_secret_encrypted,
      },
    };
    client = new ConfidentialClientApplication(msalConfig);
    clientCache.set(key, client);
  }
  return client;
}

/** Default scope for client-credentials against the GEMS backend API app. */
export function resolveScope(config: GemsConfig): string {
  return config.scope ?? `${config.api_app_id_uri}/.default`;
}

/**
 * Acquire an app-only access token for the GEMS API.
 * @throws if Azure AD returns no token (misconfigured SP, missing consent, etc.)
 */
export async function getAccessToken(config: GemsConfig): Promise<string> {
  const client = getClient(config);
  const result = await client.acquireTokenByClientCredential({
    scopes: [resolveScope(config)],
  });
  if (!result?.accessToken) {
    throw new Error("GEMS auth: Azure AD returned no access token");
  }
  return result.accessToken;
}

/** Clears the cached MSAL clients (e.g. after a credential rotation). */
export function resetGemsAuthCache(): void {
  clientCache.clear();
}
