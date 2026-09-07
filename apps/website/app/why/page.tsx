// Why — and for who. Sjoerd's brief (2026-09-08): very simple and
// straightforward. Simple interface, quick editing, duplicate, fully
// serviced. No poetry on this page; the Home carries the poetry.

import type { Metadata } from 'next';
import { StartButton } from '@/components/start-dialog';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Why The Thread',
  description:
    'For facilitators, trainers and community builders: simple interface, quick editing, duplicate anything, fully serviced.',
};

const WHY: [string, string][] = [
  [
    'Simple interface',
    'You learn it in an afternoon. Everything is where you expect it, and nothing needs a manual.',
  ],
  [
    'Quick editing',
    'Change the programme, the price, the text — the public page updates immediately. No re-publishing dance, no waiting.',
  ],
  [
    'Duplicate anything',
    'Last edition becomes the next one in one click — structure, messages and certificates included. Standard shapes get you started; your own designs join them.',
  ],
  [
    'Fully serviced',
    'Hosting, payments, invoices, automatic messages, certificates, GDPR — handled. You bring the intention; the machinery is our job.',
  ],
  [
    'One place',
    'Enrolments, tickets, messages and money live together. Never five tabs and a spreadsheet again.',
  ],
  [
    'A fair price',
    'Free means free — one live event, forever. Paid plans stay low on purpose.',
  ],
];

export default function WhyPage() {
  return (
    <main className="px-6 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-ink-muted">
          Why — and for who
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">
          For people who bring people together.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-subtle">
          Facilitators, trainers, community builders, organisers — anyone who would rather host
          than administrate. If you run workshops, courses, festivals or memberships, The Thread
          was built for your week.
        </p>

        <div className="mt-14 space-y-8">
          {WHY.map(([title, body]) => (
            <div key={title} className="grid grid-cols-1 gap-2 md:grid-cols-[220px_1fr] md:gap-8">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-[15px] leading-relaxed text-ink-subtle">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap items-center gap-4">
          <StartButton className="rounded-lg bg-accent px-6 py-2.5 text-sm font-bold text-ink transition-all hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(255,221,0,0.35)]">
            Start a Thread
          </StartButton>
          <Link
            href="/pricing"
            className="text-sm text-ink-subtle underline underline-offset-4 hover:text-ink"
          >
            See the pricing →
          </Link>
        </div>
      </div>
    </main>
  );
}
