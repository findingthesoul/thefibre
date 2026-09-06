'use client';

// The archived-workspace redirect (13-month Free archive). The API already
// refuses everything outside the allowlist; this makes the UI honest about
// it — an archived workspace lands on Settings → Plan (reactivation banner)
// instead of a page of failed fetches. Client-side because the server
// layout has no pathname; the API gate is the enforcement, this is UX.

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const ALLOWED = ['/settings/plan', '/privacy'];

export function ArchivedGate({ archived }: { archived: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!archived) return;
    if (ALLOWED.some((p) => pathname.startsWith(p))) return;
    router.replace('/settings/plan');
  }, [archived, pathname, router]);
  return null;
}
