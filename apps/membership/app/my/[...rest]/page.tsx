// Everything under `/my`, sent where it now lives.
//
// The sibling `/my/page.tsx` handles the bare address; this catches what was
// below it, so a link somebody kept — or a path we have since forgotten —
// lands on the matching part of my.thread rather than on a 404.
//
// The mapping lives in `../portal-path.ts` rather than here, because a page
// file may export only the page.

import { redirect } from 'next/navigation';
import { surfaceUrl } from '@thefibre/shared';
import { headers } from 'next/headers';
import { portalPathFor } from '../portal-path';

export const dynamic = 'force-dynamic';

export default async function MyDeepRedirect({
  params,
}: {
  params: Promise<{ rest?: string[] }>;
}) {
  const host = (await headers()).get('host');
  const portal = surfaceUrl('my-portal', process.env, host);
  const { rest } = await params;
  redirect(`${portal}${portalPathFor(rest ?? [])}`);
}
