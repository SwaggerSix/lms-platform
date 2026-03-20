import { createServiceClient } from "@/lib/supabase/service";
import { getHRISProvider, type HRISConfig, type HRISEmployee } from "./providers";

// ─── Types ───────────────────────────────────────────────────────

export interface HRISSyncResult {
  created: number;
  updated: number;
  errors: string[];
}

// ─── Sync Engine ─────────────────────────────────────────────────

/**
 * Synchronizes users from an HRIS provider into the LMS.
 *
 * Reads the integration record from `external_integrations`, resolves the
 * provider, fetches employees, and upserts them into the `users` table.
 *
 * @param integrationId - UUID of the external_integrations row
 */
export async function syncHRISUsers(
  integrationId: string
): Promise<HRISSyncResult> {
  const service = createServiceClient();
  const result: HRISSyncResult = { created: 0, updated: 0, errors: [] };

  // 1. Load the integration config
  const { data: integration, error: intError } = await service
    .from("external_integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (intError || !integration) {
    throw new Error(`Integration not found: ${integrationId}`);
  }

  if (!integration.is_active) {
    throw new Error(`Integration ${integrationId} is not active`);
  }

  // 2. Resolve the provider
  const providerType = integration.provider;
  const provider = getHRISProvider(providerType);
  const config = integration.config as HRISConfig;

  // 3. Create a sync log entry
  const { data: syncLog } = await service
    .from("integration_sync_logs")
    .insert({
      integration_id: integrationId,
      sync_type: "full",
      status: "started",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  try {
    // 4. Fetch employees from the HRIS
    const employees = await provider.fetchEmployees(config);

    // 5. Upsert each employee into the users table
    for (const employee of employees) {
      try {
        // Check existence BEFORE upsert so we can accurately count creates vs updates
        const { data: existing } = await service
          .from("users")
          .select("id")
          .eq("email", employee.email)
          .maybeSingle();

        await upsertUser(service, employee, integrationId);

        if (existing) {
          result.updated++;
        } else {
          result.created++;
        }
      } catch (err) {
        const msg = `${employee.email}: ${err instanceof Error ? err.message : String(err)}`;
        result.errors.push(msg);
      }
    }

    // 6. Update sync log
    const status =
      result.errors.length > 0
        ? result.created + result.updated > 0
          ? "partial"
          : "failed"
        : "completed";

    await service
      .from("integration_sync_logs")
      .update({
        status,
        records_processed: employees.length,
        records_created: result.created,
        records_updated: result.updated,
        records_failed: result.errors.length,
        errors: result.errors.map((e) => ({ error: e })),
        completed_at: new Date().toISOString(),
      })
      .eq("id", syncLog?.id);

    // 7. Update integration last_sync
    await service
      .from("external_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: status,
      })
      .eq("id", integrationId);
  } catch (err) {
    // Mark sync as failed
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (syncLog?.id) {
      await service
        .from("integration_sync_logs")
        .update({
          status: "failed",
          errors: [{ error: errorMessage }],
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLog.id);
    }

    await service
      .from("external_integrations")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "failed",
      })
      .eq("id", integrationId);

    throw err;
  }

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Upserts a single HRIS employee into the LMS users table.
 * If a user with the same email exists, update their profile fields.
 * Otherwise, create a new user record.
 */
async function upsertUser(
  service: ReturnType<typeof createServiceClient>,
  employee: HRISEmployee,
  integrationId: string
): Promise<void> {
  const userData: Record<string, unknown> = {
    first_name: employee.first_name,
    last_name: employee.last_name,
    job_title: employee.job_title ?? null,
    hire_date: employee.hire_date ?? null,
    status: employee.status,
    hris_external_id: employee.external_id,
    hris_integration_id: integrationId,
    updated_at: new Date().toISOString(),
  };

  // Check if user already exists by email
  const { data: existingUser } = await service
    .from("users")
    .select("id")
    .eq("email", employee.email)
    .single();

  if (existingUser) {
    await service
      .from("users")
      .update(userData)
      .eq("id", existingUser.id);
  } else {
    await service.from("users").insert({
      ...userData,
      email: employee.email,
      role: "learner",
    });
  }

  // If the employee has a department, ensure they're linked to the right department
  if (employee.department) {
    const { data: dept } = await service
      .from("departments")
      .select("id")
      .eq("name", employee.department)
      .single();

    if (dept) {
      const userId = existingUser?.id;
      if (userId) {
        await service
          .from("users")
          .update({ department_id: dept.id })
          .eq("id", userId);
      }
    }
  }
}
