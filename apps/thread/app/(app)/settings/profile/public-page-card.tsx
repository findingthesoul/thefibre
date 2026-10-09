'use client';

// The publish switch, on the screen that is ABOUT the public page.
//
// A wrapper, and it earns its existence twice over:
//
//  1. `pageUrl` is a plain function. A server component cannot pass one to a
//     client component — only server actions cross that boundary — and
//     page.tsx here IS a server component. The Fibre never hit this because
//     its profile form is already a client component and renders the card
//     from inside. So the function has to be built on this side of the line.
//  2. The address belongs to this screen already: it sits in an editable
//     field a few pixels above, with a Visit link. `showAddress={false}`
//     keeps the card from printing a second copy, which would read as a
//     second address rather than the same one.
//
// Everything else — the three states, the notice, the words — comes from the
// shared component, because this screen and The Fibre's must not drift.

import { useRouter } from 'next/navigation';
import { PublicPageSwitch, type PublicPage } from '@thefibre/shared/ui/public-page-switch';
import { THREAD_ORIGIN } from '@/lib/public-host';
import { setPublicPage } from '../actions';

export function PublicPageCard({ page }: { page: PublicPage | null }) {
  const router = useRouter();
  return (
    <PublicPageSwitch
      page={page}
      pageUrl={(slug) => `${THREAD_ORIGIN}/${slug}`}
      onChange={async (published) => {
        const r = await setPublicPage(published);
        // The REST of this screen renders from the organiser row — the Visit
        // link withdraws itself when the page is off. The server action's
        // revalidatePath alone did not repaint it (CLAUDE.md gotcha: a server
        // action does not auto-refresh the client route in this flow), so the
        // card asks for the refresh itself. Without it the switch says off
        // while the link beside it still offers to open the page.
        if (r.ok) router.refresh();
        return r;
      }}
      showAddress={false}
    />
  );
}
