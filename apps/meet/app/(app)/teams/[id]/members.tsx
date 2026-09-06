'use client';

import { useActionState, useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { addMember, removeMember, resendInvite, type SaveResult } from '../actions';

export function AddMemberForm({ teamId, locale }: { teamId: string; locale: Locale }) {
  const router = useRouter();
  const action = addMember.bind(null, teamId);
  const [state, formAction, pending] = useActionState<
    SaveResult & { invited?: boolean },
    FormData
  >(
    action as (
      prev: SaveResult & { invited?: boolean },
      fd: FormData,
    ) => Promise<SaveResult & { invited?: boolean }>,
    {},
  );

  return (
    <form
      action={async (fd) => {
        await formAction(fd);
        router.refresh();
      }}
      className="flex flex-wrap items-end gap-3 max-w-3xl"
    >
      <div className="flex-1 min-w-[14rem]">
        <TextField
          label={t(locale, 'add_a_member')}
          name="email"
          type="email"
          placeholder="colleague@example.com"
          required
        />
      </div>
      <div className="w-40">
        <TextField
          label={t(locale, 'name_optional')}
          name="name"
          placeholder={t(locale, 'if_new_to_fibre')}
        />
      </div>
      <div className="w-32">
        <SelectField
          label={t(locale, 'role')}
          name="role"
          defaultValue="member"
          options={[
            { value: 'member', label: t(locale, 'role_member') },
            { value: 'lead', label: t(locale, 'role_lead') },
          ]}
        />
      </div>
      <div className="w-40">
        <SelectField
          label={t(locale, 'relationship')}
          name="relationship_type"
          defaultValue="internal"
          options={[
            { value: 'internal', label: t(locale, 'internal') },
            { value: 'external', label: t(locale, 'external') },
          ]}
          hint={t(locale, 'relationship_hint')}
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t(locale, 'adding') : t(locale, 'add')}
      </Button>
      {state.error && (
        <div className="basis-full text-sm text-red-700">{state.error}</div>
      )}
      {state.ok && state.invited && (
        <div className="basis-full text-sm text-emerald-700">
          {t(locale, 'invite_sent_team')}
        </div>
      )}
    </form>
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
