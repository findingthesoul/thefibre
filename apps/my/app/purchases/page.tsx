// /purchases — the member's invoices.
//
// Three lines, because the body is shared with /purchases/<id>, which is the
// same list with one invoice's dialog open. See ./view.tsx.

import { PurchasesView } from './view';

export const dynamic = 'force-dynamic';

export default async function PurchasesPage() {
  return <PurchasesView />;
}
