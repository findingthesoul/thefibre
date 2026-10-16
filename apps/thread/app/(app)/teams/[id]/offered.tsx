'use client';

// Threads another team owns and has OFFERED to this one (multi-team,
// 2026-10-16). There is no accept step (Sjoerd); this is the brake: a lead of
// this team or a workspace admin takes one off this team's calendar. The
// thread itself is not changed.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/dialog';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { removeTeamOffer } from '../actions';

export function RemoveOfferButton({
  locale,
  teamId,
  threadId,
  title,
}: {
  locale: Locale;
  teamId: string;
  threadId: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      const r = await removeTeamOffer(teamId, threadId);
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
        aria-label={`${t(locale, 'remove')}: ${title}`}
        title={t(locale, 'remove')}
      >
        <Trash2 size={15} strokeWidth={1.75} />
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
      <ConfirmDialog
        open={open}
        onCancel={() => setOpen(false)}
        onConfirm={onConfirm}
        title={t(locale, 'offered_to_team_title')}
        message={t(locale, 'remove_offer_msg', { title })}
        confirmLabel={t(locale, 'remove')}
        destructive
        pending={pending}
      />
    </>
  );
}
