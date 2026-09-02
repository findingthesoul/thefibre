#!/usr/bin/env bash
# Push migrations to STAGING, then ALWAYS restore the prod link.
# `supabase link` is machine-global state — the whole reason this wrapper
# exists is so a staging push can never leave the CLI pointed at staging
# while somebody later types a bare `supabase db push` meaning prod.
set -euo pipefail
cd "$(dirname "$0")/.."
REF_FILE="supabase/.staging-ref"
PROD_REF="zfsyyokepyycefbxiblc"
if [ ! -f "$REF_FILE" ]; then
  echo "No $REF_FILE yet — put the staging project ref in it (docs/environments.md Phase 3)." >&2
  exit 1
fi
STAGING_REF="$(tr -d '[:space:]' < "$REF_FILE")"
restore() { supabase link --project-ref "$PROD_REF" >/dev/null 2>&1 && echo "(link restored to prod)"; }
trap restore EXIT
supabase link --project-ref "$STAGING_REF"
supabase db push
