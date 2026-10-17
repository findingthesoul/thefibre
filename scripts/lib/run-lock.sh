# One run at a time — sourced by scripts that must never overlap with
# themselves (batch-prod.sh; deploy-api.sh per target).
#
# Why: on 2026-10-17 batch 42 ran TWICE at once. Two copies of the command
# were open in two terminals, Run was pressed on both, and both reached
# `fly deploy` to production together. Every gate passed for each of them,
# because each gate asks about the world, not about a twin running beside it.
#
#   . scripts/lib/run-lock.sh
#   run_lock_acquire batch-prod || exit 75
#
# The lock is a DIRECTORY (mkdir is atomic: of two racing runs exactly one
# creates it) in the shared git dir, `runway/locks/<name>`, so every worktree
# and the main checkout see the same one. It holds who holds it: pid, tty,
# user, host, start time, command. It is removed when the holder exits, by a
# trap. A lock whose holder is gone — the pid no longer exists, or it now
# belongs to some other program — is stale, said so, and taken over.
#
# A run that calls another locked script (batch-prod.sh runs deploy-api.sh
# prod) passes its token down in RUN_LOCK_TOKEN; a lock carrying the caller's
# token is the caller's, so the child goes ahead and leaves it for the parent
# to remove. A second, separate run has no token and is refused.

run_lock_dir() {
  local common
  common="$(git rev-parse --git-common-dir 2>/dev/null)" || return 1
  printf '%s/runway/locks/%s' "$common" "$1"
}

# The info of a held lock, as key=value lines.
run_lock_info() { cat "$(run_lock_dir "$1")/info" 2>/dev/null || true; }

run_lock_field() { printf '%s\n' "$1" | sed -n "s/^$2=//p" | head -1; }

# Is the holder of this info still the process that took the lock?
run_lock_alive() {
  local pid cmd now_cmd
  pid="$(run_lock_field "$1" pid)"; cmd="$(run_lock_field "$1" script)"
  [ -n "$pid" ] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  # The pid exists — but pids are reused. It is the holder only if it is
  # still running the same script.
  now_cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  case "$now_cmd" in *"$cmd"*) return 0 ;; *) return 1 ;; esac
}

run_lock_acquire() {
  local name="$1" dir info
  dir="$(run_lock_dir "$name")" || { echo "run-lock: not in a git checkout" >&2; return 1; }
  mkdir -p "$(dirname "$dir")"
  for attempt in 1 2; do
    if mkdir "$dir" 2>/dev/null; then
      RUN_LOCK_TOKEN="${RUN_LOCK_TOKEN:-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')}"
      export RUN_LOCK_TOKEN
      {
        printf 'pid=%s\n' "$$"
        printf 'script=%s\n' "$(basename "$0")"
        printf 'tty=%s\n' "$(tty 2>/dev/null || echo none)"
        printf 'user=%s\n' "${USER:-unknown}"
        printf 'host=%s\n' "$(hostname -s 2>/dev/null || hostname)"
        printf 'started=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
        printf 'started_epoch=%s\n' "$(date +%s)"
        printf 'token=%s\n' "$RUN_LOCK_TOKEN"
        printf 'args=%s\n' "${RUN_LOCK_ARGS:-}"
      } > "$dir/info"
      RUN_LOCK_HELD="${RUN_LOCK_HELD:-} $name"
      # Released on exit. A script that sets its OWN EXIT trap later replaces
      # this one, and must call run_lock_release_all in it (batch-prod.sh does).
      trap "run_lock_release_all" EXIT
      return 0
    fi
    info="$(run_lock_info "$name")"
    # Our own caller's lock (batch-prod.sh → deploy-api.sh): go ahead.
    if [ -n "${RUN_LOCK_TOKEN:-}" ] && [ "$(run_lock_field "$info" token)" = "$RUN_LOCK_TOKEN" ]; then
      return 0
    fi
    if [ -z "$info" ]; then
      # Created this instant by another run that has not written its info
      # yet: that run wins; we are the second.
      sleep 1; info="$(run_lock_info "$name")"
    fi
    if [ -n "$info" ] && ! run_lock_alive "$info"; then
      echo "run-lock: $name was held by pid $(run_lock_field "$info" pid) ($(run_lock_field "$info" script), started $(run_lock_field "$info" started)), which is no longer running — taking it over." >&2
      rm -rf "$dir"
      continue
    fi
    local started_epoch mins
    started_epoch="$(run_lock_field "$info" started_epoch)"
    mins=$(( ( $(date +%s) - ${started_epoch:-$(date +%s)} ) / 60 ))
    {
      echo ""
      echo "REFUSED: $name is already running, and two at once is how batch 42 deployed twice."
      echo "   pid     : $(run_lock_field "$info" pid)  ($(run_lock_field "$info" script) $(run_lock_field "$info" args))"
      echo "   terminal: $(run_lock_field "$info" tty)   user: $(run_lock_field "$info" user)@$(run_lock_field "$info" host)"
      echo "   started : $(run_lock_field "$info" started)  (${mins} min ago)"
      echo "   Wait for it to finish (it removes the lock itself). Nothing ran here."
      echo "   Only if you are SURE that run is dead: rm -rf $dir"
    } >&2
    return 75
  done
  echo "run-lock: could not take $name after removing a stale lock; another run took it first." >&2
  return 75
}

# Remove the locks THIS process created (never a parent's).
run_lock_release_all() {
  local name dir
  for name in ${RUN_LOCK_HELD:-}; do
    dir="$(run_lock_dir "$name")" || continue
    [ "$(run_lock_field "$(run_lock_info "$name")" pid)" = "$$" ] && rm -rf "$dir"
  done
}
