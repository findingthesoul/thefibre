'use client';

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import { CARD, ERROR_TEXT } from '@thefibre/shared/ui/recipes';
import { SearchSelect, type SearchSelectOption } from '@thefibre/shared/ui/search-select';
import { Dialog } from '@/components/ui/dialog';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { addMember, removeMember, resendInvite, type SaveResult } from '../actions';

export type MemberCandidate = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  relationship_type: 'internal' | 'external' | null;
};

// One person search (Sjoerd, 2026-09-15: "a name type: select... and if it
// not yet exist a popup with a user creation... default set as external").
// Everyone already in the workspace is in the list, so picking adds them with
// the relationship they already have. Somebody you have to create is by
// definition not in the workspace yet, so the create dialog starts at
// External. The API ignores relationship for existing members anyway.
export function AddMemberForm({
  teamId,
  candidates,
  locale,
}: {
  teamId: string;
  candidates: MemberCandidate[];
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picked, setPicked] = useState('');
  const [role, setRole] = useState<'member' | 'lead'>('member');
  const [draft, setDraft] = useState<{ name: string; email: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const options: SearchSelectOption[] = candidates.map((c) => ({
    value: c.user_id,
    label: c.full_name || c.email || c.user_id.slice(0, 8),
    hint: [c.email, c.relationship_type === 'external' ? t(locale, 'external') : null]
      .filter(Boolean)
      .join(' · '),
  }));

  function submit(fields: {
    email: string;
    name?: string;
    role: 'member' | 'lead';
    relationship_type: 'internal' | 'external';
  }, after: () => void) {
    setError(null);
    setNotice(null);
    const fd = new FormData();
    fd.set('email', fields.email);
    if (fields.name) fd.set('name', fields.name);
    fd.set('role', fields.role);
    fd.set('relationship_type', fields.relationship_type);
    startTransition(async () => {
      const r = await addMember(teamId, {}, fd);
      if (r.error) {
        setError(r.error);
        return;
      }
      if (r.invited) setNotice(t(locale, 'invite_sent_team'));
      after();
      router.refresh();
    });
  }

  function addPicked() {
    const c = candidates.find((x) => x.user_id === picked);
    if (!c?.email) return;
    submit(
      { email: c.email, role, relationship_type: c.relationship_type ?? 'internal' },
      () => setPicked(''),
    );
  }

  return (
    <div className={`${CARD} p-5 space-y-3`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
        <div>
          <span className="text-sm text-ink-subtle">{t(locale, 'add_a_member')}</span>
          <SearchSelect
            className="mt-1"
            value={picked}
            onChange={setPicked}
            options={options}
            placeholder={t(locale, 'member_search_placeholder')}
            onCreate={(typed) =>
              setDraft(
                typed.includes('@') ? { name: '', email: typed } : { name: typed, email: '' },
              )
            }
            createLabel={(typed) => t(locale, 'member_create_row', { name: typed })}
          />
        </div>
        <SelectField
          label={t(locale, 'role')}
          value={role}
          onChange={(e) => setRole(e.target.value as 'member' | 'lead')}
          options={[
            { value: 'member', label: t(locale, 'role_member') },
            { value: 'lead', label: t(locale, 'role_lead') },
          ]}
        />
        <Button type="button" variant="save" onClick={addPicked} disabled={pending || !picked}>
          {pending && !draft ? t(locale, 'adding') : t(locale, 'add')}
        </Button>
      </div>
      <p className="text-xs text-ink-muted">{t(locale, 'member_search_hint')}</p>
      {error && !draft && <div className={ERROR_TEXT}>{error}</div>}
      {notice && <div className="text-sm text-ink-subtle">{notice}</div>}

      <NewMemberDialog
        draft={draft}
        pending={pending}
        error={draft ? error : null}
        locale={locale}
        onClose={() => {
          setDraft(null);
          setError(null);
        }}
        onSubmit={(fields) => submit(fields, () => setDraft(null))}
      />
    </div>
  );
}

function NewMemberDialog({
  draft,
  pending,
  error,
  locale,
  onClose,
  onSubmit,
}: {
  draft: { name: string; email: string } | null;
  pending: boolean;
  error: string | null;
  locale: Locale;
  onClose: () => void;
  onSubmit: (fields: {
    email: string;
    name?: string;
    role: 'member' | 'lead';
    relationship_type: 'internal' | 'external';
  }) => void;
}) {
  return (
    <Dialog
      open={!!draft}
      onClose={onClose}
      title={t(locale, 'member_create_title')}
      description={t(locale, 'member_create_desc')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="new-team-member" disabled={pending}>
            {pending ? t(locale, 'adding') : t(locale, 'invite_member')}
          </Button>
        </>
      }
    >
      {draft && (
        <form
          id="new-team-member"
          // key: a second "Invite …" starts from the new typed text.
          key={`${draft.name}|${draft.email}`}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get('name') ?? '').trim();
            onSubmit({
              email: String(fd.get('email') ?? '').trim().toLowerCase(),
              ...(name ? { name } : {}),
              role: fd.get('role') === 'lead' ? 'lead' : 'member',
              relationship_type: fd.get('relationship_type') === 'internal' ? 'internal' : 'external',
            });
          }}
        >
          <TextField label={t(locale, 'name')} name="name" defaultValue={draft.name} autoFocus={!draft.name} />
          <TextField
            label={t(locale, 'email')}
            name="email"
            type="email"
            defaultValue={draft.email}
            placeholder="colleague@example.com"
            required
            autoFocus={!!draft.name}
          />
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label={t(locale, 'role')}
              name="role"
              defaultValue="member"
              options={[
                { value: 'member', label: t(locale, 'role_member') },
                { value: 'lead', label: t(locale, 'role_lead') },
              ]}
            />
            <SelectField
              label={t(locale, 'relationship')}
              name="relationship_type"
              defaultValue="external"
              options={[
                { value: 'external', label: t(locale, 'external') },
                { value: 'internal', label: t(locale, 'internal') },
              ]}
            />
          </div>
          <p className="text-xs text-ink-muted">{t(locale, 'relationship_hint')}</p>
          {error && <div className={ERROR_TEXT}>{error}</div>}
        </form>
      )}
    </Dialog>
  );
}

export function RemoveMemberButton({
  teamId,
  userId,
  locale,
}: {
  teamId: string;
  userId: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await removeMember(teamId, userId);
            if (r.error) setError(r.error);
            else router.refresh();
          });
        }}
        className="text-xs text-ink-subtle hover:text-red-700 underline underline-offset-2 disabled:opacity-50"
      >
        {pending ? '…' : t(locale, 'remove')}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}

export function PendingInviteRow({
  teamId,
  userId,
  email,
  name,
  role,
  token,
  invitedAt,
  locale,
}: {
  teamId: string;
  userId: string;
  email: string;
  name: string | null;
  role: 'lead' | 'member';
  token: string;
  invitedAt: string | null;
  locale: Locale;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin.replace(/\/+$/, '')}/invite/${token}`
      : `/invite/${token}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  function resend() {
    setError(null);
    startTransition(async () => {
      const r = await resendInvite(teamId, userId);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  function revoke() {
    setError(null);
    startTransition(async () => {
      const r = await removeMember(teamId, userId);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <li className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4 text-sm">
      <div className="min-w-0">
        <div className="font-medium truncate">{name ?? email}</div>
        <div className="mt-0.5 text-xs text-ink-muted truncate">
          {email} ·{' '}
          <span className="uppercase tracking-wider">
            {role === 'lead' ? t(locale, 'role_lead') : t(locale, 'role_member')}
          </span>
          {invitedAt && (
            <>
              {' · '}
              {t(locale, 'invited_on', {
                date: new Date(invitedAt).toLocaleDateString(INTL_LOCALES[locale], {
                  day: '2-digit',
                  month: '2-digit',
                }),
              })}
            </>
          )}
        </div>
        {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
          title={url}
        >
          {copied ? t(locale, 'copied_short') : t(locale, 'copy_link')}
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={pending}
          className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2 disabled:opacity-50"
        >
          {pending ? '…' : t(locale, 'resend')}
        </button>
        <button
          type="button"
          onClick={revoke}
          disabled={pending}
          className="text-xs text-ink-subtle hover:text-red-700 underline underline-offset-2 disabled:opacity-50"
        >
          {t(locale, 'revoke')}
        </button>
      </div>
    </li>
  );
}
