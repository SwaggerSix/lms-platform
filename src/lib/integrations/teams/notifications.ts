import { createServiceClient } from "@/lib/supabase/service";

// ─── Types ──────────────────────────────────────────────────────

export interface AdaptiveCard {
  type: "AdaptiveCard";
  $schema: string;
  version: string;
  body: AdaptiveCardElement[];
  actions?: AdaptiveCardAction[];
}

interface AdaptiveCardElement {
  type: string;
  text?: string;
  size?: string;
  weight?: string;
  color?: string;
  spacing?: string;
  wrap?: boolean;
  columns?: AdaptiveCardElement[];
  width?: string;
  items?: AdaptiveCardElement[];
  separator?: boolean;
  style?: string;
  url?: string;
  altText?: string;
  height?: string;
}

interface AdaptiveCardAction {
  type: string;
  title: string;
  url?: string;
  style?: string;
}

interface TeamsWebhookPayload {
  type: "message";
  attachments: Array<{
    contentType: "application/vnd.microsoft.card.adaptive";
    contentUrl: null;
    content: AdaptiveCard;
  }>;
}

// ─── Send Notification ──────────────────────────────────────────

/**
 * Send an Adaptive Card message to a Teams channel via incoming webhook.
 */
export async function sendTeamsNotification(
  webhookUrl: string,
  card: AdaptiveCard
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: TeamsWebhookPayload = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          contentUrl: null,
          content: card,
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        success: false,
        error: `Teams webhook returned ${response.status}: ${body.slice(0, 200)}`,
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to send Teams notification",
    };
  }
}

// ─── Get Configured Webhook URL ─────────────────────────────────

/**
 * Retrieve the Teams webhook URL from platform_settings.
 */
export async function getTeamsWebhookUrl(): Promise<string | null> {
  try {
    const service = createServiceClient();
    const { data } = await service
      .from("platform_settings")
      .select("value")
      .eq("key", "teams_webhook_url")
      .single();

    if (!data?.value) return null;

    const config = data.value as { webhook_url?: string };
    return config.webhook_url || null;
  } catch {
    return null;
  }
}

/**
 * If Teams webhook is configured, send the notification.
 * Returns silently if not configured. Never throws.
 */
export async function sendTeamsNotificationIfConfigured(
  card: AdaptiveCard
): Promise<void> {
  try {
    const webhookUrl = await getTeamsWebhookUrl();
    if (!webhookUrl) return;

    const result = await sendTeamsNotification(webhookUrl, card);
    if (!result.success) {
      console.warn("Teams notification failed:", result.error);
    }
  } catch (err) {
    console.error("Teams notification error:", err);
  }
}

// ─── Card Templates ─────────────────────────────────────────────

function makeCard(
  title: string,
  accentColor: string,
  facts: Array<{ label: string; value: string }>,
  actionUrl?: string,
  actionTitle?: string
): AdaptiveCard {
  const body: AdaptiveCardElement[] = [
    {
      type: "ColumnSet",
      columns: [
        {
          type: "Column",
          width: "auto",
          items: [
            {
              type: "TextBlock",
              text: "🎓",
              size: "Large",
            },
          ],
        },
        {
          type: "Column",
          width: "stretch",
          items: [
            {
              type: "TextBlock",
              text: title,
              size: "Medium",
              weight: "Bolder",
              wrap: true,
            },
            {
              type: "TextBlock",
              text: new Date().toLocaleString("en-US", {
                dateStyle: "medium",
                timeStyle: "short",
              }),
              size: "Small",
              color: "Accent",
              spacing: "None",
            },
          ],
        },
      ],
    },
    { type: "TextBlock", text: " ", spacing: "Small", separator: true },
  ];

  // Add fact set
  for (const fact of facts) {
    body.push({
      type: "ColumnSet",
      columns: [
        {
          type: "Column",
          width: "120px",
          items: [
            {
              type: "TextBlock",
              text: fact.label,
              size: "Small",
              weight: "Bolder",
              color: "Accent",
              wrap: true,
            },
          ],
        },
        {
          type: "Column",
          width: "stretch",
          items: [
            {
              type: "TextBlock",
              text: fact.value,
              size: "Small",
              wrap: true,
            },
          ],
        },
      ],
    });
  }

  const actions: AdaptiveCardAction[] = [];
  if (actionUrl && actionTitle) {
    actions.push({
      type: "Action.OpenUrl",
      title: actionTitle,
      url: actionUrl,
      style: "positive",
    });
  }

  return {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.4",
    body,
    actions: actions.length > 0 ? actions : undefined,
  };
}

// ── Course Enrollment ───────────────────────────────────────────

export function courseEnrollmentCard(data: {
  userName: string;
  courseName: string;
  enrolledAt: string;
  courseUrl?: string;
}): AdaptiveCard {
  return makeCard(
    "New Course Enrollment",
    "Good",
    [
      { label: "Learner", value: data.userName },
      { label: "Course", value: data.courseName },
      { label: "Enrolled", value: data.enrolledAt },
    ],
    data.courseUrl,
    "View Course"
  );
}

// ── Course Completion ───────────────────────────────────────────

export function courseCompletionCard(data: {
  userName: string;
  courseName: string;
  completedAt: string;
  score?: number;
  courseUrl?: string;
}): AdaptiveCard {
  const facts = [
    { label: "Learner", value: data.userName },
    { label: "Course", value: data.courseName },
    { label: "Completed", value: data.completedAt },
  ];
  if (data.score !== undefined) {
    facts.push({ label: "Score", value: `${data.score}%` });
  }

  return makeCard(
    "Course Completed",
    "Good",
    facts,
    data.courseUrl,
    "View Course"
  );
}

// ── Certificate Earned ──────────────────────────────────────────

export function certificateEarnedCard(data: {
  userName: string;
  certificateName: string;
  issuedAt: string;
  expiresAt?: string;
  certificateUrl?: string;
}): AdaptiveCard {
  const facts = [
    { label: "Learner", value: data.userName },
    { label: "Certificate", value: data.certificateName },
    { label: "Issued", value: data.issuedAt },
  ];
  if (data.expiresAt) {
    facts.push({ label: "Expires", value: data.expiresAt });
  }

  return makeCard(
    "Certificate Earned",
    "Good",
    facts,
    data.certificateUrl,
    "View Certificate"
  );
}

// ── New User Registered ─────────────────────────────────────────

export function newUserRegisteredCard(data: {
  userName: string;
  email: string;
  registeredAt: string;
  role?: string;
  profileUrl?: string;
}): AdaptiveCard {
  const facts = [
    { label: "Name", value: data.userName },
    { label: "Email", value: data.email },
    { label: "Registered", value: data.registeredAt },
  ];
  if (data.role) {
    facts.push({ label: "Role", value: data.role });
  }

  return makeCard(
    "New User Registered",
    "Attention",
    facts,
    data.profileUrl,
    "View Profile"
  );
}

// ── Test Message ────────────────────────────────────────────────

export function testNotificationCard(): AdaptiveCard {
  return makeCard(
    "LMS Test Notification",
    "Accent",
    [
      { label: "Status", value: "Connection successful" },
      { label: "Source", value: "LearnHub LMS Platform" },
      {
        label: "Time",
        value: new Date().toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }),
      },
    ]
  );
}
