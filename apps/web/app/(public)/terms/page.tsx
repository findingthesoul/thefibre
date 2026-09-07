import { TermsDoc } from '@thefibre/shared/ui/legal-docs';

// Content lives in @thefibre/shared/ui/legal-docs — served identically on
// thefibre.app and thethread.app. ⚠️ Still not legally reviewed.
export const metadata = {
  title: 'Terms of use — The Thread & The Fibre',
  description: 'The rules for using The Thread and The Fibre.',
};

export default function TermsPage() {
  return <TermsDoc />;
}
