import {
  ConfidentialClientApplication,
  PublicClientApplication,
  type Configuration,
} from "@azure/msal-node";
import type { GemsConfig } from "./types";
import { decryptIfEncrypted } from "@/lib/security/secret-crypto";

// ─────────────────────────────────────────────────────────────────
// GEMS auth — Azure AD bearer tokens.
//
// Two modes:
//
//   app_only (default):
//     OAuth 2.0 client-credentials via ConfidentialClientApplication.
//     The LMS authenticates as itself (no user). Requires the SP to
//     have an Application app role granted on the GEMS backend API,
//     with admin consent.
//
//   delegated:
//     ROPC (username/password) against a designated service account
//     user via PublicClientApplication. Used when the GEMS backend
//     only accepts delegated tokens (i.e., it checks the `scp` claim).
//     The LMS app registration must have "public client flows" enabled
//     in Entra; no client_secret is required for this mode.
//
// MSAL caches tokens in-memory per app instance.
// ─────────────────────────────────────────────────────────────────

// Cache MSAL clients per (tenant, client, auth_mode) so token caches survive.
const confidentialCache = new Map<string, ConfidentialClientApplication>();
const publicCache = new Map<string, PublicClientApplication>();

function authMode(config: GemsConfig): "app_only" | "delegated" {
  return config.auth_mode ?? "app_only";
}

function getConfidentialClient(config: GemsConfig): ConfidentialClientApplication {
  const key = `${config.tenant_id}:${config.client_id}`;
  let client = confidentialCache.get(key);
  if (!client) {
    const msalConfig: Configuration = {
      auth: {
        clientId: config.client_id,
        authority: `https://login.microsoftonline.com/${config.tenant_id}`,
        clientSecret: decryptIfEncrypted(config.client_secret_encrypted),
      },
    };
    client = new ConfidentialClientApplication(msalConfig);
    confidentialCache.set(key, client);
  }
  return client;
}

function getPublicClient(config: GemsConfig): PublicClientApplication {
  const key = `${config.tenant_id}:${config.client_id}`;
  let client = publicCache.get(key);
  if (!client) {
    const msalConfig: Configuration = {
      auth: {
        clientId: config.client_id,
        authority: `https://login.microsoftonline.com/${config.tenant_id}`,
      },
    };
    client = new PublicClientApplication(msalConfig);
    publicCache.set(key, client);
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
  const scopes = [resolveScope(config)];

  let result;
  if (authMode(config) === "delegated") {
    if (!config.service_user_email || !config.service_user_password_encrypted) {
      throw new Error(
        "GEMS auth: delegated mode requires service_user_email and service_user_password_encrypted"
      );
    }
    const client = getPublicClient(config);
    result = await client.acquireTokenByUsernamePassword({
      scopes,
      username: config.service_user_email,
      password: decryptIfEncrypted(config.service_user_password_encrypted),
    });
  } else {
    const client = getConfidentialClient(config);
    result = await client.acquireTokenByClientCredential({ scopes });
  }

  if (!result?.accessToken) {
    throw new Error("GEMS auth: Azure AD returned no access token");
  }
  return result.accessToken;
}

/** Clears the cached MSAL clients (e.g. after a credential rotation). */
export function resetGemsAuthCache(): void {
  confidentialCache.clear();
  publicCache.clear();
}
