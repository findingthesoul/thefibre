import Link from 'next/link';
import { APPS, ENTITY, appUrl } from '@thefibre/shared';

// Public documentation for the Zoom integration. Zoom's Marketplace review
// requires a Documentation URL pointing at a page about the integration
// itself — their most common rejection is "user documentation insufficient" —
// and it wants the three sections below by name: adding the app, using it,
// removing it. The submission packet (docs/zoom-marketplace-submission.md)
// points here.
//
// Public on purpose: it lives outside the (app) group, so no session is
// needed — a Zoom reviewer must be able to read it signed out.

export const metadata = {
  title: 'Zoom integration — Meet',
  description:
    'How Meet connects to Zoom: what it creates on your account, which permissions it asks for, and how to remove it.',
};

export default function ZoomDocsPage() {
  const support = ENTITY.supportEmail;
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            {APPS['fibre-meet'].name} — {ENTITY.publicName}
          </p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight">Zoom integration</h1>
          <p className="mt-2 text-sm text-neutral-500">Last updated: 8 September 2026</p>

          <p className="mt-6 text-[15px] leading-relaxed text-neutral-700">
            Meet is the scheduling tool of {ENTITY.publicName}. Hosts publish bookable
            links; participants pick a time. A host can connect their own Zoom account so
            that any meeting type set to Zoom creates a real Zoom meeting on their account
            when someone books — the join link then travels into the calendar event, the
            confirmation email and the booking page, so nobody has to paste a link
            anywhere. This page covers adding the integration, what it does while
            connected, and how to remove it.
          </p>

          <Section id="adding" title="Adding the app">
            <ol className="mt-4 space-y-2 list-decimal pl-5 text-[15px] leading-relaxed text-neutral-700">
              <li>
                Sign in to Meet at{' '}
                <a href={appUrl('fibre-meet', {})} className="underline underline-offset-2">
                  {appUrl('fibre-meet', {}).replace('https://', '')}
                </a>
                .
              </li>
              <li>
                Open{' '}
                <Link href="/settings/integrations" className="underline underline-offset-2">
                  Settings → Integrations
                </Link>
                .
              </li>
              <li>
                Click <strong>Connect Zoom</strong>. Zoom shows its own consent screen,
                listing the permissions below.
              </li>
              <li>
                Click <strong>Allow</strong>. You land back on the same page, which now
                shows the connected Zoom account&apos;s email and a{' '}
                <strong>Disconnect</strong> button.
              </li>
            </ol>
            <p className="mt-4 text-[15px] leading-relaxed text-neutral-700">
              You need a Zoom account of your own — the meetings are created on it. Any
              plan works, including free. Your participants need nothing.
            </p>

            <h3 className="mt-8 text-base font-medium">Permissions requested</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
              Four, each tied to one thing the integration does:
            </p>
            <ul className="mt-3 space-y-3 text-[15px] leading-relaxed text-neutral-700">
              <Scope name="user:read:user">
                Read once, when you connect, to store and show the connected account&apos;s
                email — so you can confirm you connected the right Zoom account if you have
                more than one. No other profile data is read or kept.
              </Scope>
              <Scope name="meeting:write:meeting">
                Create the scheduled meeting on your account when someone books a
                Zoom-conferencing meeting type. This is the integration.
              </Scope>
              <Scope name="meeting:update:meeting">
                Move that meeting when the booking is rescheduled, so the join link the
                participant already has keeps working.
              </Scope>
              <Scope name="meeting:delete:meeting">
                Delete that meeting when the booking is cancelled, so cancelled meetings
                don&apos;t linger on your Zoom account.
              </Scope>
            </ul>
            <p className="mt-4 text-[15px] leading-relaxed text-neutral-700">
              We ask for nothing about recordings, transcripts, chat, webinars, dashboards,
              account settings or administration. If a future feature needs another
              permission, we will ask for it explicitly and you will be re-prompted.
            </p>
          </Section>

          <Section id="usage" title="Using it">
            <h3 className="mt-4 text-base font-medium">Setting a meeting type to Zoom</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
              Once connected, open any meeting type under{' '}
              <Link href="/meeting-types" className="underline underline-offset-2">
                Meeting types
              </Link>{' '}
              and set <strong>Conferencing</strong> to <em>Zoom</em>. Until your account is
              connected, that option stays unselectable — otherwise a booking would confirm
              with no meeting to join.
            </p>

            <h3 className="mt-8 text-base font-medium">What happens on each booking</h3>
            <ol className="mt-3 space-y-2 list-decimal pl-5 text-[15px] leading-relaxed text-neutral-700">
              <li>Someone picks a time on your public booking page and confirms.</li>
              <li>
                Meet calls <code className="text-[13px]">POST /users/me/meetings</code> on
                your behalf with the booking&apos;s start time, duration and the meeting
                type&apos;s name as the topic.
              </li>
              <li>The Zoom meeting id and join URL are stored on that booking.</li>
              <li>
                The join URL goes into the confirmation email, the booking page, and the
                calendar event Meet writes for you.
              </li>
            </ol>

            <h3 className="mt-8 text-base font-medium">Reschedule</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
              Moving a booking moves the same Zoom meeting (
              <code className="text-[13px]">PATCH /meetings/&#123;id&#125;</code>). The join
              URL does not change, so a link already in someone&apos;s calendar still works.
            </p>

            <h3 className="mt-8 text-base font-medium">Cancellation</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
              Cancelling a booking deletes the Zoom meeting (
              <code className="text-[13px]">DELETE /meetings/&#123;id&#125;</code>). If that
              call fails — a network error, a Zoom outage — the booking is still cancelled;
              only the Zoom-side meeting remains, and you can delete it yourself.
            </p>

            <h3 className="mt-8 text-base font-medium">Team meetings</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
              When several hosts attend the same meeting, it is created on the assigned
              host&apos;s account and the others are added as alternative hosts. Zoom only
              accepts alternative hosts from the same Zoom account, so if a colleague is on
              a different one, the meeting is created without them rather than failing —
              they still get the join link by email.
            </p>

            <h3 className="mt-8 text-base font-medium">What we never do</h3>
            <ul className="mt-3 space-y-1.5 list-disc pl-5 text-[15px] leading-relaxed text-neutral-700">
              <li>We do not access recordings or transcripts.</li>
              <li>We do not access Zoom chat.</li>
              <li>We do not change your Zoom user, account or webinar settings.</li>
              <li>We do not list, read or touch meetings other than the ones Meet created.</li>
            </ul>

            <h3 className="mt-8 text-base font-medium">What we store, and where</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-neutral-700">
              The OAuth refresh token, the connected account&apos;s email, and — per
              booking — the Zoom meeting id and join URL. All of it lives in our EU
              database (Ireland). The token is held in a table no client can read; it never
              reaches a browser and never leaves the EU. Zoom rotates the token each time
              it is used, and we store each new one immediately.
            </p>
          </Section>

          <Section id="removing" title="Removing the app">
            <p className="mt-4 text-[15px] leading-relaxed text-neutral-700">
              Two equivalent ways:
            </p>
            <h3 className="mt-6 text-base font-medium">From Meet</h3>
            <ol className="mt-3 space-y-2 list-decimal pl-5 text-[15px] leading-relaxed text-neutral-700">
              <li>
                Go to{' '}
                <Link href="/settings/integrations" className="underline underline-offset-2">
                  Settings → Integrations
                </Link>
                .
              </li>
              <li>
                Click <strong>Disconnect</strong> on the Zoom card.
              </li>
            </ol>
            <h3 className="mt-6 text-base font-medium">From Zoom</h3>
            <ol className="mt-3 space-y-2 list-decimal pl-5 text-[15px] leading-relaxed text-neutral-700">
              <li>
                Sign in at{' '}
                <a
                  href="https://marketplace.zoom.us"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  marketplace.zoom.us
                </a>
                .
              </li>
              <li>
                Your avatar → <em>Manage</em> → <em>Added Apps</em>.
              </li>
              <li>
                Find <strong>Meet by {ENTITY.publicName}</strong> and click{' '}
                <em>Remove</em>.
              </li>
            </ol>

            <h3 className="mt-8 text-base font-medium">What disconnecting does</h3>
            <ul className="mt-3 space-y-2 list-disc pl-5 text-[15px] leading-relaxed text-neutral-700">
              <li>
                <strong>The refresh token is deleted</strong> from our database. We can no
                longer create, move or delete anything on your Zoom account.
              </li>
              <li>
                <strong>The connected account email is cleared</strong> from your settings
                page.
              </li>
              <li>
                <strong>Existing bookings keep their join links.</strong> Meetings created
                while you were connected stay on your Zoom account and remain joinable; we
                simply can no longer touch them. Delete any you don&apos;t want from Zoom.
              </li>
              <li>
                Meeting types still set to Zoom keep the setting, but new bookings on them
                will have no Zoom meeting until you reconnect — change them to another
                option if you don&apos;t plan to.
              </li>
            </ul>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-neutral-700">
              <li>
                <strong>&ldquo;App not approved for your account&rdquo;</strong> — some Zoom
                accounts restrict third-party apps. Ask your Zoom admin to allow{' '}
                <em>Meet by {ENTITY.publicName}</em> under Account Management → App
                Marketplace → Permissions.
              </li>
              <li>
                <strong>Zoom isn&apos;t offered as a conferencing option</strong> — either
                your account isn&apos;t connected yet (Settings → Integrations), or Zoom
                isn&apos;t configured on this installation. The settings page says which.
              </li>
              <li>
                <strong>You&apos;re asked to reconnect</strong> — the grant was revoked,
                usually from the Zoom side. Reconnect at Settings → Integrations; nothing
                else is affected.
              </li>
              <li>
                <strong>The connection fails part-way</strong> — sign out of Zoom in
                another tab and retry. If it persists, write to{' '}
                <a href={`mailto:${support}`} className="underline underline-offset-2">
                  {support}
                </a>
                .
              </li>
            </ul>
          </Section>

          <div className="mt-12 border-t border-neutral-200 pt-6 text-sm text-neutral-600">
            Questions about this integration:{' '}
            <a href={`mailto:${support}`} className="underline underline-offset-2">
              {support}
            </a>
            . See also our{' '}
            <a href="https://thethread.app/privacy-policy" className="underline underline-offset-2">
              privacy policy
            </a>{' '}
            and{' '}
            <a href="https://thethread.app/terms" className="underline underline-offset-2">
              terms
            </a>
            .
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-8">
      <h2 className="text-xl font-medium tracking-tight border-t border-neutral-200 pt-8">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Scope({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <li>
      <code className="text-[13px] rounded bg-neutral-100 px-1.5 py-0.5">{name}</code>{' '}
      — {children}
    </li>
  );
}
