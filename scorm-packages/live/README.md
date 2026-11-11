# Live course files

Files here are uploaded to the five Mosaic certification packages in
Supabase storage (`course-content/scorm/<package id>/`) by the
**Upload Mosaic course files** button (Actions tab,
`.github/workflows/upload-mosaic-course-files.yml`).

- `scorm-packages/mosaic-player/player.js` goes to all five packages.
- `live/<package id>/<file>` goes to that package only, e.g. an edited
  `course-data.js`.

| Package id | Course |
|---|---|
| 2a1c6b35-3be3-42ae-9609-6aa3b685fff5 | MOS-100 Mosaic Practitioner |
| 488f5096-04d6-4501-bfce-76a70aabf4ba | MOS-210 Coaching Studio |
| c8960c24-0110-46c6-97be-36f05e2da5f2 | MOS-220 SurveyCraft |
| 723e4d42-6cbb-454a-b001-624460a7a30d | MOS-230 Culture Dig |
| 0a9c7164-14a5-45bb-bea0-520096b716d6 | MOS-240 Mosaic Signal |

Before overwriting anything the button downloads the current copy of every
file it replaces and keeps them as the run's "previous-course-files"
artifact (90 days), so a bad upload can be undone by putting those back.

`course-data.js` is the course content, lightly obfuscated as the player
expects (see `mosaic-player/player.js`, `decode`).
