import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { learnerBlockedReason, loadCapstoneCert } from "@/lib/certifications/capstone-service";

/** Signed-in learner + a credential whose capstone is open to them, or a response to return. */
export async function learnerContext(certificationId: string) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return { res: NextResponse.json({ error: auth.error }, { status: auth.status }) } as const;
  if (!z.string().uuid().safeParse(certificationId).success) {
    return { res: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  }
  const service = createServiceClient();
  const loaded = await loadCapstoneCert(service, certificationId);
  if (!loaded) return { res: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  const blocked = await learnerBlockedReason(service, auth.user.id, loaded.cert);
  if (blocked) {
    return { res: NextResponse.json({ error: blocked }, { status: 403 }) } as const;
  }
  return { auth, service, ...loaded } as const;
}
