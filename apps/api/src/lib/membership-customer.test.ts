// Who may touch an existing Stripe customer.
//
// `/public/join` is unauthenticated and the email is typed, so "a member
// joining again" and "a stranger who knows that member's address" arrive
// identically. Reusing the stored customer on the strength of a typed email
// would let the stranger overwrite that member's name and address on the
// community's Stripe account — before any payment, since the update happens
// on the way to Checkout — and open a session against their customer.
//
// So the unproven path must never read the stored id, never update anything,
// and never let its address-collection mode depend on what is stored. These
// tests hold that line with a fake Stripe that records what it was asked to
// do: an assertion that `customers.update` was NOT called is the whole point,
// and it is paired with a positive one (`create` WAS called) so that a
// function which did nothing at all could not pass.

import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { customerForJoin } from './membership-customer.js';

const BILLING = {
  payer: 'organisation' as const,
  company: 'Acme BV',
  address: 'Sint-Jobsweg 30',
  postal_code: '3024 EJ',
  city: 'Rotterdam',
  country: 'NL',
};

/** A Stripe that records rather than calls. `create` answers with an id so
 *  the caller can carry on; `update` and `retrieve` throw if used, except
 *  where a test expects them. */
function fakeStripe() {
  const calls = { create: [] as unknown[], update: [] as unknown[], retrieve: [] as unknown[] };
  const stripe = {
    customers: {
      create: vi.fn(async (params: unknown) => {
        calls.create.push(params);
        return { id: 'cus_new' };
      }),
      update: vi.fn(async (id: string, params: unknown) => {
        calls.update.push({ id, params });
        return { id };
      }),
      retrieve: vi.fn(async (id: string) => {
        calls.retrieve.push(id);
        return { id, address: { line1: 'Stored Street 9' } };
      }),
    },
  } as unknown as Stripe;
  return { stripe, calls };
}

const args = (over: Partial<Parameters<typeof customerForJoin>[2]> = {}) => ({
  workspaceId: '11111111-1111-1111-1111-111111111111',
  personId: '22222222-2222-2222-2222-222222222222',
  email: 'member@example.com',
  personName: 'A Stranger',
  billing: BILLING,
  proven: false,
  ...over,
});

describe('an UNPROVEN join never touches a stored customer', () => {
  it('creates a fresh customer instead of reusing one', async () => {
    const { stripe, calls } = fakeStripe();
    const r = await customerForJoin(stripe, 'acct_x', args());
    expect(r.id).toBe('cus_new');
    expect(r.reused, 'nothing stored may be reused on a typed email').toBe(false);
    // The positive anchor: it really did do the work, so "update was not
    // called" means "it took the other path", not "it did nothing".
    expect(calls.create).toHaveLength(1);
  });

  // THE case. A stranger typing a member's address must not be able to edit
  // that member's billing identity on the community's Stripe account.
  it('never calls customers.update', async () => {
    const { stripe, calls } = fakeStripe();
    await customerForJoin(stripe, 'acct_x', args());
    expect(calls.update, JSON.stringify(calls.update)).toHaveLength(0);
  });

  // The quieter leak: if the collection mode followed what Stripe has on
  // file, flipping between 'auto' and 'required' would tell a stranger
  // whether that email is already a customer with an address.
  it('decides hasAddress from THIS request only, never from stored data', async () => {
    const { stripe, calls } = fakeStripe();
    const withAddress = await customerForJoin(stripe, 'acct_x', args());
    expect(withAddress.hasAddress).toBe(true);

    const without = await customerForJoin(
      stripe,
      'acct_x',
      args({ billing: { company: 'No street typed' } }),
    );
    expect(without.hasAddress, 'nothing typed means nothing known').toBe(false);
    // And it never asked Stripe what it holds, which is where that answer
    // would have leaked in from.
    expect(calls.retrieve).toHaveLength(0);
  });

  it('still works when nothing at all was typed', async () => {
    const { stripe } = fakeStripe();
    const r = await customerForJoin(stripe, 'acct_x', args({ billing: null }));
    expect(r.id).toBe('cus_new');
    expect(r.hasAddress).toBe(false);
  });

  it('carries the typed details onto the new customer, and the person’s own name', async () => {
    const { stripe, calls } = fakeStripe();
    await customerForJoin(stripe, 'acct_x', args({ billing: { address: 'Their Street 2' } }));
    const params = calls.create[0] as { name: string; address?: { line1: string } };
    // No "Who pays?" and no company: the invoice is for the person who typed.
    expect(params.name).toBe('A Stranger');
    expect(params.address?.line1).toBe('Their Street 2');
  });

  // A join must never fail because Stripe did. The checkout then runs the way
  // it did before this change — with the email, and Stripe asking.
  it('answers "no customer" rather than throwing when Stripe refuses', async () => {
    const stripe = {
      customers: {
        create: vi.fn(async () => {
          throw new Error('account disabled');
        }),
      },
    } as unknown as Stripe;
    const r = await customerForJoin(stripe, 'acct_x', args());
    expect(r).toEqual({ id: null, reused: false, hasAddress: false });
  });
});
