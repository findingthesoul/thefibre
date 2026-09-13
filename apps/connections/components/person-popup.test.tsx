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

beforeEach(async () => {
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

  it('closes itself when "open the full page" is followed', async () => {
    // The provider lives in the layout, and a Next layout keeps its state
    // across navigation — so without clearing first, the dialog would stay
    // open on top of the page it just linked to.
    await click(container.querySelector('a.p1')!);
    expect(dialogOpen()).toBe(true);
    const full = [...document.querySelectorAll('a')].find(
      (a) => a.getAttribute('href') === '/people/p1' && !a.classList.contains('p1'),
    )!;
    await click(full);
    expect(dialogOpen()).toBe(false);
  });

  it('sends you to The Fibre in a NEW tab, not out of Connections', async () => {
    // Sjoerd, 2026-09-13: "moving to the fibre (more contact info) is
    // confusing... you're totally left connections then". The link carried an
    // external-link icon and navigated in place, so following it dropped you
    // out of the map you were walking through.
    await click(container.querySelector('a.p1')!);
    const out = [...document.querySelectorAll('a')].find((a) =>
      (a.getAttribute('href') ?? '').startsWith('https://example.invalid/contacts'),
    )!;
    expect(out, 'the link out to The Fibre').toBeTruthy();
    expect(out.getAttribute('target')).toBe('_blank');
    // Without this a new tab can reach back into the one that opened it.
    expect(out.getAttribute('rel') ?? '').toContain('noopener');
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
