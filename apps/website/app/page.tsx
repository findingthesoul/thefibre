// Home — an unfolding story (Sjoerd's direction, 2026-09-07, after
// counder.com): one sentence per viewport, the key word inked; a single
// thread drawing itself down the whole page; Matisse cut-outs gathering
// like a constellation as the story fills with people. The litany IS the
// story — each line becomes a scene, and the shapes accumulate: one cut,
// then a few, then a gathering, then the whole fabric.

import Link from 'next/link';
import { Scene, Line, Ink } from '@/components/scene';
import { ScrollCollage, type ScrubPiece } from '@/components/scroll-collage';
import { Constellation, type Star } from '@/components/constellation';
import { DrawnThread } from '@/components/drawn-thread';
import { Settle } from '@/components/settle';
import { Figure, Leaf, Vessel } from '@/components/shapes';
import { loadPlans } from '@/lib/plans';
import { startHref } from '@/lib/site';

// The thread runs down the page's centre: every segment enters top-centre
// and leaves bottom-centre, so the per-scene segments read as ONE line.
const SEG = {
  sway: 'M500 0 C560 130 420 260 500 400 C560 520 460 560 500 640',
  swayBack: 'M500 0 C440 130 580 260 500 400 C440 520 540 560 500 640',
};

const CONSTELLATIONS: Record<string, Star[]> = {
  cut: [{ shape: 'burst', x: 62, y: 18, w: 'w-16 md:w-24', color: 'text-accent', rotate: 12, drift: 0.06 }],
  you: [
    { shape: 'vessel', x: 18, y: 22, w: 'w-14 md:w-20', color: 'text-accent', rotate: -8, drift: 0.05 },
    { shape: 'leaf', x: 74, y: 62, w: 'w-10 md:w-14', color: 'text-surface-paper', rotate: 20, drift: 0.09, desktopOnly: true },
  ],
  shape: [
    { shape: 'vessel', x: 70, y: 16, w: 'w-16 md:w-24', color: 'text-ink', rotate: 6, drift: 0.05 },
    { shape: 'leaf', x: 12, y: 30, w: 'w-12 md:w-16', color: 'text-accent', rotate: -18, drift: 0.08 },
    { shape: 'wave', x: 24, y: 74, w: 'w-24 md:w-36', color: 'text-surface-paper', rotate: -4, drift: 0.04, desktopOnly: true },
  ],
  enter: [
    { shape: 'figure', x: 12, y: 18, w: 'w-12 md:w-16', color: 'text-ink', rotate: -10, drift: 0.07 },
    { shape: 'figure', x: 78, y: 24, w: 'w-10 md:w-14', color: 'text-accent', rotate: 14, drift: 0.05 },
    { shape: 'figure', x: 22, y: 68, w: 'w-10 md:w-14', color: 'text-accent', rotate: 8, drift: 0.1, desktopOnly: true },
    { shape: 'figure', x: 68, y: 66, w: 'w-12 md:w-16', color: 'text-surface-paper', rotate: -16, drift: 0.06, desktopOnly: true },
  ],
  together: [
    { shape: 'burst', x: 14, y: 16, w: 'w-12 md:w-16', color: 'text-accent', rotate: 0, drift: 0.06 },
    { shape: 'figure', x: 76, y: 14, w: 'w-10 md:w-14', color: 'text-ink', rotate: 12, drift: 0.08 },
    { shape: 'leaf', x: 8, y: 58, w: 'w-10 md:w-14', color: 'text-surface-paper', rotate: -22, drift: 0.05, desktopOnly: true },
    { shape: 'vessel', x: 84, y: 52, w: 'w-12 md:w-20', color: 'text-accent', rotate: -6, drift: 0.04, desktopOnly: true },
    { shape: 'figure', x: 30, y: 78, w: 'w-9 md:w-12', color: 'text-accent', rotate: 18, drift: 0.09, desktopOnly: true },
    { shape: 'wave', x: 56, y: 82, w: 'w-20 md:w-32', color: 'text-surface-paper', rotate: 3, drift: 0.07, desktopOnly: true },
  ],
};

// The three fabric cards' compositions. Entry vectors are vw/vh — pieces
// really come in from beyond the screen edges (sides + bottom, per Sjoerd).
// Travellers: the yellow egg runs 2→3→4; the teal figure hands off 2→3; the
// black leaf 3→4. A traveller exits DOWN on one card (its scatter vector
// points below) and enters FROM THE TOP on the next, so it reads as one
// shape moving down the page.
// Spread to fill the whole canvas (Sjoerd: "second card almost full with
// illustration") — same arrangement, scaled up and opened out vertically.
const FABRIC: ScrubPiece[] = [
  { src: 'start-figure.png', x: 6.4, y: 22.7, w: 17.3, dx: -8, dy: 45, r: -22, e: 0.85 },
  { src: 'yellow-shape.png', x: 19.8, y: 36.2, w: 7.1, dx: -52, dy: 6, r: 18, e: 1.1 },
  { src: 'bordeaux-shape.png', x: 24.3, y: 47, w: 7.5, dx: -40, dy: 14, r: -30, e: 1.3 },
  { src: 'blue-shape-cup.png', x: 28.9, y: 51.1, w: 17.6, dx: -10, dy: 55, r: 10, e: 1 },
  { src: 'orange-vase.png', x: 42.7, y: 41.6, w: 15.2, dx: 0, dy: 60, r: -8, e: 0.9 },
  { src: 'yellow-egg.png', x: 51.3, y: 39.6, w: 7.3, dx: 6, dy: 45, r: 35, e: 1.4 },
  { src: 'rise-bowl.png', x: 54.1, y: 70.6, w: 12.7, dx: 6, dy: 50, r: -14, e: 1.15 },
  { src: 'blue-bowl.png', x: 64.2, y: 59.8, w: 9.4, dx: 38, dy: 10, r: 20, e: 1.25 },
  { src: 'blue-square.png', x: 70, y: 57.8, w: 15.2, dx: 50, dy: 4, r: 8, e: 1 },
  { src: 'double-vase.png', x: 80.2, y: 26.1, w: 8.7, dx: 45, dy: -8, r: -16, e: 0.9 },
  { src: 'turqois-stool.png', x: 77.1, y: 72, w: 11.5, dx: 18, dy: 48, r: 12, e: 1.2 },
  { src: 'ligth-turqiose-leaf.png', x: 87.7, y: 5.2, w: 9.9, dx: 40, dy: -14, r: 28, e: 1.35 },
];

// Sjoerd's second reference (portrait): leaf on top, green stalk + turquoise
// dome, the chair, orange dome at the foot, yellow figure at the right —
// plus the two travellers arriving from the card above.
const WORKSHOP: ScrubPiece[] = [
  { src: 'start-figure.png', x: 4, y: 6, w: 22, dx: -3, dy: -55, r: -15, e: 0.8 },
  { src: 'yellow-egg.png', x: 70, y: 36, w: 14, dx: 5, dy: -48, r: 30, e: 1.3 },
  { src: 'black-leaf.png', x: 48, y: 20, w: 26, dx: 35, dy: -12, r: 25, e: 1 },
  { src: 'green-iron.png', x: 22, y: 37, w: 40, dx: -45, dy: 4, r: -12, e: 1.1 },
  { src: 'dark-blue-chair.png', x: 6, y: 55, w: 34, dx: -48, dy: 15, r: -20, e: 0.95 },
  { src: 'orange-thing.png', x: 30, y: 76, w: 42, dx: 4, dy: 50, r: 8, e: 1.2 },
  { src: 'yellow-bas.png', x: 60, y: 52, w: 33, dx: 42, dy: 12, r: 18, e: 1.05 },
];

// The foundation card: the leaf and the egg continue down, the joyful
// figure and the trumpet come in, the bordeaux cut returns.
const FIBRE: ScrubPiece[] = [
  { src: 'blue-music.png', x: 8, y: 8, w: 40, dx: -45, dy: -10, r: -20, e: 0.9 },
  { src: 'black-leaf.png', x: 62, y: 4, w: 22, dx: 2, dy: -50, r: 18, e: 0.8 },
  { src: 'happy-pink.png', x: 26, y: 26, w: 48, dx: 6, dy: 55, r: 10, e: 1.1 },
  { src: 'yellow-egg.png', x: 8, y: 62, w: 16, dx: -4, dy: -45, r: -25, e: 1.3 },
  { src: 'bordeaux-shape.png', x: 66, y: 66, w: 26, dx: 40, dy: 20, r: 22, e: 1.15 },
];

function StoryScene({
  stars,
  seg,
  children,
}: {
  stars?: Star[];
  seg?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative snap-start overflow-hidden">
      {seg && (
        <DrawnThread
          viewBox="0 0 1000 640"
          d={seg}
          begin={1.05}
          end={0.45}
          className="pointer-events-none absolute inset-0 h-full w-full text-ink/80"
          strokeWidth={2}
        />
      )}
      {stars && <Constellation stars={stars} />}
      <Scene>{children}</Scene>
    </div>
  );
}

export default async function Home() {
  const { mode } = await loadPlans();

  return (
    <main>
      {/* ── The opening: wordmark alone on the white, an invitation down. ── */}
      <section className="relative flex min-h-[100svh] snap-start flex-col items-center justify-center px-6">
        <div id="hero-wordmark-sentinel" className="flex flex-col items-center gap-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-the-thread.svg" alt="The Thread" className="h-16 w-auto md:h-24" />
          <p className="relative left-[30px] text-[13px] font-bold uppercase tracking-[0.22em] text-ink md:text-lg">
            Tools to facilitate change.
          </p>
        </div>
        <a
          href="#story"
          className="absolute bottom-8 flex flex-col items-center gap-2 transition-opacity hover:opacity-60"
          aria-label="Begin the story"
        >
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink-muted">
            Scroll
          </span>
          <svg width="2" height="56" aria-hidden="true" className="text-ink/70">
            <line x1="1" y1="0" x2="1" y2="56" stroke="currentColor" strokeWidth="2" />
          </svg>
        </a>
      </section>

      {/* ── What this is, plainly — Sjoerd's collage compiles with the scroll. ── */}
      <div id="story" />
      <section className="relative flex min-h-[100svh] snap-start flex-col items-center justify-center overflow-hidden px-6 pb-6 pt-16 md:px-10">
        <DrawnThread
          viewBox="0 0 1000 640"
          d={SEG.sway}
          begin={1.05}
          end={0.45}
          className="pointer-events-none absolute inset-0 h-full w-full text-ink/80"
          strokeWidth={2}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">
            Weaving the social fabric.{' '}
            <span className="text-ink-muted">In companies. In society.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-ink-subtle md:text-base">
            The Thread is a set of online tools for people who bring people together. You set up a
            gathering — a workshop, a training, a conference — publish an enrolment page, take
            payment, and stay in touch before, during and after. Enrolments, tickets, messages and
            certificates live in one place, so nothing depends on spreadsheets. Built and hosted in
            the EU.
          </p>
        </div>
        <ScrollCollage
          pieces={FABRIC}
          aspect="17 / 10"
          caption={{ text: "Inspired by Matisse's paper cuts", x: 13, y: 71, rotate: -32 }}
          className="mt-4 md:mt-2"
          style={{ width: 'min(100%, 130svh, 110rem)' }}
        />
      </section>

      {/* ── The workshop: text left, Sjoerd's portrait composition right. ── */}
      <section className="relative flex min-h-[100svh] snap-start items-center overflow-hidden px-6 py-16 md:px-10">
        <DrawnThread
          viewBox="0 0 1000 640"
          d={SEG.swayBack}
          begin={1.05}
          end={0.45}
          className="pointer-events-none absolute inset-0 h-full w-full text-ink/80"
          strokeWidth={2}
        />
        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">The workshop.</h2>
            <p className="mt-6 text-base leading-relaxed text-ink-subtle md:text-lg">
              In the workshop we place tools that support weaving. Weaving is the activity of
              bringing people together — building connection and collaboration.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-subtle md:text-lg">
              <span className="font-semibold text-ink">Meet</span> is the planning tool: schedule
              appointments with people and groups, easily.{' '}
              <span className="font-semibold text-ink">Members</span> organises people into
              memberships — groups and subgroups, engagement, the whole administration.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              More tools are still on the workbench.
            </p>
            <p className="mt-6 text-sm text-ink-subtle">
              <Link href="/workshop" className="underline underline-offset-4 hover:text-ink">
                Step into the workshop →
              </Link>
            </p>
          </div>
          <ScrollCollage
            pieces={WORKSHOP}
            aspect="45 / 78"
            className="mx-auto w-full"
            style={{ width: 'min(100%, 46svh, 26rem)' }}
          />
        </div>
      </section>

      {/* ── The foundation: art left, text right. ── */}
      <section className="relative flex min-h-[100svh] snap-start items-center overflow-hidden px-6 py-16 md:px-10">
        <DrawnThread
          viewBox="0 0 1000 640"
          d={SEG.sway}
          begin={1.05}
          end={0.45}
          className="pointer-events-none absolute inset-0 h-full w-full text-ink/80"
          strokeWidth={2}
        />
        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
          <ScrollCollage
            pieces={FIBRE}
            aspect="1 / 1"
            className="order-last mx-auto w-full md:order-first"
            style={{ width: 'min(100%, 56svh, 30rem)' }}
          />
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
              Underneath it all: The Fibre.
            </h2>
            <p className="mt-6 text-base leading-relaxed text-ink-subtle md:text-lg">
              Every tool in the workshop stands on the same foundation. The Fibre holds your
              contacts and their personal information — with the highest integrity. One contact
              base, hosted in the EU, GDPR by construction.
            </p>
            <p className="mt-4 text-base leading-relaxed text-ink-subtle md:text-lg">
              Each tool sees only the data it can justify, and what a tool doesn&apos;t need, it
              never sees. Nothing is copied around; nothing leaks.
            </p>
          </div>
        </div>
      </section>

      {/* ── The litany, unfolding — one line per breath. ── */}
      <StoryScene seg={SEG.swayBack} stars={CONSTELLATIONS.cut}>
        <Line>
          A gathering is a <Ink>cut</Ink> in time.
        </Line>
      </StoryScene>

      <StoryScene seg={SEG.sway} stars={CONSTELLATIONS.you}>
        <Line>
          <Ink>You</Ink> decide it matters.
        </Line>
      </StoryScene>

      <StoryScene seg={SEG.swayBack} stars={CONSTELLATIONS.shape}>
        <Line>
          You give it a <Ink>shape</Ink>.
        </Line>
      </StoryScene>

      <StoryScene seg={SEG.sway} stars={CONSTELLATIONS.enter}>
        <Line>
          People <Ink>enter</Ink>.
        </Line>
      </StoryScene>

      <StoryScene seg={SEG.swayBack} stars={CONSTELLATIONS.together}>
        <Line>
          The meaning is made <Ink>together</Ink>.
        </Line>
      </StoryScene>

      {/* ── The turn. ── */}
      <StoryScene seg={SEG.sway}>
        <Line>Most event platforms stop at the event.</Line>
      </StoryScene>

      <StoryScene seg={SEG.swayBack}>
        <Line>
          The Thread <Ink>starts there</Ink>.
        </Line>
        <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-ink-subtle md:text-lg">
          A dinner, a workshop, a conference — the moment people enter a room together, something
          becomes possible that wasn&apos;t possible before. The Thread is built to honour that
          moment, and to carry it forward.
        </p>
      </StoryScene>

      {/* ── The arc, grounded. ── */}
      <section className="relative snap-start bg-surface-warm px-6 py-24 md:px-10 md:py-32">
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
                  you want them — payment by card or invoice. Set the conditions for something
                  real to happen.
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
                  and they&apos;re in: the programme, the messages, the room.
                </p>
                <Figure className="mt-6 w-12 self-end text-accent" rotate={8} />
              </div>
            </Settle>
            <Settle from={{ y: 30, rotate: -2 }} delay={240}>
              <div className="flex h-full flex-col rounded-2xl bg-surface-paper p-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink/50">After</p>
                <h3 className="mt-1 text-xl font-bold">Journey</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink/70">
                  Let it keep going. The message that arrives exactly when it should. A
                  certificate that makes the moment durable. The event ends. The thread
                  doesn&apos;t.
                </p>
                <Leaf className="mt-6 w-10 self-end text-ink/70" rotate={16} />
              </div>
            </Settle>
          </div>
          <p className="mt-10 text-sm text-ink-subtle">
            <Link href="/workshop" className="underline underline-offset-4 hover:text-ink">
              The workshop behind it — by facilitators, for facilitators →
            </Link>
          </p>
        </div>
      </section>

      {/* ── Proof, quiet. ── */}
      <section className="snap-start border-y border-line px-6 py-16 md:px-10">
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

      {/* ── The invitation. ── */}
      <StoryScene>
        <Line>
          Start with <Ink>one gathering</Ink>.
        </Line>
        <p className="mx-auto mt-6 max-w-xl text-lg text-ink-subtle">
          Free means free — one live event, forever. When you&apos;re ready for more,
          we&apos;re here.
        </p>
        {mode === 'invited' && (
          <p className="mt-2 text-sm text-ink-muted">Access is by request while we onboard.</p>
        )}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
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
      </StoryScene>
    </main>
  );
}
