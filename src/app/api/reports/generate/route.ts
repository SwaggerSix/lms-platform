import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import {
  VALID_REPORT_TYPES,
  type ReportType,
  type ReportFilters,
  generateReport,
  rowsToCsv,
} from "@/lib/reports/generate";
import {
  runReportDefinition,
  validateDefinitionSpec,
  type DefinitionSpec,
} from "@/lib/reports/custom";
import { createServiceClient } from "@/lib/supabase/service";
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
      definition_id,
      custom,
      date_from,
      date_to,
      department,
      format = "json",
    } = body;

    if (format !== "json" && format !== "csv" && format !== "pdf") {
      return NextResponse.json(
        { error: 'Invalid format. Must be "json", "csv", or "pdf".' },
        { status: 400 }
      );
    }

    // Custom report paths: a saved definition by id, or an inline spec
    // (used by the builder's Preview before saving).
    let rows: Record<string, unknown>[];
    let reportName: string;
    if (definition_id || custom) {
      let spec: DefinitionSpec;
      if (definition_id) {
        const service = createServiceClient();
        const { data: definition } = await service
          .from("report_definitions")
          .select("*")
          .eq("id", definition_id)
          .maybeSingle();
        if (
          !definition ||
          (definition.organization_id &&
            auth.user.organization_id &&
            definition.organization_id !== auth.user.organization_id)
        ) {
          return NextResponse.json(
            { error: "Report definition not found" },
            { status: 404 }
          );
        }
        spec = definition as unknown as DefinitionSpec;
        reportName = definition.name;
      } else {
        spec = custom as DefinitionSpec;
        reportName = "Custom Report";
      }
      const specError = validateDefinitionSpec(spec);
      if (specError) {
        return NextResponse.json({ error: specError }, { status: 400 });
      }
      rows = await runReportDefinition(spec);
      return respond(rows, "custom", reportName, format, {
        date_from,
        date_to,
        department,
      });
    }

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

    const filters: ReportFilters = { date_from, date_to, department };
    rows = await generateReport(report_type as ReportType, filters);

    const titleMap: Record<string, string> = {
      completion: "Completion Report",
      compliance: "Compliance Report",
      compliance_detail: "Per-Learner Compliance & Expiry Report",
      skills_gap: "Skills Gap Report",
      engagement: "Engagement Report",
      learner_progress: "Learner Progress Report",
      course_effectiveness: "Course Effectiveness Report",
      at_risk: "At-Risk Learners Report",
      training_matrix: "Training Matrix Report",
    };
    return respond(rows, report_type, titleMap[report_type] || "Report", format, {
      date_from,
      date_to,
      department,
    });
  } catch (error: any) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 }
    );
  }
}

async function respond(
  rows: Record<string, unknown>[],
  reportType: string,
  title: string,
  format: string,
  filters: { date_from?: string; date_to?: string; department?: string }
) {
  const { date_from, date_to, department } = filters;
  const fileStem = `${title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}`;

  if (format === "csv") {
    const csv = rowsToCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileStem}.csv"`,
      },
    });
  }

  if (format === "pdf") {
    const pdfBuffer = await generateReportPDF({
      title,
      reportType,
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
        "Content-Disposition": `attachment; filename="${fileStem}.pdf"`,
      },
    });
  }

  return NextResponse.json({
    report_type: reportType,
    generated_at: new Date().toISOString(),
    filters: {
      date_from: date_from ?? null,
      date_to: date_to ?? null,
      department: department ?? null,
    },
    total_rows: rows.length,
    rows,
  });
}
