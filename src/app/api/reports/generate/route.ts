import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import {
  VALID_REPORT_TYPES,
  type ReportType,
  type ReportFilters,
  generateReport,
  rowsToCsv,
} from "@/lib/reports/generate";
import { generateReportPDF } from "@/lib/pdf/generate";

export async function POST(request: NextRequest) {
  try {
    const auth = await authorize("admin", "manager");
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      report_type,
      date_from,
      date_to,
      department,
      format = "json",
    } = body;

    if (
      !report_type ||
      !VALID_REPORT_TYPES.includes(report_type as ReportType)
    ) {
      return NextResponse.json(
        {
          error: `Invalid report_type. Must be one of: ${VALID_REPORT_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (format !== "json" && format !== "csv" && format !== "pdf") {
      return NextResponse.json(
        { error: 'Invalid format. Must be "json", "csv", or "pdf".' },
        { status: 400 }
      );
    }

    const filters: ReportFilters = { date_from, date_to, department };
    const rows = await generateReport(report_type as ReportType, filters);

    if (format === "csv") {
      const csv = rowsToCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${report_type}_report_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    if (format === "pdf") {
      const titleMap: Record<string, string> = {
        completion: "Completion Report",
        compliance: "Compliance Report",
        skills_gap: "Skills Gap Report",
        engagement: "Engagement Report",
        learner_progress: "Learner Progress Report",
        course_effectiveness: "Course Effectiveness Report",
      };

      const pdfBuffer = await generateReportPDF({
        title: titleMap[report_type] || "Report",
        reportType: report_type,
        generatedDate: new Date().toISOString().split("T")[0],
        rows,
        filters: {
          ...(date_from ? { date_from } : {}),
          ...(date_to ? { date_to } : {}),
          ...(department ? { department } : {}),
        },
      });

      return new NextResponse(pdfBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${report_type}_report_${new Date().toISOString().split("T")[0]}.pdf"`,
        },
      });
    }

    return NextResponse.json({
      report_type,
      generated_at: new Date().toISOString(),
      filters: {
        date_from: date_from ?? null,
        date_to: date_to ?? null,
        department: department ?? null,
      },
      total_rows: rows.length,
      rows,
    });
  } catch (error: any) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}
