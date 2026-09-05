import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { appUrl } from '@thefibre/shared';
import { AppLanding } from '@thefibre/shared/ui/app-landing';

export default async function MembershipLanding() {
  // If already signed in, jump straight to the dashboard.
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');

  // This page carried Pulse's landing copy wholesale ("the heartbeat of the
  // business") since the app was scaffolded — caught 2026-09-06.
  return (
    <AppLanding
      appSlug="membership"
      fibreUrl={appUrl('fibre-platform', process.env)}
      signIn={<SignInButton />}
      headline="A community that carries itself."
      intro="Tiers, products, seats and renewals — Membership runs the
          subscriptions of a community inside The Fibre: who belongs, what
          that unlocks, and the money that keeps it going."
      features={[
        {
          title: 'Tiers made of products',
          body: 'A product carries what it unlocks — a Circle space, a Thread, a seat. Tiers bundle products; access follows membership automatically.',
        },
        {
          title: 'Joining is self-serve',
          body: 'A public join page with your tiers and pricing rules. Card payments confirm themselves; manual adds invoice by email.',
        },
        {
          title: 'Access that revokes itself',
          body: 'Lapse and the grants withdraw; rejoin and they return. Bought products stay — they were paid for outright.',
        },
        {
          title: 'The same person, everywhere',
          body: 'Identity comes from The Fibre. A member here is the same contact in every other app of the workspace.',
        },
      ]}
    />
  );
}
