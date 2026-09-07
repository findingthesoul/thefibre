// Home — an unfolding story (Sjoerd's direction, 2026-09-07, after
// counder.com): one sentence per viewport, the key word inked; a single
// thread drawing itself down the whole page; Matisse cut-outs gathering
// like a constellation as the story fills with people. The litany IS the
// story — each line becomes a scene, and the shapes accumulate: one cut,
// then a few, then a gathering, then the whole fabric.

import Link from 'next/link';
import { Scene, Line, Ink } from '@/components/scene';
import { ScrollCue } from '@/components/scroll-cue';
import { ScrollCollage, type ScrubPiece } from '@/components/scroll-collage';
import { DrawnThread } from '@/components/drawn-thread';
import { Settle } from '@/components/settle';
import { Figure, Leaf, Vessel } from '@/components/shapes';
import { loadPlans } from '@/lib/plans';
import { startHref } from '@/lib/site';

// The thread runs down the page's centre: every segment enters top-centre
// and leaves bottom-centre, so the per-scene segments read as ONE line.
// One thread, fallen on a long white paper (Sjoerd, 2026-09-07): it lies
// left, right or centre of the page, curls here and there, and each
// segment ends exactly where the next begins — one line from the hero to
// the final hook on the invitation card. Not a decorative swirl; a thread.
const THREAD = {
  hero: 'M150 0 C145 130 168 250 152 370 C142 460 172 550 180 640',
  fabric: 'M180 0 C175 110 240 210 350 300 C480 410 630 500 700 640',
  moment: 'M700 0 C695 110 638 200 658 300 C678 400 706 520 700 640',
  workshop:
    'M700 0 C705 110 640 190 585 255 C530 320 470 330 490 385 C510 440 610 420 590 355 C575 305 470 400 420 460 C370 520 300 560 280 640',
  fibre: 'M280 0 C270 130 310 260 285 380 C265 480 228 540 220 640',
  starts: 'M220 0 C215 130 290 250 380 340 C460 425 545 530 560 640',
  arc: 'M560 0 C565 110 620 200 650 300 C685 410 715 520 720 640',
  proof: 'M720 0 C725 130 690 260 705 380 C715 470 685 550 680 640',
  invite:
    'M680 0 C685 110 650 200 640 290 C630 370 560 400 580 450 C600 495 660 470 645 425 C635 395 600 430 610 470',
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
  seg,
  cue,
  cueColor,
  bottomSlot,
  children,
}: {
  seg?: string;
  cue?: number;
  cueColor?: string;
  bottomSlot?: React.ReactNode;
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
      <Scene>{children}</Scene>
      {cue !== undefined && <ScrollCue x={cue} color={cueColor} />}
      {bottomSlot}
    </div>
  );
}

export default async function Home() {
  const { mode } = await loadPlans();

  return (
    <main>
      {/* ── The opening: wordmark alone on the white, an invitation down. ── */}
      <section className="relative flex min-h-[100svh] snap-start flex-col items-center justify-center overflow-hidden px-6">
        <DrawnThread
          viewBox="0 0 1000 640"
          d={THREAD.hero}
          begin={1.05}
          end={0.45}
          className="pointer-events-none absolute inset-0 h-full w-full text-ink/80"
          strokeWidth={2}
        />
        <div id="hero-wordmark-sentinel" className="flex flex-col items-center gap-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-the-thread.svg" alt="The Thread" className="h-16 w-auto md:h-24" />
          <p className="relative left-[30px] text-[13px] font-bold uppercase tracking-[0.22em] text-ink md:text-lg">
            Tools to facilitate change.
          </p>
        </div>
        <ScrollCue x={18} />
      </section>

      {/* ── What this is, plainly — Sjoerd's collage compiles with the scroll. ── */}
      <div id="story" />
      <section className="relative flex h-[100svh] snap-start flex-col items-center justify-start overflow-hidden px-6 pb-6 pt-40 md:px-20">
        <DrawnThread
          viewBox="0 0 1000 640"
          d={THREAD.fabric}
          begin={1.05}
          end={0.45}
          className="pointer-events-none absolute inset-0 h-full w-full text-ink/80"
          strokeWidth={2}
        />
        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 md:gap-16">
          <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">
            Weaving the social fabric.{' '}
            <span className="text-ink-muted">In companies. In society.</span>
          </h2>
          <p className="text-sm leading-relaxed text-ink-subtle md:text-base">
            The Thread is a set of online tools for people who bring people together. You set up a
            gathering — a workshop, a hackathon, a festival — publish an enrolment page, take
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
        <ScrollCue x={70} color="#ee7d1a" />
      </section>

      {/* ── The turn: a moment vs a journey. ── */}
      <StoryScene seg={THREAD.moment} cue={70} cueColor="#8e2f55">
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-16">
          <Line>
            An event is a <Ink>moment</Ink>. It starts, and it stops.
          </Line>
          <div className="md:mt-2">
            <p className="text-2xl font-semibold leading-tight tracking-tight text-ink-muted md:text-4xl">
              A thread is there to weave moments together — into a <Ink>journey</Ink>.
            </p>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-subtle md:text-lg">
              Every encounter matters — the facilitator knows this. When every moment of contact
              is curated, the experience becomes a learning journey.
            </p>
          </div>
        </div>
      </StoryScene>

      {/* ── The workshop: text left, Sjoerd's portrait composition right. ── */}
      <section className="relative flex min-h-[100svh] snap-start items-center overflow-hidden px-6 py-16 md:px-20">
        <DrawnThread
          viewBox="0 0 1000 640"
          d={THREAD.workshop}
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
              bringing people together — building connection and collaboration: in a meeting, at a
              party, across a learning process that runs for months.
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
        <ScrollCue x={28} color="#2153c6" />
      </section>

      {/* ── The foundation: art left, text right. ── */}
      <section className="relative flex min-h-[100svh] snap-start items-center overflow-hidden px-6 py-16 md:px-20">
        <DrawnThread
          viewBox="0 0 1000 640"
          d={THREAD.fibre}
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
        <ScrollCue x={22} color="#d62d94" />
      </section>

      <StoryScene seg={THREAD.starts} cue={56} cueColor="#2f5d49">
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-16">
          <Line>
            The Thread <Ink>starts there</Ink>.
          </Line>
          <p className="text-base leading-relaxed text-ink-subtle md:mt-2 md:text-lg">
            A dinner, a forum, a large-scale intervention — the moment people enter a room together, something
            becomes possible that wasn&apos;t possible before. The Thread is built to honour that
            moment, and to carry it forward.
          </p>
        </div>
      </StoryScene>

      {/* ── The arc, grounded. ── */}
      <section className="relative snap-start overflow-hidden bg-surface-warm px-6 py-24 md:px-20 md:py-32">
        <DrawnThread
          viewBox="0 0 1000 640"
          d={THREAD.arc}
          begin={1.05}
          end={0.45}
          className="pointer-events-none absolute inset-0 h-full w-full text-ink/80"
          strokeWidth={2}
        />
        <div className="relative mx-auto max-w-6xl">
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
        <ScrollCue x={72} color="#d99c1e" />
      </section>

      {/* ── Proof, quiet. ── */}
      <section className="relative snap-start overflow-hidden border-y border-line px-6 py-16 md:px-20">
        <DrawnThread
          viewBox="0 0 1000 640"
          d={THREAD.proof}
          begin={1.05}
          end={0.45}
          className="pointer-events-none absolute inset-0 h-full w-full text-ink/80"
          strokeWidth={2}
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
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
        <ScrollCue x={68} color="#1d3057" />
      </section>

      {/* ── The invitation. ── */}
      <StoryScene
        seg={THREAD.invite}
        bottomSlot={
          <a
            href={startHref('free')}
            className="absolute bottom-10 z-10 rounded-lg bg-accent px-6 py-2.5 text-[13px] font-bold text-ink transition-all hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(255,221,0,0.35)]"
            style={{ left: 'calc(61% + 16px)' }}
          >
            Start a Thread
          </a>
        }
      >
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-2 md:gap-16">
          <Line>
            Start with <Ink>one gathering</Ink>.
          </Line>
          <div className="md:mt-2">
            <p className="text-lg text-ink-subtle">
              Free means free — one live event, forever. When you&apos;re ready for more,
              we&apos;re here.
            </p>
            {mode === 'invited' && (
              <p className="mt-2 text-sm text-ink-muted">Access is by request while we onboard.</p>
            )}
            <div className="mt-9 flex flex-wrap items-center gap-4">
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
        </div>
      </StoryScene>
    </main>
  );
}
