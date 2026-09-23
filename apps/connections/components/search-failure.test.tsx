// @vitest-environment jsdom
//
// A search that FAILED must not look like a search that found nothing.
//
// The difference is not cosmetic. An empty list sits directly above "add what
// you typed", so a dropped request invites somebody to create a person who
// already exists — inside the very picker built to stop duplicates. Found
// 2026-09-23, an hour after fixing a duplicate caused the other way round,
// and it is the same root cause as two other bugs that day: an error turned
// into an empty collection by `?? []` or `catch { return [] }`.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PersonCombobox } from '@thefibre/shared/ui/person-combobox';

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

const settle = async (ms = 400) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

/** Open the picker and type, which is what triggers a search. */
async function typeInto(search: () => Promise<never[]>) {
  await act(async () => {
    root.render(
      <PersonCombobox
        label="Who was there"
        search={search as never}
        value=""
        onCreate={() => undefined}
        createLabel={(t) => `Add ${t} as a new person`}
        placeholder="Pick a person…"
      />,
    );
  });
  const trigger = container.querySelector('button');
  await act(async () => {
    trigger?.click();
  });
  const input = container.querySelector('input');
  await act(async () => {
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      )!.set!;
      setter.call(input, 'rense');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await settle();
}

describe('a search that could not be made', () => {
  it('says so, and does NOT offer to create what you typed', async () => {
    await typeInto(async () => {
      throw new Error('network');
    });
    expect(container.textContent).toContain('Could not search');
    expect(container.textContent).not.toContain('Add rense as a new person');
  });

  it('still offers to create when the search genuinely found nothing', async () => {
    await typeInto(async () => []);
    expect(container.textContent).not.toContain('Could not search');
    expect(container.textContent).toContain('Add rense as a new person');
  });
});
