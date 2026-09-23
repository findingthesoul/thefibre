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

**Not checked:** how Google bills a suspended user on Sjoerd's specific plan
(D3). Stated as a question rather than a fact.
