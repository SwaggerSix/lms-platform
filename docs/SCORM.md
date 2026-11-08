# SCORM courses

How to load, test and publish SCORM e-learning packages, and how the pieces fit.

## One-time setup

**Supabase upload size limit.** Packages are uploaded straight from the browser to the
private `course-content` bucket, so the limit that applies is the project's global
upload limit (Supabase → Project Settings → Storage → *Upload file size limit*). The
default on many plans is 50 MB. Set it at or above the largest package you expect,
up to the app's own 400 MB cap. Every file *inside* a package (e.g. a long video) is
also subject to it.

Nothing else is required: no migration, no new bucket, no env vars.

## Workflow

1. **Export** from your authoring tool as *LMS → SCORM 1.2* (most compatible) or
   SCORM 2004. Upload the `.zip` as exported.
2. **Import:** Admin → Courses → **Import SCORM**. This creates a *draft* course
   (type `scorm`) with one lesson holding the package, then opens the course's
   SCORM page.
3. **Preview:** on the SCORM page, **Preview as learner**. Without an enrollment
   the player runs in preview mode, so nothing is recorded.
4. **Tracking test:** enroll a test learner and take the course. Close it midway and
   reopen it; it should resume. Finish it; the lesson should complete with a score.
5. **Publish:** **Publish course** on the SCORM page (or via Edit on the course list).

**Updating a live course:** Courses → ⋯ → **SCORM Packages** → drop the new zip on the
lesson → preview → **Publish new version**. Enrollments are pinned to the course
version they started, so in-progress learners keep the old package (its files are
never deleted) and new enrollments get the new one.

**Several packages in one course:** use *Add another SCORM package* on the SCORM page.
Each becomes a lesson at the end of the course.

## How it works

| Piece | Where |
| --- | --- |
| Signed upload URL (browser → storage, bypasses Vercel's ~4.5 MB body limit) | `src/app/api/scorm/upload-url/route.ts` |
| Extract zip, store files under `scorm/<packageId>/`, attach to lesson/course | `src/app/api/scorm/import/route.ts`, `src/lib/scorm/extract.ts`, `src/lib/scorm/attach.ts` |
| Manifest parsing, launch resolution, path safety, time/score helpers | `src/lib/scorm/package.ts` |
| Same-origin file serving | `src/app/scorm-content/[...path]/route.ts` |
| SCORM 1.2 + 2004 runtime (`window.API`, `window.API_1484_11`) | `src/components/course/scorm-player.tsx` |
| Resume/score persistence (`lesson_progress.bookmark_data.scorm`, `score`) | `src/app/api/scorm/runtime/route.ts`, `src/components/course/scorm-lesson.tsx` |
| Admin UI | `/admin/courses/scorm-import`, `/admin/courses/[slug]/scorm` |

**Why same-origin serving.** SCORM content finds the LMS by walking `window.parent`
looking for `API` / `API_1484_11`. Browsers block that across origins, so content served
from `*.supabase.co` can display but never report completion. `/scorm-content/...`
serves HTML, CSS, JS, JSON and XML through the app. Media and other binaries get a
1-hour signed-URL redirect, so large videos don't stream through a serverless
function. That path is excluded from the middleware (per-file auth/CSP cost, and the
strict nonce CSP would block authoring-tool inline scripts) and from the global
`X-Frame-Options: DENY`. The route checks the session itself.

**Completion** is reported the moment the package sets `lesson_status` to
completed/passed (1.2), or `completion_status=completed` / `success_status=passed`
(2004). It doesn't wait for `LMSFinish`/`Terminate`, which many packages skip when
the tab is closed. It goes through `/api/enrollments/progress`, so points, badges,
course completion and certificates all fire as for any other lesson.

## Security trade-off

Package HTML runs on the app's origin, so its scripts can do anything the signed-in
viewer can. That's inherent to same-origin SCORM and true of most LMSs. It means
**only trusted people should upload packages**. Upload is limited to admins and
instructors, and instructors only on courses they created. If you ever need to accept
packages from untrusted authors, serve `/scorm-content` from a separate subdomain and
bridge the runtime with `postMessage`.

## Troubleshooting

- *"larger than your storage upload limit"*: raise the Supabase limit (see setup).
- *"characters storage can't accept"*: a file name inside the zip has non-ASCII
  characters (e.g. accents). Rename in the authoring project and re-export.
- *Course plays but never completes*: check the export's reporting setting. Some
  tools default to "complete on viewing N slides" or need the final quiz passed.
- *Learners on a live course still see the old version*: click **Publish new version**.
