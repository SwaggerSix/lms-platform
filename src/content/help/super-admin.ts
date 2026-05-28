import type { HelpManual } from "./types";
import { helpContent } from "@/lib/help-content";

export const superAdminManual: HelpManual = {
  role: "super-admin",
  title: "Super Admin Manual",
  intro:
    "Multi-tenant administration, identity federation, platform-wide settings, and the audit/compliance machinery that supports the rest of the org.",
  groups: [
    {
      heading: "Multi-Tenant",
      chapters: [
        {
          slug: "tenants",
          title: "Tenants",
          summary: helpContent["admin.tenants"].description,
          pageLink: "/admin/tenants",
          whoItsFor: "Super admins only",
          sections: [
            {
              heading: "What a tenant is",
              body:
                helpContent["admin.tenants"].details +
                "\n\nA tenant is a fully isolated platform environment: its own users, content, branding, settings, and data. Use tenants when you need to serve multiple separate customers from one deployment, or when you need data isolation between business units that should never see each other.",
            },
            {
              heading: "Creating and configuring a tenant",
              body:
                "1. From [Tenants admin](/admin/tenants) click **New Tenant**.\n" +
                "2. Set the slug (used in the URL), display name, default locale, and timezone.\n" +
                "3. Pick the initial super admin for the tenant.\n" +
                "4. Configure branding, SSO, and features after creation — these all live under the tenant's Settings.\n" +
                "5. Test with a non-production user before announcing the tenant.",
            },
            {
              heading: "Cross-tenant operations",
              body:
                "Most operations stay within a tenant. Cross-tenant operations (e.g. moving a user) are super-admin-only and audit-logged. Avoid them when possible — they're an exception, not a workflow.",
            },
          ],
          faqs: [
            {
              q: "Can I share content between tenants?",
              a: "Not directly — tenants are isolated. The Marketplace is the standard mechanism for sharing across tenants (one tenant publishes, others consume).",
            },
            {
              q: "How do I migrate from one tenant to another?",
              a: "Use the bulk export/import tools per content type. There's no one-click tenant clone — that's deliberate, because it forces you to make explicit choices about what comes along.",
            },
          ],
          related: [
            { label: "Organizations", chapter: "admin/organizations" },
            { label: "Audit Log", chapter: "admin/audit-log" },
          ],
        },
      ],
    },
    {
      heading: "Identity & Security",
      chapters: [
        {
          slug: "sso",
          title: "SSO across tenants",
          summary: "Federation, JIT provisioning, and SCIM at scale.",
          pageLink: "/admin/settings/sso",
          sections: [
            {
              heading: "Per-tenant vs platform identity",
              body:
                "Each tenant has its own SSO configuration. Centralizing identity isn't supported intentionally — tenants are *isolated*. If you operate multiple tenants for the same parent org, configure each independently; cross-tenant SSO is unusual outside specific federation scenarios.",
            },
            {
              heading: "SCIM at scale",
              body:
                "For large deployments, lean on SCIM rather than CSV imports. Set up your IdP to push joiner/mover/leaver events. Monitor SCIM events in the audit log and set alerts on failures — silent SCIM drift causes painful access-control bugs.",
            },
          ],
          faqs: [
            {
              q: "Can a single user belong to multiple tenants?",
              a: "Conceptually no — each user lives in one tenant. The same person could have separate accounts in different tenants (different email aliases, or the same email reused), but those accounts are distinct.",
            },
          ],
          related: [
            { label: "Tenants", chapter: "tenants" },
            { label: "Audit Log", chapter: "audit-log" },
          ],
        },
        {
          slug: "audit-log",
          title: "Platform-wide Audit",
          summary: "Cross-tenant audit visibility for security and compliance reviews.",
          pageLink: "/admin/audit-log",
          sections: [
            {
              heading: "What you can see",
              body:
                "As a super admin, your audit log scope is the whole deployment — every tenant, every action. Filter by tenant + actor + action type to investigate specific events. Use this to satisfy SOC 2 / ISO / regulatory audits.",
            },
            {
              heading: "Retention",
              body:
                "Default retention is 365 days. Extend per-tenant in tenant settings. For regulated industries with longer retention requirements, configure off-platform archival (S3 export or similar) — the audit log isn't designed as an indefinite warehouse.",
            },
          ],
          faqs: [
            {
              q: "Can I export audit data via API?",
              a: "Yes — the audit log has a read-only API endpoint that supports paginated retrieval for off-platform analytics.",
            },
          ],
          related: [
            { label: "Tenants", chapter: "tenants" },
          ],
        },
      ],
    },
    {
      heading: "Platform Operations",
      chapters: [
        {
          slug: "platform-settings",
          title: "Platform Settings",
          summary: "Global feature flags, branding defaults, and operational tunables.",
          pageLink: "/admin/settings",
          sections: [
            {
              heading: "Feature flags",
              body:
                "Feature flags control which modules are available — gamification, marketplace, AI chat, observations, etc. Flags are evaluated per-tenant; a flag turned off at the platform level can't be turned on inside a tenant.\n\nIntroduce new features as platform-flagged-off, then enable per-tenant for pilots.",
            },
            {
              heading: "Operational tunables",
              body:
                "- Notification rate limits\n" +
                "- Default session timeout\n" +
                "- File upload size cap\n" +
                "- AI request budget per tenant\n\n" +
                "These have safe defaults. Change them only with a clear reason.",
            },
          ],
          faqs: [
            {
              q: "I turned a platform feature off; tenant admins are confused.",
              a: "Communicate platform-level changes ahead of time. The audit log will show the change, but tenant admins won't see why a section disappeared from their settings.",
            },
          ],
          related: [
            { label: "Tenants", chapter: "tenants" },
          ],
        },
        {
          slug: "integrations",
          title: "Integrations",
          summary: "HRIS, Teams, calendar, xAPI/LRS, and webhook integrations.",
          sections: [
            {
              heading: "Common integrations",
              body:
                "- **HRIS** — Workday, BambooHR, ADP. Syncs users, orgs, manager relationships, departments.\n" +
                "- **Microsoft Teams** — surfaces notifications and ILT joins inside Teams.\n" +
                "- **Calendar** — bidirectional sync for ILT sessions and mentorship.\n" +
                "- **xAPI / LRS** — pipe learning records to an external Learning Record Store.\n" +
                "- **Webhooks** — outbound events for arbitrary downstream systems.",
            },
            {
              heading: "Reliability practices",
              body:
                "- Monitor each integration in the audit/integration log.\n" +
                "- Set up alerts on failure rate above a threshold.\n" +
                "- Keep secrets in the platform's encrypted store — never in plaintext config.\n" +
                "- When an integration starts failing, isolate the cause: their side, your side, or the network in between.",
            },
          ],
          faqs: [
            {
              q: "Can I write a custom integration?",
              a: "Yes — use the webhook + REST API combo. Outbound webhooks fire on configurable events; the REST API supports the inverse direction. For purpose-built integrations, contact your platform vendor.",
            },
          ],
          related: [
            { label: "Audit Log", chapter: "audit-log" },
          ],
        },
      ],
    },
  ],
};
