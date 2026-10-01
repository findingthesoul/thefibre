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
#   ./scripts/runway.sh queue                # who is waiting, and what they say
#   ./scripts/runway.sh status               # who holds the runway now
#   ./scripts/runway.sh clear <name> --by <controller>     # preflight + grant
#   RUNWAY_SESSION=<name> ./scripts/runway.sh land         # release.sh does this
#   ./scripts/runway.sh abort [--by <controller>]          # free the runway
#   ./scripts/runway.sh install-hook         # once per clone; covers all worktrees
#
# Kinds:  release (release.sh -> staging)   docs (docs-only push to staging)
#         api-staging / api-prod (deploy-api.sh)
#         prod (promote.sh; needs --sjoerd-said "<his words>" to be granted)
#
# What this stops: a second session landing while one holds the runway, a push
# built on a staging that has since moved (the three lost races of 2026-10-01),
# a docs commit that is not docs, production without Sjoerd, and a handover
# that says nothing about what was NOT verified.
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
  local f="$QUEUE/$(now)-$name"
  {
    echo "session=$name"; echo "kind=$kind"; echo "sha=$sha"; echo "lane=$lane"
    echo "what=$what"; echo "verified=$verified"; echo "unverified=$unverified"
    echo "requested=$(now)"
  } > "$f"
  logit "REQUEST session=$name kind=$kind sha=$sha what=$what"
  say "Queued: $name wants $kind for ${sha:0:8}. Wait for clearance; do not push."
}

cmd_queue() {
  local any=0 f
  for f in $(ls "$QUEUE" 2>/dev/null | sort); do
    any=1
    say "$(field session "$QUEUE/$f")  [$(field kind "$QUEUE/$f")]  $(field sha "$QUEUE/$f" | cut -c1-8)  $(field what "$QUEUE/$f")"
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
  local by="" minutes="$DEFAULT_MINUTES" kindopt="" said=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --by) by="$2"; shift 2 ;; --minutes) minutes="$2"; shift 2 ;;
      --kind) kindopt="$2"; shift 2 ;; --sjoerd-said) said="$2"; shift 2 ;;
      *) die "unknown option $1" ;;
    esac
  done
  [ -n "$name" ] || die "usage: clear <session> --by <controller>"
  [ -n "$by" ] || die "--by <controller>: who is granting this, for the log."
  if live_clearance; then
    die "runway busy: $(field session "$CLEARANCE") holds it for $(field kind "$CLEARANCE"). One at a time."
  fi
  local entry; entry="$(ls "$QUEUE" 2>/dev/null | grep -- "-$name\$" | sort | tail -1 || true)"
  [ -n "$entry" ] || die "$name has no request in the queue. They request first, with what they verified and did not."
  local q="$QUEUE/$entry"
  local kind="${kindopt:-$(field kind "$q")}" sha; sha="$(field sha "$q")"

  git fetch -q origin
  local ref base; ref="$(base_ref "$kind")"; base="$(git rev-parse "$ref")"

  # ── Preflight: cheap, and the ones that have actually bitten this repo ────
  case "$kind" in
    release|docs)
      git merge-base --is-ancestor "$ref" "$sha" \
        || die "${sha:0:8} is not built on $ref ($(git rev-parse --short "$ref")). Rebase or fast-forward onto it, request again."
      local files; files="$(git --no-pager diff --name-only "$ref" "$sha")"
      [ -n "$files" ] || die "${sha:0:8} changes nothing against $ref."
      say "Diff against $ref:"; printf '%s\n' "$files" | sed 's/^/    /'
      if [ "$kind" = docs ]; then
        local bad; bad="$(printf '%s\n' "$files" | grep -vE '^docs/|\.md$' || true)"
        [ -z "$bad" ] || { printf '%s\n' "$bad" | sed 's/^/    NOT DOCS: /' >&2; die "kind=docs touches code. Request kind=release."; }
      fi
      if printf '%s\n' "$files" | grep -q '^supabase/migrations/'; then
        say "Adds migrations: checking versions against every worktree."
        node scripts/check-migration-versions.mjs || die "migration version collision. Renumber with scripts/new-migration.sh."
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
  logit "CLEARED session=$name kind=$kind sha=$sha base=$base by=$by minutes=$minutes${said:+ sjoerd-said=\"$said\"}"
  say "CLEARED: $name may land $kind ($minutes min). Base $(git rev-parse --short "$base"). Verified (their word): $verified"
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

sub="${1:-}"; shift || true
case "$sub" in
  request) cmd_request "$@" ;; queue) cmd_queue ;; status) cmd_status ;;
  clear) cmd_clear "$@" ;; check) cmd_check "$@" ;; land) cmd_land ;;
  abort) cmd_abort "$@" ;; hook) cmd_hook "$@" ;; install-hook) cmd_install_hook ;;
  *) sed -n '2,32p' "$0"; exit 64 ;;
esac
