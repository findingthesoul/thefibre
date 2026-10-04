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
# A commit shaped like a release: version in package.json, the same version as
# the top changelog heading, and in the subject. The hook checks all three.
# The changelog is LONG, like the real one (22,000 lines): a check that pipes
# it through `grep -q` or `head -1` dies of SIGPIPE on a long file and passes
# on a short one, which is how release.sh refused its own first release.
HISTORY="$(i=0; while [ $i -lt 3000 ]; do echo "## [0.0.0-$i] — old"; echo "words words words words words words words words"; i=$((i + 1)); done)"
rel() { printf '{ "name": "t", "version": "%s" }\n' "$1" > package.json; { printf '# Changelog\n\n## [Unreleased]\n\n## [%s] — t\n\n' "$1"; printf '%s\n' "$HISTORY"; } > CHANGELOG.md; echo "$1" > "rel-$1.txt"; git add -A; git commit -qm "v$1 — a release"; }

echo "request"
expect_fail "request without --unverified" env RUNWAY_SESSION=a $R request --kind release --what x --verified y
expect_fail "request without a session name" $R request --kind release --what x --verified y --unverified z

echo "one runway, one clearance"
expect_fail "check with no clearance" env RUNWAY_SESSION=a $R check --kind release
rel 0.0.1
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

echo "which request: several from one session"
git fetch -q origin; git checkout -q -B pick1 origin/staging; echo p1 > pick1.txt; git add -A; git commit -qm p1
P1="$(git rev-parse HEAD)"; req a release
git checkout -q -B pick2 origin/staging; mkdir -p docs; echo p2 > docs/pick2.md; git add -A; git commit -qm p2
P2="$(git rev-parse HEAD)"; sleep 1; req a docs
# Captured first: `grep -q` closes the pipe early, and under pipefail the
# writer's SIGPIPE would read as a failure of the thing being tested.
Q="$($R queue)"
grep -q "^#1  a  \[release\]  ${P1:0:8}" <<<"$Q" && ok "queue numbers its entries and shows each sha" || bad "queue numbers its entries and shows each sha"
grep -q "^#2  a  \[docs\]  ${P2:0:8}" <<<"$Q" && ok "queue is oldest first" || bad "queue is oldest first"
expect_fail "two different requests from one session and no --sha is refused, not guessed" $R clear a --by atc
OUT="$($R clear a --by atc 2>&1 || true)"
grep -q "${P1:0:8}" <<<"$OUT" && grep -q "${P2:0:8}" <<<"$OUT" && ok "the refusal lists the choices" || bad "the refusal lists the choices"
expect_fail "--sha that matches nothing is refused" $R clear a --by atc --sha deadbeef
expect_pass "--sha picks the OLDER request" $R clear a --by atc --sha "${P1:0:8}"
grep -q "sha=$P1" "$T/w/.git/runway/clearance" && ok "the clearance is for the commit that was named" || bad "the clearance is for the commit that was named"
[ "$(ls "$T/w/.git/runway/queue" | wc -l | tr -d ' ')" = 1 ] && ok "the other request is still waiting" || bad "the other request is still waiting"
$R abort --by atc >/dev/null
sleep 1; RUNWAY_SESSION=a $R request --kind docs --sha "$P2" --what "corrected wording" --verified v --unverified none >/dev/null
expect_pass "one commit requested twice needs no --sha: the newest wording stands" $R clear a --by atc
[ -z "$(ls "$T/w/.git/runway/queue")" ] && ok "and both entries for that commit are gone" || bad "and both entries for that commit are gone"
$R abort --by atc >/dev/null

echo "a commit that deletes what is on staging"
git fetch -q origin; git checkout -q -B del origin/staging; git rm -q a.txt; mkdir -p docs; echo n > docs/new.md; git add -A; git commit -qm "removes a.txt"
req a release
expect_fail "a release that deletes a file on staging is refused" $R clear a --by atc
OUT="$($R clear a --by atc 2>&1 || true)"
grep -q "DELETES: a.txt" <<<"$OUT" && ok "the refusal names the deleted path" || bad "the refusal names the deleted path"
expect_pass "--allow-delete is the controller saying it is meant" $R clear a --by atc --allow-delete
grep -q "allow-delete" "$T/w/.git/runway/log" && ok "and that is in the log" || bad "and that is in the log"
$R abort --by atc >/dev/null
# A file the commit itself adds and removes again never shows as a deletion.
git checkout -q -B addrm origin/staging; echo t > tmp.txt; git add -A; git commit -qm add; git rm -q tmp.txt; echo k > keep.txt; git add -A; git commit -qm "rm own file"
req a release
expect_pass "removing a file the same branch added is not a deletion" $R clear a --by atc
$R abort --by atc >/dev/null
rm -f "$T/w/.git/runway/queue/"*

echo "docs may sit on a stale base; code may not (Sjoerd, 2026-10-03)"
git fetch -q origin; git checkout -q -B docs-stale origin/staging~1; mkdir -p docs; echo words > docs/stale-words.md; git add -A; git commit -qm "docs on a stale base"
RUNWAY_SESSION=a $R request --kind docs --what d --verified v --unverified none >/dev/null
OUT="$($R clear a --by atc 2>&1)" && ok "a docs commit on a stale base is cleared" || bad "a docs commit on a stale base is cleared"
grep -q "Rebase onto origin/staging before you push" <<<"$OUT" && ok "and the CLEARED line says to rebase first" || bad "and the CLEARED line says to rebase first"
grep -q "base is stale" <<<"$OUT" && ok "and the diff shown is the commit's own, not the head's" || bad "and the diff shown is the commit's own, not the head's"
$R abort --by atc >/dev/null
git checkout -q -B code-stale origin/staging~1; echo c > stale-code.txt; git add -A; git commit -qm "code on a stale base"
req a release
expect_fail "a release on a stale base is still refused" $R clear a --by atc
rm -f "$T/w/.git/runway/queue/"*
git checkout -q -B docs-stale-del origin/staging~1; git rm -q a.txt; mkdir -p docs; echo w > docs/w.md; git add -A; git commit -qm "stale docs that deletes"
RUNWAY_SESSION=a $R request --kind docs --what d --verified v --unverified none >/dev/null
expect_fail "a stale docs commit that deletes a file is refused" $R clear a --by atc
expect_fail "and --allow-delete does not rescue a stale one" $R clear a --by atc --allow-delete
rm -f "$T/w/.git/runway/queue/"*

echo "two docs requests on one path"
git checkout -q -B docs-x origin/staging; mkdir -p docs; echo one > docs/shared-page.md; git add -A; git commit -qm "x writes shared-page"; X="$(git rev-parse HEAD)"
git checkout -q -B docs-y origin/staging; mkdir -p docs; echo two > docs/shared-page.md; echo y > docs/only-y.md; git add -A; git commit -qm "y writes shared-page too"; Y="$(git rev-parse HEAD)"
RUNWAY_SESSION=a $R request --kind docs --sha "$X" --what x --verified v --unverified none >/dev/null
RUNWAY_SESSION=b $R request --kind docs --sha "$Y" --what y --verified v --unverified none >/dev/null
OUT="$($R clear b --by atc 2>&1 || true)"
grep -q "docs/shared-page.md" <<<"$OUT" && grep -q "REFUSED" <<<"$OUT" && ok "the LATER docs request sharing a path with an earlier one is refused, path named" || bad "the LATER docs request sharing a path with an earlier one is refused, path named"
expect_pass "the EARLIER request on that path is cleared: first asked, first landed" $R clear a --by atc
$R abort --by atc >/dev/null
rm -f "$T/w/.git/runway/queue/"*

echo "a landing that does not happen says so"
git fetch -q origin; git checkout -q -B land1 origin/staging; echo l > land1.txt; git add -A; git commit -qm l1
req a release; $R clear a --by atc >/dev/null
OUT="$(RUNWAY_SESSION=b $R land 2>&1)"; RC=$?
grep -q "NOT landed: the runway is held by a for release, and you are b" <<<"$OUT" && ok "land by somebody else says NOT landed, and who holds it" || bad "land by somebody else says NOT landed, and who holds it"
[ "$RC" = 0 ] && ok "and still exits 0 (the deploy that called it has happened)" || bad "and still exits 0 (the deploy that called it has happened)"
OUT="$($R land 2>&1)"
grep -q "you are nobody (RUNWAY_SESSION is not set)" <<<"$OUT" && ok "land with no session name says that too" || bad "land with no session name says that too"
$R status | grep -q "RUNWAY BUSY: a" && ok "and the runway is still a's" || bad "and the runway is still a's"
grep -q "LAND-REFUSED holder=a" "$T/w/.git/runway/log" && ok "and it is in the log" || bad "and it is in the log"
OUT="$(RUNWAY_SESSION=a $R land 2>&1)"; grep -q "Landed. Runway free." <<<"$OUT" && ok "the holder still lands" || bad "the holder still lands"
OUT="$(RUNWAY_SESSION=a $R land 2>&1)"; grep -q "Nothing to land" <<<"$OUT" && ok "landing a free runway says there is nothing to land" || bad "landing a free runway says there is nothing to land"

echo "what may be pushed under a release clearance (4fab772a)"
git fetch -q origin; git checkout -q -B wip1 origin/staging
printf '# Changelog\n\n## [Unreleased]\n\n## [NEXT] — unfinished\n\n## [0.0.1] — t\n' > CHANGELOG.md; echo w > wip.txt; git add -A; git commit -qm "wip: the organiser page was built for a one-line bio"
req a release; $R clear a --by atc >/dev/null
OUT="$(RUNWAY_SESSION=a git push -q origin HEAD:staging 2>&1)" && bad "a wip: commit is refused even WITH a release clearance" || ok "a wip: commit is refused even WITH a release clearance"
grep -q "release.sh" <<<"$OUT" && ok "and the refusal names ./scripts/release.sh" || bad "and the refusal names ./scripts/release.sh"
git commit -q --amend -m "v0.0.2 — named, but the stamps never went in"
OUT="$(RUNWAY_SESSION=a git push -q origin HEAD:staging 2>&1)" && bad "a subject with a version over a [NEXT] changelog is refused" || ok "a subject with a version over a [NEXT] changelog is refused"
grep -q "half-stamped" <<<"$OUT" && ok "and it says half-stamped" || bad "and it says half-stamped"
printf '{ "name": "t", "version": "0.0.2" }\n' > package.json; printf '# Changelog\n\n## [Unreleased]\n\n## [0.0.2] — t\n\n## [0.0.1] — t\n' > CHANGELOG.md; git add -A; git commit -q --amend -m "v0.0.3 — the subject is one number out"
expect_fail "a subject naming a different version from package.json is refused" env RUNWAY_SESSION=a git push -q origin HEAD:staging
git commit -q --amend -m "v0.0.2 — stamped, committed, named"
expect_pass "the same commit, finished, goes through" env RUNWAY_SESSION=a git push -q origin HEAD:staging
RUNWAY_SESSION=a $R land >/dev/null
git fetch -q origin; git checkout -q -B docpush origin/staging; mkdir -p docs; echo d > docs/page.md; git add -A; git commit -qm "docs: a page"
RUNWAY_SESSION=a $R request --kind docs --what d --verified v --unverified none >/dev/null; $R clear a --by atc >/dev/null
expect_pass "a docs: commit under a DOCS clearance is not asked for a version" env RUNWAY_SESSION=a git push -q origin HEAD:staging
RUNWAY_SESSION=a $R land >/dev/null

echo "the lane"
git fetch -q origin; git checkout -q -B lane1 origin/staging; mkdir -p apps/meet apps/thread; echo m > apps/meet/page.tsx; echo s > apps/thread/swept.tsx; rel 0.0.3
RUNWAY_SESSION=a $R request --kind release --lane "apps/meet docs/meet-*.md" --what x --verified v --unverified none >/dev/null
OUT="$($R clear a --by atc 2>&1 || true)"
grep -q "OUTSIDE THE LANE: apps/thread/swept.tsx" <<<"$OUT" && ok "a path outside the declared lane is refused and named" || bad "a path outside the declared lane is refused and named"
grep -q "OUTSIDE THE LANE: package.json\|OUTSIDE THE LANE: CHANGELOG.md" <<<"$OUT" && bad "the version surfaces are never out of lane" || ok "the version surfaces are never out of lane"
grep -q "OUTSIDE THE LANE: apps/meet" <<<"$OUT" && bad "paths inside the lane pass" || ok "paths inside the lane pass"
expect_pass "--allow-out-of-lane is the controller saying it is meant" $R clear a --by atc --allow-out-of-lane
grep -q "allow-out-of-lane" "$T/w/.git/runway/log" && ok "and that is in the log" || bad "and that is in the log"
$R abort --by atc >/dev/null
req a release
expect_pass "no lane declared = no lane check (opt-in)" $R clear a --by atc
$R abort --by atc >/dev/null; rm -f "$T/w/.git/runway/queue/"*

echo "the shared checkout stays on main"
git checkout -q main 2>/dev/null
expect_pass "the main checkout on main passes" $R check-checkout
git checkout -q -B somebody-elses-branch
expect_fail "the main checkout on another branch is refused" $R check-checkout
git checkout -q main
git worktree add -q "$T/wt" -b wt-branch origin/staging 2>/dev/null
( cd "$T/wt" && mkdir -p scripts && cp "$SRC/runway.sh" scripts/runway.sh && ./scripts/runway.sh check-checkout ) >/dev/null 2>&1 && ok "a worktree on its own branch is exempt" || bad "a worktree on its own branch is exempt"
git checkout -q work2

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
