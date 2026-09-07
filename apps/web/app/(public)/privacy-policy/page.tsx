import { PrivacyDoc } from '@thefibre/shared/ui/legal-docs';

// Content lives in @thefibre/shared/ui/legal-docs — served identically on
// thefibre.app and thethread.app. ⚠️ Still not legally reviewed.
export const metadata = {
  title: 'Privacy statement — The Thread & The Fibre',
  description: 'What we hold about you, why, where it lives, and what you can do about it.',
};

export default function PrivacyPolicyPage() {
  return <PrivacyDoc />;
}
