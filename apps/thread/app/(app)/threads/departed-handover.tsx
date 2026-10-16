'use client';

// Handover v2 — an admin hands ALL the threads of an organiser who has LEFT
// the workspace to one new organiser, in one request. The list carries the
// single handover's checks per thread: a locked thread or one with a request
// already open is shown with its reason and cannot be ticked; a paid thread
// the new organiser cannot take money for yet is flagged, and goes in (only
// its accept waits). The API checks all of it again; this only shows it.

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { TextAreaField } from '@/components/ui/field';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { t } from '@/lib/i18n-ui';
import type { Locale } from '@thefibre/shared';
import type { WorkspaceMember } from '@/lib/thread-types';
import {
  previewDepartedHandover,
  proposeHandoverBatch,
  type BatchCandidate,
  type DepartedOrganiser,
} from './actions';

export function DepartedHandover({
  locale,
  departed,
  workspaceMembers,
}: {
  locale: Locale;
  departed: DepartedOrganiser[];
  workspaceMembers: WorkspaceMember[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const [from, setFrom] = useState(departed.length === 1 ? departed[0]!.organiser_id : '');
  const [to, setTo] = useState('');
  const [items, setItems] = useState<BatchCandidate[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ count: number; excluded: { title: string | null; reason: string }[] } | null>(null);

  // The list is judged as the NEW organiser, so it loads once both are picked.
  useEffect(() => {
    if (!open || !from || !to) {
      setItems(null);
      return;
    }
    let live = true;
    setErr(null);
    previewDepartedHandover(from, to).then((r) => {
      if (!live) return;
      if (!r.ok) {
        setErr(r.error);
        setItems(null);
        return;
      }
      setItems(r.items);
      setPicked(new Set(r.items.filter((i) => i.suggested).map((i) => i.thread_id)));
      setKeep(new Set());
    });
    return () => {
      live = false;
    };
  }, [open, from, to]);

  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason') ?? '');
    setErr(null);
    startTransition(async () => {
      const r = await proposeHandoverBatch({
        from_organiser_id: from,
        to_user_id: to,
        reason,
        threads: [...picked].map((id) => ({ id, keep_as_host: keep.has(id) })),
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setDone({ count: r.count, excluded: r.excluded });
      router.refresh();
    });
  }

  function close() {
    setOpen(false);
    setDone(null);
    setItems(null);
    setTo('');
  }

  const formId = 'departed-handover';
  const fromOptions = departed.map((d) => ({ value: d.organiser_id, label: d.name ?? '—', hint: String(d.thread_count) }));
  const toOptions = workspaceMembers.map((m) => ({
    value: m.user_id,
    label: m.full_name || m.email || m.user_id,
    hint: m.email ?? undefined,
  }));

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          {t(locale, 'handover_batch_title')}
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={close}
        title={t(locale, 'handover_batch_title')}
        description={t(locale, 'handover_batch_desc')}
        footer={
          <>
            {err && <span className={`${NOTICE.error} mr-auto text-xs`}>{err}</span>}
            <Button variant="ghost" onClick={close}>
              {t(locale, 'cancel')}
            </Button>
            {!done && (
              <Button type="submit" form={formId} disabled={busy || !from || !to || picked.size === 0}>
                {t(locale, 'handover_batch_send', { count: String(picked.size) })}
              </Button>
            )}
          </>
        }
      >
        {done ? (
          <div className="space-y-2 text-sm">
            <p className={NOTICE.success}>{t(locale, 'handover_batch_sent', { count: String(done.count) })}</p>
            {done.excluded.map((x, i) => (
              <p key={i} className={NOTICE.warning}>
                {t(locale, 'handover_batch_left_out', { title: x.title ?? '—', reason: x.reason })}
              </p>
            ))}
          </div>
        ) : (
          <form id={formId} onSubmit={submit} className="space-y-4 text-sm">
            <div>
              <p className="mb-1 text-xs text-ink-muted">{t(locale, 'handover_batch_from')}</p>
              <SearchSelect value={from} onChange={setFrom} options={fromOptions} />
            </div>
            <div>
              <p className="mb-1 text-xs text-ink-muted">{t(locale, 'handover_to')}</p>
              <SearchSelect value={to} onChange={setTo} options={toOptions} />
            </div>
            {!items ? (
              <p className="text-xs text-ink-muted">{t(locale, 'handover_batch_pick')}</p>
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line">
                {items.map((i) => (
                  <li key={i.thread_id} className="flex items-start gap-3 px-3 py-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      aria-label={i.title}
                      disabled={!!i.excluded}
                      checked={picked.has(i.thread_id)}
                      onChange={(e) => setPicked((s) => toggle(s, i.thread_id, e.target.checked))}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={i.excluded ? 'text-ink-muted' : ''}>{i.title}</p>
                      {(i.starts_on || i.ends_on) && (
                        <p className="text-xs text-ink-muted">
                          {[i.starts_on, i.ends_on].filter(Boolean).join(' – ')}
                        </p>
                      )}
                      {i.excluded && <p className="text-xs text-ink-muted">{i.excluded.reason}</p>}
                      {!i.excluded && i.payment_problem && (
                        <p className={`${NOTICE.warning} mt-1 text-xs`}>
                          {t(locale, 'handover_payment_warn', { problem: i.payment_problem })}
                        </p>
                      )}
                    </div>
                    {!i.excluded && picked.has(i.thread_id) && (
                      <Switch
                        checked={keep.has(i.thread_id)}
                        onChange={(v) => setKeep((s) => toggle(s, i.thread_id, v))}
                        label={t(locale, 'handover_batch_keep_host')}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            <TextAreaField label={t(locale, 'handover_reason')} name="reason" required />
            <p className="text-xs text-ink-muted">{t(locale, 'handover_moves')}</p>
          </form>
        )}
      </Dialog>
    </>
  );
}
