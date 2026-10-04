# Runway control

Several chats share one repo and one `staging` branch. Sjoerd, 2026-10-01:
*"Think of it as air traffic control. No one lands or departs without
permission and full safety checks."* This is that, enforced by the scripts
every landing and departure already goes through. The rule is in CLAUDE.md
rule 4; this is how to operate it.

## Vocabulary

| Aviation | Here |
|---|---|
| Land | push to `staging` (`release.sh`, or a docs push) |
| Depart | `deploy-api.sh staging|prod`, `promote.sh` (main) |
| Clearance | one file in the SHARED git dir, `runway/clearance` |
| Controller | the session that runs `clear`; a role, not a chat |

One runway: **one clearance at a time.** It is created with noclobber, so two
grants cannot both succeed.

## As a pilot (any session that wants to land or deploy)

```bash
export RUNWAY_SESSION=meet          # who you are; per command, shells don't persist
RUNWAY_SESSION=meet ./scripts/runway.sh request --kind release \
  --sha <sha> --what "one line" \
  --verified "typecheck, unit, real build" \
  --unverified "nobody has seen the card rendered"
```

Then **wait**. Do not push. The controller replies "CLEARED" or says why not.
When cleared, run your normal ritual: `RUNWAY_SESSION=meet ./scripts/release.sh`.
It checks the clearance, runs `pnpm verify`, **checks again** (verify takes
minutes), pushes, and calls `land`, which frees the runway.

`--unverified` is mandatory. Write `nothing` only when that is true.

**Quote the request text with single quotes** (or a heredoc). Inside double
quotes the shell runs backticks and `$( )` before the script sees them, and
a request arrives saying something you did not write. `request` prints the
entry back as it was stored; read it. Two requests from one session in the
same second are refused rather than one replacing the other: run it again.

A rebuilt commit leaves its old request behind. Take it out yourself:
`RUNWAY_SESSION=<you> ./scripts/runway.sh withdraw --sha <sha>`.

Kinds: `release` (code → staging), `docs` (docs/`*.md` only → staging),
`api-staging`, `api-prod`, `prod` (promote).

## As the controller

```bash
./scripts/runway.sh queue                 # who is waiting, oldest first, numbered; read their UNVERIFIED line
./scripts/runway.sh status                # who holds the runway
./scripts/runway.sh clear <name> --by <you>
./scripts/runway.sh clear <name> --by <you> --sha <sha>     # which request, when <name> has several
./scripts/runway.sh clear <name> --by <you> --allow-delete  # the commit removes files on purpose
```

**Which request.** When a session has one request waiting, `clear <name>`
takes it. When it has several for different commits, `clear` refuses and
lists them, and you name one with `--sha` (the eight characters `queue`
prints are enough). Several entries for the SAME commit are one request
whose wording was corrected: the newest stands and the older ones are
dropped with it. Before 2026-10-02 `clear` silently took the newest entry
whatever it was, and granted the wrong one twice in a day.

**Deletions.** `clear` refuses a `release` or `docs` commit that removes
files which are on staging, and prints the paths. That is almost never
meant: it is what a rebase resolved the wrong way looks like, and a docs
push is the push nobody reads. A deliberate removal needs
`--allow-delete`, which is written to the log with your name.

`clear` refuses if the runway is busy, or if a `release` commit isn't built on
current `origin/staging`, or a `docs` request touches code, or the range adds
migrations whose versions collide with any worktree
(`scripts/check-migration-versions.mjs` reads every one — prune dead worktrees
with `git worktree prune`). For `prod` and `api-prod` it also requires
`--sjoerd-said "<his words>"` and logs them: **production is only his.**

**Docs may sit on a stale base; code may not** (Sjoerd, 2026-10-03). A
`release` must be built on the current staging, because a stale base ships
stale code. A `docs` request need not: the runway holds everyone else off
while a clearance stands, so the pilot rebases the .md onto the head just
before pushing and nothing moves underneath. Three sessions had each spent a
round trip rebasing one .md onto another's. What a stale docs commit may NOT
do: touch a path an EARLIER waiting request also changes (refused with the
path; first asked, first landed, the later one rebases and asks again), or
delete anything (refused, and `--allow-delete` does not rescue a stale one).
The CLEARED line says "rebase onto origin/staging before you push" when it
applies, and the diff shown is the commit's own changes from where it left
the base, not a diff against the head.

If staging moves between grant and landing, the clearance is **void** and the
pilot rebases and requests again. That is the 2026-10-01 lost-race failure,
refused instead of discovered.

After a landing, the controller looks at it: `node scripts/smoke-staging.mjs`,
and the surface that changed. The gate proves what it exercises; the pilot's
`--unverified` line is the part of the claim nothing checked.

## Cadence: don't run behind, don't save up

Sjoerd, 2026-10-02, as the controller relayed it to every chat: *"don't run
behind, don't save up commits."* When he said it, staging was seven
releases (eleven commits, 21 hours) ahead of production, and the day before
one chat had held five finished commits it could not push. Both are the same
problem: work that is done and not where it belongs. Three rules, the same
for every chat:

1. **Ready work is requested within about four hours**, not held. A commit
   that waits is a rebase and a renumbering later.
2. **Small releases, one theme each.** A move and a behaviour change never
   share one, even when the change looks obviously right: split them so each
   reverts alone (v1.98.0 and v1.98.1 are the worked example).
3. **The controller watches staging minus production** and asks Sjoerd for a
   promote before it reaches about five releases or 24 hours. A hotfix goes
   at once. Production still moves only on his words.

The measure, for anyone:

```bash
git fetch -q origin
git rev-list --count origin/main..origin/staging                       # commits waiting for production
git log --reverse --format='%h  %cr  %s' origin/main..origin/staging | head -1   # the oldest of them, and its age
git log --oneline origin/main..origin/staging | grep -c ' v[0-9]'      # how many of those are releases
```

Zero on the first line means production is level with staging.

## Migrations: always through the two scripts

Staging: `./scripts/db-push-staging.sh`. Production:
`./scripts/db-push-prod.sh`, on Sjoerd's words. **Never a bare
`supabase db push`.** The CLI remembers one linked project per checkout
(`supabase/.temp/project-ref`), and by convention it rests on PRODUCTION (the
staging script links to staging, pushes, and puts the link back), so a bare
push meant "for staging" writes to production and reports success. On 2026-10-03 exactly that bare command was handed to a chat as an
instruction; the chat read `supabase/.temp/project-ref`, saw production, and
refused. Read that file when in doubt: it names the project a bare command
would hit.

One guard since v1.99.4: `pnpm verify` refuses when this checkout's link is
NOT resting on production (`scripts/check-supabase-link.mjs`). A staging push
interrupted before its restore leaves it on staging, and the next bare push
meant for production would then land on staging and say it worked.

Not gated, and known: `db-push-prod.sh` itself needs no clearance, so a
production schema change is the one production act the runway does not
cover. A gate for it is built and parked (branch `stress-db-prod`); it would
change how Sjoerd runs a production migration, so it waits for him.

## What a release clearance does not cover

**A clearance says who may land, not that the commit is a release.** On
2026-10-04 `release.sh` printed "Released 1.99.2" and pushed a commit titled
"wip:" whose `package.json` said 1.99.1 and whose changelog heading was
still `[NEXT]`: the script pushes HEAD and had read every version surface
from the files on disk, where the stamps sat uncommitted. Since v1.99.4:

- `release.sh` reads every version surface from HEAD, refuses stamps that
  are on disk and not in the commit, refuses a subject that names no
  version, and refuses a `[NEXT]` entry left above the numbered one.
- The pre-push hook is the second layer, for a bare `git push`: under a
  `release` clearance the pushed commit's subject must start `v<version> `,
  and that version must be `package.json`'s and the top changelog heading's.
  Docs pushes under a `docs` clearance are not asked for a version.

**The lane.** A request may declare `--lane "apps/meet docs/meet-*.md"`
(prefixes or patterns, space-separated). `clear` then refuses a commit that
changes anything outside it, naming the paths; the version surfaces and the
changelog are exempt. A file swept in from another session's work shows in
no changelog and no test run, and this is the one place it does.
`--allow-out-of-lane` is the controller's logged override. No lane declared
means no check: it is opt-in.

**The shared checkout's branch is shared state**, like the stash stack and
the migration history: three things that look local and are not. Never switch
it; take a worktree for anything you'll commit. `release.sh` refuses to run
in the main checkout when its branch is not `main` (`runway.sh
check-checkout`); a worktree's branch is its own and is exempt. On 2026-10-04
one chat switched the main checkout to its own branch and another chat's
release then committed onto it, carrying two of its files.

## When the tower is down (read this at 02:00)

- **The clearance expires on its own after 45 minutes.** A dead holder costs one
  timeout. `./scripts/runway.sh status` shows how long is left;
  `./scripts/runway.sh abort --by <you>` frees it now.
- **The hook fails open** if `scripts/runway.sh` crashes (exit 70) or is missing
  from an old checkout, and **never gates a person at a terminal** (a tty on
  stderr and no `RUNWAY_SESSION`).
- **Emergency override, no docs needed:** `RUNWAY_BYPASS="<reason>"` before the
  command. It works, and it is written to the log, so it is visible later.
  A bare `git push --no-verify` skips the hook but not `release.sh`.

## State and log

`$(git rev-parse --git-common-dir)/runway/` → `queue/`, `clearance`, `log`
(REQUEST, CLEARED, LANDED, VOID, EXPIRED, BYPASS, ABORT). Untracked; shared by
every worktree of this clone. Install the hook once per clone:
`./scripts/runway.sh install-hook`.

## What it does not do

It cannot stop a session that deliberately bypasses it (that is what the log is
for), and it cannot know whether a feature works. `scripts/runway.test.sh`
exercises the mechanism in a throwaway repo.
