import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/sender";

// Vercel Cron: runs every hour
export const dynamic = "force-dynamic";

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

  const supabase = await createClient();

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
      // Generate report data based on report type
      const reportData = await generateReport(supabase, report);

      // Send to recipients
      const recipients = report.recipients || [];
      if (recipients.length > 0) {
        await sendEmail({
          to: recipients,
          subject: `Scheduled Report: ${report.name}`,
          html: formatReportEmail(report.name, reportData),
        });
      }

      // Calculate next run time
      const nextRun = calculateNextRun(report.frequency, report.timezone);

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

async function generateReport(supabase: any, report: any) {
  const { report_type } = report;

  switch (report_type) {
    case "enrollment":
    case "Enrollment Summary": {
      const { data } = await service
        .from("enrollments")
        .select("status", { count: "exact" });
      const total = data?.length || 0;
      const completed =
        data?.filter((e: any) => e.status === "completed").length || 0;
      const inProgress =
        data?.filter((e: any) => e.status === "in_progress").length || 0;
      return {
        total,
        completed,
        inProgress,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
      };
    }
    case "completion":
    case "Course Completion": {
      const { data } = await service
        .from("enrollments")
        .select("*, course:courses(title)")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(50);
      return { completions: data || [] };
    }
    case "compliance":
    case "Compliance Status": {
      const { data } = await service
        .from("compliance_requirements")
        .select("*");
      return { requirements: data || [] };
    }
    default: {
      const { count } = await service
        .from("enrollments")
        .select("*", { count: "exact", head: true });
      return { totalEnrollments: count || 0 };
    }
  }
}

function formatReportEmail(name: string, data: any): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">${name}</h2>
      <p style="color: #666;">Generated on ${new Date().toLocaleDateString()}</p>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
        <pre style="white-space: pre-wrap; font-size: 14px;">${JSON.stringify(data, null, 2)}</pre>
      </div>
      <p style="color: #999; font-size: 12px; margin-top: 20px;">
        This is an automated report from your LMS Platform.
      </p>
    </div>
  `;
}

function calculateNextRun(frequency: string, timezone?: string): string {
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
