# Brand design — the instruction for every interface

*Written 2026-09-14 at Sjoerd's request: "make a brand design document as
instruction for the interface. Like always when you build something, you use
those rules. Ideally you make one reference per item and reuse that, so that
changes are simple, and app-wide implemented. Think about the old fashioned
object oriented programming."*

This is the rulebook for how The Thread, The Fibre, Meet, Members, Flow, Pulse,
Connections, Business Models and the portal look. **Read it before building any screen.** If
this document and the code disagree, the code in `packages/shared` is what
ships — fix whichever is wrong in the same commit.

---

## 1. The idea in one paragraph

Every visible thing is defined **once** and used everywhere, the way a class is
defined once and instantiated many times. A colour is a *token*. A look that
recurs is a *recipe*. A thing with behaviour is a *component*. An app never
writes a colour, a border or a field size of its own: it asks for the token,
recipe or component by name. Change the definition and every app changes on
its next build, with nobody editing nine files and hoping.

This replaced a real mess. Until 2026-09-14 the palette was copied into nine
`tailwind.config` files and nine `globals.css` files and had drifted into two
palettes and four values for the same colour; the error box was written out by
hand 54 times, the card 103 times, red error text 160 times; and the field size
moved twice in one day because a text field and a date field were separate
definitions of "a field".

## 2. The four layers

| Layer | What it is | Where it lives | You use it as |
|---|---|---|---|
| **Tokens** | A named ROLE with a value in light and dark | `packages/shared/src/design/tokens.ts` | a Tailwind colour: `bg-surface-raised`, `text-ink-subtle`, `bg-save` |
| **Preset** | Hands the tokens to Tailwind and writes the CSS variables | `packages/shared/src/design/tailwind-preset.ts` | `presets: [fibrePreset]` in each app's `tailwind.config.ts` — nothing else |
| **Components** | Things with behaviour | `packages/shared/src/ui/*.tsx` | `<Button>`, `<TextField>`, `<Dialog>` |
| **Recipes** | Things that are only a look | `packages/shared/src/ui/recipes.ts` | `className={CARD}`, `NOTICE.warning`, `PILL_TONE.positive` |

**The rule that follows:** if you are about to type a hex value, a Tailwind
colour like `bg-yellow-400` or `text-gray-700`, a border, or a field height —
stop. Use the token, recipe or component. If none fits and you are about to
write the same thing a second time, **add it to the shared layer first** and use
it from there.

## 3. Colour — roles, not colours

Tokens are named for what they DO, never for what colour they are. `ink-subtle`
means "secondary text", not "grey-700". `save` means "this commits your work",
not "yellow". So the palette can change without a call site moving, and a call
site reads without knowing the palette.

| Token | Role | Use for |
|---|---|---|
| `surface` | the page ground | page backgrounds |
| `surface-sunken` | the ground behind things | sidebars, insets, empty states, quiet tiles |
| `surface-raised` | the ground of things | cards, dialogs, menus, fields |
| `ink` | primary text | body text, headings, the default primary button |
| `ink-subtle` | secondary text | labels, descriptions |
| `ink-muted` | tertiary text | placeholders, meta, timestamps |
| `ink-inverse` | text on an ink ground | the default primary button's label, chosen chips |
| `line` | edges | borders, dividers |
| `line-strong` | active edges | hover and focus borders |
| `save` | **committing** | Save buttons, switches that are on |

**Yellow means saving.** It is the colour of committing something and nothing
else: a Save button, and a switch that is on. Do not use it for decoration,
highlights or links, or it stops meaning anything. (Sjoerd, 2026-09-14: "for
SAVE when SAVE is an option or needed: Yellow/Orange please.")

**Status colours** — green, amber, red, sky — are not tokens. They are used only
inside the recipes `NOTICE` and `PILL_TONE`, which name them by meaning
(`positive`, `attention`, `negative`, `done`, `neutral`). Pick the tone by what
the state means, and the colour follows.

**Dark mode** is automatic: every token has a dark value, and the app's theme
toggle sets `.dark`. If you use tokens and recipes you never write a `dark:`
class yourself.

## 4. Type

- The font is the system UI stack (`ui-sans-serif, system-ui, -apple-system,
  Inter`). No web fonts in the product apps. The marketing site has its own
  handwritten wordmark.
- **Body and fields: `text-sm`** (14px).
- **Meta and pills: `text-xs`** or `text-[11px]`.
- **Section labels: the `SectionLabel` component** (10px uppercase, tracked,
  `ink-muted`). Never write the classes.
- **Page titles: `PageHeader`** (`text-2xl font-medium tracking-tight`).
- **Dialog titles: `Dialog`'s `title`** (`text-base font-medium`).
- Weight: `font-medium` for emphasis. Bold (`font-semibold`) belongs to the
  marketing site and to the public theme headlines, not to admin screens.
- Numbers that line up in columns get `tabular-nums`.

## 5. Size, space and shape

- **Every field is one box: `FIELD_BOX`** — `h-[38px] px-3 text-sm`, in
  `ui/fields.tsx`. TextField, SelectField, FieldSelect, DateField,
  DateTimeField and raw inputs using `FIELD_INPUT_CLASS` all share it. It is a
  fixed height, not padding, because Safari draws a native select at its own
  height. Change the field size by changing `FIELD_BOX` **and** the two date
  triggers in `ui/date-field.tsx` in the same commit. (Sjoerd chose this box on
  2026-09-14, after the fields had been made larger and he found The Thread's
  dialogs "terrible" for it.)
- **Buttons:** `Button` sizes `sm` (h-8), `md` (h-9), `icon` (h-9 square).
- **Radius:** `rounded-md` for fields and buttons, `rounded-lg` for cards and
  dialogs, `rounded-full` for pills, chips and avatars.
- **Spacing:** Tailwind's scale. Inside a card `p-4`/`p-5`; between form
  fields `space-y-4`–`space-y-6`; between page sections `mt-8`–`mt-12`.
  **Recipes and components never carry outer margins** — where a thing sits is
  the caller's decision; what it looks like is not.

## 6. The catalogue — use this, for that

### Components (`packages/shared/src/ui`)

| You need | Use |
|---|---|
| A page's frame, title, back link | `PageContainer`, `PageHeader`, `Breadcrumb` |
| A page that uses the whole window (columns, boards) | `PageContainer max="full"` |
| A section label | `SectionLabel` |
| "Nothing here yet" | `EmptyState` |
| A button | `Button` — `primary`, `secondary`, `ghost`, `danger`, **`save`** |
| A labelled text input / select / textarea | `TextField`, `SelectField`, `TextAreaField` |
| A select without a label (filter bar) | `FieldSelect` (`inline` to size to content) |
| A date / date and time | `DateField`, `DateTimeField` — **never** `<input type="date">` |
| An on/off setting | `SwitchField` (`Switch` for the bare control) |
| A searchable picker | `SearchSelect` |
| A popup with a form | `Dialog` — footer: Delete · Duplicate left, Cancel · Save right |
| Sections of one screen or dialog | `Tabs` — keep panels mounted and hidden, so one Save sends every field |
| Views that live in the URL (shareable, work before JS) | `Tabs` with `href` on each item and `link={Link}` — from a client module, since a server page cannot pass `Link` as a prop |
| "Are you sure?" | `ConfirmDialog`; destructive: `DangerConfirmDialog` |
| An error line in a dialog footer | `FormError` |
| A small ⓘ explanation | `InfoHint` |
| A list of rows | `ListGroup` + the app's `ListRow` |
| Rich text display | `RichText` |
| A photo | `PhotoField` |
| An assistant conversation with an approve/decline card | `AssistantPanel` (`ui/assistant`) — the app supplies `send` and translated `labels` |

**Buttons, precisely.** A primary button that submits a form is automatically
`save` — yellow — so nobody has to remember. Primary buttons that do not save
(Check people in, Issue certificate) stay ink. A save that is not a form submit
(Connections' Done on an autosaving note) says `variant="save"` explicitly.
Ordering lists is drag-and-drop, never a number field.

### Recipes (`packages/shared/src/ui/recipes.ts`)

| You need | Use |
|---|---|
| A raised card or panel | `CARD` (+ your padding) |
| A quiet sunken tile | `INSET` |
| Error text beside a field | `ERROR_TEXT` (or `FormError` with an icon) |
| A boxed message | `NOTICE.error` · `.warning` · `.success` · `.info` |
| A status label | `PILL` + `PILL_TONE.positive` · `.attention` · `.done` · `.neutral` · `.negative` |
| A filter chip | `CHIP` + `CHIP_STATE.on` / `.off` |
| A raw single-line input that can't be a TextField | `FIELD_INPUT_CLASS` (from `ui/fields`) |
| A raw textarea | `FIELD_CLASS` (from `ui/fields`) |
| A label above a raw control | `FIELD_LABEL_CLASS` (from `ui/fields`) |

**Choosing a notice tone:** *error* — it failed; *warning* — it worked, but read
this first (the "your public agenda is off" box); *success* — it worked and
they might not otherwise know; *info* — context.

## 7. How to change something

- **A colour everywhere:** edit the value in `design/tokens.ts`. Done.
- **A new colour role:** add it to `TOKEN_NAMES`, give it a LIGHT and DARK
  value, add it to the preset's `colors`. Name the role, not the colour.
- **A recurring look:** add a recipe to `ui/recipes.ts`, then replace the
  hand-written copies with it.
- **A component's look:** edit the component. If a look is shared between a
  component and raw markup, it belongs in a recipe or an exported constant that
  both read — that is how `FIELD_BOX` works.
- **Never** add `colors` to an app's `tailwind.config.ts` or a colour variable
  to an app's `globals.css`. `packages/shared/src/design/tokens.test.ts` fails
  the release if you do.

## 8. Known exceptions — deliberate, and each is a decision

1. **Connections, Flow and Pulse use a cool slate ground in light mode** instead
   of the warm neutral one: a greyer canvas, bluer ink and lines. It predates
   this document. Each keeps one override block in its `globals.css`, light
   mode only, and the guard test allows exactly that. **Unifying the two
   palettes is Sjoerd's call**; if he makes it, delete those three blocks.
2. **The marketing site (`apps/website`)** has its own light-only brand
   language — the handwritten wordmark, the painted shapes, the fallen thread —
   and does not use the preset.
3. **Public Thread pages** wear the workspace's chosen site theme
   (`apps/thread/app/[organiserSlug]/themes.tsx`), which may use its own
   headline scale and full-bleed images. They still use the tokens.

## 9. Where the code is today

The foundation is in: tokens, preset, recipes, and the shared components read
from them. All eight product apps build from the preset with no colour values of
their own, and the compiled colour values were verified identical to before in
every app, in light and dark.

**Not yet done:** the hand-written copies inside the apps — the 54 error boxes,
103 cards, 160 error texts, the status pills and filter chips — still exist and
still look right, but they are not yet instances of the recipes. They are to be
converted app by app, starting with The Thread (design-leading), each app one
release, so a visual change can be traced to one app. Until an app is
converted, a recipe change does not reach its copies.
