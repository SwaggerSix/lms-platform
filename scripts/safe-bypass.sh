#!/usr/bin/env bash
# Usage: ./scripts/safe-bypass.sh "commit message"
#
# Convenience wrapper around `git commit --no-verify` when the
# bypass is intentional (e.g. landing a snapshot-update commit
# where the pre-commit hook would block on a known-good diff).
# Stashes any unstaged changes, commits with --no-verify, then
# pops the stash. If the commit fails, the stash is preserved
# rather than silently popped — easier recovery.
#
# See docs/conventions.md "Bypass policy" for when this is the
# right move.

set -e

if [ -z "$1" ]; then
  echo "usage: $0 \"commit message\"" >&2
  exit 1
fi

# Stash unstaged changes so the bypass commit only includes what
# was deliberately `git add`-ed. --keep-index leaves the staged
# tree as it is for the commit.
stashed=0
if [ -n "$(git diff --name-only)" ]; then
  git stash push --keep-index --include-untracked -m "safe-bypass" >/dev/null
  stashed=1
fi

if git commit --no-verify -m "$1"; then
  echo "committed (no-verify)"
  if [ "$stashed" -eq 1 ]; then
    git stash pop >/dev/null
    echo "restored unstaged changes from stash"
  fi
else
  echo "commit failed — stash preserved (run \`git stash list\` to recover)" >&2
  exit 1
fi
