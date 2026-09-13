// Calling a server action can fail even when the action cannot.
//
// Every server action in this app is written not to throw: it catches its own
// errors and returns `{ ok: false, error }`. That makes the call sites read as
// if nothing can go wrong, and it is half true. The CALL is still a network
// request — a dropped connection, a deploy landing mid-request, a tab waking
// from sleep — and a rejection there skips every line after the `await`.
//
// What that looks like on screen is never an error message. It is a button
// that says "Saving…" for ever, or a dialog stuck on "Loading" with no way
// out, because the line that would have cleared the flag is one of the lines
// that got skipped. This app has shipped that bug twice: once in the note
// composer (v0.73.x, where `committing` stayed true and every later Done was
// ignored) and once in the person popup.
//
// So the rule is: a failed call becomes a failed RESULT, in the same shape the
// action would have returned, and the call site has one path to handle rather
// than two.

/**
 * Run a server action, turning a failed call into the result it would have
 * returned had it failed inside.
 *
 * @param run        the call, wrapped so it is made inside the try
 * @param onFailure  build the action's own failure shape from a message
 *
 * ```ts
 * const r = await safely(
 *   () => saveBandLabels(axis, values),
 *   (error) => ({ ok: false as const, error }),
 * );
 * ```
 */
export async function safely<T>(
  run: () => Promise<T>,
  onFailure: (message: string) => T,
): Promise<T> {
  try {
    return await run();
  } catch (e) {
    return onFailure(e instanceof Error ? e.message : 'unknown error');
  }
}
