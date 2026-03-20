import { createServiceClient } from "@/lib/supabase/service";

// ─── Types ───────────────────────────────────────────────────────

export interface HRISEmployee {
  external_id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string;
  department?: string;
  manager_email?: string;
  hire_date?: string;
  status?: "active" | "inactive";
  custom_fields?: Record<string, unknown>;
}

export interface HRISDepartment {
  external_id: string;
  name: string;
  parent_id?: string;
}

export interface TrainingCompletion {
  employee_id: string;
  course_name: string;
  completed_at: string;
  score?: number;
  certificate_url?: string;
}

export interface FieldMapping {
  source_field: string;
  target_field: string;
  transform?: string;
  is_active: boolean;
}

export interface SyncResult {
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  errors: Array<{ record?: string; error: string }>;
}

export interface IntegrationConfig {
  api_key_encrypted?: string;
  base_url?: string;
  company_id?: string;
  field_mappings?: FieldMapping[];
  subdomain?: string;
  client_id?: string;
  client_secret_encrypted?: string;
  tenant_id?: string;
}

// ─── Adapter Interface ───────────────────────────────────────────

export interface HRISAdapter {
  readonly providerName: string;
  testConnection(config: IntegrationConfig): Promise<{ success: boolean; message: string }>;
  fetchEmployees(config: IntegrationConfig): Promise<HRISEmployee[]>;
  fetchDepartments(config: IntegrationConfig): Promise<HRISDepartment[]>;
  pushCompletions(config: IntegrationConfig, completions: TrainingCompletion[]): Promise<{ success: boolean; pushed: number }>;
}

// ─── BambooHR Adapter ────────────────────────────────────────────

export class BambooHRAdapter implements HRISAdapter {
  readonly providerName = "BambooHR";

  async testConnection(config: IntegrationConfig): Promise<{ success: boolean; message: string }> {
    try {
      // BambooHR API: GET https://api.bamboohr.com/api/gateway.php/{companyDomain}/v1/employees/directory
      const baseUrl = `https://api.bamboohr.com/api/gateway.php/${config.subdomain || config.company_id}`;
      const response = await fetch(`${baseUrl}/v1/meta/fields`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${config.api_key_encrypted}:x`).toString("base64")}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        return { success: true, message: "Successfully connected to BambooHR" };
      }
      return { success: false, message: `BambooHR returned status ${response.status}` };
    } catch (error) {
      return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  async fetchEmployees(config: IntegrationConfig): Promise<HRISEmployee[]> {
    const baseUrl = `https://api.bamboohr.com/api/gateway.php/${config.subdomain || config.company_id}`;
    const response = await fetch(`${baseUrl}/v1/employees/directory`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.api_key_encrypted}:x`).toString("base64")}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`BambooHR API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const employees: HRISEmployee[] = (data.employees || []).map((emp: any) => ({
      external_id: emp.id?.toString() || "",
      first_name: emp.firstName || "",
      last_name: emp.lastName || "",
      email: emp.workEmail || emp.homeEmail || "",
      job_title: emp.jobTitle || undefined,
      department: emp.department || undefined,
      manager_email: emp.supervisor || undefined,
      hire_date: emp.hireDate || undefined,
      status: emp.status === "Active" ? "active" : "inactive",
    }));

    return employees;
  }

  async fetchDepartments(config: IntegrationConfig): Promise<HRISDepartment[]> {
    const baseUrl = `https://api.bamboohr.com/api/gateway.php/${config.subdomain || config.company_id}`;
    const response = await fetch(`${baseUrl}/v1/meta/lists`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.api_key_encrypted}:x`).toString("base64")}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`BambooHR API error: ${response.status}`);
    }

    const data = await response.json();
    const deptList = (data || []).find((list: any) => list.fieldId === 4);
    return (deptList?.options || []).map((opt: any) => ({
      external_id: opt.id?.toString() || "",
      name: opt.name || "",
    }));
  }

  async pushCompletions(config: IntegrationConfig, completions: TrainingCompletion[]): Promise<{ success: boolean; pushed: number }> {
    // BambooHR does not natively support pushing training data via standard API
    // This would use a custom field or training tracking endpoint
    console.warn("BambooHR: pushCompletions not natively supported, skipping");
    return { success: true, pushed: 0 };
  }
}

// ─── Workday Adapter ─────────────────────────────────────────────

export class WorkdayAdapter implements HRISAdapter {
  readonly providerName = "Workday";

  async testConnection(config: IntegrationConfig): Promise<{ success: boolean; message: string }> {
    try {
      // Workday REST API: GET {base_url}/ccx/api/v1/{tenant}/workers?limit=1
      const baseUrl = config.base_url;
      if (!baseUrl) return { success: false, message: "Base URL is required for Workday" };

      const response = await fetch(`${baseUrl}/ccx/api/v1/${config.tenant_id || config.company_id}/workers?limit=1`, {
        headers: {
          Authorization: `Bearer ${config.api_key_encrypted}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        return { success: true, message: "Successfully connected to Workday" };
      }
      return { success: false, message: `Workday returned status ${response.status}` };
    } catch (error) {
      return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  async fetchEmployees(config: IntegrationConfig): Promise<HRISEmployee[]> {
    const baseUrl = config.base_url;
    if (!baseUrl) throw new Error("Base URL is required for Workday");

    const response = await fetch(
      `${baseUrl}/ccx/api/v1/${config.tenant_id || config.company_id}/workers?limit=500`,
      {
        headers: {
          Authorization: `Bearer ${config.api_key_encrypted}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Workday API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return (data.data || []).map((worker: any) => ({
      external_id: worker.id || "",
      first_name: worker.descriptor?.split(" ")[0] || worker.firstName || "",
      last_name: worker.descriptor?.split(" ").slice(1).join(" ") || worker.lastName || "",
      email: worker.primaryWorkEmail || "",
      job_title: worker.businessTitle || undefined,
      department: worker.supervisoryOrganization?.descriptor || undefined,
      hire_date: worker.hireDate || undefined,
      status: worker.status === "Active" ? "active" : "inactive",
    }));
  }

  async fetchDepartments(config: IntegrationConfig): Promise<HRISDepartment[]> {
    const baseUrl = config.base_url;
    if (!baseUrl) throw new Error("Base URL is required for Workday");

    const response = await fetch(
      `${baseUrl}/ccx/api/v1/${config.tenant_id || config.company_id}/supervisoryOrganizations`,
      {
        headers: {
          Authorization: `Bearer ${config.api_key_encrypted}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Workday API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.data || []).map((org: any) => ({
      external_id: org.id || "",
      name: org.descriptor || "",
      parent_id: org.superiorOrganization?.id || undefined,
    }));
  }

  async pushCompletions(config: IntegrationConfig, completions: TrainingCompletion[]): Promise<{ success: boolean; pushed: number }> {
    // Workday Learning API for posting training completions
    console.warn("Workday: pushCompletions stub - implement with Workday Learning API");
    return { success: true, pushed: 0 };
  }
}

// ─── ADP Adapter ─────────────────────────────────────────────────

export class ADPAdapter implements HRISAdapter {
  readonly providerName = "ADP";

  async testConnection(config: IntegrationConfig): Promise<{ success: boolean; message: string }> {
    try {
      // ADP API: GET https://api.adp.com/hr/v2/workers?$top=1
      const baseUrl = config.base_url || "https://api.adp.com";
      const response = await fetch(`${baseUrl}/hr/v2/workers?$top=1`, {
        headers: {
          Authorization: `Bearer ${config.api_key_encrypted}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        return { success: true, message: "Successfully connected to ADP" };
      }
      return { success: false, message: `ADP returned status ${response.status}` };
    } catch (error) {
      return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  async fetchEmployees(config: IntegrationConfig): Promise<HRISEmployee[]> {
    const baseUrl = config.base_url || "https://api.adp.com";
    const response = await fetch(`${baseUrl}/hr/v2/workers?$top=500`, {
      headers: {
        Authorization: `Bearer ${config.api_key_encrypted}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`ADP API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return (data.workers || []).map((worker: any) => {
      const name = worker.person?.legalName || {};
      const email = worker.person?.communication?.emails?.[0]?.emailUri || "";
      return {
        external_id: worker.workerID?.idValue || "",
        first_name: name.givenName || "",
        last_name: name.familyName1 || "",
        email,
        job_title: worker.workerAssignment?.jobTitle || undefined,
        department: worker.workerAssignment?.homeOrganizationalUnits?.find((u: any) => u.typeCode?.codeValue === "Department")?.nameCode?.shortName || undefined,
        hire_date: worker.workerDates?.originalHireDate || undefined,
        status: worker.workerStatus?.statusCode?.codeValue === "Active" ? "active" : "inactive",
      };
    });
  }

  async fetchDepartments(config: IntegrationConfig): Promise<HRISDepartment[]> {
    const baseUrl = config.base_url || "https://api.adp.com";
    const response = await fetch(`${baseUrl}/core/v1/organization-departments`, {
      headers: {
        Authorization: `Bearer ${config.api_key_encrypted}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`ADP API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.organizationDepartments || []).map((dept: any) => ({
      external_id: dept.departmentCode?.codeValue || "",
      name: dept.departmentCode?.shortName || "",
    }));
  }

  async pushCompletions(config: IntegrationConfig, completions: TrainingCompletion[]): Promise<{ success: boolean; pushed: number }> {
    console.warn("ADP: pushCompletions stub - implement with ADP custom events");
    return { success: true, pushed: 0 };
  }
}

// ─── HRIS Sync Engine ────────────────────────────────────────────

const ADAPTERS: Record<string, () => HRISAdapter> = {
  bamboohr: () => new BambooHRAdapter(),
  workday: () => new WorkdayAdapter(),
  adp: () => new ADPAdapter(),
};

export class HRISSync {
  private supabase = createServiceClient();

  getAdapter(provider: string): HRISAdapter {
    const factory = ADAPTERS[provider];
    if (!factory) throw new Error(`Unsupported HRIS provider: ${provider}`);
    return factory();
  }

  async testConnection(integrationId: string): Promise<{ success: boolean; message: string }> {
    const { data: integration, error } = await this.supabase
      .from("external_integrations")
      .select("*")
      .eq("id", integrationId)
      .single();

    if (error || !integration) {
      return { success: false, message: "Integration not found" };
    }

    const adapter = this.getAdapter(integration.provider);
    return adapter.testConnection(integration.config as IntegrationConfig);
  }

  async syncUsers(integrationId: string, syncType: "full" | "incremental" = "full"): Promise<SyncResult> {
    const { data: integration, error: intError } = await this.supabase
      .from("external_integrations")
      .select("*")
      .eq("id", integrationId)
      .single();

    if (intError || !integration) {
      throw new Error("Integration not found");
    }

    // Create sync log entry
    const { data: syncLog } = await this.supabase
      .from("integration_sync_logs")
      .insert({
        integration_id: integrationId,
        sync_type: syncType,
        status: "started",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    const result: SyncResult = {
      records_processed: 0,
      records_created: 0,
      records_updated: 0,
      records_failed: 0,
      errors: [],
    };

    try {
      const adapter = this.getAdapter(integration.provider);
      const config = integration.config as IntegrationConfig;

      // Fetch field mappings
      const { data: mappings } = await this.supabase
        .from("integration_field_mappings")
        .select("*")
        .eq("integration_id", integrationId)
        .eq("is_active", true);

      const employees = await adapter.fetchEmployees(config);
      result.records_processed = employees.length;

      for (const employee of employees) {
        try {
          const userData = this.mapFields(employee, mappings || []);

          // Check if user already exists by email
          const { data: existingUser } = await this.supabase
            .from("users")
            .select("id")
            .eq("email", employee.email)
            .single();

          if (existingUser) {
            // Update existing user
            await this.supabase
              .from("users")
              .update(userData)
              .eq("id", existingUser.id);
            result.records_updated++;
          } else {
            // Create new user
            await this.supabase
              .from("users")
              .insert({ ...userData, email: employee.email });
            result.records_created++;
          }
        } catch (err) {
          result.records_failed++;
          result.errors.push({
            record: employee.email,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      // Update sync log
      const status = result.records_failed > 0
        ? (result.records_created + result.records_updated > 0 ? "partial" : "failed")
        : "completed";

      await this.supabase
        .from("integration_sync_logs")
        .update({
          status,
          records_processed: result.records_processed,
          records_created: result.records_created,
          records_updated: result.records_updated,
          records_failed: result.records_failed,
          errors: result.errors,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLog?.id);

      // Update integration last_sync
      await this.supabase
        .from("external_integrations")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: status,
        })
        .eq("id", integrationId);
    } catch (err) {
      // Mark sync as failed
      if (syncLog?.id) {
        await this.supabase
          .from("integration_sync_logs")
          .update({
            status: "failed",
            errors: [{ error: err instanceof Error ? err.message : "Unknown error" }],
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLog.id);
      }

      await this.supabase
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

  mapFields(
    sourceData: HRISEmployee,
    mappings: FieldMapping[]
  ): Record<string, unknown> {
    const mapped: Record<string, unknown> = {
      first_name: sourceData.first_name,
      last_name: sourceData.last_name,
      email: sourceData.email,
      job_title: sourceData.job_title,
      hire_date: sourceData.hire_date,
      status: sourceData.status || "active",
    };

    // Apply custom field mappings
    for (const mapping of mappings) {
      if (!mapping.is_active) continue;

      const value = this.getNestedValue(sourceData as unknown as Record<string, unknown>, mapping.source_field);
      if (value !== undefined) {
        const transformed = mapping.transform
          ? this.applyTransform(value, mapping.transform)
          : value;
        mapped[mapping.target_field] = transformed;
      }
    }

    return mapped;
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current: any, key) => current?.[key], obj);
  }

  private applyTransform(value: unknown, transform: string): unknown {
    switch (transform) {
      case "lowercase":
        return typeof value === "string" ? value.toLowerCase() : value;
      case "uppercase":
        return typeof value === "string" ? value.toUpperCase() : value;
      case "trim":
        return typeof value === "string" ? value.trim() : value;
      case "boolean":
        return Boolean(value);
      case "string":
        return String(value);
      default:
        return value;
    }
  }
}

export const hrisSync = new HRISSync();
