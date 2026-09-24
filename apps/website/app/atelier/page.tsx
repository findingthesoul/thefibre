// The atelier — the product page, redone to Sjoerd's spec (2026-09-07):
// "By facilitators, for facilitators." above; the atelier concept; then
// the apps NAMED, each with its feature list and its Matisse tile (the
// same crops the in-app launcher poster uses — served from the fibre web
// brand SPoT via tileArtUrl, never copied).
//
// Called "the workshop" until 2026-09-24 (Sjoerd: *"The workshop can be
// called: the atelier"*). The old path still answers — a permanent redirect
// in next.config.mjs — because the name is ours to change and other people's
// links are not. NOTE the word "workshop" survives elsewhere on this site as
// the ordinary noun: a workshop is a KIND OF EVENT people run, and renaming
// those sentences would have been a find-and-replace pretending to be a
// rename.

import type { Metadata } from 'next';
import { APPS, APP_DISPLAY_ORDER, SURFACES, surfaceUrl, tileArtUrl, type AppId } from '@thefibre/shared';
import { Settle } from '@/components/settle';
import { StartButton } from '@/components/start-dialog';

export const metadata: Metadata = {
  title: 'The atelier',
  description:
    'By facilitators, for facilitators — The Thread and the tools in its service: Meet, Members, Pulse, Connect.',
};

// The tools shown, in the canonical display order (derived since 2026-09-14;
// until then a hand list of the same five). Deliberately omitted:
//
//   fibre-platform  backstage, not a tool
//   fibre-learn     unreleased
//   fibre-flow      NOT a tool anybody picks any more. Sjoerd, 2026-09-23:
//                   *"Flows as a tech should be available in all apps — but
//                   not as an app people can select (more as a building
//                   block for apps)."* It still runs, underneath, in every
//                   app that needs a path people travel; it stopped being a
//                   thing you choose from a shelf. So it moves out of the
//                   line-up and into "Underneath, quietly", with the rest of
//                   the foundation. See docs/flow-as-a-building-block-proposal.md.
//
// Connect joined on 2026-09-24 — it had been held back as "not on the
// product page yet" since before it was live, and has been in production
// since 2026-09-13.
const NOT_SHOWN = new Set<AppId>(['fibre-platform', 'fibre-learn', 'fibre-flow']);
const TOOL_ORDER: AppId[] = APP_DISPLAY_ORDER.filter((slug) => !NOT_SHOWN.has(slug));

// The recognisable problem each tool answers (Sjoerd, 2026-09-08): the
// itch a facilitator knows by name, then how we built it away.
const PROBLEMS: Record<string, { problem: string; solved: string }> = {
  'the-thread': {
    problem:
      'The event is three weeks out and the truth lives in five places — enrolments in a spreadsheet, payments in your banking app, the programme in a doc, reminder emails you keep meaning to send. Every gathering means rebuilding the same machinery, and the follow-up quietly dies with the applause.',
    solved:
      'One thread per gathering. The enrolment page, tickets and payment, a message timeline that fires itself at the right moments, certificates at the end — designed once, then it runs. The event ends; the thread doesn’t.',
  },
  'fibre-meet': {
    problem:
      'Seventeen emails to find one hour. With a group it becomes a project of its own — and the polling tool doesn’t know your calendar, your rooms or your team.',
    solved:
      'Booking pages that know your real availability: people pick what’s open, the calendar entry and the room link follow automatically, group polls settle the rest. Scheduling stops being work.',
  },
  membership: {
    problem:
      'Who is a member? Who has paid? Who belongs to which circle? The answer lives in a spreadsheet nobody fully trusts, and it changes faster than anyone maintains it.',
    solved:
      'A living register: tiers, groups and subgroups, renewals and reminders handled, payment collected, access opening and closing with the membership itself. One answer, always current.',
  },
  'fibre-pulse': {
    problem:
      'Facilitation income is lumpy — a full autumn, an empty January. Whether the year works out financially is something you discover in December, when it’s too late to steer.',
    solved:
      'The money side as a live plan: expected income, real costs, the months ahead visible today. Small numbers honestly kept, so you steer in March instead of mourning in December.',
  },
  'fibre-sales': {
    problem:
      'The relationships are the work, and they live in your head. Who you met at the conference, who asked to be kept posted, which organisation went quiet, who you promised to call back in March — none of it is written down anywhere you would find it again, and a CRM built for sales teams asks you to describe people as deals.',
    solved:
      'The landscape of everybody around the work, kept honestly: people and organisations, how they are connected, what was actually said. Follow-ups become to-dos instead of good intentions, and nothing asks you to call a relationship a pipeline.',
  },
};

const FEATURES: Record<string, string[]> = {
  'the-thread': [
    'A timeline editor for the whole journey — sessions, one-to-ones, messages, reflection, practice: eight kinds of engagement, arranged like a score',
    'Public enrolment pages that need no login, in six languages',
    'Tickets, discount codes, approval flows — payment by card or by invoice',
    'Messages that send themselves: on enrolment, on approval, on completion, or at exactly the right moment',
    'Certificates — designed, issued, verified, shared to LinkedIn',
    'A personal portal for every participant: their whole trail, their materials, what comes next',
    'Embeds for your own website; thread templates so the next edition starts warm',
  ],
  'fibre-meet': [
    'Booking pages for you and your team — meeting types, availability, one link',
    'Fair rotation across facilitators, so the load spreads honestly',
    'Google Calendar connected; Zoom or your own room on every booking',
    'Group polls when the time has to suit everyone',
    'Paid sessions when your time is the offer — card checkout built in',
    'Invitations and an internal-team view that tells the truth',
  ],
  membership: [
    'Tiers, renewals, grace and lapse — the whole membership lifecycle, tended automatically',
    'Prices that adjust to a member’s country, by rules you write',
    'Optional add-on products on the join page',
    'Access that follows membership: community spaces and accounts open when someone joins, close when they lapse',
    'A member portal for invoices, payment details and renewal',
    'Reminders in the community’s own voice, not a noreply',
  ],
  'fibre-pulse': [
    'Cashflow as a plan, not a surprise — money in, money out, visible before it happens',
    'Budgets and commitments per project, per team',
    'Offerings and a pipeline that feed the projection',
    'Snapshots over time, so you see the trend and not just the balance',
    'Operating costs where they belong — next to the income they serve',
  ],
  'fibre-sales': [
    'People and organisations as a landscape, not a list of leads',
    'The conversation kept with the person it belongs to — notes, hashtags, who introduced whom',
    'Follow-ups that become to-dos, so a promise made in a corridor survives the week',
    'Built for a phone: the person in front of you, not a table you have to zoom',
    'Your own assistant can reach it, with your permission and nobody else’s',
  ],
};

export default function AtelierPage() {
  // Through surfaceUrl, not the registry's literal, so the staging twin
  // links to the staging portal rather than sending a tester to production.
  const portalUrl = surfaceUrl('my-portal', process.env);
  return (
    <main className="px-6 py-16 md:px-10 md:py-24">
      {/* The banner line — Sjoerd's header for this page. */}
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-ink-muted">
          The atelier
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
          By facilitators, for facilitators.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-subtle">
          We host gatherings ourselves — festivals, fellowships, courses. The atelier is the set
          of tools we built because we needed them: one for the journey itself, and four in its
          service. They share one foundation, one contact book, one honest ledger — so the work
          flows between them without you carrying it.
        </p>
      </div>

      {/* The apps, named — each with its Matisse tile and its features. */}
      <div className="mx-auto mt-20 max-w-3xl space-y-16">
        {TOOL_ORDER.map((slug, i) => {
          const meta = APPS[slug];
          const art = tileArtUrl(slug, process.env);
          return (
            <Settle key={slug} from={{ y: 24, rotate: i % 2 ? 1 : -1 }}>
              <section className="grid grid-cols-1 gap-8 md:grid-cols-[180px_1fr]">
                <div>
                  {art ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={art}
                      alt=""
                      loading="lazy"
                      className={`w-40 rounded-2xl shadow-[0_10px_30px_rgba(26,26,46,0.12)] md:w-full ${
                        i % 2 ? '-rotate-2' : 'rotate-2'
                      }`}
                    />
                  ) : (
                    <div className="flex aspect-square w-40 items-center justify-center rounded-2xl bg-accent text-2xl font-semibold md:w-full">
                      {meta.brandLetters}
                    </div>
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">{meta.name}</h2>
                  <p className="mt-1 text-base text-ink-subtle">{meta.tagline}</p>
                  {PROBLEMS[slug] && (
                    <div className="mt-5 rounded-xl bg-surface-warm p-5">
                      <p className="text-[15px] leading-relaxed text-ink-subtle">
                        <strong className="font-semibold text-ink">Sound familiar? </strong>
                        {PROBLEMS[slug].problem}
                      </p>
                      <p className="mt-3 text-[15px] leading-relaxed text-ink-subtle">
                        <strong className="font-semibold text-ink">So we built it away. </strong>
                        {PROBLEMS[slug].solved}
                      </p>
                    </div>
                  )}
                  <ul className="mt-5 space-y-2.5">
                    {(FEATURES[slug] ?? []).map((f) => (
                      <li key={f} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink-subtle">
                        <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent ring-1 ring-ink/20" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </Settle>
          );
        })}
      </div>

      {/* my.thread — not a tool you buy. The side of the atelier your
          PARTICIPANTS stand on, which is why it sits apart from the line-up
          rather than as a fifth tile (Sjoerd, 2026-09-24: *"My.thethread"*).
          It is a platform SURFACE and not a catalogue app, so it comes from
          SURFACES rather than APPS — the same distinction the visitor-portal
          session drew in 2026-09-08, and the reason it has no tile art. */}
      <div className="mx-auto mt-24 max-w-3xl">
        <Settle from={{ y: 24, rotate: 1 }}>
          <section className="rounded-2xl border border-line p-8 md:p-10">
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-ink-muted">
              For the people you gather
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight">
              {SURFACES['my-portal'].shortLabel ?? SURFACES['my-portal'].name}
            </h2>
            <p className="mt-1 text-base text-ink-subtle">{SURFACES['my-portal'].tagline}</p>
            <p className="mt-5 text-[15px] leading-relaxed text-ink-subtle">
              Everyone who joins something of yours gets a place of their own — every thread they
              walk, their materials, their tickets, their invoices, their certificates. It works
              with no signal and installs to a home screen, because a ticket is needed at a door
              and doors have bad reception. They never need an account with us to use it, and it
              costs you nothing: it comes with the gathering.
            </p>
            <a
              href={portalUrl}
              className="mt-5 inline-block text-[15px] underline underline-offset-4 hover:text-ink"
            >
              {portalUrl.replace('https://', '')} →
            </a>
          </section>
        </Settle>
      </div>

      {/* Underneath, quietly — the foundation. */}
      <div className="mx-auto mt-24 max-w-3xl rounded-2xl bg-surface-paper p-8 md:p-10">
        <h2 className="text-lg font-semibold">Underneath, quietly</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-subtle">
          One foundation carries all of it: the same people, the same organisations, one activity
          trail, one ledger. Your to-dos gather there too — a follow-up written in Connect and a
          task set on a thread arrive in the same list, in whichever tool you happen to have open.
          Flows run underneath as well: the paths people travel through a programme are a building
          block every tool can use, rather than a sixth thing to learn. Hosted in the EU, private
          by construction — your guests&apos; data is theirs, and export and erasure actually work.
          Embeds for your own website, an API for your developers.{' '}
          <a href="https://thefibre.app" className="underline underline-offset-4 hover:text-ink">
            For the technical reader →
          </a>
        </p>
      </div>

      <div className="mx-auto mt-20 max-w-2xl text-center">
        <p className="text-lg font-medium">You bring the intention. The atelier holds the rest.</p>
        <StartButton className="mt-6 inline-block rounded-full bg-ink px-7 py-3 text-sm font-bold text-white transition-all hover:-translate-y-px hover:shadow-lg">Start a Thread</StartButton>
      </div>
    </main>
  );
}
