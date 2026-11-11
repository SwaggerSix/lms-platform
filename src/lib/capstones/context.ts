import { authorize } from "@/lib/auth/authorize";
import { createServiceClient } from "@/lib/supabase/service";
import { capstoneState, type CapstoneState } from "./rules";
import {
  loadAttempts,
  loadCapstoneCertification,
  pathCompletion,
  type CapstoneCertification,
  type CapstoneSubmissionRow,
} from "./server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LearnerCapstoneContext =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      userId: string;
      service: ReturnType<typeof createServiceClient>;
      certification: CapstoneCertification;
      attempts: CapstoneSubmissionRow[];
      progress: { complete: boolean; total: number; done: number };
      state: CapstoneState;
    };

/**
 * The signed-in learner's standing on one capstone-gated certification.
 * Any role may hold one (admins take courses too). 404 for anything that
 * isn't a capstone certification, so ids can't be probed.
 */
export async function learnerCapstoneContext(certificationId: string): Promise<LearnerCapstoneContext> {
  if (!UUID.test(certificationId)) return { ok: false, status: 404, error: "Not found" };
  const auth = await authorize();
  if (!auth.authorized) return { ok: false, status: auth.status, error: auth.error };

  const service = createServiceClient();
  const certification = await loadCapstoneCertification(service, certificationId);
  if (!certification || !certification.requires_capstone || !certification.learning_path_id) {
    return { ok: false, status: 404, error: "Not found" };
  }
  const [attempts, progress] = await Promise.all([
    loadAttempts(service, auth.user.id, certification.id),
    pathCompletion(service, auth.user.id, certification.learning_path_id),
  ]);
  return {
    ok: true,
    userId: auth.user.id,
    service,
    certification,
    attempts,
    progress,
    state: capstoneState(attempts, certification.max_capstone_attempts, progress.complete),
  };
}
