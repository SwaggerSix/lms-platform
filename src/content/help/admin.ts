import type { HelpManual } from "./types";
import { helpContent } from "@/lib/help-content";

export const adminManual: HelpManual = {
  role: "admin",
  title: "Admin Manual",
  intro:
    "How to configure the platform, manage users and content, automate processes, and run reports across your organization.",
  groups: [
    {
      heading: "Foundations",
      chapters: [
        {
          slug: "dashboard",
          title: "Admin Dashboard",
          summary: helpContent["admin.dashboard"].description,
          pageLink: "/admin/dashboard",
          sections: [
            {
              heading: "Reading the dashboard",
              body:
                helpContent["admin.dashboard"].details +
                "\n\nThe admin dashboard surfaces:\n\n" +
                "- **Active learners** — distinct users who've done anything in the platform recently\n" +
                "- **Enrollments / completions** — the throughput of learning\n" +
                "- **Compliance health** — % of mandatory training current across the org\n" +
                "- **Alerts** — things needing attention (failed integrations, content errors, etc.)",
            },
            {
              heading: "What to check daily / weekly",
              body:
                "- Failed integrations and queued errors (Settings → Audit log)\n" +
                "- Pending approvals routed to admins\n" +
                "- New users that need org/role assignment\n" +
                "- Compliance trend — is the org getting better or worse?",
            },
          ],
          faqs: [
            {
              q: "Why are completion counts different on different pages?",
              a: "Different queries use different definitions (e.g. *completed in last 30 days* vs *completed all-time*). Hover the metric label to see the definition.",
            },
          ],
          related: [
            { label: "Audit Log", chapter: "audit-log" },
            { label: "Settings", chapter: "settings" },
          ],
        },
        {
          slug: "users",
          title: "Managing Users",
          summary: helpContent["admin.users"].description,
          pageLink: "/admin/users",
          sections: [
            {
              heading: "Adding users",
              body:
                helpContent["admin.users"].details +
                "\n\nThree ways to add users:\n\n" +
                "1. **Invite** — type an email; the user receives a sign-up link.\n" +
                "2. **Bulk import** — upload a CSV with columns for name, email, role, organization, manager, department.\n" +
                "3. **HRIS / SCIM provisioning** — if your org connects an identity provider, users sync automatically.\n\n" +
                "Pick the approach that fits the scale: invites for ones, CSV for tens to hundreds, provisioning for ongoing flow.",
            },
            {
              heading: "Roles",
              body:
                "Every user has one of these roles:\n\n" +
                "- **learner** — default. Access to learning, profile, achievements.\n" +
                "- **instructor** — also authors content, runs ILT, grades.\n" +
                "- **manager** — also has Management section access for their direct reports.\n" +
                "- **admin** — also has Administration access across the tenant.\n" +
                "- **super_admin** — also can manage tenants (multi-tenant deployments only).\n\n" +
                "Roles compose: an admin who's also someone's manager will see both the Management and Administration sections.",
            },
            {
              heading: "Suspending or deactivating",
              body:
                "Don't delete users — *deactivate* them. Deactivation preserves their learning record (transcripts, certifications) while revoking access. If you delete a user you lose audit history; this is rarely what you actually want.",
            },
          ],
          faqs: [
            {
              q: "A new hire is missing from the platform.",
              a: "If you use HRIS sync, the new hire may not be picked up yet (most syncs run nightly). For urgent cases, invite them manually — the duplicate will collapse when sync runs.",
            },
            {
              q: "Why can't I change a super_admin's role?",
              a: "Super admins can only be modified by other super admins. This is a guard against accidental privilege loss.",
            },
          ],
          related: [
            { label: "Organizations", chapter: "organizations" },
            { label: "SSO", chapter: "sso" },
            { label: "Audit Log", chapter: "audit-log" },
          ],
        },
        {
          slug: "organizations",
          title: "Organizations",
          summary: helpContent["admin.organizations"].description,
          pageLink: "/admin/organizations",
          sections: [
            {
              heading: "What organizations are for",
              body:
                helpContent["admin.organizations"].details +
                "\n\nOrganizations model your real-world org chart. They're used to:\n\n" +
                "- Scope reports (\"Sales department compliance\")\n" +
                "- Target assignments and nudges (\"everyone in Engineering\")\n" +
                "- Roll up team analytics\n" +
                "- Drive access control on certain content",
            },
            {
              heading: "Hierarchy",
              body:
                "Organizations can nest. *Company → Division → Department → Team* is a common pattern. Set the *parent_id* on each org to build the tree.",
            },
          ],
          faqs: [
            {
              q: "What's the difference between an organization and a tenant?",
              a: "Tenants are *separate platform instances* — isolated users, content, and data. Organizations are *internal structure* within a single tenant. Use tenants for multi-customer or multi-region setups; orgs for internal grouping.",
            },
          ],
          related: [
            { label: "Users", chapter: "users" },
            { label: "Tenants", chapter: "tenants" },
          ],
        },
        {
          slug: "settings",
          title: "Platform Settings",
          summary: helpContent["admin.settings"].description,
          pageLink: "/admin/settings",
          sections: [
            {
              heading: "Settings sections",
              body:
                helpContent["admin.settings"].details +
                "\n\nKey areas under Settings:\n\n" +
                "- **Branding** — logos, colors, login screen.\n" +
                "- **Features** — toggle individual modules (gamification, marketplace, AI chat, etc.).\n" +
                "- **SSO** — connect your identity provider.\n" +
                "- **Integrations** — HRIS, Teams, calendar, payment, etc.\n" +
                "- **xAPI / LRS** — learning record store endpoints.",
            },
            {
              heading: "Change discipline",
              body:
                "Settings affect everyone. Some guardrails:\n\n" +
                "- Use the staging tenant first when available.\n" +
                "- Announce significant changes in advance.\n" +
                "- The audit log records every settings change with the actor and timestamp — use it to confirm what changed when something behaves differently.",
            },
          ],
          faqs: [
            {
              q: "I turned off a feature and users are complaining.",
              a: "Re-enable it from the Features panel. Feature flags take effect immediately for new requests; users may need to refresh.",
            },
          ],
          related: [
            { label: "SSO", chapter: "sso" },
            { label: "Audit Log", chapter: "audit-log" },
          ],
        },
        {
          slug: "sso",
          title: "Single Sign-On (SSO)",
          summary: "Connecting your identity provider to the platform.",
          pageLink: "/admin/settings/sso",
          sections: [
            {
              heading: "What's supported",
              body:
                "The platform supports SAML 2.0 and OIDC out of the box. Common providers: Okta, Microsoft Entra (Azure AD), Google Workspace, OneLogin, Ping.\n\nSCIM provisioning is also supported for automated user lifecycle.",
            },
            {
              heading: "Setting it up",
              body:
                "1. Go to the SSO settings page.\n" +
                "2. Pick your provider type (SAML or OIDC).\n" +
                "3. Copy the platform's metadata into your IdP — the ACS URL, entity ID, and signing certificate.\n" +
                "4. Paste your IdP's metadata back into the platform — issuer URL, signing certificate, optional claims mapping.\n" +
                "5. Use the **Test SSO** button before enabling for everyone.\n" +
                "6. Enable. Choose whether to allow password fallback or force SSO-only.\n\n" +
                "> Lock yourself out by mistake? Disable SSO from the platform's emergency console (separate from the SSO-protected UI). Document this for your team before turning SSO on.",
            },
          ],
          faqs: [
            {
              q: "How do I provision users automatically?",
              a: "Use SCIM. Your IdP pushes user create/update/deactivate events; the platform applies them. Configure the SCIM endpoint URL and bearer token in the SSO settings.",
            },
          ],
          related: [
            { label: "Users", chapter: "users" },
            { label: "Settings", chapter: "settings" },
          ],
        },
        {
          slug: "audit-log",
          title: "Audit Log",
          summary: helpContent["admin.audit-log"].description,
          pageLink: "/admin/audit-log",
          sections: [
            {
              heading: "What's recorded",
              body:
                helpContent["admin.audit-log"].details +
                "\n\nEvery admin-level mutation is logged: who did it, when, from what IP, and what changed. Reads aren't logged by default (volume), but high-sensitivity reads can be opted in.",
            },
            {
              heading: "Searching and exporting",
              body:
                "Filter by actor, action type, date range, or resource. Export to CSV for security and compliance reviews. Long-term retention is configurable per tenant.",
            },
          ],
          faqs: [
            {
              q: "Can audit log entries be deleted?",
              a: "No — the log is append-only. Entries are retained for the configured period and then aged out automatically.",
            },
          ],
          related: [
            { label: "Settings", chapter: "settings" },
          ],
        },
      ],
    },
    {
      heading: "Content",
      chapters: [
        {
          slug: "courses",
          title: "Courses (admin)",
          summary: helpContent["admin.courses"].description,
          pageLink: "/admin/courses",
          sections: [
            {
              heading: "What admins control",
              body:
                helpContent["admin.courses"].details +
                "\n\nAs an admin you have higher-level controls than instructors:\n\n" +
                "- Bulk import / export\n" +
                "- Audience targeting (which roles or orgs see a course)\n" +
                "- Versioning policy\n" +
                "- Archival",
            },
            {
              heading: "AI Course Creator",
              body:
                "The [AI Course Creator](/admin/courses/ai-create) can draft a course from a topic prompt, target audience, and a few constraints. It produces an outline, lessons, and quiz questions — *always review and edit* before publishing.",
            },
          ],
          faqs: [
            {
              q: "When should I version a course vs edit it in place?",
              a: "Minor changes (typo fixes, small clarifications) — edit in place. Significant content changes that would invalidate prior completions — create a new version. Versioning preserves the integrity of past completion records.",
            },
          ],
          related: [
            { label: "Learning Paths", chapter: "paths" },
            { label: "Assessments", chapter: "assessments" },
          ],
        },
        {
          slug: "paths",
          title: "Learning Paths (admin)",
          summary: helpContent["admin.paths"].description,
          pageLink: "/admin/paths",
          sections: [
            {
              heading: "Designing a path",
              body:
                helpContent["admin.paths"].details +
                "\n\nA good path:\n\n" +
                "1. Has a clear outcome (\"by the end you can do X\").\n" +
                "2. Sequences courses from foundational to advanced.\n" +
                "3. Uses prerequisites only where they're real — don't gate without reason.\n" +
                "4. Includes a capstone assessment or certification at the end where it makes sense.",
            },
          ],
          faqs: [
            {
              q: "Can a course be in multiple paths?",
              a: "Yes. The path keeps track of the course; the course doesn't know which paths it's in. Reuse freely.",
            },
          ],
          related: [
            { label: "Courses", chapter: "courses" },
            { label: "Certifications", chapter: "certifications" },
          ],
        },
        {
          slug: "certifications",
          title: "Certifications (admin)",
          summary: helpContent["admin.certifications"].description,
          pageLink: "/admin/certifications",
          sections: [
            {
              heading: "Defining a certification",
              body:
                helpContent["admin.certifications"].details +
                "\n\nA certification is a credential with requirements and a validity period. Requirements can be courses, assessments, ILT sessions, or skill levels — typically a mix.",
            },
            {
              heading: "Renewal",
              body:
                "Set the validity period (e.g. 1 year) and the renewal program. When a learner's cert is about to expire, the platform nudges them; if they complete the renewal program in time, the validity extends without lapsing. If they miss the window, the cert moves to *Expired* and they need to redo the full program.",
            },
          ],
          faqs: [
            {
              q: "Can a cert be permanent (no expiry)?",
              a: "Yes — leave the validity period blank. Common for fundamental credentials; less common for compliance.",
            },
          ],
          related: [
            { label: "Compliance", chapter: "compliance" },
            { label: "Learning Paths", chapter: "paths" },
          ],
        },
        {
          slug: "assessments",
          title: "Assessments (admin)",
          summary: helpContent["admin.assessments"].description,
          pageLink: "/admin/assessments",
          sections: [
            {
              heading: "Question bank",
              body:
                helpContent["admin.assessments"].details +
                "\n\nMaintain a question bank organized by topic and skill. Individual assessments can draw from the bank (random selection) or pin specific questions. Bank-driven assessments make cheating harder because no two learners see the same set.",
            },
          ],
          faqs: [
            {
              q: "Should I auto-grade or hand-grade?",
              a: "Auto-grade for objective questions (multiple choice, exact-match). Hand-grade for essays, applied work, anything requiring judgment. Mix them in one assessment if needed.",
            },
          ],
          related: [
            { label: "Courses", chapter: "courses" },
            { label: "Certifications", chapter: "certifications" },
          ],
        },
        {
          slug: "skills",
          title: "Skills",
          summary: helpContent["admin.skills"].description,
          pageLink: "/admin/skills",
          sections: [
            {
              heading: "Designing the taxonomy",
              body:
                helpContent["admin.skills"].details +
                "\n\nA well-designed skill taxonomy:\n\n" +
                "- Has 3–5 levels (e.g. Novice / Intermediate / Advanced / Expert).\n" +
                "- Groups related skills (Sales / Leadership / Technical / Compliance).\n" +
                "- Avoids over-granularity — *Email composition* is usually too narrow; *Written communication* fits better.\n" +
                "- Maps cleanly to courses and certifications so the platform can recommend gap-closing content.",
            },
          ],
          faqs: [
            {
              q: "Should I start from scratch or use a framework?",
              a: "Most orgs start from an industry framework (e.g. SFIA, ATD competencies) and customize. Pure greenfield taxonomies tend to grow unmanaged.",
            },
          ],
          related: [
            { label: "Courses", chapter: "courses" },
          ],
        },
        {
          slug: "observation-templates",
          title: "Observation Templates",
          summary: helpContent["admin.observations"].description,
          pageLink: "/admin/observations",
          sections: [
            {
              heading: "Building a template",
              body:
                helpContent["admin.observations"].details +
                "\n\nEach template is a checklist of behaviors or skills to evaluate. Items can be:\n\n" +
                "- Checkboxes (did they do this thing or not?)\n" +
                "- 1–5 ratings\n" +
                "- Yes/no questions\n" +
                "- Short text responses\n\n" +
                "Optionally link the template to a course so the observation confirms on-the-job application of training.",
            },
          ],
          faqs: [
            {
              q: "Are observations performance reviews?",
              a: "No — they're a coaching tool. Use them to confirm skills transferred from training to real work. Performance reviews are an HR process and live outside this platform.",
            },
          ],
          related: [
            { label: "Skills", chapter: "skills" },
          ],
        },
      ],
    },
    {
      heading: "Operations",
      chapters: [
        {
          slug: "ilt-sessions",
          title: "ILT Sessions (admin)",
          summary: helpContent["admin.ilt-sessions"].description,
          pageLink: "/admin/ilt-sessions",
          sections: [
            {
              heading: "Scheduling logistics",
              body:
                helpContent["admin.ilt-sessions"].details +
                "\n\nFor each session set: instructor(s), capacity, location or virtual link, prerequisites, waitlist behavior, attendance method.",
            },
          ],
          faqs: [
            {
              q: "Can a session repeat weekly?",
              a: "Create a session series — recurring sessions share a template but each has its own roster.",
            },
          ],
          related: [
            { label: "Courses", chapter: "courses" },
          ],
        },
        {
          slug: "compliance",
          title: "Compliance Programs",
          summary: helpContent["admin.compliance"].description,
          pageLink: "/admin/compliance",
          sections: [
            {
              heading: "Designing a program",
              body:
                helpContent["admin.compliance"].details +
                "\n\nA compliance program ties together:\n\n" +
                "- **Who** — which audience (roles, orgs)\n" +
                "- **What** — courses/certifications required\n" +
                "- **When** — initial due date and renewal cadence\n" +
                "- **Consequences** — what happens if overdue (loss of access, manager escalation, etc.)",
            },
          ],
          faqs: [
            {
              q: "Can compliance be retroactive?",
              a: "Yes — when you publish a program, the platform calculates due dates for existing audience members based on their hire/join date. Be ready for a burst of nudges the first time you launch.",
            },
          ],
          related: [
            { label: "Certifications", chapter: "certifications" },
            { label: "Reports", chapter: "reports" },
          ],
        },
        {
          slug: "approvals",
          title: "Approvals (admin)",
          summary: helpContent["admin.approvals"].description,
          pageLink: "/admin/approvals",
          sections: [
            {
              heading: "Approval flows",
              body:
                helpContent["admin.approvals"].details +
                "\n\nAdmins are at the top of the approval chain. Requests reach you when:\n\n" +
                "- A manager escalates\n" +
                "- The requester has no manager\n" +
                "- The workflow targets admins directly (e.g. high-value purchases)",
            },
          ],
          faqs: [
            {
              q: "Can I route specific types of approval to specific admins?",
              a: "Yes, via [Workflows](/help/admin/workflows). Build conditions on request type and route to the right people.",
            },
          ],
          related: [
            { label: "Workflows", chapter: "workflows" },
          ],
        },
        {
          slug: "workflows",
          title: "Workflows",
          summary: helpContent["admin.workflows"].description,
          pageLink: "/admin/workflows",
          sections: [
            {
              heading: "What workflows are",
              body:
                helpContent["admin.workflows"].details +
                "\n\nWorkflows are visual automations for multi-step processes. After creating a workflow you're taken into the editor where you add:\n\n" +
                "- **Triggers** — what kicks it off (event, schedule, webhook, manual)\n" +
                "- **Conditions** — if/else branches\n" +
                "- **Actions** — send email, enroll user, assign badge, call webhook, etc.\n" +
                "- **Delays** — wait N hours/days\n" +
                "- **Loops** — iterate over a list",
            },
            {
              heading: "Designing reliable workflows",
              body:
                "- Keep workflows focused — one process per workflow.\n" +
                "- Use descriptive step names; future-you will thank you.\n" +
                "- Test on a sample user before activating for everyone.\n" +
                "- Watch the run history for failures and add error handling where needed.",
            },
            {
              heading: "Workflows vs Automation",
              body:
                "Use **Automation** for simple one-trigger-one-action rules (\"when department = Sales, enroll in onboarding\"). Use **Workflows** for anything multi-step, branching, or delayed.",
            },
          ],
          faqs: [
            {
              q: "I created a workflow but can't add conditions or actions.",
              a: "Conditions and actions live inside the **visual editor** at /admin/workflows/{id} — not on the list page. After creating, you're now taken there automatically. From the list, click *Open editor*.",
            },
          ],
          related: [
            { label: "Automation", chapter: "automation" },
          ],
        },
        {
          slug: "automation",
          title: "Enrollment Automation",
          summary: helpContent["admin.automation"].description,
          pageLink: "/admin/automation",
          sections: [
            {
              heading: "When to use automation",
              body:
                helpContent["admin.automation"].details,
            },
            {
              heading: "Building a rule",
              body:
                "1. Click **Create Rule**.\n" +
                "2. Set the trigger — *when this condition becomes true*.\n" +
                "3. Set the action — *do this*.\n" +
                "4. Save and activate.\n\n" +
                "The rule applies going forward. For backfill (apply to existing users), use the **Run on existing audience** option.",
            },
          ],
          faqs: [
            {
              q: "Will automation re-fire if the trigger conditions are met again?",
              a: "By default rules fire once per user. Set the rule to *repeat* if you need recurring behavior (rare).",
            },
          ],
          related: [
            { label: "Workflows", chapter: "workflows" },
          ],
        },
      ],
    },
    {
      heading: "Engagement",
      chapters: [
        {
          slug: "gamification",
          title: "Gamification",
          summary: helpContent["admin.gamification"].description,
          pageLink: "/admin/gamification",
          sections: [
            {
              heading: "What to consider",
              body:
                helpContent["admin.gamification"].details +
                "\n\nGamification works when points and badges line up with behaviors that *genuinely matter* — completing real learning, applying skills on the job, helping peers. It backfires when it rewards game-able behavior (e.g. quickly clicking through lessons).",
            },
          ],
          faqs: [
            {
              q: "Can I turn off gamification for specific teams?",
              a: "Not granularly — it's a tenant-level feature. You can turn it off entirely from Settings → Features.",
            },
          ],
          related: [
            { label: "Settings", chapter: "settings" },
          ],
        },
        {
          slug: "mentorship",
          title: "Mentorship Program",
          summary: helpContent["admin.mentorship"].description,
          pageLink: "/admin/mentorship",
          sections: [
            {
              heading: "Designing your program",
              body:
                helpContent["admin.mentorship"].details +
                "\n\nGood mentorship programs have:\n\n" +
                "- Clear opt-in for both sides\n" +
                "- Match criteria that match real growth needs\n" +
                "- Time expectations stated up front\n" +
                "- Periodic check-ins to keep relationships healthy",
            },
          ],
          faqs: [
            {
              q: "How do I avoid over-matching popular mentors?",
              a: "Set per-mentor capacity caps. The matching algorithm respects them.",
            },
          ],
          related: [
            { label: "Feedback", chapter: "feedback-admin" },
          ],
        },
        {
          slug: "feedback-admin",
          title: "Feedback Admin",
          summary: helpContent["admin.feedback"].description,
          pageLink: "/admin/feedback",
          sections: [
            {
              heading: "Configuring cycles",
              body:
                helpContent["admin.feedback"].details +
                "\n\nFeedback cycles (e.g. quarterly 360s) have a window, a target audience, and templates. Outside of cycles, ad-hoc kudos and coaching are always on.",
            },
          ],
          faqs: [
            {
              q: "Are 360 responses anonymous?",
              a: "Configurable per cycle. Most orgs run 360s anonymously to encourage candor, with admins able to see aggregate themes but not individual responses.",
            },
          ],
          related: [
            { label: "Mentorship", chapter: "mentorship" },
          ],
        },
        {
          slug: "nudges-admin",
          title: "Nudges (admin)",
          summary: helpContent["admin.nudges"].description,
          pageLink: "/admin/nudges",
          sections: [
            {
              heading: "Building campaigns",
              body:
                helpContent["admin.nudges"].details +
                "\n\nNudge campaigns target a group with a sequenced set of messages over time. Keep it light — nudge fatigue is real and counterproductive.",
            },
          ],
          faqs: [
            {
              q: "How do I measure if my nudges are working?",
              a: "Each campaign reports open / click / completion rates. Low click rates usually mean the wording or timing is off; tweak and iterate.",
            },
          ],
          related: [
            { label: "Notifications", chapter: "notifications" },
          ],
        },
        {
          slug: "notifications",
          title: "Notifications",
          summary: helpContent["admin.notifications"].description,
          pageLink: "/admin/notifications",
          sections: [
            {
              heading: "Templates",
              body:
                helpContent["admin.notifications"].details +
                "\n\nEvery system message — *course assigned*, *certification expiring*, *approval needed* — has a template you can customize. Match your org's voice; users tune out generic emails.",
            },
          ],
          faqs: [
            {
              q: "Can I disable a specific notification entirely?",
              a: "Most templates support an Enabled toggle. Critical security and compliance notifications can't be turned off.",
            },
          ],
          related: [
            { label: "Settings", chapter: "settings" },
          ],
        },
      ],
    },
    {
      heading: "Reporting",
      chapters: [
        {
          slug: "reports",
          title: "Reports",
          summary: helpContent["admin.reports"].description,
          pageLink: "/admin/reports",
          sections: [
            {
              heading: "Templates and the custom builder",
              body:
                helpContent["admin.reports"].details +
                "\n\nThe templates cover the common cases (completion, compliance, skill gap, engagement, course effectiveness, learner progress). For anything else, use the custom builder.",
            },
            {
              heading: "View vs download",
              body:
                "After generating a report, the **preview table** appears in-page — no download required. From the preview you can search, sort, paginate, and export to CSV or print/PDF. Recent reports and scheduled run history also support **View** so you don't have to re-download to inspect.",
            },
          ],
          faqs: [
            {
              q: "Can I build a recurring report?",
              a: "Yes — see [Scheduled Reports](/help/admin/scheduled-reports). Pick a template, set a schedule, choose recipients.",
            },
          ],
          related: [
            { label: "Scheduled Reports", chapter: "scheduled-reports" },
          ],
        },
        {
          slug: "scheduled-reports",
          title: "Scheduled Reports",
          summary: helpContent["admin.scheduled-reports"].description,
          pageLink: "/admin/scheduled-reports",
          sections: [
            {
              heading: "Scheduling",
              body:
                helpContent["admin.scheduled-reports"].details +
                "\n\nPick frequency (daily, weekly, monthly), delivery method (email, download, both), and recipients. Run history is preserved for review.",
            },
          ],
          faqs: [
            {
              q: "A scheduled report failed.",
              a: "The run history shows the failure with a reason — usually a data issue (e.g. an org that no longer exists) or a recipient delivery failure. Fix the cause and re-run.",
            },
          ],
          related: [
            { label: "Reports", chapter: "reports" },
          ],
        },
      ],
    },
    {
      heading: "Catalog & Commerce",
      chapters: [
        {
          slug: "knowledge-base-admin",
          title: "Knowledge Base (admin)",
          summary: helpContent["admin.knowledge-base"].description,
          pageLink: "/admin/knowledge-base",
          sections: [
            {
              heading: "Maintaining articles",
              body:
                helpContent["admin.knowledge-base"].details +
                "\n\nKB articles age. Set a review cadence (annual is a good default) and have owners assigned. Old or wrong articles erode trust quickly.",
            },
          ],
          faqs: [
            {
              q: "Should this be a KB article or a course?",
              a: "Reference info that someone dips into when they need an answer — KB. Skill you have to build from scratch — course. Some topics genuinely need both.",
            },
          ],
          related: [],
        },
        {
          slug: "documents-admin",
          title: "Documents (admin)",
          summary: helpContent["admin.documents"].description,
          pageLink: "/admin/documents",
          sections: [
            {
              heading: "Sharing files",
              body:
                helpContent["admin.documents"].details +
                "\n\nDocuments support targeting (specific orgs, roles, individuals), versioning, and *acknowledgement required* — useful for policies you need a paper trail on.",
            },
          ],
          faqs: [],
          related: [],
        },
        {
          slug: "marketplace-admin",
          title: "Marketplace (admin)",
          summary: helpContent["admin.marketplace"].description,
          pageLink: "/admin/marketplace",
          sections: [
            {
              heading: "Curating partners",
              body:
                helpContent["admin.marketplace"].details +
                "\n\nApprove which third-party providers and items appear for which audiences. Quality control matters — Marketplace is where users will judge whether they trust your platform's recommendations.",
            },
          ],
          faqs: [],
          related: [],
        },
        {
          slug: "ecommerce",
          title: "E-Commerce",
          summary: helpContent["admin.ecommerce"].description,
          pageLink: "/admin/ecommerce",
          sections: [
            {
              heading: "Storefront basics",
              body:
                helpContent["admin.ecommerce"].details +
                "\n\nConfigure products, tax rates, coupons, and your payment provider. Test with the provider's sandbox before going live with real charges.",
            },
          ],
          faqs: [],
          related: [],
        },
        {
          slug: "microlearning-admin",
          title: "Microlearning (admin)",
          summary: helpContent["admin.microlearning"].description,
          pageLink: "/admin/microlearning",
          sections: [
            {
              heading: "Authoring micro units",
              body:
                helpContent["admin.microlearning"].details +
                "\n\nKeep units under 10 minutes — that's what makes them *micro*. One concept per unit. Test on your own team before publishing broadly.",
            },
          ],
          faqs: [],
          related: [],
        },
        {
          slug: "evaluations-admin",
          title: "Evaluations (admin)",
          summary: helpContent["admin.evaluations"].description,
          pageLink: "/admin/evaluations",
          sections: [
            {
              heading: "Kirkpatrick levels",
              body:
                helpContent["admin.evaluations"].details +
                "\n\nThe platform supports Levels 1 (reaction), 2 (learning), and 3 (behavior change). Pair Level 3 evaluations with [Observations](/help/admin/observation-templates) for the strongest signal of training impact.",
            },
          ],
          faqs: [],
          related: [
            { label: "Observation Templates", chapter: "observation-templates" },
          ],
        },
      ],
    },
  ],
};
