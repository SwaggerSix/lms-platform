import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * GET /api/ratings/report — aggregated five-star ratings for staff.
 * Filters: instructor_id, course_id, class_id, tenant_id, date_from, date_to.
 * Returns headline averages, per-dimension breakdowns, and a monthly trend.
 */
export async function GET(request: NextRequest) {
  const auth = await authorize("admin", "super_admin", "instructor", "manager");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const instructorId = searchParams.get("instructor_id");
  const courseId = searchParams.get("course_id");
  const classId = searchParams.get("class_id");
  const tenantId = searchParams.get("tenant_id");
  const dateFrom = searchParams.get("date_from");
  const dateTo = searchParams.get("date_to");

  const service = createServiceClient();
  let query = service
    .from("course_ratings")
    .select(
      "course_rating, instructor_rating, created_at, course_id, class_id, instructor_id, tenant_id, " +
        "course:courses(title), instructor:users!course_ratings_instructor_id_fkey(first_name, last_name), " +
        "class:classes(title), tenant:tenants(name)"
    )
    .order("created_at", { ascending: false })
    .limit(10000);

  if (instructorId) query = query.eq("instructor_id", instructorId);
  if (courseId) query = query.eq("course_id", courseId);
  if (classId) query = query.eq("class_id", classId);
  if (tenantId) query = query.eq("tenant_id", tenantId);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  const { data, error } = await query;
  if (error) {
    console.error("Ratings report error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const rows = (data ?? []) as any[];
  const firstName = (j: any) => (Array.isArray(j) ? j[0] : j);

  type G = { label: string; courseSum: number; courseN: number; instrSum: number; instrN: number; count: number };
  const groups = { instructor: new Map<string, G>(), course: new Map<string, G>(), class: new Map<string, G>(), client: new Map<string, G>() };
  const trend = new Map<string, G>(); // YYYY-MM

  const bump = (m: Map<string, G>, key: string | null, label: string | null, cr: number | null, ir: number | null) => {
    const k = key ?? "__none__";
    const g = m.get(k) ?? { label: label ?? "—", courseSum: 0, courseN: 0, instrSum: 0, instrN: 0, count: 0 };
    g.count += 1;
    if (cr != null) { g.courseSum += cr; g.courseN += 1; }
    if (ir != null) { g.instrSum += ir; g.instrN += 1; }
    m.set(k, g);
  };

  let courseSum = 0, courseN = 0, instrSum = 0, instrN = 0;
  for (const r of rows) {
    const cr = r.course_rating as number | null;
    const ir = r.instructor_rating as number | null;
    if (cr != null) { courseSum += cr; courseN += 1; }
    if (ir != null) { instrSum += ir; instrN += 1; }

    const instr = firstName(r.instructor);
    const instrName = instr ? `${instr.first_name} ${instr.last_name}` : null;
    bump(groups.instructor, r.instructor_id, instrName, cr, ir);
    bump(groups.course, r.course_id, firstName(r.course)?.title ?? null, cr, ir);
    bump(groups.class, r.class_id, firstName(r.class)?.title ?? null, cr, ir);
    bump(groups.client, r.tenant_id, firstName(r.tenant)?.name ?? null, cr, ir);
    if (r.created_at) bump(trend, String(r.created_at).slice(0, 7), String(r.created_at).slice(0, 7), cr, ir);
  }

  const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
  const ser = (m: Map<string, G>, sortByDate = false) =>
    [...m.values()]
      .map((g) => ({
        label: g.label,
        count: g.count,
        course_avg: r1(g.courseN ? g.courseSum / g.courseN : null),
        instructor_avg: r1(g.instrN ? g.instrSum / g.instrN : null),
      }))
      .sort((a, b) => (sortByDate ? a.label.localeCompare(b.label) : b.count - a.count));

  return NextResponse.json({
    totals: {
      ratings: rows.length,
      course_avg: r1(courseN ? courseSum / courseN : null),
      course_count: courseN,
      instructor_avg: r1(instrN ? instrSum / instrN : null),
      instructor_count: instrN,
    },
    breakdowns: {
      instructor: ser(groups.instructor),
      course: ser(groups.course),
      class: ser(groups.class),
      client: ser(groups.client),
    },
    trend: ser(trend, true),
  });
}
