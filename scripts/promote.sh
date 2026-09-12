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
# landed is how a deploy 500s on its first request, so it is worth a look.
if git --no-pager diff --name-only origin/main.."$SHA" -- supabase/migrations | grep -q .; then
  echo "This range adds migrations:"
  git --no-pager diff --name-only origin/main.."$SHA" -- supabase/migrations | sed 's/^/    /'
  echo "  Apply them to production FIRST (./scripts/db-push-prod.sh) if you have not."
  echo
fi

git push origin "$SHA":main
echo "Promoted. Production is now $(git log --oneline -1 "$SHA")."
