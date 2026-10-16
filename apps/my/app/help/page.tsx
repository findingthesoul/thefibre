// HELP — the manual, task by task, for the person holding a ticket.
//
// The organiser apps get `HelpPage` from `@thefibre/shared/ui/help`: sidebar
// sections, the rest of the family, a link to how the platform works. None of
// that furniture belongs here — a member has no sidebar, no workspace and no
// other apps to be told about. What they have is six things they might want
// to do and cannot guess, so this is those six, in this app's own page shell,
// using the shared guide shape so the format cannot drift from the family's.
//
// Strings are plain English, like every other page in this app: the portal
// has no string catalog at all (checked 2026-09-27 — You, Next, Memberships
// and Purchases are all hard-coded English). When one arrives, these move
// with the rest.
//
// Renders for signed-out visitors too, on purpose: the first guide is how to
// sign in.

import Link from 'next/link';
import { guideSteps, type HelpGuide } from '@thefibre/shared/ui/help';
import { PageShell } from '../page-shell';
import type { Locale } from '@thefibre/shared/i18n';
import { pageLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';

// Written from the screens, not from a plan: every button named below is the
// label on the page it links to. If a label changes, change it here too.
// The guides' words are in lib/i18n.ts (help_*), in all six languages; this
// keeps only which guide comes first and where its "Open" goes.
const GUIDES: { key: 'signin' | 'ticket' | 'calendar' | 'install' | 'memberships' | 'files' | 'purchases'; href: string }[] = [
  { key: 'signin', href: '/' },
  { key: 'ticket', href: '/' },
  { key: 'calendar', href: '/you' },
  { key: 'install', href: '/' },
  { key: 'memberships', href: '/purchases' },
  { key: 'files', href: '/files' },
  { key: 'purchases', href: '/purchases' },
];

function guides(locale: Locale): HelpGuide[] {
  return GUIDES.map((g) => ({
    title: t(locale, `help_${g.key}_title`),
    href: g.href,
    steps: guideSteps(t(locale, `help_${g.key}_steps`)),
  }));
}

export default async function HelpPage() {
  const locale = await pageLocale();
  return (
    <PageShell title={t(locale, 'help')} subtitle={t(locale, 'tagline')}>
      <section className="mt-8">
        <h2 className="text-[10px] uppercase tracking-wider text-ink-muted">{t(locale, 'help_how_to')}</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {guides(locale).map((g) => (
            <article
              key={g.title}
              className="flex flex-col rounded-2xl border border-line bg-surface p-4"
            >
              <h3 className="text-sm font-medium text-ink">{g.title}</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-subtle">
                {g.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
              {g.href && (
                <Link
                  href={g.href}
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-ink underline-offset-4 hover:underline"
                >
                  {t(locale, 'help_open')}
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* The one thing this page cannot answer. A booking belongs to whoever
          made the programme, and their name is on every row of Next. */}
      <p className="mt-10 border-t border-line pt-6 text-sm text-ink-muted">
        {t(locale, 'help_organiser_note')}
      </p>
    </PageShell>
  );
}
