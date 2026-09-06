'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { DateField } from '@/components/ui/date-field';
import { COUNTRIES } from '@thefibre/shared/countries';
import { SearchSelect } from '@thefibre/shared/ui/search-select';
import { Button } from '@/components/ui/button';
import { t, INTL_LOCALES, type Locale, type UiKey } from '@/lib/i18n-ui';
import { approveAccess, getMemberAccess, patchMember } from './actions';
import { OrgSeats } from './org-seats';
import { StatusBadge } from './status-badge';
import { memberName, type Member, type MemberAccess, type MemberStatus, type Tier } from './types';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

const STATUSES: MemberStatus[] = ['active', 'grace', 'lapsed', 'cancelled'];

const STATUS_KEYS: Record<MemberStatus, UiKey> = {
  active: 'status_active',
  grace: 'status_grace',
  lapsed: 'status_lapsed',
  cancelled: 'status_cancelled',
};

// Date input gives YYYY-MM-DD; the API validates z.string().datetime().
export function dateToIso(date: string): string {
  return new Date(date + 'T00:00:00.000Z').toISOString();
}

const ACCESS_STYLES: Record<string, string> = {
  granted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  awaiting_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  revoke_pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  revoked: 'bg-surface-sunken text-ink-muted',
  error: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
};

const ACCESS_KEYS: Record<string, UiKey> = {
  granted: 'access_granted',
  pending: 'access_pending',
  awaiting_approval: 'access_awaiting_approval',
  revoke_pending: 'access_revoke_pending',
  revoked: 'access_revoked',
  error: 'access_error',
};

export function MemberDialog({
  member,
  tiers,
  locale,
  onClose,
}: {
  member: Member;
  tiers: Tier[];
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  // Org membership: the organisation holds the membership; its people
  // occupy seats (rendered below). Person concepts (country, access
  // journal) hide; seat allowance appears instead.
  const isOrg = Boolean(member.organisation_id);
  const [tierId, setTierId] = useState(member.tier_id);
  const [status, setStatus] = useState<MemberStatus>(member.status);
  const [renewsAt, setRenewsAt] = useState(member.renews_at?.slice(0, 10) ?? '');
  const [country, setCountry] = useState((member as { country?: string | null }).country ?? '');
  const [seatAllowance, setSeatAllowance] = useState(member.seat_allowance ?? 1);
  const [notes, setNotes] = useState(member.notes ?? '');
  const [access, setAccess] = useState<MemberAccess[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOrg) return; // the org row has no journal — its seats do
    let live = true;
    getMemberAccess(member.id).then((r) => {
      if (live) setAccess(r.data?.access ?? []);
    });
    return () => {
      live = false;
    };
  }, [member.id, isOrg]);

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const res = await patchMember(member.id, {
      tier_id: tierId,
      status,
      renews_at: renewsAt ? dateToIso(renewsAt) : null,
      notes: notes.trim() || null,
      ...(isOrg ? { seat_allowance: seatAllowance } : { country: country || null }),
    });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={memberName(member, t(locale, 'unknown_person'), t(locale, 'unknown_organisation'))}
      description={isOrg ? t(locale, 'org_membership') : member.person?.email ?? undefined}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="member-form" disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'tier')}</label>
            <select value={tierId} onChange={(e) => setTierId(e.target.value)} className={INPUT}>
              {tiers.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'status')}</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as MemberStatus)}
              className={INPUT}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(locale, STATUS_KEYS[s])}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DateField
          label={t(locale, 'renews_on')}
          name="renews_at"
          defaultValue={renewsAt || null}
          onValueChange={setRenewsAt}
        />
        {isOrg ? (
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'seat_allowance')}</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={seatAllowance}
              onChange={(e) => setSeatAllowance(Math.max(1, Number(e.target.value) || 1))}
              className={INPUT}
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              {t(locale, 'seat_allowance_edit_hint')}
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">{t(locale, 'country')}</label>
            <SearchSelect
              value={country}
              onChange={setCountry}
              options={COUNTRIES.map((c) => ({ value: c.code, label: c.name, hint: c.code }))}
              placeholder={t(locale, 'country_not_declared')}
              className="w-full"
            />
            <p className="mt-1.5 text-xs text-ink-muted">{t(locale, 'country_edit_hint')}</p>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={t(locale, 'optional_ph')}
            className={INPUT}
          />
        </div>

        {isOrg && <OrgSeats memberId={member.id} locale={locale} />}

        {!isOrg && (
        <div>
          <div className="text-sm font-medium mb-1">{t(locale, 'access_sync')}</div>
          {access === null ? (
            <p className="text-sm text-ink-muted">{t(locale, 'loading')}</p>
          ) : access.length === 0 ? (
            <p className="text-sm text-ink-muted">{t(locale, 'no_access_grants')}</p>
          ) : (
            <ul className="space-y-1.5">
              {access.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      ACCESS_STYLES[a.status] ?? 'bg-surface-sunken text-ink-muted'
                    }`}
                  >
                    {ACCESS_KEYS[a.status] ? t(locale, ACCESS_KEYS[a.status]) : a.status.replace('_', ' ')}
                  </span>
                  {a.external_ref && <span className="text-ink-subtle truncate">{a.external_ref}</span>}
                  {a.synced_at && (
                    <span className="text-xs text-ink-muted">
                      {t(locale, 'synced_on', {
                        date: new Date(a.synced_at).toLocaleDateString(INTL_LOCALES[locale]),
                      })}
                    </span>
                  )}
                  {a.last_error && <span className="text-xs text-red-700 truncate">{a.last_error}</span>}
                  {a.status === 'awaiting_approval' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setBusy(true);
                        setError(null);
                        void approveAccess(a.id).then((r) => {
                          setBusy(false);
                          if (r.error) setError(r.error);
                          else {
                            setAccess((prev) =>
                              prev?.map((x) => (x.id === a.id ? { ...x, status: 'granted' } : x)) ?? prev,
                            );
                            router.refresh();
                          }
                        });
                      }}
                      className="ml-auto rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-ink-inverse hover:opacity-90 disabled:opacity-50"
                    >
                      {t(locale, 'approve_seat')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
