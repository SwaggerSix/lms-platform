import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { rateLimit } from "@/lib/rate-limit";
import {
  enrollmentConfirmation,
  approvalRequest,
  approvalDecision,
  courseCompletion,
  certificationExpiry,
  dueDateReminder,
  iltSessionReminder,
  scheduledReportDelivery,
  type EmailTemplate,
} from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/sender";

type TemplateType =
  | "enrollment_confirmation"
  | "approval_request"
  | "approval_decision"
  | "course_completion"
  | "certification_expiry"
  | "due_date_reminder"
  | "ilt_session_reminder"
  | "scheduled_report";

function getTemplate(type: TemplateType, params: Record<string, unknown>): EmailTemplate {
  switch (type) {
    case "enrollment_confirmation":
      return enrollmentConfirmation(params as Parameters<typeof enrollmentConfirmation>[0]);
    case "approval_request":
      return approvalRequest(params as Parameters<typeof approvalRequest>[0]);
    case "approval_decision":
      return approvalDecision(params as Parameters<typeof approvalDecision>[0]);
    case "course_completion":
      return courseCompletion(params as Parameters<typeof courseCompletion>[0]);
    case "certification_expiry":
      return certificationExpiry(params as Parameters<typeof certificationExpiry>[0]);
    case "due_date_reminder":
      return dueDateReminder(params as Parameters<typeof dueDateReminder>[0]);
    case "ilt_session_reminder":
      return iltSessionReminder(params as Parameters<typeof iltSessionReminder>[0]);
    case "scheduled_report":
      return scheduledReportDelivery(params as Parameters<typeof scheduledReportDelivery>[0]);
    default:
      throw new Error(`Unknown template type: ${type}`);
  }
}

/**
 * POST /api/email — Send a transactional email
 * Body: { template: TemplateType, to: string | string[], params: Record<string, unknown> }
 *
 * GET /api/email?template=enrollment_confirmation&preview=true — Preview template HTML
 */
export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { template: templateType, to, params } = body;

    // Rate limit: 5 emails per minute per recipient
    const rateLimitKey = `email:${Array.isArray(to) ? to.join(",") : to}`;
    const { success } = rateLimit(rateLimitKey, 5, 60000);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    if (!templateType || !to || !params) {
      return NextResponse.json(
        { error: "Missing required fields: template, to, params" },
        { status: 400 }
      );
    }

    const emailTemplate = getTemplate(templateType, params);

    const result = await sendEmail({
      to,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "error" in result ? result.error : "Unknown error" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.id,
      subject: emailTemplate.subject,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const templateType = searchParams.get("template") as TemplateType | null;
  const preview = searchParams.get("preview");

  if (!templateType || !preview) {
    return NextResponse.json({
      templates: [
        "enrollment_confirmation",
        "approval_request",
        "approval_decision",
        "course_completion",
        "certification_expiry",
        "due_date_reminder",
        "ilt_session_reminder",
        "scheduled_report",
      ],
    });
  }

  // Generate preview with sample data
  const sampleParams: Record<TemplateType, Record<string, unknown>> = {
    enrollment_confirmation: {
      learnerName: "Jane Smith",
      courseName: "Leadership Development Program",
      courseUrl: "https://learnhub.gov/learn/courses/ldp-101",
      startDate: "March 25, 2026",
    },
    approval_request: {
      managerName: "John Doe",
      learnerName: "Jane Smith",
      courseName: "Advanced Project Management",
      reason: "Required for upcoming program lead role",
      approvalUrl: "https://learnhub.gov/manager/approvals",
    },
    approval_decision: {
      learnerName: "Jane Smith",
      courseName: "Advanced Project Management",
      decision: "approved",
      managerName: "John Doe",
      courseUrl: "https://learnhub.gov/learn/courses/apm-201",
    },
    course_completion: {
      learnerName: "Jane Smith",
      courseName: "Cybersecurity Awareness Training",
      score: 95,
      certificateUrl: "https://learnhub.gov/learn/certifications/cyber-2026",
      dashboardUrl: "https://learnhub.gov/dashboard",
    },
    certification_expiry: {
      learnerName: "Jane Smith",
      certName: "Federal Acquisition Certification",
      expiryDate: "April 15, 2026",
      daysRemaining: 30,
      renewalUrl: "https://learnhub.gov/learn/certifications/fac",
    },
    due_date_reminder: {
      learnerName: "Jane Smith",
      courseName: "Ethics & Compliance 2026",
      dueDate: "March 31, 2026",
      daysRemaining: 15,
      courseUrl: "https://learnhub.gov/learn/courses/ethics-2026",
    },
    ilt_session_reminder: {
      learnerName: "Jane Smith",
      sessionTitle: "Leadership Workshop",
      date: "March 20, 2026",
      time: "9:00 AM - 12:00 PM ET",
      location: "Virtual (Microsoft Teams)",
      isVirtual: true,
      meetingUrl: "https://teams.microsoft.com/meet/abc123",
    },
    scheduled_report: {
      recipientName: "Admin User",
      reportName: "Weekly Completion Summary",
      period: "March 9-15, 2026",
      downloadUrl: "https://learnhub.gov/admin/reports/download/weekly-2026-11",
    },
  };

  try {
    const template = getTemplate(templateType, sampleParams[templateType]);

    if (preview === "html") {
      return new NextResponse(template.html, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return NextResponse.json({
      template: templateType,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown template" },
      { status: 400 }
    );
  }
}
