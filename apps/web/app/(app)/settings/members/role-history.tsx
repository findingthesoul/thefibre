'use client';

// "Role history" in the member dialog: who changed this person's role, and
// when (role_change, 2026-10-16). Collapsed until asked for, then read once;
// admins only (the API refuses anyone else, and only admins reach this
// dialog). A line with no person behind it says what did it instead — a
// membership, the workspace being created, or "not recorded who" for a
// change made outside the app.

import { useState } from 'react';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { getRoleHistory, type RoleHistoryItem } from './actions';

export function RoleHistory({ locale, userId }: { locale: Locale; userId: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RoleHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && items === null) {
      const r = await getRoleHistory(userId);
      if (r.error) setError(r.error);
      else setItems(r.items ?? []);
    }
  }

  const role = (v: string | null) =>
    v === 'super_admin' ? 'Super Admin' : v === 'admin' ? t(locale, 'role_admin') : v === 'organiser' ? t(locale, 'rh_organiser') : v ?? '—';
  const rel = (v: string | null) => (v === 'external' ? t(locale, 'rh_external') : v === 'internal' ? t(locale, 'rh_internal') : v ?? '—');
  const what = (i: RoleHistoryItem): string => {
    switch (i.kind) {
      case 'workspace_role':
        return `${role(i.old_value)} → ${role(i.new_value)}`;
      case 'relationship':
        return `${rel(i.old_value)} → ${rel(i.new_value)}`;
      case 'member_added':
        return t(locale, 'rh_added', { role: role(i.new_value) });
      case 'member_removed':
        return t(locale, 'rh_removed');
      case 'app_role':
        return `${i.app ?? '—'}: ${i.old_value ?? '—'} → ${i.new_value ?? t(locale, 'rh_no_access')}`;
    }
  };
  const who = (i: RoleHistoryItem): string =>
    i.changed_by
      ? t(locale, 'rh_by', { name: i.changed_by })
      : i.source === 'membership-seat'
        ? t(locale, 'rh_by_membership')
        : i.source === 'first-admin'
          ? t(locale, 'rh_by_creation')
          : t(locale, 'rh_by_unknown');

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="text-sm text-ink-subtle underline-offset-2 hover:text-ink hover:underline"
      >
        {t(locale, 'rh_title')}
      </button>
      {open && (
        <div className="mt-2">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {!error && items === null && <p className="text-sm text-ink-muted">…</p>}
          {items && items.length === 0 && <p className="text-sm text-ink-muted">{t(locale, 'rh_empty')}</p>}
          {items && items.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex flex-wrap gap-x-2">
                  <span className="tabular-nums text-ink-muted">
                    {new Date(i.at).toLocaleDateString(INTL_LOCALES[locale], { dateStyle: 'medium' })}
                  </span>
                  <span className="text-ink">{what(i)}</span>
                  <span className="text-ink-subtle">{who(i)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
