'use client';

// How a meeting type ends.
//
// Two doors, and which one you get is decided by the API, not here: a
// meeting type that has ever been booked cannot be deleted at all, because
// `meet_booking.meeting_type_id` is a non-null FK with no cascade and those
// rows are the record of meetings that actually happened. So Archive is the
// normal way out and Delete is for the one you created by mistake. The UI
// offers both and lets the server refuse — a client-side booking count would
// be a second opinion that can be wrong.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DangerConfirmDialog } from '@thefibre/shared/ui/danger-confirm';
import { t, type Locale } from '@/lib/i18n-ui';
import {
  archiveMeetingType,
  unarchiveMeetingType,
  deleteMeetingType,
} from '../actions';

export function RetireMeetingType({
  id,
  name,
  archived,
  locale,
}: {
  id: string;
  name: string;
  archived: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function run(fn: () => Promise<{ ok?: boolean; error?: string }>, after: () => void) {
    setErr(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setErr(r.error);
      else after();
    });
  }

  return (
    <div className="rounded-lg border border-line bg-surface-raised p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-subtle max-w-xl">
          {archived ? t(locale, 'unarchive_desc') : t(locale, 'archive_desc')}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {archived ? (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => run(() => unarchiveMeetingType(id), () => router.refresh())}
            >
              {t(locale, 'unarchive')}
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                run(() => archiveMeetingType(id), () => router.push('/meeting-types'))
              }
            >
              {t(locale, 'archive')}
            </Button>
          )}
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            onClick={() => setConfirmDelete(true)}
          >
            {t(locale, 'delete')}
          </Button>
        </div>
      </div>
      {err && <p className="mt-3 text-sm text-red-700">{err}</p>}

      <DangerConfirmDialog
        open={confirmDelete}
        title={t(locale, 'delete_mt_title')}
        message={t(locale, 'delete_mt_message', { name })}
        confirmLabel={t(locale, 'delete')}
        pending={pending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          run(
            () => deleteMeetingType(id),
            () => {
              setConfirmDelete(false);
              router.push('/meeting-types');
            },
          )
        }
      />
    </div>
  );
}
