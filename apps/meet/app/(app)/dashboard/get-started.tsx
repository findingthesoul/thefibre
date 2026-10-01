'use client';

// The first five minutes in Meet.
//
// Sjoerd, 2026-10-01: "can you build an onboarding. You come there for the
// first time. Take someone through it."
//
// It is a list of what is still missing, not a wizard. Three reasons, and the
// first is the one that decides the shape:
//
// 1. EVERY STEP IS DERIVED, never stored. "Have you connected a calendar" is
//    answered by asking whether there is a token, not by a flag somebody set
//    once. A stored flag is a second copy of the truth, and the copy is the
//    one that goes wrong — you disconnect your calendar and the app still
//    congratulates you for having one. This file holds no state at all.
// 2. A wizard blocks. Somebody who arrived to do one specific thing should be
//    able to do it, and a modal that insists on five steps first is in the
//    way. This sits on the dashboard and waits.
// 3. It LEAVES. When the last step is done the card is gone — not collapsed,
//    not ticked and persisting. An onboarding that stays forever stops being
//    onboarding and becomes furniture.
//
// Each step says what it is FOR, not just what to do. "Connect your calendar"
// is an instruction; "so Meet never offers a time you are already busy" is a
// reason, and a reason is what makes somebody bother.

import Link from 'next/link';
import { Check, ArrowRight } from 'lucide-react';
import { CopyLinkButton, OpenBookingLink } from '@/components/copy-link-button';
import { t, type Locale } from '@/lib/i18n-ui';
import { MEET_HOST } from '@/lib/public-host';

export type GetStartedState = {
  /** The host's own booking-page slug. */
  slug: string | null;
  googleConnected: boolean;
  /** Any working hours at all — the host row starts with none. */
  hasAvailability: boolean;
  meetingTypeCount: number;
  bookingCount: number;
  /** A photo or a few words: a page with neither reads as unfinished. */
  hasProfile: boolean;
};

type Step = {
  key: string;
  done: boolean;
  title: string;
  why: string;
  href: string;
  cta: string;
};

export function GetStarted({
  state,
  locale,
}: {
  state: GetStartedState;
  locale: Locale;
}) {
  const steps: Step[] = [
    {
      key: 'calendar',
      done: state.googleConnected,
      title: t(locale, 'ob_calendar_title'),
      why: t(locale, 'ob_calendar_why'),
      href: '/settings/calendars',
      cta: t(locale, 'ob_calendar_cta'),
    },
    {
      key: 'availability',
      done: state.hasAvailability,
      title: t(locale, 'ob_availability_title'),
      why: t(locale, 'ob_availability_why'),
      href: '/settings/availability',
      cta: t(locale, 'ob_availability_cta'),
    },
    {
      key: 'type',
      done: state.meetingTypeCount > 0,
      title: t(locale, 'ob_type_title'),
      why: t(locale, 'ob_type_why'),
      href: '/meeting-types/new',
      cta: t(locale, 'ob_type_cta'),
    },
    {
      key: 'profile',
      done: state.hasProfile,
      title: t(locale, 'ob_profile_title'),
      why: t(locale, 'ob_profile_why'),
      href: '/settings/profile',
      cta: t(locale, 'ob_profile_cta'),
    },
    {
      key: 'share',
      done: state.bookingCount > 0,
      title: t(locale, 'ob_share_title'),
      why: t(locale, 'ob_share_why'),
      href: state.slug ? `/${state.slug}` : '/meeting-types',
      cta: t(locale, 'ob_share_cta'),
    },
  ];

  const remaining = steps.filter((s) => !s.done);
  // Done is done. The card does not linger as a row of ticks.
  if (remaining.length === 0) return null;

  // The next thing to do, singular. A list of five open tasks is a backlog;
  // one open task with the rest visible behind it is a path.
  const next = remaining[0]!;
  const doneCount = steps.length - remaining.length;

  return (
    <section className="rounded-lg border border-line bg-surface-raised p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-medium">{t(locale, 'ob_title')}</h2>
        <span className="text-xs text-ink-muted">
          {t(locale, 'ob_progress', {
            done: String(doneCount),
            total: String(steps.length),
          })}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-subtle">{t(locale, 'ob_intro')}</p>

      <ol className="mt-4 space-y-2">
        {steps.map((s) => {
          const isNext = s.key === next.key;
          return (
            <li
              key={s.key}
              className={`rounded-lg border p-3.5 ${
                isNext ? 'border-line-strong bg-surface' : 'border-line'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    s.done
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-line text-ink-muted'
                  }`}
                >
                  {s.done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${s.done ? 'text-ink-muted line-through' : 'font-medium'}`}>
                    {s.title}
                  </div>
                  {/* The reason only matters while the step is open. */}
                  {!s.done && (
                    <p className="mt-0.5 text-xs text-ink-subtle">{s.why}</p>
                  )}
                </div>
                {!s.done && (
                  <Link
                    href={s.href}
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-line bg-surface px-3 py-1.5 text-xs font-medium hover:bg-surface-sunken whitespace-nowrap"
                  >
                    {s.cta}
                    <ArrowRight className="h-3 w-3" strokeWidth={1.5} />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* The address itself, as soon as there is anything to send somebody to.
          It is the thing the whole setup is for, so it is shown rather than
          described. */}
      {state.slug && state.meetingTypeCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-sunken px-3 py-2">
          <span className="text-xs text-ink-muted">{t(locale, 'ob_your_page')}</span>
          <code className="text-xs">{`${MEET_HOST}/${state.slug}`}</code>
          <span className="ml-auto flex items-center gap-1">
            <CopyLinkButton
              url={`/${state.slug}`}
              label={t(locale, 'copy_link')}
              copiedLabel={t(locale, 'copied')}
            />
            <OpenBookingLink href={`/${state.slug}`} label={t(locale, 'visit_page')} />
          </span>
        </div>
      )}
    </section>
  );
}
