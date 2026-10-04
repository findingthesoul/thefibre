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

import { useState } from 'react';
import { Users } from 'lucide-react';
import { saveDirectoryChoice, type DirectoryChoice } from '@/lib/portal-api';

export function DirectoryCard({ choices }: { choices: DirectoryChoice[] }) {
  const [state, setState] = useState(choices);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(workspaceId: string, patch: Partial<DirectoryChoice>) {
    const before = state;
    // Optimistic, then reverted on failure — a switch that does not move
    // when pressed reads as broken, and a switch that moves when the save
    // failed is a lie about a privacy setting.
    setState((prev) =>
      prev.map((c) => (c.workspace_id === workspaceId ? { ...c, ...patch } : c)),
    );
    setBusy(workspaceId);
    setError(null);
    try {
      await saveDirectoryChoice({
        workspace_id: workspaceId,
        ...(patch.listed !== undefined ? { listed: patch.listed } : {}),
        ...(patch.show_contact !== undefined ? { show_contact: patch.show_contact } : {}),
      });
    } catch (e) {
      setState(before);
      setError(e instanceof Error ? e.message : 'could not save that choice');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
        <Users size={16} strokeWidth={1.75} />
        Being found by other members
      </h2>
      <p className="mt-1 text-xs text-ink-muted">
        Off unless you turn it on. You can turn it off again here at any time.
      </p>

      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {state.map((c) => (
          <li key={c.workspace_id} className="px-4 py-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={c.listed}
                disabled={busy === c.workspace_id}
                onChange={(e) => void save(c.workspace_id, { listed: e.target.checked })}
                className="mt-0.5 accent-ink"
              />
              <span className="min-w-0">
                <span className="block text-sm text-ink">
                  Appear in the member list of {c.workspace_name}
                </span>
                <span className="block text-xs text-ink-muted">
                  {c.listed
                    ? 'Other members of this community can find you.'
                    : 'Nobody can find you here.'}
                </span>
              </span>
            </label>

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
                  <span className="block text-sm text-ink">Show my contact details</span>
                  <span className="block text-xs text-ink-muted">
                    {c.show_contact === null
                      ? `Following this community's default, which is ${
                          c.workspace_show_contact_default ? 'on' : 'off'
                        }.`
                      : 'Your own choice, whatever the community default is.'}
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
