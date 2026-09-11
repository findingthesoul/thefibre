# Overnight pass — 2026-09-12

Sjoerd asked for the full cycle: debug, legacy removal, optimisation, docs,
debug again. Run unattended from 01:06 after a scheduled attempt at 23:00
stalled on an unanswered permission prompt without running a single test.

**Read this first:** bypass permissions was switched on at about 01:10 so this
could run without stalling. **It is still on.** Turn it back off — it was a bet
that only made sense while nobody is on the platform, and a client arrives the
week of 2026-09-14.

---

## Phase 1 — Debug

Every layer ran. Findings below the table.

| Layer | Result |
|---|---|
| Typecheck, 12 projects | pass |
| Unit tests | 132 pass |
| Production smoke | pass |
| Staging smoke | pass |
| Published contract, production | pass |
| Published contract, staging | **could not run** |
| Integration suite, staging | 40 pass |
| Playwright, staging | 16 pass |
| External-app contract, staging | pass |
| Stripe webhooks, staging | **4 problems** |
| Stripe webhooks, production | **could not run** |
| Root-slug audit, both | pass |
| Workspace-admin audit, both | **crashed, then passed** |

A note on what "pass" is worth here. The suite attaches to contracts, money,
sign-in and tenancy, and deliberately not to interface plumbing. So a green
run says the promises hold; it does not say the screens are right.

### Fixed and shipped (v0.72.3)

**The workspace-admin audit crashed on both environments.** It required the
caller to remember `node --env-file=.env` while every other script in that
directory takes `FIBRE_ENV_FILE` and parses the file itself. The reward for
forgetting was a supabase-js stack trace reading `supabaseUrl is required.`,
naming neither the script nor the file nor the flag. It now reads the house
way, still accepts `--env-file`, prints the path it looked for, and announces
which project it is auditing — so pointing it at production by accident is
visible rather than inferred. Once running, it reported zero locked-out
workspaces on both environments.

**The published-contract check could not say why staging had no fixture.** It
needs a thread that is public-listed, has an owner slug, and has a programme
that is active or completed. When nothing qualified it said only "publish one,
or run seed-ebbf.mjs" — so an environment holding draft threads read exactly
like one holding no threads, and the advice was wrong for both. It now lists
each candidate with the condition it failed. Staging's answer is
`single-event — programme is draft`.

It also no longer recommends `seed-ebbf.mjs` on staging. That script targets
the `default` workspace, which on staging is the Stripe payment-rehearsal rig
the integration suite marks load-bearing and tells you never to touch.

### Left for you, deliberately

**Staging's Stripe webhooks are registered wrong.** Thread, Meet and
Membership all take money on connected accounts, but all three endpoints
listen on the platform's own account. Meet's is also missing
`payment_intent.payment_failed`. The mode is fixed at creation, so each has to
be deleted and recreated, and the new signing secrets pushed to Fly. Doing the
first half without the second would leave staging payments worse off than they
are now, so they were left alone. This is why a staging payment rehearsal
would not confirm today.

**The published contract cannot be verified on staging at all**, because no
thread there qualifies. That is backwards for a staging-first workflow: a
contract break is currently only catchable against production, after it ships.
Moving one staging thread's programme to active would fix it. I did not,
because those threads belong to a real workspace and the choice is yours.

**No Stripe key in `apps/api/.env`**, so the production webhook check cannot
run from a shell. Production's Fly host has its own key; this is a local gap
only. Same shape as the missing SSO secret in `.env.staging` found on 09-09.

**Staging is accumulating fixture workspaces** — five `int-test-merge-*`, four
`retired-*`, plus the two permanent fixture workspaces. The append-only
activity log pins them, so they cannot simply be deleted. Worth a decision
about whether the merge tests should reuse one workspace.
