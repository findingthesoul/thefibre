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
