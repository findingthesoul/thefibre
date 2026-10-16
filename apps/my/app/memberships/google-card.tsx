'use client';

// The Google Workspace address a membership includes (builder 4's routes,
// lib/google-account.ts; Sjoerd, 2026-10-16). Shown only when the membership
// carries a google_user grant AND the community has Google connected —
// `applies: false` renders nothing, and so does a failed read: this is an
// extra on a membership card, and an error line on every card of somebody
// whose memberships have no Google account would be noise about nothing.
//
// The Fibre creates nothing in Google. The member accepts the suggestion or
// asks for another address; an admin creates it by hand (Members → Settings
// → Google addresses) and marks it created, which this card then shows.

import { useEffect, useState } from 'react';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { Button } from '@thefibre/shared/ui/button';
import { TextField, TextAreaField } from '@thefibre/shared/ui/fields';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { portalCall, PortalCallError } from '@/lib/membership-portal-client';
import { t } from '@/lib/i18n';

type View = {
  applies: boolean;
  domain: string | null;
  status: 'none' | 'suggested' | 'requested' | 'created' | 'declined';
  suggested_address: string | null;
  requested_address: string | null;
  created_address: string | null;
  note: string | null;
  decline_reason: string | null;
};

const localOf = (address: string | null) => (address ? address.split('@')[0] ?? '' : '');

export function GoogleCard({ memberId }: { memberId: string }) {
  const locale = useLocale();
  const [view, setView] = useState<View | null>(null);
  const [asking, setAsking] = useState(false);
  const [local, setLocal] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    portalCall<View>(`/me/google?member_id=${encodeURIComponent(memberId)}`, undefined, locale).then(setView, () => setView(null));
  }, [memberId, locale]);

  if (!view?.applies || !view.domain) return null;

  async function send(body: { action: 'accept' } | { action: 'ask'; local_part: string; note?: string }) {
    setBusy(true);
    setError(null);
    try {
      setView(await portalCall<View>('/me/google', { member_id: memberId, ...body }, locale));
      setAsking(false);
    } catch (e) {
      const code = e instanceof PortalCallError ? e.code : undefined;
      setError(code === 'address_taken' ? t(locale, 'g_taken') : code === 'bad_local_part' ? t(locale, 'g_bad') : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startAsking() {
    setLocal(localOf(view!.requested_address ?? view!.suggested_address));
    setNote(view!.note ?? '');
    setError(null);
    setAsking(true);
  }

  const mono = 'font-mono text-sm text-ink';
  return (
    <section className="mt-4 rounded-xl border border-line px-4 py-3" aria-label={t(locale, 'g_title')}>
      <h3 className="text-sm font-medium text-ink">{t(locale, 'g_title')}</h3>

      {view.status === 'created' && view.created_address && (
        <p className="mt-1 text-sm text-ink-subtle">{t(locale, 'g_created', { address: view.created_address })}</p>
      )}

      {view.status === 'suggested' && !asking && (
        <>
          <p className="mt-1 text-sm text-ink-subtle">{t(locale, 'g_suggested')}</p>
          <p className={`mt-1 ${mono}`}>{view.suggested_address}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => send({ action: 'accept' })} disabled={busy}>
              {busy ? t(locale, 'saving') : t(locale, 'g_use')}
            </Button>
            <Button type="button" variant="secondary" onClick={startAsking} disabled={busy}>
              {t(locale, 'g_other')}
            </Button>
          </div>
        </>
      )}

      {view.status === 'requested' && !asking && (
        <>
          <p className="mt-1 text-sm text-ink-subtle">{t(locale, 'g_requested', { address: view.requested_address ?? '' })}</p>
          <button type="button" onClick={startAsking} className="mt-2 inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70">
            {t(locale, 'g_change')}
          </button>
        </>
      )}

      {view.status === 'declined' && !asking && (
        <>
          <p className="mt-1 text-sm text-ink-subtle">{t(locale, 'g_declined')}</p>
          {view.decline_reason && <p className="mt-1 text-sm text-ink-subtle">{t(locale, 'g_reason', { reason: view.decline_reason })}</p>}
          <button type="button" onClick={startAsking} className="mt-2 inline-flex min-h-11 items-center text-sm text-ink underline underline-offset-2 hover:opacity-70">
            {t(locale, 'g_ask_again')}
          </button>
        </>
      )}

      {asking && (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send({ action: 'ask', local_part: local.trim(), ...(note.trim() ? { note: note.trim() } : {}) });
          }}
        >
          <TextField
            label={t(locale, 'g_address')}
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            hint={`@${view.domain}`}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
            required
          />
          <TextAreaField label={t(locale, 'g_note')} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || !local.trim()}>
              {busy ? t(locale, 'saving') : t(locale, 'g_send')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAsking(false)} disabled={busy}>
              {t(locale, 'cancel')}
            </Button>
          </div>
        </form>
      )}

      {error && <p className={`mt-2 ${NOTICE.error}`}>{error}</p>}
    </section>
  );
}
