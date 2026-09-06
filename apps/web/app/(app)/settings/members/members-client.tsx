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
};

// Role names are product vocabulary — the same words in every locale.
const ROLE_LABELS: Record<Member['workspace_role'], string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  organiser: 'Organiser',
};

// Compact per-row grant summary: "Meet · Thread · Membership (admin)".
function appsSummary(member: Member): string {
  if (member.apps.length === 0) return '—';
  return member.apps
    .map((a) => {
      const label = (APPS as Record<string, { label: string } | undefined>)[a.slug]?.label ?? a.slug;
      return a.role === 'admin' ? `${label} (admin)` : label;
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
                    <td className="px-5 py-3 text-ink-muted">{appsSummary(m)}</td>
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
