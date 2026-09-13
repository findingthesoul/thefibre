// A failed CALL has to become a failed RESULT.
//
// The bug this prevents never looks like an error. It looks like a button
// stuck on "Saving…" or a dialog stuck on "Loading", because the line that
// would have cleared the flag came after an `await` that rejected. This app
// has shipped it twice.
//
// Mutation-checked: replace the body with a bare `return run()` and "a
// rejected call comes back as a result" fails.
//
// What this does NOT prove: that any particular button recovers. That is a
// property of each call site, and the audit that found the five bare sites
// (scratchpad, 2026-09-13) is what covers those — this pins the helper they
// all now go through.

import { describe, expect, it, vi } from 'vitest';
import { safely } from './safely';

describe('calling a server action', () => {
  it('passes a successful result straight through', async () => {
    const r = await safely(async () => ({ ok: true as const, value: 7 }), (error) => ({
      ok: false as unknown as true,
      value: -1,
      error,
    }));
    expect(r).toEqual({ ok: true, value: 7 });
  });

  it("passes the action's OWN failure through untouched", async () => {
    // An action that returns {ok:false} has already said what went wrong in
    // its own words. Replacing that with a generic message would be worse.
    const r = await safely(
      async () => ({ ok: false as const, error: 'forbidden' }),
      (error) => ({ ok: false as const, error }),
    );
    expect(r).toEqual({ ok: false, error: 'forbidden' });
  });

  it('turns a rejected call into a result, rather than rejecting', async () => {
    const r = await safely(
      async () => {
        throw new Error('Failed to fetch');
      },
      (error) => ({ ok: false as const, error }),
    );
    expect(r).toEqual({ ok: false, error: 'Failed to fetch' });
  });

  it('survives something thrown that is not an Error', async () => {
    // A rejected fetch in some browsers, and anything at all from a server
    // action deserialising badly.
    const r = await safely(
      async () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw 'not an error object';
      },
      (error) => ({ ok: false as const, error }),
    );
    expect(r).toEqual({ ok: false, error: 'unknown error' });
  });

  it('lets the caller keep running — the whole point', async () => {
    // The regression, stated as behaviour: the line after the await runs.
    const after = vi.fn();
    const run = async () => {
      await safely(
        async () => {
          throw new Error('boom');
        },
        (error) => ({ ok: false as const, error }),
      );
      after();
    };
    await run();
    expect(after).toHaveBeenCalledOnce();
  });
});
