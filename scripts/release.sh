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

# ── A release lands on STAGING only (2026-09-12) ────────────────────────────
#
# It used to push `HEAD:main HEAD:staging`, so every release built every
# changed app TWICE. Measured over the fourteen days to 2026-09-12: 2374
# builds and 1268 build-minutes across nine Vercel projects, against a bill
# Sjoerd put at about €300. Halving the branches halves that, and it buys the
# thing the two-stack setup was for in the first place — look at it on
# `.tech`, then promote.
#
# Production is promoted deliberately with `./scripts/promote.sh`, which
# fast-forwards main to whatever staging has been shown to be good.
#
# The divergence check below stays and its ADVICE had to change, which the
# Thread session caught before this shipped.
#
# It was written when staging was only ever fast-forwarded from main, so a
# divergence meant somebody had pushed to staging directly and the fix was to
# reconcile. Under the new flow main lags staging BY DESIGN, so the common
# cause is now completely ordinary: a session did the reflex `git pull`, which
# tracks main, and is therefore missing the last release. Telling that person
# to "merge those commits into main" would send them the wrong way.
#
# **Sessions track `origin/staging`, not `origin/main`.** That is the one new
# habit this flow needs. Pull staging, commit, release, promote when good.
git fetch origin staging --quiet 2>/dev/null || true
if git rev-parse --verify --quiet origin/staging >/dev/null; then
  if ! git merge-base --is-ancestor origin/staging HEAD; then
    echo "REFUSED: origin/staging has commits HEAD does not (it is not an ancestor)." >&2
    echo "  The push would be rejected as non-fast-forward anyway." >&2
    echo >&2
    echo "  Most likely you pulled MAIN, which now lags staging by design —" >&2
    echo "  releases land on staging and production is promoted separately." >&2
    echo "      git merge --ff-only origin/staging     # then re-run" >&2
    echo >&2
    echo "  See what you are missing:  git log --oneline HEAD..origin/staging" >&2
    exit 1
  fi
fi

pnpm verify

# HEAD, not the ref named `main`. In the main checkout they are the same
# commit. From a WORKTREE they are not: `main` is checked out in the main
# checkout and is whatever that tree last had, so every gate above would
# pass on this tree and a different commit would ship (found 2026-09-11,
# the first time anyone released from a worktree — CLAUDE.md now tells
# sessions to take one for code work, so this was about to become the
# normal path rather than the exception). HEAD is what the gates read.
git push origin HEAD:staging
echo "Released $V to STAGING."
echo
echo "  Look at it on the .tech stack. When it is good:"
echo "      ./scripts/promote.sh"
echo
echo "  Nothing is on production until you do."
