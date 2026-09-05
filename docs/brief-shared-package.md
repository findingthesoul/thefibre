# Brief — `@thefibre/shared`

_The one package every app depends on. Written 2026-09-05, the day the
"components first" rule became binding (CLAUDE.md). Short on purpose._

## 1 · What it is

The single home for everything that must be **identical across the six
apps**: UI components, the branding/app registry, the country list, the
i18n mechanism. One implementation, called everywhere — because per-app
copies drift, and drift reads as untrustworthiness (Sjoerd, 2026-09-05:
"every setting page, profile page, invoice screen… should look the same
and work the same way").

It compiles to `dist/` (`pnpm --filter @thefibre/shared build`); apps
consume it via subpath exports (`@thefibre/shared/ui/dialog`). Both are
wired through the pnpm topological filter (`--filter @thefibre/web...`)
— never hand-chain builds.

## 2 · What lives here today

**Root exports** (`@thefibre/shared`): `APP_IDS`/`AppId`, the `APPS`
branding registry (names, taglines, URLs — a rename is a one-file
change), `appUrl(slug, env)` — **the only sanctioned way to link between
apps** (raw `APPS[slug].url` and the catalogue's `base_url` are
production defaults and leaked staging users to prod), `ENTITY`,
email/footers helpers.

**`./ui/*`** — the component library:

| Export | What |
|---|---|
| `button`, `dialog`, `switch`, `list`, `fields`, `theme-script`, `app-switcher` | The base kit (extraction phase 1) — apps hold 4-line shims |
| `date-field` | THE date picker (never `<input type="date">`) |
| `search-select` | THE list-with-search-field (thread pickers, countries; timezone adoption queued) |
| `settings` | The canonical settings hub — "same four sections, same order, same words" |
| `invoices`, `invoice-dialog` | THE invoices area + viewer (server actions injected) |
| `profile-form`, `photo-field` | The one profile editor (The Fibre hosts it; apps show read-only echoes) |
| `currency-editor` | Workspace currency SPoT editor (save injected) |
| `help` | The per-app help page frame |

**`./countries`** — ISO 3166-1 list. **`./i18n`** — the locale mechanism
(LOCALES incl. fr, typed catalogs; being built out by the i18n P1
session — catalogs themselves stay per-surface next to their consumers).

## 3 · The rules

1. **Components first.** Before building any UI surface, look here and
   in the other five apps. Extend or extract — never fork a per-app
   variant. New recurring surfaces are BORN here.
2. **No app imports, ever.** The package cannot import `@/lib/api`,
   supabase, or server actions. App-bound behaviour is INJECTED:
   server-action objects as props (`ui/invoices`), save callbacks
   (`currency-editor`), or `create*(Link)` factories for `next/link`
   (the package deliberately has no Next dependency).
3. **Shims keep paths stable.** An extracted component leaves a 4-line
   re-export shim at its old app path, so no page changes. Edit the
   shared copy; the shims are not code.
4. **Every new file needs an `exports` entry** in package.json (copy an
   existing entry's shape) and must survive `pnpm --filter
   @thefibre/shared build` — `'use client'` directives carry into dist.
5. **Superset on merge.** When copies disagree during extraction, take
   the strict superset (the `xl` dialog, the `icon` button size) and let
   Thread lead on design questions.
6. **Watch `exactOptionalPropertyTypes`** — shared compiles stricter
   than the apps; optional props often need `| undefined`.

## 4 · What does NOT belong

Per-app NAV arrays, `lib/api.ts`, anything with a session or an app id
baked in, app-specific domain forms (Meet's availability, Thread's
timeline), and — for now — the two payments-form forks (a real VAT
feature gap; reconcile the feature before extracting).

## 5 · Roadmap

Extraction phases 2–4 (docs/component-inventory.md): page chrome →
the shell (sidebar/topbar/user-menu via injected actions) → route
factories (auth callback, app layout, landings, embeds). Plus, at its
SECOND use: the pricing rule-row builder becomes `ui/logic-rules` —
the generic "logic box" (conditions → injected consequence).
