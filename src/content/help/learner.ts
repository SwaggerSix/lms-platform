import type { HelpManual } from "./types";
import { helpContent } from "@/lib/help-content";

/**
 * Learner manual — the largest of the manuals because learners interact with
 * the most surface area of the platform. Each chapter combines the tooltip
 * "details" copy (so it's never out of sync with what's shown in product) with
 * step-by-step instructions and FAQs.
 */
export const learnerManual: HelpManual = {
  role: "learner",
  title: "Learner Manual",
  intro:
    "Everything you need to find courses, complete training, earn certifications, and track your growth on the platform.",
  groups: [
    {
      heading: "Getting Started",
      chapters: [
        {
          slug: "dashboard",
          title: "Your Dashboard",
          summary: helpContent["dashboard.index"].description,
          whoItsFor: "All users",
          pageLink: "/dashboard",
          sections: [
            {
              heading: "What you see here",
              body: helpContent["dashboard.index"].details +
                "\n\nThe dashboard is the home base of your learning experience. It pulls together everything that's relevant *right now* so you don't have to hunt for it across the platform.",
            },
            {
              heading: "Key areas",
              body:
                "- **Continue Learning** — courses you've started but haven't finished. Click any card to jump straight back into the lesson where you left off.\n" +
                "- **Assigned to You** — courses your manager or admin has required you to complete. These usually have a due date; overdue items appear in red.\n" +
                "- **Recommended** — personalized suggestions based on your role, your team, and content peers in similar positions have found useful.\n" +
                "- **Upcoming** — scheduled instructor-led sessions, expiring certifications, deadlines you need to be aware of.\n" +
                "- **Activity & streaks** — a quick read on your recent engagement. Streaks can earn you badges if [Gamification](/help/learner/achievements) is turned on for your org.",
            },
            {
              heading: "Tips for getting the most from it",
              body:
                "1. Visit the dashboard first when you log in — it's optimized to show you the *single most important next action*.\n" +
                "2. If a section is empty, that's usually a signal you've caught up. Use the [Catalog](/help/learner/catalog) to find new content.\n" +
                "3. Hover the small *(i)* icon next to any heading on the platform — every page has a built-in tooltip explaining what it's for.",
            },
          ],
          faqs: [
            {
              q: "Why is my dashboard empty?",
              a: "If you've just been added to the platform, you may not have any assignments or enrollments yet. Try browsing the [Course Catalog](/learn/catalog) to enroll in something, or ask your manager what training is expected for your role.",
            },
            {
              q: "Why does an item say 'Overdue'?",
              a: "Overdue means the assignment's due date has passed and the course isn't marked completed. Open the course right away — most overdue training only takes a few minutes to finish, and your manager and compliance dashboards both track this.",
            },
            {
              q: "How do I customize what shows up on the dashboard?",
              a: "The dashboard layout is determined by your organization's settings. You can't currently rearrange it yourself, but if a whole section is missing (e.g. no Recommended block), check that the feature is enabled in your tenant or ask an admin.",
            },
          ],
          related: [
            { label: "My Courses", chapter: "my-courses" },
            { label: "Recommendations", chapter: "recommendations" },
            { label: "Profile & Settings", chapter: "profile-settings" },
          ],
        },
        {
          slug: "navigation",
          title: "Finding your way around",
          summary: "How the sidebar, header, breadcrumbs, search, and help system fit together.",
          whoItsFor: "All users",
          sections: [
            {
              heading: "The sidebar",
              body:
                "The left-hand sidebar is your main navigation. It's grouped into sections — Learning, Management (managers and admins only), and Administration (admins only). Items you don't have access to are hidden automatically.\n\nClick the chevron at the top-left to collapse the sidebar to icons-only if you want more horizontal space.",
            },
            {
              heading: "The top header",
              body:
                "- **Breadcrumbs** show where you are in the app and let you jump back up the tree.\n" +
                "- **Search (magnifying glass)** searches across courses, paths, knowledge base, and people.\n" +
                "- **Help (the *?* icon)** opens this manual's search. Press `?` on your keyboard from anywhere to open it instantly.\n" +
                "- **Bell** is your notifications inbox.\n" +
                "- **Your initials** opens your profile menu and lets you sign out.",
            },
            {
              heading: "In-page help icons",
              body:
                "On almost every page, the title is followed by a small *(i)* info icon. Hover or click it to see a short explanation of what the page is for. If something on the platform is unclear, look for that icon first — the answer is usually there.",
            },
          ],
          faqs: [
            {
              q: "Why don't I see the Management or Administration sections?",
              a: "Those sections are role-gated. Learners only see the Learning section. If you should have manager or admin access and don't see it, contact your platform admin to update your role.",
            },
            {
              q: "How do I search the platform?",
              a: "Click the magnifying glass icon in the top bar. The platform-wide search looks across courses, learning paths, knowledge base articles, and people. For help content specifically, use the *(?)* icon next to it.",
            },
          ],
          related: [
            { label: "Profile & Settings", chapter: "profile-settings" },
            { label: "Knowledge Base", chapter: "knowledge-base" },
          ],
        },
        {
          slug: "profile-settings",
          title: "Profile & Settings",
          summary: "Your photo, bio, notifications, language, and login preferences.",
          pageLink: "/profile",
          sections: [
            {
              heading: "Your public profile",
              body:
                "Your profile is what other learners, mentors, and managers see when they look you up. " +
                "Open it from the top-right avatar menu, or visit [/profile](/profile). You can:\n\n" +
                "- Upload a photo (most orgs encourage this — it makes peer learning friendlier).\n" +
                "- Add a short bio explaining your role and what you're learning.\n" +
                "- Show off your earned badges, certifications, and verified skills.",
            },
            {
              heading: "Account settings",
              body:
                "Settings live at [/profile/settings](/profile/settings). Key things you control:\n\n" +
                "- **Notifications** — what triggers an email, in-app, or push notification. You can turn down the volume on categories that aren't relevant to you (e.g. mentorship if you don't participate).\n" +
                "- **Privacy** — what shows on your public profile (badges, course history, skills).\n" +
                "- **Language** — the platform supports multiple locales. Changes take effect immediately.\n" +
                "- **Password** — change it any time. If your org uses SSO, password changes go through your identity provider, not here.",
            },
            {
              heading: "Your skills",
              body:
                "Skills you've claimed, demonstrated, or had verified live at [/profile/skills](/profile/skills). " +
                "Each skill has a level and a source — *self-reported*, *verified by assessment*, or *signed off by a manager*. " +
                "Verified skills carry more weight in recommendations and team gap analysis.",
            },
          ],
          faqs: [
            {
              q: "Can I hide my course history from my profile?",
              a: "Yes — in [Profile → Settings → Privacy](/profile/settings) you can choose what's visible on your public profile. Note: certifications and required-training compliance are visible to your manager regardless of privacy settings.",
            },
            {
              q: "I'm getting too many emails. How do I quiet them down?",
              a: "Go to [/profile/settings](/profile/settings) and turn off categories you don't care about. The platform respects your settings on a per-category basis — you don't have to go all-or-nothing.",
            },
            {
              q: "How do I change my password?",
              a: "If you log in with email/password, go to [Profile → Settings](/profile/settings) and use the password change form. If you log in via SSO (Google, Microsoft, Okta, etc.), passwords are managed by your identity provider, not here.",
            },
          ],
          related: [
            { label: "Achievements", chapter: "achievements" },
            { label: "My Skills", href: "/profile/skills" },
          ],
        },
      ],
    },
    {
      heading: "Learning",
      chapters: [
        {
          slug: "catalog",
          title: "Course Catalog",
          summary: helpContent["learn.catalog"].description,
          pageLink: "/learn/catalog",
          sections: [
            {
              heading: "What's in the catalog",
              body:
                helpContent["learn.catalog"].details +
                "\n\nThe catalog shows everything you're eligible to take. Items you don't have access to (e.g. because of role, organization, or feature flags) are hidden automatically.",
            },
            {
              heading: "Browsing and filtering",
              body:
                "Use the search bar at the top to find a specific course by title or keyword. Filters on the left narrow by:\n\n" +
                "- **Category** — sales, leadership, compliance, technical, etc.\n" +
                "- **Length** — quick (under 30 min), short, medium, long.\n" +
                "- **Format** — self-paced, instructor-led, blended, or microlearning.\n" +
                "- **Skill** — courses tagged with a specific competency.",
            },
            {
              heading: "Enrolling in a course",
              body:
                "1. Click any course card to see the full description, syllabus, and prerequisites.\n" +
                "2. Click **Enroll**. For free or auto-approved courses, you'll be enrolled instantly.\n" +
                "3. Some courses are restricted — they may require manager approval or be tied to a specific learning path. The Enroll button will say *Request Approval* in those cases.\n" +
                "4. After enrolling, the course appears under [My Courses](/help/learner/my-courses).",
            },
          ],
          faqs: [
            {
              q: "I can't find a course I know exists. Why?",
              a: "Three common reasons: (1) the course is targeted at a different audience and you're not in it; (2) it's been archived; (3) it's tied to a feature your tenant has turned off. Use the search box first, then ask your admin if it should be available to you.",
            },
            {
              q: "What's the difference between Catalog and My Courses?",
              a: "Catalog shows *all* courses you can enroll in. My Courses shows just the ones you've actually started or been assigned. Think of Catalog as a library and My Courses as your bookshelf.",
            },
            {
              q: "Do I have to finish a course once I start it?",
              a: "Voluntary enrollments — no, you can unenroll any time. Assigned or compliance courses — yes, you're expected to complete them by their due date. Talk to your manager if you can't.",
            },
          ],
          related: [
            { label: "My Courses", chapter: "my-courses" },
            { label: "Learning Paths", chapter: "paths" },
            { label: "Recommendations", chapter: "recommendations" },
          ],
        },
        {
          slug: "my-courses",
          title: "My Courses",
          summary: helpContent["learn.my-courses"].description,
          pageLink: "/learn/my-courses",
          sections: [
            {
              heading: "Overview",
              body: helpContent["learn.my-courses"].details,
            },
            {
              heading: "Tabs and filters",
              body:
                "- **In Progress** — courses you've started but haven't finished. The progress bar shows how far you are.\n" +
                "- **Completed** — courses you've finished. From here you can replay lessons, view your final score, or download a certificate.\n" +
                "- **All** — both, in one list.\n\n" +
                "Sorting defaults to *most recently accessed* so what you're actively working on stays at the top.",
            },
            {
              heading: "Resuming a course",
              body:
                "1. Click the course card.\n" +
                "2. The player opens at the lesson you left off on — your progress is saved automatically as you go.\n" +
                "3. For SCORM/xAPI content, your bookmark, score, and time spent are reported back to the platform when you exit the lesson.",
            },
            {
              heading: "Offline access",
              body:
                "If your tenant has PWA / offline mode enabled, you can download supported lessons for offline viewing. Look for the *Download for offline* icon on a course card. Downloads sync your progress back when you reconnect.",
            },
          ],
          faqs: [
            {
              q: "Why does my progress say 95% even after I finished everything?",
              a: "Some courses include a final assessment that counts toward the last few percent. If progress is stuck at 95%+ after the content is done, check whether there's a quiz, survey, or evaluation you haven't completed.",
            },
            {
              q: "Can I unenroll from a course?",
              a: "Voluntary enrollments — yes, from the course card menu. Assigned or required courses — no, you'd need to ask your manager or admin to remove the assignment.",
            },
            {
              q: "I completed a course but it still shows In Progress.",
              a: "Refresh the page — completion sometimes lags a few seconds behind the player. If it's still wrong after a minute, contact support; the underlying SCORM/xAPI record may not have been received.",
            },
          ],
          related: [
            { label: "Transcript", chapter: "transcript" },
            { label: "Certifications", chapter: "certifications" },
          ],
        },
        {
          slug: "paths",
          title: "Learning Paths",
          summary: helpContent["learn.paths"].description,
          pageLink: "/learn/paths",
          sections: [
            {
              heading: "What is a learning path?",
              body:
                helpContent["learn.paths"].details +
                "\n\nA learning path strings multiple courses together in a recommended sequence — usually building toward a role, a certification, or a competency level. Examples: *New Manager Onboarding*, *Sales Foundations*, *Cybersecurity Awareness*.",
            },
            {
              heading: "How paths work",
              body:
                "- Each path lists its courses in order. Some courses have prerequisites — you can't start course #3 until you finish #1 and #2.\n" +
                "- Your progress through the path is shown as a stepper or progress bar.\n" +
                "- Completing every course in the path completes the path. Most paths also issue a certificate or badge on completion.",
            },
            {
              heading: "Enrolling in a path",
              body:
                "1. Open the path detail page.\n" +
                "2. Click **Enroll in Path**. This enrolls you in the first course (or all courses, depending on how the path is configured).\n" +
                "3. Work through the courses in order. Locked courses unlock as prerequisites are met.\n" +
                "4. The path completes automatically when all required courses are done.",
            },
          ],
          faqs: [
            {
              q: "Can I take courses in a path out of order?",
              a: "Only if the path doesn't enforce prerequisites. Most paths are designed sequentially because earlier courses are foundational. If you want to skip ahead, take the courses individually from the catalog instead of via the path.",
            },
            {
              q: "What happens if a course inside a path is updated mid-way through?",
              a: "Your progress is preserved. You'll see a *Course updated* note and have the option to retake the new version if it materially changed.",
            },
          ],
          related: [
            { label: "Certifications", chapter: "certifications" },
            { label: "Recommendations", chapter: "recommendations" },
          ],
        },
        {
          slug: "certifications",
          title: "Certifications",
          summary: helpContent["learn.certifications"].description,
          pageLink: "/learn/certifications",
          sections: [
            {
              heading: "Your certifications",
              body:
                helpContent["learn.certifications"].details +
                "\n\nThis page lists certifications you've earned, certifications you're working toward, and ones available for you to pursue.",
            },
            {
              heading: "Earning a certification",
              body:
                "Each certification has requirements — typically a combination of courses, assessments, and (sometimes) instructor-led sessions. When you meet *all* requirements, the certification is awarded automatically.\n\nNo manual claim needed: the platform watches your progress and issues the cert the moment you qualify.",
            },
            {
              heading: "Expiration and renewal",
              body:
                "Many certifications have a validity period (e.g. 1 year). When yours is approaching expiry you'll get a nudge in the dashboard and an email. Renewal usually means retaking a refresher course or reassessment, not the whole original program.\n\n> Tip: if you're more than 30 days past expiration, the certification's status changes to *Expired*. You'll need to redo the renewal path to regain it.",
            },
            {
              heading: "Sharing your credentials",
              body:
                "From any earned certification you can:\n\n" +
                "- **Download** a PDF certificate.\n" +
                "- **Share to LinkedIn** with a single click — the platform generates the right add-to-profile link.\n" +
                "- **Copy a verification link** — anyone with the link can verify your credential without logging in to the platform.",
            },
          ],
          faqs: [
            {
              q: "How do I know what I still need to do to earn a certification?",
              a: "Click the certification card. The detail view shows the requirements as a checklist, with each completed item ticked off.",
            },
            {
              q: "Is my certificate recognized outside this platform?",
              a: "That depends on the certification — some are industry-recognized (CompTIA, PMI-affiliated, etc.), others are internal to your organization. The certificate metadata indicates which.",
            },
            {
              q: "What happens when my certification expires?",
              a: "The cert moves to Expired status, you may lose any access tied to it (e.g. a privileged tool), and you'll get reminders to renew. Renewal is usually faster than the original program.",
            },
          ],
          related: [
            { label: "Transcript", chapter: "transcript" },
            { label: "My Skills", href: "/profile/skills" },
          ],
        },
        {
          slug: "ilt-sessions",
          title: "Instructor-Led Sessions (ILT)",
          summary: helpContent["learn.ilt-sessions"].description,
          pageLink: "/learn/ilt-sessions",
          sections: [
            {
              heading: "What ILT means",
              body:
                helpContent["learn.ilt-sessions"].details +
                "\n\nUnlike self-paced courses, ILT sessions are live — taught by a real instructor at a scheduled time, either in person, over video, or hybrid.",
            },
            {
              heading: "Registering for a session",
              body:
                "1. Browse upcoming sessions on the ILT page.\n" +
                "2. Click a session to see details: instructor, location, capacity, prerequisites.\n" +
                "3. Click **Register**. If the session is full, you can join the waitlist — you'll be notified if a seat opens up.\n" +
                "4. Once registered, you'll get an email confirmation and a calendar invite.",
            },
            {
              heading: "Attending",
              body:
                "- **Virtual sessions** — a *Join Session* button appears on the page at the scheduled time.\n" +
                "- **In-person sessions** — show up at the listed location. Attendance is usually taken by the instructor.\n" +
                "- **Blended** — follow the session-specific instructions.\n\n" +
                "Your attendance is recorded automatically once the instructor marks the session complete. ILT sessions can satisfy course or certification requirements just like self-paced content.",
            },
            {
              heading: "Cancellations and reschedules",
              body:
                "If a session is cancelled or moved, you'll get a notification and email. From the session detail page you can also cancel your own registration — please do this if you can't attend so someone on the waitlist can take your spot.",
            },
          ],
          faqs: [
            {
              q: "Can I attend a session I'm not registered for?",
              a: "Generally no — registration controls seat count and attendance tracking. Reach out to the instructor or admin if you want to be added late.",
            },
            {
              q: "I missed a session I registered for. What happens?",
              a: "You'll be marked as *No-show*. If the session was tied to a required course, you'll need to register for another offering. Repeated no-shows may be flagged to your manager.",
            },
            {
              q: "Is the session recorded?",
              a: "Some instructors record sessions and post the video as a follow-up. Check the session detail page after the session for any attached materials.",
            },
          ],
          related: [
            { label: "Catalog", chapter: "catalog" },
            { label: "Transcript", chapter: "transcript" },
          ],
        },
        {
          slug: "transcript",
          title: "Transcript",
          summary: helpContent["learn.transcript"].description,
          pageLink: "/learn/transcript",
          sections: [
            {
              heading: "What's on your transcript",
              body:
                helpContent["learn.transcript"].details +
                "\n\nThis is the official record of *everything* you've completed: courses, paths, certifications, ILT sessions, assessments — all with completion dates, scores, and credentials.",
            },
            {
              heading: "Exporting",
              body:
                "Click **Download as PDF** to get a printable, official transcript. The PDF includes your organization's branding, your name, the export date, and the full completion history.\n\nUse this for:\n\n" +
                "- HR or career conversations\n" +
                "- Compliance audits\n" +
                "- External certifications that require proof of prior training\n" +
                "- Your own records",
            },
            {
              heading: "Filtering and sorting",
              body:
                "Use the controls at the top to filter by date range, type (course / path / ILT / certification), or status. Sort by date completed, score, or alphabetically.",
            },
          ],
          faqs: [
            {
              q: "Something I completed isn't showing on my transcript.",
              a: "Wait a few minutes — completion records can lag slightly. If after 24 hours it's still missing, contact your admin. The most common cause is a SCORM package that didn't post its completion signal correctly.",
            },
            {
              q: "Can I share my transcript externally?",
              a: "Yes — the PDF export is yours to share. Some orgs also support a shareable verification link; ask your admin.",
            },
          ],
          related: [
            { label: "Certifications", chapter: "certifications" },
            { label: "My Courses", chapter: "my-courses" },
          ],
        },
        {
          slug: "assessments",
          title: "Assessments",
          summary: helpContent["learn.assessments"].description,
          sections: [
            {
              heading: "What assessments are",
              body:
                helpContent["learn.assessments"].details +
                "\n\nAssessments are how the platform confirms what you've actually learned. They're often embedded inside courses, but some are standalone — for example, a skill assessment that places you at the right level for a learning path.",
            },
            {
              heading: "Types you'll encounter",
              body:
                "- **Quizzes** — multiple choice, true/false, multi-select. Graded instantly.\n" +
                "- **Written responses** — short answer or essay. May be graded by an instructor.\n" +
                "- **Scenario / case studies** — branching exercises that test judgment.\n" +
                "- **Practical assessments** — uploaded artifacts (code, documents) reviewed by an instructor.",
            },
            {
              heading: "Retries and time limits",
              body:
                "Each assessment has its own rules. Some let you retake until you pass; others have a maximum number of attempts. Time-limited assessments show a countdown — your responses are auto-submitted when time runs out, so save often.\n\n> If the platform crashes or you lose connection mid-assessment, your responses up to the last save are usually preserved. Contact support if you need a retake granted.",
            },
          ],
          faqs: [
            {
              q: "I failed an assessment. Can I retake it?",
              a: "Check the assessment summary screen — it'll tell you how many attempts you have left. If you're out of attempts and the assessment is required for a certification, your manager or admin can grant an exception retry.",
            },
            {
              q: "Why is my essay still showing 'Pending'?",
              a: "Written responses are graded by an instructor and can take a few days. You'll get a notification when grading is complete.",
            },
          ],
          related: [
            { label: "My Courses", chapter: "my-courses" },
            { label: "Certifications", chapter: "certifications" },
          ],
        },
        {
          slug: "evaluations",
          title: "Evaluations",
          summary: helpContent["learn.evaluations"].description,
          pageLink: "/learn/evaluations",
          sections: [
            {
              heading: "What evaluations are for",
              body:
                helpContent["learn.evaluations"].details +
                "\n\nEvaluations are surveys you fill out *about training*. They're not graded — they're feedback for instructors and admins to improve content. They're separate from assessments, which test what you learned.",
            },
            {
              heading: "When you'll see them",
              body:
                "- Immediately after completing a course\n" +
                "- After an ILT session\n" +
                "- A few weeks later, to measure on-the-job impact (Level 3 evaluation)\n\n" +
                "Pending evaluations show up on your dashboard and on this page. Most take 2–5 minutes.",
            },
          ],
          faqs: [
            {
              q: "Are evaluations anonymous?",
              a: "Depends on the evaluation. The form will tell you up-front whether your name is attached or whether responses are anonymized.",
            },
            {
              q: "Do I have to complete an evaluation?",
              a: "It depends on your org. Some require evaluations as part of course completion; others make them optional. The form will indicate either way.",
            },
          ],
          related: [
            { label: "Feedback", chapter: "feedback" },
          ],
        },
      ],
    },
    {
      heading: "Self-directed learning",
      chapters: [
        {
          slug: "recommendations",
          title: "Recommended for You",
          summary: helpContent["learn.recommendations"].description,
          pageLink: "/learn/recommendations",
          sections: [
            {
              heading: "How recommendations work",
              body:
                helpContent["learn.recommendations"].details +
                "\n\nThe platform looks at: your role, your team, what your peers have found valuable, your current skill gaps, and what you've recently completed. It then ranks the catalog and surfaces the top 10–20 results for you.",
            },
            {
              heading: "Refining what you see",
              body:
                "- Click **Not interested** on any card to suppress similar suggestions.\n" +
                "- Use the filters at the top to narrow by topic or duration.\n" +
                "- Mark a skill on your profile as something you're actively developing — recommendations weight it more heavily.",
            },
          ],
          faqs: [
            {
              q: "The recommendations don't feel relevant. Why?",
              a: "The system gets smarter as you give it signal. Fill out your skills, complete a few courses, and mark recommendations as Not Interested when they miss the mark. Within a few weeks results improve.",
            },
          ],
          related: [
            { label: "My Skills", href: "/profile/skills" },
            { label: "Catalog", chapter: "catalog" },
          ],
        },
        {
          slug: "microlearning",
          title: "Microlearning",
          summary: helpContent["learn.microlearning"].description,
          pageLink: "/learn/microlearning",
          sections: [
            {
              heading: "What microlearning is",
              body:
                helpContent["learn.microlearning"].details +
                "\n\nMicrolearning units are 2–10 minute lessons designed to teach one specific thing well. They're great for:\n\n" +
                "- Filling 5 minutes between meetings\n" +
                "- Reinforcing a topic from a longer course\n" +
                "- Just-in-time learning when you need an answer *now*",
            },
            {
              heading: "Daily micro habit",
              body:
                "If your org enables it, the system can suggest one micro unit per day to keep you sharp. These appear on your dashboard. Completing them builds a streak — see [Achievements](/help/learner/achievements).",
            },
          ],
          faqs: [
            {
              q: "Do microlearning units count toward certifications?",
              a: "Sometimes — it's defined per certification. If a cert lists a microlearning unit in its requirements, completing the unit ticks that requirement.",
            },
          ],
          related: [
            { label: "Achievements", chapter: "achievements" },
            { label: "Knowledge Base", chapter: "knowledge-base" },
          ],
        },
        {
          slug: "knowledge-base",
          title: "Knowledge Base",
          summary: helpContent["learn.knowledge-base"].description,
          pageLink: "/learn/knowledge-base",
          sections: [
            {
              heading: "What the KB is for",
              body:
                helpContent["learn.knowledge-base"].details +
                "\n\nThink of the KB as the searchable reference layer that sits *alongside* training. When you've already learned something but need a quick reminder — that lives here.",
            },
            {
              heading: "Searching effectively",
              body:
                "- Use plain language: *how do I reset a password*\n" +
                "- The search ranks by relevance and recency, with official articles (verified by an admin) at the top.\n" +
                "- If you don't find what you need, the search results page lets you ask the [AI assistant](/help/learner/ai-chat) the same question.",
            },
          ],
          faqs: [
            {
              q: "How is the KB different from courses?",
              a: "Courses teach you *how to do something* from scratch with structure, assessments, and outcomes. The KB is reference material you dip into when you need a specific fact or procedure.",
            },
          ],
          related: [
            { label: "AI Chat", chapter: "ai-chat" },
            { label: "Microlearning", chapter: "microlearning" },
          ],
        },
        {
          slug: "ai-chat",
          title: "AI Learning Assistant",
          summary: helpContent["learn.chat"].description,
          pageLink: "/learn/chat",
          sections: [
            {
              heading: "What the assistant can do",
              body:
                helpContent["learn.chat"].details +
                "\n\nThe AI assistant has context about your courses, the knowledge base, and the platform itself. Common asks:\n\n" +
                "- *Summarize what I learned in the Cybersecurity course*\n" +
                "- *What's the procedure for requesting an exception?*\n" +
                "- *Quiz me on key terms from Module 3*\n" +
                "- *I forgot how to set up SSO — point me to the right doc*",
            },
            {
              heading: "Limits",
              body:
                "The assistant is helpful, but it's not infallible. Treat its answers as a *starting point*, not gospel. Verify important details against the underlying course content or KB article.\n\n" +
                "> The assistant does not have access to private information about other users, your manager's notes, or compensation data. It's a learning tool, not an HR system.",
            },
          ],
          faqs: [
            {
              q: "Is my conversation private?",
              a: "Conversations are stored against your account so the assistant can maintain context, but they are not visible to other users by default. Admins can audit conversations as part of policy enforcement.",
            },
            {
              q: "The assistant gave a wrong answer.",
              a: "Use the thumbs-down feedback button. That signal is reviewed and helps tune the assistant. For factual content like procedures, always cross-check against the KB.",
            },
          ],
          related: [
            { label: "Knowledge Base", chapter: "knowledge-base" },
            { label: "Discussions", chapter: "discussions" },
          ],
        },
      ],
    },
    {
      heading: "Community",
      chapters: [
        {
          slug: "discussions",
          title: "Discussions",
          summary: helpContent["learn.discussions"].description,
          pageLink: "/learn/discussions",
          sections: [
            {
              heading: "What discussions are for",
              body:
                helpContent["learn.discussions"].details +
                "\n\nDiscussions are public threaded conversations — like a forum. They're great for asking questions, sharing perspectives, and learning from peers who hit the same problems you did.",
            },
            {
              heading: "Etiquette",
              body:
                "- Search before posting — your question may already be answered.\n" +
                "- Use a clear, specific title.\n" +
                "- Thank people who help you (upvoting helps too).\n" +
                "- Stay on topic — off-topic posts may be moved or removed.",
            },
          ],
          faqs: [
            {
              q: "Can I delete a post I made?",
              a: "Yes, from the post's menu. Replies remain unless you also delete them. Admins can also remove posts that violate community guidelines.",
            },
          ],
          related: [
            { label: "Messages", chapter: "messages" },
            { label: "Mentorship", chapter: "mentorship" },
          ],
        },
        {
          slug: "messages",
          title: "Direct Messages",
          summary: helpContent["learn.messages"].description,
          pageLink: "/learn/messages",
          sections: [
            {
              heading: "Sending a message",
              body:
                helpContent["learn.messages"].details +
                "\n\nClick **New Message** and start typing a person's name. Messages support text, file attachments, and links to courses or articles.\n\n" +
                "Messages are 1-to-1 or small-group; for broader conversations use [Discussions](/help/learner/discussions).",
            },
          ],
          faqs: [
            {
              q: "Can my manager read my DMs?",
              a: "No — DMs are private between participants. They may be subject to admin audit in regulated industries; check with your compliance team if you have specific concerns.",
            },
          ],
          related: [
            { label: "Discussions", chapter: "discussions" },
            { label: "Mentorship", chapter: "mentorship" },
          ],
        },
        {
          slug: "mentorship",
          title: "Mentorship",
          summary: helpContent["learn.mentorship"].description,
          pageLink: "/learn/mentorship",
          sections: [
            {
              heading: "How mentorship works here",
              body:
                helpContent["learn.mentorship"].details +
                "\n\nYou can be a mentor, a mentee, or both. The platform helps with matching, scheduling, and tracking goals — but the relationship itself is human.",
            },
            {
              heading: "Finding a mentor",
              body:
                "1. Browse available mentors. Each profile lists their experience, areas of expertise, and availability.\n" +
                "2. Send a request describing what you want to learn and any time constraints.\n" +
                "3. Wait for acceptance — mentors can decline if it's not a fit; that's normal.\n" +
                "4. Once accepted, schedule sessions from the mentorship workspace and log your discussions and goals.",
            },
            {
              heading: "Being a mentor",
              body:
                "If you'd like to mentor others, set yourself as available in your mentorship profile. List your areas of expertise honestly — overstating leads to mismatched relationships. Time-block when you can take meetings so the platform doesn't suggest times that won't work.",
            },
          ],
          faqs: [
            {
              q: "Is mentorship time tracked for compensation?",
              a: "The platform tracks it for your own visibility, but compensation is between you and your org. Check your HR policies.",
            },
            {
              q: "What if my mentor isn't a good fit?",
              a: "Talk to them first if possible; mismatches often resolve. If not, you can end the relationship in the workspace and start a new request.",
            },
          ],
          related: [
            { label: "Messages", chapter: "messages" },
            { label: "Feedback", chapter: "feedback" },
          ],
        },
        {
          slug: "feedback",
          title: "Feedback (peer & 360)",
          summary: helpContent["learn.feedback"].description,
          pageLink: "/learn/feedback",
          sections: [
            {
              heading: "How feedback works",
              body:
                helpContent["learn.feedback"].details +
                "\n\nFeedback is *ongoing* — short, structured recognition or coaching notes shared between peers or from a manager. It's distinct from formal performance reviews.",
            },
            {
              heading: "Giving feedback",
              body:
                "1. Pick the person.\n" +
                "2. Choose a template (kudos, suggestion, 360 review, etc.).\n" +
                "3. Write specific, observable feedback — *what they did*, *what the impact was*, and *what to do next*.\n" +
                "4. Submit. The recipient is notified.",
            },
            {
              heading: "Receiving feedback",
              body:
                "All feedback you receive is in [/learn/feedback](/learn/feedback). Mark items as Read once you've reviewed them. Patterns in the feedback you receive are a powerful input to your development plan.",
            },
          ],
          faqs: [
            {
              q: "Is feedback anonymous?",
              a: "Depends on the cycle. 360 feedback rounds are usually anonymous to encourage candor; ad-hoc kudos and coaching are usually attributed.",
            },
          ],
          related: [
            { label: "Evaluations", chapter: "evaluations" },
            { label: "Observations", chapter: "observations" },
          ],
        },
        {
          slug: "observations",
          title: "Observations",
          summary: helpContent["learn.observations"].description,
          pageLink: "/learn/observations",
          sections: [
            {
              heading: "What observations are",
              body:
                helpContent["learn.observations"].details,
            },
            {
              heading: "The two sides",
              body:
                "- **As Observer** — observations you've conducted on someone else. Available to managers, instructors, and admins. Click *New Observation*, choose a template and a subject, then fill out the checklist as you watch them perform the task.\n" +
                "- **As Subject** — observations *about you*. Read-only — you see who observed you, what the score was, and any written notes.",
            },
            {
              heading: "Working through an observation (as observer)",
              body:
                "1. Open the observation. The checklist appears — each item is a behavior or skill to evaluate.\n" +
                "2. Score each item (checkbox, 1–5 rating, yes/no, or write a short response).\n" +
                "3. Add notes for context.\n" +
                "4. Save as draft if you're stepping away, or mark **Complete** when done.\n" +
                "5. A manager or admin signs it off (they can't be the same person who observed, to keep the process honest).",
            },
          ],
          faqs: [
            {
              q: "Is an observation a performance review?",
              a: "No. Observations are a developmental coaching tool — they confirm that on-the-job skills from training are being applied. They're not tied to compensation, promotion, or formal HR review cycles.",
            },
            {
              q: "Can I dispute an observation about me?",
              a: "Open a conversation with the observer or their manager. There's no formal dispute workflow because observations aren't formal HR records — they're a coaching signal.",
            },
          ],
          related: [
            { label: "Feedback", chapter: "feedback" },
          ],
        },
      ],
    },
    {
      heading: "Recognition & Habits",
      chapters: [
        {
          slug: "achievements",
          title: "Achievements & Gamification",
          summary: helpContent["learn.achievements"].description,
          pageLink: "/learn/achievements",
          sections: [
            {
              heading: "What's tracked",
              body:
                helpContent["learn.achievements"].details +
                "\n\nIf your tenant enables gamification, the platform awards points and badges for behaviors that signal real learning:\n\n" +
                "- Completing courses, paths, and certifications\n" +
                "- Hitting streaks (e.g. 7 days in a row of microlearning)\n" +
                "- Verifying skills\n" +
                "- Mentoring others\n" +
                "- Contributing helpful discussion answers",
            },
            {
              heading: "Leaderboards",
              body:
                "Some orgs run leaderboards — team-level, department-level, or platform-wide. They're meant to be fun, not a stack rank. If competition isn't your thing, you can hide leaderboards in your privacy settings.",
            },
          ],
          faqs: [
            {
              q: "Do achievements affect my pay or promotion?",
              a: "No. Gamification is for engagement and recognition, not performance management. Achievements are visible on your profile but they're not compensation inputs.",
            },
          ],
          related: [
            { label: "Microlearning", chapter: "microlearning" },
            { label: "Nudges", chapter: "nudges" },
          ],
        },
        {
          slug: "nudges",
          title: "Nudges",
          summary: helpContent["learn.nudges"].description,
          pageLink: "/learn/nudges",
          sections: [
            {
              heading: "What nudges do",
              body:
                helpContent["learn.nudges"].details +
                "\n\nA nudge is a *tiny prompt* designed to build a habit or close a loop — *finish that last lesson*, *renew your CPR certification*, *try this 3-minute micro on negotiation*.",
            },
            {
              heading: "Acting on nudges",
              body:
                "Each nudge has a clear next action. Click through to handle it. Dismiss nudges that aren't relevant — they go away and similar ones are deprioritized.\n\n> Too many nudges? Dial the frequency down in [Profile → Settings → Notifications](/profile/settings).",
            },
          ],
          faqs: [
            {
              q: "Who creates these?",
              a: "A mix: some are automatically generated by the platform (e.g. expiring certs), some are sent by your manager, and some are set up as campaigns by admins.",
            },
          ],
          related: [
            { label: "Profile & Settings", chapter: "profile-settings" },
          ],
        },
      ],
    },
    {
      heading: "Resources & Shop",
      chapters: [
        {
          slug: "documents",
          title: "Documents",
          summary: helpContent["learn.documents"].description,
          pageLink: "/learn/documents",
          sections: [
            {
              heading: "What's here",
              body:
                helpContent["learn.documents"].details +
                "\n\nDocuments are files (PDFs, slide decks, policies, templates) that admins or instructors have shared with you. They're separate from course content because they're meant as reference material, not standalone learning.",
            },
            {
              heading: "Acknowledgements",
              body:
                "Some documents require an acknowledgement — confirmation that you've read them. These show a button or checkbox; clicking it records your acceptance with a timestamp.",
            },
          ],
          faqs: [
            {
              q: "I can't find a policy I'm supposed to read.",
              a: "Try the search at the top of the page. If it's still missing, ask your manager — it may not have been shared with your group.",
            },
          ],
          related: [
            { label: "Knowledge Base", chapter: "knowledge-base" },
          ],
        },
        {
          slug: "shop-marketplace",
          title: "Shop & Marketplace",
          summary: "Purchasing content, third-party partners, and your order history.",
          sections: [
            {
              heading: "Shop",
              body:
                helpContent["shop.index"].details +
                "\n\nItems in the Shop are first-party content your org has set up for purchase: books, premium courses, supplemental materials. Some require manager approval before fulfillment.",
            },
            {
              heading: "Marketplace",
              body:
                helpContent["learn.marketplace"].details +
                "\n\nMarketplace shows third-party and partner content — often a wider selection than the in-house catalog. Pricing, approval rules, and visibility are set by your admin.",
            },
            {
              heading: "Cart and orders",
              body:
                "Your [Cart](/shop/cart) holds items you've added but not purchased. [Orders](/shop/orders) is your purchase history with receipts.",
            },
          ],
          faqs: [
            {
              q: "Why is my purchase pending?",
              a: "Either payment processing is in flight, or it's awaiting manager approval. Check your orders list — it'll tell you which.",
            },
          ],
          related: [
            { label: "Catalog", chapter: "catalog" },
          ],
        },
      ],
    },
  ],
};
