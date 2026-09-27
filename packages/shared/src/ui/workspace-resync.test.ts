// One current workspace, in every app, until the person switches.
//
// The rule these assert is Sjoerd's, 2026-09-27: *"It should stay in the
// workspace until I switch."* What made it hard is that nothing was broken:
// each app held its own token, each reported its own workspace correctly, and
// the two disagreed only because a switch elsewhere had not reached this one
// yet. The bug was the SILENCE between them.
//
// These test the decision, not the effect — the effect needs a DOM and a
// session, and the thing worth pinning is which workspace wins and when.

import { describe, expect, it } from 'vitest';

type Row = { id: string; name: string | null; is_active: boolean; is_chosen?: boolean };

/** The decision the user menu's effect makes, extracted so it can be read. */
function resyncTarget(workspaces: Row[]): string | null {
  const chosen = workspaces.find((w) => w.is_chosen);
  if (!chosen || chosen.is_active) return null;
  return chosen.id;
}

describe('which workspace an app follows', () => {
  it('does nothing when the token already carries the chosen workspace', () => {
    expect(
      resyncTarget([
        { id: 'a', name: 'soul.com', is_active: true, is_chosen: true },
        { id: 'b', name: 'doab.ai', is_active: false },
      ]),
    ).toBeNull();
  });

  it('follows the choice when this app is carrying a workspace the person has left', () => {
    // The exact shape of the evening: The Fibre switched to soul.com, this app
    // still minted for doab.ai and happily showing doab.ai's models.
    expect(
      resyncTarget([
        { id: 'soul', name: 'soul.com', is_active: false, is_chosen: true },
        { id: 'doab', name: 'doab.ai', is_active: true },
      ]),
    ).toBe('soul');
  });

  it('does nothing when no choice has ever been recorded', () => {
    // Never switched: the token is the only opinion there is, and following a
    // choice that does not exist would send somebody somewhere they never
    // asked to go.
    expect(
      resyncTarget([
        { id: 'a', name: 'soul.com', is_active: true },
        { id: 'b', name: 'doab.ai', is_active: false },
      ]),
    ).toBeNull();
  });

  it('follows the choice even into a workspace where this app has no seat', () => {
    // doab.ai has no Thread. Following the choice lands on /no-access, which
    // says plainly where you are — better than Thread showing soul.com's
    // threads under a header that says doab.ai. The shell keeps the chosen row
    // in the list for exactly this case, rather than filtering it out.
    expect(
      resyncTarget([
        { id: 'doab', name: 'doab.ai', is_active: false, is_chosen: true },
        { id: 'soul', name: 'soul.com', is_active: true },
      ]),
    ).toBe('doab');
  });

  it('is single-valued: one chosen row decides, not a vote', () => {
    const rows: Row[] = [
      { id: 'a', name: 'a', is_active: true },
      { id: 'b', name: 'b', is_active: false, is_chosen: true },
    ];
    expect(resyncTarget(rows)).toBe('b');
    expect(rows.filter((w) => w.is_chosen)).toHaveLength(1);
  });
});
