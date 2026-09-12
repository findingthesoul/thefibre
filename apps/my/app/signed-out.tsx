// The one screen a signed-out visitor sees, wherever they landed. Four tabs
// each rendering their own sign-in form would be four copies of one thing.

import { SURFACES, ENTITY } from '@thefibre/shared';
import { SignIn } from './sign-in';

export function SignedOut() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-16">
      <h1 className="text-2xl font-medium tracking-tight text-ink">
        {SURFACES['my-portal'].shortLabel}
      </h1>
      <p className="mt-1 text-ink-subtle">{SURFACES['my-portal'].tagline}</p>
      <div className="mt-8 max-w-sm">
        <SignIn />
      </div>
      <p className="mt-10 text-xs text-ink-muted">{ENTITY.publicName}</p>
    </div>
  );
}
