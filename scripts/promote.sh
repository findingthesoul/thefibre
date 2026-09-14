#!/usr/bin/env bash
# Promote staging to production.
#
# Since 2026-09-12 `release.sh` pushes ONLY to `staging`, so every release
# lands on the .tech stack and nowhere else. This is the second half: when
# what is on staging has been looked at and is good, main is fast-forwarded
# to it.
#
#   ./scripts/promote.sh          promote whatever staging currently has
#   ./scripts/promote.sh <sha>    promote up to a specific commit
#
# Why the split exists: every release used to build every changed app twice,
# once per branch. Fourteen days to 2026-09-12 carried 2374 builds and 1268
# build-minutes across nine Vercel projects. Halving the branches halves that,
# and it buys what the two-stack setup was for — see it on .tech first.
#
# FAST-FORWARD ONLY. If main has commits staging does not, something went to
# production outside this flow and merging them here would be guesswork about
# whose work survives. Stop and look instead.
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch -q origin

TARGET="${1:-origin/staging}"
if ! git rev-parse --verify --quiet "$TARGET^{commit}" >/dev/null; then
  echo "REFUSED: '$TARGET' is not a commit this checkout can see." >&2
  exit 1
fi
SHA="$(git rev-parse "$TARGET")"

if ! git rev-parse --verify --quiet origin/main >/dev/null; then
  echo "REFUSED: no origin/main." >&2
  exit 1
fi

if [ "$(git rev-parse origin/main)" = "$SHA" ]; then
  echo "Nothing to promote — main already has $(git log --oneline -1 "$SHA")."
  exit 0
fi

if ! git merge-base --is-ancestor origin/main "$SHA"; then
  echo "REFUSED: origin/main has commits that $TARGET does not." >&2
  echo "  Something reached production outside this flow, and fast-forwarding" >&2
  echo "  would drop it. See what:  git log --oneline $SHA..origin/main" >&2
  exit 1
fi

echo "About to promote to PRODUCTION:"
git --no-pager log --oneline origin/main.."$SHA"
echo

# The migrations question, asked rather than assumed. `supabase db push`
# against prod is a separate, deliberate act (scripts/db-push-prod.sh) and
# this script does not run it — but promoting code whose migrations have not
# landed is how a deploy 500s on its first request.
#
# Until 2026-09-14 this printed a reminder and then pushed in the same breath,
# so the warning scrolled past after it could change anything. v0.75.3 made it
# concrete: two migrations that organisation search depends on, staging-only,
# and a promotion that would have shipped the code without them. So a range
# that adds migrations now STOPS, and goes on only when told the migrations
# are on production:
#
#   ./scripts/db-push-prod.sh
#   MIGRATIONS_ON_PROD=yes ./scripts/promote.sh
#
# A confirmation rather than a check against the prod database on purpose: a
# check would need production database credentials wherever promote runs and
# would parse CLI table output that changes between versions. A guard that
# fails for the wrong reason blocks promotions; this one cannot.
MIGRATIONS="$(git --no-pager diff --name-only origin/main.."$SHA" -- supabase/migrations)"
if [ -n "$MIGRATIONS" ]; then
  echo "This range adds migrations:"
  printf '%s\n' "$MIGRATIONS" | sed 's/^/    /'
  echo
  if [ "${MIGRATIONS_ON_PROD:-}" != "yes" ]; then
    echo "STOPPED before promoting: production must have these migrations first." >&2
    echo "  1. ./scripts/db-push-prod.sh" >&2
    echo "  2. MIGRATIONS_ON_PROD=yes ./scripts/promote.sh${1:+ $1}" >&2
    echo "Nothing was pushed." >&2
    exit 1
  fi
  echo "MIGRATIONS_ON_PROD=yes — going on."
  echo
fi

# No `| head` here: under `set -o pipefail` a long diff would SIGPIPE git and
# abort the whole promotion one line before the push.
API_CHANGED="$(git --no-pager diff --name-only origin/main.."$SHA" -- apps/api packages/shared)"

git push origin "$SHA":main
echo "Promoted. Production is now $(git log --oneline -1 "$SHA")."

# The push deploys the web apps (Vercel builds main) but NOT the API, which
# runs on Fly and deploys only when told to. Code and database drift apart per
# environment exactly this way — staging's API was once three hours behind its
# own database — so say so at the one moment it matters.
if [ -n "$API_CHANGED" ]; then
  echo
  echo "This range changes the API. The push did not deploy it — Fly deploys only when told:"
  echo "    fly deploy --remote-only"
fi
