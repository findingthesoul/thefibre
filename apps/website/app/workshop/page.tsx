// The workshop — the product page, redone to Sjoerd's spec (2026-09-07):
// "By facilitators, for facilitators." above; the workshop concept; then
// the apps NAMED, each with its feature list and its Matisse tile (the
// same crops the in-app launcher poster uses — served from the fibre web
// brand SPoT via tileArtUrl, never copied).

import type { Metadata } from 'next';
import { APPS, tileArtUrl, type AppId } from '@thefibre/shared';
import { Settle } from '@/components/settle';
import { startHref } from '@/lib/site';

export const metadata: Metadata = {
  title: 'The workshop',
  description:
    'By facilitators, for facilitators — The Thread and the tools in its service: Meet, Members, Pulse, Flow.',
};

const TOOL_ORDER: AppId[] = ['the-thread', 'fibre-meet', 'membership', 'fibre-pulse', 'fibre-flow'];

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
  'fibre-flow': [
    'Pipelines you draw — stages, transitions, the whole shape of how people move',
    'Gate tasks that must be done before someone advances; nothing falls through',
    'A kanban board for the daily work, a visual builder for the design',
    'Steps that complete themselves when the platform sees the activity happen',
    'Reports and lifecycle views across every run',
  ],
};

export default function WorkshopPage() {
  return (
    <main className="px-6 py-16 md:px-10 md:py-24">
      {/* The banner line — Sjoerd's header for this page. */}
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-ink-muted">
          The workshop
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
          By facilitators, for facilitators.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-subtle">
          We host gatherings ourselves — festivals, fellowships, courses. The workshop is the set
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

      {/* Underneath, quietly — the foundation. */}
      <div className="mx-auto mt-24 max-w-3xl rounded-2xl bg-surface-paper p-8 md:p-10">
        <h2 className="text-lg font-semibold">Underneath, quietly</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-subtle">
          One foundation carries all of it: the same people, the same organisations, one activity
          trail, one ledger. Hosted in the EU, private by construction — your guests&apos; data is
          theirs, and export and erasure actually work. Embeds for your own website, an API for
          your developers.{' '}
          <a href="https://thefibre.app" className="underline underline-offset-4 hover:text-ink">
            For the technical reader →
          </a>
        </p>
      </div>

      <div className="mx-auto mt-20 max-w-2xl text-center">
        <p className="text-lg font-medium">You bring the intention. The workshop holds the rest.</p>
        <a
          href={startHref()}
          className="mt-6 inline-block rounded-full bg-ink px-7 py-3 text-sm font-bold text-white transition-all hover:-translate-y-px hover:shadow-lg"
        >
          Start a Thread
        </a>
      </div>
    </main>
  );
}
