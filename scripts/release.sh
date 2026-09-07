#!/usr/bin/env bash
# The atomic tail of the release ritual: guard → consistency check → verify
# → push, in ONE script with set -e, so a refusal anywhere stops the push.
# Born 2026-09-08 after commit 928898c: release-guard refused a version but
# a broken && chain pushed the mislabeled commit anyway. If pushes only
# ever happen through this script, that cannot recur.
#
# Usage: ./scripts/release.sh <version>
# Expects the release commit to already exist locally (ten package.jsons,
# apps/web/lib/version.ts and the CHANGELOG heading all at <version>).
set -euo pipefail

V="${1:?usage: release.sh <version>}"
cd "$(dirname "$0")/.."

git fetch origin
./scripts/release-guard.sh "$V"

# Every version surface must already agree with $V — refuse a half-prepared
# release rather than pushing one.
for f in package.json apps/web/package.json apps/api/package.json \
  apps/meet/package.json apps/thread/package.json apps/flow/package.json \
  apps/pulse/package.json apps/membership/package.json \
  apps/website/package.json packages/shared/package.json; do
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

git push origin main main:staging
echo "Released $V."
