import { createServiceClient } from "@/lib/supabase/service";
import { customTemplate, type EmailTemplate } from "@/lib/email/templates";

/**
 * Wires admin-authored notification_templates into the transactional email
 * path. Each supported /api/email template type maps to a stored template key;
 * when a matching active template exists and all of its {variables} resolve
 * from the send params, its copy overrides the built-in default. Anything
 * missing, inactive, or with an unresolved variable falls back to the default,
 * so end users never see a raw {token}.
 */

const TYPE_TO_KEY: Record<string, string> = {
  enrollment_confirmation: "enrollment_confirmation",
  due_date_reminder: "due_date_reminder",
  course_completion: "completion_congratulations",
};

// CTA button appended under the stored body, per type.
const TYPE_TO_CTA: Record<string, { text: string; urlParam: string }> = {
  enrollment_confirmation: { text: "Start Learning", urlParam: "courseUrl" },
  due_date_reminder: { text: "Continue Course", urlParam: "courseUrl" },
  course_completion: { text: "View Dashboard", urlParam: "dashboardUrl" },
};

/** Expose each param as both camelCase and snake_case tokens. */
function buildVars(params: Record<string, unknown>): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    const str = String(value);
    vars[key] = str;
    vars[key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = str;
  }
  return vars;
}

/** Substitute {token}s; `complete` is false if any token couldn't be resolved. */
function substitute(
  text: string,
  vars: Record<string, string>
): { text: string; complete: boolean } {
  let complete = true;
  const out = text.replace(/\{(\w+)\}/g, (match, token: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, token)) return vars[token];
    complete = false;
    return match;
  });
  return { text: out, complete };
}

export async function storedTemplateOverride(
  type: string,
  params: Record<string, unknown>,
  organizationId: string | null,
  defaultSubject: string
): Promise<EmailTemplate | null> {
  const key = TYPE_TO_KEY[type];
  if (!key) return null;

  try {
    const service = createServiceClient();

    type TemplateRow = { subject: string | null; body: string | null; is_active: boolean };
    let row: TemplateRow | null = null;
    if (organizationId) {
      const { data } = await service
        .from("notification_templates")
        .select("subject, body, is_active")
        .eq("organization_id", organizationId)
        .eq("key", key)
        .maybeSingle();
      if (data) row = data as unknown as TemplateRow;
    }
    if (!row) {
      const { data } = await service
        .from("notification_templates")
        .select("subject, body, is_active")
        .is("organization_id", null)
        .eq("key", key)
        .maybeSingle();
      row = (data as unknown as TemplateRow) ?? null;
    }

    if (!row || row.is_active === false || !row.body) return null;

    const vars = buildVars(params);
    const body = substitute(row.body, vars);
    if (!body.complete) return null;

    let subject = defaultSubject;
    if (row.subject) {
      const s = substitute(row.subject, vars);
      if (!s.complete) return null;
      subject = s.text;
    }

    const cta = TYPE_TO_CTA[type];
    const ctaUrl =
      cta && typeof params[cta.urlParam] === "string"
        ? (params[cta.urlParam] as string)
        : undefined;

    return customTemplate({
      subject,
      bodyText: body.text,
      ctaText: ctaUrl ? cta!.text : undefined,
      ctaUrl,
      portalName: typeof params.portalName === "string" ? params.portalName : undefined,
    });
  } catch (err) {
    // Table missing (pre-migration) or any lookup failure → use the default.
    console.error("Stored template override lookup failed:", err);
    return null;
  }
}
