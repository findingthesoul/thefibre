import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { appUrl } from '@thefibre/shared';
import { AppLanding } from '@thefibre/shared/ui/app-landing';

export default async function ConnectionsLanding() {
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/landscape');

  return (
    <AppLanding
      appSlug="fibre-sales"
      fibreUrl={appUrl('fibre-platform', process.env)}
      signIn={<SignInButton />}
      headline="Where everybody stands."
      intro="A community is too big to hold in your head and too important to
          guess at. Connections works out where each person is from what has
          actually happened — who came, who came back, who contributes, who
          holds space — and tells you who has gone quiet."
      features={[
        {
          title: 'Nothing to fill in',
          body: 'Every position is derived from enrolments, meetings, memberships and payments that other tools already recorded. There is no stage field to maintain, which is why it is still right in a year.',
        },
        {
          title: 'Movement, not just a picture',
          body: 'Who moved up a rung this month, who arrived, who slipped. A distribution on its own is a poster; what changed is the reason to look again on Monday.',
        },
        {
          title: 'Selling is one lens, not a separate place',
          body: 'The pipeline is one way of grouping the same people, alongside closeness, rhythm and who brings others. For most of this work, a deal is an episode in a relationship rather than the point of it.',
        },
        {
          title: 'It says what it knows',
          body: 'Named conditions in plain words — went quiet, arrived and unattended, finished with nothing next — never a score. People are not ranked here.',
        },
      ]}
    />
  );
}
