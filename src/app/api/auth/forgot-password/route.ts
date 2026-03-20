import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Rate limit: 3 per minute per IP
  const ipLimit = await rateLimit(`forgot-pw-ip:${ip}`, 3, 60000);
  if (!ipLimit.success) {
    // Always return success to avoid revealing rate-limit info
    return NextResponse.json({
      message: "If an account with that email exists, we've sent a password reset link.",
    });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { email } = body;

  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }

  // Rate limit: 3 per hour per email
  const emailLimit = await rateLimit(`forgot-pw-email:${email.toLowerCase()}`, 3, 3600000);
  if (!emailLimit.success) {
    // Always return success to avoid revealing rate-limit info
    return NextResponse.json({
      message: "If an account with that email exists, we've sent a password reset link.",
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://learn.gothamgovernment.com";

  // Call Supabase to send reset email — ignore errors to not reveal if email exists
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  // Always return success
  return NextResponse.json({
    message: "If an account with that email exists, we've sent a password reset link.",
  });
}
