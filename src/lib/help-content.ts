/**
 * Centralized in-product help copy.
 * Edit text here to update tooltips and page intros across the app.
 *
 * Each entry has:
 *   - title:       the page heading
 *   - description: one short line shown under the title (always visible)
 *   - details:     longer explanation shown in the `i` info tooltip on hover
 */

export interface HelpEntry {
  title: string;
  description: string;
  details: string;
}

export const helpContent = {
  // ── Learner ────────────────────────────────────────────────────────────
  "learn.observations": {
    title: "My Observations",
    description: "Observations you've conducted and observations of you.",
    details:
      "Observations are structured on-the-job checklists that confirm skills from training are being applied in practice. Use the \"As Observer\" tab to start a new observation of someone (if you're a manager or instructor) and the \"As Subject\" tab to review feedback others have recorded about you. This is a coaching and skill-verification tool — not a formal HR performance review.",
  },
  "learn.my-courses": {
    title: "My Courses",
    description: "Courses you're enrolled in or have completed.",
    details:
      "Every course you've started, been assigned, or finished lives here. Pick up where you left off, view your progress, and revisit completed material at any time.",
  },
  "learn.catalog": {
    title: "Course Catalog",
    description: "Browse and enroll in available courses.",
    details:
      "The catalog shows every course available to you. Use filters to narrow by category, length, or skill. Enrolling adds the course to \"My Courses\" so you can track progress.",
  },
  "learn.paths": {
    title: "Learning Paths",
    description: "Curated sequences of courses that build toward a goal.",
    details:
      "Learning paths group courses into a recommended order. Completing a path usually signals readiness for a role, skill, or certification.",
  },
  "learn.certifications": {
    title: "Certifications",
    description: "Credentials you've earned or can pursue.",
    details:
      "Certifications recognize that you've completed a defined set of training and (optionally) passed an assessment. Each certification has an expiration policy — keep an eye on renewal dates.",
  },
  "learn.ilt-sessions": {
    title: "Webinars",
    description: "Register to attend free webinars on a wide variety of topics.",
    details:
      "This is where learners can register to attend free webinars on a wide variety of topics. Register to reserve a seat; your attendance and completion are recorded automatically.",
  },
  "learn.transcript": {
    title: "Transcript",
    description: "Your complete learning history.",
    details:
      "Your transcript is the official record of everything you've completed: courses, paths, certifications, ILT sessions, and assessments. Export it as a PDF for HR, compliance, or career records.",
  },
  "learn.evaluations": {
    title: "Evaluations",
    description: "Course evaluations and surveys you've been asked to complete.",
    details:
      "After completing certain courses or events, you may be asked to provide feedback. Your responses help instructors and admins improve content.",
  },
  "learn.assessments": {
    title: "Assessments",
    description: "Quizzes, tests, and skill checks assigned to you.",
    details:
      "Assessments measure what you've learned. Some are graded automatically; others are reviewed by an instructor. Results feed your transcript and any related certifications.",
  },
  "learn.recommendations": {
    title: "Recommended for You",
    description: "Personalized course suggestions based on your role and history.",
    details:
      "Recommendations are generated from your role, skill gaps, recently completed content, and what peers in similar roles have found useful.",
  },
  "learn.achievements": {
    title: "Achievements",
    description: "Badges, points, and milestones you've unlocked.",
    details:
      "Achievements are awarded for completing courses, hitting streaks, demonstrating skills, and other progress milestones. They appear on your profile.",
  },
  "learn.feedback": {
    title: "Feedback",
    description: "Peer and manager feedback you've given and received.",
    details:
      "Feedback is lightweight, ongoing recognition or coaching — separate from formal observations. Use it to recognize teammates or share quick developmental notes.",
  },
  "learn.mentorship": {
    title: "Mentorship",
    description: "Your mentorship relationships and requests.",
    details:
      "Find a mentor, accept mentee requests, schedule sessions, and track goals. Mentorship is voluntary and developmental.",
  },
  "learn.microlearning": {
    title: "Microlearning",
    description: "Short, focused lessons you can finish in minutes.",
    details:
      "Bite-sized content designed for quick reinforcement and just-in-time learning. Ideal for refreshers between full courses.",
  },
  "learn.knowledge-base": {
    title: "Knowledge Base",
    description: "Searchable articles, guides, and references.",
    details:
      "Reference material that lives outside of formal courses — how-tos, policies, and quick answers. Use search to jump straight to what you need.",
  },
  "learn.discussions": {
    title: "Discussions",
    description: "Conversations with peers and instructors.",
    details:
      "Threaded discussions tied to courses, topics, or general questions. A good place to ask, answer, and learn alongside others.",
  },
  "learn.chat": {
    title: "AI Learning Assistant",
    description: "Ask questions about your courses and the platform.",
    details:
      "The AI assistant can summarize lessons, answer questions about content you've studied, and help you find resources. It's a supplement to instructors — not a replacement.",
  },
  "learn.messages": {
    title: "Messages",
    description: "Direct messages with instructors, mentors, and peers.",
    details:
      "One-to-one and small-group messaging. Use this for private questions, mentorship check-ins, or coordination outside of public discussions.",
  },
  "learn.marketplace": {
    title: "Marketplace",
    description: "Browse third-party and partner content.",
    details:
      "Courses and learning experiences provided by external partners. Some items are free; others require purchase or admin approval.",
  },
  "learn.nudges": {
    title: "Nudges",
    description: "Gentle reminders to keep your learning on track.",
    details:
      "Nudges are short prompts — \"finish this lesson,\" \"renew this certification,\" \"try this recommendation.\" Dismiss them when handled.",
  },
  "learn.documents": {
    title: "Documents",
    description: "Files and resources shared with you.",
    details:
      "Reference documents, policies, and supplemental materials shared by admins or instructors.",
  },

  // ── Manager ────────────────────────────────────────────────────────────
  "manager.team": {
    title: "My Team",
    description: "People who report to you and their learning status.",
    details:
      "A snapshot of each direct report: assignments, progress, certifications, and overdue items. Drill into a person to assign training or review observations.",
  },
  "manager.assignments": {
    title: "Assignments",
    description: "Training you've assigned to your team.",
    details:
      "Create and track assignments — required courses, paths, or certifications with due dates. See completion rates at a glance.",
  },
  "manager.approvals": {
    title: "Approvals",
    description: "Requests from your team waiting on your decision.",
    details:
      "Time-off from training, course enrollment requests, marketplace purchases, and other workflow items that need your sign-off.",
  },
  "manager.compliance": {
    title: "Team Compliance",
    description: "Required training status across your team.",
    details:
      "Track which team members are current, due soon, or overdue on mandatory training. Send reminders or escalate from here.",
  },
  "manager.skills": {
    title: "Team Skills",
    description: "Skill coverage and gaps across your team.",
    details:
      "View the skills your team members hold and where coverage is thin. Use this to plan training investments and stretch assignments.",
  },
  "manager.analytics": {
    title: "Team Analytics",
    description: "Engagement, completion, and performance trends for your team.",
    details:
      "Trends over time: who's engaged, who's stalled, and how your team compares to org benchmarks. Click any metric to drill into the underlying data.",
  },
  "manager.reports": {
    title: "Team Reports",
    description: "Generate and export reports about your team.",
    details:
      "Build custom reports, schedule recurring exports, and share results with peers or HR.",
  },
  "manager.nudges": {
    title: "Team Nudges",
    description: "Send reminders and encouragement to your team.",
    details:
      "Trigger nudges manually or set up rules — overdue training, expiring certifications, low engagement. Use sparingly to avoid notification fatigue.",
  },

  // ── Profile ────────────────────────────────────────────────────────────
  "profile.index": {
    title: "Profile",
    description: "Your public profile, achievements, and activity.",
    details:
      "What others see when they look you up. Update your bio, photo, and visible skills here.",
  },
  "profile.skills": {
    title: "My Skills",
    description: "Skills you've claimed, demonstrated, or had verified.",
    details:
      "Each skill has a proficiency level and a source — self-reported, verified by assessment, or signed off by a manager. Add new skills as you learn them.",
  },
  "profile.settings": {
    title: "Account Settings",
    description: "Notifications, privacy, language, and login preferences.",
    details:
      "Control how the platform contacts you, what's visible on your profile, and how you sign in. Changes here affect only your account.",
  },

  // ── Shop ───────────────────────────────────────────────────────────────
  "shop.index": {
    title: "Shop",
    description: "Purchase courses, books, and supplemental content.",
    details:
      "Items here may be paid or require manager approval. Anything you purchase is added to your library automatically.",
  },
  "shop.cart": {
    title: "Cart",
    description: "Items you've added but not yet purchased.",
    details:
      "Review quantities, apply coupons, and check out. Some items may need approval before fulfillment.",
  },
  "shop.orders": {
    title: "Orders",
    description: "Your purchase history and receipts.",
    details:
      "Every order you've placed, including status, fulfillment, and downloadable receipts.",
  },

  // ── Dashboard ──────────────────────────────────────────────────────────
  "dashboard.index": {
    title: "Dashboard",
    description: "Your personal overview — what's due, what's next, and what's new.",
    details:
      "A quick read on your active courses, upcoming deadlines, recommendations, and recent activity. Tailored to your role.",
  },

  // ── Admin ──────────────────────────────────────────────────────────────
  "admin.dashboard": {
    title: "Admin Dashboard",
    description: "Platform-wide health and activity at a glance.",
    details:
      "Active learners, enrollments, completions, and key alerts across the whole organization. Drill into any tile for detail.",
  },
  "admin.users": {
    title: "Users",
    description: "Manage user accounts, roles, and access.",
    details:
      "Create, invite, deactivate, and change roles for users. Bulk import is supported via CSV.",
  },
  "admin.organizations": {
    title: "Organizations",
    description: "Departments, business units, and reporting groups.",
    details:
      "Organizational structure used for reporting, assignment targeting, and access control. Reflect your real org chart here.",
  },
  "admin.tenants": {
    title: "Tenants",
    description: "Separate customer or org instances on this platform.",
    details:
      "Each tenant is an isolated environment with its own users, content, and branding. Use tenants for multi-customer or multi-region setups.",
  },
  "admin.courses": {
    title: "Courses",
    description: "Create, edit, and publish course content.",
    details:
      "The full course library. Build new courses, version existing ones, and control who can see what.",
  },
  "admin.paths": {
    title: "Learning Paths",
    description: "Define curated course sequences.",
    details:
      "Group courses into paths with prerequisites and recommended order. Paths can be assigned to roles or individuals.",
  },
  "admin.certifications": {
    title: "Certifications",
    description: "Define credentials and renewal rules.",
    details:
      "Set requirements, validity periods, and renewal logic. Certifications are awarded automatically when requirements are met.",
  },
  "admin.assessments": {
    title: "Assessments",
    description: "Build quizzes, tests, and skill checks.",
    details:
      "Create assessments with multiple question types, scoring rules, and randomization. Tie them to courses, certifications, or skills.",
  },
  "admin.observations": {
    title: "Observation Templates",
    description: "Define the checklists managers and instructors use to observe learners.",
    details:
      "Each template is a set of items (checkboxes, ratings, yes/no, text). Optionally link a template to a course so observations confirm on-the-job application of training.",
  },
  "admin.evaluations": {
    title: "Evaluations",
    description: "Surveys and feedback forms attached to learning events.",
    details:
      "Build Kirkpatrick Level 1/2 evaluations, attach them to courses or events, and review aggregated results.",
  },
  "admin.skills": {
    title: "Skills",
    description: "Define the skill taxonomy used across the platform.",
    details:
      "Skills are the foundation for recommendations, gap analysis, and competency tracking. Group them, set proficiency scales, and tag content with them.",
  },
  "admin.ilt-sessions": {
    title: "ILT Sessions",
    description: "Schedule and manage instructor-led classes.",
    details:
      "Set up sessions (in-person or virtual), assign instructors, manage rosters, and track attendance.",
  },
  "admin.compliance": {
    title: "Compliance",
    description: "Required training programs and audit-ready records.",
    details:
      "Define what's mandatory, who it applies to, and how often it renews. Generate compliance reports for audits.",
  },
  "admin.approvals": {
    title: "Approvals",
    description: "Workflow approvals routed through admins.",
    details:
      "Requests escalated past managers — exceptions, content purchases, role changes, and other items needing admin review.",
  },
  "admin.workflows": {
    title: "Workflows",
    description: "Multi-step automations with branches, conditions, and delays.",
    details:
      "Workflows are visual automations for complex processes — onboarding, offboarding, escalations, anything that needs multiple steps in sequence. Pick a trigger (event, schedule, webhook, or manual), then open the editor to add steps: actions (send email, enroll user, assign badge, call webhook), conditions (if/else branching), delays (wait N hours/days), and loops. After creating a workflow you'll be taken straight to the visual editor — that's where the conditions and actions live, not on the list page. Use Automation instead if you just need a simple \"when X happens, do Y\" rule.",
  },
  "admin.automation": {
    title: "Enrollment Automation",
    description: "Simple if-this-then-that rules for enrollments and badges.",
    details:
      "Automation rules fire one action when a single trigger condition is met — e.g. \"when a user's department becomes Sales, enroll them in the Sales Onboarding path,\" or \"when a course is completed, award the Pro Badge.\" Unlike Workflows, there are no branches, delays, or multi-step sequences. If you need anything more complex than a single trigger → single action, build it as a Workflow instead.",
  },
  "admin.gamification": {
    title: "Gamification",
    description: "Points, badges, levels, and leaderboards.",
    details:
      "Configure how learners earn recognition. Use carefully — gamification works best when tied to genuinely meaningful behaviors.",
  },
  "admin.mentorship": {
    title: "Mentorship Program",
    description: "Match mentors with mentees and track relationships.",
    details:
      "Define mentor pools, matching criteria, and program structure. Monitor relationship health and outcomes.",
  },
  "admin.feedback": {
    title: "Feedback Admin",
    description: "Configure and review peer/manager feedback flows.",
    details:
      "Set up feedback templates, nomination rules, and review aggregated insights.",
  },
  "admin.microlearning": {
    title: "Microlearning Admin",
    description: "Create and manage short-form learning content.",
    details:
      "Author and publish microlearning units — quick lessons that supplement full courses.",
  },
  "admin.marketplace": {
    title: "Marketplace Admin",
    description: "Curate third-party and partner content available to learners.",
    details:
      "Approve providers, set visibility, and control which marketplace items appear for which audiences.",
  },
  "admin.ecommerce": {
    title: "E-Commerce",
    description: "Products, pricing, taxes, and storefront settings.",
    details:
      "Configure paid content, coupons, and storefront behavior. Connects to your payment provider.",
  },
  "admin.knowledge-base": {
    title: "Knowledge Base Admin",
    description: "Author, organize, and publish reference articles.",
    details:
      "Manage the article library, categories, and search behavior. Mark articles as official to surface them prominently.",
  },
  "admin.notifications": {
    title: "Notifications",
    description: "Templates and delivery rules for system messages.",
    details:
      "Customize the wording, channels (email, in-app, push), and frequency of platform-generated messages.",
  },
  "admin.nudges": {
    title: "Nudges Admin",
    description: "Build and target nudge campaigns.",
    details:
      "Design nudges, set targeting rules, and review effectiveness. Avoid over-nudging — diminishing returns set in fast.",
  },
  "admin.reports": {
    title: "Reports",
    description: "Build, save, and share reports across the platform.",
    details:
      "Drag-and-drop report builder with saved views, scheduled delivery, and export to CSV/PDF.",
  },
  "admin.scheduled-reports": {
    title: "Scheduled Reports",
    description: "Reports that run and deliver automatically on a schedule.",
    details:
      "Set frequency (daily, weekly, monthly), recipients, and format. Useful for recurring exec or compliance reporting.",
  },
  "admin.audit-log": {
    title: "Audit Log",
    description: "Immutable record of administrative actions.",
    details:
      "Every meaningful change — who did what, when, and from where. Searchable and exportable for security and compliance reviews.",
  },
  "admin.documents": {
    title: "Documents Admin",
    description: "Manage shared files and reference materials.",
    details:
      "Upload, version, and target documents to specific audiences. Track views and acknowledgements.",
  },
  "admin.settings": {
    title: "Settings",
    description: "Platform-wide configuration.",
    details:
      "Branding, SSO, integrations, xAPI, and other system-level settings. Changes here affect everyone — proceed carefully.",
  },
} as const satisfies Record<string, HelpEntry>;

export type HelpKey = keyof typeof helpContent;

export function getHelp(key: HelpKey): HelpEntry {
  return helpContent[key];
}
