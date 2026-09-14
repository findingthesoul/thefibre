// @vitest-environment jsdom
//
// The note composer when the network goes away.
//
// Written against a bug found by reading the save path while building offline
// capture: saveNote catches errors raised INSIDE the server function, but when
// a phone loses its connection the CALL to that server action rejects on the
// client, and nothing caught it. Two consequences, both tested here:
//
//   1. the status stuck on "Saving…" with nothing on screen saying otherwise;
//   2. `committing` stayed true, so every later Done was ignored — after one
//      failed commit offline the composer could never commit again until the
//      page was reloaded.
//
// What was checked, stated precisely because an earlier test in this app
// claimed more than it proved (the person popup's, which passed against the
// version it was meant to catch):
//
//   - Against the ORIGINAL code — no catch in write(), no `finally` in
//     commit() — both the "Saving…" test and the "commit again" test fail.
//     So both genuinely detect the bugs that shipped.
//   - With only the catch removed, "Saving…" fails and "commit again" still
//     passes. The lockup is prevented by EITHER fix alone: the catch stops
//     write() throwing, the finally releases the lock even if it does. That
//     test therefore proves the lockup cannot happen, not which of the two
//     is holding it — deliberately belt and braces, and not claimed as
//     independently pinned.

import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const saveNote = vi.fn();

const editNote = vi.fn(async () => ({ ok: true, id: 'n1', committed: true }));
let myTeams: { id: string; name: string; is_default: boolean }[] = [];

vi.mock('./actions', () => ({
  saveNote: (...args: unknown[]) => saveNote(...args),
  editNote: (...args: unknown[]) => editNote(...(args as [])),
  deleteNote: async () => ({ ok: true }),
  fetchVocabulary: async () => ({ words: [], people: [] }),
  loadMyTeams: async () => myTeams,
  setDefaultTeam: async () => ({ ok: true }),
}));
vi.mock('@/components/ui/date-field', () => ({ DateTimeField: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

import { Notes } from './notes';

let container: HTMLDivElement;
let root: Root;

const settle = async () => {
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

/** Set a React-controlled textarea's value the way a real keystroke would. */
async function type(text: string) {
  const box = container.querySelector('textarea')!;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(box, text);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const done = () =>
  [...container.querySelectorAll('button')].find((b) => /done/i.test(b.textContent ?? ''))!;

async function pressDone() {
  await act(async () => {
    done().dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await settle();
}

beforeEach(async () => {
  saveNote.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <StrictMode>
        <Notes personId="p1" personName="Wilma" notes={[]} locale="en" />
      </StrictMode>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  localStorage.clear();
});

describe('the composer offline', () => {
  it('does not sit on "Saving…" when the save request itself fails', async () => {
    saveNote.mockRejectedValue(new TypeError('Failed to fetch'));
    await type('Spoke with Wilma about the retreat.');
    await pressDone();
    expect(container.textContent).not.toContain('Saving…');
  });

  it('keeps what was typed when the commit could not reach the server', async () => {
    saveNote.mockRejectedValue(new TypeError('Failed to fetch'));
    await type('Spoke with Wilma about the retreat.');
    await pressDone();
    // Either still in the box, or safely queued on the device — never gone.
    const inBox = container.querySelector('textarea')!.value.includes('retreat');
    const queued = Object.keys(localStorage).some((k) =>
      (localStorage.getItem(k) ?? '').includes('retreat'),
    );
    expect(inBox || queued).toBe(true);
  });

  it('can commit again after a failed commit, once the network is back', async () => {
    // The worse half of the bug: a stuck `committing` flag ignored every
    // later Done until reload.
    saveNote.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await type('First attempt, offline.');
    await pressDone();

    saveNote.mockResolvedValue({ ok: true, id: 'n1', committed: true });
    const before = saveNote.mock.calls.length;
    await type('First attempt, offline. Back online now.');
    await pressDone();
    expect(saveNote.mock.calls.length).toBeGreaterThan(before);
  });
});

// ── Teams ────────────────────────────────────────────────────────────────────
//
// Sjoerd, 2026-09-14: file what happened under one of your teams, with a
// default preselected. Two properties are pinned, because either failing is
// silent: a note that quietly lands under no team never shows up in that
// team's update meeting, and nobody would know why.

describe('filing under a team', () => {
  const render = async (notes: Parameters<typeof Notes>[0]['notes'] = []) => {
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(<Notes personId="p1" personName="Wilma" notes={notes} locale="en" />);
    });
    await settle();
  };

  afterEach(() => {
    myTeams = [];
    editNote.mockClear();
  });

  it('shows no team picker for somebody in no team', async () => {
    myTeams = [];
    await render();
    expect(container.textContent).not.toContain('By you');
  });

  it('preselects my default team and sends it with the note', async () => {
    myTeams = [
      { id: 't-ops', name: 'Operations', is_default: false },
      { id: 't-comm', name: 'Community', is_default: true },
    ];
    await render();
    const select = [...container.querySelectorAll('select')].find((el) =>
      [...el.options].some((o) => o.value === 't-comm'),
    )!;
    expect(select.value).toBe('t-comm');

    saveNote.mockResolvedValue({ ok: true, id: 'n1', committed: true });
    await type('Talked about the spring gathering.');
    await pressDone();
    const sent = saveNote.mock.calls.at(-1)?.[0] as { team_id?: string | null };
    expect(sent.team_id).toBe('t-comm');
  });

  it('keeps a note in its team when the words are edited', async () => {
    // PUT overwrites the whole row. Without sending team_id back, fixing a
    // typo would take the note out of its team's update meeting.
    await render([
      {
        id: 'n1',
        client_ref: '11111111-1111-1111-1111-111111111111',
        team_id: 't-comm',
        body: 'Old words',
        kind: 'note',
        origin: 'manual',
        happened_at: '2026-09-13T10:00:00.000Z',
        follow_up_at: null,
        is_draft: false,
        created_at: '2026-09-13T10:00:00.000Z',
      },
    ]);
    const edit = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Edit')!;
    await act(async () => edit.click());
    const box = [...container.querySelectorAll('textarea')].find((el) => el.value === 'Old words')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(box, 'New words');
      box.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const save = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Save')!;
    await act(async () => save.click());
    await settle();
    expect(editNote).toHaveBeenCalledWith(expect.objectContaining({ team_id: 't-comm', body: 'New words' }));
  });
});
