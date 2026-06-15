import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/evaluations/reports
 * Aggregated evaluation insights across many evaluations, filterable by
 * course, domain (category), instructor (cohort), client (tenant), level, and
 * time period. Returns headline metrics, per-dimension breakdowns, and text
 * testimonials for marketing storytelling.
 *
 * Query params (all optional): course_id, category_id, instructor_id,
 * tenant_id, level, date_from, date_to.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "super_admin", "instructor", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get("course_id");
  const categoryId = searchParams.get("category_id");
  const instructorId = searchParams.get("instructor_id");
  const tenantId = searchParams.get("tenant_id");
  const level = searchParams.get("level");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  const service = createServiceClient();

  let query = service
    .from("evaluation_report_rows")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(5000);

  if (courseId) query = query.eq("course_id", courseId);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (instructorId) query = query.eq("instructor_id", instructorId);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  if (level) query = query.eq("level", Number(level));
  if (dateFrom) query = query.gte("submitted_at", dateFrom);
  if (dateTo) query = query.lte("submitted_at", dateTo);

  const { data: rows, error } = await query;
  if (error) {
    console.error("Evaluation reports error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Map each template's question id -> type/text so we know how to aggregate.
  const templateIds = [...new Set((rows ?? []).map((r) => r.template_id).filter(Boolean))];
  const { data: templates } = templateIds.length
    ? await service.from("evaluation_templates").select("id, questions").in("id", templateIds)
    : { data: [] as { id: string; questions: { id: string; text: string; type: string }[] }[] };

  const qType = new Map<string, { type: string; text: string }>(); // `${templateId}:${qid}` -> meta
  for (const t of templates ?? []) {
    for (const q of (t.questions as any[]) ?? []) {
      qType.set(`${t.id}:${q.id}`, { type: q.type, text: q.text });
    }
  }

  // Accumulators
  const respondents = new Set<string>();
  const ratingValues: number[] = [];
  const npsValues: number[] = [];
  const testimonials: { text: string; course: string | null; instructor: string | null; client: string | null; date: string | null }[] = [];

  type Group = { label: string; responses: number; ratingSum: number; ratingCount: number };
  const byCourse = new Map<string, Group>();
  const byInstructor = new Map<string, Group>();
  const byDomain = new Map<string, Group>();
  const byClient = new Map<string, Group>();

  const bump = (m: Map<string, Group>, key: string | null, label: string | null, rating: number | null) => {
    const k = key ?? "__none__";
    const g = m.get(k) ?? { label: label ?? "—", responses: 0, ratingSum: 0, ratingCount: 0 };
    g.responses += 1;
    if (rating != null) { g.ratingSum += rating; g.ratingCount += 1; }
    m.set(k, g);
  };

  for (const r of rows ?? []) {
    if (r.user_id) respondents.add(r.user_id);

    // Normalize answers: native = {qid: value}; SurveyCraft webhook = {answers: {...}}.
    const raw = r.answers as any;
    const ans: Record<string, unknown> =
      raw && typeof raw.answers === "object" && !Array.isArray(raw.answers) ? raw.answers : (raw ?? {});

    // Per-response mean rating (for dimension breakdowns).
    let respRatingSum = 0;
    let respRatingCount = 0;

    for (const [qid, value] of Object.entries(ans)) {
      const meta = qType.get(`${r.template_id}:${qid}`);
      const type = meta?.type;
      if (type === "rating" && typeof value === "number") {
        ratingValues.push(value);
        respRatingSum += value;
        respRatingCount += 1;
      } else if (type === "nps" && typeof value === "number") {
        npsValues.push(value);
      } else if ((type === "text" || (!type && typeof value === "string")) && typeof value === "string" && value.trim().length > 8) {
        if (testimonials.length < 100) {
          testimonials.push({
            text: value.trim(),
            course: r.course_title ?? null,
            instructor: r.instructor_name ?? null,
            client: r.client_name ?? null,
            date: r.submitted_at ?? null,
          });
        }
      }
    }

    const respRating = respRatingCount > 0 ? respRatingSum / respRatingCount : null;
    bump(byCourse, r.course_id, r.course_title, respRating);
    bump(byInstructor, r.instructor_id, r.instructor_name, respRating);
    bump(byDomain, r.category_id, r.category_name, respRating);
    bump(byClient, r.tenant_id, r.client_name, respRating);
  }

  const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null);
  const round1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

  // NPS = %promoters (9-10) - %detractors (0-6)
  let nps: number | null = null;
  if (npsValues.length) {
    const promoters = npsValues.filter((v) => v >= 9).length;
    const detractors = npsValues.filter((v) => v <= 6).length;
    nps = Math.round(((promoters - detractors) / npsValues.length) * 100);
  }

  const serializeGroups = (m: Map<string, Group>) =>
    [...m.values()]
      .map((g) => ({
        label: g.label,
        responses: g.responses,
        avg_rating: round1(g.ratingCount ? g.ratingSum / g.ratingCount : null),
      }))
      .sort((a, b) => b.responses - a.responses);

  return NextResponse.json({
    totals: {
      responses: rows?.length ?? 0,
      respondents: respondents.size,
      courses: byCourse.size,
      avg_rating: round1(avg(ratingValues)),
      rating_count: ratingValues.length,
      nps,
      nps_count: npsValues.length,
    },
    breakdowns: {
      instructor: serializeGroups(byInstructor),
      course: serializeGroups(byCourse),
      domain: serializeGroups(byDomain),
      client: serializeGroups(byClient),
    },
    testimonials,
  });
}
