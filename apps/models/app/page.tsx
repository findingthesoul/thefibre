import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { appUrl } from '@thefibre/shared';
import { AppLanding } from '@thefibre/shared/ui/app-landing';

export default async function ModelsLanding() {
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect('/dashboard');

  return (
    <AppLanding
      appSlug="fibre-models"
      fibreUrl={appUrl('fibre-platform', process.env)}
      signIn={<SignInButton />}
      headline="The business model, on one canvas."
      intro="Turnover generators with their own cost structure, generic costs, the investment it takes, and the break even point. One set of inputs, every number live, from the Business Model Canvas down to the monthly projection."
      features={[
        { title: 'A model per venture, a team per model', body: 'Each business model belongs to a team in your workspace. Give someone access to the team and they see the models, nothing else.' },
        { title: 'Turnover generators, not one big number', body: 'Memberships, services, a marketplace, grants: each with its own volume, price and costs, so you can see which one carries the model.' },
        { title: 'Break even and funding need', body: 'When the month turns positive, how many customers that takes, how deep the cash dips first, and when the investment is earned back.' },
        { title: 'Start from a story', body: 'Describe the venture, get a model definition, paste it in. Everyone in the team turns the dials together.' },
      ]}
    />
  );
}
