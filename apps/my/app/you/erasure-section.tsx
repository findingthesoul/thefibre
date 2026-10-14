// The "remove your data" section, fetched AFTER the page has painted.
//
// `/me/portal/erasure` costs 576ms on staging — measured, three runs — which
// made it the second-heaviest call on this page, behind only the portal
// itself. It was being awaited before anything rendered, so every visit to
// the You tab paid for a disclosure almost nobody opens.
//
// NOT DEFERRED UNTIL SOMEBODY CLICKS, though, and that distinction matters:
// when a person HAS asked to be forgotten, this section is not a disclosure
// at all, it is their answer — "you asked on the 3rd, someone must reply by
// the 17th". Hiding that behind a click would hide it from exactly the person
// who needs it, and they would have no reason to look.
//
// So it streams instead. The page renders at once; this arrives when it
// arrives, with a shape holding its place. Nobody waits for it and nobody
// loses it.

import { loadErasure } from '@/lib/session';
import { RemoveData } from './remove-data';

async function ErasureBody() {
  const erasure = await loadErasure();
  if (!erasure) return null;
  return <RemoveData picture={erasure} />;
}

/** The space it will occupy, so the page does not jump when it lands. */
export function ErasureFallback() {
  return (
    <section className="mt-10 border-t border-line pt-6" aria-busy="true">
      <div className="h-4 w-40 animate-pulse rounded bg-surface-sunken" />
      <div className="mt-2 h-3 w-72 max-w-full animate-pulse rounded bg-surface-sunken" />
    </section>
  );
}

export { ErasureBody };
