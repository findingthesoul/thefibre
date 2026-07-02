'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { APPS, type AppSlug } from '@/lib/apps';
import { updateMember, inviteMember, type MemberPatch } from '../actions';

export type Member = {
  user_id: string;
  full_name: string | null;
  email: string;
  workspace_role: 'admin' | 'member';
  relationship_type: 'internal' | 'external';
  joined_at: string;
  apps: { slug: string; role: string }[];
};

const SELECT_CLASS =
  'rounded-md border border-line bg-surface-raised px-2 py-1.5 text-sm focus:border-line-strong focus:outline-none';

export function MembersClient({
  members,
  appSlugs,
}: {
  members: Member[];
  appSlugs: AppSlug[];
}) {
  return (
    <>
      <section className="mt-10">
        <SectionLabel>Workspace members</SectionLabel>
        {members.length === 0 ? (
          <EmptyState>No members yet.</EmptyState>
        ) : (
          <ul className="mt-4 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
            {members.map((m) => (
              <MemberRow key={m.user_id} member={m} appSlugs={appSlugs} />
            ))}
          </ul>
        )}
      </section>

      <InviteSection appSlugs={appSlugs} />
    </>
  );
}

function MemberRow({ member, appSlugs }: { member: Member; appSlugs: AppSlug[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Optimistic view of the mutable bits. Reverted on API error.
  const [role, setRole] = useState(member.workspace_role);
  const [relationship, setRelationship] = useState(member.relationship_type);
  const [grants, setGrants] = useState<Set<string>>(
    () => new Set(member.apps.map((a) => a.slug)),
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

  function onRole(next: 'admin' | 'member') {
    const prev = role;
    setRole(next);
    patch({ workspace_role: next }, () => setRole(prev));
  }

  function onRelationship(next: 'internal' | 'external') {
    const prev = relationship;
    setRelationship(next);
    patch({ relationship_type: next }, () => setRelationship(prev));
  }

  function onGrant(slug: string, checked: boolean) {
    const prev = new Set(grants);
    const next = new Set(grants);
    if (checked) next.add(slug);
    else next.delete(slug);
    setGrants(next);
    // apps REPLACES the grant set on the API side.
    patch({ apps: [...next] }, () => setGrants(prev));
  }

  return (
    <li className={`px-5 py-4 ${pending ? 'opacity-70' : ''}`}>
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="font-medium truncate">{member.full_name ?? member.email}</div>
          <div className="text-sm text-ink-subtle truncate">{member.email}</div>
        </div>
        <div className="text-xs text-ink-muted shrink-0">
          Joined{' '}
          {new Date(member.joined_at).toLocaleDateString('en-GB', {
            dateStyle: 'medium',
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-ink-muted">
            Role
          </span>
          <select
            className={`mt-1 ${SELECT_CLASS}`}
            value={role}
            disabled={pending}
            onChange={(e) => onRole(e.target.value as 'admin' | 'member')}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
        </label>

        <label className="block">
          <span className="block text-[10px] uppercase tracking-wider text-ink-muted">
            Relationship
          </span>
          <select
            className={`mt-1 ${SELECT_CLASS}`}
            value={relationship}
            disabled={pending}
            onChange={(e) =>
              onRelationship(e.target.value as 'internal' | 'external')
            }
          >
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        </label>

        {appSlugs.length > 0 && (
          <div>
            <span className="block text-[10px] uppercase tracking-wider text-ink-muted">
              Apps
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 py-1.5">
              {appSlugs.map((slug) => (
                <label
                  key={slug}
                  className="inline-flex items-center gap-1.5 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="accent-ink"
                    checked={grants.has(slug)}
                    disabled={pending}
                    onChange={(e) => onGrant(slug, e.target.checked)}
                  />
                  {APPS[slug].label}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <div className="mt-2 text-xs text-red-700">{error}</div>}
    </li>
  );
}

function InviteSection({ appSlugs }: { appSlugs: AppSlug[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<'internal' | 'external'>('internal');
  const [grants, setGrants] = useState<Set<string>>(() => new Set());
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);

  function toggleGrant(slug: string, checked: boolean) {
    setGrants((prev) => {
      const next = new Set(prev);
      if (checked) next.add(slug);
      else next.delete(slug);
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    start(async () => {
      const r = await inviteMember({
        email,
        name: name.trim() ? name.trim() : undefined,
        relationship_type: relationship,
        apps: [...grants],
      });
      if (r.error) {
        setResult({ error: r.error });
      } else {
        setResult({
          ok: r.invited
            ? `Invite sent to ${email}.`
            : `${email} added to the workspace.`,
        });
        setEmail('');
        setName('');
        setRelationship('internal');
        setGrants(new Set());
        router.refresh();
      }
    });
  }

  return (
    <section className="mt-14">
      <SectionLabel>Invite someone</SectionLabel>
      <form
        onSubmit={submit}
        className="mt-4 rounded-lg border border-line bg-surface-raised p-5 space-y-4 max-w-xl"
      >
        <TextField
          label="Email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="them@example.org"
        />
        <TextField
          label="Name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Optional"
        />

        <label className="block">
          <span className="text-sm text-ink-subtle">Relationship</span>
          <select
            className={`mt-1 w-full ${SELECT_CLASS} px-3 py-2`}
            value={relationship}
            onChange={(e) =>
              setRelationship(e.target.value as 'internal' | 'external')
            }
          >
            <option value="internal">Internal</option>
            <option value="external">External</option>
          </select>
        </label>

        {appSlugs.length > 0 && (
          <div>
            <span className="text-sm text-ink-subtle">Apps</span>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              {appSlugs.map((slug) => (
                <label
                  key={slug}
                  className="inline-flex items-center gap-1.5 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="accent-ink"
                    checked={grants.has(slug)}
                    onChange={(e) => toggleGrant(slug, e.target.checked)}
                  />
                  {APPS[slug].label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              None selected by default — grant only what they need.
            </p>
          </div>
        )}

        {result?.error && (
          <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-red-700">
            {result.error}
          </div>
        )}
        {result?.ok && (
          <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
            {result.ok}
          </div>
        )}

        <Button
          type="submit"
          disabled={pending || !email.trim()}
          leading={<UserPlus size={16} strokeWidth={1.75} />}
        >
          {pending ? 'Sending…' : 'Send invite'}
        </Button>
      </form>
    </section>
  );
}
