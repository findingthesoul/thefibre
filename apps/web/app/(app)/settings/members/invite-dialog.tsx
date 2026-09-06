'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { APPS, type AppSlug } from '@/lib/apps';
import { t, type Locale } from '@/lib/i18n-ui';
import { inviteMember } from './actions';

const SELECT_CLASS =
  'mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none';

export function InviteDialog({
  appSlugs,
  locale,
  onClose,
}: {
  appSlugs: AppSlug[];
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<'internal' | 'external'>('internal');
  const [grants, setGrants] = useState<Map<string, 'member' | 'admin'>>(() => new Map());
  // Also surfaces the API's 402 seat-limit message — it explains seats/allowance.
  const [error, setError] = useState<string | null>(null);
  // Set when the API answered "this adds a paid seat — confirm first". The
  // sentence (incl. the €/month figure) is the SERVER's; the next submit
  // carries accept_seat_cost. Any edit to the form clears it — a confirmation
  // belongs to the invite it was shown for.
  const [seatConfirm, setSeatConfirm] = useState<string | null>(null);

  function onGrant(slug: string, role: '' | 'member' | 'admin') {
    setSeatConfirm(null);
    setGrants((prev) => {
      const next = new Map(prev);
      if (role) next.set(slug, role);
      else next.delete(slug);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const accepting = seatConfirm !== null;
    start(async () => {
      const r = await inviteMember(
        {
          email,
          name: name.trim() ? name.trim() : undefined,
          relationship_type: relationship,
          apps: [...grants.entries()].map(([slug, role]) => ({ slug, role })),
        },
        accepting,
      );
      if (r.seatConfirmation) {
        setSeatConfirm(r.seatConfirmation.message);
      } else if (r.error) {
        setSeatConfirm(null);
        setError(r.error);
      } else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, 'add_member')}
      description={t(locale, 'invite_blurb')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="invite-member-form" disabled={pending || !email.trim()}>
            {pending
              ? t(locale, 'sending')
              : seatConfirm
                ? t(locale, 'confirm_send_invite')
                : t(locale, 'send_invite')}
          </Button>
        </>
      }
    >
      <form id="invite-member-form" onSubmit={submit} className="space-y-4">
        <TextField
          label={t(locale, 'email_label')}
          name="email"
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => {
            setSeatConfirm(null);
            setEmail(e.target.value);
          }}
          placeholder="them@example.org"
        />
        <TextField
          label={t(locale, 'name')}
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t(locale, 'optional')}
        />

        <label className="block">
          <span className="text-sm text-ink-subtle">{t(locale, 'relationship')}</span>
          <select
            className={SELECT_CLASS}
            value={relationship}
            onChange={(e) => setRelationship(e.target.value as 'internal' | 'external')}
          >
            <option value="internal">{t(locale, 'internal')}</option>
            <option value="external">{t(locale, 'external')}</option>
          </select>
        </label>

        {appSlugs.length > 0 && (
          <div>
            <span className="text-sm text-ink-subtle">{t(locale, 'nav_apps')}</span>
            <div className="mt-2 space-y-2">
              {appSlugs.map((slug) => (
                <label key={slug} className="flex items-center justify-between gap-4 text-sm">
                  <span className={grants.has(slug) ? 'text-ink' : 'text-ink-muted'}>
                    {APPS[slug].label}
                  </span>
                  <select
                    value={grants.get(slug) ?? ''}
                    onChange={(e) => onGrant(slug, e.target.value as '' | 'member' | 'admin')}
                    className="w-32 rounded-md border border-line bg-surface-raised px-2 py-1.5 text-sm focus:border-line-strong focus:outline-none"
                  >
                    <option value="">—</option>
                    <option value="member">{t(locale, 'role_member')}</option>
                    <option value="admin">{t(locale, 'role_admin')}</option>
                  </select>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              {t(locale, 'no_access_by_default')}
            </p>
          </div>
        )}

        {seatConfirm && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {seatConfirm} {t(locale, 'seat_confirm_suffix')}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
