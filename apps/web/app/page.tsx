import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInLink } from './sign-in-button';
import { ENTITY, BRAND_ASSETS } from '@thefibre/shared';

// The public landing, positioned per docs/naming-brief.md (2026-09-01):
// Thread is the flagship people meet and say out loud; Meet / Sales / Flow
// are functions in its service, never siblings with equal billing; Fibre
// appears once, backstage, as the foundation — never the pitch.

export default async function LandingPage() {
  // If already signed in, jump straight to the dashboard — mirrors meet/flow.
  // Without this, an authenticated user returning to thefibre.app/ sees the
  // public marketing page and assumes they've been logged out (the session is
  // actually intact — shared across .thefibre.app subdomains).
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <header>
          <Image
            src="/brand/the-fibre.png"
            alt={BRAND_ASSETS.logoAlt}
            width={BRAND_ASSETS.logoNativeWidth}
            height={BRAND_ASSETS.logoNativeHeight}
            priority
            className="h-12 w-auto"
          />
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
            In an invited trial — access is by request
          </div>
          <h1 className="mt-5 text-5xl font-medium tracking-tight leading-tight">
            Thread
          </h1>
          <p className="mt-3 text-2xl text-neutral-600 tracking-tight">
            The learning journey a person walks.
          </p>
          <p className="mt-6 text-lg text-neutral-600 leading-relaxed max-w-2xl">
            A festival, a course, a programme — for the person in it, these are
            not events on a calendar. They are one journey: the first hello,
            the enrolment, the sessions, the certificate, the invitation to
            what comes next. Thread holds that whole arc, so the people who
            organise it can walk alongside instead of chasing spreadsheets.
          </p>

          <div className="mt-10 flex items-center gap-5">
            <Link
              href="/request-access"
              className="rounded-md bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-neutral-800"
            >
              Request access
            </Link>
            <Link
              href="/pricing"
              className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium hover:bg-neutral-50"
            >
              Pricing
            </Link>
            <SignInLink />
          </div>
        </header>

        {/* What walking a Thread involves — functions in its service, not
            sibling products. */}
        <section className="mt-24">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            What a Thread carries
          </div>
          <div className="mt-5 space-y-6">
            <Function
              title="Enrolment that feels like a welcome"
              body="Public pages in five languages, tickets and gentle payment, approval when a journey needs a doorkeeper — and every email a message in the journey's own voice, sent at the right moment."
            />
            <Function
              title="Meetings, inside the journey"
              body="Sessions and one-to-ones are scheduled and recorded as part of the Thread — how meetings happen here, not a separate tool to learn."
            />
            <Function
              title="The arc, visible"
              body="Who has begun, who is mid-way, who crossed the finish — with certificates issued when they do. The people flow underneath is an engine, not a dashboard anyone must study."
            />
            <Function
              title="Relationships that persist"
              body="The same person recognised across journeys and years — so next year's edition starts from a relationship, not a fresh import."
            />
          </div>
        </section>

        <section className="mt-20">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Under the hood
          </div>
          <p className="mt-4 text-sm text-neutral-600 leading-relaxed max-w-2xl">
            Thread runs on The Fibre — a shared foundation for identity and
            relationships, hosted in the EU, GDPR-native, holding nothing it
            cannot justify. A learner never needs to know it is there; the
            organisations trusting us with their people&rsquo;s data sometimes
            do, and{' '}
            <Link className="underline" href="/about">
              we are glad to explain it
            </Link>
            . No advertising, no profiling, no data sold.
          </p>
        </section>

        <footer className="mt-28 border-t border-neutral-200 pt-6 text-xs text-neutral-500 leading-relaxed">
          {ENTITY.name} · {ENTITY.hostedLine}
          <br />
          <Link className="underline" href="/pricing">
            Pricing
          </Link>{' '}
          ·{' '}
          {/* /privacy is the SIGNED-IN consent dashboard, inside (app) — linking
              a logged-out visitor there bounced them straight back here. */}
          <Link className="underline" href="/privacy-policy">
            Privacy
          </Link>{' '}
          ·{' '}
          <Link className="underline" href="/terms">
            Terms
          </Link>{' '}
          ·{' '}
          <Link className="underline" href="/about">
            About
          </Link>
          .
        </footer>
      </div>
    </main>
  );
}

function Function({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-2xl">
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mt-1.5 text-sm text-neutral-600 leading-relaxed">{body}</p>
    </div>
  );
}
