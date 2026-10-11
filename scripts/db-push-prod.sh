#!/usr/bin/env bash
# Push migrations to PROD, explicitly. Links first so it does the right thing
# even if a staging session left the CLI pointed elsewhere.
#
# `--yes` skips the [Y/n]. It is OPT-IN on purpose: a person typing this still
# gets the prompt, because being asked "push these migrations to production?"
# is the last cheap chance to notice the wrong ones. Only batch-prod.sh passes
# it, and only after it has already shown the plan and checked the clearance.
set -euo pipefail
cd "$(dirname "$0")/.."
YES=()
for a in "$@"; do
  case "$a" in
    --yes) YES=(--yes) ;;
    *) echo "usage: $0 [--yes]" >&2; exit 2 ;;
  esac
done
supabase link --project-ref "zfsyyokepyycefbxiblc"
supabase db push "${YES[@]}"
