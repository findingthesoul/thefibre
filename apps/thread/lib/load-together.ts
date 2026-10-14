// Start a page's main fetch and its side fetches TOGETHER, but let the main
// one decide the page.
//
// The thread editor awaited the thread, then eight side loads that never
// needed it — so its server time was the sum of the two (1.7–2.6s on
// staging, 2026-10-14). Run together it is the slower of the two. What must
// NOT change with it: when the main fetch fails, that failure is the answer —
// a 404 is still "not found", anything else still throws — and whatever the
// side loads returned is discarded.

export type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

export function settle<T>(p: Promise<T>): Promise<Settled<T>> {
  return p.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

/** Await both; the main result decides. `onMainError` handles the failure
 *  (notFound() never returns) and the side results are then never read. */
export async function loadTogether<M, S>(
  main: Promise<M>,
  side: Promise<S>,
  onMainError: (error: unknown) => never,
): Promise<[M, S]> {
  const settledMain = settle(main);
  const settledSide = settle(side);
  const m = await settledMain;
  if (!m.ok) onMainError(m.error);
  const s = await settledSide;
  if (!s.ok) throw s.error; // the side loads catch their own; this is a bug guard
  return [(m as { ok: true; value: M }).value, s.value];
}
