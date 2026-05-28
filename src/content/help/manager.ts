import type { HelpManual } from "./types";
import { helpContent } from "@/lib/help-content";

export const managerManual: HelpManual = {
  role: "manager",
  title: "Manager Manual",
  intro:
    "Everything you need to develop your team: assignments, approvals, compliance tracking, observations, analytics, and reporting.",
  groups: [
    {
      heading: "Your Team",
      chapters: [
        {
          slug: "team",
          title: "My Team",
          summary: helpContent["manager.team"].description,
          pageLink: "/manager/team",
          whoItsFor: "Managers and admins",
          sections: [
            {
              heading: "What's on this page",
              body:
                helpContent["manager.team"].details +
                "\n\nThe team page is your single pane of glass for everyone who reports to you. From here you can:\n\n" +
                "- See each person's enrollment count, completion rate, and overdue items at a glance\n" +
                "- Drill into an individual to see their full activity history\n" +
                "- Assign training, nudge stale learners, or open an observation\n" +
                "- Spot patterns — e.g. multiple people on your team stalled on the same course",
            },
            {
              heading: "Adding people to your team",
              body:
                "Reporting relationships come from the *manager_id* field on each user. There are two ways to set this:\n\n" +
                "1. **HRIS integration** — if your org connects an HR system, manager assignments sync automatically.\n" +
                "2. **Manual** — an admin can set you as the manager of specific users via the [Users admin page](/admin/users).\n\n" +
                "If you believe someone should be on your team and isn't, ask your platform admin to update the relationship.",
            },
            {
              heading: "Acting on team data",
              body:
                "Common workflows from the team page:\n\n" +
                "- *I see Alice is overdue on compliance* → click her row → assign a nudge or message her.\n" +
                "- *I need everyone trained on the new product* → use [Assignments](/help/manager/assignments) to assign a course to the whole team.\n" +
                "- *Skill gap on my team* → use [Team Skills](/help/manager/team-skills) for the visualization, [Team Analytics](/help/manager/team-analytics) for trends.",
            },
          ],
          faqs: [
            {
              q: "Why am I missing direct reports?",
              a: "Either the manager_id isn't set on those users, or HRIS sync is out of date. Ask your admin to check.",
            },
            {
              q: "Can I see indirect reports (skip-levels)?",
              a: "By default the page shows direct reports only. Admins can configure the platform to show downstream teams; check with your admin if you need this.",
            },
            {
              q: "Can someone be on multiple managers' teams?",
              a: "Each user has one *manager_id*, but matrix relationships can be modeled via organizations or via observation/feedback templates that target a specific person.",
            },
          ],
          related: [
            { label: "Assignments", chapter: "assignments" },
            { label: "Team Compliance", chapter: "team-compliance" },
            { label: "Team Analytics", chapter: "team-analytics" },
          ],
        },
        {
          slug: "assignments",
          title: "Assignments",
          summary: helpContent["manager.assignments"].description,
          pageLink: "/manager/assignments",
          sections: [
            {
              heading: "Creating an assignment",
              body:
                helpContent["manager.assignments"].details +
                "\n\nAn assignment ties learning content to specific people with a due date.\n\n" +
                "1. Click **New Assignment**.\n" +
                "2. Choose what to assign — a course, a learning path, or a certification.\n" +
                "3. Choose who — pick from your team (one, several, or everyone).\n" +
                "4. Set a due date.\n" +
                "5. Optionally write a note explaining *why* — recipients see this in their notification, and engagement is meaningfully higher when the *why* is clear.\n" +
                "6. Save. The platform notifies recipients immediately (unless you scheduled it).",
            },
            {
              heading: "Tracking progress",
              body:
                "Each assignment has a status: *Not Started*, *In Progress*, *Completed*, or *Overdue*. Sorting by status surfaces who needs follow-up.\n\n> Tip: use [Nudges](/help/manager/team-nudges) to remind stragglers rather than messaging them one-by-one. Less friction for you, less pressure on them.",
            },
            {
              heading: "Removing an assignment",
              body:
                "Open the assignment, click *Edit*, and remove specific recipients — or click *Withdraw* to remove it for everyone. The course remains in their history if they made any progress, but it's no longer required.",
            },
          ],
          faqs: [
            {
              q: "Can I assign content to someone outside my team?",
              a: "Only admins can assign across the whole org. Managers are restricted to direct reports (and downstream teams if your admin configured it).",
            },
            {
              q: "What if a course gets updated after I've assigned it?",
              a: "Existing assignees keep their progress and get a *Course updated* note. They can opt to retake the new version. New assignees always start on the latest version.",
            },
            {
              q: "Can I make an assignment recurring?",
              a: "Recurring required training (e.g. annual compliance) is best handled via [Compliance Programs](/help/manager/team-compliance) rather than ad-hoc assignments — recurrence and renewal logic is built in.",
            },
          ],
          related: [
            { label: "My Team", chapter: "team" },
            { label: "Compliance", chapter: "team-compliance" },
            { label: "Nudges", chapter: "team-nudges" },
          ],
        },
        {
          slug: "approvals",
          title: "Approvals",
          summary: helpContent["manager.approvals"].description,
          pageLink: "/manager/approvals",
          sections: [
            {
              heading: "What lands in your queue",
              body:
                helpContent["manager.approvals"].details +
                "\n\nCommon approval types:\n\n" +
                "- **Course enrollment requests** — when a learner asks to take a course that requires approval.\n" +
                "- **Marketplace / shop purchases** — items above your org's threshold or otherwise gated.\n" +
                "- **Time off training** — exception requests when someone needs to skip required training.\n" +
                "- **Custom workflows** — anything your admin has routed through manager approval.",
            },
            {
              heading: "Reviewing an approval",
              body:
                "Each request has context: who, what, when, and why. You can:\n\n" +
                "1. **Approve** — confirms the action and notifies the requester.\n" +
                "2. **Deny** — provide a reason; the requester sees it.\n" +
                "3. **Escalate** — push the decision up to an admin if it's outside your authority.\n\n" +
                "Decisions are logged in the audit log.",
            },
          ],
          faqs: [
            {
              q: "I missed an approval and the requester is blocked.",
              a: "Approvals don't expire by default, so it should still be in your queue. Older requests sort to the top if you set it that way. The requester can also escalate to your manager if you're unresponsive.",
            },
            {
              q: "Can I auto-approve trivial requests?",
              a: "Manager-level auto-approval isn't supported, but an admin can build a [workflow](/help/admin/workflows) that bypasses manager review for low-risk requests.",
            },
          ],
          related: [
            { label: "My Team", chapter: "team" },
          ],
        },
      ],
    },
    {
      heading: "Compliance & Skills",
      chapters: [
        {
          slug: "team-compliance",
          title: "Team Compliance",
          summary: helpContent["manager.compliance"].description,
          pageLink: "/manager/compliance",
          sections: [
            {
              heading: "What compliance means here",
              body:
                helpContent["manager.compliance"].details +
                "\n\nCompliance training is *required* training: safety, ethics, role-specific certifications, regulatory courses. The platform tracks who's current, who's due, and who's overdue across your whole team in one view.",
            },
            {
              heading: "Reading the dashboard",
              body:
                "- **Current** — completed and within validity window.\n" +
                "- **Due soon** — within 30 days of expiration. Send a nudge before it's overdue.\n" +
                "- **Overdue** — past the due date. These often have downstream consequences (system access revoked, etc.) so close them out fast.\n\n" +
                "Click any tile to drill into the specific people and requirements.",
            },
            {
              heading: "Taking action",
              body:
                "1. From any overdue row, click **Send Reminder** to nudge the person.\n" +
                "2. If multiple people are overdue on the same course, send a single batch nudge from the *Bulk actions* menu.\n" +
                "3. For exceptional cases (sick leave, exemption), submit an exception via [Approvals](/help/manager/approvals).",
            },
          ],
          faqs: [
            {
              q: "Why is someone on my team flagged as overdue on a course they finished?",
              a: "Most often the course was retaken under a new requirement (e.g. annual renewal) and the new version isn't done yet. Click the row to see exactly which requirement is open.",
            },
            {
              q: "How are due dates set?",
              a: "By the compliance program in the admin area — typically *N days from hire* or *annually on the anniversary*. Talk to your admin if a date doesn't make sense.",
            },
          ],
          related: [
            { label: "Assignments", chapter: "assignments" },
            { label: "Nudges", chapter: "team-nudges" },
          ],
        },
        {
          slug: "team-skills",
          title: "Team Skills",
          summary: helpContent["manager.skills"].description,
          pageLink: "/manager/skills",
          sections: [
            {
              heading: "What's visualized",
              body:
                helpContent["manager.skills"].details +
                "\n\nThe skills heatmap shows each skill (rows) × each team member (columns) with proficiency level color-coded. It's the fastest way to spot:\n\n" +
                "- **Bus factor** — skills only one person on the team has.\n" +
                "- **Gaps** — skills nobody has that you need.\n" +
                "- **Bench strength** — skills you have surplus capacity in.",
            },
            {
              heading: "Closing gaps",
              body:
                "1. Identify the gap — pick a skill and see who's at low/no proficiency.\n" +
                "2. Find the courses or paths that develop that skill (the platform suggests them).\n" +
                "3. Use [Assignments](/help/manager/assignments) to enroll the right people.\n" +
                "4. Use [Observations](/help/learner/observations) afterward to confirm the training transferred to on-the-job behavior.",
            },
          ],
          faqs: [
            {
              q: "Where do skill levels come from?",
              a: "A mix: self-assessment by the learner, verified by assessment, signed off by a manager (you), or inferred from course completion. Each skill's source is visible on hover.",
            },
            {
              q: "Can I edit someone's skill level directly?",
              a: "If your org gives managers sign-off authority, yes — open the person's profile and use the skills section. Otherwise it has to go through verification.",
            },
          ],
          related: [
            { label: "Assignments", chapter: "assignments" },
            { label: "Observations", chapter: "learner/observations" },
          ],
        },
      ],
    },
    {
      heading: "Insights & Communication",
      chapters: [
        {
          slug: "team-analytics",
          title: "Team Analytics",
          summary: helpContent["manager.analytics"].description,
          pageLink: "/manager/analytics",
          sections: [
            {
              heading: "What you can see",
              body:
                helpContent["manager.analytics"].details +
                "\n\nKey charts:\n\n" +
                "- **Engagement over time** — active learners on your team, week over week.\n" +
                "- **Completion rate** — % of assignments closed on time.\n" +
                "- **Average time-to-complete** — how long courses take from enrollment to completion.\n" +
                "- **Score distribution** — assessment performance.\n" +
                "- **Benchmark vs org** — your team's metrics next to the org average.",
            },
            {
              heading: "Drilling in",
              body:
                "Click any chart to filter to the underlying people and courses. The data updates with each pageload — no stale dashboards.",
            },
          ],
          faqs: [
            {
              q: "Can I export charts?",
              a: "Yes — each chart has a download icon for PNG export, and the underlying data can be exported to CSV from [Team Reports](/help/manager/team-reports).",
            },
          ],
          related: [
            { label: "Team Reports", chapter: "team-reports" },
            { label: "Team Compliance", chapter: "team-compliance" },
          ],
        },
        {
          slug: "team-reports",
          title: "Team Reports",
          summary: helpContent["manager.reports"].description,
          pageLink: "/manager/reports",
          sections: [
            {
              heading: "Building a report",
              body:
                helpContent["manager.reports"].details +
                "\n\n1. Click a report template — Team Progress, Compliance Status, Learning Activity, or Skills Development.\n" +
                "2. Set the date range and any filters.\n" +
                "3. **View** the report in-app, or **Export** to CSV.\n" +
                "4. Save the configuration if it's something you'll re-run.",
            },
          ],
          faqs: [
            {
              q: "Can I schedule a report to email me weekly?",
              a: "Yes — that's [Scheduled Reports](/admin/scheduled-reports), available to admins. Ask your admin to set one up with you as a recipient.",
            },
          ],
          related: [
            { label: "Team Analytics", chapter: "team-analytics" },
          ],
        },
        {
          slug: "team-nudges",
          title: "Team Nudges",
          summary: helpContent["manager.nudges"].description,
          pageLink: "/manager/nudges",
          sections: [
            {
              heading: "When to use a nudge",
              body:
                helpContent["manager.nudges"].details +
                "\n\nGood nudges are:\n\n" +
                "- **Specific** — *finish module 3* beats *do your training*.\n" +
                "- **Timely** — sent when someone has 2 days left, not 2 hours.\n" +
                "- **Light-touch** — a tap on the shoulder, not a reprimand.",
            },
            {
              heading: "Avoiding nudge fatigue",
              body:
                "Too many nudges and people stop reading them. Some guidelines:\n\n" +
                "- Don't nudge the same person more than 1–2 times per week.\n" +
                "- Use compliance dashboards to nudge only those who actually need it.\n" +
                "- If you find yourself nudging constantly, the underlying assignment may be unrealistic — reconsider scope or timeline.",
            },
          ],
          faqs: [
            {
              q: "Can I schedule a nudge for the future?",
              a: "Yes — when creating a nudge, set the *send at* date. Good for end-of-quarter cleanups or pre-deadline reminders.",
            },
          ],
          related: [
            { label: "Team Compliance", chapter: "team-compliance" },
            { label: "Assignments", chapter: "assignments" },
          ],
        },
      ],
    },
  ],
};
