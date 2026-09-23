// @vitest-environment jsdom
//
// A saved value has a NAME on it, before any search has run.
//
// Sjoerd, 2026-09-22: *"when I connect an org in How do you know them... it
// does not save that field."* It saved — the API was storing it, proven
// against staging. The picker could not SAY so: it labels a value from the
// search results, and a page that has just loaded has run no search, so the
// field showed its placeholder and read exactly like an empty one.
//
// This is the fix under test, and it is worth a test because the failure is
// silent in the worst way: the data is right and the screen says it is not.
//
// It lives in apps/connections rather than beside the component: this package
// renders no components in its own tests and has no React plugin wired into
// vitest. Connect is the app that uses it, and the test exercises exactly the
// binding Connect makes.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OrganisationCombobox,
  type OrganisationOption,
} from '@thefibre/shared/ui/organisation-combobox';
import { PersonCombobox, type PersonOption } from '@thefibre/shared/ui/person-combobox';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const settle = async () => {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

const ORG: OrganisationOption = { id: 'org-1', name: 'Commonland', domain: 'commonland.com' };

describe('a value the picker was not given', () => {
  it('is looked up and named', async () => {
    const resolve = vi.fn(async (id: string) => (id === ORG.id ? ORG : null));
    await act(async () => {
      root.render(
        <OrganisationCombobox
          label="Through which company"
          search={async () => []}
          resolve={resolve}
          value={ORG.id}
          placeholder="Search…"
        />,
      );
    });
    await settle();
    expect(resolve).toHaveBeenCalledWith(ORG.id);
    expect(container.textContent).toContain('Commonland');
    expect(container.textContent).not.toContain('Search…');
  });

  it('shows the placeholder when there is no value to name', async () => {
    await act(async () => {
      root.render(
        <OrganisationCombobox
          label="Through which company"
          search={async () => []}
          resolve={async () => null}
          value=""
          placeholder="Search…"
        />,
      );
    });
    await settle();
    expect(container.textContent).toContain('Search…');
  });

  it('does not look up a value it already holds', async () => {
    const resolve = vi.fn(async () => ORG);
    await act(async () => {
      root.render(
        <OrganisationCombobox
          label="Through which company"
          search={async () => []}
          resolve={resolve}
          organisations={[ORG]}
          value={ORG.id}
        />,
      );
    });
    await settle();
    expect(resolve).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Commonland');
  });

  it('says the placeholder, not a broken name, when the row is gone', async () => {
    await act(async () => {
      root.render(
        <OrganisationCombobox
          label="Through which company"
          search={async () => []}
          resolve={async () => null}
          value="deleted-org"
          placeholder="Search…"
        />,
      );
    });
    await settle();
    expect(container.textContent).toContain('Search…');
  });
});

// ── The label comes back with the id ────────────────────────────────────────
//
// Sjoerd, 2026-09-23, adding Martine Verweij to a meeting write-up and getting
// a chip that read "64f88ab3-56f2-4287-81b6-45b9baf873a7". The write-up keeps
// its own roster, so it needs the NAME at the moment of the pick — and
// onChange handed back only the id, leaving the caller to render the id or
// re-fetch a name the picker had just displayed on screen.
describe('picking somebody', () => {
  it('hands the caller the label it was showing, not only the id', async () => {
    const PERSON: PersonOption = {
      id: '64f88ab3-56f2-4287-81b6-45b9baf873a7',
      first_name: 'Martine',
      last_name: 'Verweij',
      email: 'martine@example.org',
    };
    const seen: { id: string; label?: string }[] = [];

    await act(async () => {
      root.render(
        <PersonCombobox
          label="Somebody else who was there"
          search={async () => [PERSON]}
          people={[PERSON]}
          value=""
          placeholder="Search…"
          onChange={(id, label) => seen.push({ id, label })}
        />,
      );
    });
    await settle();

    // Open the list from its trigger, then choose the one row.
    const trigger = container.querySelector('button');
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await settle();
    // `li button`, not `li`: the row's click handler is on the button, and
    // clicking the wrapper does nothing — which is how this test first
    // "found" a row and saw no onChange at all.
    const row = ([...container.querySelectorAll('li button')] as HTMLElement[]).find((el) =>
      el.textContent?.includes('Martine'),
    );
    expect(row, 'the picker showed no row for Martine').toBeTruthy();
    await act(async () => {
      row!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await settle();

    expect(seen).toHaveLength(1);
    expect(seen[0]!.id).toBe(PERSON.id);
    // The assertion that matters: a caller storing its own chip can name it
    // without a second request.
    expect(seen[0]!.label).toContain('Martine');
  });
});
