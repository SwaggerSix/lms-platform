import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { learnerMayUse, loadCapstoneCert } from "@/lib/certifications/capstone-service";

/** Signed-in learner + a credential with a capstone they're enrolled for, or a response to return. */
export async function learnerContext(certificationId: string) {
  const auth = await authorize("admin", "manager", "instructor", "learner");
  if (!auth.authorized) return { res: NextResponse.json({ error: auth.error }, { status: auth.status }) } as const;
  if (!z.string().uuid().safeParse(certificationId).success) {
    return { res: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  }
  const service = createServiceClient();
  const loaded = await loadCapstoneCert(service, certificationId);
  if (!loaded) return { res: NextResponse.json({ error: "Not found" }, { status: 404 }) } as const;
  if (!(await learnerMayUse(service, auth.user.id, loaded.cert))) {
    return {
      res: NextResponse.json({ error: "Enroll in the course first to hand in your capstone." }, { status: 403 }),
    } as const;
  }
  return { auth, service, ...loaded } as const;
}
