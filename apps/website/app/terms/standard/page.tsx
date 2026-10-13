import type { Metadata } from 'next';
import { StandardMembershipTermsDoc } from '@thefibre/shared/ui/legal-docs';

// The same document apps/web serves — one text, two renderers, like the terms
// of use and the privacy policy. The canonical link the join panel hands out
// points at the PLATFORM app, because that one is deployed on staging too;
// this copy exists so the marketing site is not a dead end for anybody who
// goes looking.
export const metadata: Metadata = {
  title: 'Standard membership terms',
  description:
    'The default agreement between a community and its members for memberships sold through The Thread.',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <main className="px-6 py-16 md:px-10 md:py-20">
      <div className="mx-auto max-w-3xl">
        <StandardMembershipTermsDoc />
      </div>
    </main>
  );
}
