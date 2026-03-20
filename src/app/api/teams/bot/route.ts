import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// ─── Bot Framework Configuration ────────────────────────────────

const AZURE_TENANT_ID =
  process.env.AZURE_TENANT_ID || "30295520-84b7-447c-ba6d-3a2b11790cd4";
const BOT_FRAMEWORK_OPENID_METADATA =
  "https://login.botframework.com/v1/.well-known/openidconfiguration";

// JWKS cache
let jwksCache: { keys: JsonWebKey[]; fetchedAt: number } | null = null;
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
    // Verify Bot Framework JWT token
    const authHeader = request.headers.get("authorization");
    const tokenValid = await verifyBotFrameworkToken(authHeader);
    if (!tokenValid) {
      return NextResponse.json(
        { error: "Unauthorized: invalid Bot Framework token" },
        { status: 401 }
      );
    }

    const activity: BotActivity = await request.json();

    // Handle different activity types
    switch (activity.type) {
      case "message":
        return await handleMessage(activity);

      case "conversationUpdate":
        return await handleConversationUpdate(activity);

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

async function handleMessage(activity: BotActivity): Promise<NextResponse> {
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

  // Send reply via Bot Framework service URL
  if (activity.serviceUrl && activity.conversation?.id) {
    await sendBotReply(
      activity.serviceUrl,
      activity.conversation.id,
      activity.id || "",
      response
    );
  }

  return NextResponse.json({ status: 200 }, { status: 200 });
}

// ─── Conversation Update Handler ────────────────────────────────

async function handleConversationUpdate(
  activity: BotActivity
): Promise<NextResponse> {
  // Send a welcome message when the bot is added to a conversation
  if (activity.serviceUrl && activity.conversation?.id) {
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
      activity.serviceUrl,
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

    // Look up user by Azure AD object ID (stored in auth metadata)
    // Fall back to checking the users table for a matching external ID
    const { data: user } = await service
      .from("users")
      .select("id")
      .or(`external_id.eq.${aadObjectId},azure_ad_id.eq.${aadObjectId}`)
      .single();

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

    const { data: user } = await service
      .from("users")
      .select("id, first_name")
      .or(`external_id.eq.${aadObjectId},azure_ad_id.eq.${aadObjectId}`)
      .single();

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

/**
 * Verify the Bot Framework JWT token from the Authorization header.
 *
 * In production, this should:
 * 1. Fetch the OpenID metadata from Bot Framework
 * 2. Validate the JWT signature against the JWKS
 * 3. Verify issuer, audience, and expiration claims
 *
 * This is a foundation implementation that performs basic validation.
 * Full cryptographic verification requires a JWT library (e.g., jose).
 */
async function verifyBotFrameworkToken(
  authHeader: string | null
): Promise<boolean> {
  if (!authHeader) return false;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return false;

  const token = parts[1];
  if (!token) return false;

  try {
    // Decode the JWT payload (without signature verification for now)
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return false;

    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8")
    );

    // Verify basic claims
    const now = Math.floor(Date.now() / 1000);

    // Check expiration
    if (payload.exp && payload.exp < now) {
      console.warn("Bot Framework token expired");
      return false;
    }

    // Check not-before
    if (payload.nbf && payload.nbf > now + 300) {
      console.warn("Bot Framework token not yet valid");
      return false;
    }

    // Verify issuer is Bot Framework or Azure AD
    const validIssuers = [
      "https://api.botframework.com",
      `https://sts.windows.net/${AZURE_TENANT_ID}/`,
      `https://login.microsoftonline.com/${AZURE_TENANT_ID}/v2.0`,
    ];

    if (payload.iss && !validIssuers.includes(payload.iss)) {
      console.warn("Bot Framework token has unexpected issuer:", payload.iss);
      return false;
    }

    // Verify audience matches our app ID
    const AZURE_CLIENT_ID =
      process.env.AZURE_CLIENT_ID || "8f0b9c26-2b2a-4655-8e36-32ad350ef6e4";

    if (payload.aud && payload.aud !== AZURE_CLIENT_ID) {
      console.warn("Bot Framework token has unexpected audience:", payload.aud);
      return false;
    }

    // NOTE: Full production implementation should also verify the JWT
    // signature using the JWKS from the OpenID metadata endpoint.
    // Consider using the 'jose' library for complete JWT verification:
    //
    //   import * as jose from 'jose';
    //   const JWKS = jose.createRemoteJWKSet(new URL(jwksUri));
    //   await jose.jwtVerify(token, JWKS, { issuer, audience });

    return true;
  } catch (err) {
    console.error("Bot Framework token verification error:", err);
    return false;
  }
}
