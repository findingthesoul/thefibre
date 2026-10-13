// The Thread's discount codes: not guessable in bulk, and not spendable
// twice.
//
// Both of these were open on production until 2026-10-13, and both are the
// same class as faults already fixed in the membership path that afternoon —
// which is how they were found. Read off the route's source, because no type
// can say "the limiter runs before the lookup" or "the update is its own
// check", and both are about money.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./thread.ts', import.meta.url), 'utf8');

describe('the public coupon validator is rate-limited', () => {
  const handler = src.slice(
    src.indexOf("threadRoutes.post('/public/validate-coupon'"),
    src.indexOf("threadRoutes.post('/public/validate-coupon'") + 3000,
  );

  // It answers "does this code exist" to anybody who asks, and answered
  // without limit until today. Codes are short and human — EARLYBIRD,
  // SUMMER25 — so an unguessable one is the exception.
  it('refuses after too many attempts', () => {
    expect(handler).toContain('hit(');
    expect(handler).toContain("c.header('Retry-After'");
    expect(handler).toMatch(/429/);
  });

  // By caller alone, one office behind one address locks itself out of every
  // thread. By thread alone, one guesser locks out that thread's joiners.
  it('keys on the thread AND the caller', () => {
    expect(handler).toContain('hit(`thread-code:${thread.id}:${clientIp(c.req.raw.headers)}`');
  });

  // ON THE RESOLVED ID, NOT THE TYPED SLUGS. A key built from what the caller
  // typed is only as strict as the lookup: if a slug column ever became
  // citext — plausible, for friendlier URLs — then /Thread and /thread would
  // be one thread and two buckets, and the limit would be bypassable by
  // varying case. Measured 2026-10-13: both slug columns ARE case-sensitive
  // today, so this is about not letting that start working by accident.
  it('does not key on anything the caller typed', () => {
    expect(handler).not.toContain('thread-code:${d.organiser_slug}');
    expect(handler).not.toContain('thread-code:${d.thread_slug}');
  });

  // A client can send its own X-Forwarded-For; a limiter keyed on a value the
  // attacker picks is not a limiter.
  it('does not read the forwarded header itself', () => {
    expect(handler).not.toMatch(/c\.req\.header\(\s*['"]x-forwarded-for/i);
  });

  it('refuses BEFORE it looks the code up', () => {
    const gate = handler.indexOf('const codeGate = hit(');
    const lookup = handler.indexOf('findValidCoupon(');
    expect(gate).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(-1);
    expect(gate, 'a limiter after the lookup has already answered').toBeLessThan(lookup);
  });
});

describe('the enrol route limits GUESSES, not enrolments', () => {
  const enrol = src.slice(src.indexOf('// Discount code — validated server-side'));

  // ⚠️ THE DISTINCTION THAT MATTERS. This route does not merely answer a
  // question, it ENROLS somebody. A blanket limit would mean a classroom
  // signing up from one network, or a conference on one wifi, hits a wall and
  // cannot join — a real person turned away, which is worse than the guessing
  // it would prevent. Only a WRONG code counts.
  it('counts only a failed code, inside the error branch', () => {
    const limiter = enrol.indexOf('thread-code-fail:');
    const branch = enrol.indexOf("if ('error' in r) {");
    const coupon = enrol.indexOf('coupon = r.coupon;');
    expect(limiter, 'there is a limiter').toBeGreaterThan(-1);
    expect(branch).toBeGreaterThan(-1);
    expect(limiter, 'it is inside the failure branch').toBeGreaterThan(branch);
    expect(limiter, 'and before the success path').toBeLessThan(coupon);
  });

  it('never counts a join with no code at all', () => {
    // The whole block is inside `if (d.coupon_code)`, so somebody joining
    // without a code cannot reach the limiter.
    const guard = enrol.indexOf('if (d.coupon_code) {');
    const limiter = enrol.indexOf('thread-code-fail:');
    expect(guard).toBeGreaterThan(-1);
    expect(guard, 'the code check wraps the limiter').toBeLessThan(limiter);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EVERY USE IS COUNTED. Not "exactly one succeeds" — that would be a
// different product decision.
//
// The redemption runs AFTER the enrolment is committed, so a plain
// compare-and-set that loses the race leaves that enrolment standing and
// simply does not count it: the same lost update as before, now also when the
// code is nowhere near its limit. The loop re-reads and retries, so an
// oversell is accepted and warned about rather than a use going missing.
// ─────────────────────────────────────────────────────────────────────────────
describe('a coupon counts every use', () => {
  const redeem = src.slice(src.indexOf('if (coupon && !reusedEnrolment) {')).slice(0, 3000);

  it('retries on a lost race rather than giving up the count', () => {
    expect(redeem).toContain('attempt < 5');
    expect(redeem).toContain(".eq('used_count', count)");
    // And re-reads the number somebody else wrote, instead of retrying with
    // the stale one — which would spin five times and record nothing.
    expect(redeem).toContain("select('used_count')");
  });

  it('says so out loud when the code is oversold', () => {
    expect(redeem).toContain('oversold');
    expect(redeem).toContain('coupon.usage_limit && count > coupon.usage_limit');
  });

  it('says so when a use went uncounted after every try', () => {
    expect(redeem).toContain('went uncounted after 5 tries');
  });

  // Logged, never thrown: the enrolment is already committed, and failing it
  // now over bookkeeping would be worse than an inaccurate count.
  it('never fails the enrolment over the count', () => {
    expect(redeem).not.toContain('throw new Error');
  });
});
