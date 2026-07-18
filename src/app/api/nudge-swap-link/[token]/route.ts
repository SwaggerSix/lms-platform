import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimit } from "@/lib/rate-limit";
import { swapAssignmentAction } from "@/lib/nudges/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";

// Swap link from an email. The swap mutates state, so it must NOT happen on a
// plain GET: email link-prefetchers (e.g. Outlook SafeLinks, antivirus
// scanners) issue GETs and would silently swap the recipient's nudge. GET now
// renders a one-tap confirmation page; the actual swap happens on POST.

function confirmationPage(): string {
  // Self-contained confirmation. The form POSTs to the same URL (no token is
  // interpolated into the markup). "No thanks" just closes the flow.
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Swap your nudge</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:#f8f9fa; margin:0; padding:0; color:#212529; }
  .card { max-width:420px; margin:12vh auto; background:#fff; border:1px solid #dee2e6; border-radius:12px; padding:28px; text-align:center; }
  h1 { font-size:1.25rem; margin:0 0 8px; }
  p { color:#6c757d; margin:0 0 20px; }
  button { background:#91C53C; color:#fff; border:0; border-radius:8px; padding:12px 20px; font-size:1rem; font-weight:600; cursor:pointer; width:100%; }
  button:hover { background:#7fb02f; }
</style>
</head>
<body>
  <div class="card">
    <h1>Swap this nudge?</h1>
    <p>We'll pick a different suggested action for you. This only happens when you confirm.</p>
    <form method="POST">
      <button type="submit">Swap my nudge</button>
    </form>
  </div>
</body>
</html>`;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  // Resolve params so the route is exercised, but never mutate on GET.
  await params;
  return new NextResponse(confirmationPage(), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const rl = await rateLimit(`nudge-swap-link-${token}`, 15, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const service = createServiceClient();
  const { data: assignment } = await service
    .from("nudge_assignments")
    .select("id")
    .eq("response_token", token)
    .single();

  if (assignment) {
    await swapAssignmentAction(service, assignment.id, null, true, false);
  }

  const base = APP_URL || new URL(request.url).origin;
  return NextResponse.redirect(`${base}/nudge/${token}`, { status: 303 });
}
