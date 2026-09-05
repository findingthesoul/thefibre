import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { appUrl } from '@thefibre/shared';
import { AppLanding } from '@thefibre/shared/ui/app-landing';

export default async function ThreadLanding() {
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');

  return (
    <AppLanding
      appSlug="the-thread"
      fibreUrl={appUrl('fibre-platform', process.env)}
      signIn={<SignInButton />}
      headline="The arc that carries the work."
      intro="Conferences, multi-session programmes, post-event journeys — held
          together by one continuous thread. The participants you meet here
          are the people you meet anywhere else in The Fibre."
      features={[
        {
          title: 'One arc, many sessions',
          body: "A programme isn't a calendar of events — it's a journey with phases, milestones, follow-through.",
        },
        {
          title: 'Enrolment, not registration',
          body: 'Participants enrol into the arc. Status moves with them: invited, enrolled, active, completed.',
        },
        {
          title: 'Writes back to The Fibre',
          body: 'Attendance and milestone events flow to the platform timeline. The activity log is shared; the content stays here.',
        },
        {
          title: 'Designed for facilitators',
          body: 'Built by people who run programmes, for people who run programmes. Not for marketing funnels.',
        },
      ]}
    />
  );
}
