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
cd "$(dirname "$0")/.."

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
    *) echo "usage: $0 <sha> [--dry-run]" >&2; exit 2 ;;
  esac
done
[ -n "$SHA" ] || { echo "usage: $0 <sha> [--dry-run]" >&2; exit 2; }

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
migration_remote_versions() { "$0" --remote-migrations; }
step() { printf '\n── %s\n' "$*"; }
# One line naming the step, and that nothing after it ran. A failure in the
# middle of a production sitting is the moment to be unambiguous about how
# far it got.
fail() { printf '\nBATCH STOPPED at %s: %s\n   Nothing after this step ran.\n' "$1" "$2" >&2; exit 1; }

# ── 0. The clearance ──────────────────────────────────────────────────────
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
[ "$C_SHA" = "$SHA" ] || fail "clearance" "cleared for ${C_SHA:0:8}, you asked for ${SHA:0:8}."
[ -n "$C_SAID" ] || fail "clearance" "the clearance carries no --sjoerd-said. Production is Sjoerd's decision; it cannot be granted without his words."

say "  held by : $C_SESSION"
say "  sha     : ${SHA:0:8}"
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
[ "$STAGING" = "$SHA" ] || fail "checkout" "origin/staging is ${STAGING:0:8}, not ${SHA:0:8}. Something landed after the clearance; get a new one for the new head."

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
  FLAGGED="$( cd apps/api && node scripts/zoom-flagged-workspaces.mjs 2>&1 || true )"
  if printf '%s' "$FLAGGED" | grep -q '^name='; then
    printf '%s\n' "$FLAGGED" | sed -n 's/^name=/    flagged: /p'
    say "  ^ the notice is hidden for the workspace(s) above. Confirm that is the reviewer's."
  elif printf '%s' "$FLAGGED" | grep -q '^error='; then
    # A failed LOOKUP is not "none flagged", and must not be reported as it:
    # that would send somebody to set a flag that may already be there.
    GATE_FAIL="zoom-lookup"
    say "  COULD NOT CHECK the exemption:"
    printf '%s\n' "$FLAGGED" | sed -n 's/^error=/    /p'
  else
    GATE_FAIL="zoom"
    say "  NO WORKSPACE on production carries zoom_notice_hidden."
  fi
else
  say "  zoom notice: the flag is off at this sha — gate retired, delete it"
fi

if [ "$GATE_FAIL" = "zoom-lookup" ]; then
  cat >&2 <<EOF

BATCH STOPPED at preflight gates: the exemption could not be CHECKED.

  The database IS updated. Nothing was promoted and nothing was deployed.

  This is not "the flag is missing" — it is "nobody looked". The reason is
  printed above; usually apps/api/.env is absent or its credentials are stale.
  Fix that and re-run; the database step will skip itself.
EOF
  exit 1
fi

if [ -n "$GATE_FAIL" ]; then
  cat >&2 <<EOF

BATCH STOPPED at preflight gates: the Zoom reviewer's workspace is not exempt.

  The database IS updated. Nothing was promoted and nothing was deployed.
  That is a safe place to stand: the schema is additive and the code now on
  production ignores it.

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
trap cleanup_wt EXIT

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
