/**
 * Marketplace Provider Framework
 *
 * Defines a pluggable interface for connecting to external course marketplaces
 * (LinkedIn Learning, Udemy Business, SCORM packages, etc.) and syncing their
 * catalogs into the LMS marketplace_courses table.
 */

// ─── Types ───────────────────────────────────────────────────────

export interface MarketplaceProvider {
  name: string;
  fetchCatalog(config: ProviderConfig): Promise<ExternalCourse[]>;
  getEnrollmentUrl(courseId: string, userId: string): string;
  testConnection(config: ProviderConfig): Promise<{ success: boolean; message: string }>;
}

export interface ExternalCourse {
  external_id: string;
  title: string;
  description: string;
  provider: string;
  url: string;
  duration_minutes?: number;
  difficulty?: string;
  topics?: string[];
  thumbnail_url?: string;
}

export interface ProviderConfig {
  api_url?: string;
  api_key?: string;
  client_id?: string;
  client_secret?: string;
  organization_id?: string;
  /** SCORM-specific: URL to the SCORM manifest or package index */
  manifest_url?: string;
}

// ─── LinkedIn Learning Provider ─────────────────────────────────

export class LinkedInLearningProvider implements MarketplaceProvider {
  name = "LinkedIn Learning";

  /**
   * LinkedIn Learning API v2:
   * GET https://api.linkedin.com/v2/learningAssets?q=criteria
   * Requires OAuth2 client credentials with `r_liteprofile` and `r_organization_learning_reports`
   */
  async testConnection(config: ProviderConfig): Promise<{ success: boolean; message: string }> {
    try {
      const token = await this.getAccessToken(config);
      if (!token) {
        return { success: false, message: "Failed to obtain access token" };
      }

      const response = await fetch(
        "https://api.linkedin.com/v2/learningAssets?q=criteria&start=0&count=1",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (response.ok) {
        return { success: true, message: "Successfully connected to LinkedIn Learning" };
      }

      return {
        success: false,
        message: `LinkedIn Learning API returned HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  async fetchCatalog(config: ProviderConfig): Promise<ExternalCourse[]> {
    const token = await this.getAccessToken(config);
    if (!token) throw new Error("Failed to obtain LinkedIn Learning access token");

    const courses: ExternalCourse[] = [];
    let start = 0;
    const count = 100;
    let hasMore = true;

    while (hasMore) {
      const response = await fetch(
        `https://api.linkedin.com/v2/learningAssets?q=criteria&start=${start}&count=${count}&assetFilteringCriteria.assetTypes[0]=COURSE`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`LinkedIn Learning API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const elements = data.elements || [];

      for (const asset of elements) {
        courses.push({
          external_id: asset.urn || asset.id || "",
          title: asset.title?.value || "",
          description: asset.description?.value || "",
          provider: this.name,
          url: asset.details?.urls?.webLaunchUrl || `https://www.linkedin.com/learning/${asset.slug || ""}`,
          duration_minutes: asset.details?.duration
            ? Math.round(asset.details.duration.duration / 60)
            : undefined,
          difficulty: this.mapDifficulty(asset.details?.level),
          topics: (asset.details?.classifications || [])
            .map((c: any) => c.associatedClassification?.name?.value)
            .filter(Boolean),
          thumbnail_url: asset.details?.images?.primary || undefined,
        });
      }

      hasMore = elements.length === count;
      start += count;

      // Safety cap to avoid runaway pagination
      if (start > 10000) break;
    }

    return courses;
  }

  getEnrollmentUrl(courseId: string, userId: string): string {
    // LinkedIn Learning deep link with SSO pass-through
    return `https://www.linkedin.com/learning/activate?courseSlug=${encodeURIComponent(courseId)}&u=${encodeURIComponent(userId)}`;
  }

  private async getAccessToken(config: ProviderConfig): Promise<string | null> {
    if (config.api_key) return config.api_key;

    if (!config.client_id || !config.client_secret) {
      throw new Error("LinkedIn Learning requires client_id and client_secret for OAuth2");
    }

    try {
      const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: config.client_id,
          client_secret: config.client_secret,
        }),
      });

      if (!response.ok) return null;

      const data = await response.json();
      return data.access_token || null;
    } catch {
      return null;
    }
  }

  private mapDifficulty(level?: string): string | undefined {
    if (!level) return undefined;
    const map: Record<string, string> = {
      BEGINNER: "beginner",
      INTERMEDIATE: "intermediate",
      ADVANCED: "advanced",
    };
    return map[level.toUpperCase()] || level.toLowerCase();
  }
}

// ─── Udemy Business Provider ────────────────────────────────────

export class UdemyBusinessProvider implements MarketplaceProvider {
  name = "Udemy Business";

  /**
   * Udemy Business API v2.0:
   * GET https://{organization}.udemy.com/api-2.0/organizations/{org_id}/courses/list/
   * Requires API key + organization credentials
   */
  async testConnection(config: ProviderConfig): Promise<{ success: boolean; message: string }> {
    try {
      const baseUrl = this.getBaseUrl(config);
      const response = await fetch(
        `${baseUrl}/api-2.0/courses/?page_size=1`,
        { headers: this.buildHeaders(config) }
      );

      if (response.ok) {
        return { success: true, message: "Successfully connected to Udemy Business" };
      }

      if (response.status === 403) {
        return { success: false, message: "Invalid API credentials or insufficient permissions" };
      }

      return {
        success: false,
        message: `Udemy Business API returned HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  async fetchCatalog(config: ProviderConfig): Promise<ExternalCourse[]> {
    const baseUrl = this.getBaseUrl(config);
    const courses: ExternalCourse[] = [];
    let page = 1;
    let hasNext = true;

    while (hasNext) {
      const response = await fetch(
        `${baseUrl}/api-2.0/courses/?page=${page}&page_size=100&fields[course]=title,headline,url,image_480x270,content_info,primary_category,primary_subcategory,avg_rating,num_subscribers`,
        { headers: this.buildHeaders(config) }
      );

      if (!response.ok) {
        throw new Error(`Udemy Business API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const results = data.results || [];

      for (const course of results) {
        courses.push({
          external_id: String(course.id || ""),
          title: course.title || "",
          description: course.headline || "",
          provider: this.name,
          url: course.url
            ? `${baseUrl}${course.url}`
            : `${baseUrl}/course/${course.id}`,
          duration_minutes: this.parseDuration(course.content_info),
          difficulty: undefined, // Udemy doesn't expose difficulty in list endpoint
          topics: [
            course.primary_category?.title,
            course.primary_subcategory?.title,
          ].filter(Boolean),
          thumbnail_url: course.image_480x270 || undefined,
        });
      }

      hasNext = !!data.next;
      page++;

      // Safety cap
      if (page > 100) break;
    }

    return courses;
  }

  getEnrollmentUrl(courseId: string, userId: string): string {
    return `https://www.udemy.com/course/${encodeURIComponent(courseId)}/enroll/?user=${encodeURIComponent(userId)}`;
  }

  private getBaseUrl(config: ProviderConfig): string {
    if (config.api_url) return config.api_url.replace(/\/$/, "");
    if (config.organization_id) {
      return `https://${config.organization_id}.udemy.com`;
    }
    return "https://www.udemy.com";
  }

  private buildHeaders(config: ProviderConfig): Record<string, string> {
    const headers: Record<string, string> = { Accept: "application/json" };

    if (config.client_id && config.client_secret) {
      headers["Authorization"] = `Basic ${Buffer.from(`${config.client_id}:${config.client_secret}`).toString("base64")}`;
    } else if (config.api_key) {
      headers["Authorization"] = `Bearer ${config.api_key}`;
    }

    return headers;
  }

  private parseDuration(contentInfo?: string): number | undefined {
    if (!contentInfo) return undefined;
    // Udemy content_info is like "5.5 total hours" or "2 total hours"
    const match = contentInfo.match(/([\d.]+)\s*total\s*hours?/i);
    if (match) return Math.round(parseFloat(match[1]) * 60);
    return undefined;
  }
}

// ─── Generic SCORM Provider ────────────────────────────────────

export class GenericSCORMProvider implements MarketplaceProvider {
  name = "Generic SCORM";

  /**
   * Imports SCORM packages from a manifest URL or directory listing.
   * The manifest should be a JSON array of SCORM package metadata,
   * or a standard imsmanifest.xml reference list.
   */
  async testConnection(config: ProviderConfig): Promise<{ success: boolean; message: string }> {
    try {
      const url = config.manifest_url || config.api_url;
      if (!url) {
        return { success: false, message: "manifest_url or api_url is required" };
      }

      const response = await fetch(url, {
        headers: config.api_key ? { Authorization: `Bearer ${config.api_key}` } : {},
      });

      if (response.ok) {
        return { success: true, message: `Successfully connected to SCORM source at ${url}` };
      }

      return {
        success: false,
        message: `SCORM source returned HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  async fetchCatalog(config: ProviderConfig): Promise<ExternalCourse[]> {
    const url = config.manifest_url || config.api_url;
    if (!url) throw new Error("manifest_url or api_url is required for SCORM provider");

    const response = await fetch(url, {
      headers: config.api_key ? { Authorization: `Bearer ${config.api_key}` } : {},
    });

    if (!response.ok) {
      throw new Error(`SCORM source error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Expect a JSON array of SCORM package descriptors
    const packages = Array.isArray(data) ? data : data.packages || data.courses || [];

    return packages.map((pkg: any) => ({
      external_id: pkg.id || pkg.identifier || "",
      title: pkg.title || pkg.name || "",
      description: pkg.description || "",
      provider: this.name,
      url: pkg.launch_url || pkg.url || "",
      duration_minutes: pkg.duration_minutes || pkg.duration || undefined,
      difficulty: pkg.difficulty || pkg.level || undefined,
      topics: pkg.topics || pkg.tags || pkg.categories || [],
      thumbnail_url: pkg.thumbnail_url || pkg.image || undefined,
    }));
  }

  getEnrollmentUrl(courseId: string, _userId: string): string {
    // SCORM packages are typically launched within the LMS itself
    return `/courses/scorm/${encodeURIComponent(courseId)}/launch`;
  }
}

// ─── Provider Registry ──────────────────────────────────────────

const MARKETPLACE_PROVIDERS: Record<string, () => MarketplaceProvider> = {
  linkedin_learning: () => new LinkedInLearningProvider(),
  udemy_business: () => new UdemyBusinessProvider(),
  generic_scorm: () => new GenericSCORMProvider(),
};

export function getMarketplaceProvider(providerType: string): MarketplaceProvider {
  const factory = MARKETPLACE_PROVIDERS[providerType];
  if (!factory) {
    throw new Error(
      `Unknown marketplace provider: "${providerType}". Available: ${Object.keys(MARKETPLACE_PROVIDERS).join(", ")}`
    );
  }
  return factory();
}

export function listMarketplaceProviders(): string[] {
  return Object.keys(MARKETPLACE_PROVIDERS);
}
