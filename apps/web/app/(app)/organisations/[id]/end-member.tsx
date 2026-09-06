'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { endMembership } from './member-actions';
import { t, type Locale } from '@/lib/i18n-ui';

export function EndMemberButton({
  orgId,
  membershipId,
  personLabel,
  locale,
}: {
  orgId: string;
  membershipId: string;
  personLabel: string;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {t(locale, 'end')}
      </Button>
      <ConfirmDialog
        open={open}
        title={t(locale, 'end_membership')}
        message={t(locale, 'end_membership_msg', { name: personLabel })}
        confirmLabel={t(locale, 'end_membership')}
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(async () => {
            await endMembership(orgId, membershipId);
            setOpen(false);
          })
        }
      />
    </>
  );
}
