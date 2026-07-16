import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isValidTimezone } from "@/lib/timezones";

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

    // Registration policy (S6): a corporate B2B training platform usually
    // should not allow unrestricted self-provisioning. Configurable via env,
    // defaulting to "open" so existing behaviour is unchanged:
    //   REGISTRATION_MODE = open | domain | closed
    //   REGISTRATION_ALLOWED_DOMAINS = comma-separated list (mode=domain)
    const registrationMode = (process.env.REGISTRATION_MODE || "open").toLowerCase();
    if (registrationMode === "closed") {
      return NextResponse.json(
        { error: "Self-registration is disabled. Please contact your administrator for an invitation." },
        { status: 403 }
      );
    }
    if (registrationMode === "domain") {
      const allowedDomains = (process.env.REGISTRATION_ALLOWED_DOMAINS || "")
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
      const emailDomain = email.split("@")[1]?.toLowerCase() || "";
      if (!allowedDomains.includes(emailDomain)) {
        return NextResponse.json(
          { error: "Registration is restricted to approved email domains." },
          { status: 403 }
        );
      }
    }

    const { data, error } = await service
      .from("users")
      .upsert(
        {
          auth_id,
          email,
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          role: "learner",
          status: "active",
          timezone: safeTimezone,
        },
        { onConflict: "auth_id" }
      )
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
