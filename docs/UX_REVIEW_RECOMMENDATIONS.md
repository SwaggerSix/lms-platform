# LMS Usability & Design Review — Findings and Recommendations

**Date:** July 4, 2026
**Scope:** Full review of the platform's ~100 screens across the learner, manager, instructor, and admin experiences, plus the navigation shell, design system, storefronts, help system, and onboarding.

---

## Executive summary

The platform is functionally very rich — it covers nearly everything a Cornerstone-class LMS does — but the user experience has not kept pace with the feature set. The problems fall into three themes, matching the three questions this review set out to answer:

1. **Usability:** The navigation is overwhelming (admins see ~69 sidebar links; learners see a flat 21-item list), several pages are unreachable or duplicated in the nav, and a number of screens display **placeholder or fabricated data as if it were real** (fake enrollment counts, a hardcoded "7-day streak," fake "Active Sessions"). Some buttons do nothing (transcript exports, course "Analytics" menu item), and some actions look saved but aren't (document acknowledgments never persist).

2. **Information organization:** Many features that belong together are scattered as sibling pages: four separate instructor-led-session pages, five reporting/analytics surfaces, three "browse courses" pages (two of them literally titled "Course Marketplace"), four messaging-like inboxes, and four commerce pages. Consolidating these into a handful of tabbed hubs would cut the nav roughly in half and make the product dramatically easier to learn.

3. **Look and feel:** A complete, well-built component library exists in `src/components/ui/` (buttons, cards, tables, modals, empty states — 24 primitives with good accessibility), **but the pages don't use it.** 126 files hand-roll their own buttons vs. 8 that use the shared one; the Table and EmptyState components have zero adoption. The result is visible drift: 20+ different page-title styles, four different tab designs, three different loading patterns, and a green sidebar leading to indigo pages. The tenant white-label branding system is fully built but wired to nothing — changing a tenant's brand color has no visual effect.

The good news: because the primitives, branding system, help system, and accessibility scaffolding already exist and are high quality, most of the fixes are **adoption and reorganization work, not new construction**. A prioritized roadmap is at the end of this document.

---

## Part 1 — Usability

### 1.1 Fix trust-breaking fake data and dead controls (highest priority)

These are the issues most likely to embarrass the platform in front of a client, because the UI confidently displays numbers that are invented:

| Where | Problem | Reference |
|---|---|---|
| Admin → Courses | `enrolled` and `completionRate` on every course are generated from a hash of the row ID — pure fiction | `src/app/(dashboard)/admin/courses/page.tsx:63-78` |
| Admin dashboard | Stat deltas ("+12.5%") hardcoded | `admin/dashboard/dashboard-client.tsx:52-57` |
| Learner dashboard | "You're on a 7-day learning streak," "+1 this week," recent achievements — all hardcoded | `dashboard/dashboard-client.tsx:59-135` |
| Learner dashboard | Instructor name always renders the literal word "Instructor"; spotlight enrollment counts fabricated | `dashboard/page.tsx:285,327,335` |
| Transcript | "Compliance Complete" always shows 100%; **Export PDF / Export CSV buttons have no click handler** | `learn/transcript/transcript-client.tsx:258-263,338` |
| Profile | Recent Activity and Top Badges hardcoded | `profile/profile-client.tsx:66-80` |
| Settings → Security | "Active Sessions" shows a fake "MacBook Pro in San Francisco"; Revoke does nothing | `profile/settings/settings-client.tsx:86-89,522-527` |
| Admin → Courses row menu | "Analytics" button has no onClick | `admin/courses/courses-client.tsx:611` |
| Achievements | Leaderboard filters (Global/Dept/Month) don't filter | `learn/achievements/achievements-client.tsx:312-326` |
| Messages | Phone / Video / Attach buttons are decorative | `learn/messages/messages-client.tsx` |

**Recommendation:** For each item, either wire it to real data or remove it. A smaller, honest dashboard beats a rich-looking fake one. Removal is a same-day fix; wiring streaks/leaderboards to real events is a follow-on project.

### 1.2 Fix silently-lost user actions

- **Document acknowledgments don't persist.** "I Acknowledge" only updates local state — no API call, no compliance record. For a compliance feature this is a real liability. (`learn/documents/documents-client.tsx:151-157`)
- **Knowledge-base "Was this helpful?"** votes go nowhere. (`learn/knowledge-base/knowledge-base-client.tsx:126,158-184`)
- **Theme and date-format preferences** save but nothing consumes them (there is no dark mode; `formatDate` ignores the preference).
- **Avatar "click to change"** has no file handler. (`profile/settings/settings-client.tsx:299-307`)

### 1.3 Repair the navigation

- **Instructors see every link twice.** Two near-duplicate sidebar sections ("INSTRUCTOR" and "Instructor") both match the instructor role, so My Classes, Certifications, Nudges, Messages, Documents, and Knowledge Base each render twice. Merge into one section. (`src/components/layout/sidebar.tsx:124-153`)
- **The notification bell's "View all" links to `/notifications` — a page that doesn't exist.** Create it or remove the link. (`src/components/layout/header.tsx`)
- **Orphaned pages** exist but appear in no navigation: `/manager/reports`, `/admin/dashboard` (a purpose-built admin overview nobody can reach — the sidebar "Dashboard" sends admins to the learner dashboard), `/admin/classes`, `/admin/notifications`, `/learn/recommendations`, `/admin/ecommerce/coupons`. Each should get a nav home or be folded into another page (Part 2 does the folding).
- **Admins see instructor-persona links** ("My Bio," "My Classes") because the instructor section includes the admin roles. Scope it to instructors.
- **Nav labels don't match page titles** (Approvals → "Enrollment Approvals," Assignments → "Course Assignments," Webinars → a page whose empty state says "ILT sessions"). Pick one name per concept and use it in the nav, the `<h1>`, and the breadcrumb.
- **The nav fails open.** If the feature-flag fetch is slow or errors, all 21+ items render, including features the tenant has disabled. Prefer rendering nothing (or a skeleton) until flags resolve. (`sidebar.tsx:326-329`)

### 1.4 Standardize states: loading, empty, error

- Only 5 of ~40 admin list pages and about a third of learner pages have a route-level `loading.tsx`; only 2 admin routes have `error.tsx`, and no learner *list* page has one — a failed query dumps users on the global error screen.
- The Paths list renders a **blank page** when a tenant has no paths. (`learn/paths/paths-client.tsx:59`)
- The same async list shows a spinner on one page, a pulse skeleton on another, and bare "Loading..." text on a third (58 files use spinners, 19 use pulse animations, 64 use plain text).
- Error handling ranges from shared toasts to `alert()` (`learn/mentorship/mentorship-client.tsx:193`) to silent `console.error`.

**Recommendation:** Adopt one rule — skeleton for initial loads, shared `EmptyState` for no-data, shared toast for operation failures, `error.tsx` on every route group — and apply it mechanically.

### 1.5 Performance and scale hygiene

- Pagination exists on only 5 of ~40 admin lists; most pages `select('*')` with no limit (assessments, skills, compliance, mentorship, knowledge-base, ilt-sessions, automation). These will degrade as data grows.
- Twelve admin client components exceed 1,000 lines each (documents 1,453; storefront manager 1,250; ILT sessions 1,180; automation 1,135...). Splitting them will speed loads and make changes safer.
- `dashboard/page.tsx` logs user email/ID and full payloads to the server console on every render — remove. (`dashboard/page.tsx:57,64,362`)

### 1.6 Accessibility gaps worth closing

The foundation is genuinely good (skip link, focus rings, reduced-motion support, accessible Modal and DropdownMenu). The gaps are in hand-rolled page code, which reinforces the "use the primitives" theme:

- Sortable table headers are clickable `<th>` elements with no keyboard support or `aria-sort` (`learn/transcript/transcript-client.tsx:428-464`).
- Ad-hoc tabs across pages lack `role="tab"`; settings toggles lack `role="switch"`/`aria-checked` (`profile/settings/settings-client.tsx:405-419`).
- Widespread `text-gray-400` on white for meta text is likely below WCAG AA contrast.
- The skills radar SVG has no text alternative (`profile/skills/skills-client.tsx:230-252`).

### 1.7 Mobile

The sidebar drawer is well implemented, but several pages break on small screens: Messages is a fixed two-pane layout with no stacking (`learn/messages/messages-client.tsx:810-812`), Documents has a fixed 288px folder sidebar with no responsive breakpoint, and the transcript's action-button row crowds. Given the PWA investment (install prompt, offline caching), these pages undercut the mobile story.

### 1.8 Onboarding

First run today is: set password → land on the dashboard. There is no tour, no role-aware orientation, and the dashboard has no empty state for brand-new users. The help system is actually excellent (role-based manuals, `?` keyboard search) — a "New here? Start with your manual" card on first dashboard visit would connect the two cheaply.

---

## Part 2 — Consolidate and reorganize

The single highest-leverage change in this review: **collapse scattered sibling pages into tabbed hubs.** This cuts the admin nav from ~40 links to roughly 20 and the learner nav from 23 to roughly 12, without removing any capability.

### 2.1 Admin: one "Sessions" hub instead of four pages

`ilt-sessions` ("Webinars"), `training-events` ("ILT Session Log"), `shared-webinars`, and `classes` (not even in the nav) are four surfaces over the same underlying session data — two of them query the identical `ilt_sessions` table. They currently sit adjacent in the sidebar with overlapping names.

**Recommendation:** One **Sessions** page with tabs: *Upcoming & Manage / Session Log / Shared Webinars / Classes & Invites*. Four nav items become one.

### 2.2 Admin: one "Analytics & Reports" hub instead of five

`reports` (ad-hoc export), `scheduled-reports`, `analytics/predictive`, `evaluations/insights` + `evaluations/reports/[courseId]`, and the orphaned `admin/dashboard` overview are five disconnected reporting surfaces.

**Recommendation:** One **Analytics** area: *Overview* (the currently-unreachable admin dashboard as the landing tab) / *Reports* / *Scheduled* / *At-Risk Learners* / *Evaluations*. Also route admins to this overview from the sidebar "Dashboard" link instead of the learner dashboard.

### 2.3 Admin: one "Commerce" group

`ecommerce`, `ecommerce/coupons`, `storefronts`, and `marketplace` are one mental model (selling and sourcing content) split four ways. Group them under a single **Commerce** section: *Storefronts / Products & Orders / Coupons / Content Providers*.

### 2.4 Admin: one "Feedback & Evaluation" group

`evaluations`, `feedback` (360s), `observations`, and `ratings` are four separate modules that all mean "structured feedback on people and courses." They don't need to merge into one page, but they should be one nav group with a consistent list UI.

### 2.5 Admin: fix the Settings split-brain

The Settings hub renders tabs where some (General, Features, API) are real panels, others (Branding, Integrations, Automation, Audit Log, Error Log) are stub cards that link out to standalone routes, and Email exists **both** inline and as a standalone page. Pick one pattern: make every tab a real panel, or make Settings a simple index of links. (`admin/settings/settings-client.tsx:279-590`)

### 2.6 Learner: one "My Learning" hub

`my-courses`, `transcript`, and the dashboard's Continue Learning + Deadlines sections overlap heavily. Make **My Courses** the hub with tabs: *In Progress / Completed / Transcript*. The transcript's year-grouped record and print/export live in the tab; the dashboard links here instead of re-implementing.

### 2.7 Learner: one course-discovery surface

Three browse experiences exist — `catalog` (internal), `marketplace` (internal + partner), `shop` (paid) — and two of them are literally titled "Course Marketplace." Merge into one **Catalog** with source filters (*Internal / Partner / Store*), or at minimum rename so no two pages share a title. Fold the orphaned `recommendations` page (9 stacked sections duplicating Popular/Trending/Continue Learning) into the catalog as sort presets and a dashboard strip.

### 2.8 Learner: group the four inboxes

`discussions`, `messages`, `chat` (AI assistant), and mentorship messaging are four messaging surfaces with four different UIs. A single **Community** nav group (or one inbox page with tabs) plus one shared thread/card pattern would reduce both nav count and cognitive load.

### 2.9 Learner: merge skills and achievement surfaces

- Profile's skills section and `/profile/skills` (radar, gap table) should be one page — make the radar/gap view a tab on the profile.
- Badges/points/streaks appear on the dashboard, profile, and achievements page with different (partly fake) data. Make Achievements the single source; the other two link into it.
- Certifications render differently on `certifications`, `transcript`, and `profile` — one cert-card component, one data source.

### 2.10 Proposed navigation (after consolidation)

**Learner (12):** Dashboard · My Courses (In Progress/Completed/Transcript) · Catalog (Internal/Partner/Store) · Learning Paths · Sessions & Webinars · Assessments · Achievements & Certifications · Community (Discussions/Messages/AI Chat) · Mentorship · Documents · Knowledge Base · Help

**Admin adds (~12 instead of ~31):** Analytics & Reports · Courses · Learning Paths · Sessions · Assessments & Certifications · People (Users/Orgs/Skills) · Compliance & Approvals · Feedback & Evaluation · Engagement (Gamification/Nudges/Microlearning/Notifications) · Content (Documents/KB) · Commerce · Settings

The sidebar already supports collapsible role-gated sections and feature flags, so this is a reorganization of `navSections` in `src/components/layout/sidebar.tsx` plus route-level tab shells — not a rebuild.

### 2.11 Global search should deep-link

Search results currently link to *sections*, not records — clicking a course result opens the course list, not the course. Wire results to detail routes (`/learn/catalog/[slug]`, etc.). This makes search a real navigation shortcut and softens the large-nav problem immediately. (`src/components/layout/global-search.tsx`, `src/app/api/search/route.ts`)

### 2.12 Consider role switching

Users have exactly one role, so someone who is both a manager and an instructor sees only one persona's nav. If that's a real staffing pattern at gC/GGS clients, add either multi-role support or a persona switcher in the header.

---

## Part 3 — Look and feel

### 3.1 The core problem: a good design system nobody uses

`src/components/ui/` contains 24 well-built primitives (CVA variants, focus traps, keyboard navigation, ARIA). Actual adoption across ~143 pages:

| Primitive | Pages using it | Hand-rolled alternative |
|---|---|---|
| Button | 8 | 126 files with raw `<button>` (860 occurrences) |
| Input | 3 | 87 files with raw `<input>` |
| Table | 0 | 40 raw `<table>` implementations |
| EmptyState | 0 | 31 ad-hoc empty blocks |
| Card | 6 | ~100 inline card patterns |
| PageIntro (page header) | 1 | 20+ distinct `<h1>` styles |

**Recommendation:** Declare the primitives canonical and run a mechanical migration, one primitive at a time (Button first — it's the biggest visible win). Add an ESLint rule or code-review checklist item barring raw `<button>`/`<table>` in `src/app`. Also fix the library's own loose ends first:

- `Skeleton` is broken — it uses `bg-muted`, a token that's never defined, so it renders invisible; it also imports `cn` from the wrong path. (`src/components/ui/skeleton.tsx`)
- Two byte-identical `cn` utilities exist (`src/utils/cn.ts`, `src/lib/utils.ts`) — delete one.

### 3.2 One accent color, defined as a token

Today the sidebar and PWA theme are brand green (`#91C53C`), while nearly every page body uses indigo (699 raw `bg-indigo-*` usages across 112 files), 69 files use off-brand blue, and observations pages use plain blue. The green look survives only because `globals.css` secretly remaps Tailwind's `indigo` palette to brand green — a fragile trick: any developer who "fixes" `bg-indigo-600` to `bg-green-600` silently breaks branding, and blue usages bypass it entirely.

**Recommendation:** Define semantic tokens (`primary`, `accent`, `success`, `warning`, `danger`, `surface`, `muted-foreground`) in the Tailwind v4 `@theme` block, migrate call sites from palette classes to tokens, and retire the indigo remap. This is also the prerequisite for:

### 3.3 Make tenant branding actually work

A complete white-label system exists — branding editor UI, API, presets, a store that writes `--brand-*` CSS variables to the DOM — **and nothing reads those variables.** A tenant changing their primary color sees no change anywhere, including the sidebar the variables were designed for. Once call sites use semantic tokens (3.2), point the tokens at `var(--brand-*)` and the entire white-label feature lights up for client tenants like GGS. (`src/lib/branding.ts`, `src/stores/branding-store.ts`, `src/components/providers/brand-provider.tsx`)

### 3.4 Standardize the page scaffold

Establish one pattern and apply it everywhere:

- **PageHeader:** title (`text-2xl font-bold` — already the de-facto standard in 89 files), optional description, InfoTooltip, and right-aligned actions. Extend the existing `PageIntro`.
- **Tabs:** one component (it exists) replacing the four visual styles currently in use (indigo underline, pills, border-b variants).
- **Tables:** a `DataTable` built on the unused Table primitive, with built-in search, server pagination, sortable accessible headers, and an EmptyState slot. This single component fixes the table drift, the pagination gap, and the `aria-sort` issue across ~40 pages.
- **Icons:** lucide-react only (already 155 files); replace the 57 hand-drawn inline SVGs.
- **Modals:** the shared Modal (which has a proper focus trap) instead of per-page `fixed inset-0` overlays.

### 3.5 Dark mode: decide, don't dangle

There is zero dark-mode support (`dark:` appears nowhere), yet the settings page offers a theme selector that saves and does nothing. Either remove the selector (5 minutes) or implement dark mode after tokenization (3.2 makes it feasible). Recommendation: remove now, revisit after the token migration.

### 3.6 Polish details that lift perceived quality

- Consistent card interaction (one hover/shadow/radius treatment).
- Skeletons that mirror layout for the dashboard, catalog, and list pages instead of spinners.
- Real empty states with a next-step action everywhere (the EmptyState component supports this today).
- Remove the in-development notice learners currently see on Observations (`ObservationDevelopmentNotice`), or gate the feature off for tenants until ready.

---

## Prioritized roadmap

### Phase 1 — Quick wins (days, no redesign)
1. Fix the duplicated instructor sidebar section; remove instructor links from admin nav (`sidebar.tsx:124-153`).
2. Remove or wire every fake-data element and dead button (§1.1) — at minimum remove.
3. Persist document acknowledgments (compliance risk) (§1.2).
4. Fix the broken `/notifications` bell link; route admins to the admin overview dashboard; add `/manager/reports` to the nav.
5. Deep-link global search results (§2.11).
6. Fix the Skeleton primitive and duplicate `cn` utility; remove the dead theme selector.
7. Remove debug logging of user PII (`dashboard/page.tsx`).
8. Align nav labels with page titles (§1.3).

### Phase 2 — Consolidation (1–2 weeks)
9. Sessions hub (4 admin pages → 1) (§2.1).
10. Analytics & Reports hub (5 surfaces → 1) (§2.2).
11. My Learning hub: my-courses + transcript (§2.6); fold recommendations into catalog/dashboard (§2.7).
12. Rename/merge the "Course Marketplace" collision (§2.7); group Commerce (§2.3) and Feedback & Evaluation (§2.4).
13. Settings: one consistent pattern for tabs vs. standalone pages (§2.5).
14. Reorganize `navSections` to the structure in §2.10.

### Phase 3 — Design-system adoption (2–4 weeks, incremental)
15. Semantic color tokens; migrate off the indigo remap and raw palette classes (§3.2).
16. Wire tenant branding variables into the tokens — white-label goes live (§3.3).
17. PageHeader + Tabs + DataTable rollout; Button/Input/EmptyState migration (§3.1, §3.4).
18. Uniform loading/empty/error strategy: `loading.tsx` + `error.tsx` per route group, skeletons on lists (§1.4).
19. Pagination on all admin lists; split the 1,000+ line client components (§1.5).

### Phase 4 — Experience upgrades (ongoing)
20. Mobile passes for Messages, Documents, transcript (§1.7).
21. First-run onboarding touchpoint linking to the (already strong) help manuals (§1.8).
22. Accessibility sweep: sortable headers, tab/switch semantics, contrast, SVG alternatives (§1.6).
23. Community/inbox grouping (§2.8); skills/achievements source-of-truth merges (§2.9).
24. Dark mode and role-switching, if desired, after tokenization (§3.5, §2.12).

---

## Appendix — What's already strong (keep and build on)

- **Component library quality:** Modal and DropdownMenu have proper focus traps, keyboard navigation, and ARIA; Button/Badge/Input are well-structured.
- **Accessibility foundation:** skip link, live region, WCAG-checked focus ring, reduced-motion and forced-colors support, 24px touch targets, print styles.
- **Help system:** role-based manuals with search (`?` shortcut) — better than most commercial LMS help.
- **Mobile navigation shell:** the responsive drawer is correctly implemented (dialog semantics, scroll lock, close-on-navigate).
- **Sidebar infrastructure:** role gating, feature-flag gating, collapsible persisted sections — everything needed for the reorganization in Part 2 already exists.
- **PWA groundwork:** service worker, install prompt, per-course offline caching.
