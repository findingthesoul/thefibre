import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { APPS, ENTITY, appUrl } from '@thefibre/shared';

const FLOW = APPS['fibre-flow'];
const FIBRE = APPS['fibre-platform'];

export default async function FlowLanding() {
  // If already signed in, jump straight to the dashboard.
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');

  const fibreUrl = appUrl('fibre-platform', process.env);

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          {FLOW.name}
        </div>
        <h1 className="mt-3 text-5xl font-medium tracking-tight leading-tight">
          People in motion.
        </h1>
        <p className="mt-5 text-lg text-neutral-600 leading-relaxed max-w-2xl">
          A flow is a sequence of steps, with gate tasks holding each contact
          until the right things have happened. Sales pipelines, project
          intakes, partnership arcs — Flow holds the journeys your
          people are actually on.
        </p>

        <div className="mt-10">
          <SignInButton />
        </div>

        <section className="mt-24 grid gap-8 md:grid-cols-2">
          <Feature
            title="The flow is the source of truth"
            body="Steps and transitions are explicit. Where a contact stands, what unblocks the next step, who owes what — all visible at a glance."
          />
          <Feature
            title="Tasks fall out of the flow"
            body="Every gate generates tasks. Personal, team, contact-action. The shape of the work emerges from the shape of the flow."
          />
          <Feature
            title="Identity from The Fibre"
            body="Person, organisation, team — all platform primitives. Flow never duplicates contact data; it joins what's already there."
          />
          <Feature
            title="Activity, not gossip"
            body="A step transition is an activity event. Other apps see that the contact moved — never the private content of the gate."
          />
        </section>

        <footer className="mt-28 border-t border-neutral-200 pt-6 text-xs text-neutral-500 leading-relaxed">
          {new URL(FLOW.url).host} · part of{' '}
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
