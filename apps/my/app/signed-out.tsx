// The one screen a signed-out visitor sees, wherever they landed. Four tabs
// each rendering their own sign-in form would be four copies of one thing.

import { SURFACES, ENTITY } from '@thefibre/shared';
import { SignIn } from './sign-in';
import { Wordmark } from './wordmark';

export function SignedOut() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">
      {/* The mark IS the heading. The name stays in the h1 for a screen
          reader and for the tab title — an image alone leaves the page
          without one. */}
      <h1 className="sr-only">{SURFACES['my-portal'].shortLabel}</h1>
      <Wordmark className="h-12" />
      <p className="mt-1 text-ink-subtle">{SURFACES['my-portal'].tagline}</p>
      <div className="mt-8 max-w-sm">
        <SignIn />
      </div>
      <p className="mt-10 text-xs text-ink-muted">{ENTITY.publicName}</p>
    </div>
  );
}
