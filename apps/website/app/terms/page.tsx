import type { Metadata } from 'next';
import { TermsDoc } from '@thefibre/shared/ui/legal-docs';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The rules for using The Thread and The Fibre.',
};

export default function Page() {
  return (
    <main className="px-6 py-16 md:px-10 md:py-20">
      <div className="mx-auto max-w-3xl">
        <TermsDoc />
      </div>
    </main>
  );
}
