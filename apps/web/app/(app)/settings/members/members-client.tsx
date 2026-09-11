'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { APPS, type AppSlug } from '@/lib/apps';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { MemberRowDialog } from './member-row-dialog';
import { InviteDialog } from './invite-dialog';

export type Member = {
  user_id: string;
  full_name: string | null;
  email: string;
  workspace_role: 'super_admin' | 'admin' | 'organiser';
  relationship_type: 'internal' | 'external';
  joined_at: string;
  apps: { slug: string; role: string }[];
  /** Apps a team confers, and which team — so "why does she have Pulse?"
      is answerable from this screen (teams as access groups, 2026-09-11). */
  apps_via?: { slug: string; via: string[] }[];
};

// Role names are product vocabulary — the same words in every locale.
const ROLE_LABELS: Record<Member['workspace_role'], string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  organiser: 'Organiser',
};

// Compact per-row grant summary: "Meet · Thread · Membership (admin)".
// An app a team confers is named with the team, because an admin looking at
// this row needs to know the tick is not where that access comes from.
function appsSummary(member: Member, locale: Locale): string {
  if (member.apps.length === 0) return '—';
  const viaBySlug = new Map((member.apps_via ?? []).map((v) => [v.slug, v.via]));
  return member.apps
    .map((a) => {
      const label = (APPS as Record<string, { label: string } | undefined>)[a.slug]?.label ?? a.slug;
      const base = a.role === 'admin' ? `${label} (admin)` : label;
      const via = viaBySlug.get(a.slug);
      return via?.length ? `${base} (${t(locale, 'apps_via_team')} ${via.join(', ')})` : base;
    })
    .join(' · ');
}

export function MembersClient({
  members,
  appSlugs,
  locale,
}: {
  members: Member[];
  appSlugs: AppSlug[];
  locale: Locale;
}) {
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);

  return (
    <>
      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <SectionLabel>{t(locale, 'workspace_members')}</SectionLabel>
          <Button
            leading={<UserPlus size={16} strokeWidth={1.75} />}
            onClick={() => setAdding(true)}
          >
            {t(locale, 'add_member')}
          </Button>
        </div>

        <div className="mt-4 rounded-lg border border-line bg-surface-raised overflow-hidden">
          {members.length === 0 ? (
            <EmptyState>{t(locale, 'no_members_yet')}</EmptyState>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  <th className="px-5 py-2.5 font-medium">{t(locale, 'name')}</th>
                  <th className="px-5 py-2.5 font-medium">{t(locale, 'email_label')}</th>
                  <th className="px-5 py-2.5 font-medium">{t(locale, 'role')}</th>
                  <th className="px-5 py-2.5 font-medium">{t(locale, 'relationship')}</th>
                  <th className="px-5 py-2.5 font-medium">{t(locale, 'nav_apps')}</th>
                  <th className="px-5 py-2.5 font-medium">{t(locale, 'joined')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {members.map((m) => (
                  <tr
                    key={m.user_id}
                    onClick={() => setSelected(m)}
                    className="cursor-pointer hover:bg-surface-sunken"
                  >
                    <td className="px-5 py-3 text-ink">{m.full_name ?? m.email}</td>
                    <td className="px-5 py-3 text-ink-muted">{m.email}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink-subtle">
                        {ROLE_LABELS[m.workspace_role]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-subtle">
                      {t(locale, m.relationship_type === 'internal' ? 'internal' : 'external')}
                    </td>
                    <td className="px-5 py-3 text-ink-muted">{appsSummary(m, locale)}</td>
                    <td className="px-5 py-3 text-ink-muted">
                      {new Date(m.joined_at).toLocaleDateString(INTL_LOCALES[locale], {
                        dateStyle: 'medium',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {adding && <InviteDialog appSlugs={appSlugs} locale={locale} onClose={() => setAdding(false)} />}
      {selected && (
        <MemberRowDialog
          member={selected}
          appSlugs={appSlugs}
          locale={locale}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
