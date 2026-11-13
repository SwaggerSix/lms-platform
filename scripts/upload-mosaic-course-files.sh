#!/usr/bin/env bash
# Upload the Mosaic course player (player.js, player.css) and edited course files to Supabase storage.
# See scorm-packages/live/README.md. Needs SUPABASE_URL and
# SUPABASE_SERVICE_ROLE_KEY. Saves the files it replaces under ./previous/.
set -euo pipefail

: "${SUPABASE_URL:?SUPABASE_URL is not set}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Add the SUPABASE_SERVICE_ROLE_KEY repository secret}"

BASE="${SUPABASE_URL%/}/storage/v1/object/course-content/scorm"
# A new-style secret key (sb_secret_...) goes on the apikey header only: on
# Authorization it's parsed as a JWT and refused. The legacy service_role key
# (a JWT) goes on both.
if [[ "$SUPABASE_SERVICE_ROLE_KEY" == sb_secret_* ]]; then
  AUTH=(-H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}")
else
  AUTH=(-H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}")
fi
PACKAGES=(
  2a1c6b35-3be3-42ae-9609-6aa3b685fff5
  488f5096-04d6-4501-bfce-76a70aabf4ba
  c8960c24-0110-46c6-97be-36f05e2da5f2
  723e4d42-6cbb-454a-b001-624460a7a30d
  0a9c7164-14a5-45bb-bea0-520096b716d6
)

type_of() {
  case "$1" in
    *.js) echo "application/javascript" ;;
    *.css) echo "text/css" ;;
    *.html) echo "text/html" ;;
    *.json) echo "application/json" ;;
    *.mp4) echo "video/mp4" ;;
    *.vtt) echo "text/vtt" ;;
    *.mp3) echo "audio/mpeg" ;;
    *.pdf) echo "application/pdf" ;;
    *.docx) echo "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ;;
    *) echo "application/octet-stream" ;;
  esac
}

# pkg, name, local file
upload() {
  local pkg="$1" name="$2" src="$3"
  mkdir -p "$(dirname "previous/$pkg/$name")"
  # Keep what's live now (a failure just means it's new).
  curl -sSf -o "previous/$pkg/$name" "${AUTH[@]}" "$BASE/$pkg/$name" 2>/dev/null || rm -f "previous/$pkg/$name"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" -X PUT "$BASE/$pkg/$name" "${AUTH[@]}" \
    -H "Content-Type: $(type_of "$name")" -H "x-upsert: true" --data-binary "@$src")
  # Read it back and compare.
  local back want
  back=$(curl -sS "${AUTH[@]}" "$BASE/$pkg/$name" | sha256sum | cut -c1-16)
  want=$(sha256sum "$src" | cut -c1-16)
  if [ "$code" != "200" ] || [ "$back" != "$want" ]; then
    echo "FAILED  $pkg/$name (HTTP $code)"
    return 1
  fi
  echo "ok      $pkg/$name"
}

status=0
for pkg in "${PACKAGES[@]}"; do
  upload "$pkg" player.js scorm-packages/mosaic-player/player.js || status=1
  upload "$pkg" player.css scorm-packages/mosaic-player/player.css || status=1
  if [ -d "scorm-packages/live/$pkg" ]; then
    # Every file, subfolders included (media/M10.mp4 goes to <pkg>/media/M10.mp4).
    while IFS= read -r -d '' f; do
      upload "$pkg" "${f#scorm-packages/live/$pkg/}" "$f" || status=1
    done < <(find "scorm-packages/live/$pkg" -type f -print0 | sort -z)
  fi
done
exit $status
