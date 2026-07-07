import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { APPS, ENTITY, appUrl } from '@thefibre/shared';

const PULSE = APPS['fibre-pulse'];
const FIBRE = APPS['fibre-platform'];

export default async function PulseLanding() {
  // If already signed in, jump straight to the dashboard.
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');

  const fibreUrl = appUrl('fibre-platform', process.env);

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          {PULSE.name}
        </div>
        <h1 className="mt-3 text-5xl font-medium tracking-tight leading-tight">
          The heartbeat of the business.
        </h1>
        <p className="mt-5 text-lg text-neutral-600 leading-relaxed max-w-2xl">
          One chart that answers the question every small business asks:
          when does the money run out? Opportunities from your contacts,
          budgets for what you spend, reservations for what you owe —
          projected into a running balance you can trust.
        </p>

        <div className="mt-10">
          <SignInButton />
        </div>

        <section className="mt-24 grid gap-8 md:grid-cols-2">
          <Feature
            title="The pipeline is your contacts"
            body="Every expected payment belongs to a person or organisation you already know. Multiple leads per contact, each with its own likelihood — the chart weighs them honestly."
          />
          <Feature
            title="Actuals arrive by themselves"
            body="When a Thread enrolment or Meet booking is paid, the purchase ledger turns expectation into fact. The past of your chart is real; only the future is a plan."
          />
          <Feature
            title="Reservations, not surprises"
            body="VAT, funds, buffers — user-defined percentage rules that quietly set money aside as income lands. Available cash is what's actually yours to spend."
          />
          <Feature
            title="Budgets that stay honest"
            body="Recurring costs expand into the projection automatically. Targets per quarter, actuals from the ledger — the annual budget compares itself."
          />
        </section>

        <footer className="mt-28 border-t border-neutral-200 pt-6 text-xs text-neutral-500 leading-relaxed">
          {new URL(PULSE.url).host} · part of{' '}
          <Link href={fibreUrl} className="underline">
            {FIBRE.name}
          </Link>{' '}
          · {ENTITY.name} · {ENTITY.hostedLine}
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
