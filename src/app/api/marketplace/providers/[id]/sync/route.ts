import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { importCourses } from "@/lib/marketplace/providers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`mp-sync-${auth.user.id}`, 5, 300000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded. Sync can run at most 5 times per 5 minutes." }, { status: 429 });

  const { id } = await params;
  const result = await importCourses(id);

  return NextResponse.json({
    message: `Catalog sync complete. Imported ${result.imported} courses.`,
    imported: result.imported,
    errors: result.errors,
  });
}
