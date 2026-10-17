'use client';

// Being found by other members: the member's own choice, per community.
// ONE piece, used by You → "Being found by other members" and by the eye at
// the top of Memberships and Members (Sjoerd, 2026-10-17: "an EYE open or
// closed over your own photo and name ... clicking it opens a popup"). Both
// read and write the same store (GET/PATCH /membership/portal/me/directory,
// with the API's consent record), so there is no second place the choice
// can live and drift.
//
// OPT-IN, and the switch arrives OFF (Sjoerd, 2026-10-04: "Always opt-in").
// A faith-linked, recovery or political community discloses something by
// listing somebody, and a pre-ticked box cannot carry consent (Art 4(11),
// Recital 32). Switching it off is exactly as easy, in the same place (Art
// 7(3)). One switch PER COMMUNITY: a profile is shared across communities.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SwitchField } from '@thefibre/shared/ui/switch';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { saveDirectoryChoice, type DirectoryChoice } from '@/lib/portal-api';
import { t } from '@/lib/i18n';

export function useDirectoryChoices(initial: DirectoryChoice[]) {
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(workspaceId: string, patch: Partial<DirectoryChoice>) {
    const before = state;
    // Optimistic, then reverted on failure — a switch that does not move
    // when pressed reads as broken, and a switch that moves when the save
    // failed is a lie about a privacy setting.
    setState((prev) => prev.map((c) => (c.workspace_id === workspaceId ? { ...c, ...patch } : c)));
    setBusy(workspaceId);
    setError(null);
    try {
      await saveDirectoryChoice({
        workspace_id: workspaceId,
        ...(patch.listed !== undefined ? { listed: patch.listed } : {}),
        ...(patch.show_contact !== undefined ? { show_contact: patch.show_contact } : {}),
      });
      // What the server drew follows (2026-10-17): on Members, the "You're
      // not shown to other members" notice and the list itself, which would
      // otherwise contradict the eye until the next visit.
      router.refresh();
    } catch (e) {
      setState(before);
      setError(e instanceof Error ? e.message : t(locale, 'dir_save_failed'));
    } finally {
      setBusy(null);
    }
  }

  return { state, busy, error, save };
}

/** "Appear in the member list of {community}" — the one switch. */
export function ListedSwitch({ choice, busy, onChange }: { choice: DirectoryChoice; busy: boolean; onChange: (listed: boolean) => void }) {
  const locale = useLocale();
  return (
    <SwitchField
      label={t(locale, 'dir_appear', { community: choice.workspace_name })}
      hint={choice.listed ? t(locale, 'dir_listed') : t(locale, 'dir_unlisted')}
      checked={choice.listed}
      disabled={busy}
      onChange={onChange}
    />
  );
}
