import { authorize } from "@/lib/auth/authorize";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateBody, testConnectionSchema } from "@/lib/validations";
import { HRISSync } from "@/lib/integrations/hris-sync";
import { CRMSync } from "@/lib/integrations/crm-sync";
import type { IntegrationConfig as HRISConfig } from "@/lib/integrations/hris-sync";
import type { IntegrationConfig as CRMConfig } from "@/lib/integrations/crm-sync";

const HRIS_PROVIDERS = ["bamboohr", "workday", "adp"];
const CRM_PROVIDERS = ["salesforce", "hubspot"];

function isPrivateUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol)) return true;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') return true;
    // Check for private IP ranges
    const parts = hostname.split('.').map(Number);
    if (parts.length === 4 && parts.every(p => !isNaN(p))) {
      if (parts[0] === 10) return true;
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
      if (parts[0] === 192 && parts[1] === 168) return true;
      if (parts[0] === 169 && parts[1] === 254) return true;
    }
    return false;
  } catch { return true; }
}

export async function POST(request: NextRequest) {
  const auth = await authorize("admin");
  if (!auth.authorized) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const rl = await rateLimit(`test-connection-${auth.user.id}`, 10, 60000);
  if (!rl.success) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const body = await request.json();
  const validation = validateBody(testConnectionSchema, body);
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

  const { provider, config } = validation.data;

  try {
    let result: { success: boolean; message: string };

    if (HRIS_PROVIDERS.includes(provider)) {
      const sync = new HRISSync();
      const adapter = sync.getAdapter(provider);
      result = await adapter.testConnection(config as HRISConfig);
    } else if (CRM_PROVIDERS.includes(provider)) {
      const sync = new CRMSync();
      const adapter = sync.getAdapter(provider);
      result = await adapter.testConnection(config as CRMConfig);
    } else {
      // Custom webhook - test with a ping
      const webhookUrl = (config as any).base_url || (config as any).webhook_url;
      if (!webhookUrl) {
        return NextResponse.json({ success: false, message: "Webhook URL is required" });
      }
      if (isPrivateUrl(webhookUrl)) {
        return NextResponse.json({ success: false, message: "URL points to a private or internal address" });
      }
      try {
        const resp = await fetch(webhookUrl, { method: "HEAD" });
        result = { success: resp.ok, message: resp.ok ? "Webhook endpoint reachable" : `Returned ${resp.status}` };
      } catch {
        result = { success: false, message: "Webhook endpoint unreachable" };
      }
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: err instanceof Error ? err.message : "Connection test failed",
    });
  }
}
