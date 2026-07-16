# LMS Platform — Multi-Role QA Audit & Recommendations

**Date:** 2026-07-16
**Method:** Live Playwright driving of the running app (read-only) + live Supabase security/performance scans + code-grounded review of authenticated flows, conducted from three user perspectives: a security tester ("hacker"), a Learning & Development manager, and a first-time non-technical user.

---

## How this audit was run (scope & honesty about limits)

The app was booted locally (`next dev`) and driven with Playwright (Chromium). Because the only populated backend is the **live production Supabase project** (545 courses, 498 products, real orders and users), the exercise was deliberately constrained to be **non-destructive**:

- **No accounts were created, no attacks were run against production, and nothing was written.**
- **Live-driven** coverage = the unauthenticated/public surfaces (login, register, password reset, public API endpoints, security headers) plus live-database security/performance scans (Supabase advisors).
- **Code-grounded** coverage = the authenticated dashboards (admin/manager/instructor/learner) and the deeper security surface (API handlers, RLS, tenant isolation). A sandbox couldn't be stood up here (Docker unavailable) and the service-role key needed to drive authenticated pages isn't safely retrievable, so those areas were assessed by reading the actual code and the live database — not by clicking through them.

Every finding below is tagged: **[LIVE]** (observed in a running browser or live DB scan), **[CODE-CONFIRMED]** (the exact vulnerable/deficient code path was read), or **[NEEDS-VERIFICATION]** (strong signal, confirm in a real environment).

A reusable, read-only Playwright harness was added under `scripts/` (`crawl-public.mjs`, `probe-auth-api.mjs`).

> **The single highest-value follow-up:** give this audit a safe **staging environment** (seeded, isolated from production, with a service-role key). That unlocks true end-to-end role-based testing — the authenticated admin/manager/learner journeys and live exploit validation — which is the part that had to be code-reviewed rather than driven here.

---

## Priority summary

| # | Recommendation | Severity | Evidence |
|---|----------------|----------|----------|
| S1 | Verify the Teams bot webhook JWT signature; stop leaking the bot token via attacker-controlled `serviceUrl` | **Critical** | [CODE-CONFIRMED] |
| S2 | Fix PostgREST `.or()` filter injection in the Teams bot (service-role, RLS-bypassing) | **Critical** | [CODE-CONFIRMED] |
| S3 | Add tenant scoping to admin/service-role routes (`users/[id]`, `scheduled-reports`, `xr/content`) | **High** (latent) | [CODE-CONFIRMED] |
| S4 | Lock down public storage buckets that allow listing all files | **High** | [LIVE] |
| S5 | Make rate limiting durable (Redis) + return 401 JSON (not 307 HTML) from protected APIs; add HSTS | **Medium** | [LIVE] |
| S6 | Decide/enforce a registration policy (invite/domain gate); minor: constant-time secret compare, GET-that-mutates | **Medium** | [CODE-CONFIRMED] |
| P1 | Fix broken **Terms/Privacy** links and unbranded **"LearnHub"** auth pages & certificates | **High (trust)** | [LIVE] |
| P2 | Rework first-run experience: `/welcome` content, "Welcome back" for new users, sidebar overload, jargon | **High (adoption)** | [LIVE + CODE] |
| L1 | Per-learner **compliance/expiry** reporting (recert cycles) + remove 500-row report cap | **High** | [CODE-CONFIRMED] |
| L2 | Course **versioning** and version-pinning on completions (audit integrity) | **High** | [CODE-CONFIRMED] |
| L3 | Fill the admin gaps that are currently **stubs/mocks**: bulk CSV import, SCIM v2, notification templates, gamification point-rules | **Medium–High** | [CODE-CONFIRMED] |
| DB1 | Remediate live database performance lints (RLS `initplan`, duplicate policies, unindexed FKs) | **Medium** | [LIVE] |

---

## 1. Security (the "hacker" perspective)

### S1 — Teams bot webhook does not verify the JWT signature → auth bypass + token leak + SSRF  **[CODE-CONFIRMED] · Critical**
`src/app/api/teams/bot/route.ts` — `verifyBotFrameworkToken()` (~L407-476) base64-decodes the JWT payload and checks only `exp`/`nbf`/`iss`/`aud`. It **never verifies the signature** (the code comment says "without signature verification for now"). An attacker can forge a token with the expected `iss`/`aud`/`exp` and pass. The handler then POSTs to `activity.serviceUrl` (attacker-controlled) carrying `Authorization: Bearer <botToken>`, where `botToken` is a real credential minted from `AZURE_CLIENT_SECRET`. Result: the app's Bot Framework token is exfiltrated to any host the attacker names (they can then post as your bot), plus arbitrary-URL SSRF from your server, plus cross-user data disclosure via the enrollment/progress lookups.
*Reachability nuance:* `/api/teams/bot` is CSRF-exempt but **not** in `publicPaths`, so it currently 307-redirects unauthenticated callers to `/login` — meaning the exploit is reachable by **any authenticated LMS user (including a learner)**, not the anonymous public. (This same omission means the real Microsoft caller can't reach the route, so the Teams integration is likely non-functional today.)
**Fix:** verify the token against the Bot Framework JWKS with `jose` (issuer/audience/signature), and allowlist `serviceUrl` against known Bot Framework hosts before attaching the bearer token.

### S2 — PostgREST filter injection via `.or()` string interpolation  **[CODE-CONFIRMED] · Critical**
`src/app/api/teams/bot/route.ts:183` and `:255`:
```
service.from("users").select("id").or(`external_id.eq.${aadObjectId},azure_ad_id.eq.${aadObjectId}`)
```
`aadObjectId` comes from the request body and is interpolated raw into a PostgREST filter executed with the **service-role key (RLS bypassed)**. A crafted value (e.g. `x,role.eq.super_admin`) rewrites the filter to select arbitrary user rows / enumerate accounts.
**Fix:** never interpolate untrusted input into `.or()`. Validate `aadObjectId` as a UUID and use parameterized `.eq()` calls.

### S3 — Cross-tenant IDOR on admin/service-role routes  **[CODE-CONFIRMED] · High (latent today)**
`authorize("admin")` (`src/lib/auth/authorize.ts`) succeeds for **any** client admin with no tenant binding, and several handlers then use the service-role client keyed only on a user-supplied id with **no tenant/org check**:
- `src/app/api/users/[id]/route.ts` (PATCH/DELETE) — a client admin in tenant A can edit/role-change/delete a user in tenant B. (Super-admin targets and role escalation *are* guarded, and fields are whitelisted against mass assignment — good — but the tenant boundary is not enforced.)
- `src/app/api/scheduled-reports/route.ts` — returns/edits/deletes every tenant's scheduled reports; accepts an arbitrary `recipients` list (exfiltrate a report to any email).
- `src/app/api/xr/content/route.ts` (GET) — uses bare `authorize()` (any authenticated user, incl. learner) and lists all `xr_content` across tenants.

*Real-world impact today is limited* because the instance appears effectively single-tenant (`organizations` and `tenant_memberships` are empty in production). But the platform is built for multi-tenancy, and the moment a second client is onboarded this becomes a live cross-customer data breach.
**Fix:** resolve the caller's tenant via `getTenantScope()` and constrain every service-role query by tenant/org — or use the user-scoped (RLS-enforced) client for tenant-bound resources.

### S4 — Public storage buckets allow listing every file  **[LIVE] · High**
Supabase security advisor: public buckets `course-images` and `nudge-images` each have a broad SELECT policy on `storage.objects` that lets any client **list all files** in the bucket (not just fetch a known URL). This exposes more than intended (filenames, volume, potentially unreleased assets).
**Fix:** public buckets don't need a broad SELECT policy for object-URL access — remove the listing policy (keep object read via signed/public URLs).

### S5 — Auth hardening: durable rate limiting, API 401s, HSTS  **[LIVE] · Medium**
- **Rate limiting** exists (login 10/min/IP, register 5/min/IP) but **falls back to in-memory** unless `UPSTASH_REDIS_REST_URL`/`_TOKEN` are set (`src/lib/rate-limit.ts`). On Vercel serverless, in-memory counters are per-instance and reset on cold start, so brute-force protection is effectively bypassable at scale. *Confirm Upstash is configured in production; if not, wire it.* (Good: login error wording is "Invalid email or password" — no user enumeration. **[LIVE]**)
- **Protected APIs 307-redirect to the HTML `/login`** instead of returning `401 JSON` (verified live for `/api/users`, `/api/enrollments`, `/api/admin/lrs`, etc.). API clients get a login page, not an error. Return `401` for `/api/*`.
- **HSTS header is absent** (`[LIVE]` on `/login`; not set in `next.config.ts` or `vercel.json`). Other headers are solid (nonce-based CSP, `X-Frame-Options: DENY`, `nosniff`, referrer-policy, permissions-policy). Add `Strict-Transport-Security`.

### S6 — Registration policy + smaller items  **[CODE-CONFIRMED] · Medium**
- **Open self-registration:** `src/app/api/auth/register/route.ts` creates an `active` `learner` with no invite token, email-domain allowlist, or tenant binding. For a corporate B2B training platform this is likely wrong — anyone can self-provision an account. Decide the intended policy (invite-only or domain-restricted) and enforce it.
- **Non-constant-time secret compare:** `src/app/api/workflows/webhook/[id]/route.ts:44` uses `!==` on the webhook secret (timing side-channel). Use `crypto.timingSafeEqual`. *(Good: Stripe, evaluations, and partner-portal webhooks already do this correctly.)*
- **State-changing GET:** `src/app/api/nudge-swap-link/[token]/route.ts` mutates on `GET`; email link-prefetchers (Outlook SafeLinks) can auto-trigger it. Require a POST/confirmation.
- **Push payloads unencrypted:** `src/app/api/push/send/route.ts` sets `Content-Encoding: aes128gcm` but returns plaintext (no RFC 8291 encryption); content is visible to the push relay. Use a vetted web-push library.

**Reviewed and found sound (not issues):** enrollment/observation/certificate routes have correct ownership checks; Stripe/SurveyCraft/partner-portal webhooks use timing-safe HMAC; all `dangerouslySetInnerHTML` sinks are DOMPurify-sanitized; embed/iframe URLs are http(s)-restricted; the "view-as" read-only guard has no server-action bypass (no `"use server"` actions exist).

---

## 2. First-time user (the "never used an LMS" perspective)

*Grounded in live screenshots (`login`, `register`, `forgot-password`) and code review of the onboarding/learner surfaces.*

### P1 — Trust & branding gaps at the front door  **[LIVE] · High**
- **Broken Terms/Privacy links.** Both are linked in the login and register footers but **bounce logged-out users back to `/login`** (they're missing from middleware `publicPaths`). A cautious newcomer clicking "what am I agreeing to?" hits a wall — reads as broken or evasive, and registration asserts agreement to Terms. **Fix:** make `/terms` and `/privacy` public (they're pre-account pages by nature).
- **Unbranded "LearnHub."** The auth pages hardcode "LearnHub" and a generic graduation-cap logo (`src/app/(auth)/login/page.tsx:128`), and **certificates hardcode `company_name: "LearnHub"`** (`src/app/api/certificates/generate/route.ts:144`) — even though the sidebar already supports per-tenant branding and your storefronts are "gothamCulture Training" / "Gotham Government Services Training." An invited employee sees an unfamiliar brand and earns certificates that say the wrong company. **Fix:** apply tenant branding (name/logo) to the auth pages, emails, and certificates.

### P2 — First-run experience assumes you already know what an LMS is  **[LIVE + CODE] · High**
- **No orientation anywhere.** The first screen offers only "LearnHub" + "Start your learning journey today" — no one-line explanation of what the product is or who invited you. **Fix:** add a plain subtitle, e.g. *"Your company's training site — take assigned courses and track what you've finished,"* and surface the inviting org's name.
- **`/welcome` is a password-reset form, not a welcome** (`src/app/(auth)/welcome/page.tsx`), and it redirects logged-out visitors to `/login`. An invitee clicking "Welcome" in an email gets a bare login wall or a context-free password form. **Fix:** route new users through a genuine one-screen intro ("1) Browse the Catalog → 2) Enroll → 3) Track progress") after setting a password.
- **The dashboard greets brand-new users with "Welcome back."** `src/app/(dashboard)/dashboard/dashboard-client.tsx:117` hardcodes "Welcome back" even when the code one line up knows the user has zero activity (`isNewUser`). **Fix:** branch the greeting.
- **Navigation overload + jargon.** A learner sees ~20 sidebar items (`src/components/layout/sidebar.tsx`), a 14-item "Learning" section including undefined terms — "Nudges," "Observations," "360 Feedback," "Microlearning," "Evaluations," "Learning Paths" — all defaulting to on. The two things a newcomer needs (find a course, see my courses) are buried. **Fix:** ship a small default learner nav (Catalog, My Courses, Learning Paths, Certifications) with advanced items behind "More," collapsed until there's activity.
- **Help exists but is hidden from where the jargon lives.** `src/lib/help-content.ts` has genuinely plain-language definitions, but they only appear behind a tiny info icon on page headers — never on the sidebar labels a newcomer reads first. **Fix:** surface those descriptions as sidebar tooltips.
- **Breadcrumbs leak the acronyms the sidebar hid.** Sidebar says "Webinars" but the header breadcrumb maps the route back to "ILT Sessions," and exposes "xAPI / LRS" and "HRIS" (`src/components/layout/header.tsx:40-47`). **Fix:** match breadcrumb labels to sidebar labels; hide platform acronyms from non-admins.
- **Help hub shows a learner every role's manual** (`src/app/(dashboard)/help/page.tsx`) including "Admin" and "Super-Admin." **Fix:** show learners only the Learner guide, others behind an expander.
- **Dead-end empty state:** Learning Paths shows "No learning paths yet" with no definition and no action (`.../learn/paths/paths-client.tsx`). **Fix:** add a one-line definition + a "Browse Catalog" fallback CTA.

**Already welcoming (keep):** plain-language help copy; thoughtful empty states with next-step buttons on My Courses and badges; the register form explains why it asks for timezone; password show/hide toggles; help is one keypress ("?") away.

---

## 3. L&D manager (the "runs corporate training" perspective)

### L1 — Compliance & completion reporting can't answer the audit question  **[CODE-CONFIRMED] · High**
- `generateComplianceReport` (`src/lib/reports/generate.ts`) returns only aggregate completion rates. `compliance_requirements.frequency_months` (recert cycle) is stored but **never used** — there's no per-learner status, no computed next-due/expiry, no "expiring in 30/60/90 days," no overdue roster. The #1 L&D audit question ("show me everyone non-compliant or expiring, by name and date") can't be answered. **Fix:** per-user compliance view joining latest completion to `frequency_months` → compliant/expiring/overdue, filterable, with CSV export.
- **Silent 500-row cap:** `generateCompletionReport` hardcodes `.limit(500)`. Any org above 500 enrollment records gets **silently truncated** exports — dangerous for a compliance certification. **Fix:** paginate/stream exports; at minimum flag truncation.
- No **custom report builder** (six hardcoded report types, filters limited to date + `department`); no **training matrix** (people × required courses/skills with RAG status); no **at-risk learner** report (overdue + inactivity + low progress) even though `generateLearnerProgressReport` computes the raw inputs. These are staples of Docebo/Cornerstone/Workday. **Fix (phased):** add saved custom report definitions, a training-matrix view, and an at-risk report wired into the existing nudge engine.

### L2 — No course versioning / content change history  **[CODE-CONFIRMED] · High**
Lesson edits overwrite in place (`content_blocks`); "versioning" appears only in help text. There's no version snapshot, no "which version did this learner complete," no draft-vs-live for a published course — editing a live course silently changes it under in-progress learners. For regulated training this is an audit-integrity gap. **Fix:** version courses/lessons and pin the completed version on the enrollment record.

### L3 — Several admin capabilities are stubs/mocks, not working features  **[CODE-CONFIRMED] · Medium–High**
Concrete "looks done, isn't" items to prioritize because they erode admin trust:
- **No bulk CSV user import** in the admin UI (a standard onboarding tool). The Add-User modal's "Manager" dropdown is **hardcoded to two names and not wired** into submit (`admin/users/users-client.tsx:800-804`).
- **SCIM is not actually implemented:** `src/app/api/sso/scim/route.ts` only stores a token hash and flips a flag; there is **no SCIM v2 Users/Groups endpoint**, so automated provisioning/deprovisioning doesn't work (the "Test connection" uses `no-cors` and always reports success). SSO login/auto-provision config itself is solid.
- **Notification templates are a no-op** — `handleSaveTemplate()` comments "In a full implementation, this would call a templates API" (`admin/notifications/notifications-client.tsx:235`).
- **Gamification point-rules are decorative** — the UI always renders `fallbackPointRules` and the awarding engine ignores saved rules (`admin/gamification/page.tsx:128`; `src/lib/gamification/awards.ts`). Levels are a hardcoded `points/500` formula; the leaderboard aggregates only the last 500 ledger rows and **isn't tenant-scoped**.
- **Native evaluation templates are created with `questions: []`** — there's no native question-builder, so real survey authoring requires the external SurveyCraft path (`admin/evaluations/evaluations-admin-client.tsx:90`).
- **Microlearning nugget content is authored as raw hand-typed JSON** in a textarea (no structured editor).
- **API keys are generated client-side** with `crypto.randomUUID()` and only the name is sent to the server (`settings-client.tsx:135`) — no real secret/hash pipeline.
- **No custom roles / granular permissions** (fixed 5-role enum) and **no dynamic attribute-based groups** ("groups" = the org hierarchy). Competitors offer both.

**Genuinely strong (keep investing):** block-based lesson authoring with native **SCORM + xAPI/LRS** (rare at mid-market); **AI course/quiz generation** with a guided wizard; well-modeled **drip/prerequisite** sequencing and NASBA CPE levels; **mentorship** (weighted matching + AI re-rank, circles, program-outcomes analytics); **evaluations analytics** (Kirkpatrick L1–L4 + NPS + testimonials); **multi-tenancy** and **white-label branding** (with dark-mode derivation and custom CSS).

---

## 4. Platform hygiene — live database lints  **[LIVE]**

From the Supabase performance advisor on the production project (these bite as data grows):
- **66 `auth_rls_initplan`** — RLS policies call `auth.uid()`/`auth.role()` per row instead of once. Wrap in a scalar subquery: `(select auth.uid())`. Biggest at-scale win.
- **604 `multiple_permissive_policies`** — many tables have overlapping permissive policies for the same role/action; Postgres evaluates them all. Consolidate.
- **76 `unindexed_foreign_keys`** — add covering indexes (slow joins/cascades). **144 `unused_index`** — drop dead indexes (write/storage overhead).

From the security advisor (lower severity):
- **8 tables have RLS enabled but no policy** (`abandoned_carts`, `product_inquiries`, `storefront_redirects`, `volume_discount_tiers`, and the four `mentorship_*` tables). This *fails closed* (no leak), but it means any feature querying these with a user session silently gets **zero rows** — likely a functional bug for mentorship. Add explicit policies (or confirm they're service-role-only by design).
- **6 functions with mutable `search_path`** and **`pg_trgm` in the `public` schema** — set `search_path` and move the extension (hardening).

---

## Suggested sequencing

1. **This week (security):** S1 + S2 (same file — rewrite the Teams bot auth + DB lookup, or disable the route until fixed), S4 (bucket listing). Add S5's HSTS + confirm Upstash.
2. **Before onboarding a second tenant:** S3 (tenant scoping) — currently latent, becomes critical the moment multi-tenancy is live.
3. **Adoption/trust (fast wins):** P1 (public Terms/Privacy, apply branding to auth/certs) and the "Welcome back"/orientation copy in P2.
4. **L&D credibility:** L1 (compliance/expiry + remove the 500 cap) and L2 (versioning) — the audit-facing gaps — then chip away at the L3 stubs.
5. **Ongoing:** DB1 lint remediation as part of normal maintenance.

*The most impactful next step for testing itself is a seeded staging environment so the authenticated role journeys (and live exploit validation) can be driven end-to-end rather than code-reviewed.*
