# Google Workspace addresses for members

**Sjoerd, 2026-09-23:** *"Can we also create users in Google with the app?"*
and, decisively: *"the email address they use to register is not a soul.com
email address. Which is fine. This 3 step process is only for people who
choose a Google Package within soul.com (or the domain of the workspace)."*

**Status:** PROPOSAL. Nothing here is built. §5 is the list only Sjoerd can
answer; §6 says exactly what was checked, so nothing below has to be taken on
trust.

---

## 1. The bug this uncovers, before any new feature

Today `runGoogleUserSync` suspends **`person.email`** — the address the member
registered with (`lib/google-admin.ts:173`, `setSuspended(auth.token,
person.email, …)`).

Sjoerd's sentence says that address is *deliberately not* a domain address. So
the worker currently asks Google to suspend `someone@gmail.com` inside the
soul.com directory, which cannot succeed. It writes an `error` row and the
Access page shows it.

It has only ever worked because the one account it was drilled against —
`finance@soul.com`, 2026-09-07 — happened to register with its domain address.
**The existing integration silently assumes registration address = Workspace
address, and that assumption is now stated to be false.**

So this is not "add creation to a working feature". It is: separate two
addresses that were always different, and creation falls out of it.

**What is missing is a field.** A member needs a *workspace address*, stored
apart from their login identity, set by the flow in §3 and read by the worker
instead of `person.email`. Everything else follows.

## 2. What exists

| Piece | Where | State |
| --- | --- | --- |
| Suspend / unsuspend worker | `lib/google-admin.ts` | Live, drilled once in production |
| Credential (service account + admin email) | `membership_settings`, per workspace | Set for soul.com AND the default workspace |
| The product | `membership_product` "email@soul.com / Google Workspace" | Exists, carries a `google_user` grant |
| Approval + billing consent | `fibre_seat_mode`, `allow_billed_seats` | Live, but wired **only** to Fibre seats |

Deliberate in the current worker, and worth keeping: it never deletes.
Suspension is reversible; deletion destroys mail and files.

## 3. The three outcomes

Only for a member whose tier or purchase includes the Workspace product. They
enter the address they want at the workspace's domain.

**A · Free.** Offer to create it. Subject to the approval policy (§4). On
approval: create with a random password, force change at first sign-in, and
route them to Google to set it.

**B · Taken, and theirs.** They prove it by **signing in with Google** —
Google verifies, we never see the password. On success we **link**, not
create. From then on a lapse suspends that account.

> Sjoerd's draft had them typing the password into our form so we could check
> it. That is a credential-harvesting shape and we must not build it. Same
> word he used for first sign-in — routing — gives the same outcome safely.

**C · Not at the domain.** They typed `name@gmail.com`. Say so plainly and
offer a domain address instead. **Do not link it.** Our access manages the
workspace's own domains and can never suspend a consumer account, so a link
would show "connected" on the Access page while a lapse changed nothing —
worse than refusing, because it looks like it works.

## 4. The approval switch, made general

Sjoerd: *"the fibre has a setting WAIT for approval. This should also go for
Google."* Right, and the same is true of everything after it — the card's own
footer already promises Slack, Discord and email tools.

`fibre_seat_mode` and `allow_billed_seats` are two hardcoded columns read by
one worker. Google is the second thing to need them. **Make the policy
per grant kind** (`circle`, `thread`, `fibre_seat`, `google_user`, …) rather
than adding `google_user_mode` beside `fibre_seat_mode` — one card component
rendered per connected integration, `seat-policy-card.tsx` generalised rather
than copied.

Default for Google: **approve**, never auto. A created account is a billable
seat on a Google bill nobody in this system can see.

## 4b. Two additions (Sjoerd, 2026-09-24)

**Mail both addresses, always.** Anything about the Workspace account goes to
the domain address AND the address they enrolled with. Obvious once stated and
easy to get wrong: a suspension notice sent only to `name@soul.com` arrives in
an inbox they can no longer open. The enrolment address is the one that still
works when the other stops, so it is the one that carries bad news.

**The money runs at two different speeds.** A member pays a YEAR in advance;
Google bills soul.com MONTHLY. Sjoerd: *"so the costs should be relative."*
Three separate things hide in that sentence and they want separating:

1. **Cash timing** — a year up front against twelve monthly payments out. In
   soul.com's favour, and needs nothing built.
2. **A part period** — somebody joining in month seven. Charging a full year
   for five months of service is the thing to avoid, so the price wants
   prorating to the remaining term.
3. **Price against cost** — €193.20/year should stay tied to what Google
   actually charges, so a Google price rise does not silently eat the margin.

Only 2 and 3 are design. **D6 below asks which of them he means**, because
prorating a join is a different piece of work from pegging a price to cost.

**The lapse case is already covered by the year-in-advance shape**, and worth
saying so: a member who stops after three months has already paid for twelve,
so soul.com holds nine months of their money while paying Google for a
suspended account. The exposure starts when that paid year ENDS — which is
exactly what D2 is about, and §4c now makes it unignorable.

## 4c. Suspension does NOT stop the Google bill

Checked against Google's own documentation on 2026-09-24, because the
assumption ran the other way:

> "Suspended accounts are still charged at the same rate as active accounts on
> both the Annual billing plan and the Flexible plan."
> — [Suspend a user temporarily](https://support.google.com/a/answer/33312)

Deleting is what reduces the bill, and deleting is the thing this worker
deliberately never does. So the current revoke path parks a permanent cost:
suspended forever, billed forever, and never mentioned again by anything in
the app.

**Suspension stays the right revoke action** — reversible, and it protects
mail and files. What is missing is the step after it: suspended accounts
surfaced somewhere Sjoerd will see, with an explicit "delete and stop the
charge" that asks about the data first. The destructive step stays human; the
cost stops being silent.

This promotes D2 from housekeeping to the decision that governs whether this
feature costs money forever.

## 5. Decisions — Sjoerd only

- **D1 · Which domain?** A Workspace can host several. Derive from
  `google_admin_email` (`sjoerd@soul.com` → `soul.com`), or store it
  explicitly? Explicit is safer and is one field.
- **D2 · What happens to a suspended account that never comes back?** Today:
  suspended forever, still consuming a Google licence. Options: leave it,
  alert an admin after N months, or a transfer-and-delete ritual. This is a
  people decision, like creation was.
- **D3 · Does a suspended seat still cost you?** Check against the Google plan
  before joining is allowed to spend money. Determines whether D2 is urgent.
- **D4 · Who approves?** Any workspace admin, or a named person?
- **D6 · What does "costs should be relative" mean?** Prorating a mid-term
  join to the remaining months, pegging the price to Google's actual cost, or
  both? They are different pieces of work.
- **D5 · Alternatives on collision.** Sjoerd said *"this already exists… alt"*.
  Suggest (`j.smith`, `smithj`), or just refuse and let them retype?

## 6. What was actually checked

- `lib/google-admin.ts` header (lines 5-10) and the suspend call at 173 — the
  never-create, never-delete design and the `person.email` assumption.
- `membership_settings` on production: both workspaces have
  `google_sa_json` set and `google_admin_email` = `sjoerd@soul.com`.
- The `google_user` grant on production points at product
  `email@soul.com / Google Workspace`.
- `fibre_seat_mode` is `z.enum(['auto','approve'])` in `routes/membership.ts`
  (171-172), read in `lib/fibre-seat.ts:134`, rendered by
  `settings/seat-policy-card.tsx`. Fibre seats only.
- Google's Directory API scope `admin.directory.user` manages accounts in the
  account's own domains — the basis for outcome C.

- Google's billing for suspended users — now CHECKED (§4c) against
  `support.google.com/a/answer/33312`: billed at the full rate on both plans.
  D3 is therefore answered, and it is the answer that makes D2 urgent.

**Not checked:** whether soul.com is on the Annual or Flexible plan. It does
not change the billing answer — both charge for suspended users — but it does
change how quickly a deletion stops the charge.
