'use client';

// The organisation page's publish switch, on the screen that is ABOUT that
// page. A wrapper for the same reason PublicPageCard next door is one: a
// server component cannot hand a plain function (`pageUrl`) to a client
// component — only server actions cross that boundary — and this folder's
// page.tsx is a server component. So the function is built on this side.
//
// `showAddress` is false because the header above already carries a Preview
// link to the very same URL, and two copies of one address read as two
// addresses.
//
// Everything else — the three states, the NULL grandfathering, the notice —
// comes from the shared component with `kind="organisation"` picking the
// words. A second copy is how the person's switch and this one would drift,
// and they are the same promise made about two different pages.

import { useRouter } from 'next/navigation';
import { PublicPageSwitch } from '@thefibre/shared/ui/public-page-switch';
import { THREAD_ORIGIN } from '@/lib/public-host';
import { setOrganisationPage } from '../actions';

export function OrganisationPageCard({
  slug,
  isPublished,
}: {
  slug: string;
  isPublished: boolean | null;
}) {
  const router = useRouter();
  return (
    <PublicPageSwitch
      kind="organisation"
      page={{ slug, is_published: isPublished }}
      pageUrl={(s) => `${THREAD_ORIGIN}/${s}`}
      showAddress={false}
      onChange={async (published) => {
        const r = await setOrganisationPage(published);
        // The header's Preview link should stop offering to open a page that
        // is now off. revalidatePath alone does not repaint the client route
        // in this flow (CLAUDE.md gotcha), so ask for the refresh here.
        if (r.ok) router.refresh();
        return r;
      }}
    />
  );
}
