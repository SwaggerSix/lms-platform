import { NextRequest } from "next/server";
import { authenticateScim, scimError, scimJson } from "@/lib/scim";

export async function GET(request: NextRequest) {
  const provider = await authenticateScim(request);
  if (!provider) return scimError(401, "Invalid or missing SCIM bearer token");

  return scimJson({
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    documentationUri: "https://datatracker.ietf.org/doc/html/rfc7644",
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: "oauthbearertoken",
        name: "OAuth Bearer Token",
        description: "Authentication via the SCIM bearer token issued for this provider.",
        primary: true,
      },
    ],
    meta: { resourceType: "ServiceProviderConfig" },
  });
}
