// The workshop — the product tour organised by the arc, replacing V3's
// engineer-voiced /features. Verbs, not nouns; the tools appear as what the
// workshop can do, never as named products (naming brief B).

import type { Metadata } from 'next';
import { Settle } from '@/components/settle';
import { Burst, Figure, Leaf, Vessel } from '@/components/shapes';
import { startHref } from '@/lib/site';

export const metadata: Metadata = {
  title: 'The workshop',
  description:
    'The product tour, organised by the arc: give it a shape, run it beautifully, let it keep going.',
};

const MOVEMENTS = [
  {
    phase: 'Before',
    title: 'Give it a shape',
    shape: <Vessel className="w-16 text-accent" rotate={-6} />,
    lines: [
      'A timeline you compose — sessions, one-to-ones, messages, moments of practice — eight kinds of engagement, arranged like a score.',
      'An enrolment page that needs no login. Your guests open it, read it in their own language, and join.',
      'Tickets when you want them, discounts when you offer them, approval when a journey needs a doorkeeper.',
      'Payment by card or by invoice — both first-class, both landing in one honest ledger.',
      'Templates, so the second edition starts where the first one ended.',
    ],
  },
  {
    phase: 'During',
    title: 'Run it beautifully',
    shape: <Figure className="w-14 text-ink" rotate={6} />,
    lines: [
      'Your guests don’t download anything. A page on their phone that feels like care, not admin — the programme, the messages, the room.',
      'Check-in with a QR code. The guest list that is simply correct.',
      'The meetings get scheduled — booking pages and invitations that keep one calendar telling the truth.',
      'Materials in one place, messages in one voice — the journey’s voice, not a noreply.',
    ],
  },
  {
    phase: 'After',
    title: 'Let it keep going',
    shape: <Leaf className="w-12 text-ink" rotate={14} />,
    lines: [
      'Messages that trigger themselves — on enrolment, on approval, on completion, or simply at the right moment on the right day.',
      'Reflection and practice between gatherings, so the learning doesn’t end at the door.',
      'A certificate is not a PDF. It’s a moment made durable — designed, issued, verified, shared to LinkedIn if they’re proud of it. They usually are.',
      'Every participant keeps their own page: the whole trail of where they’ve been with you, and what comes next.',
    ],
  },
  {
    phase: 'Underneath',
    title: 'Quietly',
    shape: <Burst className="w-12 text-accent" />,
    lines: [
      'Hosted in the EU. Private by construction — your guests’ data is theirs, and export and erasure actually work. We built the whole thing that way, because we’d want it built that way for us.',
      'Embeds for your own website: one script, your styling, your domain stays yours.',
      'An API for your developers — documented, versioned, boring in the best way.',
    ],
    link: { href: 'https://thefibre.app', label: 'For the technical reader →' },
  },
];

export default function WorkshopPage() {
  return (
    <main className="px-6 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">The workshop</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-subtle">
          Everything here serves the arc — before, during, after. The tools have names, but you
          won&apos;t need them; you&apos;ll ask for what you want in plain words, and the workshop
          will do it.
        </p>
      </div>

      <div className="mx-auto mt-16 max-w-2xl space-y-20">
        {MOVEMENTS.map((m, i) => (
          <Settle key={m.phase} from={{ y: 24, rotate: i % 2 ? 1 : -1 }}>
            <section>
              <div className="flex items-end justify-between gap-6">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-ink-muted">
                    {m.phase}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">{m.title}</h2>
                </div>
                {m.shape}
              </div>
              <ul className="mt-6 space-y-4 border-l-2 border-accent pl-6">
                {m.lines.map((line) => (
                  <li key={line} className="text-base leading-relaxed text-ink-subtle">
                    {line}
                  </li>
                ))}
              </ul>
              {m.link && (
                <p className="mt-4 pl-6 text-sm">
                  <a href={m.link.href} className="text-ink-subtle underline underline-offset-4 hover:text-ink">
                    {m.link.label}
                  </a>
                </p>
              )}
            </section>
          </Settle>
        ))}
      </div>

      <div className="mx-auto mt-24 max-w-2xl border-t border-line pt-10 text-center">
        <p className="text-lg font-medium">You bring the intention. The Thread holds the rest.</p>
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
