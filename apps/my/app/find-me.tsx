'use client';

// Your own photo and name, with an eye: open = other members can find you in
// at least one community's member list, closed = in none (the default).
// Sjoerd, 2026-10-17: "On the membership page, you can also add the choice
// there: Being found by other members. For example, with an EYE open or
// closed over your own photo and name (at the top then)... clicking it opens
// a popup, where you click Being found by other members."
//
// The popup is the SAME switch as You → "Being found by other members"
// (directory-choices.tsx), one row per community whose member list is
// switched on. The page passes only those; with none, it renders nothing,
// and on a failed read it renders nothing either — a privacy control must
// never show a state we are unsure of.

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { Button } from '@thefibre/shared/ui/button';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import type { DirectoryChoice } from '@/lib/portal-api';
import { t } from '@/lib/i18n';
import { ListedSwitch, useDirectoryChoices } from './directory-choices';

export function FindMe({ name, photoUrl, choices }: { name: string; photoUrl: string | null; choices: DirectoryChoice[] }) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const { state, busy, error, save } = useDirectoryChoices(choices);
  const listed = state.filter((c) => c.listed).length;
  const visible = listed > 0;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const label = visible
    ? state.length > 1
      ? t(locale, 'find_me_aria_some', { n: String(listed), total: String(state.length) })
      : t(locale, 'find_me_aria_on')
    : t(locale, 'find_me_aria_off');

  return (
    <>
      <div className="mt-4 flex items-center gap-3">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the member's own stored photo
          <img src={photoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-sm font-medium text-ink-subtle">
            {initials || '·'}
          </span>
        )}
        <span className="min-w-0 truncate text-sm font-medium text-ink">{name}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          title={label}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs text-ink-subtle hover:bg-surface-sunken hover:text-ink"
        >
          {visible ? <Eye size={18} aria-hidden /> : <EyeOff size={18} aria-hidden />}
          <span>{visible ? t(locale, 'find_me_on') : t(locale, 'find_me_off')}</span>
        </button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t(locale, 'dir_title')}
        size="sm"
        footer={
          <div className="flex w-full justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t(locale, 'close')}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-ink-subtle">{t(locale, 'find_me_scope')}</p>
        <div className="mt-4 space-y-4">
          {state.map((c) => (
            <ListedSwitch key={c.workspace_id} choice={c} busy={busy === c.workspace_id} onChange={(v) => void save(c.workspace_id, { listed: v })} />
          ))}
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      </Dialog>
    </>
  );
}
