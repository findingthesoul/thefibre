#!/usr/bin/env bash
# Push migrations to PROD, explicitly. Links first so it does the right thing
# even if a staging session left the CLI pointed elsewhere.
set -euo pipefail
cd "$(dirname "$0")/.."
supabase link --project-ref "zfsyyokepyycefbxiblc"
supabase db push
