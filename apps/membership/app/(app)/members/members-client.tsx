'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t, INTL_LOCALES, type Locale, type UiKey } from '@/lib/i18n-ui';
import { AddMemberDialog } from './add-member-dialog';
import { MemberDialog } from './member-dialog';
import { StatusBadge } from './status-badge';
import { memberName, type Member, type MemberStatus, type Tier } from './types';

const CHIPS: { key: UiKey; value: MemberStatus | '' }[] = [
  { key: 'chip_all', value: '' },
  { key: 'status_active', value: 'active' },
  { key: 'status_grace', value: 'grace' },
  { key: 'status_lapsed', value: 'lapsed' },
  { key: 'status_cancelled', value: 'cancelled' },
];

export function MembersClient({
  members,
  tiers,
  locale,
}: {
  members: Member[];
  tiers: Tier[];
  locale: Locale;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = params.get('status') ?? '';
  const tier = params.get('tier') ?? '';
  const q = params.get('q') ?? '';

  // Local echo of the search box so typing doesn't wait on navigation.
  const [search, setSearch] = useState(q);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`);
  }

  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => setParam('q', search.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">
            {t(locale, 'nav_members')}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">{t(locale, 'members_blurb')}</p>
        </div>
        <Button leading={<Plus size={16} strokeWidth={2} />} onClick={() => setAdding(true)}>
          {t(locale, 'add_member')}
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setParam('status', c.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                status === c.value
                  ? 'bg-ink text-ink-inverse'
                  : 'bg-surface-sunken text-ink-subtle hover:text-ink'
              }`}
            >
              {t(locale, c.key)}
            </button>
          ))}
        </div>
        <select
          value={tier}
          onChange={(e) => setParam('tier', e.target.value)}
          className="rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-sm focus:outline-none"
        >
          <option value="">{t(locale, 'all_tiers')}</option>
          {tiers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t(locale, 'search_name_email_ph')}
          className="w-56 rounded-md border border-line bg-surface-raised px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
        />
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface-raised overflow-hidden">
        {members.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-muted">
            {status || tier || q ? t(locale, 'no_members_filtered') : t(locale, 'no_members_yet')}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="px-5 py-2.5 font-medium">{t(locale, 'name')}</th>
                <th className="px-5 py-2.5 font-medium">{t(locale, 'th_email')}</th>
                <th className="px-5 py-2.5 font-medium">{t(locale, 'tier')}</th>
                <th className="px-5 py-2.5 font-medium">{t(locale, 'status')}</th>
                <th className="px-5 py-2.5 font-medium">{t(locale, 'renews_on')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {members.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className="cursor-pointer hover:bg-surface-sunken"
                >
                  <td className="px-5 py-3 text-ink">
                    {memberName(m, t(locale, 'unknown_person'), t(locale, 'unknown_organisation'))}
                    {m.organisation_id ? (
                      <span className="ml-2 rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-ink-subtle">
                        {t(locale, 'organisation')}
                      </span>
                    ) : m.org_member_id ? (
                      <span className="ml-2 text-xs text-ink-muted">
                        {t(locale, 'seat_word')}
                        {m.org_member?.organisation?.name ? ` · ${m.org_member.organisation.name}` : ''}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-ink-muted">
                    {m.organisation_id
                      ? (m.seat_allowance ?? 1) === 1
                        ? t(locale, 'one_seat')
                        : t(locale, 'n_seats', { n: m.seat_allowance ?? 1 })
                      : m.person?.email ?? '—'}
                  </td>
                  <td className="px-5 py-3">{m.tier?.name ?? '—'}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={m.status} locale={locale} />
                  </td>
                  <td className="px-5 py-3 text-ink-muted">
                    {m.renews_at
                      ? new Date(m.renews_at).toLocaleDateString(INTL_LOCALES[locale])
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adding && <AddMemberDialog tiers={tiers} locale={locale} onClose={() => setAdding(false)} />}
      {selected && (
        <MemberDialog
          member={selected}
          tiers={tiers}
          locale={locale}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
