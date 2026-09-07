import { SupportDoc } from '@thefibre/shared/ui/legal-docs';

// Content lives in @thefibre/shared/ui/legal-docs — served identically on
// thefibre.app and thethread.app.
export const metadata = {
  title: 'Support — The Thread & The Fibre',
  description: 'Write to a human. Support, privacy requests, and email deliverability help.',
};

export default function SupportPage() {
  return <SupportDoc />;
}
