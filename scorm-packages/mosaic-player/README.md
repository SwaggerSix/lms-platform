# Mosaic certification player

The player inside the five Mosaic certification SCORM packages (MOS-100,
MOS-210, MOS-220, MOS-230, MOS-240). All five use these same `player.js` and
`player.css`; each package's own content is in its `course-data.js` (not kept
here). The packages were built outside this repo, so this folder is the only
copy of the player's source.

- `player.js`, `player.css`, `index.html` — what the live packages serve.
- `original/` — the player as first uploaded (9 Nov 2026), for rollback.
- `activities/<COURSE>.json` — each course's practice activities (source), and
  `<COURSE>.times.json` — where in which video each one pauses.
- `tools/` — `validate.py` (checks an activities file) and
  `build-activities.js` (turns one into the package's `activities.js`).
- `index.html` is MOS-100's; the other four differ only in their title. All
  five load `course-data.js`, then `activities.js`, then `player.js`.

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

**10 Nov 2026 — practice activities.** The course designs (in the surveycraft
repo, `docs/training/<course>/modules/*.md`) specify hands-on screens —
warm-ups, scenarios, sorting tasks, quick checks, practice cases — but the
build turned them into frames of the narrated video, so learners couldn't
answer them or see feedback. Now each one is real:

- the video pauses at the end of that screen's narration and the activity
  appears under it ("Continue the video ▶" resumes);
- each module lists its activities after the video, to redo any time;
- questions reuse the player's question types (`mcq`, `multi`, `order`,
  `match`) with instant feedback; written tasks (`open`) give a model answer.
  `order` may list other accepted orders in `alt`; any question may set its own
  verdict lines `vr` / `vw` (default "✓ That's the best answer." / "Not the best answer.")
  and one closing `tk` ("Takeaway:") shown under whichever option's feedback; a `match` answer may be a
  list of accepted targets. `{"ref": "KC-…"}` reuses a module-check item.
- practice only: nothing is graded, saved or required. Final-exam items are
  never used as practice.

**10 Nov 2026 — real drag and drop.** Every practice `match` is now dragged:
cards in a tray, dropped into one box per target (pointer events, so mouse,
touch and pen; the page scrolls while a card is held near the top or bottom
edge). Keyboard and tap: choose a card, then a box. It drives the question's
hidden `<select>`s, so grading is unchanged; after Check each card shows ✓/✗.

**10 Nov 2026 — drag to reorder.** Practice `order` activities (e.g. M3 "Put
the launch steps in order") are a list of cards: drag one up or down, or use
its ↑ / ↓ buttons. Dragging tracks the pointer on the window rather than with
pointer capture, because the card moves in the list mid-drag and moving a
captured element drops the capture. Hidden `<select>`s still carry the answer
(including `alt` orders); after Check each step shows ✓/✗ against the main order.

Counts: MOS-100 31, MOS-210 4, MOS-220 6, MOS-230 11, MOS-240 6.

The text is the design's own wording, converted screen by screen. Pause times
come from each screen's narration (`docs/training/<course>/voiceover/`)
matched against the video's captions (`media/<video>.vtt`). If a video is
re-cut, re-derive the times.

To change an activity: edit `activities/<COURSE>.json`, run
`python3 tools/validate.py activities/<COURSE>.json <kc_ids.json>`, then
`node tools/build-activities.js <package folder> activities/<COURSE>.times.json activities/<COURSE>.json`
(the folder needs that package's `course-data.js`: the file is encoded with
its key), and upload the resulting `activities.js` as below.

## Updating the live packages

Files live in Supabase storage, bucket `course-content`, under
`scorm/<package_id>/` (package ids: `lessons.content_data->'scorm'->>'package_id'`
for each course's lesson). Replacing `player.js` / `player.css` there updates
every learner, in-progress ones included, within ~5 minutes (the files are
served with `max-age=300`). That's right for changes like the one above that
don't touch content or saved state. A change to content or scoring should go
through a new package and **Publish new version** instead (see `docs/SCORM.md`),
so learners already in progress keep the version they started.
