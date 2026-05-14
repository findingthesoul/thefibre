import { RequestAccessForm } from './form';
import Link from 'next/link';

export default function RequestAccessPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-xl px-6 py-20">
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← The Fibre
        </Link>

        <h1 className="mt-8 text-3xl font-medium tracking-tight">Request access</h1>
        <p className="mt-3 text-neutral-600 leading-relaxed">
          The Fibre is invitation-only while we onboard partners and pilot
          organisations. Tell us a little about yourself; we&apos;ll be in touch
          once your account is ready.
        </p>

        <div className="mt-10">
          <RequestAccessForm />
        </div>

        <div className="mt-12 border-t border-neutral-200 pt-6 text-xs text-neutral-500 leading-relaxed">
          Already invited?{' '}
          <Link href="/" className="underline">
            Go back and sign in
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
