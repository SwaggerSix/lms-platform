import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { validateBody, createMarketplaceEnrollmentSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";
import { getProvider } from "@/lib/marketplace/providers";
import { jsonNoStore } from "@/lib/api/no-store";

export async function POST(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`mp-enroll-${auth.user.id}`, 10, 60000);
  if (!rl.success) return jsonNoStore({ error: "Rate limit exceeded" }, { status: 429 });

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validateBody(createMarketplaceEnrollmentSchema, body);
  if (!validation.success) {
    return jsonNoStore({ error: validation.error }, { status: 400 });
  }

  const service = createServiceClient();

  // Get course and provider info
  const { data: course } = await service
    .from("marketplace_courses")
    .select("*, provider:marketplace_providers(*)")
    .eq("id", validation.data.marketplace_course_id)
    .eq("is_active", true)
    .single();

  if (!course) {
    return jsonNoStore({ error: "Course not found" }, { status: 404 });
  }

  // Check for existing enrollment
  const { data: existing } = await service
    .from("marketplace_enrollments")
    .select("id, status")
    .eq("user_id", auth.user.id)
    .eq("marketplace_course_id", course.id)
    .single();

  if (existing) {
    return jsonNoStore({ error: "Already enrolled", enrollment: existing }, { status: 409 });
  }

  // Attempt external enrollment through provider
  let externalEnrollmentId: string | null = null;
  const provider = course.provider as any;
  if (provider && provider.is_active) {
    const impl = getProvider(provider.provider_type);
    if (impl) {
      try {
        const result = await impl.enrollUser(
          provider.api_config || {},
          course.external_id,
          auth.user.id
        );
        externalEnrollmentId = result.enrollment_id;
      } catch (err) {
        console.error("External enrollment failed:", err);
        // Continue with local enrollment even if external fails
      }
    }
  }

  const { data, error } = await service
    .from("marketplace_enrollments")
    .insert({
      user_id: auth.user.id,
      marketplace_course_id: course.id,
      status: "enrolled",
      external_enrollment_id: externalEnrollmentId,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Marketplace enrollment POST error:", error.message);
    return jsonNoStore({ error: "Internal server error" }, { status: 500 });
  }

  return jsonNoStore({
    enrollment: data,
    external_url: course.external_url,
  }, { status: 201 });
}
