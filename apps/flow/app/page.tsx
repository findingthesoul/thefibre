import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { appUrl } from '@thefibre/shared';
import { AppLanding } from '@thefibre/shared/ui/app-landing';

export default async function FlowLanding() {
  // If already signed in, jump straight to the dashboard.
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');

  return (
    <AppLanding
      appSlug="fibre-flow"
      fibreUrl={appUrl('fibre-platform', process.env)}
      signIn={<SignInButton />}
      headline="People in motion."
      intro="A flow is a sequence of steps, with gate tasks holding each contact
          until the right things have happened. Sales pipelines, project
          intakes, partnership arcs — Flow holds the journeys your
          people are actually on."
      features={[
        {
          title: 'The flow is the source of truth',
          body: "Steps and transitions are explicit. Where a contact stands, what unblocks the next step, who owes what — all visible at a glance.",
        },
        {
          title: 'Tasks fall out of the flow',
          body: 'Every gate generates tasks. Personal, team, contact-action. The shape of the work emerges from the shape of the flow.',
        },
        {
          title: 'Identity from The Fibre',
          body: "Person, organisation, team — all platform primitives. Flow never duplicates contact data; it joins what's already there.",
        },
        {
          title: 'Activity, not gossip',
          body: 'A step transition is an activity event. Other apps see that the contact moved — never the private content of the gate.',
        },
      ]}
    />
  );
}
