// /purchases/<id> — the member's invoices, with one of them open.
//
// Where an emailed "See this invoice in My Thread" button lands. Sjoerd,
// 2026-10-04: a person should be able to "see his/her invoice online (in
// my.thread - thus login)" — the invoice, not a list to search.
//
// NO OWNERSHIP CHECK HERE, and that is the design rather than an omission.
// The view renders the signed-in member's own rows — the API matches
// person_id OR payer_email against their verified address — so an id that
// belongs to somebody else is simply not among them: no dialog, no message,
// the same screen a nonexistent id gets. A second ownership rule in this
// file could disagree with the first one, and the one in the API is the one
// that actually guards the data.
//
// So a forwarded link reveals nothing without the recipient's own sign-in,
// and a uuid names nothing by itself.

import { PurchasesView } from '../view';

export const dynamic = 'force-dynamic';

export default async function PurchaseDeepLinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PurchasesView openId={id} />;
}
