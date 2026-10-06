#!/usr/bin/env bash
# Runway control: air-traffic control for staging, the API and production.
# Sjoerd, 2026-10-01: "No one lands or departs without permission and full
# safety checks."
#
# Several chats share one repo and one staging branch. Announcements between
# them lose races to pushes, so the rule is no longer asked of anyone: it is
# CHECKED, by the scripts every landing and departure already goes through.
#
# One runway, one clearance at a time. The clearance lives in the SHARED git
# directory (`git rev-parse --git-common-dir`), so every worktree sees the same
# file. It is created with noclobber, so two granters cannot both win.
#
#   RUNWAY_SESSION=<name> ./scripts/runway.sh request --kind release \
#       --sha <sha> --what "..." --verified "..." --unverified "..."
#   RUNWAY_SESSION=<name> ./scripts/runway.sh withdraw --sha <sha>   # drop your own stale request
#   ./scripts/runway.sh queue                # who is waiting, and what they say
#   ./scripts/runway.sh status               # who holds the runway now
#   ./scripts/runway.sh clear <name> --by <controller>     # preflight + grant
#       [--sha <sha>]        which of <name>'s requests, when there are several
#       [--allow-delete]     the commit removes files that are on staging, on purpose
#   RUNWAY_SESSION=<name> ./scripts/runway.sh land         # release.sh does this
#   ./scripts/runway.sh abort [--by <controller>]          # free the runway
#   ./scripts/runway.sh install-hook         # once per clone; covers all worktrees
#
# Kinds:  release (release.sh -> staging)   docs (docs-only push to staging)
#         api-staging / api-prod (deploy-api.sh)
#         prod (promote.sh; needs --sjoerd-said "<his words>" to be granted)
#
# What this stops: a second session landing while one holds the runway, a push
# built on a staging that has since moved (the three lost races of 2026-10-01;
# a DOCS-only commit may sit on a stale base and rebase at push time, since
# the runway holds everyone else off meanwhile — Sjoerd's yes, 2026-10-03),
# a docs commit that is not docs, a commit that deletes files that are on
# staging (unless the controller says that is meant), production without
# Sjoerd, and a handover that says nothing about what was NOT verified.
# What it cannot stop: a session that deliberately bypasses it. That path is
# RUNWAY_BYPASS="<reason>", which works and is written to the log, so a bypass
# is visible rather than silent.
set -euo pipefail
cd "$(dirname "$0")/.."

# Shared across worktrees. (`--path-format=absolute` is newer than some gits.)
COMMON="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
DIR="$COMMON/runway"
QUEUE="$DIR/queue"
CLEARANCE="$DIR/clearance"
LOG="$DIR/log"
mkdir -p "$QUEUE"

DEFAULT_MINUTES=45   # a full `pnpm verify` is several minutes; a stale lock must not strand everyone

say()  { printf '%s\n' "$*"; }
die()  { printf 'REFUSED: %s\n' "$*" >&2; exit 1; }
logit() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG"; }
field() { grep "^$1=" "$2" 2>/dev/null | head -1 | cut -d= -f2-; }
now()   { date +%s; }

live_clearance() {
  # Prints nothing and returns 1 when the runway is free; drops an expired one.
  [ -f "$CLEARANCE" ] || return 1
  local exp; exp="$(field expires "$CLEARANCE")"
  if [ -z "$exp" ] || [ "$exp" -le "$(now)" ]; then
    logit "EXPIRED clearance session=$(field session "$CLEARANCE") kind=$(field kind "$CLEARANCE")"
    rm -f "$CLEARANCE"
    return 1
  fi
  return 0
}

# Branch each kind is measured against. A clearance records that branch's sha
# when granted; if it has moved by the time you land, somebody got in ahead of
# you and the clearance is void: re-request on the new base.
base_ref() {
  case "$1" in
    prod|api-prod) echo origin/main ;;
    *)             echo origin/staging ;;
  esac
}

cmd_request() {
  local kind="" sha="" what="" verified="" unverified="" lane=""
  local name="${RUNWAY_SESSION:-}"
  while [ $# -gt 0 ]; do
    case "$1" in
      --kind) kind="$2"; shift 2 ;; --sha) sha="$2"; shift 2 ;;
      --what) what="$2"; shift 2 ;; --verified) verified="$2"; shift 2 ;;
      --unverified) unverified="$2"; shift 2 ;; --lane) lane="$2"; shift 2 ;;
      *) die "unknown option $1" ;;
    esac
  done
  [ -n "$name" ] || die "set RUNWAY_SESSION=<your session name> (e.g. RUNWAY_SESSION=meet)."
  case "$kind" in release|docs|api-staging|api-prod|prod) ;; *) die "--kind must be release|docs|api-staging|api-prod|prod." ;; esac
  [ -n "$what" ] || die "--what: one line on what this is."
  [ -n "$verified" ] || die "--verified: what you checked. Say \"nothing\" if so."
  # Not optional, on purpose: a handover that omits this turns the controller
  # into a rubber stamp, which is worse than the races (CLAUDE.md rule 4).
  [ -n "$unverified" ] || die "--unverified: what you did NOT check. Say \"nothing\" only if that is true."
  [ -n "$sha" ] || sha="$(git rev-parse HEAD)"
  git rev-parse --verify --quiet "$sha^{commit}" >/dev/null || die "$sha is not a commit this clone can see."
  sha="$(git rev-parse "$sha")"
  # The entry's name is the second it was filed plus the session, so two
  # requests from one session in the same second are the SAME file. Until
  # 2026-10-04 the second silently replaced the first and both printed
  # "Queued" (a docs request was lost that way). Created with noclobber now:
  # the second is REFUSED, loudly, and nothing of the first is touched.
  local f="$QUEUE/$(now)-$name"
  if ! ( set -o noclobber; {
      echo "session=$name"; echo "kind=$kind"; echo "sha=$sha"; echo "lane=$lane"
      echo "what=$what"; echo "verified=$verified"; echo "unverified=$unverified"
      echo "requested=$(now)"
    } > "$f" ) 2>/dev/null; then
    die "$name already filed a request in this same second, and this one would have replaced it. NOTHING was queued for ${sha:0:8}. Run the request again."
  fi
  logit "REQUEST session=$name kind=$kind sha=$sha what=$what"
  say "Queued: $name wants $kind for ${sha:0:8}. Wait for clearance; do not push."
  # Read back FROM THE FILE, not from the arguments: what the controller will
  # see is what is stored, and the shell may have changed the text on its way
  # here (backticks and \$( ) inside double quotes RUN before this script sees
  # them; a production request arrived mangled that way). Quote request text
  # with single quotes.
  say "Stored as:"
  say "    kind:       $(field kind "$f")   sha: $(field sha "$f" | cut -c1-8)${lane:+   lane: $(field lane "$f")}"
  say "    what:       $(field what "$f")"
  say "    verified:   $(field verified "$f")"
  say "    UNVERIFIED: $(field unverified "$f")"
}

# withdraw --sha <sha>: a pilot takes its OWN stale entries out of the queue
# (a rebuilt commit leaves the old request behind, and the only way to remove
# it used to be deleting a file in .git by hand). A controller may withdraw
# for somebody with --session <name> --by <controller>. Logged either way.
cmd_withdraw() {
  local want="" who="${RUNWAY_SESSION:-}" by=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --sha) want="$2"; shift 2 ;; --session) who="$2"; shift 2 ;; --by) by="$2"; shift 2 ;;
      *) die "unknown option $1" ;;
    esac
  done
  [ -n "$want" ] || die "usage: RUNWAY_SESSION=<you> runway.sh withdraw --sha <sha>"
  [ -n "$who" ] || die "set RUNWAY_SESSION=<your session name>, or --session <name> --by <controller>."
  if [ "$who" != "${RUNWAY_SESSION:-}" ] && [ -z "$by" ]; then
    die "that is $who's request, not yours. A controller withdraws for somebody with --by <controller>."
  fi
  local e n=0
  for e in $(ls "$QUEUE" 2>/dev/null | grep -- "-$who\$" | sort || true); do
    case "$(field sha "$QUEUE/$e")" in
      "$want"*)
        logit "WITHDRAWN session=$who kind=$(field kind "$QUEUE/$e") sha=$(field sha "$QUEUE/$e")${by:+ by=$by}"
        rm -f "$QUEUE/$e"; n=$((n + 1)) ;;
    esac
  done
  [ "$n" -gt 0 ] || die "$who has no request for $want in the queue."
  say "Withdrawn: $n request(s) of $who for $want."
}

cmd_queue() {
  # Oldest first, numbered: the order is the order of asking, and the sha is
  # what `clear <name> --sha` takes when one session has several requests.
  local any=0 f i=0
  for f in $(ls "$QUEUE" 2>/dev/null | sort); do
    any=1; i=$((i + 1))
    say "#$i  $(field session "$QUEUE/$f")  [$(field kind "$QUEUE/$f")]  $(field sha "$QUEUE/$f" | cut -c1-8)  $(field what "$QUEUE/$f")"
    say "    verified:   $(field verified "$QUEUE/$f")"
    say "    UNVERIFIED: $(field unverified "$QUEUE/$f")"
  done
  [ "$any" = 1 ] || say "Queue empty."
}

cmd_status() {
  if live_clearance; then
    local left=$(( $(field expires "$CLEARANCE") - $(now) ))
    say "RUNWAY BUSY: $(field session "$CLEARANCE") has clearance for $(field kind "$CLEARANCE") ($(( left / 60 )) min left, base $(field base "$CLEARANCE" | cut -c1-8), granted by $(field by "$CLEARANCE"))."
  else
    say "Runway free."
  fi
}

cmd_clear() {
  local name="${1:-}"; shift || true
  local by="" minutes="$DEFAULT_MINUTES" kindopt="" said="" want="" allow_delete=0 allow_lane=0
  while [ $# -gt 0 ]; do
    case "$1" in
      --by) by="$2"; shift 2 ;; --minutes) minutes="$2"; shift 2 ;;
      --kind) kindopt="$2"; shift 2 ;; --sjoerd-said) said="$2"; shift 2 ;;
      --sha) want="$2"; shift 2 ;; --allow-delete) allow_delete=1; shift ;;
      --allow-out-of-lane) allow_lane=1; shift ;;
      *) die "unknown option $1" ;;
    esac
  done
  [ -n "$name" ] || die "usage: clear <session> --by <controller> [--sha <sha>]"
  [ -n "$by" ] || die "--by <controller>: who is granting this, for the log."
  if live_clearance; then
    die "runway busy: $(field session "$CLEARANCE") holds it for $(field kind "$CLEARANCE"). One at a time."
  fi
  # WHICH request. Until 2026-10-02 this took the session's NEWEST entry and
  # nothing else, so a controller could not pick: with two requests waiting
  # from one session it granted (and consumed) the wrong one twice in a day,
  # once with a --kind meant for the other. Now: one entry is taken as before;
  # several need --sha, and are listed rather than guessed at.
  local entries entry="" e
  entries="$(ls "$QUEUE" 2>/dev/null | grep -- "-$name\$" | sort || true)"
  [ -n "$entries" ] || die "$name has no request in the queue. They request first, with what they verified and did not."
  # Several entries for ONE commit are one request corrected in place (the
  # wording changed, the commit did not): no choice to make, the newest stands.
  if [ -z "$want" ]; then
    local shas; shas="$(for e in $entries; do field sha "$QUEUE/$e"; done | sort -u)"
    [ "$(printf '%s\n' "$shas" | wc -l | tr -d ' ')" != 1 ] || want="$shas"
  fi
  if [ -n "$want" ]; then
    local matches=0
    for e in $entries; do
      case "$(field sha "$QUEUE/$e")" in "$want"*) entry="$e"; matches=$((matches + 1)) ;; esac
    done
    [ "$matches" -ge 1 ] || die "$name has no request for $want. Their requests: $(for e in $entries; do printf '%s [%s]  ' "$(field sha "$QUEUE/$e" | cut -c1-8)" "$(field kind "$QUEUE/$e")"; done)"
    # The same sha asked for twice (a corrected request): the newest wording
    # is the one that stands, and the older ones go with it.
    if [ "$matches" -gt 1 ]; then
      for e in $entries; do
        case "$(field sha "$QUEUE/$e")" in "$want"*) [ "$e" = "$entry" ] || rm -f "$QUEUE/$e" ;; esac
      done
    fi
  else
    if [ "$(printf '%s\n' "$entries" | wc -l | tr -d ' ')" -gt 1 ]; then
      {
        echo "REFUSED: $name has several requests waiting; say which with --sha:"
        for e in $entries; do
          echo "    $(field sha "$QUEUE/$e" | cut -c1-8)  [$(field kind "$QUEUE/$e")]  $(field what "$QUEUE/$e")"
        done
      } >&2
      exit 1
    fi
    entry="$entries"
  fi
  local q="$QUEUE/$entry"
  local kind="${kindopt:-$(field kind "$q")}" sha; sha="$(field sha "$q")"

  git fetch -q origin
  local ref base; ref="$(base_ref "$kind")"; base="$(git rev-parse "$ref")"

  # ── Preflight: cheap, and the ones that have actually bitten this repo ────
  local stale=0
  case "$kind" in
    release|docs)
      # The head rule. A RELEASE must sit on the current staging: a stale base
      # ships stale code. A DOCS request need not (Sjoerd, 2026-10-03, relayed
      # by the controller): the runway already guarantees nobody else lands
      # while it holds a clearance, so a docs-only commit can be rebased at
      # push time, and three sessions had each spent a round trip rebasing
      # .md onto each other's .md. What a docs request on a stale base MUST
      # not do is carry a path another waiting request also touches, or
      # delete anything — both checked below.
      if ! git merge-base --is-ancestor "$ref" "$sha"; then
        [ "$kind" = docs ] || die "${sha:0:8} is not built on $ref ($(git rev-parse --short "$ref")). Rebase or fast-forward onto it, request again."
        stale=1
      fi
      # The commit's OWN changes: from where it left the base branch. For a
      # commit on the current head this is the plain diff against the head;
      # for a stale docs commit it is only what it did, not what others did
      # since — the diff that, taken against the head, made a branch look as
      # if it deleted a peer's new file (2026-10-02).
      local from; from="$(git merge-base "$ref" "$sha")"
      local files; files="$(git --no-pager diff --name-only "$from" "$sha")"
      [ -n "$files" ] || die "${sha:0:8} changes nothing against $ref."
      say "Changes ($( [ "$stale" = 1 ] && echo "own, from $(git rev-parse --short "$from"); base is stale" || echo "against $ref")):"; printf '%s\n' "$files" | sed 's/^/    /'
      # A commit that REMOVES files which are on staging. Almost never meant:
      # it is what a rebase resolved the wrong way, or a branch cut before a
      # peer's file landed, looks like — and a docs push is the push nobody
      # reads. (2026-10-02: a docs commit appeared to delete a 149-line
      # proposal another chat had just added.) Refused with the paths named;
      # a deliberate removal is the controller's to wave through, in the log.
      local deleted; deleted="$(git --no-pager diff --name-only --diff-filter=D "$from" "$sha")"
      if [ -n "$deleted" ]; then
        if [ "$allow_delete" = 1 ] && [ "$stale" = 0 ]; then
          say "Deletes files that are on $ref (allowed by $by):"; printf '%s\n' "$deleted" | sed 's/^/    /'
        else
          printf '%s\n' "$deleted" | sed 's/^/    DELETES: /' >&2
          [ "$stale" = 0 ] || die "${sha:0:8} removes files and is not on the current $ref. A stale docs commit may not delete anything; rebase onto $ref and request again."
          die "${sha:0:8} removes files that are on $ref. If that is meant, clear with --allow-delete; if not, the branch lost them in a rebase."
        fi
      fi
      if [ "$kind" = docs ]; then
        local bad; bad="$(printf '%s\n' "$files" | grep -vE '^docs/|\.md$' || true)"
        [ -z "$bad" ] || { printf '%s\n' "$bad" | sed 's/^/    NOT DOCS: /' >&2; die "kind=docs touches code. Request kind=release."; }
        # Nobody else's lane: a path that an OLDER waiting request also changes
        # (its own changes, measured the same way) is refused — first asked,
        # first landed; the newer one rebases over the older's words once they
        # are on staging and asks again. Only older entries count, or two
        # requests on one page would each refuse the other and neither could
        # land. Checked for docs only, because a release is already pinned to
        # the head and lands before anyone else can.
        local other opath overlap=""
        for other in $(ls "$QUEUE" 2>/dev/null | sort); do
          [ "$other" = "$entry" ] && break
          local osha; osha="$(field sha "$QUEUE/$other")"
          git rev-parse --verify --quiet "$osha^{commit}" >/dev/null || continue
          local ofrom; ofrom="$(git merge-base "$(base_ref "$(field kind "$QUEUE/$other")")" "$osha" 2>/dev/null || true)"
          [ -n "$ofrom" ] || continue
          for opath in $(git --no-pager diff --name-only "$ofrom" "$osha"); do
            printf '%s\n' "$files" | grep -qxF -- "$opath" && overlap="$overlap    $opath  (also in $(field session "$QUEUE/$other")'s ${osha:0:8})"$'\n'
          done
        done
        [ -z "$overlap" ] || { printf '%s' "$overlap" >&2; die "${sha:0:8} touches paths an earlier request also changes. Clear that one first; the pilot then rebases and asks again."; }
      fi
      # The lane. A request may declare one (--lane "apps/meet docs/meet-*.md"),
      # and then every changed path must fall under one of its prefixes or
      # match one of its patterns. A file swept into somebody's commit from
      # another session's work is invisible in a changelog and in a test run;
      # this is the one place it shows (2026-10-04: a release committed onto
      # another chat's branch and carried two of its files). The version
      # surfaces and the changelog belong to every release and are exempt.
      # No lane declared = no check: the field is opt-in until sessions use it.
      local lane; lane="$(field lane "$q")"
      if [ -n "$lane" ]; then
        local outside="" f pat hit
        for f in $files; do
          case "$f" in CHANGELOG.md|package.json|apps/*/package.json|packages/*/package.json|apps/web/lib/version.ts) continue ;; esac
          hit=0
          for pat in $lane; do
            # shellcheck disable=SC2254
            case "$f" in $pat|${pat%/}/*) hit=1; break ;; esac
          done
          [ "$hit" = 1 ] || outside="$outside$f"$'\n'
        done
        if [ -n "$outside" ]; then
          if [ "$allow_lane" = 1 ]; then
            say "Outside the declared lane ($lane), allowed by $by:"; printf '%s' "$outside" | sed 's/^/    /'
          else
            printf '%s' "$outside" | sed 's/^/    OUTSIDE THE LANE: /' >&2
            die "${sha:0:8} changes paths outside its declared lane ($lane). If they are meant, clear with --allow-out-of-lane; if not, they were swept in from somebody else's work."
          fi
        fi
      fi
      if printf '%s\n' "$files" | grep -q '^supabase/migrations/'; then
        say "Adds migrations: checking versions against every worktree."
        node scripts/check-migration-versions.mjs || die "migration version collision. Renumber with scripts/new-migration.sh."
        # And against the ORDER on the base branch. `supabase db push` refuses a
        # file that sorts before an already-applied one (unless --include-all),
        # so a commit whose new migration is older than the newest on staging
        # passed this preflight and failed at the push, after it was on staging
        # (membership 2026-10-04, Meet 2026-10-06). Added files only: a file
        # the commit carries because it is already on the base is history.
        local newest; newest="$(git ls-tree --name-only "$ref" -- supabase/migrations/ | sed -n 's|.*/\([0-9]\{14\}\)_.*\.sql$|\1|p' | sort | tail -1)"
        local added v late=""
        added="$(git --no-pager diff --name-only --diff-filter=A "$from" "$sha" -- supabase/migrations/ || true)"
        for f in $added; do
          v="$(printf '%s\n' "$f" | sed -n 's|.*/\([0-9]\{14\}\)_.*\.sql$|\1|p')"
          [ -n "$v" ] && [ -n "$newest" ] && [ "$v" \< "$newest" ] && late="$late    $v  $f   (newest on $ref: $newest)"$'\n'
        done
        [ -z "$late" ] || { printf '%s' "$late" | sed 's/^/    OLDER THAN STAGING:/' >&2; die "${sha:0:8} adds a migration older than the newest already on $ref; \`supabase db push\` would refuse it. Renumber with ./scripts/new-migration.sh and request again."; }
      fi
      ;;
    prod|api-prod)
      [ -n "$said" ] || die "production needs --sjoerd-said \"<his words>\". It is Sjoerd's decision, not the lane's."
      ;;
    api-staging) ;;
  esac

  set -o noclobber
  { echo "session=$name"; echo "kind=$kind"; echo "sha=$sha"; echo "base=$base"; echo "by=$by"
    echo "expires=$(( $(now) + minutes * 60 ))"; echo "said=$said"; } > "$CLEARANCE" 2>/dev/null \
    || die "another clearance was granted a moment ago. One at a time."
  set +o noclobber
  local verified; verified="$(field verified "$q")"
  rm -f "$q"
  logit "CLEARED session=$name kind=$kind sha=$sha base=$base by=$by minutes=$minutes${said:+ sjoerd-said=\"$said\"}$([ "$allow_delete" = 1 ] && echo " allow-delete" || true)$([ "$allow_lane" = 1 ] && echo " allow-out-of-lane" || true)"
  say "CLEARED: $name may land $kind ($minutes min). Base $(git rev-parse --short "$base"). Verified (their word): $verified"
  [ "$stale" = 0 ] || say "NOTE: ${sha:0:8} is not on $ref. Rebase onto $ref before you push (the runway is yours meanwhile, so nothing moves under you); the pre-push check wants the rebased commit's parent at $(git rev-parse --short "$base")."
}

# check --kind K: exit 0 only when RUNWAY_SESSION holds a live clearance of that
# kind and the base branch has not moved. Called by release.sh, deploy-api.sh,
# promote.sh and the pre-push hook.
cmd_check() {
  local kind=""
  while [ $# -gt 0 ]; do case "$1" in --kind) kind="$2"; shift 2 ;; *) die "unknown option $1" ;; esac; done
  if [ -n "${RUNWAY_BYPASS:-}" ]; then
    logit "BYPASS session=${RUNWAY_SESSION:-?} kind=$kind reason=$RUNWAY_BYPASS"
    echo "⚠️  RUNWAY BYPASSED (logged): $RUNWAY_BYPASS" >&2
    return 0
  fi
  local name="${RUNWAY_SESSION:-}"
  [ -n "$name" ] || die "no RUNWAY_SESSION. Say who you are: RUNWAY_SESSION=<name> $0 ..."
  live_clearance || die "no clearance. Request one, then wait:
    RUNWAY_SESSION=$name ./scripts/runway.sh request --kind $kind --what ... --verified ... --unverified ...
  Controller: ./scripts/runway.sh queue   (emergency only: RUNWAY_BYPASS=\"<reason>\", logged)"
  [ "$(field session "$CLEARANCE")" = "$name" ] \
    || die "runway is held by $(field session "$CLEARANCE") for $(field kind "$CLEARANCE"). Wait your turn."
  [ "$(field kind "$CLEARANCE")" = "$kind" ] \
    || die "your clearance is for $(field kind "$CLEARANCE"), not $kind."
  git fetch -q origin
  local ref base; ref="$(base_ref "$kind")"; base="$(field base "$CLEARANCE")"
  [ "$(git rev-parse "$ref")" = "$base" ] || {
    abort_quiet "base moved"
    die "$ref moved since you were cleared ($(git rev-parse --short "$ref") != ${base:0:8}). Somebody landed first. Clearance void: rebase and request again."
  }
  say "Runway check OK: $name cleared for $kind."
}

abort_quiet() { logit "VOID session=$(field session "$CLEARANCE") kind=$(field kind "$CLEARANCE") reason=$1"; rm -f "$CLEARANCE"; }

cmd_land() {
  local name="${RUNWAY_SESSION:-}"
  if [ -f "$CLEARANCE" ] && { [ "$(field session "$CLEARANCE")" = "$name" ] || [ -n "${RUNWAY_BYPASS:-}" ]; }; then
    logit "LANDED session=$(field session "$CLEARANCE") kind=$(field kind "$CLEARANCE") staging=$(git rev-parse --short origin/staging 2>/dev/null)"
    rm -f "$CLEARANCE"
    say "Landed. Runway free."
    return 0
  fi
  # A landing that does not happen SAYS so. Until 2026-10-03 this function
  # printed nothing and exited 0 when the caller was not the holder, so
  # "finished but did not free the runway" looked exactly like "still
  # running" from the outside, and a controller could only guess which.
  # Still exit 0: the release or deploy that called this has already
  # happened, and failing it now would misreport that.
  if [ -f "$CLEARANCE" ]; then
    say "NOT landed: the runway is held by $(field session "$CLEARANCE") for $(field kind "$CLEARANCE"), and you are ${name:-nobody (RUNWAY_SESSION is not set)}. It stays busy until the holder lands, the controller aborts, or it expires."
    logit "LAND-REFUSED holder=$(field session "$CLEARANCE") kind=$(field kind "$CLEARANCE") caller=${name:-none}"
  else
    say "Nothing to land: the runway is already free."
  fi
}

cmd_abort() {
  local by=""
  while [ $# -gt 0 ]; do case "$1" in --by) by="$2"; shift 2 ;; *) die "unknown option $1" ;; esac; done
  [ -f "$CLEARANCE" ] || { say "Runway already free."; return 0; }
  [ "$(field session "$CLEARANCE")" = "${RUNWAY_SESSION:-}" ] || [ -n "$by" ] \
    || die "only the holder, or a controller (--by <name>), frees the runway."
  logit "ABORT session=$(field session "$CLEARANCE") by=${by:-holder}"
  rm -f "$CLEARANCE"; say "Runway free."
}

# Pre-push hook body: git passes "<remote> <url>" as args and one line per ref
# on stdin. Only pushes TO the release branches are controlled.
cmd_hook() {
  # A deliberate refusal exits 1. A CRASH in this script exits 70 and the hook
  # wrapper lets the push through: a bug here must never become a total outage
  # of everyone's ability to ship, which is worse than the races it prevents.
  set -E; trap 'exit 70' ERR
  [ "${1:-}" = origin ] || exit 0
  local lref lsha rref rsha kind
  while read -r lref lsha rref rsha; do
    case "$rref" in
      refs/heads/staging) kind=release ;;
      refs/heads/main)    kind=prod ;;
      *) continue ;;
    esac
    case "$lsha" in 0000000000000000000000000000000000000000) die "deleting $rref is not allowed." ;; esac
    # A docs push has its own clearance kind; accept either on staging.
    if [ "$kind" = release ] && [ -z "${RUNWAY_BYPASS:-}" ] && live_clearance && [ "$(field kind "$CLEARANCE")" = docs ]; then kind=docs; fi
    cmd_check --kind "$kind" >&2 || exit 1
    # WHAT is being pushed. A clearance says who may land, not that the commit
    # is a finished release: on 2026-10-04 a commit titled "wip:" went to
    # staging under a release clearance with a bare `git push` — no version
    # bump, its changelog heading still [NEXT] — and the next session's
    # stamp then numbered itself above an entry that never got a number.
    # release.sh checks all of this; the hook did not, and a bare push walks
    # past release.sh. Docs pushes keep their own, looser shape.
    if [ "$kind" = release ] && [ -z "${RUNWAY_BYPASS:-}" ]; then
      local subject top pkg
      subject="$(git log -1 --format=%s "$lsha" 2>/dev/null || true)"
      # Read whole, then searched: a `git show | grep | head -1` on a
      # 22,000-line changelog ends in SIGPIPE, and this function runs under
      # pipefail with a trap that turns any failure into "let the push through".
      local cl; cl="$(git show "$lsha:CHANGELOG.md" 2>/dev/null || true)"
      top="$(awk '/^## \[/ && !/\[Unreleased\]/ { print; exit }' <<<"$cl")"
      local pj; pj="$(git show "$lsha:package.json" 2>/dev/null || true)"
      pkg="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' <<<"$pj" | sed -n '1p')"
      case "$subject" in
        v[0-9]*.[0-9]*.[0-9]*\ *) ;;
        *) die "this push to staging is not a release: its subject is \"$subject\". A release is made by ./scripts/release.sh, never a bare push (it stamps the version and the changelog and runs the gate)." ;;
      esac
      case "$top" in
        "## [$pkg]"*) ;;
        *) die "this push to staging is half-stamped: package.json says $pkg and the top changelog heading is \"${top:-none}\". Run node scripts/next-version.mjs, then ./scripts/release.sh; never a bare push." ;;
      esac
      case "$subject" in
        "v$pkg "*) ;;
        *) die "this push to staging names one version in its subject (\"$subject\") and another in package.json ($pkg). Use ./scripts/release.sh." ;;
      esac
    fi
  done
}

cmd_install_hook() {
  mkdir -p "$COMMON/hooks"
  local h="$COMMON/hooks/pre-push"
  if [ -f "$h" ] && ! grep -q runway.sh "$h"; then die "$h exists and is not ours. Merge by hand."; fi
  cat > "$h" <<'EOF'
#!/usr/bin/env bash
# Installed by scripts/runway.sh install-hook. One hook for every worktree.
top="$(git rev-parse --show-toplevel)"
# A person at a terminal is the owner, not a session: never gate them.
# (Sessions run their commands without a tty on stderr.)
if [ -t 2 ] && [ -z "${RUNWAY_SESSION:-}" ]; then exit 0; fi
if [ -x "$top/scripts/runway.sh" ]; then
  "$top/scripts/runway.sh" hook "$@"; rc=$?
  if [ "$rc" = 70 ]; then echo "runway: the control script crashed (exit 70); letting this push through. Tell the controller." >&2; exit 0; fi
  if [ "$rc" != 0 ]; then echo "runway: stuck? Emergency only: RUNWAY_BYPASS=\"<reason>\" git push ...  (logged). The clearance also expires on its own." >&2; fi
  exit $rc
fi
echo "runway: $top has no scripts/runway.sh (old checkout), not controlling this push." >&2
EOF
  chmod +x "$h"
  say "Installed $h (applies to every worktree of this clone)."
}

# The shared checkout's BRANCH is shared state, like the stash stack and the
# migration history: three things that look local and are not. A session that
# switches it moves the ground under every other session working there, and
# nothing warns them — the next release.sh run then commits onto somebody
# else's branch (2026-10-04). A worktree's branch is its own; the main
# checkout's is `main`, always.
cmd_check_checkout() {
  local gitdir common branch
  gitdir="$(cd "$(git rev-parse --git-dir)" && pwd)"
  common="$(cd "$(git rev-parse --git-common-dir)" && pwd)"
  [ "$gitdir" = "$common" ] || return 0          # a worktree: its branch is its own
  branch="$(git symbolic-ref --quiet --short HEAD || echo "(detached)")"
  [ "$branch" = main ] || die "the shared main checkout is on \"$branch\", not main. Somebody switched it; a release from here would commit onto their branch. Do not switch it back under them: ask who, and release from a worktree."
}

sub="${1:-}"; shift || true
case "$sub" in
  request) cmd_request "$@" ;; queue) cmd_queue ;; status) cmd_status ;;
  clear) cmd_clear "$@" ;; check) cmd_check "$@" ;; land) cmd_land ;;
  abort) cmd_abort "$@" ;; hook) cmd_hook "$@" ;; install-hook) cmd_install_hook ;;
  check-checkout) cmd_check_checkout ;; withdraw) cmd_withdraw "$@" ;;
  *) sed -n '2,32p' "$0"; exit 64 ;;
esac
