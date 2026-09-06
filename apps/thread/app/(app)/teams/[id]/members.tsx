'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/dialog';
import { SectionLabel } from '@/components/ui/page';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { addTeamMember, removeTeamMember } from '../actions';

type Candidate = {
  user_id: string;
  full_name: string | null;
  email: string;
  workspace_role: string;
};

export function AddMemberRow({
  locale,
  teamId,
  candidates,
}: {
  locale: Locale;
  teamId: string;
  candidates: Candidate[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'lead' | 'member'>('member');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-ink-muted">{t(locale, 'everyone_on_team')}</p>
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!userId) return setError(t(locale, 'err_pick_ws_member'));
    startTransition(async () => {
      const r = await addTeamMember(teamId, userId, role);
      if (!r.ok) return setError(r.error);
      setUserId('');
      setRole('member');
      router.refresh();
    });
  }

  return (
    <div>
      <SectionLabel>{t(locale, 'add_a_member')}</SectionLabel>
      <form onSubmit={onSubmit} className="mt-2 flex flex-wrap items-end gap-3 max-w-3xl">
        <div className="flex-1 min-w-[16rem]">
          <SelectField
            label={t(locale, 'workspace_member')}
            name="user_id"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            options={[
              { value: '', label: t(locale, 'choose_member') },
              ...candidates.map((c) => ({
                value: c.user_id,
                label: c.full_name ? `${c.full_name} (${c.email})` : c.email,
              })),
            ]}
          />
        </div>
        <div className="w-32">
          <SelectField
            label={t(locale, 'role')}
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value === 'lead' ? 'lead' : 'member')}
            options={[
              { value: 'member', label: t(locale, 'role_member') },
              { value: 'lead', label: t(locale, 'role_lead') },
            ]}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? t(locale, 'adding') : t(locale, 'add')}
        </Button>
        {error && <div className="basis-full text-sm text-red-700">{error}</div>}
      </form>
    </div>
  );
}

export function RemoveMemberButton({
  locale,
  teamId,
  userId,
  name,
}: {
  locale: Locale;
  teamId: string;
  userId: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const r = await removeTeamMember(teamId, userId);
      if (!r.ok) return setError(r.error);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-ink-muted hover:text-red-700 transition-colors"
        aria-label={t(locale, 'remove_name_aria', { name })}
        title={t(locale, 'remove_from_team')}
      >
        <Trash2 size={15} strokeWidth={1.75} />
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
      <ConfirmDialog
        open={open}
        onCancel={() => setOpen(false)}
        onConfirm={onConfirm}
        title={t(locale, 'remove_member')}
        message={t(locale, 'remove_member_msg', { name })}
        confirmLabel={t(locale, 'remove')}
        destructive
        pending={pending}
      />
    </>
  );
}
