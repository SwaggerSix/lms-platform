import { createServiceClient } from "@/lib/supabase/service";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { jsonNoStore } from "@/lib/api/no-store";

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP: 5 registrations per minute
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { success } = await rateLimit(`register:${ip}`, 5, 60000);
    if (!success) {
      return jsonNoStore({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json();
    const { auth_id, email, first_name, last_name } = body;

    if (!auth_id || !email || !first_name || !last_name) {
      return jsonNoStore({ error: "Missing required fields" }, { status: 400 });
    }

    // Validate auth_id matches a real Supabase auth user
    const service = createServiceClient();
    const { data: authUser, error: authError } = await service.auth.admin.getUserById(auth_id);
    if (authError || !authUser?.user) {
      return jsonNoStore({ error: "Invalid auth user" }, { status: 403 });
    }

    // Verify the email matches the auth user
    if (authUser.user.email !== email) {
      return jsonNoStore({ error: "Email mismatch" }, { status: 403 });
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
        },
        { onConflict: "auth_id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Registration profile error:", error.message);
      return jsonNoStore({ error: "Failed to create profile" }, { status: 500 });
    }

    return jsonNoStore(data);
  } catch {
    return jsonNoStore({ error: "Invalid request" }, { status: 400 });
  }
}
