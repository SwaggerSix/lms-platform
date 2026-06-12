import {
  ConfidentialClientApplication,
  PublicClientApplication,
  type Configuration,
} from "@azure/msal-node";
import type { SharePointRostersConfig } from "./types";

// ─────────────────────────────────────────────────────────────────
// Microsoft Graph auth for the SharePoint roster integration.
//
// Two modes, mirroring the GEMS integration:
//
//   app_only:
//     Client-credentials. Uses ConfidentialClientApplication. Requires
//     the LMS app to have an Application-type Graph permission
//     (Sites.Selected or Sites.Read.All) with admin consent.
//     Scope: https://graph.microsoft.com/.default
//
//   delegated:
//     ROPC (username/password) via PublicClientApplication. Uses the
//     same designated service-account user as GEMS. Whatever SharePoint
//     sites that user can read, the integration can read.
//     Scope: https://graph.microsoft.com/Sites.Read.All (delegated)
//
// MSAL caches tokens in-memory per app instance.
// ─────────────────────────────────────────────────────────────────

const APP_ONLY_SCOPE = "https://graph.microsoft.com/.default";
const DELEGATED_SCOPE = "https://graph.microsoft.com/Sites.Read.All";

const confidentialCache = new Map<string, ConfidentialClientApplication>();
const publicCache = new Map<string, PublicClientApplication>();

function authMode(config: SharePointRostersConfig): "app_only" | "delegated" {
  return config.auth_mode ?? "app_only";
}

function getConfidentialClient(config: SharePointRostersConfig): ConfidentialClientApplication {
  const key = `graph:${config.tenant_id}:${config.client_id}`;
  let client = confidentialCache.get(key);
  if (!client) {
    const msalConfig: Configuration = {
      auth: {
        clientId: config.client_id,
        authority: `https://login.microsoftonline.com/${config.tenant_id}`,
        clientSecret: config.client_secret_encrypted,
      },
    };
    client = new ConfidentialClientApplication(msalConfig);
    confidentialCache.set(key, client);
  }
  return client;
}

function getPublicClient(config: SharePointRostersConfig): PublicClientApplication {
  const key = `graph:${config.tenant_id}:${config.client_id}`;
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

export async function getGraphAccessToken(config: SharePointRostersConfig): Promise<string> {
  let result;
  if (authMode(config) === "delegated") {
    if (!config.service_user_email || !config.service_user_password_encrypted) {
      throw new Error(
        "SharePoint auth: delegated mode requires service_user_email and service_user_password_encrypted"
      );
    }
    const client = getPublicClient(config);
    result = await client.acquireTokenByUsernamePassword({
      scopes: [DELEGATED_SCOPE],
      username: config.service_user_email,
      password: config.service_user_password_encrypted,
    });
  } else {
    const client = getConfidentialClient(config);
    result = await client.acquireTokenByClientCredential({ scopes: [APP_ONLY_SCOPE] });
  }
  if (!result?.accessToken) {
    throw new Error("SharePoint auth: Microsoft Graph returned no access token");
  }
  return result.accessToken;
}

export function resetSharePointAuthCache(): void {
  confidentialCache.clear();
  publicCache.clear();
}
