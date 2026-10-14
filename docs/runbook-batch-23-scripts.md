# Two production scripts, after batch 23

Both run from **Sjoerd's own terminal**, against **production**, after batch 23
has landed (they need the code it ships). Both are a **dry run by default**:
nothing is written until the same command is run again with `--apply`. Read
the dry run first; if it says anything you did not expect, stop and ask.

---

## 1. Thread grants get their thread's id — `backfill-thread-grant-ids`

**Why.** Membership grants of kind *thread* used to remember a thread by its
address (slug). Renaming the thread silently broke them: the member got
nothing. New grants are stored by id. This gives the old ones their id —
but only where exactly one thread matches. Anything else is listed for a
person and left exactly as it was.

**Dry run** (reads only):

```bash
cd ~/Projects/thefibre/apps/api && npx tsx --env-file=.env scripts/backfill-thread-grant-ids.ts prod
```

**What a good dry run looks like:**

```
PROD  DRY RUN — nothing is written

  soul · Community member · "https://app.thethread.app/soul/community-member-year-agenda"  →  thread 3f…e1 ("community-member-year-agenda", via slug)
      2 stuck access row(s) would be re-armed to pending

N thread grant(s): 0 already by id, N to write, 0 need a person. 2 stuck access row(s) to re-arm.

DRY RUN — re-run with --apply to write.
```

- Each `→ thread …` line is one grant that will get its id. The quoted part
  is what the organiser originally typed; the thread in brackets is what it
  resolves to. **Check those match** — they should name the same thread.
- `stuck access row(s)` are members whose access stalled at "error" (the
  worker could not find the thread). After `--apply` they go back to
  *pending* and the next five-minute tick delivers. Only members who are
  active or in grace are re-armed; lapsed ones are left.
- **`NEED A PERSON`** lists grants that matched no thread, or more than one.
  They are not touched. Fix each in Members → Access (delete and re-add the
  grant, picking the thread) — the grant now shows the problem in red there.

**Then apply:**

```bash
cd ~/Projects/thefibre/apps/api && npx tsx --env-file=.env scripts/backfill-thread-grant-ids.ts prod --apply
```

The last line should read `… N written, 0 need a person.` Running it again
afterwards should say `N already by id, 0 to write` — it is safe to repeat.

---

## 2. Everyone in soul.com Internal and at least Organiser — `set-workspace-role --all-members`

**Why.** Sjoerd, 2026-10-14: *"all the others in soul.com are internal as
well. And organisers."* The members were left external with no role by how
the workspace was first filled.

**It never lowers a role.** Organiser is a floor: anybody already admin or
super_admin keeps it (Sjoerd is super_admin there and stays so). Everybody's
relationship becomes *internal*.

**It leaves paying members' seats alone.** A member whose tier gives them a
Fibre seat has a workspace row the seat sync owns (external, with its own
role). The sweep is for the organisation's own people, so those rows are
listed under `SEAT HOLDERS (left as they are)` and not touched. Only add
`--include-seat-holders` if you really mean to make paying members internal.

**Dry run** (reads only — run from the repo root, the script finds
`apps/api/.env` itself):

```bash
cd ~/Projects/thefibre && node apps/api/scripts/set-workspace-role.mjs prod --workspace soul --all-members --role organiser --relationship internal
```

`--workspace` takes the workspace's **slug** (or its exact name, e.g.
`soul.com`; if two workspaces share a name it refuses and asks for the slug).

**What a good dry run looks like:**

```
PROD  DRY RUN — nothing is written
soul.com  (soul)    12 member(s)

  member.one@example.com                 organiser  (unchanged)    external→ internal
  member.two@example.com                 null       → organiser    external→ internal
  sjoerd@soul.com                        super_admin(kept — senior)    internal(unchanged)
  …

SEAT HOLDERS (left as they are): 40
  paying.member@example.com              organiser    external
  …
  (paying members with a Fibre seat; add --include-seat-holders only if you mean them too)

11 row(s) to change.

DRY RUN — nothing was written. Re-run with --apply to make these changes.
```

- **Your own line must say `(kept — senior)`.** If it shows `→ organiser`,
  stop — that would be a lowering and the script is not doing what it says.
- Every `→` is a change that `--apply` will make; `(unchanged)` lines are not
  touched.
- **The SEAT HOLDERS list should be your paying members**, not your team. If
  someone on your team appears there, they hold a seat through a membership
  as well; they are left as they are — change them by hand with
  `--email <addr> --workspace soul --role <r>` if needed.

**Then apply:**

```bash
cd ~/Projects/thefibre && node apps/api/scripts/set-workspace-role.mjs prod --workspace soul --all-members --role organiser --relationship internal --apply
```

Each changed row is written one at a time and read back; the last line
should read `11 of 11 row(s) changed.` and the exit is non-zero if any row
failed. Running it again should say `0 row(s) to change. Nothing to do.`
