import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { importCourses } from "@/lib/marketplace/providers";
import { jsonNoStore } from "@/lib/api/no-store";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize("admin");
  if (!auth.authorized) return jsonNoStore({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`mp-sync-${auth.user.id}`, 5, 300000);
  if (!rl.success) return jsonNoStore({ error: "Rate limit exceeded. Sync can run at most 5 times per 5 minutes." }, { status: 429 });

  const { id } = await params;
  const result = await importCourses(id);

  return jsonNoStore({
    message: `Catalog sync complete. Imported ${result.imported} courses.`,
    imported: result.imported,
    errors: result.errors,
  });
}
