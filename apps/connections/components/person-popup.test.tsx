// @vitest-environment jsdom
//
// The person popup's open / close / back behaviour, rendered for real.
//
// BEHAVIOUR COVERAGE, NOT A REGRESSION TEST — and the distinction is recorded
// because this file was first written as the latter. It was meant to lock a
// bug where React's development double-render closed the popup the instant it
// opened. That bug was never real: StrictMode double-runs effects only on
// mount, and opening a person is an update. The proof was this file passing
// against the supposedly broken version, which a regression test must not do.
// See the correction in person-popup.tsx.
//
// What it does lock, and is worth locking: the popup opens and stays open,
// adds exactly one history entry, closes on back and on Escape, reopens, and
// leaves a modifier-click to the browser so a new tab still gets the page.
// Rendered under <StrictMode> anyway, because that is how the app runs in
// development.
//
// The data layer is stubbed. What is under test is the dialog and the history.

import { StrictMode, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/(app)/people/[id]/load', () => ({
  loadPerson: vi.fn(async (id: string) => ({
    ok: true,
    person: { id, first_name: 'Wilma', last_name: 'Doornbos', email: null },
    notes: [],
    notesError: null,
  })),
}));
// The composer pulls in half the app; none of it is under test here.
vi.mock('@/app/(app)/people/[id]/notes', () => ({ Notes: () => null }));
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, className }: any) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

import { PersonLink, PersonPopupProvider } from './person-popup';

let container: HTMLDivElement;
let root: Root;

/** Let queued promises and the async popstate from history.back() land. */
const settle = async () => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

const dialogOpen = () => document.body.textContent?.includes('Wilma Doornbos') ?? false;

/** Where the page was sent. jsdom cannot navigate, so assign() is captured. */
let assigned: string[] = [];

beforeEach(async () => {
  assigned = [];
  // Each test starts with the warning switched ON, or one that dismissed it
  // would silently disarm every test after it.
  try {
    window.localStorage.clear();
  } catch {
    /* no storage in this environment is the same as nothing suppressed */
  }
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign: (u: string) => assigned.push(u) },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <StrictMode>
        <PersonPopupProvider locale="en" fibreContactsBase="https://example.invalid/contacts">
          <PersonLink personId="p1" className="p1">
            Open Wilma
          </PersonLink>
        </PersonPopupProvider>
      </StrictMode>,
    );
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const click = async (el: Element, init: MouseEventInit = {}) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }));
  });
  await settle();
};

describe('the person popup', () => {
  it('opens on a plain click and STAYS open under StrictMode', async () => {
    // The regression this file exists for: the first version closed itself.
    await click(container.querySelector('a.p1')!);
    expect(dialogOpen()).toBe(true);
  });

  it('pushes exactly one history entry when it opens', async () => {
    const before = window.history.length;
    await click(container.querySelector('a.p1')!);
    expect(window.history.length).toBe(before + 1);
  });

  it('closes when the browser goes back', async () => {
    await click(container.querySelector('a.p1')!);
    expect(dialogOpen()).toBe(true);
    await act(async () => window.history.back());
    await settle();
    expect(dialogOpen()).toBe(false);
  });

  it('closes on Escape', async () => {
    await click(container.querySelector('a.p1')!);
    expect(dialogOpen()).toBe(true);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await settle();
    expect(dialogOpen()).toBe(false);
  });

  it('leaves a modifier-click to the browser', async () => {
    // cmd/ctrl-click must still open the full page in a new tab. The popup is
    // the fast path, never the only one.
    const link = container.querySelector('a.p1')!;
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true });
    await act(async () => {
      link.dispatchEvent(ev);
    });
    await settle();
    expect(ev.defaultPrevented).toBe(false);
    expect(dialogOpen()).toBe(false);
  });

  it('is still a real link to the full page', () => {
    expect(container.querySelector('a.p1')!.getAttribute('href')).toBe('/people/p1');
  });

  it('shows an error instead of hanging when the load request itself fails', async () => {
    // Not the server function returning an error — the CALL rejecting, as a
    // dropped connection does. A rejection skips every line after the await,
    // so an unguarded popup sits on "Loading" forever.
    const { loadPerson } = await import('@/app/(app)/people/[id]/load');
    vi.mocked(loadPerson).mockRejectedValueOnce(new Error('network down'));
    await click(container.querySelector('a.p1')!);
    expect(document.body.textContent).toContain('network down');
    expect(document.body.textContent).not.toMatch(/Loading/);
  });

  // ── Leaving Connect ──────────────────────────────────────────────────────
  //
  // Two decisions by the same person on the same day, and the second replaced
  // the first. Both tests are rewritten rather than deleted, because the
  // BEHAVIOUR they guard still matters — it is the expected answer that moved.
  //
  //   1. "moving to the fibre (more contact info) is confusing... youre
  //      totally left connections then" → the link opened a new tab.
  //   2. "I just want to have a warning... that I am leaving connections and
  //      going to detailed personal data (with a YES and CANCEL button)" → it
  //      navigates in place, after asking.
  //
  // (2) is the better answer to the same complaint: what he wanted was to know
  // he was leaving, and a new tab bought that by never leaving, at the cost of
  // a tab every time.

  it('does not offer a second button to a page showing less than this one', async () => {
    // Sjoerd: "why two buttons?" /people/:id renders the same notes without
    // the relationship card, so the second button led somewhere strictly
    // worse. Every list still links to that page, which is what keeps it
    // reachable — see the modifier-click test above.
    await click(container.querySelector('a.p1')!);
    const inside = [...document.querySelectorAll('[role="dialog"] a, dialog a')];
    expect(inside.some((a) => a.getAttribute('href') === '/people/p1')).toBe(false);
  });

  // The label changed on 2026-09-23 with the control itself: Sjoerd asked for
  // an EDIT affordance ("the title should have a small thing behind it
  // (edit)"), and the button moved into components/open-in-fibre.tsx so the
  // organisation popup could use the same one. The BEHAVIOUR these four pin —
  // warn, cancel goes nowhere, yes goes, remember only on yes — is unchanged,
  // which is the whole reason they were worth keeping through the move.
  it('asks before it takes you out of Connect', async () => {
    await click(container.querySelector('a.p1')!);
    const out = [...document.querySelectorAll('button')].find((b) =>
      b.getAttribute('aria-label') === 'Edit this contact in The Fibre',
    )!;
    expect(out, 'the way out to The Fibre').toBeTruthy();
    await click(out);
    // The warning names what is on the other side, rather than asking "are
    // you sure" about nothing in particular.
    expect(document.body.textContent).toContain('Leaving Connect');
    expect(assigned).toEqual([]);
  });

  it('goes nowhere when the warning is cancelled', async () => {
    await click(container.querySelector('a.p1')!);
    await click([...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Edit this contact in The Fibre')!);
    await click([...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Cancel')!);
    expect(assigned).toEqual([]);
    expect(document.body.textContent).not.toContain('Leaving Connect');
  });

  it('goes to The Fibre when the warning is accepted', async () => {
    await click(container.querySelector('a.p1')!);
    await click([...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Edit this contact in The Fibre')!);
    await click([...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('Yes'))!);
    expect(assigned).toEqual(['https://example.invalid/contacts/p1']);
  });

  it('only remembers "do not ask again" when you actually go', async () => {
    // Ticking the box and then pressing Cancel is not consent to skip the
    // warning next time. Written because the obvious implementation — save on
    // change — gets this wrong and nobody would notice until the warning had
    // silently stopped appearing.
    await click(container.querySelector('a.p1')!);
    await click([...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Edit this contact in The Fibre')!);
    const box = [...document.querySelectorAll('input[type="checkbox"]')].pop() as HTMLInputElement;
    await act(async () => {
      box.click();
    });
    await click([...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').trim() === 'Cancel')!);
    const { warningSuppressed } = await import('@/lib/leaving-warning');
    expect(warningSuppressed()).toBe(false);
  });

  it('can be opened again after closing', async () => {
    await click(container.querySelector('a.p1')!);
    await act(async () => window.history.back());
    await settle();
    expect(dialogOpen()).toBe(false);
    await click(container.querySelector('a.p1')!);
    expect(dialogOpen()).toBe(true);
  });
});
