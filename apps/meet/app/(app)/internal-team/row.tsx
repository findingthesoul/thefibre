'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { patchMember } from './actions';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';

// super_admin | admin | organiser — the values the API accepts. This screen
// offered 'member' until v0.18.8, which the database has rejected since the
// role-tiers migration, so changing anyone's role here failed outright.
type WorkspaceRole = 'super_admin' | 'admin' | 'organiser';

export type Member = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  email_verified: boolean;
  has_meet: boolean;
  workspace_role: WorkspaceRole;
  relationship_type: 'internal' | 'external';
  member_status: string | null;
};

const ROLE_KEY: Record<WorkspaceRole, UiKey> = {
  organiser: 'role_organiser',
  admin: 'role_admin',
  super_admin: 'role_super_admin',
};

export function MemberRow({
  member,
  editable,
  locale,
}: {
  member: Member;
  editable: boolean;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function update(
    patch: Partial<{
      workspace_role: WorkspaceRole;
      relationship_type: 'internal' | 'external';
    }>,
  ) {
    setError(null);
    startTransition(async () => {
      const r = await patchMember(member.id, patch);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <li className="flex items-center justify-between gap-4 px-5 py-4 text-sm">
      <div className="min-w-0">
        <div className="font-medium truncate">{member.full_name ?? member.email}</div>
        <div className="mt-0.5 text-xs text-ink-muted truncate">{member.email}</div>
        {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-wider">
        {!member.email_verified && (
          <span className="text-ink-muted border border-line rounded px-1.5 py-0.5">
            {t(locale, 'status_pending')}
          </span>
        )}
        {!member.has_meet && (
          <span className="text-ink-muted border border-line rounded px-1.5 py-0.5">
            {t(locale, 'badge_no_meet')}
          </span>
        )}
        {editable ? (
          <select
            value={member.workspace_role}
            disabled={pending}
            onChange={(e) =>
              update({ workspace_role: e.target.value as WorkspaceRole })
            }
            className="rounded-md border border-line bg-surface-raised px-2 py-1 text-[10px] uppercase tracking-wider"
          >
            <option value="organiser">{t(locale, 'role_organiser')}</option>
            <option value="admin">{t(locale, 'role_admin')}</option>
            <option value="super_admin">{t(locale, 'role_super_admin')}</option>
          </select>
        ) : (
          <span
            className={`rounded px-1.5 py-0.5 border border-line ${
              member.workspace_role === 'admin' || member.workspace_role === 'super_admin'
                ? 'bg-ink text-surface-raised border-ink'
                : 'text-ink-muted'
            }`}
          >
            {t(locale, ROLE_KEY[member.workspace_role])}
          </span>
        )}
        {editable ? (
          <select
            value={member.relationship_type}
            disabled={pending}
            onChange={(e) =>
              update({
                relationship_type: e.target.value as 'internal' | 'external',
              })
            }
            className="rounded-md border border-line bg-surface-raised px-2 py-1 text-[10px] uppercase tracking-wider"
          >
            <option value="internal">{t(locale, 'internal')}</option>
            <option value="external">{t(locale, 'external')}</option>
          </select>
        ) : (
          <span
            className={`rounded px-1.5 py-0.5 border ${
              member.relationship_type === 'external'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-line text-ink-muted'
            }`}
          >
            {member.relationship_type === 'external' ? t(locale, 'external') : t(locale, 'internal')}
          </span>
        )}
      </div>
    </li>
  );
}
