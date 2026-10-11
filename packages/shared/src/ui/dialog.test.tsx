// @vitest-environment jsdom
//
// The Dialog's ACCESSIBLE NAME.
//
// `role="dialog"` with a heading inside it is not a name. Without
// aria-labelledby the computed name is empty, so a screen reader announces
// "dialog" and stops, and every dialog in every app sounds the same.
//
// The evidence was sitting in the test suite before anyone read the markup:
// e2e/no-access.spec.ts could not use `getByRole('dialog', { name })` and
// filtered by text instead, with a comment explaining that the shared Dialog
// "renders its title in a header without aria-labelledby, so it has no
// accessible name to match on". That comment was a bug report nobody had
// filed.
//
// Rendered for real with react-dom, the apps/connections pattern (createRoot
// + act, no testing-library). The name is resolved the way the accessibility
// tree does it — follow aria-labelledby to the element and read its text —
// rather than asserting the attribute exists, because an id pointing at
// nothing passes that weaker check and still has no name.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Dialog } from './dialog.js';

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
  document.body.style.overflow = '';
});

/** The accessible name, computed the way a screen reader would for this
 *  shape: aria-labelledby → the element(s) it names → their text. Returns
 *  null when there is no name at all, which is the bug being locked out. */
function accessibleName(el: Element): string | null {
  const ids = el.getAttribute('aria-labelledby');
  if (!ids) return null;
  const parts: string[] = [];
  for (const id of ids.split(/\s+/).filter(Boolean)) {
    const target = el.ownerDocument.getElementById(id);
    // An id pointing at nothing contributes nothing — the case a bare
    // "attribute is present" assertion would wave through.
    if (target) parts.push(target.textContent?.trim() ?? '');
  }
  const name = parts.join(' ').trim();
  return name || null;
}

const dialog = () => container.querySelector('[role="dialog"]')!;

describe('Dialog accessibility', () => {
  it('exposes its title as the accessible name', () => {
    act(() => {
      root.render(
        <Dialog open onClose={() => {}} title="Back in The Fibre">
          <p>body</p>
        </Dialog>,
      );
    });
    expect(accessibleName(dialog())).toBe('Back in The Fibre');
  });

  it('is still a modal dialog', () => {
    act(() => {
      root.render(
        <Dialog open onClose={() => {}} title="Delete this thread?">
          <p>body</p>
        </Dialog>,
      );
    });
    expect(dialog().getAttribute('role')).toBe('dialog');
    expect(dialog().getAttribute('aria-modal')).toBe('true');
  });

  it('describes itself when given a description', () => {
    act(() => {
      root.render(
        <Dialog open onClose={() => {}} title="Move the session" description="This emails everyone enrolled.">
          <p>body</p>
        </Dialog>,
      );
    });
    const id = dialog().getAttribute('aria-describedby');
    expect(id, 'a description was given, so it must be pointed at').toBeTruthy();
    expect(document.getElementById(id!)?.textContent).toBe('This emails everyone enrolled.');
  });

  // Pointing at an element that was never rendered leaves the description
  // empty, which reads worse than having none: the reader announces nothing
  // where the author promised something.
  it('claims no description when there is none', () => {
    act(() => {
      root.render(
        <Dialog open onClose={() => {}} title="No description here">
          <p>body</p>
        </Dialog>,
      );
    });
    expect(dialog().getAttribute('aria-describedby')).toBeNull();
  });

  // Two dialogs are open at once often enough that the component keeps a
  // stack for Escape. Duplicate ids would make both names resolve to whichever
  // element the document found first.
  it('gives two open dialogs different names', () => {
    act(() => {
      root.render(
        <>
          <Dialog open onClose={() => {}} title="The one underneath">
            <p>a</p>
          </Dialog>
          <Dialog open onClose={() => {}} title="The one on top">
            <p>b</p>
          </Dialog>
        </>,
      );
    });
    const both = [...container.querySelectorAll('[role="dialog"]')];
    expect(both).toHaveLength(2);
    expect(both.map((d) => accessibleName(d))).toEqual(['The one underneath', 'The one on top']);
  });
});
