import {
  ConfidentialClientApplication,
  type Configuration,
} from "@azure/msal-node";
import type { SharePointRostersConfig } from "./types";

// ─────────────────────────────────────────────────────────────────
// Microsoft Graph auth — client-credentials.
//
// Uses the same Azure AD service principal as the GEMS integration,
// but with the Graph scope. The SP must additionally be granted
// `Sites.Selected` on the AMCIFileShare site (least-privilege) or
// `Sites.Read.All` tenant-wide.
//
// Tokens are cached per (tenant, client) in MSAL's in-memory cache.
// ─────────────────────────────────────────────────────────────────

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

const clientCache = new Map<string, ConfidentialClientApplication>();

function getClient(config: SharePointRostersConfig): ConfidentialClientApplication {
  const key = `graph:${config.tenant_id}:${config.client_id}`;
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

export async function getGraphAccessToken(config: SharePointRostersConfig): Promise<string> {
  const client = getClient(config);
  const result = await client.acquireTokenByClientCredential({ scopes: [GRAPH_SCOPE] });
  if (!result?.accessToken) {
    throw new Error("SharePoint auth: Microsoft Graph returned no access token");
  }
  return result.accessToken;
}

export function resetSharePointAuthCache(): void {
  clientCache.clear();
}
