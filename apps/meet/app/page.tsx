import Link from 'next/link';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { APPS, ENTITY, appUrl } from '@thefibre/shared';

const MEET = APPS['fibre-meet'];
const FIBRE = APPS['fibre-platform'];

export default async function MeetLanding() {
  // If already signed in, jump straight to the dashboard.
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');

  const fibreUrl = appUrl('fibre-platform', process.env);

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          {MEET.name}
        </div>
        <h1 className="mt-3 text-5xl font-medium tracking-tight leading-tight">
          A meeting is a thing of its own.
        </h1>
        <p className="mt-5 text-lg text-neutral-600 leading-relaxed max-w-2xl">
          Design the agenda. Facilitate live. Capture the outcomes that
          actually carry forward. Fibre Meet is the meeting platform inside
          The Fibre — built for facilitators, not for calendars.
        </p>

        <div className="mt-10">
          <SignInButton />
        </div>

        <section className="mt-24 grid gap-8 md:grid-cols-2">
          <Feature
            title="Before, during, after"
            body="A meeting has three phases. Meet holds the whole arc — agenda, live notes, action items, follow-through."
          />
          <Feature
            title="The same person, everywhere"
            body="Identity comes from The Fibre. The contact you meet here is the contact you meet anywhere else."
          />
          <Feature
            title="What stays, stays"
            body="Facilitator notes and exercise responses are visible only to Meet members. Other apps see that a meeting happened — never what was said."
          />
          <Feature
            title="Outcomes that promote"
            body="Persistent observations (this person is a sponsor; this org has a hostile stakeholder) move to the platform record with one click."
          />
        </section>

        <footer className="mt-28 border-t border-neutral-200 pt-6 text-xs text-neutral-500 leading-relaxed">
          {new URL(MEET.url).host} · part of{' '}
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
