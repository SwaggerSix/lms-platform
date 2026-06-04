import {
  ConfidentialClientApplication,
  type Configuration,
} from "@azure/msal-node";
import type { GemsConfig } from "./types";

// ─────────────────────────────────────────────────────────────────
// GEMS auth — Azure AD bearer tokens.
//
// Two modes:
//
//   app_only (default):
//     OAuth 2.0 client-credentials. The LMS authenticates as itself
//     (no user). Requires the service principal to have an Application
//     app role granted on the GEMS backend API, with admin consent.
//
//   delegated:
//     ROPC (username/password) against a designated service account
//     user. Used when the GEMS backend only accepts delegated tokens
//     (i.e., it checks the `scp` claim). The service account must have
//     MFA disabled and the existing `Gems.Access` delegated scope.
//
// MSAL caches tokens in-memory and refreshes them automatically.
// ─────────────────────────────────────────────────────────────────

// One MSAL client per (tenant, client, auth_mode) so token caches survive.
const clientCache = new Map<string, ConfidentialClientApplication>();

function authMode(config: GemsConfig): "app_only" | "delegated" {
  return config.auth_mode ?? "app_only";
}

function getClient(config: GemsConfig): ConfidentialClientApplication {
  const key = `${config.tenant_id}:${config.client_id}:${authMode(config)}`;
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

/** Default scope per auth mode. App-only uses `/.default`; delegated uses the named scope. */
export function resolveScope(config: GemsConfig): string {
  if (config.scope) return config.scope;
  return authMode(config) === "delegated"
    ? `${config.api_app_id_uri}/Gems.Access`
    : `${config.api_app_id_uri}/.default`;
}

/**
 * Acquire an access token for the GEMS API. Mode determined by config.auth_mode.
 * @throws if Azure AD returns no token (misconfigured SP, MFA on service account, etc.)
 */
export async function getAccessToken(config: GemsConfig): Promise<string> {
  const client = getClient(config);
  const scopes = [resolveScope(config)];

  let result;
  if (authMode(config) === "delegated") {
    if (!config.service_user_email || !config.service_user_password_encrypted) {
      throw new Error(
        "GEMS auth: delegated mode requires service_user_email and service_user_password_encrypted"
      );
    }
    result = await client.acquireTokenByUsernamePassword({
      scopes,
      username: config.service_user_email,
      password: config.service_user_password_encrypted,
    });
  } else {
    result = await client.acquireTokenByClientCredential({ scopes });
  }

  if (!result?.accessToken) {
    throw new Error("GEMS auth: Azure AD returned no access token");
  }
  return result.accessToken;
}

/** Clears the cached MSAL clients (e.g. after a credential rotation). */
export function resetGemsAuthCache(): void {
  clientCache.clear();
}
