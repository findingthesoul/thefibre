# The Thread's public read API

_Scope, not a plan of record. Written 2026-08-29 after comparing the rebuild
against the standalone at `thethread.app`, which had a `/developers` page and a
CORS-open read API that the rebuild did not carry over._

**The ask:** make `/api/v1/thread/public/*` callable from a customer's own
website, and publish its shapes as a contract — the way `/api/v1/apps/*` is a
contract. Not a change to any embed.

---

## 1. What is actually in the way

Less than it looks. The auth gate is already open.

`middleware/app-context.ts` lists `/api/v1/thread/public/` in `PUBLIC_PREFIXES`
— those routes bypass authentication entirely. No JWT, no `X-App-ID`, no app
key. Anyone with `curl` can read them today, and does: they are what the public
thread pages render from.

The only thing stopping a script on `festivaloftrust.org` from calling them is
`server.ts`, which applies one `cors()` to `'*'` with a default-deny allowlist
of the five `*.thefibre.app` origins, localhost, and our own Vercel previews.
There is no per-prefix exemption.

**So the honest framing: CORS is not protecting this data.** The data is
already world-readable to any non-browser client. What CORS currently does is
prevent browser JavaScript on someone else's page from reading it — which stops
no determined party, and does stop the one integration pattern we might want.

That reframes the work. This is not "should we expose thread data" — it is
already exposed. It is **"are we willing to name these shapes and stand behind
them"**, plus the abuse controls that come with inviting traffic.

## 2. The real work is the shapes, not the header

The CORS change is a dozen lines. The contract is the job, and there is a
defect that has to be fixed first.

`GET /public/organiser/:slug/thread/:threadSlug` returns:

```js
thread: { ...thread, ...effectivePrice(...), payment_methods, tickets, agenda, … }
```

`...thread` spreads the raw `thread_thread` row. Today that carries
`workspace_id`, `team_id`, `organiser_id`, `payment_destination`,
`registration_fields`, `certificate_enabled`, `requires_approval`,
`share_participants_public` — internal plumbing that leaked into a public
payload because nobody enumerated it.

Worse for a contract: **every column added to `thread_thread` from now on joins
the public API automatically.** That is the exact inverse of the additive-only
discipline in CLAUDE.md rule 8. A published surface has to enumerate its fields
explicitly, so that appearing in public is a decision rather than a side effect
of a migration.

The other two are in better shape. `/public/embed/threads` already maps to an
explicit object. `PUBLIC_ORGANISER_SELECT` is an explicit column list with no
`user_id` and nothing about payments.

Credit where due: the payload is already carefully minimised where it counts —
`meeting_url` is reduced to `is_online`, the participant list is first names
only and consent-gated per brief §9, and draft/archived threads 404 even by
direct link. The problem is the spread, not the judgement.

## 3. What ships

**Publish (GET, anonymous, cross-origin):**

| Route | Returns |
|---|---|
| `/public/embed/threads` | listing, filtered by `organiser` \| `team` \| `org` \| `workspace` |
| `/public/organiser/:slug` | owner + their public threads |
| `/public/organiser/:slug/thread/:threadSlug` | one thread: agenda, tickets, price, capacity |

**Do not publish:**

- `POST /public/enrol` — writes PII. Enrolment stays on the Fibre origin, in
  the frame or on the hosted page. This is the line that does not move.
- `POST /public/validate-coupon` — cheap oracle for brute-forcing discount
  codes. Keep it same-origin.
- `GET /public/my-enrolments` — reads a participant's bearer token.
- `/public/certificate/:number` — deliberately unguessable-by-design; no reason
  to invite scripted access.

**Work items:**

1. **Enumerate the thread payload.** Replace the `...thread` spread with an
   explicit field list. Behaviour-neutral for our own pages; it is what makes
   the shape a contract. Do this first — it is the only item that is a bug
   regardless of whether the rest ships.
2. **Scoped CORS.** A second `cors()` mounted on `/api/v1/thread/public/*`
   before the global one: `origin: '*'`, `credentials: false`,
   `allowMethods: ['GET']`, `allowHeaders: ['Content-Type']`. Everything else
   keeps the allowlist. `credentials: false` is load-bearing — an open origin
   with credentials is the combination browsers reject and we should not want.
3. **Rate limiting.** None exists today anywhere in the API. Per-IP token
   bucket in front of the public prefix, `X-RateLimit-Remaining` on responses.
   The standalone shipped the header before enforcing the limit; that ordering
   is right — publish the signal, tighten later with data.
4. **`/developers`** on `thread.thefibre.app`: the three routes, their field
   tables, an honest statement that enrolment is not open and why, and the
   `embed.js` snippets that already live in Settings → Website embeds.
5. **A contract test** asserting each published field, mirroring step 7b of
   `scripts/verify-external-app.mjs`. Without it, rule 8 is a comment.

**Roughly:** 1 and 2 are half a day. 3 and 5 are a day. 4 is a day, mostly
writing. Call it 2–3 days, and item 1 is worth doing on its own this week.

## 4. What this does not commit us to

It does not commit us to Shadow DOM widgets, and it should not be sold as a
step toward them. It makes them *possible* later — a widget cannot exist while
the API is unreachable from a browser — but the frame stays, and the reason it
stays is unchanged: enrolment collects personal data and belongs on our origin.
The standalone resolved that by making registration a link that navigates away;
we resolved it with an in-place popup, which is better for the organiser and is
not worth trading for layout elegance.

See the memory note `design-embed-iframe-deliberate`.

## 5. The argument against

Worth stating plainly, because it is not weak.

Publishing a contract means never breaking it. `/api/v1/apps/*` earns that cost
because external apps are a strategic direction with a verification script
behind it. A public read API for Thread has, today, **one** known consumer —
our own embeds, which are same-origin and do not need it. Every field named in
§3 becomes something we cannot rename.

The counter is that the shapes are already public, already relied upon by our
own pages, and already drifting toward accidental publication via the spread.
Naming them costs little more than the discipline we should be keeping anyway,
and the `...thread` fix is owed regardless.

**Decision to make:** ship all five items, or ship item 1 alone now and hold
the rest until a second consumer actually exists. Item 1 is not optional either
way.
