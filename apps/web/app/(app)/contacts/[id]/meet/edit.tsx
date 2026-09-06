'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, TextAreaField } from '@/components/ui/field';
import { updateMeetProfile, type ActionResult } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export type MeetProfileRow = {
  host_notes: string | null;
  vip: boolean;
  blocked: boolean;
  invitee_timezone: string | null;
  updated_at?: string;
};

export function MeetProfileEdit({
  personId,
  initial,
  locale,
}: {
  personId: string;
  initial: MeetProfileRow | null;
  locale: Locale;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(
    updateMeetProfile.bind(null, personId),
    {},
  );

  function onSuccess() {
    setOpen(false);
    router.refresh();
  }

  // Close on a successful save.
  if (state.ok) {
    // Defer so the dialog has a chance to render the "Saved." flash if we ever
    // add one. Today we just close + refresh.
    queueMicrotask(onSuccess);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-ink-subtle hover:text-ink"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} /> {t(locale, 'edit')}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t(locale, 'edit_meet_profile')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              {t(locale, 'cancel')}
            </Button>
            <Button form="meet-profile-form" type="submit" disabled={pending}>
              {pending ? t(locale, 'saving') : t(locale, 'save_changes')}
            </Button>
          </>
        }
      >
        <form id="meet-profile-form" action={formAction} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="vip"
                defaultChecked={initial?.vip ?? false}
                className="mt-1"
              />
              <span>
                <span className="font-medium">VIP</span>
                <span className="block text-xs text-ink-muted mt-0.5">
                  {t(locale, 'vip_hint')}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="blocked"
                defaultChecked={initial?.blocked ?? false}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{t(locale, 'blocked')}</span>
                <span className="block text-xs text-ink-muted mt-0.5">
                  {t(locale, 'blocked_hint')}
                </span>
              </span>
            </label>
          </div>
          <TextField
            label={t(locale, 'preferred_timezone')}
            name="invitee_timezone"
            defaultValue={initial?.invitee_timezone ?? ''}
            placeholder="Europe/Amsterdam"
            hint={t(locale, 'timezone_hint')}
          />
          <TextAreaField
            label={t(locale, 'host_notes')}
            name="host_notes"
            defaultValue={initial?.host_notes ?? ''}
            rows={6}
            hint={t(locale, 'host_notes_hint')}
          />
          {state.error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {state.error}
            </div>
          )}
        </form>
      </Dialog>
    </>
  );
}
