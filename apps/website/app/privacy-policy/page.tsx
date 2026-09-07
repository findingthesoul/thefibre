import type { Metadata } from 'next';
import { PrivacyDoc } from '@thefibre/shared/ui/legal-docs';

export const metadata: Metadata = {
  title: 'Privacy statement',
  description: 'What we hold about you, why, where it lives, and what you can do about it.',
};

export default function Page() {
  return (
    <main className="px-6 py-16 md:px-10 md:py-20">
      <div className="mx-auto max-w-3xl">
        <PrivacyDoc />
      </div>
    </main>
  );
}
