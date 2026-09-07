// About — the Matisse essay, ported from the V3 site nearly untouched (it
// is the best writing in the house; the voice bar for everything else).
// Changes: server component, tokens instead of hex, site chrome owns
// nav/footer, + the two-sentence "who makes this" and the closing
// invitation. The hero borrows nothing — Home carries the litany; here it
// remains the coda, and repetition is a feature of this voice.

import type { Metadata } from 'next';
import { ENTITY } from '@thefibre/shared';
import { StartButton } from '@/components/start-dialog';
import { Leaf, Vessel } from '@/components/shapes';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Inspired by Matisse: drawing with scissors, the invisible thread between people, and why we build this.',
};

export default function AboutPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-16 pt-14 md:px-10 md:pt-20">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-the-thread.svg" alt="The Thread" className="h-12 w-auto md:h-16" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/payoff.svg" alt="For weaving the social fabric." className="mb-1 hidden h-4 w-auto md:block" />
          </div>
          <p className="mt-10 max-w-xl text-xl font-light leading-relaxed md:text-2xl">
            The power lies in the authentic, simple act of making something. Of giving shape and
            form without hesitation. Spontaneity as the true power of the human spirit. The thread
            facilitates humans meeting in this form: with spontaneity, with confidence, with love.
          </p>
        </div>
        <Vessel className="pointer-events-none absolute -right-8 top-16 hidden w-32 text-surface-paper md:block" rotate={10} />
      </section>

      {/* Intro */}
      <section className="mx-auto max-w-2xl px-6 pb-16 md:px-10">
        <p className="mb-6 text-base font-medium leading-relaxed md:text-lg">
          Most event platforms stop at the event. The Thread starts there.
        </p>
        <p className="mb-5 text-base leading-relaxed text-ink-subtle">
          We believe that every gathering — a dinner, a workshop, a conference, a community meetup
          — is not an end in itself. It is a beginning. The moment people enter a room together,
          something becomes possible that wasn&apos;t possible before. A connection forms. An idea
          surfaces. A community takes shape. The Thread is the platform built to honour that
          moment — and to carry it forward.
        </p>
        <p className="mb-5 text-base leading-relaxed text-ink-subtle">
          For the organiser, The Thread makes the entire arc simple and beautiful: from the first
          intention to the last follow-up. For the guest, it transforms attendance into
          participation — in something that continues growing long after the event ends. For the
          community, it creates a living record of shared experience, shared learning, shared
          becoming.
        </p>
        <p className="text-base leading-relaxed text-ink-subtle">
          The Thread is for individuals, communities, and companies who believe that how you bring
          people together is as important as why. Who understand that the most valuable thing an
          event produces is not a moment — it is a thread between people that keeps on connecting.
        </p>
      </section>

      {/* Before / During / After */}
      <section className="mx-auto max-w-3xl px-6 pb-20 md:px-10">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-2xl bg-accent p-8">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/50">Before</p>
            <h3 className="mb-3 text-xl font-bold">Intention</h3>
            <p className="text-sm leading-relaxed text-ink/70">
              Create with purpose. Curate your audience. Set the conditions for something real to
              happen.
            </p>
          </div>
          <div className="rounded-2xl bg-ink p-8">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white/60">During</p>
            <h3 className="mb-3 text-xl font-bold text-white">Experience</h3>
            <p className="text-sm leading-relaxed text-white/80">
              Run events that feel considered. Beautiful, effortless, entirely yours.
            </p>
          </div>
          <div className="rounded-2xl bg-surface-paper p-8">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink/50">After</p>
            <h3 className="mb-3 text-xl font-bold">Journey</h3>
            <p className="text-sm leading-relaxed text-ink/70">
              Follow-up, reflect, grow. The event ends. The learning and connection continue.
            </p>
          </div>
        </div>
      </section>

      {/* Matisse */}
      <section className="mx-auto max-w-2xl px-6 pb-16 md:px-10">
        <h2 className="mb-6 text-xl font-bold tracking-tight md:text-2xl">Inspired by Matisse</h2>
        <p className="mb-5 text-base leading-relaxed text-ink-subtle">
          In the last years of his life, Henri Matisse could no longer paint. Confined to his bed,
          he picked up scissors instead. He called it drawing with scissors — cutting directly into
          colour, without underdrawing, without hesitation, without revision. Each shape made in a
          single unbroken gesture. The constraint became the liberation.
        </p>
        <blockquote className="my-8 border-l-4 border-accent pl-6">
          <p className="text-lg italic leading-relaxed md:text-xl">
            &ldquo;The power lies in the authentic, simple act of making something. Of giving shape
            and form without hesitation. Spontaneity as the true power of the human spirit.&rdquo;
          </p>
        </blockquote>
        <p className="mb-5 text-base leading-relaxed text-ink-subtle">
          What Matisse understood — and what The Thread is built on — is that the most direct act
          is also the most powerful one. That simplicity is not the absence of depth, but its
          precondition. That confidence and care, applied together, produce something that endures.
        </p>
        <p className="mb-5 text-base leading-relaxed text-ink-subtle">
          The shapes you see throughout The Thread — vessels, botanicals, figures, gestures — are
          cut from painted paper in the tradition of Matisse&apos;s Jazz series. Each one a single
          form, complete in itself, part of an infinite system. Colours that carry meaning. Shapes
          that suggest without illustrating. A visual language that is simultaneously bold and
          quiet.
        </p>
        <p className="mb-5 text-base leading-relaxed text-ink-subtle">
          In Matisse&apos;s cut-outs, the shapes float apart — bold, coloured, present. What
          connects them is unseen but felt. Your eye traces an invisible line from one form to
          another. The composition holds because of what isn&apos;t there. This is exactly how
          people gather. You can see the individuals. You cannot see what connects them.
        </p>
        <p className="text-base leading-relaxed text-ink-subtle">
          The thread is the invisible thing. A thought, an intention, an act of care. The platform
          gives it a shape. The journey does the rest.
        </p>
      </section>

      {/* Five blocks + the litany */}
      <section className="bg-surface-paper py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-6 md:px-10">
          <div className="grid grid-cols-1 gap-x-14 gap-y-10 md:grid-cols-2">
            {[
              ['The cut', 'Matisse picked up scissors when he could no longer paint. Bedridden, stripped of everything except the most essential gesture, he made his most joyful work. The constraint became the liberation. One cut. No hesitation. No revision. The shape was already there; he only revealed it.'],
              ['The encounter', 'A human encounter is a cut in time. You decide it matters. You give it a shape. People enter. The meaning is made together. Before the event, everything is potential, undifferentiated, painted but uncut. The gathering is the gesture that reveals the form hiding inside ordinary time.'],
              ['The form', 'He called it drawing with scissors: cutting directly into living colour. No underdrawing, no correction. The gesture and the form were the same act. What made the cuts extraordinary was not their simplicity but their confidence. Each shape made in a single unbroken movement.'],
              ['The system', "Matisse's vocabulary was finite: leaf, body, bowl, gesture. Yet the compositions were infinite, never exhausted, always surprising. The Thread works the same way. The same people, the same city, the same occasions — endlessly recombined. No gathering is the same twice. The social fabric is always being woven."],
              ['The white', 'The white ground was never empty. It was the silence between notes: active, necessary, as deliberate as the shapes themselves. The shapes only exist because of what surrounds them. The ordinary makes the extraordinary visible.'],
            ].map(([title, text]) => (
              <div key={title}>
                <h3 className="mb-2 text-[13px] font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-subtle">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 border-t border-ink/10 pt-10">
            <div className="space-y-0.5">
              {[
                'A gathering is a cut in time.',
                'You decide it matters.',
                'You give it a shape.',
                'People enter.',
                'The meaning is made together.',
              ].map((line) => (
                <p key={line} className="text-base font-semibold md:text-lg">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Who makes this + invitation */}
      <section className="relative mx-auto max-w-2xl px-6 py-20 md:px-10">
        <Leaf className="pointer-events-none absolute -left-4 top-8 hidden w-16 text-accent md:block" rotate={-20} />
        <h2 className="text-xl font-bold tracking-tight">Who makes this</h2>
        <p className="mt-4 text-base leading-relaxed text-ink-subtle">
          The Thread is made by {ENTITY.name} in Rotterdam — a small team that hosts its own
          gatherings and builds the tool it wished existed. Everything is {ENTITY.hostedLine.toLowerCase()},
          because how you treat people&apos;s data is part of how you treat people.
        </p>
        <div className="mt-10">
          <StartButton className="inline-block rounded-full bg-ink px-7 py-3 text-sm font-bold text-white transition-all hover:-translate-y-px hover:shadow-lg">Start a Thread</StartButton>
        </div>
      </section>
    </main>
  );
}
