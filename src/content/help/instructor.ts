import type { HelpManual } from "./types";

export const instructorManual: HelpManual = {
  role: "instructor",
  title: "Instructor Manual",
  intro:
    "Guidance for authoring courses, running live sessions, grading work, and observing learners on the job.",
  groups: [
    {
      heading: "Teaching",
      chapters: [
        {
          slug: "ilt-sessions",
          title: "Running an Instructor-Led Session",
          summary: "Setting up, running, and closing out a live training session.",
          pageLink: "/admin/ilt-sessions",
          whoItsFor: "Instructors, admins",
          sections: [
            {
              heading: "Before the session",
              body:
                "1. Confirm session details from the admin ILT page: time, location/link, capacity, materials.\n" +
                "2. Review the roster — who's registered, who's on waitlist.\n" +
                "3. Make sure prerequisites are documented in the session description; learners get less out of sessions they're underprepared for.\n" +
                "4. Send any pre-session materials at least 48 hours in advance.",
            },
            {
              heading: "During the session",
              body:
                "- **Virtual** — open the join link a few minutes early. Use the platform's attendance link to mark people present.\n" +
                "- **In-person** — take attendance manually or via a check-in QR if your venue supports it.\n" +
                "- Capture any decisions, takeaways, or follow-ups in the session notes for reference.",
            },
            {
              heading: "After the session",
              body:
                "1. **Mark the session complete** — this triggers attendee completion records and unlocks any follow-up evaluations.\n" +
                "2. Post any recordings, slides, or supplemental materials to the session detail page so they're discoverable.\n" +
                "3. Review the post-session evaluation results to learn what landed and what didn't.",
            },
          ],
          faqs: [
            {
              q: "A learner attended but isn't getting credit.",
              a: "Check that you marked them as attended *and* that you closed out the session. Open sessions don't grant completion.",
            },
            {
              q: "Can I bring in a co-instructor?",
              a: "Yes — add additional instructors from the session edit page. They get the same management permissions for that specific session.",
            },
          ],
          related: [
            { label: "Course authoring", chapter: "courses" },
            { label: "Assessments & grading", chapter: "assessments" },
          ],
        },
        {
          slug: "courses",
          title: "Authoring Courses",
          summary: "Building self-paced course content learners can take any time.",
          pageLink: "/admin/courses/new",
          sections: [
            {
              heading: "Course structure",
              body:
                "A course is broken into:\n\n" +
                "- **Modules** — top-level chapters\n" +
                "- **Lessons** — the actual content (video, text, slides, SCORM, xAPI, interactive widgets)\n" +
                "- **Assessments** — quizzes that gate completion\n" +
                "- **Resources** — supplemental files\n\n" +
                "Plan the outline first; the platform makes shuffling easy but a clean structure saves time later.",
            },
            {
              heading: "Building lessons",
              body:
                "1. From the course editor, click **Add Lesson** and pick a type.\n" +
                "2. Add content. Most lesson types support a rich text editor; SCORM and xAPI take uploaded packages.\n" +
                "3. Configure completion rules — *viewed*, *time spent*, *passed quiz*, etc.\n" +
                "4. Preview the learner experience with the **Preview as learner** toggle.",
            },
            {
              heading: "Publishing",
              body:
                "Courses are in *Draft* until you publish them. Once published, learners can enroll. You can keep editing afterward, but be mindful: significant changes can disrupt in-progress learners. For major rewrites, create a new version instead.",
            },
            {
              heading: "AI Course Creator",
              body:
                "If your tenant has AI enabled, the [AI Course Creator](/admin/courses/ai-create) can draft a course from a topic and a few constraints. Use it as a *starting point* — always review and edit before publishing.",
            },
          ],
          faqs: [
            {
              q: "What's the difference between SCORM and xAPI?",
              a: "Both are e-learning standards. SCORM (1.2 or 2004) is older and very widely supported. xAPI is newer, more flexible, and tracks richer learning activity. Use whichever your authoring tool exports — the platform handles both.",
            },
            {
              q: "Can I require a specific order through lessons?",
              a: "Yes — set lesson prerequisites in the course editor. By default learners can navigate freely.",
            },
          ],
          related: [
            { label: "Assessments & grading", chapter: "assessments" },
          ],
        },
        {
          slug: "assessments",
          title: "Assessments & Grading",
          summary: "Building quizzes, grading written work, and providing feedback.",
          sections: [
            {
              heading: "Building an assessment",
              body:
                "1. Open the [Assessments admin page](/admin/assessments) and click **New Assessment**.\n" +
                "2. Choose a type — quiz (auto-graded), written (instructor-graded), or mixed.\n" +
                "3. Add questions. Available types: multiple choice, multi-select, true/false, short answer, essay, file upload, matching, ordering.\n" +
                "4. Configure rules: time limit, max attempts, passing score, randomization.\n" +
                "5. Attach the assessment to a course lesson or as a standalone gate on a certification.",
            },
            {
              heading: "Grading written work",
              body:
                "Submissions that need human grading show up in your queue. For each submission:\n\n" +
                "1. Read the response.\n" +
                "2. Assign a score (the rubric is shown to keep grading consistent).\n" +
                "3. Add written feedback. Specific feedback is markedly more useful than generic *good job*.\n" +
                "4. Submit — the learner is notified and can see your feedback.",
            },
            {
              heading: "Calibration",
              body:
                "When multiple instructors grade the same assessment, drift creeps in. The platform supports occasional calibration runs: several instructors grade the same anonymized submission, results are compared. Use these to keep grading consistent across your team.",
            },
          ],
          faqs: [
            {
              q: "Can a learner appeal a grade?",
              a: "There's no formal appeal workflow, but they can message you directly. For genuinely contentious cases, your manager or admin can override.",
            },
            {
              q: "Why is my queue empty when I know submissions are waiting?",
              a: "Check the filters at the top of the queue — by default it shows only ungraded, unclaimed submissions assigned to you.",
            },
          ],
          related: [
            { label: "Observations", chapter: "observations" },
          ],
        },
        {
          slug: "observations",
          title: "Observing learners on the job",
          summary: "Using observation checklists to confirm training transferred to real work.",
          pageLink: "/learn/observations",
          sections: [
            {
              heading: "Why observations matter",
              body:
                "An assessment proves a learner can answer questions; an observation proves they can *do the job*. Use observations to close the gap between training and real-world performance.\n\nObservations are not formal performance reviews — they're a coaching tool.",
            },
            {
              heading: "Conducting one",
              body:
                "1. From [My Observations](/learn/observations), click **New Observation**.\n" +
                "2. Choose a template (the checklist for this observation type).\n" +
                "3. Choose the subject — the learner you're observing.\n" +
                "4. Score each item as you watch them perform the task. Don't try to fill it in from memory — observations are *contemporaneous*.\n" +
                "5. Add notes. Specific behavior > vague impressions.\n" +
                "6. Mark complete. A manager or admin signs it off (it can't be you — separation of duties).",
            },
            {
              heading: "After the observation",
              body:
                "Sit down with the learner and walk through what you saw — both the strong points and the gaps. This conversation is where the development happens; the checklist is just the prep work.",
            },
          ],
          faqs: [
            {
              q: "Who picks the template?",
              a: "Admins create observation templates per role or skill. As an observer you pick from the available templates that fit the situation.",
            },
            {
              q: "Can I observe my own team if I'm both an instructor and a manager?",
              a: "Yes. The platform tracks observer and subject separately; your role doesn't restrict who you can observe (subject to template targeting rules).",
            },
          ],
          related: [
            { label: "Assessments", chapter: "assessments" },
          ],
        },
      ],
    },
  ],
};
