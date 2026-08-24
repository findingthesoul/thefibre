# Brief — platform work for the full Festival of Trust arc

_Written 2026-08-24, against v0.17.0 / Flow 1.13.0. Claims below were checked
against the schema and the running API; where something is a proposal it says
so._

## Scope of this brief

**The planner itself is not blocked.** v0.14.0 and v0.17.0 closed everything it
needs — app keys, scopes, `group_key`/`group_label`, `meta`. Do not re-open that.

This brief covers the platform work needed for the arc *after* the planner:

> Flow runs the nine steps → The Thread publishes the festival and takes
> registrations → the platform holds the people, the programme and the
> enrolments underneath both.

---

## 1. The Thread has no app-key surface — the main piece

Today the only app-facing surfaces are `routes/app-flow.ts` and `routes/apps.ts`.
An external app cannot reach The Thread at all. `/api/v1/thread/*` runs on
`userClient(ctx.jwt)` and is bounded by RLS acting on a real signed-in user, so
an app key — which has no user — is denied everything. Exactly the situation
`app-flow.ts` was written to solve.

So this is a second `app-thread.ts`, following the same pattern and the same
CONTRACT block: additive-only, app sees only its own records, published shape
rather than table shape, asserted in `verify-external-app.mjs`.

### What the planner actually needs

Modest, and worth keeping modest:

| Need | Shape |
|---|---|
| Publish a festival as a public page | `POST /apps/:slug/thread/threads` — create programme + thread |
| Read back what it published | `GET /apps/:slug/thread/threads/:id` |
| See who registered | `GET /apps/:slug/thread/threads/:id/enrolments` |
| Update the page as the plan firms up | `PATCH /apps/:slug/thread/threads/:id` |

It does **not** need to write enrolments. Registration comes from the public
form, not from an app.

### The wall runs through `thread_enrolment`

This is the part to get right, and the schema already says so in a comment:

```sql
answers jsonb,  -- registration_fields responses — never crosses the wall
```

An enrolments response for an app must expose the person and their status, and
must **not** expose:

- `answers` — whatever the organiser asked on the form, explicitly walled
- `stripe_session_id`, `stripe_payment_intent`, `amount_cents`, `coupon_id` — an
  app that plans festivals has no business reading payment instruments

Default-deny on the field list, the same way the route allow-list is
default-deny. A `select('*')` here would quietly hand a third party the contents
of every registration form in the workspace.

### Scopes

Proposed: `read:programs`, `write:programs`, `read:enrolments`.

Deliberately no `write:enrolments`. If an app could write enrolments it could
enrol arbitrary people in arbitrary programmes, and enrolment is the row the
whole certificate and payout chain hangs off.

### Idempotency

Follow the `flow_run` precedent — `source_app` + `source_ref`, unique per
programme — so a planner that retries a publish gets the same thread back rather
than a second public page. `flow_run` got this in the 2026-07-09 external
subjects migration and it has paid for itself.

---

## 2. Nothing links a festival plan to its public page

A festival is a `flow_run` in Flow and would be a `program` + `thread_thread` in
The Thread, and there is currently no edge between them. Without one, the
planner has to keep that mapping privately, and neither Flow's UI nor The
Thread's can show the other side.

`program` already carries `app_id`. The cheapest addition consistent with what
exists is `source_app` / `source_ref` on `program`, matching `flow_run`. Then a
planner sets `source_ref` to the same plan id on both, and the link is derivable
without a new join table.

Worth deciding deliberately rather than letting each app invent its own
convention — this is the third time the "which app owns this mirrored row"
question has come up.

---

## 3. Correction to `fibrebriefing.md`

Its endpoint table lists paths as `/apps/fot-planner/flow/flows` and
`/apps/whoami`. Everything is mounted under `/api/v1` — `server.ts:119` routes
`/apps` into the v1 router. Verified against production:

```
/api/v1/apps/whoami   → 401 (exists)
/apps/whoami          → 404
```

A client written from that table verbatim 404s on every call. Worth fixing in
the doc, since it is the first thing an integrator copies.

---

## 4. Smaller items, already on the list

- **Curator-data write API** (build-plan 9a). Without it the planner cannot
  annotate a person with its own fields — e.g. "hosted a festival in Athens".
  Not blocking, but it is the remaining piece of the external-apps brief.
- **First-party apps declare no `activity_types`** (build-plan 9c), so they keep
  the permissive path while external apps are held to their manifest. Fine for
  now; worth closing so the rule is the same for everyone.
- **The communities/organisations variation** (`brief-flow-as-planner-engine.md`
  gap 5). Needs a design decision — whether variation belongs in Flow at all —
  before any code. Keep it in the planner meanwhile.

---

## What the data actually looks like, for whoever writes the surface

Worth stating plainly, because it is easy to get backwards and it determines
what the surface may expose:

| Table | Owner | Holds |
|---|---|---|
| `person`, `organisation` | platform | the humans and the orgs |
| `program` | platform | the thing people enrol in — title, format, dates, `app_id` |
| `enrolment` | platform | **the registration**: person ↔ programme, status, progress |
| `activity` | platform | the shared timeline |
| `thread_thread` | The Thread | the public page: slug, cover, price, capacity, form fields |
| `thread_enrolment` | The Thread | commerce and answers on top of an `enrolment` |

So a registration is a **platform** row, not a Thread row. The Thread adds the
storefront, the money and the form answers. That is why an app-facing enrolments
route is reasonable to build at all — it is reading platform data through a
Thread-shaped lens, not reaching into another app's private tables.

## Suggested order

1. **§1 `app-thread.ts`** — the only true blocker for the registration half.
2. **§2 the programme↔run link** — small, and cheaper to decide before two apps
   have invented conventions.
3. **§3** — a doc fix, minutes.
4. **§4** as capacity allows.

## Verification

Extend `verify-external-app.mjs` the way step 7 covers Flow: publish a thread as
`fot-planner`, read it back, read its enrolments, and assert that `answers` and
the Stripe fields are **absent** from the response. The absence assertion is the
one that matters — it is the wall, and a `select('*')` regression would
otherwise pass every other check.
