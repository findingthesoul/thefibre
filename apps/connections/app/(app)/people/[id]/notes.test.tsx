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

vi.mock('./actions', () => ({
  saveNote: (...args: unknown[]) => saveNote(...args),
  fetchVocabulary: async () => ({ words: [], people: [] }),
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
