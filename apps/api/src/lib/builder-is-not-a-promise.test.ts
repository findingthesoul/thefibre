import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// A POSTGREST BUILDER IS NOT A PROMISE, AND COUNTING PROVES IT.
//
// `/me/portal` is the floor for every page in my.thread, so moving its
// memberships read off the critical path is worth doing. The first attempt
// did this:
//
//     const q = adminClient.from('membership_member')…;
//     void Promise.resolve(q).catch(() => {});   // "start it early"
//     …
//     const members = rows('portal: memberships', await q);   // "await it late"
//
// which runs the query TWICE. A builder's `then()` builds the headers and
// performs the fetch every time it is called (postgrest-js 2.105.4,
// PostgrestBuilder.ts:256), so `Promise.resolve(q)` fires request one and
// throws the result away, and `await q` fires request two at the old point in
// the handler. Same latency as before, plus an extra query on every portal
// hit — a change that looked like an optimisation and was a regression.
//
// Caught in review before it shipped. This is the count that review asked
// for, against a REAL builder with a counting `fetch`, because an argument
// about thenables is exactly the kind of thing that is persuasive and wrong.
// ---------------------------------------------------------------------------

/** A client whose every request is counted and answered locally. */
function countingClient() {
  const urls: string[] = [];
  const client = createClient('https://example.test', 'anon-key-not-used', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (async (input: RequestInfo | URL) => {
        urls.push(typeof input === 'string' ? input : String(input));
        return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }) as typeof fetch,
    },
  });
  return { client, urls };
}

const query = (c: ReturnType<typeof countingClient>['client']) =>
  c.from('membership_member').select('id').in('person_id', ['p1']).is('deleted_at', null);

describe('the shape that shipped', () => {
  it('runs the query ONCE', async () => {
    const { client, urls } = countingClient();
    // `Promise.resolve` calls then() once and keeps the RESULT.
    const q = Promise.resolve(query(client));
    q.catch(() => {});
    await q;
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('membership_member');
  });

  it('runs it once even when awaited several times', async () => {
    // Which is the property that makes "start early, await late" safe: the
    // promise can be handed around and awaited wherever it is needed.
    const { client, urls } = countingClient();
    const q = Promise.resolve(query(client));
    await Promise.all([q, q, q]);
    await q;
    expect(urls).toHaveLength(1);
  });

  it('really does start before it is awaited', async () => {
    // Otherwise the whole exercise is decoration: the point is that the
    // request is in flight while the handler does its other reads.
    //
    // NOT SYNCHRONOUSLY, and the first version of this test asserted that it
    // was and failed — `then()` is called at once, but the fetch itself is
    // issued inside an async function, so it leaves on the next microtask.
    // That is still "before it is awaited" in every way that matters: the
    // handler's next real `await` yields, and by then this is in flight.
    const { client, urls } = countingClient();
    const q = Promise.resolve(query(client));
    q.catch(() => {});
    expect(urls, 'not issued synchronously').toHaveLength(0);
    // A macrotask, which drains every pending microtask — the state the
    // handler is in the moment it awaits any real I/O of its own. Counting
    // exact ticks would be asserting the internals of a library we do not
    // own; what matters is that it is away before the next real wait.
    await new Promise((r) => setTimeout(r, 0));
    expect(urls, 'in flight without being awaited').toHaveLength(1);
    await q;
    expect(urls, 'and still only once').toHaveLength(1);
  });
});

describe('the shape that was caught in review', () => {
  it('runs the query TWICE — this is the regression', async () => {
    const { client, urls } = countingClient();
    const builder = query(client);
    // "start it early" — fires request one, result discarded
    void Promise.resolve(builder).catch(() => {});
    // "await it late" — fires request two
    await builder;
    expect(urls).toHaveLength(2);
  });

  it('is why holding a builder starts nothing at all', async () => {
    // The other half of the misunderstanding: a builder sitting in a variable
    // is inert. Nothing is in flight until something calls `then()`.
    const { client, urls } = countingClient();
    const builder = query(client);
    expect(urls).toHaveLength(0);
    await builder;
    expect(urls).toHaveLength(1);
  });
});
