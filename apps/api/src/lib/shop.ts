// THE SHOP's rules (my.thread, 2026-10-16; Sjoerd: "offer products for
// purchase/upgrade in my.thread (owned ones can't be bought again; recurring
// ones can be cancelled)", and later "an open shop and a members only shop").
//
// No new data and no new settings: which shop a product is in follows the
// rules that already gate the checkouts, so the shop cannot offer what a
// checkout would refuse (memory: offer and enforcement share code).
//
//   MEMBERS ONLY — per membership the add route accepts: memberAddonOffer
//     (lib/membership-change.ts), the same list "Add or change" shows.
//   OPEN — sold without a membership, the /public/buy and /public/subscribe
//     gates (routes/membership.ts): purchasable, not archived, priced; a
//     one-off is bought, a renewing product is subscribed to only when the
//     community opened it (sold_without_membership).
//   OWNED — a live grant (LIVE_PURCHASE_STATUSES): shown as owned, never
//     offered again in either list.
//
// Pure, so the rules are tested without a database (shop.test.ts).

export type ShopProductRow = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  price_interval: string | null;
  currency: string | null;
  price_includes_vat: boolean | null;
  purchasable: boolean | null;
  sold_without_membership: boolean | null;
  archived_at: string | null;
};

export type OpenAction = 'buy' | 'subscribe';

/** How a product is sold WITHOUT a membership, or null when it is not.
 *  Mirrors /public/buy (one-off) and /public/subscribe (renewing). */
export function openShopAction(p: ShopProductRow): OpenAction | null {
  if (p.archived_at || !p.purchasable || p.price_cents == null || p.price_cents <= 0) return null;
  const recurring = (p.price_interval ?? 'once') !== 'once';
  if (!recurring) return 'buy';
  return p.sold_without_membership ? 'subscribe' : null;
}

export type MembersOnlyItem = { id: string; name: string; price_cents: number | null; currency: string; recurring: boolean; price_interval: string | null };

export type ShopCommunity = {
  workspace_id: string;
  workspace_slug: string;
  workspace_name: string;
  /** The membership the members-only items are added to; null when the person
   *  is not a member here (or the membership cannot take add-ons). */
  member_id: string | null;
  members_only: (MembersOnlyItem & { action: 'add_to_membership' })[];
  open: { id: string; name: string; description: string | null; price_cents: number; price_interval: string; currency: string; price_includes_vat: boolean; action: OpenAction }[];
  owned: { id: string; name: string; recurring: boolean }[];
};

/** Compose one community's shop. A product appears in ONE place: owned wins,
 *  then members-only (the member's own route, at their net), then open. A
 *  community whose three lists are all empty is the caller's to drop. */
export function composeShop(input: {
  workspace: { id: string; slug: string; name: string };
  memberId: string | null;
  membersOnly: MembersOnlyItem[];
  products: ShopProductRow[];
  ownedIds: Set<string>;
  /** Open purchases need the community's payment account (the checkout
   *  answers 503 without one). */
  canSell: boolean;
  defaultCurrency: string;
}): ShopCommunity {
  const { workspace, memberId, products, ownedIds } = input;
  const mine = products.filter((p) => p.workspace_id === workspace.id);
  const owned = mine
    .filter((p) => ownedIds.has(p.id))
    .map((p) => ({ id: p.id, name: p.name, recurring: (p.price_interval ?? 'once') !== 'once' }));
  const membersOnly = input.membersOnly.filter((m) => !ownedIds.has(m.id)).map((m) => ({ ...m, action: 'add_to_membership' as const }));
  const taken = new Set([...ownedIds, ...membersOnly.map((m) => m.id)]);
  const open = input.canSell
    ? mine.flatMap((p) => {
        const action = openShopAction(p);
        if (!action || taken.has(p.id)) return [];
        return [
          {
            id: p.id,
            name: p.name,
            description: p.description,
            price_cents: p.price_cents!,
            price_interval: p.price_interval ?? 'once',
            currency: (p.currency ?? input.defaultCurrency).toUpperCase(),
            price_includes_vat: !!p.price_includes_vat,
            action,
          },
        ];
      })
    : [];
  return { workspace_id: workspace.id, workspace_slug: workspace.slug, workspace_name: workspace.name, member_id: memberId, members_only: membersOnly, open, owned };
}

/** `p`, or null once `ms` have passed — whichever comes first. The shop reads
 *  communities in parallel, so the slowest decides the page; a read past the
 *  cap is dropped for this answer (it is not cancelled — its result is
 *  simply not waited for). */
export async function withinCap<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<null>((res) => (timer = setTimeout(() => res(null), ms)))]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
