// YOU — who you are, what language you hear from us in, and how to leave.
//
// Slice 5 of docs/member-portal-plan.md. This was the read-only tab: it
// showed a name with no way to correct it, which is the wrong answer to "my
// name is spelled wrong on my invoice" — that question currently becomes an
// email to an organiser, which is the thing this portal exists to stop.
//
// `ui/profile-form` was the shared candidate and is not the right one: it is
// the ORGANISER's profile — display name, bio, photo, timezone, the face a
// workspace sees. A member has none of that. What they have is a name that
// several communities hold copies of, and a language.

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ENTITY, surfaceUrl } from '@thefibre/shared';
import { headers } from 'next/headers';
import { reachableApps } from '@/lib/app-access';
import { Suspense } from 'react';
import {
  loadCalendarStatus,
  loadDirectoryChoices,
  loadProfile,
  loadSession,
} from '@/lib/session';
import { VERSION } from '@/lib/version';
import { SignedOut } from '../signed-out';
import { PageShell } from '../page-shell';
import { DetailsForm } from './details-form';
import { BillingCard } from './billing-card';
import { CalendarCard } from './calendar-card';
import { DirectoryCard } from './directory-card';
import { NotifyCard } from './notify-card';
import { YouTabs } from './you-tabs';
import { YOU_TABS, type YouTab } from './tabs';
import { ProductRenewals, Renewals } from '../purchases/renewals';
import { fetchNotifyPrefs, fetchRenewals } from '@/lib/portal-api';
import { ErasureBody, ErasureFallback } from './erasure-section';
import { SignOutButton } from './sign-out-button';
import type { Locale } from '@thefibre/shared/i18n';
import { pageLocale } from '@/lib/locale';
import { t } from '@/lib/i18n';
import { parts } from '@/lib/i18n-parts';

export const dynamic = 'force-dynamic';

export default async function YouPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await loadSession();
  if (!session) return <SignedOut />;

  // TABS (Sjoerd, 2026-10-16: the page "has become highly complicated").
  // One tab at a time, each a deep link; an unknown or missing tab is the
  // Profile, never a blank page. Each panel fetches only what it shows.
  const requested = (await searchParams).tab;
  const locale = await pageLocale();
  const tab: YouTab = (YOU_TABS as readonly string[]).includes(requested ?? '') ? (requested as YouTab) : 'profile';

  return (
    <PageShell title={t(locale, 'nav_you')}>
      <YouTabs value={tab} />
      {tab === 'profile' && <ProfilePanel person={session.portal.person} locale={locale} />}
      {tab === 'memberships' && <MembershipsPanel token={session.token} locale={locale} />}
      {tab === 'billing' && <BillingPanel locale={locale} />}
      {tab === 'notifications' && <NotificationsPanel token={session.token} />}
      {tab === 'privacy' && <PrivacyPanel locale={locale} />}

      <p className="mt-12 text-xs text-ink-muted">
        {ENTITY.publicName} · v{VERSION}
      </p>
    </PageShell>
  );
}

type PortalPerson = { first_name?: string | null; last_name?: string | null; email: string };

/** Who you are, and whether other members can find you. */
async function ProfilePanel({ person, locale }: { person: PortalPerson; locale: Locale }) {
  const [profile, directory] = await Promise.all([
    loadProfile(),
    // Empty when there are no communities OR when the call failed; the
    // section is omitted either way, because a privacy switch showing a state
    // we are not sure of is worse than no switch.
    loadDirectoryChoices(),
  ]);
  return (
    <>
      {profile ? (
        <DetailsForm profile={profile} />
      ) : (
        // The details call failed. Show what the portal payload already knows
        // rather than an error where a name should be — and say plainly that
        // editing is the part that is missing, not the person.
        <>
          <dl className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {(person.first_name || person.last_name) && (
              <div className="flex items-baseline justify-between gap-4 px-4 py-3">
                <dt className="shrink-0 text-sm text-ink-muted">{t(locale, 'f_name')}</dt>
                <dd className="min-w-0 truncate text-sm text-ink">
                  {[person.first_name, person.last_name].filter(Boolean).join(' ')}
                </dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt className="shrink-0 text-sm text-ink-muted">{t(locale, 'f_email')}</dt>
              <dd className="min-w-0 truncate text-sm text-ink">{person.email}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-muted">
            {t(locale, 'editing_unreachable')}
          </p>
        </>
      )}
      {directory === null ? (
        // Say it. An omitted section looks like a page with nothing on it.
        <section className="mt-8">
          <h2 className="text-sm font-medium text-ink">{t(locale, 'dir_title')}</h2>
          <p className="mt-2 rounded-2xl border border-line bg-surface px-4 py-3 text-xs text-ink-subtle">
            {t(locale, 'dir_failed')}
          </p>
        </section>
      ) : (
        directory.length > 0 && <DirectoryCard choices={directory} />
      )}
    </>
  );
}

/** What renews — memberships and products on their own — stopped or resumed
 *  here; every invoice is under Purchases. */
async function MembershipsPanel({ token, locale }: { token: string; locale: Locale }) {
  const renewals = await fetchRenewals(token);
  const none = renewals && !renewals.memberships.length && !renewals.products.length;
  return (
    <>
      {renewals === null && (
        <p className="mt-8 rounded-2xl border border-line bg-surface px-4 py-3 text-xs text-ink-subtle">
          {t(locale, 'mships_failed')}
        </p>
      )}
      {renewals && <Renewals items={renewals.memberships} />}
      {renewals && <ProductRenewals items={renewals.products} />}
      {none && <p className="mt-8 text-sm text-ink-muted">{t(locale, 'nothing_renews')}</p>}
      <p className="mt-8 text-sm text-ink-muted">
        {parts(t(locale, 'every_invoice_under'), {
          link: (
            <Link href="/purchases" className="text-ink underline underline-offset-2 hover:opacity-70">
              {t(locale, 'nav_purchases')}
            </Link>
          ),
        })}
      </p>
    </>
  );
}

/** The details your invoices carry. */
async function BillingPanel({ locale }: { locale: Locale }) {
  const profile = await loadProfile();
  return profile?.billing_details ? (
    <BillingCard details={profile.billing_details} locale={locale} />
  ) : (
    <p className="mt-8 text-sm text-ink-muted">
      {profile ? t(locale, 'billing_none') : t(locale, 'billing_failed')}
    </p>
  );
}

/** What we tell you, and the calendar that follows along. */
async function NotificationsPanel({ token }: { token: string }) {
  const [calendar, notifyPrefs] = await Promise.all([
    loadCalendarStatus(),
    // Null when the call failed: the section is then omitted rather than
    // showing switches in a state we are not sure of.
    fetchNotifyPrefs(token),
  ]);
  return (
    <>
      <CalendarCard status={calendar} />
      {notifyPrefs && <NotifyCard prefs={notifyPrefs} />}
      {/* SLOT for builder 5's per-device push opt-in: <PushCard /> from
          apps/my/app/push-card.tsx (no props, a button, never a prompt on
          load) goes here, below the email switch, once that file exists. */}
    </>
  );
}

/** Your data, and the way out. */
async function PrivacyPanel({ locale }: { locale: Locale }) {
  const apps = await headers().then((h) => reachableApps(h.get('host')));
  // Label derived from the resolved href, not from the constant: on staging
  // this page is my.thefibre.tech and a link reading "thethread.app" would be
  // telling the visitor they are somewhere they are not.
  const siteUrl = surfaceUrl('website', process.env, (await headers()).get('host'));
  return (
    <>
      {/* Below the calendar and above the way out — last of the things you
          DO here, which is where a page puts the one you hope nobody needs.
          Omitted entirely when the picture could not be read: offering a
          right we cannot describe accurately is worse than not offering it
          on this page, since the privacy policy carries it either way. */}
      {/* Streams. The page does not wait for it; the shape holds its place
          until it lands, and a PENDING request still appears without anybody
          having to click — which is the whole reason it is not deferred to a
          click. */}
      <Suspense fallback={<ErasureFallback />}>
        <ErasureBody />
      </Suspense>

      {/* The way back — and, since 2026-09-25, a sentence saying what it is.
          Debbie signed in, could only reach this page, pressed this button and
          landed on the marketing homepage. Everything behaved as designed: she
          holds no seat anywhere, so there is no app for her to enter. What was
          missing was anybody telling her that. A button whose destination
          surprises you is a button that reads as a fault in the product.

          Only for people with no apps. Someone who HAS a seat gets the
          switcher in the header instead, which goes somewhere they can use. */}
      {apps.length === 0 && (
        <p className="mt-10 border-t border-line pt-6 text-sm text-ink-muted">
          {t(locale, 'not_organiser_note')}
        </p>
      )}
      <div className={`${apps.length === 0 ? 'mt-6' : 'mt-10 border-t border-line pt-6'}`}>
        {/* A BUTTON, not a link. It shipped as small underlined text and
            Sjoerd asked for it a second time — "button to go back to
            thethread" — which is the answer to whether an underline at the
            bottom of a page reads as a way out. Full width on a phone, where
            this page is read one-handed and the thumb is nowhere near a
            17px target. */}
        <a
          href={siteUrl}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface px-5 text-sm font-medium text-ink hover:bg-surface-sunken sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t(locale, 'back_to', { site: siteUrl.replace(/^https?:\/\//, '') })}
        </a>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 border-t border-line pt-6">
        <SignOutButton />
        {/* The manual, one link, beside the way out: both are things you look
            for once rather than live in. */}
        <Link
          href="/help"
          className="min-h-11 inline-flex items-center text-sm text-ink-subtle underline underline-offset-4 hover:text-ink"
        >
          {t(locale, 'help')}
        </Link>
      </div>

    </>
  );
}
