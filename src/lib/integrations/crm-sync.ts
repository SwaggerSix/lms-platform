import { createServiceClient } from "@/lib/supabase/service";

// ─── Types ───────────────────────────────────────────────────────

export interface CRMContact {
  external_id: string;
  first_name: string;
  last_name: string;
  email: string;
  company?: string;
  phone?: string;
  title?: string;
  custom_fields?: Record<string, unknown>;
}

export interface CRMDeal {
  external_id: string;
  name: string;
  amount?: number;
  stage?: string;
  contact_email?: string;
  close_date?: string;
}

export interface TrainingDataPayload {
  contact_email: string;
  course_name: string;
  completion_date: string;
  score?: number;
  certificate_url?: string;
  status: "enrolled" | "in_progress" | "completed" | "expired";
}

export interface IntegrationConfig {
  api_key_encrypted?: string;
  base_url?: string;
  instance_url?: string;
  client_id?: string;
  client_secret_encrypted?: string;
  access_token?: string;
  refresh_token?: string;
  portal_id?: string;
}

export interface SyncResult {
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  errors: Array<{ record?: string; error: string }>;
}

// ─── CRM Adapter Interface ──────────────────────────────────────

export interface CRMAdapter {
  readonly providerName: string;
  testConnection(config: IntegrationConfig): Promise<{ success: boolean; message: string }>;
  fetchContacts(config: IntegrationConfig, limit?: number): Promise<CRMContact[]>;
  fetchDeals(config: IntegrationConfig, limit?: number): Promise<CRMDeal[]>;
  pushTrainingData(config: IntegrationConfig, data: TrainingDataPayload): Promise<{ success: boolean }>;
}

// ─── Salesforce Adapter ─────────────────────────────────────────

export class SalesforceAdapter implements CRMAdapter {
  readonly providerName = "Salesforce";

  async testConnection(config: IntegrationConfig): Promise<{ success: boolean; message: string }> {
    try {
      const instanceUrl = config.instance_url || config.base_url;
      if (!instanceUrl) return { success: false, message: "Instance URL is required" };

      const response = await fetch(`${instanceUrl}/services/data/v59.0/`, {
        headers: {
          Authorization: `Bearer ${config.access_token || config.api_key_encrypted}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        return { success: true, message: "Successfully connected to Salesforce" };
      }
      return { success: false, message: `Salesforce returned status ${response.status}` };
    } catch (error) {
      return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  async fetchContacts(config: IntegrationConfig, limit = 500): Promise<CRMContact[]> {
    const instanceUrl = config.instance_url || config.base_url;
    if (!instanceUrl) throw new Error("Instance URL is required for Salesforce");

    const query = encodeURIComponent(
      `SELECT Id, FirstName, LastName, Email, Account.Name, Phone, Title FROM Contact WHERE Email != null LIMIT ${limit}`
    );

    const response = await fetch(
      `${instanceUrl}/services/data/v59.0/query?q=${query}`,
      {
        headers: {
          Authorization: `Bearer ${config.access_token || config.api_key_encrypted}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return (data.records || []).map((record: any) => ({
      external_id: record.Id || "",
      first_name: record.FirstName || "",
      last_name: record.LastName || "",
      email: record.Email || "",
      company: record.Account?.Name || undefined,
      phone: record.Phone || undefined,
      title: record.Title || undefined,
    }));
  }

  async fetchDeals(config: IntegrationConfig, limit = 200): Promise<CRMDeal[]> {
    const instanceUrl = config.instance_url || config.base_url;
    if (!instanceUrl) throw new Error("Instance URL is required for Salesforce");

    const query = encodeURIComponent(
      `SELECT Id, Name, Amount, StageName, CloseDate, Contact.Email FROM Opportunity LIMIT ${limit}`
    );

    const response = await fetch(
      `${instanceUrl}/services/data/v59.0/query?q=${query}`,
      {
        headers: {
          Authorization: `Bearer ${config.access_token || config.api_key_encrypted}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Salesforce API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.records || []).map((record: any) => ({
      external_id: record.Id || "",
      name: record.Name || "",
      amount: record.Amount || undefined,
      stage: record.StageName || undefined,
      contact_email: record.Contact?.Email || undefined,
      close_date: record.CloseDate || undefined,
    }));
  }

  async pushTrainingData(config: IntegrationConfig, data: TrainingDataPayload): Promise<{ success: boolean }> {
    const instanceUrl = config.instance_url || config.base_url;
    if (!instanceUrl) throw new Error("Instance URL is required for Salesforce");

    // Push training data as a custom object or Task in Salesforce
    const response = await fetch(
      `${instanceUrl}/services/data/v59.0/sobjects/Task`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.access_token || config.api_key_encrypted}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Subject: `Training: ${data.course_name}`,
          Description: `Status: ${data.status}\nScore: ${data.score || "N/A"}\nCompleted: ${data.completion_date}`,
          Status: data.status === "completed" ? "Completed" : "In Progress",
          ActivityDate: data.completion_date,
          Type: "Training",
        }),
      }
    );

    return { success: response.ok };
  }
}

// ─── HubSpot Adapter ────────────────────────────────────────────

export class HubSpotAdapter implements CRMAdapter {
  readonly providerName = "HubSpot";

  private getHeaders(config: IntegrationConfig) {
    return {
      Authorization: `Bearer ${config.access_token || config.api_key_encrypted}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  async testConnection(config: IntegrationConfig): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
        headers: this.getHeaders(config),
      });

      if (response.ok) {
        return { success: true, message: "Successfully connected to HubSpot" };
      }
      return { success: false, message: `HubSpot returned status ${response.status}` };
    } catch (error) {
      return { success: false, message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}` };
    }
  }

  async fetchContacts(config: IntegrationConfig, limit = 100): Promise<CRMContact[]> {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts?limit=${limit}&properties=firstname,lastname,email,company,phone,jobtitle`,
      { headers: this.getHeaders(config) }
    );

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return (data.results || []).map((contact: any) => ({
      external_id: contact.id || "",
      first_name: contact.properties?.firstname || "",
      last_name: contact.properties?.lastname || "",
      email: contact.properties?.email || "",
      company: contact.properties?.company || undefined,
      phone: contact.properties?.phone || undefined,
      title: contact.properties?.jobtitle || undefined,
    }));
  }

  async fetchDeals(config: IntegrationConfig, limit = 100): Promise<CRMDeal[]> {
    const response = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals?limit=${limit}&properties=dealname,amount,dealstage,closedate`,
      { headers: this.getHeaders(config) }
    );

    if (!response.ok) {
      throw new Error(`HubSpot API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.results || []).map((deal: any) => ({
      external_id: deal.id || "",
      name: deal.properties?.dealname || "",
      amount: deal.properties?.amount ? parseFloat(deal.properties.amount) : undefined,
      stage: deal.properties?.dealstage || undefined,
      close_date: deal.properties?.closedate || undefined,
    }));
  }

  async pushTrainingData(config: IntegrationConfig, data: TrainingDataPayload): Promise<{ success: boolean }> {
    // Search for contact by email first
    const searchResponse = await fetch(
      "https://api.hubapi.com/crm/v3/objects/contacts/search",
      {
        method: "POST",
        headers: this.getHeaders(config),
        body: JSON.stringify({
          filterGroups: [{
            filters: [{
              propertyName: "email",
              operator: "EQ",
              value: data.contact_email,
            }],
          }],
        }),
      }
    );

    if (!searchResponse.ok) return { success: false };

    const searchData = await searchResponse.json();
    const contactId = searchData.results?.[0]?.id;
    if (!contactId) return { success: false };

    // Create a note on the contact
    const noteResponse = await fetch(
      "https://api.hubapi.com/crm/v3/objects/notes",
      {
        method: "POST",
        headers: this.getHeaders(config),
        body: JSON.stringify({
          properties: {
            hs_note_body: `Training Update: ${data.course_name}\nStatus: ${data.status}\nScore: ${data.score || "N/A"}\nDate: ${data.completion_date}`,
            hs_timestamp: new Date(data.completion_date).getTime(),
          },
          associations: [{
            to: { id: contactId },
            types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
          }],
        }),
      }
    );

    return { success: noteResponse.ok };
  }
}

// ─── CRM Sync Engine ────────────────────────────────────────────

const CRM_ADAPTERS: Record<string, () => CRMAdapter> = {
  salesforce: () => new SalesforceAdapter(),
  hubspot: () => new HubSpotAdapter(),
};

export class CRMSync {
  private supabase = createServiceClient();

  getAdapter(provider: string): CRMAdapter {
    const factory = CRM_ADAPTERS[provider];
    if (!factory) throw new Error(`Unsupported CRM provider: ${provider}`);
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

  async syncContacts(integrationId: string): Promise<SyncResult> {
    const { data: integration, error: intError } = await this.supabase
      .from("external_integrations")
      .select("*")
      .eq("id", integrationId)
      .single();

    if (intError || !integration) {
      throw new Error("Integration not found");
    }

    // Create sync log
    const { data: syncLog } = await this.supabase
      .from("integration_sync_logs")
      .insert({
        integration_id: integrationId,
        sync_type: "full",
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
      const contacts = await adapter.fetchContacts(config);

      result.records_processed = contacts.length;

      for (const contact of contacts) {
        try {
          const { data: existingUser } = await this.supabase
            .from("users")
            .select("id")
            .eq("email", contact.email)
            .single();

          const userData = {
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            job_title: contact.title,
          };

          if (existingUser) {
            await this.supabase.from("users").update(userData).eq("id", existingUser.id);
            result.records_updated++;
          } else {
            await this.supabase.from("users").insert(userData);
            result.records_created++;
          }
        } catch (err) {
          result.records_failed++;
          result.errors.push({
            record: contact.email,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

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

      await this.supabase
        .from("external_integrations")
        .update({
          last_sync_at: new Date().toISOString(),
          last_sync_status: status,
        })
        .eq("id", integrationId);
    } catch (err) {
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
      throw err;
    }

    return result;
  }

  async pushTrainingData(integrationId: string, userId: string): Promise<{ success: boolean }> {
    const { data: integration } = await this.supabase
      .from("external_integrations")
      .select("*")
      .eq("id", integrationId)
      .single();

    if (!integration) throw new Error("Integration not found");

    const adapter = this.getAdapter(integration.provider);
    const config = integration.config as IntegrationConfig;

    // Get user and their completions
    const { data: user } = await this.supabase
      .from("users")
      .select("email, first_name, last_name")
      .eq("id", userId)
      .single();

    if (!user) throw new Error("User not found");

    const { data: enrollments } = await this.supabase
      .from("enrollments")
      .select("*, course:courses(title)")
      .eq("user_id", userId)
      .eq("status", "completed");

    for (const enrollment of enrollments || []) {
      await adapter.pushTrainingData(config, {
        contact_email: user.email,
        course_name: (enrollment as any).course?.title || "Unknown Course",
        completion_date: enrollment.completed_at || new Date().toISOString(),
        score: enrollment.progress_percentage || undefined,
        status: "completed",
      });
    }

    return { success: true };
  }
}

export const crmSync = new CRMSync();
