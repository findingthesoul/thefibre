#!/usr/bin/env bash
# Self-test for runway.sh, in a throwaway origin + clone so the real repo and
# its clearance file are never touched.   ./scripts/runway.test.sh
set -uo pipefail
# release.sh runs verify WITH these set; the checks below must not inherit them.
unset RUNWAY_SESSION RUNWAY_BYPASS
SRC="$(cd "$(dirname "$0")" && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fails=0
ok()   { echo "  ok   $1"; }
bad()  { echo "  FAIL $1"; fails=$((fails + 1)); }
expect_fail() { local n="$1"; shift; if "$@" >/dev/null 2>&1; then bad "$n (should have been refused)"; else ok "$n"; fi; }
expect_pass() { local n="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$n"; else bad "$n (should have passed)"; fi; }

git init -q --bare "$T/origin.git"
git clone -q "$T/origin.git" "$T/w" 2>/dev/null
cd "$T/w"
git config user.email t@t; git config user.name t
mkdir -p scripts docs; cp "$SRC/runway.sh" scripts/runway.sh
echo 'process.exit(0)' > scripts/check-migration-versions.mjs
echo base > a.txt; git add -A; git commit -qm base
git branch -M main; git push -q origin main
git branch staging; git push -q origin staging; git fetch -q origin
git checkout -q -b work origin/staging
R=./scripts/runway.sh
req() { RUNWAY_SESSION="$1" $R request --kind "$2" --what x --verified "typecheck" --unverified "render" >/dev/null; }

echo "request"
expect_fail "request without --unverified" env RUNWAY_SESSION=a $R request --kind release --what x --verified y
expect_fail "request without a session name" $R request --kind release --what x --verified y --unverified z

echo "one runway, one clearance"
expect_fail "check with no clearance" env RUNWAY_SESSION=a $R check --kind release
echo c1 > code.txt; git add -A; git commit -qm c1
req a release; req b release
expect_pass "clear a" $R clear a --by atc
expect_fail "clear b while a holds it" $R clear b --by atc
expect_fail "b cannot land on a's clearance" env RUNWAY_SESSION=b $R check --kind release
expect_pass "a can land" env RUNWAY_SESSION=a $R check --kind release
expect_fail "a cannot use it as another kind" env RUNWAY_SESSION=a $R check --kind prod

echo "hook"
$R install-hook >/dev/null
expect_fail "push to staging without clearance is refused" git push -q origin HEAD:staging
expect_pass "push to a feature branch is not controlled" git push -q origin HEAD:refs/heads/feature-x
expect_pass "a's push to staging with clearance" env RUNWAY_SESSION=a git push -q origin HEAD:staging
expect_pass "land frees the runway" env RUNWAY_SESSION=a $R land
$R status | grep -q "Runway free" && ok "status says free" || bad "status says free"

echo "the base moved: a lost race is refused, not discovered later"
git checkout -q -b work2 origin/staging; echo c2 > code2.txt; git add -A; git commit -qm c2
req a release; $R clear a --by atc >/dev/null
git clone -q "$T/origin.git" "$T/other" 2>/dev/null
( cd "$T/other" && git config user.email t@t && git config user.name t && git checkout -q staging && echo sneaky > s.txt && git add -A && git commit -qm sneaky && git push -q origin staging ) >/dev/null 2>&1
expect_fail "clearance is void once staging moved" env RUNWAY_SESSION=a $R check --kind release
$R status | grep -q "Runway free" && ok "void clearance frees the runway" || bad "void clearance frees the runway"

echo "preflight"
git merge -q --ff-only origin/staging 2>/dev/null || git rebase -q origin/staging 2>/dev/null
req a release; git commit -q --allow-empty -m e
echo code > docs/notes.md; echo oops > src.ts; git add -A; git commit -qm mixed
RUNWAY_SESSION=a $R request --kind docs --what d --verified v --unverified none >/dev/null
expect_fail "kind=docs touching code is refused" $R clear a --by atc --kind docs
rm -f "$T/w/.git/runway/queue/"*
git checkout -q -b stale origin/staging~1; echo z > z.txt; git add -A; git commit -qm z
req a release
expect_fail "a commit not built on staging is refused" $R clear a --by atc
rm -f "$T/w/.git/runway/queue/"*

echo "production is Sjoerd's"
git checkout -q work2; req a prod
expect_fail "prod without --sjoerd-said is refused" $R clear a --by atc
expect_pass "prod with his words is granted" $R clear a --by atc --sjoerd-said "promote it"
$R abort --by atc >/dev/null

echo "expiry and escape hatches"
git fetch -q origin; git checkout -q -B work3 origin/staging; echo c3 > code3.txt; git add -A; git commit -qm c3
req a release; $R clear a --by atc --minutes 0 >/dev/null
expect_fail "an expired clearance is refused" env RUNWAY_SESSION=a $R check --kind release
expect_pass "RUNWAY_BYPASS passes" env RUNWAY_BYPASS="test" $R check --kind release
grep -q BYPASS "$T/w/.git/runway/log" && ok "bypass is logged" || bad "bypass is logged"
expect_pass "bypass lets a push through the hook" env RUNWAY_BYPASS=test git push -q origin HEAD:staging
expect_fail "deleting staging is refused" git push -q origin :staging

echo
[ "$fails" = 0 ] && { echo "runway: all passed"; exit 0; } || { echo "runway: $fails failed"; exit 1; }
