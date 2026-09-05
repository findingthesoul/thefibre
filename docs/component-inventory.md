# Component duplication inventory — 2026-09-05

_Produced by a full six-app sweep (md5-grouped, then diffed) after Sjoerd's
"standard components everywhere" rule (CLAUDE.md → Components first;
build-plan 1g). Headline: **~8,000 duplicated lines, mostly byte-identical
copies**, not drift — the repo's own comments even instruct copying
(danger-confirm.tsx: "copy this file, don't reinvent it"). The Invoices
area was extracted the same evening (`@thefibre/shared/ui/invoices`);
this doc is the backlog for the rest._

## Extraction phases (work the order, one phase per session)

**Phase 1 — free wins, no injection (~1,000 lines):** field.tsx (web +
thread are byte-identical to shared/fields; fold meet's `disabled` option
in), theme-script (11L ×6 identical), button (±icon size), dialog (keep
the xl superset), switch, list, app-switcher (already prop-driven).

**Phase 2 — page chrome (~500 lines):** unify ui/page.tsx (web, meet,
thread, membership) + the two settings/page-chrome forks into one shared
page.tsx (`leading`, `actions`, `align` props); danger-confirm +
form-error + toast (pulse's, out of the cashflow folder) into shared.
_SHARED SIDE DONE 2026-09-05 (ui/page, ui/danger-confirm, ui/form-error,
ui/toast); pulse ported (toast). Other app ports pending._

**Phase 3 — the shell (injection pattern, ~2,300 lines):** move
prefs-shared into shared, then topbar (only a type import blocks it);
user-menu (±1,330 lines — inject onSavePref / onSwitchWorkspace /
onSignOut + settingsHref/showProfileItem for Flow); sidebar chrome as
`<SidebarShell nav brand mode version/>` with NAV staying per-app.
Resolve pulse's prefs fork first.
_SHARED SIDE DONE 2026-09-05 (./prefs, ui/user-menu, ui/sidebar-shell,
ui/topbar); pulse fully ported (prefs fork resolved: pulse keeps its
cashflow cookies beside a re-export). Other app ports pending._

**Phase 4 — route scaffolding:** createAuthCallback({dashboardPath})
(5 copies differ only by comment — WRONG on inspection: meet alone had
the verifyOtp arrival path + magic-link provider mapping, thread alone
the /my access-check bypass; the shared ./auth-callback factory built
2026-09-05 is the superset — port each app deliberately, web last), createAppLayout({appSlug, version}),
no-access + root layout ({appName} interpolation), embed trio
(namespace param — thread/membership already identical otherwise),
createInvoicePdfRoute({appId}, inject apiFetch), `<AppLanding/>` for the
five app landings.

**Do NOT extract yet:** settings/payments form (a real VAT feature gap
between the meet/thread and pulse/membership forks — reconcile the
feature first), settings/profile forms (genuinely different domains),
per-app NAV arrays, lib/api.

**Singles worth sharing before a second copy exists:** danger-confirm,
toast, form-error, tabs (web's), copy-link-button (meet's), a `<Badge>`
absorbing the 17 hand-rolled status pills, the three combobox
implementations (~650 lines; pulse's is the most general).

_Fixed on sweep day: the four sign-in screens (meet/flow/pulse/
membership) carried raw `bg-white`/`neutral-*` classes — broken in dark
mode; swapped to semantic tokens. Thread's sign-in also has i18n + `next`
threading the others lack — reconcile during Phase 4._

## Sweep round 2026-09-05 (SearchSelect adoption)

Converted: meet availability timezone (TextField → SearchSelect w/ hidden
name input), meet public booking ×3 timezone selects, thread embed
generator's thread picker. Shared gains: SearchSelect `name` prop;
profile-form timezone is now SearchSelect (div-wrapped, not label — a
label wrapping its button misdirects clicks).

Proposed SearchSelect enhancements (not built): async loadOptions (would
converge flow's AddContactDialog + web's person-combobox), label/hint
prop or SearchSelectField, drop-up collision handling. Remaining bespoke
comboboxes: web country-combobox, web person-combobox, pulse cashflow
combobox.
