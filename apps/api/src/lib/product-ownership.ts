// WHEN A PRODUCT GRANT COUNTS AS OWNED — one rule for every reader (access,
// member discount, team calendars, add-on offers, the portal's product list,
// directory categories). Found 2026-10-16: a recurring ADD-ON's grant was a
// status 'paid' row, and every reader treated 'paid' as owned forever — so a
// member who took one with their membership kept its thread access, discount
// and directory category after the membership lapsed.
//
//   paid      a one-off purchase — owned for good (unchanged)
//   active    a grant on a live subscription (an add-on riding a membership,
//             or — later — a product's own subscription)
//   past_due  the subscription's payment failed; still owned, the way grace
//             still counts for a member
//   cancelled / refunded — not owned

export const LIVE_PURCHASE_STATUSES = ['paid', 'active', 'past_due'] as const;

/** A product that renews: its grant rides a subscription and can end. */
export const isRecurringInterval = (interval: string | null | undefined): boolean => (interval ?? 'once') !== 'once';

/** The status a new grant starts with: a one-off is 'paid' (owned for good),
 *  a recurring product is 'active' on its subscription. */
export const grantStatusFor = (interval: string | null | undefined): 'paid' | 'active' => (isRecurringInterval(interval) ? 'active' : 'paid');
