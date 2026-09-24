import { describe, expect, it, vi, beforeEach } from 'vitest';

// The platform cannot take a commission from itself: Stripe refuses an
// application_fee when the request is on behalf of the account making it.
// Sjoerd hit this at the Pay button on The Thread's own workspace, after the
// checkout page had already rendered — so the failure was as late as it could
// possibly be while still being a failure.
vi.mock('./stripe/connect.js', () => ({
  isOwnAccount: vi.fn(async (id: string | null | undefined) => id === 'acct_PLATFORM'),
}));
vi.mock('../db.js', () => ({
  adminClient: { rpc: async () => ({ data: [{ pct: 0.02, cap_cents: 200 }] }) },
}));

const { platformFeeCents } = await import('./fees.js');

describe('platformFeeCents when the seller IS the platform', () => {
  beforeEach(() => vi.clearAllMocks());

  it('charges nothing on the platform own account', async () => {
    expect(await platformFeeCents('ws', 10_000, 'acct_PLATFORM')).toBe(0);
  });

  it('still charges on somebody else account', async () => {
    expect(await platformFeeCents('ws', 10_000, 'acct_CLIENT')).toBeGreaterThan(0);
  });

  it('charges when no destination is given, rather than silently dropping revenue', async () => {
    expect(await platformFeeCents('ws', 10_000)).toBeGreaterThan(0);
  });
});
