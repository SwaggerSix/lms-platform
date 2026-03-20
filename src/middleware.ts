import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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
      "/api/workflows/webhook",
      "/api/teams/bot",
      "/api/xapi/statements",
      "/api/cron/",
      "/api/push/subscribe",
    ];
    const isExempt = csrfExemptPaths.some((p) => pathname.startsWith(p));

    if (!isExempt) {
      const origin = request.headers.get("origin");
      const referer = request.headers.get("referer");
      const allowedOrigins = [
        process.env.NEXT_PUBLIC_APP_URL,
        "https://learn.gothamgovernment.com",
        "https://learn.gothamculture.com",
      ].filter(Boolean) as string[];

      // Block if origin is present and doesn't match any allowed origin
      if (origin && !allowedOrigins.some((ao) => origin.startsWith(ao))) {
        // Check referer as fallback
        if (!referer || !allowedOrigins.some((ao) => referer.startsWith(ao))) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }
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
  if (user && (pathname.startsWith("/admin") || pathname.startsWith("/manager"))) {
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

    if (pathname.startsWith("/admin") && role !== "admin" && role !== "super_admin") {
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

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
