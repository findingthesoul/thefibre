'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tabs } from '@thefibre/shared/ui/tabs';
import { TextField, TextAreaField } from '@thefibre/shared/ui/fields';
import { NOTICE, PILL, PILL_TONE, ROW_LIST, type PillTone } from '@thefibre/shared/ui/recipes';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { declineGoogleAccount, markGoogleAccountCreated } from '../actions';

import { GA_STATUSES, type GaStatus } from './statuses';

export type GoogleAccountItem = {
  id: string;
  member_id: string;
  person_name: string | null;
  person_email: string | null;
  suggested_address: string | null;
  requested_address: string | null;
  note: string | null;
  status: string;
  created_address: string | null;
  decline_reason: string | null;
  requested_at: string | null;
  decided_at: string | null;
};

const TAB_KEY: Record<GaStatus, UiKey> = {
  requested: 'ga_tab_requested',
  created: 'ga_tab_created',
  declined: 'ga_tab_declined',
  all: 'ga_tab_all',
};
// 'suggested' = the member was offered an address and has not asked yet.
const STATUS: Record<string, { key: UiKey; tone: PillTone }> = {
  requested: { key: 'ga_tab_requested', tone: 'attention' },
  created: { key: 'ga_tab_created', tone: 'positive' },
  declined: { key: 'ga_tab_declined', tone: 'neutral' },
  suggested: { key: 'ga_status_suggested', tone: 'neutral' },
};

export function AccountsClient({
  status,
  items,
  domain,
  locale,
}: {
  status: GaStatus;
  items: GoogleAccountItem[] | null;
  domain: string | null;
  locale: Locale;
}) {
  const [acting, setActing] = useState<{ item: GoogleAccountItem; what: 'created' | 'decline' } | null>(null);
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

  return (
    <div className="space-y-5">
      {!domain && items !== null && (
        <p className={NOTICE.warning}>
          {t(locale, 'ga_not_connected')}{' '}
          <Link href="/settings/integrations" className="underline underline-offset-2">
            {t(locale, 'st_integrations_title')}
          </Link>
        </p>
      )}
      <p className="text-sm text-ink-subtle">{t(locale, 'ga_how')}</p>

      <Tabs
        link={Link}
        value={status}
        tabs={GA_STATUSES.map((s) => ({
          value: s,
          label: t(locale, TAB_KEY[s]),
          href: s === 'requested' ? '/settings/google-accounts' : `/settings/google-accounts?status=${s}`,
        }))}
      />

      {items === null ? (
        <p className={NOTICE.error}>{t(locale, 'ga_load_failed')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-subtle">{t(locale, status === 'requested' ? 'ga_empty_requested' : 'ga_empty')}</p>
      ) : (
        <ul className={ROW_LIST}>
          {items.map((it) => {
            const s = STATUS[it.status];
            const address = it.created_address ?? it.requested_address ?? it.suggested_address;
            return (
              <li key={it.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{it.person_name ?? it.person_email ?? '—'}</span>
                    {s && <span className={`${PILL} ${PILL_TONE[s.tone]}`}>{t(locale, s.key)}</span>}
                  </div>
                  {it.person_name && it.person_email && <p className="truncate text-xs text-ink-muted">{it.person_email}</p>}
                  {address && <p className="mt-1 truncate font-mono text-sm text-ink">{address}</p>}
                  {it.status === 'requested' && it.suggested_address && it.requested_address && it.requested_address !== it.suggested_address && (
                    <p className="text-xs text-ink-muted">
                      {t(locale, 'ga_suggested')}: {it.suggested_address}
                    </p>
                  )}
                  {it.note && <p className="mt-1 text-sm text-ink-subtle">“{it.note}”</p>}
                  {it.status === 'declined' && it.decline_reason && (
                    <p className="mt-1 text-xs text-ink-muted">
                      {t(locale, 'ga_reason')}: {it.decline_reason}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-ink-muted">
                    {it.decided_at
                      ? t(locale, 'ga_decided_on', { date: date(it.decided_at) })
                      : it.requested_at
                        ? t(locale, 'ga_requested_on', { date: date(it.requested_at) })
                        : ''}
                  </p>
                </div>
                {it.status === 'requested' && (
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" variant="secondary" onClick={() => setActing({ item: it, what: 'decline' })}>
                      {t(locale, 'ga_decline')}
                    </Button>
                    <Button type="button" onClick={() => setActing({ item: it, what: 'created' })} disabled={!domain}>
                      {t(locale, 'ga_mark_created')}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {acting && (
        <DecideDialog
          key={acting.item.id + acting.what}
          item={acting.item}
          what={acting.what}
          domain={domain}
          locale={locale}
          onClose={() => setActing(null)}
        />
      )}
    </div>
  );
}

function DecideDialog({
  item,
  what,
  domain,
  locale,
  onClose,
}: {
  item: GoogleAccountItem;
  what: 'created' | 'decline';
  domain: string | null;
  locale: Locale;
  onClose: () => void;
}) {
  const [value, setValue] = useState(what === 'created' ? (item.requested_address ?? item.suggested_address ?? '') : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const formId = `ga-${what}-form`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = what === 'created' ? await markGoogleAccountCreated(item.id, value.trim()) : await declineGoogleAccount(item.id, value.trim());
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    onClose();
    router.refresh();
  }

  const who = item.person_name ?? item.person_email ?? '';
  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, what === 'created' ? 'ga_created_title' : 'ga_decline_title')}
      description={what === 'created' ? t(locale, 'ga_created_desc', { who }) : who}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form={formId} disabled={busy || (what === 'created' && !value.trim())}>
            {busy ? t(locale, 'saving') : t(locale, what === 'created' ? 'ga_mark_created' : 'ga_decline')}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        {what === 'created' ? (
          <TextField
            label={t(locale, 'ga_address')}
            hint={domain ? `@${domain}` : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            required
          />
        ) : (
          <TextAreaField label={t(locale, 'ga_reason_optional')} value={value} onChange={(e) => setValue(e.target.value)} rows={3} maxLength={1000} />
        )}
        {error && <p className={NOTICE.error}>{error}</p>}
      </form>
    </Dialog>
  );
}
