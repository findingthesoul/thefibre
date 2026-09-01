import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInLink } from './sign-in-button';
import { APPS, ENTITY, BRAND_ASSETS } from '@thefibre/shared';

const FIBRE = APPS['fibre-platform'];
// The logo lives in apps/web/public/brand/the-fibre.png and is served at
// /brand/the-fibre.png. BRAND_ASSETS.logoUrl is the absolute URL used in
// emails — same file, different surface.

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
            Relationships, kept honestly.
          </h1>
          <p className="mt-5 text-lg text-neutral-600 leading-relaxed max-w-2xl">
            A platform for the people, organisations and programmes behind
            purpose-driven work. EU-hosted, GDPR-native, cooperative-owned.
            One place for the relationships your work depends on — without
            the surveillance most software adds.
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

        {/* The family — one platform, apps that each do one thing well. */}
        <section className="mt-24">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            One platform, four apps
          </div>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <AppCard
              app={APPS['fibre-meet']}
              body="Booking pages, paid sessions, and meetings that land in the shared contact graph instead of a silo."
            />
            <AppCard
              app={APPS['the-thread']}
              body="Programmes and events end to end: enrolment, tickets, timed emails, approval, certificates."
            />
            <AppCard
              app={APPS['fibre-flow']}
              body="People in motion — applicants, participants and members moving through stages everyone can see."
            />
            <AppCard
              app={APPS['fibre-pulse']}
              body="Cashflow and runway for the organisation behind the work, fed by the money the other apps take."
            />
          </div>
        </section>

        <section className="mt-24 grid gap-8 md:grid-cols-2">
          <Feature
            title="One profile per person"
            body="The same contact across meetings, journeys, sales and learning — one identity, kept in the EU, owned by you."
          />
          <Feature
            title="Apps that earn their data"
            body="Every field stored on a person exists because a specific app needs it. No “might be useful later”. GDPR Article 5(1)(c) by construction."
          />
          <Feature
            title="The data wall"
            body="Each app keeps its own content. Only short event records (“meeting attended”, “session completed”) cross the wall. Sensitive notes never leave."
          />
          <Feature
            title="Independently owned"
            body={`${ENTITY.name} — built to last, not to flip. No advertising, no profiling, no third-party trackers.`}
          />
        </section>

        <section className="mt-20">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            What it currently does
          </div>
          <ul className="mt-4 space-y-3 text-sm text-neutral-700 leading-relaxed">
            <li>· Identity, contact graph, organisations and programmes</li>
            <li>· Per-app profile tabs that appear only when an app has data on the person</li>
            <li>· Activity timeline across all installed apps</li>
            <li>· Privacy dashboard — consents, erasure, full transparency</li>
            <li>· Fibre Meet, The Thread, Fibre Flow and Fibre Pulse as first-party apps</li>
            <li>
              · Four packages, per workspace —{' '}
              <Link className="underline" href="/pricing">
                see pricing
              </Link>
            </li>
          </ul>
        </section>

        <footer className="mt-28 border-t border-neutral-200 pt-6 text-xs text-neutral-500 leading-relaxed">
          {new URL(FIBRE.url).host} · {ENTITY.name} · {ENTITY.hostedLine}
          <br />
          No advertising. No profiling. No data sold.{' '}
          {/* /privacy is the SIGNED-IN consent dashboard, inside (app) — linking
              a logged-out visitor there bounced them straight back here. */}
          <Link className="underline" href="/pricing">
            Pricing
          </Link>{' '}
          ·{' '}
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

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{body}</p>
    </div>
  );
}

function AppCard({
  app,
  body,
}: {
  app: { name: string; tagline: string; brandLetters: string };
  body: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 p-5">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-yellow-300 text-[10px] font-semibold tracking-tight text-neutral-900">
          {app.brandLetters}
        </span>
        <h3 className="text-base font-medium">{app.name}</h3>
      </div>
      <p className="mt-2 text-sm italic text-neutral-500">{app.tagline}</p>
      <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{body}</p>
    </div>
  );
}
