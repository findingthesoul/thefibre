import { StandardMembershipTermsDoc } from '@thefibre/shared/ui/legal-docs';

// The default agreement between a community and ITS members — content in
// @thefibre/shared/ui/legal-docs, served identically here and on the
// marketing site.
//
// THIS app is what makes the link work on staging: apps/web answers on
// thefibre.tech AND thefibre.app, while apps/website has no staging
// deployment. The first version of this page lived only there, so the link in
// the join panel 404'd on both stacks (Sjoerd: "Terms and condition link leads
// to nothing").
//
// ⚠️ DRAFT: not approved, not legally reviewed. The page says so itself.
export const metadata = {
  title: 'Standard membership terms (draft) — The Thread',
  description:
    'The default agreement between a community and its members for memberships sold through The Thread.',
  robots: { index: false, follow: false },
};

export default function StandardTermsPage() {
  return <StandardMembershipTermsDoc />;
}
