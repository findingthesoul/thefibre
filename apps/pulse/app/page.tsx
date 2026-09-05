import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { appUrl } from '@thefibre/shared';
import { AppLanding } from '@thefibre/shared/ui/app-landing';

export default async function PulseLanding() {
  // If already signed in, jump straight to the dashboard.
  const supabase = await serverSupabase();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect('/dashboard');

  return (
    <AppLanding
      appSlug="fibre-pulse"
      fibreUrl={appUrl('fibre-platform', process.env)}
      signIn={<SignInButton />}
      headline="The heartbeat of the business."
      intro="One chart that answers the question every small business asks:
          when does the money run out? Opportunities from your contacts,
          budgets for what you spend, reservations for what you owe —
          projected into a running balance you can trust."
      features={[
        {
          title: 'The pipeline is your contacts',
          body: 'Every expected payment belongs to a person or organisation you already know. Multiple leads per contact, each with its own likelihood — the chart weighs them honestly.',
        },
        {
          title: 'Actuals arrive by themselves',
          body: 'When a Thread enrolment or Meet booking is paid, the purchase ledger turns expectation into fact. The past of your chart is real; only the future is a plan.',
        },
        {
          title: 'Reservations, not surprises',
          body: "VAT, funds, buffers — user-defined percentage rules that quietly set money aside as income lands. Available cash is what's actually yours to spend.",
        },
        {
          title: 'Budgets that stay honest',
          body: 'Recurring costs expand into the projection automatically. Targets per quarter, actuals from the ledger — the annual budget compares itself.',
        },
      ]}
    />
  );
}
