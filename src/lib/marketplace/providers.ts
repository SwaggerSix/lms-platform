import { createServiceClient } from "@/lib/supabase/service";

// ---- Provider Interface ----

export interface MarketplaceCourse {
  external_id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  external_url: string;
  duration_minutes: number | null;
  difficulty: string | null;
  topics: string[];
  rating: number | null;
}

export interface MarketplaceProvider {
  syncCatalog(apiConfig: Record<string, unknown>): Promise<MarketplaceCourse[]>;
  enrollUser(apiConfig: Record<string, unknown>, externalCourseId: string, userId: string): Promise<{ enrollment_id: string }>;
  getProgress(apiConfig: Record<string, unknown>, enrollmentId: string): Promise<{ progress: number; status: string }>;
  getCompletions(apiConfig: Record<string, unknown>, userId: string): Promise<{ external_id: string; completed_at: string }[]>;
}

// ---- Provider Stubs ----

export class LinkedInLearningProvider implements MarketplaceProvider {
  async syncCatalog(apiConfig: Record<string, unknown>): Promise<MarketplaceCourse[]> {
    // In production: call LinkedIn Learning API with apiConfig.client_id, apiConfig.client_secret
    // GET https://api.linkedin.com/v2/learningAssets
    console.log("[LinkedIn Learning] Syncing catalog with config:", Object.keys(apiConfig));
    return [];
  }

  async enrollUser(apiConfig: Record<string, unknown>, externalCourseId: string, userId: string) {
    console.log(`[LinkedIn Learning] Enrolling user ${userId} in course ${externalCourseId}`);
    return { enrollment_id: `li_${Date.now()}` };
  }

  async getProgress(apiConfig: Record<string, unknown>, enrollmentId: string) {
    console.log(`[LinkedIn Learning] Getting progress for ${enrollmentId}`);
    return { progress: 0, status: "enrolled" };
  }

  async getCompletions(apiConfig: Record<string, unknown>, userId: string) {
    console.log(`[LinkedIn Learning] Getting completions for ${userId}`);
    return [];
  }
}

export class CourseraProvider implements MarketplaceProvider {
  async syncCatalog(apiConfig: Record<string, unknown>): Promise<MarketplaceCourse[]> {
    // In production: call Coursera for Business API
    // GET https://api.coursera.org/api/businesses.v1/{businessId}/courses
    console.log("[Coursera] Syncing catalog with config:", Object.keys(apiConfig));
    return [];
  }

  async enrollUser(apiConfig: Record<string, unknown>, externalCourseId: string, userId: string) {
    console.log(`[Coursera] Enrolling user ${userId} in course ${externalCourseId}`);
    return { enrollment_id: `coursera_${Date.now()}` };
  }

  async getProgress(apiConfig: Record<string, unknown>, enrollmentId: string) {
    console.log(`[Coursera] Getting progress for ${enrollmentId}`);
    return { progress: 0, status: "enrolled" };
  }

  async getCompletions(apiConfig: Record<string, unknown>, userId: string) {
    console.log(`[Coursera] Getting completions for ${userId}`);
    return [];
  }
}

export class UdemyBusinessProvider implements MarketplaceProvider {
  async syncCatalog(apiConfig: Record<string, unknown>): Promise<MarketplaceCourse[]> {
    // In production: call Udemy Business API
    // GET https://api.udemy.com/api-2.0/organizations/{org_id}/courses/
    console.log("[Udemy Business] Syncing catalog with config:", Object.keys(apiConfig));
    return [];
  }

  async enrollUser(apiConfig: Record<string, unknown>, externalCourseId: string, userId: string) {
    console.log(`[Udemy Business] Enrolling user ${userId} in course ${externalCourseId}`);
    return { enrollment_id: `udemy_${Date.now()}` };
  }

  async getProgress(apiConfig: Record<string, unknown>, enrollmentId: string) {
    console.log(`[Udemy Business] Getting progress for ${enrollmentId}`);
    return { progress: 0, status: "enrolled" };
  }

  async getCompletions(apiConfig: Record<string, unknown>, userId: string) {
    console.log(`[Udemy Business] Getting completions for ${userId}`);
    return [];
  }
}

// ---- Provider Factory ----

const providerRegistry: Record<string, () => MarketplaceProvider> = {
  linkedin_learning: () => new LinkedInLearningProvider(),
  coursera: () => new CourseraProvider(),
  udemy_business: () => new UdemyBusinessProvider(),
};

export function getProvider(providerType: string): MarketplaceProvider | null {
  const factory = providerRegistry[providerType];
  return factory ? factory() : null;
}

// ---- Catalog Sync Helper ----

export async function importCourses(providerId: string): Promise<{ imported: number; errors: string[] }> {
  const service = createServiceClient();

  const { data: provider, error } = await service
    .from("marketplace_providers")
    .select("*")
    .eq("id", providerId)
    .single();

  if (error || !provider) {
    return { imported: 0, errors: ["Provider not found"] };
  }

  const impl = getProvider(provider.provider_type);
  if (!impl) {
    return { imported: 0, errors: [`Unsupported provider type: ${provider.provider_type}`] };
  }

  const apiConfig = (provider.api_config as Record<string, unknown>) || {};
  const errors: string[] = [];
  let imported = 0;

  try {
    const courses = await impl.syncCatalog(apiConfig);

    for (const course of courses) {
      const { error: upsertError } = await service
        .from("marketplace_courses")
        .upsert(
          {
            provider_id: providerId,
            external_id: course.external_id,
            title: course.title,
            description: course.description,
            thumbnail_url: course.thumbnail_url,
            external_url: course.external_url,
            duration_minutes: course.duration_minutes,
            difficulty: course.difficulty,
            topics: course.topics,
            rating: course.rating,
            last_synced_at: new Date().toISOString(),
            is_active: true,
          },
          { onConflict: "provider_id,external_id" }
        );

      if (upsertError) {
        errors.push(`Failed to import ${course.external_id}: ${upsertError.message}`);
      } else {
        imported++;
      }
    }

    // Update provider sync timestamp
    await service
      .from("marketplace_providers")
      .update({ catalog_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", providerId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    errors.push(message);
  }

  return { imported, errors };
}
