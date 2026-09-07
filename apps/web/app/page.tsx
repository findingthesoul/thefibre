import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInLink } from './sign-in-button';
import { ENTITY, BRAND_ASSETS } from '@thefibre/shared';

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

// Whether the door is open (auto-approve, the default) or invited-only —
// same source as /pricing, so the story never disagrees with the form.
async function signupMode(): Promise<'open' | 'invited'> {
  try {
    const r = await fetch(`${apiBase}/api/v1/public/plans`, { next: { revalidate: 300 } });
    if (!r.ok) return 'invited';
    const d = (await r.json()) as { signup_mode?: 'open' | 'invited' };
    return d.signup_mode ?? 'invited';
  } catch {
    return 'invited';
  }
}

// The public landing — a FIBRE page again (Sjoerd, 2026-09-08): with
// thethread.app carrying the product marketing, thefibre.app returns to
// being the platform's own face — what The Fibre is, the tools running on
// it, and the invitation to build yours on it (the app platform is open
// since v0.14.0).

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

  const mode = await signupMode();

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
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                mode === 'open' ? 'bg-emerald-500' : 'bg-yellow-400'
              }`}
            />
            {mode === 'open'
              ? 'Free to start — no card needed'
              : 'In an invited trial — access is by request'}
          </div>
          <h1 className="mt-5 text-5xl font-medium tracking-tight leading-tight">
            The Fibre
          </h1>
          <p className="mt-3 text-2xl text-neutral-600 tracking-tight">
            The data platform beneath The Thread.
          </p>
          <p className="mt-6 text-lg text-neutral-600 leading-relaxed max-w-2xl">
            One contact base carries every tool: people, organisations, enrolments, consent. Each
            tool sees only the data it can justify — nothing is copied around, nothing leaks.
            Hosted in the EU, GDPR by construction, holding nothing it cannot explain.
          </p>

          <div className="mt-10 flex items-center gap-5">
            <SignInLink />
            <a
              href="https://thethread.app"
              className="rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-medium hover:bg-neutral-50"
            >
              Meet the tools →
            </a>
            <Link
              href="/pricing"
              className="text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
            >
              Pricing
            </Link>
          </div>
        </header>

        {/* What walking a Thread involves — functions in its service, not
            sibling products. */}
        <section className="mt-24">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Tools running on The Fibre
          </div>
          <div className="mt-5 space-y-6">
            <Function
              title="The Thread — events become journeys"
              body="Enrolment, tickets and payment, messages that send themselves, certificates — the whole arc of a gathering, from first hello to follow-up."
            />
            <Function
              title="Meet — the planning tool"
              body="Appointments with people and groups, booked against real availability; the calendar entry and the room link follow by themselves."
            />
            <Function
              title="Members — membership management"
              body="Groups and subgroups, joining and renewal, subscriptions collected — one living register of who belongs where."
            />
            <Function
              title="Pulse & Flow — on the workbench"
              body="Business planning and people-flow, growing quietly alongside the rest. And beyond our own house: external tools already run here too, on scoped keys."
            />
          </div>
        </section>

        <section className="mt-20">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            Build yours on it
          </div>
          <p className="mt-4 text-sm text-neutral-600 leading-relaxed max-w-2xl">
            The Fibre is an open platform: any tool can register, receive scoped keys for exactly
            the data it justifies, and stand on the same contact base, consent model and EU
            hosting — GDPR handled underneath, so you build the tool, not the plumbing. If
            you&rsquo;re building for people who bring people together,{' '}
            <a className="underline" href={`mailto:${ENTITY.supportEmail}`}>
              write to us
            </a>{' '}
            — we&rsquo;ll walk you through the app contract, and{' '}
            <Link className="underline" href="/about">
              the thinking behind the platform
            </Link>
            . No advertising, no profiling, no data sold — yours or your users&rsquo;.
          </p>
        </section>

        <footer className="mt-28 border-t border-neutral-200 pt-6 text-xs text-neutral-500 leading-relaxed">
          The Fibre · the platform beneath{' '}
          <a className="underline" href="https://thethread.app">
            The Thread
          </a>{' '}
          · {ENTITY.hostedLine}
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
