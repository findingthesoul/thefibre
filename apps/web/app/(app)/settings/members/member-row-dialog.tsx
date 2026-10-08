'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { APPS, type AppSlug } from '@/lib/apps';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { updateMember, type MemberPatch } from '../actions';
import { removeMember, setTeamMembership } from './actions';
import type { Member } from './members-client';
import type { InviteTeam } from './invite-dialog';

const SELECT_CLASS =
  'mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none';

// Save-on-change, deliberately: each select persists immediately with
// optimistic revert (the exact handlers the old inline cards had), so the
// footer is just a Close button — there's nothing left to "Save".
export function MemberRowDialog({
  member,
  appSlugs,
  workspaceTeams,
  locale,
  onClose,
}: {
  member: Member;
  appSlugs: AppSlug[];
  /** Every team in the workspace, including the automatic pair — the same
   *  list the invite dialog gets. Which of them THIS person is in comes from
   *  `member.teams`. */
  workspaceTeams: InviteTeam[];
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  // Optimistic view of the mutable bits. Reverted on API error.
  const [role, setRole] = useState(member.workspace_role);
  const [relationship, setRelationship] = useState(member.relationship_type);
  const [grants, setGrants] = useState<Map<string, string>>(
    () => new Map(member.apps.map((a) => [a.slug, a.role])),
  );
  const [teamIds, setTeamIds] = useState<Set<string>>(
    () => new Set((member.teams ?? []).map((t) => t.id)),
  );

  /** Which team confers an app, for the note beside it. The API resolves
   *  this (`apps_via`); the dialog never works it out from the team list,
   *  because a team can grant an app a person ALSO has a direct tick for and
   *  only the resolver knows which way round that lands. */
  const viaBySlug = new Map(
    (member.apps_via ?? []).map((v) => [v.slug, v.via.filter(Boolean)] as const),
  );

  // The automatic pair is shown, never offered: the workspace decides who is
  // in them (everybody, and whoever holds the admin role), and the API
  // refuses a membership write on either. Admins appears only when this
  // person is actually in it — an unticked row for a team they cannot be put
  // into is a control that does nothing.
  const inAutomatic = new Set(
    (member.teams ?? []).filter((t) => t.automatic).map((t) => t.automatic as string),
  );
  const everyoneTeam = workspaceTeams.find((t) => t.automatic === 'everyone');
  const adminsTeam = workspaceTeams.find((t) => t.automatic === 'admins');
  const ordinaryTeams = workspaceTeams.filter((t) => !t.automatic);

  function onTeam(teamId: string, join: boolean) {
    const prev = new Set(teamIds);
    const next = new Set(teamIds);
    if (join) next.add(teamId);
    else next.delete(teamId);
    setTeamIds(next);
    setError(null);
    start(async () => {
      const r = await setTeamMembership(teamId, member.user_id, join);
      if (r.error) {
        setTeamIds(prev);
        setError(r.error);
      } else {
        // The apps a team confers follow from the server, so the row's
        // "via" notes are only right after a refresh.
        router.refresh();
      }
    });
  }

  function patch(p: MemberPatch, revert: () => void) {
    setError(null);
    start(async () => {
      const r = await updateMember(member.user_id, p);
      if (r.error) {
        revert();
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  function onRole(next: 'super_admin' | 'admin' | 'organiser') {
    const prev = role;
    setRole(next);
    patch({ workspace_role: next }, () => setRole(prev));
  }

  function onRelationship(next: 'internal' | 'external') {
    const prev = relationship;
    setRelationship(next);
    patch({ relationship_type: next }, () => setRelationship(prev));
  }

  function onRemove() {
    setError(null);
    start(async () => {
      const r = await removeMember(member.user_id);
      if (r.error) {
        setConfirmingRemove(false);
        setError(r.error);
      } else {
        setConfirmingRemove(false);
        onClose();
        router.refresh();
      }
    });
  }

  function onGrant(slug: string, role: '' | 'member' | 'admin') {
    const prev = new Map(grants);
    const next = new Map(grants);
    if (role) next.set(slug, role);
    else next.delete(slug);
    setGrants(next);
    // apps REPLACES the grant set (incl. app-level roles) on the API side.
    patch(
      { apps: [...next.entries()].map(([s, r]) => ({ slug: s, role: r as 'member' | 'admin' })) },
      () => setGrants(prev),
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={member.full_name ?? member.email}
      description={member.email}
      footer={
        <>
          {/* Destructive left, Close right — the house dialog contract. */}
          <div className="mr-auto">
            <Button
              variant="danger"
              disabled={pending}
              onClick={() => setConfirmingRemove(true)}
            >
              {t(locale, 'remove_ellipsis')}
            </Button>
          </div>
          <Button variant="secondary" onClick={onClose}>
            {t(locale, 'close')}
          </Button>
        </>
      }
    >
      <div className={`space-y-4 ${pending ? 'opacity-70' : ''}`}>
        <label className="block">
          <span className="text-sm text-ink-subtle">{t(locale, 'role')}</span>
          <select
            className={SELECT_CLASS}
            value={role}
            disabled={pending}
            onChange={(e) => onRole(e.target.value as 'super_admin' | 'admin' | 'organiser')}
          >
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="organiser">{t(locale, 'organiser_default')}</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-ink-subtle">{t(locale, 'relationship')}</span>
          <select
            className={SELECT_CLASS}
            value={relationship}
            disabled={pending}
            onChange={(e) => onRelationship(e.target.value as 'internal' | 'external')}
          >
            <option value="internal">{t(locale, 'internal')}</option>
            <option value="external">{t(locale, 'external')}</option>
          </select>
        </label>

        {/* TEAMS FIRST. What somebody can open follows from the teams they are
            in; the app ticks underneath are the exception. The invite dialog
            was arranged this way in v1.113.0 and says the same words — two
            screens about the same decision should not teach two models. */}
        {workspaceTeams.length > 0 && (
          <div>
            <span className="text-sm text-ink-subtle">{t(locale, 'invite_teams')}</span>
            <p className="mt-0.5 text-xs text-ink-muted">{t(locale, 'invite_teams_help')}</p>
            <div className="mt-2 space-y-2">
              {everyoneTeam && (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-ink">{everyoneTeam.name}</span>
                  <span className="text-xs text-ink-muted">
                    {t(locale, 'invite_everyone_always')}
                  </span>
                </div>
              )}
              {adminsTeam && inAutomatic.has('admins') && (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-ink">{adminsTeam.name}</span>
                  <span className="text-xs text-ink-muted">
                    {t(locale, 'member_admins_follows_role')}
                  </span>
                </div>
              )}
              {ordinaryTeams.map((team) => (
                <label key={team.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={teamIds.has(team.id)}
                    disabled={pending}
                    onChange={(e) => onTeam(team.id, e.target.checked)}
                    className="h-4 w-4 rounded border-line"
                  />
                  <span className={teamIds.has(team.id) ? 'text-ink' : 'text-ink-muted'}>
                    {team.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {appSlugs.length > 0 && (
          <div>
            <span className="text-sm text-ink-subtle">{t(locale, 'nav_apps')}</span>
            <p className="mt-0.5 text-xs text-ink-muted">{t(locale, 'no_access_by_default')}</p>
            <div className="mt-2 space-y-2">
              {appSlugs.map((slug) => (
                <label key={slug} className="flex items-center justify-between gap-4 text-sm">
                  <span className={grants.has(slug) ? 'text-ink' : 'text-ink-muted'}>
                    {APPS[slug].label}
                    {/* WHY they have it. Without this an admin looking at a
                        ticked app cannot tell a deliberate exception from
                        something a team handed out, and taking the tick away
                        would appear to do nothing. */}
                    {(viaBySlug.get(slug)?.length ?? 0) > 0 && (
                      <span className="ml-2 text-xs text-ink-muted">
                        {t(locale, 'member_app_via', { team: viaBySlug.get(slug)!.join(', ') })}
                      </span>
                    )}
                  </span>
                  {/* — = no access · Member = uses the app · Admin = manages
                      the app's content without workspace admin (RLS
                      has_app_role gate — Membership honours it first). */}
                  <select
                    value={grants.get(slug) ?? ''}
                    disabled={pending}
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
          </div>
        )}

        {error && (
          <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <p className="text-xs text-ink-muted">
          {t(locale, 'joined')}{' '}
          {new Date(member.joined_at).toLocaleDateString(INTL_LOCALES[locale], {
            dateStyle: 'medium',
          })}
          {' · '}
          {t(locale, 'changes_save_immediately')}
        </p>
      </div>

      <ConfirmDialog
        open={confirmingRemove}
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={onRemove}
        title={t(locale, 'remove_member')}
        message={t(locale, 'remove_member_msg', { name: member.full_name ?? member.email })}
        confirmLabel={t(locale, 'remove_member')}
        destructive
        pending={pending}
      />
    </Dialog>
  );
}
