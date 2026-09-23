#!/usr/bin/env bash
# Deploy the Hono API to Fly — and prove you are deploying what you think.
#
# THIS REPLACES `fly deploy`. It is not a check you run first; it is the way
# the API is deployed, because a separate check gets skipped and a guard that
# gets skipped is worse than none.
#
#   ./scripts/deploy-api.sh staging --probe "https://… | expected text"
#   ./scripts/deploy-api.sh prod    --no-visible-change
#
# ── Why it exists (2026-09-23, two incidents inside one hour) ───────────────
#
# `fly deploy` uploads the WORKING TREE, not the branch. Twice in an hour that
# shipped something nobody intended, and neither was visible in `git status`:
#
#   1. A production deploy ran from the shared checkout while another session
#      had uncommitted work in it — two untracked files under apps/api/src/lib
#      and a modified routes/membership.ts. The Dockerfile copies
#      `apps/api/src/` wholesale, so unlike a stray script in the build
#      context those COMPILED INTO THE IMAGE and ran: production decided
#      membership billing intervals by an unreleased rule for four minutes.
#   2. A deploy ran from a worktree still at the PREVIOUS commit. Perfectly
#      clean, simply not what had been promoted — production ran one release
#      without the other for two minutes.
#
# Both were caught by someone reading their own output afterwards. Everything
# else in this pipeline is already a machine fact — version numbers,
# release ordering, migration-before-code. "Deployed what was promoted" was
# the last one held by habit, and habit failed twice in an hour to two people
# who had each just warned the other about it.
#
# ── The fourth check, and why it is not a gate ──────────────────────────────
#
# /health is answered by ANY image, including the wrong one. Both incidents
# above passed /health perfectly. So the only check that proves what is
# RUNNING is a probe of something the NEW code serves — and that cannot be
# generated, because only the person who wrote the release knows what changed.
#
# It is deliberately NOT a hard gate. A refactor, a log line or a dependency
# bump has nothing user-visible, and a gate demanding a probe from a release
# that has none would be satisfied with an invented one — a green check with a
# ceremony around it, which is worse than no check because the next person
# believes it. So `--no-visible-change` is a first-class answer. What is
# refused is SILENCE: you must say which it is, and whatever you say is
# printed with the sha and the Fly release so a later session can read the
# claim instead of re-deriving it.
set -euo pipefail
cd "$(dirname "$0")/.."

usage() {
  cat >&2 <<'USAGE'
usage: ./scripts/deploy-api.sh <staging|prod> (--probe "<url> | <expected>" | --no-visible-change)

  staging   thefibre-api-staging, must be at origin/staging
  prod      thefibre-api,         must be at origin/main

  --probe "<url> | <expected>"   a request only the NEW code answers this way.
                                 Run after the deploy; a miss fails the run.
  --probe "<url> | status:401"   or match the STATUS instead of the body —
                                 for an authenticated route, where "401 not
                                 404" is the real discriminator: the old image
                                 has no such route, the new one wants a
                                 session.
  --probe <script.mjs>           or a script that checks it — anything already
                                 in scripts/ (smoke-prod.mjs, verify-*.mjs).
                                 Exit 0 passes. For checks a single request
                                 cannot make.
  --no-visible-change            nothing about this release is observable over
                                 HTTP (a refactor, a log line, a dep bump).
                                 A real answer, recorded as such.
  --dry-run                      run every check and the probe, deploy nothing.
                                 Use it to see whether a deploy WOULD be
                                 refused before you start one.
USAGE
  exit 64
}

TARGET="${1:-}"; shift || true
case "$TARGET" in
  staging) APP="thefibre-api-staging"; BRANCH="origin/staging"; CONFIG=(--config fly.staging.toml) ;;
  # CONFIG is expanded as ${CONFIG[@]+"${CONFIG[@]}"} below: bash 3.2 on
  # macOS calls "${CONFIG[@]}" on an EMPTY array UNBOUND under set -u, so the
  # prod path — which needs no --config flag — passed every gate and then died
  # on the deploy line. Found on its first production use.
  prod)    APP="thefibre-api";         BRANCH="origin/main";    CONFIG=() ;;
  *) usage ;;
esac

PROBE=""
NO_VISIBLE=0
DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --probe) PROBE="${2:-}"; [ -n "$PROBE" ] || usage; shift 2 ;;
    --no-visible-change) NO_VISIBLE=1; shift ;;
    --dry-run) DRY=1; shift ;;
    *) usage ;;
  esac
done
if [ -n "$PROBE" ] && [ "$NO_VISIBLE" = "1" ]; then
  echo "REFUSED: --probe and --no-visible-change are different answers; give one." >&2
  exit 64
fi
if [ -z "$PROBE" ] && [ "$NO_VISIBLE" = "0" ]; then
  echo "REFUSED: say what this release serves that the old image does not." >&2
  echo "  --probe \"<url> | <expected text>\"   or   --no-visible-change" >&2
  echo "  /health is not an answer: every image passes it, including the wrong one." >&2
  exit 64
fi

git fetch -q origin

# ── 1. What gets COMPILED INTO the image ────────────────────────────────────
# The Dockerfile copies exactly three source trees (lines 15, 21, 28). Anything
# uncommitted in them RUNS in production — incident 1.
COMPILED="apps/api/src packages/shared/src packages/mcp/src"
DIRTY="$(git status --porcelain -- $COMPILED)"
UNTRACKED_SRC="$(git ls-files --others --exclude-standard -- $COMPILED)"
if [ -n "$DIRTY$UNTRACKED_SRC" ]; then
  echo "REFUSED: uncommitted work in a tree the image COMPILES IN — it would RUN in production." >&2
  [ -n "$DIRTY" ] && { echo "  modified/staged:" >&2; echo "$DIRTY" | sed "s/^/    /" >&2; }
  [ -n "$UNTRACKED_SRC" ] && { echo "  untracked:" >&2; echo "$UNTRACKED_SRC" | sed "s/^/    /" >&2; }
  echo "  It may be another session's live work: ASK, do not delete." >&2
  echo "  Deploy from a clean worktree instead:" >&2
  echo "    git worktree add /tmp/deploy <sha>" >&2
  exit 1
fi

# ── 2. What gets UPLOADED to the remote builder ─────────────────────────────
# Wider than the image and the reason this check exists at all: the root
# .dockerignore lists apps/api/** and packages/** under "do NOT ignore", and
# apps/api/.dockerignore is decorative because BuildKit never reads a nested
# one. So an untracked file anywhere under those paths crosses the wire even
# though the narrow COPY list keeps it out of the image.
#
# That is exactly what happened: apps/api/scripts/.launch-test-tmp/ held five
# untracked scripts that build a Supabase client from SUPABASE_SERVICE_ROLE_KEY,
# and they rode two deploys. Scoped to these paths rather than the whole repo
# on purpose — an untracked note in docs/ cannot reach the builder, and failing
# on it would make this script the thing people route around.
#
# What this does NOT cover, said plainly so nobody credits it with more than
# it does: --exclude-standard skips IGNORED files, so apps/api/.env and
# .env.staging never trip it. Those are kept out of the builder by
# .dockerignore (**/.env, **/.env.*, added in v0.70.1 after exactly that
# hole). The two halves together are sound — but if that .dockerignore line
# ever goes, this gate will not catch it, and env files are copied into
# apps/api routinely for integration tests.
UPLOADED="$(git ls-files --others --exclude-standard -- apps/api packages)"
if [ -n "$UPLOADED" ]; then
  echo "REFUSED: untracked files under apps/api or packages — these UPLOAD to the Fly builder." >&2
  echo "$UPLOADED" | sed "s/^/    /" >&2
  echo "  They stay out of the IMAGE (the Dockerfile copies only three src trees)," >&2
  echo "  but they leave this machine. A throwaway that reads a credential is the" >&2
  echo "  case this guards. If they belong to another session, ASK — do not delete." >&2
  exit 1
fi

# ── 3. The commit that will be uploaded ─────────────────────────────────────
HEAD_SHA="$(git rev-parse HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"
WANT_SHA="$(git rev-parse "$BRANCH")"
if [ "$HEAD_SHA" != "$WANT_SHA" ]; then
  echo "REFUSED: HEAD is not $BRANCH — a clean tree at the wrong commit is the second failure this guards." >&2
  echo "  HEAD      $HEAD_SHA  $(git log --oneline -1 HEAD)" >&2
  echo "  $BRANCH   $WANT_SHA  $(git log --oneline -1 "$BRANCH")" >&2
  exit 1
fi

if [ "$DRY" = "1" ]; then
  echo "DRY RUN — every check passed; nothing was deployed."
  echo "  would deploy $APP from $HEAD_SHA — $(git log --oneline -1 HEAD)"
  RELEASE="(not deployed)"
else
  echo "Deploying $APP from $HEAD_SHA — $(git log --oneline -1 HEAD)"
  fly deploy ${CONFIG[@]+"${CONFIG[@]}"} --remote-only

  RELEASE="$(fly releases ${CONFIG[@]+"${CONFIG[@]}"} --json 2>/dev/null \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const r=JSON.parse(s);console.log(r?.[0]?.Version?"v"+r[0].Version:"unknown")}catch{console.log("unknown")}})' \
    || echo unknown)"
fi

# ── 4. What is RUNNING ──────────────────────────────────────────────────────
if [ "$NO_VISIBLE" = "1" ]; then
  ANSWER="no user-visible change"
else
  # A script, when one request cannot say it — suggested by the session that
  # runs the launch checks, whose real post-deploy proof is several calls in
  # order (verify-stripe-webhooks.mjs and friends). Without this, such a
  # release either skips gate 4 or invents a single-request probe that stands
  # in for the real check, which is the failure this whole gate is against.
  if [ -f "$PROBE" ]; then
    echo "Probing with $PROBE"
    if ! node "$PROBE"; then
      echo "PROBE FAILED: $PROBE exited non-zero." >&2
      if [ "$DRY" = "1" ]; then
        echo "  Nothing was deployed — this is the CURRENT image answering." >&2
      else
        echo "  The deploy HAPPENED — the running image may not be the one you meant," >&2
        echo "  or the check itself is wrong. Read its output before believing either." >&2
      fi
      exit 1
    fi
    ANSWER="$PROBE passed"
    echo
    if [ "$DRY" = "1" ]; then
      echo "would deploy $SHORT_SHA, probe: $ANSWER"
    else
      echo "deployed $SHORT_SHA as $RELEASE, probe: $ANSWER"
    fi
    exit 0
  fi

  case "$PROBE" in
    *\|*) : ;;
    *) echo "REFUSED: --probe needs \"<url> | <expected>\" or a script path that exists." >&2
       echo "  Got: $PROBE" >&2
       exit 64 ;;
  esac
  URL="${PROBE%%|*}"; URL="$(echo "$URL" | xargs)"
  WANT="${PROBE#*|}";  WANT="$(echo "$WANT" | xargs)"

  # status: — because MOST routes here are authenticated, and for those a body
  # probe cannot work at all: `curl -f` fails on any non-2xx, so the body is
  # empty and the grep always misses. A session that ships authenticated
  # routes would then have to choose between a false --no-visible-change and
  # routing around this script, which is how the escape hatch stops meaning
  # anything. Reported by the session that had run four API deploys today,
  # against its own route rather than against this description.
  #
  # "401, not 404" is not a weaker check than a body match. The old image
  # answers 404 because the route does not exist; the new one answers 401
  # because it exists and wants a session. It separates the two images exactly
  # and needs no credentials.
  case "$WANT" in
    status:*)
      CODE_WANT="${WANT#status:}"
      echo "Probing $URL for HTTP $CODE_WANT"
      CODE_GOT="$(curl -s -o /dev/null -m 30 -w '%{http_code}' "$URL" || echo 000)"
      if [ "$CODE_GOT" != "$CODE_WANT" ]; then
        echo "PROBE MISSED: $URL answered $CODE_GOT, not $CODE_WANT." >&2
        if [ "$DRY" = "1" ]; then
          echo "  Nothing was deployed — this is the CURRENT image answering." >&2
        else
          echo "  The deploy HAPPENED — the running image may not be the one you meant," >&2
          echo "  or the probe was wrong. Check both before believing either." >&2
        fi
        exit 1
      fi
      ANSWER="$URL answers $CODE_WANT"
      echo
      if [ "$DRY" = "1" ]; then
        echo "would deploy $SHORT_SHA, probe: $ANSWER"
      else
        echo "deployed $SHORT_SHA as $RELEASE, probe: $ANSWER"
      fi
      exit 0 ;;
  esac

  echo "Probing $URL for: $WANT"
  BODY="$(curl -fsS -m 30 "$URL" || true)"
  if ! printf '%s' "$BODY" | grep -qF -- "$WANT"; then
    echo "PROBE MISSED: $URL did not contain \"$WANT\"." >&2
    if [ "$DRY" = "1" ]; then
      echo "  Nothing was deployed — this is the CURRENT image answering." >&2
    else
      echo "  The deploy HAPPENED — the running image may not be the one you meant," >&2
      echo "  or the probe was wrong. Check both before believing either." >&2
    fi
    exit 1
  fi
  ANSWER="$URL contains \"$WANT\""
fi

echo
if [ "$DRY" = "1" ]; then
  echo "would deploy $SHORT_SHA, probe: $ANSWER"
else
  # The line a later session can read instead of re-deriving what a release
  # was meant to change.
  echo "deployed $SHORT_SHA as $RELEASE, probe: $ANSWER"
fi
