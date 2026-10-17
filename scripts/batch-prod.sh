#!/usr/bin/env bash
#
# The whole production sitting, in one command.
#
#   ./scripts/batch-prod.sh <sha> [--dry-run]
#
# Sjoerd, 2026-10-12: *"every time I have to put 4 times the RUN button...
# Can't we make the batch go in one run"*. Four presses, because the sitting
# is four commands with two waits in the middle — and one of those waits is
# for a second clearance that only exists because the first one did not cover
# the API deploy.
#
# ── What it does, in order ────────────────────────────────────────────────
#
#   0. Refuses without a `batch-prod` clearance for THIS sha, granted with
#      --sjoerd-said. Prints the holder and his quoted words first.
#   1. Fast-forwards this checkout to origin/staging and asserts it is <sha>.
#   2. Pushes migrations to production, then re-reads the remote history and
#      refuses if any local migration is still unapplied.
#   3. PREFLIGHT GATES.
#   4. Promotes staging to main.
#   5. Deploys the API from a detached worktree at <sha>.
#
# ── Why the gates sit between the db push and the promote ─────────────────
#
# Not at the top, which is where a gate belongs in general. Batch 15's own
# gate asks whether a COLUMN THAT THIS SITTING CREATES has been set for one
# workspace — so a gate running before the push would ask about a column that
# does not exist yet and refuse batch 15 for ever, which would look exactly
# like the gate working. After the push, the question is answerable.
#
# A gate failing there stops with the database updated and NOTHING promoted
# or deployed, and says so. That is a safe place to stop: the schema is
# additive and the old code ignores it. Re-running after fixing the gate
# skips the push as up to date and carries on.
#
# ── Re-running after a failure ────────────────────────────────────────────
#
# Safe at every step, by construction rather than by luck:
#   db push  — Supabase skips migrations already in the remote history.
#   gates    — read-only.
#   promote  — exits 0 with "Nothing to promote" when main already has it.
#   api      — always redeploys; wasteful, never wrong, and it is last.
#
set -euo pipefail

# RUN FROM A COPY (2026-10-17). This script fast-forwards the very checkout it
# lives in (step "Checkout"), and bash reads a script as it runs: a sitting
# that pulls in a NEW batch-prod.sh would carry on executing whatever bytes
# now sit at its read position in the changed file. So, before anything else,
# it copies itself to a temp file and execs that; the copy cannot change under
# it. BATCH_PROD_SELF carries the real path, so everything relative to the
# repository still resolves, and stops the copy from copying itself again.
if [ -z "${BATCH_PROD_SELF:-}" ]; then
  BATCH_PROD_SELF="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"
  BATCH_PROD_COPY="$(mktemp "${TMPDIR:-/tmp}/batch-prod.XXXXXX")"
  cp "$BATCH_PROD_SELF" "$BATCH_PROD_COPY"
  export BATCH_PROD_SELF BATCH_PROD_COPY
  exec bash "$BATCH_PROD_COPY" "$@"
fi
SELF="$BATCH_PROD_SELF"
SCRIPTS_DIR="$(dirname "$SELF")"
trap 'rm -f "${BATCH_PROD_COPY:-}"' EXIT
# A test seam: hold here until a file exists, so a test can change the file
# on disk while this run is in flight (scripts/batch-prod.test.mjs).
if [ -n "${BATCH_PROD_TEST_HOLD:-}" ]; then
  : > "$BATCH_PROD_TEST_HOLD.ready"
  while [ ! -e "$BATCH_PROD_TEST_HOLD" ]; do sleep 0.1; done
fi
cd "$SCRIPTS_DIR/.."

# A way to ask, on its own, what production reports as applied. Useful before
# a sitting ("is the schema already where I think it is?"), and it is how the
# parser below is tested — the case that matters is a listing with a LOCAL-ONLY
# row, which a live database cannot be asked to produce on demand.
if [ "${1:-}" = "--remote-migrations" ]; then
  ${BATCH_PROD_LIST_CMD:-supabase migration list} 2>/dev/null \
    | awk -F'|' 'NF >= 2 { gsub(/[^0-9]/, "", $2); if ($2 != "") print $2 }'
  exit 0
fi

SHA="${1:-}"
DRY=0
shift || true
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    *) echo "usage: $SELF <sha> [--dry-run]" >&2; exit 2 ;;
  esac
done
[ -n "$SHA" ] || { echo "usage: $SELF <sha> [--dry-run]" >&2; exit 2; }

# What the person typed, kept for the messages. Everything else uses the
# resolved full sha.
SHA_TYPED="$SHA"

# RESOLVE ONCE, TO THE FULL SHA.
#
# The first real sitting stopped with "cleared for 2218c60a, you asked for
# 2218c60a" — two identical strings, and a refusal between them. The clearance
# stores the full sha; Sjoerd typed the short one he had been given; the
# comparison was a string compare; and both sides of the message were
# truncated to eight characters, so the message hid the very difference it was
# reporting. Nothing ran, so it cost a restart rather than a half-cutover.
#
# A dry run could never have caught it: with no clearance there is nothing to
# compare, so the rehearsal skipped the line that was wrong.
if ! SHA="$(git rev-parse --verify --quiet "${SHA_TYPED}^{commit}")"; then
  # Not known locally yet — fetch once, then try again, before giving up.
  git fetch -q --no-tags origin staging main 2>/dev/null || true
  if ! SHA="$(git rev-parse --verify --quiet "${SHA_TYPED}^{commit}")"; then
    echo "batch-prod: '${SHA_TYPED}' is not a commit this checkout knows, even after fetching." >&2
    echo "   Nothing ran. Check the sha, or fetch the branch it is on." >&2
    exit 1
  fi
fi

say()  { printf '%s\n' "$*"; }

# The versions `supabase migration list` reports as APPLIED REMOTELY.
#
# The output is a three-column table — Local | Remote | Time — so grepping the
# whole thing for a version matches that version's own LOCAL column and the
# check passes for a migration that is missing remotely. It is the vacuous
# shape: it answers "is this migration known here", which is never in doubt.
# Only the second column is evidence.
#
# BATCH_PROD_LIST_CMD exists so a test can feed a fixture listing with a
# local-only row, which is the case that must refuse and the one a live run
# cannot produce on demand.
migration_remote_versions() { "$SELF" --remote-migrations; }
step() { printf '\n── %s\n' "$*"; }
# One line naming the step, and that nothing after it ran. A failure in the
# middle of a production sitting is the moment to be unambiguous about how
# far it got.
fail() { printf '\nBATCH STOPPED at %s: %s\n   Nothing after this step ran.\n' "$1" "$2" >&2; exit 1; }

# ── 0. The clearance ──────────────────────────────────────────────────────
# ONE SITTING AT A TIME (2026-10-17): batch 42 ran twice at once from two
# terminals and both reached `fly deploy`. The lock is taken before anything
# else, and covers the API deploy too (deploy-api-prod), so a separate
# deploy-api.sh prod cannot start in the middle of a sitting either. The
# sitting's own deploy-api.sh inherits the token and goes through.
# shellcheck source=lib/run-lock.sh
. "$SCRIPTS_DIR/lib/run-lock.sh"
if [ "$DRY" != 1 ]; then
  RUN_LOCK_ARGS="$SHA_TYPED"
  run_lock_acquire batch-prod || exit 75
  run_lock_acquire deploy-api-prod || exit 75
  trap 'run_lock_release_all; rm -f "${BATCH_PROD_COPY:-}"' EXIT
fi

step "Clearance"
CL="$(./scripts/runway.sh clearance 2>/dev/null || true)"

# A DRY RUN NEEDS NO CLEARANCE, and that is a judgement rather than a
# convenience. A live batch-prod clearance is real production authority for as
# long as it is held — the script's own --dry-run flag does not make it less
# so — and granting one to rehearse would mean quoting Sjoerd as approving a
# sha he has not seen. So the rehearsal reports what it WOULD need and then
# exercises every read-only check instead.
if [ "$DRY" = 1 ] && [ -z "$CL" ]; then
  say "  would need: a batch-prod clearance for ${SHA:0:8}"
  say "  held now  : none"
  say "  (a dry run needs no clearance — see the comment in this script)"
  C_SESSION=""; C_SAID=""; C_LEFT=90
fi

if [ "$DRY" != 1 ] || [ -n "$CL" ]; then
[ -n "$CL" ] || fail "clearance" "the runway holds no clearance. Ask the controller for:
    ./scripts/runway.sh clear <session> --kind batch-prod --sjoerd-said \"<your words>\""
cl() { printf '%s\n' "$CL" | sed -n "s/^$1=//p"; }
C_SESSION="$(cl session)"; C_KIND="$(cl kind)"; C_SHA="$(cl sha)"
C_SAID="$(cl said)"; C_LEFT="$(cl minutes_left)"

[ "$C_KIND" = "batch-prod" ] || fail "clearance" "the runway holds a '$C_KIND' clearance, not 'batch-prod'. One clearance must cover the whole sitting."
# Both sides are full shas by now. The message prints them IN FULL: two
# truncated shas that differ in their tail look identical, and a refusal whose
# explanation reads as a tautology sends somebody hunting for the wrong thing.
[ "$C_SHA" = "$SHA" ] || fail "clearance" "this clearance is for a different commit.
     cleared : $C_SHA
     asked   : $SHA$([ "$SHA_TYPED" != "$SHA" ] && printf '   (you typed %s)' "$SHA_TYPED")"
[ -n "$C_SAID" ] || fail "clearance" "the clearance carries no --sjoerd-said. Production is Sjoerd's decision; it cannot be granted without his words."

say "  held by : $C_SESSION"
if [ "$SHA_TYPED" != "$SHA" ]; then
  say "  sha     : ${SHA:0:8}  (resolved from $SHA_TYPED)"
else
  say "  sha     : ${SHA:0:8}"
fi
say "  expires : in ${C_LEFT} min"
say "  Sjoerd said: \"$C_SAID\""
say ""
say "  ^ Those are the words this sitting is being run on. If they are not"
say "    yours, or not about this, stop now."
fi

# The clearance is held by a chat; the sitting is run by a person. Act as the
# holder, and let the log record who actually typed it.
export RUNWAY_SESSION="$C_SESSION"
export BATCH_PROD_RUNNER="${USER:-unknown}"

# ── 1. The commit ─────────────────────────────────────────────────────────
step "Checkout"
git fetch -q --no-tags origin staging main || fail "checkout" "could not fetch origin."
STAGING="$(git rev-parse origin/staging)"
[ "$STAGING" = "$SHA" ] || fail "checkout" "origin/staging is not the commit you asked for.
     origin/staging : $STAGING
     asked          : $SHA
   Something landed after the clearance; get a new one for the new head."

if [ "$(git rev-parse HEAD)" != "$SHA" ]; then
  if [ "$DRY" = 1 ]; then
    say "  would fast-forward this checkout to ${SHA:0:8}"
  else
    git merge --ff-only "$SHA" >/dev/null 2>&1 \
      || fail "checkout" "cannot fast-forward this checkout to ${SHA:0:8}. Commit or stash what is here first."
  fi
fi
[ -z "$(git status --porcelain --untracked-files=no)" ] \
  || fail "checkout" "this checkout has uncommitted changes. A production sitting runs what was reviewed, not what is lying around."
say "  origin/staging == ${SHA:0:8}, tree clean"

# ── 1b. The shared package's build ────────────────────────────────────────
# @thefibre/shared emits a compiled dist/, and the fast-forward above brings
# its SOURCE but not its build. Everything this sitting runs with node — the
# preflight gate's helper, and every apps/api/scripts/*.mjs Sjoerd runs on
# production after it — imports the dist. After batch 31 those scripts died
# with ERR_MODULE_NOT_FOUND (fixed-renewal.js): a new shared module in the
# source, an old dist on disk. Built HERE, before the database step, and
# fail-closed: a build that fails stops the sitting with nothing pushed,
# promoted or deployed.
step "Shared build"
if [ "$DRY" = 1 ]; then
  say "  would run: pnpm --filter @thefibre/shared build"
else
  pnpm --filter @thefibre/shared build >/dev/null 2>&1 \
    || fail "shared build" "pnpm --filter @thefibre/shared build failed (run it by hand to see why; a fresh worktree needs pnpm install first).
   Nothing pushed, nothing promoted, nothing deployed."
  say "  @thefibre/shared built at ${SHA:0:8}"
fi

# ── 2. Migrations ─────────────────────────────────────────────────────────
step "Database"
if [ "$DRY" = 1 ]; then
  # A dry run touches Supabase NOT AT ALL — it does not even link, because
  # `supabase link` is machine-global state and a rehearsal has no business
  # repointing the CLI. So the migration-gap check below is the one thing a
  # dry run cannot exercise; it is listed under NOT REHEARSED at the end.
  say "  would run: ./scripts/db-push-prod.sh --yes"
  say "  would then re-read \`supabase migration list\` and refuse if any of"
  say "  these $(ls supabase/migrations/*.sql | wc -l | tr -d ' ') local migrations were missing on production"
else
  ./scripts/db-push-prod.sh --yes || fail "database" "supabase db push failed. Nothing promoted, nothing deployed."

  # Read the remote history BACK rather than trusting the push's exit code.
  # promote.sh cannot see this, and a migration present locally and absent on
  # production is the gap that has bitten this repo before.
  say "  checking every local migration is on production…"
  REMOTE="$(migration_remote_versions)"
  MISSING=""
  for f in supabase/migrations/*.sql; do
    v="$(basename "$f" | cut -d_ -f1)"
    printf '%s\n' "$REMOTE" | grep -qx "$v" || MISSING="$MISSING $v"
  done
  [ -z "$MISSING" ] || fail "database" "these migrations are not on production after the push:$MISSING
   Nothing promoted, nothing deployed."
  say "  every local migration is applied on production"
fi

# ── 3. PREFLIGHT GATES ────────────────────────────────────────────────────
#
# Conditions that must hold before PRODUCTION CODE goes out, which cannot be
# expressed as a test because they are about production DATA.
#
# Each entry names what removes it. A gate with no end date becomes furniture.
step "Preflight gates"

GATE_FAIL=""

# GATE 1 — the Zoom Marketplace reviewer's workspace.
#   REMOVE THIS GATE when ZOOM_MARKETPLACE_PENDING becomes false. It reads
#   that constant from the API source AT THIS SHA rather than carrying its own
#   copy, so switching the flag off cannot leave the gate stuck on.
if grep -q 'ZOOM_MARKETPLACE_PENDING = true' apps/api/src/lib/zoom-pending.ts 2>/dev/null; then
  say "  zoom notice: ZOOM_MARKETPLACE_PENDING is true at this sha — checking the exemption"
  # Run from apps/api: only that package resolves @supabase/supabase-js, and
  # FIBRE_ENV_FILE is inherited so a staging dry run checks staging.
  STACK="production"
  if [ "${FIBRE_ENV_FILE:-.env}" != ".env" ]; then
    STACK="the stack in ${FIBRE_ENV_FILE}"
    # Worth saying plainly, because the combination is a hybrid: only the
    # GATE follows FIBRE_ENV_FILE. db-push-prod.sh, promote.sh and the API
    # deploy all target production whatever it says — they are pinned to the
    # production project ref and to origin/main. So a rehearsal pointed at
    # staging checks the staging flag against a plan that would touch
    # production, and nobody should have to infer that from a filename.
    say "  (FIBRE_ENV_FILE is set, so only THIS GATE reads $STACK —"
    say "   the database, promote and API steps always mean production)"
  fi
  FLAGGED="$( cd apps/api && node scripts/zoom-flagged-workspaces.mjs 2>&1 || true )"
  if printf '%s' "$FLAGGED" | grep -q '^name='; then
    printf '%s\n' "$FLAGGED" | sed -n 's/^name=/    flagged: /p'
    say "  ^ the notice is hidden for the workspace(s) above. Confirm that is the reviewer's."
  elif printf '%s' "$FLAGGED" | grep -qx 'none'; then
    # Looked, found nobody. The flag needs setting.
    GATE_FAIL="zoom"
    say "  NO WORKSPACE on $STACK carries zoom_notice_hidden."
  else
    # Anything else — an `error=` line, a crash, or silence — means NOBODY
    # LOOKED. That is a different instruction to a different person, and
    # until v1.155.2 a crashing lookup landed in the branch above: its stderr
    # carried no marker, so "the tooling is broken" was reported as "go set
    # the flag". Found by running a dry run from a fresh worktree, with no
    # node_modules for the helper to import.
    GATE_FAIL="zoom-lookup"
    say "  COULD NOT CHECK the exemption:"
    # `|| true` on both: under `set -o pipefail` a grep that matches nothing
    # fails the pipeline, and `set -e` then kills the script BEFORE it can
    # print why it stopped — which is exactly what happened here, and is the
    # second time today a bare pipeline has silently ended a run. Any pipeline
    # in this script whose components may legitimately match nothing needs it.
    printf '%s\n' "$FLAGGED" | sed -n 's/^error=/    /p' || true
    printf '%s\n' "$FLAGGED" | grep -v '^error=' | head -3 | sed 's/^/    /' || true
  fi
else
  say "  zoom notice: the flag is off at this sha — gate retired, delete it"
fi

# What actually happened differs between a real sitting and a rehearsal, and
# every message below has to say the true one. A dry run pushed nothing;
# claiming "the database IS updated" there is false, and a safety message that
# misstates what happened teaches people to skim it. Computed once, above both
# stop branches, because the first version of this fix lived inside the second
# branch and left the first one saying the wrong thing.
if [ "$DRY" = 1 ]; then
  STATE="  Nothing was written anywhere — this was a dry run. In a real
  sitting the database would be updated by now, and nothing promoted."
else
  STATE="  The database IS updated. Nothing was promoted and nothing was
  deployed. That is a safe place to stand: the schema is additive and the
  code now on production ignores it."
fi

if [ "$GATE_FAIL" = "zoom-lookup" ]; then
  cat >&2 <<EOF

BATCH STOPPED at preflight gates: the exemption could not be CHECKED.

$STATE

  This is not "the flag is missing" — it is "nobody looked", and they send you
  to do completely different things. The reason is printed above; usually
  apps/api/.env is absent, its credentials are stale, or this checkout has no
  node_modules (a fresh worktree does not — run pnpm install, or run the
  sitting from the main checkout).
  Fix that and re-run; the database step will skip itself.
EOF
  exit 1
fi

if [ -n "$GATE_FAIL" ]; then
  cat >&2 <<EOF

BATCH STOPPED at preflight gates: the Zoom reviewer's workspace is not exempt.

$STATE

  The notice would otherwise tell the Zoom Marketplace reviewer that the
  integration he is reviewing is "still under request" and that he should use
  Google instead.

  Do this, then re-run this same command:

      cd apps/api
      node scripts/zoom-notice-optout.mjs --workspace-name "<his workspace>"
      node scripts/zoom-notice-optout.mjs --workspace-name "<his workspace>" --apply

  The re-run skips the database step as already up to date.
EOF
  exit 1
fi

# ── 4. Promote ────────────────────────────────────────────────────────────
#
# The time check belongs HERE and not at the top. Stopping before the promote
# is safe; stopping between the promote and the API deploy leaves production
# half cut over, which is the one state worth engineering against.
step "Promote"
# `|| true` matters more than it looks. Under `set -o pipefail` this
# substitution carries runway.sh's exit status, and `runway.sh clearance`
# exits 1 when the runway is free — so with `set -e` the script DIED HERE,
# silently, with no message and no step name, immediately before the promote.
# A rehearsal found it; in a real sitting it would fire exactly when the
# clearance had expired mid-way, which is the moment that most needs a clear
# message.
CL_NOW="$(./scripts/runway.sh clearance 2>/dev/null || true)"
LEFT="$(printf '%s\n' "$CL_NOW" | sed -n 's/^minutes_left=//p')"

if [ "$DRY" != 1 ] && [ -z "$CL_NOW" ]; then
  fail "promote (not started)" "the clearance is gone — expired, aborted, or landed by something else.
   Nothing promoted, nothing deployed. The database is updated, which is safe.
   Get a fresh batch-prod clearance and re-run; the database step will skip itself."
fi

# A rehearsal with no clearance checks the ARITHMETIC against the 90 a real
# one would carry, rather than skipping the step and leaving it unexercised.
[ -n "$LEFT" ] || LEFT="${C_LEFT:-90}"
if [ -n "$LEFT" ] && [ "$LEFT" -lt 30 ] 2>/dev/null; then
  fail "promote (not started)" "only ${LEFT} min left on the clearance, and the promote plus the API deploy need more than that.
   Nothing promoted, nothing deployed — which is the safe place to stop.
   Ask for a fresh clearance and re-run; the database step will skip itself."
fi
say "  ${LEFT} min left on the clearance"

if [ "$DRY" = 1 ]; then
  say "  would run: MIGRATIONS_ON_PROD=yes ./scripts/promote.sh $SHA"
else
  MIGRATIONS_ON_PROD=yes ./scripts/promote.sh "$SHA" \
    || fail "promote" "promote.sh failed. The database is updated; the API was NOT deployed."
fi

# ── 5. The API ────────────────────────────────────────────────────────────
#
# From a DETACHED WORKTREE at <sha>, because deploy-api.sh builds what is in
# the working tree and this checkout may hold anything. Two incidents came
# from exactly that (see the head of deploy-api.sh).
step "API"
WT=".claude/worktrees/batch-prod-$$"
cleanup_wt() { git worktree remove --force "$WT" >/dev/null 2>&1 || true; }
trap 'cleanup_wt; run_lock_release_all; rm -f "${BATCH_PROD_COPY:-}"' EXIT

if [ "$DRY" = 1 ]; then
  say "  would deploy the API to production from a detached worktree at ${SHA:0:8}"
else
  git worktree add --detach "$WT" "$SHA" >/dev/null 2>&1 \
    || fail "api" "could not create the deploy worktree. The database is updated and main is promoted; the API is NOT deployed."
  ( cd "$WT" && RUNWAY_SESSION="$C_SESSION" ./scripts/deploy-api.sh prod \
      --behind-auth "Production sitting for ${SHA:0:8} (batch-prod.sh, run by $BATCH_PROD_RUNNER). Promoted web and API go out together; what changed is covered by this release's CHANGELOG." ) \
    || fail "api" "deploy-api.sh failed. The database is updated and main is promoted; the API is NOT deployed. Re-run this command — the earlier steps will skip themselves."
  cleanup_wt
fi

# ── Done ──────────────────────────────────────────────────────────────────
# The sitting is over: now the batch releases what it has been holding since
# step 0. promote.sh and deploy-api.sh each tried to `land` on the way past
# and were told the batch still holds it (runway.sh cmd_land).
if [ "$DRY" != 1 ]; then
  RUNWAY_BATCH_FINAL=1 ./scripts/runway.sh land >/dev/null 2>&1 || true
fi

MAIN="$(git rev-parse --short origin/main 2>/dev/null || echo '?')"
if [ "$DRY" = 1 ]; then
  printf '\nDRY RUN OK %s — every precondition passed; nothing was written.\n' "${SHA:0:8}"
  printf 'NOT REHEARSED by a dry run: the db push itself, the migration-gap\n'
  printf 'check that follows it, the promote, and the API deploy. A dry run\n'
  printf 'touches neither Supabase nor Fly nor origin/main.\n'
else
  printf '\nBATCH DONE %s — db: up to date · web: main=%s · api: deployed from %s\n' \
    "${SHA:0:8}" "$MAIN" "${SHA:0:8}"
fi
