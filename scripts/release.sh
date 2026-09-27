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

cd "$(dirname "$0")/.."

# The version is OPTIONAL: with no argument it is read from package.json,
# which `next-version.mjs` has already stamped. Typing it again was one more
# place to get it wrong — and the "REFUSED: package.json is at X, not Y" that
# followed was always a typo or a half-finished renumber, never a real
# disagreement worth a gate.
V="${1:-$(node -p "require('./package.json').version")}"
if [[ ! "$V" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: release.sh [version]   (with none, package.json decides)" >&2
  exit 64
fi

git fetch origin
./scripts/release-guard.sh "$V"

# Every version surface must already agree with $V — refuse a half-prepared
# release rather than pushing one.
# The list is DERIVED, not written out: apps/my (2026-09-08) was the eighth
# app, and a hand-kept list is how membership.thefibre.tech went missing from
# CORS and how three other "new thing forgotten in a list" bugs happened. A
# new app under apps/* is now covered the moment it exists. Same for
# packages/*: `packages/shared` was written out by name until packages/mcp
# arrived (2026-09-15) and the name became the next stale list.
# (Portable to macOS's bash 3.2 — no mapfile, no arrays needed.)
VERSION_FILES="package.json"
for d in apps/*/ packages/*/; do
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

# ── The commit subject is a version surface too ─────────────────────────────
#
# Every other surface is stamped by `next-version.mjs`. The commit message is
# typed by hand BEFORE it, and when a lost race moves the number `--amend`
# restamps sixteen files and cannot reach the subject line. So git history
# ends up naming a version the commit did not ship, permanently: e06f90ab says
# "v1.76.0" and shipped 1.79.0; 63b68e40 says v1.75.1 and shipped 1.76.1; also
# 61d3f61b and a873ac56. Four in the last 120 release commits, all recent,
# because renumbering only became routine when several sessions started
# releasing in one day.
#
# It matters when somebody asks which commit shipped a version — the answer
# read off `git log` is the wrong commit, and the number they wanted is on a
# commit three releases later. The CHANGELOG is right, so the mismatch is
# invisible until the two are compared.
#
# Docs commits and anything not announcing a version are ignored: this fires
# only on a subject that NAMES one.
subject=$(git log -1 --format=%s)
said=$(printf '%s' "$subject" | grep -oE '^v[0-9]+\.[0-9]+\.[0-9]+' | tr -d v || true)
if [ -n "${said:-}" ] && [ "$said" != "$V" ]; then
  echo "REFUSED: the commit subject says v$said, this release is $V" >&2
  echo "  $subject" >&2
  echo >&2
  echo "  The stamper moved the number after you wrote the message (a lost race," >&2
  echo "  usually). Every file agrees on $V and only the subject does not, so git" >&2
  echo "  history would name a version this commit did not ship." >&2
  echo >&2
  echo "      git commit --amend    # put $V in the subject, then re-run" >&2
  echo >&2
  exit 1
fi

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

# ── After the push: did somebody take this number too? ──────────────────────
#
# The guard checks, then the push happens — and between those two moments
# another session can push. Git accepts both when the second is built on the
# first, so two releases can carry ONE number with nothing refused. That is
# not a bug in the guard; a check and a push cannot be made atomic without a
# lock nobody wants.
#
# So this does not try to prevent it. It LOOKS, immediately after, and says so
# loudly — because the alternative is finding two `## [1.27.1]` headings in
# the permanent record weeks later, which is what happened on 2026-09-24.
git fetch -q origin
dupes=$(git show origin/staging:CHANGELOG.md | grep -c "^## \[$V\]" || true)
if [ "${dupes:-0}" -gt 1 ]; then
  echo >&2
  echo "⚠️  DUPLICATE: origin/staging now has $dupes entries for $V." >&2
  echo "   Another session pushed the same number in the seconds around yours." >&2
  echo "   Nothing is broken and the next release self-heals (the guard reads the" >&2
  echo "   newest number), but the RECORD is wrong. Whoever pushed second renumbers:" >&2
  echo "     node scripts/next-version.mjs patch    # relabels the entry and the files" >&2
  echo "   then release again. Tell the other session either way." >&2
  echo >&2
fi

# Order, as well as duplicates — the same pass over the same headings, and it
# catches the CONDITION that produced the backwards-version bug rather than
# its symptom. Never fails the release: three duplicate headings from earlier
# collisions are already in the file, and a gate nobody can satisfy is a gate
# people route around.
node scripts/changelog-order.mjs || true

# The per-app versions release.sh does NOT stamp — Meet, Pulse, Members,
# Thread and the portal each carry their own, shown to users, bumped by
# hand. Printed here rather than inside `pnpm verify` because it is
# release-time information and verify's output is long enough to scroll
# past. Never fails, for the reason written in the script's own header.
node scripts/check-app-versions.mjs || true

echo "Released $V to STAGING."
echo
echo "  Look at it on the .tech stack. When it is good:"
echo "      ./scripts/promote.sh"
echo
echo "  Nothing is on production until you do."
