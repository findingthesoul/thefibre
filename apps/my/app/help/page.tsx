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
import { SURFACES } from '@thefibre/shared';
import { PageShell } from '../page-shell';

// Written from the screens, not from a plan: every button named below is the
// label on the page it links to. If a label changes, change it here too.
const GUIDES: HelpGuide[] = [
  {
    title: 'Sign in, and sign out',
    href: '/',
    steps: guideSteps(`
      Enter the email address you booked or joined with — that is how we find your things — and press Email me a code.
      Open the email and type the 8-digit code, then press Sign in. Pressed the wrong address? Use a different email.
      There is no password. You stay signed in on this device until you sign out.
      To sign out, open You and press Sign out at the bottom. Any tickets kept on this device are removed with it.
    `),
  },
  {
    title: 'Find your ticket and the check-in code',
    href: '/',
    steps: guideSteps(`
      Open Next. A small QR mark under a row means you hold a ticket for it.
      Tap the row. The check-in code sits at the top of the sheet, under "Show this at the door".
      Tap the code to show it full size, and tap anywhere to close it again.
      Once the door has scanned it, the same place reads "Already checked in".
      Wallet buttons appear next to the code only when the organiser offers Apple or Google Wallet passes.
    `),
  },
  {
    title: 'Add sessions to your calendar',
    href: '/you',
    steps: guideSteps(`
      For one session: tap its row on Next, then press the calendar icon beside the session in the Agenda. Your calendar gets a copy — if the organiser moves it, the copy does not move.
      For a whole programme with several dated sessions, press Add all to calendar above the Agenda.
      To follow everything live, open You, find Your calendar and press Subscribe.
      Press Open in Apple Calendar, or Copy address and add it in Google Calendar on a computer: Other calendars, then From URL. Google's phone app cannot add one.
      Keep the address private — anyone who has it sees your sessions. Make a new address if it gets out; the old one stops working.
    `),
  },
  {
    title: 'Install it as an app and use it with no signal',
    href: '/',
    steps: guideSteps(`
      On an iPhone, open this page in Safari, press Share, then Add to Home Screen. On Android, use Chrome's menu and choose Install app (or Add to Home screen). On a Mac, Safari's File menu has Add to Dock.
      Open the app once while you are online. Every ticket you hold is then kept on this device: the code, what it is for, when and where — nothing else.
      With no connection, the app shows "You're offline" and your tickets under it. Tap a ticket to show its code full size for the door.
      Press Try again once the signal is back to return to the live app.
      The kept tickets are removed when you sign out.
    `),
  },
  {
    title: 'See your memberships and manage payment',
    href: '/memberships',
    steps: guideSteps(`
      Open Memberships. Each community you belong to is a card with its tier and status — active, grace, lapsed or cancelled — and what the membership includes.
      Grace means a payment is overdue but your access continues for now. Lapsed means it has ended; rejoin with the community to get it back.
      Press Manage payment to change your card or cancel. This opens your community's payment page.
      If it says "Your community handles the payments for this one", the community bills you outside this app — contact them directly.
      What you paid links to Purchases.
    `),
  },
  {
    title: 'See your purchases and download invoices',
    href: '/purchases',
    steps: guideSteps(`
      Open Purchases. Everything you have paid for — a ticket, a booking, a membership — is one row with the community, the date and the amount.
      A row that is not paid shows its status, and the line at the top counts what is still outstanding.
      Press PDF on a row to download the invoice.
      If something is missing, check you signed in with the address you paid with. Your name on an invoice comes from You — correct it there and press Save.
    `),
  },
];

export default function HelpPage() {
  return (
    <PageShell title="Help" subtitle={SURFACES['my-portal'].tagline}>
      <section className="mt-8">
        <h2 className="text-[10px] uppercase tracking-wider text-ink-muted">How to</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {GUIDES.map((g) => (
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
                  Open &rarr;
                </Link>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* The one thing this page cannot answer. A booking belongs to whoever
          made the programme, and their name is on every row of Next. */}
      <p className="mt-10 border-t border-line pt-6 text-sm text-ink-muted">
        Questions about a booking, a place or a refund go to the organiser who runs it — their
        name is on the row.
      </p>
    </PageShell>
  );
}
