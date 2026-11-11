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

**11 Nov 2026 — one capstone for the bundle.** MOS-100, MOS-230 and MOS-240
now lead to one certification, Mosaic Practitioner Certified, through one
capstone handed in on the LMS (`/learn/capstone/<id>`) once all three
courses are finished. The player takes its hand-in wording from the course
data when `C.handIn` is set (nav label, the practical page's heading and
notice, the home-page line, the final module's "Next steps"), and shows a
module's `note` (HTML) above its video, used on M10, CD-M6 and MS-M6 to say
what has changed since the narration was recorded. Without them (MOS-210,
MOS-220) it reads exactly as before. The three courses' `course-data.js`
were edited to match: the "How you'll be certified" and "What happens next"
screens, the hand-in lines, and MOS-230's exam intro.

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
  and one closing `tk` shown under whichever option's feedback, labelled `tkl` (default "Takeaway"); a `match` answer may be a
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

**11 Nov 2026 — feedback sweep, phones, notes.** Every wrong choice now has its
own reason in MOS-100 M6-07, MOS-240 MS-M1-03 / M3-08 / M5-08 and MOS-210
CS-M4-10 Q3 (the shared explanation moved to one `tk` "Why:" line). Drag boxes
sit two across on screens under 600px. Written answers (`open`) are saved in
the learner's browser (localStorage `mosaic-notes:<course>:<activity>:<part>`),
never sent anywhere. M9-27 says plainly that nothing is uploaded (operator
decision 2026-11-11: no upload; self-score; peer review by swapping directly).

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
