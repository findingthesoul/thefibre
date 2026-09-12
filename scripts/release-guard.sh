#!/usr/bin/env bash
# Release-number guard for parallel sessions (2026-09-07, after THREE
# same-number collisions in one day: two 0.58.0s, two 0.58.1s, two 0.58.4s).
#
# The serialization truth is git history, not the announcement channel —
# messages between sessions race pushes. Run this with your INTENDED number
# immediately before `git push` of a release commit:
#
#   ./scripts/release-guard.sh 0.58.5
#
# It fetches origin, reads the newest release heading from CHANGELOG.md on the
# branch releases LAND on — `staging` since 2026-09-12, main before that — and
# refuses unless your number is strictly greater. Also refuses if your local
# branch is behind that ref: pull first, then re-run.
set -euo pipefail
cd "$(dirname "$0")/.."

intended="${1:-}"
if [[ ! "$intended" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: $0 <intended-version>  e.g. $0 0.58.5" >&2
  exit 2
fi

git fetch -q origin

# ── Read the branch releases actually LAND on ───────────────────────────────
#
# Until 2026-09-12 that was main, because release.sh pushed both refs. It now
# pushes `staging` only and production is promoted separately, so main LAGS by
# design — and a guard reading main would happily approve a number already
# released to staging by another session. That is the exact collision this
# script exists to prevent, reintroduced by a change made somewhere else.
#
# So: staging when it exists, main as the fallback (a fresh clone, or before
# the first staging-only release).
REF=origin/staging
if ! git rev-parse --verify --quiet "$REF" >/dev/null; then
  REF=origin/main
fi

behind=$(git rev-list --count HEAD.."$REF")
if [ "$behind" != "0" ]; then
  echo "REFUSED: local is $behind commit(s) behind $REF — pull, re-check, re-run." >&2
  exit 1
fi

last=$(git show "$REF":CHANGELOG.md | grep -oE '^## \[[0-9]+\.[0-9]+\.[0-9]+\]' | head -1 | tr -d '#[] ')
if [ -z "$last" ]; then
  echo "REFUSED: could not read the last release number from $REF CHANGELOG." >&2
  exit 1
fi

newer=$(printf '%s\n%s\n' "$last" "$intended" | sort -V | tail -1)
if [ "$intended" = "$last" ] || [ "$newer" != "$intended" ]; then
  echo "REFUSED: intended $intended is not greater than the last released $last ($REF)." >&2
  echo "         Someone released while you were preparing. Renumber and re-run." >&2
  exit 1
fi

echo "OK: $intended > $last ($REF up to date) — clear to push."
