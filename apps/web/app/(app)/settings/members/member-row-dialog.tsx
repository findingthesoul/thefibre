'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { APPS, type AppSlug } from '@/lib/apps';
import { updateMember, type MemberPatch } from '../actions';
import { removeMember } from './actions';
import type { Member } from './members-client';

const SELECT_CLASS =
  'mt-1 w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none';

// Save-on-change, deliberately: each select persists immediately with
// optimistic revert (the exact handlers the old inline cards had), so the
// footer is just a Close button — there's nothing left to "Save".
export function MemberRowDialog({
  member,
  appSlugs,
  onClose,
}: {
  member: Member;
  appSlugs: AppSlug[];
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
              Remove…
            </Button>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className={`space-y-4 ${pending ? 'opacity-70' : ''}`}>
        <label className="block">
          <span className="text-sm text-ink-subtle">Role</span>
          <select
            className={SELECT_CLASS}
            value={role}
            disabled={pending}
            onChange={(e) => onRole(e.target.value as 'super_admin' | 'admin' | 'organiser')}
          >
            <option value="super_admin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="organiser">Organiser (default)</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-ink-subtle">Relationship</span>
          <select
            className={SELECT_CLASS}
            value={relationship}
            disabled={pending}
            onChange={(e) => onRelationship(e.target.value as 'internal' | 'external')}
          >
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        </label>

        {appSlugs.length > 0 && (
          <div>
            <span className="text-sm text-ink-subtle">Apps</span>
            <div className="mt-2 space-y-2">
              {appSlugs.map((slug) => (
                <label key={slug} className="flex items-center justify-between gap-4 text-sm">
                  <span className={grants.has(slug) ? 'text-ink' : 'text-ink-muted'}>
                    {APPS[slug].label}
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
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
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
          Joined{' '}
          {new Date(member.joined_at).toLocaleDateString('en-GB', { dateStyle: 'medium' })}
          {' · '}Changes save immediately.
        </p>
      </div>

      <ConfirmDialog
        open={confirmingRemove}
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={onRemove}
        title="Remove member"
        message={
          <>
            Remove {member.full_name ?? member.email} from this workspace? They lose access to
            the workspace and its apps; they stay in your contacts. If this seat is billed, it
            stops billing from the next period — the paid month runs out, with no mid-month
            credit.
          </>
        }
        confirmLabel="Remove member"
        destructive
        pending={pending}
      />
    </Dialog>
  );
}
