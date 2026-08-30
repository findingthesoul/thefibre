// The door list — for everyone who didn't bring their QR. Mobile-first:
// a search field, big tappable rows, a running count. The QR path lands on
// /checkin/[code] instead; both call the same action.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { one } from '@/lib/thread-types';
import { DoorList, type DoorRow } from './door-list';

type EnrolmentListRow = {
  id: string;
  payment_status: string | null;
  checked_in_at: string | null;
  person:
    | { first_name: string | null; last_name: string | null; email: string | null }
    | { first_name: string | null; last_name: string | null; email: string | null }[]
    | null;
  enrolment: { status: string | null } | { status: string | null }[] | null;
};

export default async function CheckinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let title = '';
  try {
    const thread = await apiFetch<{
      program: { title: string } | { title: string }[] | null;
    }>(`/api/v1/thread/threads/${id}`);
    title = one(thread.program)?.title ?? '';
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const { items } = await apiFetch<{ items: EnrolmentListRow[] }>(
    `/api/v1/thread/enrolments?thread_id=${id}`,
  );

  const rows: DoorRow[] = items
    .map((r) => {
      const p = one(r.person);
      const e = one(r.enrolment);
      return {
        id: r.id,
        name: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.email || 'Unknown',
        email: p?.email ?? null,
        status: e?.status ?? null,
        payment_status: r.payment_status,
        checked_in_at: r.checked_in_at,
      };
    })
    // Declined applications don't belong on a door list.
    .filter((r) => r.status !== 'dropped')
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <nav className="text-sm">
        <Link href={`/threads/${id}`} className="text-ink-subtle hover:text-ink">
          ← {title || 'Thread'}
        </Link>
      </nav>
      <h1 className="mt-3 text-xl font-medium tracking-tight">Check-in</h1>
      <DoorList threadId={id} initialRows={rows} />
    </main>
  );
}
