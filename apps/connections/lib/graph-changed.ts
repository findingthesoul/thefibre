// Something in the graph changed, and a surface already on screen should say so.
//
// Sjoerd, 2026-09-13, after connecting somebody from the organisation popup:
// *"After connecting someone, it shuld update the screen"*. The popup folded
// the new person into its own list, which was the half he could see working;
// the MAP behind it did not move, because the cloud holds its nodes in a ref
// and only reads the server when the focus changes.
//
// A window event rather than context, and the reason is the shape of the
// problem. The writer is a dialog mounted at the layout; the reader is a
// component several routes down that may or may not exist. Threading a
// callback between them would make every surface in between carry a prop it
// has no use for, and `revalidatePath` cannot help — it re-renders server
// components, and the cloud's data arrives through a server ACTION called
// from an effect, which no revalidation reaches.
//
// Deliberately carries nothing. A listener re-reads what it is showing rather
// than being told what changed, so a second kind of write needs no new field
// here and cannot half-update somebody's screen with a payload that did not
// anticipate it.

export const GRAPH_CHANGED = 'connections:graph-changed';

/** Say that the contact graph changed. Safe on the server, where it is a no-op. */
export function graphChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(GRAPH_CHANGED));
}

/** Listen for it. Returns the unsubscribe, for an effect's cleanup. */
export function onGraphChanged(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(GRAPH_CHANGED, fn);
  return () => window.removeEventListener(GRAPH_CHANGED, fn);
}
