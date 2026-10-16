// /purchases — the member's invoices.
//
// Three lines, because the body is shared with /purchases/<id>, which is the
// same list with one invoice's dialog open. See ./view.tsx.

import { PurchasesView } from './view';

export const dynamic = 'force-dynamic';

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ paid?: string }> }) {
  // ?paid=1 — back from a Stripe checkout started in the Shop (2026-10-17).
  return <PurchasesView justPaid={(await searchParams).paid === '1'} />;
}
