# thethread.app website rewrite — marketing plan

**Status:** proposal, 2026-09-07
**Scope:** content, positioning, structure, visual direction for the public site at the
`thethread.app` apex. Deliberately *not* a technical spec.
**Companion docs:** `docs/naming-brief.md` (binding), `docs/pricing-proposal.md` (the numbers),
`docs/build-plan.md` item on Thread V3 decommission (the apex landing must keep serving until
this rework ships).

---

## 1. Why rewrite

The current site is beautiful and the writing is genuinely good — and it describes a product
that no longer exists.

What's wrong, concretely:

- **It sells the old standalone Thread V3.** "All-in-One Learning Programme Platform" is the
  old positioning. Thread today is the flagship of a family — the journey people walk — with
  Meet, Flow, Pulse and Membership working in its service, all living on `*.thethread.app`.
- **The pricing is wrong twice.** The site shows Free / €39 / €119 / €319 seat-based annual
  tiers; the features page contradicts it with "free to €199/month" in its own footer. The
  decided scheme (pricing-proposal.md, live in the product) is **Free / Starter €19 / Pro €49 /
  Enterprise talk-to-us, per workspace**, with the enrolment-fee ladder (2% → 1% → 0%).
- **The features page talks like an engineer.** "5 documented endpoints", "Supabase RLS
  policies", "row-level security" — implementation detail on a marketing page. The GDPR story
  is a real selling point, but it should be told as care, not as architecture.
- **It only sells to one buyer.** The old site speaks to programme organisers. The product now
  serves organisers, participants (the `/my` portal, the mobile app experience), and the
  communities and companies around them.

What's *right* — and must survive the rewrite — is the whole register: the Matisse story, the
handwritten wordmark, "a gathering is a cut in time", the before/during/after arc. That is the
brand. The rewrite is a re-aiming, not a re-voicing.

## 2. What stays (the brand contract)

1. **The tone.** Calm, literary, confident, warm. Short declarative sentences. Ideas before
   features. The naming brief's word for it: *collaborative, curious, accompanying — never
   authoritative or expert.* The current About page is the reference text; new copy should be
   indistinguishable from it in voice.
2. **The Matisse visual language.** Cut-out shapes — vessels, botanicals, figures, gestures —
   on generous white/cream ground. Handwritten wordmark. The yellow accent. "The white ground
   was never empty" stays a design principle: the site breathes.
3. **The core metaphor.** The thread is the invisible thing between people; the platform gives
   it a shape. Every page should be able to trace itself back to that sentence.
4. **The arc.** Before / During / After — Intention / Experience / Journey. This is now even
   truer of the product than when it was written (triggers, scheduled messages, completion
   flows, certificates, the participant portal). Promote it from a section to the site's spine.

## 3. Positioning (from the naming brief — binding)

- **Thread is the master brand.** The site sells *the Thread* — the journey — not "a platform
  with six apps." People should leave able to say "I run my programme as a Thread" or "I got a
  message on my Thread."
- **The tools are functions, not siblings.** Meet, Flow, Pulse, Membership appear as *what the
  workshop can do* — scheduling the meetings, moving people through stages, keeping the plan
  honest, carrying a membership — never as co-equal products with their own pages. **No
  per-app product pages** (brief B, echoed in build-plan item 3).
- **Fibre stays backstage.** At most one quiet line for the trust story ("built on an EU
  foundation; your people's data stays theirs") — the word "Fibre" itself almost never appears.
- **Two doors, one house.** thethread.app is the front door for people who gather;
  thefibre.app remains the door for technical partners and data-sovereignty conversations.
  The site should not try to be both.

### The one-liner

Candidates, all in the house voice — pick on the page, not in this doc:

- *The Thread. For weaving the social fabric.* (current payoff — still true, keep as the mark's
  companion line)
- *Every gathering is a beginning. The Thread carries it forward.*
- *One place to shape a gathering, run it beautifully, and let it keep going.*

### Three readers, one story

| Reader | What they need to hear | Where |
|---|---|---|
| The organiser | The entire arc is simple and beautiful: from first intention to last follow-up. Enrolment, payment, messages, certificates — considered, effortless, entirely yours. | Home + product tour |
| The participant | Attendance becomes participation. A thing on your phone that feels like care, not admin. Your data treated with respect. | Home (secondary), product tour |
| The community / company | A living record of shared experience. Members, journeys, gatherings that recombine — the social fabric, actually woven. | Home (closing movement), About |

## 4. Site structure

Keep it small. Five pages, one navigation.

```
Home            the story + the arc + the workshop + proof + pricing teaser
The workshop    the product tour, organised by the arc (replaces "Features")
Pricing         the real tiers, told honestly
About           the Matisse essay (already written — lightly trimmed, untouched in voice)
Contact         hello@thethread.app + host-a-conversation CTA
                (Developers → existing docs; footer links: privacy, terms — reuse the
                 thefibre.app public legal pages rather than writing new ones)
```

### Home — the scroll as a thread

The page is one continuous movement, in six beats:

1. **The cut.** Handwritten wordmark, one line, white space. *A gathering is a cut in time.
   You decide it matters. You give it a shape. People enter. The meaning is made together.*
   (This text exists. It becomes the hero.)
2. **The turn.** *Most event platforms stop at the event. The Thread starts there.* (Existing
   line — it's the sharpest thing on the current site. Keep it as the pivot into product.)
3. **The arc.** Before / During / After, now shown, not just told — three moments with real
   product surfaces inside cut-out frames: the timeline editor (intention), the participant's
   phone (experience), a certificate and a follow-up message (journey).
4. **The workshop.** One section, four gestures, no logos, no app grid: *the meetings get
   scheduled · people move through stages, nothing falls through · the plan stays honest ·
   membership carries on between gatherings.* Each a sentence, not a card wall. This is how
   Meet / Flow / Pulse / Membership exist on this site.
5. **Proof.** Real numbers and real gatherings once we have permission to name them (EBBF is
   the natural first). Until then: the six languages, the certificates issued, the "works in
   eight languages, reads beautifully in all of them" kind of fact. No fake logos, ever.
6. **The invitation.** *Start with one gathering. Free means free — one live event, forever.*
   Primary CTA "Start a Thread", secondary "Talk to us" (Enterprise is deliberately a
   conversation).

### The workshop (product tour)

Replaces the current /features taxonomy. Organised by the arc, not by module:

- **Before — give it a shape.** Timeline editor, eight engagement types, templates, enrolment
  pages that need no login, approval flows, tickets and discount codes, payment by card or
  invoice.
- **During — run it beautifully.** The participant app (installable, bottom-tab, chat-style
  messages), QR check-in, the guest list, materials in one place.
- **After — let it keep going.** Triggered and scheduled messages, reflections and practice,
  completion → certificates (designed, issued, verified, shared to LinkedIn), the `/my`
  portal where a person's whole trail lives.
- **Underneath — quietly.** One short block: EU-hosted, GDPR by construction, export and
  erasure that actually work, embeds for your own website, an API for your developers. Told
  as care ("your guests' data is theirs; we built the whole thing that way"), with a single
  link out for the technical reader.

### Pricing

- The four real tiers: **Free €0 · Starter €19 · Pro €49 · Enterprise — talk to us**, per
  workspace, annual = two months free, seats and the fee ladder (2% / 1% / 0%) stated plainly.
- Lead Free with its honest promise: *one live event, forever — not a trial.* Lead Pro with
  what actually sells it per the pricing proposal: design your own threads, Flow and Pulse,
  0% fee.
- **Source of truth rule:** the numbers on this page must come from (or be verified against)
  the same catalogue the product uses (`GET /api/v1/public/plans`, `sortPlans` order:
  free → starter → pro → enterprise). The current site's double-contradiction is exactly what
  happens when marketing pages hold their own copy of prices.

### About

The Matisse essay survives nearly whole — it is the best writing in the house. Two additions:
a short "who makes this" paragraph (Solidarity Lab B.V., Rotterdam — human, two sentences),
and the closing invitation. One removal: nothing; trim only if a section fights the new Home
for the same lines (the hero borrows "a gathering is a cut in time" — About can keep it as
the coda, repetition is a feature of this voice).

## 5. Copy direction — samples in the voice

To calibrate, not to prescribe:

- *The event ends. The thread doesn't.*
- *You bring the intention. The Thread holds the rest — the invitations, the payments, the
  messages that arrive exactly when they should.*
- *Your guests don't download anything. They open a page and they're in.*
- *A certificate is not a PDF. It's a moment made durable.* (certificates section)
- *Free means free. One gathering, live, forever. When you're ready for more, we're here.*
- For the workshop section: verbs, not nouns. Not "Flow — pipeline management" but *people
  move through stages, and nothing falls through.*

Anti-patterns to strike everywhere: "all-in-one", "powerful", "seamless", "leverage",
"solution", exclamation marks, feature counts as headlines ("50+ features!"), and any sentence
an engineer wrote for another engineer.

## 6. Visual direction — same language, more alive

Festival of Trust is the reference for *energy*, not for style. What to borrow is the
dynamism: full-viewport moments, motion tied to scroll, layered depth. What not to borrow:
its photographic density — The Thread's ground stays white.

1. **The drawn thread.** The signature move: a single line — the thread — that draws itself
   as you scroll, travelling the whole Home page, connecting the cut-out shapes the way the
   eye "traces an invisible line from one form to another" (the About page already describes
   this; the site should *do* it). It is the navigation's progress, the section divider, and
   the metaphor, all at once.
2. **Shapes that drift and settle.** Cut-outs enter with slight parallax and rotation, like
   paper placed by hand — settling, not bouncing. Easing should feel like a confident cut:
   one gesture, no wobble. Never busy: a few shapes per viewport, the white doing the work.
3. **The scissors moment.** One hero animation worth investing in: a painted field, a single
   cut, a shape lifts away. "One cut. No hesitation. No revision." Three seconds, once,
   at the top.
4. **Real gatherings, framed by paper.** Introduce photography (the Festival of Trust
   lesson) but masked *inside* cut-out shapes — people laughing through the silhouette of a
   vessel or a leaf. Colour photos inside bold shapes on white: instantly ours, instantly
   warmer than the current all-illustration site.
5. **Product shown as object.** Screens of the timeline editor and the participant app appear
   as collaged objects among the shapes — slightly rotated, paper-shadowed — not as glossy
   device mockups.
6. **Type stays quiet.** The handwritten mark is the only expressive type. Body and headings
   remain the current restrained sans; scale and white space carry the drama, and everything
   still reads perfectly with motion off (and on phones, where most first visits will land).

## 7. Guardrails (things this site must not do)

- No app grid, no per-app pages, no "our products" navigation. (naming brief)
- No "Fibre" in headlines or navigation; at most one line in the trust block.
- No prices anywhere except the Pricing page, and those verified against the live catalogue.
- No architecture talk (RLS, Supabase, endpoints-counting) outside the Developers docs link.
- No invented social proof; unnamed truths beat named fictions.
- The apex must keep serving throughout — the old V3 landing stays up until the new site
  replaces it in one cut (fitting, given the brand).

## 8. Practicalities (brief, then back to marketing)

- The current site lives in the old `thethread-v3` repo/Vercel project. The natural home for
  the rewrite is a fresh marketing surface in this monorepo (it needs the shared branding and
  the public plans endpoint, nothing else) — decide at build time, not here.
- Assets to carry over from `thethread-v3/public`: `logo-the-thread.svg`,
  `logo-the-thread-white.svg`, `payoff.svg`; the cut-out shape library should be rebuilt as a
  proper reusable set (SVG, each shape one path — one cut).
- Swapping the site is a DNS/Vercel-domain move; the V3 decommission items in build-plan
  (cron, Stripe webhook) unblock fully once this ships.

## 9. Suggested order of work

1. **Copy deck first.** Home + workshop + pricing written in full, in the voice, reviewed by
   Sjoerd before any pixel moves. (The voice is the hard part; the current About page is the
   bar.)
2. **Shape library + the drawn-thread motif** as a small standalone prototype — if the
   scroll-thread works, the whole site works.
3. **Home**, complete with motion.
4. **Workshop + Pricing + About + Contact** (About is mostly editing).
5. **Photography pass** — gather real gathering photos worth masking (EBBF Athens is the
   obvious source, with consent).
6. **The cut**: point the apex at the new site, then finish the V3 decommission list.
