# What breaks when a thread is renamed

> Sjoerd, 2026-10-14: *"Could there be a way to prevent this? A name change of
> a thread should not lead to a disconnect."*

Written after a real incident on soul.com: two membership access grants pointed
at threads by SLUG, both slugs changed, and five Fellowship members silently
got no seat. This is the inventory that decides how big the fix is — every
place in the platform that identifies a thread by its address rather than by
its id, and what each one does when that address changes.

A thread's slug is editable: `ThreadUpdate` in `apps/api/src/routes/thread.ts`
accepts `slug`, so the editor can change it, and nothing today warns that
anything points at the old one. Duplicating a thread also mints a slug
(`${src.slug}-copy-${3 random chars}`), which is how soul.com ended up with a
grant on `community-member-year-agenda-copy-9o5`.

## The incident, for the record

Reconstructed from production data on 2026-10-14, not from memory:

1. The thread `community-member-year-agenda` existed, and the Community Member
   Year Agenda product granted it.
2. On 13 October it was duplicated — the copy took
   `community-member-year-agenda-copy-9o5` — and that copy was granted by the
   Fellowship product.
3. Both were then renamed: the original to `community-agenda-2026`, the copy to
   `community-agenda-2027`.
4. Both grants died. The Community one surfaced on Sjoerd's screen as
   `error: no thread "community-member-year-agenda" in this workspace`. The
   Fellowship one had five members in `error` and nobody had looked.

Two renames, five stranded members, no warning anywhere. The calendar grant on
the same product kept working, which is why it read as a timing problem.

## The inventory

### 1 · `membership_access_grant.config.thread_slug` — BREAKS, loudly

`apps/api/src/lib/thread-access.ts` resolves the stored slug against
`(workspace_id, slug)` and stamps the journal row `error` when it misses. This
is the one that was found, and it is the best-behaved of the lot: it says what
is wrong, names the slug, and shows on the member's Access panel.

Two things still make it worse than it looks:

- **`error` is terminal.** The worker only picks up `pending` and
  `revoke_pending`; `reconcileMemberAccess` re-arms `revoke_pending`/`revoked`
  back to `pending` but never `error`. So correcting a grant would leave every
  already-errored member stranded — delete-and-re-add works only because it
  mints a new grant id and therefore new journal rows.
- **Nothing validates at save.** `POST /grants` already refuses a
  `team_calendar` or `fibre_seat` grant whose `team_id` is not one of this
  workspace's teams. The `thread` kind skipped that check, so a slug that
  resolves to nothing is accepted and fails later, in a worker, to an audience
  of nobody.

Both dialogs have offered a thread PICKER since v0.68.49 — this is not a
missing picker. It is a stored slug that stops resolving after the picking is
done.

### 2 · `membership_product.links[].kind === 'thread'` — BREAKS, SILENTLY

`apps/api/src/routes/portal.ts` resolves these to a public URL for the "what
you bought" buttons in my.thread. When the slug no longer resolves the code
falls through to a `url`-kind link, and failing that to `null` — so the member
simply sees no button. No error, no log, no journal row. **This is the worst
one in the list**, because the grant at least complains.

### 3 · Public thread URLs — BREAK for anything already sent

`GET /api/v1/thread/public/organiser/:slug/thread/:threadSlug` resolves at
request time, so pages always reflect the current slug. Everything already
carrying the OLD one stops working:

- enrolment and reminder emails already in people's inboxes;
- links shared in chats, newsletters and bookmarks;
- anything a partner site links to by hand.

Nothing in the database to fix — the links are out in the world. A slug history
with redirects is the only thing that helps, which is why it is its own item.

### 4 · Webflow / partner embeds — BREAK, and we cannot see them

`data-thread="<slug>"` lives in HTML on the customer's own site
(`apps/thread/app/embed.js/route.ts` and the generators in
`apps/thread/app/(app)/settings/embeds/`). A rename breaks every embed of that
thread, on sites we have no inventory of and no access to. The embed renders
its "not found" state, which a visitor reads as the event being cancelled.

Same answer: only a slug history fixes it.

### 5 · Clear — these do NOT break

Checked rather than assumed:

- **Enrolments** (`enrolment`, `thread_enrolment`) key on `program_id` /
  `thread_id`. Safe.
- **Certificates** (`thread_certificate`) key on `thread_id` and are served at
  `/certificate/:number`. Safe.
- **The external app contract** (`/api/v1/apps/:slug/thread/*`) addresses
  threads by **id** throughout. Safe — and good, since it is the published
  contract.
- **The team calendar grant** (`kind: 'team_calendar'`) stores a `team_id`, and
  team membership is what it grants. A thread rename cannot touch it. This is
  the shape every grant should have.
- **Scheduled message content** (`thread_engagement.content` /
  `description`): scanned all 102 engagements on production — no stack URLs
  stored at all. It CAN hold one if somebody pastes it; nobody has.
- **Tier and product descriptions**: scanned, no stack URLs.

## How much is broken right now

Read-only probe of production, 2026-10-14, after Sjoerd re-picked both threads:

| Reference | Total | Broken |
|---|---|---|
| `membership_access_grant` (kind `thread`) | 4 | 1 — on an ARCHIVED product, all six journal rows already `revoked`, nobody waiting |
| `membership_product.links` (kind `thread`) | 1 | 1 — the same archived product |
| `thread_engagement` content | 102 | 0 |

So **no live member is affected today**. The two survivors both belong to the
archived "Community Member Year Agenda" product and are harmless; they are
worth cleaning up as evidence, not as an outage.

## The fix, in the order that pays

1. **Store thread grants by id.** `{ thread_id }` beside `thread_slug`,
   resolved by id first and by slug only as a fallback for existing rows. A
   rename then cannot break a grant, which is the thing Sjoerd actually asked
   for. One-off backfill script per database (never a migration — the bulk
   conversion rule); dead references get REPORTED, never guessed.
2. **Re-arm `error` rows** when a grant changes, so a correction actually
   re-syncs instead of needing a delete-and-re-add.
3. **Validate at save**, the way `team_calendar` already does, and show an
   existing broken grant as broken in the dialog rather than as a normal row.
4. **The same two for product `links`** — id-keyed and shown as broken. This is
   the silent one, so it matters more than its size suggests.
5. **A slug history with redirects**, as its own item: `thread_slug_history`
   (slug, thread_id, retired_at), consulted when a public lookup misses. This
   is the only thing that protects sent emails, bookmarks and partner embeds,
   and it protects them retroactively.
6. **A warning in the editor** when a slug is changed: *"N things point at this
   thread by its address."* Cheap once 1 and 4 exist, because by then there is
   a list to count.

Items 1–4 are inside our own data and can be released together. Item 5 is the
one that changes behaviour for the public web and deserves its own release and
its own look.
