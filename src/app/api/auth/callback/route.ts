import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { processRulesForUser } from "@/lib/automation/rules-engine";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  // Prevent open redirect: only allow relative paths starting with /
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

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
          // Check if this is an SSO user by looking at their identity provider
          const identities = user.identities ?? [];
          const ssoIdentity = identities.find(
            (i) => i.provider === "sso" || i.provider?.startsWith("sso:")
          );

          let role = "learner";
          let firstName = "";
          let lastName = "";
          let organizationId: string | null = null;

          if (ssoIdentity) {
            // This is an SSO login — look up the provider config for auto-provisioning
            const emailDomain = (user.email ?? "").split("@")[1]?.toLowerCase();

            if (emailDomain) {
              const { data: ssoProvider } = await service
                .from("sso_providers")
                .select("default_role, attribute_mapping, auto_provision_users")
                .eq("domain", emailDomain)
                .eq("is_active", true)
                .maybeSingle();

              if (ssoProvider?.auto_provision_users) {
                role = ssoProvider.default_role || "learner";

                // Map SAML attributes using the configured attribute mapping
                const mapping = (ssoProvider.attribute_mapping ?? {}) as Record<string, string>;
                const meta = user.user_metadata ?? {};

                // Try mapped attribute names first, then fall back to common defaults
                firstName =
                  (mapping.first_name && meta[mapping.first_name]) ||
                  meta.first_name ||
                  meta.given_name ||
                  (user.email ?? "").split("@")[0] ||
                  "";
                lastName =
                  (mapping.last_name && meta[mapping.last_name]) ||
                  meta.last_name ||
                  meta.family_name ||
                  "";

                // If an organization mapping is configured, try to find matching org
                if (mapping.organization) {
                  const orgName = meta[mapping.organization];
                  if (orgName) {
                    const { data: org } = await service
                      .from("organizations")
                      .select("id")
                      .ilike("name", orgName)
                      .maybeSingle();
                    organizationId = org?.id ?? null;
                  }
                }
              } else if (ssoProvider && !ssoProvider.auto_provision_users) {
                // SSO provider exists but auto-provisioning is off; redirect to error
                return NextResponse.redirect(
                  `${origin}/login?error=sso_no_auto_provision`
                );
              }
            }
          } else {
            // Standard (non-SSO) user — use metadata defaults
            const meta = user.user_metadata ?? {};
            const emailValue = user.email ?? "";
            firstName = meta.first_name || emailValue.split("@")[0] || "";
            lastName = meta.last_name || "";
          }

          const { data: newUserRow } = await service.from("users").upsert(
            {
              auth_id: user.id,
              email: user.email ?? "",
              first_name: firstName,
              last_name: lastName,
              role,
              status: "active",
              ...(organizationId ? { organization_id: organizationId } : {}),
            },
            { onConflict: "auth_id" }
          ).select("id").single();

          // Fire-and-forget: process automation rules for new user
          if (newUserRow) {
            processRulesForUser(newUserRow.id, "user_created").catch((err) =>
              console.error("Automation rule processing (user_created) failed:", err)
            );
          }
        } else {
          // User already exists — optionally update attributes from SSO claims
          const identities = user.identities ?? [];
          const ssoIdentity = identities.find(
            (i) => i.provider === "sso" || i.provider?.startsWith("sso:")
          );

          if (ssoIdentity) {
            const emailDomain = (user.email ?? "").split("@")[1]?.toLowerCase();
            if (emailDomain) {
              const { data: ssoProvider } = await service
                .from("sso_providers")
                .select("attribute_mapping")
                .eq("domain", emailDomain)
                .eq("is_active", true)
                .maybeSingle();

              if (ssoProvider) {
                const mapping = (ssoProvider.attribute_mapping ?? {}) as Record<string, string>;
                const meta = user.user_metadata ?? {};
                const updates: Record<string, string> = {};

                const newFirst =
                  (mapping.first_name && meta[mapping.first_name]) ||
                  meta.first_name ||
                  meta.given_name;
                const newLast =
                  (mapping.last_name && meta[mapping.last_name]) ||
                  meta.last_name ||
                  meta.family_name;

                if (newFirst) updates.first_name = newFirst;
                if (newLast) updates.last_name = newLast;

                if (Object.keys(updates).length > 0) {
                  await service
                    .from("users")
                    .update(updates)
                    .eq("id", existingUser.id);
                }
              }
            }
          }
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
