import type { Metadata } from 'next';
import { Figure } from '@/components/shapes';
import { CONTACT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Write to hello@thethread.app — or invite us into a conversation about your gathering.',
};

export default function ContactPage() {
  return (
    <main className="relative overflow-hidden px-6 py-24 md:px-10 md:py-36">
      <Figure className="pointer-events-none absolute right-[10%] top-16 hidden w-24 text-accent md:block" rotate={12} />
      <div className="mx-auto max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Talk to us</h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-subtle">
          The best conversations about gatherings are gatherings. Tell us what you&apos;re weaving —
          a festival, a fellowship, a course, a community — and we&apos;ll walk through it with you.
          A person answers, usually the one who built the thing.
        </p>
        <p className="mt-8">
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-2xl font-light underline decoration-accent decoration-4 underline-offset-8 transition-opacity hover:opacity-70"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-10 text-sm text-ink-muted">
          Enterprise is deliberately a conversation, not a checkout. This is where it starts.
        </p>
      </div>
    </main>
  );
}
