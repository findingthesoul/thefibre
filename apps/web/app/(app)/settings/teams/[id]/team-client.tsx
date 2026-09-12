'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { t, type Locale } from '@/lib/i18n-ui';
import type { GrantableApp } from '../teams-client';
import { addTeamMember, removeTeamMember, setTeamApps, updateTeam } from '../actions';

export type TeamDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_published: boolean;
};

export type TeamMember = {
  user_id: string;
  role: 'lead' | 'member';
  status: string;
  full_name: string | null;
  email: string | null;
};

type Grant = { slug: string; lead_is_app_admin: boolean };

const SELECT_CLASS =
  'w-32 rounded-md border border-line bg-surface-raised px-2 py-1.5 text-sm focus:border-line-strong focus:outline-none';

export function TeamDetailClient({
  team,
  members,
  apps,
  grantable,
  canEditGrants,
  workspaceMembers,
  locale,
}: {
  team: TeamDetail;
  members: TeamMember[];
  apps: Grant[];
  grantable: GrantableApp[];
  canEditGrants: boolean;
  workspaceMembers: { user_id: string; full_name: string | null; email: string }[];
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [published, setPublished] = useState(team.is_published);
  const [grants, setGrants] = useState<Map<string, boolean>>(
    () => new Map(apps.map((a) => [a.slug, a.lead_is_app_admin])),
  );
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const activeCount = members.filter((m) => m.status === 'active').length;

  // What the save is about to hand out that the team does not already confer.
  const added = useMemo(() => {
    const before = new Set(apps.map((a) => a.slug));
    return [...grants.keys()].filter((slug) => !before.has(slug));
  }, [grants, apps]);
  const dirty = useMemo(() => {
    if (grants.size !== apps.length) return true;
    return apps.some((a) => grants.get(a.slug) !== a.lead_is_app_admin);
  }, [grants, apps]);

  function onPublished(next: boolean) {
    const prev = published;
    setPublished(next);
    setError(null);
    start(async () => {
      const r = await updateTeam(team.id, { is_published: next });
      if (r.error) {
        setPublished(prev);
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  function onSaveGrants() {
    setError(null);
    start(async () => {
      const r = await setTeamApps(
        team.id,
        [...grants.entries()].map(([slug, lead_is_app_admin]) => ({ slug, lead_is_app_admin })),
      );
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  function onRemove(member: TeamMember) {
    setError(null);
    start(async () => {
      const r = await removeTeamMember(team.id, member.user_id);
      setRemoving(null);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="mt-10 space-y-12">
      {error && (
        <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Apps ─────────────────────────────────────────────────────── */}
      <section>
        <SectionLabel>{t(locale, 'team_apps')}</SectionLabel>
        <p className="mt-1 text-sm text-ink-muted">{t(locale, 'team_apps_help')}</p>

        {!canEditGrants ? (
          <p className="mt-4 text-sm text-ink-muted">{t(locale, 'team_grants_need_pro')}</p>
        ) : (
          <>
            <div className="mt-4 space-y-2">
              {grantable.map((app) => {
                const on = grants.has(app.slug);
                return (
                  <div key={app.slug} className="flex items-center justify-between gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded border-line"
                        checked={on}
                        disabled={pending}
                        onChange={(e) => {
                          const next = new Map(grants);
                          if (e.target.checked) next.set(app.slug, false);
                          else next.delete(app.slug);
                          setGrants(next);
                        }}
                      />
                      <span className={on ? 'text-ink' : 'text-ink-muted'}>{app.name}</span>
                    </label>
                    {on && (
                      <select
                        className={SELECT_CLASS}
                        value={grants.get(app.slug) ? 'lead_admin' : 'member'}
                        disabled={pending}
                        onChange={(e) => {
                          const next = new Map(grants);
                          next.set(app.slug, e.target.value === 'lead_admin');
                          setGrants(next);
                        }}
                      >
                        <option value="member">{t(locale, 'team_role_member')}</option>
                        <option value="lead_admin">{t(locale, 'team_lead_is_admin')}</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            {/* The whole defence against applying immediately: say how many
                people this reaches BEFORE the save, so widening is never
                silent. */}
            {added.length > 0 && activeCount > 0 && (
              <p className="mt-4 rounded-md border border-line bg-surface-sunken p-3 text-sm">
                {activeCount} {t(locale, 'team_widen_warning')}
              </p>
            )}

            <div className="mt-4">
              <Button onClick={onSaveGrants} disabled={pending || !dirty}>
                {pending ? t(locale, 'saving') : t(locale, 'save_changes')}
              </Button>
            </div>
          </>
        )}
      </section>

      {/* ── People ───────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between gap-4">
          <SectionLabel>{t(locale, 'team_members_label')}</SectionLabel>
          <Button
            size="sm"
            leading={<UserPlus size={14} strokeWidth={1.75} />}
            onClick={() => setAdding(true)}
            disabled={pending}
          >
            {t(locale, 'add_to_team')}
          </Button>
        </div>

        {members.length === 0 ? (
          <EmptyState>{t(locale, 'no_team_members_yet')}</EmptyState>
        ) : (
          <ListGroup>
            {members.map((m) => (
              <ListRow
                key={m.user_id}
                primary={m.full_name ?? m.email ?? m.user_id}
                secondary={m.email ?? undefined}
                meta={
                  m.role === 'lead' ? t(locale, 'team_role_lead') : t(locale, 'team_role_member')
                }
                trailing={
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={pending}
                    onClick={() => setRemoving(m)}
                  >
                    {t(locale, 'remove_ellipsis')}
                  </Button>
                }
              />
            ))}
          </ListGroup>
        )}
      </section>

      {/* ── Public page ──────────────────────────────────────────────── */}
      <section>
        <SectionLabel>{t(locale, 'team_published')}</SectionLabel>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-line"
            checked={published}
            disabled={pending}
            onChange={(e) => onPublished(e.target.checked)}
          />
          <span>
            {team.slug}
            <span className="block text-xs text-ink-muted">
              {t(locale, 'team_published_help')}
            </span>
          </span>
        </label>
      </section>

      {adding && (
        <AddPersonDialog
          locale={locale}
          candidates={workspaceMembers.filter(
            (w) => !members.some((m) => m.user_id === w.user_id),
          )}
          onClose={() => setAdding(false)}
          onAdd={(userId, role) => {
            setError(null);
            start(async () => {
              const r = await addTeamMember(team.id, userId, role);
              setAdding(false);
              if (r.error) setError(r.error);
              else router.refresh();
            });
          }}
          pending={pending}
        />
      )}

      <ConfirmDialog
        open={!!removing}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && onRemove(removing)}
        title={t(locale, 'remove_member')}
        message={t(locale, 'remove_member_msg', {
          name: removing?.full_name ?? removing?.email ?? '',
        })}
        confirmLabel={t(locale, 'remove_member')}
        destructive
        pending={pending}
      />
    </div>
  );
}

function AddPersonDialog({
  locale,
  candidates,
  onClose,
  onAdd,
  pending,
}: {
  locale: Locale;
  candidates: { user_id: string; full_name: string | null; email: string }[];
  onClose: () => void;
  onAdd: (userId: string, role: 'lead' | 'member') => void;
  pending: boolean;
}) {
  const [userId, setUserId] = useState(candidates[0]?.user_id ?? '');
  const [role, setRole] = useState<'lead' | 'member'>('member');

  return (
    <Dialog
      open
      onClose={() => !pending && onClose()}
      title={t(locale, 'add_to_team')}
      description={t(locale, 'team_apps_help')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button onClick={() => userId && onAdd(userId, role)} disabled={pending || !userId}>
            {pending ? t(locale, 'adding') : t(locale, 'add_to_team')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm text-ink-subtle">{t(locale, 'team_members_label')}</span>
          <select
            className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none"
            value={userId}
            disabled={pending}
            onChange={(e) => setUserId(e.target.value)}
          >
            {candidates.map((c) => (
              <option key={c.user_id} value={c.user_id}>
                {c.full_name ? `${c.full_name} · ${c.email}` : c.email}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-ink-subtle">{t(locale, 'role')}</span>
          <select
            className="mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none"
            value={role}
            disabled={pending}
            onChange={(e) => setRole(e.target.value as 'lead' | 'member')}
          >
            <option value="member">{t(locale, 'team_role_member')}</option>
            <option value="lead">{t(locale, 'team_role_lead')}</option>
          </select>
        </label>
      </div>
    </Dialog>
  );
}
