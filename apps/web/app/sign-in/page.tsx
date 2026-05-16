import Link from 'next/link';
import { SignInButton } from '../sign-in-button';
import { APPS } from '@thefibre/shared';

const FIBRE = APPS['fibre-platform'];

export const metadata = {
  title: `Sign in · ${FIBRE.name}`,
};

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-md px-6 py-20">
        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
          {FIBRE.name}
        </div>
        <h1 className="mt-3 text-3xl font-medium tracking-tight leading-tight">
          Sign in
        </h1>
        <p className="mt-3 text-sm text-neutral-600 leading-relaxed">
          Continue with Google, or use an email sign-in code if you don&rsquo;t
          have a Google account on the address you&rsquo;ve been invited at.
        </p>

        <div className="mt-8">
          <SignInButton />
        </div>

        <div className="mt-10 text-xs text-neutral-500">
          New here?{' '}
          <Link
            href="/request-access"
            className="underline underline-offset-4 hover:text-neutral-900"
          >
            Request access
          </Link>
          .
        </div>
      </div>
    </main>
  );
}
