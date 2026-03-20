import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { findBestMentors } from "@/lib/mentorship/matching";

export async function GET(request: NextRequest) {
  const auth = await authorize();
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`match-${auth.user.id}`, 5, 60000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "5");

  try {
    const matches = await findBestMentors(auth.user.id, Math.min(limit, 10));
    return NextResponse.json({ matches });
  } catch (err) {
    console.error("Mentor matching error:", err);
    return NextResponse.json({ error: "Failed to find matches" }, { status: 500 });
  }
}
