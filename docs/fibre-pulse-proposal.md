# Fibre Pulse — business planner design proposal

_Drafted 2026-07-07 from Sjoerd's brief: a new Fibre app for cashflow
management and budgeting, based on contacts and offerings. Name chosen:
**Fibre Pulse** (cashflow as the heartbeat of the business). The worked
example is Sjoerd's real Soul Lab B.V. spreadsheet (`cashflow -
example.xlsx`, 7 tabs) — this doc translates what that sheet actually does
into Fibre primitives and names the conflicts before any code._

## 1 · What the spreadsheet does (inventory)

The workbook is the requirements document. Seven tabs, four jobs:

| Tab | Job | Pulse translation |
|---|---|---|
| `cashflow Soul Lab` | Fortnightly running-balance projection: `Bank(t+1) = Bank(t) − Costs + Income`. Income lines per client with owner initials (MK/DK/SL/OR) and a TRUE/FALSE include toggle. %-of-revenue reservations (Solidarity Fund 10%, Common Fund 15%, buffer 25%/10%). Bank section with earmarked sub-balances (BTW 17%, SF, savings). | The core: **commitments**, **reservation rules**, **accounts**, the projection chart |
| `costs Soul Lab` | Team pay per fortnight, payroll-tax reservation (incl. IB one-offs), ~20 recurring overhead lines with include toggles and default amounts, one-off lines, subcontractors (INKOOP: Tuana, Wendy, Marieke, Milan) | **Budget lines** (recurring) + **commitments out** (dated, per person) |
| `Budget 2025` | Annual budget: income categories with quarterly targets + % mix, target-vs-actual (`Werkelijk`), fund allocations, people costs from day-rate × availability × multiplier, per-client account planning (turnover / cost-of-turnover / margin / potential) | **Annual budget** with category targets; actuals from the ledger |
| `data` | Assumption constants (VAT 1.21, SF 0.1) + per-person monthly payroll math (gross/tax/net, NOW-era scenarios) | Constants → reservation rules (settings, none built in). Payroll math → **out of scope** (§3.3) |
| `Not paid income` | Deferred compensation owed to team members (paid 80%, owe the rest) | Commitments out with no date yet — an **obligations** list |
| `declaraties pp` | Expense claims per person per week (parking, travel, phone) | Out of scope v1; a budget line covers the aggregate |
| `Kosten salaris INT` | Historic NL↔INT intercompany notes | Not a feature |

**Beyond the sheet (Sjoerd, 2026-07-07):** the income side has *structures*
the flat rows hide — **incubators** (a project with collaborators, a few
leads), **HUBS** (a fixed collaborator group running multiple projects),
fundraising partners. And per organisation there are **multiple
simultaneous leads**, each with its own likelihood percentage and its own
expected moments in time, plus the real invoices actually sent. That
demands a probability-weighted pipeline and a group layer — and the group
layer already exists: **hubs and incubators are platform teams** (§2.1),
with Pulse projects running under them.

**What already exists on the platform that Pulse needs:**

- The **`purchase` ledger** (v0.13.93) — one row per money event, written by
  Meet + Thread. This is Pulse's *actuals* feed: a confirmed enrolment
  turns expected income into real income with zero typing.
- **Persons + organisations** — every income line in the sheet (Martijn
  Kersten, BGN, A+O fonds, Kidde, SSO, Zeevou) and every INKOOP line
  (subcontractors) is a contact. The counterparty column *is* the contact
  graph.
- **Workspace members + roles** — the sheet's owner initials (who lands
  this deal) map to `workspace_member`; role tiers gate money visibility.
- **The dialog contract, cursor pagination, RLS patterns** — Pulse is the
  5th in-family app and inherits all of it (Meet, Thread, Flow precedent:
  platform tables used natively, own schema for content).

## 2 · Proposed design

### 2.1 Primitives (pulse schema, app-owned)

```
pulse_account (
  id, workspace_id, name, kind        bank | reserve,
  parent_account_id,                  -- reserves nest under a bank account
  sort_order, archived_at
)
pulse_balance_snapshot (
  id, account_id, balance_cents, as_of_date, created_by
)                                     -- manual entry, append-only; latest
                                      -- snapshot anchors the projection

pulse_offering (
  id, workspace_id, name, category,   -- what you sell
  default_amount_cents, notes
)                                     -- v1 free-standing; later can point
                                      -- at a thread / meeting type (§3.6)

-- Hubs and incubators ARE platform teams (the in-family rule: use
-- person / team / workspace natively — no app-owned copy of the group
-- primitive). The fixed collaborator group = team membership, managed
-- where teams are already managed. Purchases already carry team_id, so
-- actuals roll up per hub for free.

pulse_involved_team (
  id, workspace_id, team_id, added_at
)                                     -- Settings: which workspace teams take
                                      -- part in the planner (act as hub /
                                      -- incubator). Teams themselves are
                                      -- created + membered at platform level;
                                      -- Pulse only flags involvement.

pulse_project (
  id, workspace_id,
  team_id,                            -- nullable: the hub/incubator (an
                                      -- involved team) this project runs under
  name, notes, archived_at
)                                     -- a HUB = a team with several projects;
                                      -- an incubator = a team with one project
                                      -- and a few leads. Same shape — the
                                      -- difference is usage, not an enum.

pulse_stage (                         -- the pipeline IS a flow (Sjoerd,
  id, workspace_id,                   -- 2026-07-08). Pulse activation seeds
  key, label,                         -- the default sales flow: Lead →
  kind                                open | committed | won | lost,
                                      -- projection semantics: open = weighted
                                      -- by probability, committed = 100%,
                                      -- won = done, lost = excluded
  sort_order,
  is_system                           -- the seeded flow cannot be deleted
)                                     -- (RLS-enforced); custom stages can be
                                      -- added/renamed/reordered around it

pulse_commitment (                    -- an opportunity: from vague lead to firm deal
  id, workspace_id, direction         in | out,
  person_id, organisation_id,         -- the counterparty (platform contact)
  team_id,                            -- nullable: the hub/incubator it belongs
                                      -- to (mirrors purchase.team_id — same
                                      -- Me/Team/Workspace scoping as Invoices)
  project_id,                         -- nullable: the specific project under it
  offering_id,                        -- nullable
  label,
  owner_user_id,                      -- whose deal this is: picked from
                                      -- workspace members (the sheet's
                                      -- MK/DK/SL/OR initials, never free text)
  stage,                              -- key into pulse_stage (workspace flow)
  probability,                        -- 0–100 %: weights the projection.
                                      -- committed+ implies 100
  notes, created_at, soft-delete
)                                     -- a counterparty holds MANY of these at
                                      -- once: a running engagement + several leads
pulse_commitment_line (
  id, commitment_id, expected_date, amount_cents,
  invoice_ref, invoiced_at,           -- the REAL sent invoice (Moneybird no. /
                                      -- Stripe id) once one exists
  purchase_id,                        -- nullable: linked ledger row = became actual
  settled_at
)                                     -- one commitment, many expected payments
                                      -- (BGN pays ~€1.7k every 4 weeks: 7 lines)

pulse_budget_line (
  id, workspace_id, label, category, direction  in | out,
  amount_cents, cadence               weekly | fortnightly | monthly | quarterly | yearly,
  starts_on, ends_on, included        boolean,  -- the include toggle
  owner_user_id                       -- nullable (telefoonvergoeding — Sjoerd)
)                                     -- recurring lines expand into virtual
                                      -- dated lines at projection time

pulse_reservation_rule (
  id, workspace_id, label,            -- user-defined: "Solidarity Fund",
                                      -- "VAT reserve", "Buffer" — NONE built in
  percentage, basis                   revenue | net_revenue,
  target_account_id,                  -- the reserve bucket it feeds
  included boolean, sort_order
)                                     -- VAT is just one of these: an average-
                                      -- savings %, not a special-cased concept

pulse_budget (
  id, workspace_id, year, label
)
pulse_budget_target (
  id, budget_id, category, direction, quarter, amount_cents
)                                     -- targets; actuals are computed from
                                      -- purchase ledger + settled lines

pulse_settings (
  workspace_id (pk),                  -- one row per workspace
  currency,                           -- ISO 4217, default 'EUR' (§2.7)
  default_granularity                 week | fortnight | month,
  period_anchor_date,                 -- fortnights count from here (the
                                      -- sheet's 05/06 payroll rhythm)
  fiscal_year_start_month,            -- default 1
  horizon_months                      -- how far the projection renders
)                                     -- everything domain-specific lives here
                                      -- or in the rules — nothing in code
```

Accounts additionally carry `sync_mode manual | auto` + `provider_ref`
(nullable) so the manual-vs-bank-feed choice is per account (§2.7).

RLS: workspace + `app_membership` scoping as always, plus role-gating
(§2.4). All writes via the API with `X-App-ID: pulse`.

### 2.2 The projection (the headline view)

One chart, front and centre: the running balance line from today forward.

- **Anchor:** latest balance snapshots, summed (available = bank minus
  reserves, both shown).
- **Layers:** the **committed** line (solid — stage committed+, invoiced,
  actuals), the **expected** line (dashed — every open opportunity
  weighted by its probability: a €40k lead at 30% adds €12k), and
  optionally the **best case** (dotted — everything at 100%). The sheet's
  TRUE/FALSE toggle becomes a probability the chart weights continuously,
  instead of a cell you flip to see the other world.
- **Granularity:** lines are dated, so the view renders at week /
  fortnight / month — a picker, not a schema decision. (The sheet's
  fortnight is just Soul Lab's payroll rhythm.)
- **The answer on top:** "You dip below zero on 14 Aug" / "Runway: 9
  weeks committed, 16 weeks with potential." That sentence is the product.
- Reservation rules compute reserve build-up per period (the sheet's
  SF/CF/BTW rows) and reduce *available* cash accordingly.

### 2.3 The surfaces

- **Pulse** (home) — the projection chart + the answer + biggest upcoming
  in/out items.
- **Pipeline** — all opportunities, grouped by counterparty or by
  project, filtered by owner / stage / direction; row = contact chip +
  offering + schedule + stage + probability (inline-editable); drag a
  line's date to re-plan. Detail dialog per the Fibre dialog contract.
- **Counterparty view** — one organisation or person, everything at
  once: opportunity lines laid out in time, real invoices sent (ref +
  date) and paid, weighted pipeline total. This is also Pulse's **per-app
  profile tab** (brief §2): open Kidde in Fibre Contacts and the Pulse
  tab shows the money relationship, emergently.
- **Teams & projects** — hubs and incubators are ordinary Fibre teams
  (collaborators = team members, managed where teams already are); Pulse
  adds the money lens on top: the projects running under a team, each
  project's pipeline and actuals rolled up. An incubator with a few
  leads and a hub with three running projects read the same way — a team
  with money moving through it. The scope switcher is the same
  Me / Team / Workspace as the Invoices area.
- **Budget** — recurring lines (the costs tab) with include toggles
  (Fibre toggle switches, v0.13.111 style) + the annual targets grid with
  actuals-vs-target fill from the ledger.
- **Accounts** — balances + "update balances" flow (a 60-second Monday
  ritual, like today), reserve buckets with computed target vs actual.
- **Settings** — the assumptions layer (§2.7).

### 2.4 Roles and visibility

Money is the most sensitive surface in the workspace. Proposal:

| | Super Admin | Admin | Organiser |
|---|---|---|---|
| Projection, accounts, budget | ✓ | ✓ | — |
| Commitments: all | ✓ | ✓ | — |
| Commitments: own (`owner_user_id = me`) | ✓ | ✓ | ✓ |

An organiser sees and maintains their own pipeline (their deals feed the
forecast) without seeing salaries or the bank position. This reuses the
`workspace_role` tiers from the invoices work — no new role machinery.

### 2.5 Curator fields Pulse justifies (brief §5)

Per "the app justifies the field", Pulse earns exactly two fields on the
shared person/org rows: **payment terms (days)** and **default owner**.
Day rates, margins and account-planning notes stay in Pulse's own schema
(they describe the *deal*, not the person). Nothing else.

### 2.6 The ledger loop (actuals for free)

When a `purchase` row lands (Thread enrolment, Meet booking), Pulse shows
it in the projection's past periods automatically. Matching to a
commitment line is **manual in v1** (a "link" action on the line;
auto-suggest by counterparty + amount + period later). Settled lines stop
counting as expected; the past of the chart becomes fact, the future stays
plan. Income that never touches Fibre (a bank transfer from A+O fonds) is
settled by hand — same click.

A line moves through three truth-levels: **expected** (a date and an
amount) → **invoiced** (a real invoice went out: `invoice_ref` +
`invoiced_at`, hand-entered for Moneybird invoices, auto-filled when the
purchase ledger already has the Stripe invoice) → **settled** (money
arrived). The chart can treat invoiced-but-unpaid as committed with a
receivable marker — which is exactly the "real sent invoices" layer the
spreadsheet never had.

### 2.7 Settings (the assumptions layer)

The spreadsheet's `data` tab holds the constants (VAT 1.21, SF 0.1) and
the whole workbook silently assumes a rhythm (fortnights from 05/06) and
a currency (EUR). Pulse makes these explicit — one Settings surface,
admin+ only.

The governing principle, per Sjoerd: **Pulse hardcodes nothing
domain-specific.** Soul Lab's fortnight rhythm, its funds, its VAT
percentage, its categories — all of it is one workspace's configuration,
written by the importer (P6), editable here. And people are never
initials or free text: owners and collaborators are always picked from
workspace members.

- **Time rhythm** — default granularity (week / fortnight / month), the
  **anchor date** fortnights count from (Soul Lab's payroll rhythm; other
  workspaces will anchor differently), fiscal year start, and projection
  horizon. All display-layer: lines stay dated, so changing the rhythm
  re-renders, never migrates data.
- **Bank account system** — manage accounts + reserve buckets, and per
  account a **sync mode**: `manual` (balance snapshots, v1) or `auto`
  (bank feed). Auto ships later via a PSD2 aggregator (GoCardless Bank
  Account Data or similar — EU data residency required, brief §6), but
  the setting, the `sync_mode` column and the append-only snapshot table
  mean auto-read slots in without a schema change: a feed is just a
  machine writing snapshots (and, later, transactions).
- **Currency** — workspace default (EUR), used for all amounts and
  formatting. v1 is single-currency; `currency` sits on `pulse_settings`
  rather than being hardcoded so multi-currency commitments (a USD
  client) can arrive later as a per-commitment override + conversion at
  projection time. Parked until real need (§3.10).
- **Teams involved** — pick which workspace teams take part in the
  planner (the hubs and incubators). Teams are created and membered at
  platform level as always; Pulse only selects the involved ones, and
  team pickers on projects/opportunities offer exactly this set. Not
  every team in the workspace is a money structure.
- **Reservations** — fully user-defined percentage rules: label, %,
  basis, target bucket, include toggle. Solidarity Fund 10%, Common Fund
  15%, buffer, payroll-tax reservation — and **VAT is one of them**: an
  average-savings percentage feeding a "VAT reserve" bucket, not a
  special-cased tax concept (§3.8). Pulse ships with zero built-in
  reservation types.
- **Categories** — for commitments + budget lines (the sheet's
  ACCOMPANIMENT / INTERNAL / INKOOP groupings), editable list.

## 3 · Conflicts with the current design (the honest list)

1. **The data wall.** Pulse reads the purchase ledger across the wall.
   Already sanctioned — the ledger is the second crossing (invoices
   proposal D1, accepted). Pulse adds **no new crossing**: its content is
   app-owned, counterparties are ordinary platform contacts.
2. **Payroll is not planning.** The sheet's `data` tab does real payroll
   accounting (loonheffing per person, NOW percentages, IB). Rebuilding
   Moneybird is a tarpit. _Resolution:_ team pay = budget lines +
   commitments out (amounts and dates); the tax *math* stays in
   Moneybird/the accountant. The payroll-tax reservation survives as an
   reservation rule or dated out-lines — the cashflow effect without the
   accounting.
3. **Offerings vs the Thread/Meet catalogue.** Thread tickets and Meet
   meeting types are already priced offerings. Duplicating the catalogue
   violates SPoT. _Resolution:_ v1 offerings are free-standing (the
   sheet's income is mostly consulting, which lives in no app); a later
   phase lets an offering reference a thread/meeting type so its pipeline
   and actuals wire up automatically.
4. **Overlap with the Invoices area.** Both show money. _Distinction:_
   Invoices = the transactional record of what happened (receipts,
   refunds, resend). Pulse = the forward view (what will happen). Pulse
   links to invoices, never re-implements them.
5. **Counterparties that aren't contacts yet.** "A+O fonds" may not exist
   as an organisation. Creating contacts from Pulse is correct behaviour
   (same as Meet/Thread creating persons at enrolment) — and quietly
   makes the CRM more complete.
6. **Bank integration.** PSD2/bank-API sync is out of scope for v1;
   manual balance snapshots are the anchor, exactly like the sheet today.
   The per-account `sync_mode` setting + append-only snapshot table
   (§2.7) mean a feed later is additive, not a migration. Aggregator
   choice must respect EU data residency (brief §6).
7. **Multi-entity.** The workbook hints at two entities (Soul Lab NL /
   INT). Pulse v1 is one workspace = one entity. A second entity = a
   second workspace (matches the platform model).
8. **VAT.** The sheet reserves ~17% for BTW as a rule of thumb. Pulse
   deliberately does NOT special-case VAT: it is an average-savings
   percentage — one more user-defined reservation rule feeding a reserve
   bucket. Real VAT accounting stays in Moneybird. Purchase ledger
   amounts are gross; noted as a known imprecision, same as today.
9. **Scenario model kept deliberately small.** The sheet has one boolean
   per line; Pulse has a stage + probability per opportunity and three
   lines on the chart. Named scenario *sets* ("with Kidde EMEA, without
   SSO") are parked until the probability-weighted view proves
   insufficient.
10. **Multi-currency.** v1 is single-currency (workspace setting, EUR
    default). Amounts store no per-row currency yet; adding a
    per-commitment currency + conversion at projection time is a
    contained later change because all rendering already flows through
    the settings currency. Parked until a real non-EUR client exists.
11. **Pipeline is Fibre Sales territory.** Leads, stages and
    probabilities are classically a sales app's job, and Fibre Sales is
    on the roadmap (unbuilt). _Resolution:_ Pulse's pipeline is
    deliberately **finance-shaped** — an opportunity here is amounts on
    dates with a likelihood, nothing more. No email threads, tasks,
    funnel analytics or outreach workflow. If Fibre Sales is ever built
    it owns the *relationship workflow* and Pulse reads its deals as
    another expected-money source (the same pattern as reading the
    purchase ledger). Until then, Pulse's lean pipeline is the only one,
    and it must stay lean enough not to pre-empt Sales.
12. **The pipeline IS a Fibre Flow** (Sjoerd, 2026-07-08, confirming
    after an initial Pulse-owned implementation): the flow app is where
    flows are built — the sales pipeline included. Pulse activation
    seeds a real `flow_definition` "Pipeline" (system_key =
    'pulse_pipeline', undeletable while Pulse is active — API-guarded),
    authored/edited in Flow's visual builder. Pulse consumes it
    **read-only at the definition level**: `pulse_stage` is the mirror
    of the current version's steps (labels + order from Flow; terminal
    steps map end_positive→won, end_negative→lost) plus Pulse's
    money-semantics overlay (`kind` for non-terminal steps: weighted vs
    committed). This is the **third sanctioned wall crossing** (after
    activity and the purchase ledger): flow definitions are a
    consumable capability — in-family apps may read them via the API;
    Flow owns authoring. In Pulse the surface is called **Cashflow** —
    "pipeline" is Flow's word.
    **Phase 2 (runtime) SHIPPED 2026-07-08** (Sjoerd: "when opportunities
    are in the pipeline they should of course also be visible in FLOW"):
    flow_run gained external subjects (person_id nullable,
    subject_label, organisation_id, source_app/source_ref — unique per
    flow). Every Pulse opportunity mirrors to a run on the Pipeline flow
    (created/moved/closed from pulse routes via syncOpportunityRuns;
    idempotent backfill on the stages sync). The bridge is TWO-WAY:
    transitioning a mirrored run in Flow updates the commitment's stage
    (+ forced probability for committed/won kinds). Flow UI renders
    person-less runs via subject_label/organisation with a "Pulse"
    source chip. Gate tasks influencing stage changes remain future
    work — transitions from Flow already respect the flow's gates.

## 4 · Build plan (phased)

1. **P1 — Schema + API:** pulse schema (tables above), RLS + role gates,
   `/api/v1/pulse/*` routes, app registration + sidebar entry.
2. **P2 — Pipeline + budget UI:** opportunities (stage, probability,
   lines), projects under teams (hubs/incubators), the counterparty
   view, budget lines; contact + team pickers, dialog contract.
3. **P3 — Projection:** accounts + snapshots, the Settings surface
   (rhythm, currency, reservation rules, categories), the chart with
   committed/potential lines and the runway sentence.
4. **P4 — Ledger loop:** purchase rows in past periods, manual link +
   settle, done-state on commitments.
5. **P5 — Annual budget:** targets grid, actuals-vs-target, category mix.
6. **P6 — Seed/import:** a script that imports *this workbook* (income
   lines → commitments with counterparty matching, costs tab → budget
   lines, reservation percentages (incl. VAT) → rules, bank section → accounts). Pulse
   launches with Soul Lab's real forecast on screen, day one.

Pulse gets its own user-facing version (`Pulse v1.x`) like Meet, at
`pulse.thefibre.app`, monorepo cadence for the platform work.

## 5 · Decisions for Sjoerd

- **D1 — Role gating (§2.4):** projection/accounts/budget admin+ only,
  organisers see own commitments? (recommended: yes)
- **D2 — Payroll scope (§3.2):** pay as budget lines + out-commitments,
  no tax math in Pulse? (recommended: yes)
- **D3 — Granularity (§2.2):** store dated lines, render week/fortnight/
  month via a view picker? (recommended: yes)
- **D4 — Import (§P6):** build the workbook importer as the seed, so v1
  starts with real data? (recommended: yes — same lesson as the EBBF
  seed: filled containers beat empty ones)
