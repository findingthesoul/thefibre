// Home — one continuous movement in six beats (rewrite plan §4). The copy
// lives here on purpose: the review loop is live-on-the-page, and a beat is
// a section you can point at. The drawn thread runs in per-section segments
// whose entry/exit x-positions hand off (THREAD_X) so it reads as one line.

import { Settle } from '@/components/settle';
import { DrawnThread } from '@/components/drawn-thread';
import { Burst, Figure, Leaf, Vessel, Wave } from '@/components/shapes';
import { loadPlans } from '@/lib/plans';
import { startHref } from '@/lib/site';
import Link from 'next/link';

export default async function Home() {
  const { mode } = await loadPlans();

  return (
    <main>
      {/* ── Beat 1 · The cut ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pb-24 pt-16 md:px-10 md:pt-24">
        <div className="mx-auto max-w-4xl">
          <div id="hero-wordmark-sentinel" className="flex flex-wrap items-end gap-x-10 gap-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-the-thread.svg" alt="The Thread" className="h-14 w-auto md:h-[73px]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/payoff.svg" alt="For weaving the social fabric." className="mb-1 hidden h-5 w-auto md:block" />
          </div>

          <div className="mt-16 max-w-2xl md:mt-24">
            {[
              'A gathering is a cut in time.',
              'You decide it matters.',
              'You give it a shape.',
              'People enter.',
              'The meaning is made together.',
            ].map((line) => (
              <p key={line} className="text-2xl font-semibold leading-snug tracking-tight md:text-4xl">
                {line}
              </p>
            ))}
          </div>
        </div>

        {/* Shapes on the white ground — few, the white does the work. */}
        <Vessel className="pointer-events-none absolute -right-6 top-24 hidden w-36 text-accent md:block" rotate={8} />
        <Leaf className="pointer-events-none absolute bottom-6 left-[8%] hidden w-20 text-surface-paper md:block" rotate={-14} />
      </section>

      {/* ── Beat 2 · The turn ────────────────────────────────────────── */}
      <section className="relative px-6 py-24 md:px-10 md:py-32">
        <DrawnThread
          viewBox="0 0 1000 400"
          d="M720 0 C700 120 420 80 380 180 C340 280 200 260 300 400"
          begin={0.95}
          end={0.35}
          className="pointer-events-none absolute inset-0 hidden h-full w-full text-ink md:block"
        />
        <div className="mx-auto max-w-2xl">
          <p className="text-xl font-semibold leading-snug md:text-3xl">
            Most event platforms stop at the event.
            <br />
            The Thread starts there.
          </p>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-subtle md:text-lg">
            A dinner, a workshop, a conference — the moment people enter a room together, something
            becomes possible that wasn&apos;t possible before. The Thread is built to honour that
            moment, and to carry it forward.
          </p>
        </div>
      </section>

      {/* ── Beat 3 · The arc ─────────────────────────────────────────── */}
      <section className="relative bg-surface-warm px-6 py-24 md:px-10 md:py-32">
        <DrawnThread
          viewBox="0 0 1000 600"
          d="M300 0 C380 100 620 80 660 220 C700 360 380 380 480 500 C540 570 600 580 620 600"
          begin={0.9}
          end={0.3}
          className="pointer-events-none absolute inset-0 hidden h-full w-full text-ink md:block"
        />
        <div className="mx-auto max-w-5xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-ink-muted">
            Before · During · After
          </p>
          <h2 className="mt-2 max-w-xl text-2xl font-semibold tracking-tight md:text-3xl">
            One arc, from first intention to last follow-up.
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            <Settle from={{ y: 30, rotate: -3 }}>
              <div className="flex h-full flex-col rounded-2xl bg-accent p-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/50">Before</p>
                <h3 className="mt-1 text-xl font-bold">Intention</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/70">
                  Give it a shape. A timeline, an enrolment page that needs no login, tickets if
                  you want them — payment by card or invoice. Set the conditions for something real
                  to happen.
                </p>
                <Vessel className="mt-6 w-14 self-end text-ink/80" rotate={-6} />
              </div>
            </Settle>
            <Settle from={{ y: 30, rotate: 2 }} delay={120}>
              <div className="flex h-full flex-col rounded-2xl bg-ink p-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/50">During</p>
                <h3 className="mt-1 text-xl font-bold text-white">Experience</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-white/80">
                  Run it beautifully. Your guests don&apos;t download anything — they open a page
                  and they&apos;re in: the programme, the messages, the room. Considered,
                  effortless, entirely yours.
                </p>
                <Figure className="mt-6 w-12 self-end text-accent" rotate={8} />
              </div>
            </Settle>
            <Settle from={{ y: 30, rotate: -2 }} delay={240}>
              <div className="flex h-full flex-col rounded-2xl bg-surface-paper p-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/50">After</p>
                <h3 className="mt-1 text-xl font-bold">Journey</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/70">
                  Let it keep going. The message that arrives exactly when it should. A certificate
                  that makes the moment durable. The event ends. The thread doesn&apos;t.
                </p>
                <Leaf className="mt-6 w-10 self-end text-ink/70" rotate={16} />
              </div>
            </Settle>
          </div>
        </div>
      </section>

      {/* ── Beat 4 · The workshop ────────────────────────────────────── */}
      <section className="relative px-6 py-24 md:px-10 md:py-32">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">The workshop</h2>
          <p className="mt-3 text-base text-ink-subtle">
            Behind the journey, a quiet set of tools. You&apos;ll never need to learn their names.
          </p>
          <ul className="mt-10 space-y-6">
            {[
              'The meetings get scheduled — booking pages, invitations, one calendar that tells the truth.',
              'People move through stages, and nothing falls through.',
              'The plan stays honest — money in, money out, visible before it happens.',
              'Membership carries on between gatherings, so the community is never starting over.',
            ].map((sentence, i) => (
              <Settle key={sentence} from={{ y: 20, rotate: 0 }} delay={i * 90}>
                <li className="flex items-start gap-4">
                  <Burst className="mt-1 w-5 shrink-0 text-accent" rotate={i * 22} />
                  <p className="text-lg leading-relaxed md:text-xl">{sentence}</p>
                </li>
              </Settle>
            ))}
          </ul>
          <p className="mt-10 text-sm text-ink-subtle">
            <Link href="/workshop" className="underline underline-offset-4 hover:text-ink">
              Walk through the workshop →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Beat 5 · Proof ───────────────────────────────────────────── */}
      <section className="border-y border-line bg-surface-warm px-6 py-16 md:px-10">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          {[
            ['Six languages', 'Public pages, messages and certificates — reading beautifully in all of them.'],
            ['Enrolment to certificate', 'The whole trail without a single spreadsheet.'],
            ['EU-hosted, GDPR by construction', 'Your guests’ data is theirs. We built the whole thing that way.'],
          ].map(([stat, line]) => (
            <div key={stat}>
              <p className="text-lg font-semibold">{stat}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-subtle">{line}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Beat 6 · The invitation ──────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 py-28 text-center md:px-10 md:py-36">
        <Wave className="pointer-events-none absolute bottom-0 left-0 w-full text-surface-paper" />
        <div className="relative mx-auto max-w-xl">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Start with one gathering.
          </h2>
          <p className="mt-4 text-lg text-ink-subtle">
            Free means free — one live event, forever. When you&apos;re ready for more,
            we&apos;re here.
          </p>
          {mode === 'invited' && (
            <p className="mt-2 text-sm text-ink-muted">Access is by request while we onboard.</p>
          )}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href={startHref('free')}
              className="rounded-full bg-ink px-7 py-3 text-sm font-bold text-white transition-all hover:-translate-y-px hover:shadow-lg"
            >
              Start a Thread
            </a>
            <Link
              href="/contact"
              className="rounded-full border border-line px-7 py-3 text-sm font-medium text-ink-subtle transition-colors hover:border-ink hover:text-ink"
            >
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
