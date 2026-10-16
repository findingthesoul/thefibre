'use client';

// Handing this thread to another organiser — the editor's side of
// docs/organiser-handover-design.md. Above the timeline, like the calendar
// tray: a pending request is shown to both people involved (with Cancel for
// the proposer, Accept/Decline for the proposed organiser), and otherwise the
// organiser — or an admin, for an organiser who has left — gets one quiet
// button that opens the request dialog. The API decides who may do what;
// this only shows the doors that apply.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SwitchField } from '@/components/ui/switch';
import { TextAreaField } from '@/components/ui/field';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { t } from '@/lib/i18n-ui';
import { INTL_LOCALES, type Locale } from '@thefibre/shared';
import type { WorkspaceMember } from '@/lib/thread-types';
import { answerHandover, proposeHandover, type HandoverItem } from '../actions';

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export function HandoverPanel({
  locale,
  threadId,
  organiserUserId,
  meUserId,
  isAdmin,
  workspaceMembers,
  pending,
}: {
  locale: Locale;
  threadId: string;
  organiserUserId: string | null;
  meUserId: string | null;
  isAdmin: boolean;
  workspaceMembers: WorkspaceMember[];
  /** This thread's pending request, if any (GET /handovers). */
  pending: HandoverItem | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [departed, setDeparted] = useState(false);
  const [paymentProblem, setPaymentProblem] = useState<string | null>(null);

  const isOrganiser = !!meUserId && meUserId === organiserUserId;
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

  function answer(kind: 'accept' | 'decline' | 'cancel') {
    if (!pending) return;
    setErr(null);
    startTransition(async () => {
      const r = await answerHandover(pending.id, kind, threadId);
      if (!r.ok) setErr(r.error);
      else router.refresh();
    });
  }

  if (pending) {
    const toName = pending.to_name ?? one(pending.to)?.display_name ?? '—';
    const fromName = pending.from_name ?? one(pending.from)?.display_name ?? '—';
    const title = one(one(pending.thread)?.program)?.title ?? '';
    return (
      <div className={`${NOTICE.warning} mb-4`}>
        <p>
          {pending.incoming
            ? t(locale, 'handover_incoming', { name: fromName, title })
            : t(locale, 'handover_pending_out', { name: toName, date: fmt(pending.expires_at) })}
        </p>
        {pending.reason && <p className="mt-1 text-xs">{pending.reason}</p>}
        {pending.incoming && <p className="mt-1 text-xs">{t(locale, 'handover_moves')}</p>}
        {err && <p className="mt-1 text-xs text-red-700">{err}</p>}
        <div className="mt-2 flex gap-2">
          {pending.incoming ? (
            <>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => answer('decline')}>
                {t(locale, 'handover_decline')}
              </Button>
              <Button size="sm" disabled={busy} onClick={() => answer('accept')}>
                {t(locale, 'handover_accept')}
              </Button>
            </>
          ) : pending.proposed_by_user_id === meUserId ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => answer('cancel')}>
              {t(locale, 'handover_cancel')}
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  // No request open: only the organiser, or an admin, has a door here.
  if (!isOrganiser && !isAdmin) return null;

  const formId = `handover-${threadId}`;
  const options = workspaceMembers
    .filter((m) => m.user_id !== organiserUserId)
    .map((m) => ({ value: m.user_id, label: m.full_name || m.email || m.user_id, hint: m.email ?? undefined }));

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    startTransition(async () => {
      const door = !isOrganiser && departed ? 'admin_departed' : 'organiser';
      const r = await proposeHandover(threadId, {
        to_user_id: to,
        keep_as_host: door === 'organiser' ? fd.get('keep_as_host') === 'on' : false,
        door,
        ...(door === 'admin_departed' ? { reason: String(fd.get('reason') ?? '') } : {}),
      });
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      setPaymentProblem(r.payment_problem);
      if (!r.payment_problem) setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          {t(locale, 'handover_title')}
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t(locale, 'handover_title')}
        description={t(locale, 'handover_desc')}
        footer={
          <>
            {err && <span className="mr-auto text-xs text-red-700">{err}</span>}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t(locale, 'cancel')}
            </Button>
            <Button type="submit" form={formId} disabled={busy || !to || (!isOrganiser && !departed)}>
              {t(locale, 'handover_send')}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} className="space-y-4 text-sm">
          <div>
            <p className="mb-1 text-xs text-ink-muted">{t(locale, 'handover_to')}</p>
            <SearchSelect value={to} onChange={setTo} options={options} />
          </div>
          {isOrganiser ? (
            <SwitchField label={t(locale, 'handover_keep_host')} name="keep_as_host" defaultChecked />
          ) : (
            <>
              <SwitchField label={t(locale, 'handover_departed')} checked={departed} onChange={setDeparted} />
              {departed && <TextAreaField label={t(locale, 'handover_reason')} name="reason" required />}
            </>
          )}
          <p className="text-xs text-ink-muted">{t(locale, 'handover_moves')}</p>
          {paymentProblem && (
            <p className={NOTICE.warning}>{t(locale, 'handover_payment_warn', { problem: paymentProblem })}</p>
          )}
        </form>
      </Dialog>
    </>
  );
}
