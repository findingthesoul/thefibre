import type { Metadata } from 'next';
import { SupportDoc } from '@thefibre/shared/ui/legal-docs';

export const metadata: Metadata = {
  title: 'Support',
  description: 'Write to a human. Support, privacy requests, and email deliverability help.',
};

export default function Page() {
  return (
    <main className="px-6 py-16 md:px-10 md:py-20">
      <div className="mx-auto max-w-3xl">
        <SupportDoc />
      </div>
    </main>
  );
}
