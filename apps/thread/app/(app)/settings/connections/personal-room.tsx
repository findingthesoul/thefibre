'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@thefibre/shared';
import { TextField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n-ui';
import { updatePersonalRoom } from '../actions';

export function PersonalRoomForm({ locale, initial }: { locale: Locale; initial: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const url = String(fd.get('personal_room_url') ?? '').trim() || null;
    start(async () => {
      const r = await updatePersonalRoom(url);
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-lg border border-line bg-surface-raised p-6 space-y-4"
    >
      <TextField
        label={t(locale, 'personal_room_url')}
        name="personal_room_url"
        defaultValue={initial}
        placeholder="https://zoom.us/j/…"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t(locale, 'saving') : t(locale, 'save')}
        </Button>
        {saved && <span className="text-xs text-emerald-700">{t(locale, 'saved')}</span>}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </form>
  );
}
