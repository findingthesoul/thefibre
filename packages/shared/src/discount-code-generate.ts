// A readable discount code, generated rather than invented.
//
// Sjoerd asked for a Generate button beside the Code field. The shape is
// K7QX-29MB: uppercase, two groups of four, from an alphabet with the
// look-alikes removed.
//
// WHY THE ALPHABET MATTERS. A code is read off a screen, a card, a slide or
// somebody's handwriting and typed back in. O/0 and I/1/L are the pairs that
// get mistyped, and a mistyped code is indistinguishable from an invalid one
// — the person is simply told no. Removing the ambiguous characters costs a
// little entropy and removes a whole class of support conversation.
//
// WHY crypto AND NOT Math.random. A discount code is a credential: it is
// worth money, and anybody who can guess one spends somebody else's
// discount. `Math.random` is seeded predictably in several engines and is not
// meant for anything anybody would want to guess. The API's rate limits make
// guessing slow; the alphabet and the randomness make it pointless.

/** 32 characters: A–Z and 2–9, less I, L, O, 0 and 1. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const GROUP = 4;
const GROUPS = 2;

/** A fresh code, e.g. `K7QX-29MB`.
 *
 *  31 characters over 8 positions is about 2^39 codes, which is far beyond
 *  anything reachable through a rate-limited endpoint — and a collision is
 *  handled anyway: the unique index answers 23505 and the API turns that into
 *  a 409, so the worst case is an admin pressing the button again. */
export function generateDiscountCode(
  /** Injectable only so the tests can exercise the mapping against known
   *  bytes. Production always uses the platform's CSPRNG. */
  randomBytes: (n: number) => Uint8Array = defaultRandomBytes,
): string {
  const need = GROUP * GROUPS;
  const out: string[] = [];
  // REJECTION SAMPLING, not `% 31`. The modulo of a uniform byte over 31 is
  // NOT uniform — values 0–7 would come up slightly more often, which is a
  // bias somebody looking for patterns in issued codes could use. Bytes at or
  // above the largest multiple of 31 are discarded instead.
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  while (out.length < need) {
    // Asking for a few extra each round keeps this to one call in practice
    // while staying correct if an unlucky round discards several.
    for (const b of randomBytes(need * 2)) {
      if (b >= limit) continue;
      out.push(ALPHABET[b % ALPHABET.length]!);
      if (out.length === need) break;
    }
  }
  const groups: string[] = [];
  for (let i = 0; i < GROUPS; i += 1) {
    groups.push(out.slice(i * GROUP, (i + 1) * GROUP).join(''));
  }
  return groups.join('-');
}

function defaultRandomBytes(n: number): Uint8Array {
  const buf = new Uint8Array(n);
  // `globalThis.crypto` is present in every browser this runs in and in Node
  // 19+. There is deliberately NO Math.random fallback: a code generated from
  // a predictable source looks exactly like a good one, so failing loudly is
  // the only honest behaviour.
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c?.getRandomValues) {
    throw new Error('no secure random source — a discount code must not be generated without one');
  }
  c.getRandomValues(buf);
  return buf;
}

/** The characters a generated code can contain — exported so a test can
 *  assert the alphabet rather than restating it. */
export const DISCOUNT_CODE_ALPHABET = ALPHABET;
