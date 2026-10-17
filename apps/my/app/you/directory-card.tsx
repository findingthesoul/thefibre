'use client';

// Whether other members of a community can see you in its member list.
//
// OPT-IN, and the switch arrives OFF. Sjoerd, 2026-10-04: "Always opt-in" —
// decided after being asked whether a default-on switch was safe for a
// community whose membership itself discloses something sensitive. A
// faith-linked community publishes a religious affiliation by listing
// somebody; a recovery or political one does the same. A pre-ticked box
// cannot carry consent (Art 4(11), Recital 32), so the default is the one
// that needs no justification and turning it on is the affirmative act that
// does.
//
// Switching it off is exactly as easy as switching it on, in the same place,
// which is what Art 7(3) asks for and what makes this a choice rather than a
// door that only opens one way.
//
// One switch PER COMMUNITY, never one global one: a profile is shared across
// communities, so a single flag would force somebody in three to hide from
// all three in order to hide from one.

import Link from 'next/link';
import { Users } from 'lucide-react';
import type { DirectoryChoice } from '@/lib/portal-api';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { t } from '@/lib/i18n';
import { ListedSwitch, useDirectoryChoices } from '../directory-choices';

// The switch and its save are shared with the eye on Memberships and Members
// (../directory-choices.tsx), so the two can never disagree on what "listed"
// means or how a failed save is undone.
export function DirectoryCard({ choices }: { choices: DirectoryChoice[] }) {
  const { state, busy, error, save } = useDirectoryChoices(choices);
  const locale = useLocale();

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
        <Users size={16} strokeWidth={1.75} />
        {t(locale, 'dir_title')}
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        {t(locale, 'dir_intro')}
      </p>

      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {state.map((c) => (
          <li key={c.workspace_id} className="px-4 py-3">
            <ListedSwitch choice={c} busy={busy === c.workspace_id} onChange={(v) => void save(c.workspace_id, { listed: v })} />
            {/* Only once they are in it: the list exists for members who
                appear in it, so offering the door before they have opened
                it would be offering something that refuses them. */}
            {c.listed && (
              <Link
                href={`/members/${c.workspace_id}`}
                className="mt-1 inline-block text-xs underline text-ink-muted hover:text-ink"
              >
                {t(locale, 'dir_see', { community: c.workspace_name })}
              </Link>
            )}

            {/* Only once they are listed: a contact-details choice for a list
                you are not in is a question about nothing. */}
            {c.listed && (
              <label className="mt-2 ml-7 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={c.show_contact ?? c.workspace_show_contact_default}
                  disabled={busy === c.workspace_id}
                  onChange={(e) => void save(c.workspace_id, { show_contact: e.target.checked })}
                  className="mt-0.5 accent-ink"
                />
                <span className="min-w-0">
                  <span className="block text-sm text-ink">{t(locale, 'dir_show_contact')}</span>
                  <span className="block text-xs text-ink-muted">
                    {c.show_contact === null
                      ? t(locale, c.workspace_show_contact_default ? 'dir_default_on' : 'dir_default_off')
                      : t(locale, 'dir_own')}
                  </span>
                </span>
              </label>
            )}
          </li>
        ))}
      </ul>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
