import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Ensure a users table record exists for this auth user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const service = createServiceClient();
        const { data: existingUser } = await service
          .from("users")
          .select("id")
          .eq("auth_id", user.id)
          .single();

        if (!existingUser) {
          const meta = user.user_metadata ?? {};
          const emailValue = user.email ?? "";
          const firstName =
            meta.first_name || emailValue.split("@")[0] || "";
          const lastName = meta.last_name || "";

          await service.from("users").upsert(
            {
              auth_id: user.id,
              email: emailValue,
              first_name: firstName,
              last_name: lastName,
              role: "learner",
              status: "active",
            },
            { onConflict: "auth_id" }
          );
        }
      }

      // Redirect to reset-password page for password recovery flows
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
