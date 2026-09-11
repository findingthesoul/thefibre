#!/usr/bin/env bash
# The atomic tail of the release ritual: guard → consistency check → verify
# → push, in ONE script with set -e, so a refusal anywhere stops the push.
# Born 2026-09-08 after commit 928898c: release-guard refused a version but
# a broken && chain pushed the mislabeled commit anyway. If pushes only
# ever happen through this script, that cannot recur.
#
# Usage: ./scripts/release.sh <version>
# Expects the release commit to already exist locally (every workspace
# package.json, apps/web/lib/version.ts and the CHANGELOG heading all at
# <version>).
set -euo pipefail

V="${1:?usage: release.sh <version>}"
cd "$(dirname "$0")/.."

git fetch origin
./scripts/release-guard.sh "$V"

# Every version surface must already agree with $V — refuse a half-prepared
# release rather than pushing one.
# The list is DERIVED, not written out: apps/my (2026-09-08) was the eighth
# app, and a hand-kept list is how membership.thefibre.tech went missing from
# CORS and how three other "new thing forgotten in a list" bugs happened. A
# new app under apps/* is now covered the moment it exists.
# (Portable to macOS's bash 3.2 — no mapfile, no arrays needed.)
VERSION_FILES="package.json packages/shared/package.json"
for d in apps/*/; do
  [ -f "$d/package.json" ] && VERSION_FILES="$VERSION_FILES ${d}package.json"
done
for f in $VERSION_FILES; do
  got=$(node -p "require('./$f').version")
  if [ "$got" != "$V" ]; then
    echo "REFUSED: $f is at $got, not $V" >&2
    exit 1
  fi
done
grep -q "VERSION = '$V'" apps/web/lib/version.ts || {
  echo "REFUSED: apps/web/lib/version.ts is not at $V" >&2
  exit 1
}
grep -q "^## \[$V\]" CHANGELOG.md || {
  echo "REFUSED: CHANGELOG.md has no [$V] heading" >&2
  exit 1
}
# Two Claude sessions share this working tree as a matter of course, so a
# fully clean tree is the wrong bar — the OTHER session's in-flight files
# would block a sealed release (and push people around this script, which
# is worse). Refuse only what actually endangers THIS release: staged
# changes that never made it into the commit.
if ! git diff --cached --quiet; then
  echo "REFUSED: staged but uncommitted changes — commit or unstage them first" >&2
  exit 1
fi

pnpm verify

# HEAD, not the ref named `main`. In the main checkout they are the same
# commit. From a WORKTREE they are not: `main` is checked out in the main
# checkout and is whatever that tree last had, so every gate above would
# pass on this tree and a different commit would ship (found 2026-09-11,
# the first time anyone released from a worktree — CLAUDE.md now tells
# sessions to take one for code work, so this was about to become the
# normal path rather than the exception). HEAD is what the gates read.
git push origin HEAD:main HEAD:staging
echo "Released $V."
