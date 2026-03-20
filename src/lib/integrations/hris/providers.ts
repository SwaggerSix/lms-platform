/**
 * HRIS Provider Framework
 *
 * Defines a pluggable interface for connecting to external HRIS systems
 * and fetching employee data for user provisioning in the LMS.
 *
 * Complements the existing HRISAdapter in hris-sync.ts by providing a
 * simpler, config-driven interface for new provider implementations.
 */

// ─── Types ───────────────────────────────────────────────────────

export interface HRISProvider {
  name: string;
  fetchEmployees(config: HRISConfig): Promise<HRISEmployee[]>;
  testConnection(config: HRISConfig): Promise<{ success: boolean; message: string }>;
}

export interface HRISEmployee {
  external_id: string;
  email: string;
  first_name: string;
  last_name: string;
  department?: string;
  job_title?: string;
  manager_email?: string;
  hire_date?: string;
  status: "active" | "inactive";
}

export interface HRISConfig {
  api_url: string;
  api_key?: string;
  username?: string;
  password?: string;
  /** BambooHR-specific: company subdomain */
  company_domain?: string;
  /** Generic REST: field mapping from source keys to HRISEmployee keys */
  field_map?: Record<string, string>;
  /** Generic REST: JSON path to the employee array in the response (e.g. "data.employees") */
  results_path?: string;
}

// ─── BambooHR Provider ──────────────────────────────────────────

export class BambooHRProvider implements HRISProvider {
  name = "BambooHR";

  async testConnection(config: HRISConfig): Promise<{ success: boolean; message: string }> {
    try {
      const baseUrl = this.getBaseUrl(config);
      const response = await fetch(`${baseUrl}/v1/meta/fields`, {
        headers: this.buildHeaders(config),
      });

      if (response.ok) {
        return { success: true, message: "Successfully connected to BambooHR" };
      }

      if (response.status === 401) {
        return { success: false, message: "Invalid API key or unauthorized" };
      }

      return {
        success: false,
        message: `BambooHR returned HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  async fetchEmployees(config: HRISConfig): Promise<HRISEmployee[]> {
    const baseUrl = this.getBaseUrl(config);
    const response = await fetch(`${baseUrl}/v1/employees/directory`, {
      headers: this.buildHeaders(config),
    });

    if (!response.ok) {
      throw new Error(`BambooHR API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const employees: HRISEmployee[] = (data.employees || []).map((emp: any) => ({
      external_id: String(emp.id ?? ""),
      email: emp.workEmail || emp.homeEmail || "",
      first_name: emp.firstName || "",
      last_name: emp.lastName || "",
      department: emp.department || undefined,
      job_title: emp.jobTitle || undefined,
      manager_email: emp.supervisorEmail || emp.supervisor || undefined,
      hire_date: emp.hireDate || undefined,
      status: emp.status === "Active" ? ("active" as const) : ("inactive" as const),
    }));

    // Filter out employees without email (unusable for LMS provisioning)
    return employees.filter((e) => e.email);
  }

  private getBaseUrl(config: HRISConfig): string {
    if (config.api_url) return config.api_url;
    const domain = config.company_domain;
    if (!domain) throw new Error("BambooHR requires api_url or company_domain");
    return `https://api.bamboohr.com/api/gateway.php/${domain}`;
  }

  private buildHeaders(config: HRISConfig): Record<string, string> {
    const key = config.api_key;
    if (!key) throw new Error("BambooHR requires an api_key");
    return {
      Authorization: `Basic ${Buffer.from(`${key}:x`).toString("base64")}`,
      Accept: "application/json",
    };
  }
}

// ─── Generic REST Provider ──────────────────────────────────────

/**
 * A configurable provider that can connect to any REST API that returns
 * employee data. The caller configures the endpoint URL, auth, and a
 * field_map that translates the source JSON keys to HRISEmployee fields.
 *
 * Default field_map (if not provided):
 *   { id: "external_id", email: "email", first_name: "first_name", ... }
 */
export class GenericRESTProvider implements HRISProvider {
  name = "Generic REST API";

  private static DEFAULT_FIELD_MAP: Record<string, string> = {
    id: "external_id",
    email: "email",
    first_name: "first_name",
    last_name: "last_name",
    department: "department",
    job_title: "job_title",
    manager_email: "manager_email",
    hire_date: "hire_date",
    status: "status",
  };

  async testConnection(config: HRISConfig): Promise<{ success: boolean; message: string }> {
    try {
      if (!config.api_url) {
        return { success: false, message: "api_url is required" };
      }

      const response = await fetch(config.api_url, {
        method: "GET",
        headers: this.buildHeaders(config),
      });

      if (response.ok) {
        return { success: true, message: `Connected to ${config.api_url}` };
      }

      return {
        success: false,
        message: `Endpoint returned HTTP ${response.status}: ${response.statusText}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  async fetchEmployees(config: HRISConfig): Promise<HRISEmployee[]> {
    if (!config.api_url) {
      throw new Error("api_url is required for Generic REST provider");
    }

    const response = await fetch(config.api_url, {
      method: "GET",
      headers: this.buildHeaders(config),
    });

    if (!response.ok) {
      throw new Error(`REST API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Navigate to the results array using results_path (e.g. "data.employees")
    const records = this.extractResults(data, config.results_path);
    if (!Array.isArray(records)) {
      throw new Error(
        `Expected an array at results_path "${config.results_path || "(root)"}", got ${typeof records}`
      );
    }

    const fieldMap = { ...GenericRESTProvider.DEFAULT_FIELD_MAP, ...config.field_map };

    // Invert the field map: source_key -> target_key
    const invertedMap: Record<string, string> = {};
    for (const [sourceKey, targetKey] of Object.entries(fieldMap)) {
      invertedMap[sourceKey] = targetKey;
    }

    return records
      .map((record: any) => {
        const mapped: Record<string, any> = {};
        for (const [sourceKey, targetKey] of Object.entries(invertedMap)) {
          const value = this.getNestedValue(record, sourceKey);
          if (value !== undefined) {
            mapped[targetKey] = value;
          }
        }

        // Ensure external_id is a string
        if (mapped.external_id != null) {
          mapped.external_id = String(mapped.external_id);
        }

        // Normalize status
        if (mapped.status) {
          const s = String(mapped.status).toLowerCase();
          mapped.status = s === "active" ? "active" : "inactive";
        } else {
          mapped.status = "active";
        }

        return mapped as HRISEmployee;
      })
      .filter((e) => e.email && e.external_id);
  }

  private buildHeaders(config: HRISConfig): Record<string, string> {
    const headers: Record<string, string> = { Accept: "application/json" };

    if (config.api_key) {
      headers["Authorization"] = `Bearer ${config.api_key}`;
    } else if (config.username && config.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
    }

    return headers;
  }

  private extractResults(data: any, path?: string): any {
    if (!path) return data;
    return path.split(".").reduce((obj, key) => obj?.[key], data);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }
}

// ─── Provider Registry ──────────────────────────────────────────

const HRIS_PROVIDERS: Record<string, () => HRISProvider> = {
  bamboohr: () => new BambooHRProvider(),
  generic_rest: () => new GenericRESTProvider(),
};

export function getHRISProvider(providerType: string): HRISProvider {
  const factory = HRIS_PROVIDERS[providerType];
  if (!factory) {
    throw new Error(
      `Unknown HRIS provider type: "${providerType}". Available: ${Object.keys(HRIS_PROVIDERS).join(", ")}`
    );
  }
  return factory();
}

export function listHRISProviders(): string[] {
  return Object.keys(HRIS_PROVIDERS);
}
