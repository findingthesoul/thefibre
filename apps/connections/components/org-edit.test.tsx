// @vitest-environment jsdom
//
// An organisation's popup has a way through to its record, and it warns
// before it goes — the same control the person popup uses.
//
// Sjoerd, 2026-09-23: *"the title should have a small thing behind it
// (edit)... so you can edit the contact (Organisation or Person)."* The
// person half existed; the organisation half did not, so the map was a dead
// end for a company. This pins the half that was missing, and that the
// warning came with it rather than being left behind in the copy.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenInFibre } from './open-in-fibre';
import { resetWarning } from '@/lib/leaving-warning';

let container: HTMLDivElement;
let root: Root;
let assigned: string[] = [];

beforeEach(() => {
  resetWarning();
  assigned = [];
  // jsdom refuses a real navigation; record the intent instead.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign: (u: string) => assigned.push(u), href: 'https://connect.test/' },
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  resetWarning();
});

const render = () =>
  act(() => {
    root.render(
      <OpenInFibre
        href="https://fibre.test/organisations/o1"
        locale="en"
        label="Edit this organisation in The Fibre"
      />,
    );
  });

const click = async (el: Element) => {
  await act(async () => {
    (el as HTMLElement).click();
    await Promise.resolve();
  });
};

const button = (label: string) =>
  [...document.querySelectorAll('button')].find(
    (b) => b.getAttribute('aria-label') === label || (b.textContent ?? '').trim() === label,
  )!;

describe('the edit control on an organisation', () => {
  it('is there, and does not leave without asking', async () => {
    await render();
    const edit = button('Edit this organisation in The Fibre');
    expect(edit, 'the way through to the record').toBeTruthy();
    await click(edit);
    expect(document.body.textContent).toContain('Leaving Connect');
    expect(assigned).toEqual([]);
  });

  it('goes when the warning is accepted', async () => {
    await render();
    await click(button('Edit this organisation in The Fibre'));
    await click([...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('Yes'))!);
    expect(assigned).toEqual(['https://fibre.test/organisations/o1']);
  });

  it('goes nowhere when it is cancelled', async () => {
    await render();
    await click(button('Edit this organisation in The Fibre'));
    await click(button('Cancel'));
    expect(assigned).toEqual([]);
  });
});
