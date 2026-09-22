import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverSupabase } from '@/lib/supabase/server';
import { SignInButton } from './sign-in-button';
import { APPS, appUrl } from '@thefibre/shared';
import { AppLanding } from '@thefibre/shared/ui/app-landing';
import { COOKIE_LAST, landingPath } from '@/lib/last-page';

export default async function ConnectionsLanding() {
  const supabase = await serverSupabase();
  // Local JWT verification against cached JWKS — no round trip to Supabase
  // Auth just to decide whether to bounce a signed-in visitor to /landscape.
  const { data: claims } = await supabase.auth.getClaims();
  if (claims) {
    // Where they were last, or Today the first time — Sjoerd, 2026-09-22.
    // The cookie is matched against the sidebar's own sections and never
    // used as a path, because a redirect built from a cookie is a redirect
    // anybody can aim (lib/last-page.ts).
    const last = (await cookies()).get(COOKIE_LAST)?.value;
    redirect(landingPath(last));
  }

  return (
    <AppLanding
      appSlug="fibre-sales"
      fibreUrl={appUrl('fibre-platform', process.env)}
      signIn={<SignInButton />}
      headline="Where everybody stands."
      // The app's own name comes from branding, never typed here. This line
      // still said "Connections" for an hour after the rename to Connect
      // (2026-09-21) — on the sign-in page, which is the first thing a new
      // person reads. brand-names.test.ts now fails the release if the
      // interpolation below is replaced by a literal again.
      intro={`A community is too big to hold in your head and too important to
          guess at. ${APPS['fibre-sales'].name} works out where each person is
          from what has actually happened — who came, who came back, who
          contributes, who holds space — and tells you who has gone quiet.`}
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
