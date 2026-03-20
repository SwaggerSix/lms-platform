import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/sender";
import { createServiceClient } from "@/lib/supabase/service";
import { generateReport, type ReportType } from "@/lib/reports/generate";

// Vercel Cron: runs every hour
export const dynamic = "force-dynamic";

/** Map legacy/display names stored in scheduled_reports to canonical report types */
const REPORT_TYPE_MAP: Record<string, ReportType> = {
  // Canonical types (pass through)
  completion: "completion",
  compliance: "compliance",
  skills_gap: "skills_gap",
  engagement: "engagement",
  learner_progress: "learner_progress",
  course_effectiveness: "course_effectiveness",
  // Legacy / display names
  "Enrollment Summary": "completion",
  "Course Completion": "completion",
  "Compliance Status": "compliance",
  enrollment: "completion",
};

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Find reports due to run
  const now = new Date().toISOString();
  const { data: dueReports } = await service
    .from("scheduled_reports")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", now);

  if (!dueReports || dueReports.length === 0) {
    return NextResponse.json({ message: "No reports due", count: 0 });
  }

  let processed = 0;
  for (const report of dueReports) {
    try {
      // Resolve report type
      const reportType = REPORT_TYPE_MAP[report.report_type] ?? null;
      if (!reportType) {
        console.error(`Unknown report_type "${report.report_type}" for scheduled report ${report.id}`);
        continue;
      }

      // Generate report using the shared logic
      const rows = await generateReport(reportType, {
        date_from: report.filters?.date_from,
        date_to: report.filters?.date_to,
        department: report.filters?.department,
      });

      // Send to recipients
      const recipients = report.recipients || [];
      if (recipients.length > 0) {
        await sendEmail({
          to: recipients,
          subject: `Scheduled Report: ${report.name}`,
          html: formatReportEmail(report.name, reportType, rows),
        });
      }

      // Calculate next run time
      const nextRun = calculateNextRun(report.frequency);

      // Update last_run and next_run
      await service
        .from("scheduled_reports")
        .update({ last_run_at: now, next_run_at: nextRun })
        .eq("id", report.id);

      processed++;
    } catch (err) {
      console.error(`Failed to process report ${report.id}:`, err);
    }
  }

  return NextResponse.json({ message: "Reports processed", count: processed });
}

function esc(val: unknown): string {
  return String(val ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatReportEmail(
  name: string,
  reportType: string,
  rows: Record<string, unknown>[]
): string {
  const summaryLines =
    rows.length > 0
      ? `<p><strong>${rows.length}</strong> row(s) generated.</p>`
      : `<p>No data for this reporting period.</p>`;

  // Show first 10 rows as a preview table
  let previewTable = "";
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    const previewRows = rows.slice(0, 10);
    previewTable = `
      <table style="border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 12px;">
        <thead>
          <tr>${headers.map((h) => `<th style="border: 1px solid #ddd; padding: 6px 8px; background: #f0f0f0; text-align: left;">${esc(h)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${previewRows
            .map(
              (row) =>
                `<tr>${headers.map((h) => `<td style="border: 1px solid #ddd; padding: 6px 8px;">${esc(row[h])}</td>`).join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>
      ${rows.length > 10 ? `<p style="color: #999; font-size: 12px;">Showing 10 of ${rows.length} rows. See attached CSV for full data.</p>` : ""}
    `;
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">${esc(name)}</h2>
      <p style="color: #666;">Report type: <strong>${esc(reportType)}</strong> &middot; Generated on ${new Date().toLocaleDateString()}</p>
      ${summaryLines}
      ${previewTable}
      <p style="color: #999; font-size: 12px; margin-top: 20px;">
        This is an automated report from your LMS Platform.
      </p>
    </div>
  `;
}

function calculateNextRun(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case "daily":
      now.setDate(now.getDate() + 1);
      break;
    case "weekly":
      now.setDate(now.getDate() + 7);
      break;
    case "monthly":
      now.setMonth(now.getMonth() + 1);
      break;
    case "quarterly":
      now.setMonth(now.getMonth() + 3);
      break;
    default:
      now.setDate(now.getDate() + 1);
  }
  return now.toISOString();
}
