'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { endMembership } from './member-actions';

export function EndMemberButton({
  orgId,
  membershipId,
  personLabel,
}: {
  orgId: string;
  membershipId: string;
  personLabel: string;
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
        End
      </Button>
      <ConfirmDialog
        open={open}
        title="End membership"
        message={`Mark ${personLabel} as no longer affiliated with this organisation? The historical link stays — only the active flag changes.`}
        confirmLabel="End membership"
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
