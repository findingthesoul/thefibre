#!/usr/bin/env bash
# Create a migration file with a version nobody else is using.
#
# Usage: ./scripts/new-migration.sh add_thing_to_table
#
# A timestamp picked by hand collides with another session's, and Supabase
# then skips one of them in silence (see scripts/check-migration-versions.mjs
# for what that costs). This picks `now`, then walks forward a minute at a
# time until the version is free in THIS checkout and in every worktree.
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:?usage: new-migration.sh <snake_case_name>}"
case "$NAME" in
  *[!a-z0-9_]*) echo "name: lowercase letters, digits and underscores only" >&2; exit 1 ;;
esac

taken() {
  # Every migrations directory reachable from here, same set the checker reads.
  find . ../../../.claude/worktrees -maxdepth 4 -path '*/supabase/migrations' -type d 2>/dev/null \
    | while read -r d; do ls "$d" 2>/dev/null; done \
    | sed -n 's/^\([0-9]\{14\}\)_.*\.sql$/\1/p' | sort -u
}

TAKEN="$(taken)"
# Start from NOW, but never behind the newest version anybody holds: Supabase
# applies in version order, so a file that sorts before an already-applied one
# is a migration out of its own history. (The first run of this script picked
# 20260923124817 while the repo already held 20260923150000 — hand-picked
# timestamps had run ahead of the clock.)
NOW="$(date -u +%Y%m%d%H%M%S | cut -c1-14)"
NEWEST="$(printf '%s\n' "$TAKEN" | tail -1)"
V="$NOW"
if [ -n "$NEWEST" ] && [ "$NEWEST" \> "$V" ]; then V="$NEWEST"; fi
while printf '%s\n' "$TAKEN" | grep -qx "$V" || [ "$V" = "$NEWEST" ]; do
  # +1 minute, in UTC, portable enough for macOS's date.
  V="$(date -u -v+1M -j -f '%Y%m%d%H%M%S' "$V" +%Y%m%d%H%M%S 2>/dev/null \
      || date -u -d "${V:0:8} ${V:8:2}:${V:10:2}:${V:12:2} +1 minute" +%Y%m%d%H%M%S)"
done

FILE="supabase/migrations/${V}_${NAME}.sql"
printf -- '-- %s\n--\n-- Why this exists, in a sentence someone reading it in a year can use.\n\n' "$NAME" > "$FILE"
echo "$FILE"
echo
echo "Next: write it, then apply and PUSH THE FILE in the same breath —"
echo "a migration applied to a remote but absent from the repo makes"
echo "\`supabase db push\` refuse for every other checkout."
