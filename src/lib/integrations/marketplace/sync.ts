import { createServiceClient } from "@/lib/supabase/service";
import {
  getMarketplaceProvider,
  type ProviderConfig,
  type ExternalCourse,
} from "./providers";

// ─── Types ───────────────────────────────────────────────────────

export interface MarketplaceSyncResult {
  synced: number;
  errors: string[];
}

// ─── Sync Engine ─────────────────────────────────────────────────

/**
 * Synchronizes the course catalog from a marketplace provider into the
 * `marketplace_courses` table.
 *
 * @param providerId - UUID of the marketplace_providers row
 */
export async function syncProviderCatalog(
  providerId: string
): Promise<MarketplaceSyncResult> {
  const service = createServiceClient();
  const result: MarketplaceSyncResult = { synced: 0, errors: [] };

  // 1. Load the provider record
  const { data: providerRecord, error: provError } = await service
    .from("marketplace_providers")
    .select("*")
    .eq("id", providerId)
    .single();

  if (provError || !providerRecord) {
    throw new Error(`Marketplace provider not found: ${providerId}`);
  }

  if (!providerRecord.is_active) {
    throw new Error(`Marketplace provider ${providerId} is not active`);
  }

  // 2. Resolve the provider implementation
  const providerType = providerRecord.provider_type;
  const provider = getMarketplaceProvider(providerType);
  const config = (providerRecord.config || {}) as ProviderConfig;

  // 3. Fetch the external catalog
  let catalog: ExternalCourse[];
  try {
    catalog = await provider.fetchCatalog(config);
  } catch (err) {
    const msg = `Failed to fetch catalog: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(msg);

    // Update provider with failure info
    await service
      .from("marketplace_providers")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: "failed",
        last_sync_error: msg,
      })
      .eq("id", providerId);

    return result;
  }

  // 4. Upsert each course into marketplace_courses
  for (const course of catalog) {
    try {
      await upsertMarketplaceCourse(service, course, providerId);
      result.synced++;
    } catch (err) {
      const msg = `${course.external_id} (${course.title}): ${err instanceof Error ? err.message : String(err)}`;
      result.errors.push(msg);
    }
  }

  // 5. Mark courses that are no longer in the catalog as inactive
  try {
    const syncedExternalIds = catalog.map((c) => c.external_id);
    if (syncedExternalIds.length > 0) {
      await service
        .from("marketplace_courses")
        .update({ is_active: false })
        .eq("provider_id", providerId)
        .eq("is_active", true)
        .not("external_id", "in", `(${syncedExternalIds.map((id) => `"${id}"`).join(",")})`);
    }
  } catch (err) {
    result.errors.push(
      `Deactivation step: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // 6. Update provider sync metadata
  const syncStatus = result.errors.length > 0
    ? result.synced > 0 ? "partial" : "failed"
    : "completed";

  await service
    .from("marketplace_providers")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: syncStatus,
      last_sync_error: result.errors.length > 0 ? result.errors[0] : null,
      course_count: result.synced,
    })
    .eq("id", providerId);

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────

/**
 * Upserts a single external course into the marketplace_courses table.
 * If a course with the same external_id + provider_id exists, update it.
 * Otherwise, insert a new record.
 */
async function upsertMarketplaceCourse(
  service: ReturnType<typeof createServiceClient>,
  course: ExternalCourse,
  providerId: string
): Promise<void> {
  const courseData = {
    external_id: course.external_id,
    provider_id: providerId,
    title: course.title,
    description: course.description,
    provider_name: course.provider,
    url: course.url,
    duration_minutes: course.duration_minutes ?? null,
    difficulty: course.difficulty ?? null,
    topics: course.topics ?? [],
    thumbnail_url: course.thumbnail_url ?? null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  // Check if the course already exists
  const { data: existing } = await service
    .from("marketplace_courses")
    .select("id")
    .eq("provider_id", providerId)
    .eq("external_id", course.external_id)
    .single();

  if (existing) {
    await service
      .from("marketplace_courses")
      .update(courseData)
      .eq("id", existing.id);
  } else {
    await service
      .from("marketplace_courses")
      .insert(courseData);
  }
}
