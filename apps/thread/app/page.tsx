import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { APPS, ENTITY, appUrl } from '@thefibre/shared';

const THREAD = APPS['the-thread'];
const FIBRE = APPS['fibre-platform'];

export default async function ThreadLanding() {
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');

  const fibreUrl = appUrl('fibre-platform', process.env);

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          {THREAD.name}
        </div>
        <h1 className="mt-3 text-5xl font-medium tracking-tight leading-tight">
          The arc that carries the work.
        </h1>
        <p className="mt-5 text-lg text-neutral-600 leading-relaxed max-w-2xl">
          Conferences, multi-session programmes, post-event journeys — held
          together by one continuous thread. The participants you meet here
          are the people you meet anywhere else in The Fibre.
        </p>

        <div className="mt-10">
          <SignInButton />
        </div>

        <section className="mt-24 grid gap-8 md:grid-cols-2">
          <Feature
            title="One arc, many sessions"
            body="A programme isn't a calendar of events — it's a journey with phases, milestones, follow-through."
          />
          <Feature
            title="Enrolment, not registration"
            body="Participants enrol into the arc. Status moves with them: invited, enrolled, active, completed."
          />
          <Feature
            title="Writes back to The Fibre"
            body="Attendance and milestone events flow to the platform timeline. The activity log is shared; the content stays here."
          />
          <Feature
            title="Designed for facilitators"
            body="Built by people who run programmes, for people who run programmes. Not for marketing funnels."
          />
        </section>

        <footer className="mt-28 border-t border-neutral-200 pt-6 text-xs text-neutral-500 leading-relaxed">
          {new URL(THREAD.url).host} · part of{' '}
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
