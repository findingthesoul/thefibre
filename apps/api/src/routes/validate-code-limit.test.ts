// The public code-validator is an oracle, and oracles get asked a lot.
//
// `POST /membership/public/validate-code` answers "does this code exist" to
// anybody who asks. Codes are short and human — SUMMER25 is the kind of thing
// a community writes — so without a limit it is a guessing machine, and the
// thing being guessed is money off a membership.
//
// Read off the route's source, like the billing wiring, because no type can
// say "this handler calls the limiter before it answers".

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./membership.ts', import.meta.url), 'utf8');
const handler = src.slice(
  src.indexOf("membershipRoutes.post('/public/validate-code'"),
  src.indexOf("const PublicJoin = z.object({"),
);

describe('the public code validator is rate-limited', () => {
  it('calls the limiter at all', () => {
    expect(handler).toContain('hit(`membership-code:');
  });

  // By IP alone, one office behind one address locks itself out of every
  // community at once. By workspace alone, one attacker locks out that
  // community's real joiners. The key carries both.
  it('keys on the workspace AND the caller', () => {
    expect(handler).toContain('hit(`membership-code:${ws.id}:${clientIp(c.req.raw.headers)}`');
  });

  // ⚠️ AND THE CALLER MUST NOT BE SPOOFABLE. Behind Fly a client can send
  // its own X-Forwarded-For, whose first entry is whatever they typed — so a
  // limiter keyed on that is keyed on a value the attacker chooses, and
  // rotating the header buys unlimited guesses. `clientIp` prefers
  // Fly-Client-IP, which the edge sets.
  it('takes the caller from clientIp, never from a header it reads itself', () => {
    expect(handler).toContain('clientIp(c.req.raw.headers)');
    // The CALL, not the word: the comment above the limiter names the
    // spoofable form in order to explain it, and a test that forbade the
    // string would forbid the explanation. (It caught exactly that on its
    // first run, which is a fair demonstration that it is looking.)
    expect(handler, 'reading the forwarded header here is the spoofable form').not.toMatch(
      /c\.req\.header\(\s*['"]x-forwarded-for/i,
    );
  });

  it('refuses with 429 and says when to come back', () => {
    expect(handler).toContain("c.header('Retry-After', String(gate.resetSeconds))");
    expect(handler).toMatch(/429/);
  });

  // THE ORDER. A limiter that runs after the lookup has already answered the
  // question it was meant to ration.
  it('refuses BEFORE it looks the code up', () => {
    const limiter = handler.indexOf('const gate = hit(');
    const lookup = handler.indexOf('await findDiscountCode(');
    expect(limiter).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(-1);
    expect(limiter, 'the limiter must come first').toBeLessThan(lookup);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Redemption: once, on the join's own invoice.
// ─────────────────────────────────────────────────────────────────────────────
describe('a code is spent once', () => {
  const webhook = src.slice(src.indexOf('async function membershipInvoicePaid'));

  // The negative form (`!== 'subscription_cycle'`) also fired on
  // 'subscription_update' — a tier change, a proration invoice — on 'manual',
  // and on whatever Stripe adds next. A member who moved tier would quietly
  // spend another use of the code they joined with.
  it('only on the invoice that created the subscription', () => {
    expect(webhook).toContain("invoice.billing_reason === 'subscription_create'");
    expect(webhook, 'the negative form catches invoices nobody meant').not.toContain(
      "invoice.billing_reason !== 'subscription_cycle'",
    );
  });

  // invoice.paid can be delivered more than once. The ledger row survives a
  // retry on its own (recordPurchase is update-first on item_ref); a counter
  // cannot, so the insert is the guard.
  it('guards against a webhook retry taking a second use', () => {
    const guard = webhook.indexOf("reminder_kind: 'discount_code_redeemed'");
    const redeem = webhook.indexOf('await redeemDiscountCode(');
    expect(guard, 'there is a dedup insert').toBeGreaterThan(-1);
    expect(redeem).toBeGreaterThan(-1);
    expect(guard, 'the guard must come first').toBeLessThan(redeem);
    expect(webhook).toContain("period_ref: invoice.id ?? 'unknown'");
  });

  // \u26a0\ufe0f THE GUARD FAILS OPEN, DELIBERATELY. Treating ANY insert error as
  // "already redeemed" would make a network blip or a schema-cache miss skip
  // the redeem silently and under-count the code — a community quietly
  // getting fewer redemptions than it sold, which nobody would ever notice.
  // Only 23505 means already; anything else is logged and the redeem goes
  // ahead, because the atomic RPC is the real ceiling.
  it('treats ONLY 23505 as already redeemed, and redeems anyway otherwise', () => {
    expect(webhook).toContain("const alreadyRedeemed = dedup?.code === '23505';");
    expect(webhook).toContain('if (!alreadyRedeemed) {');
    expect(webhook).toContain('redeeming anyway');
    // The shape that was wrong: a bare truthiness check on the error.
    expect(webhook, 'any-error-means-already is the silent under-count').not.toContain(
      'if (!already) {',
    );
  });
});

// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// "You may not" is not "we broke".
// \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
describe('an RLS refusal is a 403', () => {
  const failFn = src.slice(src.indexOf('function fail('), src.indexOf('// membership_settings is'));

  // The admin routes let RLS do the gating, which is the right design — but
  // it means "only an admin may do this" arrives as a Postgres error, and a
  // 500 tells somebody the system is broken when it is working as written.
  it('recognises the refusal by code and by message', () => {
    expect(failFn).toContain("error.code === '42501'");
    expect(failFn, 'PostgREST does not always set the code').toContain('row-level security');
  });

  it('answers 403 with something a person can act on', () => {
    expect(failFn).toContain("'only an admin can do that'");
    expect(failFn).toContain('403');
  });

  // And everything else still fails loudly: a 403 for a genuine fault would
  // send somebody looking for a permission problem that is not there.
  it('leaves every other error a 500', () => {
    expect(failFn).toContain('error.code }, 500)');
  });
});

