import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { appUrl } from '@thefibre/shared';
import { AppLanding } from '@thefibre/shared/ui/app-landing';

export default async function MeetLanding() {
  // If already signed in, jump straight to the dashboard.
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');

  return (
    <AppLanding
      appSlug="fibre-meet"
      fibreUrl={appUrl('fibre-platform', process.env)}
      signIn={<SignInButton />}
      headline="A meeting is a thing of its own."
      intro="Design the agenda. Facilitate live. Capture the outcomes that
          actually carry forward. Meet is the meeting platform inside
          The Fibre — built for facilitators, not for calendars."
      features={[
        {
          title: 'Before, during, after',
          body: 'A meeting has three phases. Meet holds the whole arc — agenda, live notes, action items, follow-through.',
        },
        {
          title: 'The same person, everywhere',
          body: 'Identity comes from The Fibre. The contact you meet here is the contact you meet anywhere else.',
        },
        {
          title: 'What stays, stays',
          body: 'Facilitator notes and exercise responses are visible only to Meet members. Other apps see that a meeting happened — never what was said.',
        },
        {
          title: 'Outcomes that promote',
          body: 'Persistent observations (this person is a sponsor; this org has a hostile stakeholder) move to the platform record with one click.',
        },
      ]}
    />
  );
}
