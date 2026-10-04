# Converting the stored bios to rich text — the plan for steps B and C

Status: **plan only, nothing executed.** Written 2026-10-02 after A1
(v1.98.6) and A2 (v1.98.8) landed on staging.

Sjoerd asked for a WYSIWYG on the profile bio, one editor shared by every
app. The readers already render formatting. What is left is the data: every
bio in both databases is plain text, and the editor will write HTML.

## Why this is not a migration

A Supabase migration runs wherever it is applied, and `promote.sh` carries
the repo to production. A conversion written as a migration would therefore
convert **production** the moment the next promotion happens, which is
exactly the thing Sjoerd has to decide separately. So the conversion is a
**script**, run deliberately against one database at a time:

- **Step B** — staging, on the controller's clearance.
- **Step C** — production, on Sjoerd's own words, in its own operation, never
  in the same step as code.

## What gets converted

Four columns hold a person's bio. All four are read by something public:

| table | column | who reads it |
|---|---|---|
| `identity_profile` | `bio` | the profile SPoT — every app, via `profileFor` |
| `user_profile` | `bio` | the pre-September per-seat rows, still a read fallback |
| `thread_organiser` | `bio` | read fallback under the profile (A2) |
| `meet_host` | `bio` | read fallback under the profile |

`team.description` is **not** in scope. It is a team's description, it has no
editor behind it, and `bioToHtml` already wraps it for display.

The transform is `bioToHtml` from `packages/shared/src/bio-html.ts` — the same
function the readers use, so a converted bio renders identically to how it
rendered the day before. Rows that already look like HTML are skipped, which
is what makes the script safe to run twice.

## The backup, and proving the way back BEFORE going forward

A backup column per table is four schema changes to undo later. Instead, one
table:

```sql
create table bio_conversion_backup (
  id           bigserial primary key,
  source_table text        not null,
  row_key      text        not null,   -- email, user_id or id, per table
  bio_before   text,
  converted_at timestamptz not null default now()
);
```

It is written **in the same transaction** as the update, never after it.

The order of operations is the part that matters, and it is deliberately
the opposite of the tempting one:

1. Count the rows that would change, and print a sample. Change nothing.
2. Convert **one** row. The one with the most awkward content, not the
   easiest — a bio with a `<`, an ampersand or a blank line if one exists.
3. **Restore that row from the backup and assert it is byte-identical to
   what it was.** If the restore path does not work on one row, it does not
   work on four hundred, and that is the moment to find out.
4. Convert the rest.
5. Print the count and a before/after sample of what actually changed —
   read back from the database, not from what the script intended to write.

A restore script (`--restore`) exists from the start and is run in step 3.
It is not written afterwards "if we need it".

## What the report must say

Not "done". For each table: rows seen, rows already HTML and skipped, rows
converted, and three before/after pairs read back from the database. Plus
the backup row count, which must equal the converted count.

## Known blocker — I cannot reach staging's database

`apps/api/.env.staging` does not exist in this checkout; the main checkout
has only `apps/api/.env`, which is **production**. `clone-prod-to-staging.mjs`
expects the staging file, so it has existed somewhere, but not here.

That is why this is a plan and not a run. The same gap stopped the A2 probe:
there is no way for this session to read staging, so it cannot count staging's
bios, cannot name a staging fixture, and cannot run the conversion.

Two ways out, both Sjoerd's call, neither of which a session should arrange
for itself:

1. He puts the staging service key in `apps/api/.env.staging` (gitignored,
   same shape as the production file this session already uses).
2. The conversion runs from a session that already has staging access, with
   this document as the procedure.

Until then step B is written and unexecuted — which is the correct state for
it to be in, not a delay to work around.

## The order changed: D shipped before B (2026-10-04)

Written as A → B → C → D → E. It shipped A → D → B → C → E, and the reason is
worth keeping: **nothing forced the bulk conversion to come first.** The
readers take plain or HTML, the API sanitises on write, and the editor is
seeded through `bioToHtml`, so a legacy bio converts the next time its owner
saves — one at a time, by the person who wrote it, which is the gentlest
migration there is.

What that does NOT do is reach the bios of people who never open their profile
again. So B and C are still required, and **E still depends on them**: the
detector can only be deleted once no plain text remains.

## Step D, afterwards

The editor flip in `packages/shared/src/ui/profile-form.tsx`, which is where
every app's profile form is composed. The API already sanitises on write
(`apps/api/src/routes/profile.ts` → `sanitizeRichText`), so the flip adds no
new trust boundary.

## Step E — the demolition

Delete `packages/shared/src/bio-html.ts`. After C there is no plain text left
to detect, and a detector kept in permanent code is a guess that will one day
be wrong about one person's bio with nobody watching. The readers then take
`bio_html` as the only shape, and the API flattens with `richTextToPlain` for
the plain `bio` it publishes.
