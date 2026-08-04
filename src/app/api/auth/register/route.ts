import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidTimezone } from "@/lib/timezones";
import { resolveRegistrationPolicy, evaluateRegistration } from "@/lib/auth/registration-policy";

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP: 5 registrations per minute
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { success } = await rateLimit(`register:${ip}`, 5, 60000);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const { auth_id, email, first_name, last_name, timezone } = body;
    const safeTimezone =
      typeof timezone === "string" && isValidTimezone(timezone) ? timezone : null;

    if (!auth_id || !email || !first_name || !last_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate auth_id matches a real Supabase auth user
    const service = createServiceClient();
    const { data: authUser, error: authError } = await service.auth.admin.getUserById(auth_id);
    if (authError || !authUser?.user) {
      return NextResponse.json({ error: "Invalid auth user" }, { status: 403 });
    }

    // Verify the email matches the auth user
    if (authUser.user.email !== email) {
      return NextResponse.json({ error: "Email mismatch" }, { status: 403 });
    }

    // Registration policy (S6): admin-configurable (platform_settings), with an
    // env fallback and a secure default of invite-only. See resolveRegistrationPolicy.
    const policy = await resolveRegistrationPolicy(service);
    const decision = evaluateRegistration(policy, email);
    if (!decision.allowed) {
      return NextResponse.json({ error: decision.reason }, { status: 403 });
    }

    // If a profile already exists for this auth user, return it unchanged.
    // This endpoint is public and trusts the body's auth_id, so an upsert here
    // would let a re-POST overwrite an existing row — silently downgrading an
    // elevated user back to role "learner"/status "active" (undoing a role
    // grant or a deactivation). Registration only ever *creates* the initial
    // profile; it must never mutate an existing one.
    const { data: existing } = await service
      .from("users")
      .select("*")
      .eq("auth_id", auth_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(existing);
    }

    const { data, error } = await service
      .from("users")
      .insert({
        auth_id,
        email,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        role: "learner",
        status: "active",
        timezone: safeTimezone,
      })
      .select()
      .single();

    if (error) {
      console.error("Registration profile error:", error.message);
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
