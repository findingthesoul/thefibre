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
#
# `--behind-auth "<why>"` is the THIRD answer, added 2026-09-24 because the
# first two were not exhaustive and the gap produced a false record. A release
# can change two user-visible things and still be unprobeable from outside:
# an authenticated projection and an email body were the case that found it.
# Neither existing answer is true there — there is no probe, and "nothing
# changed" is wrong — so the session deploying it had to file a real change as
# a refactor. Raised by the Meet session on its own v1.36.0 rather than left
# for someone to discover from the log; it did not add the flag itself on the
# grounds that a new answer is an interface every session has to learn, which
# was the right instinct and the reason this comment exists.
#
# The line this gate prints is the whole point. "no user-visible change" on a
# release that changed two user-visible things is the ONE outcome it must
# never produce.
set -euo pipefail
cd "$(dirname "$0")/.."

usage() {
  cat >&2 <<'USAGE'
usage: ./scripts/deploy-api.sh <staging|prod>
       (--probe "<url> | <expected>" | --behind-auth "<why>" | --no-visible-change)

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
  --behind-auth "<why>"          the behaviour DID change, and no
                                 unauthenticated request can see it — an
                                 authenticated projection, an email body. Say
                                 what changed; it is recorded verbatim.
                                 (status:401 is not a probe here: the old
                                 image answers 401 too.)

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
BEHIND_AUTH=""
DRY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --probe) PROBE="${2:-}"; [ -n "$PROBE" ] || usage; shift 2 ;;
    --no-visible-change) NO_VISIBLE=1; shift ;;
    --behind-auth) BEHIND_AUTH="${2:-}"; [ -n "$BEHIND_AUTH" ] || usage; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    *) usage ;;
  esac
done
# Exactly one answer. Counted rather than compared pairwise, so a fourth
# answer cannot be added without this staying correct.
ANSWERS=0
[ -n "$PROBE" ] && ANSWERS=$((ANSWERS + 1))
[ -n "$BEHIND_AUTH" ] && ANSWERS=$((ANSWERS + 1))
[ "$NO_VISIBLE" = "1" ] && ANSWERS=$((ANSWERS + 1))
if [ "$ANSWERS" -gt 1 ]; then
  echo "REFUSED: --probe, --behind-auth and --no-visible-change are different answers; give one." >&2
  exit 64
fi
if [ "$ANSWERS" -eq 0 ]; then
  echo "REFUSED: say what this release serves that the old image does not." >&2
  echo "  --probe \"<url> | <expected text>\"" >&2
  echo "  --behind-auth \"<why>\"              changed, but only visible with a session" >&2
  echo "  --no-visible-change                 nothing observable over HTTP" >&2
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
elif [ -n "$BEHIND_AUTH" ]; then
  ANSWER="changed behaviour, not reachable without a session: $BEHIND_AUTH"
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
  # ── A WARNING about what 401 does and does not prove here ────────────────
  #
  # The reasoning this form shipped with was WRONG, and measured wrong the
  # first time anybody pointed a probe at a made-up path:
  #
  #   /api/v1/connections/today            401   (exists, wants a session)
  #   /api/v1/this-has-never-existed       401   (does not exist at all)
  #
  # Auth runs BEFORE routing on `/api/v1/*`, so every path under it answers
  # 401 whether or not it is served. "401, not 404" therefore does NOT prove a
  # new route is there — the old image answers 401 for it too. A probe like
  # that passes on the wrong image, which is worse than no probe.
  #
  # So use `status:` for a code the NEW code genuinely produces and the old one
  # does not: a public path that starts answering 200, a status that changed
  # from 402 to 200 when a plan gate moved, a redirect that appeared.
  # Unauthenticated paths that tell the truth about existence are the ones
  # OUTSIDE the auth wall — `/health`, `/api/v1/public/*` (a real one is 200, a
  # made-up one is 401).
  #
  # If a release only adds an authenticated route, there is no honest
  # unauthenticated probe for it: say `--no-visible-change` rather than shipping
  # a check that cannot fail.
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
  # Status AND body, because a miss has two very different causes and they
  # looked identical: a 404 (wrong URL) and a 200 that simply lacks the string
  # (wrong expectation) both printed the same line. Reported by the session
  # whose probe named a field on the wrong payload — the deploy was fine, the
  # claim was not, and the output did not say which.
  #
  # No `-f` here: it suppresses the body on any non-2xx, so an error response
  # that explains itself would be thrown away exactly when it is most useful.
  PROBE_BODY="$(mktemp)"
  CODE="$(curl -s -o "$PROBE_BODY" -m 30 -w '%{http_code}' "$URL" || echo 000)"
  BODY="$(cat "$PROBE_BODY")"
  rm -f "$PROBE_BODY"
  if ! printf '%s' "$BODY" | grep -qF -- "$WANT"; then
    echo "PROBE MISSED: $URL answered $CODE and did not contain \"$WANT\"." >&2
    case "$CODE" in
      000) echo "  No answer at all — check the URL and that the app is up." >&2 ;;
      404) echo "  404: that path is not served. A wrong URL, not a wrong image." >&2 ;;
      2*)  echo "  It answered fine, so the string is the thing in doubt: is it on THIS payload?" >&2 ;;
      *)   echo "  Not a 2xx, so the body above is probably an error rather than your payload." >&2 ;;
    esac
    if [ "$DRY" = "1" ]; then
      echo "  Nothing was deployed — this is the CURRENT image answering." >&2
    else
      echo "  The deploy HAPPENED — the running image may not be the one you meant," >&2
      echo "  or the probe was wrong. Check both before believing either." >&2
    fi
    exit 1
  fi
  ANSWER="$URL contains \"$WANT\" ($CODE)"
fi

echo
if [ "$DRY" = "1" ]; then
  echo "would deploy $SHORT_SHA, probe: $ANSWER"
else
  # The line a later session can read instead of re-deriving what a release
  # was meant to change.
  echo "deployed $SHORT_SHA as $RELEASE, probe: $ANSWER"
fi
