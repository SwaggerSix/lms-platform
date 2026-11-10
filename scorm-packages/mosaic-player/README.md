# Mosaic certification player

The player inside the five Mosaic certification SCORM packages (MOS-100,
MOS-210, MOS-220, MOS-230, MOS-240). All five use these same `player.js` and
`player.css`; each package's own content is in its `course-data.js` (not kept
here). The packages were built outside this repo, so this folder is the only
copy of the player's source.

- `player.js`, `player.css`, `index.html` — what the live packages serve.
- `original/` — the player as first uploaded (9 Nov 2026), for rollback.

## Change log

**10 Nov 2026 — moving between modules.** Learners had to find the "Modules"
menu (collapsed whenever the course window is under 860px wide, which it
usually is inside the LMS) to get to the next module. Now:

- every module ends with a card: "To finish M0" listing what's left, which
  turns into "✓ M0 complete — Continue to M1: … →" once it's done (it scrolls
  into view and is announced to screen readers);
- a bar at the top of each module: "← M0 · M1 of M10 · M2 →" (Next is
  disabled while the next module is still locked);
- "Continue" goes to the next module in order, or, if that one is locked,
  to the first module still to do (`nextKey()`).

No change to content, scoring, completion rules or saved state.

## Updating the live packages

Files live in Supabase storage, bucket `course-content`, under
`scorm/<package_id>/` (package ids: `lessons.content_data->'scorm'->>'package_id'`
for each course's lesson). Replacing `player.js` / `player.css` there updates
every learner, in-progress ones included, within ~5 minutes (the files are
served with `max-age=300`). That's right for changes like the one above that
don't touch content or saved state. A change to content or scoring should go
through a new package and **Publish new version** instead (see `docs/SCORM.md`),
so learners already in progress keep the version they started.
