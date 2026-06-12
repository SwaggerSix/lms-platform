import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { isSuperAdminOnlyPath } from "@/lib/auth/roles";
import { getFeatureForPath } from "@/lib/features/routes";
import { resolveEnabledFeatures } from "@/lib/features/resolve";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // CSRF: validate Origin header for state-changing requests to /api/ routes
  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    pathname.startsWith("/api/")
  ) {
    // Paths exempt from origin checks (webhooks, crons, external callers)
    const csrfExemptPaths = [
      "/api/storefront/webhook",
      "/api/workflows/webhook",
      "/api/teams/bot",
      "/api/xapi/statements",
      "/api/cron/",
      "/api/push/subscribe",
      "/api/evaluations/webhook",
    ];
    const isExempt = csrfExemptPaths.some((p) => pathname.startsWith(p));

    if (!isExempt) {
      const origin = request.headers.get("origin");
      const referer = request.headers.get("referer");
      const allowedOrigins = new Set(
        [
          process.env.NEXT_PUBLIC_APP_URL,
          "https://learn.gothamgovernment.com",
          "https://learn.gothamculture.com",
          // Same-host requests (covers Vercel preview URLs and local dev)
          `${request.nextUrl.protocol}//${request.headers.get("host")}`,
        ]
          .filter(Boolean)
          .map((o) => {
            try {
              return new URL(o as string).origin;
            } catch {
              return null;
            }
          })
          .filter(Boolean) as string[]
      );

      // Exact-origin comparison; startsWith would let
      // https://learn.gothamculture.com.evil.com through.
      const matchesAllowed = (value: string | null) => {
        if (!value) return false;
        try {
          return allowedOrigins.has(new URL(value).origin);
        } catch {
          return false;
        }
      };

      // Block if origin is present and doesn't match any allowed origin
      if (origin && !matchesAllowed(origin)) {
        // Check referer as fallback
        if (!matchesAllowed(referer)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }
  }

  // Token-authenticated nudge routes: reachable by anyone (logged in or not)
  // straight from an email link, with no redirect either way.
  const nudgeTokenPaths = ["/nudge/", "/api/nudge-respond", "/api/nudge-swap-link"];
  if (nudgeTokenPaths.some((p) => pathname.startsWith(p))) {
    return supabaseResponse;
  }

  // Public storefronts: customers browse and buy without an LMS account,
  // and logged-in staff can view the shops too (no dashboard redirect).
  if (pathname.startsWith("/store/") || pathname.startsWith("/api/storefront/")) {
    return supabaseResponse;
  }

  const publicPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/forgot-password",
    "/api/auth/callback",
    "/api/auth/confirm",
    "/api/xapi/about",
    "/api/certificates/verify",
    "/api/sso/check-domain",
    "/api/embed",
    "/api/push/subscribe",
    "/api/evaluations/webhook",
  ];
  const isPublicPath = publicPaths.some((path) =>
    pathname.startsWith(path)
  );

  // Redirect unauthenticated users to login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from public paths
  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Tenant resolution: check X-Tenant-Slug header or subdomain
  // This sets x-tenant-id on the request for downstream handlers
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0];
  const tenantSlug = request.headers.get("x-tenant-slug");
  if (tenantSlug || (hostname && !hostname.includes("localhost") && hostname.split(".").length >= 3)) {
    // Defer full resolution to API routes via getTenantScope()
    // Just forward the slug hint so routes can resolve it
    if (!tenantSlug && hostname.split(".").length >= 3) {
      const subdomain = hostname.split(".")[0];
      if (subdomain !== "www" && subdomain !== "app") {
        supabaseResponse.headers.set("x-tenant-slug", subdomain);
      }
    }
  }

  // Role-based route protection for authenticated users
  if (
    user &&
    (pathname.startsWith("/admin") ||
      pathname.startsWith("/manager") ||
      pathname.startsWith("/instructor"))
  ) {
    // Use service client to bypass RLS (avoids infinite recursion in users policy)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile } = await serviceClient
      .from("users")
      .select("role")
      .eq("auth_id", user.id)
      .single();

    const role = profile?.role;

    // Instructors share a few admin-area management pages (Documents, Knowledge
    // Base) so they can add and edit content alongside admins.
    const instructorSharedAdminPaths = ["/admin/documents", "/admin/knowledge-base"];
    const isInstructorSharedAdminPath = instructorSharedAdminPaths.some((p) =>
      pathname.startsWith(p)
    );

    if (
      pathname.startsWith("/admin") &&
      role !== "admin" &&
      role !== "super_admin" &&
      !(role === "instructor" && isInstructorSharedAdminPath)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // The instructor portal is open to instructors (and admins/super admins).
    if (
      pathname.startsWith("/instructor") &&
      !["instructor", "admin", "super_admin"].includes(role)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Platform-level areas (tenants, eCommerce, marketplace, integrations,
    // cross-tenant analytics, AI course creator) are reserved for Super Admins
    // (gC/GGS staff). Client Admins are scoped to their own organization.
    if (role !== "super_admin" && isSuperAdminOnlyPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    if (pathname.startsWith("/manager") && !["admin", "super_admin", "manager"].includes(role)) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Per-tenant feature gating: block routes whose feature is disabled for the
  // requesting user's tenant. Platform admins are never gated. Page requests
  // are redirected to the dashboard; API requests get a 403.
  const gatedFeature = user ? getFeatureForPath(pathname) : null;
  if (user && gatedFeature) {
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: profile } = await serviceClient
      .from("users")
      .select("id, role")
      .eq("auth_id", user.id)
      .single();

    // Platform admins see everything regardless of tenant feature flags.
    if (profile && profile.role !== "admin" && profile.role !== "super_admin") {
      const { data: membership } = await serviceClient
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", profile.id)
        .limit(1)
        .single();

      const enabled = await resolveEnabledFeatures(
        serviceClient,
        membership?.tenant_id ?? null
      );

      if (enabled[gatedFeature] === false) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            { error: "This feature is not enabled for your account." },
            { status: 403 }
          );
        }
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        url.search = "";
        url.searchParams.set("feature_disabled", gatedFeature);
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
