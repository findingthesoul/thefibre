import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { MeetingTypeForm, type MeetingTypeFormValues } from '../form';

type MT = MeetingTypeFormValues & { id: string };

export default async function EditMeetingTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The list endpoint returns my MTs; pick by id.
  let mt: MT | null = null;
  try {
    const data = await apiFetch<{ items: MT[] }>('/api/v1/meet/meeting-types');
    mt = data.items.find((m) => m.id === id) ?? null;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  if (!mt) notFound();

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <Link
        href="/meeting-types"
        className="text-sm text-ink-subtle hover:text-ink"
      >
        ← Meeting types
      </Link>
      <h1 className="mt-6 text-3xl font-medium tracking-tight">{mt.name}</h1>
      <p className="mt-1 text-sm text-ink-subtle font-mono">slug: {mt.slug}</p>

      <div className="mt-10">
        <MeetingTypeForm initial={mt} />
      </div>
    </div>
  );
}
