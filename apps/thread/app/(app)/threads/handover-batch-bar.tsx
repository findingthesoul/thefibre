'use client';

// Handover v2, the new organiser's side: a request for several threads of an
// organiser who has left. Each thread keeps its own card below (accept or
// decline it alone); this bar answers every open one at once. A thread that
// cannot be accepted yet (payments not ready) stays waiting, and is named.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { t } from '@/lib/i18n-ui';
import type { Locale } from '@thefibre/shared';
import { answerHandoverBatch } from './actions';

export function HandoverBatchBar({
  locale,
  batchId,
  fromName,
  count,
  reason,
}: {
  locale: Locale;
  batchId: string;
  fromName: string;
  count: number;
  reason: string | null;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<{ title: string; error?: string }[]>([]);

  function answer(kind: 'accept' | 'decline') {
    setErr(null);
    startTransition(async () => {
      const r = await answerHandoverBatch(batchId, kind);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setWaiting(r.results.filter((x) => !x.ok));
      router.refresh();
    });
  }

  return (
    <div className={`${NOTICE.warning} mb-2`}>
      {/* A batch only ever comes from the departed door: the ask is an admin's. */}
      <p>{t(locale, 'handover_batch_incoming_departed', { name: fromName, count: String(count) })}</p>
      {reason && <p className="mt-1 text-xs">{reason}</p>}
      <p className="mt-1 text-xs">{t(locale, 'handover_moves')}</p>
      {waiting.map((w, i) => (
        <p key={i} className="mt-1 text-xs">
          {t(locale, 'handover_batch_waiting', { title: w.title, reason: w.error ?? '' })}
        </p>
      ))}
      {err && <p className={`${NOTICE.error} mt-1 text-xs`}>{err}</p>}
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => answer('decline')}>
          {t(locale, 'handover_decline_all')}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => answer('accept')}>
          {t(locale, 'handover_accept_all')}
        </Button>
      </div>
    </div>
  );
}
