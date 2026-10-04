// Give rich text a shape that survives a round trip.
//
// A contenteditable that starts EMPTY does not wrap the first thing you type.
// Type a line, press Enter, make a heading, and the browser leaves you:
//
//   Fixture bio, first paragraph.<h3>A heading</h3><div>And a closing line.</div>
//
// — a bare text node, then blocks. Stored like that it round-trips wrongly:
// `bio-html.ts` decides plain-versus-HTML by what the value STARTS with, sees
// text, and escapes the lot, so reopening the editor shows `&lt;h3&gt;` as
// literal characters and the next save stores the escaped text. An existing
// bio opens with `<p>` and never shows it, which is why every look passed
// (found on staging by the save fixture, 2026-10-04).
//
// The reader's detector stays conservative on purpose — guessing harder is
// how somebody's angle brackets end up executing. So the shape is fixed at
// the source instead: whatever a browser produces, what leaves the editor and
// what the API stores begins with a block element.
//
// Shape-agnostic deliberately. Chromium wraps in `<div>`, Firefox and Safari
// differ, and nobody has tried them: rather than encode one browser's habits,
// this says what the OUTPUT must look like — top-level runs of text and
// inline elements become paragraphs, and a top-level `<div>` becomes one.
//
// Pure DOM, no library: it runs in the browser on the editor's own output and
// in the API on DOMPurify's fragment, so there is ONE rule rather than two
// that drift.

/** Elements that are already blocks: they are left exactly as they are. */
const BLOCKS = new Set([
  'P', 'UL', 'OL', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'PRE', 'HR', 'TABLE', 'FIGURE',
]);

const ELEMENT = 1;
const TEXT = 3;

function isBlock(node: Node): boolean {
  return node.nodeType === ELEMENT && BLOCKS.has((node as Element).tagName);
}

function isBlank(node: Node): boolean {
  return node.nodeType === TEXT && !(node.textContent ?? '').trim();
}

/**
 * Rewrite `root`'s children IN PLACE so every top-level node is a block.
 *
 * - a `<div>` holding only inline content becomes a `<p>`;
 * - a `<div>` holding blocks is unwrapped, and its children are reconsidered;
 * - a run of text and inline elements is wrapped in one `<p>`, so a line and
 *   the `<strong>` inside it stay one paragraph rather than becoming two;
 * - whitespace between blocks is dropped, having no meaning in HTML;
 * - anything already a block is untouched — this must not reflow a bio that
 *   was already well formed.
 */
export function normaliseRichTextBlocks(root: ParentNode, doc: Document): void {
  // Unwrap or rename top-level divs first, so the pass below sees the shape
  // the browser meant rather than the box it put it in.
  for (const child of [...root.childNodes]) {
    if (child.nodeType !== ELEMENT || (child as Element).tagName !== 'DIV') continue;
    const el = child as Element;
    if ([...el.childNodes].some(isBlock)) {
      while (el.firstChild) root.insertBefore(el.firstChild, el);
      root.removeChild(el);
    } else {
      const p = doc.createElement('p');
      while (el.firstChild) p.appendChild(el.firstChild);
      root.replaceChild(p, el);
    }
  }

  // Then gather what is left loose into paragraphs.
  let run: Node[] = [];
  const flush = () => {
    if (!run.length) return;
    const p = doc.createElement('p');
    root.insertBefore(p, run[0]!);
    for (const n of run) p.appendChild(n);
    run = [];
  };
  for (const child of [...root.childNodes]) {
    if (isBlock(child)) {
      flush();
      continue;
    }
    if (isBlank(child) && !run.length) {
      root.removeChild(child);
      continue;
    }
    run.push(child);
  }
  flush();
}
