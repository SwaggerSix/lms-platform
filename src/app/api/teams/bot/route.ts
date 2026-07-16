import { NextRequest, NextResponse } from "next/server";
import { createPublicKey, verify as cryptoVerify } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";

// ─── Bot Framework Configuration ────────────────────────────────

const AZURE_TENANT_ID =
  process.env.AZURE_TENANT_ID || "30295520-84b7-447c-ba6d-3a2b11790cd4";
const BOT_FRAMEWORK_OPENID_METADATA =
  "https://login.botframework.com/v1/.well-known/openidconfiguration";

// Hosts a Bot Framework serviceUrl is allowed to point at. The bearer token we
// attach to outbound replies is a real credential minted from the Azure client
// secret, so we never send it to a host outside this allowlist even if a forged
// activity asks us to (SSRF / token-exfiltration guard).
const ALLOWED_SERVICE_URL_SUFFIXES = [
  ".botframework.com",
  ".trafficmanager.net",
];

// A Bot Framework JWK (RSA public key from the signing JWKS).
interface SigningJwk extends JsonWebKey {
  kid?: string;
  x5c?: string[];
}

// JWKS cache
let jwksCache: { keys: SigningJwk[]; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL = 3600_000; // 1 hour

// ─── Types ──────────────────────────────────────────────────────

interface BotActivity {
  type: string;
  id?: string;
  timestamp?: string;
  channelId?: string;
  from?: { id: string; name?: string; aadObjectId?: string };
  conversation?: { id: string; tenantId?: string; conversationType?: string };
  recipient?: { id: string; name?: string };
  text?: string;
  serviceUrl?: string;
  channelData?: Record<string, unknown>;
  value?: Record<string, unknown>;
}

interface BotResponse {
  type: "message";
  text: string;
  textFormat?: "plain" | "markdown";
}

// ─── POST Handler ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Verify Bot Framework JWT token (signature + issuer/audience/expiry).
    const authHeader = request.headers.get("authorization");
    const claims = await verifyBotFrameworkToken(authHeader);
    if (!claims) {
      return NextResponse.json(
        { error: "Unauthorized: invalid Bot Framework token" },
        { status: 401 }
      );
    }

    const activity: BotActivity = await request.json();

    // Only reply to the serviceUrl the token was issued for. Bot Framework
    // signs a `serviceurl` claim; trusting the activity's field instead would
    // let a forged activity redirect our bearer token to an attacker host.
    const trustedServiceUrl =
      typeof claims.serviceurl === "string" ? claims.serviceurl : undefined;

    // Handle different activity types
    switch (activity.type) {
      case "message":
        return await handleMessage(activity, trustedServiceUrl);

      case "conversationUpdate":
        return await handleConversationUpdate(activity, trustedServiceUrl);

      case "invoke":
        return NextResponse.json({ status: 200 }, { status: 200 });

      default:
        return NextResponse.json({ status: 200 }, { status: 200 });
    }
  } catch (err: any) {
    console.error("Teams bot error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─── Message Handler ────────────────────────────────────────────

async function handleMessage(
  activity: BotActivity,
  trustedServiceUrl?: string
): Promise<NextResponse> {
  const text = (activity.text || "").trim().toLowerCase();

  // Strip bot mention from message text (Teams prepends <at>BotName</at>)
  const cleanText = text.replace(/<at>.*?<\/at>/gi, "").trim();

  let response: BotResponse;

  switch (true) {
    case cleanText === "help" || cleanText === "":
      response = buildHelpResponse();
      break;

    case cleanText === "my courses" || cleanText === "courses":
      response = await buildMyCoursesResponse(activity.from?.aadObjectId);
      break;

    case cleanText === "progress":
      response = await buildProgressResponse(activity.from?.aadObjectId);
      break;

    default:
      response = buildUnknownCommandResponse(cleanText);
      break;
  }

  // Send reply via the token-issued Bot Framework service URL.
  const serviceUrl = resolveServiceUrl(trustedServiceUrl, activity.serviceUrl);
  if (serviceUrl && activity.conversation?.id) {
    await sendBotReply(
      serviceUrl,
      activity.conversation.id,
      activity.id || "",
      response
    );
  }

  return NextResponse.json({ status: 200 }, { status: 200 });
}

// ─── Conversation Update Handler ────────────────────────────────

async function handleConversationUpdate(
  activity: BotActivity,
  trustedServiceUrl?: string
): Promise<NextResponse> {
  const serviceUrl = resolveServiceUrl(trustedServiceUrl, activity.serviceUrl);
  // Send a welcome message when the bot is added to a conversation
  if (serviceUrl && activity.conversation?.id) {
    const welcome: BotResponse = {
      type: "message",
      text:
        "**Welcome to LearnHub LMS!** 🎓\n\n" +
        "I can help you access your learning information right here in Teams.\n\n" +
        "Try these commands:\n" +
        "- **my courses** - View your enrolled courses\n" +
        "- **progress** - Check your learning progress\n" +
        "- **help** - Show all available commands",
      textFormat: "markdown",
    };

    await sendBotReply(
      serviceUrl,
      activity.conversation.id,
      "",
      welcome
    );
  }

  return NextResponse.json({ status: 200 }, { status: 200 });
}

// ─── Response Builders ──────────────────────────────────────────

function buildHelpResponse(): BotResponse {
  return {
    type: "message",
    text:
      "**LearnHub LMS Bot Commands** 🎓\n\n" +
      "| Command | Description |\n" +
      "|---------|-------------|\n" +
      "| **my courses** | View your enrolled courses and progress |\n" +
      "| **progress** | Check your overall learning progress |\n" +
      "| **help** | Show this help message |\n\n" +
      "You can also access the full LMS at [learn.gothamgovernment.com](https://learn.gothamgovernment.com)",
    textFormat: "markdown",
  };
}

async function buildMyCoursesResponse(
  aadObjectId?: string
): Promise<BotResponse> {
  if (!aadObjectId) {
    return {
      type: "message",
      text: "I could not identify your user account. Please make sure your Azure AD account is linked to the LMS.",
      textFormat: "plain",
    };
  }

  try {
    const service = createServiceClient();

    // Look up user by Azure AD object ID (external_id or azure_ad_id).
    const user = await findUserByAadObjectId(service, aadObjectId, "id");

    if (!user) {
      return {
        type: "message",
        text:
          "Your Azure AD account is not linked to an LMS profile yet.\n\n" +
          "Please sign in at [learn.gothamgovernment.com](https://learn.gothamgovernment.com) first.",
        textFormat: "markdown",
      };
    }

    // Get enrollments
    const { data: enrollments } = await service
      .from("enrollments")
      .select("status, progress, courses(title)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (!enrollments || enrollments.length === 0) {
      return {
        type: "message",
        text: "You are not enrolled in any courses yet. Browse the [course catalog](https://learn.gothamgovernment.com/learn/catalog) to get started!",
        textFormat: "markdown",
      };
    }

    let text = "**Your Courses** 📚\n\n";
    text += "| Course | Progress | Status |\n";
    text += "|--------|----------|--------|\n";

    for (const enrollment of enrollments) {
      const course = (enrollment as any).courses;
      const title = course?.title || "Unknown Course";
      const progress = enrollment.progress ?? 0;
      const status = enrollment.status || "active";
      const progressBar = `${Math.round(progress)}%`;
      text += `| ${title} | ${progressBar} | ${status} |\n`;
    }

    text += `\n[View all courses](https://learn.gothamgovernment.com/learn/my-courses)`;

    return { type: "message", text, textFormat: "markdown" };
  } catch (err) {
    console.error("Error fetching courses for bot:", err);
    return {
      type: "message",
      text: "Sorry, I had trouble fetching your courses. Please try again later.",
      textFormat: "plain",
    };
  }
}

async function buildProgressResponse(
  aadObjectId?: string
): Promise<BotResponse> {
  if (!aadObjectId) {
    return {
      type: "message",
      text: "I could not identify your user account. Please make sure your Azure AD account is linked to the LMS.",
      textFormat: "plain",
    };
  }

  try {
    const service = createServiceClient();

    const user = await findUserByAadObjectId(service, aadObjectId, "id, first_name");

    if (!user) {
      return {
        type: "message",
        text:
          "Your Azure AD account is not linked to an LMS profile yet.\n\n" +
          "Please sign in at [learn.gothamgovernment.com](https://learn.gothamgovernment.com) first.",
        textFormat: "markdown",
      };
    }

    // Get enrollment stats
    const { count: totalEnrollments } = await service
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { count: completedEnrollments } = await service
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed");

    const { count: certificateCount } = await service
      .from("user_certificates")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    const total = totalEnrollments ?? 0;
    const completed = completedEnrollments ?? 0;
    const certs = certificateCount ?? 0;
    const inProgress = total - completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    let text = `**Learning Progress for ${user.first_name || "you"}** 📊\n\n`;
    text += `| Metric | Value |\n`;
    text += `|--------|-------|\n`;
    text += `| Total Enrollments | ${total} |\n`;
    text += `| Completed | ${completed} |\n`;
    text += `| In Progress | ${inProgress} |\n`;
    text += `| Completion Rate | ${completionRate}% |\n`;
    text += `| Certificates Earned | ${certs} |\n`;
    text += `\n[View full transcript](https://learn.gothamgovernment.com/learn/transcript)`;

    return { type: "message", text, textFormat: "markdown" };
  } catch (err) {
    console.error("Error fetching progress for bot:", err);
    return {
      type: "message",
      text: "Sorry, I had trouble fetching your progress. Please try again later.",
      textFormat: "plain",
    };
  }
}

function buildUnknownCommandResponse(text: string): BotResponse {
  return {
    type: "message",
    text:
      `I did not recognize the command "${text}".\n\n` +
      "Type **help** to see available commands.",
    textFormat: "markdown",
  };
}

// ─── User Lookup ────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve an LMS user from an Azure AD object ID.
 *
 * The object ID is validated as a GUID before use so it can never be
 * interpreted as a PostgREST filter expression, and the lookups use
 * parameterized `.eq()` calls (never string-interpolated `.or()`), which run
 * with the RLS-bypassing service-role key.
 */
async function findUserByAadObjectId(
  service: ReturnType<typeof createServiceClient>,
  aadObjectId: string,
  columns: string
): Promise<Record<string, any> | null> {
  if (!UUID_RE.test(aadObjectId)) return null;

  const byExternal = await service
    .from("users")
    .select(columns)
    .eq("external_id", aadObjectId)
    .maybeSingle();
  if (byExternal.data) return byExternal.data as Record<string, any>;

  const byAzure = await service
    .from("users")
    .select(columns)
    .eq("azure_ad_id", aadObjectId)
    .maybeSingle();
  return (byAzure.data as Record<string, any>) ?? null;
}

// ─── Service URL Validation ─────────────────────────────────────

function normalizeUrl(u: string): string {
  return u.replace(/\/+$/, "").toLowerCase();
}

function isAllowedServiceUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_SERVICE_URL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Decide which serviceUrl (if any) is safe to send the bearer-token-carrying
 * reply to. Prefers the token's signed `serviceurl` claim; the activity's own
 * field is only trusted when it matches that claim (or when the token omits
 * it), and the final URL must resolve to an allowlisted Bot Framework host.
 */
function resolveServiceUrl(
  trustedServiceUrl: string | undefined,
  activityServiceUrl: string | undefined
): string | null {
  const candidate = trustedServiceUrl || activityServiceUrl;
  if (!candidate) return null;
  if (
    trustedServiceUrl &&
    activityServiceUrl &&
    normalizeUrl(trustedServiceUrl) !== normalizeUrl(activityServiceUrl)
  ) {
    return null;
  }
  return isAllowedServiceUrl(candidate) ? candidate : null;
}

// ─── Send Reply via Bot Framework ───────────────────────────────

async function sendBotReply(
  serviceUrl: string,
  conversationId: string,
  replyToId: string,
  response: BotResponse
): Promise<void> {
  try {
    // Get an access token to call the Bot Framework service
    const token = await getBotFrameworkToken();

    const url = `${serviceUrl.replace(/\/$/, "")}/v3/conversations/${conversationId}/activities${
      replyToId ? `/${replyToId}` : ""
    }`;

    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(response),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error("Failed to send bot reply:", err);
  }
}

// ─── Bot Framework Token ────────────────────────────────────────

let botToken: { token: string; expiresAt: number } | null = null;

async function getBotFrameworkToken(): Promise<string> {
  if (botToken && botToken.expiresAt > Date.now() + 300_000) {
    return botToken.token;
  }

  const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || "";
  const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || "";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: AZURE_CLIENT_ID,
    client_secret: AZURE_CLIENT_SECRET,
    scope: "https://api.botframework.com/.default",
  });

  const response = await fetch(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get Bot Framework token: ${response.status}`);
  }

  const data = await response.json();
  botToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// ─── JWT Token Verification ─────────────────────────────────────

interface BotTokenClaims {
  iss?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
  serviceurl?: string;
  [key: string]: unknown;
}

/**
 * Fetch (and cache) the Bot Framework signing keys, discovering the JWKS URI
 * from the OpenID metadata document rather than hardcoding it.
 */
async function getSigningKeys(): Promise<SigningJwk[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_TTL) {
    return jwksCache.keys;
  }

  const metaRes = await fetch(BOT_FRAMEWORK_OPENID_METADATA, {
    signal: AbortSignal.timeout(10000),
  });
  if (!metaRes.ok) {
    throw new Error(
      `Failed to fetch Bot Framework OpenID metadata: ${metaRes.status}`
    );
  }
  const meta = await metaRes.json();
  const jwksUri: string | undefined = meta.jwks_uri;
  if (!jwksUri) throw new Error("Bot Framework OpenID metadata missing jwks_uri");

  const jwksRes = await fetch(jwksUri, { signal: AbortSignal.timeout(10000) });
  if (!jwksRes.ok) {
    throw new Error(`Failed to fetch Bot Framework JWKS: ${jwksRes.status}`);
  }
  const jwks = await jwksRes.json();
  const keys: SigningJwk[] = Array.isArray(jwks.keys) ? jwks.keys : [];
  jwksCache = { keys, fetchedAt: Date.now() };
  return keys;
}

async function getSigningKey(kid: string): Promise<SigningJwk | null> {
  const keys = await getSigningKeys();
  const match = keys.find((k) => k.kid === kid);
  if (match) return match;

  // Key may have rotated since the cache was populated — refetch once.
  jwksCache = null;
  const refreshed = await getSigningKeys();
  return refreshed.find((k) => k.kid === kid) ?? null;
}

/**
 * Verify the Bot Framework JWT from the Authorization header: RS256 signature
 * against the published JWKS, plus issuer/audience/expiry claims. Returns the
 * validated claims on success, or null on any failure.
 */
async function verifyBotFrameworkToken(
  authHeader: string | null
): Promise<BotTokenClaims | null> {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  const token = parts[1];
  if (!token) return null;

  try {
    const segments = token.split(".");
    if (segments.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = segments;

    const header = JSON.parse(
      Buffer.from(headerB64, "base64url").toString("utf8")
    );
    const payload: BotTokenClaims = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );

    // Bot Framework signs with RS256; reject anything else (incl. "none").
    if (header.alg !== "RS256" || !header.kid) return null;

    const jwk = await getSigningKey(header.kid);
    if (!jwk) {
      console.warn("Bot Framework token references unknown signing key");
      return null;
    }

    const publicKey = createPublicKey({ key: jwk, format: "jwk" });
    const signatureValid = cryptoVerify(
      "RSA-SHA256",
      Buffer.from(`${headerB64}.${payloadB64}`),
      publicKey,
      Buffer.from(signatureB64, "base64url")
    );
    if (!signatureValid) {
      console.warn("Bot Framework token signature verification failed");
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      console.warn("Bot Framework token expired");
      return null;
    }
    if (payload.nbf && payload.nbf > now + 300) {
      console.warn("Bot Framework token not yet valid");
      return null;
    }

    const validIssuers = [
      "https://api.botframework.com",
      `https://sts.windows.net/${AZURE_TENANT_ID}/`,
      `https://login.microsoftonline.com/${AZURE_TENANT_ID}/v2.0`,
    ];
    if (payload.iss && !validIssuers.includes(payload.iss)) {
      console.warn("Bot Framework token has unexpected issuer:", payload.iss);
      return null;
    }

    const AZURE_CLIENT_ID =
      process.env.AZURE_CLIENT_ID || "8f0b9c26-2b2a-4655-8e36-32ad350ef6e4";
    if (payload.aud && payload.aud !== AZURE_CLIENT_ID) {
      console.warn("Bot Framework token has unexpected audience:", payload.aud);
      return null;
    }

    return payload;
  } catch (err) {
    console.error("Bot Framework token verification error:", err);
    return null;
  }
}
