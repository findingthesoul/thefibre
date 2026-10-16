// A MEMBER'S DIRECTORY CATEGORIES — one reader for the two places that ask
// (docs/member-directory-spec.md §3, §5): the member directory, which shows
// members to each other by shared category, and the member page (2jj
// follow-up), which shows a section or document to a category's holders.
// Lifted out of routes/membership-portal.ts unchanged, so "holds a category"
// cannot mean two things. Callers decide WHO is live; this only unions.

import { adminClient } from '../db.js';
import { selectAll, selectIn } from './select-in.js';

/** Categories a set of people hold, by person: the union over the products
 *  in their tier plus anything bought on its own (§5).
 *
 *  Every read is scoped to this workspace — including the product→category
 *  links, which until 2026-10-15 were read for EVERY workspace on the
 *  platform. That never showed anybody another community's category NAMES
 *  (names come from membership_directory_category, which was always
 *  filtered, and a link only counted if its product was in one of this
 *  workspace's tiers or purchases). What it did do was read the whole
 *  table, and past 1,000 links platform-wide PostgREST would have cut it
 *  short without a word — dropping categories, and in category mode,
 *  silently hiding members from each other. The table has no workspace_id
 *  of its own; the product carries it, so the filter goes through the join. */
export async function categoriesByPerson(
  workspaceId: string,
  personIds: string[],
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (!personIds.length) return out;

  const [members, links, purchases] = await Promise.all([
    selectIn<{ person_id: string; tier_id: string }>('directory categories (members)', personIds, (chunk) =>
      adminClient
        .from('membership_member')
        .select('id, person_id, tier_id')
        .eq('workspace_id', workspaceId)
        .in('person_id', chunk)
        .is('deleted_at', null)
        .order('id'),
    ),
    selectAll<{ product_id: string; category_id: string }>('directory categories (links)', () =>
      adminClient
        .from('membership_product_category')
        .select('product_id, category_id, membership_product!inner(workspace_id)')
        .eq('membership_product.workspace_id', workspaceId)
        .order('product_id')
        .order('category_id'),
    ),
    selectIn<{ person_id: string; product_id: string }>('directory categories (purchases)', personIds, (chunk) =>
      adminClient
        .from('membership_product_purchase')
        .select('id, person_id, product_id')
        .eq('workspace_id', workspaceId)
        .in('person_id', chunk)
        .order('id'),
    ),
  ]);

  const tierIds = [...new Set(members.map((m) => m.tier_id))];
  const tierProducts = await selectIn<{ tier_id: string; product_id: string }>(
    'directory categories (tier products)',
    tierIds,
    (chunk) =>
      adminClient
        .from('membership_tier_product')
        .select('tier_id, product_id')
        .in('tier_id', chunk)
        .order('tier_id')
        .order('product_id'),
  );

  const catsOfProduct = new Map<string, string[]>();
  for (const l of links) {
    const list = catsOfProduct.get(l.product_id) ?? [];
    list.push(l.category_id);
    catsOfProduct.set(l.product_id, list);
  }
  const productsOfTier = new Map<string, string[]>();
  for (const tp of tierProducts) {
    const list = productsOfTier.get(tp.tier_id) ?? [];
    list.push(tp.product_id);
    productsOfTier.set(tp.tier_id, list);
  }

  const add = (personId: string, productId: string) => {
    const set = out.get(personId) ?? new Set<string>();
    for (const c of catsOfProduct.get(productId) ?? []) set.add(c);
    out.set(personId, set);
  };
  for (const m of members) {
    for (const p of productsOfTier.get(m.tier_id) ?? []) add(m.person_id, p);
  }
  for (const p of purchases) add(p.person_id, p.product_id);
  return out;
}
