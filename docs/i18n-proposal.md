# i18n — making the whole system multilingual

_Drafted 2026-09-05 from Sjoerd's ask: make The Fibre multilingual, frontend
and backend. The Thread already did this for its public surfaces in July
(typed catalog, 5 languages, missing translation = type error) and that
pattern held up through ~30 releases — this doc proposes extending it
platform-wide rather than inventing anything new. The real content of this
proposal is **where the locale comes from** (four different answers for four
different situations) and **what NOT to translate** (admin UIs until a
paying non-EN workspace asks; API errors never, for now)._

## 1 · Where i18n stands today

**The Thread's public surface is done, and it's the house precedent.**
`apps/thread/lib/i18n.ts` (575 lines, ~73 keys × 5 locales:
en/nl/es/pt/de). The pattern, exactly:

```ts
export const LOCALES = ['en', 'nl', 'es', 'pt', 'de'] as const;
export type Locale = (typeof LOCALES)[number];
type Entry = Record<Locale, string>;
const CATALOG = { enrol: { en: 'Enrol', nl: 'Inschrijven', … }, … }
  satisfies Record<string, Entry>;
export type I18nKey = keyof typeof CATALOG;
export function t(locale, key: I18nKey, vars?): string  // {n} substitution
```

Three properties make it work:

1. **A key missing a translation fails `pnpm typecheck`** — `Entry` is
   `Record<Locale, string>`, so adding a key with only `en` is a type
   error, and adding a locale to `LOCALES` breaks every key until all are
   filled. The list stays complete *by construction*, not by discipline.
2. **The locale is content-side, not viewer-side**: `thread.language`
   column (migration `20260702160000`, CHECK on the 5 locales, default en).
   A Dutch thread speaks Dutch to everyone. Embeds accept `data-lang` →
   `?lang=` to override per placement; the `/my` portal speaks the language
   of the person's first enrolment's thread.
3. **The scope rule is written in the file header**: every string a
   *participant* can see lives in the catalog, in all five languages.
   Internal/admin UI stays English. 12 files consume it; ~87 `t()` calls
   on the public pages alone.

**Emails — half done:**

| File (`apps/api/src/lib/email/`) | State |
|---|---|
| `thread-templates.ts` | i18n ×5 — `EMAIL_I18N` per-locale copy tables, locale = `thread.language` |
| `membership-templates.ts` | **EN-only** — header comment already names the Thread catalog as "the pattern to adopt when a non-EN community shows up" |
| `auth-templates.ts` | EN-only (OTP, invite, reset — 8 templates) |
| `platform-templates.ts` | EN-only (workspace-approved email) |
| Certificate emails | EN-only (known open item in build-plan) |

**Everything else is English.** Fibre web, Meet, Flow, Pulse, Membership —
all admin UIs and Membership's *public* join page + embeds
(`apps/membership/app/[workspaceSlug]/`, `app/embed/`), which is the gap
that matters: it's a money surface, soul.com's front door, and it shipped
yesterday EN-hardcoded with no `data-lang`.

**What the DB already knows about language:**

- `person.preferred_language` — free-text since phase 0. Curator data about
  the person; never read by any renderer today.
- `thread.language` — the only column that actually drives rendering.
- `user_profile` (display_name/bio/photo/timezone) — **no locale**.
- `membership_member` — **no locale**.

## 2 · Proposed architecture

### 2.1 One shared i18n module

Move the mechanism (not the strings) into `@thefibre/shared` as a subpath
export `./i18n`, same as `./ui/date-field` et al.:

- `LOCALES`, `Locale`, `DEFAULT_LOCALE`, `LOCALE_LABELS`, `isLocale` —
  defined **once**. Today the locale list lives in three places (thread
  i18n.ts, the CHECK constraint, EMAIL_I18N keys); a sixth language should
  be one type edit that breaks every incomplete catalog in the monorepo.
- `type Entry = Record<Locale, string>`, `makeCatalog<T>()` helper that
  returns a typed `t()` bound to that catalog.
- **Catalogs stay per-surface, next to their consumers**:
  `apps/thread/lib/i18n.ts` (unchanged, re-exports types from shared),
  `apps/membership/lib/i18n.ts` (new), `apps/api/src/lib/email/*-i18n.ts`.
  One giant shared catalog would put Thread's "spots left" in Membership's
  bundle and make every string change a shared-package rebuild. The API
  imports from `@thefibre/shared` already? — it doesn't (server-only Hono);
  the shared module must therefore be dependency-free plain TS, which it
  is. If wiring shared→api proves annoying, the API gets a 20-line copy of
  the *types* only; catalogs are never duplicated.

### 2.2 Why not next-intl / react-intl

Honest comparison:

- **What they'd give us**: ICU MessageFormat (real plural rules, gender,
  nested selects), locale-segment routing (`/nl/...`), lazy per-locale
  message loading, extraction tooling, an ecosystem.
- **What they'd cost**: JSON message files with **no compile-time
  completeness check** (the property the house pattern exists for —
  runtime fallback hides holes exactly where we can't see them: a
  Portuguese participant's screen), a provider/context layer across six
  apps that are heavily React Server Components, locale routing we don't
  want (public URLs are `thread.thefibre.app/org/slug` — the *content* has
  a language, the URL doesn't), and a dependency in the money path.
- **What we genuinely lose by staying home-grown**: plural rules. `{n}
  spots left` works because the copy was written to dodge plurals; that
  dodge has held for 73 keys and will mostly keep holding for UI chrome,
  but it is a real constraint on copywriting. Also: no extraction tooling
  — finding untranslated hardcoded strings stays a grep-and-review job.

**Verdict: the typed catalog wins at this scale.** Five Western European
languages, no RTL, no CJK, short UI strings, compile-time completeness on
public money surfaces. Revisit only if plural-heavy copy, RTL, or >8
locales arrive — and if that day comes, the migration is mechanical because
keys and call sites already exist.

### 2.3 Where the locale comes from — four situations, four answers

This is the actual design decision. One "user language" setting is wrong
because most people who see our public surfaces have no account.

1. **Public pages & embeds** — *the content's language*, as today.
   `thread.language` stays. Membership gets the equivalent:
   `membership_settings.locale` (the join page is per-workspace, so the
   default is per-workspace) + `data-lang`/`?lang=` override on embeds,
   copied verbatim from Thread's embed pattern.
2. **Signed-in app UIs** (when/if translated, §3 P3) — *the user's
   preference*: a `fibre_locale` cookie via the existing `savePref`
   (domain `.thefibre.app`, one setting follows the user across all six
   apps — the "settings are per-user, not per-app" rule) **plus**
   `user_profile.locale` as the durable copy (cookies die; the profile
   row backfills the cookie at sign-in). `savePref`'s `ALLOWED` set gains
   one entry.
3. **Emails to participants/members** — *a locale stored on the
   relationship row at the moment it was created*: Thread already stamps
   effectively via `thread.language`; Membership adds
   `membership_member.locale`, captured from the join page's active locale
   at join time. This is the key move: **emails fire from schedulers with
   no session** — Accept-Language doesn't exist there, and
   `person.preferred_language` is free-text curator data (no CHECK, no
   enum — 'Nederlands', 'nl' and 'Dutch' are all valid values) that an
   organiser typed, not the language the person chose. The row the scheduler already holds must
   carry the answer. Fallback chain: row locale → workspace default → en.
4. **Auth & platform emails** — `user_profile.locale` where a user row
   exists; en otherwise. Accept-Language at sign-up as the initial guess,
   never as the ongoing source.

**Explicitly rejected**: Accept-Language as a primary source anywhere
(fine as a first-visit default on public pages when the content has no
language, i.e. almost never here), and translating based on
`person.preferred_language` (unvalidated free text; keep it as curator
data, optionally *seed* a member locale from it when it parses).

### 2.4 API and backend

- The API renders two locale-sensitive things: **emails** (covered above)
  and **API error strings** — which stay English (§3 P4).
- Public API responses that carry content (thread payloads) already carry
  `language`; additive per §6 of the app contract, nothing changes shape.
- Dates/amounts: keep the existing `Intl.NumberFormat`/`DateTimeFormat`
  calls but pass the surface locale instead of hardcoded `en-GB`/`en-IE`
  (membership-templates.ts line 11 and 22 are the current offenders).

## 3 · Phasing by value

Value lives where strangers' money and trust are. Admin UIs are read by
people who bought the product in English.

**P1 — public money surfaces** *(2–3 sessions)*
Membership join page + `joined` + embeds (tiers/button) through a typed
catalog (~40–60 keys, mostly writable by porting Thread vocabulary);
`membership_settings.locale` + `membership_member.locale` migrations;
`data-lang` on membership embeds; membership lifecycle emails ×5 (4
templates — welcome, renewal reminder, payment failed, lapsed); certificate
emails ×5 (closes the open build-plan item). Shared `./i18n` module
extracted first, Thread's file refactored to consume it (no string
changes, pure mechanism move — verify with `pnpm -r typecheck` +
`verify-external-app.mjs`).

**P2 — auth + platform emails, member portal** *(1–2 sessions)*
`user_profile.locale` column + Settings field + `fibre_locale` in
`savePref`'s allow-list; auth-templates ×5 (8 templates — OTP codes are
seen by every non-Google invitee, so this is closer to "public" than it
looks); platform-templates ×5. Thread's `/my` portal is **already
translated** — this phase adds nothing there.

**P3 — admin UIs** *(honestly: ~4–6 sessions per app, 20–30 total — do
not commit now)*
The scale, from file counts (web 111 tsx, thread 96, meet 74, pulse 58,
membership 53, flow 32) at a sampled ~10–20 user-facing strings per file:
roughly **1,000–2,000 strings per large app, 5,000+ platform-wide** —
versus 73 keys for Thread's entire public surface. That's the whole
argument in two numbers. Each app is independently translatable when a
paying non-EN workspace asks for *that app*; the shared module means the
mechanism is waiting. Sequence within an app: settings + empty states +
dialogs first (what a new non-EN user hits), tables/reports last.

**P4 — API error strings: recommend AGAINST, v1 and beyond-v1.**
Errors are read by developers (external apps, §6 contract — an error
string that changes per-locale is a semantic contract change waiting to
happen) and by us in logs. Public *forms* already translate their
user-facing failure copy client-side (Thread's `code_invalid`,
`code_send_failed` pattern: the API returns a code, the surface owns the
words). Extend that pattern instead: API returns stable English +
machine-readable code; the catalog on the surface translates.

## 4 · Translation workflow

- **Who writes NL/ES/PT/DE**: machine-draft (Claude, in the PR that adds
  the key — the existing catalogs were built this way), **human review
  before ship for money surfaces**: Sjoerd reads NL personally; ES/PT/DE
  get a native-speaker pass when one is available and ship machine-drafted
  with a `// MT` comment until then, burned down opportunistically. This
  is honest about the team size; the type system guarantees *presence*,
  review guarantees *quality*, and only presence can be automated.
- **How new strings stay enforced**: unchanged from Thread — a new key
  without all 5 locales doesn't typecheck; CI (`pnpm -r typecheck`) is the
  gate. No key ships half-translated, which also means **adding a key
  costs five strings** — a deliberate brake on catalog sprawl.
- **What's NOT enforced**: hardcoded English that never became a key. The
  guard is the file-header rule (every participant-visible string lives in
  the catalog) + review. Accept this; extraction tooling isn't worth it at
  this string count.
- **Content vs chrome**: tier names, thread titles, organiser notes are
  *content* — the workspace writes them in the language of its audience,
  the platform never translates them. i18n covers chrome only.

## 5 · Decisions — DECIDED (Sjoerd, 2026-09-05)

All five decided; D1 sharpened, D4 overridden:

- **D1 ACCEPTED + sharpened**: signed-in Fibre interface = ONE user-level
  language setting, app-wide. Public pages = content language. And the
  Thread refinement: `thread.language` conflated two functions — the
  FACILITATION language (information: what the course is run in, the
  organiser's) and the PAGE/system language (buttons, system messages,
  the platform's). They become two fields; content is the organiser's
  responsibility, chrome is ours.
- **D2 ACCEPTED** — matches how Sjoerd built it before: "a list of all
  the buttons and instructions, translated; add a language via code."
- **D3 ACCEPTED** — P1+P2 now, admin UIs on demand, API errors never.
- **D4 OVERRIDDEN — add FRENCH NOW** ("we're active in French-speaking
  areas"): LOCALES becomes en/nl/es/pt/de/fr; every existing catalog and
  email table gains FR (machine-drafted, marked for native review);
  thread.language CHECK widened in a fresh migration.
- **D5 ACCEPTED** — workspace default public language, per-content
  override keeps winning.

_Original recommendations kept below for the record._

### Original recommendations

- **D1 — Locale source**: the four-way split of §2.3 — content language
  for public surfaces, `savePref` cookie + `user_profile.locale` for
  signed-in UIs, a locale column stamped on the relationship row
  (`membership_member.locale`, thread's via `thread.language`) for emails,
  `user_profile.locale` for auth emails. **Recommended.** The
  one-alternative ("a single user language setting") fails on the fact
  that most readers have no account.
- **D2 — Library**: extend the house typed-catalog pattern via
  `@thefibre/shared` `./i18n`; no next-intl/react-intl. **Recommended**
  (trade-offs in §2.2 — we give up plural rules and extraction tooling,
  we keep compile-time completeness and zero dependencies in the money
  path).
- **D3 — Phases committed now**: **P1 + P2 only** (~3–5 sessions). P3
  per-app, demand-driven, never as one big push. P4 never (surface-side
  translation of error codes instead).
- **D4 — Languages**: keep en/nl/es/pt/de. FR is the notable absentee —
  add it when a workspace needs it; the cost is mechanical (one entry in
  `LOCALES`, typecheck lists every catalog to fill, one migration per
  CHECK constraint — note `thread.language`'s CHECK must be widened in a
  *fresh* migration, per the edited-migration gotcha). **Recommended:
  don't add languages speculatively; each key costs one string per
  language forever.**
- **D5 — Workspace default public language**: **yes** —
  `membership_settings.locale` is the workspace's public default for
  Membership, and per-thread `thread.language` stays and stays *winning*
  for Thread (a Dutch workspace can run an English-language thread; that
  granularity already exists and earned its keep). If more apps grow
  public surfaces, same rule: workspace default, per-content override.

## 6 · Effort summary

| Phase | Scope | Sessions |
|---|---|---|
| P1 | Shared module + Membership public + membership/certificate emails | 2–3 |
| P2 | Auth + platform emails, user_profile.locale, cookie | 1–2 |
| P3 | Admin UIs (per app, on demand) | 4–6 each, 20–30 all |
| P4 | API errors | 0 — not doing it |

Committed now: P1 + P2. Nothing in P1/P2 touches the published
`/api/v1/apps/*` shapes; the two new columns are additive migrations.
